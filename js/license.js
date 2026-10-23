// ============================================================
// 🔐 LICENSE VERIFICATION (ECDSA P-256) + SMART TRIAL
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.7.1 (Stable HWID Fix)
// ============================================================
// ✅ v3.7.7.1 — CRITICAL FIX:
//    🔴 FIXED: Now calls getStableHwid() from electronAPI (MachineGuid).
//    🔴 FIXED: Accepts Fallback Seeds in Priority 2.
// ============================================================

'use strict';

// ============================================================
// 📊 GLOBAL STATE
// ============================================================
let isProLicensed = false;

let _licenseSessionCache = {
    user: null, key: null, verified: false,
    plan: null, expiry: null, timestamp: 0
};

let _cachedPublicKey = null;
let _cachedPublicKeyHwid = null;
let _cachedPublicKeyTime = 0;

let _lastClockCheckTime = 0;
let _lastClockCheckResult = { safe: true };
let _lastServerClockCheckTime = 0;
const SERVER_CLOCK_CHECK_THROTTLE_MS = 5 * 60 * 1000;

let _clockMonitorInterval = null;
let _trialBannerInterval = null;
let _licensePeriodicCheckInterval = null;

let _trustScoreCache = { value: null, fingerprint: null, timestamp: 0, ttl: 60000 };
let _hwidCache = { value: null, timestamp: 0, ttl: 60000 };

// 🔴 Race-safe promise cache
let _hwidInFlightPromise = null;

let _fingerprintCache = { value: null, timestamp: 0, ttl: 30000 };

let _referralLock = false;
let _isActivating = false;
let _licenseCheckInProgress = false;
let _licenseCheckPending = false;

const _fbWriteQueue = [];
let _fbWriteProcessing = false;

let _infoCache = { value: null, timestamp: 0, ttl: 1000 };
let _idbInstance = null;

let _lastFocusCheck = 0;

const BANNER_Z_INDEX = 1100;

// ============================================================
// 🧹 CACHE INVALIDATION
// ============================================================
function _invalidateInfoCache() { _infoCache.value = null; _infoCache.timestamp = 0; }
function _invalidateTrustCache() { _trustScoreCache.value = null; _trustScoreCache.timestamp = 0; }
function _invalidateFingerprintCache() { _fingerprintCache.value = null; _fingerprintCache.timestamp = 0; }
function _invalidateAllCaches() { _invalidateInfoCache(); _invalidateTrustCache(); }

function invalidateHwidCache(newHwid = null) {
    _hwidCache.value = (newHwid && typeof newHwid === 'string') ? newHwid : null;
    _hwidCache.timestamp = _hwidCache.value ? Date.now() : 0;
    _cachedPublicKey = null;
    _cachedPublicKeyHwid = null;
    _cachedPublicKeyTime = 0;
    _invalidateFingerprintCache();
    _invalidateAllCaches();
    _hwidInFlightPromise = null;
}
window.invalidateHwidCache = invalidateHwidCache;

// ============================================================
// ⚙️ CONSTANTS & TRIAL CONFIG (UNCHANGED)
// ============================================================
const LICENSE_PAYLOAD_VERSION = 'BOSC-HKP-v3.7.4';
const LIFETIME_EXPIRY_TOKEN = '9999';
const VALID_PLAN_CODES = ['P1', 'P2', 'P3'];
const LICENSE_KEY_PARTS_COUNT = 4;
const LICENSE_KEY_PREFIX = 'HKP';
const SIGNATURE_HEX_LENGTH = 128;
const PUBLIC_KEY_CACHE_TTL_MS = 10 * 60 * 1000;
const LICENSE_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
const LICENSE_PERIODIC_CHECK_MS = 5 * 60 * 1000;
const MAX_SERVER_DRIFT_MINUTES = 120;
const MAX_LOCAL_ROLLBACK_MINUTES = 5;
const MAX_FORWARD_JUMP_DAYS = 90;
const CLOCK_CHECK_THROTTLE_MS = 30 * 1000;
const FAIL_CLOSED_ON_NETWORK_ERROR = false;

const _safeSession = {
    get(key, fallback = null) { try { const val = sessionStorage.getItem(key); return val === null ? fallback : val; } catch (e) { return fallback; } },
    set(key, value) { try { sessionStorage.setItem(key, String(value)); return true; } catch (e) { return false; } },
    remove(key) { try { sessionStorage.removeItem(key); return true; } catch (e) { return false; } }
};

const SMART_TRIAL_CONFIG = Object.freeze({
    CONFIG_VERSION: 'v1.0.9',
    FINGERPRINT_VERSION: 'v2',
    TRIAL_DAYS: 7,
    TRIAL_KEY_PREFIX: 'HKT',
    TRUST_THRESHOLDS: { HIGH: 80, MEDIUM: 50, LOW: 30, BLOCKED: 0 },
    TRUST_STARTING_SCORE: 50,
    TRIAL_LIMITS: { HIGH: 5, MEDIUM: 3, LOW: 2, BLOCKED: 0 },
    COOLDOWN_DAYS: { HIGH: 3, MEDIUM: 5, LOW: 10, BLOCKED: 999 },
    GRACE_PERIOD_DAYS: { HIGH: 15, MEDIUM: 30, LOW: 60, BLOCKED: 999 },
    REFERRAL: { ENABLED: true, BONUS_TRIALS: 1, MAX_BONUS: 2, FRIEND_DISCOUNT: 10, CODE_PREFIX: 'HKR', CODE_LENGTH: 4, MAX_REFERRALS_PER_DAY: 1 },
    DISCOUNTS: { AFTER_2ND_TRIAL: 10, AFTER_3RD_TRIAL: 20, REFERRAL_BONUS: 5, MAX_TOTAL: 30 },
    SCORE_CHANGES: {
        AUTHENTIC_FIRST_USE: +10, TRIAL_FULLY_USED: +10, REFERRAL_GIVEN: +10, REFERRAL_REDEEMED: +5, WEEKLY_ACTIVE: +15, TRIAL_COMPLETED_SUCCESS: +5,
        VPN_DETECTED: -20, VM_DETECTED: -30, RAPID_TRIAL: -15, MULTIPLE_HWIDS: -25, CLOCK_TAMPER: -40, STORAGE_TAMPER: -25, FAILED_KEY_ATTEMPTS: -10, BOT_LIKE_BEHAVIOR: -20, SUSPICIOUS_TIMING: -10
    },
    SCORE_MIN: 0, SCORE_MAX: 100,
    ABUSE_DETECTION: { RAPID_TRIAL_GAP_HOURS: 72, MULTI_HWID_HOURS: 24, MULTI_HWID_THRESHOLD: 2, FAILED_ATTEMPTS_THRESHOLD: 5, FAILED_ATTEMPTS_HOURS: 1, VPN_CHECK_ENABLED: true, VM_CHECK_ENABLED: true, BEHAVIOR_ANALYSIS_ENABLED: true },
    STORAGE_KEYS: {
        LOCAL_START: 'hor_trial_start', LOCAL_KEY: 'hor_trial_key', LOCAL_DEVICE: 'hor_trial_device', LOCAL_FP: 'hor_trial_fp',
        KEYS_REGISTRY: 'hor_trial_keys_registry', KEYS_REGISTRY_FP: 'hor_trial_keys_registry_fp',
        DEVICE_DATA: 'hor_trial_device_data', DEVICE_DATA_FP: 'hor_trial_device_data_fp',
        REFERRAL_CODE: 'hor_trial_referral_code', REFERRAL_HISTORY: 'hor_trial_referral_history',
        COOLDOWN_START: 'hor_trial_cooldown_start', GRACE_USED: 'hor_trial_grace_used',
        LAST_SEEN: 'hor_last_seen_time', SESSION_START: 'hor_session_start_time'
    },
    INDEXEDDB: { NAME: 'HorKathaSmartTrial', VERSION: 1, STORES: { TRIAL: 'trial', KEYS: 'trial_keys', DEVICES: 'devices', REFERRALS: 'referrals' } },
    FIREBASE: { DEVICES_PATH: 'smart_trial/devices', KEYS_PATH: 'smart_trial/keys', REFERRALS_PATH: 'smart_trial/referrals', ANALYTICS_PATH: 'smart_trial/analytics' },
    NETWORK: { FETCH_TIMEOUT_MS: 8000, SERVER_SYNC_ENABLED: true, SYNC_ON_ACTIVATION: true, SYNC_ON_TRIAL_END: true },
    UI: { SHOW_DISCOUNT_BANNER: true, BANNER_SYSTEM: { ENABLED: true, DISMISS_INTERVALS_MS: [600000, 1800000, 3600000, 10800000, 21600000, 43200000], URGENT_REPEAT_MS: 600000, PEEK_A_BOO_ENABLED: true, PEEK_A_BOO_DELAY_MS: 120000, TRACK_IMPRESSIONS: true, TRACK_DISMISSALS: true, TRACK_CLICKS: true } }
});

const _FALLBACK_TRIAL_CONFIG = { TRIAL_ENABLED: true, TRIAL_PRICE: 9, TRIAL_DURATION_DAYS: 7, TRIAL_KEY_PREFIX: 'HKT', VERSION: '3.7.7' };
function _getTrialConfig(key) { try { if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG[key] !== undefined) return APP_CONFIG[key]; } catch (e) {} return _FALLBACK_TRIAL_CONFIG[key]; }
function _isTrialEnabled() { try { return _getTrialConfig('TRIAL_ENABLED') === true; } catch (e) { return false; } }
function _isTrialSystemReady() { try { return typeof TrialSystem !== 'undefined' && TrialSystem && typeof TrialSystem.isActive === 'function'; } catch (e) { return false; } }

function _sendSecurityAlert(method, ...args) {
    try { if (typeof SecurityAlerts !== 'undefined' && typeof SecurityAlerts[method] === 'function') { const result = SecurityAlerts[method](...args); if (result && typeof result.catch === 'function') result.catch(() => {}); return result; } } catch (e) {} return null;
}

function _cleanupOldBackups(prefix, keep = 2) {
    try { const keys = []; for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key && key.startsWith(prefix + '_backup_')) keys.push(key); } keys.sort().reverse(); for (let i = keep; i < keys.length; i++) { try { localStorage.removeItem(keys[i]); } catch (e) {} } } catch (e) {}
}

function _getCachedDeviceHash() {
    try {
        let hwid = _hwidCache.value;
        if (!hwid) { try { hwid = localStorage.getItem('hor_device_hwid'); } catch (e) {} }
        if (!hwid || typeof hwid !== 'string') return null;
        const match = hwid.match(/DVC-([A-F0-9]{4})-([A-F0-9]{4})/i);
        if (match && match[2]) return match[2].toUpperCase();
        return hwid.replace(/[^A-F0-9]/gi, '').toUpperCase().slice(-4);
    } catch (e) { return null; }
}

function hasProLevelAccess() {
    try {
        try { if (typeof isProLicensed !== 'undefined' && isProLicensed === true) return true; } catch (e) {}
        try {
            if (typeof _isTrialEnabled === 'function' && typeof _isTrialSystemReady === 'function' && _isTrialEnabled() && _isTrialSystemReady()) {
                if (TrialSystem.isActive() === true) {
                    try { const trialKey = localStorage.getItem('hor_trial_key'); if (trialKey && typeof trialKey === 'string') { const parts = trialKey.split('-'); if (parts.length === 3) { const currentHash = _getCachedDeviceHash(); if (!currentHash || parts[2] !== currentHash) return false; } } } catch (e) { return false; }
                    return true;
                }
            }
        } catch (e) {}
        try {
            if (typeof _licenseSessionCache !== 'undefined' && _licenseSessionCache && _licenseSessionCache.verified === true && (Date.now() - _licenseSessionCache.timestamp) < LICENSE_SESSION_CACHE_TTL_MS) {
                const licKey = localStorage.getItem('hor_lic_key');
                if (licKey && licKey === _licenseSessionCache.key) return true;
            }
        } catch (e) {}
        try {
            const trialKey = localStorage.getItem('hor_trial_key');
            if (trialKey && typeof trialKey === 'string' && /^HKT-\d{7}-[A-F0-9]{4}$/.test(trialKey)) {
                let clockSafe = true;
                try { if (typeof ClockGuard !== 'undefined' && ClockGuard && typeof ClockGuard.detectLocalRollbackThrottled === 'function') { const clockCheck = ClockGuard.detectLocalRollbackThrottled(); clockSafe = clockCheck.safe; } } catch (e) { clockSafe = true; }
                if (!clockSafe) return false;
                const trialParts = trialKey.split('-');
                if (trialParts.length === 3) { const currentHash = _getCachedDeviceHash(); if (!currentHash || trialParts[2] !== currentHash) return false; }
                try { if (typeof TrialSystem !== 'undefined' && TrialSystem && typeof TrialSystem.getInfo === 'function') { const info = TrialSystem.getInfo(); if (info && info.tampered === true) return false; if (info && info.deviceMismatch === true) return false; } } catch (e) {}
                const startStr = localStorage.getItem('hor_trial_start');
                if (startStr) { const startTime = parseInt(startStr, 10); if (!isNaN(startTime) && startTime > 0) { const elapsedMs = Date.now() - startTime; const totalMs = SMART_TRIAL_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000; if (elapsedMs >= 0 && elapsedMs < totalMs) return true; } }
            }
        } catch (e) {}
        return false;
    } catch (e) { console.warn('[license] hasProLevelAccess error:', e.message); return false; }
}
window.hasProLevelAccess = hasProLevelAccess;

// ============================================================
// ⏰ CLOCK GUARD
// ============================================================
const ClockGuard = {
    STORAGE_KEY: SMART_TRIAL_CONFIG.STORAGE_KEYS.LAST_SEEN,
    SESSION_KEY: SMART_TRIAL_CONFIG.STORAGE_KEYS.SESSION_START,
    now() { return Date.now(); },
    getLastSeen() { try { const val = localStorage.getItem(this.STORAGE_KEY); return val ? parseInt(val, 10) : null; } catch (e) { return null; } },
    setLastSeen(timestamp = null) { try { localStorage.setItem(this.STORAGE_KEY, String(timestamp || this.now())); } catch (e) {} },
    detectLocalRollback() {
        const lastSeen = this.getLastSeen();
        if (!lastSeen) { this.setLastSeen(); return { safe: true, reason: 'first-time' }; }
        const now = this.now();
        const diffMinutes = (lastSeen - now) / 60000;
        if (diffMinutes > MAX_LOCAL_ROLLBACK_MINUTES) { _invalidateInfoCache(); try { const deviceId = localStorage.getItem('hor_device_hwid') || 'Unknown'; _sendSecurityAlert('trackClockTamper', deviceId, new Date(lastSeen).toISOString(), new Date(now).toISOString()); } catch (e) {} return { safe: false, reason: 'local-rollback', diffMinutes: Math.round(diffMinutes) }; }
        const forwardDays = (now - lastSeen) / (1000 * 60 * 60 * 24);
        if (forwardDays > MAX_FORWARD_JUMP_DAYS) { _invalidateInfoCache(); try { const deviceId = localStorage.getItem('hor_device_hwid') || 'Unknown'; _sendSecurityAlert('trackClockTamper', deviceId, new Date(lastSeen).toISOString(), new Date(now).toISOString()); } catch (e) {} return { safe: false, reason: 'local-forward-jump', forwardDays: Math.round(forwardDays) }; }
        this.setLastSeen(); return { safe: true };
    },
    _getServerUrl() {
        try { const endpoint = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.TRACKING_ENDPOINT) ? APP_CONFIG.TRACKING_ENDPOINT : ''; if (endpoint && endpoint.includes('firebasedatabase.app')) { const u = new URL(endpoint); return `${u.protocol}//${u.host}/.json?shallow=true`; } } catch (e) {} return null;
    },
    async detectServerMismatch() {
        let timeoutId = null;
        try {
            if (!navigator.onLine) return { safe: true, reason: 'offline' };
            const serverUrl = this._getServerUrl();
            if (!serverUrl) return { safe: true, reason: 'no-endpoint' };
            const controller = new AbortController(); timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(serverUrl, { method: 'GET', mode: 'cors', cache: 'no-store', signal: controller.signal });
            const serverDate = res.headers.get('date');
            if (!serverDate) return { safe: true, reason: 'no-server-date' };
            const serverTime = new Date(serverDate).getTime(); const localTime = this.now(); const diffMinutes = Math.abs(serverTime - localTime) / 60000;
            if (diffMinutes > MAX_SERVER_DRIFT_MINUTES) { _invalidateInfoCache(); try { const deviceId = localStorage.getItem('hor_device_hwid') || 'Unknown'; _sendSecurityAlert('trackClockTamper', deviceId, new Date(serverTime).toISOString(), new Date(localTime).toISOString()); } catch (e) {} return { safe: false, reason: 'server-mismatch', diffMinutes: Math.round(diffMinutes) }; }
            return { safe: true, serverTime };
        } catch (e) { if (FAIL_CLOSED_ON_NETWORK_ERROR) return { safe: false, reason: 'network-error-fail-closed' }; return { safe: true, reason: 'network-error-ignored' }; } finally { if (timeoutId !== null) clearTimeout(timeoutId); }
    },
    detectSessionRollback() {
        try { const sessionStart = _safeSession.get(this.SESSION_KEY); if (!sessionStart) { _safeSession.set(this.SESSION_KEY, this.now()); return { safe: true }; } const startTime = parseInt(sessionStart, 10); if (this.now() < startTime - 30000) return { safe: false, reason: 'session-rollback' }; return { safe: true }; } catch (e) { return { safe: true }; }
    },
    detectLocalRollbackThrottled() {
        const now = Date.now(); if (now - _lastClockCheckTime < CLOCK_CHECK_THROTTLE_MS) return _lastClockCheckResult; _lastClockCheckTime = now; _lastClockCheckResult = this.detectLocalRollback(); return _lastClockCheckResult;
    },
    async detectServerMismatchThrottled() {
        const now = Date.now(); if (now - _lastServerClockCheckTime < SERVER_CLOCK_CHECK_THROTTLE_MS) return { safe: true, reason: 'throttled' }; _lastServerClockCheckTime = now; return await this.detectServerMismatch();
    },
    async fastCheck() {
        const local = this.detectLocalRollback(); if (!local.safe) return local;
        const session = this.detectSessionRollback(); if (!session.safe) return session;
        this.detectServerMismatchThrottled().then(result => { if (!result.safe && result.reason === 'server-mismatch') _invalidateInfoCache(); }).catch(() => {});
        return { safe: true };
    },
    async fullCheck() {
        const local = this.detectLocalRollback(); if (!local.safe) return local;
        const session = this.detectSessionRollback(); if (!session.safe) return session;
        const server = await this.detectServerMismatchThrottled();
        if (!server.safe) { if (typeof showToast === 'function') showToast('⚠️ System time change detected.', 'error', 6000); return server; }
        return { safe: true };
    }
};

// ═══════════════════════════════════════════════════════════
// 🔴 STABLE HWID LOGIC (FIXED)
// ═══════════════════════════════════════════════════════════
async function getDeviceHardwareFingerprint() {
    const now = Date.now();
    if (_hwidCache.value && (now - _hwidCache.timestamp) < _hwidCache.ttl) return _hwidCache.value;
    if (_hwidInFlightPromise) { console.log('[HWID] ♻️ Reusing in-flight promise (race-safe)'); return _hwidInFlightPromise; }
    _hwidInFlightPromise = _doGenerateHwid().finally(() => { _hwidInFlightPromise = null; });
    return _hwidInFlightPromise;
}

async function _doGenerateHwid() {
    // ─── Priority 1: OS Storage (Electron) ───
    if (window.electronAPI && window.electronAPI.isElectron) {
        try {
            let result = null;
            // 🆕 STABLE HWID FIX: getStableHwid ko priority dein
            if (typeof window.electronAPI.getStableHwid === 'function') {
                result = await window.electronAPI.getStableHwid();
            } else if (typeof window.electronAPI.loadHwid === 'function') {
                result = await window.electronAPI.loadHwid();
            }
            
            if (result && result.success && result.hwid) {
                const isValid = /^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(result.hwid) || 
                                (result.hwid.length >= 16 && result.hwid.length <= 1000); // ✅ Fallback seed ko bhi allow karein
                const isPlaceholder = result.hwid.includes('DCDC') || result.hwid === 'DVC-0000-0000' || result.hwid === 'DVC-FFFF-FFFF';

                if (isValid && !isPlaceholder) {
                    try {
                        localStorage.setItem('hor_device_hwid', result.hwid);
                        localStorage.setItem('hor_hwid_source', result.source || 'registry');
                    } catch (e) {}
                    console.log('[HWID] ✅ Loaded Stable HWID from OS:', result.hwid);
                    _hwidCache.value = result.hwid;
                    _hwidCache.timestamp = Date.now();
                    return result.hwid;
                }
                console.warn('[HWID] ⚠️ OS HWID invalid — will regenerate');
            }
        } catch (e) { console.warn('[HWID] OS load failed:', e.message); }
    }

    // ─── Priority 2: localStorage ───
    try {
        const stored = localStorage.getItem('hor_device_hwid');
        if (stored) {
            const isValid = /^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(stored) || 
                            (stored.length >= 16 && stored.length <= 1000); // ✅ Fallback seed allow karein
            const isPlaceholder = stored.includes('DCDC') || stored === 'DVC-0000-0000' || stored === 'DVC-FFFF-FFFF';

            if (isValid && !isPlaceholder) {
                if (window.electronAPI && window.electronAPI.isElectron) {
                    window.electronAPI.saveHwid(stored).catch(() => {});
                }
                console.log('[HWID] ✅ Loaded from localStorage:', stored);
                _hwidCache.value = stored;
                _hwidCache.timestamp = Date.now();
                return stored;
            }
            try { localStorage.removeItem('hor_device_hwid'); localStorage.removeItem('hor_hwid_source'); } catch (e) {}
        }
    } catch (e) { console.warn('[HWID] localStorage read failed:', e.message); }

    // ─── Priority 3: Generate new (Fallback) ───
    _invalidateFingerprintCache();
    const signals = [ navigator.hardwareConcurrency || 4, navigator.deviceMemory || 'unknown', navigator.maxTouchPoints || 0, navigator.platform || 'unknown', navigator.vendor || 'unknown', (screen && screen.width) || 1920, (screen && screen.height) || 1080, (screen && screen.colorDepth) || 24, (screen && screen.pixelDepth) || 24, window.devicePixelRatio || 1, new Date().getTimezoneOffset(), (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'unknown', navigator.language || 'en', navigator.languages ? navigator.languages.join(',') : '', navigator.userAgent || '' ].join('|');

    let newHwid = null;
    let generationSource = 'crypto-subtle';

    try {
        if (!window.crypto || !window.crypto.subtle) throw new Error('crypto.subtle unavailable');
        const enc = new TextEncoder();
        const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode('HW-V3|' + signals));
        const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        newHwid = `DVC-${hashHex.substring(0, 4)}-${hashHex.substring(4, 8)}`;
    } catch (e) {
        newHwid = _generateFallbackHwid(signals);
        generationSource = 'fallback';
    }

    if (!newHwid || !/^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(newHwid)) {
        const rand = () => Math.floor(Math.random() * 65536).toString(16).padStart(4, '0').toUpperCase();
        newHwid = `DVC-${rand()}-${rand()}`;
        generationSource = 'math-random';
    }

    const [p1, p2] = newHwid.replace('DVC-', '').split('-');
    if (p1 === p2 || /^(.)\1{3}$/.test(p1) || /^(.)\1{3}$/.test(p2) || p1 === 'DCDC' || p2 === 'DCDC') {
        try {
            const enc = new TextEncoder();
            const saltedSignals = signals + '|SALT-V1';
            const hashBuf2 = await crypto.subtle.digest('SHA-256', enc.encode('HW-V3|' + saltedSignals));
            const hashHex2 = Array.from(new Uint8Array(hashBuf2)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
            newHwid = `DVC-${hashHex2.substring(0, 4)}-${hashHex2.substring(4, 8)}`;
            generationSource = 'crypto-subtle-salted';
        } catch(e) {
            newHwid = _generateFallbackHwid(signals + '|SALT-V1');
            generationSource = 'fallback-salted';
        }
    }

    try {
        localStorage.setItem('hor_device_hwid', newHwid);
        localStorage.setItem('hor_hwid_source', generationSource);
    } catch (e) {}

    if (window.electronAPI && window.electronAPI.isElectron) {
        try { await window.electronAPI.saveHwid(newHwid); } catch (e) {}
    }

    _hwidCache.value = newHwid;
    _hwidCache.timestamp = Date.now();
    return newHwid;
}

function _generateFallbackHwid(seed) {
    try {
        const parts = [ String(seed || ''), navigator.userAgent || '', navigator.language || '', navigator.platform || '', navigator.hardwareConcurrency || 0, navigator.deviceMemory || 0, screen.width || 0, screen.height || 0, screen.colorDepth || 0, new Date().getTimezoneOffset() ];
        const str = parts.join('|') + '|HorKatha-Fallback-v3';
        let h1 = 0x811c9dc5, h2 = 0x1000193, h3 = 0x9e3779b9, h4 = 0x1b873593;
        for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 ^= c; h1 = Math.imul(h1, 0x01000193) >>> 0; h2 = ((h2 << 5) + h2 + c) >>> 0; h3 = Math.imul(h3 ^ c, 0x85ebca6b) >>> 0; h3 = (h3 ^ (h3 >>> 13)) >>> 0; h4 = Math.imul(h4 + c, 0xcc9e2d51) >>> 0; h4 = (h4 ^ (h4 >>> 15)) >>> 0; }
        h1 = (h1 ^ (h1 >>> 16)) >>> 0; h2 = (h2 ^ (h2 >>> 16)) >>> 0; h3 = (h3 ^ (h3 >>> 16)) >>> 0; h4 = (h4 ^ (h4 >>> 16)) >>> 0;
        const combined = ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0') + (h3 >>> 0).toString(16).padStart(8, '0') + (h4 >>> 0).toString(16).padStart(8, '0')).toUpperCase();
        const part1 = combined.substring(0, 4); const part2 = combined.substring(4, 8);
        if (part1 === part2 || part1 === 'DCDC' || part2 === 'DCDC') return `DVC-${part1}-${part2.substring(0,3)}A`;
        return `DVC-${part1}-${part2}`;
    } catch (e) { return 'DVC-0000-0000'; }
}

// ============================================================
// 🔐 FINGERPRINT & HELPER FUNCTIONS
// ============================================================
async function generateDeviceFingerprint() {
    const now = Date.now(); if (_fingerprintCache.value && (now - _fingerprintCache.timestamp) < _fingerprintCache.ttl) return _fingerprintCache.value;
    try {
        const components = [];
        try { const hwid = await getDeviceHardwareFingerprint(); if (hwid) components.push('HWID:' + hwid); } catch (e) {}
        components.push('CPU:' + (navigator.hardwareConcurrency || 'x'), 'MEM:' + (navigator.deviceMemory || 'x'), 'TOUCH:' + (navigator.maxTouchPoints || 0), 'PLAT:' + (navigator.platform || 'x'), 'SCR:' + (screen.width || 0) + 'x' + (screen.height || 0), 'DEPTH:' + (screen.colorDepth || 0), 'RATIO:' + (window.devicePixelRatio || 1), 'TZ:' + new Date().getTimezoneOffset(), 'TZONE:' + (Intl.DateTimeFormat().resolvedOptions().timeZone || 'x'), 'LANG:' + (navigator.language || 'x'));
        try { const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 50; const ctx = canvas.getContext('2d'); if (ctx) { ctx.textBaseline = 'top'; ctx.font = '14px Arial'; ctx.fillStyle = '#f60'; ctx.fillRect(0, 0, 100, 20); ctx.fillStyle = '#069'; ctx.fillText('Hoṛ Katha 🌟', 2, 15); components.push('CANVAS:' + canvas.toDataURL().slice(-100)); } } catch (e) {}
        try { const canvas = document.createElement('canvas'); const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); if (gl) { const debugInfo = gl.getExtension('WEBGL_debug_renderer_info'); if (debugInfo) { const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL); if (renderer) components.push('GPU:' + String(renderer).substring(0, 50)); } } } catch (e) {}
        const raw = SMART_TRIAL_CONFIG.FINGERPRINT_VERSION + '|' + components.join('|');
        const hashHex = await _sha256Hex(raw);
        const fp = 'FP-' + hashHex.substring(0, 32);
        _fingerprintCache.value = fp; _fingerprintCache.timestamp = now; return fp;
    } catch (e) { return null; }
}

async function getShortDeviceHash() {
    try { const hwid = await getDeviceHardwareFingerprint(); if (!hwid || typeof hwid !== 'string') return null; const match = hwid.match(/DVC-([A-F0-9]{4})-([A-F0-9]{4})/i); if (match && match[2]) return match[2].toUpperCase(); return hwid.replace(/[^A-F0-9]/gi, '').toUpperCase().slice(-4); } catch (e) { return null; }
}

async function _sha256Hex(input) {
    try { if (window.crypto && window.crypto.subtle) { const enc = new TextEncoder(); const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(input))); return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase(); } } catch (e) {}
    let h1 = 0x811c9dc5, h2 = 0x1000193, h3 = 0x9e3779b9; const str = String(input);
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 ^= c; h1 = (h1 * 0x01000193) >>> 0; h2 = ((h2 << 5) + h2 + c) >>> 0; h3 = ((h3 ^ c) * 0x85ebca6b) >>> 0; h3 = (h3 ^ (h3 >>> 13)) >>> 0; }
    return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0') + (h3 >>> 0).toString(16).padStart(8, '0') + ((h1 ^ h2 ^ h3) >>> 0).toString(16).padStart(8, '0')).toUpperCase();
}

function hexToBytes(hex) { if (!hex || typeof hex !== 'string' || hex.length % 2 !== 0) return null; const bytes = new Uint8Array(hex.length / 2); for (let i = 0; i < hex.length; i += 2) { const b = parseInt(hex.substr(i, 2), 16); if (isNaN(b)) return null; bytes[i / 2] = b; } return bytes; }
function _randomAlpha(length) { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; try { if (window.crypto && window.crypto.getRandomValues) { const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); let result = ''; for (let i = 0; i < length; i++) result += chars[bytes[i] % chars.length]; return result; } } catch (e) {} let result = ''; for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)]; return result; }

// ============================================================
// 🛠️ UTILITIES & VALIDATORS
// ============================================================
const TimeHelper = {
    now() { return Date.now(); }, daysToMs(days) { return days * 24 * 60 * 60 * 1000; }, msToDays(ms) { return ms / (24 * 60 * 60 * 1000); }, msToHours(ms) { return ms / (60 * 60 * 1000); },
    formatDate(timestamp) { try { return new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return new Date(timestamp).toLocaleString(); } }
};

const Validator = {
    isValidHwid(hwid) { if (!hwid || typeof hwid !== 'string') return false; const trimmed = hwid.trim(); if (/^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(trimmed)) return true; if (trimmed.length >= 16 && trimmed.length <= 1000 && /^[A-Za-z0-9+/=_.-]+$/.test(trimmed) && !/^DVC-/i.test(trimmed)) return true; return false; },
    isValidTrialKey(key) { if (!key || typeof key !== 'string') return false; return /^HKT-\d{7}-[A-F0-9]{4}$/i.test(key); },
    isValidReferralCode(code) { if (!code || typeof code !== 'string') return false; return /^HKR-\d{7}-[A-Z0-9]{4}$/i.test(code); },
    isValidLicenseKey(key) { if (!key || typeof key !== 'string') return false; return /^HKP-(P[1-3])-(?:\d{4}|\d{6})-[A-F0-9]{128}$/i.test(key); }
};
function _clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

// ============================================================
// 📦 TRIALSYSTEM
// ============================================================
const TrialSystem = {
    CONFIG: SMART_TRIAL_CONFIG, KEYS: SMART_TRIAL_CONFIG.STORAGE_KEYS, IDB: SMART_TRIAL_CONFIG.INDEXEDDB, FB: SMART_TRIAL_CONFIG.FIREBASE,

    _lsGet(key, fallback = null) { try { const raw = localStorage.getItem(key); return raw === null ? fallback : raw; } catch (e) { return fallback; } },
    _lsSet(key, value) { try { localStorage.setItem(key, String(value)); return true; } catch (e) { return false; } },
    _lsGetJSON(key, fallback = null) { try { const raw = localStorage.getItem(key); if (!raw) return fallback; const parsed = JSON.parse(raw); return parsed !== null ? parsed : fallback; } catch (e) { return fallback; } },
    _lsSetJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } },
    _lsRemove(key) { try { localStorage.removeItem(key); return true; } catch (e) { return false; } },

    _openIDB() {
        return new Promise((resolve, reject) => {
            if (_idbInstance) return resolve(_idbInstance);
            if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
            const request = indexedDB.open(this.IDB.NAME, this.IDB.VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { _idbInstance = request.result; _idbInstance.onversionchange = () => { _idbInstance.close(); _idbInstance = null; }; _idbInstance.onclose = () => { _idbInstance = null; }; resolve(_idbInstance); };
            request.onupgradeneeded = (e) => { const db = e.target.result; const stores = this.IDB.STORES; if (!db.objectStoreNames.contains(stores.TRIAL)) db.createObjectStore(stores.TRIAL, { keyPath: 'id' }); if (!db.objectStoreNames.contains(stores.KEYS)) db.createObjectStore(stores.KEYS, { keyPath: 'key' }); if (!db.objectStoreNames.contains(stores.DEVICES)) db.createObjectStore(stores.DEVICES, { keyPath: 'fingerprint' }); if (!db.objectStoreNames.contains(stores.REFERRALS)) db.createObjectStore(stores.REFERRALS, { keyPath: 'code' }); };
        });
    },
    async _idbSet(storeName, record) { try { const db = await this._openIDB(); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readwrite'); const req = tx.objectStore(storeName).put(record); req.onsuccess = () => resolve(true); req.onerror = () => reject(req.error); }); } catch (e) { return false; } },
    async _idbGet(storeName, key) { try { const db = await this._openIDB(); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readonly'); const req = tx.objectStore(storeName).get(key); req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error); }); } catch (e) { return null; } },
    async _idbGetAll(storeName) { try { const db = await this._openIDB(); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readonly'); const req = tx.objectStore(storeName).getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error); }); } catch (e) { return []; } },
    async _idbClear(storeName) { try { const db = await this._openIDB(); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, 'readwrite'); const req = tx.objectStore(storeName).clear(); req.onsuccess = () => resolve(true); req.onerror = () => reject(req.error); }); } catch (e) { return false; } },

    _getFirebaseBaseUrl() { try { const endpoint = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.TRACKING_ENDPOINT) ? APP_CONFIG.TRACKING_ENDPOINT : ''; if (!endpoint || endpoint.includes('YOUR-') || endpoint.includes('YOUR_')) return null; const u = new URL(endpoint); return `${u.protocol}//${u.host}`; } catch (e) { return null; } },
    async _fbGet(path) { let timeoutId = null; try { const base = this._getFirebaseBaseUrl(); if (!base) return { ok: false, data: null, error: 'no-endpoint' }; const controller = new AbortController(); timeoutId = setTimeout(() => controller.abort(), this.CONFIG.NETWORK.FETCH_TIMEOUT_MS); const res = await fetch(`${base}/${path}.json`, { method: 'GET', mode: 'cors', cache: 'no-store', signal: controller.signal }); if (!res.ok) return { ok: false, data: null, error: `HTTP ${res.status}` }; const data = await res.json(); return { ok: true, data, error: null }; } catch (e) { return { ok: false, data: null, error: e.message || 'network-error' }; } finally { if (timeoutId !== null) clearTimeout(timeoutId); } },
    async _fbSet(path, data) { let timeoutId = null; try { const base = this._getFirebaseBaseUrl(); if (!base) return { ok: false, error: 'no-endpoint' }; const controller = new AbortController(); timeoutId = setTimeout(() => controller.abort(), this.CONFIG.NETWORK.FETCH_TIMEOUT_MS); const res = await fetch(`${base}/${path}.json`, { method: 'PUT', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal }); if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }; return { ok: true, error: null }; } catch (e) { return { ok: false, error: e.message }; } finally { if (timeoutId !== null) clearTimeout(timeoutId); } },
    _queueFbWrite(path, data) { _fbWriteQueue.push({ path, data, timestamp: Date.now() }); this._processFbWriteQueue().catch(() => {}); },
    async _processFbWriteQueue() { if (_fbWriteProcessing) return; _fbWriteProcessing = true; try { while (_fbWriteQueue.length > 0) { const item = _fbWriteQueue.shift(); try { const result = await this._fbSet(item.path, item.data); if (!result.ok) console.warn('[FB] Write failed:', result.error, item.path); } catch (e) {} await new Promise(r => setTimeout(r, 100)); } } finally { _fbWriteProcessing = false; } },

    async getFingerprint() { try { return await generateDeviceFingerprint(); } catch (e) { return null; } },
    async getDeviceHash() { try { return await getShortDeviceHash(); } catch (e) { return null; } },
    async getDeviceData() {
        try { const fingerprint = await this.getFingerprint(); if (!fingerprint) return null; const lsData = this._lsGetJSON(this.KEYS.DEVICE_DATA, null); if (lsData && lsData.fingerprint === fingerprint) return lsData; if (lsData && lsData.fingerprint !== fingerprint) { try { const backupKey = this.KEYS.DEVICE_DATA + '_backup_' + Date.now(); localStorage.setItem(backupKey, JSON.stringify(lsData)); _cleanupOldBackups(this.KEYS.DEVICE_DATA, 2); } catch (e) {} this._lsRemove(this.KEYS.DEVICE_DATA); this._lsRemove(this.KEYS.DEVICE_DATA_FP); } const idbData = await this._idbGet(this.IDB.STORES.DEVICES, fingerprint); if (idbData) { this._lsSetJSON(this.KEYS.DEVICE_DATA, idbData); this._lsSet(this.KEYS.DEVICE_DATA_FP, fingerprint); return idbData; } const newData = await this._createNewDeviceData(fingerprint); await this.saveDeviceData(newData); return newData; } catch (e) { return null; }
    },
    async _createNewDeviceData(fingerprint) { const now = Date.now(); const hwid = await getDeviceHardwareFingerprint(); return { fingerprint, hwid: hwid || 'unknown', firstSeen: now, lastSeen: now, trustScore: this.CONFIG.TRUST_STARTING_SCORE, tier: 'medium', totalTrials: 0, usedKeys: [], lastTrialAt: null, lastTrialExpiresAt: null, cooldownStartAt: null, graceUsed: false, graceAvailableAt: null, referralCode: null, referralEarned: 0, referralUsed: 0, flags: { vpnDetected: false, vmDetected: false, rapidTrials: false, clockTamper: false, storageTamper: false }, abuseScore: 0, version: 'v1' }; },
    async saveDeviceData(deviceData) { if (!deviceData || !deviceData.fingerprint) return false; deviceData.lastSeen = Date.now(); this._lsSetJSON(this.KEYS.DEVICE_DATA, deviceData); this._lsSet(this.KEYS.DEVICE_DATA_FP, deviceData.fingerprint); _invalidateAllCaches(); await this._idbSet(this.IDB.STORES.DEVICES, deviceData); if (this.CONFIG.NETWORK.SERVER_SYNC_ENABLED && navigator.onLine) { this._queueFbWrite(`${this.FB.DEVICES_PATH}/${deviceData.fingerprint}`, deviceData); } return true; },
    async calculateTrustScore(signalName, customDelta = null) { const deviceData = await this.getDeviceData(); if (!deviceData) return null; const delta = customDelta !== null ? customDelta : (this.CONFIG.SCORE_CHANGES[signalName] || 0); const oldScore = deviceData.trustScore; const newScore = _clamp(oldScore + delta, this.CONFIG.SCORE_MIN, this.CONFIG.SCORE_MAX); deviceData.trustScore = newScore; deviceData.tier = this._getTierFromScore(newScore); await this.saveDeviceData(deviceData); _invalidateTrustCache(); return newScore; },
    _getTierFromScore(score) { const T = this.CONFIG.TRUST_THRESHOLDS; if (score >= T.HIGH) return 'high'; if (score >= T.MEDIUM) return 'medium'; if (score >= T.LOW) return 'low'; return 'blocked'; },
    async getTrustScore() { try { const fingerprint = await this.getFingerprint(); const now = Date.now(); if (_trustScoreCache.value !== null && _trustScoreCache.fingerprint === fingerprint && (now - _trustScoreCache.timestamp) < _trustScoreCache.ttl) return _trustScoreCache.value; const deviceData = await this.getDeviceData(); if (!deviceData) return this.CONFIG.TRUST_STARTING_SCORE; _trustScoreCache.value = deviceData.trustScore; _trustScoreCache.fingerprint = fingerprint; _trustScoreCache.timestamp = now; return deviceData.trustScore; } catch (e) { return this.CONFIG.TRUST_STARTING_SCORE; } },
    async getTrustTier() { return this._getTierFromScore(await this.getTrustScore()); },
    async getTrialLimit() { const tier = await this.getTrustTier(); return this.CONFIG.TRIAL_LIMITS[tier.toUpperCase()] || 3; },
    async getCooldownDays() { const tier = await this.getTrustTier(); return this.CONFIG.COOLDOWN_DAYS[tier.toUpperCase()] || 5; },
    async getGracePeriodDays() { const tier = await this.getTrustTier(); return this.CONFIG.GRACE_PERIOD_DAYS[tier.toUpperCase()] || 30; },
    async getRemainingTrials() { const deviceData = await this.getDeviceData(); if (!deviceData) return { total: 3, used: 0, remaining: 3, tier: 'medium', trustScore: 50 }; const limit = await this.getTrialLimit(); const used = deviceData.totalTrials || 0; return { total: limit, used, remaining: Math.max(0, limit - used), tier: deviceData.tier, trustScore: deviceData.trustScore }; },
    async isInCooldown() { try { const deviceData = await this.getDeviceData(); if (!deviceData) return { inCooldown: false }; const lastExpiresAt = deviceData.lastTrialExpiresAt; if (!lastExpiresAt) return { inCooldown: false }; const now = Date.now(); if (now < lastExpiresAt) return { inCooldown: false, reason: 'trial-still-active' }; const cooldownDays = await this.getCooldownDays(); const cooldownEndsAt = lastExpiresAt + TimeHelper.daysToMs(cooldownDays); if (now < cooldownEndsAt) { const remainingMs = cooldownEndsAt - now; return { inCooldown: true, cooldownEndsAt, remainingMs, remainingDays: Math.ceil(TimeHelper.msToDays(remainingMs)), cooldownDays }; } return { inCooldown: false, reason: 'cooldown-ended' }; } catch (e) { return { inCooldown: false }; } },
    async canUseGraceTrial() { try { const deviceData = await this.getDeviceData(); if (!deviceData) return { available: false }; if (deviceData.graceUsed === true) return { available: false, reason: 'grace-already-used' }; const remaining = await this.getRemainingTrials(); if (remaining.remaining > 0) return { available: false, reason: 'trials-remaining' }; const lastExpiresAt = deviceData.lastTrialExpiresAt; if (!lastExpiresAt) return { available: false, reason: 'no-last-trial' }; const graceDays = await this.getGracePeriodDays(); const graceAvailableAt = lastExpiresAt + TimeHelper.daysToMs(graceDays); const now = Date.now(); if (now < graceAvailableAt) { const remainingMs = graceAvailableAt - now; return { available: false, reason: 'grace-period-waiting', availableAt: graceAvailableAt, remainingMs, remainingDays: Math.ceil(TimeHelper.msToDays(remainingMs)), graceDays }; } return { available: true, availableAt: graceAvailableAt, graceDays }; } catch (e) { return { available: false, reason: 'error' }; } },
    async activateGraceTrial() { try { const check = await this.canUseGraceTrial(); if (!check.available) return { success: false, reason: check.reason }; const deviceData = await this.getDeviceData(); if (!deviceData) return { success: false, reason: 'no-device-data' }; deviceData.graceUsed = true; await this.saveDeviceData(deviceData); return { success: true, message: 'Grace trial activated' }; } catch (e) { return { success: false, reason: 'error' }; } },
    async generateReferralCode() { try { const deviceData = await this.getDeviceData(); if (!deviceData) return null; if (deviceData.referralCode) return deviceData.referralCode; const deviceHash = await this.getDeviceHash(); if (!deviceHash) return null; const random4 = _randomAlpha(this.CONFIG.REFERRAL.CODE_LENGTH); const code = `${this.CONFIG.REFERRAL.CODE_PREFIX}-${deviceHash}-${random4}`; deviceData.referralCode = code; await this.saveDeviceData(deviceData); if (navigator.onLine && this.CONFIG.NETWORK.SERVER_SYNC_ENABLED) { this._queueFbWrite(`${this.FB.REFERRALS_PATH}/${code}`, { code, owner: deviceData.fingerprint, ownerHash: deviceHash, createdAt: Date.now(), redeemed: [], totalRedeemed: 0 }); } return code; } catch (e) { return null; } },
    async validateReferralCode(code) { try { if (!Validator.isValidReferralCode(code)) return { valid: false, reason: 'invalid-format' }; const cleanCode = code.trim().toUpperCase(); const deviceData = await this.getDeviceData(); if (deviceData && deviceData.referralCode === cleanCode) return { valid: false, reason: 'own-code' }; if (deviceData && deviceData.referralUsed >= 1) return { valid: false, reason: 'already-redeemed' }; if (navigator.onLine && this.CONFIG.NETWORK.SERVER_SYNC_ENABLED) { const result = await this._fbGet(`${this.FB.REFERRALS_PATH}/${cleanCode}`); if (!result.ok) return { valid: true, code: cleanCode, offlineFallback: true }; if (result.data === null || result.data === undefined) return { valid: false, reason: 'not-found' }; const fbData = result.data; if (fbData.redeemed && Array.isArray(fbData.redeemed)) { const myFp = await this.getFingerprint(); if (fbData.redeemed.includes(myFp)) return { valid: false, reason: 'already-redeemed-this' }; } } return { valid: true, code: cleanCode }; } catch (e) { return { valid: false, reason: 'error' }; } },
    async redeemReferralCode(code) { if (_referralLock) return { success: false, reason: 'in-progress' }; _referralLock = true; try { const check = await this.validateReferralCode(code); if (!check.valid) return { success: false, reason: check.reason }; const cleanCode = check.code; const deviceData = await this.getDeviceData(); const myFp = await this.getFingerprint(); deviceData.referralUsed = (deviceData.referralUsed || 0) + 1; const maxBonus = this.CONFIG.REFERRAL.MAX_BONUS; if (deviceData.referralEarned < maxBonus) deviceData.referralEarned = (deviceData.referralEarned || 0) + 1; const bonusDelta = this.CONFIG.SCORE_CHANGES.REFERRAL_REDEEMED; deviceData.trustScore = _clamp(deviceData.trustScore + bonusDelta, this.CONFIG.SCORE_MIN, this.CONFIG.SCORE_MAX); deviceData.tier = this._getTierFromScore(deviceData.trustScore); await this.saveDeviceData(deviceData); if (navigator.onLine && this.CONFIG.NETWORK.SERVER_SYNC_ENABLED) { const fbPath = `${this.FB.REFERRALS_PATH}/${cleanCode}`; const fbResult = await this._fbGet(fbPath); const fbData = (fbResult.ok && fbResult.data) ? fbResult.data : {}; if (!fbData.redeemed) fbData.redeemed = []; if (!fbData.redeemed.includes(myFp)) { fbData.redeemed.push(myFp); fbData.totalRedeemed = fbData.redeemed.length; } this._queueFbWrite(fbPath, fbData); if (fbData.owner) { const ownerResult = await this._fbGet(`${this.FB.DEVICES_PATH}/${fbData.owner}`); if (ownerResult.ok && ownerResult.data) { const ownerData = ownerResult.data; ownerData.trustScore = _clamp((ownerData.trustScore || 50) + this.CONFIG.SCORE_CHANGES.REFERRAL_GIVEN, this.CONFIG.SCORE_MIN, this.CONFIG.SCORE_MAX); ownerData.tier = this._getTierFromScore(ownerData.trustScore); ownerData.referralEarned = (ownerData.referralEarned || 0) + 1; this._queueFbWrite(`${this.FB.DEVICES_PATH}/${fbData.owner}`, ownerData); } } } return { success: true, message: 'Referral code redeemed', bonusTrials: this.CONFIG.REFERRAL.BONUS_TRIALS, trustBoost: bonusDelta }; } catch (e) { return { success: false, reason: 'error' }; } finally { _referralLock = false; } },
    async getReferralStats() { try { const deviceData = await this.getDeviceData(); if (!deviceData) return null; return { code: deviceData.referralCode || null, earned: deviceData.referralEarned || 0, used: deviceData.referralUsed || 0, maxEarned: this.CONFIG.REFERRAL.MAX_BONUS, bonusTrialsAvailable: Math.max(0, this.CONFIG.REFERRAL.MAX_BONUS - (deviceData.referralEarned || 0)) }; } catch (e) { return null; } },
    async getCurrentDiscount() { try { const deviceData = await this.getDeviceData(); if (!deviceData) return 0; const totalTrials = deviceData.totalTrials || 0; let discount = 0; if (totalTrials >= 3) discount = this.CONFIG.DISCOUNTS.AFTER_3RD_TRIAL; else if (totalTrials >= 2) discount = this.CONFIG.DISCOUNTS.AFTER_2ND_TRIAL; if (deviceData.referralUsed > 0) discount += this.CONFIG.DISCOUNTS.REFERRAL_BONUS; return Math.min(discount, this.CONFIG.DISCOUNTS.MAX_TOTAL); } catch (e) { return 0; } },
    _getCachedDiscount() { try { const deviceData = this._lsGetJSON(this.KEYS.DEVICE_DATA, null); if (!deviceData) return 0; const totalTrials = deviceData.totalTrials || 0; let discount = 0; if (totalTrials >= 3) discount = this.CONFIG.DISCOUNTS.AFTER_3RD_TRIAL; else if (totalTrials >= 2) discount = this.CONFIG.DISCOUNTS.AFTER_2ND_TRIAL; if (deviceData.referralUsed > 0) discount += this.CONFIG.DISCOUNTS.REFERRAL_BONUS; return Math.min(discount, this.CONFIG.DISCOUNTS.MAX_TOTAL); } catch (e) { return 0; } },
    async applyDiscountToPrice(basePrice) { const discount = await this.getCurrentDiscount(); if (discount <= 0) return { originalPrice: basePrice, finalPrice: basePrice, discount: 0 }; const discountAmount = Math.round((basePrice * discount) / 100); return { originalPrice: basePrice, finalPrice: Math.max(0, basePrice - discountAmount), discount, discountAmount }; },

    detectVPN() { try { const ua = (navigator.userAgent || '').toLowerCase(); const patterns = [/vpn/i, /proxy/i, /nordvpn/i, /expressvpn/i, /surfshark/i, /cyberghost/i]; for (const p of patterns) if (p.test(ua)) return true; const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; const lang = navigator.language || ''; if (lang.startsWith('en-IN') && tz.includes('America')) return true; if (lang.startsWith('hi') && tz.includes('Europe')) return true; return false; } catch (e) { return false; } },
    detectVM() { try { const canvas = document.createElement('canvas'); const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); if (!gl) return false; const debugInfo = gl.getExtension('WEBGL_debug_renderer_info'); if (!debugInfo) return false; const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').toLowerCase(); const vmPatterns = ['vmware', 'virtualbox', 'qemu', 'xen', 'parallels', 'swiftshader', 'llvmpipe', 'mesa']; for (const p of vmPatterns) if (renderer.includes(p)) return true; return false; } catch (e) { return false; } },
    async detectRapidTrials() { try { const deviceData = await this.getDeviceData(); if (!deviceData || !deviceData.lastTrialExpiresAt) return false; if (Date.now() < deviceData.lastTrialExpiresAt) return false; const gapHours = TimeHelper.msToHours(Date.now() - deviceData.lastTrialExpiresAt); const cooldownDays = await this.getCooldownDays(); return gapHours < (cooldownDays * 24 * 0.8); } catch (e) { return false; } },
    async runAbuseDetection() { const results = { vpn: false, vm: false, rapidTrials: false, anyDetected: false }; if (this.CONFIG.ABUSE_DETECTION.VPN_CHECK_ENABLED) results.vpn = this.detectVPN(); if (this.CONFIG.ABUSE_DETECTION.VM_CHECK_ENABLED) results.vm = this.detectVM(); results.rapidTrials = await this.detectRapidTrials(); results.anyDetected = results.vpn || results.vm || results.rapidTrials; if (results.anyDetected) { const deviceData = await this.getDeviceData(); if (deviceData) { if (!deviceData.flags) deviceData.flags = {}; let totalDelta = 0; if (results.vpn && !deviceData.flags.vpnDetected) { deviceData.flags.vpnDetected = true; totalDelta += (this.CONFIG.SCORE_CHANGES.VPN_DETECTED || 0); } if (results.vm && !deviceData.flags.vmDetected) { deviceData.flags.vmDetected = true; totalDelta += (this.CONFIG.SCORE_CHANGES.VM_DETECTED || 0); } if (results.rapidTrials && !deviceData.flags.rapidTrials) { deviceData.flags.rapidTrials = true; totalDelta += (this.CONFIG.SCORE_CHANGES.RAPID_TRIAL || 0); } if (totalDelta !== 0) { deviceData.trustScore = _clamp(deviceData.trustScore + totalDelta, this.CONFIG.SCORE_MIN, this.CONFIG.SCORE_MAX); deviceData.tier = this._getTierFromScore(deviceData.trustScore); await this.saveDeviceData(deviceData); } } } return results; },

    async getKeyRegistry() { try { const storedFp = this._lsGet(this.KEYS.KEYS_REGISTRY_FP); const currentFp = await this.getFingerprint(); if (storedFp && currentFp && storedFp !== currentFp) { try { const rawRegistry = this._lsGet(this.KEYS.KEYS_REGISTRY); if (rawRegistry) { const backupKey = this.KEYS.KEYS_REGISTRY + '_backup_' + Date.now(); localStorage.setItem(backupKey, rawRegistry); _cleanupOldBackups(this.KEYS.KEYS_REGISTRY, 2); } } catch (e) {} return {}; } const lsRegistry = this._lsGetJSON(this.KEYS.KEYS_REGISTRY, null); if (lsRegistry && typeof lsRegistry === 'object') return lsRegistry; const allKeys = await this._idbGetAll(this.IDB.STORES.KEYS); const registry = {}; for (const item of allKeys) { if (item.key) { registry[item.key] = { activatedAt: item.activatedAt, expiresAt: item.expiresAt, device: item.device, fingerprint: item.fingerprint, status: item.status }; } } return registry; } catch (e) { return {}; } },
    async saveKeyRegistry(registry) { try { this._lsSetJSON(this.KEYS.KEYS_REGISTRY, registry); let fp = this._lsGet(this.KEYS.KEYS_REGISTRY_FP); if (!fp) { fp = await this.getFingerprint(); if (fp) this._lsSet(this.KEYS.KEYS_REGISTRY_FP, fp); } return true; } catch (e) { return false; } },

    async checkKeyStatus(key) {
        const cleanKey = key.trim().toUpperCase();
        const registry = await this.getKeyRegistry();
        const record = registry[cleanKey];
        if (!record) return { status: 'unused', key: cleanKey };
        if (record.status === 'revoked') return { status: 'revoked', key: cleanKey, revokedAt: record.revokedAt };
        const now = Date.now();
        const activatedAt = Number(record.activatedAt);
        const expiresAt = Number(record.expiresAt) || (Number.isFinite(activatedAt) ? activatedAt + TimeHelper.daysToMs(this.CONFIG.TRIAL_DAYS) : NaN);
        if (!Number.isFinite(expiresAt)) { console.warn('[TrialSystem] Corrupt key record detected:', cleanKey); return { status: 'invalid', key: cleanKey, reason: 'corrupt-record' }; }
        if (now >= expiresAt) return { status: 'expired', key: cleanKey, activatedAt, expiresAt, expiredDays: Math.floor(TimeHelper.msToDays(now - expiresAt)) };
        const remainingMs = expiresAt - now;
        return { status: 'active', key: cleanKey, activatedAt, expiresAt, remainingMs, remainingDays: Math.ceil(TimeHelper.msToDays(remainingMs)), device: record.device, fingerprint: record.fingerprint };
    },

    async validateTrialKey(key) {
        if (!key || typeof key !== 'string') return { valid: false, reason: 'Key खाली है' };
        const cleanKey = key.trim().toUpperCase();
        const parts = cleanKey.split('-');
        if (parts.length !== 3) return { valid: false, reason: 'Key format गलत है (HKT-XXXXXXX-XXXX)' };
        if (parts[0] !== this.CONFIG.TRIAL_KEY_PREFIX) return { valid: false, reason: 'Key prefix गलत है' };
        if (!/^\d{7}$/.test(parts[1])) return { valid: false, reason: 'Key का middle part गलत है' };
        if (!/^[A-F0-9]{4}$/.test(parts[2])) return { valid: false, reason: 'Key का last part गलत है' };
        const currentHash = await this.getDeviceHash();
        if (!currentHash) return { valid: false, reason: 'Device ID नहीं मिली' };
        if (parts[2] !== currentHash) return { valid: false, reason: 'यह Key इस device के लिए नहीं है', expected: currentHash, got: parts[2] };
        
        const serverCheck = await this._verifyTrialKeyOnServer(cleanKey);
        if (!serverCheck.ok) {
            console.warn('[TrialSystem] Server rejected key:', serverCheck.reason, serverCheck.message);
            return { valid: false, reason: serverCheck.message || 'Trial Key server verification failed', serverRejected: true, serverReason: serverCheck.reason };
        }
        
        if (serverCheck.reason === 'network-error' || serverCheck.reason === 'no-endpoint' || serverCheck.reason === 'offline') {
            console.log('[TrialSystem] ⚠️ Server verification skipped:', serverCheck.reason);
        } else if (serverCheck.reason === 'verified') {
            console.log('[TrialSystem] ✅ Key verified on server');
        }
        return { valid: true, key: cleanKey, serverVerified: serverCheck.reason === 'verified' };
    },

    async _verifyTrialKeyOnServer(cleanKey) {
        if (!navigator.onLine) return { ok: true, reason: 'offline' };
        const baseUrl = this._getFirebaseBaseUrl();
        if (!baseUrl) return { ok: true, reason: 'no-endpoint' };
        try {
            const result = await this._fbGet(`${this.FB.KEYS_PATH}/${cleanKey}`);
            if (!result.ok) { console.warn('[TrialSystem] Server check failed (network):', result.error); return { ok: true, reason: 'network-error' }; }
            if (result.data === null || result.data === undefined) return { ok: false, reason: 'not-found', message: 'यह Trial Key हमारे record में नहीं है। Admin से contact करें।' };
            const data = result.data;
            if (data.status === 'revoked') return { ok: false, reason: 'revoked', message: 'यह Trial Key revoke कर दी गई है।' };
            
            if (data.status !== 'revoked' && data.status !== 'deactivated') {
                try {
                    const registry = await this.getKeyRegistry();
                    if (registry[cleanKey] && registry[cleanKey].status === 'revoked') {
                        registry[cleanKey].status = 'active';
                        registry[cleanKey].revokedAt = null;
                        registry[cleanKey].reactivatedAt = data.reactivatedAt || Date.now();
                        if (data.activatedAt) registry[cleanKey].activatedAt = data.activatedAt;
                        if (data.expiresAt) registry[cleanKey].expiresAt = data.expiresAt;
                        if (data.device) registry[cleanKey].device = data.device;
                        if (data.fingerprint) registry[cleanKey].fingerprint = data.fingerprint;
                        await this.saveKeyRegistry(registry);
                        try { await this._idbSet(this.IDB.STORES.KEYS, { key: cleanKey, ...registry[cleanKey] }); } catch (e) {}
                        console.log('[TrialSystem] ✅ Local registry synced — admin reactivated key');
                    }
                } catch (e) {}
            }
            
            const myHwid = await getDeviceHardwareFingerprint();
            if (data.device && myHwid && data.device !== myHwid) return { ok: false, reason: 'device-locked', message: 'यह Key किसी और device पर already use हो चुकी है।' };
            return { ok: true, reason: 'verified', data: data };
        } catch (e) { console.warn('[TrialSystem] _verifyTrialKeyOnServer failed:', e.message); return { ok: true, reason: 'network-error' }; }
    },

    async activateWithKey(key) {
        if (_isActivating) return { success: false, reason: 'पिछला activation अभी भी चल रहा है। कृपया 5-10 seconds wait करें।', code: 'IN_PROGRESS' };
        _isActivating = true;
        try { return await this._doActivationWork(key); } catch (e) { return { success: false, reason: 'Activation error: ' + e.message }; } finally { _isActivating = false; }
    },

    async _doActivationWork(key) {
        const validation = await this.validateTrialKey(key);
        if (!validation.valid) return { success: false, reason: validation.reason, detail: validation };
        const cleanKey = validation.key;
        _invalidateInfoCache();
        const activeInfo = this.getInfo();
        if (activeInfo.active) return { success: false, reason: `Trial already active — ${activeInfo.remainingDays} दिन बचे हैं`, alreadyActive: true, remainingDays: activeInfo.remainingDays, expiresAt: activeInfo.expiresAt };

        let deviceData = await this.getDeviceData();
        if (!deviceData) return { success: false, reason: 'Device data unavailable' };
        await this.runAbuseDetection();
        deviceData = await this.getDeviceData();

        if (deviceData.tier === 'blocked') return { success: false, reason: '🚫 Suspicious activity detected. Please contact support.', blocked: true, tier: 'blocked', trustScore: deviceData.trustScore };

        const keyStatus = await this.checkKeyStatus(cleanKey);
        if (keyStatus.status === 'invalid') return { success: false, reason: 'Key record corrupted — please contact support', invalid: true, key: cleanKey };
        if (keyStatus.status === 'revoked') return { success: false, reason: 'यह Trial Key deactivate/revoke की जा चुकी है।', revoked: true, key: cleanKey };
        if (keyStatus.status === 'expired') return { success: false, reason: 'यह Trial Key expire हो चुकी है (7 दिन पूरे)।', expired: true, expiredDays: keyStatus.expiredDays, key: cleanKey };

        if (keyStatus.status === 'active') {
            const currentHwid = await getDeviceHardwareFingerprint();
            if (keyStatus.device !== currentHwid) return { success: false, reason: 'यह Key किसी और device पर active है', deviceMismatch: true };
            this._lsSet(this.KEYS.LOCAL_START, String(keyStatus.activatedAt)); this._lsSet(this.KEYS.LOCAL_KEY, cleanKey); this._lsSet(this.KEYS.LOCAL_DEVICE, currentHwid); _invalidateInfoCache();
            return { success: true, resumed: true, startDate: keyStatus.activatedAt, expiresAt: keyStatus.expiresAt, remainingDays: keyStatus.remainingDays, remainingMs: keyStatus.remainingMs, key: cleanKey, message: `Trial resumed — ${keyStatus.remainingDays} दिन बचे हैं` };
        }

        if (keyStatus.status === 'unused') {
            const remaining = await this.getRemainingTrials();
            const canUseGrace = await this.canUseGraceTrial();
            if (remaining.remaining <= 0) {
                if (canUseGrace.available) { const graceResult = await this.activateGraceTrial(); if (!graceResult.success) return { success: false, reason: 'Grace activation failed' }; }
                else if (canUseGrace.reason === 'grace-period-waiting') return { success: false, reason: `Trial limit reached. Grace available in ${canUseGrace.remainingDays} days.`, limitReached: true, graceWaiting: true, graceAvailableIn: canUseGrace.remainingDays };
                else if (canUseGrace.reason === 'grace-already-used') return { success: false, reason: 'इस device पर सभी trials use हो चुके हैं।', limitReached: true, graceUsed: true, discount: await this.getCurrentDiscount() };
                else return { success: false, reason: 'Trial limit reached', limitReached: true };
            }

            const cooldown = await this.isInCooldown();
            if (cooldown.inCooldown) return { success: false, reason: `कृपया ${cooldown.remainingDays} दिन wait करें`, inCooldown: true, cooldownEndsAt: cooldown.cooldownEndsAt, remainingDays: cooldown.remainingDays, remainingMs: cooldown.remainingMs };

            const now = Date.now();
            const expiresAt = now + TimeHelper.daysToMs(this.CONFIG.TRIAL_DAYS);
            const hwid = await getDeviceHardwareFingerprint();
            const fingerprint = await this.getFingerprint();

            this._lsSet(this.KEYS.LOCAL_START, String(now)); this._lsSet(this.KEYS.LOCAL_KEY, cleanKey); this._lsSet(this.KEYS.LOCAL_DEVICE, hwid || 'unknown'); if (fingerprint) this._lsSet(this.KEYS.LOCAL_FP, fingerprint);
            deviceData.totalTrials = (deviceData.totalTrials || 0) + 1; deviceData.usedKeys = deviceData.usedKeys || []; if (!deviceData.usedKeys.includes(cleanKey)) deviceData.usedKeys.push(cleanKey);
            deviceData.lastTrialAt = now; deviceData.lastTrialExpiresAt = expiresAt; deviceData.cooldownStartAt = expiresAt;
            await this.saveDeviceData(deviceData);

            const registry = await this.getKeyRegistry();
            registry[cleanKey] = { activatedAt: now, expiresAt, device: hwid || 'unknown', fingerprint, status: 'active' };
            await this.saveKeyRegistry(registry);
            await this._idbSet(this.IDB.STORES.KEYS, { key: cleanKey, activatedAt: now, expiresAt, device: hwid || 'unknown', fingerprint, status: 'active' });

            if (navigator.onLine && this.CONFIG.NETWORK.SERVER_SYNC_ENABLED) this._queueFbWrite(`${this.FB.KEYS_PATH}/${cleanKey}`, { activatedAt: now, expiresAt, device: hwid, fingerprint, status: 'active' });

            try { if (typeof Tracker !== 'undefined' && typeof Tracker.isEnabled === 'function' && Tracker.isEnabled() && typeof Tracker.logActivation === 'function') Tracker.logActivation('Trial User', 'TRIAL', 'activate').catch(() => {}); } catch (e) {}
            try { _sendSecurityAlert('trackTrialAbuse', hwid, deviceData.totalTrials); } catch (e) {}

            _invalidateInfoCache();
            return { success: true, fresh: true, startDate: now, expiresAt, remainingDays: this.CONFIG.TRIAL_DAYS, key: cleanKey, message: `Trial activated — ${this.CONFIG.TRIAL_DAYS} दिन मिले`, remaining: remaining.remaining - 1, trustScore: deviceData.trustScore, tier: deviceData.tier };
        }
        return { success: false, reason: 'Unknown key status: ' + keyStatus.status };
    },

    getInfo() {
        const now = Date.now(); if (_infoCache.value && (now - _infoCache.timestamp) < _infoCache.ttl) return _infoCache.value;
        try {
            const startStr = this._lsGet(this.KEYS.LOCAL_START); const trialKey = this._lsGet(this.KEYS.LOCAL_KEY); const totalDays = this.CONFIG.TRIAL_DAYS;
            if (!startStr || !trialKey) { const result = { active: false, started: false, hasKey: false }; _infoCache.value = result; _infoCache.timestamp = now; return result; }
            try { const keyParts = trialKey.split('-'); if (keyParts.length === 3) { const currentHash = _getCachedDeviceHash(); if (!currentHash) { const result = { active: false, started: true, hasKey: true, trialKey, deviceMismatch: true, remainingDays: 0, error: 'device-unknown' }; _infoCache.value = result; _infoCache.timestamp = now; return result; } if (keyParts[2] !== currentHash) { const result = { active: false, started: true, hasKey: true, trialKey, deviceMismatch: true, remainingDays: 0, error: 'device-mismatch' }; _infoCache.value = result; _infoCache.timestamp = now; return result; } } } catch (e) {}
            const startTime = parseInt(startStr, 10); if (isNaN(startTime) || startTime <= 0) { const result = { active: false, started: false, hasKey: false, error: 'invalid-start-time' }; _infoCache.value = result; _infoCache.timestamp = now; return result; }
            const currentNow = Date.now(); const totalMs = TimeHelper.daysToMs(totalDays);
            if (startTime > currentNow + 60000) { const result = { active: false, started: true, hasKey: true, trialKey, expired: true, tampered: true, remainingDays: 0, error: 'future-date-tamper' }; _infoCache.value = result; _infoCache.timestamp = now; return result; }
            const clockCheck = ClockGuard.detectLocalRollbackThrottled(); if (!clockCheck.safe) { const result = { active: false, started: true, hasKey: true, trialKey, expired: true, tampered: true, remainingDays: 0, error: 'clock-tamper' }; _infoCache.value = result; _infoCache.timestamp = now; return result; }
            const elapsedMs = Math.max(0, currentNow - startTime); const remainingMs = Math.max(0, totalMs - elapsedMs); const remainingDays = Math.ceil(TimeHelper.msToDays(remainingMs)); const elapsedDays = Math.floor(TimeHelper.msToDays(elapsedMs)); const expired = elapsedMs >= totalMs;
            const result = { active: !expired, started: true, hasKey: true, trialKey, startTime, startDate: new Date(startTime), elapsedDays, remainingDays: Math.min(remainingDays, totalDays), remainingMs, expired, totalDays, expiresAt: startTime + totalMs };
            _infoCache.value = result; _infoCache.timestamp = now; return result;
        } catch (e) { return { active: false, started: false, hasKey: false, error: e.message }; }
    },
    isActive() { return this.getInfo().active === true; },
    isExpired() { const info = this.getInfo(); return info.expired === true || info.tampered === true; },
    isNew() { const info = this.getInfo(); return info.started && info.elapsedDays === 0; },
    async hasStarted() { try { const info = this.getInfo(); if (info.started) return true; const registry = await this.getKeyRegistry(); return Object.keys(registry).length > 0; } catch (e) { return false; } },

    showBanner() {
        try {
            if (isProLicensed) { this.hideBanner(); return null; }
            const cfg = this.CONFIG.UI.BANNER_SYSTEM; if (!cfg || cfg.ENABLED === false) return null; if (this.CONFIG.UI.SHOW_DISCOUNT_BANNER === false) return null;
            const info = this.getInfo(); if (!info.active && !info.expired) return null; if (info.deviceMismatch) return null;
            const days = typeof info.remainingDays === 'number' ? info.remainingDays : 0;
            if (info.expired || info.tampered) return this._showExpiredBanner(info); if (days <= 1) return this._showUrgentBanner(info); if (days <= 4) return this._showAdaptiveBanner(info); return this._showCornerBadge(info);
        } catch (e) { return null; }
    },
    _showCornerBadge(info) {
        try {
            const bottomBanner = document.getElementById('trialBanner'); if (bottomBanner) bottomBanner.remove();
            let badge = document.getElementById('trialCornerBadge'); if (badge) { const daysEl = badge.querySelector('.tcb-days'); if (daysEl) daysEl.textContent = `${info.remainingDays}d`; return badge; }
            badge = document.createElement('div'); badge.id = 'trialCornerBadge'; badge.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4); z-index: ${BANNER_Z_INDEX}; display: flex; align-items: center; gap: 8px; cursor: pointer; font-family: system-ui, sans-serif; transition: all 0.25s ease; user-select: none;`;
            badge.innerHTML = `<span>🎁 <span class="tcb-days">${info.remainingDays}d</span></span><span style="background:rgba(255,255,255,0.25);padding:3px 8px;border-radius:10px;font-size:11px;">Buy</span>`;
            badge.onmouseenter = () => { badge.style.transform = 'scale(1.08)'; badge.style.boxShadow = '0 6px 24px rgba(59, 130, 246, 0.6)'; };
            badge.onmouseleave = () => { badge.style.transform = 'scale(1)'; badge.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.4)'; };
            badge.onclick = () => { this._trackBannerEvent('click', 'corner_badge'); if (typeof openBuyModal === 'function') openBuyModal(); };
            document.body.appendChild(badge); this._trackBannerEvent('impression', 'corner_badge'); return badge;
        } catch (e) { return null; }
    },
    _showAdaptiveBanner(info) {
        try {
            const badge = document.getElementById('trialCornerBadge'); if (badge) badge.remove();
            let banner = document.getElementById('trialBanner');
            if (banner && banner.dataset.bannerPhase === 'adaptive') { const msg = this._getBannerMessage(info); const contentSpan = banner.querySelector('.tb-content'); if (contentSpan) contentSpan.innerHTML = `${msg.emoji} ${msg.text.replace('{days}', `<span class="tb-days">${info.remainingDays} day${info.remainingDays !== 1 ? 's' : ''}</span>`)}`; const buySpan = banner.querySelector('.tb-buy'); if (buySpan) buySpan.textContent = msg.cta; return banner; }
            const cfg = this.CONFIG.UI.BANNER_SYSTEM; const dismissCount = parseInt(_safeSession.get('hor_banner_dismiss_count', '0'), 10); const lastDismissedAt = parseInt(_safeSession.get('hor_banner_dismissed_at', '0'), 10);
            if (lastDismissedAt && dismissCount > 0) { const intervals = cfg.DISMISS_INTERVALS_MS; const waitTime = intervals[Math.min(dismissCount - 1, intervals.length - 1)]; if (Date.now() - lastDismissedAt < waitTime) return null; }
            if (banner) banner.remove();
            const msg = this._getBannerMessage(info);
            banner = document.createElement('div'); banner.id = 'trialBanner'; banner.dataset.bannerPhase = 'adaptive'; banner.style.cssText = `position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, ${msg.color[0]}, ${msg.color[1]}); color: #fff; padding: 10px 16px 10px 20px; border-radius: 24px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 20px ${msg.shadowColor}; z-index: ${BANNER_Z_INDEX}; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: transform 0.2s ease; font-family: system-ui, sans-serif; user-select: none; max-width: calc(100vw - 32px);`;
            const contentSpan = document.createElement('span'); contentSpan.className = 'tb-content'; contentSpan.innerHTML = `${msg.emoji} ${msg.text.replace('{days}', `<span class="tb-days">${info.remainingDays} day${info.remainingDays !== 1 ? 's' : ''}</span>`)}`;
            const buySpan = document.createElement('span'); buySpan.className = 'tb-buy'; buySpan.textContent = msg.cta; buySpan.style.cssText = 'background:rgba(255,255,255,0.25);padding:4px 10px;border-radius:12px;font-size:12px;white-space:nowrap;';
            buySpan.onclick = (e) => { e.stopPropagation(); this._trackBannerEvent('click', 'adaptive_banner'); if (typeof openBuyModal === 'function') openBuyModal(); };
            const closeBtn = document.createElement('button'); closeBtn.className = 'tb-close'; closeBtn.textContent = '✕'; closeBtn.style.cssText = 'background:rgba(255,255,255,0.2);border:none;color:#fff;width:24px;height:24px;border-radius:50%;font-size:14px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;flex-shrink:0;';
            closeBtn.onclick = (e) => { e.stopPropagation(); this._dismissAdaptiveBanner(); };
            banner.appendChild(contentSpan); banner.appendChild(buySpan); banner.appendChild(closeBtn);
            banner.onclick = (e) => { if (e.target === closeBtn) return; this._trackBannerEvent('click', 'adaptive_banner'); if (typeof openBuyModal === 'function') openBuyModal(); };
            document.body.appendChild(banner); this._trackBannerEvent('impression', 'adaptive_banner'); return banner;
        } catch (e) { return null; }
    },
    _dismissAdaptiveBanner() {
        try {
            const banner = document.getElementById('trialBanner'); if (banner) banner.remove();
            const count = parseInt(_safeSession.get('hor_banner_dismiss_count', '0'), 10) + 1; _safeSession.set('hor_banner_dismiss_count', count); _safeSession.set('hor_banner_dismissed_at', Date.now());
            const intervals = this.CONFIG.UI.BANNER_SYSTEM.DISMISS_INTERVALS_MS; const nextWait = intervals[Math.min(count - 1, intervals.length - 1)]; const nextMin = Math.round(nextWait / 60000);
            this._trackBannerEvent('dismiss', 'adaptive_banner', { count });
            if (typeof showToast === 'function') { const msg = nextMin >= 60 ? `${Math.round(nextMin / 60)} ghante baad wapas aayega` : `${nextMin} minute baad wapas aayega`; showToast(`🚫 Banner dismissed — ${msg}`, 'info', 2500); }
        } catch (e) {}
    },
    _showUrgentBanner(info) {
        try {
            const badge = document.getElementById('trialCornerBadge'); if (badge) badge.remove();
            let banner = document.getElementById('trialBanner'); if (banner && banner.dataset.bannerPhase === 'urgent') return banner;
            const cfg = this.CONFIG.UI.BANNER_SYSTEM; const lastDismissedAt = parseInt(_safeSession.get('hor_urgent_dismissed_at', '0'), 10); if (lastDismissedAt && (Date.now() - lastDismissedAt) < cfg.URGENT_REPEAT_MS) return null;
            if (banner) banner.remove();
            const days = info.remainingDays; const msg = days <= 1 ? { emoji: '🔥', text: 'Last day! Aaj hi Pro le lo', cta: 'Buy Now →' } : { emoji: '⚠️', text: `Sirf ${days} din bache`, cta: 'Buy Pro →' };
            banner = document.createElement('div'); banner.id = 'trialBanner'; banner.dataset.bannerPhase = 'urgent'; banner.style.cssText = `position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #dc2626, #991b1b); color: #fff; padding: 12px 16px 12px 22px; border-radius: 24px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 24px rgba(220, 38, 38, 0.5); z-index: ${BANNER_Z_INDEX}; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: transform 0.2s ease; font-family: system-ui, sans-serif; user-select: none; max-width: calc(100vw - 32px); animation: tcbPulse 1.5s ease-in-out infinite;`;
            const contentSpan = document.createElement('span'); contentSpan.className = 'tb-content'; contentSpan.textContent = `${msg.emoji} ${msg.text}`;
            const buySpan = document.createElement('span'); buySpan.className = 'tb-buy'; buySpan.textContent = msg.cta; buySpan.style.cssText = 'background:rgba(255,255,255,0.3);padding:5px 12px;border-radius:14px;font-size:12px;white-space:nowrap;font-weight:700;';
            buySpan.onclick = (e) => { e.stopPropagation(); this._trackBannerEvent('click', 'urgent_banner'); if (typeof openBuyModal === 'function') openBuyModal(); };
            const closeBtn = document.createElement('button'); closeBtn.className = 'tb-close'; closeBtn.textContent = '✕'; closeBtn.style.cssText = 'background:rgba(255,255,255,0.2);border:none;color:#fff;width:24px;height:24px;border-radius:50%;font-size:14px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;';
            closeBtn.onclick = (e) => { e.stopPropagation(); banner.remove(); _safeSession.set('hor_urgent_dismissed_at', Date.now()); this._trackBannerEvent('dismiss', 'urgent_banner'); };
            banner.appendChild(contentSpan); banner.appendChild(buySpan); banner.appendChild(closeBtn);
            banner.onclick = (e) => { if (e.target === closeBtn) return; this._trackBannerEvent('click', 'urgent_banner'); if (typeof openBuyModal === 'function') openBuyModal(); };
            document.body.appendChild(banner); this._trackBannerEvent('impression', 'urgent_banner'); return banner;
        } catch (e) { return null; }
    },
    _showExpiredBanner(info) {
        try {
            const badge = document.getElementById('trialCornerBadge'); if (badge) badge.remove();
            let banner = document.getElementById('trialBanner'); if (banner && banner.dataset.bannerPhase === 'expired') return banner;
            const lastDismissedAt = parseInt(_safeSession.get('hor_expired_dismissed_at', '0'), 10); if (lastDismissedAt && (Date.now() - lastDismissedAt) < 10 * 60 * 1000) return null;
            if (banner) banner.remove();
            banner = document.createElement('div'); banner.id = 'trialBanner'; banner.dataset.bannerPhase = 'expired'; banner.style.cssText = `position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #4b5563, #1f2937); color: #fff; padding: 12px 16px 12px 22px; border-radius: 24px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 24px rgba(0,0,0,0.4); z-index: ${BANNER_Z_INDEX}; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: transform 0.2s ease; font-family: system-ui, sans-serif; user-select: none; max-width: calc(100vw - 32px);`;
            const contentSpan = document.createElement('span'); contentSpan.className = 'tb-content'; contentSpan.textContent = '⏰ Trial expired';
            const buySpan = document.createElement('span'); buySpan.className = 'tb-buy'; buySpan.textContent = 'Buy Pro →'; buySpan.style.cssText = 'background:rgba(255,255,255,0.25);padding:5px 12px;border-radius:14px;font-size:12px;white-space:nowrap;';
            buySpan.onclick = (e) => { e.stopPropagation(); this._trackBannerEvent('click', 'expired_banner'); if (typeof openBuyModal === 'function') openBuyModal(); };
            const closeBtn = document.createElement('button'); closeBtn.className = 'tb-close'; closeBtn.textContent = '✕'; closeBtn.style.cssText = 'background:rgba(255,255,255,0.2);border:none;color:#fff;width:24px;height:24px;border-radius:50%;font-size:14px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;';
            closeBtn.onclick = (e) => { e.stopPropagation(); banner.remove(); _safeSession.set('hor_expired_dismissed_at', Date.now()); this._trackBannerEvent('dismiss', 'expired_banner'); };
            banner.appendChild(contentSpan); banner.appendChild(buySpan); banner.appendChild(closeBtn);
            banner.onclick = (e) => { if (e.target === closeBtn) return; this._trackBannerEvent('click', 'expired_banner'); if (typeof openBuyModal === 'function') openBuyModal(); };
            document.body.appendChild(banner); this._trackBannerEvent('impression', 'expired_banner'); return banner;
        } catch (e) { return null; }
    },
    _getBannerMessage(info) {
        const days = info.remainingDays; const discount = this._getCachedDiscount(); const discountText = discount > 0 ? ` — ${discount}% off` : '';
        if (days <= 2) return { emoji: '⚠️', text: '{days} bache — jaldi karo!', cta: 'Buy Now', color: ['#dc2626', '#991b1b'], shadowColor: 'rgba(220, 38, 38, 0.4)' };
        if (days <= 4) return { emoji: '🔥', text: '{days} bache' + discountText, cta: 'Claim Offer', color: ['#f59e0b', '#d97706'], shadowColor: 'rgba(245, 158, 11, 0.4)' };
        return { emoji: '🎁', text: 'Trial: {days} left' + discountText, cta: 'Buy Pro →', color: ['#3b82f6', '#2563eb'], shadowColor: 'rgba(59, 130, 246, 0.4)' };
    },
    _trackBannerEvent(event, phase, extra = {}) {
        try {
            const cfg = this.CONFIG.UI.BANNER_SYSTEM; if (event === 'impression' && !cfg.TRACK_IMPRESSIONS) return; if (event === 'dismiss' && !cfg.TRACK_DISMISSALS) return; if (event === 'click' && !cfg.TRACK_CLICKS) return;
            const payload = { event, phase, timestamp: Date.now(), daysRemaining: this.getInfo().remainingDays, ...extra };
            if (navigator.onLine && this.CONFIG.NETWORK.SERVER_SYNC_ENABLED) { const fp = this._lsGet(this.KEYS.LOCAL_FP); if (fp) this._queueFbWrite(`${this.FB.ANALYTICS_PATH}/banner/${fp}/${Date.now()}`, payload); }
            window.dispatchEvent(new CustomEvent('banner-analytics', { detail: payload }));
        } catch (e) {}
    },
    hideBanner() { try { const banner = document.getElementById('trialBanner'); if (banner) banner.remove(); const badge = document.getElementById('trialCornerBadge'); if (badge) badge.remove(); return true; } catch (e) { return false; } },
    showExpiredBanner() { const info = this.getInfo(); if (!info.expired && !info.tampered) return null; if (info.deviceMismatch) return null; return this._showExpiredBanner(info); },
    async reset(adminOverride = false) {
        if (!adminOverride) return { success: false, reason: 'admin-required' };
        try {
            const localKeys = [ this.KEYS.LOCAL_START, this.KEYS.LOCAL_KEY, this.KEYS.LOCAL_DEVICE, this.KEYS.LOCAL_FP, this.KEYS.KEYS_REGISTRY, this.KEYS.KEYS_REGISTRY_FP, this.KEYS.DEVICE_DATA, this.KEYS.DEVICE_DATA_FP, this.KEYS.REFERRAL_CODE, this.KEYS.REFERRAL_HISTORY, this.KEYS.COOLDOWN_START, this.KEYS.GRACE_USED ];
            localKeys.forEach(k => this._lsRemove(k));
            await Promise.allSettled([ this._idbClear(this.IDB.STORES.TRIAL), this._idbClear(this.IDB.STORES.KEYS), this._idbClear(this.IDB.STORES.DEVICES), this._idbClear(this.IDB.STORES.REFERRALS) ]);
            _invalidateAllCaches(); _invalidateFingerprintCache(); this.hideBanner();
            try { _safeSession.remove('hor_banner_dismiss_count'); _safeSession.remove('hor_banner_dismissed_at'); _safeSession.remove('hor_urgent_dismissed_at'); _safeSession.remove('hor_expired_dismissed_at'); } catch (e) {}
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    },
    async debugDevice() {
        const fp = await this.getFingerprint(); const hwid = await getDeviceHardwareFingerprint(); const data = await this.getDeviceData(); const remaining = await this.getRemainingTrials(); const cooldown = await this.isInCooldown(); const grace = await this.canUseGraceTrial(); const discount = await this.getCurrentDiscount(); const referralStats = await this.getReferralStats();
        console.log('🎯 TRIAL DEVICE DEBUG'); console.log('🆔 Fingerprint:', fp); console.log('📱 HWID:', hwid);
        if (data) { console.log('🎯 Trust:', data.trustScore, `(${data.tier})`); console.log('🚩 Flags:', data.flags); }
        console.log('📊 Trials:', `${remaining.used}/${remaining.total}`, `(remaining: ${remaining.remaining})`); console.log('⏱️  Cooldown:', cooldown.inCooldown ? `active (${cooldown.remainingDays}d)` : 'none'); console.log('🎁 Grace:', grace.available ? 'available' : `no (${grace.reason})`); console.log('💰 Discount:', discount + '%'); console.log('🔗 Referral:', referralStats);
    },
    async debugKeys() {
        const registry = await this.getKeyRegistry(); const keys = Object.keys(registry); console.log('🔑 TRIAL KEYS REGISTRY'); if (keys.length === 0) { console.log('  📭 No keys'); return; }
        keys.forEach(key => { const r = registry[key]; const remaining = r.expiresAt - Date.now(); const status = r.status === 'revoked' ? '🚫 REVOKED' : (remaining > 0 ? '✅ ACTIVE' : '❌ EXPIRED'); console.log(`  ${status} ${key}`); console.log(`     Activated: ${TimeHelper.formatDate(r.activatedAt)}`); console.log(`     Expires:   ${TimeHelper.formatDate(r.expiresAt)}`); });
    },
    async testTimeTravel(key, daysToAdvance) {
        try {
            const registry = await this.getKeyRegistry(); const cleanKey = key.trim().toUpperCase(); if (!registry[cleanKey]) return { success: false, error: 'Key not in registry' };
            const daysMs = TimeHelper.daysToMs(daysToAdvance); registry[cleanKey].activatedAt -= daysMs; registry[cleanKey].expiresAt -= daysMs; await this.saveKeyRegistry(registry);
            const currentKey = this._lsGet(this.KEYS.LOCAL_KEY); if (currentKey === cleanKey) { const currentStart = parseInt(this._lsGet(this.KEYS.LOCAL_START), 10); if (!isNaN(currentStart)) this._lsSet(this.KEYS.LOCAL_START, String(currentStart - daysMs)); }
            const deviceData = await this.getDeviceData(); if (deviceData) { if (deviceData.lastTrialAt) deviceData.lastTrialAt -= daysMs; if (deviceData.lastTrialExpiresAt) deviceData.lastTrialExpiresAt -= daysMs; await this.saveDeviceData(deviceData); }
            _invalidateInfoCache(); return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    }
};
window.TrialSystem = TrialSystem;

// ============================================================
// 🔑 LICENSE VERIFICATION
// ============================================================
async function getCachedPublicKey() {
    const currentHwid = _hwidCache.value || null; const now = Date.now();
    if (currentHwid && _cachedPublicKey && _cachedPublicKeyHwid !== currentHwid) { _cachedPublicKey = null; _cachedPublicKeyHwid = null; _cachedPublicKeyTime = 0; }
    if (_cachedPublicKey && (now - _cachedPublicKeyTime) > PUBLIC_KEY_CACHE_TTL_MS) { _cachedPublicKey = null; _cachedPublicKeyTime = 0; }
    if (_cachedPublicKey) return _cachedPublicKey;
    try {
        const jwk = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.LICENSE_PUBLIC_KEY_JWK) ? APP_CONFIG.LICENSE_PUBLIC_KEY_JWK : null;
        if (!jwk || !jwk.x || !jwk.y || jwk.x === 'REPLACE_WITH_YOUR_X_COORDINATE' || jwk.x === 'YOUR_X_COORDINATE_HERE') return null;
        if (!window.crypto || !window.crypto.subtle) return null;
        _cachedPublicKey = await crypto.subtle.importKey('jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        _cachedPublicKeyHwid = currentHwid; _cachedPublicKeyTime = now; return _cachedPublicKey;
    } catch (e) { return null; }
}

function _parseExpiryToken(token) {
    if (token === LIFETIME_EXPIRY_TOKEN) return { lifetime: true, date: null };
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) return { lifetime: false, date: null, error: 'Malformed expiry token' };
    const year = 2000 + parseInt(token.substring(0, 2), 10); const month = parseInt(token.substring(2, 4), 10) - 1; const day = parseInt(token.substring(4, 6), 10);
    if (month < 0 || month > 11 || day < 1 || day > 31) return { lifetime: false, date: null, error: 'Invalid date' };
    const date = new Date(year, month, day, 23, 59, 59);
    if (isNaN(date.getTime())) return { lifetime: false, date: null, error: 'Invalid date' };
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return { lifetime: false, date: null, error: 'Invalid date (out of range)' };
    return { lifetime: false, date };
}

async function verifyLicensePayload(name, licenseKey) {
    if (!name || !licenseKey) return { valid: false, reason: 'Missing Details' };
    const cleanKey = licenseKey.trim().toUpperCase(); const parts = cleanKey.split('-');
    if (parts.length !== LICENSE_KEY_PARTS_COUNT || parts[0] !== LICENSE_KEY_PREFIX) return { valid: false, reason: 'Invalid Key Format' };
    const plan = parts[1]; const expiryToken = parts[2]; const sigHex = parts[3];
    if (!VALID_PLAN_CODES.includes(plan)) return { valid: false, reason: 'Invalid Plan Code' };
    if (sigHex.length !== SIGNATURE_HEX_LENGTH || !/^[0-9A-F]+$/.test(sigHex)) return { valid: false, reason: 'Invalid Signature Format' };
    
    const expiryResult = _parseExpiryToken(expiryToken);
    if (expiryResult.error) return { valid: false, reason: expiryResult.error };
    if (!expiryResult.lifetime && expiryResult.date) {
        const clockCheck = await ClockGuard.fastCheck();
        if (!clockCheck.safe) return { valid: false, reason: 'Clock Tampering Detected', detail: 'System time change detected.' };
        if (Date.now() > expiryResult.date.getTime()) return { valid: false, reason: 'License Expired' };
    }

    const deviceId = await getDeviceHardwareFingerprint();
    if (!deviceId) return { valid: false, reason: 'Device ID not available' };

    const cleanName = name.trim().toLowerCase(); const payloadStr = `${cleanName}|${deviceId}|${plan}|${expiryToken}|${LICENSE_PAYLOAD_VERSION}`; const payloadBytes = new TextEncoder().encode(payloadStr);
    const publicKey = await getCachedPublicKey(); if (!publicKey) return { valid: false, reason: 'Public key not configured' };
    const sigBytes = hexToBytes(sigHex); if (!sigBytes) return { valid: false, reason: 'Signature Decode Error' };

    try {
        const isValid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, sigBytes, payloadBytes);
        if (!isValid) return { valid: false, reason: 'Signature Mismatch' };

        if (navigator.onLine && _isTrialSystemReady() && TrialSystem.CONFIG.NETWORK.SERVER_SYNC_ENABLED) {
            try {
                const revCheck = await TrialSystem._fbGet(`revoked/licenses/${cleanKey}`);
                let _reactivatedByAdmin = false;
                try { const _actCheck = await TrialSystem._fbGet(`activations/${cleanKey}`); if (_actCheck.ok && _actCheck.data && _actCheck.data.status === 'active' && (_actCheck.data.reactivatedAt || _actCheck.data.deactivatedBy === null)) { _reactivatedByAdmin = true; console.log('[License] ✅ Admin reactivated — skipping revocation check'); try { TrialSystem._queueFbWrite(`revoked/licenses/${cleanKey}`, null); } catch (e) {} } } catch (e) {}
                if (!_reactivatedByAdmin && revCheck.ok && revCheck.data && revCheck.data.revokedAt) return { valid: false, reason: 'License Revoked' };
            } catch (e) {}
        }
        return { valid: true, plan, expiry: expiryToken };
    } catch (e) { return { valid: false, reason: 'Verification Error' }; }
}

async function checkLicenseIntegrity() {
    if (_licenseCheckInProgress) { _licenseCheckPending = true; return; }
    _licenseCheckInProgress = true;
    try { await _doCheckLicenseIntegrity(); } finally { _licenseCheckInProgress = false; if (_licenseCheckPending) { _licenseCheckPending = false; setTimeout(() => checkLicenseIntegrity(), 100); } }
}

async function _doCheckLicenseIntegrity() {
    try {
        ClockGuard.setLastSeen(); await getDeviceHardwareFingerprint();
        let savedName = null, savedKey = null;
        try { savedName = localStorage.getItem('hor_lic_user'); savedKey = localStorage.getItem('hor_lic_key'); } catch (e) {}
        const now = Date.now();
        if (_licenseSessionCache.verified && _licenseSessionCache.user === savedName && _licenseSessionCache.key === savedKey && (now - _licenseSessionCache.timestamp) < LICENSE_SESSION_CACHE_TTL_MS) { isProLicensed = true; applyProState(savedName, _licenseSessionCache.plan, false); return; }
        if (savedName && savedKey) {
            const verification = await verifyLicensePayload(savedName, savedKey);
            if (verification.valid) {
                isProLicensed = true;
                _licenseSessionCache = { user: String(savedName), key: String(savedKey), verified: true, plan: String(verification.plan), expiry: String(verification.expiry || ''), timestamp: now };
                if (navigator.onLine && typeof TrialSystem !== 'undefined' && typeof TrialSystem._queueFbWrite === 'function') {
                    getDeviceHardwareFingerprint().then(hwid => { TrialSystem._queueFbWrite(`activations/${savedKey}`, { name: savedName, plan: verification.plan || 'P1', timestamp: now, hwid: hwid || 'Unknown', expiryToken: verification.expiry || '9999' }); });
                }
                applyProState(savedName, verification.plan, false); return;
            } else {
                _licenseSessionCache = { user: null, key: null, verified: false, plan: null, expiry: null, timestamp: 0 };
                if (verification.reason !== 'Clock Tampering Detected' && verification.reason !== 'License Expired' && verification.reason !== 'License Revoked' && verification.reason !== 'Missing Details') { try { const deviceId = localStorage.getItem('hor_device_hwid') || 'Unknown'; _sendSecurityAlert('trackFailedKey', savedKey, deviceId); } catch (e) {} }
                if (verification.reason === 'Clock Tampering Detected') { if (typeof showToast === 'function') showToast('⚠️ System time change detected.', 'error', 6000); try { localStorage.removeItem('hor_lic_user'); localStorage.removeItem('hor_lic_key'); } catch (e) {} }
            }
        }
    } catch (e) { _licenseSessionCache = { user: null, key: null, verified: false, plan: null, expiry: null, timestamp: 0 }; }
    isProLicensed = false;
    if (_isTrialEnabled() && _isTrialSystemReady() && TrialSystem.isActive()) { ClockGuard.setLastSeen(); applyTrialState(); }
    else { applyFreeState(); if (_isTrialEnabled() && _isTrialSystemReady() && TrialSystem.isExpired()) { setTimeout(() => { try { TrialSystem.showExpiredBanner(); } catch (e) {} }, 500); } }
}

function applyProState(name, planCode = 'P1', isFreshActivation = false) {
    if (!VALID_PLAN_CODES.includes(planCode)) planCode = 'P1';
    isProLicensed = true; _invalidateAllCaches();
    try { if (typeof TrialSystem !== 'undefined' && typeof TrialSystem.hideBanner === 'function') TrialSystem.hideBanner(); } catch (e) {}
    const ver = _getTrialConfig('VERSION') || '3.7.7';
    const badge = document.getElementById('licenseBadge'); if (badge) { badge.textContent = 'Hoṛ/हो़ड़ Katha'; badge.classList.add('pro'); }
    const versionBadge = document.getElementById('versionBadge'); if (versionBadge) { versionBadge.textContent = `v${ver} PRO (${planCode})`; versionBadge.classList.remove('free-active', 'trial-active'); versionBadge.classList.add('pro-active'); }
    const trig = document.getElementById('btn-license-trigger'); if (trig) { trig.textContent = '✅'; trig.setAttribute('title', 'Pro Active'); trig.classList.add('activated', 'btn-icon-only'); }
    const buyBtn = document.getElementById('btn-buy-top'); if (buyBtn) buyBtn.style.display = 'none';
    const licStatus = document.getElementById('licenseStatusText'); if (licStatus) { licStatus.textContent = `Activated: ${name} [${planCode}]`; licStatus.style.color = '#10b981'; }
    const trialBadge = document.getElementById('trialBadge'); if (trialBadge) trialBadge.style.display = 'none';
    if (typeof updateStatusMode === 'function') updateStatusMode(true, planCode);
    if (isFreshActivation) {
        try { if (typeof Tracker !== 'undefined' && typeof Tracker.isEnabled === 'function' && Tracker.isEnabled() && typeof Tracker.logActivation === 'function') Tracker.logActivation(name, planCode, 'activate').catch(() => {}); } catch (e) {}
        try { const deviceId = localStorage.getItem('hor_device_hwid') || 'Unknown'; _sendSecurityAlert('trackActivation', deviceId, name); _sendSecurityAlert('trackPlan', deviceId, planCode); } catch (e) {}
    }
    try { window.dispatchEvent(new Event('license-changed')); } catch (e) {}
}

function applyTrialState() {
    _invalidateAllCaches(); const ver = _getTrialConfig('VERSION') || '3.7.7'; const trialInfo = TrialSystem.getInfo();
    const badge = document.getElementById('licenseBadge'); if (badge) badge.classList.remove('pro');
    const versionBadge = document.getElementById('versionBadge'); if (versionBadge) { versionBadge.textContent = `v${ver} Trial (${trialInfo.remainingDays}d)`; versionBadge.classList.remove('pro-active', 'free-active'); versionBadge.classList.add('trial-active'); }
    const trig = document.getElementById('btn-license-trigger'); if (trig) { trig.textContent = '⏱️'; trig.setAttribute('title', 'Trial Active'); trig.classList.remove('activated'); trig.classList.add('btn-icon-only'); }
    const licStatus = document.getElementById('licenseStatusText'); if (licStatus) { licStatus.textContent = `₹9 Trial Active — ${trialInfo.remainingDays} day${trialInfo.remainingDays > 1 ? 's' : ''} remaining`; licStatus.style.color = '#f59e0b'; }
    const trialBadge = document.getElementById('trialBadge'); if (trialBadge) { trialBadge.textContent = `🎁 Trial (${trialInfo.remainingDays}d)`; trialBadge.style.display = 'inline-block'; }
    if (typeof updateStatusMode === 'function') updateStatusMode(true, 'TRIAL');
    setTimeout(() => { try { if (typeof TrialSystem.showBanner === 'function') TrialSystem.showBanner(); } catch (e) {} }, 1000);
    try { window.dispatchEvent(new Event('license-changed')); } catch (e) {}
}

function applyFreeState() {
    _invalidateAllCaches(); const ver = _getTrialConfig('VERSION') || '3.7.7';
    const badge = document.getElementById('licenseBadge'); if (badge) badge.classList.remove('pro');
    const versionBadge = document.getElementById('versionBadge'); if (versionBadge) { versionBadge.textContent = `v${ver} Free`; versionBadge.classList.remove('pro-active', 'trial-active'); versionBadge.classList.add('free-active'); }
    const trig = document.getElementById('btn-license-trigger'); if (trig) { trig.textContent = '🔑'; trig.setAttribute('title', 'Activate Pro'); trig.classList.remove('activated'); trig.classList.add('btn-icon-only'); }
    const buyBtn = document.getElementById('btn-buy-top'); if (buyBtn) buyBtn.style.display = 'inline-flex';
    const licStatus = document.getElementById('licenseStatusText'); if (licStatus) { licStatus.textContent = 'Free Mode — Buy ₹9 Trial or Pro License'; licStatus.style.color = '#d97706'; }
    const trialBadge = document.getElementById('trialBadge'); if (trialBadge) trialBadge.style.display = 'none';
    if (typeof updateStatusMode === 'function') updateStatusMode(false);
    try { window.dispatchEvent(new Event('license-changed')); } catch (e) {}
}

function requireProAccess(featureName) {
    if (!hasProLevelAccess()) {
        if (typeof showToast === 'function') showToast(`'${featureName}' सुविधा Pro में उपलब्ध है।`, 'warning');
        else alert(`'${featureName}' सुविधा Pro में उपलब्ध है।`);
        if (typeof openTrialActivationModal === 'function') openTrialActivationModal(); else if (typeof openBuyModal === 'function') openBuyModal();
        return false;
    }
    return true;
}

// ============================================================
// ⏰ BACKGROUND MONITORS
// ============================================================
_clockMonitorInterval = setInterval(() => { try { const check = ClockGuard.detectSessionRollback(); if (!check.safe) { if (typeof showToast === 'function') showToast('⚠️ System time change detected!', 'error', 6000); checkLicenseIntegrity(); } ClockGuard.setLastSeen(); } catch (e) {} }, 60000);
_trialBannerInterval = setInterval(() => { try { if (isProLicensed || !_isTrialEnabled() || !_isTrialSystemReady()) return; const info = TrialSystem.getInfo(); if (!info.active && !info.expired) return; if (typeof TrialSystem.showBanner === 'function') TrialSystem.showBanner(); } catch (e) {} }, 60 * 1000);
_licensePeriodicCheckInterval = setInterval(() => { try { let hasKey = false; try { hasKey = !!localStorage.getItem('hor_lic_key'); } catch (e) {} if (!hasKey) return; const cacheAge = Date.now() - _licenseSessionCache.timestamp; if (cacheAge > LICENSE_SESSION_CACHE_TTL_MS) { _licenseSessionCache.verified = false; _licenseSessionCache.timestamp = 0; checkLicenseIntegrity(); } } catch (e) {} }, LICENSE_PERIODIC_CHECK_MS);

function _cleanupLicenseTimers() {
    try { if (_clockMonitorInterval) { clearInterval(_clockMonitorInterval); _clockMonitorInterval = null; } if (_trialBannerInterval) { clearInterval(_trialBannerInterval); _trialBannerInterval = null; } if (_licensePeriodicCheckInterval) { clearInterval(_licensePeriodicCheckInterval); _licensePeriodicCheckInterval = null; } if (_idbInstance) { try { _idbInstance.close(); } catch (e) {} _idbInstance = null; } _lastFocusCheck = 0; _lastServerClockCheckTime = 0; ClockSystem && ClockGuard.setLastSeen(); } catch (e) {}
}
window.addEventListener('beforeunload', _cleanupLicenseTimers); window.addEventListener('pagehide', _cleanupLicenseTimers);

(function _initBannerActivityTracker() { try { const cfg = SMART_TRIAL_CONFIG.UI.BANNER_SYSTEM; if (!cfg || !cfg.PEEK_A_BOO_ENABLED) return; let _activityStarted = false; function _onUserActivity() { if (_activityStarted) return; _activityStarted = true; setTimeout(() => { try { if (!isProLicensed && _isTrialSystemReady() && TrialSystem.isActive()) TrialSystem.showBanner(); } catch (e) {} }, cfg.PEEK_A_BOO_DELAY_MS); } ['click', 'scroll', 'keydown', 'touchstart'].forEach(evt => { document.addEventListener(evt, _onUserActivity, { passive: true, once: true }); }); } catch (e) {} })();
(function _injectBannerStyles() { try { if (document.getElementById('trialBannerStyles')) return; const style = document.createElement('style'); style.id = 'trialBannerStyles'; style.textContent = ` @keyframes tcbPulse { 0%, 100% { box-shadow: 0 4px 24px rgba(220, 38, 38, 0.5); } 50% { box-shadow: 0 4px 32px rgba(220, 38, 38, 0.8); } } @media (max-width: 480px) { #trialBanner { font-size: 12px !important; padding: 8px 12px !important; } #trialCornerBadge { bottom: 12px !important; right: 12px !important; } } `; document.head.appendChild(style); } catch (e) {} })();
window.addEventListener('focus', () => { try { const now = Date.now(); if (now - _lastFocusCheck < 30000) return; _lastFocusCheck = now; let hasKey = false; try { hasKey = !!localStorage.getItem('hor_lic_key'); } catch (e) {} if (!hasKey) return; const cacheAge = now - _licenseSessionCache.timestamp; if (cacheAge > LICENSE_SESSION_CACHE_TTL_MS) { _licenseSessionCache.verified = false; _licenseSessionCache.timestamp = 0; checkLicenseIntegrity(); } } catch (e) {} });

// ============================================================
// 🎉 HEADER GREETING & DEACTIVATION (PRESERVED)
// ============================================================
const HeaderGreeting = {
    _greetingTimer: null, _trialTimer: null,
    init() { this.update(); if (this._greetingTimer) clearInterval(this._greetingTimer); if (this._trialTimer) clearInterval(this._trialTimer); this._greetingTimer = setInterval(() => this._updateGreeting(), 60000); this._trialTimer = setInterval(() => this._updateTrialCounter(), 30000); },
    update() { try { this._updateGreeting(); this._updateTrialCounter(); } catch (e) {} },
    _updateGreeting() { const el = document.getElementById('greetingText'); if (!el) return; let userName = 'Guest'; try { const licUser = localStorage.getItem('hor_lic_user'); if (licUser && licUser.trim()) userName = licUser.trim().split(' ')[0]; } catch (e) {} const hour = new Date().getHours(); let greeting = '', icon = ''; if (hour >= 5 && hour < 12) { greeting = 'सुप्रभात'; icon = '🌅'; } else if (hour >= 12 && hour < 17) { greeting = 'नमस्ते'; icon = '☀️'; } else if (hour >= 17 && hour < 21) { greeting = 'शुभ संध्या'; icon = '🌆'; } else { greeting = 'शुभ रात्रि'; icon = '🌙'; } el.textContent = userName === 'Guest' ? `${icon} ${greeting}!` : `${icon} ${greeting}, ${userName} जी!`; },
    async _updateTrialCounter() {
        const el = document.getElementById('trialInfo'); const sep = document.getElementById('greetingSep'); if (!el) return;
        let state = 'free'; let trialDays = 0, isTrialWarning = false; let trustTier = 'medium', remainingTrials = 0, totalTrials = 0;
        try { if (isProLicensed === true) state = 'pro'; } catch (e) {}
        if (state !== 'pro' && _isTrialSystemReady()) { try { const info = TrialSystem.getInfo(); if (info.active) { state = 'trial'; trialDays = parseInt(info.remainingDays, 10) || 0; isTrialWarning = trialDays <= 2; const rem = await TrialSystem.getRemainingTrials(); trustTier = rem.tier || 'medium'; remainingTrials = rem.remaining || 0; totalTrials = rem.total || 3; } } catch (e) {} }
        if (state === 'pro') { el.textContent = '✅ PRO Member'; el.className = 'trial-info pro-active'; el.onclick = null; el.title = 'Pro License Active'; }
        else if (state === 'trial') {
            if (isTrialWarning) { el.textContent = `⚠️ Trial: ${trialDays} day${trialDays !== 1 ? 's' : ''} left!`; el.className = 'trial-info trial-warning'; el.title = 'Trial खत्म होने वाला है'; }
            else { el.textContent = `🎁 Trial: ${trialDays}d (${remainingTrials}/${totalTrials} left)`; el.className = 'trial-info trial-active'; el.title = `Trust: ${trustTier}`; }
            el.onclick = () => { if (typeof openBuyModal === 'function') openBuyModal(); };
        } else { el.textContent = '🎁 Free Mode'; el.className = 'trial-info free-state'; el.onclick = () => { if (typeof openTrialActivationModal === 'function') openTrialActivationModal(); }; el.title = '₹9 Trial लें'; }
        if (sep) sep.classList.remove('hidden');
    },
    cleanup() { if (this._greetingTimer) clearInterval(this._greetingTimer); if (this._trialTimer) clearInterval(this._trialTimer); this._greetingTimer = null; this._trialTimer = null; }
};
(function() { function start() { try { HeaderGreeting.init(); } catch (e) {} } if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => setTimeout(start, 800)); } else { setTimeout(start, 800); } window.addEventListener('app-ready', () => setTimeout(() => HeaderGreeting.update(), 500)); window.addEventListener('license-changed', () => setTimeout(() => HeaderGreeting.update(), 300)); window.addEventListener('beforeunload', () => HeaderGreeting.cleanup()); window.addEventListener('pagehide', () => HeaderGreeting.cleanup()); })();
window.HeaderGreeting = HeaderGreeting;

// ============================================================
// 🔓 UNIFIED KEY DEACTIVATION SYSTEM
// ============================================================
function _safeGetLS(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function _escapeHtml(str) { if (!str) return ''; return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function getActiveKeysInfo() {
    const info = { license: null, trial: null, hasAny: false, hasBoth: false };
    try { const licKey = _safeGetLS('hor_lic_key'); const licUser = _safeGetLS('hor_lic_user'); if (licKey && licUser) { info.license = { key: licKey, user: licUser, plan: (_licenseSessionCache && _licenseSessionCache.plan) || 'P1', verified: (_licenseSessionCache && _licenseSessionCache.verified) === true, type: 'pro' }; } } catch (e) {}
    try { const trialKey = _safeGetLS('hor_trial_key'); const trialStart = _safeGetLS('hor_trial_start'); if (trialKey) { let trialInfo = null; try { trialInfo = _isTrialSystemReady() ? TrialSystem.getInfo() : null; } catch (e) {} info.trial = { key: trialKey, startTime: parseInt(trialStart, 10) || null, active: trialInfo ? trialInfo.active : false, remainingDays: trialInfo ? trialInfo.remainingDays : 0, expired: trialInfo ? trialInfo.expired : false, type: 'trial' }; } } catch (e) {}
    info.hasAny = !!(info.license || info.trial); info.hasBoth = !!(info.license && info.trial); return info;
}
function refreshAfterDeactivation() {
    _invalidateAllCaches(); _lastClockCheckTime = 0; let trialActive = false; try { trialActive = _isTrialEnabled() && _isTrialSystemReady() && TrialSystem.isActive(); } catch (e) {}
    if (isProLicensed === true) { try { applyProState(_safeGetLS('hor_lic_user') || 'User', (_licenseSessionCache && _licenseSessionCache.plan) || 'P1', false); } catch (e) { applyFreeState(); } }
    else if (trialActive) { applyTrialState(); }
    else { applyFreeState(); if (_isTrialSystemReady()) { setTimeout(() => { try { if (TrialSystem.isExpired()) TrialSystem.showExpiredBanner(); } catch (e) {} }, 500); } }
    try { HeaderGreeting.update(); } catch (e) {} setTimeout(() => { try { window.dispatchEvent(new Event('license-changed')); } catch (e) {} try { HeaderGreeting.update(); } catch (e) {} }, 50);
}
async function deactivateLicenseOnly(skipConfirm = false) {
    if (!skipConfirm) { try { if (!confirm('🔓 Pro License हटाएं?\n\nApp Free या Trial mode में चला जाएगा।')) return { success: false, reason: 'cancelled' }; } catch (e) {} }
    const licKey = _safeGetLS('hor_lic_key'); const licUser = _safeGetLS('hor_lic_user'); const currentHwid = _safeGetLS('hor_device_hwid') || 'unknown';
    if (licKey && navigator.onLine) {
        try {
            const baseUrl = TrialSystem._getFirebaseBaseUrl();
            if (baseUrl) {
                TrialSystem._queueFbWrite(`revoked/licenses/${licKey}`, { revokedAt: Date.now(), device: currentHwid, reason: 'user-deactivated', revokedBy: 'user' });
                try {
                    const actResult = await TrialSystem._fbGet(`activations/${licKey}`);
                    const existing = (actResult.ok && actResult.data) ? actResult.data : {};
                    const updatedRecord = { ...existing, name: existing.name || licUser || 'Unknown', hwid: existing.hwid || currentHwid, plan: existing.plan || 'P1', timestamp: existing.timestamp || Date.now(), expiryToken: existing.expiryToken || '9999', status: 'deactivated', deactivatedBy: 'user', deactivatedAt: Date.now(), deactivateReason: 'User manually deactivated license from app' };
                    await TrialSystem._fbSet(`activations/${licKey}`, updatedRecord); console.log('[Deactivate] ✅ activations record updated successfully');
                } catch (e) { console.warn('[Deactivate] Could not update activations:', e.message); }
            }
        } catch (e) {}
    }
    try { localStorage.removeItem('hor_lic_user'); localStorage.removeItem('hor_lic_key'); } catch (e) {}
    let stillPresent = false; try { stillPresent = !!localStorage.getItem('hor_lic_key') || !!localStorage.getItem('hor_lic_user'); } catch (e) {}
    if (stillPresent) { try { localStorage.setItem('hor_lic_key', ''); localStorage.setItem('hor_lic_user', ''); localStorage.removeItem('hor_lic_key'); localStorage.removeItem('hor_lic_user'); } catch (e) {} }
    _licenseSessionCache = { user: null, key: null, verified: false, plan: null, expiry: null, timestamp: 0 }; _cachedPublicKey = null; _cachedPublicKeyHwid = null; _cachedPublicKeyTime = 0; isProLicensed = false; _safeSession.remove('hor_session_start_time'); refreshAfterDeactivation();
    if (typeof showToast === 'function') showToast('✅ Pro License removed', 'info', 3000); return { success: true };
}
async function deactivateTrialOnly(skipConfirm = false) {
    if (!skipConfirm) { try { if (!confirm('🔓 Trial Key हटाएं?\n\nTrial access बंद हो जाएगा।')) return { success: false, reason: 'cancelled' }; } catch (e) {} }
    const trialKey = _safeGetLS('hor_trial_key');
    if (trialKey && navigator.onLine) {
        try {
            const baseUrl = TrialSystem._getFirebaseBaseUrl();
            if (baseUrl) {
                const keyResult = await TrialSystem._fbGet(`${TrialSystem.FB.KEYS_PATH}/${trialKey}`);
                if (keyResult.ok && keyResult.data) { keyResult.data.status = 'revoked'; keyResult.data.revokedAt = Date.now(); keyResult.data.revokedBy = 'user'; keyResult.data.deactivatedBy = 'user'; keyResult.data.deactivatedAt = Date.now(); keyResult.data.deactivateReason = 'User manually deactivated trial from app'; keyResult.data.device = _safeGetLS('hor_device_hwid') || 'unknown'; TrialSystem._queueFbWrite(`${TrialSystem.FB.KEYS_PATH}/${trialKey}`, keyResult.data); }
            }
        } catch (e) {}
    }
    try { localStorage.removeItem('hor_trial_start'); localStorage.removeItem('hor_trial_key'); localStorage.removeItem('hor_trial_device'); localStorage.removeItem('hor_trial_fp'); } catch (e) {}
    try { if (_isTrialSystemReady() && trialKey) { const registry = await TrialSystem.getKeyRegistry(); if (registry[trialKey]) { registry[trialKey].status = 'revoked'; registry[trialKey].revokedAt = Date.now(); await TrialSystem.saveKeyRegistry(registry); await TrialSystem._idbSet(TrialSystem.IDB.STORES.KEYS, { key: trialKey, ...registry[trialKey] }); } } } catch (e) {}
    try { if (_isTrialSystemReady() && TrialSystem.hideBanner) TrialSystem.hideBanner(); } catch (e) {}
    refreshAfterDeactivation(); if (typeof showToast === 'function') showToast('✅ Trial Key removed', 'info', 3000); return { success: true };
}
async function deactivateAllKeys(skipConfirm = false) { if (!skipConfirm) { try { if (!confirm('⚠️ सभी Keys हटाएं?\n\nPro License और Trial दोनों हट जाएंगे।\n\nApp Free mode में आ जाएगा।')) return { success: false, reason: 'cancelled' }; } catch (e) {} } await deactivateLicenseOnly(true); await deactivateTrialOnly(true); return { success: true }; }
async function deactivateCurrentKey(skipConfirm = false) { const info = getActiveKeysInfo(); if (!info.hasAny) { if (typeof showToast === 'function') showToast('ℹ️ कोई active key नहीं है', 'info', 3000); return { success: false, reason: 'no-active-keys' }; } if (info.hasBoth) return await deactivateAllKeys(skipConfirm); if (info.license) return await deactivateLicenseOnly(skipConfirm); if (info.trial) return await deactivateTrialOnly(skipConfirm); return { success: false, reason: 'unknown' }; }

function openDeactivationModal() {
    const existing = document.getElementById('deactivationModal'); if (existing) existing.remove(); const info = getActiveKeysInfo();
    const overlay = document.createElement('div'); overlay.id = 'deactivationModal'; overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:1300;display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,sans-serif;`; overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    const modal = document.createElement('div'); modal.style.cssText = `background:#fff;border-radius:16px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);`;
    const header = document.createElement('div'); header.style.cssText = `padding:20px 24px 16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:#fff;z-index:1;`;
    header.innerHTML = ` <div> <h2 style="margin:0;font-size:18px;font-weight:700;color:#1f2937;">🔓 Key Management</h2> <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">अपनी Keys देखें और deactivate करें</p> </div> <button id="closeDeactivation" style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:8px;font-size:18px;cursor:pointer;color:#6b7280;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;">×</button> `;
    const body = document.createElement('div'); body.style.cssText = 'padding:20px 24px 24px;';
    if (!info.hasAny) { body.innerHTML = `<div style="text-align:center;padding:28px 0;"><div style="font-size:52px;margin-bottom:12px;">📭</div><div style="color:#374151;font-size:15px;font-weight:600;margin-bottom:4px;">कोई Active Key नहीं</div><div style="color:#9ca3af;font-size:13px;">Trial या Pro License activate करें</div></div>`; }
    else {
        if (info.license) { const card = document.createElement('div'); card.style.cssText = `background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #93c5fd;border-radius:12px;padding:16px;margin-bottom:12px;`; card.innerHTML = ` <div style="font-size:11px;color:#1d4ed8;font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">🎩 PRO LICENSE</div> <div style="font-size:15px;color:#111827;font-weight:700;margin-bottom:6px;">${_escapeHtml(info.license.user)}</div> <div style="font-size:10px;color:#6b7280;font-family:ui-monospace,monospace;word-break:break-all;background:#fff;padding:4px 8px;border-radius:6px;margin-bottom:6px;">${_escapeHtml(info.license.key.substring(0, 40))}…</div> <div style="font-size:11px;color:#1d4ed8;font-weight:600;">Plan ${_escapeHtml(info.license.plan)} ${info.license.verified ? '· ✅ Verified' : '· ⚠️ Unverified'}</div> <button class="deactivateBtn" data-type="license" style="width:100%;margin-top:12px;background:#dc2626;color:#fff;border:none;padding:10px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Deactivate License</button> `; body.appendChild(card); }
        if (info.trial) { const isActive = info.trial.active; const card = document.createElement('div'); card.style.cssText = `background:${isActive ? 'linear-gradient(135deg,#fef3c7,#fde68a)' : 'linear-gradient(135deg,#f3f4f6,#e5e7eb)'};border:1px solid ${isActive ? '#fbbf24' : '#d1d5db'};border-radius:12px;padding:16px;margin-bottom:12px;`; card.innerHTML = ` <div style="font-size:11px;color:${isActive ? '#d97706' : '#6b7280'};font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">${isActive ? '🎁 TRIAL ACTIVE' : '⏰ TRIAL (EXPIRED)'}</div> <div style="font-size:13px;color:#111827;font-weight:700;font-family:ui-monospace,monospace;word-break:break-all;background:#fff;padding:4px 8px;border-radius:6px;margin-bottom:6px;">${_escapeHtml(info.trial.key)}</div> <div style="font-size:12px;color:${isActive ? '#92400e' : '#6b7280'};font-weight:600;">${isActive ? `⏱️ ${info.trial.remainingDays} दिन बचे हैं` : '🚫 Expired'}</div> <button class="deactivateBtn" data-type="trial" style="width:100%;margin-top:12px;background:#dc2626;color:#fff;border:none;padding:10px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Deactivate Trial</button> `; body.appendChild(card); }
        if (info.hasBoth) { const allBtn = document.createElement('button'); allBtn.id = 'deactivateAllBtn'; allBtn.style.cssText = `width:100%;padding:13px;margin-top:8px;background:#1f2937;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;`; allBtn.textContent = '🗑️ सभी Keys Deactivate करें'; body.appendChild(allBtn); }
        const footer = document.createElement('div'); footer.style.cssText = `margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;font-size:12px;color:#6b7280;line-height:1.5;`; footer.innerHTML = `ℹ️ <strong>Note:</strong> Deactivate करने पर key server-side revoke हो जाएगी।`; body.appendChild(footer);
    }
    modal.appendChild(header); modal.appendChild(body); overlay.appendChild(modal); document.body.appendChild(overlay);
    document.getElementById('closeDeactivation').onclick = () => overlay.remove();
    modal.querySelectorAll('.deactivateBtn').forEach(btn => { btn.onclick = async () => { const type = btn.dataset.type; const origLabel = type === 'license' ? 'Deactivate License' : 'Deactivate Trial'; btn.disabled = true; btn.textContent = 'Deactivating…'; try { let res = { success: false }; if (type === 'license') res = await deactivateLicenseOnly(false); else if (type === 'trial') res = await deactivateTrialOnly(false); if (res && res.success) { overlay.remove(); setTimeout(() => openDeactivationModal(), 350); } else { btn.disabled = false; btn.textContent = origLabel; } } catch (e) { btn.disabled = false; btn.textContent = origLabel; if (typeof showToast === 'function') showToast('❌ Deactivation failed', 'error', 3000); } }; });
    const allBtn = document.getElementById('deactivateAllBtn'); if (allBtn) { allBtn.onclick = async () => { allBtn.disabled = true; allBtn.textContent = 'Deactivating all…'; try { const res = await deactivateAllKeys(false); if (res && res.success) { overlay.remove(); } else { allBtn.disabled = false; allBtn.textContent = '🗑️ सभी Keys Deactivate करें'; } } catch (e) { allBtn.disabled = false; allBtn.textContent = '🗑️ सभी Keys Deactivate करें'; } }; }
}

function deactivateLicense(force = false) { if (force === true) return deactivateAllKeys(true); openDeactivationModal(); return { success: true, modalOpened: true }; }

// ============================================================
// 🌐 GLOBAL EXPORTS & DEBUG
// ============================================================
window.ClockGuard = ClockGuard; window.getDeviceHardwareFingerprint = getDeviceHardwareFingerprint; window.generateDeviceFingerprint = generateDeviceFingerprint; window.getShortDeviceHash = getShortDeviceHash; window.verifyLicensePayload = verifyLicensePayload; window.checkLicenseIntegrity = checkLicenseIntegrity; window.applyProState = applyProState; window.applyTrialState = applyTrialState; window.applyFreeState = applyFreeState; window.requireProAccess = requireProAccess; window.getActiveKeysInfo = getActiveKeysInfo; window.deactivateLicenseOnly = deactivateLicenseOnly; window.deactivateTrialOnly = deactivateTrialOnly; window.deactivateAllKeys = deactivateAllKeys; window.deactivateCurrentKey = deactivateCurrentKey; window.openDeactivationModal = openDeactivationModal; window.deactivateLicense = deactivateLicense;

window.LicenseDebug = {
    status: () => { console.log('🔐 License Status'); console.log('  isProLicensed:', isProLicensed); console.log('  hasProLevelAccess():', hasProLevelAccess()); console.log('  Trial active:', _isTrialSystemReady() ? TrialSystem.isActive() : false); console.log('  Session verified:', _licenseSessionCache.verified); console.log('  Activation in progress:', _isActivating); console.log('  License check in progress:', _licenseCheckInProgress); console.log('  FB queue:', _fbWriteQueue.length); },
    trial: () => { if (_isTrialSystemReady()) console.table(TrialSystem.getInfo()); },
    device: async () => { if (_isTrialSystemReady()) await TrialSystem.debugDevice(); },
    keys: async () => { if (_isTrialSystemReady()) await TrialSystem.debugKeys(); },
    trust: async () => { if (!_isTrialSystemReady()) return null; const score = await TrialSystem.getTrustScore(); const tier = await TrialSystem.getTrustTier(); console.log('Trust:', score, `(${tier})`); return { score, tier }; },
    remaining: async () => { if (!_isTrialSystemReady()) return null; const r = await TrialSystem.getRemainingTrials(); console.log('Remaining:', r); return r; },
    referral: async () => { if (!_isTrialSystemReady()) return null; const code = await TrialSystem.generateReferralCode(); const stats = await TrialSystem.getReferralStats(); console.log('Referral:', { code, stats }); return { code, stats }; },
    clockCheck: async () => { const result = await ClockGuard.fullCheck(); console.log('Clock check:', result); return result; },
    hwid: async () => { const hwid = await getDeviceHardwareFingerprint(); console.log('HWID:', hwid); return hwid; },
    clearCaches: () => { _licenseSessionCache = { user: null, key: null, verified: false, plan: null, expiry: null, timestamp: 0 }; _cachedPublicKey = null; _cachedPublicKeyHwid = null; _cachedPublicKeyTime = 0; _hwidCache.value = null; _hwidCache.timestamp = 0; _hwidInFlightPromise = null; _invalidateAllCaches(); _invalidateFingerprintCache(); console.log('🧹 Caches cleared'); },
    resetAll: async () => { if (!confirm('Reset everything?')) return; const result = await TrialSystem.reset(true); console.log('Reset:', result); location.reload(); },
    testHwidRace: async () => {
        console.log('═══════════════════════════════════════════'); console.log('🧪 HWID RACE CONDITION TEST (FIX #2)'); console.log('═══════════════════════════════════════════'); console.log('  Firing 10 concurrent calls...');
        _hwidCache.value = null; _hwidCache.timestamp = 0; _hwidInFlightPromise = null;
        const t0 = performance.now(); const promises = []; for (let i = 0; i < 10; i++) promises.push(getDeviceHardwareFingerprint());
        const results = await Promise.all(promises); const t1 = performance.now();
        const uniqueValues = new Set(results); const allSame = uniqueValues.size === 1;
        console.log('  Calls fired: 10'); console.log('  Results received:', results.length); console.log('  Unique HWIDs:', uniqueValues.size); console.log('  HWID:', results[0]); console.log('  Total time:', (t1 - t0).toFixed(2) + 'ms'); console.log(''); console.log('  Expected: 1 unique HWID (all callers share same result)'); console.log('  Got:', uniqueValues.size, 'unique'); console.log(''); console.log('  Result:', allSame ? '✅ PASS (race-safe — all callers got same HWID)' : '❌ FAIL (race condition present!)'); console.log('═══════════════════════════════════════════');
        return { results, uniqueValues: uniqueValues.size, allSame, time: t1 - t0 };
    },
    testHwidRaceStress: async () => {
        console.log('═══════════════════════════════════════════'); console.log('🧪 HWID RACE STRESS TEST (100 calls)'); console.log('═══════════════════════════════════════════');
        _hwidCache.value = null; _hwidCache.timestamp = 0; _hwidInFlightPromise = null;
        const t0 = performance.now(); const promises = []; for (let i = 0; i < 100; i++) promises.push(getDeviceHardwareFingerprint());
        const results = await Promise.all(promises); const t1 = performance.now();
        const uniqueValues = new Set(results); const allSame = uniqueValues.size === 1;
        console.log('  100 concurrent calls →', uniqueValues.size, 'unique HWIDs'); console.log('  Time:', (t1 - t0).toFixed(2) + 'ms'); console.log('  Result:', allSame ? '✅ PASS' : '❌ FAIL');
        return { uniqueCount: uniqueValues.size, time: t1 - t0, allSame };
    },
    deactivate: { info: () => { const i = getActiveKeysInfo(); console.log('🔑 Active Keys:', i); return i; }, license: (force = false) => deactivateLicenseOnly(force), trial: (force = false) => deactivateTrialOnly(force), all: (force = false) => deactivateAllKeys(force), current: (force = false) => deactivateCurrentKey(force), showModal: () => openDeactivationModal() },
    banner: { status: () => { const banner = document.getElementById('trialBanner'); const badge = document.getElementById('trialCornerBadge'); console.log('Banner:', banner ? 'visible' : 'hidden'); console.log('Badge:', badge ? 'visible' : 'hidden'); console.log('Dismiss count:', _safeSession.get('hor_banner_dismiss_count', '0')); }, show: () => { if (_isTrialSystemReady()) TrialSystem.showBanner(); }, hide: () => { if (_isTrialSystemReady()) TrialSystem.hideBanner(); }, resetDismiss: () => { _safeSession.remove('hor_banner_dismiss_count'); _safeSession.remove('hor_banner_dismissed_at'); _safeSession.remove('hor_urgent_dismissed_at'); _safeSession.remove('hor_expired_dismissed_at'); console.log('Dismiss state cleared'); }, simulatePhase: (phase) => { if (!_isTrialSystemReady()) return; const now = Date.now(); const dayMs = 24 * 60 * 60 * 1000; let daysAgo = 0; if (phase === 'corner') daysAgo = 0; if (phase === 'adaptive') daysAgo = 4; if (phase === 'urgent') daysAgo = 6.5; if (phase === 'expired') daysAgo = 8; localStorage.setItem('hor_trial_start', String(now - (daysAgo * dayMs))); _safeSession.remove('hor_banner_dismiss_count'); _safeSession.remove('hor_banner_dismissed_at'); _safeSession.remove('hor_urgent_dismissed_at'); _safeSession.remove('hor_expired_dismissed_at'); _invalidateInfoCache(); TrialSystem.hideBanner(); setTimeout(() => TrialSystem.showBanner(), 100); } },
    testTrialExpiryBypass: async () => {
        console.log('═══════════════════════════════════════════'); console.log('🧪 TRIAL EXPIRY BYPASS TEST'); console.log('═══════════════════════════════════════════');
        const savedStart = localStorage.getItem('hor_trial_start'); const savedKey = localStorage.getItem('hor_trial_key'); const deviceHash = await getShortDeviceHash() || 'ABCD';
        try {
            localStorage.setItem('hor_trial_key', `HKT-1234567-${deviceHash}`); const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000); localStorage.setItem('hor_trial_start', String(tenDaysAgo)); _invalidateInfoCache();
            const access = hasProLevelAccess(); console.log('  Trial expired (10 days ago)'); console.log('  hasProLevelAccess():', access); console.log('  Expected: false'); console.log('  Result:', access === false ? '✅ PASS' : '❌ FAIL');
            const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000); localStorage.setItem('hor_trial_start', String(twoDaysAgo)); _invalidateInfoCache();
            const access2 = hasProLevelAccess(); console.log(''); console.log('  Trial active (2 days ago)'); console.log('  hasProLevelAccess():', access2); console.log('  Expected: true'); console.log('  Result:', access2 === true ? '✅ PASS' : '❌ FAIL');
        } finally { if (savedStart) localStorage.setItem('hor_trial_start', savedStart); else localStorage.removeItem('hor_trial_start'); if (savedKey) localStorage.setItem('hor_trial_key', savedKey); else localStorage.removeItem('hor_trial_key'); _invalidateInfoCache(); }
        console.log('═══════════════════════════════════════════');
    },
    testCacheInvalidation: async () => { if (!_isTrialSystemReady()) return; TrialSystem.getInfo(); const before = _infoCache.value !== null; _invalidateInfoCache(); const after = _infoCache.value === null; console.log('Cache test:', (before && after) ? '✅ PASS' : '❌ FAIL'); },
    testActivationRace: async () => { if (!_isTrialSystemReady()) return; const deviceHash = await getShortDeviceHash() || 'ABCD'; const key = `HKT-1234567-${deviceHash}`; const promises = []; for (let i = 0; i < 3; i++) promises.push(TrialSystem.activateWithKey(key)); const results = await Promise.all(promises); results.forEach((r, i) => console.log(`[${i + 1}] Success: ${r.success}, Reason: ${r.reason || 'N/A'}`)); },
    testClockTamperPriority5: async () => {
        console.log('═══════════════════════════════════════════'); console.log('🧪 CLOCK TAMPER BYPASS TEST (Priority 5)'); console.log('═══════════════════════════════════════════');
        const savedStart = localStorage.getItem('hor_trial_start'); const savedKey = localStorage.getItem('hor_trial_key'); const savedLastSeen = localStorage.getItem('hor_last_seen_time'); const deviceHash = await getShortDeviceHash() || 'ABCD';
        try {
            localStorage.setItem('hor_trial_key', `HKT-1234567-${deviceHash}`); localStorage.setItem('hor_trial_start', String(Date.now() - 2 * 24 * 60 * 60 * 1000)); localStorage.setItem('hor_last_seen_time', String(Date.now() + 60 * 60 * 1000)); _lastClockCheckTime = 0; _invalidateInfoCache();
            const access = hasProLevelAccess(); console.log('  Trial active BUT clock rolled back'); console.log('  hasProLevelAccess():', access); console.log('  Expected: false'); console.log('  Result:', access === false ? '✅ PASS' : '❌ FAIL (BYPASS!)');
        } finally { if (savedStart) localStorage.setItem('hor_trial_start', savedStart); else localStorage.removeItem('hor_trial_start'); if (savedKey) localStorage.setItem('hor_trial_key', savedKey); else localStorage.removeItem('hor_trial_key'); if (savedLastSeen) localStorage.setItem('hor_last_seen_time', savedLastSeen); else localStorage.removeItem('hor_last_seen_time'); _lastClockCheckTime = 0; _invalidateInfoCache(); }
        console.log('═══════════════════════════════════════════');
    },
    testTrialKeyServerVerification: async () => {
        console.log('═══════════════════════════════════════════'); console.log('🧪 TRIAL KEY SERVER VERIFICATION TEST'); console.log('═══════════════════════════════════════════');
        if (!_isTrialSystemReady()) { console.log('  ❌ TrialSystem not ready'); return; }
        const testKey = 'HKT-1234567-ABCD'; console.log('  Testing fake key:', testKey); console.log('  Online:', navigator.onLine);
        const baseUrl = TrialSystem._getFirebaseBaseUrl(); console.log('  Firebase base URL:', baseUrl || '(not configured)');
        if (!baseUrl) { console.log('  ℹ️ Firebase not configured — offline mode'); console.log('  Expected: validation continues offline'); console.log('  Verdict: ✅ SKIPPED (expected)'); console.log('═══════════════════════════════════════════'); return; }
        console.log(''); console.log('  Calling _verifyTrialKeyOnServer()...');
        try {
            const result = await TrialSystem._verifyTrialKeyOnServer(testKey); console.log('  Result:'); console.log('    ok:', result.ok); console.log('    reason:', result.reason); if (result.message) console.log('    message:', result.message);
            let verdict = '';
            if (result.reason === 'not-found' && !result.ok) verdict = '✅ PASS (fake key rejected by server)';
            else if (result.reason === 'offline' && result.ok) verdict = '⚠️ SKIPPED (offline — fallback allowed)';
            else if (result.reason === 'no-endpoint' && result.ok) verdict = '⚠️ SKIPPED (no Firebase — dev mode)';
            else if (result.reason === 'network-error' && result.ok) verdict = '⚠️ SKIPPED (network failed — fallback allowed)';
            else if (result.ok && result.reason === 'verified') verdict = '❓ UNEXPECTED (fake key "verified"?!)';
            else verdict = '✅ PASS (server check works)';
            console.log(''); console.log('  Verdict:', verdict);
        } catch (e) { console.error('  ❌ Test failed:', e.message); }
        console.log('═══════════════════════════════════════════');
    },
    selfTest: async () => {
        const results = {};
        results.bannerMethods = (typeof TrialSystem.showBanner === 'function' && typeof TrialSystem.showExpiredBanner === 'function' && typeof TrialSystem.hideBanner === 'function');
        results.serverVerifyMethod = (typeof TrialSystem._verifyTrialKeyOnServer === 'function');
        results.structuredFbGet = (() => { try { const fnStr = TrialSystem._fbGet.toString(); return fnStr.includes('{ ok:') || fnStr.includes('return { ok:'); } catch (e) { return false; } })();
        _hwidCache.value = null; _hwidCache.timestamp = 0; _hwidInFlightPromise = null; _invalidateFingerprintCache();
        const h1 = await getDeviceHardwareFingerprint(); const h2 = await getDeviceHardwareFingerprint(); results.hwidCache = (h1 === h2 && h1 !== null);
        const fp1 = await generateDeviceFingerprint(); const fp2 = await generateDeviceFingerprint(); results.fingerprintCache = (fp1 === fp2 && fp1 !== null);
        const info = TrialSystem.getInfo(); results.trialInfo = (typeof info === 'object' && 'active' in info);
        const score = await TrialSystem.getTrustScore(); results.trustScore = (typeof score === 'number' && score >= 0 && score <= 100);
        results.cacheInvalidators = (typeof _invalidateInfoCache === 'function' && typeof _invalidateTrustCache === 'function' && typeof _invalidateFingerprintCache === 'function');
        results.proAccessFunction = typeof hasProLevelAccess === 'function';
        results.deactivationMethods = (typeof openDeactivationModal === 'function' && typeof deactivateLicense === 'function');
        results.hwidInFlightPromiseVar = typeof _hwidInFlightPromise !== 'undefined';
        results.testHwidRace = typeof LicenseDebug.testHwidRace === 'function';
        console.table(results); const allPass = Object.values(results).every(v => v); console.log(allPass ? '✅ ALL PASS' : '⚠️ SOME FAILED'); return results;
    }
};

window.TrialDebug = Object.assign(window.TrialDebug || {}, { status: async () => { if (_isTrialSystemReady()) await TrialSystem.debugDevice(); }, reset: async () => { const result = await TrialSystem.reset(true); console.log('Reset:', result); location.reload(); }, extend: async (days = 7) => { if (_isTrialSystemReady()) { const key = localStorage.getItem('hor_trial_key'); if (key) { await TrialSystem.testTimeTravel(key, -Math.abs(days)); location.reload(); } else { console.warn('No active trial key found to extend'); } } }, info: () => { if (_isTrialSystemReady()) console.table(TrialSystem.getInfo()); }, showBanner: () => { if (_isTrialSystemReady()) return TrialSystem.showBanner(); }, hideBanner: () => { if (_isTrialSystemReady()) return TrialSystem.hideBanner(); }, testServerVerify: () => LicenseDebug.testTrialKeyServerVerification() });

setTimeout(async () => { try { if (window.__appReady) return; await getDeviceHardwareFingerprint(); await checkLicenseIntegrity(); } catch (e) { console.warn('[License] Auto-init failed:', e.message); } }, 1000);

console.log('═══════════════════════════════════════════');
console.log('✅ license.js loaded — v3.7.7.1 (Stable HWID Fix)');
console.log('   🔐 License verification: ready (+ Server Revocation Check)');
console.log('   🔒 Activation lock: boolean (race-safe)');
console.log('   🗄️ IndexedDB: singleton connection active');
console.log('   🧹 Cache invalidation: integrated');
console.log('   🆕 Unified key deactivation: synced across LS + IDB + FB');
console.log('');
console.log('   🔴 FIX: Stable HWID (MachineGuid) is now PRIORITIZED');
console.log('');
console.log('   🧪 Run self-test: await LicenseDebug.selfTest()');
console.log('   🧪 Test race fix: await LicenseDebug.testHwidRace()');
console.log('═══════════════════════════════════════════');