const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Danish\\Documents\\simulator\\OpenHW-studio-frontend\\src\\pages\\simulationpage\\RightPanel.jsx', 'utf8');

function checkJSX(code) {
  let depth = 0;
  let inString = false;
  let quote = '';
  let i = 0;
  while (i < code.length) {
    const char = code[i];
    if (!inString) {
      if (char === '"' || char === "'" || char === '`') {
        inString = true;
        quote = char;
      } else if (char === '<' && code[i+1] !== ' ' && code[i+1] !== '=') {
        if (code[i+1] === '/') {
          depth--;
          console.log(`Close at ${i}, depth ${depth}`);
        } else {
          depth++;
          console.log(`Open at ${i}, depth ${depth}`);
        }
      }
    } else {
      if (char === quote && code[i-1] !== '\\') {
        inString = false;
      }
    }
    i++;
  }
  console.log(`Final depth: ${depth}`);
}

checkJSX(content);
