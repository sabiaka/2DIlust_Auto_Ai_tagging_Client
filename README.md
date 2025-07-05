# 2Dillust Auto AI Tagger

Eagle用の2次元イラスト専用のAI自動タグ付け拡張機能です。選択した画像に対してAIを使用して自動的にタグを生成します。
使用するには[2DIlust_Auto_Ai_tagging_APIServer](https://github.com/sabiaka/2DIlust_Auto_Ai_tagging_APIServer)が必要です。

## 機能

- Eagleで選択した画像に対してAIタグ付けを実行
- リアルタイムログ表示
- シンプルで使いやすいインターフェース

## インストール方法

### 1. 依存関係のインストール

プロジェクトディレクトリで以下のコマンドを実行してください：

```bash
npm install
```

### 2. Eagleへの拡張機能追加

1. Eagleを開く
2. メニューから「プラグイン」→「開発者オプション」→「ローカルプロジェクトをインポート」を選択
3. このプロジェクトのディレクトリを指定
4. 拡張機能が正常に読み込まれることを確認

## 使用方法
1. [サーバ側](https://github.com/sabiaka/2DIlust_Auto_Ai_tagging_APIServer)のセットアップを済ませます。
1. [P]キーを押し、`2Dilust Auto Ai tagger`を選択 (開発のタブにあると思います)
1. Eagleで画像を選択
2. 拡張機能パネルで「選択した画像にAIタグ付けを実行」ボタンをクリック
3. 処理の進行状況がログに表示されます
4. 完了後、自動的にタグが画像に追加されます

## ファイル構成

```
2Dillust Auto Ai tagger/
├── index.html          # メインUI
├── main.js            # 拡張機能のエントリーポイント
├── js/
│   └── plugin.js      # プラグインロジック
├── manifest.json      # 拡張機能の設定
├── package.json       # 依存関係管理
└── logo.png          # 拡張機能アイコン
```

## 依存関係

- `form-data`: ^4.0.3

## 技術仕様

- **プラットフォーム**: 全対応
- **アーキテクチャ**: 全対応
- **ウィンドウサイズ**: 640x480
- **開発者ツール**: 無効

## トラブルシューティング

### 拡張機能が読み込まれない場合

1. `npm install`が正常に完了しているか確認
2. ディレクトリパスが正しく指定されているか確認
3. Eagleを再起動してから再度試行

### `connect ECONNREFUSED 127.0.0.1:8000`と出る場合。

1. [ローカルサーバ](https://github.com/sabiaka/2DIlust_Auto_Ai_tagging_APIServer)が正しくセットアップできていることを確認。


## バージョン

現在のバージョン: 1.0.0

---

この拡張機能を使用することで、Eagleでの画像管理がより効率的になります。 