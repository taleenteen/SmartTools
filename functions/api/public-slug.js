// /api/public-slug  — จุดจัดการสำหรับ slug การเข้าถึงสาธารณะ (A1.5)
//
// GET    /api/public-slug?u=alice
//        → ตรวจสอบสถานะ slug + enabled ของผู้ใช้; admin ตรวจสอบได้ทุกคน, user ตรวจสอบได้เฉพาะของตนเอง
//
// POST   /api/public-slug
//        body: { username, slug, enabled }
//        → ตั้งค่า / แก้ไข slug; admin แก้ไขได้ทุกคน, user แก้ไขได้เฉพาะของตนเอง
//
// DELETE /api/public-slug?u=alice
//        → ปิดการเข้าถึงสาธารณะ + ปลดปล่อย slug

import {
    jsonResponse,
    getPayload,
    getSecret,
    getCookieToken,
    verifyToken,
    isValidUsername
} from '../_shared/auth.js';
import {
    isValidSlug,
    isReservedSlug,
    lookupSlugUid,
    writeSlugIndex,
    deleteSlugIndex,
    writeOldSlugRedirect,
    deleteOldSlugRedirect,
    slugContainsUsernameSubstring,
    requiredUsernameSubstringLen
} from '../_shared/slug.js';

const USERS_KEY = 'users';

// การตรวจสอบสิทธิ์และระบุผู้ใช้เป้าหมาย: คืนค่า { payload, target, isAdmin } หรือ Response (เมื่อผิดพลาด)
async function authorizeAndResolveTarget(request, env, targetUsername) {
    const secret = getSecret(env);
    if (!secret) {
        return jsonResponse({ ok: false, error: 'เซิร์ฟเวอร์ไม่ได้กำหนดค่า AUTH_SECRET โปรดติดต่อผู้ดูแลระบบ' }, 500);
    }
    const token = getCookieToken(request);
    const payload = await verifyToken(token, secret);
    if (!payload) {
        return jsonResponse({ ok: false, error: 'ยังไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ' }, 401);
    }
    const role = payload.role
        || (env && env.ADMIN_USER && payload.u === env.ADMIN_USER ? 'admin' : 'user');
    const myUid = payload.uid != null ? payload.uid : payload.u;
    if (!isValidUsername(targetUsername)) {
        return jsonResponse({ ok: false, error: 'รูปแบบชื่อผู้ใช้ไม่ถูกต้อง' }, 400);
    }
    const isAdmin = role === 'admin';
    if (!isAdmin && myUid !== targetUsername) {
        return jsonResponse({ ok: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการลิงก์สาธารณะของผู้อื่นได้' }, 403);
    }
    return { payload, target: targetUsername, isAdmin, myUid };
}

// อ่านตาราง users จาก KV, คืนค่า [users, user]
async function readUserEntry(env, target) {
    const raw = await env.FAV_KV.get(USERS_KEY);
    const users = raw ? JSON.parse(raw) : {};
    return [users, users[target] || null];
}

export async function onRequestGet({ request, env }) {
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);
    const url = new URL(request.url);
    const target = url.searchParams.get('u');
    if (!target) return jsonResponse({ ok: false, error: 'ไม่มีพารามิเตอร์ u' }, 400);

    const auth = await authorizeAndResolveTarget(request, env, target);
    if (auth instanceof Response) return auth;

    const [, user] = await readUserEntry(env, target);
    if (!user) return jsonResponse({ ok: false, error: 'ไม่พบผู้ใช้' }, 404);

    return jsonResponse({
        ok: true,
        username: target,
        slug: user.publicSlug || '',
        enabled: user.publicEnabled === true
    });
}

export async function onRequestPost({ request, env }) {
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }, 400); }

    const target = body && body.username;
    const newSlugRaw = body && body.slug;
    const newSlug = typeof newSlugRaw === 'string' ? newSlugRaw.trim().toLowerCase() : '';
    const enabled = !!(body && body.enabled);

    const auth = await authorizeAndResolveTarget(request, env, target);
    if (auth instanceof Response) return auth;
    // สิทธิ์ของผู้เรียกกำหนดกฎความยาว slug: admin (1-32) / user (3-32)
    const callerRole = auth.isAdmin ? 'admin' : 'user';
    const minLen = auth.isAdmin ? 1 : 3;

    // ตรวจสอบรูปแบบ slug / คำสงวน
    if (enabled) {
        if (!isValidSlug(newSlug, callerRole)) {
            return jsonResponse({
                ok: false,
                error: 'slug ไม่ถูกต้อง: ตัวอักษรแรกต้องเป็นตัวอักษร/ตัวเลข, อนุญาต a-z 0-9 _ -, ความยาว ' + minLen + '-32'
            }, 400);
        }
        if (isReservedSlug(newSlug)) {
            return jsonResponse({
                ok: false,
                error: 'slug นี้เป็นคำสงวน โปรดเลือกคำอื่น'
            }, 400);
        }
    } else if (newSlug && !isValidSlug(newSlug, callerRole)) {
        return jsonResponse({
            ok: false,
            error: 'slug ไม่ถูกต้อง (แม้ว่าจะปิดใช้งานก็ต้องผ่านการตรวจสอบรูปแบบหรือเว้นว่างไว้)'
        }, 400);
    }

    // ข้อกำหนดการเปลี่ยนชื่อของผู้ใช้ทั่วไป: slug ต้องมีอักขระจากชื่อผู้ใช้อย่างน้อย 70%
    if (!auth.isAdmin && newSlug) {
        if (!slugContainsUsernameSubstring(newSlug, target, 0.7)) {
            const reqLen = requiredUsernameSubstringLen(target, 0.7);
            return jsonResponse({
                ok: false,
                error: 'slug ต้องมีอักขระติดต่อกันอย่างน้อย ' + reqLen + ' ตัวจากชื่อผู้ใช้ "' + target + '" (และต้องไม่ใช่ตัวเลขล้วน)',
                code: 'USERNAME_SUBSTRING_REQUIRED',
                requiredLen: reqLen
            }, 400);
        }
    }

    const [users, user] = await readUserEntry(env, target);
    if (!user) return jsonResponse({ ok: false, error: 'ไม่พบผู้ใช้' }, 404);

    const oldSlug = user.publicSlug || '';

    // ตรวจสอบความซ้ำซ้อน: หาก slug ใหม่มีผู้อื่นใช้อยู่แล้ว
    if (enabled && newSlug && newSlug !== oldSlug) {
        const occupantUid = await lookupSlugUid(env, newSlug);
        if (occupantUid && occupantUid !== target) {
            return jsonResponse({
                ok: false,
                error: 'slug นี้ถูกใช้งานแล้ว',
                conflict: true
            }, 409);
        }
    }

    try {
        // บันทึกดัชนีย้อนกลับ (reverse index) เมื่อ enabled=true
        if (enabled && newSlug) {
            await writeSlugIndex(env, newSlug, target);
        }

        // เขียนลงตาราง users
        users[target] = {
            ...user,
            publicSlug: newSlug || '',
            publicEnabled: enabled && !!newSlug
        };
        await env.FAV_KV.put(USERS_KEY, JSON.stringify(users));

        // ปลดปล่อยดัชนีเดิมเมื่อเปลี่ยน slug หรือ disabled
        if (oldSlug && oldSlug !== newSlug) {
            await deleteSlugIndex(env, oldSlug);
            if (enabled && newSlug) {
                await writeOldSlugRedirect(env, oldSlug, newSlug);
            }
            await deleteOldSlugRedirect(env, newSlug);
        } else if (!enabled && oldSlug) {
            await deleteSlugIndex(env, oldSlug);
        }

        return jsonResponse({
            ok: true,
            username: target,
            slug: newSlug || '',
            enabled: enabled && !!newSlug,
            previousSlug: oldSlug || null
        });
    } catch (e) {
        const msg = (e && (e.message || e.name)) || String(e);
        console.warn('public-slug.POST failed:', msg, e && e.stack);
        return jsonResponse({
            ok: false,
            error: 'การบันทึกล้มเหลว: ' + msg,
            where: 'public-slug.POST'
        }, 500);
    }
}

export async function onRequestDelete({ request, env }) {
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);
    const url = new URL(request.url);
    const target = url.searchParams.get('u');
    if (!target) return jsonResponse({ ok: false, error: 'ไม่มีพารามิเตอร์ u' }, 400);

    const auth = await authorizeAndResolveTarget(request, env, target);
    if (auth instanceof Response) return auth;

    const [users, user] = await readUserEntry(env, target);
    if (!user) return jsonResponse({ ok: false, error: 'ไม่พบผู้ใช้' }, 404);

    const oldSlug = user.publicSlug || '';
    try {
        users[target] = {
            ...user,
            publicSlug: '',
            publicEnabled: false
        };
        await env.FAV_KV.put(USERS_KEY, JSON.stringify(users));
        if (oldSlug) await deleteSlugIndex(env, oldSlug);
        return jsonResponse({
            ok: true,
            username: target,
            cleared: true,
            previousSlug: oldSlug || null
        });
    } catch (e) {
        const msg = (e && (e.message || e.name)) || String(e);
        console.warn('public-slug.DELETE failed:', msg, e && e.stack);
        return jsonResponse({
            ok: false,
            error: 'การล้างข้อมูลล้มเหลว: ' + msg,
            where: 'public-slug.DELETE'
        }, 500);
    }
}
