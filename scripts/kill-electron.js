// ============================================================
// 🛑 KILL ELECTRON PROCESSES (Cross-platform, Windows-safe)
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// Usage:
//   node scripts/kill-electron.js
//   npm run kill-electron
// ============================================================
// ✅ v2.0 — BETTER DETECTION:
//    • Fixed: "Not running" vs "Failed" detection
//    • Fixed: Windows taskkill error codes (128, 1, etc.)
//    • Better WMIC + PowerShell fallbacks
//    • Colored console output
//    • Silent mode via DEBUG env
// ============================================================

'use strict';

const { execSync, execFileSync } = require('child_process');
const os = require('os');

// ═══════════════════════════════════════════════════════════
// 📊 CONFIGURATION
// ═══════════════════════════════════════════════════════════

const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';
const isMac = os.platform() === 'darwin';

const WINDOWS_PROCESSES = [
    'electron.exe',
    'HorKathaSuitePro.exe',
    'Hor Katha Suite Pro.exe',
    'HorKatha.exe'
];

const UNIX_PROCESSES = [
    'electron',
    'HorKathaSuitePro',
    'Hor Katha Suite Pro',
    'HorKatha'
];

const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

// ═══════════════════════════════════════════════════════════
// 📢 LOG HELPERS
// ═══════════════════════════════════════════════════════════

function log(msg) { console.log(`[kill-electron] ${msg}`); }
function logDebug(msg) { if (DEBUG) console.log(`[kill-electron] 🔍 ${msg}`); }
function logSuccess(msg) { console.log(`[kill-electron] ✅ ${msg}`); }
function logWarn(msg) { console.log(`[kill-electron] ⚠️  ${msg}`); }
function logError(msg) { console.error(`[kill-electron] ❌ ${msg}`); }

// ═══════════════════════════════════════════════════════════
// 🔍 CHECK IF PROCESS IS RUNNING (Windows)
// ═══════════════════════════════════════════════════════════

function isProcessRunning(processName) {
    try {
        const stdout = execSync(`tasklist /FI "IMAGENAME eq ${processName}" /NH /FO CSV`, {
            encoding: 'utf-8',
            windowsHide: true,
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'ignore']
        });
        
        // If process is running, output contains the process name
        // If not, output contains "INFO: No tasks are running..."
        return stdout.toLowerCase().includes(processName.toLowerCase());
    } catch (e) {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════
// 🚀 MAIN
// ═══════════════════════════════════════════════════════════

console.log('');
console.log('═══════════════════════════════════════════');
console.log('🛑 Kill Electron Processes');
console.log('═══════════════════════════════════════════');
console.log(`  Platform: ${os.platform()}`);
console.log(`  Arch:     ${os.arch()}`);
console.log(`  Node:     ${process.version}`);
console.log(`  Debug:    ${DEBUG ? 'ON' : 'OFF'}`);
console.log('');

let killed = 0;
let failed = 0;
let notFound = 0;
let totalChecked = 0;

// ═══════════════════════════════════════════════════════════
// WINDOWS
// ═══════════════════════════════════════════════════════════

if (isWindows) {

    log('Scanning for Electron processes...');
    console.log('');

    // ─── Step 1: Check each process ───
    WINDOWS_PROCESSES.forEach(name => {
        totalChecked++;

        const running = isProcessRunning(name);
        
        if (!running) {
            logDebug(`Not running: ${name}`);
            notFound++;
            return;
        }

        // Process is running — try to kill it
        log(`Found running: ${name}`);

        try {
            execSync(`taskkill /F /IM "${name}" /T`, {
                stdio: 'ignore',
                windowsHide: true,
                timeout: 5000
            });
            logSuccess(`Killed: ${name}`);
            killed++;
        } catch (e) {
            // Process was running but couldn't be killed
            // (usually means it already exited between check and kill)
            if (isProcessRunning(name)) {
                logWarn(`Failed to kill: ${name}`);
                failed++;
            } else {
                logDebug(`Already exited: ${name}`);
                notFound++;
            }
        }
    });

    // ─── Step 2: WMIC fallback ───
    console.log('');
    log('Running WMIC fallback...');

    try {
        execSync(
            `wmic process where "name like '%electron%' or name like '%HorKatha%'" get name`,
            {
                stdio: 'ignore',
                windowsHide: true,
                timeout: 5000
            }
        );
        // If we got here, WMIC works but may or may not have found processes
        logDebug('WMIC scan completed');
    } catch (e) {
        logDebug('WMIC not available or no matching processes');
    }

    // ─── Step 3: PowerShell fallback ───
    console.log('');
    log('Running PowerShell fallback...');

    try {
        execSync(
            `powershell -NoProfile -Command "Get-Process | Where-Object { $_.ProcessName -match 'electron|HorKatha' } | Stop-Process -Force -ErrorAction SilentlyContinue"`,
            {
                stdio: 'ignore',
                windowsHide: true,
                timeout: 5000
            }
        );
        logSuccess('PowerShell cleanup completed');
    } catch (e) {
        logDebug('PowerShell fallback skipped');
    }

}

// ═══════════════════════════════════════════════════════════
// LINUX / macOS
// ═══════════════════════════════════════════════════════════

else if (isLinux || isMac) {

    log('Using Unix pkill...');
    console.log('');

    UNIX_PROCESSES.forEach(name => {
        totalChecked++;

        try {
            execSync(`pgrep -f "${name}"`, {
                stdio: 'ignore',
                timeout: 3000
            });

            // Process found — kill it
            try {
                execSync(`pkill -9 -f "${name}"`, {
                    stdio: 'ignore',
                    timeout: 5000
                });
                logSuccess(`Killed: ${name}`);
                killed++;
            } catch (e) {
                logWarn(`Failed to kill: ${name}`);
                failed++;
            }
        } catch (e) {
            logDebug(`Not running: ${name}`);
            notFound++;
        }
    });

}

// ═══════════════════════════════════════════════════════════
// UNKNOWN PLATFORM
// ═══════════════════════════════════════════════════════════

else {
    logWarn(`Unknown platform: ${os.platform()}`);
    logWarn('Skipping process kill');
    process.exit(0);
}

// ═══════════════════════════════════════════════════════════
// 📊 SUMMARY
// ═══════════════════════════════════════════════════════════

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📊 Summary');
console.log('═══════════════════════════════════════════');
console.log(`  Process types checked: ${totalChecked}`);
console.log(`  ✅ Killed:             ${killed}`);
console.log(`  ⏭️  Not running:        ${notFound}`);
console.log(`  ⚠️  Failed:             ${failed}`);
console.log('═══════════════════════════════════════════');
console.log('');

if (failed > 0) {
    logWarn('Some processes could not be killed');
    logWarn('Try running this script as Administrator');
    console.log('');
}

logSuccess('Done');
process.exit(0);