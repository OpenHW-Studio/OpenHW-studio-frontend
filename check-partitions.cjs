const fs = require('fs');

const dirs = fs.readdirSync('../openhw-studio-backend/builds')
    .map(d => { const p = '../openhw-studio-backend/builds/'+d+'/build/merged-flash.bin'; try { return { d, p, t: fs.statSync(p).mtime.getTime() }; } catch { return null; }})
    .filter(Boolean).sort((a, b) => b.t - a.t);
const bin = fs.readFileSync(dirs[0].p);
console.log('Build:', dirs[0].d);

// ESP32 partition table at 0x8000
const PT_OFFSET = 0x8000;
const ENTRY_SIZE = 32;
console.log('\nPartition table entries:');
for (let i = 0; i < 10; i++) {
    const off = PT_OFFSET + i * ENTRY_SIZE;
    const magic = bin[off] | (bin[off+1] << 8);
    if (magic !== 0xAA50) { console.log('  End of table at entry', i); break; }
    const type = bin[off+2];
    const subtype = bin[off+3];
    const partOffset = bin.readUInt32LE(off+4);
    const size = bin.readUInt32LE(off+8);
    const name = bin.slice(off+12, off+28).toString('utf8').replace(/\x00/g,'');
    const typeStr = type === 0 ? 'APP' : type === 1 ? 'DATA' : 'UNKNOWN';
    const subtypeStr = subtype === 0 ? 'factory' : subtype === 1 ? 'ota_0' : subtype === 2 ? 'nvs' : subtype === 0x82 ? 'coredump' : '0x'+subtype.toString(16);
    console.log('  [' + i + '] type=' + typeStr + '/' + subtypeStr + ' offset=0x' + partOffset.toString(16) + ' size=0x' + size.toString(16) + ' name="' + name.trim() + '"');
}

// Check bootloader at 0x1000
console.log('\nBootloader header at 0x1000:', Array.from(bin.slice(0x1000, 0x1010)).map(b => '0x'+b.toString(16).padStart(2,'0')).join(' '));
// Check app at 0x10000
console.log('App header at 0x10000:', Array.from(bin.slice(0x10000, 0x10010)).map(b => '0x'+b.toString(16).padStart(2,'0')).join(' '));
// Check if there's something at 0x20000
console.log('Data at 0x20000:', Array.from(bin.slice(0x20000, 0x20010)).map(b => '0x'+b.toString(16).padStart(2,'0')).join(' '));
