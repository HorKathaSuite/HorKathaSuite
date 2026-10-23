// ============================================================
// 🌉 PRELOAD — Secure IPC Bridge + Runtime Config Injection
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.98 — FULLY UPGRADED (LATEST)
//    🔴 FIX 1: Added setZoom and getZoom IPC bridges
//    🔴 FIX 2: isValidHwid now supports Fallback Seeds (syncs with main.js)
//    🔴 FIX 3: NAME_ENCRYPTION_SECRET remains hidden from renderer
//    🔴 FIX 4: Added getStableHwid bridge (syncs with main.js MachineGuid)
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
    try { Object.freeze(obj); } catch (e) { return obj; }
    Object.getOwnPropertyNames(obj).forEach(function(prop) {
        let val;
        try { val = obj[prop]; } catch (e) { return; }
        if (val !== null && typeof val === 'object' && !Array.isArray(val) && !Object.isFrozen(val)) {
            deepFreeze(val);
        }
    });
    return obj;
}

// ============================================================
// 🔍 PACKAGED DETECTION
// ============================================================
function _detectPackaged() {
    try {
        if (typeof process.defaultApp === 'boolean') return !process.defaultApp;
        if (process.resourcesPath) {
            try {
                const asarPath = path.join(process.resourcesPath, 'app.asar');
                if (fs.existsSync(asarPath)) return true;
                const appDir = path.join(process.resourcesPath, 'app');
                if (fs.existsSync(appDir)) return true;
            } catch (e) {}
            const rp = process.resourcesPath.toLowerCase();
            if (!(rp.includes('node_modules') || (rp.includes('electron') && rp.endsWith('resources')))) {
                return true;
            }
        }
        return false;
    } catch (e) { return false; }
}

const IS_PACKAGED = _detectPackaged();
const PLATFORM = String(process.platform || 'unknown').toLowerCase();
const ARCH = String(process.arch || 'unknown').toLowerCase();

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
        if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, '.env.packaged'));
        candidates.push(path.join(__dirname, '.env.packaged'));

        let filePath = null, fileContent = null;
        for (const candidate of candidates) {
            try {
                if (candidate && fs.existsSync(candidate)) {
                    filePath = candidate;
                    fileContent = fs.readFileSync(candidate, 'utf-8');
                    break;
                }
            } catch (e) {}
        }
        if (!filePath || !fileContent) { _packagedEnvCache = null; return null; }

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
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            val = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\uFEFF/g, '').trim();
            if (val.length > 0) { result[key] = val; loadedCount++; }
        }
        if (loadedCount > 0) {
            _packagedEnvCache = result;
            return result;
        }
        _packagedEnvCache = null;
        return null;
    } catch (e) {
        _packagedEnvCache = null;
        return null;
    }
}

function envOr(key, fallback = '') {
    try {
        const val = process.env[key];
        if (val && typeof val === 'string') {
            const cleaned = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\uFEFF/g, '').trim();
            if (cleaned.length > 0) return cleaned;
        }
        const packaged = _loadPackagedEnv();
        if (packaged && packaged[key] && typeof packaged[key] === 'string') return packaged[key];
        return fallback;
    } catch (e) { return fallback; }
}

// ============================================================
// 🔐 JWK BUILDER
// ============================================================
function buildLicenseJwk() {
    const jwkStr = envOr('LICENSE_PUBLIC_KEY_JWK', '');
    if (jwkStr) {
        try {
            const parsed = JSON.parse(jwkStr);
            if (parsed && parsed.kty === 'EC' && parsed.crv === 'P-256' && parsed.x && parsed.y &&
                typeof parsed.x === 'string' && typeof parsed.y === 'string' &&
                parsed.x.length === 43 && parsed.y.length === 43) {
                return parsed;
            }
        } catch (e) {}
    }
    const x = envOr('LICENSE_PUBLIC_KEY_X', '');
    const y = envOr('LICENSE_PUBLIC_KEY_Y', '');
    if (!x || !y || x.length !== 43 || y.length !== 43) {
        return { kty: "EC", crv: "P-256", x: 'YOUR_X_COORDINATE_HERE', y: 'YOUR_Y_COORDINATE_HERE' };
    }
    return { kty: "EC", crv: "P-256", x: x, y: y };
}

// ============================================================
// 🔐 RUNTIME CONFIG (Secret Removed)
// ============================================================
const RUNTIME_CONFIG = deepFreeze({
    LICENSE_PUBLIC_KEY_JWK: buildLicenseJwk(),
    SUPPORT_WHATSAPP: envOr('SUPPORT_WHATSAPP', 'YOUR_WHATSAPP_NUMBER_HERE'),
    SELLER_EMAIL: envOr('SELLER_EMAIL', 'YOUR_EMAIL_HERE'),
    UPI_PRIMARY_ID: envOr('UPI_PRIMARY_ID', 'YOUR_UPI_ID_HERE'),
    UPI_NPCI_ID: envOr('UPI_NPCI_ID', 'YOUR_NPCI_ID_HERE'),
    PAYEE_NAME: envOr('PAYEE_NAME', 'YOUR_PAYEE_NAME_HERE'),
    TRACKING_ENDPOINT: envOr('TRACKING_ENDPOINT', 'https://YOUR-FIREBASE-PROJECT.firebasedatabase.app/activations.json')
});

// ============================================================
// 🔍 DETECT PLACEHOLDER CONFIG
// ============================================================
const IS_CONFIG_PLACEHOLDER = (function detect() {
    try {
        const jwk = RUNTIME_CONFIG.LICENSE_PUBLIC_KEY_JWK || {};
        const values = [RUNTIME_CONFIG.SUPPORT_WHATSAPP, RUNTIME_CONFIG.SELLER_EMAIL, RUNTIME_CONFIG.UPI_PRIMARY_ID, RUNTIME_CONFIG.PAYEE_NAME, jwk.x, jwk.y];
        return values.some(v => {
            if (!v || typeof v !== 'string') return true;
            const upper = v.toUpperCase();
            return upper.includes('YOUR_') || upper.includes('REPLACE_') || upper.includes('HERE') || upper.includes('EXAMPLE') || upper.includes('PLACEHOLDER');
        });
    } catch (e) { return true; }
})();

// ============================================================
// 🛡️ VALIDATION HELPERS (✅ FIXED: Fallback Seed Support)
// ============================================================
const DVC_CANONICAL_RE = /^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/;
const SEED_CHARSET_RE = /^[A-Za-z0-9+/=_.-]+$/;

function isValidHwid(hwid) {
    if (!hwid || typeof hwid !== 'string') return false;
    const trimmed = hwid.trim();
    if (DVC_CANONICAL_RE.test(trimmed)) return true;
    // Fallback seed check (Syncs with main.js)
    if (trimmed.length >= 16 && trimmed.length <= 1000 && SEED_CHARSET_RE.test(trimmed) && !/^DVC-/i.test(trimmed)) {
        return true;
    }
    return false;
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
            return result.catch(e => {
                return { success: false, error: (e && e.message) || 'IPC call failed', channel };
            });
        }
        return Promise.resolve(result);
    } catch (e) {
        return Promise.resolve({ success: false, error: (e && e.message) || 'Sync error', channel });
    }
}

// ============================================================
// 🌉 EXPOSE RUNTIME CONFIG
// ============================================================
try {
    contextBridge.exposeInMainWorld('__RUNTIME_CONFIG__', RUNTIME_CONFIG);
} catch (e) { console.error('❌ Failed to expose __RUNTIME_CONFIG__:', e.message); }

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

        // 🆕 STABLE HWID BRIDGE
        getStableHwid: () => safeInvoke('hwid-get-stable'),

        saveHwid: (hwid) => {
            if (!isValidHwid(hwid)) return Promise.resolve({ success: false, error: 'Invalid HWID format' });
            return safeInvoke('hwid-save', String(hwid).trim().toUpperCase());
        },
        loadHwid: () => safeInvoke('hwid-load'),
        deleteHwid: () => safeInvoke('hwid-delete'),

        validateHwid: (hwid) => {
            if (!hwid || typeof hwid !== 'string') return Promise.resolve({ success: false, error: 'HWID required' });
            return safeInvoke('hwid-validate', String(hwid).trim().toUpperCase());
        },

        getAppVersion: () => safeInvoke('app-version'),
        
        setZoom: (factor) => safeInvoke('set-zoom', Number(factor)),
        getZoom: () => safeInvoke('get-zoom'),

        encryptName: (name, hwid) => {
            if (!name || typeof name !== 'string' || name.trim().length === 0) return Promise.resolve(null);
            if (name.length > 500) name = name.substring(0, 500);
            const safeHwid = (hwid && typeof hwid === 'string' && hwid.trim().length > 0) ? hwid.trim() : 'unknown';

            return safeInvoke('encrypt-name', String(name), safeHwid)
                .then(result => {
                    if (!result) return null;
                    if (typeof result === 'string') return result;
                    if (result.success === true && typeof result.encrypted === 'string') return result.encrypted;
                    return null;
                })
                .catch(() => null);
        }
    });
} catch (e) { console.error('❌ Failed to expose electronAPI:', e.message); }

// ============================================================
// 🌉 EXPOSE VALIDATORS
// ============================================================
try {
    contextBridge.exposeInMainWorld('__validators__', {
        isValidHwid: (hwid) => isValidHwid(String(hwid || '').trim().toUpperCase()),
        isValidLicenseKey: (key) => isValidLicenseKey(String(key || '').trim().toUpperCase()),
        isValidTrialKey: (key) => isValidTrialKey(String(key || '').trim().toUpperCase()),
        normalizeHwid: (hwid) => String(hwid || '').trim().toUpperCase(),
        normalizeLicenseKey: (key) => String(key || '').trim().toUpperCase(),
        normalizeTrialKey: (key) => String(key || '').trim().toUpperCase()
    });
} catch (e) { console.error('❌ Failed to expose validators:', e.message); }

// ============================================================
// 📋 LOGGING
// ============================================================
try {
    console.log('═══════════════════════════════════════════');
    console.log('✅ Preload bridge loaded — v3.7.4.98');
    console.log('   🔐 Secrets protected (Renderer has NO access)');
    console.log('   🆔 Stable HWID bridge: ✅ active');
    console.log('   ⚡ Zoom controls: ✅ bridged');
    console.log('   🖥️  Platform:', PLATFORM, '(' + ARCH + ')');
    console.log('   📦 Packaged:', IS_PACKAGED ? '✅ YES' : '⚙️ NO (dev mode)');
    console.log('═══════════════════════════════════════════');
} catch (e) {}