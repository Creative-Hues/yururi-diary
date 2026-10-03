// バイタルの記録(3-5)
// #/vital/<YYYY-MM-DD> … その日の1回目〜N回目(日付なしは今日)

import { getRecordsByType, newRecord, saveRecord, deleteRecord } from '../db.js';
import { getSettings } from '../prefs.js';
import { VITAL_FIELDS } from '../constants.js';
import { dayNavHtml, bindDayNav, isDateKey, timeOf, parseNum } from '../components.js';
import { href } from '../router.js';
import { confirmDialog, toast } from '../ui.js';
import { dateKey, esc, localDateTime } from '../util.js';

const OTHER_DAY_TIME = '12:00';

export async function renderVital(el, [dateParam], isStale) {
  const date = isDateKey(dateParam) ? dateParam : dateKey();
  const [settings, rows] = await Promise.all([getSettings(), getRecordsByType('vital', date, date)]);
  if (isStale()) return;

  const bySlot = new Map();
  for (const r of rows) if (!bySlot.has(r.data.slot)) bySlot.set(r.data.slot, r);
  // 回数の設定を減らしても、入力済みの回は表示する
  const slots = Math.max(settings.vitalsPerDay, ...bySlot.keys());

  el.innerHTML = `
    ${dayNavHtml(date)}
    ${Array.from({ length: slots }, (_, i) => {
      const slot = i + 1;
      const r = bySlot.get(slot);
      return `
        <div class="card vital-card" data-slot="${slot}">
          <div class="card-head">
            <span class="card-title">${slot}回目</span>
            <label class="time-label">時刻 <input type="time" class="input input-time" name="time" value="${r ? timeOf(r.at) : ''}"></label>
          </div>
          <div class="vital-grid">
            ${VITAL_FIELDS.map((f) => `
              <label class="field vital-field">
                <span class="field-label">${f.label}</span>
                <span class="with-unit">
                  <input type="text" class="input" name="${f.key}" inputmode="${f.decimal ? 'decimal' : 'numeric'}" autocomplete="off" value="${esc(r?.data[f.key] ?? '')}">
                  <span class="unit">${f.unit}</span>
                </span>
              </label>`).join('')}
          </div>
        </div>`;
    }).join('')}
    <p class="hint">入力したところだけ保存されます。時刻が空のときは、今日なら今の時刻で保存します。回数は設定で変えられます。</p>
    <div class="save-bar"><button type="button" class="btn btn-primary btn-block" id="save-btn">保存する</button></div>
  `;

  let dirty = false;
  el.querySelectorAll('.vital-card .input').forEach((i) => i.addEventListener('input', () => { dirty = true; }));

  bindDayNav(el, date, async (next) => {
    if (dirty && !(await confirmDialog({ title: '保存していない内容があります', message: '保存せずに、別の日へ移りますか?', ok: '移る' }))) return;
    location.replace(href('vital', next));
  });

  el.querySelector('#save-btn').addEventListener('click', async () => {
    // 先にすべて確かめてから保存する
    const entries = [];
    for (let slot = 1; slot <= slots; slot++) {
      const card = el.querySelector(`[data-slot="${slot}"]`);
      const data = { slot };
      for (const f of VITAL_FIELDS) {
        const v = parseNum(card.querySelector(`[name="${f.key}"]`).value);
        if (Number.isNaN(v)) {
          toast(`${slot}回目の${f.label}は、数字で入力してね`);
          return;
        }
        data[f.key] = v;
      }
      entries.push({ slot, data, time: card.querySelector('[name="time"]').value });
    }

    const now = localDateTime();
    for (const { slot, data, time } of entries) {
      const r = bySlot.get(slot);
      const empty = VITAL_FIELDS.every((f) => data[f.key] == null);
      if (empty) {
        if (r) await deleteRecord(r.id);
        continue;
      }
      const at = `${date}T${time || (r ? timeOf(r.at) : date === now.slice(0, 10) ? timeOf(now) : OTHER_DAY_TIME)}`;
      if (r) {
        r.data = data;
        r.at = at;
        await saveRecord(r);
      } else {
        await saveRecord(newRecord('vital', data, at));
      }
    }
    toast('保存しました');
    renderVital(el, [date], isStale);
  });
}
