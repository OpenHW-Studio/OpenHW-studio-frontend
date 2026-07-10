import { loader } from '@monaco-editor/react';

/**
 * Configure Monaco Editor to use local workers and a custom theme
 * that matches the OpenHW Studio aesthetic.
 */
export const configureMonaco = () => {
  loader.config({
    // You can specify a CDN here if you want to avoid bundling workers,
    // but for stability we'll let @monaco-editor/react handle it.
  });

  loader.init().then((monaco) => {
    // Define a custom theme that matches our CSS variables
    monaco.editor.defineTheme('openhw-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4d6380', fontStyle: 'italic' },
        { token: 'keyword', foreground: '00d4ff', fontStyle: 'bold' },
        { token: 'string', foreground: '00e676' },
        { token: 'number', foreground: 'ff9100' },
        { token: 'type', foreground: 'a855f7' },
        { token: 'function', foreground: '00d4ff' },
      ],
      colors: {
        'editor.background': '#070b14', // --bg
        'editor.foreground': '#e8edf5', // --text
        'editorLineNumber.foreground': '#4d6380', // --text3
        'editor.selectionBackground': '#1e2d47', // --border
        'editor.lineHighlightBackground': '#0d1525', // --bg2
        'editorCursor.foreground': '#00d4ff', // --accent
        'editorWhitespace.foreground': '#1e2d47',
        'editorIndentGuide.background': '#1e2d47',
        'editorIndentGuide.activeBackground': '#00d4ff',
      },
    });

    monaco.editor.defineTheme('openhw-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: '0284c7', fontStyle: 'bold' },
        { token: 'string', foreground: '059669' },
        { token: 'number', foreground: 'ea580c' },
        { token: 'type', foreground: '7c3aed' },
        { token: 'function', foreground: '0284c7' },
      ],
      colors: {
        'editor.background': '#f8fafc', // --bg
        'editor.foreground': '#0f172a', // --text
        'editorLineNumber.foreground': '#64748b', // --text3
        'editor.selectionBackground': '#cbd5e1', // --border
        'editor.lineHighlightBackground': '#e6e7eb', // --bg2
        'editorCursor.foreground': '#0284c7', // --accent
        'editorWhitespace.foreground': '#cbd5e1',
        'editorIndentGuide.background': '#cbd5e1',
        'editorIndentGuide.activeBackground': '#0284c7',
      },
    });
  });
};
