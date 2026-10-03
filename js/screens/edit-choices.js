// 体調の選択肢・薬の登録

import { LISTS } from '../constants.js';
import { renderListEditor } from './list-editor.js';

const HINT = '名前をタップすると変更・削除、右の「≡」をつかんで上下に動かすと並び替えができます。';

export function renderEditCondition(el, params, isStale) {
  return renderListEditor(el, [
    { list: LISTS.body, title: '身体', itemName: '選択肢' },
    { list: LISTS.mind, title: '心', itemName: '選択肢' },
  ], isStale, HINT);
}

export function renderEditMedicine(el, params, isStale) {
  return renderListEditor(el, [
    { list: LISTS.medicine, title: '', itemName: '薬', withLimit: true },
  ], isStale, HINT);
}

export function renderEditDiary(el, params, isStale) {
  return renderListEditor(el, [
    { list: LISTS.diaryStarter, title: '一日の日記:書き出しの型', itemName: '書き出し' },
    { list: LISTS.diaryPrompt, title: '一日の日記:お題', itemName: 'お題' },
    { list: LISTS.hitokotoStarter, title: 'ひとこと日記:書き出しの型', itemName: '書き出し' },
    { list: LISTS.hitokotoPrompt, title: 'ひとこと日記:お題', itemName: 'お題' },
  ], isStale, HINT);
}

// 落ち着くことリスト(3-8)
export function renderCalm(el, params, isStale) {
  return renderListEditor(el, [
    { list: LISTS.calm, title: '', itemName: 'ほっとできること' },
  ], isStale, 'しんどいときに見返せるよう、ほっとできることを書いておけます。' + HINT);
}
