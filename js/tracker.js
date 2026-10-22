// ============================================================
// 📊 TRACKER — Anonymous Device & Activation Logging
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.2.8.0 — main.js v3.7.4.93 + crypto-utils v3.7.4.93 PARITY:
//
//    🔴 CRITICAL FIX:
//       • 'unknown' HWID fallback REMOVED from encryptName()
//         (main.js v3.7.4.93 rejects it → encryption used to fail)
//       • HWID now resolved via CryptoUtils._getCurrentHwid()
//         (normalized + charset-safe seed + auto-migration)
//       • encryptName() NEVER sends invalid HWID to main process
//
//    🟠 HWID change detection:
//       • storage event → CryptoUtils.clearKeyCache()
//       • prevents stale key cache on device change
//
//    🟡 Consistency:
//       • getAnonDeviceId() uses same HWID source
//       • outdated "secret + HWID" comments fixed
//       • Debug shows HWID source (crypto-utils / localStorage / none)
//
//    ✅ All v3.2.7.0 features retained
// ============================================================

(function() {
    'use strict';

    const OFFLINE_QUEUE_KEY = 'hor_tracker_offline_queue';
    const OFFLINE_QUEUE_MAX = 50;
    const OFFLINE_QUEUE_RETRY_MAX = 5;
    const RATE_LIMIT_KEY = 'hor_tracker_last_log';
    const MIN_LOG_INTERVAL_MS = 3000;
    const FETCH_TIMEOUT_MS = 8000;

    // ============================================================
    // 🆔 HWID RESOLUTION — SINGLE SOURCE OF TRUTH
    // ============================================================
    // ✅ v3.2.8.0: main.js v3.7.4.93 requires a canonical HWID
    //    (DVC-XXXX-XXXX or charset-safe seed). NEVER 'unknown'.
    //
    // Priority:
    //   1. CryptoUtils._getCurrentHwid() — normalized + auto-migrated
    //   2. localStorage + window.normalizeHwid() — if crypto-utils
    //      hasn't loaded yet
    //   3. null → caller MUST skip encryption
    // ============================================================
    function _resolveHwid() {
        // ─── Priority 1: CryptoUtils (already normalized) ───
        try {
            if (typeof CryptoUtils !== 'undefined' &&
                CryptoUtils &&
                typeof CryptoUtils._getCurrentHwid === 'function') {
                const hwid = CryptoUtils._getCurrentHwid();
                if (hwid && typeof hwid === 'string' && hwid.length > 0) {
                    return { hwid, source: 'crypto-utils' };
                }
            }
        } catch (e) {}

        // ─── Priority 2: localStorage (+ local normalize if available) ───
        try {
            const stored = localStorage.getItem('hor_device_hwid');
            if (stored && typeof stored === 'string' && stored.length > 0) {
                if (typeof window.normalizeHwid === 'function') {
                    const norm = window.normalizeHwid(stored);
                    if (norm) {
                        return { hwid: norm, source: 'localStorage-normalized' };
                    }
                    // Not normalizable — let main.js reject (rare)
                    return { hwid: stored, source: 'localStorage-raw' };
                }
                return { hwid: stored, source: 'localStorage-raw' };
            }
        } catch (e) {}

        // ─── Priority 3: No HWID — caller must handle ───
        return { hwid: null, source: 'none' };
    }

    // ============================================================
    // 🔐 ENCRYPTION CAPABILITY DETECTION
    // ============================================================
    // ✅ v3.2.7.0: Secret NO LONGER loaded in renderer.
    //
    // Priority:
    //   1. Electron → electronAPI.encryptName() (IPC to main.js)
    //                 Passphrase = sanitized HWID (main.js v3.7.4.93).
    //   2. PWA     → CryptoUtils.encrypt() (client-side)
    //                 Uses same normalized HWID.
    // ============================================================
    function _getEncryptionMethod() {
        try {
            if (typeof window !== 'undefined' &&
                window.electronAPI &&
                window.electronAPI.isElectron === true &&
                typeof window.electronAPI.encryptName === 'function') {
                return {
                    method: 'ipc-main',
                    secure: true,
                    label: 'Electron main process (AES-256-GCM, HWID passphrase)'
                };
            }

            if (typeof CryptoUtils !== 'undefined' &&
                CryptoUtils &&
                typeof CryptoUtils.encrypt === 'function') {
                return {
                    method: 'client-crypto',
                    secure: false,
                    label: 'Client-side CryptoUtils (HWID passphrase)'
                };
            }

            return {
                method: 'none',
                secure: false,
                label: 'No encryption available'
            };
        } catch (e) {
            return { method: 'none', secure: false, label: 'Detection error' };
        }
    }

    // ============================================================
    // 🔐 ENCRYPT NAME — ✅ v3.2.8.0
    // ============================================================
    // Electron: IPC → main.js (sanitizes HWID, AES-256-GCM).
    // PWA:      CryptoUtils.encrypt() (same normalized HWID).
    //
    // 🔴 NEVER passes 'unknown' — fails fast instead.
    // ============================================================
    async function encryptName(name) {
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return null;
        }

        const cleanName = String(name).substring(0, 500);
        const encMethod = _getEncryptionMethod();

        // ═══════════════════════════════════════════════════════
        // 🥇 PRIORITY 1: Electron — IPC to main process
        // ═══════════════════════════════════════════════════════
        if (encMethod.method === 'ipc-main') {
            const { hwid, source } = _resolveHwid();

            if (!hwid) {
                // 🔴 v3.2.8.0: NO 'unknown' fallback — skip cleanly
                console.error(
                    '[Tracker] ❌ No valid HWID — IPC encrypt skipped ' +
                    '(main.js v3.7.4.93 rejects unknown)'
                );
                return null;
            }

            try {
                const encrypted = await window.electronAPI.encryptName(cleanName, hwid);

                if (encrypted && typeof encrypted === 'string' && encrypted.length > 0) {
                    console.log('[Tracker] ✅ Encrypted via main process (HWID src:', source + ')');
                    return encrypted;
                }

                // main.js returned failure — check error code
                if (encrypted && typeof encrypted === 'object' && encrypted.error) {
                    console.warn('[Tracker] Main process encrypt error:', encrypted.error);
                } else {
                    console.warn('[Tracker] Main process returned no encrypted value — trying PWA fallback');
                }
            } catch (e) {
                console.warn('[Tracker] Main process encrypt failed:', e.message);
            }
        }

        // ═══════════════════════════════════════════════════════
        // 🥈 PRIORITY 2: PWA — CryptoUtils client-side
        // ═══════════════════════════════════════════════════════
        if (encMethod.method === 'client-crypto') {
            try {
                const encrypted = await CryptoUtils.encrypt(cleanName);
                if (encrypted && typeof encrypted === 'string') {
                    console.log('[Tracker] ⚠️ Encrypted via CryptoUtils (PWA fallback)');
                    return encrypted;
                }
            } catch (e) {
                console.warn('[Tracker] CryptoUtils encrypt failed:', e.message);
            }
        }

        console.warn('[Tracker] ❌ All encryption methods failed');
        return null;
    }

    // ============================================================
    // 🔓 DECRYPT NAME (auto — v2-normalized → v2-raw → v1) 
    // ✅ v3.2.8.0: relies on CryptoUtils.decryptAuto() 3-level fallback
    // ============================================================
    async function decryptNameAuto(encoded) {
        if (!encoded || typeof encoded !== 'string') return null;

        if (typeof CryptoUtils === 'undefined' || !CryptoUtils) {
            console.warn('[Tracker] CryptoUtils unavailable for decryption');
            return '[CryptoUtils unavailable]';
        }

        if (typeof CryptoUtils.decryptAuto === 'function') {
            try {
                const result = await CryptoUtils.decryptAuto(encoded);
                if (result) return result;
            } catch (e) {
                console.warn('[Tracker] decryptAuto failed:', e.message);
            }
        }

        if (typeof CryptoUtils.decrypt === 'function') {
            try {
                const result = await CryptoUtils.decrypt(encoded);
                if (result) return result;
            } catch (e) {
                console.warn('[Tracker] decrypt failed:', e.message);
            }
        }

        return '[Decrypt failed]';
    }

    // ============================================================
    // 🌐 URL VALIDATION
    // ============================================================
    function _isValidTrackingUrl(url) {
        if (!url || typeof url !== 'string') return false;
        if (url.includes('YOUR-FIREBASE') ||
            url.includes('YOUR_PROJECT') ||
            url.includes('YOUR-')) {
            return false;
        }
        try {
            const u = new URL(url);
            return u.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    // ============================================================
    // 🔐 UNICODE-SAFE BASE64 ENCODER
    // ============================================================
    function _unicodeSafeBtoa(str) {
        try {
            const utf8Bytes = new TextEncoder().encode(String(str));
            let binary = '';
            const CHUNK_SIZE = 8192;

            for (let i = 0; i < utf8Bytes.length; i += CHUNK_SIZE) {
                const chunk = utf8Bytes.subarray(i, i + CHUNK_SIZE);
                binary += String.fromCharCode.apply(null, chunk);
            }

            return btoa(binary);
        } catch (e) {
            return '';
        }
    }

    // ============================================================
    // 📊 TRACKER — MAIN OBJECT
    // ============================================================
    const Tracker = {
        _lastLogTime: 0,
        _MIN_LOG_INTERVAL_MS: MIN_LOG_INTERVAL_MS,
        _rateLimitLoaded: false,
        _endpoint: null,
        _endpointResolved: false,
        _offlineQueueProcessing: false,
        _debugCallCount: 0,

        // ============================================================
        // 🌐 ENDPOINT getter
        // ============================================================
        get ENDPOINT() {
            if (this._endpointResolved) return this._endpoint;

            let resolved = null;

            try {
                const configured = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.TRACKING_ENDPOINT)
                    ? APP_CONFIG.TRACKING_ENDPOINT
                    : null;

                if (_isValidTrackingUrl(configured)) {
                    resolved = configured;
                } else {
                    try {
                        if (localStorage.getItem('hor_tracking_consent') === 'accepted') {
                            console.warn(
                                '⚠️ [Tracker] Consent granted but TRACKING_ENDPOINT not configured.'
                            );
                        }
                    } catch (e) {}
                }
            } catch (e) {}

            this._endpoint = resolved;
            this._endpointResolved = true;

            return this._endpoint;
        },

        // ============================================================
        // ⏱️ RATE LIMIT — SYNCHRONOUS, ATOMIC
        // ============================================================
        _loadRateLimit() {
            if (this._rateLimitLoaded) return;
            this._rateLimitLoaded = true;

            try {
                const stored = localStorage.getItem(RATE_LIMIT_KEY);
                if (stored) {
                    const t = parseInt(stored, 10);
                    if (!isNaN(t) && t > 0) {
                        this._lastLogTime = t;
                    }
                }
            } catch (e) {}
        },

        _saveRateLimit() {
            try {
                localStorage.setItem(RATE_LIMIT_KEY, String(this._lastLogTime));
            } catch (e) {}
        },

        _checkRateLimitSync() {
            this._debugCallCount++;
            this._loadRateLimit();

            const now = Date.now();
            const elapsed = now - this._lastLogTime;

            if (elapsed < this._MIN_LOG_INTERVAL_MS) {
                return {
                    allowed: false,
                    reason: 'rate-limit',
                    elapsed,
                    remaining: this._MIN_LOG_INTERVAL_MS - elapsed
                };
            }

            this._lastLogTime = now;
            this._saveRateLimit();

            return { allowed: true };
        },

        _resetRateLimit() {
            this._lastLogTime = 0;
            try {
                localStorage.removeItem(RATE_LIMIT_KEY);
            } catch (e) {}
            this._rateLimitLoaded = true;
            console.log('🔄 [Tracker] Rate limit reset');
        },

        init() {
            try {
                this._loadRateLimit();
                this._syncConsentFromStorage();
                this._processOfflineQueue().catch(() => {});

                const encMethod = _getEncryptionMethod();
                const { hwid, source: hwidSource } = _resolveHwid();

                console.log('═══════════════════════════════════════════');
                console.log('📊 [Tracker] Initializing — v3.2.8.0');
                console.log('  Endpoint:', this.ENDPOINT ? '✅ configured' : '⚠️ not configured');
                console.log('  Encrypt path:', encMethod.secure ? '🔐' : '⚠️', encMethod.label);
                console.log('  Encrypt method:', encMethod.method);
                console.log('  HWID source:', hwidSource);
                console.log('  HWID present:', hwid ? '✅' : '❌ (encryption will fail)');
                console.log('  HWID is seed:', (hwid && typeof window.isFallbackSeed === 'function'
                                              && window.isFallbackSeed(hwid)) ? 'yes' : 'no');
                console.log('  Consent:', this.getConsentState());
                console.log('  Crypto:', (typeof CryptoUtils !== 'undefined') ? '✅ available' : '⚠️ unavailable');
                console.log('  Rate limit:', this._MIN_LOG_INTERVAL_MS + 'ms (sync lock)');
                console.log('  Secret in renderer:', '❌ NOT EXPOSED (v3.2.7.0+)');
                console.log('═══════════════════════════════════════════');

                if (!hwid) {
                    console.error('🚨 [Tracker] No HWID available — activation logging will skip encryption');
                }

                this._hookConsentBanner();
                this._hookHwidChange();
                return { success: true };
            } catch (e) {
                console.warn('⚠️ [Tracker] Init failed:', e.message);
                return { success: false, error: e.message };
            }
        },

        _syncConsentFromStorage() {
            try {
                const state = localStorage.getItem('hor_tracking_consent');
                if (state === 'accepted' || state === 'declined') {
                    console.log('📊 [Tracker] Consent state synced:', state);
                }
            } catch (e) {}
        },

        _hookConsentBanner() {
            try {
                if (typeof window === 'undefined') return;

                window.addEventListener('tracking-consent-changed', (e) => {
                    const accepted = e.detail && e.detail.accepted;
                    this.setConsent(accepted);
                    if (accepted) {
                        this._processOfflineQueue().catch(() => {});
                    }
                });

                window.addEventListener('storage', (e) => {
                    if (e.key === 'hor_tracking_consent') {
                        console.log('📊 [Tracker] Consent changed in another tab:', e.newValue);
                        if (e.newValue === 'accepted') {
                            this._processOfflineQueue().catch(() => {});
                        }
                    }
                });
            } catch (e) {}
        },

        // ============================================================
        // 🆕 v3.2.8.0: HWID change listener → clear key cache
        // ============================================================
        _hookHwidChange() {
            try {
                if (typeof window === 'undefined') return;

                window.addEventListener('storage', (e) => {
                    if (e.key === 'hor_device_hwid' || e.key === 'hor_device_hwid_legacy') {
                        console.log('🔑 [Tracker] HWID changed → clearing CryptoUtils key cache');
                        try {
                            if (typeof CryptoUtils !== 'undefined' &&
                                typeof CryptoUtils.clearKeyCache === 'function') {
                                CryptoUtils.clearKeyCache();
                            }
                        } catch (e) {}
                    }
                });
            } catch (e) {}
        },

        isEnabled() {
            try {
                return localStorage.getItem('hor_tracking_consent') === 'accepted';
            } catch (e) {
                return false;
            }
        },

        // ============================================================
        // 🆔 ANON DEVICE ID — same HWID source (v3.2.8.0)
        // ============================================================
        async getAnonDeviceId() {
            const { hwid } = _resolveHwid();
            let source = hwid;

            // Fallback only for anon hash (not for encryption)
            if (!source) {
                try {
                    source = 'fallback-' +
                        (navigator.platform || 'unknown') + '-' +
                        (navigator.hardwareConcurrency || 0) + '-' +
                        (navigator.language || 'en');
                } catch (e) {
                    source = 'fallback-unknown';
                }
            }

            try {
                if (typeof CryptoUtils !== 'undefined' && CryptoUtils.hashAnonymous) {
                    const hash = await CryptoUtils.hashAnonymous(source);
                    if (hash) return hash;
                }
            } catch (e) {}

            try {
                const base64 = _unicodeSafeBtoa(source).substring(0, 12);
                return 'anon-' + base64.replace(/[^A-Za-z0-9]/g, '');
            } catch (e) {
                return 'anon-fallback';
            }
        },

        // ============================================================
        // 📊 LOG ACTIVATION
        // ============================================================
        async logActivation(name, plan, action = 'activate') {
            if (!this.isEnabled()) {
                return { skipped: true, reason: 'no-consent' };
            }

            if (!this.ENDPOINT) {
                return { skipped: true, reason: 'no-endpoint' };
            }

            const encMethod = _getEncryptionMethod();
            if (encMethod.method === 'none') {
                return { skipped: true, reason: 'no-encryption-method' };
            }

            const check = this._checkRateLimitSync();

            if (!check.allowed) {
                console.log(
                    '📊 [Tracker] Rate limited: ' + check.reason +
                    ' (remaining: ' + Math.round(check.remaining) + 'ms)'
                );
                return {
                    skipped: true,
                    reason: check.reason,
                    remaining: check.remaining
                };
            }

            try {
                const anonId = await this.getAnonDeviceId();
                const encryptedName = name ? await encryptName(name) : null;

                let nameHash = null;
                if (name) {
                    try {
                        if (typeof CryptoUtils !== 'undefined' && CryptoUtils.hashAnonymous) {
                            nameHash = await CryptoUtils.hashAnonymous(
                                String(name).toLowerCase()
                            );
                        }
                    } catch (e) {}
                }

                const { source: hwidSource } = _resolveHwid();

                const event = {
                    anonId: anonId,
                    action: action,
                    plan: plan,
                    customerName: encryptedName,
                    nameHash: nameHash,
                    appVersion: (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.VERSION) || '3.7.4',
                    platform: this._getPlatform(),
                    browser: this._getBrowser(),
                    encryptMethod: encMethod.method,
                    hwidSource: hwidSource,          // 🆕 v3.2.8.0
                    hwidMissing: encryptedName === null && !!name, // 🆕 v3.2.8.0
                    timestamp: new Date().toISOString()
                };

                if (!navigator.onLine) {
                    this._queueOfflineEvent(event);
                    console.log('📊 Offline — event queued');
                    return { success: true, queued: true };
                }

                return await this._sendEvent(event);

            } catch (e) {
                console.warn('📊 Tracking failed:', e.message);
                return { success: false, error: e.message };
            }
        },

        async _sendEvent(event) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            try {
                await fetch(this.ENDPOINT, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                console.log('📊 Activation logged');
                return { success: true };

            } catch (fetchErr) {
                clearTimeout(timeoutId);
                this._queueOfflineEvent(event);
                return { success: false, queued: true, error: fetchErr.message };
            }
        },

        _queueOfflineEvent(event) {
            try {
                let queue = [];
                try {
                    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) queue = parsed;
                    }
                } catch (e) {}

                if (queue.length >= OFFLINE_QUEUE_MAX) {
                    queue.shift();
                }

                queue.push({
                    event: event,
                    queuedAt: Date.now(),
                    retryCount: 0
                });

                localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
            } catch (e) {}
        },

        _processOfflineQueue: async function() {
            if (this._offlineQueueProcessing) return;
            this._offlineQueueProcessing = true;

            try {
                if (!navigator.onLine) return;
                if (!this.isEnabled() || !this.ENDPOINT) return;

                let queue = [];
                try {
                    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) queue = parsed;
                    }
                } catch (e) {
                    return;
                }

                if (queue.length === 0) return;

                console.log('📤 Processing offline queue (' + queue.length + ' events)');

                const remaining = [];
                let dropped = 0;

                for (const item of queue) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

                        await fetch(this.ENDPOINT, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(item.event),
                            signal: controller.signal
                        });

                        clearTimeout(timeoutId);
                        await new Promise(resolve => setTimeout(resolve, 200));

                    } catch (e) {
                        item.retryCount = (item.retryCount || 0) + 1;

                        if (item.retryCount >= OFFLINE_QUEUE_RETRY_MAX) {
                            dropped++;
                            console.warn('📊 [Tracker] Dropping event after ' +
                                       OFFLINE_QUEUE_RETRY_MAX + ' retries');
                        } else {
                            remaining.push(item);
                        }
                    }
                }

                try {
                    if (remaining.length > 0) {
                        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
                    } else {
                        localStorage.removeItem(OFFLINE_QUEUE_KEY);
                    }

                    if (dropped > 0) {
                        console.warn('📊 [Tracker] Dropped ' + dropped + ' stale events');
                    }
                } catch (e) {}

            } catch (e) {
                console.warn('Queue processing error:', e.message);
            } finally {
                this._offlineQueueProcessing = false;
            }
        },

        _getPlatform() {
            try {
                if (navigator.userAgentData && navigator.userAgentData.platform) {
                    return navigator.userAgentData.platform;
                }
                const p = navigator.platform || 'unknown';
                if (/Win/i.test(p)) return 'Windows';
                if (/Mac/i.test(p)) return 'macOS';
                if (/Linux/i.test(p)) return 'Linux';
                if (/Android/i.test(p)) return 'Android';
                if (/iPhone|iPad|iPod/i.test(p)) return 'iOS';
                return p;
            } catch (e) {
                return 'unknown';
            }
        },

        _getBrowser() {
            try {
                const ua = navigator.userAgent || '';

                if (ua.includes('Edg/') || ua.includes('EdgA/') || ua.includes('EdgiOS/')) return 'Edge';
                if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';

                if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
                    if (ua.includes('Brave/')) return 'Brave';
                } else if (ua.includes('Brave/')) {
                    return 'Brave';
                }

                if (ua.includes('Firefox/') || ua.includes('FxiOS/')) return 'Firefox';
                if (ua.includes('Chrome/') || ua.includes('CriOS/')) return 'Chrome';
                if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
                return 'Other';
            } catch (e) {
                return 'unknown';
            }
        },

        getLocalStats() {
            try {
                const raw = localStorage.getItem('hor_receipts');
                if (!raw) return { totalActivations: 0, lastActivation: null };

                const receipts = JSON.parse(raw);
                if (!Array.isArray(receipts)) {
                    return { totalActivations: 0, lastActivation: null };
                }

                let lastActivation = null;
                if (receipts.length > 0) {
                    const last = receipts[receipts.length - 1];
                    if (last && typeof last === 'object') {
                        lastActivation = last.timestamp || null;
                    }
                }

                return {
                    totalActivations: receipts.length,
                    lastActivation: lastActivation
                };
            } catch (e) {
                return { totalActivations: 0, lastActivation: null };
            }
        },

        setConsent(accepted) {
            try {
                localStorage.setItem('hor_tracking_consent', accepted ? 'accepted' : 'declined');
                localStorage.setItem('hor_tracking_consent_date', new Date().toISOString());
                console.log('📊 Tracking consent:', accepted ? 'ACCEPTED' : 'DECLINED');

                try {
                    window.dispatchEvent(new CustomEvent('tracking-consent-changed', {
                        detail: { accepted: accepted }
                    }));
                } catch (e) {}

                if (accepted) {
                    setTimeout(() => {
                        this._processOfflineQueue().catch(() => {});
                    }, 500);
                }

                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },

        hasConsentDecision() {
            try {
                const c = localStorage.getItem('hor_tracking_consent');
                return c === 'accepted' || c === 'declined';
            } catch (e) {
                return false;
            }
        },

        getConsentState() {
            try {
                const c = localStorage.getItem('hor_tracking_consent');
                if (c === 'accepted') return 'accepted';
                if (c === 'declined') return 'declined';
                return 'not-set';
            } catch (e) {
                return 'not-set';
            }
        },

        getConsentDate() {
            try {
                return localStorage.getItem('hor_tracking_consent_date') || null;
            } catch (e) {
                return null;
            }
        },

        resetConsent() {
            try {
                localStorage.removeItem('hor_tracking_consent');
                localStorage.removeItem('hor_tracking_consent_date');
                console.log('📊 Consent reset');
                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },

        getQueueStats() {
            try {
                const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
                if (!raw) return { pending: 0, oldest: null, maxRetries: 0 };

                const queue = JSON.parse(raw);
                if (!Array.isArray(queue)) return { pending: 0, oldest: null, maxRetries: 0 };

                let oldest = null;
                let maxRetries = 0;

                queue.forEach(item => {
                    if (item.queuedAt && (!oldest || item.queuedAt < oldest)) {
                        oldest = item.queuedAt;
                    }
                    if (item.retryCount && item.retryCount > maxRetries) {
                        maxRetries = item.retryCount;
                    }
                });

                return {
                    pending: queue.length,
                    oldest: oldest ? new Date(oldest).toISOString() : null,
                    maxRetries: maxRetries
                };
            } catch (e) {
                return { pending: 0, oldest: null, maxRetries: 0 };
            }
        },

        getEncryptionInfo() {
            const method = _getEncryptionMethod();
            const { hwid, source } = _resolveHwid();
            return {
                ...method,
                hwidSource: source,
                hwidPresent: !!hwid,
                hwidIsSeed: (hwid && typeof window.isFallbackSeed === 'function')
                    ? window.isFallbackSeed(hwid)
                    : null
            };
        },

        decryptNameAuto: decryptNameAuto,

        // ✅ v3.2.8.0: expose HWID resolver for callers
        getHwidInfo: () => _resolveHwid()
    };

    if (typeof window !== 'undefined') {
        window.Tracker = Tracker;
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
            console.log('🌐 Back online — processing queue');
            setTimeout(() => {
                Tracker._processOfflineQueue().catch(() => {});
            }, 1000);
        });
    }

    function autoInit() {
        try {
            if (typeof APP_CONFIG !== 'undefined') {
                Tracker.init();
                return;
            }

            let initDone = false;
            const doInit = function() {
                if (initDone) return;
                initDone = true;
                Tracker.init();
            };

            window.addEventListener('config-loaded', doInit, { once: true });

            let checks = 0;
            const maxChecks = 20;
            const checkInterval = setInterval(function() {
                checks++;
                if (typeof APP_CONFIG !== 'undefined') {
                    clearInterval(checkInterval);
                    doInit();
                } else if (checks >= maxChecks) {
                    clearInterval(checkInterval);
                    console.warn('⚠️ [Tracker] APP_CONFIG not loaded after timeout');
                    doInit();
                }
            }, 250);

        } catch (e) {
            console.warn('⚠️ [Tracker] Auto-init failed:', e.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

    // ============================================================
    // 📊 DEBUG HELPERS
    // ============================================================
    if (typeof window !== 'undefined') {
        window.TrackerDebug = {
            status: function() {
                const encMethod = _getEncryptionMethod();
                const { hwid, source: hwidSource } = _resolveHwid();

                console.log('═══════════════════════════════════════════');
                console.log('📊 Tracker Status (v3.2.8.0)');
                console.log('───────────────────────────────────────────');
                console.log('  Endpoint:', Tracker.ENDPOINT ? '✅ configured' : '⚠️ not configured');
                console.log('  Endpoint resolved:', Tracker._endpointResolved);
                console.log('  Consent:', Tracker.getConsentState());
                console.log('');
                console.log('  🔐 ENCRYPTION:');
                console.log('    Method:', encMethod.method);
                console.log('    Label:', encMethod.label);
                console.log('    Secure:', encMethod.secure ? '✅ YES' : '⚠️ NO');
                console.log('    Secret in renderer:', '❌ NOT EXPOSED');
                console.log('');
                console.log('  🆔 HWID:');
                console.log('    Source:', hwidSource);
                console.log('    Present:', hwid ? '✅' : '❌ (encryption will fail)');
                console.log('    Value:', hwid ? hwid.substring(0, 24) + '...' : 'null');
                console.log('    Is seed:', (hwid && typeof window.isFallbackSeed === 'function')
                    ? (window.isFallbackSeed(hwid) ? 'yes' : 'no')
                    : 'N/A');
                console.log('');
                console.log('  Rate limit:', Tracker._MIN_LOG_INTERVAL_MS + 'ms (sync)');
                console.log('  Last log:', Tracker._lastLogTime
                    ? new Date(Tracker._lastLogTime).toLocaleTimeString()
                    : 'never');
                console.log('  Debug call count:', Tracker._debugCallCount);
                console.log('  Queue stats:', Tracker.getQueueStats());
                console.log('  CryptoUtils:', typeof CryptoUtils !== 'undefined' ? 'available' : 'missing');
                console.log('═══════════════════════════════════════════');
            },

            testEncryption: async function(testName) {
                console.log('═══════════════════════════════════════════');
                console.log('🧪 ENCRYPTION TEST (v3.2.8.0)');
                console.log('═══════════════════════════════════════════');

                const name = testName || 'Test User ' + Date.now();
                const encMethod = _getEncryptionMethod();
                const { hwid, source: hwidSource } = _resolveHwid();

                console.log('  Test name:', name);
                console.log('  Encrypt method:', encMethod.method);
                console.log('  HWID source:', hwidSource);
                console.log('  HWID present:', hwid ? '✅' : '❌');
                console.log('');

                if (!hwid) {
                    console.log('  ❌ No HWID — cannot encrypt');
                    console.log('  Result: ❌ FAIL');
                    console.log('═══════════════════════════════════════════');
                    return { success: false, reason: 'no-hwid' };
                }

                const t0 = performance.now();
                const encrypted = await encryptName(name);
                const t1 = performance.now();

                if (!encrypted) {
                    console.log('  ❌ Encryption FAILED');
                    console.log('  Result: ❌ FAIL');
                    console.log('═══════════════════════════════════════════');
                    return { success: false };
                }

                console.log('  ✅ Encrypted in', (t1 - t0).toFixed(2) + 'ms');
                console.log('  Length:', encrypted.length, 'base64 chars');
                console.log('');

                const decrypted = await decryptNameAuto(encrypted);
                const matches = decrypted === name;

                console.log('  Decrypted:', decrypted);
                console.log('  Match:', matches ? '✅ YES' : '❌ NO');
                console.log('');
                console.log('  Result:', (matches && encMethod.secure) ? '✅ PASS (secure + roundtrip)' :
                            matches ? '⚠️ PASS (roundtrip OK, obfuscation only)' :
                            '❌ FAIL');
                console.log('═══════════════════════════════════════════');

                return { success: matches, encrypted, decrypted, encMethod, hwidSource };
            },

            testRateLimitRace: function() {
                console.log('═══════════════════════════════════════════');
                console.log('🧪 RATE LIMIT RACE TEST');
                console.log('═══════════════════════════════════════════');

                Tracker._resetRateLimit();
                Tracker._debugCallCount = 0;

                const results = [];
                for (let i = 0; i < 5; i++) {
                    results.push(Tracker._checkRateLimitSync());
                }

                let allowed = 0, blocked = 0;
                results.forEach((r, i) => {
                    if (!r.allowed) blocked++; else allowed++;
                    console.log(`  [${i + 1}] ${!r.allowed ? '🚫 rate-limited' : '✅ allowed'}`);
                });

                const pass = (allowed === 1 && blocked === 4);
                console.log('  Result:', pass ? '✅ PASS' : '❌ FAIL');

                Tracker._resetRateLimit();
                return { allowed, blocked, results, pass };
            },

            testRateLimitStress: function() {
                Tracker._resetRateLimit();
                Tracker._debugCallCount = 0;

                const COUNT = 100;
                let allowed = 0, blocked = 0;

                const t0 = performance.now();
                for (let i = 0; i < COUNT; i++) {
                    if (Tracker._checkRateLimitSync().allowed) allowed++;
                    else blocked++;
                }
                const t1 = performance.now();

                const pass = (allowed === 1 && blocked === COUNT - 1);
                console.log('  Result:', pass ? '✅ PASS' : '❌ FAIL',
                    `(${allowed} allowed, ${blocked} blocked, ${(t1-t0).toFixed(2)}ms)`);

                Tracker._resetRateLimit();
                return { allowed, blocked, time: t1 - t0, pass };
            },

            testRateLimitNoHang: async function() {
                Tracker._resetRateLimit();
                const TIMEOUT_MS = 5000;

                try {
                    const t0 = performance.now();
                    await Promise.race([
                        Promise.resolve(Tracker._checkRateLimitSync()),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS))
                    ]);
                    const elapsed = performance.now() - t0;
                    const pass = elapsed < TIMEOUT_MS;
                    console.log('  Result:', pass ? '✅ PASS' : '❌ FAIL');
                    Tracker._resetRateLimit();
                    return { elapsed, pass };
                } catch (e) {
                    console.log('  Result: ❌ FAIL (deadlock)');
                    Tracker._resetRateLimit();
                    return { hung: true, pass: false };
                }
            },

            testNoMemoryGrowth: async function() {
                Tracker._resetRateLimit();

                const before = (performance.memory && performance.memory.usedJSHeapSize) || 0;
                for (let i = 0; i < 500; i++) Tracker._checkRateLimitSync();

                if (window.gc) { try { window.gc(); } catch (e) {} }
                await new Promise(r => setTimeout(r, 100));

                const after = (performance.memory && performance.memory.usedJSHeapSize) || 0;
                const diff = after - before;
                const pass = Math.abs(diff) < 500 * 1024;

                console.log('  Result:', pass ? '✅ PASS' : '⚠️ REVIEW',
                    `(diff: ${(diff / 1024).toFixed(0)} KB)`);

                Tracker._resetRateLimit();
                return { before, after, diff, pass };
            },

            clearQueue: function() {
                try {
                    localStorage.removeItem(OFFLINE_QUEUE_KEY);
                    console.log('🗑️ Queue cleared');
                } catch (e) {}
            },

            testBrave: function() {
                console.log('🧪 Browser detection test:');
                console.log('  Detected:', Tracker._getBrowser());
                console.log('  User agent:', navigator.userAgent.substring(0, 100));
            },

            resetRateLimit: function() {
                Tracker._resetRateLimit();
            },

            testSecretIsolation: function() {
                console.log('═══════════════════════════════════════════');
                console.log('🧪 SECRET ISOLATION TEST');
                console.log('═══════════════════════════════════════════');

                const checks = [
                    {
                        name: 'window.__RUNTIME_CONFIG__.NAME_ENCRYPTION_SECRET',
                        value: (typeof window !== 'undefined' &&
                                window.__RUNTIME_CONFIG__ &&
                                window.__RUNTIME_CONFIG__.NAME_ENCRYPTION_SECRET) || undefined
                    },
                    {
                        name: 'APP_CONFIG.NAME_ENCRYPTION_SECRET',
                        value: (typeof APP_CONFIG !== 'undefined' &&
                                APP_CONFIG.NAME_ENCRYPTION_SECRET) || undefined
                    },
                    {
                        name: 'window.NAME_SECRET',
                        value: (typeof window !== 'undefined' &&
                                window.NAME_SECRET) || undefined
                    }
                ];

                let pass = true;
                checks.forEach(c => {
                    const isExposed = c.value !== undefined && c.value !== null && c.value !== '';
                    if (isExposed) pass = false;
                    console.log(`  ${isExposed ? '❌' : '✅'} ${c.name}`);
                });

                console.log('  Result:', pass ? '✅ PASS' : '❌ FAIL (secret exposed!)');
                return { pass, checks };
            },

            // 🆕 v3.2.8.0: Verify HWID resolves correctly
            testHwidResolution: function() {
                console.log('═══════════════════════════════════════════');
                console.log('🧪 HWID RESOLUTION TEST (v3.2.8.0)');
                console.log('═══════════════════════════════════════════');

                const { hwid, source } = _resolveHwid();

                console.log('  Source:', source);
                console.log('  Present:', hwid ? '✅' : '❌');
                if (hwid) {
                    console.log('  Length:', hwid.length);
                    console.log('  Preview:', hwid.substring(0, 24) + '...');
                    console.log('  Is seed:', (typeof window.isFallbackSeed === 'function')
                        ? (window.isFallbackSeed(hwid) ? 'yes' : 'no')
                        : 'N/A');
                }

                const pass = !!hwid && source !== 'none';
                console.log('  Result:', pass ? '✅ PASS (HWID ready)' : '❌ FAIL (no HWID)');
                console.log('═══════════════════════════════════════════');

                return { hwid, source, pass };
            },

            selfTest: function() {
                console.log('═══════════════════════════════════════════');
                console.log('🧪 TRACKER SELF-TEST (v3.2.8.0)');
                console.log('═══════════════════════════════════════════');

                const checks = {
                    ENDPOINT_getter: typeof Tracker.ENDPOINT !== 'undefined',
                    logActivation: typeof Tracker.logActivation === 'function',
                    setConsent: typeof Tracker.setConsent === 'function',
                    getConsentState: typeof Tracker.getConsentState === 'function',
                    getAnonDeviceId: typeof Tracker.getAnonDeviceId === 'function',
                    getLocalStats: typeof Tracker.getLocalStats === 'function',
                    getQueueStats: typeof Tracker.getQueueStats === 'function',
                    getEncryptionInfo: typeof Tracker.getEncryptionInfo === 'function',
                    getHwidInfo: typeof Tracker.getHwidInfo === 'function',
                    _processOfflineQueue: typeof Tracker._processOfflineQueue === 'function',
                    _queueOfflineEvent: typeof Tracker._queueOfflineEvent === 'function',
                    _hookHwidChange: typeof Tracker._hookHwidChange === 'function',
                    decryptNameAuto: typeof Tracker.decryptNameAuto === 'function',
                    _checkRateLimitSync: typeof Tracker._checkRateLimitSync === 'function',
                    _resetRateLimit: typeof Tracker._resetRateLimit === 'function',
                    testHwidResolution: typeof window.TrackerDebug.testHwidResolution === 'function',
                    testEncryption: typeof window.TrackerDebug.testEncryption === 'function',
                    testSecretIsolation: typeof window.TrackerDebug.testSecretIsolation === 'function'
                };

                Object.entries(checks).forEach(([key, pass]) => {
                    console.log(`  ${pass ? '✅' : '❌'} ${key}`);
                });

                const allPass = Object.values(checks).every(v => v);
                console.log('');
                console.log(allPass ? '🎉 ALL FUNCTIONS PRESENT' : '⚠️ SOME MISSING');
                console.log('═══════════════════════════════════════════');

                return checks;
            }
        };
    }

    console.log('═══════════════════════════════════════════');
    console.log('✅ tracker.js loaded — v3.2.8.0 (main.js v3.7.4.93 parity)');
    console.log('   🔐 Secret in renderer: ❌ NOT EXPOSED');
    console.log('   🔐 Encrypt path: electronAPI.encryptName() → main.js');
    console.log('   🆔 HWID source: CryptoUtils._getCurrentHwid()');
    console.log('   🆔 No "unknown" fallback (main.js rejects it)');
    console.log('   🆕 HWID change → clears key cache');
    console.log('   📊 Endpoint: (lazy resolution, race-safe)');
    console.log('   👤 Consent:', Tracker.getConsentState());

    const _encMethod = _getEncryptionMethod();
    const _hwidInfo = _resolveHwid();
    console.log('   🔐 Encrypt method:', _encMethod.method);
    console.log('   🆔 HWID:', _hwidInfo.hwid ? '✅ present (' + _hwidInfo.source + ')' : '❌ missing');
    console.log('   🔗 CryptoUtils:', (typeof CryptoUtils !== 'undefined') ? 'available' : '⚠️ unavailable');
    console.log('   💾 Offline queue: enabled');
    console.log('   ⏱️  Persistent rate limit: enabled');
    console.log('   🆕 v3.2.8.0: HWID fallback = CryptoUtils (never "unknown")');
    console.log('   🆕 v3.2.8.0: HWID change → clearKeyCache');
    console.log('   🧪 TrackerDebug.testHwidResolution() ← NEW');
    console.log('═══════════════════════════════════════════');

})();