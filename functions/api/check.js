// GET /api/check  → ตรวจสอบสถานะ session ปัจจุบันและภาพรวมการตั้งค่าเซิร์ฟเวอร์
//
// เพิ่มฟิลด์ uid / role / migrationNeeded
//   - role อ่านจาก token
//   - migrationNeeded = KV มี data เดิมแต่ยังไม่ได้ทำ migration

import { getCookieToken, verifyToken, getSecret, jsonResponse, getRole } from '../_shared/auth.js';

const MIGRATION_DONE_KEY = 'migration:v2:done';
const OLD_DATA_KEY = 'data_js';

export async function onRequestGet({ request, env }) {
    const secret = getSecret(env);
    if (!secret) {
        return jsonResponse({
            ok: true,
            loggedIn: false,
            username: null,
            uid: null,
            role: null,
            hasKV: !!env.FAV_KV,
            hasAdmin: !!(env.ADMIN_USER && env.ADMIN_PASS),
            migrationNeeded: false,
            error: 'ยังไม่ได้กำหนดค่า AUTH_SECRET'
        });
    }

    const token = getCookieToken(request);
    const payload = await verifyToken(token, secret);
    const role = payload ? await getRole(request, env) : null;
    const uid  = payload ? (payload.uid != null ? payload.uid : payload.u) : null;

    // ตรวจสอบสถานะการย้ายข้อมูล (migration)
    let migrationNeeded = false;
    let inboxPolicy = 'open';
    let publicSlug = null;
    let publicEnabled = false;
    if (env.FAV_KV) {
        try {
            const [done, oldData] = await Promise.all([
                env.FAV_KV.get(MIGRATION_DONE_KEY),
                env.FAV_KV.get(OLD_DATA_KEY)
            ]);
            migrationNeeded = !done && !!oldData;
        } catch {
            // เมื่อเกิดข้อผิดพลาด KV จะไม่ขัดจังหวะการตอบกลับหลัก
        }
        // อ่านข้อมูล users เพื่อดึง inboxPolicy / publicSlug / publicEnabled
        if (payload && uid) {
            try {
                const usersRaw = await env.FAV_KV.get('users');
                if (usersRaw) {
                    const users = JSON.parse(usersRaw);
                    const me = users[uid];
                    if (me) {
                        if (me.inboxPolicy === 'closed') inboxPolicy = 'closed';
                        publicSlug = me.publicSlug || null;
                        publicEnabled = me.publicEnabled === true;
                    }
                }
            } catch {}
        }
    }

    return jsonResponse({
        ok: true,
        loggedIn: !!payload,
        username: payload ? payload.u : null,
        uid,
        role,
        hasKV: !!env.FAV_KV,
        hasAdmin: !!(env.ADMIN_USER && env.ADMIN_PASS),
        migrationNeeded,
        inboxPolicy,
        publicSlug,
        publicEnabled
    });
}
