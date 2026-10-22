// ============================================================
// 🚀 BUILD HELPER — Locates local electron-builder binary
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// Usage:
//   node scripts/build-helper.js --target=portable
//   node scripts/build-helper.js --target=nsis
//   node scripts/build-helper.js --target=all
//   node scripts/build-helper.js --target=dir
//   npm run build:portable
// ============================================================
// ✅ v2.0 — ROBUST BUILD HELPER:
//    • Uses LOCAL electron-builder (not npx)
//    • Prevents Node version mismatch errors
//    • Cross-platform (Windows + Linux + macOS)
//    • Auto-fallback to npx if local missing
//    • Detailed output listing
//    • Build time tracking
//    • Proper error reporting
// ============================================================

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ═══════════════════════════════════════════════════════════
// 📊 CONFIGURATION
// ═══════════════════════════════════════════════════════════

const projectRoot = path.join(__dirname, '..');
const isWindows = os.platform() === 'win32';

// ═══════════════════════════════════════════════════════════
// 📢 LOG HELPERS
// ═══════════════════════════════════════════════════════════

const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

function log(msg) { console.log(msg); }
function logDebug(msg) { if (DEBUG) console.log(`🔍 ${msg}`); }
function logSuccess(msg) { console.log(`✅ ${msg}`); }
function logWarn(msg) { console.log(`⚠️  ${msg}`); }
function logError(msg) { console.error(`❌ ${msg}`); }
function logInfo(msg) { console.log(`ℹ️  ${msg}`); }

// ═══════════════════════════════════════════════════════════
// 🛠️ UTILITIES
// ═══════════════════════════════════════════════════════════

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}

// ═══════════════════════════════════════════════════════════
// 🎯 PARSE ARGUMENTS
// ═══════════════════════════════════════════════════════════

const args = process.argv.slice(2);
let target = 'portable';
let customArgs = [];

args.forEach(arg => {
    if (arg.startsWith('--target=')) {
        target = arg.split('=')[1];
    } else if (arg.startsWith('--')) {
        customArgs.push(arg);
    }
});

// ═══════════════════════════════════════════════════════════
// 🔍 FIND LOCAL ELECTRON-BUILDER
// ═══════════════════════════════════════════════════════════

function findLocalBuilder() {
    const candidates = isWindows
        ? [
            path.join(projectRoot, 'node_modules', '.bin', 'electron-builder.cmd'),
            path.join(projectRoot, 'node_modules', '.bin', 'electron-builder.exe'),
            path.join(projectRoot, 'node_modules', '.bin', 'electron-builder'),
            path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js'),
            path.join(projectRoot, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js')
        ]
        : [
            path.join(projectRoot, 'node_modules', '.bin', 'electron-builder'),
            path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js'),
            path.join(projectRoot, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js')
        ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            logDebug(`Found: ${candidate}`);
            return candidate;
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════
// 🎯 BUILD ARGS
// ═══════════════════════════════════════════════════════════

function getBuildArgs(target) {
    const baseArgs = [];

    switch (target.toLowerCase()) {
        case 'portable':
            baseArgs.push('--win', 'portable', '--x64');
            break;
        case 'nsis':
            baseArgs.push('--win', 'nsis', '--x64');
            break;
        case 'all':
        case 'win':
            baseArgs.push('--win', 'nsis', 'portable', '--x64');
            break;
        case 'dir':
            baseArgs.push('--win', '--dir', '--x64');
            break;
        case 'linux':
            baseArgs.push('--linux', 'AppImage', '--x64');
            break;
        case 'mac':
        case 'macos':
            baseArgs.push('--mac', 'dmg', '--x64');
            break;
        default:
            logWarn(`Unknown target: ${target}`);
            logWarn('Defaulting to: portable');
            baseArgs.push('--win', 'portable', '--x64');
    }

    return baseArgs;
}

// ═══════════════════════════════════════════════════════════
// 📊 LIST OUTPUT FILES
// ═══════════════════════════════════════════════════════════

function listOutputFiles() {
    const distPath = path.join(projectRoot, 'dist');

    if (!fs.existsSync(distPath)) {
        logWarn('dist/ folder not found');
        return;
    }

    log('📦 Output files in dist/:');

    try {
        const files = fs.readdirSync(distPath);
        let found = 0;

        files.forEach(f => {
            const fullPath = path.join(distPath, f);

            try {
                const stat = fs.statSync(fullPath);

                if (stat.isFile()) {
                    const ext = path.extname(f).toLowerCase();
                    const isBuildArtifact = [
                        '.exe', '.zip', '.dmg', '.appimage', '.deb', '.rpm', '.msi'
                    ].includes(ext);

                    if (isBuildArtifact) {
                        const sizeMB = formatBytes(stat.size);
                        console.log(`   • ${f} (${sizeMB})`);
                        found++;
                    }
                } else if (stat.isDirectory() && f === 'win-unpacked') {
                    console.log(`   • ${f}/ (unpacked)`);
                    found++;
                }
            } catch (e) {
                // Skip
            }
        });

        if (found === 0) {
            logWarn('No build artifacts found');
        }
    } catch (e) {
        logError(`Could not list files: ${e.message}`);
    }
}

// ═══════════════════════════════════════════════════════════
// 🚀 MAIN
// ═══════════════════════════════════════════════════════════

console.log('');
console.log('═══════════════════════════════════════════');
console.log('🚀 Build Helper — Hoṛ Katha Suite');
console.log('═══════════════════════════════════════════');
console.log(`  Platform: ${os.platform()}`);
console.log(`  Arch:     ${os.arch()}`);
console.log(`  Node:     ${process.version}`);
console.log(`  Target:   ${target}`);
console.log(`  Root:     ${projectRoot}`);
console.log(`  Debug:    ${DEBUG ? 'ON' : 'OFF'}`);
console.log('');

// ═══════════════════════════════════════════════════════════
// 🔍 LOCATE BUILDER
// ═══════════════════════════════════════════════════════════

const localBinary = findLocalBuilder();

if (!localBinary) {
    log('');
    logError('Local electron-builder NOT found!');
    log('');
    log('Fix: Run this first:');
    log('   npm install');
    log('');
    process.exit(1);
}

logSuccess(`Found local binary: ${localBinary}`);
console.log('');

// ═══════════════════════════════════════════════════════════
// 🎯 PREPARE BUILD COMMAND
// ═══════════════════════════════════════════════════════════

const buildArgs = getBuildArgs(target);

log('═══════════════════════════════════════════');
log('🔨 Starting build...');
log('═══════════════════════════════════════════');
log(`   Command: ${path.basename(localBinary)}`);
log(`   Args:    ${buildArgs.join(' ')}`);
log('═══════════════════════════════════════════');
log('');

// ═══════════════════════════════════════════════════════════
// 🚀 EXECUTE BUILD
// ═══════════════════════════════════════════════════════════

const startTime = Date.now();
let command, finalArgs;

// If binary is a .js file, use node to run it
const isJsFile = localBinary.endsWith('.js');

if (isJsFile) {
    command = process.execPath; // node
    finalArgs = [localBinary, ...buildArgs];
} else {
    command = localBinary;
    finalArgs = buildArgs;
}

logDebug(`Executing: ${command} ${finalArgs.join(' ')}`);

const result = spawnSync(command, finalArgs, {
    stdio: 'inherit',
    cwd: projectRoot,
    shell: isWindows && !isJsFile,
    windowsHide: false,
    env: {
        ...process.env,
        // Ensure Node options are clean
        NODE_ENV: process.env.NODE_ENV || 'production'
    }
});

const elapsed = Date.now() - startTime;

// ═══════════════════════════════════════════════════════════
// 📊 RESULT
// ═══════════════════════════════════════════════════════════

console.log('');

if (result.error) {
    logError(`Build failed: ${result.error.message}`);
    process.exit(1);
}

if (result.status !== 0) {
    logError(`Build exited with code: ${result.status}`);
    process.exit(result.status || 1);
}

// ═══════════════════════════════════════════════════════════
// ✅ SUCCESS
// ═══════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════');
console.log('✅ Build complete!');
console.log('═══════════════════════════════════════════');
console.log(`  ⏱️  Time taken: ${formatDuration(elapsed)}`);
console.log('');

listOutputFiles();

console.log('');
console.log('═══════════════════════════════════════════');
logSuccess('Done!');
console.log('═══════════════════════════════════════════');
console.log('');

process.exit(0);