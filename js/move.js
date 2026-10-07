// 引っ越し(古いアドレス → 新しいアドレス)のデータの受け渡し。説明は docs/move.md
//
// 1. 古いアプリが、まず引っ越し用のバックアップファイルを保存する(うまくいかなくても、このファイルで移せる)
// 2. 古いアプリが window.open で新しいアプリを開く
// 3. 新しいアプリ → 古いアプリ:hello(届くまで少しずつくり返す)
// 4. 古いアプリ → 新しいアプリ:data(記録すべてと、持っていく端末ごとの情報)
// 5. 新しいアプリが読み込み、受け取った行が1つ残らず入ったか確かめて → 古いアプリ:done(件数)
// 6. 古いアプリが件数を見比べ、合っていれば meta.movedOut を書く(古いアプリの記録は消さない)
// どちらも、相手のアドレス(origin)と、開いた/開かれた窓であることを確かめてから受け取る。

import { OLD_ORIGIN, NEW_ORIGIN, STORAGE_PREFIX } from './config.js';
import { BACKUP_STORES, KEY_PATHS, getAll, getMeta, setMeta, withTx, count } from './db.js';
import { buildBackup, parseBackup, restoreBackup } from './backup.js';
import { nowIso } from './util.js';

const T = { hello: 'yururi-move:hello', data: 'yururi-move:data', done: 'yururi-move:done' };

// 端末ごとの情報(meta)のうち、引っ越しで持っていくもの。
// seedVersion・installedAt・importUndo・movedOut などは持っていかない。
const carries = (key) => ['anonId', 'lastBackupAt', 'lock', 'feedback'].includes(key) || key.startsWith('draft:');

async function carryMeta() {
  const rows = (await getAll('meta')).filter((r) => carries(r.key));
  // 指紋はアドレスごとの登録なので持っていけない(新しいアプリで登録し直す)。まちがいの回数も0から
  return rows.map((r) => (r.key === 'lock'
    ? { key: 'lock', value: { ...r.value, credentialId: null, failCount: 0, waitUntil: null } }
    : r));
}

export const countsOf = (backup) => Object.fromEntries(BACKUP_STORES.map((s) => [s, (backup.data[s] ?? []).length]));
const sameCounts = (a, b) => BACKUP_STORES.every((s) => a?.[s] === b?.[s]);

// ---- 古いアプリ ----

export const getMovedOut = () => getMeta('movedOut');

// 引っ越しの画面を出すか(古いアドレスで、引っ越しが始まっている/済んでいる/リハーサル中)
const REHEARSAL_KEY = `${STORAGE_PREFIX}move-rehearsal`;
const SKIP_KEY = `${STORAGE_PREFIX}move-skip`;
const session = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* 使えなければ何もしない */ } },
};

// 古いアドレスに「?move」を付けて開いたら、そのタブの中だけリハーサルとして引っ越しの画面を出す
export function noteRehearsal() {
  if (new URLSearchParams(location.search).has('move')) session.set(REHEARSAL_KEY, '1');
}
export const isRehearsal = () => session.get(REHEARSAL_KEY) === '1';
// 「今は引っ越さずに使う」を押したら、このタブを閉じるまで自動では出さない
export const skipMoveForNow = () => session.set(SKIP_KEY, '1');
export const isMoveSkipped = () => session.get(SKIP_KEY) === '1';

// 新しいアプリの窓 win に記録を渡す。win から hello が来るたびに渡す(新しいアプリが読み込み直しても大丈夫)。
// 戻り値は、待つのをやめる関数。
export function serveMove(win, { onSent, onDone, onFail }) {
  let sentCounts = null;
  const handler = async (e) => {
    if (e.origin !== NEW_ORIGIN || e.source !== win || !e.data) return;
    const m = e.data;
    try {
      if (m.type === T.hello) {
        const backup = await buildBackup();
        const meta = await carryMeta();
        sentCounts = countsOf(backup);
        const hadBio = !!(await getMeta('lock'))?.credentialId;
        win.postMessage({ type: T.data, backup, meta, hadBio }, NEW_ORIGIN);
        onSent?.();
      } else if (m.type === T.done) {
        if (!m.ok) return onFail?.(m.error || '新しいアプリで読み込めませんでした');
        if (!sentCounts || !sameCounts(sentCounts, m.counts)) return onFail?.('件数が合いませんでした');
        const movedOut = { at: nowIso(), to: NEW_ORIGIN, counts: m.counts, how: 'direct' };
        await setMeta('movedOut', movedOut);
        stop();
        onDone?.(movedOut);
      }
    } catch (err) {
      console.error(err);
      onFail?.('記録を渡せませんでした');
    }
  };
  const stop = () => window.removeEventListener('message', handler);
  window.addEventListener('message', handler);
  return stop;
}

// ファイルで移したとき(古いアプリには結果が届かない)に、本人が「移せた」と押したら記録する
export function markMovedByFile() {
  return setMeta('movedOut', { at: nowIso(), to: NEW_ORIGIN, counts: null, how: 'file' });
}

// ---- 新しいアプリ ----

export const getMovedIn = () => getMeta('movedIn');

// このアプリにまだ記録が1件もないか(初期データの選択肢などは数えない)
export async function hasNoRecords() {
  return (await count('records')) === 0 && (await count('consults')) === 0;
}

// 古いアプリから開かれていれば、hello を送りながら data を待つ。
// 届いたら onData(m)、古いアプリに返事をする関数 reply(result) も渡す。戻り値は、待つのをやめる関数。
export function waitForOldApp(onData) {
  const opener = window.opener;
  if (!opener) return null;
  let timer = null;
  let got = false;
  const handler = (e) => {
    if (e.origin !== OLD_ORIGIN || e.source !== opener || e.data?.type !== T.data || got) return;
    got = true;
    stop();
    const reply = (result) => { try { opener.postMessage({ type: T.done, ...result }, OLD_ORIGIN); } catch { /* 閉じられていれば何もしない */ } };
    onData(e.data, reply);
  };
  const stop = () => {
    clearInterval(timer);
    window.removeEventListener('message', handler);
  };
  window.addEventListener('message', handler);
  // 宛先を古いアドレスに限っているので、ほかのページには届かない
  const hello = () => { try { opener.postMessage({ type: T.hello }, OLD_ORIGIN); } catch { /* 開いた窓が閉じられた */ } };
  hello();
  timer = setInterval(hello, 700);
  return stop;
}

// 受け取った行がすべて、そのままの中身で入っているか(初期データが増えた分はあってよい)
async function verify(backup) {
  const now = await buildBackup();
  for (const store of BACKUP_STORES) {
    const key = KEY_PATHS[store];
    const have = new Map(now.data[store].map((r) => [String(r[key]), JSON.stringify(r)]));
    for (const row of backup.data[store] ?? []) {
      if (have.get(String(row[key])) !== JSON.stringify(row)) return false;
    }
  }
  return true;
}

// 古いアプリから直接受け取った記録を入れる。いまの記録は「読み込む前に戻す」用にとっておかれる。
export async function applyDirect(m) {
  const backup = parseBackup(JSON.stringify(m.backup));
  await restoreBackup(backup);
  const meta = (Array.isArray(m.meta) ? m.meta : []).filter((r) => r && typeof r.key === 'string' && carries(r.key));
  if (meta.length) {
    await withTx('meta', 'readwrite', (tx) => { for (const r of meta) tx.objectStore('meta').put(r); });
  }
  if (!(await verify(backup))) throw new Error('verify failed');
  const counts = countsOf(backup);
  await setMeta('movedIn', { at: nowIso(), from: OLD_ORIGIN, counts, how: 'direct', lock: !!meta.find((r) => r.key === 'lock')?.value?.enabled });
  return counts;
}

// ファイルから読み込んだ記録を入れる(ロックや下書きは、ファイルに入っていないので持ってこられない)
export async function applyFile(backup) {
  await restoreBackup(backup);
  if (!(await verify(backup))) throw new Error('verify failed');
  const counts = countsOf(backup);
  await setMeta('movedIn', { at: nowIso(), from: OLD_ORIGIN, counts, how: 'file', lock: false });
  return counts;
}
