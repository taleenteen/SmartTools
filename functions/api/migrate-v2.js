// POST /api/migrate-v2  → ย้าย namespace ของ KV เดิมไปยัง prefix admin:
//   body: { dryRun: true|false }  default false
//   admin only

import { requireAdmin, jsonResponse } from '../_shared/auth.js';

const OLD_DATA_KEY    = 'data_js';
const OLD_SOURCE_KEY  = 'data_source';
const OLD_BACKUP_PREF = 'backup:';

const NEW_DATA_KEY    = 'admin:data_js';
const NEW_SOURCE_KEY  = 'admin:data_source';
const NEW_BACKUP_PREF = 'admin:backup:';

const MIGRATION_DONE_KEY = 'migration:v2:done';

function timestamp() {
    const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const p = n => String(n).padStart(2, '0');
    return d.getUTCFullYear() +
           p(d.getUTCMonth() + 1) +
           p(d.getUTCDate()) + '_' +
           p(d.getUTCHours()) +
           p(d.getUTCMinutes()) +
           p(d.getUTCSeconds());
}

export async function onRequestPost({ request, env }) {
    // 1. ตรวจสอบสิทธิ์ admin
    const fail = await requireAdmin(request, env);
    if (fail) return fail;

    if (!env.FAV_KV) {
        return jsonResponse({ ok: false, error: 'ยังไม่ได้ผูก KV (FAV_KV)' }, 500);
    }

    // 2. แยกวิเคราะห์พารามิเตอร์
    let body = {};
    try { body = await request.json(); } catch { /* อนุญาตให้ body ว่าง */ }
    const dryRun = body && body.dryRun === true;

    // 3. วางแผนการย้ายข้อมูล
    const plan = {
        dryRun,
        dataJs:     { old: OLD_DATA_KEY,   new: NEW_DATA_KEY,   action: 'skip', reason: '' },
        dataSource: { old: OLD_SOURCE_KEY, new: NEW_SOURCE_KEY, action: 'skip', reason: '' },
        backups:    []   // [{ old, new, action, reason }]
    };

    // 3a. data_js
    {
        const [oldVal, newVal] = await Promise.all([
            env.FAV_KV.get(OLD_DATA_KEY),
            env.FAV_KV.get(NEW_DATA_KEY)
        ]);
        if (newVal != null) {
            plan.dataJs.action = 'skip';
            plan.dataJs.reason = 'admin:data_js already exists';
        } else if (oldVal == null) {
            plan.dataJs.action = 'skip';
            plan.dataJs.reason = 'no legacy data_js to migrate';
        } else {
            plan.dataJs.action = 'copy';
            plan.dataJs.bytes = oldVal.length;
            plan.dataJs._payload = oldVal;
        }
    }

    // 3b. data_source
    {
        const [oldVal, newVal] = await Promise.all([
            env.FAV_KV.get(OLD_SOURCE_KEY),
            env.FAV_KV.get(NEW_SOURCE_KEY)
        ]);
        if (newVal != null) {
            plan.dataSource.action = 'skip';
            plan.dataSource.reason = 'admin:data_source already exists';
        } else if (oldVal == null) {
            plan.dataSource.action = 'skip';
            plan.dataSource.reason = 'no legacy data_source to migrate';
        } else {
            plan.dataSource.action = 'copy';
            plan.dataSource.value = oldVal;
            plan.dataSource._payload = oldVal;
        }
    }

    // 3c. backup:*
    {
        const oldList = await env.FAV_KV.list({ prefix: OLD_BACKUP_PREF });
        const newList = await env.FAV_KV.list({ prefix: NEW_BACKUP_PREF });
        const newSet = new Set(newList.keys.map(k => k.name));

        for (const k of oldList.keys) {
            const ts = k.name.substring(OLD_BACKUP_PREF.length);
            const newKey = NEW_BACKUP_PREF + ts;
            if (newSet.has(newKey)) {
                plan.backups.push({ old: k.name, new: newKey, action: 'skip', reason: 'already exists' });
            } else {
                plan.backups.push({ old: k.name, new: newKey, action: 'copy' });
            }
        }
    }

    // 4. โหมด dryRun → ส่งกลับเฉพาะแผนงาน
    if (dryRun) {
        const cleanPlan = JSON.parse(JSON.stringify(plan, (k, v) => k === '_payload' ? undefined : v));
        const wouldCopy = countCopy(cleanPlan);
        return jsonResponse({
            ok: true,
            dryRun: true,
            wouldCopy,
            plan: cleanPlan
        });
    }

    // 5. ดำเนินการจริง
    const errors = [];
    const result = {
        dataJs:     plan.dataJs.action === 'skip' ? 'skip' : 'pending',
        dataSource: plan.dataSource.action === 'skip' ? 'skip' : 'pending',
        backups:    { total: plan.backups.length, copied: 0, skipped: 0, failed: 0 }
    };

    // 5a. คัดลอก data_js
    if (plan.dataJs.action === 'copy') {
        try {
            await env.FAV_KV.put(NEW_DATA_KEY, plan.dataJs._payload);
            result.dataJs = 'copied';
        } catch (e) {
            result.dataJs = 'failed';
            errors.push({ step: 'data_js', error: e.message || String(e) });
        }
    }

    // 5b. คัดลอก data_source
    if (plan.dataSource.action === 'copy') {
        try {
            await env.FAV_KV.put(NEW_SOURCE_KEY, plan.dataSource._payload);
            result.dataSource = 'copied';
        } catch (e) {
            result.dataSource = 'failed';
            errors.push({ step: 'data_source', error: e.message || String(e) });
        }
    }

    // 5c. คัดลอก backup:* เป็นกลุ่ม
    {
        const toCopy = plan.backups.filter(b => b.action === 'copy');
        result.backups.skipped = plan.backups.length - toCopy.length;
        const BATCH = 10;
        for (let i = 0; i < toCopy.length; i += BATCH) {
            const batch = toCopy.slice(i, i + BATCH);
            const results = await Promise.all(batch.map(async b => {
                try {
                    const content = await env.FAV_KV.get(b.old);
                    if (content == null) {
                        return { name: b.old, ok: false, reason: 'disappeared' };
                    }
                    await env.FAV_KV.put(b.new, content);
                    return { name: b.old, ok: true };
                } catch (e) {
                    return { name: b.old, ok: false, reason: e.message || String(e) };
                }
            }));
            for (const r of results) {
                if (r.ok) result.backups.copied++;
                else {
                    result.backups.failed++;
                    errors.push({ step: 'backup:' + r.name, error: r.reason });
                }
            }
        }
    }

    // 6. บันทึกเครื่องหมายเสร็จสิ้น
    const allOk = errors.length === 0;
    if (allOk) {
        try {
            await env.FAV_KV.put(MIGRATION_DONE_KEY, timestamp());
        } catch (e) {
            errors.push({ step: 'migration_done_marker', error: e.message || String(e) });
        }
    }

    return jsonResponse({
        ok: allOk,
        dryRun: false,
        result,
        errors,
        markerWritten: allOk && errors.length === 0,
        note: allOk
            ? 'การย้ายข้อมูลเสร็จสมบูรณ์ คีย์เดิมถูกเก็บไว้เพื่อใช้เป็นช่องทาง rollback'
            : 'บางรายการล้มเหลว โปรดตรวจสอบ errors แล้วลองใหม่อีกครั้ง'
    });
}

function countCopy(plan) {
    let n = 0;
    if (plan.dataJs.action === 'copy') n++;
    if (plan.dataSource.action === 'copy') n++;
    n += plan.backups.filter(b => b.action === 'copy').length;
    return n;
}
