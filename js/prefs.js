// 設定値(settings ストア)
// 初期値はここに書き、保存するのは本人が変えた値だけ。

import { getAll, put } from './db.js';
import { MOODS, LEVEL_MIN, LEVEL_MAX } from './constants.js';

export const DEFAULT_SETTINGS = {
  vitalsPerDay: 3, // バイタルの1日の測定回数
  // 最後のバックアップからこの日数がたったら、ホームの「バックアップ」を黄色にして知らせる(BACKUP_REMIND_OPTIONS から選ぶ)
  backupRemindDays: 1,
  // 気分の絵文字(カレンダー・気分のボタンなど)。{ level: 絵文字 } で、変えた段階だけ入る
  moodEmojis: {},
  // 整理シートのつらさ 0〜10 の名前(11個)。空欄の段階は数字だけ出す
  levelNames: Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, i) => (
    i === LEVEL_MIN ? 'つらくない' : i === LEVEL_MAX ? 'とてもつらい' : ''
  )),
};

export const VITALS_PER_DAY_MIN = 1;
export const VITALS_PER_DAY_MAX = 6;

// バックアップのお知らせまでの日数の選択肢
export const BACKUP_REMIND_OPTIONS = [1, 3, 7, 14, 30];

export async function getSettings() {
  const rows = await getAll('settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s;
}

export function setSetting(key, value) {
  return put('settings', { key, value });
}

// 気分の絵文字(本人が変えていなければ初期の絵文字)
export function moodEmoji(settings, level) {
  return settings.moodEmojis?.[level] || MOODS.find((m) => m.level === level)?.emoji || '';
}

// 整理シートのつらさの名前(空欄なら '')
export const levelName = (settings, level) => settings.levelNames?.[level] ?? '';
