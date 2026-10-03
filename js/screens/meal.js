// 食事の記録(3-3)
// #/meal/<YYYY-MM-DD> … 見る画面(その日の記録をカードで並べる。日付なしは今日)
// #/meal-new/<YYYY-MM-DD> … 入力画面(新しく記録)
// #/meal-edit/<id> … 入力画面(直す・削除)

import { get, getRecordsByType, newRecord, saveRecord } from '../db.js';
import { MEAL_SLOTS } from '../constants.js';
import { dayNavHtml, bindDayNav, isDateKey, timeOf, datetimeField, readAt } from '../components.js';
import { deleteRecordWithConfirm } from '../record-dialog.js';
import { href, guardLeave } from '../router.js';
import { toast } from '../ui.js';
import { dateKey, esc, localDateTime } from '../util.js';

const slotIndex = (slot) => MEAL_SLOTS.findIndex((s) => s.slot === slot);
const slotInfo = (slot) => MEAL_SLOTS[slotIndex(slot)] ?? MEAL_SLOTS[0];

// 朝・昼・晩の順、同じなら時刻順
const sortMeals = (rows) => rows.sort((a, b) =>
  slotIndex(a.data.slot) - slotIndex(b.data.slot) || a.at.localeCompare(b.at));

// ---- 見る画面 ----

export async function renderMeal(el, [dateParam], isStale) {
  const date = isDateKey(dateParam) ? dateParam : dateKey();
  const rows = sortMeals(await getRecordsByType('meal', date, date));
  if (isStale()) return;

  el.innerHTML = `
    ${dayNavHtml(date)}
    <a class="btn btn-primary btn-block add-btn" href="${href('meal-new', date)}">＋ 記録する</a>
    ${rows.length ? rows.map((r) => `
      <a class="card view-card" href="${href('meal-edit', r.id)}">
        <div class="card-head">
          <span class="card-title">${slotInfo(r.data.slot).label}</span>
          <span class="card-time">${timeOf(r.at)}<span class="chev" aria-hidden="true">›</span></span>
        </div>
        <p class="view-text">${esc(r.data.text)}</p>
      </a>`).join('') : `<p class="empty">${date === dateKey() ? '今日' : 'この日'}の記録はまだありません</p>`}
  `;

  bindDayNav(el, date, (next) => location.replace(href('meal', next)));
}

// ---- 入力画面 ----

export async function renderMealNew(el, [dateParam], isStale) {
  const date = isDateKey(dateParam) ? dateParam : dateKey();
  const rows = await getRecordsByType('meal', date, date);
  if (isStale()) return;
  // 今日なら今の時間帯、ほかの日ならまだ書いていない食事を選んでおく
  const hour = new Date().getHours();
  const slot = date === dateKey()
    ? (hour < 10 ? 'breakfast' : hour < 15 ? 'lunch' : 'dinner')
    : (MEAL_SLOTS.find((s) => !rows.some((r) => r.data.slot === s.slot)) ?? MEAL_SLOTS[0]).slot;
  return mealForm(el, { date, slot });
}

export async function renderMealEdit(el, [id], isStale) {
  const rec = await get('records', id);
  if (isStale()) return;
  if (rec?.type !== 'meal') {
    el.innerHTML = '<div class="card"><p>この記録は見つかりませんでした。</p></div>';
    return;
  }
  return mealForm(el, { rec, date: rec.date, slot: rec.data.slot });
}

function mealForm(el, { rec = null, date, slot }) {
  const isToday = date === dateKey();
  const initialAt = rec?.at ?? (isToday ? localDateTime() : `${date}T${slotInfo(slot).defaultTime}`);

  el.innerHTML = `
    <div class="card">
      <div class="field">
        <span class="field-label">いつの食事?</span>
        <div class="seg-row">
          ${MEAL_SLOTS.map((s) => `<button type="button" class="seg-btn" data-slot="${s.slot}" aria-pressed="${s.slot === slot}">${s.label}</button>`).join('')}
        </div>
      </div>
      <label class="field">
        <span class="field-label">食べたもの</span>
        <textarea class="input" name="text" rows="4">${esc(rec?.data.text ?? '')}</textarea>
      </label>
      ${datetimeField(initialAt)}
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-block" id="save-btn">保存する</button>
      ${rec ? '<button type="button" class="btn btn-ghost-danger btn-block" id="delete-btn">この記録を削除</button>' : ''}
    </div>
  `;

  let dirty = false;
  // ほかの日の新しい記録で、時刻をまだ触っていなければ、朝・昼・晩に合わせて時刻を変える
  let timeTouched = !!rec || isToday;
  const atInput = el.querySelector('[name="at"]');
  el.querySelector('[name="text"]').addEventListener('input', () => { dirty = true; });
  atInput.addEventListener('input', () => { dirty = true; timeTouched = true; });
  atInput.addEventListener('change', () => { dirty = true; timeTouched = true; });
  el.querySelectorAll('.seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      slot = b.dataset.slot;
      dirty = true;
      el.querySelectorAll('.seg-btn').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (!timeTouched) atInput.value = `${date}T${slotInfo(slot).defaultTime}`;
    });
  });

  const guard = guardLeave(() => dirty);

  el.querySelector('#save-btn').addEventListener('click', async () => {
    const text = el.querySelector('[name="text"]').value.trim();
    if (!text) {
      toast('食べたものを書いてね');
      return;
    }
    const at = readAt(el, initialAt);
    if (rec) {
      rec.data = { ...rec.data, slot, text };
      rec.at = at;
      await saveRecord(rec);
    } else {
      await saveRecord(newRecord('meal', { slot, text }, at));
    }
    await guard.leave(href('meal', at.slice(0, 10)));
    toast('保存しました');
  });

  el.querySelector('#delete-btn')?.addEventListener('click', async () => {
    if (await deleteRecordWithConfirm(rec)) await guard.leave(href('meal', rec.date));
  });

  return guard.release;
}
