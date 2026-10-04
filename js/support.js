// 「しんどい」「とてもしんどい」を記録したときの支え(3-1の連携)
// 落ち着くことリストと信号機へのリンクを、画面の下から小さく出す。
// すぐ閉じられる(「とじる」・外側のタップ・戻る操作)。何かをするよう求める言い方はしない。

import { getChoices } from './choices.js';
import { LISTS, moodLabel } from './constants.js';
import { href } from './router.js';
import { openDialog } from './ui.js';
import { esc } from './util.js';
import { editLinkHtml, headRowHtml } from './components.js';

export async function onToughMood(level) {
  const calm = await getChoices(LISTS.calm);

  const body = calm.length
    ? `${headRowHtml('<p class="small muted">よかったら(落ち着くことリスト)</p>', editLinkHtml('', 'リストを編集', { button: true, attrs: 'data-value="calm"' }))}
       <ul class="calm-list">${calm.map((c) => `<li>${esc(c.label)}</li>`).join('')}</ul>`
    : '<p class="small">ほっとできることを<button type="button" class="text-link" data-value="calm">落ち着くことリスト</button>に書いておくと、ここに出てきます。</p>';

  const { value } = await openDialog({
    title: `「${moodLabel(level)}」を記録しました`,
    body,
    sheet: true,
    buttons: [
      { label: 'とじる' },
      { label: '🚦 信号機', value: 'signal', cls: 'btn-primary' },
    ],
  });
  if (value === 'signal') location.hash = href('signal');
  if (value === 'calm') location.hash = href('calm');
}
