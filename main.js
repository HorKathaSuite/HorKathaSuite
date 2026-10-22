// ============================================================
// 🖥️ ELECTRON MAIN — HWID Persistent Storage (3-Layer)
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.96 — PRODUCTION-READY (LATEST)
//
//    🔴 FIX 1: STRICT_ENCRYPTION_MODE now reads AFTER env load
//    🔴 FIX 2: INTERNAL_SIGNATURE properly used (no dead code)
//    🔴 FIX 3: OS env vars preserved (CI/CD friendly)
//    🔴 FIX 4: .env.packaged overrides .env (production wins)
//    🔴 FIX 5: setWindowOpenHandler allows file:// & local-asset://
//              (Privacy/Terms/Manual buttons now work in Electron)
// ============================================================

// ============================================================
// 📦 DEPENDENCIES — MUST BE FIRST (no TDZ risk)
// ============================================================
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const {
    app, BrowserWindow, Menu, session, shell,
    ipcMain, screen, dialog, protocol
} = require('electron');

// ============================================================
// 📸 OS ENV SNAPSHOT — MUST BE BEFORE ANY ENV LOADING
// ============================================================
// Captures which keys were set by OS/CI BEFORE we load .env files.
// This lets .env.packaged override .env but NOT OS env vars.
// ============================================================
const _OS_ENV_SNAPSHOT = new Set(Object.keys(process.env));

// ============================================================
// ⚙️ CONSTANTS
// ============================================================
const DEFAULT_ZOOM_FACTOR = 1.25;
const MIN_ZOOM_FACTOR = 0.8;
const MAX_ZOOM_FACTOR = 2.0;
const REG_TIMEOUT_MS = 2500;
const MAX_DID_FAIL = 3;
const FAIL_WINDOW_MS = 30000;

// ✅ FIX 2: INTERNAL_SIGNATURE now used consistently
const INTERNAL_SIGNATURE = 'data-bosc-internal="v3.7.4.96"';
const INTERNAL_MARKER = 'data-bosc-internal'; // For inclusion check

// ============================================================
// 🔐 ENCRYPTION CONSTANTS — MUST MATCH crypto-utils.js
// ============================================================
const ENCRYPTION_CONSTANTS = Object.freeze({
    PBKDF2_ITERATIONS: 100000,
    KEY_LENGTH: 32,
    HASH_ALGO: 'sha256',
    IV_LENGTH: 12,
    AUTH_TAG_LENGTH: 16,
    SALT_PREFIX: 'HorKatha-Salt-v2:',
    MAX_HWID_LENGTH: 1000,
    MIN_SEED_LENGTH: 16
});

// ============================================================
// 🔐 STRICT ENCRYPTION MODE — ✅ FIX 1: Function (not const)
// ============================================================
// Must be called AFTER env files are loaded, otherwise it
// will miss HOR_STRICT_ENCRYPTION from .env.packaged.
// ============================================================
function getStrictEncryptionMode() {
    const val = String(process.env.HOR_STRICT_ENCRYPTION || '').toLowerCase().trim();
    return val === 'true' || val === '1' || val === 'yes';
}

// ============================================================
// 🛡️ HWID HELPERS — SINGLE SOURCE OF TRUTH
// ============================================================
const DVC_CANONICAL_RE = /^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/;
const SEED_CHARSET_RE = /^[A-Za-z0-9+/=_.-]+$/;

function _isFallbackSeed(trimmed) {
    if (!trimmed || typeof trimmed !== 'string') return false;
    if (trimmed.length < ENCRYPTION_CONSTANTS.MIN_SEED_LENGTH) return false;
    if (trimmed.length > ENCRYPTION_CONSTANTS.MAX_HWID_LENGTH) return false;
    if (!SEED_CHARSET_RE.test(trimmed)) return false;
    if (/^DVC-/i.test(trimmed)) return false;
    return true;
}

function sanitizeHwid(hwid) {
    if (!hwid || typeof hwid !== 'string') return '';

    const trimmed = String(hwid).trim();
    if (!trimmed) return '';

    const upper = trimmed.toUpperCase();

    const dvcMatch = upper.match(/^DVC[\s-]*([A-F0-9]{4})[\s-]*([A-F0-9]{4})$/);
    if (dvcMatch) return `DVC-${dvcMatch[1]}-${dvcMatch[2]}`;

    const hexOnlyMatch = upper.match(/^([A-F0-9]{8})$/);
    if (hexOnlyMatch) {
        const hex = hexOnlyMatch[1];
        return `DVC-${hex.substring(0, 4)}-${hex.substring(4, 8)}`;
    }

    const pairMatch = upper.match(/^([A-F0-9]{4})[\s-]+([A-F0-9]{4})$/);
    if (pairMatch) return `DVC-${pairMatch[1]}-${pairMatch[2]}`;

    if (_isFallbackSeed(trimmed)) return trimmed;

    console.warn(
        '⚠️ [sanitizeHwid] Rejected non-canonical input, length:',
        trimmed.length
    );
    return '';
}

function isValidHwidFormat(hwid) {
    if (!hwid || typeof hwid !== 'string') return false;
    if (DVC_CANONICAL_RE.test(hwid)) return true;
    if (_isFallbackSeed(hwid)) return true;
    return false;
}

function isFallbackSeed(hwid) {
    if (!hwid || typeof hwid !== 'string') return false;
    return !DVC_CANONICAL_RE.test(hwid) && _isFallbackSeed(hwid);
}

// ============================================================
// 🧼 HTML ESCAPE HELPER
// ============================================================
function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// 🔐 ENV PARSING — SMART OVERRIDE
// ============================================================
// Rules:
//   1. If key not set anywhere → always set (loaded++)
//   2. If override=true AND key is NOT from OS env → override
//      (means it came from a previous .env file → safe to override)
//   3. Otherwise → skip (preserve OS env)
//
// This ensures:
//   • OS env (CI/CD secrets) always wins ✅
//   • .env.packaged overrides .env values ✅
//   • .env fills in any missing keys ✅
// ============================================================
function parseEnvFile(filePath, { strict = false, override = false } = {}) {
    if (!filePath || !fs.existsSync(filePath)) return { loaded: 0, parsed: {} };

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        let loaded = 0;
        let skipped = 0;
        const parsed = {};

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

            if (val.length === 0) continue;

            // ─── Decide whether to set ───
            const isOSEnv = _OS_ENV_SNAPSHOT.has(key);
            const isCurrentlySet = !!process.env[key];

            let shouldSet = false;
            if (!isCurrentlySet) {
                // Nothing set yet → always set
                shouldSet = true;
            } else if (override && !isOSEnv) {
                // Override requested AND not protected OS env
                // (came from earlier .env file → safe to replace)
                shouldSet = true;
            } else {
                // OS env set → protect it
                // OR override=false → don't touch
                skipped++;
            }

            if (shouldSet) {
                process.env[key] = val;
                parsed[key] = val;
                loaded++;
            }
        }

        return { loaded, skipped, parsed, path: filePath };
    } catch (e) {
        if (strict) console.warn('[parseEnvFile] failed:', e.message);
        return { loaded: 0, skipped: 0, parsed: {}, error: e };
    }
}

// ============================================================
// 🔐 LOAD .env FILE (Development config — runs FIRST)
// ============================================================
(function loadEnvFile() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.log('ℹ️ [main.js] No .env file (optional)');
        return;
    }

    try {
        const dotenv = require('dotenv');
        const result = dotenv.config({ path: envPath });
        if (result.error) {
            console.warn('⚠️ [main.js] .env NOT loaded via dotenv:', result.error.message);
            const fallback = parseEnvFile(envPath, { strict: true });
            if (fallback.loaded > 0) {
                console.log('✅ [main.js] Manual .env parser loaded', fallback.loaded, 'variables');
            }
            return;
        }
        const varCount = Object.keys(result.parsed || {}).length;
        console.log('✅ [main.js] .env loaded via dotenv —', varCount, 'variables');
    } catch (e) {
        console.info('ℹ️ [main.js] Using built-in .env parser (dotenv not installed — this is fine)');
        const fallback = parseEnvFile(envPath, { strict: true });
        if (fallback.loaded > 0) {
            console.log('✅ [main.js] Manual .env parser loaded', fallback.loaded, 'variables');
        }
    }
})();

// ============================================================
// 🔐 LOAD .env.packaged FILE (Production config — runs SECOND, overrides .env)
// ============================================================
(function loadPackagedEnv() {
    try {
        const candidates = [];
        if (process.resourcesPath) {
            candidates.push(path.join(process.resourcesPath, '.env.packaged'));
        }
        candidates.push(path.join(__dirname, '.env.packaged'));

        for (const candidate of candidates) {
            if (!candidate || !fs.existsSync(candidate)) continue;

            // ✅ FIX: override: true — .env.packaged wins over .env
            //          but NOT over OS env (protected by snapshot)
            const result = parseEnvFile(candidate, { override: true });

            if (result.error) {
                console.debug('[main.js] .env.packaged parse skipped:', candidate);
                continue;
            }

            if (result.loaded > 0) {
                console.log(
                    '✅ [main.js] .env.packaged loaded:',
                    result.loaded, 'new vars,',
                    result.skipped || 0, 'OS-protected, from',
                    candidate
                );
            } else if (result.skipped > 0) {
                console.log(
                    'ℹ️ [main.js] .env.packaged found — all',
                    result.skipped, 'keys already set by OS env'
                );
            } else {
                console.log('ℹ️ [main.js] .env.packaged found but empty');
            }
            return;
        }
        console.log('ℹ️ [main.js] No .env.packaged file (optional)');
    } catch (e) {
        console.warn('[main.js] .env.packaged load failed:', e.message);
    }
})();

// ============================================================
// 🔐 SECRET RESOLUTION — MULTI-CHANNEL
// ============================================================
function _isValidSecret(s) {
    if (!s || typeof s !== 'string') return false;
    const trimmed = s.trim();
    if (trimmed.length < 16) return false;
    if (/YOUR_|_HERE|REPLACE_|CHANGE_ME|PLACEHOLDER|EXAMPLE/i.test(trimmed)) return false;
    return true;
}

function _resolveEncryptionSecret() {
    const envSecret = process.env.NAME_ENCRYPTION_SECRET;
    if (_isValidSecret(envSecret)) {
        return {
            secret: envSecret.trim(),
            source: 'process.env',
            valid: true,
            length: envSecret.trim().length
        };
    }

    const candidates = [];
    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, '.env.packaged'));
    }
    candidates.push(path.join(__dirname, '.env.packaged'));

    for (const candidate of candidates) {
        try {
            if (!candidate || !fs.existsSync(candidate)) continue;
            const raw = fs.readFileSync(candidate, 'utf-8');
            const match = raw.match(/^\s*NAME_ENCRYPTION_SECRET\s*=\s*(.+)$/m);
            if (match && match[1]) {
                let val = match[1].trim();
                if ((val.startsWith('"') && val.endsWith('"')) ||
                    (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                if (_isValidSecret(val)) {
                    return {
                        secret: val,
                        source: 'packaged-file',
                        valid: true,
                        length: val.length,
                        path: candidate
                    };
                }
            }
        } catch (e) {}
    }

    return { secret: null, source: 'none', valid: false, length: 0 };
}

function logCriticalVarsFromLoad() {
    const criticalVars = [
        'LICENSE_PUBLIC_KEY_X',
        'LICENSE_PUBLIC_KEY_Y',
        'SUPPORT_WHATSAPP',
        'SELLER_EMAIL',
        'UPI_PRIMARY_ID'
    ];

    const missing = criticalVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
        console.warn('   ⚠️ [main.js] Missing critical vars:', missing.join(', '));
    } else {
        console.log('   ✅ [main.js] All critical vars present');
    }

    const secretInfo = _resolveEncryptionSecret();

    if (secretInfo.valid) {
        console.log('   ✅ [main.js] NAME_ENCRYPTION_SECRET present (' + secretInfo.length + ' chars via ' + secretInfo.source + ')');
        console.log('   ℹ️  [main.js] Option A: secret used for STARTUP GATE only');
        console.log('   🔐 [main.js] Encryption passphrase: HWID (sanitized)');
    } else {
        console.warn('');
        console.warn('   ⚠️  [main.js] NAME_ENCRYPTION_SECRET not found');
        console.warn('   ───────────────────────────────────────────');
        console.warn('   Option A mode:');
        console.warn('   • Startup gate: ⚠️ warnings only (non-strict)');
        console.warn('   • Encryption: ✅ still works (HWID passphrase)');
        console.warn('');

        // ✅ FIX 1: Read strict mode AFTER env load
        if (getStrictEncryptionMode()) {
            console.error('   🚨 STRICT MODE ENABLED — startup will be BLOCKED');
        } else {
            console.warn('   ⚠️  Secret is OPTIONAL in Option A mode.');
            console.warn('   Only needed for STRICT mode (HOR_STRICT_ENCRYPTION=true).');
        }
    }
}

logCriticalVarsFromLoad();

// ============================================================
// 🌐 TRUSTED EXTERNAL HOSTS — STRICT WHITELIST
// ============================================================
const DEFAULT_TRUSTED_HOSTS = [
    'wa.me',
    'whatsapp.com',
    'api.whatsapp.com',
    'web.whatsapp.com',
    'formsubmit.co',
    'bosctech.in',
    'hor-katha.vercel.app',
    'raw.githubusercontent.com',
    'gist.githubusercontent.com',
    'api.qrserver.com',
    'quickchart.io',
    'googleapis.com',
    'gstatic.com',
    'cloudflare.com',
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'jsdelivr.net'
];

const TRUSTED_EXTERNAL_HOSTS = (function loadTrustedHosts() {
    let hosts = [...DEFAULT_TRUSTED_HOSTS];

    try {
        const envVal = process.env.TRUSTED_EXTERNAL_HOSTS;
        if (envVal && typeof envVal === 'string' && envVal.trim().length > 0) {
            const parsed = envVal
                .split(',')
                .map(h => h.trim().toLowerCase())
                .filter(h => h.length > 0 && !h.includes('*'));

            if (parsed.length > 0) {
                hosts = parsed;
                console.log('✅ TRUSTED_EXTERNAL_HOSTS loaded from env (' + parsed.length + ' hosts)');
            }
        }
    } catch (e) {
        console.warn('⚠️ Failed to parse TRUSTED_EXTERNAL_HOSTS:', e.message);
    }

    try {
        const endpoint = process.env.TRACKING_ENDPOINT;
        if (endpoint && typeof endpoint === 'string' && endpoint.startsWith('https://')) {
            const u = new URL(endpoint);
            const host = u.hostname.toLowerCase();
            if (host && host.length > 0 && !hosts.includes(host)) {
                hosts.push(host);
                console.log('✅ Auto-trusted TRACKING_ENDPOINT host:', host);
            }
        }
    } catch (e) {}

    console.log('ℹ️ Trusted hosts total:', hosts.length);
    return hosts;
})();

// ============================================================
// ⚙️ COMMAND LINE SWITCHES
// ============================================================
app.commandLine.appendSwitch('high-dpi-support', '1');

if (process.env.NODE_ENV !== 'production' && !app.isPackaged) {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

// ============================================================
// 📊 GLOBAL STATE
// ============================================================
let mainWindow = null;
let _cacheClearedForVersion = null;
let _currentZoom = DEFAULT_ZOOM_FACTOR;
let _didFailCount = 0;
let _lastFailTime = 0;

// ============================================================
// 🔒 SINGLE INSTANCE LOCK
// ============================================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('⚠️ Another instance already running — quitting');
    app.exit(0);
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });
}

// ============================================================
// 📊 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('🚀 Hoṛ Katha Suite starting...');
console.log('📦 Packaged:', app.isPackaged);
console.log('🔧 NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('🔒 Strict encryption:', getStrictEncryptionMode() ? 'ON' : 'OFF (default)');
if (!app.isPackaged) {
    console.log('📁 __dirname:', __dirname);
}
console.log('⚡ Electron:', process.versions.electron);
console.log('🟢 Node:', process.versions.node);
console.log('🌐 Chrome:', process.versions.chrome);
console.log('🖥️  Platform:', process.platform);
console.log('🔧 Arch:', process.arch);
console.log('🔍 Default zoom:', DEFAULT_ZOOM_FACTOR);
console.log('🌐 Trusted hosts:', TRUSTED_EXTERNAL_HOSTS.length);
console.log('🔐 Encryption mode: Option A (sanitized HWID passphrase)');
console.log('═══════════════════════════════════════════');

// ============================================================
// 🔒 CUSTOM PROTOCOL — local-asset://
// ============================================================
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'local-asset',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true
        }
    }
]);

// ============================================================
// 📂 FIND index.html
// ============================================================
function findIndexHtml() {
    const resourcesPath = process.resourcesPath || '';
    const candidates = [
        path.join(__dirname, 'index.html'),
        path.join(app.getAppPath(), 'index.html')
    ];

    if (resourcesPath) {
        candidates.push(
            path.join(resourcesPath, 'app.asar', 'index.html'),
            path.join(resourcesPath, 'app', 'index.html')
        );
    }

    for (const candidate of candidates) {
        try {
            if (candidate && fs.existsSync(candidate)) {
                console.log('✅ Found index.html:', candidate);
                return candidate;
            }
        } catch (e) {}
    }

    console.error('❌ index.html not found');
    return null;
}

// ============================================================
// 🔍 FIND preload.js
// ============================================================
function findPreloadJs() {
    const candidates = [
        path.join(__dirname, 'preload.js'),
        path.join(app.getAppPath(), 'preload.js')
    ];

    if (process.resourcesPath) {
        candidates.push(
            path.join(process.resourcesPath, 'app.asar', 'preload.js'),
            path.join(process.resourcesPath, 'app', 'preload.js')
        );
    }

    for (const candidate of candidates) {
        try {
            if (candidate && fs.existsSync(candidate)) return candidate;
        } catch (e) {}
    }

    return null;
}

// ============================================================
// 💾 HWID STORAGE PATHS
// ============================================================
function getHwidFilePath() {
    try {
        return path.join(app.getPath('userData'), 'device_hwid.txt');
    } catch (e) {
        console.warn('⚠️ getPath(userData) failed:', e.message);
        return null;
    }
}

function getHwidBackupPath() {
    try {
        return path.join(app.getPath('userData'), 'device_hwid.backup.txt');
    } catch (e) {
        console.warn('⚠️ getPath(userData) failed:', e.message);
        return null;
    }
}

function getHwidLegacyBackupPath() {
    try {
        return path.join(app.getPath('userData'), '.hwid_backup.txt');
    } catch (e) {
        return null;
    }
}

// ============================================================
// 💾 REGISTRY — Windows HWID Storage
// ============================================================
function saveHwidToRegistry(hwid) {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') return resolve(false);

        const safeHwid = sanitizeHwid(hwid);
        if (!safeHwid || !isValidHwidFormat(safeHwid)) {
            console.warn('⚠️ Registry save skipped — invalid HWID');
            return resolve(false);
        }

        const args = [
            'add', 'HKCU\\Software\\BOSCTech\\HorKatha',
            '/v', 'DeviceId', '/t', 'REG_SZ', '/d', safeHwid, '/f'
        ];

        execFile('reg', args, {
            windowsHide: true,
            timeout: REG_TIMEOUT_MS,
            killSignal: 'SIGTERM'
        }, (error) => {
            if (error) {
                console.warn('⚠️ Registry save failed:', error.message);
                return resolve(false);
            }
            console.log('💾 HWID saved to Registry');
            resolve(true);
        });
    });
}

function loadHwidFromRegistry() {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') return resolve(null);

        const args = ['query', 'HKCU\\Software\\BOSCTech\\HorKatha', '/v', 'DeviceId'];

        execFile('reg', args, {
            encoding: 'utf-8',
            windowsHide: true,
            timeout: REG_TIMEOUT_MS,
            killSignal: 'SIGTERM'
        }, (error, stdout) => {
            if (error) return resolve(null);

            const match = String(stdout).match(/DeviceId\s+REG_SZ\s+(.+?)\s*$/m);
            if (match && match[1]) {
                const hwid = sanitizeHwid(match[1]);
                if (!hwid || !isValidHwidFormat(hwid)) {
                    console.warn('⚠️ Registry HWID format invalid');
                    return resolve(null);
                }
                console.log('📖 HWID loaded from Registry');
                return resolve(hwid);
            }
            resolve(null);
        });
    });
}

function deleteHwidFromRegistry() {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') return resolve(false);

        const args = ['delete', 'HKCU\\Software\\BOSCTech\\HorKatha', '/f'];

        execFile('reg', args, {
            windowsHide: true,
            timeout: REG_TIMEOUT_MS,
            killSignal: 'SIGTERM'
        }, (error) => {
            resolve(!error);
        });
    });
}

// ============================================================
// 💾 FILE — Cross-platform HWID Storage
// ============================================================
async function saveHwidToFile(hwid) {
    try {
        const safeHwid = sanitizeHwid(hwid);
        if (!safeHwid || !isValidHwidFormat(safeHwid)) {
            console.warn('⚠️ File save skipped — invalid HWID');
            return false;
        }

        const filePath = getHwidFilePath();
        const backupPath = getHwidBackupPath();
        if (!filePath || !backupPath) return false;

        await fs.promises.writeFile(filePath, safeHwid, { encoding: 'utf-8' });
        await fs.promises.writeFile(backupPath, safeHwid, { encoding: 'utf-8' });
        console.log('💾 HWID saved to file');
        return true;
    } catch (e) {
        console.warn('⚠️ File save failed:', e.message);
        return false;
    }
}

async function loadHwidFromFile() {
    try {
        const tryRead = async (p) => {
            if (!p || !fs.existsSync(p)) return null;
            const raw = (await fs.promises.readFile(p, 'utf-8')).trim();
            const hwid = sanitizeHwid(raw);
            if (hwid && isValidHwidFormat(hwid)) return hwid;
            return null;
        };

        let hwid = await tryRead(getHwidFilePath());
        if (hwid) {
            console.log('📖 HWID loaded from file');
            return hwid;
        }

        hwid = await tryRead(getHwidBackupPath());
        if (hwid) {
            console.log('📖 HWID loaded from backup');
            return hwid;
        }

        hwid = await tryRead(getHwidLegacyBackupPath());
        if (hwid) {
            console.log('📖 HWID loaded from legacy backup');
            return hwid;
        }
    } catch (e) {
        console.warn('⚠️ File load failed:', e.message);
    }
    return null;
}

// ============================================================
// 💾 AGGREGATE
// ============================================================
async function saveHwidEverywhere(hwid) {
    const safeHwid = sanitizeHwid(hwid);
    if (!safeHwid || !isValidHwidFormat(safeHwid)) {
        return { success: false, hwid: null, file: false, registry: false };
    }

    const [fileResult, registryResult] = await Promise.allSettled([
        saveHwidToFile(safeHwid),
        saveHwidToRegistry(safeHwid)
    ]);

    const fileOk = fileResult.status === 'fulfilled' && fileResult.value === true;
    const registryOk = registryResult.status === 'fulfilled' && registryResult.value === true;

    return { success: fileOk || registryOk, hwid: safeHwid, file: fileOk, registry: registryOk };
}

async function loadHwidFromAnywhere() {
    let hwid = await loadHwidFromRegistry();
    if (hwid) return { hwid, source: 'registry' };

    hwid = await loadHwidFromFile();
    if (hwid) return { hwid, source: 'file' };

    return { hwid: null, source: 'none' };
}

// ============================================================
// 🛡️ IPC SENDER VALIDATION
// ============================================================
function isTrustedIpcSender(event) {
    try {
        const frame = event.senderFrame;
        if (!frame || !frame.url) return false;
        const url = String(frame.url);

        if (url.startsWith('file://')) return true;
        if (url.startsWith('local-asset://')) return true;
        if (url.startsWith('data:text/html;charset=utf-8,')) {
            try {
                const decoded = decodeURIComponent(url);
                // ✅ FIX 2: Use INTERNAL_MARKER constant
                if (decoded.includes(INTERNAL_MARKER)) return true;
            } catch (e) {}
        }
        return false;
    } catch (e) {
        return false;
    }
}

function _rejectUntrusted(event, tag) {
    console.warn('🚫 [' + tag + '] Rejected untrusted IPC sender');
    return { success: false, error: 'UNTRUSTED_SENDER' };
}

// ============================================================
// 📡 IPC HANDLERS — HWID
// ============================================================
ipcMain.handle('hwid-save', async (event, hwid) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'hwid-save');
    try {
        const safeHwid = sanitizeHwid(hwid);
        if (!safeHwid || !isValidHwidFormat(safeHwid)) {
            return { success: false, error: 'Invalid HWID format' };
        }

        const result = await saveHwidEverywhere(safeHwid);

        if (!result.success) {
            return {
                success: false,
                error: 'Failed to save HWID to any storage layer',
                file: result.file,
                registry: result.registry
            };
        }

        return {
            success: true,
            hwid: result.hwid,
            isFallbackSeed: isFallbackSeed(result.hwid),
            file: result.file,
            registry: result.registry
        };
    } catch (e) {
        console.error('❌ hwid-save failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('hwid-load', async (event) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'hwid-load');
    try {
        const result = await loadHwidFromAnywhere();
        return {
            success: true,
            hwid: result.hwid,
            source: result.source,
            isFallbackSeed: result.hwid ? isFallbackSeed(result.hwid) : false
        };
    } catch (e) {
        console.error('❌ hwid-load failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('hwid-delete', async (event) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'hwid-delete');
    try {
        let fileDeleted = false;
        let backupDeleted = false;
        let legacyBackupDeleted = false;
        let registryDeleted = false;

        const filePath = getHwidFilePath();
        if (filePath && fs.existsSync(filePath)) {
            try { await fs.promises.unlink(filePath); fileDeleted = true; }
            catch (e) { console.warn('⚠️ Primary file delete failed:', e.message); }
        }

        const backupPath = getHwidBackupPath();
        if (backupPath && fs.existsSync(backupPath)) {
            try { await fs.promises.unlink(backupPath); backupDeleted = true; }
            catch (e) { console.warn('⚠️ Backup file delete failed:', e.message); }
        }

        const legacyPath = getHwidLegacyBackupPath();
        if (legacyPath && fs.existsSync(legacyPath)) {
            try { await fs.promises.unlink(legacyPath); legacyBackupDeleted = true; }
            catch (e) { console.warn('⚠️ Legacy backup delete failed:', e.message); }
        }

        registryDeleted = await deleteHwidFromRegistry();

        console.log('🗑️ HWID deleted — file:', fileDeleted, 'backup:', backupDeleted,
            'legacyBackup:', legacyBackupDeleted, 'registry:', registryDeleted);

        return {
            success: true,
            file: fileDeleted,
            backup: backupDeleted,
            legacyBackup: legacyBackupDeleted,
            registry: registryDeleted
        };
    } catch (e) {
        console.error('❌ hwid-delete failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('hwid-validate', async (event, hwid) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'hwid-validate');
    try {
        const safeHwid = sanitizeHwid(hwid);
        const valid = isValidHwidFormat(safeHwid);
        return {
            success: true,
            valid,
            sanitized: safeHwid,
            isFallbackSeed: valid ? isFallbackSeed(safeHwid) : false
        };
    } catch (e) {
        console.error('❌ hwid-validate failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('app-version', async () => {
    try {
        return {
            success: true,
            version: app.getVersion(),
            electron: process.versions.electron,
            node: process.versions.node,
            chrome: process.versions.chrome,
            platform: process.platform,
            arch: process.arch,
            isPackaged: app.isPackaged,
            cryptoVersion: 'v2'
        };
    } catch (e) {
        console.error('❌ app-version failed:', e);
        return { success: false, error: e.message };
    }
});

// ============================================================
// 🔐 CRYPTO — DERIVE KEY (ASYNC)
// ============================================================
function deriveKeyAsync(passphrase) {
    const salt = ENCRYPTION_CONSTANTS.SALT_PREFIX + passphrase;
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(
            passphrase,
            salt,
            ENCRYPTION_CONSTANTS.PBKDF2_ITERATIONS,
            ENCRYPTION_CONSTANTS.KEY_LENGTH,
            ENCRYPTION_CONSTANTS.HASH_ALGO,
            (err, key) => {
                if (err) reject(err);
                else resolve(key);
            }
        );
    });
}

// ============================================================
// 🔐 IPC HANDLER — ENCRYPT NAME (AES-256-GCM)
// ============================================================
ipcMain.handle('encrypt-name', async (event, name, hwid) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'encrypt-name');
    try {
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            console.warn('[encrypt-name] Rejected: invalid name');
            return { success: false, error: 'INVALID_NAME' };
        }

        const safeName = String(name).trim().substring(0, 500);
        if (safeName.length === 0) {
            console.warn('[encrypt-name] Rejected: name became empty after trim');
            return { success: false, error: 'INVALID_NAME' };
        }

        if (!hwid || typeof hwid !== 'string') {
            console.warn('[encrypt-name] Rejected: HWID missing');
            return { success: false, error: 'HWID_REQUIRED' };
        }

        const normalizedHwid = sanitizeHwid(hwid);
        if (!normalizedHwid || !isValidHwidFormat(normalizedHwid)) {
            console.warn('[encrypt-name] Rejected: HWID invalid after normalization, len:',
                String(hwid).trim().length);
            return { success: false, error: 'HWID_INVALID' };
        }

        const key = await deriveKeyAsync(normalizedHwid);

        const iv = crypto.randomBytes(ENCRYPTION_CONSTANTS.IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        const ciphertext = Buffer.concat([
            cipher.update(safeName, 'utf8'),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        const combined = Buffer.concat([iv, ciphertext, authTag]);
        const base64Result = combined.toString('base64');

        console.log(
            '[encrypt-name] ✅ encrypted',
            '| name len:', safeName.length,
            '| seed:', isFallbackSeed(normalizedHwid) ? 'yes' : 'no',
            '| base64:', base64Result.length
        );

        return { success: true, encrypted: base64Result };

    } catch (e) {
        console.error('[encrypt-name] failed:', e.message);
        return { success: false, error: e.message };
    }
});

// ============================================================
// 🔍 ZOOM CONTROL
// ============================================================
ipcMain.handle('set-zoom', async (event, factor) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'set-zoom');
    try {
        if (mainWindow && mainWindow.webContents) {
            const f = Math.max(
                MIN_ZOOM_FACTOR,
                Math.min(MAX_ZOOM_FACTOR, Number(factor) || DEFAULT_ZOOM_FACTOR)
            );
            mainWindow.webContents.setZoomFactor(f);
            _currentZoom = f;
            console.log('🔍 Zoom set to:', f, '(' + Math.round(f * 100) + '%)');
            return { success: true, factor: f };
        }
        return { success: false, error: 'Window not ready' };
    } catch (e) {
        console.error('❌ set-zoom failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('get-zoom', async (event) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'get-zoom');
    try {
        if (mainWindow && mainWindow.webContents) {
            const factor = mainWindow.webContents.getZoomFactor();
            _currentZoom = factor;
            return { success: true, factor };
        }
        return { success: false, error: 'Window not ready', factor: DEFAULT_ZOOM_FACTOR };
    } catch (e) {
        return { success: false, error: e.message, factor: DEFAULT_ZOOM_FACTOR };
    }
});

console.log('✅ HWID + Zoom + Encrypt IPC handlers registered');

// ============================================================
// 🧪 CRYPTO ROUNDTRIP SELF-CHECK
// ============================================================
function verifyCryptoRoundtrip() {
    try {
        const testHwid = 'DVC-TEST-0000';
        const testName = 'roundtrip-test-' + Date.now();

        const salt = ENCRYPTION_CONSTANTS.SALT_PREFIX + testHwid;
        const key = crypto.pbkdf2Sync(
            testHwid, salt,
            ENCRYPTION_CONSTANTS.PBKDF2_ITERATIONS,
            ENCRYPTION_CONSTANTS.KEY_LENGTH,
            ENCRYPTION_CONSTANTS.HASH_ALGO
        );

        const iv = crypto.randomBytes(ENCRYPTION_CONSTANTS.IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const ct = Buffer.concat([cipher.update(testName, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        const combined = Buffer.concat([iv, ct, tag]);

        const decIv = combined.subarray(0, ENCRYPTION_CONSTANTS.IV_LENGTH);
        const decCt = combined.subarray(
            ENCRYPTION_CONSTANTS.IV_LENGTH,
            combined.length - ENCRYPTION_CONSTANTS.AUTH_TAG_LENGTH
        );
        const decTag = combined.subarray(combined.length - ENCRYPTION_CONSTANTS.AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, decIv);
        decipher.setAuthTag(decTag);
        const dec = Buffer.concat([decipher.update(decCt), decipher.final()]).toString('utf8');

        if (dec !== testName) {
            console.error('❌ [crypto-check] Roundtrip FAILED — encryption broken');
            return false;
        }

        console.log('✅ [crypto-check] Crypto roundtrip OK (AES-256-GCM + PBKDF2-' +
            ENCRYPTION_CONSTANTS.PBKDF2_ITERATIONS + ')');
        return true;
    } catch (e) {
        console.error('❌ [crypto-check] Error:', e.message);
        return false;
    }
}

// ============================================================
// 🌐 URL VALIDATION
// ============================================================
function isTrustedExternalUrl(url) {
    if (!url || typeof url !== 'string') return false;

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }
        const host = parsed.hostname.toLowerCase();
        return TRUSTED_EXTERNAL_HOSTS.some(function(trusted) {
            return host === trusted || host.endsWith('.' + trusted);
        });
    } catch (e) {
        return false;
    }
}

function isInternalAppUrl(url) {
    if (!url || typeof url !== 'string') return false;

    if (url === 'about:blank' || url.startsWith('about:blank#') || url === 'about:srcdoc') {
        return true;
    }

    if (url.startsWith('data:text/html;charset=utf-8,')) {
        try {
            const encoded = url.substring('data:text/html;charset=utf-8,'.length);
            const decoded = decodeURIComponent(encoded);
            // ✅ FIX 2: Use INTERNAL_MARKER constant
            if (decoded.includes(INTERNAL_MARKER)) return true;
        } catch (e) {
            return false;
        }
    }

    return false;
}

// ============================================================
// 🆕 FIX 5: INTERNAL NAVIGATION URL CHECK
// ============================================================
// Allows file:// and local-asset:// pages (privacy, terms, manual)
// to be opened via window.open() or target="_blank" links.
//
// This is separate from isInternalAppUrl() because that function
// is specific to error pages (data:/about: URLs with marker).
// ============================================================
function isInternalNavigationUrl(url) {
    if (!url || typeof url !== 'string') return false;

    try {
        const parsed = new URL(url);

        // Allow file:// (packaged Electron loads via loadFile)
        if (parsed.protocol === 'file:') return true;

        // Allow local-asset:// (custom protocol for fonts/assets)
        if (parsed.protocol === 'local-asset:') return true;

        // Allow localhost (dev mode)
        const host = parsed.hostname || '';
        if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
            return true;
        }

        return false;
    } catch (e) {
        return false;
    }
}

function buildErrorPage(title, code, desc) {
    // ✅ FIX 2: Use INTERNAL_SIGNATURE constant
    return `<!DOCTYPE html>
<html ${INTERNAL_SIGNATURE}>
<head><meta charset="utf-8"><title>${escHtml(title)}</title></head>
<body style="font-family:sans-serif;padding:40px;background:#0d1117;color:#c9d1d9;">
<h1 style="color:#ef4444;">⚠️ ${escHtml(title)}</h1>
<p><b>Error Code:</b> ${escHtml(code)}</p>
<p><b>Description:</b> ${escHtml(desc)}</p>
<button onclick="location.reload()" style="padding:10px 20px; background:#1f6feb; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; margin-top:16px;">🔄 Retry</button>
</body></html>`;
}

// ============================================================
// 🌐 SETUP SESSION
// ============================================================
async function setupSession() {
    try {
        try {
            protocol.handle('local-asset', async (request) => {
                try {
                    const url = new URL(request.url);
                    const assetPath = url.pathname.replace(/^\/+/, '');

                    if (assetPath.includes('..') || assetPath.includes('\0')) {
                        console.warn('🚫 Path traversal attempt blocked:', assetPath);
                        return new Response('Forbidden', { status: 403 });
                    }

                    const indexPath = findIndexHtml();
                    const appRoot = indexPath ? path.dirname(indexPath) : __dirname;
                    const fullPath = path.join(appRoot, assetPath);

                    const normalizedFull = path.normalize(fullPath);
                    const normalizedRoot = path.normalize(appRoot);

                    const rel = path.relative(normalizedRoot, normalizedFull);
                    if (rel.startsWith('..') || path.isAbsolute(rel)) {
                        console.warn('🚫 Out-of-root access blocked:', normalizedFull);
                        return new Response('Forbidden', { status: 403 });
                    }

                    if (!fs.existsSync(normalizedFull)) {
                        return new Response('Not Found', { status: 404 });
                    }

                    const data = await fs.promises.readFile(normalizedFull);
                    const ext = path.extname(normalizedFull).toLowerCase();

                    const mimeTypes = {
                        '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
                        '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject',
                        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
                        '.webp': 'image/webp', '.bmp': 'image/bmp',
                        '.js': 'application/javascript; charset=utf-8',
                        '.mjs': 'application/javascript; charset=utf-8',
                        '.cjs': 'application/javascript; charset=utf-8',
                        '.css': 'text/css; charset=utf-8',
                        '.html': 'text/html; charset=utf-8',
                        '.htm': 'text/html; charset=utf-8',
                        '.json': 'application/json; charset=utf-8',
                        '.xml': 'application/xml; charset=utf-8',
                        '.txt': 'text/plain; charset=utf-8',
                        '.md': 'text/markdown; charset=utf-8',
                        '.csv': 'text/csv; charset=utf-8',
                        '.pdf': 'application/pdf',
                        '.wasm': 'application/wasm',
                        '.webmanifest': 'application/manifest+json',
                        '.map': 'application/json; charset=utf-8'
                    };
                    const contentType = mimeTypes[ext] || 'application/octet-stream';

                    return new Response(data, {
                        status: 200,
                        headers: {
                            'Content-Type': contentType,
                            'Cache-Control': 'public, max-age=31536000'
                        }
                    });
                } catch (e) {
                    console.warn('local-asset protocol error:', e.message);
                    return new Response('Internal Error', { status: 500 });
                }
            });
            console.log('✅ local-asset:// protocol handler registered');
        } catch (e) {
            console.warn('⚠️ Custom protocol handler setup failed:', e.message);
        }

        try {
            const CSP_VALUE =
                "default-src 'self' local-asset: " +
                "https://fonts.googleapis.com https://fonts.gstatic.com " +
                "https://cdnjs.cloudflare.com https://unpkg.com " +
                "https://www.gstatic.com https://api.qrserver.com " +
                "https://quickchart.io https://formsubmit.co " +
                "https://*.firebaseio.com https://*.firebasedatabase.app " +
                "data: blob:; " +
                "script-src 'self' local-asset: 'unsafe-inline' " +
                "https://cdnjs.cloudflare.com https://unpkg.com " +
                "https://www.gstatic.com; " +
                "style-src 'self' local-asset: 'unsafe-inline' " +
                "https://fonts.googleapis.com; " +
                "font-src 'self' local-asset: data: https://fonts.gstatic.com; " +
                "img-src 'self' local-asset: data: https: blob:; " +
                "connect-src 'self' " +
                "https://*.firebaseio.com https://*.firebasedatabase.app " +
                "https://formsubmit.co https://api.qrserver.com " +
                "https://quickchart.io; " +
                "media-src 'self' local-asset: blob:; " +
                "manifest-src 'self'; " +
                "prefetch-src 'self' local-asset:; " +
                "object-src 'none'; " +
                "frame-src 'self' local-asset: about: blob:; " +
                "child-src 'self' local-asset: about: blob:; " +
                "worker-src 'self' blob:; " +
                "frame-ancestors 'self'; " +
                "base-uri 'self'; " +
                "form-action 'self' https://formsubmit.co;";

            session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                const url = details.url || '';

                const shouldApplyCsp =
                    url.startsWith('file://') ||
                    url.startsWith('local-asset://') ||
                    url.startsWith('data:') ||
                    url.startsWith('http://localhost') ||
                    url.startsWith('http://127.0.0.1') ||
                    url.startsWith('https://localhost') ||
                    url.startsWith('https://127.0.0.1');

                if (shouldApplyCsp) {
                    const headers = { ...details.responseHeaders };
                    headers['Content-Security-Policy'] = [CSP_VALUE];
                    delete headers['X-Frame-Options'];
                    delete headers['x-frame-options'];
                    callback({ responseHeaders: headers });
                } else {
                    callback({ responseHeaders: details.responseHeaders });
                }
            });

            console.log('✅ CSP headers configured');
        } catch (e) {
            console.warn('⚠️ CSP header setup failed:', e.message);
        }

        const ALLOWED_PERMISSIONS = [
            'microphone', 'clipboard-read', 'clipboard-write', 'notifications'
        ];

        try {
            session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
                const isAllowed = ALLOWED_PERMISSIONS.includes(permission);
                if (!isAllowed) console.log('🚫 Permission denied:', permission);
                callback(isAllowed);
            });

            session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
                return ALLOWED_PERMISSIONS.includes(permission);
            });

            console.log('✅ Session permissions configured');
        } catch (e) {
            console.warn('⚠️ Permission setup failed:', e.message);
        }
    } catch (e) {
        console.warn('⚠️ Session setup failed:', e.message);
    }
}

// ============================================================
// 🪟 CREATE WINDOW
// ============================================================
function createWindow() {
    console.log('🪟 Creating window...');

    Menu.setApplicationMenu(null);

    _didFailCount = 0;
    _lastFailTime = 0;

    let screenWidth = 1920;
    let screenHeight = 1080;
    try {
        const primaryDisplay = screen.getPrimaryDisplay();
        if (primaryDisplay && primaryDisplay.workAreaSize) {
            screenWidth = primaryDisplay.workAreaSize.width || 1920;
            screenHeight = primaryDisplay.workAreaSize.height || 1080;
        }
        console.log('🖥️ Screen size:', screenWidth, 'x', screenHeight);
    } catch (e) {
        console.warn('⚠️ Could not get screen size:', e.message);
    }

    const finalWidth = Math.min(1400, screenWidth);
    const finalHeight = Math.min(900, screenHeight);

    const preloadPath = findPreloadJs();
    if (!preloadPath) {
        console.error('❌ preload.js not found');
    } else {
        console.log('✅ preload.js found:', preloadPath);
    }

    mainWindow = new BrowserWindow({
        width: finalWidth,
        height: finalHeight,
        minWidth: 1200,
        minHeight: 700,
        center: true,
        title: "Hoṛ/हो़ड़ Katha Suite v3.7.4 Pro Ultra - BOSC Tech & Edu",
        autoHideMenuBar: true,
        show: false,
        resizable: true,
        fullscreenable: true,
        backgroundColor: '#0d1117',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            devTools: !app.isPackaged,
            spellcheck: false,
            backgroundThrottling: false,
            webviewTag: false,
            preload: preloadPath || path.join(__dirname, 'preload.js')
        }
    });

    const indexPath = findIndexHtml();

    if (!indexPath) {
        console.error('❌ Cannot find index.html');
        const errHtml = buildErrorPage('index.html not found', 'FILE_NOT_FOUND', 'Please check the installation.');
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errHtml));
    } else {
        console.log('📥 Loading:', indexPath);
        mainWindow.loadFile(indexPath).catch((err) => {
            console.error('❌ loadFile failed:', err);
        });
    }

    mainWindow.webContents.on('did-finish-load', () => {
        try {
            mainWindow.webContents.setZoomFactor(DEFAULT_ZOOM_FACTOR);
            _currentZoom = DEFAULT_ZOOM_FACTOR;
            console.log('🔍 Zoom applied:', DEFAULT_ZOOM_FACTOR);
            _didFailCount = 0;
            _lastFailTime = 0;
        } catch (e) {
            console.warn('⚠️ Zoom apply failed:', e.message);
        }
    });

    mainWindow.webContents.on('did-fail-load', (event, code, desc, url, isMainFrame) => {
        console.error('❌ Load failed:', code, desc, url);

        if (isMainFrame === false) return;

        const currentUrl = mainWindow ? mainWindow.webContents.getURL() : '';
        if (isInternalAppUrl(currentUrl)) return;

        const now = Date.now();
        if (now - _lastFailTime > FAIL_WINDOW_MS) _didFailCount = 0;
        _lastFailTime = now;
        _didFailCount++;

        if (_didFailCount > MAX_DID_FAIL) {
            console.error('🛑 Too many load failures — stopping error page loop');
            return;
        }

        const errHtml = buildErrorPage('Load Failed', code, desc);
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errHtml))
            .catch((err) => console.error('❌ Failed to load error page:', err));
    });

    setupConsoleMessageHandler(mainWindow);

    mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error('❌ Renderer crashed:', details);
    });

    // ============================================================
    // ✅ FIX 5: setWindowOpenHandler — Allow internal file://
    //          & local-asset:// pages (privacy, terms, manual)
    // ============================================================
    // Previously, this handler only allowed about:blank and data:
    // URLs, which meant window.open('privacy.html', '_blank') and
    // <a target="_blank"> would silently fail in Electron.
    //
    // Now, we check isInternalNavigationUrl() FIRST so that all
    // same-origin file:// / local-asset:// / localhost URLs open
    // in a new BrowserWindow instead of being denied.
    // ============================================================
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // ═══ 1. Allow internal navigation (file://, local-asset://, localhost) ═══
        if (isInternalNavigationUrl(url)) {
            console.log('✅ [window-open] Allowing internal URL:', url);
            return { action: 'allow' };
        }

        // ═══ 2. Allow internal error pages (about:/data: with marker) ═══
        if (isInternalAppUrl(url)) {
            return { action: 'allow' };
        }

        // ═══ 3. External trusted URL → open in default browser ═══
        if (isTrustedExternalUrl(url)) {
            shell.openExternal(url).catch((err) => {
                console.warn('⚠️ openExternal failed:', err.message);
            });
            return { action: 'deny' };
        }

        // ═══ 4. Untrusted URL → block + show warning toast ═══
        console.warn('🚫 Blocked untrusted external URL:', url);
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.executeJavaScript(
                `if (typeof showToast === 'function') showToast('🚫 External link blocked', 'warning', 3000);`
            ).catch(() => {});
        }
        return { action: 'deny' };
    });

    // ============================================================
    // 🛡️ will-navigate — Block external navigations
    // ============================================================
    mainWindow.webContents.on('will-navigate', (event, navUrl) => {
        try {
            if (isInternalAppUrl(navUrl)) return;

            const parsed = new URL(navUrl);

            // ✅ Allow same-origin navigation (file://, local-asset://, localhost)
            if (parsed.protocol === 'file:' || parsed.protocol === 'local-asset:') return;
            if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return;

            event.preventDefault();
            console.log('🚫 Blocked external nav:', navUrl);

            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                if (isTrustedExternalUrl(navUrl)) {
                    shell.openExternal(navUrl).catch(() => {});
                } else {
                    console.warn('🚫 Blocked untrusted external nav:', navUrl);
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.executeJavaScript(
                            `if (typeof showToast === 'function') showToast('🚫 Navigation blocked', 'warning', 2000);`
                        ).catch(() => {});
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ Invalid nav URL:', navUrl);
            event.preventDefault();
        }
    });

    // ============================================================
    // ⌨️ before-input-event — DevTools + Zoom shortcuts (dev only)
    // ============================================================
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (app.isPackaged) return;

        const keyRaw = (input && input.key) ? String(input.key) : '';
        const keyLower = keyRaw.toLowerCase();

        const isF12 = keyRaw === 'F12';
        const isCtrlShiftI = input.control && input.shift && keyLower === 'i';

        if (isF12 || isCtrlShiftI) {
            event.preventDefault();
            mainWindow.webContents.toggleDevTools();
        }

        if (input.control) {
            const code = (input && input.code) ? String(input.code) : '';
            const currentZoom = (function() {
                try { return mainWindow.webContents.getZoomFactor(); }
                catch (e) { return _currentZoom; }
            })();

            if (keyRaw === '+' || keyRaw === '=' || code === 'Equal' || code === 'NumpadAdd') {
                event.preventDefault();
                const next = Math.min(MAX_ZOOM_FACTOR, currentZoom + 0.05);
                mainWindow.webContents.setZoomFactor(next);
                _currentZoom = next;
                console.log('🔍 Zoom in:', next);
            } else if (keyRaw === '-' || code === 'Minus' || code === 'NumpadSubtract') {
                event.preventDefault();
                const next = Math.max(MIN_ZOOM_FACTOR, currentZoom - 0.05);
                mainWindow.webContents.setZoomFactor(next);
                _currentZoom = next;
                console.log('🔍 Zoom out:', next);
            } else if (keyRaw === '0' || code === 'Digit0' || code === 'Numpad0') {
                event.preventDefault();
                mainWindow.webContents.setZoomFactor(DEFAULT_ZOOM_FACTOR);
                _currentZoom = DEFAULT_ZOOM_FACTOR;
                console.log('🔍 Zoom reset:', DEFAULT_ZOOM_FACTOR);
            }
        }
    });

    mainWindow.once('ready-to-show', () => {
        console.log('✅ Window ready');
        mainWindow.show();
        mainWindow.maximize();
        mainWindow.focus();
        console.log('📐 Final window size:', mainWindow.getSize());
        console.log('📐 Is maximized:', mainWindow.isMaximized());
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ============================================================
// 📢 CONSOLE MESSAGE HANDLER
// ============================================================
function setupConsoleMessageHandler(win) {
    if (!win || !win.webContents) return;

    const LEVEL_MAP = {
        'verbose': 0, 'debug': 1, 'info': 2,
        'warning': 3, 'warn': 3, 'error': 4
    };

    win.webContents.on('console-message', (...args) => {
        let levelNum = 0;
        let msg = '';

        if (args.length >= 1 && typeof args[0] === 'object' && args[0] !== null && 'level' in args[0]) {
            const ev = args[0];
            const rawLevel = ev.level;

            if (typeof rawLevel === 'string') {
                levelNum = LEVEL_MAP[rawLevel.toLowerCase()] !== undefined
                    ? LEVEL_MAP[rawLevel.toLowerCase()]
                    : 2;
            } else if (typeof rawLevel === 'number') {
                levelNum = rawLevel;
            }

            msg = ev.message || '';
        } else {
            levelNum = args[1] || 0;
            msg = args[2] || '';
        }

        if (app.isPackaged) {
            if (levelNum >= 3) console.log('[Renderer]', msg);
        } else {
            console.log('[Renderer]', msg);
        }
    });
}

// ============================================================
// 📱 APP LIFECYCLE
// ============================================================
app.whenReady().then(async () => {
    console.log('✅ App ready');

    verifyCryptoRoundtrip();

    // ✅ FIX 1: Read strict mode AFTER env load
    const strictMode = getStrictEncryptionMode();
    const secretInfo = _resolveEncryptionSecret();

    if (app.isPackaged && !secretInfo.valid) {
        console.error('');
        console.error('═══════════════════════════════════════════');
        console.error('⚠️  NAME_ENCRYPTION_SECRET NOT AVAILABLE');
        console.error('───────────────────────────────────────────');
        console.error('   ℹ️  Option A mode:');
        console.error('   • Encryption: ✅ still works (sanitized HWID passphrase)');
        console.error('   • Startup gate: ⚠️ warnings only (non-strict)');
        console.error('');

        if (strictMode) {
            console.error('   🚨 STRICT MODE: STARTUP BLOCKED');
            console.error('═══════════════════════════════════════════');
            console.error('');

            try {
                dialog.showErrorBox(
                    'Configuration Error (Strict Mode)',
                    'APPLICATION CANNOT START\n\n' +
                    'Security configuration is incomplete.\n\n' +
                    'NAME_ENCRYPTION_SECRET is missing.\n\n' +
                    'Strict mode is enabled (HOR_STRICT_ENCRYPTION=true).\n\n' +
                    'Provide the secret via:\n' +
                    '  • .env.packaged file\n' +
                    '  • Environment variable\n' +
                    '  • CI/CD secrets\n\n' +
                    'Error Code: ENC_SECRET_MISSING_STRICT\n' +
                    'App Version: ' + app.getVersion()
                );
            } catch (e) {
                console.error('Could not show error dialog:', e.message);
            }

            app.exit(1);
            return;
        } else {
            console.warn('   ℹ️  Default mode: continuing (non-strict)');
            console.warn('═══════════════════════════════════════════');
            console.warn('');
        }
    } else if (secretInfo.valid) {
        console.log('🔐 Encryption secret resolved from:', secretInfo.source);
        console.log('   Length:', secretInfo.length, 'chars');
        console.log('   ℹ️  Option A: used for STARTUP GATE only');
        console.log('   🔐 Actual encryption: sanitized HWID as passphrase');
    }

    try {
        const currentVersion = app.getVersion();
        if (_cacheClearedForVersion !== currentVersion) {
            await session.defaultSession.clearCache();
            _cacheClearedForVersion = currentVersion;
            console.log('✅ Cache cleared (version ' + currentVersion + ')');
        } else {
            console.log('ℹ️ Cache already cleared for this version');
        }
    } catch (e) {
        console.warn('⚠️ Cache warning:', e.message);
    }

    await setupSession();

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}).catch((e) => {
    console.error('❌ app.whenReady failed:', e);
    try {
        dialog.showErrorBox('Startup Error', 'App failed to start:\n\n' + e.message);
    } catch (err) {}
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);

    if (app.isReady()) {
        try {
            setImmediate(() => {
                try {
                    dialog.showErrorBox(
                        'Unexpected Error',
                        'Hoṛ Katha Suite encountered an error:\n\n' +
                        (err.message || 'Unknown error') +
                        '\n\nThe app will continue.'
                    );
                } catch (e) {}
            });
        } catch (e) {}
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ main.js loaded — v3.7.4.96 (PRODUCTION-READY)');
console.log('   • 🟢 ENV: Smart override (OS env > .env.packaged > .env)');
console.log('   • 🟢 ENV: OS env vars protected (CI/CD friendly)');
console.log('   • 🟢 STRICT mode: read AFTER env load (FIX 1)');
console.log('   • 🟢 INTERNAL_SIGNATURE: used consistently (FIX 2)');
console.log('   • 🟢 window-open: file:// & local-asset:// allowed (FIX 5)');
console.log('   • 🔴 encrypt-name: sanitizeHwid() passphrase (matches storage)');
console.log('   • 🔴 sanitizeHwid: fallback seed support (16–' + ENCRYPTION_CONSTANTS.MAX_HWID_LENGTH + ' chars)');
console.log('   • 🔴 PBKDF2: async (non-blocking)');
console.log('   • 🟠 crypto roundtrip self-check');
console.log('   • 🟠 IPC senderFrame validation');
console.log('   • 🟡 sanitizeHwid: length-only logging');
console.log('   • 🟡 backup file: device_hwid.backup.txt (+ legacy .hwid_backup.txt fallback)');
console.log('   • 🟢 did-fail-load: isInternalAppUrl()');
console.log('   • 🟢 before-input-event: actual zoom factor');
console.log('   • Window: MAXIMIZED on launch');
console.log('   • Zoom: ' + DEFAULT_ZOOM_FACTOR);
console.log('   • 3-Layer HWID: Registry + File + Backup');
console.log('   • 🌐 Trusted hosts: ' + TRUSTED_EXTERNAL_HOSTS.length);
console.log('   • 🔐 HWID limit: ' + ENCRYPTION_CONSTANTS.MAX_HWID_LENGTH);
console.log('   • 🆕 Strict mode: HOR_STRICT_ENCRYPTION=' + (getStrictEncryptionMode() ? 'true' : 'false'));
console.log('   • 🆕 Anti-flap: did-fail-load guard (max ' + MAX_DID_FAIL + ', ' + (FAIL_WINDOW_MS / 1000) + 's window)');
console.log('   • 🆕 OS env snapshot: ' + _OS_ENV_SNAPSHOT.size + ' keys');
console.log('   • ⚠️  crypto-utils.js MUST use same sanitizeHwid logic');
console.log('═══════════════════════════════════════════');