import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'

// ─── Per-Project Data ────────────────────────────────────────────────────────
const PROJECT_DATA = {
  'led-blink': {
    title: 'LED Blink', icon: '💡', color: '#22c55e', board: 'Arduino Uno', xpReward: 100,
    starterKit: [
      { id: 'arduino', name: 'Arduino Uno', icon: '🟩', color: '#3b82f6', desc: 'Your project\'s BRAIN! It reads your code and follows every instruction.' },
      { id: 'led',     name: 'LED',         icon: '💡', color: '#22c55e', desc: 'A tiny light that turns ON when electricity flows through it. Works forever unlike old bulbs!' },
      { id: 'resistor',name: 'Resistor',    icon: '🟤', color: '#f59e0b', desc: 'A speed-bump for electricity. Keeps the LED safe from getting too much power.' },
      { id: 'wire',    name: 'Wire',        icon: '〰️', color: '#94a3b8', desc: 'Connects all your parts together — like roads for electricity!' },
    ],
    lockedRewards: [
      { id: 'rgb-led', name: 'RGB LED', icon: '🌈', color: '#a855f7', desc: 'Makes 16 million colors! Earn it by finishing LED Blink.' },
      { id: 'button',  name: 'Button',  icon: '🔘', color: '#3b82f6', desc: 'Control things with a press! Unlocks in next project.' },
      { id: 'buzzer',  name: 'Buzzer',  icon: '🔊', color: '#f97316', desc: 'Makes beeps and sounds! Unlocks in Buzzer project.' },
    ],
    flashcards: [
      {
        id: 1, emoji: '💡', front: 'What is an LED?',
        simple: 'An LED is like a tiny magic light that NEVER burns out — and it runs on very little electricity!',
        detail: 'LED = Light Emitting Diode. When electricity enters the + side and exits the − side, it makes light! Unlike old bulbs, LEDs are super small, cool, and last for 100,000 hours.',
        funFact: '🌟 Cool fact: The screens on your phone use millions of microscopic LEDs!',
        quiz: { q: 'What does LED stand for?', opts: ['Light Emitting Diode','Large Electric Device','Laser Energy Display','Low Electric Detector'], ans: 0 },
      },
      {
        id: 2, emoji: '🟤', front: 'Why do we NEED a resistor?',
        simple: 'A resistor is like a speed bump for electricity — without it, the LED gets TOO much power and DIES instantly!',
        detail: 'An LED needs only about 20mA of current. Arduino\'s pin gives 40mA — double! The resistor (220Ω) reduces it to the safe amount. It\'s like turning a fire hose into a garden hose.',
        funFact: '💥 Without a resistor: your LED burns out in less than 1 second. Always use one!',
        quiz: { q: 'What happens if you skip the resistor?', opts: ['LED glows brighter','LED burns out!','Nothing changes','LED blinks faster'], ans: 1 },
      },
      {
        id: 3, emoji: '🟩', front: 'What does Arduino do?',
        simple: 'Arduino is a tiny computer that LISTENS to your code and does exactly what you say!',
        detail: 'Arduino has 14 digital pins. You can make them HIGH (5V = electricity) or LOW (0V = no electricity). Pin 13 is special — it has a tiny LED already built into the board!',
        funFact: '🤖 Arduino can control robots, alarms, displays, sensors and more — all from your code!',
        quiz: { q: 'When you set a pin to HIGH, what happens?', opts: ['Pin turns off','5 volts goes OUT from that pin','Arduino restarts','Nothing'], ans: 1 },
      },
      {
        id: 4, emoji: '📌', front: 'LED legs — which is + and which is −?',
        simple: 'LEDs have TWO legs: a LONG one (+) and a SHORT one (−). Connect them the right way or it won\'t light up!',
        detail: 'The LONG leg (called "anode") connects to the positive side (through the resistor to Pin 13). The SHORT leg (called "cathode") connects to GND (ground = negative).',
        funFact: '💡 Memory trick: LONG = LIVE electricity | SHORT = GND (ground)',
        quiz: { q: 'Which leg of an LED connects to the resistor/Pin 13?', opts: ['Short leg (−)','Either leg','Long leg (+)','No leg — just balance it'], ans: 2 },
      },
      {
        id: 5, emoji: '⏱️', front: 'How does BLINK work in code?',
        simple: 'We say: Turn ON, wait 1 second, Turn OFF, wait 1 second, repeat FOREVER!',
        detail: `void loop() {
  digitalWrite(13, HIGH);  // ON
  delay(1000);              // wait 1 sec
  digitalWrite(13, LOW);   // OFF  
  delay(1000);              // wait 1 sec
}
The loop() function runs again and again — making your LED blink!`,
        funFact: '⚡ Change delay(1000) to delay(100) and the LED blinks 10× faster! Try it!',
        quiz: { q: 'What does delay(500) do in Arduino?', opts: ['Wait 500 minutes','Wait 0.5 seconds (500ms)','Blink 500 times','Set speed to 500'], ans: 1 },
      },
    ],
    buildSteps: [
      { id: 0, icon: '🟩', label: 'Place Arduino Uno in your workspace', tip: 'The big green board is your Arduino!' },
      { id: 1, icon: '⬛', label: 'Add breadboard beside the Arduino', tip: 'This is your building surface — no soldering needed!' },
      { id: 2, icon: '💡', label: 'Place LED on breadboard — long leg in row 1, short in row 2', tip: 'Long leg = positive (+). Short leg = negative (−)' },
      { id: 3, icon: '🟤', label: 'Connect 220Ω resistor from Pin 13 to LED long leg', tip: 'Resistor color code: Red-Red-Brown = 220Ω' },
      { id: 4, icon: '〰️', label: 'Connect a wire from LED short leg to Arduino GND', tip: 'GND = Ground = the minus of your circuit' },
      { id: 5, icon: '💻', label: 'Type/paste the blink code and click Upload', tip: 'The upload button looks like a right-arrow →' },
      { id: 6, icon: '▶️', label: 'Click Run/Simulate and watch it blink!', tip: 'If it doesn\'t blink, check the Mistake Finder below ↓' },
    ],
    mistakes: [
      { id: 'backwards', trigger: ['led not working','not lighting','doesn\'t light','no light'], emoji: '🔄', title: 'LED is Backwards?', problem: 'LED only works ONE way. If it\'s backwards, NO light!', fix: 'Flip your LED around. Long leg (+) → resistor → Pin13. Short leg (−) → GND.' },
      { id: 'no-resistor', trigger: ['burned','too bright','smoke','dead led','fried'], emoji: '🔥', title: 'Forgot Resistor?', problem: 'Without a 220Ω resistor, too much power fries the LED instantly!', fix: 'Always put a resistor between Pin 13 and the LED\'s long leg.' },
      { id: 'wrong-pin', trigger: ['code wrong','wrong pin','pin number','not matching'], emoji: '📌', title: 'Wrong Pin Number?', problem: 'If code says pin 13 but LED is on pin 12, it won\'t work!', fix: 'Make sure the pin number in your code matches the physical pin you connected to.' },
      { id: 'no-gnd', trigger: ['gnd','ground','not connected','open circuit'], emoji: '⚠️', title: 'No GND Connection?', problem: 'Electricity needs a complete loop: Arduino → LED → GND → back to Arduino!', fix: 'Connect LED\'s short leg (−) to any GND pin on Arduino.' },
    ],
  },

  'rgb-led': {
    title: 'RGB LED', icon: '🌈', color: '#a855f7', board: 'Arduino Uno', xpReward: 150,
    starterKit: [
      { id: 'arduino',  name: 'Arduino Uno', icon: '🟩', color: '#3b82f6', desc: 'Your project\'s brain!' },
      { id: 'rgb-led',  name: 'RGB LED',     icon: '🌈', color: '#a855f7', desc: 'Has 3 LEDs inside: Red, Green, Blue. Mix them for any color!' },
      { id: 'resistor', name: 'Resistor ×3', icon: '🟤', color: '#f59e0b', desc: 'One for each color channel.' },
    ],
    lockedRewards: [
      { id: 'button', name: 'Button', icon: '🔘', color: '#3b82f6', desc: 'Switch colors with a button!' },
    ],
    flashcards: [
      { id: 1, emoji: '🌈', front: 'How does an RGB LED work?', simple: 'An RGB LED is 3 LEDs in one tiny package — Red, Green, and Blue. Mix them to make ANY color!', detail: 'By controlling how bright each of R, G, B is (0–255), you can create 16 million colors! This is exactly how phone screens work.', funFact: '🎨 Red + Green = Yellow! Green + Blue = Cyan! All three = White!', quiz: { q: 'How many colors can an RGB LED make?', opts: ['3 colors','256 colors','16 million colors','Only rainbow colors'], ans: 2 } },
    ],
    buildSteps: [
      { id: 0, icon: '🌈', label: 'Place RGB LED on breadboard', tip: 'It has 4 legs — longest is GND (common cathode)' },
      { id: 1, icon: '🟤', label: 'Add 3 resistors (one per color pin)', tip: 'R → Pin 9, G → Pin 10, B → Pin 11' },
      { id: 2, icon: '💻', label: 'Use analogWrite() to set brightness', tip: 'analogWrite(9, 255) = full red!' },
    ],
    mistakes: [],
  },
}

const makeDefaultData = (slug) => ({
  title: slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
  icon: '🔧', color: '#3b82f6', board: 'Arduino Uno', xpReward: 100,
  starterKit: [
    { id: 'arduino', name: 'Arduino Uno', icon: '🟩', color: '#3b82f6', desc: 'Your project\'s brain!' },
    { id: 'wire',    name: 'Wire',        icon: '〰️', color: '#94a3b8', desc: 'Connects everything!' },
  ],
  lockedRewards: [
    { id: 'next', name: 'New Part!', icon: '🎁', color: '#a855f7', desc: 'Complete this project to unlock!' },
  ],
  flashcards: [
    { id: 1, emoji: '🔧', front: 'Getting Started', simple: 'This project teaches you something cool about electronics!', detail: 'Follow each step carefully. You\'ve got this — every expert started exactly where you are!', funFact: '🌟 Fact: The person who invented Arduino was a teacher just like yours!', quiz: { q: 'What is the best way to learn electronics?', opts: ['Skip the guide','Give up quickly','Follow steps carefully','Guess everything'], ans: 2 } },
  ],
  buildSteps: [
    { id: 0, icon: '📖', label: 'Read the guide carefully', tip: 'Understanding is better than rushing!' },
    { id: 1, icon: '🔧', label: 'Build the circuit step by step', tip: 'Check each connection before moving on.' },
    { id: 2, icon: '▶️', label: 'Run the simulation', tip: 'If something doesn\'t work, check the mistake finder!' },
  ],
  mistakes: [],
})

// ─── Theme tokens ─────────────────────────────────────────────────────────────
function getT(theme) {
  const D = theme === 'dark'
  return {
    page:              D ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)',
    topbar:            D ? 'rgba(7,10,20,.97)'             : 'rgba(248,250,252,.97)',
    topbarBorder:      D ? 'rgba(255,255,255,.07)'         : 'rgba(0,0,0,.08)',
    heroBorder:        D ? 'rgba(255,255,255,.05)'         : 'rgba(0,0,0,.07)',
    textH:             D ? '#f0f4ff'                       : '#0f172a',
    text:              D ? '#e2e8f0'                       : '#1e293b',
    textMuted:         D ? '#94a3b8'                       : '#64748b',
    textDim:           D ? '#64748b'                       : '#94a3b8',
    textVDim:          D ? '#334155'                       : '#cbd5e1',
    emptyText:         D ? '#2d3f5e'                       : '#94a3b8',
    barTrack:          D ? 'rgba(255,255,255,.06)'         : 'rgba(0,0,0,.08)',
    dot:               D ? 'rgba(255,255,255,.1)'          : 'rgba(0,0,0,.12)',
    dotActive:         D ? '#fff'                          : '#475569',
    panelBg:           D ? 'rgba(255,255,255,.03)'         : 'rgba(0,0,0,.03)',
    panelBorder:       D ? 'rgba(255,255,255,.08)'         : 'rgba(0,0,0,.08)',
    cardBackBg:        D ? 'linear-gradient(145deg,#111e35,#0d1728)' : 'linear-gradient(145deg,#ffffff,#f1f5f9)',
    quizOptBg:         D ? 'rgba(255,255,255,.04)'         : 'rgba(0,0,0,.04)',
    quizOptBorder:     D ? 'rgba(255,255,255,.1)'          : 'rgba(0,0,0,.1)',
    boardBg:           D ? 'linear-gradient(135deg,#0a3020,#062015)' : 'linear-gradient(135deg,#ecfdf5,#d1fae5)',
    slotBg:            D ? 'rgba(255,255,255,.05)'         : 'rgba(0,0,0,.05)',
    slotBorder:        D ? 'rgba(255,255,255,.1)'          : 'rgba(0,0,0,.1)',
    lockedBg:          D ? 'linear-gradient(135deg,#150f25,#0f0b1c)' : 'linear-gradient(135deg,#faf5ff,#f5f0ff)',
    lockedHeaderBg:    D ? 'rgba(168,85,247,.1)'           : 'rgba(168,85,247,.08)',
    lockedHeaderBorder: D ? 'rgba(168,85,247,.15)'         : 'rgba(168,85,247,.12)',
    lockedSlotBg:      D ? 'rgba(255,255,255,.03)'         : 'rgba(0,0,0,.03)',
    lockedSlotBorder:  D ? 'rgba(255,255,255,.07)'         : 'rgba(0,0,0,.07)',
    emptyPanelBg:      D ? 'rgba(255,255,255,.02)'         : 'rgba(0,0,0,.02)',
    emptyPanelBorder:  D ? 'rgba(255,255,255,.07)'         : 'rgba(0,0,0,.08)',
    disabledBtnBg:     D ? 'rgba(255,255,255,.06)'         : 'rgba(0,0,0,.06)',
    disabledBtnBorder: D ? 'rgba(255,255,255,.1)'          : 'rgba(0,0,0,.1)',
    inputBg:           D ? 'rgba(255,255,255,.05)'         : 'rgba(0,0,0,.04)',
    inputBorder:       D ? 'rgba(255,255,255,.12)'         : 'rgba(0,0,0,.12)',
    combatBg:          D ? 'linear-gradient(135deg,#1a0f2e,#110c22)' : 'linear-gradient(135deg,#faf5ff,#f5f0ff)',
    combatDivider:     D ? 'rgba(255,255,255,.08)'         : 'rgba(0,0,0,.08)',
    combatSubText:     D ? '#475569'                       : '#94a3b8',
    wrongBannerText:   D ? '#cbd5e1'                       : '#475569',
    backBtnBg:         D ? 'rgba(255,255,255,.06)'         : 'rgba(0,0,0,.07)',
    backBtnBorder:     D ? 'rgba(255,255,255,.1)'          : 'rgba(0,0,0,.12)',
    backBtnColor:      D ? '#94a3b8'                       : '#64748b',
    tabBg:             D ? 'rgba(255,255,255,.04)'         : 'rgba(0,0,0,.04)',
    tabBorder:         D ? 'rgba(255,255,255,.07)'         : 'rgba(0,0,0,.08)',
    tabColor:          D ? '#475569'                       : '#94a3b8',
    toggleBorder:      D ? 'rgba(255,255,255,.1)'          : 'rgba(0,0,0,.12)',
    phaseDivider:      D ? '#1e2d45'                       : '#cbd5e1',
    phaseCrumbInactive: D ? 'rgba(255,255,255,.04)'        : 'rgba(0,0,0,.04)',
    phaseCrumbBorder:  D ? 'rgba(255,255,255,.06)'         : 'rgba(0,0,0,.07)',
    boardFooter:       D ? '#334155'                       : '#94a3b8',
    stepDot:           D ? 'rgba(255,255,255,.1)'          : 'rgba(0,0,0,.12)',
  }
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
  * { box-sizing: border-box; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes cardFlip { from { transform: rotateY(0); } to { transform: rotateY(180deg); } }
  @keyframes sparkle  { 0%,100% { transform:scale(1);   opacity:1; }  50% { transform:scale(1.15); opacity:.8; } }
  @keyframes pulse    { 0%,100% { box-shadow:0 4px 24px rgba(251,191,36,.35); } 50% { box-shadow:0 4px 44px rgba(251,191,36,.75); } }
  @keyframes stamp    { 0% { transform:scale(2) rotate(-12deg); opacity:0; } 100% { transform:scale(1) rotate(-12deg); opacity:1; } }
  @keyframes popIn    { 0% { transform:scale(.85); opacity:0; } 80% { transform:scale(1.04); } 100% { transform:scale(1); opacity:1; } }
  @keyframes shimmer  { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
  @keyframes shake    { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }

  .phase-tab:hover { opacity:.85; }
  .comp-slot:hover { transform:scale(1.04); }
  .step-row:hover  { background:rgba(255,255,255,.05) !important; }
  .mistake-btn:hover { opacity:.8; transform:translateY(-1px); }
  .quiz-opt:hover  { border-color:rgba(255,255,255,.3) !important; }
  .flip-card { perspective:1200px; }
  .flip-inner {
    position:relative; width:100%; height:100%;
    transition:transform .55s cubic-bezier(.45,0,.55,1);
    transform-style:preserve-3d;
  }
  .flip-inner.flipped { transform:rotateY(180deg); }
  .flip-face {
    position:absolute; inset:0;
    backface-visibility:hidden; -webkit-backface-visibility:hidden;
    border-radius:20px;
  }
  .flip-back { transform:rotateY(180deg); }

  ::-webkit-scrollbar { width:6px; }
  [data-theme="dark"]  ::-webkit-scrollbar-track { background:rgba(255,255,255,.03); }
  [data-theme="dark"]  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.12); border-radius:6px; }
  [data-theme="light"] ::-webkit-scrollbar-track { background:rgba(0,0,0,.03); }
  [data-theme="light"] ::-webkit-scrollbar-thumb { background:rgba(0,0,0,.15); border-radius:6px; }
`

// ─── FLASHCARD PHASE ─────────────────────────────────────────────────────────
function FlashcardPhase({ data, onDone, theme }) {
  const T = getT(theme)
  const [idx,       setIdx]      = useState(0)
  const [flipped,   setFlipped]  = useState(false)
  const [quizPick,  setQuizPick] = useState(null)
  const [done,      setDone]     = useState(new Set())
  const [allDone,   setAllDone]  = useState(false)
  const [shake,     setShake]    = useState(false)
  const [wrongMsg,  setWrongMsg] = useState(null)

  const card  = data.flashcards[idx]
  const total = data.flashcards.length

  const handleFlip = () => !flipped && setFlipped(true)

  const pickAnswer = (i) => {
    if (quizPick !== null) return
    setQuizPick(i)
    const isCorrect = i === card.quiz.ans

    if (isCorrect) {
      setTimeout(() => {
        const next = new Set([...done, idx])
        setDone(next)
        if (next.size >= total) { setAllDone(true); return }
        setIdx(n => n + 1)
        setFlipped(false)
        setQuizPick(null)
        setWrongMsg(null)
      }, 1100)
    } else {
      setShake(true)
      setWrongMsg(`Wrong! The correct answer is: "${card.quiz.opts[card.quiz.ans]}" — re-read the card and try again!`)
      setTimeout(() => setShake(false), 600)
      setTimeout(() => {
        setQuizPick(null)
      }, 1200)
    }
  }

  if (allDone) return (
    <div style={{ textAlign:'center', padding:'60px 20px', animation:'fadeUp .5s ease' }}>
      <div style={{ fontSize:80, marginBottom:12, animation:'sparkle 1s ease infinite' }}>🎉</div>
      <div style={{ fontSize:26, fontWeight:900, color:'#34d399', marginBottom:8 }}>
        You nailed all {total} cards!
      </div>
      <div style={{ color:T.textDim, fontSize:15, marginBottom:36 }}>
        You're ready to build! Let's grab your parts. 🎒
      </div>
      <button onClick={onDone} style={{
        background:'linear-gradient(135deg,#22c55e,#16a34a)',
        border:'none', borderRadius:14, padding:'16px 44px',
        fontSize:18, fontWeight:800, color:'#fff', cursor:'pointer',
        boxShadow:'0 4px 24px rgba(34,197,94,.45)', fontFamily:'Nunito,sans-serif',
        animation:'pulse 2s ease infinite',
      }}>🎒 Open Inventory →</button>
    </div>
  )

  const correct = card.quiz.ans

  return (
    <div style={{ animation:'fadeUp .35s ease' }}>
      {/* Progress */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:T.textMuted, marginBottom:7, fontWeight:700 }}>
          <span>📖 Card {idx + 1} of {total}</span>
          <span style={{ color:data.color }}>{Math.round((done.size/total)*100)}% complete</span>
        </div>
        <div style={{ height:7, borderRadius:99, background:T.barTrack, overflow:'hidden', marginBottom:10 }}>
          <div style={{ height:'100%', borderRadius:99, width:`${(done.size/total)*100}%`, background:data.color, transition:'width .5s ease' }} />
        </div>
        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
          {data.flashcards.map((_,i) => (
            <div key={i} style={{
              width:10, height:10, borderRadius:'50%', transition:'all .3s',
              background: done.has(i) ? data.color : i===idx ? T.dotActive : T.dot,
              transform: i===idx ? 'scale(1.3)' : 'scale(1)',
            }} />
          ))}
        </div>
      </div>

      {/* Flashcard */}
      <div className="flip-card" style={{ width:'100%', height:280, marginBottom:20 }}>
        <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
          {/* FRONT */}
          <div
            className="flip-face"
            onClick={handleFlip}
            style={{
              background:`linear-gradient(145deg,${data.color}18,${data.color}07)`,
              border:`2px solid ${data.color}45`,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              textAlign:'center', padding:32, cursor:flipped?'default':'pointer',
            }}
          >
            <div style={{ fontSize:64, marginBottom:14 }}>{card.emoji}</div>
            <div style={{ fontSize:21, fontWeight:900, color:T.textH, marginBottom:10 }}>{card.front}</div>
            <div style={{ fontSize:15, color:T.textMuted, lineHeight:1.65, maxWidth:480 }}>{card.simple}</div>
            {!flipped && (
              <div style={{ marginTop:20, fontSize:11, fontWeight:800, color:data.color, letterSpacing:'.08em',
                background:data.color+'18', padding:'5px 14px', borderRadius:20, border:`1px solid ${data.color}33` }}>
                TAP TO FLIP ▶
              </div>
            )}
          </div>

          {/* BACK */}
          <div className="flip-face flip-back" style={{
            background:T.cardBackBg,
            border:`2px solid ${data.color}45`,
            padding:28, overflow:'auto',
          }}>
            <div style={{ fontSize:12, fontWeight:800, color:data.color, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:14 }}>
              📚 Here's How It Works
            </div>
            <div style={{ fontSize:13, color:T.textMuted, lineHeight:1.85, marginBottom:16, whiteSpace:'pre-line', fontFamily:'monospace' }}>
              {card.detail}
            </div>
            <div style={{
              background:data.color+'14', border:`1px solid ${data.color}33`,
              borderRadius:10, padding:'10px 14px',
              fontSize:13, color:data.color, fontWeight:700, lineHeight:1.5,
            }}>{card.funFact}</div>
          </div>
        </div>
      </div>

      {/* Quiz (visible after flip) */}
      {flipped && (
        <div style={{
          background:T.panelBg, border:`1px solid ${T.panelBorder}`,
          borderRadius:16, padding:22, animation: shake ? 'shake .5s ease' : 'popIn .3s ease',
        }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.textH, marginBottom:14 }}>
            🤔 Quick Check: {card.quiz.q}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
            {card.quiz.opts.map((opt, i) => {
              const isCorrect  = i === card.quiz.ans
              const isPicked   = quizPick === i
              const showResult = quizPick !== null
              return (
                <button
                  key={i}
                  className="quiz-opt"
                  onClick={() => pickAnswer(i)}
                  style={{
                    padding:'12px 14px', borderRadius:11, cursor:(quizPick && !isPicked) ? 'default' : 'pointer',
                    border:`2px solid ${showResult && isCorrect && isPicked ? '#22c55e' : showResult && isPicked && !isCorrect ? '#ef4444' : T.quizOptBorder}`,
                    background: showResult && isCorrect && isPicked ? 'rgba(34,197,94,.14)' : showResult && isPicked && !isCorrect ? 'rgba(239,68,68,.14)' : T.quizOptBg,
                    color: showResult && isCorrect && isPicked ? '#34d399' : showResult && isPicked && !isCorrect ? '#f87171' : T.textMuted,
                    fontSize:13, fontWeight:700, textAlign:'left', fontFamily:'Nunito,sans-serif', lineHeight:1.4,
                    transition:'all .2s',
                  }}
                >
                  {showResult && isCorrect && isPicked ? '✅ ' : showResult && isPicked && !isCorrect ? '❌ ' : `${['A','B','C','D'][i]}. `}
                  {opt}
                </button>
              )
            })}
          </div>

          {wrongMsg && (
            <div style={{
              marginTop:14, padding:'12px 16px', borderRadius:10,
              background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.35)',
              color:'#f87171', fontSize:13, fontWeight:700, animation:'popIn .3s ease',
              display:'flex', alignItems:'flex-start', gap:8,
            }}>
              <span style={{ fontSize:18, flexShrink:0 }}>💡</span>
              <span>{wrongMsg} Try again!</span>
            </div>
          )}
        </div>
      )}

      {!flipped && (
        <div style={{ textAlign:'center', fontSize:13, color:T.textVDim, marginTop:8 }}>
          👆 Tap the card to reveal — then answer the mini quiz!
        </div>
      )}
    </div>
  )
}

// ─── INVENTORY PHASE ──────────────────────────────────────────────────────────
function InventoryPhase({ data, onDone, navigate, projectName, theme }) {
  const T = getT(theme)
  const [selected, setSelected] = useState(null)
  const [equipped, setEquipped] = useState(new Set())

  const selComp = selected
    ? [...data.starterKit, ...data.lockedRewards].find(c => c.id === selected)
    : null
  const isLocked = selComp && data.lockedRewards.some(r => r.id === selected)
  const allEquipped = data.starterKit.every(c => equipped.has(c.id))

  const toggleEquip = (id) => {
    const s = new Set(equipped)
    s.has(id) ? s.delete(id) : s.add(id)
    setEquipped(s)
  }

  const handleBuild = () => {
    navigate(`/${projectName}/assessment`, {
      state: {
        equippedComponents: [...equipped],
        projectName,
        fromGuide: true,
        projectColor: data.color,
      }
    })
  }

  return (
    <div style={{ animation:'fadeUp .35s ease' }}>
      <div style={{ marginBottom:22 }}>
        <h2 style={{ fontSize:24, fontWeight:900, color:T.textH, margin:'0 0 6px' }}>🎒 Your Workshop Inventory</h2>
        <p style={{ color:T.textDim, fontSize:14, margin:0 }}>Click parts to inspect them. Double-click to equip them to your workspace!</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:20 }}>

        {/* LEFT: board + slots */}
        <div>
          {/* Arduino board art */}
          <div style={{
            background:T.boardBg,
            border:'2px solid #22c55e44', borderRadius:18, padding:20, marginBottom:14,
            position:'relative', overflow:'hidden',
          }}>
            <div style={{
              position:'absolute', inset:0, opacity:.06,
              backgroundImage:'radial-gradient(circle, #22c55e 1px, transparent 1px)',
              backgroundSize:'18px 18px',
            }} />
            <div style={{ fontSize:11, fontWeight:800, color:'#22c55e', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:12 }}>
              🟩 Arduino Uno — Your Circuit Board
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {data.starterKit.map(comp => (
                <div
                  key={comp.id}
                  className="comp-slot"
                  onClick={() => setSelected(s => s === comp.id ? null : comp.id)}
                  onDoubleClick={() => toggleEquip(comp.id)}
                  style={{
                    background: selected===comp.id ? comp.color+'30' : equipped.has(comp.id) ? '#22c55e18' : T.slotBg,
                    border:`2px solid ${selected===comp.id ? comp.color : equipped.has(comp.id) ? '#22c55e55' : T.slotBorder}`,
                    borderRadius:12, padding:'12px 8px', textAlign:'center',
                    cursor:'pointer', transition:'all .2s', position:'relative',
                  }}
                >
                  {equipped.has(comp.id) && (
                    <div style={{ position:'absolute', top:3, right:5, fontSize:10, fontWeight:800, color:'#22c55e' }}>✓</div>
                  )}
                  <div style={{ fontSize:28, marginBottom:5 }}>{comp.icon}</div>
                  <div style={{ fontSize:10, fontWeight:800, color: selected===comp.id ? comp.color : T.textMuted, lineHeight:1.2 }}>{comp.name}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, color:T.boardFooter, marginTop:12, textAlign:'center' }}>
              Click = inspect · Double-click = equip to board
            </div>
          </div>

          {/* LOCKED section */}
          <div style={{
            background:T.lockedBg,
            border:`2px solid rgba(168,85,247,.2)`, borderRadius:18, overflow:'hidden',
          }}>
            <div style={{
              background:T.lockedHeaderBg, padding:'10px 16px',
              borderBottom:`1px solid ${T.lockedHeaderBorder}`,
              display:'flex', alignItems:'center', gap:8,
            }}>
              <span style={{ fontSize:16 }}>🔒</span>
              <span style={{ fontWeight:800, color:'#a855f7', fontSize:13, textTransform:'uppercase', letterSpacing:'.08em' }}>
                LOCKED — Complete to unlock!
              </span>
            </div>
            <div style={{ padding:14, display:'flex', gap:10, flexWrap:'wrap' }}>
              {data.lockedRewards.map(comp => (
                <div
                  key={comp.id}
                  className="comp-slot"
                  onClick={() => setSelected(s => s === comp.id ? null : comp.id)}
                  style={{
                    background: selected===comp.id ? 'rgba(168,85,247,.18)' : T.lockedSlotBg,
                    border:`2px solid ${selected===comp.id ? '#a855f7' : T.lockedSlotBorder}`,
                    borderRadius:12, padding:'12px 14px', cursor:'pointer',
                    textAlign:'center', filter:'grayscale(.65)',
                    transition:'all .2s', opacity:.7,
                  }}
                >
                  <div style={{ fontSize:28, marginBottom:5 }}>{comp.icon}</div>
                  <div style={{ fontSize:10, fontWeight:800, color:T.textDim }}>{comp.name}</div>
                  <div style={{ fontSize:9, color:T.textVDim, marginTop:3 }}>🔒 Locked</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: detail panel */}
        <div>
          {selComp ? (
            <div style={{
              background: isLocked
                ? 'linear-gradient(135deg,rgba(168,85,247,.12),rgba(168,85,247,.04))'
                : `linear-gradient(135deg,${selComp.color}18,${selComp.color}06)`,
              border:`2px solid ${isLocked ? '#a855f740' : selComp.color+'44'}`,
              borderRadius:18, padding:22, height:'100%',
              animation:'popIn .25s ease',
            }}>
              <div style={{ fontSize:52, textAlign:'center', marginBottom:14 }}>{selComp.icon}</div>
              <div style={{ fontSize:19, fontWeight:900, color:T.textH, marginBottom:8 }}>{selComp.name}</div>
              <div style={{ fontSize:13, color:T.textMuted, lineHeight:1.7, marginBottom:16 }}>{selComp.desc}</div>
              {isLocked ? (
                <div style={{
                  padding:'10px 12px', borderRadius:10,
                  background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)',
                  fontSize:12, color:'#f87171', fontWeight:700,
                }}>
                  🔒 Finish this project first to earn this part!
                </div>
              ) : (
                <button
                  onClick={() => toggleEquip(selComp.id)}
                  style={{
                    width:'100%', padding:'11px', borderRadius:10, border:'none',
                    background: equipped.has(selComp.id) ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)',
                    color: equipped.has(selComp.id) ? '#f87171' : '#34d399',
                    fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'Nunito,sans-serif',
                    border: `1px solid ${equipped.has(selComp.id) ? 'rgba(239,68,68,.35)' : 'rgba(34,197,94,.35)'}`,
                    transition:'all .2s',
                  }}
                >
                  {equipped.has(selComp.id) ? '✕ Remove from board' : '✓ Equip to board'}
                </button>
              )}
            </div>
          ) : (
            <div style={{
              background:T.emptyPanelBg, border:`1px dashed ${T.emptyPanelBorder}`,
              borderRadius:18, padding:24, height:'100%',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              textAlign:'center', color:T.emptyText,
            }}>
              <div style={{ fontSize:36, marginBottom:10, opacity:.4 }}>👆</div>
              <div style={{ fontSize:13 }}>Click any part to see what it does!</div>
            </div>
          )}
        </div>
      </div>

      {/* Equip progress bar */}
      <div style={{
        display:'flex', alignItems:'center', gap:14, marginBottom:16,
        background:T.panelBg, border:`1px solid ${T.panelBorder}`,
        borderRadius:12, padding:'12px 16px',
      }}>
        <div style={{ flex:1, height:7, borderRadius:99, background:T.barTrack, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:99,
            width:`${(equipped.size / data.starterKit.length) * 100}%`,
            background: allEquipped ? '#22c55e' : data.color, transition:'width .4s ease' }} />
        </div>
        <span style={{ fontSize:13, fontWeight:800, color: allEquipped ? '#22c55e' : data.color, flexShrink:0 }}>
          {equipped.size}/{data.starterKit.length} equipped {allEquipped ? '✓' : ''}
        </span>
      </div>

      <button
        onClick={allEquipped ? handleBuild : undefined}
        style={{
          width:'100%', background: allEquipped
            ? 'linear-gradient(135deg,#3b82f6,#2563eb)'
            : T.disabledBtnBg,
          border: allEquipped ? 'none' : `1px solid ${T.disabledBtnBorder}`,
          borderRadius:14, padding:'16px',
          fontSize:17, fontWeight:800,
          color: allEquipped ? '#fff' : T.textVDim,
          cursor: allEquipped ? 'pointer' : 'not-allowed',
          boxShadow: allEquipped ? '0 4px 24px rgba(59,130,246,.4)' : 'none',
          fontFamily:'Nunito,sans-serif', transition:'all .3s',
        }}
      >
        {allEquipped
          ? '🔨 All Equipped — Launch Simulator! →'
          : `🎒 Double-click parts to equip them (${data.starterKit.length - equipped.size} remaining)`}
      </button>
    </div>
  )
}

// ─── BUILD PHASE — CodeCombat Style ──────────────────────────────────────────
const STEP_CHECKS = {
  'led-blink': [
    null,
    null,
    {
      question: 'Which leg of the LED goes to the resistor/Pin 13?',
      opts: ['Short leg (−)', 'Either leg', 'Long leg (+)', 'No preference'],
      ans: 2,
      wrongExplain: 'The LONG leg (+) is the anode — it must connect to the resistor and Pin 13. The short leg goes to GND. If reversed, the LED won\'t light up at all!',
      rollbackTo: 1,
    },
    {
      question: 'What value resistor do you need with a standard LED at 5V?',
      opts: ['10Ω — very low', '220Ω — correct!', '10kΩ — too high', 'No resistor needed'],
      ans: 1,
      wrongExplain: 'You need a 220Ω resistor! Without it the LED gets ~40mA (double the safe 20mA) and burns out instantly. Color code: Red-Red-Brown.',
      rollbackTo: 2,
    },
    {
      question: 'Where does the GND wire from the LED short leg go?',
      opts: ['Pin 13', 'Any GND pin on Arduino', '5V pin', 'It doesn\'t need GND'],
      ans: 1,
      wrongExplain: 'Electricity needs a complete loop! The short leg (−) must connect to a GND pin on the Arduino to complete the circuit.',
      rollbackTo: 3,
    },
    {
      question: 'In the blink code, what does delay(1000) do?',
      opts: ['Blink 1000 times', 'Wait 1000 minutes', 'Wait 1 second (1000ms)', 'Set speed to 1000'],
      ans: 2,
      wrongExplain: 'delay(1000) pauses the code for 1000 milliseconds = 1 second. So the LED stays ON 1s, then OFF 1s, forever in loop().',
      rollbackTo: 4,
    },
    null,
  ],
}

function BuildPhase({ data, projectName, navigate, onProjectComplete, theme }) {
  const T = getT(theme)
  const [currentStep,  setCurrentStep]  = useState(0)
  const [completed,    setCompleted]    = useState(false)
  const [combat,       setCombat]       = useState(null)
  const [combatPick,   setCombatPick]   = useState(null)
  const [shake,        setShake]        = useState(false)
  const [wrongBanner,  setWrongBanner]  = useState(null)
  const [rollbackAnim, setRollbackAnim] = useState(false)

  const totalSteps  = data.buildSteps.length
  const checks      = STEP_CHECKS[projectName] || []
  const progressPct = Math.round((currentStep / totalSteps) * 100)

  const advanceStep = (stepId) => {
    const check = checks[stepId]
    if (check) {
      setCombat({ ...check, stepId })
      setCombatPick(null)
      setWrongBanner(null)
    } else {
      const next = stepId + 1
      if (next >= totalSteps) finishBuild()
      else setCurrentStep(next)
    }
  }

  const finishBuild = () => {
    setCompleted(true)
    onProjectComplete?.()
  }

  const pickCombatAnswer = (i) => {
    if (combatPick !== null) return
    setCombatPick(i)
    const isCorrect = i === combat.ans

    if (isCorrect) {
      setTimeout(() => {
        setCombat(null)
        setCombatPick(null)
        setWrongBanner(null)
        const next = combat.stepId + 1
        if (next >= totalSteps) finishBuild()
        else setCurrentStep(next)
      }, 900)
    } else {
      setShake(true)
      setWrongBanner(combat.wrongExplain)
      setTimeout(() => setShake(false), 600)
      setTimeout(() => {
        setCombatPick(null)
        setCombat(null)
        setRollbackAnim(true)
        setCurrentStep(combat.rollbackTo)
        setTimeout(() => setRollbackAnim(false), 800)
      }, 3200)
    }
  }

  if (completed) return (
    <div style={{ textAlign:'center', padding:'60px 20px', animation:'fadeUp .5s ease' }}>
      <div style={{ fontSize:80, marginBottom:16 }}>🏆</div>
      <div style={{ fontSize:28, fontWeight:900, margin:'0 0 8px',
        background:'linear-gradient(135deg,#fbbf24,#f97316)',
        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
        Project Complete! +{data.xpReward} XP
      </div>
      <div style={{ color:T.textDim, fontSize:15, marginBottom:12 }}>
        You just unlocked new components for your inventory! 🎁
      </div>
      <div style={{ display:'flex', gap:12, justifyContent:'center', marginBottom:36, flexWrap:'wrap' }}>
        {data.lockedRewards.map(r => (
          <div key={r.id} style={{
            padding:'10px 18px', borderRadius:12,
            background:`${r.color}18`, border:`2px solid ${r.color}40`,
            fontSize:14, fontWeight:800, color:r.color, animation:'popIn .4s ease',
          }}>
            {r.icon} {r.name} Unlocked!
          </div>
        ))}
      </div>
      <button onClick={() => navigate('/adventure')} style={{
        background:'linear-gradient(135deg,#22c55e,#16a34a)',
        border:'none', borderRadius:14, padding:'16px 44px',
        fontSize:18, fontWeight:800, color:'#fff', cursor:'pointer',
        boxShadow:'0 4px 24px rgba(34,197,94,.45)', fontFamily:'Nunito,sans-serif',
      }}>🗺️ Back to Adventure Map →</button>
    </div>
  )

  const step = data.buildSteps[currentStep]

  return (
    <div style={{ animation: rollbackAnim ? 'shake .5s ease' : 'fadeUp .35s ease' }}>
      <h2 style={{ fontSize:22, fontWeight:900, color:T.textH, margin:'0 0 6px' }}>🔨 Build Your Circuit</h2>
      <p style={{ color:T.textDim, fontSize:14, marginBottom:20 }}>
        Complete each step — a quick quiz unlocks the next one! ⚔️
      </p>

      {/* Progress bar */}
      <div style={{
        display:'flex', alignItems:'center', gap:14, marginBottom:24,
        background:T.panelBg, border:`1px solid ${T.panelBorder}`,
        borderRadius:12, padding:'12px 16px',
      }}>
        <div style={{ flex:1, height:8, borderRadius:99, background:T.barTrack, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:99, width:`${progressPct}%`,
            background:data.color, transition:'width .5s ease' }} />
        </div>
        <span style={{ fontSize:13, fontWeight:800, color:data.color, flexShrink:0 }}>
          Step {currentStep + 1} / {totalSteps}
        </span>
      </div>

      {/* Step breadcrumb dots */}
      <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:28 }}>
        {data.buildSteps.map((_,i) => (
          <div key={i} style={{
            width: i === currentStep ? 24 : 10,
            height:10, borderRadius:99, transition:'all .3s',
            background: i < currentStep ? '#22c55e' : i === currentStep ? data.color : T.stepDot,
          }} />
        ))}
      </div>

      {/* Current step card */}
      <div style={{
        background:`linear-gradient(135deg,${data.color}12,${data.color}04)`,
        border:`2px solid ${data.color}44`,
        borderRadius:20, padding:28, marginBottom:20,
        animation:'popIn .3s ease',
      }}>
        <div style={{ fontSize:48, textAlign:'center', marginBottom:16 }}>{step.icon}</div>
        <div style={{ fontSize:20, fontWeight:900, color:T.textH, textAlign:'center', marginBottom:10, lineHeight:1.3 }}>
          {step.label}
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:8, justifyContent:'center',
          padding:'10px 16px', borderRadius:10,
          background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.2)',
          fontSize:13, color:'#fbbf24', fontWeight:700,
        }}>
          💡 {step.tip}
        </div>
      </div>

      {/* Open Simulator button */}
      <button
        onClick={() => navigate(`/${projectName}/assessment`, { state: { projectName, projectColor: data.color } })}
        style={{
          width:'100%', marginBottom:16,
          background:'linear-gradient(135deg,#1d4ed8,#2563eb)',
          border:'none', borderRadius:14, padding:'14px',
          fontSize:15, fontWeight:800, color:'#fff', cursor:'pointer',
          boxShadow:'0 4px 20px rgba(59,130,246,.35)', fontFamily:'Nunito,sans-serif',
        }}
      >▶ Open Guided Simulator for This Step</button>

      {/* Advance button */}
      {!combat && (
        <button
          onClick={() => advanceStep(currentStep)}
          style={{
            width:'100%',
            background:'linear-gradient(135deg,#22c55e,#16a34a)',
            border:'none', borderRadius:14, padding:'15px',
            fontSize:16, fontWeight:800, color:'#fff', cursor:'pointer',
            fontFamily:'Nunito,sans-serif',
            boxShadow:'0 4px 20px rgba(34,197,94,.35)',
          }}
        >
          {currentStep === totalSteps - 1 ? '🏆 Complete & Earn XP →' : '✓ Done — Next Step ⚔️'}
        </button>
      )}

      {/* COMBAT CHECK MODAL */}
      {combat && (
        <div style={{
          marginTop:20,
          background:T.combatBg,
          border:`2px solid ${data.color}60`,
          borderRadius:20, padding:24,
          animation: shake ? 'shake .5s ease' : 'popIn .3s ease',
          boxShadow:`0 8px 40px ${data.color}22`,
        }}>
          <div style={{
            display:'flex', alignItems:'center', gap:10, marginBottom:18,
            paddingBottom:14, borderBottom:`1px solid ${T.combatDivider}`,
          }}>
            <div style={{ fontSize:28 }}>⚔️</div>
            <div>
              <div style={{ fontSize:13, fontWeight:900, color:data.color, letterSpacing:'.08em', textTransform:'uppercase' }}>
                Knowledge Check!
              </div>
              <div style={{ fontSize:11, color:T.combatSubText, fontWeight:700 }}>
                Answer correctly to unlock the next step
              </div>
            </div>
            <div style={{ marginLeft:'auto', fontSize:22 }}>🧠</div>
          </div>

          <div style={{ fontSize:16, fontWeight:800, color:T.textH, marginBottom:16, lineHeight:1.4 }}>
            {combat.question}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {combat.opts.map((opt, i) => {
              const isPicked   = combatPick === i
              const isCorrect  = i === combat.ans
              const showResult = combatPick !== null
              return (
                <button
                  key={i}
                  onClick={() => pickCombatAnswer(i)}
                  style={{
                    padding:'13px 14px', borderRadius:12,
                    cursor: combatPick !== null ? 'default' : 'pointer',
                    border:`2px solid ${showResult && isCorrect && isPicked ? '#22c55e' : showResult && isPicked && !isCorrect ? '#ef4444' : `${data.color}30`}`,
                    background: showResult && isCorrect && isPicked ? 'rgba(34,197,94,.18)' : showResult && isPicked && !isCorrect ? 'rgba(239,68,68,.18)' : `${data.color}0a`,
                    color: showResult && isCorrect && isPicked ? '#34d399' : showResult && isPicked && !isCorrect ? '#f87171' : T.textMuted,
                    fontSize:13, fontWeight:700, textAlign:'left', fontFamily:'Nunito,sans-serif', lineHeight:1.4,
                    transition:'all .2s',
                  }}
                >
                  {showResult && isCorrect && isPicked ? '✅ ' : showResult && isPicked && !isCorrect ? '❌ ' : `${['A','B','C','D'][i]}. `}
                  {opt}
                </button>
              )
            })}
          </div>

          {wrongBanner && (
            <div style={{
              marginTop:16, padding:'14px 18px', borderRadius:12,
              background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.35)',
              animation:'popIn .3s ease',
            }}>
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <span style={{ fontSize:22, flexShrink:0 }}>💥</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#f87171', marginBottom:6 }}>
                    Wrong! Rolling back to previous step...
                  </div>
                  <div style={{ fontSize:13, color:T.wrongBannerText, lineHeight:1.6 }}>
                    {wrongBanner}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mistake finder */}
      {data.mistakes?.length > 0 && !combat && (
        <MistakeFinder data={data} theme={theme} />
      )}
    </div>
  )
}

function MistakeFinder({ data, theme }) {
  const T = getT(theme)
  const [query,   setQuery]   = useState('')
  const [mistake, setMistake] = useState(null)

  const searchMistake = (q) => {
    setQuery(q)
    if (!q.trim()) { setMistake(null); return }
    const lower = q.toLowerCase()
    const found = data.mistakes.find(m => m.trigger.some(t => lower.includes(t)))
    setMistake(found || null)
  }

  return (
    <div style={{
      background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)',
      borderRadius:16, padding:20, marginTop:20,
    }}>
      <div style={{ fontSize:14, fontWeight:800, color:'#f87171', marginBottom:10 }}>
        🆘 Something not working? Type your problem:
      </div>
      <input
        value={query}
        onChange={e => searchMistake(e.target.value)}
        placeholder='"led not working", "led burned", "wrong pin", "no ground"...'
        style={{
          width:'100%', padding:'11px 14px', borderRadius:10,
          background:T.inputBg, border:`1px solid ${T.inputBorder}`,
          color:T.text, fontSize:13, outline:'none', fontFamily:'Nunito,sans-serif',
        }}
      />
      {!query && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          {data.mistakes.map(m => (
            <button key={m.id} className="mistake-btn"
              onClick={() => searchMistake(m.trigger[0])}
              style={{
                background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)',
                borderRadius:8, padding:'6px 12px', color:'#f87171',
                fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif',
              }}>{m.emoji} {m.title}</button>
          ))}
        </div>
      )}
      {query.length > 2 && (
        <div style={{ marginTop:14, animation:'popIn .3s ease' }}>
          {mistake ? (
            <div style={{
              background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.3)',
              borderRadius:12, padding:18,
            }}>
              <div style={{ fontSize:32, marginBottom:8 }}>{mistake.emoji}</div>
              <div style={{ fontSize:16, fontWeight:800, color:'#fbbf24', marginBottom:6 }}>{mistake.title}</div>
              <div style={{ fontSize:13, color:T.textMuted, marginBottom:12 }}>❌ <strong>Problem:</strong> {mistake.problem}</div>
              <div style={{ background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.25)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#34d399', fontWeight:700 }}>
                ✅ <strong>Fix:</strong> {mistake.fix}
              </div>
            </div>
          ) : (
            <div style={{ fontSize:13, color:T.textMuted, padding:'10px 4px' }}>
              🤷 No specific fix found. Try the quick buttons above, or ask your teacher!
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function GamifiedProjectGuidePage() {
  const navigate    = useNavigate()
  const { projectName = '' } = useParams()
  const gamification = useGamification?.() || {}
  const { xp = 0, coins = 0, completedProjects = [], completeProject } = gamification

  const data       = PROJECT_DATA[projectName] || makeDefaultData(projectName)
  const isFinished = completedProjects.includes(projectName)
  const [phase,    setPhase]    = useState(isFinished ? 2 : 0)

  // ── Read initial theme from document (set by LandingPage) ──
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')
  const T = getT(theme)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    // Keep document in sync so every page sees the same choice
    document.documentElement.setAttribute('data-theme', next)
  }

  const phases = [
    { icon:'📖', label:'Learn',     desc:'Flashcards' },
    { icon:'🎒', label:'Inventory', desc:'Parts'      },
    { icon:'🔨', label:'Build',     desc:'Circuit'    },
  ]

  const handleComplete = () => {
    completeProject?.(projectName, data.xpReward)
  }

  return (
    <div style={{
      minHeight:'100vh',
      background:T.page,
      color:T.text,
      fontFamily:'Nunito,system-ui,sans-serif',
      overflowX:'hidden',
    }}>
      <style>{css}</style>

      {/* ── Top Bar ── */}
      <div style={{
        position:'sticky', top:0, zIndex:200,
        background:T.topbar, backdropFilter:'blur(18px)',
        borderBottom:`1px solid ${T.topbarBorder}`,
        padding:'0 16px',
      }}>
        <div style={{
          maxWidth:860, margin:'0 auto',
          display:'flex', alignItems:'center', gap:12, height:56,
        }}>
          <button onClick={() => navigate('/adventure')} style={{
            background:T.backBtnBg, border:`1px solid ${T.backBtnBorder}`,
            borderRadius:8, padding:'6px 12px', color:T.backBtnColor, cursor:'pointer',
            fontSize:12, fontWeight:800, fontFamily:'Nunito,sans-serif', flexShrink:0,
          }}>← Map</button>

          {/* Phase tabs */}
          <div style={{
            flex:1, display:'flex', background:T.tabBg,
            borderRadius:10, overflow:'hidden', border:`1px solid ${T.tabBorder}`,
          }}>
            {phases.map((p,i) => {
              const active   = phase === i
              const unlocked = i <= phase
              return (
                <button
                  key={i}
                  className="phase-tab"
                  onClick={() => unlocked && setPhase(i)}
                  style={{
                    flex:1, display:'flex', flexDirection:'column', alignItems:'center',
                    padding:'7px 4px', border:'none', fontFamily:'Nunito,sans-serif',
                    background: active ? data.color+'22' : 'transparent',
                    borderRight:`1px solid ${T.tabBorder}`,
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                    opacity: unlocked ? 1 : .35,
                    transition:'all .2s',
                    color: active ? data.color : T.tabColor,
                  }}
                >
                  <span style={{ fontSize:15 }}>{p.icon}</span>
                  <span style={{ fontSize:11, fontWeight:800 }}>{p.label}</span>
                  <span style={{ fontSize:9, opacity:.55 }}>{p.desc}</span>
                </button>
              )
            })}
          </div>

          {/* Stats */}
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <div style={{
              padding:'5px 10px', borderRadius:8,
              background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.2)',
              fontSize:12, fontWeight:800, color:'#fbbf24',
            }}>⭐ {xp}</div>
            <div style={{
              padding:'5px 10px', borderRadius:8,
              background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.2)',
              fontSize:12, fontWeight:800, color:'#f59e0b',
            }}>🪙 {coins}</div>
          </div>

          <button onClick={toggleTheme} style={{
            background:'transparent', border:`1px solid ${T.toggleBorder}`,
            borderRadius:8, padding:'5px 10px', color:T.tabColor,
            cursor:'pointer', fontSize:12, fontFamily:'Nunito,sans-serif',
          }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
        </div>
      </div>

      {/* ── Hero Banner ── */}
      <div style={{
        background:`linear-gradient(135deg,${data.color}14,transparent 70%)`,
        borderBottom:`1px solid ${T.heroBorder}`,
        padding:'18px 16px',
      }}>
        <div style={{ maxWidth:860, margin:'0 auto', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{
            width:60, height:60, borderRadius:16, flexShrink:0,
            background:`${data.color}20`, border:`2px solid ${data.color}44`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:32,
          }}>{data.icon}</div>
          <div>
            <div style={{ fontSize:11, fontWeight:800, color:data.color, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:4 }}>
              {data.board} · Project Guide
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:T.textH }}>{data.title}</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
            {isFinished && (
              <div style={{
                padding:'5px 12px', borderRadius:8,
                background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.3)',
                color:'#34d399', fontSize:12, fontWeight:800, animation:'stamp .4s ease',
              }}>✅ Done!</div>
            )}
            <div style={{ fontSize:12, color:T.textVDim, fontWeight:700 }}>
              Reward: <span style={{ color:'#fbbf24' }}>+{data.xpReward} XP</span>
            </div>
          </div>
        </div>

        {/* Phase progress breadcrumb */}
        <div style={{ maxWidth:860, margin:'12px auto 0', display:'flex', alignItems:'center', gap:6 }}>
          {phases.map((p,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{
                fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:20,
                background: phase>i ? '#22c55e18' : phase===i ? `${data.color}22` : T.phaseCrumbInactive,
                color: phase>i ? '#34d399' : phase===i ? data.color : T.textVDim,
                border:`1px solid ${phase>i ? '#22c55e33' : phase===i ? data.color+'33' : T.phaseCrumbBorder}`,
              }}>
                {phase>i ? '✓ ' : ''}{p.icon} {p.label}
              </div>
              {i < phases.length-1 && <div style={{ color:T.phaseDivider, fontSize:12 }}>›</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 16px 100px' }}>
        {phase === 0 && (
          <FlashcardPhase data={data} onDone={() => setPhase(1)} theme={theme} />
        )}
        {phase === 1 && (
          <InventoryPhase
            data={data}
            navigate={navigate}
            projectName={projectName}
            onDone={() => setPhase(2)}
            theme={theme}
          />
        )}
        {phase === 2 && (
          <BuildPhase
            data={data}
            projectName={projectName}
            navigate={navigate}
            onProjectComplete={handleComplete}
            theme={theme}
          />
        )}
      </div>
    </div>
  )
}