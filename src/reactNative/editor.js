// Editor: Monaco, templates, and Babel compile into the simulator.
// ==========================================
// 0. SMALL HELPERS + CONSOLE (installed first)
// ==========================================
const safeStringify = (v) => {
  try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
};

const formatConsoleArgs = (args) => {
  let list = [...args];
  if (typeof list[0] === 'string' && /%[sdifoOjc]/.test(list[0])) {
    const first = list.shift();
    const replaced = first.replace(/%[sdifoOjc]/g, (m) => {
      if (!list.length) return m;
      const v = list.shift();
      if (m === '%c') return '';
      return typeof v === 'object' && v !== null ? safeStringify(v) : String(v);
    });
    list = [replaced, ...list];
  }
  return list.map((a) => {
    if (a instanceof Error) return a.message;
    if (typeof a === 'object' && a !== null) return safeStringify(a);
    return String(a);
  }).join(' ');
};

// FIX: console is intercepted immediately (was window.onload, so early logs/errors were lost)
const installConsole = () => {
  const logContainer = document.getElementById('console-logs');
  const logCountBadge = document.getElementById('log-count');
  let count = 0;
  const original = { log: console.log, warn: console.warn, error: console.error, info: console.info };

  const appendLog = (type, args) => {
    count++;
    logCountBadge.innerText = count;

    let color = 'text-slate-300';
    let icon = 'fa-circle-info text-cyan-400';
    if (type === 'error') { color = 'text-rose-400'; icon = 'fa-circle-xmark text-rose-500'; }
    else if (type === 'warn') { color = 'text-amber-300'; icon = 'fa-triangle-exclamation text-amber-400'; }

    const item = document.createElement('div');
    item.className = 'flex items-start gap-2 border-b border-slate-900/50 pb-1';

    const i = document.createElement('i');
    i.className = `fa-solid ${icon} text-[10px] mt-1`;

    // FIX: textContent instead of innerHTML so messages can't break the layout
    const span = document.createElement('span');
    span.className = `${color} flex-1 break-all whitespace-pre-wrap`;
    span.textContent = formatConsoleArgs(args);

    item.appendChild(i);
    item.appendChild(span);
    logContainer.appendChild(item);
    logContainer.scrollTop = logContainer.scrollHeight;
  };

  ['log', 'info', 'warn', 'error'].forEach((method) => {
    console[method] = (...args) => {
      try { original[method].apply(console, args); } catch (e) {}
      appendLog(method === 'info' ? 'log' : method, args);
    };
  });

  window.addEventListener('error', (e) => appendLog('error', [e.message || 'Script error']));
  window.addEventListener('unhandledrejection', (e) => appendLog('error', ['Unhandled promise rejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)]));
};
installConsole();



// ==========================================
// 2. TEMPLATES PRESETS
// ==========================================
const TEMPLATES = {
  basic: `import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function App() {
  return (
<View style={styles.container}>
  <View style={styles.card}>
    <Text style={styles.title}>Hello React Native!</Text>
    <Text style={styles.subtitle}>
      Build native UI across iOS, Android, and Web seamlessly.
    </Text>
    
    <TouchableOpacity 
      style={styles.button}
      onPress={() => console.log('Welcome Button Pressed!')}
    >
      <Text style={styles.buttonText}>Get Started</Text>
    </TouchableOpacity>
  </View>
</View>
  );
}

const styles = StyleSheet.create({
  container: {
flex: 1,
justifyContent: 'center',
alignItems: 'center',
padding: 20,
backgroundColor: '#f8fafc',
  },
  card: {
backgroundColor: '#ffffff',
padding: 24,
borderRadius: 16,
width: '100%',
shadowColor: '#000',
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.1,
shadowRadius: 12,
elevation: 5,
  },
  title: {
fontSize: 22,
fontWeight: 'bold',
color: '#0f172a',
marginBottom: 8,
  },
  subtitle: {
fontSize: 14,
color: '#64748b',
lineHeight: 20,
marginBottom: 20,
  },
  button: {
backgroundColor: '#0284c7',
paddingVertical: 12,
borderRadius: 10,
alignItems: 'center',
  },
  buttonText: {
color: '#ffffff',
fontWeight: '600',
fontSize: 15,
  },
});`,


   };

// ==========================================
// 3. EDITOR STATE
// ==========================================
let editor = null;
let compileDebounceTimer = null;
let isConsoleOpen = true;
let reactRoot = null;


const MONACO_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min';

// FIX: Monaco web workers can't be created cross-origin from a CDN without this proxy
window.MonacoEnvironment = {
  getWorkerUrl: function () {
    const code = "self.MonacoEnvironment = { baseUrl: '" + MONACO_BASE + "/' };" +
                 "importScripts('" + MONACO_BASE + "/vs/base/worker/workerMain.js');";
    return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(code);
  }
};

function scheduleRun() {
  clearTimeout(compileDebounceTimer);
  compileDebounceTimer = setTimeout(runCode, 600);
}

function setEngineLabel(text) {
  const el = document.getElementById('editor-engine');
  if (el) el.textContent = text;
}

// ---- Monaco editor ----
function createMonacoEditor() {
  if (editor) return;
  const container = document.getElementById('monaco-editor');
  container.innerHTML = '';

  const ts = monaco.languages.typescript;
  ts.javascriptDefaults.setCompilerOptions({
    jsx: ts.JsxEmit.React,
    allowNonTsExtensions: true,
    allowJs: true,
    target: ts.ScriptTarget.ES2020
  });
  // Imports like 'react-native' have no types here, so skip semantic errors but keep syntax errors
  ts.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });

  const model = monaco.editor.createModel(TEMPLATES.basic, 'javascript', monaco.Uri.parse('file:///App.jsx'));

  editor = monaco.editor.create(container, {
    model,
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 13,
    fontFamily: 'Fira Code, monospace',
    minimap: { enabled: false },
    padding: { top: 12 },
    scrollBeyondLastLine: false,
    tabSize: 2
  });

  editor.onDidChangeModelContent(scheduleRun);
  setEngineLabel('Monaco');
  runCode();
}

// ---- Plain textarea fallback (used if Monaco can't load: offline, CDN blocked, etc.) ----
function createFallbackEditor() {
  if (editor) return;
  const container = document.getElementById('monaco-editor');
  container.innerHTML = '';

  const ta = document.createElement('textarea');
  ta.className = 'absolute inset-0 w-full h-full bg-editorBg text-slate-200 font-mono text-[13px] leading-5 p-3 outline-none resize-none';
  ta.spellcheck = false;
  ta.value = TEMPLATES.basic;

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 2;
      scheduleRun();
    }
  });
  ta.addEventListener('input', scheduleRun);
  container.appendChild(ta);

  editor = {
    getValue: () => ta.value,
    setValue: (v) => { ta.value = v; },
    isFallback: true
  };
  setEngineLabel('Basic editor (Monaco unavailable)');
  console.warn('Monaco editor could not be loaded, using the basic editor instead.');
  runCode();
}

// Boot: try Monaco, fall back to textarea
function bootEditor() {
  const fallbackTimer = setTimeout(createFallbackEditor, 8000);

  if (typeof require !== 'undefined' && typeof require.config === 'function') {
    require.config({ paths: { vs: MONACO_BASE + '/vs' } });
    require(['vs/editor/editor.main'], function () {
      clearTimeout(fallbackTimer);
      createMonacoEditor();
    }, function () {
      clearTimeout(fallbackTimer);
      createFallbackEditor();
    });
  } else {
    clearTimeout(fallbackTimer);
    createFallbackEditor();
  }
}
// Run after the whole script has initialised (avoids using variables before they exist)
setTimeout(bootEditor, 0);

// ==========================================
// 4. BABEL TRANSPILATION & RUNTIME EXECUTION
// ==========================================

// FIX: render-time errors happen after render() returns, so try/catch alone never saw them
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error(error.message);
  }
  render() {
    if (this.state.error) {
      return React.createElement('div', {
        style: { padding: '16px', backgroundColor: '#fef2f2', color: '#991b1b', fontFamily: 'monospace', fontSize: '12px', minHeight: '100%' }
      },
        React.createElement('div', { style: { fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' } }, '⚠️ Runtime Error'),
        React.createElement('pre', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#fee2e2', padding: '10px', borderRadius: '6px', margin: 0 } }, String(this.state.error.message))
      );
    }
    return this.props.children;
  }
}

function runCode() {
  if (!editor) return;

  const code = editor.getValue();
  const mountNode = document.getElementById('app-root');

  // Tear down previous render (React 18 root API)
  if (reactRoot) {
    try { reactRoot.unmount(); } catch (e) {}
    reactRoot = null;
  }
  mountNode.innerHTML = '';
  if (window.setStatusBar) window.setStatusBar(null);

  try {
    if (typeof Babel === 'undefined') {
      throw new Error('Babel failed to load. Check your internet connection and reload the page.');
    }

    const transformed = Babel.transform(code, {
      presets: [
        ['env', { modules: 'commonjs' }],
        ['react', { runtime: 'classic' }]
      ],
      sourceType: 'module',
      filename: 'App.jsx'
    }).code;

    const customRequire = (moduleName) => {
      if (moduleName === 'react') return window.React;
      if (window.RNComponents.__modules[moduleName]) return window.RNComponents.__modules[moduleName];
      if (moduleName === 'react-native' || moduleName === 'react-native-web') return window.RNComponents;
      throw new Error(`Module '${moduleName}' is not supported in this browser sandbox.`);
    };

    const exports = {};
    const module = { exports };

    const runFn = new Function('require', 'module', 'exports', 'React', transformed);
    runFn(customRequire, module, exports, window.React);

    const App = (module.exports && module.exports.default) || exports.default;

    if (!App) {
      throw new Error("No 'default export' found in App.jsx. Ensure you have 'export default function App()'.");
    }

    reactRoot = ReactDOM.createRoot(mountNode);
    reactRoot.render(
      window.React.createElement(ErrorBoundary, null, window.React.createElement(App))
    );
    setTimeout(paintStatusBar, 100);

  } catch (err) {
    console.error(err.message);

    mountNode.innerHTML = `
      <div style="padding: 16px; background-color: #fef2f2; color: #991b1b; font-family: monospace; font-size: 12px; min-height: 100%; overflow-y: auto;">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">⚠️ Compilation Error</div>
        <pre style="white-space: pre-wrap; word-break: break-all; background: #fee2e2; padding: 10px; border-radius: 6px; margin: 0;">${escapeHtml(err.message)}</pre>
      </div>
    `;
  }
}

// ==========================================
// 5. UI CONTROLS & UTILITIES
// ==========================================
function loadTemplate(key) {
  if (TEMPLATES[key] && editor) {
    editor.setValue(TEMPLATES[key]);
    runCode();
  }
}

function formatCode() {
  if (!editor || typeof editor.getAction !== 'function') {
    console.warn('Format is only available with the Monaco editor.');
    return;
  }
  const action = editor.getAction('editor.action.formatDocument');
  if (action) action.run();
}

function clearConsole() {
  const logContainer = document.getElementById('console-logs');
  logContainer.innerHTML = '<div class="text-slate-500 italic text-[11px]">[System]: Console cleared...</div>';
  document.getElementById('log-count').innerText = '0';
}

function toggleConsole() {
  const dock = document.getElementById('console-dock');
  const icon = document.getElementById('console-toggle-icon');

  if (isConsoleOpen) {
    dock.style.height = '32px';
    icon.className = 'fa-solid fa-chevron-up';
  } else {
    dock.style.height = '144px';
    icon.className = 'fa-solid fa-chevron-down';
  }
  isConsoleOpen = !isConsoleOpen;
}
