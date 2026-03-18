export const validation = {
    rules: [
        {
            name: "7-Segment Check",
            check: (component: any, graph: Map<string, string[]>) => {
                // Return null if no warnings. Future rules for missing resistors can go here.
                return null;
            }
        }
    ]
};