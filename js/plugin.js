// js/plugin.js (Final Version)

// --- 必要なモジュールを読み込む ---
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http'); // axiosの代わりにhttpモジュールを使う

// --- APIサーバーの設定 ---
const API_HOST = '127.0.0.1';
const API_PORT = 8000;
const API_PATH = '/tag';

// --- メインの処理 ---

// HTMLの準備ができたら、ボタンにクリックイベントをセットする
window.addEventListener('DOMContentLoaded', () => {
    const tagButton = document.getElementById('tag-button');
    tagButton.addEventListener('click', () => {
        runAiTagging();
    });
    log('準備完了！ボタンを押してね！', 'success');
});

// AIタグ付けを実行するメイン関数
async function runAiTagging() {
    try {
        const items = await eagle.item.getSelected();
        if (items.length === 0) {
            log('画像をせんたーく！してね！', 'warn');
            return;
        }
        log(`タグ付けスタート！対象は ${items.length} 件だよ✨`, 'info');

        // 選択された画像を1枚ずつ処理する
        for (const item of items) {
            try {
                const fileBuffer = fs.readFileSync(item.filePath);
                if (fileBuffer.length === 0) {
                    log(`[${item.name}] はファイルが空なのでスキップします。`, 'warn');
                    continue;
                }

                const form = new FormData();

                // ★★★ ファイルの種類(Content-Type)をちゃんと教える ★★★
                const ext = item.ext.toLowerCase();
                let contentType = 'application/octet-stream'; // デフォルト

                // ↓↓↓ この行に`.jfif`を追加するだけ！ ↓↓↓
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
                }

                // FormDataに追加するときに、ファイル名とContent-Typeを指定する
                form.append('file', fileBuffer, {
                    filename: item.name,
                    contentType: contentType,
                });
                // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

                // httpモジュールを使って、サーバーにリクエストを送信する
                const tags = await new Promise((resolve, reject) => {
                    const request = http.request({
                        method: 'POST',
                        host: API_HOST,
                        port: API_PORT,
                        path: API_PATH,
                        headers: form.getHeaders(),
                    }, (response) => {
                        let responseData = '';
                        response.on('data', (chunk) => { responseData += chunk; });
                        response.on('end', () => {
                            try {
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
                    request.on('error', (err) => reject(err));
                    form.pipe(request);
                });

                // タグ付け処理
                if (tags && tags.length > 0) {
                    const newTags = [...new Set([...item.tags, ...tags])];
                    item.tags = newTags;
                    await item.save();
                    log(`[${item.name}] にタグ [${tags.join(', ')}] を追加したお！🎉`, 'success');
                } else {
                    log(`[${item.name}] は新しいタグがなかったよ`, 'warn');
                }
            } catch (err) {
                log(`[${item.name}] のタグ付けでエラー発生...🥺`, 'error');
                if (err.response && err.response.data) {
                    const errorDetails = JSON.stringify(err.response.data, null, 2);
                    log(`サーバーからのエラー詳細:\n${errorDetails}`, 'error');
                } else {
                    log(`その他エラー: ${err.message}`, 'error');
                }
            }
        }
        log('ぜんぶ終わったよ！おつかれ！💖', 'info');
    } catch (err) {
        log(`予期せぬ大エラーが発生しました: ${err.message}`, 'error');
    }
}

// ログをUIに表示するためのヘルパー関数
function log(message, level = 'info') {
    if (window.appendToLog) {
        window.appendToLog(message, level);
    }
}