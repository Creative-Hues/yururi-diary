// 食事の記録(3-3)
// #/meal/<YYYY-MM-DD> … その日の朝・昼・晩(日付なしは今日)

import { getRecordsByType, newRecord, saveRecord, deleteRecord } from '../db.js';
import { MEAL_SLOTS } from '../constants.js';
import { dayNavHtml, bindDayNav, isDateKey, timeOf } from '../components.js';
import { href } from '../router.js';
import { confirmDialog, toast } from '../ui.js';
import { dateKey, esc, localDateTime } from '../util.js';

export async function renderMeal(el, [dateParam], isStale) {
  const date = isDateKey(dateParam) ? dateParam : dateKey();
  const rows = await getRecordsByType('meal', date, date);
  if (isStale()) return;

  const bySlot = new Map();
  for (const r of rows) if (!bySlot.has(r.data.slot)) bySlot.set(r.data.slot, r);

  el.innerHTML = `
    ${dayNavHtml(date)}
    ${MEAL_SLOTS.map((s) => {
      const r = bySlot.get(s.slot);
      return `
        <div class="card meal-card" data-slot="${s.slot}">
          <div class="card-head">
            <span class="card-title">${s.label}</span>
            <label class="time-label">時刻 <input type="time" class="input input-time" name="time" value="${r ? timeOf(r.at) : ''}"></label>
          </div>
          <textarea class="input" name="text" rows="2" placeholder="食べたもの">${esc(r?.data.text ?? '')}</textarea>
        </div>`;
    }).join('')}
    <p class="hint">書いたところだけ保存されます。時刻が空のときは、今日なら今の時刻、ほかの日なら朝8時・昼12時・晩18時で保存します。</p>
    <div class="save-bar"><button type="button" class="btn btn-primary btn-block" id="save-btn">保存する</button></div>
  `;

  let dirty = false;
  el.querySelectorAll('.meal-card .input').forEach((i) => i.addEventListener('input', () => { dirty = true; }));

  bindDayNav(el, date, async (next) => {
    if (dirty && !(await confirmDialog({ title: '保存していない内容があります', message: '保存せずに、別の日へ移りますか?', ok: '移る' }))) return;
    location.replace(href('meal', next));
  });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const now = localDateTime();
    for (const s of MEAL_SLOTS) {
      const card = el.querySelector(`[data-slot="${s.slot}"]`);
      const text = card.querySelector('[name="text"]').value.trim();
      const time = card.querySelector('[name="time"]').value;
      const r = bySlot.get(s.slot);
      if (!text) {
        if (r) await deleteRecord(r.id); // 消して保存したら記録も消す
        continue;
      }
      const at = `${date}T${time || (r ? timeOf(r.at) : date === now.slice(0, 10) ? timeOf(now) : s.defaultTime)}`;
      if (r) {
        r.data.text = text;
        r.at = at;
        await saveRecord(r);
      } else {
        await saveRecord(newRecord('meal', { slot: s.slot, text }, at));
      }
    }
    toast('保存しました');
    renderMeal(el, [date], isStale);
  });
}
