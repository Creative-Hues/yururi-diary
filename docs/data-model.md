# データ構造(IndexedDB)

- データベース名:`yururi-diary`(バージョン `DB_VERSION` = 1、`js/db.js`)
- すべて端末内に保存。サーバーには送らない。
- ※ `creative-hues.github.io` 上の他のアプリ(例:ひとつやね)と保存場所(オリジン)を共有するため、
  DB名・キャッシュ名・localStorage のキーには必ず `yururi-diary` を付ける。

## ストア一覧

| ストア | 主キー | インデックス | 中身 | バックアップ |
|---|---|---|---|---|
| `meta` | `key` | – | 端末ごとの情報 | 含めない |
| `settings` | `key` | – | 設定(本人が変えた値だけ) | 含める |
| `records` | `id` | `date` / `type` / `type_date` | 日時を持つ記録すべて | 含める |
| `choices` | `id` | `list` | 選択肢・お題・薬など、本人が編集できる一覧 | 含める |
| `signals` | `color` | – | 信号機の4色の内容 | 含める |
| `consults` | `id` | `done` | 相談したいことメモ | 含める |

## meta

| key | value |
|---|---|
| `anonId` | 匿名ID(初回起動時に作成。不具合報告で使う) |
| `installedAt` | 初回起動日時(ISO) |
| `seedVersion` | 初期データをどこまで入れたか |
| `lastBackupAt` | 最後にバックアップした日時(ISO) |

## settings

`{ key, value }`。初期値は `js/prefs.js` の `DEFAULT_SETTINGS` にあり、保存されるのは変更した値だけ。

| key | 初期値 | 内容 |
|---|---|---|
| `vitalsPerDay` | 3 | バイタルの1日の測定回数(1〜6) |
| `lockEnabled` | false | ロック(フェーズ5) |

## records(中心となるストア)

日時を持つ記録は、種類に関係なくすべてここに1件ずつ入れる。

```js
{
  id: "uuid",
  type: "mood",                 // 記録の種類(下の表)
  at: "2026-10-03T21:15",       // 記録の日時(端末の時刻・24時間。本人が編集できる)
  date: "2026-10-03",           // at の日付部分(0時区切り)。カレンダー用。保存時に自動で合わせる
  data: { ... },                // 種類ごとの中身
  createdAt: "ISO", updatedAt: "ISO"
}
```

こうしておく理由:

- **カレンダー(フェーズ4)**:`date` インデックス1回で、その日の全種類の記録が取れる。
- **相談用の表示**:`type_date` インデックスで「服薬の1週間分」などを範囲で取れる。
- **種類を増やしてもDBの作り直しが不要**:新しい `type` を使い始めるだけでよい。
- `at` はタイムゾーンを持たない端末の時刻。`<input type="datetime-local">` の値をそのまま入れられる。

### type ごとの data(フェーズ2の5種類は実装済み)

| type | フェーズ | data |
|---|---|---|
| `mood` | 2 | `{ level }` … `"great"` / `"good"` / `"normal"` / `"tough"` / `"very_tough"` |
| `condition` | 2 | `{ body: [{id, label}], mind: [{id, label}], bodyOther, mindOther }` |
| `meal` | 2 | `{ slot, text }` … slot は `"breakfast"` / `"lunch"` / `"dinner"`(1日の各食事が1件。文を消して保存すると記録も消える) |
| `medicine` | 2 | `{ medicineId, name, note }`(1回飲むごとに1件) |
| `vital` | 2 | `{ slot, temp, bpHigh, bpLow, pulse, spo2, weight }`(1回目〜N回目の各回が1件。空の項目は null) |
| `diary` | 3 | `{ text, prompt, favorite: 0\|1 }` |
| `hitokoto` | 3 | `{ text, prompt, favorite: 0\|1 }` |
| `worksheet` | 3 | `{ worry, level: 0〜10, ideas }` |

- 選んだ選択肢は `{id, label}` の形で名前も一緒に残す(あとで選択肢を消したり名前を変えても、過去の記録の表示が変わらない)。
- **服薬の①②の番号は保存しない**。表示のたびに「その日・同じ薬・時刻順」で数えるので、時刻を編集すると自動で並び直る。
- 1日の上限回数は `choices` の薬の側に持つ。
- `favorite` は 0/1(IndexedDB は true/false をインデックスにできないため)。

## choices(本人が編集できる一覧)

```js
{ id: "uuid", list: "condition.body", label: "頭痛", order: 0, createdAt: "ISO" }
```

| list | 中身 | 初期データ |
|---|---|---|
| `condition.body` | 体調(身体) | 8件 |
| `condition.mind` | 体調(心) | 12件 |
| `diary.starter` / `diary.prompt` | 一日の日記の書き出し・お題 | 4件 / 4件 |
| `hitokoto.starter` / `hitokoto.prompt` | ひとこと日記の書き出し・お題 | 3件 / 6件 |
| `calm` | 落ち着くことリスト | 空 |
| `medicine` | 薬。`limitPerDay`(数値 or null=上限なし)を追加で持つ | 空 |

並び順は `order`。並び替えたら 0,1,2… と振り直す。

## signals(信号機)

```js
{ color: "blue", name: "青", label: "元気", state: "どんな状態か", action: "何をするか", order: 0, updatedAt: "ISO" }
```

color は `blue` / `yellow` / `red` / `black` の4件固定。

## consults(相談したいことメモ)

```js
{ id: "uuid", text, createdAt: "ISO", updatedAt: "ISO", done: 0|1, doneAt: "ISO" | null }
```

## 初期データ(js/seed.js)

- `meta.seedVersion` を見て、まだ入れていない初期データだけを入れる。
- 一度入れたら二度と入れない(本人が消した選択肢を勝手に戻さないため)。
- 後のフェーズで初期データを足すときは `SEED_VERSION` を上げて `seeds` に追加する。

## 構造を変えるとき(js/db.js)

1. `DB_VERSION` を1つ上げる
2. `migrations` に新しい番号の関数を足す(ストアやインデックスの追加)
3. 既存のデータは残る(古い番号から順に実行される)

## バックアップファイル

```js
{
  app: "yururi-diary",
  format: 1,              // ファイル形式のバージョン
  appVersion: "0.1.0",
  schemaVersion: 1,       // 書き出したときの DB_VERSION
  seedVersion: 1,
  exportedAt: "ISO",
  data: { settings: [...], records: [...], choices: [...], signals: [...], consults: [...] }
}
```

- 読み込みは「置き換え」(いまのデータを消して、ファイルの内容にする)。1つのトランザクションで行うので、途中で失敗しても半端な状態にならない。
- `meta`(匿名IDなど)は端末ごとの情報なので含めない。
- 新しい版のアプリで作られたファイル(`schemaVersion` が大きい)は読み込まない。
