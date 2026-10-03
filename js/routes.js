// 画面の一覧
// phase があるものは、まだ中身のない「準備中」の画面。作るときに render を付ける。
// children があるものは、ボタンが並ぶだけのメニュー画面。

import { renderHome } from './screens/home.js';
import { renderSettings } from './screens/settings.js';
import { renderBackup } from './screens/backup.js';
import { renderMood } from './screens/mood.js';
import { renderCondition } from './screens/condition.js';
import { renderMeal } from './screens/meal.js';
import { renderMedicine } from './screens/medicine.js';
import { renderVital } from './screens/vital.js';
import { renderEditCondition, renderEditMedicine } from './screens/edit-choices.js';

export const ROUTES = {
  '': { title: 'ホーム', render: renderHome },

  // フェーズ2:毎日の記録
  mood: { title: '気分', icon: '😊', render: renderMood },
  condition: { title: '体調', icon: '🍀', render: renderCondition },
  meal: { title: '食事', icon: '🍙', render: renderMeal },
  medicine: { title: '服薬', icon: '💊', render: renderMedicine },
  vital: { title: 'バイタル', icon: '🌡️', render: renderVital },

  // フェーズ3:日記と気持ちの整理
  diary: {
    title: '日記', icon: '📔',
    children: ['diary-day', 'diary-hitokoto', 'diary-random', 'diary-favorites'],
  },
  'diary-day': { title: '一日の日記', icon: '📝', phase: 3 },
  'diary-hitokoto': { title: 'ひとこと日記', icon: '🌱', phase: 3 },
  'diary-random': { title: 'ランダム見返し', icon: '🎲', phase: 3 },
  'diary-favorites': { title: 'お気に入り', icon: '⭐', phase: 3 },
  signal: { title: '信号機', icon: '🚦', phase: 3 },
  feelings: {
    title: '気持ちの整理', icon: '🌷',
    children: ['consult', 'calm', 'worksheet'],
  },
  consult: { title: '相談したいことメモ', icon: '🗒️', phase: 3 },
  calm: { title: '落ち着くことリスト', icon: '☕', phase: 3 },
  worksheet: { title: '整理シート', icon: '🧺', phase: 3 },

  // フェーズ4:見返し
  calendar: { title: 'カレンダー', icon: '📅', phase: 4 },
  report: { title: '相談用の表示', icon: '📋', phase: 4 },

  // 設定まわり
  settings: { title: '設定', render: renderSettings },
  backup: { title: 'バックアップ', render: renderBackup },
  'edit-condition': { title: '体調の選択肢', icon: '🍀', render: renderEditCondition },
  'edit-medicine': { title: '薬の登録', icon: '💊', render: renderEditMedicine },
  'edit-diary': { title: '日記のお題・書き出し', icon: '📔', phase: 3 },
  lock: { title: 'ロック', icon: '🔒', phase: 5 },
  feedback: { title: '不具合報告・要望', icon: '✉️', phase: 6 },
};
