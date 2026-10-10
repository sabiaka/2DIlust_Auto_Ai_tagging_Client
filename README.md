# 2DIlust_Auto_Ai_tagging_Client

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
1. [P]キーを押し、`2DIlust_Auto_Ai_tagging_Client`を選択 (開発のタブにあると思います)
1. Eagleで画像を選択
2. 拡張機能パネルで「選択した画像にAIタグ付けを実行」ボタンをクリック
3. 処理の進行状況がログに表示されます
4. 完了後、自動的にタグが画像に追加されます

## ファイル構成

```
2DIlust_Auto_Ai_tagging_Client/
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
## 接続先の設定

プラグイン上部の「接続設定」から、APIサーバーのIPアドレス（またはホスト名）とポート番号を変更できます。
初期値は `127.0.0.1:8000` です。「保存」で設定を保存し、プラグインを再度開いても保持します。
実行中のタグ付けは開始時の接続先を使い、変更した設定は次回の実行から使います。

別のPCへ接続する場合は、そのPCでAPIがLAN向けに待ち受けている必要があります。
APIサーバーのリポジトリにある `Start-Server-LAN.bat` で起動すると、LANからの接続を受け付けます。

Colab対応版（`feature/colab-api`）ではHTTPS URLとAPIトークンにも対応します。
ノートブックに表示されるURLとトークンを「接続設定」に貼り付けて保存してください。
URL指定時のポートはURL内の指定を使い、HTTPSで省略した場合は443になります。
トークンはプラグインのローカル保存領域に保存され、接続先表示やログには出しません。
LAN用のIP・ポート設定は継続利用できます。

設定の検証: `node tests/connection-settings.test.cjs`
リクエストの検証: `node tests/client-request.test.cjs`

### Colab自動接続（Windows）

プラグインのルートに `colab-auto.json` を配置すると、接続設定の「Colabの起動と接続先更新を自動で行う」が有効になります。
このPCでは設定済みです。タグ付けボタンを押すと、CLIで専用セッションを確認し、停止していればT4を起動してURLとトークンを自動保存します。
無操作時の定期再起動は行いません。認証期限切れやGPU割り当て失敗の場合はエラー表示して停止します。
LAN接続へ戻すときは自動接続をオフにしてください。終了時は `Stop-Colab-API.bat` で停止します。

設定ファイルは次の2つの絶対パスを指定します。機器固有の設定なのでGitには含めません。

```json
{"helper":"C:/path/to/outputs/ensure-colab-api.ps1","connectionFile":"C:/path/to/outputs/Colab-connection.json"}
```

Windowsに認証済みのColab CLIと、本作業で作成したoutputs一式が必要です。プラグイン単体でCLIの導入やGoogle認証を行うものではありません。

自動更新の検証: `node tests/colab-manager.test.cjs`
