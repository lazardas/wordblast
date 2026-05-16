// app/index.js — Word Blast Production
// - Real expo-linking deep links (wordblast://challenge/ID)
// - Auto-join on link tap (no manual code entry)
// - @react-native-clipboard/clipboard (not deprecated)
// - Firebase Realtime DB with onValue subscriptions
// - Full game: drag, scoring, timer, hint, shuffle, multiplayer

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  PanResponder, Dimensions, Platform, Alert, Share,
  ActivityIndicator,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, update, onValue, off } from 'firebase/database';

// ─── Firebase (real credentials) ─────────────────────────────────────────────
const FB_CONFIG = {
  apiKey:            'AIzaSyDwSj-w-TeBqekAChY-Hc0y9qBZYoaH_f4',
  authDomain:        'wordblast-ed8f3.firebaseapp.com',
  databaseURL:       'https://wordblast-ed8f3-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:         'wordblast-ed8f3',
  storageBucket:     'wordblast-ed8f3.firebasestorage.app',
  messagingSenderId: '145797113005',
  appId:             '1:145797113005:web:980dd11d11a47a7a7bd224',
};
const fbApp = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
const db = getDatabase(fbApp);

// ─── Deep link builder ────────────────────────────────────────────────────────
// Produces both the universal link AND the custom scheme fallback.
// The universal link (https://wordblast.app/challenge/ID) is what gets shared —
// if the app is installed the OS intercepts it and opens the app directly.
// If not installed, browser opens — show a simple install page there.
const buildDeepLink = (matchId) =>
  // expo-linking creates the correct link for the current environment:
  // - In Expo Go dev: exp://...
  // - In standalone build: wordblast://challenge/MATCHID
  // We also embed the https:// form for sharing (universal link)
  `https://wordblast.app/challenge/${matchId}`;

const buildSchemeLink = (matchId) =>
  `wordblast://challenge/${matchId}`;

// ─── Firebase helpers ─────────────────────────────────────────────────────────
const genMatchId = () => {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join('');
};

async function fbCreate(matchId, lang, gridSeed, hostName, hostCells) {
  const startEpoch = Date.now() + 8000;
  await set(ref(db, `matches/${matchId}`), {
    matchId, lang, gridSeed, startEpoch,
    status: 'waiting', createdAt: Date.now(),
    p1: { name: hostName, score: 0, wordCount: 0, longest: '', cells: hostCells, ts: Date.now() },
    p2: null,
  });
  return startEpoch;
}

async function fbJoin(matchId, guestName, guestCells) {
  const snap = await get(ref(db, `matches/${matchId}`));
  if (!snap.exists()) throw new Error('MATCH_NOT_FOUND');
  const m = snap.val();
  if (m.status !== 'waiting') throw new Error('MATCH_ALREADY_STARTED');
  const startEpoch = Date.now() + 4000;
  await update(ref(db, `matches/${matchId}`), {
    status: 'playing', startEpoch,
    p2: { name: guestName, score: 0, wordCount: 0, longest: '', cells: guestCells, ts: Date.now() },
  });
  return { lang: m.lang, gridSeed: m.gridSeed, startEpoch };
}

async function fbGet(matchId) {
  const snap = await get(ref(db, `matches/${matchId}`));
  return snap.exists() ? snap.val() : null;
}

function fbSub(matchId, cb) {
  const r = ref(db, `matches/${matchId}`);
  onValue(r, s => { if (s.exists()) cb(s.val()); });
  return () => off(r);
}

async function fbPush(matchId, pid, state) {
  await update(ref(db, `matches/${matchId}/${pid}`), { ...state, ts: Date.now() });
}

async function fbStatus(matchId, status) {
  await update(ref(db, `matches/${matchId}`), { status });
}

// ─── Game constants ───────────────────────────────────────────────────────────
const LANGS = {
  en: {
    name: 'English', flag: '🇬🇧',
    words: new Set('ACE ADD AGE AID AIM AIR ALE ALL AMP AND ANT ANY APE ARC ARE ARK ARM ART ASH ATE AWE AWL AXE AYE BAD BAG BAN BAR BAT BAY BED BEE BET BIG BIN BIT BOB BOG BOW BOX BOY BUD BUG BUN BUS BUT BUY CAB CAP CAR CAT COD COG COP COT COW CUB CUD CUE CUP CUT DAD DAM DAY DEN DEW DIG DIM DIN DIP DOC DOE DOG DON DOT DUE DUG DUN DUO DYE EAR EAT EEL EGG ELK ELM EMU ERA FAD FAN FAR FAT FEW FIG FIN FIR FIT FLY FOE FOG FUR GAG GAP GAS GAY GEL GEM GIN GOD GOT GUM GUN GUT GUY HAT HAY HEM HEN HER HEW HID HIM HIP HIT HOE HOG HOP HOT HUB HUG HUM HUT ICE ICY ILL IMP INK ION IRE JAB JAG JAM JAR JAW JAY JET JIG JOB JOG JOT JOY JUG KEG KIN KIT LAB LAD LAG LAP LAW LAX LAY LED LET LID LIE LIT LOB LOG LOP LOT LOW LUG MAD MAN MAP MAR MAT MAY MEN MEW MIX MOB MOD MOM MOP MOW MUD MUG MUM NAB NAG NAP NET NEW NIL NIP NOD NOR NOT NOW NUN NUT OAF OAK OAR OAT ODD ODE OIL OPT ORB ORC ORE OWE OWL OWN PAD PAL PAN PAR PAT PAW PAY PEA PEG PEN PET PEW PIE PIG PIN PIP PIT POD POP POT PRY PUB PUG PUN PUP PUT RAG RAM RAN RAP RAW RAY RID RIG RIM RIP ROB ROD ROE ROT ROW RUB RUG RUM RUN RUT RYE SAG SAP SAT SAW SAY SEA SET SEW SOB SOD SON SOP SOT SOW SOY SPA SUB SUM SUN SUP TAB TAG TAN TAP TAR TAX TEA TEN TIN TIP TOE TON TOP TOW TOY TUB TUG TUN URN VAN VAT VIA VIE VIM VOW WAD WAR WAX WAY WEB WED WEE WEN WET WIG WIN WIT WOE WOK YAK YAM YAP YAW YEW ZAP ZIT ABLE ACED ACID ACNE ACRE AGED ALOE ALSO AMOK ANEW ANTE ANTS APES APEX ARCH AREA ARIA ARID ARMS ARMY ARTS ATOM ATOP AVID AWAY AXIS AYES BABE BABY BACK BADE BAIL BAIT BAKE BALD BALE BALL BALM BAND BANE BANG BANK BARE BARK BARN BASE BASH BASK BASS BATH BATS BAWL BEAD BEAK BEAM BEAN BEAR BEAT BEEF BEEN BEEP BEER BEET BELL BELT BEND BENT BEST BILE BILK BILL BIND BIRD BITE BLOT BLOW BLUE BLUR BOAR BOAT BODE BODY BOIL BOLD BOLT BOMB BOND BONE BONK BOOK BOOM BOOT BORE BORN BOSS BOUT BOWL BRAG BRAN BRAT BROW BUCK BUFF BULK BULL BUMP BUNK BURN BURY BUSH BUZZ CAFE CAGE CAKE CALF CALL CALM CAME CAMP CANE CAPE CARD CARE CARP CART CASE CASH CASK CAST CAVE CELL CENT CHAP CHAR CHAT CHEF CHEW CHIP CHOP CITE CLAD CLAN CLAP CLAW CLAY CLOD CLOG CLOT CLUE COAL COAT CODE COIL COIN COKE COLA COLD COLT COMA COMB COME CONE CONK COOK COOL COPE CORD CORE CORK CORN COST COZY CRAB CRAM CREW CROP CROW CRUD CUFF CULT CURE CURL CUTE DAMP DAZE DEAD DEAF DEAL DEAN DEAR DEBT DECK DEED DEEP DEER DEFT DEMO DENT DENY DICE DIED DIES DILL DIME DINE DIRE DIRT DISC DISH DISK DIVE DOCK DOME DONG DONE DOOM DOPE DORM DOSE DOTE DOVE DRAB DRAG DRAW DREW DRIP DROP DRUG DRUM DUAL DUNE DUSK DUST DUTY DYED EACH EARL EARN EASE EAST EASY EDGE EMIT ENVY EPIC FACE FACT FADE FAIL FAIR FAKE FALL FAME FANG FARE FARM FAST FATE FAWN FEAR FEAT FEEL FELT FEND FERN FEUD FILL FILM FIND FINE FIRE FIRM FISH FIST FIVE FLAG FLAP FLAT FLAW FLEA FLED FLEE FLEW FLEX FLIP FLIT FLOP FLOW FOAM FOLD FOLK FOND FOOD FOOL FORE FORK FORT FOUL FOUR FOWL FUEL FULL FUME FUND FURY FUSE GALE GALL GANG GAPE GATE GAVE GAZE GEAR GELS GEMS GENT GILD GILL GIRL GIST GLAD GLOB GLOW GLUE GNAW GOAL GOAT GOLD GONE GONG GOOF GORE GORY GOUT GOWN GRAB GRAM GRAY GRIN GRIP GRIT GROG GROW GULL GULP GUST HACK HAIL HAIR HALF HALL HALT HAND HANG HARE HARK HARM HARP HASH HAUL HAVE HAWK HAZE HEAL HEAP HEAR HEAT HEEL HELD HELL HELM HEMP HERB HERD HERO HIDE HIGH HIKE HILL HIND HINT HIVE HOAX HOLD HOLE HOLY HOME HONE HOOD HOOF HOOK HOOP HOOT HOPE HORN HOSE HOST HOUR HUGE HULK HULL HUNG HUNK HUNT HURL HUSH HUSK HYMN ICON IDLE INCH IRIS IRON ISLE ITCH ITEM JACK JADE JAIL JAVA JAWS JELL JEST JETS JIVE JOBS JOGS JOIN JOKE JOLT JOTS JOWL JOYS JUGS JUMP JUST KEEL KEEN KEEP KEGS KELP KEPT KEYS KICK KIDS KILL KING KISS KITE KNOB KNOT KNOW LACE LACK LAID LAIN LAIR LAKE LAME LAMP LAND LANE LARD LARK LASH LASS LAST LATE LAUD LAVA LAWN LAWS LAZY LEAD LEAF LEAK LEAN LEAP LEEK LEER LEND LENT LESS LIFT LIME LIMP LINE LINK LION LISP LIST LOAD LOAF LOAM LOAN LOBE LOCK LODE LOFT LOIN LOOM LOON LOOP LORE LOSE LOSS LOUT LUCK LULL LUMP LUNG LURE LURK LUSH LUST MACE MAID MAIL MAIN MALE MALL MALT MANE MARE MARK MARS MASH MASK MASS MAST MATE MAUL MAZE MEAL MEAN MEAT MEEK MELT MEND MESH MESS MICE MILD MILE MILK MILL MIME MIND MINE MINK MINT MIRE MIST MITE MITT MOAN MOCK MODE MOLE MOLT MOON MOOT MOPE MOSS MOTH MOVE MUCK MULE MUSE MUSH MUSK MUST MUTE NAIL NAME NEAT NECK NEED NEST NEWT NEXT NICK NINE NOOK NOON NORM NOSE NOTE NOUN NUDE NULL NUMB PACE PACK PACT PAIN PAIR PALE PALM PANE PARK PART PASS PATH PAVE PAWN PEAK PEAR PEAT PEEK PEEL PEER PELT PILE PILL PINE PINK PINT PIPE PLAN PLOD PLOT PLOW PLOY PLUG PLUM PLUS POEM POET POKE POLE POND POOL POPE PORE PORK PORT POSE POST POUT PREY PRIM PROP PULL PUMP PUNK PURE PUSH RACE RACK RAGE RAID RAIL RAIN RAKE RAMP RANG RANK RASH RATE RAVE RAZE READ REAL REAP REAR REEL REND RENT RICE RICH RICK RIDE RIFE RILE RING RINK RIOT RIPE RISE RISK ROAD ROAM ROAR ROBE ROCK RODE ROLE ROLL ROOF ROOK ROOM ROOT ROPE ROSE ROUT RUDE RUIN RULE RUMP RUNE RUNG RUNT RUSE RUSH RUST SACK SAGE SAIL SAKE SALE SALT SAME SAND SANE SANG SANK SASH SATE SAVE SCAN SCAR SEAL SEAM SEAR SEAT SEED SEEK SEEM SEEN SEEP SELF SELL SEND SHED SHIN SHIP SHOT SHOW SHUT SICK SIGH SILK SILL SINK SITE SKID SKIN SKIP SLAB SLAP SLAY SLED SLID SLIM SLIP SLIT SLOB SLOP SLOT SLUG SLUM SLUR SNAP SNOW SOAP SOAR SOCK SODA SOFA SOFT SOLD SOLE SOLO SOME SONG SOON SOOT SORE SORT SOUL SOUP SOUR SPAN STAR STEM STEP STEW STIR STOP STUD SUCH SUIT SWAN SWAT SWAY TABS TACK TACT TAIL TAKE TALE TALK TALL TAME TANG TANK TAPE TART TASK TEAR TELL TENT TERM TEST TIDE TILE TILL TILT TIME TINT TIRE TOAD TOLD TOLL TOMB TONE TONG TOOK TOOL TORE TORN TOSS TOTE TOUR TRAP TRAY TRIM TRIO TRIP TROD TROT TUCK TUNE TURF TURN TUSK UGLY UNDO UPON URGE VAIN VALE VARY VAST VEAL VEER VEIL VEIN VENT VEST VICE VILE VINE VOID VOLT VOTE WADE WAKE WALK WALL WAND WANE WARD WARE WARM WARN WARP WART WARY WAVE WEAK WEAN WELD WELL WEND WEPT WEST WEED WEEK WEEP WIDE WIFE WILD WILL WIND WINE WING WINK WISE WISP WOKE WOLF WOMB WOOD WORD WORE WORK WORM WORN'.trim().split(/\s+/)),
  },
  tr: {
    name: 'Türkçe', flag: '🇹🇷',
    words: new Set('AL AT AK AÇ AY EV SU KAN GÜN YIL GEL GİT KAL KAR SAL SES YAR BAK GÖR GEZ YAZ SEV OKU VAR YOL KIZ GÜL DİL ANA ATA ADA ARA ADAM ALAN ALEV AYAK BACA BALIK BANKA BÜYÜK HAYAT KALE KARA PARA KEDI KÖPEK AĞAÇ GÜZEL ZAMAN ARABA ÇOCUK OKUL MASA KAPI YEMEK OYUN SAAT GECE GÜNEŞ DAĞ BAHÇE ÇIÇEK KALEM KITAP'.trim().split(/\s+/)),
  },
  fr: {
    name: 'Français', flag: '🇫🇷',
    words: new Set('ABRI AIDE AMOUR AVEC BAIN BEAU BIEN BLEU BOIS BRAS CENT CHEF CHER COUP DAME DENT DEUX DIEU DOUX ELLE FACE FAIT FEUX FOND FORT GROS HAUT HIER HOMME JOUR LEUR LIEU LIRE LONG LOUP LUNE MAIN MAIS MARI MÈRE MIDI MOIS MORT NEUF NUIT OURS PAYS PEAU PIED PLUS POUR PRIX RIEN SANG SENS SEUL SOIF SORT SOUS TANT TOIT TOUT VERS VIDE VITE VOIR VRAI'.trim().split(/\s+/)),
  },
  es: {
    name: 'Español', flag: '🇪🇸',
    words: new Set('AGUA ALMA AZUL BANCO BELLO BIEN BUSCA CALMA CAMPO CARNE CARTA CERCA CIELO CINCO CLARO CLASE COMER COMO CORTA COSTA DAÑO DESDE DIEZ DOLOR DONDE ECHAR EDAD ENTRE ESTAR ESTE FUEGO FORMA GANA GENTE GOLPE GRACIAS GRANDE GUSTO HACER HACIA HECHO HORA IDEAS IGUAL JUNTO LARGO LEJOS LIBRE MADRE MANOS MEJOR MISMO MUCHO NOCHE NORTE NUEVA NUEVO OTRA PADRE PAGAR PERO POCO PODER QUIERO RESTO SABER SIEMPRE SOBRE SOLO SUAVE TENER TIEMPO TODOS VECES VENIR VERDE VIDA VOLAR'.trim().split(/\s+/)),
  },
};

const PASTEL = ['#ffb3c6','#ffd6a5','#fdffb6','#caffbf','#9bf6ff','#a0c4ff','#bdb2ff','#ffc6ff','#ffadad','#b9fbc0'];
const COLS=5, ROWS=5, TOTAL=25, START_TIME=150, HINT_COST=20;
const calcPts  = n => n * n * 10;
const calcSecs = n => n <= 2 ? 1 : Math.round(Math.pow(1.8, n - 1));

const TIERS = {
  en: { t1:['E','E','E','A','A','A','R','R','I','I','O','O','T','T','N','N','S','S'], t2:['L','L','C','C','U','U','D','D','H','H','G','M','P','P'], t3:['B','B','F','F','W','W','Y','Y','V','K'], t4:['J','X','Q','Z'] },
  tr: { t1:['A','A','A','E','E','E','İ','İ','K','K','L','L','R','R','N','N','T','T'], t2:['M','M','S','S','D','D','B','B','U','U','Ü','Ü','Ö','Y','Y'], t3:['Ç','Ç','G','G','Ğ','Ş','Ş','H','H','Z','Z'], t4:['I','F','V','P'] },
  fr: { t1:['E','E','E','A','A','S','S','I','I','N','N','T','T','R','R','U','U'], t2:['L','L','O','O','D','D','C','C','M','M','P','P','V','G'], t3:['F','F','B','B','H','H','J','Q','X'], t4:['K','W','Y','Z'] },
  es: { t1:['E','E','E','A','A','A','O','O','S','S','N','N','R','R','I','I','L','L'], t2:['T','T','C','C','U','U','D','D','M','M','P','P','G','B'], t3:['V','V','J','J','H','H','F','X','Ñ'], t4:['K','Q','W','Y','Z'] },
};

// ─── Grid helpers ─────────────────────────────────────────────────────────────
function rng32(seed) { return () => { let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

function mkGridFromSeed(lang, seed) {
  const rng = rng32(seed), T = TIERS[lang]||TIERS.en;
  return Array.from({length:TOTAL}, (_, i) => {
    const r = rng(), pool = r<.5?T.t1:r<.78?T.t2:r<.92?T.t3:T.t4;
    return { id:i, letter:pool[Math.floor(rng()*pool.length)], color:PASTEL[Math.floor(rng()*PASTEL.length)], key:`${i}-${seed}` };
  });
}

function mkGrid(lang) { const seed=Math.floor(Math.random()*2**30); return {cells:mkGridFromSeed(lang,seed),seed}; }

function refill(cells, removed, lang) {
  const T=TIERS[lang]||TIERS.en, n=[...cells];
  removed.forEach(i => { const r=Math.random(),pool=r<.5?T.t1:r<.78?T.t2:r<.92?T.t3:T.t4; n[i]={id:i,letter:pool[Math.floor(Math.random()*pool.length)],color:PASTEL[Math.floor(Math.random()*PASTEL.length)],key:Math.random()}; });
  return n;
}

const isAdj=(a,b)=>Math.abs(Math.floor(a/COLS)-Math.floor(b/COLS))<=1&&Math.abs(a%COLS-b%COLS)<=1&&a!==b;
const nbrs=i=>{const r=Math.floor(i/COLS),c=i%COLS,res=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const nr=r+dr,nc=c+dc;if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS)res.push(nr*COLS+nc);}return res;};
const ser = cells => cells.map(({id,letter,color})=>({id,letter,color}));
const deser = (data,seed) => (data||[]).map((c,i)=>({...c,key:`${i}-${seed||0}`}));

const {width:SW} = Dimensions.get('window');
const GRID_SIZE = Math.min(SW-32, 420);
const GAP = 5;
const CELL = (GRID_SIZE - GAP*4) / 5;

// ─── Root component ───────────────────────────────────────────────────────────
export default function App() {
  const params = useLocalSearchParams();  // joinMatchId arrives from challenge/[matchId].js
  const router = useRouter();

  // ── Screen state ─────────────────────────────────────────────────────────
  const [screen,    setScreen]    = useState('lang');
  const [lang,      setLang]      = useState('en');
  const [nameVal,   setNameVal]   = useState('');
  const [matchId,   setMatchId]   = useState('');
  const [toasts,    setToasts]    = useState([]);
  const [cells,     setCells]     = useState([]);
  const [sel,       setSel]       = useState([]);
  const [boom,      setBoom]      = useState([]);
  const [hint,      setHint]      = useState([]);
  const [myScore,   setMyScore]   = useState(0);
  const [timeLeft,  setTimeLeft]  = useState(START_TIME);
  const [myWC,      setMyWC]      = useState(0);
  const [myLong,    setMyLong]    = useState('');
  const [oppData,   setOppData]   = useState(null);
  const [copied,    setCopied]    = useState(false);
  const [joining,   setJoining]   = useState(false); // shows spinner while auto-joining

  // ── Refs ──────────────────────────────────────────────────────────────────
  const cellsR=useRef([]),selR=useRef([]),scoreR=useRef(0),epochR=useRef(0);
  const wcR=useRef(0),longR=useRef(''),wordsR=useRef(new Set());
  const langR=useRef('en'),nameR=useRef(''),matchR=useRef(''),pidR=useRef('');
  const seedR=useRef(0),busy=useRef(false),timerR=useRef(null),unsubR=useRef(null);
  const phaseR=useRef('idle'),layoutsR=useRef({});
  const soloFallR=useRef(null);

  useEffect(()=>{cellsR.current=cells;},[cells]);

  // ── Handle deep link param (auto-join, no typing) ─────────────────────────
  // This fires when the app opens from a challenge link.
  // joinMatchId is set by app/challenge/[matchId].js
  useEffect(() => {
    const mid = params?.joinMatchId;
    if (!mid) return;
    // If we have a name already, join immediately
    // Otherwise show name screen with the matchId preserved
    if (nameVal.trim()) {
      triggerGuestJoin(nameVal.trim(), String(mid));
    } else {
      setMatchId(String(mid));
      setScreen('nameForJoin');
    }
  }, [params?.joinMatchId]);

  // ── Also handle deep links while app is already open ──────────────────────
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const parsed = Linking.parse(url);
      // wordblast://challenge/ABC123 or https://wordblast.app/challenge/ABC123
      const mid =
        parsed?.queryParams?.matchId ||
        (parsed?.path || '').replace(/^challenge\/?/,'').split('/').pop() ||
        (parsed?.hostname === 'challenge' ? parsed?.path?.replace('/','') : null);
      if (mid && mid.length >= 5) {
        if (nameVal.trim()) {
          triggerGuestJoin(nameVal.trim(), mid.toUpperCase());
        } else {
          setMatchId(mid.toUpperCase());
          setScreen('nameForJoin');
        }
      }
    });
    return () => sub.remove();
  }, [nameVal]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const toast = useCallback((msg, dur=2200) => {
    const id = Date.now()+Math.random();
    setToasts(t=>[...t.slice(-2),{id,msg}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),dur);
  },[]);

  // ── Push to Firebase ──────────────────────────────────────────────────────
  const pushState = useCallback((ex={}) => {
    const mid=matchR.current, pid=pidR.current;
    if (!mid||!pid) return;
    fbPush(mid, pid, {
      score:    ex.score ?? scoreR.current,
      wordCount:ex.wc    ?? wcR.current,
      longest:  ex.long  ?? longR.current,
      cells:    ser(ex.cells ?? cellsR.current),
    }).catch(()=>{});
  },[]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const startTimer = useCallback(epoch => {
    epochR.current = epoch;
    clearInterval(timerR.current);
    const tick = () => {
      const rem = Math.max(0, START_TIME - Math.floor((Date.now()-epoch)/1000));
      setTimeLeft(rem);
      if (rem <= 0) {
        clearInterval(timerR.current);
        phaseR.current = 'over';
        setScreen('over');
        const mid=matchR.current, pid=pidR.current;
        if (mid) {
          fbStatus(mid,'over').catch(()=>{});
          if (pid) fbPush(mid,pid,{score:scoreR.current,wordCount:wcR.current,longest:longR.current}).catch(()=>{});
        }
      }
    };
    tick(); timerR.current = setInterval(tick,500);
  },[]);

  // ── Firebase subscription ─────────────────────────────────────────────────
  const handleFB = useCallback(data => {
    const pid=pidR.current, opp=pid==='p1'?'p2':'p1';
    if (data[opp]) {
      setOppData({
        name:      data[opp].name,
        score:     data[opp].score     || 0,
        wordCount: data[opp].wordCount || 0,
        longest:   data[opp].longest   || '',
        cells:     deser(data[opp].cells, data.gridSeed),
      });
    }
    if (pid==='p2' && data.status==='playing' && phaseR.current==='waiting') {
      phaseR.current='playing'; setScreen('game'); startTimer(data.startEpoch);
    }
    if (pid==='p1' && data.p2 && data.status==='playing' && phaseR.current==='waiting') {
      phaseR.current='playing'; setScreen('game'); startTimer(data.startEpoch);
    }
    if (data.status==='over' && phaseR.current==='playing') {
      clearInterval(timerR.current); phaseR.current='over'; setScreen('over');
    }
  },[startTimer]);

  // ── Reset local state ─────────────────────────────────────────────────────
  const resetLocal = (c, l) => {
    setCells(c); cellsR.current=c;
    setMyScore(0); scoreR.current=0;
    setMyWC(0); wcR.current=0;
    setMyLong(''); longR.current='';
    setSel([]); selR.current=[];
    setBoom([]); setHint([]); setOppData(null);
    busy.current=false;
    wordsR.current=new Set(LANGS[l]?.words||[]);
    langR.current=l;
  };

  // ── HOST: create match ─────────────────────────────────────────────────────
  const doHost = useCallback(async (name, l) => {
    const mid = genMatchId();
    nameR.current=name; matchR.current=mid; pidR.current='p1';
    const {cells:c,seed} = mkGrid(l); seedR.current=seed;
    resetLocal(c,l);
    await fbCreate(mid, l, seed, name, ser(c));
    setMatchId(mid); phaseR.current='waiting'; setScreen('lobby');
    if (unsubR.current) unsubR.current();
    unsubR.current = fbSub(mid, handleFB);
    // Solo fallback after 60s
    soloFallR.current = setTimeout(()=>{
      if (phaseR.current==='waiting') { phaseR.current='playing'; setScreen('game'); startTimer(Date.now()); }
    }, 60000);
  },[handleFB,startTimer]);

  // ── GUEST: join match (called automatically from deep link) ───────────────
  const triggerGuestJoin = useCallback(async (name, mid) => {
    setJoining(true);
    try {
      const result = await fbJoin(mid, name, ser(mkGridFromSeed('en',0))); // placeholder cells, overwritten below
      // Actually get the real grid
      const { lang:l, gridSeed, startEpoch } = result;
      nameR.current=name; matchR.current=mid; pidR.current='p2';
      const c = mkGridFromSeed(l, gridSeed); seedR.current=gridSeed;
      resetLocal(c, l); setLang(l);
      // Re-push correct cells
      await fbPush(mid,'p2',{name,score:0,wordCount:0,longest:'',cells:ser(c),ts:Date.now()});
      setMatchId(mid); phaseR.current='waiting'; setScreen('joining');
      if (unsubR.current) unsubR.current();
      unsubR.current = fbSub(mid, handleFB);
    } catch(e) {
      const msg =
        e.message==='MATCH_NOT_FOUND'       ? 'Match not found — it may have expired.' :
        e.message==='MATCH_ALREADY_STARTED' ? 'This match already started.' :
                                              'Failed to join. Check your connection.';
      Alert.alert('Cannot Join', msg, [{text:'OK', onPress:()=>setScreen('mode')}]);
    } finally { setJoining(false); }
  },[handleFB]);

  // ── SOLO ──────────────────────────────────────────────────────────────────
  const doSolo = useCallback((name, l) => {
    nameR.current=name; matchR.current=''; pidR.current='';
    const {cells:c} = mkGrid(l); resetLocal(c,l);
    phaseR.current='playing'; setScreen('game'); startTimer(Date.now());
  },[startTimer]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const doReset = useCallback(() => {
    clearInterval(timerR.current); clearTimeout(soloFallR.current);
    if (unsubR.current) { unsubR.current(); unsubR.current=null; }
    matchR.current=''; pidR.current=''; phaseR.current='idle';
    setMatchId(''); setOppData(null); setTimeLeft(START_TIME);
  },[]);

  // ── Share ─────────────────────────────────────────────────────────────────
  const doShare = useCallback(async () => {
    const mid = matchR.current; if (!mid) return;
    const link = buildDeepLink(mid);
    const msg = `${nameR.current} challenges you to Word Blast! 💥\nTap to play:\n${link}`;
    try {
      await Share.share({ message:msg, url: Platform.OS==='ios'?link:undefined, title:'Word Blast Challenge!' });
    } catch {}
  },[]);

  const doCopy = useCallback(() => {
    const mid = matchR.current; if (!mid) return;
    Clipboard.setString(buildDeepLink(mid));
    setCopied(true); toast('✅ Link copied!');
    setTimeout(()=>setCopied(false),2000);
  },[toast]);

  // ── Game logic ────────────────────────────────────────────────────────────
  const doBoom = useCallback((idxs,len) => {
    busy.current=true; setBoom(idxs);
    setTimeout(()=>{
      setBoom([]);
      const next=refill(cellsR.current,idxs,langR.current);
      setCells(next); cellsR.current=next; pushState({cells:next});
      setTimeout(()=>{busy.current=false;},200);
    },360);
  },[pushState]);

  const submitWord = useCallback(word => {
    const pts=calcPts(word.length), secs=calcSecs(word.length);
    scoreR.current+=pts; setMyScore(scoreR.current);
    epochR.current-=secs*1000;
    wcR.current++; setMyWC(wcR.current);
    if (word.length>longR.current.length) { longR.current=word; setMyLong(word); }
    toast(`💥 ${word} +${pts}pts +${secs}s`);
    const fill=[...selR.current]; setSel([]); selR.current=[];
    pushState({score:scoreR.current,wc:wcR.current,long:longR.current});
    doBoom(fill,word.length);
  },[toast,doBoom,pushState]);

  const endDrag = useCallback(()=>{
    if(busy.current||selR.current.length<2){setSel([]);selR.current=[];return;}
    const word=selR.current.map(i=>cellsR.current[i]?.letter||'').join('');
    if(!wordsR.current.has(word)){setSel([]);selR.current=[];return;}
    submitWord(word);
  },[submitWord]);

  const startDrag=useCallback(i=>{if(busy.current)return;setSel([i]);selR.current=[i];},[]);
  const moveDrag=useCallback(i=>{
    const cur=selR.current; if(!cur.length)return;
    if(cur.length>1&&cur[cur.length-2]===i){const n=cur.slice(0,-1);setSel(n);selR.current=n;return;}
    if(cur.includes(i)||!isAdj(cur[cur.length-1],i))return;
    const n=[...cur,i]; setSel(n); selR.current=n;
  },[]);

  const doHint=useCallback(()=>{
    if(scoreR.current<HINT_COST){toast(`Need ${HINT_COST}pts`);return;}
    let f=null;
    outer:for(let i=0;i<TOTAL;i++)for(const j of nbrs(i))for(const k of nbrs(j)){
      if(k===i||k===j)continue;
      const w=(cellsR.current[i]?.letter||'')+(cellsR.current[j]?.letter||'')+(cellsR.current[k]?.letter||'');
      if(wordsR.current.has(w)){f=[i,j,k];break outer;}
    }
    if(!f){toast('No hint found');return;}
    scoreR.current-=HINT_COST; setMyScore(scoreR.current);
    setHint(f); toast(`💡 ${f.map(i=>cellsR.current[i]?.letter).join('')} (-${HINT_COST}pts)`);
    setTimeout(()=>setHint([]),2500);
  },[toast]);

  const doShuffle=useCallback(()=>{
    if(scoreR.current<1){toast('Need points');return;}
    const cost=Math.max(1,Math.floor(scoreR.current*.25));
    scoreR.current-=cost; setMyScore(scoreR.current);
    const{cells:c}=mkGrid(langR.current); setCells(c); cellsR.current=c; setSel([]); selR.current=[];
    pushState({cells:c,score:scoreR.current}); toast(`🔀 Shuffled (-${cost}pts)`);
  },[toast,pushState]);

  const endGame=useCallback(()=>{
    clearInterval(timerR.current); clearTimeout(soloFallR.current);
    if(unsubR.current){unsubR.current();unsubR.current=null;}
    phaseR.current='over'; setScreen('over');
    if(matchR.current)fbStatus(matchR.current,'over').catch(()=>{});
  },[]);

  useEffect(()=>()=>{clearInterval(timerR.current);clearTimeout(soloFallR.current);if(unsubR.current)unsubR.current();},[]);

  // ── Grid PanResponder ─────────────────────────────────────────────────────
  const idxAt=useCallback((x,y)=>{
    for(const[idx,l]of Object.entries(layoutsR.current))
      if(x>=l.x&&x<=l.x+l.w&&y>=l.y&&y<=l.y+l.h)return parseInt(idx);
    return -1;
  },[]);

  const pan=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderGrant: e=>{const i=idxAt(e.nativeEvent.locationX,e.nativeEvent.locationY);if(i>=0)startDrag(i);},
    onPanResponderMove:  e=>{const i=idxAt(e.nativeEvent.locationX,e.nativeEvent.locationY);if(i>=0)moveDrag(i);},
    onPanResponderRelease:   ()=>endDrag(),
    onPanResponderTerminate: ()=>endDrag(),
  })).current;

  const selWord=sel.map(i=>cells[i]?.letter||'').join('');
  const valid=selWord.length>=2&&wordsR.current.has(selWord);
  const timerPct=Math.min(100,(timeLeft/START_TIME)*100);
  const tc=timeLeft<=15?'#e63946':timeLeft<=30?'#f4a261':'#6b5bb8';

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREENS
  // ═══════════════════════════════════════════════════════════════════════════

  // Joining spinner (shown while auto-joining from deep link)
  if (joining) return (
    <View style={[s.page,{paddingTop:60}]}>
      <Text style={{fontSize:44,textAlign:'center'}}>💥</Text>
      <Text style={s.title}>Joining match…</Text>
      <ActivityIndicator color="#bdb2ff" size="large" style={{marginTop:24}}/>
    </View>
  );

  // ── LANG ─────────────────────────────────────────────────────────────────
  if(screen==='lang') return (
    <View style={[s.page,{paddingTop:Platform.OS==='ios'?60:40}]}>
      <Text style={{fontSize:52,textAlign:'center'}}>💥</Text>
      <Text style={s.title}>Word Blast</Text>
      <Text style={s.sub}>Choose Language</Text>
      <View style={{height:20}}/>
      {Object.entries(LANGS).map(([code,cfg])=>(
        <TouchableOpacity key={code} onPress={()=>{setLang(code);setScreen('name');}} style={s.langBtn} activeOpacity={0.75}>
          <Text style={{fontSize:26}}>{cfg.flag}</Text>
          <Text style={s.langBtnTxt}>{cfg.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── NAME (normal) ─────────────────────────────────────────────────────────
  if(screen==='name') return (
    <View style={[s.page,{paddingTop:60}]}>
      <Text style={{fontSize:48,textAlign:'center'}}>{LANGS[lang]?.flag} 💥</Text>
      <Text style={s.title}>Word Blast</Text>
      <View style={{height:16}}/>
      <View style={s.card}>
        <Text style={s.lbl}>Your Name</Text>
        <TextInput value={nameVal} onChangeText={setNameVal} placeholder="Enter name…"
          placeholderTextColor="#c4bef0" maxLength={16} autoCapitalize="words" autoCorrect={false}
          returnKeyType="done" onSubmitEditing={()=>nameVal.trim()&&setScreen('mode')} style={s.inp}/>
        <TouchableOpacity onPress={()=>nameVal.trim()&&setScreen('mode')} style={s.btnP} activeOpacity={0.8}>
          <Text style={s.btnPT}>Continue →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setScreen('lang')} style={s.btnG}>
          <Text style={s.btnGT}>← Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── NAME FOR JOIN (came from deep link, need name then auto-join) ──────────
  if(screen==='nameForJoin') return (
    <View style={[s.page,{paddingTop:60}]}>
      <Text style={{fontSize:48,textAlign:'center'}}>⚔️</Text>
      <Text style={s.title}>You're challenged!</Text>
      <Text style={{fontSize:13,color:'#8b7bb8',fontWeight:'600',marginTop:6,textAlign:'center'}}>Match: {matchId}</Text>
      <View style={{height:16}}/>
      <View style={s.card}>
        <Text style={s.lbl}>Your Name</Text>
        <TextInput value={nameVal} onChangeText={setNameVal} placeholder="Enter your name…"
          placeholderTextColor="#c4bef0" maxLength={16} autoCapitalize="words" autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={()=>nameVal.trim()&&triggerGuestJoin(nameVal.trim(),matchId)}
          style={s.inp}/>
        <TouchableOpacity
          onPress={()=>nameVal.trim()&&triggerGuestJoin(nameVal.trim(),matchId)}
          style={[s.btnP,{backgroundColor:'#25D366'}]} activeOpacity={0.8}>
          <Text style={s.btnPT}>🤝 Join & Play</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>{setMatchId('');setScreen('lang');}} style={s.btnG}>
          <Text style={s.btnGT}>← Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── MODE ─────────────────────────────────────────────────────────────────
  if(screen==='mode') return (
    <View style={[s.page,{paddingTop:60}]}>
      <Text style={{fontSize:36,textAlign:'center'}}>👋 {nameVal}</Text>
      <Text style={[s.title,{fontSize:22,marginTop:4}]}>How to play?</Text>
      <View style={{height:20}}/>
      <View style={{width:'100%',maxWidth:320,gap:12}}>
        <TouchableOpacity onPress={()=>doSolo(nameVal.trim(),lang)} activeOpacity={0.8}
          style={{borderRadius:20,overflow:'hidden',backgroundColor:'#caffbf'}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:14,padding:18}}>
            <Text style={{fontSize:28}}>🎮</Text>
            <View><Text style={{fontSize:16,fontWeight:'900',color:'#2d1b69'}}>Solo Play</Text>
            <Text style={{fontSize:12,fontWeight:'600',color:'#4a7a5a',marginTop:2}}>Race the clock</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>doHost(nameVal.trim(),lang)} activeOpacity={0.8}
          style={{borderRadius:20,overflow:'hidden',backgroundColor:'#6d28d9'}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:14,padding:18}}>
            <Text style={{fontSize:28}}>⚔️</Text>
            <View><Text style={{fontSize:16,fontWeight:'900',color:'#fff'}}>Challenge Friend</Text>
            <Text style={{fontSize:12,fontWeight:'600',color:'#e0d9ff',marginTop:2}}>Real-time, tap link to join</Text></View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setScreen('name')} style={s.btnG}>
          <Text style={s.btnGT}>← Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  if(screen==='lobby') return (
    <View style={[s.page,{paddingTop:60}]}>
      <Text style={{fontSize:44,textAlign:'center'}}>⏳</Text>
      <Text style={[s.title,{fontSize:22}]}>Waiting for opponent…</Text>
      <View style={{height:14}}/>
      <View style={{backgroundColor:'#f0eeff',borderWidth:3,borderColor:'#bdb2ff',borderRadius:22,paddingHorizontal:28,paddingVertical:18,alignItems:'center',width:'100%',maxWidth:340}}>
        <Text style={s.lbl}>Match Code</Text>
        <Text style={{fontSize:42,fontWeight:'900',color:'#2d1b69',letterSpacing:10,marginTop:4}}>{matchId}</Text>
        <Text style={{fontSize:12,color:'#8b7bb8',fontWeight:'600',marginTop:6,textAlign:'center'}}>
          Friend taps the link — they join instantly, no typing needed
        </Text>
      </View>
      <View style={{flexDirection:'row',gap:10,marginTop:14,width:'100%',maxWidth:340}}>
        <TouchableOpacity onPress={doShare}
          style={{flex:1,backgroundColor:'#25D366',borderRadius:18,paddingVertical:14,alignItems:'center'}} activeOpacity={0.8}>
          <Text style={{color:'#fff',fontWeight:'900',fontSize:15}}>📲 Share Link</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={doCopy}
          style={{flex:1,backgroundColor:'#bdb2ff',borderRadius:18,paddingVertical:14,alignItems:'center'}} activeOpacity={0.8}>
          <Text style={{color:'#fff',fontWeight:'900',fontSize:15}}>{copied?'✅ Copied':'📋 Copy'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={{fontSize:12,color:'#c4bef0',textAlign:'center',lineHeight:20,marginTop:14}}>
        Game starts automatically when friend joins{'\n'}
        <Text style={{fontSize:11}}>Solo starts after 60s if no one joins</Text>
      </Text>
      <Text style={{fontSize:22,marginTop:10}}>· · ·</Text>
      <TouchableOpacity onPress={()=>{doReset();setScreen('mode');}}
        style={{marginTop:14,paddingHorizontal:28,paddingVertical:10,borderWidth:2,borderColor:'#ffadad',borderRadius:40}}>
        <Text style={{color:'#c0392b',fontWeight:'700',fontSize:14}}>✕ Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // ── JOINING ───────────────────────────────────────────────────────────────
  if(screen==='joining') return (
    <View style={[s.page,{paddingTop:60}]}>
      <Text style={{fontSize:44,textAlign:'center'}}>🔌</Text>
      <Text style={[s.title,{fontSize:22}]}>Connecting…</Text>
      <View style={{backgroundColor:'#f0eeff',borderRadius:16,paddingHorizontal:28,paddingVertical:16,marginTop:16,alignItems:'center'}}>
        <Text style={{fontSize:38,fontWeight:'900',color:'#2d1b69',letterSpacing:8}}>{matchId}</Text>
      </View>
      <ActivityIndicator color="#bdb2ff" size="large" style={{marginTop:20}}/>
      <Text style={{fontSize:13,color:'#8b7bb8',fontWeight:'600',marginTop:12}}>Waiting for host to start…</Text>
      <TouchableOpacity onPress={()=>{doReset();setScreen('mode');}}
        style={{marginTop:20,paddingHorizontal:28,paddingVertical:10,borderWidth:2,borderColor:'#ffadad',borderRadius:40}}>
        <Text style={{color:'#c0392b',fontWeight:'700',fontSize:14}}>✕ Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // ── OVER ─────────────────────────────────────────────────────────────────
  if(screen==='over') {
    const oppS=oppData?.score||0,iWin=myScore>=oppS;
    const players=[
      {label:'You',score:myScore,wc:myWC,long:myLong,win:iWin},
      oppData?{label:oppData.name,score:oppS,wc:oppData.wordCount,long:oppData.longest,win:!iWin}:null,
    ].filter(Boolean);
    return (
      <View style={[s.page,{paddingTop:60}]}>
        <Text style={{fontSize:52,textAlign:'center'}}>{iWin?'🏆':'💫'}</Text>
        <Text style={s.title}>{oppData?(iWin?'You Win! 🎉':'Good Game! 💪'):"Time's Up!"}</Text>
        <View style={{flexDirection:'row',gap:12,marginTop:20}}>
          {players.map((p,i)=>(
            <View key={i} style={{backgroundColor:'#fff',borderRadius:18,padding:16,borderWidth:2,borderColor:p.win?'#caffbf':'#f0eeff',minWidth:110,alignItems:'center'}}>
              <Text style={s.lbl}>{p.label}</Text>
              <Text style={{fontSize:32,fontWeight:'900',color:p.win?'#06d6a0':'#2d1b69',marginTop:4}}>{p.score}</Text>
              <Text style={{fontSize:11,color:'#8b7bb8',marginTop:2}}>{p.wc} words</Text>
              {p.long?<Text style={{fontSize:11,color:'#bdb2ff',fontWeight:'700',marginTop:2}}>🏅 {p.long}</Text>:null}
            </View>
          ))}
        </View>
        <View style={{flexDirection:'row',gap:12,marginTop:22}}>
          <TouchableOpacity onPress={()=>{doReset();setScreen('mode');}} style={s.btnP} activeOpacity={0.8}>
            <Text style={[s.btnPT,{paddingHorizontal:18}]}>🔄 Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>{doReset();setScreen('lang');}}
            style={{borderRadius:40,paddingVertical:14,paddingHorizontal:18,borderWidth:2,borderColor:'#ddd8ff',alignItems:'center'}}>
            <Text style={s.btnGT}>🌍 Language</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── GAME ─────────────────────────────────────────────────────────────────
  return (
    <View style={{flex:1,backgroundColor:'#fef6ff',alignItems:'center',paddingTop:Platform.OS==='ios'?50:30}}>

      {/* Toasts */}
      <View style={{position:'absolute',top:62,left:0,right:0,zIndex:99,alignItems:'center',gap:4}} pointerEvents="none">
        {toasts.map(t=>(
          <View key={t.id} style={{backgroundColor:'#2d1b69',borderRadius:50,paddingHorizontal:16,paddingVertical:6,shadowColor:'#2d1b69',shadowOffset:{width:0,height:3},shadowOpacity:0.3,shadowRadius:6,elevation:6}}>
            <Text style={{color:'#fff',fontWeight:'700',fontSize:13}}>{t.msg}</Text>
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={{width:'100%',maxWidth:440,flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:14,paddingBottom:4}}>
        <View>
          <Text style={{fontSize:10,fontWeight:'700',color:'#8b7bb8',letterSpacing:1,textTransform:'uppercase'}}>{LANGS[lang]?.flag} {nameVal}</Text>
          <Text style={{fontSize:22,fontWeight:'900',color:'#2d1b69'}}>⭐ {myScore}</Text>
        </View>
        <View style={{alignItems:'center'}}>
          <Text style={{fontSize:9,fontWeight:'700',color:'#8b7bb8',letterSpacing:2,textTransform:'uppercase'}}>TIME</Text>
          <Text style={{fontSize:38,fontWeight:'900',color:tc,minWidth:60,textAlign:'center'}}>{timeLeft}</Text>
        </View>
        <View style={{alignItems:'flex-end'}}>
          {oppData
            ?<><Text style={{fontSize:10,fontWeight:'700',color:'#8b7bb8',letterSpacing:1,textTransform:'uppercase'}}>vs {oppData.name}</Text>
              <Text style={{fontSize:22,fontWeight:'900',color:'#e63946'}}>⭐ {oppData.score}</Text></>
            :<Text style={{fontSize:11,color:'#c4bef0',fontWeight:'600'}}>Solo</Text>}
        </View>
      </View>

      {/* Buttons */}
      <View style={{width:'100%',maxWidth:440,flexDirection:'row',gap:6,paddingHorizontal:14,paddingBottom:4}}>
        <TouchableOpacity onPress={doHint}    style={{flex:1,paddingVertical:8,borderRadius:28,alignItems:'center',backgroundColor:'#ffd6a5'}} activeOpacity={0.75}>
          <Text style={{fontSize:12,fontWeight:'700',color:'#2d1b69'}}>💡 Hint</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={doShuffle} style={{flex:1,paddingVertical:8,borderRadius:28,alignItems:'center',backgroundColor:'#caffbf'}} activeOpacity={0.75}>
          <Text style={{fontSize:12,fontWeight:'700',color:'#2d1b69'}}>🔀 Shuffle</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={endGame}   style={{width:32,height:32,borderRadius:16,backgroundColor:'#ffadad',alignItems:'center',justifyContent:'center'}} activeOpacity={0.75}>
          <Text style={{color:'#c0392b',fontWeight:'900',fontSize:14}}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Timer bar */}
      <View style={{width:'100%',maxWidth:440,height:5,backgroundColor:'#e8e4ff',borderRadius:10,overflow:'hidden',marginHorizontal:14,marginBottom:3}}>
        <View style={{height:'100%',width:`${timerPct}%`,backgroundColor:tc,borderRadius:10}}/>
      </View>

      {/* Opponent mini grid */}
      {oppData?.cells?.length>0&&(
        <View style={{width:'100%',maxWidth:440,flexDirection:'row',alignItems:'center',paddingHorizontal:14,gap:6,marginBottom:2}}>
          <Text style={{fontSize:9,fontWeight:'700',color:'#8b7bb8',textTransform:'uppercase',letterSpacing:1}}>{oppData.name}</Text>
          <View style={{flex:1,flexDirection:'row',flexWrap:'wrap',gap:2,opacity:0.65}}>
            {oppData.cells.slice(0,25).map((c,i)=>(
              <View key={i} style={{width:'18%',aspectRatio:1,borderRadius:3,backgroundColor:c?.color||'#eee',alignItems:'center',justifyContent:'center'}}>
                <Text style={{fontSize:8,fontWeight:'900',color:'#2d1b69'}}>{c?.letter||''}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Word bar */}
      <View style={{width:'100%',maxWidth:440,minHeight:48,backgroundColor:'#fff',borderWidth:2,borderColor:valid?'#caffbf':'#ddd8ff',borderRadius:16,marginHorizontal:14,marginBottom:2,alignItems:'center',justifyContent:'center',paddingHorizontal:8,paddingVertical:4}}>
        {sel.length===0
          ?<Text style={{fontSize:13,color:'#c4bef0',fontWeight:'500'}}>Swipe letters to make a word…</Text>
          :<View style={{flexDirection:'row',flexWrap:'wrap',gap:3,justifyContent:'center'}}>
            {sel.map((idx,pos)=>(
              <View key={pos} style={{width:34,height:34,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:cells[idx]?.color||'#eee'}}>
                <Text style={{fontSize:20,fontWeight:'900',color:'#2d1b69'}}>{cells[idx]?.letter}</Text>
              </View>
            ))}
          </View>}
      </View>

      {/* Status */}
      <Text style={{fontSize:11,fontWeight:'700',color:valid?'#06d6a0':'#8b7bb8',textAlign:'center',height:16,marginBottom:2}}>
        {selWord.length>=2?(valid?`✓ ${calcPts(selWord.length)}pts +${calcSecs(selWord.length)}s`:'✗ Not a word'):''}
      </Text>

      {/* Grid */}
      <View style={{flexDirection:'row',flexWrap:'wrap',width:GRID_SIZE,gap:GAP,paddingBottom:8}} {...pan.panHandlers}>
        {cells.map((cell,idx)=>{
          const isSel=sel.includes(idx),isBoom=boom.includes(idx),isHint=hint.includes(idx);
          return (
            <View key={cell.key||idx}
              onLayout={e=>{const{x,y,width,height}=e.nativeEvent.layout;layoutsR.current[idx]={x,y,w:width,h:height};}}
              style={[
                {width:CELL,height:CELL,borderRadius:15,alignItems:'center',justifyContent:'center',
                 backgroundColor:cell.color,shadowColor:'#000',shadowOffset:{width:0,height:3},
                 shadowOpacity:0.1,shadowRadius:4,elevation:3},
                isSel&&{transform:[{scale:1.09}],elevation:7},
                isHint&&{shadowColor:'#ffd6a5',shadowOpacity:0.9,shadowRadius:8,elevation:8},
                isBoom&&{transform:[{scale:0}],opacity:0},
              ]}>
              <Text style={{fontSize:CELL*0.42,fontWeight:'900',color:'#2d1b69',
                textShadowColor:'rgba(255,255,255,0.55)',textShadowOffset:{width:0,height:2},textShadowRadius:2}}>
                {cell.letter}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:       { flex:1, backgroundColor:'#fef6ff', alignItems:'center', justifyContent:'center', padding:20 },
  title:      { fontSize:30, fontWeight:'900', color:'#2d1b69', letterSpacing:1, textAlign:'center' },
  sub:        { fontSize:11, fontWeight:'700', color:'#8b7bb8', letterSpacing:3, textTransform:'uppercase', marginTop:4, textAlign:'center' },
  card:       { backgroundColor:'#fff', borderRadius:24, padding:20, width:'100%', maxWidth:340, gap:10, borderWidth:2, borderColor:'#f0eeff', shadowColor:'#bdb2ff', shadowOffset:{width:0,height:8}, shadowOpacity:0.12, shadowRadius:18, elevation:5 },
  lbl:        { fontSize:10, fontWeight:'800', color:'#8b7bb8', letterSpacing:2, textTransform:'uppercase' },
  inp:        { backgroundColor:'#f7f5ff', borderWidth:2, borderColor:'#ddd8ff', borderRadius:14, paddingHorizontal:14, paddingVertical:12, fontSize:16, fontWeight:'600', color:'#2d1b69' },
  btnP:       { backgroundColor:'#bdb2ff', borderRadius:40, paddingVertical:14, alignItems:'center', shadowColor:'#bdb2ff', shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:10, elevation:4 },
  btnPT:      { color:'#fff', fontWeight:'900', fontSize:16 },
  btnG:       { borderRadius:40, paddingVertical:10, alignItems:'center' },
  btnGT:      { color:'#8b7bb8', fontWeight:'600', fontSize:14 },
  langBtn:    { flexDirection:'row', alignItems:'center', gap:14, paddingVertical:14, paddingHorizontal:22, backgroundColor:'#fff', borderRadius:18, borderWidth:2, borderColor:'#f0eeff', width:'100%', maxWidth:300, marginBottom:8, shadowColor:'#bdb2ff', shadowOffset:{width:0,height:3}, shadowOpacity:0.1, shadowRadius:8, elevation:2 },
  langBtnTxt: { fontSize:16, fontWeight:'700', color:'#2d1b69' },
});
