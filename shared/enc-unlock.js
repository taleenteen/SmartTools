/* ============================================================
   EncUnlock —— โมดูลปลดล็อกหมวดหมู่เข้ารหัสฝั่งหน้าบ้าน (เวอร์ชันแคปซูล + ล็อกทันที + แสดงทีละรายการ)
   ============================================================ */
(function (global) {
    'use strict';

    const SS_KEY = 'bm_cfg_enc_pwd';
    const SS_REVEAL = 'bm_cfg_enc_reveal';

    // ★ ดึง sections ที่เข้ารหัสทั้งหมด (รองรับรูปแบบข้อมูลทั้งเก่าและใหม่)
    function getEncSections() {
        var all = global.__sections || global.sections;
        if (Array.isArray(all)) return all.filter(function(s) { return s && s.encrypted; });
        // fallback รูปแบบเดิม
        if (Array.isArray(global.customSections)) return global.customSections.filter(function(c) { return c && c.encrypted; });
        return [];
    }

    // -------- Base64 / AES-GCM / PBKDF2 --------
    function b64d(s) { const a = atob(s), u = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) u[i] = a.charCodeAt(i); return u; }
    async function deriveKey(pwd, salt, iter) {
        const base = await crypto.subtle.importKey('raw',
            new TextEncoder().encode(pwd), { name: 'PBKDF2' }, false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
            base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    }
    async function decryptEnc(pwd, enc) {
        const key = await deriveKey(pwd, b64d(enc.salt), enc.iter || 300000);
        const pt = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: b64d(enc.iv) }, key, b64d(enc.data));
        return JSON.parse(new TextDecoder().decode(pt));
    }

    // -------- เซ็ต "แสดงแล้ว" (ระดับ session) --------
    function sectionKey(section) {
        return (section && (section.id || section.key || section.name)) || '';
    }
    function getRevealSet() {
        try {
            const raw = sessionStorage.getItem(SS_REVEAL);
            return new Set(raw ? JSON.parse(raw) : []);
        } catch { return new Set(); }
    }
    function saveRevealSet(set) {
        try { sessionStorage.setItem(SS_REVEAL, JSON.stringify([...set])); } catch {}
    }
    function markRevealed(section) {
        const k = sectionKey(section);
        if (!k) return;
        const s = getRevealSet(); s.add(k); saveRevealSet(s);
    }
    function isRevealed(section) {
        return getRevealSet().has(sectionKey(section));
    }
    function clearReveal() {
        try { sessionStorage.removeItem(SS_REVEAL); } catch {}
    }

    // -------- ทริกเกอร์การเรนเดอร์ซ้ำ (ไม่รีเฟรชถ้าเป็นไปได้) --------
    function triggerRerender() {
        if (typeof window.rerenderCustomSections === 'function') {
            window.rerenderCustomSections();
        } else {
            location.reload();
        }
    }

    // -------- พยายาม Unlock หมวดหมู่ที่เข้ารหัสทั้งหมด --------
    async function unlockAll(pwd) {
        var encSections = getEncSections();
        // 2026-05-24: แม้ไม่มีหมวดหมู่เข้ารหัส ก็ยอมรับรหัสผ่านและเก็บลง sessionStorage
        //   กรณี: ผู้ใช้ไม่ได้สร้างหมวดหมู่เข้ารหัส แต่การ์ดมี comment ที่ต้องแก้ไข
        if (!encSections.length) {
            try { sessionStorage.setItem(SS_KEY, pwd); } catch {}
            return { ok: true, n: 0, total: 0 };
        }
        let unlocked = 0, total = 0, anyOk = false;
        for (const c of encSections) {
            if (!c || !c.enc) continue;
            total++;
            try {
                const cards = await decryptEnc(pwd, c.enc);
                c.cards = Array.isArray(cards) ? cards : [];
                c.__unlocked = true;
                delete c.__lockedReason;
                unlocked++; anyOk = true;
            } catch (e) {
                c.__unlocked = false;
                c.__lockedReason = 'wrong-password';
            }
        }
        if (anyOk) { try { sessionStorage.setItem(SS_KEY, pwd); } catch {} }
        return { ok: anyOk || total === 0, n: unlocked, total };
    }

    // -------- โอเวอร์เลย์แจ้งสถานะ "กำลังถอดรหัส..." แบบเต็มหน้าจอ --------
    function showDecryptingOverlay() {
        if (document.getElementById('enc-decrypt-overlay')) return;
        const ov = document.createElement('div');
        ov.id = 'enc-decrypt-overlay';
        ov.className = 'enc-decrypt-overlay';
        ov.innerHTML = `
            <div class="enc-decrypt-card">
                <span class="enc-spinner"></span>
                <span class="enc-decrypt-text">กำลังถอดรหัส...</span>
            </div>`;
        document.body.appendChild(ov);
    }
    function hideDecryptingOverlay() {
        const ov = document.getElementById('enc-decrypt-overlay');
        if (ov) ov.remove();
    }

    // -------- พยายามอัตโนมัติเมื่อเริ่มต้น --------
    async function bootstrap() {
        var encSections = getEncSections();
        for (const c of encSections) {
            if (c && c.enc) {
                c.__unlocked = false;
                c.cards = [];
            }
        }
        let pwd = null;
        try { pwd = sessionStorage.getItem(SS_KEY); } catch {}
        if (pwd && encSections.some(c => c && c.enc)) {
            showDecryptingOverlay();
            try { await unlockAll(pwd); }
            finally { hideDecryptingOverlay(); }
        }
        return {
            total: encSections.length,
            lockedAfter: encSections.filter(c => c && !c.__unlocked).length
        };
    }

    // -------- Modal Unlock --------
    function openUnlockModal(onDone) {
        const existed = document.querySelector('.enc-mask');
        if (existed) existed.remove();

        const mask = document.createElement('div');
        mask.className = 'enc-mask';
        mask.innerHTML = `
            <div class="enc-box">
                <h3>🔓 Unlock เนื้อหาที่เข้ารหัส</h3>
                <p>โปรดกรอก <b>รหัสผ่านเข้าสู่ระบบ</b> เพื่อ Unlock รหัสผ่านจะถูกบันทึกชั่วคราวในแท็บนี้เท่านั้น</p>
                <input type="password" id="__enc_pwd" autocomplete="current-password" placeholder="รหัสผ่านเข้าสู่ระบบ">
                <div class="enc-err" id="__enc_err"></div>
                <div class="enc-actions">
                    <button class="btn-cancel" id="__enc_cancel">ยกเลิก</button>
                    <button class="btn-ok" id="__enc_ok">Unlock</button>
                </div>
            </div>`;
        document.body.appendChild(mask);

        const input = mask.querySelector('#__enc_pwd');
        const errEl = mask.querySelector('#__enc_err');
        setTimeout(() => input.focus(), 30);

        async function confirm() {
            const pwd = input.value;
            if (!pwd) { errEl.textContent = 'โปรดกรอกรหัสผ่าน'; return; }
            errEl.innerHTML = '<span class="enc-spinner"></span> กำลังถอดรหัส...';
            input.disabled = true;
            mask.querySelector('#__enc_ok').disabled = true;
            mask.querySelector('#__enc_cancel').disabled = true;
            const r = await unlockAll(pwd);
            input.disabled = false;
            mask.querySelector('#__enc_ok').disabled = false;
            mask.querySelector('#__enc_cancel').disabled = false;
            if (r.ok && r.n > 0) {
                mask.remove();
                if (typeof onDone === 'function') onDone(r);
            } else {
                errEl.textContent = '❌ รหัสผ่านไม่ถูกต้อง';
                input.select();
            }
        }
        mask.querySelector('#__enc_ok').onclick = confirm;
        mask.querySelector('#__enc_cancel').onclick = () => mask.remove();
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') confirm();
            else if (e.key === 'Escape') mask.remove();
        });
    }

    // -------- ส่วนแสดงแทนแบบแคปซูล --------
    function makeLockedPlaceholder(section) {
        const wrap = document.createElement('div');
        wrap.className = 'enc-locked-pill-wrap';

        // ลำดับ: ตำแหน่งในหมวดหมู่เข้ารหัสทั้งหมด (แสดงเมื่อ > 1)
        let ordinal = '';
        var encList = getEncSections();
        if (encList.length) {
            if (encList.length > 1) {
                const idx = encList.indexOf(section);
                if (idx >= 0) ordinal = String(idx + 1);
            }
        }

        // สองสถานะ: ถอดรหัสแล้วแต่ยังไม่กาง / ยังไม่ได้ถอดรหัส
        const decrypted = !!section.__unlocked;
        const iconChar  = decrypted ? '🔓' : '🔒';
        const labelText = decrypted ? '_คลิกเพื่อแสดง__' : ' (Unlock เพื่อดู)';
        const title     = decrypted ? 'ถอดรหัสแล้ว คลิกเพื่อกางเนื้อหา' : 'คลิกเพื่อกรอกรหัสผ่าน Unlock';

        wrap.innerHTML = `
            <button type="button" class="enc-locked-pill" title="${title}">
                <span class="lk-icon">${iconChar}</span>
                <span class="lk-text">${labelText}${ordinal}</span>
            </button>`;

        wrap.querySelector('.enc-locked-pill').onclick = () => {
            if (section.__unlocked) {
                // ถอดรหัสแล้ว → ทำเครื่องหมายกางเฉพาะรายการนี้
                markRevealed(section);
                triggerRerender();
            } else {
                openUnlockModal(() => {
                    // กางเฉพาะรายการที่ทริกเกอร์การ Unlock ครั้งนี้ ส่วนที่เหลือยังคงพับไว้
                    if (section.__unlocked) markRevealed(section);
                    triggerRerender();
                });
            }
        };
        return wrap;
    }

    // ============================================================
    // ล็อกทันที
    // ============================================================

    // มีหมวดหมู่เข้ารหัสที่ปลดล็อกแล้วหรือไม่
    function hasUnlockedEncrypted() {
        var encSections = getEncSections();
        return encSections.some(c => c && c.__unlocked);
    }

    // 2026-05-24: อยู่ในสถานะ Unlock หรือไม่ (มีรหัสผ่านใน sessionStorage)
    function isUnlocked() {
        try { return !!sessionStorage.getItem(SS_KEY); } catch { return false; }
    }

    // 2026-05-24: การ์ดใดๆ มี comment หรือไม่ (สำหรับแสดงปุ่ม Unlock เพื่อแก้ไขหมายเหตุ)
    //   การ์ดในหมวดหมู่เข้ารหัสเมื่อปลดล็อกแล้วจะเป็นข้อความธรรมดา
    function hasAnyComment() {
        var all = global.__sections || global.sections;
        if (!Array.isArray(all)) all = Array.isArray(global.customSections) ? global.customSections : [];
        for (var i = 0; i < all.length; i++) {
            var sec = all[i];
            if (!sec || !Array.isArray(sec.cards)) continue;
            for (var j = 0; j < sec.cards.length; j++) {
                var c = sec.cards[j];
                if (c && c.comment) return true;
                if (c && Array.isArray(c.subCards)) {
                    for (var k = 0; k < c.subCards.length; k++) {
                        if (c.subCards[k] && c.subCards[k].comment) return true;
                    }
                }
            }
        }
        return false;
    }

    // 2026-05-24: หมวดหมู่เข้ารหัสว่างเปล่าจริงหรือไม่
    //   ปลดล็อกแล้ว: ดู cards.length
    //   ยังไม่ปลดล็อก: ดูความยาว base64 ของ ciphertext
    //   ใช้เกณฑ์ 36 เป็นการตัดสินแบบอนุรักษ์นิยม
    function isEncryptedSectionEmpty(sec) {
        if (!sec || !sec.encrypted) return true;
        if (sec.__unlocked) return !sec.cards || sec.cards.length === 0;
        if (sec.enc && typeof sec.enc.data === 'string') {
            return sec.enc.data.length <= 36;
        }
        return false; // ไม่มีฟิลด์ enc → ข้อมูลผิดปกติ แสดงแบบอนุรักษ์นิยม
    }

    // 2026-05-24: จำเป็นต้องมีปุ่ม Unlock หรือไม่
    //   กฎ: มีหมวดหมู่เข้ารหัสที่ไม่ว่างเปล่า ← ต้อง Unlock เพื่อดูเนื้อหา
    //        หรือการ์ดใดๆ มี comment ← ต้อง Unlock เพื่อแก้ไขหมายเหตุ
    //   ถ้าไม่มีทั้งคู่ก็ไม่ต้องแสดง
    function shouldShowUnlockButton() {
        if (isUnlocked()) return false;
        var encSections = getEncSections();
        for (var i = 0; i < encSections.length; i++) {
            if (!isEncryptedSectionEmpty(encSections[i])) return true;
        }
        return hasAnyComment();
    }

    function lockNow() {
        try { sessionStorage.removeItem(SS_KEY); } catch {}
        clearReveal();
        getEncSections().forEach(c => {
            if (c) {
                c.cards = [];
                c.__unlocked = false;
            }
        });
        triggerRerender();
        // ถอนการติดตั้งตัวเองทันที: ไม่มีหมวดหมู่เข้ารหัสที่ปลดล็อกแล้ว
        const fab = document.getElementById('enc-lock-fab');
        if (fab) fab.remove();
        // 2026-05-24: หลังล็อกหากยังมี comment หรือหมวดหมู่เข้ารหัส ให้ติดตั้งปุ่ม Unlock ใหม่
        try { mountUnlockButton(); } catch (e) {}
    }

    let _escBound = false;
    function mountLockButton() {
        const existing = document.getElementById('enc-lock-fab');

        // ไม่จำเป็นต้องแสดงปุ่มอีกต่อไป → ลบออกหากมีอยู่
        if (!hasUnlockedEncrypted()) {
            if (existing) existing.remove();
            return;
        }

        // จำเป็นต้องแสดงแต่มีอยู่แล้ว → ไม่ต้องสร้างซ้ำ
        if (existing) return;

        // 2026-05-24: ปุ่ม Unlock กับปุ่มล็อกแยกกันทำงาน
        const unlockFab = document.getElementById('enc-unlock-fab');
        if (unlockFab) unlockFab.remove();

        const btn = document.createElement('button');
        btn.id = 'enc-lock-fab';
        btn.className = 'enc-lock-fab';
        btn.type = 'button';
        btn.title = 'ล็อกเนื้อหาส่วนตัวทันที (คีย์ลัด: Esc)';
        btn.setAttribute('aria-label', 'ล็อกเนื้อหาส่วนตัวทันที');
        btn.innerHTML = `
            <span class="lf-icon" aria-hidden="true">🔒</span>
            <span class="lf-text">ล็อก</span>`;
        btn.addEventListener('click', lockNow);
        document.body.appendChild(btn);

        if (!_escBound) {
            _escBound = true;
            document.addEventListener('keydown', function (e) {
                if (e.key !== 'Escape') return;
                if (document.querySelector('.enc-mask')) return;
                if (document.getElementById('enc-lock-fab')) lockNow();
            });
        }
    }

    // 2026-05-24: ปุ่มลอย Unlock (เมื่อมีหมวดหมู่เข้ารหัสที่ยังไม่ปลดล็อก หรือมี comment ต้องแก้ไข)
    function mountUnlockButton() {
        const existing = document.getElementById('enc-unlock-fab');
        if (!shouldShowUnlockButton()) {
            if (existing) existing.remove();
            return;
        }
        if (existing) return;
        // แยกกันทำงานกับปุ่มล็อก
        const lockFab = document.getElementById('enc-lock-fab');
        if (lockFab) return;

        const btn = document.createElement('button');
        btn.id = 'enc-unlock-fab';
        btn.className = 'enc-lock-fab enc-unlock-fab';  // ใช้สไตล์ร่วมกัน เพิ่ม enc-unlock-fab สำหรับแยกแยะ
        btn.type = 'button';
        btn.title = 'Unlock เพื่อแก้ไขหมายเหตุ / เนื้อหาหมวดหมู่ที่เข้ารหัส';
        btn.setAttribute('aria-label', 'Unlock');
        btn.innerHTML = `
            <span class="lf-icon" aria-hidden="true">🔓</span>
            <span class="lf-text">Unlock</span>`;
        btn.addEventListener('click', function () {
            openUnlockModal(function () {
                // 2026-05-24: เมื่อ Unlock สำเร็จ กางหมวดหมู่ที่เข้ารหัสทั้งหมดทันที
                getEncSections().forEach(function (s) { if (s && s.__unlocked) markRevealed(s); });
                // สลับเป็นปุ่มล็อก
                const fab = document.getElementById('enc-unlock-fab');
                if (fab) fab.remove();
                mountLockButton();
                triggerRerender();
            });
        });
        document.body.appendChild(btn);
    }

    global.EncUnlock = {
        bootstrap,
        unlockAll,
        openUnlockModal,
        makeLockedPlaceholder,
        mountLockButton,
        mountUnlockButton,   // 2026-05-24: ปุ่มลอย Unlock
        lockNow,
        hasUnlockedEncrypted,
        // ★ เกณฑ์การตัดสิน: เรนเดอร์แคปซูลหรือไม่ (= ยังไม่ถอดรหัส หรือถอดรหัสแล้วแต่ยังไม่กาง)
        isLocked(section) {
            if (!section || !section.encrypted) return false;
            if (!section.__unlocked) return true;
            if (!isRevealed(section)) return true;
            return false;
        },
        clearPassword() {
            try { sessionStorage.removeItem(SS_KEY); } catch {}
            clearReveal();
        }
    };
})(window);