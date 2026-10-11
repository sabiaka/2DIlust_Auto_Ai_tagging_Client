// js/plugin.js (Final Version)

// --- 必要なモジュールを読み込む ---
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http'); // axiosの代わりにhttpモジュールを使う
const https = require('https');

// --- APIサーバーの設定 ---
const connectionSettings = window.aiTaggerConnectionSettings;
let apiSettings = connectionSettings.load(localStorage);
const colabManager = require(path.join(__dirname, 'js', 'colab-manager.js')).createManager({
    configPath: path.join(__dirname, 'colab-auto.json'), storage: localStorage,
    settings: connectionSettings, onProgress: message => log(message, 'info'),
});
const API_PATH = '/tag';

function refreshConnectionFromJson() {
    // Respect a manually selected LAN server. Existing Colab connections also
    // synchronize when runtime auto-start has been switched off.
    if (!colabManager.enabled() && !apiSettings.host.endsWith('.trycloudflare.com')) return;
    try {
        const updated = colabManager.sync();
        if (updated) {
            apiSettings = updated;
            const current = document.getElementById('connection-current');
            if (current) current.textContent = connectionSettings.format(apiSettings);
        }
    } catch (_) {
        log('接続JSONを読み込めませんでした。現在の設定を保持します。自動復旧時に再取得します。', 'warn');
    }
}

// --- メインの処理 ---

// タグ付け実行・キャンセル制御用フラグ
let isTagging = false;
let cancelTagging = false;

// ボタン状態切り替え
function updateTagButton(running) {
    const tagButton = document.getElementById('tag-button');
    if (!tagButton) return;
    if (running) {
        tagButton.textContent = 'タグ付け中止';
        tagButton.classList.add('tagging');
    } else {
        tagButton.textContent = '選択した画像・動画にAIタグ付けを実行';
        tagButton.classList.remove('tagging');
    }
}

// HTMLの準備ができたら、ボタンにクリックイベントをセットする
window.addEventListener('DOMContentLoaded', () => {
    refreshConnectionFromJson();
    const dialog = document.getElementById('connection-dialog');
    const hostInput = document.getElementById('connection-host');
    const portInput = document.getElementById('connection-port');
    const tokenInput = document.getElementById('connection-token');
    const feedback = document.getElementById('connection-feedback');
    const autoColab = document.getElementById('connection-auto-colab');
    function showConnection() {
        document.getElementById('connection-current').textContent = connectionSettings.format(apiSettings);
    }
    showConnection();
    document.getElementById('settings-button').addEventListener('click', () => {
        refreshConnectionFromJson();
        hostInput.value = apiSettings.protocol === 'https:' ? connectionSettings.format(apiSettings) : apiSettings.host;
        portInput.value = apiSettings.port;
        tokenInput.value = apiSettings.token;
        autoColab.checked = colabManager.enabled();
        autoColab.disabled = !colabManager.available();
        feedback.textContent = '';
        dialog.showModal();
    });
    document.getElementById('connection-close').addEventListener('click', () => dialog.close());
    document.getElementById('connection-form').addEventListener('submit', event => {
        event.preventDefault();
        try {
            apiSettings = connectionSettings.save(localStorage, hostInput.value, portInput.value, tokenInput.value);
            colabManager.setEnabled(autoColab.checked);
            showConnection();
            dialog.close();
            log('接続先を保存しました: ' + connectionSettings.format(apiSettings), 'info');
        } catch (error) {
            feedback.textContent = error.message;
        }
    });
    document.getElementById('connection-reset').addEventListener('click', () => {
        hostInput.value = '127.0.0.1';
        portInput.value = '8000';
        tokenInput.value = '';
        autoColab.checked = false;
        feedback.textContent = '初期値を入力しました。「保存」で反映します。';
    });
    const tagButton = document.getElementById('tag-button');
    tagButton.addEventListener('click', () => {
        if (isTagging) {
            cancelTagging = true;
            log('キャンセル要求を受け付けました...', 'warn');
        } else {
            runAiTagging();
        }
    });
    updateTagButton(false);
    log('準備完了！ボタンを押してね！', 'success');
});

// AIタグ付けを実行するメイン関数
async function runAiTagging() {
    if (isTagging) return;
    isTagging = true;
    cancelTagging = false;
    updateTagButton(true);
    // Keep one destination for the whole job; edits apply to the next run.
    try {
        refreshConnectionFromJson();
        const items = await eagle.item.getSelected();
        if (items.length === 0) {
            log('画像・動画をせんたーく！してね！', 'warn');
            return;
        }
        if (colabManager.enabled()) {
            apiSettings = await colabManager.ensure();
            document.getElementById('connection-current').textContent = connectionSettings.format(apiSettings);
            if (cancelTagging) return;
        }
        let destination = { ...apiSettings };
        const retriedItems = new Set();
        let recoveryCount = 0;
        // 動画ファイルの数をカウント
        const videoCount = items.filter(item => {
            const ext = item.ext.toLowerCase();
            return ['mp4', 'mov', 'avi', 'wmv', 'mpeg', 'mpg'].includes(ext);
        }).length;
        
        if (videoCount > 0) {
            log(`タグ付けスタート！対象は ${items.length} 件（動画: ${videoCount}件）だよ✨ 動画ファイルは時間がかかる場合があります`, 'info');
        } else {
            log(`タグ付けスタート！対象は ${items.length} 件だよ✨`, 'info');
        }

        // プログレスバー要素取得
        const progressBarContainer = window.parent?.document?.getElementById('progress-bar-container') || document.getElementById('progress-bar-container');
        const progressBar = window.parent?.document?.getElementById('progress-bar') || document.getElementById('progress-bar');
        const progressText = window.parent?.document?.getElementById('progress-text') || document.getElementById('progress-text');
        if (progressBarContainer && progressBar && progressText) {
            progressBarContainer.style.display = '';
            progressBar.style.width = '0%';
            progressText.textContent = '';
        }

        // 選択された画像を1枚ずつ処理する
        for (let i = 0; i < items.length; i++) {
            if (cancelTagging) {
                log('タグ付け処理を中止しました。', 'warn');
                break;
            }
            const item = items[i];
            const ext = item.ext.toLowerCase();
            try {
                const fileBuffer = fs.readFileSync(item.filePath);
                if (fileBuffer.length === 0) {
                    // サムネイル用画像パス
                    let thumbPath = '';
                    if (item.filePath) {
                        thumbPath = item.filePath.startsWith('http') ? item.filePath : 'file://' + item.filePath;
                    } else if (item.url) {
                        thumbPath = item.url;
                    }
                    log(`[${item.name}] はファイルが空なのでスキップします。`, 'warn', thumbPath);
                    continue;
                }

                const form = new FormData();

                // ★★★ ファイルの種類(Content-Type)をちゃんと教える ★★★
                let contentType = 'application/octet-stream'; // デフォルト

                // ↓↓↓ ここに動画の判定を追加したよ！ ↓↓↓
                if (ext === 'jpg' || ext === 'jpeg' || ext === 'jfif') {
                    contentType = 'image/jpeg';
                } else if (ext === 'png') {
                    contentType = 'image/png';
                } else if (ext === 'gif') {
                    contentType = 'image/gif';
                } else if (ext === 'bmp') {
                    contentType = 'image/bmp';
                } else if (ext === 'webp') {
                    contentType = 'image/webp';
                } else if (ext === 'psd') {
                    contentType = 'image/vnd.adobe.photoshop';
                } else if (ext === 'mp4') { // ★ここから追加！
                    contentType = 'video/mp4';
                } else if (ext === 'mov') {
                    contentType = 'video/quicktime';
                } else if (ext === 'avi') {
                    contentType = 'video/x-msvideo';
                } else if (ext === 'wmv') {
                    contentType = 'video/x-ms-wmv';
                } else if (ext === 'mpeg' || ext === 'mpg') {
                    contentType = 'video/mpeg';
                } // ★ここまで！

                // FormDataに追加するときに、ファイル名とContent-Typeを指定する
                form.append('file', fileBuffer, {
                    filename: item.name,
                    contentType: contentType,
                });
                // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

                // httpモジュールを使って、サーバーにリクエストを送信する
                const isVideo = ['mp4', 'mov', 'avi', 'wmv', 'mpeg', 'mpg'].includes(ext);
                const timeout = isVideo ? 300000 : 60000; // 動画は5分、画像は1分
                
                log(`[${item.name}] の処理を開始します...${isVideo ? ' (動画ファイル - 時間がかかる場合があります)' : ''}`, 'info');
                
                const tags = await new Promise((resolve, reject) => {
                    const transport = destination.protocol === 'https:' ? https : http;
                    const request = transport.request({
                        method: 'POST',
                        hostname: destination.host,
                        port: destination.port,
                        path: API_PATH,
                        headers: { ...form.getHeaders(), ...(destination.token ? { Authorization: 'Bearer ' + destination.token } : {}) },
                        timeout: timeout, // タイムアウト設定
                    }, (response) => {
                        const responseChunks = [];
                        response.on('data', chunk => {
                            responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8'));
                        });
                        response.on('end', () => {
                            try {
                                // A UTF-8 character may span several network chunks.
                                // Decode only after assembling the complete byte stream.
                                const responseData = Buffer.concat(responseChunks).toString('utf8');
                                if (response.statusCode < 200 || response.statusCode >= 300) {
                                    const error = new Error(response.statusCode === 530
                                        ? 'HTTP 530: 接続先のColab APIが停止している可能性があります。再起動後のURLとトークンを設定してください。'
                                        : `HTTPエラー: ${response.statusCode}`);
                                    error.statusCode = response.statusCode;
                                    try {
                                        error.response = { data: JSON.parse(responseData) };
                                    } catch (_) {
                                        // Proxy errors can return HTML instead of API JSON.
                                    }
                                    reject(error);
                                    return;
                                }
                                const jsonResponse = JSON.parse(responseData);
                                if (response.statusCode >= 200 && response.statusCode < 300) {
                                    resolve(jsonResponse.tags);
                                } else {
                                    const error = new Error(`HTTPエラー: ${response.statusCode}`);
                                    error.response = { data: jsonResponse };
                                    reject(error);
                                }
                            } catch (e) {
                                reject(e);
                            }
                        });
                    });
                    
                    // タイムアウト処理
                    request.on('timeout', () => {
                        request.destroy();
                        const error = new Error(`タイムアウト: ${isVideo ? '動画ファイルの処理に時間がかかりすぎました' : '画像ファイルの処理に時間がかかりすぎました'} (${timeout/1000}秒)`);
                        error.code = 'ETIMEDOUT';
                        reject(error);
                    });
                    
                    request.on('error', (err) => reject(err));
                    form.pipe(request);
                });

                // タグ付け処理
                if (tags && tags.length > 0) {
                    const newTags = [...new Set([...item.tags, ...tags])];
                    item.tags = newTags;
                    await item.save();
                    const isVideo = ['mp4', 'mov', 'avi', 'wmv', 'mpeg', 'mpg'].includes(ext);
                    if (isVideo) {
                        log(`[${item.name}] にタグ [${tags.join(', ')}] を追加したお！🎉 (動画ファイル)`, 'success', item.filePath);
                    } else {
                        log(`[${item.name}] にタグ [${tags.join(', ')}] を追加したお！🎉`, 'success', item.filePath);
                    }
                } else {
                    const isVideo = ['mp4', 'mov', 'avi', 'wmv', 'mpeg', 'mpg'].includes(ext);
                    if (isVideo) {
                        log(`[${item.name}] は新しいタグがなかったよ (動画ファイル)`, 'warn', item.filePath);
                    } else {
                        log(`[${item.name}] は新しいタグがなかったよ`, 'warn', item.filePath);
                    }
                }

                // プレビュー表示（動画の場合は無効）
                const previewContainer = window.parent?.document?.getElementById('preview-container') || document.getElementById('preview-container');
                const previewImage = window.parent?.document?.getElementById('preview-image') || document.getElementById('preview-image');
                if (previewContainer && previewImage) {
                    // 動画ファイルの場合はプレビューを無効にする
                    const isVideo = ['mp4', 'mov', 'avi', 'wmv', 'mpeg', 'mpg'].includes(ext);
                    if (!isVideo) {
                        // file:// で表示できる場合はfilePathをsrcに
                        previewImage.src = item.filePath.startsWith('http') ? item.filePath : 'file://' + item.filePath;
                        previewContainer.style.display = '';
                    }
                }

                // プログレスバー更新
                if (progressBar && progressText) {
                    const done = i + 1;
                    const total = items.length;
                    const percent = Math.round((done / total) * 100);
                    progressBar.style.width = percent + '%';
                    const isVideo = ['mp4', 'mov', 'avi', 'wmv', 'mpeg', 'mpg'].includes(ext);
                    const fileType = isVideo ? '動画' : '画像';
                    progressText.textContent = `${done} / ${total}  ${percent}% (${fileType})`;
                    console.log(`[progress] done=${done}, total=${total}, percent=${percent}, barWidth=${progressBar.style.width}, text='${progressText.textContent}'`);
                }

                // UI更新のためにイベントループをyield
                await new Promise(r => setTimeout(r, 0));
            } catch (err) {
                const unavailable = [401, 502, 503, 504, 521, 522, 523, 524, 530].includes(err.statusCode)
                    || ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(err.code);
                if (unavailable) {
                    if (cancelTagging) break;
                    if (!colabManager.enabled() || retriedItems.has(i) || recoveryCount >= 3) {
                        throw new Error(`[${item.name}] 接続障害のため後続の送信を停止しました: ${err.message}`);
                    }
                    retriedItems.add(i);
                    recoveryCount++;
                    log(`[${item.name}] 接続障害を検出しました。後続の送信を止めてColabを復旧します。`, 'warn');
                    // Recovery failures escape the item loop and stop the whole job.
                    apiSettings = await colabManager.ensure({ forceRestart: [502, 503, 504, 521, 522, 523, 524, 530].includes(err.statusCode) });
                    destination = { ...apiSettings };
                    document.getElementById('connection-current').textContent = connectionSettings.format(apiSettings);
                    if (cancelTagging) break;
                    log(`[${item.name}] 更新した接続先で再試行します。`, 'info');
                    i--;
                    continue;
                }
                const isVideo = ['mp4', 'mov', 'avi', 'wmv', 'mpeg', 'mpg'].includes(ext);
                if (isVideo) {
                    log(`[${item.name}] のタグ付けでエラー発生: ${err.message} (動画ファイル)`, 'error', item.filePath);
                } else {
                    log(`[${item.name}] のタグ付けでエラー発生: ${err.message}`, 'error', item.filePath);
                }
                if (err.response && err.response.data) {
                    const errorDetails = JSON.stringify(err.response.data, null, 2);
                    log(`サーバーからのエラー詳細:\n${errorDetails}`, 'error');
                } else {
                    log(`その他エラー: ${err.message}`, 'error');
                }
            }
        }
        if (!cancelTagging) {
            log('ぜんぶ終わったよ！おつかれ！💖', 'info');
        } else {
            log('処理がキャンセルされました。', 'warn');
        }

        // 全て終わったらプレビュー非表示＆プログレスバー非表示
        const previewContainer = window.parent?.document?.getElementById('preview-container') || document.getElementById('preview-container');
        if (previewContainer) previewContainer.style.display = 'none';
        if (progressBarContainer && progressBar && progressText) {
            progressBar.style.width = '100%';
            progressText.textContent = `${items.length} / ${items.length}  100%`;
            setTimeout(() => { progressBarContainer.style.display = 'none'; }, 500);
        }
    } catch (err) {
        log(`タグ付けを停止しました: ${err.message}`, 'error');
        const progressText = document.getElementById('progress-text');
        if (progressText) progressText.textContent += '（エラーで停止）';
    } finally {
        isTagging = false;
        updateTagButton(false);
        cancelTagging = false;
    }
}

// ログをUIに表示するためのヘルパー関数
function log(message, level = 'info', imagePath = null) {
    if (window.appendToLog) {
        window.appendToLog(message, level, imagePath);
    }
}
