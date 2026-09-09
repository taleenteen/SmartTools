// GET    /api/backups                          → แสดงรายการข้อมูลสำรองทั้งหมดของผู้ใช้ปัจจุบัน
// GET    /api/backups?name=xxx                 → อ่านเนื้อหาข้อมูลสำรองที่ระบุ (ของผู้ใช้ปัจจุบัน)
// POST   /api/backups?name=xxx&action=restore  → กู้คืนเป็นข้อมูลหลัก (ของผู้ใช้ปัจจุบัน)
// DELETE /api/backups?name=xxx                 → ลบข้อมูลสำรอง (ของผู้ใช้ปัจจุบัน)
//
// ปรับปรุง A0 v2: เลือก namespace ตามบทบาท
//   admin → ดำเนินการ admin:backup:* และ admin:data_js
//   user  → ดำเนินการ user:<uid>:backup:* และ user:<uid>:data_js
//   admin **ไม่ข้ามผู้ใช้** (แม้แต่ admin ก็ดูเฉพาะข้อมูลสำรองของ admin เอง; A1 มี API การจัดการอาร์ไคฟ์แยกต่างหาก)

import { requireAuth, jsonResponse, getPayload } from '../_shared/auth.js';

function nsKeys(ns) {
    return {
        data:    `${ns}:data_js`,
        backupP: `${ns}:backup:`
    };
}

async function pickNamespace(request, env) {
    const payload = await getPayload(request, env);
    const role = (payload && payload.role) || 'user';
    const uid  = payload && (payload.uid != null ? payload.uid : payload.u);
    return role === 'admin' ? 'admin' : `user:${uid}`;
}

export async function onRequestGet({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    const ns = await pickNamespace(request, env);
    const KEYS = nsKeys(ns);

    const url = new URL(request.url);
    const name = url.searchParams.get('name');

    if (name) {
        let content = await env.FAV_KV.get(KEYS.backupP + name);
        // เข้ากันได้ย้อนหลังช่วงการย้ายข้อมูล (เฉพาะ admin namespace): หากไม่พบคีย์ใหม่ ให้ลองใช้ prefix backup:* เดิม
        if (content == null && ns === 'admin') {
            content = await env.FAV_KV.get('backup:' + name);
        }
        if (content == null) return jsonResponse({ ok: false, error: 'ไม่พบข้อมูลสำรอง' }, 404);
        return jsonResponse({ ok: true, content, namespace: ns });
    }

    const list = await env.FAV_KV.list({ prefix: KEYS.backupP });
    let items = list.keys.map(k => ({
        name: k.name.substring(KEYS.backupP.length)
    }));

    // เข้ากันได้ย้อนหลังช่วงการย้ายข้อมูล (เฉพาะ admin namespace): หาก admin:backup:* ว่างเปล่าแต่ backup:* มีข้อมูล ให้แสดงข้อมูลสำรองเดิม
    // กำกับด้วยแท็ก legacy:true เมื่อเรียกใช้ migrate-v2 แล้ว admin:backup:* จะปรากฏ และเส้นทางนี้จะปิดใช้งานโดยอัตโนมัติ
    if (ns === 'admin' && items.length === 0) {
        try {
            const legacy = await env.FAV_KV.list({ prefix: 'backup:' });
            if (legacy.keys.length > 0) {
                items = legacy.keys.map(k => ({
                    name: k.name.substring('backup:'.length),
                    legacy: true
                }));
            }
        } catch {}
    }

    items.sort((a, b) => b.name.localeCompare(a.name));
    return jsonResponse({ ok: true, backups: items, namespace: ns });
}

export async function onRequestPost({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    const ns = await pickNamespace(request, env);
    const KEYS = nsKeys(ns);

    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    const action = url.searchParams.get('action');
    if (!name) return jsonResponse({ ok: false, error: 'ไม่มีพารามิเตอร์ name' }, 400);

    if (action === 'restore') {
        // เข้ากันได้ย้อนหลังช่วงการย้ายข้อมูล: หากไม่พบคีย์ใหม่ ให้ลองใช้ backup:* เดิม (เฉพาะ admin namespace)
        let content = await env.FAV_KV.get(KEYS.backupP + name);
        if (content == null && ns === 'admin') {
            content = await env.FAV_KV.get('backup:' + name);
        }
        if (content == null) return jsonResponse({ ok: false, error: 'ไม่พบข้อมูลสำรอง' }, 404);
        // บันทึกสถานะปัจจุบันเป็นข้อมูลสำรองใหม่ (ใน namespace เดียวกัน เขียนลงคีย์ใหม่)
        const old = await env.FAV_KV.get(KEYS.data);
        if (old && old.trim()) {
            await env.FAV_KV.put(KEYS.backupP + timestamp(), old);
        }
        await env.FAV_KV.put(KEYS.data, content);
        return jsonResponse({ ok: true, namespace: ns });
    }
    return jsonResponse({ ok: false, error: 'action ไม่ถูกต้อง' }, 400);
}

// การประทับเวลา (สอดคล้องกับ save.js / comment.js)
function timestamp() {
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const p = n => String(n).padStart(2, '0');
    return d.getUTCFullYear() +
           p(d.getUTCMonth() + 1) +
           p(d.getUTCDate()) + '_' +
           p(d.getUTCHours()) +
           p(d.getUTCMinutes()) +
           p(d.getUTCSeconds());
}

export async function onRequestDelete({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    const ns = await pickNamespace(request, env);
    const KEYS = nsKeys(ns);

    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    if (!name) return jsonResponse({ ok: false, error: 'ไม่มีพารามิเตอร์ name' }, 400);
    // เข้ากันได้ย้อนหลัง: ลองลบคีย์ใหม่ก่อน หากไม่พบให้ลองลบคีย์เดิม (เฉพาะ admin namespace)
    await env.FAV_KV.delete(KEYS.backupP + name);
    if (ns === 'admin') {
        // ลบคีย์เดิมด้วย (หากยังมีอยู่) — ป้องกันกรณี admin ลบแล้วแต่ข้อมูลสำรองเดิมยังค้าง
        await env.FAV_KV.delete('backup:' + name);
    }
    return jsonResponse({ ok: true, namespace: ns });
}
