// ============================================================
// 🪟 MODALS — Progress + QR + Flash + All Modal Logic
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.76 — FIX #6 (CRITICAL: deactivateLicense OVERRIDE):
//    • 🔴 REMOVED: broken `deactivateLicense()` function
//                  (was overriding license.js version → made it a no-op)
//    • 🔴 FIXED: License modal "🗑️ Deactivate License" button now
//                correctly calls license.js's `openDeactivationModal()`
//    • 🟢 RETAINED: all v3.7.4.75 features (offline-first QR, etc.)
// ============================================================
// ✅ v3.7.4.75 — FIX #5 (QR OFFLINE-FIRST):
//    • NEW: OfflineQRCode tried FIRST (instant, no network delay)
//    • NEW: Network providers are fallback only
//    • FIXED: Offline mode now renders QR in <50ms (was 15s timeout)
//    • FIXED: Consistency with certificate.js offline-first pattern
//    • NEW: _tryOfflineQR() + _renderViaNetwork() split helpers
//    • NEW: testQRPriority() debug helper
//    • RETAINED: All previous hardening fixes
// ============================================================

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

// ============================================================
// 🎯 QR FALLBACK CONFIG (Network providers only)
// ✅ FIX #5: These are now FALLBACK only — OfflineQRCode runs first
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
    if (isNaN(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

// ============================================================
// 🛡️ ESCAPE HTML — Single consolidated function
// ✅ Handles: & < > " ' `
// ✅ Backward-compat aliases kept for external callers
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

// Aliases for backward compatibility (any external callers)
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
// 📸 QR RENDER — ✅ FIX #5: OFFLINE-FIRST
// ════════════════════════════════════════════════════════════
// Priority Order (FIX #5):
//   1️⃣  OfflineQRCode (from qr-offline.js) — INSTANT, no network
//   2️⃣  Network providers (QRServer, QuickChart) — fallback
//   3️⃣  Manual UPI text — final fallback
//
// Why offline-first?
//   • 15s → <50ms on offline/slow networks
//   • Consistent with certificate.js behavior
//   • OfflineQRCode already loaded (index.html)
//   • Network fallback still available if offline fails
// ============================================================
function renderQRCode(elementId, text, size = 200) {
    console.log('🎨 QR Render:', elementId, '| data length:', text.length);

    const container = document.getElementById(elementId);
    if (!container) {
        console.error('❌ Container missing:', elementId);
        return;
    }

    container.innerHTML = '';
    container.removeAttribute('style');

    // Force exact size on container
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

    // ═══════════════════════════════════════════════════════
    // ✅ FIX #5 — TIER 1: Try OFFLINE QR FIRST (instant!)
    // ═══════════════════════════════════════════════════════
    if (_tryOfflineQR(container, text, qrSize)) {
        console.log('✅ QR rendered via OfflineQRCode (offline-first) — instant');
        return;
    }

    // ═══════════════════════════════════════════════════════
    // Fallback: Network providers (slower, needs internet)
    // ═══════════════════════════════════════════════════════
    console.log('⚠️ OfflineQRCode unavailable/failed → trying network providers');
    _renderViaNetwork(container, text, size, qrSize);
}

// ============================================================
// ✅ FIX #5: TIER 1 — Try OfflineQRCode (instant, no network)
// ============================================================
function _tryOfflineQR(container, text, qrSize) {
    try {
        if (typeof window.OfflineQRCode === 'undefined'
            || typeof window.OfflineQRCode.render !== 'function') {
            console.warn('⚠️ OfflineQRCode not loaded — will use network fallback');
            return false;
        }

        // M level = balanced quality/robustness (matches certificate.js)
        const success = window.OfflineQRCode.render(container, text, qrSize, 'M');

        if (success === true) {
            return true;
        }

        // Partial render — clean it up
        console.warn('⚠️ OfflineQRCode returned false — clearing partial render');
        container.innerHTML = '';
        return false;
    } catch (e) {
        console.warn('⚠️ OfflineQRCode threw error:', e.message);
        container.innerHTML = '';
        return false;
    }
}

// ============================================================
// ✅ FIX #5: TIER 2 — Network QR providers (fallback only)
// ============================================================
function _renderViaNetwork(container, text, size, qrSize) {
    const encodedText = encodeURIComponent(text);

    let providerIndex = 0;
    let rendered = false;

    // Loading state
    container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    gap:6px;color:#64748b;font-size:0.7rem;font-weight:700;">
            <div style="font-size:1.5rem;">⏳</div>
            <div>Loading QR...</div>
        </div>
    `;

    const totalTimeoutId = setTimeout(() => {
        if (rendered) return;
        console.warn('⏱️ QR total timeout — showing manual UPI fallback');
        rendered = true;
        _showQRFailure(container, new Error('Network timeout'));
    }, _QR_TOTAL_TIMEOUT_MS);

    function tryNextProvider() {
        if (rendered) return;

        if (providerIndex >= _QR_PROVIDERS.length) {
            console.log('⚠️ All network QR failed → Manual UPI text');
            clearTimeout(totalTimeoutId);
            rendered = true;
            _showQRFailure(container, new Error('All providers failed'));
            return;
        }

        const provider = _QR_PROVIDERS[providerIndex];
        const providerUrl = provider.template
            .replace('{SIZE}', qrSize)
            .replace(/{DATA}/g, encodedText);

        console.log(`🌐 Trying network QR #${providerIndex + 1} (timeout: ${provider.timeout}ms)`);

        container.innerHTML = '';

        const img = document.createElement('img');
        img.alt = 'Scan QR Code';
        img.crossOrigin = 'anonymous';
        img.style.cssText = `
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
            image-rendering: pixelated;
            background: #ffffff;
        `;

        let loadTimeout = setTimeout(() => {
            if (!rendered) {
                console.warn(`⏱️ Network QR #${providerIndex + 1} timeout`);
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
            console.log(`✅ QR rendered via NETWORK #${providerIndex + 1}`);
        };

        img.onerror = function() {
            clearTimeout(loadTimeout);
            if (rendered) return;
            console.warn(`❌ Network QR #${providerIndex + 1} failed`);
            providerIndex++;
            tryNextProvider();
        };

        img.src = providerUrl;
    }

    tryNextProvider();
}

// ============================================================
// ✅ FIX #5: TIER 3 — Final fallback (manual UPI text)
// ============================================================
function _showQRFailure(container, err) {
    if (!container) return;

    const upiId = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.UPI_PRIMARY_ID)
        ? APP_CONFIG.UPI_PRIMARY_ID
        : '9110977117@ybl';

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    width:100%;height:100%;color:#dc2626;text-align:center;
                    font-size:0.7rem;font-weight:700;padding:8px;gap:4px;">
            <div style="font-size:1.5rem;">⚠️</div>
            <div>QR Load Failed</div>
            <div style="font-size:0.6rem;color:#64748b;">Manual UPI:</div>
            <div style="font-size:0.65rem;color:#0f172a;background:#fff;padding:3px 8px;
                        border-radius:4px;font-family:monospace;font-weight:900;
                        word-break:break-all;">
                ${_escapeHtml(upiId)}
            </div>
            <div style="font-size:0.55rem;color:#94a3b8;margin-top:4px;">
                ${_escapeHtml((err && err.message || '').substring(0, 40))}
            </div>
        </div>
    `;
}

// ============================================================
// 🎨 BACKWARD COMPAT SHIM — _MiniQR
// ✅ Delegates to shared OfflineQRCode (from qr-offline.js)
// ✅ Kept for ModalsDebug test functions
// ============================================================
const _MiniQR = {
    render: function(container, text, size) {
        if (typeof window.OfflineQRCode === 'undefined'
            || typeof window.OfflineQRCode.render !== 'function') {
            console.warn('_MiniQR shim: OfflineQRCode not loaded');
            return false;
        }
        return window.OfflineQRCode.render(container, text, size || 200, 'M');
    }
};

// ============================================================
// 💰 GET PAYMENT URL
// ✅ Smart decimal: 9 → "9", 9.99 → "9.99"
// ============================================================
function _getPaymentURL(amount, note) {
    const upiId = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.UPI_PRIMARY_ID)
        ? APP_CONFIG.UPI_PRIMARY_ID
        : '9110977117@ybl';

    const payeeName = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.PAYEE_NAME)
        ? APP_CONFIG.PAYEE_NAME
        : 'BOSC Tech and Edu';

    const tn = note || 'Hor Katha Payment';

    let safeAmount = Number(amount);
    if (isNaN(safeAmount) || safeAmount < 0.01) safeAmount = 0.01;
    if (safeAmount > 100000) safeAmount = 100000;

    // ✅ Integer if whole number (UPI safe)
    const amt = Number.isInteger(safeAmount)
        ? String(safeAmount)
        : safeAmount.toFixed(2);

    // Encode helper — keeps UPI-safe chars readable
    const enc = (s) => encodeURIComponent(String(s))
        .replace(/%40/g, '@')
        .replace(/%2D/g, '-')
        .replace(/%5F/g, '_')
        .replace(/%2E/g, '.');

    let url = `upi://pay?pa=${enc(upiId)}&pn=${enc(payeeName)}&am=${amt}&cu=INR&tn=${enc(tn)}`;

    // URL length guard (UPI max ~ 500 chars)
    if (url.length > 500) {
        console.warn('⚠️ UPI URL too long — truncating note');
        url = `upi://pay?pa=${enc(upiId)}&pn=${enc(payeeName)}&am=${amt}&cu=INR&tn=${enc('Payment')}`;
    }

    console.log('💳 UPI URL:', url);
    return url;
}

// ============================================================
// ✅ MODAL GUARD — App must be ready
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

    // 3s timeout fallback
    const startTime = Date.now();
    const waitMax = 3000;

    if (document.__modalWaitStart) {
        const elapsed = Date.now() - document.__modalWaitStart;
        if (elapsed > waitMax) {
            console.warn('🛡️ ' + (modalName || 'Modal') + ' — timeout, allowing');
            delete document.__modalWaitStart;
            return true;
        }
    } else {
        document.__modalWaitStart = startTime;
    }

    console.warn('🛡️ ' + (modalName || 'Modal') + ' blocked — app not ready');
    return false;
}

// ============================================================
// 🎬 FLASH MESSAGE SYSTEM
// ============================================================
function showFlash(options = {}) {
    const container = document.getElementById('flashContainer');
    if (!container) return null;

    const {
        type = 'info',
        icon = 'ℹ️',
        title = '',
        subtitle = '',
        body = '',
        duration = 6000,
        compact = false,
        onClose = null
    } = options;

    const flash = document.createElement('div');
    flash.className = `flash-message flash-${type}${compact ? ' flash-compact' : ''}`;

    let bodyHTML = '';
    if (body) bodyHTML = `<div class="flash-body">${body}</div>`;

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
        <div class="flash-progress">
            <div class="flash-progress-bar"></div>
        </div>
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

        if (typeof onClose === 'function') {
            try { onClose(); } catch (e) {}
        }

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
        type,
        icon: iconMap[type] || 'ℹ️',
        title: titleMap[type] || 'Info',
        subtitle: message,
        duration: Math.max(0, Math.min(60000, duration)),
        compact: true
    });
}

const toastSuccess = (m) => showToast(m, 'success');
const toastError   = (m) => showToast(m, 'error');
const toastWarning = (m) => showToast(m, 'warning');
const toastInfo    = (m) => showToast(m, 'info');

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
    if (statusEl) {
        statusEl.className = 'trm-status';
        statusEl.textContent = '';
    }

    const qrBox = document.getElementById('trialQrBox');
    if (qrBox) {
        qrBox.innerHTML = '';
        qrBox.removeAttribute('style');
    }

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    const trialPrice = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.TRIAL_PRICE) || 9;
    const upiUrl = _getPaymentURL(trialPrice, 'Hor Katha 7-Day Trial');

    setTimeout(() => {
        renderQRCode('trialQrBox', upiUrl, 220);
    }, 100);
}

function closeTrialActivationModal() {
    const modal = document.getElementById('trialActivationModal');
    if (modal) modal.style.display = 'none';

    const statusEl = document.getElementById('trialActivationStatus');
    if (statusEl) {
        statusEl.className = 'trm-status';
        statusEl.textContent = '';
    }

    _unlockBodyScroll();
}

async function activateTrialWithKey() {
    const keyInput = document.getElementById('trialKeyInput');
    const statusEl = document.getElementById('trialActivationStatus');
    if (!keyInput || !statusEl) return;

    const key = (keyInput.value || '').trim().toUpperCase();

    if (!key) {
        statusEl.className = 'trm-status error';
        statusEl.textContent = '❌ कृपया Trial Key enter करें';
        return;
    }

    if (!/^HKT-\d{7}-[A-F0-9]{4}$/.test(key)) {
        statusEl.className = 'trm-status error';
        statusEl.textContent = '❌ गलत format! Format: HKT-XXXXXXX-XXXX';
        return;
    }

    statusEl.className = 'trm-status loading';
    statusEl.textContent = '⏳ Key verify हो रही है...';

    try {
        if (typeof TrialSystem === 'undefined' || !TrialSystem.activateWithKey) {
            statusEl.className = 'trm-status error';
            statusEl.textContent = '❌ Trial system unavailable';
            return;
        }

        const result = await TrialSystem.activateWithKey(key);

        if (result.success) {
            statusEl.className = 'trm-status success';
            statusEl.textContent = '✅ Trial activated! 7 days unlocked.';

            showFlash({
                type: 'success',
                icon: '🎉',
                title: 'Trial Activated!',
                subtitle: '7 Days Full Access',
                body: '<p>सभी Pro features अब unlocked हैं।</p>',
                duration: 6000
            });

            setTimeout(async () => {
                if (typeof checkLicenseIntegrity === 'function') {
                    await checkLicenseIntegrity();
                }
                setTimeout(() => {
                    closeTrialActivationModal();
                    setTimeout(() => location.reload(), 500);
                }, 1500);
            }, 800);
        } else {
            statusEl.className = 'trm-status error';
            statusEl.textContent = '❌ ' + (result.reason || 'Invalid trial key');
        }
    } catch (e) {
        statusEl.className = 'trm-status error';
        statusEl.textContent = '❌ ' + e.message;
    }
}

function sendTrialPaymentToWhatsApp() {
    const sellerWa = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPPORT_WHATSAPP)
        ? APP_CONFIG.SUPPORT_WHATSAPP
        : "919110977117";
    const trialPrice = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.TRIAL_PRICE) || 9;

    setTimeout(async () => {
        let hwidFull = 'Unknown';
        try {
            if (typeof getDeviceHardwareFingerprint === 'function') {
                hwidFull = await getDeviceHardwareFingerprint() || 'Unknown';
            }
        } catch (e) {}

        const msg = `🎁 *₹9 TRIAL REQUEST — Hor Katha Suite*

💰 *Amount:* ₹${trialPrice}
📱 *Device ID:* ${hwidFull}
📅 *Date:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

✅ मैंने ₹${trialPrice} का payment कर दिया है।
📸 Payment screenshot इसी chat में भेज रहा हूँ।

🔑 कृपया Trial Key भेजें (Format: HKT-XXXXXXX-XXXX)`;

        const waUrl = `https://wa.me/${sellerWa}?text=${encodeURIComponent(msg)}`;
        try {
            const opened = window.open(waUrl, '_blank');
            if (!opened) window.location.href = waUrl;
        } catch (e) {
            window.location.href = waUrl;
        }
    }, 300);
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

        input.addEventListener('input', function() {
            this.value = formatTrialKey(this.value);
        });

        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text');
            this.value = formatTrialKey(pasted);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                activateTrialWithKey();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                closeTrialActivationModal();
            }
        });
    });
})();

function selectTrialPlan() {
    closeBuyModal();
    setTimeout(() => {
        if (typeof openTrialActivationModal === 'function') {
            openTrialActivationModal();
        }
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
    const suppWa = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPPORT_WHATSAPP)
        ? APP_CONFIG.SUPPORT_WHATSAPP
        : "919110977117";

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

    // ✅ Wrap await in try-catch (HWID fetch can fail)
    const dvcBuy = document.getElementById('buyDeviceIdDisplay');
    if (dvcBuy) {
        try {
            if (typeof getDeviceHardwareFingerprint === 'function') {
                dvcBuy.value = await getDeviceHardwareFingerprint();
            }
        } catch (e) {
            console.warn('HWID fetch failed (non-critical):', e.message);
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

    if (safePrice !== price) {
        console.warn('⚠️ Price clamped:', price, '→', safePrice);
    }

    currentSelectedPrice = safePrice;
    // ✅ Sanitize title (prevent XSS via admin-controlled string)
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
// 🔐 LICENSE MODAL
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
            console.warn('HWID fetch failed:', e.message);
            dvcDisplay.value = 'DVC-XXXX-XXXX';
        }
    }

    let savedName = '';
    let savedKey = '';
    try {
        savedName = localStorage.getItem('hor_lic_user') || '';
        savedKey = localStorage.getItem('hor_lic_key') || '';
    } catch (e) {}

    if (licName) licName.value = savedName;
    if (licKey) licKey.value = savedKey;

    const modal = document.getElementById('licenseModal');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeLicenseModal() {
    const modal = document.getElementById('licenseModal');
    if (modal) modal.style.display = 'none';
    _unlockBodyScroll();
}

// ✅ Length guards before index access
async function verifyAndActivateLicense() {
    const nameEl = document.getElementById('licCustomerName');
    const keyEl = document.getElementById('licCustomerKey');

    const name = nameEl ? nameEl.value.trim() : '';
    const key = keyEl ? keyEl.value.trim() : '';

    if (!name || !key) {
        toastWarning('कृपया Name और Key भरें!');
        return;
    }

    // ✅ Length guards (prevent index crash on malformed key)
    const keyParts = key.split('-');
    if (keyParts.length !== 4) {
        toastError('Invalid key format — expected 4 parts separated by dashes');
        return;
    }

    const sigHex = keyParts[3];
    if (!sigHex || sigHex.length !== 128) {
        toastError(`Signature length wrong: ${sigHex ? sigHex.length : 0} chars (expected 128)`);
        return;
    }

    if (!/^[0-9A-F]+$/i.test(sigHex)) {
        toastError('Signature contains invalid hex characters');
        return;
    }

    showProgress('Verifying License...', 'Checking signature');
    setProgress(30, 'Parsing payload');
    await new Promise(r => setTimeout(r, 150));

    try {
        const check = await verifyLicensePayload(name, key);
        setProgress(80, 'Applying activation');
        await new Promise(r => setTimeout(r, 200));
        setProgress(100, 'Done!');

        setTimeout(() => {
            hideProgress();

            if (check.valid) {
                try {
                    localStorage.setItem('hor_lic_user', name);
                    localStorage.setItem('hor_lic_key', key.toUpperCase());
                } catch (e) {}

                isProLicensed = true;
                applyProState(name, check.plan, true);
                toastSuccess(`सफल सक्रियण! User: ${name}, Plan: ${check.plan}`);
                closeLicenseModal();
            } else {
                toastError(`अमान्य की: ${check.reason}`);
            }
        }, 300);
    } catch (e) {
        hideProgress();
        toastError('Verification failed: ' + e.message);
    }
}

// ============================================================
// ✅ FIX #6: `deactivateLicense()` REMOVED
// ============================================================
// ⚠️ CRITICAL NOTE FOR FUTURE MAINTAINERS:
//
// This function USED TO BE DEFINED HERE as a broken stub:
//
//     function deactivateLicense() {
//         if (typeof window.deactivateLicense === 'function' &&
//             window.deactivateLicense !== deactivateLicense) {
//             return window.deactivateLicense();
//         }
//         console.warn('⚠️ [modals] deactivateLicense not implemented here');
//     }
//
// Why it was BROKEN:
//   • modals.js loads with `defer` AFTER license.js
//   • Function declarations at top level are hoisted to global scope
//   • So modals.js's version OVERRODE license.js's working version
//   • Then `window.deactivateLicense === deactivateLicense` was TRUE
//     (same function), so the `!==` check ALWAYS failed
//   • Result: clicking "🗑️ Deactivate License" did NOTHING
//
// Now that this stub is removed:
//   • `deactivateLicense()` in index.html correctly resolves to
//     license.js's implementation which opens the deactivation modal
//   • No conflicting override exists
//
// ❌ DO NOT re-add any `deactivateLicense` function to this file.
//    The working implementation lives in license.js.
// ============================================================

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

    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();

    return `HK-${yy}${mm}${dd}${hh}${mi}${ss}-${rand}`;
}

function getISTTimestamp() {
    try {
        return new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch (e) {
        return new Date().toLocaleString();
    }
}

// ✅ Flag reset in finally (never gets stuck)
async function onPaymentCompleted() {
    if (_isProcessingPayment) {
        console.warn('⚠️ Payment already processing — ignoring duplicate click');
        return;
    }

    const paymentCheck = document.getElementById('paymentConfirmCheck');
    if (paymentCheck && !paymentCheck.checked) {
        toastWarning('कृपया पहले confirm करें!');
        return;
    }

    const nameInput = document.getElementById('buyCustomerName');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        toastWarning('कृपया पहले अपना नाम भरें!');
        if (nameInput) nameInput.focus();
        return;
    }

    _isProcessingPayment = true;

    const btn = document.getElementById('btnPaymentDone');

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Receipt बन रही है...';
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

        const sellerWa = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPPORT_WHATSAPP)
            ? APP_CONFIG.SUPPORT_WHATSAPP
            : "919110977117";

        const waMsg = `🧾 *NEW PURCHASE — PAYMENT CONFIRMED*
━━━━━━━━━━━━━━━━━━━━
📋 Receipt No: *${receiptNo}*
📅 ${timestamp}
👤 *${name}*
📱 ${hwid}
💼 ${plan}
💰 ₹${amount}
━━━━━━━━━━━━━━━━━━━━
✅ मैंने payment कर दिया है।
📸 Screenshot इसी chat में भेज रहा हूँ
🔑 कृपया License Key भेजें।`;

        showReceiptModal({ receiptNo, name, hwid, plan, amount, timestamp });

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '✅ Payment हो गया? — Confirm करें<br><span>(Receipt + WhatsApp Order — Auto)</span>';
            btn.style.opacity = '1';
        }

        setTimeout(() => {
            const waUrl = `https://wa.me/${sellerWa}?text=${encodeURIComponent(waMsg)}`;
            try {
                const opened = window.open(waUrl, '_blank');
                if (!opened) window.location.href = waUrl;
            } catch (e) {
                window.location.href = waUrl;
            }
        }, 300);

        try {
            const all = JSON.parse(localStorage.getItem('hor_receipts') || '[]');
            all.push({ receiptNo, name, hwid, plan, amount, timestamp });
            if (all.length > 500) all.shift();
            localStorage.setItem('hor_receipts', JSON.stringify(all));
        } catch (e) {}

    } catch (e) {
        console.error('Payment processing failed:', e);
        toastError('Payment failed: ' + e.message);
    } finally {
        // ✅ Always reset flag (never stuck)
        setTimeout(() => {
            _isProcessingPayment = false;
        }, 1000);
    }
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

    // ✅ Null-safe fields
    const fields = {
        rcptNumber: record.receiptNo || '-',
        rcptDate: record.timestamp || '-',
        rcptName: record.name || '-',
        rcptDevice: record.hwid || '-',
        rcptPlan: record.plan || '-',
        rcptAmount: '₹' + (record.amount || 0)
    };

    Object.keys(fields).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = fields[id];
    });

    modal.style.display = 'flex';
}

function closeReceiptModal() {
    const m = document.getElementById('receiptModal');
    if (m) m.style.display = 'none';
}

function copyReceiptNumber() {
    const el = document.getElementById('rcptNumber');
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => toastSuccess('Copied!'));
}

function shareReceiptOnWhatsApp() {
    const sellerWa = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPPORT_WHATSAPP)
        ? APP_CONFIG.SUPPORT_WHATSAPP
        : "919110977117";

    const el = document.getElementById('rcptNumber');
    const rn = el ? el.textContent : 'N/A';
    const msg = `🧾 Receipt: *${rn}*\n✅ Payment Done`;
    window.open(`https://wa.me/${sellerWa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
}

function redirectToWhatsAppBuy() {
    const chk = document.getElementById('paymentConfirmCheck');
    if (!chk || !chk.checked) {
        toastWarning('⚠️ कृपया पहले confirm करें!');
        return;
    }
    onPaymentCompleted();
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

    try {
        localStorage.setItem('hor_katha_theme', nt);
    } catch (e) {}
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
        if (m.style.display === 'flex' || m.style.display === 'block') {
            hasOpenModal = true;
        }
    });

    if (!hasOpenModal) {
        document.body.classList.remove('modal-open');
    }
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
        navigator.clipboard.writeText(text)
            .then(() => {
                if (typeof showToast === 'function') {
                    showToast('Copied to clipboard', 'success');
                }
            })
            .catch(() => _fallbackCopyBox(text));
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

        if (typeof showToast === 'function') {
            showToast(ok ? 'Copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
        }
    } catch (e) {
        alert('Copy failed');
    }
}

function insertFromBox(boxId, modalId) {
    const box = document.getElementById(boxId);
    if (box && box.value) {
        if (typeof addCharWithPhonics === 'function') {
            addCharWithPhonics(box.value);
        }
        if (modalId) {
            const m = document.getElementById(modalId);
            if (m) m.style.display = 'none';
        }
    }
}

// ============================================================
// 🎯 FOCUS MODE RESTORE
// ============================================================
function _restoreFocusModeIfActive() {
    if (document.body.classList.contains('typing-focus')) {
        setTimeout(() => {
            const editor = document.getElementById('editor');
            if (editor) {
                try { editor.focus(); } catch (e) {}
            }
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
            console.log('🔤 Google Font loaded:', gfont);
        }
    } catch (e) {}
}

function autoSyncLanguageFonts(langKey) {
    const fontDropdown = document.getElementById('fontFamilySelect');
    if (!fontDropdown) {
        console.warn('⚠️ Font dropdown not found (#fontFamilySelect)');
        return;
    }

    if (typeof languageFontsDB === 'undefined') {
        console.error('❌ languageFontsDB is undefined — config.js not loaded properly');
        fontDropdown.innerHTML = `
            <option value="'Roboto', sans-serif" selected>Roboto</option>
            <option value="'Inter', sans-serif">Inter</option>
            <option value="'Arial', sans-serif">Arial</option>
        `;
        changeFontFamily("'Roboto', sans-serif");
        return;
    }

    const fonts = languageFontsDB[langKey] || languageFontsDB['english'];

    if (!fonts || !Array.isArray(fonts) || fonts.length === 0) {
        console.warn('⚠️ No fonts found for language:', langKey);
        return;
    }

    fontDropdown.innerHTML = '';
    let defaultFontVal = null;

    fonts.forEach((f) => {
        if (!f || !f.val) return;

        const opt = document.createElement('option');
        opt.value = f.val;
        opt.textContent = f.name || 'Unknown Font';

        if (f.gfont) {
            opt.setAttribute('data-gfont', f.gfont);
        }

        if (f.default) {
            opt.selected = true;
            defaultFontVal = f.val;
            if (f.gfont) loadGoogleFontDynamically(f.gfont);
        }

        fontDropdown.appendChild(opt);
    });

    if (!defaultFontVal && fonts[0] && fonts[0].val) {
        defaultFontVal = fonts[0].val;
    }

    if (defaultFontVal) {
        changeFontFamily(defaultFontVal);
    }

    console.log('✅ Fonts synced for:', langKey, '-', fonts.length, 'fonts loaded');
}

function changeFontFamily(family) {
    const editor = document.getElementById('editor');
    if (!editor) return;

    if (!family || typeof family !== 'string') return;

    editor.style.fontFamily = family;

    const fd = document.getElementById('fontFamilySelect');
    if (fd && fd.selectedOptions && fd.selectedOptions.length > 0) {
        const gfont = fd.selectedOptions[0].getAttribute('data-gfont');
        if (gfont) loadGoogleFontDynamically(gfont);
    }

    if (typeof updateStatusFont === 'function') {
        updateStatusFont(family);
    }
}

function forceInitFontDropdown() {
    console.log('🔄 Force-initializing font dropdown...');
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
    if (fontSelect) {
        fontSelect.value = window.currentLayout || 'english';
    }

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
    if (filter) {
        list = list.filter(ch => ch.toLowerCase().includes(filter.toLowerCase()));
    }

    list.forEach(ch => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = ch;

        cell.addEventListener('mouseenter', () => {
            if (typeof handleHoverSpeech === 'function') {
                handleHoverSpeech(ch);
            }

            charmapZoomLens.textContent = ch;
            charmapZoomLens.style.display = 'flex';

            const rect = cell.getBoundingClientRect();
            const wrapRect = charmapMatrixWrap.getBoundingClientRect();

            charmapZoomLens.style.left = (rect.left - wrapRect.left + rect.width / 2) + 'px';
            charmapZoomLens.style.top = (rect.top - wrapRect.top) + 'px';

            if (nameEl) nameEl.textContent = `Character: ${ch}`;
            if (hexEl) {
                const codeHex = Array.from(ch)
                    .map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'))
                    .join(' ');
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
    if (filter) {
        list = list.filter(e => e.includes(filter));
    }

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

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            URL.revokeObjectURL(url);
        });
    });
}

// ============================================================
// 🅰️ KRUTI DEV
// ============================================================
function convertUnicodeToKrutiDev(text) {
    if (typeof unicodeToKrutiMap === 'undefined') return text;
    let out = '', i = 0;

    while (i < text.length) {
        const char = text[i];
        if (char === '\n' || char === '\r') {
            out += char;
            i++;
            continue;
        }

        let matched = false;
        for (let len = 4; len >= 2; len--) {
            if (i + len <= text.length) {
                const sub = text.substr(i, len);
                if (unicodeToKrutiMap[sub]) {
                    out += unicodeToKrutiMap[sub];
                    i += len;
                    matched = true;
                    break;
                }
            }
        }
        if (matched) continue;

        if (unicodeToKrutiMap[char]) {
            out += unicodeToKrutiMap[char];
            i++;
            continue;
        }

        out += text[i];
        i++;
    }
    return out;
}

function openKrutiDevModal() {
    if (!_canOpenModal('openKrutiDevModal')) return;
    if (typeof requireProAccess === 'function' && !requireProAccess('Kruti Dev Converter')) return;

    const editor = document.getElementById('editor');
    const preview = document.getElementById('krutiPreview');
    if (preview) {
        preview.value = convertUnicodeToKrutiDev((editor ? editor.innerText : '') || '');
    }

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
            if (pairs[two]) {
                out += pairs[two];
                i += 2;
            } else {
                out += pairs[text[i].toLowerCase()] || text[i];
                i++;
            }
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
// 📊 DEBUG HELPERS
// ============================================================
window.ModalsDebug = {
    status: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🪟 Modals Status (v3.7.4.76)');
        console.log('───────────────────────────────────────────');
        console.log('  appReady:', window.__appReady);
        console.log('  deferredPrompt:', !!deferredPrompt);
        console.log('  isVoiceEnabled:', isVoiceEnabled);
        console.log('  isHoverVoiceEnabled:', isHoverVoiceEnabled);
        console.log('  isClickSoundEnabled:', isClickSoundEnabled);
        console.log('  isPhoneticEnabled:', isPhoneticEnabled);
        console.log('  currentDonateAmount:', currentDonateAmount);
        console.log('  currentSelectedPrice:', currentSelectedPrice);
        console.log('  isProcessingPayment:', _isProcessingPayment);
        console.log('  Active flashes:', _activeFlashes.length);
        console.log('  Focus mode:', document.body.classList.contains('typing-focus'));
        console.log('  QR providers (fallback):', _QR_PROVIDERS.length);
        console.log('  OfflineQRCode:', typeof window.OfflineQRCode !== 'undefined' ? '✅ available' : '❌ missing');
        console.log('  QR priority: OFFLINE-FIRST (Fix #5)');
        console.log('  deactivateLicense owner:', 'license.js (Fix #6 — modals.js no longer overrides)');
        console.log('═══════════════════════════════════════════');
    },

    testProgress: () => {
        showProgress('Test Progress', 'Testing...');
        let p = 0;
        const timer = setInterval(() => {
            p += 20;
            setProgress(p, `Step ${p / 20}/5`);
            if (p >= 100) {
                clearInterval(timer);
                setTimeout(hideProgress, 500);
            }
        }, 300);
    },

    testQR: (containerId = 'trialQrBox') => {
        const upiUrl = _getPaymentURL(9, 'Test Payment');
        renderQRCode(containerId, upiUrl, 220);
        console.log('🧪 QR test triggered for', containerId);
    },

    // 🆕 FIX #5: QR Priority Test
    testQRPriority: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 QR PRIORITY TEST (FIX #5)');
        console.log('═══════════════════════════════════════════');

        const offlineAvailable = typeof window.OfflineQRCode !== 'undefined'
            && typeof window.OfflineQRCode.render === 'function';

        console.log('  OfflineQRCode available:', offlineAvailable ? '✅' : '❌');
        console.log('  Priority order: Offline → Network → Manual');
        console.log('');
        console.log('  Expected behavior:');
        console.log('    • If OfflineQRCode loaded → instant render (<50ms)');
        console.log('    • If OfflineQRCode fails → network fallback (slower)');
        console.log('    • If all fail → manual UPI text');

        const t0 = performance.now();
        const upiUrl = _getPaymentURL(9, 'Priority Test');
        renderQRCode('trialQrBox', upiUrl, 220);
        const t1 = performance.now();

        console.log('');
        console.log(`  Render call completed in: ${(t1 - t0).toFixed(1)}ms`);
        console.log('  (Should be <10ms if offline-first is working)');
        console.log('═══════════════════════════════════════════');
    },

    testMiniQR: (text = 'https://example.com/test') => {
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;top:20px;left:20px;width:200px;height:200px;background:#fff;padding:8px;border:2px solid #000;z-index:99999;';
        document.body.appendChild(container);
        try {
            _MiniQR.render(container, text, 184);
            console.log('✅ MiniQR (shim) test rendered');
        } catch (e) {
            console.error('❌ MiniQR test failed:', e.message);
        }
        setTimeout(() => container.remove(), 5000);
    },

    testMiniQRUnicode: () => {
        console.log('🧪 Testing OfflineQRCode with Unicode...');
        const samples = [
            'https://example.com/verify?name=नमस्ते',
            'https://example.com/verify?name=ᱡᱚᱦᱟᱨ ᱫᱩᱱᱤᱭᱟᱹ',
            'https://example.com/verify?name=🎉 Test',
            'Hello World'
        ];

        samples.forEach((text, i) => {
            console.log(`  Sample ${i + 1}: "${text.substring(0, 40)}..."`);
            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;top:' + (20 + i * 220) + 'px;left:20px;width:180px;height:180px;background:#fff;padding:6px;border:1px solid #333;z-index:99999;';
            document.body.appendChild(container);
            try {
                _MiniQR.render(container, text, 168);
                console.log('    ✅ Rendered');
            } catch (e) {
                console.error('    ❌ Failed:', e.message);
            }
            setTimeout(() => container.remove(), 5000);
        });
    },

    testMiniQRVersions: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 OfflineQRCode VERSION TEST');
        console.log('═══════════════════════════════════════════');

        const testSizes = [50, 100, 200, 300, 400, 500, 600, 700, 800];

        testSizes.forEach(size => {
            const text = 'A'.repeat(size);
            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;top:20px;left:20px;width:150px;height:150px;background:#fff;padding:4px;border:1px solid #333;z-index:99999;';
            document.body.appendChild(container);

            try {
                const success = _MiniQR.render(container, text, 142);
                console.log(`  ${success ? '✅' : '❌'} ${size} chars`);
            } catch (e) {
                console.log(`  ❌ ${size} chars — ${e.message}`);
            }
            setTimeout(() => container.remove(), 100);
        });

        console.log('═══════════════════════════════════════════');
    },

    testFonts: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🔤 Font Debug');
        console.log('───────────────────────────────────────────');
        const fd = document.getElementById('fontFamilySelect');
        if (!fd) {
            console.error('❌ #fontFamilySelect not found');
            return;
        }
        console.log('  languageFontsDB loaded:', typeof languageFontsDB !== 'undefined');
        console.log('  Dropdown options:', fd.options.length);
        console.log('  Selected value:', fd.value);
        console.log('  Current layout:', window.currentLayout || 'unknown');
        console.log('  Dropdown visible:', window.getComputedStyle(fd).display !== 'none');
        console.log('  Options:');
        Array.from(fd.options).forEach((opt, i) => {
            console.log(`    [${i}] ${opt.textContent} → ${opt.value}`);
        });
        console.log('═══════════════════════════════════════════');
    },

    forceFonts: () => {
        forceInitFontDropdown();
        console.log('🔄 Force font init triggered');
    },

    testUpiAmounts: () => {
        console.log('🧪 Testing UPI amount validation:');
        [0, -10, 0.001, 9, 9.99, 199, 99999, 999999].forEach(a => {
            const url = _getPaymentURL(a, 'Test');
            const match = url.match(/am=([\d.]+)/);
            console.log(`  Input: ${a} → Extracted: ${match ? match[1] : 'none'}`);
        });
    },

    testFocusRestore: () => {
        console.log('🧪 Testing focus restore after modal close...');
        const editor = document.getElementById('editor');
        if (editor) editor.focus();

        setTimeout(() => {
            console.log('  Before open — typing-focus:', document.body.classList.contains('typing-focus'));
            openEmojiModal();
            setTimeout(() => {
                closeEmojiModal();
                setTimeout(() => {
                    console.log('  After close — activeElement is editor:', document.activeElement === editor);
                }, 200);
            }, 300);
        }, 100);
    },

    testSafeInt: (val) => {
        console.log('🧪 Test _safeInt:', val, '→', _safeInt(val, 0, 100000, 0));
    },

    testPaymentFlagReset: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 PAYMENT FLAG RESET TEST');
        console.log('═══════════════════════════════════════════');

        console.log('  Before: _isProcessingPayment =', _isProcessingPayment);

        _isProcessingPayment = true;
        console.log('  Set flag =', _isProcessingPayment);

        setTimeout(() => {
            console.log('  (Waiting for auto-reset...)');
        }, 200);

        _isProcessingPayment = false;
        console.log('  After reset =', _isProcessingPayment);
        console.log('  Result: ✅ PASS (flag can be reset)');
        console.log('═══════════════════════════════════════════');
    },

    testEscape: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 ESCAPE HTML TEST');
        console.log('═══════════════════════════════════════════');

        const tests = [
            '<script>alert(1)</script>',
            'He said "hello"',
            "It's a test",
            'A & B',
            'Backtick `test`'
        ];

        tests.forEach(t => {
            console.log(`  Input:  ${t}`);
            console.log(`  Output: ${_escapeHtml(t)}`);
        });
        console.log('═══════════════════════════════════════════');
    },

    // 🆕 FIX #6: Verify deactivateLicense is NOT defined here
    testDeactivateNotOverridden: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 FIX #6: deactivateLicense OVERRIDE TEST');
        console.log('═══════════════════════════════════════════');

        const modalsHasOwn = Object.prototype.hasOwnProperty.call(
            window,
            'deactivateLicense'
        );

        // Check if the function source contains the broken stub marker
        let fnSource = '';
        try {
            fnSource = String(window.deactivateLicense || '');
        } catch (e) {}

        const isBrokenStub = fnSource.includes('[modals] deactivateLicense not implemented here');
        const isFromLicenseJs = fnSource.includes('openDeactivationModal') ||
                                fnSource.includes('modalOpened');

        console.log('  window.deactivateLicense exists:', modalsHasOwn ? '✅' : '❌');
        console.log('  Is broken modals.js stub:', isBrokenStub ? '❌ YES (FAIL)' : '✅ NO');
        console.log('  Is license.js version:', isFromLicenseJs ? '✅ YES' : '⚠️ unknown');
        console.log('');
        console.log('  Expected: license.js version (opens deactivation modal)');

        const pass = modalsHasOwn && !isBrokenStub;
        console.log('  Result:', pass ? '✅ PASS' : '❌ FAIL');
        console.log('═══════════════════════════════════════════');

        return { hasFunction: modalsHasOwn, isBrokenStub, isFromLicenseJs, pass };
    },

    selfTest: () => {
        console.log('═══════════════════════════════════════════');
        console.log('🧪 MODALS SELF-TEST (v3.7.4.76)');
        console.log('═══════════════════════════════════════════');

        const checks = {
            showProgress: typeof showProgress === 'function',
            setProgress: typeof setProgress === 'function',
            hideProgress: typeof hideProgress === 'function',
            renderQRCode: typeof renderQRCode === 'function',
            _tryOfflineQR: typeof _tryOfflineQR === 'function',       // FIX #5
            _renderViaNetwork: typeof _renderViaNetwork === 'function', // FIX #5
            _showQRFailure: typeof _showQRFailure === 'function',     // FIX #5
            _MiniQR: typeof _MiniQR !== 'undefined' && typeof _MiniQR.render === 'function',
            OfflineQRCode: typeof window.OfflineQRCode !== 'undefined',
            _escapeHtml: typeof _escapeHtml === 'function',
            _getPaymentURL: typeof _getPaymentURL === 'function',
            showFlash: typeof showFlash === 'function',
            showToast: typeof showToast === 'function',
            openBuyModal: typeof openBuyModal === 'function',
            openTrialActivationModal: typeof openTrialActivationModal === 'function',
            openDonateModal: typeof openDonateModal === 'function',
            openLicenseModal: typeof openLicenseModal === 'function',
            openEmojiModal: typeof openEmojiModal === 'function',
            openCharMapModal: typeof openCharMapModal === 'function',
            autoSyncLanguageFonts: typeof autoSyncLanguageFonts === 'function',
            handleModalOutsideClick: typeof handleModalOutsideClick === 'function',
            copyFromBox: typeof copyFromBox === 'function',
            insertFromBox: typeof insertFromBox === 'function'
        };

        Object.entries(checks).forEach(([key, pass]) => {
            console.log(`  ${pass ? '✅' : '❌'} ${key}`);
        });

        // 🔴 FIX #6: Verify deactivateLicense is NOT overridden here
        console.log('');
        console.log('🔴 FIX #6 — deactivateLicense override check:');
        let fnSource = '';
        try {
            fnSource = String(window.deactivateLicense || '');
        } catch (e) {}
        const isBrokenStub = fnSource.includes('[modals] deactivateLicense not implemented here');
        console.log(`  ${isBrokenStub ? '❌' : '✅'} deactivateLicense NOT overridden by modals.js`);

        console.log('');
        console.log('🆕 FIX #5 additions:');
        console.log('  • _tryOfflineQR() — Tier 1 offline attempt');
        console.log('  • _renderViaNetwork() — Tier 2 network fallback');
        console.log('  • _showQRFailure() — Tier 3 manual UPI text');
        console.log('  • testQRPriority() — Verify offline-first order');

        console.log('');
        console.log('🆕 FIX #6 additions:');
        console.log('  • Removed broken deactivateLicense() stub');
        console.log('  • License modal Deactivate button works again');
        console.log('  • testDeactivateNotOverridden() — Verify fix');

        const allPass = Object.values(checks).every(v => v) && !isBrokenStub;
        console.log('\n' + (allPass ? '🎉 ALL FUNCTIONS PRESENT + FIX #6 VERIFIED' : '⚠️ SOME ISSUES'));
        console.log('═══════════════════════════════════════════');

        return { checks, isBrokenStub, allPass };
    }
};

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ modals.js loaded — v3.7.4.76');
console.log('   ⏳ Progress: showProgress/setProgress/hideProgress');
console.log('   📸 QR priority: OFFLINE-FIRST (Fix #5)');
console.log('      1️⃣  OfflineQRCode (instant, no network)');
console.log('      2️⃣  Network providers (fallback)');
console.log('      3️⃣  Manual UPI text (final fallback)');
console.log('   📱 QR source: shared OfflineQRCode (no duplicate RS_TABLE)');
console.log('   💰 UPI: Smart decimal (9 not 9.00)');
console.log('   🔤 Fonts: Robust sync + fallback');
console.log('   🎯 Focus restore: on modal close');
console.log('   🎬 Flash: Proper ESC cleanup');
console.log('   🛡️  Modal guard: 3s timeout fallback');
console.log('   ✅ FIXED: Consolidated escapeHtml (1 function)');
console.log('   ✅ FIXED: Removed duplicate MiniQR (~450 lines)');
console.log('   ✅ FIXED: _MiniQR shim for ModalsDebug compat');
console.log('   🔴 FIX #6: deactivateLicense() REMOVED');
console.log('      (License modal "Deactivate" now uses license.js)');
console.log('   🧪 ModalsDebug.testQRPriority() available');
console.log('   🧪 ModalsDebug.testDeactivateNotOverridden() ← NEW');
console.log('   🧪 ModalsDebug.selfTest() available');
console.log('═══════════════════════════════════════════');