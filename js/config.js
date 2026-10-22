// ============================================================
// 🔧 APP CONFIGURATION — v3.7.4.75
// BOSC Tech & Edu · Hoṛ Katha Suite
// ============================================================
// ✅ v3.7.4.75 — FIX #3 (BASE_URL AMBIGUITY):
//    • 🔴 FIXED: 6-priority BASE_URL resolution order
//    • NEW: window.__BASE_URL_OVERRIDE__ (explicit override)
//    • NEW: ?dev=1 query param → localhost
//    • NEW: Live HTTP/HTTPS origin auto-respected
//    • NEW: file:// in browser → smart default + warning
//    • NEW: Diagnostics object (source + reason tracking)
//    • NEW: ConfigDebug.testBaseUrl() shows full diagnostics
//    • RETAINED: v3.7.4.74 fixes (JWK validation, etc.)
// ✅ SECURITY UPDATE: Removed hardcoded UPI, WhatsApp, and Email
// ============================================================

// ============================================================
// 🧊 DEEP FREEZE HELPER
// ============================================================
function _deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Object.isFrozen(obj)) return obj;

    Object.freeze(obj);

    Object.getOwnPropertyNames(obj).forEach(function(prop) {
        const val = obj[prop];
        if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
            _deepFreeze(val);
        }
    });

    return obj;
}

// ============================================================
// 🌐 SAFE RUNTIME CONFIG LOADER
// ============================================================
const RUNTIME_CONFIG = (function loadRuntimeConfig() {
    'use strict';

    const config = {};
    let loadedSources = [];

    // Source 1: window.__RUNTIME_CONFIG__
    try {
        if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) {
            const wrc = window.__RUNTIME_CONFIG__;
            Object.keys(wrc).forEach(key => {
                if (wrc[key] !== undefined && wrc[key] !== null) {
                    config[key] = wrc[key];
                }
            });
            if (Object.keys(config).length > 0) {
                loadedSources.push('window.__RUNTIME_CONFIG__');
            }
        }
    } catch (e) {
        console.warn('⚠️ [config] window.__RUNTIME_CONFIG__ load failed:', e.message);
    }

    // Source 2: process.env
    try {
        if (typeof process !== 'undefined' && process.env) {
            const envMap = {
                'LICENSE_PUBLIC_KEY_X': 'LICENSE_PUBLIC_KEY_X',
                'LICENSE_PUBLIC_KEY_Y': 'LICENSE_PUBLIC_KEY_Y',
                'SUPPORT_WHATSAPP': 'SUPPORT_WHATSAPP',
                'SELLER_EMAIL': 'SELLER_EMAIL',
                'UPI_PRIMARY_ID': 'UPI_PRIMARY_ID',
                'UPI_NPCI_ID': 'UPI_NPCI_ID',
                'PAYEE_NAME': 'PAYEE_NAME',
                'TRACKING_ENDPOINT': 'TRACKING_ENDPOINT',
                'NAME_ENCRYPTION_SECRET': 'NAME_ENCRYPTION_SECRET',
                'BASE_URL': 'BASE_URL'    // ✅ FIX #3: support env override
            };

            let loadedFromEnv = 0;

            Object.keys(envMap).forEach(envKey => {
                const val = process.env[envKey];
                if (val && typeof val === 'string' && val.trim().length > 0) {
                    if (envKey === 'LICENSE_PUBLIC_KEY_X') {
                        config.LICENSE_PUBLIC_KEY_JWK = config.LICENSE_PUBLIC_KEY_JWK || {
                            kty: "EC",
                            crv: "P-256"
                        };
                        config.LICENSE_PUBLIC_KEY_JWK.x = val.trim();
                    } else if (envKey === 'LICENSE_PUBLIC_KEY_Y') {
                        config.LICENSE_PUBLIC_KEY_JWK = config.LICENSE_PUBLIC_KEY_JWK || {
                            kty: "EC",
                            crv: "P-256"
                        };
                        config.LICENSE_PUBLIC_KEY_JWK.y = val.trim();
                    } else {
                        config[envKey] = val.trim();
                    }
                    loadedFromEnv++;
                }
            });

            if (loadedFromEnv > 0) {
                loadedSources.push('process.env (' + loadedFromEnv + ' values)');
            }
        }
    } catch (e) {
        // Silent
    }

    config.__loadedSources = loadedSources;

    return config;
})();

// ============================================================
// 🔍 VALIDATION HELPERS
// ============================================================

function _isValidJwk(jwk) {
    if (!jwk || typeof jwk !== 'object') return false;
    if (jwk.kty !== 'EC') return false;
    if (jwk.crv !== 'P-256') return false;
    if (!jwk.x || !jwk.y) return false;
    if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') return false;

    const x = jwk.x.trim();
    const y = jwk.y.trim();

    // ✅ Keywords uppercase-normalized
    const upperX = x.toUpperCase();
    const upperY = y.toUpperCase();
    const placeholderKeywords = [
        'YOUR_', 'REPLACE', 'HERE', 'EXAMPLE', 'XXXX',
        'TODO', 'FIXME', 'PLACEHOLDER', 'CHANGE_ME', 'DUMMY',
        'SAMPLE', 'TEST_', 'FAKE', 'TEMP'
    ];

    for (let i = 0; i < placeholderKeywords.length; i++) {
        const kw = placeholderKeywords[i].toUpperCase();
        if (upperX.includes(kw)) return false;
        if (upperY.includes(kw)) return false;
    }

    if (x.length !== 43) return false;
    if (y.length !== 43) return false;

    // ✅ base64url validation (A-Z, a-z, 0-9, -, _)
    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    if (!base64urlRegex.test(x)) return false;
    if (!base64urlRegex.test(y)) return false;

    return true;
}

function _isValidUpiId(upiId) {
    if (!upiId || typeof upiId !== 'string') return false;
    const trimmed = upiId.trim();
    if (trimmed.length < 5 || trimmed.length > 100) return false;

    const upper = trimmed.toUpperCase();
    const badKeywords = [
        'YOUR_', 'HERE', 'EXAMPLE', 'PLACEHOLDER',
        'CHANGE_ME', 'TODO', 'FIXME', 'DUMMY',
        'SAMPLE', 'TEST_', 'FAKE'
    ];
    for (let i = 0; i < badKeywords.length; i++) {
        if (upper.includes(badKeywords[i])) return false;
    }

    return /^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9]{2,}$/.test(trimmed);
}

function _isValidNpciId(npciId) {
    if (!npciId || typeof npciId !== 'string') return false;
    const trimmed = npciId.trim();
    if (trimmed.length < 10 || trimmed.length > 200) return false;

    const upper = trimmed.toUpperCase();
    if (upper.includes('YOUR_') || upper.includes('HERE')) return false;

    return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.ifsc\.npci$/.test(trimmed);
}

function _isValidTrackingUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (trimmed.length < 10 || trimmed.length > 500) return false;

    if (trimmed.includes('YOUR-FIREBASE') ||
        trimmed.includes('YOUR_PROJECT') ||
        trimmed.includes('YOUR-') ||
        trimmed.includes('EXAMPLE')) {
        return false;
    }

    try {
        const u = new URL(trimmed);
        if (u.protocol !== 'https:') return false;

        const host = u.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
            return false;
        }

        return true;
    } catch (e) {
        return false;
    }
}

function _isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (trimmed.length < 5 || trimmed.length > 200) return false;

    const upper = trimmed.toUpperCase();
    if (upper.includes('YOUR_') || upper.includes('HERE')) return false;

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function _isValidWhatsApp(num) {
    if (!num || typeof num !== 'string') return false;
    const digits = String(num).replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
}

function _validateEncryptionSecret(secret) {
    if (!secret || typeof secret !== 'string') {
        return { valid: false, weak: false, reason: 'Missing' };
    }

    const trimmed = secret.trim();

    const upper = trimmed.toUpperCase();
    if (upper.includes('REPLACE_') || upper.includes('YOUR_') ||
        upper.includes('CHANGE_ME') || upper.includes('PLACEHOLDER') ||
        upper.includes('EXAMPLE') || upper.includes('TODO')) {
        return { valid: false, weak: false, reason: 'Placeholder detected' };
    }

    if (trimmed.length < 16) {
        return { valid: false, weak: false, reason: 'Too short (< 16 chars)' };
    }

    if (trimmed.length < 32) {
        return { valid: true, weak: true, reason: 'Shorter than recommended 32 chars' };
    }

    const uniqueChars = new Set(trimmed).size;
    if (uniqueChars < 10) {
        return { valid: true, weak: true, reason: 'Low variety of characters' };
    }

    return { valid: true, weak: false, reason: 'OK', length: trimmed.length };
}

// ============================================================
// 🌍 BASE URL RESOLUTION — ✅ FIX #3 COMPLETE REWRITE
// ============================================================

let _baseUrlDiagnostics = null;

function _resolveBaseUrl() {
    const diag = _resolveBaseUrlWithDiagnostics();
    _baseUrlDiagnostics = diag;
    return diag.url;
}

function _resolveBaseUrlWithDiagnostics() {
    const diag = {
        url: null,
        source: 'fallback',
        reason: 'Not yet resolved',
        protocol: '',
        hostname: '',
        port: '',
        origin: '',
        isElectron: false,
        isElectronPackaged: false,
        nodeEnv: '',
        hasOverride: false,
        isLocalhost: false,
        timestamp: Date.now()
    };

    // ─── Guard: no window ───
    if (typeof window === 'undefined') {
        diag.url = 'http://localhost:8080';
        diag.source = 'ssr-fallback';
        diag.reason = 'No window object (SSR)';
        return diag;
    }

    // ─── Collect environment signals ───
    try {
        diag.protocol = window.location.protocol || '';
        diag.hostname = window.location.hostname || '';
        diag.port = window.location.port || '';
        diag.origin = window.location.origin || '';
        diag.isLocalhost =
            diag.hostname === 'localhost' ||
            diag.hostname === '127.0.0.1' ||
            diag.hostname === '[::1]';
    } catch (e) {}

    try {
        diag.isElectron = !!(
            window.electronAPI &&
            window.electronAPI.isElectron === true
        );
        diag.isElectronPackaged = !!(
            window.electronAPI &&
            window.electronAPI.isPackaged === true
        );
    } catch (e) {}

    try {
        if (typeof process !== 'undefined' && process.env) {
            diag.nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
        }
    } catch (e) {}

    // ═══════════════════════════════════════════════════════
    // PRIORITY 1: Explicit runtime override
    // ═══════════════════════════════════════════════════════
    try {
        if (window.__BASE_URL_OVERRIDE__) {
            const override = String(window.__BASE_URL_OVERRIDE__).trim();
            if (override && /^https?:\/\//i.test(override)) {
                diag.url = override.replace(/\/+$/, '');
                diag.source = 'runtime-override';
                diag.reason = 'window.__BASE_URL_OVERRIDE__ is set';
                diag.hasOverride = true;
                return diag;
            } else {
                console.warn('⚠️ [config] __BASE_URL_OVERRIDE__ invalid (needs http/https):', override);
            }
        }
    } catch (e) {}

    // ═══════════════════════════════════════════════════════
    // PRIORITY 2: process.env.BASE_URL (Electron / build-time)
    // ═══════════════════════════════════════════════════════
    try {
        const envBase = RUNTIME_CONFIG.BASE_URL;
        if (envBase && typeof envBase === 'string') {
            const envUrl = envBase.trim();
            if (envUrl && /^https?:\/\//i.test(envUrl)) {
                diag.url = envUrl.replace(/\/+$/, '');
                diag.source = 'env';
                diag.reason = 'process.env.BASE_URL / RUNTIME_CONFIG.BASE_URL';
                return diag;
            }
        }
    } catch (e) {}

    // ═══════════════════════════════════════════════════════
    // PRIORITY 3: Explicit dev flag via query param
    // ═══════════════════════════════════════════════════════
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const devFlag = urlParams.get('dev');
        if (devFlag === '1' || devFlag === 'true') {
            diag.url = 'http://localhost:8080';
            diag.source = 'query-dev-flag';
            diag.reason = 'URL contains ?dev=1 (explicit dev mode)';
            return diag;
        }
    } catch (e) {}

    // ═══════════════════════════════════════════════════════
    // PRIORITY 4: Live HTTP/HTTPS deployment
    // ═══════════════════════════════════════════════════════
    if (diag.protocol === 'http:' || diag.protocol === 'https:') {
        if (diag.origin && diag.origin !== 'null') {
            diag.url = diag.origin;
            diag.source = 'current-origin';
            diag.reason = diag.isLocalhost
                ? 'Live localhost dev server'
                : 'Live HTTP/HTTPS deployment';
            return diag;
        }
    }

    // ═══════════════════════════════════════════════════════
    // PRIORITY 5: Electron-specific resolution
    // ═══════════════════════════════════════════════════════
    if (diag.protocol === 'file:' || !diag.hostname || diag.hostname === 'null') {

        if (diag.isElectronPackaged) {
            diag.url = 'https://hor-katha.vercel.app';
            diag.source = 'electron-packaged';
            diag.reason = 'Electron packaged app (production)';
            return diag;
        }

        if (diag.nodeEnv === 'development' || diag.nodeEnv === 'dev') {
            diag.url = 'http://localhost:8080';
            diag.source = 'electron-dev-nodeenv';
            diag.reason = 'Electron + NODE_ENV=' + diag.nodeEnv;
            return diag;
        }

        if (diag.isElectron) {
            diag.url = 'http://localhost:8080';
            diag.source = 'electron-dev';
            diag.reason = 'Electron dev mode (not packaged)';
            return diag;
        }

        if (diag.nodeEnv === 'production') {
            diag.url = 'https://hor-katha.vercel.app';
            diag.source = 'nodeenv-production';
            diag.reason = 'NODE_ENV=production';
            return diag;
        }

        diag.url = 'http://localhost:8080';
        diag.source = 'file-browser-dev-default';
        diag.reason = 'file:// in browser — assuming dev mode';

        console.warn(
            '⚠️ [config] Opened via file:// without Electron.\n' +
            '   Assuming DEV mode → http://localhost:8080\n' +
            '   \n' +
            '   For production use:\n' +
            '     1. Deploy via HTTP/HTTPS, OR\n' +
            '     2. Set window.__BASE_URL_OVERRIDE__ = "https://your-domain.com"\n' +
            '   \n' +
            '   To silence this warning, use a dev server:\n' +
            '     python -m http.server 8080\n' +
            '     npx serve .'
        );
        return diag;
    }

    // ═══════════════════════════════════════════════════════
    // PRIORITY 6: Ultimate fallback (unknown protocol)
    // ═══════════════════════════════════════════════════════
    diag.url = 'https://hor-katha.vercel.app';
    diag.source = 'ultimate-fallback';
    diag.reason = 'Unknown environment — production fallback';

    console.warn(
        '⚠️ [config] Unknown environment — using production fallback.\n' +
        '   Protocol:', diag.protocol || '(none)',
        'Hostname:', diag.hostname || '(none)'
    );

    return diag;
}

// ============================================================
// 🔧 APP_CONFIG
// ============================================================
const APP_CONFIG = (function buildAppConfig() {
    'use strict';

    const licenseJwk = (function() {
        const fromRuntime = RUNTIME_CONFIG.LICENSE_PUBLIC_KEY_JWK;

        if (_isValidJwk(fromRuntime)) {
            return {
                kty: "EC",
                crv: "P-256",
                x: String(fromRuntime.x).trim(),
                y: String(fromRuntime.y).trim()
            };
        }

        console.warn('⚠️ [config] License public key not configured or invalid!');
        console.warn('   → Set LICENSE_PUBLIC_KEY_X and LICENSE_PUBLIC_KEY_Y');

        return {
            kty: "EC",
            crv: "P-256",
            x: "YOUR_X_COORDINATE_HERE",
            y: "YOUR_Y_COORDINATE_HERE"
        };
    })();

    const supportWhatsApp = (function() {
        const fromRuntime = RUNTIME_CONFIG.SUPPORT_WHATSAPP;
        if (_isValidWhatsApp(fromRuntime)) {
            return String(fromRuntime).replace(/\D/g, '');
        }
        console.warn('⚠️ [config] SUPPORT_WHATSAPP not configured');
        return ""; // ✅ SECURITY FIX: खाली कर दिया गया
    })();

    const sellerEmail = (function() {
        const fromRuntime = RUNTIME_CONFIG.SELLER_EMAIL;
        if (_isValidEmail(fromRuntime)) {
            return String(fromRuntime).trim();
        }
        console.warn('⚠️ [config] SELLER_EMAIL not configured');
        return ""; // ✅ SECURITY FIX: खाली कर दिया गया
    })();

    const upiPrimaryId = (function() {
        const fromRuntime = RUNTIME_CONFIG.UPI_PRIMARY_ID;
        if (_isValidUpiId(fromRuntime)) {
            return String(fromRuntime).trim();
        }
        console.warn('⚠️ [config] UPI_PRIMARY_ID not configured');
        return ""; // ✅ SECURITY FIX: खाली कर दिया गया
    })();

    const upiNpciId = (function() {
        const fromRuntime = RUNTIME_CONFIG.UPI_NPCI_ID;
        if (_isValidNpciId(fromRuntime)) {
            return String(fromRuntime).trim();
        }
        return ""; // ✅ SECURITY FIX: खाली कर दिया गया
    })();

    const payeeName = (function() {
        const fromRuntime = RUNTIME_CONFIG.PAYEE_NAME;
        if (fromRuntime &&
            typeof fromRuntime === 'string' &&
            fromRuntime.trim().length >= 2 &&
            fromRuntime.trim().length <= 100) {
            const upper = fromRuntime.toUpperCase();
            if (!upper.includes('YOUR_') &&
                !upper.includes('HERE') &&
                !upper.includes('CHANGE_ME')) {
                return String(fromRuntime).trim();
            }
        }
        return "Merchant"; // ✅ SECURITY FIX: जेनेरिक नाम
    })();

    const trackingEndpoint = (function() {
        const fromRuntime = RUNTIME_CONFIG.TRACKING_ENDPOINT;
        if (_isValidTrackingUrl(fromRuntime)) {
            console.log('✅ [config] Tracking endpoint configured');
            return String(fromRuntime).trim();
        }
        return "https://hor-katha-tracker-default-rtdb.asia-southeast1.firebasedatabase.app";
    })();

    const nameEncryptionSecret = (function() {
        const fromRuntime = RUNTIME_CONFIG.NAME_ENCRYPTION_SECRET;
        const result = _validateEncryptionSecret(fromRuntime);

        if (!result.valid) {
            console.warn('⚠️ [config] NAME_ENCRYPTION_SECRET not configured');
            console.warn('   → Reason:', result.reason);
            console.warn('   → Names will NOT be encrypted in Firebase');
            return null;
        }

        if (result.weak) {
            console.warn('⚠️ [config] NAME_ENCRYPTION_SECRET is weak:', result.reason);
        } else {
            console.log('✅ [config] Encryption secret configured (' + result.length + ' chars)');
        }

        return fromRuntime;
    })();

    const baseUrl = _resolveBaseUrl();

    const formsubmitEndpoint = (function() {
        if (!_isValidEmail(sellerEmail)) {
            return ''; // ✅ SECURITY FIX: खाली कर दिया गया
        }
        return 'https://formsubmit.co/ajax/' + sellerEmail;
    })();

    const config = {
        VERSION: "3.7.4",

        LICENSE_PUBLIC_KEY_JWK: licenseJwk,
        SUPPORT_WHATSAPP: supportWhatsApp,
        SELLER_EMAIL: sellerEmail,
        UPI_PRIMARY_ID: upiPrimaryId,
        UPI_NPCI_ID: upiNpciId,
        PAYEE_NAME: payeeName,

        TRIAL_ENABLED: true,
        TRIAL_PRICE: 9,
        TRIAL_DURATION_DAYS: 7,
        TRIAL_KEY_PREFIX: 'HKT',
        TRIAL_STORAGE_KEY: 'hor_trial_start',
        TRIAL_DEVICE_KEY: 'hor_trial_device',
        TRIAL_KEY_STORAGE: 'hor_trial_key',
        TRIAL_WARNING_DAYS: [6, 7],

        PLANS: {
            P1: { name: "Community", price: 199, devices: 1 },
            P2: { name: "Commercial", price: 399, devices: 3 },
            P3: { name: "Enterprise", price: 699, devices: 5 }
        },

        TOAST_WELCOME_ENABLED: true,
        TOAST_SEQUENCE_DELAYS: [500, 1500, 2500, 3500, 4500],
        TOAST_DURATION_DEFAULT: 4000,
        TOAST_DURATION_LONG: 6000,
        AUDIO_THROTTLE_MS: 70,
        DEFAULT_THEME: 'dark',
        DEFAULT_LANGUAGE: 'english',

        TRACKING_ENDPOINT: trackingEndpoint,
        NAME_ENCRYPTION_SECRET: nameEncryptionSecret,

        PRIVACY_POLICY_URL: "privacy.html",
        CONSENT_VERSION: "1.0",

        CLOCK_MAX_ROLLBACK_MINUTES: 5,
        CLOCK_MAX_SERVER_DRIFT_MINUTES: 60,
        CLOCK_MAX_FORWARD_JUMP_DAYS: 30,

        FORMSUBMIT_ENDPOINT: formsubmitEndpoint,
        BASE_URL: baseUrl,

        LICENSE_KEY_PATTERN: "^HKP-(P[1-3])-(?:\\d{4}|\\d{6})-[A-F0-9]{128}$",
        TRIAL_KEY_PATTERN: "^HKT-\\d{7}-[A-F0-9]{4}$",
        HWID_PATTERN: "^DVC-[A-F0-9]{4}-[A-F0-9]{4}$"
    };

    return _deepFreeze(config);
})();

// ============================================================
// ✅ EXPOSE GLOBALLY
// ============================================================
if (typeof window !== 'undefined') {
    window.APP_CONFIG = APP_CONFIG;
    console.log('✅ [config] APP_CONFIG exposed globally (deep-frozen)');
}

// ============================================================
// 📝 FONTS PER LANGUAGE
// ============================================================
const languageFontsDB = _deepFreeze({
    'english': [
        { name: "1. Roboto", val: "'Roboto', sans-serif", default: true, gfont: "Roboto:wght@400;600;700" },
        { name: "2. Inter", val: "'Inter', sans-serif", gfont: "Inter:wght@400;600;700" },
        { name: "3. Poppins", val: "'Poppins', sans-serif", gfont: "Poppins:wght@400;600;700" },
        { name: "4. Montserrat", val: "'Montserrat', sans-serif", gfont: "Montserrat:wght@400;600;700" },
        { name: "5. Open Sans", val: "'Open Sans', sans-serif", gfont: "Open+Sans:wght@400;600;700" },
        { name: "6. Lato", val: "'Lato', sans-serif", gfont: "Lato:wght@400;700" },
        { name: "7. Arial", val: "Arial, sans-serif" },
        { name: "8. Times New Roman", val: "'Times New Roman', serif" }
    ],
    'roman': [
        { name: "1. Inter", val: "'Inter', sans-serif", default: true, gfont: "Inter:wght@400;600;700" },
        { name: "2. Roboto", val: "'Roboto', sans-serif", gfont: "Roboto:wght@400;600;700" },
        { name: "3. Noto Sans", val: "'Noto Sans', sans-serif", gfont: "Noto+Sans:wght@400;600;700" },
        { name: "4. Source Sans 3", val: "'Source Sans 3', sans-serif", gfont: "Source+Sans+3:wght@400;600;700" },
        { name: "5. Gentium Plus", val: "'Gentium Plus', serif", gfont: "Gentium+Plus:wght@400;700" },
        { name: "6. Charis SIL", val: "'Charis SIL', serif", gfont: "Charis+SIL:wght@400;700" },
        { name: "7. Doulos SIL", val: "'Doulos SIL', serif", gfont: "Doulos+SIL" },
        { name: "8. Times New Roman", val: "'Times New Roman', serif" }
    ],
    'hindi-dev': [
        { name: "1. Noto Sans Devanagari", val: "'Noto Sans Devanagari', sans-serif", default: true, gfont: "Noto+Sans+Devanagari:wght@400;600;700" },
        { name: "2. Noto Serif Devanagari", val: "'Noto Serif Devanagari', serif", gfont: "Noto+Serif+Devanagari:wght@400;600;700" },
        { name: "3. Mangal", val: "'Mangal', 'Noto Sans Devanagari', sans-serif" },
        { name: "4. Kruti Dev 011", val: "'Kruti Dev 011', 'DevLys 010', sans-serif" },
        { name: "5. Kalam", val: "'Kalam', cursive", gfont: "Kalam:wght@400;700" },
        { name: "6. Poppins", val: "'Poppins', sans-serif", gfont: "Poppins:wght@400;600;700" },
        { name: "7. Rozha One", val: "'Rozha One', serif", gfont: "Rozha+One" },
        { name: "8. Tiro Devanagari Hindi", val: "'Tiro Devanagari Hindi', serif", gfont: "Tiro+Devanagari+Hindi" }
    ],
    'santali-dev': [
        { name: "1. Noto Sans Devanagari", val: "'Noto Sans Devanagari', sans-serif", default: true, gfont: "Noto+Sans+Devanagari:wght@400;600;700" },
        { name: "2. Noto Serif Devanagari", val: "'Noto Serif Devanagari', serif", gfont: "Noto+Serif+Devanagari:wght@400;600;700" },
        { name: "3. Mangal", val: "'Mangal', 'Noto Sans Devanagari', sans-serif" },
        { name: "4. Kruti Dev 011", val: "'Kruti Dev 011', 'DevLys 010', sans-serif" },
        { name: "5. Tiro Devanagari Hindi", val: "'Tiro Devanagari Hindi', serif", gfont: "Tiro+Devanagari+Hindi" },
        { name: "6. Kalam", val: "'Kalam', cursive", gfont: "Kalam:wght@400;700" },
        { name: "7. Rozha One", val: "'Rozha One', serif", gfont: "Rozha+One" },
        { name: "8. Yantramanav", val: "'Yantramanav', sans-serif", gfont: "Yantramanav:wght@400;700" }
    ],
    'olchiki': [
        { name: "1. Noto Sans Ol Chiki", val: "'Noto Sans Ol Chiki', sans-serif", default: true, gfont: "Noto+Sans+Ol+Chiki:wght@400;600;700" },
        { name: "2. Noto Serif Ol Chiki", val: "'Noto Serif Ol Chiki', serif", gfont: "Noto+Serif+Ol+Chiki:wght@400;700" },
        { name: "3. Guru Gomke", val: "'Guru Gomke', 'Noto Sans Ol Chiki', sans-serif" },
        { name: "4. Ol Chiki Classic", val: "'Ol Chiki Classic', 'Noto Sans Ol Chiki', sans-serif" },
        { name: "5. Ol Chiki Digital", val: "'Ol Chiki Digital', 'Noto Sans Ol Chiki', sans-serif" },
        { name: "6. Ol Chiki Unicode", val: "'Ol Chiki Unicode', 'Noto Sans Ol Chiki', sans-serif" },
        { name: "7. Santali Ol Script", val: "'Santali Ol Script', 'Noto Sans Ol Chiki', sans-serif" }
    ]
});

if (typeof window !== 'undefined') {
    window.languageFontsDB = languageFontsDB;
    console.log('✅ [config] languageFontsDB exposed globally (deep-frozen)');
}

// ============================================================
// 📊 STARTUP LOGGING
// ============================================================
(function logConfigStatus() {
    'use strict';

    const hasLicenseKey = _isValidJwk(APP_CONFIG.LICENSE_PUBLIC_KEY_JWK);
    const hasTracking = _isValidTrackingUrl(APP_CONFIG.TRACKING_ENDPOINT);
    const hasUpi = _isValidUpiId(APP_CONFIG.UPI_PRIMARY_ID);
    const hasSecret = !!APP_CONFIG.NAME_ENCRYPTION_SECRET;
    const hasEmail = _isValidEmail(APP_CONFIG.SELLER_EMAIL);
    const hasWhatsApp = _isValidWhatsApp(APP_CONFIG.SUPPORT_WHATSAPP);

    const checks = [
        { name: 'License Key', ok: hasLicenseKey },
        { name: 'UPI ID', ok: hasUpi },
        { name: 'WhatsApp', ok: hasWhatsApp },
        { name: 'Email', ok: hasEmail },
        { name: 'Tracking', ok: hasTracking, optional: true },
        { name: 'Name Secret', ok: hasSecret }
    ];

    console.log('═══════════════════════════════════════════');
    console.log('✅ [config.js] v' + APP_CONFIG.VERSION + ' (v3.7.4.75 — FIX #3)');
    console.log('───────────────────────────────────────────');

    checks.forEach(c => {
        const icon = c.ok ? '✅' : (c.optional ? '⚠️ ' : '❌');
        const label = c.ok ? 'configured' : (c.optional ? 'optional/missing' : 'NOT CONFIGURED');
        console.log(`  ${icon} ${c.name.padEnd(15)} ${label}`);
    });

    console.log('───────────────────────────────────────────');

    const criticalMissing = checks.filter(c => !c.ok && !c.optional);

    if (criticalMissing.length > 0) {
        console.warn('');
        console.warn('⚠️  CRITICAL CONFIG MISSING:');
        criticalMissing.forEach(c => {
            console.warn(`    • ${c.name}`);
        });
        console.warn('');
        console.warn('📝 TO FIX:');
        console.warn('   1. Create js/config-private.js with real values');
        console.warn('   2. Or set environment variables (.env file)');
        console.warn('   3. Or set window.__RUNTIME_CONFIG__ in preload.js');
        console.warn('');
    } else {
        console.log('  🎉 All critical config loaded!');
    }

    if (RUNTIME_CONFIG.__loadedSources && RUNTIME_CONFIG.__loadedSources.length > 0) {
        console.log('  📥 Sources:', RUNTIME_CONFIG.__loadedSources.join(', '));
    } else {
        console.log('  📥 Sources: none (using defaults)');
    }

    const bd = _baseUrlDiagnostics;
    if (bd) {
        console.log('  🌐 BASE_URL:', bd.url);
        console.log('  📍 Source:', bd.source);
        console.log('  💡 Reason:', bd.reason);
        if (bd.hasOverride) {
            console.log('  🔧 Override ACTIVE');
        }
    } else {
        console.log('  🌐 BASE_URL:', APP_CONFIG.BASE_URL);
    }

    console.log('  📧 FormSubmit:', APP_CONFIG.FORMSUBMIT_ENDPOINT || '(not set)');
    console.log('═══════════════════════════════════════════');
})();

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
if (typeof window !== 'undefined') {
    window.ConfigDebug = {
        audit: function() {
            console.log('═══════════════════════════════════════════');
            console.log('🔍 CONFIG AUDIT');
            console.log('═══════════════════════════════════════════');

            const licenseOk = _isValidJwk(APP_CONFIG.LICENSE_PUBLIC_KEY_JWK);
            console.log('');
            console.log('🔐 LICENSE:');
            console.log('  Status:', licenseOk ? '✅ Configured' : '❌ NOT configured');
            if (licenseOk) {
                console.log('  x:', APP_CONFIG.LICENSE_PUBLIC_KEY_JWK.x.substring(0, 12) + '...');
                console.log('  y:', APP_CONFIG.LICENSE_PUBLIC_KEY_JWK.y.substring(0, 12) + '...');
            }

            console.log('');
            console.log('📞 CONTACT:');
            console.log('  WhatsApp:', APP_CONFIG.SUPPORT_WHATSAPP || '(not set)');
            console.log('  Email:', APP_CONFIG.SELLER_EMAIL || '(not set)');

            console.log('');
            console.log('💰 PAYMENT:');
            console.log('  UPI Primary:', APP_CONFIG.UPI_PRIMARY_ID || '(not set)');
            console.log('  UPI NPCI:', APP_CONFIG.UPI_NPCI_ID || '(not set)');
            console.log('  Payee:', APP_CONFIG.PAYEE_NAME || '(not set)');

            console.log('');
            console.log('🎁 TRIAL:');
            console.log('  Enabled:', APP_CONFIG.TRIAL_ENABLED);
            console.log('  Price: ₹' + APP_CONFIG.TRIAL_PRICE);
            console.log('  Duration:', APP_CONFIG.TRIAL_DURATION_DAYS, 'days');

            console.log('');
            console.log('💳 PLANS:');
            Object.keys(APP_CONFIG.PLANS).forEach(code => {
                const plan = APP_CONFIG.PLANS[code];
                console.log(`  ${code}: ₹${plan.price} / ${plan.devices} devices (${plan.name})`);
            });

            console.log('');
            console.log('📊 TRACKING:');
            console.log('  Endpoint:', _isValidTrackingUrl(APP_CONFIG.TRACKING_ENDPOINT) ? '✅ configured' : '❌ not configured');

            console.log('');
            console.log('🔐 ENCRYPTION:');
            console.log('  Secret:', APP_CONFIG.NAME_ENCRYPTION_SECRET ? '✅ loaded (' + APP_CONFIG.NAME_ENCRYPTION_SECRET.length + ' chars)' : '❌ not set');

            console.log('');
            console.log('🌐 DEPLOYMENT:');
            console.log('  BASE_URL:', APP_CONFIG.BASE_URL);
            if (_baseUrlDiagnostics) {
                console.log('    Source:', _baseUrlDiagnostics.source);
                console.log('    Reason:', _baseUrlDiagnostics.reason);
            }
            console.log('  Formsubmit:', APP_CONFIG.FORMSUBMIT_ENDPOINT || '(not set)');

            console.log('');
            console.log('🔤 FONTS:');
            Object.keys(languageFontsDB).forEach(lang => {
                console.log(`  ${lang}: ${languageFontsDB[lang].length} fonts`);
            });

            console.log('');
            console.log('📥 RUNTIME SOURCES:');
            console.log(' ', (RUNTIME_CONFIG.__loadedSources || []).join(', ') || 'none');

            console.log('═══════════════════════════════════════════');
        },

        validate: function() {
            const issues = [];

            if (!_isValidJwk(APP_CONFIG.LICENSE_PUBLIC_KEY_JWK)) {
                issues.push({ severity: 'CRITICAL', msg: 'License public key not configured' });
            }
            if (!_isValidUpiId(APP_CONFIG.UPI_PRIMARY_ID)) {
                issues.push({ severity: 'HIGH', msg: 'UPI Primary ID invalid' });
            }
            if (!_isValidWhatsApp(APP_CONFIG.SUPPORT_WHATSAPP)) {
                issues.push({ severity: 'HIGH', msg: 'WhatsApp number invalid' });
            }
            if (!_isValidEmail(APP_CONFIG.SELLER_EMAIL)) {
                issues.push({ severity: 'HIGH', msg: 'Seller email invalid' });
            }
            if (!APP_CONFIG.NAME_ENCRYPTION_SECRET) {
                issues.push({ severity: 'MEDIUM', msg: 'Name encryption secret missing' });
            }
            if (!_isValidTrackingUrl(APP_CONFIG.TRACKING_ENDPOINT)) {
                issues.push({ severity: 'LOW', msg: 'Tracking endpoint not configured (optional)' });
            }

            if (issues.length === 0) {
                console.log('✅ Config validation passed — no issues');
            } else {
                console.warn('⚠️ Config issues:');
                issues.forEach(i => console.warn(`  [${i.severity}] ${i.msg}`));
            }

            return issues;
        },

        testJwk: function(jwk) {
            console.log('🧪 JWK validation test:');
            console.log('  Input:', jwk);
            console.log('  Valid:', _isValidJwk(jwk));
            return _isValidJwk(jwk);
        },

        testUpi: function(upiId) {
            console.log('🧪 UPI validation test:');
            console.log('  Input:', upiId);
            console.log('  Valid:', _isValidUpiId(upiId));
            return _isValidUpiId(upiId);
        },

        testEmail: function(email) {
            console.log('🧪 Email validation test:');
            console.log('  Input:', email);
            console.log('  Valid:', _isValidEmail(email));
            return _isValidEmail(email);
        },

        testBase64Url: function(str) {
            console.log('🧪 Base64URL validation test:');
            console.log('  Input:', str);
            console.log('  Length:', str ? str.length : 0);
            const regex = /^[A-Za-z0-9_-]+$/;
            console.log('  Valid base64url:', regex.test(str));
            return regex.test(str);
        },

        testBaseUrl: function() {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 BASE URL DIAGNOSTICS (FIX #3)');
            console.log('═══════════════════════════════════════════');

            const bd = _baseUrlDiagnostics;
            if (!bd) {
                console.warn('  ⚠️ No diagnostics available — run test again');
                return null;
            }

            console.log('');
            console.log('📍 RESOLVED URL:');
            console.log('  URL:', bd.url);
            console.log('  Source:', bd.source);
            console.log('  Reason:', bd.reason);

            console.log('');
            console.log('🌐 ENVIRONMENT:');
            console.log('  Protocol:', bd.protocol || '(none)');
            console.log('  Hostname:', bd.hostname || '(none)');
            console.log('  Port:', bd.port || '(default)');
            console.log('  Origin:', bd.origin || '(none)');
            console.log('  Is localhost:', bd.isLocalhost);

            console.log('');
            console.log('⚡ ELECTRON:');
            console.log('  isElectron:', bd.isElectron);
            console.log('  isElectronPackaged:', bd.isElectronPackaged);

            console.log('');
            console.log('🔧 NODE:');
            console.log('  NODE_ENV:', bd.nodeEnv || '(not set)');

            console.log('');
            console.log('🎯 OVERRIDE:');
            console.log('  hasOverride:', bd.hasOverride);
            console.log('  __BASE_URL_OVERRIDE__:', window.__BASE_URL_OVERRIDE__ || '(not set)');

            console.log('');
            console.log('📋 PRIORITY ORDER (FIX #3):');
            console.log('  1. window.__BASE_URL_OVERRIDE__   ← current source:',
                bd.source === 'runtime-override' ? '✅ THIS' : '—');
            console.log('  2. process.env.BASE_URL           ← current source:',
                bd.source === 'env' ? '✅ THIS' : '—');
            console.log('  3. ?dev=1 query param             ← current source:',
                bd.source === 'query-dev-flag' ? '✅ THIS' : '—');
            console.log('  4. Live HTTP/HTTPS origin         ← current source:',
                bd.source === 'current-origin' ? '✅ THIS' : '—');
            console.log('  5a. Electron packaged            ← current source:',
                bd.source === 'electron-packaged' ? '✅ THIS' : '—');
            console.log('  5b. Electron dev (NODE_ENV)      ← current source:',
                bd.source === 'electron-dev-nodeenv' ? '✅ THIS' : '—');
            console.log('  5c. Electron dev (implicit)      ← current source:',
                bd.source === 'electron-dev' ? '✅ THIS' : '—');
            console.log('  5d. NODE_ENV=production          ← current source:',
                bd.source === 'nodeenv-production' ? '✅ THIS' : '—');
            console.log('  5e. file:// browser (dev)        ← current source:',
                bd.source === 'file-browser-dev-default' ? '✅ THIS' : '—');
            console.log('  6.  Ultimate fallback             ← current source:',
                bd.source === 'ultimate-fallback' ? '✅ THIS' : '—');

            console.log('');
            console.log('═══════════════════════════════════════════');
            return bd;
        },

        testOverride: function(customUrl) {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 OVERRIDE MECHANISM TEST');
            console.log('═══════════════════════════════════════════');

            const testUrl = customUrl || 'https://example-test.com';
            const before = window.__BASE_URL_OVERRIDE__;

            console.log('  Setting override:', testUrl);
            window.__BASE_URL_OVERRIDE__ = testUrl;

            const diag = _resolveBaseUrlWithDiagnostics();

            console.log('');
            console.log('  Result URL:', diag.url);
            console.log('  Source:', diag.source);
            console.log('  Reason:', diag.reason);
            console.log('  hasOverride:', diag.hasOverride);
            console.log('');
            console.log('  Expected: URL =', testUrl);
            console.log('  Result:', diag.url === testUrl ? '✅ PASS' : '❌ FAIL');

            if (before !== undefined) {
                window.__BASE_URL_OVERRIDE__ = before;
            } else {
                delete window.__BASE_URL_OVERRIDE__;
            }

            console.log('');
            console.log('  Override restored to:', before || '(removed)');
            console.log('═══════════════════════════════════════════');

            return diag;
        },

        raw: function() {
            console.log('🔧 Raw RUNTIME_CONFIG:');
            console.log(JSON.stringify(RUNTIME_CONFIG, null, 2));
        },

        fonts: function() {
            console.log('🔤 Font Database:');
            Object.keys(languageFontsDB).forEach(lang => {
                console.log(`\n${lang}: ${languageFontsDB[lang].length} fonts`);
                languageFontsDB[lang].forEach(f => {
                    console.log(`  ${f.default ? '★' : ' '} ${f.name}`);
                });
            });
        }
    };
}

// ============================================================
// ✅ READY
// ============================================================
console.log('✅ config.js ready — v3.7.4.75 (FIX #3: 6-priority BASE_URL)');