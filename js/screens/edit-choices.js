// 本人が追加・削除できる一覧(体調の選択肢・薬の登録・薬の飲むタイミング・日記のお題と書き出し・相談メモのタグ・落ち着くことリスト)
// どれも list-editor.js の「選んで削除」でまとめて消せる

import { LISTS } from '../constants.js';
import { renderListEditor } from './list-editor.js';
import { href } from '../router.js';

const HINT = '名前をタップすると変更・削除、右の「≡」をつかんで上下に動かすと並び替えができます。「選んで削除」で、いくつかまとめて消すこともできます。';

export function renderEditCondition(el, params, isStale) {
  return renderListEditor(el, [
    { list: LISTS.body, title: '身体', itemName: '選択肢' },
    { list: LISTS.mind, title: '心', itemName: '選択肢' },
  ], isStale, HINT);
}

export function renderEditMedicine(el, params, isStale) {
  return renderListEditor(el, [
    {
      list: LISTS.medicine, title: '', itemName: '薬',
      sub: (c) => (c.limitPerDay != null ? `1日${c.limitPerDay}回まで` : '上限なし'),
      // 薬は情報の欄が多いので、ダイアログではなく入力画面(下書きつき)で追加・編集する
      editHref: (c) => (c ? href('medicine-edit', c.id) : href('medicine-new')),
    },
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

// 相談したいことメモのタグ(メモは id でタグを持つので、名前を変えるとメモの表示も変わる)
export function renderEditConsultTags(el, params, isStale) {
  return renderListEditor(el, [
    { list: LISTS.consultTag, title: '', itemName: 'タグ',
      editNote: '名前を変えると、このタグが付いたメモの表示も変わります。',
      deleteNote: 'このタグが付いたメモから、タグが外れます(メモは残ります)。' },
  ], isStale, '「誰に向けたメモか」を分けるタグです。' + HINT);
}

// 薬の飲むタイミングの選択肢(薬は id で持つので、名前を変えると薬の表示も変わる)
export function renderEditMedTimings(el, params, isStale) {
  return renderListEditor(el, [
    { list: LISTS.medTiming, title: '', itemName: '選択肢',
      editNote: '名前を変えると、この選択肢を選んだ薬の表示も変わります。',
      deleteNote: 'この選択肢を選んでいた薬から外れます(薬の登録は残ります)。' },
  ], isStale, '薬の登録で選ぶ「飲むタイミング」の選択肢です。' + HINT);
}

// 落ち着くことリスト(3-8)
export function renderCalm(el, params, isStale) {
  return renderListEditor(el, [
    { list: LISTS.calm, title: '', itemName: 'ほっとできること' },
  ], isStale, 'しんどいときに見返せるよう、ほっとできることを書いておけます。' + HINT);
}
