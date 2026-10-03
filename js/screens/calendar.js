// 見返し:カレンダー(3-9)
// #/calendar/<YYYY-MM> … 月のカレンダー。各マスに、記録がある種類の小さな印を付ける。
// 気分は色ではなく記号(◎○−△▲)で、その日の最後の気分を出す。日付をタップすると #/day/<日付>。

import { getAll, getRecordsInRange } from '../db.js';
import { MOODS, RECORD_KINDS, moodShort, moodLabel } from '../constants.js';
import { href } from '../router.js';
import { dateKey, esc, pad2 } from '../util.js';

const WEEK_HEAD = ['日', '月', '火', '水', '木', '金', '土'];

// 日付 → { kinds: Set<type>, mood: 最後の気分 }
export async function summarizeDays(from, to) {
  const [records, consults] = await Promise.all([getRecordsInRange(from, to), getAll('consults')]);
  const days = new Map();
  const day = (d) => {
    if (!days.has(d)) days.set(d, { kinds: new Set(), mood: null, moodAt: '' });
    return days.get(d);
  };
  for (const r of records) {
    const s = day(r.date);
    s.kinds.add(r.type);
    if (r.type === 'mood' && r.at >= s.moodAt) {
      s.mood = r.data.level;
      s.moodAt = r.at;
    }
  }
  for (const c of consults) {
    const d = c.at.slice(0, 10);
    if (d >= from && d <= to) day(d).kinds.add('consult');
  }
  return days;
}

export async function renderCalendar(el, [monthParam], isStale) {
  const now = new Date();
  const [y, m] = /^\d{4}-\d{2}$/.test(monthParam ?? '')
    ? monthParam.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const days = await summarizeDays(dateKey(first), dateKey(last));
  if (isStale()) return;

  const today = dateKey();
  const monthKey = (yy, mm) => {
    const d = new Date(yy, mm - 1, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  };
  const isThisMonth = y === now.getFullYear() && m === now.getMonth() + 1;

  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push('<span class="cal-cell is-blank" aria-hidden="true"></span>');
  for (let d = 1; d <= last.getDate(); d++) {
    const key = `${y}-${pad2(m)}-${pad2(d)}`;
    const s = days.get(key);
    const marks = RECORD_KINDS.filter((k) => k.mark && s?.kinds.has(k.type));
    const wd = new Date(y, m - 1, d).getDay();
    const label = `${m}月${d}日${s ? `、${[s.mood ? `気分 ${moodLabel(s.mood)}` : '', ...marks.map((k) => k.label)].filter(Boolean).join('・')}` : '、記録なし'}`;
    cells.push(`
      <a class="cal-cell${key === today ? ' is-today' : ''}${key > today ? ' is-future' : ''}${wd === 0 ? ' is-sun' : wd === 6 ? ' is-sat' : ''}" href="${href('day', key)}" aria-label="${esc(label)}">
        <span class="cal-top"><span class="cal-num">${d}</span>${s?.mood ? `<span class="cal-mood">${moodShort(s.mood)}</span>` : ''}</span>
        <span class="cal-marks" aria-hidden="true">${marks.map((k) => k.mark).join('')}</span>
      </a>`);
  }

  el.innerHTML = `
    <div class="cal-head">
      <button type="button" class="day-btn" data-month="-1" aria-label="前の月">‹</button>
      <h2 class="cal-title">${y}年${m}月</h2>
      <button type="button" class="day-btn" data-month="1" aria-label="次の月">›</button>
    </div>
    ${isThisMonth ? '' : '<button type="button" class="btn btn-small cal-today" id="this-month">今月にもどる</button>'}
    <div class="cal-grid">
      ${WEEK_HEAD.map((w, i) => `<span class="cal-wd${i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : ''}">${w}</span>`).join('')}
      ${cells.join('')}
    </div>
    <div class="cal-legend">
      <p><span class="legend-head">気分</span>${MOODS.map((md) => `<span>${md.short} ${esc(md.label)}</span>`).join('')}</p>
      <p><span class="legend-head">記録</span>${RECORD_KINDS.filter((k) => k.mark).map((k) => `<span>${k.mark} ${esc(k.label)}</span>`).join('')}</p>
    </div>
    <p class="hint">日付をタップすると、その日の記録をまとめて見られます。</p>
  `;

  el.querySelectorAll('[data-month]').forEach((b) => {
    b.addEventListener('click', () => location.replace(href('calendar', monthKey(y, m + Number(b.dataset.month)))));
  });
  el.querySelector('#this-month')?.addEventListener('click', () => location.replace(href('calendar')));
}
