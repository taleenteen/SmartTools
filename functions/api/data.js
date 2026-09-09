// GET /api/data                → คืนค่าข้อความ data.js (เลือก namespace ตามบทบาท)
// GET /api/data?format=json    → คืนค่า JSON { ok, content, source, ... }
// GET /api/data?source=kv|static → บังคับใช้แหล่งข้อมูลที่ระบุ
// GET /api/data?u=<slug>       → โหมดการเข้าถึงสาธารณะ A1.5

import { jsonResponse, getPayload } from '../_shared/auth.js';
import { isValidSlug, getUserBySlug, lookupOldSlugRedirect } from '../_shared/slug.js';

const OLD_DATA_KEY    = 'data_js';
const OLD_SOURCE_KEY  = 'data_source';
const ADMIN_DATA_KEY  = 'admin:data_js';
const ADMIN_SOURCE_KEY = 'admin:data_source';

// A1.5 — พารามิเตอร์ Rate Limit สำหรับ Public slug IP
const SLUG_LOCKOUT_PREFIX = 'lockout:ipublic:';
const SLUG_MAX_ATTEMPTS   = 10;
const SLUG_WINDOW_SECONDS = 1800;
const SLUG_LOCK_SECONDS   = 3600;

// Stub ว่างเปล่าสำหรับผู้ใช้ใหม่
const EMPTY_STUB = `/* data.js ยังไม่ได้ถูกเริ่มต้น */
var usbDriveData = [];
var teachingData = [];
var onlineAIData = [];
var videoData = [];
var emailData = [];
var contactData = [];
var customSections = [];
`;

function userDataKey(uid)   { return 'user:' + uid + ':data_js'; }
function userSourceKey(uid) { return 'user:' + uid + ':data_source'; }

function getClientIP(request) {
    const cf = request.headers.get('CF-Connecting-IP');
    if (cf) return cf.trim();
    const xff = request.headers.get('X-Forwarded-For');
    if (xff) {
        const first = xff.split(',')[0];
        if (first) return first.trim();
    }
    return 'unknown';
}

async function readSlugLockout(env, ip) {
    if (!env.FAV_KV) return null;
    try {
        const r = await env.FAV_KV.getWithMetadata(SLUG_LOCKOUT_PREFIX + ip, { type: 'text' });
        if (!r || r.value == null) return null;
        const count = parseInt(r.value, 10) || 0;
        const expireAt = (r.metadata && r.metadata.expireAt) || 0;
        return { count, expireAt };
    } catch {
        return null;
    }
}

async function recordSlugFailure(env, ip) {
    if (!env.FAV_KV) return;
    try {
        const cur = await readSlugLockout(env, ip);
        const nowSec = Math.floor(Date.now() / 1000);
        const next = (cur ? cur.count : 0) + 1;
        const ttl = next >= SLUG_MAX_ATTEMPTS ? SLUG_LOCK_SECONDS : SLUG_WINDOW_SECONDS;
        const expireAt = nowSec + ttl;
        await env.FAV_KV.put(SLUG_LOCKOUT_PREFIX + ip, String(next), {
            expirationTtl: ttl,
            metadata: { expireAt }
        });
    } catch {}
}

async function clearSlugFailure(env, ip) {
    if (!env.FAV_KV) return;
    try { await env.FAV_KV.delete(SLUG_LOCKOUT_PREFIX + ip); } catch {}
}

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'js';
    const forceSource = url.searchParams.get('source');
    const slugParam = url.searchParams.get('u');

    // ───── การวิเคราะห์ Public slug A1.5 (ความสำคัญสูงกว่า cookie) ─────
    let publicSlug = null;
    let publicUid  = null;
    let publicRole = null;
    let publicOldSlug = null;
    let slugIp     = null;

    if (slugParam) {
        slugIp = getClientIP(request);
        if (isValidSlug(slugParam)) {
            const found = await getUserBySlug(env, slugParam);
            if (found) {
                publicSlug = slugParam;
                publicUid  = found.uid;
                publicRole = found.role || 'user';
                await clearSlugFailure(env, slugIp);
            } else {
                const newSlug = await lookupOldSlugRedirect(env, slugParam);
                if (newSlug && newSlug !== slugParam) {
                    const redirected = await getUserBySlug(env, newSlug);
                    if (redirected) {
                        publicSlug = newSlug;
                        publicUid  = redirected.uid;
                        publicRole = redirected.role || 'user';
                        publicOldSlug = slugParam;
                        await clearSlugFailure(env, slugIp);
                    }
                }
            }
        }
        if (!publicSlug) {
            const lock = await readSlugLockout(env, slugIp);
            const nowSec = Math.floor(Date.now() / 1000);
            if (lock && lock.count >= SLUG_MAX_ATTEMPTS && lock.expireAt > nowSec) {
                return jsonResponse(
                    { ok: false, error: 'มีคำขอถี่เกินไป โปรดลองใหม่อีกครั้งในภายหลัง' },
                    429,
                    { 'Retry-After': String(lock.expireAt - nowSec) }
                );
            }
            await recordSlugFailure(env, slugIp);
        }
    }

    // ───── กำหนด namespace ─────
    let ns, uid, isLoggedIn, role;
    let isPublicSlugMode = false;

    if (publicSlug) {
        uid = publicUid;
        isLoggedIn = false;
        role = publicRole;
        ns = (publicRole === 'admin') ? 'admin' : 'user';
        isPublicSlugMode = true;
    } else {
        const payload = await getPayload(request, env);
        isLoggedIn = !!payload;
        role = isLoggedIn ? (payload.role || 'user') : null;
        uid  = isLoggedIn ? (payload.uid != null ? payload.uid : payload.u) : null;
        ns = (role === 'user') ? 'user' : 'admin';
    }

    // ───── เลือกคีย์ source / data ─────
    let dataKey, sourceKey, fallbackOldDataKey = null;
    if (ns === 'admin') {
        dataKey   = ADMIN_DATA_KEY;
        sourceKey = ADMIN_SOURCE_KEY;
        fallbackOldDataKey = OLD_DATA_KEY;
    } else {
        dataKey   = userDataKey(uid);
        sourceKey = userSourceKey(uid);
    }

    // อ่าน source + data พร้อมกัน
    let source = 'static';
    let kvContent = null;
    if (env.FAV_KV) {
        const [saved, dataResult] = await Promise.all([
            env.FAV_KV.get(sourceKey),
            env.FAV_KV.get(dataKey)
        ]);
        if (saved === 'kv' || saved === 'static') source = saved;
        kvContent = dataResult || null;

        if (ns === 'admin') {
            if (kvContent == null && fallbackOldDataKey) {
                const legacy = await env.FAV_KV.get(fallbackOldDataKey);
                if (legacy != null) kvContent = legacy;
            }
            if (source !== 'kv' && source !== 'static') {
                const legacySrc = await env.FAV_KV.get(OLD_SOURCE_KEY);
                if (legacySrc === 'kv' || legacySrc === 'static') source = legacySrc;
            }
        }
    }
    if (forceSource === 'kv' || forceSource === 'static') source = forceSource;

    let content = null;
    let actualSource = source;

    if (source === 'kv' && env.FAV_KV) {
        content = kvContent;
        if (!content) {
            actualSource = 'static-fallback';
        }
    }

    // อ่าน static data.js จาก repo หากไม่มีใน KV หรือ source=static
    if (!content && ns === 'admin') {
        const fallbackUrl = new URL('/data.js', request.url);
        try {
            if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
                const r = await env.ASSETS.fetch(fallbackUrl.toString());
                if (r.ok) content = await r.text();
            }
        } catch {}
        if (!content) {
            try {
                const r = await fetch(fallbackUrl.toString(), { cf: { cacheTtl: 0 } });
                if (r.ok) content = await r.text();
            } catch {}
        }
    }

    if (!content) {
        content = EMPTY_STUB;
        actualSource = (ns === 'user') ? 'user-empty' : 'empty';
    }

    let publicSlugInfoLine = '';
    if (slugParam) {
        const info = isPublicSlugMode
            ? { hit: true, slug: publicSlug, uid: publicUid,
                oldSlug: publicOldSlug || null }
            : { hit: false };
        publicSlugInfoLine = 'window.__publicSlugInfo = ' + JSON.stringify(info) + ';\n';
    }

    let viewerInfoLine = '';
    {
        let viewerUsername = null;
        let viewerSlug = null;
        if (isPublicSlugMode) {
            viewerSlug = publicSlug;
        } else if (ns === 'user' && uid && env.FAV_KV) {
            try {
                const usersRaw = await env.FAV_KV.get('users');
                if (usersRaw) {
                    const usersTab = JSON.parse(usersRaw) || {};
                    const me = usersTab[uid];
                    if (me) {
                        viewerUsername = uid;
                        if (me.publicEnabled && me.publicSlug) viewerSlug = me.publicSlug;
                    }
                }
            } catch {}
        }
        const viewerInfo = {
            isAdminView: ns === 'admin',
            slug: viewerSlug || null,
            username: viewerUsername || null
        };
        viewerInfoLine = 'window.__viewerInfo = ' + JSON.stringify(viewerInfo) + ';\n';
    }

    if (format === 'json') {
        return jsonResponse({
            ok: true,
            content,
            source: actualSource,
            configured: source,
            namespace: ns,
            uid: uid,
            publicSlug: isPublicSlugMode ? publicSlug : null,
            publicSlugHit: isPublicSlugMode,
            publicOldSlug: publicOldSlug || null
        });
    }

    const finalContent = publicSlugInfoLine + viewerInfoLine + content;

    const cacheHeader = (isLoggedIn && !isPublicSlugMode)
        ? 'private, no-store'
        : 'public, max-age=30, s-maxage=60, stale-while-revalidate=300';

    const headers = {
        'Content-Type': 'application/javascript;charset=utf-8',
        'Cache-Control': cacheHeader,
        'X-Data-Source': actualSource,
        'X-Data-Namespace': ns
    };
    if (isPublicSlugMode) {
        headers['X-Public-Slug'] = publicSlug;
        if (publicOldSlug) {
            headers['X-Public-Old-Slug'] = publicOldSlug;
        }
    }

    return new Response(finalContent, { headers });
}
