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
| `feedback` | 不具合報告:送った報告の控え・見た返信の数・最後に読み込んだ日時(js/feedback) |
| `draft:<画面>:new` / `draft:<画面>:edit:<id>` | 入力画面の下書き `{ value, savedAt }`(js/drafts.js)。新しく記録するときと直すときで別。保存・削除で消える。信号機は `draft:signal:edit:<色>` |
| `installedAt` | 初回起動日時(ISO) |
| `seedVersion` | 初期データをどこまで入れたか |
| `lastBackupAt` | 最後にバックアップした日時(ISO)。ホームの「バックアップ」のブロックに出し、1か月以上たったら(まだ取っていなければ、`installedAt` から1か月)注意を出す |
| `lock` | ロックの設定 `{ enabled, hash, salt, iterations, credentialId, timeoutMin, failCount, waitUntil }`(説明は docs/lock.md) |

## settings

`{ key, value }`。初期値は `js/prefs.js` の `DEFAULT_SETTINGS` にあり、保存されるのは変更した値だけ。

| key | 初期値 | 内容 |
|---|---|---|
| `vitalsPerDay` | 3 | バイタルの1日の測定回数(1〜6) |
| `moodEmojis` | `{}` | 気分の絵文字。`{ level: 絵文字 }` で、初期(🥰😊🙂😕😞。端末によって白黒の記号になる ☺️・☹️ を避け、v0.10.0 で「良い」を 😊、v0.11.0 で「とてもしんどい」を 😞 に変えた。`js/constants.js` の `MOODS`)から変えた段階だけ入る。気分のボタン・カレンダーなどに出す |
| `levelNames` | 0「つらくない」・10「とてもつらい」、1〜9は空欄 | 整理シートのつらさ 0〜10 の名前(11個の配列) |

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

### type ごとの data

| type | フェーズ | data |
|---|---|---|
| `mood` | 2 | `{ level }` … `"great"` / `"good"` / `"normal"` / `"tough"` / `"very_tough"` |
| `condition` | 2 | `{ body: [{id, label, kind?, phase?}], mind: [{id, label}], bodyOther, mindOther }`(kind・phase は下の「お通じ・生理」) |
| `meal` | 2 | `{ slot, text }` … slot は `"breakfast"` / `"lunch"` / `"dinner"`(食事1回が1件。同じ「昼」が2件あってもよい) |
| `medicine` | 2 | `{ medicineId, name, note }`(1回飲むごとに1件) |
| `vital` | 2 | `{ temp, bpHigh, bpLow, pulse, spo2, weight }`(測定1回が1件。空の項目は null。「1回目」「2回目」は保存せず、その日の時刻順で数える。v0.2.0 の記録に残る `slot` は使わない) |
| `diary` | 3 | `{ text, prompt, favorite: 0\|1 }`(prompt はひいたお題の文。なければ空) |
| `hitokoto` | 3 | `{ text, prompt, favorite: 0\|1 }` |
| `worksheet` | 3 | `{ level: 0〜10 または null, levelName, memo }`(つらさか詳細メモのどちらかがあれば保存できる。levelName は選んだときのつらさの名前。v0.9.0 で worry・ideas をやめて memo 1つにした) |

- 選んだ選択肢は `{id, label}` の形で名前も一緒に残す(あとで選択肢を消したり名前を変えても、過去の記録の表示が変わらない)。
- **服薬の①②の番号は保存しない**。表示のたびに「その日・同じ薬・時刻順」で数えるので、時刻を編集すると自動で並び直る。
- 1日の上限回数は `choices` の薬の側に持つ。
- `favorite` は 0/1(IndexedDB は true/false をインデックスにできないため)。

### お通じ・生理(v0.9.0)

- 体調(身体)の選択肢のうち、`kind` を持つものはカレンダーの帯に出す。`kind: "bowel"`(お通じ)/ `kind: "period"`(生理)。名前を変えても kind で見分ける。
- 記録の `body` の項目にも `kind` を残す。生理は `phase: "start"`(はじまった)/ `"end"`(おわった)も持つ(どちらかを選ばないと保存できない)。
- 生理の期間(`js/periods.js`):「はじまった」から「おわった」まで。「おわった」がまだなければ今日まで。おわる前にもう一度「はじまった」があれば、前の期間はその前の日まで。「はじまった」のない「おわった」は使わない。
- 「はじまった」から10日以上(`PERIOD_REMIND_DAYS`)たっても「おわった」がなければ、ホームでやさしく知らせる。

## choices(本人が編集できる一覧)

```js
{ id: "uuid", list: "condition.body", label: "頭痛", order: 0, createdAt: "ISO" }
```

| list | 中身 | 初期データ |
|---|---|---|
| `condition.body` | 体調(身体)。お通じ・生理は `kind` を持つ | 10件 |
| `condition.mind` | 体調(心) | 12件 |
| `diary.starter` / `diary.prompt` | 一日の日記の書き出し・お題 | 4件 / 4件 |
| `hitokoto.starter` / `hitokoto.prompt` | ひとこと日記の書き出し・お題 | 3件 / 6件 |
| `calm` | 落ち着くことリスト | 空 |
| `medicine` | 薬。`limitPerDay`(数値 or null=上限なし)と、薬の情報(下)を追加で持つ | 空 |
| `medicine.timing` | 薬の飲むタイミングの選択肢 | 朝 / 昼 / 夜 / 寝る前 / とんぷく |
| `consult.tag` | 相談したいことメモのタグ(誰に向けたメモか) | 主治医 / 看護師さん / 心理士さん / ケースワーカーさん |

並び順は `order`。並び替えたら 0,1,2… と振り直す。

- 一覧の編集画面(`js/screens/list-editor.js`)の「選んで削除」で、まとめて消せる(1つのトランザクション)。消しても記録には名前(と kind)が残っているので、これまでの記録の表示は変わらない。

### 薬の情報(v0.11.0)

```js
{ id, list: "medicine", label, order, createdAt,
  limitPerDay: 2 | null,
  timings: ["選択肢のid"],   // 飲むタイミング(choices の medicine.timing。いくつでも)
  detail: "薬の詳細情報" }    // 自由記述。行頭が「・」の行は箇条書きで表示する(信号機と同じ linesHtml)
```

- 薬の登録画面の項目は、名前・1日の上限回数・飲むタイミング・薬の詳細情報の4つ。上限回数・飲むタイミング・詳細情報は空欄でよい。
- `timings` は選択肢の id だけを持つ(相談メモのタグと同じ)。選択肢の名前を変えると薬の表示も変わり、選択肢を消すと薬から外れる。
- v0.10.0 の `purpose`・`dose`・`caution`・`memo` と、名前の配列だった `timings` は v0.11.0 で使わなくなった(移しかえはしない)。
- choices に入っているのでバックアップに含まれる。服薬の画面で、薬ごとに「薬の情報」をタップで開いて見られる。

## signals(信号機)

```js
{ color: "blue", name: "青", label: "元気", state: "どんな状態か", action: "何をするか", order: 0, updatedAt: "ISO" }
```

color は `blue` / `yellow` / `red` / `black` の4件固定。`state` / `action` は複数行の文で、行頭が「・」の行は箇条書きとして表示する。

## consults(相談したいことメモ)

```js
{
  id: "uuid", text, at: "YYYY-MM-DDTHH:mm", createdAt: "ISO", updatedAt: "ISO", done: 0|1, doneAt: "ISO" | null,
  tags: ["タグのid"],          // choices の consult.tag(いくつでも)
  comments: [{ id, text, at: "YYYY-MM-DDTHH:mm", createdAt, updatedAt }]  // 相談後のメモ
}
```

- `tags` は id だけを持つ(ほかの選択肢とちがい名前は残さない)。タグの名前を変えるとすべてのメモの表示が変わり、タグを消すとメモから外れる。
- `comments`(相談後のメモ)は何件でも。日時は本人が直せる。書いても `done` は変えない(「✓ 相談した」で切り替える)。
- v0.9.0 より前のメモには `tags`・`comments` がない(無いときは空として扱う)。

- `at` は書いた日時(本人が直せる)。
- 未相談・相談済みで分けて見るものなので、records とは別のストアにしている。

## 初期データ(js/seed.js)

- `meta.seedVersion` を見て、まだ入れていない初期データだけを入れる。
- 一度入れたら二度と入れない(本人が消した選択肢を勝手に戻さないため)。
- 後のフェーズで初期データを足すときは `SEED_VERSION` を上げて `seeds` に追加する。
- seed 2(v0.3.0):身体の「お腹」を「お腹の調子が悪い」に変更。名前が「お腹」のままのものだけ変える。これまでの記録に残っている名前は変えない。
- seed 3(v0.9.0):身体の最後に「お通じ」(kind: bowel)・「生理」(kind: period)を追加。相談したいことメモのタグ4件を追加。
- seed 4(v0.11.0):薬の飲むタイミングの選択肢5件(朝・昼・夜・寝る前・とんぷく)を追加。

## 構造を変えるとき(js/db.js)

本人はすでに使っていて、端末に本物の記録が入っている。データの形を変えるときは、作業の前に相談し、古いデータを移す処理を必ず入れる。

1. `DB_VERSION` を1つ上げる
2. `migrations` に新しい番号の関数を足す(ストアやインデックスの追加)
3. 既存のデータは残る(古い番号から順に実行される)
4. records の data・choices・settings の中身の形を変えるときも、古い形のまま入っているデータを新しい形に移す処理を入れる
   (または、古い形のままでも読めるようにする)。バックアップファイルの読み込み(古い版で書き出したファイル)でも同じように扱う。

## 版ごとの変更

- v0.12.0(ヘルプ・グラフの拡大・編集ボタン):**データの形は変えていない**。DB_VERSION・SEED_VERSION・バックアップの形式もそのまま。
  ヘルプで開いた項目やグラフの拡大の状態は保存しない。

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
