/* ================================================================================
 * shared/note-modal.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal หมายเหตุการ์ด (comment) + การเรนเดอร์ Markdown น้ำหนักเบา + แถบเครื่องมือ Markdown + รองรับหลายธีม
 *
 * ★ การเปลี่ยนแปลงในเวอร์ชันนี้:
 *   - ระลอกคลื่นเต็มหน้าจอ: เมื่อคลิก .note-body
 *     กระจายจากจุดคลิกครอบคลุมทั้งหน้าจอ
 *     ปุ่มยังคงใช้ระลอกคลื่นเฉพาะที่ (.note-ripple)
 *   - ข้อความ hover: "คลิกเพื่อเปิด: <URL>"
 *   - ลิงก์ในหมายเหตุแสดง href ของตนเองเมื่อ hover
 *   - การแจ้งเตือนสถานะที่ยังไม่ได้บันทึกถาวร:
 *       · ในโหมดดู: แสดงข้อความเตือนที่ footer ถาวร
 *       · ในโหมดแก้ไข: แสดงข้อความเตือนทันทีที่เปิด
 *       · หลังซิงค์กับเซิร์ฟเวอร์สำเร็จ แจ้งเตือนจะหายไป
 *   - เพิ่ม API ภายนอก: clearOverrides()
 *   - บันทึกการลบหมายเหตุในโหมดออฟไลน์เป็น pending
 *           บันทึกลง overrides แม้ค่าจะว่าง
 *           จนกว่าจะซิงค์สำเร็จจึงลบออกจาก overrides
 *
 * กฎการทำงาน (ทำงานร่วมกับ fav-page.js):
 *   1. เมื่อคลิกการ์ด:
 *        - มี comment → แสดง Modal หมายเหตุ (คลิกพื้นที่ว่างเปิด url ได้)
 *        - ไม่มี comment → เปิด url ทันที
 *   2. การ์ดสามารถมีเฉพาะ comment โดยไม่มี url ได้ (การ์ดบันทึกช่วยจำ)
 *   3. สิทธิ์: มีรหัสผ่านใน sessionStorage ⇒ Unlock แล้ว ⇒ แก้ไขได้
 *      ★ การ์ดในหมวดหมู่เข้ารหัสไม่อนุญาตให้แก้ไขที่หน้าบ้าน
 *   4. ผู้ใช้ที่ Unlock แล้ว:
 *        - มี comment: แสดงปุ่ม "แก้ไข"
 *        - ไม่มี comment: คลิกขวา / กดค้างที่การ์ด → เปิดตัวแก้ไข
 *
 * ปุ่มตัวแก้ไข:
 *   - มีเพียง [ย้อนกลับ] และ [บันทึก]; ล้างข้อความแล้วบันทึก = ลบหมายเหตุ
 *
 * ธีม: nebula / notion / stripe / dark / mint
 *
 * API ภายนอก:
 *   window.NoteModal = { show, openEditor, canEdit, renderMarkdown,
 *                        applyOverrides, getOverrides, clearOverrides };
 * ================================================================================ */
(function(global) {
    'use strict';

    var PWD_KEY   = 'bm_cfg_enc_pwd';
    var LS_NOTES  = 'bm_comment_overrides';
    var CONFIG_HREF = 'config.html';

    /* ───────────────────────── ย้ายข้อมูลเก่า ───────────────────────── */
    (function migrateFromSession() {
        try {
            var ss = sessionStorage.getItem(LS_NOTES);
            if (!ss) return;
            var ssData = JSON.parse(ss) || {};
            var lsData = JSON.parse(localStorage.getItem(LS_NOTES) || '{}');
            var merged = Object.assign({}, ssData, lsData);
            localStorage.setItem(LS_NOTES, JSON.stringify(merged));
            sessionStorage.removeItem(LS_NOTES);
        } catch (e) {}
    })();

    /* ───────────────────────── ระลอกคลื่นเฉพาะปุ่ม ───────────────────────── */
    function attachRipple(el) {
        if (!el || el.__rippleAttached) return;
        el.__rippleAttached = true;
        el.addEventListener('mousedown', function(e) {
            if (el.__rippleDisabled) return;
            if (e.button !== 0) return;
            var rect = el.getBoundingClientRect();
            var size = Math.max(rect.width, rect.height) * 2;
            var r = document.createElement('span');
            r.className = 'note-ripple';
            r.style.width  = size + 'px';
            r.style.height = size + 'px';
            r.style.left   = (e.clientX - rect.left - size / 2 + (el.scrollLeft || 0)) + 'px';
            r.style.top    = (e.clientY - rect.top  - size / 2 + (el.scrollTop  || 0)) + 'px';
            el.appendChild(r);
            setTimeout(function() { if (r.parentNode) r.parentNode.removeChild(r); }, 650);
        });
    }

    /* ───────────────────────── ระลอกคลื่นเต็มหน้าจอ ─────────────────────────
     * ดักจับ mousedown บน bodyEl และสร้างระลอกคลื่นใน container (.note-mask)
     * position: fixed ครอบคลุมทั้งหน้าจอ กระจายจากจุดคลิก
     * z-index: 2 ของ box จะลอยอยู่เหนือระลอกคลื่น
     * ─────────────────────────────────────────────────────────── */
    function attachFullPageRipple(bodyEl, container) {
        if (!bodyEl || bodyEl.__fullRippleAttached) return;
        bodyEl.__fullRippleAttached = true;
        bodyEl.addEventListener('mousedown', function(e) {
            if (bodyEl.__rippleDisabled) return;
            if (e.button !== 0) return;
            // ไม่ทริกเกอร์เมื่อคลิกบนเครื่องมือ/textarea/ปุ่ม
            if (e.target && e.target.closest &&
                e.target.closest('.note-editor, .note-toolbar, .note-btn, .note-tb-btn')) {
                return;
            }
            var vw = window.innerWidth  || document.documentElement.clientWidth;
            var vh = window.innerHeight || document.documentElement.clientHeight;
            // ครอบคลุมทั้งหน้าจอ
            var size = Math.sqrt(vw * vw + vh * vh) * 2.2;
            var r = document.createElement('span');
            r.className = 'note-ripple-fullpage';
            r.style.width  = size + 'px';
            r.style.height = size + 'px';
            r.style.left   = (e.clientX - size / 2) + 'px';
            r.style.top    = (e.clientY - size / 2) + 'px';
            container.appendChild(r);
            setTimeout(function() { if (r.parentNode) r.parentNode.removeChild(r); }, 850);
        });
    }

    /* ───────────────────────── ตรวจสอบธีม ───────────────────────── */
    var FAV_THEME_MAP = {
        'index1.html': 'nebula',
        'index2.html': 'notion',
        'index3.html': 'stripe',
        'index4.html': 'dark',
        'index5.html': 'mint'
    };
    var VALID_THEMES = ['nebula', 'notion', 'stripe', 'dark', 'mint'];

    function detectNoteTheme() {
        try {
            var t = new URLSearchParams(location.search).get('theme');
            if (t && VALID_THEMES.indexOf(t) !== -1) return t;
        } catch (e) {}
        if (global.__FAV_PAGE_ID && FAV_THEME_MAP[global.__FAV_PAGE_ID]) {
            return FAV_THEME_MAP[global.__FAV_PAGE_ID];
        }
        var name = (location.pathname.split('/').pop() || '').toLowerCase();
        if (FAV_THEME_MAP[name]) return FAV_THEME_MAP[name];
        try {
            var ls = localStorage.getItem('fav_last_style');
            if (ls && FAV_THEME_MAP[ls]) return FAV_THEME_MAP[ls];
        } catch (e) {}
        return 'nebula';
    }

    /* ───────────────────────── การตรวจสอบสิทธิ์ ───────────────────────── */
    function canEdit(entry) {
        try {
            if (!sessionStorage.getItem(PWD_KEY)) return false;
        } catch (e) { return false; }
        if (entry && entry.meta && entry.meta.encrypted) return false;
        return true;
    }

    /* ───────────────────────── ตรวจสอบโหมดออนไลน์/ออฟไลน์ ───────────────────────── */
    var _onlineModeCache = null;
    async function detectOnlineMode() {
        if (_onlineModeCache !== null) return _onlineModeCache;
        try {
            var r = await fetch('/api/check', { credentials: 'same-origin' });
            _onlineModeCache = (r.status !== 404);
        } catch (e) {
            _onlineModeCache = false;
        }
        return _onlineModeCache;
    }

    /* ───────────────────────── meta → /api/comment path ───────────────────────── */
    // ★ ค้นหาดัชนีของ section key ในอาร์เรย์ sections
    function findSectionIndex(sectionKey) {
        // ใช้แผนผังดัชนีของ normalizeData เป็นลำดับแรก
        if (window.__sectionIndexMap && window.__sectionIndexMap[sectionKey] != null) {
            return window.__sectionIndexMap[sectionKey];
        }
        // fallback: วนลูปอาร์เรย์ sections
        var s = window.__sections || window.sections;
        if (Array.isArray(s)) {
            for (var i = 0; i < s.length; i++) {
                if (s[i] && s[i].key === sectionKey) return i;
            }
        }
        return -1;
    }

    function metaToJsonPath(meta) {
        if (!meta) return null;
        var sk = meta.sectionKey;
        if (!sk) return null;

        // ★ รูปแบบใหม่: path = ['sections', sectionIdx, 'cards', cardIdx, ..., 'comment']
        var sectionIdx = findSectionIndex(sk);
        if (sectionIdx < 0) return null;

        var path;
        if (meta.emailIndex != null) {
            // การ์ดอีเมล: ชี้ไปยังการ์ดที่ emailIndex ใน emailData section
            path = ['sections', sectionIdx, 'cards', meta.emailIndex];
            path.push('comment');
            return path;
        }

        path = ['sections', sectionIdx, 'cards'];
        if (meta.cardIndex == null) return null;
        path.push(meta.cardIndex);
        if (meta.subIndex != null) path.push('subCards', meta.subIndex);
        path.push('comment');
        return path;
    }

    /* ───────────────────────── HTML Escape ─────────────────────────
     * หมายเหตุ: ต้อง escape เพื่อป้องกัน XSS
     * และปลอดภัยเมื่ออยู่ในแอตทริบิวต์
     */
    function esc(s) {
        return String(s).replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
    }

    /* ───────────────────────── ไวต์ลิสต์ URL ─────────────────────────
     * URL ของ Markdown link ต้องผ่านไวต์ลิสต์ เพื่อป้องกัน javascript: XSS
     * รูปภาพ ![alt](src) ใช้ imgUrl ไวต์ลิสต์ รองรับ data:image/
     */
    function safeMdUrl(u) {
        var s = String(u || '').trim();
        if (!s) return '';
        if (/^(?:https?:|mailto:|tel:|\/|#|\?)/i.test(s)) return s;
        return '#';
    }
    function safeMdImgUrl(u) {
        var s = String(u || '').trim();
        if (!s) return '';
        if (/^(?:https?:|\/|data:image\/[a-zA-Z+.-]+;)/i.test(s)) return s;
        return '';
    }

    /* ───────────────────────── กรองความปลอดภัยของ SVG ───────────────────────── */
    function sanitizeSVG(raw) {
        if (!raw || typeof raw !== 'string') return '';
        return raw
            .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
            .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
            .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/\bon\w+\s*=\s*[^\s>\/]+/gi, '')
            .replace(/(?:href|xlink:href)\s*=\s*["']\s*javascript:/gi, 'data-removed="javascript-uri"');
    }

    /* ════════════════════════════════════════════════════════════
     * ตัวเรนเดอร์ Markdown น้ำหนักเบา (+ ตรวจจับ URL อัตโนมัติ)
     * ════════════════════════════════════════════════════════════ */
    function renderMarkdown(src) {
        if (!src) return '';
        src = String(src).replace(/\r\n/g, '\n');

        var codeBlocks = [];
        src = src.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function(_, lang, code) {
            codeBlocks.push('<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>');
            return '\u0000CB' + (codeBlocks.length - 1) + '\u0000';
        });

        var inlineCodes = [];
        src = src.replace(/`([^`\n]+)`/g, function(_, c) {
            inlineCodes.push('<code>' + esc(c) + '</code>');
            return '\u0000IC' + (inlineCodes.length - 1) + '\u0000';
        });

        var lines = src.split('\n');
        var out = [], i = 0;
        while (i < lines.length) {
            var line = lines[i];

            if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

            // ข้อความของผู้ใช้ทั้งหมดผ่าน esc() เพื่อป้องกัน XSS
            // แทนที่ Markdown บนข้อความที่ escape แล้ว
            // เพื่อหลีกเลี่ยงการ escape ซ้ำ
            var hm = /^(#{1,6})\s+(.*)$/.exec(line);
            if (hm) { out.push('<h' + hm[1].length + '>' + esc(hm[2]) + '</h' + hm[1].length + '>'); i++; continue; }

            if (/^\s*[-*+]\s+/.test(line)) {
                out.push('<ul>');
                while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                    out.push('<li>' + esc(lines[i].replace(/^\s*[-*+]\s+/, '')) + '</li>');
                    i++;
                }
                out.push('</ul>'); continue;
            }

            if (/^\s*\d+\.\s+/.test(line)) {
                out.push('<ol>');
                while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                    out.push('<li>' + esc(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>');
                    i++;
                }
                out.push('</ol>'); continue;
            }

            if (/^\s*>\s?/.test(line)) {
                var quote = [];
                while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
                    quote.push(esc(lines[i].replace(/^\s*>\s?/, ''))); i++;
                }
                out.push('<blockquote>' + quote.join('<br>') + '</blockquote>'); continue;
            }

            if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length &&
                /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
                var head = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
                i += 2;
                var rows = [];
                while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
                    rows.push(lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|'));
                    i++;
                }
                var t = '<table><thead><tr>';
                head.forEach(function(h) { t += '<th>' + esc(h.trim()) + '</th>'; });
                t += '</tr></thead><tbody>';
                rows.forEach(function(r) {
                    t += '<tr>';
                    r.forEach(function(c) { t += '<td>' + esc(c.trim()) + '</td>'; });
                    t += '</tr>';
                });
                t += '</tbody></table>';
                out.push(t); continue;
            }

            if (line.trim() === '') { i++; continue; }
            var para = [];
            while (i < lines.length && lines[i].trim() !== '' &&
                   !/^(#{1,6})\s+/.test(lines[i]) &&
                   !/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(lines[i]) &&
                   !/^\s*[-*+]\s+/.test(lines[i]) &&
                   !/^\s*\d+\.\s+/.test(lines[i]) &&
                   !/^\s*>\s?/.test(lines[i])) {
                para.push(esc(lines[i])); i++;
            }
            out.push('<p>' + para.join('<br>') + '</p>');
        }

        var html = out.join('\n');

        // รูปภาพ/ลิงก์: url ต้องผ่านไวต์ลิสต์ป้องกัน javascript:
        // alt/text ผ่าน esc แล้ว ไม่ escape ซ้ำ
        // url ผ่าน esc แล้ว ปลอดภัยเมื่อใช้ในแอตทริบิวต์
        html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function(_, alt, src) {
            var safe = safeMdImgUrl(src);
            if (!safe) return alt;  // โปรโตคอลรูปภาพไม่ถูกต้อง → ลดรูปลงเป็นข้อความธรรมดา
            // ปรับขนาดรูปภาพสูงสุด max-height 400px รักษาสัดส่วน
            return '<img alt="' + alt + '" src="' + safe + '"' +
                   ' style="max-width:100%;max-height:400px;object-fit:contain;display:block;margin:8px auto;border-radius:4px;"' +
                   ' loading="lazy"' +
                   ' onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'🖼 โหลดรูปภาพไม่สำเร็จ: \'+this.src,style:\'color:#999;font-size:12px;display:inline-block;padding:4px 8px;background:#f5f5f5;border-radius:4px;\'}))">';
        });
        html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function(_, text, url) {
            var safe = safeMdUrl(url);
            return '<a href="' + safe + '" target="_blank" rel="noopener noreferrer">' + text + '</a>';
        });
        html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
        html = html.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

        var aBlocks = [];
        html = html.replace(/<a\s+[^>]*>[\s\S]*?<\/a>/g, function(m) {
            aBlocks.push(m);
            return '\u0000AT' + (aBlocks.length - 1) + '\u0000';
        });
        html = html.replace(
            /(^|[\s(>])((?:https?:\/\/|www\.)[^\s<>"'`)]+)/g,
            function(m, pre, url) {
                var trailing = '';
                var tm = url.match(/[.,;:!?"']+$/);
                if (tm) { trailing = tm[0]; url = url.substring(0, url.length - trailing.length); }
                if (!url) return m;
                var href = url.indexOf('www.') === 0 ? 'http://' + url : url;
                return pre + '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + url + '</a>' + trailing;
            }
        );
        html = html.replace(/\u0000AT(\d+)\u0000/g, function(_, n) { return aBlocks[+n]; });

        html = html.replace(/\u0000IC(\d+)\u0000/g, function(_, n) { return inlineCodes[+n]; });
        html = html.replace(/\u0000CB(\d+)\u0000/g, function(_, n) { return codeBlocks[+n]; });

        return html;
    }

    /* ───────────────────────── บันทึกถาวรในเครื่อง ─────────────────────────
     * ★ ตรรกะใหม่:
     *   - saveOverride(key, comment): บันทึกเสมอ (แม้เป็นสตริงว่าง)
     *     แสดงถึง "แก้ไขหรือลบในเครื่องแล้ว รอซิงค์ลงไฟล์"
     *   - removeOverride(key): เรียกใช้เฉพาะเมื่อซิงค์สำเร็จเพื่อล้างเรคคอร์ด
     * ─────────────────────────────────────────────────────────── */
    function readOverrides() {
        try { return JSON.parse(localStorage.getItem(LS_NOTES) || '{}'); }
        catch (e) { return {}; }
    }
    function saveOverride(key, comment) {
        if (!key) return;
        try {
            var m = readOverrides();
            // บันทึกเสมอแม้ comment ว่าง
            //    สตริงว่าง = "ลบ comment ในเครื่องแล้ว รอซิงค์ลง data.js / KV"
            //    โค้ดเดิมจะตัดการลบออก
            //    ทำให้การแจ้งเตือน pending หายไป
            m[key] = comment || '';
            localStorage.setItem(LS_NOTES, JSON.stringify(m));
        } catch (e) {}
    }
    function removeOverride(key) {
        if (!key) return;
        try {
            var m = readOverrides();
            delete m[key];
            localStorage.setItem(LS_NOTES, JSON.stringify(m));
        } catch (e) {}
    }
    function clearAllOverrides() {
        try { localStorage.removeItem(LS_NOTES); } catch (e) {}
    }

    /* ★ ตรวจสอบว่ามีการแก้ไขในเครื่องที่ยังไม่ได้ซิงค์หรือไม่ */
    function getEntryKey(entry) {
        if (!entry) return '';
        return (entry.card && entry.card.id) || (entry.meta && entry.meta.uniqueKey) || '';
    }
    function getPendingRecord(entry) {
        var key = getEntryKey(entry);
        if (!key) return null;
        var ov = readOverrides();
        if (!Object.prototype.hasOwnProperty.call(ov, key)) return null;
        return { key: key, value: ov[key] };  // สตริงว่างแทนการลบที่รอซิงค์
    }

    /* ───────────────────────── เครื่องมือภายใน ───────────────────────── */
    function getEntry(cardId) {
        var api = window.__favPageAPI;
        return (api && typeof api.getCardById === 'function') ? api.getCardById(cardId) : null;
    }
    function closeCurrent() {
        var m = document.querySelector('.note-mask');
        if (m) m.remove();
    }
    function gotoUrl(card) {
        var rawUrl = card.url || card.descUrl || card.mailto || '';
        if (!rawUrl) return;
        // ไวต์ลิสต์โปรโตคอล: ปฏิเสธ javascript: ฯลฯ
        var s = String(rawUrl).trim();
        var url = /^(?:https?:|mailto:|tel:|\/|#|\?)/i.test(s) ? s : '';
        if (!url) return;
        if (card.isLocal) window.location.href = url;
        else              window.open(url, '_blank', 'noopener,noreferrer');
    }

    /* ★ HTML ข้อความแจ้งเตือน "รอซิงค์" */
    function buildPendingHTML(pending) {
        var isDelete = !pending.value;
        var link = ' · <a href="' + CONFIG_HREF + '" target="_blank" rel="noopener noreferrer" class="note-config-link">เปิดหน้า Settings →</a>';
        return (isDelete
            ? '✅ ลบในเบราว์เซอร์นี้แล้ว โปรดไปที่หน้า Settings เพื่อบันทึกลงไฟล์'
            : '✅ บันทึกลงในเบราว์เซอร์นี้แล้ว โปรดไปที่หน้า Settings เพื่อบันทึกลงไฟล์') + link;
    }

    /* ════════════════════════════════════════════════════════════
     * ฟังก์ชันตัวช่วยแถบเครื่องมือ Markdown
     * ════════════════════════════════════════════════════════════ */
    function tbWrap(ta, left, right, placeholder) {
        var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
        var sel = v.substring(s, e);
        var used = sel || (placeholder || '');
        ta.value = v.substring(0, s) + left + used + right + v.substring(e);
        ta.focus();
        var ns = s + left.length;
        ta.setSelectionRange(ns, ns + used.length);
    }
    function tbLinePrefix(ta, prefix) {
        var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
        var ls = v.lastIndexOf('\n', s - 1) + 1;
        var le = v.indexOf('\n', e);
        if (le === -1) le = v.length;
        var block = v.substring(ls, le);
        var lines = block.split('\n');
        var allHave = lines.length > 0 && lines.every(function(l) { return l.indexOf(prefix) === 0; });
        var newLines = allHave
            ? lines.map(function(l) { return l.substring(prefix.length); })
            : lines.map(function(l) { return prefix + l; });
        var newBlock = newLines.join('\n');
        ta.value = v.substring(0, ls) + newBlock + v.substring(le);
        ta.focus();
        ta.setSelectionRange(ls, ls + newBlock.length);
    }
    function tbCodeBlock(ta) {
        var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
        var sel = v.substring(s, e) || 'โค้ด';
        var needNlBefore = s > 0 && v.charAt(s - 1) !== '\n';
        var needNlAfter  = v.charAt(e) !== '\n';
        var insert = (needNlBefore ? '\n' : '') + '```\n' + sel + '\n```' + (needNlAfter ? '\n' : '');
        ta.value = v.substring(0, s) + insert + v.substring(e);
        ta.focus();
        var codeStart = s + (needNlBefore ? 1 : 0) + 4;
        ta.setSelectionRange(codeStart, codeStart + sel.length);
    }
    function tbLink(ta) {
        var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
        var sel = v.substring(s, e);
        var text = sel || 'ข้อความลิงก์';
        var url  = 'https://';
        var insert = '[' + text + '](' + url + ')';
        ta.value = v.substring(0, s) + insert + v.substring(e);
        ta.focus();
        var urlStart = s + text.length + 3;
        ta.setSelectionRange(urlStart, urlStart + url.length);
    }
    function tbImage(ta) {
        var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
        var sel = v.substring(s, e);
        var alt = sel || 'คำอธิบายรูปภาพ';
        var url = 'https://';
        var insert = '![' + alt + '](' + url + ')';
        ta.value = v.substring(0, s) + insert + v.substring(e);
        ta.focus();
        var urlStart = s + alt.length + 4;
        ta.setSelectionRange(urlStart, urlStart + url.length);
    }
    function tbHr(ta) {
        var s = ta.selectionStart, v = ta.value;
        var needNlBefore = s > 0 && v.charAt(s - 1) !== '\n';
        var insert = (needNlBefore ? '\n' : '') + '\n---\n\n';
        ta.value = v.substring(0, s) + insert + v.substring(ta.selectionEnd);
        ta.focus();
        var pos = s + insert.length;
        ta.setSelectionRange(pos, pos);
    }

    function buildToolbar(ta) {
        var groups = [
            [
                { label: 'H1', title: 'หัวข้อระดับ 1', run: function(){ tbLinePrefix(ta, '# '); } },
                { label: 'H2', title: 'หัวข้อระดับ 2', run: function(){ tbLinePrefix(ta, '## '); } },
                { label: 'H3', title: 'หัวข้อระดับ 3', run: function(){ tbLinePrefix(ta, '### '); } }
            ],
            [
                { label: 'B', title: 'ตัวหนา (Ctrl+B)', cls: 'tb-bold',
                  run: function(){ tbWrap(ta, '**', '**', 'ข้อความตัวหนา'); } },
                { label: 'I', title: 'ตัวเอียง (Ctrl+I)', cls: 'tb-italic',
                  run: function(){ tbWrap(ta, '*', '*', 'ข้อความตัวเอียง'); } },
                { label: 'S', title: 'ขีดฆ่า', cls: 'tb-strike',
                  run: function(){ tbWrap(ta, '~~', '~~', 'ข้อความขีดฆ่า'); } }
            ],
            [
                { label: '❝', title: 'อ้างอิง',     run: function(){ tbLinePrefix(ta, '> '); } },
                { label: '•', title: 'รายการแบบไม่มีลำดับ', run: function(){ tbLinePrefix(ta, '- '); } },
                { label: '1.', title: 'รายการแบบมีลำดับ', run: function(){ tbLinePrefix(ta, '1. '); } }
            ],
            [
                { label: '</>', title: 'โค้ดในบรรทัด', cls: 'tb-code',
                  run: function(){ tbWrap(ta, '`', '`', 'code'); } },
                { label: '{ }', title: 'บล็อกโค้ด',   cls: 'tb-code',
                  run: function(){ tbCodeBlock(ta); } }
            ],
            [
                { label: '🔗', title: 'ลิงก์ (Ctrl+K)', run: function(){ tbLink(ta); } },
                { label: '🖼', title: 'รูปภาพ',         run: function(){ tbImage(ta); } },
                { label: '—', title: 'เส้นคั่น',       run: function(){ tbHr(ta); } }
            ]
        ];

        var tb = document.createElement('div');
        tb.className = 'note-toolbar';
        tb.setAttribute('role', 'toolbar');

        groups.forEach(function(group, gi) {
            if (gi > 0) {
                var sep = document.createElement('span');
                sep.className = 'note-tb-sep';
                tb.appendChild(sep);
            }
            group.forEach(function(item) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'note-tb-btn' + (item.cls ? ' ' + item.cls : '');
                b.title = item.title;
                b.textContent = item.label;
                b.addEventListener('mousedown', function(e) { e.preventDefault(); });
                b.addEventListener('click', function(e) { e.preventDefault(); item.run(); });
                tb.appendChild(b);
            });
        });

        return tb;
    }

    /* ───────────────────────── สร้าง Modal ───────────────────────── */
    function buildModal(entry, opts) {
        var card  = entry.card;
        var url   = card.url || card.descUrl || card.mailto || '';
        var title = card.title || card.content || card.desc || '(ไม่มีชื่อ)';

        var mask = document.createElement('div');
        mask.className = 'note-mask';
        mask.setAttribute('data-note-theme', detectNoteTheme());

        var iconHtml;
        if (card.iconImg) {
            iconHtml = '<span class="note-icon"><img src="' + esc(card.iconImg) + '" alt=""></span>';
        } else if (card.icon && String(card.icon).charAt(0) === '<') {
            iconHtml = '<span class="note-icon note-icon-svg">' + sanitizeSVG(card.icon) + '</span>';
        } else if (card.icon) {
            iconHtml = '<span class="note-icon">' + esc(card.icon) + '</span>';
        } else {
            iconHtml = '<span class="note-icon">📝</span>';
        }

        var box = document.createElement('div');
        box.className = 'note-box';
        box.innerHTML =
            '<div class="note-header">' +
                iconHtml +
                '<h3 class="note-title" title="' + esc(title) + '">' + esc(title) + '</h3>' +
                '<button class="note-close" aria-label="ปิด">✕</button>' +
            '</div>' +
            '<div class="note-body" id="noteBody"></div>' +
            '<div class="note-footer" id="noteFooter"></div>';
        mask.appendChild(box);

        var editable     = canEdit(entry);
        var comment      = card.comment || '';
        var startEditing = !!opts.editing;

        function render() {
            var body   = box.querySelector('#noteBody');
            var footer = box.querySelector('#noteFooter');
            body.innerHTML   = '';
            footer.innerHTML = '';
            body.classList.remove('clickable');
            body.title   = '';
            body.onclick = null;

            var pending = getPendingRecord(entry);

            if (startEditing) {
                /* ═══════════ โหมดแก้ไข ═══════════ */
                body.__rippleDisabled = true;  // โหมดแก้ไขปิดระลอกคลื่นบน body

                var ta = document.createElement('textarea');
                ta.className   = 'note-editor';
                ta.placeholder = 'รองรับ Markdown: # หัวข้อ | **หนา** *เอียง* | `code` | ```บล็อกโค้ด``` | [ข้อความ](url) | - รายการ | > อ้างอิง | --- เส้นคั่น\n\n(ล้างเนื้อหาและบันทึกจะเป็นการลบหมายเหตุ)';
                ta.value       = comment;

                var toolbar = buildToolbar(ta);
                var wrap = document.createElement('div');
                wrap.className = 'note-editor-wrap';
                wrap.appendChild(toolbar);
                wrap.appendChild(ta);
                body.appendChild(wrap);

                setTimeout(function() { ta.focus(); }, 50);

                var status = document.createElement('div');
                status.className = 'note-status';
                // หากมีการแก้ไขที่ยังไม่ได้ซิงค์ แสดงข้อความแจ้งเตือนทันที
                if (pending) {
                    status.className = 'note-status pending';
                    status.innerHTML = buildPendingHTML(pending);
                }
                footer.appendChild(status);

                var backBtn = document.createElement('button');
                backBtn.className   = 'note-btn note-btn-secondary';
                backBtn.textContent = 'ย้อนกลับ';
                backBtn.onclick = function() {
                    if (comment) { startEditing = false; render(); }
                    else          { mask.remove(); }
                };
                footer.appendChild(backBtn);

                var saveBtn = document.createElement('button');
                saveBtn.className   = 'note-btn note-btn-primary';
                saveBtn.textContent = 'บันทึก';
                footer.appendChild(saveBtn);

                saveBtn.onclick = function() {
                    var val = ta.value.trim();
                    if (!val && comment) {
                        if (!confirm('เนื้อหาหมายเหตุว่างเปล่า การบันทึกจะเป็นการลบหมายเหตุนี้ ต้องการดำเนินการต่อหรือไม่?')) return;
                    }
                    doSave(ta.value, status, saveBtn, ta);
                };

                ta.addEventListener('keydown', function(e) {
                    var mod = e.ctrlKey || e.metaKey;
                    if (mod && e.key === 'Enter') { e.preventDefault(); saveBtn.click(); return; }
                    if (!mod || e.shiftKey || e.altKey) return;
                    var k = e.key.toLowerCase();
                    if (k === 'b') { e.preventDefault(); tbWrap(ta, '**', '**', 'ข้อความตัวหนา'); }
                    else if (k === 'i') { e.preventDefault(); tbWrap(ta, '*', '*', 'ข้อความตัวเอียง'); }
                    else if (k === 'k') { e.preventDefault(); tbLink(ta); }
                });

            } else {
                /* ═══════════ โหมดดู ═══════════ */
                body.__rippleDisabled = false;
                // ระลอกคลื่นเต็มหน้า: ผูกกับ body
                attachFullPageRipple(body, mask);

                if (comment) {
                    var md = document.createElement('div');
                    md.className = 'note-md';
                    md.innerHTML = renderMarkdown(comment);
                    body.appendChild(md);

                    // เมื่อ <a> ไม่มี title ของตนเอง
                    // จะใช้ href ของตนเอง
                    // กำหนดข้อความแจ้งเตือนให้กับแต่ละลิงก์ในหมายเหตุ
                    md.querySelectorAll('a[href]').forEach(function(a) {
                        var href = a.getAttribute('href');
                        a.title = (href && href !== '#') ? ('คลิกเพื่อเปิด: ' + href) : '';
                    });

                    if (url) {
                        body.classList.add('clickable');
                        // ข้อความ hover พร้อม URL
                        body.title = 'คลิกเพื่อเปิด: ' + url;
                        body.onclick = function(e) {
                            if (e.target.closest && e.target.closest('a')) return;
                            gotoUrl(card); mask.remove();
                        };
                    }
                } else {
                    var hint = document.createElement('div');
                    hint.className  = 'note-empty-hint';
                    hint.textContent = editable ? '(การ์ดนี้ยังไม่มีหมายเหตุ คลิก "เพิ่มหมายเหตุ" เพื่อสร้าง)'
                                                : '(การ์ดนี้ยังไม่มีหมายเหตุ)';
                    body.appendChild(hint);
                }

                // footer: วางสถานะ pending (ถ้ามี) แล้วตามด้วยปุ่ม
                if (pending) {
                    var pStat = document.createElement('div');
                    pStat.className = 'note-status pending';
                    pStat.innerHTML = buildPendingHTML(pending);
                    footer.appendChild(pStat);
                }

                if (editable) {
                    var editBtn = document.createElement('button');
                    editBtn.className   = 'note-btn note-btn-primary';
                    editBtn.textContent = comment ? 'แก้ไข' : 'เพิ่มหมายเหตุ';
                    editBtn.onclick = function() { startEditing = true; render(); };
                    footer.appendChild(editBtn);
                } else {
                    var tip = document.createElement('span');
                    tip.className = 'note-readonly-tip';
                    if (entry.meta && entry.meta.encrypted) {
                        tip.innerHTML = '🔒 เนื้อหาที่เข้ารหัสโปรดไปแก้ไขที่หน้า Settings';
                    } else {
                        tip.innerHTML = '🔒 อ่านอย่างเดียว (Unlock เพื่อแก้ไข)';
                    }
                    footer.appendChild(tip);
                }
            }

            // ปุ่มทั้งหมดติดตั้งระลอกคลื่นเฉพาะที่
            box.querySelectorAll('.note-btn, .note-tb-btn').forEach(attachRipple);
        }

        /* ═════════════════════════ ตรรกะการบันทึก ═════════════════════════ */
        async function doSave(newComment, statusEl, saveBtn, ta) {
            saveBtn && (saveBtn.disabled = true);
            statusEl.className   = 'note-status';
            statusEl.textContent = 'กำลังบันทึก...';

            var finalComment = (newComment || '').trim();
            var isDelete     = !finalComment;

            if (!canEdit(entry)) {
                statusEl.className = 'note-status err';
                statusEl.textContent = (entry.meta && entry.meta.encrypted)
                    ? '🔒 เนื้อหาที่เข้ารหัสโปรดไปแก้ไขที่หน้า Settings'
                    : '❌ ยังไม่ได้ Unlock ไม่สามารถบันทึกได้';
                saveBtn && (saveBtn.disabled = false);
                return;
            }

            try {
                var savedToServer = false;

                if (typeof window.onNoteSave === 'function') {
                    await window.onNoteSave({
                        card:    card,
                        meta:    entry.meta || {},
                        comment: finalComment
                    });
                    savedToServer = true;
                } else {
                    var online = await detectOnlineMode();
                    if (online) {
                        var path = metaToJsonPath(entry.meta || {});
                        if (!path) throw new Error('ไม่สามารถสร้างเส้นทางระบุตำแหน่งได้');
                        var resp = await fetch('/api/comment', {
                            method:      'POST',
                            credentials: 'same-origin',
                            headers:     { 'Content-Type': 'application/json' },
                            body:        JSON.stringify({ path: path, comment: finalComment })
                        });
                        if (resp.status === 401 || resp.status === 403) {
                            throw new Error('ยังไม่ได้เข้าสู่ระบบ (โปรดเข้าสู่ระบบที่หน้า Settings ก่อน)');
                        }
                        if (!resp.ok) {
                            var t = await resp.text().catch(function() { return ''; });
                            throw new Error(t || ('HTTP ' + resp.status));
                        }
                        var json = await resp.json().catch(function() { return {}; });
                        if (json && json.ok === false) {
                            throw new Error(json.error || 'เซิร์ฟเวอร์บันทึกไม่สำเร็จ');
                        }
                        savedToServer = true;
                    }
                }

                // อัปเดต card ในหน่วยความจำ
                if (finalComment) card.comment = finalComment;
                else              delete card.comment;

                // ซิงค์ overrides ใน localStorage
                // การแก้ไขสำคัญ:
                //   - ซิงค์กับเซิร์ฟเวอร์แล้ว → removeOverride ลบเรคคอร์ด
                //   - บันทึกเฉพาะในเครื่อง → saveOverride คงสถานะ pending
                var key = getEntryKey(entry);
                if (savedToServer) {
                    removeOverride(key);
                } else {
                    saveOverride(key, finalComment);
                }

                comment = finalComment;
                updateCardHasNoteBadge(entry);

                /* ข้อความสถานะ */
                statusEl.className = 'note-status ok';
                var link = ' · <a href="' + CONFIG_HREF + '" target="_blank" rel="noopener" class="note-config-link">เปิดหน้า Settings →</a>';
                if (savedToServer) {
                    statusEl.innerHTML = (isDelete ? '✅ ลบและซิงค์กับเซิร์ฟเวอร์สำเร็จ' : '✅ บันทึกและซิงค์กับเซิร์ฟเวอร์สำเร็จ') + link;
                } else {
                    statusEl.className = 'note-status pending';
                    statusEl.innerHTML = (isDelete
                        ? '✅ ลบในเบราว์เซอร์นี้แล้ว โปรดไปที่หน้า Settings เพื่อบันทึกลงไฟล์'
                        : '✅ บันทึกลงในเบราว์เซอร์นี้แล้ว โปรดไปที่หน้า Settings เพื่อบันทึกลงไฟล์') + link;
                }

                if (saveBtn) saveBtn.disabled = false;

            } catch (err) {
                statusEl.className   = 'note-status err';
                statusEl.textContent = '❌ บันทึกไม่สำเร็จ: ' + ((err && err.message) || err);
                saveBtn && (saveBtn.disabled = false);
            }
        }

        box.querySelector('.note-close').onclick = function() { mask.remove(); };
        // ปิดเฉพาะเมื่อกดและปล่อยบน mask เท่านั้น
        // ป้องกันการปิดโดยไม่ตั้งใจ
        var _maskDownOnSelf = false;
        mask.addEventListener('mousedown', function(e) {
            _maskDownOnSelf = (e.target === mask);
        });
        mask.addEventListener('mouseup', function(e) {
            if (_maskDownOnSelf && e.target === mask) mask.remove();
            _maskDownOnSelf = false;
        });

        function escHandler(e) {
            if (e.key === 'Escape' && mask.parentNode) {
                mask.remove();
                document.removeEventListener('keydown', escHandler);
            }
        }
        document.addEventListener('keydown', escHandler);

        document.body.appendChild(mask);
        render();
    }

    /* ───────────────────────── ตัวช่วยซิงค์จุดแดงบน DOM ─────────────────────────
     * รวมการเพิ่มคลาส .has-note และ <span class='note-dot'> เข้าด้วยกัน
     * ใช้ DOM element จริงแทน ::after ป้องกันการชนกัน
     * (เช่น เส้นสีเขียวใน index5)
     * ─────────────────────────────────────────────────────────── */
    function setHasNote(el, hasNote) {
        if (!el || !el.classList) return;
        if (hasNote) {
            el.classList.add('has-note');
            var has = false;
            for (var i = 0; i < el.children.length; i++) {
                if (el.children[i].classList &&
                    el.children[i].classList.contains('note-dot')) { has = true; break; }
            }
            if (!has) {
                var dot = document.createElement('span');
                dot.className = 'note-dot';
                dot.setAttribute('aria-hidden', 'true');
                el.appendChild(dot);
            }
        } else {
            el.classList.remove('has-note');
            for (var j = el.children.length - 1; j >= 0; j--) {
                var c = el.children[j];
                if (c.classList && c.classList.contains('note-dot')) el.removeChild(c);
            }
        }
    }

    /* ───────────────────────── อัปเดตจุดแดงของการ์ด ───────────────────────── */
    function updateCardHasNoteBadge(entry) {
        var nodes = document.querySelectorAll('[data-card-id]');
        nodes.forEach(function(el) {
            var cid = el.getAttribute('data-card-id');
            var e = getEntry(cid);
            if (!e || e.card !== entry.card) return;
            setHasNote(el, !!e.card.comment);
        });
    }

    /* ════════════════════════════════════════════════════════════
     * applyOverrides
     * ════════════════════════════════════════════════════════════ */
    function applyOverrides() {
        var overrides = readOverrides();
        if (!overrides || !Object.keys(overrides).length) {
            refreshAllBadges();
            return;
        }

        var api = window.__favPageAPI;
        if (!api || typeof api.getCardById !== 'function') return;

        var nodes = document.querySelectorAll('[data-card-id]');
        if (!nodes.length) return;

        var seen = new Set ? new Set() : null;

        nodes.forEach(function(el) {
            var cid = el.getAttribute('data-card-id');
            var entry = api.getCardById(cid);
            if (!entry || !entry.card) return;

            var key = (entry.card && entry.card.id) || (entry.meta && entry.meta.uniqueKey);
            if (key) {
                if (!seen || !seen.has(entry.card)) {
                    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
                        var v = overrides[key];
                        // สตริงว่างแทนการลบในเครื่องรอซิงค์ → ลบ comment ออกจากการ์ด
                        if (v) entry.card.comment = v;
                        else   delete entry.card.comment;
                    }
                    if (seen) seen.add(entry.card);
                }
            }

            setHasNote(el, !!entry.card.comment);
        });
    }

    function refreshAllBadges() {
        var nodes = document.querySelectorAll('[data-card-id]');
        nodes.forEach(function(el) {
            var entry = getEntry(el.getAttribute('data-card-id'));
            if (!entry || !entry.card) return;
            setHasNote(el, !!entry.card.comment);
        });
    }

    /* ════════════════════════════════════════════════════════════
     * เมื่อเริ่มต้น: รอ fav-page.js เรนเดอร์เสร็จ → เรียกใช้ applyOverrides อัตโนมัติ
     * ════════════════════════════════════════════════════════════ */
    var applyDebounceTimer = null;
    function scheduleApply() {
        if (applyDebounceTimer) clearTimeout(applyDebounceTimer);
        applyDebounceTimer = setTimeout(function() {
            applyDebounceTimer = null;
            applyOverrides();
        }, 80);
    }

    function bootApplyObserver() {
        [0, 200, 600, 1500].forEach(function(t) { setTimeout(scheduleApply, t); });

        try {
            var mo = new MutationObserver(function(mutations) {
                var needApply = false;
                for (var i = 0; i < mutations.length; i++) {
                    var m = mutations[i];
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        var n = m.addedNodes[j];
                        if (n.nodeType !== 1) continue;
                        if ((n.hasAttribute && n.hasAttribute('data-card-id')) ||
                            (n.querySelector && n.querySelector('[data-card-id]'))) {
                            needApply = true; break;
                        }
                    }
                    if (needApply) break;
                }
                if (needApply) scheduleApply();
            });
            mo.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootApplyObserver);
    } else {
        bootApplyObserver();
    }

    /* ───────────────────────── ช่องทางภายนอก ───────────────────────── */
    function show(cardId) {
        var entry = getEntry(cardId);
        if (!entry) return;
        closeCurrent();
        buildModal(entry, { editing: false });
    }
    function openEditor(cardId) {
        var entry = getEntry(cardId);
        if (!entry) return;
        if (!canEdit(entry)) { show(cardId); return; }
        closeCurrent();
        buildModal(entry, { editing: true });
    }

    global.NoteModal = {
        show:           show,
        openEditor:     openEditor,
        canEdit:        canEdit,
        renderMarkdown: renderMarkdown,
        applyOverrides: applyOverrides,
        getOverrides:   readOverrides,
        clearOverrides: clearAllOverrides   // สำหรับล้างค่าหลัง Settings บันทึก
    };

    /* ════════════════════════════════════════════════════════════
     * คลิกขวา / กดค้าง → เปิดตัวแก้ไข (เฉพาะที่ Unlock แล้วและไม่ใช่การ์ดเข้ารหัส)
     * ════════════════════════════════════════════════════════════ */
    function findCardId(target) {
        if (!target || !target.closest) return null;
        var el = target.closest('[data-card-id]');
        return el ? el.getAttribute('data-card-id') : null;
    }

    document.addEventListener('contextmenu', function(e) {
        var cid = findCardId(e.target);
        if (!cid) return;
        var entry = getEntry(cid);
        if (!canEdit(entry)) return;
        e.preventDefault();
        openEditor(cid);
    });

    var touchTimer = null;
    document.addEventListener('touchstart', function(e) {
        var cid = findCardId(e.target);
        if (!cid) return;
        var entry = getEntry(cid);
        if (!canEdit(entry)) return;
        touchTimer = setTimeout(function() {
            touchTimer = null;
            openEditor(cid);
        }, 600);
    }, { passive: true });
    ['touchmove', 'touchend', 'touchcancel'].forEach(function(ev) {
        document.addEventListener(ev, function() {
            if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
        }, { passive: true });
    });

})(window);