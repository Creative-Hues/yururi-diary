// 画面の一覧
// phase があるものは、まだ中身のない「準備中」の画面。作るときに render を付ける。
// children があるものは、ボタンが並ぶだけのメニュー画面。

import { renderHome } from './screens/home.js';
import { renderSettings } from './screens/settings.js';
import { renderBackup } from './screens/backup.js';
import { renderMood } from './screens/mood.js';
import { renderCondition } from './screens/condition.js';
import { renderMeal, renderMealNew, renderMealEdit } from './screens/meal.js';
import { renderMedicine } from './screens/medicine.js';
import { renderVital, renderVitalNew, renderVitalEdit } from './screens/vital.js';
import { renderEditCondition, renderEditMedicine, renderEditDiary, renderCalm } from './screens/edit-choices.js';
import {
  renderDiaryDay, renderDiaryDayNew, renderDiaryDayEdit,
  renderHitokoto, renderHitokotoNew, renderHitokotoEdit,
  renderRandom, renderFavorites,
} from './screens/diary.js';
import { renderSignal, renderSignalEdit } from './screens/signal.js';
import { renderConsult, renderConsultNew, renderConsultEdit } from './screens/consult.js';
import { renderWorksheet, renderWorksheetNew, renderWorksheetEdit } from './screens/worksheet.js';
import { renderCalendar } from './screens/calendar.js';
import { renderDay } from './screens/day.js';
import { renderReport } from './screens/report.js';
import { renderLockSettings } from './screens/lock.js';

export const ROUTES = {
  '': { title: 'ホーム', render: renderHome },

  // フェーズ2:毎日の記録
  mood: { title: '気分', icon: '😊', render: renderMood },
  condition: { title: '体調', icon: '🍀', render: renderCondition },
  meal: { title: '食事', icon: '🍙', render: renderMeal },
  'meal-new': { title: '食事を記録', render: renderMealNew },
  'meal-edit': { title: '食事を直す', render: renderMealEdit },
  medicine: { title: '服薬', icon: '💊', render: renderMedicine },
  vital: { title: 'バイタル', icon: '🌡️', render: renderVital },
  'vital-new': { title: 'バイタルを記録', render: renderVitalNew },
  'vital-edit': { title: 'バイタルを直す', render: renderVitalEdit },

  // フェーズ3:日記と気持ちの整理
  diary: {
    title: '日記', icon: '📔',
    children: ['diary-day', 'diary-hitokoto', 'diary-random', 'diary-favorites'],
  },
  'diary-day': { title: '一日の日記', icon: '📝', render: renderDiaryDay },
  'diary-day-new': { title: '一日の日記を書く', render: renderDiaryDayNew },
  'diary-day-edit': { title: '一日の日記を直す', render: renderDiaryDayEdit },
  'diary-hitokoto': { title: 'ひとこと日記', icon: '🌱', render: renderHitokoto },
  'diary-hitokoto-new': { title: 'ひとこと日記を書く', render: renderHitokotoNew },
  'diary-hitokoto-edit': { title: 'ひとこと日記を直す', render: renderHitokotoEdit },
  'diary-random': { title: 'ランダム見返し', icon: '🎲', render: renderRandom },
  'diary-favorites': { title: 'お気に入り', icon: '⭐', render: renderFavorites },
  signal: { title: '信号機', icon: '🚦', render: renderSignal },
  'signal-edit': { title: '信号機を書きかえる', render: renderSignalEdit },
  feelings: {
    title: '気持ちの整理', icon: '🌷',
    children: ['consult', 'calm', 'worksheet'],
  },
  consult: { title: '相談したいことメモ', icon: '🗒️', render: renderConsult },
  'consult-new': { title: '相談したいことを書く', render: renderConsultNew },
  'consult-edit': { title: '相談したいことを直す', render: renderConsultEdit },
  calm: { title: '落ち着くことリスト', icon: '☕', render: renderCalm },
  worksheet: { title: '整理シート', icon: '🧺', render: renderWorksheet },
  'worksheet-new': { title: '整理シートを書く', render: renderWorksheetNew },
  'worksheet-edit': { title: '整理シートを直す', render: renderWorksheetEdit },

  // フェーズ4:見返し
  calendar: { title: 'カレンダー', icon: '📅', render: renderCalendar },
  day: { title: 'この日の記録', render: renderDay },
  report: { title: '相談用の表示', icon: '📋', render: renderReport },

  // 設定まわり
  settings: { title: '設定', render: renderSettings },
  backup: { title: 'バックアップ', render: renderBackup },
  'edit-condition': { title: '体調の選択肢', icon: '🍀', render: renderEditCondition },
  'edit-medicine': { title: '薬の登録', icon: '💊', render: renderEditMedicine },
  'edit-diary': { title: '日記のお題・書き出し', icon: '📔', render: renderEditDiary },
  lock: { title: 'ロック', icon: '🔒', render: renderLockSettings },
  feedback: { title: '不具合報告・要望', icon: '✉️', phase: 6 },
};
