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

export function backupFileName(d = new Date(), ext = 'json') {
  return `yururi-diary-backup-${dateKey(d).replaceAll('-', '')}-${pad2(d.getHours())}${pad2(d.getMinutes())}.${ext}`;
}

// asText: true で、中身は同じまま .txt(text/plain)にする。
// Android の Chrome は .json のファイルを「共有」に渡せないが、.txt なら渡せるため、共有のときに使う。
export async function makeBackupFile({ asText = false } = {}) {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 1);
  const name = backupFileName(new Date(backup.exportedAt), asText ? 'txt' : 'json');
  const type = asText ? 'text/plain' : 'application/json';
  return { blob: new Blob([json], { type }), name, type };
}

export function markBackedUp(at = nowIso()) {
  return setMeta('lastBackupAt', at);
}

// 読み込んだファイルの中身を確認する。問題があれば、本人向けの文で Error を投げる。
// .json と .txt(共有で保存したもの)のどちらでも、中身は同じ JSON。
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text.replace(/^﻿/, ''));
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

// いまのデータをすべて消して backup の内容にし、同じトランザクションで「とっておく記録」(meta.importUndo)も書く。
// 途中で失敗したら全部取り消されるので、「置き換わったのに、とっておけていない」状態にはならない。
async function replaceAll(backup, undo) {
  await withTx([...BACKUP_STORES, 'meta'], 'readwrite', (tx) => {
    for (const store of BACKUP_STORES) {
      const os = tx.objectStore(store);
      os.clear();
      for (const row of backup.data[store] ?? []) os.put(row);
    }
    tx.objectStore('meta').put({ key: 'importUndo', value: undo });
  });
  // 古いファイルの場合、その後に増えた初期データだけを足す
  await setMeta('seedVersion', backup.seedVersion ?? 0);
  await runSeeds();
}

// いまのデータを、読み込む前の記録としてとっておいてから、バックアップの内容に置き換える
export async function restoreBackup(backup) {
  const before = await buildBackup();
  await replaceAll(backup, { kind: 'beforeImport', savedAt: nowIso(), backup: before });
  // 読み込んだファイル自体がバックアップなので、その日時を「最後のバックアップ」とみなす
  const last = await getMeta('lastBackupAt');
  if (backup.exportedAt && (!last || backup.exportedAt > last)) await markBackedUp(backup.exportedAt);
}

// とっておいた記録 { kind, savedAt, backup }(なければ undefined)
export const getImportUndo = () => getMeta('importUndo');

// とっておいた記録に戻す。いまの記録と入れかえるので、もう一度押せば、また戻せる。
// とっておいた記録はファイルではないので、「最後のバックアップ」の日時は変えない。
export async function undoImport() {
  const undo = await getImportUndo();
  if (!undo?.backup) throw new Error('とっておいた記録がありません');
  const current = await buildBackup();
  await replaceAll(undo.backup, {
    kind: undo.kind === 'beforeImport' ? 'beforeUndo' : 'beforeImport',
    savedAt: nowIso(),
    backup: current,
  });
}
