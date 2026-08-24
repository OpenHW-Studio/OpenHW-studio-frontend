import { AVRTimerConfig, portBConfig, portDConfig, portEConfig, portGConfig, portHConfig, portLConfig, adcConfig, twiConfig, spiConfig, usart0Config } from 'avr8js';

// ATmega2560 hardware timer configurations for avr8js
// Word addresses for interrupts are (Vector_No - 1) * 2

const timer01Dividers = {
    0: 0,
    1: 1,
    2: 8,
    3: 64,
    4: 256,
    5: 1024,
    6: 0, // External clock 
    7: 0, 
};

const defaultTimerBits = {
    // TIFR bits
    TOV: 1,
    OCFA: 2,
    OCFB: 4,
    OCFC: 8, 
    // TIMSK bits
    TOIE: 1,
    OCIEA: 2,
    OCIEB: 4,
    OCIEC: 8, 
};

export const megaTimer0Config: AVRTimerConfig = { 
    bits: 8, 
    captureInterrupt: 0, 
    compAInterrupt: 0x2a, // Vector 22
    compBInterrupt: 0x2c, // Vector 23
    compCInterrupt: 0, 
    ovfInterrupt: 0x2e,   // Vector 24
    TIFR: 0x35, OCRA: 0x47, OCRB: 0x48, OCRC: 0, ICR: 0, TCNT: 0x46, 
    TCCRA: 0x44, TCCRB: 0x45, TCCRC: 0, TIMSK: 0x6e, 
    dividers: timer01Dividers, 
    compPortA: portBConfig.PORT, compPinA: 7, // OC0A is PB7
    compPortB: portGConfig.PORT, compPinB: 5, // OC0B is PG5
    compPortC: 0, compPinC: 0, 
    externalClockPort: portDConfig.PORT, externalClockPin: 7, 
    ...defaultTimerBits 
};

export const megaTimer1Config: AVRTimerConfig = { 
    bits: 16, 
    captureInterrupt: 0x20, // Vector 17
    compAInterrupt: 0x22,   // Vector 18
    compBInterrupt: 0x24,   // Vector 19
    compCInterrupt: 0x26,   // Vector 20
    ovfInterrupt: 0x28,     // Vector 21
    TIFR: 0x36, OCRA: 0x88, OCRB: 0x8a, OCRC: 0x8c, ICR: 0x86, TCNT: 0x84, 
    TCCRA: 0x80, TCCRB: 0x81, TCCRC: 0x82, TIMSK: 0x6f, 
    dividers: timer01Dividers, 
    compPortA: portBConfig.PORT, compPinA: 5, // OC1A is PB5
    compPortB: portBConfig.PORT, compPinB: 6, // OC1B is PB6
    compPortC: portBConfig.PORT, compPinC: 7, // OC1C is PB7
    externalClockPort: portDConfig.PORT, externalClockPin: 6, 
    ...defaultTimerBits 
};

export const megaTimer2Config: AVRTimerConfig = { 
    bits: 8, 
    captureInterrupt: 0, 
    compAInterrupt: 0x18, // Vector 13
    compBInterrupt: 0x1a, // Vector 14
    compCInterrupt: 0, 
    ovfInterrupt: 0x1c,   // Vector 15
    TIFR: 0x37, OCRA: 0xb3, OCRB: 0xb4, OCRC: 0, ICR: 0, TCNT: 0xb2, 
    TCCRA: 0xb0, TCCRB: 0xb1, TCCRC: 0, TIMSK: 0x70, 
    dividers: {
        0: 0,
        1: 1,
        2: 8,
        3: 32,
        4: 64,
        5: 128,
        6: 256,
        7: 1024,
    }, 
    compPortA: portBConfig.PORT, compPinA: 4, // OC2A is PB4
    compPortB: portHConfig.PORT, compPinB: 6, // OC2B is PH6
    compPortC: 0, compPinC: 0, 
    externalClockPort: 0, externalClockPin: 0, 
    ...defaultTimerBits 
};

export const megaTimer3Config: AVRTimerConfig = { 
    bits: 16, 
    captureInterrupt: 0x3e, // Vector 32
    compAInterrupt: 0x40,   // Vector 33
    compBInterrupt: 0x42,   // Vector 34
    compCInterrupt: 0x44,   // Vector 35
    ovfInterrupt: 0x46,     // Vector 36
    TIFR: 0x38, OCRA: 0x98, OCRB: 0x9a, OCRC: 0x9c, ICR: 0x96, TCNT: 0x94, 
    TCCRA: 0x90, TCCRB: 0x91, TCCRC: 0x92, TIMSK: 0x71, 
    dividers: timer01Dividers, 
    compPortA: portEConfig.PORT, compPinA: 3, // OC3A is PE3
    compPortB: portEConfig.PORT, compPinB: 4, // OC3B is PE4
    compPortC: portEConfig.PORT, compPinC: 5, // OC3C is PE5
    externalClockPort: portEConfig.PORT, externalClockPin: 6, 
    ...defaultTimerBits 
};

export const megaTimer4Config: AVRTimerConfig = { 
    bits: 16, 
    captureInterrupt: 0x52, // Vector 42
    compAInterrupt: 0x54,   // Vector 43
    compBInterrupt: 0x56,   // Vector 44
    compCInterrupt: 0x58,   // Vector 45
    ovfInterrupt: 0x5a,     // Vector 46
    TIFR: 0x39, OCRA: 0xa8, OCRB: 0xaa, OCRC: 0xac, ICR: 0xa6, TCNT: 0xa4, 
    TCCRA: 0xa0, TCCRB: 0xa1, TCCRC: 0xa2, TIMSK: 0x72, 
    dividers: timer01Dividers, 
    compPortA: portHConfig.PORT, compPinA: 3, // OC4A is PH3
    compPortB: portHConfig.PORT, compPinB: 4, // OC4B is PH4
    compPortC: portHConfig.PORT, compPinC: 5, // OC4C is PH5
    externalClockPort: portHConfig.PORT, externalClockPin: 7, 
    ...defaultTimerBits 
};

export const megaTimer5Config: AVRTimerConfig = { 
    bits: 16, 
    captureInterrupt: 0x5c, // Vector 47
    compAInterrupt: 0x5e,   // Vector 48
    compBInterrupt: 0x60,   // Vector 49
    compCInterrupt: 0x62,   // Vector 50
    ovfInterrupt: 0x64,     // Vector 51
    TIFR: 0x3a, OCRA: 0x128, OCRB: 0x12a, OCRC: 0x12c, ICR: 0x126, TCNT: 0x124, 
    TCCRA: 0x120, TCCRB: 0x121, TCCRC: 0x122, TIMSK: 0x73, 
    dividers: timer01Dividers, 
    compPortA: portLConfig.PORT, compPinA: 3, // OC5A is PL3
    compPortB: portLConfig.PORT, compPinB: 4, // OC5B is PL4
    compPortC: portLConfig.PORT, compPinC: 5, // OC5C is PL5
    externalClockPort: portLConfig.PORT, externalClockPin: 2, 
    ...defaultTimerBits 
};

export const megaUsart0Config = {
    ...usart0Config,
    rxCompleteInterrupt: 0x32, // Vector 26
    dataRegisterEmptyInterrupt: 0x34, // Vector 27
    txCompleteInterrupt: 0x36, // Vector 28
};

export const megaAdcConfig = {
    ...adcConfig,
    adcInterrupt: 0x3a, // Vector 30
};

export const megaTwiConfig = {
    ...twiConfig,
    twiInterrupt: 0x4e, // Vector 40
};

export const megaSpiConfig = {
    ...spiConfig,
    spiInterrupt: 0x30, // Vector 25
};
