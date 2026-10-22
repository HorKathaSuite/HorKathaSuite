// ============================================================
// 🧹 CLEAN BUILD ARTIFACTS (Cross-platform)
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// Usage:
//   node scripts/clean.js
//   npm run clean
// ============================================================
// ✅ v2.0 — BETTER CLEANING:
//    • Cross-platform (Windows + Linux + macOS)
//    • Graceful retry on locked files
//    • Detailed reporting (removed/skipped/failed)
//    • Safe against missing directories
//    • Handles locked files (Electron running)
//    • Summary report at end
// ============================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ═══════════════════════════════════════════════════════════
// 📊 CONFIGURATION
// ═══════════════════════════════════════════════════════════

const projectRoot = path.join(__dirname, '..');

// Directories to remove (relative to project root)
const DIRS_TO_REMOVE = [
    'dist',                    // Build output
    'node_modules/.cache',     // Node cache
    'out',                     // Alternate build output
    'build-cache',             // Custom cache
    '.cache',                  // Generic cache
    'coverage',                // Test coverage
    'release'                  // Release builds
];

// Files to remove
const FILES_TO_REMOVE = [
    'build-error.log',
    'npm-debug.log',
    'yarn-error.log',
    '.DS_Store',
    'Thumbs.db'
];

// Retry settings
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 300;

// ═══════════════════════════════════════════════════════════
// 📢 LOG HELPERS
// ═══════════════════════════════════════════════════════════

const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

function log(msg) { console.log(`[clean] ${msg}`); }
function logDebug(msg) { if (DEBUG) console.log(`[clean] 🔍 ${msg}`); }
function logSuccess(msg) { console.log(`[clean] ✅ ${msg}`); }
function logWarn(msg) { console.log(`[clean] ⚠️  ${msg}`); }
function logError(msg) { console.error(`[clean] ❌ ${msg}`); }
function logSkip(msg) { console.log(`[clean] ⏭️  ${msg}`); }

// ═══════════════════════════════════════════════════════════
// 🛠️ UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Sleep helper (sync)
 */
function sleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        // Busy wait (only used for retry delay)
    }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get total size of a directory
 */
function getDirSize(dirPath) {
    let totalSize = 0;

    try {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            try {
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                    totalSize += getDirSize(itemPath);
                } else {
                    totalSize += stat.size;
                }
            } catch (e) {
                // Skip inaccessible files
            }
        }
    } catch (e) {
        // Directory not accessible
    }

    return totalSize;
}

/**
 * Remove directory with retries
 */
function removeDirWithRetries(dirPath, dirName) {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            fs.rmSync(dirPath, {
                recursive: true,
                force: true,
                maxRetries: 3,
                retryDelay: 100
            });
            return { success: true, attempts: attempt };
        } catch (e) {
            lastError = e;
            logDebug(`Attempt ${attempt}/${MAX_RETRIES} failed for ${dirName}: ${e.code || e.message}`);

            if (attempt < MAX_RETRIES) {
                sleep(RETRY_DELAY_MS);
            }
        }
    }

    return { success: false, attempts: MAX_RETRIES, error: lastError };
}

// ═══════════════════════════════════════════════════════════
// 🚀 MAIN
// ═══════════════════════════════════════════════════════════

console.log('');
console.log('═══════════════════════════════════════════');
console.log('🧹 Clean Build Artifacts');
console.log('═══════════════════════════════════════════');
console.log(`  Platform:     ${os.platform()}`);
console.log(`  Project Root: ${projectRoot}`);
console.log(`  Debug:        ${DEBUG ? 'ON' : 'OFF'}`);
console.log('');

// Stats
let dirsRemoved = 0;
let dirsSkipped = 0;
let dirsFailed = 0;
let filesRemoved = 0;
let filesSkipped = 0;
let filesFailed = 0;
let totalBytesFreed = 0;

// ═══════════════════════════════════════════════════════════
// 🗑️ REMOVE DIRECTORIES
// ═══════════════════════════════════════════════════════════

log('Removing directories...');
console.log('');

DIRS_TO_REMOVE.forEach(dir => {
    const fullPath = path.join(projectRoot, dir);

    // Check if exists
    if (!fs.existsSync(fullPath)) {
        logDebug(`Not found: ${dir}`);
        dirsSkipped++;
        return;
    }

    // Get size before removing
    let size = 0;
    try {
        size = getDirSize(fullPath);
    } catch (e) {
        logDebug(`Could not calculate size for: ${dir}`);
    }

    // Try to remove
    const result = removeDirWithRetries(fullPath, dir);

    if (result.success) {
        logSuccess(`Removed: ${dir} (${formatBytes(size)})`);
        dirsRemoved++;
        totalBytesFreed += size;
    } else {
        logError(`Failed: ${dir}`);
        logError(`         ${result.error.code || result.error.message}`);
        logWarn(`         Close all Electron windows and try again`);
        dirsFailed++;
    }
});

// ═══════════════════════════════════════════════════════════
// 🗑️ REMOVE FILES
// ═══════════════════════════════════════════════════════════

console.log('');
log('Removing files...');
console.log('');

FILES_TO_REMOVE.forEach(file => {
    const fullPath = path.join(projectRoot, file);

    if (!fs.existsSync(fullPath)) {
        logDebug(`Not found: ${file}`);
        filesSkipped++;
        return;
    }

    // Get size
    let size = 0;
    try {
        size = fs.statSync(fullPath).size;
    } catch (e) {}

    try {
        fs.unlinkSync(fullPath);
        logSuccess(`Removed: ${file} (${formatBytes(size)})`);
        filesRemoved++;
        totalBytesFreed += size;
    } catch (e) {
        logError(`Failed: ${file} — ${e.code || e.message}`);
        filesFailed++;
    }
});

// ═══════════════════════════════════════════════════════════
// 📊 SUMMARY
// ═══════════════════════════════════════════════════════════

console.log('');
console.log('═══════════════════════════════════════════');
console.log('📊 Summary');
console.log('═══════════════════════════════════════════');
console.log(`  📁 Directories:`);
console.log(`     ✅ Removed:  ${dirsRemoved}`);
console.log(`     ⏭️  Skipped:  ${dirsSkipped}`);
console.log(`     ❌ Failed:   ${dirsFailed}`);
console.log(`  📄 Files:`);
console.log(`     ✅ Removed:  ${filesRemoved}`);
console.log(`     ⏭️  Skipped:  ${filesSkipped}`);
console.log(`     ❌ Failed:   ${filesFailed}`);
console.log(`  💾 Space freed: ${formatBytes(totalBytesFreed)}`);
console.log('═══════════════════════════════════════════');
console.log('');

if (dirsFailed > 0 || filesFailed > 0) {
    logWarn('Some items could not be removed');
    logWarn('Make sure all Electron windows are closed');
    console.log('');
}

logSuccess('Done');
process.exit(0);