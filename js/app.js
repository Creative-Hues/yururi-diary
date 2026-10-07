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
import { noteRehearsal, isRehearsal, isMoveSkipped, getMovedOut } from './move.js';
import { uuid, nowIso } from './util.js';

// 初回起動時に、端末ごとの情報を作る
async function ensureMeta() {
  if (!(await getMeta('anonId'))) await setMeta('anonId', uuid());
  if (!(await getMeta('installedAt'))) await setMeta('installedAt', nowIso());
}

// 古いアドレスで、引っ越しが始まっている(または済んでいる・リハーサル中)なら、ホームの代わりに引っ越しの画面で開く
// (ホームはその下に敷かれるので、「もどる」でホームに行ける)
async function openMoveIfNeeded() {
  if (SITE !== 'old') return;
  noteRehearsal();
  if (isMoveSkipped() || !['', '#', '#/'].includes(location.hash)) return;
  if (MOVE_OPEN || isRehearsal() || (await getMovedOut().catch(() => null))) history.replaceState(null, '', '#/move');
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
  await openMoveIfNeeded();
  startRouter();
  if (takeWipedFlag()) toast('このアプリのデータを消しました');
  checkFeedbackReplies().catch(() => {});
}

boot();
