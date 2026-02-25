import Editor from '@monaco-editor/react';

const DEFAULT_CODE = `// OpenHW Studio — Arduino Sketch
// Write your code here

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Hello, OpenHW Studio!");
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`;

function CodeEditor({ onClose }) {
    return (
        <div className="code-editor-panel">
            <div className="code-editor-header">
                <span className="code-editor-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                    </svg>
                    sketch.ino
                </span>
                <button className="code-editor-close" onClick={onClose} title="Close editor">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
            <div className="code-editor-body">
                <Editor
                    defaultLanguage="cpp"
                    defaultValue={DEFAULT_CODE}
                    theme="vs-light"
                    options={{
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        renderLineHighlight: 'line',
                        padding: { top: 12 },
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'on',
                        bracketPairColorization: { enabled: true },
                        smoothScrolling: true,
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                    }}
                />
            </div>
        </div>
    );
}

export default CodeEditor;
