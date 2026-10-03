// 記録の種類ごとの決まった値

// 気分の5段階(色は付けない)。short はカレンダーなどの短い表示用(フェーズ4)
export const MOODS = [
  { level: 'great', label: 'とても良い', short: '◎' },
  { level: 'good', label: '良い', short: '○' },
  { level: 'normal', label: 'ふつう', short: '−' },
  { level: 'tough', label: 'しんどい', short: '△' },
  { level: 'very_tough', label: 'とてもしんどい', short: '▲' },
];
export const TOUGH_MOODS = ['tough', 'very_tough'];
export const moodLabel = (level) => MOODS.find((m) => m.level === level)?.label ?? '';

// defaultTime:今日以外の日に記録するときの、時刻の初期値
export const MEAL_SLOTS = [
  { slot: 'breakfast', label: '朝', defaultTime: '08:00' },
  { slot: 'lunch', label: '昼', defaultTime: '12:00' },
  { slot: 'dinner', label: '晩', defaultTime: '18:00' },
];

// 入力欄は2列で、この順に「体温・脈拍」「血圧(上)・血圧(下)」「酸素・体重」と並ぶ
// decimal:小数あり(キーボードに「.」が出る)
export const VITAL_FIELDS = [
  { key: 'temp', label: '体温', unit: '℃', decimal: true },
  { key: 'pulse', label: '脈拍', unit: '回/分' },
  { key: 'bpHigh', label: '血圧(上)', unit: 'mmHg' },
  { key: 'bpLow', label: '血圧(下)', unit: 'mmHg' },
  { key: 'spo2', label: '酸素(SpO2)', unit: '%' },
  { key: 'weight', label: '体重', unit: 'kg', decimal: true },
];

// choices の list 名
export const LISTS = {
  body: 'condition.body',
  mind: 'condition.mind',
  medicine: 'medicine',
  diaryStarter: 'diary.starter',
  diaryPrompt: 'diary.prompt',
  hitokotoStarter: 'hitokoto.starter',
  hitokotoPrompt: 'hitokoto.prompt',
  calm: 'calm',
};

// 整理シートのつらさ
export const LEVEL_MIN = 0;
export const LEVEL_MAX = 10;

// カレンダーの印・日付ごとの一覧に出す種類(この順に並ぶ)
// mark:カレンダーのマスに出す1文字(気分は記号で出すので無し)
export const RECORD_KINDS = [
  { type: 'mood', label: '気分' },
  { type: 'condition', label: '体調', mark: '体' },
  { type: 'meal', label: '食事', mark: '食' },
  { type: 'medicine', label: '服薬', mark: '薬' },
  { type: 'vital', label: 'バイタル', mark: 'バ' },
  { type: 'diary', label: '一日の日記', mark: '日' },
  { type: 'hitokoto', label: 'ひとこと日記', mark: 'ひ' },
  { type: 'worksheet', label: '整理シート', mark: '整' },
  { type: 'consult', label: '相談したいことメモ', mark: '相' },
];
export const moodShort = (level) => MOODS.find((m) => m.level === level)?.short ?? '';
