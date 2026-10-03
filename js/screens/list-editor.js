// 一覧の編集(追加・名前の変更・削除・ドラッグでの並び替え)
// 体調の選択肢・薬の登録で使う。フェーズ3のお題・落ち着くことリストでも使える。

import { getChoices, addChoice, updateChoice, deleteChoice, reorderChoices } from '../choices.js';
import { makeSortable } from '../drag-sort.js';
import { parseNum } from '../components.js';
import { openDialog, confirmDialog, toast } from '../ui.js';
import { esc } from '../util.js';

// sections: [{ list, title, itemName, withLimit }]
//   itemName … ダイアログの見出しに使う呼び名(例:「選択肢」「薬」)
//   withLimit … 薬の「1日の上限回数」欄を出す
export async function renderListEditor(el, sections, isStale, note = '') {
  const lists = await Promise.all(sections.map((s) => getChoices(s.list)));
  if (isStale()) return;
  const rerender = () => renderListEditor(el, sections, isStale, note);

  el.innerHTML = `
    ${note ? `<p class="hint hint-top">${note}</p>` : ''}
    ${sections.map((s, i) => `
      <section class="group" data-list="${esc(s.list)}">
        ${s.title ? `<h2 class="section-title">${esc(s.title)}</h2>` : ''}
        <div class="card rows sort-list">
          ${lists[i].map((c) => `
            <div class="row edit-row" data-id="${esc(c.id)}">
              <button type="button" class="edit-main" data-act="edit">
                ${esc(c.label)}
                ${s.withLimit ? `<span class="rec-sub">${c.limitPerDay != null ? `1日${c.limitPerDay}回まで` : '上限なし'}</span>` : ''}
              </button>
              <button type="button" class="drag-handle" aria-label="${esc(c.label)}を並び替え(つかんで上下に動かす)">≡</button>
            </div>`).join('') || '<div class="row muted">まだありません</div>'}
        </div>
        <button type="button" class="btn btn-block mt" data-act="add">＋ ${esc(s.itemName)}を追加</button>
      </section>`).join('')}
  `;

  el.querySelectorAll('[data-list]').forEach((sec, i) => {
    const s = sections[i];
    const items = lists[i];
    sec.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.closest('[data-id]')?.dataset.id;
      const item = items.find((c) => c.id === id);
      switch (btn.dataset.act) {
        case 'add':
          if (!(await editItem(s, items, null))) return;
          break;
        case 'edit':
          if (!(await editItem(s, items, item))) return;
          break;
        default:
          return;
      }
      rerender();
    });

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

// 追加・変更・削除のダイアログ。何か変えたら true
async function editItem(s, items, item) {
  const limitField = s.withLimit ? `
    <label class="field">
      <span class="field-label">1日の上限回数(空欄なら上限なし)</span>
      <span class="with-unit"><input type="text" class="input" name="limit" inputmode="numeric" autocomplete="off" value="${esc(item?.limitPerDay ?? '')}"><span class="unit">回</span></span>
    </label>` : '';

  const { value, el } = await openDialog({
    title: item ? `${s.itemName}を編集` : `${s.itemName}を追加`,
    body: `
      <label class="field">
        <span class="field-label">名前</span>
        <input type="text" class="input" name="label" autocomplete="off" value="${esc(item?.label ?? '')}">
      </label>
      ${limitField}
      ${item ? '<p class="hint">名前を変えたり削除したりしても、これまでの記録はそのまま残ります。</p>' : ''}`,
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
      if (s.withLimit) {
        const n = parseNum(d.querySelector('[name="limit"]').value);
        if (n != null && !(Number.isInteger(n) && n > 0)) return '上限回数は1以上の数字で入れてね';
      }
      return null;
    },
  });

  if (value === 'save') {
    const label = el.querySelector('[name="label"]').value.trim();
    const extra = s.withLimit ? { limitPerDay: parseNum(el.querySelector('[name="limit"]').value) } : {};
    if (item) await updateChoice({ ...item, label, ...extra });
    else await addChoice(s.list, label, extra);
    toast(item ? '保存しました' : '追加しました');
    return true;
  }
  if (value === 'delete') {
    const ok = await confirmDialog({
      title: `「${item.label}」を削除しますか?`,
      message: 'これまでの記録は残ります。',
      ok: '削除する',
      danger: true,
    });
    if (!ok) return false;
    await deleteChoice(item.id);
    toast('削除しました');
    return true;
  }
  return false;
}
