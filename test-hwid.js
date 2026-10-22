// test-hwid.js — Run with: node test-hwid.js
'use strict';

// Copy sanitizeHwid from main.js (paste same function)
function sanitizeHwid(hwid) {
    if (!hwid || typeof hwid !== 'string') return '';
    const trimmed = String(hwid).trim().toUpperCase();
    if (!trimmed) return '';
    
    const dvcMatch = trimmed.match(/^DVC[\s-]*([A-F0-9]{4})[\s-]*([A-F0-9]{4})$/);
    if (dvcMatch) return `DVC-${dvcMatch[1]}-${dvcMatch[2]}`;
    
    const hexOnlyMatch = trimmed.match(/^([A-F0-9]{8})$/);
    if (hexOnlyMatch) {
        const hex = hexOnlyMatch[1];
        return `DVC-${hex.substring(0, 4)}-${hex.substring(4, 8)}`;
    }
    
    const pairMatch = trimmed.match(/^([A-F0-9]{4})[\s-]+([A-F0-9]{4})$/);
    if (pairMatch) return `DVC-${pairMatch[1]}-${pairMatch[2]}`;
    
    return '';
}

const tests = [
    // ✅ Should accept
    { input: 'DVC-1234-5678',         expected: 'DVC-1234-5678',    desc: 'canonical' },
    { input: 'dvc-1234-5678',         expected: 'DVC-1234-5678',    desc: 'lowercase' },
    { input: 'Dvc-1234-5678',         expected: 'DVC-1234-5678',    desc: 'mixed case' },
    { input: '  DVC-1234-5678  ',     expected: 'DVC-1234-5678',    desc: 'whitespace trim' },
    { input: 'DVC 1234 5678',         expected: 'DVC-1234-5678',    desc: 'spaces' },
    { input: 'DVC-1234 5678',         expected: 'DVC-1234-5678',    desc: 'mixed sep' },
    { input: 'DVC12345678',           expected: 'DVC-1234-5678',    desc: 'no sep' },
    { input: '12345678',              expected: 'DVC-1234-5678',    desc: '8 hex only' },
    { input: '1234-5678',             expected: 'DVC-1234-5678',    desc: 'XXXX-XXXX' },
    { input: '1234 5678',             expected: 'DVC-1234-5678',    desc: 'XXXX XXXX' },
    { input: 'ABCD-EF01',             expected: 'DVC-ABCD-EF01',    desc: 'ABCD-EF01' },
    { input: 'DEAD-BEEF',             expected: 'DVC-DEAD-BEEF',    desc: 'DEAD-BEEF' },
    
    // ❌ Should reject
    { input: 'DVC-1234-5678-EXTRA',   expected: '',                desc: 'extra chars' },
    { input: 'DVC-1234-5678F',        expected: '',                desc: 'trailing F' },
    { input: 'DVC-1234-56789',        expected: '',                desc: 'too long hex' },
    { input: 'GARBAGE-1234-5678',     expected: '',                desc: 'garbage prefix' },
    { input: 'DVC-123-456',           expected: '',                desc: 'too short' },
    { input: 'DVC-1234-567',          expected: '',                desc: 'too short' },
    { input: 'DVC-1234-5678!',        expected: '',                desc: 'special char' },
    { input: 'DVC_1234_5678',         expected: '',                desc: 'underscore' },
    { input: '1234567',               expected: '',                desc: '7 hex' },
    { input: '123456789',             expected: '',                desc: '9 hex' },
    { input: 'GARBAGE',               expected: '',                desc: 'garbage' },
    { input: '',                      expected: '',                desc: 'empty' },
    { input: '   ',                   expected: '',                desc: 'spaces' },
    { input: null,                    expected: '',                desc: 'null' },
    { input: undefined,               expected: '',                desc: 'undefined' },
    { input: 12345,                   expected: '',                desc: 'number' }
];

let pass = 0;
let fail = 0;

console.log('═══════════════════════════════════════════');
console.log('🧪 SANITIZE HWID TEST (FIX #11)');
console.log('═══════════════════════════════════════════');
console.log('');

tests.forEach((t, i) => {
    const actual = sanitizeHwid(t.input);
    const match = actual === t.expected;
    
    if (match) pass++;
    else fail++;
    
    const icon = match ? '✅' : '❌';
    const inputShow = t.input === null ? 'null' : 
                     t.input === undefined ? 'undefined' :
                     JSON.stringify(t.input);
    
    console.log(`${icon} ${t.desc}: ${inputShow}`);
    console.log(`   Expected: ${JSON.stringify(t.expected)}`);
    console.log(`   Actual:   ${JSON.stringify(actual)}`);
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log(`📊 Result: ${pass}/${tests.length} passed`);
console.log(fail === 0 ? '🎉 ALL PASS' : `⚠️ ${fail} FAILED`);
console.log('═══════════════════════════════════════════');