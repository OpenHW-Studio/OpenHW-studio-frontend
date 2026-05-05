var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// ../node_modules/avr8js/dist/esm/cpu/interrupt.js
function avrInterrupt(cpu, addr) {
  const sp = cpu.dataView.getUint16(93, true);
  cpu.data[sp] = cpu.pc & 255;
  cpu.data[sp - 1] = cpu.pc >> 8 & 255;
  if (cpu.pc22Bits) {
    cpu.data[sp - 2] = cpu.pc >> 16 & 255;
  }
  cpu.dataView.setUint16(93, sp - (cpu.pc22Bits ? 3 : 2), true);
  cpu.data[95] &= 127;
  cpu.cycles += 2;
  cpu.pc = addr;
}

// ../node_modules/avr8js/dist/esm/cpu/cpu.js
var registerSpace = 256;
var MAX_INTERRUPTS = 128;
var CPU = class {
  constructor(progMem, sramBytes = 8192) {
    this.progMem = progMem;
    this.sramBytes = sramBytes;
    this.data = new Uint8Array(this.sramBytes + registerSpace);
    this.data16 = new Uint16Array(this.data.buffer);
    this.dataView = new DataView(this.data.buffer);
    this.progBytes = new Uint8Array(this.progMem.buffer);
    this.readHooks = [];
    this.writeHooks = [];
    this.pendingInterrupts = new Array(MAX_INTERRUPTS);
    this.nextClockEvent = null;
    this.clockEventPool = [];
    this.pc22Bits = this.progBytes.length > 131072;
    this.gpioPorts = /* @__PURE__ */ new Set();
    this.gpioByPort = [];
    this.onWatchdogReset = () => {
    };
    this.pc = 0;
    this.cycles = 0;
    this.nextInterrupt = -1;
    this.maxInterrupt = 0;
    this.reset();
  }
  reset() {
    this.SP = this.data.length - 1;
    this.pc = 0;
    this.pendingInterrupts.fill(null);
    this.nextInterrupt = -1;
    this.nextClockEvent = null;
  }
  readData(addr) {
    if (addr >= 32 && this.readHooks[addr]) {
      return this.readHooks[addr](addr);
    }
    return this.data[addr];
  }
  writeData(addr, value, mask = 255) {
    const hook = this.writeHooks[addr];
    if (hook) {
      if (hook(value, this.data[addr], addr, mask)) {
        return;
      }
    }
    this.data[addr] = value;
  }
  get SP() {
    return this.dataView.getUint16(93, true);
  }
  set SP(value) {
    this.dataView.setUint16(93, value, true);
  }
  get SREG() {
    return this.data[95];
  }
  get interruptsEnabled() {
    return this.SREG & 128 ? true : false;
  }
  setInterruptFlag(interrupt) {
    const { flagRegister, flagMask, enableRegister, enableMask } = interrupt;
    if (interrupt.inverseFlag) {
      this.data[flagRegister] &= ~flagMask;
    } else {
      this.data[flagRegister] |= flagMask;
    }
    if (this.data[enableRegister] & enableMask) {
      this.queueInterrupt(interrupt);
    }
  }
  updateInterruptEnable(interrupt, registerValue) {
    const { enableMask, flagRegister, flagMask, inverseFlag } = interrupt;
    if (registerValue & enableMask) {
      const bitSet = this.data[flagRegister] & flagMask;
      if (inverseFlag ? !bitSet : bitSet) {
        this.queueInterrupt(interrupt);
      }
    } else {
      this.clearInterrupt(interrupt, false);
    }
  }
  queueInterrupt(interrupt) {
    const { address } = interrupt;
    this.pendingInterrupts[address] = interrupt;
    if (this.nextInterrupt === -1 || this.nextInterrupt > address) {
      this.nextInterrupt = address;
    }
    if (address > this.maxInterrupt) {
      this.maxInterrupt = address;
    }
  }
  clearInterrupt({ address, flagRegister, flagMask }, clearFlag = true) {
    if (clearFlag) {
      this.data[flagRegister] &= ~flagMask;
    }
    const { pendingInterrupts, maxInterrupt } = this;
    if (!pendingInterrupts[address]) {
      return;
    }
    pendingInterrupts[address] = null;
    if (this.nextInterrupt === address) {
      this.nextInterrupt = -1;
      for (let i = address + 1; i <= maxInterrupt; i++) {
        if (pendingInterrupts[i]) {
          this.nextInterrupt = i;
          break;
        }
      }
    }
  }
  clearInterruptByFlag(interrupt, registerValue) {
    const { flagRegister, flagMask } = interrupt;
    if (registerValue & flagMask) {
      this.data[flagRegister] &= ~flagMask;
      this.clearInterrupt(interrupt);
    }
  }
  addClockEvent(callback, cycles) {
    const { clockEventPool } = this;
    cycles = this.cycles + Math.max(1, cycles);
    const maybeEntry = clockEventPool.pop();
    const entry = maybeEntry !== null && maybeEntry !== void 0 ? maybeEntry : { cycles, callback, next: null };
    entry.cycles = cycles;
    entry.callback = callback;
    let { nextClockEvent: clockEvent } = this;
    let lastItem = null;
    while (clockEvent && clockEvent.cycles < cycles) {
      lastItem = clockEvent;
      clockEvent = clockEvent.next;
    }
    if (lastItem) {
      lastItem.next = entry;
      entry.next = clockEvent;
    } else {
      this.nextClockEvent = entry;
      entry.next = clockEvent;
    }
    return callback;
  }
  updateClockEvent(callback, cycles) {
    if (this.clearClockEvent(callback)) {
      this.addClockEvent(callback, cycles);
      return true;
    }
    return false;
  }
  clearClockEvent(callback) {
    let { nextClockEvent: clockEvent } = this;
    if (!clockEvent) {
      return false;
    }
    const { clockEventPool } = this;
    let lastItem = null;
    while (clockEvent) {
      if (clockEvent.callback === callback) {
        if (lastItem) {
          lastItem.next = clockEvent.next;
        } else {
          this.nextClockEvent = clockEvent.next;
        }
        if (clockEventPool.length < 10) {
          clockEventPool.push(clockEvent);
        }
        return true;
      }
      lastItem = clockEvent;
      clockEvent = clockEvent.next;
    }
    return false;
  }
  tick() {
    const { nextClockEvent } = this;
    if (nextClockEvent && nextClockEvent.cycles <= this.cycles) {
      nextClockEvent.callback();
      this.nextClockEvent = nextClockEvent.next;
      if (this.clockEventPool.length < 10) {
        this.clockEventPool.push(nextClockEvent);
      }
    }
    const { nextInterrupt } = this;
    if (this.interruptsEnabled && nextInterrupt >= 0) {
      const interrupt = this.pendingInterrupts[nextInterrupt];
      avrInterrupt(this, interrupt.address);
      if (!interrupt.constant) {
        this.clearInterrupt(interrupt);
      }
    }
  }
};

// ../node_modules/avr8js/dist/esm/cpu/instruction.js
function isTwoWordInstruction(opcode) {
  return (
    /* LDS */
    (opcode & 65039) === 36864 || /* STS */
    (opcode & 65039) === 37376 || /* CALL */
    (opcode & 65038) === 37902 || /* JMP */
    (opcode & 65038) === 37900
  );
}
function avrInstruction(cpu) {
  const opcode = cpu.progMem[cpu.pc];
  if ((opcode & 64512) === 7168) {
    const d = cpu.data[(opcode & 496) >> 4];
    const r = cpu.data[opcode & 15 | (opcode & 512) >> 5];
    const sum = d + r + (cpu.data[95] & 1);
    const R = sum & 255;
    cpu.data[(opcode & 496) >> 4] = R;
    let sreg = cpu.data[95] & 192;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= (R ^ r) & (d ^ R) & 128 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= sum & 256 ? 1 : 0;
    sreg |= 1 & (d & r | r & ~R | ~R & d) ? 32 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 64512) === 3072) {
    const d = cpu.data[(opcode & 496) >> 4];
    const r = cpu.data[opcode & 15 | (opcode & 512) >> 5];
    const R = d + r & 255;
    cpu.data[(opcode & 496) >> 4] = R;
    let sreg = cpu.data[95] & 192;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= (R ^ r) & (R ^ d) & 128 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= d + r & 256 ? 1 : 0;
    sreg |= 1 & (d & r | r & ~R | ~R & d) ? 32 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 65280) === 38400) {
    const addr = 2 * ((opcode & 48) >> 4) + 24;
    const value = cpu.dataView.getUint16(addr, true);
    const R = value + (opcode & 15 | (opcode & 192) >> 2) & 65535;
    cpu.dataView.setUint16(addr, R, true);
    let sreg = cpu.data[95] & 224;
    sreg |= R ? 0 : 2;
    sreg |= 32768 & R ? 4 : 0;
    sreg |= ~value & R & 32768 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= ~R & value & 32768 ? 1 : 0;
    cpu.data[95] = sreg;
    cpu.cycles++;
  } else if ((opcode & 64512) === 8192) {
    const R = cpu.data[(opcode & 496) >> 4] & cpu.data[opcode & 15 | (opcode & 512) >> 5];
    cpu.data[(opcode & 496) >> 4] = R;
    let sreg = cpu.data[95] & 225;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 61440) === 28672) {
    const R = cpu.data[((opcode & 240) >> 4) + 16] & (opcode & 15 | (opcode & 3840) >> 4);
    cpu.data[((opcode & 240) >> 4) + 16] = R;
    let sreg = cpu.data[95] & 225;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 65039) === 37893) {
    const value = cpu.data[(opcode & 496) >> 4];
    const R = value >>> 1 | 128 & value;
    cpu.data[(opcode & 496) >> 4] = R;
    let sreg = cpu.data[95] & 224;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= value & 1;
    sreg |= sreg >> 2 & 1 ^ sreg & 1 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 65423) === 38024) {
    cpu.data[95] &= ~(1 << ((opcode & 112) >> 4));
  } else if ((opcode & 65032) === 63488) {
    const b = opcode & 7;
    const d = (opcode & 496) >> 4;
    cpu.data[d] = ~(1 << b) & cpu.data[d] | (cpu.data[95] >> 6 & 1) << b;
  } else if ((opcode & 64512) === 62464) {
    if (!(cpu.data[95] & 1 << (opcode & 7))) {
      cpu.pc = cpu.pc + (((opcode & 504) >> 3) - (opcode & 512 ? 64 : 0));
      cpu.cycles++;
    }
  } else if ((opcode & 64512) === 61440) {
    if (cpu.data[95] & 1 << (opcode & 7)) {
      cpu.pc = cpu.pc + (((opcode & 504) >> 3) - (opcode & 512 ? 64 : 0));
      cpu.cycles++;
    }
  } else if ((opcode & 65423) === 37896) {
    cpu.data[95] |= 1 << ((opcode & 112) >> 4);
  } else if ((opcode & 65032) === 64e3) {
    const d = cpu.data[(opcode & 496) >> 4];
    const b = opcode & 7;
    cpu.data[95] = cpu.data[95] & 191 | (d >> b & 1 ? 64 : 0);
  } else if ((opcode & 65038) === 37902) {
    const k = cpu.progMem[cpu.pc + 1] | (opcode & 1) << 16 | (opcode & 496) << 13;
    const ret = cpu.pc + 2;
    const sp = cpu.dataView.getUint16(93, true);
    const { pc22Bits } = cpu;
    cpu.data[sp] = 255 & ret;
    cpu.data[sp - 1] = ret >> 8 & 255;
    if (pc22Bits) {
      cpu.data[sp - 2] = ret >> 16 & 255;
    }
    cpu.dataView.setUint16(93, sp - (pc22Bits ? 3 : 2), true);
    cpu.pc = k - 1;
    cpu.cycles += pc22Bits ? 4 : 3;
  } else if ((opcode & 65280) === 38912) {
    const A = opcode & 248;
    const b = opcode & 7;
    const R = cpu.readData((A >> 3) + 32);
    const mask = 1 << b;
    cpu.writeData((A >> 3) + 32, R & ~mask, mask);
  } else if ((opcode & 65039) === 37888) {
    const d = (opcode & 496) >> 4;
    const R = 255 - cpu.data[d];
    cpu.data[d] = R;
    let sreg = cpu.data[95] & 225 | 1;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 64512) === 5120) {
    const val1 = cpu.data[(opcode & 496) >> 4];
    const val2 = cpu.data[opcode & 15 | (opcode & 512) >> 5];
    const R = val1 - val2;
    let sreg = cpu.data[95] & 192;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= 0 !== ((val1 ^ val2) & (val1 ^ R) & 128) ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= val2 > val1 ? 1 : 0;
    sreg |= 1 & (~val1 & val2 | val2 & R | R & ~val1) ? 32 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 64512) === 1024) {
    const arg1 = cpu.data[(opcode & 496) >> 4];
    const arg2 = cpu.data[opcode & 15 | (opcode & 512) >> 5];
    let sreg = cpu.data[95];
    const r = arg1 - arg2 - (sreg & 1);
    sreg = sreg & 192 | (!r && sreg >> 1 & 1 ? 2 : 0) | (arg2 + (sreg & 1) > arg1 ? 1 : 0);
    sreg |= 128 & r ? 4 : 0;
    sreg |= (arg1 ^ arg2) & (arg1 ^ r) & 128 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= 1 & (~arg1 & arg2 | arg2 & r | r & ~arg1) ? 32 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 61440) === 12288) {
    const arg1 = cpu.data[((opcode & 240) >> 4) + 16];
    const arg2 = opcode & 15 | (opcode & 3840) >> 4;
    const r = arg1 - arg2;
    let sreg = cpu.data[95] & 192;
    sreg |= r ? 0 : 2;
    sreg |= 128 & r ? 4 : 0;
    sreg |= (arg1 ^ arg2) & (arg1 ^ r) & 128 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= arg2 > arg1 ? 1 : 0;
    sreg |= 1 & (~arg1 & arg2 | arg2 & r | r & ~arg1) ? 32 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 64512) === 4096) {
    if (cpu.data[(opcode & 496) >> 4] === cpu.data[opcode & 15 | (opcode & 512) >> 5]) {
      const nextOpcode = cpu.progMem[cpu.pc + 1];
      const skipSize = isTwoWordInstruction(nextOpcode) ? 2 : 1;
      cpu.pc += skipSize;
      cpu.cycles += skipSize;
    }
  } else if ((opcode & 65039) === 37898) {
    const value = cpu.data[(opcode & 496) >> 4];
    const R = value - 1;
    cpu.data[(opcode & 496) >> 4] = R;
    let sreg = cpu.data[95] & 225;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= 128 === value ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if (opcode === 38169) {
    const retAddr = cpu.pc + 1;
    const sp = cpu.dataView.getUint16(93, true);
    const eind = cpu.data[92];
    cpu.data[sp] = retAddr & 255;
    cpu.data[sp - 1] = retAddr >> 8 & 255;
    cpu.data[sp - 2] = retAddr >> 16 & 255;
    cpu.dataView.setUint16(93, sp - 3, true);
    cpu.pc = (eind << 16 | cpu.dataView.getUint16(30, true)) - 1;
    cpu.cycles += 3;
  } else if (opcode === 37913) {
    const eind = cpu.data[92];
    cpu.pc = (eind << 16 | cpu.dataView.getUint16(30, true)) - 1;
    cpu.cycles++;
  } else if (opcode === 38360) {
    const rampz = cpu.data[91];
    cpu.data[0] = cpu.progBytes[rampz << 16 | cpu.dataView.getUint16(30, true)];
    cpu.cycles += 2;
  } else if ((opcode & 65039) === 36870) {
    const rampz = cpu.data[91];
    cpu.data[(opcode & 496) >> 4] = cpu.progBytes[rampz << 16 | cpu.dataView.getUint16(30, true)];
    cpu.cycles += 2;
  } else if ((opcode & 65039) === 36871) {
    const rampz = cpu.data[91];
    const i = cpu.dataView.getUint16(30, true);
    cpu.data[(opcode & 496) >> 4] = cpu.progBytes[rampz << 16 | i];
    cpu.dataView.setUint16(30, i + 1, true);
    if (i === 65535) {
      cpu.data[91] = (rampz + 1) % (cpu.progBytes.length >> 16);
    }
    cpu.cycles += 2;
  } else if ((opcode & 64512) === 9216) {
    const R = cpu.data[(opcode & 496) >> 4] ^ cpu.data[opcode & 15 | (opcode & 512) >> 5];
    cpu.data[(opcode & 496) >> 4] = R;
    let sreg = cpu.data[95] & 225;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 65416) === 776) {
    const v1 = cpu.data[((opcode & 112) >> 4) + 16];
    const v2 = cpu.data[(opcode & 7) + 16];
    const R = v1 * v2 << 1;
    cpu.dataView.setUint16(0, R, true);
    cpu.data[95] = cpu.data[95] & 252 | (65535 & R ? 0 : 2) | (v1 * v2 & 32768 ? 1 : 0);
    cpu.cycles++;
  } else if ((opcode & 65416) === 896) {
    const v1 = cpu.dataView.getInt8(((opcode & 112) >> 4) + 16);
    const v2 = cpu.dataView.getInt8((opcode & 7) + 16);
    const R = v1 * v2 << 1;
    cpu.dataView.setInt16(0, R, true);
    cpu.data[95] = cpu.data[95] & 252 | (65535 & R ? 0 : 2) | (v1 * v2 & 32768 ? 1 : 0);
    cpu.cycles++;
  } else if ((opcode & 65416) === 904) {
    const v1 = cpu.dataView.getInt8(((opcode & 112) >> 4) + 16);
    const v2 = cpu.data[(opcode & 7) + 16];
    const R = v1 * v2 << 1;
    cpu.dataView.setInt16(0, R, true);
    cpu.data[95] = cpu.data[95] & 252 | (65535 & R ? 2 : 0) | (v1 * v2 & 32768 ? 1 : 0);
    cpu.cycles++;
  } else if (opcode === 38153) {
    const retAddr = cpu.pc + 1;
    const sp = cpu.dataView.getUint16(93, true);
    const { pc22Bits } = cpu;
    cpu.data[sp] = retAddr & 255;
    cpu.data[sp - 1] = retAddr >> 8 & 255;
    if (pc22Bits) {
      cpu.data[sp - 2] = retAddr >> 16 & 255;
    }
    cpu.dataView.setUint16(93, sp - (pc22Bits ? 3 : 2), true);
    cpu.pc = cpu.dataView.getUint16(30, true) - 1;
    cpu.cycles += pc22Bits ? 3 : 2;
  } else if (opcode === 37897) {
    cpu.pc = cpu.dataView.getUint16(30, true) - 1;
    cpu.cycles++;
  } else if ((opcode & 63488) === 45056) {
    const i = cpu.readData((opcode & 15 | (opcode & 1536) >> 5) + 32);
    cpu.data[(opcode & 496) >> 4] = i;
  } else if ((opcode & 65039) === 37891) {
    const d = cpu.data[(opcode & 496) >> 4];
    const r = d + 1 & 255;
    cpu.data[(opcode & 496) >> 4] = r;
    let sreg = cpu.data[95] & 225;
    sreg |= r ? 0 : 2;
    sreg |= 128 & r ? 4 : 0;
    sreg |= 127 === d ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 65038) === 37900) {
    cpu.pc = (cpu.progMem[cpu.pc + 1] | (opcode & 1) << 16 | (opcode & 496) << 13) - 1;
    cpu.cycles += 2;
  } else if ((opcode & 65039) === 37382) {
    const r = (opcode & 496) >> 4;
    const clear = cpu.data[r];
    const value = cpu.readData(cpu.dataView.getUint16(30, true));
    cpu.writeData(cpu.dataView.getUint16(30, true), value & 255 - clear);
    cpu.data[r] = value;
  } else if ((opcode & 65039) === 37381) {
    const r = (opcode & 496) >> 4;
    const set = cpu.data[r];
    const value = cpu.readData(cpu.dataView.getUint16(30, true));
    cpu.writeData(cpu.dataView.getUint16(30, true), value | set);
    cpu.data[r] = value;
  } else if ((opcode & 65039) === 37383) {
    const r = cpu.data[(opcode & 496) >> 4];
    const R = cpu.readData(cpu.dataView.getUint16(30, true));
    cpu.writeData(cpu.dataView.getUint16(30, true), r ^ R);
    cpu.data[(opcode & 496) >> 4] = R;
  } else if ((opcode & 61440) === 57344) {
    cpu.data[((opcode & 240) >> 4) + 16] = opcode & 15 | (opcode & 3840) >> 4;
  } else if ((opcode & 65039) === 36864) {
    cpu.cycles++;
    const value = cpu.readData(cpu.progMem[cpu.pc + 1]);
    cpu.data[(opcode & 496) >> 4] = value;
    cpu.pc++;
  } else if ((opcode & 65039) === 36876) {
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(cpu.dataView.getUint16(26, true));
  } else if ((opcode & 65039) === 36877) {
    const x = cpu.dataView.getUint16(26, true);
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(x);
    cpu.dataView.setUint16(26, x + 1, true);
  } else if ((opcode & 65039) === 36878) {
    const x = cpu.dataView.getUint16(26, true) - 1;
    cpu.dataView.setUint16(26, x, true);
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(x);
  } else if ((opcode & 65039) === 32776) {
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(cpu.dataView.getUint16(28, true));
  } else if ((opcode & 65039) === 36873) {
    const y = cpu.dataView.getUint16(28, true);
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(y);
    cpu.dataView.setUint16(28, y + 1, true);
  } else if ((opcode & 65039) === 36874) {
    const y = cpu.dataView.getUint16(28, true) - 1;
    cpu.dataView.setUint16(28, y, true);
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(y);
  } else if ((opcode & 53768) === 32776 && opcode & 7 | (opcode & 3072) >> 7 | (opcode & 8192) >> 8) {
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(cpu.dataView.getUint16(28, true) + (opcode & 7 | (opcode & 3072) >> 7 | (opcode & 8192) >> 8));
  } else if ((opcode & 65039) === 32768) {
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(cpu.dataView.getUint16(30, true));
  } else if ((opcode & 65039) === 36865) {
    const z = cpu.dataView.getUint16(30, true);
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(z);
    cpu.dataView.setUint16(30, z + 1, true);
  } else if ((opcode & 65039) === 36866) {
    const z = cpu.dataView.getUint16(30, true) - 1;
    cpu.dataView.setUint16(30, z, true);
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(z);
  } else if ((opcode & 53768) === 32768 && opcode & 7 | (opcode & 3072) >> 7 | (opcode & 8192) >> 8) {
    cpu.cycles++;
    cpu.data[(opcode & 496) >> 4] = cpu.readData(cpu.dataView.getUint16(30, true) + (opcode & 7 | (opcode & 3072) >> 7 | (opcode & 8192) >> 8));
  } else if (opcode === 38344) {
    cpu.data[0] = cpu.progBytes[cpu.dataView.getUint16(30, true)];
    cpu.cycles += 2;
  } else if ((opcode & 65039) === 36868) {
    cpu.data[(opcode & 496) >> 4] = cpu.progBytes[cpu.dataView.getUint16(30, true)];
    cpu.cycles += 2;
  } else if ((opcode & 65039) === 36869) {
    const i = cpu.dataView.getUint16(30, true);
    cpu.data[(opcode & 496) >> 4] = cpu.progBytes[i];
    cpu.dataView.setUint16(30, i + 1, true);
    cpu.cycles += 2;
  } else if ((opcode & 65039) === 37894) {
    const value = cpu.data[(opcode & 496) >> 4];
    const R = value >>> 1;
    cpu.data[(opcode & 496) >> 4] = R;
    let sreg = cpu.data[95] & 224;
    sreg |= R ? 0 : 2;
    sreg |= value & 1;
    sreg |= sreg >> 2 & 1 ^ sreg & 1 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 64512) === 11264) {
    cpu.data[(opcode & 496) >> 4] = cpu.data[opcode & 15 | (opcode & 512) >> 5];
  } else if ((opcode & 65280) === 256) {
    const r2 = 2 * (opcode & 15);
    const d2 = 2 * ((opcode & 240) >> 4);
    cpu.data[d2] = cpu.data[r2];
    cpu.data[d2 + 1] = cpu.data[r2 + 1];
  } else if ((opcode & 64512) === 39936) {
    const R = cpu.data[(opcode & 496) >> 4] * cpu.data[opcode & 15 | (opcode & 512) >> 5];
    cpu.dataView.setUint16(0, R, true);
    cpu.data[95] = cpu.data[95] & 252 | (65535 & R ? 0 : 2) | (32768 & R ? 1 : 0);
    cpu.cycles++;
  } else if ((opcode & 65280) === 512) {
    const R = cpu.dataView.getInt8(((opcode & 240) >> 4) + 16) * cpu.dataView.getInt8((opcode & 15) + 16);
    cpu.dataView.setInt16(0, R, true);
    cpu.data[95] = cpu.data[95] & 252 | (65535 & R ? 0 : 2) | (32768 & R ? 1 : 0);
    cpu.cycles++;
  } else if ((opcode & 65416) === 768) {
    const R = cpu.dataView.getInt8(((opcode & 112) >> 4) + 16) * cpu.data[(opcode & 7) + 16];
    cpu.dataView.setInt16(0, R, true);
    cpu.data[95] = cpu.data[95] & 252 | (65535 & R ? 0 : 2) | (32768 & R ? 1 : 0);
    cpu.cycles++;
  } else if ((opcode & 65039) === 37889) {
    const d = (opcode & 496) >> 4;
    const value = cpu.data[d];
    const R = 0 - value;
    cpu.data[d] = R;
    let sreg = cpu.data[95] & 192;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= 128 === R ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= R ? 1 : 0;
    sreg |= 1 & (R | value) ? 32 : 0;
    cpu.data[95] = sreg;
  } else if (opcode === 0) {
  } else if ((opcode & 64512) === 10240) {
    const R = cpu.data[(opcode & 496) >> 4] | cpu.data[opcode & 15 | (opcode & 512) >> 5];
    cpu.data[(opcode & 496) >> 4] = R;
    let sreg = cpu.data[95] & 225;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 61440) === 24576) {
    const R = cpu.data[((opcode & 240) >> 4) + 16] | (opcode & 15 | (opcode & 3840) >> 4);
    cpu.data[((opcode & 240) >> 4) + 16] = R;
    let sreg = cpu.data[95] & 225;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 63488) === 47104) {
    cpu.writeData((opcode & 15 | (opcode & 1536) >> 5) + 32, cpu.data[(opcode & 496) >> 4]);
  } else if ((opcode & 65039) === 36879) {
    const value = cpu.dataView.getUint16(93, true) + 1;
    cpu.dataView.setUint16(93, value, true);
    cpu.data[(opcode & 496) >> 4] = cpu.data[value];
    cpu.cycles++;
  } else if ((opcode & 65039) === 37391) {
    const value = cpu.dataView.getUint16(93, true);
    cpu.data[value] = cpu.data[(opcode & 496) >> 4];
    cpu.dataView.setUint16(93, value - 1, true);
    cpu.cycles++;
  } else if ((opcode & 61440) === 53248) {
    const k = (opcode & 2047) - (opcode & 2048 ? 2048 : 0);
    const retAddr = cpu.pc + 1;
    const sp = cpu.dataView.getUint16(93, true);
    const { pc22Bits } = cpu;
    cpu.data[sp] = 255 & retAddr;
    cpu.data[sp - 1] = retAddr >> 8 & 255;
    if (pc22Bits) {
      cpu.data[sp - 2] = retAddr >> 16 & 255;
    }
    cpu.dataView.setUint16(93, sp - (pc22Bits ? 3 : 2), true);
    cpu.pc += k;
    cpu.cycles += pc22Bits ? 3 : 2;
  } else if (opcode === 38152) {
    const { pc22Bits } = cpu;
    const i = cpu.dataView.getUint16(93, true) + (pc22Bits ? 3 : 2);
    cpu.dataView.setUint16(93, i, true);
    cpu.pc = (cpu.data[i - 1] << 8) + cpu.data[i] - 1;
    if (pc22Bits) {
      cpu.pc |= cpu.data[i - 2] << 16;
    }
    cpu.cycles += pc22Bits ? 4 : 3;
  } else if (opcode === 38168) {
    const { pc22Bits } = cpu;
    const i = cpu.dataView.getUint16(93, true) + (pc22Bits ? 3 : 2);
    cpu.dataView.setUint16(93, i, true);
    cpu.pc = (cpu.data[i - 1] << 8) + cpu.data[i] - 1;
    if (pc22Bits) {
      cpu.pc |= cpu.data[i - 2] << 16;
    }
    cpu.cycles += pc22Bits ? 4 : 3;
    cpu.data[95] |= 128;
  } else if ((opcode & 61440) === 49152) {
    cpu.pc = cpu.pc + ((opcode & 2047) - (opcode & 2048 ? 2048 : 0));
    cpu.cycles++;
  } else if ((opcode & 65039) === 37895) {
    const d = cpu.data[(opcode & 496) >> 4];
    const r = d >>> 1 | (cpu.data[95] & 1) << 7;
    cpu.data[(opcode & 496) >> 4] = r;
    let sreg = cpu.data[95] & 224;
    sreg |= r ? 0 : 2;
    sreg |= 128 & r ? 4 : 0;
    sreg |= 1 & d ? 1 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg & 1 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 64512) === 2048) {
    const val1 = cpu.data[(opcode & 496) >> 4];
    const val2 = cpu.data[opcode & 15 | (opcode & 512) >> 5];
    let sreg = cpu.data[95];
    const R = val1 - val2 - (sreg & 1);
    cpu.data[(opcode & 496) >> 4] = R;
    sreg = sreg & 192 | (!R && sreg >> 1 & 1 ? 2 : 0) | (val2 + (sreg & 1) > val1 ? 1 : 0);
    sreg |= 128 & R ? 4 : 0;
    sreg |= (val1 ^ val2) & (val1 ^ R) & 128 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= 1 & (~val1 & val2 | val2 & R | R & ~val1) ? 32 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 61440) === 16384) {
    const val1 = cpu.data[((opcode & 240) >> 4) + 16];
    const val2 = opcode & 15 | (opcode & 3840) >> 4;
    let sreg = cpu.data[95];
    const R = val1 - val2 - (sreg & 1);
    cpu.data[((opcode & 240) >> 4) + 16] = R;
    sreg = sreg & 192 | (!R && sreg >> 1 & 1 ? 2 : 0) | (val2 + (sreg & 1) > val1 ? 1 : 0);
    sreg |= 128 & R ? 4 : 0;
    sreg |= (val1 ^ val2) & (val1 ^ R) & 128 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= 1 & (~val1 & val2 | val2 & R | R & ~val1) ? 32 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 65280) === 39424) {
    const target = ((opcode & 248) >> 3) + 32;
    const mask = 1 << (opcode & 7);
    cpu.writeData(target, cpu.readData(target) | mask, mask);
    cpu.cycles++;
  } else if ((opcode & 65280) === 39168) {
    const value = cpu.readData(((opcode & 248) >> 3) + 32);
    if (!(value & 1 << (opcode & 7))) {
      const nextOpcode = cpu.progMem[cpu.pc + 1];
      const skipSize = isTwoWordInstruction(nextOpcode) ? 2 : 1;
      cpu.cycles += skipSize;
      cpu.pc += skipSize;
    }
  } else if ((opcode & 65280) === 39680) {
    const value = cpu.readData(((opcode & 248) >> 3) + 32);
    if (value & 1 << (opcode & 7)) {
      const nextOpcode = cpu.progMem[cpu.pc + 1];
      const skipSize = isTwoWordInstruction(nextOpcode) ? 2 : 1;
      cpu.cycles += skipSize;
      cpu.pc += skipSize;
    }
  } else if ((opcode & 65280) === 38656) {
    const i = 2 * ((opcode & 48) >> 4) + 24;
    const a = cpu.dataView.getUint16(i, true);
    const l = opcode & 15 | (opcode & 192) >> 2;
    const R = a - l;
    cpu.dataView.setUint16(i, R, true);
    let sreg = cpu.data[95] & 192;
    sreg |= R ? 0 : 2;
    sreg |= 32768 & R ? 4 : 0;
    sreg |= a & ~R & 32768 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= l > a ? 1 : 0;
    sreg |= 1 & (~a & l | l & R | R & ~a) ? 32 : 0;
    cpu.data[95] = sreg;
    cpu.cycles++;
  } else if ((opcode & 65032) === 64512) {
    if (!(cpu.data[(opcode & 496) >> 4] & 1 << (opcode & 7))) {
      const nextOpcode = cpu.progMem[cpu.pc + 1];
      const skipSize = isTwoWordInstruction(nextOpcode) ? 2 : 1;
      cpu.cycles += skipSize;
      cpu.pc += skipSize;
    }
  } else if ((opcode & 65032) === 65024) {
    if (cpu.data[(opcode & 496) >> 4] & 1 << (opcode & 7)) {
      const nextOpcode = cpu.progMem[cpu.pc + 1];
      const skipSize = isTwoWordInstruction(nextOpcode) ? 2 : 1;
      cpu.cycles += skipSize;
      cpu.pc += skipSize;
    }
  } else if (opcode === 38280) {
  } else if (opcode === 38376) {
  } else if (opcode === 38392) {
  } else if ((opcode & 65039) === 37376) {
    const value = cpu.data[(opcode & 496) >> 4];
    const addr = cpu.progMem[cpu.pc + 1];
    cpu.writeData(addr, value);
    cpu.pc++;
    cpu.cycles++;
  } else if ((opcode & 65039) === 37388) {
    cpu.writeData(cpu.dataView.getUint16(26, true), cpu.data[(opcode & 496) >> 4]);
    cpu.cycles++;
  } else if ((opcode & 65039) === 37389) {
    const x = cpu.dataView.getUint16(26, true);
    cpu.writeData(x, cpu.data[(opcode & 496) >> 4]);
    cpu.dataView.setUint16(26, x + 1, true);
    cpu.cycles++;
  } else if ((opcode & 65039) === 37390) {
    const i = cpu.data[(opcode & 496) >> 4];
    const x = cpu.dataView.getUint16(26, true) - 1;
    cpu.dataView.setUint16(26, x, true);
    cpu.writeData(x, i);
    cpu.cycles++;
  } else if ((opcode & 65039) === 33288) {
    cpu.writeData(cpu.dataView.getUint16(28, true), cpu.data[(opcode & 496) >> 4]);
    cpu.cycles++;
  } else if ((opcode & 65039) === 37385) {
    const i = cpu.data[(opcode & 496) >> 4];
    const y = cpu.dataView.getUint16(28, true);
    cpu.writeData(y, i);
    cpu.dataView.setUint16(28, y + 1, true);
    cpu.cycles++;
  } else if ((opcode & 65039) === 37386) {
    const i = cpu.data[(opcode & 496) >> 4];
    const y = cpu.dataView.getUint16(28, true) - 1;
    cpu.dataView.setUint16(28, y, true);
    cpu.writeData(y, i);
    cpu.cycles++;
  } else if ((opcode & 53768) === 33288 && opcode & 7 | (opcode & 3072) >> 7 | (opcode & 8192) >> 8) {
    cpu.writeData(cpu.dataView.getUint16(28, true) + (opcode & 7 | (opcode & 3072) >> 7 | (opcode & 8192) >> 8), cpu.data[(opcode & 496) >> 4]);
    cpu.cycles++;
  } else if ((opcode & 65039) === 33280) {
    cpu.writeData(cpu.dataView.getUint16(30, true), cpu.data[(opcode & 496) >> 4]);
    cpu.cycles++;
  } else if ((opcode & 65039) === 37377) {
    const z = cpu.dataView.getUint16(30, true);
    cpu.writeData(z, cpu.data[(opcode & 496) >> 4]);
    cpu.dataView.setUint16(30, z + 1, true);
    cpu.cycles++;
  } else if ((opcode & 65039) === 37378) {
    const i = cpu.data[(opcode & 496) >> 4];
    const z = cpu.dataView.getUint16(30, true) - 1;
    cpu.dataView.setUint16(30, z, true);
    cpu.writeData(z, i);
    cpu.cycles++;
  } else if ((opcode & 53768) === 33280 && opcode & 7 | (opcode & 3072) >> 7 | (opcode & 8192) >> 8) {
    cpu.writeData(cpu.dataView.getUint16(30, true) + (opcode & 7 | (opcode & 3072) >> 7 | (opcode & 8192) >> 8), cpu.data[(opcode & 496) >> 4]);
    cpu.cycles++;
  } else if ((opcode & 64512) === 6144) {
    const val1 = cpu.data[(opcode & 496) >> 4];
    const val2 = cpu.data[opcode & 15 | (opcode & 512) >> 5];
    const R = val1 - val2;
    cpu.data[(opcode & 496) >> 4] = R;
    let sreg = cpu.data[95] & 192;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= (val1 ^ val2) & (val1 ^ R) & 128 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= val2 > val1 ? 1 : 0;
    sreg |= 1 & (~val1 & val2 | val2 & R | R & ~val1) ? 32 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 61440) === 20480) {
    const val1 = cpu.data[((opcode & 240) >> 4) + 16];
    const val2 = opcode & 15 | (opcode & 3840) >> 4;
    const R = val1 - val2;
    cpu.data[((opcode & 240) >> 4) + 16] = R;
    let sreg = cpu.data[95] & 192;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= (val1 ^ val2) & (val1 ^ R) & 128 ? 8 : 0;
    sreg |= sreg >> 2 & 1 ^ sreg >> 3 & 1 ? 16 : 0;
    sreg |= val2 > val1 ? 1 : 0;
    sreg |= 1 & (~val1 & val2 | val2 & R | R & ~val1) ? 32 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 65039) === 37890) {
    const d = (opcode & 496) >> 4;
    const i = cpu.data[d];
    cpu.data[d] = (15 & i) << 4 | (240 & i) >>> 4;
  } else if (opcode === 38312) {
    cpu.onWatchdogReset();
  } else if ((opcode & 65039) === 37380) {
    const r = (opcode & 496) >> 4;
    const val1 = cpu.data[r];
    const val2 = cpu.data[cpu.dataView.getUint16(30, true)];
    cpu.data[cpu.dataView.getUint16(30, true)] = val1;
    cpu.data[r] = val2;
  }
  cpu.pc = (cpu.pc + 1) % cpu.progMem.length;
  cpu.cycles++;
}

// ../node_modules/avr8js/dist/esm/peripherals/adc.js
var ADCReference;
(function(ADCReference2) {
  ADCReference2[ADCReference2["AVCC"] = 0] = "AVCC";
  ADCReference2[ADCReference2["AREF"] = 1] = "AREF";
  ADCReference2[ADCReference2["Internal1V1"] = 2] = "Internal1V1";
  ADCReference2[ADCReference2["Internal2V56"] = 3] = "Internal2V56";
  ADCReference2[ADCReference2["Reserved"] = 4] = "Reserved";
})(ADCReference || (ADCReference = {}));
var ADCMuxInputType;
(function(ADCMuxInputType2) {
  ADCMuxInputType2[ADCMuxInputType2["SingleEnded"] = 0] = "SingleEnded";
  ADCMuxInputType2[ADCMuxInputType2["Differential"] = 1] = "Differential";
  ADCMuxInputType2[ADCMuxInputType2["Constant"] = 2] = "Constant";
  ADCMuxInputType2[ADCMuxInputType2["Temperature"] = 3] = "Temperature";
})(ADCMuxInputType || (ADCMuxInputType = {}));
var atmega328Channels = {
  0: { type: ADCMuxInputType.SingleEnded, channel: 0 },
  1: { type: ADCMuxInputType.SingleEnded, channel: 1 },
  2: { type: ADCMuxInputType.SingleEnded, channel: 2 },
  3: { type: ADCMuxInputType.SingleEnded, channel: 3 },
  4: { type: ADCMuxInputType.SingleEnded, channel: 4 },
  5: { type: ADCMuxInputType.SingleEnded, channel: 5 },
  6: { type: ADCMuxInputType.SingleEnded, channel: 6 },
  7: { type: ADCMuxInputType.SingleEnded, channel: 7 },
  8: { type: ADCMuxInputType.Temperature },
  14: { type: ADCMuxInputType.Constant, voltage: 1.1 },
  15: { type: ADCMuxInputType.Constant, voltage: 0 }
};
var fallbackMuxInput = {
  type: ADCMuxInputType.Constant,
  voltage: 0
};
var adcConfig = {
  ADMUX: 124,
  ADCSRA: 122,
  ADCSRB: 123,
  ADCL: 120,
  ADCH: 121,
  DIDR0: 126,
  adcInterrupt: 42,
  numChannels: 8,
  muxInputMask: 15,
  muxChannels: atmega328Channels,
  adcReferences: [
    ADCReference.AREF,
    ADCReference.AVCC,
    ADCReference.Reserved,
    ADCReference.Internal1V1
  ]
};
var ADPS_MASK = 7;
var ADIE = 8;
var ADIF = 16;
var ADSC = 64;
var ADEN = 128;
var MUX_MASK = 31;
var ADLAR = 32;
var MUX5 = 8;
var REFS2 = 8;
var REFS_MASK = 3;
var REFS_SHIFT = 6;
var AVRADC = class {
  constructor(cpu, config) {
    this.cpu = cpu;
    this.config = config;
    this.channelValues = new Array(this.config.numChannels);
    this.avcc = 5;
    this.aref = 5;
    this.onADCRead = (input) => {
      var _a;
      let voltage = 0;
      switch (input.type) {
        case ADCMuxInputType.Constant:
          voltage = input.voltage;
          break;
        case ADCMuxInputType.SingleEnded:
          voltage = (_a = this.channelValues[input.channel]) !== null && _a !== void 0 ? _a : 0;
          break;
        case ADCMuxInputType.Differential:
          voltage = input.gain * ((this.channelValues[input.positiveChannel] || 0) - (this.channelValues[input.negativeChannel] || 0));
          break;
        case ADCMuxInputType.Temperature:
          voltage = 0.378125;
          break;
      }
      const rawValue = voltage / this.referenceVoltage * 1024;
      const result = Math.min(Math.max(Math.floor(rawValue), 0), 1023);
      this.cpu.addClockEvent(() => this.completeADCRead(result), this.sampleCycles);
    };
    this.converting = false;
    this.conversionCycles = 25;
    this.ADC = {
      address: this.config.adcInterrupt,
      flagRegister: this.config.ADCSRA,
      flagMask: ADIF,
      enableRegister: this.config.ADCSRA,
      enableMask: ADIE
    };
    cpu.writeHooks[config.ADCSRA] = (value, oldValue) => {
      var _a;
      if (value & ADEN && !(oldValue && ADEN)) {
        this.conversionCycles = 25;
      }
      cpu.data[config.ADCSRA] = value;
      cpu.updateInterruptEnable(this.ADC, value);
      if (!this.converting && value & ADSC) {
        if (!(value & ADEN)) {
          this.cpu.addClockEvent(() => this.completeADCRead(0), this.sampleCycles);
          return true;
        }
        let channel = this.cpu.data[this.config.ADMUX] & MUX_MASK;
        if (cpu.data[config.ADCSRB] & MUX5) {
          channel |= 32;
        }
        channel &= config.muxInputMask;
        const muxInput = (_a = config.muxChannels[channel]) !== null && _a !== void 0 ? _a : fallbackMuxInput;
        this.converting = true;
        this.onADCRead(muxInput);
        return true;
      }
    };
  }
  completeADCRead(value) {
    const { ADCL, ADCH, ADMUX, ADCSRA } = this.config;
    this.converting = false;
    this.conversionCycles = 13;
    if (this.cpu.data[ADMUX] & ADLAR) {
      this.cpu.data[ADCL] = value << 6 & 255;
      this.cpu.data[ADCH] = value >> 2;
    } else {
      this.cpu.data[ADCL] = value & 255;
      this.cpu.data[ADCH] = value >> 8 & 3;
    }
    this.cpu.data[ADCSRA] &= ~ADSC;
    this.cpu.setInterruptFlag(this.ADC);
  }
  get prescaler() {
    const { ADCSRA } = this.config;
    const adcsra = this.cpu.data[ADCSRA];
    const adps = adcsra & ADPS_MASK;
    switch (adps) {
      case 0:
      case 1:
        return 2;
      case 2:
        return 4;
      case 3:
        return 8;
      case 4:
        return 16;
      case 5:
        return 32;
      case 6:
        return 64;
      case 7:
      default:
        return 128;
    }
  }
  get referenceVoltageType() {
    var _a;
    const { ADMUX, adcReferences } = this.config;
    let refs = this.cpu.data[ADMUX] >> REFS_SHIFT & REFS_MASK;
    if (adcReferences.length > 4 && this.cpu.data[ADMUX] & REFS2) {
      refs |= 4;
    }
    return (_a = adcReferences[refs]) !== null && _a !== void 0 ? _a : ADCReference.Reserved;
  }
  get referenceVoltage() {
    switch (this.referenceVoltageType) {
      case ADCReference.AVCC:
        return this.avcc;
      case ADCReference.AREF:
        return this.aref;
      case ADCReference.Internal1V1:
        return 1.1;
      case ADCReference.Internal2V56:
        return 2.56;
      default:
        return this.avcc;
    }
  }
  get sampleCycles() {
    return this.conversionCycles * this.prescaler;
  }
};

// ../node_modules/avr8js/dist/esm/peripherals/eeprom.js
var EERE = 1 << 0;
var EEPE = 1 << 1;
var EEMPE = 1 << 2;
var EERIE = 1 << 3;
var EEPM0 = 1 << 4;
var EEPM1 = 1 << 5;
var EECR_WRITE_MASK = EEPE | EEMPE | EERIE | EEPM0 | EEPM1;

// ../node_modules/avr8js/dist/esm/peripherals/gpio.js
var INT0 = {
  EICR: 105,
  EIMSK: 61,
  EIFR: 60,
  index: 0,
  iscOffset: 0,
  interrupt: 2
};
var INT1 = {
  EICR: 105,
  EIMSK: 61,
  EIFR: 60,
  index: 1,
  iscOffset: 2,
  interrupt: 4
};
var PCINT0 = {
  PCIE: 0,
  PCICR: 104,
  PCIFR: 59,
  PCMSK: 107,
  pinChangeInterrupt: 6,
  mask: 255,
  offset: 0
};
var PCINT1 = {
  PCIE: 1,
  PCICR: 104,
  PCIFR: 59,
  PCMSK: 108,
  pinChangeInterrupt: 8,
  mask: 255,
  offset: 0
};
var PCINT2 = {
  PCIE: 2,
  PCICR: 104,
  PCIFR: 59,
  PCMSK: 109,
  pinChangeInterrupt: 10,
  mask: 255,
  offset: 0
};
var portBConfig = {
  PIN: 35,
  DDR: 36,
  PORT: 37,
  // Interrupt settings
  pinChange: PCINT0,
  externalInterrupts: []
};
var portCConfig = {
  PIN: 38,
  DDR: 39,
  PORT: 40,
  // Interrupt settings
  pinChange: PCINT1,
  externalInterrupts: []
};
var portDConfig = {
  PIN: 41,
  DDR: 42,
  PORT: 43,
  // Interrupt settings
  pinChange: PCINT2,
  externalInterrupts: [null, null, INT0, INT1]
};
var PinState;
(function(PinState3) {
  PinState3[PinState3["Low"] = 0] = "Low";
  PinState3[PinState3["High"] = 1] = "High";
  PinState3[PinState3["Input"] = 2] = "Input";
  PinState3[PinState3["InputPullUp"] = 3] = "InputPullUp";
})(PinState || (PinState = {}));
var PinOverrideMode;
(function(PinOverrideMode2) {
  PinOverrideMode2[PinOverrideMode2["None"] = 0] = "None";
  PinOverrideMode2[PinOverrideMode2["Enable"] = 1] = "Enable";
  PinOverrideMode2[PinOverrideMode2["Set"] = 2] = "Set";
  PinOverrideMode2[PinOverrideMode2["Clear"] = 3] = "Clear";
  PinOverrideMode2[PinOverrideMode2["Toggle"] = 4] = "Toggle";
})(PinOverrideMode || (PinOverrideMode = {}));
var InterruptMode;
(function(InterruptMode2) {
  InterruptMode2[InterruptMode2["LowLevel"] = 0] = "LowLevel";
  InterruptMode2[InterruptMode2["Change"] = 1] = "Change";
  InterruptMode2[InterruptMode2["FallingEdge"] = 2] = "FallingEdge";
  InterruptMode2[InterruptMode2["RisingEdge"] = 3] = "RisingEdge";
})(InterruptMode || (InterruptMode = {}));
var AVRIOPort = class {
  constructor(cpu, portConfig) {
    var _a, _b, _c, _d;
    this.cpu = cpu;
    this.portConfig = portConfig;
    this.externalClockListeners = [];
    this.listeners = [];
    this.pinValue = 0;
    this.overrideMask = 255;
    this.overrideValue = 0;
    this.lastValue = 0;
    this.lastDdr = 0;
    this.lastPin = 0;
    this.openCollector = 0;
    cpu.gpioPorts.add(this);
    cpu.gpioByPort[portConfig.PORT] = this;
    cpu.writeHooks[portConfig.DDR] = (value) => {
      const portValue = cpu.data[portConfig.PORT];
      cpu.data[portConfig.DDR] = value;
      this.writeGpio(portValue, value);
      this.updatePinRegister(value);
      return true;
    };
    cpu.writeHooks[portConfig.PORT] = (value) => {
      const ddrMask = cpu.data[portConfig.DDR];
      cpu.data[portConfig.PORT] = value;
      this.writeGpio(value, ddrMask);
      this.updatePinRegister(ddrMask);
      return true;
    };
    cpu.writeHooks[portConfig.PIN] = (value, oldValue, addr, mask) => {
      const oldPortValue = cpu.data[portConfig.PORT];
      const ddrMask = cpu.data[portConfig.DDR];
      const portValue = oldPortValue ^ value & mask;
      cpu.data[portConfig.PORT] = portValue;
      this.writeGpio(portValue, ddrMask);
      this.updatePinRegister(ddrMask);
      return true;
    };
    const { externalInterrupts } = portConfig;
    this.externalInts = externalInterrupts.map((externalConfig) => externalConfig ? {
      address: externalConfig.interrupt,
      flagRegister: externalConfig.EIFR,
      flagMask: 1 << externalConfig.index,
      enableRegister: externalConfig.EIMSK,
      enableMask: 1 << externalConfig.index
    } : null);
    const EICR = new Set(externalInterrupts.map((item) => item === null || item === void 0 ? void 0 : item.EICR));
    for (const EICRx of EICR) {
      this.attachInterruptHook(EICRx || 0);
    }
    const EIMSK = (_b = (_a = externalInterrupts.find((item) => item && item.EIMSK)) === null || _a === void 0 ? void 0 : _a.EIMSK) !== null && _b !== void 0 ? _b : 0;
    this.attachInterruptHook(EIMSK, "mask");
    const EIFR = (_d = (_c = externalInterrupts.find((item) => item && item.EIFR)) === null || _c === void 0 ? void 0 : _c.EIFR) !== null && _d !== void 0 ? _d : 0;
    this.attachInterruptHook(EIFR, "flag");
    const { pinChange } = portConfig;
    this.PCINT = pinChange ? {
      address: pinChange.pinChangeInterrupt,
      flagRegister: pinChange.PCIFR,
      flagMask: 1 << pinChange.PCIE,
      enableRegister: pinChange.PCICR,
      enableMask: 1 << pinChange.PCIE
    } : null;
    if (pinChange) {
      const { PCIFR, PCMSK } = pinChange;
      cpu.writeHooks[PCIFR] = (value) => {
        for (const gpio of this.cpu.gpioPorts) {
          const { PCINT } = gpio;
          if (PCINT) {
            cpu.clearInterruptByFlag(PCINT, value);
          }
        }
        return true;
      };
      cpu.writeHooks[PCMSK] = (value) => {
        cpu.data[PCMSK] = value;
        for (const gpio of this.cpu.gpioPorts) {
          const { PCINT } = gpio;
          if (PCINT) {
            cpu.updateInterruptEnable(PCINT, value);
          }
        }
        return true;
      };
    }
  }
  addListener(listener) {
    this.listeners.push(listener);
  }
  removeListener(listener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
  /**
   * Get the state of a given GPIO pin
   *
   * @param index Pin index to return from 0 to 7
   * @returns PinState.Low or PinState.High if the pin is set to output, PinState.Input if the pin is set
   *   to input, and PinState.InputPullUp if the pin is set to input and the internal pull-up resistor has
   *   been enabled.
   */
  pinState(index) {
    const ddr = this.cpu.data[this.portConfig.DDR];
    const port = this.cpu.data[this.portConfig.PORT];
    const bitMask = 1 << index;
    const openState = port & bitMask ? PinState.InputPullUp : PinState.Input;
    const highValue = this.openCollector & bitMask ? openState : PinState.High;
    if (ddr & bitMask) {
      return this.lastValue & bitMask ? highValue : PinState.Low;
    } else {
      return openState;
    }
  }
  /**
   * Sets the input value for the given pin. This is the value that
   * will be returned when reading from the PIN register.
   */
  setPin(index, value) {
    const bitMask = 1 << index;
    this.pinValue &= ~bitMask;
    if (value) {
      this.pinValue |= bitMask;
    }
    this.updatePinRegister(this.cpu.data[this.portConfig.DDR]);
  }
  /**
   * Internal method - do not call this directly!
   * Used by the timer compare output units to override GPIO pins.
   */
  timerOverridePin(pin, mode) {
    const { cpu, portConfig } = this;
    const pinMask = 1 << pin;
    if (mode === PinOverrideMode.None) {
      this.overrideMask |= pinMask;
      this.overrideValue &= ~pinMask;
    } else {
      this.overrideMask &= ~pinMask;
      switch (mode) {
        case PinOverrideMode.Enable:
          this.overrideValue &= ~pinMask;
          this.overrideValue |= cpu.data[portConfig.PORT] & pinMask;
          break;
        case PinOverrideMode.Set:
          this.overrideValue |= pinMask;
          break;
        case PinOverrideMode.Clear:
          this.overrideValue &= ~pinMask;
          break;
        case PinOverrideMode.Toggle:
          this.overrideValue ^= pinMask;
          break;
      }
    }
    const ddrMask = cpu.data[portConfig.DDR];
    this.writeGpio(cpu.data[portConfig.PORT], ddrMask);
    this.updatePinRegister(ddrMask);
  }
  updatePinRegister(ddr) {
    var _a, _b;
    const newPin = this.pinValue & ~ddr | this.lastValue & ddr;
    this.cpu.data[this.portConfig.PIN] = newPin;
    if (this.lastPin !== newPin) {
      for (let index = 0; index < 8; index++) {
        if ((newPin & 1 << index) !== (this.lastPin & 1 << index)) {
          const value = !!(newPin & 1 << index);
          this.toggleInterrupt(index, value);
          (_b = (_a = this.externalClockListeners)[index]) === null || _b === void 0 ? void 0 : _b.call(_a, value);
        }
      }
      this.lastPin = newPin;
    }
  }
  toggleInterrupt(pin, risingEdge) {
    const { cpu, portConfig, externalInts, PCINT } = this;
    const { externalInterrupts, pinChange } = portConfig;
    const externalConfig = externalInterrupts[pin];
    const external = externalInts[pin];
    if (external && externalConfig) {
      const { EIMSK, index, EICR, iscOffset } = externalConfig;
      if (cpu.data[EIMSK] & 1 << index) {
        const configuration = cpu.data[EICR] >> iscOffset & 3;
        let generateInterrupt = false;
        external.constant = false;
        switch (configuration) {
          case InterruptMode.LowLevel:
            generateInterrupt = !risingEdge;
            external.constant = true;
            break;
          case InterruptMode.Change:
            generateInterrupt = true;
            break;
          case InterruptMode.FallingEdge:
            generateInterrupt = !risingEdge;
            break;
          case InterruptMode.RisingEdge:
            generateInterrupt = risingEdge;
            break;
        }
        if (generateInterrupt) {
          cpu.setInterruptFlag(external);
        } else if (external.constant) {
          cpu.clearInterrupt(external, true);
        }
      }
    }
    if (pinChange && PCINT && pinChange.mask & 1 << pin) {
      const { PCMSK } = pinChange;
      if (cpu.data[PCMSK] & 1 << pin + pinChange.offset) {
        cpu.setInterruptFlag(PCINT);
      }
    }
  }
  attachInterruptHook(register, registerType = "other") {
    if (!register) {
      return;
    }
    const { cpu } = this;
    cpu.writeHooks[register] = (value) => {
      if (registerType !== "flag") {
        cpu.data[register] = value;
      }
      for (const gpio of cpu.gpioPorts) {
        for (const external of gpio.externalInts) {
          if (external && registerType === "mask") {
            cpu.updateInterruptEnable(external, value);
          }
          if (external && !external.constant && registerType === "flag") {
            cpu.clearInterruptByFlag(external, value);
          }
        }
        gpio.checkExternalInterrupts();
      }
      return true;
    };
  }
  checkExternalInterrupts() {
    const { cpu } = this;
    const { externalInterrupts } = this.portConfig;
    for (let pin = 0; pin < 8; pin++) {
      const external = externalInterrupts[pin];
      if (!external) {
        continue;
      }
      const pinValue = !!(this.lastPin & 1 << pin);
      const { EIFR, EIMSK, index, EICR, iscOffset, interrupt } = external;
      if (!(cpu.data[EIMSK] & 1 << index) || pinValue) {
        continue;
      }
      const configuration = cpu.data[EICR] >> iscOffset & 3;
      if (configuration === InterruptMode.LowLevel) {
        cpu.queueInterrupt({
          address: interrupt,
          flagRegister: EIFR,
          flagMask: 1 << index,
          enableRegister: EIMSK,
          enableMask: 1 << index,
          constant: true
        });
      }
    }
  }
  writeGpio(value, ddr) {
    const newValue = (value & this.overrideMask | this.overrideValue) & ddr | value & ~ddr;
    const prevValue = this.lastValue;
    if (newValue !== prevValue || ddr !== this.lastDdr) {
      this.lastValue = newValue;
      this.lastDdr = ddr;
      for (const listener of this.listeners) {
        listener(newValue, prevValue);
      }
    }
  }
};

// ../node_modules/avr8js/dist/esm/peripherals/spi.js
var SPCR_SPIE = 128;
var SPCR_SPE = 64;
var SPCR_DORD = 32;
var SPCR_MSTR = 16;
var SPCR_CPOL = 8;
var SPCR_CPHA = 4;
var SPCR_SPR1 = 2;
var SPCR_SPR0 = 1;
var SPSR_SPR_MASK = SPCR_SPR1 | SPCR_SPR0;
var SPSR_SPIF = 128;
var SPSR_WCOL = 64;
var SPSR_SPI2X = 1;
var spiConfig = {
  spiInterrupt: 34,
  SPCR: 76,
  SPSR: 77,
  SPDR: 78
};
var bitsPerByte = 8;
var AVRSPI = class {
  constructor(cpu, config, freqHz) {
    this.cpu = cpu;
    this.config = config;
    this.freqHz = freqHz;
    this.onTransfer = () => 0;
    this.onByte = (value) => {
      const valueIn = this.onTransfer(value);
      this.cpu.addClockEvent(() => this.completeTransfer(valueIn), this.transferCycles);
    };
    this.transmissionActive = false;
    this.SPI = {
      address: this.config.spiInterrupt,
      flagRegister: this.config.SPSR,
      flagMask: SPSR_SPIF,
      enableRegister: this.config.SPCR,
      enableMask: SPCR_SPIE
    };
    const { SPCR, SPSR, SPDR } = config;
    cpu.writeHooks[SPDR] = (value) => {
      if (!(cpu.data[SPCR] & SPCR_SPE)) {
        return;
      }
      if (this.transmissionActive) {
        cpu.data[SPSR] |= SPSR_WCOL;
        return true;
      }
      cpu.data[SPSR] &= ~SPSR_WCOL;
      this.cpu.clearInterrupt(this.SPI);
      this.transmissionActive = true;
      this.onByte(value);
      return true;
    };
    cpu.writeHooks[SPCR] = (value) => {
      this.cpu.updateInterruptEnable(this.SPI, value);
    };
    cpu.writeHooks[SPSR] = (value) => {
      this.cpu.data[SPSR] = value;
      this.cpu.clearInterruptByFlag(this.SPI, value);
    };
  }
  reset() {
    this.transmissionActive = false;
  }
  /**
   * Completes an SPI transaction. Call this method only from the `onByte` callback.
   *
   * @param receivedByte Byte read from the SPI MISO line.
   */
  completeTransfer(receivedByte) {
    const { SPDR } = this.config;
    this.cpu.data[SPDR] = receivedByte;
    this.cpu.setInterruptFlag(this.SPI);
    this.transmissionActive = false;
  }
  get isMaster() {
    return this.cpu.data[this.config.SPCR] & SPCR_MSTR ? true : false;
  }
  get dataOrder() {
    return this.cpu.data[this.config.SPCR] & SPCR_DORD ? "lsbFirst" : "msbFirst";
  }
  get spiMode() {
    const CPHA = this.cpu.data[this.config.SPCR] & SPCR_CPHA;
    const CPOL = this.cpu.data[this.config.SPCR] & SPCR_CPOL;
    return (CPHA ? 2 : 0) | (CPOL ? 1 : 0);
  }
  /**
   * The clock divider is only relevant for Master mode
   */
  get clockDivider() {
    const base = this.cpu.data[this.config.SPSR] & SPSR_SPI2X ? 2 : 4;
    switch (this.cpu.data[this.config.SPCR] & SPSR_SPR_MASK) {
      case 0:
        return base;
      case 1:
        return base * 4;
      case 2:
        return base * 16;
      case 3:
        return base * 32;
    }
    throw new Error("Invalid divider value!");
  }
  /** Number of cycles to complete a single byte SPI transaction */
  get transferCycles() {
    return this.clockDivider * bitsPerByte;
  }
  /**
   * The SPI freqeuncy is only relevant to Master mode.
   * In slave mode, the frequency can be as high as F(osc) / 4.
   */
  get spiFrequency() {
    return this.freqHz / this.clockDivider;
  }
};

// ../node_modules/avr8js/dist/esm/peripherals/timer.js
var timer01Dividers = {
  0: 0,
  1: 1,
  2: 8,
  3: 64,
  4: 256,
  5: 1024,
  6: 0,
  // External clock - see ExternalClockMode
  7: 0
  // Ditto
};
var ExternalClockMode;
(function(ExternalClockMode2) {
  ExternalClockMode2[ExternalClockMode2["FallingEdge"] = 6] = "FallingEdge";
  ExternalClockMode2[ExternalClockMode2["RisingEdge"] = 7] = "RisingEdge";
})(ExternalClockMode || (ExternalClockMode = {}));
var defaultTimerBits = {
  // TIFR bits
  TOV: 1,
  OCFA: 2,
  OCFB: 4,
  OCFC: 0,
  // Unused
  // TIMSK bits
  TOIE: 1,
  OCIEA: 2,
  OCIEB: 4,
  OCIEC: 0
  // Unused
};
var timer0Config = Object.assign({ bits: 8, captureInterrupt: 0, compAInterrupt: 28, compBInterrupt: 30, compCInterrupt: 0, ovfInterrupt: 32, TIFR: 53, OCRA: 71, OCRB: 72, OCRC: 0, ICR: 0, TCNT: 70, TCCRA: 68, TCCRB: 69, TCCRC: 0, TIMSK: 110, dividers: timer01Dividers, compPortA: portDConfig.PORT, compPinA: 6, compPortB: portDConfig.PORT, compPinB: 5, compPortC: 0, compPinC: 0, externalClockPort: portDConfig.PORT, externalClockPin: 4 }, defaultTimerBits);
var timer1Config = Object.assign({ bits: 16, captureInterrupt: 20, compAInterrupt: 22, compBInterrupt: 24, compCInterrupt: 0, ovfInterrupt: 26, TIFR: 54, OCRA: 136, OCRB: 138, OCRC: 0, ICR: 134, TCNT: 132, TCCRA: 128, TCCRB: 129, TCCRC: 130, TIMSK: 111, dividers: timer01Dividers, compPortA: portBConfig.PORT, compPinA: 1, compPortB: portBConfig.PORT, compPinB: 2, compPortC: 0, compPinC: 0, externalClockPort: portDConfig.PORT, externalClockPin: 5 }, defaultTimerBits);
var timer2Config = Object.assign({ bits: 8, captureInterrupt: 0, compAInterrupt: 14, compBInterrupt: 16, compCInterrupt: 0, ovfInterrupt: 18, TIFR: 55, OCRA: 179, OCRB: 180, OCRC: 0, ICR: 0, TCNT: 178, TCCRA: 176, TCCRB: 177, TCCRC: 0, TIMSK: 112, dividers: {
  0: 0,
  1: 1,
  2: 8,
  3: 32,
  4: 64,
  5: 128,
  6: 256,
  7: 1024
}, compPortA: portBConfig.PORT, compPinA: 3, compPortB: portDConfig.PORT, compPinB: 3, compPortC: 0, compPinC: 0, externalClockPort: 0, externalClockPin: 0 }, defaultTimerBits);
var TimerMode;
(function(TimerMode3) {
  TimerMode3[TimerMode3["Normal"] = 0] = "Normal";
  TimerMode3[TimerMode3["PWMPhaseCorrect"] = 1] = "PWMPhaseCorrect";
  TimerMode3[TimerMode3["CTC"] = 2] = "CTC";
  TimerMode3[TimerMode3["FastPWM"] = 3] = "FastPWM";
  TimerMode3[TimerMode3["PWMPhaseFrequencyCorrect"] = 4] = "PWMPhaseFrequencyCorrect";
  TimerMode3[TimerMode3["Reserved"] = 5] = "Reserved";
})(TimerMode || (TimerMode = {}));
var TOVUpdateMode;
(function(TOVUpdateMode2) {
  TOVUpdateMode2[TOVUpdateMode2["Max"] = 0] = "Max";
  TOVUpdateMode2[TOVUpdateMode2["Top"] = 1] = "Top";
  TOVUpdateMode2[TOVUpdateMode2["Bottom"] = 2] = "Bottom";
})(TOVUpdateMode || (TOVUpdateMode = {}));
var OCRUpdateMode;
(function(OCRUpdateMode2) {
  OCRUpdateMode2[OCRUpdateMode2["Immediate"] = 0] = "Immediate";
  OCRUpdateMode2[OCRUpdateMode2["Top"] = 1] = "Top";
  OCRUpdateMode2[OCRUpdateMode2["Bottom"] = 2] = "Bottom";
})(OCRUpdateMode || (OCRUpdateMode = {}));
var TopOCRA = 1;
var TopICR = 2;
var OCToggle = 1;
var { Normal, PWMPhaseCorrect, CTC, FastPWM, Reserved, PWMPhaseFrequencyCorrect } = TimerMode;
var wgmModes8Bit = [
  /*0*/
  [Normal, 255, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*1*/
  [PWMPhaseCorrect, 255, OCRUpdateMode.Top, TOVUpdateMode.Bottom, 0],
  /*2*/
  [CTC, TopOCRA, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*3*/
  [FastPWM, 255, OCRUpdateMode.Bottom, TOVUpdateMode.Max, 0],
  /*4*/
  [Reserved, 255, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*5*/
  [PWMPhaseCorrect, TopOCRA, OCRUpdateMode.Top, TOVUpdateMode.Bottom, OCToggle],
  /*6*/
  [Reserved, 255, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*7*/
  [FastPWM, TopOCRA, OCRUpdateMode.Bottom, TOVUpdateMode.Top, OCToggle]
];
var wgmModes16Bit = [
  /*0 */
  [Normal, 65535, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*1 */
  [PWMPhaseCorrect, 255, OCRUpdateMode.Top, TOVUpdateMode.Bottom, 0],
  /*2 */
  [PWMPhaseCorrect, 511, OCRUpdateMode.Top, TOVUpdateMode.Bottom, 0],
  /*3 */
  [PWMPhaseCorrect, 1023, OCRUpdateMode.Top, TOVUpdateMode.Bottom, 0],
  /*4 */
  [CTC, TopOCRA, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*5 */
  [FastPWM, 255, OCRUpdateMode.Bottom, TOVUpdateMode.Top, 0],
  /*6 */
  [FastPWM, 511, OCRUpdateMode.Bottom, TOVUpdateMode.Top, 0],
  /*7 */
  [FastPWM, 1023, OCRUpdateMode.Bottom, TOVUpdateMode.Top, 0],
  /*8 */
  [PWMPhaseFrequencyCorrect, TopICR, OCRUpdateMode.Bottom, TOVUpdateMode.Bottom, 0],
  /*9 */
  [PWMPhaseFrequencyCorrect, TopOCRA, OCRUpdateMode.Bottom, TOVUpdateMode.Bottom, OCToggle],
  /*10*/
  [PWMPhaseCorrect, TopICR, OCRUpdateMode.Top, TOVUpdateMode.Bottom, 0],
  /*11*/
  [PWMPhaseCorrect, TopOCRA, OCRUpdateMode.Top, TOVUpdateMode.Bottom, OCToggle],
  /*12*/
  [CTC, TopICR, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*13*/
  [Reserved, 65535, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*14*/
  [FastPWM, TopICR, OCRUpdateMode.Bottom, TOVUpdateMode.Top, OCToggle],
  /*15*/
  [FastPWM, TopOCRA, OCRUpdateMode.Bottom, TOVUpdateMode.Top, OCToggle]
];
function compToOverride(comp) {
  switch (comp) {
    case 1:
      return PinOverrideMode.Toggle;
    case 2:
      return PinOverrideMode.Clear;
    case 3:
      return PinOverrideMode.Set;
    default:
      return PinOverrideMode.Enable;
  }
}
var FOCA = 1 << 7;
var FOCB = 1 << 6;
var FOCC = 1 << 5;
var AVRTimer = class {
  constructor(cpu, config) {
    this.cpu = cpu;
    this.config = config;
    this.MAX = this.config.bits === 16 ? 65535 : 255;
    this.lastCycle = 0;
    this.ocrA = 0;
    this.nextOcrA = 0;
    this.ocrB = 0;
    this.nextOcrB = 0;
    this.hasOCRC = this.config.OCRC > 0;
    this.ocrC = 0;
    this.nextOcrC = 0;
    this.ocrUpdateMode = OCRUpdateMode.Immediate;
    this.tovUpdateMode = TOVUpdateMode.Max;
    this.icr = 0;
    this.tcnt = 0;
    this.tcntNext = 0;
    this.tcntUpdated = false;
    this.updateDivider = false;
    this.countingUp = true;
    this.divider = 0;
    this.externalClockRisingEdge = false;
    this.highByteTemp = 0;
    this.OVF = {
      address: this.config.ovfInterrupt,
      flagRegister: this.config.TIFR,
      flagMask: this.config.TOV,
      enableRegister: this.config.TIMSK,
      enableMask: this.config.TOIE
    };
    this.OCFA = {
      address: this.config.compAInterrupt,
      flagRegister: this.config.TIFR,
      flagMask: this.config.OCFA,
      enableRegister: this.config.TIMSK,
      enableMask: this.config.OCIEA
    };
    this.OCFB = {
      address: this.config.compBInterrupt,
      flagRegister: this.config.TIFR,
      flagMask: this.config.OCFB,
      enableRegister: this.config.TIMSK,
      enableMask: this.config.OCIEB
    };
    this.OCFC = {
      address: this.config.compCInterrupt,
      flagRegister: this.config.TIFR,
      flagMask: this.config.OCFC,
      enableRegister: this.config.TIMSK,
      enableMask: this.config.OCIEC
    };
    this.count = (reschedule = true, external = false) => {
      const { divider, lastCycle, cpu: cpu2 } = this;
      const { cycles } = cpu2;
      const delta = cycles - lastCycle;
      if (divider && delta >= divider || external) {
        const counterDelta = external ? 1 : Math.floor(delta / divider);
        this.lastCycle += counterDelta * divider;
        const val = this.tcnt;
        const { timerMode, TOP } = this;
        const phasePwm = timerMode === PWMPhaseCorrect || timerMode === PWMPhaseFrequencyCorrect;
        const newVal = phasePwm ? this.phasePwmCount(val, counterDelta) : (val + counterDelta) % (TOP + 1);
        const overflow = val + counterDelta > TOP;
        if (!this.tcntUpdated) {
          this.tcnt = newVal;
          if (!phasePwm) {
            this.timerUpdated(newVal, val);
          }
        }
        if (!phasePwm) {
          if (timerMode === FastPWM && overflow) {
            const { compA, compB } = this;
            if (compA) {
              this.updateCompPin(compA, "A", true);
            }
            if (compB) {
              this.updateCompPin(compB, "B", true);
            }
          }
          if (this.ocrUpdateMode == OCRUpdateMode.Bottom && overflow) {
            this.ocrA = this.nextOcrA;
            this.ocrB = this.nextOcrB;
            this.ocrC = this.nextOcrC;
          }
          if (overflow && (this.tovUpdateMode == TOVUpdateMode.Top || TOP === this.MAX)) {
            cpu2.setInterruptFlag(this.OVF);
          }
        }
      }
      if (this.tcntUpdated) {
        this.tcnt = this.tcntNext;
        this.tcntUpdated = false;
        if (this.tcnt === 0 && this.ocrUpdateMode === OCRUpdateMode.Bottom || this.tcnt === this.TOP && this.ocrUpdateMode === OCRUpdateMode.Top) {
          this.ocrA = this.nextOcrA;
          this.ocrB = this.nextOcrB;
          this.ocrC = this.nextOcrC;
        }
      }
      if (this.updateDivider) {
        const { CS: CS2 } = this;
        const { externalClockPin } = this.config;
        const newDivider = this.config.dividers[CS2];
        this.lastCycle = newDivider ? this.cpu.cycles : 0;
        this.updateDivider = false;
        this.divider = newDivider;
        if (this.config.externalClockPort && !this.externalClockPort) {
          this.externalClockPort = this.cpu.gpioByPort[this.config.externalClockPort];
        }
        if (this.externalClockPort) {
          this.externalClockPort.externalClockListeners[externalClockPin] = null;
        }
        if (newDivider) {
          cpu2.addClockEvent(this.count, this.lastCycle + newDivider - cpu2.cycles);
        } else if (this.externalClockPort && (CS2 === ExternalClockMode.FallingEdge || CS2 === ExternalClockMode.RisingEdge)) {
          this.externalClockPort.externalClockListeners[externalClockPin] = this.externalClockCallback;
          this.externalClockRisingEdge = CS2 === ExternalClockMode.RisingEdge;
        }
        return;
      }
      if (reschedule && divider) {
        cpu2.addClockEvent(this.count, this.lastCycle + divider - cpu2.cycles);
      }
    };
    this.externalClockCallback = (value) => {
      if (value === this.externalClockRisingEdge) {
        this.count(false, true);
      }
    };
    this.updateWGMConfig();
    this.cpu.readHooks[config.TCNT] = (addr) => {
      this.count(false);
      if (this.config.bits === 16) {
        this.cpu.data[addr + 1] = this.tcnt >> 8;
      }
      return this.cpu.data[addr] = this.tcnt & 255;
    };
    this.cpu.writeHooks[config.TCNT] = (value) => {
      this.tcntNext = this.highByteTemp << 8 | value;
      this.countingUp = true;
      this.tcntUpdated = true;
      this.cpu.updateClockEvent(this.count, 0);
      if (this.divider) {
        this.timerUpdated(this.tcntNext, this.tcntNext);
      }
    };
    this.cpu.writeHooks[config.OCRA] = (value) => {
      this.nextOcrA = this.highByteTemp << 8 | value;
      if (this.ocrUpdateMode === OCRUpdateMode.Immediate) {
        this.ocrA = this.nextOcrA;
      }
    };
    this.cpu.writeHooks[config.OCRB] = (value) => {
      this.nextOcrB = this.highByteTemp << 8 | value;
      if (this.ocrUpdateMode === OCRUpdateMode.Immediate) {
        this.ocrB = this.nextOcrB;
      }
    };
    if (this.hasOCRC) {
      this.cpu.writeHooks[config.OCRC] = (value) => {
        this.nextOcrC = this.highByteTemp << 8 | value;
        if (this.ocrUpdateMode === OCRUpdateMode.Immediate) {
          this.ocrC = this.nextOcrC;
        }
      };
    }
    if (this.config.bits === 16) {
      this.cpu.writeHooks[config.ICR] = (value) => {
        this.icr = this.highByteTemp << 8 | value;
      };
      const updateTempRegister = (value) => {
        this.highByteTemp = value;
      };
      const updateOCRHighRegister = (value, old, addr) => {
        this.highByteTemp = value & this.ocrMask >> 8;
        cpu.data[addr] = this.highByteTemp;
        return true;
      };
      this.cpu.writeHooks[config.TCNT + 1] = updateTempRegister;
      this.cpu.writeHooks[config.OCRA + 1] = updateOCRHighRegister;
      this.cpu.writeHooks[config.OCRB + 1] = updateOCRHighRegister;
      if (this.hasOCRC) {
        this.cpu.writeHooks[config.OCRC + 1] = updateOCRHighRegister;
      }
      this.cpu.writeHooks[config.ICR + 1] = updateTempRegister;
    }
    cpu.writeHooks[config.TCCRA] = (value) => {
      this.cpu.data[config.TCCRA] = value;
      this.updateWGMConfig();
      return true;
    };
    cpu.writeHooks[config.TCCRB] = (value) => {
      if (!config.TCCRC) {
        this.checkForceCompare(value);
        value &= ~(FOCA | FOCB);
      }
      this.cpu.data[config.TCCRB] = value;
      this.updateDivider = true;
      this.cpu.clearClockEvent(this.count);
      this.cpu.addClockEvent(this.count, 0);
      this.updateWGMConfig();
      return true;
    };
    if (config.TCCRC) {
      cpu.writeHooks[config.TCCRC] = (value) => {
        this.checkForceCompare(value);
      };
    }
    cpu.writeHooks[config.TIFR] = (value) => {
      this.cpu.data[config.TIFR] = value;
      this.cpu.clearInterruptByFlag(this.OVF, value);
      this.cpu.clearInterruptByFlag(this.OCFA, value);
      this.cpu.clearInterruptByFlag(this.OCFB, value);
      return true;
    };
    cpu.writeHooks[config.TIMSK] = (value) => {
      this.cpu.updateInterruptEnable(this.OVF, value);
      this.cpu.updateInterruptEnable(this.OCFA, value);
      this.cpu.updateInterruptEnable(this.OCFB, value);
    };
  }
  reset() {
    this.divider = 0;
    this.lastCycle = 0;
    this.ocrA = 0;
    this.nextOcrA = 0;
    this.ocrB = 0;
    this.nextOcrB = 0;
    this.ocrC = 0;
    this.nextOcrC = 0;
    this.icr = 0;
    this.tcnt = 0;
    this.tcntNext = 0;
    this.tcntUpdated = false;
    this.countingUp = false;
    this.updateDivider = true;
  }
  get TCCRA() {
    return this.cpu.data[this.config.TCCRA];
  }
  get TCCRB() {
    return this.cpu.data[this.config.TCCRB];
  }
  get TIMSK() {
    return this.cpu.data[this.config.TIMSK];
  }
  get CS() {
    return this.TCCRB & 7;
  }
  get WGM() {
    const mask = this.config.bits === 16 ? 24 : 8;
    return (this.TCCRB & mask) >> 1 | this.TCCRA & 3;
  }
  get TOP() {
    switch (this.topValue) {
      case TopOCRA:
        return this.ocrA;
      case TopICR:
        return this.icr;
      default:
        return this.topValue;
    }
  }
  get ocrMask() {
    switch (this.topValue) {
      case TopOCRA:
      case TopICR:
        return 65535;
      default:
        return this.topValue;
    }
  }
  /** Expose the raw value of TCNT, for use by the unit tests */
  get debugTCNT() {
    return this.tcnt;
  }
  updateWGMConfig() {
    const { config, WGM } = this;
    const wgmModes = config.bits === 16 ? wgmModes16Bit : wgmModes8Bit;
    const TCCRA = this.cpu.data[config.TCCRA];
    const [timerMode, topValue, ocrUpdateMode, tovUpdateMode, flags] = wgmModes[WGM];
    this.timerMode = timerMode;
    this.topValue = topValue;
    this.ocrUpdateMode = ocrUpdateMode;
    this.tovUpdateMode = tovUpdateMode;
    const pwmMode = timerMode === FastPWM || timerMode === PWMPhaseCorrect || timerMode === PWMPhaseFrequencyCorrect;
    const prevCompA = this.compA;
    this.compA = TCCRA >> 6 & 3;
    if (this.compA === 1 && pwmMode && !(flags & OCToggle)) {
      this.compA = 0;
    }
    if (!!prevCompA !== !!this.compA) {
      this.updateCompA(this.compA ? PinOverrideMode.Enable : PinOverrideMode.None);
    }
    const prevCompB = this.compB;
    this.compB = TCCRA >> 4 & 3;
    if (this.compB === 1 && pwmMode) {
      this.compB = 0;
    }
    if (!!prevCompB !== !!this.compB) {
      this.updateCompB(this.compB ? PinOverrideMode.Enable : PinOverrideMode.None);
    }
    if (this.hasOCRC) {
      const prevCompC = this.compC;
      this.compC = TCCRA >> 2 & 3;
      if (this.compC === 1 && pwmMode) {
        this.compC = 0;
      }
      if (!!prevCompC !== !!this.compC) {
        this.updateCompC(this.compC ? PinOverrideMode.Enable : PinOverrideMode.None);
      }
    }
  }
  phasePwmCount(value, delta) {
    const { ocrA, ocrB, ocrC, hasOCRC, TOP, MAX, tcntUpdated } = this;
    if (!value && !TOP) {
      delta = 0;
      if (this.ocrUpdateMode === OCRUpdateMode.Top) {
        this.ocrA = this.nextOcrA;
        this.ocrB = this.nextOcrB;
        this.ocrC = this.nextOcrC;
      }
    }
    while (delta > 0) {
      if (this.countingUp) {
        value++;
        if (value === TOP && !tcntUpdated) {
          this.countingUp = false;
          if (this.ocrUpdateMode === OCRUpdateMode.Top) {
            this.ocrA = this.nextOcrA;
            this.ocrB = this.nextOcrB;
            this.ocrC = this.nextOcrC;
          }
        }
      } else {
        value--;
        if (!value && !tcntUpdated) {
          this.countingUp = true;
          this.cpu.setInterruptFlag(this.OVF);
          if (this.ocrUpdateMode === OCRUpdateMode.Bottom) {
            this.ocrA = this.nextOcrA;
            this.ocrB = this.nextOcrB;
            this.ocrC = this.nextOcrC;
          }
        }
      }
      if (!tcntUpdated) {
        if (value === ocrA) {
          this.cpu.setInterruptFlag(this.OCFA);
          if (this.compA) {
            this.updateCompPin(this.compA, "A");
          }
        }
        if (value === ocrB) {
          this.cpu.setInterruptFlag(this.OCFB);
          if (this.compB) {
            this.updateCompPin(this.compB, "B");
          }
        }
        if (hasOCRC && value === ocrC) {
          this.cpu.setInterruptFlag(this.OCFC);
          if (this.compC) {
            this.updateCompPin(this.compC, "C");
          }
        }
      }
      delta--;
    }
    return value & MAX;
  }
  timerUpdated(value, prevValue) {
    const { ocrA, ocrB, ocrC, hasOCRC } = this;
    const overflow = prevValue > value;
    if ((prevValue < ocrA || overflow) && value >= ocrA || prevValue < ocrA && overflow) {
      this.cpu.setInterruptFlag(this.OCFA);
      if (this.compA) {
        this.updateCompPin(this.compA, "A");
      }
    }
    if ((prevValue < ocrB || overflow) && value >= ocrB || prevValue < ocrB && overflow) {
      this.cpu.setInterruptFlag(this.OCFB);
      if (this.compB) {
        this.updateCompPin(this.compB, "B");
      }
    }
    if (hasOCRC && ((prevValue < ocrC || overflow) && value >= ocrC || prevValue < ocrC && overflow)) {
      this.cpu.setInterruptFlag(this.OCFC);
      if (this.compC) {
        this.updateCompPin(this.compC, "C");
      }
    }
  }
  checkForceCompare(value) {
    if (this.timerMode == TimerMode.FastPWM || this.timerMode == TimerMode.PWMPhaseCorrect || this.timerMode == TimerMode.PWMPhaseFrequencyCorrect) {
      return;
    }
    if (value & FOCA) {
      this.updateCompPin(this.compA, "A");
    }
    if (value & FOCB) {
      this.updateCompPin(this.compB, "B");
    }
    if (this.config.compPortC && value & FOCC) {
      this.updateCompPin(this.compC, "C");
    }
  }
  updateCompPin(compValue, pinName, bottom = false) {
    let newValue = PinOverrideMode.None;
    const invertingMode = compValue === 3;
    const isSet = this.countingUp === invertingMode;
    switch (this.timerMode) {
      case Normal:
      case CTC:
        newValue = compToOverride(compValue);
        break;
      case FastPWM:
        if (compValue === 1) {
          newValue = bottom ? PinOverrideMode.None : PinOverrideMode.Toggle;
        } else {
          newValue = invertingMode !== bottom ? PinOverrideMode.Set : PinOverrideMode.Clear;
        }
        break;
      case PWMPhaseCorrect:
      case PWMPhaseFrequencyCorrect:
        if (compValue === 1) {
          newValue = PinOverrideMode.Toggle;
        } else {
          newValue = isSet ? PinOverrideMode.Set : PinOverrideMode.Clear;
        }
        break;
    }
    if (newValue !== PinOverrideMode.None) {
      if (pinName === "A") {
        this.updateCompA(newValue);
      } else if (pinName === "B") {
        this.updateCompB(newValue);
      } else {
        this.updateCompC(newValue);
      }
    }
  }
  updateCompA(value) {
    const { compPortA, compPinA } = this.config;
    const port = this.cpu.gpioByPort[compPortA];
    port === null || port === void 0 ? void 0 : port.timerOverridePin(compPinA, value);
  }
  updateCompB(value) {
    const { compPortB, compPinB } = this.config;
    const port = this.cpu.gpioByPort[compPortB];
    port === null || port === void 0 ? void 0 : port.timerOverridePin(compPinB, value);
  }
  updateCompC(value) {
    const { compPortC, compPinC } = this.config;
    const port = this.cpu.gpioByPort[compPortC];
    port === null || port === void 0 ? void 0 : port.timerOverridePin(compPinC, value);
  }
};

// ../node_modules/avr8js/dist/esm/peripherals/timer-attiny.js
var CTC1 = 1 << 7;
var PWM1A = 1 << 6;
var PWM1B_BIT = 1 << 6;
var FOC1B = 1 << 3;
var FOC1A = 1 << 2;
var PSR1 = 1 << 1;
var attinyTimer1Config = {
  TCCR1: 80,
  GTCCR: 76,
  TCNT1: 79,
  OCR1A: 78,
  OCR1B: 75,
  OCR1C: 77,
  TIFR: 88,
  TIMSK: 89,
  ovfInterrupt: 4,
  compAInterrupt: 3,
  compBInterrupt: 9,
  TOV1: 1 << 2,
  OCF1A: 1 << 6,
  OCF1B: 1 << 5,
  TOIE1: 1 << 2,
  OCIE1A: 1 << 6,
  OCIE1B: 1 << 5,
  compPortB: 56,
  compPinA: 1,
  // PB1
  compPinB: 4,
  // PB4
  dividers: {
    0: 0,
    1: 1,
    2: 2,
    3: 4,
    4: 8,
    5: 16,
    6: 32,
    7: 64,
    8: 128,
    9: 256,
    10: 512,
    11: 1024,
    12: 2048,
    13: 4096,
    14: 8192,
    15: 16384
  }
};

// ../node_modules/avr8js/dist/esm/peripherals/twi.js
var TWCR_TWINT = 128;
var TWCR_TWEA = 64;
var TWCR_TWSTA = 32;
var TWCR_TWSTO = 16;
var TWCR_TWEN = 4;
var TWCR_TWIE = 1;
var TWSR_TWS_MASK = 248;
var TWSR_TWPS1 = 2;
var TWSR_TWPS0 = 1;
var TWSR_TWPS_MASK = TWSR_TWPS1 | TWSR_TWPS0;
var STATUS_TWI_IDLE = 248;
var STATUS_START = 8;
var STATUS_REPEATED_START = 16;
var STATUS_SLAW_ACK = 24;
var STATUS_SLAW_NACK = 32;
var STATUS_DATA_SENT_ACK = 40;
var STATUS_DATA_SENT_NACK = 48;
var STATUS_SLAR_ACK = 64;
var STATUS_SLAR_NACK = 72;
var STATUS_DATA_RECEIVED_ACK = 80;
var STATUS_DATA_RECEIVED_NACK = 88;
var twiConfig = {
  twiInterrupt: 48,
  TWBR: 184,
  TWSR: 185,
  TWAR: 186,
  TWDR: 187,
  TWCR: 188,
  TWAMR: 189
};
var NoopTWIEventHandler = class {
  constructor(twi) {
    this.twi = twi;
  }
  start() {
    this.twi.completeStart();
  }
  stop() {
    this.twi.completeStop();
  }
  connectToSlave() {
    this.twi.completeConnect(false);
  }
  writeByte() {
    this.twi.completeWrite(false);
  }
  readByte() {
    this.twi.completeRead(255);
  }
};
var AVRTWI = class {
  constructor(cpu, config, freqHz) {
    this.cpu = cpu;
    this.config = config;
    this.freqHz = freqHz;
    this.eventHandler = new NoopTWIEventHandler(this);
    this.busy = false;
    this.TWI = {
      address: this.config.twiInterrupt,
      flagRegister: this.config.TWCR,
      flagMask: TWCR_TWINT,
      enableRegister: this.config.TWCR,
      enableMask: TWCR_TWIE
    };
    this.updateStatus(STATUS_TWI_IDLE);
    this.cpu.writeHooks[config.TWCR] = (value) => {
      this.cpu.data[config.TWCR] = value;
      const clearInt = value & TWCR_TWINT;
      this.cpu.clearInterruptByFlag(this.TWI, value);
      this.cpu.updateInterruptEnable(this.TWI, value);
      const { status } = this;
      if (clearInt && value & TWCR_TWEN && !this.busy) {
        const twdrValue = this.cpu.data[this.config.TWDR];
        this.cpu.addClockEvent(() => {
          if (value & TWCR_TWSTA) {
            this.busy = true;
            this.eventHandler.start(status !== STATUS_TWI_IDLE);
          } else if (value & TWCR_TWSTO) {
            this.busy = true;
            this.eventHandler.stop();
          } else if (status === STATUS_START || status === STATUS_REPEATED_START) {
            this.busy = true;
            this.eventHandler.connectToSlave(twdrValue >> 1, twdrValue & 1 ? false : true);
          } else if (status === STATUS_SLAW_ACK || status === STATUS_DATA_SENT_ACK) {
            this.busy = true;
            this.eventHandler.writeByte(twdrValue);
          } else if (status === STATUS_SLAR_ACK || status === STATUS_DATA_RECEIVED_ACK) {
            this.busy = true;
            const ack = !!(value & TWCR_TWEA);
            this.eventHandler.readByte(ack);
          }
        }, 0);
        return true;
      }
    };
  }
  get prescaler() {
    switch (this.cpu.data[this.config.TWSR] & TWSR_TWPS_MASK) {
      case 0:
        return 1;
      case 1:
        return 4;
      case 2:
        return 16;
      case 3:
        return 64;
    }
    throw new Error("Invalid prescaler value!");
  }
  get sclFrequency() {
    return this.freqHz / (16 + 2 * this.cpu.data[this.config.TWBR] * this.prescaler);
  }
  completeStart() {
    this.busy = false;
    this.updateStatus(this.status === STATUS_TWI_IDLE ? STATUS_START : STATUS_REPEATED_START);
  }
  completeStop() {
    this.busy = false;
    this.cpu.data[this.config.TWCR] &= ~TWCR_TWSTO;
    this.updateStatus(STATUS_TWI_IDLE);
  }
  completeConnect(ack) {
    this.busy = false;
    if (this.cpu.data[this.config.TWDR] & 1) {
      this.updateStatus(ack ? STATUS_SLAR_ACK : STATUS_SLAR_NACK);
    } else {
      this.updateStatus(ack ? STATUS_SLAW_ACK : STATUS_SLAW_NACK);
    }
  }
  completeWrite(ack) {
    this.busy = false;
    this.updateStatus(ack ? STATUS_DATA_SENT_ACK : STATUS_DATA_SENT_NACK);
  }
  completeRead(value) {
    this.busy = false;
    const ack = !!(this.cpu.data[this.config.TWCR] & TWCR_TWEA);
    this.cpu.data[this.config.TWDR] = value;
    this.updateStatus(ack ? STATUS_DATA_RECEIVED_ACK : STATUS_DATA_RECEIVED_NACK);
  }
  get status() {
    return this.cpu.data[this.config.TWSR] & TWSR_TWS_MASK;
  }
  updateStatus(value) {
    const { TWSR } = this.config;
    this.cpu.data[TWSR] = this.cpu.data[TWSR] & ~TWSR_TWS_MASK | value;
    this.cpu.setInterruptFlag(this.TWI);
  }
};

// ../node_modules/avr8js/dist/esm/peripherals/usart.js
var usart0Config = {
  rxCompleteInterrupt: 36,
  dataRegisterEmptyInterrupt: 38,
  txCompleteInterrupt: 40,
  UCSRA: 192,
  UCSRB: 193,
  UCSRC: 194,
  UBRRL: 196,
  UBRRH: 197,
  UDR: 198
};
var UCSRA_RXC = 128;
var UCSRA_TXC = 64;
var UCSRA_UDRE = 32;
var UCSRA_U2X = 2;
var UCSRA_MPCM = 1;
var UCSRA_CFG_MASK = UCSRA_U2X;
var UCSRB_RXCIE = 128;
var UCSRB_TXCIE = 64;
var UCSRB_UDRIE = 32;
var UCSRB_RXEN = 16;
var UCSRB_TXEN = 8;
var UCSRB_UCSZ2 = 4;
var UCSRB_CFG_MASK = UCSRB_UCSZ2 | UCSRB_RXEN | UCSRB_TXEN;
var UCSRC_UPM1 = 32;
var UCSRC_UPM0 = 16;
var UCSRC_USBS = 8;
var UCSRC_UCSZ1 = 4;
var UCSRC_UCSZ0 = 2;
var rxMasks = {
  5: 31,
  6: 63,
  7: 127,
  8: 255,
  9: 255
};
var AVRUSART = class {
  constructor(cpu, config, freqHz) {
    this.cpu = cpu;
    this.config = config;
    this.freqHz = freqHz;
    this.onByteTransmit = null;
    this.onLineTransmit = null;
    this.onRxComplete = null;
    this.onConfigurationChange = null;
    this.rxBusyValue = false;
    this.rxByte = 0;
    this.lineBuffer = "";
    this.RXC = {
      address: this.config.rxCompleteInterrupt,
      flagRegister: this.config.UCSRA,
      flagMask: UCSRA_RXC,
      enableRegister: this.config.UCSRB,
      enableMask: UCSRB_RXCIE,
      constant: true
    };
    this.UDRE = {
      address: this.config.dataRegisterEmptyInterrupt,
      flagRegister: this.config.UCSRA,
      flagMask: UCSRA_UDRE,
      enableRegister: this.config.UCSRB,
      enableMask: UCSRB_UDRIE
    };
    this.TXC = {
      address: this.config.txCompleteInterrupt,
      flagRegister: this.config.UCSRA,
      flagMask: UCSRA_TXC,
      enableRegister: this.config.UCSRB,
      enableMask: UCSRB_TXCIE
    };
    this.reset();
    this.cpu.writeHooks[config.UCSRA] = (value, oldValue) => {
      var _a;
      cpu.data[config.UCSRA] = value & (UCSRA_MPCM | UCSRA_U2X);
      cpu.clearInterruptByFlag(this.TXC, value);
      if ((value & UCSRA_CFG_MASK) !== (oldValue & UCSRA_CFG_MASK)) {
        (_a = this.onConfigurationChange) === null || _a === void 0 ? void 0 : _a.call(this);
      }
      return true;
    };
    this.cpu.writeHooks[config.UCSRB] = (value, oldValue) => {
      var _a;
      cpu.updateInterruptEnable(this.RXC, value);
      cpu.updateInterruptEnable(this.UDRE, value);
      cpu.updateInterruptEnable(this.TXC, value);
      if (value & UCSRB_RXEN && oldValue & UCSRB_RXEN) {
        cpu.clearInterrupt(this.RXC);
      }
      if (value & UCSRB_TXEN && !(oldValue & UCSRB_TXEN)) {
        cpu.setInterruptFlag(this.UDRE);
      }
      cpu.data[config.UCSRB] = value;
      if ((value & UCSRB_CFG_MASK) !== (oldValue & UCSRB_CFG_MASK)) {
        (_a = this.onConfigurationChange) === null || _a === void 0 ? void 0 : _a.call(this);
      }
      return true;
    };
    this.cpu.writeHooks[config.UCSRC] = (value) => {
      var _a;
      cpu.data[config.UCSRC] = value;
      (_a = this.onConfigurationChange) === null || _a === void 0 ? void 0 : _a.call(this);
      return true;
    };
    this.cpu.readHooks[config.UDR] = () => {
      var _a;
      const mask = (_a = rxMasks[this.bitsPerChar]) !== null && _a !== void 0 ? _a : 255;
      const result = this.rxByte & mask;
      this.rxByte = 0;
      this.cpu.clearInterrupt(this.RXC);
      return result;
    };
    this.cpu.writeHooks[config.UDR] = (value) => {
      if (this.onByteTransmit) {
        this.onByteTransmit(value);
      }
      if (this.onLineTransmit) {
        const ch = String.fromCharCode(value);
        if (ch === "\n") {
          this.onLineTransmit(this.lineBuffer);
          this.lineBuffer = "";
        } else {
          this.lineBuffer += ch;
        }
      }
      this.cpu.addClockEvent(() => {
        cpu.setInterruptFlag(this.UDRE);
        cpu.setInterruptFlag(this.TXC);
      }, this.cyclesPerChar);
      this.cpu.clearInterrupt(this.TXC);
      this.cpu.clearInterrupt(this.UDRE);
    };
    this.cpu.writeHooks[config.UBRRH] = (value) => {
      var _a;
      this.cpu.data[config.UBRRH] = value;
      (_a = this.onConfigurationChange) === null || _a === void 0 ? void 0 : _a.call(this);
      return true;
    };
    this.cpu.writeHooks[config.UBRRL] = (value) => {
      var _a;
      this.cpu.data[config.UBRRL] = value;
      (_a = this.onConfigurationChange) === null || _a === void 0 ? void 0 : _a.call(this);
      return true;
    };
  }
  reset() {
    this.cpu.data[this.config.UCSRA] = UCSRA_UDRE;
    this.cpu.data[this.config.UCSRB] = 0;
    this.cpu.data[this.config.UCSRC] = UCSRC_UCSZ1 | UCSRC_UCSZ0;
    this.rxBusyValue = false;
    this.rxByte = 0;
    this.lineBuffer = "";
  }
  get rxBusy() {
    return this.rxBusyValue;
  }
  writeByte(value, immediate = false) {
    var _a;
    const { cpu } = this;
    if (this.rxBusyValue || !this.rxEnable) {
      return false;
    }
    if (immediate) {
      this.rxByte = value;
      cpu.setInterruptFlag(this.RXC);
      (_a = this.onRxComplete) === null || _a === void 0 ? void 0 : _a.call(this);
    } else {
      this.rxBusyValue = true;
      cpu.addClockEvent(() => {
        this.rxBusyValue = false;
        this.writeByte(value, true);
      }, this.cyclesPerChar);
      return true;
    }
  }
  get cyclesPerChar() {
    const symbolsPerChar = 1 + this.bitsPerChar + this.stopBits + (this.parityEnabled ? 1 : 0);
    return (this.UBRR + 1) * this.multiplier * symbolsPerChar;
  }
  get UBRR() {
    const { UBRRH, UBRRL } = this.config;
    return this.cpu.data[UBRRH] << 8 | this.cpu.data[UBRRL];
  }
  get multiplier() {
    return this.cpu.data[this.config.UCSRA] & UCSRA_U2X ? 8 : 16;
  }
  get rxEnable() {
    return !!(this.cpu.data[this.config.UCSRB] & UCSRB_RXEN);
  }
  get txEnable() {
    return !!(this.cpu.data[this.config.UCSRB] & UCSRB_TXEN);
  }
  get baudRate() {
    return Math.floor(this.freqHz / (this.multiplier * (1 + this.UBRR)));
  }
  get bitsPerChar() {
    const ucsz = (this.cpu.data[this.config.UCSRC] & (UCSRC_UCSZ1 | UCSRC_UCSZ0)) >> 1 | this.cpu.data[this.config.UCSRB] & UCSRB_UCSZ2;
    switch (ucsz) {
      case 0:
        return 5;
      case 1:
        return 6;
      case 2:
        return 7;
      case 3:
        return 8;
      default:
      // 4..6 are reserved
      case 7:
        return 9;
    }
  }
  get stopBits() {
    return this.cpu.data[this.config.UCSRC] & UCSRC_USBS ? 2 : 1;
  }
  get parityEnabled() {
    return this.cpu.data[this.config.UCSRC] & UCSRC_UPM1 ? true : false;
  }
  get parityOdd() {
    return this.cpu.data[this.config.UCSRC] & UCSRC_UPM0 ? true : false;
  }
};

// ../node_modules/avr8js/dist/esm/peripherals/usi.js
var USIDC = 1 << 4;
var USIPF = 1 << 5;
var USIOIF = 1 << 6;
var USISIF = 1 << 7;
var USITC = 1 << 0;
var USICLK = 1 << 1;
var USICS0 = 1 << 2;
var USICS1 = 1 << 3;
var USIWM0 = 1 << 4;
var USIWM1 = 1 << 5;
var USIOIE = 1 << 6;
var USISIE = 1 << 7;

// ../node_modules/avr8js/dist/esm/peripherals/watchdog.js
var WDTCSR_WDP3 = 32;
var WDTCSR_WDE = 8;
var WDTCSR_WDP2 = 4;
var WDTCSR_WDP1 = 2;
var WDTCSR_WDP0 = 1;
var WDTCSR_WDP210 = WDTCSR_WDP2 | WDTCSR_WDP1 | WDTCSR_WDP0;
var WDTCSR_PROTECT_MASK = WDTCSR_WDE | WDTCSR_WDP3 | WDTCSR_WDP210;

// ../node_modules/rp2040js/dist/esm/irq.js
var IRQ;
(function(IRQ3) {
  IRQ3[IRQ3["TIMER_0"] = 0] = "TIMER_0";
  IRQ3[IRQ3["TIMER_1"] = 1] = "TIMER_1";
  IRQ3[IRQ3["TIMER_2"] = 2] = "TIMER_2";
  IRQ3[IRQ3["TIMER_3"] = 3] = "TIMER_3";
  IRQ3[IRQ3["PWM_WRAP"] = 4] = "PWM_WRAP";
  IRQ3[IRQ3["USBCTRL"] = 5] = "USBCTRL";
  IRQ3[IRQ3["XIP"] = 6] = "XIP";
  IRQ3[IRQ3["PIO0_IRQ0"] = 7] = "PIO0_IRQ0";
  IRQ3[IRQ3["PIO0_IRQ1"] = 8] = "PIO0_IRQ1";
  IRQ3[IRQ3["PIO1_IRQ0"] = 9] = "PIO1_IRQ0";
  IRQ3[IRQ3["PIO1_IRQ1"] = 10] = "PIO1_IRQ1";
  IRQ3[IRQ3["DMA_IRQ0"] = 11] = "DMA_IRQ0";
  IRQ3[IRQ3["DMA_IRQ1"] = 12] = "DMA_IRQ1";
  IRQ3[IRQ3["IO_BANK0"] = 13] = "IO_BANK0";
  IRQ3[IRQ3["IO_QSPI"] = 14] = "IO_QSPI";
  IRQ3[IRQ3["SIO_PROC0"] = 15] = "SIO_PROC0";
  IRQ3[IRQ3["SIO_PROC1"] = 16] = "SIO_PROC1";
  IRQ3[IRQ3["CLOCKS"] = 17] = "CLOCKS";
  IRQ3[IRQ3["SPI0"] = 18] = "SPI0";
  IRQ3[IRQ3["SPI1"] = 19] = "SPI1";
  IRQ3[IRQ3["UART0"] = 20] = "UART0";
  IRQ3[IRQ3["UART1"] = 21] = "UART1";
  IRQ3[IRQ3["ADC_FIFO"] = 22] = "ADC_FIFO";
  IRQ3[IRQ3["I2C0"] = 23] = "I2C0";
  IRQ3[IRQ3["I2C1"] = 24] = "I2C1";
  IRQ3[IRQ3["RTC"] = 25] = "RTC";
})(IRQ || (IRQ = {}));
var MAX_HARDWARE_IRQ = IRQ.RTC;

// ../node_modules/rp2040js/dist/esm/utils/time.js
function getCurrentMicroseconds() {
  if (typeof performance != "undefined") {
    return Math.floor(performance.now() * 1e3);
  } else {
    return Math.floor(eval("require")("perf_hooks").performance.now() * 1e3);
  }
}
function leftPad(value, minLength, padChar = " ") {
  if (value.length < minLength) {
    value = padChar + value;
  }
  return value;
}
function rightPad(value, minLength, padChar = " ") {
  if (value.length < minLength) {
    value += padChar;
  }
  return value;
}
function formatTime(date) {
  const hours = leftPad(date.getHours().toString(), 2, "0");
  const minutes = leftPad(date.getMinutes().toString(), 2, "0");
  const seconds = leftPad(date.getSeconds().toString(), 2, "0");
  const milliseconds = rightPad(date.getMilliseconds().toString(), 3);
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// ../node_modules/rp2040js/dist/esm/clock/realtime-clock.js
var ClockTimer = class {
  constructor(micros, callback) {
    this.micros = micros;
    this.callback = callback;
    this.jsTimer = null;
    this.timeLeft = this.micros;
  }
  schedule(currentMicros) {
    this.jsTimer = setTimeout(this.callback, (this.micros - currentMicros) / 1e3);
  }
  unschedule() {
    if (this.jsTimer) {
      clearTimeout(this.jsTimer);
      this.jsTimer = null;
    }
  }
  pause(currentMicros) {
    this.timeLeft = this.micros - currentMicros;
    this.unschedule();
  }
  resume(currentMicros) {
    this.micros = currentMicros + this.timeLeft;
    this.schedule(currentMicros);
  }
};
var RealtimeClock = class {
  constructor() {
    this.baseTime = 0;
    this.pauseTime = 0;
    this.paused = true;
    this.timers = /* @__PURE__ */ new Set();
  }
  pause() {
    if (!this.paused) {
      for (const timer of this.timers) {
        timer.pause(this.micros);
      }
      this.pauseTime = this.micros;
      this.paused = true;
    }
  }
  resume() {
    if (this.paused) {
      this.baseTime = getCurrentMicroseconds() - this.pauseTime;
      this.paused = false;
      for (const timer of this.timers) {
        timer.resume(this.micros);
      }
    }
  }
  createTimer(deltaMicros, callback) {
    const timer = new ClockTimer(this.micros + deltaMicros, () => {
      this.timers.delete(timer);
      callback();
    });
    timer.schedule(this.micros);
    this.timers.add(timer);
    return timer;
  }
  deleteTimer(timer) {
    timer.unschedule();
    this.timers.delete(timer);
  }
  get micros() {
    return getCurrentMicroseconds() - this.baseTime;
  }
};

// ../node_modules/rp2040js/dist/esm/utils/fifo.js
var FIFO = class {
  constructor(size) {
    this.start = 0;
    this.used = 0;
    this.buffer = new Uint32Array(size);
  }
  get size() {
    return this.buffer.length;
  }
  get itemCount() {
    return this.used;
  }
  push(value) {
    const { length } = this.buffer;
    const { start, used } = this;
    if (this.used < length) {
      this.buffer[(start + used) % length] = value;
      this.used++;
    }
  }
  pull() {
    const { start, used } = this;
    const { length } = this.buffer;
    if (used) {
      this.start = (start + 1) % length;
      this.used--;
      return this.buffer[start];
    }
    return 0;
  }
  peek() {
    return this.used ? this.buffer[this.start] : 0;
  }
  reset() {
    this.used = 0;
  }
  get empty() {
    return this.used == 0;
  }
  get full() {
    return this.used === this.buffer.length;
  }
  get items() {
    const { start, used, buffer } = this;
    const { length } = buffer;
    const result = [];
    for (let i = 0; i < used; i++) {
      result[i] = buffer[(start + i) % length];
    }
    return result;
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/peripheral.js
var ATOMIC_NORMAL = 0;
var ATOMIC_XOR = 1;
var ATOMIC_SET = 2;
var ATOMIC_CLEAR = 3;
function atomicUpdate(currentValue, atomicType, newValue) {
  switch (atomicType) {
    case ATOMIC_XOR:
      return currentValue ^ newValue;
    case ATOMIC_SET:
      return currentValue | newValue;
    case ATOMIC_CLEAR:
      return currentValue & ~newValue;
    default:
      console.warn("Atomic update called with invalid writeType", atomicType);
      return newValue;
  }
}
var BasePeripheral = class {
  constructor(rp2040, name) {
    this.rp2040 = rp2040;
    this.name = name;
    this.rawWriteValue = 0;
  }
  readUint32(offset) {
    this.warn(`Unimplemented peripheral read from ${offset.toString(16)}`);
    if (offset > 4096) {
      this.warn("Unimplemented read from peripheral in the atomic operation region");
    }
    return 4294967295;
  }
  writeUint32(offset, value) {
    this.warn(`Unimplemented peripheral write to ${offset.toString(16)}: ${value}`);
  }
  writeUint32Atomic(offset, value, atomicType) {
    this.rawWriteValue = value;
    const newValue = atomicType != ATOMIC_NORMAL ? atomicUpdate(this.readUint32(offset), atomicType, value) : value;
    this.writeUint32(offset, newValue);
  }
  debug(msg) {
    this.rp2040.logger.debug(this.name, msg);
  }
  info(msg) {
    this.rp2040.logger.info(this.name, msg);
  }
  warn(msg) {
    this.rp2040.logger.warn(this.name, msg);
  }
  error(msg) {
    this.rp2040.logger.error(this.name, msg);
  }
};
var UnimplementedPeripheral = class extends BasePeripheral {
};

// ../node_modules/rp2040js/dist/esm/peripherals/dma.js
var DREQChannel;
(function(DREQChannel2) {
  DREQChannel2[DREQChannel2["DREQ_PIO0_TX0"] = 0] = "DREQ_PIO0_TX0";
  DREQChannel2[DREQChannel2["DREQ_PIO0_TX1"] = 1] = "DREQ_PIO0_TX1";
  DREQChannel2[DREQChannel2["DREQ_PIO0_TX2"] = 2] = "DREQ_PIO0_TX2";
  DREQChannel2[DREQChannel2["DREQ_PIO0_TX3"] = 3] = "DREQ_PIO0_TX3";
  DREQChannel2[DREQChannel2["DREQ_PIO0_RX0"] = 4] = "DREQ_PIO0_RX0";
  DREQChannel2[DREQChannel2["DREQ_PIO0_RX1"] = 5] = "DREQ_PIO0_RX1";
  DREQChannel2[DREQChannel2["DREQ_PIO0_RX2"] = 6] = "DREQ_PIO0_RX2";
  DREQChannel2[DREQChannel2["DREQ_PIO0_RX3"] = 7] = "DREQ_PIO0_RX3";
  DREQChannel2[DREQChannel2["DREQ_PIO1_TX0"] = 8] = "DREQ_PIO1_TX0";
  DREQChannel2[DREQChannel2["DREQ_PIO1_TX1"] = 9] = "DREQ_PIO1_TX1";
  DREQChannel2[DREQChannel2["DREQ_PIO1_TX2"] = 10] = "DREQ_PIO1_TX2";
  DREQChannel2[DREQChannel2["DREQ_PIO1_TX3"] = 11] = "DREQ_PIO1_TX3";
  DREQChannel2[DREQChannel2["DREQ_PIO1_RX0"] = 12] = "DREQ_PIO1_RX0";
  DREQChannel2[DREQChannel2["DREQ_PIO1_RX1"] = 13] = "DREQ_PIO1_RX1";
  DREQChannel2[DREQChannel2["DREQ_PIO1_RX2"] = 14] = "DREQ_PIO1_RX2";
  DREQChannel2[DREQChannel2["DREQ_PIO1_RX3"] = 15] = "DREQ_PIO1_RX3";
  DREQChannel2[DREQChannel2["DREQ_SPI0_TX"] = 16] = "DREQ_SPI0_TX";
  DREQChannel2[DREQChannel2["DREQ_SPI0_RX"] = 17] = "DREQ_SPI0_RX";
  DREQChannel2[DREQChannel2["DREQ_SPI1_TX"] = 18] = "DREQ_SPI1_TX";
  DREQChannel2[DREQChannel2["DREQ_SPI1_RX"] = 19] = "DREQ_SPI1_RX";
  DREQChannel2[DREQChannel2["DREQ_UART0_TX"] = 20] = "DREQ_UART0_TX";
  DREQChannel2[DREQChannel2["DREQ_UART0_RX"] = 21] = "DREQ_UART0_RX";
  DREQChannel2[DREQChannel2["DREQ_UART1_TX"] = 22] = "DREQ_UART1_TX";
  DREQChannel2[DREQChannel2["DREQ_UART1_RX"] = 23] = "DREQ_UART1_RX";
  DREQChannel2[DREQChannel2["DREQ_PWM_WRAP0"] = 24] = "DREQ_PWM_WRAP0";
  DREQChannel2[DREQChannel2["DREQ_PWM_WRAP1"] = 25] = "DREQ_PWM_WRAP1";
  DREQChannel2[DREQChannel2["DREQ_PWM_WRAP2"] = 26] = "DREQ_PWM_WRAP2";
  DREQChannel2[DREQChannel2["DREQ_PWM_WRAP3"] = 27] = "DREQ_PWM_WRAP3";
  DREQChannel2[DREQChannel2["DREQ_PWM_WRAP4"] = 28] = "DREQ_PWM_WRAP4";
  DREQChannel2[DREQChannel2["DREQ_PWM_WRAP5"] = 29] = "DREQ_PWM_WRAP5";
  DREQChannel2[DREQChannel2["DREQ_PWM_WRAP6"] = 30] = "DREQ_PWM_WRAP6";
  DREQChannel2[DREQChannel2["DREQ_PWM_WRAP7"] = 31] = "DREQ_PWM_WRAP7";
  DREQChannel2[DREQChannel2["DREQ_I2C0_TX"] = 32] = "DREQ_I2C0_TX";
  DREQChannel2[DREQChannel2["DREQ_I2C0_RX"] = 33] = "DREQ_I2C0_RX";
  DREQChannel2[DREQChannel2["DREQ_I2C1_TX"] = 34] = "DREQ_I2C1_TX";
  DREQChannel2[DREQChannel2["DREQ_I2C1_RX"] = 35] = "DREQ_I2C1_RX";
  DREQChannel2[DREQChannel2["DREQ_ADC"] = 36] = "DREQ_ADC";
  DREQChannel2[DREQChannel2["DREQ_XIP_STREAM"] = 37] = "DREQ_XIP_STREAM";
  DREQChannel2[DREQChannel2["DREQ_XIP_SSITX"] = 38] = "DREQ_XIP_SSITX";
  DREQChannel2[DREQChannel2["DREQ_XIP_SSIRX"] = 39] = "DREQ_XIP_SSIRX";
  DREQChannel2[DREQChannel2["DREQ_MAX"] = 40] = "DREQ_MAX";
})(DREQChannel || (DREQChannel = {}));
var TREQ;
(function(TREQ2) {
  TREQ2[TREQ2["Timer0"] = 59] = "Timer0";
  TREQ2[TREQ2["Timer1"] = 60] = "Timer1";
  TREQ2[TREQ2["Timer2"] = 61] = "Timer2";
  TREQ2[TREQ2["Timer3"] = 62] = "Timer3";
  TREQ2[TREQ2["Permanent"] = 63] = "Permanent";
})(TREQ || (TREQ = {}));
var CHn_READ_ADDR = 0;
var CHn_WRITE_ADDR = 4;
var CHn_TRANS_COUNT = 8;
var CHn_CTRL_TRIG = 12;
var CHn_AL1_CTRL = 16;
var CHn_AL1_READ_ADDR = 20;
var CHn_AL1_WRITE_ADDR = 24;
var CHn_AL1_TRANS_COUNT_TRIG = 28;
var CHn_AL2_CTRL = 32;
var CHn_AL2_TRANS_COUNT = 36;
var CHn_AL2_READ_ADDR = 40;
var CHn_AL2_WRITE_ADDR_TRIG = 44;
var CHn_AL3_CTRL = 48;
var CHn_AL3_WRITE_ADDR = 52;
var CHn_AL3_TRANS_COUNT = 56;
var CHn_AL3_READ_ADDR_TRIG = 60;
var CHn_DBG_CTDREQ = 2048;
var CHn_DBG_TCR = 2052;
var CHANNEL_REGISTERS_SIZE = 12 * 64;
var CHANNEL_REGISTERS_MASK = 2111;
var INTR = 1024;
var INTE0 = 1028;
var INTF0 = 1032;
var INTS0 = 1036;
var INTE1 = 1044;
var INTF1 = 1048;
var INTS1 = 1052;
var TIMER0 = 1056;
var TIMER1 = 1060;
var TIMER2 = 1064;
var TIMER3 = 1068;
var MULTI_CHAN_TRIGGER = 1072;
var CHAN_ABORT = 1092;
var N_CHANNELS = 1096;
var AHB_ERROR = 1 << 31;
var READ_ERROR = 1 << 30;
var WRITE_ERROR = 1 << 29;
var BUSY = 1 << 24;
var SNIFF_EN = 1 << 23;
var BSWAP = 1 << 22;
var IRQ_QUIET = 1 << 21;
var TREQ_SEL_MASK = 63;
var TREQ_SEL_SHIFT = 15;
var CHAIN_TO_MASK = 15;
var CHAIN_TO_SHIFT = 11;
var RING_SEL = 1 << 10;
var RING_SIZE_MASK = 15;
var RING_SIZE_SHIFT = 6;
var INCR_WRITE = 1 << 5;
var INCR_READ = 1 << 4;
var DATA_SIZE_MASK = 3;
var DATA_SIZE_SHIFT = 2;
var HIGH_PRIORITY = 1 << 1;
var EN = 1 << 0;
var CHn_CTRL_TRIG_WRITE_MASK = 16777215;
var CHn_CTRL_TRIG_WC_MASK = READ_ERROR | WRITE_ERROR;
var RPDMAChannel = class {
  constructor(dma, rp2040, index) {
    this.dma = dma;
    this.rp2040 = rp2040;
    this.index = index;
    this.ctrl = 0;
    this.readAddr = 0;
    this.writeAddr = 0;
    this.transCount = 0;
    this.dreqCounter = 0;
    this.transCountReload = 0;
    this.treqValue = 0;
    this.dataSize = 1;
    this.chainTo = 0;
    this.ringMask = 0;
    this.transferFn = () => 0;
    this.transferTimer = null;
    this.transfer8 = () => {
      const { rp2040: rp20402 } = this;
      rp20402.writeUint8(this.writeAddr, rp20402.readUint8(this.readAddr));
    };
    this.transfer16 = () => {
      const { rp2040: rp20402 } = this;
      rp20402.writeUint16(this.writeAddr, rp20402.readUint16(this.readAddr));
    };
    this.transferSwap16 = () => {
      const { rp2040: rp20402 } = this;
      const input = rp20402.readUint16(this.readAddr);
      rp20402.writeUint16(this.writeAddr, (input & 255) << 8 | input >> 8);
    };
    this.transfer32 = () => {
      const { rp2040: rp20402 } = this;
      rp20402.writeUint32(this.writeAddr, rp20402.readUint32(this.readAddr));
    };
    this.transferSwap32 = () => {
      const { rp2040: rp20402 } = this;
      const input = rp20402.readUint32(this.readAddr);
      rp20402.writeUint32(this.writeAddr, (input & 255) << 24 | (input & 65280) << 8 | (input & 16711680) >> 8 | input >> 24 & 255);
    };
    this.transfer = () => {
      var _a;
      const { ctrl, dataSize, ringMask } = this;
      this.transferTimer = null;
      this.transferFn();
      if (ctrl & INCR_READ) {
        if (ringMask && !(ctrl & RING_SEL)) {
          this.readAddr = this.readAddr & ~ringMask | this.readAddr + dataSize & ringMask;
        } else {
          this.readAddr += dataSize;
        }
      }
      if (ctrl & INCR_WRITE) {
        if (ringMask && ctrl & RING_SEL) {
          this.writeAddr = this.writeAddr & ~ringMask | this.writeAddr + dataSize & ringMask;
        } else {
          this.writeAddr += dataSize;
        }
      }
      this.transCount--;
      if (this.transCount > 0) {
        this.scheduleTransfer();
      } else {
        this.ctrl &= ~BUSY;
        if (!(this.ctrl & IRQ_QUIET)) {
          this.dma.intRaw |= 1 << this.index;
          this.dma.checkInterrupts();
        }
        if (this.chainTo !== this.index) {
          (_a = this.dma.channels[this.chainTo]) === null || _a === void 0 ? void 0 : _a.start();
        }
      }
    };
    this.reset();
  }
  start() {
    if (!(this.ctrl & EN) || this.ctrl & BUSY) {
      return;
    }
    this.ctrl |= BUSY;
    this.transCount = this.transCountReload;
    if (this.transCount) {
      this.scheduleTransfer();
    }
  }
  get treq() {
    return this.treqValue;
  }
  get active() {
    return this.ctrl & EN && this.ctrl & BUSY;
  }
  scheduleTransfer() {
    if (this.transferTimer) {
      return;
    }
    if (this.dma.dreq[this.treqValue] || this.treqValue === TREQ.Permanent) {
      this.transferTimer = this.rp2040.clock.createTimer(0, this.transfer);
    } else {
      const delay = this.dma.getTimer(this.treqValue);
      if (delay) {
        this.transferTimer = this.rp2040.clock.createTimer(delay, this.transfer);
      }
    }
  }
  abort() {
    this.ctrl &= ~BUSY;
    if (this.transferTimer) {
      this.rp2040.clock.deleteTimer(this.transferTimer);
      this.transferTimer = null;
    }
  }
  readUint32(offset) {
    switch (offset) {
      case CHn_READ_ADDR:
      case CHn_AL1_READ_ADDR:
      case CHn_AL2_READ_ADDR:
      case CHn_AL3_READ_ADDR_TRIG:
        return this.readAddr;
      case CHn_WRITE_ADDR:
      case CHn_AL1_WRITE_ADDR:
      case CHn_AL2_WRITE_ADDR_TRIG:
      case CHn_AL3_WRITE_ADDR:
        return this.writeAddr;
      case CHn_TRANS_COUNT:
      case CHn_AL1_TRANS_COUNT_TRIG:
      case CHn_AL2_TRANS_COUNT:
      case CHn_AL3_TRANS_COUNT:
        return this.transCount;
      case CHn_CTRL_TRIG:
      case CHn_AL1_CTRL:
      case CHn_AL2_CTRL:
      case CHn_AL3_CTRL:
        return this.ctrl;
      case CHn_DBG_CTDREQ:
        return this.dreqCounter;
      case CHn_DBG_TCR:
        return this.transCountReload;
    }
    return 0;
  }
  writeUint32(offset, value) {
    switch (offset) {
      case CHn_READ_ADDR:
      case CHn_AL1_READ_ADDR:
      case CHn_AL2_READ_ADDR:
      case CHn_AL3_READ_ADDR_TRIG:
        this.readAddr = value;
        break;
      case CHn_WRITE_ADDR:
      case CHn_AL1_WRITE_ADDR:
      case CHn_AL2_WRITE_ADDR_TRIG:
      case CHn_AL3_WRITE_ADDR:
        this.writeAddr = value;
        break;
      case CHn_TRANS_COUNT:
      case CHn_AL1_TRANS_COUNT_TRIG:
      case CHn_AL2_TRANS_COUNT:
      case CHn_AL3_TRANS_COUNT:
        this.transCountReload = value;
        break;
      case CHn_CTRL_TRIG:
      case CHn_AL1_CTRL:
      case CHn_AL2_CTRL:
      case CHn_AL3_CTRL: {
        this.ctrl = this.ctrl & ~CHn_CTRL_TRIG_WRITE_MASK | value & CHn_CTRL_TRIG_WRITE_MASK;
        this.ctrl &= ~(value & CHn_CTRL_TRIG_WC_MASK);
        this.treqValue = this.ctrl >> TREQ_SEL_SHIFT & TREQ_SEL_MASK;
        this.chainTo = this.ctrl >> CHAIN_TO_SHIFT & CHAIN_TO_MASK;
        const ringSize = this.ctrl >> RING_SIZE_SHIFT & RING_SIZE_MASK;
        this.ringMask = ringSize ? (1 << ringSize) - 1 : 0;
        switch (this.ctrl >> DATA_SIZE_SHIFT & DATA_SIZE_MASK) {
          case 1:
            this.dataSize = 2;
            this.transferFn = this.ctrl & BSWAP ? this.transferSwap16 : this.transfer16;
            break;
          case 2:
            this.dataSize = 4;
            this.transferFn = this.ctrl & BSWAP ? this.transferSwap32 : this.transfer32;
            break;
          case 0:
          default:
            this.transferFn = this.transfer8;
            this.dataSize = 1;
        }
        if (this.ctrl & EN && this.ctrl & BUSY) {
          this.scheduleTransfer();
        }
        if (!(this.ctrl & EN) && this.transferTimer) {
          this.rp2040.clock.deleteTimer(this.transferTimer);
          this.transferTimer = null;
        }
        break;
      }
      case CHn_DBG_CTDREQ:
        this.dreqCounter = 0;
        break;
    }
    if (offset === CHn_AL3_READ_ADDR_TRIG || offset === CHn_AL2_WRITE_ADDR_TRIG || offset === CHn_AL1_TRANS_COUNT_TRIG || offset === CHn_CTRL_TRIG) {
      if (value) {
        this.start();
      } else if (this.ctrl & IRQ_QUIET) {
        this.dma.intRaw |= 1 << this.index;
        this.dma.checkInterrupts();
      }
    }
  }
  reset() {
    this.writeUint32(CHn_CTRL_TRIG, this.index << CHAIN_TO_SHIFT);
  }
};
var RPDMA = class extends BasePeripheral {
  constructor() {
    super(...arguments);
    this.channels = [
      new RPDMAChannel(this, this.rp2040, 0),
      new RPDMAChannel(this, this.rp2040, 1),
      new RPDMAChannel(this, this.rp2040, 2),
      new RPDMAChannel(this, this.rp2040, 3),
      new RPDMAChannel(this, this.rp2040, 4),
      new RPDMAChannel(this, this.rp2040, 5),
      new RPDMAChannel(this, this.rp2040, 6),
      new RPDMAChannel(this, this.rp2040, 7),
      new RPDMAChannel(this, this.rp2040, 8),
      new RPDMAChannel(this, this.rp2040, 9),
      new RPDMAChannel(this, this.rp2040, 10),
      new RPDMAChannel(this, this.rp2040, 11)
    ];
    this.intRaw = 0;
    this.intEnable0 = 0;
    this.intForce0 = 0;
    this.intEnable1 = 0;
    this.intForce1 = 0;
    this.timer0 = 0;
    this.timer1 = 0;
    this.timer2 = 0;
    this.timer3 = 0;
    this.dreq = Array(DREQChannel.DREQ_MAX);
  }
  get intStatus0() {
    return this.intRaw & this.intEnable0 | this.intForce0;
  }
  get intStatus1() {
    return this.intRaw & this.intEnable1 | this.intForce1;
  }
  readUint32(offset) {
    if ((offset & 2047) <= CHANNEL_REGISTERS_SIZE) {
      const channelIndex = (offset & 2047) >> 6;
      return this.channels[channelIndex].readUint32(offset & CHANNEL_REGISTERS_MASK);
    }
    switch (offset) {
      case TIMER0:
        return this.timer0;
      case TIMER1:
        return this.timer1;
      case TIMER2:
        return this.timer2;
      case TIMER3:
        return this.timer3;
      case INTR:
        return this.intRaw;
      case INTE0:
        return this.intEnable0;
      case INTF0:
        return this.intForce0;
      case INTS0:
        return this.intStatus0;
      case INTE1:
        return this.intEnable1;
      case INTF1:
        return this.intForce1;
      case INTS1:
        return this.intStatus1;
      case N_CHANNELS:
        return this.channels.length;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    if ((offset & 2047) <= CHANNEL_REGISTERS_SIZE) {
      const channelIndex = (offset & 2047) >> 6;
      this.channels[channelIndex].writeUint32(offset & CHANNEL_REGISTERS_MASK, value);
      return;
    }
    switch (offset) {
      case TIMER0:
        this.timer0 = value;
        return;
      case TIMER1:
        this.timer1 = value;
        return;
      case TIMER2:
        this.timer2 = value;
        return;
      case TIMER3:
        this.timer3 = value;
        return;
      case INTR:
      case INTS0:
      case INTS1:
        this.intRaw &= ~this.rawWriteValue;
        this.checkInterrupts();
        return;
      case INTE0:
        this.intEnable0 = value & 65535;
        this.checkInterrupts();
        return;
      case INTF0:
        this.intForce0 = value & 65535;
        this.checkInterrupts();
        return;
      case INTE1:
        this.intEnable1 = value & 65535;
        this.checkInterrupts();
        return;
      case INTF1:
        this.intForce1 = value & 65535;
        this.checkInterrupts();
        return;
      case MULTI_CHAN_TRIGGER:
        for (const chan of this.channels) {
          if (value & 1 << chan.index) {
            chan.start();
          }
        }
        return;
      case CHAN_ABORT:
        for (const chan of this.channels) {
          if (value & 1 << chan.index) {
            chan.abort();
          }
        }
        return;
      default:
        super.writeUint32(offset, value);
    }
  }
  setDREQ(dreqChannel) {
    const { dreq } = this;
    if (!dreq[dreqChannel]) {
      dreq[dreqChannel] = true;
      for (const channel of this.channels) {
        if (channel.treq === dreqChannel && channel.active) {
          channel.scheduleTransfer();
        }
      }
    }
  }
  clearDREQ(dreqChannel) {
    this.dreq[dreqChannel] = false;
  }
  /**
   * Returns the number of microseconds for a cycle of the given DMA timer, or 0 if the timer is disabled.
   */
  getTimer(treq) {
    let dividend = 0, divisor = 1;
    switch (treq) {
      case TREQ.Permanent:
        dividend = 1;
        divisor = 1;
        break;
      case TREQ.Timer0:
        dividend = this.timer0 >>> 16;
        divisor = this.timer0 & 65535;
        break;
      case TREQ.Timer1:
        dividend = this.timer1 >>> 16;
        divisor = this.timer1 & 65535;
        break;
      case TREQ.Timer2:
        dividend = this.timer2 >>> 16;
        divisor = this.timer2 & 65535;
        break;
      case TREQ.Timer3:
        dividend = this.timer3 >>> 36;
        divisor = this.timer3 & 65535;
        break;
    }
    if (divisor === 0) {
      return 0;
    }
    return dividend / divisor * 1e6 / this.rp2040.clkSys;
  }
  checkInterrupts() {
    this.rp2040.setInterrupt(IRQ.DMA_IRQ0, !!this.intStatus0);
    this.rp2040.setInterrupt(IRQ.DMA_IRQ1, !!this.intStatus1);
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/pio.js
var CTRL = 0;
var FSTAT = 4;
var FDEBUG = 8;
var FLEVEL = 12;
var IRQ2 = 48;
var IRQ_FORCE = 52;
var INPUT_SYNC_BYPASS = 56;
var DBG_PADOUT = 60;
var DBG_PADOE = 64;
var DBG_CFGINFO = 68;
var INSTR_MEM0 = 72;
var INSTR_MEM31 = 196;
var INTR2 = 296;
var IRQ0_INTE = 300;
var IRQ0_INTF = 304;
var IRQ0_INTS = 308;
var IRQ1_INTE = 312;
var IRQ1_INTF = 316;
var IRQ1_INTS = 320;
var TXF0 = 16;
var TXF1 = 20;
var TXF2 = 24;
var TXF3 = 28;
var RXF0 = 32;
var RXF1 = 36;
var RXF2 = 40;
var RXF3 = 44;
var SM0_CLKDIV = 200;
var SM0_EXECCTRL = 204;
var SM0_SHIFTCTRL = 208;
var SM0_ADDR = 212;
var SM0_INSTR = 216;
var SM0_PINCTRL = 220;
var SM1_CLKDIV = 224;
var SM1_PINCTRL = 244;
var SM2_CLKDIV = 248;
var SM2_PINCTRL = 268;
var SM3_CLKDIV = 272;
var SM3_PINCTRL = 292;
var FSTAT_TXEMPTY = 1 << 24;
var FSTAT_TXFULL = 1 << 16;
var FSTAT_RXEMPTY = 1 << 8;
var FSTAT_RXFULL = 1 << 0;
var FDEBUG_TXSTALL = 1 << 24;
var FDEBUG_TXOVER = 1 << 16;
var FDEBUG_RXUNDER = 1 << 8;
var FDEBUG_RXSTALL = 1 << 0;
var SHIFTCTRL_AUTOPUSH = 1 << 16;
var SHIFTCTRL_AUTOPULL = 1 << 17;
var SHIFTCTRL_IN_SHIFTDIR = 1 << 18;
var SHIFTCTRL_OUT_SHIFTDIR = 1 << 19;
var EXECCTRL_STATUS_SEL = 1 << 4;
var EXECCTRL_SIDE_PINDIR = 1 << 29;
var EXECCTRL_SIDE_EN = 1 << 30;
var EXECCTRL_EXEC_STALLED = 1 << 31;
var WaitType;
(function(WaitType2) {
  WaitType2[WaitType2["None"] = 0] = "None";
  WaitType2[WaitType2["Pin"] = 1] = "Pin";
  WaitType2[WaitType2["rxFIFO"] = 2] = "rxFIFO";
  WaitType2[WaitType2["txFIFO"] = 3] = "txFIFO";
  WaitType2[WaitType2["IRQ"] = 4] = "IRQ";
  WaitType2[WaitType2["Out"] = 5] = "Out";
})(WaitType || (WaitType = {}));
function bitReverse(x) {
  x = (x & 1431655765) << 1 | (x & 2863311530) >>> 1;
  x = (x & 858993459) << 2 | (x & 3435973836) >>> 2;
  x = (x & 252645135) << 4 | (x & 4042322160) >>> 4;
  x = (x & 16711935) << 8 | (x & 4278255360) >>> 8;
  x = (x & 65535) << 16 | (x & 4294901760) >>> 16;
  return x >>> 0;
}
function irqIndex(irq, machineIndex) {
  const rel = !!(irq & 16);
  return rel ? irq & 4 | (irq & 3) + machineIndex & 3 : irq & 7;
}
var dreqRx0 = [
  DREQChannel.DREQ_PIO1_RX0,
  DREQChannel.DREQ_PIO0_RX1,
  DREQChannel.DREQ_PIO0_RX2,
  DREQChannel.DREQ_PIO0_RX3
];
var dreqTx0 = [
  DREQChannel.DREQ_PIO0_TX0,
  DREQChannel.DREQ_PIO0_TX1,
  DREQChannel.DREQ_PIO0_TX2,
  DREQChannel.DREQ_PIO0_TX3
];
var dreqRx1 = [
  DREQChannel.DREQ_PIO1_RX0,
  DREQChannel.DREQ_PIO1_RX1,
  DREQChannel.DREQ_PIO1_RX2,
  DREQChannel.DREQ_PIO1_RX3
];
var dreqTx1 = [
  DREQChannel.DREQ_PIO1_TX0,
  DREQChannel.DREQ_PIO1_TX1,
  DREQChannel.DREQ_PIO1_TX2,
  DREQChannel.DREQ_PIO1_TX3
];
var StateMachine = class {
  constructor(rp2040, pio, index) {
    this.rp2040 = rp2040;
    this.pio = pio;
    this.index = index;
    this.enabled = false;
    this.x = 0;
    this.y = 0;
    this.pc = 0;
    this.inputShiftReg = 0;
    this.inputShiftCount = 0;
    this.outputShiftReg = 0;
    this.outputShiftCount = 0;
    this.cycles = 0;
    this.execOpcode = 0;
    this.execValid = false;
    this.updatePC = true;
    this.clockDivInt = 1;
    this.clockDivFrac = 0;
    this.execCtrl = 31 << 12;
    this.shiftCtrl = 3 << 18;
    this.pinCtrl = 5 << 26;
    this.rxFIFO = new FIFO(4);
    this.txFIFO = new FIFO(4);
    this.outPinValues = 0;
    this.outPinDirection = 0;
    this.waiting = false;
    this.waitType = WaitType.None;
    this.waitIndex = 0;
    this.waitPolarity = false;
    this.waitDelay = -1;
    this.dreqRx = this.pio.dreqRx[this.index];
    this.dreqTx = this.pio.dreqTx[this.index];
    this.updateDMARx();
    this.updateDMATx();
  }
  updateDMATx() {
    if (this.txFIFO.full) {
      this.rp2040.dma.clearDREQ(this.dreqTx);
    } else {
      this.rp2040.dma.setDREQ(this.dreqTx);
    }
  }
  updateDMARx() {
    if (this.rxFIFO.empty) {
      this.rp2040.dma.clearDREQ(this.dreqRx);
    } else {
      this.rp2040.dma.setDREQ(this.dreqRx);
    }
  }
  writeFIFO(value) {
    if (this.txFIFO.full) {
      this.pio.fdebug |= FDEBUG_TXOVER << this.index;
      return;
    }
    this.txFIFO.push(value);
    this.updateDMATx();
    this.checkWait();
    if (this.txFIFO.full) {
      this.pio.checkInterrupts();
    }
  }
  readFIFO() {
    if (this.rxFIFO.empty) {
      this.pio.fdebug |= FDEBUG_RXUNDER << this.index;
      return 0;
    }
    const result = this.rxFIFO.pull();
    this.updateDMARx();
    this.checkWait();
    if (this.rxFIFO.empty) {
      this.pio.checkInterrupts();
    }
    return result;
  }
  get status() {
    const statusN = this.execCtrl & 15;
    if (this.execCtrl & EXECCTRL_STATUS_SEL) {
      return this.rxFIFO.itemCount < statusN ? 4294967295 : 0;
    } else {
      return this.txFIFO.itemCount < statusN ? 4294967295 : 0;
    }
  }
  jmpCondition(condition) {
    switch (condition) {
      // (no condition): Always
      case 0:
        return true;
      // !X: scratch X zero
      case 1:
        return this.x === 0;
      // X--: scratch X non-zero, post-decrement
      case 2: {
        const oldX = this.x;
        this.x = this.x - 1 >>> 0;
        return oldX !== 0;
      }
      // !Y: scratch Y zero
      case 3:
        return this.y === 0;
      // Y--: scratch Y non-zero, post-decrement
      case 4: {
        const oldY = this.y;
        this.y = this.y - 1 >>> 0;
        return oldY !== 0;
      }
      // X!=Y: scratch X not equal scratch Y
      case 5:
        return this.x >>> 0 !== this.y >>> 0;
      // PIN: branch on input pin
      case 6: {
        const { gpio } = this.rp2040;
        const { jmpPin } = this;
        return jmpPin < gpio.length ? gpio[jmpPin].inputValue : false;
      }
      // !OSRE: output shift register not empty
      case 7:
        return this.outputShiftCount < this.pullThreshold;
    }
    this.pio.error(`jmpCondition with unsupported condition: ${condition}`);
    return false;
  }
  get inPins() {
    const { gpioValues } = this.rp2040;
    const { inBase } = this;
    return inBase ? gpioValues << 32 - inBase | gpioValues >>> inBase : gpioValues;
  }
  inSourceValue(source) {
    switch (source) {
      // PINS
      case 0:
        return this.inPins;
      // X (scratch register X)
      case 1:
        return this.x;
      // Y (scratch register Y)
      case 2:
        return this.y;
      // NULL (all zeroes)
      case 3:
        return 0;
      // Reserved
      case 4:
        return 0;
      // Reserved for IN, STATUS for MOV
      case 5:
        return this.status;
      // ISR
      case 6:
        return this.inputShiftReg;
      // OSR
      case 7:
        return this.outputShiftReg;
    }
    this.pio.error(`inSourceValue with unsupported source: ${source}`);
    return 0;
  }
  writeOutValue(destination, value, bitCount) {
    switch (destination) {
      // PINS
      case 0:
        this.setOutPins(value);
        break;
      // X (scratch register X)
      case 1:
        this.x = value;
        break;
      // Y (scratch register Y)
      case 2:
        this.y = value;
        break;
      // NULL (discard data)
      case 3:
        break;
      // PINDIRS
      case 4:
        this.setOutPinDirs(value);
        break;
      // PC
      case 5:
        this.pc = value & 31;
        this.updatePC = false;
        break;
      // ISR (also sets ISR shift counter to Bit count)
      case 6:
        this.inputShiftReg = value;
        this.inputShiftCount = bitCount;
        break;
      // EXEC (Execute OSR shift data as instruction)
      case 7:
        this.execOpcode = value;
        this.execValid = true;
        break;
    }
  }
  get pushThreshold() {
    const value = this.shiftCtrl >> 20 & 31;
    return value ? value : 32;
  }
  get pullThreshold() {
    const value = this.shiftCtrl >> 25 & 31;
    return value ? value : 32;
  }
  get sidesetCount() {
    return this.pinCtrl >> 29 & 7;
  }
  get setCount() {
    return this.pinCtrl >> 26 & 7;
  }
  get outCount() {
    return this.pinCtrl >> 20 & 63;
  }
  get inBase() {
    return this.pinCtrl >> 15 & 31;
  }
  get sidesetBase() {
    return this.pinCtrl >> 10 & 31;
  }
  get setBase() {
    return this.pinCtrl >> 5 & 31;
  }
  get outBase() {
    return this.pinCtrl >> 0 & 31;
  }
  get jmpPin() {
    return this.execCtrl >> 24 & 31;
  }
  get wrapTop() {
    return this.execCtrl >> 12 & 31;
  }
  get wrapBottom() {
    return this.execCtrl >> 7 & 31;
  }
  setOutPinDirs(value) {
    this.outPinDirection = value;
    this.pio.pinDirectionsChanged(value, this.outBase, this.outCount);
  }
  setOutPins(value) {
    this.outPinValues = value;
    this.pio.pinValuesChanged(value, this.outBase, this.outCount);
  }
  outInstruction(arg) {
    const bitCount = arg & 31;
    const destination = arg >> 5;
    if (bitCount === 0) {
      this.writeOutValue(destination, this.outputShiftReg, 32);
      this.outputShiftCount = 32;
    } else {
      if (this.shiftCtrl & SHIFTCTRL_OUT_SHIFTDIR) {
        const value = this.outputShiftReg & (1 << bitCount) - 1;
        this.outputShiftReg >>>= bitCount;
        this.writeOutValue(destination, value, bitCount);
      } else {
        const value = this.outputShiftReg >>> 32 - bitCount;
        this.outputShiftReg <<= bitCount;
        this.writeOutValue(destination, value, bitCount);
      }
      this.outputShiftCount += bitCount;
      if (this.outputShiftCount > 32) {
        this.outputShiftCount = 32;
      }
    }
  }
  executeInstruction(opcode) {
    const arg = opcode & 255;
    switch (opcode >>> 13) {
      /* JMP */
      case 0:
        if (this.jmpCondition(arg >> 5)) {
          this.pc = arg & 31;
          this.updatePC = false;
        }
        break;
      /* WAIT */
      case 1: {
        const polarity = !!(arg & 128);
        const source = arg >> 5 & 3;
        const index = arg & 31;
        switch (source) {
          // GPIO:
          case 0:
            this.wait(WaitType.Pin, polarity, index);
            break;
          // PIN:
          case 1:
            this.wait(WaitType.Pin, polarity, (index + this.inBase) % 32);
            break;
          // IRQ:
          case 2:
            this.wait(WaitType.IRQ, polarity, irqIndex(index, this.index));
            break;
        }
        break;
      }
      /* IN */
      case 2: {
        const bitCount = arg & 31;
        let sourceValue = this.inSourceValue(arg >> 5);
        if (bitCount == 0) {
          this.inputShiftReg = sourceValue;
          this.inputShiftCount = 32;
        } else {
          sourceValue &= (1 << bitCount) - 1;
          if (this.shiftCtrl & SHIFTCTRL_IN_SHIFTDIR) {
            this.inputShiftReg >>>= bitCount;
            this.inputShiftReg |= sourceValue << 32 - bitCount;
          } else {
            this.inputShiftReg <<= bitCount;
            this.inputShiftReg |= sourceValue;
          }
          this.inputShiftCount += bitCount;
          if (this.inputShiftCount > 32) {
            this.inputShiftCount = 32;
          }
        }
        if (this.shiftCtrl & SHIFTCTRL_AUTOPUSH && this.inputShiftCount >= this.pushThreshold) {
          if (!this.rxFIFO.full) {
            this.rxFIFO.push(this.inputShiftReg);
            this.updateDMARx();
            this.pio.checkInterrupts();
          } else {
            this.pio.fdebug |= FDEBUG_RXSTALL << this.index;
            this.wait(WaitType.rxFIFO, false, this.inputShiftReg);
          }
          this.inputShiftCount = 0;
          this.inputShiftReg = 0;
        }
        break;
      }
      /* OUT */
      case 3: {
        if (this.shiftCtrl & SHIFTCTRL_AUTOPULL && this.outputShiftCount >= this.pullThreshold) {
          this.outputShiftCount = 0;
          if (!this.txFIFO.empty) {
            this.outputShiftReg = this.txFIFO.pull();
            this.updateDMATx();
            this.pio.checkInterrupts();
          } else {
            this.pio.fdebug |= FDEBUG_TXSTALL << this.index;
            this.wait(WaitType.Out, false, arg);
          }
        }
        if (!this.waiting) {
          this.outInstruction(arg);
        }
        break;
      }
      /* PUSH/PULL */
      case 4: {
        const block = !!(arg & 1 << 5);
        const ifFullOrEmpty = !!(arg & 1 << 6);
        if (arg & 31) {
          break;
        }
        if (arg & 128) {
          if (ifFullOrEmpty && this.shiftCtrl & SHIFTCTRL_AUTOPULL && this.outputShiftCount < this.pullThreshold) {
            break;
          }
          if (!this.txFIFO.empty) {
            this.outputShiftReg = this.txFIFO.pull();
            this.updateDMATx();
            this.pio.checkInterrupts();
          } else {
            this.pio.fdebug |= FDEBUG_TXSTALL << this.index;
            if (block) {
              this.wait(WaitType.txFIFO, false, 0);
            } else {
              this.outputShiftReg = this.x;
            }
          }
          this.outputShiftCount = 0;
        } else {
          if (ifFullOrEmpty && this.shiftCtrl & SHIFTCTRL_AUTOPUSH && this.inputShiftCount < this.pushThreshold) {
            break;
          }
          if (!this.rxFIFO.full) {
            this.rxFIFO.push(this.inputShiftReg);
            this.updateDMARx();
            this.pio.checkInterrupts();
          } else {
            this.pio.fdebug |= FDEBUG_RXSTALL << this.index;
            if (block) {
              this.wait(WaitType.rxFIFO, false, this.inputShiftReg);
            }
          }
          this.inputShiftReg = 0;
          this.inputShiftCount = 0;
        }
        break;
      }
      /* MOV */
      case 5: {
        const source = arg & 7;
        const op = arg >> 3 & 3;
        const destination = arg >> 5 & 7;
        const value = this.inSourceValue(source);
        const transformedValue = this.transformMovValue(value, op) >>> 0;
        this.setMovDestination(destination, transformedValue);
        break;
      }
      /* IRQ */
      case 6: {
        if (arg & 128) {
          break;
        }
        const clear = !!(arg & 64);
        const wait = !!(arg & 32);
        const irq = irqIndex(arg & 31, this.index);
        if (clear) {
          this.pio.irq &= ~(1 << irq);
          this.pio.irqUpdated();
        } else {
          this.pio.irq |= 1 << irq;
          this.pio.irqUpdated();
          if (wait) {
            this.wait(WaitType.IRQ, false, irq);
          }
        }
        break;
      }
      /* SET */
      case 7: {
        const data = arg & 31;
        const destination = arg >> 5;
        switch (destination) {
          case 0:
            this.setSetPins(data);
            break;
          case 1:
            this.x = data;
            break;
          case 2:
            this.y = data;
            break;
          case 4:
            this.setSetPinDirs(data);
            break;
        }
        break;
      }
    }
    this.cycles++;
    const { sidesetCount, execCtrl } = this;
    const delaySideset = opcode >> 8 & 31;
    const sideEn = !!(execCtrl & EXECCTRL_SIDE_EN);
    const delay = delaySideset & (1 << 5 - sidesetCount) - 1;
    if (sidesetCount && (!sideEn || delaySideset & 16)) {
      const sideset = delaySideset >> 5 - sidesetCount;
      this.setSideset(sideset, sideEn ? sidesetCount - 1 : sidesetCount);
    }
    if (this.execValid) {
      this.execValid = false;
      this.executeInstruction(this.execOpcode);
    } else if (this.waiting) {
      if (this.waitDelay < 0) {
        this.waitDelay = delay;
      }
      this.checkWait();
    } else {
      this.cycles += delay;
    }
  }
  wait(type, polarity, index) {
    this.waiting = true;
    this.waitType = type;
    this.waitPolarity = polarity;
    this.waitIndex = index;
    this.waitDelay = -1;
    this.updatePC = false;
  }
  nextPC() {
    if (this.pc === this.wrapTop) {
      this.pc = this.wrapBottom;
    } else {
      this.pc = this.pc + 1 & 31;
    }
  }
  step() {
    if (this.waiting) {
      this.checkWait();
      if (this.waiting) {
        return;
      }
    }
    this.updatePC = true;
    this.executeInstruction(this.pio.instructions[this.pc]);
    if (this.updatePC) {
      this.nextPC();
    }
  }
  setSetPinDirs(value) {
    this.pio.pinDirectionsChanged(value, this.setBase, this.setCount);
  }
  setSetPins(value) {
    this.pio.pinValuesChanged(value, this.setBase, this.setCount);
  }
  setSideset(value, count) {
    if (this.execCtrl & EXECCTRL_SIDE_PINDIR) {
      this.pio.pinDirectionsChanged(value, this.sidesetBase, count);
    } else {
      this.pio.pinValuesChanged(value, this.sidesetBase, count);
    }
  }
  transformMovValue(value, op) {
    switch (op) {
      case 0:
        return value;
      case 1:
        return ~value;
      case 2:
        return bitReverse(value);
      case 3:
      default:
        return value;
    }
  }
  setMovDestination(destination, value) {
    switch (destination) {
      // PINS
      case 0:
        this.setOutPins(value);
        break;
      // X (scratch register X)
      case 1:
        this.x = value;
        break;
      // Y (scratch register Y)
      case 2:
        this.y = value;
        break;
      // reserved (discard data)
      case 3:
        break;
      // EXEC
      case 4:
        this.execOpcode = value;
        this.execValid = true;
        break;
      // PC
      case 5:
        this.pc = value & 31;
        this.updatePC = false;
        break;
      // ISR (Input shift counter is reset to 0 by this operation, i.e. empty)
      case 6:
        this.inputShiftReg = value;
        this.inputShiftCount = 0;
        break;
      // OSR (Output shift counter is reset to 0 by this operation, i.e. full)
      case 7:
        this.outputShiftReg = value;
        this.outputShiftCount = 0;
        break;
    }
  }
  readUint32(offset) {
    switch (offset + SM0_CLKDIV) {
      case SM0_CLKDIV:
        return this.clockDivInt << 16 | this.clockDivFrac << 8;
      case SM0_EXECCTRL:
        return this.execCtrl;
      case SM0_SHIFTCTRL:
        return this.shiftCtrl;
      case SM0_ADDR:
        return this.pc;
      case SM0_INSTR:
        return this.pio.instructions[this.pc];
      case SM0_PINCTRL:
        return this.pinCtrl;
    }
    this.pio.error(`Read from invalid state machine register: ${offset}`);
    return 0;
  }
  writeUint32(offset, value) {
    switch (offset + SM0_CLKDIV) {
      case SM0_CLKDIV:
        this.clockDivFrac = value >>> 8 & 255;
        this.clockDivInt = value >>> 16;
        break;
      case SM0_EXECCTRL:
        this.execCtrl = (value & 2147483647 | this.execCtrl & 2147483648) >>> 0;
        break;
      case SM0_SHIFTCTRL:
        this.shiftCtrl = value;
        break;
      case SM0_ADDR:
        break;
      case SM0_INSTR:
        this.executeInstruction(value & 65535);
        if (this.waiting) {
          this.execCtrl |= EXECCTRL_EXEC_STALLED;
        }
        break;
      case SM0_PINCTRL:
        this.pinCtrl = value;
        break;
      default:
        this.pio.error(`Write to invalid state machine register: ${offset}`);
    }
  }
  get fifoStat() {
    const result = (this.txFIFO.empty ? FSTAT_TXEMPTY : 0) | (this.txFIFO.full ? FSTAT_TXFULL : 0) | (this.rxFIFO.empty ? FSTAT_RXEMPTY : 0) | (this.rxFIFO.full ? FSTAT_RXFULL : 0);
    return result << this.index;
  }
  restart() {
    this.cycles = 0;
    this.inputShiftCount = 0;
    this.outputShiftCount = 32;
    this.inputShiftReg = 0;
    this.waiting = false;
  }
  clkDivRestart() {
    this.pio.warn("clkDivRestart not implemented");
  }
  checkWait() {
    if (!this.waiting) {
      return;
    }
    switch (this.waitType) {
      case WaitType.IRQ: {
        const irqValue = !!(this.pio.irq & 1 << this.waitIndex);
        if (irqValue === this.waitPolarity) {
          this.waiting = false;
          if (irqValue) {
            this.pio.irq &= ~(1 << this.waitIndex);
          }
        }
        break;
      }
      case WaitType.Pin: {
        if (this.waitIndex < this.rp2040.gpio.length && this.rp2040.gpio[this.waitIndex].inputValue === this.waitPolarity) {
          this.waiting = false;
        }
        break;
      }
      case WaitType.rxFIFO: {
        if (!this.rxFIFO.full) {
          this.rxFIFO.push(this.waitIndex);
          this.waiting = false;
          this.updateDMARx();
          this.pio.checkInterrupts();
        }
        break;
      }
      case WaitType.txFIFO: {
        if (!this.txFIFO.empty) {
          this.outputShiftReg = this.txFIFO.pull();
          this.waiting = false;
          this.updateDMATx();
          this.pio.checkInterrupts();
        }
        break;
      }
      case WaitType.Out: {
        if (!this.txFIFO.empty) {
          this.outputShiftReg = this.txFIFO.pull();
          this.outInstruction(this.waitIndex);
          this.waiting = false;
          this.updateDMATx();
          this.pio.checkInterrupts();
        }
        break;
      }
    }
    if (!this.waiting) {
      this.nextPC();
      this.cycles += this.waitDelay;
      this.execCtrl &= ~EXECCTRL_EXEC_STALLED;
    }
  }
};
var RPPIO = class extends BasePeripheral {
  constructor(rp2040, name, firstIrq, index) {
    super(rp2040, name);
    this.firstIrq = firstIrq;
    this.index = index;
    this.instructions = new Uint32Array(32);
    this.dreqRx = this.index ? dreqRx1 : dreqRx0;
    this.dreqTx = this.index ? dreqTx1 : dreqTx0;
    this.machines = [
      new StateMachine(this.rp2040, this, 0),
      new StateMachine(this.rp2040, this, 1),
      new StateMachine(this.rp2040, this, 2),
      new StateMachine(this.rp2040, this, 3)
    ];
    this.stopped = true;
    this.fdebug = 0;
    this.inputSyncBypass = 0;
    this.irq = 0;
    this.pinValues = 0;
    this.pinDirections = 0;
    this.oldPinValues = 0;
    this.oldPinDirections = 0;
    this.runTimer = null;
    this.irq0IntEnable = 0;
    this.irq0IntForce = 0;
    this.irq1IntEnable = 0;
    this.irq1IntForce = 0;
  }
  get intRaw() {
    return (this.irq & 15) << 8 | (!this.machines[3].txFIFO.full ? 128 : 0) | (!this.machines[2].txFIFO.full ? 64 : 0) | (!this.machines[1].txFIFO.full ? 32 : 0) | (!this.machines[0].txFIFO.full ? 16 : 0) | (!this.machines[3].rxFIFO.empty ? 8 : 0) | (!this.machines[2].rxFIFO.empty ? 4 : 0) | (!this.machines[1].rxFIFO.empty ? 2 : 0) | (!this.machines[0].rxFIFO.empty ? 1 : 0);
  }
  get irq0IntStatus() {
    return this.intRaw & this.irq0IntEnable | this.irq0IntForce;
  }
  get irq1IntStatus() {
    return this.intRaw & this.irq1IntEnable | this.irq1IntForce;
  }
  readUint32(offset) {
    if (offset >= SM0_CLKDIV && offset <= SM0_PINCTRL) {
      return this.machines[0].readUint32(offset - SM0_CLKDIV);
    }
    if (offset >= SM1_CLKDIV && offset <= SM1_PINCTRL) {
      return this.machines[1].readUint32(offset - SM1_CLKDIV);
    }
    if (offset >= SM2_CLKDIV && offset <= SM2_PINCTRL) {
      return this.machines[2].readUint32(offset - SM2_CLKDIV);
    }
    if (offset >= SM3_CLKDIV && offset <= SM3_PINCTRL) {
      return this.machines[3].readUint32(offset - SM3_CLKDIV);
    }
    switch (offset) {
      case CTRL:
        return (this.machines[0].enabled ? 1 << 0 : 0) | (this.machines[1].enabled ? 1 << 1 : 0) | (this.machines[2].enabled ? 1 << 2 : 0) | (this.machines[3].enabled ? 1 << 3 : 0);
      case FSTAT:
        return this.machines[0].fifoStat | this.machines[1].fifoStat | this.machines[2].fifoStat | this.machines[3].fifoStat;
      case FDEBUG:
        return this.fdebug;
      case FLEVEL:
        return this.machines[0].txFIFO.itemCount & 15 | (this.machines[0].rxFIFO.itemCount & 15) << 4 | (this.machines[1].txFIFO.itemCount & 15) << 8 | (this.machines[1].rxFIFO.itemCount & 15) << 12 | (this.machines[2].txFIFO.itemCount & 15) << 16 | (this.machines[2].rxFIFO.itemCount & 15) << 20 | (this.machines[3].txFIFO.itemCount & 15) << 24 | (this.machines[3].rxFIFO.itemCount & 15) << 28;
      case RXF0:
        return this.machines[0].readFIFO();
      case RXF1:
        return this.machines[1].readFIFO();
      case RXF2:
        return this.machines[2].readFIFO();
      case RXF3:
        return this.machines[3].readFIFO();
      case IRQ2:
        return this.irq;
      case IRQ_FORCE:
        return 0;
      case INPUT_SYNC_BYPASS:
        return this.inputSyncBypass;
      case DBG_PADOUT:
        return this.pinValues;
      case DBG_PADOE:
        return this.pinDirections;
      case DBG_CFGINFO:
        return 2098180;
      case INTR2:
        return this.intRaw;
      case IRQ0_INTE:
        return this.irq0IntEnable;
      case IRQ0_INTF:
        return this.irq0IntForce;
      case IRQ0_INTS:
        return this.irq0IntStatus;
      case IRQ1_INTE:
        return this.irq1IntEnable;
      case IRQ1_INTF:
        return this.irq1IntForce;
      case IRQ1_INTS:
        return this.irq1IntStatus;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    if (offset >= INSTR_MEM0 && offset <= INSTR_MEM31) {
      const index = offset - INSTR_MEM0 >> 2;
      this.instructions[index] = value & 65535;
      return;
    }
    if (offset >= SM0_CLKDIV && offset <= SM0_PINCTRL) {
      this.machines[0].writeUint32(offset - SM0_CLKDIV, value);
      return;
    }
    if (offset >= SM1_CLKDIV && offset <= SM1_PINCTRL) {
      this.machines[1].writeUint32(offset - SM1_CLKDIV, value);
      return;
    }
    if (offset >= SM2_CLKDIV && offset <= SM2_PINCTRL) {
      this.machines[2].writeUint32(offset - SM2_CLKDIV, value);
      return;
    }
    if (offset >= SM3_CLKDIV && offset <= SM3_PINCTRL) {
      this.machines[3].writeUint32(offset - SM3_CLKDIV, value);
      return;
    }
    switch (offset) {
      case CTRL: {
        for (let index = 0; index < 4; index++) {
          this.machines[index].enabled = value & 1 << index ? true : false;
          if (value & 1 << 4 + index) {
            this.machines[index].restart();
          }
          if (value & 1 << 8 + index) {
            this.machines[index].clkDivRestart();
          }
        }
        const shouldRun = value & 15;
        if (this.stopped && shouldRun) {
          this.stopped = false;
          this.run();
        }
        if (!shouldRun) {
          this.stopped = true;
        }
        break;
      }
      case FDEBUG:
        this.fdebug &= ~this.rawWriteValue;
        break;
      case TXF0:
        this.machines[0].writeFIFO(value);
        break;
      case TXF1:
        this.machines[1].writeFIFO(value);
        break;
      case TXF2:
        this.machines[2].writeFIFO(value);
        break;
      case TXF3:
        this.machines[3].writeFIFO(value);
        break;
      case IRQ2:
        this.irq &= ~this.rawWriteValue;
        this.irqUpdated();
        break;
      case INPUT_SYNC_BYPASS:
        this.inputSyncBypass = value;
        break;
      case IRQ_FORCE:
        this.irq |= value;
        this.irqUpdated();
        break;
      case IRQ0_INTE:
        this.irq0IntEnable = value & 4095;
        this.checkInterrupts();
        break;
      case IRQ0_INTF:
        this.irq0IntForce = value & 4095;
        this.checkInterrupts();
        break;
      case IRQ1_INTE:
        this.irq1IntEnable = value & 4095;
        this.checkInterrupts();
        break;
      case IRQ1_INTF:
        this.irq1IntForce = value & 4095;
        this.checkInterrupts();
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
  pinValuesChanged(value, firstPin, count) {
    const mask = count > 31 ? 4294967295 : (1 << count) - 1 << firstPin;
    const newValue = (this.pinValues & ~mask | value << firstPin & mask) & 1073741823;
    this.pinValues = newValue;
  }
  pinDirectionsChanged(value, firstPin, count) {
    const mask = count > 31 ? 4294967295 : (1 << count) - 1 << firstPin;
    const newValue = (this.pinDirections & ~mask | value << firstPin & mask) & 1073741823;
    this.pinDirections = newValue;
  }
  checkInterrupts() {
    const { firstIrq } = this;
    this.rp2040.setInterrupt(firstIrq, !!this.irq0IntStatus);
    this.rp2040.setInterrupt(firstIrq + 1, !!this.irq1IntStatus);
  }
  irqUpdated() {
    for (const machine of this.machines) {
      machine.checkWait();
    }
    this.checkInterrupts();
  }
  checkChangedPins() {
    const changedPins = this.oldPinDirections ^ this.pinDirections | this.oldPinValues ^ this.pinValues;
    if (changedPins) {
      this.oldPinDirections = this.pinDirections;
      this.oldPinValues = this.pinValues;
      const { gpio } = this.rp2040;
      for (let gpioIndex = 0; gpioIndex < gpio.length; gpioIndex++) {
        if (changedPins & 1 << gpioIndex) {
          gpio[gpioIndex].checkForUpdates();
        }
      }
    }
  }
  step() {
    for (const machine of this.machines) {
      machine.step();
    }
    this.checkChangedPins();
  }
  run() {
    for (let i = 0; i < 1e3 && !this.stopped; i++) {
      this.step();
    }
    if (!this.stopped) {
      this.runTimer = setTimeout(() => this.run(), 0);
    }
  }
  stop() {
    for (const machine of this.machines) {
      machine.enabled = false;
    }
    this.stopped = true;
    if (this.runTimer) {
      clearTimeout(this.runTimer);
      this.runTimer = null;
    }
  }
};

// ../node_modules/rp2040js/dist/esm/gpio-pin.js
var GPIOPinState;
(function(GPIOPinState2) {
  GPIOPinState2[GPIOPinState2["Low"] = 0] = "Low";
  GPIOPinState2[GPIOPinState2["High"] = 1] = "High";
  GPIOPinState2[GPIOPinState2["Input"] = 2] = "Input";
  GPIOPinState2[GPIOPinState2["InputPullUp"] = 3] = "InputPullUp";
  GPIOPinState2[GPIOPinState2["InputPullDown"] = 4] = "InputPullDown";
})(GPIOPinState || (GPIOPinState = {}));
var FUNCTION_PWM = 4;
var FUNCTION_SIO = 5;
var FUNCTION_PIO0 = 6;
var FUNCTION_PIO1 = 7;
function applyOverride(value, overrideType) {
  switch (overrideType) {
    case 0:
      return value;
    case 1:
      return !value;
    case 2:
      return false;
    case 3:
      return true;
  }
  console.error("applyOverride received invalid override type", overrideType);
  return value;
}
var IRQ_EDGE_HIGH = 1 << 3;
var IRQ_EDGE_LOW = 1 << 2;
var IRQ_LEVEL_HIGH = 1 << 1;
var IRQ_LEVEL_LOW = 1 << 0;
var GPIOPin = class {
  constructor(rp2040, index, name = index.toString()) {
    this.rp2040 = rp2040;
    this.index = index;
    this.name = name;
    this.rawInputValue = false;
    this.lastValue = this.value;
    this.ctrl = 31;
    this.padValue = 54;
    this.irqEnableMask = 0;
    this.irqForceMask = 0;
    this.irqStatus = 0;
    this.listeners = /* @__PURE__ */ new Set();
  }
  get rawInterrupt() {
    return !!(this.irqStatus & this.irqEnableMask | this.irqForceMask);
  }
  get isSlewFast() {
    return !!(this.padValue & 1);
  }
  get schmittEnabled() {
    return !!(this.padValue & 2);
  }
  get pulldownEnabled() {
    return !!(this.padValue & 4);
  }
  get pullupEnabled() {
    return !!(this.padValue & 8);
  }
  get driveStrength() {
    return this.padValue >> 4 & 3;
  }
  get inputEnable() {
    return !!(this.padValue & 64);
  }
  get outputDisable() {
    return !!(this.padValue & 128);
  }
  get functionSelect() {
    return this.ctrl & 31;
  }
  get outputOverride() {
    return this.ctrl >> 8 & 3;
  }
  get outputEnableOverride() {
    return this.ctrl >> 12 & 3;
  }
  get inputOverride() {
    return this.ctrl >> 16 & 3;
  }
  get irqOverride() {
    return this.ctrl >> 28 & 3;
  }
  get rawOutputEnable() {
    const { index, rp2040, functionSelect } = this;
    const bitmask = 1 << index;
    switch (functionSelect) {
      case FUNCTION_PWM:
        return !!(rp2040.pwm.gpioDirection & bitmask);
      case FUNCTION_SIO:
        return !!(rp2040.sio.gpioOutputEnable & bitmask);
      case FUNCTION_PIO0:
        return !!(rp2040.pio[0].pinDirections & bitmask);
      case FUNCTION_PIO1:
        return !!(rp2040.pio[1].pinDirections & bitmask);
      default:
        return false;
    }
  }
  get rawOutputValue() {
    const { index, rp2040, functionSelect } = this;
    const bitmask = 1 << index;
    switch (functionSelect) {
      case FUNCTION_PWM:
        return !!(rp2040.pwm.gpioValue & bitmask);
      case FUNCTION_SIO:
        return !!(rp2040.sio.gpioValue & bitmask);
      case FUNCTION_PIO0:
        return !!(rp2040.pio[0].pinValues & bitmask);
      case FUNCTION_PIO1:
        return !!(rp2040.pio[1].pinValues & bitmask);
      default:
        return false;
    }
  }
  get inputValue() {
    return applyOverride(this.rawInputValue && this.inputEnable, this.inputOverride);
  }
  get irqValue() {
    return applyOverride(this.rawInterrupt, this.irqOverride);
  }
  get outputEnable() {
    return applyOverride(this.rawOutputEnable, this.outputEnableOverride);
  }
  get outputValue() {
    return applyOverride(this.rawOutputValue, this.outputOverride);
  }
  /**
   * Returns the STATUS register value for the pin, as outlined in section 2.19.6 of the datasheet
   */
  get status() {
    const irqToProc = this.irqValue ? 1 << 26 : 0;
    const irqFromPad = this.rawInterrupt ? 1 << 24 : 0;
    const inToPeri = this.inputValue ? 1 << 19 : 0;
    const inFromPad = this.rawInputValue ? 1 << 17 : 0;
    const oeToPad = this.outputEnable ? 1 << 13 : 0;
    const oeFromPeri = this.rawOutputEnable ? 1 << 12 : 0;
    const outToPad = this.outputValue ? 1 << 9 : 0;
    const outFromPeri = this.rawOutputValue ? 1 << 8 : 0;
    return irqToProc | irqFromPad | inToPeri | inFromPad | oeToPad | oeFromPeri | outToPad | outFromPeri;
  }
  get value() {
    if (this.outputEnable) {
      return this.outputValue ? GPIOPinState.High : GPIOPinState.Low;
    } else {
      if (this.pulldownEnabled) {
        return GPIOPinState.InputPullDown;
      }
      if (this.pullupEnabled) {
        return GPIOPinState.InputPullUp;
      }
      return GPIOPinState.Input;
    }
  }
  setInputValue(value) {
    this.rawInputValue = value;
    const prevIrqValue = this.irqValue;
    if (value && this.inputEnable) {
      this.irqStatus |= IRQ_EDGE_HIGH | IRQ_LEVEL_HIGH;
      this.irqStatus &= ~IRQ_LEVEL_LOW;
    } else {
      this.irqStatus |= IRQ_EDGE_LOW | IRQ_LEVEL_LOW;
      this.irqStatus &= ~IRQ_LEVEL_HIGH;
    }
    if (this.irqValue !== prevIrqValue) {
      this.rp2040.updateIOInterrupt();
    }
    if (this.functionSelect === FUNCTION_PWM) {
      this.rp2040.pwm.gpioOnInput(this.index);
    }
    for (const pio of this.rp2040.pio) {
      for (const machine of pio.machines) {
        if (machine.enabled && machine.waiting && machine.waitType === WaitType.Pin && machine.waitIndex === this.index) {
          machine.checkWait();
        }
      }
    }
  }
  checkForUpdates() {
    const { lastValue, value } = this;
    if (value !== lastValue) {
      this.lastValue = value;
      for (const listener of this.listeners) {
        listener(value, lastValue);
      }
    }
  }
  refreshInput() {
    this.setInputValue(this.rawInputValue);
  }
  updateIRQValue(value) {
    if (value & IRQ_EDGE_LOW && this.irqStatus & IRQ_EDGE_LOW) {
      this.irqStatus &= ~IRQ_EDGE_LOW;
      this.rp2040.updateIOInterrupt();
    }
    if (value & IRQ_EDGE_HIGH && this.irqStatus & IRQ_EDGE_HIGH) {
      this.irqStatus &= ~IRQ_EDGE_HIGH;
      this.rp2040.updateIOInterrupt();
    }
  }
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/adc.js
var CS = 0;
var RESULT = 4;
var FCS = 8;
var FIFO_REG = 12;
var DIV = 16;
var INTR3 = 20;
var INTE = 24;
var INTF = 28;
var INTS = 32;
var CS_RROBIN_MASK = 31;
var CS_RROBIN_SHIFT = 16;
var CS_AINSEL_MASK = 7;
var CS_AINSEL_SHIFT = 12;
var CS_ERR_STICKY = 1 << 10;
var CS_ERR = 1 << 9;
var CS_READY = 1 << 8;
var CS_START_MANY = 1 << 3;
var CS_START_ONE = 1 << 2;
var CS_TS_EN = 1 << 1;
var CS_EN = 1 << 0;
var CS_WRITE_MASK = CS_RROBIN_MASK << CS_RROBIN_SHIFT | CS_AINSEL_MASK << CS_AINSEL_SHIFT | CS_START_MANY | CS_START_ONE | CS_TS_EN | CS_EN;
var FCS_THRES_MASK = 15;
var FCS_THRESH_SHIFT = 24;
var FCS_LEVEL_MASK = 15;
var FCS_LEVEL_SHIFT = 16;
var FCS_OVER = 1 << 11;
var FCS_UNDER = 1 << 10;
var FCS_FULL = 1 << 9;
var FCS_EMPTY = 1 << 8;
var FCS_DREQ_EN = 1 << 3;
var FCS_ERR = 1 << 2;
var FCS_SHIFT = 1 << 1;
var FCS_EN = 1 << 0;
var FCS_WRITE_MASK = FCS_THRES_MASK << FCS_THRESH_SHIFT | FCS_DREQ_EN | FCS_ERR | FCS_SHIFT | FCS_EN;
var FIFO_ERR = 1 << 15;
var DIV_INT_MASK = 65535;
var DIV_INT_SHIFT = 8;
var DIV_FRAC_MASK = 255;
var DIV_FRAC_SHIFT = 0;
var FIFO_INT = 1 << 0;
var RPADC = class extends BasePeripheral {
  constructor(rp2040, name) {
    super(rp2040, name);
    this.numChannels = 5;
    this.resolution = 12;
    this.sampleTime = 2;
    this.channelValues = [0, 0, 0, 0, 0];
    this.onADCRead = (channel) => {
      this.rp2040.clock.createTimer(this.sampleTime, () => this.completeADCRead(this.channelValues[channel], false));
    };
    this.fifo = new FIFO(4);
    this.dreq = DREQChannel.DREQ_ADC;
    this.cs = 0;
    this.fcs = 0;
    this.clockDiv = 0;
    this.intEnable = 0;
    this.intForce = 0;
    this.result = 0;
    this.busy = false;
    this.err = false;
  }
  get temperatueEnable() {
    return this.cs & CS_TS_EN;
  }
  get enabled() {
    return this.cs & CS_EN;
  }
  get divider() {
    return 1 + (this.clockDiv >> DIV_INT_SHIFT & DIV_INT_MASK) + (this.clockDiv >> DIV_FRAC_SHIFT & DIV_FRAC_MASK) / 256;
  }
  get intRaw() {
    const thres = this.fcs >> FCS_THRESH_SHIFT & FCS_THRES_MASK;
    return this.fifo.itemCount >= thres ? FIFO_INT : 0;
  }
  get intStatus() {
    return this.intRaw & this.intEnable | this.intForce;
  }
  get activeChannel() {
    return this.cs >> CS_AINSEL_SHIFT & CS_AINSEL_MASK;
  }
  set activeChannel(channel) {
    this.cs &= ~(CS_AINSEL_MASK << CS_AINSEL_SHIFT);
    this.cs |= (channel & CS_AINSEL_SHIFT) << CS_AINSEL_SHIFT;
  }
  checkInterrupts() {
    this.rp2040.setInterrupt(IRQ.ADC_FIFO, !!this.intStatus);
  }
  startADCRead() {
    this.busy = true;
    this.onADCRead(this.activeChannel);
  }
  updateDMA() {
    if (this.fcs & FCS_DREQ_EN) {
      const thres = this.fcs >> FCS_THRESH_SHIFT & FCS_THRES_MASK;
      if (this.fifo.itemCount >= thres) {
        this.rp2040.dma.setDREQ(this.dreq);
      } else {
        this.rp2040.dma.clearDREQ(this.dreq);
      }
    }
  }
  completeADCRead(value, error) {
    this.busy = false;
    this.result = value;
    if (error) {
      this.cs |= CS_ERR_STICKY | CS_ERR;
    } else {
      this.cs &= ~CS_ERR;
    }
    if (this.fcs & FCS_EN) {
      if (this.fifo.full) {
        this.fcs |= FCS_OVER;
      } else {
        value &= 4095;
        if (this.fcs & FCS_SHIFT) {
          value >>= 4;
        }
        if (this.fcs & FCS_ERR) {
          value |= FIFO_ERR;
        }
        this.fifo.push(value);
        this.updateDMA();
        this.checkInterrupts();
      }
    }
    const round = this.cs >> CS_RROBIN_SHIFT & CS_RROBIN_MASK;
    if (round) {
      let channel = this.activeChannel + 1;
      while (!(round & 1 << channel)) {
        channel = (channel + 1) % this.numChannels;
      }
      this.activeChannel = channel;
    }
    if (this.cs & CS_START_MANY) {
      const clockMHZ = 48;
      const sampleTicks = clockMHZ * this.sampleTime;
      if (this.divider > sampleTicks) {
        const micros = (this.divider - sampleTicks) / clockMHZ;
        this.rp2040.clock.createTimer(micros, () => {
          if (this.cs & CS_START_MANY) {
            this.startADCRead();
          }
        });
      } else {
        this.startADCRead();
      }
    }
  }
  readUint32(offset) {
    switch (offset) {
      case CS:
        return this.cs | (this.err ? CS_ERR : 0) | (this.busy ? 0 : CS_READY);
      case RESULT:
        return this.result;
      case FCS:
        return this.fcs | (this.fifo.itemCount & FCS_LEVEL_MASK) << FCS_LEVEL_SHIFT | (this.fifo.full ? FCS_FULL : 0) | (this.fifo.empty ? FCS_EMPTY : 0);
      case FIFO_REG:
        if (this.fifo.empty) {
          this.fcs |= FCS_UNDER;
          return 0;
        } else {
          const value = this.fifo.pull();
          this.updateDMA();
          return value;
        }
      case DIV:
        return this.clockDiv;
      case INTR3:
        return this.intRaw;
      case INTE:
        return this.intEnable;
      case INTF:
        return this.intForce;
      case INTS:
        return this.intStatus;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    switch (offset) {
      case CS:
        this.fcs &= ~(value & CS_ERR_STICKY);
        this.cs = this.cs & ~CS_WRITE_MASK | value & CS_WRITE_MASK;
        if (value & CS_EN && !this.busy && (value & CS_START_ONE || value & CS_START_MANY)) {
          this.startADCRead();
        }
        break;
      case FCS:
        this.fcs &= ~(value & (FCS_OVER | FCS_UNDER));
        this.fcs = this.fcs & ~FCS_WRITE_MASK | value & FCS_WRITE_MASK;
        this.checkInterrupts();
        break;
      case DIV:
        this.clockDiv = value;
        break;
      case INTE:
        this.intEnable = value & FIFO_INT;
        this.checkInterrupts();
        break;
      case INTF:
        this.intForce = value & FIFO_INT;
        this.checkInterrupts();
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/clocks.js
var CLK_REF_SELECTED = 56;
var CLK_SYS_SELECTED = 68;
var RPClocks = class extends BasePeripheral {
  constructor(rp2040, name) {
    super(rp2040, name);
  }
  readUint32(offset) {
    switch (offset) {
      case CLK_REF_SELECTED:
        return 1;
      case CLK_SYS_SELECTED:
        return 1;
    }
    return super.readUint32(offset);
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/i2c.js
var IC_CON = 0;
var IC_TAR = 4;
var IC_SAR = 8;
var IC_DATA_CMD = 16;
var IC_INTR_STAT = 44;
var IC_INTR_MASK = 48;
var IC_RAW_INTR_STAT = 52;
var IC_RX_TL = 56;
var IC_TX_TL = 60;
var IC_CLR_INTR = 64;
var IC_CLR_RX_UNDER = 68;
var IC_CLR_RX_OVER = 72;
var IC_CLR_TX_OVER = 76;
var IC_CLR_RD_REQ = 80;
var IC_CLR_TX_ABRT = 84;
var IC_CLR_RX_DONE = 88;
var IC_CLR_ACTIVITY = 92;
var IC_CLR_STOP_DET = 96;
var IC_CLR_START_DET = 100;
var IC_CLR_GEN_CALL = 104;
var IC_ENABLE = 108;
var IC_STATUS = 112;
var IC_TXFLR = 116;
var IC_RXFLR = 120;
var IC_TX_ABRT_SOURCE = 128;
var IC_COMP_PARAM_1 = 244;
var IC_COMP_VERSION = 248;
var IC_COMP_TYPE = 252;
var STOP_DET_IF_MASTER_ACTIVE = 1 << 10;
var RX_FIFO_FULL_HLD_CTRL = 1 << 9;
var TX_EMPTY_CTRL = 1 << 8;
var STOP_DET_IFADDRESSED = 1 << 7;
var IC_SLAVE_DISABLE = 1 << 6;
var IC_RESTART_EN = 1 << 5;
var IC_10BITADDR_MASTER = 1 << 4;
var IC_10BITADDR_SLAVE = 1 << 3;
var SPEED_SHIFT = 1;
var SPEED_MASK = 3;
var MASTER_MODE = 1 << 0;
var SPECIAL = 1 << 11;
var GC_OR_START = 1 << 10;
var SLV_ACTIVITY = 1 << 6;
var MST_ACTIVITY = 1 << 5;
var RFF = 1 << 4;
var RFNE = 1 << 3;
var TFE = 1 << 2;
var TFNF = 1 << 1;
var ACTIVITY = 1 << 0;
var TX_CMD_BLOCK = 1 << 2;
var ABORT = 1 << 1;
var ENABLE = 1 << 0;
var TX_FLUSH_CNT_MASK = 511;
var TX_FLUSH_CNT_SHIFT = 23;
var ABRT_USER_ABRT = 1 << 16;
var ABRT_SLVRD_INT = 1 << 15;
var ABRT_SLV_ARBLOST = 1 << 14;
var ABRT_SLVFLUSH_TXFIFO = 1 << 13;
var ARB_LOST = 1 << 12;
var ABRT_MASTER_DIS = 1 << 11;
var ABRT_10B_RD_NORSTRT = 1 << 10;
var ABRT_SBYTE_NORSTRT = 1 << 9;
var ABRT_HS_NORSTRT = 1 << 8;
var ABRT_SBYTE_ACKDET = 1 << 7;
var ABRT_HS_ACKDET = 1 << 6;
var ABRT_GCALL_READ = 1 << 5;
var ABRT_GCALL_NOACK = 1 << 4;
var ABRT_TXDATA_NOACK = 1 << 3;
var ABRT_10ADDR2_NOACK = 1 << 2;
var ABRT_10ADDR1_NOACK = 1 << 1;
var ABRT_7B_ADDR_NOACK = 1 << 0;
var I2CMode;
(function(I2CMode2) {
  I2CMode2[I2CMode2["Write"] = 0] = "Write";
  I2CMode2[I2CMode2["Read"] = 1] = "Read";
})(I2CMode || (I2CMode = {}));
var I2CSpeed;
(function(I2CSpeed2) {
  I2CSpeed2[I2CSpeed2["Invalid"] = 0] = "Invalid";
  I2CSpeed2[I2CSpeed2["Standard"] = 1] = "Standard";
  I2CSpeed2[I2CSpeed2["FastMode"] = 2] = "FastMode";
  I2CSpeed2[I2CSpeed2["HighSpeedMode"] = 3] = "HighSpeedMode";
})(I2CSpeed || (I2CSpeed = {}));
var I2CState;
(function(I2CState2) {
  I2CState2[I2CState2["Idle"] = 0] = "Idle";
  I2CState2[I2CState2["Start"] = 1] = "Start";
  I2CState2[I2CState2["Connect"] = 2] = "Connect";
  I2CState2[I2CState2["Connected"] = 3] = "Connected";
  I2CState2[I2CState2["Stop"] = 4] = "Stop";
})(I2CState || (I2CState = {}));
var R_RESTART_DET = 1 << 12;
var R_GEN_CALL = 1 << 11;
var R_START_DET = 1 << 10;
var R_STOP_DET = 1 << 9;
var R_ACTIVITY = 1 << 8;
var R_RX_DONE = 1 << 7;
var R_TX_ABRT = 1 << 6;
var R_RD_REQ = 1 << 5;
var R_TX_EMPTY = 1 << 4;
var R_TX_OVER = 1 << 3;
var R_RX_FULL = 1 << 2;
var R_RX_OVER = 1 << 1;
var R_RX_UNDER = 1 << 0;
var FIRST_DATA_BYTE = 1 << 10;
var RESTART = 1 << 10;
var STOP = 1 << 9;
var CMD = 1 << 8;
var RPI2C = class extends BasePeripheral {
  constructor(rp2040, name, irq) {
    super(rp2040, name);
    this.irq = irq;
    this.state = I2CState.Idle;
    this.busy = false;
    this.stop = false;
    this.pendingRestart = false;
    this.firstByte = false;
    this.rxFIFO = new FIFO(16);
    this.txFIFO = new FIFO(16);
    this.onStart = () => this.completeStart();
    this.onConnect = () => this.completeConnect(false);
    this.onWriteByte = () => this.completeWrite(false);
    this.onReadByte = () => this.completeRead(255);
    this.onStop = () => this.completeStop();
    this.enable = 0;
    this.rxThreshold = 0;
    this.txThreshold = 0;
    this.control = IC_SLAVE_DISABLE | IC_RESTART_EN | I2CSpeed.FastMode << SPEED_SHIFT | MASTER_MODE;
    this.targetAddress = 85;
    this.slaveAddress = 85;
    this.abortSource = 0;
    this.intRaw = 0;
    this.intEnable = 0;
  }
  get intStatus() {
    return this.intRaw & this.intEnable;
  }
  get speed() {
    return this.control >> SPEED_SHIFT & SPEED_MASK;
  }
  get masterBits() {
    return this.control & IC_10BITADDR_MASTER ? 10 : 7;
  }
  checkInterrupts() {
    this.rp2040.setInterrupt(this.irq, !!this.intStatus);
  }
  clearInterrupts(mask) {
    if (this.intRaw & mask) {
      this.intRaw &= ~mask;
      this.checkInterrupts();
      return 1;
    } else {
      return 0;
    }
  }
  setInterrupts(mask) {
    if (!(this.intRaw & mask)) {
      this.intRaw |= mask;
      this.checkInterrupts();
    }
  }
  abort(reason) {
    this.abortSource &= ~TX_FLUSH_CNT_MASK;
    this.abortSource |= reason | this.txFIFO.itemCount << TX_FLUSH_CNT_SHIFT;
    this.txFIFO.reset();
    this.setInterrupts(R_TX_ABRT);
  }
  nextCommand() {
    const enabled = this.enable & ENABLE;
    const blocked = this.enable & TX_CMD_BLOCK;
    if (this.txFIFO.empty || this.busy || blocked || !enabled) {
      return;
    }
    this.busy = true;
    const restart = !!(this.txFIFO.peek() & RESTART) && !this.pendingRestart && !this.stop;
    if (this.state === I2CState.Idle || restart) {
      this.pendingRestart = restart;
      this.stop = false;
      this.state = I2CState.Start;
      this.onStart(restart);
      return;
    }
    this.pendingRestart = false;
    const cmd = this.txFIFO.pull();
    const readMode = !!(cmd & CMD);
    this.stop = !!(cmd & STOP);
    if (readMode) {
      this.onReadByte(!this.stop);
    } else {
      this.onWriteByte(cmd & 255);
    }
    if (this.txFIFO.itemCount <= this.txThreshold) {
      this.setInterrupts(R_TX_EMPTY);
    }
  }
  pushRX(value) {
    if (this.rxFIFO.full) {
      this.setInterrupts(R_RX_OVER);
      return;
    }
    this.rxFIFO.push(value);
    if (this.rxFIFO.itemCount > this.rxThreshold) {
      this.setInterrupts(R_RX_FULL);
    }
  }
  completeStart() {
    if (this.txFIFO.empty || this.state !== I2CState.Start || this.stop) {
      this.onStop();
      return;
    }
    const mode = this.txFIFO.peek() & CMD ? I2CMode.Read : I2CMode.Write;
    this.state = I2CState.Connect;
    this.setInterrupts(R_START_DET);
    const addressMask = this.masterBits === 10 ? 1023 : 255;
    this.onConnect(this.targetAddress & addressMask, mode);
  }
  completeConnect(ack, nackByte = 0) {
    if (!ack || this.stop) {
      if (!ack) {
        if (!this.targetAddress) {
          this.abort(ABRT_GCALL_NOACK);
        } else if (this.control & IC_10BITADDR_MASTER) {
          this.abort(nackByte === 0 ? ABRT_10ADDR1_NOACK : ABRT_10ADDR2_NOACK);
        } else {
          this.abort(ABRT_7B_ADDR_NOACK);
        }
      }
      this.state = I2CState.Stop;
      this.onStop();
      return;
    }
    this.state = I2CState.Connected;
    this.busy = false;
    this.firstByte = true;
    this.nextCommand();
  }
  completeWrite(ack) {
    if (!ack || this.stop) {
      if (!ack) {
        this.abort(ABRT_TXDATA_NOACK);
      }
      this.state = I2CState.Stop;
      this.onStop();
      return;
    }
    this.busy = false;
    this.nextCommand();
  }
  completeRead(value) {
    this.pushRX(value | (this.firstByte ? FIRST_DATA_BYTE : 0));
    if (this.stop) {
      this.state = I2CState.Stop;
      this.onStop();
      return;
    }
    this.firstByte = false;
    this.busy = false;
    this.nextCommand();
  }
  completeStop() {
    this.state = I2CState.Idle;
    this.setInterrupts(R_STOP_DET);
    this.busy = false;
    this.pendingRestart = false;
    if (this.enable & ABORT) {
      this.enable &= ~ABORT;
    } else {
      this.nextCommand();
    }
  }
  arbitrationLost() {
    this.state = I2CState.Idle;
    this.busy = false;
    this.abort(ARB_LOST);
  }
  readUint32(offset) {
    switch (offset) {
      case IC_CON:
        return this.control;
      case IC_TAR:
        return this.targetAddress;
      case IC_SAR:
        return this.slaveAddress;
      case IC_DATA_CMD:
        if (this.rxFIFO.empty) {
          this.setInterrupts(R_RX_UNDER);
          return 0;
        }
        this.clearInterrupts(R_RX_FULL);
        return this.rxFIFO.pull();
      case IC_INTR_STAT:
        return this.intStatus;
      case IC_INTR_MASK:
        return this.intEnable;
      case IC_RAW_INTR_STAT:
        return this.intRaw;
      case IC_RX_TL:
        return this.rxThreshold;
      case IC_TX_TL:
        return this.txThreshold;
      case IC_CLR_INTR:
        this.abortSource &= ABRT_SBYTE_NORSTRT;
        return this.clearInterrupts(R_RX_UNDER | R_RX_OVER | R_TX_OVER | R_RD_REQ | R_TX_ABRT | R_RX_DONE | R_ACTIVITY | R_STOP_DET | R_START_DET | R_GEN_CALL);
      case IC_CLR_RX_UNDER:
        return this.clearInterrupts(R_RX_UNDER);
      case IC_CLR_RX_OVER:
        return this.clearInterrupts(R_RX_OVER);
      case IC_CLR_TX_OVER:
        return this.clearInterrupts(R_TX_OVER);
      case IC_CLR_RD_REQ:
        return this.clearInterrupts(R_RD_REQ);
      case IC_CLR_TX_ABRT:
        this.abortSource &= ABRT_SBYTE_NORSTRT;
        return this.clearInterrupts(R_TX_ABRT);
      case IC_CLR_RX_DONE:
        return this.clearInterrupts(R_RX_DONE);
      case IC_CLR_ACTIVITY:
        return this.clearInterrupts(R_ACTIVITY);
      case IC_CLR_STOP_DET:
        return this.clearInterrupts(R_STOP_DET);
      case IC_CLR_START_DET:
        return this.clearInterrupts(R_START_DET);
      case IC_CLR_GEN_CALL:
        return this.clearInterrupts(R_GEN_CALL);
      case IC_ENABLE:
        return this.enable;
      case IC_STATUS:
        return (this.state !== I2CState.Idle ? MST_ACTIVITY | ACTIVITY : 0) | (this.rxFIFO.full ? RFF : 0) | (!this.rxFIFO.empty ? RFNE : 0) | (this.txFIFO.empty ? TFE : 0) | (!this.txFIFO.full ? TFNF : 0);
      case IC_TXFLR:
        return this.txFIFO.itemCount;
      case IC_RXFLR:
        return this.rxFIFO.itemCount;
      case IC_TX_ABRT_SOURCE: {
        const value = this.abortSource;
        this.abortSource &= ABRT_SBYTE_NORSTRT;
        return value;
      }
      case IC_COMP_PARAM_1:
        return 0;
      case IC_COMP_VERSION:
        return 842019114;
      case IC_COMP_TYPE:
        return 1146552640;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    switch (offset) {
      case IC_CON:
        if ((value >> SPEED_SHIFT & SPEED_MASK) === I2CSpeed.Invalid) {
          value = value & ~(SPEED_MASK << SPEED_SHIFT) | I2CSpeed.HighSpeedMode << SPEED_SHIFT;
        }
        this.control = value;
        return;
      case IC_TAR:
        this.targetAddress = value & 1023;
        return;
      case IC_SAR:
        this.slaveAddress = value & 1023;
        return;
      case IC_DATA_CMD:
        if (this.txFIFO.full) {
          this.setInterrupts(R_TX_OVER);
        } else {
          this.txFIFO.push(value);
          this.clearInterrupts(R_TX_EMPTY);
          this.nextCommand();
        }
        return;
      case IC_RX_TL:
        this.rxThreshold = value & 255;
        if (this.rxThreshold > this.rxFIFO.size) {
          this.rxThreshold = this.rxFIFO.size;
        }
        return;
      case IC_TX_TL:
        this.txThreshold = value & 255;
        if (this.txThreshold > this.txFIFO.size) {
          this.txThreshold = this.txFIFO.size;
        }
        return;
      case IC_ENABLE:
        value |= this.enable & ABORT;
        if (value & ABORT) {
          if (this.state === I2CState.Idle) {
            value &= ~ABORT;
          } else {
            this.abort(ABRT_USER_ABRT);
            this.stop = true;
          }
        }
        if (!(value & ENABLE)) {
          this.txFIFO.reset();
          this.rxFIFO.reset();
        }
        this.enable = value;
        this.nextCommand();
        return;
      default:
        super.writeUint32(offset, value);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/io.js
var GPIO_CTRL_LAST = 236;
var INTR0 = 240;
var PROC0_INTE0 = 256;
var PROC0_INTF0 = 272;
var PROC0_INTS0 = 288;
var PROC0_INTS3 = 300;
var RPIO = class extends BasePeripheral {
  constructor(rp2040, name) {
    super(rp2040, name);
  }
  getPinFromOffset(offset) {
    const gpioIndex = offset >>> 3;
    return {
      gpio: this.rp2040.gpio[gpioIndex],
      isCtrl: !!(offset & 4)
    };
  }
  readUint32(offset) {
    if (offset <= GPIO_CTRL_LAST) {
      const { gpio, isCtrl } = this.getPinFromOffset(offset);
      return isCtrl ? gpio.ctrl : gpio.status;
    }
    if (offset >= INTR0 && offset <= PROC0_INTS3) {
      const startIndex = (offset & 15) * 2;
      const register = offset & ~15;
      const { gpio } = this.rp2040;
      let result = 0;
      for (let index = 7; index >= 0; index--) {
        const pin = gpio[index + startIndex];
        if (!pin) {
          continue;
        }
        result <<= 4;
        switch (register) {
          case INTR0:
            result |= pin.irqStatus;
            break;
          case PROC0_INTE0:
            result |= pin.irqEnableMask;
            break;
          case PROC0_INTF0:
            result |= pin.irqForceMask;
            break;
          case PROC0_INTS0:
            result |= pin.irqStatus & pin.irqEnableMask | pin.irqForceMask;
            break;
        }
      }
      return result;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    if (offset <= GPIO_CTRL_LAST) {
      const { gpio, isCtrl } = this.getPinFromOffset(offset);
      if (isCtrl) {
        gpio.ctrl = value;
        gpio.checkForUpdates();
      }
      return;
    }
    if (offset >= INTR0 && offset <= PROC0_INTS3) {
      const startIndex = (offset & 15) * 2;
      const register = offset & ~15;
      const { gpio } = this.rp2040;
      for (let index = 0; index < 8; index++) {
        const pin = gpio[index + startIndex];
        if (!pin) {
          continue;
        }
        const pinValue = value >> index * 4 & 15;
        const pinRawWriteValue = this.rawWriteValue >> index * 4 & 15;
        switch (register) {
          case INTR0:
            pin.updateIRQValue(pinRawWriteValue);
            break;
          case PROC0_INTE0:
            pin.irqEnableMask = pinValue;
            break;
          case PROC0_INTF0:
            pin.irqForceMask = pinValue;
            break;
        }
      }
      return;
    }
    super.writeUint32(offset, value);
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/pads.js
var VOLTAGE_SELECT = 0;
var GPIO_FIRST = 4;
var GPIO_LAST = 120;
var QSPI_FIRST = 4;
var QSPI_LAST = 24;
var RPPADS = class extends BasePeripheral {
  constructor(rp2040, name, bank) {
    super(rp2040, name);
    this.bank = bank;
    this.voltageSelect = 0;
    this.firstPadRegister = this.bank === "qspi" ? QSPI_FIRST : GPIO_FIRST;
    this.lastPadRegister = this.bank === "qspi" ? QSPI_LAST : GPIO_LAST;
  }
  getPinFromOffset(offset) {
    const gpioIndex = offset - this.firstPadRegister >>> 2;
    if (this.bank === "qspi") {
      return this.rp2040.qspi[gpioIndex];
    } else {
      return this.rp2040.gpio[gpioIndex];
    }
  }
  readUint32(offset) {
    if (offset >= this.firstPadRegister && offset <= this.lastPadRegister) {
      const gpio = this.getPinFromOffset(offset);
      return gpio.padValue;
    }
    switch (offset) {
      case VOLTAGE_SELECT:
        return this.voltageSelect;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    if (offset >= this.firstPadRegister && offset <= this.lastPadRegister) {
      const gpio = this.getPinFromOffset(offset);
      const oldInputEnable = gpio.inputEnable;
      gpio.padValue = value;
      gpio.checkForUpdates();
      if (oldInputEnable !== gpio.inputEnable) {
        gpio.refreshInput();
      }
      return;
    }
    switch (offset) {
      case VOLTAGE_SELECT:
        this.voltageSelect = value & 1;
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/ppb.js
var CPUID = 3328;
var ICSR = 3332;
var VTOR = 3336;
var SHPR2 = 3356;
var SHPR3 = 3360;
var SYST_CSR = 16;
var SYST_RVR = 20;
var SYST_CVR = 24;
var SYST_CALIB = 28;
var NVIC_ISER = 256;
var NVIC_ICER = 384;
var NVIC_ISPR = 512;
var NVIC_ICPR = 640;
var NVIC_IPR0 = 1024;
var NVIC_IPR1 = 1028;
var NVIC_IPR2 = 1032;
var NVIC_IPR3 = 1036;
var NVIC_IPR4 = 1040;
var NVIC_IPR5 = 1044;
var NVIC_IPR6 = 1048;
var NVIC_IPR7 = 1052;
var NMIPENDSET = 1 << 31;
var PENDSVSET = 1 << 28;
var PENDSVCLR = 1 << 27;
var PENDSTSET = 1 << 26;
var PENDSTCLR = 1 << 25;
var ISRPREEMPT = 1 << 23;
var ISRPENDING = 1 << 22;
var VECTPENDING_SHIFT = 12;
var VECTACTIVE_MASK = 511;
var VECTACTIVE_SHIFT = 0;
var RPPPB = class extends BasePeripheral {
  constructor() {
    super(...arguments);
    this.systickCountFlag = false;
    this.systickControl = 0;
    this.systickLastZero = 0;
    this.systickReload = 0;
    this.systickTimer = null;
  }
  readUint32(offset) {
    const { rp2040 } = this;
    const { core } = rp2040;
    switch (offset) {
      case CPUID:
        return 1091356161;
      /* Verified against actual hardware */
      case ICSR: {
        const pendingInterrupts = core.pendingInterrupts || core.pendingPendSV || core.pendingSystick || core.pendingSVCall;
        const vectPending = core.vectPending;
        return (core.pendingNMI ? NMIPENDSET : 0) | (core.pendingPendSV ? PENDSVSET : 0) | (core.pendingSystick ? PENDSTSET : 0) | (pendingInterrupts ? ISRPENDING : 0) | vectPending << VECTPENDING_SHIFT | (core.IPSR & VECTACTIVE_MASK) << VECTACTIVE_SHIFT;
      }
      case VTOR:
        return core.VTOR;
      /* NVIC */
      case NVIC_ISPR:
        return core.pendingInterrupts >>> 0;
      case NVIC_ICPR:
        return core.pendingInterrupts >>> 0;
      case NVIC_ISER:
        return core.enabledInterrupts >>> 0;
      case NVIC_ICER:
        return core.enabledInterrupts >>> 0;
      case NVIC_IPR0:
      case NVIC_IPR1:
      case NVIC_IPR2:
      case NVIC_IPR3:
      case NVIC_IPR4:
      case NVIC_IPR5:
      case NVIC_IPR6:
      case NVIC_IPR7: {
        const regIndex = offset - NVIC_IPR0 >> 2;
        let result = 0;
        for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
          const interruptNumber = regIndex * 4 + byteIndex;
          for (let priority = 0; priority < core.interruptPriorities.length; priority++) {
            if (core.interruptPriorities[priority] & 1 << interruptNumber) {
              result |= priority << 8 * byteIndex + 6;
            }
          }
        }
        return result;
      }
      case SHPR2:
        return core.SHPR2;
      case SHPR3:
        return core.SHPR3;
      /* SysTick */
      case SYST_CSR: {
        const countFlagValue = this.systickCountFlag ? 1 << 16 : 0;
        this.systickCountFlag = false;
        return countFlagValue | this.systickControl & 7;
      }
      case SYST_CVR: {
        const delta = (rp2040.clock.micros - this.systickLastZero) % (this.systickReload + 1);
        if (!delta) {
          return 0;
        }
        return this.systickReload - (delta - 1);
      }
      case SYST_RVR:
        return this.systickReload;
      case SYST_CALIB:
        return 9999;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    const { rp2040 } = this;
    const { core } = rp2040;
    const hardwareInterruptMask = (1 << MAX_HARDWARE_IRQ) - 1;
    switch (offset) {
      case ICSR:
        if (value & NMIPENDSET) {
          core.pendingNMI = true;
          core.interruptsUpdated = true;
        }
        if (value & PENDSVSET) {
          core.pendingPendSV = true;
          core.interruptsUpdated = true;
        }
        if (value & PENDSVCLR) {
          core.pendingPendSV = false;
        }
        if (value & PENDSTSET) {
          core.pendingSystick = true;
          core.interruptsUpdated = true;
        }
        if (value & PENDSTCLR) {
          core.pendingSystick = false;
        }
        return;
      case VTOR:
        core.VTOR = value;
        return;
      /* NVIC */
      case NVIC_ISPR:
        core.pendingInterrupts |= value;
        core.interruptsUpdated = true;
        return;
      case NVIC_ICPR:
        core.pendingInterrupts &= ~value | hardwareInterruptMask;
        return;
      case NVIC_ISER:
        core.enabledInterrupts |= value;
        core.interruptsUpdated = true;
        return;
      case NVIC_ICER:
        core.enabledInterrupts &= ~value;
        return;
      case NVIC_IPR0:
      case NVIC_IPR1:
      case NVIC_IPR2:
      case NVIC_IPR3:
      case NVIC_IPR4:
      case NVIC_IPR5:
      case NVIC_IPR6:
      case NVIC_IPR7: {
        const regIndex = offset - NVIC_IPR0 >> 2;
        for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
          const interruptNumber = regIndex * 4 + byteIndex;
          const newPriority = value >> 8 * byteIndex + 6 & 3;
          for (let priority = 0; priority < core.interruptPriorities.length; priority++) {
            core.interruptPriorities[priority] &= ~(1 << interruptNumber);
          }
          core.interruptPriorities[newPriority] |= 1 << interruptNumber;
        }
        core.interruptsUpdated = true;
        return;
      }
      case SHPR2:
        core.SHPR2 = value;
        return;
      case SHPR3:
        core.SHPR3 = value;
        return;
      // SysTick
      case SYST_CSR:
        {
          const prevInterrupt = this.systickControl === 7;
          const interrupt = value === 7;
          if (interrupt && !prevInterrupt) {
            const systickCallback = () => {
              core.pendingSystick = true;
              core.interruptsUpdated = true;
              if (core.waiting && core.checkForInterrupts()) {
                core.waiting = false;
              }
              this.systickTimer = rp2040.clock.createTimer(this.systickReload + 1, systickCallback);
            };
            this.systickTimer = rp2040.clock.createTimer(this.systickReload + 1, systickCallback);
          }
          if (prevInterrupt && interrupt) {
            if (this.systickTimer) {
              rp2040.clock.deleteTimer(this.systickTimer);
            }
            this.systickTimer = null;
          }
          this.systickControl = value & 7;
        }
        return;
      case SYST_CVR:
        this.warn(`SYSTICK CVR: not implemented yet, value=${value}`);
        return;
      case SYST_RVR:
        this.systickReload = value;
        return;
      default:
        super.writeUint32(offset, value);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/utils/timer32.js
var TimerMode2;
(function(TimerMode3) {
  TimerMode3[TimerMode3["Increment"] = 0] = "Increment";
  TimerMode3[TimerMode3["Decrement"] = 1] = "Decrement";
  TimerMode3[TimerMode3["ZigZag"] = 2] = "ZigZag";
})(TimerMode2 || (TimerMode2 = {}));
var Timer32 = class {
  constructor(clock, baseFreq) {
    this.clock = clock;
    this.baseFreq = baseFreq;
    this.baseValue = 0;
    this.baseMicros = 0;
    this.topValue = 4294967295;
    this.prescalerValue = 1;
    this.timerMode = TimerMode2.Increment;
    this.enabled = true;
    this.listeners = [];
  }
  reset() {
    this.baseMicros = this.clock.micros;
    this.baseValue = 0;
    this.updated();
  }
  set(value, zigZagDown = false) {
    this.baseValue = zigZagDown ? this.topValue * 2 - value : value;
    this.baseMicros = this.clock.micros;
    this.updated();
  }
  /**
   * Advances the counter by the given amount. Note that this will
   * decrease the counter if the timer is running in Decrement mode.
   *
   * @param delta The value to add to the counter. Can be negative.
   */
  advance(delta) {
    this.baseValue += delta;
  }
  get rawCounter() {
    const { baseFreq, prescalerValue, baseMicros, baseValue, enabled, timerMode } = this;
    if (!baseFreq || !prescalerValue || !enabled) {
      return this.baseValue;
    }
    const zigzag = timerMode == TimerMode2.ZigZag;
    const ticks = (this.clock.micros - baseMicros) / 1e6 * (baseFreq / prescalerValue);
    const topModulo = zigzag ? this.topValue * 2 : this.topValue + 1;
    const delta = timerMode == TimerMode2.Decrement ? topModulo - ticks % topModulo : ticks;
    let currentValue = Math.round(baseValue + delta);
    if (this.topValue != 4294967295) {
      currentValue %= topModulo;
    }
    return currentValue;
  }
  get counter() {
    let currentValue = this.rawCounter;
    if (this.timerMode == TimerMode2.ZigZag && currentValue > this.topValue) {
      currentValue = this.topValue * 2 - currentValue;
    }
    return currentValue >>> 0;
  }
  get top() {
    return this.topValue;
  }
  set top(value) {
    const { counter } = this;
    this.topValue = value;
    this.set(counter <= this.topValue ? counter : 0);
  }
  get frequency() {
    return this.baseFreq;
  }
  set frequency(value) {
    this.baseValue = this.counter;
    this.baseMicros = this.clock.micros;
    this.baseFreq = value;
    this.updated();
  }
  get prescaler() {
    return this.prescalerValue;
  }
  set prescaler(value) {
    this.baseValue = this.counter;
    this.baseMicros = this.clock.micros;
    this.enabled = this.prescalerValue !== 0;
    this.prescalerValue = value;
    this.updated();
  }
  toMicros(cycles) {
    const { baseFreq, prescalerValue } = this;
    return cycles * 1e6 / (baseFreq / prescalerValue);
  }
  get enable() {
    return this.enabled;
  }
  set enable(value) {
    if (value !== this.enabled) {
      if (value) {
        this.baseMicros = this.clock.micros;
      } else {
        this.baseValue = this.counter;
      }
      this.enabled = value;
      this.updated();
    }
  }
  get mode() {
    return this.timerMode;
  }
  set mode(value) {
    if (this.timerMode !== value) {
      const { counter } = this;
      this.timerMode = value;
      this.set(counter);
    }
  }
  updated() {
    for (const listener of this.listeners) {
      listener();
    }
  }
};
var Timer32PeriodicAlarm = class {
  constructor(timer, callback) {
    this.timer = timer;
    this.callback = callback;
    this.targetValue = 0;
    this.enabled = false;
    this.handleAlarm = () => {
      this.callback();
      if (this.enabled && this.timer.enable) {
        this.schedule();
      }
    };
    this.update = () => {
      this.cancel();
      if (this.enabled && this.timer.enable) {
        this.schedule();
      }
    };
    timer.listeners.push(this.update);
  }
  get enable() {
    return this.enabled;
  }
  set enable(value) {
    if (value !== this.enabled) {
      this.enabled = value;
      if (value && this.timer.enable) {
        this.schedule();
      } else {
        this.cancel();
      }
    }
  }
  get target() {
    return this.targetValue;
  }
  set target(value) {
    if (value === this.targetValue) {
      return;
    }
    this.targetValue = value;
    if (this.enabled && this.timer.enable) {
      this.cancel();
      this.schedule();
    }
  }
  schedule() {
    const { timer, targetValue } = this;
    const { top, mode, rawCounter } = timer;
    let cycleDelta = targetValue - rawCounter;
    if (mode === TimerMode2.ZigZag && cycleDelta < 0) {
      if (cycleDelta < -top) {
        cycleDelta += 2 * top;
      } else {
        cycleDelta = top * 2 - targetValue - rawCounter;
      }
    }
    if (top != 4294967295) {
      if (cycleDelta < 0) {
        cycleDelta += top + 1;
      }
      if (targetValue > top) {
        return;
      }
    }
    if (mode === TimerMode2.Decrement) {
      cycleDelta = top - cycleDelta;
    }
    const cyclesToAlarm = cycleDelta >>> 0;
    const microsToAlarm = timer.toMicros(cyclesToAlarm);
    this.clockTimer = this.timer.clock.createTimer(microsToAlarm, this.handleAlarm);
  }
  cancel() {
    if (this.clockTimer) {
      this.timer.clock.deleteTimer(this.clockTimer);
      this.clockTimer = void 0;
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/pwm.js
var CHn_CSR = 0;
var CHn_DIV = 4;
var CHn_CTR = 8;
var CHn_CC = 12;
var CHn_TOP = 16;
var EN2 = 160;
var INTR4 = 164;
var INTE2 = 168;
var INTF2 = 172;
var INTS2 = 176;
var INT_MASK = 255;
var CSR_PH_ADV = 1 << 7;
var CSR_PH_RET = 1 << 6;
var CSR_DIVMODE_SHIFT = 4;
var CSR_DIVMODE_MASK = 3;
var CSR_B_INV = 1 << 3;
var CSR_A_INV = 1 << 2;
var CSR_PH_CORRECT = 1 << 1;
var CSR_EN = 1 << 0;
var PWMDivMode;
(function(PWMDivMode2) {
  PWMDivMode2[PWMDivMode2["FreeRunning"] = 0] = "FreeRunning";
  PWMDivMode2[PWMDivMode2["BGated"] = 1] = "BGated";
  PWMDivMode2[PWMDivMode2["BRisingEdge"] = 2] = "BRisingEdge";
  PWMDivMode2[PWMDivMode2["BFallingEdge"] = 3] = "BFallingEdge";
})(PWMDivMode || (PWMDivMode = {}));
var PWMChannel = class {
  constructor(pwm, clock, index) {
    this.pwm = pwm;
    this.clock = clock;
    this.index = index;
    this.timer = new Timer32(this.clock, this.pwm.clockFreq);
    this.alarmA = new Timer32PeriodicAlarm(this.timer, () => {
      this.setA(false);
    });
    this.alarmB = new Timer32PeriodicAlarm(this.timer, () => {
      this.setB(false);
    });
    this.alarmBottom = new Timer32PeriodicAlarm(this.timer, () => this.wrap());
    this.csr = 0;
    this.div = 0;
    this.cc = 0;
    this.top = 0;
    this.lastBValue = false;
    this.countingUp = true;
    this.ccUpdated = false;
    this.topUpdated = false;
    this.tickCounter = 0;
    this.divMode = PWMDivMode.FreeRunning;
    this.pinA1 = this.index * 2;
    this.pinB1 = this.index * 2 + 1;
    this.pinA2 = this.index < 7 ? 16 + this.index * 2 + 1 : -1;
    this.pinB2 = this.index < 7 ? 16 + this.index * 2 + 1 : -1;
    this.alarmA.enable = true;
    this.alarmB.enable = true;
    this.alarmBottom.enable = true;
  }
  readRegister(offset) {
    switch (offset) {
      case CHn_CSR:
        return this.csr;
      case CHn_DIV:
        return this.div;
      case CHn_CTR:
        return this.timer.counter;
      case CHn_CC:
        return this.cc;
      case CHn_TOP:
        return this.top;
    }
    return 0;
  }
  writeRegister(offset, value) {
    switch (offset) {
      case CHn_CSR:
        if (value & CSR_EN && !(this.csr & CSR_EN)) {
          this.updateDoubleBuffered();
        }
        this.csr = value & ~(CSR_PH_ADV | CSR_PH_RET);
        if (this.csr & CSR_PH_ADV) {
          this.timer.advance(1);
        }
        if (this.csr & CSR_PH_RET) {
          this.timer.advance(-1);
        }
        this.divMode = this.csr >> CSR_DIVMODE_SHIFT & CSR_DIVMODE_MASK;
        this.setBDirection(this.divMode === PWMDivMode.FreeRunning);
        this.updateEnable();
        this.lastBValue = this.gpioBValue;
        this.timer.mode = value & CSR_PH_CORRECT ? TimerMode2.ZigZag : TimerMode2.Increment;
        break;
      case CHn_DIV: {
        this.div = value & 1048575;
        const intValue = value >> 4 & 255;
        const fracValue = value & 15;
        this.timer.prescaler = (intValue ? intValue : 256) + fracValue / 16;
        break;
      }
      case CHn_CTR:
        this.timer.set(value & 65535);
        break;
      case CHn_CC:
        this.cc = value;
        this.ccUpdated = true;
        break;
      case CHn_TOP:
        this.top = value & 65535;
        this.topUpdated = true;
        break;
    }
  }
  reset() {
    this.writeRegister(CHn_CSR, 0);
    this.writeRegister(CHn_DIV, 1 << 4);
    this.writeRegister(CHn_CTR, 0);
    this.writeRegister(CHn_CC, 0);
    this.writeRegister(CHn_TOP, 65535);
    this.countingUp = true;
    this.timer.enable = false;
    this.timer.reset();
  }
  updateDoubleBuffered() {
    if (this.ccUpdated) {
      this.alarmB.target = this.cc >>> 16;
      this.alarmA.target = this.cc & 65535;
      this.ccUpdated = false;
    }
    if (this.topUpdated) {
      this.timer.top = this.top;
      this.topUpdated = false;
    }
  }
  wrap() {
    this.pwm.channelInterrupt(this.index);
    this.updateDoubleBuffered();
    if (!(this.csr & CSR_PH_CORRECT)) {
      this.setA(this.alarmA.target > 0);
      this.setB(this.alarmB.target > 0);
    }
  }
  setA(value) {
    if (this.csr & CSR_A_INV) {
      value = !value;
    }
    this.pwm.gpioSet(this.pinA1, value);
    if (this.pinA2 >= 0) {
      this.pwm.gpioSet(this.pinA2, value);
    }
  }
  setB(value) {
    if (this.csr & CSR_B_INV) {
      value = !value;
    }
    this.pwm.gpioSet(this.pinB1, value);
    if (this.pinB2 >= 0) {
      this.pwm.gpioSet(this.pinB2, value);
    }
  }
  get gpioBValue() {
    return this.pwm.gpioRead(this.pinB1) || (this.pinB2 > 0 ? this.pwm.gpioRead(this.pinB2) : false);
  }
  setBDirection(value) {
    this.pwm.gpioSetDir(this.pinB1, value);
    if (this.pinB2 >= 0) {
      this.pwm.gpioSetDir(this.pinB2, value);
    }
  }
  gpioBChanged() {
    const value = this.gpioBValue;
    if (value === this.lastBValue) {
      return;
    }
    this.lastBValue = value;
    switch (this.divMode) {
      case PWMDivMode.BGated:
        this.updateEnable();
        break;
      case PWMDivMode.BRisingEdge:
        if (value) {
          this.tickCounter++;
        }
        break;
      case PWMDivMode.BFallingEdge:
        if (!value) {
          this.tickCounter++;
        }
        break;
    }
    if (this.tickCounter >= this.timer.prescaler) {
      this.timer.advance(1);
      this.tickCounter -= this.timer.prescaler;
    }
  }
  updateEnable() {
    const { csr, divMode } = this;
    const enable = !!(csr & CSR_EN);
    this.timer.enable = enable && (divMode === PWMDivMode.FreeRunning || divMode === PWMDivMode.BGated && this.gpioBValue);
  }
  set en(value) {
    if (value && !(this.csr & CSR_EN)) {
      this.updateDoubleBuffered();
    }
    if (value) {
      this.csr |= CSR_EN;
    } else {
      this.csr &= ~CSR_EN;
    }
    this.updateEnable();
  }
};
var RPPWM = class extends BasePeripheral {
  constructor() {
    super(...arguments);
    this.channels = [
      new PWMChannel(this, this.rp2040.clock, 0),
      new PWMChannel(this, this.rp2040.clock, 1),
      new PWMChannel(this, this.rp2040.clock, 2),
      new PWMChannel(this, this.rp2040.clock, 3),
      new PWMChannel(this, this.rp2040.clock, 4),
      new PWMChannel(this, this.rp2040.clock, 5),
      new PWMChannel(this, this.rp2040.clock, 6),
      new PWMChannel(this, this.rp2040.clock, 7)
    ];
    this.intRaw = 0;
    this.intEnable = 0;
    this.intForce = 0;
    this.gpioValue = 0;
    this.gpioDirection = 0;
  }
  get intStatus() {
    return this.intRaw & this.intEnable | this.intForce;
  }
  readUint32(offset) {
    if (offset < EN2) {
      const channel = Math.floor(offset / 20);
      return this.channels[channel].readRegister(offset % 20);
    }
    switch (offset) {
      case EN2:
        return this.channels[7].en << 7 | this.channels[6].en << 6 | this.channels[5].en << 5 | this.channels[4].en << 4 | this.channels[3].en << 3 | this.channels[2].en << 2 | this.channels[1].en << 1 | this.channels[0].en << 0;
      case INTR4:
        return this.intRaw;
      case INTE2:
        return this.intEnable;
      case INTF2:
        return this.intForce;
      case INTS2:
        return this.intStatus;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    if (offset < EN2) {
      const channel = Math.floor(offset / 20);
      return this.channels[channel].writeRegister(offset % 20, value);
    }
    switch (offset) {
      case EN2:
        this.channels[7].en = value & 1 << 7;
        this.channels[6].en = value & 1 << 6;
        this.channels[5].en = value & 1 << 5;
        this.channels[4].en = value & 1 << 4;
        this.channels[3].en = value & 1 << 3;
        this.channels[2].en = value & 1 << 2;
        this.channels[1].en = value & 1 << 1;
        this.channels[0].en = value & 1 << 0;
        break;
      case INTR4:
        this.intRaw &= ~(value & INT_MASK);
        this.checkInterrupts();
        break;
      case INTE2:
        this.intEnable = value & INT_MASK;
        this.checkInterrupts();
        break;
      case INTF2:
        this.intForce = value & INT_MASK;
        this.checkInterrupts();
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
  get clockFreq() {
    return this.rp2040.clkSys;
  }
  channelInterrupt(index) {
    this.intRaw |= 1 << index;
    this.checkInterrupts();
    this.rp2040.dma.setDREQ(DREQChannel.DREQ_PWM_WRAP0 + index);
  }
  checkInterrupts() {
    this.rp2040.setInterrupt(IRQ.PWM_WRAP, !!this.intStatus);
  }
  gpioSet(index, value) {
    const bit = 1 << index;
    const newGpioValue = value ? this.gpioValue | bit : this.gpioValue & ~bit;
    if (this.gpioValue != newGpioValue) {
      this.gpioValue = newGpioValue;
      this.rp2040.gpio[index].checkForUpdates();
    }
  }
  gpioSetDir(index, output) {
    const bit = 1 << index;
    const newGpioDirection = output ? this.gpioDirection | bit : this.gpioDirection & ~bit;
    if (this.gpioDirection != newGpioDirection) {
      this.gpioDirection = newGpioDirection;
      this.rp2040.gpio[index].checkForUpdates();
    }
  }
  gpioRead(index) {
    return this.rp2040.gpio[index].inputValue;
  }
  gpioOnInput(index) {
    if (this.gpioDirection && 1 << index) {
      return;
    }
    for (const channel of this.channels) {
      if (channel.pinB1 === index || channel.pinB2 === index) {
        channel.gpioBChanged();
      }
    }
  }
  reset() {
    this.gpioDirection = 4294967295;
    for (const channel of this.channels) {
      channel.reset();
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/reset.js
var RESET = 0;
var WDSEL = 4;
var RESET_DONE = 8;
var RPReset = class extends BasePeripheral {
  constructor() {
    super(...arguments);
    this.reset = 0;
    this.wdsel = 0;
    this.reset_done = 33554431;
  }
  readUint32(offset) {
    switch (offset) {
      case RESET:
        return this.reset;
      case WDSEL:
        return this.wdsel;
      case RESET_DONE:
        return this.reset_done;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    switch (offset) {
      case RESET:
        this.reset = value & 33554431;
        break;
      case WDSEL:
        this.wdsel = value & 33554431;
        break;
      default:
        super.writeUint32(offset, value);
        break;
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/rtc.js
var RTC_CTRL = 12;
var IRQ_SETUP_0 = 16;
var RTC_ACTIVE_BITS = 2;
var RP2040RTC = class extends BasePeripheral {
  constructor() {
    super(...arguments);
    this.running = true;
  }
  readUint32(offset) {
    switch (offset) {
      case RTC_CTRL:
        return this.running ? RTC_ACTIVE_BITS : 0;
      case IRQ_SETUP_0:
        return 0;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    switch (offset) {
      case RTC_CTRL:
        this.running = value > 0;
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/spi.js
var SSPCR0 = 0;
var SSPCR1 = 4;
var SSPDR = 8;
var SSPSR = 12;
var SSPCPSR = 16;
var SSPIMSC = 20;
var SSPRIS = 24;
var SSPMIS = 28;
var SSPICR = 32;
var SSPDMACR = 36;
var SSPPERIPHID0 = 4064;
var SSPPERIPHID1 = 4068;
var SSPPERIPHID2 = 4072;
var SSPPERIPHID3 = 4076;
var SSPPCELLID0 = 4080;
var SSPPCELLID1 = 4084;
var SSPPCELLID2 = 4088;
var SSPPCELLID3 = 4092;
var SCR_MASK = 255;
var SCR_SHIFT = 8;
var SPH = 1 << 7;
var SPO = 1 << 6;
var DSS_MASK = 15;
var DSS_SHIFT = 0;
var SOD = 1 << 3;
var MS = 1 << 2;
var SSE = 1 << 1;
var LBM = 1 << 0;
var BSY = 1 << 4;
var RFF2 = 1 << 3;
var RNE = 1 << 2;
var TNF = 1 << 1;
var TFE2 = 1 << 0;
var CPSDVSR_MASK = 254;
var TXDMAE = 1 << 1;
var RXDMAE = 1 << 0;
var SSPTXINTR = 1 << 3;
var SSPRXINTR = 1 << 2;
var SSPRTINTR = 1 << 1;
var SSPRORINTR = 1 << 0;
var RPSPI = class extends BasePeripheral {
  constructor(rp2040, name, irq) {
    super(rp2040, name);
    this.irq = irq;
    this.rxFIFO = new FIFO(8);
    this.txFIFO = new FIFO(8);
    this.onTransmit = () => this.completeTransmit(0);
    this.busy = false;
    this.control0 = 0;
    this.control1 = 0;
    this.dmaControl = 0;
    this.clockDivisor = 0;
    this.intRaw = 0;
    this.intEnable = 0;
  }
  get intStatus() {
    return this.intRaw & this.intEnable;
  }
  get enabled() {
    return !!(this.control1 & SSE);
  }
  /** Data size in bits: 4 to 16 bits */
  get dataBits() {
    return (this.control0 >> DSS_SHIFT & DSS_MASK) + 1;
  }
  get masterMode() {
    return !(this.control0 & MS);
  }
  get spiMode() {
    const cpol = this.control0 & SPO;
    const cpha = this.control0 & SPH;
    return cpol ? cpha ? 2 : 3 : cpha ? 1 : 0;
  }
  get clockFrequency() {
    if (!this.clockDivisor) {
      return 0;
    }
    const scr = this.control0 >> SCR_SHIFT & SCR_MASK;
    return this.rp2040.clkPeri / (this.clockDivisor * (1 + scr));
  }
  doTX() {
    if (!this.busy && !this.txFIFO.empty) {
      const value = this.txFIFO.pull();
      this.onTransmit(value);
      this.busy = true;
      this.fifosUpdated();
    }
  }
  completeTransmit(rxValue) {
    this.busy = false;
    if (!this.rxFIFO.full) {
      this.rxFIFO.push(rxValue);
    } else {
      this.intRaw |= SSPRORINTR;
    }
    this.fifosUpdated();
    this.doTX();
  }
  checkInterrupts() {
    this.rp2040.setInterrupt(this.irq, !!this.intStatus);
  }
  fifosUpdated() {
    const prevStatus = this.intStatus;
    if (this.txFIFO.itemCount <= this.txFIFO.size / 2) {
      this.intRaw |= SSPTXINTR;
    } else {
      this.intRaw &= ~SSPTXINTR;
    }
    if (this.rxFIFO.itemCount >= this.rxFIFO.size / 2) {
      this.intRaw |= SSPRXINTR;
    } else {
      this.intRaw &= ~SSPRXINTR;
    }
    if (this.intStatus !== prevStatus) {
      this.checkInterrupts();
    }
  }
  readUint32(offset) {
    switch (offset) {
      case SSPCR0:
        return this.control0;
      case SSPCR1:
        return this.control1;
      case SSPDR:
        if (!this.rxFIFO.empty) {
          const value = this.rxFIFO.pull();
          this.fifosUpdated();
          return value;
        }
        return 0;
      case SSPSR:
        return (this.busy || !this.txFIFO.empty ? BSY : 0) | (this.rxFIFO.full ? RFF2 : 0) | (!this.rxFIFO.empty ? RNE : 0) | (!this.txFIFO.full ? TNF : 0) | (this.txFIFO.empty ? TFE2 : 0);
      case SSPCPSR:
        return this.clockDivisor;
      case SSPIMSC:
        return this.intEnable;
      case SSPRIS:
        return this.intRaw;
      case SSPMIS:
        return this.intStatus;
      case SSPDMACR:
        return this.dmaControl;
      case SSPPERIPHID0:
        return 34;
      case SSPPERIPHID1:
        return 16;
      case SSPPERIPHID2:
        return 52;
      case SSPPERIPHID3:
        return 0;
      case SSPPCELLID0:
        return 13;
      case SSPPCELLID1:
        return 240;
      case SSPPCELLID2:
        return 5;
      case SSPPCELLID3:
        return 177;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    switch (offset) {
      case SSPCR0:
        this.control0 = value;
        return;
      case SSPCR1:
        this.control1 = value;
        return;
      case SSPDR:
        if (!this.txFIFO.full) {
          this.txFIFO.push(value);
          this.doTX();
          this.fifosUpdated();
        }
        return;
      case SSPCPSR:
        this.clockDivisor = value & CPSDVSR_MASK;
        return;
      case SSPIMSC:
        this.intEnable = value;
        this.checkInterrupts();
        return;
      case SSPDMACR:
        this.dmaControl = value;
        return;
      case SSPICR:
        this.intRaw &= ~(value & (SSPRTINTR | SSPRORINTR));
        this.checkInterrupts();
        return;
      default:
        super.writeUint32(offset, value);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/ssi.js
var SSI_TXFLR = 32;
var SSI_RXFLR = 36;
var SSI_SR = 40;
var SSI_DR0 = 96;
var SSI_SR_TFNF_BITS = 2;
var SSI_SR_TFE_BITS = 4;
var SSI_SR_RFNE_BITS = 8;
var CMD_READ_STATUS = 5;
var RPSSI = class extends BasePeripheral {
  constructor() {
    super(...arguments);
    this.dr0 = 0;
  }
  readUint32(offset) {
    switch (offset) {
      case SSI_TXFLR:
        return 0;
      case SSI_RXFLR:
        return 0;
      case SSI_SR:
        return SSI_SR_TFE_BITS | SSI_SR_RFNE_BITS | SSI_SR_TFNF_BITS;
      case SSI_DR0:
        return this.dr0;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    switch (offset) {
      case SSI_DR0:
        if (value === CMD_READ_STATUS) {
          this.dr0 = 0;
        }
        return;
      default:
        super.writeUint32(offset, value);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/syscfg.js
var PROC0_NMI_MASK = 0;
var RP2040SysCfg = class extends BasePeripheral {
  readUint32(offset) {
    switch (offset) {
      case PROC0_NMI_MASK:
        return this.rp2040.core.interruptNMIMask;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    switch (offset) {
      case PROC0_NMI_MASK:
        this.rp2040.core.interruptNMIMask = value;
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/timer.js
var TIMEHR = 8;
var TIMELR = 12;
var TIMERAWH = 36;
var TIMERAWL = 40;
var ALARM0 = 16;
var ALARM1 = 20;
var ALARM2 = 24;
var ALARM3 = 28;
var ARMED = 32;
var PAUSE = 48;
var INTR5 = 52;
var INTE3 = 56;
var INTF3 = 60;
var INTS3 = 64;
var ALARM_0 = 1 << 0;
var ALARM_1 = 1 << 1;
var ALARM_2 = 1 << 2;
var ALARM_3 = 1 << 3;
var timerInterrupts = [IRQ.TIMER_0, IRQ.TIMER_1, IRQ.TIMER_2, IRQ.TIMER_3];
var RPTimerAlarm = class {
  constructor(name, bitValue) {
    this.name = name;
    this.bitValue = bitValue;
    this.armed = false;
    this.targetMicros = 0;
    this.timer = null;
  }
};
var RPTimer = class extends BasePeripheral {
  constructor(rp2040, name) {
    super(rp2040, name);
    this.latchedTimeHigh = 0;
    this.alarms = [
      new RPTimerAlarm("Alarm 0", ALARM_0),
      new RPTimerAlarm("Alarm 1", ALARM_1),
      new RPTimerAlarm("Alarm 2", ALARM_2),
      new RPTimerAlarm("Alarm 3", ALARM_3)
    ];
    this.intRaw = 0;
    this.intEnable = 0;
    this.intForce = 0;
    this.paused = false;
    this.clock = rp2040.clock;
  }
  get intStatus() {
    return this.intRaw & this.intEnable | this.intForce;
  }
  readUint32(offset) {
    const time = this.clock.micros;
    switch (offset) {
      case TIMEHR:
        return this.latchedTimeHigh;
      case TIMELR:
        this.latchedTimeHigh = Math.floor(time / Math.pow(2, 32));
        return time >>> 0;
      case TIMERAWH:
        return Math.floor(time / Math.pow(2, 32));
      case TIMERAWL:
        return time >>> 0;
      case ALARM0:
        return this.alarms[0].targetMicros;
      case ALARM1:
        return this.alarms[1].targetMicros;
      case ALARM2:
        return this.alarms[2].targetMicros;
      case ALARM3:
        return this.alarms[3].targetMicros;
      case PAUSE:
        return this.paused ? 1 : 0;
      case INTR5:
        return this.intRaw;
      case INTE3:
        return this.intEnable;
      case INTF3:
        return this.intForce;
      case INTS3:
        return this.intStatus;
      case ARMED:
        return (this.alarms[0].armed ? this.alarms[0].bitValue : 0) | (this.alarms[1].armed ? this.alarms[1].bitValue : 0) | (this.alarms[2].armed ? this.alarms[2].bitValue : 0) | (this.alarms[3].armed ? this.alarms[3].bitValue : 0);
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    switch (offset) {
      case ALARM0:
      case ALARM1:
      case ALARM2:
      case ALARM3: {
        const alarmIndex = (offset - ALARM0) / 4;
        const alarm = this.alarms[alarmIndex];
        const delta = value - this.clock.micros >>> 0;
        this.disarmAlarm(alarm);
        alarm.armed = true;
        alarm.targetMicros = value;
        alarm.timer = this.clock.createTimer(delta, () => this.fireAlarm(alarmIndex));
        break;
      }
      case ARMED:
        for (const alarm of this.alarms) {
          if (this.rawWriteValue & alarm.bitValue) {
            this.disarmAlarm(alarm);
          }
        }
        break;
      case PAUSE:
        this.paused = !!(value & 1);
        if (this.paused) {
          this.warn("Unimplemented Timer Pause");
        }
        break;
      case INTR5:
        this.intRaw &= ~this.rawWriteValue;
        this.checkInterrupts();
        break;
      case INTE3:
        this.intEnable = value & 15;
        this.checkInterrupts();
        break;
      case INTF3:
        this.intForce = value & 15;
        this.checkInterrupts();
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
  fireAlarm(index) {
    const alarm = this.alarms[index];
    this.disarmAlarm(alarm);
    this.intRaw |= alarm.bitValue;
    this.checkInterrupts();
  }
  checkInterrupts() {
    const { intStatus } = this;
    for (let i = 0; i < this.alarms.length; i++) {
      this.rp2040.setInterrupt(timerInterrupts[i], !!(intStatus & 1 << i));
    }
  }
  disarmAlarm(alarm) {
    if (alarm.timer) {
      this.clock.deleteTimer(alarm.timer);
      alarm.timer = null;
    }
    alarm.armed = false;
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/uart.js
var UARTDR = 0;
var UARTFR = 24;
var UARTLCR_H = 44;
var UARTCR = 48;
var UARTIMSC = 56;
var UARTIRIS = 60;
var UARTIMIS = 64;
var UARTICR = 68;
var TXFE = 1 << 7;
var RXFF = 1 << 6;
var RXFE = 1 << 4;
var FEN = 1 << 4;
var RXE = 1 << 9;
var TXE = 1 << 8;
var UARTEN = 1 << 0;
var UARTRXINTR = 1 << 4;
var RPUART = class extends BasePeripheral {
  constructor(rp2040, name, irq) {
    super(rp2040, name);
    this.irq = irq;
    this.ctrlRegister = RXE | TXE;
    this.lineCtrlRegister = 0;
    this.rxFIFO = new FIFO(32);
    this.interruptMask = 0;
    this.interruptStatus = 0;
  }
  get enabled() {
    return !!(this.ctrlRegister & UARTEN);
  }
  get txEnabled() {
    return !!(this.ctrlRegister & TXE);
  }
  get rxEnabled() {
    return !!(this.ctrlRegister & RXE);
  }
  get fifosEnabled() {
    return !!(this.lineCtrlRegister & FEN);
  }
  /**
   * Number of bits per UART character
   */
  get wordLength() {
    switch (this.lineCtrlRegister >>> 5 & 3) {
      case 0:
        return 5;
      case 1:
        return 6;
      case 2:
        return 7;
      case 3:
        return 8;
    }
  }
  get flags() {
    return (this.rxFIFO.full ? RXFF : 0) | (this.rxFIFO.empty ? RXFE : 0) | TXFE;
  }
  checkInterrupts() {
    this.rp2040.setInterrupt(this.irq, !!(this.interruptStatus & this.interruptMask));
  }
  feedByte(value) {
    this.rxFIFO.push(value);
    this.interruptStatus |= UARTRXINTR;
    this.checkInterrupts();
  }
  readUint32(offset) {
    switch (offset) {
      case UARTDR: {
        const value = this.rxFIFO.pull();
        if (!this.rxFIFO.empty) {
          this.interruptStatus |= UARTRXINTR;
          this.checkInterrupts();
        }
        return value;
      }
      case UARTFR:
        return this.flags;
      case UARTLCR_H:
        return this.lineCtrlRegister;
      case UARTCR:
        return this.ctrlRegister;
      case UARTIMSC:
        return this.interruptMask;
      case UARTIRIS:
        return this.interruptStatus;
      case UARTIMIS:
        return this.interruptStatus & this.interruptMask;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    var _a;
    switch (offset) {
      case UARTDR:
        (_a = this.onByte) === null || _a === void 0 ? void 0 : _a.call(this, value & 255);
        break;
      case UARTLCR_H:
        this.lineCtrlRegister = value;
        break;
      case UARTCR:
        this.ctrlRegister = value;
        break;
      case UARTIMSC:
        this.interruptMask = value & 2047;
        this.checkInterrupts();
        break;
      case UARTICR:
        this.interruptStatus &= ~this.rawWriteValue;
        this.checkInterrupts();
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/peripherals/usb.js
var EP1_IN_CONTROL = 8;
var EP0_IN_BUFFER_CONTROL = 128;
var EP0_OUT_BUFFER_CONTROL = 132;
var EP15_OUT_BUFFER_CONTROL = 252;
var USB_BUF_CTRL_AVAILABLE = 1 << 10;
var USB_BUF_CTRL_FULL = 1 << 15;
var USB_BUF_CTRL_LEN_MASK = 1023;
var MAIN_CTRL = 64;
var SIE_STATUS = 80;
var BUFF_STATUS = 88;
var BUFF_CPU_SHOULD_HANDLE = 92;
var USB_MUXING = 116;
var INTR6 = 140;
var INTE4 = 144;
var INTF4 = 148;
var INTS4 = 152;
var SIM_TIMING = 1 << 31;
var HOST_NDEVICE = 1 << 1;
var CONTROLLER_EN = 1 << 0;
var SIE_DATA_SEQ_ERROR = 1 << 31;
var SIE_ACK_REC = 1 << 30;
var SIE_STALL_REC = 1 << 29;
var SIE_NAK_REC = 1 << 28;
var SIE_RX_TIMEOUT = 1 << 27;
var SIE_RX_OVERFLOW = 1 << 26;
var SIE_BIT_STUFF_ERROR = 1 << 25;
var SIE_CRC_ERROR = 1 << 24;
var SIE_BUS_RESET = 1 << 19;
var SIE_TRANS_COMPLETE = 1 << 18;
var SIE_SETUP_REC = 1 << 17;
var SIE_CONNECTED = 1 << 16;
var SIE_RESUME = 1 << 11;
var SIE_VBUS_OVER_CURR = 1 << 10;
var SIE_SPEED = 1 << 9;
var SIE_SUSPENDED = 1 << 4;
var SIE_LINE_STATE_MASK = 3;
var SIE_LINE_STATE_SHIFT = 2;
var SIE_VBUS_DETECTED = 1 << 0;
var SOFTCON = 1 << 3;
var TO_DIGITAL_PAD = 1 << 2;
var TO_EXTPHY = 1 << 1;
var TO_PHY = 1 << 0;
var INTR_BUFF_STATUS = 1 << 4;
var SIELineState;
(function(SIELineState2) {
  SIELineState2[SIELineState2["SE0"] = 0] = "SE0";
  SIELineState2[SIELineState2["J"] = 1] = "J";
  SIELineState2[SIELineState2["K"] = 2] = "K";
  SIELineState2[SIELineState2["SE1"] = 3] = "SE1";
})(SIELineState || (SIELineState = {}));
var SIE_WRITECLEAR_MASK = SIE_DATA_SEQ_ERROR | SIE_ACK_REC | SIE_STALL_REC | SIE_NAK_REC | SIE_RX_TIMEOUT | SIE_RX_OVERFLOW | SIE_BIT_STUFF_ERROR | SIE_CONNECTED | SIE_CRC_ERROR | SIE_BUS_RESET | SIE_TRANS_COMPLETE | SIE_SETUP_REC | SIE_RESUME;
var RPUSBController = class extends BasePeripheral {
  constructor() {
    super(...arguments);
    this.mainCtrl = 0;
    this.intRaw = 0;
    this.intEnable = 0;
    this.intForce = 0;
    this.sieStatus = 0;
    this.buffStatus = 0;
    this.readDelayMicroseconds = 1;
    this.writeDelayMicroseconds = 1;
  }
  get intStatus() {
    return this.intRaw & this.intEnable | this.intForce;
  }
  readUint32(offset) {
    switch (offset) {
      case MAIN_CTRL:
        return this.mainCtrl;
      case SIE_STATUS:
        return this.sieStatus;
      case BUFF_STATUS:
        return this.buffStatus;
      case BUFF_CPU_SHOULD_HANDLE:
        return 0;
      case INTR6:
        return this.intRaw;
      case INTE4:
        return this.intEnable;
      case INTF4:
        return this.intForce;
      case INTS4:
        return this.intStatus;
    }
    return super.readUint32(offset);
  }
  writeUint32(offset, value) {
    var _a, _b;
    switch (offset) {
      case MAIN_CTRL:
        this.mainCtrl = value & (SIM_TIMING | CONTROLLER_EN | HOST_NDEVICE);
        if (value & CONTROLLER_EN && !(value & HOST_NDEVICE)) {
          (_a = this.onUSBEnabled) === null || _a === void 0 ? void 0 : _a.call(this);
        }
        break;
      case BUFF_STATUS:
        this.buffStatus &= ~this.rawWriteValue;
        this.buffStatusUpdated();
        break;
      case USB_MUXING:
        if (value & TO_DIGITAL_PAD && !(value & TO_PHY)) {
          this.sieStatus |= SIE_CONNECTED;
        }
        break;
      case SIE_STATUS:
        this.sieStatus &= ~(this.rawWriteValue & SIE_WRITECLEAR_MASK);
        if (this.rawWriteValue & SIE_BUS_RESET) {
          (_b = this.onResetReceived) === null || _b === void 0 ? void 0 : _b.call(this);
          this.sieStatus &= ~(SIE_LINE_STATE_MASK << SIE_LINE_STATE_SHIFT);
          this.sieStatus |= SIELineState.J << SIE_LINE_STATE_SHIFT | SIE_CONNECTED;
        }
        this.sieStatusUpdated();
        break;
      case INTE4:
        this.intEnable = value & 1048575;
        this.checkInterrupts();
        break;
      case INTF4:
        this.intForce = value & 1048575;
        this.checkInterrupts();
        break;
      default:
        super.writeUint32(offset, value);
    }
  }
  readEndpointControlReg(endpoint, out) {
    const controlRegOffset = EP1_IN_CONTROL + 8 * (endpoint - 1) + (out ? 4 : 0);
    return this.rp2040.usbDPRAMView.getUint32(controlRegOffset, true);
  }
  getEndpointBufferOffset(endpoint, out) {
    if (endpoint === 0) {
      return 256;
    }
    return this.readEndpointControlReg(endpoint, out) & 65472;
  }
  DPRAMUpdated(offset, value) {
    var _a, _b;
    if (value & USB_BUF_CTRL_AVAILABLE && offset >= EP0_IN_BUFFER_CONTROL && offset <= EP15_OUT_BUFFER_CONTROL) {
      const endpoint = offset - EP0_IN_BUFFER_CONTROL >> 3;
      const bufferOut = offset & 4 ? true : false;
      const bufferLength = value & USB_BUF_CTRL_LEN_MASK;
      const bufferOffset = this.getEndpointBufferOffset(endpoint, bufferOut);
      this.debug(`Start USB transfer, endPoint=${endpoint}, direction=${bufferOut ? "out" : "in"} buffer=${bufferOffset.toString(16)} length=${bufferLength}`);
      value &= ~USB_BUF_CTRL_AVAILABLE;
      this.rp2040.usbDPRAMView.setUint32(offset, value, true);
      if (bufferOut) {
        (_a = this.onEndpointRead) === null || _a === void 0 ? void 0 : _a.call(this, endpoint, bufferLength);
      } else {
        value &= ~USB_BUF_CTRL_FULL;
        this.rp2040.usbDPRAMView.setUint32(offset, value, true);
        const buffer = this.rp2040.usbDPRAM.slice(bufferOffset, bufferOffset + bufferLength);
        this.indicateBufferReady(endpoint, false);
        if (this.writeDelayMicroseconds) {
          this.rp2040.clock.createTimer(this.writeDelayMicroseconds, () => {
            var _a2;
            (_a2 = this.onEndpointWrite) === null || _a2 === void 0 ? void 0 : _a2.call(this, endpoint, buffer);
          });
        } else {
          (_b = this.onEndpointWrite) === null || _b === void 0 ? void 0 : _b.call(this, endpoint, buffer);
        }
      }
    }
  }
  endpointReadDone(endpoint, buffer, delay = this.readDelayMicroseconds) {
    if (delay) {
      this.rp2040.clock.createTimer(delay, () => {
        this.finishRead(endpoint, buffer);
      });
    } else {
      this.finishRead(endpoint, buffer);
    }
  }
  finishRead(endpoint, buffer) {
    const bufferOffset = this.getEndpointBufferOffset(endpoint, true);
    const bufControlReg = EP0_OUT_BUFFER_CONTROL + endpoint * 8;
    let bufControl = this.rp2040.usbDPRAMView.getUint32(bufControlReg, true);
    const requestedLength = bufControl & USB_BUF_CTRL_LEN_MASK;
    const newLength = Math.min(buffer.length, requestedLength);
    bufControl |= USB_BUF_CTRL_FULL;
    bufControl = bufControl & ~USB_BUF_CTRL_LEN_MASK | newLength & USB_BUF_CTRL_LEN_MASK;
    this.rp2040.usbDPRAMView.setUint32(bufControlReg, bufControl, true);
    this.rp2040.usbDPRAM.set(buffer.subarray(0, newLength), bufferOffset);
    this.indicateBufferReady(endpoint, true);
  }
  checkInterrupts() {
    const { intStatus } = this;
    this.rp2040.setInterrupt(IRQ.USBCTRL, !!intStatus);
  }
  resetDevice() {
    this.sieStatus |= SIE_BUS_RESET;
    this.sieStatusUpdated();
  }
  sendSetupPacket(setupPacket) {
    this.rp2040.usbDPRAM.set(setupPacket);
    this.sieStatus |= SIE_SETUP_REC;
    this.sieStatusUpdated();
  }
  indicateBufferReady(endpoint, out) {
    this.buffStatus |= 1 << endpoint * 2 + (out ? 1 : 0);
    this.buffStatusUpdated();
  }
  buffStatusUpdated() {
    if (this.buffStatus) {
      this.intRaw |= INTR_BUFF_STATUS;
    } else {
      this.intRaw &= ~INTR_BUFF_STATUS;
    }
    this.checkInterrupts();
  }
  sieStatusUpdated() {
    const intRegisterMap = [
      [SIE_SETUP_REC, 1 << 16],
      [SIE_RESUME, 1 << 15],
      [SIE_SUSPENDED, 1 << 14],
      [SIE_CONNECTED, 1 << 13],
      [SIE_BUS_RESET, 1 << 12],
      [SIE_VBUS_DETECTED, 1 << 11],
      [SIE_STALL_REC, 1 << 10],
      [SIE_CRC_ERROR, 1 << 9],
      [SIE_BIT_STUFF_ERROR, 1 << 8],
      [SIE_RX_OVERFLOW, 1 << 7],
      [SIE_RX_TIMEOUT, 1 << 6],
      [SIE_DATA_SEQ_ERROR, 1 << 5]
    ];
    for (const [sieBit, intRawBit] of intRegisterMap) {
      if (this.sieStatus & sieBit) {
        this.intRaw |= intRawBit;
      } else {
        this.intRaw &= ~intRawBit;
      }
    }
    this.checkInterrupts();
  }
};

// ../node_modules/rp2040js/dist/esm/sio.js
var CPUID2 = 0;
var GPIO_IN = 4;
var GPIO_HI_IN = 8;
var GPIO_OUT = 16;
var GPIO_OUT_SET = 20;
var GPIO_OUT_CLR = 24;
var GPIO_OUT_XOR = 28;
var GPIO_OE = 32;
var GPIO_OE_SET = 36;
var GPIO_OE_CLR = 40;
var GPIO_OE_XOR = 44;
var GPIO_HI_OUT = 48;
var GPIO_HI_OUT_SET = 52;
var GPIO_HI_OUT_CLR = 56;
var GPIO_HI_OUT_XOR = 60;
var GPIO_HI_OE = 64;
var GPIO_HI_OE_SET = 68;
var GPIO_HI_OE_CLR = 72;
var GPIO_HI_OE_XOR = 76;
var GPIO_MASK = 1073741823;
var DIV_UDIVIDEND = 96;
var DIV_UDIVISOR = 100;
var DIV_SDIVIDEND = 104;
var DIV_SDIVISOR = 108;
var DIV_QUOTIENT = 112;
var DIV_REMAINDER = 116;
var DIV_CSR = 120;
var SPINLOCK_ST = 92;
var SPINLOCK0 = 256;
var SPINLOCK31 = 380;
var RPSIO = class {
  constructor(rp2040) {
    this.rp2040 = rp2040;
    this.gpioValue = 0;
    this.gpioOutputEnable = 0;
    this.qspiGpioValue = 0;
    this.qspiGpioOutputEnable = 0;
    this.divDividend = 0;
    this.divDivisor = 1;
    this.divQuotient = 0;
    this.divRemainder = 0;
    this.divCSR = 0;
    this.spinLock = 0;
  }
  updateHardwareDivider(signed) {
    if (this.divDivisor == 0) {
      this.divQuotient = this.divDividend > 0 ? -1 : 1;
      this.divRemainder = this.divDividend;
    } else {
      if (signed) {
        this.divQuotient = (this.divDividend | 0) / (this.divDivisor | 0);
        this.divRemainder = (this.divDividend | 0) % (this.divDivisor | 0);
      } else {
        this.divQuotient = (this.divDividend >>> 0) / (this.divDivisor >>> 0);
        this.divRemainder = (this.divDividend >>> 0) % (this.divDivisor >>> 0);
      }
    }
    this.divCSR = 3;
    this.rp2040.core.cycles += 8;
  }
  readUint32(offset) {
    if (offset >= SPINLOCK0 && offset <= SPINLOCK31) {
      const bitIndexMask = 1 << (offset - SPINLOCK0) / 4;
      if (this.spinLock & bitIndexMask) {
        return 0;
      } else {
        this.spinLock |= bitIndexMask;
        return bitIndexMask;
      }
    }
    switch (offset) {
      case GPIO_IN:
        return this.rp2040.gpioValues;
      case GPIO_HI_IN: {
        const { qspi } = this.rp2040;
        let result = 0;
        for (let qspiIndex = 0; qspiIndex < qspi.length; qspiIndex++) {
          if (qspi[qspiIndex].inputValue) {
            result |= 1 << qspiIndex;
          }
        }
        return result;
      }
      case GPIO_OUT:
        return this.gpioValue;
      case GPIO_OE:
        return this.gpioOutputEnable;
      case GPIO_HI_OUT:
        return this.qspiGpioValue;
      case GPIO_HI_OE:
        return this.qspiGpioOutputEnable;
      case GPIO_OUT_SET:
      case GPIO_OUT_CLR:
      case GPIO_OUT_XOR:
      case GPIO_OE_SET:
      case GPIO_OE_CLR:
      case GPIO_OE_XOR:
      case GPIO_HI_OUT_SET:
      case GPIO_HI_OUT_CLR:
      case GPIO_HI_OUT_XOR:
      case GPIO_HI_OE_SET:
      case GPIO_HI_OE_CLR:
      case GPIO_HI_OE_XOR:
        return 0;
      // TODO verify with silicone
      case CPUID2:
        return 0;
      case SPINLOCK_ST:
        return this.spinLock;
      case DIV_UDIVIDEND:
        return this.divDividend;
      case DIV_SDIVIDEND:
        return this.divDividend;
      case DIV_UDIVISOR:
        return this.divDivisor;
      case DIV_SDIVISOR:
        return this.divDivisor;
      case DIV_QUOTIENT:
        this.divCSR &= ~2;
        return this.divQuotient;
      case DIV_REMAINDER:
        return this.divRemainder;
      case DIV_CSR:
        return this.divCSR;
    }
    console.warn(`Read from invalid SIO address: ${offset.toString(16)}`);
    return 4294967295;
  }
  writeUint32(offset, value) {
    if (offset >= SPINLOCK0 && offset <= SPINLOCK31) {
      const bitIndexMask = ~(1 << (offset - SPINLOCK0) / 4);
      this.spinLock &= bitIndexMask;
      return;
    }
    const prevGpioValue = this.gpioValue;
    const prevGpioOutputEnable = this.gpioOutputEnable;
    switch (offset) {
      case GPIO_OUT:
        this.gpioValue = value & GPIO_MASK;
        break;
      case GPIO_OUT_SET:
        this.gpioValue |= value & GPIO_MASK;
        break;
      case GPIO_OUT_CLR:
        this.gpioValue &= ~value;
        break;
      case GPIO_OUT_XOR:
        this.gpioValue ^= value & GPIO_MASK;
        break;
      case GPIO_OE:
        this.gpioOutputEnable = value & GPIO_MASK;
        break;
      case GPIO_OE_SET:
        this.gpioOutputEnable |= value & GPIO_MASK;
        break;
      case GPIO_OE_CLR:
        this.gpioOutputEnable &= ~value;
        break;
      case GPIO_OE_XOR:
        this.gpioOutputEnable ^= value & GPIO_MASK;
        break;
      case GPIO_HI_OUT:
        this.qspiGpioValue = value & GPIO_MASK;
        break;
      case GPIO_HI_OUT_SET:
        this.qspiGpioValue |= value & GPIO_MASK;
        break;
      case GPIO_HI_OUT_CLR:
        this.qspiGpioValue &= ~value;
        break;
      case GPIO_HI_OUT_XOR:
        this.qspiGpioValue ^= value & GPIO_MASK;
        break;
      case GPIO_HI_OE:
        this.qspiGpioOutputEnable = value & GPIO_MASK;
        break;
      case GPIO_HI_OE_SET:
        this.qspiGpioOutputEnable |= value & GPIO_MASK;
        break;
      case GPIO_HI_OE_CLR:
        this.qspiGpioOutputEnable &= ~value;
        break;
      case GPIO_HI_OE_XOR:
        this.qspiGpioOutputEnable ^= value & GPIO_MASK;
        break;
      case DIV_UDIVIDEND:
        this.divDividend = value;
        this.updateHardwareDivider(false);
        break;
      case DIV_SDIVIDEND:
        this.divDividend = value;
        this.updateHardwareDivider(true);
        break;
      case DIV_UDIVISOR:
        this.divDivisor = value;
        this.updateHardwareDivider(false);
        break;
      case DIV_SDIVISOR:
        this.divDivisor = value;
        this.updateHardwareDivider(true);
        break;
      case DIV_QUOTIENT:
        this.divQuotient = value;
        this.divCSR = 3;
        break;
      case DIV_REMAINDER:
        this.divRemainder = value;
        this.divCSR = 3;
        break;
      default:
        console.warn(`Write to invalid SIO address: ${offset.toString(16)}, value=${value.toString(16)}`);
    }
    const pinsToUpdate = this.gpioValue ^ prevGpioValue | this.gpioOutputEnable ^ prevGpioOutputEnable;
    if (pinsToUpdate) {
      const { gpio } = this.rp2040;
      for (let gpioIndex = 0; gpioIndex < gpio.length; gpioIndex++) {
        if (pinsToUpdate & 1 << gpioIndex) {
          gpio[gpioIndex].checkForUpdates();
        }
      }
    }
  }
};

// ../node_modules/rp2040js/dist/esm/utils/logging.js
var LogLevel;
(function(LogLevel2) {
  LogLevel2[LogLevel2["Debug"] = 0] = "Debug";
  LogLevel2[LogLevel2["Info"] = 1] = "Info";
  LogLevel2[LogLevel2["Warn"] = 2] = "Warn";
  LogLevel2[LogLevel2["Error"] = 3] = "Error";
})(LogLevel || (LogLevel = {}));
var ConsoleLogger = class {
  constructor(currentLogLevel, throwOnError = true) {
    this.currentLogLevel = currentLogLevel;
    this.throwOnError = throwOnError;
  }
  aboveLogLevel(logLevel) {
    return logLevel >= this.currentLogLevel ? true : false;
  }
  formatMessage(componentName, message) {
    const currentTime = formatTime(/* @__PURE__ */ new Date());
    return `${currentTime} [${componentName}] ${message}`;
  }
  debug(componetName, message) {
    if (this.aboveLogLevel(LogLevel.Debug)) {
      console.debug(this.formatMessage(componetName, message));
    }
  }
  warn(componetName, message) {
    if (this.aboveLogLevel(LogLevel.Warn)) {
      console.warn(this.formatMessage(componetName, message));
    }
  }
  error(componentName, message) {
    if (this.aboveLogLevel(LogLevel.Error)) {
      console.error(this.formatMessage(componentName, message));
      if (this.throwOnError) {
        throw new Error(`[${componentName}] ${message}`);
      }
    }
  }
  info(componentName, message) {
    if (this.aboveLogLevel(LogLevel.Info)) {
      console.info(this.formatMessage(componentName, message));
    }
  }
};

// ../node_modules/rp2040js/dist/esm/rp2040.js
var FLASH_START_ADDRESS = 268435456;
var FLASH_END_ADDRESS = 335544320;
var RAM_START_ADDRESS = 536870912;
var DPRAM_START_ADDRESS = 1343225856;
var SIO_START_ADDRESS = 3489660928;
var LOG_NAME = "RP2040";
var KB = 1024;
var MB = 1024 * KB;
var MHz = 1e6;
var RP2040 = class {
  constructor(clock = new RealtimeClock()) {
    this.clock = clock;
    this.bootrom = new Uint32Array(4 * KB);
    this.sram = new Uint8Array(264 * KB);
    this.sramView = new DataView(this.sram.buffer);
    this.flash = new Uint8Array(16 * MB);
    this.flash16 = new Uint16Array(this.flash.buffer);
    this.flashView = new DataView(this.flash.buffer);
    this.usbDPRAM = new Uint8Array(4 * KB);
    this.usbDPRAMView = new DataView(this.usbDPRAM.buffer);
    this.core = new CortexM0Core(this);
    this.clkSys = 125 * MHz;
    this.clkPeri = 125 * MHz;
    this.ppb = new RPPPB(this, "PPB");
    this.sio = new RPSIO(this);
    this.uart = [new RPUART(this, "UART0", IRQ.UART0), new RPUART(this, "UART1", IRQ.UART1)];
    this.i2c = [new RPI2C(this, "I2C0", IRQ.I2C0), new RPI2C(this, "I2C1", IRQ.I2C1)];
    this.spi = [new RPSPI(this, "SPI0", IRQ.SPI0), new RPSPI(this, "SPI1", IRQ.SPI1)];
    this.pwm = new RPPWM(this, "PWM_BASE");
    this.adc = new RPADC(this, "ADC");
    this.gpio = [
      new GPIOPin(this, 0),
      new GPIOPin(this, 1),
      new GPIOPin(this, 2),
      new GPIOPin(this, 3),
      new GPIOPin(this, 4),
      new GPIOPin(this, 5),
      new GPIOPin(this, 6),
      new GPIOPin(this, 7),
      new GPIOPin(this, 8),
      new GPIOPin(this, 9),
      new GPIOPin(this, 10),
      new GPIOPin(this, 11),
      new GPIOPin(this, 12),
      new GPIOPin(this, 13),
      new GPIOPin(this, 14),
      new GPIOPin(this, 15),
      new GPIOPin(this, 16),
      new GPIOPin(this, 17),
      new GPIOPin(this, 18),
      new GPIOPin(this, 19),
      new GPIOPin(this, 20),
      new GPIOPin(this, 21),
      new GPIOPin(this, 22),
      new GPIOPin(this, 23),
      new GPIOPin(this, 24),
      new GPIOPin(this, 25),
      new GPIOPin(this, 26),
      new GPIOPin(this, 27),
      new GPIOPin(this, 28),
      new GPIOPin(this, 29)
    ];
    this.qspi = [
      new GPIOPin(this, 0, "SCLK"),
      new GPIOPin(this, 1, "SS"),
      new GPIOPin(this, 2, "SD0"),
      new GPIOPin(this, 3, "SD1"),
      new GPIOPin(this, 4, "SD2"),
      new GPIOPin(this, 5, "SD3")
    ];
    this.dma = new RPDMA(this, "DMA");
    this.pio = [
      new RPPIO(this, "PIO0", IRQ.PIO0_IRQ0, 0),
      new RPPIO(this, "PIO1", IRQ.PIO1_IRQ0, 1)
    ];
    this.usbCtrl = new RPUSBController(this, "USB");
    this.stopped = true;
    this.logger = new ConsoleLogger(LogLevel.Debug, true);
    this.executeTimer = null;
    this.peripherals = {
      98304: new RPSSI(this, "SSI"),
      262144: new UnimplementedPeripheral(this, "SYSINFO_BASE"),
      262148: new RP2040SysCfg(this, "SYSCFG"),
      262152: new RPClocks(this, "CLOCKS_BASE"),
      262156: new RPReset(this, "RESETS_BASE"),
      262160: new UnimplementedPeripheral(this, "PSM_BASE"),
      262164: new RPIO(this, "IO_BANK0_BASE"),
      262168: new UnimplementedPeripheral(this, "IO_QSPI_BASE"),
      262172: new RPPADS(this, "PADS_BANK0_BASE", "bank0"),
      262176: new RPPADS(this, "PADS_QSPI_BASE", "qspi"),
      262180: new UnimplementedPeripheral(this, "XOSC_BASE"),
      262184: new UnimplementedPeripheral(this, "PLL_SYS_BASE"),
      262188: new UnimplementedPeripheral(this, "PLL_USB_BASE"),
      262192: new UnimplementedPeripheral(this, "BUSCTRL_BASE"),
      262196: this.uart[0],
      262200: this.uart[1],
      262204: this.spi[0],
      262208: this.spi[1],
      262212: this.i2c[0],
      262216: this.i2c[1],
      262220: this.adc,
      262224: this.pwm,
      262228: new RPTimer(this, "TIMER_BASE"),
      262232: new UnimplementedPeripheral(this, "WATCHDOG_BASE"),
      262236: new RP2040RTC(this, "RTC_BASE"),
      262240: new UnimplementedPeripheral(this, "ROSC_BASE"),
      262244: new UnimplementedPeripheral(this, "VREG_AND_CHIP_RESET_BASE"),
      262252: new UnimplementedPeripheral(this, "TBMAN_BASE"),
      327680: this.dma,
      327952: this.usbCtrl,
      328192: this.pio[0],
      328448: this.pio[1]
    };
    this.onBreak = (code) => {
      this.stopped = true;
    };
    this.reset();
  }
  loadBootrom(bootromData) {
    this.bootrom.set(bootromData);
    this.reset();
  }
  reset() {
    this.core.reset();
    this.pwm.reset();
    this.flash.fill(255);
  }
  readUint32(address) {
    address = address >>> 0;
    if (address & 3) {
      this.logger.error(LOG_NAME, `read from address ${address.toString(16)}, which is not 32 bit aligned`);
    }
    const { bootrom } = this;
    if (address < bootrom.length * 4) {
      return bootrom[address / 4];
    } else if (address >= FLASH_START_ADDRESS && address < FLASH_END_ADDRESS) {
      return this.flashView.getUint32(address - FLASH_START_ADDRESS, true);
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      return this.sramView.getUint32(address - RAM_START_ADDRESS, true);
    } else if (address >= DPRAM_START_ADDRESS && address < DPRAM_START_ADDRESS + this.usbDPRAM.length) {
      return this.usbDPRAMView.getUint32(address - DPRAM_START_ADDRESS, true);
    } else if (address >>> 12 === 917518) {
      return this.ppb.readUint32(address & 4095);
    } else if (address >= SIO_START_ADDRESS && address < SIO_START_ADDRESS + 268435456) {
      return this.sio.readUint32(address - SIO_START_ADDRESS);
    }
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      return peripheral.readUint32(address & 16383);
    }
    this.logger.warn(LOG_NAME, `Read from invalid memory address: ${address.toString(16)}`);
    return 4294967295;
  }
  findPeripheral(address) {
    return this.peripherals[address >>> 14 << 2];
  }
  /** We assume the address is 16-bit aligned */
  readUint16(address) {
    if (address >= FLASH_START_ADDRESS && address < FLASH_END_ADDRESS) {
      return this.flashView.getUint16(address - FLASH_START_ADDRESS, true);
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      return this.sramView.getUint16(address - RAM_START_ADDRESS, true);
    }
    const value = this.readUint32(address & 4294967292);
    return address & 2 ? (value & 4294901760) >>> 16 : value & 65535;
  }
  readUint8(address) {
    if (address >= FLASH_START_ADDRESS && address < FLASH_END_ADDRESS) {
      return this.flash[address - FLASH_START_ADDRESS];
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      return this.sram[address - RAM_START_ADDRESS];
    }
    const value = this.readUint16(address & 4294967294);
    return (address & 1 ? (value & 65280) >>> 8 : value & 255) >>> 0;
  }
  writeUint32(address, value) {
    address = address >>> 0;
    const { bootrom } = this;
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      const atomicType = (address & 12288) >> 12;
      const offset = address & 4095;
      peripheral.writeUint32Atomic(offset, value, atomicType);
    } else if (address < bootrom.length * 4) {
      bootrom[address / 4] = value;
    } else if (address >= FLASH_START_ADDRESS && address < FLASH_END_ADDRESS) {
      this.flashView.setUint32(address - FLASH_START_ADDRESS, value, true);
    } else if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      this.sramView.setUint32(address - RAM_START_ADDRESS, value, true);
    } else if (address >= DPRAM_START_ADDRESS && address < DPRAM_START_ADDRESS + this.usbDPRAM.length) {
      const offset = address - DPRAM_START_ADDRESS;
      this.usbDPRAMView.setUint32(offset, value, true);
      this.usbCtrl.DPRAMUpdated(offset, value);
    } else if (address >= SIO_START_ADDRESS && address < SIO_START_ADDRESS + 268435456) {
      this.sio.writeUint32(address - SIO_START_ADDRESS, value);
    } else if (address >>> 12 === 917518) {
      this.ppb.writeUint32(address & 4095, value);
    } else {
      this.logger.warn(LOG_NAME, `Write to undefined address: ${address.toString(16)}`);
    }
  }
  writeUint8(address, value) {
    if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      this.sram[address - RAM_START_ADDRESS] = value;
      return;
    }
    const alignedAddress = (address & 4294967292) >>> 0;
    const offset = address & 3;
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      const atomicType = (alignedAddress & 12288) >> 12;
      const offset2 = alignedAddress & 4095;
      peripheral.writeUint32Atomic(offset2, value & 255 | (value & 255) << 8 | (value & 255) << 16 | (value & 255) << 24, atomicType);
      return;
    }
    const originalValue = this.readUint32(alignedAddress);
    const newValue = new Uint32Array([originalValue]);
    new DataView(newValue.buffer).setUint8(offset, value);
    this.writeUint32(alignedAddress, newValue[0]);
  }
  writeUint16(address, value) {
    if (address >= RAM_START_ADDRESS && address < RAM_START_ADDRESS + this.sram.length) {
      this.sramView.setUint16(address - RAM_START_ADDRESS, value, true);
      return;
    }
    const alignedAddress = (address & 4294967292) >>> 0;
    const offset = address & 3;
    const peripheral = this.findPeripheral(address);
    if (peripheral) {
      const atomicType = (alignedAddress & 12288) >> 12;
      const offset2 = alignedAddress & 4095;
      peripheral.writeUint32Atomic(offset2, value & 65535 | (value & 65535) << 16, atomicType);
      return;
    }
    const originalValue = this.readUint32(alignedAddress);
    const newValue = new Uint32Array([originalValue]);
    new DataView(newValue.buffer).setUint16(offset, value, true);
    this.writeUint32(alignedAddress, newValue[0]);
  }
  get gpioValues() {
    const { gpio } = this;
    let result = 0;
    for (let gpioIndex = 0; gpioIndex < gpio.length; gpioIndex++) {
      if (gpio[gpioIndex].inputValue) {
        result |= 1 << gpioIndex;
      }
    }
    return result;
  }
  setInterrupt(irq, value) {
    this.core.setInterrupt(irq, value);
  }
  updateIOInterrupt() {
    let interruptValue = false;
    for (const pin of this.gpio) {
      if (pin.irqValue) {
        interruptValue = true;
      }
    }
    this.setInterrupt(IRQ.IO_BANK0, interruptValue);
  }
  step() {
    this.core.executeInstruction();
  }
  execute() {
    this.clock.resume();
    this.executeTimer = null;
    this.stopped = false;
    for (let i = 0; i < 1e5 && !this.stopped && !this.core.waiting; i++) {
      this.core.executeInstruction();
    }
    if (!this.stopped) {
      this.executeTimer = setTimeout(() => this.execute(), 0);
    }
  }
  stop() {
    this.stopped = true;
    if (this.executeTimer != null) {
      clearTimeout(this.executeTimer);
      this.executeTimer = null;
    }
    this.clock.pause();
  }
  get executing() {
    return !this.stopped;
  }
};

// ../node_modules/rp2040js/dist/esm/cortex-m0-core.js
var EXC_RESET = 1;
var EXC_NMI = 2;
var EXC_HARDFAULT = 3;
var EXC_SVCALL = 11;
var EXC_PENDSV = 14;
var EXC_SYSTICK = 15;
var SYSM_APSR = 0;
var SYSM_XPSR = 3;
var SYSM_IPSR = 5;
var SYSM_MSP = 8;
var SYSM_PSP = 9;
var SYSM_PRIMASK = 16;
var SYSM_CONTROL = 20;
var LOWEST_PRIORITY = 4;
var ExecutionMode;
(function(ExecutionMode2) {
  ExecutionMode2[ExecutionMode2["Mode_Thread"] = 0] = "Mode_Thread";
  ExecutionMode2[ExecutionMode2["Mode_Handler"] = 1] = "Mode_Handler";
})(ExecutionMode || (ExecutionMode = {}));
function signExtend8(value) {
  return value << 24 >> 24;
}
function signExtend16(value) {
  return value << 16 >> 16;
}
var spRegister = 13;
var pcRegister = 15;
var StackPointerBank;
(function(StackPointerBank2) {
  StackPointerBank2[StackPointerBank2["SPmain"] = 0] = "SPmain";
  StackPointerBank2[StackPointerBank2["SPprocess"] = 1] = "SPprocess";
})(StackPointerBank || (StackPointerBank = {}));
var LOG_NAME2 = "CortexM0Core";
var CortexM0Core = class {
  constructor(rp2040) {
    this.rp2040 = rp2040;
    this.registers = new Uint32Array(16);
    this.bankedSP = 0;
    this.cycles = 0;
    this.eventRegistered = false;
    this.waiting = false;
    this.N = false;
    this.C = false;
    this.Z = false;
    this.V = false;
    this.breakRewind = 0;
    this.PM = false;
    this.SPSEL = StackPointerBank.SPmain;
    this.nPRIV = false;
    this.currentMode = ExecutionMode.Mode_Thread;
    this.IPSR = 0;
    this.interruptNMIMask = 0;
    this.pendingInterrupts = 0;
    this.enabledInterrupts = 0;
    this.interruptPriorities = [4294967295, 0, 0, 0];
    this.pendingNMI = false;
    this.pendingPendSV = false;
    this.pendingSVCall = false;
    this.pendingSystick = false;
    this.interruptsUpdated = false;
    this.VTOR = 0;
    this.SHPR2 = 0;
    this.SHPR3 = 0;
    this.SP = 4294967292;
    this.bankedSP = 4294967292;
  }
  get logger() {
    return this.rp2040.logger;
  }
  reset() {
    this.SP = this.rp2040.readUint32(this.VTOR);
    this.PC = this.rp2040.readUint32(this.VTOR + 4) & 4294967294;
    this.cycles = 0;
  }
  get SP() {
    return this.registers[13];
  }
  set SP(value) {
    this.registers[13] = value & ~3;
  }
  get LR() {
    return this.registers[14];
  }
  set LR(value) {
    this.registers[14] = value;
  }
  get PC() {
    return this.registers[15];
  }
  set PC(value) {
    this.registers[15] = value;
  }
  get APSR() {
    return (this.N ? 2147483648 : 0) | (this.Z ? 1073741824 : 0) | (this.C ? 536870912 : 0) | (this.V ? 268435456 : 0);
  }
  set APSR(value) {
    this.N = !!(value & 2147483648);
    this.Z = !!(value & 1073741824);
    this.C = !!(value & 536870912);
    this.V = !!(value & 268435456);
  }
  get xPSR() {
    return this.APSR | this.IPSR | 1 << 24;
  }
  set xPSR(value) {
    this.APSR = value;
    this.IPSR = value & 63;
  }
  checkCondition(cond) {
    let result = false;
    switch (cond >> 1) {
      case 0:
        result = this.Z;
        break;
      case 1:
        result = this.C;
        break;
      case 2:
        result = this.N;
        break;
      case 3:
        result = this.V;
        break;
      case 4:
        result = this.C && !this.Z;
        break;
      case 5:
        result = this.N === this.V;
        break;
      case 6:
        result = this.N === this.V && !this.Z;
        break;
      case 7:
        result = true;
        break;
    }
    return cond & 1 && cond != 15 ? !result : result;
  }
  readUint32(address) {
    return this.rp2040.readUint32(address);
  }
  readUint16(address) {
    return this.rp2040.readUint16(address);
  }
  readUint8(address) {
    return this.rp2040.readUint8(address);
  }
  writeUint32(address, value) {
    this.rp2040.writeUint32(address, value);
  }
  writeUint16(address, value) {
    this.rp2040.writeUint16(address, value);
  }
  writeUint8(address, value) {
    this.rp2040.writeUint8(address, value);
  }
  switchStack(stack) {
    if (this.SPSEL !== stack) {
      const temp = this.SP;
      this.SP = this.bankedSP;
      this.bankedSP = temp;
      this.SPSEL = stack;
    }
  }
  get SPprocess() {
    return this.SPSEL === StackPointerBank.SPprocess ? this.SP : this.bankedSP;
  }
  set SPprocess(value) {
    if (this.SPSEL === StackPointerBank.SPprocess) {
      this.SP = value;
    } else {
      this.bankedSP = value >>> 0;
    }
  }
  get SPmain() {
    return this.SPSEL === StackPointerBank.SPmain ? this.SP : this.bankedSP;
  }
  set SPmain(value) {
    if (this.SPSEL === StackPointerBank.SPmain) {
      this.SP = value;
    } else {
      this.bankedSP = value >>> 0;
    }
  }
  exceptionEntry(exceptionNumber) {
    let framePtr = 0;
    let framePtrAlign = 0;
    if (this.SPSEL && this.currentMode === ExecutionMode.Mode_Thread) {
      framePtrAlign = this.SPprocess & 4 ? 1 : 0;
      this.SPprocess = this.SPprocess - 32 & ~4;
      framePtr = this.SPprocess;
    } else {
      framePtrAlign = this.SPmain & 4 ? 1 : 0;
      this.SPmain = this.SPmain - 32 & ~4;
      framePtr = this.SPmain;
    }
    this.writeUint32(framePtr, this.registers[0]);
    this.writeUint32(framePtr + 4, this.registers[1]);
    this.writeUint32(framePtr + 8, this.registers[2]);
    this.writeUint32(framePtr + 12, this.registers[3]);
    this.writeUint32(framePtr + 16, this.registers[12]);
    this.writeUint32(framePtr + 20, this.LR);
    this.writeUint32(framePtr + 24, this.PC & ~1);
    this.writeUint32(framePtr + 28, this.xPSR & ~(1 << 9) | framePtrAlign << 9);
    if (this.currentMode == ExecutionMode.Mode_Handler) {
      this.LR = 4294967281;
    } else {
      if (!this.SPSEL) {
        this.LR = 4294967289;
      } else {
        this.LR = 4294967293;
      }
    }
    this.currentMode = ExecutionMode.Mode_Handler;
    this.IPSR = exceptionNumber;
    this.switchStack(StackPointerBank.SPmain);
    this.eventRegistered = true;
    const vectorTable = this.VTOR;
    this.PC = this.readUint32(vectorTable + 4 * exceptionNumber);
  }
  exceptionReturn(excReturn) {
    let framePtr = this.SPmain;
    switch (excReturn & 15) {
      case 1:
        this.currentMode = ExecutionMode.Mode_Handler;
        this.switchStack(StackPointerBank.SPmain);
        break;
      case 9:
        this.currentMode = ExecutionMode.Mode_Thread;
        this.switchStack(StackPointerBank.SPmain);
        break;
      case 13:
        framePtr = this.SPprocess;
        this.currentMode = ExecutionMode.Mode_Thread;
        this.switchStack(StackPointerBank.SPprocess);
        break;
    }
    this.registers[0] = this.readUint32(framePtr);
    this.registers[1] = this.readUint32(framePtr + 4);
    this.registers[2] = this.readUint32(framePtr + 8);
    this.registers[3] = this.readUint32(framePtr + 12);
    this.registers[12] = this.readUint32(framePtr + 16);
    this.LR = this.readUint32(framePtr + 20);
    this.PC = this.readUint32(framePtr + 24);
    const psr = this.readUint32(framePtr + 28);
    const framePtrAlign = psr & 1 << 9 ? 4 : 0;
    switch (excReturn & 15) {
      case 1:
        this.SPmain = this.SPmain + 32 | framePtrAlign;
        break;
      case 9:
        this.SPmain = this.SPmain + 32 | framePtrAlign;
        break;
      case 13:
        this.SPprocess = this.SPprocess + 32 | framePtrAlign;
        break;
    }
    this.APSR = psr & 4026531840;
    const forceThread = this.currentMode == ExecutionMode.Mode_Thread && this.nPRIV;
    this.IPSR = forceThread ? 0 : psr & 63;
    this.interruptsUpdated = true;
    this.eventRegistered = true;
  }
  get pendSVPriority() {
    return this.SHPR3 >> 22 & 3;
  }
  get svCallPriority() {
    return this.SHPR2 >>> 30;
  }
  get systickPriority() {
    return this.SHPR3 >>> 30;
  }
  exceptionPriority(n) {
    switch (n) {
      case EXC_RESET:
        return -3;
      case EXC_NMI:
        return -2;
      case EXC_HARDFAULT:
        return -1;
      case EXC_SVCALL:
        return this.svCallPriority;
      case EXC_PENDSV:
        return this.pendSVPriority;
      case EXC_SYSTICK:
        return this.systickPriority;
      default: {
        if (n < 16) {
          return LOWEST_PRIORITY;
        }
        const intNum = n - 16;
        for (let priority = 0; priority < 4; priority++) {
          if (this.interruptPriorities[priority] & 1 << intNum) {
            return priority;
          }
        }
        return LOWEST_PRIORITY;
      }
    }
  }
  get vectPending() {
    if (this.pendingNMI) {
      return EXC_NMI;
    }
    const { svCallPriority, systickPriority, pendSVPriority, pendingInterrupts } = this;
    for (let priority = 0; priority < LOWEST_PRIORITY; priority++) {
      const levelInterrupts = pendingInterrupts & this.interruptPriorities[priority];
      if (this.pendingSVCall && priority === svCallPriority) {
        return EXC_SVCALL;
      }
      if (this.pendingPendSV && priority === pendSVPriority) {
        return EXC_PENDSV;
      }
      if (this.pendingSystick && priority === systickPriority) {
        return EXC_SYSTICK;
      }
      if (levelInterrupts) {
        for (let interruptNumber = 0; interruptNumber < 32; interruptNumber++) {
          if (levelInterrupts & 1 << interruptNumber) {
            return 16 + interruptNumber;
          }
        }
      }
    }
    return 0;
  }
  setInterrupt(irq, value) {
    const irqBit = 1 << irq;
    if (value && !(this.pendingInterrupts & irqBit)) {
      this.pendingInterrupts |= irqBit;
      this.interruptsUpdated = true;
      if (this.waiting && this.checkForInterrupts()) {
        this.waiting = false;
      }
    } else if (!value) {
      this.pendingInterrupts &= ~irqBit;
    }
  }
  checkForInterrupts() {
    const currentPriority = this.waiting ? this.PM ? this.exceptionPriority(this.IPSR) : LOWEST_PRIORITY : Math.min(this.exceptionPriority(this.IPSR), this.PM ? 0 : LOWEST_PRIORITY);
    const interruptSet = this.pendingInterrupts & this.enabledInterrupts;
    const { svCallPriority, systickPriority, pendSVPriority } = this;
    if (this.pendingNMI) {
      this.pendingNMI = false;
      this.exceptionEntry(EXC_NMI);
      return true;
    }
    for (let priority = 0; priority < currentPriority; priority++) {
      const levelInterrupts = interruptSet & this.interruptPriorities[priority];
      if (this.pendingSVCall && priority === svCallPriority) {
        this.pendingSVCall = false;
        this.exceptionEntry(EXC_SVCALL);
        return true;
      }
      if (this.pendingPendSV && priority === pendSVPriority) {
        this.pendingPendSV = false;
        this.exceptionEntry(EXC_PENDSV);
        return true;
      }
      if (this.pendingSystick && priority === systickPriority) {
        this.pendingSystick = false;
        this.exceptionEntry(EXC_SYSTICK);
        return true;
      }
      if (levelInterrupts) {
        for (let interruptNumber = 0; interruptNumber < 32; interruptNumber++) {
          if (levelInterrupts & 1 << interruptNumber) {
            if (interruptNumber > MAX_HARDWARE_IRQ) {
              this.pendingInterrupts &= ~(1 << interruptNumber);
            }
            this.exceptionEntry(16 + interruptNumber);
            return true;
          }
        }
      }
    }
    this.interruptsUpdated = false;
    return false;
  }
  readSpecialRegister(sysm) {
    switch (sysm) {
      case SYSM_APSR:
        return this.APSR;
      case SYSM_XPSR:
        return this.xPSR;
      case SYSM_IPSR:
        return this.IPSR;
      case SYSM_PRIMASK:
        return this.PM ? 1 : 0;
      case SYSM_MSP:
        return this.SPmain;
      case SYSM_PSP:
        return this.SPprocess;
      case SYSM_CONTROL:
        return (this.SPSEL === StackPointerBank.SPprocess ? 2 : 0) | (this.nPRIV ? 1 : 0);
      default:
        this.logger.warn(LOG_NAME2, `MRS with unimplemented SYSm value: ${sysm}`);
        return 0;
    }
  }
  writeSpecialRegister(sysm, value) {
    switch (sysm) {
      case SYSM_APSR:
        this.APSR = value;
        break;
      case SYSM_XPSR:
        this.xPSR = value;
        break;
      case SYSM_IPSR:
        this.IPSR = value;
        break;
      case SYSM_PRIMASK:
        this.PM = !!(value & 1);
        this.interruptsUpdated = true;
        break;
      case SYSM_MSP:
        this.SPmain = value;
        break;
      case SYSM_PSP:
        this.SPprocess = value;
        break;
      case SYSM_CONTROL:
        this.nPRIV = !!(value & 1);
        if (this.currentMode === ExecutionMode.Mode_Thread) {
          this.switchStack(value & 2 ? StackPointerBank.SPprocess : StackPointerBank.SPmain);
        }
        break;
      default:
        this.logger.warn(LOG_NAME2, `MRS with unimplemented SYSm value: ${sysm}`);
        return 0;
    }
  }
  BXWritePC(address) {
    if (this.currentMode == ExecutionMode.Mode_Handler && address >>> 28 == 15) {
      this.exceptionReturn(address & 268435455);
    } else {
      this.PC = address & ~1;
    }
  }
  substractUpdateFlags(minuend, subtrahend) {
    const result = minuend - subtrahend;
    this.N = !!(result & 2147483648);
    this.Z = (result & 4294967295) === 0;
    this.C = minuend >= subtrahend;
    this.V = !!(result & 2147483648) && !(minuend & 2147483648) && !!(subtrahend & 2147483648) || !(result & 2147483648) && !!(minuend & 2147483648) && !(subtrahend & 2147483648);
    return result;
  }
  addUpdateFlags(addend1, addend2) {
    const unsignedSum = addend1 + addend2 >>> 0;
    const signedSum = (addend1 | 0) + (addend2 | 0);
    const result = addend1 + addend2;
    this.N = !!(result & 2147483648);
    this.Z = (result & 4294967295) === 0;
    this.C = result === unsignedSum ? false : true;
    this.V = (result | 0) === signedSum ? false : true;
    return result & 4294967295;
  }
  slowIO(addr) {
    addr = addr >>> 0;
    return addr < SIO_START_ADDRESS || addr > SIO_START_ADDRESS + 268435456;
  }
  executeInstruction() {
    if (this.interruptsUpdated) {
      if (this.checkForInterrupts()) {
        this.waiting = false;
      }
    }
    const opcodePC = this.PC & ~1;
    const opcode = this.readUint16(opcodePC);
    const wideInstruction = opcode >> 12 === 15 || opcode >> 11 === 29;
    const opcode2 = wideInstruction ? this.readUint16(opcodePC + 2) : 0;
    this.PC += 2;
    this.cycles++;
    if (opcode >> 6 === 261) {
      const Rm = opcode >> 3 & 7;
      const Rdn = opcode & 7;
      this.registers[Rdn] = this.addUpdateFlags(this.registers[Rm], this.registers[Rdn] + (this.C ? 1 : 0));
    } else if (opcode >> 11 === 21) {
      const imm8 = opcode & 255;
      const Rd = opcode >> 8 & 7;
      this.registers[Rd] = this.SP + (imm8 << 2);
    } else if (opcode >> 7 === 352) {
      const imm32 = (opcode & 127) << 2;
      this.SP += imm32;
    } else if (opcode >> 9 === 14) {
      const imm3 = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rd = opcode & 7;
      this.registers[Rd] = this.addUpdateFlags(this.registers[Rn], imm3);
    } else if (opcode >> 11 === 6) {
      const imm8 = opcode & 255;
      const Rdn = opcode >> 8 & 7;
      this.registers[Rdn] = this.addUpdateFlags(this.registers[Rdn], imm8);
    } else if (opcode >> 9 === 12) {
      const Rm = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rd = opcode & 7;
      this.registers[Rd] = this.addUpdateFlags(this.registers[Rn], this.registers[Rm]);
    } else if (opcode >> 8 === 68) {
      const Rm = opcode >> 3 & 15;
      const Rdn = (opcode & 128) >> 4 | opcode & 7;
      const leftValue = Rdn === pcRegister ? this.PC + 2 : this.registers[Rdn];
      const rightValue = this.registers[Rm];
      const result = leftValue + rightValue;
      if (Rdn !== spRegister && Rdn !== pcRegister) {
        this.registers[Rdn] = result;
      } else if (Rdn === pcRegister) {
        this.registers[Rdn] = result & ~1;
        this.cycles++;
      } else if (Rdn === spRegister) {
        this.registers[Rdn] = result & ~3;
      }
    } else if (opcode >> 11 === 20) {
      const imm8 = opcode & 255;
      const Rd = opcode >> 8 & 7;
      this.registers[Rd] = (opcodePC & 4294967292) + 4 + (imm8 << 2);
    } else if (opcode >> 6 === 256) {
      const Rm = opcode >> 3 & 7;
      const Rdn = opcode & 7;
      const result = this.registers[Rdn] & this.registers[Rm];
      this.registers[Rdn] = result;
      this.N = !!(result & 2147483648);
      this.Z = (result & 4294967295) === 0;
    } else if (opcode >> 11 === 2) {
      const imm5 = opcode >> 6 & 31;
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      const input = this.registers[Rm];
      const result = imm5 ? input >> imm5 : (input & 2147483648) >> 31;
      this.registers[Rd] = result;
      this.N = !!(result & 2147483648);
      this.Z = (result & 4294967295) === 0;
      if (imm5) {
        this.C = input & 1 << imm5 - 1 ? true : false;
      }
    } else if (opcode >> 6 === 260) {
      const Rm = opcode >> 3 & 7;
      const Rdn = opcode & 7;
      const input = this.registers[Rdn];
      const shiftN = (this.registers[Rm] & 255) < 32 ? this.registers[Rm] & 255 : 32;
      const result = shiftN < 32 ? input >> shiftN : (input & 2147483648) >> 31;
      this.registers[Rdn] = result;
      this.N = !!(result & 2147483648);
      this.Z = (result & 4294967295) === 0;
      if (shiftN) {
        this.C = input & 1 << shiftN - 1 ? true : false;
      }
    } else if (opcode >> 12 === 13 && (opcode >> 9 & 7) !== 7) {
      let imm8 = (opcode & 255) << 1;
      const cond = opcode >> 8 & 15;
      if (imm8 & 1 << 8) {
        imm8 = (imm8 & 511) - 512;
      }
      if (this.checkCondition(cond)) {
        this.PC += imm8 + 2;
        this.cycles++;
      }
    } else if (opcode >> 11 === 28) {
      let imm11 = (opcode & 2047) << 1;
      if (imm11 & 1 << 11) {
        imm11 = (imm11 & 2047) - 2048;
      }
      this.PC += imm11 + 2;
      this.cycles++;
    } else if (opcode >> 6 === 270) {
      const Rm = opcode >> 3 & 7;
      const Rdn = opcode & 7;
      const result = this.registers[Rdn] &= ~this.registers[Rm];
      this.N = !!(result & 2147483648);
      this.Z = result === 0;
    } else if (opcode >> 8 === 190) {
      const imm8 = opcode & 255;
      this.breakRewind = 2;
      this.rp2040.onBreak(imm8);
    } else if (opcode >> 11 === 30 && opcode2 >> 14 === 3 && (opcode2 >> 12 & 1) == 1) {
      const imm11 = opcode2 & 2047;
      const J2 = opcode2 >> 11 & 1;
      const J1 = opcode2 >> 13 & 1;
      const imm10 = opcode & 1023;
      const S = opcode >> 10 & 1;
      const I1 = 1 - (S ^ J1);
      const I2 = 1 - (S ^ J2);
      const imm32 = (S ? 255 : 0) << 24 | (I1 << 23 | I2 << 22 | imm10 << 12 | imm11 << 1);
      this.LR = this.PC + 2 | 1;
      this.PC += 2 + imm32;
      this.cycles += 2;
    } else if (opcode >> 7 === 143 && (opcode & 7) === 0) {
      const Rm = opcode >> 3 & 15;
      this.LR = this.PC | 1;
      this.PC = this.registers[Rm] & ~1;
      this.cycles++;
    } else if (opcode >> 7 === 142 && (opcode & 7) === 0) {
      const Rm = opcode >> 3 & 15;
      this.BXWritePC(this.registers[Rm]);
      this.cycles++;
    } else if (opcode >> 6 === 267) {
      const Rm = opcode >> 3 & 7;
      const Rn = opcode & 7;
      this.addUpdateFlags(this.registers[Rn], this.registers[Rm]);
    } else if (opcode >> 11 === 5) {
      const Rn = opcode >> 8 & 7;
      const imm8 = opcode & 255;
      this.substractUpdateFlags(this.registers[Rn], imm8);
    } else if (opcode >> 6 === 266) {
      const Rm = opcode >> 3 & 7;
      const Rn = opcode & 7;
      this.substractUpdateFlags(this.registers[Rn], this.registers[Rm]);
    } else if (opcode >> 8 === 69) {
      const Rm = opcode >> 3 & 15;
      const Rn = opcode >> 4 & 8 | opcode & 7;
      this.substractUpdateFlags(this.registers[Rn], this.registers[Rm]);
    } else if (opcode === 46706) {
      this.PM = true;
    } else if (opcode === 46690) {
      this.PM = false;
      this.interruptsUpdated = true;
    } else if (opcode === 62399 && (opcode2 & 65520) === 36688) {
      this.PC += 2;
      this.cycles += 2;
    } else if (opcode === 62399 && (opcode2 & 65520) === 36672) {
      this.PC += 2;
      this.cycles += 2;
    } else if (opcode >> 6 === 257) {
      const Rm = opcode >> 3 & 7;
      const Rdn = opcode & 7;
      const result = this.registers[Rm] ^ this.registers[Rdn];
      this.registers[Rdn] = result;
      this.N = !!(result & 2147483648);
      this.Z = result === 0;
    } else if (opcode === 62399 && (opcode2 & 65520) === 36704) {
      this.PC += 2;
      this.cycles += 2;
    } else if (opcode >> 11 === 25) {
      const Rn = opcode >> 8 & 7;
      const registers = opcode & 255;
      let address = this.registers[Rn];
      for (let i = 0; i < 8; i++) {
        if (registers & 1 << i) {
          this.registers[i] = this.readUint32(address);
          address += 4;
          this.cycles++;
        }
      }
      if (!(registers & 1 << Rn)) {
        this.registers[Rn] = address;
      }
    } else if (opcode >> 11 === 13) {
      const imm5 = (opcode >> 6 & 31) << 2;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const addr = this.registers[Rn] + imm5;
      this.registers[Rt] = this.readUint32(addr);
    } else if (opcode >> 11 === 19) {
      const Rt = opcode >> 8 & 7;
      const imm8 = opcode & 255;
      const addr = this.SP + (imm8 << 2);
      this.registers[Rt] = this.readUint32(addr);
    } else if (opcode >> 11 === 9) {
      const imm8 = (opcode & 255) << 2;
      const Rt = opcode >> 8 & 7;
      const nextPC = this.PC + 2;
      const addr = (nextPC & 4294967292) + imm8;
      this.registers[Rt] = this.readUint32(addr);
    } else if (opcode >> 9 === 44) {
      const Rm = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const addr = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = this.readUint32(addr);
    } else if (opcode >> 11 === 15) {
      const imm5 = opcode >> 6 & 31;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const addr = this.registers[Rn] + imm5;
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = this.readUint8(addr);
    } else if (opcode >> 9 === 46) {
      const Rm = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const addr = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = this.readUint8(addr);
    } else if (opcode >> 11 === 17) {
      const imm5 = opcode >> 6 & 31;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const addr = this.registers[Rn] + (imm5 << 1);
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = this.readUint16(addr);
    } else if (opcode >> 9 === 45) {
      const Rm = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const addr = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = this.readUint16(addr);
    } else if (opcode >> 9 === 43) {
      const Rm = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const addr = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = signExtend8(this.readUint8(addr));
    } else if (opcode >> 9 === 47) {
      const Rm = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const addr = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(addr)) {
        this.cycles++;
      }
      this.registers[Rt] = signExtend16(this.readUint16(addr));
    } else if (opcode >> 11 === 0) {
      const imm5 = opcode >> 6 & 31;
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      const input = this.registers[Rm];
      const result = input << imm5;
      this.registers[Rd] = result;
      this.N = !!(result & 2147483648);
      this.Z = result === 0;
      this.C = imm5 ? !!(input & 1 << 32 - imm5) : this.C;
    } else if (opcode >> 6 === 258) {
      const Rm = opcode >> 3 & 7;
      const Rdn = opcode & 7;
      const input = this.registers[Rdn];
      const shiftCount = this.registers[Rm] & 255;
      const result = shiftCount >= 32 ? 0 : input << shiftCount;
      this.registers[Rdn] = result;
      this.N = !!(result & 2147483648);
      this.Z = result === 0;
      this.C = shiftCount ? !!(input & 1 << 32 - shiftCount) : this.C;
    } else if (opcode >> 11 === 1) {
      const imm5 = opcode >> 6 & 31;
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      const input = this.registers[Rm];
      const result = imm5 ? input >>> imm5 : 0;
      this.registers[Rd] = result;
      this.N = !!(result & 2147483648);
      this.Z = result === 0;
      this.C = !!(input >>> (imm5 ? imm5 - 1 : 31) & 1);
    } else if (opcode >> 6 === 259) {
      const Rm = opcode >> 3 & 7;
      const Rdn = opcode & 7;
      const shiftAmount = this.registers[Rm] & 255;
      const input = this.registers[Rdn];
      const result = shiftAmount < 32 ? input >>> shiftAmount : 0;
      this.registers[Rdn] = result;
      this.N = !!(result & 2147483648);
      this.Z = result === 0;
      this.C = shiftAmount <= 32 ? !!(input >>> shiftAmount - 1 & 1) : false;
    } else if (opcode >> 8 === 70) {
      const Rm = opcode >> 3 & 15;
      const Rd = opcode >> 4 & 8 | opcode & 7;
      let value = Rm === pcRegister ? this.PC + 2 : this.registers[Rm];
      if (Rd === pcRegister) {
        this.cycles++;
        value &= ~1;
      } else if (Rd === spRegister) {
        value &= ~3;
      }
      this.registers[Rd] = value;
    } else if (opcode >> 11 === 4) {
      const value = opcode & 255;
      const Rd = opcode >> 8 & 7;
      this.registers[Rd] = value;
      this.N = !!(value & 2147483648);
      this.Z = value === 0;
    } else if (opcode === 62447 && opcode2 >> 12 == 8) {
      const SYSm = opcode2 & 255;
      const Rd = opcode2 >> 8 & 15;
      this.registers[Rd] = this.readSpecialRegister(SYSm);
      this.PC += 2;
      this.cycles += 2;
    } else if (opcode >> 4 === 3896 && opcode2 >> 8 == 136) {
      const SYSm = opcode2 & 255;
      const Rn = opcode & 15;
      this.writeSpecialRegister(SYSm, this.registers[Rn]);
      this.PC += 2;
      this.cycles += 2;
    } else if (opcode >> 6 === 269) {
      const Rn = opcode >> 3 & 7;
      const Rdm = opcode & 7;
      const result = Math.imul(this.registers[Rn], this.registers[Rdm]);
      this.registers[Rdm] = result;
      this.N = !!(result & 2147483648);
      this.Z = (result & 4294967295) === 0;
    } else if (opcode >> 6 === 271) {
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      const result = ~this.registers[Rm];
      this.registers[Rd] = result;
      this.N = !!(result & 2147483648);
      this.Z = result === 0;
    } else if (opcode >> 6 === 268) {
      const Rm = opcode >> 3 & 7;
      const Rdn = opcode & 7;
      const result = this.registers[Rdn] | this.registers[Rm];
      this.registers[Rdn] = result;
      this.N = !!(result & 2147483648);
      this.Z = (result & 4294967295) === 0;
    } else if (opcode >> 9 === 94) {
      const P = opcode >> 8 & 1;
      let address = this.SP;
      for (let i = 0; i <= 7; i++) {
        if (opcode & 1 << i) {
          this.registers[i] = this.readUint32(address);
          address += 4;
          this.cycles++;
        }
      }
      if (P) {
        this.SP = address + 4;
        this.BXWritePC(this.readUint32(address));
        this.cycles += 2;
      } else {
        this.SP = address;
      }
    } else if (opcode >> 9 === 90) {
      let bitCount = 0;
      for (let i = 0; i <= 8; i++) {
        if (opcode & 1 << i) {
          bitCount++;
        }
      }
      let address = this.SP - 4 * bitCount;
      for (let i = 0; i <= 7; i++) {
        if (opcode & 1 << i) {
          this.writeUint32(address, this.registers[i]);
          this.cycles++;
          address += 4;
        }
      }
      if (opcode & 1 << 8) {
        this.writeUint32(address, this.registers[14]);
      }
      this.SP -= 4 * bitCount;
    } else if (opcode >> 6 === 744) {
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      const input = this.registers[Rm];
      this.registers[Rd] = (input & 255) << 24 | (input >> 8 & 255) << 16 | (input >> 16 & 255) << 8 | input >> 24 & 255;
    } else if (opcode >> 6 === 745) {
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      const input = this.registers[Rm];
      this.registers[Rd] = (input >> 16 & 255) << 24 | (input >> 24 & 255) << 16 | (input & 255) << 8 | input >> 8 & 255;
    } else if (opcode >> 6 === 747) {
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      const input = this.registers[Rm];
      this.registers[Rd] = signExtend16((input & 255) << 8 | input >> 8 & 255);
    } else if (opcode >> 6 === 263) {
      const Rm = opcode >> 3 & 7;
      const Rdn = opcode & 7;
      const input = this.registers[Rdn];
      const shift = (this.registers[Rm] & 255) % 32;
      const result = input >>> shift | input << 32 - shift;
      this.registers[Rdn] = result;
      this.N = !!(result & 2147483648);
      this.Z = result === 0;
      this.C = !!(result & 2147483648);
    } else if (opcode >> 6 === 265) {
      const Rn = opcode >> 3 & 7;
      const Rd = opcode & 7;
      this.registers[Rd] = this.substractUpdateFlags(0, this.registers[Rn]);
    } else if (opcode === 48896) {
    } else if (opcode >> 6 === 262) {
      const Rm = opcode >> 3 & 7;
      const Rdn = opcode & 7;
      this.registers[Rdn] = this.substractUpdateFlags(this.registers[Rdn], this.registers[Rm] + (1 - (this.C ? 1 : 0)));
    } else if (opcode === 48960) {
      this.logger.info(LOG_NAME2, "SEV");
    } else if (opcode >> 11 === 24) {
      const Rn = opcode >> 8 & 7;
      const registers = opcode & 255;
      let address = this.registers[Rn];
      for (let i = 0; i < 8; i++) {
        if (registers & 1 << i) {
          this.writeUint32(address, this.registers[i]);
          address += 4;
          this.cycles++;
        }
      }
      if (!(registers & 1 << Rn)) {
        this.registers[Rn] = address;
      }
    } else if (opcode >> 11 === 12) {
      const imm5 = (opcode >> 6 & 31) << 2;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const address = this.registers[Rn] + imm5;
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint32(address, this.registers[Rt]);
    } else if (opcode >> 11 === 18) {
      const Rt = opcode >> 8 & 7;
      const imm8 = opcode & 255;
      const address = this.SP + (imm8 << 2);
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint32(address, this.registers[Rt]);
    } else if (opcode >> 9 === 40) {
      const Rm = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const address = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint32(address, this.registers[Rt]);
    } else if (opcode >> 11 === 14) {
      const imm5 = opcode >> 6 & 31;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const address = this.registers[Rn] + imm5;
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint8(address, this.registers[Rt]);
    } else if (opcode >> 9 === 42) {
      const Rm = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const address = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint8(address, this.registers[Rt]);
    } else if (opcode >> 11 === 16) {
      const imm5 = (opcode >> 6 & 31) << 1;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const address = this.registers[Rn] + imm5;
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint16(address, this.registers[Rt]);
    } else if (opcode >> 9 === 41) {
      const Rm = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rt = opcode & 7;
      const address = this.registers[Rm] + this.registers[Rn];
      if (this.slowIO(address)) {
        this.cycles++;
      }
      this.writeUint16(address, this.registers[Rt]);
    } else if (opcode >> 7 === 353) {
      const imm32 = (opcode & 127) << 2;
      this.SP -= imm32;
    } else if (opcode >> 9 === 15) {
      const imm3 = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rd = opcode & 7;
      this.registers[Rd] = this.substractUpdateFlags(this.registers[Rn], imm3);
    } else if (opcode >> 11 === 7) {
      const imm8 = opcode & 255;
      const Rdn = opcode >> 8 & 7;
      this.registers[Rdn] = this.substractUpdateFlags(this.registers[Rdn], imm8);
    } else if (opcode >> 9 === 13) {
      const Rm = opcode >> 6 & 7;
      const Rn = opcode >> 3 & 7;
      const Rd = opcode & 7;
      this.registers[Rd] = this.substractUpdateFlags(this.registers[Rn], this.registers[Rm]);
    } else if (opcode >> 8 === 223) {
      this.pendingSVCall = true;
      this.interruptsUpdated = true;
    } else if (opcode >> 6 === 713) {
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      this.registers[Rd] = signExtend8(this.registers[Rm]);
    } else if (opcode >> 6 === 712) {
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      this.registers[Rd] = signExtend16(this.registers[Rm]);
    } else if (opcode >> 6 == 264) {
      const Rm = opcode >> 3 & 7;
      const Rn = opcode & 7;
      const result = this.registers[Rn] & this.registers[Rm];
      this.N = !!(result & 2147483648);
      this.Z = result === 0;
    } else if (opcode >> 8 == 222) {
      const imm8 = opcode & 255;
      this.breakRewind = 2;
      this.rp2040.onBreak(imm8);
    } else if (opcode >> 4 === 3967 && opcode2 >> 12 === 10) {
      const imm4 = opcode & 15;
      const imm12 = opcode2 & 4095;
      this.breakRewind = 4;
      this.rp2040.onBreak(imm4 << 12 | imm12);
      this.PC += 2;
    } else if (opcode >> 6 == 715) {
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      this.registers[Rd] = this.registers[Rm] & 255;
    } else if (opcode >> 6 == 714) {
      const Rm = opcode >> 3 & 7;
      const Rd = opcode & 7;
      this.registers[Rd] = this.registers[Rm] & 65535;
    } else if (opcode === 48928) {
      this.cycles++;
      if (this.eventRegistered) {
        this.eventRegistered = false;
      } else {
        this.waiting = true;
      }
    } else if (opcode === 48944) {
      this.cycles++;
      this.waiting = true;
    } else if (opcode === 48912) {
      this.logger.info(LOG_NAME2, "Yield");
    } else {
      this.logger.warn(LOG_NAME2, `Warning: Instruction at ${opcodePC.toString(16)} is not implemented yet!`);
      this.logger.warn(LOG_NAME2, `Opcode: 0x${opcode.toString(16)} (0x${opcode2.toString(16)})`);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/gdb/gdb-utils.js
function encodeHexByte(value) {
  return (value >> 4).toString(16) + (value & 15).toString(16);
}
function encodeHexBuf(buf) {
  return Array.from(buf).map(encodeHexByte).join("");
}
function encodeHexUint32(value) {
  const buf = new Uint32Array([value]);
  return encodeHexBuf(new Uint8Array(buf.buffer));
}
function decodeHexBuf(encoded) {
  const result = new Uint8Array(encoded.length / 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(encoded.substr(i * 2, 2), 16);
  }
  return result;
}
function gdbChecksum(text) {
  const value = text.split("").map((c) => c.charCodeAt(0)).reduce((a, b) => a + b, 0) & 255;
  return encodeHexByte(value);
}
function gdbMessage(value) {
  return `$${value}#${gdbChecksum(value)}`;
}

// ../node_modules/rp2040js/dist/esm/gdb/gdb-server.js
var STOP_REPLY_SIGINT = "S02";
var STOP_REPLY_TRAP = "S05";
var targetXML = `<?xml version="1.0"?>
<!DOCTYPE target SYSTEM "gdb-target.dtd">
<target version="1.0">
<architecture>arm</architecture>
<feature name="org.gnu.gdb.arm.m-profile">
<reg name="r0" bitsize="32" regnum="0" save-restore="yes" type="int" group="general"/>
<reg name="r1" bitsize="32" regnum="1" save-restore="yes" type="int" group="general"/>
<reg name="r2" bitsize="32" regnum="2" save-restore="yes" type="int" group="general"/>
<reg name="r3" bitsize="32" regnum="3" save-restore="yes" type="int" group="general"/>
<reg name="r4" bitsize="32" regnum="4" save-restore="yes" type="int" group="general"/>
<reg name="r5" bitsize="32" regnum="5" save-restore="yes" type="int" group="general"/>
<reg name="r6" bitsize="32" regnum="6" save-restore="yes" type="int" group="general"/>
<reg name="r7" bitsize="32" regnum="7" save-restore="yes" type="int" group="general"/>
<reg name="r8" bitsize="32" regnum="8" save-restore="yes" type="int" group="general"/>
<reg name="r9" bitsize="32" regnum="9" save-restore="yes" type="int" group="general"/>
<reg name="r10" bitsize="32" regnum="10" save-restore="yes" type="int" group="general"/>
<reg name="r11" bitsize="32" regnum="11" save-restore="yes" type="int" group="general"/>
<reg name="r12" bitsize="32" regnum="12" save-restore="yes" type="int" group="general"/>
<reg name="sp" bitsize="32" regnum="13" save-restore="yes" type="data_ptr" group="general"/>
<reg name="lr" bitsize="32" regnum="14" save-restore="yes" type="int" group="general"/>
<reg name="pc" bitsize="32" regnum="15" save-restore="yes" type="code_ptr" group="general"/>
<reg name="xPSR" bitsize="32" regnum="16" save-restore="yes" type="int" group="general"/>
</feature>
<feature name="org.gnu.gdb.arm.m-system">
<reg name="msp" bitsize="32" regnum="17" save-restore="yes" type="data_ptr" group="system"/>
<reg name="psp" bitsize="32" regnum="18" save-restore="yes" type="data_ptr" group="system"/>
<reg name="primask" bitsize="1" regnum="19" save-restore="yes" type="int8" group="system"/>
<reg name="basepri" bitsize="8" regnum="20" save-restore="yes" type="int8" group="system"/>
<reg name="faultmask" bitsize="1" regnum="21" save-restore="yes" type="int8" group="system"/>
<reg name="control" bitsize="2" regnum="22" save-restore="yes" type="int8" group="system"/>
</feature>
</target>`;
var LOG_NAME3 = "GDBServer";
var GDBServer = class {
  constructor(rp2040) {
    this.rp2040 = rp2040;
    this.logger = new ConsoleLogger(LogLevel.Warn, true);
    this.connections = /* @__PURE__ */ new Set();
  }
  processGDBMessage(cmd) {
    const { rp2040 } = this;
    const { core } = rp2040;
    if (cmd === "Hg0") {
      return gdbMessage("OK");
    }
    switch (cmd[0]) {
      case "?":
        return gdbMessage(STOP_REPLY_TRAP);
      case "q":
        if (cmd.startsWith("qSupported:")) {
          return gdbMessage("PacketSize=4000;vContSupported+;qXfer:features:read+");
        }
        if (cmd === "qAttached") {
          return gdbMessage("1");
        }
        if (cmd.startsWith("qXfer:features:read:target.xml")) {
          return gdbMessage("l" + targetXML);
        }
        return gdbMessage("");
      case "v":
        if (cmd === "vCont?") {
          return gdbMessage("vCont;c;C;s;S");
        }
        if (cmd.startsWith("vCont;c")) {
          if (!rp2040.executing) {
            rp2040.execute();
          }
          return;
        }
        if (cmd.startsWith("vCont;s")) {
          rp2040.step();
          return gdbMessage(STOP_REPLY_TRAP);
        }
        break;
      case "c":
        if (!rp2040.executing) {
          rp2040.execute();
        }
        break;
      case "g": {
        const buf = new Uint32Array(17);
        buf.set(core.registers);
        buf[16] = core.xPSR;
        return gdbMessage(encodeHexBuf(new Uint8Array(buf.buffer)));
      }
      case "p": {
        const registerIndex = parseInt(cmd.substr(1), 16);
        if (registerIndex >= 0 && registerIndex <= 15) {
          return gdbMessage(encodeHexUint32(core.registers[registerIndex]));
        }
        const specialRegister = (sysm) => gdbMessage(encodeHexUint32(core.readSpecialRegister(sysm)));
        switch (registerIndex) {
          case 16:
            return gdbMessage(encodeHexUint32(core.xPSR));
          case 17:
            return specialRegister(SYSM_MSP);
          case 18:
            return specialRegister(SYSM_PSP);
          case 19:
            return specialRegister(SYSM_PRIMASK);
          case 20:
            this.logger.warn(LOG_NAME3, "TODO BASEPRI");
            return gdbMessage(encodeHexUint32(0));
          // TODO BASEPRI
          case 21:
            this.logger.warn(LOG_NAME3, "TODO faultmask");
            return gdbMessage(encodeHexUint32(0));
          // TODO faultmask
          case 22:
            return specialRegister(SYSM_CONTROL);
        }
        break;
      }
      case "P": {
        const params = cmd.substr(1).split("=");
        const registerIndex = parseInt(params[0], 16);
        const registerValue = params[1].trim();
        const registerBytes = registerIndex > 18 ? 1 : 4;
        const decodedValue = decodeHexBuf(registerValue);
        if (registerIndex < 0 || registerIndex > 22 || decodedValue.length !== registerBytes) {
          return gdbMessage("E00");
        }
        const valueBuffer = new Uint8Array(4);
        valueBuffer.set(decodedValue.slice(0, 4));
        const value = new DataView(valueBuffer.buffer).getUint32(0, true);
        switch (registerIndex) {
          case 16:
            core.xPSR = value;
            break;
          case 17:
            core.writeSpecialRegister(SYSM_MSP, value);
            break;
          case 18:
            core.writeSpecialRegister(SYSM_PSP, value);
            break;
          case 19:
            core.writeSpecialRegister(SYSM_PRIMASK, value);
            break;
          case 20:
            this.logger.warn(LOG_NAME3, "TODO BASEPRI");
            break;
          // TODO BASEPRI
          case 21:
            this.logger.warn(LOG_NAME3, "TODO faultmask");
            break;
          // TODO faultmask
          case 22:
            core.writeSpecialRegister(SYSM_CONTROL, value);
            break;
          default:
            core.registers[registerIndex] = value;
            break;
        }
        return gdbMessage("OK");
      }
      case "m": {
        const params = cmd.substr(1).split(",");
        const address = parseInt(params[0], 16);
        const length = parseInt(params[1], 16);
        let result = "";
        for (let i = 0; i < length; i++) {
          result += encodeHexByte(rp2040.readUint8(address + i));
        }
        return gdbMessage(result);
      }
      case "M": {
        const params = cmd.substr(1).split(/[,:]/);
        const address = parseInt(params[0], 16);
        const length = parseInt(params[1], 16);
        const data = decodeHexBuf(params[2].substr(0, length * 2));
        for (let i = 0; i < data.length; i++) {
          this.debug(`Write ${data[i].toString(16)} to ${(address + i).toString(16)}`);
          rp2040.writeUint8(address + i, data[i]);
        }
        return gdbMessage("OK");
      }
    }
    return gdbMessage("");
  }
  addConnection(connection) {
    this.connections.add(connection);
    this.rp2040.onBreak = () => {
      this.rp2040.stop();
      this.rp2040.core.PC -= this.rp2040.core.breakRewind;
      for (const connection2 of this.connections) {
        connection2.onBreakpoint();
      }
    };
  }
  removeConnection(connection) {
    this.connections.delete(connection);
  }
  debug(msg) {
    this.logger.debug(LOG_NAME3, msg);
  }
  info(msg) {
    this.logger.info(LOG_NAME3, msg);
  }
  warn(msg) {
    this.logger.warn(LOG_NAME3, msg);
  }
  error(msg) {
    this.logger.error(LOG_NAME3, msg);
  }
};

// ../node_modules/rp2040js/dist/esm/gdb/gdb-connection.js
var GDBConnection = class {
  constructor(server, onResponse) {
    this.server = server;
    this.onResponse = onResponse;
    this.rp2040 = this.server.rp2040;
    this.buf = "";
    server.addConnection(this);
    onResponse("+");
  }
  feedData(data) {
    const { onResponse } = this;
    if (data.charCodeAt(0) === 3) {
      this.server.info("BREAK");
      this.rp2040.stop();
      onResponse(gdbMessage(STOP_REPLY_SIGINT));
      data = data.slice(1);
    }
    this.buf += data;
    for (; ; ) {
      const dolla = this.buf.indexOf("$");
      const hash = this.buf.indexOf("#", dolla + 1);
      if (dolla < 0 || hash < 0 || hash + 2 > this.buf.length) {
        return;
      }
      const cmd = this.buf.substring(dolla + 1, hash);
      const cksum = this.buf.substr(hash + 1, 2);
      this.buf = this.buf.substr(hash + 2);
      if (gdbChecksum(cmd) !== cksum) {
        this.server.warn(`GDB checksum error in message: ${cmd}`);
        onResponse("-");
      } else {
        onResponse("+");
        this.server.debug(`>${cmd}`);
        const response = this.server.processGDBMessage(cmd);
        if (response) {
          this.server.debug(`<${response}`);
          onResponse(response);
        }
      }
    }
  }
  onBreakpoint() {
    try {
      this.onResponse(gdbMessage(STOP_REPLY_TRAP));
    } catch (e) {
      this.server.removeConnection(this);
    }
  }
};

// ../node_modules/rp2040js/dist/esm/usb/interfaces.js
var DataDirection;
(function(DataDirection2) {
  DataDirection2[DataDirection2["HostToDevice"] = 0] = "HostToDevice";
  DataDirection2[DataDirection2["DeviceToHost"] = 1] = "DeviceToHost";
})(DataDirection || (DataDirection = {}));
var SetupType;
(function(SetupType2) {
  SetupType2[SetupType2["Standard"] = 0] = "Standard";
  SetupType2[SetupType2["Class"] = 1] = "Class";
  SetupType2[SetupType2["Vendor"] = 2] = "Vendor";
  SetupType2[SetupType2["Reserved"] = 3] = "Reserved";
})(SetupType || (SetupType = {}));
var SetupRecipient;
(function(SetupRecipient2) {
  SetupRecipient2[SetupRecipient2["Device"] = 0] = "Device";
  SetupRecipient2[SetupRecipient2["Interface"] = 1] = "Interface";
  SetupRecipient2[SetupRecipient2["Endpoint"] = 2] = "Endpoint";
  SetupRecipient2[SetupRecipient2["Other"] = 3] = "Other";
})(SetupRecipient || (SetupRecipient = {}));
var SetupRequest;
(function(SetupRequest2) {
  SetupRequest2[SetupRequest2["GetStatus"] = 0] = "GetStatus";
  SetupRequest2[SetupRequest2["ClearFeature"] = 1] = "ClearFeature";
  SetupRequest2[SetupRequest2["Reserved1"] = 2] = "Reserved1";
  SetupRequest2[SetupRequest2["SetFeature"] = 3] = "SetFeature";
  SetupRequest2[SetupRequest2["Reserved2"] = 4] = "Reserved2";
  SetupRequest2[SetupRequest2["SetAddress"] = 5] = "SetAddress";
  SetupRequest2[SetupRequest2["GetDescriptor"] = 6] = "GetDescriptor";
  SetupRequest2[SetupRequest2["SetDescriptor"] = 7] = "SetDescriptor";
  SetupRequest2[SetupRequest2["GetConfiguration"] = 8] = "GetConfiguration";
  SetupRequest2[SetupRequest2["SetDeviceConfiguration"] = 9] = "SetDeviceConfiguration";
  SetupRequest2[SetupRequest2["GetInterface"] = 10] = "GetInterface";
  SetupRequest2[SetupRequest2["SetInterface"] = 11] = "SetInterface";
  SetupRequest2[SetupRequest2["SynchFrame"] = 12] = "SynchFrame";
})(SetupRequest || (SetupRequest = {}));
var DescriptorType;
(function(DescriptorType2) {
  DescriptorType2[DescriptorType2["Device"] = 1] = "Device";
  DescriptorType2[DescriptorType2["Configration"] = 2] = "Configration";
  DescriptorType2[DescriptorType2["String"] = 3] = "String";
  DescriptorType2[DescriptorType2["Interface"] = 4] = "Interface";
  DescriptorType2[DescriptorType2["Endpoint"] = 5] = "Endpoint";
})(DescriptorType || (DescriptorType = {}));

// ../node_modules/rp2040js/dist/esm/usb/setup.js
function createSetupPacket(params) {
  const setupPacket = new Uint8Array(8);
  setupPacket[0] = params.dataDirection << 7 | params.type << 5 | params.recipient;
  setupPacket[1] = params.bRequest;
  setupPacket[2] = params.wValue & 255;
  setupPacket[3] = params.wValue >> 8 & 255;
  setupPacket[4] = params.wIndex & 255;
  setupPacket[5] = params.wIndex >> 8 & 255;
  setupPacket[6] = params.wLength & 255;
  setupPacket[7] = params.wLength >> 8 & 255;
  return setupPacket;
}
function setDeviceAddressPacket(address) {
  return createSetupPacket({
    dataDirection: DataDirection.HostToDevice,
    type: SetupType.Standard,
    recipient: SetupRecipient.Device,
    bRequest: SetupRequest.SetAddress,
    wValue: address,
    wIndex: 0,
    wLength: 0
  });
}
function getDescriptorPacket(type, length, index = 0) {
  return createSetupPacket({
    dataDirection: DataDirection.DeviceToHost,
    type: SetupType.Standard,
    recipient: SetupRecipient.Device,
    bRequest: SetupRequest.GetDescriptor,
    wValue: type << 8,
    wIndex: index,
    wLength: length
  });
}
function setDeviceConfigurationPacket(configurationNumber) {
  return createSetupPacket({
    dataDirection: DataDirection.HostToDevice,
    type: SetupType.Standard,
    recipient: SetupRecipient.Device,
    bRequest: SetupRequest.SetDeviceConfiguration,
    wValue: configurationNumber,
    wIndex: 0,
    wLength: 0
  });
}

// ../node_modules/rp2040js/dist/esm/usb/cdc.js
var CDC_REQUEST_SET_CONTROL_LINE_STATE = 34;
var CDC_DTR = 1 << 0;
var CDC_RTS = 1 << 1;
var CDC_DATA_CLASS = 10;
var ENDPOINT_BULK = 2;
var TX_FIFO_SIZE = 512;
var ENDPOINT_ZERO = 0;
var CONFIGURATION_DESCRIPTOR_SIZE = 9;
function extractEndpointNumbers(descriptors) {
  let index = 0;
  let foundInterface = false;
  const result = {
    in: -1,
    out: -1
  };
  while (index < descriptors.length) {
    const len = descriptors[index];
    if (len < 2 || descriptors.length < index + len) {
      break;
    }
    const type = descriptors[index + 1];
    if (type === DescriptorType.Interface && len === 9) {
      const numEndpoints = descriptors[index + 4];
      const interfaceClass = descriptors[index + 5];
      foundInterface = numEndpoints === 2 && interfaceClass === CDC_DATA_CLASS;
    }
    if (foundInterface && type === DescriptorType.Endpoint && len === 7) {
      const address = descriptors[index + 2];
      const attributes = descriptors[index + 3];
      if ((attributes & 3) === ENDPOINT_BULK) {
        if (address & 128) {
          result.in = address & 15;
        } else {
          result.out = address & 15;
        }
      }
    }
    index += descriptors[index];
  }
  return result;
}
var USBCDC = class {
  constructor(usb) {
    this.usb = usb;
    this.txFIFO = new FIFO(TX_FIFO_SIZE);
    this.initialized = false;
    this.descriptorsSize = null;
    this.descriptors = [];
    this.outEndpoint = -1;
    this.inEndpoint = -1;
    this.usb.onUSBEnabled = () => {
      this.usb.resetDevice();
    };
    this.usb.onResetReceived = () => {
      this.usb.sendSetupPacket(setDeviceAddressPacket(1));
    };
    this.usb.onEndpointWrite = (endpoint, buffer) => {
      var _a, _b;
      if (endpoint === ENDPOINT_ZERO && buffer.length === 0) {
        if (this.descriptorsSize == null) {
          this.usb.sendSetupPacket(getDescriptorPacket(DescriptorType.Configration, CONFIGURATION_DESCRIPTOR_SIZE));
        } else if (!this.initialized) {
          this.cdcSetControlLineState();
          (_a = this.onDeviceConnected) === null || _a === void 0 ? void 0 : _a.call(this);
        }
      }
      if (endpoint === ENDPOINT_ZERO && buffer.length > 1) {
        if (buffer.length === CONFIGURATION_DESCRIPTOR_SIZE && buffer[1] === DescriptorType.Configration && this.descriptorsSize == null) {
          this.descriptorsSize = buffer[3] << 8 | buffer[2];
          this.usb.sendSetupPacket(getDescriptorPacket(DescriptorType.Configration, this.descriptorsSize));
        } else if (this.descriptorsSize != null && this.descriptors.length < this.descriptorsSize) {
          this.descriptors.push(...buffer);
        }
        if (this.descriptorsSize === this.descriptors.length) {
          const endpoints = extractEndpointNumbers(this.descriptors);
          this.inEndpoint = endpoints.in;
          this.outEndpoint = endpoints.out;
          this.usb.sendSetupPacket(setDeviceConfigurationPacket(1));
        }
      }
      if (endpoint === this.inEndpoint) {
        (_b = this.onSerialData) === null || _b === void 0 ? void 0 : _b.call(this, buffer);
      }
    };
    this.usb.onEndpointRead = (endpoint, size) => {
      if (endpoint === this.outEndpoint) {
        const buffer = new Uint8Array(Math.min(size, this.txFIFO.itemCount));
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = this.txFIFO.pull();
        }
        this.usb.endpointReadDone(this.outEndpoint, buffer);
      }
    };
  }
  cdcSetControlLineState(value = CDC_DTR | CDC_RTS, interfaceNumber = 0) {
    this.usb.sendSetupPacket(createSetupPacket({
      dataDirection: DataDirection.HostToDevice,
      type: SetupType.Class,
      recipient: SetupRecipient.Device,
      bRequest: CDC_REQUEST_SET_CONTROL_LINE_STATE,
      wValue: value,
      wIndex: interfaceNumber,
      wLength: 0
    }));
    this.initialized = true;
  }
  sendSerialByte(data) {
    this.txFIFO.push(data);
  }
};

// ../src/worker/rp2040-bootrom.ts
var bootromB1 = new Uint32Array([
  537140992,
  239,
  53,
  49,
  33649997,
  13107322,
  29,
  2281841408,
  3489874586,
  805603395,
  3522642577,
  1198529560,
  3892166448,
  4026550004,
  1218377733,
  1610686720,
  1189568577,
  553666716,
  1610695625,
  1198547009,
  10789265,
  7689,
  539575080,
  808595506,
  1935757856,
  1919246960,
  1344305522,
  1918115945,
  1852400737,
  1951146087,
  860880996,
  861012697,
  860619517,
  861143847,
  1397556063,
  877864669,
  1129129681,
  876815937,
  1112876585,
  1413752245,
  1162084741,
  1448542603,
  1179189559,
  1480926369,
  1163011061,
  1347560317,
  1128670149,
  1480794977,
  1128604465,
  69,
  5263943,
  5788227,
  27805267,
  36193363,
  27679302,
  660099910,
  776750406,
  777278276,
  1034700100,
  1215496192,
  687892481,
  4160737567,
  1232207773,
  1745505137,
  3489743386,
  3885195275,
  1315983215,
  1118883599,
  1079628039,
  3506706496,
  1614298896,
  2282288002,
  4026681240,
  3206609377,
  143224097,
  1700844539,
  477019968,
  1281443632,
  553930597,
  1839292729,
  139029793,
  2769015547,
  4160692224,
  671219693,
  4160737782,
  1622736873,
  4293326847,
  2282288e3,
  4293064703,
  4160726273,
  1187053535,
  1631133952,
  3881650048,
  1830862624,
  3556444224,
  671116704,
  1198575838,
  1127687681,
  3187689400,
  940697594,
  3170925248,
  1078113536,
  4026542592,
  3539400706,
  1181763214,
  2115328,
  11113,
  11109,
  11313,
  11517,
  10279,
  10279,
  11697,
  10317,
  10319,
  10369,
  10371,
  10455,
  10457,
  10471,
  10473,
  10687,
  10613,
  10717,
  49,
  10725,
  10831,
  10251,
  10867,
  10415,
  10417,
  10397,
  10399,
  13697,
  13699,
  13707,
  13709,
  13885,
  11873,
  11861,
  12221,
  12569,
  13419,
  13419,
  13021,
  13669,
  13671,
  13683,
  13685,
  14019,
  14021,
  14011,
  14013,
  14385,
  14401,
  14353,
  49,
  15173,
  15329,
  13423,
  14641,
  14033,
  14035,
  14027,
  14029,
  13761,
  13763,
  13787,
  13789,
  13923,
  4085270538,
  4026632200,
  65307,
  1073758208,
  1073774752,
  3489660928,
  1074151432,
  16777216,
  1074102300,
  2953298131,
  3758157056,
  1343228080,
  138561843,
  142819338,
  1074282507,
  415242368,
  406849729,
  1074284847,
  406849921,
  1128810798,
  1198526080,
  139545133,
  4407377,
  1074282507,
  1125648448,
  1074987139,
  142622736,
  1244152579,
  1074790680,
  152780819,
  3120579352,
  2737129328,
  3507227649,
  3506702977,
  3506768129,
  807033880,
  1549289328,
  1198534672,
  806771800,
  176703344,
  151572740,
  1549324548,
  1198534666,
  1198545944,
  805723160,
  2737260400,
  3490644993,
  3489989e3,
  3490120065,
  823136009,
  1198546008,
  1549274761,
  1198534666,
  1545080448,
  1198534660,
  3490054529,
  3490185608,
  806358784,
  806378520,
  243287920,
  807033880,
  243877744,
  806640728,
  18288,
  1227133513,
  3340530119,
  67125252,
  3435973836,
  4042322160,
  67372294,
  50529027,
  33686018,
  33686018,
  16843009,
  16843009,
  16843009,
  16843009,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  65542,
  65538,
  65539,
  65538,
  65540,
  65538,
  65539,
  65538,
  65541,
  65538,
  65539,
  65538,
  65540,
  65538,
  65539,
  65538,
  551616561,
  474554729,
  499981225,
  3187679997,
  1754483202,
  1620261696,
  1187006320,
  1343228540,
  2106804738,
  1241675027,
  1198546963,
  1343228396,
  1343291392,
  1610687232,
  1614962947,
  1623423051,
  1198547075,
  1753434372,
  1947869697,
  2015062043,
  1125341899,
  18200,
  1084,
  3044042755,
  3489799705,
  588216473,
  603996185,
  1242703104,
  412745931,
  1616207892,
  1309671428,
  2335323176,
  2015724162,
  754984e3,
  421842944,
  2201229588,
  3490588928,
  754983252,
  824233984,
  807994953,
  2013337682,
  404441094,
  3489868032,
  570449946,
  3178258522,
  3892011033,
  1343225984,
  1343228396,
  1343225856,
  474330416,
  2011804361,
  1881814312,
  230083,
  2015669251,
  1880896296,
  4793089,
  411648090,
  2010717379,
  3187719472,
  3052404755,
  786438,
  2961506325,
  1610691336,
  2015597315,
  2019760356,
  3522833157,
  2032236899,
  1124794907,
  553723663,
  2432727202,
  3751959,
  164784168,
  4291885055,
  1241894152,
  1612447935,
  2600685755,
  3521397419,
  2953117744,
  1187036656,
  1343228424,
  2145066051,
  2013409321,
  14371075,
  704649304,
  1241698305,
  1198528664,
  1343225988,
  1343225984,
  439664,
  294787,
  721434136,
  2328088863,
  227139,
  2014917417,
  687873347,
  495177984,
  2325970909,
  508559402,
  1208631682,
  404423058,
  1638078619,
  1117332224,
  2150662,
  4291885055,
  423952493,
  3000731691,
  587298595,
  3176355,
  1187036528,
  1343225856,
  3044024832,
  2010783171,
  275201,
  1116766168,
  595644719,
  1125712091,
  858325027,
  721451035,
  595644418,
  1125712411,
  2144541858,
  1910273,
  1099243112,
  2010333299,
  57475104,
  4160701197,
  493092771,
  2997714906,
  411058354,
  2147820032,
  2007112993,
  973176778,
  1755412426,
  1753887784,
  1619671553,
  704673826,
  2145046530,
  2011054166,
  547405168,
  1124139328,
  3889002458,
  308592,
  721447075,
  1755041813,
  3490851584,
  2146770214,
  3490589952,
  2145066467,
  3507104512,
  858325027,
  721451035,
  2150406,
  4277204991,
  1118535667,
  3178287590,
  2330001440,
  4288870399,
  3044075488,
  262157,
  2621457,
  4160684058,
  587267799,
  855728355,
  2121893,
  4160713899,
  3178299343,
  242960,
  1224952322,
  4160702467,
  3172007912,
  16217,
  1343228452,
  1343229376,
  1753442369,
  1116452112,
  587255811,
  4160710666,
  3172007896,
  3037724675,
  2145071923,
  721432620,
  4160737537,
  3172007917,
  3044016131,
  2015048489,
  851972,
  721420310,
  4160737283,
  587267895,
  3371267,
  2097193,
  4160702977,
  3178299322,
  16217,
  570471696,
  1208174850,
  4293195775,
  1187036432,
  1343228356,
  1343229800,
  570471696,
  1208174850,
  4292409343,
  1187036432,
  1343228376,
  1343229844,
  1258534160,
  1225017859,
  4160702468,
  3172007832,
  1885,
  16217,
  1343228356,
  1343229800,
  499365136,
  1753317338,
  3506776576,
  721447115,
  2081149194,
  3506907904,
  587211777,
  1619227852,
  3489809050,
  1619747019,
  1749794064,
  3489737472,
  3891873688,
  721447107,
  1619251446,
  1956405442,
  4283234303,
  3187730416,
  499561840,
  294899,
  721420301,
  474206490,
  721453019,
  250119,
  2015048489,
  1095975514,
  855722506,
  2123411,
  4273666047,
  1744970624,
  1125318939,
  2012569603,
  721447203,
  2150401,
  3178252184,
  3539747467,
  3891951601,
  1343299584,
  671135088,
  1259917326,
  1489240192,
  2144017697,
  2009805569,
  755001509,
  553832713,
  4160684064,
  3178299335,
  687885329,
  1276236272,
  2083252206,
  3489803008,
  1953178369,
  497281011,
  857962458,
  721451035,
  1756090370,
  3489803008,
  4160684064,
  2095840769,
  3521391360,
  2124011,
  1626028801,
  4286773247,
  1187047389,
  1343228424,
  1343229800,
  1343229844,
  3044025088,
  288901,
  4160713771,
  2095841139,
  3508218624,
  908656678,
  721451059,
  2150403,
  4160716577,
  587267735,
  2087352227,
  3490595482,
  488797291,
  989954003,
  570521555,
  2145066403,
  2016490497,
  1079672800,
  4288739327,
  2145648,
  4273928191,
  3187730426,
  308728,
  4265539583,
  1744961573,
  891833113,
  3491578394,
  721451051,
  488886275,
  721518555,
  587321604,
  2144410786,
  2010333259,
  2145000675,
  1083384577,
  1242646800,
  1309820945,
  1712023123,
  1111191159,
  939643138,
  3507562496,
  1716741651,
  4160684064,
  2016149015,
  509157888,
  488718731,
  1610756865,
  587298763,
  872973474,
  3187177443,
  3890570763,
  67109888,
  1343299584,
  1343303680,
  1e5,
  1343291392,
  1292416368,
  4160684072,
  1275592631,
  4160684064,
  2686899,
  4160692481,
  553778977,
  4160684064,
  3178299165,
  1343229800,
  1343229844,
  620803440,
  942213,
  4160684036,
  1118764959,
  480432129,
  2007332821,
  2144411106,
  3489999104,
  1763932117,
  3489737472,
  1201143840,
  2103134983,
  3490261760,
  687892577,
  1755566086,
  3506645760,
  1745485856,
  4267702271,
  1187036528,
  1343228396,
  1260303632,
  1612467230,
  1260266624,
  1612449252,
  82060512,
  1260150812,
  3492554752,
  1126179841,
  1641827354,
  1113876956,
  1646018628,
  1654153817,
  8987130,
  1616528202,
  1745963541,
  1108419074,
  1226101003,
  1745438740,
  553861194,
  1225998346,
  570712074,
  1108437889,
  571265276,
  1259365082,
  855585525,
  578838554,
  97667854,
  570515482,
  1880771341,
  1641594128,
  1187047386,
  1073807368,
  131068,
  1074114560,
  1074102272,
  2953298131,
  1074184192,
  1073774640,
  1073774592,
  1073778736,
  1074110508,
  1074110464,
  1343229620,
  308592,
  536877125,
  3523297964,
  3489671168,
  1258601840,
  1746599968,
  1201170651,
  22750080,
  3891337444,
  1343229372,
  101851872,
  579082369,
  47316995,
  1116807169,
  585881863,
  412812818,
  536879744,
  1117389266,
  1198539072,
  495301936,
  3001159436,
  859242515,
  3623889929,
  1879259911,
  17379329,
  3522380456,
  3187719472,
  3037733376,
  1208371973,
  2048619098,
  3623889791,
  1241860100,
  4160702725,
  3172007413,
  1343228600,
  1343229528,
  1343229476,
  2909,
  1343228080,
  1778535172,
  3037752539,
  3506520730,
  4292933631,
  1187036432,
  1343228616,
  1208268048,
  2145066435,
  3506514688,
  4257413119,
  1187036432,
  1343229528,
  1208221699,
  3624086275,
  989940227,
  1486356635,
  1187006320,
  15799,
  16104,
  33573634,
  1746624536,
  1187006320,
  1073840140,
  308592,
  860162,
  4294113279,
  587473600,
  1126762017,
  235406674,
  1712339713,
  721420809,
  3178287609,
  1241795331,
  90136,
  1134127251,
  1198576123,
  1073803264,
  1073790976,
  808039927,
  1283094531,
  3490327296,
  1617109761,
  2232480751,
  2143858,
  1201170595,
  2282812293,
  1265942007,
  2015043591,
  3507038976,
  2145262947,
  2992340955,
  3659868928,
  132868325,
  537253122,
  3890569312,
  4160684072,
  671154005,
  537186561,
  602662902,
  102442880,
  33495275,
  3656794811,
  807141416,
  4282841087,
  3505399808,
  418073442,
  3656139451,
  2630172,
  4026616160,
  1264647411,
  1612343522,
  3574466291,
  2144935331,
  508755978,
  1264337306,
  858370770,
  688025626,
  570544387,
  856116057,
  133396442,
  108254232,
  587912221,
  3490464286,
  2145000931,
  856162339,
  1263763417,
  3489868032,
  537294873,
  3518579345,
  129200154,
  588043280,
  3508879902,
  3887144960,
  1746619208,
  1201170587,
  3504351232,
  587327402,
  1125345506,
  3889973144,
  84109600,
  1768018337,
  3516794123,
  578823664,
  423822893,
  1116931410,
  407099551,
  1116936539,
  1262147739,
  1763403803,
  671106968,
  3884830935,
  2648293,
  4276418559,
  3489998848,
  417884643,
  4276025343,
  3508411911,
  3557426995,
  26354304,
  3523625621,
  418081251,
  3540009619,
  654436221,
  569434129,
  101261952,
  89266283,
  3640672915,
  1776543603,
  408623339,
  3640672915,
  3002066797,
  3489672960,
  120842081,
  1260442904,
  1184655777,
  788555803,
  1776472099,
  1118541057,
  2466371840,
  413676316,
  3523232387,
  2600534040,
  3523363459,
  1259685472,
  2646019,
  4233818113,
  3574007667,
  1772120291,
  3490721536,
  1776418841,
  4233162753,
  3582396083,
  1746619149,
  1201170523,
  2680630,
  1201170779,
  3504941056,
  1242097456,
  1746010113,
  1771175960,
  671106960,
  3878146282,
  1343229324,
  1343229620,
  3942645788,
  16076,
  1343229372,
  1343229888,
  1343228540,
  1343228444,
  1783019e3,
  3342340,
  2015048489,
  721420336,
  4160737315,
  1768160205,
  2058722,
  1772093445,
  926948945,
  1075388992,
  3640672903,
  1898584770,
  1747479075,
  4026603609,
  2032925709,
  2124130,
  1633884371,
  1746627235,
  1258702744,
  1746534448,
  1612335877,
  4247713791,
  4160732664,
  392105,
  1187047403,
  1343229796,
  3489660952,
  1275901296,
  1826777603,
  1116930053,
  1749274897,
  1618169353,
  3489999616,
  1784684802,
  4239587327,
  1920148224,
  1805806059,
  416481312,
  4160709539,
  3178299313,
  1343228616,
  1343228600,
  308592,
  1292510721,
  1258976616,
  1490026674,
  3489802240,
  4160692481,
  906100095,
  3522440709,
  1099177568,
  2648171,
  1201189601,
  1187036528,
  1343228396,
  1343228424,
  536917264,
  4292933631,
  1241850624,
  1241871635,
  570515475,
  1112689412,
  1696228762,
  1187036432,
  1343228396,
  1343291392,
  1343303680,
  1259217440,
  1612363024,
  1746422541,
  102441936,
  1649959256,
  4196923391,
  1258955328,
  10164419,
  1124755481,
  1612325248,
  1133144090,
  1258709018,
  587536576,
  1615003840,
  1187036432,
  1073803264,
  1343229796,
  268464129,
  134227968,
  701712,
  4026605824,
  3172006855,
  3044035345,
  1276213274,
  3506907648,
  1225869840,
  1611752226,
  1629637136,
  1880760833,
  556289295,
  4160684072,
  594608103,
  996569963,
  620786987,
  2706187,
  1629290528,
  4245747711,
  2687008,
  4160696364,
  3178298635,
  1343229472,
  1343229376,
  1343228472,
  15834,
  5197,
  1343228540,
  1343229244,
  2013995616,
  1075492112,
  706749440,
  2992361748,
  1118009418,
  721345042,
  2286670094,
  3507176099,
  1118013643,
  1209257992,
  4208916479,
  1880909827,
  1896100865,
  4223989759,
  3171942432,
  3522898687,
  721455179,
  2294993400,
  704643100,
  1259000308,
  2144411098,
  3506514179,
  2010200321,
  2014982994,
  3506514435,
  1880766977,
  4288215039,
  4160693249,
  3890346895,
  1343229800,
  1343229376,
  898551,
  1057152,
  1310857,
  4286773247,
  3508546816,
  818085920,
  1229922827,
  4026609919,
  603978487,
  5972565,
  1263293666,
  1424103570,
  2031766347,
  3506711040,
  1787972170,
  570515482,
  2126106,
  817457179,
  822055681,
  2835423748,
  4208914433,
  755097635,
  1262604561,
  704674074,
  1245761795,
  1897753234,
  1746624538,
  2105920,
  2466335037,
  4207734785,
  807862304,
  578938854,
  5381803,
  3524018835,
  3640667008,
  721435521,
  990433541,
  856129571,
  2158198883,
  536903907,
  527154686,
  723467263,
  721475641,
  1227805175,
  824910347,
  4026597408,
  589888171,
  2323171,
  2105956,
  1294618153,
  1880765229,
  978929961,
  2250606054,
  2267383526,
  4026609696,
  2357913,
  858464545,
  587362329,
  871335779,
  2581475,
  576978979,
  926954318,
  1226797946,
  2153611294,
  2170388766,
  3684953,
  4202885121,
  555810851,
  861544963,
  2149217017,
  1709384510,
  1025894335,
  124468735,
  149803451,
  2281744,
  1209213343,
  4199542785,
  1293025312,
  2695692,
  4026609762,
  2161255,
  2695692,
  3884003522,
  3517328641,
  2105918,
  3883616523,
  15864,
  511,
  1343229364,
  1074085888,
  15980,
  4294935193,
  14629,
  15788,
  15800,
  16378,
  1343229621,
  16116,
  1267054064,
  1746010134,
  2416160901,
  3489809050,
  2953125888,
  1266793968,
  1117415538,
  587125240,
  1266614354,
  1117411506,
  1756615154,
  3589211290,
  1777420924,
  3521856145,
  1909249,
  1108557845,
  595644902,
  5990706,
  3521200794,
  3696887,
  4234344447,
  3489933312,
  822018104,
  4233951231,
  1773338629,
  721439856,
  586207241,
  414844434,
  755012097,
  1167622,
  1116818028,
  536926471,
  3888537888,
  1153537,
  1116818024,
  3003111426,
  3522440960,
  841566822,
  704673810,
  838980079,
  2449621034,
  654862626,
  3493151379,
  558891040,
  4268554239,
  2583822371,
  1214133068,
  755003418,
  547934465,
  1114178880,
  597705065,
  1112100186,
  1076429019,
  1616976073,
  1612712137,
  4267112447,
  1743617,
  1117408081,
  1213519878,
  1230326612,
  1625514144,
  4266326015,
  1751280051,
  3640672915,
  1629742982,
  654320385,
  2583773787,
  1262969315,
  1116955047,
  923287935,
  860618787,
  2583853083,
  3517727379,
  1773300083,
  3534242451,
  556269600,
  4160696356,
  2293291,
  843619075,
  1650682225,
  1760780643,
  1245736983,
  1184112641,
  578839266,
  1679949906,
  843710498,
  572485648,
  1083195402,
  155871269,
  1646330002,
  413819683,
  908093461,
  2416010214,
  3489677829,
  629204810,
  95250918,
  3523953331,
  1103053483,
  3687039,
  1103053486,
  2533507711,
  2550267911,
  3489874567,
  3523363502,
  3540009643,
  2449891,
  2016228684,
  3508153600,
  97059342,
  889261769,
  208748685,
  9005222,
  1745754225,
  3507372590,
  52103963,
  595616611,
  1671627099,
  1126000651,
  2187277,
  826811138,
  1126922253,
  1772318731,
  855742465,
  1746100643,
  1125646369,
  1292781155,
  891838480,
  573072099,
  1208693028,
  4026628139,
  537000255,
  3208671272,
  1881158731,
  1187047165,
  171066965,
  2656915799,
  179400496,
  3834380118,
  1343229244,
  268435201,
  1343229888,
  1343229636,
  122080,
  352336956,
  7710,
  963,
  5681,
  898416,
  4173920255,
  2686980,
  4160710656,
  1746992535,
  3178262821,
  3037733376,
  554519559,
  1208425891,
  4160714714,
  571342827,
  4026597409,
  1208285445,
  4182571007,
  1187036432,
  1343228540,
  1343229376,
  1797,
  499365136,
  721453019,
  1258672393,
  3506848408,
  856050436,
  721453019,
  4160737281,
  3172007897,
  1343229376,
  1343228540,
  1242346768,
  2144935251,
  3506907393,
  5972864,
  2224244745,
  4160696577,
  3172006311,
  3506776322,
  1208295936,
  808220634,
  4187944959,
  4290574335,
  1187047411,
  1343228540,
  1343229376,
  3044025088,
  493177873,
  1646491627,
  855735045,
  3623890303,
  1117401857,
  493015047,
  587364307,
  4160713507,
  536936399,
  1753473039,
  3490202251,
  2009210208,
  3523297931,
  1931616770,
  3640672907,
  536936459,
  721445411,
  3178287339,
  1343228540,
  2088941048,
  34765891,
  2093171482,
  68878351,
  2097365786,
  102464961,
  2105688851,
  1125188105,
  3125366304,
  3122331698,
  788640393,
  841797632,
  38358045,
  3826274,
  4160709347,
  671154105,
  1260048425,
  759130653,
  1243207976,
  1746075680,
  855722264,
  591355923,
  1259815837,
  1654874533,
  1243040534,
  595616291,
  1642266779,
  1633886976,
  4286511102,
  1755526463,
  425396653,
  1759731875,
  1625626973,
  3506908929,
  3154688,
  1626562740,
  4160713895,
  3187210349,
  3892077492,
  4285200383,
  1187047417,
  1343229376,
  1343228492,
  1343228540,
  1343228448,
  15895,
  15844,
  1343228700,
  5237,
  374128,
  4160636940,
  1755971559,
  293123,
  3640672921,
  570490905,
  4160684072,
  671154023,
  1241960457,
  1779648518,
  1754362147,
  449557211,
  4160708755,
  3178297453,
  1343229376,
  1343228540,
  5237,
  1258823936,
  492483856,
  1753380817,
  3490071178,
  570522369,
  3623889279,
  855971986,
  4160714714,
  3172007717,
  1343228540,
  1744980762,
  3037751641,
  1116340228,
  1749078289,
  3507365888,
  1763273114,
  3507110538,
  843841562,
  704673810,
  1775816704,
  1225859834,
  4160684178,
  3423271373,
  2215703535,
  1242478194,
  1116825618,
  721473809,
  570544140,
  1931102987,
  1943679494,
  1985622553,
  1989818910,
  2010788613,
  4277336063,
  4160702470,
  4085578667,
  3171977232,
  1343229244,
  537141248,
  1343228448,
  1343228540,
  1343228492,
  3037733120,
  4160702479,
  1209006457,
  4160692480,
  1208940917,
  721451587,
  578867203,
  43141900,
  554721306,
  4231460863,
  570444554,
  858325017,
  1879716136,
  1258844186,
  858325017,
  1879716136,
  3171971098,
  1343229528,
  1343229476,
  1343228600,
  1073848348,
  1343229888,
  1343229572,
  1258627712,
  3037725330,
  687890458,
  4160737283,
  4160748569,
  3172007879,
  1073848348,
  2013995616,
  3037732864,
  708853786,
  2992361747,
  1115912266,
  709024272,
  2295124237,
  3507104784,
  1208549409,
  4267374591,
  1225261090,
  4285853696,
  4161599487,
  3171950593,
  3522964033,
  4289001471,
  4293720062,
  1187047414,
  1343229800,
  1343228600,
  1310242296,
  1385664,
  90457780,
  1125515294,
  3506651950,
  4160692227,
  3187210751,
  1785096743,
  3491047936,
  789387711,
  503830546,
  2013777921,
  1713844225,
  771766785,
  1848037608,
  3489737472,
  3890428673,
  3489736960,
  822177806,
  3890035969,
  3522309632,
  666912358,
  46098486,
  3503637054,
  1187047384,
  1073840156,
  832784,
  537067521,
  4191877119,
  587473536,
  536870945,
  4160684114,
  3172007871,
  3037733872,
  415237659,
  4293720063,
  3171950592,
  537048336,
  4190042111,
  570827712,
  1712981339,
  587276800,
  1048593,
  4289263615,
  3187719440,
  650163571,
  91628545,
  4160692226,
  587594155,
  1181443635,
  2235869,
  2687011,
  4160692224,
  2016149397,
  3490005539,
  1746553603,
  43721664,
  3504947738,
  1187036531,
  1073840156,
  374128,
  4160684044,
  2752461,
  4160684064,
  570489235,
  1123076,
  4160684048,
  4160749433,
  3178299345,
  3037733872,
  415237659,
  4160692512,
  536936423,
  3044064528,
  786437,
  4289918975,
  537002025,
  4185454591,
  587473536,
  2105600,
  4160684114,
  4160749405,
  3178299317,
  3037733872,
  415237659,
  4293392383,
  3171950592,
  1266819712,
  72529392,
  1249992730,
  1746010118,
  2961506317,
  3560507282,
  1249779715,
  1283410302,
  1249861649,
  1249861648,
  1738688639,
  989805311,
  1818255362,
  3506192912,
  5382784,
  1705141282,
  1611745914,
  687892561,
  545315580,
  1612185920,
  4182702079,
  1266033153,
  1612325153,
  1620718179,
  47325866,
  1249075418,
  1746493457,
  3673958656,
  1611866888,
  1675830016,
  570499970,
  1700987163,
  1612335981,
  1818370818,
  3506192922,
  71311488,
  4180604927,
  1265181196,
  1658462592,
  854936424,
  1612329727,
  1265050113,
  1612335207,
  4160684361,
  1265040095,
  1139499038,
  3506440091,
  771761408,
  4160737281,
  1281555119,
  2116450,
  4160710681,
  1264711847,
  1746476448,
  4171429887,
  1281304065,
  3491704064,
  572542814,
  3670049,
  4265537536,
  1891312416,
  637608704,
  2846971,
  2466463795,
  3490136629,
  3670049,
  824189463,
  4026544137,
  637599277,
  1899700993,
  1929061120,
  3971843,
  3506973440,
  1330577441,
  3689039,
  4160631049,
  1263467921,
  128671867,
  555209743,
  1313620849,
  1246507273,
  409010224,
  4253349886,
  1246448458,
  1246453786,
  1263231059,
  1263231091,
  3506449665,
  1296708356,
  1626098250,
  1330258944,
  1263165739,
  1613365281,
  570515627,
  2483036992,
  4160618552,
  1313275221,
  2162722,
  2483036992,
  4160618544,
  595656013,
  5963809,
  2200633400,
  4245878782,
  2171776,
  3145819,
  4160652075,
  599850251,
  2200633435,
  1262105601,
  1490026658,
  3489802240,
  4160626944,
  872545535,
  3522440197,
  536890165,
  1261789291,
  1854005,
  855900185,
  1116954632,
  587846138,
  855861091,
  990603171,
  4160709667,
  1261435395,
  1692617263,
  1612335919,
  1244603168,
  1244618771,
  4160643091,
  1187052517,
  1073799168,
  1074184192,
  1074135040,
  16429056,
  1073774592,
  1073786928,
  511,
  1073786940,
  1073889280,
  1073905664,
  1073917956,
  1073782844,
  1074102272,
  1074110508,
  335556608,
  1343225856,
  1343229796,
  1343229621,
  1073741888,
  80,
  15897,
  1343229212,
  1343229464,
  15836,
  4021,
  1343229520,
  16184,
  1343228580,
  15852,
  1343229528,
  5929,
  15972,
  1343228396,
  15952,
  1343229800,
  2933,
  1343229844,
  1343228424,
  5901,
  1343291392,
  1343291524,
  536936448,
  70640,
  1343291536,
  3758154368,
  3758153984,
  3037743874,
  1763272920,
  4271437823,
  1074102272,
  3052882724,
  1260677146,
  1612343428,
  1776615426,
  1768108585,
  510556178,
  2449555486,
  3491047936,
  3489869312,
  4160684064,
  3187144973,
  425290146,
  3640672913,
  754981589,
  1789120756,
  2031831575,
  1523777576,
  671106968,
  3891187948,
  4241684478,
  1772251489,
  471360,
  1116826083,
  1430290,
  1074601561,
  3506455050,
  771751965,
  1776406787,
  4160711200,
  1780742547,
  1748597050,
  4026538392,
  3889757451,
  3342365,
  1118516032,
  2634142445,
  1187047403,
  1343229796,
  3489660948,
  1084,
  439800,
  4238800894,
  723482883,
  3768635392,
  1263888389,
  1117415466,
  3768242176,
  721451883,
  3767980032,
  863992617,
  1075445770,
  3489677849,
  2074861711,
  722418433,
  3767195904,
  1263291467,
  1751867427,
  1756061795,
  2079023267,
  3489803011,
  1986163682,
  654341794,
  723743527,
  3625504839,
  3493538586,
  721672205,
  722653265,
  1119604773,
  587321434,
  855929635,
  857437155,
  587232867,
  723247196,
  723439708,
  2675187,
  4237883391,
  724230154,
  3624652841,
  3492883237,
  724050177,
  2675175,
  4228446207,
  4160618544,
  3187211733,
  3505007407,
  3504876341,
  556066779,
  4160702509,
  555350909,
  1210843140,
  406847522,
  4235587584,
  1885545344,
  4160684072,
  3890609233,
  1210392836,
  4218222591,
  1610818307,
  553838580,
  554493913,
  4160702496,
  571276131,
  4026550560,
  3890871421,
  1209803016,
  4217042943,
  1226646024,
  554887157,
  4160702488,
  2227027,
  822944274,
  4234997760,
  1986491367,
  3889526439,
  2144476642,
  3500943872,
  1931616769,
  1944197266,
  1986146872,
  3886315171,
  2095784451,
  721567763,
  872927647,
  2011380481,
  1275651995,
  2105603,
  4246534142,
  553844768,
  4160630828,
  3886021911,
  1128420181,
  1343228540,
  1396855637,
  1343229376,
  16192,
  15883,
  15875,
  1258927376,
  1784302601,
  2014458409,
  3506448896,
  1242057735,
  474507281,
  1611688665,
  1658461258,
  1201687045,
  1187036432,
  1343228492,
  4145,
  4537,
  1343228448,
  1343228700,
  1269478903,
  2466342939,
  3556770779,
  4089438344,
  1336381279,
  3678464,
  4160627713,
  1319501251,
  3154176,
  4257150974,
  481501471,
  1252161500,
  2010913979,
  1406995,
  1117863961,
  3768766720,
  3506448642,
  687923402,
  828428631,
  3511960075,
  721465947,
  3725900,
  4221368318,
  489579,
  721840134,
  721997837,
  721473598,
  2150879557,
  2297108772,
  3707781795,
  1899692067,
  4235655166,
  2288574538,
  721553923,
  721670157,
  721539094,
  1267388723,
  1746478098,
  3505006848,
  3145762,
  4224380928,
  2998986725,
  3508938752,
  1759071107,
  2022406348,
  1125909028,
  3891253467,
  671134400,
  1266601999,
  1754997762,
  805390232,
  2015043139,
  3506645760,
  1882469123,
  3888803955,
  872567603,
  604301299,
  3889777014,
  2103135092,
  3888148531,
  721778771,
  722063364,
  4160671800,
  3758882109,
  1456677634,
  721455185,
  1265425911,
  1972961336,
  1231899244,
  4227659774,
  1265377920,
  1696203410,
  115055361,
  637588746,
  1332290561,
  755002813,
  772460548,
  3766669312,
  1704807268,
  81500929,
  4160673029,
  578879423,
  51530592,
  603481370,
  10197505,
  3490202138,
  1830505309,
  3674221312,
  578871422,
  101862233,
  3187107098,
  671119504,
  1263718404,
  2036033755,
  3518907011,
  4287035390,
  4225562622,
  2291394504,
  2102479436,
  3501467904,
  1108025854,
  1762841009,
  10203867,
  671111320,
  1749274795,
  3507759872,
  2016092768,
  3517202963,
  168986794,
  2992361889,
  3667798784,
  738228332,
  3723675,
  4209440766,
  1612474371,
  1896030978,
  2746196,
  671106968,
  3890598302,
  704678034,
  713084993,
  1228263520,
  687897929,
  3884241152,
  10504504,
  1745246272,
  1118992566,
  872534068,
  3522571269,
  2020206457,
  3490326785,
  3489671427,
  2288772979,
  3489671936,
  553838447,
  4225431550,
  2288773038,
  3489671936,
  499312487,
  704806866,
  4160673794,
  3886283959,
  2009280514,
  1110239136,
  553766923,
  1260482042,
  1704738850,
  508758128,
  1135690138,
  4226217982,
  6570917,
  3882235393,
  4281399294,
  3204993,
  1108550240,
  3880046592,
  721465947,
  2020334279,
  3489671936,
  2288772925,
  3489671936,
  2297227065,
  3489672194,
  620881717,
  2143498247,
  1117585464,
  4160635309,
  1745091195,
  1612530285,
  3874058500,
  3890020408,
  1343291544,
  1343229800,
  1343229844,
  1343225856,
  1343228396,
  16178,
  1117,
  1343228356,
  1343303680,
  1343291392,
  1343228424,
  4160664848,
  3172006877,
  1243264504,
  1612335898,
  2232480751,
  4089427570,
  1276677983,
  925368359,
  3000924219,
  3507694336,
  2282812293,
  2232480751,
  4089427570,
  1276284767,
  925368359,
  721451067,
  573100051,
  1208942625,
  4203409408,
  3758518334,
  2171432,
  4026550283,
  587266691,
  4085608507,
  2131984,
  4249548798,
  4085639122,
  3206580240,
  1187047374,
  16076,
  1343229372,
  1343229888,
  1343229572,
  1343229324,
  2416031223,
  4195809278,
  723548419,
  3768504320,
  1263757318,
  1117415474,
  3768111104,
  556289105,
  808189984,
  4275763198,
  1746094671,
  1611873025,
  1659070578,
  2050188514,
  1263309568,
  1612355840,
  1918509568,
  1616523777,
  1914267954,
  1671586786,
  2246292,
  844196209,
  2083546145,
  578777104,
  1073911808,
  671620688,
  3765491968,
  1128407043,
  2054637631,
  1118788741,
  620810593,
  1616713856,
  2017491011,
  2990538765,
  3674220544,
  1760755741,
  3512091307,
  412764982,
  2023201536,
  3507038978,
  1773291104,
  4227266558,
  4236310526,
  4160657409,
  3187145539,
  3494326016,
  860880931,
  2322463,
  637608450,
  1880765266,
  1918782248,
  3492293888,
  1244220200,
  1646486627,
  5972864,
  587227619,
  1633903266,
  1638222373,
  1227161632,
  4178376702,
  1755526463,
  425396653,
  1759731875,
  425525306,
  1625629448,
  1109344282,
  1260310531,
  1625055843,
  1209919436,
  1650488486,
  1623351428,
  4193581054,
  1209722820,
  327713,
  891833113,
  573072227,
  2016096556,
  4191219712,
  3208671278,
  570615734,
  2600525828,
  3500878594,
  1258824195,
  553803866,
  4160636941,
  553843343,
  4160636938,
  3886414475,
  1126158603,
  1343228616,
  1343229616,
  1343228600,
  16044,
  1343228100,
  15856,
  2837,
  15895,
  1343229528,
  1343229476,
  1343229572,
  2885,
  1275704688,
  1688226569,
  2181129,
  1667432453,
  573060392,
  2016096556,
  4187287552,
  1881677825,
  877903680,
  3178262560,
  1343228616,
  3673,
  1343229572,
  570434496,
  1620706651,
  1225083396,
  1728538,
  1611739892,
  1620713985,
  1187006320,
  2032384,
  50332184,
  4160730384,
  536936427,
  3187719440,
  587276960,
  89306384,
  1750229075,
  536889858,
  4160643091,
  3172006925,
  335552512,
  308728,
  2031637,
  1119098950,
  583062021,
  43141900,
  1108568091,
  31872e5,
  1109139051,
  456380680,
  3540337323,
  3735584,
  4200527871,
  3890878820,
  555745312,
  4200134655,
  22750080,
  3890354404,
  1073840156,
  374264,
  262159,
  460920966,
  1119099145,
  583062021,
  43141893,
  1108568091,
  31872e5,
  872480800,
  4200200191,
  3891148031,
  1073840156,
  3052413697,
  1113305221,
  2151395075,
  570434496,
  1620706651,
  1822059162,
  1633296902,
  47325920,
  570515482,
  1629113375,
  1747345562,
  3285900,
  1134175620,
  1125457923,
  4222679038,
  2466325250,
  1613046656,
  1617232155,
  1625645221,
  3523033857,
  570696448,
  1572889,
  4187289599,
  554181388,
  537019293,
  4160635661,
  2567043993,
  3507890433,
  1613111820,
  1133928550,
  638058547,
  1621508894,
  1625694210,
  4220188670,
  570565376,
  3670041,
  4185454591,
  1258562048,
  2953142298,
  587316720,
  1187047373,
  1073872904,
  1073840140,
  1258758288,
  3037724800,
  4160643096,
  570489739,
  1616530180,
  1633312986,
  1650090458,
  3171967706,
  1073799168,
  1073840128,
  4160730384,
  4160749545,
  1258618769,
  721446939,
  4160671745,
  536935693,
  1187036432,
  1343229796,
  1244378616,
  1611877163,
  1611876907,
  1261117954,
  1108568091,
  554029064,
  1612270377,
  102441936,
  1679450906,
  1679434240,
  5972936,
  3523033857,
  604578e3,
  621027840,
  100671745,
  989921323,
  1753469437,
  140196865,
  416432139,
  3522505728,
  3642960388,
  4160693952,
  4160749487,
  91684695,
  583018240,
  1748197559,
  1133726998,
  1125364450,
  587292723,
  1622343721,
  4160684088,
  570554685,
  2630140,
  4026548818,
  1259337779,
  1117284379,
  595644424,
  26948672,
  3521200796,
  532736,
  4188338175,
  4276680703,
  1186870529,
  1187006248,
  1073799168,
  2097728,
  1073803264,
  1074184192,
  1073840140,
  537140992,
  537141244,
  3037743877,
  1624777226,
  1208246553,
  4160637188,
  3207658011,
  1187047421,
  1074102272,
  7065,
  537141248,
  403289392,
  3758902621,
  3121838084,
  103039068,
  6562568,
  1080873728,
  3522837249,
  1080164882,
  1116221441,
  470866928,
  3039870256,
  1547911753,
  169619969,
  3506782637,
  822194781,
  1101683780,
  1566776084,
  889279827,
  822202875,
  3174093295,
  705185412,
  3027292986,
  973201436,
  1417895051,
  1180750331,
  1187006320,
  705185412,
  440652590,
  3522299803,
  436843632,
  138615813,
  1548014338,
  805400580,
  3540125827,
  2147768900,
  403255298,
  424811053,
  3540204048,
  3229141368,
  3539679760,
  3540059986,
  3222849816,
  3540058194,
  3221801224,
  5427209,
  2282476292,
  3489955843,
  805449986,
  2014040065,
  3161485315,
  1198540384,
  9609993,
  855710363,
  1187006232,
  1904441739,
  1900247371,
  1896053003,
  1891858635,
  1887664267,
  1883469899,
  1879275531,
  1198540384,
  2999535236,
  1125712395,
  1187045393,
  705185412,
  138662698,
  1879167745,
  2999529473,
  1125712395,
  3540060291,
  805470209,
  437995107,
  3121289426,
  470500121,
  3540466192,
  470594608,
  1186995213,
  974176314,
  3157316348,
  3539994450,
  5423114,
  3221410560,
  5427206,
  2147603202,
  805490690,
  1879166976,
  1198540384,
  446407429,
  855710363,
  1904297752,
  1895919937,
  1887531201,
  1879142465,
  1198540384,
  79764919,
  1174975749,
  3171567130,
  37752258,
  604047936,
  1126172132,
  3000118015,
  1111546112,
  721304065,
  981389825,
  671106928,
  3573564960,
  981353024,
  847249554,
  264521584,
  3573811172,
  3489672448,
  1111502849,
  973198339,
  3490846720,
  847369723,
  813748481,
  813748741,
  755028483,
  4247567,
  721304065,
  838982150,
  172023047,
  1125123538,
  1198539552,
  96477439,
  536930298,
  101009264,
  172020205,
  3890938496,
  336376451,
  335823715,
  1131197069,
  2995001627,
  69550956,
  421202980,
  336139264,
  46154568,
  1124927193,
  406851929,
  4343664,
  3489730066,
  3506514687,
  96472512,
  236060746,
  721408001,
  231330049,
  570492361,
  3557376065,
  3573563457,
  1116226130,
  3674266626,
  1112678912,
  1198530064,
  407454465,
  671142136,
  3891714808,
  3037733120,
  4287035391,
  864157715,
  1141560336,
  3674683927,
  3709413895,
  1137252289,
  130031617,
  3171958856,
  706757202,
  572578560,
  3171959056,
  3171950592,
  3037733120,
  4285331455,
  82954,
  974640366,
  1136778222,
  3706268168,
  3171958928,
  3039830528,
  3573950720,
  1124403149,
  973146184,
  570482704,
  374064,
  3491054349,
  369891277,
  3506782892,
  239337929,
  29377313,
  3891671559,
  524293,
  842875474,
  553705476,
  572372272,
  620763730,
  4283824127,
  553696560,
  671135024,
  572447477,
  130357842,
  3891464256,
  1185162496,
  687923213,
  3758480386,
  3657640448,
  1115626377,
  3758168338,
  454171017,
  1130841700,
  3406830528,
  3523217508,
  1174811905,
  1175404846,
  140788015,
  3049277296,
  4293064703,
  4293326847,
  327603196,
  282203023,
  1129792342,
  1130841700,
  322900790,
  428415936,
  3049307584,
  4291885055,
  4291950591,
  687920124,
  428465154,
  3758168850,
  420617097,
  274993270,
  3891122677,
  555267376,
  4285134847,
  153373789,
  3674020608,
  3573356800,
  6619266,
  553666643,
  3674358434,
  1111497554,
  13821946,
  604087125,
  4291164159,
  570437897,
  620765952,
  4161597440,
  4277008383,
  4275107839,
  4161204224,
  3036735375,
  4292409343,
  3170911752,
  124003329,
  3691201184,
  1117799012,
  1198578944,
  1198522400,
  4160730480,
  3784114121,
  555267376,
  4281464831,
  1245451265,
  348734289,
  273232129,
  21148674,
  1128351801,
  1211701842,
  2739413248,
  4160701388,
  1141440400,
  3882138628,
  4160730416,
  130723,
  1228133397,
  4276025343,
  3540062289,
  272642305,
  1174516738,
  10177326,
  449386688,
  2738561536,
  4160701396,
  1175584648,
  1293316,
  587196233,
  3039881211,
  4292933631,
  3691653958,
  726024795,
  1210375174,
  822625112,
  436736265,
  3879215621,
  587154368,
  3039881013,
  4269078527,
  4268685311,
  4268816383,
  21561664,
  308549844,
  3557438465,
  3657767636,
  1092633188,
  3540790300,
  3758757824,
  740049185,
  671142663,
  1209260547,
  1078466505,
  399040531,
  570482705,
  3657574400,
  1112097344,
  2735557133,
  4160693249,
  1175519046,
  411322890,
  444912130,
  446747648,
  570439681,
  1187047169,
  326016436,
  5909,
  372130559,
  748557770,
  93569721,
  23258160,
  1686629713,
  995675660,
  526087672,
  267050316,
  134043372,
  67087032,
  33551700,
  16776876,
  8388564,
  4194300,
  2097148,
  1048576,
  524290,
  1179625964,
  1179625965,
  548494836,
  269846812,
  134392900,
  134392901,
  67130724,
  33557164,
  16777556,
  8388652,
  4194308,
  2097156,
  1048576,
  524288,
  524291,
  1079069369,
  398767472,
  236060738,
  721408081,
  399364178,
  236650571,
  738185297,
  1320407122,
  1076969520,
  1127233025,
  1080050481,
  453001321,
  446503753,
  3557628628,
  3657968670,
  1258784,
  1084882954,
  3758833953,
  532992,
  1302538,
  3758563840,
  3673632030,
  144416,
  1093157026,
  3491305536,
  3489861569,
  1112687552,
  805425408,
  1118837174,
  412275204,
  989937984,
  3556393648,
  3540125760,
  704655361,
  738119689,
  130667018,
  98255880,
  3178251288,
  3506186752,
  138471394,
  3891396672,
  130603521,
  34127216,
  96481535,
  975224176,
  3886815506,
  1143079442,
  992012201,
  3886815579,
  1143669275,
  1187047337,
  1174582656,
  265437258,
  1184237522,
  4784192,
  3493662210,
  3493604095,
  3493596683,
  3493538815,
  1065359575,
  34144768,
  172558912,
  1184110658,
  164301250,
  1128809306,
  3540126866,
  3556780032,
  37958145,
  38931904,
  1147148416,
  3507359169,
  3526045694,
  3540058203,
  805425157,
  100611841,
  1148208184,
  805420416,
  4196416,
  922871798,
  3524472830,
  3540125760,
  721432577,
  436195333,
  96417537,
  1148208184,
  138460544,
  3891658816,
  34748944,
  990963648,
  3888185883,
  922868242,
  805490958,
  671288768,
  3758477578,
  922868234,
  805425414,
  3489861056,
  96477185,
  3179299952,
  3179300464,
  96477439,
  3179299952,
  604091760,
  98845286,
  173146698,
  164840226,
  103622096,
  1718314542,
  3002273222,
  171967040,
  231293728,
  171327566,
  1865222134,
  687911625,
  704630832,
  721473580,
  738185273,
  442224682,
  167850877,
  201933673,
  1311680,
  453264204,
  1131156132,
  55120932,
  252451081,
  822464776,
  3540977932,
  41945289,
  440419153,
  3758674954,
  822686465,
  3540322636,
  37751049,
  440419153,
  872535040,
  3523816446,
  408946137,
  3178240384,
  3507235839,
  96477439,
  3178251056,
  475650810,
  241291525,
  536990467,
  1127220672,
  3194224,
  1187036528,
  4305936,
  34198074,
  570493513,
  411633106,
  3493465538,
  3493210879,
  273822333,
  4838144,
  223061018,
  164125924,
  1130382176,
  1130369792,
  35918656,
  883563044,
  1128267808,
  168496064,
  318784344,
  356533088,
  1130568228,
  1575899,
  38355776,
  289413640,
  31146820,
  806360032,
  1141051776,
  1176294150,
  1130643812,
  453575689,
  855757824,
  416286162,
  1198570512,
  3489926665,
  96475072,
  230746104,
  264300539,
  3891464128,
  3150568177,
  2543756976,
  2189855633,
  2147483648,
  8388607,
  604091888,
  1080231908,
  1187045377,
  218936816,
  510005199,
  461964598,
  3540190564,
  1111507913,
  822203136,
  3489860964,
  183901286,
  467980295,
  8331264,
  126426233,
  1015026313,
  220005156,
  510529503,
  463144246,
  3540190573,
  1112687579,
  855757568,
  3489860973,
  183901294,
  468570119,
  8331776,
  127605883,
  1031803547,
  456065837,
  3562543974,
  773867172,
  924899910,
  1086062612,
  1086128157,
  1093878002,
  411058986,
  264978777,
  1137299461,
  570442688,
  1095778916,
  1180844369,
  3509062989,
  3506900237,
  3491702784,
  1094719780,
  973160777,
  3505982733,
  3540385892,
  3540004865,
  738210049,
  138465537,
  973144128,
  479515659,
  3506703076,
  1141966098,
  1142491099,
  131710448,
  1125731104,
  131719168,
  3186630656,
  3520932096,
  3520801792,
  838974960,
  138414022,
  1126696909,
  771754057,
  3889811681,
  3660131900,
  926957088,
  1086062612,
  604098560,
  1125400818,
  1085997082,
  399721244,
  1185736620,
  3657969440,
  276e3,
  868532,
  1090011317,
  1126711609,
  792520613,
  1059117580,
  276032,
  3489677492,
  1090003969,
  541444,
  1124876465,
  3890878401,
  1638416,
  3885245440,
  2146435072,
  218936816,
  87432806,
  182852489,
  224658788,
  476434434,
  3489925869,
  553721856,
  1015022857,
  1185153828,
  510070044,
  467338559,
  90442471,
  3489795428,
  183311461,
  570478596,
  85664513,
  52706432,
  1147420791,
  2995041431,
  1131721366,
  1132334087,
  1131351061,
  1130934912,
  3540129846,
  67117057,
  70260799,
  419433525,
  1183072637,
  2996482696,
  202130256,
  203375458,
  2995667836,
  429015934,
  637653762,
  430179382,
  202834966,
  1097275446,
  2994846721,
  1129427610,
  1130499076,
  1130105883,
  1129886336,
  3540129810,
  67117057,
  68163620,
  406850579,
  405619043,
  536887646,
  3154526535,
  2996023944,
  202130264,
  202523491,
  2995340116,
  408634193,
  553767682,
  409207817,
  203031577,
  1096947721,
  1096161389,
  1095180288,
  49921048,
  1125191026,
  225051376,
  49103632,
  3506638090,
  1094719853,
  989937993,
  463162898,
  1119027318,
  7197198,
  805425927,
  1097934336,
  1127564902,
  138465537,
  85655616,
  132389065,
  3186639905,
  855759371,
  805425414,
  822202628,
  3489729871,
  3891398729,
  536872929,
  906083824,
  536872241,
  59371,
  1023,
  219985392,
  88022631,
  182918107,
  224658788,
  476499970,
  3489925878,
  587276800,
  1015022875,
  634389284,
  637535789,
  1714308086,
  1718487326,
  435556302,
  4802228,
  3489795407,
  183901310,
  536924163,
  1061167360,
  457048895,
  1152647350,
  92225281,
  139008969,
  906063662,
  43780214,
  1126501781,
  334316405,
  330122101,
  275592449,
  460719094,
  46969868,
  1126960453,
  2998121122,
  203899738,
  204817275,
  2997109615,
  421217132,
  604099330,
  423560228,
  203228188,
  1098717348,
  1097668900,
  2995886592,
  1130476204,
  1132203031,
  1130302507,
  1130017426,
  3540129956,
  68297217,
  69343423,
  408030243,
  2617327995,
  421217132,
  31002194,
  21250826,
  2994805408,
  1129427634,
  1129976835,
  1131613238,
  1131917959,
  433199062,
  1098786560,
  429589558,
  202769431,
  1096685695,
  418190963,
  637534707,
  1098199936,
  3506835369,
  174653540,
  173737448,
  3523822360,
  570744879,
  864044180,
  178864501,
  177931688,
  3542500120,
  1095319872,
  2583692324,
  891649,
  459555669,
  451167043,
  2995171989,
  202851189,
  201540478,
  2995929951,
  414597978,
  570544898,
  415171602,
  204670002,
  1098586450,
  1100759634,
  3556912128,
  805380608,
  138428753,
  1125124042,
  2952923209,
  131548770,
  1264128146,
  1264130258,
  3523429018,
  411632914,
  3186629065,
  704651264,
  3791873,
  855752176,
  3891594521,
  553703943,
  264888327,
  223479753,
  315215875,
  1229905921,
  536872201,
  1187006320,
  3539075146,
  973147474,
  1117408072,
  3052458730,
  453575956,
  3540060242,
  1095309312,
  416417947,
  1184105746,
  206218305,
  151739554,
  1129530195,
  1129517851,
  34739035,
  1252050,
  190530395,
  1130563660,
  1129518043,
  855709147,
  449974363,
  449973267,
  1130037267,
  226755209,
  2995602209,
  1131786910,
  1132334095,
  1130302491,
  1130148492,
  3540130102,
  69477377,
  70523199,
  425987123,
  27083131,
  1126960804,
  2997171232,
  337920853,
  204292948,
  295967076,
  454165458,
  2995696277,
  202851189,
  202130302,
  2995995495,
  418792291,
  587322114,
  419365915,
  204735539,
  1098651995,
  1097079003,
  587208923,
  2996715875,
  2996650870,
  1132268575,
  74204031,
  430181357,
  33964413,
  456525967,
  125649327,
  1097730294,
  2996155060,
  339166060,
  202523517,
  2998289239,
  401228630,
  637540781,
  68305266,
  70129855,
  422972458,
  839401850,
  3524858194,
  94112413,
  420485073,
  1147224425,
  48624,
  1021,
  2046,
  2047,
  3604999160,
  3099510221,
  2762517938,
  2509872288,
  2324533138,
  2172880264,
  173883730,
  399574492,
  1095571732,
  1130561579,
  1131852454,
  203928226,
  1132413818,
  198313041,
  1098520969,
  416422098,
  1112081792,
  3556917648,
  872489728,
  140525917,
  132974697,
  1147224872,
  3050356208,
  3050364945,
  5001139,
  3489729892,
  3506586300,
  218701824,
  6030601,
  3489729892,
  3506586300,
  219881984,
  637601051,
  3557572683,
  3573563467,
  1117340278,
  1116786947,
  3540113411,
  3690997248,
  506479222,
  1124842960,
  1124276443,
  3505734419,
  3673565440,
  1178920948,
  1180059213,
  3035645535,
  3169863536,
  1185498784,
  1186678450,
  1180845936,
  1184156184,
  704661082,
  3758414624,
  3390588514,
  687883924,
  415291930,
  1180385633,
  1180451131,
  1179795636,
  1126318330,
  1179469380,
  1097548130,
  1184450192,
  1085490731,
  1090273597,
  1179796252,
  1101153883,
  1183990187,
  1198540443,
  1101077184,
  1094403659,
  1085556300,
  1090143810,
  1179927330,
  1096959581,
  1183990123,
  1177241243,
  1094533299,
  1125925116,
  1179338306,
  1101742498,
  1184450192,
  536889200,
  1198530816,
  3036684800,
  4026544672,
  587818,
  570473728,
  841004288,
  4163956736,
  3170893832,
  3036684544,
  4161073152,
  553705502,
  3571848643,
  1183626512,
  4200387,
  3490319874,
  3490458367,
  981409361,
  440403465,
  448807e3,
  117444865,
  536928287,
  196609,
  1138277648,
  3171959769,
  3036684800,
  4161597440,
  1117394890,
  3170947328,
  553731032,
  1078003657,
  570473728,
  3569227019,
  1184150800,
  4172869632,
  872485908,
  553703936,
  1147279307,
  3557571124,
  3657902604,
  1083244548,
  1112686736,
  1087648288,
  3171959585,
  1138312152,
  841006352,
  1175245831,
  1112686740,
  1091645984,
  1126187216,
  572688,
  840964041,
  1112724483,
  1091580448,
  1621264,
  3171942425,
  131796931,
  235536449,
  721408007,
  151638024,
  411650621,
  121651993,
  1656688,
  1198530560,
  415844666,
  4909050,
  1262030162,
  3709016786,
  3659410175,
  264963538,
  1125779419,
  255852739,
  172557065,
  1125139208,
  3540058203,
  805425153,
  138626928,
  1198576379,
  264818690,
  1198524352,
  319947530,
  3522703873,
  705105730,
  570544629,
  587194368,
  33558472,
  96475264,
  553666416,
  553648138,
  553705476,
  398524426,
  570482691,
  3758433024,
  399188480,
  1079591e3,
  1100552896,
  1276949808,
  687872674,
  119043,
  536924176,
  357317152,
  3523531026,
  402668033,
  223101257,
  1276498938,
  3523494562,
  411632914,
  415827931,
  1137884464,
  536874322,
  3891601664,
  973198339,
  1095309312,
  839636475,
  180356420,
  1126696269,
  6556361,
  604033027,
  1096892768,
  3554732001,
  3891791940,
  2047,
  939524096,
  2146435072,
  896,
  1074,
  2046,
  265030922,
  85663315,
  89266889,
  1137300227,
  3540009536,
  223490305,
  475254787,
  3490122459,
  536877842,
  476119140,
  310970249,
  51526272,
  449989474,
  839010160,
  705483813,
  621926940,
  727725,
  839401771,
  406791,
  1083195630,
  1127301265,
  1130614e3,
  587207962,
  1129660762,
  1129792342,
  317981375,
  427165046,
  401424743,
  461379967,
  1198539193,
  536879628,
  4790217,
  84488449,
  34203611,
  1125715459,
  1112736256,
  3557306912,
  1092157452,
  1087914132,
  570442528,
  1095844176,
  542576,
  991958985,
  3589354016,
  553656320,
  1198531072,
  4160730608,
  4026596950,
  1183119389,
  4164874240,
  1180742659,
  4166578176,
  4160732172,
  3832872528,
  4160730608,
  4026596934,
  4026595341,
  3758553135,
  4160730608,
  4026596926,
  4026595333,
  4160747589,
  3186687550,
  4160730368,
  2754740095,
  4288149503,
  1294803968,
  131223085,
  1140249346,
  1097220717,
  3523477586,
  1185105570,
  1186023080,
  1184948227,
  1185564321,
  2758756019,
  654395044,
  4160693791,
  922877483,
  790707713,
  3170947577,
  2995013209,
  1131197069,
  1131746310,
  1130238987,
  1130017410,
  401217709,
  1137891072,
  414581778,
  204145706,
  1098062098,
  1179207232,
  396034205,
  1126829970,
  1100562832,
  3875283518,
  2995013193,
  1131197069,
  1131746310,
  1130238987,
  1130017410,
  401217709,
  1137891072,
  414581778,
  204145706,
  1098062098,
  1180255824,
  396034205,
  1126829970,
  1096368464,
  3873317438,
  1023,
  2649771451,
  922113733,
  20861,
  1335578,
  690309,
  1647099,
  4160730608,
  1296104902,
  1076625420,
  1118621697,
  218747138,
  536872201,
  1076625436,
  1118621697,
  219926786,
  570426651,
  49096192,
  3573820160,
  1080763906,
  3556786281,
  424624758,
  1117377796,
  906091788,
  3758309481,
  3657908923,
  1080770049,
  1048583,
  983098,
  3866649,
  704689216,
  721473807,
  6082570,
  872486244,
  5034249,
  872486244,
  956420354,
  3758242561,
  553656320,
  4160741422,
  574553009,
  4261672959,
  1183532674,
  553656320,
  570508928,
  1183909778,
  1185195037,
  639575809,
  4253153279,
  1040267009,
  3522768673,
  1179862602,
  604060172,
  654313316,
  1771602,
  1100207109,
  1098455296,
  3522627684,
  1096015876,
  1102650112,
  3522234468,
  273221582,
  1127221312,
  771800128,
  1275711498,
  3573632265,
  1139622884,
  3506505718,
  1097406720,
  1097406720,
  4160692797,
  4160749136,
  3186687308,
  2146435072,
  2287612045,
  843314856,
  1639665513,
  497837829,
  2520805041,
  263043836,
  2869681010,
  133525158,
  3852451129,
  67021686,
  3130483275,
  33543515,
  3722155222,
  16775850,
  1458498141,
  8388437,
  2864150382,
  4194282,
  1431681980,
  2097149,
  2863312350,
  1048575,
  4116010351,
  524287,
  4272597675,
  262143,
  4292171093,
  131071,
  4294617771,
  65535,
  4294923605,
  32767,
  4294961835,
  16383,
  4294966613,
  8191,
  4294967211,
  4095,
  4294967285,
  2047,
  4294967295,
  1023,
  0,
  512,
  0,
  256,
  0,
  128,
  0,
  64,
  0,
  32,
  0,
  16,
  0,
  8,
  0,
  4,
  0,
  2,
  0,
  1,
  2147483648,
  0,
  1073741824,
  0,
  4160730608,
  2757033479,
  4263507967,
  3657705728,
  1294027808,
  1097406720,
  3020175873,
  2790401793,
  587276800,
  3459254171,
  453002932,
  3557507497,
  908083838,
  1094516765,
  1085538332,
  1090387990,
  1096958772,
  3758178667,
  1097406720,
  922830438,
  3521654561,
  2996744837,
  336020341,
  202982270,
  2995012431,
  401687372,
  603986230,
  67715425,
  70523007,
  425987121,
  262422905,
  1126170760,
  411047817,
  3154395481,
  842941010,
  4253022207,
  48624,
  4101234283,
  744261117,
  5223920,
  360698448,
  922865742,
  4160737359,
  3020225971,
  230818377,
  37765905,
  2787845889,
  570443444,
  1115562752,
  865824,
  803133,
  409780,
  1127497982,
  1095582020,
  3506769838,
  2687008,
  3459270246,
  1101732626,
  1151607816,
  790705921,
  9032167,
  403837065,
  3162521931,
  3423839255,
  1131951873,
  1132217209,
  315163983,
  432019405,
  44515689,
  399316388,
  1097603529,
  411047901,
  1097613657,
  399319614,
  3490202284,
  118360320,
  151601968,
  1127286566,
  973345060,
  4160743411,
  3186687270,
  536889602,
  1224916464,
  3186630656,
  4293918720,
  2146435072,
  47274,
  1302123,
  1044387,
  726817,
  3214429171,
  435364844,
  3444379862,
  239598563,
  2327624058,
  126468571,
  36459724,
  65095192,
  3884134405,
  33040816,
  2279612190,
  16647493,
  2889981476,
  8356009,
  1164056449,
  4186133,
  2846560486,
  2095106,
  1430608008,
  1048064,
  178891460,
  524160,
  22365526,
  262112,
  2795947,
  131064,
  349509,
  65534,
  2147527338,
  32767,
  3758101845,
  16383,
  4160750251,
  8191,
  4261412949,
  4095,
  4286578699,
  2047,
  4292870145,
  1023,
  4294443008,
  511,
  4294836224,
  255,
  4294934528,
  127,
  4294959104,
  63,
  4294965248,
  31,
  4294966784,
  15,
  4294967168,
  7,
  4294967264,
  3,
  4294967288,
  1,
  4294967294,
  0,
  2147483648,
  0,
  1073741824,
  0,
  1162104393,
  538976344,
  5067848,
  1330007625,
  843470175,
  5527636,
  1886609746,
  1920099682,
  1766858873,
  844124672,
  1869562400,
  17170548,
  1343229376,
  1343229420,
  1101,
  10,
  3187671300,
  79,
  12,
  14,
  1,
  262143,
  16776963,
  512,
  0,
  50331395,
  134218240,
  922880256,
  66048,
  67762816,
  134348800,
  117460998,
  1073905925,
  84344832,
  4194818,
  17041664,
  16712192,
  84344832,
  4194819,
  2214921984,
  16386,
  17826066,
  1073741824,
  208522,
  33620224,
  3187671299,
  1343229464,
  1343229520,
  1301298411,
  1313429331,
  3223092,
  67586,
  131074,
  8517632,
  65537,
  1,
  262143,
  2686976,
  1375731712,
  1378699600,
  538980944,
  1095114784,
  540422484,
  4276822048,
  16777216,
  790528,
  33556480,
  134512648,
  2176,
  536870913,
  71303172,
  3187703808,
  28,
  9045,
  9417,
  6285,
  2729,
  6341,
  6141,
  15812,
  15825,
  1343229621,
  540165717,
  1953460034,
  1684107116,
  1981837925,
  170929714,
  1701080909,
  1377843820,
  1651536737,
  2037543525,
  543772704,
  171069522,
  1918988098,
  1145646436,
  1347559482,
  1347562825,
  50596402,
  3187672073,
  1343229528,
  1343229476,
  33685504,
  32,
  541675602,
  1347551740,
  537459506,
  4247914233,
  1006699030,
  1819112552,
  1701329982,
  1010721889,
  1635018093,
  1953785888,
  1902456176,
  1031170421,
  1717924386,
  1752393074,
  1868767266,
  1852142702,
  807550324,
  1280464187,
  637282109,
  791624307,
  1886609778,
  1920099682,
  778662009,
  795701091,
  1769366884,
  1378837859,
  1983853136,
  1769173605,
  1631415919,
  1667392097,
  1701078115,
  661022309,
  1010708258,
  1651374639,
  1048142959,
  1768187218,
  1952671090,
  543649385,
  1008758644,
  1702002685,
  1046529638,
  792498673,
  1651637601,
  792488956,
  3187731451,
  3187719680
]);

// ../../openhw-studio-emulator/src/components/BaseComponent.ts
var BaseComponent = class {
  constructor(id, manifest) {
    __publicField(this, "id");
    __publicField(this, "type");
    __publicField(this, "pins");
    __publicField(this, "state");
    __publicField(this, "stateChanged");
    __publicField(this, "telemetryManifest", null);
    __publicField(this, "telemetryRuntime", {
      createdAtMs: Date.now(),
      updateCount: 0,
      firstCpuCycles: null,
      lastCpuCycles: null,
      stateMutationCount: 0,
      lastStateChangeAtMs: Date.now(),
      lastStateChangeCycles: null,
      onEventCount: 0,
      onPinStateChangeCount: 0,
      interactionsByType: {},
      pinToggles: {},
      pinLogicLevels: {},
      io: {
        i2cTransactions: 0,
        i2cBytes: 0,
        spiTransactions: 0,
        spiBytes: 0,
        uartBytes: 0
      },
      power: {
        vccCurrent: 0,
        vccAverage: 0,
        vccSamples: 0,
        gndCurrent: 0,
        gndAverage: 0,
        gndSamples: 0
      },
      lastEventAtMs: 0,
      lastIoAtMs: 0,
      stateFingerprint: "",
      lastStateFingerprintAtMs: 0,
      updateStartAtMs: 0,
      updateStartPerfMs: 0,
      lastUpdateAtMs: 0,
      totalUpdateTimeMs: 0,
      maxUpdateTimeMs: 0,
      customTelemetry: {},
      lastHeuristicStatus: null
    });
    this.id = id;
    this.type = manifest.type;
    this.pins = {};
    if (manifest.pins) {
      manifest.pins.forEach((pinSpec) => {
        this.pins[pinSpec.id] = {
          voltage: 0,
          mode: "INPUT"
        };
      });
    }
    this.state = {};
    this.stateChanged = true;
    const telemetry = manifest?.telemetry;
    if (telemetry && typeof telemetry === "object" && !Array.isArray(telemetry)) {
      this.telemetryManifest = {
        template: typeof telemetry.template === "string" ? telemetry.template : void 0,
        criticalKeys: Array.isArray(telemetry.criticalKeys) ? telemetry.criticalKeys.map((k) => String(k || "").trim()).filter(Boolean) : []
      };
    }
    this.installTelemetryHooks();
    this.observeStateMutation("constructor", void 0, true);
  }
  wrapTelemetryMethod(methodName, before, after) {
    const host = this;
    const current = host[methodName];
    if (typeof current !== "function") return;
    if (current.__telemetryWrapped) return;
    const wrapped = (...args) => {
      if (before) {
        try {
          before(...args);
        } catch {
        }
      }
      const result = current.apply(this, args);
      if (after) {
        try {
          after(result, ...args);
        } catch {
        }
      }
      return result;
    };
    wrapped.__telemetryWrapped = true;
    wrapped.__telemetryOriginal = current;
    host[methodName] = wrapped;
  }
  installTelemetryHooks() {
    this.wrapTelemetryMethod(
      "update",
      (cpuCycles) => {
        const startMs = Date.now();
        const startPerfMs = this.getPerfNowMs();
        this.telemetryRuntime.updateCount += 1;
        this.telemetryRuntime.updateStartAtMs = startMs;
        this.telemetryRuntime.updateStartPerfMs = startPerfMs;
        this.captureCpuCycles(cpuCycles);
      },
      (_result, cpuCycles) => {
        const endMs = Date.now();
        const startMs = Number(this.telemetryRuntime.updateStartAtMs || 0);
        const endPerfMs = this.getPerfNowMs();
        const startPerfMs = Number(this.telemetryRuntime.updateStartPerfMs || 0);
        if (startMs > 0 || startPerfMs > 0) {
          const duration = Math.max(
            0,
            startPerfMs > 0 ? endPerfMs - startPerfMs : endMs - startMs
          );
          this.telemetryRuntime.totalUpdateTimeMs += duration;
          if (duration > this.telemetryRuntime.maxUpdateTimeMs) {
            this.telemetryRuntime.maxUpdateTimeMs = duration;
          }
        }
        this.telemetryRuntime.lastUpdateAtMs = endMs;
        this.observeStateMutation("update", cpuCycles, false);
      }
    );
    this.wrapTelemetryMethod(
      "onEvent",
      (event) => {
        this.telemetryRuntime.onEventCount += 1;
        this.telemetryRuntime.lastEventAtMs = Date.now();
        const key = this.getInteractionKey(event);
        this.telemetryRuntime.interactionsByType[key] = Number(this.telemetryRuntime.interactionsByType[key] || 0) + 1;
      },
      () => {
        this.observeStateMutation("onEvent", void 0, true);
      }
    );
    this.wrapTelemetryMethod(
      "onPinStateChange",
      (pinId, isHigh, cpuCycles) => {
        this.telemetryRuntime.onPinStateChangeCount += 1;
        this.captureCpuCycles(cpuCycles);
        this.capturePinLogicLevel(pinId, !!isHigh);
      },
      (_result, _pinId, _isHigh, cpuCycles) => {
        this.observeStateMutation("onPinStateChange", cpuCycles, false);
      }
    );
    this.wrapTelemetryMethod("onI2CStart", () => {
      this.telemetryRuntime.io.i2cTransactions += 1;
      this.telemetryRuntime.lastIoAtMs = Date.now();
    });
    this.wrapTelemetryMethod(
      "onI2CByte",
      () => {
        this.telemetryRuntime.io.i2cBytes += 1;
        this.telemetryRuntime.lastIoAtMs = Date.now();
      },
      () => {
        this.observeStateMutation("onI2CByte", void 0, false);
      }
    );
    this.wrapTelemetryMethod("onI2CStop", () => {
      this.telemetryRuntime.lastIoAtMs = Date.now();
    });
    this.wrapTelemetryMethod(
      "onSPIByte",
      () => {
        this.telemetryRuntime.io.spiBytes += 1;
        this.telemetryRuntime.io.spiTransactions += 1;
        this.telemetryRuntime.lastIoAtMs = Date.now();
      },
      () => {
        this.observeStateMutation("onSPIByte", void 0, false);
      }
    );
    const protocolHooks = [
      "onPWM",
      "onPwm",
      "onPWMSignal",
      "onPIOPinChange",
      "onPioPinChange",
      "onPIO",
      "onPio",
      "onOneWireReset",
      "onOnewireReset",
      "onOneWireWriteBit",
      "onOnewireWriteBit",
      "onOneWireSlot",
      "onOnewireSlot",
      "onI2SFrame"
    ];
    for (const hook of protocolHooks) {
      this.wrapTelemetryMethod(
        hook,
        () => {
          this.telemetryRuntime.lastIoAtMs = Date.now();
        },
        () => {
          this.observeStateMutation(hook, void 0, false);
        }
      );
    }
  }
  getInteractionKey(event) {
    if (typeof event === "string") return event.trim() || "string";
    if (!event || typeof event !== "object") return "unknown";
    const maybeType = String(event.type || "").trim();
    if (maybeType) return maybeType;
    const keys = Object.keys(event);
    return keys.length ? `object:${keys.sort().join(",")}` : "object";
  }
  captureCpuCycles(cpuCycles) {
    const cycles = Number(cpuCycles);
    if (!Number.isFinite(cycles) || cycles < 0) return;
    if (this.telemetryRuntime.firstCpuCycles === null || cycles < this.telemetryRuntime.firstCpuCycles) {
      this.telemetryRuntime.firstCpuCycles = cycles;
    }
    if (this.telemetryRuntime.lastCpuCycles === null || cycles >= this.telemetryRuntime.lastCpuCycles) {
      this.telemetryRuntime.lastCpuCycles = cycles;
      return;
    }
    this.telemetryRuntime.firstCpuCycles = cycles;
    this.telemetryRuntime.lastCpuCycles = cycles;
  }
  capturePinLogicLevel(pinId, isHigh) {
    const key = String(pinId || "").trim();
    if (!key) return;
    const prev = this.telemetryRuntime.pinLogicLevels[key];
    this.telemetryRuntime.pinLogicLevels[key] = !!isHigh;
    if (prev === void 0) return;
    if (prev === !!isHigh) return;
    this.telemetryRuntime.pinToggles[key] = Number(this.telemetryRuntime.pinToggles[key] || 0) + 1;
  }
  getPerfNowMs() {
    try {
      const perf = globalThis.performance;
      if (perf && typeof perf.now === "function") {
        return Number(perf.now());
      }
    } catch {
    }
    return Date.now();
  }
  isVccLikePin(pinId) {
    return /^(vcc|vin|vdd|3v3|5v|pwr)/i.test(String(pinId || "").trim());
  }
  isGndLikePin(pinId) {
    return /^(gnd|vss|0v|ground)/i.test(String(pinId || "").trim());
  }
  updateRunningAverage(current, average, samples) {
    const nextSamples = samples + 1;
    const nextAverage = average + (current - average) / nextSamples;
    return { average: nextAverage, samples: nextSamples };
  }
  capturePowerSample(pinId, voltage) {
    const value = Number(voltage);
    if (!Number.isFinite(value)) return;
    if (this.isVccLikePin(pinId)) {
      this.telemetryRuntime.power.vccCurrent = value;
      const avg = this.updateRunningAverage(
        value,
        this.telemetryRuntime.power.vccAverage,
        this.telemetryRuntime.power.vccSamples
      );
      this.telemetryRuntime.power.vccAverage = avg.average;
      this.telemetryRuntime.power.vccSamples = avg.samples;
      return;
    }
    if (this.isGndLikePin(pinId)) {
      this.telemetryRuntime.power.gndCurrent = value;
      const avg = this.updateRunningAverage(
        value,
        this.telemetryRuntime.power.gndAverage,
        this.telemetryRuntime.power.gndSamples
      );
      this.telemetryRuntime.power.gndAverage = avg.average;
      this.telemetryRuntime.power.gndSamples = avg.samples;
    }
  }
  normalizeStateForTelemetry(value, depth = 0) {
    if (value === null || value === void 0) return value;
    if (typeof value === "string") {
      return value.length > 4096 ? `${value.slice(0, 4096)}...` : value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (ArrayBuffer.isView(value)) {
      const view = value;
      const len = Number(view?.length || 0);
      const preview = [];
      for (let i = 0; i < Math.min(len, 24); i += 1) {
        preview.push(Number(view[i] || 0));
      }
      return {
        kind: "typed-array",
        length: len,
        preview
      };
    }
    if (Array.isArray(value)) {
      if (value.length <= 24 && depth <= 1) {
        return value.map((entry) => this.normalizeStateForTelemetry(entry, depth + 1));
      }
      return {
        kind: "array",
        length: value.length,
        preview: value.slice(0, 24).map((entry) => this.normalizeStateForTelemetry(entry, depth + 1))
      };
    }
    if (typeof value === "object") {
      const keys = Object.keys(value);
      if (depth >= 3 && keys.length > 16) {
        return {
          kind: "object",
          keys: keys.slice(0, 16),
          size: keys.length
        };
      }
      const out = {};
      for (const key of keys.sort((a, b) => a.localeCompare(b))) {
        out[key] = this.normalizeStateForTelemetry(value[key], depth + 1);
      }
      return out;
    }
    return String(value);
  }
  safeSerializeState() {
    try {
      return JSON.stringify(this.normalizeStateForTelemetry(this.state));
    } catch {
      return "{}";
    }
  }
  observeStateMutation(source, cpuCycles, force = false) {
    const now = Date.now();
    const minIntervalMs = source === "update" ? 45 : 0;
    if (!force && minIntervalMs > 0 && now - this.telemetryRuntime.lastStateFingerprintAtMs < minIntervalMs) {
      return;
    }
    this.telemetryRuntime.lastStateFingerprintAtMs = now;
    const fingerprint = this.safeSerializeState();
    if (!this.telemetryRuntime.stateFingerprint) {
      this.telemetryRuntime.stateFingerprint = fingerprint;
      this.telemetryRuntime.lastStateChangeAtMs = now;
      if (Number.isFinite(Number(cpuCycles))) {
        this.telemetryRuntime.lastStateChangeCycles = Number(cpuCycles);
      }
      return;
    }
    if (fingerprint === this.telemetryRuntime.stateFingerprint) {
      return;
    }
    this.telemetryRuntime.stateFingerprint = fingerprint;
    this.telemetryRuntime.stateMutationCount += 1;
    this.telemetryRuntime.lastStateChangeAtMs = now;
    if (Number.isFinite(Number(cpuCycles))) {
      this.telemetryRuntime.lastStateChangeCycles = Number(cpuCycles);
    }
    this.stateChanged = true;
  }
  setPinVoltage(pinId, voltage) {
    if (this.pins[pinId] && this.pins[pinId].voltage !== voltage) {
      this.pins[pinId].voltage = voltage;
      this.capturePinLogicLevel(pinId, Number(voltage) > 0.5);
      this.capturePowerSample(pinId, Number(voltage));
      this.stateChanged = true;
    }
  }
  getPinVoltage(pinId) {
    return this.pins[pinId] ? this.pins[pinId].voltage : 0;
  }
  update(cpuCycles, currentWires, allComponentsInstances) {
  }
  onEvent(event) {
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
  }
  setState(newState) {
    let changed = false;
    for (const key in newState) {
      if (this.state[key] !== newState[key]) {
        this.state[key] = newState[key];
        changed = true;
      }
    }
    if (changed) {
      this.stateChanged = true;
      this.observeStateMutation("setState", void 0, true);
    }
  }
  estimateCpuHz() {
    const key = String(this.type || "").toLowerCase();
    if (/(rp2040|pico)/.test(key)) return 125e6;
    if (/esp32/.test(key)) return 8e7;
    if (/stm32/.test(key)) return 72e6;
    return 16e6;
  }
  calcFreq() {
    const updates = Number(this.telemetryRuntime.updateCount || 0);
    if (updates <= 0) return 0;
    const first = this.telemetryRuntime.firstCpuCycles;
    const last = this.telemetryRuntime.lastCpuCycles;
    if (first !== null && last !== null && last > first) {
      const simSeconds = (last - first) / this.estimateCpuHz();
      if (simSeconds > 0) {
        return Number((updates / simSeconds).toFixed(3));
      }
    }
    const elapsedMs = Math.max(1, Date.now() - this.telemetryRuntime.createdAtMs);
    return Number((updates / (elapsedMs / 1e3)).toFixed(3));
  }
  getPathValue(source, pathLike) {
    const path = String(pathLike || "").trim();
    if (!path) return void 0;
    const rawParts = path.split(".").map((p) => p.trim()).filter(Boolean);
    if (rawParts.length === 0) return void 0;
    const parts = String(rawParts[0] || "").toLowerCase() === "state" ? rawParts.slice(1) : rawParts;
    if (parts.length === 0) return source;
    let current = source;
    for (const part of parts) {
      if (!current || typeof current !== "object") return void 0;
      current = current[part];
    }
    return current;
  }
  isLikelySignalActive(value) {
    if (value === null || value === void 0) return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) && value !== 0;
    if (typeof value === "string") {
      const key = value.trim().toLowerCase();
      if (!key) return false;
      if (["0", "false", "off", "ok", "none", "idle"].includes(key)) return false;
      return true;
    }
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return false;
  }
  mergeSeverity(current, next) {
    if (current === "error" || next === "error") return "error";
    if (current === "warn" || next === "warn") return "warn";
    return "ok";
  }
  applyHeuristics() {
    const findings = [];
    let status = "ok";
    const addFinding = (severity, message) => {
      status = this.mergeSeverity(status, severity);
      findings.push(message);
    };
    const snapshot = this.state && typeof this.state === "object" ? this.state : {};
    for (const [key, value] of Object.entries(snapshot)) {
      const lower = String(key || "").toLowerCase();
      if (/(error|fault|burned|panic|critical|failed)/.test(lower) && this.isLikelySignalActive(value)) {
        addFinding("error", `State flag ${key} indicates an error condition.`);
      } else if (/(warn|degraded|timeout|unstable|retry)/.test(lower) && this.isLikelySignalActive(value)) {
        addFinding("warn", `State flag ${key} indicates a warning condition.`);
      }
    }
    const criticalKeys = Array.isArray(this.telemetryManifest?.criticalKeys) ? this.telemetryManifest?.criticalKeys || [] : [];
    for (const key of criticalKeys) {
      const value = this.getPathValue(snapshot, key);
      if (value === void 0) {
        addFinding("warn", `Critical telemetry key missing: ${key}`);
        continue;
      }
      const lower = String(key || "").toLowerCase();
      if (/(error|fault|burned|panic|critical|failed)/.test(lower) && this.isLikelySignalActive(value)) {
        addFinding("error", `Critical key ${key} is active.`);
      }
    }
    const idleMs = Math.max(0, Date.now() - Number(this.telemetryRuntime.lastStateChangeAtMs || Date.now()));
    if (this.telemetryRuntime.updateCount > 40 && idleMs > 8e3) {
      addFinding("warn", `State has been stable for ${Math.round(idleMs)}ms while updates continue.`);
    }
    const vccSamples = this.telemetryRuntime.power.vccSamples;
    const gndSamples = this.telemetryRuntime.power.gndSamples;
    if (vccSamples > 0 || gndSamples > 0) {
      const delta = this.telemetryRuntime.power.vccCurrent - this.telemetryRuntime.power.gndCurrent;
      if (delta < 0.25) {
        addFinding("warn", "Power rail delta appears too small (possible underpower/unwired condition).");
      }
    }
    const stateSize = this.safeSerializeState().length;
    if (stateSize > 256e3) {
      addFinding("warn", `State payload is large (${stateSize} bytes).`);
    }
    const avgMs = this.telemetryRuntime.updateCount > 0 ? this.telemetryRuntime.totalUpdateTimeMs / this.telemetryRuntime.updateCount : 0;
    if (avgMs > 20) {
      addFinding("error", `Critical update latency: ${avgMs.toFixed(2)}ms avg.`);
    } else if (avgMs > 5) {
      addFinding("warn", `High update latency: ${avgMs.toFixed(2)}ms avg.`);
    }
    if (this.telemetryRuntime.updateCount > 30 && this.telemetryRuntime.lastUpdateAtMs > 0) {
      const sinceLastUpdateMs = Math.max(0, Date.now() - this.telemetryRuntime.lastUpdateAtMs);
      if (sinceLastUpdateMs > 2e3) {
        addFinding("warn", `Component updates appear infrequent (last update ${Math.round(sinceLastUpdateMs)}ms ago).`);
      }
    }
    if (this.telemetryRuntime.updateCount > 30 && this.calcFreq() > 0 && this.calcFreq() < 2) {
      addFinding("warn", `Component update frequency appears low (${this.calcFreq().toFixed(2)}Hz).`);
    }
    if (this.telemetryRuntime.updateCount > 120 && this.telemetryRuntime.onEventCount === 0 && this.telemetryRuntime.stateMutationCount === 0) {
      addFinding("warn", "No events or state changes observed during runtime; component may be stale/inactive.");
    }
    const result = findings.length === 0 ? {
      status: "ok",
      summary: "OK: No anomalies detected.",
      findings: []
    } : {
      status,
      summary: `${String(status).toUpperCase()}: ${findings[0]}`,
      findings
    };
    this.telemetryRuntime.lastHeuristicStatus = result;
    return result;
  }
  onCustomTelemetry() {
  }
  setCustomTelemetry(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      this.telemetryRuntime.customTelemetry = {};
      return;
    }
    this.telemetryRuntime.customTelemetry = { ...payload };
  }
  getStateIdleMs() {
    return Math.max(0, Date.now() - Number(this.telemetryRuntime.lastStateChangeAtMs || Date.now()));
  }
  getUpdateTimingMetrics() {
    const count = Number(this.telemetryRuntime.updateCount || 0);
    const totalMs = Number(this.telemetryRuntime.totalUpdateTimeMs || 0);
    const maxMs = Number(this.telemetryRuntime.maxUpdateTimeMs || 0);
    return {
      avgMs: count > 0 ? totalMs / count : 0,
      maxMs,
      totalMs,
      count
    };
  }
  getUniversalMetrics() {
    const stateSize = this.safeSerializeState().length;
    const stateAgeMs = Math.max(0, Date.now() - Number(this.telemetryRuntime.lastStateChangeAtMs || Date.now()));
    this.telemetryRuntime.customTelemetry = {};
    try {
      this.onCustomTelemetry();
    } catch {
    }
    const timing = this.getUpdateTimingMetrics();
    return {
      updateFreq: this.calcFreq(),
      timing: {
        totalMs: timing.totalMs,
        maxMs: timing.maxMs,
        avgMs: timing.avgMs,
        count: timing.count,
        lastUpdateAtMs: this.telemetryRuntime.lastUpdateAtMs
      },
      pinToggles: { ...this.telemetryRuntime.pinToggles },
      stateSize,
      stateStability: {
        lastStateChangeAtMs: this.telemetryRuntime.lastStateChangeAtMs,
        lastStateChangeCycles: this.telemetryRuntime.lastStateChangeCycles,
        stateMutationCount: this.telemetryRuntime.stateMutationCount,
        idleMs: stateAgeMs
      },
      ioThroughput: {
        i2cTransactions: this.telemetryRuntime.io.i2cTransactions,
        i2cBytes: this.telemetryRuntime.io.i2cBytes,
        spiTransactions: this.telemetryRuntime.io.spiTransactions,
        spiBytes: this.telemetryRuntime.io.spiBytes,
        uartBytes: this.telemetryRuntime.io.uartBytes,
        lastIoAtMs: this.telemetryRuntime.lastIoAtMs
      },
      interactionAudit: {
        onEventCount: this.telemetryRuntime.onEventCount,
        onPinStateChangeCount: this.telemetryRuntime.onPinStateChangeCount,
        byType: { ...this.telemetryRuntime.interactionsByType },
        lastEventAtMs: this.telemetryRuntime.lastEventAtMs
      },
      powerProfile: {
        vcc: {
          current: this.telemetryRuntime.power.vccCurrent,
          average: Number(this.telemetryRuntime.power.vccAverage.toFixed(4)),
          samples: this.telemetryRuntime.power.vccSamples
        },
        gnd: {
          current: this.telemetryRuntime.power.gndCurrent,
          average: Number(this.telemetryRuntime.power.gndAverage.toFixed(4)),
          samples: this.telemetryRuntime.power.gndSamples
        },
        railDelta: Number((this.telemetryRuntime.power.vccCurrent - this.telemetryRuntime.power.gndCurrent).toFixed(4))
      },
      custom: this.telemetryRuntime.customTelemetry || {}
    };
  }
  // Method 1: Human-readable summary
  getTelemetrySummary() {
    this.observeStateMutation("summary", void 0, true);
    return this.applyHeuristics().summary;
  }
  // Method 2: Deep-state payload
  getTelemetryData() {
    this.observeStateMutation("telemetry", void 0, true);
    const heuristics = this.applyHeuristics();
    const source = this.state && typeof this.state === "object" && !Array.isArray(this.state) ? this.state : { value: this.state };
    const metrics = this.getUniversalMetrics();
    const metricsRecord = metrics;
    return {
      ...source,
      customTelemetry: metricsRecord.custom && typeof metricsRecord.custom === "object" ? metricsRecord.custom : {},
      _metrics: metrics,
      _heuristics: heuristics,
      _manifestTelemetry: this.telemetryManifest || void 0,
      _capturedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  getSyncState() {
    return this.state;
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-led/logic.ts
var LEDLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "voltageDrop", 1.8);
    this.state = {
      illuminated: false,
      brightness: 0,
      color: manifest.attrs?.color || "red",
      burnedOut: false,
      glow: false,
      vHistory: []
    };
  }
  getConductance() {
    const vA = this.getPinVoltage("A");
    const vK = this.getPinVoltage("K");
    const vDiff = vA - vK;
    if (vDiff > 1.8) return 0.1;
    if (vDiff > 1.5) return 0.01;
    return 1e-9;
  }
  update(cpuCycles, currentWires, allComponentsInstances) {
    if (this.state.burnedOut) return;
    const vA = this.getPinVoltage("A");
    const vK = this.getPinVoltage("K");
    const voltageDiff = vA - vK;
    const myPins = [`${this.id}:A`, `${this.id}:K`];
    const isWired = this.state.isWired ?? currentWires.some((w) => myPins.includes(w.from) || myPins.includes(w.to));
    const hasResistor = this.state.hasResistor ?? currentWires.some((w) => {
      const otherSide = w.from.startsWith(this.id) ? w.to : w.to.startsWith(this.id) ? w.from : null;
      if (!otherSide) return false;
      const compId = otherSide.split(":")[0];
      const comp = allComponentsInstances.find((c) => c.id === compId);
      return comp && comp.manifest?.type === "wokwi-resistor";
    });
    if (isWired && voltageDiff > 4 && !hasResistor) {
      this.setState({ illuminated: false, brightness: 0, burnedOut: true });
      return;
    }
    const vDropActual = Math.max(0, Math.min(voltageDiff, this.voltageDrop));
    if (voltageDiff > 1.8) {
      const vHistory = [...(this.state.vHistory || []).slice(-19), voltageDiff];
      const current = (voltageDiff - this.voltageDrop) / 220;
      this.setState({
        illuminated: true,
        brightness: 255,
        voltageDrop: vDropActual,
        current,
        glow: current > 0.015,
        // Glow if > 15mA
        vHistory
      });
    } else {
      const vHistory = [...(this.state.vHistory || []).slice(-19), voltageDiff > 0 ? voltageDiff : 0];
      this.setState({
        illuminated: false,
        brightness: 0,
        voltageDrop: voltageDiff > 0 ? voltageDiff : 0,
        current: 0,
        glow: false,
        vHistory
      });
    }
  }
  onCustomTelemetry() {
    let status = "off";
    if (this.state.burnedOut) status = "burnedOut";
    else if (this.state.illuminated && this.state.brightness > 200) status = "fully lit";
    else if (this.state.illuminated) status = "dim";
    this.setCustomTelemetry({
      status,
      color: this.state.color,
      voltageDrop: (this.state.voltageDrop || 0).toFixed(2) + " V",
      current: ((this.state.current || 0) * 1e3).toFixed(2) + " mA"
    });
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-arduino-uno/logic.ts
var UnoLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "txTimeout", null);
    __publicField(this, "rxTimeout", null);
    this.state = {
      txActive: false,
      rxActive: false,
      ...this.state
    };
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    if (pinId === "0") {
      this.setState({ rxActive: true });
      if (this.rxTimeout) clearTimeout(this.rxTimeout);
      this.rxTimeout = setTimeout(() => {
        this.setState({ rxActive: false });
        this.rxTimeout = null;
      }, 100);
    } else if (pinId === "1") {
      this.setState({ txActive: true });
      if (this.txTimeout) clearTimeout(this.txTimeout);
      this.txTimeout = setTimeout(() => {
        this.setState({ txActive: false });
        this.txTimeout = null;
      }, 100);
    } else if (pinId === "13") {
      this.setState({ pin13Active: isHigh });
    }
  }
  update(cpuCycles, currentWires, allComponentsInstances) {
  }
};

// ../src/worker/pico-logic.ts
function normalizePicoPin(pinId) {
  const s = String(pinId || "").toUpperCase();
  if (/^GPIO\d+$/.test(s)) return `GP${s.slice(4)}`;
  if (/^D\d+$/.test(s)) return `GP${s.slice(1)}`;
  if (/^\d+$/.test(s)) return `GP${s}`;
  return s;
}
var PicoLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "txTimeout", null);
    __publicField(this, "rxTimeout", null);
    this.state = {
      txActive: false,
      rxActive: false,
      builtInLed: false,
      ...this.state
    };
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    const pin = normalizePicoPin(pinId);
    if (pin === "GP1" || pin === "GP5") {
      this.setState({ rxActive: true });
      if (this.rxTimeout) clearTimeout(this.rxTimeout);
      this.rxTimeout = setTimeout(() => {
        this.setState({ rxActive: false });
        this.rxTimeout = null;
      }, 100);
    } else if (pin === "GP0" || pin === "GP4") {
      this.setState({ txActive: true });
      if (this.txTimeout) clearTimeout(this.txTimeout);
      this.txTimeout = setTimeout(() => {
        this.setState({ txActive: false });
        this.txTimeout = null;
      }, 100);
    } else if (pin === "GP25") {
      this.setState({ builtInLed: !!isHigh });
    }
  }
  update(cpuCycles, currentWires, allComponentsInstances) {
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-resistor/logic.ts
var ResistorLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = {
      current: 0,
      voltageDrop: 0,
      power: 0,
      glow: false,
      vHistory: []
    };
  }
  getConductance() {
    const resistance = parseFloat(this.state.value || this.state.resistance || 1e3);
    return resistance > 0 ? 1 / resistance : 1e3;
  }
  update() {
    const v1 = this.getPinVoltage("p1");
    const v2 = this.getPinVoltage("p2");
    const resistance = parseFloat(this.state.value || this.state.resistance || 1e3);
    const vDiff = Math.abs(v1 - v2);
    const current = resistance > 0 ? vDiff / resistance : 0;
    const power = current * vDiff;
    const vHistory = [...(this.state.vHistory || []).slice(-19), vDiff];
    this.setState({
      voltageDrop: vDiff,
      current,
      power,
      glow: power > 0.2,
      // Glow if > 200mW
      vHistory
    });
  }
  onCustomTelemetry() {
    this.setCustomTelemetry({
      voltageDrop: this.state.voltageDrop.toFixed(2) + " V",
      current: (this.state.current * 1e3).toFixed(2) + " mA",
      power: (this.state.power * 1e3).toFixed(2) + " mW"
    });
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-pushbutton/logic.ts
var PushbuttonLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = { pressed: false };
  }
  getMnaPins() {
    return ["1", "2"];
  }
  getConductance() {
    return this.state.pressed ? 1e3 : 1e-9;
  }
  onEvent(event) {
    if (event === "press") {
      this.setState({ pressed: true });
      this.setPinVoltage("1", 0);
      this.setPinVoltage("2", 0);
    } else if (event === "release") {
      this.setState({ pressed: false });
    }
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-power-supply/logic.ts
var PowerSupplyLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = {};
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const voltageStr = this.state.voltage ?? "5.0";
    const voltage = parseFloat(voltageStr) || 0;
    this.setPinVoltage("5V", voltage);
    this.setPinVoltage("GND", 0);
  }
};

// ../src/components/wokwi-neopixel-matrix/logic.ts
function samePin(pinId, expected) {
  return String(pinId || "").toUpperCase() === expected;
}
function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
var NeopixelLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "edgeLastCycle", 0);
    __publicField(this, "edgeCyclesPerUs", 16);
    __publicField(this, "bitCount", 0);
    __publicField(this, "byteValue", 0);
    __publicField(this, "byteBuffer", []);
    __publicField(this, "wsBitOneThresholdUs", 0.55);
    __publicField(this, "wsResetThresholdUs", 45);
    __publicField(this, "collectingFrame", true);
    __publicField(this, "preferPulseDecoder", false);
    __publicField(this, "preferSlotDecoder", false);
    __publicField(this, "pendingHighUs", null);
    __publicField(this, "lowUsAvg", 0);
    __publicField(this, "lowUsSamples", 0);
    this.state = { pixels: [] };
  }
  getConfiguredPixelCount() {
    const rows = parsePositiveInt(this.state?.rows);
    const cols = parsePositiveInt(this.state?.cols);
    if (rows > 0 && cols > 0) {
      return rows * cols;
    }
    const namedCount = parsePositiveInt(this.state?.numPixels) || parsePositiveInt(this.state?.num_leds) || parsePositiveInt(this.state?.leds);
    if (namedCount > 0) {
      return namedCount;
    }
    const existing = Array.isArray(this.state?.pixels) ? this.state.pixels.length : 0;
    if (existing > 0) {
      return existing;
    }
    const typeKey = String(this.type || "").toLowerCase();
    return typeKey.includes("matrix") ? 64 : 1;
  }
  getExpectedFrameBytes() {
    const pixels = this.getConfiguredPixelCount();
    return pixels > 0 ? pixels * 3 : 0;
  }
  resetFrameBuilder() {
    this.bitCount = 0;
    this.byteValue = 0;
    this.byteBuffer = [];
  }
  pushBit(bit) {
    this.byteValue = (this.byteValue << 1 | (bit ? 1 : 0)) & 255;
    this.bitCount += 1;
    if (this.bitCount >= 8) {
      this.byteBuffer.push(this.byteValue & 255);
      this.byteValue = 0;
      this.bitCount = 0;
      const expectedBytes = this.getExpectedFrameBytes();
      if (expectedBytes > 0 && this.byteBuffer.length >= expectedBytes) {
        this.flushPixels();
        this.collectingFrame = true;
      }
    }
  }
  flushPixels() {
    const expectedBytes = this.getExpectedFrameBytes();
    const sourceBytes = expectedBytes > 0 ? this.byteBuffer.slice(0, expectedBytes) : this.byteBuffer.slice();
    if (sourceBytes.length === 0 && expectedBytes <= 0) {
      this.resetFrameBuilder();
      return;
    }
    const pixelCount = expectedBytes > 0 ? Math.floor(expectedBytes / 3) : Math.ceil(sourceBytes.length / 3);
    const pixels = new Array(pixelCount).fill(0);
    for (let i = 0; i < pixelCount; i++) {
      const base = i * 3;
      const g = sourceBytes[base] || 0;
      const r = sourceBytes[base + 1] || 0;
      const b = sourceBytes[base + 2] || 0;
      pixels[i] = (r & 255) << 16 | (g & 255) << 8 | b & 255;
    }
    this.state = {
      ...this.state,
      pixels
    };
    this.stateChanged = true;
    this.resetFrameBuilder();
  }
  handleResetWindow() {
    if (this.byteBuffer.length > 0) {
      this.flushPixels();
    } else {
      this.resetFrameBuilder();
    }
    this.collectingFrame = true;
    this.pendingHighUs = null;
  }
  updateLowBaseline(lowUs) {
    if (!Number.isFinite(lowUs) || lowUs <= 0) return;
    if (this.lowUsSamples <= 0) {
      this.lowUsAvg = lowUs;
      this.lowUsSamples = 1;
      return;
    }
    if (lowUs > this.lowUsAvg * 4) {
      return;
    }
    const alpha = this.lowUsSamples < 32 ? 0.25 : 0.08;
    this.lowUsAvg = this.lowUsAvg * (1 - alpha) + lowUs * alpha;
    this.lowUsSamples += 1;
  }
  isPulseReset(lowUs) {
    if (!Number.isFinite(lowUs) || lowUs <= 0) return false;
    if (lowUs >= this.wsResetThresholdUs) return true;
    if (this.lowUsSamples >= 16 && this.lowUsAvg > 0 && lowUs > this.lowUsAvg * 12) {
      return true;
    }
    return false;
  }
  decodePulseBit(highUs, lowUs) {
    if (!Number.isFinite(highUs) || !Number.isFinite(lowUs) || highUs <= 0 || lowUs <= 0) {
      return null;
    }
    const ratio = highUs / (highUs + lowUs);
    if (!Number.isFinite(ratio)) return null;
    return ratio >= 0.42 ? 1 : 0;
  }
  decodeEdgeFallback(isHigh, cpuCycles) {
    if (this.edgeLastCycle <= 0) {
      this.edgeLastCycle = cpuCycles;
      return;
    }
    const elapsed = cpuCycles - this.edgeLastCycle;
    this.edgeLastCycle = cpuCycles;
    const resetThresholdCycles = Math.max(300, this.edgeCyclesPerUs * this.wsResetThresholdUs);
    if (isHigh) {
      if (elapsed > resetThresholdCycles) {
        const estimated = elapsed / this.wsResetThresholdUs;
        if (Number.isFinite(estimated) && estimated >= 8 && estimated <= 512) {
          this.edgeCyclesPerUs = estimated;
        }
        this.handleResetWindow();
      }
      return;
    }
    if (!this.collectingFrame) return;
    const bitOneThresholdCycles = Math.max(4, this.edgeCyclesPerUs * this.wsBitOneThresholdUs);
    const bit = elapsed >= bitOneThresholdCycles ? 1 : 0;
    this.pushBit(bit);
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    if (!samePin(pinId, "DIN")) return;
    this.decodeEdgeFallback(isHigh, cpuCycles);
  }
  onPulseHigh(pinId, payload) {
    if (!samePin(pinId, "DIN")) return;
    const highUs = Number(payload?.highUs ?? payload?.pulseUs ?? 0);
    if (!Number.isFinite(highUs) || highUs <= 0) return;
    this.preferPulseDecoder = true;
    this.pendingHighUs = highUs;
  }
  onPulseLow(pinId, payload) {
    if (!samePin(pinId, "DIN")) return;
    if (this.preferSlotDecoder) return;
    const lowUs = Number(payload?.lowUs ?? payload?.pulseUs ?? 0);
    if (!Number.isFinite(lowUs) || lowUs <= 0) return;
    this.preferPulseDecoder = true;
    if (this.isPulseReset(lowUs)) {
      this.handleResetWindow();
      return;
    }
    this.updateLowBaseline(lowUs);
    if (!this.collectingFrame) return;
    const highUs = this.pendingHighUs;
    this.pendingHighUs = null;
    const bit = this.decodePulseBit(Number(highUs), lowUs);
    if (bit == null) return;
    this.pushBit(bit);
  }
  onOneWireReset(pinId) {
    if (!samePin(pinId, "DIN")) return;
    if (this.preferPulseDecoder) return;
    this.handleResetWindow();
  }
  onOneWireWriteBit(pinId, bit) {
    void pinId;
    void bit;
  }
  onOneWireSlot(pinId, payload) {
    if (!samePin(pinId, "DIN")) return;
    const lowUs = Number(payload?.pulseUs ?? payload?.lowUs ?? 0);
    if (!Number.isFinite(lowUs) || lowUs <= 0) return;
    this.preferPulseDecoder = true;
    this.preferSlotDecoder = true;
    if (this.isPulseReset(lowUs)) {
      this.handleResetWindow();
      return;
    }
    this.updateLowBaseline(lowUs);
    if (!this.collectingFrame) return;
    let thresholdUs = this.lowUsAvg > 0 ? this.lowUsAvg * 1.35 : 1.4;
    thresholdUs = Math.max(0.8, Math.min(3, thresholdUs));
    const bit = lowUs <= thresholdUs ? 1 : 0;
    this.pushBit(bit);
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-buzzer/logic.ts
var BuzzerLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = { isBuzzing: false };
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const v1 = this.getPinVoltage("1");
    const v2 = this.getPinVoltage("2");
    const vDiff = v1 - v2;
    const isBuzzing = vDiff > 2;
    this.setState({
      isBuzzing,
      voltageDrop: Math.max(0, vDiff),
      current: isBuzzing ? 0.015 : 0
      // Typical buzzer is ~15mA
    });
  }
  onCustomTelemetry() {
    this.setCustomTelemetry({
      status: this.state.isBuzzing ? "Buzzing" : "Silent",
      voltageDrop: (this.state.voltageDrop || 0).toFixed(2) + " V",
      current: ((this.state.current || 0) * 1e3).toFixed(2) + " mA"
    });
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-motor/logic.ts
var MotorLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "pinData", {});
    __publicField(this, "lastUpdateCycle", 0);
    __publicField(this, "actualSpeed", 0);
    this.state = { speed: 0 };
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    if (!this.pinData[pinId]) {
      this.pinData[pinId] = { lastState: false, lastCycle: cpuCycles, highCycles: 0 };
    }
    const data = this.pinData[pinId];
    if (data.lastState) {
      data.highCycles += cpuCycles - data.lastCycle;
    }
    data.lastState = isHigh;
    data.lastCycle = cpuCycles;
  }
  getAverageVoltage(pinId, currentCycles, elapsedCycles) {
    const data = this.pinData[pinId];
    if (!data) return this.getPinVoltage(pinId);
    let highCyclesToCount = data.highCycles;
    if (data.lastState) {
      highCyclesToCount += currentCycles - data.lastCycle;
    }
    data.highCycles = 0;
    data.lastCycle = currentCycles;
    if (elapsedCycles <= 0) return this.getPinVoltage(pinId);
    let dutyCycle = highCyclesToCount / elapsedCycles;
    dutyCycle = Math.max(0, Math.min(1, dutyCycle));
    return dutyCycle * 5;
  }
  getConnectedVoltage(pinId, currentWires, instances, fallback) {
    let maxV = fallback;
    const myPinStr = `${this.id}:${pinId}`;
    for (const w of currentWires) {
      if (w.from === myPinStr) {
        const [targetComp, targetPin] = w.to.split(":");
        const inst = instances.find((i) => i.id === targetComp);
        if (inst && inst.pins[targetPin]) maxV = Math.max(maxV, inst.pins[targetPin].voltage || 0);
      } else if (w.to === myPinStr) {
        const [targetComp, targetPin] = w.from.split(":");
        const inst = instances.find((i) => i.id === targetComp);
        if (inst && inst.pins[targetPin]) maxV = Math.max(maxV, inst.pins[targetPin].voltage || 0);
      }
    }
    return maxV;
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const elapsedCycles = time - this.lastUpdateCycle;
    this.lastUpdateCycle = time;
    let v1 = this.getAverageVoltage("1", time, elapsedCycles);
    v1 = this.getConnectedVoltage("1", wires, instances, v1);
    let v2 = this.getAverageVoltage("2", time, elapsedCycles);
    v2 = this.getConnectedVoltage("2", wires, instances, v2);
    let targetSpeed = 0;
    if (v1 > v2 + 0.5) {
      targetSpeed = (v1 - v2) / 5;
    } else if (v2 > v1 + 0.5) {
      targetSpeed = -(v2 - v1) / 5;
    }
    targetSpeed = Math.max(-1, Math.min(1, targetSpeed));
    const dt = elapsedCycles / 16e3;
    const factor = Math.min(1, 0.05 * dt);
    this.actualSpeed = this.actualSpeed + (targetSpeed - this.actualSpeed) * factor;
    if (Math.abs(this.actualSpeed) < 0.01) this.actualSpeed = 0;
    if (Math.abs(this.state.speed - this.actualSpeed) > 0.05) {
      this.state.speed = this.actualSpeed;
      this.stateChanged = true;
    }
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-servo/logic.ts
var ServoLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "lastHighCycle", 0);
    __publicField(this, "targetAngle", -1);
    // -1 indicates uninitialized target
    __publicField(this, "lastUpdateCycle", 0);
    __publicField(this, "pulseWidthUs", 0);
    __publicField(this, "pwmFrequencyHz", 0);
    __publicField(this, "lastRisingEdgeCycle", 0);
    this.state = { angle: 0 };
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    super.onPinStateChange(pinId, isHigh, cpuCycles);
    if (pinId === "PWM") {
      if (isHigh) {
        if (this.lastRisingEdgeCycle > 0 && cpuCycles > this.lastRisingEdgeCycle) {
          const periodUs = (cpuCycles - this.lastRisingEdgeCycle) / 16;
          if (periodUs > 0) {
            this.pwmFrequencyHz = 1e6 / periodUs;
          }
        }
        this.lastRisingEdgeCycle = cpuCycles;
        this.lastHighCycle = cpuCycles;
      } else {
        if (this.lastHighCycle > 0) {
          const elapsedCycles = cpuCycles - this.lastHighCycle;
          const us = elapsedCycles / 16;
          this.pulseWidthUs = us;
          let angle = (us - 544) * 180 / (2400 - 544);
          angle = Math.max(0, Math.min(180, angle));
          this.targetAngle = angle;
        }
      }
    }
  }
  onCustomTelemetry() {
    const target = this.targetAngle >= 0 ? this.targetAngle : this.state.angle;
    this.setCustomTelemetry({
      pulseWidthUs: this.pulseWidthUs,
      frequencyHz: Number(this.pwmFrequencyHz.toFixed(3)),
      targetAngle: Number(target.toFixed(2)),
      distanceToTarget: Number(Math.abs(this.state.angle - target).toFixed(2))
    });
  }
  update(cpuCycles, wires, instances) {
    super.update(cpuCycles, wires, instances);
    if (this.lastUpdateCycle === 0) {
      this.lastUpdateCycle = cpuCycles;
      if (this.targetAngle === -1) {
        this.targetAngle = this.state.angle || 0;
      }
      return;
    }
    const elapsedCycles = cpuCycles - this.lastUpdateCycle;
    this.lastUpdateCycle = cpuCycles;
    if (Math.abs(this.state.angle - this.targetAngle) > 0.1) {
      const maxMovement = 400 * (elapsedCycles / 16e6);
      if (this.state.angle < this.targetAngle) {
        this.state.angle = Math.min(this.targetAngle, this.state.angle + maxMovement);
      } else {
        this.state.angle = Math.max(this.targetAngle, this.state.angle - maxMovement);
      }
      this.stateChanged = true;
    }
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-motor-driver/logic.ts
var MotorDriverLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "pinData", {});
    __publicField(this, "lastUpdateCycle", 0);
    this.state = {};
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    if (!this.pinData[pinId]) {
      this.pinData[pinId] = { lastState: false, lastCycle: cpuCycles, highCycles: 0 };
    }
    const data = this.pinData[pinId];
    if (data.lastState) {
      data.highCycles += cpuCycles - data.lastCycle;
    }
    data.lastState = isHigh;
    data.lastCycle = cpuCycles;
  }
  getAverageVoltage(pinId, currentCycles, elapsedCycles) {
    const data = this.pinData[pinId];
    if (!data) return this.getPinVoltage(pinId);
    let highCyclesToCount = data.highCycles;
    if (data.lastState) {
      highCyclesToCount += currentCycles - data.lastCycle;
    }
    data.highCycles = 0;
    data.lastCycle = currentCycles;
    if (elapsedCycles <= 0) return this.getPinVoltage(pinId);
    let dutyCycle = highCyclesToCount / elapsedCycles;
    dutyCycle = Math.max(0, Math.min(1, dutyCycle));
    return dutyCycle * 5;
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const elapsedCycles = time - this.lastUpdateCycle;
    this.lastUpdateCycle = time;
    const ena = Math.max(0, this.getAverageVoltage("ENA", time, elapsedCycles) || 0);
    const in1 = this.getAverageVoltage("IN1", time, elapsedCycles) > 2.5;
    const in2 = this.getAverageVoltage("IN2", time, elapsedCycles) > 2.5;
    if (ena > 0.5) {
      this.setPinVoltage("OUT1", in1 ? ena : 0);
      this.setPinVoltage("OUT2", in2 ? ena : 0);
    } else {
      this.setPinVoltage("OUT1", 0);
      this.setPinVoltage("OUT2", 0);
    }
    const enb = Math.max(0, this.getAverageVoltage("ENB", time, elapsedCycles) || 0);
    const in3 = this.getAverageVoltage("IN3", time, elapsedCycles) > 2.5;
    const in4 = this.getAverageVoltage("IN4", time, elapsedCycles) > 2.5;
    if (enb > 0.5) {
      this.setPinVoltage("OUT3", in3 ? enb : 0);
      this.setPinVoltage("OUT4", in4 ? enb : 0);
    } else {
      this.setPinVoltage("OUT3", 0);
      this.setPinVoltage("OUT4", 0);
    }
    if (this.getPinVoltage("12V") > 7) {
      this.setPinVoltage("5V", 5);
    } else {
      this.setPinVoltage("5V", 0);
    }
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-slide-potentiometer/logic.ts
var SlidePotLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = { value: 50 };
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    let val = Number(this.state.value) || 0;
    const vcc = this.getPinVoltage("VCC");
    const gnd = this.getPinVoltage("GND");
    const sigV = gnd + (vcc - gnd) * (val / 100);
    this.setPinVoltage("SIG", sigV);
  }
  onCustomTelemetry() {
    const val = Number(this.state.value) || 0;
    const vcc = this.getPinVoltage("VCC");
    const gnd = this.getPinVoltage("GND");
    const sigV = gnd + (vcc - gnd) * (val / 100);
    this.setCustomTelemetry({
      resistanceRatio: Number((val / 100).toFixed(4)),
      signalVoltage: Number(sigV.toFixed(4))
    });
  }
  getSyncState() {
    return { value: this.state.value };
  }
  onEvent(event) {
    if (event && event.type === "input" && event.value !== void 0) {
      this.state.value = event.value;
      this.stateChanged = true;
    }
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-potentiometer/logic.ts
var PotentiometerLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = { value: 50 };
  }
  getMnaStamps() {
    const val = Number(this.state.value) || 0;
    const totalR = 1e4;
    const r1 = Math.max(0.1, totalR * (val / 100));
    const r2 = Math.max(0.1, totalR * (1 - val / 100));
    return [
      { pins: ["1", "SIG"], g: 1 / r1 },
      { pins: ["2", "SIG"], g: 1 / r2 }
    ];
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    let val = Number(this.state.value) || 0;
    const v1 = this.getPinVoltage("VCC") || this.getPinVoltage("1");
    const v2 = this.getPinVoltage("GND") || this.getPinVoltage("2");
    const sigV = v1 + (v2 - v1) * (val / 100);
    this.setPinVoltage("SIG", sigV);
  }
  onCustomTelemetry() {
    const val = Number(this.state.value) || 0;
    const v1 = this.getPinVoltage("VCC") || this.getPinVoltage("1");
    const v2 = this.getPinVoltage("GND") || this.getPinVoltage("2");
    const sigV = v1 + (v2 - v1) * (val / 100);
    this.setCustomTelemetry({
      resistanceRatio: Number((val / 100).toFixed(4)),
      signalVoltage: Number(sigV.toFixed(4))
    });
  }
  getSyncState() {
    return { value: this.state.value };
  }
  onEvent(event) {
    if (event && event.type === "input" && event.value !== void 0) {
      this.state.value = event.value;
      this.stateChanged = true;
    }
  }
};

// ../../openhw-studio-emulator/src/components/shift_register/logic.ts
var ShiftRegisterLogic = class extends BaseComponent {
  // tracks OE pin state (active LOW)
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "srclkLast", false);
    __publicField(this, "rclkLast", false);
    __publicField(this, "oeLast", false);
    this.state = {
      shiftReg: 0,
      // 8-bit internal shift register
      storageReg: 0,
      // 8-bit storage (latch) register
      outputs: 0
      // current driven output byte (0 when OE=HIGH)
    };
  }
  // ────────────────────────────────────────────────────────────
  //  BIT-BANG mode: called whenever a connected Arduino pin changes
  // ────────────────────────────────────────────────────────────
  onPinStateChange(pinId, isHigh, _cpuCycles) {
    const pin = pinId.toLowerCase();
    switch (pin) {
      // ── SRCLR (active LOW) ──────────────────────────────
      case "srclr":
        if (!isHigh) {
          this.state.shiftReg = 0;
          this.setPinVoltage("q7s", 0);
          this.stateChanged = true;
        }
        break;
      // ── OE (active LOW) ─────────────────────────────────
      case "oe":
        if (this.oeLast !== isHigh) {
          this.oeLast = isHigh;
          this.updateOutputPins();
        }
        break;
      // ── SRCLK (shift clock) ─────────────────────────────
      // Rising edge: shift data in from SER; MSB shifted out to q7s
      case "srclk": {
        const rising = isHigh && !this.srclkLast;
        this.srclkLast = isHigh;
        if (rising) {
          const serBit = this.getPinVoltage("ser") > 0.5 ? 1 : 0;
          const q7out = this.state.shiftReg >> 7 & 1;
          this.state.shiftReg = (this.state.shiftReg << 1 | serBit) & 255;
          this.setPinVoltage("q7s", q7out ? 5 : 0);
          this.stateChanged = true;
        }
        break;
      }
      // ── RCLK (latch clock) ──────────────────────────────
      // Rising edge: copy shift register to storage register; update outputs
      case "rclk": {
        const rising = isHigh && !this.rclkLast;
        this.rclkLast = isHigh;
        if (rising) {
          this.state.storageReg = this.state.shiftReg;
          this.updateOutputPins();
        }
        break;
      }
    }
  }
  // ────────────────────────────────────────────────────────────
  //  HARDWARE SPI mode: AVRSPI peripheral fires this per byte
  //  The entire 8-bit shift is done atomically; RCLK still latches.
  // ────────────────────────────────────────────────────────────
  onSPIByte(data) {
    const q7sByte = this.state.shiftReg & 255;
    this.state.shiftReg = data & 255;
    this.setPinVoltage("q7s", q7sByte >> 7 & 1 ? 5 : 0);
    this.stateChanged = true;
    return q7sByte;
  }
  // ────────────────────────────────────────────────────────────
  //  HELPERS
  // ────────────────────────────────────────────────────────────
  /** Reflect the storage register onto the q0-q7 output pins, gated by OE. */
  updateOutputPins() {
    const oeEnabled = this.getPinVoltage("oe") < 0.5;
    const sr = oeEnabled ? this.state.storageReg : 0;
    this.state.outputs = sr;
    for (let i = 0; i < 8; i++) {
      this.setPinVoltage(`q${i}`, sr >> i & 1 ? 5 : 0);
    }
    this.stateChanged = true;
  }
  getSyncState() {
    return { ...this.state };
  }
};

// ../src/worker/board-profiles.ts
var UNO_DIGITAL_PINS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];
var UNO_ANALOG_PINS = ["A0", "A1", "A2", "A3", "A4", "A5"];
var UNO_POWER_PINS = ["vin", "gnd_1", "gnd_2", "gnd_3", "5V", "3v3", "rst", "ioref"];
var UNO_BOARD_PINS = [...UNO_DIGITAL_PINS, ...UNO_ANALOG_PINS, ...UNO_POWER_PINS];
var PICO_GPIO_PINS = Array.from({ length: 29 }, (_, idx) => `GP${idx}`);
var PICO_POWER_PINS = [
  "VBUS",
  "VSYS",
  "3V3",
  "3V3_EN",
  "ADC_VREF",
  "RUN",
  "AGND",
  "GND",
  "GND_1",
  "GND_2",
  "GND_3",
  "GND_4",
  "GND_5",
  "GND_6"
];
var PICO_BOARD_PINS = [...PICO_GPIO_PINS, ...PICO_POWER_PINS];
var PICO_UART_SOURCE_PINS = {
  uart0: {
    tx: ["TX", "TX0", "GP0", "GPIO0", "0", "D0", "GP12", "GPIO12", "12", "D12", "GP16", "GPIO16", "16", "D16", "GP28", "GPIO28", "28", "D28"],
    rx: ["RX", "RX0", "GP1", "GPIO1", "1", "D1", "GP13", "GPIO13", "13", "D13", "GP17", "GPIO17", "17", "D17"]
  },
  uart1: {
    tx: ["TX1", "GP4", "GPIO4", "4", "D4", "GP8", "GPIO8", "8", "D8", "GP20", "GPIO20", "20", "D20"],
    rx: ["RX1", "GP5", "GPIO5", "5", "D5", "GP9", "GPIO9", "9", "D9", "GP21", "GPIO21", "21", "D21"]
  }
};
var PICO_UART_PINS = {
  tx: Array.from(/* @__PURE__ */ new Set([...PICO_UART_SOURCE_PINS.uart0.tx, ...PICO_UART_SOURCE_PINS.uart1.tx])),
  rx: Array.from(/* @__PURE__ */ new Set([...PICO_UART_SOURCE_PINS.uart0.rx, ...PICO_UART_SOURCE_PINS.uart1.rx]))
};

// ../../openhw-studio-emulator/src/components/wokwi-analog-joystick/logic.ts
var JoystickLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = { x: 0.5, y: 0.5, pressed: false };
  }
  onEvent(event) {
    if (typeof event === "string") {
      if (event === "press") {
        this.setState({ pressed: true });
      } else if (event === "release") {
        this.setState({ pressed: false });
      }
    } else if (typeof event === "object" && event.type === "move") {
      this.setState({ x: event.x, y: event.y });
    }
  }
  update() {
    const vcc = this.getPinVoltage("5V") || 5;
    const gnd = this.getPinVoltage("GND") || 0;
    const vx = gnd + this.state.x * (vcc - gnd);
    const vy = gnd + this.state.y * (vcc - gnd);
    this.setPinVoltage("VRX", vx);
    this.setPinVoltage("VRY", vy);
  }
  onCustomTelemetry() {
    this.setCustomTelemetry({
      position: `(${this.state.x.toFixed(2)}, ${this.state.y.toFixed(2)})`,
      buttonPressed: !!this.state.pressed,
      vrxVoltage: Number((this.getPinVoltage("VRX") || 0).toFixed(2)),
      vryVoltage: Number((this.getPinVoltage("VRY") || 0).toFixed(2))
    });
  }
};

// ../../openhw-studio-emulator/src/components/logic-ic-74xx/logic.ts
var IC_DEFINITIONS = {
  "7400": {
    label: "74LS00 (NAND)",
    gates: [
      { inputs: ["p1", "p2"], output: "p3" },
      { inputs: ["p4", "p5"], output: "p6" },
      { inputs: ["p10", "p9"], output: "p8" },
      { inputs: ["p13", "p12"], output: "p11" }
    ],
    fn: (a, b) => !(a && b)
  },
  "7402": {
    label: "74LS02 (NOR)",
    gates: [
      { inputs: ["p2", "p3"], output: "p1" },
      { inputs: ["p5", "p6"], output: "p4" },
      { inputs: ["p8", "p9"], output: "p10" },
      { inputs: ["p11", "p12"], output: "p13" }
    ],
    fn: (a, b) => !(a || b)
  },
  "7404": {
    label: "74LS04 (NOT)",
    gates: [
      { inputs: ["p1"], output: "p2" },
      { inputs: ["p3"], output: "p4" },
      { inputs: ["p5"], output: "p6" },
      { inputs: ["p9"], output: "p8" },
      { inputs: ["p11"], output: "p10" },
      { inputs: ["p13"], output: "p12" }
    ],
    fn: (a) => !a
  },
  "7407": {
    label: "74LS07 (Buffer)",
    gates: [
      { inputs: ["p1"], output: "p2" },
      { inputs: ["p3"], output: "p4" },
      { inputs: ["p5"], output: "p6" },
      { inputs: ["p9"], output: "p8" },
      { inputs: ["p11"], output: "p10" },
      { inputs: ["p13"], output: "p12" }
    ],
    fn: (a) => a
  },
  "7408": {
    label: "74LS08 (AND)",
    gates: [
      { inputs: ["p1", "p2"], output: "p3" },
      { inputs: ["p4", "p5"], output: "p6" },
      { inputs: ["p10", "p9"], output: "p8" },
      { inputs: ["p13", "p12"], output: "p11" }
    ],
    fn: (a, b) => a && b
  },
  "7432": {
    label: "74LS32 (OR)",
    gates: [
      { inputs: ["p1", "p2"], output: "p3" },
      { inputs: ["p4", "p5"], output: "p6" },
      { inputs: ["p10", "p9"], output: "p8" },
      { inputs: ["p13", "p12"], output: "p11" }
    ],
    fn: (a, b) => a || b
  },
  "7486": {
    label: "74LS86 (XOR)",
    gates: [
      { inputs: ["p1", "p2"], output: "p3" },
      { inputs: ["p4", "p5"], output: "p6" },
      { inputs: ["p10", "p9"], output: "p8" },
      { inputs: ["p13", "p12"], output: "p11" }
    ],
    fn: (a, b) => a !== b
  },
  "74266": {
    label: "74LS266 (XNOR)",
    gates: [
      { inputs: ["p1", "p2"], output: "p3" },
      { inputs: ["p4", "p5"], output: "p6" },
      { inputs: ["p10", "p9"], output: "p8" },
      { inputs: ["p13", "p12"], output: "p11" }
    ],
    fn: (a, b) => a === b
  }
};
var LogicIC74xxLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "prevOutputs", {});
    this.state = { icType: "7408", outputs: {} };
  }
  getICType() {
    return this.manifest?.attrs?.icType || this.state.icType || "7408";
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const icType = this.getICType();
    const def = IC_DEFINITIONS[icType];
    if (!def) return;
    const vcc = this.getPinVoltage("p14");
    const gnd = this.getPinVoltage("p7");
    const powered = vcc >= 2.5 && gnd < 2.5;
    const newOutputs = {};
    let changed = false;
    for (const gate of def.gates) {
      const inputValues = gate.inputs.map((pin) => this.getPinVoltage(pin) >= 2.5);
      const result = powered ? def.fn(...inputValues) : false;
      newOutputs[gate.output] = result;
      if (this.prevOutputs[gate.output] !== result) {
        changed = true;
      }
      const outVoltage = result ? 5 : 0;
      this.propagatePin(gate.output, outVoltage, wires, instances);
    }
    if (changed) {
      this.prevOutputs = { ...newOutputs };
      this.state.outputs = newOutputs;
      this.state.icType = icType;
      this.stateChanged = true;
    }
  }
  propagatePin(pinId, voltage, wires, instances) {
    const pinKey = `${this.id}:${pinId}`;
    const visited = /* @__PURE__ */ new Set();
    visited.add(pinKey);
    const propagate = (key, v) => {
      for (const w of wires) {
        const match = w.from === key || w.to === key;
        if (!match) continue;
        const otherKey = w.from === key ? w.to : w.from;
        if (visited.has(otherKey)) continue;
        visited.add(otherKey);
        const [compId, compPin] = otherKey.split(":");
        const inst = instances.find((i) => i.id === compId);
        if (!inst) continue;
        if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: "INPUT" };
        inst.setPinVoltage(compPin, v);
        if (inst.type === "wokwi-resistor") {
          const otherPin = compPin === "p1" ? "p2" : "p1";
          inst.setPinVoltage(otherPin, v);
          const forwardKey = `${compId}:${otherPin}`;
          if (!visited.has(forwardKey)) {
            visited.add(forwardKey);
            propagate(forwardKey, v);
          }
        }
      }
    };
    propagate(pinKey, voltage);
  }
  getPinVoltage(pinId) {
    const icType = this.getICType();
    const def = IC_DEFINITIONS[icType];
    if (def) {
      for (const gate of def.gates) {
        if (gate.output === pinId) {
          return this.prevOutputs[pinId] ? 5 : 0;
        }
      }
    }
    return super.getPinVoltage(pinId);
  }
};

// ../../openhw-studio-emulator/src/components/logic-mux-2to1/logic.ts
var Mux2to1Logic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = { d0High: false, d1High: false, selHigh: false, outputHigh: false };
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const d0High = this.getPinVoltage("D0") >= 2.5;
    const d1High = this.getPinVoltage("D1") >= 2.5;
    const selHigh = this.getPinVoltage("SEL") >= 2.5;
    const outputHigh = selHigh ? d1High : d0High;
    if (this.state.d0High !== d0High || this.state.d1High !== d1High || this.state.selHigh !== selHigh || this.state.outputHigh !== outputHigh) {
      this.state.d0High = d0High;
      this.state.d1High = d1High;
      this.state.selHigh = selHigh;
      this.state.outputHigh = outputHigh;
      this.stateChanged = true;
    }
    const outVoltage = outputHigh ? 5 : 0;
    const outPinKey = `${this.id}:OUT`;
    const visited = /* @__PURE__ */ new Set();
    visited.add(outPinKey);
    const propagate = (pinKey, voltage) => {
      for (const w of wires) {
        const match = w.from === pinKey || w.to === pinKey;
        if (!match) continue;
        const otherKey = w.from === pinKey ? w.to : w.from;
        if (visited.has(otherKey)) continue;
        visited.add(otherKey);
        const [compId, compPin] = otherKey.split(":");
        const inst = instances.find((i) => i.id === compId);
        if (!inst) continue;
        if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: "INPUT" };
        inst.setPinVoltage(compPin, voltage);
        if (inst.type === "wokwi-resistor") {
          const otherPin = compPin === "p1" ? "p2" : "p1";
          inst.setPinVoltage(otherPin, voltage);
          const forwardKey = `${compId}:${otherPin}`;
          if (!visited.has(forwardKey)) {
            visited.add(forwardKey);
            propagate(forwardKey, voltage);
          }
        }
      }
    };
    propagate(outPinKey, outVoltage);
  }
  getPinVoltage(pinId) {
    if (pinId === "OUT") {
      return this.state.outputHigh ? 5 : 0;
    }
    return super.getPinVoltage(pinId);
  }
};

// ../../openhw-studio-emulator/src/components/logic-d-flipflop/logic.ts
var DFlipFlopLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "prevClk", false);
    this.state = { d: false, clk: false, q: false, qbar: true };
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const d = this.getPinVoltage("D") >= 2.5;
    const clk = this.getPinVoltage("CLK") >= 2.5;
    let q = this.state.q;
    let qbar = this.state.qbar;
    if (clk && !this.prevClk) {
      q = d;
      qbar = !d;
    }
    this.prevClk = clk;
    if (this.state.d !== d || this.state.clk !== clk || this.state.q !== q || this.state.qbar !== qbar) {
      this.state.d = d;
      this.state.clk = clk;
      this.state.q = q;
      this.state.qbar = qbar;
      this.stateChanged = true;
    }
    this.propagatePin("Q", q ? 5 : 0, wires, instances);
    this.propagatePin("Qbar", qbar ? 5 : 0, wires, instances);
  }
  propagatePin(pinId, voltage, wires, instances) {
    const pinKey = `${this.id}:${pinId}`;
    const visited = /* @__PURE__ */ new Set();
    visited.add(pinKey);
    const propagate = (key, v) => {
      for (const w of wires) {
        const match = w.from === key || w.to === key;
        if (!match) continue;
        const otherKey = w.from === key ? w.to : w.from;
        if (visited.has(otherKey)) continue;
        visited.add(otherKey);
        const [compId, compPin] = otherKey.split(":");
        const inst = instances.find((i) => i.id === compId);
        if (!inst) continue;
        if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: "INPUT" };
        inst.setPinVoltage(compPin, v);
        if (inst.type === "wokwi-resistor") {
          const otherPin = compPin === "p1" ? "p2" : "p1";
          inst.setPinVoltage(otherPin, v);
          const forwardKey = `${compId}:${otherPin}`;
          if (!visited.has(forwardKey)) {
            visited.add(forwardKey);
            propagate(forwardKey, v);
          }
        }
      }
    };
    propagate(pinKey, voltage);
  }
  getPinVoltage(pinId) {
    if (pinId === "Q") return this.state.q ? 5 : 0;
    if (pinId === "Qbar") return this.state.qbar ? 5 : 0;
    return super.getPinVoltage(pinId);
  }
};

// ../../openhw-studio-emulator/src/components/logic-d-flipflop-r/logic.ts
var DFlipFlopRLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "prevClk", false);
    this.state = { d: false, clk: false, r: false, q: false, qbar: true };
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const d = this.getPinVoltage("D") >= 2.5;
    const clk = this.getPinVoltage("CLK") >= 2.5;
    const r = this.getPinVoltage("R") >= 2.5;
    let q = this.state.q;
    let qbar = this.state.qbar;
    if (r) {
      q = false;
      qbar = true;
    } else if (clk && !this.prevClk) {
      q = d;
      qbar = !d;
    }
    this.prevClk = clk;
    if (this.state.d !== d || this.state.clk !== clk || this.state.r !== r || this.state.q !== q || this.state.qbar !== qbar) {
      this.state.d = d;
      this.state.clk = clk;
      this.state.r = r;
      this.state.q = q;
      this.state.qbar = qbar;
      this.stateChanged = true;
    }
    this.propagatePin("Q", q ? 5 : 0, wires, instances);
    this.propagatePin("Qbar", qbar ? 5 : 0, wires, instances);
  }
  propagatePin(pinId, voltage, wires, instances) {
    const pinKey = `${this.id}:${pinId}`;
    const visited = /* @__PURE__ */ new Set();
    visited.add(pinKey);
    const propagate = (key, v) => {
      for (const w of wires) {
        const match = w.from === key || w.to === key;
        if (!match) continue;
        const otherKey = w.from === key ? w.to : w.from;
        if (visited.has(otherKey)) continue;
        visited.add(otherKey);
        const [compId, compPin] = otherKey.split(":");
        const inst = instances.find((i) => i.id === compId);
        if (!inst) continue;
        if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: "INPUT" };
        inst.setPinVoltage(compPin, v);
        if (inst.type === "wokwi-resistor") {
          const otherPin = compPin === "p1" ? "p2" : "p1";
          inst.setPinVoltage(otherPin, v);
          const forwardKey = `${compId}:${otherPin}`;
          if (!visited.has(forwardKey)) {
            visited.add(forwardKey);
            propagate(forwardKey, v);
          }
        }
      }
    };
    propagate(pinKey, voltage);
  }
  getPinVoltage(pinId) {
    if (pinId === "Q") return this.state.q ? 5 : 0;
    if (pinId === "Qbar") return this.state.qbar ? 5 : 0;
    return super.getPinVoltage(pinId);
  }
};

// ../../openhw-studio-emulator/src/components/logic-d-flipflop-dsr/logic.ts
var DFlipFlopDsrLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "prevClk", false);
    this.state = { d: false, clk: false, s: false, r: false, q: false, qbar: true };
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const d = this.getPinVoltage("D") >= 2.5;
    const clk = this.getPinVoltage("CLK") >= 2.5;
    const s = this.getPinVoltage("S") >= 2.5;
    const r = this.getPinVoltage("R") >= 2.5;
    let q = this.state.q;
    let qbar = this.state.qbar;
    if (r && s) {
      q = false;
      qbar = true;
    } else if (r) {
      q = false;
      qbar = true;
    } else if (s) {
      q = true;
      qbar = false;
    } else if (clk && !this.prevClk) {
      q = d;
      qbar = !d;
    }
    this.prevClk = clk;
    if (this.state.d !== d || this.state.clk !== clk || this.state.s !== s || this.state.r !== r || this.state.q !== q || this.state.qbar !== qbar) {
      this.state.d = d;
      this.state.clk = clk;
      this.state.s = s;
      this.state.r = r;
      this.state.q = q;
      this.state.qbar = qbar;
      this.stateChanged = true;
    }
    this.propagatePin("Q", q ? 5 : 0, wires, instances);
    this.propagatePin("Qbar", qbar ? 5 : 0, wires, instances);
  }
  propagatePin(pinId, voltage, wires, instances) {
    const pinKey = `${this.id}:${pinId}`;
    const visited = /* @__PURE__ */ new Set();
    visited.add(pinKey);
    const propagate = (key, v) => {
      for (const w of wires) {
        const match = w.from === key || w.to === key;
        if (!match) continue;
        const otherKey = w.from === key ? w.to : w.from;
        if (visited.has(otherKey)) continue;
        visited.add(otherKey);
        const [compId, compPin] = otherKey.split(":");
        const inst = instances.find((i) => i.id === compId);
        if (!inst) continue;
        if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: "INPUT" };
        inst.setPinVoltage(compPin, v);
        if (inst.type === "wokwi-resistor") {
          const otherPin = compPin === "p1" ? "p2" : "p1";
          inst.setPinVoltage(otherPin, v);
          const forwardKey = `${compId}:${otherPin}`;
          if (!visited.has(forwardKey)) {
            visited.add(forwardKey);
            propagate(forwardKey, v);
          }
        }
      }
    };
    propagate(pinKey, voltage);
  }
  getPinVoltage(pinId) {
    if (pinId === "Q") return this.state.q ? 5 : 0;
    if (pinId === "Qbar") return this.state.qbar ? 5 : 0;
    return super.getPinVoltage(pinId);
  }
};

// ../../openhw-studio-emulator/src/components/logic-clock-generator/logic.ts
var ClockGeneratorLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "lastToggleTime", 0);
    __publicField(this, "outputState", false);
    this.state = { out: false };
  }
  getFrequency() {
    let p = parseFloat(this.manifest?.attrs?.frequency) || 10;
    let u = this.manifest?.attrs?.units || "KHz";
    if (u === "KHz" || u === "kHz") p *= 1e3;
    if (u === "MHz") p *= 1e6;
    return p > 0 ? p : 1;
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const currentFreqHz = this.getFrequency();
    const periodNs = 1e9 / currentFreqHz;
    const halfNs = periodNs / 2;
    if (time - this.lastToggleTime >= halfNs) {
      this.outputState = !this.outputState;
      this.lastToggleTime += halfNs;
      if (time - this.lastToggleTime > periodNs * 2) {
        this.lastToggleTime = time;
      }
      if (this.state.out !== this.outputState) {
        this.state.out = this.outputState;
        this.stateChanged = true;
      }
    }
    this.propagatePin("OUT", this.outputState ? 5 : 0, wires, instances);
  }
  propagatePin(pinId, voltage, wires, instances) {
    const pinKey = `${this.id}:${pinId}`;
    const visited = /* @__PURE__ */ new Set();
    visited.add(pinKey);
    const propagate = (key, v) => {
      for (const w of wires) {
        const match = w.from === key || w.to === key;
        if (!match) continue;
        const otherKey = w.from === key ? w.to : w.from;
        if (visited.has(otherKey)) continue;
        visited.add(otherKey);
        const [compId, compPin] = otherKey.split(":");
        const inst = instances.find((i) => i.id === compId);
        if (!inst) continue;
        if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: "INPUT" };
        inst.setPinVoltage(compPin, v);
        if (inst.type === "wokwi-resistor") {
          const otherPin = compPin === "p1" ? "p2" : "p1";
          inst.setPinVoltage(otherPin, v);
          const forwardKey = `${compId}:${otherPin}`;
          if (!visited.has(forwardKey)) {
            visited.add(forwardKey);
            propagate(forwardKey, v);
          }
        }
      }
    };
    propagate(pinKey, voltage);
  }
  getPinVoltage(pinId) {
    if (pinId === "OUT") return this.outputState ? 5 : 0;
    return super.getPinVoltage(pinId);
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-tm1637-7segment/logic.ts
var WokwiTM1637Logic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "clkHigh", true);
    __publicField(this, "dioHigh", true);
    // TM1637 State Machine
    __publicField(this, "bitCount", 0);
    __publicField(this, "currentByte", 0);
    __publicField(this, "stateMachine", "IDLE");
    __publicField(this, "currentAddress", 0);
    __publicField(this, "writeMode", "AUTO");
    __publicField(this, "displayOn", true);
    __publicField(this, "brightness", 7);
    console.log(`[TM1637] Logic instance created for ${id}`);
    this.state = {
      digits: [0, 0, 0, 0],
      colon: false
    };
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    if (pinId === "DIO") {
      this.dioHigh = isHigh;
      if (this.clkHigh) {
        if (isHigh) {
          console.log("[TM1637] STOP");
          this.stateMachine = "IDLE";
          this.bitCount = 0;
        } else {
          console.log("[TM1637] START");
          this.bitCount = 0;
          this.currentByte = 0;
          this.stateMachine = "COMMAND";
        }
      }
    } else if (pinId === "CLK") {
      this.clkHigh = isHigh;
      if (isHigh && this.stateMachine !== "IDLE") {
        if (this.bitCount < 8) {
          if (this.dioHigh) {
            this.currentByte |= 1 << this.bitCount;
          }
          this.bitCount++;
        } else if (this.bitCount === 8) {
          console.log(`[TM1637] Received Byte: 0x${this.currentByte.toString(16).toUpperCase()}`);
          this.processByte(this.currentByte);
          this.bitCount = 0;
          this.currentByte = 0;
        }
      }
    }
  }
  processByte(data) {
    const cmdType = data & 192;
    if (cmdType === 64) {
      this.writeMode = data & 4 ? "FIXED" : "AUTO";
      this.stateMachine = "COMMAND";
    } else if (cmdType === 128) {
      this.displayOn = (data & 8) !== 0;
      this.brightness = data & 7;
      this.stateChanged = true;
      this.stateMachine = "COMMAND";
    } else if (cmdType === 192) {
      this.currentAddress = data & 15;
      this.stateMachine = "DATA";
    } else if (this.stateMachine === "DATA") {
      if (this.currentAddress < 6) {
        if (this.currentAddress < 4) {
          this.state.digits[this.currentAddress] = data & 127;
          if ((data & 128) !== 0) {
            this.state.colon = true;
          } else if (this.currentAddress === 1) {
            this.state.colon = false;
          }
          this.stateChanged = true;
        }
      }
      if (this.writeMode === "AUTO") {
        this.currentAddress++;
      }
    }
  }
  getSyncState() {
    return {
      ...this.state,
      displayOn: this.displayOn,
      brightness: this.brightness
    };
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-rgb-led/logic.ts
var RGBLEDLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "isAnode", false);
    this.state = { r: 0, g: 0, b: 0 };
    this.isAnode = manifest.attrs?.common === "anode";
  }
  onPinStateChange() {
    const commonIsAnode = this.isAnode;
    const comVolt = this.getPinVoltage("COM");
    let vr = this.getPinVoltage("R");
    let vg = this.getPinVoltage("G");
    let vb = this.getPinVoltage("B");
    let r = 0, g = 0, b = 0;
    if (commonIsAnode) {
      r = Math.max(0, comVolt - vr);
      g = Math.max(0, comVolt - vg);
      b = Math.max(0, comVolt - vb);
    } else {
      r = Math.max(0, vr - comVolt);
      g = Math.max(0, vg - comVolt);
      b = Math.max(0, vb - comVolt);
    }
    this.state.r = Math.min(255, Math.max(0, Math.floor(r / 5 * 255)));
    this.state.g = Math.min(255, Math.max(0, Math.floor(g / 5 * 255)));
    this.state.b = Math.min(255, Math.max(0, Math.floor(b / 5 * 255)));
    this.stateChanged = true;
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-nokia-5110/logic.ts
var Nokia5110Logic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "fb", new Uint8Array(504));
    __publicField(this, "x", 0);
    __publicField(this, "y", 0);
    __publicField(this, "shiftReg", 0);
    __publicField(this, "bitCount", 0);
    __publicField(this, "clkLast", false);
    this.state = { fbStr: "" };
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    if (pinId === "RST") {
      if (!isHigh) {
        this.fb.fill(0);
        this.x = 0;
        this.y = 0;
        this.updateFbStr();
      }
      return;
    }
    const ce = this.getPinVoltage("SCE") > 2.5;
    if (ce) return;
    if (pinId === "SCLK") {
      if (isHigh && !this.clkLast) {
        const din = this.getPinVoltage("DN") > 2.5 ? 1 : 0;
        this.shiftReg = (this.shiftReg << 1 | din) & 255;
        this.bitCount++;
        if (this.bitCount === 8) {
          this.processByte(this.shiftReg);
          this.bitCount = 0;
        }
      }
      this.clkLast = isHigh;
    }
  }
  processByte(byte) {
    const isData = this.getPinVoltage("DC") > 2.5;
    if (isData) {
      if (this.x < 84 && this.y < 6) {
        this.fb[this.y * 84 + this.x] = byte;
      }
      this.x++;
      if (this.x >= 84) {
        this.x = 0;
        this.y++;
        if (this.y >= 6) this.y = 0;
      }
      this.updateFbStr();
    } else {
      if ((byte & 128) === 128) {
        this.x = byte & 127;
      } else if ((byte & 64) === 64) {
        this.y = byte & 7;
      } else if ((byte & 32) === 32) {
      }
    }
  }
  updateFbStr() {
    let str = "";
    for (let i = 0; i < 504; i++) {
      str += this.fb[i].toString(16).padStart(2, "0");
    }
    this.state.fbStr = str;
    this.stateChanged = true;
  }
  onCustomTelemetry() {
    let activeBits = 0;
    for (let i = 0; i < 504; i++) {
      let b = this.fb[i];
      while (b > 0) {
        if (b & 1) activeBits++;
        b >>= 1;
      }
    }
    const totalBits = 84 * 48;
    const fillPercent = activeBits / totalBits * 100;
    this.setCustomTelemetry({
      resolution: "84x48 monochrome",
      vramFillPercentage: Number(fillPercent.toFixed(1))
    });
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-l293d/logic.ts
var L293DLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "pinData", {});
    __publicField(this, "lastUpdateCycle", 0);
    this.state = {};
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    if (!this.pinData[pinId]) {
      this.pinData[pinId] = { lastState: false, lastCycle: cpuCycles, highCycles: 0 };
    }
    const data = this.pinData[pinId];
    if (data.lastState) {
      data.highCycles += cpuCycles - data.lastCycle;
    }
    data.lastState = isHigh;
    data.lastCycle = cpuCycles;
  }
  getAverageVoltage(pinId, currentCycles, elapsedCycles) {
    const data = this.pinData[pinId];
    if (!data) return this.getPinVoltage(pinId);
    let highCyclesToCount = data.highCycles;
    if (data.lastState) {
      highCyclesToCount += currentCycles - data.lastCycle;
    }
    data.highCycles = 0;
    data.lastCycle = currentCycles;
    if (elapsedCycles <= 0) return this.getPinVoltage(pinId);
    let dutyCycle = highCyclesToCount / elapsedCycles;
    dutyCycle = Math.max(0, Math.min(1, dutyCycle));
    return dutyCycle * 5;
  }
  update(time, wires, instances) {
    super.update(time, wires, instances);
    const elapsedCycles = time - this.lastUpdateCycle;
    this.lastUpdateCycle = time;
    if (elapsedCycles <= 0) return;
    const en12 = this.getAverageVoltage("EN1,2", time, elapsedCycles);
    const in1 = this.getPinVoltage("IN1") > 2.5;
    const in2 = this.getPinVoltage("IN2") > 2.5;
    if (en12 > 0.5) {
      this.setPinVoltage("OUT1", in1 ? en12 : 0);
      this.setPinVoltage("OUT2", in2 ? en12 : 0);
    } else {
      this.setPinVoltage("OUT1", 0);
      this.setPinVoltage("OUT2", 0);
    }
    const en34 = this.getAverageVoltage("EN3,4", time, elapsedCycles);
    const in3 = this.getPinVoltage("IN3") > 2.5;
    const in4 = this.getPinVoltage("IN4") > 2.5;
    if (en34 > 0.5) {
      this.setPinVoltage("OUT3", in3 ? en34 : 0);
      this.setPinVoltage("OUT4", in4 ? en34 : 0);
    } else {
      this.setPinVoltage("OUT3", 0);
      this.setPinVoltage("OUT4", 0);
    }
    this.stateChanged = true;
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-pca9685/logic.ts
var PCA9685Logic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "sdaLast", true);
    __publicField(this, "sclLast", true);
    __publicField(this, "i2cState", "IDLE");
    __publicField(this, "bitCount", 0);
    __publicField(this, "curByte", 0);
    __publicField(this, "regAddr", 0);
    __publicField(this, "pwmRegs", new Uint8Array(256));
    __publicField(this, "i2cAddress", 64);
    this.state = {};
    if (manifest.attrs?.i2c_address) {
      this.i2cAddress = parseInt(manifest.attrs.i2c_address, 16);
    }
  }
  onPinStateChange(pinId, isHigh) {
    const sda = this.getPinVoltage("SDA") > 2.5;
    const scl = this.getPinVoltage("SCL") > 2.5;
    if (pinId === "SDA" && !sda && this.sdaLast && scl) {
      this.i2cState = "RECV_ADDR";
      this.bitCount = 0;
      this.curByte = 0;
    } else if (pinId === "SDA" && sda && !this.sdaLast && scl) {
      this.i2cState = "IDLE";
    }
    if (pinId === "SCL" && scl && !this.sclLast && this.i2cState !== "IDLE") {
      if (this.bitCount < 8) {
        this.curByte = this.curByte << 1 | (sda ? 1 : 0);
        this.bitCount++;
      } else {
        this.processI2CByte(this.curByte);
        this.bitCount = 0;
        this.curByte = 0;
      }
    }
    if (pinId === "SDA") this.sdaLast = sda;
    if (pinId === "SCL") this.sclLast = scl;
  }
  processI2CByte(byte) {
    if (this.i2cState === "RECV_ADDR") {
      const addr = byte >> 1;
      if (addr === this.i2cAddress) {
        this.i2cState = "RECV_REG";
      } else {
        this.i2cState = "IDLE";
      }
    } else if (this.i2cState === "RECV_REG") {
      this.regAddr = byte;
      this.i2cState = "RECV_DATA";
    } else if (this.i2cState === "RECV_DATA") {
      this.pwmRegs[this.regAddr] = byte;
      this.updatePWMOutputs();
      this.regAddr++;
    }
  }
  updatePWMOutputs() {
    for (let ch = 0; ch < 16; ch++) {
      const base = 6 + 4 * ch;
      const onVal = this.pwmRegs[base] | (this.pwmRegs[base + 1] & 15) << 8;
      const offVal = this.pwmRegs[base + 2] | (this.pwmRegs[base + 3] & 15) << 8;
      let duty = (offVal - onVal) / 4096;
      if (duty < 0) duty += 1;
      if (this.pwmRegs[base + 1] & 16) duty = 1;
      else if (this.pwmRegs[base + 3] & 16) duty = 0;
      this.setPinVoltage(`S${ch}`, 5 * duty);
    }
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-soil-moisture-sensor/logic.ts
var SoilMoistureSensorLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = { moisture: 50 };
  }
  onPinStateChange() {
    const vcc = this.getPinVoltage("VCC");
    if (vcc < 1) {
      this.setPinVoltage("SIG", 0);
      return;
    }
    const m = Math.max(0, Math.min(100, this.state.moisture));
    const dryVolt = vcc;
    const wetVolt = 1;
    const outSig = wetVolt + (100 - m) / 100 * (dryVolt - wetVolt);
    this.setPinVoltage("SIG", outSig);
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-photodiode/logic.ts
var PhotodiodeLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = { light: 0 };
  }
  onPinStateChange() {
    const va = this.getPinVoltage("A");
    const vc = this.getPinVoltage("C");
    if (va > vc + 0.6) {
      this.setPinVoltage("C", Math.max(0, va - 0.7));
      return;
    }
    if (vc > va) {
      const light = this.state.light;
      if (light > 0) {
        this.setPinVoltage("A", vc * light / 100);
      } else {
        this.setPinVoltage("A", 0);
      }
    }
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-diode/logic.ts
var DiodeLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = {};
  }
  getMnaPins() {
    return ["A", "C"];
  }
  getConductance() {
    const va = this.getPinVoltage("A");
    const vc = this.getPinVoltage("C");
    return va > vc + 0.6 ? 100 : 1e-9;
  }
  onPinStateChange() {
    const va = this.getPinVoltage("A");
    const vc = this.getPinVoltage("C");
    if (va > vc + 0.6) {
      this.setPinVoltage("C", Math.max(0, va - 0.7));
    } else {
    }
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-npn-transistor/logic.ts
var NPNTransistorLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = {};
  }
  onPinStateChange() {
    const vb = this.getPinVoltage("B");
    const vc = this.getPinVoltage("C");
    if (vb > 0.6) {
      this.setPinVoltage("E", Math.max(0, vc - 0.2));
    } else {
      this.setPinVoltage("E", 0);
    }
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-a4988/logic.ts
var PHASE_MAP = [
  { "1A": 1, "1B": 0, "2A": 1, "2B": 0 },
  // Step 0
  { "1A": 0, "1B": 1, "2A": 1, "2B": 0 },
  // Step 1
  { "1A": 0, "1B": 1, "2A": 0, "2B": 1 },
  // Step 2
  { "1A": 1, "1B": 0, "2A": 0, "2B": 1 }
  // Step 3
];
var A4988Logic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "stepPos", 0);
    __publicField(this, "stepPinLast", false);
    this.state = { active: false };
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    if (pinId === "STEP") {
      if (isHigh && !this.stepPinLast) {
        const enabled = this.getPinVoltage("ENABLE") < 2.5;
        const asleep = this.getPinVoltage("SLEEP") < 2.5;
        if (!asleep && enabled) {
          const dir = this.getPinVoltage("DIR") > 2.5 ? 1 : -1;
          this.stepPos = (this.stepPos + dir + 4) % 4;
          this.updateOutputs();
        }
      }
      this.stepPinLast = isHigh;
    }
    if (pinId === "ENABLE" || pinId === "SLEEP") {
      this.updateOutputs();
    }
  }
  updateOutputs() {
    const enabled = this.getPinVoltage("ENABLE") < 2.5;
    const asleep = this.getPinVoltage("SLEEP") < 2.5;
    if (asleep || !enabled) {
      this.setPinVoltage("1A", 0);
      this.setPinVoltage("1B", 0);
      this.setPinVoltage("2A", 0);
      this.setPinVoltage("2B", 0);
      this.state.active = false;
    } else {
      const phase = PHASE_MAP[this.stepPos];
      this.setPinVoltage("1A", phase["1A"] ? 5 : 0);
      this.setPinVoltage("1B", phase["1B"] ? 5 : 0);
      this.setPinVoltage("2A", phase["2A"] ? 5 : 0);
      this.setPinVoltage("2B", phase["2B"] ? 5 : 0);
      this.state.active = true;
    }
    this.stateChanged = true;
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-cd74hc4067/logic.ts
var CD74HC4067Logic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "lastAddr", -1);
    this.state = { activeChannel: -1 };
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    const en = this.getPinVoltage("EN") < 2.5;
    if (!en) {
      this.state.activeChannel = -1;
      this.lastAddr = -1;
      this.stateChanged = true;
      for (let i = 0; i < 16; i++) {
        this.setPinVoltage(`C${i}`, 0);
      }
      return;
    }
    const s0 = this.getPinVoltage("S0") > 2.5 ? 1 : 0;
    const s1 = this.getPinVoltage("S1") > 2.5 ? 1 : 0;
    const s2 = this.getPinVoltage("S2") > 2.5 ? 1 : 0;
    const s3 = this.getPinVoltage("S3") > 2.5 ? 1 : 0;
    const addr = s0 | s1 << 1 | s2 << 2 | s3 << 3;
    const sigVolt = this.getPinVoltage("SIG");
    const cVolt = this.getPinVoltage(`C${addr}`);
    if (this.lastAddr !== addr) {
      if (this.lastAddr !== -1) {
        this.setPinVoltage(`C${this.lastAddr}`, 0);
      }
      this.lastAddr = addr;
      this.state.activeChannel = addr;
      this.stateChanged = true;
      if (sigVolt > 0) this.setPinVoltage(`C${addr}`, sigVolt);
      else this.setPinVoltage("SIG", cVolt);
    } else {
      if (pinId === "SIG") {
        this.setPinVoltage(`C${addr}`, sigVolt);
      } else if (pinId === `C${addr}`) {
        this.setPinVoltage("SIG", cVolt);
      }
    }
  }
};

// ../../openhw-studio-emulator/src/components/wokwi-logic-analyzer/logic.ts
var LogicAnalyzerLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "lastVal", 0);
    this.state = { active: false };
  }
  onPinStateChange(pinId, isHigh, cpuCycles) {
    if (pinId.startsWith("D")) {
      let val = 0;
      for (let i = 0; i < 8; i++) {
        if (this.getPinVoltage(`D${i}`) > 2.5) {
          val |= 1 << i;
        }
      }
      if (val !== this.lastVal) {
        this.state.active = true;
        this.stateChanged = true;
        this.lastVal = val;
        setTimeout(() => {
          this.state.active = false;
          this.stateChanged = true;
        }, 50);
      }
    }
  }
};

// ../src/worker/execute.ts
var WASM_SOLVER_B64 = [
  "AGFzbQEAAAABBwFgA39/fwADAgEABQMBAAEHEgIGbWVtb3J5AgAFc29sdmUAAArlBAHiBAIIfwV8QQAh",
  "AwJAA0AgAyACTw0BIAMhBiADIAJBCGxsIQcgACAHIANBCGxqaiEJIAkrAwCZIQwgA0EBaiEFAkADQCAF",
  "IAJPDQEgBSACQQhsbCEIIAAgCCADQQhsamohCSAJKwMAmSENIA0gDGQEQCANIQwgBSEGCyAFQQFqIQUM",
  "AAsLIAYgA0cEQCADIAJBCGxsIQcgBiACQQhsbCEIQQAhBAJAA0AgBCACTw0BIAAgByAEQQhsamohCSAA",
  "IAggBEEIbGpqIQogCSsDACELIAkgCisDADkDACAKIAs5AwAgBEEBaiEEDAALCyABIANBCGxqIQkgASAG",
  "QQhsaiEKIAkrAwAhCyAJIAorAwA5AwAgCiALOQMACyADIAJBCGxsIQcgACAHIANBCGxqaiEJIAkrAwAh",
  "DiAOmUSsQ9LRXXIyPGMEQCADQQFqIQMMAQsgAyEEAkADQCAEIAJPDQEgACAHIARBCGxqaiEJIAkgCSsD",
  "ACAOozkDACAEQQFqIQQMAAsLIAEgA0EIbGohCSAJIAkrAwAgDqM5AwBBACEFAkADQCAFIAJPDQEgBSAD",
  "RwRAIAUgAkEIbGwhCCAAIAggA0EIbGpqIQkgCSsDACEPIA9EAAAAAAAAAABiBEAgAyEEAkADQCAEIAJP",
  "DQEgACAIIARBCGxqaiEJIAAgByAEQQhsamohCiAJIAkrAwAgDyAKKwMAoqE5AwAgBEEBaiEEDAALCyAB",
  "IAVBCGxqIQkgASADQQhsaiEKIAkgCSsDACAPIAorAwCioTkDAAsLIAVBAWohBQwACwsgA0EBaiEDDAAL",
  "CwsAXgRuYW1lAlcBABAAAWEBAWICAW4DAWkEAWoFAWsGBm1heFJvdwcEcm93SQgEcm93SwkEYWRkcgoF",
  "YWRkcjILA3RtcAwGbWF4VmFsDQN2YWwOBXBpdm90DwZmYWN0b3I="
].join("");
var Matrix = class {
  static async init() {
    if (this.wasm) return;
    try {
      const res = await WebAssembly.instantiate(Uint8Array.from(atob(WASM_SOLVER_B64), (c) => c.charCodeAt(0)));
      this.wasm = res.instance.exports;
      this.mem = res.instance.exports.memory;
    } catch (e) {
    }
  }
  static solve(A, b, n) {
    if (n <= 0) return null;
    const wasmSolve = this.wasm?.solve || this.wasm?.solveMna || this.wasm?.mnaSolve;
    if (typeof wasmSolve === "function") {
      try {
        const wasmResult = wasmSolve(A, b, n);
        if (wasmResult instanceof Float64Array && wasmResult.length >= n) {
          return wasmResult.subarray(0, n);
        }
      } catch (e) {
      }
    }
    const requiredMatrixSize = n * (n + 1);
    if (this.scratchMatrix.length < requiredMatrixSize) {
      this.scratchMatrix = new Float64Array(requiredMatrixSize);
    }
    if (this.scratchVector.length < n) {
      this.scratchVector = new Float64Array(n);
    }
    const x = this.scratchVector.subarray(0, n);
    x.fill(0);
    const matrix = this.scratchMatrix.subarray(0, requiredMatrixSize);
    matrix.fill(0);
    for (let i = 0; i < n; i++) {
      const rowOffset = i * (n + 1);
      const aOffset = i * n;
      matrix.set(A.subarray(aOffset, aOffset + n), rowOffset);
      matrix[rowOffset + n] = b[i];
    }
    for (let i = 0; i < n; i++) {
      let max = i;
      let maxVal = Math.abs(matrix[i * (n + 1) + i]);
      for (let k = i + 1; k < n; k++) {
        const val = Math.abs(matrix[k * (n + 1) + i]);
        if (val > maxVal) {
          maxVal = val;
          max = k;
        }
      }
      if (max !== i) {
        const rowI2 = i * (n + 1);
        const rowMax = max * (n + 1);
        for (let k = i; k <= n; k++) {
          const temp = matrix[rowI2 + k];
          matrix[rowI2 + k] = matrix[rowMax + k];
          matrix[rowMax + k] = temp;
        }
      }
      const rowI = i * (n + 1);
      const pivot = matrix[rowI + i];
      if (Math.abs(pivot) < 1e-18) continue;
      for (let k = i + 1; k < n; k++) {
        const rowK = k * (n + 1);
        const factor = matrix[rowK + i] / pivot;
        if (factor === 0) continue;
        for (let j = i; j <= n; j++) {
          matrix[rowK + j] -= factor * matrix[rowI + j];
        }
      }
    }
    for (let i = n - 1; i >= 0; i--) {
      const rowI = i * (n + 1);
      let sum = 0;
      for (let j = i + 1; j < n; j++) sum += matrix[rowI + j] * x[j];
      x[i] = (matrix[rowI + n] - sum) / matrix[rowI + i];
    }
    return x;
  }
};
__publicField(Matrix, "wasm", null);
__publicField(Matrix, "mem", null);
__publicField(Matrix, "scratchMatrix", new Float64Array(0));
__publicField(Matrix, "scratchVector", new Float64Array(0));
void Matrix.init();
var CircuitSolver = class {
  constructor() {
    __publicField(this, "nodes", /* @__PURE__ */ new Map());
    // pinId -> nodeId
    __publicField(this, "nodeCount", 0);
    __publicField(this, "voltageSources", []);
    __publicField(this, "components", []);
  }
  reset() {
    this.nodes.clear();
    this.nodeCount = 1;
    this.voltageSources = [];
    this.components = [];
  }
  addPin(pinId, nodeId) {
    if (nodeId !== void 0) {
      this.nodes.set(pinId, nodeId);
      return;
    }
    if (!this.nodes.has(pinId)) {
      this.nodes.set(pinId, this.nodeCount++);
    }
  }
  setGnd(pinId) {
    this.nodes.set(pinId, 0);
  }
  addVoltageSource(pinId, voltage) {
    const nodeId = this.nodes.get(pinId);
    if (nodeId !== void 0) {
      this.voltageSources.push({ nodeId, voltage });
    }
  }
  addComponent(inst) {
    this.components.push({ inst });
  }
  solve() {
    const numV = this.voltageSources.length;
    const n = this.nodeCount + numV;
    const G = new Float64Array(n * n);
    const B = new Float64Array(n);
    for (const { inst } of this.components) {
      const stamps = inst.getMnaStamps?.() || [];
      if (stamps.length === 0) {
        const pins = inst.getMnaPins?.() || [];
        if (pins.length >= 2) {
          stamps.push({ pins: [pins[0], pins[1]], g: inst.getConductance?.() ?? 1e-3 });
        }
      }
      for (const stamp of stamps) {
        const n1 = this.nodes.get(`${inst.id}:${stamp.pins[0]}`) ?? -1;
        const n2 = this.nodes.get(`${inst.id}:${stamp.pins[1]}`) ?? -1;
        const g = stamp.g;
        if (n1 >= 0) G[n1 * n + n1] += g;
        if (n2 >= 0) G[n2 * n + n2] += g;
        if (n1 >= 0 && n2 >= 0) {
          G[n1 * n + n2] -= g;
          G[n2 * n + n1] -= g;
        }
      }
    }
    for (let i = 0; i < numV; i++) {
      const { nodeId, voltage } = this.voltageSources[i];
      const vIdx = this.nodeCount + i;
      if (nodeId >= 0) {
        G[nodeId * n + vIdx] = 1;
        G[vIdx * n + nodeId] = 1;
      }
      B[vIdx] = voltage;
    }
    for (let j = 0; j < n; j++) G[0 * n + j] = 0;
    G[0 * n + 0] = 1;
    B[0] = 0;
    const results = Matrix.solve(G, B, n);
    const nodeVoltages = /* @__PURE__ */ new Map();
    if (results) {
      for (let i = 0; i < this.nodeCount; i++) {
        nodeVoltages.set(i, results[i]);
      }
    }
    return nodeVoltages;
  }
};
var KeypadLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    this.state = { pressedKey: null, connectedPair: null };
  }
  onEvent(event) {
    if (event.startsWith("press:")) {
      const key = event.split(":")[1];
      const matrix = {
        "1": ["R1", "C1"],
        "2": ["R1", "C2"],
        "3": ["R1", "C3"],
        "A": ["R1", "C4"],
        "4": ["R2", "C1"],
        "5": ["R2", "C2"],
        "6": ["R2", "C3"],
        "B": ["R2", "C4"],
        "7": ["R3", "C1"],
        "8": ["R3", "C2"],
        "9": ["R3", "C3"],
        "C": ["R3", "C4"],
        "*": ["R4", "C1"],
        "0": ["R4", "C2"],
        "#": ["R4", "C3"],
        "D": ["R4", "C4"]
      };
      this.setState({ pressedKey: key, connectedPair: matrix[key] || null });
    } else if (event === "release") {
      this.setState({ pressedKey: null, connectedPair: null });
    }
  }
};
function parse(data) {
  const lines = data.split("\n");
  let highAddress = 0;
  const maxAddress = 32768;
  const result = new Uint8Array(maxAddress);
  for (const line of lines) {
    if (line[0] !== ":") continue;
    const byteCount = parseInt(line.substring(1, 3), 16);
    const address = parseInt(line.substring(3, 7), 16);
    const recordType = parseInt(line.substring(7, 9), 16);
    if (recordType === 0) {
      for (let i = 0; i < byteCount; i++) {
        const byte = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
        const absoluteAddress = highAddress + address + i;
        if (absoluteAddress < maxAddress) {
          result[absoluteAddress] = byte;
        }
      }
    } else if (recordType === 4 || recordType === 2) {
      highAddress = parseInt(line.substring(9, 13), 16) << (recordType === 4 ? 16 : 4);
    }
  }
  return { data: result };
}
var LITTLEFS_MODULE_NAME = "littlefs";
var SD_BLOCK_SIZE = 512;
var SD_DATA_TOKEN = 254;
function toUint8Array(data, encoder) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (Array.isArray(data)) return new Uint8Array(data.map((v) => Number(v) & 255));
  return encoder.encode(String(data ?? ""));
}
async function tryLoadLittleFsFactory() {
  try {
    const mod = await import(
      /* @vite-ignore */
      LITTLEFS_MODULE_NAME
    );
    const candidate = mod?.default ?? mod;
    return typeof candidate === "function" ? candidate : null;
  } catch {
    return null;
  }
}
function isNodeRuntime() {
  return typeof process !== "undefined" && !!process?.versions?.node;
}
async function dynamicImportModule(specifier) {
  const importer = new Function("s", "return import(s);");
  return importer(specifier);
}
async function readLittleFsWasmBinaryForNode() {
  if (!isNodeRuntime()) return null;
  let readFile = null;
  try {
    const fsPromises = await dynamicImportModule("node:fs/promises");
    readFile = typeof fsPromises?.readFile === "function" ? fsPromises.readFile.bind(fsPromises) : null;
  } catch {
    return null;
  }
  if (!readFile) return null;
  const candidates = [
    new URL("../../node_modules/littlefs/dist/littlefs.wasm", import.meta.url),
    new URL("../node_modules/littlefs/dist/littlefs.wasm", import.meta.url),
    new URL("./node_modules/littlefs/dist/littlefs.wasm", import.meta.url)
  ];
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    const key = String(candidate?.href || candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    try {
      const buf = await readFile(candidate);
      if (!buf) continue;
      if (buf instanceof Uint8Array) {
        return buf.length > 0 ? buf : null;
      }
      if (buf instanceof ArrayBuffer) {
        const out = new Uint8Array(buf);
        return out.length > 0 ? out : null;
      }
      if (ArrayBuffer.isView(buf)) {
        const view = buf;
        const out = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        return out.length > 0 ? out : null;
      }
    } catch {
    }
  }
  return null;
}
function createLittleFsVolume(littlefs2, storage, blockSize, blockCount) {
  if (!littlefs2 || typeof littlefs2.addFunction !== "function" || typeof littlefs2._new_lfs !== "function" || typeof littlefs2._new_lfs_config !== "function") {
    return null;
  }
  if (typeof littlefs2._lfs_mount !== "function" || typeof littlefs2._lfs_unmount !== "function" || typeof littlefs2._lfs_format !== "function") {
    return null;
  }
  const tablePointers = [];
  const addFn = (fn, signature) => {
    const ptr = Number(littlefs2.addFunction(fn, signature));
    tablePointers.push(ptr);
    return ptr;
  };
  const read = addFn((cfg, block, off, buffer, size) => {
    void cfg;
    const start = block * blockSize + off;
    if (start < 0 || start + size > storage.length) return -5;
    littlefs2.HEAPU8.set(storage.subarray(start, start + size), buffer);
    return 0;
  }, "iiiiii");
  const prog = addFn((cfg, block, off, buffer, size) => {
    void cfg;
    const start = block * blockSize + off;
    if (start < 0 || start + size > storage.length) return -5;
    storage.set(littlefs2.HEAPU8.subarray(buffer, buffer + size), start);
    return 0;
  }, "iiiiii");
  const erase = addFn((cfg, block) => {
    void cfg;
    const start = block * blockSize;
    if (start < 0 || start + blockSize > storage.length) return -5;
    storage.fill(255, start, start + blockSize);
    return 0;
  }, "iii");
  const sync = addFn((cfg) => {
    void cfg;
    return 0;
  }, "ii");
  const config = Number(littlefs2._new_lfs_config(read, prog, erase, sync, blockCount, blockSize));
  const lfs = Number(littlefs2._new_lfs());
  if (!Number.isFinite(config) || !Number.isFinite(lfs) || config <= 0 || lfs <= 0) {
    return null;
  }
  const cwrapWrite = typeof littlefs2.cwrap === "function" ? littlefs2.cwrap("lfs_write_file", null, ["number", "string", "number", "number"]) : null;
  const mount = () => Number(littlefs2._lfs_mount(lfs, config) ?? -1);
  const unmount = () => Number(littlefs2._lfs_unmount(lfs) ?? -1);
  const format = () => Number(littlefs2._lfs_format(lfs, config) ?? -1);
  const formatAndMount = () => {
    const fr = format();
    if (fr < 0) return fr;
    return mount();
  };
  const writeFile = (path, data) => {
    if (typeof cwrapWrite !== "function") {
      return false;
    }
    const hasMalloc = typeof littlefs2._malloc === "function" && typeof littlefs2._free === "function";
    const hasStack = typeof littlefs2.stackAlloc === "function" && typeof littlefs2.stackSave === "function" && typeof littlefs2.stackRestore === "function";
    if (!hasMalloc && !hasStack) {
      return false;
    }
    let ptr = 0;
    let stackTop = null;
    let usedStack = false;
    try {
      const size = data.length;
      if (hasMalloc) {
        ptr = Number(littlefs2._malloc(Math.max(size, 1)));
      } else {
        stackTop = Number(littlefs2.stackSave());
        ptr = Number(littlefs2.stackAlloc(Math.max(size, 1)));
        usedStack = true;
      }
      if (!Number.isFinite(ptr) || ptr <= 0) return false;
      if (size > 0) {
        littlefs2.HEAPU8.set(data, ptr);
      }
      cwrapWrite(lfs, path, ptr, size);
      return true;
    } catch {
      return false;
    } finally {
      if (hasMalloc && ptr > 0) {
        try {
          littlefs2._free(ptr);
        } catch {
        }
      }
      if (usedStack && stackTop !== null) {
        try {
          littlefs2.stackRestore(stackTop);
        } catch {
        }
      }
    }
  };
  const mkdir = (path) => {
    if (typeof littlefs2._lfs_mkdir !== "function") {
      return false;
    }
    try {
      const rc = Number(littlefs2._lfs_mkdir(lfs, path));
      return rc === 0 || rc === -17;
    } catch {
      return false;
    }
  };
  const destroy = () => {
    try {
      if (typeof littlefs2._free === "function") {
        littlefs2._free(lfs);
        littlefs2._free(config);
      }
    } catch {
    }
    if (typeof littlefs2.removeFunction === "function") {
      tablePointers.forEach((ptr) => {
        try {
          littlefs2.removeFunction(ptr);
        } catch {
        }
      });
    }
  };
  return {
    mount,
    unmount,
    format,
    formatAndMount,
    mkdir,
    writeFile,
    destroy
  };
}
function normalizeLittleFsPath(rawPath) {
  const cleaned = String(rawPath || "").replace(/\\/g, "/").trim();
  if (!cleaned) return "";
  const parts = cleaned.split("/").map((part) => part.trim()).filter((part) => part && part !== "." && part !== "..");
  return parts.join("/");
}
function collectLittleFsParentDirs(path) {
  const normalized = normalizeLittleFsPath(path);
  if (!normalized || !normalized.includes("/")) return [];
  const parts = normalized.split("/");
  const dirs = [];
  for (let i = 1; i < parts.length; i++) {
    const dir = parts.slice(0, i).join("/");
    if (dir) dirs.push(dir);
  }
  return dirs;
}
async function buildLittleFsImage(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) return null;
  const blockSizeRaw = Number(options.blockSize);
  const blockSize = Number.isFinite(blockSizeRaw) && blockSizeRaw >= 256 ? Math.floor(blockSizeRaw) : 4096;
  const sizeBytesRaw = Number(options.sizeBytes);
  const requestedSize = Number.isFinite(sizeBytesRaw) && sizeBytesRaw > 0 ? Math.floor(sizeBytesRaw) : 512 * 1024;
  const alignedSize = Math.ceil(requestedSize / blockSize) * blockSize;
  const blockCount = Math.max(1, Math.floor(alignedSize / blockSize));
  const storage = new Uint8Array(blockCount * blockSize);
  storage.fill(255);
  const factory = await tryLoadLittleFsFactory();
  if (!factory) return null;
  let littlefsModule = null;
  let volume = null;
  try {
    const env = { print: () => {
    }, printErr: () => {
    } };
    if (isNodeRuntime()) {
      const nodeWasm = await readLittleFsWasmBinaryForNode();
      if (nodeWasm && nodeWasm.length > 0) env.wasmBinary = nodeWasm;
    }
    littlefsModule = await factory(env);
    volume = createLittleFsVolume(littlefsModule, storage, blockSize, blockCount);
    if (!volume || volume.formatAndMount() < 0) return null;
    const createdDirs = /* @__PURE__ */ new Set();
    const encoder = new TextEncoder();
    for (const file of files) {
      const path = normalizeLittleFsPath(file?.path);
      if (!path) continue;
      const parentDirs = collectLittleFsParentDirs(path);
      for (const dir of parentDirs) {
        if (createdDirs.has(dir)) continue;
        if (!volume.mkdir(`/${dir}`) && !volume.mkdir(dir)) {
          return null;
        }
        createdDirs.add(dir);
      }
      const data = toUint8Array(file?.data, encoder);
      if (!volume.writeFile(`/${path}`, data) && !volume.writeFile(path, data)) {
        return null;
      }
    }
    volume.unmount();
    return storage.slice();
  } catch {
    return null;
  } finally {
    try {
      volume?.destroy();
    } catch {
    }
    try {
      if (littlefs && typeof littlefs.quit === "function") {
        littlefs.quit();
      }
    } catch {
    }
  }
}
var FAT_BYTES_PER_SECTOR = 512;
var FAT12_MEDIA_DESCRIPTOR = 248;
function sanitizeFatNameToken(value, maxLength) {
  const upper = String(value || "").trim().toUpperCase();
  const cleaned = upper.replace(/[^A-Z0-9]/g, "_");
  if (!cleaned) return "".padEnd(maxLength, "_");
  return cleaned.slice(0, maxLength);
}
function normalizeFatVolumeLabel(value) {
  const cleaned = sanitizeFatNameToken(String(value || "CIRCUITPY").replace(/\./g, ""), 11);
  return cleaned.padEnd(11, " ");
}
function toFatShortFileName(pathLike) {
  const normalized = normalizeLittleFsPath(pathLike);
  const baseName = (normalized.split("/").pop() || normalized || "FILE.TXT").trim();
  const dotIndex = baseName.lastIndexOf(".");
  const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
  const ext = dotIndex > 0 ? baseName.slice(dotIndex + 1) : "";
  const shortStem = sanitizeFatNameToken(stem, 8).padEnd(8, " ");
  const shortExt = sanitizeFatNameToken(ext, 3).padEnd(3, " ");
  return `${shortStem}${shortExt}`;
}
function setFat12Entry(fat, cluster, value) {
  const index = Math.floor(cluster * 3 / 2);
  const safeValue = value & 4095;
  if ((cluster & 1) === 0) {
    fat[index] = safeValue & 255;
    fat[index + 1] = fat[index + 1] & 240 | safeValue >> 8 & 15;
  } else {
    fat[index] = fat[index] & 15 | safeValue << 4 & 240;
    fat[index + 1] = safeValue >> 4 & 255;
  }
}
function buildFatFsImage(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) return null;
  const sizeBytesRaw = Number(options.sizeBytes);
  const requestedSize = Number.isFinite(sizeBytesRaw) && sizeBytesRaw > 0 ? Math.floor(sizeBytesRaw) : 512 * 1024;
  const alignedSize = Math.floor(requestedSize / FAT_BYTES_PER_SECTOR) * FAT_BYTES_PER_SECTOR;
  if (alignedSize < 128 * 1024) return null;
  const bytesPerSector = FAT_BYTES_PER_SECTOR;
  const totalSectors = Math.floor(alignedSize / bytesPerSector);
  const reservedSectors = 1;
  const numberOfFATs = 2;
  const rootEntryCount = 512;
  const rootDirSectors = Math.ceil(rootEntryCount * 32 / bytesPerSector);
  const sectorsPerClusterRaw = Number(options.sectorsPerCluster);
  const sectorsPerCluster = Number.isFinite(sectorsPerClusterRaw) && sectorsPerClusterRaw > 0 ? Math.max(1, Math.floor(sectorsPerClusterRaw)) : 1;
  const clusterSizeBytes = sectorsPerCluster * bytesPerSector;
  let sectorsPerFAT = 1;
  let clusterCount = 0;
  for (let i = 0; i < 8; i++) {
    const dataSectors = totalSectors - reservedSectors - numberOfFATs * sectorsPerFAT - rootDirSectors;
    if (dataSectors <= 0) return null;
    clusterCount = Math.floor(dataSectors / sectorsPerCluster);
    const requiredFatSectors = Math.max(
      1,
      Math.ceil((clusterCount + 2) * 12 / 8 / bytesPerSector)
    );
    if (requiredFatSectors === sectorsPerFAT) break;
    sectorsPerFAT = requiredFatSectors;
  }
  if (clusterCount <= 0 || clusterCount >= 4080) {
    return null;
  }
  const encoder = new TextEncoder();
  const normalizedFiles = files.map((file, index) => ({
    index,
    shortName: toFatShortFileName(file?.path || `FILE${index}.TXT`),
    bytes: toUint8Array(file?.data, encoder)
  })).filter((file) => !!file.shortName);
  if (normalizedFiles.length === 0) return null;
  if (normalizedFiles.length > rootEntryCount - 1) return null;
  const usedShortNames = /* @__PURE__ */ new Set();
  for (const file of normalizedFiles) {
    if (!usedShortNames.has(file.shortName)) {
      usedShortNames.add(file.shortName);
      continue;
    }
    const stem = file.shortName.slice(0, 8).trim() || "FILE";
    const ext = file.shortName.slice(8, 11);
    let suffix = 1;
    while (suffix < 1e3) {
      const candidateStem = `${stem.slice(0, Math.max(0, 8 - String(suffix).length))}${suffix}`.padEnd(8, " ");
      const candidate = `${candidateStem}${ext}`;
      if (!usedShortNames.has(candidate)) {
        file.shortName = candidate;
        usedShortNames.add(candidate);
        break;
      }
      suffix += 1;
    }
  }
  let nextCluster = 2;
  const fileLayouts = normalizedFiles.map((file) => {
    const clusterSpan = file.bytes.length > 0 ? Math.ceil(file.bytes.length / clusterSizeBytes) : 0;
    const firstCluster = clusterSpan > 0 ? nextCluster : 0;
    if (clusterSpan > 0) {
      nextCluster += clusterSpan;
    }
    return {
      ...file,
      firstCluster,
      clusterSpan
    };
  });
  if (nextCluster > clusterCount + 2) {
    return null;
  }
  const fatByteLength = sectorsPerFAT * bytesPerSector;
  const fat = new Uint8Array(fatByteLength);
  fat.fill(0);
  fat[0] = FAT12_MEDIA_DESCRIPTOR;
  fat[1] = 255;
  fat[2] = 255;
  for (const file of fileLayouts) {
    if (file.clusterSpan <= 0 || file.firstCluster <= 0) continue;
    for (let i = 0; i < file.clusterSpan; i++) {
      const cluster = file.firstCluster + i;
      const nextValue = i === file.clusterSpan - 1 ? 4095 : cluster + 1;
      setFat12Entry(fat, cluster, nextValue);
    }
  }
  const image = new Uint8Array(alignedSize);
  image.fill(0);
  const boot = image.subarray(0, bytesPerSector);
  const bootView = new DataView(boot.buffer, boot.byteOffset, boot.byteLength);
  boot[0] = 235;
  boot[1] = 60;
  boot[2] = 144;
  boot.set(encoder.encode("MSDOS5.0").subarray(0, 8), 3);
  bootView.setUint16(11, bytesPerSector, true);
  boot[13] = sectorsPerCluster & 255;
  bootView.setUint16(14, reservedSectors, true);
  boot[16] = numberOfFATs & 255;
  bootView.setUint16(17, rootEntryCount, true);
  if (totalSectors < 65536) {
    bootView.setUint16(19, totalSectors, true);
    bootView.setUint32(32, 0, true);
  } else {
    bootView.setUint16(19, 0, true);
    bootView.setUint32(32, totalSectors, true);
  }
  boot[21] = FAT12_MEDIA_DESCRIPTOR;
  bootView.setUint16(22, sectorsPerFAT, true);
  bootView.setUint16(24, 32, true);
  bootView.setUint16(26, 64, true);
  bootView.setUint32(28, 0, true);
  boot[36] = 128;
  boot[38] = 41;
  bootView.setUint32(39, 1128878659, true);
  boot.set(encoder.encode(normalizeFatVolumeLabel(options.volumeLabel)).subarray(0, 11), 43);
  boot.set(encoder.encode("FAT12   ").subarray(0, 8), 54);
  boot[510] = 85;
  boot[511] = 170;
  const fat1Offset = reservedSectors * bytesPerSector;
  const fat2Offset = fat1Offset + fatByteLength;
  image.set(fat, fat1Offset);
  image.set(fat, fat2Offset);
  const rootOffset = (reservedSectors + numberOfFATs * sectorsPerFAT) * bytesPerSector;
  const rootByteLength = rootDirSectors * bytesPerSector;
  const root = image.subarray(rootOffset, rootOffset + rootByteLength);
  root.fill(0);
  const volumeLabel = normalizeFatVolumeLabel(options.volumeLabel);
  root.set(encoder.encode(volumeLabel).subarray(0, 11), 0);
  root[11] = 8;
  let entryIndex = 1;
  for (const file of fileLayouts) {
    const entryOffset = entryIndex * 32;
    if (entryOffset + 32 > root.length) break;
    root.set(encoder.encode(file.shortName).subarray(0, 11), entryOffset);
    root[entryOffset + 11] = 32;
    const rootView = new DataView(root.buffer, root.byteOffset + entryOffset, 32);
    rootView.setUint16(26, file.firstCluster & 65535, true);
    rootView.setUint32(28, file.bytes.length >>> 0, true);
    entryIndex += 1;
  }
  const dataStartOffset = (reservedSectors + numberOfFATs * sectorsPerFAT + rootDirSectors) * bytesPerSector;
  for (const file of fileLayouts) {
    if (file.clusterSpan <= 0 || file.firstCluster <= 0 || file.bytes.length === 0) continue;
    for (let i = 0; i < file.clusterSpan; i++) {
      const cluster = file.firstCluster + i;
      const clusterOffset = dataStartOffset + (cluster - 2) * clusterSizeBytes;
      const srcStart = i * clusterSizeBytes;
      const srcEnd = Math.min(file.bytes.length, srcStart + clusterSizeBytes);
      image.set(file.bytes.subarray(srcStart, srcEnd), clusterOffset);
    }
  }
  return image;
}
var SDCardLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "powered", false);
    __publicField(this, "csHigh", true);
    __publicField(this, "mounted", true);
    __publicField(this, "appCmdPending", false);
    __publicField(this, "responseQueue", []);
    __publicField(this, "commandFrame", []);
    __publicField(this, "writeState", null);
    __publicField(this, "bytesIn", 0);
    __publicField(this, "bytesOut", 0);
    __publicField(this, "lastActivityAt", 0);
    __publicField(this, "textEncoder", new TextEncoder());
    __publicField(this, "textDecoder", new TextDecoder());
    __publicField(this, "blockSize", SD_BLOCK_SIZE);
    __publicField(this, "blockCount");
    __publicField(this, "storage");
    __publicField(this, "backendName", "memory");
    __publicField(this, "littleFsReady", false);
    __publicField(this, "littleFsVolume", null);
    __publicField(this, "files", /* @__PURE__ */ new Map());
    const capacityKbRaw = Number(manifest?.attrs?.capacityKB ?? 2048);
    const capacityKB = Number.isFinite(capacityKbRaw) && capacityKbRaw > 64 ? Math.floor(capacityKbRaw) : 2048;
    this.blockCount = Math.max(64, Math.floor(capacityKB * 1024 / this.blockSize));
    this.storage = new Uint8Array(this.blockCount * this.blockSize);
    this.storage.fill(255);
    this.mounted = String(manifest?.attrs?.mounted ?? "true") !== "false";
    this.writeShadowFile("/README.TXT", this.textEncoder.encode("OpenHW virtual SD card\n"));
    this.state = {
      mounted: this.mounted,
      powered: false,
      selected: false,
      activity: false,
      backend: this.backendName,
      fsReady: this.littleFsReady,
      fileCount: this.files.size,
      usedBytes: this.computeUsedBytes(),
      bytesIn: 0,
      bytesOut: 0,
      capacityKB,
      blockSize: this.blockSize,
      blockCount: this.blockCount,
      lastCommand: "--",
      lastPath: "--",
      lastOp: "idle",
      lastReadPreview: ""
    };
    void this.initLittleFsBackend();
  }
  normalizePath(pathLike) {
    const raw = String(pathLike || "").trim().replace(/\\/g, "/");
    if (!raw) return "/UNTITLED.TXT";
    return raw.startsWith("/") ? raw : `/${raw}`;
  }
  computeUsedBytes() {
    let total = 0;
    this.files.forEach((v) => {
      total += v.length;
    });
    return total;
  }
  updateFsCounters() {
    this.state.fileCount = this.files.size;
    this.state.usedBytes = this.computeUsedBytes();
    this.stateChanged = true;
  }
  writeShadowFile(path, bytes) {
    this.files.set(this.normalizePath(path), new Uint8Array(bytes));
    this.updateFsCounters();
  }
  refreshPowerState() {
    const nextPowered = this.getPinVoltage("VCC") > 2;
    if (nextPowered !== this.powered) {
      this.powered = nextPowered;
      this.state.powered = this.powered;
      this.stateChanged = true;
    }
  }
  resetSpiTransactionState() {
    this.appCmdPending = false;
    this.responseQueue = [];
    this.commandFrame = [];
    this.writeState = null;
  }
  setMounted(nextMounted) {
    if (this.mounted === nextMounted) return;
    this.mounted = nextMounted;
    this.state.mounted = nextMounted;
    if (!nextMounted) {
      this.resetSpiTransactionState();
    }
    this.stateChanged = true;
  }
  queueResponse(bytes) {
    this.responseQueue.push(...bytes.map((v) => v & 255));
  }
  emitResponseByte() {
    const out = this.responseQueue.length > 0 ? this.responseQueue.shift() : 255;
    this.bytesOut += 1;
    this.state.bytesOut = this.bytesOut;
    this.stateChanged = true;
    return out & 255;
  }
  parseBlockIndex(commandArg) {
    const asBlockAddress = commandArg >>> 0;
    if (asBlockAddress < this.blockCount) return asBlockAddress;
    const byByteAddress = Math.floor((commandArg >>> 0) / this.blockSize);
    if (byByteAddress >= 0 && byByteAddress < this.blockCount) {
      return byByteAddress;
    }
    return null;
  }
  queueReadBlock(blockIndex) {
    const start = blockIndex * this.blockSize;
    const payload = this.storage.subarray(start, start + this.blockSize);
    this.queueResponse([0, 255, SD_DATA_TOKEN, ...payload, 255, 255]);
  }
  beginWriteBlock(blockIndex) {
    this.writeState = {
      blockIndex,
      stage: "token",
      data: []
    };
    this.queueResponse([0]);
  }
  completeWriteBlock() {
    if (!this.writeState) return;
    const { blockIndex, data } = this.writeState;
    const start = blockIndex * this.blockSize;
    const payload = data.length >= this.blockSize ? data.slice(0, this.blockSize) : [...data, ...new Array(this.blockSize - data.length).fill(255)];
    this.storage.set(Uint8Array.from(payload), start);
    this.writeState = null;
    this.queueResponse([5, 255]);
    this.state.lastOp = "write-block";
    this.stateChanged = true;
  }
  handleWriteByte(value) {
    if (!this.writeState) return;
    const byte = value & 255;
    if (this.writeState.stage === "token") {
      if (byte === SD_DATA_TOKEN) {
        this.writeState.stage = "payload";
      }
      return;
    }
    if (this.writeState.stage === "payload") {
      this.writeState.data.push(byte);
      if (this.writeState.data.length >= this.blockSize) {
        this.writeState.stage = "crc1";
      }
      return;
    }
    if (this.writeState.stage === "crc1") {
      this.writeState.stage = "crc2";
      return;
    }
    if (this.writeState.stage === "crc2") {
      this.completeWriteBlock();
    }
  }
  handleCommandFrame(frame) {
    const commandByte = frame[0] & 255;
    const command = commandByte & 63;
    const arg = (frame[1] << 24 | frame[2] << 16 | frame[3] << 8 | frame[4]) >>> 0;
    this.state.lastCommand = `CMD${String(command).padStart(2, "0")}`;
    if (command === 0) {
      this.appCmdPending = false;
      this.queueResponse([1]);
      return;
    }
    if (command === 8) {
      this.queueResponse([1, 0, 0, 1, 170]);
      return;
    }
    if (command === 55) {
      this.appCmdPending = true;
      this.queueResponse([1]);
      return;
    }
    if (command === 41 && this.appCmdPending) {
      this.appCmdPending = false;
      this.queueResponse([0]);
      return;
    }
    if (command === 58) {
      this.queueResponse([0, 64, 0, 0, 0]);
      return;
    }
    if (command === 17) {
      const blockIndex = this.parseBlockIndex(arg);
      if (blockIndex === null) {
        this.queueResponse([4]);
      } else {
        this.queueReadBlock(blockIndex);
        this.state.lastOp = "read-block";
      }
      this.stateChanged = true;
      return;
    }
    if (command === 24) {
      const blockIndex = this.parseBlockIndex(arg);
      if (blockIndex === null) {
        this.queueResponse([4]);
      } else {
        this.beginWriteBlock(blockIndex);
        this.state.lastOp = "write-block";
      }
      this.stateChanged = true;
      return;
    }
    this.queueResponse([0]);
  }
  async initLittleFsBackend() {
    const factory = await tryLoadLittleFsFactory();
    if (!factory) return;
    try {
      const littlefs2 = await factory({});
      const volume = createLittleFsVolume(littlefs2, this.storage, this.blockSize, this.blockCount);
      if (!volume) return;
      const rc = volume.formatAndMount();
      if (rc < 0) {
        volume.destroy();
        return;
      }
      this.littleFsVolume = volume;
      this.backendName = "littlefs-wasm";
      this.littleFsReady = true;
      this.files.forEach((data, path) => {
        volume.writeFile(path, data);
      });
      this.state.backend = this.backendName;
      this.state.fsReady = true;
      this.stateChanged = true;
    } catch {
    }
  }
  formatCard() {
    this.storage.fill(255);
    this.files.clear();
    this.writeShadowFile("/README.TXT", this.textEncoder.encode("OpenHW virtual SD card\n"));
    if (this.littleFsVolume && this.littleFsReady) {
      try {
        this.littleFsVolume.formatAndMount();
        this.files.forEach((data, path) => {
          this.littleFsVolume.writeFile(path, data);
        });
      } catch {
      }
    }
    this.state.lastOp = "format";
    this.state.lastPath = "/";
    this.stateChanged = true;
  }
  writeFile(pathLike, data) {
    const path = this.normalizePath(pathLike);
    const bytes = toUint8Array(data, this.textEncoder);
    this.writeShadowFile(path, bytes);
    if (this.littleFsVolume && this.littleFsReady) {
      this.littleFsVolume.writeFile(path, bytes);
    }
    this.state.lastPath = path;
    this.state.lastOp = "write-file";
    this.stateChanged = true;
  }
  readFile(pathLike) {
    const path = this.normalizePath(pathLike);
    const found = this.files.get(path) || null;
    if (!found) {
      this.state.lastPath = path;
      this.state.lastOp = "read-miss";
      this.state.lastReadPreview = "";
      this.stateChanged = true;
      return null;
    }
    const previewBytes = found.subarray(0, Math.min(found.length, 80));
    this.state.lastPath = path;
    this.state.lastOp = "read-file";
    this.state.lastReadPreview = this.textDecoder.decode(previewBytes);
    this.stateChanged = true;
    return new Uint8Array(found);
  }
  onPinStateChange(pinId, isHigh) {
    const pin = String(pinId || "").toUpperCase();
    if (pin === "CS") {
      this.csHigh = isHigh;
      this.state.selected = !this.csHigh;
      if (this.csHigh) {
        this.commandFrame = [];
        this.writeState = null;
      }
      this.stateChanged = true;
      return;
    }
    if (pin === "VCC" || pin === "GND") {
      this.refreshPowerState();
    }
  }
  onEvent(event) {
    const type = String(event?.type || "").toUpperCase();
    if (!type) return;
    if (type === "SD_MOUNT" || type === "MOUNT") {
      this.setMounted(true);
      this.state.lastOp = "mount";
      return;
    }
    if (type === "SD_UNMOUNT" || type === "UNMOUNT" || type === "EJECT") {
      this.setMounted(false);
      this.state.lastOp = "unmount";
      return;
    }
    if (type === "SD_FORMAT" || type === "FORMAT") {
      this.formatCard();
      return;
    }
    if (type === "SD_WRITE_FILE" || type === "WRITE_FILE") {
      this.writeFile(event?.path || event?.name || "/LOG.TXT", event?.data ?? event?.content ?? "");
      return;
    }
    if (type === "SD_READ_FILE" || type === "READ_FILE") {
      this.readFile(event?.path || event?.name || "/README.TXT");
      return;
    }
    if (type === "SD_DELETE_FILE" || type === "DELETE_FILE") {
      const path = this.normalizePath(event?.path || event?.name || "");
      if (this.files.delete(path)) {
        this.state.lastPath = path;
        this.state.lastOp = "delete-file";
        this.updateFsCounters();
        this.stateChanged = true;
      }
    }
  }
  onSPIByte(value) {
    this.refreshPowerState();
    if (!this.mounted || !this.powered || this.csHigh) {
      return 255;
    }
    const byte = value & 255;
    this.lastActivityAt = Date.now();
    this.bytesIn += 1;
    this.state.bytesIn = this.bytesIn;
    if (this.responseQueue.length > 0) {
      return this.emitResponseByte();
    }
    if (this.writeState) {
      this.handleWriteByte(byte);
      return this.emitResponseByte();
    }
    if (this.commandFrame.length === 0) {
      if ((byte & 192) === 64) {
        this.commandFrame.push(byte);
      } else if (byte === 159) {
        this.queueResponse([83, 68, 48]);
      }
      return this.emitResponseByte();
    }
    this.commandFrame.push(byte);
    if (this.commandFrame.length >= 6) {
      const frame = this.commandFrame.slice(0, 6);
      this.commandFrame = [];
      this.handleCommandFrame(frame);
    }
    return this.emitResponseByte();
  }
  update() {
    this.refreshPowerState();
    const active = Date.now() - this.lastActivityAt < 120;
    if (this.state.activity !== active) {
      this.state.activity = active;
      this.stateChanged = true;
    }
    const fileCount = this.files.size;
    if (this.state.fileCount !== fileCount) {
      this.state.fileCount = fileCount;
      this.stateChanged = true;
    }
    const usedBytes = this.computeUsedBytes();
    if (this.state.usedBytes !== usedBytes) {
      this.state.usedBytes = usedBytes;
      this.stateChanged = true;
    }
  }
};
var GenericI2CDeviceLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "address");
    __publicField(this, "readQueue", []);
    const type = String(manifest?.type || "").toLowerCase();
    const defaultAddress = type === "wokwi-lcd2004-i2c" ? 39 : type === "max30102" ? 87 : 60;
    const rawAddress = Number(
      manifest?.attrs?.address ?? manifest?.attrs?.i2cAddress ?? manifest?.attrs?.addr ?? defaultAddress
    );
    this.address = Number.isFinite(rawAddress) ? rawAddress & 127 : defaultAddress;
    this.state = {
      ...this.state,
      i2cAddress: this.address,
      i2cRxBytes: 0,
      i2cTxBytes: 0,
      lastWrite: 0,
      lastRead: 255
    };
  }
  onI2CStart(address, read) {
    const ack = (address & 127) === this.address;
    this.state.lastReadMode = !!read;
    this.stateChanged = true;
    return ack;
  }
  onI2CByte(_address, data) {
    const byte = data & 255;
    this.state.lastWrite = byte;
    this.state.i2cRxBytes = Number(this.state.i2cRxBytes || 0) + 1;
    this.stateChanged = true;
    if (this.readQueue.length < 32) {
      this.readQueue.push(byte);
    }
    return true;
  }
  onI2CReadByte() {
    const byte = this.readQueue.length > 0 ? this.readQueue.shift() : Number(this.state.defaultReadByte ?? 255) & 255;
    this.state.lastRead = byte;
    this.state.i2cTxBytes = Number(this.state.i2cTxBytes || 0) + 1;
    this.stateChanged = true;
    return byte;
  }
};
var GenericSPIDeviceLogic = class extends BaseComponent {
  onSPIByte(data) {
    const byte = data & 255;
    this.state.lastWrite = byte;
    this.state.spiRxBytes = Number(this.state.spiRxBytes || 0) + 1;
    this.stateChanged = true;
    const response = Number(this.state.defaultReadByte ?? this.state.spiResponse ?? 255);
    return Number.isFinite(response) ? response & 255 : 255;
  }
};
var SSD1306FallbackLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "vram");
    __publicField(this, "i2cAddress", 60);
    __publicField(this, "isAddressed", false);
    __publicField(this, "awaitingControlByte", true);
    __publicField(this, "isDataMode", false);
    __publicField(this, "burstMode", false);
    __publicField(this, "addressingMode", 2);
    __publicField(this, "pageStart", 0);
    __publicField(this, "pageEnd", 7);
    __publicField(this, "colStart", 0);
    __publicField(this, "colEnd", 127);
    __publicField(this, "page", 0);
    __publicField(this, "column", 0);
    __publicField(this, "displayOn", true);
    __publicField(this, "invert", false);
    __publicField(this, "allOn", false);
    __publicField(this, "contrast", 127);
    __publicField(this, "displayStartLine", 0);
    __publicField(this, "segmentRemap", false);
    __publicField(this, "multiplexRatio", 63);
    __publicField(this, "comScanDir", false);
    __publicField(this, "displayOffset", 0);
    __publicField(this, "comConfig", 18);
    __publicField(this, "pendingCommand", 0);
    __publicField(this, "pendingArgs", 0);
    __publicField(this, "args", []);
    __publicField(this, "vramDirty", false);
    __publicField(this, "stateUpdateCount", 0);
    __publicField(this, "cycleCount", 0);
    this.vram = new Array(1024).fill(0);
    const rawAddress = Number(
      manifest?.attrs?.i2cAddress ?? manifest?.attrs?.address ?? 60
    );
    if (Number.isFinite(rawAddress)) {
      this.i2cAddress = rawAddress & 127;
    }
    this.state = {
      vram: [...this.vram],
      invert: false,
      allOn: false,
      displayOn: true,
      displayStartLine: 0,
      segmentRemap: false,
      comScanDir: false,
      displayOffset: 0,
      vramDirty: false,
      updateCount: 0
    };
  }
  update(cpuCycles) {
    this.cycleCount += cpuCycles;
    if (this.cycleCount >= 266666) {
      this.cycleCount = 0;
      if (this.vramDirty) {
        this.vramDirty = false;
        this.stateUpdateCount += 1;
        this.setState({
          vram: [...this.vram],
          invert: this.invert,
          allOn: this.allOn,
          displayOn: this.displayOn,
          displayStartLine: this.displayStartLine,
          segmentRemap: this.segmentRemap,
          comScanDir: this.comScanDir,
          displayOffset: this.displayOffset,
          vramDirty: false,
          updateCount: this.stateUpdateCount
        });
      }
    }
  }
  onI2CStart(addr, read) {
    if ((addr & 127) === this.i2cAddress) {
      if (read) return false;
      this.isAddressed = true;
      this.awaitingControlByte = true;
      return true;
    }
    this.isAddressed = false;
    return false;
  }
  onI2CByte(_addr, data) {
    if (!this.isAddressed) return false;
    if (this.awaitingControlByte) {
      this.isDataMode = (data & 64) !== 0;
      this.burstMode = (data & 128) === 0;
      this.awaitingControlByte = false;
      return true;
    }
    if (this.isDataMode) {
      this.writeVram(data & 255);
    } else {
      this.processCommand(data & 255);
    }
    if (!this.burstMode) {
      this.awaitingControlByte = true;
    }
    return true;
  }
  onI2CStop() {
    this.isAddressed = false;
  }
  writeVram(data) {
    const index = this.page * 128 + this.column;
    if (index >= 0 && index < 1024) {
      this.vram[index] = data;
      this.vramDirty = true;
    }
    if (this.addressingMode === 0) {
      this.column += 1;
      if (this.column > this.colEnd) {
        this.column = this.colStart;
        this.page += 1;
        if (this.page > this.pageEnd) this.page = this.pageStart;
      }
    } else if (this.addressingMode === 1) {
      this.page += 1;
      if (this.page > this.pageEnd) {
        this.page = this.pageStart;
        this.column += 1;
        if (this.column > this.colEnd) this.column = this.colStart;
      }
    } else {
      this.column += 1;
      if (this.column > 127) this.column = 0;
    }
  }
  getExpectedArgs(cmd) {
    if (this.pendingArgs > 0) return this.pendingArgs;
    switch (cmd) {
      case 129:
        return 1;
      case 32:
        return 1;
      case 33:
        return 2;
      case 34:
        return 2;
      case 168:
        return 1;
      case 211:
        return 1;
      case 213:
        return 1;
      case 217:
        return 1;
      case 218:
        return 1;
      case 219:
        return 1;
      case 141:
        return 1;
      default:
        return 0;
    }
  }
  processCommand(cmd) {
    if (this.pendingArgs > 0) {
      this.args.push(cmd);
      this.pendingArgs -= 1;
      if (this.pendingArgs === 0) this.executeCommand();
      return;
    }
    const expected = this.getExpectedArgs(cmd);
    if (expected > 0) {
      this.pendingCommand = cmd;
      this.pendingArgs = expected;
      this.args = [];
      return;
    }
    if (cmd >= 176 && cmd <= 183) {
      this.page = cmd & 7;
      return;
    }
    if ((cmd & 240) === 0) {
      this.column = this.column & 240 | cmd & 15;
      return;
    }
    if ((cmd & 240) === 16) {
      this.column = this.column & 15 | (cmd & 15) << 4;
      return;
    }
    if (cmd >= 64 && cmd <= 127) {
      this.displayStartLine = cmd & 63;
      this.vramDirty = true;
      return;
    }
    switch (cmd) {
      case 160:
      case 161:
        this.segmentRemap = cmd === 161;
        this.vramDirty = true;
        break;
      case 192:
      case 200:
        this.comScanDir = cmd === 200;
        this.vramDirty = true;
        break;
      case 164:
        this.allOn = false;
        this.vramDirty = true;
        break;
      case 165:
        this.allOn = true;
        this.vramDirty = true;
        break;
      case 166:
        this.invert = false;
        this.vramDirty = true;
        break;
      case 167:
        this.invert = true;
        this.vramDirty = true;
        break;
      case 174:
        this.displayOn = false;
        this.vramDirty = true;
        break;
      case 175:
        this.displayOn = true;
        this.vramDirty = true;
        break;
      default:
        break;
    }
  }
  executeCommand() {
    switch (this.pendingCommand) {
      case 32:
        this.addressingMode = this.args[0] & 3;
        break;
      case 33:
        this.colStart = this.args[0] & 127;
        this.colEnd = this.args[1] & 127;
        this.column = this.colStart;
        break;
      case 34:
        this.pageStart = this.args[0] & 7;
        this.pageEnd = this.args[1] & 7;
        this.page = this.pageStart;
        break;
      case 129:
        this.contrast = this.args[0] & 255;
        break;
      case 168:
        this.multiplexRatio = this.args[0] & 63;
        break;
      case 211:
        this.displayOffset = this.args[0] & 63;
        this.vramDirty = true;
        break;
      case 218:
        this.comConfig = this.args[0] & 255;
        this.vramDirty = true;
        break;
      default:
        break;
    }
    this.pendingCommand = 0;
  }
  getSyncState() {
    return { ...this.state };
  }
};
var Lcd2004I2CFallbackLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "i2cAddress");
    __publicField(this, "backlight", true);
    __publicField(this, "mode4bit", false);
    __publicField(this, "cursorX", 0);
    __publicField(this, "cursorY", 0);
    __publicField(this, "linesData", [
      "                    ",
      "                    ",
      "                    ",
      "                    "
    ]);
    __publicField(this, "halfByte", 0);
    __publicField(this, "isNibble", false);
    __publicField(this, "lastByte", 0);
    const rawAddress = Number(
      manifest?.attrs?.i2cAddress ?? manifest?.attrs?.address ?? 39
    );
    this.i2cAddress = Number.isFinite(rawAddress) ? rawAddress & 127 : 39;
    this.state = { lines: [...this.linesData], illuminated: this.backlight };
  }
  onI2CStart(addr, isRead) {
    return !isRead && (addr & 127) === this.i2cAddress;
  }
  onI2CByte(_addr, value) {
    const rs = (value & 1) !== 0;
    const rw = (value & 2) !== 0;
    const en = (value & 4) !== 0;
    const bl = (value & 8) !== 0;
    const lastEn = (this.lastByte & 4) !== 0;
    if (lastEn && !en && !rw) {
      const dataNibble = value & 240;
      if (!this.mode4bit) {
        this.processLCDCommand(rs, dataNibble);
      } else if (!this.isNibble) {
        this.halfByte = dataNibble;
        this.isNibble = true;
      } else {
        const fullByte = this.halfByte | dataNibble >> 4;
        this.isNibble = false;
        this.processLCDCommand(rs, fullByte);
      }
    }
    if (this.backlight !== bl) {
      this.backlight = bl;
      this.stateChanged = true;
    }
    this.lastByte = value;
    this.updateState();
    return true;
  }
  processLCDCommand(rs, data) {
    if (!rs) {
      if (data === 1) {
        this.linesData = ["                    ", "                    ", "                    ", "                    "];
        this.cursorX = 0;
        this.cursorY = 0;
      } else if (data === 2 || data === 3) {
        this.cursorX = 0;
        this.cursorY = 0;
      } else if ((data & 240) === 32) {
        this.mode4bit = true;
      } else if ((data & 240) === 48) {
        this.mode4bit = false;
        this.isNibble = false;
      } else if ((data & 128) === 128) {
        const addr = data & 127;
        if (addr >= 0 && addr < 20) {
          this.cursorY = 0;
          this.cursorX = addr;
        } else if (addr >= 64 && addr < 84) {
          this.cursorY = 1;
          this.cursorX = addr - 64;
        } else if (addr >= 20 && addr < 40) {
          this.cursorY = 2;
          this.cursorX = addr - 20;
        } else if (addr >= 84 && addr < 104) {
          this.cursorY = 3;
          this.cursorX = addr - 84;
        }
      }
    } else if (this.cursorY < 4 && this.cursorX < 20) {
      const lineArray = this.linesData[this.cursorY].split("");
      lineArray[this.cursorX] = String.fromCharCode(data & 255);
      this.linesData[this.cursorY] = lineArray.join("");
      this.cursorX += 1;
    }
    this.stateChanged = true;
  }
  updateState() {
    this.state.lines = [...this.linesData];
    this.state.illuminated = this.backlight;
  }
  getSyncState() {
    return { ...this.state };
  }
};
var ILI9341FallbackLogic = class extends BaseComponent {
  constructor(id, manifest) {
    super(id, manifest);
    __publicField(this, "dcHigh", false);
    __publicField(this, "csHigh", true);
    __publicField(this, "currentCommand", 0);
    __publicField(this, "colStart", 0);
    __publicField(this, "colEnd", 239);
    __publicField(this, "rowStart", 0);
    __publicField(this, "rowEnd", 319);
    __publicField(this, "currentX", 0);
    __publicField(this, "currentY", 0);
    __publicField(this, "params", []);
    __publicField(this, "secondByte", false);
    __publicField(this, "firstByteValue", 0);
    __publicField(this, "vram", new Uint8Array(240 * 320 * 3));
    __publicField(this, "vramDirty", false);
    __publicField(this, "lastSync", 0);
    __publicField(this, "powerOn", true);
    __publicField(this, "spiRxBytes", 0);
    __publicField(this, "spiCmdBytes", 0);
    __publicField(this, "spiDataBytes", 0);
    __publicField(this, "ramwrPixels", 0);
    this.state = {
      buffer: this.vram,
      powerOn: true,
      t: Date.now(),
      spiRxBytes: 0,
      spiCmdBytes: 0,
      spiDataBytes: 0,
      ramwrPixels: 0,
      lastCommand: 0,
      csHigh: true,
      dcHigh: false
    };
  }
  update() {
    const now = Date.now();
    const newPower = this.getPinVoltage("VCC") > 2;
    if (newPower !== this.powerOn) {
      this.powerOn = newPower;
      this.stateChanged = true;
      if (!this.powerOn) {
        this.vram.fill(0);
        this.vramDirty = true;
      }
    }
    const minFlushIntervalMs = this.powerOn ? 40 : 0;
    if (this.vramDirty && now - this.lastSync >= minFlushIntervalMs) {
      this.lastSync = now;
      this.vramDirty = false;
      this.stateChanged = true;
    }
  }
  onPinStateChange(pinId, isHigh) {
    const pin = String(pinId || "").toUpperCase();
    if (pin === "DC") {
      this.dcHigh = isHigh;
    } else if (pin === "CS") {
      this.csHigh = isHigh;
      if (isHigh) {
        this.params = [];
        this.secondByte = false;
      }
    } else if (pin === "RESET" && !isHigh) {
      this.vram.fill(0);
      this.vramDirty = true;
    }
  }
  onSPIByte(data) {
    this.spiRxBytes += 1;
    if (this.csHigh || !this.powerOn) return 255;
    if (!this.dcHigh) {
      this.currentCommand = data & 255;
      this.spiCmdBytes += 1;
      this.params = [];
      this.secondByte = false;
      if (this.currentCommand === 44) {
        this.currentX = this.colStart;
        this.currentY = this.rowStart;
      }
    } else {
      this.spiDataBytes += 1;
      this.handleDataByte(data & 255);
    }
    return 0;
  }
  handleDataByte(data) {
    switch (this.currentCommand) {
      case 42:
        this.params.push(data);
        if (this.params.length === 4) {
          this.colStart = this.params[0] << 8 | this.params[1];
          this.colEnd = this.params[2] << 8 | this.params[3];
          this.currentX = this.colStart;
        }
        break;
      case 43:
        this.params.push(data);
        if (this.params.length === 4) {
          this.rowStart = this.params[0] << 8 | this.params[1];
          this.rowEnd = this.params[2] << 8 | this.params[3];
          this.currentY = this.rowStart;
        }
        break;
      case 44:
        if (!this.secondByte) {
          this.firstByteValue = data;
          this.secondByte = true;
        } else {
          const full = this.firstByteValue << 8 | data;
          this.secondByte = false;
          const r = (full >> 11 & 31) << 3;
          const g = (full >> 5 & 63) << 2;
          const b = (full & 31) << 3;
          if (this.currentX >= 0 && this.currentX < 240 && this.currentY >= 0 && this.currentY < 320) {
            const idx = (this.currentY * 240 + this.currentX) * 3;
            this.vram[idx] = r;
            this.vram[idx + 1] = g;
            this.vram[idx + 2] = b;
            this.vramDirty = true;
            this.ramwrPixels += 1;
          }
          this.currentX += 1;
          if (this.currentX > this.colEnd) {
            this.currentX = this.colStart;
            this.currentY += 1;
            if (this.currentY > this.rowEnd) {
              this.currentY = this.rowStart;
            }
          }
        }
        break;
      default:
        break;
    }
  }
  getSyncState() {
    return {
      buffer: this.vram,
      powerOn: this.powerOn,
      spiRxBytes: this.spiRxBytes,
      spiCmdBytes: this.spiCmdBytes,
      spiDataBytes: this.spiDataBytes,
      ramwrPixels: this.ramwrPixels,
      lastCommand: this.currentCommand,
      csHigh: this.csHigh,
      dcHigh: this.dcHigh,
      t: Date.now()
    };
  }
};
var LOGIC_REGISTRY = {
  "wokwi-led": LEDLogic,
  "wokwi-arduino-uno": UnoLogic,
  "wokwi-raspberry-pi-pico": PicoLogic,
  "wokwi-raspberry-pi-pico-w": PicoLogic,
  "wokwi-resistor": ResistorLogic,
  "wokwi-pushbutton": PushbuttonLogic,
  "wokwi-power-supply": PowerSupplyLogic,
  "wokwi-neopixel-matrix": NeopixelLogic,
  "wokwi-ws2812b": NeopixelLogic,
  "wokwi-ws2821b": NeopixelLogic,
  "wokwi-buzzer": BuzzerLogic,
  "wokwi-motor": MotorLogic,
  "wokwi-servo": ServoLogic,
  "wokwi-motor-driver": MotorDriverLogic,
  "wokwi-slide-potentiometer": SlidePotLogic,
  "wokwi-potentiometer": PotentiometerLogic,
  "wokwi-lcd2004-i2c": Lcd2004I2CFallbackLogic,
  "wokwi-ssd1306-oled": SSD1306FallbackLogic,
  max30102: GenericI2CDeviceLogic,
  "wokwi-max7219": GenericSPIDeviceLogic,
  "wokwi-ldr-module": BaseComponent,
  "wokwi-7segment": BaseComponent,
  "wokwi-ili9341": ILI9341FallbackLogic,
  "wokwi-sd-card": SDCardLogic,
  "shift_register": ShiftRegisterLogic,
  "wokwi-membrane-keypad": KeypadLogic,
  "wokwi-analog-joystick": JoystickLogic,
  "logic-ic-74xx": LogicIC74xxLogic,
  "logic-mux-2to1": Mux2to1Logic,
  "logic-d-flipflop": DFlipFlopLogic,
  "logic-d-flipflop-r": DFlipFlopRLogic,
  "logic-d-flipflop-dsr": DFlipFlopDsrLogic,
  "logic-clock-generator": ClockGeneratorLogic,
  "wokwi-tm1637-7segment": WokwiTM1637Logic,
  "wokwi-rgb-led": RGBLEDLogic,
  "wokwi-nokia-5110": Nokia5110Logic,
  "wokwi-l293d": L293DLogic,
  "wokwi-arduino-nano": UnoLogic,
  "wokwi-pca9685": PCA9685Logic,
  "wokwi-soil-moisture-sensor": SoilMoistureSensorLogic,
  "wokwi-photodiode": PhotodiodeLogic,
  "wokwi-diode": DiodeLogic,
  "wokwi-npn-transistor": NPNTransistorLogic,
  "wokwi-a4988": A4988Logic,
  "wokwi-cd74hc4067": CD74HC4067Logic,
  "wokwi-logic-analyzer": LogicAnalyzerLogic,
  "wokwi-breadboard": BaseComponent,
  "wokwi-breadboard-half": BaseComponent
};
var COMPONENT_PINS = {
  "wokwi-led": [{ id: "A" }, { id: "K" }],
  "wokwi-arduino-uno": UNO_BOARD_PINS.map((id) => ({ id })),
  "wokwi-raspberry-pi-pico": PICO_BOARD_PINS.map((id) => ({ id })),
  "wokwi-raspberry-pi-pico-w": PICO_BOARD_PINS.map((id) => ({ id })),
  "wokwi-resistor": [{ id: "p1" }, { id: "p2" }],
  "wokwi-pushbutton": [{ id: "1" }, { id: "2" }],
  "wokwi-buzzer": [{ id: "1" }, { id: "2" }],
  "wokwi-neopixel-matrix": [{ id: "DIN" }, { id: "VCC" }, { id: "GND" }],
  "wokwi-ws2812b": [{ id: "DIN" }, { id: "VCC" }, { id: "GND" }],
  "wokwi-ws2821b": [{ id: "DIN" }, { id: "VCC" }, { id: "GND" }],
  "wokwi-servo": [{ id: "GND" }, { id: "V+" }, { id: "PWM" }],
  "wokwi-motor": [{ id: "1" }, { id: "2" }],
  "wokwi-motor-driver": [{ id: "ENA" }, { id: "ENB" }, { id: "IN1" }, { id: "IN2" }, { id: "IN3" }, { id: "IN4" }, { id: "OUT1" }, { id: "OUT2" }, { id: "OUT3" }, { id: "OUT4" }, { id: "12V" }, { id: "5V" }, { id: "GND" }],
  "wokwi-potentiometer": [{ id: "1" }, { id: "2" }, { id: "SIG" }],
  "wokwi-slide-potentiometer": [{ id: "GND" }, { id: "SIG" }, { id: "VCC" }],
  "wokwi-lcd2004-i2c": [{ id: "GND" }, { id: "VCC" }, { id: "SDA" }, { id: "SCL" }],
  "wokwi-ssd1306-oled": [{ id: "GND" }, { id: "VCC" }, { id: "SCL" }, { id: "SDA" }],
  max30102: [{ id: "VIN" }, { id: "SDA" }, { id: "SCL" }, { id: "GND" }, { id: "INT" }, { id: "IRD" }, { id: "RD" }, { id: "NC" }],
  "wokwi-max7219": [{ id: "VCC" }, { id: "GND" }, { id: "DIN" }, { id: "CS" }, { id: "CLK" }, { id: "VCC_OUT" }, { id: "GND_OUT" }, { id: "DOUT" }, { id: "CS_OUT" }, { id: "CLK_OUT" }],
  "wokwi-ldr-module": [{ id: "VCC" }, { id: "GND" }, { id: "DO" }, { id: "AO" }],
  "wokwi-7segment": [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }, { id: "F" }, { id: "G" }, { id: "DP" }, { id: "DIG1" }, { id: "DIG2" }, { id: "DIG3" }, { id: "DIG4" }, { id: "COLON" }],
  "wokwi-ili9341": [{ id: "VCC" }, { id: "GND" }, { id: "CS" }, { id: "RESET" }, { id: "DC" }, { id: "MOSI" }, { id: "SCK" }, { id: "LED" }, { id: "MISO" }],
  "wokwi-sd-card": [{ id: "VCC" }, { id: "GND" }, { id: "CS" }, { id: "SCK" }, { id: "MOSI" }, { id: "MISO" }],
  "wokwi-power-supply": [{ id: "GND" }, { id: "VCC" }],
  "shift_register": [{ id: "vcc" }, { id: "gnd" }, { id: "ser" }, { id: "srclk" }, { id: "rclk" }, { id: "oe" }, { id: "srclr" }, { id: "q0" }, { id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }, { id: "q5" }, { id: "q6" }, { id: "q7" }, { id: "q7s" }],
  "wokwi-membrane-keypad": [{ id: "R1" }, { id: "R2" }, { id: "R3" }, { id: "R4" }, { id: "C1" }, { id: "C2" }, { id: "C3" }, { id: "C4" }],
  "wokwi-analog-joystick": [{ id: "GND" }, { id: "5V" }, { id: "VRX" }, { id: "VRY" }, { id: "SW" }],
  "logic-ic-74xx": [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }, { id: "p5" }, { id: "p6" }, { id: "p7" }, { id: "p8" }, { id: "p9" }, { id: "p10" }, { id: "p11" }, { id: "p12" }, { id: "p13" }, { id: "p14" }],
  "logic-mux-2to1": [{ id: "D0" }, { id: "D1" }, { id: "SEL" }, { id: "OUT" }],
  "logic-d-flipflop": [{ id: "D" }, { id: "CLK" }, { id: "Q" }, { id: "Qbar" }],
  "logic-d-flipflop-r": [{ id: "D" }, { id: "CLK" }, { id: "R" }, { id: "Q" }, { id: "Qbar" }],
  "logic-d-flipflop-dsr": [{ id: "D" }, { id: "CLK" }, { id: "S" }, { id: "R" }, { id: "Q" }, { id: "Qbar" }],
  "logic-clock-generator": [{ id: "OUT" }],
  "wokwi-tm1637-7segment": [{ id: "CLK" }, { id: "DIO" }, { id: "VCC" }, { id: "GND" }],
  "wokwi-neopixel-ring": [{ id: "DIN" }, { id: "VDD" }, { id: "VSS" }, { id: "DOUT" }],
  "wokwi-rgb-led": [{ id: "R" }, { id: "COM" }, { id: "G" }, { id: "B" }],
  "wokwi-nokia-5110": [{ id: "VCC" }, { id: "GND" }, { id: "SCE" }, { id: "RST" }, { id: "DC" }, { id: "DN" }, { id: "SCLK" }, { id: "LED" }],
  "wokwi-l293d": [{ id: "EN1,2" }, { id: "IN1" }, { id: "OUT1" }, { id: "GND1" }, { id: "GND2" }, { id: "OUT2" }, { id: "IN2" }, { id: "VCC2" }, { id: "VCC1" }, { id: "IN4" }, { id: "OUT4" }, { id: "GND4" }, { id: "GND3" }, { id: "OUT3" }, { id: "IN3" }, { id: "EN3,4" }],
  "wokwi-arduino-nano": [{ id: "D0" }, { id: "RX" }, { id: "D1" }, { id: "TX" }, { id: "D2" }, { id: "2" }, { id: "D3" }, { id: "3" }, { id: "D4" }, { id: "4" }, { id: "D5" }, { id: "5" }, { id: "D6" }, { id: "6" }, { id: "D7" }, { id: "7" }, { id: "D8" }, { id: "8" }, { id: "D9" }, { id: "9" }, { id: "D10" }, { id: "10" }, { id: "D11" }, { id: "11" }, { id: "D12" }, { id: "12" }, { id: "D13" }, { id: "13" }, { id: "A0" }, { id: "A1" }, { id: "A2" }, { id: "A3" }, { id: "A4" }, { id: "A5" }, { id: "A6" }, { id: "A7" }, { id: "5V" }, { id: "VCC" }, { id: "3V3" }, { id: "GND" }, { id: "GND.1" }, { id: "GND.2" }, { id: "RST" }, { id: "RST.1" }, { id: "RST.2" }, { id: "VIN" }, { id: "AREF" }],
  "wokwi-pca9685": [{ id: "SDA" }, { id: "SCL" }, { id: "GND" }, { id: "VCC" }, { id: "S0" }, { id: "S1" }, { id: "S2" }, { id: "S3" }, { id: "S4" }, { id: "S5" }, { id: "S6" }, { id: "S7" }, { id: "S8" }, { id: "S9" }, { id: "S10" }, { id: "S11" }, { id: "S12" }, { id: "S13" }, { id: "S14" }, { id: "S15" }],
  "wokwi-soil-moisture-sensor": [{ id: "GND" }, { id: "VCC" }, { id: "SIG" }],
  "wokwi-photodiode": [{ id: "A" }, { id: "C" }],
  "wokwi-diode": [{ id: "A" }, { id: "C" }],
  "wokwi-npn-transistor": [{ id: "E" }, { id: "B" }, { id: "C" }],
  "wokwi-a4988": [{ id: "ENABLE" }, { id: "MS1" }, { id: "MS2" }, { id: "MS3" }, { id: "RESET" }, { id: "SLEEP" }, { id: "STEP" }, { id: "DIR" }, { id: "VMOT" }, { id: "GND_MOT" }, { id: "2B" }, { id: "2A" }, { id: "1A" }, { id: "1B" }, { id: "VDD" }, { id: "GND_LOGIC" }],
  "wokwi-cd74hc4067": [{ id: "VCC" }, { id: "GND" }, { id: "EN" }, { id: "S0" }, { id: "S1" }, { id: "S2" }, { id: "S3" }, { id: "SIG" }, { id: "C0" }, { id: "C1" }, { id: "C2" }, { id: "C3" }, { id: "C4" }, { id: "C5" }, { id: "C6" }, { id: "C7" }, { id: "C8" }, { id: "C9" }, { id: "C10" }, { id: "C11" }, { id: "C12" }, { id: "C13" }, { id: "C14" }, { id: "C15" }],
  "wokwi-logic-analyzer": [{ id: "GND" }, { id: "D0" }, { id: "D1" }, { id: "D2" }, { id: "D3" }, { id: "D4" }, { id: "D5" }, { id: "D6" }, { id: "D7" }]
};
function parseAddressValue(raw) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    const clamped = Math.max(0, Math.min(4294967295, Math.floor(raw)));
    return clamped >>> 0;
  }
  if (typeof raw === "string") {
    const value = raw.trim();
    if (!value) return null;
    const parsed = /^0x[0-9a-f]+$/i.test(value) ? parseInt(value, 16) : Number(value);
    if (!Number.isFinite(parsed)) return null;
    const clamped = Math.max(0, Math.min(4294967295, Math.floor(parsed)));
    return clamped >>> 0;
  }
  return null;
}
function normalizeRp2040ExecutableRanges(value) {
  if (!Array.isArray(value)) return [];
  const ranges = [];
  for (const raw of value) {
    let start = null;
    let end = null;
    if (Array.isArray(raw) && raw.length >= 2) {
      start = parseAddressValue(raw[0]);
      end = parseAddressValue(raw[1]);
    } else if (raw && typeof raw === "object") {
      const obj = raw;
      start = parseAddressValue(obj.start);
      if (Object.prototype.hasOwnProperty.call(obj, "end")) {
        end = parseAddressValue(obj.end);
      } else if (Object.prototype.hasOwnProperty.call(obj, "size")) {
        const size = parseAddressValue(obj.size);
        if (start !== null && size !== null && size > 0) {
          const rawEnd = Number(start) + Number(size) - 1;
          end = Math.max(0, Math.min(4294967295, Math.floor(rawEnd))) >>> 0;
        }
      }
    }
    if (start === null || end === null || end < start) {
      continue;
    }
    ranges.push({ start: start >>> 0, end: end >>> 0 });
  }
  return ranges;
}
function decodeHexToBytes(hex) {
  const normalized = String(hex || "").trim().replace(/^0x/i, "").replace(/\s+/g, "");
  if (!normalized || normalized.length % 2 !== 0) {
    return new Uint8Array();
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      return new Uint8Array();
    }
    out[i] = byte & 255;
  }
  return out;
}
function decodeRp2040FlashPartitionBytes(data, encoding) {
  if (data == null) return null;
  if (data instanceof Uint8Array) {
    return data.length > 0 ? data : null;
  }
  if (data instanceof ArrayBuffer) {
    const out = new Uint8Array(data);
    return out.length > 0 ? out : null;
  }
  if (ArrayBuffer.isView(data)) {
    const view = data;
    const out = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    return out.length > 0 ? out : null;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    return new Uint8Array(data.map((value) => Number(value) & 255));
  }
  if (typeof data === "string") {
    const raw = data.trim();
    if (!raw) return null;
    const normalizedEncoding = String(encoding || "").trim().toLowerCase();
    if (normalizedEncoding === "hex") {
      const decoded = decodeHexToBytes(raw);
      return decoded.length > 0 ? decoded : null;
    }
    if (normalizedEncoding === "utf8") {
      const decoded = new TextEncoder().encode(data);
      return decoded.length > 0 ? decoded : null;
    }
    try {
      const decoded = decodeBase64ToBytes(raw);
      return decoded.length > 0 ? decoded : null;
    } catch {
      const fallback = new TextEncoder().encode(data);
      return fallback.length > 0 ? fallback : null;
    }
  }
  return null;
}
function normalizeRp2040FlashPartitions(value) {
  if (!Array.isArray(value)) return [];
  const partitions = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw;
    const offset = parseAddressValue(obj.offset);
    if (offset === null) continue;
    const bytes = decodeRp2040FlashPartitionBytes(obj.data, obj.encoding);
    if (!bytes || bytes.length === 0) continue;
    partitions.push({ offset: offset >>> 0, bytes });
  }
  partitions.sort((a, b) => a.offset - b.offset);
  return partitions;
}
function getInternalBridgesForComponent(compId, type) {
  const bridges = [];
  if (type === "wokwi-resistor") {
    bridges.push([`${compId}:p1`, `${compId}:p2`]);
  } else if (type === "wokwi-breadboard" || type === "wokwi-breadboard-half") {
    const isHalf = type.includes("half");
    const maxRow = isHalf ? 30 : 63;
    const maxRail = isHalf ? 25 : 50;
    for (let r = 1; r <= maxRow; r++) {
      const left = ["a", "b", "c", "d", "e"];
      for (let i = 0; i < left.length - 1; i++) {
        bridges.push([`${compId}:${r}${left[i]}`, `${compId}:${r}${left[i + 1]}`]);
      }
      const right = ["f", "g", "h", "i", "j"];
      for (let i = 0; i < right.length - 1; i++) {
        bridges.push([`${compId}:${r}${right[i]}`, `${compId}:${r}${right[i + 1]}`]);
      }
    }
    const rails = ["top_vcc", "top_gnd", "bottom_vcc", "bottom_gnd"];
    for (const rail of rails) {
      for (let i = 1; i < maxRail; i++) {
        bridges.push([`${compId}:${rail}_${i}`, `${compId}:${rail}_${i + 1}`]);
      }
    }
  }
  return bridges;
}
var RP2040_FLASH_BASE = 268435456;
var RP2040_FLASH_ALIAS_END = 335544320;
var RP2040_FLASH_ALIAS_MASK = 16777215;
var RP2040_BOOTROM_BASE = 0;
var RP2040_BOOTROM_SIZE = 16384;
var RP2040_SRAM_BASE = 536870912;
var RP2040_USB_RAM_BASE = 1343225856;
var RP2040_USB_RAM_SIZE = 4096;
var RP2040_CLOCKS_BASE = 1073774592;
var RP2040_CLOCKS_CLK_REF_CTRL_OFFSET = 48;
var RP2040_CLOCKS_CLK_REF_SELECTED_OFFSET = 56;
var RP2040_CLOCKS_CLK_SYS_CTRL_OFFSET = 60;
var RP2040_CLOCKS_CLK_SYS_SELECTED_OFFSET = 68;
var RP2040_SIO_FIFO_ST_OFFSET = 80;
var RP2040_SIO_FIFO_WR_OFFSET = 84;
var RP2040_SIO_FIFO_RD_OFFSET = 88;
var UF2_PAYLOAD_PREFIX = "UF2BASE64:";
var UF2_BLOCK_SIZE = 512;
var UF2_MAGIC_START0 = 171066965;
var UF2_MAGIC_START1 = 2656915799;
var UF2_MAGIC_END = 179400496;
var RP2040_DEFAULT_LOGICAL_FLASH_BYTES = 2 * 1024 * 1024;
var SOFT_SERIAL_SOURCE_LABELS = /* @__PURE__ */ new Set(["softserial", "soft-serial", "soft_uart", "soft-uart", "softuart"]);
var NEOPIXEL_COMPONENT_TYPE_PATTERN = /(neopixel|ws2812|ws2821)/i;
function parsePositiveInt2(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function normalizeRp2040FlashAliasAddress(rawAddress) {
  const address = Number(rawAddress) >>> 0;
  if (address >= RP2040_FLASH_BASE && address < RP2040_FLASH_ALIAS_END) {
    return RP2040_FLASH_BASE + (address & RP2040_FLASH_ALIAS_MASK) >>> 0;
  }
  return address;
}
function rp2040FlashAddressToIndex(rawAddress, logicalFlashLength) {
  const normalizedAddress = normalizeRp2040FlashAliasAddress(rawAddress);
  if (normalizedAddress >= RP2040_FLASH_BASE && normalizedAddress < RP2040_FLASH_BASE + logicalFlashLength) {
    return normalizedAddress - RP2040_FLASH_BASE >>> 0;
  }
  const address = Number(rawAddress) >>> 0;
  if (address < logicalFlashLength) {
    return address;
  }
  return -1;
}
function collectNeopixelShutdownStates(instances) {
  const updates = [];
  for (const inst of instances.values()) {
    if (!NEOPIXEL_COMPONENT_TYPE_PATTERN.test(String(inst.type || ""))) continue;
    const currentState = inst.state && typeof inst.state === "object" ? inst.state : {};
    const rows = parsePositiveInt2(currentState.rows);
    const cols = parsePositiveInt2(currentState.cols);
    const configuredCount = rows > 0 && cols > 0 ? rows * cols : 0;
    const existingPixels = Array.isArray(currentState.pixels) ? currentState.pixels : [];
    const pixelCount = Math.max(configuredCount, existingPixels.length);
    const nextState = {
      ...currentState,
      pixels: pixelCount > 0 ? new Array(pixelCount).fill(0) : []
    };
    inst.state = nextState;
    inst.stateChanged = false;
    updates.push({ id: inst.id, state: nextState });
  }
  return updates;
}
function isSoftSerialSourceLabel(source) {
  const key = String(source || "").trim().toLowerCase();
  return SOFT_SERIAL_SOURCE_LABELS.has(key);
}
var RP2040_I2C_SOURCE_PINS = {
  i2c0: {
    sda: ["SDA", "GP0", "GPIO0", "D0", "0", "GP4", "GPIO4", "D4", "4", "GP8", "GPIO8", "D8", "8", "GP12", "GPIO12", "D12", "12", "GP16", "GPIO16", "D16", "16", "GP20", "GPIO20", "D20", "20", "GP24", "GPIO24", "D24", "24", "GP28", "GPIO28", "D28", "28"],
    scl: ["SCL", "GP1", "GPIO1", "D1", "1", "GP5", "GPIO5", "D5", "5", "GP9", "GPIO9", "D9", "9", "GP13", "GPIO13", "D13", "13", "GP17", "GPIO17", "D17", "17", "GP21", "GPIO21", "D21", "21", "GP25", "GPIO25", "D25", "25"]
  },
  i2c1: {
    sda: ["SDA1", "GP2", "GPIO2", "D2", "2", "GP6", "GPIO6", "D6", "6", "GP10", "GPIO10", "D10", "10", "GP14", "GPIO14", "D14", "14", "GP18", "GPIO18", "D18", "18", "GP22", "GPIO22", "D22", "22", "GP26", "GPIO26", "D26", "26"],
    scl: ["SCL1", "GP3", "GPIO3", "D3", "3", "GP7", "GPIO7", "D7", "7", "GP11", "GPIO11", "D11", "11", "GP15", "GPIO15", "D15", "15", "GP19", "GPIO19", "D19", "19", "GP23", "GPIO23", "D23", "23", "GP27", "GPIO27", "D27", "27"]
  }
};
var RP2040_SPI_SOURCE_PINS = {
  spi0: {
    mosi: ["MOSI", "TX0", "GP3", "GPIO3", "D3", "3", "GP7", "GPIO7", "D7", "7", "GP19", "GPIO19", "D19", "19", "GP23", "GPIO23", "D23", "23"],
    miso: ["MISO", "RX0", "GP0", "GPIO0", "D0", "0", "GP4", "GPIO4", "D4", "4", "GP16", "GPIO16", "D16", "16", "GP20", "GPIO20", "D20", "20"],
    sck: ["SCK", "CLK", "SCLK", "GP2", "GPIO2", "D2", "2", "GP6", "GPIO6", "D6", "6", "GP18", "GPIO18", "D18", "18", "GP22", "GPIO22", "D22", "22"],
    cs: ["CS", "SS", "CSN", "NSS", "GP1", "GPIO1", "D1", "1", "GP5", "GPIO5", "D5", "5", "GP17", "GPIO17", "D17", "17", "GP21", "GPIO21", "D21", "21"]
  },
  spi1: {
    mosi: ["MOSI1", "TX1", "GP11", "GPIO11", "D11", "11", "GP15", "GPIO15", "D15", "15", "GP27", "GPIO27", "D27", "27"],
    miso: ["MISO1", "RX1", "GP8", "GPIO8", "D8", "8", "GP12", "GPIO12", "D12", "12", "GP24", "GPIO24", "D24", "24", "GP28", "GPIO28", "D28", "28"],
    sck: ["SCK1", "CLK1", "SCLK1", "GP10", "GPIO10", "D10", "10", "GP14", "GPIO14", "D14", "14", "GP26", "GPIO26", "D26", "26"],
    cs: ["CS1", "SS1", "CSN1", "NSS1", "GP9", "GPIO9", "D9", "9", "GP13", "GPIO13", "D13", "13", "GP25", "GPIO25", "D25", "25"]
  }
};
var RP2040_GPIO_FUNC_PWM = 4;
var RP2040_GPIO_FUNC_PIO0 = 6;
var RP2040_GPIO_FUNC_PIO1 = 7;
function collectConnectedComponentPins(boardId, boardPinAliases, wires, instances) {
  const aliasSet = new Set(boardPinAliases.map((v) => String(v || "").toUpperCase()));
  const adjacency = /* @__PURE__ */ new Map();
  const connect = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, /* @__PURE__ */ new Set());
    if (!adjacency.has(b)) adjacency.set(b, /* @__PURE__ */ new Set());
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  };
  for (const wire of wires || []) {
    if (!wire?.from || !wire?.to) continue;
    connect(String(wire.from), String(wire.to));
  }
  for (const [id, inst] of instances.entries()) {
    if (inst.type === "wokwi-resistor") {
      connect(`${id}:p1`, `${id}:p2`);
    }
  }
  const startNodes = [];
  for (const node of adjacency.keys()) {
    const [compId, pinId] = String(node).split(":");
    if (compId !== boardId) continue;
    if (aliasSet.has(String(pinId || "").toUpperCase())) {
      startNodes.push(node);
    }
  }
  if (!startNodes.length) return [];
  const visited = /* @__PURE__ */ new Set();
  const queue = [...startNodes];
  startNodes.forEach((n) => visited.add(n));
  while (queue.length > 0) {
    const node = queue.shift();
    for (const n of adjacency.get(node) || []) {
      if (visited.has(n)) continue;
      visited.add(n);
      queue.push(n);
    }
  }
  const out = /* @__PURE__ */ new Map();
  for (const node of visited) {
    const [compId, pinId] = String(node).split(":");
    if (!compId || compId === boardId) continue;
    const inst = instances.get(compId);
    if (!inst) continue;
    if (inst.type === "wokwi-resistor") continue;
    out.set(`${compId}:${pinId}`, { inst, pinId });
  }
  return Array.from(out.values());
}
function invokeOptional(inst, names, args) {
  for (const name of names) {
    const fn = inst?.[name];
    if (typeof fn === "function") {
      return fn.apply(inst, args);
    }
  }
  return void 0;
}
var MEDIUM_COMPONENT_STATE_WEIGHT = 2048;
var HEAVY_COMPONENT_STATE_WEIGHT = 8192;
var MEDIUM_COMPONENT_MIN_SYNC_MS = 55;
var HEAVY_COMPONENT_MIN_SYNC_MS = 95;
function estimateStatePayloadWeight(value, depth = 0) {
  if (value == null) return 0;
  if (typeof value === "string") return value.length;
  if (typeof value === "number" || typeof value === "boolean") return 8;
  if (ArrayBuffer.isView(value)) {
    return Number(value?.byteLength || value?.length || 0);
  }
  if (value instanceof ArrayBuffer) {
    return Number(value.byteLength || 0);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 0;
    if (depth >= 2) return value.length;
    const sampleCount = Math.min(value.length, 16);
    let sampleWeight = 0;
    for (let i = 0; i < sampleCount; i++) {
      sampleWeight += estimateStatePayloadWeight(value[i], depth + 1);
    }
    const avg = sampleCount > 0 ? sampleWeight / sampleCount : 0;
    return Math.round(avg * value.length);
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return 0;
    if (depth >= 2) return entries.length * 12;
    let weight = 0;
    for (const [k, v] of entries) {
      weight += String(k || "").length;
      weight += estimateStatePayloadWeight(v, depth + 1);
    }
    return weight;
  }
  return 0;
}
function getComponentStateSyncPolicy(state) {
  const weight = estimateStatePayloadWeight(state);
  if (weight >= HEAVY_COMPONENT_STATE_WEIGHT) {
    return { weight, minIntervalMs: HEAVY_COMPONENT_MIN_SYNC_MS };
  }
  if (weight >= MEDIUM_COMPONENT_STATE_WEIGHT) {
    return { weight, minIntervalMs: MEDIUM_COMPONENT_MIN_SYNC_MS };
  }
  return { weight, minIntervalMs: 0 };
}
var fallbackTelemetryByInstance = /* @__PURE__ */ new WeakMap();
function readComponentStateForTelemetry(inst) {
  const state = inst?.state;
  if (state && typeof state === "object" && !Array.isArray(state)) {
    return state;
  }
  if (state === void 0) return {};
  return { value: state };
}
function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}
function readPinLevelMap(inst) {
  const out = {};
  const pins = inst?.pins && typeof inst.pins === "object" ? inst.pins : null;
  if (!pins) return out;
  for (const [pinId, pinState] of Object.entries(pins)) {
    if (!pinState || typeof pinState !== "object") continue;
    const maybeVoltage = Number(pinState.voltage);
    if (Number.isFinite(maybeVoltage)) {
      out[String(pinId)] = maybeVoltage > 0.5;
    }
  }
  return out;
}
function isLikelyActiveSignal(value) {
  if (value === null || value === void 0) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (!key) return false;
    return key !== "0" && key !== "false" && key !== "off" && key !== "none" && key !== "ok";
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}
function buildFallbackTelemetry(inst) {
  const now = Date.now();
  const key = inst && typeof inst === "object" ? inst : { fallback: true };
  let runtime = fallbackTelemetryByInstance.get(key);
  if (!runtime) {
    runtime = {
      createdAtMs: now,
      sampleCount: 0,
      stateMutationCount: 0,
      lastStateFingerprint: "",
      lastStateChangeAtMs: now,
      pinLevelMap: {},
      pinToggleCount: 0
    };
    fallbackTelemetryByInstance.set(key, runtime);
  }
  runtime.sampleCount += 1;
  const state = readComponentStateForTelemetry(inst);
  const stateFingerprint = safeJsonStringify(state);
  if (runtime.lastStateFingerprint && runtime.lastStateFingerprint !== stateFingerprint) {
    runtime.stateMutationCount += 1;
    runtime.lastStateChangeAtMs = now;
  }
  if (!runtime.lastStateFingerprint) {
    runtime.lastStateChangeAtMs = now;
  }
  runtime.lastStateFingerprint = stateFingerprint;
  const nextPinLevels = readPinLevelMap(inst);
  let pinToggles = 0;
  const pinIds = /* @__PURE__ */ new Set([
    ...Object.keys(runtime.pinLevelMap),
    ...Object.keys(nextPinLevels)
  ]);
  for (const pinId of pinIds) {
    const prevLevel = runtime.pinLevelMap[pinId];
    const nextLevel = nextPinLevels[pinId];
    if (prevLevel === void 0 || nextLevel === void 0) continue;
    if (prevLevel !== nextLevel) pinToggles += 1;
  }
  runtime.pinToggleCount += pinToggles;
  runtime.pinLevelMap = nextPinLevels;
  let status = "ok";
  const findings = [];
  for (const [stateKey, stateValue] of Object.entries(state)) {
    const lower = String(stateKey || "").toLowerCase();
    if (/(error|fault|burned|panic|critical|failed)/.test(lower) && isLikelyActiveSignal(stateValue)) {
      status = "error";
      findings.push(`State flag ${stateKey} indicates an error condition.`);
      continue;
    }
    if (status !== "error" && /(warn|degraded|timeout|retry|unstable)/.test(lower) && isLikelyActiveSignal(stateValue)) {
      status = "warn";
      findings.push(`State flag ${stateKey} indicates a warning condition.`);
    }
  }
  const elapsedSec = Math.max(1e-3, (now - runtime.createdAtMs) / 1e3);
  const updateFreqHz = Number((runtime.sampleCount / elapsedSec).toFixed(3));
  const idleMs = Math.max(0, now - runtime.lastStateChangeAtMs);
  const summary = findings.length > 0 ? `${status.toUpperCase()}: ${findings[0]}` : `OK: stateKeys=${Object.keys(state).slice(0, 8).join(", ") || "none"}`;
  const telemetryData = {
    ...state,
    _metrics: {
      sampleCount: runtime.sampleCount,
      updateFreqHz,
      stateSizeBytes: stateFingerprint.length,
      stateMutationCount: runtime.stateMutationCount,
      idleMs,
      pinToggleCount: runtime.pinToggleCount,
      pinCount: Object.keys(nextPinLevels).length
    },
    _heuristics: {
      status,
      summary,
      findings
    },
    _capturedAt: new Date(now).toISOString(),
    _fallbackGenerated: true
  };
  return {
    telemetrySummary: summary,
    telemetryData
  };
}
function collectComponentTelemetry(inst) {
  const out = {};
  const state = inst.state || {};
  if (state.vHistory) out.vHistory = state.vHistory;
  if (state.voltageDrop !== void 0) out.voltageDrop = state.voltageDrop;
  if (state.current !== void 0) out.current = state.current;
  if (state.power !== void 0) out.power = state.power;
  if (state.glow !== void 0) out.glow = state.glow;
  try {
    if (typeof inst?.getTelemetrySummary === "function") {
      const summary = inst.getTelemetrySummary();
      if (typeof summary === "string" && summary.trim()) {
        out.telemetrySummary = summary.trim();
      }
    }
  } catch {
  }
  try {
    if (typeof inst?.getTelemetryData === "function") {
      const data = inst.getTelemetryData();
      if (data && typeof data === "object" && !Array.isArray(data)) {
        out.telemetryData = data;
      }
    }
  } catch {
  }
  const fallback = buildFallbackTelemetry(inst);
  if (!out.telemetrySummary) {
    out.telemetrySummary = fallback.telemetrySummary;
  }
  if (!out.telemetryData || typeof out.telemetryData !== "object") {
    out.telemetryData = fallback.telemetryData;
  } else {
    const merged = { ...out.telemetryData };
    if (!merged._metrics) {
      merged._metrics = fallback.telemetryData._metrics;
    }
    if (!merged._heuristics) {
      merged._heuristics = fallback.telemetryData._heuristics;
    }
    if (!merged._capturedAt) {
      merged._capturedAt = fallback.telemetryData._capturedAt;
    }
    if (!merged._fallbackGenerated) {
      merged._fallbackGenerated = true;
    }
    out.telemetryData = merged;
  }
  return out;
}
function parseIntelHexSegments(data) {
  const lines = String(data || "").split(/\r?\n/);
  let highAddress = 0;
  const segments = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line[0] !== ":") continue;
    const byteCount = parseInt(line.substring(1, 3), 16);
    const address = parseInt(line.substring(3, 7), 16);
    const recordType = parseInt(line.substring(7, 9), 16);
    if (recordType === 0) {
      const bytes = new Uint8Array(byteCount);
      for (let i = 0; i < byteCount; i++) {
        bytes[i] = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
      }
      segments.push({
        address: highAddress + address,
        bytes
      });
    } else if (recordType === 4 || recordType === 2) {
      highAddress = parseInt(line.substring(9, 13), 16) << (recordType === 4 ? 16 : 4);
    }
  }
  return segments;
}
function flashContainsAsciiToken(flash, token, maxBytes) {
  const text = String(token || "");
  if (!flash || !text) return false;
  const needle = new TextEncoder().encode(text);
  if (needle.length === 0) return false;
  const limit = Math.max(0, Math.min(flash.length, Math.floor(maxBytes || flash.length)));
  if (limit < needle.length) return false;
  for (let i = 0; i <= limit - needle.length; i++) {
    let matched = true;
    for (let j = 0; j < needle.length; j++) {
      if (flash[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}
function loadRP2040Entry(rp2040, logicalFlashBytes) {
  const logicalFlashLength = getRp2040LogicalFlashLength(rp2040, logicalFlashBytes);
  const flashEnd = RP2040_FLASH_BASE + logicalFlashLength >>> 0;
  const sramStart = RP2040_SRAM_BASE;
  const sramEnd = RP2040_SRAM_BASE + rp2040.sram.length >>> 0;
  const resolvePcAddress = (rawAddress) => {
    const raw = rawAddress >>> 0;
    if (raw < logicalFlashLength) {
      return RP2040_FLASH_BASE + raw >>> 0;
    }
    if (raw >= RP2040_FLASH_BASE && raw < RP2040_FLASH_ALIAS_END) {
      return normalizeRp2040FlashAliasAddress(raw);
    }
    return raw;
  };
  const isExecutableAddress = (addr) => {
    const a = addr >>> 0;
    if (a >= RP2040_FLASH_BASE && a < RP2040_FLASH_ALIAS_END) {
      const normalized = normalizeRp2040FlashAliasAddress(a);
      if (normalized >= RP2040_FLASH_BASE && normalized < flashEnd) {
        return true;
      }
    }
    return a >= sramStart && a < sramEnd || a >= RP2040_BOOTROM_BASE && a < RP2040_BOOTROM_BASE + RP2040_BOOTROM_SIZE || a >= RP2040_USB_RAM_BASE && a < RP2040_USB_RAM_BASE + RP2040_USB_RAM_SIZE;
  };
  const hasInstructionWord = (addr) => {
    const a = addr >>> 0;
    const flashIndex = rp2040FlashAddressToIndex(a, logicalFlashLength);
    if (flashIndex < 0) return true;
    if (flashIndex + 1 >= logicalFlashLength) return false;
    return !(rp2040.flash[flashIndex] === 255 && rp2040.flash[flashIndex + 1] === 255);
  };
  const readWord = (addr) => {
    const a = addr >>> 0;
    const flashIndex = rp2040FlashAddressToIndex(a, logicalFlashLength);
    if (flashIndex >= 0 && flashIndex + 3 < logicalFlashLength) {
      return (rp2040.flash[flashIndex] | rp2040.flash[flashIndex + 1] << 8 | rp2040.flash[flashIndex + 2] << 16 | rp2040.flash[flashIndex + 3] << 24) >>> 0;
    }
    return rp2040.readUint32(a) >>> 0;
  };
  const probe0100SP = readWord(RP2040_FLASH_BASE + 256 >>> 0) >>> 0;
  const probe0100PC = readWord(RP2040_FLASH_BASE + 260 >>> 0) >>> 0;
  const probe0000SP = readWord(RP2040_FLASH_BASE) >>> 0;
  const probe0000PC = readWord(RP2040_FLASH_BASE + 4 >>> 0) >>> 0;
  const evaluateVectorBase = (base, strategy) => {
    const initialSP = readWord(base) >>> 0;
    const initialPC = readWord(base + 4 >>> 0) >>> 0;
    if (initialSP === 0 || initialPC === 0 || initialSP === 4294967295 || initialPC === 4294967295) {
      return null;
    }
    const resolvedPC = resolvePcAddress((initialPC & ~1) >>> 0);
    const validSP = initialSP >= sramStart && initialSP <= sramEnd && (initialSP & 3) === 0;
    const validPC = isExecutableAddress(resolvedPC) && hasInstructionWord(resolvedPC);
    if (!validSP || !validPC) {
      return null;
    }
    let score = 100;
    if (resolvedPC >= RP2040_FLASH_BASE && resolvedPC < RP2040_FLASH_BASE + 2048) {
      score -= 35;
    }
    if (resolvedPC >= RP2040_FLASH_BASE + 2048 && resolvedPC < flashEnd) {
      score += 15;
    }
    let populatedVectors = 0;
    let validVectorHandlers = 0;
    for (let i = 2; i < 16; i++) {
      const rawHandler = readWord(base + i * 4 >>> 0) >>> 0;
      if (rawHandler === 0 || rawHandler === 4294967295) {
        continue;
      }
      populatedVectors += 1;
      const handlerAddr = resolvePcAddress((rawHandler & ~1) >>> 0);
      const looksThumb = (rawHandler & 1) === 1;
      if (looksThumb && isExecutableAddress(handlerAddr)) {
        validVectorHandlers += 1;
        score += 3;
      } else {
        score -= 5;
      }
    }
    if (populatedVectors === 0) {
      score -= 10;
    }
    if (validVectorHandlers >= 6) {
      score += 12;
    }
    return {
      base: base >>> 0,
      initialSP,
      initialPC,
      resolvedPC: resolvedPC >>> 0,
      strategy,
      score
    };
  };
  const candidates = [];
  const preferredBases = [
    { offset: 256, strategy: "vector+0x100" },
    { offset: 0, strategy: "vector+0x000" }
  ];
  for (const preferred of preferredBases) {
    const candidate = evaluateVectorBase(RP2040_FLASH_BASE + preferred.offset >>> 0, preferred.strategy);
    if (candidate) candidates.push(candidate);
  }
  const scanLimit = Math.min(logicalFlashLength, 524288);
  for (let offset = 512; offset < scanLimit; offset += 256) {
    const candidate = evaluateVectorBase(
      RP2040_FLASH_BASE + offset >>> 0,
      `vector+0x${offset.toString(16)}`
    );
    if (candidate) {
      candidates.push(candidate);
    }
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.base - b.base;
    });
    let best = candidates[0];
    const firmwareLooksCircuitPython = flashContainsAsciiToken(
      rp2040.flash,
      "CIRCUITPY",
      Math.min(logicalFlashLength, 1572864)
    );
    if (firmwareLooksCircuitPython) {
      const cpBootVectorBase = RP2040_FLASH_BASE + 256 >>> 0;
      const cpBootCandidate = candidates.find((candidate) => {
        if (candidate.base >>> 0 !== cpBootVectorBase) return false;
        const pcOffset = candidate.resolvedPC - RP2040_FLASH_BASE >>> 0;
        return pcOffset < 32768;
      });
      if (cpBootCandidate) {
        best = cpBootCandidate;
      }
    }
    rp2040.core.SP = best.initialSP;
    rp2040.core.VTOR = best.base >>> 0;
    rp2040.core.BXWritePC((best.resolvedPC | 1) >>> 0);
    rp2040.core.xPSR = 16777216;
    return {
      vectorBase: best.base >>> 0,
      initialSP: best.initialSP,
      initialPC: best.initialPC,
      resolvedPC: best.resolvedPC >>> 0,
      usedFallback: false,
      strategy: `${best.strategy} score=${best.score}`,
      probe0100SP,
      probe0100PC,
      probe0000SP,
      probe0000PC
    };
  }
  const fallbackBase = RP2040_FLASH_BASE + 256 >>> 0;
  const fallbackVectorSp = readWord(fallbackBase) >>> 0;
  const fallbackVectorPc = readWord(fallbackBase + 4 >>> 0) >>> 0;
  const fallbackResolvedPc = resolvePcAddress((fallbackVectorPc & ~1) >>> 0);
  const fallbackSp = fallbackVectorSp >= sramStart && fallbackVectorSp <= sramEnd && (fallbackVectorSp & 3) === 0 ? fallbackVectorSp : Math.max(sramStart + 256, sramEnd - 256 >>> 0) >>> 0;
  const fallbackPc = fallbackVectorPc !== 0 && fallbackVectorPc !== 4294967295 && isExecutableAddress(fallbackResolvedPc) ? fallbackResolvedPc : fallbackBase;
  rp2040.core.SP = fallbackSp;
  rp2040.core.VTOR = fallbackBase >>> 0;
  rp2040.core.BXWritePC((fallbackPc | 1) >>> 0);
  rp2040.core.xPSR = 16777216;
  return {
    vectorBase: fallbackBase,
    initialSP: fallbackSp,
    initialPC: fallbackVectorPc !== 0 && fallbackVectorPc !== 4294967295 ? fallbackVectorPc : (fallbackPc | 1) >>> 0,
    resolvedPC: fallbackPc,
    usedFallback: true,
    strategy: "fallback+0x100",
    fallbackReason: "no_valid_vector_table",
    probe0100SP,
    probe0100PC,
    probe0000SP,
    probe0000PC
  };
}
function decodeBase64ToBytes(base64) {
  const normalized = String(base64 || "").replace(/\s+/g, "");
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 255;
  return out;
}
function getRp2040LogicalFlashLength(rp2040, logicalFlashBytes) {
  const physicalSize = Math.max(0, Number(rp2040?.flash?.length || 0));
  if (physicalSize <= 0) return 0;
  if (!Number.isFinite(Number(logicalFlashBytes)) || Number(logicalFlashBytes) <= 0) {
    return physicalSize;
  }
  return Math.max(1, Math.min(physicalSize, Math.floor(Number(logicalFlashBytes))));
}
function mapRp2040FlashAddress(targetAddr, logicalFlashLength) {
  if (logicalFlashLength <= 0) return -1;
  return rp2040FlashAddressToIndex(targetAddr, logicalFlashLength);
}
function loadRP2040FirmwareFromUF2Payload(rp2040, uf2Payload, logicalFlashBytes) {
  const payload = String(uf2Payload || "").startsWith(UF2_PAYLOAD_PREFIX) ? String(uf2Payload).slice(UF2_PAYLOAD_PREFIX.length) : String(uf2Payload || "");
  const logicalFlashLength = getRp2040LogicalFlashLength(rp2040, logicalFlashBytes);
  const bytes = decodeBase64ToBytes(payload);
  const blockCount = Math.floor(bytes.length / UF2_BLOCK_SIZE);
  for (let i = 0; i < blockCount; i++) {
    const offset = i * UF2_BLOCK_SIZE;
    const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, UF2_BLOCK_SIZE);
    const m0 = dv.getUint32(0, true);
    const m1 = dv.getUint32(4, true);
    const mEnd = dv.getUint32(508, true);
    if (m0 !== UF2_MAGIC_START0 || m1 !== UF2_MAGIC_START1 || mEnd !== UF2_MAGIC_END) continue;
    const targetAddr = dv.getUint32(12, true) >>> 0;
    const payloadSize = dv.getUint32(16, true) >>> 0;
    if (payloadSize === 0 || payloadSize > 476) continue;
    const dstStart = mapRp2040FlashAddress(targetAddr, logicalFlashLength);
    if (dstStart < 0 || dstStart >= logicalFlashLength) continue;
    const maxCopy = Math.min(payloadSize, logicalFlashLength - dstStart);
    if (maxCopy <= 0) continue;
    const payloadOffset = offset + 32;
    rp2040.flash.set(bytes.subarray(payloadOffset, payloadOffset + maxCopy), dstStart);
  }
  return loadRP2040Entry(rp2040, logicalFlashLength);
}
function loadRP2040FirmwareFromHex(rp2040, firmwareHex, logicalFlashBytes) {
  const segments = parseIntelHexSegments(firmwareHex);
  const logicalFlashLength = getRp2040LogicalFlashLength(rp2040, logicalFlashBytes);
  let flashBytesWritten = 0;
  for (const seg of segments) {
    const segStart = seg.address >>> 0;
    const segEnd = seg.address + seg.bytes.length >>> 0;
    const flashStart = RP2040_FLASH_BASE;
    const flashEnd = RP2040_FLASH_BASE + logicalFlashLength;
    if (segEnd <= flashStart || segStart >= flashEnd) {
      continue;
    }
    const copyStart = Math.max(segStart, flashStart);
    const copyEnd = Math.min(segEnd, flashEnd);
    const srcOffset = copyStart - segStart;
    const dstOffset = copyStart - flashStart;
    const copyLength = copyEnd - copyStart;
    rp2040.flash.set(seg.bytes.subarray(srcOffset, srcOffset + copyLength), dstOffset);
    flashBytesWritten += copyLength;
  }
  if (flashBytesWritten === 0 && segments.length > 0) {
    for (const seg of segments) {
      if (seg.address < logicalFlashLength) {
        const dstOffset = seg.address;
        const maxCopy = Math.max(0, Math.min(seg.bytes.length, logicalFlashLength - dstOffset));
        if (maxCopy > 0) {
          rp2040.flash.set(seg.bytes.subarray(0, maxCopy), dstOffset);
          flashBytesWritten += maxCopy;
        }
      }
    }
  }
  return loadRP2040Entry(rp2040, logicalFlashLength);
}
function applyRP2040FlashPartitions(rp2040, partitions, logicalFlashBytes) {
  if (!partitions.length) return;
  const logicalFlashLength = getRp2040LogicalFlashLength(rp2040, logicalFlashBytes);
  if (logicalFlashLength <= 0) return;
  for (const partition of partitions) {
    const dstOffset = partition.offset >>> 0;
    if (dstOffset >= logicalFlashLength) continue;
    const maxCopy = Math.min(partition.bytes.length, logicalFlashLength - dstOffset);
    if (maxCopy <= 0) continue;
    rp2040.flash.set(partition.bytes.subarray(0, maxCopy), dstOffset);
  }
}
function loadRP2040Firmware(rp2040, firmware, options = {}) {
  rp2040.flash.fill(255);
  const logicalFlashLength = getRp2040LogicalFlashLength(rp2040, options.logicalFlashBytes);
  const partitions = Array.isArray(options.partitions) ? options.partitions : [];
  const source = String(firmware || "").trim();
  let entryInfo;
  if (!source) {
    entryInfo = loadRP2040Entry(rp2040, logicalFlashLength);
  } else if (source.startsWith(UF2_PAYLOAD_PREFIX)) {
    entryInfo = loadRP2040FirmwareFromUF2Payload(rp2040, source, logicalFlashLength);
  } else {
    entryInfo = loadRP2040FirmwareFromHex(rp2040, source, logicalFlashLength);
  }
  if (partitions.length > 0) {
    applyRP2040FlashPartitions(rp2040, partitions, logicalFlashLength);
    entryInfo = loadRP2040Entry(rp2040, logicalFlashLength);
  }
  return entryInfo;
}
var AVRRunner = class {
  constructor(hexData, componentsDef, wiresDef, onStateUpdate, options = {}) {
    __publicField(this, "cpu", null);
    __publicField(this, "adc", null);
    __publicField(this, "usart", null);
    __publicField(this, "twi", null);
    __publicField(this, "spi", null);
    __publicField(this, "portB", null);
    __publicField(this, "portC", null);
    __publicField(this, "portD", null);
    __publicField(this, "updatePhysics", null);
    __publicField(this, "timers", []);
    __publicField(this, "running", false);
    __publicField(this, "pinStates", {});
    __publicField(this, "currentWires", []);
    __publicField(this, "instances", /* @__PURE__ */ new Map());
    __publicField(this, "lastTime", 0);
    __publicField(this, "statusInterval");
    __publicField(this, "pinsChanged", true);
    __publicField(this, "speed", 1);
    __publicField(this, "boardId");
    __publicField(this, "serialBaudRate", 9600);
    __publicField(this, "softSerialBaudRate", 9600);
    __publicField(this, "serialByteBudget", 0);
    __publicField(this, "onStateUpdate");
    __publicField(this, "onByteTransmitCb");
    __publicField(this, "softSerialRxPin", "11");
    __publicField(this, "softSerialTxPin", "10");
    __publicField(this, "softSerialRxLineLow", false);
    __publicField(this, "softSerialNextInjectCycle", 0);
    __publicField(this, "softSerialDecodeState", {
      receiving: false,
      sampleCycle: 0,
      sampleIndex: 0,
      currentByte: 0,
      lastLevel: true
    });
    __publicField(this, "i2sState", /* @__PURE__ */ new Map());
    __publicField(this, "pwmState", /* @__PURE__ */ new Map());
    __publicField(this, "oneWireState", /* @__PURE__ */ new Map());
    __publicField(this, "protocolEndpointsCache", /* @__PURE__ */ new Map());
    __publicField(this, "componentSyncMeta", /* @__PURE__ */ new Map());
    __publicField(this, "circuitDirty", true);
    __publicField(this, "lastPhysicsSolveAt", 0);
    __publicField(this, "lastStateEmitAt", 0);
    __publicField(this, "lastRunLoopMs", 0);
    __publicField(this, "lastPhysicsMs", 0);
    __publicField(this, "lastComponentUpdateMs", 0);
    __publicField(this, "runLoop", () => {
      if (!this.running || !this.cpu) return;
      const loopStart = performance.now();
      const now = performance.now();
      const deltaTime = now - this.lastTime;
      let physicsMs = 0;
      if (deltaTime > 0) {
        const cyclesPerMs = 16e3 * this.speed;
        const cyclesToRun = deltaTime * cyclesPerMs;
        const targetObj = this.cpu.cycles + Math.min(cyclesToRun, 16e5 * Math.max(1, this.speed));
        const shouldSolvePhysics = this.circuitDirty || now - this.lastPhysicsSolveAt >= 16;
        if (this.updatePhysics && shouldSolvePhysics) {
          const physicsStart = performance.now();
          this.updatePhysics();
          physicsMs = performance.now() - physicsStart;
          this.lastPhysicsSolveAt = now;
          this.circuitDirty = false;
        }
        while (this.cpu.cycles < targetObj && this.running) {
          avrInstruction(this.cpu);
          this.cpu.tick();
          this.drainPendingCpuWork();
        }
        this.processSoftSerialDecode(this.cpu.cycles);
        this.lastTime = now;
        const bytesPerMs = this.serialBaudRate / 1e4;
        this.serialByteBudget += deltaTime * bytesPerMs;
        if (this.serialBuffer.length > 0 && this.usart && this.serialByteBudget >= 1) {
          const maxBytes = Math.floor(this.serialByteBudget);
          const toSend = Math.min(maxBytes, this.serialBuffer.length);
          for (let i = 0; i < toSend; i++) {
            this.usart.writeByte(this.serialBuffer.shift());
          }
          this.serialByteBudget -= toSend;
        }
        const instArray = Array.from(this.instances.values());
        const componentStart = performance.now();
        instArray.forEach((inst) => {
          let isWired = false;
          let hasResistor = !!inst.state.hasResistor;
          for (const pinId in inst.pins) {
            const netId = this.pinToNet.get(`${inst.id}:${pinId}`);
            if (netId !== void 0) {
              isWired = true;
              if (this.netHasResistor.has(netId)) hasResistor = true;
            }
          }
          inst.state.isWired = isWired;
          inst.state.hasResistor = hasResistor;
          inst.update(this.cpu.cycles, this.currentWires, instArray);
        });
        this.lastComponentUpdateMs = performance.now() - componentStart;
        this.lastPhysicsMs = physicsMs;
        this.lastRunLoopMs = performance.now() - loopStart;
        if (this.adc && this.cpu) {
          for (let i = 0; i < UNO_ANALOG_PINS.length; i++) {
            const arduinoPin = UNO_ANALOG_PINS[i];
            let voltage = 0;
            for (const w of this.currentWires) {
              const [fromComp, fromPin] = w.from.split(":");
              const [toComp, toPin] = w.to.split(":");
              let isConnectedToPin = false;
              let otherCompId = "";
              let otherCompPin = "";
              if (fromComp === this.boardId && (fromPin === arduinoPin || fromPin === `A${i}`)) {
                isConnectedToPin = true;
                otherCompId = toComp;
                otherCompPin = toPin;
              } else if (toComp === this.boardId && (toPin === arduinoPin || toPin === `A${i}`)) {
                isConnectedToPin = true;
                otherCompId = fromComp;
                otherCompPin = fromPin;
              }
              if (isConnectedToPin) {
                const inst = this.instances.get(otherCompId);
                if (inst) {
                  voltage = Math.max(voltage, inst.getPinVoltage(otherCompPin));
                }
              }
            }
            this.adc.channelValues[i] = voltage;
          }
        }
      }
      setTimeout(this.runLoop, 1);
    });
    __publicField(this, "serialBuffer", []);
    __publicField(this, "pinToNet", /* @__PURE__ */ new Map());
    __publicField(this, "netHasResistor", /* @__PURE__ */ new Set());
    this.currentWires = wiresDef || [];
    this.onStateUpdate = onStateUpdate;
    this.onByteTransmitCb = options.onByteTransmit;
    this.speed = options.speed ?? 1;
    this.circuitDirty = true;
    const fallbackBoard = (componentsDef || []).find((c) => /(arduino|esp32|stm32|rp2040|pico)/i.test(String(c.type || "")));
    this.boardId = options.boardId || fallbackBoard?.id || "wokwi-arduino-uno_0";
    this.setSerialBaudRate(options.serialBaudRate ?? 9600);
    const program = new Uint16Array(32768);
    const { data } = parse(hexData);
    const u8 = new Uint8Array(program.buffer);
    u8.set(data);
    this.cpu = new CPU(program, 8704);
    this.timers = [
      new AVRTimer(this.cpu, timer0Config),
      new AVRTimer(this.cpu, timer1Config),
      new AVRTimer(this.cpu, timer2Config)
    ];
    this.adc = new AVRADC(this.cpu, adcConfig);
    this.usart = new AVRUSART(this.cpu, usart0Config, 16e6);
    this.usart.onByteTransmit = (value) => {
      const char = String.fromCharCode(value);
      this.pulseBoardLed("1");
      if (this.onByteTransmitCb) {
        this.onByteTransmitCb({ boardId: this.boardId, value, char, source: "uart0" });
      } else {
        this.onStateUpdate({ type: "serial", data: char, value, boardId: this.boardId, source: "uart0" });
      }
    };
    this.twi = new AVRTWI(this.cpu, twiConfig, 16e6);
    this.spi = new AVRSPI(this.cpu, spiConfig, 16e6);
    (componentsDef || []).forEach((cDef) => {
      const LogicClass = LOGIC_REGISTRY[cDef.type];
      if (LogicClass) {
        const pins = COMPONENT_PINS[cDef.type] || [{ id: "A" }, { id: "K" }, { id: "GND" }, { id: "VSS" }];
        const manifest = { type: cDef.type, attrs: cDef.attrs || {}, pins };
        const inst = new LogicClass(cDef.id, manifest);
        if (cDef.attrs) inst.state = { ...inst.state, ...cDef.attrs };
        this.instances.set(cDef.id, inst);
      }
    });
    this.buildNetlist();
    this.portB = new AVRIOPort(this.cpu, portBConfig);
    this.portC = new AVRIOPort(this.cpu, portCConfig);
    this.portD = new AVRIOPort(this.cpu, portDConfig);
    class TWIAdapter {
      constructor(twi, instances) {
        this.twi = twi;
        this.instances = instances;
        // Track the addressed slave across the read transaction
        __publicField(this, "activeSlave", null);
      }
      start(repeated) {
        this.twi.completeStart();
      }
      stop() {
        const instArray = Array.from(this.instances.values());
        for (const inst of instArray) {
          if (inst.onI2CStop) {
            inst.onI2CStop();
          }
        }
        this.activeSlave = null;
        this.twi.completeStop();
      }
      connectToSlave(addr, write) {
        const instArray = Array.from(this.instances.values());
        let ack = false;
        this.activeSlave = null;
        for (const inst of instArray) {
          if (inst.onI2CStart) {
            if (inst.onI2CStart(addr, !write)) {
              ack = true;
              if (!this.activeSlave) this.activeSlave = inst;
            }
          }
        }
        this.twi.completeConnect(ack);
      }
      writeByte(value) {
        const instArray = Array.from(this.instances.values());
        let handled = false;
        for (const inst of instArray) {
          if (inst.onI2CByte) {
            if (inst.onI2CByte(-1, value)) {
              handled = true;
            }
          }
        }
        this.twi.completeWrite(handled);
      }
      readByte(ack) {
        let byte = 255;
        if (this.activeSlave) {
          const slave = this.activeSlave;
          if (typeof slave.onI2CReadByte === "function") {
            byte = slave.onI2CReadByte() & 255;
          } else if (typeof slave.readByte === "function") {
            byte = slave.readByte() & 255;
          }
        }
        this.twi.completeRead(byte);
      }
    }
    this.twi.eventHandler = new TWIAdapter(this.twi, this.instances);
    this.spi.onByte = (value) => {
      const instArray = Array.from(this.instances.values());
      let returnByte = 255;
      const unoId = this.boardId;
      if (unoId) {
        const misoNet = this.pinToNet.get(`${unoId}:12`);
        if (misoNet !== void 0) {
          if (misoNet === this.pinToNet.get(`${unoId}:11`)) {
            returnByte = value;
          } else if (misoNet === this.pinToNet.get(`${unoId}:13`)) {
            returnByte = 170;
          } else {
            let drivenHigh = false;
            for (const [p, net] of this.pinToNet) {
              if (net === misoNet && !p.endsWith(":12")) {
                const [compId, pinId] = p.split(":");
                if (compId === unoId && this.pinStates[pinId]) {
                  drivenHigh = true;
                  break;
                }
              }
            }
            returnByte = drivenHigh ? 255 : 0;
          }
        }
      }
      for (const inst of instArray) {
        if (inst.onSPIByte && this.isSPISelected(inst)) {
          const res = inst.onSPIByte(value);
          if (res !== void 0) {
            returnByte = res;
          }
        }
      }
      this.cpu.addClockEvent(() => {
        this.spi.completeTransfer(returnByte);
      }, this.spi.transferCycles);
    };
    this.setupHooks();
    this.setSoftSerialRxLevel(true);
    this.running = true;
    this.lastTime = performance.now();
    this.runLoop();
    this.statusInterval = setInterval(() => {
      if (this.running && this.cpu) {
        const msg = { type: "state" };
        const now = performance.now();
        let shouldEmit = false;
        if (this.pinsChanged) {
          msg.pins = this.pinStates;
          this.pinsChanged = false;
          shouldEmit = true;
        }
        if (this.adc) {
          msg.analog = Array.from(this.adc.channelValues);
        }
        const compStates = [];
        for (const inst of this.instances.values()) {
          if (!inst.stateChanged) continue;
          const syncState = inst.getSyncState();
          if (!this.shouldEmitComponentState(inst.id, syncState, now)) continue;
          inst.stateChanged = false;
          compStates.push({
            id: inst.id,
            state: syncState,
            ...collectComponentTelemetry(inst)
          });
        }
        if (compStates.length > 0) {
          msg.components = compStates;
          shouldEmit = true;
        }
        if (!shouldEmit && now - this.lastStateEmitAt >= 250) {
          shouldEmit = true;
        }
        if (shouldEmit) {
          msg.boardId = this.boardId;
          msg.perf = {
            lastRunLoopMs: Number(this.lastRunLoopMs.toFixed(3)),
            lastPhysicsMs: Number(this.lastPhysicsMs.toFixed(3)),
            lastComponentUpdateMs: Number(this.lastComponentUpdateMs.toFixed(3))
          };
          this.lastStateEmitAt = now;
          this.onStateUpdate(msg);
        }
      }
    }, 1e3 / 30);
  }
  isBoardArduinoPin(wireCoord, targetPin) {
    const [compId, compPin] = wireCoord.split(":");
    if (compId !== this.boardId) return false;
    const inst = this.instances.get(compId);
    if (!inst || !inst.type.includes("arduino")) return false;
    return compPin === targetPin || compPin === `D${targetPin}` || compPin === `A${targetPin}`;
  }
  pulseBoardLed(pinId) {
    const boardInst = this.instances.get(this.boardId);
    if (!boardInst || !this.cpu) return;
    boardInst.onPinStateChange(pinId, true, this.cpu.cycles);
  }
  getSoftSerialBitCycles() {
    const baud = Math.max(300, this.softSerialBaudRate | 0);
    return Math.max(1, Math.floor(16e6 / baud));
  }
  setSoftSerialRxLevel(isHigh) {
    this.softSerialRxLineLow = !isHigh;
    this.portB?.setPin(3, isHigh);
  }
  emitSoftSerialByte(value) {
    const byte = value & 255;
    const char = String.fromCharCode(byte);
    this.pulseBoardLed("1");
    if (this.onByteTransmitCb) {
      this.onByteTransmitCb({ boardId: this.boardId, value: byte, char, source: "softserial" });
    } else {
      this.onStateUpdate({ type: "serial", data: char, value: byte, boardId: this.boardId, source: "softserial" });
    }
  }
  processSoftSerialDecode(cycles) {
    const state = this.softSerialDecodeState;
    if (!state.receiving) return;
    const bitCycles = this.getSoftSerialBitCycles();
    while (state.receiving && state.sampleCycle <= cycles) {
      if (state.sampleIndex < 8) {
        if (state.lastLevel) {
          state.currentByte |= 1 << state.sampleIndex;
        }
        state.sampleIndex += 1;
        state.sampleCycle += bitCycles;
        continue;
      }
      if (state.lastLevel) {
        this.emitSoftSerialByte(state.currentByte);
      }
      state.receiving = false;
      state.sampleIndex = 0;
      state.currentByte = 0;
    }
  }
  observeSoftSerialTx(pinId, isHigh, cycles) {
    if (pinId !== this.softSerialTxPin) return;
    const state = this.softSerialDecodeState;
    this.processSoftSerialDecode(cycles);
    const prev = state.lastLevel;
    state.lastLevel = isHigh;
    if (!state.receiving && prev && !isHigh) {
      const bitCycles = this.getSoftSerialBitCycles();
      state.receiving = true;
      state.currentByte = 0;
      state.sampleIndex = 0;
      state.sampleCycle = cycles + bitCycles * 1.5;
    }
  }
  scheduleSoftSerialRxFrame(value) {
    if (!this.cpu) return;
    const cpu = this.cpu;
    const bitCycles = this.getSoftSerialBitCycles();
    const frameStart = Math.max(cpu.cycles + 1, this.softSerialNextInjectCycle || cpu.cycles + 1);
    const byte = value & 255;
    const levels = [0];
    for (let i = 0; i < 8; i++) {
      levels.push(byte >> i & 1);
    }
    levels.push(1);
    levels.forEach((level, index) => {
      const cycleAt = frameStart + index * bitCycles;
      cpu.addClockEvent(() => {
        if (!this.running) return;
        this.setSoftSerialRxLevel(level === 1);
      }, cycleAt - cpu.cycles);
    });
    this.softSerialNextInjectCycle = frameStart + levels.length * bitCycles;
  }
  hasPendingCpuWork() {
    if (!this.cpu) return false;
    const cpuAny = this.cpu;
    const pendingClock = !!cpuAny?.nextClockEvent && cpuAny.nextClockEvent.cycles <= this.cpu.cycles;
    const pendingInterrupt = !!cpuAny?.interruptsEnabled && Number(cpuAny?.nextInterrupt ?? -1) >= 0;
    return pendingClock || pendingInterrupt;
  }
  drainPendingCpuWork(maxTicks = 8) {
    if (!this.cpu) return;
    let guard = 0;
    while (this.running && this.hasPendingCpuWork() && guard < maxTicks) {
      this.cpu.tick();
      guard += 1;
    }
  }
  shouldEmitComponentState(componentId, state, nowMs) {
    const policy = getComponentStateSyncPolicy(state);
    const prev = this.componentSyncMeta.get(componentId);
    if (policy.minIntervalMs > 0 && prev && nowMs - prev.lastSentAt < policy.minIntervalMs) {
      return false;
    }
    this.componentSyncMeta.set(componentId, { lastSentAt: nowMs, lastWeight: policy.weight });
    return true;
  }
  traversePassive(inst, compId, pinId, voltage, visit) {
    if (inst.type === "wokwi-resistor") {
      const otherPin = pinId === "p1" ? "p2" : pinId === "p2" ? "p1" : null;
      if (!otherPin) return;
      inst.setPinVoltage(otherPin, voltage);
      visit(`${compId}:${otherPin}`, voltage);
    } else if (inst.type === "wokwi-led") {
      if (pinId === "A") {
        const nextV = Math.max(0, voltage - 1.8);
        inst.setPinVoltage("K", nextV);
        visit(`${compId}:K`, nextV);
      }
    } else if (inst.type === "wokwi-pushbutton" && inst.state?.pressed) {
      const otherPin = pinId === "1" ? "2" : pinId === "2" ? "1" : null;
      if (!otherPin) return;
      inst.setPinVoltage(otherPin, voltage);
      visit(`${compId}:${otherPin}`, voltage);
    } else if (inst.type === "wokwi-breadboard" || inst.type === "wokwi-breadboard-half") {
      const bridges = getInternalBridgesForComponent(compId, inst.type);
      for (const bridge of bridges) {
        if (bridge[0] === `${compId}:${pinId}`) visit(bridge[1], voltage);
        else if (bridge[1] === `${compId}:${pinId}`) visit(bridge[0], voltage);
      }
    }
  }
  setupHooks() {
    if (!this.cpu) return;
    const updateOopPin = (arduinoPinStr, isHigh) => {
      const voltage = isHigh ? 5 : 0;
      const visitedEdges = /* @__PURE__ */ new Set();
      const visitedNodes = /* @__PURE__ */ new Set();
      const visitNode = (node, v) => {
        if (visitedNodes.has(node)) return;
        visitedNodes.add(node);
        const [compId, compPin] = node.split(":");
        for (const wire of this.currentWires) {
          const edgeKey = `${wire.from}|${wire.to}`;
          if (visitedEdges.has(edgeKey)) continue;
          if (wire.from === node || wire.to === node) {
            visitedEdges.add(edgeKey);
            visitNode(wire.from === node ? wire.to : wire.from, v);
          }
        }
        const inst = this.instances.get(compId);
        if (inst) {
          if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: "INPUT" };
          inst.setPinVoltage(compPin, v);
          this.circuitDirty = true;
          if (this.cpu) {
            inst.onPinStateChange(compPin, v > 1.8, this.cpu.cycles);
          }
          this.tickI2S(inst, compId, compPin, v > 1.8);
          this.traversePassive(inst, compId, compPin, v, (forwardNode, nextV) => {
            visitNode(forwardNode, nextV);
          });
        }
      };
      visitNode(`${this.boardId}:${arduinoPinStr}`, voltage);
    };
    this.updatePhysics = () => {
      const solver = new CircuitSolver();
      solver.reset();
      const netToNode = /* @__PURE__ */ new Map();
      this.pinToNet.forEach((netId, pinStr) => {
        if (!netToNode.has(netId)) {
          const isGnd = Array.from(this.pinToNet.entries()).some(([p, n]) => n === netId && (p.includes(":GND") || p.toLowerCase().includes(":vss") || p.includes(":top_gnd") || p.includes(":bottom_gnd")));
          if (isGnd) netToNode.set(netId, 0);
          else {
            solver.addPin(pinStr);
            netToNode.set(netId, solver.nodes.get(pinStr));
          }
        }
        solver.addPin(pinStr, netToNode.get(netId));
      });
      for (const [pinStr, netId] of this.pinToNet) {
        if (pinStr.startsWith(this.boardId)) {
          const [_, pinId] = pinStr.split(":");
          const isHigh = !!this.pinStates[pinId];
          solver.addVoltageSource(pinStr, isHigh ? 5 : 0);
        }
      }
      for (const [id, inst] of this.instances) {
        if (typeof inst.getMnaStamps === "function" || typeof inst.getMnaPins === "function") {
          solver.addComponent(inst);
        }
      }
      const voltages = solver.solve();
      this.pinToNet.forEach((netId, pinStr) => {
        const nodeId = netToNode.get(netId) ?? -1;
        const v = voltages.get(nodeId) ?? 0;
        const [compId, compPin] = pinStr.split(":");
        const inst = this.instances.get(compId);
        if (inst) inst.setPinVoltage(compPin, v);
      });
      const checkPort = (port, pinNames) => {
        pinNames.forEach((pin, i) => {
          let forcedLow = this.softSerialRxLineLow && (pin === this.softSerialRxPin || pin === `D${this.softSerialRxPin}`);
          if (!forcedLow) {
            const v = this.instances.get(this.boardId)?.getPinVoltage(pin) ?? 0;
            if (v < 0.5) forcedLow = true;
          }
          if (port) port.setPin(i, !forcedLow);
        });
      };
      if (this.portB) checkPort(this.portB, UNO_DIGITAL_PINS.slice(8, 14));
      if (this.portD) checkPort(this.portD, UNO_DIGITAL_PINS.slice(0, 8));
      if (this.portC) checkPort(this.portC, UNO_ANALOG_PINS);
    };
    const attachPort = (port, pinNames) => {
      port.addListener((value) => {
        pinNames.forEach((pin, i) => {
          const isHigh = (value & 1 << i) !== 0;
          if (this.pinStates[pin] !== isHigh) {
            this.pinStates[pin] = isHigh;
            this.pinsChanged = true;
            this.circuitDirty = true;
            const boardInst = this.instances.get(this.boardId);
            if (boardInst) {
              boardInst.onPinStateChange(pin, isHigh, this.cpu.cycles);
            }
            updateOopPin(pin, isHigh);
            this.dispatchOptionalProtocols(pin, isHigh, this.cpu.cycles);
            this.observeSoftSerialTx(pin, isHigh, this.cpu.cycles);
          }
        });
      });
    };
    if (this.portB) attachPort(this.portB, UNO_DIGITAL_PINS.slice(8, 14));
    if (this.portD) attachPort(this.portD, UNO_DIGITAL_PINS.slice(0, 8));
    if (this.portC) attachPort(this.portC, UNO_ANALOG_PINS);
    [...UNO_DIGITAL_PINS, ...UNO_ANALOG_PINS].forEach((pin) => {
      this.pinStates[pin] = false;
      this.circuitDirty = true;
      updateOopPin(pin, false);
    });
  }
  serialRx(data) {
    for (let i = 0; i < data.length; i++) {
      this.serialBuffer.push(data.charCodeAt(i));
      this.pulseBoardLed("0");
    }
  }
  serialRxByte(value) {
    this.serialBuffer.push(value & 255);
    this.pulseBoardLed("0");
  }
  softSerialRxByte(value) {
    this.scheduleSoftSerialRxFrame(value & 255);
    this.pulseBoardLed("0");
  }
  setSerialBaudRate(baud) {
    const parsed = Number(baud);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(300, Math.min(2e6, Math.floor(parsed)));
    this.serialBaudRate = clamped;
  }
  getSerialBaudRate() {
    return this.serialBaudRate;
  }
  setSpeed(speed) {
    const s = Number(speed);
    if (Number.isFinite(s) && s > 0) {
      this.speed = s;
    }
  }
  stop() {
    const neopixelStates = collectNeopixelShutdownStates(this.instances);
    if (neopixelStates.length > 0) {
      this.onStateUpdate({ type: "state", boardId: this.boardId, components: neopixelStates });
    }
    this.running = false;
    clearInterval(this.statusInterval);
  }
  reset() {
    if (this.cpu) this.cpu.reset();
    this.softSerialNextInjectCycle = 0;
    this.softSerialDecodeState = {
      receiving: false,
      sampleCycle: 0,
      sampleIndex: 0,
      currentByte: 0,
      lastLevel: true
    };
    this.setSoftSerialRxLevel(true);
    this.protocolEndpointsCache.clear();
    this.pwmState.clear();
    this.oneWireState.clear();
    this.componentSyncMeta.clear();
  }
  // ─── SPI: chip-select awareness ───────────────────────────────────────────
  /**
   * Returns true if the component should receive the current SPI byte.
   * A component is selected when:
   *   • It has no CS/SS pin  (single-slave wiring → always selected), OR
   *   • Its CS/SS pin voltage is < 0.5 V  (active-LOW chip select)
   */
  isSPISelected(inst) {
    const csNames = ["cs", "ce", "ss", "ssel", "nss", "csn", "cs_n", "nce"];
    for (const name of csNames) {
      if (inst.pins[name]) return inst.getPinVoltage(name) < 0.5;
      if (inst.pins[name.toUpperCase()]) return inst.getPinVoltage(name.toUpperCase()) < 0.5;
    }
    return true;
  }
  // ─── I2S: bit-bang frame assembler ────────────────────────────────────────
  /**
   * Called from the pin-change traversal whenever any component has a pin
   * voltage updated.  If the changed pin is the component's BCLK or WS line
   * (matched by common I2S naming conventions), the assembler clocks one bit
   * into a shift buffer.  Once bitsPerFrame bits have been collected for one
   * channel, onI2SFrame() is called.
   *
   * Left-justified format (no WS-delay):
   *   WS=LOW  → left  channel (channel 0)
   *   WS=HIGH → right channel (channel 1)
   * Data is sampled on the BCLK **rising** edge, MSB first.
   */
  tickI2S(inst, compId, changedPin, isHigh) {
    if (!inst.onI2SFrame) return;
    const pin = changedPin.toLowerCase();
    const isBclk = pin === "bclk" || pin === "sck" || pin === "bit_clk" || pin === "blck";
    const isWs = pin === "ws" || pin === "lrck" || pin === "wsel" || pin === "lrc";
    if (!isBclk && !isWs) return;
    if (!this.i2sState.has(compId)) {
      this.i2sState.set(compId, { bclkLast: false, wsLast: false, shiftBuf: 0, bitCount: 0 });
    }
    const state = this.i2sState.get(compId);
    if (isWs) {
      if (state.wsLast !== isHigh) {
        const bpf = inst.state?.i2sBitsPerFrame ?? 16;
        if (state.bitCount >= bpf) {
          const channel = state.wsLast ? 1 : 0;
          const sample = state.shiftBuf << 32 - bpf | 0;
          inst.onI2SFrame(channel, sample, bpf);
        }
        state.wsLast = isHigh;
        state.shiftBuf = 0;
        state.bitCount = 0;
      }
      return;
    }
    const rising = isHigh && !state.bclkLast;
    state.bclkLast = isHigh;
    if (rising) {
      const sdPin = this.findI2SPinName(inst, ["sdata", "sdin", "din", "sd", "dout", "data"]);
      const bit = sdPin !== null ? inst.getPinVoltage(sdPin) > 0.5 ? 1 : 0 : 0;
      const bpf = inst.state?.i2sBitsPerFrame ?? 16;
      state.shiftBuf = (state.shiftBuf << 1 | bit) >>> 0;
      state.bitCount++;
      if (state.bitCount >= bpf) {
        const channel = state.wsLast ? 1 : 0;
        const sample = state.shiftBuf << 32 - bpf | 0;
        inst.onI2SFrame(channel, sample, bpf);
        state.shiftBuf = 0;
        state.bitCount = 0;
      }
    }
  }
  /** Finds the first existing pin on `inst` from a list of candidate names
   *  (case-insensitive, lower then UPPER checked). */
  findI2SPinName(inst, candidates) {
    for (const name of candidates) {
      if (inst.pins[name]) return name;
      if (inst.pins[name.toUpperCase()]) return name.toUpperCase();
    }
    return null;
  }
  getArduinoPinAliases(pinId) {
    const raw = String(pinId || "").toUpperCase();
    const out = /* @__PURE__ */ new Set([raw]);
    if (/^D\d+$/.test(raw)) {
      out.add(raw.slice(1));
    } else if (/^\d+$/.test(raw)) {
      out.add(`D${raw}`);
    }
    return Array.from(out);
  }
  getProtocolEndpointsForArduinoPin(pinId) {
    const key = String(pinId || "").toUpperCase();
    const cached = this.protocolEndpointsCache.get(key);
    if (cached) return cached;
    const endpoints = collectConnectedComponentPins(
      this.boardId,
      this.getArduinoPinAliases(key),
      this.currentWires,
      this.instances
    );
    this.protocolEndpointsCache.set(key, endpoints);
    return endpoints;
  }
  dispatchOptionalPwm(pinId, isHigh, cycles) {
    const key = String(pinId || "").toUpperCase();
    let state = this.pwmState.get(key);
    if (!state) {
      state = { lastRiseCycle: -1, lastFallCycle: -1, lastPeriodCycles: -1 };
      this.pwmState.set(key, state);
    }
    let frequencyHz = 0;
    let dutyCycle = 0;
    let pulseUs = 0;
    let periodUs = 0;
    if (isHigh) {
      if (state.lastRiseCycle >= 0 && state.lastFallCycle > state.lastRiseCycle) {
        const periodCycles = Math.max(1, cycles - state.lastRiseCycle);
        const highCycles = Math.max(0, state.lastFallCycle - state.lastRiseCycle);
        state.lastPeriodCycles = periodCycles;
        frequencyHz = 16e6 / periodCycles;
        dutyCycle = Math.max(0, Math.min(1, highCycles / periodCycles));
        periodUs = periodCycles / 16;
        pulseUs = highCycles / 16;
      }
      state.lastRiseCycle = cycles;
    } else {
      state.lastFallCycle = cycles;
      if (state.lastRiseCycle >= 0) {
        const highCycles = Math.max(0, cycles - state.lastRiseCycle);
        pulseUs = highCycles / 16;
        if (state.lastPeriodCycles > 0) {
          frequencyHz = 16e6 / state.lastPeriodCycles;
          dutyCycle = Math.max(0, Math.min(1, highCycles / state.lastPeriodCycles));
          periodUs = state.lastPeriodCycles / 16;
        }
      }
    }
    if (frequencyHz <= 0 && dutyCycle <= 0 && pulseUs <= 0) return;
    const meta = {
      protocol: "pwm",
      boardPin: key,
      isHigh,
      frequencyHz,
      dutyCycle,
      pulseUs,
      periodUs,
      source: "gpio",
      cycles
    };
    for (const endpoint of this.getProtocolEndpointsForArduinoPin(key)) {
      invokeOptional(endpoint.inst, ["onPWM", "onPwm", "onPWMSignal"], [endpoint.pinId, meta]);
    }
  }
  dispatchOptionalOneWire(pinId, isHigh, cycles) {
    const key = String(pinId || "").toUpperCase();
    let state = this.oneWireState.get(key);
    if (!state) {
      state = { lowStartCycle: null, highStartCycle: null };
      this.oneWireState.set(key, state);
    }
    const endpoints = this.getProtocolEndpointsForArduinoPin(key);
    if (!endpoints.length) {
      if (isHigh) {
        state.lowStartCycle = null;
        state.highStartCycle = cycles;
      } else {
        state.highStartCycle = null;
        state.lowStartCycle = cycles;
      }
      return;
    }
    if (!isHigh) {
      if (state.highStartCycle != null) {
        const highCycles = Math.max(0, cycles - state.highStartCycle);
        const highUs = highCycles / 16;
        if (highUs > 0) {
          const pulseMeta = {
            protocol: "pulse",
            boardPin: key,
            pulseUs: highUs,
            highUs,
            edge: "falling",
            cycles
          };
          for (const endpoint of endpoints) {
            invokeOptional(endpoint.inst, ["onPulseHigh", "onDigitalPulseHigh", "onOneWirePulseHigh"], [endpoint.pinId, pulseMeta]);
          }
        }
      }
      state.highStartCycle = null;
      state.lowStartCycle = cycles;
      return;
    }
    if (state.lowStartCycle == null) return;
    const lowCycles = Math.max(0, cycles - state.lowStartCycle);
    state.lowStartCycle = null;
    state.highStartCycle = cycles;
    const lowUs = lowCycles / 16;
    if (lowUs > 0) {
      const pulseMeta = {
        protocol: "pulse",
        boardPin: key,
        pulseUs: lowUs,
        lowUs,
        edge: "rising",
        cycles
      };
      for (const endpoint of endpoints) {
        invokeOptional(endpoint.inst, ["onPulseLow", "onDigitalPulseLow", "onOneWirePulseLow"], [endpoint.pinId, pulseMeta]);
      }
    }
    if (lowUs >= 360) {
      const meta = {
        protocol: "onewire",
        boardPin: key,
        pulseUs: lowUs,
        kind: "reset",
        cycles
      };
      for (const endpoint of endpoints) {
        invokeOptional(endpoint.inst, ["onOneWireReset", "onOnewireReset"], [endpoint.pinId, meta]);
      }
      return;
    }
    if (lowUs >= 1 && lowUs <= 120) {
      const bit = lowUs < 20 ? 1 : 0;
      const meta = {
        protocol: "onewire",
        boardPin: key,
        pulseUs: lowUs,
        kind: "slot",
        bit,
        cycles
      };
      for (const endpoint of endpoints) {
        invokeOptional(endpoint.inst, ["onOneWireWriteBit", "onOnewireWriteBit"], [endpoint.pinId, bit, meta]);
        invokeOptional(endpoint.inst, ["onOneWireSlot", "onOnewireSlot"], [endpoint.pinId, meta]);
      }
    }
  }
  dispatchOptionalProtocols(pinId, isHigh, cycles) {
    this.dispatchOptionalPwm(pinId, isHigh, cycles);
    this.dispatchOptionalOneWire(pinId, isHigh, cycles);
  }
  buildNetlist() {
    const adj = /* @__PURE__ */ new Map();
    const addEdge = (a, b) => {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    };
    for (const wire of this.currentWires) {
      addEdge(wire.from, wire.to);
    }
    for (const [id, inst] of this.instances) {
      const bridges = getInternalBridgesForComponent(id, inst.type);
      for (const bridge of bridges) {
        addEdge(bridge[0], bridge[1]);
      }
    }
    const visited = /* @__PURE__ */ new Set();
    let currentNet = 0;
    for (const startNode of adj.keys()) {
      if (!visited.has(startNode)) {
        const queue = [startNode];
        visited.add(startNode);
        while (queue.length > 0) {
          const node = queue.shift();
          this.pinToNet.set(node, currentNet);
          const parts = node.split(":");
          if (parts.length === 2) {
            const compId = parts[0];
            const pinId = parts[1];
            if (!pinId.startsWith("D") && !pinId.startsWith("A") && /^\d+$/.test(pinId)) {
              this.pinToNet.set(`${compId}:D${pinId}`, currentNet);
            } else if (pinId.startsWith("D")) {
              this.pinToNet.set(`${compId}:${pinId.substring(1)}`, currentNet);
            }
          }
          for (const neighbor of adj.get(node) || []) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
        currentNet++;
      }
    }
    this.netHasResistor.clear();
    for (const [id, inst] of this.instances) {
      if (inst.type === "wokwi-resistor") {
        const n1 = this.pinToNet.get(`${id}:p1`);
        const n2 = this.pinToNet.get(`${id}:p2`);
        if (n1 !== void 0) this.netHasResistor.add(n1);
        if (n2 !== void 0) this.netHasResistor.add(n2);
      }
    }
  }
  arePinsConnected(pinA, pinB) {
    const netA = this.pinToNet.get(pinA);
    const netB = this.pinToNet.get(pinB);
    return netA !== void 0 && netA === netB;
  }
};
var RP2040MockClock = class {
  constructor() {
    __publicField(this, "_micros", 0);
    __publicField(this, "timers", []);
  }
  get micros() {
    return this._micros;
  }
  get nanos() {
    return this._micros * 1e3;
  }
  pause() {
  }
  resume() {
  }
  createTimer(deltaMicros, callback) {
    const timer = { micros: this._micros + deltaMicros, callback };
    this.timers.push(timer);
    this.timers.sort((a, b) => a.micros - b.micros);
    return timer;
  }
  deleteTimer(timer) {
    const index = this.timers.indexOf(timer);
    if (index >= 0) this.timers.splice(index, 1);
  }
  tick(nanos) {
    this.advance(nanos / 1e3);
  }
  advance(deltaMicros) {
    const targetTime = this._micros + Math.max(deltaMicros, 0);
    while (this.timers.length > 0 && this.timers[0].micros <= targetTime) {
      const timer = this.timers.shift();
      this._micros = timer.micros;
      timer.callback();
    }
    this._micros = targetTime;
  }
  get nanosToNextAlarm() {
    if (this.timers.length === 0) return -1;
    return Math.max(0, (this.timers[0].micros - this._micros) * 1e3);
  }
};
var _RP2040Runner = class _RP2040Runner {
  constructor(hexData, componentsDef, wiresDef, onStateUpdate, options = {}) {
    __publicField(this, "cpu", null);
    __publicField(this, "gdbWs", null);
    __publicField(this, "running", false);
    __publicField(this, "pinStates", {});
    __publicField(this, "currentWires", []);
    __publicField(this, "instances", /* @__PURE__ */ new Map());
    __publicField(this, "lastTime", 0);
    __publicField(this, "statusInterval");
    __publicField(this, "pinsChanged", true);
    __publicField(this, "speed", 1);
    __publicField(this, "boardId");
    __publicField(this, "serialBaudRate", 115200);
    __publicField(this, "softSerialBaudRate", 9600);
    __publicField(this, "serialByteBudget", 0);
    __publicField(this, "onStateUpdate");
    __publicField(this, "onByteTransmitCb");
    __publicField(this, "softSerialTxPin", "GP10");
    __publicField(this, "softSerialRxPin", "GP11");
    __publicField(this, "softSerialRxQueue", []);
    __publicField(this, "softSerialRxFrame", null);
    __publicField(this, "softSerialRxLevelHigh", true);
    __publicField(this, "softSerialRxOverrideActive", false);
    __publicField(this, "softSerialNextInjectCycle", 0);
    __publicField(this, "softSerialDecodeState", {
      receiving: false,
      sampleCycle: 0,
      sampleIndex: 0,
      currentByte: 0,
      lastLevel: true
    });
    __publicField(this, "firmwareHex");
    __publicField(this, "serialBuffer", []);
    __publicField(this, "activeUartIndex", 0);
    __publicField(this, "gdbStatus", "disabled");
    __publicField(this, "gdbLastError", "");
    __publicField(this, "usbCdc", null);
    __publicField(this, "usbCdcReady", false);
    __publicField(this, "gpioUnsubscribers", []);
    __publicField(this, "protocolEndpointsCache", /* @__PURE__ */ new Map());
    __publicField(this, "i2cDeviceCache", /* @__PURE__ */ new Map());
    __publicField(this, "i2cBusPinPairs", /* @__PURE__ */ new Map());
    __publicField(this, "i2cBitBangState", /* @__PURE__ */ new Map());
    __publicField(this, "i2cHardwareSeen", /* @__PURE__ */ new Map([["i2c0", false], ["i2c1", false]]));
    __publicField(this, "spiDeviceCache", /* @__PURE__ */ new Map());
    __publicField(this, "peripheralDeviceCacheReady", false);
    __publicField(this, "pwmState", /* @__PURE__ */ new Map());
    __publicField(this, "oneWireState", /* @__PURE__ */ new Map());
    __publicField(this, "componentSyncMeta", /* @__PURE__ */ new Map());
    __publicField(this, "hasFaulted", false);
    __publicField(this, "bootromLoaded", false);
    __publicField(this, "cpuCyclesAtStart", 0);
    __publicField(this, "debugEnabled");
    __publicField(this, "debugIntervalMs");
    __publicField(this, "debugLastEmitAt", 0);
    __publicField(this, "debugLastStepCount", 0);
    __publicField(this, "debugStepCount", 0);
    __publicField(this, "totalCyclesIntended", 0);
    __publicField(this, "pio0Accum", 0);
    __publicField(this, "pio1Accum", 0);
    __publicField(this, "pioSignalCycle", 0);
    __publicField(this, "debugSerialTxBytes", 0);
    __publicField(this, "debugSerialRxBytes", 0);
    __publicField(this, "debugGpioTransitions", 0);
    __publicField(this, "debugLastGpioPin", "");
    __publicField(this, "debugLastPc", 0);
    __publicField(this, "debugPcStallTicks", 0);
    __publicField(this, "lastSerialByte", -1);
    __publicField(this, "lastSerialSource", -1);
    __publicField(this, "lastSerialEmitAt", 0);
    __publicField(this, "lastUsbSerialAt", 0);
    __publicField(this, "lowPcAliasCandidate", -1);
    __publicField(this, "lowPcAliasRepeatCount", 0);
    __publicField(this, "invalidPcStrikeCount", 0);
    __publicField(this, "extraExecutableRanges");
    __publicField(this, "configuredLogicalFlashBytes");
    __publicField(this, "flashPartitions");
    __publicField(this, "uartLedOffTimers", /* @__PURE__ */ new Map());
    __publicField(this, "entryInfo", null);
    __publicField(this, "picoWirelessStub", null);
    __publicField(this, "runLoop", () => {
      if (!this.running || !this.cpu) return;
      const { core } = this.cpu;
      const clock = this.cpu.clock;
      const F_CPU = 125e6;
      const CYCLE_NANOS = 1e9 / F_CPU;
      const CYCLES_PER_FRAME = Math.floor(F_CPU / 60 * this.speed);
      let cyclesDone = 0;
      const now = performance.now();
      try {
        const executeOneInstruction = () => {
          const before = this.cpu.core.cycles >>> 0;
          core.executeInstruction();
          const after = this.cpu.core.cycles >>> 0;
          const delta = after - before >>> 0;
          return delta > 0 ? delta : 1;
        };
        while (cyclesDone < CYCLES_PER_FRAME && this.running && this.cpu) {
          const pioDivs = this.getPIOClockDivs();
          const pio0Div = pioDivs[0];
          const pio1Div = pioDivs[1];
          if (core.waiting && clock) {
            const rawJumpNanos = Number(clock.nanosToNextAlarm);
            const jumpNanos = Number.isFinite(rawJumpNanos) ? rawJumpNanos : -1;
            if (jumpNanos <= 0) {
              const cycles = executeOneInstruction();
              clock.tick(cycles * CYCLE_NANOS);
              cyclesDone += cycles;
              this.debugStepCount += 1;
              this.pio0Accum += cycles;
              while (this.pio0Accum >= pio0Div) {
                this.pio0Accum -= pio0Div;
                this.stepPIO(0, pio0Div);
              }
              this.pio1Accum += cycles;
              while (this.pio1Accum >= pio1Div) {
                this.pio1Accum -= pio1Div;
                this.stepPIO(1, pio1Div);
              }
              continue;
            }
            const jumpedCycles = Math.ceil(jumpNanos / CYCLE_NANOS);
            const maxJumpCycles = Math.min(jumpedCycles, CYCLES_PER_FRAME - cyclesDone);
            clock.tick(maxJumpCycles * CYCLE_NANOS);
            this.pio0Accum += maxJumpCycles;
            while (this.pio0Accum >= pio0Div) {
              this.pio0Accum -= pio0Div;
              this.stepPIO(0, pio0Div);
            }
            this.pio1Accum += maxJumpCycles;
            while (this.pio1Accum >= pio1Div) {
              this.pio1Accum -= pio1Div;
              this.stepPIO(1, pio1Div);
            }
            cyclesDone += maxJumpCycles;
          } else {
            const cycles = executeOneInstruction();
            if (clock) clock.tick(cycles * CYCLE_NANOS);
            cyclesDone += cycles;
            this.debugStepCount += 1;
            this.pio0Accum += cycles;
            while (this.pio0Accum >= pio0Div) {
              this.pio0Accum -= pio0Div;
              this.stepPIO(0, pio0Div);
            }
            this.pio1Accum += cycles;
            while (this.pio1Accum >= pio1Div) {
              this.pio1Accum -= pio1Div;
              this.stepPIO(1, pio1Div);
            }
          }
        }
        this.updateGPIOInputsFromCircuit();
        this.rebaseProgramCounterAlias(cyclesDone);
        const sampledPc = this.cpu.core.PC >>> 0;
        if (this.shouldFaultForInvalidPc(sampledPc)) {
          this.faultAndStop("Execution jumped outside valid memory", sampledPc);
          return;
        }
        if (this.softSerialDecodeState.receiving || this.softSerialRxFrame || this.softSerialRxQueue.length > 0) {
          const currentTotalCycles = Number(this.cpu.core.cycles);
          this.advanceSoftSerialIngress(currentTotalCycles);
          this.processSoftSerialDecode(currentTotalCycles);
        }
        const frameTimeMs = 16.6;
        const bytesPerMs = this.serialBaudRate / 1e4;
        this.serialByteBudget += frameTimeMs * bytesPerMs;
        const uart0 = this.cpu.uart[0];
        const uart1 = this.cpu.uart[1];
        if (this.serialBuffer.length > 0 && this.serialByteBudget >= 1) {
          const maxBytes = Math.floor(this.serialByteBudget);
          let sent = 0;
          for (let i = 0; i < maxBytes && this.serialBuffer.length > 0; i++) {
            const packet = this.serialBuffer[0];
            let delivered = false;
            if (packet.source === 2) {
              if (this.usbCdc && this.usbCdcReady) {
                try {
                  const usbTxFifo = this.usbCdc.txFIFO;
                  const fifoFull = !!(usbTxFifo && (usbTxFifo.full || usbTxFifo.itemCount >= usbTxFifo.size));
                  if (fifoFull) {
                    delivered = false;
                  } else {
                    this.usbCdc.sendSerialByte(packet.value & 255);
                    delivered = true;
                  }
                } catch {
                  delivered = false;
                }
              }
            } else {
              delivered = ((packet.source === 1 ? uart1 : uart0) || uart0).feedByte(packet.value & 255);
            }
            if (!delivered) break;
            this.serialBuffer.shift();
            sent += 1;
          }
          this.serialByteBudget -= sent;
        }
        const clockScale = 16e6 / this.getRp2040ClockHz();
        const normalizedUpdateCycles = Math.floor(Number(this.cpu.core.cycles) * clockScale);
        const instArray = Array.from(this.instances.values());
        instArray.forEach((inst) => {
          if (inst.state.isWired === void 0) {
            inst.state.isWired = Object.keys(inst.pins).some(
              (p) => this.currentWires.some((w) => w.from === `${inst.id}:${p}` || w.to === `${inst.id}:${p}`)
            );
          }
          inst.update(normalizedUpdateCycles, this.currentWires, instArray);
        });
      } catch (err) {
        const baseMessage = String(err?.message || err || "RP2040 execution error");
        const shortStack = typeof err?.stack === "string" ? err.stack.split("\n").slice(0, 4).map((line) => line.trim()).join(" | ") : "";
        const message = shortStack ? `${baseMessage} :: ${shortStack}` : baseMessage;
        this.faultAndStop(message, this.cpu.core.PC >>> 0);
        return;
      }
      if (this.running) {
        this.emitDebugSnapshot("tick", now);
        this.lastTime = now;
        setTimeout(this.runLoop, 0);
      }
    });
    this.currentWires = wiresDef || [];
    this.onStateUpdate = onStateUpdate;
    this.onByteTransmitCb = options.onByteTransmit;
    this.firmwareHex = String(hexData || "");
    this.speed = options.speed ?? 1;
    const fallbackBoard = (componentsDef || []).find((c) => /(rp2040|pico)/i.test(String(c.type || "")));
    this.boardId = options.boardId || fallbackBoard?.id || "wokwi-raspberry-pi-pico_0";
    const boardCompDef = (componentsDef || []).find((c) => String(c.id || "") === this.boardId) || fallbackBoard;
    this.setSerialBaudRate(options.serialBaudRate ?? 115200);
    this.debugEnabled = options.debugEnabled !== false;
    this.debugIntervalMs = Math.max(150, Number(options.debugIntervalMs || 800));
    this.extraExecutableRanges = normalizeRp2040ExecutableRanges(options.rp2040ExecutableRanges);
    const parsedLogicalFlashBytes = parseAddressValue(options.rp2040LogicalFlashBytes);
    this.configuredLogicalFlashBytes = (parsedLogicalFlashBytes !== null && parsedLogicalFlashBytes > 0 ? parsedLogicalFlashBytes : RP2040_DEFAULT_LOGICAL_FLASH_BYTES) >>> 0;
    this.flashPartitions = normalizeRp2040FlashPartitions(options.rp2040FlashPartitions);
    this.cpu = new RP2040(new RP2040MockClock());
    const wrapFlashAliasAddressMethod = (methodName) => {
      const original = this.cpu?.[methodName];
      if (typeof original !== "function") return;
      this.cpu[methodName] = (rawAddress, ...args) => {
        const sourceAddress = Number(rawAddress) >>> 0;
        const mappedAddress = normalizeRp2040FlashAliasAddress(sourceAddress);
        try {
          return original.call(this.cpu, mappedAddress, ...args);
        } catch (err) {
          const srcHex = `0x${sourceAddress.toString(16)}`;
          const mappedHex = `0x${mappedAddress.toString(16)}`;
          const reason = String(err?.message || err || `${methodName} error`);
          throw new Error(`${methodName}(${srcHex} -> ${mappedHex}) failed: ${reason}`);
        }
      };
    };
    wrapFlashAliasAddressMethod("readUint32");
    wrapFlashAliasAddressMethod("readUint16");
    wrapFlashAliasAddressMethod("readUint8");
    wrapFlashAliasAddressMethod("writeUint32");
    wrapFlashAliasAddressMethod("writeUint16");
    wrapFlashAliasAddressMethod("writeUint8");
    this.patchClockSelectedReads();
    this.patchSioFifoAccess();
    this.cpu.loadBootrom(bootromB1);
    this.cpu.logger = new ConsoleLogger(LogLevel.Error, true);
    for (const pio of this.cpu.pio) {
      pio.run = function() {
        if (this.runTimer) {
          clearTimeout(this.runTimer);
          this.runTimer = null;
        }
      };
    }
    this.pioStepAccum = 0;
    try {
      const gdbWs = new WebSocket("ws://localhost:3333");
      this.gdbStatus = "connecting";
      this.emitGdbStatus("connecting", "Attempting ws://localhost:3333");
      const gdbServer = new GDBServer(this.cpu);
      const gdbConn = new GDBConnection(gdbServer, (res) => {
        if (gdbWs.readyState === WebSocket.OPEN) gdbWs.send(res);
      });
      gdbWs.onopen = () => {
        this.gdbStatus = "connected";
        this.gdbLastError = "";
        this.emitGdbStatus("connected", "GDB bridge connected");
      };
      gdbWs.onmessage = (e) => {
        if (typeof e.data === "string") gdbConn.feedData(e.data);
      };
      gdbWs.onerror = () => {
        this.gdbStatus = "error";
        this.gdbLastError = "WebSocket error";
        this.emitGdbStatus("error", this.gdbLastError);
      };
      gdbWs.onclose = (evt) => {
        this.gdbStatus = "closed";
        const reason = String(evt?.reason || "").trim();
        const detail = `code=${Number(evt?.code || 0)}${reason ? ` reason=${reason}` : ""}`;
        this.emitGdbStatus("closed", detail);
      };
      this.gdbWs = gdbWs;
    } catch (err) {
      console.warn("Silent failure opening GDB Bridge ws://localhost:3333", err);
      this.gdbStatus = "error";
      this.gdbLastError = String(err?.message || err || "Unknown GDB bridge error");
      this.emitGdbStatus("error", this.gdbLastError);
    }
    this.bootromLoaded = true;
    this.entryInfo = loadRP2040Firmware(this.cpu, this.firmwareHex, {
      logicalFlashBytes: this.getLogicalFlashLength(),
      partitions: this.flashPartitions
    });
    this.cpuCyclesAtStart = this.cpu.core.cycles;
    this.pioSignalCycle = this.cpu.core.cycles;
    (componentsDef || []).forEach((cDef) => {
      const LogicClass = LOGIC_REGISTRY[cDef.type];
      if (LogicClass) {
        const pins = COMPONENT_PINS[cDef.type] || [{ id: "A" }, { id: "K" }, { id: "GND" }, { id: "VSS" }];
        const manifest = { type: cDef.type, attrs: cDef.attrs || {}, pins };
        const inst = new LogicClass(cDef.id, manifest);
        if (cDef.attrs) inst.state = { ...inst.state, ...cDef.attrs };
        this.instances.set(cDef.id, inst);
      }
    });
    this.initWirelessStub(boardCompDef);
    this.attachGPIOListeners();
    this.attachUART();
    this.attachUSBSerial();
    this.rebuildPeripheralDeviceCache();
    this.installRp2040I2cAdapters();
    this.installRp2040SpiAdapters();
    for (let gp = 0; gp <= 28; gp++) {
      const pin = `GP${gp}`;
      this.pinStates[pin] = false;
      this.propagateBoardPin(pin, false);
    }
    this.setSoftSerialRxLevel(true);
    this.running = true;
    this.lastTime = performance.now();
    this.emitDebugSnapshot("start", this.lastTime, true);
    this.emitWirelessStubStatus("start", true);
    this.runLoop();
    this.statusInterval = setInterval(() => {
      if (this.running && this.cpu) {
        const msg = { type: "state", boardId: this.boardId };
        let shouldEmit = false;
        const now = performance.now();
        this.emitWirelessStubStatus("tick");
        if (this.pinsChanged) {
          msg.pins = this.pinStates;
          this.pinsChanged = false;
          shouldEmit = true;
        }
        const compStates = [];
        for (const inst of this.instances.values()) {
          if (!inst.stateChanged) continue;
          const syncState = inst.getSyncState();
          if (!this.shouldEmitComponentState(inst.id, syncState, now)) continue;
          inst.stateChanged = false;
          compStates.push({
            id: inst.id,
            state: syncState,
            ...collectComponentTelemetry(inst)
          });
        }
        if (compStates.length > 0) {
          msg.components = compStates;
          shouldEmit = true;
        }
        if (shouldEmit) {
          this.onStateUpdate(msg);
        }
      }
    }, 1e3 / 30);
  }
  shouldEmitComponentState(componentId, state, nowMs) {
    const policy = getComponentStateSyncPolicy(state);
    const prev = this.componentSyncMeta.get(componentId);
    if (policy.minIntervalMs > 0 && prev && nowMs - prev.lastSentAt < policy.minIntervalMs) {
      return false;
    }
    this.componentSyncMeta.set(componentId, { lastSentAt: nowMs, lastWeight: policy.weight });
    return true;
  }
  initWirelessStub(boardCompDef) {
    const boardType = String(boardCompDef?.type || "").toLowerCase();
    if (!(boardType.includes("pico-w") || boardType.includes("picow"))) return;
    const modeRaw = String(boardCompDef?.attrs?.wirelessMode || "compat-stub").toLowerCase();
    const mode = modeRaw === "off" ? "off" : "compat-stub";
    const ssid = String(boardCompDef?.attrs?.wirelessSsid || "Velxio-GUEST").trim() || "Velxio-GUEST";
    const ip = String(boardCompDef?.attrs?.wirelessIp || "192.168.4.2").trim() || "192.168.4.2";
    const now = performance.now();
    this.picoWirelessStub = {
      mode,
      ssid,
      ip,
      status: mode === "off" ? "off" : "booting",
      startedAtMs: now,
      lastEmitMs: 0
    };
    this.applyWirelessStubStateToBoard();
  }
  applyWirelessStubStateToBoard() {
    if (!this.picoWirelessStub) return;
    const boardInst = this.instances.get(this.boardId);
    if (!boardInst) return;
    const { mode, ssid, ip, status } = this.picoWirelessStub;
    boardInst.setState({
      wirelessMode: mode,
      wirelessStatus: status,
      wirelessConnected: mode !== "off" && status === "connected",
      wirelessSsid: mode === "off" ? "" : ssid,
      wirelessIp: mode === "off" ? "" : ip,
      wirelessNote: mode === "off" ? "Wireless compatibility stub disabled." : "Compatibility stub only. Pico W radio/network emulation is not implemented."
    });
  }
  emitWirelessStubStatus(reason = "tick", force = false) {
    if (!this.picoWirelessStub) return;
    const now = performance.now();
    if (!force && now - this.picoWirelessStub.lastEmitMs < _RP2040Runner.WIRELESS_STUB_EMIT_INTERVAL_MS) {
      return;
    }
    if (this.picoWirelessStub.mode === "off") {
      this.picoWirelessStub.status = "off";
    } else {
      const elapsed = now - this.picoWirelessStub.startedAtMs;
      this.picoWirelessStub.status = elapsed >= 1200 ? "connected" : "booting";
    }
    this.applyWirelessStubStateToBoard();
    const connected = this.picoWirelessStub.mode !== "off" && this.picoWirelessStub.status === "connected";
    this.onStateUpdate({
      type: "debug",
      boardId: this.boardId,
      category: "rp2040-wireless-stub",
      reason,
      wireless: {
        mode: this.picoWirelessStub.mode,
        status: this.picoWirelessStub.status,
        connected,
        ssid: this.picoWirelessStub.mode === "off" ? "" : this.picoWirelessStub.ssid,
        ip: this.picoWirelessStub.mode === "off" ? "" : this.picoWirelessStub.ip,
        note: this.picoWirelessStub.mode === "off" ? "Wireless compatibility stub disabled." : "Compatibility stub only. Pico W radio/network emulation is not implemented."
      }
    });
    this.picoWirelessStub.lastEmitMs = now;
  }
  emitGdbStatus(reason, detail = "") {
    this.onStateUpdate({
      type: "debug",
      boardId: this.boardId,
      category: "rp2040-gdb",
      reason,
      gdb: {
        status: this.gdbStatus,
        detail: String(detail || ""),
        lastError: this.gdbLastError
      }
    });
  }
  patchClockSelectedReads() {
    if (!this.cpu) return;
    try {
      const clocksPeripheral = this.cpu.findPeripheral(RP2040_CLOCKS_BASE);
      if (!clocksPeripheral || typeof clocksPeripheral.readUint32 !== "function") return;
      const originalReadUint32 = clocksPeripheral.readUint32.bind(clocksPeripheral);
      const originalWriteUint32 = typeof clocksPeripheral.writeUint32 === "function" ? clocksPeripheral.writeUint32.bind(clocksPeripheral) : null;
      const ctrlShadow = {
        [RP2040_CLOCKS_CLK_REF_CTRL_OFFSET]: 0,
        [RP2040_CLOCKS_CLK_SYS_CTRL_OFFSET]: 0
      };
      clocksPeripheral.readUint32 = (offset) => {
        if (offset === RP2040_CLOCKS_CLK_REF_CTRL_OFFSET || offset === RP2040_CLOCKS_CLK_SYS_CTRL_OFFSET) {
          return ctrlShadow[offset] >>> 0;
        }
        if (offset === RP2040_CLOCKS_CLK_REF_SELECTED_OFFSET || offset === RP2040_CLOCKS_CLK_SYS_SELECTED_OFFSET) {
          const ctrlOffset = offset === RP2040_CLOCKS_CLK_REF_SELECTED_OFFSET ? RP2040_CLOCKS_CLK_REF_CTRL_OFFSET : RP2040_CLOCKS_CLK_SYS_CTRL_OFFSET;
          const srcMask = offset === RP2040_CLOCKS_CLK_REF_SELECTED_OFFSET ? 3 : 1;
          const src = ctrlShadow[ctrlOffset] >>> 0 & srcMask;
          return 1 << src >>> 0;
        }
        return originalReadUint32(offset);
      };
      clocksPeripheral.writeUint32 = (offset, value) => {
        if (offset === RP2040_CLOCKS_CLK_REF_CTRL_OFFSET || offset === RP2040_CLOCKS_CLK_SYS_CTRL_OFFSET) {
          ctrlShadow[offset] = value >>> 0;
        }
        if (originalWriteUint32) {
          originalWriteUint32(offset, value);
        }
      };
    } catch {
    }
  }
  patchSioFifoAccess() {
    if (!this.cpu) return;
    try {
      const sio = this.cpu.sio;
      if (!sio || typeof sio.readUint32 !== "function") return;
      const originalReadUint32 = sio.readUint32.bind(sio);
      const originalWriteUint32 = typeof sio.writeUint32 === "function" ? sio.writeUint32.bind(sio) : null;
      const fifoStatus = 2;
      sio.readUint32 = (offset) => {
        if (offset === RP2040_SIO_FIFO_ST_OFFSET) {
          return fifoStatus;
        }
        if (offset === RP2040_SIO_FIFO_RD_OFFSET) {
          return 0;
        }
        return originalReadUint32(offset);
      };
      sio.writeUint32 = (offset, value) => {
        if (offset === RP2040_SIO_FIFO_ST_OFFSET || offset === RP2040_SIO_FIFO_WR_OFFSET) {
          return;
        }
        if (originalWriteUint32) {
          originalWriteUint32(offset, value);
        }
      };
    } catch {
    }
  }
  getLogicalFlashLength() {
    if (!this.cpu) return 0;
    return getRp2040LogicalFlashLength(this.cpu, this.configuredLogicalFlashBytes);
  }
  isExecutableAddress(addr) {
    const pc = addr >>> 0;
    const logicalFlashLength = this.getLogicalFlashLength();
    const flashEnd = RP2040_FLASH_BASE + logicalFlashLength >>> 0;
    const sramEnd = RP2040_SRAM_BASE + this.cpu.sram.length >>> 0;
    if (this.bootromLoaded && pc >= RP2040_BOOTROM_BASE && pc < RP2040_BOOTROM_BASE + RP2040_BOOTROM_SIZE) return true;
    if (pc >= RP2040_FLASH_BASE && pc < RP2040_FLASH_ALIAS_END) {
      const normalized = normalizeRp2040FlashAliasAddress(pc);
      if (normalized >= RP2040_FLASH_BASE && normalized < flashEnd) {
        return true;
      }
    }
    if (pc >= RP2040_SRAM_BASE && pc < sramEnd) return true;
    if (pc >= RP2040_USB_RAM_BASE && pc < RP2040_USB_RAM_BASE + RP2040_USB_RAM_SIZE) return true;
    for (const range of this.extraExecutableRanges) {
      if (pc >= range.start && pc <= range.end) return true;
    }
    return false;
  }
  faultAndStop(reason, pc) {
    if (this.hasFaulted) return;
    this.hasFaulted = true;
    this.running = false;
    this.clearPendingUartLedTimers();
    clearInterval(this.statusInterval);
    this.emitDebugSnapshot("fault", performance.now(), true, reason, pc >>> 0);
    this.onStateUpdate({
      type: "fault",
      boardId: this.boardId,
      reason,
      pc: pc >>> 0
    });
  }
  emitDebugSnapshot(reason = "tick", now = performance.now(), force = false, faultReason = "", faultPc) {
    if (!this.debugEnabled || !this.cpu) return;
    if (!force && now - this.debugLastEmitAt < this.debugIntervalMs) return;
    const pc = this.cpu.core.PC >>> 0;
    if (pc === this.debugLastPc) this.debugPcStallTicks++;
    else this.debugPcStallTicks = 0;
    this.debugLastPc = pc;
    const firstLed = Array.from(this.instances.values()).find((inst) => inst.type === "wokwi-led");
    const ledAnodeV = firstLed ? Number(firstLed.getPinVoltage("A") || 0) : null;
    const ledCathodeV = firstLed ? Number(firstLed.getPinVoltage("K") || 0) : null;
    const ledDeltaV = ledAnodeV !== null && ledCathodeV !== null ? Number((ledAnodeV - ledCathodeV).toFixed(3)) : null;
    const ledOn = firstLed ? !!firstLed.state?.illuminated : null;
    const highPins = Object.keys(this.pinStates).filter((pin) => !!this.pinStates[pin]).sort((a, b) => Number(a.replace("GP", "")) - Number(b.replace("GP", "")));
    const pinBitmap = Array.from({ length: 29 }, (_, idx) => this.pinStates[`GP${idx}`] ? "1" : "0").join("");
    const payload = {
      type: "debug",
      boardId: this.boardId,
      category: "rp2040-runtime",
      reason,
      metrics: {
        running: this.running,
        faulted: this.hasFaulted,
        pc,
        sp: this.cpu.core.SP >>> 0,
        cycles: this.cpu.core.cycles >>> 0,
        activeUart: this.activeUartIndex,
        serialTxBytes: this.debugSerialTxBytes,
        serialRxBytes: this.debugSerialRxBytes,
        usbCdcReady: this.usbCdcReady,
        serialInputQueue: this.serialBuffer.length,
        stepCount: this.debugStepCount,
        gpioTransitions: this.debugGpioTransitions,
        lastGpioPin: this.debugLastGpioPin,
        gp20: !!this.pinStates.GP20,
        gp25: !!this.pinStates.GP25,
        highPins,
        pinBitmap,
        ledId: firstLed?.id || "",
        ledOn,
        ledAnodeV,
        ledCathodeV,
        ledDeltaV,
        stepsSinceLastEmit: this.debugStepCount - this.debugLastStepCount,
        pcStallTicks: this.debugPcStallTicks,
        interruptsEnabled: this.cpu.core.enabledInterrupts >>> 0,
        interruptsPending: this.cpu.core.pendingInterrupts >>> 0,
        primask: !!this.cpu.core.PM,
        entry: this.entryInfo
      },
      fault: faultReason ? {
        reason: faultReason,
        pc: Number.isFinite(Number(faultPc)) ? Number(faultPc) >>> 0 : pc
      } : void 0
    };
    this.debugLastEmitAt = now;
    this.debugLastStepCount = this.debugStepCount;
    this.onStateUpdate(payload);
  }
  rebaseProgramCounterAlias(stepWeight = 1) {
    if (!this.cpu) return;
    const pc = this.cpu.core.PC >>> 0;
    const logicalFlashLength = this.getLogicalFlashLength();
    if (!(pc > 0 && pc < logicalFlashLength)) {
      this.lowPcAliasCandidate = -1;
      this.lowPcAliasRepeatCount = 0;
      return;
    }
    const flashIndex = pc & ~1;
    const hasFlashData = flashIndex + 1 < logicalFlashLength && (this.cpu.flash[flashIndex] !== 255 || this.cpu.flash[flashIndex + 1] !== 255);
    if (!hasFlashData) {
      this.lowPcAliasCandidate = -1;
      this.lowPcAliasRepeatCount = 0;
      return;
    }
    const rebased = (RP2040_FLASH_BASE + pc | 1) >>> 0;
    const inBootromRange = this.bootromLoaded && pc < RP2040_BOOTROM_SIZE;
    if (!inBootromRange) {
      this.lowPcAliasCandidate = -1;
      this.lowPcAliasRepeatCount = 0;
      this.cpu.core.BXWritePC(rebased);
      this.invalidPcStrikeCount = 0;
      return;
    }
    const repeatIncrement = Math.max(1, stepWeight | 0);
    if (this.lowPcAliasCandidate === pc) {
      this.lowPcAliasRepeatCount += repeatIncrement;
    } else {
      this.lowPcAliasCandidate = pc;
      this.lowPcAliasRepeatCount = 0;
    }
    if (this.lowPcAliasRepeatCount >= _RP2040Runner.LOW_PC_ALIAS_REPEAT_LIMIT && pc !== 0) {
      this.cpu.core.BXWritePC(rebased);
      this.lowPcAliasRepeatCount = 0;
      this.invalidPcStrikeCount = 0;
    }
  }
  shouldFaultForInvalidPc(pc) {
    if (!this.cpu) return false;
    const stepPc = pc >>> 0;
    const cyclesSinceStart = this.cpu.core.cycles - this.cpuCyclesAtStart >>> 0;
    const pastGracePeriod = cyclesSinceStart > _RP2040Runner.FAULT_GRACE_CYCLES;
    const hardInvalidPc = stepPc >= _RP2040Runner.HARD_INVALID_PC_BASE;
    const recoveringLowAlias = !hardInvalidPc && this.lowPcAliasCandidate === stepPc && this.lowPcAliasRepeatCount > 0;
    if (recoveringLowAlias) {
      this.invalidPcStrikeCount = 0;
      return false;
    }
    const invalidPc = (pastGracePeriod || hardInvalidPc) && !this.isExecutableAddress(stepPc);
    if (invalidPc) {
      this.invalidPcStrikeCount += 1;
    } else {
      this.invalidPcStrikeCount = 0;
    }
    return this.invalidPcStrikeCount >= _RP2040Runner.INVALID_PC_STRIKE_LIMIT;
  }
  getSoftSerialBitCycles() {
    const baud = Math.max(300, this.softSerialBaudRate | 0);
    const clockHz = this.getRp2040ClockHz();
    return Math.max(1, Math.floor(clockHz / baud));
  }
  setSoftSerialRxLevel(isHigh) {
    this.softSerialRxLevelHigh = isHigh;
    this.cpu?.gpio?.[11]?.setInputValue(isHigh);
  }
  emitSoftSerialByte(value) {
    const byte = value & 255;
    const char = String.fromCharCode(byte);
    this.debugSerialTxBytes += 1;
    this.pulseBoardUartLed("GP0");
    if (this.onByteTransmitCb) {
      this.onByteTransmitCb({ boardId: this.boardId, value: byte, char, source: "softserial" });
    } else {
      this.onStateUpdate({ type: "serial", data: char, value: byte, boardId: this.boardId, source: "softserial" });
    }
  }
  processSoftSerialDecode(cycles) {
    const state = this.softSerialDecodeState;
    if (!state.receiving) return;
    const bitCycles = this.getSoftSerialBitCycles();
    while (state.receiving && state.sampleCycle <= cycles) {
      if (state.sampleIndex < 8) {
        if (state.lastLevel) {
          state.currentByte |= 1 << state.sampleIndex;
        }
        state.sampleIndex += 1;
        state.sampleCycle += bitCycles;
        continue;
      }
      if (state.lastLevel) {
        this.emitSoftSerialByte(state.currentByte);
      }
      state.receiving = false;
      state.sampleIndex = 0;
      state.currentByte = 0;
    }
  }
  observeSoftSerialTx(pinId, isHigh, cycles) {
    if (this.normalizeToGpPin(pinId) !== this.softSerialTxPin) return;
    const state = this.softSerialDecodeState;
    this.processSoftSerialDecode(cycles);
    const prev = state.lastLevel;
    state.lastLevel = isHigh;
    if (!state.receiving && prev && !isHigh) {
      const bitCycles = this.getSoftSerialBitCycles();
      state.receiving = true;
      state.currentByte = 0;
      state.sampleIndex = 0;
      state.sampleCycle = cycles + bitCycles * 1.5;
    }
  }
  advanceSoftSerialIngress(cycles) {
    if (!this.cpu) return;
    if (!this.softSerialRxFrame && this.softSerialRxQueue.length > 0) {
      const byte = this.softSerialRxQueue.shift() & 255;
      const bitCycles = this.getSoftSerialBitCycles();
      const startCycle = Math.max(cycles + 1, this.softSerialNextInjectCycle || cycles + 1);
      const levels = [0];
      for (let i = 0; i < 8; i++) {
        levels.push(byte >> i & 1);
      }
      levels.push(1);
      this.softSerialRxFrame = {
        levels,
        bitIndex: 0,
        nextBitCycle: startCycle,
        bitCycles
      };
      this.softSerialNextInjectCycle = startCycle + levels.length * bitCycles;
      this.softSerialRxOverrideActive = true;
    }
    while (this.softSerialRxFrame && cycles >= this.softSerialRxFrame.nextBitCycle) {
      const frame = this.softSerialRxFrame;
      const level = frame.levels[frame.bitIndex] === 1;
      this.setSoftSerialRxLevel(level);
      frame.bitIndex += 1;
      frame.nextBitCycle += frame.bitCycles;
      if (frame.bitIndex >= frame.levels.length) {
        this.softSerialRxFrame = null;
        break;
      }
    }
    if (!this.softSerialRxFrame && this.softSerialRxQueue.length === 0 && this.softSerialRxOverrideActive) {
      this.setSoftSerialRxLevel(true);
      this.softSerialRxOverrideActive = false;
    }
  }
  attachUART() {
    if (!this.cpu?.uart) return;
    const bindUart = (uartIndex) => {
      const uart = this.cpu?.uart?.[uartIndex];
      if (!uart) return;
      uart.onByte = (value) => {
        this.emitSerialByte(value, uartIndex);
      };
    };
    bindUart(0);
    bindUart(1);
  }
  attachUSBSerial() {
    if (!this.cpu?.usbCtrl) return;
    const cdc = new USBCDC(this.cpu.usbCtrl);
    this.usbCdc = cdc;
    this.usbCdcReady = false;
    cdc.onDeviceConnected = () => {
      this.usbCdcReady = true;
    };
    cdc.onSerialData = (buffer) => {
      for (let i = 0; i < buffer.length; i++) {
        this.emitSerialByte(buffer[i] & 255, 2);
      }
    };
  }
  buildBoardAliasSet(boardPins) {
    const aliases = /* @__PURE__ */ new Set();
    for (const pin of boardPins) {
      const raw = String(pin || "").toUpperCase();
      aliases.add(raw);
      aliases.add(this.normalizeToGpPin(raw));
    }
    return aliases;
  }
  findExistingPinName(inst, candidates) {
    for (const name of candidates) {
      if (inst.pins[name]) return name;
      const upper = name.toUpperCase();
      if (inst.pins[upper]) return upper;
      const lower = name.toLowerCase();
      if (inst.pins[lower]) return lower;
    }
    return null;
  }
  isComponentPinConnectedToBoardPins(componentId, componentPin, boardPins) {
    const aliases = this.buildBoardAliasSet(boardPins);
    const endpoint = `${componentId}:${componentPin}`;
    for (const wire of this.currentWires) {
      let boardEndpoint = null;
      if (wire.from === endpoint) boardEndpoint = wire.to;
      else if (wire.to === endpoint) boardEndpoint = wire.from;
      if (!boardEndpoint) continue;
      const [boardId, boardPin] = String(boardEndpoint).split(":");
      if (boardId !== this.boardId) continue;
      const raw = String(boardPin || "").toUpperCase();
      const normalized = this.normalizeToGpPin(raw);
      if (aliases.has(raw) || aliases.has(normalized)) {
        return true;
      }
    }
    return false;
  }
  rebuildPeripheralDeviceCache() {
    this.i2cDeviceCache.set("i2c0", this.scanRp2040ConnectedI2CDevices("i2c0"));
    this.i2cDeviceCache.set("i2c1", this.scanRp2040ConnectedI2CDevices("i2c1"));
    this.i2cBusPinPairs.clear();
    const i2c0Pins = this.scanRp2040I2CBusPins("i2c0");
    const i2c1Pins = this.scanRp2040I2CBusPins("i2c1");
    if (i2c0Pins) this.i2cBusPinPairs.set("i2c0", i2c0Pins);
    if (i2c1Pins) this.i2cBusPinPairs.set("i2c1", i2c1Pins);
    this.i2cHardwareSeen.set("i2c0", false);
    this.i2cHardwareSeen.set("i2c1", false);
    this.i2cBitBangState.clear();
    this.spiDeviceCache.set("spi0", this.scanRp2040ConnectedSPIDevices("spi0"));
    this.spiDeviceCache.set("spi1", this.scanRp2040ConnectedSPIDevices("spi1"));
    this.peripheralDeviceCacheReady = true;
  }
  getRp2040ConnectedI2CDevices(bus) {
    if (!this.peripheralDeviceCacheReady) {
      this.rebuildPeripheralDeviceCache();
    }
    const wiredDevices = this.i2cDeviceCache.get(bus) || [];
    if (wiredDevices.length > 0) {
      return wiredDevices;
    }
    return this.getI2CCallbackDevices();
  }
  getI2CCallbackDevices() {
    const devices = [];
    for (const inst of this.instances.values()) {
      const hasI2cCallbacks = !!(inst.onI2CStart || inst.onI2CByte || inst.onI2CStop || typeof inst.onI2CReadByte === "function" || typeof inst.readByte === "function");
      if (hasI2cCallbacks) {
        devices.push(inst);
      }
    }
    return devices;
  }
  scanRp2040I2CBusPins(bus) {
    const pinMap = RP2040_I2C_SOURCE_PINS[bus];
    if (!pinMap) return null;
    const sdaAliases = this.buildBoardAliasSet(pinMap.sda);
    const sclAliases = this.buildBoardAliasSet(pinMap.scl);
    for (const inst of this.instances.values()) {
      const hasI2cCallbacks = !!(inst.onI2CStart || inst.onI2CByte || inst.onI2CStop || typeof inst.onI2CReadByte === "function" || typeof inst.readByte === "function");
      if (!hasI2cCallbacks) continue;
      const sdaPin = this.findExistingPinName(inst, ["SDA", "SDA1"]);
      const sclPin = this.findExistingPinName(inst, ["SCL", "SCL1"]);
      if (!sdaPin || !sclPin) continue;
      const boardSda = this.resolveBoardPinForComponentPin(inst.id, sdaPin);
      const boardScl = this.resolveBoardPinForComponentPin(inst.id, sclPin);
      if (!boardSda || !boardScl) continue;
      const sda = this.normalizeToGpPin(boardSda);
      const scl = this.normalizeToGpPin(boardScl);
      if (sda === scl) continue;
      if (!sdaAliases.has(sda) || !sclAliases.has(scl)) continue;
      return { sda, scl };
    }
    return null;
  }
  scanRp2040ConnectedI2CDevices(bus) {
    const pinMap = RP2040_I2C_SOURCE_PINS[bus];
    if (!pinMap) return [];
    const devices = [];
    for (const inst of this.instances.values()) {
      const hasI2cCallbacks = !!(inst.onI2CStart || inst.onI2CByte || inst.onI2CStop || typeof inst.onI2CReadByte === "function" || typeof inst.readByte === "function");
      if (!hasI2cCallbacks) continue;
      const sdaPin = this.findExistingPinName(inst, ["SDA", "SDA1"]);
      const sclPin = this.findExistingPinName(inst, ["SCL", "SCL1"]);
      if (!sdaPin || !sclPin) continue;
      const sdaConnected = this.isComponentPinConnectedToBoardPins(inst.id, sdaPin, pinMap.sda);
      const sclConnected = this.isComponentPinConnectedToBoardPins(inst.id, sclPin, pinMap.scl);
      if (sdaConnected && sclConnected) {
        devices.push(inst);
      }
    }
    return devices;
  }
  isRp2040SpiSelected(inst) {
    const csNames = ["CS", "CE", "SS", "SSEL", "NSS", "CSN", "CS_N", "NCE"];
    const csPin = this.findExistingPinName(inst, csNames);
    if (!csPin) return true;
    return inst.getPinVoltage(csPin) < 0.5;
  }
  parseGpIndex(pinId) {
    const norm = this.normalizeToGpPin(pinId);
    const match = /^GP(\d+)$/.exec(norm);
    if (!match) return null;
    const idx = Number(match[1]);
    if (!Number.isFinite(idx) || idx < 0 || idx > 28) return null;
    return idx;
  }
  sampleBoardPinHigh(pinId) {
    if (!this.cpu) return false;
    const idx = this.parseGpIndex(pinId);
    if (idx == null) return false;
    const state = this.cpu.gpio[idx].value;
    return state === GPIOPinState.High || state === GPIOPinState.InputPullUp;
  }
  resolveBoardPinForComponentPin(componentId, componentPin) {
    const endpoint = `${componentId}:${componentPin}`;
    for (const wire of this.currentWires) {
      let boardEndpoint = null;
      if (wire.from === endpoint) boardEndpoint = wire.to;
      else if (wire.to === endpoint) boardEndpoint = wire.from;
      if (!boardEndpoint) continue;
      const [boardId, boardPin] = String(boardEndpoint).split(":");
      if (boardId !== this.boardId) continue;
      return this.normalizeToGpPin(String(boardPin || ""));
    }
    return null;
  }
  syncSpiControlPins(inst) {
    if (!this.cpu) return;
    const controlAliases = [
      ["CS", "CE", "SS", "SSEL", "NSS", "CSN", "CS_N", "NCE"],
      ["DC", "D_C", "A0", "RS"],
      ["RESET", "RST", "RES", "NRST"]
    ];
    for (const aliases of controlAliases) {
      const pinName = this.findExistingPinName(inst, aliases);
      if (!pinName) continue;
      const gpPin = this.resolveBoardPinForComponentPin(inst.id, pinName);
      if (!gpPin) continue;
      const isHigh = this.sampleBoardPinHigh(gpPin);
      const nextVoltage = isHigh ? 3.3 : 0;
      if (!inst.pins[pinName]) {
        inst.pins[pinName] = { voltage: nextVoltage, mode: "INPUT" };
      }
      inst.setPinVoltage(pinName, nextVoltage);
      inst.onPinStateChange(pinName, isHigh, this.cpu.core.cycles);
    }
  }
  getRp2040ConnectedSPIDevices(bus) {
    if (!this.peripheralDeviceCacheReady) {
      this.rebuildPeripheralDeviceCache();
    }
    return this.spiDeviceCache.get(bus) || [];
  }
  scanRp2040ConnectedSPIDevices(bus) {
    const pinMap = RP2040_SPI_SOURCE_PINS[bus];
    if (!pinMap) return [];
    const devices = [];
    for (const inst of this.instances.values()) {
      if (typeof inst.onSPIByte !== "function") continue;
      const mosiPin = this.findExistingPinName(inst, ["MOSI", "DIN", "SI", "SDI"]);
      const sckPin = this.findExistingPinName(inst, ["SCK", "CLK", "SCLK"]);
      if (!mosiPin || !sckPin) continue;
      if (!this.isComponentPinConnectedToBoardPins(inst.id, mosiPin, pinMap.mosi)) continue;
      if (!this.isComponentPinConnectedToBoardPins(inst.id, sckPin, pinMap.sck)) continue;
      const csPin = this.findExistingPinName(inst, ["CS", "SS", "CSN", "NSS", "CE", "CS_N"]);
      if (csPin && !this.isComponentPinConnectedToBoardPins(inst.id, csPin, pinMap.cs)) {
        continue;
      }
      devices.push(inst);
    }
    return devices;
  }
  installRp2040I2cAdapters() {
    if (!this.cpu) return;
    const attachBus = (index, bus) => {
      const i2c = this.cpu?.i2c?.[index];
      if (!i2c) return;
      let activeSlave = null;
      i2c.onStart = (repeatedStart) => {
        void repeatedStart;
        activeSlave = null;
        i2c.completeStart();
      };
      i2c.onConnect = (address, mode) => {
        this.i2cHardwareSeen.set(bus, true);
        const isRead = Number(mode) === 1;
        const devices = this.getRp2040ConnectedI2CDevices(bus);
        let ack = false;
        activeSlave = null;
        for (const inst of devices) {
          if (!inst.onI2CStart) continue;
          if (inst.onI2CStart(address, isRead)) {
            ack = true;
            if (!activeSlave) activeSlave = inst;
          }
        }
        i2c.completeConnect(ack);
        if (this.debugEnabled) {
          this.onStateUpdate({
            type: "debug",
            boardId: this.boardId,
            category: "rp2040-i2c",
            reason: "connect",
            i2c: {
              bus,
              address: address & 127,
              isRead,
              ack,
              deviceCount: devices.length,
              activeSlaveId: activeSlave?.id || ""
            }
          });
        }
      };
      i2c.onWriteByte = (value) => {
        const devices = activeSlave ? [activeSlave] : this.getRp2040ConnectedI2CDevices(bus);
        let ack = false;
        for (const inst of devices) {
          if (!inst.onI2CByte) continue;
          if (inst.onI2CByte(-1, value & 255)) {
            ack = true;
          }
        }
        i2c.completeWrite(ack);
      };
      i2c.onReadByte = (ack) => {
        void ack;
        let byte = 255;
        if (activeSlave) {
          const slave = activeSlave;
          if (typeof slave.onI2CReadByte === "function") {
            byte = slave.onI2CReadByte() & 255;
          } else if (typeof slave.readByte === "function") {
            byte = slave.readByte() & 255;
          }
        }
        i2c.completeRead(byte);
      };
      i2c.onStop = () => {
        const devices = activeSlave ? [activeSlave] : this.getRp2040ConnectedI2CDevices(bus);
        for (const inst of devices) {
          if (inst.onI2CStop) inst.onI2CStop();
        }
        activeSlave = null;
        const bitBang = this.i2cBitBangState.get(bus);
        if (bitBang) {
          bitBang.inFrame = false;
          bitBang.phase = 0;
          bitBang.shift = 0;
          bitBang.byteIndex = 0;
          bitBang.read = false;
          bitBang.activeSlave = null;
          bitBang.ackShouldBeLow = false;
          bitBang.ackDriveActive = false;
        }
        i2c.completeStop();
      };
    };
    attachBus(0, "i2c0");
    attachBus(1, "i2c1");
  }
  installRp2040SpiAdapters() {
    if (!this.cpu) return;
    const attachBus = (index, bus) => {
      const spi = this.cpu?.spi?.[index];
      if (!spi) return;
      if (!spi.__openhwPatchedDoTX && typeof spi.doTX === "function" && spi.txFIFO) {
        spi.__openhwPatchedDoTX = true;
        spi.doTX = function patchedDoTX() {
          if (!this.busy && !this.txFIFO.empty) {
            const value = this.txFIFO.pull();
            this.busy = true;
            this.onTransmit(value);
            this.fifosUpdated();
          }
        };
      }
      spi.onTransmit = (value) => {
        const byte = value & 255;
        let response = 255;
        const devices = this.getRp2040ConnectedSPIDevices(bus);
        for (const inst of devices) {
          this.syncSpiControlPins(inst);
          if (!this.isRp2040SpiSelected(inst)) continue;
          const out = inst.onSPIByte?.(byte);
          if (out !== void 0) {
            response = Number(out) & 255;
          }
        }
        spi.completeTransmit(response);
      };
    };
    attachBus(0, "spi0");
    attachBus(1, "spi1");
  }
  emitSerialByte(value, source) {
    const byte = value & 255;
    const char = String.fromCharCode(byte);
    const now = performance.now();
    if (source === 2) {
      this.lastUsbSerialAt = now;
    } else if (this.usbCdcReady && now - this.lastUsbSerialAt <= _RP2040Runner.USB_SERIAL_PREFER_WINDOW_MS) {
      return;
    }
    this.activeUartIndex = source;
    if (source !== this.lastSerialSource && byte === this.lastSerialByte && now - this.lastSerialEmitAt <= _RP2040Runner.SERIAL_DEDUP_WINDOW_MS) {
      this.lastSerialSource = source;
      this.lastSerialEmitAt = now;
      return;
    }
    this.lastSerialByte = byte;
    this.lastSerialSource = source;
    this.lastSerialEmitAt = now;
    this.debugSerialTxBytes += 1;
    this.pulseBoardUartLed(source === 1 ? "GP4" : "GP0");
    const sourceLabel = source === 2 ? "usb" : source === 1 ? "uart1" : "uart0";
    if (this.onByteTransmitCb) {
      this.onByteTransmitCb({ boardId: this.boardId, value: byte, char, source: sourceLabel });
    } else {
      this.onStateUpdate({ type: "serial", data: char, value: byte, boardId: this.boardId, source: sourceLabel });
    }
  }
  pulseBoardUartLed(pinId) {
    const boardInst = this.instances.get(this.boardId);
    if (!boardInst || !this.cpu) return;
    boardInst.onPinStateChange(pinId, true, this.cpu.core.cycles);
    const previousTimer = this.uartLedOffTimers.get(pinId);
    if (previousTimer) {
      clearTimeout(previousTimer);
    }
    const offTimer = setTimeout(() => {
      this.uartLedOffTimers.delete(pinId);
      if (!this.cpu) return;
      const liveBoardInst = this.instances.get(this.boardId);
      if (!liveBoardInst) return;
      liveBoardInst.onPinStateChange(pinId, false, this.cpu.core.cycles);
    }, _RP2040Runner.UART_LED_PULSE_MS);
    this.uartLedOffTimers.set(pinId, offTimer);
  }
  clearPendingUartLedTimers() {
    for (const timerId of this.uartLedOffTimers.values()) {
      clearTimeout(timerId);
    }
    this.uartLedOffTimers.clear();
  }
  normalizeToGpPin(pinId) {
    const raw = String(pinId || "").toUpperCase();
    if (/^GP\d+$/.test(raw)) return raw;
    if (/^GPIO\d+$/.test(raw)) return `GP${raw.slice(4)}`;
    if (/^D\d+$/.test(raw)) return `GP${raw.slice(1)}`;
    if (/^\d+$/.test(raw)) return `GP${raw}`;
    return raw;
  }
  boardPinAliases(pinId) {
    const gp = this.normalizeToGpPin(pinId);
    const match = /^GP(\d+)$/.exec(gp);
    if (!match) return [pinId, gp];
    const n = match[1];
    return [pinId, gp, `GPIO${n}`, `D${n}`, n];
  }
  isBoardPin(wireCoord, targetGpPin) {
    const [compId, compPin] = wireCoord.split(":");
    if (compId !== this.boardId) return false;
    const norm = this.normalizeToGpPin(compPin);
    return this.boardPinAliases(targetGpPin).includes(norm) || this.boardPinAliases(targetGpPin).includes(compPin);
  }
  getRp2040ClockHz() {
    const hz = Number(this.cpu?.clkSys || 125e6);
    return Number.isFinite(hz) && hz > 0 ? hz : 125e6;
  }
  getProtocolEndpointsForGpPin(gpPin) {
    const key = this.normalizeToGpPin(gpPin);
    const cached = this.protocolEndpointsCache.get(key);
    if (cached) return cached;
    const endpoints = collectConnectedComponentPins(
      this.boardId,
      this.boardPinAliases(key),
      this.currentWires,
      this.instances
    );
    this.protocolEndpointsCache.set(key, endpoints);
    return endpoints;
  }
  dispatchOptionalPwm(gpPin, isHigh, cycles, functionSelect) {
    const key = this.normalizeToGpPin(gpPin);
    let state = this.pwmState.get(key);
    if (!state) {
      state = { lastRiseCycle: -1, lastFallCycle: -1, lastPeriodCycles: -1 };
      this.pwmState.set(key, state);
    }
    const clockHz = this.getRp2040ClockHz();
    let frequencyHz = 0;
    let dutyCycle = 0;
    let pulseUs = 0;
    let periodUs = 0;
    if (isHigh) {
      if (state.lastRiseCycle >= 0 && state.lastFallCycle > state.lastRiseCycle) {
        const periodCycles = Math.max(1, cycles - state.lastRiseCycle);
        const highCycles = Math.max(0, state.lastFallCycle - state.lastRiseCycle);
        state.lastPeriodCycles = periodCycles;
        frequencyHz = clockHz / periodCycles;
        dutyCycle = Math.max(0, Math.min(1, highCycles / periodCycles));
        periodUs = periodCycles * 1e6 / clockHz;
        pulseUs = highCycles * 1e6 / clockHz;
      }
      state.lastRiseCycle = cycles;
    } else {
      state.lastFallCycle = cycles;
      if (state.lastRiseCycle >= 0) {
        const highCycles = Math.max(0, cycles - state.lastRiseCycle);
        pulseUs = highCycles * 1e6 / clockHz;
        if (state.lastPeriodCycles > 0) {
          frequencyHz = clockHz / state.lastPeriodCycles;
          dutyCycle = Math.max(0, Math.min(1, highCycles / state.lastPeriodCycles));
          periodUs = state.lastPeriodCycles * 1e6 / clockHz;
        }
      }
    }
    if (frequencyHz <= 0 && dutyCycle <= 0 && pulseUs <= 0) return;
    const meta = {
      protocol: "pwm",
      boardPin: key,
      isHigh,
      frequencyHz,
      dutyCycle,
      pulseUs,
      periodUs,
      functionSelect,
      source: functionSelect === RP2040_GPIO_FUNC_PWM ? "pwm" : "gpio",
      cycles
    };
    for (const endpoint of this.getProtocolEndpointsForGpPin(key)) {
      invokeOptional(endpoint.inst, ["onPWM", "onPwm", "onPWMSignal"], [endpoint.pinId, meta]);
    }
  }
  dispatchOptionalPio(gpPin, isHigh, cycles, functionSelect) {
    if (functionSelect !== RP2040_GPIO_FUNC_PIO0 && functionSelect !== RP2040_GPIO_FUNC_PIO1) {
      return;
    }
    const key = this.normalizeToGpPin(gpPin);
    const pioIndex = functionSelect === RP2040_GPIO_FUNC_PIO1 ? 1 : 0;
    const meta = {
      protocol: "pio",
      boardPin: key,
      isHigh,
      pioIndex,
      functionSelect,
      cycles
    };
    for (const endpoint of this.getProtocolEndpointsForGpPin(key)) {
      invokeOptional(endpoint.inst, ["onPIOPinChange", "onPioPinChange", "onPIO", "onPio"], [endpoint.pinId, isHigh, meta]);
    }
  }
  dispatchOptionalOneWire(gpPin, isHigh, cycles) {
    const key = this.normalizeToGpPin(gpPin);
    let state = this.oneWireState.get(key);
    if (!state) {
      state = { lowStartCycle: null, highStartCycle: null };
      this.oneWireState.set(key, state);
    }
    const endpoints = this.getProtocolEndpointsForGpPin(key);
    if (!endpoints.length) {
      if (isHigh) {
        state.lowStartCycle = null;
        state.highStartCycle = cycles;
      } else {
        state.highStartCycle = null;
        state.lowStartCycle = cycles;
      }
      return;
    }
    const clockHz = this.getRp2040ClockHz();
    if (!isHigh) {
      if (state.highStartCycle != null) {
        const highCycles = Math.max(0, cycles - state.highStartCycle);
        const highUs = highCycles * 1e6 / clockHz;
        if (highUs > 0) {
          const pulseMeta = {
            protocol: "pulse",
            boardPin: key,
            pulseUs: highUs,
            highUs,
            edge: "falling",
            cycles
          };
          for (const endpoint of endpoints) {
            invokeOptional(endpoint.inst, ["onPulseHigh", "onDigitalPulseHigh", "onOneWirePulseHigh"], [endpoint.pinId, pulseMeta]);
          }
        }
      }
      state.highStartCycle = null;
      state.lowStartCycle = cycles;
      return;
    }
    if (state.lowStartCycle == null) return;
    const lowCycles = Math.max(0, cycles - state.lowStartCycle);
    state.lowStartCycle = null;
    state.highStartCycle = cycles;
    const lowUs = lowCycles * 1e6 / clockHz;
    if (lowUs > 0) {
      const pulseMeta = {
        protocol: "pulse",
        boardPin: key,
        pulseUs: lowUs,
        lowUs,
        edge: "rising",
        cycles
      };
      for (const endpoint of endpoints) {
        invokeOptional(endpoint.inst, ["onPulseLow", "onDigitalPulseLow", "onOneWirePulseLow"], [endpoint.pinId, pulseMeta]);
      }
    }
    if (lowUs >= 360) {
      const meta = {
        protocol: "onewire",
        boardPin: key,
        pulseUs: lowUs,
        kind: "reset",
        cycles
      };
      for (const endpoint of endpoints) {
        invokeOptional(endpoint.inst, ["onOneWireReset", "onOnewireReset"], [endpoint.pinId, meta]);
      }
      return;
    }
    if (lowUs >= 1 && lowUs <= 120) {
      const bit = lowUs < 20 ? 1 : 0;
      const meta = {
        protocol: "onewire",
        boardPin: key,
        pulseUs: lowUs,
        kind: "slot",
        bit,
        cycles
      };
      for (const endpoint of endpoints) {
        invokeOptional(endpoint.inst, ["onOneWireWriteBit", "onOnewireWriteBit"], [endpoint.pinId, bit, meta]);
        invokeOptional(endpoint.inst, ["onOneWireSlot", "onOnewireSlot"], [endpoint.pinId, meta]);
      }
    }
  }
  getRp2040I2CBitBangState(bus, pins) {
    let state = this.i2cBitBangState.get(bus);
    const currentSdaHigh = !!this.pinStates[pins.sda];
    const currentSclHigh = !!this.pinStates[pins.scl];
    if (!state) {
      state = {
        initialized: true,
        prevSdaHigh: currentSdaHigh,
        prevSclHigh: currentSclHigh,
        inFrame: false,
        phase: 0,
        shift: 0,
        byteIndex: 0,
        read: false,
        activeSlave: null,
        ackShouldBeLow: false,
        ackDriveActive: false
      };
      this.i2cBitBangState.set(bus, state);
      return state;
    }
    if (!state.initialized) {
      state.initialized = true;
      state.prevSdaHigh = currentSdaHigh;
      state.prevSclHigh = currentSclHigh;
    }
    return state;
  }
  setRp2040I2CFallbackSdaInput(pin, isHigh) {
    if (!this.cpu) return;
    const idx = this.parseGpIndex(pin);
    if (idx == null) return;
    this.cpu.gpio[idx].setInputValue(!!isHigh);
  }
  consumeRp2040I2CBitBangByte(bus, state, value) {
    const byte = value & 255;
    let ack = false;
    if (state.byteIndex === 0) {
      const address = byte >>> 1 & 127;
      const isRead = (byte & 1) !== 0;
      const devices = this.getRp2040ConnectedI2CDevices(bus);
      let activeSlave = null;
      for (const inst of devices) {
        if (!inst.onI2CStart) continue;
        if (inst.onI2CStart(address, isRead)) {
          if (!activeSlave) activeSlave = inst;
        }
      }
      state.activeSlave = activeSlave;
      state.read = isRead;
      ack = !!activeSlave;
      if (this.debugEnabled) {
        this.onStateUpdate({
          type: "debug",
          boardId: this.boardId,
          category: "rp2040-i2c",
          reason: "connect-bitbang",
          i2c: {
            bus,
            address,
            isRead,
            ack,
            deviceCount: devices.length,
            activeSlaveId: activeSlave?.id || ""
          }
        });
      }
    } else if (state.activeSlave && !state.read && state.activeSlave.onI2CByte) {
      ack = !!state.activeSlave.onI2CByte(-1, byte);
    } else if (state.activeSlave) {
      ack = true;
    }
    state.byteIndex += 1;
    return ack;
  }
  dispatchOptionalI2CFallback(gpPin) {
    const pin = this.normalizeToGpPin(gpPin);
    const buses = ["i2c0", "i2c1"];
    for (const bus of buses) {
      if (this.i2cHardwareSeen.get(bus)) continue;
      const pins = this.i2cBusPinPairs.get(bus);
      if (!pins) continue;
      if (pin !== pins.sda && pin !== pins.scl) continue;
      const state = this.getRp2040I2CBitBangState(bus, pins);
      const sdaNow = !!this.pinStates[pins.sda];
      const sclNow = !!this.pinStates[pins.scl];
      const startCondition = state.prevSdaHigh && !sdaNow && state.prevSclHigh && sclNow;
      const stopCondition = !state.prevSdaHigh && sdaNow && state.prevSclHigh && sclNow;
      const fallingScl = state.prevSclHigh && !sclNow;
      if (startCondition) {
        if (state.ackDriveActive) {
          this.setRp2040I2CFallbackSdaInput(pins.sda, true);
          state.ackDriveActive = false;
        }
        state.inFrame = true;
        state.phase = 0;
        state.shift = 0;
        state.byteIndex = 0;
        state.read = false;
        state.activeSlave = null;
        state.ackShouldBeLow = false;
      }
      const risingScl = !state.prevSclHigh && sclNow;
      if (state.inFrame && risingScl) {
        const bit = sdaNow ? 1 : 0;
        if (state.phase < 8) {
          state.shift = (state.shift << 1 | bit) & 255;
          state.phase += 1;
          if (state.phase === 8) {
            state.ackShouldBeLow = this.consumeRp2040I2CBitBangByte(bus, state, state.shift);
          }
        } else {
          state.phase = 0;
          state.shift = 0;
          state.ackShouldBeLow = false;
        }
      }
      if (fallingScl) {
        if (state.phase === 8 && state.ackShouldBeLow && !state.ackDriveActive) {
          this.setRp2040I2CFallbackSdaInput(pins.sda, false);
          state.ackDriveActive = true;
        } else if (state.phase === 0 && state.ackDriveActive) {
          this.setRp2040I2CFallbackSdaInput(pins.sda, true);
          state.ackDriveActive = false;
        }
      }
      if (stopCondition) {
        if (state.activeSlave && state.activeSlave.onI2CStop) {
          state.activeSlave.onI2CStop();
        }
        if (state.ackDriveActive) {
          this.setRp2040I2CFallbackSdaInput(pins.sda, true);
          state.ackDriveActive = false;
        }
        state.inFrame = false;
        state.phase = 0;
        state.shift = 0;
        state.byteIndex = 0;
        state.read = false;
        state.activeSlave = null;
        state.ackShouldBeLow = false;
      }
      state.prevSdaHigh = sdaNow;
      state.prevSclHigh = sclNow;
    }
  }
  dispatchOptionalProtocols(gpPin, isHigh, cycles, functionSelect) {
    this.dispatchOptionalPwm(gpPin, isHigh, cycles, functionSelect);
    this.dispatchOptionalPio(gpPin, isHigh, cycles, functionSelect);
    this.dispatchOptionalOneWire(gpPin, isHigh, cycles);
    this.dispatchOptionalI2CFallback(gpPin);
  }
  traversePassive(inst, compId, pinId, voltage, visit) {
    if (inst.type === "wokwi-resistor") {
      const otherPin = pinId === "p1" ? "p2" : pinId === "p2" ? "p1" : null;
      if (!otherPin) return;
      inst.setPinVoltage(otherPin, voltage);
      visit(`${compId}:${otherPin}`, voltage);
    } else if (inst.type === "wokwi-led") {
      if (pinId === "A") {
        const nextV = Math.max(0, voltage - 1.8);
        inst.setPinVoltage("K", nextV);
        visit(`${compId}:K`, nextV);
      }
    } else if (inst.type === "wokwi-pushbutton" && inst.state?.pressed) {
      const otherPin = pinId === "1" ? "2" : pinId === "2" ? "1" : null;
      if (!otherPin) return;
      inst.setPinVoltage(otherPin, voltage);
      visit(`${compId}:${otherPin}`, voltage);
    } else if (inst.type === "wokwi-breadboard" || inst.type === "wokwi-breadboard-half") {
      const bridges = getInternalBridgesForComponent(compId, inst.type);
      for (const bridge of bridges) {
        if (bridge[0] === `${compId}:${pinId}`) visit(bridge[1], voltage);
        else if (bridge[1] === `${compId}:${pinId}`) visit(bridge[0], voltage);
      }
    }
  }
  updatePhysics(voltage, gpPin) {
    const solver = new CircuitSolver();
    solver.reset();
    const netToNode = /* @__PURE__ */ new Map();
    this.pinToNet.forEach((netId, pinStr) => {
      if (!netToNode.has(netId)) {
        const isGnd = Array.from(this.pinToNet.entries()).some(([p, n]) => n === netId && (p.toLowerCase().includes("gnd") || p.toLowerCase().includes("vss")));
        if (isGnd) netToNode.set(netId, 0);
        else {
          solver.addPin(pinStr);
          netToNode.set(netId, solver.nodes.get(pinStr));
        }
      }
      solver.addPin(pinStr, netToNode.get(netId));
    });
    solver.addVoltageSource(`${this.boardId}:GP${gpPin}`, voltage);
    for (const [id, inst] of this.instances) {
      if (typeof inst.getMnaStamps === "function" || typeof inst.getMnaPins === "function") {
        solver.addComponent(inst);
      }
    }
    const voltages = solver.solve();
    this.pinToNet.forEach((netId, pinStr) => {
      const nodeId = netToNode.get(netId) ?? -1;
      const v = voltages.get(nodeId) ?? 0;
      const [compId, compPin] = pinStr.split(":");
      const inst = this.instances.get(compId);
      if (inst) inst.setPinVoltage(compPin, v);
    });
  }
  propagateBoardPin(gpPin, isHigh) {
    const voltage = isHigh ? 3.3 : 0;
    const visitedEdges = /* @__PURE__ */ new Set();
    const visitedNodes = /* @__PURE__ */ new Set();
    const visitNode = (node, v) => {
      if (visitedNodes.has(node)) return;
      visitedNodes.add(node);
      const [compId, compPin] = node.split(":");
      for (const wire of this.currentWires) {
        const edgeKey = `${wire.from}|${wire.to}`;
        if (visitedEdges.has(edgeKey)) continue;
        if (wire.from === node || wire.to === node) {
          visitedEdges.add(edgeKey);
          visitNode(wire.from === node ? wire.to : wire.from, v);
        }
      }
      const inst = this.instances.get(compId);
      if (!inst) return;
      if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: "INPUT" };
      inst.setPinVoltage(compPin, v);
      this.traversePassive(inst, compId, compPin, v, (forwardNode, nextV) => {
        visitNode(forwardNode, nextV);
      });
    };
    for (const wire of this.currentWires) {
      const edgeKey = `${wire.from}|${wire.to}`;
      const fromBoard = this.isBoardPin(wire.from, gpPin);
      const toBoard = this.isBoardPin(wire.to, gpPin);
      if (!fromBoard && !toBoard) continue;
      visitedEdges.add(edgeKey);
      visitNode(fromBoard ? wire.to : wire.from, voltage);
    }
    this.instances.forEach((inst) => {
      Object.keys(inst.pins).forEach((pinKey) => {
        const upper = pinKey.toUpperCase();
        if (upper === "GND" || upper === "AGND" || upper === "VSS" || upper.startsWith("GND_") || upper.startsWith("GND.") || upper === "K") {
          inst.setPinVoltage(pinKey, 0);
        }
        if (upper === "3V3" || upper === "VCC" || upper.startsWith("3V3.")) {
          inst.setPinVoltage(pinKey, 3.3);
        }
      });
    });
  }
  onPinChange(pin, isHigh, cycleOverride) {
    const pinName = `GP${pin}`;
    if (this.pinStates[pinName] === isHigh) return;
    this.pinStates[pinName] = isHigh;
    this.pinsChanged = true;
    this.debugGpioTransitions += 1;
    this.debugLastGpioPin = pinName;
    const rawCycles = Number.isFinite(Number(cycleOverride)) ? Number(cycleOverride) : Number(this.cpu?.core.cycles ?? 0);
    const cycles = rawCycles >= this.pioSignalCycle ? rawCycles : this.pioSignalCycle;
    this.pioSignalCycle = cycles;
    const boardInst = this.instances.get(this.boardId);
    const clockScale = 16e6 / this.getRp2040ClockHz();
    const normalizedCycles = Math.floor(cycles * clockScale);
    if (boardInst) {
      boardInst.onPinStateChange(pinName, isHigh, normalizedCycles);
    }
    for (const endpoint of this.getProtocolEndpointsForGpPin(pinName)) {
      endpoint.inst.onPinStateChange(endpoint.pinId, isHigh, normalizedCycles);
    }
    const functionSelect = this.cpu?.gpio?.[pin]?.functionSelect ?? 0;
    this.dispatchOptionalProtocols(pinName, isHigh, cycles, functionSelect);
    this.propagateBoardPin(pinName, isHigh);
    this.observeSoftSerialTx(pinName, isHigh, cycles);
  }
  attachGPIOListeners() {
    if (!this.cpu) return;
    for (let gp = 0; gp <= 28; gp++) {
      const unsubscribe = this.cpu.gpio[gp].addListener((state) => {
        const isHigh = state === GPIOPinState.High || state === GPIOPinState.InputPullUp;
        this.onPinChange(gp, isHigh);
      });
      this.gpioUnsubscribers.push(unsubscribe);
    }
  }
  updateGPIOInputsFromCircuit() {
    if (!this.cpu) return;
    for (let gp = 0; gp < 29; gp++) {
      const gpPin = `GP${gp}`;
      let observedVoltage = 0;
      const endpoints = this.getProtocolEndpointsForGpPin(gpPin);
      for (const ep of endpoints) {
        observedVoltage = Math.max(observedVoltage, ep.inst.getPinVoltage(ep.pinId));
      }
      if (gpPin === this.softSerialRxPin && this.softSerialRxOverrideActive) {
        this.cpu.gpio[gp].setInputValue(this.softSerialRxLevelHigh);
        continue;
      }
      this.cpu.gpio[gp].setInputValue(observedVoltage > 1.65);
      if (gp >= 26 && gp <= 29) {
        const adcChannel = gp - 26;
        const digitalValue = Math.floor(Math.max(0, Math.min(3.3, observedVoltage)) / 3.3 * 4095);
        this.cpu.adc.channelValues[adcChannel] = digitalValue;
      }
    }
  }
  /**
   * Step PIO state machines synchronously.
   * Replaces the redundant internal PIO timers that cause event-loop congestion.
   */
  /**
   * Step a PIO state machine block synchronously.
   * Implements edge detection to ensure pin changes are propagated to components.
   */
  stepPIO(index, stepCycles = 1) {
    if (!this.cpu) return;
    const pio = this.cpu.pio;
    if (!pio || !pio[index]) return;
    const cycleStep = Number.isFinite(Number(stepCycles)) && Number(stepCycles) > 0 ? Number(stepCycles) : 1;
    const baseCycles = Number(this.cpu.core.cycles ?? 0);
    if (baseCycles > this.pioSignalCycle) {
      this.pioSignalCycle = baseCycles;
    }
    this.pioSignalCycle += cycleStep;
    const edgeCycle = this.pioSignalCycle;
    const oldPins = pio[index].pins >>> 0;
    pio[index].step();
    const newPins = pio[index].pins >>> 0;
    if (oldPins !== newPins) {
      const changed = (oldPins ^ newPins) >>> 0;
      for (let i = 0; i < 30; i++) {
        if (changed & 1 << i) {
          this.onPinChange(i, !!(newPins & 1 << i), edgeCycle);
        }
      }
    }
  }
  serialRx(data) {
    const source = this.usbCdc && this.usbCdcReady ? 2 : this.activeUartIndex === 1 ? 1 : 0;
    for (let i = 0; i < data.length; i++) {
      this.serialBuffer.push({ value: data.charCodeAt(i) & 255, source });
      this.debugSerialRxBytes += 1;
    }
    this.pulseBoardUartLed(source === 1 ? "GP5" : "GP1");
  }
  serialRxByte(value) {
    this.serialRxByteFromSource(value, this.activeUartIndex === 1 ? "uart1" : "uart0");
  }
  softSerialRxByte(value) {
    this.softSerialRxQueue.push(value & 255);
    this.softSerialRxOverrideActive = true;
    this.debugSerialRxBytes += 1;
    this.pulseBoardUartLed("GP1");
  }
  serialRxByteFromSource(value, sourceLabel = "uart0") {
    const s = String(sourceLabel || "uart0").toLowerCase();
    if (isSoftSerialSourceLabel(s)) {
      this.softSerialRxByte(value);
      return;
    }
    const source = s === "uart1" || s === "serial1" || s === "1" ? 1 : s === "usb" || s === "cdc" || s === "serialusb" ? 2 : 0;
    this.activeUartIndex = source;
    this.serialBuffer.push({ value: value & 255, source });
    this.debugSerialRxBytes += 1;
    this.pulseBoardUartLed(source === 1 ? "GP5" : "GP1");
  }
  setSerialBaudRate(baud) {
    const parsed = Number(baud);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(300, Math.min(3e6, Math.floor(parsed)));
    this.serialBaudRate = clamped;
  }
  getSerialBaudRate() {
    return this.serialBaudRate;
  }
  setSpeed(speed) {
    const s = Number(speed);
    if (Number.isFinite(s) && s > 0) {
      this.speed = s;
    }
  }
  reset() {
    if (!this.cpu) return;
    this.clearPendingUartLedTimers();
    this.cpu.reset();
    this.cpu.loadBootrom(bootromB1);
    this.bootromLoaded = true;
    this.entryInfo = loadRP2040Firmware(this.cpu, this.firmwareHex, {
      logicalFlashBytes: this.getLogicalFlashLength(),
      partitions: this.flashPartitions
    });
    this.cpuCyclesAtStart = this.cpu.core.cycles;
    this.pio0Accum = 0;
    this.pio1Accum = 0;
    this.pioSignalCycle = this.cpu.core.cycles;
    this.serialBuffer = [];
    this.serialByteBudget = 0;
    this.activeUartIndex = 0;
    this.softSerialRxQueue = [];
    this.softSerialRxFrame = null;
    this.softSerialRxOverrideActive = false;
    this.softSerialNextInjectCycle = 0;
    this.softSerialDecodeState = {
      receiving: false,
      sampleCycle: 0,
      sampleIndex: 0,
      currentByte: 0,
      lastLevel: true
    };
    this.usbCdc = null;
    this.usbCdcReady = false;
    this.debugLastEmitAt = 0;
    this.debugStepCount = 0;
    this.debugSerialTxBytes = 0;
    this.debugSerialRxBytes = 0;
    this.debugGpioTransitions = 0;
    this.debugLastGpioPin = "";
    this.debugPcStallTicks = 0;
    this.debugLastPc = this.cpu.core.PC >>> 0;
    this.lowPcAliasCandidate = -1;
    this.lowPcAliasRepeatCount = 0;
    this.invalidPcStrikeCount = 0;
    this.pinsChanged = true;
    this.hasFaulted = false;
    this.protocolEndpointsCache.clear();
    this.i2cDeviceCache.clear();
    this.spiDeviceCache.clear();
    this.peripheralDeviceCacheReady = false;
    this.pwmState.clear();
    this.oneWireState.clear();
    this.componentSyncMeta.clear();
    this.setSoftSerialRxLevel(true);
    this.attachUART();
    this.attachUSBSerial();
    this.rebuildPeripheralDeviceCache();
    this.installRp2040I2cAdapters();
    this.installRp2040SpiAdapters();
    if (this.picoWirelessStub) {
      const now = performance.now();
      this.picoWirelessStub.startedAtMs = now;
      this.picoWirelessStub.lastEmitMs = 0;
      this.picoWirelessStub.status = this.picoWirelessStub.mode === "off" ? "off" : "booting";
      this.applyWirelessStubStateToBoard();
    }
    this.emitDebugSnapshot("reset", performance.now(), true);
    this.emitWirelessStubStatus("reset", true);
  }
  /**
   * Get the current clock divider for the PIO state machines.
   * Aligned with Velxio: uses the first enabled state machine's divider or defaults to 64.
   */
  /**
   * Get the current clock dividers for PIO blocks 0 and 1.
   * Uses the smallest divider of any enabled state machine in each block,
   * including fractional bits.
   */
  getPIOClockDivs() {
    if (!this.cpu) return [64, 64];
    const pioInstances = this.cpu.pio || [];
    const divs = [64, 64];
    for (let i = 0; i < 2; i++) {
      const p = pioInstances[i];
      if (!p || p.stopped) continue;
      let minDiv = Infinity;
      for (const m of p.machines) {
        if (m.enabled) {
          const d = Math.max(1, Number(m.clkdiv || 1));
          if (d < minDiv) minDiv = d;
        }
      }
      divs[i] = minDiv === Infinity ? 64 : minDiv;
    }
    return divs;
  }
  stop() {
    const neopixelStates = collectNeopixelShutdownStates(this.instances);
    if (neopixelStates.length > 0) {
      this.onStateUpdate({ type: "state", boardId: this.boardId, components: neopixelStates });
    }
    this.running = false;
    this.clearPendingUartLedTimers();
    this.gdbStatus = "closed";
    this.emitGdbStatus("stopped", "Runner stopped");
    if (this.gdbWs) {
      try {
        this.gdbWs.close();
      } catch {
      }
      this.gdbWs = null;
    }
    clearInterval(this.statusInterval);
    this.gpioUnsubscribers.forEach((dispose) => {
      try {
        dispose();
      } catch {
      }
    });
    this.gpioUnsubscribers = [];
  }
};
__publicField(_RP2040Runner, "FAULT_GRACE_CYCLES", 6e6);
// ~48ms simulated @ 125MHz – covers bootrom + MicroPython init
__publicField(_RP2040Runner, "LOW_PC_ALIAS_REPEAT_LIMIT", 5e7);
__publicField(_RP2040Runner, "INVALID_PC_STRIKE_LIMIT", 64);
__publicField(_RP2040Runner, "PC_VALIDATION_INTERVAL_STEPS", 1024);
__publicField(_RP2040Runner, "HARD_INVALID_PC_BASE", 2147483648);
__publicField(_RP2040Runner, "SERIAL_DEDUP_WINDOW_MS", 2);
__publicField(_RP2040Runner, "USB_SERIAL_PREFER_WINDOW_MS", 250);
__publicField(_RP2040Runner, "UART_LED_PULSE_MS", 40);
__publicField(_RP2040Runner, "WIRELESS_STUB_EMIT_INTERVAL_MS", 2e3);
var RP2040Runner = _RP2040Runner;
function createRunnerForBoard(boardType, hexData, componentsDef, wiresDef, onStateUpdate, options = {}) {
  if (/pico|rp2040/i.test(String(boardType || ""))) {
    return new RP2040Runner(hexData, componentsDef, wiresDef, onStateUpdate, options);
  }
  return new AVRRunner(hexData, componentsDef, wiresDef, onStateUpdate, options);
}
export {
  AVRRunner,
  COMPONENT_PINS,
  LOGIC_REGISTRY,
  RP2040Runner,
  buildFatFsImage,
  buildLittleFsImage,
  createRunnerForBoard,
  parse
};
