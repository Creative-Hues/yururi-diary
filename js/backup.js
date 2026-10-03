// バックアップ(JSONファイルへの書き出し・読み込み)

import { APP_ID, APP_VERSION, BACKUP_FORMAT } from './config.js';
import { BACKUP_STORES, DB_VERSION, KEY_PATHS, withTx, getMeta, setMeta } from './db.js';
import { runSeeds } from './seed.js';
import { dateKey, pad2, nowIso } from './util.js';

export async function buildBackup() {
  const data = {};
  await withTx(BACKUP_STORES, 'readonly', (tx) => {
    for (const store of BACKUP_STORES) {
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => { data[store] = req.result; };
    }
  });
  return {
    app: APP_ID,
    format: BACKUP_FORMAT,
    appVersion: APP_VERSION,
    schemaVersion: DB_VERSION,
    seedVersion: (await getMeta('seedVersion')) ?? 0,
    exportedAt: nowIso(),
    data,
  };
}

export function backupFileName(d = new Date()) {
  return `yururi-diary-backup-${dateKey(d).replaceAll('-', '')}-${pad2(d.getHours())}${pad2(d.getMinutes())}.json`;
}

export async function makeBackupFile() {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 1);
  const name = backupFileName(new Date(backup.exportedAt));
  return { blob: new Blob([json], { type: 'application/json' }), name };
}

export function markBackedUp(at = nowIso()) {
  return setMeta('lastBackupAt', at);
}

// 読み込んだファイルの中身を確認する。問題があれば、本人向けの文で Error を投げる。
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('ファイルを読み取れませんでした。バックアップのファイルか確かめてください。');
  }
  if (!obj || obj.app !== APP_ID || typeof obj.data !== 'object' || obj.data === null) {
    throw new Error('このファイルは「ゆる〜り日記」のバックアップではないようです。');
  }
  if (!(obj.format <= BACKUP_FORMAT) || !(obj.schemaVersion <= DB_VERSION)) {
    throw new Error('新しいバージョンのアプリで作られたファイルです。アプリを更新してから読み込んでください。');
  }
  for (const store of BACKUP_STORES) {
    const rows = obj.data[store] ?? [];
    const key = KEY_PATHS[store];
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || r[key] == null)) {
      throw new Error('ファイルの中身が壊れているようです。');
    }
  }
  return obj;
}

export function summarize(backup) {
  const n = (store) => (backup.data[store] ?? []).length;
  return { records: n('records'), consults: n('consults'), exportedAt: backup.exportedAt, appVersion: backup.appVersion };
}

// いまのデータをすべて消して、バックアップの内容に置き換える(1つのトランザクションで行う)
export async function restoreBackup(backup) {
  await withTx(BACKUP_STORES, 'readwrite', (tx) => {
    for (const store of BACKUP_STORES) {
      const os = tx.objectStore(store);
      os.clear();
      for (const row of backup.data[store] ?? []) os.put(row);
    }
  });
  // 古いファイルの場合、その後に増えた初期データだけを足す
  await setMeta('seedVersion', backup.seedVersion ?? 0);
  await runSeeds();
  // 読み込んだファイル自体がバックアップなので、その日時を「最後のバックアップ」とみなす
  const last = await getMeta('lastBackupAt');
  if (backup.exportedAt && (!last || backup.exportedAt > last)) await markBackedUp(backup.exportedAt);
}
