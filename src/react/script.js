/* ==================== INITIAL CODE ==================== */
const defaultCode = `
// don't use export  editort internaly handing that  
import React from "react";

function App() {
  const [count, setCount] = React.useState(0);
  const [text, setText] = React.useState("");

  return (
    <div style={{ padding: 20 }}>
      
     <p>hello world</p>
    </div>
  );
}`;

let currentCode = defaultCode;
let errorDecorations = [];
let editor;

/* ==================== MONACO EDITOR SETUP ==================== */
require.config({
  paths: { vs: "https://unpkg.com/monaco-editor@0.45.0/min/vs" }
});

require(["vs/editor/editor.main"], () => {
  // Configure TypeScript compiler options
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: "React",
    allowJs: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    noImplicitReturns: false,
    noFallthroughCasesInSwitch: false,
    strict: false,
    strictNullChecks: false,
    strictFunctionTypes: false,
    strictBindCallApply: false,
    strictPropertyInitialization: false,
    noImplicitAny: false,
    noImplicitThis: false,
    alwaysStrict: false,
    diagnosticOptions: {
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
    }
  });

  // Set diagnostic options to ignore specific warnings
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [6133, 6138, 6192, 6196, 6198, 6199, 6137]
  });

  // Add React type definitions
  const reactTypes = `
declare namespace React {
  function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prevState: T) => T)) => void];
  function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  function useRef<T>(initialValue: T): { current: T };
  function useContext<T>(context: any): T;
  function useReducer<R, I>(reducer: (state: R, action: any) => R, initializerArg: I, initializer?: (arg: I) => R): [R, (action: any) => void];
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  
  function createElement<P = {}>(
    type: string | ComponentType<P>,
    props?: P | null,
    ...children: ReactNode[]
  ): ReactElement<P>;
  
  type ReactNode = string | number | boolean | ReactElement | null | undefined;
  
  interface ReactElement<P = any, T extends string | ComponentType<any> = string | ComponentType<any>> {
    type: T;
    props: P;
    key: string | null;
  }
  
  interface Component<P = {}, S = {}> {
    props: P;
    state: S;
  }
  
  interface FunctionComponent<P = {}> {
    (props: P): ReactElement | null;
  }
  
  interface ComponentClass<P = {}, S = {}> {
    new (props: P): Component<P, S>;
  }
  
  type ComponentType<P = {}> = FunctionComponent<P> | ComponentClass<P>;
  
  const Fragment: ComponentType<{ children?: ReactNode }>;
}

declare const React: typeof React;

declare module "react" {
  export = React;
  export as namespace React;
}`;

  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    reactTypes,
    'file:///node_modules/@types/react/index.d.ts'
  );

  // Define custom theme
  monaco.editor.defineTheme('react-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'jsx-tag', foreground: '4FC1FF' },
      { token: 'jsx-attribute', foreground: '9CDCFE' },
    ],
    colors: {
      'editor.background': '#0a0e27',
      'editor.foreground': '#e5e7eb',
      'editor.lineHighlightBackground': '#1a1d2e80',
      'editorCursor.foreground': '#61dafb',
      'editor.selectionBackground': '#61dafb40',
      'editor.lineHighlightBorder': '#61dafb20',
      'editorSuggestWidget.background': '#1a1d2e',
      'editorSuggestWidget.border': '#61dafb20',
      'editorSuggestWidget.selectedBackground': '#61dafb30',
    }
  });

  // Create editor instance
  editor = monaco.editor.create(document.getElementById("editor"), {
    value: currentCode,
    language: "typescript",
    theme: "react-dark",
    automaticLayout: true,
    minimap: { enabled: true },
    fontSize: 14,
    scrollBeyondLastLine: false,
    lineNumbers: "on",
    wordWrap: 'on',
    wrappingIndent: 'same',
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible'
    }
  });

  // Track changes
  editor.getModel().onDidChangeContent(() => {
    currentCode = editor.getValue();
    updateStatus("typing");
    clearErrors();
  });

  // Error checking
  let checkTimeout;
  editor.onDidChangeModelContent(() => {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(checkRealErrors, 800);
  });
});

/* ==================== ERROR CHECKING ==================== */
function checkRealErrors() {
  if (!editor) return;

  const model = editor.getModel();
  const markers = monaco.editor.getModelMarkers({ resource: model.uri });

  errorDecorations = editor.deltaDecorations(errorDecorations, []);

  const ignoredCodes = [6133, 6138, 6192, 6196, 6198, 6199, 6137];
  const realErrors = markers.filter(marker =>
    !ignoredCodes.includes(marker.code?.number || 0)
  );

  if (realErrors.length > 0) {
    const newDecorations = realErrors.map(marker => ({
      range: new monaco.Range(
        marker.startLineNumber,
        marker.startColumn,
        marker.endLineNumber,
        marker.endColumn
      ),
      options: {
        className: 'error-line',
        hoverMessage: { value: marker.message },
        glyphMarginClassName: 'error-glyph',
        overviewRuler: {
          color: '#ef4444',
          position: monaco.editor.OverviewRulerLane.Right
        }
      }
    }));

    errorDecorations = editor.deltaDecorations(errorDecorations, newDecorations);

    const firstError = realErrors[0];
    if (firstError) {
      const consoleDiv = document.getElementById("console");
      consoleDiv.innerHTML = `<span class="console-line error">> ❌ TypeScript Error (Line ${firstError.startLineNumber}): ${firstError.message}</span>`;
      updateStatus("error");
    }
  } else {
    clearErrors();
    updateStatus("typing");
  }
}

function clearErrors() {
  if (editor) {
    errorDecorations = editor.deltaDecorations(errorDecorations, []);
  }
  document.getElementById("error").style.display = "none";
}

languageList.addEventListener("click", (e) => {
  const item = e.target.closest("li");
  if (!item) return;

  const langKey = item.dataset.lang; // "javascript", "typescript", etc.
  if (!langKey) return;

  console.log("Selected language:", langKey);
  language = langKey

  // UI: active state
  document
    .querySelectorAll("#languageList li")
    .forEach(li => li.classList.remove("active"));

  item.classList.add("active");

  // // Switch Monaco language
  switchLanguage(langKey);
});

function switchLanguage(lang) {


  switch (lang) {
    case "javascript":
      window.location.href = "/src/editor/index.html";
      break;

    case "typescript":
      window.location.href = "/src/typescript/index.html"; // Leading slash!
      break;

    case "html":
      window.location.href = "/src/html/index.html";
      break;
    case "react":
      window.location.href = "/src/react/index.html";
      break;
    case "json":
      window.location.href = "/src/jsonformatter/index.html";
      break;


    default:
      console.warn(`No runner defined for ${lang}`);
  }
}
const toggle = document.getElementById("autoExecuteToggle");
const label = document.getElementById("autoExecuteLabel");
/* ==================== STATUS UPDATER ==================== */
function updateStatus(status) {
  const indicator = document.getElementById("status-indicator");
  if (!indicator) return;

  switch (status) {
    case "ready":
      indicator.className = "status-item ready";
      indicator.innerHTML = '<span>● Ready</span>';
      break;
    case "running":
      indicator.className = "status-item running";
      indicator.innerHTML = '<span>⏳ Running...</span>';
      break;
    case "error":
      indicator.className = "status-item error";
      indicator.innerHTML = '<span>● Error</span>';
      break;
    case "typing":
      indicator.className = "status-item typing";
      indicator.innerHTML = '<span>● Modified</span>';
      break;
  }
}

/* ==================== FIXED COMPILATION ==================== */
function compile() {
  if (typeof Babel === 'undefined') {
    throw new Error('Babel is not loaded. Please wait and try again.');
  }

  try {
    // Clean the code
    let codeToCompile = currentCode;

    // Check if there's an App component
    const hasAppComponent = codeToCompile.includes('function App') ||
      codeToCompile.includes('const App =') ||
      codeToCompile.includes('class App');

    if (!hasAppComponent) {
      throw new Error('No App component found. Please define a function/class named "App".');
    }

    // Transpile the code
    const result = Babel.transform(codeToCompile, {
      presets: ['react'],
      filename: 'App.jsx'
    });

    if (!result.code) {
      throw new Error('Babel transformation failed');
    }

    // Process the transpiled code
    let processedCode = result.code;

    // Remove import statements (React is loaded globally)
    processedCode = processedCode.replace(/import\s+.*?from\s+['"][^'"]+['"];?\n?/g, '');

    // Check if App is properly exported/available
    if (!processedCode.includes('window.App') && !processedCode.includes('App =')) {
      // Wrap in IIFE to capture App
      processedCode = `(function() {
        ${processedCode}
        // Make App available globally
        if (typeof App !== 'undefined') {
          window.App = App;
        } else if (typeof exports !== 'undefined' && exports.default) {
          window.App = exports.default;
        } else if (typeof module !== 'undefined' && module.exports) {
          window.App = module.exports.default || module.exports;
        }
      })();`;
    }

    return createPreviewHTML(processedCode);
  } catch (error) {
    throw new Error(`Compilation failed: ${error.message}`);
  }
}

/* ==================== FIXED PREVIEW HTML ==================== */
function createPreviewHTML(appCode) {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>React Preview</title>
    <style>
        body { 
            margin: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f8fafc;
        }
        #root { 
            min-height: 100vh;
            padding: 20px;
        }
        * { 
            box-sizing: border-box;
        }
    </style>
</head>
<body>
    <div id="root">
        <div style="padding: 40px; text-align: center; color: #666;">
            Loading React app...
        </div>
    </div>

    <script>
        // Console redirection
        (function() {
            const originalLog = console.log;
            const originalError = console.error;

            console.log = (...args) => {
                try {
                    parent.postMessage({ 
                        type: 'log', 
                        args: args.map(arg => {
                            if (typeof arg === 'object' && arg !== null) {
                                try {
                                    return JSON.stringify(arg, null, 2);
                                } catch {
                                    return String(arg);
                                }
                            }
                            return String(arg);
                        })
                    }, '*');
                } catch(e) {}
                originalLog(...args);
            };

            console.error = (...args) => {
                try {
                    parent.postMessage({ type: 'error', args: args.map(String) }, '*');
                } catch(e) {}
                originalError(...args);
            };
        })();
    <\/script>

    <!-- Load React & ReactDOM -->
    <script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>

    <!-- Compiled App Code -->
    <script>
        try {
            // Execute the transpiled code
            ${appCode}
            
            // Check if React is loaded
            if (!window.React || !window.ReactDOM) {
                throw new Error('React or ReactDOM not loaded');
            }
            
            // Check if App component is available
            if (!window.App) {
                throw new Error('App component not found. Make sure you have a function called "App".');
            }
            
            // Get root container
            const container = document.getElementById('root');
            if (!container) {
                throw new Error('Root element not found');
            }
            
            // Render the app
            const root = window.ReactDOM.createRoot(container);
            root.render(window.React.createElement(window.App));
            
        } catch (error) {
            console.error('Failed to render React app:', error);
            const container = document.getElementById('root');
            if (container) {
                container.innerHTML = '<div style="color: #ef4444; padding: 20px; font-family: monospace;">' +
                                    '<h3>❌ Render Error</h3>' +
                                    '<p>' + error.message + '</p>' +
                                    '<p>Check the console for details.</p>' +
                                    '</div>';
            }
        }
    <\/script>
</body>
</html>`;
}

/* ==================== RUN FUNCTION ==================== */
function run() {
  updateStatus("running");
  const errorDiv = document.getElementById("error");
  const consoleDiv = document.getElementById("console");
  errorDiv.style.display = "none";
  consoleDiv.innerHTML = '<span class="console-line info">> Running...</span>';

  try {
    checkRealErrors();
    const compiledHtml = compile();

    const iframe = document.getElementById("preview");
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(compiledHtml);
    iframeDoc.close();

    setTimeout(() => {
      consoleDiv.innerHTML += '<span class="console-line log">> ✓ Code executed successfully!</span>';
      updateStatus("ready");
    }, 400);

  } catch (err) {
    showError(err.message);
    updateStatus("error");
  }
}

/* ==================== CONSOLE & ERROR HANDLING ==================== */
window.addEventListener("message", (e) => {
  if (!e.data || !e.data.type) return;

  const consoleDiv = document.getElementById("console");
  const lineClass = e.data.type === 'error' ? 'error' : 'log';
  const prefix = e.data.type === 'error' ? '> ❌' : '>';

  const line = document.createElement('div');
  line.className = `console-line ${lineClass}`;
  line.textContent = `${prefix} ${e.data.args?.join(' ') || 'Unknown message'}`;

  consoleDiv.appendChild(line);
  consoleDiv.scrollTop = consoleDiv.scrollHeight;
});

function showError(msg) {
  const errorDiv = document.getElementById("error");
  const consoleDiv = document.getElementById("console");

  errorDiv.style.display = "block";
  errorDiv.textContent = "❌ " + msg;

  const errorLine = document.createElement('div');
  errorLine.className = 'console-line error';
  errorLine.textContent = `> ❌ ${msg}`;
  consoleDiv.appendChild(errorLine);
  consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

function clearConsole() {
  const consoleDiv = document.getElementById("console");
  const errorDiv = document.getElementById("error");

  consoleDiv.innerHTML = '<span class="console-line info">> Console cleared</span>';
  errorDiv.style.display = "none";
  updateStatus("ready");
}

/* ==================== SHARE FUNCTION ==================== */
function share() {
  try {
    const encoded = btoa(encodeURIComponent(currentCode));
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;

    navigator.clipboard.writeText(url).then(() => {
      showNotification("📋 Link copied to clipboard!");
    }).catch(() => {
      prompt("Copy this URL to share:", url);
    });

  } catch (err) {
    alert("Could not generate share link: " + err.message);
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

/* ==================== RESET FUNCTION ==================== */
function resetCode() {
  if (confirm("Reset to default code? Your changes will be lost.")) {
    if (editor) {
      editor.setValue(defaultCode);
      currentCode = defaultCode;
      clearErrors();
      updateStatus("ready");
      run();
    }
  }
}

/* ==================== FORMAT CODE FUNCTION ==================== */
function formatCode() {
  if (!editor) return;

  const consoleDiv = document.getElementById("console");

  try {
    editor.getAction('editor.action.formatDocument').run();
    consoleDiv.innerHTML += '<span class="console-line log">> ✓ Code formatted</span>';
    updateStatus("ready");
  } catch (err) {
    consoleDiv.innerHTML += '<span class="console-line warn">> ⚠️ Formatting not available</span>';
  }
}

/* ==================== LOAD FROM URL ==================== */
window.addEventListener("load", () => {
  updateStatus("running");

  const initInterval = setInterval(() => {
    if (typeof monaco !== 'undefined' && typeof Babel !== 'undefined') {
      clearInterval(initInterval);

      if (location.hash && location.hash.length > 1) {
        try {
          const decoded = decodeURIComponent(atob(location.hash.slice(1)));
          if (decoded && decoded.trim().length > 10) {
            if (editor) {
              editor.setValue(decoded);
              currentCode = decoded;
            }
            const consoleDiv = document.getElementById("console");
            consoleDiv.innerHTML = '<span class="console-line info">> Loaded code from URL</span>';
          }
        } catch (err) {
          const consoleDiv = document.getElementById("console");
          consoleDiv.innerHTML = '<span class="console-line warn">> Could not load code from URL</span>';
        }
      }

      setTimeout(() => {
        if (editor) {
          run();
        }
        updateStatus("ready");
      }, 500);
    }
  }, 100);
});

// Add event listeners for buttons
document.addEventListener('DOMContentLoaded', () => {
  // Ensure buttons work even if script loads before DOM
  setTimeout(() => {
    const runBtn = document.querySelector('button[onclick="run()"]');
    if (runBtn) {
      runBtn.onclick = run;
    }

    const shareBtn = document.querySelector('button[onclick="share()"]');
    if (shareBtn) {
      shareBtn.onclick = share;
    }

    const resetBtn = document.querySelector('button[onclick="resetCode()"]');
    if (resetBtn) {
      resetBtn.onclick = resetCode;
    }

    const formatBtn = document.querySelector('button[onclick="formatCode()"]');
    if (formatBtn) {
      formatBtn.onclick = formatCode;
    }

    const clearBtn = document.querySelector('button.clear-btn');
    if (clearBtn) {
      clearBtn.onclick = clearConsole;
    }
  }, 100);
});