// ============================================================
// 🚨 SECURITY ALERTS — v3.1.0 (Config-Based)
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4
// ============================================================
// ✅ v3.1.0 — PLACEHOLDER DETECTION:
//    • NEW: _isPlaceholder() helper for all config values
//    • NEW: Early return in _sendEmail if endpoint placeholder
//    • NEW: Early return in _logToFirebase if URL placeholder
//    • NEW: Early return in _sendWhatsAppAPI if key placeholder
//    • NEW: Early return in _sendSMS if key placeholder
//    • NEW: Console logs why channel skipped (debug-friendly)
//    • NEW: Debug helper _getChannelStatus()
//    • RETAINED: All v3.0 features (config-based, rate limit, queue)
// ============================================================

const SecurityAlerts = {
    // ============================================================
    // 🎛️ CONFIG — Loaded from APP_CONFIG at runtime
    // ============================================================
    _config: {
        ADMIN_EMAIL: null,
        ADMIN_WHATSAPP: null,
        ADMIN_MOBILE: null,
        ENDPOINT: null,
        WHATSAPP_API_KEY: null,
        FAST2SMS_API_KEY: null,
        FIREBASE_ALERTS_URL: null
    },

    // ─── Feature flags ───
    ENABLED: true,
    EMAIL_ENABLED: true,
    WHATSAPP_AUTO_OPEN: false,
    WHATSAPP_API_ENABLED: false,
    SMS_ENABLED: false,

    // ============================================================
    // 🚨 ALERT THRESHOLDS
    // ============================================================
    THRESHOLDS: {
        MULTIPLE_ACTIVATIONS: 3,
        FAILED_KEYS: 5,
        RAPID_ACTIVATIONS: 10,
        TRIAL_ABUSE: 2,
        CLOCK_TAMPER: 1
    },

    _recentAlerts: {},
    _RATE_LIMIT_MS: 5 * 60 * 1000,

    // ============================================================
    // 🆕 v3.1.0: PLACEHOLDER DETECTION
    // ============================================================
    // Checks if a config value looks like a placeholder.
    // Returns true if value is:
    //   • null / undefined / empty
    //   • Contains YOUR_, _HERE, REPLACE_, etc.
    //   • Contains EXAMPLE, PLACEHOLDER, CHANGE_ME
    // ============================================================
    _isPlaceholder(value) {
        if (!value || typeof value !== 'string') return true;

        const trimmed = value.trim();
        if (trimmed.length === 0) return true;

        const upper = trimmed.toUpperCase();

        const placeholderKeywords = [
            'YOUR_',
            'YOUR-',
            '_HERE',
            '-HERE',
            'REPLACE_',
            'REPLACE-',
            'EXAMPLE',
            'PLACEHOLDER',
            'CHANGE_ME',
            'CHANGE-ME',
            'TODO',
            'FIXME',
            'XXXX',
            'DUMMY',
            'SAMPLE_',
            'SAMPLE-',
            'TEST_',
            'TEST-'
        ];

        for (const kw of placeholderKeywords) {
            if (upper.includes(kw)) return true;
        }

        // Firebase default placeholder pattern
        if (upper.includes('FIREBASE-PROJECT') ||
            upper.includes('FIREBASEDATABASE')) {
            // Only reject if combined with YOUR- prefix
            // (actual firebasedatabase.app domain is fine)
            if (upper.includes('YOUR-FIREBASE') ||
                upper.includes('YOUR_FIREBASE')) {
                return true;
            }
        }

        return false;
    },

    // ============================================================
    // 🆕 v3.1.0: CHANNEL STATUS HELPER (Debug)
    // ============================================================
    // Returns a snapshot of which channels are ready / skipped.
    // ============================================================
    _getChannelStatus() {
        const cfg = this._config;

        return {
            email: {
                enabled: this.EMAIL_ENABLED,
                endpointSet: !!cfg.ENDPOINT,
                isPlaceholder: this._isPlaceholder(cfg.ENDPOINT),
                ready: this.EMAIL_ENABLED &&
                       !!cfg.ENDPOINT &&
                       !this._isPlaceholder(cfg.ENDPOINT)
            },
            whatsappAutoOpen: {
                enabled: this.WHATSAPP_AUTO_OPEN,
                numberSet: !!cfg.ADMIN_WHATSAPP,
                isPlaceholder: this._isPlaceholder(cfg.ADMIN_WHATSAPP),
                ready: this.WHATSAPP_AUTO_OPEN &&
                       !!cfg.ADMIN_WHATSAPP &&
                       !this._isPlaceholder(cfg.ADMIN_WHATSAPP)
            },
            whatsappAPI: {
                enabled: this.WHATSAPP_API_ENABLED,
                keySet: !!cfg.WHATSAPP_API_KEY,
                isPlaceholder: this._isPlaceholder(cfg.WHATSAPP_API_KEY),
                ready: this.WHATSAPP_API_ENABLED &&
                       !!cfg.WHATSAPP_API_KEY &&
                       !this._isPlaceholder(cfg.WHATSAPP_API_KEY)
            },
            sms: {
                enabled: this.SMS_ENABLED,
                keySet: !!cfg.FAST2SMS_API_KEY,
                isPlaceholder: this._isPlaceholder(cfg.FAST2SMS_API_KEY),
                ready: this.SMS_ENABLED &&
                       !!cfg.FAST2SMS_API_KEY &&
                       !this._isPlaceholder(cfg.FAST2SMS_API_KEY)
            },
            firebase: {
                urlSet: !!cfg.FIREBASE_ALERTS_URL,
                isPlaceholder: this._isPlaceholder(cfg.FIREBASE_ALERTS_URL),
                ready: !!cfg.FIREBASE_ALERTS_URL &&
                       !this._isPlaceholder(cfg.FIREBASE_ALERTS_URL)
            }
        };
    },

    // ============================================================
    // 🔧 INIT — Load config from APP_CONFIG
    // ============================================================
    init() {
        try {
            const cfg = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : {};

            // Admin contact
            this._config.ADMIN_EMAIL = cfg.SELLER_EMAIL || null;
            this._config.ADMIN_WHATSAPP = cfg.SUPPORT_WHATSAPP || null;
            this._config.ADMIN_MOBILE = cfg.SUPPORT_WHATSAPP
                ? String(cfg.SUPPORT_WHATSAPP).replace(/\D/g, '').slice(-10)
                : null;

            // Endpoint (FormSubmit)
            this._config.ENDPOINT = cfg.FORMSUBMIT_ENDPOINT || null;

            // Firebase alerts URL (derive from TRACKING_ENDPOINT)
            if (cfg.TRACKING_ENDPOINT && typeof cfg.TRACKING_ENDPOINT === 'string') {
                try {
                    const u = new URL(cfg.TRACKING_ENDPOINT);
                    // ✅ Skip if tracking endpoint is placeholder
                    if (!this._isPlaceholder(cfg.TRACKING_ENDPOINT)) {
                        this._config.FIREBASE_ALERTS_URL =
                            `${u.protocol}//${u.host}/security-alerts.json`;
                    }
                } catch (e) {
                    this._config.FIREBASE_ALERTS_URL = null;
                }
            }

            // Optional: API keys from env
            this._config.WHATSAPP_API_KEY =
                (typeof process !== 'undefined' && process.env && process.env.WHATSAPP_API_KEY) || null;
            this._config.FAST2SMS_API_KEY =
                (typeof process !== 'undefined' && process.env && process.env.FAST2SMS_API_KEY) || null;

            // ─── Status snapshot ───
            const status = this._getChannelStatus();

            console.log('✅ [Alerts] Config loaded:');
            console.log('   📧 Email:', status.email.ready
                ? '✓ ready'
                : `✗ ${status.email.isPlaceholder ? 'placeholder' : 'not set'}`);
            console.log('   📱 WhatsApp (auto):', status.whatsappAutoOpen.ready
                ? '✓ ready'
                : `✗ ${status.whatsappAutoOpen.isPlaceholder ? 'placeholder' : 'not set'}`);
            console.log('   📱 WhatsApp (API):', status.whatsappAPI.ready
                ? '✓ ready'
                : `✗ ${status.whatsappAPI.enabled ? 'key missing/placeholder' : 'disabled'}`);
            console.log('   📲 SMS:', status.sms.ready
                ? '✓ ready'
                : `✗ ${status.sms.enabled ? 'key missing/placeholder' : 'disabled'}`);
            console.log('   🔥 Firebase:', status.firebase.ready
                ? '✓ ready'
                : `✗ ${status.firebase.isPlaceholder ? 'placeholder' : 'not set'}`);
        } catch (e) {
            console.warn('⚠️ [Alerts] Config load failed:', e.message);
        }
    },

    // ============================================================
    // 🚨 MAIN ALERT FUNCTION
    // ============================================================
    async alert(type, data = {}) {
        if (!this.ENABLED) return { skipped: true };

        if (!this._canSendAlert(type)) {
            console.log('🚨 Alert rate limited:', type);
            return { skipped: true, reason: 'rate-limit' };
        }

        const alertInfo = this._buildAlert(type, data);

        console.log('🚨 SECURITY ALERT:', alertInfo.title);

        // ─── Send Email ───
        if (this.EMAIL_ENABLED) {
            this._sendEmail(alertInfo).catch(() => {});
        }

        // ─── WhatsApp: Auto-open ONLY for HIGH/CRITICAL ───
        const isCritical = alertInfo.severity === 'HIGH' || alertInfo.severity === 'CRITICAL';

        if (this.WHATSAPP_AUTO_OPEN && isCritical) {
            this._sendWhatsApp(alertInfo).catch(() => {});
        } else {
            this._queueWhatsAppMessage(this._buildWhatsAppMessage(alertInfo));
        }

        // ─── WhatsApp via API (server-side, silent) ───
        if (this.WHATSAPP_API_ENABLED) {
            this._sendWhatsAppAPI(alertInfo).catch(() => {});
        }

        // ─── SMS ───
        if (this.SMS_ENABLED) {
            this._sendSMS(alertInfo).catch(() => {});
        }

        // ─── Log to Firebase ───
        this._logToFirebase(alertInfo).catch(() => {});

        // ─── Show UI Alert ───
        if (typeof showToast === 'function') {
            showToast(alertInfo.title, 'warning', 5000);
        }

        this._markAlertSent(type);
        return { success: true, alert: alertInfo };
    },

    // ============================================================
    // 🎯 BUILD ALERT INFO
    // ============================================================
    _buildAlert(type, data) {
        const alerts = {
            'multiple-activations': {
                icon: '🚨',
                severity: 'HIGH',
                title: 'Multiple Activations Detected',
                message: `Same device ने ${data.count || '3+'} बार activate किया है।`,
                recommendation: 'Customer से WhatsApp पर संपर्क करें'
            },
            'multiple-plans': {
                icon: '🚨',
                severity: 'HIGH',
                title: 'Multiple Plans on Same Device',
                message: `Same device पर ${data.plans?.join(', ') || 'multiple'} plans activate हुए हैं।`,
                recommendation: 'License sharing check करें'
            },
            'clock-tamper': {
                icon: '⏰',
                severity: 'CRITICAL',
                title: 'System Clock Tampering Detected',
                message: 'Customer ने system time बदलकर license bypass करने की कोशिश की।',
                recommendation: 'License immediately block करें'
            },
            'brute-force': {
                icon: '🔨',
                severity: 'HIGH',
                title: 'License Key Brute Force Attempt',
                message: `${data.attempts || '5+'} बार गलत license keys try की गईं।`,
                recommendation: 'IP/device block करें'
            },
            'trial-abuse': {
                icon: '⚠️',
                severity: 'HIGH',
                title: 'Trial Abuse Detected',
                message: `Same device ने ${data.count || '2+'} trials लिए हैं।`,
                recommendation: 'Device को permanent block करें'
            },
            'rapid-activations': {
                icon: '⚡',
                severity: 'MEDIUM',
                title: 'Rapid Activations Detected',
                message: `1 घंटे में ${data.count || '10+'} activations हुए हैं।`,
                recommendation: 'Real vs fake traffic check करें'
            },
            'invalid-signature': {
                icon: '🔐',
                severity: 'CRITICAL',
                title: 'Invalid License Signature',
                message: 'Fake license key generate करने की कोशिश।',
                recommendation: 'Immediate investigation'
            },
            'devtools-open': {
                icon: '🔧',
                severity: 'LOW',
                title: 'Developer Tools Opened',
                message: 'Customer ने browser dev tools खोले।',
                recommendation: 'Monitor करें'
            },
            'paste-abuse': {
                icon: '📋',
                severity: 'LOW',
                title: 'Paste in Typing Test',
                message: 'Typing test में paste करने की कोशिश।',
                recommendation: 'Certificate invalid करें'
            },
            'suspicious-activity': {
                icon: '🚨',
                severity: 'MEDIUM',
                title: 'Suspicious Activity',
                message: data.message || 'Unknown suspicious activity.',
                recommendation: 'Investigate करें'
            }
        };

        const base = alerts[type] || alerts['suspicious-activity'];

        return {
            ...base,
            type: type,
            timestamp: new Date().toISOString(),
            localTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            data: data,
            deviceId: data.deviceId || data.hwid || 'Unknown',
            customerName: data.customerName || data.name || 'Unknown'
        };
    },

    // ============================================================
    // 📧 SEND EMAIL — ✅ v3.1.0: Placeholder check
    // ============================================================
    async _sendEmail(alert) {
        // ✅ Fix #17: Early return if placeholder
        if (!this._config.ENDPOINT) {
            return { skipped: true, reason: 'no-endpoint' };
        }

        if (this._isPlaceholder(this._config.ENDPOINT)) {
            console.log('📧 [Alerts] Email skipped — endpoint is placeholder');
            return { skipped: true, reason: 'placeholder-endpoint' };
        }

        try {
            const payload = {
                _subject: `${alert.icon} ${alert.severity} ALERT — ${alert.title}`,
                _template: 'table',
                _captcha: 'false',
                "🚨 Alert Type": alert.type,
                "⚠️ Severity": alert.severity,
                "📋 Title": alert.title,
                "📝 Message": alert.message,
                "💡 Recommendation": alert.recommendation,
                "👤 Customer Name": alert.customerName,
                "📱 Device ID": alert.deviceId,
                "📅 Time": alert.localTime,
                "🔍 Details": JSON.stringify(alert.data, null, 2)
            };

            const response = await fetch(this._config.ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            console.log('📧 Alert email sent:', result);
            return { success: true };
        } catch (e) {
            console.warn('📧 Alert email failed:', e.message);
            return { success: false, error: e.message };
        }
    },

    // ============================================================
    // 📱 SEND WHATSAPP (Browser Auto-Open)
    // ✅ Note: Auto-open is safe — user sees WhatsApp open in new tab
    //          and can close it. This is legitimate UX.
    // ============================================================
    async _sendWhatsApp(alert) {
        if (!this._config.ADMIN_WHATSAPP) {
            return { skipped: true, reason: 'no-whatsapp' };
        }

        // ✅ Fix #17: Placeholder check for WhatsApp number
        if (this._isPlaceholder(this._config.ADMIN_WHATSAPP)) {
            console.log('📱 [Alerts] WhatsApp auto-open skipped — number is placeholder');
            return { skipped: true, reason: 'placeholder-whatsapp' };
        }

        const message = this._buildWhatsAppMessage(alert);

        try {
            const url = `https://wa.me/${this._config.ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank', 'noopener');
            console.log('📱 WhatsApp auto-opened');
            return { success: true };
        } catch (e) {
            this._queueWhatsAppMessage(message);
            return { success: false, error: e.message };
        }
    },

    // ============================================================
    // 📱 SEND WHATSAPP VIA API (CallMeBot)
    // ✅ v3.1.0: Placeholder check for API key
    // ============================================================
    async _sendWhatsAppAPI(alert) {
        if (!this._config.WHATSAPP_API_KEY || !this._config.ADMIN_WHATSAPP) {
            return { skipped: true, reason: 'no-whatsapp-api' };
        }

        // ✅ Fix #17: Placeholder check
        if (this._isPlaceholder(this._config.WHATSAPP_API_KEY)) {
            console.log('📱 [Alerts] WhatsApp API skipped — key is placeholder');
            return { skipped: true, reason: 'placeholder-api-key' };
        }

        if (this._isPlaceholder(this._config.ADMIN_WHATSAPP)) {
            console.log('📱 [Alerts] WhatsApp API skipped — number is placeholder');
            return { skipped: true, reason: 'placeholder-whatsapp' };
        }

        try {
            const message = this._buildWhatsAppMessage(alert);
            const phone = this._config.ADMIN_WHATSAPP;
            const apikey = this._config.WHATSAPP_API_KEY;

            const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apikey}`;

            await fetch(url, { method: 'GET', mode: 'no-cors' });
            console.log('📱 WhatsApp API sent');
            return { success: true };
        } catch (e) {
            console.warn('📱 WhatsApp API failed:', e.message);
            return { success: false, error: e.message };
        }
    },

    // ============================================================
    // 📲 SEND SMS (Fast2SMS)
    // ✅ v3.1.0: Placeholder check for API key
    // ============================================================
    async _sendSMS(alert) {
        if (!this._config.FAST2SMS_API_KEY || !this._config.ADMIN_MOBILE) {
            return { skipped: true, reason: 'no-sms' };
        }

        // ✅ Fix #17: Placeholder check
        if (this._isPlaceholder(this._config.FAST2SMS_API_KEY)) {
            console.log('📲 [Alerts] SMS skipped — key is placeholder');
            return { skipped: true, reason: 'placeholder-sms-key' };
        }

        if (this._isPlaceholder(this._config.ADMIN_MOBILE)) {
            console.log('📲 [Alerts] SMS skipped — mobile is placeholder');
            return { skipped: true, reason: 'placeholder-mobile' };
        }

        try {
            const smsText = this._buildSMSText(alert);

            const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
                method: 'POST',
                headers: {
                    'authorization': this._config.FAST2SMS_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    route: 'q',
                    message: smsText,
                    language: 'english',
                    flash: 0,
                    numbers: this._config.ADMIN_MOBILE
                })
            });

            const result = await response.json();
            console.log('📲 SMS sent:', result);
            return { success: true };
        } catch (e) {
            console.warn('📲 SMS failed:', e.message);
            return { success: false, error: e.message };
        }
    },

    // ============================================================
    // 📝 MESSAGE BUILDERS
    // ============================================================
    _buildWhatsAppMessage(alert) {
        return `${alert.icon} *${alert.severity} ALERT*

*${alert.title}*

📝 ${alert.message}

👤 Customer: ${alert.customerName}
📱 Device: ${alert.deviceId}
💡 Action: ${alert.recommendation}

📅 ${alert.localTime}

_Sent by Hor Katha Security System_`;
    },

    _buildSMSText(alert) {
        return `[HK-${alert.severity}] ${alert.title}
Device: ${alert.deviceId}
Customer: ${alert.customerName}
Time: ${alert.localTime}`;
    },

    // ============================================================
    // 💾 QUEUE WHATSAPP MESSAGE (for non-critical)
    // ============================================================
    _queueWhatsAppMessage(message) {
        try {
            const queue = JSON.parse(localStorage.getItem('hor_alert_queue') || '[]');
            queue.push({
                message: message,
                timestamp: new Date().toISOString()
            });
            if (queue.length > 50) queue.shift();
            localStorage.setItem('hor_alert_queue', JSON.stringify(queue));
            console.log('📱 Alert queued (not auto-opened)');
        } catch (e) {}
    },

    // ============================================================
    // 🔥 LOG TO FIREBASE
    // ✅ v3.1.0: Placeholder check for URL
    // ============================================================
    async _logToFirebase(alert) {
        if (!this._config.FIREBASE_ALERTS_URL) {
            return { skipped: true, reason: 'no-firebase' };
        }

        // ✅ Fix #17: Early return if placeholder
        if (this._isPlaceholder(this._config.FIREBASE_ALERTS_URL)) {
            console.log('🔥 [Alerts] Firebase log skipped — URL is placeholder');
            return { skipped: true, reason: 'placeholder-firebase' };
        }

        try {
            await fetch(this._config.FIREBASE_ALERTS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: alert.type,
                    severity: alert.severity,
                    title: alert.title,
                    message: alert.message,
                    customerName: alert.customerName,
                    deviceId: alert.deviceId,
                    timestamp: alert.timestamp,
                    data: alert.data
                })
            });

            console.log('🔥 Alert logged to Firebase');
            return { success: true };
        } catch (e) {
            console.warn('🔥 Firebase log failed:', e.message);
            return { success: false, error: e.message };
        }
    },

    // ============================================================
    // 🎯 ACTIVITY TRACKING HELPERS
    // ============================================================
    trackActivation(deviceId, customerName) {
        try {
            const key = 'hor_activation_log';
            const log = JSON.parse(localStorage.getItem(key) || '{}');

            if (!log[deviceId]) {
                log[deviceId] = {
                    count: 0,
                    plans: [],
                    firstSeen: Date.now(),
                    lastSeen: Date.now(),
                    customerName: customerName
                };
            }

            log[deviceId].count++;
            log[deviceId].lastSeen = Date.now();
            localStorage.setItem(key, JSON.stringify(log));

            if (log[deviceId].count >= this.THRESHOLDS.MULTIPLE_ACTIVATIONS) {
                this.alert('multiple-activations', {
                    deviceId: deviceId,
                    customerName: customerName,
                    count: log[deviceId].count
                });
            }

            return log[deviceId];
        } catch (e) {
            return null;
        }
    },

    trackPlan(deviceId, plan) {
        try {
            const key = 'hor_activation_log';
            const log = JSON.parse(localStorage.getItem(key) || '{}');

            if (!log[deviceId]) log[deviceId] = { plans: [] };
            if (!log[deviceId].plans) log[deviceId].plans = [];

            if (!log[deviceId].plans.includes(plan)) {
                log[deviceId].plans.push(plan);
            }

            localStorage.setItem(key, JSON.stringify(log));

            if (log[deviceId].plans.length > 1) {
                this.alert('multiple-plans', {
                    deviceId: deviceId,
                    plans: log[deviceId].plans
                });
            }
        } catch (e) {}
    },

    trackFailedKey(licenseKey, deviceId) {
        try {
            const key = 'hor_failed_keys';
            const log = JSON.parse(localStorage.getItem(key) || '{}');

            if (!log[deviceId]) log[deviceId] = { attempts: 0, keys: [] };

            log[deviceId].attempts++;
            log[deviceId].keys.push(String(licenseKey).substring(0, 20) + '...');
            if (log[deviceId].keys.length > 10) log[deviceId].keys.shift();

            localStorage.setItem(key, JSON.stringify(log));

            if (log[deviceId].attempts >= this.THRESHOLDS.FAILED_KEYS) {
                this.alert('brute-force', {
                    deviceId: deviceId,
                    attempts: log[deviceId].attempts,
                    keys: log[deviceId].keys
                });
            }
        } catch (e) {}
    },

    trackClockTamper(deviceId, originalTime, tamperedTime) {
        this.alert('clock-tamper', {
            deviceId: deviceId,
            originalTime: originalTime,
            tamperedTime: tamperedTime
        });
    },

    trackTrialAbuse(deviceId, count) {
        if (count >= this.THRESHOLDS.TRIAL_ABUSE) {
            this.alert('trial-abuse', {
                deviceId: deviceId,
                count: count
            });
        }
    },

    // ============================================================
    // 🎛️ HELPERS
    // ============================================================
    _canSendAlert(type) {
        const last = this._recentAlerts[type];
        if (!last) return true;
        return (Date.now() - last) >= this._RATE_LIMIT_MS;
    },

    _markAlertSent(type) {
        this._recentAlerts[type] = Date.now();
    },

    // ============================================================
    // 🧪 TEST HELPERS
    // ============================================================
    async test() {
        console.log('🧪 Testing security alert...');
        return await this.alert('suspicious-activity', {
            deviceId: 'DVC-TEST-1234',
            customerName: 'Test User',
            message: 'This is a test security alert'
        });
    },

    async testWhatsAppAPI() {
        console.log('🧪 Testing WhatsApp API...');
        return await this._sendWhatsAppAPI({
            icon: '🧪',
            severity: 'TEST',
            title: 'WhatsApp API Test',
            message: 'This is a test message',
            customerName: 'Test',
            deviceId: 'DVC-TEST',
            recommendation: 'None',
            localTime: new Date().toLocaleString('en-IN')
        });
    },

    async testSMS() {
        console.log('🧪 Testing SMS...');
        return await this._sendSMS({
            severity: 'TEST',
            title: 'SMS Test',
            deviceId: 'DVC-TEST',
            customerName: 'Test',
            localTime: new Date().toLocaleString('en-IN')
        });
    }
};

// ============================================================
// 🚀 AUTO-INIT
// ============================================================
if (typeof window !== 'undefined') {
    window.SecurityAlerts = SecurityAlerts;

    // Wait for APP_CONFIG before init
    if (typeof APP_CONFIG !== 'undefined') {
        SecurityAlerts.init();
    } else {
        setTimeout(() => {
            if (typeof APP_CONFIG !== 'undefined') {
                SecurityAlerts.init();
            }
        }, 500);
    }
}

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
if (typeof window !== 'undefined') {
    window.AlertsDebug = {
        status: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🚨 Alerts Status (v3.1.0)');
            console.log('───────────────────────────────────────────');

            const status = SecurityAlerts._getChannelStatus();

            console.log('  📧 Email:');
            console.log('     Enabled:', status.email.enabled);
            console.log('     Endpoint set:', status.email.endpointSet);
            console.log('     Is placeholder:', status.email.isPlaceholder);
            console.log('     ✅ Ready:', status.email.ready);

            console.log('  📱 WhatsApp (auto-open):');
            console.log('     Enabled:', status.whatsappAutoOpen.enabled);
            console.log('     Number set:', status.whatsappAutoOpen.numberSet);
            console.log('     Is placeholder:', status.whatsappAutoOpen.isPlaceholder);
            console.log('     ✅ Ready:', status.whatsappAutoOpen.ready);

            console.log('  📱 WhatsApp (API):');
            console.log('     Enabled:', status.whatsappAPI.enabled);
            console.log('     Key set:', status.whatsappAPI.keySet);
            console.log('     Is placeholder:', status.whatsappAPI.isPlaceholder);
            console.log('     ✅ Ready:', status.whatsappAPI.ready);

            console.log('  📲 SMS:');
            console.log('     Enabled:', status.sms.enabled);
            console.log('     Key set:', status.sms.keySet);
            console.log('     Is placeholder:', status.sms.isPlaceholder);
            console.log('     ✅ Ready:', status.sms.ready);

            console.log('  🔥 Firebase:');
            console.log('     URL set:', status.firebase.urlSet);
            console.log('     Is placeholder:', status.firebase.isPlaceholder);
            console.log('     ✅ Ready:', status.firebase.ready);

            console.log('═══════════════════════════════════════════');
            return status;
        },

        testPlaceholder: (value) => {
            const result = SecurityAlerts._isPlaceholder(value);
            console.log(`🧪 Placeholder test: "${value}" → ${result}`);
            return result;
        },

        testAllPlaceholders: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 PLACEHOLDER DETECTION TEST (Fix #17)');
            console.log('═══════════════════════════════════════════');

            const tests = [
                // Should be TRUE (placeholders)
                { value: 'YOUR_EMAIL_HERE', expect: true },
                { value: 'YOUR_WHATSAPP_NUMBER_HERE', expect: true },
                { value: 'https://formsubmit.co/ajax/YOUR_EMAIL_HERE', expect: true },
                { value: 'https://YOUR-FIREBASE-PROJECT.firebasedatabase.app/security-alerts.json', expect: true },
                { value: 'REPLACE_ME', expect: true },
                { value: 'PLACEHOLDER', expect: true },
                { value: 'CHANGE_ME', expect: true },
                { value: 'TEST_KEY_123', expect: true },
                { value: '', expect: true },
                { value: null, expect: true },
                { value: undefined, expect: true },

                // Should be FALSE (real values)
                { value: 'bosctechedu@gmail.com', expect: false },
                { value: '919110977117', expect: false },
                { value: 'https://formsubmit.co/ajax/bosctechedu@gmail.com', expect: false },
                { value: 'https://my-proj.firebasedatabase.app/security-alerts.json', expect: false },
                { value: 'abcd1234-secret-key', expect: false }
            ];

            let passCount = 0;
            let failCount = 0;

            tests.forEach((t, i) => {
                const actual = SecurityAlerts._isPlaceholder(t.value);
                const pass = actual === t.expect;
                if (pass) passCount++;
                else failCount++;

                const display = t.value === null ? 'null' :
                                t.value === undefined ? 'undefined' :
                                t.value === '' ? '(empty)' :
                                t.value.length > 50 ? t.value.substring(0, 50) + '...' : t.value;

                console.log(`  ${pass ? '✅' : '❌'} "${display}"`);
                console.log(`     Expected: ${t.expect}, Got: ${actual}`);
            });

            console.log('');
            console.log(`📊 Result: ${passCount}/${tests.length} passed`);
            console.log(failCount === 0 ? '🎉 ALL PASS' : `⚠️ ${failCount} FAILED`);
            console.log('═══════════════════════════════════════════');

            return { passCount, failCount, total: tests.length };
        },

        testEmailSkip: async () => {
            console.log('🧪 Testing email skip with current config...');
            const alert = {
                icon: '🧪', severity: 'TEST', title: 'Test',
                message: 'Test', customerName: 'Test', deviceId: 'TEST',
                recommendation: 'None', localTime: new Date().toLocaleString('en-IN'),
                type: 'test', timestamp: new Date().toISOString(), data: {}
            };
            const result = await SecurityAlerts._sendEmail(alert);
            console.log('  Result:', result);
            return result;
        },

        testFirebaseSkip: async () => {
            console.log('🧪 Testing Firebase skip with current config...');
            const alert = {
                icon: '🧪', severity: 'TEST', title: 'Test',
                message: 'Test', customerName: 'Test', deviceId: 'TEST',
                recommendation: 'None', localTime: new Date().toLocaleString('en-IN'),
                type: 'test', timestamp: new Date().toISOString(), data: {}
            };
            const result = await SecurityAlerts._logToFirebase(alert);
            console.log('  Result:', result);
            return result;
        },

        test: () => SecurityAlerts.test(),

        queue: () => {
            try {
                const queue = JSON.parse(localStorage.getItem('hor_alert_queue') || '[]');
                console.log('📱 WhatsApp queue:', queue.length, 'items');
                console.table(queue.slice(-10));
                return queue;
            } catch (e) {
                console.error('Queue read failed:', e.message);
                return [];
            }
        },

        clearQueue: () => {
            try {
                localStorage.removeItem('hor_alert_queue');
                console.log('🗑️ Queue cleared');
            } catch (e) {}
        },

        recentAlerts: () => {
            console.log('⏱️ Recent alert timestamps (rate limit):');
            console.table(SecurityAlerts._recentAlerts);
        },

        selfTest: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🧪 ALERTS SELF-TEST (v3.1.0)');
            console.log('═══════════════════════════════════════════');

            const checks = {
                _isPlaceholder: typeof SecurityAlerts._isPlaceholder === 'function',
                _getChannelStatus: typeof SecurityAlerts._getChannelStatus === 'function',
                init: typeof SecurityAlerts.init === 'function',
                alert: typeof SecurityAlerts.alert === 'function',
                _sendEmail: typeof SecurityAlerts._sendEmail === 'function',
                _sendWhatsApp: typeof SecurityAlerts._sendWhatsApp === 'function',
                _sendWhatsAppAPI: typeof SecurityAlerts._sendWhatsAppAPI === 'function',
                _sendSMS: typeof SecurityAlerts._sendSMS === 'function',
                _logToFirebase: typeof SecurityAlerts._logToFirebase === 'function',
                trackActivation: typeof SecurityAlerts.trackActivation === 'function',
                trackPlan: typeof SecurityAlerts.trackPlan === 'function',
                trackFailedKey: typeof SecurityAlerts.trackFailedKey === 'function',
                trackClockTamper: typeof SecurityAlerts.trackClockTamper === 'function',
                trackTrialAbuse: typeof SecurityAlerts.trackTrialAbuse === 'function'
            };

            Object.entries(checks).forEach(([key, pass]) => {
                console.log(`  ${pass ? '✅' : '❌'} ${key}`);
            });

            console.log('');
            console.log('🆕 v3.1.0 additions:');
            console.log('  • _isPlaceholder() — placeholder detection');
            console.log('  • _getChannelStatus() — status snapshot');
            console.log('  • Email: skips if endpoint placeholder');
            console.log('  • WhatsApp API: skips if key placeholder');
            console.log('  • SMS: skips if key placeholder');
            console.log('  • Firebase: skips if URL placeholder');
            console.log('  • Init logs channel readiness');

            const allPass = Object.values(checks).every(v => v);
            console.log('');
            console.log(allPass ? '🎉 ALL FUNCTIONS PRESENT' : '⚠️ SOME MISSING');
            console.log('═══════════════════════════════════════════');

            return checks;
        }
    };
}

console.log('✅ alerts.js loaded — v3.1.0 (placeholder detection)');
console.log('   🛡️  Config-based (no hardcoded admin info)');
console.log('   🚫 Placeholder detection active');
console.log('   📧 Email: skips placeholder endpoints');
console.log('   📱 WhatsApp API: skips placeholder keys');
console.log('   📲 SMS: skips placeholder keys');
console.log('   🔥 Firebase: skips placeholder URLs');
console.log('   ⏱️  Rate limiting: 5 min per alert type');
console.log('   💾 WhatsApp queue for non-critical alerts');
console.log('   🧪 AlertsDebug.testAllPlaceholders() available');
console.log('   🧪 AlertsDebug.status() available');