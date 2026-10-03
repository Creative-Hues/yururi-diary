// 設定値(settings ストア)
// 初期値はここに書き、保存するのは本人が変えた値だけ。

import { getAll, put } from './db.js';

export const DEFAULT_SETTINGS = {
  vitalsPerDay: 3, // バイタルの1日の測定回数
};

export const VITALS_PER_DAY_MIN = 1;
export const VITALS_PER_DAY_MAX = 6;

export async function getSettings() {
  const rows = await getAll('settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s;
}

export function setSetting(key, value) {
  return put('settings', { key, value });
}
