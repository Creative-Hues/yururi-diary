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
js/backup.js           バックアップの書き出し・読み込み・読み込む前に戻す
js/wipe.js             このアプリのデータだけを消す(設定とロック画面の「パスコードを忘れたら」から使う)
js/pwa.js              Service Worker 登録・更新・ホーム画面に追加
js/ui.js               ヘッダー・トースト・確認ダイアログ
js/periods.js          体調の記録から、お通じの日・生理の期間を求める
js/month-calendar.js   月のカレンダーのマス(カレンダー・相談用の表示で共通)
js/charts.js           1週間分の折れ線グラフ(SVG)と、グラフの中だけの拡大・点のタップで数値の表示
js/components.js       記録の画面で共通の部品(「✎ 選択肢を編集」のボタン editLinkHtml もここ)
js/screens/help.js     使い方(ヘルプ)。ホームの左上の「?」から開く。画面の名前やボタンの文字を変えたら、ここも直す
js/screens/*.js        各画面
icons/                 アイコン(tools/make-icons.mjs で作成)
```

## 公開するとき

1. `js/version.js` の `APP_VERSION` を上げる(上げないと端末に新しい版が届かない)
2. ファイルを増やしたら `sw.js` の `ASSETS` に追加する
3. 画面やボタンの名前を変えたら、ヘルプ(`js/screens/help.js`)の説明も直す
4. push する

## すでに入っている記録を守る

本人はもう使っていて、端末に本物の記録が入っている。

- 記録・設定・選択肢・下書きが消えたり、表示が崩れたりする変更はしない。
- データの形(IndexedDB のストア・インデックス、records の data の中身、choices・settings・meta の形)を変えるときは、
  作業の前に相談し、古いデータを新しい形に移す処理を必ず入れる(手順は [docs/data-model.md](docs/data-model.md) の「構造を変えるとき」)。
- 見た目だけの変更でも、古い記録(項目が欠けている記録、消した選択肢の名前が残っている記録など)で表示を確かめる。

## 手元で動かす

`file://` では動かないので、簡単なサーバーを使う。

```
npx --yes http-server -c-1 .
```

開発中は Chrome DevTools → Application → Service workers →「Update on reload」にチェックを入れると、毎回最新のファイルが読み込まれる。
