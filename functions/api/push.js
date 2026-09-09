// จุดจัดการพุชการ์ด A2-1 (Admin only)
//
// POST /api/push
//   body: {
//     target_users: ['alice', 'bob'],
//     section_key:  'videoData' | null,
//     cards: [{type, title, url, ...}],
//     message:      'ข้อความ Markdown',
//     mode:         'append' | 'force'
//   }

import {
    requireAdmin,
    jsonResponse,
    isValidUsername,
    getUsername,
    getPayload
} from '../_shared/auth.js';
import { trySanitizeMarkdown } from '../_shared/markdown-sanitize.js';

const USERS_KEY = 'users';
const MAX_BACKUPS = 100;
const PRUNE_PROBABILITY = 0.2;

const BUILTIN_KEYS = ['usbDriveData', 'teachingData', 'onlineAIData', 'videoData', 'emailData', 'contactData'];
const UNCLASSIFIED_KEY = 'custom_unclassified';
const ALLOWED_KEYS_FOR_PUSH = [...BUILTIN_KEYS, UNCLASSIFIED_KEY];

// inbox KV keys
const INBOX_PREFIX = 'inbox:';
const INBOX_LIST_PREFIX = 'inbox-list:';
const MAX_MESSAGE_LEN = 500;
function inboxKey(uid, msgId) { return INBOX_PREFIX + uid + ':' + msgId; }
function inboxListKey(uid)    { return INBOX_LIST_PREFIX + uid; }
function sentKey(uid, msgId) { return 'user:' + uid + ':sent:' + msgId; }
function sentListKey(uid)    { return 'user:' + uid + ':sent-list'; }

// ไวต์ลิสต์ฟิลด์ของการ์ด
const ALLOWED_CARD_FIELDS = new Set([
    'type', 'title', 'url', 'desc', 'icon', 'iconImg', 'isLocal',
    'descClickable', 'descUrl', 'content', 'address', 'mailto', 'note',
    'comment', 'id', 'subCards',
    'pushedBy', 'pushedAt'
]);

const MAX_FIELD_LEN = 8000;
const MAX_CARDS_PER_PUSH = 100;
const MAX_TARGETS = 50;

function emptyUserDataSkeleton() {
    return `var sections = [
    { builtin: true, key: 'usbDriveData', kind: 'card', label: '☁️ ไดรฟ์ออนไลน์', visible: true, cards: [] },
    { builtin: true, key: 'teachingData', kind: 'card', label: '📚 สื่อการสอน', visible: true, cards: [] },
    { builtin: true, key: 'onlineAIData', kind: 'card', label: '🌐 แหล่งข้อมูลออนไลน์', visible: true, cards: [] },
    { builtin: true, key: 'videoData', kind: 'card', label: '🎬 วิดีโอรวม', visible: true, cards: [] },
    { builtin: true, key: 'emailData', kind: 'email', label: '📧 อีเมล', visible: true, cards: [] },
    { builtin: true, key: 'contactData', kind: 'contact', label: '📱 ช่องทางติดต่อ', visible: true, cards: [] }
];
`;
}

function sanitizeCard(card) {
    const clean = {};
    for (const k of Object.keys(card || {})) {
        if (!ALLOWED_CARD_FIELDS.has(k)) continue;
        let v = card[k];
        if (typeof v === 'string' && v.length > MAX_FIELD_LEN) v = v.slice(0, MAX_FIELD_LEN);
        clean[k] = v;
    }
    return clean;
}

function generateCardId() {
    return 'card_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function timestamp() {
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const p = n => String(n).padStart(2, '0');
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '_' +
           p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds());
}

async function pruneBackups(kv, prefix) {
    const list = await kv.list({ prefix });
    if (list.keys.length <= MAX_BACKUPS) return;
    const sorted = list.keys.sort((a, b) => a.name.localeCompare(b.name));
    const toDelete = sorted.slice(0, sorted.length - MAX_BACKUPS);
    await Promise.all(toDelete.map(k => kv.delete(k.name)));
}

export async function onRequestPost({ request, env }) {
    const fail = await requireAdmin(request, env);
    if (fail) return fail;
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }, 400); }

    const { target_users, section_key, cards, message: rawMessage, mode = 'append' } = body || {};

    if (!Array.isArray(target_users) || target_users.length === 0) {
        return jsonResponse({ ok: false, error: 'target_users ต้องเป็นอาร์เรย์ที่ไม่ว่างเปล่า' }, 400);
    }
    if (target_users.length > MAX_TARGETS) {
        return jsonResponse({ ok: false, error: 'จำนวน target_users สูงสุดไม่เกิน ' + MAX_TARGETS }, 400);
    }
    for (const u of target_users) {
        if (!isValidUsername(u)) {
            return jsonResponse({ ok: false, error: 'ชื่อผู้ใช้ไม่ถูกต้อง: ' + u }, 400);
        }
    }
    const targetSecKey = section_key || UNCLASSIFIED_KEY;
    if (!ALLOWED_KEYS_FOR_PUSH.includes(targetSecKey)) {
        return jsonResponse({ ok: false, error: 'ไม่อนุญาตให้พุชไปยัง section นี้: ' + targetSecKey }, 400);
    }
    if (!Array.isArray(cards) || cards.length === 0) {
        return jsonResponse({ ok: false, error: 'cards ต้องเป็นอาร์เรย์ที่ไม่ว่างเปล่า' }, 400);
    }
    if (cards.length > MAX_CARDS_PER_PUSH) {
        return jsonResponse({ ok: false, error: 'จำนวน cards สูงสุดไม่เกิน ' + MAX_CARDS_PER_PUSH }, 400);
    }
    if (mode !== 'append' && mode !== 'force') {
        return jsonResponse({ ok: false, error: 'ไม่รองรับ mode: ' + mode }, 400);
    }
    if (mode === 'force' && cards.length > 1) {
        return jsonResponse({ ok: false, error: 'การพุชแบบบังคับ (force) ทำได้ครั้งละ 1 การ์ดเท่านั้น' }, 400);
    }
    if (mode === 'force' && cards.some(c => c && c.__fromEncrypted === true)) {
        return jsonResponse({ ok: false, error: 'การ์ดจากหมวดหมู่ที่เข้ารหัสไม่สามารถพุชแบบบังคับได้ ต้องใช้การส่งแบบปกติเพื่อให้ผู้รับบันทึกลงหมวดหมู่ที่เข้ารหัส' }, 400);
    }

    let cleanMessage = '';
    if (rawMessage != null && rawMessage !== '') {
        const sanRes = trySanitizeMarkdown(String(rawMessage), { maxLength: MAX_MESSAGE_LEN });
        if (!sanRes.ok) {
            return jsonResponse({ ok: false, error: 'ข้อความไม่ถูกต้อง: ' + sanRes.error, code: sanRes.code }, 400);
        }
        cleanMessage = sanRes.text;
    }

    const fromEncrypted = cards.some(c => c && c.__fromEncrypted === true);
    const cleanCards = cards.map(c => {
        const clean = sanitizeCard(c);
        if (!clean.id) clean.id = generateCardId();
        return clean;
    });

    const pushedBy = (await getUsername(request, env)) || '__unknown__';
    const callerPayload = await getPayload(request, env);
    const callerRole = (callerPayload && callerPayload.role) || 'admin';
    const callerUid = (callerPayload && (callerPayload.uid != null ? callerPayload.uid : callerPayload.u)) || pushedBy;

    const usersRaw = await env.FAV_KV.get(USERS_KEY);
    const users = usersRaw ? JSON.parse(usersRaw) : {};

    // ─────────────────────────────────────────────────────────────
    // โหมด A: append (ปกติ) — เขียนลง inbox รอการตรวจสอบ
    // ─────────────────────────────────────────────────────────────
    if (mode === 'append') {
        const successes = [];
        const failures = [];
        const sentMsgIdsToAdd = [];

        for (const target of target_users) {
            if (!users[target]) {
                failures.push({ user: target, reason: 'ไม่พบผู้ใช้' });
                continue;
            }
            if (users[target].status === 'disabled') {
                failures.push({ user: target, reason: 'ผู้ใช้ถูกปิดใช้งาน' });
                continue;
            }
            if (users[target].inboxPolicy === 'closed') {
                failures.push({ user: target, reason: 'ผู้รับปิดการรับกล่องข้อความ' });
                continue;
            }
            try {
                const msgId = generateMsgId();
                const message = {
                    msgId,
                    fromUid: callerUid,
                    fromUsername: pushedBy,
                    fromRole: callerRole,
                    sentAt: timestamp(),
                    section_key: targetSecKey,
                    cards: cleanCards,
                    message: cleanMessage,
                    status: 'pending',
                    fromEncrypted: !!fromEncrypted
                };
                await env.FAV_KV.put(inboxKey(target, msgId), JSON.stringify(message));
                const list = await readInboxList(env, target);
                list.ids.unshift(msgId);
                list.unreadCount = (list.unreadCount || 0) + 1;
                await env.FAV_KV.put(inboxListKey(target), JSON.stringify(list));

                try {
                    const sentMessage = Object.assign({}, message, { toUsername: target });
                    await env.FAV_KV.put(sentKey(callerUid, msgId), JSON.stringify(sentMessage));
                    sentMsgIdsToAdd.push(msgId);
                } catch (sentErr) {
                    console.warn('push sent copy failed for', target, msgId, sentErr && sentErr.message);
                }
                successes.push({ user: target, msgId, cardsInserted: cleanCards.length });
            } catch (e) {
                const msg = (e && (e.message || e.name)) || String(e);
                console.warn('inbox push failed for', target, msg);
                failures.push({ user: target, reason: msg });
            }
        }

        if (sentMsgIdsToAdd.length > 0) {
            try {
                const sentListRaw = await env.FAV_KV.get(sentListKey(callerUid));
                let sentList = { ids: [] };
                if (sentListRaw) {
                    try {
                        const parsed = JSON.parse(sentListRaw);
                        if (parsed && Array.isArray(parsed.ids)) sentList = parsed;
                    } catch {}
                }
                for (let i = sentMsgIdsToAdd.length - 1; i >= 0; i--) {
                    sentList.ids.unshift(sentMsgIdsToAdd[i]);
                }
                await env.FAV_KV.put(sentListKey(callerUid), JSON.stringify(sentList));
            } catch (e) {
                console.warn('push sent-list update failed:', e && e.message);
            }
        }

        return jsonResponse({
            ok: true,
            mode: 'inbox',
            section: targetSecKey,
            cardsCount: cleanCards.length,
            pushedBy,
            successes,
            failures,
            skipped: []
        });
    }

    // ─────────────────────────────────────────────────────────────
    // โหมด B: force — พุชตรงลง data.js
    // ─────────────────────────────────────────────────────────────
    const forceCards = cleanCards.map(c => ({
        ...c,
        pushedBy: pushedBy,
        pushedAt: timestamp()
    }));

    const successes = [];
    const failures = [];
    const skipped = [];
    let usersTableDirty = false;

    for (const target of target_users) {
        if (!users[target]) {
            failures.push({ user: target, reason: 'ไม่พบผู้ใช้' });
            continue;
        }
        if (users[target].status === 'disabled') {
            failures.push({ user: target, reason: 'ผู้ใช้ถูกปิดใช้งาน' });
            continue;
        }
        const ns = 'user:' + target;
        const dataKey = ns + ':data_js';

        try {
            let userData = await env.FAV_KV.get(dataKey);
            let isFirstWrite = false;
            if (!userData) {
                userData = emptyUserDataSkeleton();
                isFirstWrite = true;
            }

            const result = appendCardsToSection(userData, targetSecKey, forceCards);
            if (result.skipped) {
                skipped.push({ user: target, reason: result.skippedReason });
                continue;
            }
            if (!result.modified) {
                failures.push({ user: target, reason: result.error || 'การแก้ไขไม่มีผล' });
                continue;
            }

            let backupName = null;
            if (!isFirstWrite && userData.trim()) {
                backupName = ns + ':backup:' + timestamp();
                await env.FAV_KV.put(backupName, userData);
                if (Math.random() < PRUNE_PROBABILITY) {
                    try { await pruneBackups(env.FAV_KV, ns + ':backup:'); } catch {}
                }
            }

            await env.FAV_KV.put(dataKey, result.newSrc);

            if (users[target] && !users[target].hasData) {
                users[target].hasData = true;
                usersTableDirty = true;
            }

            successes.push({
                user: target,
                cardsInserted: cleanCards.length,
                backup: backupName,
                firstWrite: isFirstWrite
            });
        } catch (e) {
            const msg = (e && (e.message || e.name)) || String(e);
            console.warn('force push failed for', target, msg);
            failures.push({ user: target, reason: msg });
        }
    }

    if (usersTableDirty) {
        try { await env.FAV_KV.put(USERS_KEY, JSON.stringify(users)); }
        catch (e) { console.warn('users.hasData update failed:', e && e.message); }
    }

    return jsonResponse({
        ok: true,
        mode: 'force',
        section: targetSecKey,
        cardsCount: cleanCards.length,
        pushedBy,
        successes,
        failures,
        skipped
    });
}

// สร้าง inbox msgId: `<timestampMs>_<rand6>`, เรียงตามตัวอักษรได้ = เรียงตามลำดับเวลา
function generateMsgId() {
    return Date.now().toString() + '_' + Math.random().toString(36).slice(2, 8);
}

// อ่านดัชนี inbox-list (เหมือน inbox.js ใช้ซ้ำในไฟล์นี้เพื่อเลี่ยงการอ้างอิงแบบวนซ้ำ)
async function readInboxList(env, uid) {
    if (!env.FAV_KV) return { ids: [], unreadCount: 0 };
    try {
        const raw = await env.FAV_KV.get(inboxListKey(uid));
        if (!raw) return { ids: [], unreadCount: 0 };
        const obj = JSON.parse(raw);
        if (!obj || !Array.isArray(obj.ids)) return { ids: [], unreadCount: 0 };
        if (typeof obj.unreadCount !== 'number') obj.unreadCount = 0;
        return obj;
    } catch {
        return { ids: [], unreadCount: 0 };
    }
}

/* ==========================================================
 * การสแกนโค้ด: ค้นหา section ที่ตรงกับ sectionKey ในข้อความข้อมูล
 * แล้วต่อ newCards เข้าท้ายอาร์เรย์ cards หมวดหมู่ที่เข้ารหัสจะถูกข้ามโดยอัตโนมัติ
 * คืนค่า {modified, newSrc, skipped, skippedReason, error}
 * ========================================================== */
function appendCardsToSection(src, sectionKey, newCards) {
    const newFormatPos = findTopLevelVarDecl(src, 'sections');
    if (newFormatPos >= 0) {
        return appendCardsNewFormat(src, sectionKey, newCards, newFormatPos);
    }
    if (BUILTIN_KEYS.includes(sectionKey)) {
        return appendCardsOldFormat(src, sectionKey, newCards);
    }
    if (sectionKey === UNCLASSIFIED_KEY) {
        return appendCardsOldFormatCustom(src, sectionKey, newCards);
    }
    return { modified: false, error: 'ไม่รู้จักรูปแบบข้อมูล' };
}

function appendCardsNewFormat(src, sectionKey, newCards, sectionsStart) {
    const eqPos = src.indexOf('=', sectionsStart);
    if (eqPos < 0) return { modified: false, error: 'ตัวแปร sections ไม่มีเครื่องหมาย =' };
    let pos = skipWs(src, eqPos + 1);
    if (src[pos] !== '[') return { modified: false, error: 'sections ไม่ใช่อาร์เรย์' };
    const sectionsArrStart = pos;
    pos++;

    while (pos < src.length) {
        pos = skipWs(src, pos);
        if (src[pos] === ']') break;
        if (src[pos] !== '{') return { modified: false, error: 'คาดหวัง { แต่พบ: ' + src[pos] };

        const objStart = pos;
        const objEnd = skipBalanced(src, pos, '{', '}');
        const info = inspectSection(src, objStart);
        if (info.key === sectionKey) {
            if (info.encrypted) {
                return { modified: true, skipped: true, skippedReason: 'หมวดหมู่นี้เป็นหมวดหมู่ที่เข้ารหัสไว้ ไม่สามารถพุชข้อมูลได้' };
            }
            return insertIntoCards(src, objStart, newCards);
        }
        pos = objEnd;
        pos = skipWs(src, pos);
        if (src[pos] === ',') { pos++; continue; }
        if (src[pos] === ']') break;
    }

    if (sectionKey === UNCLASSIFIED_KEY) {
        return insertNewUnclassifiedSection(src, sectionsArrStart, newCards);
    }
    return { modified: false, error: 'ไม่พบ section: ' + sectionKey };
}

function inspectSection(src, objStart) {
    let pos = objStart + 1;
    let key = null, encrypted = false;
    while (pos < src.length) {
        pos = skipWs(src, pos);
        if (src[pos] === '}') break;
        const keyInfo = readKey(src, pos);
        pos = keyInfo.end;
        pos = skipWs(src, pos);
        if (src[pos] !== ':') break;
        pos++;
        pos = skipWs(src, pos);
        const valStart = pos;
        if (keyInfo.name === 'key') {
            if (src[pos] === '"' || src[pos] === "'" || src[pos] === '`') {
                const valEnd = skipString(src, pos);
                key = src.substring(pos + 1, valEnd - 1).replace(/\\(.)/g, '$1');
                pos = valEnd;
            } else {
                pos = skipValue(src, pos);
            }
        } else if (keyInfo.name === 'encrypted') {
            const valEnd = skipValue(src, pos);
            encrypted = src.substring(valStart, valEnd).trim() === 'true';
            pos = valEnd;
        } else {
            pos = skipValue(src, pos);
        }
        pos = skipWs(src, pos);
        if (src[pos] === ',') { pos++; continue; }
        if (src[pos] === '}') break;
    }
    return { key, encrypted };
}

function insertIntoCards(src, objStart, newCards) {
    let pos = objStart + 1;
    let cardsArrStart = -1;
    while (pos < src.length) {
        pos = skipWs(src, pos);
        if (src[pos] === '}') break;
        const keyInfo = readKey(src, pos);
        pos = keyInfo.end;
        pos = skipWs(src, pos);
        if (src[pos] !== ':') break;
        pos++;
        pos = skipWs(src, pos);
        if (keyInfo.name === 'cards') {
            if (src[pos] !== '[') return { modified: false, error: 'cards ไม่ใช่อาร์เรย์' };
            cardsArrStart = pos;
            break;
        }
        pos = skipValue(src, pos);
        pos = skipWs(src, pos);
        if (src[pos] === ',') { pos++; continue; }
        if (src[pos] === '}') break;
    }
    if (cardsArrStart < 0) {
        return { modified: false, error: 'section ขาดฟิลด์ cards' };
    }
    const cardsEnd = skipBalanced(src, cardsArrStart, '[', ']');
    return insertBeforeBracket(src, cardsArrStart, cardsEnd - 1, newCards);
}

function insertBeforeBracket(src, arrStart, bracketIdx, newCards) {
    const inner = src.substring(arrStart + 1, bracketIdx).trim();
    const isEmpty = inner === '';
    const cardLines = newCards.map(c => stringifyCard(c));

    let insertion;
    if (isEmpty) {
        insertion = '\n            ' + cardLines.join(',\n            ') + '\n        ';
    } else {
        let beforeBracket = bracketIdx - 1;
        while (beforeBracket > arrStart && isWs(src[beforeBracket])) beforeBracket--;
        const hasTrailingComma = src[beforeBracket] === ',';
        const prefix = hasTrailingComma ? '\n            ' : ',\n            ';
        insertion = prefix + cardLines.join(',\n            ') + '\n        ';
    }
    return { modified: true, newSrc: src.substring(0, bracketIdx) + insertion + src.substring(bracketIdx) };
}

function stringifyCard(card) {
    const parts = [];
    for (const k of Object.keys(card)) {
        const v = card[k];
        if (v == null) continue;
        if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') {
            parts.push(k + ': ' + JSON.stringify(v));
        } else if (Array.isArray(v) || typeof v === 'object') {
            parts.push(k + ': ' + JSON.stringify(v));
        }
    }
    return '{ ' + parts.join(', ') + ' }';
}

function insertNewUnclassifiedSection(src, sectionsArrPos, newCards) {
    const arrEnd = skipBalanced(src, sectionsArrPos, '[', ']');
    const closeBracket = arrEnd - 1;
    const inner = src.substring(sectionsArrPos + 1, closeBracket).trim();
    const cardLines = newCards.map(c => stringifyCard(c));
    const unclassObj = '\n    { builtin: false, key: \'custom_unclassified\', kind: \'card\', label: \'📥 ยังไม่จัดหมวดหมู่\', visible: true, cards: [\n            '
        + cardLines.join(',\n            ') + '\n        ] }';
    let insertion;
    if (inner === '') {
        insertion = unclassObj + '\n';
    } else {
        let beforeBracket = closeBracket - 1;
        while (beforeBracket > sectionsArrPos && isWs(src[beforeBracket])) beforeBracket--;
        const hasTrailingComma = src[beforeBracket] === ',';
        insertion = (hasTrailingComma ? '' : ',') + unclassObj + '\n';
    }
    return { modified: true, newSrc: src.substring(0, closeBracket) + insertion + src.substring(closeBracket) };
}

function appendCardsOldFormat(src, sectionKey, newCards) {
    const varPos = findTopLevelVarDecl(src, sectionKey);
    if (varPos < 0) return { modified: false, error: 'รูปแบบเก่าไม่พบ var ' + sectionKey };
    const eqPos = src.indexOf('=', varPos);
    if (eqPos < 0) return { modified: false, error: 'รูปแบบเก่า var ขาด =' };
    let pos = skipWs(src, eqPos + 1);
    if (src[pos] !== '[') return { modified: false, error: 'รูปแบบเก่า var ไม่ใช่อาร์เรย์' };
    const arrEnd = skipBalanced(src, pos, '[', ']');
    return insertBeforeBracket(src, pos, arrEnd - 1, newCards);
}

function appendCardsOldFormatCustom(src, sectionKey, newCards) {
    const varPos = findTopLevelVarDecl(src, 'customSections');
    if (varPos < 0) return { modified: false, error: 'รูปแบบเก่าไม่พบ customSections' };
    const eqPos = src.indexOf('=', varPos);
    if (eqPos < 0) return { modified: false, error: 'รูปแบบเก่า customSections ขาด =' };
    let pos = skipWs(src, eqPos + 1);
    if (src[pos] !== '[') return { modified: false, error: 'รูปแบบเก่า customSections ไม่ใช่อาร์เรย์' };
    const arrStart = pos;
    const arrEnd = skipBalanced(src, pos, '[', ']');
    let p = pos + 1;
    while (p < arrEnd - 1) {
        p = skipWs(src, p);
        if (src[p] === ']') break;
        if (src[p] !== '{') return { modified: false, error: 'คาดหวัง {' };
        const objStart = p;
        const objEnd = skipBalanced(src, p, '{', '}');
        const info = inspectSection(src, objStart);
        if (info.key === sectionKey) {
            if (info.encrypted) {
                return { modified: true, skipped: true, skippedReason: 'หมวดหมู่นี้เป็นหมวดหมู่ที่เข้ารหัสไว้ ไม่สามารถพุชข้อมูลได้' };
            }
            return insertIntoCards(src, objStart, newCards);
        }
        p = objEnd;
        p = skipWs(src, p);
        if (src[p] === ',') { p++; continue; }
        if (src[p] === ']') break;
    }
    return insertNewUnclassifiedSection(src, arrStart, newCards);
}

/* ============ ยูทิลิตีการสแกน ============ */
function isWs(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r'; }
function isIdChar(c) {
    return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '_' || c === '$';
}

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
