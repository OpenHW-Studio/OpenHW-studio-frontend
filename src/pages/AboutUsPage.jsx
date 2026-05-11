import { useState, useEffect, useRef } from "react";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;0,9..144,900;1,9..144,300;1,9..144,700&family=Epilogue:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap";

const CSS = `
@import url('${FONTS}');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --ink:     #0E0D0C;
  --ink-2:   #3A3835;
  --ink-3:   #8C877E;
  --paper:   #F6F3EE;
  --paper-2: #EDEAD3;
  --white:   #FDFCFA;
  --rule:    #DDD9CF;

  --blue:    #1744CC;
  --blue-p:  #E7ECFA;
  --amber:   #B86C08;
  --amber-p: #FAF2E5;
  --green:   #15663C;
  --green-p: #E2F0EA;
  --plum:    #5B2888;
  --plum-p:  #EFE8F7;
  --rose:    #B02540;
  --rose-p:  #FAE8EC;
  --teal:    #0A7C78;
  --teal-p:  #E2F2F1;

  --fd:'Fraunces',Georgia,serif;
  --fb:'Epilogue',system-ui,sans-serif;
  --fm:'DM Mono','Courier New',monospace;
}

html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
body{background:var(--paper);color:var(--ink);font-family:var(--fb)}

@keyframes rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@keyframes pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes widen{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}

.rise{opacity:0;animation:rise .75s cubic-bezier(.22,1,.36,1) forwards}
.pop {opacity:0;animation:pop  .6s  cubic-bezier(.22,1,.36,1) forwards}
.d1{animation-delay:.1s}.d2{animation-delay:.22s}.d3{animation-delay:.34s}
.d4{animation-delay:.46s}.d5{animation-delay:.58s}.d6{animation-delay:.7s}

/* ── NAV ── */
.nav{
  position:sticky;top:0;z-index:200;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 64px;height:62px;
  background:rgba(246,243,238,.94);
  backdrop-filter:blur(14px);
  border-bottom:1px solid var(--rule);
}
.nav-mark{
  font-family:var(--fd);font-size:1.1rem;font-weight:700;
  letter-spacing:-.02em;color:var(--ink);text-decoration:none;
}
.nav-mark em{font-style:normal;color:var(--blue)}
.nav-right{display:flex;align-items:center;gap:20px}
.nav-live{
  display:flex;align-items:center;gap:7px;
  font-family:var(--fm);font-size:.6rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--green);
}
.nav-live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:blink 2s ease infinite}
.nav-chip{
  font-family:var(--fm);font-size:.6rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink-3);
  border:1px solid var(--rule);padding:5px 12px;border-radius:4px;
}

/* ── HERO ── */
.hero{
  min-height:calc(100vh - 62px);
  padding:110px 64px 90px;
  display:grid;grid-template-columns:1fr 340px;gap:80px;align-items:end;
  border-bottom:1px solid var(--rule);
  background:var(--white);position:relative;overflow:hidden;
}
.hero-watermark{
  position:absolute;right:-40px;bottom:-60px;
  font-family:var(--fd);font-size:38vw;font-weight:900;
  color:var(--paper);line-height:1;
  pointer-events:none;user-select:none;z-index:0;
}
.hero-l{position:relative;z-index:1}
.hero-eye{
  display:inline-flex;align-items:center;gap:10px;
  font-family:var(--fm);font-size:.6rem;letter-spacing:.18em;
  text-transform:uppercase;color:var(--blue);margin-bottom:34px;
}
.hero-eye-line{
  display:inline-block;width:30px;height:1.5px;background:var(--blue);
  transform-origin:left;animation:widen .5s cubic-bezier(.22,1,.36,1) .25s both;
}
.hero-h1{
  font-family:var(--fd);
  font-size:clamp(3.8rem,6.8vw,7.8rem);
  font-weight:900;letter-spacing:-.045em;line-height:.9;
  color:var(--ink);margin-bottom:38px;
}
.hero-h1 .lt{font-style:italic;font-weight:300;color:var(--ink-2)}
.hero-p{
  font-size:1.05rem;font-weight:300;color:var(--ink-2);line-height:1.82;
  max-width:510px;border-top:1px solid var(--rule);padding-top:26px;
}
.hero-r{
  position:relative;z-index:1;
  display:flex;flex-direction:column;gap:0;
  border-left:1px solid var(--rule);padding-left:44px;
}
.hero-stat{padding:26px 0;border-bottom:1px solid var(--rule)}
.hero-stat:first-child{padding-top:0}
.hero-stat:last-child{border-bottom:none;padding-bottom:0}
.hero-stat-n{
  font-family:var(--fd);font-size:3.6rem;font-weight:700;
  letter-spacing:-.045em;line-height:1;
}
.hero-stat-l{
  font-family:var(--fm);font-size:.58rem;letter-spacing:.16em;
  text-transform:uppercase;color:var(--ink-3);margin-top:6px;
}

/* ── BAND ── */
.band{background:var(--ink);padding:96px 64px}
.band-inner{max-width:1140px;margin:0 auto}
.band-label{
  font-family:var(--fm);font-size:.58rem;letter-spacing:.22em;
  text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:32px;
}
.band-q{
  font-family:var(--fd);
  font-size:clamp(1.9rem,3.8vw,3.8rem);
  font-weight:300;font-style:italic;line-height:1.22;
  letter-spacing:-.02em;color:var(--white);max-width:880px;
}
.band-q strong{font-style:normal;font-weight:700}

/* ── SECTION ── */
.sec{padding:96px 64px}
.si{max-width:1140px;margin:0 auto}

.sec-head{
  display:grid;grid-template-columns:180px 1fr;gap:56px;
  padding-bottom:56px;border-bottom:1px solid var(--rule);margin-bottom:56px;
}
.sec-idx{
  font-family:var(--fm);font-size:.58rem;letter-spacing:.2em;
  text-transform:uppercase;color:var(--ink-3);padding-top:5px;
}
.sec-h{
  font-family:var(--fd);
  font-size:clamp(2.2rem,3.6vw,3.6rem);
  font-weight:700;letter-spacing:-.035em;line-height:1.05;color:var(--ink);
}
.sec-h em{font-style:italic;font-weight:300}
.sec-sub{
  font-size:.95rem;font-weight:300;color:var(--ink-2);
  line-height:1.82;margin-top:14px;max-width:580px;
}

/* ── WHAT WE BUILT ── */
.what-bg{background:var(--white)}
.what-grid{
  display:grid;grid-template-columns:repeat(3,1fr);
  gap:1px;background:var(--rule);
  border:1px solid var(--rule);border-radius:16px;overflow:hidden;
}
.what-card{
  background:var(--white);padding:40px 32px;
  display:flex;flex-direction:column;gap:18px;
  position:relative;overflow:hidden;cursor:default;
  transition:background .22s ease;
}
.what-card:hover{background:var(--paper)}
.what-bar{
  position:absolute;top:0;left:0;right:0;height:3px;
  transform:scaleX(0);transform-origin:left;
  transition:transform .35s cubic-bezier(.22,1,.36,1);
}
.what-card:hover .what-bar{transform:scaleX(1)}
.what-n{font-family:var(--fm);font-size:.58rem;letter-spacing:.16em;text-transform:uppercase}
.what-t{font-family:var(--fd);font-size:1.35rem;font-weight:700;letter-spacing:-.025em;line-height:1.15}
.what-b{font-size:.86rem;font-weight:300;color:var(--ink-2);line-height:1.78}
.what-foot{
  margin-top:auto;font-family:var(--fm);font-size:.56rem;
  letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);
  border-top:1px solid var(--rule);padding-top:18px;
}

/* ── WHO ITS FOR ── */
.for-bg{background:var(--paper)}
.for-tabs{
  display:flex;gap:0;border:1px solid var(--rule);
  border-radius:10px;overflow:hidden;margin-bottom:32px;background:var(--white);
}
.for-tab{
  flex:1;padding:14px 18px;
  font-family:var(--fm);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-3);background:transparent;border:none;border-right:1px solid var(--rule);
  cursor:pointer;transition:all .2s ease;text-align:left;
}
.for-tab:last-child{border-right:none}
.for-tab:hover{color:var(--ink);background:var(--paper)}
.for-tab.on{color:#fff}
.for-panel{
  display:grid;grid-template-columns:1fr 1fr;gap:0;
  background:var(--white);border:1px solid var(--rule);
  border-radius:14px;overflow:hidden;
  animation:pop .38s cubic-bezier(.22,1,.36,1) both;
}
.for-left{padding:48px}
.for-ptag{font-family:var(--fm);font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;margin-bottom:14px}
.for-ph{font-family:var(--fd);font-size:2.2rem;font-weight:700;letter-spacing:-.04em;line-height:1.05;margin-bottom:14px}
.for-pdesc{font-size:.9rem;font-weight:300;color:var(--ink-2);line-height:1.82}
.for-right{border-left:1px solid var(--rule);padding:48px}
.for-rlabel{font-family:var(--fm);font-size:.56rem;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);margin-bottom:18px}
.for-list{display:flex;flex-direction:column}
.for-item{
  display:flex;align-items:center;gap:12px;
  padding:12px 0;border-bottom:1px solid var(--rule);
  font-size:.86rem;color:var(--ink-2);
}
.for-item:last-child{border-bottom:none}
.for-item.off{opacity:.3}
.for-ico{
  width:22px;height:22px;border-radius:6px;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;font-size:.65rem;
}

/* ── HARDWARE ── */
.hw-bg{background:var(--white)}
.hw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.hw-card{
  border-radius:14px;border:1.5px solid var(--rule);padding:36px 28px;
  display:flex;flex-direction:column;gap:22px;cursor:default;
  transition:transform .25s,box-shadow .25s;
}
.hw-card:hover{transform:translateY(-5px);box-shadow:0 18px 44px rgba(0,0,0,.07)}
.hw-top{display:flex;align-items:center;justify-content:space-between}
.hw-phase-l{font-family:var(--fm);font-size:.56rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3)}
.hw-badge{font-family:var(--fm);font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;padding:4px 10px;border-radius:20px;font-weight:500}
.hw-num{font-family:var(--fd);font-size:5rem;font-weight:900;letter-spacing:-.06em;line-height:1}
.hw-boards{display:flex;flex-direction:column;gap:9px}
.hw-board{
  display:flex;align-items:center;gap:9px;
  padding:13px 14px;border-radius:9px;background:var(--paper);
  font-size:.84rem;font-weight:500;
}
.hw-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.hw-sub{font-family:var(--fm);font-size:.53rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin-left:auto}

/* ── APPROACH ── */
.ap-bg{background:var(--paper-2)}
.ap-list{display:flex;flex-direction:column}
.ap-item{
  display:grid;grid-template-columns:60px 1fr 1fr;gap:40px;
  padding:44px 0;border-bottom:1px solid var(--rule);align-items:start;
}
.ap-item:first-child{border-top:1px solid var(--rule)}
.ap-num{font-family:var(--fm);font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);padding-top:5px}
.ap-t{font-family:var(--fd);font-size:clamp(1.5rem,2.2vw,2rem);font-weight:700;letter-spacing:-.03em;line-height:1.1}
.ap-b{font-size:.88rem;font-weight:300;color:var(--ink-2);line-height:1.82}

/* ── MARQUEE ── */
.mq-wrap{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);background:var(--ink);padding:16px 0;overflow:hidden}
.mq-track{display:flex;width:max-content;animation:mq 30s linear infinite}
.mq-item{
  display:flex;align-items:center;gap:16px;padding:0 32px;
  font-family:var(--fd);font-size:.9rem;font-weight:700;
  letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;
  color:rgba(255,255,255,.38);
}
.mq-dot{width:4px;height:4px;border-radius:50%}

/* ── CONTRIBUTORS ── */
.contrib-bg{background:var(--white)}

/* LEAD CARDS (2 founders) */
.lead-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.lead-card{
  border-radius:16px;border:1.5px solid var(--rule);overflow:hidden;
  transition:transform .26s,box-shadow .26s,border-color .26s;cursor:default;
}
.lead-card:hover{transform:translateY(-4px);box-shadow:0 20px 48px rgba(0,0,0,.08);border-color:#C5C0B8}
.lead-banner{height:100px;position:relative;display:flex;align-items:flex-end;padding:20px 36px}
.lead-initials{
  position:absolute;right:28px;bottom:-14px;
  font-family:var(--fd);font-size:3.6rem;font-weight:900;
  letter-spacing:-.06em;line-height:1;
  color:rgba(255,255,255,.15);pointer-events:none;user-select:none;
}
.lead-body{padding:28px 36px 32px}
.lead-name{font-family:var(--fd);font-size:1.8rem;font-weight:700;letter-spacing:-.04em;line-height:1;margin-bottom:6px}
.lead-handle{font-family:var(--fm);font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin-bottom:20px}
.lead-role-pill{
  display:inline-block;font-family:var(--fm);font-size:.56rem;
  letter-spacing:.12em;text-transform:uppercase;
  padding:5px 12px;border-radius:20px;margin-bottom:20px;
}
.lead-gh{
  display:inline-flex;align-items:center;gap:7px;text-decoration:none;
  font-family:var(--fm);font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink);padding:11px 18px;border-radius:8px;
  border:1px solid var(--rule);background:var(--paper);
  transition:all .2s ease;
}
.lead-gh:hover{background:var(--ink);color:#fff;border-color:var(--ink)}
.lead-gh svg{width:13px;height:13px;flex-shrink:0}

/* TEAM GRID (remaining contributors) */
.team-label{
  font-family:var(--fm);font-size:.58rem;letter-spacing:.2em;
  text-transform:uppercase;color:var(--ink-3);
  margin-bottom:20px;padding-top:16px;
}
.team-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.team-card{
  border-radius:12px;border:1px solid var(--rule);
  padding:24px 20px;
  display:flex;flex-direction:column;gap:12px;
  transition:transform .22s,box-shadow .22s,border-color .22s,background .22s;
  cursor:default;
  position:relative;overflow:hidden;
}
.team-card:hover{
  transform:translateY(-3px);
  box-shadow:0 12px 32px rgba(0,0,0,.07);
  border-color:#C5C0B8;background:var(--paper);
}
.team-card-top-bar{position:absolute;top:0;left:0;right:0;height:3px}
.team-av{
  width:40px;height:40px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  font-family:var(--fd);font-size:1rem;font-weight:700;letter-spacing:-.02em;
  color:rgba(255,255,255,.9);flex-shrink:0;
}
.team-name{font-family:var(--fd);font-size:1rem;font-weight:700;letter-spacing:-.02em;line-height:1.1;color:var(--ink)}
.team-handle{font-family:var(--fm);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)}
.team-gh{
  display:inline-flex;align-items:center;gap:6px;text-decoration:none;
  font-family:var(--fm);font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-3);margin-top:4px;
  transition:color .18s ease;
}
.team-gh:hover{color:var(--ink)}
.team-gh svg{width:12px;height:12px;flex-shrink:0}

/* ── FOOTER ── */
.footer{
  background:var(--ink);padding:52px 64px;
  display:flex;align-items:flex-end;justify-content:space-between;
}
.footer-brand{font-family:var(--fd);font-size:2rem;font-weight:700;letter-spacing:-.04em;color:var(--white)}
.footer-brand em{font-style:italic;font-weight:300;color:rgba(255,255,255,.4)}
.footer-meta{
  font-family:var(--fm);font-size:.56rem;letter-spacing:.16em;
  text-transform:uppercase;color:rgba(255,255,255,.25);text-align:right;line-height:2.2;
}

/* ── RESPONSIVE ── */
@media(max-width:960px){
  .nav{padding:0 20px}
  .hero{grid-template-columns:1fr;padding:72px 20px 52px;min-height:auto;gap:44px}
  .hero-r{border-left:none;border-top:1px solid var(--rule);padding-left:0;padding-top:32px;flex-direction:row;flex-wrap:wrap;gap:0}
  .hero-stat{padding:18px 28px 18px 0;border-bottom:none;border-right:1px solid var(--rule);margin-right:24px}
  .hero-stat:last-child{border-right:none}
  .hero-watermark{display:none}
  .sec{padding:60px 20px}
  .sec-head{grid-template-columns:1fr;gap:16px}
  .what-grid{grid-template-columns:1fr}
  .for-tabs{flex-direction:column}
  .for-tab{border-right:none;border-bottom:1px solid var(--rule)}
  .for-tab:last-child{border-bottom:none}
  .for-panel{grid-template-columns:1fr}
  .for-right{border-left:none;border-top:1px solid var(--rule)}
  .hw-grid{grid-template-columns:1fr}
  .ap-item{grid-template-columns:1fr;gap:12px}
  .lead-grid{grid-template-columns:1fr}
  .team-grid{grid-template-columns:repeat(2,1fr)}
  .band{padding:72px 20px}
  .footer{flex-direction:column;gap:24px;padding:36px 20px}
  .footer-meta{text-align:left}
}
`;

/* ─── DATA ─── */
const features = [
  { num:"01", accent:"#1744CC", title:"In-Browser Circuit Simulation", body:"A drag-and-drop canvas with manual wiring, real-time electrical validation, and smart auto-assist. LEDs receive 220 ohm resistors automatically. LCDs get contrast potentiometers. No plugins, no desktop software.", foot:"Simulation Engine" },
  { num:"02", accent:"#B86C08", title:"Three-Level Programming", body:"Block-based Blockly for beginners with live C++ generation. Partial scaffolding for intermediates. Full text editor for advanced users. The mode is selected before a project begins — not bolted on as an afterthought.", foot:"Code Editor" },
  { num:"03", accent:"#15663C", title:"Serial Monitor and Plotter", body:"Real-time serial output with timestamped messages, pause and clear controls. A multi-signal analog plotter for sensor visualization at full simulation speed — the same tools engineers use, made accessible.", foot:"Developer Tools" },
  { num:"04", accent:"#5B2888", title:"Offline-First Architecture", body:"Compiled machine code is cached locally in IndexedDB. Projects auto-save every 2.5 seconds. Component uploads queue when offline and sync automatically on reconnection. The backend is never a hard dependency.", foot:"Reliability" },
  { num:"05", accent:"#B02540", title:"Live Classroom Infrastructure", body:"Screen broadcast, circuit template push, screen lock and unlock for teachers. Students submit projects as structured JSON plus code. Inline grading and per-student analytics give teachers a real picture of class progress.", foot:"Education" },
  { num:"06", accent:"#0A7C78", title:"Gamified Component Progression", body:"Students start with basic sensors and actuators. Advanced components unlock as competence is demonstrated through the platform's points, badges, and level system — not just time spent on the platform.", foot:"Progression" },
];

const roles = [
  {
    key:"guest", name:"Guest", tagline:"No account needed",
    color:"#3A3835", bg:"#111010",
    desc:"Guests have immediate access to the full simulation environment. Build circuits, write firmware, and run live simulations without creating an account. Projects persist locally across sessions.",
    can:["Full simulator and circuit builder","Write and run Arduino and MicroPython code","Real-time simulation at 16 MHz AVR clock speed","Download project as embedded PNG with metadata","Access all pre-built example projects"],
    cannot:["Cloud project saving","Assignment submission","Gamification and progress tracking"],
  },
  {
    key:"student", name:"Student", tagline:"Login required",
    color:"#1744CC", bg:"#1744CC",
    desc:"Students enroll in classes, submit structured assignments, and build skill progressively. Every action on the platform feeds a transparent progression system that unlocks more powerful components over time.",
    can:["Join classes with a teacher-issued code","Save and sync projects to the cloud","Submit assignments as structured JSON plus code","Earn points, coins, badges, and level up","Unlock advanced components through demonstrated skill","View teacher grades and written feedback"],
    cannot:[],
  },
  {
    key:"teacher", name:"Teacher", tagline:"Login required",
    color:"#15663C", bg:"#15663C",
    desc:"Teachers manage the full classroom lifecycle. Live session controls give real-time command over every student's view and workflow — from distributing a circuit template to locking screens during assessment.",
    can:["Create and manage classes, generate join codes","Design and distribute circuit assignment templates","Broadcast live screen and push circuit templates","Lock and unlock student screens during class","Grade submissions inline with written feedback","View cohort-level and per-student analytics"],
    cannot:[],
  },
];

const hw = [
  { num:"01", phase:"Phase 1", status:"Active", sBg:"#E2F0EA", sC:"#15663C", nC:"#15663C", cBg:"#E2F0EA", cBd:"#A8D4BB",
    boards:[{name:"Arduino Uno",sub:"Instruction-level",dot:"#15663C"},{name:"Raspberry Pi Pico",sub:"RP2040",dot:"#1744CC"}] },
  { num:"02", phase:"Phase 2", status:"Planned", sBg:"#FAF2E5", sC:"#B86C08", nC:"#B86C08", cBg:"#FAF2E5", cBd:"#EDD09A",
    boards:[{name:"ESP32",sub:"API-level",dot:"#B86C08"}] },
  { num:"03", phase:"Phase 3", status:"Roadmap", sBg:"#EFE8F7", sC:"#5B2888", nC:"#5B2888", cBg:"#EFE8F7", cBd:"#C8AEE4",
    boards:[{name:"STM32",sub:"ARM instruction-level",dot:"#5B2888"}] },
];

const approach = [
  { num:"001", t:"Simulation that behaves like real silicon", b:"Instruction-level AVR emulation means firmware runs exactly as it would on a physical Arduino Uno. Timing is accurate. Interrupts fire correctly. Pin voltages respond to actual electrical logic. If it runs on OpenHW-Studio, it runs on the board." },
  { num:"002", t:"Education built in, not bolted on", b:"Classroom tooling is not a feature added to a simulator — it is part of the core architecture. Teachers design assignments. Students submit structured data. The progression system is woven into component access. Every design decision was made with both ends of the classroom in mind simultaneously." },
  { num:"003", t:"Open by default, extensible by design", b:"Every repository is public. Custom components can be submitted, reviewed by an administrator, and deployed to all active sessions without a server restart. The modular architecture supports new MCU targets, AI-assisted grading, and institutional administration without rebuilding the foundation." },
];

const mqItems = [
  {t:"In-Browser AVR Emulation",c:"#1744CC"},{t:"60 FPS Live Simulation",c:"#B86C08"},
  {t:"Offline-First Storage",c:"#15663C"},{t:"Live Classroom Tools",c:"#5B2888"},
  {t:"Gamified Progression",c:"#B02540"},{t:"Serial Monitor",c:"#0A7C78"},
  {t:"Multi-MCU Roadmap",c:"#1744CC"},{t:"Block and Text Coding",c:"#B86C08"},
];


const PALETTE = [
  "#1744CC","#B86C08","#15663C","#5B2888","#B02540","#0A7C78",
  "#1744CC","#B86C08","#15663C","#5B2888","#B02540","#0A7C78",
  "#1744CC","#B86C08","#15663C","#5B2888",
];

const team = [
    { name:"Md. Danish",    handle:"danish9661",       url:"https://github.com/danish9661"},
  { name:"Satvik Sharma", handle:"Satvik-Sharma511", url:"https://github.com/Satvik-Sharma511" },
  { name:"Sagar Seth",               handle:"lightning-sagar",      url:"https://github.com/lightning-sagar" },
    { name:"B Naga Krishna Manohar",   handle:"KrishnaManohar101",    url:"https://github.com/KrishnaManohar101" },
      { name:"Viraj Shah",               handle:"virajsh4h",            url:"https://github.com/virajsh4h" },
  { name:"Aaditya Pranav",           handle:"aadityapranav989-ai",  url:"https://github.com/aadityapranav989-ai" },
  { name:"Akshat Singh Tomar",       handle:"akshat440",            url:"https://github.com/akshat440" },
  { name:"Poojitha S K",             handle:"geekypooky",           url:"https://github.com/geekypooky" },
  { name:"Kartikay Goel",            handle:"Kartikay-goel",        url:"https://github.com/Kartikay-goel" },
  { name:"Kiran",                    handle:"kiranpgore20117-code",  url:"https://github.com/kiranpgore20117-code" },
  { name:"Manas Krishna Neigapula",  handle:"manasneigapula",       url:"https://github.com/manasneigapula" },
  { name:"Pratham Mittal",           handle:"PrathamMittal07",      url:"https://github.com/PrathamMittal07" },
  { name:"Rashmitha Rani B N",       handle:"Rashmitha018",         url:"https://github.com/Rashmitha018" },
  { name:"Rima",                     handle:"rima48-bit",           url:"https://github.com/rima48-bit" },
  { name:"Ritesh Jadhav",            handle:"RiteshJadhav283",      url:"https://github.com/RiteshJadhav283" },
  { name:"Mohit Sharma",             handle:"sharmamohit-devops",   url:"https://github.com/sharmamohit-devops" },
  { name:"Sharukhh",                 handle:"Sharukhh69",           url:"https://github.com/Sharukhh69" },
  { name:"Snehal",                   handle:"snehal-git-hub",       url:"https://github.com/snehal-git-hub" },
];

function initials(name) {
  return name.split(" ").filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join("");
}

/* ─── ICONS ─── */
const GH = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);

const Tick = ({ c }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <polyline points="1.5 5.5 4.5 8.5 9.5 2.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const Dash = () => (
  <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
    <line x1="1" y1="1" x2="9" y2="1" stroke="#C5C0B6" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/* ─── MAIN ─── */
export default function AboutUs() {
  const [activeRole, setActiveRole] = useState(0);
  const [loaded, setLoaded]         = useState(false);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = FONTS;
    document.head.appendChild(l);
    setTimeout(() => setLoaded(true), 60);
    return () => { document.head.removeChild(s); };
  }, []);

  const role = roles[activeRole];

  return (
    <div style={{ opacity: loaded ? 1 : 0, transition: "opacity .45s ease" }}>

      {/* NAV */}
      <nav className="nav">
        <a href="https://openhw-studio.fossee.in/" className="nav-mark"><em>Open</em>HW-Studio</a>
        <div className="nav-right">
          <div className="nav-live"><span className="nav-live-dot"/>Live Platform</div>
          <span className="nav-chip">About Us</span>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-watermark">HW</div>
        <div className="hero-l">
          <div className="hero-eye rise">
            <span className="hero-eye-line"/>
            Cloud-Based Hardware and Coding Platform
          </div>
          <h1 className="hero-h1 rise d1">
            We built<br/>
            the lab that<br/>
            <span className="lt">lives in a<br/>browser.</span>
          </h1>
          <p className="hero-p rise d2">
            OpenHW-Studio is an open-source electronics simulation and learning
            platform built for students, teachers, and engineers who need real
            embedded system behaviour without real hardware. Instruction-level
            accuracy. Classroom-grade tooling. Deployed on FOSSEE infrastructure.
          </p>
        </div>
        <div className="hero-r">
          {[
            {n:"16MHz",  l:"AVR Emulation Clock",    c:"#1744CC"},
            {n:"60fps",  l:"Simulation Render Rate",  c:"#15663C"},
            {n:"3+",     l:"MCU Families Supported",  c:"#B86C08"},
            {n:"18",     l:"Active Contributors",     c:"#5B2888"},
          ].map((s,i) => (
            <div className="hero-stat rise" style={{animationDelay:`${.28+i*.12}s`}} key={s.l}>
              <div className="hero-stat-n" style={{color:s.c}}>{s.n}</div>
              <div className="hero-stat-l">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* VISION BAND */}
      <div className="band">
        <div className="band-inner">
          <div className="band-label">Platform Vision</div>
          <p className="band-q">
            A <strong>unified, gamified, classroom-integrated</strong> simulation
            ecosystem for modern embedded education — combining interactive
            simulation, guided auto-wiring assistance, structured classroom
            workflows, and multi-board experimentation in a single, fully open platform.
          </p>
        </div>
      </div>

      {/* WHAT WE BUILT */}
      <section className="sec what-bg">
        <div className="si">
          <div className="sec-head">
            <div className="sec-idx">02 — What We Built</div>
            <div>
              <h2 className="sec-h">Six systems.<br/><em>One coherent platform.</em></h2>
              <p className="sec-sub">
                Every component was designed to function independently and integrate without seams.
                The simulation runs in the browser. The compiler lives on a lightweight server.
                The emulator is a shared library consumed by both.
                Together they form a complete embedded development environment.
              </p>
            </div>
          </div>
          <div className="what-grid">
            {features.map(f => (
              <div className="what-card" key={f.num}>
                <div className="what-bar" style={{background:f.accent}}/>
                <div className="what-n" style={{color:f.accent}}>{f.num}</div>
                <div className="what-t">{f.title}</div>
                <div className="what-b">{f.body}</div>
                <div className="what-foot">{f.foot}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT IS FOR */}
      <section className="sec for-bg">
        <div className="si">
          <div className="sec-head">
            <div className="sec-idx">03 — Who It Is For</div>
            <div>
              <h2 className="sec-h">Three roles.<br/><em>One shared environment.</em></h2>
              <p className="sec-sub">
                OpenHW-Studio serves every person in the classroom — the student learning
                their first GPIO pin, the teacher designing the assignment, and the
                guest who just wants to see what a servo motor does.
              </p>
            </div>
          </div>
          <div className="for-tabs">
            {roles.map((r,i) => (
              <button
                key={r.key}
                className={`for-tab${activeRole===i?" on":""}`}
                style={activeRole===i ? {background:r.bg,color:"#fff",borderColor:r.bg} : {}}
                onClick={() => setActiveRole(i)}
              >
                {r.name} — {r.tagline}
              </button>
            ))}
          </div>
          <div className="for-panel" key={role.key}>
            <div className="for-left">
              <div className="for-ptag" style={{color:role.color}}>{role.name}</div>
              <div className="for-ph">{role.name}</div>
              <p className="for-pdesc">{role.desc}</p>
            </div>
            <div className="for-right">
              <div className="for-rlabel">Access includes</div>
              <div className="for-list">
                {role.can.map(item => (
                  <div className="for-item" key={item}>
                    <div className="for-ico" style={{background:role.color+"18"}}>
                      <Tick c={role.color}/>
                    </div>
                    {item}
                  </div>
                ))}
                {role.cannot.map(item => (
                  <div className="for-item off" key={item}>
                    <div className="for-ico" style={{background:"#F0EDE8"}}><Dash/></div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HARDWARE */}
      <section className="sec hw-bg">
        <div className="si">
          <div className="sec-head">
            <div className="sec-idx">04 — Hardware Roadmap</div>
            <div>
              <h2 className="sec-h">Multi-MCU.<br/><em>Phased and purposeful.</em></h2>
              <p className="sec-sub">
                Starting with instruction-level Arduino Uno and RP2040 emulation,
                OpenHW-Studio expands through a three-phase roadmap toward ESP32
                and STM32 — covering API-level and full ARM instruction-level emulation.
              </p>
            </div>
          </div>
          <div className="hw-grid">
            {hw.map(h => (
              <div className="hw-card" key={h.num} style={{background:h.cBg,borderColor:h.cBd}}>
                <div className="hw-top">
                  <span className="hw-phase-l">{h.phase}</span>
                  <span className="hw-badge" style={{background:h.sBg,color:h.sC}}>{h.status}</span>
                </div>
                <div className="hw-num" style={{color:h.nC}}>{h.num}</div>
                <div className="hw-boards">
                  {h.boards.map(b => (
                    <div className="hw-board" key={b.name}>
                      <div className="hw-dot" style={{background:b.dot}}/>
                      {b.name}
                      <span className="hw-sub">{b.sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="mq-wrap">
        <div className="mq-track">
          {[...mqItems,...mqItems].map((m,i) => (
            <div className="mq-item" key={i}>
              <span className="mq-dot" style={{background:m.c}}/>
              {m.t}
            </div>
          ))}
        </div>
      </div>

      {/* APPROACH */}
      <section className="sec ap-bg">
        <div className="si">
          <div className="sec-head">
            <div className="sec-idx">05 — Our Approach</div>
            <div>
              <h2 className="sec-h">Three decisions<br/><em>we never compromised on.</em></h2>
            </div>
          </div>
          <div className="ap-list">
            {approach.map(a => (
              <div className="ap-item" key={a.num}>
                <div className="ap-num">{a.num}</div>
                <div className="ap-t">{a.t}</div>
                <div className="ap-b">{a.b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTRIBUTORS */}
      <section className="sec contrib-bg">
        <div className="si">
          <div className="sec-head">
            <div className="sec-idx">06 — The Team</div>
            <div>
              <h2 className="sec-h">18 people.<br/><em>One open platform.</em></h2>
              <p className="sec-sub">
                OpenHW-Studio is built by a team of students and engineers collaborating
                openly on GitHub under the FOSSEE program. Every contribution is tracked,
                reviewed, and merged publicly.
              </p>
            </div>
          </div>

          {/* TEAM CONTRIBUTORS */}
          <div className="team-label">All Contributors</div>
          <div className="team-grid">
            {team.map((c, i) => {
              const color = PALETTE[i % PALETTE.length];
              return (
                <div className="team-card" key={c.handle}>
                  <div className="team-card-top-bar" style={{background:color}}/>
                  <div className="team-av" style={{background:color}}>
                    {initials(c.name)}
                  </div>
                  <div>
                    <div className="team-name">{c.name}</div>
                    <div className="team-handle">/{c.handle}</div>
                  </div>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="team-gh">
                    <GH/> GitHub
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-brand"><em>Open</em>HW-Studio</div>
        <div className="footer-meta">
          Open Source<br/>
          Deployed on FOSSEE Infrastructure<br/>
          openhw-studio.fossee.in
        </div>
      </footer>

    </div>
  );
}