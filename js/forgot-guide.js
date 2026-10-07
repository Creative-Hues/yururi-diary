// 「パスコードを忘れたら」の案内(Pixel・Chrome 向け)
// 本人が一人で読んで分かるよう、やさしい言葉で、怖がらせない書き方にする。
// onLock: true … ロック画面の中(すぐ下に「このアプリのデータを消す」ボタンがある)
//         false … ヘルプの中(ロック画面からたどる道すじを書く)
// ロック画面では、data-last-backup の中に最後のバックアップの日時が入る(js/lock-screen.js)。

export function forgotGuideHtml({ onLock }) {
  const wipeStep = onLock
    ? '<p>この画面のいちばん下の「このアプリのデータを消す」を押します。</p>'
    : '<p>ロック画面の「パスコードを忘れたら」を押して、いちばん下の「このアプリのデータを消す」を押します。</p>';
  return `
  <div class="forgot">
    <h2 class="forgot-title">パスコードを忘れたら</h2>
    <p>だいじょうぶです。<strong>バックアップのファイルがあれば、記録はもとに戻せます。</strong></p>
    <p>やることは「ゆる〜り日記のデータをいったん空にして、バックアップを読み込む」ことです。空にすると、アプリの中の記録はいったん全部なくなりますが、バックアップのファイルの中には残っているので、読み込めば戻ります。</p>

    <div class="forgot-box">
      <p class="forgot-step-head">はじめに、たしかめること</p>
      <p>スマホの「Files(ファイル)」アプリの「ダウンロード」(Googleドライブに保存していれば、ドライブ)に、<span class="nowrap">「yururi-diary-backup-…」</span>という名前のファイルがあるか見てください。日付がいちばん新しいものを使います。</p>
      ${onLock ? '<p class="forgot-last" data-last-backup hidden></p>' : ''}
    </div>

    <ol class="forgot-steps">
      <li>
        <p class="forgot-step-head">データを空にする</p>
        ${wipeStep}
        <p>確認が2回出ます。2回目に「けす」と入力して「すべて消す」を押すと、ゆる〜り日記のデータだけが消えます。ほかのアプリのデータは消えません。</p>
      </li>
      <li>
        <p class="forgot-step-head">アプリが開きなおします</p>
        <p>ロックはかかっていない状態で開きます。</p>
      </li>
      <li>
        <p class="forgot-step-head">バックアップを読み込む</p>
        <p>右上の「設定」→「バックアップ」→「ファイルを選んで読み込む」→ さっきたしかめたファイルを選びます。</p>
        <p class="small muted">※ Googleドライブのファイルは、選ぶ画面の左上の「≡」→「ドライブ」から選べます。</p>
      </li>
      <li>
        <p class="forgot-step-head">記録が戻ります</p>
        <p>ロックはオフになっているので、使いたいときは「設定」→「ロック」から、新しいパスコードでもう一度オンにしてください。</p>
      </li>
    </ol>

    <div class="forgot-box">
      <p class="forgot-step-head">バックアップのファイルがないときは</p>
      <p>データを空にすると、記録は戻せなくなります。あわてなくて大丈夫です。パスコードは、待てば何度でも入力しなおせます。ゆっくり思い出してみてください。</p>
    </div>
  </div>`;
}
