// ロック(3-11):パスコード・指紋認証(WebAuthn)
//
// 設定は meta ストアの 'lock' に置く(端末ごとの情報なので、バックアップには入れない)。
//   → パスコードを忘れたときは、アプリのデータを消してバックアップを読み込めば、ロックなしで戻せる。
//   → 指紋の登録は、その端末でしか使えないため、ほかの端末に持っていっても意味がない。
//
// これは「のぞき見を防ぐ」ためのロック。データ自体は暗号化していないので、
// 端末を分解・解析できる人や、開発者ツールを使える人からは守れない(説明は docs/lock.md)。

import { getMeta, setMeta } from './db.js';

export const LOCK_NOTE = 'のぞき見を防ぐためのロックです。パスコードを忘れると開けなくなるので、バックアップを取っておいてください。';
export const PASSCODE_LENGTH = 4;

// アプリから離れて戻ったとき、ロックするまでの時間(分)
export const TIMEOUT_OPTIONS = [1, 3, 5, 10, 30];
export const DEFAULT_TIMEOUT_MIN = 5;

// まちがえたとき:5回ごとに少し待つ(30秒 → 1分 → 5分、それ以降は5分)。開けなくなることはない
export const FAILS_PER_WAIT = 5;
const WAIT_STEPS_SEC = [30, 60, 300];

const ITERATIONS = 150000;
const DEFAULTS = {
  enabled: false,
  hash: null,
  salt: null,
  iterations: ITERATIONS,
  credentialId: null,
  timeoutMin: DEFAULT_TIMEOUT_MIN,
  failCount: 0,
  waitUntil: null,
};

export async function getLock() {
  return { ...DEFAULTS, ...(await getMeta('lock')) };
}

async function saveLock(patch) {
  const next = { ...(await getLock()), ...patch, updatedAt: new Date().toISOString() };
  await setMeta('lock', next);
  return next;
}

// ---- パスコード(PBKDF2-SHA256 でハッシュにして保存。そのままは保存しない) ----

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

export const cryptoAvailable = () => !!self.crypto?.subtle;

async function hashPasscode(code, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
    key,
    256,
  );
  return toHex(bits);
}

export async function setPasscode(code) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPasscode(code, salt, ITERATIONS);
  return saveLock({ enabled: true, hash, salt, iterations: ITERATIONS, failCount: 0, waitUntil: null });
}

// 待ち時間中なら残りミリ秒、そうでなければ 0
export function waitLeft(lock, now = Date.now()) {
  return lock.waitUntil ? Math.max(0, new Date(lock.waitUntil).getTime() - now) : 0;
}

// { ok, waitMs:待ち時間, untilWait:あと何回まちがえると待つか }
export async function verifyPasscode(code) {
  const lock = await getLock();
  const left = waitLeft(lock);
  if (left > 0) return { ok: false, waitMs: left };
  const hash = await hashPasscode(code, lock.salt, lock.iterations);
  if (hash === lock.hash) {
    if (lock.failCount || lock.waitUntil) await saveLock({ failCount: 0, waitUntil: null });
    return { ok: true };
  }
  const failCount = lock.failCount + 1;
  let waitUntil = null;
  if (failCount % FAILS_PER_WAIT === 0) {
    const step = Math.min(failCount / FAILS_PER_WAIT, WAIT_STEPS_SEC.length) - 1;
    waitUntil = new Date(Date.now() + WAIT_STEPS_SEC[step] * 1000).toISOString();
  }
  await saveLock({ failCount, waitUntil });
  return {
    ok: false,
    waitMs: waitUntil ? new Date(waitUntil).getTime() - Date.now() : 0,
    untilWait: FAILS_PER_WAIT - (failCount % FAILS_PER_WAIT),
  };
}

export function disableLock() {
  return saveLock({ enabled: false, hash: null, salt: null, credentialId: null, failCount: 0, waitUntil: null });
}

export function setTimeoutMin(min) {
  return saveLock({ timeoutMin: min });
}

// ---- 指紋認証(WebAuthn・端末の生体認証) ----
// サーバーがないので署名の検証はせず、「その端末で本人確認(指紋など)が通った」ことだけを確かめる。

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const random = (n) => crypto.getRandomValues(new Uint8Array(n));

// 端末の生体認証(または画面ロック)で本人確認できる認証器があるか
export async function bioAvailable() {
  try {
    return !!(window.PublicKeyCredential && cryptoAvailable()
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export async function registerBio() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: 'ゆる〜り日記' },
      user: { id: random(16), name: 'yururi-diary', displayName: 'ゆる〜り日記' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  });
  return saveLock({ credentialId: b64url(cred.rawId) });
}

export function removeBio() {
  return saveLock({ credentialId: null });
}

// 本人確認が通れば true。キャンセルや失敗は例外(NotAllowedError など)
export async function verifyBio() {
  const lock = await getLock();
  if (!lock.credentialId) return false;
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      allowCredentials: [{ type: 'public-key', id: fromB64url(lock.credentialId), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  const sameCred = b64url(cred.rawId) === lock.credentialId;
  const flags = new Uint8Array(cred.response.authenticatorData)[32];
  const userVerified = (flags & 0x04) !== 0; // UV:指紋などで本人確認できた
  if (sameCred && userVerified) {
    if (lock.failCount || lock.waitUntil) await saveLock({ failCount: 0, waitUntil: null });
    return true;
  }
  return false;
}
