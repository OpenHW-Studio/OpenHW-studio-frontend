import React from 'react';

const BlocklyEditor = React.lazy(() => import('../../../components/BlocklyEditor.jsx'));

export default function BlockEditorView(props) {
  const {
    blocklyDisabled,
    setBlocklyDisabled,
    blocklyXml,
    setBlocklyXml,
    blocklyGeneratedCode,
    setBlocklyGeneratedCode,
    useBlocklyCode,
    setUseBlocklyCode,
    setCode,
    setCodeTab,
    serialBoardFilter,
    serialBoardKinds,
    editingDisabled = false,
    editingDisabledMessage = 'Editing is disabled.'
  } = props;

  const toggleBlocklyDisabled = React.useCallback(() => {
    if (!setBlocklyDisabled) return;
    setBlocklyDisabled(prev => {
      const next = !prev;
      try { localStorage.setItem('ohw_blockly_disabled', String(next)); } catch (_) {}
      return next;
    });
  }, [setBlocklyDisabled]);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', flexDirection: 'column', overflow: 'hidden', position: 'relative', pointerEvents: editingDisabled ? 'none' : 'auto', background: 'var(--bg)' }}>
      {blocklyDisabled ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: 24, textAlign: 'center',
          background: 'var(--bg)',
        }}>
          <span style={{ fontSize: 36, opacity: 0.4 }}>🧱</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Block Editor is disabled</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 220, lineHeight: 1.5 }}>
            Block coding is turned off to improve canvas performance.
          </div>
          <button
            onClick={toggleBlocklyDisabled}
            style={{
              marginTop: 4,
              padding: '7px 18px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Enable Block Editor
          </button>
        </div>
      ) : (
        <React.Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>Loading Block Editor...</div>}>
          <BlocklyEditor
            onExportCode={(generated) => { if (!editingDisabled) { setCode(generated); setCodeTab('code'); } }}
            onChange={(generated) => { if (!editingDisabled) setBlocklyGeneratedCode(generated); }}
            xml={blocklyXml}
            onXmlChange={(nextXml) => { if (!editingDisabled) setBlocklyXml(nextXml); }}
            useBlocklyCode={useBlocklyCode}
            onToggleUseBlocklyCode={() => { if (!editingDisabled) setUseBlocklyCode(!useBlocklyCode); }}
            visible={true}
            boardKind={(serialBoardFilter && serialBoardFilter !== 'all') ? (serialBoardKinds?.[serialBoardFilter] || 'arduino_uno') : (Object.values(serialBoardKinds || {})[0] || 'arduino_uno')}
            isMobile={true}
          />
        </React.Suspense>
      )}
      {editingDisabled && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, background: 'rgba(15,23,42,0.92)', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 10, padding: '8px 10px', fontSize: 11, maxWidth: 220 }}>
          {editingDisabledMessage}
        </div>
      )}
    </div>
  );
}
