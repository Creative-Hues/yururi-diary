// 「このアプリのデータを消す」
// Chrome の「サイトのデータを消す」は、同じアドレスのほかのアプリのデータまで消してしまう。
// ここでは、ゆる〜り日記のデータ(IndexedDB の yururi-diary と、yururi-diary: で始まる保存)だけを消す。
// アプリのファイルのキャッシュ(Service Worker)は残すので、消したあともオフラインで開ける。
// 設定の画面と、ロック画面の「パスコードを忘れたら」の両方から使う(ロック画面からは「けす」の入力も求める)。

import { DB_NAME, STORAGE_PREFIX } from './config.js';
import { closeDBForGood } from './db.js';
import { confirmDialog, openDialog } from './ui.js';
import { esc, formatDateTimeJa, daysSince } from './util.js';

const WIPED_FLAG = `${STORAGE_PREFIX}wiped`;
export const WIPE_WORD = 'けす';

export function lastBackupText(lastBackupAt) {
  if (!lastBackupAt) return 'まだ取っていません';
  const n = daysSince(lastBackupAt);
  return `${formatDateTimeJa(new Date(lastBackupAt))}(${n === 0 ? '今日' : `${n}日前`})`;
}

// 確認を2回出す。typed: true なら、2回目で「けす」と入力してもらう(ロック画面から使うとき)
export async function confirmWipe({ lastBackupAt, typed = false }) {
  const first = await confirmDialog({
    title: 'データを消しますか?',
    message: `ゆる〜り日記の記録・設定・選択肢・下書き・ロックが、すべて消えます。\n\n最後のバックアップ:${lastBackupText(lastBackupAt)}\nそれより後の記録は、もとに戻せません。\n\nほかのアプリやサイトのデータは消えません。`,
    ok: '消す',
    danger: true,
  });
  if (!first) return false;

  if (!typed) {
    return confirmDialog({
      title: '最後の確認です',
      message: '消したデータは、バックアップのファイルからしか戻せません。\nほんとうに、すべて消しますか?',
      ok: 'すべて消す',
      cancel: 'やめる',
      danger: true,
    });
  }

  const { value } = await openDialog({
    title: '最後の確認です',
    body: `
      <p>消したデータは、バックアップのファイルからしか戻せません。</p>
      <p>ほんとうに消すときは、下に「${esc(WIPE_WORD)}」と入力してください。</p>
      <input type="text" class="input" id="wipe-word" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="「${esc(WIPE_WORD)}」と入力">`,
    buttons: [{ label: 'やめる' }, { label: 'すべて消す', value: 'ok', cls: 'btn-danger' }],
    validate: (v, dlg) => (dlg.querySelector('#wipe-word').value.trim() === WIPE_WORD ? null : `「${WIPE_WORD}」と入力してください`),
  });
  return value === 'ok';
}

function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    // ほかのタブで開いていると blocked になるが、そちらは onversionchange で閉じるので、そのまま待つ
    const timer = setTimeout(() => reject(new Error('ほかの画面でアプリが開いたままです')), 10000);
    req.onsuccess = () => { clearTimeout(timer); resolve(); };
    req.onerror = () => { clearTimeout(timer); reject(req.error); };
  });
}

// データを消して、アプリを開き直す
export async function wipeAndRestart() {
  await closeDBForGood();
  await deleteDatabase(DB_NAME);
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
  } catch { /* 使えない環境では何もしない */ }
  try { sessionStorage.setItem(WIPED_FLAG, '1'); } catch { /* 知らせが出ないだけ */ }
  location.replace(location.pathname + location.search);
}

// 開き直したあとに「消しました」と知らせるか(1回だけ)
export function takeWipedFlag() {
  try {
    const v = sessionStorage.getItem(WIPED_FLAG);
    sessionStorage.removeItem(WIPED_FLAG);
    return v === '1';
  } catch {
    return false;
  }
}
