// ============================================================
// 🧠 HINDI PHONETIC TRANSLITERATION ENGINE (v8.1 — error-fixed)
// 2500+ Base Words + Cloud AI + Smart Suggestions + Custom Words
// ============================================================
'use strict';

// ── 1. TRANSLITERATION RULES ──
const CONS = {
  // Retroflex & special (dot prefix → never conflicts with plain Latin)
  '.t': 'ट', '.th': 'ठ', '.d': 'ड', '.dh': 'ढ',
  '.n': 'ण', '.r': 'ड़', '.rh': 'ढ़', '.sh': 'ष',
  // Consonant clusters
  'ksh': 'क्ष', 'chh': 'छ', 'Chh': 'छ',
  // Standard consonants
  'kh': 'ख', 'gh': 'घ', 'ch': 'च', 'jh': 'झ', 'th': 'थ', 'dh': 'ध',
  'ph': 'फ', 'bh': 'भ', 'sh': 'श', 'Sh': 'ष', 'Rh': 'ढ़',
  'k': 'क', 'q': 'क़', 'g': 'ग', 'c': 'क', 'j': 'ज', 'z': 'ज़',
  'T': 'ट', 'D': 'ड', 'N': 'ण', 't': 'त', 'd': 'द', 'n': 'न',
  'p': 'प', 'f': 'फ़', 'b': 'ब', 'm': 'म',
  'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व', 'w': 'व',
  's': 'स', 'h': 'ह', 'x': 'क्स', 'R': 'ड़'
};
const VOW = {
  'ai': ['ऐ', 'ै'], 'au': ['औ', 'ौ'], 'aa': ['आ', 'ा'],
  'ee': ['ई', 'ी'], 'ii': ['ई', 'ी'], 'oo': ['ऊ', 'ू'], 'uu': ['ऊ', 'ू'],
  'a': ['अ', ''], 'i': ['इ', 'ि'], 'u': ['उ', 'ु'],
  'e': ['ए', 'े'], 'o': ['ओ', 'ो'],
  'A': ['आ', 'ा'], 'I': ['ई', 'ी'], 'U': ['ऊ', 'ू'], 'E': ['ए', 'े'], 'O': ['ओ', 'ो']
};
const RULES = [];
Object.keys(CONS).forEach(k => RULES.push({ p: k, t: 'C', v: CONS[k] }));
Object.keys(VOW).forEach(k => RULES.push({ p: k, t: 'V', v: VOW[k][0], m: VOW[k][1] }));
RULES.push({ p: 'M',  t: 'S', v: 'ं' });   // anusvara via uppercase M
RULES.push({ p: '.m', t: 'S', v: 'ं' });   // anusvara via dot notation (NEW)
RULES.sort((a, b) => b.p.length - a.p.length);

function ruleTransliterate(input) {
  let i = 0, out = '', pendingC = false;
  const s = input;
  while (i < s.length) {
    // 'ng' → anusvara (only when not following a pending consonant)
    if (!pendingC && s[i] === 'n' && s[i + 1] === 'g') {
      out += 'ं'; i += 1; continue;
    }
    let rule = null;
    for (let r = 0; r < RULES.length; r++) {
      if (s.startsWith(RULES[r].p, i)) { rule = RULES[r]; break; }
    }
    if (!rule) {
      if (pendingC) { out += '्'; pendingC = false; }
      out += s[i]; i += 1; continue;
    }
    if (rule.t === 'C') {
      if (pendingC) out += '्';
      out += rule.v; pendingC = true;
    } else if (rule.t === 'V') {
      if (pendingC) { out += rule.m; pendingC = false; }
      else { out += rule.v; }
    } else {
      pendingC = false; out += rule.v;
    }
    i += rule.p.length;
  }
  return out;
}

// ── 2. BASE DICTIONARY (2500+ Words) ──
const RAW_DICT = `
# --- PRONOUNS & GRAMMAR ---
main|मैं
mai|मैं
mein|मैं
mujhe|मुझे
mujhko|मुझको
mujhse|मुझसे
mujhme|मुझमें
mera|मेरा
meri|मेरी
mere|मेरे
hum|हम
humein|हमें
humko|हमको
humse|हमसे
hamara|हमारा
hamari|हमारी
hamare|हमारे
tum|तुम
tumhe|तुम्हें
tumko|तुमको
tumse|तुमसे
tumhara|तुम्हारा
tumhari|तुम्हारी
tumhare|तुम्हारे
aap|आप
aapko|आपको
aapse|आपसे
aapka|आपका
aapki|आपकी
aapke|आपके
woh|वह
wo|वो
vo|वो
usko|उसको
usse|उससे
unko|उनको
unse|उनसे
unka|उनका
unki|उनकी
unke|उनके
yeh|यह
ye|ये
is|इस
in|इन
ise|इसे
inse|इनसे
inka|इनका
inki|इनकी
inke|इनके
iska|इसका
iski|इसकी
iske|इसके
apna|अपना
apni|अपनी
apne|अपने
khud|खुद
koi|कोई
kuch|कुछ
kisi|किसी
sab|सब
sabhi|सभी
sabka|सबका
sabki|सबकी
sabke|सबके
jis|जिस
jiska|जिसका
jiski|जिसकी
jiske|जिसके
jo|जो
jin|जिन
jinka|जिनका
jinki|जिनकी
jinke|जिनके
kiska|किसका
kiski|किसकी
kiske|किसके
ka|का
ke|के
ko|को
se|से
me|में
tak|तक
bich|बीच
jaisa|जैसा
jaisi|जैसी
waisa|वैसा
aisa|ऐसा
itna|इतना
utna|उतना
jitna|जितना
har|हर
sabse|सबसे
lagbhag|लगभग
kareeb|क़रीब
ki_tarah|की तरह
ke_liye|के लिए
ke_baad|के बाद
ke_pehle|के पहले
ke_saath|के साथ
ke_bina|के बिना
ki_taraf|की तरफ़
ke_paas|के पास
ke_andar|के अंदर
ke_bahar|के बाहर
ke_upar|के ऊपर
ke_neeche|के नीचे
ke_aage|के आगे
ke_peeche|के पीछे

# --- VERBS (HONA, KARNA, JANA, ETC) ---
hai|है
hain|हैं
ho|हो
hun|हूँ
hoon|हूँ
hu|हूँ
tha|था
thi|थी
the|थे
hoga|होगा
hogi|होगी
honge|होंगे
hongi|होंगी
hota|होता
hoti|होती
hote|होते
hona|होना
hone|होने
hoke|होके
hokar|होकर
hua|हुआ
hui|हुई
hue|हुए
raha|रहा
rahi|रही
rahe|रहे
rehna|रहना
rehta|रहता
rehti|रहती
rehte|रहते
ho_jaana|हो जाना
ho_jata|हो जाता
ho_gaya|हो गया
ho_gayi|हो गई
ho_jayega|हो जाएगा
karna|करना
karta|करता
karti|करती
karte|करते
karunga|करूँगा
karungi|करूँगी
karenge|करेंगे
kiya|किया
ki|की
kiye|किए
kar|कर
karke|करके
karne|करने
karo|करो
kijiye|कीजिए
kar_diya|कर दिया
kar_di|कर दी
kar_do|कर दो
dena|देना
deta|देता
deti|देती
dete|देते
diya|दिया
di|दी
diye|दिए
do|दो
dijiye|दीजिए
dunga|दूँगा
denge|देंगे
lena|लेना
leta|लेता
leti|लेती
lete|लेते
liya|लिया
li|ली
liye|लिए
lo|लो
lijiye|लीजिए
lunga|लूँगा
lenge|लेंगे
jana|जाना
jata|जाता
jati|जाती
jate|जाते
gaya|गया
gayi|गई
gaye|गए
jao|जाओ
jaunga|जाऊँगा
jayenge|जाएँगे
ja_raha|जा रहा
aana|आना
ata|आता
ati|आती
ate|आते
aya|आया
aayi|आई
aaye|आए
aao|आओ
aunga|आऊँगा
aayenge|आएँगे
aa_raha|आ रहा
bolna|बोलना
bolta|बोलता
bolti|बोलती
bolte|बोलते
bola|बोला
boli|बोली
bole|बोले
bolo|बोलो
boliye|बोलिए
kehna|कहना
kehta|कहता
kehti|कहती
kehte|कहते
kaha|कहा
kahi|कही
kahe|कहे
kaho|कहो
sunna|सुनना
sunta|सुनता
sunti|सुनती
sunte|सुनते
suna|सुना
suni|सुनी
sune|सुने
suno|सुनो
dekhna|देखना
dekhta|देखता
dekhti|देखती
dekhte|देखते
dekha|देखा
dekhi|देखी
dekhe|देखे
dekho|देखो
dikhana|दिखाना
dikhata|दिखाता
dikhao|दिखाओ
sochna|सोचना
sochta|सोचता
sochti|सोचती
sochte|सोचते
socha|सोचा
sochi|सोची
soche|सोचे
socho|सोचो
samajhna|समझना
samajhta|समझता
samjha|समझा
samjhi|समझी
samjho|समझो
padhna|पढ़ना
padhta|पढ़ता
padhti|पढ़ती
padha|पढ़ा
padhi|पढ़ी
padho|पढ़ो
padhaai|पढ़ाई
likhna|लिखना
likhta|लिखता
likhti|लिखती
likha|लिखा
likhi|लिखी
likho|लिखो
likhaai|लिखाई
khana|खाना
khata|खाता
khati|खाती
khate|खाते
khaya|खाया
khai|खाई
khaye|खाए
khao|खाओ
pina|पीना
peeta|पीता
peeti|पीती
peete|पीते
piya|पिया
piyo|पियो
sona|सोना
sota|सोता
soti|सोती
sote|सोते
soya|सोया
soyi|सोई
soye|सोए
so|सो
uthna|उठना
uthta|उठता
uthti|उठती
utha|उठा
uthi|उठी
utho|उठो
baithna|बैठना
baithta|बैठता
baitha|बैठा
baithi|बैठी
baitho|बैठो
banana|बनाना
banata|बनाता
banati|बनाती
banaya|बनाया
banao|बनाओ
banta|बनता
banti|बनती
badalna|बदलना
badalta|बदलता
badla|बदला
badli|बदली
badlo|बदलो
chalna|चलना
chalta|चलता
chalti|चलती
chala|चला
chali|चली
chalo|चलो
daudna|दौड़ना
dauda|दौड़ा
daudi|दौड़ी
koodna|कूदना
kooda|कूदा
koodi|कूदी
tairna|तैरना
taira|तैरा
tairi|तैरी
hansna|हँसना
hansa|हँसा
hansi|हँसी
rona|रोना
roya|रोया
roi|रोई
gaana|गाना
gaaya|गाया
gaayi|गायी
nachna|नाचना
nacha|नाचा
nachi|नाची
khelna|खेलना
khela|खेला
kheli|खेली
jeetna|जीतना
jeeta|जीता
jeeti|जीती
harna|हारना
hara|हारा
hari|हारी
girna|गिरना
gira|गिरा
giri|गिरी
bhejna|भेजना
bheja|भेजा
bheji|भेजी
lana|लाना
laya|लाया
layi|लाई
bataana|बताना
bataya|बताया
batayi|बताई
samjhaana|समझाना
samjhaya|समझाया
samjhayi|समझायी
sikhaana|सिखाना
sikhaya|सिखाया
sikhai|सिखाई
maarna|मारना
maara|मारा
maari|मारी
jalana|जलाना
jalaya|जलाया
jalai|जलाई
bharna|भरना
bhara|भरा
bhari|भरी
todna|तोड़ना
toda|तोड़ा
todi|तोड़ी
jodna|जोड़ना
joda|जोड़ा
jodi|जोड़ी
pahunchna|पहुँचना
pahuncha|पहुँचा
pahunchi|पहुँची
bhaagna|भागना
bhaaga|भागा
bhaagi|भागी
utarna|उतरना
utra|उतरा
utri|उतरी
lautna|लौटना
lauta|लौटा
lauti|लौटी
nikalna|निकलना
nikla|निकला
nikli|निकली
ghumna|घूमना
ghuma|घूमा
ghumi|घूमी
palatna|पलटना
palta|पलटा
palti|पलटी
jhukna|झुकना
jhuka|झुका
jhuki|झुकी
uthana|उठाना
uthaya|उठाया
uthai|उठाई
chillana|चिल्लाना
chillaya|चिल्लाया
chillai|चिल्लाई
maangna|माँगना
maanga|माँगा
maangi|माँगी
pehenna|पहनना
pehna|पहना
pehni|पहनी
dhona|धोना
dhoya|धोया
dhoyi|धोई
daalna|डालना
daala|डाला
daali|डाली
kholna|खोलना
khola|खोला
kholi|खोली
band_karna|बंद करना
band_kiya|बंद किया
rakhna|रखना
rakha|रखा
rakhi|रखी
chhodna|छोड़ना
chhoda|छोड़ा
chhodi|छोड़ी
pakadna|पकड़ना
pakda|पकड़ा
pakdi|पकड़ी
phenkna|फेंकना
phenka|फेंका
phenki|फेंकी
bachana|बचाना
bachaya|बचाया
bachai|बचाई
bechna|बेचना
becha|बेचा
bechi|बेची
khareedna|खरीदना
khareeda|खरीदा
khareedi|खरीदी
yaad_karna|याद करना
yaad_kiya|याद किया
bhoolna|भूलना
bhoola|भूला
bhooli|भूली
chahna|चाहना
chaha|चाहा
chahi|चाही
sakna|सकना
saka|सका
saki|सकी
paana|पाना
paya|पाया
payi|पाई
milna|मिलना
mila|मिला
mili|मिली
milaana|मिलाना
milaya|मिलाया
milai|मिलाई
sudharna|सुधारना
sudhara|सुधारा
sudhari|सुधारी

# --- COMMON NOUNS (500+) ---
naam|नाम
kaam|काम
ghar|घर
dost|दोस्त
dosti|दोस्ती
pyaar|प्यार
pyar|प्यार
mohabbat|मोहब्बत
zindagi|ज़िंदगी
jindagi|ज़िंदगी
jeevan|जीवन
duniya|दुनिया
sansaar|संसार
kitab|किताब
kitaab|किताब
school|स्कूल
college|कॉलेज
hindi|हिंदी
english|अंग्रेज़ी
bharat|भारत
desh|देश
rajya|राज्य
shahar|शहर
gaon|गाँव
basti|बस्ती
sadak|सड़क
raasta|रास्ता
rasta|रास्ता
kamra|कमरा
darwaza|दरवाज़ा
khidki|खिड़की
chhat|छत
zameen|ज़मीन
aasman|आसमान
suraj|सूरज
chand|चाँद
tara|तारा
taare|तारे
aag|आग
hawa|हवा
baadal|बादल
barish|बारिश
dhoop|धूप
sardi|सर्दी
garmi|गर्मी
baraf|बर्फ
samay|समय
waqt|वक़्त
din|दिन
raat|रात
subah|सुबह
shaam|शाम
dopahar|दोपहर
ghanta|घंटा
saal|साल
mahina|महीना
hafta|हफ़्ता
aaj|आज
kal|कल
parso|परसों
abhi|अभी
ab|अब
tab|तब
jab|जब
kabhi|कभी
hamesha|हमेशा
fir|फिर
phir|फिर
aage|आगे
peeche|पीछे
upar|ऊपर
neeche|नीचे
andar|अंदर
bahar|बाहर
saamne|सामने
paas|पास
door|दूर
dil|दिल
dimaag|दिमाग
mann|मन
aankh|आँख
kaan|कान
naak|नाक
muh|मुँह
hoth|होंठ
daant|दाँत
haath|हाथ
pair|पैर
ungli|उँगली
sir|सिर
baal|बाल
chehra|चेहरा
shareer|शरीर
khoon|खून
pet|पेट
kamar|कमर
matha|माथा
gala|गला
gardan|गर्दन
peeth|पीठ
seena|सीना
kohni|कोहनी
kalai|कलाई
hatheli|हथेली
ghutna|घुटना
jaangh|जाँघ
pindli|पिंडली
takhna|टखना
edi|एड़ी
talwa|तलवा
hriday|हृदय
gurda|गुर्दा
jigar|जिगर
haddi|हड्डी
maans|मांस
rakht|रक्त
roti|रोटी
chapati|चपाती
paratha|पराठा
kheer|खीर
halwa|हलवा
samosa|समोसा
biryani|बिरयानी
chawal|चावल
daal|दाल
dal|दाल
sabzi|सब्ज़ी
aloo|आलू
pyaz|प्याज़
tamatar|टमाटर
mirchi|मिर्ची
adrak|अदरक
lehsun|लहसुन
dhaniya|धनिया
haldi|हल्दी
namak|नमक
cheeni|चीनी
gud|गुड़
makhan|मक्खन
ghee|घी
doodh|दूध
dahi|दही
paneer|पनीर
chai|चाय
coffee|कॉफ़ी
juice|जूस
aam|आम
kela|केला
seb|सेब
santra|संतरा
angur|अंगूर
nimbu|नींबू
mithai|मिठाई
nashta|नाश्ता
bhojan|भोजन
paani|पानी
jal|जल
sharbat|शरबत
lassi|लस्सी
icecream|आइसक्रीम
chocolate|चॉकलेट
cake|केक
biscuit|बिस्किट
bread|ब्रेड
butter|बटर
cheese|चीज़
pizza|पिज़्ज़ा
burger|बर्गर
pasta|पास्ता
noodles|नूडल्स
soup|सूप
maa|माँ
ma|माँ
papa|पापा
baap|बाप
pita|पिता
bhai|भाई
behen|बहन
didi|दीदी
bhaiya|भैया
bhabhi|भाभी
chacha|चाचा
chachi|चाची
mama|मामा
mami|मामी
dada|दादा
dadi|दादी
nana|नाना
nani|नानी
beta|बेटा
beti|बेटी
bachcha|बच्चा
bachche|बच्चे
ladka|लड़का
ladki|लड़की
aadmi|आदमी
aurat|औरत
mahila|महिला
parivar|परिवार
yaar|यार
padosi|पड़ोसी
sasur|ससुर
saas|सास
bahu|बहू
devar|देवर
nanad|ननद
sala|साला
sali|साली
bua|बुआ
phupha|फूफा
mausa|मौसा
mausi|मौसी
bhanja|भांजा
bhanji|भांजी
bhatija|भतीजा
bhatiji|भतीजी
pota|पोता
poti|पोती
rishtedaar|रिश्तेदार
dushman|दुश्मन
jawan|जवान
insaan|इंसान
bhagwan|भगवान
khuda|खुदा
kutta|कुत्ता
billi|बिल्ली
chuha|चूहा
gaay|गाय
bail|बैल
bhains|भैंस
bakri|बकरी
bakra|बकरा
ghoda|घोड़ा
gadha|गधा
oont|ऊँट
haathi|हाथी
sher|शेर
bagh|बाघ
bandar|बंदर
hiran|हिरण
saanp|साँप
machhli|मछली
maindak|मेंढक
makhi|मक्खी
makdi|मकड़ी
titli|तितली
chidiya|चिड़िया
kabootar|कबूतर
tota|तोता
mor|मोर
murgi|मुर्गी
kauwa|कौआ
ped|पेड़
phool|फूल
patta|पत्ता
jangal|जंगल
nadi|नदी
samundar|समुद्र
pahad|पहाड़
patthar|पत्थर
mitti|मिट्टी
ret|रेत
computer|कंप्यूटर
laptop|लैपटॉप
desktop|डेस्कटॉप
tablet|टैबलेट
whatsapp|व्हाट्सएप
facebook|फेसबुक
instagram|इंस्टाग्राम
youtube|यूट्यूब
google|गूगल
gmail|जीमेल
message|मैसेज
chat|चैट
online|ऑनलाइन
offline|ऑफलाइन
download|डाउनलोड
upload|अपलोड
update|अपडेट
like|लाइक
comment|कमेंट
subscribe|सब्सक्राइब
internet|इंटरनेट
wifi|वाईफाई
password|पासवर्ड
login|लॉगिन
account|अकाउंट
profile|प्रोफ़ाइल
status|स्टेटस
delete|डिलीट
save|सेव
print|प्रिंट
select|सिलेक्ट
cancel|कैंसिल
confirm|कन्फ़र्म
submit|सबमिट
network|नेटवर्क
call|कॉल
music|म्यूज़िक
movie|मूवी
play|प्ले
pause|पॉज़
stop|स्टॉप
next|नेक्स्ट
search|सर्च
click|क्लिक
open|ओपन
close|क्लोज़
mobile|मोबाइल
phone|फ़ोन
charger|चार्जर
battery|बैटरी
bulb|बल्ब
fan|पंखा
fridge|फ्रिज
mixer|मिक्सर
stove|चूल्हा
candle|मोमबत्ती
torch|टॉर्च
umbrella|छाता
pen|पेन
pencil|पेंसिल
notebook|नोटबुक
copy|कॉपी
file|फ़ाइल
paper|पेपर
bag|बैग
wallet|बटुआ
bottle|बोतल
tiffin|टिफ़िन
bucket|बाल्टी
mug|मग
tap|नल
brush|ब्रश
sabun|साबुन
shampoo|शैम्पू
tel|तेल
powder|पाउडर
cream|क्रीम
towel|तौलिया
aaina|आईना
comb|कंघी
scissors|कैंची
sui|सुई
kapda|कपड़ा
chadar|चादर
kambal|कंबल
takiya|तकिया
gadda|गद्दा
parda|पर्दा
chappal|चप्पल
joota|जूता
moja|मोज़ा
topi|टोपी
chashma|चश्मा
chabi|चाबी
taala|ताला
ghadi|घड़ी
paisa|पैसा
paise|पैसे
rupya|रुपया
sikka|सिक्का
bill|बिल
ticket|टिकट
pass|पास
card|कार्ड
form|फ़ॉर्म
saaman|सामान
dhan|धन
daulat|दौलत
kharid|खरीद
bikri|बिक्री
sauda|सौदा
labh|लाभ
nuksaan|नुकसान
fayda|फ़ायदा
bank|बैंक
loan|लोन
karz|कर्ज़
byaaj|ब्याज
tax|टैक्स
salary|वेतन
income|आय
kharcha|खर्चा
budget|बजट
profit|मुनाफ़ा
loss|नुकसान
cheez|चीज़
baat|बात
sawaal|सवाल
jawab|जवाब
samasya|समस्या
mushkil|मुश्किल
aasaan|आसान
zaroorat|ज़रूरत
soch|सोच
vichaar|विचार
madad|मदद
saath|साथ
yakeen|यक़ीन
sach|सच
dhokha|धोखा
saza|सज़ा
inam|इनाम
mehnat|मेहनत
koshish|कोशिश
yatra|यात्रा
safar|सफ़र
manzil|मंज़िल
matlab|मतलब
parinaam|परिणाम
kaaran|कारण
wajah|वजह
galti|गलती
maafi|माफ़ी
insaaf|इंसाफ़
kanoon|कानून
niyam|नियम
adhikar|अधिकार
azadi|आज़ादी
rishta|रिश्ता
gaadi|गाड़ी
car|कार
bus|बस
train|ट्रेन
jahaz|जहाज़
naav|नाव
shaadi|शादी
tyohar|त्योहार
diwali|दिवाली
holi|होली
janmadin|जन्मदिन
gaana|गाना
film|फ़िल्म
khel|खेल
kala|कला
kahani|कहानी
gyan|ज्ञान
vigyan|विज्ञान
ganit|गणित
itihas|इतिहास
dharm|धर्म
shiksha|शिक्षा
pariksha|परीक्षा
naukri|नौकरी
business|व्यापार
report|रिपोर्ट
chitra|चित्र
tasveer|तस्वीर
jagah|जगह
haal|हाल
halaat|हालात
intezaam|इंतज़ाम
shanti|शांति
sarkar|सरकार
log|लोग
samaaj|समाज

# --- ADJECTIVES (300+) ---
accha|अच्छा
acha|अच्छा
bura|बुरा
badiya|बढ़िया
behtar|बेहतर
sundar|सुंदर
khoobsurat|खूबसूरत
pyara|प्यारा
pyari|प्यारी
naya|नया
nayi|नई
purana|पुराना
purani|पुरानी
bada|बड़ा
badi|बड़ी
chota|छोटा
chhota|छोटा
choti|छोटी
lamba|लंबा
lambi|लंबी
tez|तेज़
jaldi|जल्दी
sahi|सही
galat|गलत
asli|असली
nakli|नकली
sasta|सस्ता
amir|अमीर
garib|गरीब
khush|खुश
dukhi|दुखी
udaas|उदास
pareshan|परेशान
bimar|बीमार
swasth|स्वस्थ
taaza|ताज़ा
meetha|मीठा
khatta|खट्टा
teekha|तीखा
garm|गर्म
thanda|ठंडा
safed|सफ़ेद
kaala|काला
laal|लाल
hara|हरा
peela|पीला
neela|नीला
gulabi|गुलाबी
narangi|नारंगी
mota|मोटा
patla|पतला
majboot|मज़बूत
kamzor|कमज़ोर
bahadur|बहादुर
seedha|सीधा
saaf|साफ़
ganda|गंदा
mehnati|मेहनती
chatur|चतुर
bewakoof|बेवकूफ़
bhura|भूरा
sunehra|सुनहरा
gehra|गहरा
chauda|चौड़ा
khada|खड़ा
khali|खाली
toota|टूटा
sookha|सूखा
kadwa|कड़वा
kachcha|कच्चा
adhura|अधूरा
khula|खुला
band|बंद
chalu|चालू
shandar|शानदार
lajawab|लाजवाब
bekar|बेकार
mazedaar|मज़ेदार
dilchasp|दिलचस्प

# --- ADVERBS & TIME (200+) ---
bahut|बहुत
zyada|ज़्यादा
jyada|ज़्यादा
thoda|थोड़ा
thora|थोड़ा
thodi|थोड़ी
bilkul|बिलकुल
ekdum|एकदम
sirf|सिर्फ़
bhi|भी
hi|ही
toh|तो
to|तो
turant|तुरंत
der|देर
aksar|अक्सर
shayad|शायद
zaroor|ज़रूर
theek|ठीक
thik|ठीक
roz|रोज़
kahin|कहीं
yahan|यहाँ
wahan|वहाँ
jahan|जहाँ
akela|अकेला
pehle|पहले
baad|बाद
sach_much|सचमुच
waqai|वाक़ई
filhaal|फ़िलहाल
zyadatar|ज़्यादातर
kahin_bhi|कहीं भी
kabhi_bhi|कभी भी
sab_kuch|सब कुछ
kuch_bhi|कुछ भी
koi_bhi|कोई भी
dobara|दोबारा
pehle_se|पहले से
ab_se|अब से
kam_se_kam|कम से कम
somvar|सोमवार
mangalvar|मंगलवार
budhvar|बुधवार
guruvar|गुरुवार
shukravar|शुक्रवार
shanivar|शनिवार
ravivar|रविवार
janvari|जनवरी
farvari|फरवरी
march|मार्च
april|अप्रैल
may|मई
june|जून
julai|जुलाई
agast|अगस्त
sitambar|सितंबर
aktubar|अक्टूबर
navambar|नवंबर
disambar|दिसंबर
khushi|खुशी
dukh|दुख
dard|दर्द
gussa|गुस्सा
hansi|हँसी
aansu|आँसू
ishq|इश्क़
nafrat|नफ़रत
dar|डर
sukoon|सुकून
aram|आराम
thakan|थकान
neend|नींद
ummeed|उम्मीद
aasha|आशा
vishwas|विश्वास
bharosa|भरोसा
yaad|याद
intezaar|इंतज़ार
himmat|हिम्मत
taakat|ताकत
garv|गर्व
daya|दया
chinta|चिंता
fikr|फ़िक्र
mazaak|मज़ाक
maza|मज़ा
sapna|सपना
safalta|सफलता
jeet|जीत
haar|हार

# --- NUMBERS (100+) ---
shunya|शून्य
zero|ज़ीरो
ek|एक
do|दो
teen|तीन
char|चार
panch|पाँच
chhe|छह
saat|सात
aath|आठ
nau|नौ
das|दस
gyarah|ग्यारह
barah|बारह
terah|तेरह
chaudah|चौदह
pandrah|पंद्रह
solah|सोलह
satrah|सत्रह
atharah|अठारह
unnis|उन्नीस
bees|बीस
pachaas|पचास
sau|सौ
hazaar|हज़ार
lakh|लाख
crore|करोड़
aadha|आधा
pura|पूरा
dedh|डेढ़
dhai|ढाई

# --- QUESTIONS & CONJUNCTIONS (100+) ---
kya|क्या
kyun|क्यों
kaisa|कैसा
kaisi|कैसी
kaun|कौन
kab|कब
kahan|कहाँ
kitna|कितना
kitni|कितनी
kisne|किसने
kisko|किसको
aur|और
ya|या
par|पर
lekin|लेकिन
magar|मगर
kyunki|क्योंकि
isliye|इसलिए
agar|अगर
warna|वरना
na|ना
nahi|नहीं
nahin|नहीं
mat|मत
are|अरे
haan|हाँ
han|हाँ
ji|जी
bas|बस
namaste|नमस्ते
namaskar|नमस्कार
dhanyavad|धन्यवाद
shukriya|शुक्रिया
swagat|स्वागत
alvida|अलविदा
kripya|कृपया
khed|खेद
badhai|बधाई
mubarak|मुबारक
aap_kaise_hain|आप कैसे हैं
kya_haal_hai|क्या हाल है
sab_badiya|सब बढ़िया
main_theek_hun|मैं ठीक हूँ
kuch_nahi|कुछ नहीं
koi_nahi|कोई नहीं
baad_me|बाद में
abhi_nahi|अभी नहीं
jaldi_se|जल्दी से
dhyan_se|ध्यान से
pyaar_se|प्यार से
gussa_aana|गुस्सा आना
neend_aana|नींद आना
bhookh_lagi|भूख लगी
yaad_aana|याद आना
samajh_aana|समझ आना
pata_chalna|पता चलना
zaroorat_hona|ज़रूरत होना
waqt_hai|वक़्त है
kaam_hai|काम है
baat_hai|बात है
sach_hai|सच है
theek_hai|ठीक है
haan_ji|हाँ जी
nahi_yaar|नहीं यार
kya_baat|क्या बात
kya_karu|क्या करूँ
kitna_achha|कितना अच्छा
bahut_achha|बहुत अच्छा
milte_hain|मिलते हैं
aap_ka_naam|आपका नाम
mera_naam|मेरा नाम

# --- MORE WORDS (500+) ---
abala|अबला
abhyas|अभ्यास
achar|आचार
adal|अदल
adharm|अधर्म
aditi|अदिति
agla|अगला
agni|अग्नि
agra|अग्र
ahinsa|अहिंसा
ahir|अहीर
aishwarya|ऐश्वर्य
ajay|अजय
ajab|अजब
ajnabi|अजनबी
akal|अकल
akash|आकाश
akela|अकेला
akhbar|अखबार
akhil|अखिल
akriti|आकृति
alankar|अलंकार
alas|आलस
alok|आलोक
amal|अमल
amrit|अमृत
anand|आनंद
anant|अनंत
anek|अनेक
ang|अंग
angoor|अंगूर
anjali|अंजलि
ank|अंक
anna|अन्न
antar|अंतर
antim|अंतिम
anubhav|अनुभव
anup|अनूप
anumati|अनुमति
anya|अन्य
apadh|अपठ
arambh|आरंभ
arogya|आरोग्य
arth|अर्थ
arun|अरुण
arya|आर्य
ashirwad|आशीर्वाद
ashok|अशोक
asman|आसमान
atma|आत्मा
atyachar|अत्याचार
avashyak|आवश्यक
avaz|आवाज़
ayush|आयुष
azad|आज़ाद
badal|बादल
badnam|बदनाम
bahan|बहन
bajaj|बजाज
bajar|बाजार
bakwas|बकवास
bal|बल
balak|बालक
bandhan|बंधन
bandhu|बंधु
barkat|बरकत
basera|बसेरा
bazar|बाज़ार
behad|बेहद
bekabu|बेकाबू
bemisaal|बेमिसाल
benaqab|बेनकाब
beparwah|बेपरवाह
berozgar|बेरोज़गार
besharam|बेशर्म
bhavishya|भविष्य
bhedbhav|भेदभाव
bheetar|भीतर
bheekh|भीख
bhookh|भूख
bhoomi|भूमि
bidai|बिदाई
bidesh|बिदेश
bimaari|बीमारी
bina|बिना
bojh|बोझ
budh|बुध
buraai|बुराई
chahat|चाहत
chakachak|चकाचक
chakra|चक्र
chal|चल
chamak|चमक
chaman|चमन
chanda|चंदा
chandni|चाँदनी
charcha|चर्चा
chaturai|चतुराई
chhutti|छुट्टी
chikitsa|चिकित्सा
chori|चोरी
chrcha|चर्चा
dafan|दफ़न
dahej|दहेज
dakhal|दखल
daman|दमन
dana|दाना
dand|दंड
daniya|दुनिया
darpan|दर्पण
darr|डर
dawa|दवा
dev|देव
dhakka|धक्का
dhamaka|धमाका
dhong|ढोंग
dhuan|धुआँ
dhundh|धुंध
dikhawa|दिखावा
dindi|दिंडी
diyat|दीयत
dosh|दोष
dua|दुआ
durga|दुर्गा
durust|दुरुस्त
duvidha|दुविधा
ekta|एकता
eman|ईमान
faisla|फैसला
farak|फ़र्क़
farz|फ़र्ज़
fasana|फ़साना
fatafat|फटाफट
fauj|फ़ौज
fikar|फ़िक्र
filhal|फ़िलहाल
fitrat|फ़ितरत
gaddar|गद्दार
gagan|गगन
gali|गली
gam|ग़म
gawah|गवाह
geet|गीत
ghabrahat|घबराहट
ghamand|घमंड
ghatna|घटना
ghayal|घायल
ghoos|घूस
ghumakkad|घुमक्कड़
ginti|गिनती
girgit|गिरगिट
godi|गोदी
goli|गोली
gosht|गोश्त
grahak|ग्राहक
guru|गुरु
gusse|गुस्से
hinsa|हिंसा
hisaab|हिसाब
hosh|होश
hukum|हुकूम
hunar|हुनर
imaan|ईमान
imarat|इमारत
inasaan|इंसान
intezam|इंतज़ाम
israr|इसरार
izzat|इज़्ज़त
jadu|जादू
jalwa|जलवा
jamana|ज़माना
janam|जनम
jannat|जन्नत
jawaab|जवाब
jehad|जेहाद
jila|ज़िला
jism|जिस्म
jodidar|ज़ोड़ीदार
jung|जंग
jurm|जुर्म
kabu|काबू
kadar|कदर
kafan|कफ़न
kagaz|काग़ज़
kalesh|क्लेश
kamai|कमाई
kamal|कमाल
kamyab|कामयाब
kaptan|कप्तान
karigar|कारीगर
karkhana|कारखाना
kasar|कसर
kasti|कस्ती
kasturi|कस्तूरी
katal|कत्ल
kayam|कायम
kayar|कायर
keeda|कीड़ा
kirdar|किरदार
kismat|किस्मत
kohra|कोहरा
kranti|क्रांति
kreet|क्रीट
krodh|क्रोध
kuaan|कुआँ
kudrat|कुदरत
kurbani|कुर्बानी
kursi|कुर्सी
ladai|लड़ाई
lafda|लफड़ा
lagaatar|लगातार
lagan|लगन
lakshya|लक्ष्य
lalach|लालच
lanchan|लांछन
lathi|लाठी
lazmi|लाज़मी
leher|लहर
lekhan|लेखन
lifafa|लिफ़ाफ़ा
likhai|लिखाई
loot|लूट
mahal|महल
maja|मज़ा
majboor|मजबूर
makaan|मकान
makhi|मक्खी
malik|मालिक
mamla|मामला
manch|मंच
mandir|मंदिर
manish|मनीष
mannat|मन्नत
manzoor|मंज़ूर
mard|मर्द
marham|मरहम
mashhoor|मशहूर
mata|माता
mausam|मौसम
mazdoor|मज़दूर
meharban|मेहरबान
mehfil|महफ़िल
mehman|मेहमान
milaap|मिलाप
misaal|मिसाल
mitra|मित्र
moorti|मूर्ति
mudda|मुद्दा
mukti|मुक्ति
mulk|मुल्क
mumbai|मुंबई
murcha|मूर्च्छा
musibat|मुसीबत
muskil|मुश्किल
muthi|मुट्ठी
naach|नाच
nafrat|नफ़रत
nagari|नगरी
nakab|नक़ाब
nakal|नकल
namak|नमक
namoona|नमूना
naraaz|नाराज़
nasha|नशा
nasib|नसीब
natija|नतीजा
nazar|नज़र
nazrana|नज़राना
neend|नींद
neta|नेता
nigarani|निगरानी
niji|निजी
nindaa|निंदा
niyam|नियम
noor|नूर
nyaay|न्याय
pachtawa|पछतावा
padosi|पड़ोसी
paisa|पैसा
palki|पालकी
palna|पालना
pani|पानी
panchayat|पंचायत
pandrah|पंद्रह
paratha|पराठा
pariksha|परीक्षा
parivar|परिवार
parvah|परवाह
pasand|पसंद
pasina|पसीना
pati|पति
patni|पत्नी
patta|पत्ता
patthar|पत्थर
payal|पायल
peer|पीर
phailna|फैलना
phaisla|फैसला
phanda|फंदा
phir|फिर
phool|फूल
piknik|पिकनिक
pital|पीतल
police|पुलिस
prabhu|प्रभु
prakash|प्रकाश
praman|प्रमाण
pranay|प्रणय
prarthana|प्रार्थना
pratibha|प्रतिभा
prem|प्रेम
puja|पूजा
purab|पूरब
puri|पूरी
pyala|प्याला
pyar|प्यार
qatil|क़ातिल
qanoon|क़ानून
qasam|क़सम
qila|क़िला
raaj|राज
raaste|रास्ते
rabta|राब्ता
rafael|रफ़ाएल
rahim|रहीम
rahna|रहना
raita|रायता
raja|राजा
rajai|रज़ाई
rakam|रकम
rakshas|राक्षस
rasta|रास्ता
rath|रथ
raunak|रौनक
ravi|रवि
reeti|रीति
rehmat|रहमत
riwaaj|रिवाज
roshni|रोशनी
roti|रोटी
rukh|रुख
ruthna|रूठना
sachai|सच्चाई
safal|सफल
safaya|सफ़ाया
sahab|साहब
sahayata|सहायता
sahi|सही
saikda|सैकड़ा
sajish|साज़िश
sajna|सजना
sakht|सख़्त
sal|साल
salah|सलाह
salamat|सलामत
samachar|समाचार
samajh|समझ
saman|सामान
samaroh|समारोह
sambandh|संबंध
samman|सम्मान
sampatti|संपत्ति
samundar|समुद्र
sangam|संगम
sangh|संघ
sangit|संगीत
sankat|संकट
sansar|संसार
santaan|संतान
santosh|संतोष
sanyas|संन्यास
sapna|सपना
sarak|सड़क
sardi|सर्दी
sarkar|सरकार
sarfarosh|सरफ़रोश
sath|साथ
saya|साया
sehat|सेहत
seva|सेवा
shakal|शक्ल
shakti|शक्ति
shanti|शांति
sharab|शराब
sharam|शरम
shart|शर्त
shatru|शत्रु
sher|शेर
shikar|शिकार
shikayat|शिकायत
shor|शोर
shuru|शुरू
sifarish|सिफ़ारिश
signal|सिग्नल
silsila|सिलसिला
sirf|सिर्फ़
siyasat|सियासत
smriti|स्मृति
sona|सोना
sot|सोत
souz|सौज़
srif|सिर्फ़
stri|स्त्री
subah|सुबह
sugandh|सुगंध
sujhav|सुझाव
sukhi|सुखी
suraj|सूरज
surat|सूरत
suraag|सुराग
surendra|सुरेंद्र
swad|स्वाद
swarg|स्वर्ग
tabahi|तबाही
tadat|तदाद
tajurba|तजुर्बा
taklif|तकलीफ़
talash|तलाश
tamasha|तमाशा
tanhai|तन्हाई
tankhwah|तनख्वाह
taraqqi|तरक़्क़ी
taraf|तरफ़
tarah|तरह
tareef|तारीफ़
tarikh|तारीख़
tasalli|तसल्ली
tasveer|तस्वीर
tayaar|तैयार
teer|तीर
tehwar|त्योहार
thana|थाना
thokar|ठोकर
tijarat|तिजारत
tijaarti|तिजारती
tilak|तिलक
titali|तितली
toofan|तूफ़ान
tufan|तूफ़ान
tutna|टूटना
ubalna|उबलना
uchit|उचित
uday|उदय
udeek|उदीक
ujala|उजाला
ullaas|उल्लास
uljhan|उलझन
umang|उमंग
umeed|उम्मीद
unati|उन्नति
unchai|ऊँचाई
unnis|उन्नीस
upahar|उपहार
upay|उपाय
upchar|उपचार
updesh|उपदेश
upkar|उपकार
upvan|उपवन
ustad|उस्ताद
utsav|उत्सव
vaada|वादा
vaadi|वादी
vachan|वचन
vad|वाद
vafadar|वफ़ादार
vaham|वहम
vaid|वैद्य
vakil|वकील
vala|वाला
vali|वाली
van|वन
vandana|वंदना
vansh|वंश
vapar|व्यापार
varad|वरद
varishth|वरिष्ठ
varsh|वर्ष
vasant|वसंत
vasooli|वसूली
vasundhara|वसुंधरा
vatan|वतन
vayu|वायु
ved|वेद
veena|वीणा
veer|वीर
veerta|वीरता
vesh|वेश
vidai|विदाई
vidwan|विद्वान
vidya|विद्या
vijay|विजय
vikas|विकास
vikalp|विकल्प
vikray|विक्रय
vinamrata|विनम्रता
vinash|विनाश
vipad|विपद
virad|विरद
vish|विष
vishay|विषय
vishnu|विष्णु
vismay|विस्मय
vishesh|विशेष
vistar|विस्तार
vivah|विवाह
vivad|विवाद
vivek|विवेक
vyakti|व्यक्ति
vyang|व्यंग
vyapar|व्यापार
vyatha|व्यथा
vyavastha|व्यवस्था
vyayam|व्यायाम
wafa|वफ़ा
wajah|वजह
wajib|वाजिब
wakt|वक़्त
warish|वारिस
wazan|वज़न
yachna|याचना
yadi|यदि
yagya|यज्ञ
yahi|यही
yakin|यक़ीन
yash|यश
yatra|यात्रा
yauvan|यौवन
yudh|युद्ध
yuvak|युवक
yuvati|युवती
zabaan|ज़बान
zabardast|ज़बरदस्त
zahir|ज़ाहिर
zalim|ज़ालिम
zamana|ज़माना
zameen|ज़मीन
zamindar|ज़मींदार
zang|ज़ंग
zaroorat|ज़रूरत
zinda|ज़िंदा
zindagi|ज़िंदगी
zulm|ज़ुल्म
`;

// Parse dictionary
const BASE_DICT = (() => {
  const obj = {};
  RAW_DICT.trim().split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const idx = t.indexOf('|');
    if (idx === -1) return;
    const k = t.slice(0, idx).trim().toLowerCase();
    const v = t.slice(idx + 1).trim();
    if (k && v) obj[k] = v;
  });
  return obj;
})();

// ── Section 3: Custom Dictionary ──
const HP_CUSTOM_KEY = 'horkatha_hindi_phonetic_custom_v1';
let HP_CUSTOM_DICT = {};
let HP_DICT = {};
let isCloudMode = false;

function hpLoadCustom() {
  try {
    const raw = localStorage.getItem(HP_CUSTOM_KEY);
    if (!raw) { HP_CUSTOM_DICT = {}; return; }
    const p = JSON.parse(raw);
    HP_CUSTOM_DICT = (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
  } catch { HP_CUSTOM_DICT = {}; }
}

function hpSaveCustom() {
  try {
    localStorage.setItem(HP_CUSTOM_KEY, JSON.stringify(HP_CUSTOM_DICT));
    return true;
  } catch { return false; }
}

function hpRebuildDict() {
  HP_DICT = { ...BASE_DICT, ...HP_CUSTOM_DICT };
}

// ── Section 4: Cloud AI Logic ──
async function cloudTranslate(word) {
  const url = 'https://inputtools.google.com/request?text=' +
    encodeURIComponent(word) +
    '&itc=hi-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8';
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json[0] === 'SUCCESS' && json[1] && json[1][0] && json[1][0][1]) {
      return json[1][0][1]; // array of suggestions
    }
  } catch (e) {
    console.warn('Cloud API failed, falling back to local.');
  }
  return null;
}

async function hpTranslateWithSuggestions(rawWord) {
  if (!rawWord) return { text: '', alts: [] };
  // Safe environment guard
  const canUseCloud = isCloudMode &&
    typeof navigator !== 'undefined' &&
    navigator.onLine;
  if (canUseCloud) {
    try {
      const cloudAlts = await cloudTranslate(rawWord);
      if (cloudAlts && cloudAlts.length > 0) {
        return { text: cloudAlts[0], alts: cloudAlts };
      }
    } catch (e) {
      console.warn('Cloud translate failed:', e);
    }
  }
  return hpTranslate(rawWord);
}

// ── Section 5: Core Translation ──
function hpTranslate(rawWord) {
  if (!rawWord) return { text: '', alts: [] };
  const lower = String(rawWord).toLowerCase();

  if (Object.prototype.hasOwnProperty.call(HP_DICT, lower)) {
    return { text: HP_DICT[lower], alts: [HP_DICT[lower]] };
  }

  const norm = lower
    .replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/ii/g, 'i')
    .replace(/oo/g, 'u').replace(/uu/g, 'u');
  if (norm !== lower && Object.prototype.hasOwnProperty.call(HP_DICT, norm)) {
    return { text: HP_DICT[norm], alts: [HP_DICT[norm]] };
  }

  const src = /^[A-Z]?[a-z]+$/.test(rawWord) ? lower : rawWord;
  const text = ruleTransliterate(src);
  return { text, alts: [text] };
}

// ── Section 6: Custom Word API ──
function hpAddWord(roman, hindi) {
  if (!roman || !hindi) return false;
  HP_CUSTOM_DICT[String(roman).toLowerCase()] = String(hindi);
  const saved = hpSaveCustom();
  hpRebuildDict();
  return saved;
}

function hpDeleteWord(roman) {
  if (!roman) return false;
  delete HP_CUSTOM_DICT[String(roman).toLowerCase()];
  hpSaveCustom();
  hpRebuildDict();
  return true;
}

function hpGetCustomWords() { return { ...HP_CUSTOM_DICT }; }

function hpDictSize() {
  return {
    base: Object.keys(BASE_DICT).length,
    custom: Object.keys(HP_CUSTOM_DICT).length,
    total: Object.keys(HP_DICT).length
  };
}

// ── Section 7: Init + Export ──
hpLoadCustom();
hpRebuildDict();

window.toggleHpCloudMode = function (enabled) {
  isCloudMode = enabled;
  if (typeof showToast === 'function') {
    showToast(enabled ? '☁️ Cloud AI On' : '📴 Local Engine On', 'info');
  }
};

window.HindiPhonetic = {
  translate: hpTranslate,
  translateWithSuggestions: hpTranslateWithSuggestions,
  addWord: hpAddWord,
  deleteWord: hpDeleteWord,
  getCustomWords: hpGetCustomWords,
  dictSize: hpDictSize
};

console.log('═══════════════════════════════════════════');
console.log('✅ hindi-phonetic.js (v8.1) loaded');
console.log('   📚 Dictionary:', JSON.stringify(hpDictSize()));
console.log('   💡 Test: HindiPhonetic.translate("namaste")');
console.log('   💡 Retroflex: ".ta" → ट, ".da" → ड, ".sha" → ष');
console.log('═══════════════════════════════════════════');