// GET    /api/users                                                → แสดงรายการผู้ใช้ทั้งหมด (admin only)
// POST   /api/users                                                → สร้างผู้ใช้ / รีเซ็ตรหัสผ่าน (admin only)
//                                                                    body: { username, password }
// DELETE /api/users?u=xxx                                          → ลบผู้ใช้ (admin only, หาก hasData ต้องใช้ force)
// DELETE /api/users?u=xxx&force=1&confirm=DELETE-xxx               → บังคับลบ: อาร์ไคฟ์ข้อมูลทั้งหมดก่อนแล้วจึงลบผู้ใช้

import {
    requireAdmin,
    jsonResponse,
    getUsername,
    isValidUsername,
    pbkdf2Hex,
    randomSaltB64
} from '../_shared/auth.js';
import { deleteSlugIndex, genUniqueSlug, writeSlugIndex } from '../_shared/slug.js';

const USERS_KEY = 'users';
const PBKDF2_ITER = 100000;

function archiveTimestamp() {
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const p = n => String(n).padStart(2, '0');
    return d.getUTCFullYear() +
           p(d.getUTCMonth() + 1) +
           p(d.getUTCDate()) + '_' +
           p(d.getUTCHours()) +
           p(d.getUTCMinutes()) +
           p(d.getUTCSeconds());
}

// แสดงรายการผู้ใช้ (ซ่อนข้อมูลละเอียดอ่อน)
export async function onRequestGet({ request, env }) {
    const fail = await requireAdmin(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    const raw = await env.FAV_KV.get(USERS_KEY);
    const users = raw ? JSON.parse(raw) : {};

    const list = Object.entries(users).map(([u, info]) => ({
        username: u,
        role: info.role || 'user',
        status: info.status || 'active',
        hasData: !!info.hasData,
        algo: info.salt ? 'pbkdf2' : 'sha256',
        createdAt: info.createdAt || null,
        publicSlug: info.publicSlug || '',
        publicEnabled: info.publicEnabled === true
    }));
    return jsonResponse({ ok: true, users: list });
}

export async function onRequestPost({ request, env }) {
    const fail = await requireAdmin(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    const currentUser = await getUsername(request, env);

    // ── ทางเลือก: cleanup-after-archive ──
    const url = new URL(request.url);
    if (url.searchParams.get('action') === 'cleanup-after-archive') {
        const target = url.searchParams.get('u');
        const archiveKey = url.searchParams.get('archiveKey') || '';
        if (!target || !isValidUsername(target)) {
            return jsonResponse({ ok: false, error: 'พารามิเตอร์ u ไม่ถูกต้อง' }, 400);
        }
        if (target === currentUser) {
            return jsonResponse({ ok: false, error: 'ไม่สามารถล้างข้อมูลของตนเองได้' }, 400);
        }
        if (!/^archive:[A-Za-z0-9_\-\.]{1,32}:\d{8}_\d{6}$/.test(archiveKey)) {
            return jsonResponse({ ok: false, error: 'archiveKey ไม่ถูกต้อง' }, 400);
        }
        const metaRaw = await env.FAV_KV.get(archiveKey + ':meta');
        if (metaRaw == null) {
            return jsonResponse({ ok: false, error: 'ไม่พบข้อมูลอาร์ไคฟ์ ไม่สามารถล้างข้อมูลได้ (ต้องทำการอาร์ไคฟ์ก่อน)' }, 404);
        }
        let meta;
        try { meta = JSON.parse(metaRaw); }
        catch { return jsonResponse({ ok: false, error: 'ข้อมูล meta ของอาร์ไคฟ์เสียหาย' }, 500); }
        if (meta.username !== target) {
            return jsonResponse({ ok: false, error: 'archiveKey ไม่ตรงกับผู้ใช้ในพารามิเตอร์ u' }, 400);
        }

        // ล้างข้อมูล user:<target>:* ใน KV ทั้งหมด
        const ns = 'user:' + target + ':';
        const userListing = await env.FAV_KV.list({ prefix: ns });
        const cleanupErrors = [];
        for (const k of userListing.keys) {
            try { await env.FAV_KV.delete(k.name); }
            catch (e) { cleanupErrors.push({ key: k.name, error: e.message || String(e) }); }
        }

        // ลบออกจากตาราง users
        const rawU = await env.FAV_KV.get(USERS_KEY);
        const usersTab = rawU ? JSON.parse(rawU) : {};
        let slugToRelease = '';
        if (usersTab[target]) {
            slugToRelease = usersTab[target].publicSlug || '';
            delete usersTab[target];
            try { await env.FAV_KV.put(USERS_KEY, JSON.stringify(usersTab)); }
            catch (e) { cleanupErrors.push({ step: 'users table', error: e.message || String(e) }); }
        }

        // ปลดปล่อย slug index
        if (slugToRelease) {
            try { await deleteSlugIndex(env, slugToRelease); }
            catch (e) { cleanupErrors.push({ step: 'slug index', error: e.message || String(e) }); }
        }

        return jsonResponse({
            ok: true,
            cleaned: target,
            archiveKey,
            cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined
        });
    }

    // ── ทางเลือกหลัก: สร้างผู้ใช้ / รีเซ็ตรหัสผ่าน ──
    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }, 400); }

    const { username, password } = body || {};
    if (!isValidUsername(username)) {
        return jsonResponse({
            ok: false,
            error: 'ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษร, ตัวเลข, ขีดล่าง, ยัติภังค์ หรือจุดเท่านั้น ความยาว 1-32 ตัวอักษร'
        }, 400);
    }
    if (!password || typeof password !== 'string' || password.length < 4) {
        return jsonResponse({ ok: false, error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร' }, 400);
    }

    const raw = await env.FAV_KV.get(USERS_KEY);
    const users = raw ? JSON.parse(raw) : {};

    const isNew = !users[username];

    try {
        const salt = randomSaltB64(16);
        const passHash = await pbkdf2Hex(password, salt, PBKDF2_ITER);
        const nowIso = new Date().toISOString();

        if (isNew) {
            let autoSlug = '';
            try {
                autoSlug = await genUniqueSlug(env, username, 'admin');
                if (autoSlug) {
                    await writeSlugIndex(env, autoSlug, username);
                }
            } catch (slugErr) {
                console.warn('auto slug gen failed for', username, slugErr && slugErr.message);
                autoSlug = '';
            }

            users[username] = {
                passHash,
                salt,
                iter: PBKDF2_ITER,
                role: 'user',
                status: 'active',
                createdAt: nowIso,
                createdBy: currentUser || '__unknown__',
                hasData: false,
                publicSlug: autoSlug,
                publicEnabled: !!autoSlug
            };
        } else {
            const old = users[username];
            users[username] = {
                ...old,
                passHash,
                salt,
                iter: PBKDF2_ITER,
                role: old.role || 'user',
                status: old.status || 'active'
            };
        }

        await env.FAV_KV.put(USERS_KEY, JSON.stringify(users));
        return jsonResponse({
            ok: true,
            created: isNew,
            username,
            algo: 'pbkdf2',
            note: isNew ? 'สร้างผู้ใช้สำเร็จ' : 'รีเซ็ตรหัสผ่านสำเร็จ'
        });
    } catch (e) {
        const msg = (e && (e.message || e.name)) || String(e);
        console.warn('users.POST failed:', msg, e && e.stack);
        return jsonResponse({
            ok: false,
            error: 'สร้างผู้ใช้/รีเซ็ตรหัสผ่านล้มเหลว: ' + msg,
            where: 'users.POST',
            isNew
        }, 500);
    }
}

// ลบผู้ใช้
//   ปกติ: DELETE /api/users?u=alice            → hasData=false ลบได้ทันที; hasData=true ส่งกลับ 409 + requiresForce
//   บังคับ: DELETE /api/users?u=alice&force=1&confirm=DELETE-alice
//         → อาร์ไคฟ์ user:<uid>:* ทั้งหมดใน KV ไปยัง archive:<uid>:<ts>:* ก่อนลบข้อมูลเดิม
export async function onRequestDelete({ request, env }) {
    const fail = await requireAdmin(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    const currentUser = await getUsername(request, env);

    const url = new URL(request.url);
    const target = url.searchParams.get('u');
    const force = url.searchParams.get('force') === '1';
    const confirm = url.searchParams.get('confirm') || '';
    const action = url.searchParams.get('action') || '';

    if (!target) return jsonResponse({ ok: false, error: 'ไม่มีพารามิเตอร์ u' }, 400);
    if (!isValidUsername(target)) {
        return jsonResponse({ ok: false, error: 'รูปแบบชื่อผู้ใช้ไม่ถูกต้อง' }, 400);
    }
    if (target === currentUser) {
        return jsonResponse({ ok: false, error: 'ไม่สามารถลบตนเองได้' }, 400);
    }

    const raw = await env.FAV_KV.get(USERS_KEY);
    const users = raw ? JSON.parse(raw) : {};
    if (!users[target]) {
        return jsonResponse({ ok: false, error: 'ไม่พบผู้ใช้' }, 404);
    }

    // ไม่มีข้อมูล → ลบได้ทันที
    if (!users[target].hasData) {
        const slugToRelease = users[target].publicSlug || '';
        delete users[target];
        await env.FAV_KV.put(USERS_KEY, JSON.stringify(users));
        if (slugToRelease) await deleteSlugIndex(env, slugToRelease);
        return jsonResponse({ ok: true, deleted: target });
    }

    // มีข้อมูล → ต้องใช้กระบวนการ force
    if (!force) {
        return jsonResponse({
            ok: false,
            error: 'ผู้ใช้นี้มีข้อมูลบันทึกอยู่ ต้องใช้กระบวนการบังคับลบเพื่อทำอาร์ไคฟ์ก่อน',
            requiresForce: true
        }, 409);
    }

    // ตรวจสอบ confirm
    if (confirm !== 'DELETE-' + target) {
        return jsonResponse({
            ok: false,
            error: 'ฟิลด์ confirm ต้องเป็น DELETE-' + target
        }, 400);
    }

    // ───── ขั้นตอนอาร์ไคฟ์ ─────
    const ns = 'user:' + target + ':';
    const userListing = await env.FAV_KV.list({ prefix: ns });

    const ts = archiveTimestamp();
    const archPrefix = 'archive:' + target + ':' + ts + ':';
    const errors = [];
    const archivedKeys = [];

    // คัดลอก data_js
    let dataSize = 0;
    try {
        const dataVal = await env.FAV_KV.get(ns + 'data_js');
        if (dataVal != null) {
            dataSize = dataVal.length;
            await env.FAV_KV.put(archPrefix + 'data', dataVal);
            archivedKeys.push(archPrefix + 'data');
        }
    } catch (e) {
        errors.push({ step: 'data_js', error: e.message || String(e) });
    }

    // คัดลอก data_source (ทางเลือก)
    if (errors.length === 0) {
        try {
            const sourceVal = await env.FAV_KV.get(ns + 'data_source');
            if (sourceVal != null) {
                await env.FAV_KV.put(archPrefix + 'source', sourceVal);
                archivedKeys.push(archPrefix + 'source');
            }
        } catch (e) {
            errors.push({ step: 'data_source', error: e.message || String(e) });
        }
    }

    // คัดลอก backup:*
    let backupCount = 0;
    let backupFailed = 0;
    if (errors.length === 0) {
        const backupKeys = userListing.keys
            .map(k => k.name)
            .filter(name => name.startsWith(ns + 'backup:'));
        const BATCH = 10;
        for (let i = 0; i < backupKeys.length; i += BATCH) {
            const batch = backupKeys.slice(i, i + BATCH);
            const results = await Promise.all(batch.map(async (oldKey) => {
                try {
                    const bts = oldKey.substring((ns + 'backup:').length);
                    const content = await env.FAV_KV.get(oldKey);
                    if (content == null) return { ok: false, reason: 'disappeared', key: oldKey };
                    await env.FAV_KV.put(archPrefix + 'backup:' + bts, content);
                    return { ok: true };
                } catch (e) {
                    return { ok: false, reason: e.message || String(e), key: oldKey };
                }
            }));
            for (const r of results) {
                if (r.ok) backupCount++;
                else {
                    backupFailed++;
                    errors.push({ step: r.key, error: r.reason });
                }
            }
        }
    }

    // บันทึก meta
    if (errors.length === 0) {
        try {
            const meta = {
                username: target,
                uid: target,
                role: users[target].role || 'user',
                archivedAt: new Date().toISOString(),
                archivedAtLocal: ts,
                archivedBy: currentUser || '__unknown__',
                dataSize,
                backupCount,
                originalCreatedAt: users[target].createdAt || null,
                originalCreatedBy: users[target].createdBy || null,
                publicSlug: users[target].publicSlug || null,
                publicEnabled: users[target].publicEnabled === true
            };
            await env.FAV_KV.put(archPrefix + 'meta', JSON.stringify(meta));
            archivedKeys.push(archPrefix + 'meta');
        } catch (e) {
            errors.push({ step: 'meta', error: e.message || String(e) });
        }
    }

    if (errors.length > 0) {
        return jsonResponse({
            ok: false,
            error: 'กระบวนการอาร์ไคฟ์ล้มเหลว ข้อมูลเดิมยังไม่ถูกลบ สามารถลองใหม่ได้',
            archivedKeys,
            errors,
            archiveKey: archPrefix.slice(0, -1)
        }, 500);
    }

    if (action === 'archive-only') {
        return jsonResponse({
            ok: true,
            archived: true,
            cleaned: false,
            archiveKey: archPrefix.slice(0, -1),
            archiveTs: ts,
            dataSize,
            backupCount,
            username: target
        });
    }

    // ───── ขั้นตอนล้างข้อมูล ─────
    const cleanupErrors = [];
    for (const k of userListing.keys) {
        try {
            await env.FAV_KV.delete(k.name);
        } catch (e) {
            cleanupErrors.push({ key: k.name, error: e.message || String(e) });
        }
    }

    const slugToRelease = users[target].publicSlug || '';
    delete users[target];
    try {
        await env.FAV_KV.put(USERS_KEY, JSON.stringify(users));
    } catch (e) {
        cleanupErrors.push({ step: 'users table', error: e.message || String(e) });
    }

    if (slugToRelease) {
        try { await deleteSlugIndex(env, slugToRelease); }
        catch (e) { cleanupErrors.push({ step: 'slug index', error: e.message || String(e) }); }
    }

    return jsonResponse({
        ok: true,
        deleted: target,
        archived: true,
        cleaned: true,
        archiveKey: archPrefix.slice(0, -1),
        archiveTs: ts,
        dataSize,
        backupCount,
        cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined
    });
}
