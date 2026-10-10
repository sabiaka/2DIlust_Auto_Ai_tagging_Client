const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function createManager({ configPath, storage, settings, onProgress = () => {}, spawnProcess = spawn, readFile = fs.readFileSync, exists = fs.existsSync, fallbackPaths = process.env.APPDATA ? [path.join(process.env.APPDATA, 'Eagle', 'ai-tagger-colab.json')] : [] }) {
    const modeKey = 'ai-tagger.colab-auto.v1';
    let inFlight = null;
    function findConfig() { return [configPath, ...fallbackPaths].find(file => exists(file)); }
    function available() { return Boolean(findConfig()); }
    function enabled() { return available() && storage.getItem(modeKey) !== 'false'; }
    function setEnabled(value) { storage.setItem(modeKey, String(Boolean(value))); }
    function ensure() {
        if (inFlight) return inFlight;
        inFlight = recover().finally(() => { inFlight = null; });
        return inFlight;
    }
    async function recover() {
        const locatedConfig = findConfig();
        if (!locatedConfig) throw new Error('このPCのColab自動接続設定が見つかりません。');
        const config = JSON.parse(readFile(locatedConfig, 'utf8'));
        if (!path.isAbsolute(config.helper) || !path.isAbsolute(config.connectionFile)) {
            throw new Error('Colab自動接続の設定ファイルに絶対パスが必要です。');
        }
        onProgress('Colabの接続を確認しています。必要な場合は自動で再起動します。');
        await new Promise((resolve, reject) => {
            const child = spawnProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', config.helper], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
            let pending = '';
            let settled = false;
            const timer = setTimeout(() => {
                child.kill();
                finish(new Error('Colabの復旧が25分を超えました。状態確認batで確認してください。'));
            }, 1500000);
            function finish(error) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                error ? reject(error) : resolve();
            }
            child.stdout.on('data', chunk => {
                pending += chunk.toString();
                const lines = pending.split(/\r?\n/);
                pending = lines.pop();
                for (const line of lines) {
                    // Only display our progress markers; never forward credentials or arbitrary CLI output.
                    if (line.startsWith('[colab-auto] Starting')) onProgress('ColabのT4を起動しています。初回準備には数分かかります。');
                    if (line.startsWith('[colab-auto] Restarting')) onProgress('停止したAPIのランタイムを作り直しています。');
                }
            });
            child.stderr.on('data', () => {});
            child.on('error', () => finish(new Error('Colab自動起動を実行できません。CLIと自動接続設定を確認してください。')));
            child.on('close', code => finish(code === 0 ? null : new Error('Colabの自動復旧に失敗しました。Check-Colab-API.batで状態を確認してください。認証切れの場合はColab-Login.batを実行してください。')));
        });
        const connection = JSON.parse(readFile(config.connectionFile, 'utf8'));
        const parsed = new URL(connection.url);
        if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.trycloudflare.com') || !connection.token) {
            throw new Error('Colabの新しい接続情報を確認できませんでした。');
        }
        const destination = settings.save(storage, connection.url, 443, connection.token);
        onProgress('Colabの接続先を自動更新しました。');
        return destination;
    }
    return { available, enabled, setEnabled, ensure };
}
module.exports = { createManager };
