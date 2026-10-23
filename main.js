// ============================================================
// 🖥️ ELECTRON MAIN — HWID Persistent Storage (3-Layer)
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.98 — FULLY UPGRADED (LATEST)
//    🔴 FIX 1: STRICT_ENCRYPTION_MODE now reads AFTER env load
//    🔴 FIX 2: INTERNAL_SIGNATURE properly used
//    🔴 FIX 3: OS env vars preserved (CI/CD friendly)
//    🔴 FIX 4: .env.packaged overrides .env
//    🔴 FIX 5: setWindowOpenHandler allows internal URLs properly
//    🔴 FIX 6: Error page Retry button reloads actual index.html
//    🔴 FIX 7: STABLE HWID GENERATION (MachineGuid) - DVC ID never changes
// ============================================================

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const {
    app, BrowserWindow, Menu, session, shell,
    ipcMain, screen, dialog, protocol
} = require('electron');

const _OS_ENV_SNAPSHOT = new Set(Object.keys(process.env));

const DEFAULT_ZOOM_FACTOR = 1.25;
const MIN_ZOOM_FACTOR = 0.8;
const MAX_ZOOM_FACTOR = 2.0;
const REG_TIMEOUT_MS = 2500;
const MAX_DID_FAIL = 3;
const FAIL_WINDOW_MS = 30000;

const INTERNAL_SIGNATURE = 'data-bosc-internal="v3.7.4.98"';
const INTERNAL_MARKER = 'data-bosc-internal';

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

function getStrictEncryptionMode() {
    const val = String(process.env.HOR_STRICT_ENCRYPTION || '').toLowerCase().trim();
    return val === 'true' || val === '1' || val === 'yes';
}

// ============================================================
// 🛡️ HWID HELPERS
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
    if (hexOnlyMatch) return `DVC-${hexOnlyMatch[1].substring(0, 4)}-${hexOnlyMatch[1].substring(4, 8)}`;

    const pairMatch = upper.match(/^([A-F0-9]{4})[\s-]+([A-F0-9]{4})$/);
    if (pairMatch) return `DVC-${pairMatch[1]}-${pairMatch[2]}`;

    if (_isFallbackSeed(trimmed)) return trimmed;
    return '';
}

function isValidHwidFormat(hwid) {
    if (!hwid || typeof hwid !== 'string') return false;
    return DVC_CANONICAL_RE.test(hwid) || _isFallbackSeed(hwid);
}

function isFallbackSeed(hwid) {
    return !!hwid && !DVC_CANONICAL_RE.test(hwid) && _isFallbackSeed(hwid);
}

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================
// 🔐 ENV PARSING
// ============================================================
function parseEnvFile(filePath, { strict = false, override = false } = {}) {
    if (!filePath || !fs.existsSync(filePath)) return { loaded: 0, parsed: {} };
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        let loaded = 0, skipped = 0;
        const parsed = {};

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx < 0) continue;

            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();
            if (!key || !/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;

            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
            val = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\uFEFF/g, '').trim();
            if (val.length === 0) continue;

            const isOSEnv = _OS_ENV_SNAPSHOT.has(key);
            const isCurrentlySet = !!process.env[key];
            let shouldSet = false;

            if (!isCurrentlySet) shouldSet = true;
            else if (override && !isOSEnv) shouldSet = true;
            else skipped++;

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

(function loadEnvFile() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    try {
        const dotenv = require('dotenv');
        const result = dotenv.config({ path: envPath });
        if (result.error) parseEnvFile(envPath, { strict: true });
    } catch (e) { parseEnvFile(envPath, { strict: true }); }
})();

(function loadPackagedEnv() {
    try {
        const candidates = [];
        if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, '.env.packaged'));
        candidates.push(path.join(__dirname, '.env.packaged'));

        for (const candidate of candidates) {
            if (!candidate || !fs.existsSync(candidate)) continue;
            const result = parseEnvFile(candidate, { override: true });
            if (result.loaded > 0) console.log('✅ [main.js] .env.packaged loaded:', result.loaded, 'new vars');
            return;
        }
    } catch (e) { }
})();

function _isValidSecret(s) {
    if (!s || typeof s !== 'string') return false;
    const trimmed = s.trim();
    if (trimmed.length < 16) return false;
    if (/YOUR_|_HERE|REPLACE_|CHANGE_ME|PLACEHOLDER|EXAMPLE/i.test(trimmed)) return false;
    return true;
}

function _resolveEncryptionSecret() {
    const envSecret = process.env.NAME_ENCRYPTION_SECRET;
    if (_isValidSecret(envSecret)) return { secret: envSecret.trim(), source: 'process.env', valid: true, length: envSecret.trim().length };

    const candidates = [];
    if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, '.env.packaged'));
    candidates.push(path.join(__dirname, '.env.packaged'));

    for (const candidate of candidates) {
        try {
            if (!candidate || !fs.existsSync(candidate)) continue;
            const raw = fs.readFileSync(candidate, 'utf-8');
            const match = raw.match(/^\s*NAME_ENCRYPTION_SECRET\s*=\s*(.+)$/m);
            if (match && match[1]) {
                let val = match[1].trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
                if (_isValidSecret(val)) return { secret: val, source: 'packaged-file', valid: true, length: val.length, path: candidate };
            }
        } catch (e) { }
    }
    return { secret: null, source: 'none', valid: false, length: 0 };
}

const DEFAULT_TRUSTED_HOSTS = [
    'wa.me', 'whatsapp.com', 'api.whatsapp.com', 'web.whatsapp.com',
    'formsubmit.co', 'bosctech.in', 'hor-katha.vercel.app',
    'raw.githubusercontent.com', 'gist.githubusercontent.com',
    'api.qrserver.com', 'quickchart.io', 'googleapis.com',
    'gstatic.com', 'cloudflare.com', 'unpkg.com',
    'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'jsdelivr.net'
];

const TRUSTED_EXTERNAL_HOSTS = (function loadTrustedHosts() {
    let hosts = [...DEFAULT_TRUSTED_HOSTS];
    try {
        const envVal = process.env.TRUSTED_EXTERNAL_HOSTS;
        if (envVal && typeof envVal === 'string' && envVal.trim().length > 0) {
            const parsed = envVal.split(',').map(h => h.trim().toLowerCase()).filter(h => h.length > 0 && !h.includes('*'));
            if (parsed.length > 0) hosts = parsed;
        }
    } catch (e) { }
    try {
        const endpoint = process.env.TRACKING_ENDPOINT;
        if (endpoint && typeof endpoint === 'string' && endpoint.startsWith('https://')) {
            const u = new URL(endpoint);
            const host = u.hostname.toLowerCase();
            if (host && host.length > 0 && !hosts.includes(host)) hosts.push(host);
        }
    } catch (e) { }
    return hosts;
})();

app.commandLine.appendSwitch('high-dpi-support', '1');
if (process.env.NODE_ENV !== 'production' && !app.isPackaged) {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

let mainWindow = null;
let _cacheClearedForVersion = null;
let _currentZoom = DEFAULT_ZOOM_FACTOR;
let _didFailCount = 0;
let _lastFailTime = 0;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
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

protocol.registerSchemesAsPrivileged([
    { scheme: 'local-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

function findIndexHtml() {
    const resourcesPath = process.resourcesPath || '';
    const candidates = [
        path.join(__dirname, 'index.html'),
        path.join(app.getAppPath(), 'index.html')
    ];
    if (resourcesPath) {
        candidates.push(path.join(resourcesPath, 'app.asar', 'index.html'), path.join(resourcesPath, 'app', 'index.html'));
    }
    for (const candidate of candidates) {
        try { if (candidate && fs.existsSync(candidate)) return candidate; } catch (e) { }
    }
    return null;
}

function findPreloadJs() {
    const candidates = [
        path.join(__dirname, 'preload.js'),
        path.join(app.getAppPath(), 'preload.js')
    ];
    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'app.asar', 'preload.js'), path.join(process.resourcesPath, 'app', 'preload.js'));
    }
    for (const candidate of candidates) {
        try { if (candidate && fs.existsSync(candidate)) return candidate; } catch (e) { }
    }
    return null;
}

// ============================================================
// 💾 HWID STORAGE & STABLE GENERATOR
// ============================================================
function getHwidFilePath() { try { return path.join(app.getPath('userData'), 'device_hwid.txt'); } catch (e) { return null; } }
function getHwidBackupPath() { try { return path.join(app.getPath('userData'), 'device_hwid.backup.txt'); } catch (e) { return null; } }
function getHwidLegacyBackupPath() { try { return path.join(app.getPath('userData'), '.hwid_backup.txt'); } catch (e) { return null; } }

function saveHwidToRegistry(hwid) {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') return resolve(false);
        const safeHwid = sanitizeHwid(hwid);
        if (!safeHwid || !isValidHwidFormat(safeHwid)) return resolve(false);
        const args = ['add', 'HKCU\\Software\\BOSCTech\\HorKatha', '/v', 'DeviceId', '/t', 'REG_SZ', '/d', safeHwid, '/f'];
        execFile('reg', args, { windowsHide: true, timeout: REG_TIMEOUT_MS, killSignal: 'SIGTERM' }, (error) => resolve(!error));
    });
}

function loadHwidFromRegistry() {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') return resolve(null);
        const args = ['query', 'HKCU\\Software\\BOSCTech\\HorKatha', '/v', 'DeviceId'];
        execFile('reg', args, { encoding: 'utf-8', windowsHide: true, timeout: REG_TIMEOUT_MS, killSignal: 'SIGTERM' }, (error, stdout) => {
            if (error) return resolve(null);
            const match = String(stdout).match(/DeviceId\s+REG_SZ\s+(.+?)\s*$/m);
            if (match && match[1]) {
                const hwid = sanitizeHwid(match[1]);
                if (hwid && isValidHwidFormat(hwid)) return resolve(hwid);
            }
            resolve(null);
        });
    });
}

function deleteHwidFromRegistry() {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') return resolve(false);
        const args = ['delete', 'HKCU\\Software\\BOSCTech\\HorKatha', '/f'];
        execFile('reg', args, { windowsHide: true, timeout: REG_TIMEOUT_MS, killSignal: 'SIGTERM' }, (error) => resolve(!error));
    });
}

async function saveHwidToFile(hwid) {
    try {
        const safeHwid = sanitizeHwid(hwid);
        if (!safeHwid || !isValidHwidFormat(safeHwid)) return false;
        const filePath = getHwidFilePath();
        const backupPath = getHwidBackupPath();
        if (!filePath || !backupPath) return false;
        await fs.promises.writeFile(filePath, safeHwid, { encoding: 'utf-8' });
        await fs.promises.writeFile(backupPath, safeHwid, { encoding: 'utf-8' });
        return true;
    } catch (e) { return false; }
}

async function loadHwidFromFile() {
    try {
        const tryRead = async (p) => {
            if (!p || !fs.existsSync(p)) return null;
            const raw = (await fs.promises.readFile(p, 'utf-8')).trim();
            const hwid = sanitizeHwid(raw);
            return (hwid && isValidHwidFormat(hwid)) ? hwid : null;
        };
        let hwid = await tryRead(getHwidFilePath());
        if (hwid) return hwid;
        hwid = await tryRead(getHwidBackupPath());
        if (hwid) return hwid;
        hwid = await tryRead(getHwidLegacyBackupPath());
        if (hwid) return hwid;
    } catch (e) { }
    return null;
}

async function saveHwidEverywhere(hwid) {
    const safeHwid = sanitizeHwid(hwid);
    if (!safeHwid || !isValidHwidFormat(safeHwid)) return { success: false, hwid: null, file: false, registry: false };
    const [fileResult, registryResult] = await Promise.allSettled([saveHwidToFile(safeHwid), saveHwidToRegistry(safeHwid)]);
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

// 🆕 STABLE HWID GENERATOR (MachineGuid)
function getStableMachineId() {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') {
            try {
                const cpus = os.cpus();
                const nets = os.networkInterfaces();
                let mac = '';
                for (const name of Object.keys(nets)) {
                    for (const net of nets[name]) {
                        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') { mac = net.mac; break; }
                    }
                    if (mac) break;
                }
                return resolve([os.hostname(), os.userInfo().username, cpus[0]?.model || '', mac].join('|'));
            } catch (e) { return resolve(null); }
        }
        execFile('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf-8', windowsHide: true, timeout: 3000 }, (err, stdout) => {
            if (err || !stdout) {
                try {
                    const cpus = os.cpus();
                    const nets = os.networkInterfaces();
                    let mac = '';
                    for (const name of Object.keys(nets)) {
                        for (const net of nets[name]) {
                            if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') { mac = net.mac; break; }
                        }
                        if (mac) break;
                    }
                    return resolve([os.hostname(), os.userInfo().username, cpus[0]?.model || '', mac].join('|'));
                } catch (e) { return resolve(null); }
            }
            const match = stdout.match(/MachineGuid\s+REG_SZ\s+([a-f0-9-]+)/i);
            resolve(match && match[1] ? match[1] : null);
        });
    });
}

function hashToDvcId(input) {
    if (!input) return null;
    const hash = crypto.createHash('sha256').update(input).digest('hex').toUpperCase();
    return `DVC-${hash.substring(0, 4)}-${hash.substring(4, 8)}`;
}

async function getOrCreateStableHwid() {
    const existing = await loadHwidFromAnywhere();
    if (existing.hwid) return { hwid: existing.hwid, source: existing.source, isNew: false };

    const machineId = await getStableMachineId();
    if (!machineId) return { hwid: null, source: 'failed', isNew: false };

    const newHwid = hashToDvcId(machineId);
    if (!newHwid || !isValidHwidFormat(newHwid)) return { hwid: null, source: 'failed', isNew: false };

    const saveResult = await saveHwidEverywhere(newHwid);
    return { hwid: newHwid, source: 'generated', isNew: true, file: saveResult.file, registry: saveResult.registry };
}

// ============================================================
// 🛡️ IPC HANDLERS
// ============================================================
function isTrustedIpcSender(event) {
    try {
        const frame = event.senderFrame;
        if (!frame || !frame.url) return false;
        const url = String(frame.url);
        if (url.startsWith('file://') || url.startsWith('local-asset://')) return true;
        if (url.startsWith('data:text/html;charset=utf-8,')) {
            if (decodeURIComponent(url).includes(INTERNAL_MARKER)) return true;
        }
        return false;
    } catch (e) { return false; }
}

function _rejectUntrusted(event, tag) {
    return { success: false, error: 'UNTRUSTED_SENDER' };
}

ipcMain.handle('hwid-save', async (event, hwid) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'hwid-save');
    try {
        const safeHwid = sanitizeHwid(hwid);
        if (!safeHwid || !isValidHwidFormat(safeHwid)) return { success: false, error: 'Invalid HWID format' };
        const result = await saveHwidEverywhere(safeHwid);
        return { success: result.success, hwid: result.hwid, isFallbackSeed: isFallbackSeed(result.hwid), file: result.file, registry: result.registry };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('hwid-load', async (event) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'hwid-load');
    try {
        const result = await loadHwidFromAnywhere();
        return { success: true, hwid: result.hwid, source: result.source, isFallbackSeed: result.hwid ? isFallbackSeed(result.hwid) : false };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('hwid-get-stable', async (event) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'hwid-get-stable');
    try {
        const result = await getOrCreateStableHwid();
        return { success: !!result.hwid, hwid: result.hwid, source: result.source, isNew: result.isNew, isFallbackSeed: result.hwid ? isFallbackSeed(result.hwid) : false };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('hwid-delete', async (event) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'hwid-delete');
    try {
        let fileDeleted = false, backupDeleted = false, legacyBackupDeleted = false, registryDeleted = false;
        
        const filePath = getHwidFilePath();
        if (filePath && fs.existsSync(filePath)) {
            try { await fs.promises.unlink(filePath); fileDeleted = true; } catch (e) { }
        }
        const backupPath = getHwidBackupPath();
        if (backupPath && fs.existsSync(backupPath)) {
            try { await fs.promises.unlink(backupPath); backupDeleted = true; } catch (e) { }
        }
        const legacyPath = getHwidLegacyBackupPath();
        if (legacyPath && fs.existsSync(legacyPath)) {
            try { await fs.promises.unlink(legacyPath); legacyBackupDeleted = true; } catch (e) { }
        }
        registryDeleted = await deleteHwidFromRegistry();
        return { success: true, file: fileDeleted, backup: backupDeleted, legacyBackup: legacyBackupDeleted, registry: registryDeleted };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('hwid-validate', async (event, hwid) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'hwid-validate');
    try {
        const safeHwid = sanitizeHwid(hwid);
        const valid = isValidHwidFormat(safeHwid);
        return { success: true, valid, sanitized: safeHwid, isFallbackSeed: valid ? isFallbackSeed(safeHwid) : false };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('app-version', async () => {
    return { success: true, version: app.getVersion(), electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome, platform: process.platform, arch: process.arch, isPackaged: app.isPackaged, cryptoVersion: 'v2' };
});

function deriveKeyAsync(passphrase) {
    const salt = ENCRYPTION_CONSTANTS.SALT_PREFIX + passphrase;
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(passphrase, salt, ENCRYPTION_CONSTANTS.PBKDF2_ITERATIONS, ENCRYPTION_CONSTANTS.KEY_LENGTH, ENCRYPTION_CONSTANTS.HASH_ALGO, (err, key) => {
            if (err) reject(err); else resolve(key);
        });
    });
}

ipcMain.handle('encrypt-name', async (event, name, hwid) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'encrypt-name');
    try {
        if (!name || typeof name !== 'string' || name.trim().length === 0) return { success: false, error: 'INVALID_NAME' };
        const safeName = String(name).trim().substring(0, 500);
        if (!hwid || typeof hwid !== 'string') return { success: false, error: 'HWID_REQUIRED' };
        
        const normalizedHwid = sanitizeHwid(hwid);
        if (!normalizedHwid || !isValidHwidFormat(normalizedHwid)) return { success: false, error: 'HWID_INVALID' };

        const key = await deriveKeyAsync(normalizedHwid);
        const iv = crypto.randomBytes(ENCRYPTION_CONSTANTS.IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const ciphertext = Buffer.concat([cipher.update(safeName, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        const combined = Buffer.concat([iv, ciphertext, authTag]);
        
        return { success: true, encrypted: combined.toString('base64') };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('set-zoom', async (event, factor) => {
    if (!isTrustedIpcSender(event)) return _rejectUntrusted(event, 'set-zoom');
    try {
        if (mainWindow && mainWindow.webContents) {
            const f = Math.max(MIN_ZOOM_FACTOR, Math.min(MAX_ZOOM_FACTOR, Number(factor) || DEFAULT_ZOOM_FACTOR));
            mainWindow.webContents.setZoomFactor(f);
            _currentZoom = f;
            return { success: true, factor: f };
        }
        return { success: false, error: 'Window not ready' };
    } catch (e) { return { success: false, error: e.message }; }
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
    } catch (e) { return { success: false, error: e.message, factor: DEFAULT_ZOOM_FACTOR }; }
});

// ============================================================
// 🌐 URL VALIDATION
// ============================================================
function isTrustedExternalUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        return TRUSTED_EXTERNAL_HOSTS.some(trusted => host === trusted || host.endsWith('.' + trusted));
    } catch (e) { return false; }
}

function isInternalAppUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url === 'about:blank' || url.startsWith('about:blank#') || url === 'about:srcdoc') return true;
    if (url.startsWith('data:text/html;charset=utf-8,')) {
        try {
            if (decodeURIComponent(url.substring('data:text/html;charset=utf-8,'.length)).includes(INTERNAL_MARKER)) return true;
        } catch (e) { return false; }
    }
    return false;
}

function isInternalNavigationUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'file:' || parsed.protocol === 'local-asset:') return true;
        const host = parsed.hostname || '';
        if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
        return false;
    } catch (e) { return false; }
}

function buildErrorPage(title, code, desc) {
    return `<!DOCTYPE html>
<html ${INTERNAL_SIGNATURE}>
<head><meta charset="utf-8"><title>${escHtml(title)}</title></head>
<body style="font-family:sans-serif;padding:40px;background:#0d1117;color:#c9d1d9;text-align:center;">
<h1 style="color:#ef4444;">⚠️ ${escHtml(title)}</h1>
<p><b>Error Code:</b> ${escHtml(code)}</p>
<p><b>Description:</b> ${escHtml(desc)}</p>
<button onclick="window.location.href='local-asset://index.html'" style="padding:10px 20px; background:#1f6feb; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; margin-top:16px;">🔄 Retry</button>
</body></html>`;
}

async function setupSession() {
    try {
        protocol.handle('local-asset', async (request) => {
            try {
                const url = new URL(request.url);
                const assetPath = url.pathname.replace(/^\/+/, '');
                if (assetPath.includes('..') || assetPath.includes('\0')) return new Response('Forbidden', { status: 403 });

                const indexPath = findIndexHtml();
                const appRoot = indexPath ? path.dirname(indexPath) : __dirname;
                const fullPath = path.join(appRoot, assetPath);
                const normalizedFull = path.normalize(fullPath);
                const normalizedRoot = path.normalize(appRoot);
                const rel = path.relative(normalizedRoot, normalizedFull);

                if (rel.startsWith('..') || path.isAbsolute(rel)) return new Response('Forbidden', { status: 403 });
                if (!fs.existsSync(normalizedFull)) return new Response('Not Found', { status: 404 });

                const data = await fs.promises.readFile(normalizedFull);
                const ext = path.extname(normalizedFull).toLowerCase();
                const mimeTypes = { '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.otf': 'font/otf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8' };
                
                return new Response(data, { status: 200, headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000' } });
            } catch (e) { return new Response('Internal Error', { status: 500 }); }
        });

        const CSP_VALUE = "default-src 'self' local-asset: https://fonts.googleapis.com https://fonts.gstatic.com https://cdnjs.cloudflare.com https://unpkg.com https://www.gstatic.com https://api.qrserver.com https://quickchart.io https://formsubmit.co https://*.firebaseio.com https://*.firebasedatabase.app data: blob:; script-src 'self' local-asset: 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://www.gstatic.com; style-src 'self' local-asset: 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' local-asset: data: https://fonts.gstatic.com; img-src 'self' local-asset: data: https: blob:; connect-src 'self' https://*.firebaseio.com https://*.firebasedatabase.app https://formsubmit.co https://api.qrserver.com https://quickchart.io; media-src 'self' local-asset: blob:; manifest-src 'self'; prefetch-src 'self' local-asset:; object-src 'none'; frame-src 'self' local-asset: about: blob:; child-src 'self' local-asset: about: blob:; worker-src 'self' blob:; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://formsubmit.co;";

        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
            const url = details.url || '';
            if (url.startsWith('file://') || url.startsWith('local-asset://') || url.startsWith('data:') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
                const headers = { ...details.responseHeaders };
                headers['Content-Security-Policy'] = [CSP_VALUE];
                delete headers['X-Frame-Options'];
                delete headers['x-frame-options'];
                callback({ responseHeaders: headers });
            } else {
                callback({ responseHeaders: details.responseHeaders });
            }
        });

        const ALLOWED_PERMISSIONS = ['microphone', 'clipboard-read', 'clipboard-write', 'notifications'];
        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(ALLOWED_PERMISSIONS.includes(permission)));
        session.defaultSession.setPermissionCheckHandler((webContents, permission) => ALLOWED_PERMISSIONS.includes(permission));
    } catch (e) { console.warn('⚠️ Session setup failed:', e.message); }
}

function createWindow() {
    Menu.setApplicationMenu(null);
    _didFailCount = 0;
    _lastFailTime = 0;

    let screenWidth = 1920, screenHeight = 1080;
    try {
        const primaryDisplay = screen.getPrimaryDisplay();
        if (primaryDisplay && primaryDisplay.workAreaSize) {
            screenWidth = primaryDisplay.workAreaSize.width || 1920;
            screenHeight = primaryDisplay.workAreaSize.height || 1080;
        }
    } catch (e) { }

    const finalWidth = Math.min(1400, screenWidth);
    const finalHeight = Math.min(900, screenHeight);
    const preloadPath = findPreloadJs();

    mainWindow = new BrowserWindow({
        width: finalWidth, height: finalHeight, minWidth: 1200, minHeight: 700,
        center: true, title: "Hoṛ/हो़ड़ Katha Suite v3.7.4 Pro Ultra - BOSC Tech & Edu",
        autoHideMenuBar: true, show: false, resizable: true, fullscreenable: true, backgroundColor: '#0d1117',
        webPreferences: {
            nodeIntegration: false, contextIsolation: true, sandbox: false, webSecurity: true,
            allowRunningInsecureContent: false, devTools: !app.isPackaged, spellcheck: false,
            backgroundThrottling: false, webviewTag: false, preload: preloadPath || path.join(__dirname, 'preload.js')
        }
    });

    const indexPath = findIndexHtml();
    if (!indexPath) {
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildErrorPage('index.html not found', 'FILE_NOT_FOUND', 'Please check the installation.')));
    } else {
        mainWindow.loadFile(indexPath).catch(err => console.error('❌ loadFile failed:', err));
    }

    mainWindow.webContents.on('did-finish-load', () => {
        try {
            mainWindow.webContents.setZoomFactor(DEFAULT_ZOOM_FACTOR);
            _currentZoom = DEFAULT_ZOOM_FACTOR;
            _didFailCount = 0;
            _lastFailTime = 0;
        } catch (e) { }
    });

    mainWindow.webContents.on('did-fail-load', (event, code, desc, url, isMainFrame) => {
        if (isMainFrame === false) return;
        const currentUrl = mainWindow ? mainWindow.webContents.getURL() : '';
        if (isInternalAppUrl(currentUrl)) return;

        const now = Date.now();
        if (now - _lastFailTime > FAIL_WINDOW_MS) _didFailCount = 0;
        _lastFailTime = now;
        _didFailCount++;

        if (_didFailCount > MAX_DID_FAIL) return;

        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildErrorPage('Load Failed', code, desc))).catch(() => {});
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isInternalNavigationUrl(url)) {
            return { 
                action: 'allow',
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true, width: 1024, height: 768,
                    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false }
                }
            };
        }
        if (isInternalAppUrl(url)) return { action: 'allow' };
        if (isTrustedExternalUrl(url)) {
            shell.openExternal(url).catch(() => {});
            return { action: 'deny' };
        }
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, navUrl) => {
        try {
            if (isInternalAppUrl(navUrl)) return;
            const parsed = new URL(navUrl);
            if (parsed.protocol === 'file:' || parsed.protocol === 'local-asset:') return;
            if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return;

            event.preventDefault();
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                if (isTrustedExternalUrl(navUrl)) shell.openExternal(navUrl).catch(() => {});
            }
        } catch (e) { event.preventDefault(); }
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (app.isPackaged) return;
        const keyRaw = (input && input.key) ? String(input.key) : '';
        const isF12 = keyRaw === 'F12';
        const isCtrlShiftI = input.control && input.shift && keyRaw.toLowerCase() === 'i';

        if (isF12 || isCtrlShiftI) { event.preventDefault(); mainWindow.webContents.toggleDevTools(); }
        if (input.control) {
            const currentZoom = mainWindow.webContents.getZoomFactor();
            if (keyRaw === '+' || keyRaw === '=') {
                event.preventDefault(); mainWindow.webContents.setZoomFactor(Math.min(MAX_ZOOM_FACTOR, currentZoom + 0.05));
            } else if (keyRaw === '-') {
                event.preventDefault(); mainWindow.webContents.setZoomFactor(Math.max(MIN_ZOOM_FACTOR, currentZoom - 0.05));
            } else if (keyRaw === '0') {
                event.preventDefault(); mainWindow.webContents.setZoomFactor(DEFAULT_ZOOM_FACTOR);
            }
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
        mainWindow.focus();
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
    const strictMode = getStrictEncryptionMode();
    const secretInfo = _resolveEncryptionSecret();

    if (app.isPackaged && !secretInfo.valid && strictMode) {
        dialog.showErrorBox('Configuration Error (Strict Mode)', 'APPLICATION CANNOT START\n\nNAME_ENCRYPTION_SECRET is missing.');
        app.exit(1); return;
    }

    try {
        const currentVersion = app.getVersion();
        if (_cacheClearedForVersion !== currentVersion) {
            await session.defaultSession.clearCache();
            _cacheClearedForVersion = currentVersion;
        }
    } catch (e) { }

    await setupSession();
    createWindow();

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch((e) => {
    dialog.showErrorBox('Startup Error', 'App failed to start:\n\n' + e.message);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

process.on('uncaughtException', (err) => {
    if (app.isReady()) {
        setImmediate(() => {
            try { dialog.showErrorBox('Unexpected Error', 'Hoṛ Katha Suite encountered an error:\n\n' + (err.message || 'Unknown error') + '\n\nThe app will continue.'); } catch (e) { }
        });
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('═══════════════════════════════════════════');
console.log('✅ main.js loaded — v3.7.4.98 (PRODUCTION-READY)');
console.log('   • 🟢 ENV: Smart override (OS env > .env.packaged > .env)');
console.log('   • 🟢 Stable HWID Generator active (MachineGuid)');
console.log('   • 🟢 window-open: file:// & local-asset:// allowed');
console.log('   • 🟢 error page: retry uses local-asset://');
console.log('   • 🔴 encrypt-name: sanitizeHwid() passphrase');
console.log('   • 🟠 IPC senderFrame validation');
console.log('   • 🟢 Window: MAXIMIZED on launch');
console.log('   • 🌐 Trusted hosts: ' + TRUSTED_EXTERNAL_HOSTS.length);
console.log('   • ⚠️  crypto-utils.js MUST use same sanitizeHwid logic');
console.log('═══════════════════════════════════════════');