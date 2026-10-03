// 不具合報告・要望(3-14・4)
// #/feedback      … 報告フォーム
// #/feedback-sent … 送った報告(状態・返信・追記)
// 機能スイッチ(js/config.js の FEATURES.feedback)がオフのときは開けない。

import { renderFeedbackForm } from '../feedback/form.js';
import { renderSentReports } from '../feedback/sent.js';
import { feedback, feedbackEnabled, refreshFeedbackBadge } from '../feedback-setup.js';
import { href, guardLeave } from '../router.js';

const offHtml = '<div class="card"><p>この機能はいまお休み中です。</p></div>';

export function renderFeedback(el, params, isStale) {
  if (isStale()) return;
  if (!feedbackEnabled()) {
    el.innerHTML = offHtml;
    return;
  }
  return renderFeedbackForm(el, feedback, {
    guardLeave,
    // 送れたら、フォームの画面を「送った報告」に置きかえる(戻るで設定に戻る)
    onSent: (guard) => guard.replaceWith(href('feedback-sent')),
  });
}

export async function renderFeedbackSent(el, params, isStale) {
  if (isStale()) return;
  if (!feedbackEnabled()) {
    el.innerHTML = offHtml;
    return;
  }
  await renderSentReports(el, feedback, { newHref: href('feedback'), onSeen: refreshFeedbackBadge });
}
