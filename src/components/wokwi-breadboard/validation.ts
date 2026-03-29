export function validate(component: any, wires: any[]) {
    // Breadboards generally don't have validation errors since any pin can connect anywhere natively.
    return { warnings: [], errors: [] };
}
