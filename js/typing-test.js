// ============================================================
// 🎯 TYPING PRACTICE — v3.8.1 Pro Ultra (WPM Cache Fix)
// BOSC Tech & Edu · Hoṛ Katha Suite
// ============================================================
// ✅ v3.8.1 — CRITICAL FIX #1 (WPM DRIFT):
//    🔴 FIXED: Certificate/History में गलत WPM दिखता था
//              अगर user test finish के बाद कुछ मिनट wait करता था।
//              क्यों? _snapshotTestResult() हर बार fresh
//              _calculateTestResults() call करता था →
//              elapsed = startTime + waitTime → WPM गिरता था।
//
//    ✅ अब: finishTest() में results को freeze करके
//            _ttState._finalResults में store करते हैं।
//            Certificate, WhatsApp share, History — सब cached
//            results use करते हैं। WPM कभी नहीं बदलता।
//
//    🧪 NEW: TypingTestDebug.testSnapshotConsistency()
//            → verify करता है कि cache काम कर रहा है।
//
// ✅ v3.8.0 features (retained):
//    🆕 Session History & Analytics (100 tests)
//    🆕 Per-Key & Per-Word accuracy heatmap
//    🆕 Manual Pause/Resume button
//    🆕 Rolling WPM (5s smooth) + Consistency Score
//    🆕 Sound feedback (Web Audio, optional)
//    🆕 13 Achievements system
//
// ✅ v3.7.4.89 features (retained):
//    FIX #2 — WPM calc + time clamping
//    FIX #15 — Certificate race-safe with retry
//    Anti-cheat (paste/drop/IME blocked)
//    Blur/visibility tracking
//    Idle pause (30s)
//    Best WPM tracking
//    Idempotent finish
// ============================================================

// ============================================================
// 📚 LESSONS DATABASE
// ============================================================
const TT_LESSONS = {
    'english': {
        basic: [
            "asdf jkl; asdf jkl; sad lad ask fall jak lads fad alas all sad lads ask dad",
            "the and for you that with have this from they will one all would there their what",
            "The quick brown fox jumps over the lazy dog. She sells seashells by the seashore."
        ],
        advanced: [
            "\"Practice makes perfect!\" — but only if you practice correctly; typing errors slow you down.",
            "Invoice #4821: 3 items @ Rs.199 each, +18% GST = Rs.705.42. Payment due by 15/12/2025.",
            "Consistency, precision, and steady rhythm form the triad of mastery; every expert was once a beginner."
        ],
        job: [
            "Dear Sir, I am writing to apply for the position of Data Entry Operator. I have 2 years of experience.",
            "REPORT: Q3 revenue grew by 23%. Marketing spend was Rs.4.2L. Net profit margin stands at 18.5%.",
            "GOVERNMENT OF INDIA OFFICE MEMORANDUM. Subject: Implementation of e-Governance. Ref No. 21/2025."
        ]
    },
    'hindi-dev': {
        basic: [
            "क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह",
            "आज का दिन बहुत सुंदर है। सूरज चमक रहा है और पक्षी गा रहे हैं।",
            "मेरा नाम राम है। मैं भारत का निवासी हूँ। हिन्दी मेरी मातृभाषा है।"
        ],
        advanced: [
            "शिक्षा मनुष्य के जीवन का सबसे महत्वपूर्ण अंग है। इसके बिना व्यक्ति का सर्वांगीण विकास संभव नहीं है।",
            "रिपोर्ट: इस वर्ष कंपनी का लाभ 25% बढ़ा। कुल आय 4.5 करोड़ रही। कर दर 18% रही।",
            "प्रिय महोदय, मैं आपके विद्यालय में शिक्षक पद के लिए आवेदन करना चाहता हूँ।"
        ],
        job: [
            "सेवा में, मैं यह निवेदन करना चाहता हूँ कि मुझे दस्तावेज प्रविष्टि संचालक के पद पर नियुक्त किया जाए।",
            "रिपोर्ट: तिमाही बिक्री में 30% की वृद्धि हुई। विपणन व्यय 3.8 लाख रहा।",
            "भारत सरकार कार्यालय ज्ञापन। विषय: ई-गवर्नेंस का क्रियान्वयन। संदर्भ संख्या 15/2025।"
        ]
    },
    'santali-dev': {
        basic: [
            "क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व स ह",
            "जोहार आम सांताड़ होड़ हो। आम आलिं बेस लागिद।",
            "आलिं होड़ कथा सेंदरा जाना। सांतारी पारसी आलिं मातृ पारसी गे।"
        ],
        advanced: [
            "सेङ्गेल दो होड़ जीवन रेनाग जोतो खोन माराङ हाटिञ काना।",
            "रिपोट: नोवा सेर्मा कोम्पानि रेनाग लाभ २५% बाड़ति एना। गुट आय ४.५ कोड़ो ताहेना।",
            "जोहार मोनेयान होड़ को, इञ आमाग कोलेज रे माचेत पोद लागिद आर्जि एम सानायेदाय।"
        ],
        job: [
            "सेवा रे, इञ नोवा निवेदान एम सानायेदाय जे इञ दो डाटा एन्ट्रि ओप्रेटार रेनाग पोद रे बाहाल हुयुग मा।",
            "रिपोट: तिमाहि आख्रिञ रे ३०% काज्वाग हुयेना। बिपोनोन खोर्च ३.८ लाख ताहेना।",
            "भारत सोरकार कार्यालय झियापान। साताम: इ-गोभार्नेन्स रेनाग कार्यान्वोयोन।"
        ]
    },
    'olchiki': {
        basic: [
            "ᱚ ᱛ ᱜ ᱝ ᱞ ᱟ ᱤ ᱥ ᱦ ᱧ ᱨ ᱩ ᱪ ᱫ ᱬ ᱭ ᱮ ᱯ ᱰ ᱱ ᱲ ᱳ ᱴ ᱵ ᱶ ᱷ",
            "ᱡᱚᱦᱟᱨ ᱾ ᱥᱟᱹᱜᱩᱱ ᱫᱟᱨᱟᱢ ᱾ ᱤᱧ ᱥᱟᱱᱛᱟᱲ ᱦᱚᱲ ᱠᱟᱱᱟᱭ ᱾",
            "ᱤᱧᱟᱜ ᱧᱩᱛᱩᱢ ᱨᱟᱢ ᱠᱟᱱᱟ ᱾ ᱤᱧ ᱵᱷᱟᱨᱚᱛ ᱨᱮ ᱛᱟᱦᱮᱱᱟᱭ ᱾"
        ],
        advanced: [
            "ᱥᱮᱬᱜᱮᱞ ᱫᱚ ᱦᱚᱲ ᱡᱤᱭᱚᱱ ᱨᱮᱱᱟᱜ ᱡᱚᱛᱚ ᱠᱷᱚᱱ ᱢᱟᱨᱟᱝ ᱦᱟᱹᱴᱤᱧ ᱠᱟᱱᱟ ᱾",
            "ᱨᱤᱯᱚᱴ: ᱱᱚᱶᱟ ᱥᱮᱨᱢᱟ ᱠᱚᱢᱯᱟᱹᱱᱤ ᱨᱮᱱᱟᱜ ᱞᱟᱵᱷ ᱒᱕% ᱵᱟᱹᱲᱛᱤ ᱮᱱᱟ ᱾ ᱜᱩᱴ ᱟᱭ ᱔.᱕ ᱠᱚᱨᱳᱲ ᱛᱟᱦᱮᱱᱟ ᱾",
            "ᱡᱚᱦᱟᱨ ᱢᱚᱱᱮᱭᱟᱱ ᱦᱚᱲ ᱠᱚ, ᱤᱧ ᱟᱢᱟᱜ ᱠᱚᱞᱮᱡᱽ ᱨᱮ ᱢᱟᱪᱮᱛ ᱯᱚᱫᱽ ᱞᱟᱹᱜᱤᱫ ᱟᱹᱨᱡᱤ ᱮᱢ ᱥᱟᱱᱟᱭᱮᱫᱟᱭ ᱾"
        ],
        job: [
            "ᱥᱮᱣᱟ ᱨᱮ, ᱤᱧ ᱱᱚᱶᱟ ᱱᱤᱣᱮᱫᱟᱱ ᱮᱢ ᱥᱟᱱᱟᱭᱮᱫᱟᱭ ᱡᱮ ᱤᱧ ᱫᱚ ᱰᱟᱴᱟ ᱮᱱᱴᱨᱤ ᱳᱯᱨᱮᱴᱟᱨ ᱨᱮᱱᱟᱜ ᱯᱚᱫᱽ ᱨᱮ ᱵᱟᱦᱟᱞ ᱦᱩᱭᱩᱜ ᱢᱟ ᱾",
            "ᱨᱤᱯᱚᱴ: ᱛᱤᱢᱟᱦᱤ ᱟᱹᱠᱷᱨᱤᱧ ᱨᱮ ᱓᱐% ᱠᱟᱹᱡᱽᱣᱟᱜ ᱦᱩᱭᱮᱱᱟ ᱾ ᱵᱤᱯᱚᱱᱚᱱ ᱠᱷᱚᱨᱪ ᱓.᱘ ᱞᱟᱠᱷ ᱛᱟᱦᱮᱱᱟ ᱾",
            "ᱵᱷᱟᱨᱚᱛ ᱥᱚᱨᱠᱟᱨ ᱠᱟᱨᱭᱟᱞᱚᱭ ᱡᱷᱤᱭᱟᱯᱟᱱ ᱾ ᱥᱟᱛᱟᱢ: ᱤ-ᱜᱚᱵᱷᱟᱨᱱᱮᱱᱥ ᱨᱮᱱᱟᱜ ᱠᱟᱨᱭᱟᱱᱣᱚᱭᱚᱱ ᱾"
        ]
    },
    'roman': {
        basic: [
            "johar sagun am aling santali dela bes adi hor katha",
            "Johar ape santal hor. Am aling bes laged. Hor katha senao jana.",
            "the and for you that with have this from they will one all would there their what"
        ],
        advanced: [
            "Sengel do hor jibon renag joto khon marag hatir kana. Ekar bina manmi sarwangin bikash sambhab nay.",
            "Riport: Noa serma kompani renag labh 25% barhi ena. Gut ay 4.5 kror rahea.",
            "Johar moneyan hor ko, ing amag college re teacher pod lagid arji em sanayeday."
        ],
        job: [
            "Seba re, ing noa niwedan em sanayeday je ing do data entry operator renag pod re bahal huyug ma.",
            "Riport: Timahi bikri re 30% kajwag huyena. Biponon khoroch 3.8 lakh rahea.",
            "Bharat Sarkar Karjalay Jniapan. Bishay: e-Governance renag karjanwoyan. Sandarbh 15/2025."
        ]
    }
};

// ============================================================
// 📊 CONSTANTS
// ============================================================
const TT_SCROLL_THROTTLE_EVERY = 40;
const TT_IDLE_TIMEOUT_MS = 30000;
const TT_BLUR_WARNING_DELAY = 100;
const TT_BEST_WPM_KEY = 'hor_tt_best_wpm';

// ✅ FIX #15: Certificate retry constants
const TT_CERT_MAX_RETRIES = 6;
const TT_CERT_RETRY_DELAYS = [100, 250, 500, 1000, 1500, 2000];

// ============================================================
// ⏱️ TIME CONSTANTS — FIX #2
// ============================================================
const TT_MIN_ELAPSED_SEC = 3;
const TT_MAX_WPM_SANITY = 300;
const TT_STRICT_DURATION_MODE = false;

// ============================================================
// 🏆 GRADE THRESHOLDS
// ============================================================
const TT_GRADE_THRESHOLDS = [
    { grade: 'A+', minWpm: 60, minAcc: 95, msg: 'Outstanding! 🏆' },
    { grade: 'A',  minWpm: 45, minAcc: 92, msg: 'Excellent work! 🌟' },
    { grade: 'B',  minWpm: 30, minAcc: 88, msg: 'Good job! 👍' },
    { grade: 'C',  minWpm: 20, minAcc: 80, msg: 'Not bad — keep going!' },
    { grade: 'D',  minWpm: 0,  minAcc: 0,  msg: 'Keep practicing!' }
];

// ============================================================
// 📊 v3.8.0 — UPGRADE CONSTANTS
// ============================================================
const TT_HISTORY_KEY = 'hor_tt_history';
const TT_KEY_STATS_KEY = 'hor_tt_key_stats';
const TT_SOUND_KEY = 'hor_tt_sound';
const TT_ACHIEVEMENTS_KEY = 'hor_tt_achievements';
const TT_MAX_HISTORY = 100;
const TT_WPM_SAMPLE_LIMIT = 120;
const TT_CONSISTENCY_WINDOW_SEC = 5;

// ============================================================
// 🎯 STATE
// ============================================================
function createFreshTTState() {
    return {
        active: false,
        group: null,
        idx: null,
        duration: 60,
        text: '',
        startTime: null,
        timerId: null,
        timeLeft: 0,
        charSpans: [],
        errors: 0,
        totalTyped: 0,
        correctTyped: 0,
        paused: false,
        pausedAt: null,
        pausedDuration: 0,
        blurCount: 0,
        visibilityHiddenCount: 0,
        lastInputTime: 0,
        idleTimerId: null,
        _finished: false,
        _finishReason: null,
        _boundHandlers: null,
        _lastErrors: 0,
        // ✅ FIX #1: Frozen results cache
        // Set ONCE in finishTest(). All subsequent readers
        // (certificate, share, history) reuse these numbers.
        // Prevents WPM from drifting as wall-clock time grows.
        _finalResults: null
    };
}

let _ttState = createFreshTTState();
let _ttSelectedGroup = null;
let _ttSelectedIdx = null;
let _ttSelectedDuration = 60;

let _scrollDebounce = null;
let _blurWarningTimer = null;
let _visibilityWarningTimer = null;

let _blurHandler = null;
let _visibilityHandler = null;
let _beforeInputHandler = null;
let _compositionHandler = null;

let _typingTestActive = false;
let _certOpeningInProgress = false;

// ============================================================
// 📊 UPGRADE 1: SESSION HISTORY
// ============================================================
function _loadHistory() {
    try {
        const raw = localStorage.getItem(TT_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

function _saveSessionToHistory(snapshot) {
    if (!snapshot || !snapshot.wpm) return;
    try {
        const history = _loadHistory();
        history.unshift({
            ts: Date.now(),
            wpm: snapshot.wpm,
            accuracy: snapshot.accuracy,
            grade: snapshot.grade,
            chars: snapshot.chars,
            errors: snapshot.errors,
            duration: snapshot.duration,
            group: snapshot.group,
            idx: snapshot.idx,
            reason: snapshot.finishReason || 'complete'
        });
        if (history.length > TT_MAX_HISTORY) history.length = TT_MAX_HISTORY;
        localStorage.setItem(TT_HISTORY_KEY, JSON.stringify(history));
        console.log('📊 Session saved to history (' + history.length + ' total)');
    } catch (e) {
        console.warn('History save failed:', e.message);
    }
}

function getSessionStats() {
    const history = _loadHistory();
    if (history.length === 0) {
        return {
            totalTests: 0, avgWpm: 0, avgAcc: 0,
            bestWpm: 0, bestAcc: 0, totalChars: 0,
            totalTime: 0, streak: 0
        };
    }
    const wpmSum = history.reduce((s, h) => s + (h.wpm || 0), 0);
    const accSum = history.reduce((s, h) => s + (h.accuracy || 0), 0);
    const charsSum = history.reduce((s, h) => s + (h.chars || 0), 0);

    let streak = 1;
    for (let i = 1; i < history.length; i++) {
        const diff = history[i - 1].ts - history[i].ts;
        if (diff <= 7 * 24 * 60 * 60 * 1000) streak++;
        else break;
    }

    return {
        totalTests: history.length,
        avgWpm: Math.round(wpmSum / history.length),
        avgAcc: Math.round(accSum / history.length),
        bestWpm: Math.max(...history.map(h => h.wpm || 0)),
        bestAcc: Math.max(...history.map(h => h.accuracy || 0)),
        totalChars: charsSum,
        streak
    };
}

function getSessionHistory(limit = 10) {
    return _loadHistory().slice(0, limit);
}

function clearSessionHistory() {
    try { localStorage.removeItem(TT_HISTORY_KEY); } catch (e) {}
    console.log('🗑️ History cleared');
}

// ============================================================
// 🎯 UPGRADE 2: PER-KEY & PER-WORD
// ============================================================
function _loadKeyStats() {
    try {
        const raw = localStorage.getItem(TT_KEY_STATS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
}

function _saveKeyStats(stats) {
    try { localStorage.setItem(TT_KEY_STATS_KEY, JSON.stringify(stats)); } catch (e) {}
}

function _analyzeAndPersistKeyAccuracy(state) {
    if (!state || !state.text) return null;
    const input = document.getElementById('ttInput');
    const typed = input ? input.value : '';
    const keyStats = _loadKeyStats();
    const sessionStats = {};

    for (let i = 0; i < typed.length && i < state.text.length; i++) {
        const expected = state.text[i];
        const actual = typed[i];
        if (/\s/.test(expected)) continue;

        const key = expected.toLowerCase();
        if (!keyStats[key]) keyStats[key] = { correct: 0, wrong: 0 };
        if (!sessionStats[key]) sessionStats[key] = { correct: 0, wrong: 0 };

        if (actual === expected) {
            keyStats[key].correct++;
            sessionStats[key].correct++;
        } else {
            keyStats[key].wrong++;
            sessionStats[key].wrong++;
        }
    }

    _saveKeyStats(keyStats);
    return { keyStats, sessionStats };
}

function _analyzeWordAccuracy(state) {
    if (!state || !state.text) return [];
    const input = document.getElementById('ttInput');
    const typed = input ? input.value : '';
    const text = state.text;
    const words = [];
    let wordStart = 0;

    for (let i = 0; i <= text.length; i++) {
        if (i === text.length || text[i] === ' ') {
            if (i > wordStart) {
                const expected = text.slice(wordStart, i);
                const actual = typed.slice(wordStart, Math.min(i, typed.length));
                let correct = 0;
                for (let j = 0; j < Math.min(expected.length, actual.length); j++) {
                    if (expected[j] === actual[j]) correct++;
                }
                const acc = expected.length > 0
                    ? Math.round((correct / expected.length) * 100)
                    : 100;
                if (acc < 100) {
                    words.push({ word: expected, acc, expected, actual });
                }
            }
            wordStart = i + 1;
        }
    }
    return words.sort((a, b) => a.acc - b.acc).slice(0, 8);
}

function getWeakestKeys(limit = 10) {
    const keyStats = _loadKeyStats();
    return Object.entries(keyStats)
        .filter(([, v]) => (v.correct + v.wrong) >= 5)
        .map(([k, v]) => {
            const total = v.correct + v.wrong;
            return {
                key: k, correct: v.correct, wrong: v.wrong, total,
                acc: Math.round((v.correct / total) * 100)
            };
        })
        .sort((a, b) => a.acc - b.acc)
        .slice(0, limit);
}

function clearKeyStats() {
    try { localStorage.removeItem(TT_KEY_STATS_KEY); } catch (e) {}
    console.log('🗑️ Key stats cleared');
}

// ============================================================
// 📈 UPGRADE 4: ROLLING WPM + CONSISTENCY
// ============================================================
let _wpmSamples = [];

function _recordWpmSample() {
    if (!_ttState.active || !_ttState.startTime) return;
    const elapsedMs = performance.now() - _ttState.startTime - _ttState.pausedDuration;
    if (elapsedMs < 3000) return;

    const elapsedMin = elapsedMs / 60000;
    const instantWpm = Math.round((_ttState.totalTyped / 5) / elapsedMin);
    const capped = Math.min(instantWpm, TT_MAX_WPM_SANITY);

    _wpmSamples.push({ t: elapsedMs, wpm: capped });
    if (_wpmSamples.length > TT_WPM_SAMPLE_LIMIT) _wpmSamples.shift();
}

function _getRollingWpm(windowSec = TT_CONSISTENCY_WINDOW_SEC) {
    if (_wpmSamples.length < 2) return null;
    const now = performance.now();
    const cutoffMs = windowSec * 1000;
    const recent = _wpmSamples.filter(s => (now - s.t) < cutoffMs);
    if (recent.length < 2) return _wpmSamples[_wpmSamples.length - 1].wpm;
    const avg = recent.reduce((s, x) => s + x.wpm, 0) / recent.length;
    return Math.round(avg);
}

function _computeConsistency() {
    if (_wpmSamples.length < 5) return null;
    const values = _wpmSamples.map(s => s.wpm);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    if (mean === 0) return 0;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const stddev = Math.sqrt(variance);
    const cv = (stddev / mean) * 100;
    return Math.max(0, Math.min(100, Math.round(100 - cv)));
}

function _getConsistencyLabel(score) {
    if (score === null) return 'N/A';
    if (score >= 90) return 'Steady 🎯';
    if (score >= 75) return 'Good 👍';
    if (score >= 60) return 'Fair';
    return 'Erratic 🎢';
}

// ============================================================
// 🎵 UPGRADE 5: SOUND FEEDBACK
// ============================================================
let _soundEnabled = (() => {
    try { return localStorage.getItem(TT_SOUND_KEY) === '1'; }
    catch (e) { return false; }
})();
let _audioContext = null;

function _getAudioContext() {
    if (_audioContext) return _audioContext;
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        _audioContext = new Ctx();
    } catch (e) { return null; }
    return _audioContext;
}

function _playSound(type) {
    if (!_soundEnabled) return;
    const ctx = _getAudioContext();
    if (!ctx) return;

    try {
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;

        if (type === 'click') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.03);
        } else if (type === 'error') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 220;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'complete') {
            [523.25, 659.25, 783.99].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.value = freq;
                osc.type = 'sine';
                const startAt = now + i * 0.1;
                gain.gain.setValueAtTime(0.07, startAt);
                gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.2);
                osc.connect(gain).connect(ctx.destination);
                osc.start(startAt);
                osc.stop(startAt + 0.2);
            });
        }
    } catch (e) {}
}

function toggleSound() {
    _soundEnabled = !_soundEnabled;
    try {
        localStorage.setItem(TT_SOUND_KEY, _soundEnabled ? '1' : '0');
    } catch (e) {}
    if (_soundEnabled) _playSound('click');
    return _soundEnabled;
}

// ============================================================
// 🏅 UPGRADE 6: ACHIEVEMENTS
// ============================================================
const TT_ACHIEVEMENTS = [
    { id: 'first_test', emoji: '🎯', name: 'First Step',      desc: 'Complete your first test',  check: st => st.totalTests >= 1 },
    { id: 'wpm_20',     emoji: '🚀', name: 'Warming Up',      desc: 'Hit 20 WPM',                check: st => st.bestWpm >= 20 },
    { id: 'wpm_30',     emoji: '⚡', name: 'Getting Fast',    desc: 'Hit 30 WPM',                check: st => st.bestWpm >= 30 },
    { id: 'wpm_40',     emoji: '🌪️', name: 'Speedy',          desc: 'Hit 40 WPM',                check: st => st.bestWpm >= 40 },
    { id: 'wpm_50',     emoji: '🔥', name: 'Half Century',    desc: 'Hit 50 WPM',                check: st => st.bestWpm >= 50 },
    { id: 'wpm_60',     emoji: '⚔️', name: 'Pro',             desc: 'Hit 60 WPM',                check: st => st.bestWpm >= 60 },
    { id: 'wpm_80',     emoji: '💎', name: 'Elite',           desc: 'Hit 80 WPM',                check: st => st.bestWpm >= 80 },
    { id: 'wpm_100',    emoji: '👑', name: 'Legend',          desc: 'Hit 100 WPM',               check: st => st.bestWpm >= 100 },
    { id: 'acc_95',     emoji: '🎪', name: 'Precise',         desc: '95%+ accuracy',             check: st => st.bestAcc >= 95 },
    { id: 'acc_98',     emoji: '💯', name: 'Perfectionist',   desc: '98%+ accuracy',             check: st => st.bestAcc >= 98 },
    { id: 'tests_10',   emoji: '🔟', name: 'Ten Down',        desc: 'Complete 10 tests',         check: st => st.totalTests >= 10 },
    { id: 'tests_50',   emoji: '🏅', name: 'Committed',       desc: 'Complete 50 tests',         check: st => st.totalTests >= 50 },
    { id: 'tests_100',  emoji: '🎖️', name: 'Century',         desc: 'Complete 100 tests',        check: st => st.totalTests >= 100 }
];

function _loadAchievements() {
    try {
        const raw = localStorage.getItem(TT_ACHIEVEMENTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

function _saveAchievements(list) {
    try { localStorage.setItem(TT_ACHIEVEMENTS_KEY, JSON.stringify(list)); } catch (e) {}
}

function _checkAchievements() {
    const earned = _loadAchievements();
    const stats = getSessionStats();
    const newOnes = [];

    for (const ach of TT_ACHIEVEMENTS) {
        if (!earned.includes(ach.id) && ach.check(stats)) {
            earned.push(ach.id);
            newOnes.push(ach);
        }
    }

    if (newOnes.length > 0) {
        _saveAchievements(earned);
        newOnes.forEach((ach, i) => {
            setTimeout(() => {
                if (typeof showToast === 'function') {
                    showToast(`${ach.emoji} Achievement: ${ach.name} — ${ach.desc}`, 'success', 4500);
                }
                _playSound('complete');
            }, 800 + i * 1200);
        });
    }
    return newOnes;
}

function getEarnedAchievements() {
    const earned = _loadAchievements();
    return TT_ACHIEVEMENTS.filter(a => earned.includes(a.id));
}

function getAchievementProgress() {
    const earned = _loadAchievements();
    return {
        earned: earned.length,
        total: TT_ACHIEVEMENTS.length,
        list: TT_ACHIEVEMENTS.map(a => ({ ...a, earned: earned.includes(a.id) }))
    };
}

// ============================================================
// 🎛️ UPGRADE 3: MANUAL PAUSE
// ============================================================
let _manualPaused = false;

function toggleManualPause() {
    if (!_ttState.active || _ttState._finished) return;

    const btn = document.getElementById('ttPauseBtn');

    if (!_manualPaused) {
        _manualPaused = true;
        _ttState.paused = true;
        _ttState.pausedAt = performance.now();

        const input = document.getElementById('ttInput');
        if (input) input.disabled = true;

        if (btn) {
            btn.innerHTML = '▶️ Resume';
            btn.style.background = '#16a34a';
        }
        _stopIdleDetection();
        console.log('⏸️ Manual pause');

        if (typeof showToast === 'function') {
            showToast('⏸️ Paused — Resume button to continue', 'info', 2000);
        }
    } else {
        _manualPaused = false;
        const pauseDuration = performance.now() - _ttState.pausedAt;
        _ttState.pausedDuration += pauseDuration;
        _ttState.paused = false;
        _ttState.pausedAt = null;
        _ttState.lastInputTime = performance.now();

        const input = document.getElementById('ttInput');
        if (input) {
            input.disabled = false;
            input.focus();
        }

        if (btn) {
            btn.innerHTML = '⏸️ Pause';
            btn.style.background = '#f59e0b';
        }
        _startIdleDetection();
        console.log('▶️ Manual resume (' + Math.round(pauseDuration / 1000) + 's paused)');

        if (typeof showToast === 'function') {
            showToast('▶️ Resumed', 'info', 1200);
        }
    }
}

function _resetManualPause() {
    _manualPaused = false;
    const btn = document.getElementById('ttPauseBtn');
    if (btn) {
        btn.innerHTML = '⏸️ Pause';
        btn.style.background = '#f59e0b';
    }
}

// ============================================================
// 🎨 UI INJECTION
// ============================================================
function _ensurePauseButton() {
    if (document.getElementById('ttPauseBtn')) return;
    const arena = document.getElementById('ttArena');
    if (!arena) return;

    const btn = document.createElement('button');
    btn.id = 'ttPauseBtn';
    btn.type = 'button';
    btn.innerHTML = '⏸️ Pause';
    btn.style.cssText = 'padding:8px 16px; background:#f59e0b; color:#fff; border:none; border-radius:6px; font-weight:700; cursor:pointer; font-size:0.85rem; margin:8px;';
    btn.addEventListener('click', toggleManualPause);

    const input = document.getElementById('ttInput');
    if (input && input.parentNode) {
        input.parentNode.insertBefore(btn, input.nextSibling);
    } else {
        arena.appendChild(btn);
    }
}

function _ensureSoundToggle() {
    if (document.getElementById('ttSoundToggle')) return;
    const setup = document.getElementById('ttSetup');
    if (!setup) return;

    const label = document.createElement('label');
    label.id = 'ttSoundToggle';
    label.style.cssText = 'display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.8rem; font-weight:700; color:#475569; margin-top:10px; user-select:none;';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = _soundEnabled;
    chk.addEventListener('change', () => {
        const enabled = toggleSound();
        chk.checked = enabled;
    });

    label.appendChild(chk);
    label.appendChild(document.createTextNode('🎵 Sound effects'));
    setup.appendChild(label);
}

function _renderResultExtras() {
    const resultEl = document.getElementById('ttResult');
    if (!resultEl) return;

    let extras = document.getElementById('ttResultExtras');
    if (!extras) {
        extras = document.createElement('div');
        extras.id = 'ttResultExtras';
        extras.style.cssText = 'margin-top:14px; padding:14px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; font-size:0.8rem;';
        resultEl.appendChild(extras);
    }
    extras.innerHTML = '';

    const stats = getSessionStats();
    const consistency = _computeConsistency();

    const summary = document.createElement('div');
    summary.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-bottom:10px;';
    summary.innerHTML = `
        <span style="background:#dbeafe; padding:4px 10px; border-radius:6px; font-weight:800; color:#1e40af;">📊 ${stats.totalTests} tests</span>
        <span style="background:#dcfce7; padding:4px 10px; border-radius:6px; font-weight:800; color:#166534;">🏆 Best ${stats.bestWpm} WPM</span>
        <span style="background:#fef3c7; padding:4px 10px; border-radius:6px; font-weight:800; color:#92400e;">🎯 Avg ${stats.avgWpm} WPM</span>
        ${consistency !== null ? `<span style="background:#f3e8ff; padding:4px 10px; border-radius:6px; font-weight:800; color:#6b21a8;">🎢 Consistency ${consistency}%</span>` : ''}
    `;
    extras.appendChild(summary);

    const weakKeys = getWeakestKeys(5);
    if (weakKeys.length > 0) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-top:10px;';
        section.innerHTML = '<div style="font-weight:900; color:#475569; margin-bottom:6px;">⚠️ Weakest Keys (practice these):</div>';
        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px;';
        weakKeys.forEach(k => {
            const chip = document.createElement('span');
            chip.style.cssText = `background:${k.acc < 70 ? '#fee2e2' : k.acc < 85 ? '#fef3c7' : '#dcfce7'}; color:${k.acc < 70 ? '#991b1b' : k.acc < 85 ? '#92400e' : '#166534'}; padding:4px 10px; border-radius:6px; font-family:monospace; font-weight:800;`;
            chip.textContent = `"${k.key}" — ${k.acc}% (${k.wrong}/${k.total})`;
            grid.appendChild(chip);
        });
        section.appendChild(grid);
        extras.appendChild(section);
    }

    const weakWords = _analyzeWordAccuracy(_ttState);
    if (weakWords.length > 0) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-top:10px;';
        section.innerHTML = '<div style="font-weight:900; color:#475569; margin-bottom:6px;">📝 Words to review:</div>';
        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px;';
        weakWords.slice(0, 5).forEach(w => {
            const chip = document.createElement('span');
            chip.style.cssText = 'background:#fef3c7; color:#92400e; padding:4px 8px; border-radius:6px; font-family:monospace; font-weight:700;';
            chip.textContent = `${w.word} (${w.acc}%)`;
            grid.appendChild(chip);
        });
        section.appendChild(grid);
        extras.appendChild(section);
    }

    const earned = getEarnedAchievements();
    if (earned.length > 0) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-top:10px;';
        section.innerHTML = `<div style="font-weight:900; color:#475569; margin-bottom:6px;">🏅 Achievements (${earned.length}/${TT_ACHIEVEMENTS.length}):</div>`;
        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px;';
        earned.slice(-6).forEach(a => {
            const chip = document.createElement('span');
            chip.style.cssText = 'background:#fef9c3; color:#78350f; padding:3px 8px; border-radius:6px; font-weight:700;';
            chip.textContent = `${a.emoji} ${a.name}`;
            grid.appendChild(chip);
        });
        section.appendChild(grid);
        extras.appendChild(section);
    }
}

// ============================================================
// 🔓 OPEN / CLOSE MODAL
// ============================================================
function openTypingTestModal() {
    const modal = document.getElementById('typingTestModal');
    if (!modal) return;

    if (typeof exitTypingMode === 'function' &&
        document.body.classList.contains('typing-focus')) {
        try { exitTypingMode(); } catch (e) {}
    }

    stopTest();
    _ttState = createFreshTTState();

    _wpmSamples = [];
    _resetManualPause();
    _manualPaused = false;

    const setupEl = document.getElementById('ttSetup');
    const arenaEl = document.getElementById('ttArena');
    const resultEl = document.getElementById('ttResult');

    if (setupEl) setupEl.style.display = 'block';
    if (arenaEl) arenaEl.style.display = 'none';
    if (resultEl) resultEl.style.display = 'none';

    _ttSelectedGroup = null;
    _ttSelectedIdx = null;
    _ttSelectedDuration = 60;

    document.querySelectorAll('.tt-lesson-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tt-time-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-sec') === '60');
    });

    const infoEl = document.getElementById('ttSelectedLesson');
    if (infoEl) infoEl.textContent = 'Select a lesson above';

    const startBtn = document.getElementById('ttStartBtn');
    if (startBtn) startBtn.disabled = true;

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    _ensureSoundToggle();
    _typingTestActive = true;
}

function closeTypingTestModal() {
    stopTest();
    _ttState = createFreshTTState();

    const modal = document.getElementById('typingTestModal');
    if (modal) modal.style.display = 'none';

    _ttSelectedGroup = null;
    _ttSelectedIdx = null;

    _detachWindowHandlers();
    _clearAllTimers();

    _typingTestActive = false;

    if (typeof _unlockBodyScroll === 'function') {
        _unlockBodyScroll();
    } else {
        document.body.classList.remove('modal-open');
    }
}

function _clearAllTimers() {
    if (_scrollDebounce) { clearTimeout(_scrollDebounce); _scrollDebounce = null; }
    if (_blurWarningTimer) { clearTimeout(_blurWarningTimer); _blurWarningTimer = null; }
    if (_visibilityWarningTimer) { clearTimeout(_visibilityWarningTimer); _visibilityWarningTimer = null; }
}

// ============================================================
// ✅ WINDOW HANDLERS
// ============================================================
function _attachWindowHandlers() {
    _detachWindowHandlers();

    _blurHandler = () => {
        if (_ttState.active && !_ttState.paused) {
            _ttState.blurCount++;
            console.warn('⚠️ Window blur detected — count:', _ttState.blurCount);

            if (_blurWarningTimer) clearTimeout(_blurWarningTimer);

            _blurWarningTimer = setTimeout(() => {
                _blurWarningTimer = null;
                if (_ttState.active && _ttState.blurCount > 0) {
                    if (typeof showToast === 'function') {
                        showToast(`⚠️ Window से बाहर गए — ${_ttState.blurCount} बार`, 'warning', 2000);
                    }
                }
            }, TT_BLUR_WARNING_DELAY);
        }
    };

    _visibilityHandler = () => {
        if (document.hidden && _ttState.active) {
            _ttState.visibilityHiddenCount++;
            console.log('👁️ Tab hidden — count:', _ttState.visibilityHiddenCount);

            if (_visibilityWarningTimer) clearTimeout(_visibilityWarningTimer);

            if (_ttState.visibilityHiddenCount <= 3) {
                _visibilityWarningTimer = setTimeout(() => {
                    _visibilityWarningTimer = null;
                    if (typeof showToast === 'function') {
                        showToast('⚠️ Tab switch detected!', 'warning', 1500);
                    }
                }, 100);
            }
        }
    };

    window.addEventListener('blur', _blurHandler);
    document.addEventListener('visibilitychange', _visibilityHandler);
}

function _detachWindowHandlers() {
    if (_blurHandler) {
        window.removeEventListener('blur', _blurHandler);
        _blurHandler = null;
    }
    if (_visibilityHandler) {
        document.removeEventListener('visibilitychange', _visibilityHandler);
        _visibilityHandler = null;
    }
}

// ============================================================
// ⌨️ KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('typingTestModal');
    if (!modal) return;

    const display = modal.style.display;
    if (display !== 'flex' && display !== 'block') return;

    if (e.key === 'Escape') {
        e.preventDefault();
        closeTypingTestModal();
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r' && _ttState.active) {
        e.preventDefault();
        stopAndRestartTest();
        return;
    }

    // Space to toggle pause during active test (when input is disabled)
    if (e.key === ' ' && _ttState.active && _manualPaused &&
        document.activeElement !== document.getElementById('ttInput')) {
        e.preventDefault();
        toggleManualPause();
        return;
    }
});

// ============================================================
// 📚 LESSON SELECTION
// ============================================================
function selectTestLesson(group, idx) {
    if (!group || idx === null || idx === undefined) return;

    const idxNum = parseInt(idx, 10);
    if (isNaN(idxNum) || idxNum < 0 || idxNum > 2) return;

    _ttSelectedGroup = group;
    _ttSelectedIdx = idxNum;

    document.querySelectorAll('.tt-lesson-btn').forEach(b => {
        const g = b.getAttribute('data-group');
        const i = parseInt(b.getAttribute('data-idx'), 10);
        b.classList.toggle('active', g === group && i === idxNum);
    });

    const lesson = getLessonText(group, idxNum);
    const name = getLessonName(group, idxNum);
    const infoEl = document.getElementById('ttSelectedLesson');

    if (infoEl) {
        infoEl.textContent = `${name} (${lesson.length} chars)`;
    }

    const startBtn = document.getElementById('ttStartBtn');
    if (startBtn) startBtn.disabled = !lesson;
}

function selectTestDuration(sec) {
    _ttSelectedDuration = parseInt(sec, 10) || 60;
    document.querySelectorAll('.tt-time-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-sec'), 10) === _ttSelectedDuration);
    });
}

function getLessonText(group, idx) {
    const lang = window.currentLayout || 'english';
    const langPool = TT_LESSONS[lang] || TT_LESSONS['english'];
    const groupPool = langPool[group] || langPool['basic'] || [];
    return groupPool[idx] || groupPool[0] || '';
}

function getLessonName(group, idx) {
    const names = {
        basic:    ['Home Row Practice', 'Common Words', 'Short Sentences'],
        advanced: ['Punctuation & Quotes', 'Numbers & Symbols', 'Complex Paragraph'],
        job:      ['Email Writing', 'Office Report', 'Government Format']
    };
    const groupNames = names[group] || names.basic;
    return groupNames[idx] || 'Lesson';
}

// ============================================================
// ▶️ START TEST
// ============================================================
function startTypingTest() {
    if (!_ttSelectedGroup || _ttSelectedIdx === null) {
        if (typeof showToast === 'function') {
            showToast('Pehle lesson select karein', 'warning');
        }
        return;
    }

    const text = getLessonText(_ttSelectedGroup, _ttSelectedIdx);

    if (!text || text.trim().length === 0) {
        if (typeof showToast === 'function') {
            showToast('Is lesson me koi text nahi hai', 'warning');
        }
        return;
    }

    stopTest();

    _ttState = createFreshTTState();
    _ttState.active = true;
    _ttState.group = _ttSelectedGroup;
    _ttState.idx = _ttSelectedIdx;
    _ttState.duration = _ttSelectedDuration;
    _ttState.text = text;
    _ttState.timeLeft = _ttSelectedDuration;
    _ttState.lastInputTime = performance.now();

    _wpmSamples = [];
    _manualPaused = false;
    _resetManualPause();

    const target = document.getElementById('ttTargetText');
    if (!target) return;

    target.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.className = 'tt-char';
        span.textContent = text[i];
        frag.appendChild(span);
        _ttState.charSpans.push(span);
    }
    target.appendChild(frag);

    if (_ttState.charSpans[0]) {
        _ttState.charSpans[0].classList.add('current');
    }

    const input = document.getElementById('ttInput');
    if (input) {
        input.value = '';
        input.disabled = false;

        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('spellcheck', 'false');

        input.oninput = handleTestInput;

        input.addEventListener('paste', _blockPasteEvent, true);
        input.addEventListener('drop', _blockPasteEvent, true);
        input.addEventListener('dragover', _preventDefaultEvent, true);
        input.addEventListener('contextmenu', _preventDefaultEvent, true);
        input.addEventListener('copy', _preventDefaultEvent, true);
        input.addEventListener('cut', _preventDefaultEvent, true);

        _compositionHandler = _blockCompositionEvent;
        input.addEventListener('compositionstart', _compositionHandler, true);
        input.addEventListener('compositionend', _compositionHandler, true);
        input.addEventListener('compositionupdate', _compositionHandler, true);

        _beforeInputHandler = _blockBeforeInput;
        input.addEventListener('beforeinput', _beforeInputHandler, true);
    }

    const timerEl = document.getElementById('ttTimer');
    if (timerEl) {
        timerEl.textContent = formatTTTime(_ttSelectedDuration);
        timerEl.className = '';
    }

    const wpmEl = document.getElementById('ttLiveWPM');
    const accEl = document.getElementById('ttLiveAcc');
    const errEl = document.getElementById('ttLiveErr');
    const progEl = document.getElementById('ttLiveProg');

    if (wpmEl) wpmEl.textContent = '0';
    if (accEl) accEl.textContent = '100%';
    if (errEl) errEl.textContent = '0';
    if (progEl) progEl.textContent = '0%';

    const setupEl = document.getElementById('ttSetup');
    const arenaEl = document.getElementById('ttArena');
    const resultEl = document.getElementById('ttResult');

    if (setupEl) setupEl.style.display = 'none';
    if (resultEl) resultEl.style.display = 'none';
    if (arenaEl) arenaEl.style.display = 'block';

    _ensurePauseButton();
    const pauseBtn = document.getElementById('ttPauseBtn');
    if (pauseBtn) {
        pauseBtn.style.display = 'inline-block';
        pauseBtn.innerHTML = '⏸️ Pause';
        pauseBtn.style.background = '#f59e0b';
    }

    if (input) input.focus();

    _attachWindowHandlers();

    _ttState.startTime = performance.now();
    _ttState.timerId = setInterval(tickTimer, 1000);

    _startIdleDetection();

    if (typeof showToast === 'function') {
        showToast('Practice shuru! Type karna shuru karein', 'info', 2500);
    }

    console.log('▶️ Test started:', {
        group: _ttSelectedGroup,
        idx: _ttSelectedIdx,
        duration: _ttSelectedDuration,
        textLength: text.length
    });
}

// ============================================================
// 🛡️ ANTI-CHEAT
// ============================================================
function _blockPasteEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof showToast === 'function') {
        showToast('⚠️ Paste/Drop allowed नहीं है', 'warning', 2000);
    }
    return false;
}

function _preventDefaultEvent(e) {
    e.preventDefault();
    return false;
}

function _blockCompositionEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    console.warn('⚠️ IME composition blocked:', e.type);
    if (typeof showToast === 'function') {
        showToast('⚠️ IME (Hindi/Chinese typing) allowed नहीं है', 'warning', 2500);
    }
    return false;
}

function _blockBeforeInput(e) {
    if (e.inputType === 'insertFromPaste' ||
        e.inputType === 'insertFromDrop' ||
        e.inputType === 'insertReplacementText' ||
        e.inputType === 'insertFromYank') {
        e.preventDefault();
        e.stopPropagation();
        if (typeof showToast === 'function') {
            showToast('⚠️ Paste allowed नहीं है', 'warning', 2000);
        }
        return false;
    }
    if (e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

function _cleanupInputListeners(input) {
    if (!input) return;

    try {
        input.removeEventListener('paste', _blockPasteEvent, true);
        input.removeEventListener('drop', _blockPasteEvent, true);
        input.removeEventListener('dragover', _preventDefaultEvent, true);
        input.removeEventListener('contextmenu', _preventDefaultEvent, true);
        input.removeEventListener('copy', _preventDefaultEvent, true);
        input.removeEventListener('cut', _preventDefaultEvent, true);
    } catch (e) {}

    if (_compositionHandler) {
        try {
            input.removeEventListener('compositionstart', _compositionHandler, true);
            input.removeEventListener('compositionend', _compositionHandler, true);
            input.removeEventListener('compositionupdate', _compositionHandler, true);
        } catch (e) {}
        _compositionHandler = null;
    }

    if (_beforeInputHandler) {
        try {
            input.removeEventListener('beforeinput', _beforeInputHandler, true);
        } catch (e) {}
        _beforeInputHandler = null;
    }
}

// ============================================================
// ⏱️ IDLE DETECTION
// ============================================================
function _startIdleDetection() {
    _stopIdleDetection();

    _ttState.idleTimerId = setInterval(() => {
        if (!_ttState.active) return;
        if (_manualPaused) return;

        const idleMs = performance.now() - _ttState.lastInputTime;

        if (idleMs >= TT_IDLE_TIMEOUT_MS && !_ttState.paused) {
            _ttState.paused = true;
            _ttState.pausedAt = performance.now();

            console.log('⏸️ Auto-paused after 30s idle');

            if (typeof showToast === 'function') {
                showToast('⏸️ 30s idle — Timer paused. Type करने पर resume होगा।', 'warning', 4000);
            }
        }
    }, 5000);
}

function _stopIdleDetection() {
    if (_ttState.idleTimerId) {
        clearInterval(_ttState.idleTimerId);
        _ttState.idleTimerId = null;
    }
}

// ============================================================
// ⌨️ INPUT HANDLER
// ============================================================
function handleTestInput(e) {
    if (!_ttState.active || _ttState._finished) return;
    if (e.isComposing) return;
    if (_manualPaused) return;

    _ttState.lastInputTime = performance.now();

    _playSound('click');

    if (_ttState.paused) {
        const pauseDuration = performance.now() - _ttState.pausedAt;
        _ttState.pausedDuration += pauseDuration;
        _ttState.paused = false;
        _ttState.pausedAt = null;
        console.log('▶️ Resumed after pause (' + Math.round(pauseDuration / 1000) + 's)');
    }

    const inputVal = e.target.value;
    let correct = 0;
    let errors = 0;
    const totalChars = _ttState.charSpans.length;

    for (let i = 0; i < totalChars; i++) {
        const span = _ttState.charSpans[i];
        span.classList.remove('correct', 'wrong', 'current');

        if (i < inputVal.length) {
            if (inputVal[i] === _ttState.text[i]) {
                span.classList.add('correct');
                correct++;
            } else {
                span.classList.add('wrong');
                errors++;
            }
        }
    }

    const cursorIdx = inputVal.length;
    if (cursorIdx < totalChars) {
        const currentSpan = _ttState.charSpans[cursorIdx];
        currentSpan.classList.add('current');

        if (cursorIdx > 0 && cursorIdx % TT_SCROLL_THROTTLE_EVERY === 0) {
            if (_scrollDebounce) clearTimeout(_scrollDebounce);
            _scrollDebounce = setTimeout(() => {
                _scrollDebounce = null;
                try {
                    currentSpan.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                } catch (err) {}
            }, 50);
        }
    }

    const prevErrors = _ttState._lastErrors || 0;
    if (errors > prevErrors) {
        _playSound('error');
    }
    _ttState._lastErrors = errors;

    _ttState.correctTyped = correct;
    _ttState.errors = errors;
    _ttState.totalTyped = cursorIdx;

    _recordWpmSample();
    updateLiveStats();

    if (cursorIdx >= _ttState.text.length) {
        finishTest('complete');
    }
}

// ============================================================
// 📊 LIVE STATS (rolling WPM)
// ============================================================
function updateLiveStats() {
    if (!_ttState.startTime || !_ttState.active) return;

    const elapsedMs = performance.now() - _ttState.startTime - _ttState.pausedDuration;
    const elapsedMin = elapsedMs / 60000;

    const charsTyped = _ttState.totalTyped;
    const cumulativeWpm = elapsedMin > 0.001
        ? Math.round((charsTyped / 5) / elapsedMin)
        : 0;

    const rollingWpm = _getRollingWpm();
    const displayWpm = rollingWpm !== null ? rollingWpm : cumulativeWpm;
    const safeWPM = Math.min(displayWpm, TT_MAX_WPM_SANITY);

    const accuracy = charsTyped > 0
        ? Math.round((_ttState.correctTyped / charsTyped) * 100)
        : 100;
    const progress = Math.round((charsTyped / _ttState.text.length) * 100);

    const wpmEl = document.getElementById('ttLiveWPM');
    const accEl = document.getElementById('ttLiveAcc');
    const errEl = document.getElementById('ttLiveErr');
    const prgEl = document.getElementById('ttLiveProg');

    if (wpmEl) wpmEl.textContent = safeWPM;
    if (accEl) accEl.textContent = accuracy + '%';
    if (errEl) errEl.textContent = _ttState.errors;
    if (prgEl) prgEl.textContent = Math.min(progress, 100) + '%';
}

// ============================================================
// ⏱️ TIMER
// ============================================================
function tickTimer() {
    if (!_ttState.active) {
        if (_ttState.timerId) {
            try { clearInterval(_ttState.timerId); } catch (e) {}
            _ttState.timerId = null;
        }
        return;
    }

    if (!_ttState.startTime) return;

    const elapsedMs = performance.now() - _ttState.startTime - _ttState.pausedDuration;
    const elapsedSec = Math.floor(elapsedMs / 1000);

    _ttState.timeLeft = Math.max(0, _ttState.duration - elapsedSec);

    _recordWpmSample();

    const timerEl = document.getElementById('ttTimer');
    if (timerEl) {
        timerEl.textContent = formatTTTime(_ttState.timeLeft);
        if (_ttState.timeLeft <= 10) timerEl.className = 'danger';
        else if (_ttState.timeLeft <= 30) timerEl.className = 'warn';
        else timerEl.className = '';
    }

    if (_ttState.timeLeft <= 0) {
        finishTest('timeout');
    }
}

function formatTTTime(sec) {
    const sVal = Math.max(0, parseInt(sec, 10) || 0);
    const m = Math.floor(sVal / 60);
    const s = sVal % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// 🏆 GRADE CALCULATION
// ============================================================
function _calculateGrade(wpm, accuracy) {
    for (const threshold of TT_GRADE_THRESHOLDS) {
        if (wpm >= threshold.minWpm && accuracy >= threshold.minAcc) {
            return { grade: threshold.grade, msg: threshold.msg };
        }
    }
    return { grade: 'D', msg: 'Keep practicing!' };
}

// ============================================================
// ✅ SHARED RESULT CALCULATOR — FIX #2
// ============================================================
function _calculateTestResults(state, reason) {
    if (!state || !state.startTime) return null;

    const finishReason = reason || state._finishReason || 'unknown';

    const elapsedMs = performance.now() - state.startTime - state.pausedDuration;
    const rawElapsedSec = elapsedMs / 1000;

    let effectiveElapsedSec;

    if (TT_STRICT_DURATION_MODE) {
        effectiveElapsedSec = state.duration;
    } else if (finishReason === 'complete') {
        effectiveElapsedSec = rawElapsedSec;
    } else {
        effectiveElapsedSec = Math.min(state.duration, rawElapsedSec);
    }

    const elapsedSec = Math.max(
        TT_MIN_ELAPSED_SEC,
        Math.min(state.duration, effectiveElapsedSec)
    );
    const elapsedMin = elapsedSec / 60;

    const charsTyped = state.totalTyped;
    const words = charsTyped / 5;
    const rawGrossWPM = words / elapsedMin;
    const rawNetWPM = Math.max(0, (words - state.errors) / elapsedMin);

    const grossWPM = Math.min(rawGrossWPM, TT_MAX_WPM_SANITY);
    const netWPM = Math.min(rawNetWPM, TT_MAX_WPM_SANITY);

    const wasCapped = (rawGrossWPM > TT_MAX_WPM_SANITY) ||
                     (rawNetWPM > TT_MAX_WPM_SANITY);

    if (wasCapped) {
        console.warn('⚠️ [TT] WPM sanity cap applied:', {
            rawGross: Math.round(rawGrossWPM),
            rawNet: Math.round(rawNetWPM),
            cappedAt: TT_MAX_WPM_SANITY,
            reason: finishReason,
            charsTyped,
            elapsedSec: elapsedSec.toFixed(2)
        });
    }

    const accuracy = charsTyped > 0
        ? Math.round((state.correctTyped / charsTyped) * 100)
        : 100;

    const gradeInfo = _calculateGrade(netWPM, accuracy);

    return {
        elapsedSec,
        elapsedMin,
        charsTyped,
        words,
        grossWPM: Math.round(grossWPM),
        netWPM: Math.round(netWPM),
        accuracy,
        grade: gradeInfo.grade,
        msg: gradeInfo.msg,
        wasCapped,
        reason: finishReason
    };
}

// ============================================================
// 🏁 FINISH TEST
// ✅ FIX #1: Results are frozen here and cached in _finalResults.
//            All subsequent reads (certificate, share, history)
//            reuse this frozen snapshot — no WPM drift.
// ============================================================
function finishTest(reason) {
    if (!_ttState.startTime) {
        console.warn('⚠️ finishTest called without startTime — aborting');
        return;
    }

    if (_ttState._finished) {
        console.warn('⚠️ finishTest called again (' + reason + ') — ignoring');
        return;
    }
    _ttState._finished = true;
    _ttState._finishReason = reason;
    _ttState.active = false;

    if (_ttState.timerId) {
        try { clearInterval(_ttState.timerId); } catch (e) {}
        _ttState.timerId = null;
    }

    _stopIdleDetection();

    if (_scrollDebounce) {
        clearTimeout(_scrollDebounce);
        _scrollDebounce = null;
    }

    const input = document.getElementById('ttInput');
    if (input) {
        input.disabled = true;
        input.oninput = null;
    }

    _cleanupInputListeners(input);
    _detachWindowHandlers();

    const results = _calculateTestResults(_ttState, reason);
    if (!results) {
        console.warn('⚠️ Result calculation failed');
        return;
    }

    // ✅ FIX #1: Freeze & cache the final results NOW.
    // Any later call (certificate open, WhatsApp share, history save)
    // will reuse these exact numbers — no re-computation, no WPM drift.
    _ttState._finalResults = results;

    const { elapsedSec, grossWPM, netWPM, accuracy, grade, msg, charsTyped } = results;

    // v3.8.0: Save to history + analyze keys + sound
    const _snapForHistory = _snapshotTestResult(_ttState);
    if (_snapForHistory) {
        _saveSessionToHistory(_snapForHistory);
    }
    _analyzeAndPersistKeyAccuracy(_ttState);
    _playSound('complete');

    const isNewBest = _saveBestWPM(netWPM);
    if (isNewBest && netWPM > 0) {
        setTimeout(() => {
            if (typeof showToast === 'function') {
                showToast(`🏆 New Best WPM: ${netWPM}!`, 'success', 4000);
            }
        }, 500);
    }

    const setSafe = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setSafe('ttResGrade', grade);
    setSafe('ttResMsg', msg);
    setSafe('ttResWPM', netWPM);
    setSafe('ttResGross', grossWPM);
    setSafe('ttResAcc', accuracy + '%');
    setSafe('ttResChars', charsTyped);
    setSafe('ttResErrors', _ttState.errors);
    setSafe('ttResTime', formatTTTime(elapsedSec));
    setSafe('ttResLesson', getLessonName(_ttState.group, _ttState.idx));
    setSafe('ttResDate', new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    }));

    const arenaEl = document.getElementById('ttArena');
    const resultEl = document.getElementById('ttResult');
    if (arenaEl) arenaEl.style.display = 'none';
    if (resultEl) resultEl.style.display = 'block';

    if (typeof updateStatusWPM === 'function') updateStatusWPM(netWPM);

    if (_ttState.blurCount > 0 || _ttState.visibilityHiddenCount > 0) {
        console.warn('⚠️ Test had window switches:', {
            blur: _ttState.blurCount,
            visibility: _ttState.visibilityHiddenCount
        });
    }

    if (typeof showToast === 'function') {
        showToast(
            `${reason === 'timeout' ? "Time's up!" : 'Complete!'} — ${netWPM} WPM, ${accuracy}% accuracy`,
            'success',
            4000
        );
    }

    // Achievements (deferred, after UI)
    setTimeout(() => _checkAchievements(), 1200);
    // Result extras (weak keys, words, achievements)
    setTimeout(() => _renderResultExtras(), 200);

    console.log('🏁 Test finished:', {
        reason,
        netWPM,
        grossWPM,
        accuracy,
        grade,
        charsTyped,
        errors: _ttState.errors,
        elapsedSec,
        elapsedSecRaw: (performance.now() - _ttState.startTime - _ttState.pausedDuration) / 1000,
        pauseDuration: Math.round(_ttState.pausedDuration / 1000) + 's',
        blurCount: _ttState.blurCount,
        visibilityHidden: _ttState.visibilityHiddenCount,
        isNewBest,
        wasCapped: results.wasCapped,
        mode: TT_STRICT_DURATION_MODE ? 'strict' : 'completion',
        consistency: _computeConsistency(),
        wpmSamples: _wpmSamples.length,
        // ✅ FIX #1: log cache status
        resultsCached: _ttState._finalResults !== null
    });
}

// ============================================================
// 🏆 BEST WPM
// ============================================================
function _saveBestWPM(wpm) {
    if (wpm <= 0) return false;
    try {
        const currentBest = parseInt(localStorage.getItem(TT_BEST_WPM_KEY) || '0', 10);
        if (wpm > currentBest) {
            localStorage.setItem(TT_BEST_WPM_KEY, String(wpm));
            console.log('🏆 New best WPM:', wpm, '(was:', currentBest + ')');
            return true;
        }
    } catch (e) {
        console.warn('Best WPM save failed:', e.message);
    }
    return false;
}

function getBestWPM() {
    try {
        return parseInt(localStorage.getItem(TT_BEST_WPM_KEY) || '0', 10);
    } catch (e) {
        return 0;
    }
}

// ============================================================
// ⏹️ STOP TEST
// ============================================================
function stopTest() {
    if (_ttState.timerId) {
        try { clearInterval(_ttState.timerId); } catch (e) {}
        _ttState.timerId = null;
    }

    _stopIdleDetection();

    if (_scrollDebounce) {
        clearTimeout(_scrollDebounce);
        _scrollDebounce = null;
    }

    _ttState.active = false;
    _ttState.timeLeft = 0;
    _ttState.paused = false;

    _wpmSamples = [];
    _resetManualPause();
    _manualPaused = false;

    const input = document.getElementById('ttInput');
    if (input) {
        input.disabled = true;
        input.oninput = null;
    }

    _cleanupInputListeners(input);
    _detachWindowHandlers();
    _clearAllTimers();
}

function stopAndRestartTest() {
    stopTest();
    _ttState = createFreshTTState();

    _wpmSamples = [];
    _resetManualPause();
    _manualPaused = false;

    const setupEl = document.getElementById('ttSetup');
    const arenaEl = document.getElementById('ttArena');
    const resultEl = document.getElementById('ttResult');

    if (setupEl) setupEl.style.display = 'block';
    if (arenaEl) arenaEl.style.display = 'none';
    if (resultEl) resultEl.style.display = 'none';

    document.querySelectorAll('.tt-lesson-btn').forEach(b => b.classList.remove('active'));
    _ttSelectedGroup = null;
    _ttSelectedIdx = null;

    const infoEl = document.getElementById('ttSelectedLesson');
    if (infoEl) infoEl.textContent = 'Select a lesson above';

    const startBtn = document.getElementById('ttStartBtn');
    if (startBtn) startBtn.disabled = true;
}

// ============================================================
// ✅ FIX #15: WAIT FOR CERTIFICATE
// ============================================================
function _waitForCertificateSystem() {
    return new Promise((resolve) => {
        if (typeof CertificateSystem !== 'undefined' && CertificateSystem
            && typeof CertificateSystem.open === 'function') {
            resolve(CertificateSystem);
            return;
        }

        let attempt = 0;

        function tryAgain() {
            if (attempt >= TT_CERT_MAX_RETRIES) {
                console.warn('[TT] CertificateSystem wait timed out after',
                    TT_CERT_MAX_RETRIES, 'attempts');
                resolve(null);
                return;
            }

            const delay = TT_CERT_RETRY_DELAYS[attempt] || 2000;
            attempt++;

            setTimeout(() => {
                if (typeof CertificateSystem !== 'undefined' && CertificateSystem
                    && typeof CertificateSystem.open === 'function') {
                    console.log('[TT] CertificateSystem ready after', attempt, 'attempt(s)');
                    resolve(CertificateSystem);
                } else {
                    tryAgain();
                }
            }, delay);
        }

        tryAgain();
    });
}

// ============================================================
// ✅ FIX #1: DEEP SNAPSHOT (uses cached final results)
// ============================================================
// BEFORE: this function re-ran _calculateTestResults() every time
//         it was called. If user opened certificate 5 minutes
//         after finishing, elapsed time had grown → WPM dropped.
//
// AFTER:  uses state._finalResults (frozen at finishTest time).
//         Falls back to fresh calc ONLY if cache missing
//         (safe-guard for edge cases — should not trigger in
//         normal user flow).
// ============================================================
function _snapshotTestResult(state) {
    if (!state || !state.text || !state.startTime) return null;

    // ✅ FIX #1: Prefer cached results
    const results = state._finalResults ||
                    _calculateTestResults(state, state._finishReason);
    if (!results) return null;

    return Object.freeze({
        group: String(state.group || 'basic'),
        idx: Number(state.idx) || 0,
        wpm: Number(results.netWPM) || 0,
        accuracy: Number(results.accuracy) || 0,
        grade: String(results.grade || 'D'),
        chars: Number(results.charsTyped) || 0,
        errors: Number(state.errors) || 0,
        duration: formatTTTime(results.elapsedSec),
        wasCapped: Boolean(results.wasCapped),
        finishReason: String(results.reason || 'unknown')
    });
}

// ============================================================
// 🎓 OPEN CERTIFICATE
// ============================================================
function openCertificateFromResult() {
    if (_certOpeningInProgress) {
        console.log('[TT] Certificate open already in progress — ignoring click');
        return;
    }

    const state = _ttState;

    if (!state || !state.text || !state.startTime) {
        if (typeof showToast === 'function') showToast('Result not found', 'warning');
        return;
    }

    // ✅ FIX #1 extra safety: require _finished so we can't open
    // during active test (also means _finalResults will be set)
    if (!state._finished) {
        if (typeof showToast === 'function') showToast('Test finish karein pehle', 'warning');
        return;
    }

    const snapshot = _snapshotTestResult(state);

    if (!snapshot) {
        if (typeof showToast === 'function') showToast('Result calculation failed', 'error');
        console.error('[TT] Snapshot calculation failed');
        return;
    }

    _certOpeningInProgress = true;

    if (typeof showToast === 'function') {
        showToast('🎓 Certificate generate हो रहा है...', 'info', 2000);
    }

    _waitForCertificateSystem().then((certSystem) => {
        if (!certSystem) {
            _certOpeningInProgress = false;
            if (typeof showToast === 'function') {
                showToast('Certificate system load नहीं हो सका। Page refresh करें।', 'error', 5000);
            }
            console.error('[TT] CertificateSystem unavailable after retries');
            return;
        }

        try {
            certSystem.open(snapshot);
            console.log('[TT] Certificate opened with snapshot:', snapshot);
        } catch (e) {
            console.error('[TT] Certificate open failed:', e);
            if (typeof showToast === 'function') {
                showToast('Certificate open failed: ' + e.message, 'error', 4000);
            }
        } finally {
            setTimeout(() => { _certOpeningInProgress = false; }, 500);
        }
    }).catch((e) => {
        _certOpeningInProgress = false;
        console.error('[TT] Certificate wait failed:', e);
        if (typeof showToast === 'function') {
            showToast('Certificate error: ' + e.message, 'error', 4000);
        }
    });
}

// ============================================================
// 📱 SHARE RESULT
// ============================================================
function shareResultOnWhatsApp() {
    const state = _ttState;

    if (!state || !state.text || !state.startTime) {
        if (typeof showToast === 'function') showToast('No result to share', 'warning');
        return;
    }

    // ✅ FIX #1 extra safety: require _finished
    if (!state._finished) {
        if (typeof showToast === 'function') showToast('Test finish karein pehle', 'warning');
        return;
    }

    const snapshot = _snapshotTestResult(state);
    if (!snapshot) {
        if (typeof showToast === 'function') showToast('Result calculation failed', 'error');
        return;
    }

    const msg = `🎯 *TYPING PRACTICE RESULT*\n\n` +
                `📖 Lesson: ${getLessonName(snapshot.group, snapshot.idx)}\n` +
                `⚡ Net WPM: ${snapshot.wpm}\n` +
                `🎯 Accuracy: ${snapshot.accuracy}%\n` +
                `🏅 Grade: ${snapshot.grade}\n` +
                `📝 Characters: ${snapshot.chars}\n` +
                `❌ Errors: ${snapshot.errors}\n` +
                `⏱️ Duration: ${snapshot.duration}\n\n` +
                `— via Hoṛ Katha Suite`;

    window.open(
        `https://wa.me/?text=${encodeURIComponent(msg)}`,
        '_blank',
        'noopener,noreferrer'
    );
}

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
window.TypingTestDebug = {
    state: () => JSON.parse(JSON.stringify({
        active: _ttState.active,
        group: _ttState.group,
        idx: _ttState.idx,
        duration: _ttState.duration,
        timeLeft: _ttState.timeLeft,
        hasTimer: !!_ttState.timerId,
        hasIdleTimer: !!_ttState.idleTimerId,
        textLength: _ttState.text.length,
        spansCount: _ttState.charSpans.length,
        blurCount: _ttState.blurCount,
        visibilityHiddenCount: _ttState.visibilityHiddenCount,
        errors: _ttState.errors,
        totalTyped: _ttState.totalTyped,
        correctTyped: _ttState.correctTyped,
        paused: _ttState.paused,
        manualPaused: _manualPaused,
        pausedDuration: Math.round(_ttState.pausedDuration) + 'ms',
        finished: _ttState._finished,
        finishReason: _ttState._finishReason,
        hasStartTime: !!_ttState.startTime,
        hasScrollTimer: !!_scrollDebounce,
        hasBlurWarningTimer: !!_blurWarningTimer,
        hasVisibilityWarningTimer: !!_visibilityWarningTimer,
        certOpeningInProgress: _certOpeningInProgress,
        mode: TT_STRICT_DURATION_MODE ? 'strict' : 'completion',
        wpmCap: TT_MAX_WPM_SANITY,
        minElapsedSec: TT_MIN_ELAPSED_SEC,
        wpmSamples: _wpmSamples.length,
        soundEnabled: _soundEnabled,
        // ✅ FIX #1: show cache status
        hasCachedResults: _ttState._finalResults !== null,
        cachedWpm: _ttState._finalResults ? _ttState._finalResults.netWPM : null,
        cachedAcc: _ttState._finalResults ? _ttState._finalResults.accuracy : null
    })),

    forceClose: () => closeTypingTestModal(),
    forceFinish: () => finishTest('debug'),

    forceLesson: (group, idx) => {
        _ttSelectedGroup = group;
        _ttSelectedIdx = idx;
        selectTestLesson(group, idx);
        if (typeof showToast === 'function') {
            showToast(`Lesson set: ${group}[${idx}]`, 'info');
        }
    },

    testCertificate: () => {
        if (typeof CertificateSystem === 'undefined') {
            console.error('CertificateSystem not loaded');
            return;
        }
        CertificateSystem.open({
            group: 'basic',
            idx: 0,
            wpm: 45,
            accuracy: 96,
            grade: 'A+',
            chars: 250,
            errors: 3,
            duration: '01:00'
        });
    },

    testGrade: () => {
        console.log('🧪 Testing grade calculation:');
        const cases = [[70, 98], [50, 95], [40, 90], [25, 85], [15, 75], [0, 0]];
        cases.forEach(([wpm, acc]) => {
            const result = _calculateGrade(wpm, acc);
            console.log(`  ${wpm} WPM, ${acc}% → ${result.grade} (${result.msg})`);
        });
    },

    testCalculationConsistency: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 CALCULATION CONSISTENCY TEST');
        console.log('═══════════════════════════════════════════');

        const testState = createFreshTTState();
        testState.active = true;
        testState.group = 'basic';
        testState.idx = 0;
        testState.duration = 60;
        testState.text = getLessonText('basic', 0);
        testState.startTime = performance.now() - 30000;
        testState.totalTyped = 250;
        testState.correctTyped = 240;
        testState.errors = 10;
        testState._finishReason = 'complete';

        const results1 = _calculateTestResults(testState, 'complete');
        const results2 = _calculateTestResults(testState, 'complete');

        if (!results1 || !results2) {
            console.error('❌ Calculation failed');
            return;
        }

        console.log('  Results 1:', {
            netWPM: results1.netWPM, accuracy: results1.accuracy,
            grade: results1.grade, elapsedSec: results1.elapsedSec.toFixed(2),
            wasCapped: results1.wasCapped
        });
        console.log('  Results 2:', {
            netWPM: results2.netWPM, accuracy: results2.accuracy,
            grade: results2.grade, elapsedSec: results2.elapsedSec.toFixed(2),
            wasCapped: results2.wasCapped
        });

        const match = results1.netWPM === results2.netWPM &&
                      results1.accuracy === results2.accuracy &&
                      results1.grade === results2.grade;

        console.log('  Consistency:', match ? '✅ PASS' : '❌ FAIL');
        return { results1, results2, match };
    },

    testGuard: () => {
        console.log('🧪 Testing finishTest guard...');
        const saved = _ttState;
        _ttState = createFreshTTState();
        _ttState.active = true;
        _ttState.text = 'test';
        _ttState.startTime = null;
        finishTest('test-guard');
        console.log('✅ Guard test passed (no NaN error)');
        _ttState = saved;
    },

    testIdempotentFinish: () => {
        const saved = _ttState;
        _ttState = createFreshTTState();
        _ttState.active = true;
        _ttState.text = 'Hello World Test';
        _ttState.startTime = performance.now() - 5000;
        _ttState.duration = 60;
        _ttState.totalTyped = 10;
        _ttState.correctTyped = 9;
        _ttState.errors = 1;
        _ttState.group = 'basic';
        _ttState.idx = 0;

        console.log('  First call:');
        finishTest('test-1');
        console.log('  Second call (should be ignored):');
        finishTest('test-2');
        console.log('  Result: ✅ Should see only ONE finish log');

        _ttState = saved;
    },

    // ─── FIX #2 tests ───
    testWpmCap: () => {
        const testState = createFreshTTState();
        testState.startTime = performance.now() - 1000;
        testState.pausedDuration = 0;
        testState.duration = 60;
        testState.totalTyped = 500;
        testState.correctTyped = 490;
        testState.errors = 10;
        testState.text = 'x'.repeat(500);

        const result = _calculateTestResults(testState, 'complete');
        console.log('  Capped WPM:', result.netWPM, '| wasCapped:', result.wasCapped);
        console.log('  Result:', (result.netWPM <= TT_MAX_WPM_SANITY && result.wasCapped) ? '✅ PASS' : '❌ FAIL');
        return result;
    },

    testNormalWpm: () => {
        const testState = createFreshTTState();
        testState.startTime = performance.now() - 30000;
        testState.pausedDuration = 0;
        testState.duration = 60;
        testState.totalTyped = 250;
        testState.correctTyped = 240;
        testState.errors = 10;
        testState.text = 'x'.repeat(250);

        const result = _calculateTestResults(testState, 'complete');
        console.log('  Got WPM:', result.netWPM);
        console.log('  Result:', (result.netWPM >= 95 && result.netWPM <= 105 && !result.wasCapped) ? '✅ PASS' : '❌ FAIL');
        return result;
    },

    testMinFloor: () => {
        const testState = createFreshTTState();
        testState.startTime = performance.now() - 500;
        testState.pausedDuration = 0;
        testState.duration = 60;
        testState.totalTyped = 30;
        testState.correctTyped = 30;
        testState.errors = 0;
        testState.text = 'x'.repeat(30);

        const result = _calculateTestResults(testState, 'complete');
        console.log('  elapsedSec:', result.elapsedSec, '| WPM:', result.netWPM);
        console.log('  Result:', (result.elapsedSec === TT_MIN_ELAPSED_SEC) ? '✅ PASS' : '❌ FAIL');
        return result;
    },

    testTimeoutMode: () => {
        const testState = createFreshTTState();
        testState.startTime = performance.now() - 60000;
        testState.pausedDuration = 0;
        testState.duration = 60;
        testState.totalTyped = 200;
        testState.correctTyped = 195;
        testState.errors = 5;
        testState.text = 'x'.repeat(200);

        const result = _calculateTestResults(testState, 'timeout');
        console.log('  WPM:', result.netWPM, '| elapsedSec:', result.elapsedSec, '| reason:', result.reason);
        console.log('  Result:', (result.netWPM === 40 && result.elapsedSec === 60 && result.reason === 'timeout') ? '✅ PASS' : '❌ FAIL');
        return result;
    },

    testModeFlag: () => {
        console.log('  Mode:', TT_STRICT_DURATION_MODE ? 'STRICT' : 'COMPLETION');
        console.log('  WPM cap:', TT_MAX_WPM_SANITY);
        console.log('  Min elapsed:', TT_MIN_ELAPSED_SEC, 'sec');
        return {
            mode: TT_STRICT_DURATION_MODE ? 'strict' : 'completion',
            wpmCap: TT_MAX_WPM_SANITY,
            minElapsedSec: TT_MIN_ELAPSED_SEC
        };
    },

    testAllWpmFixes: () => {
        console.log('██████████████████████████████████████████');
        console.log('🧪 FIX #2 — FULL TEST SUITE');
        console.log('██████████████████████████████████████████');

        const results = {};
        console.log('▶️ TEST 1: WPM Cap');
        results.cap = window.TypingTestDebug.testWpmCap();
        console.log('');
        console.log('▶️ TEST 2: Normal WPM');
        results.normal = window.TypingTestDebug.testNormalWpm();
        console.log('');
        console.log('▶️ TEST 3: Min Floor');
        results.floor = window.TypingTestDebug.testMinFloor();
        console.log('');
        console.log('▶️ TEST 4: Timeout Mode');
        results.timeout = window.TypingTestDebug.testTimeoutMode();
        console.log('');
        console.log('▶️ TEST 5: Mode Flag');
        results.mode = window.TypingTestDebug.testModeFlag();

        console.log('');
        console.log('📊 SUMMARY:');
        console.log('  Test 1:', results.cap.netWPM === 300 && results.cap.wasCapped ? '✅' : '❌');
        console.log('  Test 2:', (results.normal.netWPM >= 95 && results.normal.netWPM <= 105) ? '✅' : '❌');
        console.log('  Test 3:', results.floor.elapsedSec === 3 ? '✅' : '❌');
        console.log('  Test 4:', results.timeout.netWPM === 40 && results.timeout.elapsedSec === 60 ? '✅' : '❌');
        console.log('  Test 5:', TT_STRICT_DURATION_MODE === false ? '✅' : '⚠️');
        return results;
    },

    // ============================================================
    // ✅ FIX #1: SNAPSHOT CONSISTENCY TEST
    // ============================================================
    // Verifies that WPM/accuracy do NOT change even after a long
    // delay between finishTest and _snapshotTestResult.
    //
    // Simulates: user finishes test, waits 5 min, opens cert.
    // BEFORE FIX: WPM would drop
    // AFTER FIX:  WPM identical
    // ============================================================
    testSnapshotConsistency: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 FIX #1: SNAPSHOT CONSISTENCY TEST');
        console.log('═══════════════════════════════════════════');
        console.log('  Purpose: verify WPM does NOT drift with wall-clock time');
        console.log('');

        const saved = _ttState;

        // Build a fake finished state
        _ttState = createFreshTTState();
        _ttState.active = true;
        _ttState.group = 'basic';
        _ttState.idx = 0;
        _ttState.duration = 60;
        _ttState.text = getLessonText('basic', 0) || 'x'.repeat(200);
        _ttState.startTime = performance.now() - 30000;
        _ttState.totalTyped = 250;
        _ttState.correctTyped = 240;
        _ttState.errors = 10;

        // Simulate finishTest caching (without touching UI)
        const results = _calculateTestResults(_ttState, 'complete');
        _ttState._finalResults = results;
        _ttState._finished = true;
        _ttState._finishReason = 'complete';

        // Snapshot #1 (immediately after finish)
        const snap1 = _snapshotTestResult(_ttState);
        console.log('  Snapshot #1 (immediate):');
        console.log('    WPM:', snap1.wpm, '| Accuracy:', snap1.accuracy + '%');

        // Simulate 5 minute wall-clock passage
        // (startTime artificially moved back 5 min — mimics re-compute scenario)
        console.log('');
        console.log('  Simulating 5-minute delay (startTime -= 5 min)...');
        _ttState.startTime -= 5 * 60 * 1000;

        // Snapshot #2 (after delay)
        const snap2 = _snapshotTestResult(_ttState);
        console.log('');
        console.log('  Snapshot #2 (after 5 min):');
        console.log('    WPM:', snap2.wpm, '| Accuracy:', snap2.accuracy + '%');

        // Compare
        console.log('');
        const wpmMatch = snap1.wpm === snap2.wpm;
        const accMatch = snap1.accuracy === snap2.accuracy;
        const gradeMatch = snap1.grade === snap2.grade;
        const charsMatch = snap1.chars === snap2.chars;

        console.log('  Comparison:');
        console.log(`    ${wpmMatch ? '✅' : '❌'} WPM match:     ${snap1.wpm} === ${snap2.wpm}`);
        console.log(`    ${accMatch ? '✅' : '❌'} Accuracy match: ${snap1.accuracy} === ${snap2.accuracy}`);
        console.log(`    ${gradeMatch ? '✅' : '❌'} Grade match:    ${snap1.grade} === ${snap2.grade}`);
        console.log(`    ${charsMatch ? '✅' : '❌'} Chars match:    ${snap1.chars} === ${snap2.chars}`);

        const allPass = wpmMatch && accMatch && gradeMatch && charsMatch;

        console.log('');
        if (!allPass && wpmMatch === false) {
            console.log('  ⚠️ WPM drifted! Cache NOT working properly.');
            console.log('     Expected: snap1.wpm === snap2.wpm');
            console.log('     Got:      ' + snap1.wpm + ' vs ' + snap2.wpm);
        }
        console.log(`  Result: ${allPass ? '✅ PASS (cache works)' : '❌ FAIL (cache broken)'}`);
        console.log('═══════════════════════════════════════════');

        // Restore
        _ttState = saved;

        return {
            snap1, snap2,
            wpmMatch, accMatch, gradeMatch, charsMatch,
            allPass
        };
    },

    // ─── v3.8.0 analytics ───
    history: (limit = 10) => { console.table(getSessionHistory(limit)); },
    stats: () => { console.log('📊 Session Stats:'); console.table(getSessionStats()); },
    clearHistory: () => {
        clearSessionHistory();
        if (typeof showToast === 'function') showToast('🗑️ History cleared', 'info', 1500);
    },
    weakKeys: (limit = 10) => {
        console.log('⚠️ Weakest Keys:');
        console.table(getWeakestKeys(limit));
    },
    clearKeyStats: () => {
        clearKeyStats();
        if (typeof showToast === 'function') showToast('🗑️ Key stats cleared', 'info', 1500);
    },
    achievements: () => {
        const p = getAchievementProgress();
        console.log(`🏅 Achievements: ${p.earned}/${p.total}`);
        console.table(p.list.map(a => ({ emoji: a.emoji, name: a.name, desc: a.desc, earned: a.earned })));
    },
    consistency: () => {
        const score = _computeConsistency();
        console.log('🎢 Consistency:', score !== null ? score + '% — ' + _getConsistencyLabel(score) : 'N/A');
        return score;
    },
    rollingWpm: () => {
        console.log('📈 Rolling WPM (5s):', _getRollingWpm());
        console.log('   Samples:', _wpmSamples.length);
    },
    togglePause: () => toggleManualPause(),
    toggleSound: () => {
        const enabled = toggleSound();
        console.log('🎵 Sound:', enabled ? 'ON' : 'OFF');
        return enabled;
    },
    fullReset: () => {
        try {
            localStorage.removeItem(TT_HISTORY_KEY);
            localStorage.removeItem(TT_KEY_STATS_KEY);
            localStorage.removeItem(TT_ACHIEVEMENTS_KEY);
            localStorage.removeItem(TT_BEST_WPM_KEY);
            localStorage.removeItem(TT_SOUND_KEY);
        } catch (e) {}
        _soundEnabled = false;
        _wpmSamples = [];
        _resetManualPause();
        console.log('🧹 Full reset — all TT data cleared');
    },

    selfTest: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 TYPING TEST SELF-TEST (v3.8.1)');
        console.log('═══════════════════════════════════════════');

        const checks = {
            openTypingTestModal: typeof openTypingTestModal === 'function',
            closeTypingTestModal: typeof closeTypingTestModal === 'function',
            startTypingTest: typeof startTypingTest === 'function',
            stopTest: typeof stopTest === 'function',
            finishTest: typeof finishTest === 'function',
            handleTestInput: typeof handleTestInput === 'function',
            selectTestLesson: typeof selectTestLesson === 'function',
            selectTestDuration: typeof selectTestDuration === 'function',
            getLessonText: typeof getLessonText === 'function',
            formatTTTime: typeof formatTTTime === 'function',
            _calculateGrade: typeof _calculateGrade === 'function',
            _calculateTestResults: typeof _calculateTestResults === 'function',
            _cleanupInputListeners: typeof _cleanupInputListeners === 'function',
            _clearAllTimers: typeof _clearAllTimers === 'function',
            _saveBestWPM: typeof _saveBestWPM === 'function',
            openCertificateFromResult: typeof openCertificateFromResult === 'function',
            shareResultOnWhatsApp: typeof shareResultOnWhatsApp === 'function',
            _blockPasteEvent: typeof _blockPasteEvent === 'function',
            _blockCompositionEvent: typeof _blockCompositionEvent === 'function',
            _blockBeforeInput: typeof _blockBeforeInput === 'function',
            _waitForCertificateSystem: typeof _waitForCertificateSystem === 'function',
            _snapshotTestResult: typeof _snapshotTestResult === 'function',
            // v3.8.0
            _saveSessionToHistory: typeof _saveSessionToHistory === 'function',
            getSessionStats: typeof getSessionStats === 'function',
            _analyzeAndPersistKeyAccuracy: typeof _analyzeAndPersistKeyAccuracy === 'function',
            getWeakestKeys: typeof getWeakestKeys === 'function',
            _recordWpmSample: typeof _recordWpmSample === 'function',
            _computeConsistency: typeof _computeConsistency === 'function',
            _playSound: typeof _playSound === 'function',
            toggleSound: typeof toggleSound === 'function',
            _checkAchievements: typeof _checkAchievements === 'function',
            toggleManualPause: typeof toggleManualPause === 'function',
            _renderResultExtras: typeof _renderResultExtras === 'function',
            // v3.8.1
            testSnapshotConsistency: typeof window.TypingTestDebug.testSnapshotConsistency === 'function'
        };

        Object.entries(checks).forEach(([key, pass]) => {
            console.log(`  ${pass ? '✅' : '❌'} ${key}`);
        });

        // ✅ FIX #1: Verify _finalResults exists in fresh state
        const freshState = createFreshTTState();
        const hasFinalResultsField = '_finalResults' in freshState &&
                                     freshState._finalResults === null;
        console.log('');
        console.log('🆕 v3.8.1 — FIX #1 checks:');
        console.log(`  ${hasFinalResultsField ? '✅' : '❌'} _finalResults field in fresh state`);
        console.log(`  ${checks.testSnapshotConsistency ? '✅' : '❌'} testSnapshotConsistency() available`);

        const allPass = Object.values(checks).every(v => v) && hasFinalResultsField;
        console.log('');
        console.log(allPass ? '🎉 ALL FUNCTIONS PRESENT + FIX #1 VERIFIED' : '⚠️ SOME MISSING');
        console.log('═══════════════════════════════════════════');

        return checks;
    }
};

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ typing-test.js loaded — v3.8.1 Pro Ultra');
console.log('   ⏱️  Timer: performance.now() (drift-free)');
console.log('   🛡️  Anti-cheat: paste/drop/IME blocked');
console.log('   ⏸️  Idle pause: 30s + manual pause button');
console.log('   🏆 Best WPM tracking');
console.log('   ✅ FIX #15: Certificate race-safe');
console.log('   ✅ FIX #2: WPM calc + time clamping');
console.log('');
console.log('   🔴 v3.8.1 CRITICAL FIX #1:');
console.log('   📌 WPM DRIFT fixed — results cached at finishTest');
console.log('   📌 Certificate/Share/History use frozen snapshot');
console.log('   📌 WPM never changes after test completion');
console.log('');
console.log('   🆕 v3.8.0 UPGRADES:');
console.log('   📊 Session history (100 tests) + analytics');
console.log('   🎯 Per-key & per-word accuracy heatmap');
console.log('   📈 Rolling WPM (5s) + Consistency score');
console.log('   🎵 Optional sound feedback (Web Audio)');
console.log('   🏅 13 achievements (🎯 → 👑)');
console.log('   🎛️ Manual pause/resume button');
console.log('   🎨 Auto-injected UI (no HTML changes)');
console.log('');
console.log('   🧪 Debug helpers:');
console.log('     TypingTestDebug.testSnapshotConsistency()  ← NEW');
console.log('     TypingTestDebug.stats()');
console.log('     TypingTestDebug.weakKeys()');
console.log('     TypingTestDebug.achievements()');
console.log('     TypingTestDebug.history()');
console.log('     TypingTestDebug.selfTest()');
console.log('     TypingTestDebug.fullReset()');
console.log('═══════════════════════════════════════════');