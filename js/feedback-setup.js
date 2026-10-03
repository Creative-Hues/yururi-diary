// 不具合報告の部品(js/feedback)を、ゆる〜り日記用の設定で使えるようにする

import { createFeedback } from './feedback/client.js';
import { APP_ID, APP_NAME, APP_VERSION, FEATURES, FEEDBACK_RELAY_URL } from './config.js';
import { getMeta, setMeta } from './db.js';
import { toast, confirmDialog } from './ui.js';

// 「起きた画面・機能」の選択肢(アプリごとに違う部分)
export const FEEDBACK_SCREENS = [
  'ホーム', '気分', '体調', '食事', '服薬', 'バイタル',
  '一日の日記', 'ひとこと日記', 'ランダム見返し・お気に入り', '信号機',
  '相談したいことメモ', '落ち着くことリスト', '整理シート',
  'カレンダー・日付ごとの一覧', '相談用の表示・PDF',
  'ロック', 'バックアップ', '設定', 'その他',
];

export const feedback = createFeedback({
  appId: APP_ID,
  appName: APP_NAME,
  appVersion: APP_VERSION,
  relayUrl: FEEDBACK_RELAY_URL,
  screens: FEEDBACK_SCREENS,
  storage: { get: getMeta, set: setMeta }, // meta はバックアップに入らない(匿名IDは端末ごと)
  anonIdKey: 'anonId',
  ui: { toast, confirm: confirmDialog },
});

export const feedbackEnabled = () => FEATURES.feedback && !!FEEDBACK_RELAY_URL;

// まだ見ていない返信があれば、ホームの設定ボタンに印を付ける
export async function refreshFeedbackBadge() {
  const n = feedbackEnabled() ? await feedback.unseenCount() : 0;
  document.getElementById('hdr-settings')?.classList.toggle('has-badge', n > 0);
  return n;
}

// 起動時などに返信を確かめる(30分に1回まで)
export async function checkFeedbackReplies() {
  if (!feedbackEnabled() || !(await feedback.hasSent())) return;
  const last = await feedback.lastFetchedAt();
  if (!last || Date.now() - new Date(last).getTime() > 30 * 60 * 1000) await feedback.list();
  await refreshFeedbackBadge();
}
