// GET    /api/archives                              → แสดงรายการอาร์ไคฟ์ทั้งหมด (admin only, อ่าน archive:*:meta)
// GET    /api/archives?key=archive:<uid>:<ts>        → รายละเอียดอาร์ไคฟ์เดี่ยว (meta + สรุปรายการ backup, ไม่รวมเนื้อหา data)
// GET    /api/archives?key=...&include=full          → ข้อมูลอาร์ไคฟ์แบบเต็ม (meta + เนื้อหา data + เนื้อหา backup ทั้งหมด)
// DELETE /api/archives?key=archive:<uid>:<ts>&confirm=DELETE-ARCHIVE-<ts>
//                                                    → ลบอาร์ไคฟ์ทั้งชุด (meta + data + source + backup:*)
//
// โครงสร้าง KV สำหรับอาร์ไคฟ์ (สร้างขึ้นจาก users.js เมื่อลบผู้ใช้):
//   archive:<uid>:<ts>:meta       JSON {username,uid,role,archivedAt,archivedAtLocal,archivedBy,dataSize,backupCount,...}
//   archive:<uid>:<ts>:data       ข้อความ data_js
//   archive:<uid>:<ts>:source     ข้อความ data_source (ทางเลือก)
//   archive:<uid>:<ts>:backup:<bts>   ข้อมูลสำรองแต่ละรายการของผู้ใช้

import { requireAdmin, jsonResponse } from '../_shared/auth.js';

const ARCHIVE_PREFIX = 'archive:';

// ดึงค่า ts จาก archive key (ใช้สำหรับตรวจสอบ DELETE confirm): archive:<uid>:<ts>
function extractTs(archiveKey) {
    const parts = archiveKey.split(':');
    if (parts.length < 3) return null;
    return parts[parts.length - 1];
}

// ตรวจสอบรูปแบบ archiveKey: archive:<uid>:<ts> (ต้องมี 3 ส่วน)
function isValidArchiveKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (!key.startsWith(ARCHIVE_PREFIX)) return false;
    const parts = key.split(':');
    if (parts.length !== 3) return false;
    // ts ต้องอยู่ในรูปแบบ YYYYMMDD_HHMMSS
    if (!/^\d{8}_\d{6}$/.test(parts[2])) return false;
    return true;
}

// ───────────── GET ─────────────
export async function onRequestGet({ request, env }) {
    const fail = await requireAdmin(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    // ── 1. รายละเอียดรายการเดียว ──
    if (key) {
        if (!isValidArchiveKey(key)) {
            return jsonResponse({ ok: false, error: 'archive key ไม่ถูกต้อง' }, 400);
        }
        const metaRaw = await env.FAV_KV.get(key + ':meta');
        if (metaRaw == null) {
            return jsonResponse({ ok: false, error: 'ไม่พบข้อมูลอาร์ไคฟ์' }, 404);
        }
        let meta;
        try { meta = JSON.parse(metaRaw); }
        catch { return jsonResponse({ ok: false, error: 'ข้อมูล meta ของอาร์ไคฟ์เสียหาย' }, 500); }

        // แสดงรายการ backup ทั้งหมดของอาร์ไคฟ์นี้
        const backupListing = await env.FAV_KV.list({ prefix: key + ':backup:' });
        const backupNames = backupListing.keys.map(k => {
            return k.name.substring((key + ':backup:').length);
        });

        const include = url.searchParams.get('include');
        const full = include === 'full';

        // ตรวจสอบว่า data / source ยังอยู่หรือไม่
        const [dataVal, sourceVal] = await Promise.all([
            env.FAV_KV.get(key + ':data'),
            env.FAV_KV.get(key + ':source')
        ]);
        const hasData = dataVal != null;
        const hasSource = sourceVal != null;

        if (!full) {
            return jsonResponse({
                ok: true,
                archiveKey: key,
                meta,
                hasData,
                hasSource,
                backups: backupNames
            });
        }

        // โหมด full: อ่านเนื้อหา backup ทั้งหมดเป็นชุด
        const backupsContent = {};
        const BATCH = 10;
        for (let i = 0; i < backupListing.keys.length; i += BATCH) {
            const batch = backupListing.keys.slice(i, i + BATCH);
            const results = await Promise.all(batch.map(async k => {
                const content = await env.FAV_KV.get(k.name);
                const bts = k.name.substring((key + ':backup:').length);
                return { bts, content };
            }));
            for (const r of results) {
                if (r.content != null) backupsContent[r.bts] = r.content;
            }
        }

        return jsonResponse({
            ok: true,
            archiveKey: key,
            meta,
            hasData,
            hasSource,
            data: dataVal,
            source: sourceVal,
            backups: backupNames,
            backupsContent
        });
    }

    // ── 2. รายการทั้งหมด ──
    const listing = await env.FAV_KV.list({ prefix: ARCHIVE_PREFIX });
    // เอาเฉพาะคีย์ที่ลงท้ายด้วย :meta
    const metaKeys = listing.keys
        .map(k => k.name)
        .filter(name => name.endsWith(':meta'));

    // อ่าน meta แบบเป็นกลุ่มชุด
    const archives = [];
    const BATCH = 10;
    for (let i = 0; i < metaKeys.length; i += BATCH) {
        const batch = metaKeys.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async mk => {
            try {
                const raw = await env.FAV_KV.get(mk);
                if (raw == null) return null;
                const meta = JSON.parse(raw);
                const archiveKey = mk.substring(0, mk.length - ':meta'.length);
                return {
                    archiveKey,
                    username: meta.username || null,
                    uid: meta.uid || null,
                    archivedAt: meta.archivedAt || null,
                    archivedAtLocal: meta.archivedAtLocal || null,
                    archivedBy: meta.archivedBy || null,
                    dataSize: meta.dataSize || 0,
                    backupCount: meta.backupCount || 0,
                    role: meta.role || null
                };
            } catch {
                return null;
            }
        }));
        for (const r of results) if (r) archives.push(r);
    }

    // เรียงตาม archivedAt จากใหม่ไปเก่า
    archives.sort((a, b) => {
        const ta = a.archivedAtLocal || '';
        const tb = b.archivedAtLocal || '';
        return tb.localeCompare(ta);
    });

    return jsonResponse({
        ok: true,
        count: archives.length,
        archives
    });
}

// ───────────── DELETE ─────────────
export async function onRequestDelete({ request, env }) {
    const fail = await requireAdmin(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const confirm = url.searchParams.get('confirm') || '';

    if (!isValidArchiveKey(key)) {
        return jsonResponse({ ok: false, error: 'archive key ไม่ถูกต้อง' }, 400);
    }

    const ts = extractTs(key);
    if (!ts) {
        return jsonResponse({ ok: false, error: 'ไม่สามารถดึง ts จาก key ได้' }, 400);
    }
    const expectedConfirm = 'DELETE-ARCHIVE-' + ts;
    if (confirm !== expectedConfirm) {
        return jsonResponse({
            ok: false,
            error: 'ฟิลด์ confirm ต้องเป็น ' + expectedConfirm
        }, 400);
    }

    // ตรวจสอบว่าอาร์ไคฟ์มีอยู่จริง
    const metaRaw = await env.FAV_KV.get(key + ':meta');
    if (metaRaw == null) {
        return jsonResponse({ ok: false, error: 'ไม่พบข้อมูลอาร์ไคฟ์' }, 404);
    }

    // แสดงรายการคีย์ทั้งหมดของอาร์ไคฟ์นี้ (meta + data + source + backup:*)
    const listing = await env.FAV_KV.list({ prefix: key + ':' });

    // ลบเป็นกลุ่ม
    const errors = [];
    let deletedCount = 0;
    const BATCH = 10;
    for (let i = 0; i < listing.keys.length; i += BATCH) {
        const batch = listing.keys.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async k => {
            try {
                await env.FAV_KV.delete(k.name);
                return { ok: true };
            } catch (e) {
                return { ok: false, key: k.name, error: e.message || String(e) };
            }
        }));
        for (const r of results) {
            if (r.ok) deletedCount++;
            else errors.push({ key: r.key, error: r.error });
        }
    }

    if (errors.length > 0) {
        return jsonResponse({
            ok: false,
            error: 'การลบบางคีย์ล้มเหลว สามารถลองใหม่ได้',
            archiveKey: key,
            deletedCount,
            errors
        }, 500);
    }

    return jsonResponse({
        ok: true,
        archiveKey: key,
        deletedCount
    });
}
