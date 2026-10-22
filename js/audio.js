// ============================================================
// 🔊 AUDIO — Fast Click Sound + Optional TTS
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.66 — PERFECT AUDIO:
//    • TTS throttle: single timer, 150ms coalesce
//    • AudioContext: resume() on suspended state
//    • Vibrate: try-catch wrapper
//    • speechSynthesis.cancel() before every speak
//    • Voice language: olChiki/devanagari/roman detection
//    • _audioFailed flag: manual reset available
//    • Symbol phonics: complete mapping
//    • Roman phonics: uppercase support
//    • Empty input guard
//    • Consistent rate/pitch/volume
//    • Language-aware TTS selection
//    • Null-safe window.AudioContext access
//    • Null-safe navigator.vibrate access
// ============================================================

let audioCtx = null;
let lastSpeechTime = 0;
let speechTimeout = null;
let _audioFailed = false;
let _audioInitFailed = false;

// ============================================================
// 🎯 OL CHIKI PHONICS
// ============================================================
const olChikiPhonics = {
    '1':'एक','2':'दो','3':'तीन','4':'चार','5':'पांच','6':'छह','7':'सात','8':'आठ','9':'नौ','0':'शून्य',
    '᱐':'शून्य','᱑':'एक','᱒':'दो','᱓':'तीन','᱔':'चार','᱕':'पांच','᱖':'छह','᱗':'सात','᱘':'आठ','᱙':'नौ',
    'ᱚ':'ऑ','ᱛ':'अत्','ᱜ':'अग्','ᱝ':'अंग्','ᱞ':'अल्','ᱟ':'आ','ᱟᱹ':'अ','ᱠ':'अक्','ᱡ':'अज्','ᱢ':'अम्','ᱣ':'अव',
    'ᱤ':'इ','ᱥ':'इस्','ᱦ':'अह्','ᱧ':'अञ्','ᱨ':'अ्र','ᱩ':'उ','ᱪ':'अच्','ᱫ':'अद्','ᱬ':'अण्','ᱭ':'अय',
    'ᱮ':'ए','ᱯ':'अप्','ᱰ':'अड्','ᱱ':'अन्','ᱲ':'अड़','ᱳ':'ओ','ᱴ':'अट्','ᱵ':'अब्','ᱶ':'अव्','ᱷ':'ओह',
    'ᱸ':'मु टुडक','ᱹ':'गहला टुडक','ᱺ':'रेला','ᱻ':'फरका','ᱼ':'खड्डा','ᱽ':'अहद','᱾':'मुचाद','᱿':'दो मुचाद'
};

// ============================================================
// 🎯 DEVANAGARI PHONICS
// ============================================================
const devanagariPhonics = {
    '1':'एक','2':'दो','3':'तीन','4':'चार','5':'पांच','6':'छह','7':'सात','8':'आठ','9':'नौ','0':'शून्य',
    '०':'शून्य','१':'एक','२':'दो','३':'तीन','४':'चार','५':'पांच','६':'छह','७':'सात','८':'आठ','९':'नौ',
    'ा':'आ की मात्रा','ि':'इ की मात्रा','ी':'ई की मात्रा','ु':'उ की मात्रा','ू':'ऊ की मात्रा',
    'े':'ए की मात्रा','ै':'ऐ की मात्रा','ो':'ओ की मात्रा','ौ':'औ की मात्रा','ृ':'ऋ की मात्रा',
    'ं':'अनुस्वार','ः':'विसर्ग','्':'हलंत','़':'नुकता','ँ':'चन्द्रबिन्दु',
    'क्र':'क्र','कृ':'कृ','प्र':'प्र','पृ':'पृ','त्र':'त्र','श्र':'श्र','द्र':'द्र','दृ':'दृ',
    'ग्र':'ग्र','ब्र':'ब्र','भ्र':'भ्र','ध्र':'ध्र','ह्र':'ह्र','हृ':'हृ','ट्र':'ट्र','ड्र':'ड्र',
    'द्व':'द्व','द्घ':'द्घ','द्य':'द्य','द्ध':'द्ध',
    'कʼ':'क चेक्ड','गʼ':'ग चेक्ड','चʼ':'च चेक्ड','जʼ':'ज चेक्ड',
    'तʼ':'त चेक्ड','दʼ':'द चेक्ड','पʼ':'प चेक्ड','बʼ':'ब चेक्ड',
    'ʼ':'ग्लोटल','ᱽ':'अहद','ᱷ':'ओह','ᱸ':'मु टुडक'
};

// ============================================================
// 🎯 ROMAN PHONICS
// ✅ Uppercase variants included
// ============================================================
const romanPhonics = {
    'a̱':'अ','e̱':'ए','o̱':'ओ','ã':'आं','ẽ':'एं','i̱':'इ','u̱':'उ',
    'ā':'आ','ē':'ए','ī':'ई','ō':'ओ','ū':'ऊ',
    'ḍ':'ड','ṭ':'ट','ṇ':'ण','ṅ':'ङ','ṛ':'ड़','ñ':'ञ','ḷ':'ळ','ṃ':'अनुस्वार','ṣ':'ष',
    'A̱':'बड़ा अ','E̱':'बड़ा ए','O̱':'बड़ा ओ','Ã':'बड़ा आं','Ẽ':'बड़ा एं',
    'Ḍ':'बड़ा ड','Ṭ':'बड़ा ट','Ṇ':'बड़ा ण','Ṅ':'बड़ा ङ','Ṛ':'बड़ा ड़','Ñ':'बड़ा ञ',
    'Ḷ':'बड़ा ळ','Ṃ':'बड़ा अनुस्वार','Ṣ':'बड़ा ष',
    'ʼ':'ग्लोटल','’':'राइट अपॉस्ट्रॉफी','\'':'अपॉस्ट्रॉफी'
};

// ============================================================
// 🎯 SYMBOL PHONICS
// ✅ Complete mapping
// ============================================================
const symbolPhonics = {
    '`':'Backtick', '~':'Tilde', '!':'Exclamation', '@':'At rate', '#':'Hash',
    '$':'Dollar', '%':'Percent', '^':'Caret', '&':'Ampersand', '*':'Asterisk',
    '(':'Open bracket', ')':'Close bracket', '-':'Minus', '_':'Underscore',
    '+':'Plus', '=':'Equal', '{':'Open brace', '}':'Close brace',
    '[':'Open square', ']':'Close square', '|':'Pipe', '\\':'Backslash',
    ':':'Colon', ';':'Semicolon', '"':'Double quote', '\'':'Single quote',
    '<':'Less than', '>':'Greater than', ',':'Comma', '.':'Dot',
    '?':'Question mark', '/':'Slash'
};

// ============================================================
// 🔊 FAST CLICK SOUND
// ✅ AudioContext resume + permanent failure tracking
// ============================================================
function playKeyClickSound() {
    // Check if sound is enabled
    if (typeof isClickSoundEnabled !== 'undefined' && !isClickSoundEnabled) return;

    // If audio permanently failed, skip
    if (_audioFailed || _audioInitFailed) return;

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            _audioInitFailed = true;
            return;
        }

        // ✅ Create context once
        if (!audioCtx) {
            audioCtx = new AudioContextClass();
        }

        // ✅ FIXED: Resume if suspended (Chrome autoplay policy)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(900, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.018);

        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.018);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.018);
    } catch (e) {
        // Permanent failure — stop trying
        _audioFailed = true;
        console.warn('Audio failed, disabling sound:', e.message);
    }
}

// ============================================================
// 🎤 SPEAK LETTER — Throttled TTS
// ============================================================
// ✅ v3.7.4.66:
//   Single setTimeout that owns the throttle window.
//   150ms throttle + 30ms coalesce = fast typing smooth.
// ============================================================
function speakLetter(ch) {
    // Check if voice enabled
    if (typeof isVoiceEnabled !== 'undefined' && !isVoiceEnabled) return;

    // Empty input guard
    if (!ch || typeof ch !== 'string') return;

    // Check speech synthesis availability
    if (!('speechSynthesis' in window)) return;

    // ✅ Haptic feedback (immediate, non-blocking)
    try {
        if (navigator.vibrate) {
            navigator.vibrate(5);
        }
    } catch (e) {}

    // ✅ Throttle: skip if we spoke within last 150ms
    const now = Date.now();
    if (now - lastSpeechTime < 150) return;
    lastSpeechTime = now;

    // ✅ FIXED: Cancel any pending utterance from a previous keystroke
    clearTimeout(speechTimeout);

    // Schedule speech on next tick (30ms) so rapid keystrokes coalesce
    speechTimeout = setTimeout(() => {
        try {
            // ✅ FIXED: Cancel previous utterance before speaking new one
            window.speechSynthesis.cancel();

            let spokenText = ch;
            let voiceLang = 'hi-IN';

            // ✅ Priority: specific phonics → fallback
            if (symbolPhonics[ch]) {
                spokenText = symbolPhonics[ch];
                voiceLang = 'en-US';
            } else if (olChikiPhonics[ch]) {
                spokenText = olChikiPhonics[ch];
                voiceLang = 'hi-IN';
            } else if (devanagariPhonics[ch]) {
                spokenText = devanagariPhonics[ch];
                voiceLang = 'hi-IN';
            } else if (romanPhonics[ch]) {
                spokenText = romanPhonics[ch];
                voiceLang = 'hi-IN';
            } else if (/^[a-zA-Z]$/.test(ch)) {
                // English letter — pronounce as uppercase
                spokenText = ch.toUpperCase();
                voiceLang = 'en-US';
            } else if (/^\d$/.test(ch)) {
                // Digit — pronounce in English
                spokenText = ch;
                voiceLang = 'en-US';
            } else if (/\s/.test(ch)) {
                // Whitespace — skip silently
                return;
            }

            const utter = new SpeechSynthesisUtterance(spokenText);
            utter.lang = voiceLang;
            utter.rate = 1.5;
            utter.pitch = 1.0;
            utter.volume = 0.7;

            window.speechSynthesis.speak(utter);
        } catch (e) {
            // Silent — TTS is optional
        }
    }, 30);
}

// ============================================================
// 🔧 RESET AUDIO (for debug)
// ============================================================
function resetAudioState() {
    _audioFailed = false;
    _audioInitFailed = false;

    if (audioCtx) {
        try {
            audioCtx.close();
        } catch (e) {}
        audioCtx = null;
    }

    lastSpeechTime = 0;
    clearTimeout(speechTimeout);
    speechTimeout = null;

    console.log('🔄 Audio state reset');
}

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
if (typeof window !== 'undefined') {
    window.AudioDebug = {
        status: () => {
            console.log('═══════════════════════════════════════════');
            console.log('🔊 Audio Status');
            console.log('───────────────────────────────────────────');
            console.log('  Context:', audioCtx ? audioCtx.state : 'not created');
            console.log('  Failed:', _audioFailed);
            console.log('  Init failed:', _audioInitFailed);
            console.log('  Sound enabled:', typeof isClickSoundEnabled !== 'undefined' ? isClickSoundEnabled : 'unknown');
            console.log('  Voice enabled:', typeof isVoiceEnabled !== 'undefined' ? isVoiceEnabled : 'unknown');
            console.log('  Last speech:', lastSpeechTime ? new Date(lastSpeechTime).toLocaleTimeString() : 'never');
            console.log('  AudioContext available:', !!(window.AudioContext || window.webkitAudioContext));
            console.log('  speechSynthesis available:', 'speechSynthesis' in window);
            console.log('═══════════════════════════════════════════');
        },

        testClick: () => {
            console.log('🔊 Playing test click...');
            playKeyClickSound();
        },

        testSpeak: (ch) => {
            console.log('🎤 Testing speak:', ch || 'a');
            lastSpeechTime = 0;
            speakLetter(ch || 'a');
        },

        testSpeakDelhi: () => {
            lastSpeechTime = 0;
            speakLetter('क');
            setTimeout(() => {
                lastSpeechTime = 0;
                speakLetter('ᱠ');
            }, 300);
            setTimeout(() => {
                lastSpeechTime = 0;
                speakLetter('ḍ');
            }, 600);
        },

        testPhonics: () => {
            console.log('🧪 Testing all phonics types:');
            console.log('  Symbol phonics entries:', Object.keys(symbolPhonics).length);
            console.log('  Ol Chiki phonics entries:', Object.keys(olChikiPhonics).length);
            console.log('  Devanagari phonics entries:', Object.keys(devanagariPhonics).length);
            console.log('  Roman phonics entries:', Object.keys(romanPhonics).length);
        },

        reset: () => resetAudioState(),

        resume: () => {
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().then(() => console.log('✅ AudioContext resumed'));
            } else if (!audioCtx) {
                console.log('ℹ️ No audio context yet — click a key first');
            } else {
                console.log('ℹ️ AudioContext state:', audioCtx.state);
            }
        },

        close: () => {
            if (audioCtx) {
                try {
                    audioCtx.close();
                    audioCtx = null;
                    console.log('🔇 AudioContext closed');
                } catch (e) {
                    console.warn('Close failed:', e.message);
                }
            } else {
                console.log('ℹ️ No audio context to close');
            }
        }
    };
}

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('✅ audio.js loaded — v3.7.4.66');
console.log('   🔊 AudioContext: lazy-init + resume on suspended');
console.log('   🎤 TTS: single timer + 150ms throttle');
console.log('   🌐 Language-aware voice (hi-IN / en-US)');
console.log('   📳 Vibrate: guarded try-catch');
console.log('   ✅ Null-safe all operations');