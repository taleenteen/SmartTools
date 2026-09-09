// GET  /api/settings  → อ่านการตั้งค่าแหล่งข้อมูลของเซสชันปัจจุบัน
// POST /api/settings  → แก้ไขการตั้งค่าแหล่งข้อมูล (ต้องเข้าสู่ระบบ)

import { requireAuth, jsonResponse, getPayload } from '../_shared/auth.js';

const VALID_SOURCES = ['kv', 'static'];

const OLD_SOURCE_KEY  = 'data_source';
const OLD_DATA_KEY    = 'data_js';
const ADMIN_SOURCE_KEY = 'admin:data_source';
const ADMIN_DATA_KEY   = 'admin:data_js';

function userSourceKey(uid) { return 'user:' + uid + ':data_source'; }
function userDataKey(uid)   { return 'user:' + uid + ':data_js'; }

async function pickKeys(request, env) {
    const payload = await getPayload(request, env);
    if (!payload) {
        return { sourceKey: ADMIN_SOURCE_KEY, dataKey: ADMIN_DATA_KEY, ns: 'admin', isLoggedIn: false };
    }
    const role = payload.role || 'user';
    const uid  = payload.uid != null ? payload.uid : payload.u;
    if (role === 'admin') {
        return { sourceKey: ADMIN_SOURCE_KEY, dataKey: ADMIN_DATA_KEY, ns: 'admin', isLoggedIn: true };
    }
    return {
        sourceKey: userSourceKey(uid),
        dataKey:   userDataKey(uid),
        ns: 'user:' + uid,
        isLoggedIn: true
    };
}

export async function onRequestGet({ request, env }) {
    if (!env.FAV_KV) {
        return jsonResponse({ ok: true, data_source: 'static', hasKV: false, namespace: 'admin' });
    }
    const { sourceKey, dataKey, ns } = await pickKeys(request, env);

    let saved = await env.FAV_KV.get(sourceKey);
    let hasKVData = !!(await env.FAV_KV.get(dataKey));

    // รองรับช่วงย้ายข้อมูล (admin namespace): หากยังไม่ตั้งค่า key ใหม่ ให้ใช้ key เดิม
    if (ns === 'admin') {
        if (saved == null) saved = await env.FAV_KV.get(OLD_SOURCE_KEY);
        if (!hasKVData)    hasKVData = !!(await env.FAV_KV.get(OLD_DATA_KEY));
    }

    const source = VALID_SOURCES.includes(saved) ? saved : 'static';
    return jsonResponse({ ok: true, data_source: source, hasKV: true, hasKVData, namespace: ns });
}

export async function onRequestPost({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ยังไม่ได้ผูก KV' }, 500);

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }, 400); }

    const { data_source } = body || {};
    if (!VALID_SOURCES.includes(data_source)) {
        return jsonResponse({ ok: false, error: 'ค่า data_source ไม่ถูกต้อง' }, 400);
    }

    const { sourceKey, ns } = await pickKeys(request, env);
    await env.FAV_KV.put(sourceKey, data_source);
    return jsonResponse({ ok: true, data_source, namespace: ns });
}
