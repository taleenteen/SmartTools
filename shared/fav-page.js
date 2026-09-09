/* ================================================================================
 * shared/fav-page.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ตรรกะทั่วไปของหน้า Bookmarks (ใช้ร่วมกัน 5 สไตล์)
 *
 * สิ่งที่จำเป็นต้องโหลดก่อน:
 *   1. data.js                → ให้ข้อมูล sections ต่างๆ
 
 *   2. shared/enc-unlock.js   → โมดูล Unlock หมวดหมู่เข้ารหัส (ตัวเลือก)
 *   3. shared/enc-rerender.js → เรนเดอร์โมดูลเข้ารหัสซ้ำโดยไม่ต้องรีเฟรช (ตัวเลือก)
 *   4. shared/note-modal.js   → Modal หมายเหตุการ์ด (ตัวเลือก)
 *
 * แต่ละหน้าก่อนโหลดไฟล์นี้ต้องตั้งค่า:
 *   <script>window.__FAV_PAGE_ID = 'indexN.html';</script>
 * ================================================================================ */


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 0】เครื่องหมายสถานะมุมมอง
 *   CSS ค่าเริ่มต้น `html:not([data-admin-view]) .back-link {display:none}`,
 *   เฉพาะมุมมอง admin เท่านั้นที่จะแสดงปุ่ม
 *   บล็อกนี้ทำงานแบบซิงโครนัสก่อน DOMContentLoaded เพื่อป้องกันการกระพริบ
 * ════════════════════════════════════════════════════════════════════════════════ */
(function () {
    try {
        var vi = window.__viewerInfo;
        // เมื่อไม่มี viewerInfo แสดงปุ่มตามค่าเริ่มต้น
        if (!vi || (vi.isAdminView && !vi.slug)) {
            document.documentElement.setAttribute('data-admin-view', '');
        }
    } catch (e) {
        document.documentElement.setAttribute('data-admin-view', '');
    }
})();


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 1】บันทึกสไตล์ถาวร
 * ════════════════════════════════════════════════════════════════════════════════ */
try {
    if (window.__FAV_PAGE_ID) {
        localStorage.setItem('fav_last_style', window.__FAV_PAGE_ID);
    }
} catch (e) {}


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 2】การแปลงรูปแบบข้อมูลและการรองรับข้อมูลที่ขาดหาย
 * ════════════════════════════════════════════════════════════════════════════════ */
// ★ ปรับรูปแบบข้อมูลเดิมให้เป็นอาร์เรย์ sections
function normalizeData() {
    if (window.__sections) return window.__sections;
    if (Array.isArray(window.sections)) {
        // ★ แก้ไขแฟล็ก dynamic ของหมวดหมู่ในตัว
        var BUILTIN_DYNAMIC = { onlineAIData: true, videoData: true };
        window.sections.forEach(function(s) {
            if (s.builtin && BUILTIN_DYNAMIC.hasOwnProperty(s.key)) s.dynamic = BUILTIN_DYNAMIC[s.key];
        });
        window.__sections = window.sections;
        window.__sectionIndexMap = {};
        window.__sections.forEach(function(sec, i) { window.__sectionIndexMap[sec.key] = i; });
        return window.__sections;
    }

    // รูปแบบเดิม: แปลง var เดิมเป็น sections
    if (typeof usbDriveData !== 'undefined') {
        var s = [];
        // ★ หมวดหมู่การ์ดทั่วไป
        var cardDefs = [
            { key:'usbDriveData',  kind:'card',    defaultLabel:'☁️ ไดรฟ์ออนไลน์',    label:'☁️ ไดรฟ์ออนไลน์',    dynamic:false },
            { key:'teachingData',  kind:'card',    defaultLabel:'📚 สื่อการสอน',    label:'📚 สื่อการสอน',    dynamic:false },
            { key:'onlineAIData',  kind:'card',    defaultLabel:'🖥️ แหล่งข้อมูลออนไลน์',    label:'🖥️ แหล่งข้อมูลออนไลน์',    dynamic:true  },
            { key:'videoData',     kind:'card',    defaultLabel:'🎬 วิดีโอรวม',    label:'🎬 วิดีโอรวม',    dynamic:true  }
        ];
        // ★ หมวดหมู่การติดต่อ (อยู่ท้ายสุดเสมอ)
        var contactDefs = [
            { key:'emailData',     kind:'email',   defaultLabel:'📨 อีเมล',    label:'📨 อีเมล',    dynamic:false },
            { key:'contactData',   kind:'contact', defaultLabel:'📨 ช่องทางติดต่ออื่นๆ', label:'📨 ช่องทางติดต่ออื่นๆ', dynamic:false }
        ];
        cardDefs.forEach(function(d) {
            s.push({ builtin:true, key:d.key, kind:d.kind, defaultLabel:d.defaultLabel, label:d.label, visible:true, dynamic:d.dynamic, cards: window[d.key] || [] });
        });
        // แทรกหมวดหมู่กำหนดเองระหว่าง card และ contact
        if (Array.isArray(window.customSections)) {
            window.customSections.forEach(function(c) {
                // ส่งต่อฟิลด์ anchor
                s.push({ builtin:false, key:c.key, kind:'card', defaultLabel:c.label, label:c.label, visible:true, dynamic:!!c.dynamic, encrypted:!!c.encrypted, enc:c.enc||null, cards:c.cards||[], anchor: c.anchor || '' });
            });
        }
        contactDefs.forEach(function(d) {
            s.push({ builtin:true, key:d.key, kind:d.kind, defaultLabel:d.defaultLabel, label:d.label, visible:true, dynamic:d.dynamic, cards: window[d.key] || [] });
        });
        window.__sections = s;
        // สร้างแผนผัง key→index
        window.__sectionIndexMap = {};
        s.forEach(function(sec, i) { window.__sectionIndexMap[sec.key] = i; });
        return s;
    }

    // ไม่มีข้อมูล
    var _container = document.querySelector('.container');
    if (_container) {
        _container.innerHTML =
            '<div class="error-container"><div class="error-card">' +
                '<span class="error-emoji">📂</span>' +
                '<h2 class="error-title">โหลดข้อมูลไม่สำเร็จ</h2>' +
                '<p class="error-message">ไม่สามารถโหลดเนื้อหา Bookmarks ได้ อาจเกิดจากไฟล์ข้อมูลสูญหายหรือมีข้อผิดพลาดทางไวยากรณ์</p>' +
                '<a href="/" class="error-home-btn">← กลับสู่หน้าหลัก</a>' +
            '</div></div>';
    }
    throw new Error('ไม่ได้โหลดไฟล์ข้อมูล');
}
normalizeData();


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 3】ตัวแปรสถานะส่วนกลาง
 * ════════════════════════════════════════════════════════════════════════════════ */
var currentExpanded  = null;
var currentLayout    = 'mobile';
var currentEmailData = null;  // ตั้งค่าแบบไดนามิก
var isAnimating      = false;
var __allSections    = window.__sections;  // แหล่งข้อมูลรวม


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 3.5】ตารางลงทะเบียนการ์ด (สำหรับ NoteModal)
 * ════════════════════════════════════════════════════════════════════════════════
 * สร้าง id ใหม่ทุกครั้งที่เรนเดอร์
 * ฟิลด์ meta:
 *   sectionKey   → คีย์ของหมวดหมู่
 *   cardIndex    → ดัชนีในการ์ด
 *   subIndex     → ดัชนีการ์ดย่อย
 *   emailIndex   → ดัชนีแท็บอีเมล
 *   encrypted    → เป็นหมวดหมู่เข้ารหัสหรือไม่
 *   uniqueKey    → คีย์คงที่สำหรับสำรองข้อมูล
 * ──────────────────────────────────────────────────────────────────────────────── */
var __cardRegistry = {};
var __cardIdSeq    = 0;

function __registerCard(card, meta) {
    meta = meta || {};
    if (!meta.uniqueKey) {
        meta.uniqueKey =
            (meta.sectionKey || '?') +
            '/' + (meta.cardIndex != null ? meta.cardIndex : (meta.emailIndex != null ? 'email' + meta.emailIndex : '?')) +
            (meta.subIndex != null ? '/' + meta.subIndex : '');
    }
    var id = '__fc_' + (++__cardIdSeq);
    __cardRegistry[id] = { card: card, meta: meta };
    return id;
}

/**
 * จุดเข้าใช้งานการคลิกการ์ด (ไม่ใช่แท็ก <a>):
 *   มี comment → เปิดหมายเหตุ; ไม่มี comment → เปิด url
 */
window.__favCardOpen = function(cardId) {
    var entry = __cardRegistry[cardId];
    if (!entry) return;
    var card = entry.card;
    if (card.comment && window.NoteModal) {
        window.NoteModal.show(cardId);
        return;
    }
    var url = __safeUrl(card.url);
    if (!url || url === '#') return;
    if (card.isLocal) window.location.href = url;
    else              window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * การดักจับคลิกของ <a href>: มี comment ดักจับ มิฉะนั้นใช้ค่าเริ่มต้นของเบราว์เซอร์
 */
window.__favLinkClick = function(cardId, event) {
    var entry = __cardRegistry[cardId];
    if (!entry || !entry.card.comment || !window.NoteModal) return true;
    if (event && event.preventDefault) event.preventDefault();
    window.NoteModal.show(cardId);
    return false;
};

/**
 * การคลิกการ์ดอีเมล
 *
 * การ์ดหลักด้านนอกเป็น <a target=_blank> คลิกซ้ายต้อง preventDefault
 * เพื่อให้เข้าสู่เงื่อนไขเปิดหมายเหตุได้
 * ปุ่มกลางไม่ทริกเกอร์ onclick → เปิดแท็บใหม่เบื้องหลัง
 */
window.__favEmailClick = function(event) {
    if (event && event.preventDefault) event.preventDefault();
    var cd = currentEmailData;
    if (!cd) return;
    if (cd.comment && window.NoteModal) {
        var cards = getEmailCards();
        var idx = cards.indexOf(cd);
        var cid = __registerCard(cd, {
            sectionKey: 'emailData',
            emailIndex: idx,
            uniqueKey:  'emailData/email/' + idx
        });
        window.NoteModal.show(cid);
    } else if (cd.url) {
        var url = __safeUrl(cd.url);
        if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
    }
};

/** ชื่อคลาสสำหรับการ์ดที่มีหมายเหตุ (สำหรับจุดสีแดง) */
function __noteCls(card) { return card && card.comment ? ' has-note' : ''; }

/* ป้ายกำกับการพุช
 * เมื่อมี card.pushedBy แสดงป้าย 📌
 * cid ใช้เป็น data-cid
 */
/* ป้ายกำกับการพุช
 * แสดงไอคอน 📌 hover แสดงผู้พุช/เวลา ลบได้ในหน้า Settings
 * ขนาด 18x18 emoji 10px
 */
function __renderPushedByBadge(card, cid) {
    if (!card || !card.pushedBy) return '';
    var by = String(card.pushedBy);
    var at = card.pushedAt ? String(card.pushedAt) : '';
    // tooltip รองรับการขึ้นบรรทัดใหม่
    var title = 'พุชจากผู้ดูแลระบบ · ' + by + (at ? '\n' + at : '') + '\n(หากต้องการลบ โปรดไปที่หน้า Settings)';
    // สไตล์วงกลมกะทัดรัด
    var style = 'position:absolute;top:5px;right:5px;z-index:5;' +
                'background:linear-gradient(135deg,#fef3c7,#fde68a);' +
                'color:#78350f;border:1px solid #f59e0b;border-radius:50%;' +
                'width:18px;height:18px;display:flex;align-items:center;justify-content:center;' +
                'font-size:10px;line-height:1;' +
                'pointer-events:auto;cursor:help;' +
                'box-shadow:0 1px 2px rgba(0,0,0,0.1);';
    return '<span class="fav-pushed-badge"' +
           ' data-cid="' + cid + '"' +
           ' style="' + style + '"' +
           ' title="' + __attr(title) + '"' +
           ' aria-label="' + __attr(title) + '"' +
           ' onclick="event.stopPropagation();event.preventDefault();return false;"' +
           '>📌</span>';
}

// สร้าง path ของการ์ดใน data.js
function __favBuildCardPath(entry) {
    if (!entry || !entry.meta) return null;
    var meta = entry.meta;
    var sk = meta.sectionKey;
    if (!sk) return null;
    // ค้นหาดัชนีของ key ใน sections
    var sectionIdx = -1;
    if (typeof window.sections !== 'undefined' && Array.isArray(window.sections)) {
        for (var i = 0; i < window.sections.length; i++) {
            if (window.sections[i] && window.sections[i].key === sk) {
                sectionIdx = i;
                break;
            }
        }
    }
    if (sectionIdx < 0) {
        // fallback รูปแบบเดิม
        var builtinKeys = ['usbDriveData', 'teachingData', 'onlineAIData', 'videoData', 'emailData', 'contactData'];
        if (builtinKeys.indexOf(sk) >= 0) {
            if (meta.cardIndex == null && meta.emailIndex == null) return null;
            var p = [sk, meta.emailIndex != null ? meta.emailIndex : meta.cardIndex];
            if (meta.subIndex != null) p.push('subCards', meta.subIndex);
            return p;
        }
        return null;
    }
    var path;
    if (meta.emailIndex != null) {
        path = ['sections', sectionIdx, 'cards', meta.emailIndex];
        return path;
    }
    if (meta.cardIndex == null) return null;
    path = ['sections', sectionIdx, 'cards', meta.cardIndex];
    if (meta.subIndex != null) path.push('subCards', meta.subIndex);
    return path;
}

/** ตัวช่วย: ใส่สตริงลงในแอตทริบิวต์ HTML อย่างปลอดภัย */
function __attr(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** ตัวช่วย: escape โหนดข้อความ HTML ป้องกัน XSS */
function __txt(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** ตัวช่วย: ไวต์ลิสต์โปรโตคอล URL ปฏิเสธ javascript: */
function __safeUrl(u) {
    var s = String(u == null ? '' : u).trim();
    if (!s) return '';
    if (/^(?:https?:|mailto:|tel:|\/|#|\?)/i.test(s)) return s;
    return '#';
}

/** ตัวช่วย: ไวต์ลิสต์ URL รูปภาพ รองรับ data:image/ + http(s) + พาธสัมพัทธ์ */
function __safeImgUrl(u) {
    var s = String(u == null ? '' : u).trim();
    if (!s) return '';
    if (/^(?:https?:|\/|data:image\/[a-zA-Z+.-]+;)/i.test(s)) return s;
    return '';
}

/** ตัวช่วย: กรองความถูกต้องของ anchor
 *  - อนุญาตเฉพาะ [a-zA-Z0-9_-]
 *  - ไม่ถูกต้องหรือว่าง → คืนสตริงว่าง เพื่อ fallback ไปใช้ sec.key */
function __safeAnchor(s) {
    if (s == null) return '';
    s = String(s).trim();
    if (!s) return '';
    return /^[a-zA-Z0-9_-]+$/.test(s) ? s : '';
}

/**
 * การมอบหมายอีเวนต์ส่วนกลาง: การเปิดลิงก์ของบรรทัดคำอธิบาย
 * แทนที่การต่อสตริง window.open
 * เพื่อให้ __safeUrl และ noopener,noreferrer มีผล
 * หมายเหตุ: ทำงานในขั้นตอน bubbling
 * มีผลกับการเรนเดอร์แบบไดนามิกเช่นกัน
 */
document.addEventListener('click', function(e) {
    if (!e.target || !e.target.closest) return;

    // 1. บรรทัดคำอธิบายเปิดลิงก์แยก
    //    preventDefault ป้องกันการเปิดของ <a> ด้านนอก
    var descEl = e.target.closest('[data-desc-url]');
    if (descEl) {
        var url = descEl.getAttribute('data-desc-url');
        if (url && url !== '#') {
            e.preventDefault();
            e.stopPropagation();
            window.open(url, '_blank', 'noopener,noreferrer');
        }
        return;
    }

    // 2. ปุ่มกาง/พับ section
    var secBtn = e.target.closest('.expand-section-btn[data-section-key]');
    if (secBtn) {
        var key = secBtn.getAttribute('data-section-key');
        if (key && typeof toggleSection === 'function') toggleSection(key);
    }
});

/**
 * การมอบหมายอีเวนต์ส่วนกลาง: ปุ่มกลางเมาส์ → เปิด card url ในแท็บใหม่เบื้องหลัง
 * ไม่กระทบพฤติกรรมคลิกซ้ายเดิม
 *
 * รายละเอียด: ใช้ mousedown + e.button===1 + preventDefault()
 *   - ป้องกัน Chrome/Edge เข้าสู่โหมด auto-scroll บน <div>
 *     เมื่อกดปุ่มกลางของเมาส์
 *   - mousedown + preventDefault ป้องกันโหมดเลื่อนอัตโนมัติ
 *
 * กฎ:
 *   - บรรทัดคำอธิบาย → เปิด descUrl
 *   - ปุ่มขยาย → ละเว้นปุ่มกลาง
 *   - การ์ด <a> → ให้เบราว์เซอร์จัดการ ไม่ดักจับ
 *   - การ์ดอื่นๆ → ข้าม comment เปิด card.url โดยตรง
 *   - card.url ไม่มีอยู่หรือเป็น # → ไม่ตอบสนอง
 * ความปลอดภัย: ผ่าน __safeUrl + noopener, noreferrer
 */
document.addEventListener('mousedown', function(e) {
    if (e.button !== 1) return;          // เฉพาะปุ่มกลางของเมาส์
    if (!e.target || !e.target.closest) return;

    // 1. บรรทัดคำอธิบาย → เปิด descUrl
    var descEl = e.target.closest('[data-desc-url]');
    if (descEl) {
        var dUrl = descEl.getAttribute('data-desc-url');
        if (dUrl && dUrl !== '#') {
            e.preventDefault();
            window.open(dUrl, '_blank', 'noopener,noreferrer');
        }
        return;
    }

    // 2. ปุ่มพับหมวดหมู่ → ละเว้นปุ่มกลาง
    //    ปุ่มขยายอยู่ภายใน <a>
    //    ปุ่มกลางจะเปิดแท็บเบื้องหลัง
    if (e.target.closest('.expand-section-btn')) return;

    // 3. ตัวการ์ด → ข้าม comment เปิด url
    var cardEl = e.target.closest('[data-card-id]');
    if (!cardEl) return;
    // การ์ด <a> ให้เบราว์เซอร์จัดการปุ่มกลางตามปกติ
    if (cardEl.tagName === 'A') return;
    var entry = __cardRegistry[cardEl.getAttribute('data-card-id')];
    if (!entry || !entry.card) return;
    var cUrl = __safeUrl(entry.card.url);
    if (!cUrl || cUrl === '#') return;
    e.preventDefault();
    window.open(cUrl, '_blank', 'noopener,noreferrer');
}, true);  // ขั้นตอน capture ให้ความสำคัญก่อน


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 4】ฟังก์ชันเครื่องมือพื้นฐาน
 * ════════════════════════════════════════════════════════════════════════════════ */
function detectLayout() {
    var w = window.innerWidth;
    if (w <= 480) return 'mobile';
    if (w <= 799) return 'tablet';
    return 'desktop';
}

function alignStyleSwitcher() {
    var container = document.querySelector('.container');
    var switcher  = document.getElementById('styleSwitcher');
    if (!container || !switcher) return;
    var rect = container.getBoundingClientRect();
    switcher.style.right = (document.documentElement.clientWidth - rect.right) + 'px';
}

/** การกรองความปลอดภัยของ SVG ป้องกัน XSS */
function sanitizeSVG(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw
        .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
        .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
        .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\bon\w+\s*=\s*[^\s>\/]+/gi, '')
        .replace(/(?:href|xlink:href)\s*=\s*["']\s*javascript:/gi, 'data-removed="javascript-uri"');
}

function renderIcon(item, extraAttrs) {
    extraAttrs = extraAttrs || '';
    if (item.iconImg) {
        var safeImg = __safeImgUrl(item.iconImg);
        if (safeImg) {
            return '<span class="link-icon" ' + extraAttrs + ' aria-hidden="true"><img src="' + __attr(safeImg) + '" alt="" /></span>';
        }
        return '<span class="link-icon" ' + extraAttrs + ' aria-hidden="true"></span>';
    }
    var icon = item.icon || '';
    if (icon.charAt(0) === '<') {
        return '<span class="link-icon link-icon-svg" ' + extraAttrs + '>' + sanitizeSVG(icon) + '</span>';
    }
    return '<span class="link-icon" ' + extraAttrs + '>' + __txt(icon) + '</span>';
}


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 5】ตัวสร้าง HTML สำหรับการ์ด
 * ════════════════════════════════════════════════════════════════════════════════ */

function generateCardHTML(card, meta) {
    var cid = __registerCard(card, meta || {});
    var noteCls = __noteCls(card);
    var pushedBadge = __renderPushedByBadge(card, cid);

    // ─── ประเภทที่ 1: การ์ดแบบเรียบง่าย ──────────────────────────────────────────────
    if (card.type === 'simple') {
        // มี url → ใช้ <a> (รองรับปุ่มกลาง / Ctrl+คลิก เพื่อเปิดในแท็บใหม่)
        // ไม่มี url → ใช้ <div>
        if (card.url) {
            return '<a href="' + __attr(__safeUrl(card.url)) + '" target="_blank" rel="noopener noreferrer" class="link-card' + noteCls + '" ' +
                   'data-card-id="' + cid + '" ' +
                   'onclick="return __favLinkClick(\'' + cid + '\', event)">' +
                pushedBadge +
                renderIcon(card) +
                '<h3 class="link-title">' + __txt(card.title) + '</h3>' +
                '<p class="link-desc">' + __txt(card.desc || '') + '</p></a>';
        }
        return '<div class="link-card' + noteCls + '" data-card-id="' + cid + '" ' +
               'onclick="__favCardOpen(\'' + cid + '\')">' +
            pushedBadge +
            renderIcon(card) +
            '<h3 class="link-title">' + __txt(card.title) + '</h3>' +
            '<p class="link-desc">' + __txt(card.desc || '') + '</p></div>';
    }

    // ─── ประเภทที่ 2: การ์ดที่คำอธิบายคลิกแยกได้ ───────────────────────────────
    if (card.type === 'desc-clickable') {
        // วาง descUrl ในแอตทริบิวต์ data-* จัดการผ่าน event delegation
        var descUrlAttr = card.descUrl ? ' data-desc-url="' + __attr(__safeUrl(card.descUrl)) + '"' : '';
        // ปุ่มกลางเปิดแท็บใหม่เบื้องหลัง
        if (card.url) {
            return '<a href="' + __attr(__safeUrl(card.url)) + '" target="_blank" rel="noopener noreferrer" class="link-card' + noteCls + '" ' +
                   'data-card-id="' + cid + '" ' +
                   'onclick="return __favLinkClick(\'' + cid + '\', event)">' +
                pushedBadge +
                renderIcon(card) +
                '<h3 class="link-title">' + __txt(card.title) + '</h3>' +
                '<p class="link-desc-clickable"' + descUrlAttr + '>' + __txt(card.descClickable) + '</p></a>';
        }
        return '<div class="link-card' + noteCls + '" data-card-id="' + cid + '" ' +
               'onclick="__favCardOpen(\'' + cid + '\')">' +
            pushedBadge +
            renderIcon(card) +
            '<h3 class="link-title">' + __txt(card.title) + '</h3>' +
            '<p class="link-desc-clickable"' + descUrlAttr + '>' + __txt(card.descClickable) + '</p></div>';
    }

    // ─── ประเภทที่ 3: การ์ดที่กางการ์ดย่อยได้ ─────────────────────────────────
    if (card.type === 'expandable') {
        var descHTML = '';
        if (card.descClickable) {
            var descUrlAttr2 = card.descUrl ? ' data-desc-url="' + __attr(__safeUrl(card.descUrl)) + '"' : '';
            descHTML = '<p class="link-desc-clickable"' + descUrlAttr2 + '>' + __txt(card.descClickable) + '</p>';
        } else if (card.desc) {
            descHTML = '<p class="link-desc">' + __txt(card.desc) + '</p>';
        }
        // การ์ดย่อยสืบทอด sectionKey + cardIndex ของการ์ดหลัก
        var subHTML = '';
        (card.subCards || []).forEach(function(sc, idx) {
            subHTML += generateSubCardHTML(sc, {
                sectionKey: (meta && meta.sectionKey) || '',
                cardIndex:  (meta && meta.cardIndex),
                subIndex:   idx,
                encrypted:  (meta && meta.encrypted)
            });
        });

        // ปุ่มกลางเปิดแท็บใหม่เบื้องหลัง
        var subcardsId = __attr(card.id) + '-subcards';
        var expandZone = '<div class="expand-zone" onclick="event.stopPropagation(); event.preventDefault(); handleExpandZone(\'' + subcardsId + '\', this)"></div>' +
                         '<button class="expand-btn" title="ขยายเพิ่มเติม"></button>';
        if (card.url) {
            return '<div class="card-container">' +
                '<a href="' + __attr(__safeUrl(card.url)) + '" target="_blank" rel="noopener noreferrer" ' +
                   'class="link-card link-card-with-expand' + noteCls + '" ' +
                   'data-card-id="' + cid + '" ' +
                   'onclick="handleCardClick(event, \'' + cid + '\', \'' + subcardsId + '\')">' +
                pushedBadge +
                renderIcon(card) +
                '<h3 class="link-title">' + __txt(card.title) + '</h3>' +
                descHTML +
                expandZone + '</a>' +
                '<div class="sub-cards" id="' + subcardsId + '">' + subHTML + '</div></div>';
        }
        return '<div class="card-container">' +
            '<div class="link-card link-card-with-expand' + noteCls + '" ' +
                 'data-card-id="' + cid + '" ' +
                 'onclick="handleCardClick(event, \'' + cid + '\', \'' + subcardsId + '\')">' +
            pushedBadge +
            renderIcon(card) +
            '<h3 class="link-title">' + __txt(card.title) + '</h3>' +
            descHTML +
            expandZone + '</div>' +
            '<div class="sub-cards" id="' + subcardsId + '">' + subHTML + '</div></div>';
    }
    return '';
}

/**
 * สร้างการ์ดย่อย: ใน compact-card ฟิลด์ sc.note คือคำอธิบายขนาดเล็ก
 * ฟังก์ชันหมายเหตุใหม่ใช้ sc.comment ไม่ขัดแย้งกัน
 *
 * ปุ่มกลางเปิดแท็บใหม่เบื้องหลัง
 * ทำงานผ่าน __favLinkClick
 * ไม่มี comment เปิดแท็บใหม่ตามปกติ
 * ไม่มี sc.url ใช้ <div>
 */
function generateSubCardHTML(sc, meta) {
    var cid      = __registerCard(sc, meta || {});
    var iconHTML = renderIcon(sc);
    var noteCls  = __noteCls(sc);
    var hasUrl   = !!__safeUrl(sc.url);

    if (sc.content !== undefined) {
        // compact-card: มี url ใช้ <a> มิฉะนั้นใช้ <div>
        if (hasUrl) {
            return '<a href="' + __attr(__safeUrl(sc.url)) + '" target="_blank" rel="noopener noreferrer" ' +
                   'class="sub-card compact-card' + noteCls + '" data-card-id="' + cid + '" ' +
                   'onclick="return __favLinkClick(\'' + cid + '\', event)">' +
                iconHTML +
                '<div class="link-content"><span class="link-url">' + __txt(sc.content) + '</span>' +
                (sc.note ? '<span class="link-note">' + __txt(sc.note) + '</span>' : '') +
                '</div></a>';
        }
        return '<div class="sub-card compact-card' + noteCls + '" data-card-id="' + cid + '" ' +
               'onclick="__favCardOpen(\'' + cid + '\')">' +
            iconHTML +
            '<div class="link-content"><span class="link-url">' + __txt(sc.content) + '</span>' +
            (sc.note ? '<span class="link-note">' + __txt(sc.note) + '</span>' : '') +
            '</div></div>';
    }
    // two-line-card: มี url ใช้ <a> มิฉะนั้นใช้ <div>
    if (hasUrl) {
        return '<a href="' + __attr(__safeUrl(sc.url)) + '" target="_blank" rel="noopener noreferrer" ' +
               'class="sub-card two-line-card' + noteCls + '" data-card-id="' + cid + '" ' +
               'onclick="return __favLinkClick(\'' + cid + '\', event)">' +
            '<div class="card-header">' + iconHTML +
            '<h3 class="link-title">' + __txt(sc.title) + '</h3></div>' +
            '<p class="link-url">' + __txt(sc.desc || '') + '</p></a>';
    }
    return '<div class="sub-card two-line-card' + noteCls + '" data-card-id="' + cid + '" ' +
           'onclick="__favCardOpen(\'' + cid + '\')">' +
        '<div class="card-header">' + iconHTML +
        '<h3 class="link-title">' + __txt(sc.title) + '</h3></div>' +
        '<p class="link-url">' + __txt(sc.desc || '') + '</p></div>';
}


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 6】ตัวสร้าง Grid
 * ════════════════════════════════════════════════════════════════════════════════ */

function generateStaticGrid(data, sectionKey, encrypted) {
    var html = '<div class="links-grid">';
    data.forEach(function(card, idx) {
        html += generateCardHTML(card, {
            sectionKey: sectionKey || '',
            cardIndex:  idx,
            encrypted:  !!encrypted
        });
    });
    return html + '</div>';
}

function getVisibleCount(prefix, layout) {
    // จับคู่รูปแบบ section key ใหม่
    if (prefix === 'videoData') {
        return layout === 'mobile' ? 4 : layout === 'tablet' ? 6 : 8;
    }
    if (prefix === 'onlineAIData') {
        return layout === 'tablet' ? 3 : 4;
    }
    if (typeof prefix === 'string' && prefix.indexOf('custom_') === 0) {
        return layout === 'mobile' ? 4 : layout === 'tablet' ? 6 : 8;
    }
    return 999;
}

function generateDynamicGrid(prefix, data, layout, encrypted) {
    var count   = getVisibleCount(prefix, layout);
    var visible = data.slice(0, count);
    var hidden  = data.slice(count);

    var html = '<div class="links-grid">';
    visible.forEach(function(card, idx) {
        html += generateCardHTML(card, {
            sectionKey: prefix,
            cardIndex:  idx,
            encrypted:  !!encrypted
        });
    });
    html += '</div>';

    if (hidden.length > 0) {
        html += '<button class="expand-section-btn" data-section-key="' + __attr(prefix) + '" id="' + __attr(prefix) + '-expand-btn">' +
            '<span>ขยายการ์ด</span><span class="arrow">▼</span></button>';
        html += '<div class="hidden-cards" id="' + __attr(prefix) + '-hidden-cards">';
        hidden.forEach(function(card, idx) {
            html += generateCardHTML(card, {
                sectionKey: prefix,
                cardIndex:  count + idx,
                encrypted:  !!encrypted
            });
        });
        html += '</div>';
        html += '<button class="expand-section-btn" data-section-key="' + __attr(prefix) + '" id="' + __attr(prefix) + '-collapse-btn" style="display:none;">' +
            '<span>พับการ์ด</span><span class="arrow">▲</span></button>';
    }
    return html;
}


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 7】การ์ดช่องทางติดต่อ / อีเมล
 * ════════════════════════════════════════════════════════════════════════════════ */

/**
 * กฎเลย์เอาต์แท็บอีเมล (รองรับ 1-10 แท็บ):
 *   1. แท็บที่เลือกอยู่ซ้ายสุด
 *   2. แท็บอื่นเรียงตามลำดับเดิม
 *   3. ทุกแท็บแบ่งความกว้างเท่ากัน
 * คำนวณผลลัพธ์ตรงกับ CSS เดิม
 */
function getEmailTabLayout(cardCount, tabIndex, activeIndex) {
    cardCount = Math.max(1, Number(cardCount) || 1);
    activeIndex = Number(activeIndex);
    if (activeIndex < 0 || activeIndex >= cardCount) activeIndex = 0;

    var order = [activeIndex];
    for (var i = 0; i < cardCount; i++) {
        if (i !== activeIndex) order.push(i);
    }
    var slot = order.indexOf(tabIndex);
    if (slot < 0) slot = tabIndex;

    var width = 100 / cardCount;
    return {
        right: (cardCount - slot - 1) * width,
        width: width,
        zIndex: tabIndex === activeIndex ? cardCount + 10 : cardCount + 9 - slot
    };
}

function getEmailTabStyle(cardCount, tabIndex, activeIndex) {
    var layout = getEmailTabLayout(cardCount, tabIndex, activeIndex);
    return 'right:' + layout.right + '%;width:' + layout.width + '%;z-index:' + layout.zIndex + ';';
}

function layoutEmailTabs(activeIndex) {
    var root = document.getElementById('email-tabs');
    if (!root) return;
    var tabs = root.querySelectorAll('.email-tab');
    var count = tabs.length;
    tabs.forEach(function(tab, tabIndex) {
        var layout = getEmailTabLayout(count, tabIndex, activeIndex);
        tab.style.right = layout.right + '%';
        tab.style.width = layout.width + '%';
        tab.style.zIndex = String(layout.zIndex);
    });
}
function generateEmailCardHTML(cards) {
    cards = cards || [];
    var tabsHTML = '';
    cards.forEach(function(em, i) {
        var cls = i === 0 ? ' active' : '';
        // ป้องกัน default action ของ <a> เมื่อคลิกแท็บ
        tabsHTML += '<div class="email-tab' + cls + '" onclick="event.stopPropagation(); event.preventDefault(); switchEmail(' + i + ')" data-email="' + i + '" style="' + getEmailTabStyle(cards.length, i, 0) + '">' + (i + 1) + '</div>';
    });
    var first = cards[0] || {};
    var noteCls = __noteCls(first);
    // อัปเดต href เมื่อสลับแท็บ
    // หากไม่มี url ใช้ #
    var firstUrl = __safeUrl(first.url) || '#';
    return '<div class="card-container">' +
        '<a href="' + __attr(firstUrl) + '" target="_blank" rel="noopener noreferrer" ' +
           'class="link-card email-card' + noteCls + '" id="email-card-root" ' +
           'onclick="return __favEmailClick(event)">' +
        '<div class="email-main-content" id="email-main-content">' +
        '<div class="email-contact-header">' +
        renderIcon(first, 'id="email-icon"') +
        '<h3 class="link-title" id="email-title">' + __txt(first.title || '') + '</h3>' +
        '</div>' +
        '<p class="email-contact-desc" id="email-address">' + __txt(first.address || '') + '</p>' +
        '</div>' +
        '<div class="email-tabs active-0" id="email-tabs"' + (cards.length <= 1 ? ' style="display:none;"' : '') + '>' + tabsHTML + '</div>' +
        '</a></div>';
}

function generateContactCardHTML(card, meta) {
    var cid = __registerCard(card, meta || {});
    var noteCls = __noteCls(card);
    var descUrlAttr = card.descUrl ? ' data-desc-url="' + __attr(__safeUrl(card.descUrl)) + '"' : '';
    // ปุ่มกลางเปิดแท็บใหม่
    if (card.url) {
        return '<a href="' + __attr(__safeUrl(card.url)) + '" target="_blank" rel="noopener noreferrer" ' +
               'class="link-card contact-card-wrap' + noteCls + '" data-card-id="' + cid + '" ' +
               'onclick="return __favLinkClick(\'' + cid + '\', event)">' +
            '<div class="contact-header">' + renderIcon(card) +
            '<h3 class="link-title">' + __txt(card.title) + '</h3></div>' +
            '<p class="contact-desc"' + descUrlAttr + '>' + __txt(card.desc) + '</p></a>';
    }
    return '<div class="link-card contact-card-wrap' + noteCls + '" data-card-id="' + cid + '" ' +
           'onclick="__favCardOpen(\'' + cid + '\')">' +
        '<div class="contact-header">' + renderIcon(card) +
        '<h3 class="link-title">' + __txt(card.title) + '</h3></div>' +
        '<p class="contact-desc"' + descUrlAttr + '>' + __txt(card.desc) + '</p></div>';
}

function generateContactGrid() {
    var html = '<div class="links-grid contact-row">';
    html += generateEmailCardHTML();
    contactData.forEach(function(card, idx) {
        html += generateContactCardHTML(card, {
            sectionKey: 'contact',
            cardIndex:  idx
        });
    });
    return html + '</div>';
}


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 8】ตรรกะการโต้ตอบของการ์ด
 * ════════════════════════════════════════════════════════════════════════════════ */

/**
 * ส่วนการคลิกของการ์ดที่กางได้:
 *   - ขวา 40% → กาง/พับ
 *   - ซ้าย 60% → เปิดหมายเหตุหรือเปิด url
 */
function handleCardClick(event, cardId, subcardId) {
    // ป้องกันการเปิดลิงก์ทันทีเมื่อคลิกซ้าย
    // ปุ่มกลางเปิดแท็บใหม่ตามปกติ
    if (event && event.preventDefault) event.preventDefault();
    var cardEl = event.currentTarget;
    var rect   = cardEl.getBoundingClientRect();
    var clickX = event.clientX - rect.left;
    if (clickX > rect.width * 3 / 5) {
        var btn = cardEl.querySelector('.expand-btn');
        if (btn) toggleSubCards(subcardId, btn);
    } else {
        __favCardOpen(cardId);
    }
}

function handleExpandZone(subcardId, zone) {
    var btn = zone.closest('.link-card').querySelector('.expand-btn');
    if (btn) toggleSubCards(subcardId, btn);
}

function toggleSubCards(subcardId, button) {
    var subcards      = document.getElementById(subcardId);
    var overlay       = document.getElementById('overlay');
    var cardContainer = button.closest('.card-container');
    var isExpanded    = subcards.classList.contains('expanded');

    if (currentExpanded && currentExpanded !== subcardId) {
        var otherSubcards = document.getElementById(currentExpanded);
        if (otherSubcards) {
            var otherButton    = otherSubcards.parentElement.querySelector('.expand-btn');
            var otherContainer = otherButton.closest('.card-container');
            otherSubcards.classList.remove('expanded');
            otherButton.classList.remove('expanded');
            otherContainer.classList.remove('active');
        }
    }

    if (isExpanded) {
        subcards.classList.remove('expanded');
        button.classList.remove('expanded');
        cardContainer.classList.remove('active');
        overlay.classList.remove('active');
        currentExpanded = null;
    } else {
        subcards.classList.add('expanded');
        button.classList.add('expanded');
        cardContainer.classList.add('active');
        overlay.classList.add('active');
        currentExpanded = subcardId;
    }
}

function toggleSection(prefix) {
    var section     = document.getElementById(prefix + '-hidden-cards');
    var expandBtn   = document.getElementById(prefix + '-expand-btn');
    var collapseBtn = document.getElementById(prefix + '-collapse-btn');
    var isExpanded  = section.classList.contains('expanded');

    if (isExpanded) {
        section.classList.remove('hover-ready');
        section.classList.add('collapsing');
        collapseBtn.classList.add('moving');
        setTimeout(function() {
            section.classList.remove('expanded', 'collapsing');
            collapseBtn.style.display = 'none';
            collapseBtn.classList.remove('moving');
            setTimeout(function() {
                expandBtn.style.display = 'flex';
                expandBtn.classList.remove('moving');
            }, 100);
        }, 600);
    } else {
        expandBtn.classList.add('moving');
        setTimeout(function() {
            expandBtn.style.display = 'none';
            section.classList.add('expanded');
            setTimeout(function() { section.classList.add('hover-ready'); }, 2500);
            setTimeout(function() {
                collapseBtn.style.display = 'flex';
                collapseBtn.classList.remove('moving');
            }, 400);
        }, 200);
    }
}

function autoExpandSection(prefix) {
    var section     = document.getElementById(prefix + '-hidden-cards');
    var expandBtn   = document.getElementById(prefix + '-expand-btn');
    var collapseBtn = document.getElementById(prefix + '-collapse-btn');
    if (!section || !expandBtn) return;
    expandBtn.style.display = 'none';
    section.classList.add('expanded', 'hover-ready');
    if (collapseBtn) collapseBtn.style.display = 'flex';
}


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 9】การสลับแท็บอีเมล
 * ════════════════════════════════════════════════════════════════════════════════ */
// ดึงข้อมูล email จาก sections
function getEmailCards() {
    var emailSec = __allSections.find(function(s) { return s.kind === 'email' && s.visible !== false; });
    return (emailSec && emailSec.cards) ? emailSec.cards : [];
}

function switchEmail(index) {
    var emailCards = getEmailCards();
    if (isAnimating || index >= emailCards.length) return;
    var currentIndex = emailCards.indexOf(currentEmailData);
    if (currentIndex === index) return;

    isAnimating = true;
    var mainContent = document.getElementById('email-main-content');
    mainContent.classList.add('slide-out');

    setTimeout(function() {
        currentEmailData = emailCards[index];

        // อัปเดต href ของ <a> เมื่อสลับแท็บ
        var emailRootA = document.getElementById('email-card-root');
        if (emailRootA && emailRootA.tagName === 'A') {
            var newUrl = __safeUrl(currentEmailData.url) || '#';
            emailRootA.setAttribute('href', newUrl);
        }

        var emailIconEl = document.getElementById('email-icon');
        if (currentEmailData.iconImg) {
            var safeMailImg = __safeImgUrl(currentEmailData.iconImg);
            emailIconEl.innerHTML = safeMailImg
                ? '<img src="' + __attr(safeMailImg) + '" alt="" />'
                : '';
            emailIconEl.className = 'link-icon';
        } else if (currentEmailData.icon && currentEmailData.icon.charAt(0) === '<') {
            emailIconEl.innerHTML = sanitizeSVG(currentEmailData.icon);
            emailIconEl.className = 'link-icon link-icon-svg';
        } else {
            // textContent ทำการ escape แล้ว
            emailIconEl.textContent = currentEmailData.icon || '';
            emailIconEl.className = 'link-icon';
        }

        document.getElementById('email-title').textContent   = currentEmailData.title;
        document.getElementById('email-address').textContent = currentEmailData.address;

        var addressEl = document.getElementById('email-address');
        addressEl.onclick = function(event) {
            event.stopPropagation();
            event.preventDefault();  // ป้องกันการทำงานของ <a>
            if (currentEmailData.mailto) {
                var u = __safeUrl(currentEmailData.mailto);
                if (u && u !== '#') window.open(u, '_blank', 'noopener,noreferrer');
            }
        };

        // ซิงค์สถานะจุดแดงเมื่อสลับ
        var emailRoot = document.getElementById('email-card-root');
        if (emailRoot) {
            if (currentEmailData.comment) emailRoot.classList.add('has-note');
            else                          emailRoot.classList.remove('has-note');
        }

        mainContent.classList.remove('slide-out');
        mainContent.classList.add('slide-in');
        setTimeout(function() {
            mainContent.classList.remove('slide-in');
            mainContent.classList.add('slide-in-active');
            setTimeout(function() {
                mainContent.classList.remove('slide-in-active');
                isAnimating = false;
            }, 400);
        }, 50);
    }, 200);

    document.querySelectorAll('.email-tab').forEach(function(tab, i) {
        if (i === index) tab.classList.add('active');
        else tab.classList.remove('active');
    });
    var emailTabs = document.getElementById('email-tabs');
    if (emailTabs) emailTabs.className = 'email-tabs active-' + index;
    layoutEmailTabs(index);
}

function openEmail(url) {
    var u = __safeUrl(url);
    if (u && u !== '#') window.open(u, '_blank', 'noopener,noreferrer');
}


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 10】API ภายนอก (สำหรับ enc-rerender.js / note-modal.js)
 * ════════════════════════════════════════════════════════════════════════════════ */
window.__favPageAPI = {
    getLayout: function() { return currentLayout; },
    // เรนเดอร์ section เดี่ยวซ้ำ
    renderSection: function(sec, layout) {
        var contentEl = document.getElementById(sec.key + '-content');
        if (!contentEl) return;
        if (window.EncUnlock && EncUnlock.isLocked(sec)) {
            contentEl.innerHTML = '';
            contentEl.appendChild(EncUnlock.makeLockedPlaceholder(sec));
        } else {
            renderOneSection(sec, layout || currentLayout);
        }
    },
    getCardById: function(id) { return __cardRegistry[id] || null; },
    clearExpandedState: function() {
        if (!currentExpanded) return;
        var subs = document.getElementById(currentExpanded);
        if (subs) {
            var btn = subs.parentElement && subs.parentElement.querySelector('.expand-btn');
            var ctn = btn && btn.closest('.card-container');
            subs.classList.remove('expanded');
            if (btn) btn.classList.remove('expanded');
            if (ctn) ctn.classList.remove('active');
        }
        var ol = document.getElementById('overlay');
        if (ol) ol.classList.remove('active');
        currentExpanded = null;
    }
};


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 11】เมนูดรอปดาวน์เปลี่ยนสไตล์มุมขวาบน
 * ════════════════════════════════════════════════════════════════════════════════ */
function toggleStyleMenu(e) {
    e.stopPropagation();
    var menu = document.getElementById('styleMenu');
    var btn  = document.getElementById('styleBtn');
    var isOpen = menu.classList.contains('menu-open');
    if (isOpen) {
        menu.classList.remove('menu-open');
        btn.classList.remove('menu-open');
        btn.setAttribute('aria-expanded', 'false');
    } else {
        menu.classList.add('menu-open');
        btn.classList.add('menu-open');
        btn.setAttribute('aria-expanded', 'true');
    }
}


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 12】เริ่มต้นหน้าเพจ → วนลูป sections เพื่อเรนเดอร์
 * ════════════════════════════════════════════════════════════════════════════════ */

// เรนเดอร์แต่ละ section ตาม kind
function renderOneSection(sec, layout) {
    var contentEl = document.getElementById(sec.key + '-content');
    if (!contentEl) return;

    if (window.EncUnlock && EncUnlock.isLocked(sec)) {
        contentEl.innerHTML = '';
        contentEl.appendChild(EncUnlock.makeLockedPlaceholder(sec));
        return;
    }

    var cards = Array.isArray(sec.cards) ? sec.cards : [];
    if (!cards.length) {
        contentEl.innerHTML = '';
        return;
    }

    if (sec.kind === 'email') {
        // รวมอีเมลและช่องทางติดต่อในแถวเดียวกัน
        if (!currentEmailData) currentEmailData = cards[0];
        var html = '<div class="links-grid contact-row">';
        html += generateEmailCardHTML(cards);
        // นำการ์ดของ contactData มาเรนเดอร์ร่วมด้วย
        var contactSec = __allSections.find(function(s) { return s.key === 'contactData' && s.visible !== false; });
        if (contactSec && Array.isArray(contactSec.cards)) {
            contactSec.cards.forEach(function(card, idx) {
                html += generateContactCardHTML(card, { sectionKey: 'contactData', cardIndex: idx });
            });
        }
        html += '</div>';
        contentEl.innerHTML = html;
    } else if (sec.kind === 'contact') {
        contentEl.innerHTML = '<div class="links-grid contact-row">' +
            cards.map(function(card, idx) {
                return generateContactCardHTML(card, { sectionKey: sec.key, cardIndex: idx });
            }).join('') + '</div>';
    } else {
        // kind === 'card'
        if (sec.dynamic) {
            contentEl.innerHTML = generateDynamicGrid(sec.key, cards, layout, !!sec.encrypted);
            if (layout === 'desktop') autoExpandSection(sec.key);
        } else {
            contentEl.innerHTML = generateStaticGrid(cards, sec.key, !!sec.encrypted);
        }
    }
}

// ลำดับการแสดงผล: card เริ่มต้น → หมวดหมู่กำหนดเอง → email/contact
//   (แยกจากลำดับการส่งออก)
function getDisplayOrderedSections() {
    var builtinCards = __allSections.filter(function(s) { return s.builtin && s.kind === 'card'; });
    var customAll    = __allSections.filter(function(s) { return !s.builtin; });
    var builtinRest  = __allSections.filter(function(s) { return s.builtin && s.kind !== 'card'; });
    return builtinCards.concat(customAll, builtinRest);
}

// เรนเดอร์ sections ที่มองเห็นได้ทั้งหมดไปยัง #sectionsRoot
function renderAllSections(layout) {
    var root = document.getElementById('sectionsRoot');
    if (!root) return;
    root.innerHTML = '';

    getDisplayOrderedSections().forEach(function(sec) {
        if (sec.visible === false) return;
        // contactData รวมอยู่ใน email แล้ว ข้ามส่วนนี้
        if (sec.key === 'contactData') return;
        // ทุกหมวดหมู่ card: ว่างเปล่าให้ซ่อน
        //   emailData และ contactData แสดงเสมอแม้ไม่มีการ์ด
        //   การตัดสินพิเศษสำหรับหมวดหมู่เข้ารหัส:
        //     - ปลดล็อกแล้ว + ว่าง → ซ่อน
        //     - ยังไม่ปลดล็อก → ประเมินจากความยาว ciphertext
        //       ไม่ว่าง → แสดงแคปซูล; ว่างจริง → ซ่อน
        if (sec.kind === 'card') {
            if (window.EncUnlock && sec.encrypted && !sec.__unlocked) {
                // หมวดหมู่เข้ารหัสที่ยังไม่ปลดล็อก: ประเมินจากความยาว ciphertext
                var encEmpty = window.EncUnlock && typeof EncUnlock === 'object'
                    && sec.enc && typeof sec.enc.data === 'string'
                    && sec.enc.data.length <= 36;
                if (encEmpty) return;
            } else if (!sec.cards || sec.cards.length === 0) {
                return;
            }
        }
        var sectionEl = document.createElement('div');
        sectionEl.className = 'section';
        if (sec.builtin === false) sectionEl.dataset.customKey = sec.key;

        if (window.EncUnlock && EncUnlock.isLocked(sec)) {
            sectionEl.classList.add('section-locked-pill');
            sectionEl.innerHTML = '<div id="' + __attr(sec.key) + '-content"></div>';
        } else {
            // id ของ <h2> ใช้ฟิลด์ anchor (เช่น #video)
            //   หากไม่มีใช้ sec.key เพื่อความเข้ากันได้ย้อนหลัง
            //   คอนเทนเนอร์ภายในยังคงใช้ sec.key
            var anchorId = __safeAnchor(sec.anchor) || sec.key;
            sectionEl.innerHTML =
                '<h2 class="section-title" id="' + __attr(anchorId) + '">' + __txt(sec.label || sec.key) + '</h2>' +
                '<div id="' + __attr(sec.key) + '-content"></div>';
        }
        root.appendChild(sectionEl);
        renderOneSection(sec, layout);
    });
}

document.addEventListener('DOMContentLoaded', async function() {

    document.addEventListener('click', function(e) {
        if (!e.target.closest('#styleSwitcher')) {
            var menu = document.getElementById('styleMenu');
            var btn  = document.getElementById('styleBtn');
            if (menu && menu.classList.contains('menu-open')) {
                menu.classList.remove('menu-open');
                btn.classList.remove('menu-open');
                btn.setAttribute('aria-expanded', 'false');
            }
        }
    });

    currentLayout = detectLayout();

    if (window.EncUnlock) {
        try { await EncUnlock.bootstrap(); } catch (e) { console.warn('EncUnlock bootstrap error:', e); }
    }

    // กำหนดค่า currentEmailData สำหรับ email section แรก
    var emailSec = __allSections.find(function(s) { return s.kind === 'email' && s.visible !== false; });
    if (emailSec && emailSec.cards && emailSec.cards.length) currentEmailData = emailSec.cards[0];

    renderAllSections(currentLayout);

    alignStyleSwitcher();
    var containerEl = document.querySelector('.container');
    if (typeof ResizeObserver !== 'undefined' && containerEl) {
        new ResizeObserver(function() { alignStyleSwitcher(); }).observe(containerEl);
    }

    if (window.EncUnlock && EncUnlock.mountLockButton) {
        EncUnlock.mountLockButton();
    }
    // มีหมวดหมู่เข้ารหัสที่ยังไม่ปลดล็อก หรือมี comment → แสดงปุ่มลอย Unlock
    // โหมดสาธารณะและมุมมอง admin ทำงานสอดคล้องกัน
    if (window.EncUnlock && EncUnlock.mountUnlockButton) {
        EncUnlock.mountUnlockButton();
    }

    var ol = document.getElementById('overlay');
    if (ol) {
        ol.addEventListener('click', function() {
            if (currentExpanded) {
                var subcards = document.getElementById(currentExpanded);
                if (subcards) {
                    var button        = subcards.parentElement.querySelector('.expand-btn');
                    var cardContainer = button.closest('.card-container');
                    subcards.classList.remove('expanded');
                    button.classList.remove('expanded');
                    cardContainer.classList.remove('active');
                }
                currentExpanded = null;
            }
            this.classList.remove('active');
        });
    }

    // ลายน้ำระบุผู้ใช้มุมซ้ายล่าง แสดง slug
    // กฎ (v2):
    //   - มี slug ในการตอบสนอง → แสดง
    //   - เข้าสู่ระบบแบบ admin โดยไม่มี slug → ไม่แสดง
    //   - แสดงเฉพาะชื่อ slug โดยไม่มีเครื่องหมาย @
    // แหล่งข้อมูล: window.__viewerInfo
    try {
        var vi = window.__viewerInfo;
        var label = vi && (vi.slug || vi.username);
        if (label) {
            var wm = document.getElementById('__viewerWatermark');
            if (!wm) {
                wm = document.createElement('div');
                wm.id = '__viewerWatermark';
                wm.style.cssText = 'position:fixed;left:14px;bottom:10px;z-index:1;' +
                    'color:rgba(120,120,120,0.5);font-size:11px;line-height:1;font-weight:600;' +
                    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
                    'letter-spacing:0.4px;pointer-events:none;user-select:none;' +
                    'text-shadow:0 0 1px rgba(255,255,255,0.6);';
                document.body.appendChild(wm);
            }
            wm.textContent = label;
        }
        // จัดการการแสดงผลปุ่มร่วมกับ CSS
    } catch (e) {}
});


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 13】การตอบสนองต่อการปรับขนาดหน้าต่าง → เรนเดอร์ซ้ำแบบไดนามิก
 * ════════════════════════════════════════════════════════════════════════════════ */
window.addEventListener('resize', function() {
    var newLayout = detectLayout();
    if (newLayout !== currentLayout) {
        currentLayout = newLayout;

        if (currentExpanded) {
            currentExpanded = null;
            var ol = document.getElementById('overlay');
            if (ol) ol.classList.remove('active');
        }

        // เรนเดอร์ซ้ำเฉพาะ dynamic sections
        __allSections.forEach(function(sec) {
            if (sec.visible === false) return;
            if (sec.kind === 'card' && sec.dynamic) {
                var contentEl = document.getElementById(sec.key + '-content');
                if (contentEl) {
                    contentEl.innerHTML = generateDynamicGrid(sec.key, sec.cards || [], currentLayout, !!sec.encrypted);
                    if (currentLayout === 'desktop') autoExpandSection(sec.key);
                }
            }
        });
    }

    requestAnimationFrame(alignStyleSwitcher);
});


/* ════════════════════════════════════════════════════════════════════════════════
 * 【ส่วนที่ 14】เอฟเฟกต์ระลอกคลื่น (Ripple)
 * ════════════════════════════════════════════════════════════════════════════════ */
(function initRipple() {
    var rippleSelector = [
        '.link-card',
        '.sub-card',
        '.back-link',
        '.expand-section-btn',
        '.style-btn',
        '.style-opt',
        '.email-tab',
        '#backHomeBtn',
        '.error-home-btn',
        '.enc-lock-fab'
    ].join(',');

    function createRipple(e, target) {
        if (target.classList.contains('style-opt-active')) return;

        var rect  = target.getBoundingClientRect();
        var point = e.touches && e.touches[0] ? e.touches[0] : e;
        var x = point.clientX - rect.left;
        var y = point.clientY - rect.top;
        var size = Math.max(rect.width, rect.height) * 2;

        var ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width  = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left   = (x - size / 2) + 'px';
        ripple.style.top    = (y - size / 2) + 'px';

        target.appendChild(ripple);

        setTimeout(function() {
            if (ripple && ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 850);
    }

    var supportsPointer = 'PointerEvent' in window;
    var eventName = supportsPointer ? 'pointerdown' : 'mousedown';

    document.addEventListener(eventName, function(e) {
        var target = e.target.closest(rippleSelector);
        if (!target) return;
        createRipple(e, target);
    }, { passive: true });

    if (!supportsPointer) {
        document.addEventListener('touchstart', function(e) {
            var target = e.target.closest(rippleSelector);
            if (!target) return;
            createRipple(e, target);
        }, { passive: true });
    }
})();

