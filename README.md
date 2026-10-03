# ゆる〜り日記🥰

体調・気分・服薬などを記録する PWA。データ構造は [docs/data-model.md](docs/data-model.md)。

フレームワークなしの HTML / CSS / JavaScript(ES modules)。ビルド不要で、GitHub Pages にそのまま置けば動く。

## ファイル構成

```
index.html             画面の外枠
manifest.webmanifest   PWA の情報(名前・アイコン・色)
sw.js                  Service Worker(オフライン用キャッシュ)
css/style.css          デザイン
js/version.js          ★ アプリのバージョン
js/config.js           設定値・機能スイッチ
js/app.js              起動処理
js/router.js           画面の切り替え(#/settings など)
js/routes.js           画面の一覧(準備中の画面もここ)
js/db.js               IndexedDB
js/seed.js             初期データ
js/prefs.js            設定値の読み書き
js/backup.js           バックアップの書き出し・読み込み
js/pwa.js              Service Worker 登録・更新・ホーム画面に追加
js/ui.js               ヘッダー・トースト・確認ダイアログ
js/screens/*.js        各画面
icons/                 アイコン(tools/make-icons.mjs で作成)
```

## 公開するとき

1. `js/version.js` の `APP_VERSION` を上げる(上げないと端末に新しい版が届かない)
2. ファイルを増やしたら `sw.js` の `ASSETS` に追加する
3. push する

## 手元で動かす

`file://` では動かないので、簡単なサーバーを使う。

```
npx --yes http-server -c-1 .
```

開発中は Chrome DevTools → Application → Service workers →「Update on reload」にチェックを入れると、毎回最新のファイルが読み込まれる。
