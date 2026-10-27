// ============================================================
// ✏️ EDITOR — Fast Input + Working Formatting
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.68 — PRODUCTION READY + MOBILE IME FIXED:
//    • FIXED: Enter key — native browser (single newline)
//    • FIXED: Backspace — native command (prevents DOM breaking)
//    • FIXED: Tab — native browser
//    • FIXED: Double character insertion
//    • ✅ NEW FIX: Mobile IME typing (Hindi/Chinese) allowed
//    • ✅ NEW: Hindi Phonetic auto-convert (LipiCraft merge)
// ============================================================

// ============================================================
// 📊 STATE
// ============================================================
let undoStack = [];
let redoStack = [];
let isUndoRedoActive = false;
let undoDebounceTimer = null;
let autoSaveTimer = null;
let savedRange = null;
let currentFontSize = 22;
let initialDefaultCode = '';
let _typingStartTime = null;
let _typingWordCount = 0;
let _typingIdleTimer = null;
let _counterDebounce = null;
let _typingModeDebounce = null;

let _selectionSaveDebounce = null;
const SELECTION_SAVE_DEBOUNCE_MS = 150;

let _printIframe = null;
let _printIframeCleanupTimer = null;

// ✅ Roman shortcut flag (with tick-based reset)
let _romanShortcutActive = false;
let _romanShortcutResetTimer = null;

// ============================================================
// 💾 SAVE/LOAD STATE
// ============================================================
function recordState() {
    const editor = document.getElementById('editor');
    if (isUndoRedoActive || !editor) return;

    const currentHTML = editor.innerHTML;
    if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== currentHTML) {
        undoStack.push(currentHTML);
        if (undoStack.length > 50) undoStack.shift();
        redoStack.length = 0;
    }
    triggerAutoSave();
}

function debouncedRecordState() {
    clearTimeout(undoDebounceTimer);
    undoDebounceTimer = setTimeout(recordState, 600);
}

// ============================================================
// ↶ UNDO
// ============================================================
function customUndo() {
    const editor = document.getElementById('editor');
    if (undoStack.length > 1 && editor) {
        isUndoRedoActive = true;
        redoStack.push(undoStack.pop());
        editor.innerHTML = undoStack[undoStack.length - 1];
        isUndoRedoActive = false;
        updateCounter();
        updateEditorEmptyState();
        triggerAutoSave();
    }
}

// ============================================================
// ↷ REDO
// ============================================================
function customRedo() {
    const editor = document.getElementById('editor');
    if (redoStack.length > 0 && editor) {
        isUndoRedoActive = true;
        const state = redoStack.pop();
        undoStack.push(state);
        editor.innerHTML = state;
        isUndoRedoActive = false;
        updateCounter();
        updateEditorEmptyState();
        triggerAutoSave();
    }
}

// ============================================================
// 💾 AUTOSAVE
// ============================================================
function triggerAutoSave() {
    clearTimeout(autoSaveTimer);

    const draftStatusBadge = document.getElementById('draftStatusBadge');
    if (draftStatusBadge) draftStatusBadge.textContent = '⏳ Saving...';
    if (typeof updateStatusSave === 'function') updateStatusSave('typing');

    autoSaveTimer = setTimeout(() => {
        const editor = document.getElementById('editor');
        if (!editor) return;

        try {
            localStorage.setItem('hor_katha_persisted_draft', editor.innerHTML);
            if (draftStatusBadge) draftStatusBadge.textContent = '💾 Saved';
            if (typeof updateStatusSave === 'function') updateStatusSave('saved');
        } catch (e) {
            console.warn('Auto-save failed:', e.message);
            if (draftStatusBadge) draftStatusBadge.textContent = '⚠️ Save failed';
        }
    }, 800);
}

function restorePersistedDraft() {
    try {
        const saved = localStorage.getItem('hor_katha_persisted_draft');
        const editor = document.getElementById('editor');
        if (!editor) return;

        if (saved && !editor.innerText.trim()) {
            editor.innerHTML = saved;
            recordState();
            updateCounter();
        }

        updateEditorEmptyState();
    } catch (e) {
        console.warn('Draft restore failed:', e.message);
    }
}

// ============================================================
// 🔄 RESTORE DEFAULT
// ============================================================
function restoreEditorDefault() {
    const editor = document.getElementById('editor');
    if (!editor) return;
    if (!confirm('क्या आप एडिटर को डिफ़ॉल्ट स्थिति में रीस्टोर करना चाहते हैं?')) return;

    try {
        localStorage.removeItem('hor_katha_persisted_draft');
    } catch (e) {}

    editor.innerHTML = initialDefaultCode;
    undoStack.length = 0;
    redoStack.length = 0;
    _typingStartTime = null;
    _typingWordCount = 0;
    if (_typingIdleTimer) clearTimeout(_typingIdleTimer);
    if (typeof updateStatusWPM === 'function') updateStatusWPM(0);

    const draftStatusBadge = document.getElementById('draftStatusBadge');
    if (draftStatusBadge) draftStatusBadge.textContent = '🔄 Restored';

    updateEditorEmptyState();
    handleEditorInput(true);
    editor.focus();
}

// ============================================================
// 🎯 SELECTION
// ============================================================
function saveCurrentSelection() {
    clearTimeout(_selectionSaveDebounce);
    _selectionSaveDebounce = setTimeout(_saveCurrentSelectionImmediate, SELECTION_SAVE_DEBOUNCE_MS);
}

function _saveCurrentSelectionImmediate() {
    const editor = document.getElementById('editor');
    if (!editor) return;

    try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (editor.contains(range.commonAncestorContainer)) {
                savedRange = range.cloneRange();
            }
        }
    } catch (e) {}
}

function restoreSelection() {
    if (!savedRange) return false;
    try {
        const sel = window.getSelection();
        if (!sel) return false;
        sel.removeAllRanges();
        sel.addRange(savedRange);
        return true;
    } catch (e) {
        return false;
    }
}

function _placeCursorAtEnd(editor) {
    if (!editor) return;
    try {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(range);
        savedRange = range.cloneRange();
    } catch (e) {}
}

// ============================================================
// ✅ PLACEHOLDER STATE
// ============================================================
function updateEditorEmptyState() {
    const editor = document.getElementById('editor');
    if (!editor) return;

    const rawText = editor.textContent || '';
    const hasEmbedded = editor.querySelector('img, table, hr, ul, ol') !== null;
    const hasContent = rawText.replace(/\u200B/g, '').length > 0 || hasEmbedded;

    editor.setAttribute('data-empty', hasContent ? 'false' : 'true');
}

// ============================================================
// ⌨️ INPUT HANDLER
// ============================================================
function handleEditorInput(immediateState = false) {
    updateEditorEmptyState();

    if (typeof checkSmartTransliteration === 'function') {
        checkSmartTransliteration();
    }

    if (immediateState) {
        recordState();
    } else {
        debouncedRecordState();
    }

    if (typeof enterTypingMode === 'function') {
        clearTimeout(_typingModeDebounce);
        _typingModeDebounce = setTimeout(() => {
            enterTypingMode();
        }, 250);
    }

    // ── Hindi Phonetic auto-convert hook (LipiCraft merge) ──
    if (!window.__hpSkipConvert && window.currentLayout === 'hindi-phonetic') {
        Promise.resolve().then(() => {
            if (typeof hpHandleAutoConvert === 'function') hpHandleAutoConvert();
        });
    }
    // ── End Hindi Phonetic hook ──

    clearTimeout(_counterDebounce);
    _counterDebounce = setTimeout(updateCounter, 80);
}

// ============================================================
// ➕ ADD CHARACTER
// ============================================================
function addCharWithPhonics(ch) {
    if (typeof enterTypingMode === 'function') enterTypingMode();
    if (typeof playKeyClickSound === 'function') playKeyClickSound();
    if (typeof speakLetter === 'function') speakLetter(ch);
    addChar(ch);
}

function addChar(ch) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    const wasAlreadyFocused = document.activeElement === editor;
    if (!wasAlreadyFocused) {
        editor.focus();
    }

    let sel = window.getSelection();
    if (!sel) return;

    const hasValidSelection = sel.rangeCount > 0 &&
                               sel.anchorNode &&
                               editor.contains(sel.anchorNode);

    if (!hasValidSelection) {
        if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
            try {
                sel.removeAllRanges();
                sel.addRange(savedRange);
            } catch (e) {
                _placeCursorAtEnd(editor);
            }
        } else {
            _placeCursorAtEnd(editor);
        }
        sel = window.getSelection();
        if (!sel) return;
    }

    // Ol Chiki digraph handling
    if (window.currentLayout === 'olchiki' && sel && sel.rangeCount > 0) {
        try {
            const range = sel.getRangeAt(0);
            if (range.collapsed &&
                range.startContainer &&
                range.startContainer.nodeType === 3 &&
                range.startOffset > 0) {

                const node = range.startContainer;
                const offset = range.startOffset;
                const prevChar = node.textContent.charAt(offset - 1);
                const pair = prevChar + ch;

                if (typeof olchikiDigraphs !== 'undefined' &&
                    olchikiDigraphs &&
                    olchikiDigraphs[pair]) {

                    const replacement = olchikiDigraphs[pair];
                    node.textContent = node.textContent.substring(0, offset - 1) +
                                       replacement +
                                       node.textContent.substring(offset);

                    const newOffset = (offset - 1) + replacement.length;
                    range.setStart(node, newOffset);
                    range.setEnd(node, newOffset);
                    sel.removeAllRanges();
                    sel.addRange(range);

                    updateEditorEmptyState();
                    saveCurrentSelection();
                    handleEditorInput();
                    return;
                }
            }
        } catch (e) {}
    }

    let inserted = false;
    try {
        inserted = document.execCommand('insertText', false, ch);
    } catch (e) {
        inserted = false;
    }

    if (!inserted) {
        try {
            sel = window.getSelection();
            if (!sel) return;

            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) {
                _placeCursorAtEnd(editor);
                sel = window.getSelection();
                if (!sel) return;
            }

            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(ch);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                editor.appendChild(document.createTextNode(ch));
                _placeCursorAtEnd(editor);
            }
        } catch (e) {
            console.error('addChar fallback failed:', e.message);
            editor.appendChild(document.createTextNode(ch));
            _placeCursorAtEnd(editor);
        }
    }

    updateEditorEmptyState();
    saveCurrentSelection();
    handleEditorInput();
}

// ============================================================
// ⌫ BACKSPACE (v3.7.4.68 — Native execCommand, safe for HTML)
// ============================================================
function doBackspace() {
    if (typeof enterTypingMode === 'function') enterTypingMode();
    if (typeof playKeyClickSound === 'function') playKeyClickSound();

    const editor = document.getElementById('editor');
    if (!editor) return;

    if (document.activeElement !== editor) {
        editor.focus();
    }

    let sel = window.getSelection();
    if (!sel) return;

    const hasValidSelection = sel.rangeCount > 0 &&
                               sel.anchorNode &&
                               editor.contains(sel.anchorNode);

    if (!hasValidSelection) {
        if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
            try {
                sel.removeAllRanges();
                sel.addRange(savedRange);
            } catch (e) {
                _placeCursorAtEnd(editor);
            }
        } else {
            _placeCursorAtEnd(editor);
        }
        sel = window.getSelection();
        if (!sel) return;
    }

    try {
        // ✅ Native command handles text nodes, <br>, and formatting tags perfectly
        document.execCommand('delete', false, null);
    } catch (e) {
        console.warn('Backspace execCommand failed:', e.message);
        
        try {
            const range = sel.getRangeAt(0);
            if (!range.collapsed) {
                range.deleteContents();
            }
        } catch (err) {}
    }

    updateEditorEmptyState();
    saveCurrentSelection();
    handleEditorInput();
}

// ============================================================
// 🇮🇳 SANTALI ROMAN — ALT+KEY SHORTCUTS
// ============================================================
function handleRomanShortcut(e) {
    if (window.currentLayout !== 'roman') return false;
    if (!e.altKey) return false;
    if (e.ctrlKey || e.metaKey) return false;

    const key = e.key;
    if (!key || key.length !== 1) return false;

    if (typeof romanShortcutMap === 'undefined' || !romanShortcutMap) {
        return false;
    }

    const replacement = romanShortcutMap[key];
    if (!replacement) return false;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    _romanShortcutActive = true;

    if (_romanShortcutResetTimer) {
        clearTimeout(_romanShortcutResetTimer);
    }

    _romanShortcutResetTimer = setTimeout(() => {
        _romanShortcutActive = false;
        _romanShortcutResetTimer = null;
    }, 200);

    const editor = document.getElementById('editor');
    if (!editor) {
        _romanShortcutActive = false;
        return true;
    }

    editor.focus();

    let sel = window.getSelection();
    if (!sel) {
        _romanShortcutActive = false;
        return true;
    }

    if (!sel.rangeCount || !editor.contains(sel.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    let inserted = false;
    try {
        inserted = document.execCommand('insertText', false, replacement);
    } catch (err) {
        inserted = false;
    }

    if (!inserted) {
        try {
            sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(replacement);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        } catch (err) {
            console.warn('Roman shortcut fallback failed:', err.message);
        }
    }

    if (typeof updateEditorEmptyState === 'function') updateEditorEmptyState();
    if (typeof saveCurrentSelection === 'function') saveCurrentSelection();
    if (typeof handleEditorInput === 'function') handleEditorInput();

    console.log('🇮🇳 Roman shortcut: Alt+' + key + ' → ' + replacement);

    return true;
}

document.addEventListener('keypress', function(e) {
    if (_romanShortcutActive) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
}, true);

document.addEventListener('beforeinput', function(e) {
    if (_romanShortcutActive) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
}, true);

document.addEventListener('input', function(e) {
    if (_romanShortcutActive) {
        e.stopPropagation();
    }
}, true);

// ============================================================
// 📝 TEXT SHORTCODES
// ============================================================
function handleTextShortcode() {
    if (typeof textShortcodes === 'undefined' || !textShortcodes) return false;
    if (typeof textShortcodes !== 'object' || textShortcodes === null) return false;

    const editor = document.getElementById('editor');
    if (!editor) return false;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;

    const node = range.startContainer;
    if (node.nodeType !== 3) return false;

    const text = node.textContent;
    const offset = range.startOffset;

    const beforeCursor = text.substring(0, offset);
    const match = beforeCursor.match(/(\/[a-z]{2,5})$/);

    if (!match) return false;

    const code = match[1];
    const shortcode = textShortcodes[code];

    if (!shortcode) return false;
    if (typeof shortcode !== 'object' || shortcode === null) return false;

    const layout = window.currentLayout || 'english';
    const replacement = shortcode[layout] || shortcode['english'] || shortcode['roman'];

    if (!replacement || typeof replacement !== 'string') return false;

    if (offset < code.length) return false;

    try {
        const before = text.substring(0, offset - code.length);
        const after = text.substring(offset);
        node.textContent = before + replacement + after;

        const newOffset = before.length + replacement.length;
        range.setStart(node, newOffset);
        range.setEnd(node, newOffset);
        sel.removeAllRanges();
        sel.addRange(range);

        saveCurrentSelection();
        handleEditorInput();

        console.log('📝 Shortcode: ' + code + ' → ' + replacement);
        return true;
    } catch (e) {
        console.warn('Shortcode replace failed:', e.message);
        return false;
    }
}

// ============================================================
// ⌨️ GLOBAL KEYDOWN HANDLER — ✅ FIXED FOR MOBILE IME
// ✅ Enter, Backspace: preventDefault + manual handle
// ✅ Other keys: native
// ============================================================
document.addEventListener('keydown', function(e) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    if (document.activeElement !== editor) return;

    // ✅ NEW FIX: Allow IME composition (Hindi/Chinese mobile keyboards)
    // When typing with native IME, keys fire as 229 or isComposing is true.
    // If we intercept them, the native keyboard breaks.
    if (e.isComposing || e.keyCode === 229) {
        return; 
    }

    // ─── Skip if system keyboard mode ───
    if (window.keyboardMode === 'system' || document.body.classList.contains('system-keyboard-active')) {
        if (e.key === ' ' || e.key === 'Enter') {
            const wasShortcode = handleTextShortcode();
            if (wasShortcode) {
                e.preventDefault();
                e.stopPropagation();
                if (e.key === ' ' && window.currentLayout !== 'english') {
                    setTimeout(() => {
                        if (typeof addCharWithPhonics === 'function') {
                            addCharWithPhonics(' ');
                        }
                    }, 10);
                }
                return;
            }
        }
        return; // Let native keyboard handle everything else
    }

    // ─── Alt+Key shortcuts ───
    if (handleRomanShortcut(e)) {
        return;
    }

    // ─── Text shortcodes trigger ───
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Tab') {
        const wasShortcode = handleTextShortcode();
        if (wasShortcode) {
            e.preventDefault();
            if (e.key === ' ' && window.currentLayout !== 'english') {
                requestAnimationFrame(() => addChar(' '));
            }
            return;
        }
    }

    // ═══════════════════════════════════════════════════════
    // ⏎ ENTER — native browser handling (single newline)
    // ═══════════════════════════════════════════════════════
    if (e.key === 'Enter') {
        if (typeof playKeyClickSound === 'function') playKeyClickSound();
        if (typeof flashKeyVisual === 'function') flashKeyVisual('ENTER');

        setTimeout(() => {
            updateEditorEmptyState();
            saveCurrentSelection();
            handleEditorInput();
        }, 0);
        return;  // ← NO preventDefault
    }

    // ═══════════════════════════════════════════════════════
    // ⌫ BACKSPACE — full control (single char guaranteed)
    // ═══════════════════════════════════════════════════════
    if (e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (typeof doBackspace === 'function') doBackspace();
        if (typeof flashKeyVisual === 'function') flashKeyVisual('BACKSPACE');
        return;
    }

    // ─── Tab ───
    if (e.key === 'Tab') {
        e.preventDefault();
        if (typeof addCharWithPhonics === 'function') addCharWithPhonics('\t');
        if (typeof flashKeyVisual === 'function') flashKeyVisual('TAB');
        return;
    }

    // ─── Space ───
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(' ');
        if (typeof flashKeyVisual === 'function') flashKeyVisual('SPACE');
        return;
    }

    // ─── Escape ───
    if (e.key === 'Escape') {
        if (typeof stopSpeaking === 'function') {
            stopSpeaking();
        }
        return;
    }
});

// ============================================================
// 📊 COUNTER + WPM
// ============================================================
function updateCounter() {
    const charCounter = document.getElementById('char-counter');
    const editor = document.getElementById('editor');
    if (!charCounter || !editor) return;

    let text = editor.innerText || editor.textContent || '';

    text = text.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');
    text = text.replace(/^\n+/, '').replace(/\n+$/, '');
    text = text.split('\n').map(line => line.replace(/[ \t]+$/, '')).join('\n');
    text = text.replace(/\n+$/, '');

    const charCount = text.length;

    const words = text.trim()
        ? text.trim().split(/\s+/).filter(w => w.length > 0).length
        : 0;

    let lines = 0;
    if (text.length > 0) {
        const parts = text.split('\n');
        while (parts.length > 0 && parts[parts.length - 1].trim() === '') parts.pop();
        lines = Math.max(1, parts.length);
    }

    const readTime = words > 0 ? Math.ceil(words / 180) : 0;

    charCounter.textContent = `Chars: ${charCount} | Words: ${words} | Lines: ${lines} | Read: ~${readTime}m`;

    if (typeof updateStatusChars === 'function') updateStatusChars(charCount);
    if (typeof updateStatusWords === 'function') updateStatusWords(words);

    trackWPM(words);
}

function trackWPM(currentWordCount) {
    if (_typingStartTime === null && currentWordCount > 0) {
        _typingStartTime = Date.now();
        _typingWordCount = 0;
    }

    if (currentWordCount === 0) {
        _typingStartTime = null;
        _typingWordCount = 0;
        if (_typingIdleTimer) clearTimeout(_typingIdleTimer);
        if (typeof updateStatusWPM === 'function') updateStatusWPM(0);
        return;
    }

    if (_typingStartTime !== null) {
        const elapsedMin = (Date.now() - _typingStartTime) / 60000;
        if (elapsedMin > 0.05) {
            const wpm = Math.round(currentWordCount / elapsedMin);
            const safeWPM = Math.min(wpm, 250);
            if (typeof updateStatusWPM === 'function') updateStatusWPM(safeWPM);
        }
    }

    if (_typingIdleTimer) clearTimeout(_typingIdleTimer);
    _typingIdleTimer = setTimeout(() => {
        _typingStartTime = null;
    }, 3000);
}

// ============================================================
// 📋 COPY
// ============================================================
function copyText() {
    const editor = document.getElementById('editor');
    const text = (editor ? editor.innerText : '') || '';
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                if (typeof showToast === 'function') {
                    showToast('Text copied to clipboard', 'success');
                }
            })
            .catch(() => _legacyCopy(text));
    } else {
        _legacyCopy(text);
    }
}

function _legacyCopy(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (typeof showToast === 'function') {
            showToast(ok ? 'Text copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
        } else {
            alert(ok ? 'Clipboard par copy ho gaya!' : 'Copy failed');
        }
    } catch (e) {
        alert('Copy failed: ' + e.message);
    }
}

// ============================================================
// 🗑️ CLEAR
// ============================================================
function clearText() {
    const editor = document.getElementById('editor');
    if (!editor) return;

    if (confirm('Clear editor text?')) {
        recordState();

        editor.innerHTML = '';

        try {
            localStorage.removeItem('hor_katha_persisted_draft');
        } catch (e) {}

        _typingStartTime = null;
        _typingWordCount = 0;
        if (_typingIdleTimer) clearTimeout(_typingIdleTimer);
        if (typeof updateStatusWPM === 'function') updateStatusWPM(0);

        updateEditorEmptyState();
        handleEditorInput(true);
        editor.focus();
    }
}

// ============================================================
// 🔤 FONT SIZE
// ============================================================
function adjustFontSize(delta) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    currentFontSize = Math.max(12, Math.min(48, currentFontSize + delta));
    editor.style.fontSize = currentFontSize + 'px';
}

// ============================================================
// 🎨 FORMATTING
// ============================================================
function formatModern(type, val = null) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    editor.focus();
    restoreSelection();

    const sel = window.getSelection();
    if (!sel) return;

    if (sel.rangeCount === 0 && type === 'align') {
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    try {
        if (type === 'align') {
            let cmd;
            if (val === 'justify') {
                cmd = 'justifyFull';
            } else {
                cmd = 'justify' + val.charAt(0).toUpperCase() + val.slice(1);
            }

            const result = document.execCommand(cmd, false, null);

            if (!result && sel.rangeCount > 0) {
                let node = sel.anchorNode;
                let block = null;
                while (node && node !== editor) {
                    if (node.nodeType === 1) { block = node; break; }
                    node = node.parentNode;
                }
                if (block && block !== editor && block.style) {
                    block.style.textAlign = val;
                }
            }
        }
        else if (type === 'list') {
            document.execCommand(val === 'ol' ? 'insertOrderedList' : 'insertUnorderedList', false, null);
        }
        else if (type === 'removeFormat') {
            document.execCommand('removeFormat', false, null);
        }
        else if (type === 'bold') document.execCommand('bold', false, null);
        else if (type === 'italic') document.execCommand('italic', false, null);
        else if (type === 'underline') document.execCommand('underline', false, null);
        else if (type === 'strikeThrough') document.execCommand('strikeThrough', false, null);
    } catch (e) {
        console.warn('Format failed:', e);
    }

    saveCurrentSelection();
    handleEditorInput(true);
}

function applyColorModern(styleProperty, colorValue) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    editor.focus();
    restoreSelection();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    try {
        document.execCommand(
            styleProperty === 'color' ? 'foreColor' : 'hiliteColor',
            false,
            colorValue
        );
    } catch (e) {
        console.warn('Color failed:', e);
    }

    saveCurrentSelection();
    handleEditorInput(true);
}

// ============================================================
// 🔠 CASE CONVERT — Surrogate-safe
// ============================================================
function convertTextCasing(mode) {
    const ed = document.getElementById('editor');
    if (!ed) return;

    ed.focus();
    restoreSelection();

    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed;
    const sourceText = hasSelection ? sel.toString() : (ed.innerText || '');
    if (!sourceText) return;

    function transform(val) {
        switch (mode) {
            case 'upper': return val.toUpperCase();
            case 'lower': return val.toLowerCase();
            case 'title': return val.toLowerCase().replace(/(?:^|\s|-|_)\S/g, m => m.toUpperCase());
            case 'sentence': return val.toLowerCase().replace(/(^\s*|[.!?]\s*)\S/g, m => m.toUpperCase());

            case 'camel': {
                let c = val.replace(/[^a-zA-Z0-9\s-_]/g, '').toLowerCase();
                let r = c.replace(/[-_\s]+(.)?/g, (match, ch) => ch ? ch.toUpperCase() : '');
                if (!r) return '';
                return r.charAt(0).toLowerCase() + r.slice(1);
            }
            case 'kebab': return val.trim().replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
            case 'snake': return val.trim().replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();

            case 'inverse': return Array.from(val).map(c =>
                c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()
            ).join('');

            case 'num-to-dev': {
                const d = ['०','१','२','३','४','५','६','७','८','९'];
                return val.replace(/[0-9]/g, x => d[parseInt(x, 10)]);
            }
            case 'num-to-ol': {
                const o = ['᱐','᱑','᱒','᱓','᱔','᱕','᱖','᱗','᱘','᱙'];
                return val.replace(/[0-9]/g, x => o[parseInt(x, 10)]);
            }
            case 'num-to-lat': {
                const m = {
                    '०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9',
                    '᱐':'0','᱑':'1','᱒':'2','᱓':'3','᱔':'4','᱕':'5','᱖':'6','᱗':'7','᱘':'8','᱙':'9'
                };
                return val.replace(/[०-९᱐-᱙]/g, ch => m[ch] !== undefined ? m[ch] : ch);
            }
            default: return val;
        }
    }

    const converted = transform(sourceText);

    if (hasSelection) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const tn = document.createTextNode(converted);
        range.insertNode(tn);
        range.setStartAfter(tn);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        ed.innerText = converted;
    }

    saveCurrentSelection();
    handleEditorInput(true);
}

// ============================================================
// 🔍 FIND/REPLACE
// ============================================================
function openFindReplaceModal() {
    const modal = document.getElementById('findReplaceModal');
    if (modal) modal.style.display = 'flex';
    const input = document.getElementById('findInput');
    if (input) input.focus();
}

function closeFindReplaceModal() {
    const modal = document.getElementById('findReplaceModal');
    if (modal) modal.style.display = 'none';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/`/g, "&#096;")
        .replace(/\//g, "&#47;");
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function executeReplaceFirst() {
    const findStr = document.getElementById('findInput').value;
    const replaceStr = document.getElementById('replaceInput').value;
    const matchCase = document.getElementById('matchCaseCheck').checked;
    const editor = document.getElementById('editor');
    if (!findStr || !editor) return;

    const val = editor.innerText || '';
    const flags = matchCase ? '' : 'i';
    const regex = new RegExp(escapeRegex(findStr), flags);

    if (regex.test(val)) {
        editor.innerText = val.replace(regex, replaceStr);
        handleEditorInput(true);
    } else {
        alert('टेक्स्ट नहीं मिला!');
    }
}

function executeReplaceAll() {
    const findStr = document.getElementById('findInput').value;
    const replaceStr = document.getElementById('replaceInput').value;
    const matchCase = document.getElementById('matchCaseCheck').checked;
    const editor = document.getElementById('editor');
    if (!findStr || !editor) return;

    const val = editor.innerText || '';

    if (val.length > 500000) {
        if (!confirm(`⚠️ Text is very large (${Math.round(val.length/1000)}K chars).\nContinue may take a few seconds. OK?`)) {
            return;
        }
    }

    const flags = matchCase ? 'g' : 'gi';
    const regex = new RegExp(escapeRegex(findStr), flags);

    let matchCount = 0;
    const result = val.replace(regex, () => {
        matchCount++;
        return replaceStr;
    });

    if (matchCount > 0) {
        editor.innerText = result;
        handleEditorInput(true);
        alert(`${matchCount} स्थान पर बदल दिया गया।`);
        closeFindReplaceModal();
    } else {
        alert('टेक्स्ट नहीं मिला!');
    }
}

// ============================================================
// 🖨️ PRINT
// ============================================================
function printEditorText() {
    const editor = document.getElementById('editor');
    if (!editor || !(editor.innerText || '').trim()) {
        alert('प्रिंट करने के लिए टेक्स्ट लिखें।');
        return;
    }

    if (typeof window.generatePremiumPrint === 'function') {
        try {
            window.generatePremiumPrint();
            return;
        } catch (err) {
            console.warn('[print] Premium generator failed:', err);
        }
    }

    console.warn('[print] Falling back to iframe-based print');
    _printViaIframe();
}

function _cleanupPrintIframe() {
    if (_printIframeCleanupTimer) {
        clearTimeout(_printIframeCleanupTimer);
        _printIframeCleanupTimer = null;
    }

    if (_printIframe && _printIframe.parentNode) {
        try {
            _printIframe.parentNode.removeChild(_printIframe);
        } catch (e) {}
    }
    _printIframe = null;
}

function _printViaIframe() {
    const editor = document.getElementById('editor');
    if (!editor) return;

    _cleanupPrintIframe();

    const cf = editor.style.fontFamily || "'Noto Sans Devanagari', sans-serif";
    const safeFont = String(cf).replace(/[<>"']/g, '');

    let content = editor.innerHTML || '';
    content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    content = content.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '');
    content = content.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
    content = content.replace(/(?:href|src)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '');

    const printHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Print — Hor Katha Suite</title>
<style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body {
    font-family: ${safeFont};
    font-size: 12pt;
    line-height: 1.8;
    padding: 20px;
    color: #000;
    margin: 0;
}
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #94a3b8; padding: 6px 10px; }
ul, ol { padding-left: 24px; }
h1, h2, h3 { page-break-after: avoid; }
@media print {
    body { padding: 0; }
}
</style>
</head>
<body>${content}</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'Print Preview');

    document.body.appendChild(iframe);
    _printIframe = iframe;

    try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(printHTML);
        doc.close();

        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                console.log('✅ [print] Print dialog triggered');
            } catch (e) {
                console.warn('[print] Iframe print failed:', e);
                _fallbackPrintViaWindow(printHTML);
            }

            _printIframeCleanupTimer = setTimeout(_cleanupPrintIframe, 3000);
        }, 400);

    } catch (e) {
        console.error('[print] Iframe document write failed:', e);
        _fallbackPrintViaWindow(printHTML);
    }
}

function _fallbackPrintViaWindow(html) {
    try {
        const w = window.open('', '_blank', 'width=900,height=1200,noopener,noreferrer');

        if (!w) {
            if (typeof showToast === 'function') {
                showToast(
                    '⚠️ Print popup blocked! Please allow popups for this site.',
                    'warning',
                    6000
                );
            }
            alert(
                '⚠️ Print popup blocked!\n\n' +
                'Please allow popups for this site and try again.\n\n' +
                'Or: Use browser menu → Print (Ctrl+P)'
            );
            return;
        }

        w.document.open();
        w.document.write(html);
        w.document.close();

        setTimeout(() => {
            try {
                w.focus();
                w.print();
            } catch (e) {
                console.warn('Popup print failed:', e.message);
            }
        }, 500);

    } catch (e) {
        alert('Print failed: ' + e.message);
    }
}

// ============================================================
// 📄 WORD EXPORT (Pro required)
// ============================================================
function downloadDocFile() {
    if (typeof requireProAccess === 'function' && !requireProAccess('Word .doc Export')) return;

    const editor = document.getElementById('editor');
    const cf = (editor ? editor.style.fontFamily : '') || "'Noto Sans Devanagari', sans-serif";

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Document</title></head><body>";
    const footer = "</body></html>";
    const content = editor ? editor.innerHTML : '';

    const src = header + `<div style="font-family:${cf}; font-size:16pt;">${content}</div>` + footer;
    const blob = new Blob(['\ufeff' + src], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Hor_Katha_Doc_${Date.now()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            URL.revokeObjectURL(url);
        });
    });
}

// ============================================================
// 💾 TXT EXPORT (Pro required)
// ============================================================
function downloadTextFile() {
    if (typeof requireProAccess === 'function' && !requireProAccess('TXT Export')) return;

    const ver = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.VERSION : '3.7.4';
    const editor = document.getElementById('editor');
    const text = (editor ? editor.innerText : '') || '';

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Hor_Katha_v${ver}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            URL.revokeObjectURL(url);
        });
    });
}

// ============================================================
// 📲 WHATSAPP SHARE
// ============================================================
function shareViaWhatsApp() {
    const editor = document.getElementById('editor');
    const text = (editor ? editor.innerText : '') || '';

    if (!text.trim()) {
        alert('शेयर करने के लिए टेक्स्ट लिखें!');
        return;
    }

    window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
        '_blank',
        'noopener,noreferrer'
    );
}

// ============================================================
// 📱 MOBILE QR
// ============================================================
function openMobileQrModal() {
    const editor = document.getElementById('editor');
    const val = (editor ? editor.innerText : '').trim();

    if (!val) {
        alert('QR Generate karne ke liye editor me text likhein.');
        return;
    }

    if (typeof renderQRCode === 'function') {
        renderQRCode('mobileQrBox', val.substring(0, 500), 150);
    }

    const notice = document.getElementById('qrTextLengthNotice');
    if (notice) notice.textContent = `Total: ${val.length} characters encoded.`;

    const modal = document.getElementById('mobileQrModal');
    if (modal) modal.style.display = 'flex';
}

function closeMobileQrModal() {
    const modal = document.getElementById('mobileQrModal');
    if (modal) modal.style.display = 'none';
}

// ============================================================
// 🧹 CLEANUP
// ============================================================
window.addEventListener('beforeunload', () => {
    _cleanupPrintIframe();

    if (_romanShortcutResetTimer) {
        clearTimeout(_romanShortcutResetTimer);
        _romanShortcutResetTimer = null;
    }
});

// ============================================================
// 🧠 HINDI PHONETIC — Contenteditable-safe auto-convert
// Added for LipiCraft merge · Hoṛ Katha v3.7.4
// ============================================================
function hpHandleAutoConvert() {
    try {
        if (window.currentLayout !== 'hindi-phonetic') return;
        if (typeof HindiPhonetic === 'undefined') return;

        const editor = document.getElementById('editor');
        if (!editor) return;

        // Skip if formatting is active
        if (editor.querySelector('b, strong, i, em, u, span[style], font, a')) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        if (!range.collapsed) return;

        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return;

        const offset = range.startOffset;
        const textBefore = node.textContent.slice(0, offset);

        const match = textBefore.match(/([A-Za-z][A-Za-z']*)([\s.,!?;:)\]}'"\-]+)$/);
        if (!match) return;

        const word = match[1];
        const tail = match[2];
        const start = offset - match[0].length;
        const wordEnd = start + word.length;

        const lower = word.toLowerCase();
        const isKnown = HindiPhonetic.translate(lower).text !== word;
        if (!isKnown && !/[aeiouAEIOU]/.test(word) && word.length <= 2) return;

        const result = HindiPhonetic.translate(word);
        if (!result || !result.text || result.text === word) return;

        const beforeText = node.textContent.slice(0, start);
        const afterText  = node.textContent.slice(wordEnd);
        node.textContent = beforeText + result.text + afterText;

        const newPos = start + result.text.length + tail.length;
        const newRange = document.createRange();
        newRange.setStart(node, newPos);
        newRange.setEnd(node, newPos);
        sel.removeAllRanges();
        sel.addRange(newRange);

        if (typeof handleEditorInput === 'function') {
            window.__hpSkipConvert = true;
            try { handleEditorInput(true); } finally { window.__hpSkipConvert = false; }
        }
    } catch (e) {
        console.warn('[hpHandleAutoConvert]', e.message);
    }
}

window.hpHandleAutoConvert = hpHandleAutoConvert;

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
window.EditorDebug = {
    status: () => {
        const editor = document.getElementById('editor');
        console.log('═══════════════════════════════════════════');
        console.log('✏️ Editor Status — v3.7.4.68');
        console.log('───────────────────────────────────────────');
        console.log('  Content length:', editor ? (editor.innerText || '').length : 0);
        console.log('  Undo stack:', undoStack.length);
        console.log('  Redo stack:', redoStack.length);
        console.log('  Empty state:', editor ? editor.getAttribute('data-empty') : 'N/A');
        console.log('  Font size:', currentFontSize);
        console.log('  Selection saved:', !!savedRange);
        console.log('  Print iframe active:', !!_printIframe);
        console.log('  Current layout:', window.currentLayout || 'unknown');
        console.log('  Roman shortcut active:', _romanShortcutActive);
        console.log('  Roman reset timer pending:', !!_romanShortcutResetTimer);
        console.log('  Hindi Phonetic hook:', typeof hpHandleAutoConvert === 'function' ? '✅' : '❌');
        console.log('═══════════════════════════════════════════');
    },

    undo: () => customUndo(),
    redo: () => customRedo(),
    save: () => recordState(),

    clear: () => {
        const editor = document.getElementById('editor');
        if (editor) {
            editor.innerHTML = '';
            updateEditorEmptyState();
            handleEditorInput(true);
        }
    },

    testBackspace: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 BACKSPACE TEST (v3.7.4.68)');
        console.log('═══════════════════════════════════════════');

        const editor = document.getElementById('editor');
        if (!editor) {
            console.log('  ❌ Editor not found');
            return;
        }

        const original = editor.innerHTML;

        editor.innerHTML = 'ABCDE';
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        console.log('  BEFORE: "' + editor.innerText + '"');
        doBackspace();
        console.log('  AFTER:  "' + editor.innerText + '"');
        console.log('  Result:', editor.innerText === 'ABCD' ? '✅ PASS (1 char deleted)' : '❌ FAIL');

        editor.innerHTML = original;
        console.log('═══════════════════════════════════════════');
    },

    testEnterKey: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 ENTER KEY TEST (v3.7.4.68)');
        console.log('═══════════════════════════════════════════');
        console.log('  Enter uses NATIVE browser handling.');
        console.log('  Manual test:');
        console.log('    1. Click in editor');
        console.log('    2. Type "Hello"');
        console.log('    3. Press Enter ONCE');
        console.log('    4. Type "World"');
        console.log('    5. Expected: two lines, NO extra gap');
        console.log('═══════════════════════════════════════════');
    },

    testHindiPhonetic: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 HINDI PHONETIC TEST');
        console.log('═══════════════════════════════════════════');
        console.log('  Current layout:', window.currentLayout);
        console.log('  HindiPhonetic loaded:', typeof HindiPhonetic !== 'undefined' ? '✅' : '❌');
        if (typeof HindiPhonetic !== 'undefined') {
            console.log('  Test translate:', HindiPhonetic.translate('namaste'));
            console.log('  Test translate:', HindiPhonetic.translate('ghar'));
            console.log('  Test translate:', HindiPhonetic.translate('aaj_kal'));
        }
        console.log('═══════════════════════════════════════════');
    },

    selfTest: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 EDITOR SELF-TEST (v3.7.4.68)');
        console.log('═══════════════════════════════════════════');

        const editor = document.getElementById('editor');
        const results = {
            editorExists: !!editor,
            addChar: typeof addChar === 'function',
            backspace: typeof doBackspace === 'function',
            undo: typeof customUndo === 'function',
            redo: typeof customRedo === 'function',
            print: typeof printEditorText === 'function',
            printIframe: typeof _printViaIframe === 'function',
            cleanupPrintIframe: typeof _cleanupPrintIframe === 'function',
            wordExport: typeof downloadDocFile === 'function',
            txtExport: typeof downloadTextFile === 'function',
            share: typeof shareViaWhatsApp === 'function',
            copy: typeof copyText === 'function',
            clear: typeof clearText === 'function',
            format: typeof formatModern === 'function',
            caseConvert: typeof convertTextCasing === 'function',
            findReplace: typeof executeReplaceAll === 'function',
            romanShortcut: typeof handleRomanShortcut === 'function',
            shortcode: typeof handleTextShortcode === 'function',
            hindiPhonetic: typeof hpHandleAutoConvert === 'function'
        };

        Object.entries(results).forEach(([key, pass]) => {
            console.log(`  ${pass ? '✅' : '❌'} ${key}`);
        });

        const allPass = Object.values(results).every(v => v);
        console.log('\n' + (allPass ? '🎉 ALL FUNCTIONS PRESENT' : '⚠️ SOME MISSING'));
        console.log('═══════════════════════════════════════════');

        return results;
    },

    stats: () => {
        const editor = document.getElementById('editor');
        if (!editor) return;
        const text = editor.innerText || '';
        console.table({
            'Characters': text.length,
            'Words': text.trim() ? text.trim().split(/\s+/).length : 0,
            'Lines': text.split('\n').length,
            'Undo': undoStack.length,
            'Redo': redoStack.length
        });
    }
};

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ Editor module loaded — v3.7.4.68');
console.log('   ⏎  Enter: NATIVE browser (single newline)');
console.log('   ⌫  Backspace: Native execCommand (HTML safe)');
console.log('   ✅ FIXED: Enter double newline');
console.log('   ✅ FIXED: Backspace DOM breaking on rich text');
console.log('   ✅ FIXED: Mobile IME typing (Hindi/Chinese) allowed');
console.log('   ✅ NEW: Hindi Phonetic auto-convert integrated');
console.log('   🧪 EditorDebug.testBackspace() available');
console.log('   🧪 EditorDebug.testHindiPhonetic() available');
console.log('   🧪 EditorDebug.selfTest() available');
console.log('═══════════════════════════════════════════');