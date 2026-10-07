// 設定 →「このアプリのデータを消す」

import { getMeta } from '../db.js';
import { href } from '../router.js';
import { toast } from '../ui.js';
import { confirmWipe, wipeAndRestart, lastBackupText } from '../wipe.js';
import { esc, daysSince } from '../util.js';

export async function renderWipe(el, params, isStale) {
  const last = await getMeta('lastBackupAt');
  if (isStale()) return;
  const today = !!last && daysSince(last) === 0;

  el.innerHTML = `
    <div class="card">
      <p>ゆる〜り日記の<strong>記録・設定・選択肢・下書き・ロック</strong>を、すべて消して、はじめて使うときの状態にもどします。</p>
      <p>消すのは、このアプリのデータだけです。ほかのアプリやサイトのデータは消えません。</p>
    </div>

    <section class="group">
      <h2 class="section-title">先にバックアップを</h2>
      <div class="card">
        <p class="muted small">最後のバックアップ</p>
        <p class="big-text">${esc(lastBackupText(last))}</p>
        ${today ? '' : '<p class="wipe-warn">今日の記録は、まだバックアップに入っていません。消す前にバックアップを取っておくと安心です。</p>'}
        <a class="btn btn-primary btn-block mt" href="${href('backup')}">先にバックアップを取る</a>
      </div>
    </section>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost-danger btn-block" id="wipe-btn">データを消す</button>
    </div>
    <p class="hint">消したあとは、アプリが自動で開きなおします。記録を戻すときは、設定 →「バックアップ」→「ファイルを選んで読み込む」です。</p>
  `;

  el.querySelector('#wipe-btn').addEventListener('click', async () => {
    if (!(await confirmWipe({ lastBackupAt: last }))) return;
    try {
      await wipeAndRestart();
    } catch (e) {
      console.error(e);
      toast(e.message?.startsWith('ほかの画面') ? 'ほかの画面で開いているアプリを閉じてから、もう一度ためしてください' : '消せませんでした');
      setTimeout(() => location.reload(), 2500);
    }
  });
}
