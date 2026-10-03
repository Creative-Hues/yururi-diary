// IndexedDB(端末内のデータ保存)
// データ構造の説明は docs/data-model.md を参照。

import { DB_NAME } from './config.js';
import { uuid, nowIso, localDateTime } from './util.js';

// 構造(ストアやインデックス)を変えるときだけ上げ、migrations に手順を足す
export const DB_VERSION = 1;

// バックアップに含めるストア(meta は端末ごとの情報なので含めない)
export const BACKUP_STORES = ['settings', 'records', 'choices', 'signals', 'consults'];

// 各ストアの主キー名(バックアップ読み込み時の確認にも使う)
export const KEY_PATHS = {
  meta: 'key',
  settings: 'key',
  records: 'id',
  choices: 'id',
  signals: 'color',
  consults: 'id',
};

const migrations = {
  1(db) {
    db.createObjectStore('meta', { keyPath: 'key' });
    db.createObjectStore('settings', { keyPath: 'key' });

    const records = db.createObjectStore('records', { keyPath: 'id' });
    records.createIndex('date', 'date');
    records.createIndex('type', 'type');
    records.createIndex('type_date', ['type', 'date']);

    const choices = db.createObjectStore('choices', { keyPath: 'id' });
    choices.createIndex('list', 'list');

    db.createObjectStore('signals', { keyPath: 'color' });

    const consults = db.createObjectStore('consults', { keyPath: 'id' });
    consults.createIndex('done', 'done');
  },
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      for (let v = e.oldVersion + 1; v <= DB_VERSION; v++) {
        migrations[v](req.result, req.transaction);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // 新しい版が別のタブで開かれたら、古い接続を閉じて読み込み直す
      db.onversionchange = () => {
        db.close();
        location.reload();
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

export function reqDone(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
}

// 複数の書き込みをまとめて行う(途中で失敗したら全部取り消される)
// fn の中では await せずに、リクエストを並べるだけにすること
export async function withTx(stores, mode, fn) {
  const db = await openDB();
  const tx = db.transaction(stores, mode);
  const result = fn(tx);
  await txDone(tx);
  return result;
}

export async function get(store, key) {
  const db = await openDB();
  return reqDone(db.transaction(store).objectStore(store).get(key));
}

export async function getAll(store, indexName, query) {
  const db = await openDB();
  const os = db.transaction(store).objectStore(store);
  return reqDone((indexName ? os.index(indexName) : os).getAll(query));
}

export async function count(store) {
  const db = await openDB();
  return reqDone(db.transaction(store).objectStore(store).count());
}

export function put(store, value) {
  return withTx(store, 'readwrite', (tx) => {
    tx.objectStore(store).put(value);
    return value;
  });
}

export function del(store, key) {
  return withTx(store, 'readwrite', (tx) => {
    tx.objectStore(store).delete(key);
  });
}

// ---- meta(端末ごとの情報) ----

export async function getMeta(key) {
  return (await get('meta', key))?.value;
}

export function setMeta(key, value) {
  return put('meta', { key, value });
}

// ---- records(日時を持つ記録すべて) ----
// フェーズ2以降で使う。type ごとの data の中身は docs/data-model.md 参照。

export function newRecord(type, data, at = localDateTime()) {
  const t = nowIso();
  return { id: uuid(), type, at, date: at.slice(0, 10), data, createdAt: t, updatedAt: t };
}

export function saveRecord(rec) {
  rec.date = rec.at.slice(0, 10); // 日時を編集したら日付も合わせる
  rec.updatedAt = nowIso();
  return put('records', rec);
}

export const deleteRecord = (id) => del('records', id);

export const getRecordsByDate = (date) => getAll('records', 'date', date);

export const getRecordsByType = (type, fromDate, toDate) =>
  getAll('records', 'type_date', IDBKeyRange.bound([type, fromDate], [type, toDate]));
