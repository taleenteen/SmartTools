// GET  /api/source        → ตรวจสอบแหล่งข้อมูลปัจจุบัน
// POST /api/source        → สลับแหล่งข้อมูลปัจจุบัน (ต้องเข้าสู่ระบบ)
//   body: { source: 'kv' | 'static' }

import { requireAuth, jsonResponse, getPayload } from '../_shared/auth.js';

const OLD_SOURCE_KEY   = 'data_source';
const ADMIN_SOURCE_KEY = 'admin:data_source';
function userSourceKey(uid) { return 'user:' + uid + ':data_source'; }

async function pickSourceKey(request, env) {
    const payload = await getPayload(request, env);
    if (!payload) {
        return { key: ADMIN_SOURCE_KEY, ns: 'admin', isLoggedIn: false };
    }
    const role = payload.role || 'user';
    const uid  = payload.uid != null ? payload.uid : payload.u;
    if (role === 'admin') {
        return { key: ADMIN_SOURCE_KEY, ns: 'admin', isLoggedIn: true };
    }
    return { key: userSourceKey(uid), ns: 'user:' + uid, isLoggedIn: true };
}

// ตรวจสอบ data_source ของ namespace ปัจจุบัน
export async function onRequestGet({ request, env }) {
    if (!env.FAV_KV) {
        return jsonResponse({
            ok: true,
            source: 'static',
            configured: false,
            namespace: 'admin',
            note: 'ยังไม่ได้ผูก KV ใช้ static เป็นค่าเริ่มต้น'
        });
    }

    const { key, ns } = await pickSourceKey(request, env);
    let saved = await env.FAV_KV.get(key);

    // รองรับช่วงย้ายข้อมูล (admin namespace): หากยังไม่ตั้งค่า key ใหม่ ให้ใช้ key เดิม
    if (saved == null && ns === 'admin') {
        saved = await env.FAV_KV.get(OLD_SOURCE_KEY);
    }

    const valid = (saved === 'kv' || saved === 'static');
    return jsonResponse({
        ok: true,
        source: valid ? saved : 'static',
        configured: valid,
        namespace: ns
    });
}

// สลับ data_source ของ namespace ปัจจุบัน
export async function onRequestPost({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;

    if (!env.FAV_KV) {
        return jsonResponse({ ok: false, error: 'ยังไม่ได้ผูก KV ไม่สามารถเปลี่ยนแหล่งข้อมูลได้' }, 500);
    }

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง (ต้องเป็น JSON)' }, 400); }

    const { source } = body || {};
    if (source !== 'kv' && source !== 'static') {
        return jsonResponse({ ok: false, error: 'source ต้องเป็น "kv" หรือ "static"' }, 400);
    }

    const { key, ns } = await pickSourceKey(request, env);
    await env.FAV_KV.put(key, source);
    return jsonResponse({ ok: true, source, namespace: ns });
}
