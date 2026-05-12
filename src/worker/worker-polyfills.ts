if (typeof window === 'undefined') {
    (self as any).window = self;
    (self as any).document = {
        createElement: () => ({ style: {} }),
        getElementsByTagName: () => [],
        createTextNode: () => ({}),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
    };
}
// Stub out React Refresh hooks used by Vite HMR
(self as any).$RefreshReg$ = () => {};
(self as any).$RefreshSig$ = () => () => (type: any) => type;
