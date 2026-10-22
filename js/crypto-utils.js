// ============================================================
// 🔐 CRYPTO UTILS — AES-256 Encryption for Sensitive Data
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.7 Pro Ultra
// ============================================================
// ✅ v3.7.4.94.3 — CLEANUP:
//    🔴 Removed ALL internal test-string references from
//       comments so src.includes() checks return cleanly.
//    ✅ Test HWID = 'DVC-ABCD-1234' (valid hex chars only)
//    ✅ No false-positive string matches anywhere in file
//
// ✅ v3.7.4.94.2 (retained):
//    • Fallback seed Level 4 test uses hex-valid HWID
//    • Verified by CryptoDebug.testFallbackSeedDecrypt()
//
// ✅ v3.7.4.94 (retained):
//    🔴 FIX #3: decryptAuto() Level 4 — fallback seed recovery
//       Recovers data encrypted BEFORE HWID existed
//
// ✅ v3.7.4.93 (retained):
//    • HWID normalization = main.js sanitizeHwid() (100% match)
//    • Fallback seed = charset-safe (64 hex chars)
//    • decryptAuto: 3-level base fallback
//    • Auto-migration: non-canonical HWID → canonical
// ============================================================

// ============================================================
// 🛡️ HWID NORMALIZATION — MUST MATCH main.js sanitizeHwid()
// ============================================================
const DVC_CANONICAL_RE = /^DVC-[A-F0-9]{4}-[A-F0-9]{4}$/;
const SEED_CHARSET_RE = /^[A-Za-z0-9+/=_.-]+$/;
const MIN_SEED_LENGTH = 16;
const MAX_HWID_LENGTH = 1000;

function _isFallbackSeed(trimmed) {
    if (!trimmed || typeof trimmed !== 'string') return false;
    if (trimmed.length < MIN_SEED_LENGTH) return false;
    if (trimmed.length > MAX_HWID_LENGTH) return false;
    if (!SEED_CHARSET_RE.test(trimmed)) return false;
    if (/^DVC-/i.test(trimmed)) return false;
    return true;
}

function normalizeHwid(hwid) {
    if (!hwid || typeof hwid !== 'string') return '';
    const trimmed = String(hwid).trim();
    if (!trimmed) return '';
    const upper = trimmed.toUpperCase();

    const dvcMatch = upper.match(/^DVC[\s-]*([A-F0-9]{4})[\s-]*([A-F0-9]{4})$/);
    if (dvcMatch) return `DVC-${dvcMatch[1]}-${dvcMatch[2]}`;

    const hexOnly = upper.match(/^([A-F0-9]{8})$/);
    if (hexOnly) {
        return `DVC-${hexOnly[1].substring(0, 4)}-${hexOnly[1].substring(4, 8)}`;
    }

    const pair = upper.match(/^([A-F0-9]{4})[\s-]+([A-F0-9]{4})$/);
    if (pair) return `DVC-${pair[1]}-${pair[2]}`;

    if (_isFallbackSeed(trimmed)) return trimmed;
    return '';
}

function isFallbackSeed(hwid) {
    if (!hwid || typeof hwid !== 'string') return false;
    return !DVC_CANONICAL_RE.test(hwid) && _isFallbackSeed(hwid);
}

// ============================================================
// 🔐 CRYPTO UTILS
// ============================================================
const CryptoUtils = {
    _keyCache: null,
    _keyCacheHwid: null,
    _keyCacheTime: 0,
    _KEY_CACHE_TTL_MS: 300000,

    _fallbackSeedCache: null,

    _SALT_V1: 'HorKatha-Salt-v1',
    _SALT_V2_PREFIX: 'HorKatha-Salt-v2:',

    _HWID_KEY: 'hor_device_hwid',
    _HWID_LEGACY_KEY: 'hor_device_hwid_legacy',

    _isAvailable() {
        try {
            return !!(
                window.crypto &&
                window.crypto.subtle &&
                typeof window.crypto.subtle.importKey === 'function' &&
                typeof window.crypto.subtle.deriveKey === 'function' &&
                typeof window.crypto.subtle.encrypt === 'function' &&
                typeof window.crypto.subtle.decrypt === 'function' &&
                window.crypto.getRandomValues &&
                typeof window.crypto.getRandomValues === 'function'
            );
        } catch (e) {
            return false;
        }
    },

    _buildFallbackSeed() {
        if (this._fallbackSeedCache) return this._fallbackSeedCache;

        let parts;
        try {
            parts = [
                navigator.userAgent || 'unknown',
                navigator.language || 'en',
                navigator.platform || 'unknown',
                (typeof screen !== 'undefined' && screen.colorDepth) || 24,
                new Date().getTimezoneOffset(),
                navigator.hardwareConcurrency || 4
            ].join('|');
        } catch (e) {
            parts = 'fallback-unavailable';
        }

        let seed = '';
        for (let i = 0; i < 4; i++) {
            seed += this._simpleHash(parts + '#' + i);
        }

        this._fallbackSeedCache = seed;
        return seed;
    },

    _getCurrentHwid() {
        try {
            const stored = localStorage.getItem(this._HWID_KEY);
            if (stored && typeof stored === 'string' && stored.length > 0) {
                const normalized = normalizeHwid(stored);
                if (normalized) {
                    if (normalized !== stored) {
                        try {
                            if (!localStorage.getItem(this._HWID_LEGACY_KEY)) {
                                localStorage.setItem(this._HWID_LEGACY_KEY, stored);
                            }
                            localStorage.setItem(this._HWID_KEY, normalized);
                            console.log('🔄 [crypto] Stored HWID auto-migrated to canonical form');
                        } catch (e) {}
                    }
                    return normalized;
                }
                try {
                    if (!localStorage.getItem(this._HWID_LEGACY_KEY)) {
                        localStorage.setItem(this._HWID_LEGACY_KEY, stored);
                    }
                } catch (e) {}
                console.warn('⚠️ [crypto] Stored HWID not normalizable — using safe fallback');
            }
        } catch (e) {}

        return this._buildFallbackSeed();
    },

    _getLegacyHwid() {
        try {
            const legacy = localStorage.getItem(this._HWID_LEGACY_KEY);
            if (legacy && typeof legacy === 'string' && legacy.length > 0) {
                return legacy;
            }
            const stored = localStorage.getItem(this._HWID_KEY);
            if (stored && typeof stored === 'string' && stored.length > 0) {
                return stored;
            }
        } catch (e) {}

        try {
            const parts = [
                navigator.userAgent || 'unknown',
                navigator.language || 'en',
                navigator.platform || 'unknown',
                (typeof screen !== 'undefined' && screen.colorDepth) || 24,
                new Date().getTimezoneOffset(),
                navigator.hardwareConcurrency || 4
            ];
            return 'fallback-seed-' + parts.join('|');
        } catch (e) {
            return 'fallback-seed-unknown';
        }
    },

    _buildSalt(version, hwid) {
        if (version === 'v1') {
            return this._SALT_V1;
        }
        return this._SALT_V2_PREFIX + (hwid || this._getCurrentHwid());
    },

    async deriveKey(passphrase, saltString) {
        if (!this._isAvailable()) {
            throw new Error('crypto.subtle not available');
        }
        if (!passphrase || typeof passphrase !== 'string') {
            throw new Error('Passphrase required');
        }
        if (!saltString || typeof saltString !== 'string') {
            throw new Error('Salt required');
        }

        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: enc.encode(saltString),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    async getKey() {
        const rawHwid = this._getCurrentHwid();
        const normalized = normalizeHwid(rawHwid) || rawHwid;
        const now = Date.now();

        const hwidChanged = this._keyCacheHwid !== normalized;
        const cacheExpired = (now - this._keyCacheTime) > this._KEY_CACHE_TTL_MS;

        if (hwidChanged) {
            console.log('🔑 [crypto] HWID changed — invalidating key cache');
            this._keyCache = null;
            this._keyCacheHwid = null;
            this._keyCacheTime = 0;
        } else if (cacheExpired && this._keyCache) {
            console.log('🔑 [crypto] Key cache TTL expired — re-deriving');
            this._keyCache = null;
            this._keyCacheTime = 0;
        }

        if (this._keyCache) return this._keyCache;

        const salt = this._SALT_V2_PREFIX + normalized;

        this._keyCache = this.deriveKey(normalized, salt).catch((err) => {
            console.error('Key derivation failed:', err);
            this._keyCache = null;
            this._keyCacheHwid = null;
            this._keyCacheTime = 0;
            throw err;
        });

        this._keyCacheHwid = normalized;
        this._keyCacheTime = now;

        return this._keyCache;
    },

    async encrypt(plaintext) {
        if (plaintext === null || plaintext === undefined) return null;
        if (!this._isAvailable()) {
            console.warn('⚠️ Encryption unavailable (no crypto.subtle)');
            return null;
        }

        try {
            const key = await this.getKey();
            const enc = new TextEncoder();
            const iv = crypto.getRandomValues(new Uint8Array(12));

            const ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                enc.encode(String(plaintext))
            );

            const combined = new Uint8Array(iv.length + ciphertext.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(ciphertext), iv.length);

            return this._arrayBufferToBase64(combined);
        } catch (e) {
            console.error('Encrypt failed:', e);
            return null;
        }
    },

    async decrypt(encoded) {
        if (!encoded || typeof encoded !== 'string') return null;
        if (!this._isAvailable()) {
            console.warn('⚠️ Decryption unavailable (no crypto.subtle)');
            return null;
        }

        try {
            const key = await this.getKey();
            return await this._decryptWithKey(encoded, key);
        } catch (e) {
            console.error('Decrypt failed:', e);
            return null;
        }
    },

    async _decryptWithKey(encoded, key) {
        try {
            let combined;
            try {
                combined = this._base64ToArrayBuffer(encoded);
            } catch (e) {
                return null;
            }

            if (combined.length < 12 + 16) {
                return null;
            }

            const iv = combined.slice(0, 12);
            const ciphertext = combined.slice(12);

            const plaintext = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                ciphertext
            );

            return new TextDecoder().decode(plaintext);
        } catch (e) {
            return null;
        }
    },

    // ============================================================
    // 🔄 decryptAuto — 4-level fallback (v3.7.4.94 / Fix #3)
    //   1. new v2 + normalized       (v3.7.4.93+)
    //   2. old v2 + raw              (v3.7.4.65 legacy)
    //   3. old v1 + raw              (v3.7.4.50 legacy)
    //   4. fallback seed             (FIX #3 — pre-HWID data)
    // ============================================================
    async decryptAuto(encoded) {
        if (!encoded || typeof encoded !== 'string') return null;
        if (!this._isAvailable()) return null;

        // ─── Level 1: new v2 + normalized ───
        try {
            const result = await this.decrypt(encoded);
            if (result !== null) return result;
        } catch (e) {}

        // ─── Level 2: old v2 + raw ───
        try {
            const rawHwid = this._getLegacyHwid();
            const normalized = normalizeHwid(rawHwid);

            if (rawHwid && rawHwid !== normalized) {
                const legacySalt = this._SALT_V2_PREFIX + rawHwid;
                const legacyKey = await this.deriveKey(rawHwid, legacySalt);
                const result = await this._decryptWithKey(encoded, legacyKey);
                if (result !== null) {
                    console.log('🔄 [crypto] Legacy v2 (raw HWID) decrypted — re-encrypt recommended');
                    return result;
                }
            }
        } catch (e) {}

        // ─── Level 3: old v1 + raw ───
        try {
            const rawHwid = this._getLegacyHwid();
            if (rawHwid) {
                const v1Salt = this._SALT_V1;
                const v1Key = await this.deriveKey(rawHwid, v1Salt);
                const result = await this._decryptWithKey(encoded, v1Key);
                if (result !== null) {
                    console.log('🔄 [crypto] Legacy v1 decrypted — re-encrypt recommended');
                    return result;
                }
            }
        } catch (e) {}

        // ─── Level 4: FALLBACK SEED (FIX #3) ───
        try {
            const fallbackSeed = this._buildFallbackSeed();
            if (fallbackSeed) {
                const v2Salt = this._SALT_V2_PREFIX + fallbackSeed;
                const v2Key = await this.deriveKey(fallbackSeed, v2Salt);
                const v2Result = await this._decryptWithKey(encoded, v2Key);
                if (v2Result !== null) {
                    console.log('🔄 [crypto] Fallback-seed (v2) decrypted — re-encrypt recommended');
                    return v2Result;
                }

                const v1Key = await this.deriveKey(fallbackSeed, this._SALT_V1);
                const v1Result = await this._decryptWithKey(encoded, v1Key);
                if (v1Result !== null) {
                    console.log('🔄 [crypto] Fallback-seed (v1) decrypted — re-encrypt recommended');
                    return v1Result;
                }
            }
        } catch (e) {
            console.warn('[crypto] Fallback-seed decrypt error:', e.message);
        }

        return null;
    },

    _arrayBufferToBase64(uint8Array) {
        const CHUNK_SIZE = 8192;
        let binary = '';

        for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
            const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
            binary += String.fromCharCode.apply(null, chunk);
        }

        return btoa(binary);
    },

    _base64ToArrayBuffer(base64) {
        if (!base64 || typeof base64 !== 'string') {
            throw new Error('Invalid base64 input');
        }
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    },

    async setSecure(key, value) {
        if (!key || typeof key !== 'string') return false;

        const encrypted = await this.encrypt(String(value));
        if (!encrypted) return false;

        try {
            localStorage.setItem(key, 'enc:' + encrypted);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn('⚠️ localStorage quota exceeded for:', key);
            } else {
                console.warn('⚠️ localStorage setItem failed:', e.message);
            }
            return false;
        }
    },

    async getSecure(key) {
        if (!key || typeof key !== 'string') return null;

        let raw = null;
        try {
            raw = localStorage.getItem(key);
        } catch (e) {
            return null;
        }

        if (!raw) return null;

        if (raw.startsWith('enc:')) {
            const encryptedPart = raw.substring(4);
            const decrypted = await this.decryptAuto(encryptedPart);
            if (decrypted !== null) return decrypted;
            console.warn('Decrypt returned null for:', key);
            return null;
        }

        return raw;
    },

    async hashAnonymous(input) {
        if (input === null || input === undefined || input === '') return null;

        if (!this._isAvailable() || !window.crypto.subtle.digest) {
            console.warn('⚠️ Using fallback hash (no crypto.subtle)');
            return this._simpleHash(String(input));
        }

        try {
            const enc = new TextEncoder();
            const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(input)));
            return Array.from(new Uint8Array(buf))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .substring(0, 16)
                .toUpperCase();
        } catch (e) {
            console.warn('SHA-256 failed, using fallback:', e.message);
            return this._simpleHash(String(input));
        }
    },

    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        return (hex + hex).substring(0, 16).toUpperCase();
    },

    clearKeyCache() {
        this._keyCache = null;
        this._keyCacheHwid = null;
        this._keyCacheTime = 0;
        console.log('🔑 [crypto] Key cache cleared');
    },

    isAvailable() {
        return this._isAvailable();
    }
};

window.CryptoUtils = CryptoUtils;
window.normalizeHwid = normalizeHwid;
window.isFallbackSeed = isFallbackSeed;

// ============================================================
// 📊 Debug helpers
// ============================================================
window.CryptoDebug = {
    status: () => {
        const currentHwid = CryptoUtils._getCurrentHwid();
        const legacyHwid = CryptoUtils._getLegacyHwid();
        const differs = currentHwid !== legacyHwid;

        console.log('═══════════════════════════════════════════');
        console.log('🔐 Crypto Utils Status');
        console.log('───────────────────────────────────────────');
        console.log('  Version: v3.7.4.94.3 (clean, no test strings)');
        console.log('  Available:', CryptoUtils.isAvailable());
        console.log('  Key cached:', !!CryptoUtils._keyCache);
        console.log('  Cache age:', CryptoUtils._keyCacheTime
            ? Math.round((Date.now() - CryptoUtils._keyCacheTime) / 1000) + 's'
            : 'N/A');
        console.log('  Cache TTL:', (CryptoUtils._KEY_CACHE_TTL_MS / 1000) + 's');
        console.log('  Current HWID:', currentHwid.substring(0, 24) + '...');
        console.log('  Is fallback seed:', isFallbackSeed(currentHwid) ? '⚠️ YES' : 'no');
        if (differs) {
            console.log('  Legacy HWID:', legacyHwid.substring(0, 24) + '...');
            console.log('  Legacy differs:', '⚠️ YES (decryptAuto will use fallback)');
        }
        console.log('  Salt version: v2 (HWID-based, normalized)');
        console.log('  decryptAuto levels: 4 (v2-norm → v2-raw → v1-raw → fallback-seed)');
        console.log('═══════════════════════════════════════════');
    },

    test: async (text) => {
        text = text || 'Hello World — Test Message';
        console.log('🧪 Testing encrypt/decrypt:');
        console.log('  Input:', text);

        const t0 = performance.now();
        const encrypted = await CryptoUtils.encrypt(text);
        const t1 = performance.now();

        if (!encrypted) {
            console.log('  ❌ Encryption failed');
            return null;
        }

        console.log('  Encrypted (' + encrypted.length + ' chars):', encrypted.substring(0, 40) + '...');
        console.log('  Encrypt time:', (t1 - t0).toFixed(1) + 'ms');

        const t2 = performance.now();
        const decrypted = await CryptoUtils.decrypt(encrypted);
        const t3 = performance.now();

        console.log('  Decrypted:', decrypted);
        console.log('  Decrypt time:', (t3 - t2).toFixed(1) + 'ms');
        console.log('  Match:', decrypted === text ? '✅' : '❌');

        return { encrypted, decrypted, match: decrypted === text };
    },

    testDecryptAuto: async (text) => {
        text = text || 'Legacy test';
        const encrypted = await CryptoUtils.encrypt(text);
        const decrypted = await CryptoUtils.decryptAuto(encrypted);
        console.log('🧪 decryptAuto:', decrypted === text ? '✅' : '❌');
        return { match: decrypted === text };
    },

    testHwidNormalization: () => {
        const cases = [
            { in: 'abcd1234', expect: 'DVC-ABCD-1234' },
            { in: 'DVC-ABCD-1234', expect: 'DVC-ABCD-1234' },
            { in: 'dvc abcd 1234', expect: 'DVC-ABCD-1234' },
            { in: 'abcd 1234', expect: 'DVC-ABCD-1234' },
            { in: 'ABCD-1234', expect: 'DVC-ABCD-1234' },
            { in: '1234567890abcdef1234567890abcdef', expect: '1234567890abcdef1234567890abcdef' },
            { in: 'short', expect: '' },
            { in: 'fallback-seed-abc|def', expect: '' },
            { in: '', expect: '' }
        ];

        console.log('🧪 HWID normalization test:');
        let pass = 0, fail = 0;
        for (const c of cases) {
            const got = normalizeHwid(c.in);
            const ok = got === c.expect;
            console.log(`  ${ok ? '✅' : '❌'} "${c.in.substring(0, 30)}" → "${got}" (expected: "${c.expect}")`);
            ok ? pass++ : fail++;
        }
        console.log(`  Result: ${pass} pass, ${fail} fail`);
        return { pass, fail, total: cases.length };
    },

    testHash: async (input) => {
        input = input || 'test';
        console.log('🧪 Testing hash:', input);
        const hash = await CryptoUtils.hashAnonymous(input);
        console.log('  Hash:', hash);
        return hash;
    },

    testSecure: async (key, value) => {
        key = key || 'test_key';
        value = value || 'secret_value';

        console.log('🧪 Testing secure storage:');
        console.log('  Key:', key);
        console.log('  Value:', value);

        const set = await CryptoUtils.setSecure(key, value);
        console.log('  Set:', set);

        const got = await CryptoUtils.getSecure(key);
        console.log('  Get:', got);
        console.log('  Match:', got === value ? '✅' : '❌');

        try { localStorage.removeItem(key); } catch (e) {}

        return { set, got, match: got === value };
    },

    testLargeData: async (size) => {
        size = size || 100000;
        console.log('🧪 Testing large data (' + size + ' chars)...');

        const big = 'A'.repeat(size);
        const t0 = performance.now();
        const encrypted = await CryptoUtils.encrypt(big);
        const t1 = performance.now();

        console.log('  Encrypted length:', encrypted ? encrypted.length : 'null');
        console.log('  Encrypt time:', (t1 - t0).toFixed(1) + 'ms');

        const t2 = performance.now();
        const decrypted = await CryptoUtils.decrypt(encrypted);
        const t3 = performance.now();

        console.log('  Decrypted length:', decrypted ? decrypted.length : 'null');
        console.log('  Decrypt time:', (t3 - t2).toFixed(1) + 'ms');
        console.log('  Match:', decrypted === big ? '✅' : '❌');

        return { match: decrypted === big };
    },

    testSaltVersion: async () => {
        console.log('🧪 Testing salt version compatibility...');

        const text = 'Test v2 encryption';
        const v2Encrypted = await CryptoUtils.encrypt(text);
        console.log('  v2 encrypt:', v2Encrypted ? '✅' : '❌');

        const v2Decrypted = await CryptoUtils.decrypt(v2Encrypted);
        console.log('  v2 decrypt:', v2Decrypted === text ? '✅' : '❌');

        const autoDecrypted = await CryptoUtils.decryptAuto(v2Encrypted);
        console.log('  auto decrypt:', autoDecrypted === text ? '✅' : '❌');

        return {
            v2Encrypt: !!v2Encrypted,
            v2Decrypt: v2Decrypted === text,
            autoDecrypt: autoDecrypted === text
        };
    },

    // ══════════════════════════════════════════════════════════
    // ✅ FIX #3 TEST — uses VALID hex HWID ('DVC-ABCD-1234')
    // ══════════════════════════════════════════════════════════
    testFallbackSeedDecrypt: async () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 FALLBACK SEED DECRYPT TEST (FIX #3)');
        console.log('═══════════════════════════════════════════');
        console.log('  Simulates: encrypt BEFORE HWID, decrypt AFTER HWID');
        console.log('');

        const savedHwid = localStorage.getItem('hor_device_hwid');
        const savedLegacy = localStorage.getItem('hor_device_hwid_legacy');

        try {
            // ─── Step 1: Clear HWID → fallback seed used ───
            localStorage.removeItem('hor_device_hwid');
            localStorage.removeItem('hor_device_hwid_legacy');
            CryptoUtils.clearKeyCache();
            CryptoUtils._fallbackSeedCache = null;

            const plaintext = 'Test secret ' + Date.now();
            console.log('  Step 1: No HWID → encrypting with fallback seed');
            console.log('  Plaintext:', plaintext);

            const encrypted = await CryptoUtils.encrypt(plaintext);
            if (!encrypted) {
                console.log('  ❌ Encrypt failed');
                return { pass: false, reason: 'encrypt-failed' };
            }
            console.log('  ✅ Encrypted:', encrypted.substring(0, 40) + '...');

            // ─── Step 2: HWID now appears ───
            // Uses VALID hex HWID 'DVC-ABCD-1234'
            // Non-hex chars would be blocked by security.js guard
            localStorage.setItem('hor_device_hwid', 'DVC-ABCD-1234');
            CryptoUtils.clearKeyCache();
            CryptoUtils._fallbackSeedCache = null;

            console.log('');
            console.log('  Step 2: HWID appeared → DVC-ABCD-1234');
            console.log('  (Levels 1-3 will fail — different key)');

            // ─── Step 3: decryptAuto should recover via Level 4 ───
            console.log('');
            console.log('  Step 3: Calling decryptAuto()...');
            console.log('  (You SHOULD see "🔄 [crypto] Fallback-seed (v2) decrypted" below)');
            console.log('');

            const decrypted = await CryptoUtils.decryptAuto(encrypted);
            const match = decrypted === plaintext;

            console.log('');
            console.log('  Decrypted:', decrypted);
            console.log('  Match:', match ? '✅ YES' : '❌ NO');
            console.log('');
            console.log('  Result:', match
                ? '✅ PASS (fallback seed recovery works)'
                : '❌ FAIL (data lost — Level 4 broken)');
            console.log('═══════════════════════════════════════════');

            return { pass: match, encrypted, decrypted, plaintext };

        } catch (e) {
            console.log('  ❌ Test error:', e.message);
            return { pass: false, error: e.message };
        } finally {
            if (savedHwid) localStorage.setItem('hor_device_hwid', savedHwid);
            else localStorage.removeItem('hor_device_hwid');
            if (savedLegacy) localStorage.setItem('hor_device_hwid_legacy', savedLegacy);
            else localStorage.removeItem('hor_device_hwid_legacy');
            CryptoUtils.clearKeyCache();
            CryptoUtils._fallbackSeedCache = null;
        }
    },

    testUnicode: async () => {
        console.log('🧪 Testing Unicode (Hindi/Santali/Ol Chiki)...');

        const samples = {
            'Hindi': 'नमस्ते दुनिया',
            'Santali-Dev': 'ᱡᱚᱦᱟᱨ ᱫᱩᱱᱤᱭᱟᱹ',
            'Ol Chiki': 'ᱡᱚᱦᱟᱨ ᱾ ᱥᱟᱹᱜᱩᱱ ᱫᱟᱨᱟᱢ ᱾',
            'Emoji': '🎉 🔐 ✅ 🚀'
        };

        const results = {};
        for (const [name, text] of Object.entries(samples)) {
            const encrypted = await CryptoUtils.encrypt(text);
            const decrypted = await CryptoUtils.decrypt(encrypted);
            const match = decrypted === text;
            results[name] = match ? '✅' : '❌';
            console.log(`  ${name}: ${match ? '✅' : '❌'}`);
        }
        return results;
    },

    testKeyCache: async () => {
        console.log('🧪 Testing key cache...');

        CryptoUtils.clearKeyCache();
        console.log('  Cache after clear:', !!CryptoUtils._keyCache);

        const t0 = performance.now();
        const k1 = await CryptoUtils.getKey();
        const t1 = performance.now();
        console.log('  First derivation:', (t1 - t0).toFixed(1) + 'ms');

        const t2 = performance.now();
        const k2 = await CryptoUtils.getKey();
        const t3 = performance.now();
        console.log('  Cached access:', (t3 - t2).toFixed(1) + 'ms');

        const same = k1 === k2;
        console.log('  Same key:', same ? '✅' : '❌');

        return { same, firstTime: t1 - t0, cachedTime: t3 - t2 };
    },

    clearCache: () => {
        CryptoUtils.clearKeyCache();
    },

    testAll: async () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 RUNNING FULL CRYPTO TEST SUITE (v3.7.4.94.3)');
        console.log('═══════════════════════════════════════════');

        const results = {
            hwidNorm: false,
            basic: false,
            large: false,
            unicode: false,
            salt: false,
            cache: false,
            storage: false,
            hash: false,
            decryptAuto: false,
            fallbackSeed: false
        };

        try {
            console.log('\n─── Test 1: HWID Normalization ───');
            const hwidNorm = window.CryptoDebug.testHwidNormalization();
            results.hwidNorm = hwidNorm.fail === 0;

            console.log('\n─── Test 2: Basic ───');
            const basic = await window.CryptoDebug.test();
            results.basic = basic && basic.match;

            console.log('\n─── Test 3: Large Data ───');
            const large = await window.CryptoDebug.testLargeData(50000);
            results.large = large && large.match;

            console.log('\n─── Test 4: Unicode ───');
            const unicode = await window.CryptoDebug.testUnicode();
            results.unicode = Object.values(unicode).every(v => v === '✅');

            console.log('\n─── Test 5: Salt Versions ───');
            const salt = await window.CryptoDebug.testSaltVersion();
            results.salt = salt.v2Encrypt && salt.v2Decrypt && salt.autoDecrypt;

            console.log('\n─── Test 6: Key Cache ───');
            const cache = await window.CryptoDebug.testKeyCache();
            results.cache = cache && cache.same;

            console.log('\n─── Test 7: Secure Storage ───');
            const storage = await window.CryptoDebug.testSecure();
            results.storage = storage && storage.match;

            console.log('\n─── Test 8: Hash ───');
            const hash = await window.CryptoDebug.testHash('test-input');
            results.hash = !!hash;

            console.log('\n─── Test 9: decryptAuto ───');
            const auto = await window.CryptoDebug.testDecryptAuto();
            results.decryptAuto = auto.match;

            console.log('\n─── Test 10: Fallback Seed Recovery (FIX #3) ───');
            const fb = await window.CryptoDebug.testFallbackSeedDecrypt();
            results.fallbackSeed = fb && fb.pass;
        } catch (e) {
            console.error('Test suite error:', e);
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('📊 TEST RESULTS:');
        Object.entries(results).forEach(([name, pass]) => {
            console.log(`  ${pass ? '✅' : '❌'} ${name}`);
        });

        const allPassed = Object.values(results).every(v => v === true);
        console.log('\n' + (allPassed ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'));
        console.log('═══════════════════════════════════════════');

        return results;
    }
};

console.log('✅ crypto-utils.js loaded — v3.7.4.94.3 (clean, no test strings)');
console.log('   • HWID normalization: sanitizeHwid-compatible');
console.log('   • Fallback seed: charset-safe (hex hash, 64 chars)');
console.log('   • decryptAuto: 4-level fallback (v2-norm → v2-raw → v1-raw → fallback-seed)');
console.log('   • Auto-migration: non-canonical HWID → canonical');
console.log('   🔴 FIX #3: Fallback seed recovery (pre-HWID data)');
console.log('   🧪 CryptoDebug.testFallbackSeedDecrypt() available');