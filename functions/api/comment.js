import { requireAuth, jsonResponse, getPayload } from '../_shared/auth.js';

/* ================================================================================
 * /api/comment —— การ patch ฟิลด์ comment ของการ์ดอย่างแม่นยำ
 * ================================================================================ */

const MAX_BACKUPS = 100;
const PRUNE_PROBABILITY = 0.2;
const USERS_KEY = 'users';

function nsKeys(ns) {
    return {
        data:    `${ns}:data_js`,
        source:  `${ns}:data_source`,
        backupP: `${ns}:backup:`
    };
}

const _sourceConfirmedKv = new Set();

export async function onRequestPost({ request, env }) {
    const fail = await requireAuth(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV (FAV_KV)' }, 500);

    const payload = await getPayload(request, env);
    const role = (payload && payload.role) || 'user';
    const uid  = payload && (payload.uid != null ? payload.uid : payload.u);
    const ns   = role === 'admin' ? 'admin' : `user:${uid}`;
    const isUser = role !== 'admin';
    const KEYS = nsKeys(ns);

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }, 400); }

    const { path, comment } = body || {};
    if (!Array.isArray(path) || path.length < 2) {
        return jsonResponse({ ok: false, error: 'ไม่มี path หรือ path ไม่ถูกต้อง' }, 400);
    }
    if (typeof comment !== 'string') {
        return jsonResponse({ ok: false, error: 'comment ต้องเป็นสตริง' }, 400);
    }
    const targetField = path[path.length - 1];
    if (targetField !== 'comment' && targetField !== 'pushedBy') {
        return jsonResponse({ ok: false, error: 'path ต้องลงท้ายด้วย comment หรือ pushedBy' }, 400);
    }
    if (targetField === 'pushedBy' && comment !== '') {
        return jsonResponse({ ok: false, error: 'ฟิลด์ pushedBy อนุญาตให้ตั้งเป็นค่าว่าง (ลบ) เท่านั้น' }, 400);
    }

    const old = await env.FAV_KV.get(KEYS.data);
    if (!old) return jsonResponse({ ok: false, error: 'ไม่พบไฟล์ข้อมูลใน KV' }, 404);

    let patched;
    try {
        patched = patchCommentInSource(old, path, comment);
    } catch (e) {
        return jsonResponse({ ok: false, error: 'การระบุตำแหน่ง/แก้ไขล้มเหลว: ' + (e.message || e) }, 400);
    }

    if (patched === old) {
        return jsonResponse({ ok: true, unchanged: true, backup: null, namespace: ns });
    }

    let backupName = null;
    if (old.trim()) {
        backupName = KEYS.backupP + timestamp();
        await env.FAV_KV.put(backupName, old);
        if (Math.random() < PRUNE_PROBABILITY) {
            try { await pruneBackups(env.FAV_KV, KEYS.backupP); } catch {}
        }
    }

    const writes = [env.FAV_KV.put(KEYS.data, patched)];
    if (!_sourceConfirmedKv.has(ns)) {
        const currentSource = await env.FAV_KV.get(KEYS.source);
        if (currentSource !== 'kv') {
            writes.push(env.FAV_KV.put(KEYS.source, 'kv'));
        }
        _sourceConfirmedKv.add(ns);
    }
    await Promise.all(writes);

    if (isUser && uid) {
        try {
            const raw = await env.FAV_KV.get(USERS_KEY);
            const users = raw ? JSON.parse(raw) : {};
            if (users[uid] && !users[uid].hasData) {
                users[uid].hasData = true;
                await env.FAV_KV.put(USERS_KEY, JSON.stringify(users));
            }
        } catch (e) {
            console.warn('hasData update failed for', uid, e && e.message);
        }
    }

    return jsonResponse({ ok: true, backup: backupName, namespace: ns });
}

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

async function pruneBackups(kv, prefix) {
    const list = await kv.list({ prefix });
    if (list.keys.length <= MAX_BACKUPS) return;
    const sorted = list.keys.sort((a, b) => a.name.localeCompare(b.name));
    const toDelete = sorted.slice(0, sorted.length - MAX_BACKUPS);
    await Promise.all(toDelete.map(k => kv.delete(k.name)));
}

function patchCommentInSource(src, path, comment) {
    const firstSeg = path[0];

    let pos;
    if (firstSeg === 'sections') {
        const varPos = findTopLevelVarDecl(src, 'sections');
        if (varPos < 0) throw new Error('ไม่พบตัวแปร sections');
        const eqPos = src.indexOf('=', varPos);
        if (eqPos < 0) throw new Error('การประกาศตัวแปรไม่มีเครื่องหมาย =');
        pos = skipWs(src, eqPos + 1);

        for (let i = 1; i < path.length - 1; i++) {
            const seg = path[i];
            if (typeof seg === 'number') {
                if (src[pos] !== '[') throw new Error('การนำทางส่วนที่ ' + i + ' คาดหวัง [ แต่พบ: ' + src[pos]);
                pos = enterArrayIndex(src, pos, seg);
            } else if (typeof seg === 'string') {
                if (src[pos] !== '{') throw new Error('การนำทางส่วนที่ ' + i + ' คาดหวัง { แต่พบ: ' + src[pos]);
                pos = enterObjectKey(src, pos, seg);
            } else {
                throw new Error('ประเภทส่วนของ path ไม่ถูกต้อง');
            }
        }
    } else {
        const varPos = findTopLevelVarDecl(src, firstSeg);
        if (varPos < 0) throw new Error('ไม่พบตัวแปร ' + firstSeg);
        const eqPos = src.indexOf('=', varPos);
        if (eqPos < 0) throw new Error('การประกาศตัวแปรไม่มีเครื่องหมาย =');
        pos = skipWs(src, eqPos + 1);

        for (let i = 1; i < path.length - 1; i++) {
            const seg = path[i];
            if (typeof seg === 'number') {
                if (src[pos] !== '[') throw new Error('การนำทางส่วนที่ ' + i + ' คาดหวัง [ แต่พบ: ' + src[pos]);
                pos = enterArrayIndex(src, pos, seg);
            } else if (typeof seg === 'string') {
                if (src[pos] !== '{') throw new Error('การนำทางส่วนที่ ' + i + ' คาดหวัง { แต่พบ: ' + src[pos]);
                pos = enterObjectKey(src, pos, seg);
            } else {
                throw new Error('ประเภทส่วนของ path ไม่ถูกต้อง');
            }
        }
    }

    if (src[pos] !== '{') throw new Error('จุดเริ่มต้นของออบเจ็กต์การ์ดเป้าหมายไม่ใช่ {');
    const fieldName = path[path.length - 1];
    return updateCommentInObject(src, pos, comment, fieldName);
}

function isWs(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r'; }
function isIdChar(c) {
    return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '_' || c === '$';
}

// ข้าม whitespace + ความคิดเห็น
function skipWs(src, pos) {
    const n = src.length;
    while (pos < n) {
        const c = src[pos];
        if (isWs(c)) { pos++; continue; }
        if (c === '/' && src[pos + 1] === '/') {
            while (pos < n && src[pos] !== '\n') pos++;
            continue;
        }
        if (c === '/' && src[pos + 1] === '*') {
            pos += 2;
            while (pos + 1 < n && !(src[pos] === '*' && src[pos + 1] === '/')) pos++;
            pos += 2;
            continue;
        }
        break;
    }
    return pos;
}

// ข้ามสตริงจากตำแหน่งเครื่องหมายคำพูดจนถึงจุดสิ้นสุด
function skipString(src, pos) {
    const quote = src[pos];
    pos++;
    const n = src.length;
    while (pos < n) {
        const c = src[pos];
        if (c === '\\') { pos += 2; continue; }
        if (c === quote) return pos + 1;
        pos++;
    }
    throw new Error('สตริงไม่ได้ปิดสมบูรณ์ @ ' + pos);
}

// ข้าม {...} หรือ [...] ที่สมดุล
function skipBalanced(src, pos, open, close) {
    if (src[pos] !== open) throw new Error('คาดหวัง ' + open);
    pos++;
    let depth = 1;
    const n = src.length;
    while (pos < n && depth > 0) {
        const c = src[pos];
        if (c === '"' || c === "'" || c === '`') { pos = skipString(src, pos); continue; }
        if (c === '/' && src[pos + 1] === '/') {
            while (pos < n && src[pos] !== '\n') pos++;
            continue;
        }
        if (c === '/' && src[pos + 1] === '*') {
            pos += 2;
            while (pos + 1 < n && !(src[pos] === '*' && src[pos + 1] === '/')) pos++;
            pos += 2;
            continue;
        }
        if (c === open) depth++;
        else if (c === close) depth--;
        pos++;
    }
    if (depth !== 0) throw new Error('วงเล็บไม่ได้ปิดสมบูรณ์');
    return pos;
}

// ข้ามค่า JS หนึ่งค่า (object/array/string/number/boolean/null)
function skipValue(src, pos) {
    pos = skipWs(src, pos);
    const c = src[pos];
    if (c === '{') return skipBalanced(src, pos, '{', '}');
    if (c === '[') return skipBalanced(src, pos, '[', ']');
    if (c === '"' || c === "'" || c === '`') return skipString(src, pos);
    const n = src.length;
    while (pos < n) {
        const ch = src[pos];
        if (ch === ',' || ch === '}' || ch === ']') break;
        if (isWs(ch)) break;
        if (ch === '/' && (src[pos + 1] === '/' || src[pos + 1] === '*')) break;
        pos++;
    }
    return pos;
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ค้นหาตำแหน่งการประกาศตัวแปรระดับบนสุด const/let/var <name> = ...
function findTopLevelVarDecl(src, varName) {
    const pattern = new RegExp('^(const|let|var)\\s+' + escapeRegExp(varName) + '\\s*=');
    const n = src.length;
    let pos = 0;
    while (pos < n) {
        const c = src[pos];
        if (c === '"' || c === "'" || c === '`') { pos = skipString(src, pos); continue; }
        if (c === '/' && src[pos + 1] === '/') {
            while (pos < n && src[pos] !== '\n') pos++;
            continue;
        }
        if (c === '/' && src[pos + 1] === '*') {
            pos += 2;
            while (pos + 1 < n && !(src[pos] === '*' && src[pos + 1] === '/')) pos++;
            pos += 2;
            continue;
        }
        if ((c === 'c' || c === 'l' || c === 'v') && (pos === 0 || !isIdChar(src[pos - 1]))) {
            const chunk = src.substring(pos, Math.min(pos + varName.length + 16, n));
            if (pattern.test(chunk)) return pos;
        }
        pos++;
    }
    return -1;
}

// เข้าถึงสมาชิกตัวที่ idx ในอาร์เรย์
function enterArrayIndex(src, pos, idx) {
    if (src[pos] !== '[') throw new Error('คาดหวัง [');
    pos++;
    pos = skipWs(src, pos);
    for (let i = 0; i < idx; i++) {
        pos = skipValue(src, pos);
        pos = skipWs(src, pos);
        if (src[pos] !== ',') throw new Error('ดัชนีอาร์เรย์เกินขอบเขต: ต้องการ ' + idx + ' แต่สิ้นสุดที่ ' + i);
        pos++;
        pos = skipWs(src, pos);
    }
    return pos;
}

// อ่านคีย์ของออบเจ็กต์
function readKey(src, pos) {
    const c = src[pos];
    if (c === '"' || c === "'" || c === '`') {
        const end = skipString(src, pos);
        const raw = src.substring(pos + 1, end - 1);
        return { name: raw.replace(/\\(.)/g, '$1'), end };
    }
    const n = src.length;
    const start = pos;
    while (pos < n && isIdChar(src[pos])) pos++;
    if (pos === start) throw new Error('ไม่สามารถอ่านชื่อคีย์ได้ @ ' + pos);
    return { name: src.substring(start, pos), end: pos };
}

// เข้าถึงค่าของคีย์ key ในออบเจ็กต์
function enterObjectKey(src, pos, key) {
    if (src[pos] !== '{') throw new Error('คาดหวัง {');
    pos++;
    const n = src.length;
    while (pos < n) {
        pos = skipWs(src, pos);
        if (src[pos] === '}') throw new Error('ไม่พบคีย์ในออบเจ็กต์ ' + key);
        const keyInfo = readKey(src, pos);
        pos = keyInfo.end;
        pos = skipWs(src, pos);
        if (src[pos] !== ':') throw new Error('หลังคีย์ ' + keyInfo.name + ' คาดหวัง :');
        pos++;
        pos = skipWs(src, pos);
        if (keyInfo.name === key) return pos;
        pos = skipValue(src, pos);
        pos = skipWs(src, pos);
        if (src[pos] === ',') { pos++; continue; }
        if (src[pos] === '}') throw new Error('ไม่พบคีย์ในออบเจ็กต์ ' + key);
    }
    throw new Error('การแยกวิเคราะห์ออบเจ็กต์ล้มเหลว');
}

// แก้ไข/ลบ/แทรกฟิลด์ในออบเจ็กต์
function updateCommentInObject(src, objStart, newComment, fieldName) {
    if (!fieldName) fieldName = 'comment';
    if (src[objStart] !== '{') throw new Error('คาดหวัง {');
    const n = src.length;
    let pos = objStart + 1;
    let fieldStart = -1, fieldValStart = -1, fieldValEnd = -1;

    while (pos < n) {
        pos = skipWs(src, pos);
        if (src[pos] === '}') break;
        const entryStart = pos;
        const keyInfo = readKey(src, pos);
        pos = keyInfo.end;
        pos = skipWs(src, pos);
        if (src[pos] !== ':') throw new Error('หลังคีย์ ' + keyInfo.name + ' คาดหวัง :');
        pos++;
        pos = skipWs(src, pos);
        const valStart = pos;
        pos = skipValue(src, pos);
        const valEnd = pos;
        if (keyInfo.name === fieldName) {
            fieldStart = entryStart;
            fieldValStart = valStart;
            fieldValEnd = valEnd;
            break;
        }
        pos = skipWs(src, pos);
        if (src[pos] === ',') { pos++; continue; }
        if (src[pos] === '}') break;
    }

    if (fieldStart >= 0) {
        if (newComment === '') {
            let delEnd = fieldValEnd;
            const after = skipWs(src, delEnd);
            if (src[after] === ',') {
                delEnd = after + 1;
            } else if (src[after] === '}') {
                let before = fieldStart - 1;
                while (before >= 0 && isWs(src[before])) before--;
                if (before >= 0 && src[before] === ',') {
                    fieldStart = before;
                }
                delEnd = after;
            }
            let cleaned = src.substring(0, fieldStart) + src.substring(delEnd);
            if (fieldName === 'pushedBy') {
                cleaned = removeFieldFromObject(cleaned, objStart, 'pushedAt');
            }
            return cleaned;
        }
        return src.substring(0, fieldValStart) + JSON.stringify(newComment) + src.substring(fieldValEnd);
    }

    if (newComment === '') return src;
    const objEnd = skipBalanced(src, objStart, '{', '}');
    const braceIdx = objEnd - 1;
    const firstInside = skipWs(src, objStart + 1);
    let insertion;
    if (firstInside === braceIdx) {
        insertion = ' ' + fieldName + ': ' + JSON.stringify(newComment) + ' ';
    } else {
        let beforeBrace = braceIdx - 1;
        while (beforeBrace > objStart && isWs(src[beforeBrace])) beforeBrace--;
        if (src[beforeBrace] === ',') {
            insertion = ' ' + fieldName + ': ' + JSON.stringify(newComment);
        } else {
            insertion = ', ' + fieldName + ': ' + JSON.stringify(newComment);
        }
    }
    return src.substring(0, braceIdx) + insertion + src.substring(braceIdx);
}

// ลบฟิลด์ออกจากออบเจ็กต์
function removeFieldFromObject(src, objStart, fieldName) {
    if (src[objStart] !== '{') return src;
    const n = src.length;
    let pos = objStart + 1;
    while (pos < n) {
        pos = skipWs(src, pos);
        if (src[pos] === '}') return src;
        const entryStart = pos;
        let keyInfo;
        try { keyInfo = readKey(src, pos); } catch { return src; }
        pos = keyInfo.end;
        pos = skipWs(src, pos);
        if (src[pos] !== ':') return src;
        pos++;
        pos = skipWs(src, pos);
        pos = skipValue(src, pos);
        const valEnd = pos;
        if (keyInfo.name === fieldName) {
            let delEnd = valEnd;
            const after = skipWs(src, delEnd);
            if (src[after] === ',') {
                delEnd = after + 1;
            } else if (src[after] === '}') {
                let before = entryStart - 1;
                while (before >= 0 && isWs(src[before])) before--;
                if (before >= 0 && src[before] === ',') {
                    return src.substring(0, before) + src.substring(after);
                }
                delEnd = after;
            }
            return src.substring(0, entryStart) + src.substring(delEnd);
        }
        pos = skipWs(src, pos);
        if (src[pos] === ',') { pos++; continue; }
        if (src[pos] === '}') break;
    }
    return src;
}