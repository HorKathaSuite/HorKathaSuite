# 📝 Changelog — Hoṛ Katha Suite

All notable changes to **Hoṛ/होड़ Katha Suite** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.7.4] — 2026-09-30

### 🎉 Major Features Added
- **₹9 Trial System** — 7-day full access with device-locked keys
- **Dual QR Generator** — Network API + built-in fallback (100% reliable)
- **WhatsApp Order Integration** — Direct order via WhatsApp
- **3-Level Typing Practice** — Basic, Advanced, Job Oriented (9 lessons)
- **Typing Certificate** — 3 styles with QR verification
- **Text-to-Speech** — 51 English voices with speed/pitch control
- **Voice Typing** — Speech-to-text (Hindi + English)
- **Kruti Dev Converter** — Unicode ↔ Kruti Dev for DTP
- **Script Converter** — Devanagari ↔ Ol Chiki ↔ Roman Santali
- **Ol Chiki Support** — Complete 30 characters + 11 digraphs
- **User Manual** — Complete guide with all features

### 🔒 Security Fixes (Critical)
- **CRITICAL:** Fixed infinite trial exploit (future-dated clock attack)
- **CRITICAL:** Fixed XSS bypass in `SecurityShield.sanitize()` (regex lastIndex bug)
- **CRITICAL:** Added HWID command injection prevention
- **HIGH:** Added sessionStorage guard
- **HIGH:** Fixed clock-tampering detection (forward jump)
- **HIGH:** Added endpoint fail-safe for tracker
- **MEDIUM:** Fixed DOM monitor to include `<head>`
- **MEDIUM:** Added strict license key regex validation

### 🐛 Bug Fixes
- **Fixed:** Duplicate keys in `keymaps.js` (affected typing)
- **Fixed:** QR rendering race condition in modals
- **Fixed:** Object URL memory leak (RAF-based revoke)
- **Fixed:** Event listener leak in keyboard (replaceChildren)
- **Fixed:** Print HTML formatting loss
- **Fixed:** TTS 15-second Chrome limit (chunking added)
- **Fixed:** Certificate `file://` origin detection
- **Fixed:** Certificate history quota exceeded error
- **Fixed:** Scroll throttling in typing test (layout thrashing)
- **Fixed:** Timer drift in background tab
- **Fixed:** localStorage crash in private mode (try-catch added)
- **Fixed:** Browser detection order (Edge/Opera/Brave)
- **Fixed:** Firefox `appearance` property missing
- **Fixed:** Safari flexbox QR bug (min-height)
- **Fixed:** Mobile viewport with `dvh` units

### 🎨 UI/UX Improvements
- **Added:** Quick Links section in manual
- **Added:** Payment (UPI/QR) section in manual
- **Added:** Certificate section in manual
- **Added:** QR troubleshooting in manual
- **Added:** 4 new FAQ entries
- **Added:** Dark mode modal adjustments
- **Added:** Reduced motion support
- **Added:** Print styles for manual
- **Improved:** Mobile responsive for all modals
- **Improved:** Modal loading states
- **Improved:** Focus states for accessibility

### ⚡ Performance
- **Optimized:** Debounced typing mode (100ms)
- **Optimized:** Throttled scroll (20 chars)
- **Optimized:** Counter updates (80ms debounce)
- **Optimized:** Cache version bumped to v11
- **Optimized:** Parallel HWID saves (Registry + File)
- **Optimized:** Promise.all for WhatsApp + Email

### 📚 Documentation
- **Added:** Complete `manual.html` with all features
- **Added:** `CHANGELOG.md` (this file)
- **Added:** `SECURITY.md`
- **Added:** `SETUP.md`
- **Updated:** `README.md` with v3.7.4 info

---

## [3.7.3] — 2026-09-15

### Added
- Certificate generator with QR verification
- Typing practice levels (Basic, Advanced, Job)
- WhatsApp sharing for certificates
- Real handwritten signature on certificates

### Fixed
- Certificate QR code reliability
- Signature line rendering
- Mobile certificate layout

---

## [3.7.2] — 2026-09-01

### Added
- Trial system (₹9 for 7 days)
- Device-locked trial keys
- Trial expiry banner

### Fixed
- Trial activation with device hash
- Trial key validation
- Duplicate trial prevention

---

## [3.7.1] — 2026-08-20

### Added
- Voice settings modal (51 voices)
- Speed/Pitch/Volume controls
- Voice search and filter

### Fixed
- Voice loading race condition
- TTS long text chunking
- Speech recognition auto-restart

---

## [3.7.0] — 2026-08-15

### Added
- **Kruti Dev Converter** — Unicode → Kruti Dev 010/011
- **IME Map Exporter** — JSON export for system integration
- **Character Map** — Unicode visualization with hover zoom
- **Emoji Palette** — 500+ emojis with categories
- **Find & Replace** — Regex-capable search

### Fixed
- Kruti Dev mapping accuracy
- Half character rendering
- Matra positioning

---

## [3.6.0] — 2026-07-25

### Added
- **Ol Chiki Support** — Full script implementation
- **Phonetic Transliteration** — Live typing conversion
- **Script Converter** — Multi-script conversion
- **Roman Santali** — Complete diacritics support

### Fixed
- Ol Chiki digraph detection
- Devanagari → Ol Chiki accuracy
- Phonetic dictionary

---

## [3.5.0] — 2026-06-15

### Added (Initial Release)
- Basic Hindi + English typing
- Virtual keyboard (2 layouts)
- Editor with auto-save
- Word/TXT export
- Print functionality
- Dark/Light theme
- PWA support

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🎉 | Major Features |
| 🔒 | Security |
| 🐛 | Bug Fixes |
| 🎨 | UI/UX |
| ⚡ | Performance |
| 📚 | Documentation |
| ⚠️ | Breaking Changes |
| 🚨 | Critical |

---

## Upcoming (Roadmap)

### v3.8.0 — Q1 2027
- [ ] Cloud sync (Firebase)
- [ ] Backup / Restore
- [ ] 5 certificate styles
- [ ] AI word prediction
- [ ] Android Play Store
- [ ] iOS App Store

### v4.0.0 — Q3 2027
- [ ] Multi-user support
- [ ] Team collaboration
- [ ] Santali dictionary integration
- [ ] macOS signed app
- [ ] Linux AppImage
- [ ] Real-time collaboration

---

## Version History Summary

| Version | Date | Key Feature |
|---------|------|-------------|
| 3.7.4 | 2026-09-30 | QR fix + Security + Manual |
| 3.7.3 | 2026-09-15 | Certificates |
| 3.7.2 | 2026-09-01 | Trial system |
| 3.7.1 | 2026-08-20 | Voice settings |
| 3.7.0 | 2026-08-15 | Kruti Dev |
| 3.6.0 | 2026-07-25 | Ol Chiki |
| 3.5.0 | 2026-06-15 | Initial release |

---

**Hoṛ/होड़ Katha Suite** — Multi-Script Typing Revolution

Developed by **BOSC Tech & Edu** · Made with ❤️ in Jharkhand, India