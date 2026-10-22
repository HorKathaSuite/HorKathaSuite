// ============================================================
// 🔥 FIREBASE CONFIG — Admin Dashboard
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ⚠️⚠️⚠️ CRITICAL SECURITY WARNING ⚠️⚠️⚠️
//
// ✅ NEVER commit real Firebase credentials to Git!
//
// SETUP INSTRUCTIONS:
// 1. Copy this file to `firebase-config.local.js`
// 2. Fill real values in `firebase-config.local.js`
// 3. Add to `.gitignore`:
//    - firebase-config.local.js
//    - firebase-config.js (if real values are in this file)
// 4. For production (Vercel/Netlify), use environment variables
// 5. If credentials were ever committed, ROTATE THEM IMMEDIATELY
//    in Firebase Console → Project Settings → Web Apps
//
// Load order in dashboard.html:
//   <script src="firebase-config.js"></script>
//   <script src="firebase-config.local.js"></script>  ← real values override
//
// ============================================================

// ============================================================
// 🌐 FIREBASE CONFIG — SAFE PLACEHOLDERS (Commit-Safe)
// ============================================================
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.REGION.firebasedatabase.app",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "G-XXXXXXXXXX"
};

// ============================================================
// 🛡️ SANITY CHECK & STARTUP LOG
// ============================================================
(function() {
    'use strict';

    try {
        var cfg = window.FIREBASE_CONFIG;
        var missing = [];
        var placeholderPattern = /YOUR_|XXXX|_HERE/i;

        var requiredKeys = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];

        requiredKeys.forEach(function(key) {
            var val = cfg[key];
            if (!val || placeholderPattern.test(String(val))) {
                missing.push(key);
            }
        });

        console.log('═══════════════════════════════════════════');
        console.log('🔥 [firebase-config.js] Loaded');
        console.log('───────────────────────────────────────────');

        if (missing.length > 0) {
            console.warn('⚠️  Firebase config incomplete');
            console.warn('   Missing/placeholder keys:', missing.join(', '));
            console.warn('');
            console.warn('📝 To configure:');
            console.warn('   1. Create firebase-config.local.js');
            console.warn('   2. Add to .gitignore');
            console.warn('   3. Set window.FIREBASE_CONFIG = {...} with real values');
            console.warn('');
            console.warn('   Real values must NEVER be committed to Git!');
        } else {
            console.log('  ✅ Firebase config: ready');
            console.log('  📦 Project:', cfg.projectId);
        }

        console.log('═══════════════════════════════════════════');
    } catch (e) {
        console.warn('⚠️ [firebase-config.js] startup log failed:', e.message);
    }
})();