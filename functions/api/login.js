import {
    createToken,
    jsonResponse,
    getSecret,
    pbkdf2Hex,
    randomSaltB64
} from '../_shared/auth.js';

/**
 * การเปรียบเทียบสตริงที่ปลอดภัยต่อการโจมตีแบบ timing attack
 */
function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

// ตรวจสอบ sha256 ย้อนหลังสำหรับผู้ใช้เวอร์ชันเก่า
async function sha256Hex(str) {
    const data = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ════════════════════════════════════════════════════════════════════════════
 * การจำกัดอัตราการเข้าสู่ระบบ (Rate Limiting)
 * ════════════════════════════════════════════════════════════════════════════ */
const LOCKOUT_PREFIX  = 'lockout:';
const MAX_ATTEMPTS    = 5;
const WINDOW_SECONDS  = 600;
const USERS_KEY       = 'users';
const PBKDF2_ITER     = 100000;

function getClientIP(request) {
    const cf = request.headers.get('CF-Connecting-IP');
    if (cf) return cf.trim();
    const xff = request.headers.get('X-Forwarded-For');
    if (xff) {
        const first = xff.split(',')[0];
        if (first) return first.trim();
    }
    return 'unknown';
}

async function readLockout(env, ip) {
    if (!env.FAV_KV) return null;
    try {
        const r = await env.FAV_KV.getWithMetadata(LOCKOUT_PREFIX + ip, { type: 'text' });
        if (!r || r.value == null) return null;
        const count = parseInt(r.value, 10) || 0;
        const expireAt = (r.metadata && r.metadata.expireAt) || 0;
        return { count, expireAt };
    } catch {
        return null;
    }
}

async function recordFailure(env, ip) {
    if (!env.FAV_KV) return;
    try {
        const cur = await readLockout(env, ip);
        const nowSec = Math.floor(Date.now() / 1000);
        const expireAt = (cur && cur.expireAt && cur.expireAt > nowSec)
            ? cur.expireAt
            : nowSec + WINDOW_SECONDS;
        const ttl = Math.max(1, expireAt - nowSec);
        const next = (cur ? cur.count : 0) + 1;
        await env.FAV_KV.put(LOCKOUT_PREFIX + ip, String(next), {
            expirationTtl: ttl,
            metadata: { expireAt }
        });
    } catch {}
}

async function clearFailure(env, ip) {
    if (!env.FAV_KV) return;
    try { await env.FAV_KV.delete(LOCKOUT_PREFIX + ip); } catch {}
}

/* ════════════════════════════════════════════════════════════════════════════
 * จุดเข้าหลัก (Main handler)
 * ════════════════════════════════════════════════════════════════════════════ */
export async function onRequestPost({ request, env }) {
    // ตรวจสอบอัตราการพยายามเข้าสู่ระบบก่อน
    const ip = getClientIP(request);
    const lock = await readLockout(env, ip);
    if (lock && lock.count >= MAX_ATTEMPTS) {
        const nowSec = Math.floor(Date.now() / 1000);
        const retryAfter = Math.max(1, (lock.expireAt || nowSec) - nowSec);
        return jsonResponse({
            ok: false,
            error: 'พยายามเข้าสู่ระบบผิดพลาดหลายครั้งเกินไป โปรดลองใหม่อีกครั้งในภายหลัง'
        }, 429, { 'Retry-After': String(retryAfter) });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }, 400);
    }

    const { username, password } = body || {};
    if (!username || !password) {
        return jsonResponse({ ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านว่างเปล่า' }, 400);
    }

    const adminUser = env.ADMIN_USER;
    const adminPass = env.ADMIN_PASS;
    if (!adminUser || !adminPass) {
        return jsonResponse({
            ok: false,
            error: 'เซิร์ฟเวอร์ไม่ได้กำหนดค่าตัวแปรสภาพแวดล้อม ADMIN_USER / ADMIN_PASS'
        }, 500);
    }

    const secret = getSecret(env);
    if (!secret) {
        return jsonResponse({
            ok: false,
            error: 'เซิร์ฟเวอร์ไม่ได้กำหนดค่า AUTH_SECRET หรือมีความยาวน้อยกว่า 16 ตัวอักษร'
        }, 500);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // แผนผังการตัดสินใจ:
    //   1. อ่านตาราง users จาก KV
    //   2. หาก users[username] มีอยู่ และ status=active และ รหัสผ่านตรงกัน → เซ็นโทเคนผู้ใช้ KV
    //   3. มิฉะนั้น หาก username === ADMIN_USER และ password === ADMIN_PASS (env) → ทางเลือกสำรอง env-admin
    //      - ทำการ bootstrap users[ADMIN_USER] (หากยังไม่มี)
    //   4. หากไม่ตรงเงื่อนไขใดเลย → 401
    // ──────────────────────────────────────────────────────────────────────────

    // อ่านตาราง users
    let users = {};
    if (env.FAV_KV) {
        try {
            const raw = await env.FAV_KV.get(USERS_KEY);
            if (raw) users = JSON.parse(raw);
        } catch (e) {
            // หากอ่าน KV ล้มเหลว ยังสามารถใช้ env-admin สำรองได้
            users = {};
        }
    }
    const kvUser = users[username];

    // ทางเลือก 1: ผู้ใช้ KV มีอยู่และสถานะ active
    let kvAuthOk = false;
    let kvUserUpgradedFromLegacy = false;
    if (kvUser && kvUser.status !== 'disabled') {
        const isLegacy = !kvUser.salt;
        try {
            let computed;
            if (isLegacy) {
                computed = await sha256Hex(password);
            } else {
                computed = await pbkdf2Hex(password, kvUser.salt, kvUser.iter || PBKDF2_ITER);
            }
            kvAuthOk = timingSafeEqual(computed, kvUser.passHash || '');
            kvUserUpgradedFromLegacy = kvAuthOk && isLegacy;
        } catch {
            kvAuthOk = false;
        }
    }

    if (kvAuthOk) {
        // อัปเกรดผู้ใช้ sha256 เดิมอัตโนมัติ (best-effort)
        if (kvUserUpgradedFromLegacy && env.FAV_KV) {
            try {
                const newSalt = randomSaltB64(16);
                const newHash = await pbkdf2Hex(password, newSalt, PBKDF2_ITER);
                users[username] = {
                    ...kvUser,
                    passHash: newHash,
                    salt: newSalt,
                    iter: PBKDF2_ITER
                };
                await env.FAV_KV.put(USERS_KEY, JSON.stringify(users));
            } catch (e) {
                console.warn('pbkdf2 upgrade failed for', username, e && e.message);
            }
        }

        await clearFailure(env, ip);
        const role = kvUser.role === 'admin' ? 'admin' : 'user';
        const token = await createToken({ u: username, uid: username, role }, secret);
        return jsonResponse({ ok: true, username, role }, 200, {
            'Set-Cookie': `auth=${token}; Path=/; Max-Age=${7 * 86400}; HttpOnly; Secure; SameSite=Strict`
        });
    }

    // ทางเลือก 2: env-admin สำรอง
    const userOk = timingSafeEqual(username, adminUser);
    const passOk = timingSafeEqual(password, adminPass);

    if (!userOk || !passOk) {
        await recordFailure(env, ip);
        return jsonResponse({ ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, 401);
    }

    // env-admin ผ่านการตรวจสอบ: ทำการ bootstrap users[ADMIN_USER]
    if (env.FAV_KV) {
        const needBootstrap = !kvUser
            || !kvUser.salt
            || !kvAuthOk;
        if (needBootstrap) {
            try {
                const newSalt = randomSaltB64(16);
                const newHash = await pbkdf2Hex(password, newSalt, PBKDF2_ITER);
                const nowIso = new Date().toISOString();
                users[username] = {
                    ...(kvUser || {}),
                    passHash: newHash,
                    salt: newSalt,
                    iter: PBKDF2_ITER,
                    role: 'admin',
                    status: 'active',
                    createdAt: (kvUser && kvUser.createdAt) || nowIso,
                    createdBy: (kvUser && kvUser.createdBy) || '__bootstrap__',
                    hasData: (kvUser && kvUser.hasData) || false
                };
                await env.FAV_KV.put(USERS_KEY, JSON.stringify(users));
            } catch (e) {
                console.warn('admin bootstrap failed:', e && e.message);
            }
        }
    }

    await clearFailure(env, ip);
    const token = await createToken({ u: username, uid: username, role: 'admin' }, secret);
    return jsonResponse({ ok: true, username, role: 'admin' }, 200, {
        'Set-Cookie': `auth=${token}; Path=/; Max-Age=${7 * 86400}; HttpOnly; Secure; SameSite=Strict`
    });
}
