// 起動処理

import { APP_VERSION } from './config.js';
import { openDB, getMeta, setMeta } from './db.js';
import { runSeeds } from './seed.js';
import { startRouter, goBack } from './router.js';
import { registerSW, applyUpdate, requestPersist } from './pwa.js';
import { requireUnlock, watchAway } from './lock-screen.js';
import { checkFeedbackReplies } from './feedback-setup.js';
import { showFatal, showUpdateBar } from './ui.js';
import { uuid, nowIso } from './util.js';

// 初回起動時に、端末ごとの情報を作る
async function ensureMeta() {
  if (!(await getMeta('anonId'))) await setMeta('anonId', uuid());
  if (!(await getMeta('installedAt'))) await setMeta('installedAt', nowIso());
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
  startRouter();
  checkFeedbackReplies().catch(() => {});
}

boot();
