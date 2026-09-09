// POST /api/change-password  → ผู้ใช้ที่เข้าสู่ระบบเปลี่ยนรหัสผ่านของตนเอง
//   body: { oldPassword, newPassword }

import {
    requireAuth,
    jsonResponse,
    getUsername,
    pbkdf2Hex,
    randomSaltB64
} from '../_shared/auth.js';

const USERS_KEY = 'users';
const PBKDF2_ITER = 100000;

function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

// แฮช sha256 แบบเดิม (สำหรับรองรับ passHash แบบเก่า)
async function sha256Hex(str) {
    const data = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ยังไม่ได้ผูก KV' }, 500);

    const username = await getUsername(request, env);
    if (!username) {
        return jsonResponse({ ok: false, error: 'ไม่สามารถระบุตัวตนผู้ใช้ปัจจุบัน' }, 401);
    }

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }, 400); }

    const { oldPassword, newPassword } = body || {};
    if (!oldPassword || !newPassword) {
        return jsonResponse({ ok: false, error: 'ต้องระบุทั้งรหัสผ่านเดิมและรหัสผ่านใหม่' }, 400);
    }
    if (newPassword.length < 4) {
        return jsonResponse({ ok: false, error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' }, 400);
    }

    const raw = await env.FAV_KV.get(USERS_KEY);
    const users = raw ? JSON.parse(raw) : {};
    const user = users[username];

    if (!user || !user.passHash) {
        return jsonResponse({
            ok: false,
            error: 'ไม่พบข้อมูลผู้ใช้นี้ใน KV สำหรับรหัสผ่าน admin ที่ตั้งใน env โปรดแก้ไขใน Cloudflare Dashboard'
        }, 400);
    }

    // ตรวจสอบรหัสผ่านเดิม
    const isLegacySha256 = !user.salt;
    let oldOk;
    if (isLegacySha256) {
        const oldHash = await sha256Hex(oldPassword);
        oldOk = timingSafeEqual(oldHash, user.passHash);
    } else {
        const oldHash = await pbkdf2Hex(oldPassword, user.salt, user.iter || PBKDF2_ITER);
        oldOk = timingSafeEqual(oldHash, user.passHash);
    }
    if (!oldOk) {
        return jsonResponse({ ok: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' }, 401);
    }

    // เขียนรหัสผ่านใหม่ด้วย PBKDF2
    const newSalt = randomSaltB64(16);
    const newHash = await pbkdf2Hex(newPassword, newSalt, PBKDF2_ITER);
    users[username] = {
        ...user,
        passHash: newHash,
        salt: newSalt,
        iter: PBKDF2_ITER
    };
    await env.FAV_KV.put(USERS_KEY, JSON.stringify(users));

    return jsonResponse({
        ok: true,
        algo: 'pbkdf2',
        upgradedFromLegacy: isLegacySha256,
        note: isLegacySha256 ? 'อัปเดตรหัสผ่านเรียบร้อยแล้ว (อัปเกรดอัลกอริทึมแฮช)' : 'อัปเดตรหัสผ่านเรียบร้อยแล้ว'
    });
}
