// 小さな共通関数

export const pad2 = (n) => String(n).padStart(2, '0');

// 端末の時刻で「YYYY-MM-DD」(日付の区切りは0時)
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 端末の時刻で「YYYY-MM-DDTHH:mm」(<input type="datetime-local"> と同じ形)
export function localDateTime(d = new Date()) {
  return `${dateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function parseLocalDateTime(s) {
  const [datePart, timePart = '00:00'] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function formatDateJa(d) {
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
}

// 24時間表示
export function formatDateTimeJa(d) {
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export const nowIso = () => new Date().toISOString();

// 日付(0時区切り)で数えた経過日数
export function daysSince(iso, now = new Date()) {
  const a = new Date(iso);
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end - start) / 86400000);
}

// crypto.randomUUID は https / localhost でしか使えないため、予備を用意
export function uuid() {
  if (self.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
