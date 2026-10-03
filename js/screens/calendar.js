// 見返し:カレンダー(3-9)
// #/calendar/<YYYY-MM> … 月のカレンダー。マスの中身は js/month-calendar.js。日付をタップすると #/day/<日付>。

import { loadMonth, monthGridHtml, legendHtml } from '../month-calendar.js';
import { href } from '../router.js';
import { pad2 } from '../util.js';

export async function renderCalendar(el, [monthParam], isStale) {
  const now = new Date();
  const [y, m] = /^\d{4}-\d{2}$/.test(monthParam ?? '')
    ? monthParam.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const data = await loadMonth(y, m);
  if (isStale()) return;

  const monthKey = (yy, mm) => {
    const d = new Date(yy, mm - 1, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  };
  const isThisMonth = y === now.getFullYear() && m === now.getMonth() + 1;

  el.innerHTML = `
    <div class="cal-head">
      <button type="button" class="day-btn" data-month="-1" aria-label="前の月">‹</button>
      <h2 class="cal-title">${y}年${m}月</h2>
      <button type="button" class="day-btn" data-month="1" aria-label="次の月">›</button>
    </div>
    ${isThisMonth ? '' : '<button type="button" class="btn btn-small cal-today" id="this-month">今月にもどる</button>'}
    ${monthGridHtml(data)}
    ${legendHtml(data.settings)}
    <p class="hint">日付をタップすると、その日の記録をまとめて見られます。</p>
  `;

  el.querySelectorAll('[data-month]').forEach((b) => {
    b.addEventListener('click', () => location.replace(href('calendar', monthKey(y, m + Number(b.dataset.month)))));
  });
  el.querySelector('#this-month')?.addEventListener('click', () => location.replace(href('calendar')));
}
