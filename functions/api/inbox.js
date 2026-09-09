// /api/inbox  — ข้อความรอการตรวจสอบในกล่องข้อความเข้า (Inbox)

import {
    jsonResponse,
    getPayload,
    isValidUsername
} from '../_shared/auth.js';
import { trySanitizeMarkdown } from '../_shared/markdown-sanitize.js';

const INBOX_PREFIX = 'inbox:';
const INBOX_LIST_PREFIX = 'inbox-list:';
const SENT_PREFIX = 'user:';
const SENT_LIST_PREFIX = 'user:';
const RATE_PREFIX = 'inbox-rate:';
const RATE_DAILY_LIMIT = 100;
const RATE_PER_RECIPIENT_HOURLY = 10;
const MAX_CARDS_PER_SEND = 20;
const MAX_MESSAGE_LEN = 500;
const USERS_KEY = 'users';

const BUILTIN_KEYS = ['usbDriveData', 'teachingData', 'onlineAIData', 'videoData', 'emailData', 'contactData'];
const UNCLASSIFIED_KEY = 'custom_unclassified';
const ALLOWED_PUBLIC_KEYS = [...BUILTIN_KEYS, UNCLASSIFIED_KEY];

const ALLOWED_CARD_FIELDS = new Set([
    'type', 'title', 'url', 'desc', 'icon', 'iconImg', 'isLocal',
    'descClickable', 'descUrl', 'content', 'address', 'mailto', 'note',
    'comment', 'id', 'subCards', 'pushedBy', 'pushedAt'
]);
const MAX_FIELD_LEN = 8000;
function sanitizeCardField(card) {
    const clean = {};
    for (const k of Object.keys(card || {})) {
        if (!ALLOWED_CARD_FIELDS.has(k)) continue;
        let v = card[k];
        if (typeof v === 'string' && v.length > MAX_FIELD_LEN) v = v.slice(0, MAX_FIELD_LEN);
        clean[k] = v;
    }
    return clean;
}

function inboxKey(uid, msgId) { return INBOX_PREFIX + uid + ':' + msgId; }
function inboxListKey(uid)    { return INBOX_LIST_PREFIX + uid; }
function sentKey(uid, msgId)  { return SENT_PREFIX + uid + ':sent:' + msgId; }
function sentListKey(uid)     { return SENT_LIST_PREFIX + uid + ':sent-list'; }

function dateKeyCN() {
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const p = n => String(n).padStart(2, '0');
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate());
}
function hourKeyCN() {
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const p = n => String(n).padStart(2, '0');
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours());
}
function rateDayKey(senderUid)             { return RATE_PREFIX + senderUid + ':' + dateKeyCN(); }
function rateHourKey(senderUid, recipient) { return RATE_PREFIX + senderUid + ':' + recipient + ':' + hourKeyCN(); }
function generateMsgId() {
    return Date.now().toString() + '_' + Math.random().toString(36).slice(2, 8);
}

// อ่านรายการ inbox
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

async function writeInboxList(env, uid, list) {
    await env.FAV_KV.put(inboxListKey(uid), JSON.stringify(list));
}

function removeFromList(list, msgId) {
    const i = list.ids.indexOf(msgId);
    if (i >= 0) list.ids.splice(i, 1);
}

// ยูทิลิตีรายการข้อความที่ส่ง
async function readSentList(env, uid) {
    if (!env.FAV_KV) return { ids: [] };
    try {
        const raw = await env.FAV_KV.get(sentListKey(uid));
        if (!raw) return { ids: [] };
        const obj = JSON.parse(raw);
        if (!obj || !Array.isArray(obj.ids)) return { ids: [] };
        return obj;
    } catch {
        return { ids: [] };
    }
}

async function writeSentList(env, uid, list) {
    await env.FAV_KV.put(sentListKey(uid), JSON.stringify(list));
}

// ตรวจสอบและเพิ่มจำนวนการส่ง (Rate Limit)
async function checkAndIncrementRate(env, fromUid, toUsername) {
    const dKey = rateDayKey(fromUid);
    const hKey = rateHourKey(fromUid, toUsername);
    const [dayRaw, hourRaw] = await Promise.all([
        env.FAV_KV.get(dKey),
        env.FAV_KV.get(hKey)
    ]);
    const dayN  = parseInt(dayRaw  || '0', 10) || 0;
    const hourN = parseInt(hourRaw || '0', 10) || 0;
    if (dayN >= RATE_DAILY_LIMIT) {
        return { ok: false, code: 'RATE_LIMIT_DAILY', limit: RATE_DAILY_LIMIT, retryAfter: 86400 };
    }
    if (hourN >= RATE_PER_RECIPIENT_HOURLY) {
        return { ok: false, code: 'RATE_LIMIT_PER_RECIPIENT', limit: RATE_PER_RECIPIENT_HOURLY, retryAfter: 3600 };
    }
    try {
        await Promise.all([
            env.FAV_KV.put(dKey, String(dayN + 1),  { expirationTtl: 86400 }),
            env.FAV_KV.put(hKey, String(hourN + 1), { expirationTtl: 3600  })
        ]);
    } catch (e) {
        console.warn('rate counter put failed:', e && e.message);
    }
    return { ok: true, dayUsed: dayN + 1, hourUsed: hourN + 1 };
}

// ตรวจสอบสิทธิ์ผู้ใช้
async function authUser(request, env) {
    const payload = await getPayload(request, env);
    if (!payload) return { error: jsonResponse({ ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' }, 401) };
    const uid = payload.uid != null ? payload.uid : payload.u;
    if (!uid) return { error: jsonResponse({ ok: false, error: 'token ขาด uid' }, 401) };
    return { uid, payload };
}

export async function onRequestGet({ request, env }) {
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    const auth = await authUser(request, env);
    if (auth.error) return auth.error;
    const { uid } = auth;

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    const type = url.searchParams.get('type');

    if (type === 'sent') {
        const sentList = await readSentList(env, uid);
        const messages = [];
        for (const msgId of sentList.ids) {
            try {
                const raw = await env.FAV_KV.get(sentKey(uid, msgId));
                if (!raw) continue;
                const msg = JSON.parse(raw);
                if (statusFilter && msg.status !== statusFilter) continue;
                messages.push(msg);
            } catch {}
        }
        return jsonResponse({
            ok: true,
            type: 'sent',
            uid,
            total: sentList.ids.length,
            messages
        });
    }

    const list = await readInboxList(env, uid);

    const messages = [];
    for (const msgId of list.ids) {
        try {
            const raw = await env.FAV_KV.get(inboxKey(uid, msgId));
            if (!raw) continue;
            const msg = JSON.parse(raw);
            if (statusFilter && msg.status !== statusFilter) continue;
            messages.push(msg);
        } catch {}
    }

    return jsonResponse({
        ok: true,
        uid,
        total: list.ids.length,
        unreadCount: list.unreadCount,
        messages
    });
}

export async function onRequestPost({ request, env }) {
    if (!env.FAV_KV) return jsonResponse({ ok: false, error: 'ไม่ได้เชื่อมต่อ KV' }, 500);

    const auth = await authUser(request, env);
    if (auth.error) return auth.error;
    const { uid } = auth;

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    if (!action) return jsonResponse({ ok: false, error: 'ไม่มีพารามิเตอร์ action' }, 400);

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }, 400); }

    if (action === 'send') {
        return await handleSend(env, body, uid, auth.payload);
    }
    if (action === 'set-policy') {
        return await handleSetPolicy(env, body, uid);
    }

    const msgId = body && body.msgId;
    if (!msgId || typeof msgId !== 'string') {
        return jsonResponse({ ok: false, error: 'จำเป็นต้องระบุ msgId' }, 400);
    }

    if (action === 'delete-sent') {
        const sentRaw = await env.FAV_KV.get(sentKey(uid, msgId));
        if (!sentRaw) return jsonResponse({ ok: false, error: 'ไม่พบบันทึกการส่งหรือถูกลบไปแล้ว' }, 404);
        await env.FAV_KV.delete(sentKey(uid, msgId));
        const sentList = await readSentList(env, uid);
        removeFromList(sentList, msgId);
        await writeSentList(env, uid, sentList);
        return jsonResponse({ ok: true, msgId, status: 'deleted' });
    }

    const msgRaw = await env.FAV_KV.get(inboxKey(uid, msgId));
    if (!msgRaw) return jsonResponse({ ok: false, error: 'ไม่พบข้อความหรือข้อความถูกประมวลผลไปแล้ว' }, 404);
    let msg;
    try { msg = JSON.parse(msgRaw); }
    catch { return jsonResponse({ ok: false, error: 'ข้อมูลข้อความเสียหาย' }, 500); }

    if (action === 'accept-public') {
        if (msg.status !== 'pending' && msg.status !== 'rejected') {
            return jsonResponse({ ok: false, error: 'สถานะของข้อความนี้ไม่สามารถยอมรับได้: ' + msg.status }, 409);
        }
        if (msg.fromEncrypted === true) {
            return jsonResponse({ ok: false, error: 'ข้อความนี้มีการ์ดจากหมวดหมู่ที่เข้ารหัส สามารถยอมรับลงในหมวดหมู่ที่เข้ารหัสเท่านั้น' }, 403);
        }
        const targetKey = body.target_section_key || msg.section_key || UNCLASSIFIED_KEY;
        if (!ALLOWED_PUBLIC_KEYS.includes(targetKey)) {
            return jsonResponse({ ok: false, error: 'ไม่อนุญาตให้ใช้เป้าหมาย section: ' + targetKey }, 400);
        }
        let cardsToWrite = msg.cards;
        let edited = false;
        if (Array.isArray(body.edited_cards) && body.edited_cards.length > 0) {
            cardsToWrite = body.edited_cards.map(sanitizeCardField);
            edited = true;
        }
        return await acceptPublic(env, uid, msg, targetKey, cardsToWrite, edited);
    }

    if (action === 'fetch-for-encrypt') {
        if (msg.status !== 'pending') {
            return jsonResponse({ ok: false, error: 'สถานะของข้อความนี้ไม่สามารถยอมรับได้: ' + msg.status }, 409);
        }
        return jsonResponse({
            ok: true,
            msgId,
            cards: msg.cards,
            message: msg.message,
            fromUsername: msg.fromUsername
        });
    }

    if (action === 'mark-encrypted-done') {
        if (msg.status !== 'pending') {
            return jsonResponse({ ok: false, error: 'สถานะของข้อความนี้มีการเปลี่ยนแปลงแล้ว: ' + msg.status }, 409);
        }
        const targetEncKey = body.target_section_key || '';
        return await markAcceptedAndCleanup(env, uid, msg, msgId, targetEncKey, 'encrypted');
    }

    if (action === 'delete-rejected') {
        if (msg.status !== 'rejected') {
            return jsonResponse({ ok: false, error: 'สามารถลบข้อความได้อย่างถาวรเฉพาะข้อความที่ถูกปฏิเสธแล้วเท่านั้น: ' + msg.status }, 409);
        }
        await env.FAV_KV.delete(inboxKey(uid, msgId));
        const list = await readInboxList(env, uid);
        removeFromList(list, msgId);
        await writeInboxList(env, uid, list);
        return jsonResponse({ ok: true, msgId, status: 'deleted' });
    }

    if (action === 'delete-accepted') {
        if (msg.status !== 'accepted') {
            return jsonResponse({ ok: false, error: 'สามารถลบประวัติได้เฉพาะข้อความที่ยอมรับแล้วเท่านั้น: ' + msg.status }, 409);
        }
        await env.FAV_KV.delete(inboxKey(uid, msgId));
        const list = await readInboxList(env, uid);
        removeFromList(list, msgId);
        await writeInboxList(env, uid, list);
        return jsonResponse({ ok: true, msgId, status: 'deleted' });
    }

    if (action === 'reject') {
        if (msg.status !== 'pending') {
            return jsonResponse({ ok: false, error: 'สถานะของข้อความนี้ไม่สามารถปฏิเสธได้: ' + msg.status }, 409);
        }
        const reason = (body.reason || '').toString().slice(0, 500);
        msg.status = 'rejected';
        msg.rejectedAt = timestamp();
        if (reason) msg.rejectReason = reason;
        await env.FAV_KV.put(inboxKey(uid, msgId), JSON.stringify(msg));
        const list = await readInboxList(env, uid);
        if (list.unreadCount > 0) list.unreadCount -= 1;
        await writeInboxList(env, uid, list);
        await syncSentStatus(env, msg, {
            status: 'rejected',
            rejectedAt: msg.rejectedAt,
            rejectReason: reason || undefined
        });
        return jsonResponse({ ok: true, msgId, status: 'rejected' });
    }

    return jsonResponse({ ok: false, error: 'ไม่รู้จัก action: ' + action }, 400);
}

// ─────────────────────────────────────────────────────────────
// §14 P2P send action(2026-05-29)
// ผู้ใช้ที่เข้าสู่ระบบ → พุชการ์ดไปยัง inbox ของ recipient ที่ระบุ + เขียนสำเนา sent ของผู้ส่ง
// ป้องกัน brute-force: recipient ไม่มีอยู่ / disabled / inboxPolicy=closed → คืนค่าเงียบๆ 200 (ไม่เขียน inbox และไม่เขียน sent)
// การจำกัดอัตรา: 50 ต่อวัน / ผู้รับเดียวกัน 5 ครั้งใน 1 ชม. (เกิน → 429 ไม่เงียบ แจ้งผู้ส่งว่าติด rate limit ของตนเอง)
// การ์ดที่เข้ารหัส: ส่งต่อ fromEncrypted (นำกลไก §16-B มาใช้ซ้ำ ผู้รับยอมรับได้เฉพาะแบบเข้ารหัสเท่านั้น)
// ─────────────────────────────────────────────────────────────
async function handleSend(env, body, fromUid, payload) {
    // 1. ตรวจสอบฟิลด์ body (cheap first)
    const toUsername    = body && body.toUsername;
    const cards         = body && body.cards;
    const rawMessage    = body && body.message;
    const rawSectionKey = body && body.section_key;

    if (!toUsername || typeof toUsername !== 'string' || !isValidUsername(toUsername)) {
        return jsonResponse({ ok: false, error: 'ชื่อผู้รับไม่ถูกต้อง' }, 400);
    }
    if (!Array.isArray(cards) || cards.length === 0) {
        return jsonResponse({ ok: false, error: 'cards ต้องเป็นอาร์เรย์ที่ไม่ว่างเปล่า' }, 400);
    }
    if (cards.length > MAX_CARDS_PER_SEND) {
        return jsonResponse({ ok: false, error: 'ส่งได้สูงสุด ' + MAX_CARDS_PER_SEND + ' ใบต่อครั้ง' }, 400);
    }

    // 2. ปฏิเสธการส่งหาตัวเอง (Q6)
    if (toUsername === fromUid) {
        return jsonResponse({ ok: false, error: 'ไม่สามารถส่งให้ตัวเองได้' }, 400);
    }

    // 3. section_key: เป็นตัวเลือก; ค่าว่าง = ส่งไปยังยังไม่จัดหมวดหมู่
    const targetSecKey = rawSectionKey || UNCLASSIFIED_KEY;
    if (!ALLOWED_PUBLIC_KEYS.includes(targetSecKey)) {
        return jsonResponse({ ok: false, error: 'ไม่อนุญาตให้ส่งไปยัง section เป้าหมาย: ' + targetSecKey }, 400);
    }

    // 4. ตรวจสอบการจำกัดอัตรา (การจำกัดอัตราของผู้ส่งเอง → ล้มเหลว 429 ไม่เงียบ)
    //    วางไว้ก่อนตรวจสอบผู้ใช้ → ผู้โจมตีที่สแกนหาผู้รับก็จะใช้โควตาของตนเองเช่นกัน
    const rate = await checkAndIncrementRate(env, fromUid, toUsername);
    if (!rate.ok) {
        return jsonResponse({
            ok: false,
            error: rate.code === 'RATE_LIMIT_DAILY'
                ? 'การพุชวันนี้ถึงขีดจำกัดแล้ว (' + rate.limit + ' รายการ/วัน) โปรดลองใหม่พรุ่งนี้'
                : 'ส่งหาผู้รับเดียวกันได้สูงสุด ' + rate.limit + ' รายการภายใน 1 ชั่วโมง',
            code: rate.code,
            retryAfter: rate.retryAfter
        }, 429);
    }

    // 5. ตรวจสอบแบบเงียบ: recipient ไม่มีอยู่ / disabled / inboxPolicy=closed → 200 แต่ไม่เขียน
    const usersRaw = await env.FAV_KV.get(USERS_KEY);
    const users = usersRaw ? JSON.parse(usersRaw) : {};
    const target = users[toUsername];
    if (!target || target.status === 'disabled') {
        // ป้องกัน brute-force: คืนค่า shape เดียวกับสำเร็จ แต่ msgId=null แสดงว่าไม่ได้เขียนจริง
        return jsonResponse({ ok: true, sentTo: toUsername, msgId: null, silent: true });
    }
    if (target.inboxPolicy === 'closed') {
        return jsonResponse({ ok: true, sentTo: toUsername, msgId: null, silent: true });
    }

    // 6. sanitize message (Markdown blacklist + ขีดจำกัดความยาว)
    let cleanMessage = '';
    if (rawMessage != null && rawMessage !== '') {
        const sanRes = trySanitizeMarkdown(String(rawMessage), { maxLength: MAX_MESSAGE_LEN });
        if (!sanRes.ok) {
            return jsonResponse({ ok: false, error: 'ข้อความไม่ถูกต้อง: ' + sanRes.error, code: sanRes.code }, 400);
        }
        cleanMessage = sanRes.text;
    }

    // 7. ตรวจสอบ fromEncrypted (ใช้กลไก §16-B ซ้ำ): การ์ดใดการ์ดหนึ่ง __fromEncrypted=true → ทำเครื่องหมายทั้งข้อความว่ามาจากแหล่งเข้ารหัส
    const fromEncrypted = cards.some(c => c && c.__fromEncrypted === true);

    // 8. sanitize cards (whitelist + ตัดความยาว + เติม id อัตโนมัติ)
    const cleanCards = cards.map(c => {
        const clean = sanitizeCardField(c);
        if (!clean.id) clean.id = 'card_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        return clean;
    });

    // 9. สร้างอ็อบเจกต์ข้อความ (shape เดียวกับพาธ append ใน push.js)
    const msgId = generateMsgId();
    const fromUsername = (payload && payload.u) || fromUid;
    const fromRole = (payload && payload.role) || 'user';
    const message = {
        msgId,
        fromUid,
        fromUsername,
        fromRole,
        sentAt: timestamp(),
        section_key: targetSecKey,
        cards: cleanCards,
        message: cleanMessage,
        status: 'pending',
        fromEncrypted: !!fromEncrypted
    };

    // 10. เขียนข้อมูล (ลำดับ: inbox → inbox-list → sent → sent-list; หากขั้นตอนใดล้มเหลวให้คงไว้ ไม่ย้อนกลับ)
    try {
        await env.FAV_KV.put(inboxKey(toUsername, msgId), JSON.stringify(message));
        const inList = await readInboxList(env, toUsername);
        inList.ids.unshift(msgId);
        inList.unreadCount = (inList.unreadCount || 0) + 1;
        await writeInboxList(env, toUsername, inList);

        // สำเนา sent (สำหรับผู้ส่งตรวจสอบ "อีกฝ่ายยอมรับหรือยัง") — เก็บฟิลด์ toUsername เพิ่มเติม สำเนา inbox ไม่เก็บ (ผู้รับรู้ว่าเป็นตนเองอยู่แล้ว)
        const sentMessage = Object.assign({}, message, { toUsername });
        await env.FAV_KV.put(sentKey(fromUid, msgId), JSON.stringify(sentMessage));
        const sentList = await readSentList(env, fromUid);
        sentList.ids.unshift(msgId);
        await writeSentList(env, fromUid, sentList);
    } catch (e) {
        const msg = (e && (e.message || e.name)) || String(e);
        console.warn('inbox send write failed:', msg);
        return jsonResponse({ ok: false, error: 'บันทึกไม่สำเร็จ: ' + msg }, 500);
    }

    return jsonResponse({
        ok: true,
        sentTo: toUsername,
        msgId,
        cardsCount: cleanCards.length,
        fromEncrypted: !!fromEncrypted,
        rate: { dayUsed: rate.dayUsed, hourUsed: rate.hourUsed }
    });
}

// ─────────────────────────────────────────────────────────────
// §14 P2P set-policy(2026-05-29)
// ผู้ใช้เปลี่ยน inboxPolicy ของตนเอง ('open' / 'closed')
// admin เปลี่ยนได้เฉพาะของตนเองเท่านั้น (V1 แบบง่าย; การจัดการ policy ของผู้อื่นเก็บไว้ทำใน V2)
// ไม่มีอยู่/ผู้ใช้เดิม (ไม่มีฟิลด์ inboxPolicy) ถือเป็น 'open', บันทึก action นี้แล้วจะคงที่
// ─────────────────────────────────────────────────────────────
async function handleSetPolicy(env, body, uid) {
    const policy = body && body.policy;
    if (policy !== 'open' && policy !== 'closed') {
        return jsonResponse({ ok: false, error: 'policy ต้องเป็น open หรือ closed' }, 400);
    }
    try {
        const usersRaw = await env.FAV_KV.get(USERS_KEY);
        if (!usersRaw) {
            return jsonResponse({ ok: false, error: 'ไม่พบตารางผู้ใช้' }, 500);
        }
        const users = JSON.parse(usersRaw);
        if (!users[uid]) {
            return jsonResponse({ ok: false, error: 'ไม่พบผู้ใช้' }, 404);
        }
        users[uid].inboxPolicy = policy;
        await env.FAV_KV.put(USERS_KEY, JSON.stringify(users));
        return jsonResponse({ ok: true, policy });
    } catch (e) {
        const msg = (e && (e.message || e.name)) || String(e);
        console.warn('set-policy failed:', msg);
        return jsonResponse({ ok: false, error: 'บันทึกไม่สำเร็จ: ' + msg }, 500);
    }
}

// ยอมรับไปยัง section สาธารณะ/ยังไม่จัดหมวดหมู่: แบ็กเอนด์อ่าน user data.js + ผสาน cards + เขียนกลับ
// §16-A.4(2026-05-24): เพิ่มพารามิเตอร์ cardsToWrite + edited เพื่อรองรับ "แก้ไขก่อนยอมรับ"
async function acceptPublic(env, uid, msg, targetKey, cardsToWrite, edited) {
    cardsToWrite = cardsToWrite || msg.cards;
    const dataKey = 'user:' + uid + ':data_js';
    let userData = await env.FAV_KV.get(dataKey);
    let isFirstWrite = false;
    if (!userData) {
        userData = emptyUserDataSkeleton();
        isFirstWrite = true;
    }

    const result = appendCardsToSection(userData, targetKey, cardsToWrite);
    if (result.skipped) {
        return jsonResponse({ ok: false, error: 'section เป้าหมายเป็นหมวดหมู่เข้ารหัส โปรดใช้ขั้นตอน accept-encrypted' }, 400);
    }
    if (!result.modified) {
        return jsonResponse({ ok: false, error: result.error || 'การผสานล้มเหลว' }, 500);
    }

    // สำรองข้อมูล data เดิม
    let backupName = null;
    if (!isFirstWrite && userData.trim()) {
        backupName = 'user:' + uid + ':backup:' + timestamp();
        try { await env.FAV_KV.put(backupName, userData); } catch {}
    }
    await env.FAV_KV.put(dataKey, result.newSrc);

    // กำหนด users[uid].hasData = true
    try {
        const usersRaw = await env.FAV_KV.get('users');
        if (usersRaw) {
            const users = JSON.parse(usersRaw);
            if (users[uid] && !users[uid].hasData) {
                users[uid].hasData = true;
                await env.FAV_KV.put('users', JSON.stringify(users));
            }
        }
    } catch {}

    // §16-A.4: เมื่อ edited=true ให้บันทึก acceptedCards ลงในข้อความเพื่อตรวจสอบย้อนหลัง
    if (edited) {
        msg.editedBeforeAccept = true;
        msg.acceptedCards = cardsToWrite;
    }
    return await markAcceptedAndCleanup(env, uid, msg, msg.msgId, targetKey, 'public');
}

// ทำเครื่องหมาย msg เป็น accepted + อัปเดต inbox-list.unreadCount
async function markAcceptedAndCleanup(env, uid, msg, msgId, acceptedSection, acceptKind) {
    // §16-A.3(2026-05-24): หากเปลี่ยนจาก rejected → accepted (เปิดใช้งานใหม่) unreadCount ถูกลดไปแล้วตอน reject จึงไม่ลดซ้ำ
    const wasFromPending = msg.status === 'pending';
    msg.status = 'accepted';
    msg.acceptedAt = timestamp();
    if (acceptedSection) msg.acceptedSection = acceptedSection;
    msg.acceptKind = acceptKind; // 'public' | 'encrypted' (ตั้งแต่ 2026-05-24 ไม่มี 'discarded' แล้ว)
    delete msg.rejectedAt;       // ล้าง timestamp การปฏิเสธเดิมเมื่อเปิดใช้งานใหม่
    delete msg.rejectReason;
    await env.FAV_KV.put(inboxKey(uid, msgId), JSON.stringify(msg));
    if (wasFromPending) {
        const list = await readInboxList(env, uid);
        if (list.unreadCount > 0) list.unreadCount -= 1;
        await writeInboxList(env, uid, list);
    }
    // §14 P2P(2026-05-29): ซิงค์สถานะสำเนา sent ของผู้ส่ง (มี sent เฉพาะพาธ P2P; พาธ admin /api/push ไม่มีสำเนา sent จะถูก syncSentStatus ข้ามไป)
    await syncSentStatus(env, msg, {
        status: 'accepted',
        acceptedAt: msg.acceptedAt,
        acceptedSection: acceptedSection || null,
        acceptKind,
        editedBeforeAccept: msg.editedBeforeAccept === true ? true : undefined,
        acceptedCards: msg.acceptedCards || undefined
    });
    return jsonResponse({ ok: true, msgId, status: 'accepted', acceptKind, acceptedSection: acceptedSection || null });
}

// §14 P2P(2026-05-29): ซิงค์การเปลี่ยนแปลงสถานะ msg ของผู้รับไปยังสำเนา sent ของผู้ส่ง
//   KV key ของ sent ฝั่งผู้ส่ง: user:<fromUid>:sent:<msgId> (อยู่ใน user namespace ของผู้ส่ง ล้างอัตโนมัติเมื่อลบผู้ใช้)
//   ฟังก์ชันนี้จะมีเป้าหมายเมื่อ send action เคยเขียนสำเนา sent ไว้เท่านั้น; พาธ admin /api/push ไม่มี sent → สำเนา sent อ่านได้ null → return ทันที
//   หากล้มเหลว try/catch จะไม่บล็อกพาธหลัก (สถานะ inbox ของผู้รับมีความสำคัญสูงสุด)
async function syncSentStatus(env, msg, updates) {
    if (!env.FAV_KV) return;
    const fromUid = msg && msg.fromUid;
    const msgId   = msg && msg.msgId;
    if (!fromUid || !msgId) return;
    try {
        const sentRaw = await env.FAV_KV.get(sentKey(fromUid, msgId));
        if (!sentRaw) return;  // ผู้ส่งมาทาง /api/push (admin) ไม่ใช่ send action → ไม่มีสำเนา sent ข้ามไป
        const sent = JSON.parse(sentRaw);
        // รวมฟิลด์ที่ไม่ใช่ undefined (undefined จะไม่ทับค่าที่มีอยู่)
        for (const k of Object.keys(updates || {})) {
            if (updates[k] !== undefined) sent[k] = updates[k];
        }
        // ล้างฟิลด์ที่ไม่เข้ากันเมื่อสลับสถานะ
        if (updates && updates.status === 'accepted') {
            delete sent.rejectedAt;
            delete sent.rejectReason;
        } else if (updates && updates.status === 'rejected') {
            delete sent.acceptedAt;
            delete sent.acceptedSection;
            delete sent.acceptKind;
            delete sent.editedBeforeAccept;
            delete sent.acceptedCards;
        }
        await env.FAV_KV.put(sentKey(fromUid, msgId), JSON.stringify(sent));
    } catch (e) {
        console.warn('syncSentStatus failed:', e && e.message);
    }
}

function timestamp() {
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const p = n => String(n).padStart(2, '0');
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '_' +
           p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds());
}

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

// ─────────────────────────────────────────────────────────────
// appendCardsToSection มีการทำงานตรงกับ push.js ทุกประการ (คัดลอกชั่วคราวเพื่อเลี่ยงการแก้ไขต่อเนื่องของโมดูล _shared)
// ในอนาคตหากทั้งสองฝ่ายยังคงพัฒนาต่อ ค่อยแยกเป็น _shared/data-merge.js
// ─────────────────────────────────────────────────────────────
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
    return { modified: false, error: 'รูปแบบข้อมูลที่ไม่รู้จัก' };
}

function appendCardsNewFormat(src, sectionKey, newCards, sectionsStart) {
    const eqPos = src.indexOf('=', sectionsStart);
    if (eqPos < 0) return { modified: false, error: 'ตัวแปร sections ขาด =' };
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
                return { modified: true, skipped: true, skippedReason: 'section นี้เป็นหมวดหมู่เข้ารหัส' };
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
    if (varPos < 0) return { modified: false, error: 'รูปแบบเดิมไม่พบ var ' + sectionKey };
    const eqPos = src.indexOf('=', varPos);
    if (eqPos < 0) return { modified: false, error: 'รูปแบบเดิม var ขาด =' };
    let pos = skipWs(src, eqPos + 1);
    if (src[pos] !== '[') return { modified: false, error: 'รูปแบบเดิม var ไม่ใช่อาร์เรย์' };
    const arrEnd = skipBalanced(src, pos, '[', ']');
    return insertBeforeBracket(src, pos, arrEnd - 1, newCards);
}

function appendCardsOldFormatCustom(src, sectionKey, newCards) {
    const varPos = findTopLevelVarDecl(src, 'customSections');
    if (varPos < 0) return { modified: false, error: 'รูปแบบเดิมไม่พบ customSections' };
    const eqPos = src.indexOf('=', varPos);
    if (eqPos < 0) return { modified: false, error: 'รูปแบบเดิม customSections ขาด =' };
    let pos = skipWs(src, eqPos + 1);
    if (src[pos] !== '[') return { modified: false, error: 'รูปแบบเดิม customSections ไม่ใช่อาร์เรย์' };
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
                return { modified: true, skipped: true, skippedReason: 'section นี้เป็นหมวดหมู่เข้ารหัส' };
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

/* ============ เครื่องมือสแกนทั่วไป ============ */
function isWs(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r'; }
function isIdChar(c) {
    return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '_' || c === '$';
}
function skipWs(src, pos) {
    const n = src.length;
    while (pos < n) {
        const c = src[pos];
        if (isWs(c)) { pos++; continue; }
        if (c === '/' && src[pos + 1] === '/') { while (pos < n && src[pos] !== '\n') pos++; continue; }
        if (c === '/' && src[pos + 1] === '*') {
            pos += 2;
            while (pos + 1 < n && !(src[pos] === '*' && src[pos + 1] === '/')) pos++;
            pos += 2; continue;
        }
        break;
    }
    return pos;
}
function skipString(src, pos) {
    const quote = src[pos]; pos++;
    const n = src.length;
    while (pos < n) {
        const c = src[pos];
        if (c === '\\') { pos += 2; continue; }
        if (c === quote) return pos + 1;
        pos++;
    }
    throw new Error('สตริงไม่ปิด @ ' + pos);
}
function skipBalanced(src, pos, open, close) {
    if (src[pos] !== open) throw new Error('คาดหวัง ' + open);
    pos++; let depth = 1; const n = src.length;
    while (pos < n && depth > 0) {
        const c = src[pos];
        if (c === '"' || c === "'" || c === '`') { pos = skipString(src, pos); continue; }
        if (c === '/' && src[pos + 1] === '/') { while (pos < n && src[pos] !== '\n') pos++; continue; }
        if (c === '/' && src[pos + 1] === '*') {
            pos += 2;
            while (pos + 1 < n && !(src[pos] === '*' && src[pos + 1] === '/')) pos++;
            pos += 2; continue;
        }
        if (c === open) depth++; else if (c === close) depth--;
        pos++;
    }
    if (depth !== 0) throw new Error('วงเล็บไม่ปิด');
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
        if (c === '/' && src[pos + 1] === '/') { while (pos < n && src[pos] !== '\n') pos++; continue; }
        if (c === '/' && src[pos + 1] === '*') {
            pos += 2;
            while (pos + 1 < n && !(src[pos] === '*' && src[pos + 1] === '/')) pos++;
            pos += 2; continue;
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
    if (pos === start) throw new Error('ไม่สามารถอ่านชื่อคีย์ @ ' + pos);
    return { name: src.substring(start, pos), end: pos };
}
