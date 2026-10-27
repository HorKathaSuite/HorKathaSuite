// ============================================================
// 🚀 APP.JS — Main Boot + Multi-Language TTS + Voice Selection
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ FIX #3 APPLIED — Hindi Phonetic TTS + Recognition + Focus
//    • _getTTSConfig: hindi-phonetic → hindi-dev config
//    • _getRecognitionLang: hindi-phonetic → hi-IN
//    • _FOCUS_HEADINGS: hindi-phonetic heading added
// ============================================================

window.__appReady = false;

// ============================================================
// 🎨 INJECT TTS HIGHLIGHT CSS
// ============================================================
(function injectHighlightCSS() {
    try {
        if (!document.getElementById('tts-highlight-style')) {
            const style = document.createElement('style');
            style.id = 'tts-highlight-style';
            style.textContent = `
                #editor ::selection { background: rgba(251, 191, 36, 0.55); color: inherit; }
                #editor::-moz-selection { background: rgba(251, 191, 36, 0.55); color: inherit; }
            `;
            (document.head || document.documentElement).appendChild(style);
        }
    } catch (e) {}
})();

// ============================================================
// 🛡️ GLOBAL ERROR BOUNDARIES
// ============================================================
window.addEventListener('error', (ev) => {
    try { console.error('💥 Uncaught error:', ev.message, ev.filename + ':' + ev.lineno); } catch (e) {}
});
window.addEventListener('unhandledrejection', (ev) => {
    try { console.error('💥 Unhandled rejection:', ev.reason); } catch (e) {}
});

// ============================================================
// 🛠️ OPTIONAL-CALL HELPER
// ============================================================
function _call(fnName, ...args) {
    try {
        const fn = window[fnName];
        if (typeof fn === 'function') return fn(...args);
    } catch (e) {
        const isPackaged = window.electronAPI && window.electronAPI.isPackaged;
        if (!isPackaged) console.warn(`_call('${fnName}') failed:`, e.message);
    }
    return undefined;
}

// ============================================================
// 🧰 UTILITIES
// ============================================================
function _throttle(fn, waitMs) {
    let last = 0, timer = null, lastArgs = null;
    return function(...args) {
        lastArgs = args;
        const now = Date.now();
        const remaining = waitMs - (now - last);
        if (remaining <= 0) {
            last = now;
            fn.apply(this, args);
        } else if (!timer) {
            timer = setTimeout(() => {
                last = Date.now();
                timer = null;
                fn.apply(this, lastArgs);
            }, remaining);
        }
    };
}

function _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
}

// ============================================================
// 🎤 SPEECH RECOGNITION STATE
// ============================================================
let recognition = null;
let isListening = false;
let _recognitionRestartCount = 0;
const MAX_RECOGNITION_RESTARTS = 5;
let _lastRecognitionLang = null;
let _recognitionIntentionalStop = false;
let _recognitionBackoffMs = 200;
const RECOGNITION_MAX_BACKOFF_MS = 5000;

// ============================================================
// 🔊 TTS STATE
// ============================================================
let _ttsState = {
    speaking: false,
    paused: false,
    selectedVoiceName: null,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    _activeUtterance: null,
    _speakSession: 0,
    _textHash: null,
    _chunks: [],
    _currentChunkIdx: 0,
    _chunkOffset: 0,
    _resumeOnSpeak: false,
    highlightEnabled: true,
    _highlightSelection: null
};

const TTS_LANGUAGE_CONFIG = {
    'english': {
        lang: 'en-US',
        fallbacks: ['en-US', 'en-GB', 'en-IN', 'en'],
        chunkSize: 180, rate: 1.0, pitch: 1.0, label: 'English'
    },
    'roman': {
        lang: 'en-IN',
        fallbacks: ['en-IN', 'en-US', 'en-GB', 'en'],
        chunkSize: 180, rate: 0.95, pitch: 1.0, label: 'Santali (Roman)'
    },
    'hindi-dev': {
        lang: 'hi-IN',
        fallbacks: ['hi-IN', 'en-IN', 'en-US', 'en'],
        chunkSize: 150, rate: 0.95, pitch: 1.0, label: 'हिन्दी'
    },
    'santali-dev': {
        lang: 'hi-IN',
        fallbacks: ['hi-IN', 'en-IN', 'en-US', 'en'],
        chunkSize: 150, rate: 0.9, pitch: 1.0, label: 'Santali (Devanagari)'
    },
    'olchiki': {
        lang: 'sat-IN',
        fallbacks: ['sat-IN', 'hi-IN', 'en-IN', 'en-US', 'en'],
        chunkSize: 140, rate: 0.85, pitch: 1.0, label: 'Ol Chiki'
    }
};

let _voiceCache = null;
let _voiceCacheTimestamp = 0;
const VOICE_CACHE_TTL_MS = 60000;
const MAX_VOICES_TO_SHOW = 30;
const MAX_RECOMMENDED_VOICES = 12;

let _timeUpdateInterval = null;
let _voiceSearchDebounce = null;
const VOICE_SEARCH_DEBOUNCE_MS = 150;

// ============================================================
// 💾 TTS SETTINGS
// ============================================================
function loadTTSSettings() {
    try {
        const saved = localStorage.getItem('hor_tts_settings');
        if (!saved) return;
        const s = JSON.parse(saved);

        if (s.voiceName) _ttsState.selectedVoiceName = s.voiceName;
        if (typeof s.rate === 'number' && s.rate >= 0.5 && s.rate <= 2) _ttsState.rate = s.rate;
        if (typeof s.pitch === 'number' && s.pitch >= 0.5 && s.pitch <= 1.5) _ttsState.pitch = s.pitch;
        if (typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1) _ttsState.volume = s.volume;
        if (typeof s.highlightEnabled === 'boolean') _ttsState.highlightEnabled = s.highlightEnabled;

        console.log('✅ TTS settings loaded:', {
            voice: s.voiceName || 'auto',
            rate: _ttsState.rate,
            pitch: _ttsState.pitch,
            volume: _ttsState.volume,
            highlight: _ttsState.highlightEnabled
        });
    } catch (e) {
        console.warn('TTS settings load failed:', e.message);
    }
}

function _saveTTSSettingsImmediate() {
    try {
        localStorage.setItem('hor_tts_settings', JSON.stringify({
            voiceName: _ttsState.selectedVoiceName,
            rate: _ttsState.rate,
            pitch: _ttsState.pitch,
            volume: _ttsState.volume,
            highlightEnabled: _ttsState.highlightEnabled
        }));
    } catch (e) {
        console.warn('TTS settings save failed:', e.message);
    }
}

const _saveTTSSettingsThrottled = _throttle(_saveTTSSettingsImmediate, 500);

function saveTTSSettings(immediate = false) {
    if (immediate === true) _saveTTSSettingsImmediate();
    else _saveTTSSettingsThrottled();
}

// ============================================================
// 🔐 PRO ACCESS CHECK
// ============================================================
function _hasProAccess() {
    if (typeof window.hasProLevelAccess === 'function') {
        try { return window.hasProLevelAccess() === true; } catch (e) {}
    }
    try {
        if (typeof isProLicensed !== 'undefined' && isProLicensed === true) return true;
    } catch (e) {}
    try {
        if (typeof APP_CONFIG !== 'undefined' &&
            APP_CONFIG.TRIAL_ENABLED === true &&
            typeof TrialSystem !== 'undefined' &&
            TrialSystem.isActive() === true) return true;
    } catch (e) {}
    return false;
}

// ============================================================
// 🔊 TTS SPEAKING STATE
// ============================================================
function isTTSSpeaking() {
    try {
        if (typeof window.speechSynthesis !== 'undefined') {
            if (window.speechSynthesis.speaking === true) return true;
            if (window.speechSynthesis.paused === true) return true;
        }
        return _ttsState.speaking && !_ttsState.paused;
    } catch (e) {
        return _ttsState.speaking;
    }
}

// ============================================================
// 🎯 FOCUS MODE BAR
// ✅ FIX #3: hindi-phonetic entry added
// ============================================================
const _FOCUS_HEADINGS = {
    'english':        { icon: '🇬🇧', text: 'English',              badge: 'ENG' },
    'roman':          { icon: '🅰️', text: 'Santali (Roman)',       badge: 'SAT-R' },
    'hindi-dev':      { icon: '🇮🇳', text: 'हिन्दी',                badge: 'HIN' },
    'hindi-phonetic': { icon: '✨',  text: 'हिन्दी ✨',              badge: 'HIN-P' },
    'santali-dev':    { icon: '🇮🇳', text: 'Santali (Devanagari)',  badge: 'SAT-D' },
    'olchiki':        { icon: 'ᱚ',  text: 'ओ़लचिकी / Ol Chiki',    badge: 'OLC' }
};

function updateFocusBarHeading(layout) {
    const textEl = document.getElementById('focusHeadingText');
    if (!textEl) return;
    const data = _FOCUS_HEADINGS[layout] || _FOCUS_HEADINGS['english'];
    const iconEl = document.getElementById('focusHeadingIcon');
    const badgeEl = document.getElementById('focusHeadingBadge');
    if (iconEl) iconEl.textContent = data.icon;
    textEl.textContent = data.text;
    if (badgeEl) badgeEl.textContent = data.badge;
    console.log('🎯 Focus heading updated:', data.text);
}
window.updateFocusBarHeading = updateFocusBarHeading;

// ============================================================
// 🎤 SPEECH RECOGNITION
// ============================================================
function _resetMicButton() {
    const btn = document.getElementById('btn-mic');
    if (btn) {
        btn.classList.remove('active-state', 'listening');
        btn.textContent = '🎤 Mic';
    }
}

function toggleSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
        alert('Browser does not support Speech Recognition.\n\nKripya Chrome/Edge use karein.');
        return;
    }

    const btn = document.getElementById('btn-mic');

    if (!recognition) {
        try {
            recognition = new SpeechRec();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = _getRecognitionLang();
            _lastRecognitionLang = recognition.lang;

            recognition.onresult = (e) => {
                try {
                    const transcript = e.results[e.results.length - 1][0].transcript;
                    if (transcript.trim()) _call('addChar', transcript + ' ');
                } catch (err) {
                    console.warn('Recognition result error:', err);
                }
            };

            recognition.onend = () => {
                if (_recognitionIntentionalStop) {
                    isListening = false;
                    _recognitionIntentionalStop = false;
                    _recognitionRestartCount = 0;
                    _recognitionBackoffMs = 200;
                    _resetMicButton();
                    return;
                }
                if (isListening && _recognitionRestartCount < MAX_RECOGNITION_RESTARTS) {
                    _recognitionRestartCount++;
                    const delay = Math.min(_recognitionBackoffMs, RECOGNITION_MAX_BACKOFF_MS);
                    _recognitionBackoffMs *= 1.5;
                    console.log(`🎤 Recognition restart in ${delay}ms (attempt ${_recognitionRestartCount})`);
                    setTimeout(() => {
                        if (!isListening) return;
                        try {
                            recognition.lang = _getRecognitionLang();
                            recognition.start();
                        } catch (e) {
                            console.warn('Restart failed:', e.message);
                        }
                    }, delay);
                    return;
                }
                isListening = false;
                _recognitionRestartCount = 0;
                _recognitionBackoffMs = 200;
                _resetMicButton();
            };

            recognition.onerror = (e) => {
                console.warn('Speech recognition error:', e.error);
                if (e.error === 'no-speech' || e.error === 'aborted') return;

                if (e.error === 'network' && isListening &&
                    _recognitionRestartCount < MAX_RECOGNITION_RESTARTS) {
                    _recognitionRestartCount++;
                    const delay = Math.min(_recognitionBackoffMs, RECOGNITION_MAX_BACKOFF_MS);
                    _recognitionBackoffMs *= 1.5;
                    _call('showToast', `🔁 Network hiccup — retrying in ${Math.round(delay / 1000)}s`, 'info', 2000);
                    setTimeout(() => {
                        if (!isListening) return;
                        try { recognition.start(); } catch (err) {}
                    }, delay);
                    return;
                }

                isListening = false;
                _recognitionIntentionalStop = false;
                _recognitionRestartCount = 0;
                _recognitionBackoffMs = 200;
                _resetMicButton();

                const errorMessages = {
                    'not-allowed': 'माइक permission denied. Browser settings check करें।',
                    'service-not-allowed': 'Speech service unavailable. Internet check करें।',
                    'audio-capture': 'माइक नहीं मिला। Device check करें।',
                    'network': 'Network error. Internet check करें।',
                    'language-not-supported': 'यह language supported नहीं है।'
                };
                const msg = errorMessages[e.error] || 'Recognition error: ' + e.error;
                _call('showToast', msg, 'error', 4000);
            };
        } catch (initErr) {
            console.error('Recognition init failed:', initErr);
            alert('Recognition init failed: ' + initErr.message);
            return;
        }
    }

    if (!isListening) {
        _recognitionIntentionalStop = false;
        _recognitionBackoffMs = 200;
        const newLang = _getRecognitionLang();
        recognition.lang = newLang;
        _lastRecognitionLang = newLang;
        _recognitionRestartCount = 0;

        try {
            recognition.start();
            isListening = true;
            if (btn) {
                btn.classList.add('active-state', 'listening');
                btn.textContent = '🔴 Listening...';
            }
        } catch (e) {
            console.warn('Recognition start failed:', e.message);
            isListening = false;
            _call('showToast', 'Mic start failed. Thoda wait करें।', 'warning', 3000);
        }
    } else {
        _recognitionIntentionalStop = true;
        try { recognition.stop(); } catch (e) {}
        isListening = false;
        _recognitionRestartCount = 0;
        _resetMicButton();
    }
}

// ✅ FIX #3: hindi-phonetic → hi-IN
function _getRecognitionLang() {
    try {
        const layout = window.currentLayout || 'english';
        const map = {
            'hindi-dev': 'hi-IN',
            'hindi-phonetic': 'hi-IN',
            'santali-dev': 'hi-IN',
            'olchiki': 'sat-IN',
            'roman': 'en-IN'
        };
        return map[layout] || 'en-US';
    } catch (e) {
        return 'en-US';
    }
}

// ============================================================
// 🎯 VOICE CACHE & SELECTION
// ============================================================
function _getVoicesCached() {
    const now = Date.now();
    if (_voiceCache && (now - _voiceCacheTimestamp) < VOICE_CACHE_TTL_MS) {
        return _voiceCache;
    }
    try {
        const voices = speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
            _voiceCache = voices;
            _voiceCacheTimestamp = now;
        }
        return voices || [];
    } catch (e) {
        return [];
    }
}

function _invalidateVoiceCache() {
    _voiceCache = null;
    _voiceCacheTimestamp = 0;
}

// ✅ FIX #3: hindi-phonetic → hindi-dev config (Devanagari voice)
function _getTTSConfig() {
    const layout = window.currentLayout || 'english';
    if (layout === 'hindi-phonetic') return TTS_LANGUAGE_CONFIG['hindi-dev'];
    return TTS_LANGUAGE_CONFIG[layout] || TTS_LANGUAGE_CONFIG['english'];
}

function getSelectedVoice() {
    const voices = _getVoicesCached();
    if (!voices || voices.length === 0) return null;

    const config = _getTTSConfig();

    if (_ttsState.selectedVoiceName) {
        const selected = voices.find(v => v.name === _ttsState.selectedVoiceName);
        if (selected) {
            console.log('🎯 Using user-selected voice:', selected.name);
            return selected;
        } else {
            console.warn('⚠️ Selected voice not found — clearing');
            _ttsState.selectedVoiceName = null;
            saveTTSSettings();
        }
    }

    for (const lang of config.fallbacks) {
        let voice = voices.find(v => v.lang === lang && v.localService === true);
        if (voice) {
            console.log('🎯 Found local voice:', voice.name, '(' + voice.lang + ')');
            return voice;
        }
        voice = voices.find(v => v.lang === lang || v.lang.startsWith(lang.split('-')[0]));
        if (voice) {
            console.log('🎯 Found voice:', voice.name, '(' + voice.lang + ')');
            return voice;
        }
    }

    const anyVoice = voices[0];
    console.log('⚠️ Fallback to any voice:', anyVoice.name);
    return anyVoice;
}

// ============================================================
// 🎯 VOICE QUALITY SCORING
// ============================================================
function _scoreVoice(v) {
    if (!v) return 0;
    let score = 0;
    const name = (v.name || '').toLowerCase();
    const lang = (v.lang || '').toLowerCase();

    if (v.localService === true) score += 100;
    else score += 30;

    ['natural', 'premium', 'enhanced', 'neural', 'neural2', 'wavenet', 'studio']
        .forEach(kw => { if (name.includes(kw)) score += 25; });

    if (name.includes('microsoft')) score += 12;
    if (name.includes('google')) score += 12;
    if (name.includes('apple')) score += 12;
    if (name.includes('siri')) score += 15;

    if (name.includes('ravi') || name.includes('heera')) score += 8;
    if (name.includes('swara') || name.includes('madhur')) score += 8;
    if (name.includes('samantha')) score += 8;

    if (v.default === true) score += 20;

    if (lang.startsWith('en-us')) score += 5;
    if (lang.startsWith('en-gb')) score += 4;
    if (lang.startsWith('en-in')) score += 6;
    if (lang.startsWith('hi-in')) score += 6;

    return score;
}

// ============================================================
// 🎯 Get Top voices
// ============================================================
function _getTopVoices(allVoices, config, maxCount = MAX_VOICES_TO_SHOW) {
    if (!allVoices || allVoices.length === 0) {
        return { recommended: [], other: [] };
    }

    const langPrefix = config.lang.split('-')[0];
    const seen = new Set();
    const uniqueVoices = allVoices.filter(v => {
        if (!v || !v.name) return false;
        const key = `${v.name}|${v.lang}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const currentLangLocal = [];
    const currentLangOnline = [];
    const englishVoices = [];
    const hindiVoices = [];
    const otherVoices = [];

    uniqueVoices.forEach(v => {
        const vLang = (v.lang || '').toLowerCase();
        if (vLang.startsWith(langPrefix)) {
            (v.localService ? currentLangLocal : currentLangOnline).push(v);
        } else if (vLang.startsWith('en')) {
            englishVoices.push(v);
        } else if (vLang.startsWith('hi')) {
            hindiVoices.push(v);
        } else {
            otherVoices.push(v);
        }
    });

    const sortByScore = (a, b) => _scoreVoice(b) - _scoreVoice(a);
    currentLangLocal.sort(sortByScore);
    currentLangOnline.sort(sortByScore);
    englishVoices.sort(sortByScore);
    hindiVoices.sort(sortByScore);
    otherVoices.sort(sortByScore);

    const recommended = [];
    recommended.push(...currentLangLocal.slice(0, 6));
    recommended.push(...currentLangOnline.slice(0, 4));
    recommended.push(...englishVoices.slice(0, 2));

    while (recommended.length > MAX_RECOMMENDED_VOICES) recommended.pop();

    const recommendedKeys = new Set(recommended.map(v => `${v.name}|${v.lang}`));
    const other = [];
    const addIfNotIn = (arr) => {
        arr.forEach(v => {
            const key = `${v.name}|${v.lang}`;
            if (!recommendedKeys.has(key)) {
                other.push(v);
                recommendedKeys.add(key);
            }
        });
    };

    addIfNotIn(englishVoices);
    addIfNotIn(hindiVoices);
    addIfNotIn(currentLangLocal);
    addIfNotIn(currentLangOnline);
    addIfNotIn(otherVoices);

    const totalNeeded = Math.max(0, maxCount - recommended.length);
    return { recommended, other: other.slice(0, totalNeeded) };
}

// ============================================================
// ⭐ VOICE FAVORITES & RECENT
// ============================================================
const FAVORITES_KEY = 'hor_tts_favorites';
const RECENT_KEY = 'hor_tts_recent';
const MAX_RECENT = 5;

function _loadFavorites() {
    try {
        const raw = localStorage.getItem(FAVORITES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

function _saveFavorites(arr) {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr)); } catch (e) {}
}

function _toggleFavorite(voiceName) {
    const favs = _loadFavorites();
    const idx = favs.indexOf(voiceName);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.unshift(voiceName);
    _saveFavorites(favs.slice(0, 20));
    return idx < 0;
}

function _isFavorite(voiceName) {
    return _loadFavorites().includes(voiceName);
}

function _loadRecent() {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

function _pushRecent(voiceName) {
    const recent = _loadRecent().filter(n => n !== voiceName);
    recent.unshift(voiceName);
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
    } catch (e) {}
}

function _fuzzyMatch(needle, haystack) {
    needle = needle.toLowerCase().trim();
    haystack = haystack.toLowerCase();
    if (!needle) return true;
    if (haystack.includes(needle)) return true;
    let i = 0, j = 0;
    while (i < needle.length && j < haystack.length) {
        if (needle[i] === haystack[j]) i++;
        j++;
    }
    return i === needle.length;
}

function _guessGender(voiceName) {
    const n = (voiceName || '').toLowerCase();
    const female = ['female', 'woman', 'samantha', 'victoria', 'karen', 'moira',
                    'tessa', 'fiona', 'veena', 'lekha', 'heera', 'swara',
                    'kalpana', 'susan', 'zira', 'hazel', 'aria', 'jenny'];
    const male   = ['male', 'man', 'ravi', 'madhur', 'alex', 'daniel', 'fred',
                    'google uk english male', 'hemant', 'rishi', 'david', 'mark'];
    if (female.some(w => n.includes(w))) return '♀';
    if (male.some(w => n.includes(w))) return '♂';
    return '';
}

// ============================================================
// 🎯 Build single voice item DOM
// ============================================================
function _buildVoiceItem(v, config, isRecommended, listContainer) {
    const isSelected = _ttsState.selectedVoiceName === v.name;
    const isFav = _isFavorite(v.name);
    const langPrefix = config.lang.split('-')[0];
    const isCurrentLang = v.lang.startsWith(langPrefix);
    const gender = _guessGender(v.name);

    const item = document.createElement('div');
    item.className = 'voice-item';
    item.dataset.voiceName = v.name;
    item.dataset.voiceLang = v.lang;
    item.tabIndex = 0;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

    const borderColor = isSelected ? '#0284c7' : (isFav ? '#f59e0b' : (isRecommended ? '#16a34a' : '#cbd5e1'));
    const bgColor = isSelected ? '#f0f9ff' : (isFav ? '#fffbeb' : (isRecommended ? '#f0fdf4' : '#ffffff'));

    item.style.cssText = `
        padding: 10px 12px;
        border: 1.5px solid ${borderColor};
        background: ${bgColor};
        border-radius: 8px;
        margin-bottom: 6px;
        cursor: pointer;
        transition: all 0.15s;
        font-size: 0.8rem;
        font-weight: 700;
        color: #1e293b;
        outline: none;
    `;
    item.addEventListener('focus', () => { item.style.boxShadow = '0 0 0 2px #93c5fd'; });
    item.addEventListener('blur', () => { item.style.boxShadow = ''; });

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:6px;';

    const star = document.createElement('span');
    star.style.cssText = 'font-size:1rem; cursor:pointer; flex-shrink:0; user-select:none;';
    star.textContent = isFav ? '★' : '☆';
    star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    star.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const added = _toggleFavorite(v.name);
        star.textContent = added ? '★' : '☆';
        star.title = added ? 'Remove from favorites' : 'Add to favorites';

        const currentlySelected = _ttsState.selectedVoiceName === v.name;
        item.style.border = `1.5px solid ${
            added ? '#f59e0b' :
            (currentlySelected ? '#0284c7' : '#cbd5e1')
        }`;
        item.style.background = added
            ? '#fffbeb'
            : (currentlySelected ? '#f0f9ff' : '#ffffff');

        _call('showToast', added ? '⭐ Added to favorites' : 'Removed from favorites', 'info', 1200);
    });
    row.appendChild(star);

    const leftCol = document.createElement('div');
    leftCol.style.cssText = 'flex:1; min-width:0;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:900; word-break:break-word;';
    nameEl.textContent = v.name;

    const metaEl = document.createElement('div');
    metaEl.style.cssText = 'font-size:0.68rem; color:#64748b; margin-top:2px; display:flex; flex-wrap:wrap; gap:4px; align-items:center;';

    const langSpan = document.createElement('span');
    langSpan.textContent = v.lang;
    metaEl.appendChild(langSpan);

    if (gender) {
        const gSpan = document.createElement('span');
        gSpan.textContent = gender;
        gSpan.style.cssText = 'font-weight:900;';
        metaEl.appendChild(gSpan);
    }

    const localBadge = document.createElement('span');
    localBadge.style.cssText = v.localService
        ? 'background:#dcfce7; color:#166534; font-size:0.6rem; padding:2px 6px; border-radius:4px; font-weight:800;'
        : 'background:#dbeafe; color:#1e40af; font-size:0.6rem; padding:2px 6px; border-radius:4px; font-weight:800;';
    localBadge.textContent = v.localService ? 'LOCAL' : 'ONLINE';
    metaEl.appendChild(localBadge);

    if (isCurrentLang) {
        const matchBadge = document.createElement('span');
        matchBadge.style.cssText = 'background:#fef3c7; color:#92400e; font-size:0.6rem; padding:2px 6px; border-radius:4px; font-weight:800;';
        matchBadge.textContent = '★ MATCH';
        metaEl.appendChild(matchBadge);
    }

    if (isRecommended && _scoreVoice(v) >= 100) {
        const bestBadge = document.createElement('span');
        bestBadge.style.cssText = 'background:linear-gradient(135deg, #fbbf24, #f59e0b); color:#78350f; font-size:0.6rem; padding:2px 6px; border-radius:4px; font-weight:900;';
        bestBadge.textContent = '🏆 BEST';
        metaEl.appendChild(bestBadge);
    }

    leftCol.appendChild(nameEl);
    leftCol.appendChild(metaEl);
    row.appendChild(leftCol);

    if (isSelected) {
        const checkEl = document.createElement('span');
        checkEl.className = 'voice-check';
        checkEl.style.cssText = 'font-size:1.2rem; color:#0284c7; flex-shrink:0;';
        checkEl.textContent = '✓';
        row.appendChild(checkEl);
    }

    item.appendChild(row);

    const selectVoice = () => {
        _ttsState.selectedVoiceName = v.name;
        saveTTSSettings();
        _pushRecent(v.name);

        listContainer.querySelectorAll('.voice-item').forEach(el => {
            el.style.border = '1.5px solid #cbd5e1';
            el.style.background = '#ffffff';
            el.setAttribute('aria-selected', 'false');
            const check = el.querySelector('.voice-check');
            if (check) check.remove();
        });

        item.style.border = '1.5px solid #0284c7';
        item.style.background = '#f0f9ff';
        item.setAttribute('aria-selected', 'true');

        const newCheck = document.createElement('span');
        newCheck.className = 'voice-check';
        newCheck.style.cssText = 'font-size:1.2rem; color:#0284c7; flex-shrink:0;';
        newCheck.textContent = '✓';
        row.appendChild(newCheck);

        try {
            speechSynthesis.cancel();
            _ttsState._speakSession++;
            _ttsState.speaking = false;
            _ttsState.paused = false;
            const u = new SpeechSynthesisUtterance('Hello');
            u.voice = v;
            u.lang = v.lang;
            u.rate = _ttsState.rate;
            u.volume = _ttsState.volume;
            speechSynthesis.speak(u);
            console.log('🎙️ Selected:', v.name);
        } catch (e) {
            console.warn('Preview failed:', e.message);
        }
    };

    item.addEventListener('click', selectVoice);
    item.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            selectVoice();
        }
    });

    return item;
}

// ============================================================
// 🔊 TTS PAUSE / RESUME / HIGHLIGHT
// ============================================================
function pauseSpeaking() {
    if (!isTTSSpeaking() || _ttsState.paused) return;
    try {
        if ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) {
            speechSynthesis.pause();
            _ttsState.paused = true;
            updateReadButtonState('paused');
            _call('showToast', '⏸️ Paused — Esc to stop', 'info', 1800);
            console.log('⏸️ TTS paused at chunk', _ttsState._currentChunkIdx);
        } else {
            _ttsState.paused = true;
            updateReadButtonState('paused');
        }
    } catch (e) {
        console.warn('Pause failed:', e.message);
        _ttsState.paused = true;
        updateReadButtonState('paused');
    }
}

function resumeSpeaking() {
    if (!_ttsState.paused) return;
    try {
        if ('speechSynthesis' in window && speechSynthesis.paused) {
            speechSynthesis.resume();
            _ttsState.paused = false;
            updateReadButtonState(true);
            _call('showToast', '▶️ Resumed', 'info', 1200);
            console.log('▶️ TTS resumed');
            return;
        }
    } catch (e) {
        console.warn('Resume failed:', e.message);
    }
    _ttsState.paused = false;
    if (_ttsState._currentChunkIdx < _ttsState._chunks.length) {
        _ttsState._resumeOnSpeak = true;
        _ttsState.speaking = false;
        _highlightClear();
        setTimeout(() => speakText(), 60);
    } else {
        updateReadButtonState(false);
        _ttsState.speaking = false;
    }
}

function _highlightWord(charIndex, chunkText, chunkStartInEditor) {
    if (!_ttsState.highlightEnabled) return;
    try {
        const editor = document.getElementById('editor');
        if (!editor) return;

        _highlightClear();

        let start = Math.min(charIndex, chunkText.length);
        let end = start;
        while (start > 0 && !/\s/.test(chunkText[start - 1])) start--;
        while (end < chunkText.length && !/\s/.test(chunkText[end])) end++;

        const word = chunkText.slice(start, end).trim();
        if (!word) return;

        const absStart = chunkStartInEditor + start;
        const absEnd = chunkStartInEditor + end;
        _highlightRangeInEditor(editor, absStart, absEnd);
    } catch (e) {}
}

function _highlightRangeInEditor(editor, start, end) {
    try {
        const walker = document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            null
        );
        let acc = 0;
        let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
        let node;

        while ((node = walker.nextNode())) {
            if (node.nodeType === 3) {
                const len = node.textContent.length;
                if (!startNode && acc + len > start) {
                    startNode = node;
                    startOffset = Math.max(0, Math.min(len, start - acc));
                }
                if (!endNode && acc + len >= end) {
                    endNode = node;
                    endOffset = Math.max(0, Math.min(len, end - acc));
                    break;
                }
                acc += len;
            } else if (node.nodeType === 1 && node.tagName === 'BR') {
                acc += 1;
            }
        }

        if (!startNode || !endNode) return;

        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        _ttsState._highlightSelection = selection;
    } catch (e) {}
}

function _highlightClear() {
    try {
        const sel = window.getSelection();
        if (sel && _ttsState._highlightSelection === sel) sel.removeAllRanges();
    } catch (e) {}
    _ttsState._highlightSelection = null;
}

// ============================================================
// 🔊 SPEAK TEXT
// ============================================================
function speakText() {
    try {
        if (typeof window.speechSynthesis !== 'undefined' &&
            window.speechSynthesis.speaking !== true &&
            window.speechSynthesis.paused !== true &&
            _ttsState.speaking === true &&
            !_ttsState.paused) {
            console.log('🔄 [TTS] Stale speaking flag — auto-reset');
            _ttsState.speaking = false;
        }
    } catch (e) {}

    const editor = document.getElementById('editor');
    const text = (editor ? editor.innerText : '') || '';

    if (!text.trim()) {
        _call('showToast', 'कुछ टाइप करें पहले', 'warning');
        return;
    }

    if (_ttsState.paused) { resumeSpeaking(); return; }
    if (isTTSSpeaking()) { pauseSpeaking(); return; }

    const config = _getTTSConfig();
    const voice = getSelectedVoice();
    if (!voice) {
        _call('showToast', 'कोई voice उपलब्ध नहीं — कृपया voice settings खोलें', 'warning');
        return;
    }

    const textHash = _simpleHash(text);

    _ttsState._speakSession++;
    const sessionId = _ttsState._speakSession;
    _ttsState.paused = false;
    _ttsState._textHash = textHash;

    console.log('🔊 TTS starting:', {
        session: sessionId, language: config.label,
        voice: voice.name, voiceLang: voice.lang, chunkSize: config.chunkSize
    });

    let chunks, startChunkIdx = 0;
    if (_ttsState._resumeOnSpeak && _ttsState._textHash === textHash &&
        _ttsState._chunks && _ttsState._chunks.length > 0) {
        chunks = _ttsState._chunks;
        startChunkIdx = _ttsState._currentChunkIdx;
        _ttsState._resumeOnSpeak = false;
        console.log('⏮️ Resuming from chunk', startChunkIdx);
    } else {
        chunks = chunkText(text.trim(), config.chunkSize);
        _ttsState._chunks = chunks;
        _ttsState._currentChunkIdx = 0;
        _ttsState._chunkOffset = 0;
    }

    if (chunks.length === 0) {
        _call('showToast', 'कोई text नहीं मिला', 'warning');
        return;
    }

    updateReadButtonState(true);
    let currentChunkIdx = startChunkIdx;

    const chunkPositions = [];
    let pos = 0;
    for (const c of chunks) {
        const idx = text.indexOf(c, pos);
        chunkPositions.push(idx >= 0 ? idx : pos);
        pos += c.length;
    }

    function speakNext() {
        if (sessionId !== _ttsState._speakSession) return;
        if (_ttsState.paused) return;
        if (currentChunkIdx >= chunks.length || !_ttsState.speaking) {
            if (currentChunkIdx >= chunks.length) {
                console.log('✅ TTS complete');
                updateReadButtonState(false);
                _ttsState.speaking = false;
                _ttsState.paused = false;
                _ttsState._currentChunkIdx = 0;
                _ttsState._chunkOffset = 0;
                _ttsState._activeUtterance = null;
                _highlightClear();
            }
            return;
        }

        const chunk = chunks[currentChunkIdx];
        _ttsState._currentChunkIdx = currentChunkIdx;

        const u = new SpeechSynthesisUtterance(chunk);
        u.voice = voice;
        u.lang = voice.lang || config.lang;
        u.rate = _ttsState.rate !== 1.0 ? _ttsState.rate : config.rate;
        u.pitch = _ttsState.pitch || config.pitch;
        u.volume = (typeof _ttsState.volume === 'number') ? _ttsState.volume : 1.0;

        if (_ttsState.highlightEnabled) {
            u.onboundary = (ev) => {
                if (sessionId !== _ttsState._speakSession) return;
                if (ev.name === 'word' || ev.charIndex !== undefined) {
                    _highlightWord(ev.charIndex || 0, chunk, chunkPositions[currentChunkIdx]);
                    _ttsState._chunkOffset = ev.charIndex || 0;
                }
            };
        }

        u.onend = () => {
            if (sessionId !== _ttsState._speakSession) return;
            currentChunkIdx++;
            _ttsState._chunkOffset = 0;
            speakNext();
        };

        u.onerror = (e) => {
            if (sessionId !== _ttsState._speakSession) return;
            if (e.error === 'interrupted' || e.error === 'canceled') return;
            console.warn('TTS chunk error:', e.error);
            currentChunkIdx++;
            speakNext();
        };

        _ttsState._activeUtterance = u;

        try {
            speechSynthesis.speak(u);
        } catch (err) {
            console.error('speak() failed:', err);
            updateReadButtonState(false);
            _ttsState.speaking = false;
            _ttsState._activeUtterance = null;
        }
    }

    try { speechSynthesis.cancel(); } catch (e) {}

    setTimeout(() => {
        if (sessionId !== _ttsState._speakSession) return;
        _ttsState.speaking = true;
        speakNext();
    }, 80);
}

// ============================================================
// 📝 CHUNK TEXT
// ============================================================
function chunkText(text, maxSize) {
    if (!text || text.length <= maxSize) return [text];

    const chunks = [];
    const sentences = splitSentences(text);
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + ' ' + sentence).length > maxSize) {
            if (currentChunk) chunks.push(currentChunk.trim());

            if (sentence.length > maxSize) {
                const subParts = splitClauses(sentence);
                let subChunk = '';

                for (const part of subParts) {
                    if ((subChunk + ' ' + part).length > maxSize) {
                        if (subChunk) chunks.push(subChunk.trim());

                        if (part.length > maxSize) {
                            const words = part.split(/\s+/);
                            let wordChunk = '';
                            for (const word of words) {
                                if ((wordChunk + ' ' + word).length > maxSize) {
                                    if (wordChunk) chunks.push(wordChunk.trim());
                                    wordChunk = word;
                                } else {
                                    wordChunk = wordChunk ? wordChunk + ' ' + word : word;
                                }
                            }
                            subChunk = wordChunk;
                        } else {
                            subChunk = part;
                        }
                    } else {
                        subChunk = subChunk ? subChunk + ' ' + part : part;
                    }
                }
                currentChunk = subChunk;
            } else {
                currentChunk = sentence;
            }
        } else {
            currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks.filter(c => c.length > 0);
}

function splitSentences(text) {
    if (!text) return [];
    const result = [];
    let current = '';
    const terminators = ['.', '!', '?', '।', '॥'];
    const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|viz|No|approx)\.$/i;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        current += ch;

        if (terminators.includes(ch)) {
            if (ch === '.' && text[i + 1] === '.') continue;
            if (ch === '.' && text[i - 1] === '.') continue;
            if (ch === '.' && ABBREV.test(current)) continue;

            let j = i + 1;
            while (j < text.length && /["'”’\)\]\}]/.test(text[j])) {
                current += text[j];
                j++;
            }
            i = j - 1;

            const next = text[i + 1];
            if (!next || /\s/.test(next)) {
                const trimmed = current.trim();
                if (trimmed) result.push(trimmed);
                current = '';
            }
        }
    }
    if (current.trim()) result.push(current.trim());
    return result;
}

function splitClauses(text) {
    const result = [];
    let current = '';
    const separators = [',', ';', ':'];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        current += ch;
        if (separators.includes(ch)) {
            const next = text[i + 1];
            if (!next || /\s/.test(next)) {
                result.push(current.trim());
                current = '';
            }
        }
    }
    if (current.trim()) result.push(current.trim());
    return result;
}

// ============================================================
// ⏹️ STOP SPEAKING
// ============================================================
function stopSpeaking() {
    _ttsState.speaking = false;
    _ttsState.paused = false;
    _ttsState._speakSession++;
    _ttsState._activeUtterance = null;
    _ttsState._currentChunkIdx = 0;
    _ttsState._chunkOffset = 0;
    _ttsState._resumeOnSpeak = false;
    _highlightClear();
    if ('speechSynthesis' in window) {
        try {
            if (speechSynthesis.speaking || speechSynthesis.paused || speechSynthesis.pending) {
                speechSynthesis.cancel();
            }
        } catch (e) {}
    }
    updateReadButtonState(false);
    console.log('⏹️ TTS stopped');
}

// ============================================================
// 🎛️ UPDATE READ BUTTON
// ============================================================
function updateReadButtonState(state) {
    const btn = document.getElementById('btn-read') ||
                document.querySelector('button[onclick*="speakText"]');
    if (!btn) return;

    if (state === true) state = 'speaking';
    else if (state === false) state = 'idle';

    if (state === 'speaking') {
        btn.innerHTML = '⏸️ Pause';
        btn.title = 'Pause TTS (Esc to stop)';
        btn.style.background = '#f59e0b';
        btn.style.color = '#fff';
        btn.style.borderColor = '#f59e0b';
    } else if (state === 'paused') {
        btn.innerHTML = '▶️ Resume';
        btn.title = 'Resume TTS (Esc to stop)';
        btn.style.background = '#16a34a';
        btn.style.color = '#fff';
        btn.style.borderColor = '#16a34a';
    } else {
        btn.innerHTML = '🗣️ Read';
        btn.title = 'Read text aloud';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
    }
}

// ============================================================
// 🎧 TEST VOICE
// ============================================================
function testVoice(customText = null) {
    const wasSpeaking = speechSynthesis.speaking || speechSynthesis.paused;
    _ttsState.paused = false;
    try { if (wasSpeaking) speechSynthesis.cancel(); } catch (e) {}

    _ttsState._speakSession++;
    _ttsState.speaking = false;
    _highlightClear();

    if (wasSpeaking) {
        _call('showToast', '⏸️ मुख्य TTS रोका गया — voice test चल रहा है', 'info', 2500);
        updateReadButtonState(false);
    }

    const voice = getSelectedVoice();
    if (!voice) {
        _call('showToast', 'कोई voice उपलब्ध नहीं', 'warning');
        return;
    }

    const config = _getTTSConfig();
    const sampleTexts = {
        'english': 'Hello, this is a voice test.',
        'roman': 'Johar, noa voice test kana.',
        'hindi-dev': 'नमस्ते, यह एक आवाज़ परीक्षण है।',
        'santali-dev': 'जोहार, नोवा आवाज़ परीक्षण काना।',
        'olchiki': 'ᱡᱚᱦᱟᱨ, ᱱᱚᱶᱟ ᱟᱲᱟᱝ ᱯᱚᱨᱤᱠᱷᱟ ᱠᱟᱱᱟ ᱾'
    };

    const text = customText || sampleTexts[window.currentLayout || 'english'] || sampleTexts['english'];
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || config.lang;
    u.rate = _ttsState.rate || config.rate;
    u.pitch = _ttsState.pitch || config.pitch;
    u.volume = (typeof _ttsState.volume === 'number') ? _ttsState.volume : 1.0;

    try {
        speechSynthesis.speak(u);
        console.log('🎧 Test voice:', voice.name, '-', text, '| vol:', u.volume);
    } catch (e) {
        console.warn('Test voice failed:', e.message);
    }
}

// ============================================================
// 🎙️ VOICE SETTINGS MODAL
// ============================================================
function openVoiceSettingsModal() {
    const existing = document.getElementById('voiceSettingsModal');
    if (existing) existing.remove();

    const allVoices = _getVoicesCached();
    const config = _getTTSConfig();
    const { recommended, other } = _getTopVoices(allVoices, config, MAX_VOICES_TO_SHOW);

    const favNames = _loadFavorites();
    const favVoices = allVoices.filter(v => favNames.includes(v.name));

    const recentNames = _loadRecent();
    const recentVoices = recentNames
        .map(n => allVoices.find(v => v.name === n))
        .filter(v => v && !favNames.includes(v.name));

    const shownNames = new Set();
    favVoices.forEach(v => shownNames.add(v.name));
    recentVoices.forEach(v => shownNames.add(v.name));

    const recFiltered = recommended.filter(v => !shownNames.has(v.name));
    const otherFiltered = other.filter(v => !shownNames.has(v.name));
    const totalShown = favVoices.length + recentVoices.length + recFiltered.length + otherFiltered.length;

    const modal = document.createElement('div');
    modal.id = 'voiceSettingsModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:10001; justify-content:center; align-items:center; padding:16px; backdrop-filter:blur(6px);';
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            document.body.classList.remove('modal-open');
        }
    });

    const inner = document.createElement('div');
    inner.className = 'modal-window';
    inner.style.cssText = 'max-width:560px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.5); max-height:95vh; display:flex; flex-direction:column;';
    inner.addEventListener('click', (e) => e.stopPropagation());

    const header = document.createElement('div');
    header.style.cssText = 'background:linear-gradient(135deg,#1e40af 0%,#7c3aed 100%); padding:16px 60px 16px 20px; color:#fff; position:relative;';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:1.3rem; font-weight:900;';
    titleEl.textContent = '🔊 Voice Settings';

    const subtitleEl = document.createElement('div');
    subtitleEl.style.cssText = 'font-size:0.8rem; color:#fde047; margin-top:4px;';
    subtitleEl.textContent = `${config.label} — ${totalShown} voices shown`;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.2); border:none; color:#fff; font-size:1.1rem; width:32px; height:32px; border-radius:50%; cursor:pointer; font-weight:900;';
    closeBtn.addEventListener('click', () => {
        modal.remove();
        document.body.classList.remove('modal-open');
    });

    header.appendChild(titleEl);
    header.appendChild(subtitleEl);
    header.appendChild(closeBtn);
    inner.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px 20px; overflow-y:auto; flex:1; color:#1e293b;';

    const listHeader = document.createElement('div');
    listHeader.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;';

    const listLabel = document.createElement('label');
    listLabel.style.cssText = 'font-size:0.75rem; font-weight:900; color:#475569; text-transform:uppercase; letter-spacing:0.5px;';
    listLabel.textContent = `🎙️ Available Voices (${totalShown})`;

    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.textContent = '🔄 Auto';
    autoBtn.style.cssText = 'background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; font-size:0.68rem; font-weight:800; cursor:pointer;';
    autoBtn.addEventListener('click', () => {
        resetVoiceSelection();
        modal.remove();
        document.body.classList.remove('modal-open');
        setTimeout(() => openVoiceSettingsModal(), 100);
    });

    listHeader.appendChild(listLabel);
    listHeader.appendChild(autoBtn);
    body.appendChild(listHeader);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'voiceSearchBox';
    searchInput.placeholder = '🔍 Voice search करें... (fuzzy)';
    searchInput.style.cssText = 'width:100%; padding:8px 12px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:0.8rem; margin-bottom:10px; outline:none; box-sizing:border-box;';
    body.appendChild(searchInput);

    const listContainer = document.createElement('div');
    listContainer.id = 'voiceListContainer';
    listContainer.style.cssText = 'max-height:340px; overflow-y:auto; padding-right:4px;';

    if (totalShown === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'color:#dc2626; font-weight:800; padding:20px; text-align:center;';
        emptyMsg.textContent = '⚠️ कोई voice नहीं मिली';
        listContainer.appendChild(emptyMsg);
    } else {
        if (favVoices.length > 0) {
            const favHeader = document.createElement('div');
            favHeader.style.cssText = 'display:flex; align-items:center; gap:6px; margin:0 0 8px 0; font-size:0.7rem; font-weight:900; color:#b45309; text-transform:uppercase; letter-spacing:0.6px; padding:6px 8px; background:#fffbeb; border-radius:6px;';
            favHeader.textContent = `⭐ Favorites (${favVoices.length})`;
            listContainer.appendChild(favHeader);
            favVoices.forEach(v => {
                listContainer.appendChild(_buildVoiceItem(v, config, false, listContainer));
            });
        }

        if (recentVoices.length > 0) {
            const recentHeader = document.createElement('div');
            recentHeader.style.cssText = 'display:flex; align-items:center; gap:6px; margin:12px 0 8px 0; font-size:0.7rem; font-weight:900; color:#0369a1; text-transform:uppercase; letter-spacing:0.6px; padding:6px 8px; background:#f0f9ff; border-radius:6px;';
            recentHeader.textContent = `🕐 Recent (${recentVoices.length})`;
            listContainer.appendChild(recentHeader);
            recentVoices.forEach(v => {
                listContainer.appendChild(_buildVoiceItem(v, config, false, listContainer));
            });
        }

        if (recFiltered.length > 0) {
            const recHeader = document.createElement('div');
            recHeader.style.cssText = 'display:flex; align-items:center; gap:6px; margin:12px 0 8px 0; font-size:0.7rem; font-weight:900; color:#16a34a; text-transform:uppercase; letter-spacing:0.6px; padding:6px 8px; background:#f0fdf4; border-radius:6px;';
            recHeader.textContent = `🌟 Recommended (${recFiltered.length})`;
            listContainer.appendChild(recHeader);
            recFiltered.forEach(v => {
                listContainer.appendChild(_buildVoiceItem(v, config, true, listContainer));
            });
        }

        if (otherFiltered.length > 0) {
            const otherHeader = document.createElement('div');
            otherHeader.style.cssText = 'display:flex; align-items:center; gap:6px; margin:16px 0 8px 0; font-size:0.7rem; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.6px; padding:6px 8px; background:#f8fafc; border-radius:6px;';
            otherHeader.textContent = `🌐 Other Languages (${otherFiltered.length})`;
            listContainer.appendChild(otherHeader);
            otherFiltered.forEach(v => {
                listContainer.appendChild(_buildVoiceItem(v, config, false, listContainer));
            });
        }
    }
    body.appendChild(listContainer);

    const rangeContainer = document.createElement('div');
    rangeContainer.style.cssText = 'border-top:1.5px solid #e2e8f0; padding-top:14px; margin-top:14px;';

    function buildRangeRow(id, labelText, valueText, min, max, step, initialVal, onChange) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'margin-bottom:12px;';
        const labelRow = document.createElement('label');
        labelRow.style.cssText = 'display:flex; justify-content:space-between; font-size:0.72rem; font-weight:900; color:#475569; margin-bottom:6px; text-transform:uppercase;';
        const labelSpan = document.createElement('span');
        labelSpan.textContent = labelText;
        const valueSpan = document.createElement('span');
        valueSpan.id = valueText;
        valueSpan.style.cssText = 'color:#0284c7;';
        valueSpan.textContent = initialVal.toFixed(1);
        labelRow.appendChild(labelSpan);
        labelRow.appendChild(valueSpan);
        const input = document.createElement('input');
        input.type = 'range';
        input.id = id;
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(initialVal);
        input.style.cssText = 'width:100%;';
        input.addEventListener('input', () => onChange(parseFloat(input.value)));
        wrapper.appendChild(labelRow);
        wrapper.appendChild(input);
        return wrapper;
    }

    rangeContainer.appendChild(buildRangeRow(
        'speedRange', '⚡ Speed', 'speedValue', 0.5, 2.0, 0.1, _ttsState.rate,
        (val) => {
            _ttsState.rate = val;
            const el = document.getElementById('speedValue');
            if (el) el.textContent = val.toFixed(1) + 'x';
            saveTTSSettings();
        }
    ));

    rangeContainer.appendChild(buildRangeRow(
        'pitchRange', '🎵 Pitch', 'pitchValue', 0.5, 1.5, 0.1, _ttsState.pitch,
        (val) => {
            _ttsState.pitch = val;
            const el = document.getElementById('pitchValue');
            if (el) el.textContent = val.toFixed(1);
            saveTTSSettings();
        }
    ));

    const volumeRow = buildRangeRow(
        'volumeRange', '🔉 Volume', 'volumeValue', 0, 1.0, 0.1, _ttsState.volume,
        (val) => {
            _ttsState.volume = val;
            const el = document.getElementById('volumeValue');
            if (el) el.textContent = Math.round(val * 100) + '%';
            saveTTSSettings();
        }
    );
    const volValSpan = volumeRow.querySelector('#volumeValue');
    if (volValSpan) volValSpan.textContent = Math.round(_ttsState.volume * 100) + '%';
    rangeContainer.appendChild(volumeRow);

    const hlRow = document.createElement('label');
    hlRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:10px; font-size:0.75rem; font-weight:800; color:#475569; cursor:pointer;';
    const hlCheck = document.createElement('input');
    hlCheck.type = 'checkbox';
    hlCheck.checked = _ttsState.highlightEnabled;
    hlCheck.addEventListener('change', () => {
        _ttsState.highlightEnabled = hlCheck.checked;
        saveTTSSettings();
        if (!hlCheck.checked) _highlightClear();
    });
    hlRow.appendChild(hlCheck);
    hlRow.appendChild(document.createTextNode('✨ Highlight word while reading'));
    rangeContainer.appendChild(hlRow);

    body.appendChild(rangeContainer);
    inner.appendChild(body);

    const footer = document.createElement('div');
    footer.style.cssText = 'padding:12px 20px; background:#f8fafc; border-top:1.5px solid #e2e8f0; display:flex; gap:8px;';

    const testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.textContent = '🎧 Test';
    testBtn.style.cssText = 'flex:1; padding:11px; background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; border:none; border-radius:8px; font-size:0.82rem; font-weight:900; cursor:pointer;';
    testBtn.addEventListener('click', () => testVoice());

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = '✓ Save & Close';
    saveBtn.style.cssText = 'flex:1; padding:11px; background:#475569; color:#fff; border:none; border-radius:8px; font-size:0.82rem; font-weight:900; cursor:pointer;';
    saveBtn.addEventListener('click', () => {
        modal.remove();
        document.body.classList.remove('modal-open');
    });

    footer.appendChild(testBtn);
    footer.appendChild(saveBtn);
    inner.appendChild(footer);
    modal.appendChild(inner);
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    searchInput.addEventListener('input', () => {
        clearTimeout(_voiceSearchDebounce);
        _voiceSearchDebounce = setTimeout(() => {
            const term = searchInput.value.toLowerCase().trim();
            listContainer.querySelectorAll('.voice-item').forEach(el => {
                const name = (el.dataset.voiceName || '').toLowerCase();
                const lang = (el.dataset.voiceLang || '').toLowerCase();
                const combined = name + ' ' + lang;
                const match = !term || _fuzzyMatch(term, combined);
                el.style.display = match ? 'block' : 'none';
            });
        }, VOICE_SEARCH_DEBOUNCE_MS);
    });

    listContainer.addEventListener('keydown', (ev) => {
        const items = Array.from(listContainer.querySelectorAll('.voice-item'))
            .filter(el => el.style.display !== 'none');
        if (items.length === 0) return;
        const currentIdx = items.indexOf(document.activeElement);

        if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            items[(currentIdx + 1) % items.length].focus();
        } else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            items[(currentIdx - 1 + items.length) % items.length].focus();
        } else if (ev.key === 'Escape') {
            ev.preventDefault();
            searchInput.focus();
        }
    });
}

function resetVoiceSelection() {
    _ttsState.selectedVoiceName = null;
    saveTTSSettings();
    document.querySelectorAll('.voice-item').forEach(el => {
        el.style.border = '1.5px solid #cbd5e1';
        el.style.background = '#ffffff';
        const check = el.querySelector('.voice-check');
        if (check) check.remove();
    });
    console.log('🔄 Voice reset to Auto');
}

// ============================================================
// 🎁 TRIAL UI
// ============================================================
function openTrialExpiryModal() {
    if (typeof TrialSystem !== 'undefined') {
        try {
            if (typeof TrialSystem.showExpiryModal === 'function') {
                TrialSystem.showExpiryModal();
            } else if (typeof TrialSystem.showExpiredBanner === 'function') {
                TrialSystem.showExpiredBanner();
            }
        } catch (e) {
            console.warn('showExpiryModal failed:', e.message);
        }
    }
}

function closeTrialExpiryModal() {
    const modal = document.getElementById('trialExpiryModal');
    if (modal) modal.style.display = 'none';
    _call('_unlockBodyScroll');
}

function showTrialWelcome() {
    const modal = document.getElementById('trialExpiryModal');
    if (!modal) return;
    const titleEl = document.querySelector('#trialExpiryModal .lcn-title');
    if (titleEl) titleEl.innerHTML = 'Welcome! <span style="color: #7c2d12;">Free Trial</span>';
    const subtitleEl = document.querySelector('#trialExpiryModal .lcn-subtitle');
    if (subtitleEl) subtitleEl.textContent = '🎉 7-Day Full Access Started';
    const statusEl = document.getElementById('trialStatusText');
    if (statusEl) {
        statusEl.textContent = '✨ आपके सभी Pro features अब 7 दिनों तक unlocked हैं!';
        statusEl.style.color = '#16a34a';
    }
    modal.style.display = 'flex';
}

// ============================================================
// 💾 HWID MANUAL RECOVERY
// ============================================================
function toggleManualRecovery() {
    const box = document.getElementById('manualRecoveryBox');
    const statusMsg = document.getElementById('recoveryStatusMsg');
    if (!box) return;
    if (box.style.display === 'none' || box.style.display === '') {
        box.style.display = 'block';
        if (statusMsg) { statusMsg.className = ''; statusMsg.style.display = 'none'; }
        setTimeout(() => {
            const input = document.getElementById('oldHwidInput');
            if (input) input.focus();
        }, 100);
    } else {
        box.style.display = 'none';
    }
}

function cancelManualRecovery() {
    const box = document.getElementById('manualRecoveryBox');
    const input = document.getElementById('oldHwidInput');
    const statusMsg = document.getElementById('recoveryStatusMsg');
    if (box) box.style.display = 'none';
    if (input) input.value = '';
    if (statusMsg) { statusMsg.className = ''; statusMsg.style.display = 'none'; }
}

async function applyManualRecovery() {
    const input = document.getElementById('oldHwidInput');
    const statusMsg = document.getElementById('recoveryStatusMsg');
    if (!input || !statusMsg) return;

    const oldHwid = (input.value || '').trim().toUpperCase();
    if (!oldHwid) {
        statusMsg.className = 'error';
        statusMsg.textContent = '❌ कृपया पुरानी Device ID डालें';
        return;
    }
    if (!/^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(oldHwid)) {
        statusMsg.className = 'error';
        statusMsg.textContent = '❌ गलत format! होना चाहिए: DVC-XXXX-YYYY';
        return;
    }

    statusMsg.className = '';
    statusMsg.style.display = 'none';

    try {
        localStorage.setItem('hor_device_hwid', oldHwid);
        localStorage.setItem('hor_hwid_source', 'manual-recovery');
        _call('invalidateHwidCache', oldHwid);

        if (window.electronAPI && window.electronAPI.isElectron) {
            try {
                const result = await window.electronAPI.saveHwid(oldHwid);
                if (result && result.success) console.log('💾 HWID saved to OS storage');
                else console.warn('⚠️ OS save returned:', result);
            } catch (e) {
                console.warn('⚠️ Could not save HWID to OS:', e.message);
            }
        }

        statusMsg.className = 'success';
        statusMsg.textContent = '✅ Device ID recover हो गई! License re-verify हो रही है...';

        setTimeout(async () => {
            try {
                await _call('checkLicenseIntegrity');
                const dvcDisplay = document.getElementById('userDeviceIdDisplay');
                if (dvcDisplay) dvcDisplay.value = oldHwid;
                statusMsg.className = 'success';
                statusMsg.textContent = '✅ Success! App अब Pro mode में चलेगा।';
                setTimeout(() => _call('closeLicenseModal'), 1500);
            } catch (e) {
                console.warn('License re-check failed:', e);
            }
        }, 800);
    } catch (e) {
        statusMsg.className = 'error';
        statusMsg.textContent = '❌ Recover failed: ' + e.message;
    }
}

// ============================================================
// ⌨️ SMART TRANSLITERATION
// ============================================================
function checkSmartTransliteration() {
    if (typeof isPhoneticEnabled !== 'undefined' && !isPhoneticEnabled) return;
    if (!window.currentLayout) return;
    if (window.currentLayout === 'roman' || window.currentLayout === 'english') return;
    if (typeof textShortcodes === 'undefined' || !textShortcodes) return;
    if (typeof escapeRegex !== 'function') return;

    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;

    const node = sel.anchorNode;
    if (node.nodeType === 3) {
        let text = node.textContent;
        for (const [code, map] of Object.entries(textShortcodes)) {
            const pattern = new RegExp(escapeRegex(code) + ' $');
            if (pattern.test(text)) {
                const target = map[window.currentLayout] || map['santali-dev'];
                if (target) {
                    node.textContent = text.replace(pattern, target + ' ');
                    placeCaretAfterNode(node);
                    return;
                }
            }
        }
    }
}

function placeCaretAfterNode(targetNode) {
    try {
        const range = document.createRange();
        range.setStart(targetNode, targetNode.textContent.length);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        _call('saveCurrentSelection');
    } catch (e) {}
}

// ============================================================
// 📱 PREVIEW MODAL
// ============================================================
function openPreviewModal() {
    if (window.__appReady === false) return;
    const modal = document.getElementById('previewModal');
    if (!modal) return;
    modal.style.display = 'flex';
    const w = window.innerWidth;
    if (w <= 480) setSimulatedDevice('mobile');
    else if (w <= 900) setSimulatedDevice('tablet');
    else setSimulatedDevice('desktop');
    renderPreviewFrame();
}

function renderPreviewFrame() {
    const iframe = document.getElementById('previewIframe');
    if (!iframe) return;

    const editor = document.getElementById('editor');
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const editorContent = editor ? editor.innerHTML : '';
    const currentLang = window.currentLayout || 'english';
    const currentKbMode = window.keyboardMode || 'virtual';
    const licUser = localStorage.getItem('hor_lic_user') || '';
    const licKey = localStorage.getItem('hor_lic_key') || '';

    iframe.src = window.location.href.split('?')[0].split('#')[0] + '?preview_mode=true';

    iframe.onload = () => {
        try {
            const subWin = iframe.contentWindow;
            const subDoc = iframe.contentDocument || subWin.document;
            const subPrevModal = subDoc.getElementById('previewModal');
            if (subPrevModal) subPrevModal.remove();
            subDoc.querySelectorAll('button').forEach(btn => {
                if (btn.textContent.includes('Preview')) btn.remove();
            });
            if (subWin.switchLanguage) subWin.switchLanguage(currentLang);
            if (subWin.setKeyboardPreference) subWin.setKeyboardPreference(currentKbMode);
            const subEditor = subDoc.getElementById('editor');
            if (subEditor) subEditor.innerHTML = editorContent;
            subDoc.body.setAttribute('data-theme', currentTheme);

            if (licUser && licKey) {
                subWin.localStorage.setItem('hor_lic_user', licUser);
                subWin.localStorage.setItem('hor_lic_key', licKey);
                if (subWin.checkLicenseIntegrity) subWin.checkLicenseIntegrity();
            }
        } catch (err) {
            console.warn('Preview iframe setup error:', err.message);
        }
    };
}

function closePreviewModal(e) {
    if (e.target.id === 'previewModal') {
        const modal = document.getElementById('previewModal');
        if (modal) modal.style.display = 'none';
        const iframe = document.getElementById('previewIframe');
        if (iframe) iframe.src = 'about:blank';
    }
}

function setSimulatedDevice(type) {
    const screen = document.getElementById('simulatedScreen');
    if (!screen) return;
    document.querySelectorAll('.device-selector-bar button')
        .forEach(b => b.classList.remove('active-state'));

    const deviceSizes = {
        mobile: { w: '375px', h: '667px', maxH: '92%', btn: 'btn-prev-mobile' },
        tablet: { w: '768px', h: '850px', maxH: '94%', btn: 'btn-prev-tablet' },
        desktop: { w: '100%', h: '100%', maxH: '100%', btn: 'btn-prev-desktop' }
    };
    const config = deviceSizes[type] || deviceSizes.desktop;
    screen.style.width = config.w;
    screen.style.maxWidth = config.w;
    screen.style.height = config.h;
    screen.style.maxHeight = config.maxH;
    const btn = document.getElementById(config.btn);
    if (btn) btn.classList.add('active-state');
}

// ============================================================
// ✅ STATUS STRIP
// ============================================================
function _setChipContent(elId, html, className) {
    const el = document.getElementById(elId);
    if (!el) return false;
    if (className !== undefined) el.className = className;
    el.innerHTML = html;
    return true;
}

function updateStatusMode(isPro, planCode = null) {
    if (isPro) {
        _setChipContent('statusMode',
            `<span class="pulse-dot green"></span><span>PRO ${planCode || ''}</span>`,
            'status-chip pro-active');
    } else {
        _setChipContent('statusMode',
            `<span class="pulse-dot orange"></span><span>Free Mode</span>`,
            'status-chip free-active');
    }
}

function updateStatusKeyboard(mode) {
    const icon = mode === 'system' ? '📱' : '⌨️';
    const label = mode === 'system' ? 'System' : 'Virtual';
    _setChipContent('statusKeyboard',
        `<span class="chip-icon">${icon}</span><span>${label}</span>`);
}

function updateStatusLanguage(layout) {
    const names = {
        'english': 'English',
        'roman': 'Santali (R)',
        'hindi-dev': 'हिन्दी',
        'santali-dev': 'Santali (D)',
        'olchiki': 'ओ़लचिकी'
    };
    _setChipContent('statusLanguage',
        `<span class="chip-icon">🌐</span><span>${names[layout] || layout}</span>`);
    _call('updateFocusBarHeading', layout);
}

function updateStatusSave(state) {
    if (state === 'typing') {
        _setChipContent('statusSave',
            `<span class="pulse-dot orange"></span><span>Saving...</span>`,
            'status-chip save-typing');
    } else {
        _setChipContent('statusSave',
            `<span class="chip-icon">💾</span><span>Saved</span>`,
            'status-chip save-ok');
    }
}

function updateStatusNetwork(isOnline) {
    if (isOnline) {
        _setChipContent('statusNetwork',
            `<span class="pulse-dot green"></span><span>Online</span>`,
            'status-chip');
    } else {
        _setChipContent('statusNetwork',
            `<span class="pulse-dot red"></span><span>Offline</span>`,
            'status-chip warn-state');
    }
}

function updateStatusChars(count) {
    _setChipContent('statusChars',
        `<span class="chip-icon">📝</span><span>${count} chars</span>`);
}

function updateStatusWords(count) {
    _setChipContent('statusWords',
        `<span class="chip-icon">📊</span><span>${count} words</span>`);
}

function updateStatusFont(fontName) {
    const short = String(fontName || 'Roboto').replace(/['"]/g, '').split(',')[0].trim();
    _setChipContent('statusFont',
        `<span class="chip-icon">Aa</span><span>${short}</span>`);
}

function updateStatusTime() {
    const el = document.getElementById('statusTime');
    if (!el) return;
    let timeStr;
    try {
        timeStr = new Date().toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        timeStr = new Date().toLocaleTimeString();
    }
    if (el.dataset.lastTime === timeStr) return;
    el.dataset.lastTime = timeStr;

    let timeSpan = el.querySelector('.status-time-value');
    if (!timeSpan) {
        if (typeof el.replaceChildren === 'function') el.replaceChildren();
        else el.innerHTML = '';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'chip-icon';
        iconSpan.textContent = '🕐';
        timeSpan = document.createElement('span');
        timeSpan.className = 'status-time-value';
        el.appendChild(iconSpan);
        el.appendChild(timeSpan);
    }
    timeSpan.textContent = timeStr;
}

function updateStatusWPM(wpm) {
    const speed = Number(wpm) || 0;
    let color = 'default';
    let icon = '⚡';
    if (speed >= 60) { color = 'pro-active'; icon = '🚀'; }
    else if (speed >= 40) { color = 'save-ok'; icon = '⚡'; }
    else if (speed >= 20) { color = 'save-typing'; icon = '⌨️'; }
    else if (speed > 0) { color = 'warn-state'; icon = '🐢'; }
    const className = 'status-chip' + (color !== 'default' ? ' ' + color : '');
    _setChipContent('statusWPM',
        `<span class="chip-icon">${icon}</span><span>${speed} WPM</span>`,
        className);
}

function startTimeUpdate() {
    if (_timeUpdateInterval) clearInterval(_timeUpdateInterval);

    const tick = () => {
        if (document.visibilityState === 'visible') updateStatusTime();
    };

    _timeUpdateInterval = setInterval(tick, 1000);
    updateStatusTime();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') updateStatusTime();
    });
}

// ============================================================
// 🌐 NETWORK LISTENERS
// ============================================================
window.addEventListener('online', () => updateStatusNetwork(true));
window.addEventListener('offline', () => updateStatusNetwork(false));

// ============================================================
// 📝 EDITOR EVENT LISTENERS
// ============================================================
function setupEditorListeners() {
    const editor = document.getElementById('editor');
    if (!editor) return;
    if (editor.dataset.appListenersBound === '1') return;
    editor.dataset.appListenersBound = '1';

    const onInteraction = () => {
        _call('enterTypingMode');
        _call('saveCurrentSelection');
    };

    editor.addEventListener('focus', onInteraction);
    editor.addEventListener('click', onInteraction);
    editor.addEventListener('keyup', () => _call('saveCurrentSelection'));
    editor.addEventListener('mouseup', () => _call('saveCurrentSelection'));

    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        const sanitized = (typeof SecurityShield !== 'undefined')
            ? SecurityShield.sanitize(text)
            : text;
        if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
            document.execCommand('insertText', false, sanitized);
        } else {
            _call('addChar', sanitized);
        }
        _call('handleEditorInput', true);
    });

    editor.addEventListener('beforeinput', (e) => {
        if (window.keyboardMode !== 'system') return;
        if (!e.data || e.data.length !== 1) return;
        const char = e.data;
        let mapped = null;
        if (window.currentLayout === 'santali-dev' || window.currentLayout === 'hindi-dev') {
            mapped = typeof hardwareDevMap !== 'undefined' ? hardwareDevMap[char] : null;
        } else if (window.currentLayout === 'olchiki') {
            mapped = typeof hardwareOlchikiMap !== 'undefined'
                ? hardwareOlchikiMap[char.toLowerCase()]
                : null;
        }
        if (mapped) {
            e.preventDefault();
            _call('addCharWithPhonics', mapped);
        }
    });
}

// ============================================================
// ⌨️ GLOBAL KEYBOARD HANDLER
// ============================================================
document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape' && (isTTSSpeaking() || _ttsState.paused)) {
        stopSpeaking();
        return;
    }
    if (e.ctrlKey || e.metaKey) return;
    if (document.body.classList.contains('system-keyboard-active')) return;

    const editor = document.getElementById('editor');
    if (document.activeElement !== editor) return;

    if (window.currentLayout === 'roman' && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        _call('addCharWithPhonics', e.shiftKey ? 'Ñ' : 'ñ');
        _call('flashKeyVisual', 'ñ');
        return;
    }
    if (e.altKey) return;
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Backspace' ||
        e.key === ' ' || e.code === 'Space') return;
    if (e.key.length !== 1) return;

    if (/^[0-9]$/.test(e.key) ||
        (typeof allKeySymbols !== 'undefined' && allKeySymbols.includes(e.key))) {
        if (window.currentLayout &&
            window.currentLayout !== 'english' &&
            window.currentLayout !== 'roman' &&
            (e.key === ']' || e.key === '}')) {
            e.preventDefault();
            _call('addCharWithPhonics', '़');
            return;
        }
        e.preventDefault();
        _call('addCharWithPhonics', e.key);
        _call('flashKeyVisual', e.key);
        return;
    }

    if (window.currentLayout === 'english') {
        e.preventDefault();
        _call('addCharWithPhonics', e.key);
        _call('flashKeyVisual', e.key);
        return;
    }
    if (!_hasProAccess()) return;

    if (window.currentLayout === 'roman') {
        e.preventDefault();
        _call('addCharWithPhonics', e.key);
        _call('flashKeyVisual', e.key);
        return;
    }
    if (window.currentLayout === 'santali-dev' || window.currentLayout === 'hindi-dev') {
        const mapped = typeof hardwareDevMap !== 'undefined' ? hardwareDevMap[e.key] : null;
        if (mapped) {
            e.preventDefault();
            _call('addCharWithPhonics', mapped);
            _call('flashKeyVisual', mapped);
        }
        return;
    }
    if (window.currentLayout === 'olchiki') {
        const mapped = typeof hardwareOlchikiMap !== 'undefined'
            ? hardwareOlchikiMap[e.key.toLowerCase()]
            : null;
        if (mapped) {
            e.preventDefault();
            _call('addCharWithPhonics', mapped);
            _call('flashKeyVisual', mapped);
        }
        return;
    }
});

window.addEventListener('resize', _throttle(() => _call('saveCurrentSelection'), 150));

// ============================================================
// 📲 PWA INSTALL PROMPT
// ============================================================
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); });

// ============================================================
// 🔄 SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => {
                console.log('Service Worker Scope:', reg.scope);
                reg.addEventListener('updatefound', () => {
                    console.log('🔄 Service Worker update found');
                });
            })
            .catch((err) => console.error('Service Worker Error:', err));
    });
}

// ============================================================
// 🎁 TRIAL DEBUG (hidden in prod by Fix #4)
// ============================================================
window.TrialDebug = {
    reset: async () => {
        if (typeof TrialSystem !== 'undefined') {
            await TrialSystem.reset(true);
            location.reload();
        }
    },
    extend: async (days = 7) => {
        if (typeof TrialSystem !== 'undefined') {
            const key = localStorage.getItem('hor_trial_key');
            if (key && typeof TrialSystem.testTimeTravel === 'function') {
                await TrialSystem.testTimeTravel(key, -Math.abs(days));
                location.reload();
            } else {
                console.warn('No active trial key found to extend');
            }
        }
    },
    info: () => {
        if (typeof TrialSystem !== 'undefined') console.table(TrialSystem.getInfo());
    }
};

// ============================================================
// 🔊 TTS DEBUG
// ============================================================
window.TTSDebug = {
    voices: () => {
        const voices = _getVoicesCached();
        console.table(voices.map(v => ({ name: v.name, lang: v.lang, local: v.localService })));
    },
    currentLang: () => {
        const config = _getTTSConfig();
        const voices = _getVoicesCached();
        const langPrefix = config.lang.split('-')[0];
        const filtered = voices.filter(v => v.lang.startsWith(langPrefix));
        console.log(`🔊 Voices for ${config.label} (${config.lang}):`);
        console.table(filtered.map(v => ({ name: v.name, lang: v.lang, local: v.localService })));
    },
    top30: () => {
        const allVoices = _getVoicesCached();
        const config = _getTTSConfig();
        const result = _getTopVoices(allVoices, config, MAX_VOICES_TO_SHOW);
        console.log('═══════════════════════════════════════════');
        console.log('🎯 TOP VOICES');
        console.log('═══════════════════════════════════════════');
        console.log('\n🌟 RECOMMENDED (' + result.recommended.length + '):');
        console.table(result.recommended.map(v => ({
            name: v.name, lang: v.lang, local: v.localService, score: _scoreVoice(v)
        })));
        console.log('\n🌐 OTHER (' + result.other.length + '):');
        console.table(result.other.map(v => ({
            name: v.name, lang: v.lang, local: v.localService, score: _scoreVoice(v)
        })));
        console.log('═══════════════════════════════════════════');
    },
    state: () => {
        console.log('🔊 TTS State:');
        console.log('  Speaking (our):', _ttsState.speaking);
        console.log('  Paused (our):', _ttsState.paused);
        console.log('  Speaking (browser):', window.speechSynthesis.speaking);
        console.log('  Paused (browser):', window.speechSynthesis.paused);
        console.log('  isTTSSpeaking():', isTTSSpeaking());
        console.log('  Selected voice:', _ttsState.selectedVoiceName || 'auto');
        console.log('  Rate/Pitch/Volume:', _ttsState.rate, '/', _ttsState.pitch, '/', _ttsState.volume);
        console.log('  Highlight enabled:', _ttsState.highlightEnabled);
        console.log('  Language:', window.currentLayout || 'english');
        console.log('  Session ID:', _ttsState._speakSession);
        console.log('  Chunk:', _ttsState._currentChunkIdx, '/', _ttsState._chunks.length);
        console.log('  Active utterance:', !!_ttsState._activeUtterance);
    },
    test: () => testVoice(),
    stop: () => stopSpeaking(),
    pause: () => pauseSpeaking(),
    resume: () => resumeSpeaking(),
    highlightOn: () => {
        _ttsState.highlightEnabled = true;
        saveTTSSettings();
        console.log('✨ Highlight ON');
    },
    highlightOff: () => {
        _ttsState.highlightEnabled = false;
        _highlightClear();
        saveTTSSettings();
        console.log('✨ Highlight OFF');
    },
    favorites: () => console.log('⭐ Favorites:', _loadFavorites()),
    recent: () => console.log('🕐 Recent:', _loadRecent()),
    clearFavorites: () => { _saveFavorites([]); console.log('🗑️ Favorites cleared'); },
    clearRecent: () => {
        try { localStorage.removeItem(RECENT_KEY); } catch (e) {}
        console.log('🗑️ Recent cleared');
    },
    reset: () => {
        try { localStorage.removeItem('hor_tts_settings'); } catch (e) {}
        _ttsState.selectedVoiceName = null;
        _ttsState.rate = 1.0;
        _ttsState.pitch = 1.0;
        _ttsState.volume = 1.0;
        _ttsState.highlightEnabled = true;
        console.log('🔄 TTS settings reset');
    },
    chunks: (text) => {
        if (!text) text = 'This is a test. It has multiple sentences. And some more text here!';
        const config = _getTTSConfig();
        const chunks = chunkText(text, config.chunkSize);
        console.log(`📝 Chunking (${config.chunkSize} chars):`);
        console.log('  Total chunks:', chunks.length);
        chunks.forEach((c, i) => console.log(`  [${i + 1}] (${c.length}):`, c));
        return chunks;
    },
    refresh: () => { _invalidateVoiceCache(); console.log('🔄 Voice cache invalidated'); },
    cache: () => {
        console.log('🔊 Voice Cache:');
        console.log('  Cached:', !!_voiceCache);
        console.log('  Count:', _voiceCache ? _voiceCache.length : 0);
        console.log('  Age:', _voiceCache ? Math.round((Date.now() - _voiceCacheTimestamp) / 1000) + 's' : 'N/A');
    },
    openModal: () => { openVoiceSettingsModal(); console.log('🎙️ Voice modal opened'); },
    testSessionSafety: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 TTS SESSION SAFETY TEST');
        console.log('  Current session:', _ttsState._speakSession);
        console.log('═══════════════════════════════════════════');
    },
    testVolumePersistence: () => {
        const saved = localStorage.getItem('hor_tts_settings');
        const originalVolume = _ttsState.volume;
        console.log('  Current volume:', originalVolume);
        _ttsState.volume = 0;
        saveTTSSettings(true);
        loadTTSSettings();
        console.log('  Loaded volume (expect 0):', _ttsState.volume);
        _ttsState.volume = originalVolume;
        if (saved) {
            try { localStorage.setItem('hor_tts_settings', saved); } catch (e) {}
        } else {
            saveTTSSettings(true);
        }
        console.log('  Volume restored:', _ttsState.volume);
    }
};

// ============================================================
// 🎯 FOCUS MODE DEBUG
// ============================================================
window.FocusDebug = {
    state: () => {
        console.log('🎯 Focus Mode State:');
        console.log('  Body class "typing-focus":', document.body.classList.contains('typing-focus'));
        console.log('  Heading text:', document.getElementById('focusHeadingText')?.textContent);
        console.log('  Heading badge:', document.getElementById('focusHeadingBadge')?.textContent);
        console.log('  Heading icon:', document.getElementById('focusHeadingIcon')?.textContent);
        console.log('  Current layout:', window.currentLayout || 'unknown');
    },
    enable: () => {
        document.body.classList.add('typing-focus');
        updateFocusBarHeading(window.currentLayout || 'english');
        console.log('🎯 Focus mode enabled (manual)');
    },
    disable: () => {
        document.body.classList.remove('typing-focus');
        console.log('🎯 Focus mode disabled (manual)');
    },
    updateHeading: (layout) => {
        updateFocusBarHeading(layout || window.currentLayout);
        console.log('🎯 Heading updated for:', layout || window.currentLayout);
    }
};

// ============================================================
// 🔤 FONT DEBUG
// ============================================================
window.FontDebug = {
    status: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🔤 Font Debug');
        const fd = document.getElementById('fontFamilySelect');
        if (!fd) { console.error('❌ #fontFamilySelect not found'); return; }
        console.log('  languageFontsDB loaded:', typeof languageFontsDB !== 'undefined');
        console.log('  Dropdown options:', fd.options.length);
        console.log('  Selected value:', fd.value);
        console.log('  Current layout:', window.currentLayout || 'unknown');
        console.log('═══════════════════════════════════════════');
    },
    forceInit: () => {
        _call('forceInitFontDropdown');
        console.log('🔄 Force font init triggered');
    }
};

// ============================================================
// 📊 APP DEBUG
// ============================================================
window.AppDebug = {
    status: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🚀 App Status');
        console.log('  appReady:', window.__appReady);
        console.log('  Time interval:', !!_timeUpdateInterval);
        console.log('  TTS speaking (our):', _ttsState.speaking);
        console.log('  TTS paused (our):', _ttsState.paused);
        console.log('  TTS speaking (browser):', window.speechSynthesis.speaking);
        console.log('  isTTSSpeaking():', isTTSSpeaking());
        console.log('  TTS voice:', _ttsState.selectedVoiceName || 'auto');
        console.log('  TTS session:', _ttsState._speakSession);
        console.log('  Highlight:', _ttsState.highlightEnabled);
        console.log('  Recognition:', recognition ? 'initialized' : 'none');
        console.log('  Recognition lang:', _lastRecognitionLang || 'not set');
        console.log('  Is listening:', isListening);
        console.log('  Restart count:', _recognitionRestartCount);
        console.log('═══════════════════════════════════════════');
    },
    testTTS: (text = 'Hello world') => {
        try {
            speechSynthesis.cancel();
            _ttsState._speakSession++;
            _ttsState.speaking = false;
            _ttsState.paused = false;
        } catch (e) {}
        setTimeout(() => {
            const u = new SpeechSynthesisUtterance(text);
            const voice = getSelectedVoice();
            if (voice) { u.voice = voice; u.lang = voice.lang; }
            u.rate = _ttsState.rate;
            u.volume = (typeof _ttsState.volume === 'number') ? _ttsState.volume : 1.0;
            speechSynthesis.speak(u);
        }, 100);
    },
    testChunks: (text) => {
        console.log('📝 Chunking:', text);
        const config = _getTTSConfig();
        const chunks = chunkText(text, config.chunkSize);
        console.log('Total chunks:', chunks.length);
        chunks.forEach((c, i) => console.log(`  [${i + 1}] (${c.length})`, c));
    },
    testSafariCompat: () => {
        const samples = [
            'This is sentence one. This is sentence two! Question here? Done.',
            'क्या आप ठीक हैं। मैं ठीक हूँ॥ यह एक वाक्य है। और यह दूसरा।',
            'ᱚᱞ ᱪᱤᱠᱤ ᱫᱚ ᱥᱟᱱᱛᱟᱲ ᱯᱟᱹᱨᱥᱤ ᱨᱮᱱᱟᱜ ᱪᱤᱠᱤ ᱠᱟᱱᱟ ᱾ ᱱᱚᱶᱟ ᱱᱟᱶᱟ ᱾',
            'Mr. Smith met Dr. Jones at 3 p.m. yesterday... it was great!'
        ];
        samples.forEach((sample, i) => {
            console.log(`\n📝 Sample ${i + 1}:`);
            const chunks = chunkText(sample, 50);
            chunks.forEach((c, j) => console.log(`  [${j + 1}] ${c}`));
        });
        console.log('\n✅ Compatibility test complete');
    },
    testTTSSession: async () => {
        const initialSession = _ttsState._speakSession;
        stopSpeaking();
        const passed = _ttsState._speakSession > initialSession;
        console.log('Session test:', passed ? '✅ PASS' : '❌ FAIL');
        return { passed, initialSession, newSession: _ttsState._speakSession };
    },
    testVoiceFilter: () => {
        const allVoices = _getVoicesCached();
        const config = _getTTSConfig();
        const { recommended, other } = _getTopVoices(allVoices, config, MAX_VOICES_TO_SHOW);
        console.log('Voice filter:', {
            total: allVoices.length,
            recommended: recommended.length,
            other: other.length,
            passed: (recommended.length + other.length) <= MAX_VOICES_TO_SHOW
        });
    },
    testDoubleKeyFix: () => {
        console.log('🧪 Test: click editor, press Space ONCE → expect 1 character');
    }
};

// ============================================================
// 🔒 DEBUG SECURITY — shared state helpers
// ============================================================
const _DEBUG_ATTEMPT_KEY = 'hor_debug_attempts';
const _DEBUG_LOCKOUT_KEY = 'hor_debug_lockout';
const _DEBUG_MAX_ATTEMPTS = 5;
const _DEBUG_LOCKOUT_MS = 5 * 60 * 1000;

function _getDebugAttempts() {
    try {
        const raw = sessionStorage.getItem(_DEBUG_ATTEMPT_KEY);
        return raw ? JSON.parse(raw) : { count: 0, firstAttempt: null };
    } catch (e) { return { count: 0, firstAttempt: null }; }
}

function _recordDebugAttempt() {
    const state = _getDebugAttempts();
    state.count = (state.count || 0) + 1;
    if (!state.firstAttempt) state.firstAttempt = Date.now();
    try { sessionStorage.setItem(_DEBUG_ATTEMPT_KEY, JSON.stringify(state)); } catch (e) {}
}

function _isDebugLockedOut() {
    try {
        const raw = sessionStorage.getItem(_DEBUG_LOCKOUT_KEY);
        if (!raw) return false;
        const until = parseInt(raw, 10);
        if (Date.now() < until) return true;
        sessionStorage.removeItem(_DEBUG_LOCKOUT_KEY);
        sessionStorage.removeItem(_DEBUG_ATTEMPT_KEY);
        return false;
    } catch (e) { return false; }
}

function _setDebugLockout() {
    try { sessionStorage.setItem(_DEBUG_LOCKOUT_KEY, String(Date.now() + _DEBUG_LOCKOUT_MS)); } catch (e) {}
}

window.AppDebug.securityStatus = () => {
    const st = _getDebugAttempts();
    const locked = _isDebugLockedOut();
    console.log('🔒 Debug Security:');
    console.log('  Attempts:', st.count || 0, '/', _DEBUG_MAX_ATTEMPTS);
    console.log('  Locked out:', locked);
    if (locked) {
        try {
            const until = parseInt(sessionStorage.getItem(_DEBUG_LOCKOUT_KEY), 10);
            console.log('  Locked until:', new Date(until).toLocaleTimeString());
        } catch (e) {}
    }
};

// ============================================================
// 🔒 DEBUG SECURITY IIFE — FIX #4 (PWA + Electron coverage)
// ============================================================
(function setupDebugSecurity() {
    function _isDevHost(hostname) {
        if (!hostname) return false;
        const hn = hostname.toLowerCase();
        if (['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(hn)) return true;
        if (hn.endsWith('.local') || hn.endsWith('.localhost') ||
            hn.endsWith('.test') || hn.endsWith('.dev') ||
            hn.endsWith('.internal')) return true;
        if (hn.startsWith('192.168.') || hn.startsWith('10.')) return true;
        const ipMatch = hn.match(/^172\.(\d+)\./);
        if (ipMatch && parseInt(ipMatch[1], 10) >= 16 && parseInt(ipMatch[1], 10) <= 31) return true;
        return false;
    }

    function _detectProduction() {
        if (window.electronAPI && window.electronAPI.isPackaged === true) return true;
        if (location.protocol === 'file:') return true;
        if (location.protocol === 'https:' && !_isDevHost(location.hostname)) return true;
        if (location.protocol === 'http:' && !_isDevHost(location.hostname)) return true;
        return false;
    }

    let isProduction = _detectProduction();
    try {
        if (!isProduction && localStorage.getItem('hor_test_prod_mode') === 'true') {
            isProduction = true;
            console.log('🔒 Forced production mode (hor_test_prod_mode=true)');
        }
    } catch (e) {}

    console.log('═══════════════════════════════════════════');
    console.log('🔒 Debug Security (Fix #4)');
    console.log('  Environment:', isProduction ? '🔒 PRODUCTION' : '🔓 DEVELOPMENT');
    console.log('  Protocol:', location.protocol);
    console.log('  Hostname:', location.hostname || '(none)');
    console.log('  Electron packaged:', !!(window.electronAPI && window.electronAPI.isPackaged));
    console.log('═══════════════════════════════════════════');

    const _H1 = '0000000000000000';
    const _H2 = '0000000000000000';
    const _H3 = '0000000000000000';
    const _H4 = '0000000000000000';
    const EXPECTED_HASH = (_H1 + _H2 + _H3 + _H4).toLowerCase();
    const SALT_SUFFIX = '::horkatha-v3';
    const PLACEHOLDER_HASH = '0'.repeat(64);
    const IS_HASH_CONFIGURED = EXPECTED_HASH !== PLACEHOLDER_HASH;

    const DEBUG_TOOLS = [
        'TrialDebug', 'LicenseDebug', 'TTSDebug', 'FocusDebug',
        'FontDebug', 'AppDebug', 'AudioDebug', 'EditorDebug',
        'KeyboardDebug', 'ModalsDebug', 'CertificateDebug', 'PrintDebug',
        'CryptoDebug', 'TypingTestDebug', 'SecurityDebug', 'TrackerDebug',
        'AlertsDebug', 'PrivacyDebug', 'KeymapsDebug', 'QRCodeDebug',
        'OfflineQRCodeDebug', 'DebugHashTool'
    ];

    const _debugBackups = {};
    window.__debugUnlocked = false;

    if (isProduction && typeof window.TrialSystem !== 'undefined') {
        const _origReset = window.TrialSystem.reset;
        const _origTimeTravel = window.TrialSystem.testTimeTravel;

        if (typeof _origReset === 'function') {
            window.TrialSystem.reset = async function(adminOverride = false) {
                if (window.__debugUnlocked !== true) {
                    console.warn('🔒 TrialSystem.reset: production-locked');
                    return { success: false, reason: 'production-locked' };
                }
                return _origReset.call(this, adminOverride);
            };
        }

        if (typeof _origTimeTravel === 'function') {
            window.TrialSystem.testTimeTravel = async function(key, days) {
                if (window.__debugUnlocked !== true) {
                    console.warn('🔒 TrialSystem.testTimeTravel: production-locked');
                    return { success: false, error: 'production-locked' };
                }
                return _origTimeTravel.call(this, key, days);
            };
        }

        console.log('🔒 TrialSystem critical methods protected');
    }

    const DebugHashTool = {
        async generate(pwd) {
            if (!crypto || !crypto.subtle) {
                console.error('❌ crypto.subtle unavailable');
                return null;
            }
            if (typeof pwd !== 'string' || pwd.length === 0) {
                console.error('❌ Password must be non-empty string');
                return null;
            }
            const buf = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(pwd + SALT_SUFFIX)
            );
            const hash = Array.from(new Uint8Array(buf))
                .map(b => b.toString(16).padStart(2, '0')).join('');

            console.log('🔑 SHA-256 Hash for "' + pwd + '":');
            console.log('%c' + hash, 'color:#22c55e;font-weight:bold;font-size:13px;');
            console.log('');
            console.log('→ Paste these 4 lines into app.js:');
            console.log(`   const _H1 = '${hash.substring(0, 16)}';`);
            console.log(`   const _H2 = '${hash.substring(16, 32)}';`);
            console.log(`   const _H3 = '${hash.substring(32, 48)}';`);
            console.log(`   const _H4 = '${hash.substring(48, 64)}';`);
            return hash;
        },
        async verify(pwd) {
            if (!crypto || !crypto.subtle) return false;
            const buf = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(pwd + SALT_SUFFIX)
            );
            const hash = Array.from(new Uint8Array(buf))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            return hash === EXPECTED_HASH;
        }
    };
    window.DebugHashTool = DebugHashTool;

    async function verifyPassword(pwd) {
        try {
            if (!crypto || !crypto.subtle) return false;
            const buf = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(pwd + SALT_SUFFIX)
            );
            const hash = Array.from(new Uint8Array(buf))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            return hash === EXPECTED_HASH;
        } catch (e) {
            console.error('Hash verify error:', e);
            return false;
        }
    }

    function _captureAndHide() {
        if (window.__debugUnlocked === true) return 0;
        let removed = 0;
        DEBUG_TOOLS.forEach(name => {
            const tool = window[name];
            if (tool !== undefined && tool !== null) {
                _debugBackups[name] = tool;
                try {
                    delete window[name];
                    removed++;
                } catch (e) {
                    try { window[name] = undefined; removed++; } catch (e2) {}
                }
            }
        });
        return removed;
    }

    function _restoreAll() {
        let restored = 0;
        Object.keys(_debugBackups).forEach(name => {
            const tool = _debugBackups[name];
            if (tool !== undefined && tool !== null) {
                try {
                    window[name] = tool;
                    restored++;
                } catch (e) {}
            }
        });
        return restored;
    }

    if (isProduction) {
        const removed1 = _captureAndHide();
        console.log('🔒 Immediately removed ' + removed1 + ' debug tools');

        const reHide = function() {
            const removed2 = _captureAndHide();
            if (removed2 > 0) {
                console.log('🔒 Post-load removed ' + removed2 + ' more debug tools');
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', reHide, { once: true });
        } else {
            setTimeout(reHide, 100);
        }
        window.addEventListener('load', function() {
            setTimeout(reHide, 50);
        }, { once: true });

        console.log('');
        console.log('🔒 PRODUCTION — Debug hidden');
        console.log('   Unlock: Ctrl+Shift+Alt+D');
        console.log('   Hash configured:', IS_HASH_CONFIGURED ? '✅' : '❌ (unlock disabled)');
        if (!IS_HASH_CONFIGURED) {
            console.warn('   ⚠️ To enable unlock: run DebugHashTool.generate("YourPassword") in dev console');
            console.warn('   ⚠️ Then paste the 4 _H parts into app.js and redeploy');
        }
    } else {
        console.log('🔓 Development — debug tools visible (no password needed)');
    }

    document.addEventListener('keydown', async function(e) {
        if (!(e.ctrlKey && e.shiftKey && e.altKey && e.key.toLowerCase() === 'd')) return;
        if (!isProduction) return;

        e.preventDefault();
        e.stopPropagation();

        if (window.__debugUnlocked === true) {
            if (confirm('🔒 Hide debug tools again?')) {
                window.__debugUnlocked = false;
                const removed = _captureAndHide();
                console.log('🔒 Debug hidden again (' + removed + ' removed)');
                if (typeof showToast === 'function') {
                    showToast('🔒 Debug tools hidden', 'info', 2000);
                }
            }
            return;
        }

        if (_isDebugLockedOut()) {
            console.warn('🔒 Debug unlock locked out');
            try {
                const until = parseInt(sessionStorage.getItem(_DEBUG_LOCKOUT_KEY), 10);
                const remainingMin = Math.max(1, Math.ceil((until - Date.now()) / 60000));
                if (typeof showToast === 'function') {
                    showToast(`🔒 Locked. Try in ${remainingMin} min.`, 'error', 4000);
                } else {
                    alert(`🔒 Locked. Try in ${remainingMin} min.`);
                }
            } catch (e) {
                if (typeof showToast === 'function') showToast('🔒 Locked out.', 'error', 4000);
                else alert('🔒 Locked out.');
            }
            return;
        }

        if (!IS_HASH_CONFIGURED) {
            console.error('⚠️ EXPECTED_HASH not configured!');
            console.error('   1. Open dev (localhost) console');
            console.error('   2. Run: await DebugHashTool.generate("YourPassword")');
            console.error('   3. Copy 4 parts → paste into app.js (_H1.._H4)');
            console.error('   4. Save and redeploy');
            if (typeof showToast === 'function') {
                showToast('⚠️ Debug unlock not configured. See console.', 'error', 5000);
            } else {
                alert('⚠️ Debug unlock not configured.\nSee browser console.');
            }
            return;
        }

        const state = _getDebugAttempts();
        const attemptsLeft = _DEBUG_MAX_ATTEMPTS - (state.count || 0);
        const pwd = prompt(`🔐 Admin Password (${attemptsLeft} attempts left):`);
        if (pwd === null) return;

        const isCorrect = await verifyPassword(pwd);

        if (isCorrect) {
            try {
                sessionStorage.removeItem(_DEBUG_ATTEMPT_KEY);
                sessionStorage.removeItem(_DEBUG_LOCKOUT_KEY);
            } catch (e) {}

            window.__debugUnlocked = true;
            const restored = _restoreAll();

            console.log('🔓 Debug unlocked — ' + restored + ' tools restored');
            if (typeof showToast === 'function') {
                showToast(`🔓 Debug Unlocked! (${restored} tools)`, 'success', 3000);
            } else {
                alert('🔓 Debug Mode Unlocked!');
            }
        } else {
            _recordDebugAttempt();
            const newState = _getDebugAttempts();
            if (newState.count >= _DEBUG_MAX_ATTEMPTS) {
                _setDebugLockout();
                console.warn('🔒 Too many attempts. Locked 5 min.');
                if (typeof showToast === 'function') {
                    showToast('🔒 Too many attempts. Locked 5 min.', 'error', 5000);
                } else {
                    alert('🔒 Too many attempts. Locked 5 min.');
                }
            } else {
                const left = _DEBUG_MAX_ATTEMPTS - newState.count;
                console.warn(`❌ Incorrect. ${left} attempts left.`);
                if (typeof showToast === 'function') {
                    showToast(`❌ Incorrect (${left} left)`, 'error', 3000);
                } else {
                    alert(`❌ Incorrect (${left} attempts left)`);
                }
            }
        }
    }, true);
})();

// ============================================================
// 🚀 INIT — Main App Bootstrap
// ============================================================
(async function initApp() {
    try {
        const progressOverlay = document.getElementById('progressOverlay');
        if (progressOverlay) {
            progressOverlay.classList.remove('active');
            progressOverlay.style.display = 'none';
        }

        const isPreviewMode = new URLSearchParams(location.search).get('preview_mode') === 'true';
        if (isPreviewMode) {
            const prevBtn = document.querySelector('[onclick="openPreviewModal()"]');
            if (prevBtn) prevBtn.style.display = 'none';
            const buyBtn = document.getElementById('btn-buy-top');
            if (buyBtn) buyBtn.style.display = 'none';
            const trialBtn = document.getElementById('btn-trial-top');
            if (trialBtn) trialBtn.style.display = 'none';
        }

        document.querySelectorAll('.modal-overlay, .preview-modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.classList.remove('modal-open');

        const editor = document.getElementById('editor');
        if (editor && typeof initialDefaultCode !== 'undefined') {
            try { window.initialDefaultCode = editor.innerHTML; } catch (e) {}
        }

        try {
            const cleanDefaultKeys = ['english', 'roman', 'hindi-dev', 'santali-dev', 'olchiki'];
            const vocabDB = (typeof userVocabDB !== 'undefined' && userVocabDB)
                || (typeof window !== 'undefined' && window.userVocabDB)
                || null;

            if (vocabDB && typeof defaultWordSuggestions !== 'undefined') {
                cleanDefaultKeys.forEach(k => {
                    if (!vocabDB[k] || !Array.isArray(vocabDB[k])) {
                        vocabDB[k] = [...(defaultWordSuggestions[k] || defaultWordSuggestions['english'])];
                    }
                });
                _call('saveVocabToStorage');
            }

            const savedTheme = localStorage.getItem('hor_katha_theme') || 'dark';
            document.body.setAttribute('data-theme', savedTheme);

            const btn = document.getElementById('btn-theme-toggle');
            if (btn) {
                btn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
                btn.title = savedTheme === 'dark' ? 'Theme: Dark' : 'Theme: Light';
            }
        } catch (e) {
            console.warn('Init state warning:', e.message);
        }

        const paymentCheck = document.getElementById('paymentConfirmCheck');
        const paymentBtn = document.getElementById('btnPaymentDone');
        if (paymentCheck && paymentBtn) {
            paymentCheck.addEventListener('change', function() {
                if (this.checked) {
                    paymentBtn.disabled = false;
                    paymentBtn.style.opacity = '1';
                    paymentBtn.style.cursor = 'pointer';
                } else {
                    paymentBtn.disabled = true;
                    paymentBtn.style.opacity = '0.5';
                    paymentBtn.style.cursor = 'not-allowed';
                }
            });
        }

        setupEditorListeners();
        loadTTSSettings();

        if ('speechSynthesis' in window) {
            speechSynthesis.getVoices();
            speechSynthesis.addEventListener('voiceschanged', () => {
                _invalidateVoiceCache();
                const count = speechSynthesis.getVoices().length;
                console.log('🔊 Voices loaded:', count);
            });
        }

        try {
            if (typeof getDeviceHardwareFingerprint === 'function') {
                await getDeviceHardwareFingerprint();
            }
        } catch (e) {
            console.warn('HWID generation failed:', e.message);
        }

        await _call('checkLicenseIntegrity');

        if (typeof window.keyboardMode !== 'undefined') {
            _call('setKeyboardPreference', window.keyboardMode);
        }

        _call('switchLanguage', 'english');

        setTimeout(() => {
            try {
                if (typeof forceInitFontDropdown === 'function') {
                    forceInitFontDropdown();
                    console.log('✅ Font dropdown initialized');
                } else if (typeof autoSyncLanguageFonts === 'function') {
                    autoSyncLanguageFonts(window.currentLayout || 'english');
                    console.log('✅ Font dropdown initialized (fallback)');
                }
            } catch (e) {
                console.warn('⚠️ Font init failed:', e.message);
            }
        }, 500);

        if (typeof window.isNumpadActive !== 'undefined' && window.isNumpadActive) {
            const kn = document.getElementById('keyboardNumpad');
            if (kn) kn.classList.add('active');
            const btn = document.getElementById('btn-numpad-toggle');
            if (btn) btn.classList.add('active-state');
        }

        _call('restorePersistedDraft');
        _call('recordState');
        _call('updateCounter');

        updateStatusKeyboard(window.keyboardMode || 'virtual');
        updateStatusLanguage(window.currentLayout || 'english');
        updateStatusSave('saved');
        updateStatusNetwork(navigator.onLine);
        updateStatusWPM(0);
        updateStatusFont((editor && editor.style.fontFamily) || 'Roboto');

        startTimeUpdate();
        updateFocusBarHeading(window.currentLayout || 'english');

        if (typeof APP_CONFIG !== 'undefined' &&
            APP_CONFIG.TRIAL_ENABLED &&
            typeof TrialSystem !== 'undefined' &&
            TrialSystem.isActive()) {
            const trialBadge = document.getElementById('trialBadge');
            if (trialBadge) {
                const trialInfo = TrialSystem.getInfo();
                trialBadge.textContent = `🎁 Trial (${trialInfo.remainingDays}d)`;
                trialBadge.style.display = 'inline-block';
            }
        }

        setTimeout(() => _call('showConsentBanner'), 400);

        console.log('🛡️ Security Shield Active');
        console.log('✅ App initialized — Hoṛ Katha Suite v3.7.4');

    } catch (err) {
        console.error('💥 initApp failed:', err);
    } finally {
        setTimeout(function() {
            window.__appReady = true;
            console.log('🔓 App ready');
            try { window.dispatchEvent(new Event('app-ready')); } catch (e) {}
            setTimeout(() => _call('forceInitFontDropdown'), 200);
        }, 500);
    }
})();

// ============================================================
// 🧹 CLEANUP on unload
// ============================================================
window.addEventListener('beforeunload', () => {
    saveTTSSettings(true);
    if (_timeUpdateInterval) {
        clearInterval(_timeUpdateInterval);
        _timeUpdateInterval = null;
    }
    clearTimeout(_voiceSearchDebounce);
    _voiceSearchDebounce = null;
    try {
        if (speechSynthesis.speaking || speechSynthesis.paused) speechSynthesis.cancel();
    } catch (e) {}
    try { if (recognition && isListening) recognition.stop(); } catch (e) {}
});

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ app.js loaded — v3.7.4 Pro Ultra (Fix #3 + #4)');
console.log('   ✨ Hindi Phonetic TTS → uses Hindi Devanagari voice');
console.log('   ✨ Hindi Phonetic Recognition → hi-IN');
console.log('   ✨ Hindi Phonetic Focus Heading → "हिन्दी ✨"');
console.log('   🔒 PWA debug tools hidden in production');
console.log('   🔒 TrialSystem.reset/testTimeTravel protected');
console.log('   🔑 Unlock: Ctrl+Shift+Alt+D (password required)');
console.log('   ⏸️ Pause / ▶️ Resume / ⏹️ Stop (Esc)');
console.log('   ✨ Word highlighting (auto-injected CSS)');
console.log('   ⏮️ Resume-from-position memory');
console.log('   ⭐ Favorites + 🕐 Recent + 🔍 Fuzzy search');
console.log('   ⌨️ Keyboard nav (↑↓ Enter Esc)');
console.log('   🔒 Debug rate-limit: 5 attempts → 5-min lockout');
console.log('   🎤 Recognition exponential backoff + network retry');
console.log('   ⚡ Throttled saves + visibility-aware timer');
console.log('   🛡️ Global error boundaries');
console.log('   🎯 30-voice cap (favorites/recent prioritized)');
console.log('═══════════════════════════════════════════');

// ============================================================
// 🧠 HINDI PHONETIC — switchLanguage Wrapper (LipiCraft merge)
// ============================================================
(function patchHindiPhonetic() {
    if (typeof window.switchLanguage !== 'function') {
        console.warn('⚠️ switchLanguage not ready — retry in 100ms');
        setTimeout(patchHindiPhonetic, 100);
        return;
    }
    if (window.__hpPatched) return;

    const original = window.switchLanguage;

    window.switchLanguage = function(lang, ...args) {
        if (lang === 'hindi-phonetic') {
            window.currentLayout = 'hindi-phonetic';
            document.body.setAttribute('data-hindi-phonetic', 'true');

            const kb = document.getElementById('keyboard');
            if (kb) kb.style.display = 'none';
            const np = document.getElementById('keyboardNumpad');
            if (np) np.style.display = 'none';

            const addBtn = document.getElementById('btn-hp-addword');
            if (addBtn) addBtn.style.display = 'inline-block';

            const dt = document.getElementById('deck-mode-title');
            if (dt) dt.textContent = 'Hindi Phonetic — Type English, get Devanagari';

            const lc = document.querySelector('#statusLanguage span:last-child');
            if (lc) lc.textContent = 'Hindi ✨';

            document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
            const tab = document.getElementById('tab-hindi-phonetic');
            if (tab) tab.classList.add('active');

            const ft = document.getElementById('focusHeadingText');
            if (ft) ft.textContent = 'Hindi ✨';
            const fb = document.getElementById('focusHeadingBadge');
            if (fb) fb.textContent = 'HI';
            const fi = document.getElementById('focusHeadingIcon');
            if (fi) fi.textContent = '✨';

            const ed = document.getElementById('editor');
            if (ed) {
                ed.setAttribute('data-placeholder', 'Type in English… (aap kaise hain → आप कैसे हैं)');
                ed.focus();
            }

            console.log('✨ Hindi Phonetic mode ON');
            return;
        }

        document.body.removeAttribute('data-hindi-phonetic');
        const kbR = document.getElementById('keyboard');
        if (kbR) kbR.style.display = '';
        const npR = document.getElementById('keyboardNumpad');
        if (npR) npR.style.display = '';
        const addR = document.getElementById('btn-hp-addword');
        if (addR) addR.style.display = 'none';

        return original.apply(this, [lang, ...args]);
    };

    window.__hpPatched = true;
    console.log('✅ switchLanguage patched for Hindi Phonetic');
})();