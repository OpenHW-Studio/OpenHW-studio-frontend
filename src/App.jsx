import { useState } from 'react';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import CodeEditor from './components/CodeEditor';

function App() {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="app">
      <Toolbar onCodeToggle={() => setShowCode(prev => !prev)} isCodeOpen={showCode} />
      <div className="app-body">
        <Sidebar />
        <Canvas />
        {showCode && <CodeEditor onClose={() => setShowCode(false)} />}
      </div>
    </div>
  );
}

export default App;
