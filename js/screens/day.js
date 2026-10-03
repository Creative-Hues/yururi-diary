// 見返し:日付ごとの一覧(3-9)
// #/day/<YYYY-MM-DD> … その日のすべての記録を種類ごとにまとめて表示。
// タップすると各記録の編集画面を開く。保存・削除するとこの一覧に戻る
// (気分・服薬はこの画面の上でダイアログが開く)。

import { getAll, getRecordsByDate } from '../db.js';
import { RECORD_KINDS, MEAL_SLOTS, VITAL_FIELDS, moodLabel } from '../constants.js';
import { getSettings, moodEmoji } from '../prefs.js';
import { levelText } from './worksheet.js';
import { dayNavHtml, bindDayNav, isDateKey, timeOf, recItem, sortByAt, circled, fmtNum } from '../components.js';
import { numberDoses } from '../doses.js';
import { conditionSummary } from './condition.js';
import { editMood } from './mood.js';
import { editDose } from './medicine.js';
import { href } from '../router.js';
import { dateKey, esc } from '../util.js';

// バイタルの1行要約「体温 36.5℃・血圧 118/76・脈拍 72」
export function vitalSummary(data) {
  const parts = [];
  for (const f of VITAL_FIELDS) {
    if (f.key === 'bpLow') continue;
    if (f.key === 'bpHigh') {
      if (data.bpHigh != null || data.bpLow != null) parts.push(`血圧 ${fmtNum(data.bpHigh) || '–'}/${fmtNum(data.bpLow) || '–'}`);
      continue;
    }
    if (data[f.key] != null) parts.push(`${f.label.replace(/\(.*\)/, '')} ${fmtNum(data[f.key])}${f.unit === '回/分' ? '' : f.unit}`);
  }
  return parts.join('・');
}

const short = (s, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);

// 種類ごとの1行(time / main / sub)と、タップしたときの動き
function rowsFor(type, recs, settings) {
  switch (type) {
    case 'mood':
      return recs.map((r) => ({ r, time: timeOf(r.at), main: `${esc(moodEmoji(settings, r.data.level))} ${esc(moodLabel(r.data.level))}`, dialog: editMood }));
    case 'condition':
      return recs.map((r) => ({ r, time: timeOf(r.at), main: esc(conditionSummary(r.data)), to: href('condition', r.id) }));
    case 'meal':
      return recs.map((r) => ({ r, time: timeOf(r.at), main: `${MEAL_SLOTS.find((s) => s.slot === r.data.slot)?.label ?? ''}:${esc(short(r.data.text))}`, to: href('meal-edit', r.id) }));
    case 'medicine': {
      const n = numberDoses(recs);
      return recs.map((r) => ({ r, time: timeOf(r.at), main: `${esc(r.data.name)} ${circled(n.get(r.id))}`, sub: esc(r.data.note ?? ''), dialog: editDose }));
    }
    case 'vital':
      return recs.map((r, i) => ({ r, time: timeOf(r.at), main: `${i + 1}回目`, sub: esc(vitalSummary(r.data)), to: href('vital-edit', r.id) }));
    case 'diary':
      return recs.map((r) => ({ r, time: timeOf(r.at), main: `${r.data.favorite ? '★ ' : ''}${esc(short(r.data.text))}`, to: href('diary-day-edit', r.id) }));
    case 'hitokoto':
      return recs.map((r) => ({ r, time: timeOf(r.at), main: `${r.data.favorite ? '★ ' : ''}${esc(short(r.data.text))}`, to: href('diary-hitokoto-edit', r.id) }));
    case 'worksheet':
      return recs.map((r) => ({
        r,
        time: timeOf(r.at),
        main: esc(levelText(r.data)) || '(メモのみ)',
        sub: esc(short(r.data.memo ?? '')),
        to: href('worksheet-edit', r.id),
      }));
    case 'consult':
      return recs.map((r) => ({ r, time: timeOf(r.at), main: esc(short(r.text)), sub: r.done ? '相談済み' : '', to: href('consult-edit', r.id) }));
    default:
      return [];
  }
}

export async function renderDay(el, [dateParam], isStale) {
  const date = isDateKey(dateParam) ? dateParam : dateKey();
  const [records, consults, settings] = await Promise.all([getRecordsByDate(date), getAll('consults'), getSettings()]);
  if (isStale()) return;

  const byType = new Map(RECORD_KINDS.map((k) => [k.type, []]));
  for (const r of sortByAt(records)) byType.get(r.type)?.push(r);
  byType.set('consult', consults.filter((c) => c.at.slice(0, 10) === date).sort((a, b) => a.at.localeCompare(b.at)));

  const actions = new Map();
  const total = [...byType.values()].reduce((n, a) => n + a.length, 0);

  el.innerHTML = `
    ${dayNavHtml(date)}
    ${total ? '' : '<p class="empty day-empty">この日の記録はありません</p>'}
    ${RECORD_KINDS.map((k) => {
      const rows = rowsFor(k.type, byType.get(k.type), settings);
      rows.forEach((row) => actions.set(row.r.id, row));
      return `
        <section class="day-sec${rows.length ? '' : ' is-empty'}">
          <div class="day-sec-head">
            <h2 class="day-sec-title">${esc(k.label)}</h2>
            <span class="small muted">${rows.length ? `${rows.length}件` : '記録なし'}</span>
          </div>
          ${rows.length ? `<div class="card rows">${rows.map((row) => recItem({ id: row.r.id, time: row.time, main: row.main, sub: row.sub })).join('')}</div>` : ''}
        </section>`;
    }).join('')}
    <a class="link-row" href="${href('report', 'day', date)}">この日の相談用の表示を見る ›</a>
  `;

  bindDayNav(el, date, (next) => location.replace(href('day', next)));

  el.querySelectorAll('.rec-item').forEach((b) => {
    b.addEventListener('click', async () => {
      const row = actions.get(b.dataset.id);
      if (row.dialog) {
        if (await row.dialog(row.r)) renderDay(el, [date], isStale);
      } else {
        location.hash = row.to;
      }
    });
  });
}
