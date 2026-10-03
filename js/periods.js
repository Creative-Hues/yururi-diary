// 体調の記録から、カレンダーの帯(お通じ・生理)を求める
// 体調の選択肢は kind で見分ける(名前を変えても大丈夫なように)。docs/data-model.md 参照。

import { getAll } from './db.js';
import { CHOICE_KINDS, PERIOD_REMIND_DAYS } from './constants.js';
import { shiftDate } from './components.js';
import { dateKey, daysSince, parseLocalDateTime } from './util.js';

const itemsOf = (rec, kind) => (rec.data.body ?? []).filter((c) => c.kind === kind);

// お通じの記録がある日(Set<日付>)
export function bowelDays(conditionRecs) {
  return new Set(conditionRecs.filter((r) => itemsOf(r, CHOICE_KINDS.bowel).length).map((r) => r.date));
}

// 生理の期間 [{ start, end, open }](日付は「YYYY-MM-DD」・両端を含む・古い順)
// ・「はじまった」から「おわった」まで。「おわった」がまだなければ今日まで(open: true)。
// ・「おわった」の前にもう一度「はじまった」があれば、前の期間はその前の日までにする。
// ・「はじまった」のない「おわった」は使わない。
export function periodRanges(conditionRecs, today = dateKey()) {
  const events = conditionRecs
    .flatMap((r) => itemsOf(r, CHOICE_KINDS.period).filter((c) => c.phase).map((c) => ({ at: r.at, date: r.date, phase: c.phase })))
    .sort((a, b) => a.at.localeCompare(b.at));
  const ranges = [];
  let cur = null;
  for (const e of events) {
    if (e.phase === 'start') {
      if (cur) {
        cur.end = e.date > cur.start ? shiftDate(e.date, -1) : cur.start;
        ranges.push(cur);
      }
      cur = { start: e.date, end: null, open: false };
    } else if (e.phase === 'end' && cur && e.date >= cur.start) {
      cur.end = e.date;
      ranges.push(cur);
      cur = null;
    }
  }
  if (cur) ranges.push({ ...cur, end: cur.start > today ? cur.start : today, open: true });
  return ranges;
}

export const getConditionRecords = () => getAll('records', 'type', 'condition');

// ホームのお知らせ:「はじまった」から PERIOD_REMIND_DAYS 日以上たっても「おわった」がない期間
export async function longOpenPeriod() {
  const open = periodRanges(await getConditionRecords()).find((r) => r.open);
  if (!open) return null;
  const days = daysSince(parseLocalDateTime(`${open.start}T00:00`));
  return days >= PERIOD_REMIND_DAYS ? { ...open, days } : null;
}
