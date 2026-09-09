/* ================================================================================
 * shared/csv-schema.js
 * ─────────────────────────────────────────────────────────────────────────────
 * สคีมาและไลบรารีเครื่องมือนำเข้าและส่งออก CSV (ผลลัพธ์ระยะ B0)
 *
 * การใช้งาน: แปลงไปมาระหว่างอาร์เรย์ sections (จาก data.js หรือ KV) กับข้อความ CSV
 * ระยะ: B0 สร้างเฉพาะไฟล์นี้ ไม่กระทบไฟล์ที่มีอยู่ ไม่เพิ่ม UI
 * ถัดไป: B1 เพิ่มปุ่มส่งออก CSV ใน config.html; B2 เพิ่มนำเข้า CSV; B3 เพิ่มดาวน์โหลดแม่แบบ
 *
 * กฎอ้างอิง: แผนระยะ B0 v2
 *
 * วิธีโหลด (ไม่ใช้ ES module ให้สไตล์ตรงกับ fav-page.js / note-modal.js):
 *   <script src="shared/csv-schema.js"></script>
 *   แล้วเรียกผ่าน window.CsvSchema.*
 *
 * API ภายนอก:
 *   CsvSchema.COLUMNS           : อาร์เรย์ข้อมูลเมทาดาตาคอลัมน์
 *   CsvSchema.sectionsToCSV(sections, opts)
 *   CsvSchema.csvToSections(text, opts)
 *   CsvSchema.downloadTemplate()
 *   CsvSchema.parseRow(row)
 *   CsvSchema.serializeField(v)
 * ================================================================================ */

(function() {
    'use strict';

    /* ════════════════════════════════════════════════════════════════════════════
     * 【1】คำจำกัดความของคอลัมน์
     * ════════════════════════════════════════════════════════════════════════════ */
    var COLUMNS = [
        { col: 'section_key',    required: true,  desc: 'คีย์ของหมวดหมู่ (6 ตัวเลือกเริ่มต้นหรือ custom_*)' },
        { col: 'card_id',        required: false, desc: 'id การ์ดหลัก; ข้อมูลเก่าไม่มี id ให้เว้นว่าง' },
        { col: 'parent_card_id', required: false, desc: 'id ของการ์ดหลักที่เป็นเจ้าของการ์ดย่อย; การ์ดหลักให้เว้นว่าง' },
        { col: 'sub_index',      required: false, desc: 'ลำดับของการ์ดย่อยใน subCards ของการ์ดหลัก (เริ่มจาก 0); การ์ดหลักให้เว้นว่าง' },
        { col: 'type',           required: false, desc: 'simple / desc-clickable / expandable; การ์ดย่อยและการ์ดอีเมลให้เว้นว่าง' },
        { col: 'title',          required: false, desc: 'ชื่อการ์ดหรือการ์ดย่อย; การ์ดย่อย compact-card สามารถใช้ content แทนได้' },
        { col: 'content',        required: false, desc: 'ข้อความบรรทัดเดียวของการ์ดย่อย compact-card (เลือกอย่างใดอย่างหนึ่งระหว่าง title)' },
        { col: 'url',            required: false, desc: 'URL ปลายทางเมื่อคลิก' },
        { col: 'desc',           required: false, desc: 'คำอธิบายข้อความธรรมดา' },
        { col: 'descClickable',  required: false, desc: 'ข้อความคำอธิบายที่คลิกได้; การ์ดย่อยไม่ใช้' },
        { col: 'descUrl',        required: false, desc: 'URL ปลายทางของคำอธิบายที่คลิกได้; การ์ดย่อยไม่ใช้' },
        { col: 'icon',           required: false, desc: 'อิโมจิ หรือ SVG บรรทัดเดียว' },
        { col: 'iconImg',        required: false, desc: 'URL ไอคอนรูปภาพ (มีผลเหนือกว่า icon)' },
        { col: 'isLocal',        required: false, desc: 'true / ว่าง; เมื่อนำเข้าค่าว่าง = false' },
        { col: 'address',        required: false, desc: 'สำหรับการ์ดอีเมล: ที่อยู่อีเมลที่ใช้แสดง (เช่น aabb(AT)cc.cc)' },
        { col: 'mailto',         required: false, desc: 'สำหรับการ์ดอีเมล: ปลายทางการคลิก (อาจเป็น http(s) หรือ mailto:)' },
        { col: 'comment',        required: false, desc: 'หมายเหตุ Markdown (หลายบรรทัด escape ตาม RFC4180)' },
        { col: 'note',           required: false, desc: 'สำหรับการ์ดย่อย ข้อความขนาดเล็กเพิ่มเติมของ compact-card' }
    ];

    var COL_NAMES = COLUMNS.map(function(c) { return c.col; });
    var VALID_TYPES = { 'simple': true, 'desc-clickable': true, 'expandable': true };
    var BOM = '﻿';
    var EOL = '\r\n';

    /* ════════════════════════════════════════════════════════════════════════════
     * 【2】การเข้ารหัส CSV (RFC 4180)
     * ════════════════════════════════════════════════════════════════════════════ */

    function serializeField(v) {
        if (v == null) return '';
        var s = String(v);
        if (s === '') return '';
        if (/[",\r\n]/.test(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    function serializeRow(values) {
        return values.map(serializeField).join(',');
    }

    // แยกวิเคราะห์แถวเดียว (ไม่รวมการขึ้นบรรทัดใหม่) ใช้สำหรับ parseRow API ภายนอก
    function parseLine(line) {
        var out = [];
        var i = 0, len = line.length;
        var field = '', inQuotes = false;
        while (i < len) {
            var ch = line.charAt(i);
            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < len && line.charAt(i + 1) === '"') {
                        field += '"'; i += 2; continue;
                    }
                    inQuotes = false; i++; continue;
                }
                field += ch; i++;
            } else {
                if (ch === ',') { out.push(field); field = ''; i++; continue; }
                if (ch === '"') {
                    if (field === '') { inQuotes = true; i++; continue; }
                    // เมื่อพบ " ตรงกลางให้จัดการเป็นตัวอักษรธรรมดา (แบบยืดหยุ่น)
                    field += ch; i++; continue;
                }
                field += ch; i++;
            }
        }
        out.push(field);
        return out;
    }

    // แยกข้อความ CSV สมบูรณ์ออกเป็นแถว (รองรับการขึ้นบรรทัดใหม่ในเครื่องหมายคำพูด)
    function splitCSVRows(text) {
        var rows = [];
        var i = 0, len = text.length;
        var field = '', row = [], inQuotes = false;
        while (i < len) {
            var ch = text.charAt(i);
            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < len && text.charAt(i + 1) === '"') {
                        field += '"'; i += 2; continue;
                    }
                    inQuotes = false; i++; continue;
                }
                field += ch; i++; continue;
            }
            if (ch === '"') {
                if (field === '') { inQuotes = true; i++; continue; }
                field += ch; i++; continue;
            }
            if (ch === ',') { row.push(field); field = ''; i++; continue; }
            if (ch === '\r') {
                if (i + 1 < len && text.charAt(i + 1) === '\n') i++;
                row.push(field); rows.push(row);
                field = ''; row = []; i++; continue;
            }
            if (ch === '\n') {
                row.push(field); rows.push(row);
                field = ''; row = []; i++; continue;
            }
            field += ch; i++;
        }
        // สิ้นสุด
        if (field !== '' || row.length > 0) {
            row.push(field);
            rows.push(row);
        }
        return rows;
    }

    // จัดเรียงอาร์เรย์แถวให้ตรงกับส่วนหัวตารางเป็นอ็อบเจกต์
    function rowToObj(headers, values) {
        var obj = {};
        for (var i = 0; i < headers.length; i++) {
            obj[headers[i]] = (i < values.length) ? values[i] : '';
        }
        return obj;
    }

    /* ════════════════════════════════════════════════════════════════════════════
     * 【3】parseRow (แถว CSV เดียว → อ็อบเจกต์ ตามลำดับ COLUMNS)
     * ════════════════════════════════════════════════════════════════════════════ */

    function parseRow(row) {
        // รับสตริง (หนึ่งแถว CSV) หรืออาร์เรย์ที่แยกแล้ว
        var values = Array.isArray(row) ? row : parseLine(String(row || ''));
        return rowToObj(COL_NAMES, values);
    }

    /* ════════════════════════════════════════════════════════════════════════════
     * 【4】sectionsToCSV (การส่งออก)
     * ════════════════════════════════════════════════════════════════════════════ */

    function valOrEmpty(v) {
        if (v === undefined || v === null) return '';
        return v;
    }

    function boolToCSV(v) {
        return (v === true || v === 'true' || v === 1 || v === '1') ? 'true' : '';
    }

    function cardToMainRow(sec, card) {
        return [
            sec.key,
            valOrEmpty(card.id),
            '',                                  // parent_card_id
            '',                                  // sub_index
            valOrEmpty(card.type),
            valOrEmpty(card.title),
            '',                                  // content (การ์ดหลักไม่ใช้)
            valOrEmpty(card.url),
            valOrEmpty(card.desc),
            valOrEmpty(card.descClickable),
            valOrEmpty(card.descUrl),
            valOrEmpty(card.icon),
            valOrEmpty(card.iconImg),
            boolToCSV(card.isLocal),
            valOrEmpty(card.address),
            valOrEmpty(card.mailto),
            valOrEmpty(card.comment),
            ''                                   // note (การ์ดหลักไม่ใช้)
        ];
    }

    function subCardToRow(sec, parentId, sc, idx) {
        return [
            sec.key,
            '',                                  // card_id (การ์ดย่อยไม่มี id อิสระ)
            valOrEmpty(parentId),
            String(idx),
            '[sub]',                             // คอลัมน์ type ใช้เครื่องหมาย [sub] สำหรับการ์ดย่อย (จะถูกรับรู้และล้างออกเมื่อนำเข้า)
            valOrEmpty(sc.title),
            valOrEmpty(sc.content),
            valOrEmpty(sc.url),
            valOrEmpty(sc.desc),
            '',                                  // descClickable (การ์ดย่อยไม่ใช้)
            '',                                  // descUrl (การ์ดย่อยไม่ใช้)
            valOrEmpty(sc.icon),
            valOrEmpty(sc.iconImg),
            boolToCSV(sc.isLocal),
            '',                                  // address (การ์ดย่อยไม่ใช้)
            '',                                  // mailto (การ์ดย่อยไม่ใช้)
            valOrEmpty(sc.comment),
            valOrEmpty(sc.note)
        ];
    }

    function sectionsToCSV(sections, opts) {
        opts = opts || {};
        var includeEncrypted = opts.includeEncrypted === true;

        if (!Array.isArray(sections)) {
            throw new Error('sectionsToCSV: sections must be an array');
        }

        var lines = [serializeRow(COL_NAMES)];

        for (var s = 0; s < sections.length; s++) {
            var sec = sections[s];
            if (!sec || !sec.key) continue;

            // จัดการ section ที่เข้ารหัส
            if (sec.encrypted === true) {
                if (!includeEncrypted) continue;
                // ขอให้รวมแล้วแต่เนื้อหายังไม่ได้ปลดล็อก → โยนข้อผิดพลาด
                // เครื่องหมายระบุว่า "ปลดล็อกแล้ว": cards เป็นอาร์เรย์ข้อความธรรมดาแล้ว
                if (!Array.isArray(sec.cards)) {
                    throw new Error('Encrypted section not unlocked: ' + sec.key);
                }
            }

            var cards = Array.isArray(sec.cards) ? sec.cards : [];
            for (var c = 0; c < cards.length; c++) {
                var card = cards[c];
                if (!card) continue;
                lines.push(serializeRow(cardToMainRow(sec, card)));

                if (card.type === 'expandable' && Array.isArray(card.subCards)) {
                    var pid = card.id || '';
                    for (var k = 0; k < card.subCards.length; k++) {
                        var sc = card.subCards[k];
                        if (!sc) continue;
                        lines.push(serializeRow(subCardToRow(sec, pid, sc, k)));
                    }
                }
            }
        }

        return BOM + lines.join(EOL) + EOL;
    }

    /* ════════════════════════════════════════════════════════════════════════════
     * 【5】csvToSections (การนำเข้า มีความทนทานต่อข้อผิดพลาด)
     * ════════════════════════════════════════════════════════════════════════════ */

    function parseBool(v) {
        if (v == null) return false;
        var s = String(v).trim().toLowerCase();
        return s === 'true';   // เฉพาะ true เท่านั้นที่ถือเป็น true ส่วนอื่นๆ ถือเป็น false
    }

    // ลบ BOM ออก
    function stripBOM(text) {
        if (text && text.charCodeAt(0) === 0xFEFF) return text.slice(1);
        return text;
    }

    function csvToSections(text, opts) {
        opts = opts || {};
        var strictRequired = opts.strictRequired !== false; // ค่าเริ่มต้น true

        var errors = [];
        var warnings = [];

        if (text == null || String(text).trim() === '') {
            return { rows: [], errors: errors, warnings: warnings };
        }

        var raw = stripBOM(String(text));
        var grid = splitCSVRows(raw);

        // ตัดแถวว่างท้ายสุดออก
        while (grid.length && grid[grid.length - 1].length === 1 && grid[grid.length - 1][0] === '') {
            grid.pop();
        }

        if (grid.length === 0) {
            return { rows: [], errors: errors, warnings: warnings };
        }

        // ส่วนหัว
        var headers = grid[0].map(function(h) { return String(h || '').trim(); });
        // ตรวจสอบว่ามีคอลัมน์ที่จำเป็นครบถ้วน
        var missingCols = [];
        COLUMNS.forEach(function(c) {
            if (c.required && headers.indexOf(c.col) < 0) {
                missingCols.push(c.col);
            }
        });
        if (missingCols.length) {
            errors.push({ line: 1, col: '', msg: 'Missing required headers: ' + missingCols.join(', ') });
            return { rows: [], errors: errors, warnings: warnings };
        }

        // แปลง grid เป็น rawRows (แต่ละแถวเป็น obj พร้อม _line ระบุหมายเลขบรรทัดแบบ 1-based)
        var rawRows = [];
        for (var i = 1; i < grid.length; i++) {
            var values = grid[i];
            if (values.length === 1 && values[0] === '') continue;
            if (values.every(function(v) { return v === ''; })) continue;
            var obj = rowToObj(headers, values);
            obj._line = i + 1;
            rawRows.push(obj);
        }

        // ส่งต่อให้ validateRows
        return validateRows(rawRows, { strictRequired: strictRequired });
    }

    /* ════════════════════════════════════════════════════════════════════════════
     * 【5b】validateRows (การตรวจสอบอิสระ ใช้ร่วมกับ xlsx-adapter ฯลฯ)
     * นำเข้า: [{ section_key, card_id, ..., _line }] อาร์เรย์อ็อบเจกต์แถวดิบ
     * ผลลัพธ์: { rows, errors, warnings } เหมือนกับ csvToSections
     * ════════════════════════════════════════════════════════════════════════════ */
    function validateRows(rawRows, opts) {
        opts = opts || {};
        var strictRequired = opts.strictRequired !== false; // ค่าเริ่มต้น true

        var errors = [];
        var warnings = [];
        var rows = [];

        if (!Array.isArray(rawRows)) {
            return { rows: rows, errors: errors, warnings: warnings };
        }

        // ตารางตัดฟิลด์ส่วนเกิน (ตาม kind)
        var EXTRA_BY_KIND = {
            sub:     ['descClickable', 'descUrl', 'address', 'mailto'],
            email:   ['descClickable', 'descUrl', 'content', 'note'],
            contact: ['content', 'note', 'address', 'mailto'],
            simple:  ['descClickable', 'descUrl', 'content', 'note', 'address', 'mailto'],
            deskc:   ['content', 'note', 'address', 'mailto'],
            expand:  ['content', 'note', 'address', 'mailto']
        };

        for (var i = 0; i < rawRows.length; i++) {
            var obj = rawRows[i];
            if (!obj || typeof obj !== 'object') continue;
            // ความเข้ากันได้: เมื่อไม่มี _line ให้ใช้ดัชนีอาร์เรย์ +2 (อนุมานเป็นหมายเลขบรรทัดแบบ 1-based โดยข้ามส่วนหัว)
            var lineNo = obj._line || (i + 2);
            obj._line = lineNo;

            // ตรวจสอบฟิลด์ที่จำเป็น
            if (strictRequired) {
                if (!obj.section_key || String(obj.section_key).trim() === '') {
                    errors.push({ line: lineNo, col: 'section_key', msg: 'section_key is required' });
                    continue;
                }
                var hasIdentity = (obj.title && String(obj.title).trim() !== '')
                               || (obj.content && String(obj.content).trim() !== '')
                               || (obj.address && String(obj.address).trim() !== '');
                if (!hasIdentity) {
                    errors.push({ line: lineNo, col: 'title', msg: 'one of title / content / address is required' });
                    continue;
                }
            }

            var isSub = obj.parent_card_id && String(obj.parent_card_id).trim() !== '';
            var secKey = String(obj.section_key).trim();
            var isEmailCard   = (secKey === 'emailData');
            var isContactCard = (secKey === 'contactData');

            if (isSub) {
                var idx = parseInt(obj.sub_index, 10);
                if (isNaN(idx) || idx < 0 || String(idx) !== String(obj.sub_index).trim()) {
                    errors.push({ line: lineNo, col: 'sub_index', msg: 'sub_index must be a non-negative integer for sub-card' });
                    continue;
                }
                obj.sub_index = idx;
                // type ของการ์ดย่อยควรเว้นว่างหรือเป็น [sub]; ค่าอื่นๆ จะแจ้งเตือนและล้างออก
                var subType = obj.type ? String(obj.type).trim() : '';
                if (subType === '[sub]') {
                    obj.type = '';  // สตริงเครื่องหมาย ล้างออกได้โดยไม่มีผลข้างเคียง
                } else if (subType !== '') {
                    warnings.push({ line: lineNo, col: 'type', msg: 'sub-card should leave type empty or use [sub]; value ignored' });
                    obj.type = '';
                }
            } else if (isEmailCard) {
                if (obj.type && String(obj.type).trim() !== '') {
                    warnings.push({ line: lineNo, col: 'type', msg: 'emailData card should leave type empty; value ignored' });
                    obj.type = '';
                }
                if (strictRequired && (!obj.address || String(obj.address).trim() === '')) {
                    errors.push({ line: lineNo, col: 'address', msg: 'address is required for emailData card' });
                    continue;
                }
                if (obj.sub_index && String(obj.sub_index).trim() !== '') {
                    warnings.push({ line: lineNo, col: 'sub_index', msg: 'main card should leave sub_index empty; value ignored' });
                    obj.sub_index = '';
                }
            } else if (isContactCard) {
                if (obj.type && String(obj.type).trim() !== '') {
                    warnings.push({ line: lineNo, col: 'type', msg: 'contactData card should leave type empty; value ignored' });
                    obj.type = '';
                }
                if (obj.sub_index && String(obj.sub_index).trim() !== '') {
                    warnings.push({ line: lineNo, col: 'sub_index', msg: 'main card should leave sub_index empty; value ignored' });
                    obj.sub_index = '';
                }
            } else {
                var t = String(obj.type || '').trim();
                if (strictRequired) {
                    if (!t) {
                        errors.push({ line: lineNo, col: 'type', msg: 'type is required for main card' });
                        continue;
                    }
                    if (!VALID_TYPES[t]) {
                        errors.push({ line: lineNo, col: 'type', msg: 'invalid type: ' + t });
                        continue;
                    }
                }
                obj.type = t;
                if (obj.sub_index && String(obj.sub_index).trim() !== '') {
                    warnings.push({ line: lineNo, col: 'sub_index', msg: 'main card should leave sub_index empty; value ignored' });
                    obj.sub_index = '';
                }
            }

            obj.isLocal = parseBool(obj.isLocal);

            // ตัดฟิลด์ส่วนเกิน
            var kind;
            if (isSub)                                 kind = 'sub';
            else if (isEmailCard)                      kind = 'email';
            else if (isContactCard)                    kind = 'contact';
            else if (obj.type === 'simple')            kind = 'simple';
            else if (obj.type === 'desc-clickable')    kind = 'deskc';
            else if (obj.type === 'expandable')        kind = 'expand';
            else kind = null;

            if (kind && EXTRA_BY_KIND[kind]) {
                EXTRA_BY_KIND[kind].forEach(function(field) {
                    var v = obj[field];
                    if (v != null && String(v).trim() !== '') {
                        warnings.push({
                            line: lineNo,
                            col: field,
                            msg: 'field "' + field + '" is not used by this card kind (' + kind + '); value cleared'
                        });
                        obj[field] = '';
                    }
                });
            }

            rows.push(obj);
        }

        // ตรวจสอบความสอดคล้อง: parent_card_id ต้องตรงกับการ์ดหลักที่มีอยู่
        var mainIds = {};
        rows.forEach(function(r) {
            if (!r.parent_card_id && r.card_id) {
                mainIds[r.section_key + '|' + r.card_id] = true;
            }
        });
        rows.forEach(function(r) {
            if (r.parent_card_id) {
                var k = r.section_key + '|' + r.parent_card_id;
                if (!mainIds[k]) {
                    errors.push({
                        line: r._line,
                        col: 'parent_card_id',
                        msg: 'parent_card_id "' + r.parent_card_id + '" not found in section "' + r.section_key + '"'
                    });
                }
            }
        });

        // ตรวจสอบ card_id ซ้ำ
        var seenIds = {};
        rows.forEach(function(r) {
            if (!r.parent_card_id && r.card_id) {
                var k = r.section_key + '|' + r.card_id;
                if (seenIds[k]) {
                    warnings.push({
                        line: r._line,
                        col: 'card_id',
                        msg: 'duplicate card_id "' + r.card_id + '" in section "' + r.section_key + '"; B2 will keep the last one'
                    });
                }
                seenIds[k] = true;
            }
        });

        // กรองแถวที่มีข้อผิดพลาดออก
        var errLines = {};
        errors.forEach(function(e) { errLines[e.line] = true; });
        rows = rows.filter(function(r) { return !errLines[r._line]; });

        return { rows: rows, errors: errors, warnings: warnings };
    }

    /* ════════════════════════════════════════════════════════════════════════════
     * 【6】downloadTemplate (ดาวน์โหลดแม่แบบ CSV)
     * ════════════════════════════════════════════════════════════════════════════ */

    // สร้างข้อความแม่แบบ CSV (ฟังก์ชันอิสระ ใช้ซ้ำกับ xlsx-adapter)
    function buildTemplateCSV() {
        var header = serializeRow(COL_NAMES);
        // ลำดับคอลัมน์: section_key, card_id, parent_card_id, sub_index, type, title, content,
        //         url, desc, descClickable, descUrl, icon, iconImg, isLocal,
        //         address, mailto, comment, note
        var sample1 = serializeRow([
            'usbDriveData', 'card_sample01', '', '',
            'simple', 'ตัวอย่าง: ไดรฟ์ออนไลน์', '',
            'https://example.com/usb', 'ตัวอย่างคลาวด์ไดรฟ์',
            '', '', '💾', '', '',
            '', '',
            '> นี่คือหมายเหตุ Markdown\nรองรับหลายบรรทัด', ''
        ]);
        var sample_desc = serializeRow([
            'teachingData', 'card_sample_desc', '', '',
            'desc-clickable', 'ตัวอย่าง: การ์ด desc-clickable', '',
            'https://example.com/main',
            '',
            'หัวข้อหลักไป main คำอธิบายไป sub', 'https://example.com/sub',
            '📚', '', '',
            '', '', '', ''
        ]);
        var sample2 = serializeRow([
            'onlineAIData', 'card_sample02', '', '',
            'expandable', 'ตัวอย่าง: รวมเครื่องมือ AI', '',
            'https://example.com/ai', '',
            'เครื่องมือ AI', 'https://example.com/ai',
            '🧠', '', '',
            '', '', '', ''
        ]);
        var sample2sub1 = serializeRow([
            'onlineAIData', '', 'card_sample02', '0',
            '[sub]', 'DeepSeek', '',
            'https://www.deepseek.com/', 'DeepSeek ผู้ช่วย AI',
            '', '', '🤿', '', '',
            '', '', '', ''
        ]);
        var sample2sub2 = serializeRow([
            'onlineAIData', '', 'card_sample02', '1',
            '[sub]', '', 'ลิงก์ตัวอย่างการ์ดย่อยขนาดกะทัดรัด',
            'https://example.com/compact', '',
            '', '', '🔗', '', '',
            '', '', '', 'ข้อความเล็กของการ์ดกะทัดรัด'
        ]);
        var sample3 = serializeRow([
            'emailData', 'card_sample03', '', '',
            '', 'อีเมลตัวอย่าง', '',
            'http://example.com', '',
            '', '', '✉️', '', '',
            'example(AT)example.com', 'mailto:example@example.com',
            '', ''
        ]);
        var sample4 = serializeRow([
            'contactData', 'card_sample04', '', '',
            '', 'ช่องทางติดต่อตัวอย่าง (GitHub)', '',
            'https://github.com/yumumao',
            'หน้าโปรไฟล์ GitHub',
            '', '',
            '🐙', '', '',
            '', '', '', ''
        ]);

        return BOM + [header, sample1, sample_desc, sample2, sample2sub1, sample2sub2, sample3, sample4].join(EOL) + EOL;
    }

    function downloadTemplate() {
        var content = buildTemplateCSV();
        var blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'smarttools_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }

    /* ════════════════════════════════════════════════════════════════════════════
     * 【7】ส่งออก API สู่ภายนอก
     * ════════════════════════════════════════════════════════════════════════════ */
    window.CsvSchema = {
        COLUMNS:         COLUMNS,
        sectionsToCSV:   sectionsToCSV,
        csvToSections:   csvToSections,
        validateRows:    validateRows,
        downloadTemplate: downloadTemplate,
        buildTemplateCSV: buildTemplateCSV,
        parseRow:        parseRow,
        serializeField:  serializeField
    };
})();
