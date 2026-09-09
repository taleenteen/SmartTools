// ยูทิลิตีส่วนกลาง A1.5: ตรวจสอบรูปแบบ slug สาธารณะ + อ่าน/เขียน reverse index ใน KV
//
// โมเดลข้อมูลใน KV:
//   users[uid].publicSlug     สตริง slug ปัจจุบัน (ค่าว่างแปลว่ายังไม่ตั้งค่า)
//   users[uid].publicEnabled  สวิตช์เปิด/ปิด
//   slug:<slug>  → <uid>      reverse index (O(1) ค้นหาย้อนกลับ)

const ADMIN_SLUG_RE = /^[a-z0-9][a-z0-9_\-]{0,31}$/;
const USER_SLUG_RE  = /^[a-z0-9][a-z0-9_\-]{2,31}$/;
// ไม่อนุญาต slug ที่เป็นตัวเลขล้วน (ป้องกันการสแกน brute-force)
const ALL_DIGITS_RE = /^[0-9]+$/;

// คำสงวน: ป้องกัน slug ชนกับเราต์คงที่ของระบบ, พรีฟิกซ์โดเมน หรือชื่อระบบ
const RESERVED_SLUGS = new Set([
    'tools', 'toolsindex',
    'databak', 'shared', 'scripts',
    'config', 'admin', 'login', 'logout',
    'about', 'index', 'data',
    'index1', 'index2', 'index3', 'index4', 'index5',
    'home', 'help', 'static', 'public', 'assets',
    'api', 'auth', 'user', 'users', 'archive', 'archives',
    'save', 'comment', 'backup', 'backups',
    'check', 'change', 'migrate',
    'favicon', 'robots', 'sitemap',
    'www', 'mail', 'ftp', 'ns', 'ns1', 'ns2',
    'cdn', 'img', 'images', 'media', 'files', 'download', 'downloads',
    'settings', 'setting', 'preferences', 'profile', 'me',
    'signup', 'signin', 'register', 'reset', 'forgot',
    'password', 'passwd', 'security', 'verify',
    'search', 'tag', 'tags', 'category', 'categories',
    'feed', 'rss', 'atom',
    'blog', 'post', 'posts', 'news',
    'contact', 'support', 'feedback', 'terms', 'privacy', 'legal',
    'docs', 'doc', 'documentation', 'wiki', 'manual',
    'status', 'health', 'ping', 'test',
    'app', 'apps', 'web', 'm', 'mobile',
    'cgi', 'bin',
    'null', 'undefined', 'true', 'false',
    'errors', 'error', '404', '500',
    'u',
    'at',
    'smarttools', 'mrr'
]);

// ตรวจสอบรูปแบบ slug
export function isValidSlug(s, role) {
    if (typeof s !== 'string') return false;
    if (ALL_DIGITS_RE.test(s)) return false;
    const re = (role === 'user') ? USER_SLUG_RE : ADMIN_SLUG_RE;
    return re.test(s);
}

export function isReservedSlug(s) {
    return RESERVED_SLUGS.has((s || '').toLowerCase());
}

// สร้างสตริงพื้นฐานของ slug จากชื่อผู้ใช้
export function genSlugFromUsername(username) {
    let base = (username || '').toLowerCase().replace(/[^a-z0-9_\-]/g, '');
    base = base.replace(/^[^a-z0-9]+/, '');
    if (!base) base = 'user';
    return base;
}

// สร้างสตริงสุ่มต่อท้าย
export function randomSlugSuffix(len = 4) {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    const buf = new Uint8Array(len);
    crypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) {
        s += chars[buf[i] % chars.length];
    }
    return s;
}

// สร้าง slug ที่ไม่ซ้ำกันอัตโนมัติ
const MIN_AUTO_LEN = 4;
export async function genUniqueSlug(env, base, role) {
    if (!env || !env.FAV_KV) throw new Error('no KV binding');
    let candidate = genSlugFromUsername(base);
    if (candidate.length < MIN_AUTO_LEN || !isValidSlug(candidate, role)) {
        candidate = candidate + '-' + randomSlugSuffix();
    }
    if (isReservedSlug(candidate)) {
        candidate = candidate + '-' + randomSlugSuffix();
    }
    let baseClean = genSlugFromUsername(base);
    for (let i = 0; i < 6; i++) {
        const existing = await env.FAV_KV.get('slug:' + candidate);
        if (!existing) return candidate;
        candidate = baseClean + '-' + randomSlugSuffix();
    }
    candidate = 'user-' + randomSlugSuffix(6);
    const existing = await env.FAV_KV.get('slug:' + candidate);
    if (!existing) return candidate;
    throw new Error('cannot generate unique slug');
}

// ค้นหา uid จาก slug
export async function lookupSlugUid(env, slug) {
    if (!isValidSlug(slug)) return null;
    if (!env || !env.FAV_KV) return null;
    const uid = await env.FAV_KV.get('slug:' + slug);
    return uid || null;
}

// ค้นหาข้อมูลผู้ใช้จาก slug
export async function getUserBySlug(env, slug) {
    const uid = await lookupSlugUid(env, slug);
    if (!uid) return null;
    try {
        const raw = await env.FAV_KV.get('users');
        if (!raw) return null;
        const users = JSON.parse(raw);
        const user = users[uid];
        if (!user) return null;
        if (user.status === 'disabled') return null;
        if (user.publicEnabled !== true) return null;
        if (user.publicSlug !== slug) return null;
        return { uid, user, enabled: true, role: user.role || 'user' };
    } catch {
        return null;
    }
}

// บันทึกดัชนี slug
export async function writeSlugIndex(env, slug, uid) {
    if (!isValidSlug(slug)) throw new Error('invalid slug');
    if (!env || !env.FAV_KV) throw new Error('no KV binding');
    await env.FAV_KV.put('slug:' + slug, uid);
}

// ลบดัชนี slug
export async function deleteSlugIndex(env, slug) {
    if (!slug || typeof slug !== 'string') return;
    if (!env || !env.FAV_KV) return;
    try {
        await env.FAV_KV.delete('slug:' + slug);
    } catch {}
}

const OLD_SLUG_TTL_SECONDS = 30 * 24 * 3600; // 30 วัน

export async function writeOldSlugRedirect(env, oldSlug, newSlug) {
    if (!env || !env.FAV_KV) return;
    if (!oldSlug || !newSlug) return;
    if (oldSlug === newSlug) return;
    if (!isValidSlug(oldSlug)) return;
    if (!isValidSlug(newSlug)) return;
    try {
        await env.FAV_KV.put('slug-old:' + oldSlug, newSlug, {
            expirationTtl: OLD_SLUG_TTL_SECONDS
        });
    } catch {}
}

// ค้นหาการ redirect จาก slug เดิมไปยัง slug ใหม่
export async function lookupOldSlugRedirect(env, oldSlug) {
    if (!isValidSlug(oldSlug)) return null;
    if (!env || !env.FAV_KV) return null;
    try {
        const v = await env.FAV_KV.get('slug-old:' + oldSlug);
        return v || null;
    } catch {
        return null;
    }
}

// ลบการ redirect ของ slug เดิม
export async function deleteOldSlugRedirect(env, oldSlug) {
    if (!oldSlug || typeof oldSlug !== 'string') return;
    if (!env || !env.FAV_KV) return;
    try {
        await env.FAV_KV.delete('slug-old:' + oldSlug);
    } catch {}
}

// ตรวจสอบว่า slug มีอักขระติดต่อกันจากชื่อผู้ใช้อย่างน้อย 70%
export function slugContainsUsernameSubstring(slug, username, ratio) {
    if (typeof ratio !== 'number' || ratio <= 0 || ratio > 1) ratio = 0.7;
    if (!slug || typeof slug !== 'string') return false;
    const s = slug.toLowerCase();
    const u = genSlugFromUsername(username || '');
    if (!u) return true;
    const required = Math.ceil(u.length * ratio);
    if (required <= 0) return true;
    if (required > u.length) return false;
    if (required > s.length) return false;

    let hasNonDigitCandidate = false;
    for (let i = 0; i + required <= u.length; i++) {
        const sub = u.substring(i, i + required);
        if (ALL_DIGITS_RE.test(sub)) continue;
        hasNonDigitCandidate = true;
        if (s.indexOf(sub) !== -1) return true;
    }
    if (!hasNonDigitCandidate) return true;
    return false;
}

// คำนวณความยาวขั้นต่ำของสตริงย่อยที่ต้องการ
export function requiredUsernameSubstringLen(username, ratio) {
    if (typeof ratio !== 'number' || ratio <= 0 || ratio > 1) ratio = 0.7;
    const u = genSlugFromUsername(username || '');
    if (!u) return 0;
    return Math.ceil(u.length * ratio);
}
