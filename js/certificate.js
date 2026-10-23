// ============================================================
// 🎓 CERTIFICATE GENERATOR — v7.8.2 (Uses External CSS)
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4
// ============================================================
// ✅ FIXES:
//   - Clears old "Test User" from localStorage
//   - Dropdown position fixed (Relies entirely on certificate.css)
//   - Event Delegation (Bypasses security.js onclick strip)
// ============================================================

// 🎨 INJECT FONTS ONLY
(function injectCertFonts() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('cert-fonts-link')) return;
    const link = document.createElement('link');
    link.id = 'cert-fonts-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Dancing+Script:wght@700&family=Noto+Sans+Devanagari:wght@400;600;700;900&display=swap';
    (document.head || document.documentElement).appendChild(link);
})();

// ============================================================
// 🎓 CERTIFICATE SYSTEM
// ============================================================
const CertificateSystem = {
    version: '7.8.2',
    currentData: null,
    _outsideClickHandler: null,
    _lockState: 'idle',
    _lockStartTime: 0,
    _LOCK_TIMEOUT_MS: 60000,
    _lastRenderTime: 0,
    _escHandler: null,
    _verifyUrlDiagnostics: null,
    _qrPromise: null,
    _resizeHandler: null,

    _acquireLock(action) {
        const now = Date.now();
        if (this._lockState !== 'idle') {
            const stuckMs = now - this._lockStartTime;
            if (stuckMs > this._LOCK_TIMEOUT_MS || stuckMs > 10000) {
                this._lockState = 'idle';
                this._lockStartTime = 0;
            } else {
                if (typeof showToast === 'function') showToast('⚠️ Already processing: ' + this._lockState, 'info', 2000);
                return false;
            }
        }
        this._lockState = action;
        this._lockStartTime = now;
        return true;
    },

    _releaseLock() {
        this._lockState = 'idle';
        this._lockStartTime = 0;
    },

    _safeRemove(node) {
        if (!node) return;
        try { if (typeof node.remove === 'function') { node.remove(); return; } } catch (e) {}
        try { if (node.parentNode) node.parentNode.removeChild(node); } catch (e) {}
    },

    open(testResult) {
        if (!testResult || typeof testResult !== 'object') {
            testResult = { group: 'basic', idx: 0, wpm: 45, accuracy: 96, grade: 'A+', chars: 250, errors: 3, duration: '01:00' };
        }
        this._releaseLock();
        this._qrPromise = null;

        let safeDate = new Date();
        if (testResult.date) {
            const parsed = new Date(testResult.date);
            if (!isNaN(parsed.getTime())) safeDate = parsed;
        }

        this.currentData = {
            category: testResult.group || 'basic',
            categoryName: this.getCategoryName(testResult.group),
            lessonName: this.getLessonName(testResult.group, testResult.idx),
            wpm: Number(testResult.wpm) || 0,
            accuracy: Number(testResult.accuracy) || 0,
            grade: testResult.grade || 'D',
            chars: Number(testResult.chars) || 0,
            errors: Number(testResult.errors) || 0,
            duration: testResult.duration || '00:00',
            date: safeDate,
            certificateNo: this.generateCertificateNo(testResult.group),
            studentName: ''
        };

        try {
            const licName = localStorage.getItem('hor_lic_user');
            let lastName = localStorage.getItem('hor_cert_last_name');
            
            // ✅ FIX 1: Clear old test names from localStorage
            if (lastName === 'Test User' || lastName === 'TEST USER') {
                lastName = '';
                localStorage.removeItem('hor_cert_last_name');
            }
            
            this.currentData.studentName = licName || lastName || '';
        } catch (e) {
            this.currentData.studentName = '';
        }

        this.renderModal();
    },

    renderModal() {
        const existing = document.getElementById('certificateModal');
        if (existing) this._safeRemove(existing);

        if (this._outsideClickHandler) { document.removeEventListener('click', this._outsideClickHandler); this._outsideClickHandler = null; }
        if (this._resizeHandler) { window.removeEventListener('resize', this._resizeHandler); this._resizeHandler = null; }

        const modal = document.createElement('div');
        modal.id = 'certificateModal';
        modal.className = 'active';
        const escapedStudentName = this.escapeHtml(this.currentData.studentName);

        modal.innerHTML = `
            <div class="cert-modal-container">
                <div class="cert-modal-header">
                    <div>
                        <div class="cert-modal-title">🎓 <span>Typing Certificate</span></div>
                        <div class="cert-modal-subtitle">${this.escapeHtml(this.currentData.categoryName)} · ${this.escapeHtml(this.currentData.lessonName)}</div>
                    </div>
                    <button class="cert-modal-close" data-action="close" aria-label="Close">✕</button>
                </div>

                <div class="cert-modal-body">
                    <div id="certNameForm" class="cert-name-input-wrap">
                        <label class="cert-name-label">✍️ अपना पूरा नाम डालें</label>
                        <input type="text" id="certStudentName" value="${escapedStudentName}" placeholder="e.g. Parish Marandi" maxlength="50" autocomplete="name" spellcheck="false">
                        <div class="cert-hint">यह नाम certificate पर print होगा</div>
                        <button class="cert-btn cert-btn-print" data-action="generate" style="margin-top:14px; padding:13px 44px; font-size:0.9rem;">
                            🎯 Generate Certificate
                        </button>
                    </div>
                    <div id="certPreviewContainer"></div>
                </div>

                <div class="cert-modal-footer" id="certModalFooter" style="display:none;">
                    <div class="cert-download-wrap">
                        <button class="cert-btn cert-btn-download" data-action="toggle-download">
                            💾 Download / Share
                            <span class="dropdown-arrow">▼</span>
                        </button>
                        <div class="cert-dropdown-menu" id="certDropdownMenu">
                            <button class="dropdown-item" data-action="download-png">
                                <span class="dd-icon">📸</span>
                                <div class="dd-text"><b>Download 4K PNG</b><small>Lossless Quality</small></div>
                            </button>
                            <button class="dropdown-item" data-action="save-pdf">
                                <span class="dd-icon">📄</span>
                                <div class="dd-text"><b>Save as PDF</b><small>Ultra Sharp</small></div>
                            </button>
                            <button class="dropdown-item" data-action="share-whatsapp">
                                <span class="dd-icon">📱</span>
                                <div class="dd-text"><b>Share on WhatsApp</b><small>With real verify link</small></div>
                            </button>
                            <button class="dropdown-item" data-action="copy-verify">
                                <span class="dd-icon">🔗</span>
                                <div class="dd-text"><b>Copy Verify Link</b><small>Open real verify page</small></div>
                            </button>
                            <div class="dropdown-divider"></div>
                            <button class="dropdown-item dropdown-close" data-action="close">
                                <span class="dd-icon">✕</span>
                                <div class="dd-text"><b>Close</b><small>Exit certificate</small></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            this._outsideClickHandler = (e) => {
                const menu = document.getElementById('certDropdownMenu');
                const btn = document.querySelector('.cert-btn-download');
                if (menu && menu.classList.contains('open') && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
                    menu.classList.remove('open');
                }
            };
            document.addEventListener('click', this._outsideClickHandler);
        }, 100);

        this._resizeHandler = () => {
            const menu = document.getElementById('certDropdownMenu');
            if (menu && menu.classList.contains('open')) menu.classList.remove('open');
        };
        window.addEventListener('resize', this._resizeHandler);

        if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
        this._escHandler = (e) => {
            if (e.key === 'Escape') {
                const m = document.getElementById('certificateModal');
                if (m && m.classList.contains('active')) this.close();
            }
        };
        document.addEventListener('keydown', this._escHandler);

        this._bindModalEvents();

        if (!this.currentData.studentName) {
            setTimeout(() => {
                const input = document.getElementById('certStudentName');
                if (input) { input.focus(); input.select(); }
            }, 250);
        } else {
            setTimeout(() => this.generatePreview(), 200);
        }
    },

    _bindModalEvents() {
        const modal = document.getElementById('certificateModal');
        if (!modal) return;
        if (modal.dataset.eventsBound === '1') return;
        modal.dataset.eventsBound = '1';

        modal.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            e.preventDefault();
            e.stopPropagation();

            const menu = document.getElementById('certDropdownMenu');
            const shouldClose = ['download-png', 'save-pdf', 'share-whatsapp', 'copy-verify'].includes(action);
            if (shouldClose && menu) menu.classList.remove('open');

            switch (action) {
                case 'close':           this.close(); break;
                case 'generate':        this.generatePreview(); break;
                case 'toggle-download': this.toggleDropdown(e); break;
                case 'download-png':    this.downloadPNG(); break;
                case 'save-pdf':        this.savePDF(); break;
                case 'share-whatsapp':  this.shareWhatsApp(); break;
                case 'copy-verify':     this.copyVerifyLink(); break;
            }
        });

        const nameInput = document.getElementById('certStudentName');
        if (nameInput) {
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this.generatePreview(); }
            });
        }
    },

    // ✅ FIX 2: Let CSS handle the dropdown positioning (No manual viewport calculation)
    toggleDropdown(event) {
        if (event && event.stopPropagation) event.stopPropagation();
        const menu = document.getElementById('certDropdownMenu');
        if (menu) {
            menu.classList.toggle('open');
        }
    },

    async generatePreview() {
        const nameInput = document.getElementById('certStudentName');
        const name = (nameInput ? nameInput.value : '').trim();

        if (!name || name.length < 2) {
            if (typeof showToast === 'function') showToast('⚠️ कृपया अपना पूरा नाम डालें', 'warning', 3000);
            else alert('⚠️ कृपया अपना पूरा नाम डालें');
            if (nameInput) {
                nameInput.style.borderColor = '#dc2626';
                nameInput.focus(); nameInput.select();
                setTimeout(() => { nameInput.style.borderColor = ''; }, 2500);
            }
            return;
        }

        this.currentData.studentName = name;
        try { localStorage.setItem('hor_cert_last_name', name); } catch (e) {}

        try {
            if (document.fonts && document.fonts.ready) {
                await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 3000))]);
            }
        } catch (e) {}

        const form = document.getElementById('certNameForm');
        if (form) form.style.display = 'none';
        const footer = document.getElementById('certModalFooter');
        if (footer) footer.style.display = 'flex';
        const container = document.getElementById('certPreviewContainer');
        if (!container) return;

        try {
            container.innerHTML = this.buildCertificateHTML();
            this._bindImageFallbacks(container);

            setTimeout(() => {
                const certEl = document.getElementById('certificateElement');
                if (certEl) certEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);

        } catch (err) {
            console.error('❌ Error:', err);
            alert('❌ Certificate Error:\n\n' + (err.message || err));
            if (form) form.style.display = 'block';
            if (footer) footer.style.display = 'none';
            return;
        }

        setTimeout(async () => {
            try { this._qrPromise = this.renderQRCode(); await this._qrPromise; } catch (e) {}
            try { this.saveToHistory(); } catch (e) {}
        }, 200);
    },

    _bindImageFallbacks(container) {
        container.querySelectorAll('img[data-fallback]').forEach(img => {
            if (img.dataset.fallbackBound === '1') return;
            img.dataset.fallbackBound = '1';
            img.addEventListener('error', function() {
                this.style.display = 'none';
                if (this.parentElement) this.parentElement.classList.add('img-fallback');
            });
            if (img.complete && img.naturalHeight === 0) {
                img.style.display = 'none';
                if (img.parentElement) img.parentElement.classList.add('img-fallback');
            }
        });
    },

    buildCertificateHTML() {
        const d = this.currentData;
        const categoryClass = d.category === 'basic' ? 'basic' : d.category === 'advanced' ? 'advanced' : 'job';
        const dateObj = (d.date instanceof Date && !isNaN(d.date.getTime())) ? d.date : new Date();
        let dateStr = '';
        try { dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) { dateStr = dateObj.toLocaleDateString(); }
        const levelName = d.category === 'basic' ? 'Basic' : d.category === 'advanced' ? 'Advanced' : 'Job Oriented';
        const langName = (window.currentLayout) ? ({ 'english': 'English', 'roman': 'Santali (Roman)', 'hindi-dev': 'Hindi', 'santali-dev': 'Santali', 'olchiki': 'Ol Chiki' }[window.currentLayout] || 'English') : 'English';
        const formattedName = String(d.studentName || '').toUpperCase().trim();
        const displayName = String(d.studentName || '').trim();
        const appVersion = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.VERSION) ? APP_CONFIG.VERSION : '3.7.4';

        return `
            <div class="typing-certificate ${categoryClass}" id="certificateElement">
                <div class="cert-watermark">ह</div>
                ${this.getCornerSVG('tl')} ${this.getCornerSVG('tr')} ${this.getCornerSVG('bl')} ${this.getCornerSVG('br')}
                
                <div class="cert-shield-top-center">
                    <img src="assets/logos/bosc-main-logo.png" alt="BOSC Tech & Education" class="cert-bosc-shield-img" data-fallback="shield">
                </div>
                
                <div class="cert-brand-top-right">
                    <div class="cert-brand-icon">
                        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="hkIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#0284c7"/><stop offset="50%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#d946ef"/>
                                </linearGradient>
                            </defs>
                            <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#hkIconGrad)" stroke="#ffffff" stroke-width="1.5"/>
                            <text x="20" y="17" text-anchor="middle" font-family="'Noto Sans Devanagari', serif" font-size="14" font-weight="900" fill="#ffffff">हो</text>
                            <text x="20" y="30" text-anchor="middle" font-family="'Inter', sans-serif" font-size="8" font-weight="900" fill="#ffffff" letter-spacing="1">HKS</text>
                        </svg>
                    </div>
                    <div class="cert-brand-text">
                        <div class="cert-brand-name">Hoṛ Katha Suite</div>
                        <div class="cert-brand-version">V${appVersion} PRO ULTRA</div>
                    </div>
                </div>

                <div class="cert-content">
                    <div class="cert-header">
                        <div class="cert-issuer-name">BOSC Tech &amp; Edu</div>
                        <div class="cert-main-title">Certificate of Typing Excellence</div>
                    </div>

                    <div class="cert-awarded-box">
                        <span class="cert-awarded-text">Awarded To</span>
                    </div>

                    <div class="cert-name-wrapper">
                        <div class="cert-name">${this.escapeHtml(formattedName)}</div>
                        <div class="cert-name-underline"></div>
                    </div>

                    <div class="cert-achievement">
                        This is to certify that <strong>${this.escapeHtml(displayName)}</strong> has successfully completed the <strong>Official Typing Proficiency Test</strong> conducted by <strong>BOSC Tech &amp; Edu</strong>, showing exceptional skill.
                    </div>

                    <div class="cert-details">
                        <div class="cert-detail-col left">
                            <div class="cert-detail-row"><span class="label">Cert No:</span><span class="value mono">${this.escapeHtml(d.certificateNo)}</span></div>
                            <div class="cert-detail-row"><span class="label">Date:</span><span class="value">${this.escapeHtml(dateStr)}</span></div>
                            <div class="cert-detail-row"><span class="label">Speed:</span><span class="value">${d.wpm} WPM</span></div>
                            <div class="cert-detail-row"><span class="label">Language:</span><span class="value">${this.escapeHtml(langName)}</span></div>
                        </div>
                        
                        <div class="cert-details-divider"></div>
                        
                        <div class="cert-detail-col right">
                            <div class="cert-detail-row"><span class="label">Accuracy:</span><span class="value">${d.accuracy}%</span></div>
                            <div class="cert-detail-row"><span class="label">Certificate Level:</span><span class="value">${this.escapeHtml(levelName)}</span></div>
                            <div class="cert-detail-row"><span class="label">Grade:</span><span class="value">${this.escapeHtml(d.grade)}</span></div>
                            <div class="cert-detail-row"><span class="label">Characters:</span><span class="value">${d.chars}</span></div>
                        </div>
                    </div>

                    <div class="cert-footer">
                        <div class="cert-signature-block">
                            <div class="cert-signature-line"><div class="cert-signature-text">Parish Marandi</div></div>
                            <div class="cert-signature-name">BOSC Tech &amp; Edu</div>
                            <div class="cert-signature-title">Founder &amp; CEO</div>
                        </div>
                        
                        <div class="cert-footer-qr">
                            <div class="cert-qr" id="certQrBox"></div>
                            <div class="cert-qr-label">Scan to Verify</div>
                        </div>
                        
                        <div class="cert-seal-bottom-right">
                            <img src="assets/logos/bosc-gold-seal.png" alt="BOSC Official Seal" class="cert-gold-seal-img" data-fallback="seal">
                        </div>
                    </div>

                    <div class="cert-footer-info">
                        Verified by BOSC Tech &amp; Edu · Made in India · www.bosctech.in · <strong style="color:#0369a1; font-size: 1.1em;">v${appVersion}</strong>
                    </div>
                </div>
            </div>
        `;
    },

    getCornerSVG(position) {
        return `
            <div class="cert-corner cert-corner-${position}">
                <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 5,5 L 25,5 Q 5,5 5,25 Z M 5,5 L 5,25 Q 5,5 25,5 Z M 10,10 L 20,10 L 10,20 Z" />
                    <circle cx="15" cy="15" r="3" />
                    <path d="M 30,5 L 55,5 L 55,10 L 35,10 L 30,15 Z" opacity="0.6" />
                    <path d="M 5,30 L 5,55 L 10,55 L 10,35 L 15,30 Z" opacity="0.6" />
                </svg>
            </div>
        `;
    },

    renderQRCode() {
        return new Promise((resolve) => {
            const qrBox = document.getElementById('certQrBox');
            if (!qrBox) { resolve(false); return; }
            qrBox.innerHTML = '';
            qrBox.removeAttribute('style');
            const verifyUrl = this.getVerifyUrl();

            if (typeof window.OfflineQRCode !== 'undefined' && window.OfflineQRCode.render) {
                try { if (window.OfflineQRCode.render(qrBox, verifyUrl, 200)) { resolve(true); return; } qrBox.innerHTML = ''; } catch (e) {}
            }

            if (typeof window.QRCode !== 'undefined') {
                try {
                    const qrWrap = document.createElement('div');
                    qrWrap.style.cssText = 'width:100%;height:100%;';
                    qrBox.appendChild(qrWrap);
                    new window.QRCode(qrWrap, { text: verifyUrl, width: 200, height: 200, correctLevel: window.QRCode.CorrectLevel.H });
                    setTimeout(() => {
                        const canvas = qrWrap.querySelector('canvas');
                        const img = qrWrap.querySelector('img');
                        if (canvas && img) this._safeRemove(img);
                        if (canvas) { canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block'; }
                        resolve(true);
                    }, 50);
                    return;
                } catch (e) { qrBox.innerHTML = ''; }
            }

            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verifyUrl)}&ecc=H&margin=1`;
            const img = document.createElement('img');
            img.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;';
            const placeholderHtml = `<div style="font-size:0.55rem; color:#475569; text-align:center; padding:6px; font-weight:700;"><div style="font-size:1.1rem; margin-bottom:2px;">🔗</div><div>Verify</div><div style="font-size:0.5rem; color:#0284c7;">verify.html</div></div>`;

            fetch(qrApiUrl, { mode: 'cors' }).then(r => { if (!r.ok) throw new Error('QR API fail'); return r.blob(); })
                .then(blob => {
                    const reader = new FileReader();
                    reader.onload = (e) => { img.src = e.target.result; qrBox.appendChild(img); resolve(true); };
                    reader.onerror = () => { qrBox.innerHTML = placeholderHtml; resolve(false); };
                    reader.readAsDataURL(blob);
                }).catch(() => {
                    img.src = qrApiUrl; img.crossOrigin = 'anonymous';
                    img.onerror = () => { qrBox.innerHTML = placeholderHtml; resolve(false); };
                    img.onload = () => resolve(true);
                    qrBox.appendChild(img);
                });
        });
    },

    _resolveBaseUrlForVerify(overrides) {
        const PRODUCTION_URL = 'https://hor-katha.vercel.app';
        const diag = { url: PRODUCTION_URL, source: 'hardcoded-fallback', reason: 'No other source available' };
        try {
            let cfg = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG) ? APP_CONFIG : null;
            let loc = (typeof window !== 'undefined' && window.location) ? window.location : null;
            if (overrides) {
                if (Object.prototype.hasOwnProperty.call(overrides, 'appConfigUrl')) cfg = overrides.appConfigUrl ? { BASE_URL: overrides.appConfigUrl } : null;
                if (Object.prototype.hasOwnProperty.call(overrides, 'windowOrigin')) {
                    if (overrides.windowOrigin) loc = { protocol: overrides.protocol || (String(overrides.windowOrigin).startsWith('https') ? 'https:' : 'http:'), origin: overrides.windowOrigin }; else loc = null;
                }
            }
            if (cfg && cfg.BASE_URL && /^https?:\/\//i.test(cfg.BASE_URL.trim())) { diag.url = cfg.BASE_URL.trim().replace(/\/+$/, ''); diag.source = 'app-config'; return diag; }
            if (loc && (loc.protocol === 'http:' || loc.protocol === 'https:') && loc.origin && loc.origin !== 'null') { diag.url = loc.origin.replace(/\/+$/, ''); diag.source = 'current-origin'; return diag; }
        } catch (e) {}
        return diag;
    },

    getVerifyUrl() {
        const d = this.currentData;
        const res = this._resolveBaseUrlForVerify();
        this._verifyUrlDiagnostics = { ...res, certificateNo: d ? d.certificateNo : null, timestamp: Date.now() };
        const dateStr = (d && d.date instanceof Date && !isNaN(d.date.getTime())) ? d.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const params = new URLSearchParams({ cert: d ? d.certificateNo : '', name: d ? d.studentName : '', wpm: String(d ? d.wpm : 0), acc: String(d ? d.accuracy : 0), grade: d ? d.grade : 'D', date: dateStr });
        return `${res.url}/verify.html?${params.toString()}`;
    },

    generateCertificateNo(category) {
        const prefix = category === 'basic' ? 'HK-BAS' : category === 'advanced' ? 'HK-ADV' : 'HK-JOB';
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2); const mm = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0');
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${yy}${mm}${dd}-${rand}`;
    },

    getCategoryName(group) {
        const map = { 'basic': '🟢 Basic Level', 'advanced': '🟠 Advanced Level', 'job': '🔵 Job Oriented Level' };
        return map[group] || '🟢 Basic Level';
    },

    getLessonName(group, idx) {
        const names = { basic: ['Home Row', 'Common Words', 'Short Sentences'], advanced: ['Punctuation', 'Numbers', 'Complex'], job: ['Email', 'Report', 'Govt Format'] };
        return (names[group] || names.basic)[idx] || 'Typing Practice';
    },

    async preloadImages(element) {
        if (!element) return;
        const images = element.querySelectorAll('img');
        if (images.length === 0) return;
        const promises = [];
        images.forEach(img => {
            if (img.complete && img.naturalHeight !== 0) return;
            promises.push(new Promise((resolve) => {
                const timeoutId = setTimeout(resolve, 5000);
                img.onload = () => { clearTimeout(timeoutId); resolve(); };
                img.onerror = () => { clearTimeout(timeoutId); resolve(); };
            }));
        });
        if (promises.length > 0) await Promise.allSettled(promises);
    },

    async renderCanvas(certElement) {
        if (typeof window.html2canvas === 'undefined') await this.loadHtml2Canvas();
        if (typeof window.html2canvas === 'undefined') throw new Error('html2canvas could not be loaded');
        await this.preloadImages(certElement);

        return await window.html2canvas(certElement, {
            scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false, allowTaint: false, imageTimeout: 10000, removeContainer: false,
            width: certElement.offsetWidth, height: certElement.offsetHeight, foreignObjectRendering: false
        });
    },

    async _waitForQR() {
        if (!this._qrPromise) return;
        try { await Promise.race([this._qrPromise, new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
    },

    async savePDF() {
        if (this._lockState !== 'idle' && Date.now() - this._lockStartTime > 10000) { this._lockState = 'idle'; this._lockStartTime = 0; }
        if (!this._acquireLock('downloading-pdf')) return;
        const certElement = document.getElementById('certificateElement');
        if (!certElement) { this._releaseLock(); return; }
        if (typeof showToast === 'function') showToast('⚡ PDF बन रहा है...', 'info', 3000);

        try {
            await this._waitForQR();
            if (!window.jspdf || !window.jspdf.jsPDF) await this.loadJsPDF();
            const jsPDFConstructor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
            if (!jsPDFConstructor) throw new Error('jsPDF load failed');

            const canvas = await this.renderCanvas(certElement);
            const imgData = canvas.toDataURL('image/png', 1.0);
            const pdf = new jsPDFConstructor({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
            const finalWidth = canvas.width * ratio;
            const finalHeight = canvas.height * ratio;
            const x = (pdfWidth - finalWidth) / 2;
            const y = (pdfHeight - finalHeight) / 2;

            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
            pdf.save(`Typing_Certificate_${this.currentData.certificateNo}_${Date.now()}.pdf`);
            if (typeof showToast === 'function') showToast('✅ PDF downloaded!', 'success', 2500);
        } catch (e) {
            if (typeof showToast === 'function') showToast('⚠️ PDF fail: ' + e.message, 'warning', 5000);
        } finally { this._releaseLock(); }
    },

    async downloadPNG() {
        if (this._lockState !== 'idle' && Date.now() - this._lockStartTime > 10000) { this._lockState = 'idle'; this._lockStartTime = 0; }
        if (!this._acquireLock('downloading-png')) return;
        const certElement = document.getElementById('certificateElement');
        if (!certElement) { this._releaseLock(); return; }
        if (typeof showToast === 'function') showToast('⚡ PNG बन रहा है...', 'info', 3000);

        try {
            await this._waitForQR();
            const canvas = await this.renderCanvas(certElement);
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Blob creation failed')), 'image/png');
            });
            if (!blob || blob.size === 0) throw new Error('Empty blob generated');
            this._fastDownload(blob, `Typing_Certificate_${this.currentData.certificateNo}_${Date.now()}.png`);
        } catch (e) {
            if (typeof showToast === 'function') showToast('⚠️ PNG fail: ' + e.message, 'warning', 5000);
        } finally { this._releaseLock(); }
    },

    _fastDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename; link.href = url;
        document.body.appendChild(link); link.click();
        this._safeRemove(link);
        requestAnimationFrame(() => requestAnimationFrame(() => URL.revokeObjectURL(url)));
        if (typeof showToast === 'function') showToast(`✅ Downloaded! (${Math.round(blob.size / 1024)} KB)`, 'success', 2500);
    },

    loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (typeof window.html2canvas !== 'undefined') return resolve();
            const cdns = ['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js','https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'];
            let idx = 0;
            const tryNext = () => {
                if (idx >= cdns.length) return reject(new Error('All html2canvas CDNs failed'));
                const script = document.createElement('script'); script.src = cdns[idx++]; script.async = true;
                script.onload = resolve; script.onerror = tryNext; document.head.appendChild(script);
                setTimeout(() => { if (typeof window.html2canvas === 'undefined' && idx < cdns.length) tryNext(); }, 8000);
            };
            tryNext();
        });
    },

    loadJsPDF() {
        return new Promise((resolve, reject) => {
            if ((window.jspdf && window.jspdf.jsPDF) || window.jsPDF) return resolve();
            const cdns = ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js','https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'];
            let idx = 0;
            const tryNext = () => {
                if (idx >= cdns.length) return reject(new Error('All jsPDF CDNs failed'));
                const script = document.createElement('script'); script.src = cdns[idx++]; script.async = true;
                script.onload = resolve; script.onerror = tryNext; document.head.appendChild(script);
                setTimeout(() => { if ((!window.jspdf || !window.jspdf.jsPDF) && !window.jsPDF && idx < cdns.length) tryNext(); }, 8000);
            };
            tryNext();
        });
    },

    shareWhatsApp() {
        if (!this.currentData) return;
        const d = this.currentData;
        const msg = `🎓 *TYPING CERTIFICATE ACHIEVED*\n\n👤 *Name:* ${d.studentName}\n🏆 *Category:* ${d.categoryName}\n📖 *Lesson:* ${d.lessonName}\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Speed:* ${d.wpm} WPM\n🎯 *Accuracy:* ${d.accuracy}%\n🏅 *Grade:* ${d.grade}\n━━━━━━━━━━━━━━━━━━━━\n\n📋 *Certificate No:* ${d.certificateNo}\n\n🔗 *Verify Online:*\n${this.getVerifyUrl()}\n\n🔒 Verified by *BOSC Tech & Edu*\n📱 Hoṛ Katha Suite v3.7.4`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    },

    copyVerifyLink() {
        const url = this.getVerifyUrl();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => { if (typeof showToast === 'function') showToast('✅ Verify link copied!', 'success', 2500); })
            .catch(() => this.fallbackCopy(url));
        } else this.fallbackCopy(url);
    },

    fallbackCopy(text) {
        try {
            const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
            document.body.appendChild(ta); ta.focus(); ta.select();
            document.execCommand('copy'); this._safeRemove(ta);
            if (typeof showToast === 'function') showToast('✅ Link copied!', 'success', 2000);
        } catch (e) { alert('Copy failed'); }
    },

    saveToHistory() {
        if (!this.currentData) return;
        try {
            const history = JSON.parse(localStorage.getItem('hor_cert_history') || '[]');
            history.unshift({
                certificateNo: this.currentData.certificateNo, studentName: this.currentData.studentName,
                category: this.currentData.category, categoryName: this.currentData.categoryName,
                lessonName: this.currentData.lessonName, wpm: this.currentData.wpm,
                accuracy: this.currentData.accuracy, grade: this.currentData.grade,
                date: (this.currentData.date instanceof Date && !isNaN(this.currentData.date.getTime())) ? this.currentData.date.toISOString() : new Date().toISOString()
            });
            if (history.length > 50) history.length = 50;
            try { localStorage.setItem('hor_cert_history', JSON.stringify(history)); }
            catch (quotaError) { history.length = 20; localStorage.setItem('hor_cert_history', JSON.stringify(history)); }
        } catch (e) {}
    },

    getHistory() { try { return JSON.parse(localStorage.getItem('hor_cert_history') || '[]'); } catch (e) { return []; } },
    clearHistory() { try { localStorage.removeItem('hor_cert_history'); } catch (e) {} },

    close() {
        const modal = document.getElementById('certificateModal');
        if (modal) { modal.classList.remove('active'); setTimeout(() => this._safeRemove(modal), 350); }
        document.body.style.overflow = '';
        if (this._outsideClickHandler) { document.removeEventListener('click', this._outsideClickHandler); this._outsideClickHandler = null; }
        if (this._escHandler) { document.removeEventListener('keydown', this._escHandler); this._escHandler = null; }
        if (this._resizeHandler) { window.removeEventListener('resize', this._resizeHandler); this._resizeHandler = null; }
        this._qrPromise = null;
        this._releaseLock();
    },

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/`/g, '&#96;');
    }
};

window.CertificateSystem = CertificateSystem;

// ============================================================
// 🔍 DEBUG TOOLS
// ============================================================
if (typeof window !== 'undefined') {
    window.CertificateDebug = {
        status: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🎓 Certificate System v7.8.2 (Stable)');
            console.log('═══════════════════════════════════════════');
        },
        testGenerate: () => CertificateSystem.open({
            group: 'basic', idx: 0, wpm: 45, accuracy: 96,
            grade: 'A+', chars: 250, errors: 3, duration: '01:00'
        })
    };
}

console.log('✅ certificate.js v7.8.2 loaded — Ready');