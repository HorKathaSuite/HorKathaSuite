// ============================================================
// 🔄 SERVICE WORKER — Cache + Offline Support (v20)
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v20 — PERFORMANCE & RELIABILITY FIXES:
//    • 🆕 SW_VERSION bumped 19 → 20 (force cache refresh)
//    • 🆕 REMOVED: ./js/qrcode.min.js from ASSETS_TO_CACHE
//             Reason: Redundant QR library. We now exclusively use
//                     the faster ./js/qr-offline.js
//    • 🆕 FIXED: Navigation fallback logic now uses `.endsWith()`
//             Reason: `.includes()` could fail if URL had query strings
//                     (e.g., /manual.html?ref=pwa). `.endsWith()` is safer.
//                     Also handles extensionless URLs like `/manual`.
//    • RETAINED: All previous fixes (terms.html cache, secret exclusion)
// ============================================================

// ⚠️ IMPORTANT: Bump this on EVERY significant change to:
//    • Any file in ASSETS_TO_CACHE
//    • Any JS logic (even if not cached)
//    • Any HTML/CSS in this project
//    Without bumping, users will keep old cached versions!
const SW_VERSION = '20';

const CACHE_NAME = `hor-katha-v374-cache-v${SW_VERSION}`;
const CACHE_PREFIX = 'hor-katha-v374-cache-';

// ─── Timeouts (milliseconds) ───
const NETWORK_TIMEOUT_MS = 10000;
const NAVIGATION_TIMEOUT_MS = 8000;
const CDN_TIMEOUT_MS = 12000;
const FONT_TIMEOUT_MS = 15000;

// ─── Size guards ───
const MAX_ASSET_SIZE_BYTES = 5 * 1024 * 1024;

// ─── Environment detection ───
const IS_DEV = (function detectDev() {
    try {
        const hostname = (self.location && self.location.hostname) || '';
        const protocol = (self.location && self.location.protocol) || '';
        return (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            protocol === 'file:'
        );
    } catch (e) {
        return false;
    }
})();

// ─── Logging helpers ───
function logSW(...args) {
    if (IS_DEV) console.log('[SW]', ...args);
}

function warnSW(...args) {
    console.warn('[SW]', ...args);
}

function errorSW(...args) {
    console.error('[SW]', ...args);
}

// ============================================================
// 🚫 SECRET FILE PATTERNS — NEVER CACHE (Fix #16)
// ============================================================
const SECRET_FILE_PATTERNS = [
    'config-private.local.js',
    'config-private.local.local.js',
    '.env',
    '.env.local',
    '.env.packaged',
    '.env.production',
    '.env.development',
    '.env.test',
    'secrets/',
    '.secret.js',
    '.private.js'
];

// ─── Exception: config-private.js is a TEMPLATE (safe to cache) ───
const SAFE_TEMPLATE_FILES = [
    'config-private.js'
];

// ============================================================
// 📦 ASSETS TO CACHE
// ============================================================
const ASSETS_TO_CACHE = [
    // ─── Core HTML ───
    './',
    './index.html',
    './manifest.json',
    './privacy.html',
    './terms.html',
    './verify.html',
    './manual.html',

    // ─── Stylesheets ───
    './css/style.css',
    './css/modals.css',
    './css/typing-test.css',
    './css/certificate.css',

    // ─── Core JS ───
    './js/config-private.js',      // ✅ Template (safe)
    './js/config.js',
    './js/keymaps.js',
    './js/audio.js',
    './js/crypto-utils.js',
    './js/tracker.js',
    './js/security.js',
    './js/license.js',
    './js/editor.js',
    './js/keyboard.js',
    './js/modals.js',
    './js/privacy.js',
    './js/app.js',
    './js/typing-test.js',
    './js/certificate.js',
    './js/print-generator.js',
    './js/alerts.js',
    './js/qr-offline.js',          // ✅ Only this QR library is used now

    // ─── Local fonts (offline) ───
    './assets/fonts/NotoSansDevanagari-Regular.ttf',
    './assets/fonts/NotoSansDevanagari-Bold.ttf',
    './assets/fonts/NotoSansOlChiki-Regular.ttf',
    './assets/fonts/NotoSansOlChiki-Bold.ttf',
    './assets/fonts/NotoSerifDevanagari-Regular.ttf',
    './assets/fonts/NotoSerifDevanagari-Bold.ttf',

    // ─── Icons (PWA) ───
    './assets/icon-192.png',
    './assets/icon-512.png',
    './assets/icon.ico'
];

// ============================================================
// 🛠️ HELPERS
// ============================================================

/**
 * Fetch with timeout + safe request cloning
 */
function fetchWithTimeout(request, timeoutMs = NETWORK_TIMEOUT_MS) {
    if (typeof AbortController === 'undefined') {
        return fetch(request);
    }

    return new Promise((resolve, reject) => {
        const controller = new AbortController();

        const timeoutId = setTimeout(() => {
            try {
                controller.abort();
            } catch (e) {}
            reject(new Error('Fetch timeout after ' + timeoutMs + 'ms'));
        }, timeoutMs);

        let req;
        try {
            req = new Request(request, { signal: controller.signal });
        } catch (e) {
            warnSW('Request clone failed, using original:', e.message);
            req = request;
        }

        let fetchPromise;
        try {
            fetchPromise = fetch(req);
        } catch (e) {
            clearTimeout(timeoutId);
            return reject(e);
        }

        fetchPromise.then(
            (response) => {
                clearTimeout(timeoutId);
                resolve(response);
            },
            (error) => {
                clearTimeout(timeoutId);
                reject(error);
            }
        );
    });
}

/**
 * Safe cache put (with size guard + secret exclusion)
 */
async function safeCachePut(cache, request, response) {
    try {
        if (!response || !response.ok) return false;

        try {
            const url = new URL(request.url);
            if (isSecretFile(url)) {
                logSW('Skipping secret file from cache:', url.pathname);
                return false;
            }
        } catch (e) {}

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_ASSET_SIZE_BYTES) {
            logSW('Skipping large asset:', request.url, '(' + contentLength + ' bytes)');
            return false;
        }

        await cache.put(request, response);
        return true;
    } catch (e) {
        warnSW('Cache put failed for', request.url, ':', e.message);
        return false;
    }
}

/**
 * Check if URL points to a secret file
 */
function isSecretFile(url) {
    try {
        const pathname = (url.pathname || '').toLowerCase();

        // Check safe templates first (they override secret patterns)
        for (const safe of SAFE_TEMPLATE_FILES) {
            if (pathname.endsWith('/' + safe) || pathname.endsWith(safe)) {
                if (!pathname.includes('.local.') &&
                    !pathname.includes('.local.local.')) {
                    return false;
                }
            }
        }

        // Check secret patterns
        for (const pattern of SECRET_FILE_PATTERNS) {
            if (pathname.includes(pattern)) {
                return true;
            }
        }

        return false;
    } catch (e) {
        return true;
    }
}

/**
 * Check if request should be excluded from cache
 */
function shouldSkipCache(url) {
    try {
        const pathname = url.pathname || '';

        if (isSecretFile(url)) {
            logSW('Skipping cache for secret file:', pathname);
            return true;
        }

        if (pathname.includes('/admin/')) {
            if (!IS_DEV) {
                return true;
            }
            const host = url.hostname;
            const selfHost = (self.location && self.location.hostname) || '';
            const isLocalDev =
                host === 'localhost' ||
                host === '127.0.0.1' ||
                host === selfHost;

            if (!isLocalDev) {
                return true;
            }
        }

        if (pathname.includes('/activations.json')) return true;

        return false;
    } catch (e) {
        return false;
    }
}

/**
 * Offline fallback HTML
 */
function getOfflineHTML() {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Offline — Hoṛ Katha Suite</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 40px 20px;
    background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
    color: #c9d1d9;
    text-align: center;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.6;
}
.offline-icon {
    font-size: 5rem;
    margin-bottom: 20px;
    animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.7; }
}
h1 {
    color: #58a6ff;
    font-size: 1.8rem;
    margin-bottom: 12px;
    font-weight: 800;
}
p {
    color: #8b949e;
    max-width: 400px;
    margin-bottom: 24px;
    font-size: 0.95rem;
}
button {
    padding: 12px 32px;
    background: linear-gradient(135deg, #238636, #2ea043);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-weight: 800;
    cursor: pointer;
    font-size: 0.95rem;
    margin: 6px;
    transition: transform 0.15s ease;
    font-family: inherit;
}
button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(46, 160, 67, 0.4);
}
button:active {
    transform: translateY(0);
}
.info {
    margin-top: 30px;
    padding: 14px 18px;
    background: rgba(88, 166, 255, 0.1);
    border: 1.5px solid #1f6feb;
    border-radius: 10px;
    font-size: 0.8rem;
    color: #58a6ff;
    max-width: 380px;
}
</style></head>
<body>
<div class="offline-icon">📡</div>
<h1>You're Offline</h1>
<p>Internet connection nahi hai aur ye page abhi tak cached nahi hai.</p>
<button onclick="location.reload()">🔄 Retry</button>
<button onclick="location.href='./index.html'">🏠 Home</button>
<div class="info">
    💡 <b>Tip:</b> App ka pehle se cached pages offline bhi kaam karenge.
</div>
</body></html>`;
}

// ============================================================
// 📥 INSTALL — Pre-cache assets
// ============================================================
self.addEventListener('install', (event) => {
    logSW('Installing v' + SW_VERSION + '...');

    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                logSW('Pre-caching', ASSETS_TO_CACHE.length, 'assets');

                const results = await Promise.allSettled(
                    ASSETS_TO_CACHE.map(url => {
                        try {
                            const u = new URL(url, self.location.href);
                            if (isSecretFile(u)) {
                                logSW('Skipping secret file:', url);
                                return Promise.resolve({ url, ok: false, skipped: true });
                            }
                        } catch (e) {}

                        return cache.add(url)
                            .then(() => ({ url, ok: true }))
                            .catch(err => {
                                warnSW('Pre-cache failed:', url, err.message);
                                return { url, ok: false, error: err.message };
                            });
                    })
                );

                const succeeded = results.filter(r =>
                    r.status === 'fulfilled' &&
                    r.value &&
                    r.value.ok
                ).length;

                const skipped = results.filter(r =>
                    r.status === 'fulfilled' &&
                    r.value &&
                    r.value.skipped
                ).length;

                const failed = results.filter(r =>
                    r.status === 'rejected' ||
                    (r.value && !r.value.ok && !r.value.skipped)
                );

                logSW(`📊 Pre-cache result: ${succeeded}/${ASSETS_TO_CACHE.length} succeeded, ${skipped} skipped`);

                if (failed.length > 0) {
                    warnSW(`${failed.length} assets failed to cache:`);
                    failed.forEach(r => {
                        const url = r.value?.url || 'unknown';
                        warnSW('  ⚠️', url);
                    });
                } else {
                    logSW('✅ All assets pre-cached');
                }
            } catch (err) {
                errorSW('Cache open failed:', err);
            }

            try {
                self.skipWaiting();
            } catch (e) {
                warnSW('skipWaiting failed:', e.message);
            }
        })()
    );
});

// ============================================================
// ♻️ ACTIVATE — Clean old caches
// ============================================================
self.addEventListener('activate', (event) => {
    logSW('Activating v' + SW_VERSION + '...');

    event.waitUntil(
        (async () => {
            try {
                const keys = await caches.keys();

                const oldCaches = keys.filter(key =>
                    key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
                );

                const otherOldCaches = keys.filter(key =>
                    !key.startsWith(CACHE_PREFIX) &&
                    key !== CACHE_NAME &&
                    key.includes('hor-katha')
                );

                const allOldCaches = [...oldCaches, ...otherOldCaches];

                logSW('Deleting', allOldCaches.length, 'old caches');

                await Promise.all(
                    allOldCaches.map(key => {
                        logSW('Deleting old cache:', key);
                        return caches.delete(key);
                    })
                );

                logSW('✅ Old caches cleaned');
            } catch (e) {
                warnSW('Cache cleanup failed:', e.message);
            }

            try {
                await self.clients.claim();
                logSW('✅ Clients claimed');
            } catch (e) {
                warnSW('Clients claim failed:', e.message);
            }
        })()
    );
});

// ============================================================
// 💬 MESSAGE HANDLER
// ============================================================
self.addEventListener('message', (event) => {
    if (!event.data) return;

    function respond(payload) {
        try {
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage(payload);
            }
        } catch (e) {
            warnSW('Message response failed:', e.message);
        }
    }

    // ─── SKIP_WAITING ───
    if (event.data === 'SKIP_WAITING' ||
        (typeof event.data === 'object' && event.data.type === 'SKIP_WAITING')) {
        logSW('Received SKIP_WAITING message');
        try {
            self.skipWaiting();
            respond({ success: true, action: 'SKIP_WAITING' });
        } catch (e) {
            warnSW('skipWaiting failed:', e.message);
            respond({ success: false, error: e.message });
        }
        return;
    }

    // ─── GET_VERSION ───
    if (typeof event.data === 'object' && event.data.type === 'GET_VERSION') {
        respond({
            success: true,
            version: SW_VERSION,
            cacheName: CACHE_NAME
        });
        return;
    }

    // ─── CLEAR_CACHE ───
    if (typeof event.data === 'object' && event.data.type === 'CLEAR_CACHE') {
        logSW('Received CLEAR_CACHE request');
        (async () => {
            try {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
                respond({ success: true, deleted: keys.length });
                logSW('🗑️ All caches cleared (' + keys.length + ')');
            } catch (e) {
                respond({ success: false, error: e.message });
            }
        })();
        return;
    }

    // ─── PING (health check) ───
    if (typeof event.data === 'object' && event.data.type === 'PING') {
        respond({ success: true, alive: true, version: SW_VERSION });
        return;
    }

    respond({ success: false, error: 'Unknown message type' });
});

// ============================================================
// 🌐 FETCH HANDLER
// ============================================================
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    let url;
    try {
        url = new URL(event.request.url);
    } catch (e) {
        return;
    }

    if (!url.protocol.startsWith('http')) return;

    // ✅ Skip secret files FIRST (before any other logic)
    if (isSecretFile(url)) {
        logSW('Skipping secret file from cache:', url.pathname);
        event.respondWith(fetch(event.request).catch(() => {
            return new Response('', { status: 503 });
        }));
        return;
    }

    if (shouldSkipCache(url)) {
        return;
    }

    const selfOrigin = (self.location && self.location.origin) || '';
    const isSameOrigin = url.origin === selfOrigin;
    const isGoogleFonts =
        url.hostname === 'fonts.googleapis.com' ||
        url.hostname === 'fonts.gstatic.com';
    const isCdnjs = url.hostname === 'cdnjs.cloudflare.com';
    const isUnpkg = url.hostname === 'unpkg.com' || url.hostname.endsWith('.unpkg.com');
    const isGstatic = url.hostname === 'www.gstatic.com' || url.hostname === 'gstatic.com';
    const isJsdelivr = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'jsdelivr.net';

    const isTrustedCDN = isGoogleFonts || isCdnjs || isUnpkg || isGstatic || isJsdelivr;

    if (!isSameOrigin && !isTrustedCDN) {
        return;
    }

    // ═══════════════════════════════════════════════════════════
    // 1️⃣ NAVIGATION requests (HTML pages)
    // ═══════════════════════════════════════════════════════════
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const networkResponse = await fetchWithTimeout(
                        event.request,
                        NAVIGATION_TIMEOUT_MS
                    );

                    if (networkResponse && networkResponse.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            const toCache = networkResponse.clone();
                            await safeCachePut(cache, event.request, toCache);
                        } catch (e) {
                            warnSW('Navigation cache failed:', e.message);
                        }
                    }

                    return networkResponse;
                } catch (e) {
                    logSW('Navigation network failed, trying cache:', e.message);

                    try {
                        let cached = await caches.match(event.request);
                        if (cached && cached.ok) return cached;

                        cached = await caches.match(event.request, { ignoreSearch: true });
                        if (cached && cached.ok) return cached;

                        // ✅ FIXED: Per-page fallback using endsWith for reliability
                        const pathname = url.pathname || '';
                        let fallbackPath = './index.html';

                        if (pathname.endsWith('manual.html') || pathname.endsWith('manual')) {
                            fallbackPath = './manual.html';
                        } else if (pathname.endsWith('verify.html') || pathname.endsWith('verify')) {
                            fallbackPath = './verify.html';
                        } else if (pathname.endsWith('privacy.html') || pathname.endsWith('privacy')) {
                            fallbackPath = './privacy.html';
                        } else if (pathname.endsWith('terms.html') || pathname.endsWith('terms')) {
                            fallbackPath = './terms.html';
                        }

                        const fallback = await caches.match(fallbackPath);
                        if (fallback && fallback.ok) return fallback;

                        const indexFallback = await caches.match('./index.html');
                        if (indexFallback && indexFallback.ok) return indexFallback;
                    } catch (matchErr) {
                        warnSW('Cache match failed:', matchErr.message);
                    }

                    return new Response(getOfflineHTML(), {
                        status: 200,
                        statusText: 'OK (Offline Fallback)',
                        headers: { 'Content-Type': 'text/html; charset=utf-8' }
                    });
                }
            })()
        );
        return;
    }

    // ═══════════════════════════════════════════════════════════
    // 2️⃣ Google Fonts — cache-first
    // ═══════════════════════════════════════════════════════════
    if (isGoogleFonts) {
        event.respondWith(
            (async () => {
                try {
                    const cached = await caches.match(event.request, { ignoreSearch: true });
                    if (cached && cached.ok) return cached;

                    const networkResponse = await fetchWithTimeout(
                        event.request,
                        FONT_TIMEOUT_MS
                    );

                    if (networkResponse && networkResponse.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await safeCachePut(cache, event.request, networkResponse.clone());
                        } catch (e) {}
                    }

                    return networkResponse;
                } catch (e) {
                    const cached = await caches.match(event.request, { ignoreSearch: true });
                    if (cached) return cached;
                    throw e;
                }
            })()
        );
        return;
    }

    // ═══════════════════════════════════════════════════════════
    // 3️⃣ CDN JS libraries — cache-first
    // ═══════════════════════════════════════════════════════════
    if (isCdnjs || isUnpkg || isGstatic || isJsdelivr) {
        event.respondWith(
            (async () => {
                try {
                    const cached = await caches.match(event.request, { ignoreSearch: true });
                    if (cached && cached.ok) return cached;

                    const networkResponse = await fetchWithTimeout(
                        event.request,
                        CDN_TIMEOUT_MS
                    );

                    if (networkResponse && networkResponse.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await safeCachePut(cache, event.request, networkResponse.clone());
                        } catch (e) {}
                    }

                    return networkResponse;
                } catch (e) {
                    const cached = await caches.match(event.request, { ignoreSearch: true });
                    if (cached) return cached;
                    throw e;
                }
            })()
        );
        return;
    }

    // ═══════════════════════════════════════════════════════════
    // 4️⃣ Core assets (HTML/JS/CSS) — network-first
    // ═══════════════════════════════════════════════════════════
    const isCoreAsset = /\.(html|js|css)$/i.test(url.pathname);

    if (isCoreAsset) {
        event.respondWith(
            (async () => {
                try {
                    const networkResponse = await fetchWithTimeout(
                        event.request,
                        NETWORK_TIMEOUT_MS
                    );

                    if (networkResponse && networkResponse.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await safeCachePut(cache, event.request, networkResponse.clone());
                        } catch (e) {}
                    }

                    return networkResponse;
                } catch (e) {
                    try {
                        const cached = await caches.match(event.request, { ignoreSearch: true });
                        if (cached && cached.ok) return cached;
                    } catch (matchErr) {
                        warnSW('Core asset cache match failed:', matchErr.message);
                    }

                    throw e;
                }
            })()
        );
        return;
    }

    // ═══════════════════════════════════════════════════════════
    // 5️⃣ Everything else — stale-while-revalidate
    // ═══════════════════════════════════════════════════════════
    event.respondWith(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(event.request, { ignoreSearch: true });

                const fetchPromise = fetchWithTimeout(event.request, FONT_TIMEOUT_MS)
                    .then(networkResponse => {
                        if (networkResponse && networkResponse.ok) {
                            safeCachePut(cache, event.request, networkResponse.clone())
                                .catch(() => {});
                        }
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            } catch (e) {
                try {
                    const cached = await caches.match(event.request, { ignoreSearch: true });
                    if (cached) return cached;
                } catch (matchErr) {}

                throw e;
            }
        })()
    );
});

// ============================================================
// 🚨 GLOBAL ERROR HANDLERS
// ============================================================
self.addEventListener('error', (event) => {
    warnSW('Uncaught error:', event.message || 'unknown');
});

self.addEventListener('unhandledrejection', (event) => {
    warnSW('Unhandled rejection:', event.reason || 'unknown');
});

// ============================================================
// 📣 READY
// ============================================================
logSW('Hoṛ Katha Suite Service Worker v' + SW_VERSION + ' loaded');
logSW('🔒 Secret file exclusion active (' + SECRET_FILE_PATTERNS.length + ' patterns)');