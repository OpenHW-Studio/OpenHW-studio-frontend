export type ValidationSeverity = 'error' | 'warn' | 'info';

export interface ValidationIssue {
    id?: string | null;
    ruleId?: string | null;
    severity: ValidationSeverity;
    type?: ValidationSeverity;
    message: string;
    compIds?: string[];
    remediation?: string | null;
    autoFix?: boolean;
    componentId?: string | null;
    source?: string | null;
    priority?: number | null;
    details?: Record<string, any> | null;
}

export interface ComponentValidationRule {
    id: string;
    name?: string;
    severity?: ValidationSeverity;
    priority?: number;
    description?: string;
    autoFixable?: boolean;
    check: (component: any, graph: Map<string, string[]>, validator: any) => ValidationIssue | ValidationIssue[] | string | null | undefined;
}

export interface ComponentManifestPin {
    id: string;
    x?: number;
    y?: number;
    type?: string;
    description?: string;
}

export interface ComponentManifest {
    type: string;
    label: string;
    description?: string;
    group?: string;
    w: number;
    h: number;
    pins: ComponentManifestPin[];
    attrs?: Record<string, any>;
    telemetry?: {
        template?: string;
        criticalKeys?: string[];
    };
    contextMenuDuringRun?: boolean;
    contextMenuOnlyDuringRun?: boolean;
    validation?: {
        rules: ComponentValidationRule[];
    };
}

export interface ComponentModuleDefinition {
    manifest: ComponentManifest;
    UI?: any;
    LogicClass?: any;
    ContextMenu?: any;
    BOUNDS?: any;
    validation?: {
        rules?: ComponentValidationRule[];
    };
    doc?: string;
    [key: string]: any;
}

export interface ManifestValidationResult {
    valid: boolean;
    errors: string[];
}

export declare function normalizeValidationSeverity(severity: unknown, fallback?: ValidationSeverity): ValidationSeverity;
export declare function inferValidationRemediation(issue: unknown, component?: unknown): { remediation: string | null; autoFixable: boolean };
export declare function createValidationIssue(issue: Partial<ValidationIssue> & Pick<ValidationIssue, 'message'>): ValidationIssue;
export declare function validateComponentManifest(manifest: unknown): ManifestValidationResult;
export declare function validateComponentModuleDefinition(definition: unknown): ManifestValidationResult;