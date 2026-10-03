// 体調の選択肢・薬の登録

import { LISTS } from '../constants.js';
import { renderListEditor } from './list-editor.js';

export function renderEditCondition(el, params, isStale) {
  return renderListEditor(el, [
    { list: LISTS.body, title: '身体', itemName: '選択肢' },
    { list: LISTS.mind, title: '心', itemName: '選択肢' },
  ], isStale, '名前をタップすると変更・削除、右の「≡」をつかんで上下に動かすと並び替えができます。');
}

export function renderEditMedicine(el, params, isStale) {
  return renderListEditor(el, [
    { list: LISTS.medicine, title: '', itemName: '薬', withLimit: true },
  ], isStale, '名前をタップすると変更・削除、右の「≡」をつかんで上下に動かすと並び替えができます。');
}
