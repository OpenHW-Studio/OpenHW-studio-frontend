/**
 * sync-analyzer.js
 * 
 * Shared logic to cross-reference source code with circuit wiring.
 * Used by both the CLI and the Web UI.
 */

export function analyzeCodeHardwareSync(project, targetBoardId = null) {
    const issues = [];
    let code = project.code || '';
    if (!code.trim()) return { passed: true, issues: [] };

    // Strip comments to avoid analyzing commented-out code
    code = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    // 1. Determine which board we are analyzing
    const activeBoardId = targetBoardId || project.activeCodeFileId?.split('/')[1] || project.board;
    const boardComp = project.components.find(c => 
        c.id === activeBoardId || 
        /(arduino|pico|esp32|uno|nano|mega|stm32)/i.test(c.type) ||
        /(arduino|pico|esp32|uno|nano|mega|stm32)/i.test(c.id)
    );
    
    if (!boardComp) return { passed: true, issues: [] };

    // 2. Extract Used Pins from Code
    const usedPins = new Set();
    const arduinoRegex = /\b(?:digitalWrite|digitalRead|pinMode|analogRead|analogWrite)\s*\(\s*([A-Za-z0-9_]+)/g;
    let match;
    while ((match = arduinoRegex.exec(code)) !== null) {
        usedPins.add(match[1]);
    }

    const pyRegex = /\bPin\((\d+)\)|board\.GP(\d+)/g;
    while ((match = pyRegex.exec(code)) !== null) {
        usedPins.add(match[1] || match[2]);
    }

    // 3. Identify Wired Pins on THIS SPECIFIC BOARD
    const wiredPins = new Set();
    (project.connections || []).forEach(wire => {
        [wire.from, wire.to].forEach(endpoint => {
            const [compId, pinId] = String(endpoint || '').split(':');
            if (compId === boardComp.id) {
                const normalized = pinId.replace(/^D/, '');
                wiredPins.add(normalized);
                wiredPins.add(pinId);
            }
        });
    });

    // 4. Cross-Reference & Advanced Hardware-Aware Checks
    const arduinoCalls = [];
    const callRegex = /\b(digitalWrite|digitalRead|pinMode|analogRead|analogWrite)\s*\(\s*([A-Za-z0-9_]+)/g;
    while ((match = callRegex.exec(code)) !== null) {
        arduinoCalls.push({ func: match[1], pin: match[2] });
    }

    arduinoCalls.forEach(({ func, pin }) => {
        if (['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN'].includes(pin)) return;
        if (Number.isNaN(Number(pin)) && !/^A\d+$/.test(pin)) return;

        // A. Basic Connectivity Check
        if (!wiredPins.has(pin)) {
            issues.push({
                severity: 'warn',
                message: `🔍 Code Mismatch: Code for "${boardComp.id}" uses pin "${pin}", but it is not wired.`
            });
            return; // Skip further checks for unwired pins
        }

        // B. PWM Capability Check (analogWrite)
        if (func === 'analogWrite') {
            const pinMeta = (boardComp.pins || []).find(p => p.id === pin || p.id === 'D' + pin || p.name === pin);
            const supportsPWM = pinMeta?.features?.includes('PWM') || 
                               pinMeta?.id?.includes('~') || 
                               pinMeta?.name?.includes('~') ||
                               pinMeta?.name?.includes('PWM');
            if (!supportsPWM) {
                issues.push({
                    severity: 'warn',
                    message: `⚠️ Hardware Limitation: Code calls analogWrite on pin "${pin}", but this pin does not support hardware PWM on ${boardComp.type}.`
                });
            }
        }

        // C. ADC Capability Check (analogRead)
        if (func === 'analogRead') {
            const isAnalogPin = /^A\d+$/.test(pin) || pin.toLowerCase().includes('adc');
            const pinMeta = (boardComp.pins || []).find(p => p.id === pin || p.id === 'D' + pin || p.name === pin);
            const supportsADC = pinMeta?.features?.includes('ADC') || 
                               pinMeta?.name?.startsWith('A') ||
                               isAnalogPin;
            if (!supportsADC) {
                issues.push({
                    severity: 'warn',
                    message: `⚠️ Hardware Limitation: Code calls analogRead on pin "${pin}", but this is not an analog-capable pin.`
                });
            }
        }
    });

    // 5. Library/Protocol Conflict Check
    const hasI2CInCode = code.includes('Wire.begin') || code.includes('I2C(');
    if (hasI2CInCode) {
        // Find SDA/SCL pins for this board
        const i2cPins = (boardComp.pins || []).filter(p => p.id?.includes('SDA') || p.id?.includes('SCL') || p.features?.includes('I2C'));
        const i2cPinIds = i2cPins.map(p => p.id.replace(/^D/, ''));

        // Check if any digitalWrite/Read is using these pins
        arduinoCalls.forEach(({ func, pin }) => {
            if (i2cPinIds.includes(pin) && (func.startsWith('digital') || func.startsWith('analog'))) {
                issues.push({
                    severity: 'warn',
                    message: `🚩 Protocol Conflict: Pin "${pin}" is being used for I2C, but the code is also trying to use it as a standard GPIO (${func}).`
                });
            }
        });

        // 6. Connectivity Check for I2C
        const hasI2CWiring = (project.connections || []).some(w => {
            const [compId, pinId] = w.from.split(':');
            const [compId2, pinId2] = w.to.split(':');
            const isBoardPin = (compId === boardComp.id || compId2 === boardComp.id);
            const isI2CPin = (pinId?.includes('SDA') || pinId2?.includes('SDA') || pinId?.includes('A4') || pinId2?.includes('A4'));
            return isBoardPin && isI2CPin;
        });
        if (!hasI2CWiring) {
            issues.push({
                severity: 'warn',
                message: `🔍 Protocol Mismatch: Code for "${boardComp.id}" initializes I2C, but no I2C devices are wired to its SDA/SCL pins.`
            });
        }
    }

    // 7. Serial/UART Conflict Check
    const hasSerialInCode = code.includes('Serial.begin') || code.includes('UART(');
    if (hasSerialInCode) {
        const serialPins = ['0', '1', 'D0', 'D1', 'GP0', 'GP1'];
        serialPins.forEach(pin => {
            if (wiredPins.has(pin.replace(/^D/, ''))) {
                issues.push({
                    severity: 'warn',
                    message: `🚩 Serial Conflict: Pin "${pin}" is wired, but the code initializes Serial communication. This may interfere with data transmission and board flashing.`
                });
            }
        });
    }

    // 8. Interrupt Compatibility Check
    const interruptRegex = /\battachInterrupt\s*\(\s*(?:digitalPinToInterrupt\s*\(\s*)?([A-Za-z0-9_]+)/g;
    while ((match = interruptRegex.exec(code)) !== null) {
        const pin = match[1];
        if (!['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP'].includes(pin)) {
            const pinMeta = (boardComp.pins || []).find(p => p.id === pin || p.id === 'D' + pin || p.name === pin);
            const supportsInterrupt = pinMeta?.features?.includes('INT') || 
                                     pinMeta?.features?.includes('EXTINT') ||
                                     ['2', '3'].includes(pin); // Fallback for basic Uno
            
            if (!supportsInterrupt) {
                issues.push({
                    severity: 'warn',
                    message: `⚠️ Interrupt Error: Code tries to attach an interrupt to pin "${pin}", but this pin does not support hardware interrupts on ${boardComp.type}.`
                });
            }
        }
    }

    return {
        passed: issues.length === 0,
        issues
    };
}
