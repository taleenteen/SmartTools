/* ================================================================================
 * shared/xlsx-adapter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ตัวแปลง XLSX (B0)
 *
 * การใช้งาน: แปลง sections ↔ ไบนารี XLSX โดยใช้ CsvSchema ซ้ำ
 * การออกแบบ: บางเบา ส่งต่อการตรวจสอบให้ csv-schema.js โดยไฟล์นี้รับผิดชอบเฉพาะ:
 *   1) โหลด SheetJS แบบ lazy (CDN, 340KB)
 *   2) sectionsToXlsx(sections, opts)：sections → CSV(via CsvSchema) → workbook → Blob
 *   3) xlsxToRows(arrayBuffer)：xlsx → sheet → rows → CsvSchema.validateRows
 *
 * สิ่งที่ต้องใช้: ต้องโหลด shared/csv-schema.js ก่อน
 *
 * วิธีโหลด (สไตล์เดียวกับ csv-schema):
 *   <script src="shared/csv-schema.js"></script>
 *   <script src="shared/xlsx-adapter.js"></script>
 *   แล้วเรียกผ่าน window.XlsxAdapter.*
 *
 * API ภายนอก:
 *   XlsxAdapter.isLoaded()                    : SheetJS โหลดแล้วหรือไม่
 *   XlsxAdapter.loadSheetJS() → Promise       : โหลด SheetJS แบบ lazy (idempotent)
 *   XlsxAdapter.sectionsToXlsx(sections,opts) : คืนค่า Blob (async)
 *   XlsxAdapter.xlsxToRows(arrayBuffer)       : คืนค่า { rows,errors,warnings } (async)
 * ================================================================================ */

(function() {
    'use strict';

    var SHEETJS_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.mini.min.js';
    var _loadPromise = null;

    function isLoaded() {
        return typeof window.XLSX !== 'undefined' && window.XLSX !== null;
    }

    function loadSheetJS() {
        if (isLoaded()) return Promise.resolve(window.XLSX);
        if (_loadPromise) return _loadPromise;

        _loadPromise = new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = SHEETJS_CDN;
            s.async = true;
            s.onload = function() {
                if (isLoaded()) resolve(window.XLSX);
                else reject(new Error('SheetJS loaded but window.XLSX not present'));
            };
            s.onerror = function() {
                _loadPromise = null;
                reject(new Error('Failed to load SheetJS from CDN: ' + SHEETJS_CDN));
            };
            document.head.appendChild(s);
        });
        return _loadPromise;
    }

    /* ════════════════════════════════════════════════════════════════════════════
     * sectionsToXlsx: sections → Blob (xlsx)
     * กลยุทธ์: ใช้ CsvSchema.sectionsToCSV ซ้ำ → แปลงกลับเป็น grid → workbook → blob
     *      เพื่อให้การจับคู่คอลัมน์/การ์ด → row มีเพียงที่เดียวใน csv-schema
     * ════════════════════════════════════════════════════════════════════════════ */
    function sectionsToXlsx(sections, opts) {
        if (!window.CsvSchema || typeof window.CsvSchema.sectionsToCSV !== 'function') {
            return Promise.reject(new Error('CsvSchema not loaded'));
        }
        return loadSheetJS().then(function(XLSX) {
            // CSV (รวม BOM, CRLF) — SheetJS รองรับสมบูรณ์
            var csv = window.CsvSchema.sectionsToCSV(sections, opts || {});
            // สำคัญ: ลบ UTF-8 BOM ออก มิฉะนั้นจะเป็นส่วนหนึ่งของเซลล์ A1
            if (csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1);
            var wb = XLSX.read(csv, { type: 'string', raw: true });
            // SheetJS ตั้งชื่อเริ่มต้นว่า Sheet1 เปลี่ยนเป็นชื่อที่เหมาะสมกว่า
            var sheetName = 'SmartTools';
            if (wb.SheetNames.length) {
                wb.Sheets[sheetName] = wb.Sheets[wb.SheetNames[0]];
                delete wb.Sheets[wb.SheetNames[0]];
                wb.SheetNames = [sheetName];
            }
            var arrayBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            return new Blob([arrayBuf], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
        });
    }

    /* ════════════════════════════════════════════════════════════════════════════
     * xlsxToRows: ArrayBuffer → { rows, errors, warnings }
     * ขั้นตอน: xlsx → workbook → sheet แรก → อาร์เรย์ 2 มิติ (aoa) → rawRows → validateRows
     * ════════════════════════════════════════════════════════════════════════════ */
    function xlsxToRows(arrayBuffer, opts) {
        if (!window.CsvSchema || typeof window.CsvSchema.validateRows !== 'function') {
            return Promise.reject(new Error('CsvSchema.validateRows not available'));
        }
        return loadSheetJS().then(function(XLSX) {
            var wb;
            try { wb = XLSX.read(arrayBuffer, { type: 'array' }); }
            catch (e) { throw new Error('XLSX parse failed: ' + (e.message || e)); }

            if (!wb.SheetNames.length) {
                return { rows: [], errors: [{ line: 0, col: '', msg: 'XLSX has no sheets' }], warnings: [] };
            }

            // นำ sheet แรกมาใช้ (ผู้ใช้อาจเปลี่ยนชื่อ ไม่บังคับว่าต้องเป็น SmartTools)
            var sheet = wb.Sheets[wb.SheetNames[0]];
            // แปลงเป็นอาร์เรย์ 2 มิติ: header:1 คือแถวแรกเป็นฟิลด์; defval:'' ให้ช่องว่างเป็นสตริงว่าง
            var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

            // ตัดแถวว่างท้ายสุดออก
            while (aoa.length && aoa[aoa.length - 1].every(function(v) { return v === '' || v == null; })) {
                aoa.pop();
            }
            if (!aoa.length) {
                return { rows: [], errors: [], warnings: [] };
            }

            var headers = aoa[0].map(function(h) { return String(h == null ? '' : h).trim(); });

            // ตรวจสอบส่วนหัว
            var COLUMNS = window.CsvSchema.COLUMNS;
            var missing = [];
            COLUMNS.forEach(function(c) {
                if (c.required && headers.indexOf(c.col) < 0) missing.push(c.col);
            });
            if (missing.length) {
                return {
                    rows: [],
                    errors: [{ line: 1, col: '', msg: 'Missing required headers: ' + missing.join(', ') }],
                    warnings: []
                };
            }

            // แปลงเป็น rawRows
            var rawRows = [];
            for (var i = 1; i < aoa.length; i++) {
                var values = aoa[i];
                if (values.every(function(v) { return v === '' || v == null; })) continue;
                var obj = {};
                for (var j = 0; j < headers.length; j++) {
                    var h = headers[j];
                    if (!h) continue;
                    var v = j < values.length ? values[j] : '';
                    obj[h] = (v == null) ? '' : String(v);
                }
                obj._line = i + 1; // 1-based, แถวที่ 1 คือส่วนหัว
                rawRows.push(obj);
            }

            return window.CsvSchema.validateRows(rawRows, opts || {});
        });
    }

    /* ════════════════════════════════════════════════════════════════════════════
     * templateToXlsx: แปลง CsvSchema.buildTemplateCSV() เป็น Xlsx Blob
     * ไฟล์แม่แบบ ไม่ต้องใช้ข้อมูล sections
     * ════════════════════════════════════════════════════════════════════════════ */
    function templateToXlsx() {
        if (!window.CsvSchema || typeof window.CsvSchema.buildTemplateCSV !== 'function') {
            return Promise.reject(new Error('CsvSchema.buildTemplateCSV not available'));
        }
        return loadSheetJS().then(function(XLSX) {
            var csv = window.CsvSchema.buildTemplateCSV();
            if (csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1); // ลบ BOM เช่นเดียวกับ sectionsToXlsx
            var wb = XLSX.read(csv, { type: 'string', raw: true });
            var sheetName = 'SmartTools-Template';
            if (wb.SheetNames.length) {
                wb.Sheets[sheetName] = wb.Sheets[wb.SheetNames[0]];
                delete wb.Sheets[wb.SheetNames[0]];
                wb.SheetNames = [sheetName];
            }
            var arrayBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            return new Blob([arrayBuf], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
        });
    }

    window.XlsxAdapter = {
        isLoaded:        isLoaded,
        loadSheetJS:     loadSheetJS,
        sectionsToXlsx:  sectionsToXlsx,
        xlsxToRows:      xlsxToRows,
        templateToXlsx:  templateToXlsx
    };
})();
