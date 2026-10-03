// 初期データ(選択肢・お題・信号機の初期説明など)
// 一度入れたら二度と入れない(本人が消した選択肢を復活させないため)。
// 後のフェーズで初期データを足すときは SEED_VERSION を上げ、seeds に追加する。

import { withTx, getMeta } from './db.js';
import { uuid, nowIso } from './util.js';

export const SEED_VERSION = 2;

const INITIAL_CHOICES = {
  'condition.body': ['元気', '頭痛', '眠い', 'だるい', '気持ち悪い', 'お腹の調子が悪い', '食欲なし', '動悸'],
  'condition.mind': [
    '落ち着く', '不安', 'イライラ', '落ち込み', 'ぼーっと', '考えがまとまらない',
    'ざわざわ', '音が気になる', '光がまぶしい', 'においが気になる', '味が気になる', '肌ざわりが気になる',
  ],
  'diary.starter': ['今日あったことは', 'そのとき思ったのは', '今日いちばん印象に残ったのは', '明日はこうしたい'],
  'diary.prompt': ['今日会った人・話した人', '今日食べたもので印象に残ったもの', '今日の天気と、そのときの気分', '今日少しがんばったこと'],
  'hitokoto.prompt': [
    '今日よかったこと', '自分をほめたいこと', '「ありがとう」と思ったこと',
    'ちょっと楽しかったこと・笑ったこと', '明日の小さな楽しみ', 'できたこと(どんなに小さくても)',
  ],
  'hitokoto.starter': ['今日よかったのは', '自分えらい、なぜなら', 'ありがとう、'],
  // 'calm'(落ち着くことリスト)と 'medicine'(薬)は初期は空
};

const INITIAL_SIGNALS = [
  { color: 'blue', name: '青', label: '元気' },
  { color: 'yellow', name: '黄', label: '情緒不安定が始まったとき' },
  { color: 'red', name: '赤', label: '情緒不安定がピークのとき' },
  { color: 'black', name: '黒', label: 'もうダメ' },
];

const seeds = {
  1(tx) {
    const t = nowIso();
    const choices = tx.objectStore('choices');
    for (const [list, labels] of Object.entries(INITIAL_CHOICES)) {
      labels.forEach((label, i) => {
        choices.put({ id: uuid(), list, label, order: i, createdAt: t });
      });
    }
    const signals = tx.objectStore('signals');
    INITIAL_SIGNALS.forEach((s, i) => {
      signals.put({ ...s, order: i, state: '', action: '', updatedAt: t });
    });
  },

  // v0.3.0:身体の「お腹」→「お腹の調子が悪い」(本人が名前を変えていない場合だけ)
  // これまでの記録に残っている名前はそのまま(記録した時点の名前を残す方針)
  2(tx) {
    const req = tx.objectStore('choices').index('list').openCursor('condition.body');
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return;
      if (cur.value.label === 'お腹') cur.update({ ...cur.value, label: 'お腹の調子が悪い' });
      cur.continue();
    };
  },
};

export async function runSeeds() {
  const current = (await getMeta('seedVersion')) ?? 0;
  for (let v = current + 1; v <= SEED_VERSION; v++) {
    await withTx(['choices', 'signals', 'meta'], 'readwrite', (tx) => {
      seeds[v](tx);
      tx.objectStore('meta').put({ key: 'seedVersion', value: v });
    });
  }
}
