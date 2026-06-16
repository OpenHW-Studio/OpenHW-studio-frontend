const fs = require('fs');
let content = fs.readFileSync('src/pages/simulationpage/SimulatorPage.jsx', 'utf8');

const regex2 = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> develop\r?\n/g;

content = content.replace(regex2, (match, head, dev) => {
    if (match.includes('...(requiredLibsForBoard')) {
        // First occurrence 
        return head.replace('...(requiredLibsForBoard.length > 0 ? { libraries: requiredLibsForBoard } : {}),', 'target: kind,\n                  libraries_txt: librariesTxt,\n                  ...(requiredLibsForBoard.length > 0 ? { libraries: requiredLibsForBoard } : {}),');
    }
    
    // The second occurrence is the larger block:
    if (match.includes('startEsp32Compile')) {
        return `
              // Collect libraries required by all placed components on this board
              const requiredLibsForBoard = [...new Set(
                components
                  .filter((c) => !isProgrammableBoardType(c.type))
                  .flatMap((c) => COMPONENT_REGISTRY[c.type]?.autocoding?.libraries || [])
                  .map((l) => String(l || '').trim())
                  .filter(Boolean)
              )];
              
              if (kind === 'esp32' && esp32SimulationMode === 'frontend') {
                const startRes = await startEsp32Compile({
                  code: compileSource,
                  libraries_txt: librariesTxt,
                  targetEngine: 'frontend'
                });
                
                if (!startRes || (!startRes.jobId && !startRes.buildId)) {
                  throw new Error('Failed to start ESP32 compilation.');
                }
                
                if (startRes.cache === 'hit') {
                  logSerial(\`Using server-cached compilation for \${boardComp.id}...\`);
                }
                
                const jobId = startRes.jobId || startRes.buildId;
                let pollCount = 0;
                let lastPrintedProgressLen = 0;
                
                while (true) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                  const statusRes = await getEsp32CompileStatus(jobId);
                  
                  if (!statusRes) continue;
                  
                  const progressLines = statusRes.progress || [];
                  if (progressLines.length > lastPrintedProgressLen) {
                    for (let i = lastPrintedProgressLen; i < progressLines.length; i++) {
                      logSerial(progressLines[i]);
                    }
                    lastPrintedProgressLen = progressLines.length;
                  }
                  
                  if (statusRes.status === 'success') {
                    if (!statusRes.binary_content) {
                      throw new Error('Compilation succeeded but no binary content was returned.');
                    }
                    compiled = {
                      hex: statusRes.binary_content,
                      stdout: statusRes.stdout || '',
                      stderr: statusRes.stderr || ''
                    };
                    break;
                  } else if (statusRes.status === 'failed') {
                    const errMsg = statusRes.error || 'ESP32 compilation failed.';
                    throw new Error(errMsg);
                  }
                  
                  pollCount++;
                  if (pollCount > 180) {
                    throw new Error('ESP32 compilation timed out after 90 seconds.');
                  }
                }
              } else {
                compiled = await compileCode({
                  code: compileSource,
                  files: compileUnit.files,
                  sketchName: compileUnit.sketchName,
                  fqbn: targetFqbn,
                  target: kind,
                  libraries_txt: librariesTxt,
                  ...(requiredLibsForBoard.length > 0 ? { libraries: requiredLibsForBoard } : {}),
                });
              }
        `;
    }
    
    return dev; // fallback
});

fs.writeFileSync('src/pages/simulationpage/SimulatorPage.jsx', content);
console.log('Fixed SimulatorPage');
