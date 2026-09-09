/* ================================================================================
 * shared/zip-adapter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ตัวแปลง ZIP (A1-c2)
 *
 * การใช้งาน: รวม (filename, content) เป็น ZIP Blob สำหรับดาวน์โหลด
 * กรณีใช้งาน: เมื่อลบผู้ใช้ รวม full.json + cards.csv เป็น .zip เดียว
 *
 * การออกแบบ: บางเบา รับผิดชอบเฉพาะ
 *   1) โหลด JSZip แบบ lazy (CDN, ~95KB)
 *   2) zipFiles([{ name, content }]) → Promise<Blob>
 *
 * วิธีโหลด (สไตล์เดียวกับ xlsx-adapter):
 *   <script src="shared/zip-adapter.js"></script>
 *   แล้วเรียกผ่าน window.ZipAdapter.*
 *
 * API ภายนอก:
 *   ZipAdapter.isLoaded()                     : JSZip โหลดแล้วหรือไม่
 *   ZipAdapter.loadJSZip() → Promise          : โหลด JSZip แบบ lazy (idempotent)
 *   ZipAdapter.zipFiles(files, opts) → Blob   : files = [{ name, content }];async
 *     content รองรับ string / Uint8Array / ArrayBuffer / Blob
 *     opts: ตัวเลือก { compression: 'STORE' | 'DEFLATE' } (ค่าเริ่มต้น DEFLATE, level 6)
 * ================================================================================ */

(function() {
    'use strict';

    var JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    var _loadPromise = null;

    function isLoaded() {
        return typeof window.JSZip !== 'undefined' && window.JSZip !== null;
    }

    function loadJSZip() {
        if (isLoaded()) return Promise.resolve(window.JSZip);
        if (_loadPromise) return _loadPromise;

        _loadPromise = new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = JSZIP_CDN;
            s.async = true;
            s.onload = function() {
                if (isLoaded()) resolve(window.JSZip);
                else reject(new Error('JSZip loaded but window.JSZip not present'));
            };
            s.onerror = function() {
                _loadPromise = null;
                reject(new Error('Failed to load JSZip from CDN: ' + JSZIP_CDN));
            };
            document.head.appendChild(s);
        });
        return _loadPromise;
    }

    /* ════════════════════════════════════════════════════════════════════════════
     * zipFiles: [{name, content}] → Blob (application/zip)
     * ════════════════════════════════════════════════════════════════════════════ */
    function zipFiles(files, opts) {
        if (!Array.isArray(files) || files.length === 0) {
            return Promise.reject(new Error('zipFiles: files must be a non-empty array'));
        }
        var options = opts || {};
        var compression = options.compression === 'STORE' ? 'STORE' : 'DEFLATE';

        return loadJSZip().then(function(JSZip) {
            var zip = new JSZip();
            for (var i = 0; i < files.length; i++) {
                var f = files[i];
                if (!f || !f.name) continue;
                zip.file(f.name, f.content == null ? '' : f.content);
            }
            return zip.generateAsync({
                type: 'blob',
                mimeType: 'application/zip',
                compression: compression,
                compressionOptions: { level: 6 }
            });
        });
    }

    window.ZipAdapter = {
        isLoaded: isLoaded,
        loadJSZip: loadJSZip,
        zipFiles: zipFiles
    };
})();
