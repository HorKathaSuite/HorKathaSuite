// ============================================================
// ⌨️ VIRTUAL KEYBOARD SYSTEM — Trial-Aware + Perfect Fit
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.90 — BUG #7 FIXED (MEMORY LEAK + STRICT CONTRACT):
//    • 🔴 FIXED: Retry timers now self-remove from tracking array
//                (was: pushed but never removed → memory leak)
//    • 🔴 FIXED: renderMappingGuide() strict contract
//                (no-arg call now logs warning, not silent)
//    • 🔴 FIXED: _clearMappingRetries() safety check
//    • NEW: _trackRetryTimer() helper
//    • NEW: _untrackRetryTimer() helper
//    • NEW: getPendingRetryCount() debug method
//    • NEW: KeyboardDebug.testMemoryLeak() — verify fix
//    • NEW: KeyboardDebug.testRaceSafeRetry() — enhanced
//    • RETAINED: All previous fixes
// ============================================================

(function() {
    'use strict';

    // ✅ Skip if already loaded
    if (window.__keyboardLoaded) {
        console.log('⚠️ keyboard.js already loaded — skipping');
        return;
    }
    window.__keyboardLoaded = true;

    console.log('📦 keyboard.js loading...');

    // ============================================================
    // 📊 CONSTANTS
    // ============================================================
    const VOCAB_MAX_PER_LANG = 1000;
    const HOVER_SPEECH_THROTTLE_MS = 300;
    const FOCUS_MODE_DEBOUNCE_MS = 150;
    const FOCUS_LOST_DEBOUNCE_MS = 300;
    const VOCAB_SAVE_DEBOUNCE_MS = 500;

    const KEYBOARD_MAX_HEIGHT_PX = 220;
    const KEYBOARD_MIN_HEIGHT_PX = 180;
    const KEYBOARD_HEIGHT_RATIO = 0.25;
    const VIEWPORT_RESERVED_PX = 60;

    const _DESKTOP_BREAKPOINT_PX = 1024;

    const KEYBOARD_LANGUAGES = Object.freeze([
        'english', 'roman', 'hindi-dev', 'santali-dev', 'olchiki'
    ]);

    const MAPPING_RETRY_DELAYS = [50, 150, 300, 500];

    // ============================================================
    // 🛠️ DOM-READY HELPER
    // ============================================================
    function _ready(fn, delay) {
        delay = delay || 0;
        const run = () => setTimeout(fn, delay);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            run();
        }
    }

    // ============================================================
    // 📊 GLOBAL STATE
    // ============================================================
    const KB = {
        currentLayout: 'english',
        isShift: false,
        isCaps: false,
        isNumpadActive: false,
        keyboardMode: 'virtual',
        userVocabDB: {},
        _olchikiReverseMap: null,
        _switchInProgress: false,
        _lastHoverSpeechTime: 0,
        _vocabSaveDebounce: null,
        _mappingRetryTimers: [],
        _mappingGeneration: 0
    };

    let _isDesktopMode = false;
    let _breakpointMediaQuery = null;
    let _fallbackResizeHandler = null;

    // ─── Load keyboard mode ───
    try {
        KB.keyboardMode = localStorage.getItem('hor_kb_mode') || 'virtual';
    } catch (e) {
        KB.keyboardMode = 'virtual';
    }

    // ─── Load user vocab (with deep validation) ───
    try {
        const raw = localStorage.getItem('hor_user_vocab_db');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                Object.keys(parsed).forEach(key => {
                    if (Array.isArray(parsed[key])) {
                        const cleanArr = parsed[key].filter(item =>
                            typeof item === 'string' && item.length > 0 && item.length <= 100
                        );
                        if (cleanArr.length > 0) {
                            KB.userVocabDB[key] = cleanArr.slice(0, VOCAB_MAX_PER_LANG);
                        }
                    }
                });
            }
        }
    } catch (e) {
        console.warn('⚠️ Vocab DB load failed:', e.message);
        KB.userVocabDB = {};
    }

    // ============================================================
    // 🎯 BREAKPOINT DETECTION
    // ============================================================
    function _initBreakpointDetection() {
        const desktopQuery = `(min-width: ${_DESKTOP_BREAKPOINT_PX + 1}px)`;

        try {
            if (typeof window.matchMedia === 'function') {
                _breakpointMediaQuery = window.matchMedia(desktopQuery);
                _isDesktopMode = _breakpointMediaQuery.matches;

                if (typeof _breakpointMediaQuery.addEventListener === 'function') {
                    _breakpointMediaQuery.addEventListener('change', _handleBreakpointChange);
                } else if (typeof _breakpointMediaQuery.addListener === 'function') {
                    _breakpointMediaQuery.addListener(_handleBreakpointChange);
                } else {
                    _setupFallbackResizeListener();
                }
            } else {
                _setupFallbackResizeListener();
            }
        } catch (e) {
            _isDesktopMode = window.innerWidth > _DESKTOP_BREAKPOINT_PX;
            _setupFallbackResizeListener();
        }

        console.log('🎯 [keyboard] Initial mode:', _isDesktopMode ? 'DESKTOP' : 'MOBILE/TABLET');
    }

    function _setupFallbackResizeListener() {
        if (_fallbackResizeHandler) return;

        _fallbackResizeHandler = function() {
            const newMode = window.innerWidth > _DESKTOP_BREAKPOINT_PX;
            if (newMode !== _isDesktopMode) {
                _isDesktopMode = newMode;
                _onBreakpointChanged(newMode);
            }
        };

        window.addEventListener('resize', _fallbackResizeHandler, { passive: true });
    }

    function _handleBreakpointChange(e) {
        const newMode = e.matches;
        if (newMode === _isDesktopMode) return;
        _isDesktopMode = newMode;
        _onBreakpointChanged(newMode);
    }

    function _onBreakpointChanged(isDesktop) {
        console.log('🎯 [keyboard] Breakpoint changed →', isDesktop ? 'DESKTOP' : 'MOBILE/TABLET');

        if (isDesktop && document.body.classList.contains('typing-focus')) {
            exitTypingMode();
        }
    }

    function _isDesktopView() {
        return _isDesktopMode;
    }

    _initBreakpointDetection();

    // ============================================================
    // 🎨 XSS-Safe HTML escape
    // ============================================================
    function _escapeKeyboardHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;')
            .replace(/\//g, '&#47;');
    }

    // ============================================================
    // 🔒 Ol Chiki Reverse Map (lazy)
    // ============================================================
    function _buildOlchikiReverseMap() {
        if (KB._olchikiReverseMap) return KB._olchikiReverseMap;

        KB._olchikiReverseMap = {};
        try {
            if (typeof hardwareOlchikiMap !== 'undefined') {
                Object.keys(hardwareOlchikiMap).forEach(k => {
                    const v = hardwareOlchikiMap[k];
                    if (v && !KB._olchikiReverseMap[v]) {
                        KB._olchikiReverseMap[v] = k;
                    }
                });
            }
        } catch (e) {}
        return KB._olchikiReverseMap;
    }

    // ============================================================
    // 🎯 TYPING MODE (Focus)
    // ============================================================
    let _typingModeTimer = null;
    let _focusLostTimer = null;

    function enterTypingMode() {
        if (_isDesktopView()) return;
        if (KB.keyboardMode !== 'virtual') return;

        clearTimeout(_typingModeTimer);
        clearTimeout(_focusLostTimer);

        _typingModeTimer = setTimeout(() => {
            document.body.classList.add('typing-focus');
            updateKeyboardHeight();

            if (typeof window.updateFocusBarHeading === 'function') {
                const current = (typeof window.currentLayout !== 'undefined')
                    ? window.currentLayout
                    : KB.currentLayout;
                window.updateFocusBarHeading(current);
            }
            console.log('🎯 Focus mode ON');
        }, FOCUS_MODE_DEBOUNCE_MS);
    }

    function updateKeyboardHeight() {
        const keyboard = document.querySelector('.keyboard-deck');
        if (keyboard) {
            const availableHeight = window.innerHeight - VIEWPORT_RESERVED_PX;
            const targetHeight = Math.min(
                KEYBOARD_MAX_HEIGHT_PX,
                Math.max(KEYBOARD_MIN_HEIGHT_PX, availableHeight * KEYBOARD_HEIGHT_RATIO)
            );
            keyboard.style.height = targetHeight + 'px';
        }
    }

    function exitTypingMode() {
        clearTimeout(_typingModeTimer);
        clearTimeout(_focusLostTimer);

        document.body.classList.remove('typing-focus');

        const keyboard = document.querySelector('.keyboard-deck');
        if (keyboard) keyboard.style.height = '';

        const editor = document.getElementById('editor');
        if (editor) {
            try { editor.blur(); } catch (e) {}
        }
        console.log('🎯 Focus mode OFF');
    }

    function setupTypingFocusListeners() {
        const editor = document.getElementById('editor');
        if (!editor || editor.dataset.focusBound) return;
        editor.dataset.focusBound = '1';

        editor.addEventListener('focus', () => {
            if (!_isDesktopView()) enterTypingMode();
        });

        editor.addEventListener('blur', () => {
            if (!_isDesktopView()) {
                clearTimeout(_focusLostTimer);
                _focusLostTimer = setTimeout(() => {
                    const focused = document.activeElement;
                    const focusBar = document.getElementById('focusModeBar');
                    if (focusBar && focusBar.contains(focused)) return;
                    exitTypingMode();
                }, FOCUS_LOST_DEBOUNCE_MS);
            }
        });

        const safeContainers = [
            '.keyboard-deck', '.action-bar', '.suggestion-bar', '#focusModeBar'
        ];

        safeContainers.forEach(selector => {
            const container = document.querySelector(selector);
            if (!container) return;
            if (container.dataset.kbFocusBound === '1') return;
            container.dataset.kbFocusBound = '1';

            container.addEventListener('mousedown', (e) => {
                const isInteractive = e.target.closest(
                    'button, .key, .sugg-chip, .key-dia, .btn-action, .focus-back-btn, .focus-bar-btn'
                );
                if (isInteractive && !_isDesktopView()) e.preventDefault();
            });

            container.addEventListener('touchstart', (e) => {
                const isInteractive = e.target.closest(
                    'button, .key, .sugg-chip, .key-dia, .btn-action, .focus-back-btn, .focus-bar-btn'
                );
                if (isInteractive && !_isDesktopView()) {
                    setTimeout(() => {
                        const ed = document.getElementById('editor');
                        if (ed && document.body.classList.contains('typing-focus')) {
                            try { ed.focus(); } catch (err) {}
                        }
                    }, 30);
                }
            }, { passive: true });
        });

        console.log('✅ [keyboard] Focus listeners bound');
    }

    _ready(setupTypingFocusListeners, 300);

    window.addEventListener('resize', () => {
        if (document.body.classList.contains('typing-focus')) {
            updateKeyboardHeight();
        }
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('typing-focus')) {
            exitTypingMode();
        }
    });

    // ============================================================
    // 🆕 SETTINGS BAR SCROLL INDICATOR
    // ============================================================
    function setupSettingsBarScrollIndicator() {
        const bar = document.querySelector('.top-settings-bar');
        if (!bar) {
            setTimeout(setupSettingsBarScrollIndicator, 500);
            return;
        }

        if (bar.dataset.scrollIndicatorBound === '1') return;
        bar.dataset.scrollIndicatorBound = '1';

        function updateIndicator() {
            const isScrollable = bar.scrollWidth > bar.clientWidth;
            const atStart = bar.scrollLeft <= 5;
            const atEnd = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 5;

            bar.classList.remove('scrollable-left', 'scrollable-right', 'scrollable-both');
            if (!isScrollable) return;

            if (atStart && !atEnd) {
                bar.classList.add('scrollable-right');
            } else if (!atStart && atEnd) {
                bar.classList.add('scrollable-left');
            } else if (!atStart && !atEnd) {
                bar.classList.add('scrollable-both');
            }
        }

        bar.addEventListener('scroll', updateIndicator, { passive: true });
        window.addEventListener('resize', updateIndicator, { passive: true });
        setTimeout(updateIndicator, 300);

        console.log('✅ [keyboard] Settings bar scroll indicator active');
    }

    _ready(setupSettingsBarScrollIndicator, 800);
    window.addEventListener('app-ready', () => setTimeout(setupSettingsBarScrollIndicator, 500));
    window.setupSettingsBarScrollIndicator = setupSettingsBarScrollIndicator;

    // ============================================================
    // ⌨️ DRAW KEYBOARD
    // ============================================================
    function drawKeyboard() {
        const keyboard = document.getElementById('keyboard');
        if (!keyboard) {
            console.warn('⚠️ Keyboard element not found');
            return;
        }

        if (typeof baseLayouts === 'undefined') {
            console.warn('⚠️ baseLayouts not loaded');
            return;
        }

        const fragment = document.createDocumentFragment();
        const layoutObj = baseLayouts[KB.currentLayout] || baseLayouts['english'];

        if (!layoutObj) {
            console.warn('⚠️ Layout not found:', KB.currentLayout);
            return;
        }

        const rows = (KB.isShift || KB.isCaps) ? layoutObj.shift : layoutObj.normal;

        if (!rows || !Array.isArray(rows)) {
            console.warn('⚠️ Rows not found');
            return;
        }

        rows.forEach((row, rIdx) => {
            if (!Array.isArray(row)) return;

            const rowDiv = document.createElement('div');
            rowDiv.className = 'key-row';

            row.forEach(k => {
                if (k === undefined || k === null) return;

                const btn = document.createElement('button');
                btn.className = 'key';
                btn.setAttribute('data-key', k);
                btn.setAttribute('data-hint', getKeyHint(k));
                btn.onmousedown = (e) => e.preventDefault();
                btn.addEventListener('mouseenter', () => handleHoverSpeech(k));

                if (rIdx === 0) btn.classList.add('key-func');

                if (k === 'BACKSPACE') {
                    btn.textContent = '⌫ Del';
                    btn.classList.add('key-func', 'key-side');
                    btn.onclick = () => {
                        if (typeof doBackspace === 'function') doBackspace();
                    };
                } else if (k === 'SPACE') {
                    btn.textContent = 'Space';
                    btn.classList.add('key-space', 'key-func');
                    btn.onclick = () => {
                        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(' ');
                    };
                } else if (k === 'ENTER') {
                    btn.textContent = '↵ Enter';
                    btn.classList.add('key-func', 'key-side');
                    btn.onclick = () => {
                        if (typeof addCharWithPhonics === 'function') addCharWithPhonics('\n');
                    };
                } else if (k === 'SHIFT') {
                    btn.textContent = '⇧ Shift';
                    btn.classList.add('key-func', 'key-side');
                    if (KB.isShift) btn.classList.add('active-lock');
                    btn.onclick = toggleShift;
                } else if (k === 'CAPS') {
                    btn.textContent = 'Caps';
                    btn.classList.add('key-func');
                    if (KB.isCaps) btn.classList.add('active-lock');
                    btn.onclick = toggleCaps;
                } else if (k === 'LANG_SWITCH') {
                    btn.textContent = '🌐';
                    btn.classList.add('key-func', 'key-side');
                    btn.onclick = () => {
                        if (typeof playKeyClickSound === 'function') playKeyClickSound();
                        if (typeof speakLetter === 'function') speakLetter('Language');
                        cycleNextLanguage();
                    };
                } else if (k === 'ALTGR') {
                    btn.textContent = 'AltGr';
                    btn.classList.add('key-func');
                } else if (['TAB', 'CTRL', 'ALT', 'UP', 'DOWN', 'LEFT', 'RIGHT'].includes(k)) {
                    const shortLabels = {
                        'TAB': 'Tab', 'CTRL': 'Ctrl', 'ALT': 'Alt',
                        'UP': '↑', 'DOWN': '↓', 'LEFT': '←', 'RIGHT': '→'
                    };
                    btn.textContent = shortLabels[k] || k;
                    btn.classList.add('key-func');
                    if (k === 'TAB') {
                        btn.onclick = () => {
                            if (typeof addCharWithPhonics === 'function') addCharWithPhonics('\t');
                        };
                    }
                } else if (/^F\d+$/.test(k) || k === 'ESC') {
                    btn.textContent = k;
                    btn.classList.add('key-func', 'key-fkey');
                    btn.onclick = () => {
                        if (typeof playKeyClickSound === 'function') playKeyClickSound();
                    };
                } else {
                    btn.textContent = k;
                    btn.classList.add('key-char');
                    btn.onclick = () => {
                        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(k);
                        if (KB.isShift && !KB.isCaps) {
                            KB.isShift = false;
                            drawKeyboard();
                        }
                    };
                }

                rowDiv.appendChild(btn);
            });
            fragment.appendChild(rowDiv);
        });

        keyboard.replaceChildren(fragment);
        console.log('✅ Keyboard rendered:', KB.currentLayout, '-', keyboard.children.length, 'rows');
    }

    // ============================================================
    // 🔢 DRAW NUMPAD
    // ============================================================
    function drawNumpad() {
        const keyboardNumpad = document.getElementById('keyboardNumpad');
        if (!keyboardNumpad) return;

        const defaultNumpad = [
            ['7', '8', '9'], ['4', '5', '6'],
            ['1', '2', '3'], ['0', '.', '⌫']
        ];
        const digits = (typeof numpadLayouts !== 'undefined' && numpadLayouts[KB.currentLayout])
            ? numpadLayouts[KB.currentLayout]
            : defaultNumpad;

        const fragment = document.createDocumentFragment();

        digits.forEach(row => {
            if (!Array.isArray(row)) return;

            const rDiv = document.createElement('div');
            rDiv.className = 'key-row';

            row.forEach(val => {
                const btn = document.createElement('button');
                btn.className = 'key';
                btn.setAttribute('data-key', val);
                btn.textContent = val;
                btn.onmousedown = (e) => e.preventDefault();
                btn.addEventListener('mouseenter', () => handleHoverSpeech(val));
                btn.onclick = () => {
                    if (val === '⌫') {
                        if (typeof doBackspace === 'function') doBackspace();
                    } else {
                        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(val);
                    }
                };
                rDiv.appendChild(btn);
            });
            fragment.appendChild(rDiv);
        });

        keyboardNumpad.replaceChildren(fragment);

        const names = {
            'olchiki': 'Ol Chiki (᱐-᱙)',
            'hindi-dev': 'Devanagari (०-९)',
            'santali-dev': 'Devanagari (०-९)',
            'roman': 'English (0-9)',
            'english': 'English (0-9)'
        };
        const numpadScriptTag = document.getElementById('numpad-script-tag');
        if (numpadScriptTag) {
            numpadScriptTag.textContent = `Numpad: ${names[KB.currentLayout] || names['english']}`;
        }
    }

    // ============================================================
    // 🔢 TOGGLE NUMPAD
    // ============================================================
    function toggleNumpad() {
        KB.isNumpadActive = !KB.isNumpadActive;

        const keyboardNumpad = document.getElementById('keyboardNumpad');
        if (keyboardNumpad) keyboardNumpad.classList.toggle('active', KB.isNumpadActive);

        const btn = document.getElementById('btn-numpad-toggle');
        if (btn) {
            btn.classList.toggle('active-state', KB.isNumpadActive);
            btn.textContent = '🔢';
            btn.title = KB.isNumpadActive ? 'Numpad: ON' : 'Numpad: OFF';
        }

        if (KB.isNumpadActive) drawNumpad();

        window.isNumpadActive = KB.isNumpadActive;
    }

    // ============================================================
    // ⇧ SHIFT / CAPS
    // ============================================================
    function toggleShift() {
        if (typeof playKeyClickSound === 'function') playKeyClickSound();
        KB.isShift = !KB.isShift;
        drawKeyboard();
    }

    function toggleCaps() {
        if (typeof playKeyClickSound === 'function') playKeyClickSound();
        KB.isCaps = !KB.isCaps;
        KB.isShift = KB.isCaps;
        drawKeyboard();
    }

    // ============================================================
    // ✨ FLASH KEY VISUAL
    // ============================================================
    function flashKeyVisual(keyChar) {
        try {
            if (typeof CSS !== 'undefined' && CSS.escape) {
                document.querySelectorAll(`.key[data-key="${CSS.escape(keyChar)}"]`)
                    .forEach(k => {
                        k.classList.add('key-active');
                        setTimeout(() => k.classList.remove('key-active'), 100);
                    });
            } else {
                document.querySelectorAll('.key').forEach(k => {
                    if (k.getAttribute('data-key') === keyChar) {
                        k.classList.add('key-active');
                        setTimeout(() => k.classList.remove('key-active'), 100);
                    }
                });
            }
        } catch (e) {}
    }

    // ============================================================
    // 💡 KEY HINT
    // ============================================================
    function getKeyHint(keyChar) {
        if (!keyChar) return '';

        if (/^F\d+$/.test(keyChar)) return 'Fn';
        if (keyChar === 'ESC') return 'Esc';
        if (keyChar === 'TAB') return 'Tab';
        if (keyChar === 'CAPS') return 'Caps';
        if (keyChar === 'SHIFT') return 'Shift';
        if (keyChar === 'BACKSPACE') return 'Backspace';
        if (keyChar === 'ENTER') return 'Enter';
        if (keyChar === 'SPACE') return 'Space';
        if (keyChar === 'LANG_SWITCH') return 'Switch';
        if (keyChar === 'ALTGR') return 'AltGr';
        if (keyChar === 'CTRL') return 'Ctrl';
        if (keyChar === 'ALT') return 'Alt';

        if (typeof symbolPhonics !== 'undefined' && symbolPhonics[keyChar]) {
            return `Symbol: ${keyChar}`;
        }

        if (KB.currentLayout === 'roman') {
            if (keyChar === 'ñ') return 'Alt+N';
            if (keyChar === 'Ñ') return 'Shift+N';
            return `Key: ${keyChar}`;
        }

        if (KB.currentLayout === 'olchiki') {
            const reverseMap = _buildOlchikiReverseMap();
            return `Key: ${reverseMap[keyChar] || keyChar}`;
        }

        if (typeof devMapHints !== 'undefined' && devMapHints[keyChar]) {
            return `Key: ${devMapHints[keyChar]}`;
        }

        return `Key: ${keyChar}`;
    }

    // ============================================================
    // 🎤 HOVER SPEECH
    // ============================================================
    function handleHoverSpeech(ch) {
        if (typeof isHoverVoiceEnabled === 'undefined' || !isHoverVoiceEnabled) return;

        const now = Date.now();
        if (now - KB._lastHoverSpeechTime < HOVER_SPEECH_THROTTLE_MS) return;
        KB._lastHoverSpeechTime = now;

        if (typeof speakLetter === 'function') speakLetter(ch);
    }

    // ============================================================
    // 🎨 MODIFIERS PANEL
    // ============================================================
    function renderModifiersPanel() {
        const container = document.getElementById('modifiers-container');
        const title = document.getElementById('modifiers-panel-title');
        if (!container) return;

        const titles = {
            'santali-dev': 'संताली देवनागरी संयुक्ताक्षर व मात्राएँ:',
            'hindi-dev': 'हिन्दी देवनागरी संयुक्ताक्षर व मात्राएँ:',
            'olchiki': 'संताली ओ़लचिकी चिह्नों व संख्या:',
            'roman': 'Roman Santali Accents, Diacritics & Modifiers:',
            'english': 'English Symbols, Typography & Currency:'
        };
        if (title) title.textContent = titles[KB.currentLayout] || 'Modifiers & Conjuncts:';

        const items = (typeof languageModifiersDB !== 'undefined' && languageModifiersDB[KB.currentLayout])
            ? languageModifiersDB[KB.currentLayout]
            : (typeof languageModifiersDB !== 'undefined' ? languageModifiersDB['english'] : []);

        if (!Array.isArray(items)) return;

        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            if (!item) return;

            const btn = document.createElement('button');
            btn.className = 'key-dia';
            btn.setAttribute('data-hint', item.hint || item.char || '');
            btn.textContent = item.label || item.char || '';
            btn.onmousedown = (e) => e.preventDefault();
            btn.onmouseenter = () => handleHoverSpeech(item.char || '');
            btn.onclick = () => {
                if (typeof addCharWithPhonics === 'function') {
                    addCharWithPhonics(item.char || '');
                }
            };
            fragment.appendChild(btn);
        });

        container.replaceChildren(fragment);
    }

    // ============================================================
    // 🗺️ MAPPING GUIDE
    // ============================================================
    const _MAPPING_GUIDES = {
        english: [
            { k: 'A-Z, 0-9', v: 'Physical Keys' },
            { k: 'Symbols', v: '`~@#$%^&*()' },
            { k: '/jh', v: 'Johar' },
            { k: '/sg', v: 'Sagun Daram' },
            { k: '/hl', v: 'Hello' }
        ],
        roman: [
            { k: 'Alt+N', v: 'ñ' },
            { k: 'Alt+Shift+N', v: 'Ñ' },
            { k: 'a̱ e̱ o̱', v: 'Low vowels' },
            { k: 'ḍ ṭ ṇ ṛ', v: 'Retroflex' },
            { k: 'ã ẽ ĩ', v: 'Nasal vowels' },
            { k: 'ā ē ō', v: 'Long vowels' },
            { k: '/jh', v: 'Johar' },
            { k: '/sg', v: 'Sagun' },
            { k: '/sn', v: 'Santal' },
            { k: '/hr', v: 'Hora' }
        ],
        'hindi-dev': [
            { k: 'k / Shift+K', v: 'क / ख' },
            { k: 'g / Shift+G', v: 'ग / घ' },
            { k: 'c / Shift+C', v: 'च / छ' },
            { k: 'j / Shift+J', v: 'ज / झ' },
            { k: 'Shift+Z', v: 'ञ' },
            { k: 't / Shift+T', v: 'त / ट' },
            { k: 'd / Shift+D', v: 'द / ड' },
            { k: 'p / Shift+P', v: 'प / फ' },
            { k: 'b / Shift+B', v: 'ब / भ' },
            { k: 'Shift+[', v: 'ऱ' },
            { k: 'q', v: '् (हलंत)' },
            { k: 'x', v: 'ं (अनुस्वार)' },
            { k: '/jh', v: 'नमस्ते' },
            { k: '/sg', v: 'शुभकामनाएं' }
        ],
        'santali-dev': [
            { k: 'k / Shift+K', v: 'क / ख' },
            { k: 'g / Shift+G', v: 'ग / घ' },
            { k: 'c / Shift+C', v: 'च / छ' },
            { k: 'j / Shift+J', v: 'ज / झ' },
            { k: 'Shift+Z', v: 'ञ' },
            { k: 'Shift+R / H', v: 'ड़ / ढ़' },
            { k: 'Shift+Z / W', v: 'ञ / ङ' },
            { k: 'Shift+[', v: 'ऱ' },
            { k: 'Key: ]', v: '़ (Nukta)' },
            { k: 'q', v: '् (हलंत)' },
            { k: 'x', v: 'ं (अनुस्वार)' },
            { k: '/jh', v: 'जोहार' },
            { k: '/sg', v: 'सगुन दाराम' },
            { k: '/sn', v: 'सांताड़' }
        ],
        'olchiki': [
            { k: 'q w e r', v: 'ᱚ ᱛ ᱜ ᱝ' },
            { k: 'a s d f', v: 'ᱤ ᱥ ᱦ ᱧ' },
            { k: 'z x c v', v: 'ᱮ ᱯ ᱰ ᱱ' },
            { k: 't y u i', v: 'ᱞ ᱟᱹ ᱠ ᱡ' },
            { k: 'o p g h', v: 'ᱢ ᱣ ᱨ ᱩ' },
            { k: 'j k l b', v: 'ᱪ ᱫ ᱬ ᱲ' },
            { k: 'n m', v: 'ᱳ ᱴ' },
            { k: 'kh, gh..', v: 'ᱠᱷ, ᱜᱷ' },
            { k: 'Shift 0-9', v: '᱐-᱙ Num' },
            { k: '/jh', v: 'ᱡᱚᱦᱟᱨ' },
            { k: '/sg', v: 'ᱥᱟᱹᱜᱩᱱ' }
        ]
    };

    // ============================================================
    // ✅ FIX #7: STRICT GENERATION CONTRACT
    // ============================================================
    // This function renders the mapping guide panel.
    //
    // @param {number} generation — Explicit generation number.
    //   Must be KB._mappingGeneration at time of capture.
    //
    //   Behavior:
    //     • If matches current → render
    //     • If stale (older) → skip silently (that's the point!)
    //     • If undefined → WARN + use current (backward compat)
    //
    // Why require generation?
    //   Retry timers from an OLD switchLanguage() call need to be
    //   skipped if a NEW switchLanguage() has since occurred. The
    //   generation number is the "epoch" that makes this detection
    //   possible. Without it, stale timers would re-render old data.
    // ============================================================
    function renderMappingGuide(generation) {
        // ─── Strict contract: require explicit generation ───
        const isExplicit = (generation !== undefined && generation !== null);

        if (!isExplicit) {
            console.warn(
                '⚠️ [keyboard] renderMappingGuide() called without generation. ' +
                'Using current gen (' + KB._mappingGeneration + '). ' +
                'Pass explicit generation for race-safety.'
            );
            generation = KB._mappingGeneration;
        }

        // ─── Stale check (only meaningful with explicit gen) ───
        if (generation !== KB._mappingGeneration) {
            console.log(
                '🗺️ [keyboard] Stale render skipped: ' +
                'passed gen ' + generation + ' vs current ' + KB._mappingGeneration
            );
            return;
        }

        const mappingInfo = document.getElementById('mapping-info');
        if (!mappingInfo) {
            console.warn('⚠️ [keyboard] mapping-info element not found');
            return;
        }

        const layout = KB.currentLayout;
        const guide = _MAPPING_GUIDES[layout] || [
            { k: 'Unknown', v: `Layout: ${layout}` },
            { k: 'Info', v: 'No mapping available' }
        ];

        const fragment = document.createDocumentFragment();
        guide.forEach(item => {
            const div = document.createElement('div');
            div.className = 'map-badge';

            const span1 = document.createElement('span');
            span1.textContent = item.k;

            const span2 = document.createElement('span');
            span2.textContent = item.v;

            div.appendChild(span1);
            div.appendChild(span2);
            fragment.appendChild(div);
        });

        mappingInfo.replaceChildren(fragment);
        console.log(
            '✅ [keyboard] Mapping guide rendered for:', layout,
            '-', guide.length, 'items',
            '(gen ' + generation + ')'
        );
    }

    // ============================================================
    // ✅ FIX #7: TIMER TRACKING HELPERS
    // ============================================================
    // Retry timers need to be tracked so they can be cancelled if
    // a new switchLanguage() invalidates them. But they ALSO need
    // to remove themselves after firing, otherwise the array grows
    // indefinitely (memory leak).
    // ============================================================

    function _trackRetryTimer(timerId) {
        if (timerId === null || timerId === undefined) return;
        KB._mappingRetryTimers.push(timerId);
    }

    function _untrackRetryTimer(timerId) {
        if (timerId === null || timerId === undefined) return;
        const idx = KB._mappingRetryTimers.indexOf(timerId);
        if (idx > -1) {
            KB._mappingRetryTimers.splice(idx, 1);
        }
    }

    function getPendingRetryCount() {
        return KB._mappingRetryTimers.length;
    }

    // ============================================================
    // ✅ FIX #7: CLEAR MAPPING RETRIES
    // ============================================================
    // Called at the START of each switchLanguage() to:
    //   1. Bump generation (invalidates all pending timers)
    //   2. Cancel all pending timers (they'd skip anyway, but
    //      cancelling is cheaper than letting them fire)
    //   3. Clear tracking array
    // ============================================================
    function _clearMappingRetries() {
        // ─── Bump generation FIRST ───
        // (any timer firing between here and clearTimeout() will
        //  detect stale generation and skip — race-safe)
        KB._mappingGeneration++;

        const pendingCount = KB._mappingRetryTimers.length;

        if (pendingCount > 0) {
            KB._mappingRetryTimers.forEach(t => {
                try { clearTimeout(t); } catch (e) {}
            });
            KB._mappingRetryTimers = [];

            console.log(
                '🔄 [keyboard] Cleared ' + pendingCount +
                ' pending retry timer(s). Generation now ' +
                KB._mappingGeneration
            );
        } else {
            console.log(
                '🔄 [keyboard] Generation bumped to ' +
                KB._mappingGeneration + ' (no pending timers)'
            );
        }
    }

    // ============================================================
    // 🔐 UNIFIED Pro Access (matches license.js)
    // ============================================================
    function _getProAccess() {
        try {
            if (typeof window.hasProLevelAccess === 'function') {
                return window.hasProLevelAccess() === true;
            }
        } catch (e) {}

        try {
            if (typeof isProLicensed !== 'undefined' && isProLicensed === true) {
                return true;
            }
        } catch (e) {}

        try {
            if (typeof TrialSystem !== 'undefined' &&
                typeof TrialSystem.isActive === 'function' &&
                TrialSystem.isActive() === true) {
                return true;
            }
        } catch (e) {}

        // ❌ Priority 4 REMOVED (v3.7.4.88 — SECURITY FIX)
        // localStorage fallback was exploitable — do NOT re-add.

        return false;
    }

    // ============================================================
    // 🔐 LANGUAGE SWITCH (race-safe)
    // ============================================================
    function switchLanguage(mode) {
        if (KB._switchInProgress) {
            console.warn('⚠️ Switch in progress');
            return;
        }

        if (!mode || typeof mode !== 'string') {
            console.warn('⚠️ Invalid mode:', mode);
            return;
        }

        if (!KEYBOARD_LANGUAGES.includes(mode)) {
            console.warn('⚠️ Invalid mode:', mode);
            return;
        }

        const hasProAccess = _getProAccess();

        if (mode !== 'english' && !hasProAccess) {
            if (typeof showToast === 'function') {
                showToast('🎁 Pro लाइसेंस या Trial आवश्यक है (₹9 में 7 दिन)', 'warning');
            } else {
                alert('Pro लाइसेंस या ₹9 Trial आवश्यक है।');
            }

            if (typeof openTrialActivationModal === 'function') {
                openTrialActivationModal();
            } else if (typeof openBuyModal === 'function') {
                openBuyModal();
            }
            return;
        }

        KB._switchInProgress = true;

        // ✅ FIX #7: Bumps generation + clears all pending timers
        _clearMappingRetries();

        try {
            KB.currentLayout = mode;
            KB.isShift = false;
            KB.isCaps = false;

            document.querySelectorAll('.tab-pill').forEach(btn => btn.classList.remove('active'));
            const tabEl = document.getElementById(`tab-${mode}`);
            if (tabEl) tabEl.classList.add('active');

            const titles = {
                'english': 'Default English',
                'roman': 'Santali (R)',
                'hindi-dev': 'हिन्दी',
                'santali-dev': 'Santali (D)',
                'olchiki': 'ओ़लचिकी'
            };
            const deckModeTitle = document.getElementById('deck-mode-title');
            if (deckModeTitle) {
                deckModeTitle.textContent = `Virtual Keyboard: ${titles[mode] || mode}`;
            }

            const deckContainer = document.querySelector('.keyboard-deck');
            if (deckContainer) {
                if (mode === 'hindi-dev' || mode === 'santali-dev') {
                    deckContainer.classList.add('dense-layout');
                } else {
                    deckContainer.classList.remove('dense-layout');
                }
            }

            // ─── Capture generation AFTER bump (this is "our" gen) ───
            const currentGen = KB._mappingGeneration;

            drawKeyboard();
            if (KB.isNumpadActive) drawNumpad();
            renderModifiersPanel();
            renderMappingGuide(currentGen);   // ✅ Explicit
            updateSuggestionBar();

            // ─── Schedule retries (with self-cleanup) ───
            // ✅ FIX #7: Timer removes itself from array after firing
            MAPPING_RETRY_DELAYS.forEach(delay => {
                const timer = setTimeout(() => {
                    // ✅ FIX #7: Self-cleanup FIRST
                    _untrackRetryTimer(timer);

                    try {
                        renderMappingGuide(currentGen);
                    } catch (e) {
                        console.warn('⚠️ [keyboard] Mapping retry failed:', e.message);
                    }
                }, delay);

                // ✅ FIX #7: Use helper for consistency
                _trackRetryTimer(timer);
            });

            if (typeof autoSyncLanguageFonts === 'function') autoSyncLanguageFonts(mode);
            if (typeof updateStatusLanguage === 'function') updateStatusLanguage(mode);

            if (typeof window.updateFocusBarHeading === 'function') {
                window.updateFocusBarHeading(mode);
            }

            window.currentLayout = mode;
            console.log(
                '✅ Language switched:', mode,
                '(gen ' + currentGen + ', ' +
                KB._mappingRetryTimers.length + ' retries pending)'
            );

        } catch (e) {
            console.error('❌ switchLanguage error:', e);
        } finally {
            KB._switchInProgress = false;
        }
    }

    // ============================================================
    // 🔄 CYCLE NEXT LANGUAGE
    // ============================================================
    function cycleNextLanguage() {
        const hasAccess = _getProAccess();
        const order = hasAccess ? KEYBOARD_LANGUAGES : ['english'];

        if (order.length <= 1) {
            if (typeof showToast === 'function') {
                showToast('🎁 Pro लाइसेंस या Trial आवश्यक है', 'warning');
            }
            return;
        }

        let idx = order.indexOf(KB.currentLayout);
        if (idx < 0) idx = 0;
        idx = (idx + 1) % order.length;

        switchLanguage(order[idx]);
    }

    // ============================================================
    // ⌨️ KEYBOARD PREFERENCE (virtual vs system)
    // ============================================================
    function setKeyboardPreference(mode) {
        KB.keyboardMode = (mode === 'system') ? 'system' : 'virtual';

        try {
            localStorage.setItem('hor_kb_mode', KB.keyboardMode);
        } catch (e) {}

        const btn = document.getElementById('btn-kb-choice');
        const statusText = document.getElementById('systemKbStatusText');
        const editor = document.getElementById('editor');

        if (KB.keyboardMode === 'system') {
            document.body.classList.add('system-keyboard-active');

            if (btn) {
                btn.textContent = 'System: 📱';
                btn.classList.add('system-mode');
            }

            if (editor) {
                editor.setAttribute('inputmode', 'text');
                editor.setAttribute('autocorrect', 'off');
                editor.setAttribute('autocapitalize', 'none');
                editor.setAttribute('spellcheck', 'false');
            }

            if (statusText) statusText.style.display = 'flex';
        } else {
            document.body.classList.remove('system-keyboard-active');

            if (btn) {
                btn.textContent = 'App Virtual: ⌨️';
                btn.classList.remove('system-mode');
            }

            if (editor) editor.setAttribute('inputmode', 'none');
            if (statusText) statusText.style.display = 'none';
        }

        if (typeof updateStatusKeyboard === 'function') updateStatusKeyboard(KB.keyboardMode);

        window.keyboardMode = KB.keyboardMode;
    }

    function toggleKeyboardPreference() {
        setKeyboardPreference(KB.keyboardMode === 'virtual' ? 'system' : 'virtual');

        setTimeout(() => {
            const editor = document.getElementById('editor');
            if (editor) editor.focus();
        }, 50);
    }

    // ============================================================
    // 💡 SUGGESTION BAR
    // ============================================================
    function getActiveWordList() {
        if (!KB.userVocabDB[KB.currentLayout] || !Array.isArray(KB.userVocabDB[KB.currentLayout])) {
            const defaults = (typeof defaultWordSuggestions !== 'undefined' &&
                             defaultWordSuggestions[KB.currentLayout])
                ? defaultWordSuggestions[KB.currentLayout]
                : ((typeof defaultWordSuggestions !== 'undefined' && defaultWordSuggestions['english'])
                    ? defaultWordSuggestions['english']
                    : []);

            KB.userVocabDB[KB.currentLayout] = [...defaults];
            saveVocabToStorage();
        }
        return KB.userVocabDB[KB.currentLayout];
    }

    function saveVocabToStorage() {
        clearTimeout(KB._vocabSaveDebounce);
        KB._vocabSaveDebounce = setTimeout(_saveVocabImmediate, VOCAB_SAVE_DEBOUNCE_MS);
    }

    function _saveVocabImmediate() {
        try {
            localStorage.setItem('hor_user_vocab_db', JSON.stringify(KB.userVocabDB));
        } catch (e) {
            console.warn('⚠️ Vocab save failed:', e.message);

            if (e.name === 'QuotaExceededError' || e.code === 22) {
                try {
                    const trimmed = {};
                    ['english', 'hindi-dev', 'olchiki'].forEach(k => {
                        if (KB.userVocabDB[k] && Array.isArray(KB.userVocabDB[k])) {
                            trimmed[k] = KB.userVocabDB[k].slice(0, 20);
                        }
                    });
                    localStorage.setItem('hor_user_vocab_db', JSON.stringify(trimmed));
                } catch (e2) {
                    try {
                        localStorage.removeItem('hor_user_vocab_db');
                    } catch (e3) {}
                }
            }
        }
    }

    function updateSuggestionBar() {
        const suggestionBar = document.getElementById('suggestionBar');
        if (!suggestionBar) return;

        const fragment = document.createDocumentFragment();

        const manageBtn = document.createElement('button');
        manageBtn.className = 'tool-btn';
        manageBtn.style.background = 'var(--primary)';
        manageBtn.style.color = '#fff';
        manageBtn.style.fontWeight = 'bold';
        manageBtn.style.padding = '1px 6px';
        manageBtn.textContent = '⚙️ Edit';
        manageBtn.onmousedown = (e) => e.preventDefault();
        manageBtn.onclick = openVocabManagerModal;
        fragment.appendChild(manageBtn);

        const list = getActiveWordList();
        list.slice(0, 30).forEach(w => {
            const chip = document.createElement('span');
            chip.className = 'sugg-chip';
            chip.textContent = w;
            chip.onmousedown = (e) => e.preventDefault();
            chip.onclick = () => {
                if (typeof addCharWithPhonics === 'function') {
                    addCharWithPhonics(w + ' ');
                }
            };
            fragment.appendChild(chip);
        });

        suggestionBar.replaceChildren(fragment);
    }

    // ============================================================
    // 📚 VOCAB MANAGER
    // ============================================================
    function openVocabManagerModal() {
        renderVocabManagerList();

        const modal = document.getElementById('vocabManagerModal');
        if (modal) modal.style.display = 'flex';

        const input = document.getElementById('newVocabInput');
        if (input) input.focus();
    }

    function closeVocabManagerModal() {
        const modal = document.getElementById('vocabManagerModal');
        if (modal) modal.style.display = 'none';
        updateSuggestionBar();
    }

    function saveNewVocabWord() {
        const inp = document.getElementById('newVocabInput');
        if (!inp) return;

        const word = (inp.value || '').trim();
        if (!word) return;

        if (word.length > 100) {
            alert('शब्द बहुत लंबा है (max 100 chars)');
            return;
        }

        const list = getActiveWordList();

        if (list.length >= VOCAB_MAX_PER_LANG) {
            alert(`Maximum ${VOCAB_MAX_PER_LANG} words allowed per language`);
            return;
        }

        if (!list.includes(word)) {
            list.unshift(word);
            saveVocabToStorage();
            inp.value = '';
            renderVocabManagerList();
            updateSuggestionBar();
        } else {
            alert(`"${word}" पहले से मौजूद है।`);
        }
    }

    function editCustomVocabWord(index) {
        const list = getActiveWordList();
        if (index < 0 || index >= list.length) return;

        const updated = prompt('शब्द एडिट करें:', list[index]);

        if (updated !== null) {
            const trimmed = updated.trim();
            if (trimmed && trimmed !== list[index] && trimmed.length <= 100) {
                list[index] = trimmed;
                saveVocabToStorage();
                renderVocabManagerList();
                updateSuggestionBar();
            }
        }
    }

    function deleteCustomVocabWord(index) {
        const list = getActiveWordList();
        if (index < 0 || index >= list.length) return;

        if (confirm(`"${list[index]}" को डिलीट करें?`)) {
            list.splice(index, 1);
            saveVocabToStorage();
            renderVocabManagerList();
            updateSuggestionBar();
        }
    }

    function resetActiveVocabToDefault() {
        const titles = {
            'english': 'English',
            'roman': 'Santali (R)',
            'hindi-dev': 'हिन्दी',
            'santali-dev': 'Santali (D)',
            'olchiki': 'ओ़लचिकी'
        };

        if (confirm(`क्या आप ${titles[KB.currentLayout]} के शब्द रीसेट करना चाहते हैं?`)) {
            const defaults = (typeof defaultWordSuggestions !== 'undefined' &&
                             defaultWordSuggestions[KB.currentLayout])
                ? defaultWordSuggestions[KB.currentLayout]
                : ((typeof defaultWordSuggestions !== 'undefined' && defaultWordSuggestions['english'])
                    ? defaultWordSuggestions['english']
                    : []);

            KB.userVocabDB[KB.currentLayout] = [...defaults];
            saveVocabToStorage();
            renderVocabManagerList();
            updateSuggestionBar();
        }
    }

    function renderVocabManagerList() {
        const container = document.getElementById('vocabListContainer');
        const countSpan = document.getElementById('customWordCount');
        if (!container) return;

        const list = getActiveWordList();
        if (countSpan) countSpan.textContent = list.length;

        const fragment = document.createDocumentFragment();

        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size:0.75rem; color:var(--text-muted); text-align:center; padding:15px 0;';
            empty.textContent = 'कोई शब्द नहीं है।';
            fragment.appendChild(empty);
        } else {
            list.forEach((word, idx) => {
                const row = document.createElement('div');
                row.className = 'vocab-item-row';

                const textSpan = document.createElement('span');
                textSpan.className = 'vocab-item-text';
                textSpan.textContent = word;
                row.appendChild(textSpan);

                const btnGroup = document.createElement('div');
                btnGroup.style.cssText = 'display:flex; gap:4px;';

                const editBtn = document.createElement('button');
                editBtn.className = 'tool-btn';
                editBtn.style.color = 'var(--primary)';
                editBtn.textContent = '✏️ Edit';
                editBtn.onclick = () => editCustomVocabWord(idx);
                btnGroup.appendChild(editBtn);

                const delBtn = document.createElement('button');
                delBtn.className = 'tool-btn';
                delBtn.style.color = '#d00';
                delBtn.textContent = '🗑️ Delete';
                delBtn.onclick = () => deleteCustomVocabWord(idx);
                btnGroup.appendChild(delBtn);

                row.appendChild(btnGroup);
                fragment.appendChild(row);
            });
        }

        container.replaceChildren(fragment);
    }

    // ============================================================
    // ✅ VOCAB FLUSH ON UNLOAD
    // ============================================================
    function _flushVocab(reason) {
        if (KB._vocabSaveDebounce) {
            clearTimeout(KB._vocabSaveDebounce);
            KB._vocabSaveDebounce = null;
            _saveVocabImmediate();
            if (reason) console.log('💾 [keyboard] Vocab flushed on ' + reason);
        }
    }

    window.addEventListener('beforeunload', () => _flushVocab('unload'));
    window.addEventListener('pagehide', () => _flushVocab(null));

    // ============================================================
    // 🌐 EXPOSE GLOBALLY
    // ============================================================
    Object.assign(window, {
        drawKeyboard, drawNumpad, toggleNumpad, toggleShift, toggleCaps,
        flashKeyVisual, getKeyHint, handleHoverSpeech,
        renderModifiersPanel, renderMappingGuide,
        switchLanguage, cycleNextLanguage,
        setKeyboardPreference, toggleKeyboardPreference,
        getActiveWordList, saveVocabToStorage, updateSuggestionBar,
        openVocabManagerModal, closeVocabManagerModal,
        saveNewVocabWord, editCustomVocabWord, deleteCustomVocabWord,
        resetActiveVocabToDefault, renderVocabManagerList,
        enterTypingMode, exitTypingMode, setupTypingFocusListeners,
        // ✅ FIX #7: New public helpers
        getPendingRetryCount: getPendingRetryCount
    });

    window.getCurrentLayout = () => KB.currentLayout;
    window.getKeyboardMode = () => KB.keyboardMode;
    window.isDesktopView = _isDesktopView;

    window.currentLayout = KB.currentLayout;
    window.keyboardMode = KB.keyboardMode;
    window.isNumpadActive = KB.isNumpadActive;

    // ============================================================
    // 📊 DEBUG HELPERS
    // ============================================================
    window.KeyboardDebug = {
        state: () => {
            console.log('═══════════════════════════════════════════');
            console.log('⌨️ Keyboard State');
            console.log('───────────────────────────────────────────');
            console.log('  Layout:', KB.currentLayout);
            console.log('  Mode:', KB.keyboardMode);
            console.log('  Shift:', KB.isShift);
            console.log('  Caps:', KB.isCaps);
            console.log('  Numpad:', KB.isNumpadActive);
            console.log('  Pro access:', _getProAccess());
            console.log('  Vocab loaded:', Object.keys(KB.userVocabDB).length, 'languages');
            console.log('  Focus mode:', document.body.classList.contains('typing-focus'));
            console.log('  Mapping generation:', KB._mappingGeneration);
            console.log('  Pending retries:', KB._mappingRetryTimers.length);  // ✅ FIX #7
            console.log('  Desktop mode:', _isDesktopMode);
            console.log('  Window width:', window.innerWidth + 'px');
            console.log('═══════════════════════════════════════════');
        },
        render: () => {
            drawKeyboard();
            console.log('✅ Keyboard re-rendered');
        },
        vocab: () => {
            console.table(Object.keys(KB.userVocabDB).map(k => ({
                language: k,
                wordCount: Array.isArray(KB.userVocabDB[k]) ? KB.userVocabDB[k].length : 0
            })));
        },
        resetVocab: () => {
            KB.userVocabDB = {};
            try { localStorage.removeItem('hor_user_vocab_db'); } catch (e) {}
            updateSuggestionBar();
            console.log('🔄 Vocab DB reset');
        },
        switchTo: (lang) => {
            switchLanguage(lang);
            console.log('🔄 Switched to:', lang);
        },
        testMappingGuide: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 MAPPING GUIDE TEST');
            console.log('═══════════════════════════════════════════');
            console.log('  Element exists:', !!document.getElementById('mapping-info'));
            console.log('  Current layout:', KB.currentLayout);
            console.log('  Current generation:', KB._mappingGeneration);

            renderMappingGuide(KB._mappingGeneration);

            const el = document.getElementById('mapping-info');
            if (el) {
                const items = el.querySelectorAll('.map-badge');
                console.log('  Badges rendered:', items.length);
                for (let i = 0; i < Math.min(3, items.length); i++) {
                    console.log(`    [${i}]`, items[i].textContent);
                }
            }
            console.log('═══════════════════════════════════════════');
        },
        testAllLanguages: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 TESTING MAPPING GUIDE FOR ALL LANGUAGES');
            console.log('═══════════════════════════════════════════');

            KEYBOARD_LANGUAGES.forEach(lang => {
                KB.currentLayout = lang;
                renderMappingGuide(KB._mappingGeneration);
                const el = document.getElementById('mapping-info');
                const items = el ? el.querySelectorAll('.map-badge').length : 0;
                console.log(`  ${lang}: ${items} badges rendered`);
            });
            console.log('✅ Test complete');
            console.log('═══════════════════════════════════════════');
        },

        // ============================================================
        // ✅ FIX #7: Test that retry timers clean up properly
        // ============================================================
        testMemoryLeak: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 RETRY TIMER MEMORY LEAK TEST (FIX #7)');
            console.log('═══════════════════════════════════════════');

            const initialCount = KB._mappingRetryTimers.length;
            console.log('  Initial pending timers:', initialCount);
            console.log('');

            // Trigger 5 rapid switches
            console.log('  Triggering 5 rapid switchLanguage() calls...');
            const langs = ['english', 'hindi-dev', 'english', 'olchiki', 'english'];

            langs.forEach((lang, i) => {
                setTimeout(() => {
                    // Only switch if has access
                    if (lang === 'english' || _getProAccess()) {
                        KB.currentLayout = 'english'; // force to allow
                        switchLanguage(lang);
                    } else {
                        console.log(`  [${i}] Skipped ${lang} (no pro access)`);
                    }
                }, i * 50);
            });

            // Check after all timers should have fired
            setTimeout(() => {
                const finalCount = KB._mappingRetryTimers.length;

                console.log('');
                console.log('  After 5 switches + 1s wait:');
                console.log('    Pending timers:', finalCount);
                console.log('    Expected: 0 (all fired + self-cleaned)');

                const pass = finalCount === 0;

                console.log('');
                console.log('  Result:', pass ? '✅ PASS (no leak)' : '❌ FAIL (leak detected)');
                console.log('═══════════════════════════════════════════');

                return { initialCount, finalCount, pass };
            }, 1500);
        },

        testRaceSafeRetry: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 RACE-SAFE RETRY TEST');
            console.log('═══════════════════════════════════════════');
            console.log('  Generation before:', KB._mappingGeneration);
            console.log('  Pending retries:', KB._mappingRetryTimers.length);

            for (let i = 0; i < 5; i++) _clearMappingRetries();

            console.log('  Generation after 5× clears:', KB._mappingGeneration);
            console.log('  Pending retries:', KB._mappingRetryTimers.length);
            console.log('  Result:',
                KB._mappingGeneration >= 5 && KB._mappingRetryTimers.length === 0
                    ? '✅ PASS' : '❌ FAIL');
            console.log('═══════════════════════════════════════════');
        },

        // ============================================================
        // ✅ FIX #7: Test stale render detection
        // ============================================================
        testStaleRender: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 STALE RENDER DETECTION TEST');
            console.log('═══════════════════════════════════════════');

            const currentGen = KB._mappingGeneration;
            console.log('  Current generation:', currentGen);

            // 1) Valid generation — should render
            console.log('');
            console.log('  Test 1: Render with current gen (' + currentGen + ')');
            renderMappingGuide(currentGen);
            console.log('    ✅ Rendered (see log above)');

            // 2) Stale generation — should skip
            console.log('');
            console.log('  Test 2: Render with stale gen (' + (currentGen - 1) + ')');
            renderMappingGuide(currentGen - 1);
            console.log('    ✅ Skipped (see log above)');

            // 3) Future generation — should skip
            console.log('');
            console.log('  Test 3: Render with future gen (' + (currentGen + 5) + ')');
            renderMappingGuide(currentGen + 5);
            console.log('    ✅ Skipped (see log above)');

            // 4) No generation — should warn + use current
            console.log('');
            console.log('  Test 4: Render with NO gen (should warn + render)');
            renderMappingGuide();
            console.log('    ✅ Warned + rendered (see log above)');

            console.log('');
            console.log('  Expected:');
            console.log('    • Test 1 renders');
            console.log('    • Tests 2 & 3 skip silently');
            console.log('    • Test 4 warns but renders');
            console.log('═══════════════════════════════════════════');
        },

        testDefaultGeneration: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 DEFAULT GENERATION TEST');
            console.log('═══════════════════════════════════════════');

            const before = KB._mappingGeneration;
            console.log('  Current generation:', before);
            console.log('  Calling renderMappingGuide() with NO args...');
            console.log('  (Should log warning but not crash)');

            renderMappingGuide();

            const after = KB._mappingGeneration;
            console.log('');
            console.log('  Generation after:', after);
            console.log('  Result:', before === after ? '✅ PASS (no crash, no bump)' : '⚠️ Review');
            console.log('═══════════════════════════════════════════');
        },

        testVocabFlush: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 VOCAB FLUSH TEST');
            console.log('═══════════════════════════════════════════');
            console.log('  Debounce timer pending:', !!KB._vocabSaveDebounce);

            const list = getActiveWordList();
            list.push('TESTWORD_' + Date.now());
            saveVocabToStorage();
            console.log('  After saveVocabToStorage: pending =', !!KB._vocabSaveDebounce);

            _flushVocab('test');
            console.log('  After flush: pending =', !!KB._vocabSaveDebounce);

            try {
                const saved = localStorage.getItem('hor_user_vocab_db');
                const hasTestWord = saved && saved.includes('TESTWORD_');
                console.log('  Test word in storage:', hasTestWord ? '✅' : '❌');
                if (hasTestWord) {
                    list.pop();
                    _saveVocabImmediate();
                }
            } catch (e) {
                console.log('  Storage check failed:', e.message);
            }
            console.log('═══════════════════════════════════════════');
        },

        testProAccessBypass: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 PRO ACCESS BYPASS TEST (v3.7.4.88)');
            console.log('═══════════════════════════════════════════');

            const savedLicKey = localStorage.getItem('hor_lic_key');
            const savedTrialKey = localStorage.getItem('hor_trial_key');

            try {
                localStorage.setItem('hor_lic_key', 'HKP-P1-9999-' + 'A'.repeat(128));
                localStorage.setItem('hor_trial_key', 'HKT-1234567-ABCD');

                console.log('  Fake keys inserted into localStorage');
                console.log('  Calling _getProAccess()...');

                const result = _getProAccess();
                console.log('');
                console.log('  Result:', result);
                console.log('  Expected: false (no verified session)');
                console.log('  Verdict:', result === false ? '✅ PASS (bypass blocked)' : '❌ FAIL (bypass!)');
            } finally {
                if (savedLicKey) localStorage.setItem('hor_lic_key', savedLicKey);
                else localStorage.removeItem('hor_lic_key');
                if (savedTrialKey) localStorage.setItem('hor_trial_key', savedTrialKey);
                else localStorage.removeItem('hor_trial_key');
            }
            console.log('═══════════════════════════════════════════');
        },

        selfTest: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 KEYBOARD SELF-TEST (v3.7.4.90)');
            console.log('═══════════════════════════════════════════');

            const checks = {
                drawKeyboard: typeof drawKeyboard === 'function',
                drawNumpad: typeof drawNumpad === 'function',
                switchLanguage: typeof switchLanguage === 'function',
                _getProAccess: typeof _getProAccess === 'function',
                renderMappingGuide: typeof renderMappingGuide === 'function',
                renderModifiersPanel: typeof renderModifiersPanel === 'function',
                setupTypingFocusListeners: typeof setupTypingFocusListeners === 'function',
                updateSuggestionBar: typeof updateSuggestionBar === 'function',
                openVocabManagerModal: typeof openVocabManagerModal === 'function',
                _flushVocab: typeof _flushVocab === 'function',
                // ✅ FIX #7: New helpers
                _trackRetryTimer: typeof _trackRetryTimer === 'function',
                _untrackRetryTimer: typeof _untrackRetryTimer === 'function',
                getPendingRetryCount: typeof getPendingRetryCount === 'function'
            };

            Object.entries(checks).forEach(([key, pass]) => {
                console.log(`  ${pass ? '✅' : '❌'} ${key}`);
            });

            console.log('');
            console.log('🆕 FIX #7 additions:');
            console.log('  • _trackRetryTimer() — safe tracking');
            console.log('  • _untrackRetryTimer() — self-cleanup');
            console.log('  • getPendingRetryCount() — debug helper');
            console.log('  • renderMappingGuide() — strict contract');
            console.log('  • testMemoryLeak() — verify no leak');
            console.log('  • testStaleRender() — verify staleness');
            console.log('  • testRaceSafeRetry() — enhanced');

            const allPass = Object.values(checks).every(v => v);
            console.log('');
            console.log(allPass ? '🎉 ALL FUNCTIONS PRESENT' : '⚠️ SOME MISSING');
            console.log('═══════════════════════════════════════════');

            return checks;
        }
    };

    // ============================================================
    // 🚀 INITIAL RENDER
    // ============================================================
    function initialRender() {
        try {
            drawKeyboard();
            if (KB.isNumpadActive) drawNumpad();
            renderModifiersPanel();
            renderMappingGuide(KB._mappingGeneration);   // ✅ Explicit
            updateSuggestionBar();

            setupTypingFocusListeners();

            const numpadBtn = document.getElementById('btn-numpad-toggle');
            if (numpadBtn) {
                numpadBtn.classList.toggle('active-state', KB.isNumpadActive);
                numpadBtn.title = KB.isNumpadActive ? 'Numpad: ON' : 'Numpad: OFF';
            }

            const numpadDeck = document.getElementById('keyboardNumpad');
            if (numpadDeck) numpadDeck.classList.toggle('active', KB.isNumpadActive);

            console.log('✅ Initial keyboard render complete');
        } catch (e) {
            console.error('❌ Initial render failed:', e);
        }
    }

    _ready(initialRender, 100);

    // Fallback retry if keyboard empty
    setTimeout(() => {
        const kb = document.getElementById('keyboard');
        if (kb && kb.children.length === 0) {
            console.log('🔄 Keyboard empty — retrying render');
            initialRender();
        }
    }, 1500);

    window.addEventListener('app-ready', () => {
        setTimeout(setupTypingFocusListeners, 300);
        setTimeout(() => {
            try { renderMappingGuide(KB._mappingGeneration); } catch (e) {}
        }, 500);
    });

    // ============================================================
    // 📋 STARTUP LOG
    // ============================================================
    console.log('═══════════════════════════════════════════');
    console.log('✅ keyboard.js loaded — v3.7.4.90 (FIX #7)');
    console.log('   ⌨️  Layouts:', KEYBOARD_LANGUAGES.length);
    console.log('   🎯 Breakpoint:', _DESKTOP_BREAKPOINT_PX + 'px');
    console.log('   🔐 Pro access: verified-only');
    console.log('   📦 Namespace: KB object');
    console.log('   ✅ FIXED: Race-safe mapping retries (generation)');
    console.log('   ✅ FIXED: renderMappingGuide() defaults generation');
    console.log('   ✅ FIXED: Dead state removed');
    console.log('   ✅ FIXED: _ready() helper for DOM init');
    console.log('   ✅ FIXED: Consolidated _flushVocab()');
    console.log('   ✅ FIXED: Mapping guides as lookup table');
    console.log('   ✅ FIXED: Object.assign for globals');
    console.log('   ✅ FIXED: _getProAccess() localStorage fallback REMOVED');
    console.log('   🆕 FIX #7: Retry timers self-cleanup (no memory leak)');
    console.log('   🆕 FIX #7: Strict generation contract');
    console.log('   🆕 FIX #7: _trackRetryTimer() / _untrackRetryTimer()');
    console.log('   🆕 FIX #7: getPendingRetryCount() helper');
    console.log('   🧪 KeyboardDebug.testMemoryLeak() ← NEW');
    console.log('   🧪 KeyboardDebug.testStaleRender() ← NEW');
    console.log('   🧪 KeyboardDebug.testRaceSafeRetry()');
    console.log('   🧪 KeyboardDebug.testProAccessBypass()');
    console.log('═══════════════════════════════════════════');

})();