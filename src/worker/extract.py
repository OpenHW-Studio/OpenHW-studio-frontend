import os

def split_execute():
    print('Reading execute.ts...')
    with open('execute.ts', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    generic_funcs = [
        'parsePositiveInt',
        'collectNeopixelShutdownStates',
        'isSoftSerialSourceLabel',
        'collectConnectedComponentPins',
        'invokeOptional',
        'estimateStatePayloadWeight',
        'getComponentStateSyncPolicy',
        'readComponentStateForTelemetry',
        'safeJsonStringify',
        'readPinLevelMap',
        'isLikelyActiveSignal',
        'buildFallbackTelemetry',
        'getUnifiedComponentSyncState',
        'collectComponentTelemetry'
    ]

    generic_vars = [
        'SOFT_SERIAL_SOURCE_LABELS',
        'NEOPIXEL_COMPONENT_TYPE_PATTERN',
        'MEDIUM_COMPONENT_STATE_WEIGHT',
        'HEAVY_COMPONENT_STATE_WEIGHT',
        'MEDIUM_COMPONENT_MIN_SYNC_MS',
        'HEAVY_COMPONENT_MIN_SYNC_MS',
        'fallbackTelemetryByInstance'
    ]

    # Start of the block to process
    start_idx = -1
    for i, line in enumerate(lines):
        if 'const RP2040_FLASH_BASE = 0x10000000;' in line:
            start_idx = i
            break
            
    # End of the block
    end_idx = -1
    for i, line in enumerate(lines):
        if 'export function createRunnerForBoard' in line:
            end_idx = i
            break

    if start_idx == -1 or end_idx == -1:
        print("Could not find bounds")
        return

    top_execute = lines[:start_idx]
    bottom_execute = lines[end_idx:]
    
    middle = lines[start_idx:end_idx]
    
    # We will parse middle line by line.
    rp2040_lines = []
    execute_lines = []
    
    i = 0
    while i < len(middle):
        line = middle[i]
        
        # Check if it's a generic variable
        is_gen_var = False
        for gv in generic_vars:
            if f'const {gv}' in line:
                is_gen_var = True
                break
        
        if is_gen_var:
            execute_lines.append(line)
            i += 1
            continue
            
        # Check if it's a generic function
        is_gen_func = False
        for gf in generic_funcs:
            if f'function {gf}' in line or f'const {gf} =' in line:
                is_gen_func = True
                break
                
        if is_gen_func:
            # Consume the entire function block
            func_block = [line]
            braces = line.count('{') - line.count('}')
            found_brace = '{' in line
            i += 1
            while i < len(middle):
                l = middle[i]
                func_block.append(l)
                braces += l.count('{') - l.count('}')
                if '{' in l: found_brace = True
                i += 1
                if found_brace and braces <= 0:
                    break
            execute_lines.extend(func_block)
            continue
            
        # Check if it's a type that generic functions use
        if 'type FallbackTelemetryRuntime =' in line or 'type ConnectedComponentPin =' in line:
             # Consume the block
            func_block = [line]
            braces = line.count('{') - line.count('}')
            found_brace = '{' in line
            i += 1
            while i < len(middle):
                l = middle[i]
                func_block.append(l)
                braces += l.count('{') - l.count('}')
                if '{' in l: found_brace = True
                i += 1
                if found_brace and braces <= 0:
                    break
            execute_lines.extend(func_block)
            continue
            
        # Otherwise, it belongs to RP2040!
        rp2040_lines.append(line)
        i += 1

    imports = '''import { RP2040, GPIOPinState, ConsoleLogger, LogLevel, USBCDC, GDBServer, GDBConnection } from 'rp2040js';
import { BaseComponent } from '@openhw/emulator';
import { getComponentStateSyncPolicy, collectComponentTelemetry, flushCustomTelemetry, LOGIC_REGISTRY } from '../execute';
import type { BoardRunner, SystemConfig, RP2040FirmwareLoadOptions } from '../execute';

'''

    os.makedirs('runners', exist_ok=True)
    with open('runners/rp2040-runner.ts', 'w', encoding='utf-8') as f:
        f.write(imports)
        f.writelines(rp2040_lines)

    with open('execute.ts', 'w', encoding='utf-8') as f:
        f.writelines(top_execute)
        f.writelines(execute_lines)
        f.writelines(bottom_execute)

    print('Extraction complete!')

if __name__ == '__main__':
    split_execute()
