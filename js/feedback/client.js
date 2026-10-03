// 不具合報告の部品:中継サーバーとのやりとり・匿名ID・送った報告の保存
// この js/feedback フォルダは、ほかのアプリ(ひとつやね など)にもそのままコピーして使える。
// アプリごとに違うものは、createFeedback(options) の options で渡す。

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function newUuid() {
  if (self.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// 本人向けのエラーの文
export const ERROR_TEXT = {
  daily_limit: '本日の送信上限(5件)に達しました',
  blocked: 'いまは送信できません',
  busy: 'いま送信が混み合っています。時間をおいて送ってください',
  missing_fields: '入力されていない項目があります',
  append_not_allowed: 'この報告には、いまは追記できません',
  network: '送信できませんでした。インターネットにつながっているか確かめてください',
  default: '送信できませんでした。時間をおいて、もう一度お試しください',
};

export class FeedbackError extends Error {
  constructor(code) {
    super(ERROR_TEXT[code] ?? ERROR_TEXT.default);
    this.code = code;
  }
}

// options:
//   appId       中継サーバーに登録したアプリの ID(例:'yururi-diary')
//   appName     アプリの名前
//   appVersion  アプリのバージョン
//   relayUrl    中継サーバーの URL
//   screens     「起きた画面・機能」の選択肢(文字の配列)
//   storage     { get(key), set(key, value) }(端末の中に保存する場所。Promise を返してよい)
//   anonIdKey   匿名IDを保存するキー(初期値 'anonId')
//   ui          { toast(text), confirm({ title, message, ok, cancel }) }
export function createFeedback(options) {
  const { appId, relayUrl, storage } = options;
  const anonIdKey = options.anonIdKey ?? 'anonId';
  const cacheKey = 'feedback';

  // 匿名ID:初回に端末の中で作って保存する。アプリのデータを消すと変わる。
  async function anonId() {
    let id = await storage.get(anonIdKey);
    if (!UUID.test(id ?? '')) {
      id = newUuid();
      await storage.set(anonIdKey, id);
    }
    return id;
  }

  async function request(method, path, body) {
    let res;
    try {
      res = await fetch(`${relayUrl}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new FeedbackError('network');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new FeedbackError(data.error);
    return data;
  }

  // 送った報告の控え(返信を見たかどうか・最後に読み込んだ一覧)
  async function cache() {
    return { reports: [], seen: {}, fetchedAt: null, ...((await storage.get(cacheKey)) ?? {}) };
  }
  async function saveCache(patch) {
    const next = { ...(await cache()), ...patch };
    await storage.set(cacheKey, next);
    return next;
  }

  return {
    options,
    anonId,

    async send(report) {
      const result = await request('POST', '/v1/reports', { ...report, app: appId, anonId: await anonId() });
      const c = await cache();
      await saveCache({ reports: [{ number: result.number, title: report.title, kind: report.kind, status: 'received', replies: [], appends: [], createdAt: new Date().toISOString() }, ...c.reports] });
      return result;
    },

    // 中継サーバーから最新の状態を読み込む(つながらなければ控えを返す)
    async list() {
      try {
        const id = await anonId();
        const { reports } = await request('GET', `/v1/reports?app=${encodeURIComponent(appId)}&anonId=${id}`);
        await saveCache({ reports, fetchedAt: new Date().toISOString() });
        return { reports, offline: false };
      } catch (e) {
        return { reports: (await cache()).reports, offline: true, error: e };
      }
    },

    async append(number, text) {
      return request('POST', `/v1/reports/${number}/append`, { app: appId, anonId: await anonId(), text });
    },

    // まだ見ていない返信の数
    async unseenCount() {
      const c = await cache();
      return c.reports.reduce((n, r) => n + Math.max(0, (r.replies?.length ?? 0) - (c.seen[r.number] ?? 0)), 0);
    },
    async isNew(report) {
      return (report.replies?.length ?? 0) > ((await cache()).seen[report.number] ?? 0);
    },
    async markSeen(reports) {
      const c = await cache();
      const seen = { ...c.seen };
      for (const r of reports) seen[r.number] = r.replies?.length ?? 0;
      await saveCache({ seen });
    },
    async hasSent() {
      return (await cache()).reports.length > 0;
    },
    async lastFetchedAt() {
      return (await cache()).fetchedAt;
    },
  };
}

// 自動で付ける情報(OS・ブラウザ・ホーム画面から開いているか)と、機種の候補
export async function collectEnv() {
  const ua = navigator.userAgent;
  let os = '';
  let model = '';
  try {
    const hints = await navigator.userAgentData?.getHighEntropyValues?.(['platformVersion', 'model']);
    if (hints) {
      os = `${navigator.userAgentData.platform} ${hints.platformVersion ?? ''}`.trim();
      model = hints.model ?? '';
    }
  } catch { /* 使えないブラウザもある */ }
  if (!os) {
    const ios = ua.match(/OS (\d+)_(\d+)(?:_(\d+))? like Mac OS X/);
    const android = ua.match(/Android ([\d.]+)/);
    os = ios ? `iOS ${ios[1]}.${ios[2]}${ios[3] ? `.${ios[3]}` : ''}` : android ? `Android ${android[1]}` : navigator.platform ?? '';
  }
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return { os, ua, standalone, model };
}
