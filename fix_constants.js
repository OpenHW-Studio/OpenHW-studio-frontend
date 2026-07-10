const fs = require('fs');
const file1 = 'src/pages/simulationpage/constants/simulatorConstants.js';
let content1 = fs.readFileSync(file1, 'utf8');
content1 = content1.replace('arduino_uno: ''arduino:avr:uno'',', 'arduino_uno: ''arduino:avr:uno'',\n  arduino_nano: ''arduino:avr:nano:cpu=atmega328old'',');
fs.writeFileSync(file1, content1);

const file2 = 'src/pages/simulationpage/utils/hardwareUtils.js';
let content2 = fs.readFileSync(file2, 'utf8');
content2 = content2.replace('if (s.includes(''esp32'')) return ''esp32'';', 'if (s.includes(''esp32'')) return ''esp32'';\n    if (s.includes(''nano'')) return ''arduino_nano'';');
fs.writeFileSync(file2, content2);
