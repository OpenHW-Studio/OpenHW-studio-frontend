import React, { useEffect, useRef } from 'react'
//import * as Blockly from 'blockly'
import { S } from './styles.js'
import Btn from './Btn.jsx'

export default function CodePanel({ codeTab, setCodeTab, code, setCode }) {
  const blocklyDiv = useRef(null)
  const workspace = useRef(null)

  // initialize toolbox when the blocks tab is shown
  // useEffect(() => {
  //   if (codeTab === 'blocks' && blocklyDiv.current && !workspace.current) {
  //     workspace.current = Blockly.inject(blocklyDiv.current, {
  //       toolbox: `<xml xmlns="https://developers.google.com/blockly/xml">
  //                  <block type="controls_if"></block>
  //                  <block type="logic_compare"></block>
  //                  <block type="math_number"></block>
  //                  <block type="math_arithmetic"></block>
  //                </xml>`,
  //     })
  //   }
  //   // resize workspace when switching to it
  //   if (codeTab === 'blocks' && workspace.current) {
  //     Blockly.svgResize(workspace.current)
  //   }
  // }, [codeTab])

  return (
    <div style={S.codePanel}>
      <div style={S.codeTabs}>
        {['code', 'blocks', 'serial'].map(t => (
          <button
            key={t}
            style={{ ...S.codeTab, ...(codeTab === t ? S.codeTabActive : {}) }}
            onClick={() => setCodeTab(t)}
          >
            {t === 'code' ? '{ } Code' : t === 'blocks' ? '🧩 Blocks' : '📟 Serial'}
          </button>
        ))}
      </div>
      {codeTab === 'code' && (
        <textarea
          style={S.codeEditor}
          value={code}
          onChange={e => setCode(e.target.value)}
          spellCheck={false}
        />
      )}
      {/* {codeTab === 'blocks' && (
        // workspace container for Blockly
        <div ref={blocklyDiv} style={{ flex: 1, minHeight: 200 }} />
      )} */}
      {codeTab === 'serial' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={S.serialOutput}>
            <span style={{ color: 'var(--green)', display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              [Serial Monitor Ready]
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid var(--border)' }}>
            <input style={S.serialInput} placeholder="Send message..." />
            <Btn color="var(--accent)">Send</Btn>
          </div>
        </div>
      )}
    </div>
  )
}
