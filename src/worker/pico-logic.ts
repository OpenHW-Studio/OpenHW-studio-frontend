import { BaseComponent } from '@openhw/emulator/src/components/BaseComponent.ts';

function normalizePicoPin(pinId: string): string {
  const s = String(pinId || '').toUpperCase();
  if (/^GPIO\d+$/.test(s)) return `GP${s.slice(4)}`;
  if (/^D\d+$/.test(s)) return `GP${s.slice(1)}`;
  if (/^\d+$/.test(s)) return `GP${s}`;
  return s;
}

export class PicoLogic extends BaseComponent {
  private txTimeout: any = null;
  private rxTimeout: any = null;

  constructor(id: string, manifest: any) {
    super(id, manifest);
    this.state = {
      txActive: false,
      rxActive: false,
      builtInLed: false,
      ...this.state,
    };
  }

  onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
    const pin = normalizePicoPin(pinId);
    if (pin === 'GP1' || pin === 'GP5') {
      this.setState({ rxActive: true });
      if (this.rxTimeout) clearTimeout(this.rxTimeout);
      this.rxTimeout = setTimeout(() => {
        this.setState({ rxActive: false });
        this.rxTimeout = null;
      }, 100);
    } else if (pin === 'GP0' || pin === 'GP4') {
      this.setState({ txActive: true });
      if (this.txTimeout) clearTimeout(this.txTimeout);
      this.txTimeout = setTimeout(() => {
        this.setState({ txActive: false });
        this.txTimeout = null;
      }, 100);
    } else if (pin === 'GP25') {
      this.setState({ builtInLed: !!isHigh });
    }
  }

  update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
    // RP2040 CPU runtime integration is handled by worker runners.
  }
}
