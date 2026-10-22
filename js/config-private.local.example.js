// ============================================================
// 🔐 CONFIG-PRIVATE.LOCAL.EXAMPLE.JS — REAL SECRETS TEMPLATE
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ HOW TO USE (FIX #3):
//   1. Copy this file:
//         cp js/config-private.local.example.js js/config-private.local.js
//   2. Fill in REAL values below (remove PASTE_... markers)
//   3. Add to .gitignore:
//         echo "js/config-private.local.js" >> .gitignore
//   4. NEVER commit config-private.local.js to Git
//
// ⚠️ CRITICAL PATTERN:
//   ✅ CORRECT:  Object.assign(window.__RUNTIME_CONFIG__, { ...real... });
//   ❌ WRONG:    window.__RUNTIME_CONFIG__ = window.__RUNTIME_CONFIG__ || { ...real... };
//
//   Why? The `||` operator short-circuits if __RUNTIME_CONFIG__ already exists
//   (which it does, because config-private.js sets it first). This means your
//   REAL values would be IGNORED. Object.assign() mutates the existing object
//   instead, so your values correctly override the placeholders.
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 🔑 STEP 1: Initialize namespace (safe if already exists)
// ─────────────────────────────────────────────────────────────
window.__RUNTIME_CONFIG__ = window.__RUNTIME_CONFIG__ || {};

// ─────────────────────────────────────────────────────────────
// 🔑 STEP 2: Apply REAL values via Object.assign
// ─────────────────────────────────────────────────────────────
Object.assign(window.__RUNTIME_CONFIG__, {

    // ═══════════════════════════════════════════════════════
    // 🔐 LICENSE PUBLIC KEY (ECDSA P-256) — REAL VALUES
    // ═══════════════════════════════════════════════════════
    // Generate using: admin/keygen.html
    // ⚠️ Only PUBLIC key goes here (NEVER private key!)
    // ⚠️ x and y MUST be exactly 43 chars each (base64url)
    // ─────────────────────────────────────────────────────
    LICENSE_PUBLIC_KEY_JWK: {
        kty: "EC",
        crv: "P-256",
        x: "PASTE_REAL_X_COORDINATE_HERE_43_CHARS",
        y: "PASTE_REAL_Y_COORDINATE_HERE_43_CHARS"
    },

    // ═══════════════════════════════════════════════════════
    // 📞 CONTACT INFO
    // ═══════════════════════════════════════════════════════
    SUPPORT_WHATSAPP: "919110977117",        // Format: 919110977117 (no +, no spaces)
    SELLER_EMAIL: "bosctechedu@gmail.com",
    DEVELOPER_URL: "https://bosctech.in",

    // ═══════════════════════════════════════════════════════
    // 💰 UPI PAYMENT DETAILS
    // ═══════════════════════════════════════════════════════
    UPI_PRIMARY_ID: "9110977117@ybl",        // e.g. 9110977117@ybl
    UPI_NPCI_ID: "",                         // Optional NPCI ID
    PAYEE_NAME: "BOSC Tech and Edu",

    // ═══════════════════════════════════════════════════════
    // 📊 FIREBASE TRACKING ENDPOINT
    // ═══════════════════════════════════════════════════════
    // Leave empty to disable tracking
    // ─────────────────────────────────────────────────────
    TRACKING_ENDPOINT: "https://your-project.firebasedatabase.app/activations.json",

    // ─── Firebase Individual Config (optional) ───
    FIREBASE_API_KEY: "",
    FIREBASE_AUTH_DOMAIN: "",
    FIREBASE_DATABASE_URL: "",
    FIREBASE_PROJECT_ID: "",
    FIREBASE_STORAGE_BUCKET: "",
    FIREBASE_MESSAGING_SENDER_ID: "",
    FIREBASE_APP_ID: "",
    FIREBASE_MEASUREMENT_ID: "",

    // ═══════════════════════════════════════════════════════
    // 🔐 NAME ENCRYPTION SECRET (CRITICAL)
    // ═══════════════════════════════════════════════════════
    // ⚠️ Minimum 16 characters (32+ HIGHLY recommended)
    // ⚠️ MUST be SAME in tracker.js and dashboard.html
    // ⚠️ NEVER commit real value
    //
    // Generate with:
    //   • Linux/Mac:  openssl rand -base64 32
    //   • Node.js:    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
    // ─────────────────────────────────────────────────────
    NAME_ENCRYPTION_SECRET: "PASTE_YOUR_STRONG_RANDOM_SECRET_HERE_MIN_32_CHARS",

    // ═══════════════════════════════════════════════════════
    // 🌐 ENVIRONMENT INFO
    // ═══════════════════════════════════════════════════════
    NODE_ENV: "production",
    APP_VERSION: "3.7.4"
});

// ─────────────────────────────────────────────────────────────
// 📊 VERIFICATION LOG (runs after override)
// ─────────────────────────────────────────────────────────────
(function() {
    'use strict';

    try {
        const cfg = window.__RUNTIME_CONFIG__;
        const placeholder = /YOUR_|_HERE|REPLACE_|PASTE_|EXAMPLE|CHANGE_ME/i;

        const jwk = cfg.LICENSE_PUBLIC_KEY_JWK;
        const licenseOk = jwk &&
                          jwk.x && jwk.y &&
                          jwk.x.length === 43 &&
                          jwk.y.length === 43 &&
                          !placeholder.test(jwk.x) &&
                          !placeholder.test(jwk.y);

        const nameOk = cfg.NAME_ENCRYPTION_SECRET &&
                       cfg.NAME_ENCRYPTION_SECRET.length >= 16 &&
                       !placeholder.test(cfg.NAME_ENCRYPTION_SECRET);

        console.log('═══════════════════════════════════════════');
        console.log('✅ [config-private.local.js] Loaded');
        console.log('───────────────────────────────────────────');
        console.log('  🔐 License JWK:', licenseOk ? '✅ Real values' : '⚠️ Placeholders remaining');
        console.log('  🔐 Name Secret:', nameOk ? '✅ Real value' : '⚠️ Placeholder remaining');

        if (!licenseOk || !nameOk) {
            console.log('');
            console.warn('⚠️  Some values still have placeholders!');
            console.warn('   Please edit this file and replace all PASTE_... markers.');
        } else {
            console.log('');
            console.log('  ✅ All values configured correctly');
        }
        console.log('═══════════════════════════════════════════');
    } catch (e) {
        console.warn('⚠️ [config-private.local.js] log error:', e.message);
    }
})();