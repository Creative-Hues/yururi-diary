// 記録の種類ごとの決まった値

// 気分の5段階(色は付けない)。emoji は初期の絵文字(本人が設定で変えられる。prefs.js の moodEmoji)
export const MOODS = [
  { level: 'great', label: 'とても良い', emoji: '🥰' },
  { level: 'good', label: '良い', emoji: '😊' },
  { level: 'normal', label: 'ふつう', emoji: '🙂' },
  { level: 'tough', label: 'しんどい', emoji: '😕' },
  { level: 'very_tough', label: 'とてもしんどい', emoji: '☹️' },
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
  consultTag: 'consult.tag',
};

// 薬の情報:飲むタイミング(いくつでも選べる。choices の薬に timings として名前の配列で持つ)
export const MED_TIMINGS = ['朝', '昼', '夜', '寝る前', 'とんぷく'];

// 体調の選択肢のうち、カレンダーの帯に出すもの(choices の kind)。名前を変えても kind で見分ける
export const CHOICE_KINDS = { bowel: 'bowel', period: 'period' };
export const PERIOD_PHASES = [
  { phase: 'start', label: 'はじまった' },
  { phase: 'end', label: 'おわった' },
];
export const periodPhaseLabel = (phase) => PERIOD_PHASES.find((p) => p.phase === phase)?.label ?? '';
// 生理が「はじまった」からこの日数たっても「おわった」がなければ、ホームでやさしく知らせる
export const PERIOD_REMIND_DAYS = 10;

// 整理シートのつらさ
export const LEVEL_MIN = 0;
export const LEVEL_MAX = 10;

// 日付ごとの一覧に出す種類(この順に並ぶ)
export const RECORD_KINDS = [
  { type: 'mood', label: '気分' },
  { type: 'condition', label: '体調' },
  { type: 'meal', label: '食事' },
  { type: 'medicine', label: '服薬' },
  { type: 'vital', label: 'バイタル' },
  { type: 'diary', label: '一日の日記' },
  { type: 'hitokoto', label: 'ひとこと日記' },
  { type: 'worksheet', label: '整理シート' },
  { type: 'consult', label: '相談したいことメモ' },
];
