const fs = require('fs');

function keepSide(file, side) {
    let content = fs.readFileSync(file, 'utf8');
    const regex = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> develop\r?\n/g;
    content = content.replace(regex, (match, head, dev) => {
        if (side === 'head') return head;
        if (side === 'develop') return dev;
        if (side === 'both') return head + '\n' + dev;
    });
    fs.writeFileSync(file, content);
}

keepSide('src/pages/simulationpage/components/ComponentInspectorPanel.jsx', 'head');
keepSide('src/worker/registries/component-registry.ts', 'develop');
keepSide('src/worker/runners/rp2040-runner.ts', 'head');
keepSide('src/workers/autowiring.worker.ts', 'both');
keepSide('src/worker/runners/avr-runner.ts', 'both');

console.log('Fixed simple conflicts');
