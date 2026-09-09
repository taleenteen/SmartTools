// ยูทิลิตีการตรวจสอบสิทธิ์ส่วนกลาง (ไดเรกทอรีที่มี _ นำหน้า Pages จะไม่ถือว่าเป็นเราต์)

const encoder = new TextEncoder();

function b64urlEncode(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
}

async function hmacSign(data, secret) {
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return b64urlEncode(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * อ่าน AUTH_SECRET จากตัวแปรสภาพแวดล้อม
 * หากไม่ได้กำหนดค่าหรือสั้นเกินไปจะคืนค่า null (ผู้เรียกใช้ควรคืนค่า 500)
 */
export function getSecret(env) {
    const s = env && env.AUTH_SECRET;
    if (!s || typeof s !== 'string' || s.length < 16) {
        return null;
    }
    return s;
}

/**
 * ออกโทเคน (Token generation) รองรับสองรูปแบบเพื่อความเข้ากันได้ย้อนหลัง:
 *   createToken('alice', secret)
 *   createToken({u, uid, role}, secret)
 */
export async function createToken(userOrPayload, secret, days = 7) {
    if (!secret) throw new Error('ไม่ได้กำหนดค่า AUTH_SECRET');
    let payload;
    if (typeof userOrPayload === 'string') {
        payload = { u: userOrPayload, exp: Date.now() + days * 86400 * 1000 };
    } else if (userOrPayload && typeof userOrPayload === 'object') {
        const u    = userOrPayload.u;
        const uid  = userOrPayload.uid != null ? userOrPayload.uid : u;
        const role = userOrPayload.role || 'user';
        payload = { u, uid, role, exp: Date.now() + days * 86400 * 1000 };
    } else {
        throw new Error('createToken: พารามิเตอร์ต้องเป็น username หรือ {u, uid, role}');
    }
    const payloadStr = b64urlEncode(JSON.stringify(payload));
    const sig = await hmacSign(payloadStr, secret);
    return `${payloadStr}.${sig}`;
}

export async function verifyToken(token, secret) {
    if (!token || !secret) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadStr, sig] = parts;
    try {
        const expected = await hmacSign(payloadStr, secret);
        if (expected !== sig) return null;
        const payload = JSON.parse(b64urlDecode(payloadStr));
        if (payload.exp && payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

export function getCookieToken(request) {
    const cookie = request.headers.get('Cookie') || '';
    const m = cookie.match(/(?:^|;\s*)auth=([^;]+)/);
    return m ? m[1] : null;
}

export async function requireAuth(request, env) {
    const secret = getSecret(env);
    if (!secret) {
        return jsonResponse(
            { ok: false, error: 'เซิร์ฟเวอร์ไม่ได้กำหนดค่า AUTH_SECRET โปรดติดต่อผู้ดูแลระบบ' },
            500
        );
    }
    const token = getCookieToken(request);
    const payload = await verifyToken(token, secret);
    if (!payload) {
        return jsonResponse({ ok: false, error: 'ยังไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ' }, 401);
    }
    return null;
}

export function jsonResponse(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'Cache-Control': 'no-store',
            ...extraHeaders
        }
    });
}

/* ════════════════════════════════════════════════════════════════════════════════
 * ส่วนขยายระบบผู้ใช้หลายคน (Multi-user Support)
 * ════════════════════════════════════════════════════════════════════════════════ */

/**
 * แยกและตรวจสอบ cookie token จากคำขอ คืนค่าออบเจ็กต์ payload (หรือ null)
 */
export async function getPayload(request, env) {
    const secret = getSecret(env);
    if (!secret) return null;
    const token = getCookieToken(request);
    return await verifyToken(token, secret);
}

/**
 * ดึงชื่อผู้ใช้ username ของคำขอปัจจุบัน (payload.u)
 */
export async function getUsername(request, env) {
    const p = await getPayload(request, env);
    return p ? p.u : null;
}

/**
 * ดึง uid ของคำขอปัจจุบัน
 */
export async function getUserId(request, env) {
    const p = await getPayload(request, env);
    if (!p) return null;
    return p.uid != null ? p.uid : p.u;
}

/**
 * ดึงบทบาท role ของคำขอปัจจุบัน ('admin' / 'user')
 */
export async function getRole(request, env) {
    const p = await getPayload(request, env);
    if (!p) return null;
    if (p.role) return p.role;
    if (env && env.ADMIN_USER && p.u === env.ADMIN_USER) return 'admin';
    return 'user';
}

/**
 * บังคับให้คำขอปัจจุบันต้องมีสิทธิ์เป็น admin
 */
export async function requireAdmin(request, env) {
    const secret = getSecret(env);
    if (!secret) {
        return jsonResponse({ ok: false, error: 'เซิร์ฟเวอร์ไม่ได้กำหนดค่า AUTH_SECRET โปรดติดต่อผู้ดูแลระบบ' }, 500);
    }
    const role = await getRole(request, env);
    if (role == null) {
        return jsonResponse({ ok: false, error: 'ยังไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ' }, 401);
    }
    if (role !== 'admin') {
        return jsonResponse({ ok: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถดำเนินการนี้ได้' }, 403);
    }
    return null;
}

/**
 * ตรวจสอบความถูกต้องของชื่อผู้ใช้ (อนุญาต A-Z a-z 0-9 _ - . ความยาว 1-32)
 */
export function isValidUsername(s) {
    return typeof s === 'string' && /^[A-Za-z0-9_\-\.]{1,32}$/.test(s);
}

/**
 * สร้าง Salt สุ่มเข้ารหัส base64 (ค่าเริ่มต้น 16 ไบต์ = 128 บิต)
 */
export function randomSaltB64(bytes = 16) {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return btoa(String.fromCharCode(...buf));
}

/**
 * คำนวณ PBKDF2-SHA256 คืนค่า hex สตริง (64 ตัวอักษร)
 */
export async function pbkdf2Hex(password, saltB64, iter = 250000) {
    const saltBin = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const baseKey = await crypto.subtle.importKey(
        'raw', encoder.encode(password),
        { name: 'PBKDF2' },
        false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: saltBin, iterations: iter },
        baseKey,
        256
    );
    return Array.from(new Uint8Array(bits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}