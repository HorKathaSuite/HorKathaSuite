// ============================================================
// 🔒 PRIVACY CONSENT — First-time Banner & Management
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// Compliance: India DPDP Act 2023, IT Act 2000, GDPR
//
// ✅ v3.7.4.65 — SECURITY & UX:
//    • Consent decision check: no race condition
//    • Banner dismiss guard (_isBannerDismissing)
//    • Tracker module integration (soft dependency)
//    • Safe DOM lifecycle (appendChild/removeChild)
//    • Animated slide up/down
//    • Mobile responsive
//    • Null-safe all DOM queries
//    • Privacy settings dialog
//    • Full a11y (aria-label, role=region)
// ============================================================

let _isBannerDismissing = false;

// ============================================================
// 📢 SHOW CONSENT BANNER
// ============================================================
function showConsentBanner() {
    'use strict';

    // Check if consent already decided
    try {
        // Priority 1: Tracker module
        if (typeof Tracker !== 'undefined' &&
            typeof Tracker.hasConsentDecision === 'function') {
            if (Tracker.hasConsentDecision()) {
                console.log('🔒 [Privacy] Consent already decided — skipping banner');
                return;
            }
        } else {
            // Priority 2: Direct localStorage check
            const stored = localStorage.getItem('hor_tracking_consent');
            if (stored === 'accepted' || stored === 'declined') {
                console.log('🔒 [Privacy] Consent already decided — skipping banner');
                return;
            }
        }
    } catch (e) {
        console.warn('🔒 [Privacy] Consent check failed:', e.message);
        // Continue with banner — safer to ask again
    }

    // Clean up any stale existing banner
    const existing = document.getElementById('privacyConsentBanner');
    if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
    }

    _isBannerDismissing = false;

    // ─── Create banner element ───
    const banner = document.createElement('div');
    banner.id = 'privacyConsentBanner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Privacy and Data Consent Notice');
    banner.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
        border-top: 3px solid #1f6feb;
        padding: 16px 20px;
        padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        z-index: 100002;
        box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.75);
        animation: slideUpConsent 0.4s ease backwards;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    banner.innerHTML = `
        <style>
            @keyframes slideUpConsent {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slideDownConsent {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(100%); opacity: 0; }
            }
            .pc-content {
                max-width: 960px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
            }
            .pc-icon {
                font-size: 2.2rem;
                line-height: 1;
                flex-shrink: 0;
            }
            .pc-text {
                flex: 1 1 280px;
                color: #c9d1d9;
                font-size: 0.82rem;
                line-height: 1.5;
            }
            .pc-text strong { color: #58a6ff; font-weight: 800; }
            .pc-text b { color: #3fb950; font-weight: 800; }
            .pc-text a {
                color: #58a6ff;
                text-decoration: underline;
                font-weight: 700;
                margin-left: 4px;
            }
            .pc-text a:hover { color: #79c0ff; }
            .pc-buttons {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
                align-items: center;
            }
            .pc-btn {
                padding: 9px 20px;
                border-radius: 6px;
                font-weight: 800;
                font-size: 0.8rem;
                cursor: pointer;
                border: none;
                white-space: nowrap;
                transition: transform 0.15s ease, background 0.15s ease;
            }
            .pc-btn:active { transform: scale(0.96); }
            .pc-btn:focus-visible {
                outline: 2px solid #58a6ff;
                outline-offset: 2px;
            }
            .pc-btn-accept {
                background: #238636;
                color: #ffffff;
                box-shadow: 0 2px 8px rgba(35, 134, 54, 0.4);
            }
            .pc-btn-accept:hover { background: #2ea043; }
            .pc-btn-decline {
                background: transparent;
                color: #8b949e;
                border: 1.5px solid #30363d;
            }
            .pc-btn-decline:hover {
                color: #ef4444;
                border-color: #dc2626;
                background: rgba(220, 38, 38, 0.1);
            }
            @media (max-width: 640px) {
                .pc-content { flex-direction: column; text-align: center; }
                .pc-buttons { width: 100%; justify-content: center; }
                .pc-btn { flex: 1; text-align: center; padding: 11px; }
            }
        </style>
        <div class="pc-content">
            <div class="pc-icon">🔒</div>
            <div class="pc-text">
                <strong>Privacy &amp; Data Notice:</strong> Hum aapke device ka ek <b>anonymous hash</b> track karte hain — sirf Pro license verify karne ke liye।
                Aapki files, documents, passwords ya keystrokes kabhi track <u>nahi</u> hoti।
                <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy पढ़ें →</a>
            </div>
            <div class="pc-buttons">
                <button class="pc-btn pc-btn-decline" id="pcDeclineBtn" type="button">✕ Decline</button>
                <button class="pc-btn pc-btn-accept" id="pcAcceptBtn" type="button">✓ Accept</button>
            </div>
        </div>
    `;

    // ─── Attach to DOM ───
    try {
        document.body.appendChild(banner);
    } catch (e) {
        console.error('🔒 [Privacy] Failed to append banner:', e.message);
        return;
    }

    // ─── Accept handler ───
    const acceptBtn = document.getElementById('pcAcceptBtn');
    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            // Priority 1: Tracker module
            if (typeof Tracker !== 'undefined' && typeof Tracker.setConsent === 'function') {
                Tracker.setConsent(true);
            } else {
                // Priority 2: Direct localStorage
                try {
                    localStorage.setItem('hor_tracking_consent', 'accepted');
                    localStorage.setItem('hor_tracking_consent_date', new Date().toISOString());
                } catch (e) {}
            }

            if (typeof showToast === 'function') {
                showToast('✅ Privacy consent accepted — Pro features enabled', 'success');
            }

            hideConsentBanner();
        });
    }

    // ─── Decline handler ───
    const declineBtn = document.getElementById('pcDeclineBtn');
    if (declineBtn) {
        declineBtn.addEventListener('click', () => {
            // Priority 1: Tracker module
            if (typeof Tracker !== 'undefined' && typeof Tracker.setConsent === 'function') {
                Tracker.setConsent(false);
            } else {
                // Priority 2: Direct localStorage
                try {
                    localStorage.setItem('hor_tracking_consent', 'declined');
                    localStorage.setItem('hor_tracking_consent_date', new Date().toISOString());
                } catch (e) {}
            }

            if (typeof showToast === 'function') {
                showToast('⚠️ Tracking declined — Free mode active', 'warning');
            }

            hideConsentBanner();
        });
    }
}

// ============================================================
// 🚫 HIDE CONSENT BANNER
// ============================================================
function hideConsentBanner() {
    'use strict';

    if (_isBannerDismissing) return;

    const banner = document.getElementById('privacyConsentBanner');
    if (!banner) return;

    _isBannerDismissing = true;
    banner.style.animation = 'slideDownConsent 0.3s ease forwards';

    setTimeout(() => {
        try {
            if (banner.parentNode) {
                banner.parentNode.removeChild(banner);
            }
        } catch (e) {
            console.warn('🔒 [Privacy] Banner removal failed:', e.message);
        }
        _isBannerDismissing = false;
    }, 300);
}

// ============================================================
// ⚙️ PRIVACY SETTINGS DIALOG
// ============================================================
function showPrivacySettings() {
    'use strict';

    let currentConsent = 'not-set';
    let consentDate = 'never';

    try {
        currentConsent = localStorage.getItem('hor_tracking_consent') || 'not-set';
        consentDate = localStorage.getItem('hor_tracking_consent_date') || 'never';
    } catch (e) {
        console.warn('🔒 [Privacy] Could not read consent:', e.message);
    }

    let stats = { totalActivations: 0, lastActivation: 'none' };
    if (typeof Tracker !== 'undefined' && typeof Tracker.getLocalStats === 'function') {
        try {
            stats = Tracker.getLocalStats();
        } catch (e) {}
    }

    let dateFormatted = 'not yet';
    if (consentDate && consentDate !== 'never') {
        try {
            dateFormatted = new Date(consentDate).toLocaleDateString('en-IN');
        } catch (e) {
            dateFormatted = consentDate.split('T')[0] || 'not yet';
        }
    }

    const message =
        '🔒 PRIVACY & CONSENT SETTINGS\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'Status: ' + currentConsent.toUpperCase() + '\n' +
        'Decided on: ' + dateFormatted + '\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '📊 Local Records:\n' +
        '   Saved Receipts: ' + (stats.totalActivations || 0) + '\n' +
        '   Last Active: ' + (stats.lastActivation || 'none') + '\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        'Do you want to change tracking consent?\n' +
        '• Click [OK] to ENABLE tracking (Pro features)\n' +
        '• Click [Cancel] to DISABLE tracking (Free only)';

    if (confirm(message)) {
        // Enable tracking
        if (typeof Tracker !== 'undefined' && typeof Tracker.setConsent === 'function') {
            Tracker.setConsent(true);
        } else {
            try {
                localStorage.setItem('hor_tracking_consent', 'accepted');
                localStorage.setItem('hor_tracking_consent_date', new Date().toISOString());
            } catch (e) {}
        }
        if (typeof showToast === 'function') {
            showToast('✅ Tracking enabled', 'success');
        }
    } else {
        // Disable tracking
        if (typeof Tracker !== 'undefined' && typeof Tracker.setConsent === 'function') {
            Tracker.setConsent(false);
        } else {
            try {
                localStorage.setItem('hor_tracking_consent', 'declined');
                localStorage.setItem('hor_tracking_consent_date', new Date().toISOString());
            } catch (e) {}
        }
        if (typeof showToast === 'function') {
            showToast('⚠️ Tracking disabled', 'warning');
        }
    }
}

// ============================================================
// 🔄 RESET CONSENT (for testing)
// ============================================================
function resetPrivacyConsent() {
    'use strict';

    if (!confirm('Reset privacy consent? (You will be asked again on next load)')) {
        return;
    }

    if (typeof Tracker !== 'undefined' && typeof Tracker.resetConsent === 'function') {
        Tracker.resetConsent();
    } else {
        try {
            localStorage.removeItem('hor_tracking_consent');
            localStorage.removeItem('hor_tracking_consent_date');
        } catch (e) {}
    }

    if (typeof showToast === 'function') {
        showToast('🔄 Privacy consent reset', 'info');
    }

    // Show banner again after a short delay
    setTimeout(() => {
        showConsentBanner();
    }, 500);
}

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
if (typeof window !== 'undefined') {
    window.PrivacyDebug = {
        status: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🔒 Privacy Module Status');
            console.log('───────────────────────────────────────────');
            console.log('  Consent:', (() => {
                try {
                    return localStorage.getItem('hor_tracking_consent') || 'not-set';
                } catch (e) { return 'error'; }
            })());
            console.log('  Consent date:', (() => {
                try {
                    return localStorage.getItem('hor_tracking_consent_date') || 'never';
                } catch (e) { return 'error'; }
            })());
            console.log('  Banner visible:', !!document.getElementById('privacyConsentBanner'));
            console.log('  Banner dismissing:', _isBannerDismissing);
            console.log('  Tracker module:', typeof Tracker !== 'undefined' ? 'loaded' : 'missing');
            console.log('  Tracker enabled:', typeof Tracker !== 'undefined' && Tracker.isEnabled());
            console.log('═══════════════════════════════════════════');
        },

        show: () => {
            console.log('🔒 Showing consent banner (manual)');
            showConsentBanner();
        },

        hide: () => {
            console.log('🔒 Hiding consent banner');
            hideConsentBanner();
        },

        settings: () => {
            showPrivacySettings();
        },

        reset: () => {
            resetPrivacyConsent();
        }
    };
}

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('✅ Privacy module loaded — v3.7.4.65');
console.log('   🔒 DPDP Act 2023 compliant');
console.log('   📢 Consent banner: animated slide up/down');
console.log('   🛡️  Safe DOM lifecycle');
console.log('   🔗 Tracker module integration');
console.log('   ✅ Null-safe all operations');