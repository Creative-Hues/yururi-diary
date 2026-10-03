// 記録を直す・削除するダイアログ(気分・服薬で使う)

import { saveRecord, deleteRecord } from './db.js';
import { openDialog, confirmDialog, toast } from './ui.js';
import { datetimeField, readAt } from './components.js';

// 保存・削除したら true を返す。apply(el) で入力内容を rec.data に反映する。
export async function editRecordDialog({ title, rec, body = '', onMount, apply, atLabel = '日時' }) {
  const { value, el } = await openDialog({
    title,
    body: body + datetimeField(rec.at, atLabel),
    buttons: [
      { label: '削除', value: 'delete', cls: 'btn-ghost-danger' },
      { label: 'やめる' },
      { label: '保存', value: 'save', cls: 'btn-primary' },
    ],
    onMount,
  });
  if (value === 'save') {
    apply?.(el);
    rec.at = readAt(el, rec.at);
    await saveRecord(rec);
    toast('保存しました');
    return true;
  }
  if (value === 'delete') return deleteRecordWithConfirm(rec);
  return false;
}

export async function deleteRecordWithConfirm(rec) {
  const ok = await confirmDialog({
    title: 'この記録を削除しますか?',
    message: '削除すると、もとに戻せません。',
    ok: '削除する',
    danger: true,
  });
  if (!ok) return false;
  await deleteRecord(rec.id);
  toast('削除しました');
  return true;
}
