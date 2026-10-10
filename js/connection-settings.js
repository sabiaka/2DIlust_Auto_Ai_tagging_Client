(() => {
const { isIP } = require('net');
const KEY = 'ai-tagger.connection.v1';
const DEFAULT = { host: '127.0.0.1', port: 8000, protocol: 'http:', token: '' };
function validate(host, port, token = '') {
    host = String(host).trim();
    let protocol = 'http:';
    if (/^https?:\/\//i.test(host)) {
        let url;
        try { url = new URL(host); } catch { throw new Error('正しいHTTP/HTTPS URLを入力してください。'); }
        if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
            throw new Error('URLには認証情報・パス・クエリを含めないでください。');
        }
        protocol = url.protocol;
        host = url.hostname;
        port = url.port || (protocol === 'https:' ? 443 : 80);
    }
    if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
    const domain = host.length <= 253 && host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
    if (!isIP(host) && (!domain || /^[0-9.]+$/.test(host))) {
        throw new Error('IPアドレス・ホスト名、またはHTTP/HTTPS URLを入力してください。');
    }
    if (!/^\d+$/.test(String(port).trim()) || Number(port) < 1 || Number(port) > 65535) {
        throw new Error('ポート番号は1〜65535の整数で入力してください。');
    }
    token = String(token).trim();
    if (token && !/^[\x21-\x7e]{1,512}$/.test(token)) throw new Error('トークンは空白のない半角文字で入力してください。');
    return { host, port: Number(port), protocol, token };
}
function format(config) {
    const protocol = config.protocol || 'http:';
    const port = config.port === (protocol === 'https:' ? 443 : 80) ? '' : ':' + config.port;
    return protocol + '//' + (config.host.includes(':') ? '[' + config.host + ']' : config.host) + port;
}
function load(storage) {
    try {
        const saved = JSON.parse(storage.getItem(KEY));
        if (!saved) return { ...DEFAULT };
        const host = saved.protocol ? format(saved) : saved.host;
        return validate(host, saved.port, saved.token || '');
    } catch { return { ...DEFAULT }; }
}
function save(storage, host, port, token = '') {
    const config = validate(host, port, token);
    try { storage.setItem(KEY, JSON.stringify(config)); }
    catch { throw new Error('設定を保存できませんでした。保存領域を確認してください。'); }
    return config;
}
const api = { validate, load, save, format };
if (typeof module !== 'undefined') module.exports = api;
if (typeof window !== 'undefined') window.aiTaggerConnectionSettings = api;
})();

