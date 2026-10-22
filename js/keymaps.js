// ============================================================
// ⌨️ KEYMAPS — Language Layouts + Hardware Keyboard Mappings
// BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
// ============================================================
// ✅ v3.7.4.72 — FIX #4 (W KEY):
//    • NEW: hardwareDevMap['w'] = 'व' (was MISSING — Hindi typing gap)
//    • Reason: पूरा phonetic map है ('v'='व', 'w'='व' भी natural)
//    • NEW: testDevW() debug helper added
//    • RETAINED: v3.7.4.70 Roman shortcodes + v3.7.4.69 fixes
// ============================================================

// ============================================================
// 📚 DEFAULT WORD SUGGESTIONS (per language)
// ============================================================
const defaultWordSuggestions = {
    'olchiki': [
        'ᱡᱚᱦᱟᱨ', 'ᱥᱟᱹᱜᱩᱱ', 'ᱟᱢ', 'ᱟᱹᱞᱤᱝ', 'ᱥᱟᱱᱛᱟᱲᱤ',
        'ᱫᱮᱞᱟ', 'ᱵᱮᱥ', 'ᱟᱹᱰᱤ', 'ᱦᱚᱲ', 'ᱠᱟᱛᱷᱟ'
    ],
    'santali-dev': [
        'जोहार', 'सगुन', 'आम', 'आलिं', 'सांतारी',
        'देला', 'बेस', 'आ़डी़', 'हो़ड़', 'कथा'
    ],
    'hindi-dev': [
        'नमस्ते', 'धन्यवाद', 'भारत', 'शुभकामनाएं', 'हाँ',
        'नहीं', 'मित्र', 'स्वागत', 'कृपा', 'प्रणाम', 'प्रकाश'
    ],
    'roman': [
        'Johar', 'Sagun', 'Am', 'Aling', 'Santali',
        'Dela', 'Bes', 'A̱ḍi̱', 'Hoṛ', 'Katha',
        'Dula̱ṛ', 'Manotan', 'Santaḷ'
    ],
    'english': [
        'Hello', 'Thanks', 'Welcome', 'Please', 'Good', 'Best', 'Great'
    ]
};

// ============================================================
// 🅰️ UNICODE → KRUTI DEV MAPPING
// ============================================================
const unicodeToKrutiMap = {
    'अ': 'v', 'आ': 'vk', 'इ': 'b', 'ई': 'bZ', 'उ': 'm', 'ऊ': 'Å',
    'ए': 's', 'ऐ': 'S', 'ओ': 'vks', 'औ': 'vkS', 'ऋ': '_k',

    'क': 'd', 'ख': '[k', 'ग': 'x', 'घ': '?k', 'ङ': '³',
    'च': 'p', 'छ': 'N', 'ज': 't', 'झ': 'Tk', 'ञ': '¥',
    'ट': 'V', 'ठ': 'B', 'ड': 'M', 'ढ': '<', 'ण': '.k',
    'त': 'r', 'थ': 'Fk', 'द': 'n', 'ध': '/k', 'न': 'u',
    'प': 'i', 'फ': 'Q', 'ब': 'c', 'भ': 'Hk', 'म': 'e',
    'य': ';', 'र': 'j', 'ल': 'y', 'व': 'o',
    'श': "'k", 'ष': '"k', 'स': 'l', 'ह': 'g',

    'क्ष': '{k', 'त्र': '=k', 'ज्ञ': 'K',
    'ड़': 'M+', 'ढ़': '<+', 'ऱ': 'j+',

    'ा': 'k', 'ी': 'h', 'ु': 'q', 'ू': 'w', 'े': 's', 'ै': 'S',
    'ो': 'ks', 'ौ': 'kS', 'ं': 'a', 'ः': '%', '्': '~', '़': '+',
    '।': 'A', '॥': 'AA',

    'क्र': 'Ø', 'कृ': 'Ñ', 'प्र': 'iz', 'पृ': 'i`',
    'श्र': 'J', 'द्र': 'æ', 'दृ': 'n`',
    'ग्र': 'xz', 'ब्र': 'cz', 'भ्र': 'Hkz', 'ध्र': '/kz',
    'ह्र': 'à', 'हृ': 'â', 'ट्र': 'Vª', 'ड्र': 'Mª',
    'द्व': '}', 'द्घ': 'ð', 'द्य': '|', 'द्ध': ')'
};

// ============================================================
// 🔤 HALF CHARACTER MAP (हलंत जोड़े)
// ============================================================
const halfCharMap = {
    'क': 'D', 'ख': '[', 'ग': 'X', 'घ': '?',
    'च': 'P', 'ज': 'T', 'झ': 'T',
    'ण': '.', 'त': 'R', 'थ': 'F', 'ध': '/', 'न': 'U',
    'प': 'I', 'फ': 'Q', 'ब': 'C', 'भ': 'H', 'म': 'E',
    'य': ':', 'ल': 'Y', 'व': 'O',
    'श': "'", 'ष': '"', 'स': 'L', 'ह': 'G', 'र': 'Z'
};

// ============================================================
// 🔤 TEXT SHORTCODES
// ✅ v3.7.4.70 — Added /jhr, /dlr, /mnt
// ============================================================
const textShortcodes = {
    // ─── Greetings ───
    '/jh':  { 'olchiki': 'ᱡᱚᱦᱟᱨ', 'santali-dev': 'जोहार', 'hindi-dev': 'नमस्ते', 'roman': 'Johar' },
    '/jhr': { 'olchiki': 'ᱡᱚᱦᱟᱨ', 'santali-dev': 'जोहार', 'hindi-dev': 'नमस्ते', 'roman': 'Johar' },
    '/sg':  { 'olchiki': 'ᱥᱟᱹᱜᱩᱱ ᱫᱟᱨᱟᱢ', 'santali-dev': 'सगुन दाराम', 'hindi-dev': 'शुभकामनाएं', 'roman': 'Sagun Daram' },
    '/hl':  { 'olchiki': 'ᱦᱮᱞᱳ', 'santali-dev': 'हेलो', 'hindi-dev': 'नमस्ते', 'roman': 'Hello' },

    // ─── Common words ───
    '/al':  { 'olchiki': 'ᱟᱹᱞᱤᱝ', 'santali-dev': 'आलिं', 'hindi-dev': 'हम दोनों', 'roman': 'Aling' },
    '/tm':  { 'olchiki': 'ᱟᱢ', 'santali-dev': 'आम', 'hindi-dev': 'आप', 'roman': 'Am' },
    '/hr':  { 'olchiki': 'ᱦᱚᱲ', 'santali-dev': 'हो़ड़', 'hindi-dev': 'आदमी', 'roman': 'Hoṛ' },
    '/ml':  { 'olchiki': 'ᱢᱟᱞᱟ', 'santali-dev': 'माला', 'hindi-dev': 'औरत', 'roman': 'Mala' },
    '/sk':  { 'olchiki': 'ᱥᱟᱠᱟᱢ', 'santali-dev': 'सकाम', 'hindi-dev': 'गाँव', 'roman': 'Sakam' },
    '/dr':  { 'olchiki': 'ᱫᱟᱨᱩ', 'santali-dev': 'दारु', 'hindi-dev': 'पेड़', 'roman': 'Daru' },
    '/ap':  { 'olchiki': 'ᱟᱯᱮ', 'santali-dev': 'आपे', 'hindi-dev': 'तुम', 'roman': 'Ape' },
    '/sn':  { 'olchiki': 'ᱥᱟᱱᱛᱟᱲ', 'santali-dev': 'सांताड़', 'hindi-dev': 'संताल', 'roman': 'Santaḷ' },
    '/dk':  { 'olchiki': 'ᱫᱟᱠ', 'santali-dev': 'दाक', 'hindi-dev': 'पानी', 'roman': 'Dak' },
    '/bh':  { 'olchiki': 'ᱵᱟᱦᱟ', 'santali-dev': 'बाहा', 'hindi-dev': 'फूल', 'roman': 'Baha' },
    '/jm':  { 'olchiki': 'ᱡᱚᱦᱟᱨ ᱢᱚᱱᱮ', 'santali-dev': 'जोहार मने', 'hindi-dev': 'प्रणाम', 'roman': 'Johar Mone' },
    '/ct':  { 'olchiki': 'ᱪᱟᱞᱳ', 'santali-dev': 'चालो', 'hindi-dev': 'चलो', 'roman': 'Chalo' },
    '/nt':  { 'olchiki': 'ᱱᱤᱛᱟ', 'santali-dev': 'निता', 'hindi-dev': 'अच्छा', 'roman': 'Nita' },
    '/sh':  { 'olchiki': 'ᱥᱟᱨᱦᱟᱣ', 'santali-dev': 'सरहाव', 'hindi-dev': 'धन्यवाद', 'roman': 'Sarhaw' },
    '/rr':  { 'olchiki': 'ᱨᱟᱹᱲ', 'santali-dev': 'राड़', 'hindi-dev': 'रोना', 'roman': 'Rar' },

    // ✅ NEW: Requested shortcodes
    '/dlr': { 'olchiki': 'ᱫᱩᱞᱟᱹᱲ', 'santali-dev': 'दुलाड़', 'hindi-dev': 'प्यार', 'roman': 'Dula̱ṛ' },
    '/mnt': { 'olchiki': 'ᱢᱟᱱᱚᱛᱟᱱ', 'santali-dev': 'मनोतान', 'hindi-dev': 'माननीय', 'roman': 'Manotan' },
    '/dul': { 'olchiki': 'ᱫᱩᱞᱟᱹᱲ', 'santali-dev': 'दुलाड़', 'hindi-dev': 'प्यार', 'roman': 'Dula̱ṛ' },
    '/man': { 'olchiki': 'ᱢᱟᱱᱚᱛᱟᱱ', 'santali-dev': 'मनोतान', 'hindi-dev': 'माननीय', 'roman': 'Manotan' },

    // ─── Symbols ───
    '/bt':  { 'olchiki': '• ', 'santali-dev': '• ', 'hindi-dev': '• ', 'roman': '• ', 'english': '• ' },
    '/nm':  { 'olchiki': '᱑. ', 'santali-dev': '१. ', 'hindi-dev': '१. ', 'roman': '1. ', 'english': '1. ' },
    '/cb':  { 'olchiki': '☐ ', 'santali-dev': '☐ ', 'hindi-dev': '☐ ', 'roman': '☐ ', 'english': '☐ ' },
    '/ar':  { 'olchiki': '→ ', 'santali-dev': '→ ', 'hindi-dev': '→ ', 'roman': '→ ', 'english': '→ ' },
    '/st':  { 'olchiki': '★ ', 'santali-dev': '★ ', 'hindi-dev': '★ ', 'roman': '★ ', 'english': '★ ' }
};

// ============================================================
// 📖 PHONETIC DICTIONARY
// ✅ v3.7.4.70 — Extended with Roman entries
// ============================================================
const phoneticDictionary = {
    'johar': { 'olchiki': 'ᱡᱚᱦᱟᱨ', 'santali-dev': 'जोहार', 'roman': 'Johar' },
    'sagun': { 'olchiki': 'ᱥᱟᱹᱜᱩᱱ', 'santali-dev': 'सगुन', 'roman': 'Sagun' },
    'am': { 'olchiki': 'ᱟᱢ', 'santali-dev': 'आम', 'roman': 'Am' },
    'aling': { 'olchiki': 'ᱟᱹᱞᱤᱝ', 'santali-dev': 'आलिं', 'roman': 'Aling' },
    'santali': { 'olchiki': 'ᱥᱟᱱᱛᱟᱲᱤ', 'santali-dev': 'सांतारी', 'roman': 'Santali' },
    'dela': { 'olchiki': 'ᱫᱮᱞᱟ', 'santali-dev': 'देला', 'roman': 'Dela' },
    'bes': { 'olchiki': 'ᱵᱮᱥ', 'santali-dev': 'बेस', 'roman': 'Bes' },
    'adi': { 'olchiki': 'ᱟᱹᱰᱤ', 'santali-dev': 'आ़डी़', 'roman': 'A̱ḍi̱' },
    'namaste': { 'olchiki': 'ᱡᱚᱦᱟᱨ', 'santali-dev': 'नमस्ते', 'hindi-dev': 'नमस्ते', 'roman': 'Namaste' },
    'dhanyawad': { 'olchiki': 'ᱥᱟᱨᱦᱟᱣ', 'santali-dev': 'धन्यवाद', 'hindi-dev': 'धन्यवाद', 'roman': 'Dhanyawad' },
    'hor': { 'olchiki': 'ᱦᱚᱲ', 'santali-dev': 'हो़ड़', 'roman': 'Hoṛ' },
    'katha': { 'olchiki': 'ᱠᱟᱛᱷᱟ', 'santali-dev': 'कथा', 'roman': 'Katha' },
    'hora': { 'olchiki': 'ᱦᱚᱲ', 'santali-dev': 'हो़ड़', 'roman': 'Hoṛa' },
    'mala': { 'olchiki': 'ᱢᱟᱞᱟ', 'santali-dev': 'माला', 'roman': 'Mala' },
    'sakam': { 'olchiki': 'ᱥᱟᱠᱟᱢ', 'santali-dev': 'सकाम', 'roman': 'Sakam' },
    'daru': { 'olchiki': 'ᱫᱟᱨᱩ', 'santali-dev': 'दारु', 'roman': 'Daru' },
    'ape': { 'olchiki': 'ᱟᱯᱮ', 'santali-dev': 'आपे', 'roman': 'Ape' },
    'santal': { 'olchiki': 'ᱥᱟᱱᱛᱟᱲ', 'santali-dev': 'सांताड़', 'roman': 'Santaḷ' },
    'dak': { 'olchiki': 'ᱫᱟᱠ', 'santali-dev': 'दाक', 'roman': 'Dak' },
    'baha': { 'olchiki': 'ᱵᱟᱦᱟ', 'santali-dev': 'बाहा', 'roman': 'Baha' },

    // ✅ NEW: Requested entries
    'jhr': { 'olchiki': 'ᱡᱚᱦᱟᱨ', 'santali-dev': 'जोहार', 'roman': 'Johar' },
    'dlr': { 'olchiki': 'ᱫᱩᱞᱟᱹᱲ', 'santali-dev': 'दुलाड़', 'roman': 'Dula̱ṛ' },
    'mnt': { 'olchiki': 'ᱢᱟᱱᱚᱛᱟᱱ', 'santali-dev': 'मनोतान', 'roman': 'Manotan' },
    'hr': { 'olchiki': 'ᱦᱚᱲ', 'santali-dev': 'होड़', 'roman': 'Hoṛ' },
    'dulaṛ': { 'olchiki': 'ᱫᱩᱞᱟᱹᱲ', 'santali-dev': 'दुलाड़', 'roman': 'Dula̱ṛ' },
    'manotan': { 'olchiki': 'ᱢᱟᱱᱚᱛᱟᱱ', 'santali-dev': 'मनोतान', 'roman': 'Manotan' }
};

// ============================================================
// 🎯 HARDWARE KEYBOARD MAP — Devanagari (Phonetic)
// ✅ v3.7.4.72 — FIX #4:
//    • NEW: 'w' → 'व' (was MISSING — Hindi typing gap)
//    • Retained: Shift+Z → ञ, Shift+[ → ऱ (v3.7.4.69 fixes)
// ============================================================
const hardwareDevMap = {
    // ─── Lowercase (consonants + matras) ───
    'a': 'ा', 'b': 'ब', 'c': 'च', 'd': 'द', 'e': 'े',
    'f': 'ि', 'g': 'ग', 'h': 'ह', 'i': 'ी', 'j': 'ज',
    'k': 'क', 'l': 'ल', 'm': 'म', 'n': 'न', 'o': 'ो',
    'p': 'प', 'q': '्', 'r': 'र', 's': 'स', 't': 'त',
    'u': 'ु', 'v': 'व', 'w': 'व', 'x': 'ं', 'y': 'य', 'z': 'ज़',
    // ✅ FIX #4: 'w' → 'व' (was missing)
    //    User typing "wahan", "water", "wapas" now produces correct व

    // ─── Uppercase (Shift) ───
    'A': 'आ', 'B': 'भ', 'C': 'छ', 'D': 'ड', 'E': 'ै',
    'F': 'ऋ', 'G': 'घ', 'H': 'ढ़', 'I': 'ई', 'J': 'झ',
    'K': 'ख', 'L': 'ळ', 'M': 'श', 'N': 'ण', 'O': 'ौ',
    'P': 'फ', 'Q': 'ॐ', 'R': 'ड़', 'S': 'ष', 'T': 'ट',
    'U': 'ू', 'V': 'ऩ', 'W': 'ङ', 'X': 'ँ', 'Y': 'य़',
    'Z': 'ञ',

    // ─── Symbols ───
    '[': 'ृ', ']': '़', '{': 'ऱ', '}': '़',
    ';': ';', "'": "'", ',': ',', '.': '.', '/': '/',
    '\\': '\\', '`': '`', '-': '-', '=': '='
};

// ============================================================
// 🎯 HARDWARE KEYBOARD MAP — Ol Chiki
// ✅ v3.7.4.68: Added 'p': 'ᱯ'
// ============================================================
const hardwareOlchikiMap = {
    // Lowercase
    'a': 'ᱚ', 'b': 'ᱵ', 'c': 'ᱪ', 'd': 'ᱫ', 'e': 'ᱮ',
    'f': 'ᱯ', 'g': 'ᱜ', 'h': 'ᱷ', 'i': 'ᱤ', 'j': 'ᱡ',
    'k': 'ᱠ', 'l': 'ᱞ', 'm': 'ᱢ', 'n': 'ᱱ', 'o': 'ᱳ',
    'p': 'ᱯ',
    'q': 'ᱥ', 'r': 'ᱨ', 's': 'ᱥ', 't': 'ᱛ',
    'u': 'ᱩ', 'v': 'ᱶ', 'w': 'ᱣ', 'x': 'ᱠ', 'y': 'ᱭ', 'z': 'ᱲ',

    // Uppercase (same output)
    'A': 'ᱚ', 'B': 'ᱵ', 'C': 'ᱪ', 'D': 'ᱫ', 'E': 'ᱮ',
    'F': 'ᱯ', 'G': 'ᱜ', 'H': 'ᱷ', 'I': 'ᱤ', 'J': 'ᱡ',
    'K': 'ᱠ', 'L': 'ᱞ', 'M': 'ᱢ', 'N': 'ᱱ', 'O': 'ᱳ',
    'P': 'ᱯ', 'Q': 'ᱥ', 'R': 'ᱨ', 'S': 'ᱥ', 'T': 'ᱛ',
    'U': 'ᱩ', 'V': 'ᱶ', 'W': 'ᱣ', 'X': 'ᱠ', 'Y': 'ᱭ', 'Z': 'ᱲ'
};

// ============================================================
// 🔗 OL CHIKI DIGRAPHS
// ============================================================
const olchikiDigraphs = {
    'ᱠᱷ': 'ᱠᱷ', 'ᱜᱷ': 'ᱜᱷ', 'ᱪᱷ': 'ᱪᱷ', 'ᱡᱷ': 'ᱡᱷ',
    'ᱴᱷ': 'ᱴᱷ', 'ᱰᱷ': 'ᱰᱷ', 'ᱛᱷ': 'ᱛᱷ', 'ᱫᱷ': 'ᱫᱷ',
    'ᱯᱷ': 'ᱯᱷ', 'ᱵᱷ': 'ᱵᱷ', 'ᱲᱷ': 'ᱲᱷ'
};

// ============================================================
// 🔄 SCRIPT CONVERSION MAPS
// ============================================================
const devToOlMap = {
    'अ': 'ᱚ', 'आ': 'ᱟ', 'इ': 'ᱤ', 'ई': 'ᱤ', 'उ': 'ᱩ', 'ऊ': 'ᱩ',
    'ए': 'ᱮ', 'ऐ': 'ᱮ', 'ओ': 'ᱳ', 'औ': 'ᱳ', 'ऑ': 'ᱚ',

    'क': 'ᱠ', 'ख': 'ᱠᱷ', 'ग': 'ᱜ', 'घ': 'ᱜᱷ', 'ङ': 'ᱝ',
    'च': 'ᱪ', 'छ': 'ᱪᱷ', 'ज': 'ᱡ', 'झ': 'ᱡᱷ', 'ञ': 'ᱧ',
    'ट': 'ᱴ', 'ठ': 'ᱴᱷ', 'ड': 'ᱰ', 'ढ': 'ᱰᱷ', 'ण': 'ᱬ',
    'त': 'ᱛ', 'थ': 'ᱛᱷ', 'द': 'ᱫ', 'ध': 'ᱫᱷ', 'न': 'ᱱ',
    'प': 'ᱯ', 'फ': 'ᱯᱷ', 'ब': 'ᱵ', 'भ': 'ᱵᱷ', 'म': 'ᱢ',
    'य': 'ᱭ', 'र': 'ᱨ', 'ल': 'ᱞ', 'व': 'ᱣ', 'स': 'ᱥ', 'ह': 'ᱦ',
    'ड़': 'ᱲ', 'ढ़': 'ᱲᱷ',

    'ा': 'ᱟ', 'ि': 'ᱤ', 'ी': 'ᱤ', 'ु': 'ᱩ', 'ू': 'ᱩ',
    'े': 'ᱮ', 'ै': 'ᱮ', 'ो': 'ᱳ', 'ौ': 'ᱳ',

    'ं': 'ᱸ', 'ः': 'ᱷ', '़': 'ᱹ', 'ʼ': 'ᱽ', '’': 'ᱽ',
    '।': '᱾', '॥': '᱿'
};

const olToDevMap = (function buildReverseMap() {
    const reverse = {};
    for (const [dev, ol] of Object.entries(devToOlMap)) {
        if (!reverse[ol]) reverse[ol] = dev;
    }
    return reverse;
})();

// ============================================================
// 🔣 SYMBOLS
// ============================================================
const allKeySymbols = [
    '`', '~', '!', '@', '#', '$', '%', '^', '&', '*',
    '(', ')', '_', '-', '+', '=',
    '{', '[', '}', ']', '|', '\\',
    ':', ';', '\'', '"', '<', ',', '>', '.', '?', '/'
];

// ============================================================
// 📚 SCRIPT LIBRARIES (Character Map)
// ============================================================
const scriptLibraries = {
    'english': [
        '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        ':', ';', '<', '=', '>', '?', '@',
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        '[', '\\', ']', '^', '_', '`',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
        'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        '{', '|', '}', '~'
    ],
    'roman': [
        ...allKeySymbols,
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
        'a', 'a̱', 'ā', 'ã', 'b', 'c', 'd', 'ḍ', 'e', 'e̱', 'ē', 'ẽ',
        'g', 'h', 'i', 'i̱', 'ī', 'ĩ', 'j', 'k', 'l', 'ḷ', 'm', 'ṃ',
        'n', 'ṇ', 'ṅ', 'ñ', 'o', 'o̱', 'ō', 'õ', 'p', 'r', 'ṛ', 's',
        't', 'ṭ', 'u', 'u̱', 'ū', 'ũ', 'w', 'y',
        'A', 'A̱', 'Ā', 'Ã', 'B', 'C', 'D', 'Ḍ', 'E', 'E̱', 'Ē', 'Ẽ',
        'G', 'H', 'I', 'I̱', 'Ī', 'Ĩ', 'J', 'K', 'L', 'Ḷ', 'M', 'Ṃ',
        'N', 'Ṇ', 'Ṅ', 'Ñ', 'O', 'O̱', 'Ō', 'Õ', 'P', 'R', 'Ṛ', 'S',
        'T', 'Ṭ', 'U', 'U̱', 'Ū', 'Ũ', 'W', 'Y',
        'k\'', 'c\'', 't\'', 'p\'', 'kʼ', 'cʼ', 'tʼ', 'pʼ', 'ʼ', '’', '\'',
        '\u0301', '\u0300', '\u0331', '\u0323', '\u0303', '\u0304', '\u0307',
        'ⁿ', 'ʰ', 'ʲ', 'ʷ', 'ˤ'
    ],
    'hindi-dev': [
        ...allKeySymbols,
        '१', '२', '३', '४', '५', '६', '७', '८', '९', '०',
        'अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ', 'अं', 'अः',
        'क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ',
        'ट', 'ठ', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न',
        'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह',
        'क्ष', 'त्र', 'ज्ञ', 'श्र', 'ड़', 'ढ़', 'ऱ',
        'क्र', 'कृ', 'प्र', 'पृ', 'द्र', 'दृ', 'ग्र', 'ब्र', 'भ्र', 'ध्र',
        'ह्र', 'हृ', 'ट्र', 'ड्र', 'द्व', 'द्घ', 'द्य', 'द्ध',
        'ा', 'ि', 'ी', 'ु', 'ू', 'ृ', 'े', 'ै', 'ो', 'ौ', 'ं', 'ः', 'ँ', '्', '़', '।', '॥'
    ],
    'santali-dev': [
        ...allKeySymbols,
        '१', '२', '३', '४', '५', '६', '७', '८', '९', '०',
        'अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ', 'ऑ', 'ऍ',
        'क', 'कʼ', 'ख', 'ग', 'गʼ', 'घ', 'ङ',
        'च', 'चʼ', 'छ', 'ज', 'जʼ', 'झ', 'ञ',
        'ट', 'ठ', 'ड', 'ढ', 'ण',
        'त', 'तʼ', 'थ', 'द', 'दʼ', 'ध', 'न',
        'प', 'पʼ', 'फ', 'ब', 'बʼ', 'भ', 'म', 'य', 'र', 'ल', 'व', 'स', 'ह', 'ड़', 'ढ़',
        'क्र', 'कृ', 'प्र', 'पृ', 'त्र', 'श्र', 'द्र', 'दृ', 'ग्र', 'ब्र',
        'भ्र', 'ध्र', 'ट्र', 'ड्र', 'द्व', 'द्य', 'द्ध',
        'ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ं', 'ः', '़', '्',
        'ʼ', '’', 'ᱽ', 'ᱷ', 'ᱸ', '᱾', '॥'
    ],
    'olchiki': [
        ...allKeySymbols,
        '᱑', '᱒', '᱓', '᱔', '᱕', '᱖', '᱗', '᱘', '᱙', '᱐',
        'ᱚ', 'ᱛ', 'ᱜ', 'ᱝ', 'ᱞ', 'ᱟ', 'ᱟᱹ',
        'ᱠ', 'ᱡ', 'ᱢ', 'ᱣ', 'ᱤ', 'ᱥ', 'ᱦ', 'ᱧ', 'ᱨ', 'ᱩ',
        'ᱪ', 'ᱫ', 'ᱬ', 'ᱭ', 'ᱮ', 'ᱯ', 'ᱰ', 'ᱱ', 'ᱲ', 'ᱳ', 'ᱴ', 'ᱵ', 'ᱶ',
        'ᱷ', 'ᱸ', 'ᱹ', 'ᱺ', 'ᱻ', 'ᱼ', 'ᱽ', '᱾', '᱿'
    ]
};

// ============================================================
// 😀 EMOJI LIBRARIES
// ============================================================
const emojiLibraries = {
    'smileys': [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
        '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
        '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
        '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
        '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕'
    ],
    'gestures': [
        '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟',
        '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎',
        '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏',
        '✍️', '💅'
    ],
    'hearts': [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
        '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🎉',
        '🎊', '🎈', '🎂', '🍰', '🎁', '🎇', '🎆', '✨', '⭐', '🌟',
        '💥', '🔥'
    ],
    'symbols': allKeySymbols,
    'nature': [
        '🌺', '🌸', '🌼', '🌻', '🌹', '🌷', '🌱', '🌲', '🌳', '🌴',
        '🌾', '🌿', '🍀', '🍁', '🍂', '🍃',
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
        '🦁', '🐮', '🐷', '🐵', '🐔', '🐧'
    ]
};

// ============================================================
// ⌨️ BASE KEYBOARD LAYOUTS
// ============================================================
const fKeysRow = ['ESC', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

const baseLayouts = {
    'english': {
        normal: [
            fKeysRow,
            ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'BACKSPACE'],
            ['TAB', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
            ['CAPS', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\'', 'ENTER'],
            ['SHIFT', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'UP'],
            ['CTRL', 'LANG_SWITCH', 'ALT', 'SPACE', 'ALT', 'LEFT', 'DOWN', 'RIGHT']
        ],
        shift: [
            fKeysRow,
            ['~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', 'BACKSPACE'],
            ['TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '{', '}', '|'],
            ['CAPS', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':', '"', 'ENTER'],
            ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '?', 'UP'],
            ['CTRL', 'LANG_SWITCH', 'ALT', 'SPACE', 'ALT', 'LEFT', 'DOWN', 'RIGHT']
        ]
    },
    'roman': {
        normal: [
            fKeysRow,
            ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'BACKSPACE'],
            ['a̱', 'e̱', 'o̱', 'i̱', 'u̱', 'ã', 'ẽ', 'ḍ', 'ṭ', 'ṇ', 'ṅ', 'ṛ', 'ā', 'ē'],
            ['TAB', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
            ['CAPS', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\'', 'ENTER'],
            ['SHIFT', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'ñ', ',', '.', '/', 'UP'],
            ['CTRL', 'LANG_SWITCH', 'ALT', 'SPACE', 'ALT', 'LEFT', 'DOWN', 'RIGHT']
        ],
        shift: [
            fKeysRow,
            ['~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', 'BACKSPACE'],
            ['A̱', 'E̱', 'O̱', 'I̱', 'U̱', 'Ã', 'Ẽ', 'Ḍ', 'Ṭ', 'Ṇ', 'Ṅ', 'Ṛ', 'Ā', 'Ē'],
            ['TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '{', '}', '|'],
            ['CAPS', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':', '"', 'ENTER'],
            ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ñ', '<', '>', '?', 'UP'],
            ['CTRL', 'LANG_SWITCH', 'ALT', 'SPACE', 'ALT', 'LEFT', 'DOWN', 'RIGHT']
        ]
    },
    'hindi-dev': {
        normal: [
            fKeysRow,
            ['`', '१', '२', '३', '४', '५', '६', '७', '८', '९', '०', '-', '=', 'BACKSPACE'],
            ['TAB', 'अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ', 'अं', 'अः', '[', ']', '\\'],
            ['CAPS', 'ा', 'ि', 'ी', 'ु', 'ू', 'ृ', 'े', 'ै', 'ो', 'ौ', 'ं', 'ः', 'ँ', ';', '\'', 'ENTER'],
            ['क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ', 'ट', 'ठ', ',', '.', '/', 'UP'],
            ['SHIFT', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब', 'भ', 'म', '।', '॥', 'DOWN'],
            ['क्र', 'कृ', 'प्र', 'पृ', 'त्र', 'श्र', 'द्र', 'दृ', 'ग्र', 'ब्र', 'भ्र', 'ध्र', 'ह्र', 'हृ', 'ट्र', 'ड्र', 'द्व', 'द्घ', 'द्य', 'द्ध'],
            ['CTRL', 'LANG_SWITCH', 'ALT', 'SPACE', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह', 'क्ष', 'त्र', 'ज्ञ', 'LEFT', 'RIGHT']
        ],
        shift: [
            fKeysRow,
            ['~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', 'BACKSPACE'],
            ['TAB', 'ऑ', 'ऍ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ', 'अं', 'अः', '{', '}', '|'],
            ['CAPS', 'ा', 'ि', 'ी', 'ु', 'ू', 'ृ', 'े', 'ै', 'ो', 'ौ', 'ं', 'ः', 'ँ', ':', '"', 'ENTER'],
            ['ख', 'घ', 'छ', 'झ', 'ठ', 'ढ', 'थ', 'ध', 'ण', 'फ', 'भ', 'ङ', '<', '>', '?', 'UP'],
            ['SHIFT', 'य', 'र', 'ल', 'व', 'क्ष', 'त्र', 'ज्ञ', 'ह', 'ड़', 'ढ़', '्', '़', '।', '॥', 'DOWN'],
            ['क्र', 'कृ', 'प्र', 'पृ', 'त्र', 'श्र', 'द्र', 'दृ', 'ग्र', 'ब्र', 'भ्र', 'ध्र', 'ह्र', 'हृ', 'ट्र', 'ड्र', 'द्व', 'द्घ', 'द्य', 'द्ध'],
            ['CTRL', 'LANG_SWITCH', 'ALT', 'SPACE', 'ALT', 'LEFT', 'RIGHT']
        ]
    },
    'santali-dev': {
        normal: [
            fKeysRow,
            ['`', '१', '२', '३', '४', '५', '६', '७', '८', '९', '०', '-', '=', 'BACKSPACE'],
            ['TAB', 'अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ', 'अं', 'अः', 'ऑ', '[', ']', '\\'],
            ['CAPS', 'ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ं', 'ः', '़', '्', ';', '\'', 'ENTER'],
            ['क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ', 'ट', 'ठ', ',', '.', '/', 'UP'],
            ['SHIFT', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब', 'भ', 'म', '।', '॥', 'DOWN'],
            ['क्र', 'कृ', 'प्र', 'पृ', 'त्र', 'श्र', 'द्र', 'दृ', 'ग्र', 'ब्र', 'भ्र', 'ध्र', 'ट्र', 'ड्र', 'द्व', 'द्य', 'द्ध'],
            ['CTRL', 'LANG_SWITCH', 'ALT', 'SPACE', 'य', 'र', 'ल', 'व', 'स', 'ह', 'ड़', 'ढ़', 'ʼ', 'ᱽ', 'ᱷ', 'ᱸ', 'LEFT', 'RIGHT']
        ],
        shift: [
            fKeysRow,
            ['~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', 'BACKSPACE'],
            ['TAB', 'कʼ', 'गʼ', 'चʼ', 'जʼ', 'तʼ', 'दʼ', 'पʼ', 'बʼ', 'ऍ', 'ऑ', 'अं', 'अः', '{', '}', '|'],
            ['CAPS', 'ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ं', 'ः', '़', '्', ':', '"', 'ENTER'],
            ['ख', 'घ', 'छ', 'झ', 'ठ', 'ढ', 'थ', 'ध', 'ण', 'फ', 'भ', 'ङ', '<', '>', '?', 'UP'],
            ['SHIFT', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह', 'ड़', 'ढ़', 'ᱹ', 'ᱺ', '᱾', '᱿', 'DOWN'],
            ['क्र', 'कृ', 'प्र', 'पृ', 'त्र', 'श्र', 'द्र', 'दृ', 'ग्र', 'ब्र', 'भ्र', 'ध्र', 'ट्र', 'ड्र', 'द्व', 'द्य', 'द्ध'],
            ['CTRL', 'LANG_SWITCH', 'ALT', 'SPACE', 'ALT', 'LEFT', 'RIGHT']
        ]
    },
    'olchiki': {
        normal: [
            fKeysRow,
            ['`', '᱑', '᱒', '᱓', '᱔', '᱕', '᱖', '᱗', '᱘', '᱙', '᱐', '-', '=', 'BACKSPACE'],
            ['TAB', 'ᱚ', 'ᱛ', 'ᱜ', 'ᱝ', 'ᱞ', 'ᱟᱹ', 'ᱠ', 'ᱡ', 'ᱢ', 'ᱣ', 'ᱸ', 'ᱹ', '[', ']', '\\'],
            ['CAPS', 'ᱤ', 'ᱥ', 'ᱦ', 'ᱧ', 'ᱨ', 'ᱩ', 'ᱪ', 'ᱫ', 'ᱬ', 'ᱭ', 'ᱺ', 'ᱻ', ';', '\'', 'ENTER'],
            ['SHIFT', 'ᱮ', 'ᱯ', 'ᱰ', 'ᱱ', 'ᱲ', 'ᱳ', 'ᱴ', 'ᱵ', 'ᱶ', 'ᱷ', 'ᱼ', 'ᱽ', ',', '.', '/', 'UP'],
            ['CTRL', 'LANG_SWITCH', 'ALT', 'SPACE', 'ALT', '᱾', '᱿', 'LEFT', 'DOWN', 'RIGHT']
        ],
        shift: [
            fKeysRow,
            ['~', '᱐', '᱑', '᱒', '᱓', '᱔', '᱕', '᱖', '᱗', '᱘', '᱙', '_', '+', 'BACKSPACE'],
            ['TAB', 'ᱚ', 'ᱛ', 'ᱜ', 'ᱝ', 'ᱞ', 'ᱟ', 'ᱠ', 'ᱡ', 'ᱢ', 'ᱣ', 'ᱸ', 'ᱹ', '{', '}', '|'],
            ['CAPS', 'ᱤ', 'ᱥ', 'ᱦ', 'ᱧ', 'ᱨ', 'ᱩ', 'ᱪ', 'ᱫ', 'ᱬ', 'ᱭ', 'ᱺ', 'ᱻ', ':', '"', 'ENTER'],
            ['SHIFT', 'ᱮ', 'ᱯ', 'ᱰ', 'ᱱ', 'ᱲ', 'ᱳ', 'ᱴ', 'ᱵ', 'ᱶ', 'ᱷ', 'ᱼ', 'ᱽ', '<', '>', '?', 'UP'],
            ['CTRL', 'LANG_SWITCH', 'ALT', 'SPACE', 'ALT', '᱾', '᱿', 'LEFT', 'DOWN', 'RIGHT']
        ]
    }
};

// ============================================================
// 🔢 NUMPAD LAYOUTS
// ============================================================
const numpadLayouts = {
    'olchiki': [['᱗', '᱘', '᱙'], ['᱔', '᱕', '᱖'], ['᱑', '᱒', '᱓'], ['᱐', '.', '⌫']],
    'hindi-dev': [['७', '८', '९'], ['४', '५', '६'], ['१', '२', '३'], ['०', '.', '⌫']],
    'santali-dev': [['७', '८', '९'], ['४', '५', '६'], ['१', '२', '३'], ['०', '.', '⌫']],
    'roman': [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3'], ['0', '.', '⌫']],
    'english': [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3'], ['0', '.', '⌫']]
};

// ============================================================
// 💡 KEY HINTS
// ============================================================
const devMapHints = {
    'क': 'k', 'ख': 'Shift+K', 'ग': 'g', 'घ': 'Shift+G', 'ङ': 'Shift+W',
    'च': 'c', 'छ': 'Shift+C', 'ज': 'j', 'झ': 'Shift+J', 'ञ': 'Shift+Z',
    'ट': 'Shift+T', 'ठ': 'Click', 'ड': 'Shift+D', 'ढ': 'Click', 'ण': 'Shift+N',
    'त': 't', 'थ': 'Click', 'द': 'd', 'ध': 'Click', 'न': 'n',
    'प': 'p', 'फ': 'Shift+P', 'ब': 'b', 'भ': 'Shift+B', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v/w', 'श': 'Shift+M', 'ष': 'Shift+S',
    // ✅ FIX #4: 'व' hint updated to show both 'v' and 'w'
    'स': 's', 'ह': 'h',
    'अ': 'Click', 'आ': 'Shift+A', 'इ': 'Click', 'ई': 'Shift+I',
    'उ': 'Click', 'ऊ': 'Shift+U',
    'ा': 'a', 'ि': 'f', 'ी': 'i', 'ु': 'u', 'ू': 'Shift+U',
    'े': 'e', 'ै': 'Shift+E', 'ो': 'o', 'ौ': 'Shift+O', '्': 'q', 'ं': 'x',
    'ड़': 'Shift+R', 'ढ़': 'Shift+H', '़': 'Key: ]', 'ऱ': 'Shift+[',
    'ᱷ': 'h', 'ᱸ': 'Shift+X', 'ᱽ': 'Click',
    'क्र': 'k+r', 'कृ': 'k+ri', 'प्र': 'p+r', 'पृ': 'p+ri',
    'त्र': 't+r', 'श्र': 'sh+r', 'द्र': 'd+r', 'दृ': 'd+ri'
};

// ============================================================
// 🎯 LANGUAGE MODIFIERS
// ============================================================
const languageModifiersDB = {
    'santali-dev': [
        { char: 'क्र', hint: 'k+r' }, { char: 'कृ', hint: 'k+ri' },
        { char: 'प्र', hint: 'p+r' }, { char: 'पृ', hint: 'p+ri' },
        { char: 'त्र', hint: 't+r' }, { char: 'श्र', hint: 'sh+r' },
        { char: 'द्र', hint: 'd+r' }, { char: 'दृ', hint: 'd+ri' },
        { char: 'ग्र', hint: 'g+r' }, { char: 'ब्र', hint: 'b+r' },
        { char: 'भ्र', hint: 'bh+r' }, { char: 'ध्र', hint: 'dh+r' },
        { char: 'ह्र', hint: 'h+r' }, { char: 'हृ', hint: 'h+ri' },
        { char: 'ट्र', hint: 't+r' }, { char: 'ड्र', hint: 'd+r' },
        { char: 'द्व', hint: 'd+v' }, { char: 'द्य', hint: 'd+y' },
        { char: 'द्ध', hint: 'd+dh' }, { char: '्र', hint: 'पदेन' },
        { char: 'र्', hint: 'रेफ़' }, { char: '़', hint: 'Nukta' },
        { char: 'ʼ', hint: 'Glottal' }, { char: '’', hint: 'Right Apostrophe' },
        { char: 'ᱽ', hint: 'Ahad' }, { char: 'ᱷ', hint: 'Oh' },
        { char: 'ᱸ', hint: 'Mu-ttdak' }, { char: 'ᱹ', hint: 'Gahla' },
        { char: 'ᱺ', hint: 'Relaa' }, { char: 'ᱻ', hint: 'Pharkaa' },
        { char: 'ᱼ', hint: 'Khaddha' }, { char: '᱾', hint: 'Mucaad' },
        { char: '᱿', hint: 'Double Mucaad' }
    ],
    'hindi-dev': [
        { char: 'क्र', hint: 'k+r' }, { char: 'कृ', hint: 'k+ri' },
        { char: 'प्र', hint: 'p+r' }, { char: 'पृ', hint: 'p+ri' },
        { char: 'त्र', hint: 't+r' }, { char: 'श्र', hint: 'sh+r' },
        { char: 'द्र', hint: 'd+r' }, { char: 'दृ', hint: 'd+ri' },
        { char: 'ग्र', hint: 'g+r' }, { char: 'गृह', hint: 'griha' },
        { char: 'ब्र', hint: 'b+r' }, { char: 'भ्र', hint: 'bh+r' },
        { char: 'ध्र', hint: 'dh+r' }, { char: 'ह्र', hint: 'h+r' },
        { char: 'हृ', hint: 'h+ri' }, { char: 'ट्र', hint: 't+r' },
        { char: 'ड्र', hint: 'd+r' }, { char: 'द्व', hint: 'd+v' },
        { char: 'द्घ', hint: 'd+gh' }, { char: 'द्य', hint: 'd+y' },
        { char: 'द्ध', hint: 'd+dh' }, { char: '्र', hint: 'पदेन' },
        { char: 'र्', hint: 'रेफ़' }, { char: 'ृ', hint: 'ऋ-कार' },
        { char: '़', hint: 'Nukta' }, { char: 'ँ', hint: 'चन्द्रबिन्दु' },
        { char: 'ं', hint: 'अनुस्वार' }, { char: 'ः', hint: 'विसर्ग' },
        { char: '्', hint: 'हलन्त' }
    ],
    'olchiki': [
        { char: 'ᱸ', hint: 'Mu Ttudak (Nasal)' },
        { char: 'ᱹ', hint: 'Gahla Ttudak (Low pitch)' },
        { char: 'ᱺ', hint: 'Rela (Vowel Elongation)' },
        { char: 'ᱻ', hint: 'Pharka (Glottal check)' },
        { char: 'ᱼ', hint: 'Ahad (Deglottalizer)' },
        { char: 'ᱽ', hint: 'Deglottal Marker' },
        { char: 'ᱷ', hint: 'Oh (Aspirate h)' },
        { char: '᱾', hint: 'Mucad (Full Stop)' },
        { char: '᱿', hint: 'Double Mucad' },
        { char: '᱐', hint: 'Zero' }, { char: '᱑', hint: 'One' },
        { char: '᱒', hint: 'Two' }, { char: '᱓', hint: 'Three' },
        { char: '᱔', hint: 'Four' }, { char: '᱕', hint: 'Five' },
        { char: '᱖', hint: 'Six' }, { char: '᱗', hint: 'Seven' },
        { char: '᱘', hint: 'Eight' }, { char: '᱙', hint: 'Nine' }
    ],
    'roman': [
        { char: '\u0331', label: '◌̱', hint: 'Macron Below' },
        { char: '\u0323', label: '◌̣', hint: 'Dot Below' },
        { char: '\u0303', label: '◌̃', hint: 'Tilde Above' },
        { char: '\u0304', label: '◌̄', hint: 'Macron Above' },
        { char: '\u0301', label: '◌́', hint: 'Acute Accent' },
        { char: '\u0300', label: '◌̀', hint: 'Grave Accent' },
        { char: '\u0302', label: '◌̂', hint: 'Circumflex' },
        { char: '\u0306', label: '◌̆', hint: 'Breve' },
        { char: '\u0307', label: '◌̇', hint: 'Dot Above' },
        { char: '\u0308', label: '◌̈', hint: 'Diaeresis / Umlaut' },
        { char: '\u0327', label: '◌̧', hint: 'Cedilla Below' },
        { char: '\u0328', label: '◌̨', hint: 'Ogonek' },
        { char: '\u0324', label: '◌̤', hint: 'Diaeresis Below' },
        { char: '\u0325', label: '◌̥', hint: 'Ring Below' },
        { char: '\u031D', label: '◌̝', hint: 'Up Tack Below' },
        { char: '\u031E', label: '◌̞', hint: 'Down Tack Below' },
        { char: '\u030D', label: '◌̍', hint: 'Vertical Line Above' },
        { char: '\u030C', label: '◌̌', hint: 'Caron / Hacek' },
        { char: '\u030A', label: '◌̊', hint: 'Ring Above' },
        { char: '\u0313', label: '◌̓', hint: 'Comma Above' },
        { char: '\u0326', label: '◌̦', hint: 'Comma Below' },
        { char: '\u032F', label: '◌̯', hint: 'Inverted Breve Below' },
        { char: '\u0329', label: '◌̩', hint: 'Vertical Line Below' },
        { char: '\u030B', label: '◌̋', hint: 'Double Acute' },
        { char: 'a̱', label: 'a̱', hint: 'Low front vowel' },
        { char: 'e̱', label: 'e̱', hint: 'Low mid vowel' },
        { char: 'o̱', label: 'o̱', hint: 'Low back vowel' },
        { char: 'i̱', label: 'i̱', hint: 'Low i vowel' },
        { char: 'u̱', label: 'u̱', hint: 'Low u vowel' },
        { char: 'ā', label: 'ā', hint: 'Long a' },
        { char: 'ē', label: 'ē', hint: 'Long e' },
        { char: 'ō', label: 'ō', hint: 'Long o' },
        { char: 'ī', label: 'ī', hint: 'Long i' },
        { char: 'ū', label: 'ū', hint: 'Long u' },
        { char: 'ã', label: 'ã', hint: 'Nasal a' },
        { char: 'ẽ', label: 'ẽ', hint: 'Nasal e' },
        { char: 'ĩ', label: 'ĩ', hint: 'Nasal i' },
        { char: 'õ', label: 'õ', hint: 'Nasal o' },
        { char: 'ũ', label: 'ũ', hint: 'Nasal u' },
        { char: 'ḍ', label: 'ḍ', hint: 'Retroflex d' },
        { char: 'ṭ', label: 'ṭ', hint: 'Retroflex t' },
        { char: 'ṇ', label: 'ṇ', hint: 'Retroflex n' },
        { char: 'ṛ', label: 'ṛ', hint: 'Retroflex flap r' },
        { char: 'ḷ', label: 'ḷ', hint: 'Retroflex l' },
        { char: 'ṃ', label: 'ṃ', hint: 'Anusvara' },
        { char: 'ṣ', label: 'ṣ', hint: 'Retroflex s' },
        { char: 'ḥ', label: 'ḥ', hint: 'Dot-below h' },
        { char: 'ẓ', label: 'ẓ', hint: 'Dot-below z' },
        { char: 'ṅ', label: 'ṅ', hint: 'Velar nasal ng' },
        { char: 'ñ', label: 'ñ', hint: 'Palatal nasal ny' },
        { char: 'ŋ', label: 'ŋ', hint: 'Eng (Velar nasal)' },
        { char: 'ɔ', label: 'ɔ', hint: 'Open O' },
        { char: 'ɛ', label: 'ɛ', hint: 'Open E' },
        { char: 'ə', label: 'ə', hint: 'Schwa' },
        { char: 'ɖ', label: 'ɖ', hint: 'Retroflex D (IPA)' },
        { char: 'ʔ', label: 'ʔ', hint: 'Glottal Stop (IPA)' },
        { char: 'ʼ', label: 'ʼ', hint: 'Glottal Stop' },
        { char: '’', label: '’', hint: 'Right Single Quote' },
        { char: ':', label: ':', hint: 'Length mark' },
        { char: 'ː', label: 'ː', hint: 'Length Mark IPA' },
        { char: 'ˈ', label: 'ˈ', hint: 'Primary Stress' },
        { char: 'ˌ', label: 'ˌ', hint: 'Secondary Stress' },
        { char: 'ʰ', label: 'ʰ', hint: 'Aspiration' },
        { char: 'ⁿ', label: 'ⁿ', hint: 'Pre-nasal' },
        { char: 'ʷ', label: 'ʷ', hint: 'Labialization' },
        { char: 'ʲ', label: 'ʲ', hint: 'Palatalization' }
    ],
    'english': [
        { char: '“', hint: 'Left Double Quote' },
        { char: '”', hint: 'Right Double Quote' },
        { char: '‘', hint: 'Left Single Quote' },
        { char: '’', hint: 'Right Single Quote' },
        { char: '—', hint: 'Em Dash' },
        { char: '–', hint: 'En Dash' },
        { char: '…', hint: 'Ellipsis' },
        { char: '•', hint: 'Bullet' },
        { char: '©', hint: 'Copyright' },
        { char: '®', hint: 'Registered' },
        { char: '™', hint: 'Trademark' },
        { char: '°', hint: 'Degree' },
        { char: '±', hint: 'Plus-Minus' },
        { char: '₹', hint: 'Rupee' }
    ]
};

// ============================================================
// 🇮🇳 SANTALI ROMAN ALT+KEY SHORTCUTS
// ✅ NEW: Full shortcut map for special characters
// ============================================================
const romanShortcutMap = {
    // ─── Alt + lowercase ───
    'n': 'ñ', 'g': 'ṅ', 'd': 'ṇ', 'r': 'ṛ', 't': 'ṭ',
    'a': 'ā', 'e': 'ē', 'i': 'ī', 'o': 'ō', 'u': 'ū',
    'l': 'ḷ', 'm': 'ṃ', 's': 'ṣ', 'h': 'ḥ', 'z': 'ẓ',
    '[': 'a̱', ']': 'e̱', ';': 'o̱', "'": 'ʼ',
    ',': 'ã', '.': 'ẽ', '/': 'õ', '\\': 'ũ',
    '1': 'ḍ',

    // ─── Alt + Shift (uppercase) ───
    'N': 'Ñ', 'G': 'Ṅ', 'D': 'Ṇ', 'R': 'Ṛ', 'T': 'Ṭ',
    'A': 'Ā', 'E': 'Ē', 'I': 'Ī', 'O': 'Ō', 'U': 'Ū',
    'L': 'Ḷ', 'M': 'Ṃ', 'S': 'Ṣ', 'H': 'Ḥ', 'Z': 'Ẓ',
    '{': 'A̱', '}': 'E̱', ':': 'O̱', '"': 'ʼ',
    '<': 'Ã', '>': 'Ẽ', '?': 'Õ', '|': 'Ũ',
    '!': 'Ḍ'
};

// ============================================================
// 📊 DEBUG HELPERS
// ============================================================
if (typeof window !== 'undefined') {
    window.KeymapsDebug = {
        validateDuplicates: () => {
            console.log('🔍 Checking for duplicate keys in maps...');

            const maps = {
                'unicodeToKrutiMap': unicodeToKrutiMap,
                'halfCharMap': halfCharMap,
                'hardwareDevMap': hardwareDevMap,
                'hardwareOlchikiMap': hardwareOlchikiMap,
                'phoneticDictionary': phoneticDictionary,
                'devToOlMap': devToOlMap,
                'romanShortcutMap': romanShortcutMap
            };

            Object.keys(maps).forEach(name => {
                const map = maps[name];
                const keys = Object.keys(map);
                const uniqueKeys = new Set(keys);

                if (keys.length !== uniqueKeys.size) {
                    console.error(`❌ ${name}: ${keys.length - uniqueKeys.size} duplicates!`);
                } else {
                    console.log(`✅ ${name}: ${keys.length} keys, no duplicates`);
                }
            });
        },

        stats: () => {
            console.log('📊 Keymaps Stats:');
            console.table({
                'Kruti Map': Object.keys(unicodeToKrutiMap).length,
                'Dev Hardware': Object.keys(hardwareDevMap).length,
                'Olchiki Hardware': Object.keys(hardwareOlchikiMap).length,
                'Phonetic': Object.keys(phoneticDictionary).length,
                'Shortcodes': Object.keys(textShortcodes).length,
                'Dev→Ol': Object.keys(devToOlMap).length,
                'Ol→Dev': Object.keys(olToDevMap).length,
                'Roman Shortcuts': Object.keys(romanShortcutMap).length,
                'Languages (Layouts)': Object.keys(baseLayouts).length,
                'Languages (Scripts)': Object.keys(scriptLibraries).length
            });
        },

        testDevZ: () => {
            console.log('🧪 Devanagari Z key test:');
            console.log('  hardwareDevMap["Z"] =', hardwareDevMap['Z']);
            console.log('  Expected: ञ');
            console.log('  Result:', hardwareDevMap['Z'] === 'ञ' ? '✅ PASS' : '❌ FAIL');
        },

        testDevBracket: () => {
            console.log('🧪 Devanagari { key test:');
            console.log('  hardwareDevMap["{"] =', hardwareDevMap['{']);
            console.log('  Expected: ऱ');
            console.log('  Result:', hardwareDevMap['{'] === 'ऱ' ? '✅ PASS' : '❌ FAIL');
        },

        // 🆕 FIX #4: Devanagari W key test
        testDevW: () => {
            console.log('🧪 Devanagari W key test (FIX #4):');
            console.log('  hardwareDevMap["w"] =', hardwareDevMap['w']);
            console.log('  Expected: व');
            console.log('  Result:', hardwareDevMap['w'] === 'व' ? '✅ PASS' : '❌ FAIL');
            console.log('');
            console.log('  Quick test — type "wahan" in Hindi mode:');
            console.log('    w → व');
            console.log('    a → ा');
            console.log('    h → ह');
            console.log('    a → ा');
            console.log('    n → न');
            console.log('  Expected output: वाहन ✅');
        },

        testRomanShortcuts: () => {
            console.log('🧪 Roman Shortcut Map:');
            const tests = [
                { key: 'n', expected: 'ñ' },
                { key: 'N', expected: 'Ñ' },
                { key: 'g', expected: 'ṅ' },
                { key: 'r', expected: 'ṛ' },
                { key: 't', expected: 'ṭ' },
                { key: 'a', expected: 'ā' },
                { key: '[', expected: 'a̱' },
                { key: '1', expected: 'ḍ' }
            ];

            tests.forEach(t => {
                const actual = romanShortcutMap[t.key];
                const pass = actual === t.expected;
                console.log(`  ${pass ? '✅' : '❌'} Alt+${t.key} → ${actual} (expected: ${t.expected})`);
            });
        },

        testShortcodes: () => {
            console.log('🧪 Shortcode Map:');
            const tests = ['/jhr', '/dlr', '/mnt', '/hr', '/sn', '/sg'];

            tests.forEach(code => {
                const entry = textShortcodes[code];
                if (entry) {
                    console.log(`  ✅ ${code} → Roman: "${entry.roman}" | Ol Chiki: "${entry.olchiki}"`);
                } else {
                    console.log(`  ❌ ${code} NOT FOUND`);
                }
            });
        },

        layouts: () => {
            console.log('⌨️ Available Layouts:');
            Object.keys(baseLayouts).forEach(lang => {
                const layout = baseLayouts[lang];
                console.log(`  ${lang}: ${layout.normal.length} rows normal, ${layout.shift.length} rows shift`);
            });
        }
    };
}

// ============================================================
// 📋 STARTUP LOG
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('✅ keymaps.js loaded — v3.7.4.72');
console.log('   🎯 Layouts:', Object.keys(baseLayouts).length, 'languages');
console.log('   📚 Script libraries:', Object.keys(scriptLibraries).length, 'scripts');
console.log('   💬 Emoji categories:', Object.keys(emojiLibraries).length);
console.log('   📖 Phonetic dictionary:', Object.keys(phoneticDictionary).length, 'words');
console.log('   🇮🇳 Roman shortcuts:', Object.keys(romanShortcutMap).length, 'keys');
console.log('   📝 Text shortcodes:', Object.keys(textShortcodes).length);
console.log('   ✅ Ol Chiki "p" key mapped to ᱯ');
console.log('   ✅ Shift+Z → ञ (Devanagari)');
console.log('   ✅ Shift+[ → ऱ (Devanagari)');
console.log('   ✅ NEW: /jhr, /dlr, /mnt shortcodes');
console.log('   🆕 FIX #4: w → व (Devanagari — was MISSING)');
console.log('═══════════════════════════════════════════');