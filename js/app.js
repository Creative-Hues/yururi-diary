// 起動処理

import './no-zoom.js';
import { APP_VERSION, SITE, MOVE_OPEN } from './config.js';
import { openDB, getMeta, setMeta } from './db.js';
import { runSeeds } from './seed.js';
import { startRouter, goBack } from './router.js';
import { registerSW, applyUpdate, requestPersist } from './pwa.js';
import { requireUnlock, watchAway } from './lock-screen.js';
import { checkFeedbackReplies } from './feedback-setup.js';
import { showFatal, showUpdateBar, toast } from './ui.js';
import { takeWipedFlag } from './wipe.js';
import { noteRehearsal, isRehearsal, isMoveSkipped, getMovedOut, noteDevOld, isDevOld } from './move.js';
import { enterMovedMode } from './screens/move.js';
import { uuid, nowIso } from './util.js';

// 初回起動時に、端末ごとの情報を作る
async function ensureMeta() {
  if (!(await getMeta('anonId'))) await setMeta('anonId', uuid());
  if (!(await getMeta('installedAt'))) await setMeta('installedAt', nowIso());
}

// 古いアドレスで、引っ越しが済んでいれば、記録できない案内だけの画面にする(true を返す)。
// 開発者用の ?old-dev のタブでは、これまでどおり使える(docs/move.md)。
async function openMovedIfNeeded() {
  if (SITE !== 'old') return false;
  noteRehearsal();
  noteDevOld();
  if (isDevOld()) return false;
  // 別のタブ・窓で引っ越しが済んだときも、戻ってきたら案内の画面にする
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && (await getMovedOut().catch(() => null))) enterMovedMode();
  });
  if (!(await getMovedOut().catch(() => null))) return false;
  await enterMovedMode();
  return true;
}

// 古いアドレスで、引っ越しが始まっている(またはリハーサル中)なら、ホームの代わりに引っ越しの画面で開く
// (ホームはその下に敷かれるので、「もどる」でホームに行ける)
function openMoveIfNeeded() {
  if (SITE !== 'old' || isMoveSkipped() || !['', '#', '#/'].includes(location.hash)) return;
  if (MOVE_OPEN || isRehearsal() || isDevOld()) history.replaceState(null, '', '#/move');
}

async function boot() {
  console.info(`ゆる〜り日記 ${APP_VERSION}`);
  document.getElementById('hdr-back').addEventListener('click', goBack);

  try {
    await openDB();
    await ensureMeta();
    await runSeeds();
  } catch (e) {
    console.error(e);
    showFatal('データの保存場所を開けませんでした。プライベートモードでは使えないことがあります。');
    return;
  }

  registerSW((reg) => showUpdateBar(() => applyUpdate(reg)));
  requestPersist().catch(() => {});
  // ロックがオンなら、開けるまで画面を出さない
  await requireUnlock();
  watchAway();
  if (await openMovedIfNeeded()) return;
  openMoveIfNeeded();
  startRouter();
  if (takeWipedFlag()) toast('このアプリのデータを消しました');
  checkFeedbackReplies().catch(() => {});
}

boot();
