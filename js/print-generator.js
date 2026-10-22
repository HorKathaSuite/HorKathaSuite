// ============================================================
// 🖨️ PREMIUM A4 PRINT GENERATOR — v4.9
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4
// ============================================================
// ✅ v4.9 — SECURITY HARDENED:
//    • CSS injection via style="" BLOCKED (sanitizeCssValue)
//    • javascript: in CSS url() BLOCKED
//    • data:text/html in CSS BLOCKED
//    • expression() BLOCKED (IE-era)
//    • @import BLOCKED (remote CSS)
//    • behavior: / -moz-binding BLOCKED
//    • URL protocol whitelist enforced
//    • Font whitelist validation
//    • Robust iframe cleanup
//    • PrintDebug.selfTest()
//    • All v4.8 features retained
// ============================================================

(function() {
    'use strict';

    console.log('📦 print-generator.js loading...');

    // ============================================================
    // 🛡️ SECURITY CONSTANTS
    // ============================================================

    /**
     * Dangerous CSS patterns — block these in style attributes
     */
    const SUSPICIOUS_CSS_PATTERNS = [
        /expression\s*\(/gi,              // Old IE XSS
        /javascript\s*:/gi,               // JS protocol
        /vbscript\s*:/gi,                 // VBScript
        /data:text\/html/gi,              // Inline HTML
        /data:application\/xhtml/gi,      // Inline XHTML
        /data:application\/x-javascript/gi,
        /@import\s+/gi,                   // Remote CSS
        /behavior\s*:/gi,                 // IE behavior
        /-moz-binding\s*:/gi,             // Old Firefox XSS
        /@charset\s+/gi,                  // Charset override
        /\\\d{1,6}/g,                     // CSS escapes
        /\/\*[\s\S]*?\*\//g               // CSS comments (can hide)
    ];

    /**
     * Allowed URL protocols in CSS url()
     */
    const SAFE_URL_PROTOCOLS = [
        'http:',
        'https:',
        'data:image/png',
        'data:image/jpeg',
        'data:image/jpg',
        'data:image/gif',
        'data:image/svg+xml',
        'data:image/webp',
        'data:image/x-icon'
    ];

    /**
     * Trusted font families (whitelist)
     */
    const TRUSTED_FONT_KEYWORDS = [
        'inter', 'roboto', 'noto', 'poppins', 'arial', 'helvetica',
        'times', 'georgia', 'courier', 'monospace', 'sans-serif', 'serif',
        'cursive', 'kalam', 'playfair', 'dancing script', 'kruti',
        'mangal', 'krutidev', 'devlys', 'tiro', 'rozha', 'yantramanav',
        'gentium', 'charis', 'doulos', 'source sans', 'open sans',
        'lato', 'montserrat', 'guru gomke', 'ol chiki'
    ];

    // ============================================================
    // 🔍 SAFE CONFIG ACCESS
    // ============================================================
    function getAppVersion() {
        try {
            if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.VERSION) {
                return APP_CONFIG.VERSION;
            }
        } catch (e) {}
        return '3.7.4';
    }

    // ============================================================
    // 🧼 ESCAPE HTML — XSS-Hardened
    // ============================================================
    function escHTML(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;')
            .replace(/\//g, '&#47;');
    }

    // ============================================================
    // 🎨 SANITIZE CSS VALUE
    // ✅ v4.9: Blocks all CSS injection vectors
    // ============================================================
    function sanitizeCssValue(cssText) {
        if (!cssText || typeof cssText !== 'string') return '';

        let cleaned = String(cssText);

        // Limit length
        if (cleaned.length > 2000) {
            cleaned = cleaned.substring(0, 2000);
        }

        // ─── Remove dangerous patterns ───
        for (let i = 0; i < SUSPICIOUS_CSS_PATTERNS.length; i++) {
            try {
                const pattern = SUSPICIOUS_CSS_PATTERNS[i];
                pattern.lastIndex = 0;
                cleaned = cleaned.replace(pattern, '');
                pattern.lastIndex = 0;
            } catch (e) {
                // Silent
            }
        }

        // ─── Sanitize url() calls ───
        cleaned = cleaned.replace(
            /url\s*\(\s*['"]?\s*([^'")]+)\s*['"]?\s*\)/gi,
            function(match, url) {
                const trimmed = String(url).trim().toLowerCase();
                const isSafe = SAFE_URL_PROTOCOLS.some(function(proto) {
                    return trimmed.startsWith(proto);
                });
                return isSafe ? match : '';
            }
        );

        // ─── Remove control characters ───
        cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

        return cleaned;
    }

    // ============================================================
    // 🎨 SANITIZE ENTIRE STYLE ATTRIBUTE STRING
    // ============================================================
    function sanitizeStyleAttribute(styleStr) {
        if (!styleStr || typeof styleStr !== 'string') return '';

        // Split by semicolon and process each property
        const properties = styleStr.split(';')
            .map(function(prop) {
                const trimmed = prop.trim();
                if (!trimmed) return '';

                // Ensure it's "prop: value" format
                const colonIdx = trimmed.indexOf(':');
                if (colonIdx < 0) return '';

                const name = trimmed.substring(0, colonIdx).trim().toLowerCase();
                const value = trimmed.substring(colonIdx + 1).trim();

                // Block dangerous property names
                if (name.startsWith('behavior') ||
                    name.startsWith('-moz-binding') ||
                    name.startsWith('expression')) {
                    return '';
                }

                // Sanitize value
                const safeValue = sanitizeCssValue(value);
                if (!safeValue) return '';

                return name + ': ' + safeValue;
            })
            .filter(function(p) { return p; })
            .join('; ');

        return properties;
    }

    // ============================================================
    // 🛡️ SANITIZE CONTENT — KEEP valid HTML, REMOVE dangerous
    // ✅ v4.9: Now also sanitizes CSS in style attributes
    // ============================================================
    function sanitizeContent(html) {
        if (!html || typeof html !== 'string') return '';

        let cleaned = html;

        // ═══════════════════════════════════════════════════════
        // 1️⃣ Remove <script> tags
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            ''
        );
        cleaned = cleaned.replace(/<\/script>/gi, '');

        // ═══════════════════════════════════════════════════════
        // 2️⃣ Remove dangerous embed tags
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(
            /<\/?(?:iframe|object|embed|applet|frame|frameset|meta|link|base|form|input|button|select|textarea)[^>]*>/gi,
            ''
        );

        // ═══════════════════════════════════════════════════════
        // 3️⃣ Remove inline event handlers
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '');
        cleaned = cleaned.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
        cleaned = cleaned.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

        // ═══════════════════════════════════════════════════════
        // 4️⃣ ✅ v4.9: Sanitize style attributes
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(
            /\s+style\s*=\s*"([^"]*)"/gi,
            function(match, styleVal) {
                const sanitized = sanitizeStyleAttribute(styleVal);
                return sanitized ? ` style="${sanitized}"` : '';
            }
        );
        cleaned = cleaned.replace(
            /\s+style\s*=\s*'([^']*)'/gi,
            function(match, styleVal) {
                const sanitized = sanitizeStyleAttribute(styleVal);
                return sanitized ? ` style='${sanitized}'` : '';
            }
        );

        // ═══════════════════════════════════════════════════════
        // 5️⃣ Remove ALL dangerous URL schemes
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(
            /(?:href|src|srcset|action|formaction|poster|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript|data|file|blob|about)\s*:[^"'\s>]*/gi,
            ''
        );

        // ═══════════════════════════════════════════════════════
        // 6️⃣ Remove srcdoc attribute
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(/\s+srcdoc\s*=\s*"[^"]*"/gi, '');
        cleaned = cleaned.replace(/\s+srcdoc\s*=\s*'[^']*'/gi, '');
        cleaned = cleaned.replace(/\s+srcdoc\s*=\s*[^\s>]+/gi, '');

        // ═══════════════════════════════════════════════════════
        // 7️⃣ Remove <svg> with inline event handlers
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(/<svg\b[^>]*\bon\w+\s*=[^>]*>/gi, '');

        // ═══════════════════════════════════════════════════════
        // 8️⃣ Remove <math> with inline event handlers
        // ═══════════════════════════════════════════════════════
        cleaned = cleaned.replace(/<math\b[^>]*\bon\w+\s*=[^>]*>/gi, '');

        return cleaned;
    }

    // ============================================================
    // 🔒 SANITIZE FONT FAMILY
    // ✅ v4.9: Stricter validation with whitelist
    // ============================================================
    function sanitizeFontFamily(raw) {
        if (!raw || typeof raw !== 'string') return '';

        // Remove dangerous chars
        let cleaned = raw
            .replace(/[;\r\n{}()<>]/g, '')
            .replace(/[\\]/g, '')
            .trim();

        // Length limit
        if (cleaned.length > 500) cleaned = cleaned.substring(0, 500);

        // Must have letters
        if (!/[a-zA-Z]/.test(cleaned)) return '';

        // Extract individual font names
        const fontNames = cleaned.split(',')
            .map(function(f) {
                return f.trim().replace(/^["']|["']$/g, '').toLowerCase();
            })
            .filter(function(f) { return f.length > 0; });

        // If none trusted, return empty (use default)
        const hasTrusted = fontNames.some(function(name) {
            return TRUSTED_FONT_KEYWORDS.some(function(kw) {
                return name.includes(kw);
            });
        });

        // If no trusted font, still allow if it's a plain font name
        // (no path, no URL, no weird chars)
        if (!hasTrusted) {
            const looksSafe = fontNames.every(function(f) {
                return /^[a-z0-9\s\-_]+$/i.test(f);
            });
            if (!looksSafe) return '';
        }

        return cleaned;
    }

    // ============================================================
    // 📛 SCRIPT NAME — null-safe
    // ============================================================
    function getScriptName() {
        const map = {
            'english':     'English',
            'roman':       'Santali (Roman)',
            'hindi-dev':   'Hindi (Devanagari)',
            'santali-dev': 'Santali (Devanagari)',
            'olchiki':     'Ol Chiki'
        };

        const key = window.currentLayout || 'english';
        return map[key] || 'English';
    }

    // ============================================================
    // 🔤 EDITOR FONT FAMILY
    // ============================================================
    function getEditorFontFamily() {
        try {
            const editor = document.getElementById('editor');
            if (!editor) return '';

            const inline = editor.style.fontFamily || '';
            if (inline) return sanitizeFontFamily(inline);

            const computed = window.getComputedStyle(editor).fontFamily || '';
            return sanitizeFontFamily(computed);
        } catch (e) {
            return '';
        }
    }

    // ============================================================
    // 🏗️ BUILD PRINT HTML
    // ============================================================
    function buildHTML(sanitizedContent, scriptName, userFontFamily) {
        const version = getAppVersion();

        const fontStack = userFontFamily
            ? userFontFamily + ', "Noto Sans Devanagari", "Noto Sans Ol Chiki", Inter, Arial, sans-serif'
            : '"Noto Sans Devanagari", "Noto Sans Ol Chiki", Inter, Arial, sans-serif';

        const s = [];

        // ─── Document Start ───
        s.push('<!DOCTYPE html><html lang="en"><head>');
        s.push('<meta charset="UTF-8">');
        s.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
        s.push('<title>Print — Hor Katha Suite</title>');

        // ─── Fonts ───
        s.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
        s.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
        s.push('<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&family=Noto+Sans+Ol+Chiki:wght@400;500;600;700&display=swap" rel="stylesheet">');

        // ─── Styles ───
        s.push('<style>');
        s.push('@page { size: A4 portrait; margin: 10mm; }');
        s.push('* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }');
        s.push('html, body { font-family: Inter, Arial, sans-serif; color: #000000; background: #ffffff; line-height: 1.5; }');
        s.push('body { padding: 0; margin: 0; }');
        s.push('.page { width: 100%; max-width: 190mm; margin: 0 auto; padding: 0; display: flex; flex-direction: column; gap: 8px; min-height: 277mm; }');
        s.push('.hdr { background: linear-gradient(135deg, #0b3b75 0%, #0284c7 55%, #a371f7 100%); color: #ffffff; padding: 14px 20px; border-radius: 10px; display: flex; align-items: center; gap: 16px; }');
        s.push('.logo { width: 60px; height: 60px; border-radius: 50%; background: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; color: #0284c7; flex-shrink: 0; border: 2px solid #ffffff; font-family: "Noto Sans Devanagari", serif; }');
        s.push('.hdr-txt { flex: 1; min-width: 0; }');
        s.push('.hdr-title { font-family: "Playfair Display", Georgia, serif; font-size: 22pt; font-weight: 900; line-height: 1.1; color: #ffffff; }');
        s.push('.hdr-line { height: 3px; width: 200px; background: #fde047; margin: 6px 0; border-radius: 2px; }');
        s.push('.hdr-tag { font-size: 10pt; color: #fde047; font-style: italic; font-weight: 700; }');
        s.push('.ver { background: #f59e0b; color: #0f172a; padding: 6px 14px; border-radius: 999px; font-size: 10pt; font-weight: 900; white-space: nowrap; }');
        s.push('.sec-hdr { font-size: 10pt; font-weight: 900; letter-spacing: 3px; color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-top: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px; text-transform: uppercase; flex-shrink: 0; }');
        s.push('.badge { background: #e0f2fe; color: #0284c7; padding: 3px 10px; border-radius: 999px; font-size: 8pt; font-weight: 800; border: 1px solid #bae6fd; }');
        s.push('.box { flex: 1 1 auto; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 16px 20px; font-size: 12pt; line-height: 2.05; color: #000000; letter-spacing: 0.15px; font-weight: 500; font-family: ' + fontStack + '; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; min-height: 100mm; }');
        s.push('.box img { max-width: 100%; height: auto; }');
        s.push('.box table { border-collapse: collapse; width: 100%; }');
        s.push('.box td, .box th { border: 1px solid #94a3b8; padding: 6px 10px; }');
        s.push('.box ul, .box ol { margin-left: 20px; padding-left: 10px; }');
        s.push('.box hr { border: none; border-top: 1px solid #94a3b8; margin: 10px 0; }');
        s.push('.ftr { background: rgb(124, 58, 237); border: 2px solid #fde047; border-radius: 10px; padding: 14px 22px; text-align: center; color: #ffffff; margin-top: auto; flex-shrink: 0; }');
        s.push('.ftr-1 { font-family: "Playfair Display", Georgia, serif; font-size: 12pt; font-weight: 900; color: #ffffff; margin-bottom: 4px; }');
        s.push('.ftr-1 .gold { color: #fde047; }');
        s.push('.ftr-2 { font-size: 9pt; color: #ede9fe; font-weight: 700; letter-spacing: 0.6px; }');
        s.push('@media print { body { background: #ffffff; } .page { max-width: 100%; min-height: 275mm; } .box { color: #000000 !important; } .hdr, .ftr, .sec-hdr { page-break-inside: avoid; break-inside: avoid; } }');
        s.push('</style></head><body>');

        // ─── Content ───
        s.push('<div class="page">');
        s.push('<div class="hdr"><div class="logo">ह</div><div class="hdr-txt"><div class="hdr-title">Hoṛ / होड़ Katha Suite</div><div class="hdr-line"></div><div class="hdr-tag">Multi-Script Typing Revolution</div></div><div class="ver">⚡ v' + escHTML(version) + ' PRO</div></div>');
        s.push('<div class="sec-hdr"><span>YOUR CONTENT</span><span class="badge">' + escHTML(scriptName) + '</span></div>');
        s.push('<div class="box">' + sanitizedContent + '</div>');
        s.push('<div class="ftr"><div class="ftr-1"><span class="gold">BOSC Tech &amp; Edu</span> · © 2024-2026</div><div class="ftr-2">🔒 AES-256 Encrypted · Device-Locked License</div></div>');
        s.push('</div></body></html>');

        return s.join('\n');
    }

    // ============================================================
    // 🖨️ PRINT VIA HIDDEN IFRAME
    // ============================================================
    function printViaIframe(html) {
        // Remove old frame
        const old = document.getElementById('__hk_print_frame__');
        if (old && old.parentNode) {
            try { old.parentNode.removeChild(old); } catch (e) {}
        }

        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.id = '__hk_print_frame__';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText =
            'position:fixed;top:-10000px;left:-10000px;' +
            'width:210mm;height:297mm;border:0;opacity:0;' +
            'pointer-events:none;visibility:hidden;z-index:-9999;';

        document.body.appendChild(iframe);

        // Null-safe access
        const win = iframe.contentWindow;
        const doc = (iframe.contentDocument) || (win && win.document) || null;

        if (!doc) {
            console.error('❌ iframe document not accessible');
            try { iframe.remove(); } catch (e) {}
            alert('⚠️ Print failed: iframe not accessible.\nPlease try again.');
            return;
        }

        // Write HTML
        try {
            doc.open();
            doc.write(html);
            doc.close();
        } catch (e) {
            console.error('❌ iframe write failed:', e);
            try { iframe.remove(); } catch (e2) {}
            alert('⚠️ Print failed: ' + e.message);
            return;
        }

        // Wait for fonts + print
        let printed = false;

        function doPrint() {
            if (printed) return;
            printed = true;

            try {
                if (win && typeof win.focus === 'function') {
                    win.focus();
                }
                if (win && typeof win.print === 'function') {
                    win.print();
                } else {
                    throw new Error('print() not available');
                }
            } catch (e) {
                console.error('Iframe print failed:', e);

                // Fallback: open new window
                try {
                    const w = window.open('', '_blank', 'width=900,height=1200,noopener,noreferrer');

                    if (w) {
                        w.document.open();
                        w.document.write(html);
                        w.document.close();

                        setTimeout(function() {
                            try {
                                w.focus();
                                w.print();
                            } catch (e2) {}
                        }, 500);
                    } else {
                        alert('⚠️ Popup blocked!\n\nPlease allow popups and try again.');
                    }
                } catch (e2) {
                    alert('⚠️ Print failed. Please check browser permissions.');
                }
            }

            // Cleanup after 10s
            setTimeout(function() {
                try {
                    if (iframe.parentNode) {
                        iframe.parentNode.removeChild(iframe);
                    }
                } catch (e) {}
            }, 10000);
        }

        // Font ready check
        let fallbackTimer = setTimeout(function() {
            console.warn('⚠️ Font load timeout (2s) — printing anyway');
            doPrint();
        }, 2000);

        try {
            const fontsReady = win && win.document && win.document.fonts && win.document.fonts.ready;

            if (fontsReady && typeof fontsReady.then === 'function') {
                fontsReady.then(function() {
                    clearTimeout(fallbackTimer);
                    setTimeout(doPrint, 200);
                }).catch(function() {
                    clearTimeout(fallbackTimer);
                    setTimeout(doPrint, 200);
                });
            } else {
                clearTimeout(fallbackTimer);
                setTimeout(doPrint, 800);
            }
        } catch (e) {
            clearTimeout(fallbackTimer);
            setTimeout(doPrint, 800);
        }
    }

    // ============================================================
    // 🧹 CLEANUP on page unload
    // ============================================================
    window.addEventListener('beforeunload', function() {
        try {
            const old = document.getElementById('__hk_print_frame__');
            if (old && old.parentNode) {
                old.parentNode.removeChild(old);
            }
        } catch (e) {}
    });

    // ============================================================
    // 🌐 PUBLIC API
    // ============================================================
    window.generatePremiumPrint = function() {
        const editor = document.getElementById('editor');

        if (!editor) {
            alert('Editor not found.');
            return;
        }

        const rawHTML = editor.innerHTML || '';

        const isEmpty = !rawHTML.trim() ||
                        rawHTML === '<br>' ||
                        rawHTML === '<br/>' ||
                        rawHTML === '<div><br></div>' ||
                        (editor.innerText || '').trim().length === 0;

        if (isEmpty) {
            alert('Please type some text before printing.');
            return;
        }

        try {
            const sanitized = sanitizeContent(rawHTML);
            const userFont = getEditorFontFamily();
            const html = buildHTML(sanitized, getScriptName(), userFont);

            printViaIframe(html);

            if (typeof showToast === 'function') {
                showToast('🖨️ Print dialog opening... Choose "Save as PDF"', 'success', 5000);
            }
        } catch (err) {
            console.error('Print failed:', err);
            alert('Print failed: ' + err.message);
        }
    };

    // ============================================================
    // 📊 DEBUG HELPERS
    // ============================================================
    if (typeof window !== 'undefined') {
        window.PrintDebug = {
            status: () => {
                console.log('═══════════════════════════════════════════');
                console.log('🖨️ Print Module Status');
                console.log('───────────────────────────────────────────');
                console.log('  Version: v4.9');
                console.log('  Orphan iframe:', !!document.getElementById('__hk_print_frame__'));
                console.log('  html2canvas loaded:', typeof window.html2canvas !== 'undefined');
                console.log('  Current layout:', window.currentLayout || 'english');
                console.log('  APP_CONFIG version:', getAppVersion());
                console.log('  CSS patterns:', SUSPICIOUS_CSS_PATTERNS.length);
                console.log('  Safe URL protocols:', SAFE_URL_PROTOCOLS.length);
                console.log('  Trusted font keywords:', TRUSTED_FONT_KEYWORDS.length);
                console.log('═══════════════════════════════════════════');
            },

            testSanitize: (html) => {
                console.log('🧪 Sanitize HTML test:');
                console.log('  Input: ', html);
                const output = sanitizeContent(html);
                console.log('  Output:', output);
                return output;
            },

            testSanitizeCss: (css) => {
                console.log('🧪 Sanitize CSS value test:');
                console.log('  Input: ', css);
                const output = sanitizeCssValue(css);
                console.log('  Output:', output);
                console.log('  Is empty:', !output);
                return output;
            },

            testSanitizeStyle: (style) => {
                console.log('🧪 Sanitize style attribute test:');
                console.log('  Input: ', style);
                const output = sanitizeStyleAttribute(style);
                console.log('  Output:', output);
                return output;
            },

            testFontSanitize: (font) => {
                console.log('🧪 Font sanitize test:');
                console.log('  Input: ', font);
                const output = sanitizeFontFamily(font);
                console.log('  Output:', output);
                return output;
            },

            /**
             * ✅ v4.9: Comprehensive security test
             */
            testSecurityAttacks: () => {
                console.log('═══════════════════════════════════════════');
                console.log('🧪 CSS INJECTION SECURITY TEST');
                console.log('═══════════════════════════════════════════');

                const attacks = [
                    // CSS url() with javascript:
                    { name: 'URL: javascript:', html: '<div style="background:url(javascript:alert(1))">test</div>' },
                    // CSS url() with data:text/html
                    { name: 'URL: data:text/html', html: '<div style="background:url(data:text/html,<script>alert(1)</script>)">test</div>' },
                    // CSS expression()
                    { name: 'CSS expression()', html: '<div style="width:expression(alert(1))">test</div>' },
                    // CSS @import
                    { name: 'CSS @import', html: '<div style="@import url(evil.css)">test</div>' },
                    // CSS behavior
                    { name: 'CSS behavior', html: '<div style="behavior:url(evil.htc)">test</div>' },
                    // -moz-binding
                    { name: '-moz-binding', html: '<div style="-moz-binding:url(evil.xml#xss)">test</div>' },
                    // Inline event handler
                    { name: 'onclick', html: '<div onclick="alert(1)">test</div>' },
                    // Script tag
                    { name: 'script', html: '<script>alert(1)</script>' },
                    // Bad URL protocol
                    { name: 'img javascript:', html: '<img src="javascript:alert(1)">' },
                    // srcdoc
                    { name: 'srcdoc', html: '<iframe srcdoc="<script>alert(1)</script>"></iframe>' },
                    // Safe: normal style
                    { name: 'SAFE: color', html: '<div style="color:red">test</div>', shouldKeep: true },
                    // Safe: bold
                    { name: 'SAFE: bold', html: '<b>Hello</b>', shouldKeep: true }
                ];

                let passCount = 0;
                let failCount = 0;

                attacks.forEach((attack, i) => {
                    const output = sanitizeContent(attack.html);
                    const hasScript = /javascript:|vbscript:|data:text|<script|on\w+\s*=|expression\s*\(|@import/i.test(output);

                    if (attack.shouldKeep) {
                        // Should preserve content
                        const preserved = output.includes('test') || output.includes('Hello');
                        if (preserved) {
                            console.log(`  ✅ ${attack.name}: preserved`);
                            passCount++;
                        } else {
                            console.log(`  ⚠️  ${attack.name}: over-sanitized`);
                            failCount++;
                        }
                    } else {
                        // Should block dangerous parts
                        if (!hasScript) {
                            console.log(`  ✅ ${attack.name}: blocked`);
                            passCount++;
                        } else {
                            console.log(`  ❌ ${attack.name}: BYPASSED!`);
                            console.log(`     Output: ${output}`);
                            failCount++;
                        }
                    }
                });

                console.log('');
                console.log(`📊 Results: ${passCount}/${attacks.length} passed`);
                console.log(failCount === 0 ? '🎉 ALL ATTACKS BLOCKED' : `⚠️ ${failCount} FAILURES`);
                console.log('═══════════════════════════════════════════');

                return { passCount, failCount, total: attacks.length };
            },

            testUrlFilter: () => {
                console.log('🧪 URL protocol filter test:');
                const urls = [
                    'javascript:alert(1)',
                    'vbscript:msgbox(1)',
                    'data:text/html,<script>alert(1)</script>',
                    'data:image/png;base64,xyz',
                    'https://safe.com/img.png',
                    'http://safe.com/img.png'
                ];

                urls.forEach(url => {
                    const safe = SAFE_URL_PROTOCOLS.some(proto => url.toLowerCase().startsWith(proto));
                    console.log(`  ${safe ? '✅' : '❌'} ${url.substring(0, 40)} → ${safe ? 'allowed' : 'blocked'}`);
                });
            },

            testFontSanitization: () => {
                console.log('🧪 Font sanitization test:');
                const fonts = [
                    "'Roboto', sans-serif",
                    "Arial",
                    "'Evil; font-family: url(javascript:alert(1))",
                    "'Noto Sans Devanagari', serif",
                    "Unknown Font 123",
                    "'; malicious(); '",
                    "Times New Roman"
                ];

                fonts.forEach(font => {
                    const result = sanitizeFontFamily(font);
                    console.log(`  Input:  ${font}`);
                    console.log(`  Output: ${result || '(empty)'}`);
                    console.log('');
                });
            },

            /**
             * ✅ v4.9: Full self-test
             */
            selfTest: () => {
                console.log('═══════════════════════════════════════════');
                console.log('🧪 PRINT GENERATOR SELF-TEST');
                console.log('═══════════════════════════════════════════');

                const checks = {
                    sanitizeContent: typeof sanitizeContent === 'function',
                    sanitizeCssValue: typeof sanitizeCssValue === 'function',
                    sanitizeStyleAttribute: typeof sanitizeStyleAttribute === 'function',
                    sanitizeFontFamily: typeof sanitizeFontFamily === 'function',
                    generatePremiumPrint: typeof window.generatePremiumPrint === 'function',
                    printViaIframe: typeof printViaIframe === 'function',
                    buildHTML: typeof buildHTML === 'function',
                    escHTML: typeof escHTML === 'function'
                };

                Object.entries(checks).forEach(([key, pass]) => {
                    console.log(`  ${pass ? '✅' : '❌'} ${key}`);
                });

                const allPass = Object.values(checks).every(v => v);
                console.log('');
                console.log(allPass ? '🎉 ALL FUNCTIONS PRESENT' : '⚠️ SOME MISSING');
                console.log('═══════════════════════════════════════════');

                return checks;
            },

            cleanup: () => {
                const old = document.getElementById('__hk_print_frame__');
                if (old && old.parentNode) {
                    old.parentNode.removeChild(old);
                    console.log('🧹 Orphan iframe cleaned');
                } else {
                    console.log('✅ No orphan iframe');
                }
            },

            test: () => {
                console.log('🧪 Test print (fake content)...');
                const html = buildHTML(
                    '<b>Bold</b> and <i>italic</i> and <u>underline</u> and <span style="color:red">red text</span>',
                    'English',
                    ''
                );
                printViaIframe(html);
                console.log('   Print dialog should open');
            },

            inspect: () => {
                const editor = document.getElementById('editor');
                if (!editor) {
                    console.log('❌ Editor not found');
                    return;
                }

                const raw = editor.innerHTML;
                const sanitized = sanitizeContent(raw);

                console.log('🔍 Content inspection:');
                console.log('  Raw HTML length:', raw.length);
                console.log('  Sanitized length:', sanitized.length);
                console.log('  Diff:', raw.length - sanitized.length, 'chars removed');
                console.log('  Script tags found:', /<script/i.test(raw));
                console.log('  Event handlers found:', /\son\w+\s*=/i.test(raw));
                console.log('  Dangerous URLs found:', /(?:href|src|action)\s*=\s*["']?(?:javascript|data|vbscript|file|blob):/i.test(raw));
                console.log('  CSS expression() found:', /expression\s*\(/i.test(raw));
            }
        };
    }

    console.log('✅ print-generator.js loaded — v4.9 (CSS injection hardened)');
})();