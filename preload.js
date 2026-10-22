// ============================================================
// 🌉 PRELOAD — Secure IPC Bridge + Runtime Config Injection
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.92 — SECURITY HARDENED (CRITICAL FIX #1):
//    • 🔴 REMOVED: NAME_ENCRYPTION_SECRET from RUNTIME_CONFIG
//                  → Renderer me secret kabhi nahi jayega
//                  → XSS ke through secret steal impossible
//    • 🔴 REMOVED: _validateSecret() — ab main.js me handle hoga
//    • 🆕 ADDED: electronAPI.encryptName(name, hwid)
//                 → IPC bridge to main.js 'encrypt-name' handler
//                 → Main process me AES-256-GCM encryption hoti hai
//                 → Renderer sirf encrypted blob receive karta hai
//    • 🔑 Logging: secret length bhi nahi dikhate (info leak prevention)
//    • All v3.7.4.89 features retained
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// ============================================================
// 🧊 DEEP FREEZE
// ============================================================
function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Object.isFrozen(obj)) return obj;

    try {
        Object.freeze(obj);
    } catch (e) {
        return obj;
    }

    Object.getOwnPropertyNames(obj).forEach(function(prop) {
        let val;
        try {
            val = obj[prop];
        } catch (e) {
            return;
        }

        if (val !== null &&
            typeof val === 'object' &&
            !Array.isArray(val) &&
            !Object.isFrozen(val)) {
            deepFreeze(val);
        }
    });

    return obj;
}

// ============================================================
// 🔍 PACKAGED DETECTION — 3-CHANNEL (FIX #6)
// ============================================================
function _detectPackaged() {
    try {
        // Channel 1: process.defaultApp (most reliable)
        if (typeof process.defaultApp === 'boolean') {
            const result = !process.defaultApp;
            console.log('[preload] isPackaged via process.defaultApp:', result);
            return result;
        }

        // Channel 2: app.asar existence
        if (process.resourcesPath) {
            try {
                const asarPath = path.join(process.resourcesPath, 'app.asar');
                if (fs.existsSync(asarPath)) {
                    console.log('[preload] isPackaged via app.asar: true');
                    return true;
                }

                const appDir = path.join(process.resourcesPath, 'app');
                if (fs.existsSync(appDir)) {
                    console.log('[preload] isPackaged via app/ dir: true');
                    return true;
                }
            } catch (e) {}
        }

        // Channel 3: resourcesPath pattern heuristic
        if (process.resourcesPath) {
            const rp = process.resourcesPath.toLowerCase();
            const looksLikeElectronDist =
                rp.includes('node_modules') ||
                rp.includes('electron') && rp.endsWith('resources');

            if (!looksLikeElectronDist) {
                console.log('[preload] isPackaged via resourcesPath heuristic: true');
                return true;
            }
        }

        console.log('[preload] isPackaged: false (dev mode)');
        return false;

    } catch (e) {
        console.warn('[preload] _detectPackaged error:', e.message);
        return false;
    }
}

// ============================================================
// 🖥️ PLATFORM DETECTION
// ============================================================
function _detectPlatform() {
    try {
        return String(process.platform || 'unknown').toLowerCase();
    } catch (e) {
        return 'unknown';
    }
}

function _detectArch() {
    try {
        return String(process.arch || 'unknown').toLowerCase();
    } catch (e) {
        return 'unknown';
    }
}

const IS_PACKAGED = _detectPackaged();
const PLATFORM = _detectPlatform();
const ARCH = _detectArch();

// ============================================================
// 🔐 .env.packaged FILE PARSER
// ============================================================
let _packagedEnvCache = null;
let _packagedEnvParsed = false;

function _loadPackagedEnv() {
    if (_packagedEnvParsed) return _packagedEnvCache;
    _packagedEnvParsed = true;

    const result = {};

    try {
        const candidates = [];

        if (process.resourcesPath) {
            candidates.push(path.join(process.resourcesPath, '.env.packaged'));
        }
        candidates.push(path.join(__dirname, '.env.packaged'));

        let filePath = null;
        let fileContent = null;

        for (const candidate of candidates) {
            try {
                if (candidate && fs.existsSync(candidate)) {
                    filePath = candidate;
                    fileContent = fs.readFileSync(candidate, 'utf-8');
                    break;
                }
            } catch (e) {}
        }

        if (!filePath || !fileContent) {
            _packagedEnvCache = null;
            return null;
        }

        const lines = fileContent.split(/\r?\n/);
        let loadedCount = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const eqIdx = trimmed.indexOf('=');
            if (eqIdx < 0) continue;

            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();

            if (!key || !/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;

            if ((val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }

            val = val
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/\uFEFF/g, '')
                .trim();

            if (val.length > 0) {
                result[key] = val;
                loadedCount++;
            }
        }

        if (loadedCount > 0) {
            console.log('✅ [preload] .env.packaged loaded:', loadedCount, 'variables from', filePath);
            _packagedEnvCache = result;
            return result;
        }

        _packagedEnvCache = null;
        return null;

    } catch (e) {
        console.warn('[preload] .env.packaged parse failed:', e.message);
        _packagedEnvCache = null;
        return null;
    }
}

// ============================================================
// 🔐 SAFE ENV READER
// ============================================================
function envOr(key, fallback = '') {
    try {
        const val = process.env[key];
        if (val && typeof val === 'string') {
            const cleaned = val
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/\uFEFF/g, '')
                .trim();

            if (cleaned.length > 0) return cleaned;
        }

        const packaged = _loadPackagedEnv();
        if (packaged && packaged[key] && typeof packaged[key] === 'string') {
            return packaged[key];
        }

        return fallback;
    } catch (e) {
        return fallback;
    }
}

// ============================================================
// 🔐 JWK BUILDER — SAFE BUILD
// ============================================================
function buildLicenseJwk() {
    const jwkStr = envOr('LICENSE_PUBLIC_KEY_JWK', '');

    if (jwkStr) {
        try {
            const parsed = JSON.parse(jwkStr);

            if (parsed &&
                parsed.kty === 'EC' &&
                parsed.crv === 'P-256' &&
                parsed.x && parsed.y &&
                typeof parsed.x === 'string' &&
                typeof parsed.y === 'string' &&
                parsed.x.length === 43 &&
                parsed.y.length === 43) {

                console.log('[preload] ✅ License JWK: loaded from LICENSE_PUBLIC_KEY_JWK');
                return parsed;
            }

            console.warn('[preload] ⚠️ LICENSE_PUBLIC_KEY_JWK present but invalid structure');
        } catch (e) {
            console.warn('[preload] ⚠️ Failed to parse LICENSE_PUBLIC_KEY_JWK:', e.message);
        }
    }

    const x = envOr('LICENSE_PUBLIC_KEY_X', '');
    const y = envOr('LICENSE_PUBLIC_KEY_Y', '');

    if (!x || !y) {
        console.log('[preload] License JWK: missing X or Y — using placeholder');
        return {
            kty: "EC",
            crv: "P-256",
            x: 'YOUR_X_COORDINATE_HERE',
            y: 'YOUR_Y_COORDINATE_HERE'
        };
    }

    if (x.length !== 43 || y.length !== 43) {
        console.warn('[preload] License JWK: invalid length — using placeholder');
        return {
            kty: "EC",
            crv: "P-256",
            x: 'YOUR_X_COORDINATE_HERE',
            y: 'YOUR_Y_COORDINATE_HERE'
        };
    }

    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    if (!base64urlRegex.test(x) || !base64urlRegex.test(y)) {
        console.warn('[preload] License JWK: invalid characters — using placeholder');
        return {
            kty: "EC",
            crv: "P-256",
            x: 'YOUR_X_COORDINATE_HERE',
            y: 'YOUR_Y_COORDINATE_HERE'
        };
    }

    if (/^(.)\1+$/.test(x) || /^(.)\1+$/.test(y)) {
        console.warn('[preload] License JWK: all-same-char detected — using placeholder');
        return {
            kty: "EC",
            crv: "P-256",
            x: 'YOUR_X_COORDINATE_HERE',
            y: 'YOUR_Y_COORDINATE_HERE'
        };
    }

    if (/^0+$/.test(x) || /^0+$/.test(y)) {
        console.warn('[preload] License JWK: all-zero detected — using placeholder');
        return {
            kty: "EC",
            crv: "P-256",
            x: 'YOUR_X_COORDINATE_HERE',
            y: 'YOUR_Y_COORDINATE_HERE'
        };
    }

    const upperX = x.toUpperCase();
    const upperY = y.toUpperCase();
    const placeholderKeywords = ['YOUR_', 'REPLACE', 'HERE', 'EXAMPLE', 'XXXX', 'TODO', 'FIXME', 'PLACEHOLDER'];

    for (let i = 0; i < placeholderKeywords.length; i++) {
        if (upperX.includes(placeholderKeywords[i]) || upperY.includes(placeholderKeywords[i])) {
            console.log('[preload] License JWK: placeholder detected — using placeholder');
            return {
                kty: "EC",
                crv: "P-256",
                x: 'YOUR_X_COORDINATE_HERE',
                y: 'YOUR_Y_COORDINATE_HERE'
            };
        }
    }

    const uniqueX = new Set(x).size;
    const uniqueY = new Set(y).size;
    if (uniqueX < 8 || uniqueY < 8) {
        console.warn('[preload] License JWK: low entropy — using placeholder');
        return {
            kty: "EC",
            crv: "P-256",
            x: 'YOUR_X_COORDINATE_HERE',
            y: 'YOUR_Y_COORDINATE_HERE'
        };
    }

    console.log('[preload] ✅ License JWK: configured successfully (x:' + x.length + ' chars, y:' + y.length + ' chars)');
    return {
        kty: "EC",
        crv: "P-256",
        x: x,
        y: y
    };
}

// ============================================================
// 🔐 SECRET EXISTENCE CHECK (for logging only)
// ============================================================
const _hasSecret = (function checkSecretExists() {
    try {
        // Check process.env
        const envVal = process.env.NAME_ENCRYPTION_SECRET;
        if (envVal && typeof envVal === 'string' && envVal.trim().length >= 16) {
            const upper = envVal.toUpperCase();
            if (!/YOUR_|_HERE|REPLACE_|CHANGE_ME|PLACEHOLDER|EXAMPLE|TODO/i.test(upper)) {
                return true;
            }
        }

        // Check .env.packaged
        const packaged = _loadPackagedEnv();
        if (packaged && packaged.NAME_ENCRYPTION_SECRET) {
            const val = packaged.NAME_ENCRYPTION_SECRET;
            if (typeof val === 'string' && val.trim().length >= 16) {
                const upper = val.toUpperCase();
                if (!/YOUR_|_HERE|REPLACE_|CHANGE_ME|PLACEHOLDER|EXAMPLE|TODO/i.test(upper)) {
                    return true;
                }
            }
        }

        return false;
    } catch (e) {
        return false;
    }
})();

// ============================================================
// 🔐 RUNTIME CONFIG — ✅ SECRET REMOVED (v3.7.4.92)
// ============================================================
const RUNTIME_CONFIG = deepFreeze({
    LICENSE_PUBLIC_KEY_JWK: buildLicenseJwk(),

    SUPPORT_WHATSAPP: envOr('SUPPORT_WHATSAPP', 'YOUR_WHATSAPP_NUMBER_HERE'),
    SELLER_EMAIL: envOr('SELLER_EMAIL', 'YOUR_EMAIL_HERE'),

    UPI_PRIMARY_ID: envOr('UPI_PRIMARY_ID', 'YOUR_UPI_ID_HERE'),
    UPI_NPCI_ID: envOr('UPI_NPCI_ID', 'YOUR_NPCI_ID_HERE'),
    PAYEE_NAME: envOr('PAYEE_NAME', 'YOUR_PAYEE_NAME_HERE'),

    TRACKING_ENDPOINT: envOr(
        'TRACKING_ENDPOINT',
        'https://YOUR-FIREBASE-PROJECT.firebasedatabase.app/activations.json'
    )
});

// ============================================================
// 🔍 DETECT PLACEHOLDER CONFIG
// ============================================================
const IS_CONFIG_PLACEHOLDER = (function detect() {
    try {
        const jwk = RUNTIME_CONFIG.LICENSE_PUBLIC_KEY_JWK || {};

        const values = [
            RUNTIME_CONFIG.SUPPORT_WHATSAPP,
            RUNTIME_CONFIG.SELLER_EMAIL,
            RUNTIME_CONFIG.UPI_PRIMARY_ID,
            RUNTIME_CONFIG.PAYEE_NAME,
            jwk.x,
            jwk.y
        ];

        return values.some(function(v) {
            if (!v || typeof v !== 'string') return true;
            const upper = v.toUpperCase();
            return upper.includes('YOUR_') ||
                   upper.includes('REPLACE_') ||
                   upper.includes('HERE') ||
                   upper.includes('EXAMPLE') ||
                   upper.includes('PLACEHOLDER');
        });
    } catch (e) {
        console.warn('[preload] Placeholder detection failed:', e.message);
        return true;
    }
})();

// ============================================================
// 🛡️ VALIDATION HELPERS
// ============================================================
function isValidHwid(hwid) {
    if (!hwid || typeof hwid !== 'string') return false;
    return /^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/.test(hwid.trim());
}

function isValidLicenseKey(key) {
    if (!key || typeof key !== 'string') return false;
    return /^HKP-(P[1-3])-(?:\d{4}|\d{6})-[A-F0-9]{128}$/.test(key.trim().toUpperCase());
}

function isValidTrialKey(key) {
    if (!key || typeof key !== 'string') return false;
    return /^HKT-\d{7}-[A-F0-9]{4}$/.test(key.trim().toUpperCase());
}

// ============================================================
// 🛡️ SAFE IPC WRAPPER
// ============================================================
function safeInvoke(channel, ...args) {
    try {
        const result = ipcRenderer.invoke(channel, ...args);

        if (result && typeof result.then === 'function') {
            return result.catch(function(e) {
                const errorMsg = (e && e.message) || 'IPC call failed';
                console.error('[preload] IPC error in "' + channel + '":', errorMsg);
                return {
                    success: false,
                    error: errorMsg,
                    channel: channel
                };
            });
        }

        return Promise.resolve(result);

    } catch (e) {
        const errorMsg = (e && e.message) || 'Sync error in IPC invoke';
        console.error('[preload] Sync IPC error in "' + channel + '":', errorMsg);
        return Promise.resolve({
            success: false,
            error: errorMsg,
            channel: channel
        });
    }
}

// ============================================================
// 🌉 EXPOSE RUNTIME CONFIG
// ============================================================
try {
    contextBridge.exposeInMainWorld('__RUNTIME_CONFIG__', RUNTIME_CONFIG);
} catch (e) {
    console.error('❌ Failed to expose __RUNTIME_CONFIG__:', e.message);
}

// ============================================================
// 🌉 EXPOSE ELECTRON API
// ============================================================
try {
    contextBridge.exposeInMainWorld('electronAPI', {
        isElectron: true,
        isConfigPlaceholder: IS_CONFIG_PLACEHOLDER,

        isPackaged: IS_PACKAGED,
        platform: PLATFORM,
        arch: ARCH,

        versions: {
            electron: (process.versions && process.versions.electron) || 'unknown',
            node: (process.versions && process.versions.node) || 'unknown',
            chrome: (process.versions && process.versions.chrome) || 'unknown'
        },

        saveHwid: (hwid) => {
            if (!isValidHwid(hwid)) {
                return Promise.resolve({
                    success: false,
                    error: 'Invalid HWID format (expected DVC-XXXX-XXXX)'
                });
            }
            return safeInvoke('hwid-save', String(hwid).trim().toUpperCase());
        },

        loadHwid: () => safeInvoke('hwid-load'),
        deleteHwid: () => safeInvoke('hwid-delete'),

        validateHwid: (hwid) => {
            if (!hwid || typeof hwid !== 'string') {
                return Promise.resolve({
                    success: false,
                    error: 'HWID must be a non-empty string'
                });
            }
            return safeInvoke('hwid-validate', String(hwid).trim().toUpperCase());
        },

        getAppVersion: () => {
            return safeInvoke('app-version').catch(function(e) {
                return {
                    success: false,
                    error: (e && e.message) || 'Failed to get app version',
                    version: 'unknown',
                    electron: (process.versions && process.versions.electron) || 'unknown',
                    node: (process.versions && process.versions.node) || 'unknown',
                    chrome: (process.versions && process.versions.chrome) || 'unknown'
                };
            });
        },

        encryptName: (name, hwid) => {
            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                return Promise.resolve(null);
            }

            if (name.length > 500) {
                console.warn('[preload] encryptName: name too long, truncating');
                name = name.substring(0, 500);
            }

            const safeHwid = (hwid && typeof hwid === 'string' && hwid.trim().length > 0)
                ? hwid.trim()
                : 'unknown';

            return safeInvoke('encrypt-name', String(name), safeHwid)
                .then(function(result) {
                    if (result === null || result === undefined) return null;
                    if (typeof result === 'string') return result;
                    if (result.success === true && typeof result.encrypted === 'string') {
                        return result.encrypted;
                    }
                    if (result.success === false) {
                        console.warn('[preload] encryptName failed:', result.error);
                        return null;
                    }
                    return null;
                })
                .catch(function(e) {
                    console.error('[preload] encryptName error:', e.message);
                    return null;
                });
        }
    });
} catch (e) {
    console.error('❌ Failed to expose electronAPI:', e.message);
}

// ============================================================
// 🌉 EXPOSE VALIDATORS
// ============================================================
try {
    contextBridge.exposeInMainWorld('__validators__', {
        isValidHwid: function(hwid) {
            if (!hwid || typeof hwid !== 'string') return false;
            return isValidHwid(String(hwid).trim().toUpperCase());
        },

        isValidLicenseKey: function(key) {
            if (!key || typeof key !== 'string') return false;
            return isValidLicenseKey(String(key).trim().toUpperCase());
        },

        isValidTrialKey: function(key) {
            if (!key || typeof key !== 'string') return false;
            return isValidTrialKey(String(key).trim().toUpperCase());
        },

        normalizeHwid: function(hwid) {
            if (!hwid || typeof hwid !== 'string') return '';
            return String(hwid).trim().toUpperCase();
        },

        normalizeLicenseKey: function(key) {
            if (!key || typeof key !== 'string') return '';
            return String(key).trim().toUpperCase();
        },

        normalizeTrialKey: function(key) {
            if (!key || typeof key !== 'string') return '';
            return String(key).trim().toUpperCase();
        }
    });
} catch (e) {
    console.error('❌ Failed to expose validators:', e.message);
}

// ============================================================
// 📋 LOGGING (Safe - No Secrets Leaked)
// ============================================================
try {
    console.log('═══════════════════════════════════════════');
    console.log('✅ Preload bridge loaded — v3.7.4.92 (HARDENED)');
    console.log('   📦 electronAPI exposed');
    console.log('   🔐 __RUNTIME_CONFIG__ exposed (deep-frozen)');
    console.log('   ✔️  __validators__ exposed (with normalizers)');
    console.log('   🔑 encryptName bridge: ✅ available');
    console.log('   ⚡ Electron:', (process.versions && process.versions.electron) || 'unknown');
    console.log('   🟢 Node:', (process.versions && process.versions.node) || 'unknown');
    console.log('   🌐 Chrome:', (process.versions && process.versions.chrome) || 'unknown');
    console.log('   🖥️  Platform:', PLATFORM, '(' + ARCH + ')');
    console.log('   📦 Packaged:', IS_PACKAGED ? '✅ YES (production)' : '⚙️ NO (dev mode)');

    const packagedEnvLoaded = _packagedEnvCache !== null;

    console.log('   📂 Config sources:');
    console.log('      • process.env:', _hasSecret ? '✅ has secret (main only)' : '❌ no secret');
    console.log('      • .env.packaged:', packagedEnvLoaded ? '✅ loaded' : '⚠️ not found');
    console.log('      • .env.packaged vars:', packagedEnvLoaded ? Object.keys(_packagedEnvCache).length : 0);

    const jwk = RUNTIME_CONFIG.LICENSE_PUBLIC_KEY_JWK || {};
    const jwkOk = jwk.x && jwk.y &&
                  jwk.x.length === 43 &&
                  jwk.y.length === 43 &&
                  !jwk.x.includes('YOUR_') &&
                  !jwk.y.includes('YOUR_');
    console.log('   🔐 License JWK:', jwkOk ? '✅ configured (43 chars x/y)' : '⚠️  placeholder');

    console.log('   🔑 Secret:', _hasSecret
        ? '✅ configured (main process only — renderer NOT exposed)'
        : '❌ not configured');

    if (RUNTIME_CONFIG.NAME_ENCRYPTION_SECRET !== undefined) {
        console.error('   🚨 SECURITY BUG: NAME_ENCRYPTION_SECRET leaked to renderer!');
        console.error('   🚨 This should never happen — investigate immediately');
    } else {
        console.log('   🔒 Secret isolation: ✅ renderer has NO access');
    }

    if (IS_CONFIG_PLACEHOLDER) {
        console.warn('');
        console.warn('⚠️  RUNTIME CONFIG NOT FULLY CONFIGURED');
        console.warn('   Set these env vars (in .env or .env.packaged):');
        console.warn('     • LICENSE_PUBLIC_KEY_X (43 chars)');
        console.warn('     • LICENSE_PUBLIC_KEY_Y (43 chars)');
        console.warn('     • SUPPORT_WHATSAPP');
        console.warn('     • SELLER_EMAIL');
        console.warn('     • UPI_PRIMARY_ID');
        console.warn('     • PAYEE_NAME');
        console.warn('     • NAME_ENCRYPTION_SECRET (main process only)');
    } else {
        console.log('   ✅ Runtime config: fully configured');
    }
    console.log('═══════════════════════════════════════════');
} catch (e) {
    // Silent — logging must never crash preload
}