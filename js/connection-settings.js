(() => {
const { isIP } = require('net');
const KEY = 'ai-tagger.connection.v1';
const DEFAULT = { host: '127.0.0.1', port: 8000 };
function validate(host, port) {
    host = String(host).trim();
    if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
    const domain = host.length <= 253 && host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
    if (!isIP(host) && (!domain || /^[0-9.]+$/.test(host))) {
        throw new Error('IPアドレスまたはホスト名を入力してください。http:// やパスは不要です。');
    }
    if (!/^\d+$/.test(String(port).trim()) || Number(port) < 1 || Number(port) > 65535) {
        throw new Error('ポート番号は1〜65535の整数で入力してください。');
    }
    return { host, port: Number(port) };
}
function load(storage) {
    try {
        const saved = JSON.parse(storage.getItem(KEY));
        return saved ? validate(saved.host, saved.port) : { ...DEFAULT };
    } catch { return { ...DEFAULT }; }
}
function save(storage, host, port) {
    const config = validate(host, port);
    try { storage.setItem(KEY, JSON.stringify(config)); }
    catch { throw new Error('設定を保存できませんでした。保存領域を確認してください。'); }
    return config;
}
function format(config) {
    return 'http://' + (config.host.includes(':') ? '[' + config.host + ']' : config.host) + ':' + config.port;
}
const api = { validate, load, save, format };
if (typeof module !== 'undefined') module.exports = api;
if (typeof window !== 'undefined') window.aiTaggerConnectionSettings = api;
})();

