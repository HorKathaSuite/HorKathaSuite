// ============================================================
// 🪟 MODALS — Progress + QR + Flash + All Modal Logic
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 (Fixed & Optimized)
// ============================================================
// ✅ FIX #2 APPLIED — Trial Constraints Fail-Closed
//    • checkTrialConstraints: offline/no-endpoint/network-error → BLOCK
//    • markTrialAsUsed: must-await + retry, returns {success: boolean}
//    • verifyTrialOtp: email/mobile lock FIRST, then activate
// ============================================================

'use strict';

// ============================================================
// 📧 EMAILJS CONFIGURATION (✅ REAL KEYS)
// ============================================================
const EMAILJS_SERVICE_ID  = "service_rhb4vnb";
const EMAILJS_TEMPLATE_ID = "template_c3fxm0s";
const EMAILJS_PUBLIC_KEY  = "koeLHtRSGsK_l-nm7";

if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY && EMAILJS_TEMPLATE_ID) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    console.log('✅ EmailJS Initialized with REAL keys');
} else {
    console.warn('⚠️ EmailJS NOT initialized — OTP will fail.');
}

// ============================================================
// 🛡️ SAFE CONFIG READER (HARDCODED UPI & WHATSAPP)
// ============================================================
function _getConfigValue(key, fallback = '') {
    if (key === 'UPI_PRIMARY_ID') return '9110977117@ybl';
    if (key === 'PAYEE_NAME') return 'BOSC Tech and Edu';
    if (key === 'SUPPORT_WHATSAPP') return '919110977117';

    try {
        const cfg = window.APP_CONFIG || window.__RUNTIME_CONFIG__ || {};
        const val = cfg[key];
        if (val === null || val === undefined) return fallback;
        const str = String(val).trim();
        const isPlaceholder = /^(YOUR_|REPLACE_|PASTE_)|(_HERE)$/i.test(str);
        if (str.length === 0 || isPlaceholder) return fallback;
        return str;
    } catch (e) {
        return fallback;
    }
}

// ============================================================
// 📊 GLOBAL STATE
// ============================================================
let deferredPrompt = null;
let isVoiceEnabled = true;
let isHoverVoiceEnabled = false;
let isClickSoundEnabled = true;
let isPhoneticEnabled = false;
let currentDonateAmount = 251;
let currentSelectedPrice = 199;
let currentSelectedPlanTitle = "P1 — Community Single PC (₹199 Offer)";
let lastActiveChar = '';
let lastActiveEmoji = '';
let _isProcessingPayment = false;
let _activeFlashes = [];
window._currentWaMsg = '';

// ============================================================
// 🎯 QR FALLBACK CONFIG
// ============================================================
const _QR_PROVIDERS = [
    { template: 'https://api.qrserver.com/v1/create-qr-code/?size={SIZE}x{SIZE}&data={DATA}&ecc=H&margin=4&format=png', timeout: 4000 },
    { template: 'https://quickchart.io/qr?text={DATA}&size={SIZE}&ecLevel=H&margin=4&format=png', timeout: 5000 },
    { template: 'https://api.qrserver.com/v1/create-qr-code/?size={SIZE}x{SIZE}&data={DATA}&ecc=M&margin=2&format=png', timeout: 6000 }
];
const _QR_TOTAL_TIMEOUT_MS = 15000;

// ============================================================
// 🛡️ SAFE INTEGER HELPER
// ============================================================
function _safeInt(val, min = 0, max = 999999, fallback = 0) {
    const n = parseInt(val, 10);
    if (isNaN(n)) return Math.max(min, Math.min(max, fallback));
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

// ============================================================
// 🛡️ MOBILE NORMALIZER (Indian format)
// ============================================================
function _normalizeMobile(mobile) {
    let m = String(mobile || '').replace(/[^0-9]/g, '');
    if (m.startsWith('0')) m = m.substring(1);
    if (m.startsWith('91') && m.length > 10) m = m.slice(-10);
    return m;
}

// ============================================================
// 🛡️ ESCAPE HTML
// ============================================================
function _escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}
const _escapeKeyboardHtml = _escapeHtml;
const escapeFlashHtml = _escapeHtml;

// ============================================================
// ⏳ PROGRESS OVERLAY
// ============================================================
function showProgress(title, label) {
    const overlay = document.getElementById('progressOverlay');
    if (!overlay) return;
    const titleEl = document.getElementById('progressTitle');
    const labelEl = document.getElementById('progressLabel');
    const fillEl = document.getElementById('progressFill');
    if (titleEl) titleEl.textContent = title || 'Processing...';
    if (labelEl) labelEl.textContent = label || 'Please wait';
    if (fillEl) fillEl.style.width = '0%';
    overlay.style.display = 'flex';
    overlay.classList.add('active');
}

function setProgress(percent, label) {
    const p = _safeInt(percent, 0, 100, 0);
    const fillEl = document.getElementById('progressFill');
    const labelEl = document.getElementById('progressLabel');
    if (fillEl) fillEl.style.width = p + '%';
    if (labelEl && label) labelEl.textContent = label;
}

function hideProgress() {
    const overlay = document.getElementById('progressOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.style.display = 'none';
}

window.showProgress = showProgress;
window.setProgress = setProgress;
window.hideProgress = hideProgress;

// ============================================================
// 📸 QR RENDER — OFFLINE-FIRST
// ============================================================
function renderQRCode(elementId, text, size = 200) {
    const container = document.getElementById(elementId);
    if (!container) return;

    if (!text || text.trim().length === 0) {
        container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;color:#dc2626;font-size:0.7rem;font-weight:700;text-align:center;padding:8px;"><div style="font-size:1.5rem;">⚠️</div><div>Payment Gateway Not Configured</div><div style="font-size:0.6rem;color:#64748b;margin-top:4px;">Please contact support</div></div>`;
        return;
    }

    container.innerHTML = '';
    container.removeAttribute('style');

    container.style.setProperty('width', size + 'px', 'important');
    container.style.setProperty('height', size + 'px', 'important');
    container.style.setProperty('min-width', size + 'px', 'important');
    container.style.setProperty('min-height', size + 'px', 'important');
    container.style.setProperty('max-width', size + 'px', 'important');
    container.style.setProperty('max-height', size + 'px', 'important');
    container.style.setProperty('background', '#ffffff', 'important');
    container.style.setProperty('padding', '8px', 'important');
    container.style.setProperty('box-sizing', 'border-box', 'important');
    container.style.setProperty('display', 'flex', 'important');
    container.style.setProperty('align-items', 'center', 'important');
    container.style.setProperty('justify-content', 'center', 'important');
    container.style.setProperty('border-radius', '8px', 'important');

    const qrSize = size - 16;

    if (_tryOfflineQR(container, text, qrSize)) {
        return;
    }
    _renderViaNetwork(container, text, size, qrSize);
}

function _tryOfflineQR(container, text, qrSize) {
    try {
        if (typeof window.OfflineQRCode === 'undefined' || typeof window.OfflineQRCode.render !== 'function') {
            return false;
        }
        const success = window.OfflineQRCode.render(container, text, qrSize, 'M');
        if (success === true) return true;
        container.innerHTML = '';
        return false;
    } catch (e) {
        container.innerHTML = '';
        return false;
    }
}

function _renderViaNetwork(container, text, size, qrSize) {
    const encodedText = encodeURIComponent(text);
    let providerIndex = 0;
    let rendered = false;

    container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#64748b;font-size:0.7rem;font-weight:700;"><div style="font-size:1.5rem;">⏳</div><div>Loading QR...</div></div>`;

    const totalTimeoutId = setTimeout(() => {
        if (rendered) return;
        rendered = true;
        _showQRFailure(container, new Error('Network timeout'));
    }, _QR_TOTAL_TIMEOUT_MS);

    function tryNextProvider() {
        if (rendered) return;
        if (providerIndex >= _QR_PROVIDERS.length) {
            clearTimeout(totalTimeoutId);
            rendered = true;
            _showQRFailure(container, new Error('All providers failed'));
            return;
        }

        const provider = _QR_PROVIDERS[providerIndex];
        const providerUrl = provider.template.replace('{SIZE}', qrSize).replace(/{DATA}/g, encodedText);
        container.innerHTML = '';

        const img = document.createElement('img');
        img.alt = 'Scan QR Code';
        img.style.cssText = `width: 100%; height: 100%; display: block; object-fit: contain; image-rendering: pixelated; background: #ffffff;`;

        let loadTimeout = setTimeout(() => {
            if (!rendered) {
                img.onload = null;
                img.onerror = null;
                providerIndex++;
                tryNextProvider();
            }
        }, provider.timeout);

        img.onload = function() {
            clearTimeout(loadTimeout);
            if (rendered) return;
            rendered = true;
            clearTimeout(totalTimeoutId);
            container.innerHTML = '';
            container.appendChild(img);
        };

        img.onerror = function() {
            clearTimeout(loadTimeout);
            if (rendered) return;
            providerIndex++;
            tryNextProvider();
        };
        img.src = providerUrl;
    }
    tryNextProvider();
}

function _showQRFailure(container, err) {
    if (!container) return;
    const upiId = _getConfigValue('UPI_PRIMARY_ID', '');
    const upiDisplay = upiId || 'Not Configured';
    container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;color:#dc2626;text-align:center;font-size:0.7rem;font-weight:700;padding:8px;gap:4px;">
            <div style="font-size:1.5rem;">⚠️</div>
            <div>QR Load Failed</div>
            <div style="font-size:0.6rem;color:#64748b;">Manual UPI:</div>
            <div style="font-size:0.65rem;color:#0f172a;background:#fff;padding:3px 8px;border-radius:4px;font-family:monospace;font-weight:900;word-break:break-all;">
                ${_escapeHtml(upiDisplay)}
            </div>
        </div>
    `;
}

const _MiniQR = {
    render: function(container, text, size) {
        if (typeof window.OfflineQRCode === 'undefined' || typeof window.OfflineQRCode.render !== 'function') return false;
        return window.OfflineQRCode.render(container, text, size || 200, 'M');
    }
};

// ============================================================
// 💰 GET PAYMENT URL
// ============================================================
function _getPaymentURL(amount, note) {
    const upiId = _getConfigValue('UPI_PRIMARY_ID', '');
    const payeeName = _getConfigValue('PAYEE_NAME', 'Merchant');
    const tn = note || 'Hor Katha Payment';

    if (!upiId) return '';

    let safeAmount = Number(amount);
    if (isNaN(safeAmount) || safeAmount < 0.01) safeAmount = 0.01;
    if (safeAmount > 100000) safeAmount = 100000;

    const amt = Number.isInteger(safeAmount) ? String(safeAmount) : safeAmount.toFixed(2);
    const enc = (s) => encodeURIComponent(String(s)).replace(/%40/g, '@').replace(/%2D/g, '-').replace(/%5F/g, '_').replace(/%2E/g, '.');

    let url = `upi://pay?pa=${enc(upiId)}&pn=${enc(payeeName)}&am=${amt}&cu=INR&tn=${enc(tn)}`;
    if (url.length > 500) {
        url = `upi://pay?pa=${enc(upiId)}&pn=${enc(payeeName)}&am=${amt}&cu=INR&tn=${enc('Payment')}`;
    }
    return url;
}

// ============================================================
// ✅ MODAL GUARD
// ============================================================
function _canOpenModal(modalName) {
    if (window.__appReady === true) {
        if (document.__modalWaitStart) delete document.__modalWaitStart;
        return true;
    }
    if (!document.getElementById('appSplash')) {
        delete document.__modalWaitStart;
        return true;
    }
    const startTime = Date.now();
    const waitMax = 3000;
    if (document.__modalWaitStart) {
        const elapsed = Date.now() - document.__modalWaitStart;
        if (elapsed > waitMax) {
            delete document.__modalWaitStart;
            return true;
        }
    } else {
        document.__modalWaitStart = startTime;
    }
    return false;
}

// ============================================================
// 🎬 FLASH MESSAGE SYSTEM
// ============================================================
function showFlash(options = {}) {
    const container = document.getElementById('flashContainer');
    if (!container) return null;

    const { type = 'info', icon = 'ℹ️', title = '', subtitle = '', body = '', duration = 6000, compact = false, onClose = null } = options;

    const flash = document.createElement('div');
    flash.className = `flash-message flash-${type}${compact ? ' flash-compact' : ''}`;

    let bodyHTML = body ? `<div class="flash-body">${body}</div>` : '';

    flash.innerHTML = `
        <div class="flash-header">
            <div class="flash-icon">${icon}</div>
            <div style="flex: 1; min-width: 0;">
                <div class="flash-title">${_escapeHtml(title)}</div>
                ${subtitle ? `<div class="flash-subtitle">${_escapeHtml(subtitle)}</div>` : ''}
            </div>
            <button class="flash-close" aria-label="Close">✕</button>
        </div>
        ${bodyHTML}
        <div class="flash-progress"><div class="flash-progress-bar"></div></div>
    `;

    container.appendChild(flash);
    _activeFlashes.push(flash);

    const closeBtn = flash.querySelector('.flash-close');
    let closed = false;

    function escHandler(e) {
        if (e.key === 'Escape' && _activeFlashes[_activeFlashes.length - 1] === flash) {
            closeFlash();
        }
    }

    function closeFlash() {
        if (closed) return;
        closed = true;
        if (typeof onClose === 'function') { try { onClose(); } catch (e) {} }
        flash.classList.add('flash-out');
        setTimeout(() => {
            if (flash.parentNode) flash.parentNode.removeChild(flash);
            const idx = _activeFlashes.indexOf(flash);
            if (idx > -1) _activeFlashes.splice(idx, 1);
        }, 400);
        document.removeEventListener('keydown', escHandler);
    }

    closeBtn.addEventListener('click', closeFlash);

    const safeDuration = Math.max(0, Math.min(60000, Number(duration) || 6000));
    if (safeDuration > 0) {
        const progressBar = flash.querySelector('.flash-progress-bar');
        if (progressBar) {
            progressBar.style.transition = `width ${safeDuration}ms linear`;
            requestAnimationFrame(() => { progressBar.style.width = '0%'; });
        }
        setTimeout(closeFlash, safeDuration);
    }
    document.addEventListener('keydown', escHandler);
    return flash;
}

function showToast(message, type = 'info', duration = 3500) {
    const iconMap = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const titleMap = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };
    return showFlash({
        type, icon: iconMap[type] || 'ℹ️', title: titleMap[type] || 'Info',
        subtitle: message, duration: Math.max(0, Math.min(60000, duration)), compact: true
    });
}

const toastSuccess = (m) => showToast(m, 'success');
const toastError   = (m) => showToast(m, 'error');
const toastWarning = (m) => showToast(m, 'warning');
const toastInfo    = (m) => showToast(m, 'info');

// ============================================================
// 💬 WHATSAPP PREVIEW MODAL & MESSAGE GENERATOR
// ============================================================
function showWaMessagePreview(type) {
    let msg = '';
    if (type === 'pro') {
        const name = document.getElementById('buyCustomerName')?.value.trim() || '';
        const email = document.getElementById('buyCustomerEmail')?.value.trim() || '';
        const mobile = document.getElementById('buyCustomerMobile')?.value.trim() || '';

        if (!name || !email || !mobile) {
            toastWarning('कृपया Name, Email और Mobile तीनों भरें! (एक भी खाली न रहे)');
            return;
        }

        const selectedText = document.getElementById('selectedPlanLabel')?.innerText || 'Selected: P1 — Community (₹199)';
        const plan = selectedText.replace('Selected: ', '');
        const amount = plan.match(/₹\d+/)?.[0] || '₹199';

        msg = `*💳 PAYMENT DONE — Hor Katha Suite*\n\n👤 *Name:* ${name}\n📧 *Email:* ${email}\n📱 *Mobile:* ${mobile}\n\n💎 *Plan:* ${plan}\n💵 *Amount:* ${amount}\n\n━━━━━━━━━━━━━━━━━━━━\n✅ मैंने payment कर दिया है।\n📸 Screenshot इसी chat में भेज रहा हूँ\n🔑 कृपया License Key भेजें।`;
    } else if (type === 'trial') {
        const name = document.getElementById('trialCustomerName')?.value.trim() || '';
        const email = document.getElementById('trialCustomerEmail')?.value.trim() || '';
        const mobile = document.getElementById('trialCustomerMobile')?.value.trim() || '';

        if (!name || !email || !mobile) {
            toastWarning('कृपया Name, Email और Mobile तीनों भरें! (एक भी खाली न रहे)');
            return;
        }

        const date = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });

        msg = `*🎁 ₹9 TRIAL REQUEST — Hor Katha Suite*\n\n👤 *Name:* ${name}\n📧 *Email:* ${email}\n📱 *Mobile:* ${mobile}\n\n💵 *Amount:* ₹9\n📅 *Date:* ${date}\n\n━━━━━━━━━━━━━━━━━━━━\n✅ मैंने ₹9 का payment कर दिया है।\n📸 Payment screenshot इसी chat में भेज रहा हूँ।\n🔑 कृपया Trial Key भेजें (Format: HKT-XXXXXXX-XXXX)`;
    }

    window._currentWaMsg = msg;
    const msgEl = document.getElementById('waMessageText');
    if (msgEl) msgEl.textContent = msg;

    const modal = document.getElementById('waMessageModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    }

    const copyBtn = document.getElementById('btnCopyWaMsg');
    if(copyBtn) {
        copyBtn.innerHTML = '📋 Copy Message';
        copyBtn.style.background = '#f1f5f9';
        copyBtn.style.color = '#475569';
        copyBtn.style.borderColor = 'transparent';
    }
}

function copyWaMessageText() {
    if (!window._currentWaMsg) return;
    navigator.clipboard.writeText(window._currentWaMsg).then(() => {
        const btn = document.getElementById('btnCopyWaMsg');
        if (!btn) return;
        btn.innerHTML = '✅ Copied!';
        btn.style.background = '#dcfce7';
        btn.style.color = '#166534';
        btn.style.borderColor = '#16a34a';

        setTimeout(() => {
            btn.innerHTML = '📋 Copy Message';
            btn.style.background = '#f1f5f9';
            btn.style.color = '#475569';
            btn.style.borderColor = 'transparent';
        }, 2000);
    }).catch(err => {
        toastError('Failed to copy message.');
    });
}

function sendWaMessageNow() {
    if (!window._currentWaMsg) return;
    const adminWa = _getConfigValue('SUPPORT_WHATSAPP', '');

    if (!adminWa) {
        toastError('Support WhatsApp number not configured.');
        return;
    }

    window.open(`https://wa.me/${adminWa}?text=${encodeURIComponent(window._currentWaMsg)}`, '_blank');
    const modal = document.getElementById('waMessageModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

// ============================================================
// 🔒 FIX #2: TRIAL CONSTRAINTS (FAIL-CLOSED)
// ============================================================
// 1 Email / 1 Mobile per Trial — Firebase MANDATORY है।
// Offline / No-endpoint / Network-error → hard BLOCK.
// localStorage clear करके bypass असंभव है।
// ============================================================
async function checkTrialConstraints(email, mobile) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = _normalizeMobile(mobile);

    // ── Fast local check (turant fail — UI responsive) ──
    // यह सिर्फ early-exit के लिए है, security के लिए नहीं
    try {
        const usedEmails = JSON.parse(localStorage.getItem('hor_used_trial_emails') || '[]');
        const usedMobiles = JSON.parse(localStorage.getItem('hor_used_trial_mobiles') || '[]');

        if (usedEmails.includes(cleanEmail)) {
            return { valid: false, reason: 'यह Email पहले ही Trial के लिए उपयोग हो चुका है।' };
        }
        if (usedMobiles.includes(cleanMobile)) {
            return { valid: false, reason: 'यह Mobile नंबर पहले ही Trial के लिए उपयोग हो चुका है।' };
        }
    } catch (e) {
        // localStorage corrupt → ignore, server check करेंगे
    }

    // ── Guard 1: TrialSystem available ──
    if (typeof TrialSystem === 'undefined' || typeof TrialSystem._fbGet !== 'function') {
        return { valid: false, reason: 'Trial system unavailable — page refresh करें।' };
    }

    // ── Guard 2: Firebase endpoint configured ──
    const baseUrl = typeof TrialSystem._getFirebaseBaseUrl === 'function'
        ? TrialSystem._getFirebaseBaseUrl()
        : null;
    if (!baseUrl) {
        console.error('❌ CRITICAL: Firebase endpoint not configured — Trial blocked (bypass prevented)');
        return { valid: false, reason: 'Server not configured. Admin से contact करें।' };
    }

    // ── Guard 3: Internet available ──
    if (!navigator.onLine) {
        return { valid: false, reason: 'Trial activation के लिए internet ज़रूरी है। Internet check करके retry करें।' };
    }

    // ── Server verification (MANDATORY) ──
    try {
        const emailCheck = await TrialSystem._fbGet(`trial_used_emails/${encodeURIComponent(cleanEmail)}`);

        if (!emailCheck.ok) {
            console.warn('[Constraint] Email check failed:', emailCheck.error);
            return { valid: false, reason: 'Server verification failed — internet check करके retry करें।' };
        }
        if (emailCheck.data) {
            return { valid: false, reason: 'यह Email पहले ही Trial के लिए उपयोग हो चुका है (सर्वर)।' };
        }

        const mobileCheck = await TrialSystem._fbGet(`trial_used_mobiles/${encodeURIComponent(cleanMobile)}`);

        if (!mobileCheck.ok) {
            console.warn('[Constraint] Mobile check failed:', mobileCheck.error);
            return { valid: false, reason: 'Server verification failed — internet check करके retry करें।' };
        }
        if (mobileCheck.data) {
            return { valid: false, reason: 'यह Mobile नंबर पहले ही Trial के लिए उपयोग हो चुका है (सर्वर)।' };
        }
    } catch (e) {
        console.warn('[Constraint] Exception:', e.message);
        return { valid: false, reason: 'Server verification failed — retry करें।' };
    }

    return { valid: true };
}

// ============================================================
// 🔒 FIX #2: MARK TRIAL AS USED (MUST-AWAIT + RETRY)
// ============================================================
// अब यह function { success: true/false } return करता है।
// Server write fail हो तो caller को पता चलेगा — silent bypass नहीं।
// ============================================================
async function markTrialAsUsed(email, mobile) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = _normalizeMobile(mobile);

    // ── Local update (fast, best-effort) ──
    try {
        const usedEmails = JSON.parse(localStorage.getItem('hor_used_trial_emails') || '[]');
        if (!usedEmails.includes(cleanEmail)) {
            usedEmails.push(cleanEmail);
            localStorage.setItem('hor_used_trial_emails', JSON.stringify(usedEmails));
        }

        const usedMobiles = JSON.parse(localStorage.getItem('hor_used_trial_mobiles') || '[]');
        if (!usedMobiles.includes(cleanMobile)) {
            usedMobiles.push(cleanMobile);
            localStorage.setItem('hor_used_trial_mobiles', JSON.stringify(usedMobiles));
        }
    } catch (e) {
        console.warn('[markTrialAsUsed] LocalStorage update failed:', e.message);
    }

    // ── Server write (MANDATORY — fail-closed) ──
    if (typeof TrialSystem === 'undefined' || typeof TrialSystem._fbSet !== 'function') {
        return { success: false, reason: 'Trial system unavailable' };
    }

    const baseUrl = typeof TrialSystem._getFirebaseBaseUrl === 'function'
        ? TrialSystem._getFirebaseBaseUrl()
        : null;
    if (!baseUrl) {
        return { success: false, reason: 'Server not configured' };
    }
    if (!navigator.onLine) {
        return { success: false, reason: 'Offline — server sync failed' };
    }

    // ── Retry with backoff (3 attempts) ──
    const MAX_RETRIES = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const emailWrite = await TrialSystem._fbSet(
                `trial_used_emails/${encodeURIComponent(cleanEmail)}`,
                { usedAt: Date.now(), attempt }
            );
            if (!emailWrite.ok) {
                lastError = emailWrite.error;
                throw new Error(`Email write failed: ${emailWrite.error}`);
            }

            const mobileWrite = await TrialSystem._fbSet(
                `trial_used_mobiles/${encodeURIComponent(cleanMobile)}`,
                { usedAt: Date.now(), attempt }
            );
            if (!mobileWrite.ok) {
                lastError = mobileWrite.error;
                throw new Error(`Mobile write failed: ${mobileWrite.error}`);
            }

            console.log(`[markTrialAsUsed] ✅ Server records saved (attempt ${attempt})`);
            return { success: true };
        } catch (e) {
            lastError = e.message;
            console.warn(`[markTrialAsUsed] Attempt ${attempt}/${MAX_RETRIES} failed:`, e.message);

            if (attempt < MAX_RETRIES) {
                const delay = 1000 * Math.pow(2, attempt - 1);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    return { success: false, reason: `Server write failed after ${MAX_RETRIES} attempts: ${lastError}` };
}

// ============================================================
// 🎁 TRIAL ACTIVATION MODAL
// ============================================================
async function openTrialActivationModal() {
    if (!_canOpenModal('openTrialActivationModal')) return;
    const modal = document.getElementById('trialActivationModal');
    if (!modal) return;

    const keyInput = document.getElementById('trialKeyInput');
    if (keyInput) keyInput.value = '';

    const statusEl = document.getElementById('trialActivationStatus');
    if (statusEl) { statusEl.className = 'trm-status'; statusEl.textContent = ''; }

    const qrBox = document.getElementById('trialQrBox');
    if (qrBox) { qrBox.innerHTML = ''; qrBox.removeAttribute('style'); }

    const btn = document.getElementById('btnTrialActivate');
    if (btn) {
        btn.innerHTML = '📩 Send OTP';
        btn.onclick = sendTrialOtp;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
    const otpSection = document.getElementById('trialOtpSection');
    if (otpSection) otpSection.style.display = 'none';
    const otpInput = document.getElementById('trialOtpInput');
    if (otpInput) otpInput.value = '';

    try {
        sessionStorage.removeItem('hor_trial_pending_otp');
        sessionStorage.removeItem('hor_trial_pending_otp_time');
        sessionStorage.removeItem('hor_trial_pending_key');
        sessionStorage.removeItem('hor_trial_pending_email');
        sessionStorage.removeItem('hor_trial_pending_mobile');
    } catch(e) {}

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    const trialPrice = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.TRIAL_PRICE) || 9;
    const upiUrl = _getPaymentURL(trialPrice, 'Hor Katha 7-Day Trial');

    requestAnimationFrame(() => renderQRCode('trialQrBox', upiUrl, 220));
}

function closeTrialActivationModal() {
    const modal = document.getElementById('trialActivationModal');
    if (modal) modal.style.display = 'none';

    const statusEl = document.getElementById('trialActivationStatus');
    if (statusEl) { statusEl.className = 'trm-status'; statusEl.textContent = ''; }

    const btn = document.getElementById('btnTrialActivate');
    if (btn) {
        btn.innerHTML = '📩 Send OTP';
        btn.onclick = sendTrialOtp;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
    const otpSection = document.getElementById('trialOtpSection');
    if (otpSection) otpSection.style.display = 'none';
    const otpInput = document.getElementById('trialOtpInput');
    if (otpInput) otpInput.value = '';

    _unlockBodyScroll();
}

// ============================================================
// 1. OTP भेजने का फंक्शन (Trial के लिए)
// ============================================================
async function sendTrialOtp() {
    const name = document.getElementById('trialCustomerName')?.value.trim() || '';
    const email = document.getElementById('trialCustomerEmail')?.value.trim() || '';
    let mobile = document.getElementById('trialCustomerMobile')?.value.trim() || '';
    const keyInput = document.getElementById('trialKeyInput');
    const statusEl = document.getElementById('trialActivationStatus');
    const btn = document.getElementById('btnTrialActivate');
    const key = (keyInput?.value || '').trim().toUpperCase();

    if (!name || !email || !mobile || !key) {
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ कृपया सभी फील्ड भरें!'; }
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ सही Email डालें!'; }
        return;
    }

    mobile = _normalizeMobile(mobile);
    if (!/^[0-9]{10,15}$/.test(mobile)) {
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ सही मोबाइल नंबर डालें (10-15 अंक)!'; }
        return;
    }
    if (!/^HKT-\d{7}-[A-F0-9]{4}$/.test(key)) {
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ गलत Key Format! (HKT-1234567-ABCD)'; }
        return;
    }

    if (btn) { btn.innerHTML = '⏳ Checking...'; btn.disabled = true; btn.style.opacity = '0.7'; btn.style.cursor = 'wait'; }
    if (statusEl) { statusEl.className = 'trm-status loading'; statusEl.textContent = '⏳ जाँच हो रही है...'; }

    const constraintCheck = await checkTrialConstraints(email, mobile);
    if (!constraintCheck.valid) {
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ ' + constraintCheck.reason; }
        if (btn) { btn.innerHTML = '📩 Send OTP'; btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
        return;
    }

    if (statusEl) statusEl.textContent = '⏳ OTP भेजा जा रहा है...';

    try {
        const otp = Math.floor(100000 + Math.random() * 900000);

        sessionStorage.setItem('hor_trial_pending_otp', otp);
        sessionStorage.setItem('hor_trial_pending_otp_time', Date.now());
        sessionStorage.setItem('hor_trial_pending_key', key);
        sessionStorage.setItem('hor_trial_pending_email', email.trim().toLowerCase());
        sessionStorage.setItem('hor_trial_pending_mobile', mobile);

        if (typeof emailjs === 'undefined') throw new Error('EmailJS SDK not loaded');

        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: email,
            otp: otp,
            app_name: "Hor Katha Suite Trial"
        });

        if (statusEl) {
            statusEl.className = 'trm-status success';
            statusEl.textContent = '✅ OTP आपके ईमेल पर भेज दिया गया है!';
        }

        const otpSection = document.getElementById('trialOtpSection');
        if (otpSection) otpSection.style.display = 'block';

        if (btn) {
            btn.innerHTML = '🔓 Verify & Activate';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.onclick = verifyTrialOtp;
        }

        const otpInput = document.getElementById('trialOtpInput');
        if (otpInput) otpInput.focus();

    } catch (e) {
        console.error('Trial OTP failed:', e);
        if (statusEl) {
            statusEl.className = 'trm-status error';
            statusEl.textContent = '❌ OTP भेजने में विफल: ' + (e.text || e.message);
        }
        if (btn) { btn.innerHTML = '📩 Send OTP'; btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
    }
}

// ============================================================
// 2. 🔒 FIX #2: OTP VERIFY + TRIAL ACTIVATE (ORDER FIXED)
// ============================================================
// अब order बदला है: पहले server पर email/mobile lock करें,
// फिर trial activate करें। अगर lock fail → activation BLOCK.
// ============================================================
async function verifyTrialOtp() {
    const otpInput = document.getElementById('trialOtpInput');
    const statusEl = document.getElementById('trialActivationStatus');
    const enteredOtp = (otpInput?.value || '').trim();

    const savedOtp = sessionStorage.getItem('hor_trial_pending_otp');
    const savedTime = sessionStorage.getItem('hor_trial_pending_otp_time');
    const savedKey = sessionStorage.getItem('hor_trial_pending_key');
    const pendingEmail = sessionStorage.getItem('hor_trial_pending_email');
    const pendingMobile = sessionStorage.getItem('hor_trial_pending_mobile');

    // ── Guard: OTP exists ──
    if (!savedOtp || !savedTime || !savedKey) {
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ OTP expire हो गया है, कृपया दोबारा Send OTP दबाएं।'; }
        return;
    }

    // ── Guard: OTP expiry (5 min) ──
    if (Date.now() - parseInt(savedTime, 10) > 300000) {
        sessionStorage.removeItem('hor_trial_pending_otp');
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ OTP expire हो गया है!'; }
        return;
    }

    // ── Guard: OTP match ──
    if (enteredOtp !== savedOtp.toString()) {
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ गलत OTP! कृपया फिर से प्रयास करें।'; }
        return;
    }

    // ── Guard: Email/Mobile unchanged ──
    const currentEmail = (document.getElementById('trialCustomerEmail')?.value || '').trim().toLowerCase();
    const currentMobile = _normalizeMobile(document.getElementById('trialCustomerMobile')?.value || '');

    if (pendingEmail && currentEmail !== pendingEmail) {
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ Email बदला गया है — वही email डालें जो OTP भेजते समय था।'; }
        return;
    }
    if (pendingMobile && currentMobile !== pendingMobile) {
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ Mobile बदला गया है — वही नंबर डालें जो OTP भेजते समय था।'; }
        return;
    }

    if (statusEl) { statusEl.className = 'trm-status loading'; statusEl.textContent = '⏳ Server पर email/mobile lock हो रहे हैं...'; }

    // ═══════════════════════════════════════════════════════
    // STEP 1: Server पर email/mobile LOCK करें (MANDATORY)
    // अगर यह fail → trial activate नहीं करेंगे (fail-closed)
    // ═══════════════════════════════════════════════════════
    let lockResult;
    try {
        lockResult = await markTrialAsUsed(currentEmail, currentMobile);
    } catch (e) {
        lockResult = { success: false, reason: e.message };
    }

    if (!lockResult.success) {
        if (statusEl) {
            statusEl.className = 'trm-status error';
            statusEl.textContent = '❌ Server sync failed: ' + (lockResult.reason || 'Unknown error') + ' — Internet check करके retry करें।';
        }
        return;
    }

    // ═══════════════════════════════════════════════════════
    // STEP 2: Trial activate करें (email/mobile अब locked हैं)
    // ═══════════════════════════════════════════════════════
    if (statusEl) { statusEl.className = 'trm-status loading'; statusEl.textContent = '⏳ Trial Key verify हो रही है...'; }

    try {
        if (typeof TrialSystem === 'undefined' || !TrialSystem.activateWithKey) {
            throw new Error('Trial system unavailable');
        }

        const result = await TrialSystem.activateWithKey(savedKey);

        if (result.success) {
            if (statusEl) {
                statusEl.className = 'trm-status success';
                statusEl.textContent = '✅ Trial activated! 7 days unlocked.';
            }

            showFlash({
                type: 'success',
                icon: '🎉',
                title: 'Trial Activated!',
                subtitle: '7 Days Full Access',
                body: '<p>सभी Pro features अब unlocked हैं।</p>',
                duration: 6000
            });

            sessionStorage.removeItem('hor_trial_pending_otp');
            sessionStorage.removeItem('hor_trial_pending_otp_time');
            sessionStorage.removeItem('hor_trial_pending_key');
            sessionStorage.removeItem('hor_trial_pending_email');
            sessionStorage.removeItem('hor_trial_pending_mobile');

            setTimeout(async () => {
                if (typeof checkLicenseIntegrity === 'function') await checkLicenseIntegrity();
                setTimeout(() => {
                    closeTrialActivationModal();
                    setTimeout(() => location.reload(), 500);
                }, 1500);
            }, 800);
        } else {
            if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ ' + (result.reason || 'Invalid trial key'); }
        }
    } catch (e) {
        if (statusEl) { statusEl.className = 'trm-status error'; statusEl.textContent = '❌ ' + e.message; }
    }
}

function sendTrialPaymentToWhatsApp() {
    showWaMessagePreview('trial');
}

// ============================================================
// 🔑 TRIAL KEY AUTO-FORMAT
// ============================================================
(function setupTrialKeyAutoFormat() {
    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById('trialKeyInput');
        if (!input) return;

        function formatTrialKey(val) {
            val = (val || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (val.startsWith('HKT')) val = val.substring(3);
            let formatted = 'HKT';
            if (val.length > 0) formatted += '-' + val.substring(0, 7);
            if (val.length > 7) formatted += '-' + val.substring(7, 11);
            return formatted;
        }

        input.addEventListener('input', function() { this.value = formatTrialKey(this.value); });

        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text');
            const start = this.selectionStart || 0;
            const end = this.selectionEnd || 0;
            const before = this.value.substring(0, start);
            const after = this.value.substring(end);
            this.value = formatTrialKey(before + pasted + after);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); sendTrialOtp(); }
            if (e.key === 'Escape') { e.preventDefault(); closeTrialActivationModal(); }
        });
    });
})();

function selectTrialPlan() {
    currentSelectedPrice = 9;
    currentSelectedPlanTitle = '₹9 Trial — 7 Days';
    closeBuyModal();
    setTimeout(() => {
        if (typeof openTrialActivationModal === 'function') openTrialActivationModal();
    }, 300);
}

// ============================================================
// 💖 DONATE MODAL
// ============================================================
function openDonateModal() {
    if (!_canOpenModal('openDonateModal')) return;
    const modal = document.getElementById('donateModal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    const pills = document.querySelectorAll('.donate-choice-pill');
    setDonateAmount(251, pills[2] || null);
}

function closeDonateModal() {
    const modal = document.getElementById('donateModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

function setDonateAmount(amount, pillElement = null) {
    currentDonateAmount = _safeInt(amount, 1, 100000, 251);
    if (pillElement) {
        const input = document.getElementById('customDonateInput');
        if (input) input.value = '';
    }
    document.querySelectorAll('.donate-choice-pill').forEach(c => c.classList.remove('active-pill'));
    if (pillElement) pillElement.classList.add('active-pill');
    updateDonateQR();
}

function handleCustomDonateInput(val) {
    const amt = _safeInt(val, 0, 100000, 0);
    if (amt && amt > 0) {
        currentDonateAmount = amt;
        document.querySelectorAll('.donate-choice-pill').forEach(c => c.classList.remove('active-pill'));
        updateDonateQR();
    }
}

function updateDonateQR() {
    const label = document.getElementById('donateAmountLabel');
    if (label) label.textContent = `Selected: ₹${currentDonateAmount}`;
    const upiUrl = _getPaymentURL(currentDonateAmount, 'Hor Katha Support');
    renderQRCode('donateQrBox', upiUrl, 220);
}

function redirectToWhatsAppDonate() {
    const suppWa = _getConfigValue('SUPPORT_WHATSAPP', '');
    if (!suppWa) {
        showToast('❌ Support WhatsApp number not configured', 'error', 3000);
        return;
    }
    const msg = encodeURIComponent(`नमस्ते BOSC Tech & Edu,\nमैंने Hoṛ Katha Suite के लिए ₹${currentDonateAmount} का सहयोग भेजा है।\nAmount: ₹${currentDonateAmount}`);
    window.open(`https://wa.me/${suppWa}?text=${msg}`, '_blank', 'noopener,noreferrer');
}

// ============================================================
// 🛒 BUY MODAL
// ============================================================
async function openBuyModal() {
    if (!_canOpenModal('openBuyModal')) return;

    const licInput = document.getElementById('licCustomerName');
    const buyInput = document.getElementById('buyCustomerName');
    if (licInput && buyInput) buyInput.value = licInput.value || '';

    const dvcBuy = document.getElementById('buyDeviceIdDisplay');
    if (dvcBuy) {
        try {
            if (typeof getDeviceHardwareFingerprint === 'function') {
                dvcBuy.value = await getDeviceHardwareFingerprint();
            }
        } catch (e) {
            dvcBuy.value = 'DVC-XXXX-XXXX';
        }
    }

    const chk = document.getElementById('paymentConfirmCheck');
    const btn = document.getElementById('btnPaymentDone');
    if (chk) chk.checked = false;

    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }

    const waBtn = document.getElementById('btn-wa-buy');
    if (waBtn) {
        waBtn.disabled = true;
        waBtn.style.opacity = '0.5';
        waBtn.style.cursor = 'not-allowed';
    }

    _isProcessingPayment = false;

    document.body.classList.add('modal-open');
    const modal = document.getElementById('buyModal');
    if (modal) modal.style.display = 'flex';

    selectPlan(199, 'P1 — Community (₹199)', 'cardPlan1');
}

function closeBuyModal() {
    const modal = document.getElementById('buyModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

function selectPlan(price, title, cardId) {
    const safePrice = _safeInt(price, 1, 100000, 199);
    currentSelectedPrice = safePrice;
    currentSelectedPlanTitle = String(title || 'Selected Plan').substring(0, 100);

    document.querySelectorAll('.bm-plan').forEach(c => c.classList.remove('active-plan'));
    const card = document.getElementById(cardId);
    if (card) {
        card.classList.add('active-plan');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    }

    const label = document.getElementById('selectedPlanLabel');
    if (label) label.textContent = `Selected: ₹${currentSelectedPrice} Plan`;

    const buyTopBtn = document.getElementById('btn-buy-top');
    if (buyTopBtn) {
        buyTopBtn.textContent = '💳';
        buyTopBtn.setAttribute('title', `Buy Pro License — ₹${currentSelectedPrice}`);
    }

    const upiUrl = _getPaymentURL(currentSelectedPrice, 'Hor Katha Pro License');
    renderQRCode('upiQrCodeBox', upiUrl, 180);
}

// ============================================================
// 🔐 LICENSE MODAL & OTP LOGIC (PRO LICENSE)
// ============================================================
async function openLicenseModal() {
    if (!_canOpenModal('openLicenseModal')) return;

    const licName = document.getElementById('licCustomerName');
    const licKey = document.getElementById('licCustomerKey');
    const dvcDisplay = document.getElementById('userDeviceIdDisplay');

    if (dvcDisplay) {
        try {
            if (typeof getDeviceHardwareFingerprint === 'function') {
                dvcDisplay.value = await getDeviceHardwareFingerprint();
            }
        } catch (e) {
            dvcDisplay.value = 'DVC-XXXX-XXXX';
        }
    }

    let savedName = '';
    let savedKey = '';
    let savedEmail = '';
    let savedMobile = '';

    try {
        savedName = localStorage.getItem('hor_lic_user') || '';
        savedKey = localStorage.getItem('hor_lic_key') || '';
        savedEmail = localStorage.getItem('hor_lic_email') || '';
        savedMobile = localStorage.getItem('hor_lic_mobile') || '';
    } catch (e) {}

    if (licName) licName.value = savedName;
    if (licKey) licKey.value = savedKey;

    const licEmail = document.getElementById('licCustomerEmail');
    const licMobile = document.getElementById('licCustomerMobile');
    if (licEmail) licEmail.value = savedEmail;
    if (licMobile) licMobile.value = savedMobile;

    const otpSection = document.getElementById('otpSection');
    if (otpSection) otpSection.style.display = 'none';

    const btnSendOtp = document.getElementById('btnSendOtp');
    if (btnSendOtp) {
        btnSendOtp.innerHTML = '📩 Send OTP';
        btnSendOtp.onclick = sendLicenseOtp;
        btnSendOtp.style.display = 'inline-block';
        btnSendOtp.disabled = false;
        btnSendOtp.style.opacity = '1';
    }

    const otpInput = document.getElementById('licOtpInput');
    if (otpInput) otpInput.value = '';

    try {
        sessionStorage.removeItem('hor_pending_otp');
        sessionStorage.removeItem('hor_pending_otp_time');
    } catch(e) {}

    const modal = document.getElementById('licenseModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeLicenseModal() {
    const modal = document.getElementById('licenseModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

// OTP भेजने का फंक्शन (Pro License के लिए)
async function sendLicenseOtp() {
    const nameEl = document.getElementById('licCustomerName');
    const emailEl = document.getElementById('licCustomerEmail');
    const mobileEl = document.getElementById('licCustomerMobile');
    const keyEl = document.getElementById('licCustomerKey');
    const btnSendOtp = document.getElementById('btnSendOtp');

    const name = nameEl ? nameEl.value.trim() : '';
    const email = emailEl ? emailEl.value.trim() : '';
    let mobile = mobileEl ? mobileEl.value.trim() : '';
    const key = keyEl ? keyEl.value.trim() : '';

    if (!name || !email || !mobile || !key) { toastWarning('कृपया सभी फील्ड भरें!'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toastError('सही Email डालें!'); return; }

    mobile = _normalizeMobile(mobile);
    if (!/^[0-9]{10,15}$/.test(mobile)) { toastError('सही मोबाइल नंबर डालें (10-15 अंक)!'); return; }

    if (btnSendOtp) {
        btnSendOtp.innerHTML = '⏳ Verifying...';
        btnSendOtp.disabled = true;
        btnSendOtp.style.opacity = '0.7';
    }
    showProgress('Verifying Key...', 'Checking signature');
    setProgress(30, 'Parsing payload');

    try {
        const check = await verifyLicensePayload(name, email, mobile, key);
        if (!check.valid) {
            hideProgress();
            toastError(`अमान्य की: ${check.reason}`);
            if (btnSendOtp) { btnSendOtp.innerHTML = '📩 Send OTP'; btnSendOtp.disabled = false; btnSendOtp.style.opacity = '1'; }
            return;
        }

        setProgress(70, 'Sending Email...');
        const otp = Math.floor(100000 + Math.random() * 900000);
        sessionStorage.setItem('hor_pending_otp', otp);
        sessionStorage.setItem('hor_pending_otp_time', Date.now());

        if (typeof emailjs === 'undefined') throw new Error('EmailJS SDK not loaded');

        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: email, otp: otp, app_name: "Hor Katha Suite"
        });

        hideProgress();
        toastSuccess('✅ OTP आपके ईमेल पर भेज दिया गया है!');
        document.getElementById('otpSection').style.display = 'block';

        if (btnSendOtp) {
            btnSendOtp.innerHTML = '✅ Verify & Activate';
            btnSendOtp.disabled = false;
            btnSendOtp.style.opacity = '1';
            btnSendOtp.onclick = verifyLicenseOtp;
        }
        document.getElementById('licOtpInput').focus();

    } catch (e) {
        hideProgress();
        toastError('OTP भेजने में विफल: ' + (e.text || e.message));
        if (btnSendOtp) { btnSendOtp.innerHTML = '📩 Send OTP'; btnSendOtp.disabled = false; btnSendOtp.style.opacity = '1'; }
    }
}

// OTP वेरिफाई और लाइसेंस एक्टिवेट (Pro License के लिए)
async function verifyLicenseOtp() {
    const otpInput = document.getElementById('licOtpInput');
    const enteredOtp = otpInput ? otpInput.value.trim() : '';

    const savedOtp = sessionStorage.getItem('hor_pending_otp');
    const savedTime = sessionStorage.getItem('hor_pending_otp_time');

    if (!savedOtp || !savedTime) {
        toastError('OTP expire हो गया है, कृपया दोबारा Send OTP दबाएं।');
        return;
    }

    if (Date.now() - parseInt(savedTime, 10) > 300000) {
        sessionStorage.removeItem('hor_pending_otp');
        sessionStorage.removeItem('hor_pending_otp_time');
        toastError('OTP expire हो गया है!');
        return;
    }

    if (enteredOtp !== savedOtp.toString()) {
        toastError('गलत OTP! कृपया फिर से प्रयास करें।');
        return;
    }

    const name = document.getElementById('licCustomerName').value.trim();
    const email = document.getElementById('licCustomerEmail').value.trim();
    const mobile = _normalizeMobile(document.getElementById('licCustomerMobile').value);
    const key = document.getElementById('licCustomerKey').value.trim().toUpperCase();

    try {
        localStorage.setItem('hor_lic_user', name);
        localStorage.setItem('hor_lic_email', email);
        localStorage.setItem('hor_lic_mobile', mobile);
        localStorage.setItem('hor_lic_key', key);
    } catch (e) {}

    isProLicensed = true;

    let planCode = 'P1';
    try { planCode = key.split('-')[1] || 'P1'; } catch(e) {}

    applyProState(name, planCode, true);

    sessionStorage.removeItem('hor_pending_otp');
    sessionStorage.removeItem('hor_pending_otp_time');

    toastSuccess('🎉 सफल! आपका Pro License एक्टिवेट हो गया है।');

    setTimeout(() => {
        closeLicenseModal();
        location.reload();
    }, 1500);
}

// ============================================================
// 💳 PAYMENT COMPLETED
// ============================================================
function generateReceiptNumber() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    let seq = parseInt(localStorage.getItem('hor_receipt_seq') || '0', 10) + 1;
    let prefix = '';
    let cycle = Math.floor((seq - 1) / 1000);
    let cycleType = cycle % 4;

    if (cycleType === 0) prefix = 'BOSC';
    else if (cycleType === 1) prefix = 'TECH';
    else if (cycleType === 2) prefix = 'EDU';
    else if (cycleType === 3) prefix = 'BOSCT&E';

    let numInCycle = seq - (cycle * 1000);
    let numStr = String(numInCycle).padStart(2, '0');

    localStorage.setItem('hor_receipt_seq', seq);
    return `HK-${yy}${mm}${dd}${hh}${mi}${ss}-${numStr}${prefix}`;
}

function getISTTimestamp() {
    try {
        return new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch (e) {
        return new Date().toLocaleString();
    }
}

async function onPaymentCompleted() {
    if (_isProcessingPayment) return;

    const paymentCheck = document.getElementById('paymentConfirmCheck');
    if (paymentCheck && !paymentCheck.checked) {
        toastWarning('कृपया पहले confirm करें!');
        return;
    }

    const name = document.getElementById('buyCustomerName')?.value.trim() || '';
    const email = document.getElementById('buyCustomerEmail')?.value.trim() || '';
    const mobile = document.getElementById('buyCustomerMobile')?.value.trim() || '';

    if (!name || !email || !mobile) {
        toastWarning('कृपया Name, Email और Mobile तीनों भरें!');
        return;
    }

    _isProcessingPayment = true;
    const btn = document.getElementById('btnPaymentDone');

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Processing...';
            btn.style.opacity = '0.8';
        }

        let hwid = 'Unknown';
        try {
            if (typeof getDeviceHardwareFingerprint === 'function') {
                hwid = await getDeviceHardwareFingerprint() || 'Unknown';
            }
        } catch (e) {}

        const receiptNo = generateReceiptNumber();
        const timestamp = getISTTimestamp();
        const plan = currentSelectedPlanTitle;
        const amount = currentSelectedPrice;

        if (!confirm(`Payment की पुष्टि करें:\n\nName: ${name}\nEmail: ${email}\nMobile: ${mobile}\nPlan: ${plan}\nAmount: ₹${amount}`)) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '✅ Payment हो गया? — Confirm करें<br><span>(Receipt + WhatsApp Order — Auto)</span>';
                btn.style.opacity = '1';
            }
            _isProcessingPayment = false;
            return;
        }

        try {
            const all = JSON.parse(localStorage.getItem('hor_receipts') || '[]');
            all.push({ receiptNo, name, email, mobile, hwid, plan, amount, timestamp });
            if (all.length > 500) all.shift();
            localStorage.setItem('hor_receipts', JSON.stringify(all));
        } catch (e) {}

        closeBuyModal();
        showWaMessagePreview('pro');

        setTimeout(() => {
            showReceiptModal({ receiptNo, name, email, mobile, hwid, plan, amount, timestamp });
        }, 600);

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '✅ Payment हो गया? — Confirm करें<br><span>(Receipt + WhatsApp Order — Auto)</span>';
            btn.style.opacity = '1';
        }

    } catch (e) {
        console.error('Payment processing failed:', e);
        toastError('Payment failed: ' + e.message);
    } finally {
        setTimeout(() => { _isProcessingPayment = false; }, 1000);
    }
}

function redirectToWhatsAppBuy() {
    const name = document.getElementById('buyCustomerName')?.value.trim() || '';
    const email = document.getElementById('buyCustomerEmail')?.value.trim() || '';
    const mobile = document.getElementById('buyCustomerMobile')?.value.trim() || '';

    if (!name || !email || !mobile) {
        toastWarning('कृपया Name, Email और Mobile तीनों भरें!');
        return;
    }

    const chk = document.getElementById('paymentConfirmCheck');
    if (!chk || !chk.checked) {
        toastWarning('⚠️ कृपया पहले payment confirm checkbox पर टिक करें!');
        return;
    }

    onPaymentCompleted();
}

// ============================================================
// 🧾 RECEIPT MODAL
// ============================================================
function showReceiptModal(record) {
    const modal = document.getElementById('receiptModal');
    if (!modal) return;

    if (!record || typeof record !== 'object') {
        console.warn('showReceiptModal: invalid record');
        return;
    }

    const fields = {
        rcptNumber: record.receiptNo || '-',
        rcptDate: record.timestamp || '-',
        rcptName: record.name || '-',
        rcptDevice: record.hwid || '-',
        rcptEmail: record.email || '-',
        rcptMobile: record.mobile || '-',
        rcptPlan: record.plan || '-',
        rcptAmount: '₹' + (record.amount || 0)
    };

    Object.keys(fields).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = fields[id];
    });

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeReceiptModal() {
    const m = document.getElementById('receiptModal');
    if (m) m.style.display = 'none';
    _unlockBodyScroll();
}

function copyReceiptNumber() {
    const el = document.getElementById('rcptNumber');
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => toastSuccess('Copied!'));
}

function shareReceiptOnWhatsApp() {
    const sellerWa = _getConfigValue('SUPPORT_WHATSAPP', '');

    if (!sellerWa) {
        showToast('❌ Support WhatsApp number not configured', 'error', 3000);
        return;
    }

    const el = document.getElementById('rcptNumber');
    const rn = el ? el.textContent : 'N/A';
    const msg = `🧾 Receipt: *${rn}*\n✅ Payment Done`;
    window.open(`https://wa.me/${sellerWa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
}

// ============================================================
// 🎨 TOGGLES
// ============================================================
function toggleClickSound() {
    isClickSoundEnabled = !isClickSoundEnabled;
    const btn = document.getElementById('btn-sound-toggle');
    if (btn) {
        btn.textContent = isClickSoundEnabled ? '🔊' : '🔇';
        btn.title = isClickSoundEnabled ? 'Sound: ON' : 'Sound: OFF';
    }
}

function toggleHoverVoice() {
    isHoverVoiceEnabled = !isHoverVoiceEnabled;
    const btn = document.getElementById('btn-hover-voice');
    if (btn) {
        btn.textContent = isHoverVoiceEnabled ? '🗣️' : '🤐';
        btn.title = isHoverVoiceEnabled ? 'Hover Voice: ON' : 'Hover Voice: OFF';
    }
}

function toggleVoiceOutput() {
    isVoiceEnabled = !isVoiceEnabled;
    const btn = document.getElementById('btn-voice-toggle');
    if (btn) {
        btn.textContent = isVoiceEnabled ? '🎧' : '🔇';
        btn.title = isVoiceEnabled ? 'TTS: ON' : 'TTS: OFF';
    }
}

function togglePhoneticTranslit() {
    isPhoneticEnabled = !isPhoneticEnabled;
    const btn = document.getElementById('btn-phonetic-toggle');
    if (btn) {
        btn.textContent = isPhoneticEnabled ? '✨ Translit: ON' : '✨ Translit: OFF';
        btn.classList.toggle('active-state', isPhoneticEnabled);
    }
}

function toggleTheme() {
    const body = document.body;
    const ct = body.getAttribute('data-theme') || 'dark';
    const nt = ct === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', nt);
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
        btn.textContent = nt === 'dark' ? '🌙' : '☀️';
        btn.title = nt === 'dark' ? 'Theme: Dark' : 'Theme: Light';
    }
    try { localStorage.setItem('hor_katha_theme', nt); } catch (e) {}
}

function toggleZenMode() {
    const isZen = document.body.classList.toggle('zen-mode');
    const btn = document.getElementById('btn-zen-mode');
    if (btn) {
        btn.textContent = '🧘';
        btn.title = isZen ? 'Zen Mode: ON' : 'Zen Mode: OFF';
        btn.classList.toggle('active-state', isZen);
    }
}

// ============================================================
// 📦 HELPERS
// ============================================================
function _unlockBodyScroll() {
    document.body.classList.remove('modal-open');
    const openModals = document.querySelectorAll('.modal-overlay, .preview-modal');
    let hasOpenModal = false;
    openModals.forEach(m => {
        if (m.style.display === 'flex' || m.style.display === 'block') hasOpenModal = true;
    });
    if (!hasOpenModal) document.body.classList.remove('modal-open');
}

function handleModalOutsideClick(e, modalId) {
    if (!e || !e.target || !modalId) return;
    if (e.target.id === modalId) {
        const m = document.getElementById(modalId);
        if (m) m.style.display = 'none';
        _unlockBodyScroll();
    }
}

function deleteLastInBox(boxId) {
    const box = document.getElementById(boxId);
    if (!box || !box.value) return;
    if (window.Intl && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        const segments = Array.from(segmenter.segment(box.value)).map(s => s.segment);
        box.value = segments.slice(0, -1).join('');
    } else {
        box.value = Array.from(box.value).slice(0, -1).join('');
    }
}

function clearBox(boxId) {
    const box = document.getElementById(boxId);
    if (box) box.value = '';
}

function copyFromBox(boxId) {
    const box = document.getElementById(boxId);
    if (!box || !box.value) return;
    const text = box.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => toastSuccess('Copied!')).catch(() => _fallbackCopyBox(text));
    } else {
        _fallbackCopyBox(text);
    }
}

function _fallbackCopyBox(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) toastSuccess('Copied!'); else toastError('Copy failed');
    } catch (e) { toastError('Copy failed'); }
}

function insertFromBox(boxId, modalId) {
    const box = document.getElementById(boxId);
    if (box && box.value) {
        if (typeof addCharWithPhonics === 'function') addCharWithPhonics(box.value);
        if (modalId) {
            const m = document.getElementById(modalId);
            if (m) m.style.display = 'none';
        }
    }
}

function _restoreFocusModeIfActive() {
    if (document.body.classList.contains('typing-focus')) {
        setTimeout(() => {
            const editor = document.getElementById('editor');
            if (editor) { try { editor.focus(); } catch (e) {} }
        }, 100);
    }
}

// ============================================================
// 📲 PWA INSTALL
// ============================================================
function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((r) => {
            if (r.outcome === 'accepted') {
                const pwaBtn = document.getElementById('pwa-install-btn');
                if (pwaBtn) pwaBtn.textContent = '✅ Installed';
            }
            deferredPrompt = null;
        });
    } else {
        alert('ब्राउज़र मेनू (⋮) से "Install app" चुनें।\n\nया\n\nChrome/Edge में address bar के right side में install icon देखें।');
    }
}

// ============================================================
// 🔤 FONTS
// ============================================================
function loadGoogleFontDynamically(gfont) {
    if (!gfont || !navigator.onLine) return;
    try {
        const fontId = 'gfont-' + gfont.replace(/[^a-zA-Z0-9]/g, '-');
        if (!document.getElementById(fontId)) {
            const link = document.createElement('link');
            link.id = fontId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${gfont}&display=swap`;
            document.head.appendChild(link);
        }
    } catch (e) {}
}

function autoSyncLanguageFonts(langKey) {
    const fontDropdown = document.getElementById('fontFamilySelect');
    if (!fontDropdown) return;

    if (typeof languageFontsDB === 'undefined') {
        fontDropdown.innerHTML = `<option value="'Roboto', sans-serif" selected>Roboto</option><option value="'Inter', sans-serif">Inter</option><option value="'Arial', sans-serif">Arial</option>`;
        changeFontFamily("'Roboto', sans-serif");
        return;
    }

    const fonts = languageFontsDB[langKey] || languageFontsDB['english'];
    if (!fonts || !Array.isArray(fonts) || fonts.length === 0) return;

    fontDropdown.innerHTML = '';
    let defaultFontVal = null;

    fonts.forEach((f) => {
        if (!f || !f.val) return;
        const opt = document.createElement('option');
        opt.value = f.val;
        opt.textContent = f.name || 'Unknown Font';
        if (f.gfont) opt.setAttribute('data-gfont', f.gfont);
        if (f.default) {
            opt.selected = true;
            defaultFontVal = f.val;
            if (f.gfont) loadGoogleFontDynamically(f.gfont);
        }
        fontDropdown.appendChild(opt);
    });

    if (!defaultFontVal && fonts[0] && fonts[0].val) defaultFontVal = fonts[0].val;
    if (defaultFontVal) changeFontFamily(defaultFontVal);
}

function changeFontFamily(family) {
    const editor = document.getElementById('editor');
    if (!editor || !family || typeof family !== 'string') return;
    editor.style.fontFamily = family;
    const fd = document.getElementById('fontFamilySelect');
    if (fd && fd.selectedOptions && fd.selectedOptions.length > 0) {
        const gfont = fd.selectedOptions[0].getAttribute('data-gfont');
        if (gfont) loadGoogleFontDynamically(gfont);
    }
    if (typeof updateStatusFont === 'function') updateStatusFont(family);
}

function forceInitFontDropdown() {
    const currentLayoutVal = window.currentLayout || 'english';
    autoSyncLanguageFonts(currentLayoutVal);
}
window.forceInitFontDropdown = forceInitFontDropdown;

// ============================================================
// 🔣 CHAR MAP
// ============================================================
function openCharMapModal() {
    if (!_canOpenModal('openCharMapModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('Character Map')) return;
    const fontSelect = document.getElementById('fontSelect');
    if (fontSelect) fontSelect.value = window.currentLayout || 'english';
    const searchInput = document.getElementById('charmapSearchInput');
    if (searchInput) searchInput.value = '';
    buildCharMatrix(window.currentLayout || 'english');
    const copyBox = document.getElementById('copyBox');
    if (copyBox) copyBox.value = '';
    const modal = document.getElementById('charmapModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeCharMapModal() {
    const modal = document.getElementById('charmapModal');
    if (modal) modal.style.display = 'none';
    hideZoomLens();
    _unlockBodyScroll();
    _restoreFocusModeIfActive();
}

function onScriptMapSelect(scriptKey) {
    const input = document.getElementById('charmapSearchInput');
    if (input) input.value = '';
    buildCharMatrix(scriptKey);
}

function filterCharMap(term) {
    const sel = document.getElementById('fontSelect');
    if (sel) buildCharMatrix(sel.value, term.trim());
}

function buildCharMatrix(scriptKey, filter = '') {
    const fragment = document.createDocumentFragment();
    const charmapMatrix = document.getElementById('charmapMatrix');
    const charmapZoomLens = document.getElementById('charmapZoomLens');
    const charmapMatrixWrap = document.getElementById('charmapMatrixWrap');
    const nameEl = document.getElementById('charNameDisplay');
    const hexEl = document.getElementById('charHexDisplay');

    if (!charmapMatrix || !charmapZoomLens || !charmapMatrixWrap) return;
    if (typeof scriptLibraries === 'undefined') return;

    let list = scriptLibraries[scriptKey] || scriptLibraries['english'];
    if (filter) list = list.filter(ch => ch.toLowerCase().includes(filter.toLowerCase()));

    list.forEach(ch => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = ch;

        cell.addEventListener('mouseenter', () => {
            if (typeof handleHoverSpeech === 'function') handleHoverSpeech(ch);
            charmapZoomLens.textContent = ch;
            charmapZoomLens.style.display = 'flex';
            const rect = cell.getBoundingClientRect();
            const wrapRect = charmapMatrixWrap.getBoundingClientRect();
            charmapZoomLens.style.left = (rect.left - wrapRect.left + rect.width / 2) + 'px';
            charmapZoomLens.style.top = (rect.top - wrapRect.top) + 'px';
            if (nameEl) nameEl.textContent = `Character: ${ch}`;
            if (hexEl) {
                const codeHex = Array.from(ch).map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
                hexEl.textContent = `Unicode: ${codeHex}`;
            }
        });

        cell.addEventListener('mouseleave', hideZoomLens);

        cell.onclick = () => {
            if (typeof speakLetter === 'function') speakLetter(ch);
            document.querySelectorAll('#charmapMatrix .cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            lastActiveChar = ch;
            const box = document.getElementById('copyBox');
            if (box) box.value += ch;
        };
        fragment.appendChild(cell);
    });
    charmapMatrix.replaceChildren(fragment);
}

function hideZoomLens() {
    const el = document.getElementById('charmapZoomLens');
    if (el) el.style.display = 'none';
}

function hideEmojiZoomLens() {
    const el = document.getElementById('emojiZoomLens');
    if (el) el.style.display = 'none';
}

// ============================================================
// 😀 EMOJI MODAL
// ============================================================
function openEmojiModal() {
    if (!_canOpenModal('openEmojiModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('Emoji Palette')) return;
    const sel = document.getElementById('emojiCategorySelect');
    if (sel) sel.value = 'smileys';
    const searchInput = document.getElementById('emojiSearchInput');
    if (searchInput) searchInput.value = '';
    buildEmojiMatrix('smileys');
    const box = document.getElementById('emojiCopyBox');
    if (box) box.value = '';
    const modal = document.getElementById('emojiModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeEmojiModal() {
    const modal = document.getElementById('emojiModal');
    if (modal) modal.style.display = 'none';
    hideEmojiZoomLens();
    _unlockBodyScroll();
    _restoreFocusModeIfActive();
}

function onEmojiCategorySelect(catKey) {
    const input = document.getElementById('emojiSearchInput');
    if (input) input.value = '';
    buildEmojiMatrix(catKey);
}

function filterEmoji(term) {
    const sel = document.getElementById('emojiCategorySelect');
    if (sel) buildEmojiMatrix(sel.value, term.trim());
}

function buildEmojiMatrix(catKey, filter = '') {
    const fragment = document.createDocumentFragment();
    const emojiMatrix = document.getElementById('emojiMatrix');
    const emojiZoomLens = document.getElementById('emojiZoomLens');
    const emojiMatrixWrap = document.getElementById('emojiMatrixWrap');
    const nameEl = document.getElementById('emojiNameDisplay');

    if (!emojiMatrix || !emojiZoomLens || !emojiMatrixWrap) return;
    if (typeof emojiLibraries === 'undefined') return;

    let list = emojiLibraries[catKey] || emojiLibraries['smileys'];
    if (filter) list = list.filter(e => e.includes(filter));

    list.forEach(emoji => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = emoji;

        cell.addEventListener('mouseenter', () => {
            emojiZoomLens.textContent = emoji;
            emojiZoomLens.style.display = 'flex';
            const rect = cell.getBoundingClientRect();
            const wrapRect = emojiMatrixWrap.getBoundingClientRect();
            emojiZoomLens.style.left = (rect.left - wrapRect.left + rect.width / 2) + 'px';
            emojiZoomLens.style.top = (rect.top - wrapRect.top) + 'px';
            if (nameEl) nameEl.textContent = `Selected: ${emoji}`;
        });

        cell.addEventListener('mouseleave', hideEmojiZoomLens);

        cell.onclick = () => {
            document.querySelectorAll('#emojiMatrix .cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            lastActiveEmoji = emoji;
            const box = document.getElementById('emojiCopyBox');
            if (box) box.value += emoji;
        };
        fragment.appendChild(cell);
    });
    emojiMatrix.replaceChildren(fragment);
}

// ============================================================
// ⚙️ IME EXPORT
// ============================================================
function openImeExportModal() {
    if (!_canOpenModal('openImeExportModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('IME Exporter')) return;

    const preview = document.getElementById('imeJsonPreview');
    if (preview) {
        preview.value = JSON.stringify({
            metadata: {
                engine: "Hoṛ Katha Suite Ultra IME",
                version: (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.VERSION) || '3.7.4',
                mappings: {
                    "santali-devanagari": typeof hardwareDevMap !== 'undefined' ? hardwareDevMap : {},
                    "ol-chiki": typeof hardwareOlchikiMap !== 'undefined' ? hardwareOlchikiMap : {}
                }
            }
        }, null, 2);
    }

    const modal = document.getElementById('imeModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeImeModal() {
    const modal = document.getElementById('imeModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

function downloadImeMapFile() {
    const preview = document.getElementById('imeJsonPreview');
    if (!preview) return;
    const blob = new Blob([preview.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HorKatha_IME_Map.json';
    a.click();
    requestAnimationFrame(() => { requestAnimationFrame(() => { URL.revokeObjectURL(url); }); });
}

// ============================================================
// 🅰️ KRUTI DEV
// ============================================================
function convertUnicodeToKrutiDev(text) {
    if (typeof unicodeToKrutiMap === 'undefined') return text;
    let out = '', i = 0;
    while (i < text.length) {
        const char = text[i];
        if (char === '\n' || char === '\r') { out += char; i++; continue; }
        let matched = false;
        for (let len = 4; len >= 2; len--) {
            if (i + len <= text.length) {
                const sub = text.substr(i, len);
                if (unicodeToKrutiMap[sub]) { out += unicodeToKrutiMap[sub]; i += len; matched = true; break; }
            }
        }
        if (matched) continue;
        if (unicodeToKrutiMap[char]) { out += unicodeToKrutiMap[char]; i++; continue; }
        out += text[i]; i++;
    }
    return out;
}

function openKrutiDevModal() {
    if (!_canOpenModal('openKrutiDevModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('Kruti Dev Converter')) return;
    const editor = document.getElementById('editor');
    const preview = document.getElementById('krutiPreview');
    if (preview) preview.value = convertUnicodeToKrutiDev((editor ? editor.innerText : '') || '');
    const modal = document.getElementById('krutiModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeKrutiDevModal() {
    const modal = document.getElementById('krutiModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

function applyKrutiToEditor() {
    const preview = document.getElementById('krutiPreview');
    const editor = document.getElementById('editor');
    if (preview && preview.value && editor) {
        editor.innerText = preview.value;
        if (typeof handleEditorInput === 'function') handleEditorInput(true);
        closeKrutiDevModal();
    }
}

// ============================================================
// 🔄 CONVERTER
// ============================================================
function openConverterModal() {
    if (!_canOpenModal('openConverterModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('Script Converter')) return;
    const preview = document.getElementById('converterPreview');
    if (preview) preview.value = '';
    const modal = document.getElementById('converterModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    executeConversion();
}

function closeConverterModal() {
    const modal = document.getElementById('converterModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

function executeConversion() {
    const editor = document.getElementById('editor');
    const preview = document.getElementById('converterPreview');
    const sel = document.getElementById('convertDirectionSelect');
    if (!preview) return;

    const text = (editor ? editor.innerText : '') || '';
    const dir = sel ? sel.value : 'dev-to-ol';
    let out = '';

    if (dir === 'dev-to-ol' && typeof devToOlMap !== 'undefined') {
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '्') continue;
            out += devToOlMap[ch] !== undefined ? devToOlMap[ch] : ch;
        }
    } else if (dir === 'ol-to-dev' && typeof olToDevMap !== 'undefined') {
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            out += olToDevMap[ch] !== undefined ? olToDevMap[ch] : ch;
        }
    } else if (dir === 'roman-to-ol') {
        const pairs = {
            'kh':'ᱠᱷ','gh':'ᱜᱷ','ch':'ᱪᱷ','jh':'ᱡᱷ','th':'ᱛᱷ','dh':'ᱫᱷ','ph':'ᱯᱷ','bh':'ᱵᱷ',
            'a':'ᱟ','e':'ᱮ','i':'ᱤ','o':'ᱳ','u':'ᱩ',
            'k':'ᱠ','g':'ᱜ','c':'ᱪ','j':'ᱡ','t':'ᱛ','d':'ᱫ','p':'ᱯ','b':'ᱵ',
            'm':'ᱢ','n':'ᱱ','r':'ᱨ','l':'ᱞ','s':'ᱥ','h':'ᱦ'
        };
        let i = 0;
        while (i < text.length) {
            const two = text.substr(i, 2).toLowerCase();
            if (pairs[two]) { out += pairs[two]; i += 2; }
            else { out += pairs[text[i].toLowerCase()] || text[i]; i++; }
        }
    }
    preview.value = out;
}

function replaceEditorWithConverted() {
    const editor = document.getElementById('editor');
    const preview = document.getElementById('converterPreview');
    if (preview && preview.value && editor) {
        editor.innerText = preview.value;
        if (typeof handleEditorInput === 'function') handleEditorInput(true);
        closeConverterModal();
    }
}

// ============================================================
// 🎯 BEFORE INSTALL
// ============================================================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// ============================================================
// 🌐 GLOBAL EXPORTS
// ============================================================
window.showToast = showToast;
window.toastSuccess = toastSuccess;
window.toastError = toastError;
window.toastWarning = toastWarning;
window.toastInfo = toastInfo;
window.showFlash = showFlash;
window.showWaMessagePreview = showWaMessagePreview;
window.copyWaMessageText = copyWaMessageText;
window.sendWaMessageNow = sendWaMessageNow;
window.onPaymentCompleted = onPaymentCompleted;
window.sendTrialPaymentToWhatsApp = sendTrialPaymentToWhatsApp;
window.sendLicenseOtp = sendLicenseOtp;
window.verifyLicenseOtp = verifyLicenseOtp;
window.sendTrialOtp = sendTrialOtp;
window.verifyTrialOtp = verifyTrialOtp;
window.checkTrialConstraints = checkTrialConstraints;
window.markTrialAsUsed = markTrialAsUsed;

console.log('═══════════════════════════════════════════');
console.log('✅ modals.js loaded — v3.7.4 (FIX #2 APPLIED)');
console.log('   🔒 Trial Constraints: FAIL-CLOSED');
console.log('   🚫 Offline / no-endpoint / network-error → BLOCK');
console.log('   📩 EmailJS: ' + (EMAILJS_PUBLIC_KEY && EMAILJS_TEMPLATE_ID ? 'Initialized ✅' : '⚠️ NOT CONFIGURED'));
console.log('═══════════════════════════════════════════');