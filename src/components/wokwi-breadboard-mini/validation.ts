export function validate(component: any, wires: any[]) {
    // Mini breadboards generally don't have validation errors.
    return { warnings: [], errors: [] };
}
