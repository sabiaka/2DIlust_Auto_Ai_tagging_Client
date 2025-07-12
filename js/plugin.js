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
    try {
        const items = await eagle.item.getSelected();
        if (items.length === 0) {
            log('画像・動画をせんたーく！してね！', 'warn');
            return;
        }
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
                const ext = item.ext.toLowerCase();
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
                    const request = http.request({
                        method: 'POST',
                        host: API_HOST,
                        port: API_PORT,
                        path: API_PATH,
                        headers: form.getHeaders(),
                        timeout: timeout, // タイムアウト設定
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
                    
                    // タイムアウト処理
                    request.on('timeout', () => {
                        request.destroy();
                        reject(new Error(`タイムアウト: ${isVideo ? '動画ファイルの処理に時間がかかりすぎました' : '画像ファイルの処理に時間がかかりすぎました'} (${timeout/1000}秒)`));
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
                const isVideo = ['mp4', 'mov', 'avi', 'wmv', 'mpeg', 'mpg'].includes(ext);
                if (isVideo) {
                    log(`[${item.name}] のタグ付けでエラー発生...🥺 (動画ファイル)`, 'error', item.filePath);
                } else {
                    log(`[${item.name}] のタグ付けでエラー発生...🥺`, 'error', item.filePath);
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
        log(`予期せぬ大エラーが発生しました: ${err.message}`, 'error');
    }
    isTagging = false;
    updateTagButton(false);
    cancelTagging = false;
}

// ログをUIに表示するためのヘルパー関数
function log(message, level = 'info', imagePath = null) {
    if (window.appendToLog) {
        window.appendToLog(message, level, imagePath);
    }
}