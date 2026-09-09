// functions/_shared/markdown-sanitize.js
// ยูทิลิตีสำหรับกรองความปลอดภัยของข้อความ Markdown ฝั่งเซิร์ฟเวอร์

export class SanitizeError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'SanitizeError';
        this.code = code || 'SANITIZE_REJECTED';
    }
}

// ไวต์ลิสต์โปรโตคอลของลิงก์ Markdown [text](url)
const LINK_PROTOCOL_RE = /^(?:https?:|mailto:)/i;
// รูปภาพรองรับเฉพาะ https-only
const IMAGE_PROTOCOL_RE = /^https:/i;

// แท็ก HTML อันตราย
const DANGER_TAG_RE = /<\s*(script|iframe|style|link|meta|object|embed|base|form)\b[\s\S]*?(?:<\s*\/\s*\1\s*>|$)/gi;
const DANGER_VOID_RE = /<\s*(meta|link|base|input|source|track)\b[^>]*\/?>/gi;
const EVENT_ATTR_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const FORMACTION_RE = /\s+formaction\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGER_PROTOCOL_ATTR_RE = /(href|src|xlink:href|action|formaction|background|poster)\s*=\s*["']?\s*(?:javascript|data|vbscript|file)\s*:/gi;

// เรกูลาร์เอ็กซ์เพรสชันสำหรับลิงก์และรูปภาพใน Markdown
const MD_LINK_RE  = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * sanitizeMarkdown(text, opts)
 *
 * @param {string} text — ข้อความ Markdown
 * @param {object} [opts]
 * @param {number} [opts.maxLength=5000]
 * @param {boolean} [opts.allowDataImage=false]
 * @param {boolean} [opts.allowHttpImage=false]
 * @returns {string}
 */
export function sanitizeMarkdown(text, opts) {
    opts = opts || {};
    const maxLength = typeof opts.maxLength === 'number' ? opts.maxLength : 5000;
    const allowDataImage = !!opts.allowDataImage;
    const allowHttpImage = !!opts.allowHttpImage;

    if (typeof text !== 'string') {
        throw new SanitizeError('ข้อมูลนำเข้าต้องเป็นสตริง', 'INVALID_INPUT');
    }
    if (text.length > maxLength) {
        throw new SanitizeError('เนื้อหาเกินความยาวสูงสุด ' + maxLength + ' ตัวอักษร', 'TOO_LONG');
    }

    let out = text;

    // 1. กำจัดแท็ก HTML อันตราย
    out = out.replace(DANGER_TAG_RE, '');
    out = out.replace(DANGER_VOID_RE, '');

    // 2. กำจัด event attributes / โปรโตคอลอันตราย
    out = out.replace(EVENT_ATTR_RE, '');
    out = out.replace(FORMACTION_RE, '');
    out = out.replace(DANGER_PROTOCOL_ATTR_RE, function (_, attr) {
        return attr + '="#"';
    });

    // 3. ไวต์ลิสต์ src รูปภาพใน Markdown
    out = out.replace(MD_IMAGE_RE, function (full, alt, src) {
        const u = String(src || '').trim();
        if (IMAGE_PROTOCOL_RE.test(u)) return full;
        if (allowDataImage && /^data:image\/[a-zA-Z+.-]+;/i.test(u)) return full;
        if (allowHttpImage && /^http:/i.test(u)) return full;
        return alt || '';
    });

    // 4. ไวต์ลิสต์ URL ลิงก์ใน Markdown
    out = out.replace(MD_LINK_RE, function (full, text, url) {
        const u = String(url || '').trim();
        if (LINK_PROTOCOL_RE.test(u)) return full;
        return text || '';
    });

    return out;
}

export function trySanitizeMarkdown(text, opts) {
    try {
        return { ok: true, text: sanitizeMarkdown(text, opts) };
    } catch (e) {
        return {
            ok: false,
            error: (e && e.message) || 'sanitize failed',
            code: (e && e.code) || 'SANITIZE_REJECTED'
        };
    }
}
