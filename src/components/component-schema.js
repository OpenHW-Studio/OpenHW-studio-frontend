const VALID_SEVERITIES = new Set(['error', 'warn', 'info']);

function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function inferValidationRemediation(issue, component = null) {
    const message = normalizeText(issue?.message || issue);
    const componentType = normalizeText(component?.type || issue?.componentType || '');

    if (!message) {
        return { remediation: null, autoFixable: false };
    }

    if (message.includes('dead short') || message.includes('short circuit') || message.includes('vcc and gnd')) {
        return { remediation: 'Inspect the wiring and remove the direct VCC-to-GND connection.', autoFixable: false };
    }

    if (message.includes('button is completely disconnected') || message.includes('component is unconnected')) {
        return { remediation: 'Wire the component into the circuit.', autoFixable: true };
    }

    if (message.includes('floating') || message.includes('is not connected')) {
        if (message.includes('pull-up') || message.includes('pullup')) {
            return { remediation: 'Add the recommended pull-up resistor to VCC.', autoFixable: true };
        }

        if (message.includes('ground') || message.includes('gnd')) {
            return { remediation: 'Connect the pin to the common ground rail.', autoFixable: true };
        }

        if (message.includes('power') || message.includes('vcc') || message.includes('vin') || componentType.includes('power')) {
            return { remediation: 'Connect the pin to the correct power rail.', autoFixable: true };
        }

        return { remediation: 'Connect the pin or add a pull-up/pull-down resistor.', autoFixable: true };
    }

    if (message.includes('series resistor') || message.includes('direct drive')) {
        return { remediation: 'Add the recommended series resistor or driver stage.', autoFixable: true };
    }

    if (message.includes('logic power') || message.includes('motor power') || message.includes('power (vcc) is missing')) {
        return { remediation: 'Connect the required power rail.', autoFixable: true };
    }

    if (message.includes('ground connection is missing') || message.includes('ground (gnd) is missing')) {
        return { remediation: 'Connect the component ground to the common ground rail.', autoFixable: true };
    }

    if (message.includes('reverse bias') || message.includes('reverse polarity')) {
        return { remediation: 'Flip the component orientation to match the expected polarity.', autoFixable: false };
    }

    if (message.includes('over-voltage') || message.includes('exceeds') || message.includes('fried') || message.includes('burn')) {
        return { remediation: 'Lower the applied voltage or add level shifting/current limiting.', autoFixable: false };
    }

    if (message.includes('signal/output pins are connected') || message.includes('no signal') || message.includes('no pins are connected')) {
        return { remediation: 'Connect the required signal pins to the driving circuit.', autoFixable: true };
    }

    return { remediation: null, autoFixable: false };
}

export function normalizeValidationSeverity(severity, fallback = 'error') {
    const normalized = String(severity || '').toLowerCase().trim();

    if (normalized === 'warning') return 'warn';
    if (VALID_SEVERITIES.has(normalized)) return normalized;
    return normalizeValidationSeverity(fallback, 'error');
}

export function createValidationIssue(issue) {
    const inferred = inferValidationRemediation(issue);
    const compIds = Array.isArray(issue?.compIds)
        ? issue.compIds.map(id => String(id || '').trim()).filter(Boolean)
        : issue?.componentId
            ? [String(issue.componentId).trim()].filter(Boolean)
            : [];

    const severity = normalizeValidationSeverity(issue?.severity || issue?.type || 'error');
    const remediation = issue?.remediation || inferred.remediation || null;

    return {
        id: issue?.id || issue?.ruleId || null,
        ruleId: issue?.ruleId || issue?.id || null,
        severity,
        type: severity,
        message: String(issue?.message || '').trim(),
        compIds,
        remediation,
        autoFix: Boolean(issue?.autoFix ?? inferred.autoFixable),
        componentId: issue?.componentId || (compIds.length === 1 ? compIds[0] : null),
        source: issue?.source || null,
        priority: Number.isFinite(Number(issue?.priority)) ? Number(issue.priority) : null,
        details: issue?.details || null,
    };
}

export function validateComponentManifest(manifest) {
    const errors = [];

    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        errors.push('Manifest must be an object.');
        return { valid: false, errors };
    }

    const manifestObject = manifest;

    if (typeof manifestObject.type !== 'string' || !manifestObject.type.trim()) {
        errors.push('Manifest.type must be a non-empty string.');
    }

    if (typeof manifestObject.label !== 'string' || !manifestObject.label.trim()) {
        errors.push('Manifest.label must be a non-empty string.');
    }

    if (!Number.isFinite(Number(manifestObject.w))) {
        errors.push('Manifest.w must be a finite number.');
    }

    if (!Number.isFinite(Number(manifestObject.h))) {
        errors.push('Manifest.h must be a finite number.');
    }

    if (!Array.isArray(manifestObject.pins)) {
        errors.push('Manifest.pins must be an array.');
    } else {
        manifestObject.pins.forEach((pin, index) => {
            if (!pin || typeof pin !== 'object' || Array.isArray(pin)) {
                errors.push(`Manifest.pins[${index}] must be an object.`);
                return;
            }

            if (typeof pin.id !== 'string' || !pin.id.trim()) {
                errors.push(`Manifest.pins[${index}].id must be a non-empty string.`);
            }

            if (typeof pin.type !== 'string' || !pin.type.trim()) {
                errors.push(`Manifest.pins[${index}].type must be a non-empty string.`);
            }
        });
    }

    if (manifestObject.attrs !== undefined && (typeof manifestObject.attrs !== 'object' || manifestObject.attrs === null || Array.isArray(manifestObject.attrs))) {
        errors.push('Manifest.attrs must be an object when provided.');
    }

    if (manifestObject.validation !== undefined) {
        const validation = manifestObject.validation;
        if (!validation || typeof validation !== 'object' || Array.isArray(validation)) {
            errors.push('Manifest.validation must be an object when provided.');
        } else if (!Array.isArray(validation.rules)) {
            errors.push('Manifest.validation.rules must be an array when validation is provided.');
        }
    }

    if (manifestObject.contextMenuDuringRun !== undefined && typeof manifestObject.contextMenuDuringRun !== 'boolean') {
        errors.push('Manifest.contextMenuDuringRun must be a boolean when provided.');
    }

    if (manifestObject.contextMenuOnlyDuringRun !== undefined && typeof manifestObject.contextMenuOnlyDuringRun !== 'boolean') {
        errors.push('Manifest.contextMenuOnlyDuringRun must be a boolean when provided.');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

export function validateComponentModuleDefinition(definition) {
    const errors = [];

    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
        errors.push('Component module must be an object.');
        return { valid: false, errors };
    }

    if (!definition.manifest) {
        errors.push('Component module must export a manifest.');
    } else {
        const manifestResult = validateComponentManifest(definition.manifest);
        errors.push(...manifestResult.errors.map(error => `manifest: ${error}`));
    }

    if (definition.validation !== undefined) {
        const validation = definition.validation;
        if (!validation || typeof validation !== 'object' || Array.isArray(validation)) {
            errors.push('Component module validation must be an object when provided.');
        } else if (!Array.isArray(validation.rules)) {
            errors.push('Component module validation.rules must be an array when validation is provided.');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}