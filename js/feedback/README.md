# 不具合報告の部品(js/feedback)

ゆる〜り日記・ひとつやね で共通に使う部品。ほかのアプリへは、このフォルダと `css/feedback.css` をコピーして使う。
アプリのほかのファイルには依存しない。

| ファイル | 中身 |
|---|---|
| `client.js` | `createFeedback(options)`:中継サーバーとのやりとり・匿名ID・送った報告の控え。`collectEnv()`:自動で付ける情報 |
| `form.js` | `renderFeedbackForm(el, feedback, { onSent, attachDraft })`:報告フォーム(attachDraft を渡すと書きかけが下書きとして残る) |
| `sent.js` | `renderSentReports(el, feedback, { newHref, onSeen })`:送った報告(状態・定型文の返信・1回だけの追記) |
| `../../css/feedback.css` | 見た目 |

## アプリごとに渡すもの(createFeedback の options)

```js
createFeedback({
  appId: 'yururi-diary',            // 中継サーバーの src/config.js の APPS に登録した ID
  appName: 'ゆる〜り日記',
  appVersion: '0.7.0',
  relayUrl: 'https://feedback-relay.xxxx.workers.dev',
  screens: ['ホーム', '気分', /* … */ 'その他'],   // 「起きた画面・機能」の選択肢
  storage: { get: (key) => …, set: (key, value) => … },  // 端末の中に保存する場所(バックアップに入れない場所がよい)
  anonIdKey: 'anonId',              // 匿名IDを保存するキー
  ui: { toast: (text) => …, confirm: ({ title, message, ok, cancel }) => Promise<boolean> },
});
```

ゆる〜り日記での使い方は `js/feedback-setup.js` と `js/screens/feedback.js` を参照。
