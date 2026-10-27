// ============================================================
// 🎨 HINDI PHONETIC — Add Word Modal + Virtual Keyboard (v1.1 FIXED)
// Merged from LipiCraft Studio Pro into Hoṛ Katha Suite
// Depends on: hindi-phonetic.js (HindiPhonetic global)
// ============================================================

'use strict';

// ── Virtual Keyboard Data ──
const HP_KBD_DATA = {
    vowels: ['अ','आ','इ','ई','उ','ऊ','ऋ','ॠ','ऌ','ए','ऐ','ओ','औ','अं','अः','ऑ','ऍ','ऎ','ऒ'],
    consonants: ['क','ख','ग','घ','ङ','च','छ','ज','झ','ञ','ट','ठ','ड','ढ','ण','त','थ','द','ध','न','प','फ','ब','भ','म','य','र','ल','व','श','ष','स','ह','क्ष','त्र','ज्ञ','श्र','ड़','ढ़','फ़','ज़','क़','ख़','ग़','य़'],
    matras: ['ा','ि','ी','ु','ू','ृ','ॄ','ॢ','े','ै','ो','ौ','ं','ः','ँ','्','ॅ','ॉ','ॆ','ॊ','ॏ','॑','॒'],
    numbers: ['०','१','२','३','४','५','६','७','८','९'],
    symbols: ['।','॥','₹','ॐ','॰','ॱ','ॲ','ॳ','ॴ','ॵ','ॶ','ॷ']
};

let _hpCurrentKbdTab = 'vowels';

// ── Modal Open / Close ──
function hpOpenAddWordModal() {
    try {
        // FIX #7: Pro block pe user ko feedback do (pehle silent return tha)
        if (typeof requireProAccess === 'function' && !requireProAccess('Hindi Phonetic Add Word')) {
            if (typeof toastWarning === 'function') {
                toastWarning('Yeh Pro feature hai. Pro unlock karein.');
            } else if (typeof toastError === 'function') {
                toastError('Pro feature — access denied');
            }
            return;
        }
        const modal = document.getElementById('hpAddWordModal');
        if (!modal) { console.warn('[hp] Modal not found'); return; }
        const roman = document.getElementById('hpNewRoman');
        const hindi = document.getElementById('hpNewHindi');
        if (roman) roman.value = '';
        if (hindi) hindi.value = '';
        const kbd = document.getElementById('hpVirtualKeyboard');
        if (kbd) kbd.style.display = 'none';
        hpRenderCustomList();
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        setTimeout(() => { if (roman) roman.focus(); }, 100);
    } catch (e) { console.warn('[hpOpenAddWordModal]', e.message); }
}

function hpCloseAddWordModal() {
    try {
        const modal = document.getElementById('hpAddWordModal');
        if (modal) modal.style.display = 'none';
        // FIX #8: Dono cleanup karo — class remove + unlock scroll
        // (pehle sirf ek hi chalta tha depending on _unlockBodyScroll existence)
        document.body.classList.remove('modal-open');
        if (typeof _unlockBodyScroll === 'function') _unlockBodyScroll();
    } catch (e) {}
}

// ── Save / Delete ──
function hpSaveCustomWord() {
    try {
        if (typeof HindiPhonetic === 'undefined') {
            if (typeof toastError === 'function') toastError('Engine not loaded');
            return;
        }
        const romanEl = document.getElementById('hpNewRoman');
        const hindiEl = document.getElementById('hpNewHindi');
        const roman = romanEl ? romanEl.value.trim().toLowerCase() : '';
        const hindi = hindiEl ? hindiEl.value.trim() : '';

        if (!roman) { if (typeof toastWarning === 'function') toastWarning('Roman word required'); return; }
        if (!/^[a-z]+$/.test(roman)) { if (typeof toastWarning === 'function') toastWarning('Only a-z allowed'); return; }
        if (!hindi) { if (typeof toastWarning === 'function') toastWarning('Hindi word required'); return; }

        HindiPhonetic.addWord(roman, hindi);
        if (typeof toastSuccess === 'function') toastSuccess(`Saved: ${roman} → ${hindi}`);

        if (romanEl) romanEl.value = '';
        if (hindiEl) hindiEl.value = '';
        if (romanEl) romanEl.focus();
        hpRenderCustomList();
    } catch (e) {
        if (typeof toastError === 'function') toastError('Save failed: ' + e.message);
    }
}

function hpDeleteCustomWord(roman) {
    try {
        if (!roman || typeof HindiPhonetic === 'undefined') return;
        if (!confirm(`Remove "${roman}"?`)) return;
        HindiPhonetic.deleteWord(roman);
        hpRenderCustomList();
        if (typeof toastInfo === 'function') toastInfo(`Removed: ${roman}`);
    } catch (e) {}
}

// ── Auto-suggest ──
function hpSuggestHindi() {
    try {
        if (typeof HindiPhonetic === 'undefined') return;
        const romanEl = document.getElementById('hpNewRoman');
        const roman = romanEl ? romanEl.value.trim().toLowerCase() : '';
        if (!roman) { if (typeof toastWarning === 'function') toastWarning('Pehle Roman word likhein'); return; }
        if (!/^[a-z]+$/.test(roman)) { if (typeof toastWarning === 'function') toastWarning('Only a-z'); return; }
        const result = HindiPhonetic.translate(roman);
        if (result && result.text) {
            const hindiEl = document.getElementById('hpNewHindi');
            if (hindiEl) { hindiEl.value = result.text; hindiEl.focus(); hindiEl.select(); }
        }
    } catch (e) {}
}

// ── Keyboard Toggle / Tabs / Render ──
function hpToggleVirtualKeyboard() {
    try {
        const kbd = document.getElementById('hpVirtualKeyboard');
        if (!kbd) return;
        const isOpen = kbd.style.display === 'block';
        kbd.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) hpRenderKbdGrid(_hpCurrentKbdTab);
    } catch (e) {}
}

function hpSwitchKbdTab(tab) {
    try {
        _hpCurrentKbdTab = tab;
        document.querySelectorAll('#hpVirtualKeyboard .hp-kbd-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        hpRenderKbdGrid(tab);
    } catch (e) {}
}

function hpRenderKbdGrid(tab) {
    try {
        const grid = document.getElementById('hpKbdGrid');
        if (!grid) return;
        const chars = HP_KBD_DATA[tab] || [];
        grid.innerHTML = chars.map(c => {
            const safe = String(c).replace(/'/g, "\\'");
            return `<button type="button" class="hp-kbd-key" onclick="hpKbdInsert('${safe}')">${c}</button>`;
        }).join('');
    } catch (e) {}
}

function hpKbdInsert(char) {
    try {
        const input = document.getElementById('hpNewHindi');
        if (!input) return;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        input.value = input.value.slice(0, start) + char + input.value.slice(end);
        const pos = start + char.length;
        input.selectionStart = input.selectionEnd = pos;
        input.focus();
    } catch (e) {}
}

function hpKbdBackspace() {
    try {
        const input = document.getElementById('hpNewHindi');
        if (!input) return;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        if (start !== end) {
            input.value = input.value.slice(0, start) + input.value.slice(end);
            input.selectionStart = input.selectionEnd = start;
        } else if (start > 0) {
            input.value = input.value.slice(0, start - 1) + input.value.slice(start);
            input.selectionStart = input.selectionEnd = start - 1;
        }
        input.focus();
    } catch (e) {}
}

// ── Render Custom List ──
function hpRenderCustomList() {
    try {
        const list = document.getElementById('hpCustomList');
        if (!list) return;
        if (typeof HindiPhonetic === 'undefined') {
            list.innerHTML = '<div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;">Engine loading...</div>';
            return;
        }
        const words = HindiPhonetic.getCustomWords();
        const keys = Object.keys(words).sort();
        if (keys.length === 0) {
            list.innerHTML = '<div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;">Abhi koi custom word nahi hai.</div>';
            return;
        }
        const header = `<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Your Words (${keys.length})</div>`;
        const items = keys.map(k => {
            const hindi = words[k] || '';
            const safeK = hpEscapeHtml(k);
            const safeH = hpEscapeHtml(hindi);
            const safeAttr = safeK.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `<div class="hp-word-item"><div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><span class="hp-word-roman">${safeK}</span><span class="hp-word-arrow">→</span><span class="hp-word-hindi">${safeH}</span></div><button type="button" class="hp-word-del" onclick="hpDeleteCustomWord('${safeAttr}')">✕</button></div>`;
        }).join('');
        list.innerHTML = header + items;
    } catch (e) {}
}

// ── Helper ──
function hpEscapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Global Exports ──
window.hpOpenAddWordModal = hpOpenAddWordModal;
window.hpCloseAddWordModal = hpCloseAddWordModal;
window.hpSaveCustomWord = hpSaveCustomWord;
window.hpDeleteCustomWord = hpDeleteCustomWord;
window.hpSuggestHindi = hpSuggestHindi;
window.hpToggleVirtualKeyboard = hpToggleVirtualKeyboard;
window.hpSwitchKbdTab = hpSwitchKbdTab;
window.hpRenderKbdGrid = hpRenderKbdGrid;
window.hpKbdInsert = hpKbdInsert;
window.hpKbdBackspace = hpKbdBackspace;
window.hpRenderCustomList = hpRenderCustomList;
window.HP_KBD_DATA = HP_KBD_DATA;

console.log('═══════════════════════════════════════════');
console.log('✅ hindi-phonetic-kbd.js (v1.1) loaded');
console.log('   ⌨️  Tabs:', Object.keys(HP_KBD_DATA).length);
console.log('   🔤 Chars:', Object.values(HP_KBD_DATA).reduce((a, b) => a + b.length, 0));
console.log('   💡 Test: hpOpenAddWordModal()');
console.log('═══════════════════════════════════════════');