// 一覧の編集(追加・名前の変更・削除・ドラッグでの並び替え・選んでまとめて削除)
// 本人が追加・削除できる一覧(choices)はすべてこれを使う:体調の選択肢・薬・日記のお題と書き出し・落ち着くことリスト・相談メモのタグ。
//
// 「選んで削除」:押すと、その一覧の各行にチェックが出る。選んでいる間は「≡」の並び替えとタップでの編集はお休み。
// 「○件を削除」で確認してから、まとめて消す。消しても、これまでの記録の表示はそのまま(記録には名前を残しているため)。

import { getChoices, addChoice, updateChoice, deleteChoice, deleteChoices, reorderChoices } from '../choices.js';
import { makeSortable } from '../drag-sort.js';
import { openDialog, confirmDialog, toast } from '../ui.js';
import { esc } from '../util.js';

// kind を持つ選択肢(体調の「お通じ」「生理」)の説明
const KIND_NOTES = {
  bowel: 'カレンダーに 💩 と帯で出ます',
  period: 'カレンダーに 🌸 と帯で出ます',
};
const DEFAULT_EDIT_NOTE = '名前を変えたり削除したりしても、これまでの記録はそのまま残ります。';
const DEFAULT_DELETE_NOTE = 'これまでの記録は残ります。';

// 消すものに「お通じ」「生理」が入っていたら、カレンダーに出なくなることを伝える一文
// (記録には kind を残しているので、これまでの記録の 💩・🌸 と帯はカレンダーに残る)
function kindWarning(items) {
  const names = items.filter((c) => c.kind && KIND_NOTES[c.kind]).map((c) => `「${c.label}」`);
  return names.length
    ? `\n${names.join('')}を削除すると、これから記録できなくなるので、カレンダーにも出なくなります(これまでの記録の印はカレンダーに残ります)。`
    : '';
}

// sections: [{ list, title, itemName, sub, editNote, deleteNote, editHref }]
//   itemName … ダイアログの見出しに使う呼び名(例:「選択肢」「薬」)
//   sub(item) … 名前の下に出す説明(例:薬の上限回数)
//   editNote / deleteNote … 編集・削除のダイアログの説明(初期は「これまでの記録は残ります」)
//   editHref(item|null) … ダイアログではなく、別の入力画面で追加・編集するとき(薬)
// state … { selecting: 選んでいる一覧の list 名, picked: Set<id> }(描き直しても選んだものを覚えておく)
export async function renderListEditor(el, sections, isStale, note = '', state = { selecting: null, picked: new Set() }) {
  const lists = await Promise.all(sections.map((s) => getChoices(s.list)));
  if (isStale()) return;
  const rerender = () => renderListEditor(el, sections, isStale, note, state);

  const rowHtml = (s, c, selecting) => {
    const subs = [
      c.kind && KIND_NOTES[c.kind] ? KIND_NOTES[c.kind] : '',
      s.sub?.(c) ?? '',
    ].filter(Boolean).map((t) => `<span class="rec-sub">${esc(t)}</span>`).join('');
    if (selecting) {
      return `
        <label class="row edit-row select-row" data-id="${esc(c.id)}">
          <input type="checkbox" class="select-check" ${state.picked.has(c.id) ? 'checked' : ''}>
          <span class="edit-main">${esc(c.label)}${subs}</span>
        </label>`;
    }
    return `
      <div class="row edit-row" data-id="${esc(c.id)}">
        <button type="button" class="edit-main" data-act="edit">${esc(c.label)}${subs}</button>
        <button type="button" class="drag-handle" aria-label="${esc(c.label)}を並び替え(つかんで上下に動かす)">≡</button>
      </div>`;
  };

  el.innerHTML = `
    ${note ? `<p class="hint hint-top">${note}</p>` : ''}
    ${sections.map((s, i) => {
      const items = lists[i];
      const selecting = state.selecting === s.list;
      const otherSelecting = state.selecting && !selecting;
      return `
        <section class="group${selecting ? ' is-selecting' : ''}" data-list="${esc(s.list)}">
          <div class="list-head">
            ${s.title ? `<h2 class="section-title">${esc(s.title)}</h2>` : '<span></span>'}
            ${items.length && !selecting && !otherSelecting ? '<button type="button" class="btn btn-small" data-act="select">選んで削除</button>' : ''}
          </div>
          ${selecting ? `
            <div class="select-bar">
              <button type="button" class="btn btn-small" data-act="all">${items.every((c) => state.picked.has(c.id)) ? 'すべて外す' : 'すべて選ぶ'}</button>
              <button type="button" class="btn btn-small" data-act="cancel">選ぶのをやめる</button>
            </div>` : ''}
          <div class="card rows sort-list">
            ${items.map((c) => rowHtml(s, c, selecting)).join('') || '<div class="row muted">まだありません</div>'}
          </div>
          ${selecting
            ? `<button type="button" class="btn btn-danger btn-block mt" data-act="delete-picked" ${state.picked.size ? '' : 'disabled'}>${state.picked.size}件を削除</button>`
            : `<button type="button" class="btn btn-block mt" data-act="add" ${otherSelecting ? 'disabled' : ''}>＋ ${esc(s.itemName)}を追加</button>`}
        </section>`;
    }).join('')}
  `;

  el.querySelectorAll('[data-list]').forEach((sec, i) => {
    const s = sections[i];
    const items = lists[i];

    // チェックを付けたり外したりしたときは、描き直さずに数とボタンだけ変える
    const refreshCount = () => {
      const del = sec.querySelector('[data-act="delete-picked"]');
      if (del) {
        del.textContent = `${state.picked.size}件を削除`;
        del.disabled = !state.picked.size;
      }
      const all = sec.querySelector('[data-act="all"]');
      if (all) all.textContent = items.every((c) => state.picked.has(c.id)) ? 'すべて外す' : 'すべて選ぶ';
    };
    sec.querySelectorAll('.select-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.closest('[data-id]').dataset.id;
        if (cb.checked) state.picked.add(id);
        else state.picked.delete(id);
        refreshCount();
      });
    });

    sec.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || btn.disabled) return;
      const id = btn.closest('[data-id]')?.dataset.id;
      const item = items.find((c) => c.id === id);
      switch (btn.dataset.act) {
        case 'select':
          state.selecting = s.list;
          state.picked = new Set();
          break;
        case 'cancel':
          state.selecting = null;
          state.picked = new Set();
          break;
        case 'all':
          state.picked = items.every((c) => state.picked.has(c.id)) ? new Set() : new Set(items.map((c) => c.id));
          sec.querySelectorAll('.select-check').forEach((cb) => { cb.checked = state.picked.has(cb.closest('[data-id]').dataset.id); });
          refreshCount();
          return;
        case 'delete-picked':
          if (!(await deletePicked(s, items.filter((c) => state.picked.has(c.id))))) return;
          state.selecting = null;
          state.picked = new Set();
          break;
        case 'add':
          if (s.editHref) {
            location.hash = s.editHref(null);
            return;
          }
          if (!(await editItem(s, items, null))) return;
          break;
        case 'edit':
          if (s.editHref) {
            location.hash = s.editHref(item);
            return;
          }
          if (!(await editItem(s, items, item))) return;
          break;
        default:
          return;
      }
      rerender();
    });

    // 選んでいる間は「≡」がないので、並び替えは起きない
    makeSortable(sec.querySelector('.sort-list'), {
      itemSelector: '.edit-row',
      handleSelector: '.drag-handle',
      async onSort(ids) {
        await reorderChoices(s.list, ids);
        rerender();
      },
    });
  });
}

// 選んだものをまとめて削除する。消したら true
async function deletePicked(s, picked) {
  if (!picked.length) return false;
  const names = picked.slice(0, 8).map((c) => `・${c.label}`).join('\n') + (picked.length > 8 ? `\nほか${picked.length - 8}件` : '');
  const ok = await confirmDialog({
    title: `${picked.length}件を削除しますか?`,
    message: `${names}\n\n${s.deleteNote ?? DEFAULT_DELETE_NOTE}${kindWarning(picked)}`,
    ok: `${picked.length}件を削除`,
    danger: true,
  });
  if (!ok) return false;
  await deleteChoices(picked.map((c) => c.id));
  toast(`${picked.length}件を削除しました`);
  return true;
}

// 1つ削除する(確認つき)。消したら true。薬の入力画面からも使う
export async function deleteOneWithConfirm(item, deleteNote = DEFAULT_DELETE_NOTE) {
  const ok = await confirmDialog({
    title: `「${item.label}」を削除しますか?`,
    message: deleteNote + kindWarning([item]),
    ok: '削除する',
    danger: true,
  });
  if (!ok) return false;
  await deleteChoice(item.id);
  toast('削除しました');
  return true;
}

// 追加・変更・削除のダイアログ(名前だけの一覧)。何か変えたら true
async function editItem(s, items, item) {
  const { value, el } = await openDialog({
    title: item ? `${s.itemName}を編集` : `${s.itemName}を追加`,
    body: `
      <label class="field">
        <span class="field-label">名前</span>
        <input type="text" class="input" name="label" autocomplete="off" value="${esc(item?.label ?? '')}">
      </label>
      ${item ? `<p class="hint">${esc(s.editNote ?? DEFAULT_EDIT_NOTE)}</p>` : ''}`,
    buttons: [
      ...(item ? [{ label: '削除', value: 'delete', cls: 'btn-ghost-danger' }] : []),
      { label: 'やめる' },
      { label: item ? '保存' : '追加', value: 'save', cls: 'btn-primary' },
    ],
    validate(v, d) {
      if (v !== 'save') return null;
      const label = d.querySelector('[name="label"]').value.trim();
      if (!label) return '名前を入れてね';
      if (items.some((c) => c.label === label && c.id !== item?.id)) return '同じ名前がすでにあります';
      return null;
    },
  });

  if (value === 'save') {
    const label = el.querySelector('[name="label"]').value.trim();
    if (item) await updateChoice({ ...item, label });
    else await addChoice(s.list, label);
    toast(item ? '保存しました' : '追加しました');
    return true;
  }
  if (value === 'delete') return deleteOneWithConfirm(item, s.deleteNote);
  return false;
}
