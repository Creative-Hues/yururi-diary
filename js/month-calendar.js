// 月のカレンダー(カレンダーの画面と、相談用の表示のいちばん上で使う)
// マスの中:左上に日付、右上にその日の最後の気分の絵文字。
//           日付の下に「お通じ」の段(💩と帯)、その下に「生理」の段(🌸と帯)。
//           右下に日記の三角(ひとこと日記=水色の大きい三角、一日の日記=ピンクの小さい三角を上に重ねる)。
// 帯は、続く日・週をまたぐ日もつながって見えるよう、マスの外(すき間・カレンダーの端)までのばす(css の .band)。

import { getRecordsInRange } from './db.js';
import { MOODS, moodLabel } from './constants.js';
import { getSettings, moodEmoji } from './prefs.js';
import { bowelDays, periodRanges, getConditionRecords } from './periods.js';
import { shiftDate } from './components.js';
import { href } from './router.js';
import { dateKey, esc, pad2 } from './util.js';

const WEEK_HEAD = ['日', '月', '火', '水', '木', '金', '土'];

// その月の表示に必要なものを読む(帯のつながりを見るため、前後1日も読む)
export async function loadMonth(y, m) {
  const first = `${y}-${pad2(m)}-01`;
  const last = `${y}-${pad2(m)}-${pad2(new Date(y, m, 0).getDate())}`;
  const [records, conditions, settings] = await Promise.all([
    getRecordsInRange(shiftDate(first, -1), shiftDate(last, 1)),
    getConditionRecords(),
    getSettings(),
  ]);
  const days = new Map();
  const day = (d) => {
    if (!days.has(d)) days.set(d, { mood: null, moodAt: '', diary: false, hitokoto: false });
    return days.get(d);
  };
  for (const r of records) {
    if (r.type === 'mood') {
      const s = day(r.date);
      if (r.at >= s.moodAt) {
        s.mood = r.data.level;
        s.moodAt = r.at;
      }
    }
    if (r.type === 'diary' || r.type === 'hitokoto') day(r.date)[r.type] = true;
  }
  return {
    y, m, days, settings,
    bowel: bowelDays(records.filter((r) => r.type === 'condition')),
    periods: periodRanges(conditions),
  };
}

// 1つの段(帯)。on:この日に帯があるか、l/r:左右の日とつながるか、col:曜日の列(0=日〜6=土)
function laneHtml(kind, { on, emoji, l, r }, col) {
  if (!on) return `<span class="cal-lane lane-${kind}"></span>`;
  const cls = ['band', `band-${kind}`];
  if (l) cls.push(col === 0 ? 'cont-l wrap-l' : 'cont-l');
  if (r) cls.push(col === 6 ? 'cont-r wrap-r' : 'cont-r');
  return `<span class="cal-lane lane-${kind}"><span class="${cls.join(' ')}"></span>${emoji ? `<span class="lane-emoji">${emoji}</span>` : ''}</span>`;
}

// link:日付をタップでその日の一覧へ。picked:枠で囲む日(相談用の表示の期間)。markToday:今日に枠
export function monthGridHtml(data, { link = true, picked = new Set(), markToday = true } = {}) {
  const { y, m, days, settings, bowel, periods } = data;
  const today = dateKey();
  const firstWd = new Date(y, m - 1, 1).getDay();
  const lastDay = new Date(y, m, 0).getDate();
  const rangeOf = (d) => periods.find((p) => d >= p.start && d <= p.end) ?? null;

  const cells = [];
  for (let i = 0; i < firstWd; i++) cells.push('<span class="cal-cell is-blank" aria-hidden="true"></span>');
  for (let d = 1; d <= lastDay; d++) {
    const key = `${y}-${pad2(m)}-${pad2(d)}`;
    const col = (firstWd + d - 1) % 7;
    const prev = shiftDate(key, -1);
    const next = shiftDate(key, 1);
    const s = days.get(key);
    const range = rangeOf(key);
    const bowelOn = bowel.has(key);
    const tag = link ? 'a' : 'span';

    const words = [
      s?.mood ? `気分 ${moodLabel(s.mood)}` : '',
      bowelOn ? 'お通じ' : '',
      range ? (range.start === key ? '生理はじまり' : '生理') : '',
      s?.hitokoto ? 'ひとこと日記' : '',
      s?.diary ? '一日の日記' : '',
    ].filter(Boolean);
    const cls = ['cal-cell'];
    if (markToday && key === today) cls.push('is-today');
    if (key > today) cls.push('is-future');
    if (picked.has(key)) cls.push('is-picked');
    if (col === 0) cls.push('is-sun');
    if (col === 6) cls.push('is-sat');

    cells.push(`
      <${tag} class="${cls.join(' ')}"${link ? ` href="${href('day', key)}"` : ''} aria-label="${esc(`${m}月${d}日、${words.length ? words.join('・') : '記録なし'}`)}">
        <span class="cal-top"><span class="cal-num">${d}</span>${s?.mood ? `<span class="cal-mood">${esc(moodEmoji(settings, s.mood))}</span>` : ''}</span>
        ${laneHtml('bowel', { on: bowelOn, emoji: '💩', l: bowelOn && bowel.has(prev), r: bowelOn && bowel.has(next) }, col)}
        ${laneHtml('period', { on: !!range, emoji: range?.start === key ? '🌸' : '', l: !!range && rangeOf(prev) === range, r: !!range && rangeOf(next) === range }, col)}
        ${s?.hitokoto ? '<span class="tri tri-hitokoto" aria-hidden="true"></span>' : ''}
        ${s?.diary ? '<span class="tri tri-diary" aria-hidden="true"></span>' : ''}
      </${tag}>`);
  }

  return `
    <div class="cal-grid">
      ${WEEK_HEAD.map((w, i) => `<span class="cal-wd${i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : ''}">${w}</span>`).join('')}
      ${cells.join('')}
    </div>`;
}

export function legendHtml(settings) {
  return `
    <div class="cal-legend">
      <p><span class="legend-head">気分</span>${MOODS.map((md) => `<span>${esc(moodEmoji(settings, md.level))} ${esc(md.label)}</span>`).join('')}</p>
      <p><span class="legend-head">体調</span><span>💩 お通じ</span><span>🌸 生理(はじまった日から、おわった日まで帯)</span></p>
      <p><span class="legend-head">日記</span><span><i class="legend-tri tri-hitokoto"></i> ひとこと日記</span><span><i class="legend-tri tri-diary"></i> 一日の日記</span></p>
    </div>`;
}
