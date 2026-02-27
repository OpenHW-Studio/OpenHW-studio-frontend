export const S = {
  page:    { display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'var(--bg)', fontFamily:"'Space Grotesk',sans-serif", color:'var(--text)' },
  bar:     { display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap' },
  logo:    { background:'none', border:'none', color:'var(--accent)', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  barCenter: { display:'flex', alignItems:'center', gap:8, flex:1, flexWrap:'wrap' },
  sel:     { background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 12px', borderRadius:8, fontFamily:'inherit', fontSize:13, cursor:'pointer' },
  userChip:{ background:'var(--card)', border:'1px solid var(--border)', padding:'7px 12px', borderRadius:8, fontSize:13, color:'var(--text2)' },
  guestBanner: { background:'rgba(255,145,0,.1)', borderBottom:'1px solid rgba(255,145,0,.25)', color:'var(--orange)', padding:'8px 20px', fontSize:13, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  bannerBtn:   { background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13, textDecoration:'underline', fontFamily:'inherit' },
  workspace:   { display:'flex', flex:1, overflow:'hidden' },

  palette:      { /* width moved to parent wrapper */ background:'var(--bg2)', borderRight:'1px solid var(--border)', overflowY:'auto', padding:'10px 8px', display:'flex', flexDirection:'column', gap:2, flexShrink:0, minWidth:100 },
  paletteHeader:{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.1em', padding:'4px 8px 8px' },
  paletteSearch:{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:8, fontFamily:'inherit', fontSize:12, width:'100%', marginBottom:8, outline:'none' },
  groupName:    { fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', padding:'4px 8px' },
  paletteItem:  { display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'grab', transition:'all .15s', border:'1px solid transparent', userSelect:'none' },
  paletteTip:   { marginTop:'auto', padding:'10px 8px', fontSize:11, color:'var(--text3)', lineHeight:1.6 },

  canvas: {
    flex:1, position:'relative', overflow:'hidden',
    backgroundColor:'var(--canvas-bg)',
    backgroundImage:'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
    backgroundSize:'24px 24px',
  },
  emptyState: { position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text3)', textAlign:'center', pointerEvents:'none' },

  rightPanel: { /* width handled by parent */ background:'var(--bg2)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden', minWidth:100 },

  validationPanel: { background:'var(--bg3)', borderBottom:'1px solid var(--border)', flexShrink:0 },
  validationHeader:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', fontSize:12, fontWeight:700, color:'var(--orange)' },
  closeBtn:        { background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:14, fontFamily:'inherit' },
  validationItem:  { padding:'6px 12px', fontSize:12, borderLeft:'3px solid', marginBottom:2, lineHeight:1.5 },

  wiresList:   { background:'var(--bg3)', borderBottom:'1px solid var(--border)', maxHeight:140, overflowY:'auto', flexShrink:0 },
  wiresHeader: { fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', padding:'8px 12px 4px' },
  wireItem:    { display:'flex', alignItems:'center', gap:8, padding:'4px 12px', borderBottom:'1px solid var(--border)' },
  wireDelete:  { background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:12, fontFamily:'inherit', flexShrink:0 },

  codePanel:    { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  codeTabs:     { display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 },
  codeTab:      { flex:1, padding:'10px 4px', background:'none', border:'none', color:'var(--text3)', fontFamily:'inherit', fontSize:12, cursor:'pointer', borderBottom:'2px solid transparent', transition:'all .15s' },
  codeTabActive:{ color:'var(--accent)', borderBottomColor:'var(--accent)' },
  codeEditor:   { flex:1, background:'var(--bg)', color:'var(--text)', border:'none', outline:'none', padding:14, fontFamily:"'JetBrains Mono',monospace", fontSize:12, lineHeight:1.7, resize:'none' },
  codePlaceholder: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text3)', gap:8 },
  serialOutput:    { flex:1, background:'var(--bg)', padding:12, overflowY:'auto' },
  serialInput:     { flex:1, background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:8, fontFamily:'inherit', fontSize:12, outline:'none' },
}
