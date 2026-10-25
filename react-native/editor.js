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

// To see a live sample of each supported API, open the Examples app on the home screen.
export default function App() {
  return (
<View style={styles.container}>
  <View style={styles.card}>
    <Text style={styles.title}>Hello React Native!</Text>
    <Text style={styles.subtitle}>
      Build native UI across iOS, Android, and Web seamlessly.
    </Text>
    <Text style={styles.hint}>
      To see examples of Modal, TouchableOpacity, animation, Alert, Toast, and the other supported APIs, open the Examples app on the home screen.
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
marginBottom: 10,
  },
  hint: {
fontSize: 13,
color: '#0369a1',
lineHeight: 18,
marginBottom: 16,
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
// 3. PROJECT FILES
// ==========================================
const RN_PROJECT_KEY = 'suite-rn-project';

function rnStarter() {
  return { version: 1, active: 'App.jsx', open: ['App.jsx'], files: { 'App.jsx': TEMPLATES.basic } };
}

function rnNormalizePath(input) {
  const parts = [];
  for (const part of String(input || '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function loadRnProject() {
  try {
    const saved = JSON.parse(localStorage.getItem(RN_PROJECT_KEY) || '');
    if (saved && saved.files && Object.keys(saved.files).length) {
      const files = {};
      Object.keys(saved.files).forEach((path) => {
        const clean = rnNormalizePath(path);
        if (clean) files[clean] = String(saved.files[path] ?? '');
      });
      let active = rnNormalizePath(saved.active);
      if (!files[active]) active = files['App.jsx'] != null ? 'App.jsx' : Object.keys(files)[0];
      let open = Array.isArray(saved.open) ? saved.open.map(rnNormalizePath).filter((path) => files[path]) : [];
      if (!open.includes(active)) open.unshift(active);
      return { version: 1, active, open, files };
    }
  } catch { /* first visit */ }
  return rnStarter();
}

let rnProject = loadRnProject();
let rnSaveTimer = null;

function saveRnProject() {
  clearTimeout(rnSaveTimer);
  rnSaveTimer = setTimeout(() => {
    try { localStorage.setItem(RN_PROJECT_KEY, JSON.stringify(rnProject)); } catch { /* private mode */ }
  }, 200);
}

function rnDirname(path) {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function resolveRnImport(fromFile, spec, files) {
  if (!spec.startsWith('.')) return null;
  const base = rnNormalizePath((rnDirname(fromFile) ? rnDirname(fromFile) + '/' : '') + spec);
  const candidates = [
    base,
    base + '.jsx', base + '.js', base + '.tsx', base + '.ts', base + '.json',
    base + '/index.jsx', base + '/index.js', base + '/index.tsx', base + '/index.ts'
  ];
  return candidates.find((candidate) => Object.prototype.hasOwnProperty.call(files, candidate)) || null;
}

function relativeRnImport(fromFile, toFile) {
  const from = rnDirname(fromFile).split('/').filter(Boolean);
  const to = toFile.split('/').filter(Boolean);
  let shared = 0;
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared += 1;
  const rel = [...Array(from.length - shared).fill('..'), ...to.slice(shared)].join('/');
  return rel.startsWith('.') ? rel : './' + rel;
}

function findRnEntry(files) {
  const preferred = ['App.jsx', 'App.js', 'App.tsx', 'src/App.jsx', 'src/App.js'];
  const named = preferred.find((path) => Object.prototype.hasOwnProperty.call(files, path));
  if (named) return named;
  return Object.keys(files).find((path) => /(^|\/)App\.(jsx|js|tsx|ts)$/.test(path))
    || Object.keys(files).find((path) => /\.(jsx|js|tsx|ts)$/.test(path) && /\bfunction\s+App\b|\bclass\s+App\b/.test(files[path]))
    || null;
}

function rnEscape(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function rnLanguage(path) {
  if (/\.json$/i.test(path)) return 'json';
  if (/\.tsx?$/i.test(path)) return 'typescript';
  return 'javascript';
}

// ==========================================
// 3b. EDITOR STATE
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
  // Imports like 'react-native' have no types here. Syntax markers are off too:
  // relative paths written without quotes still compile, and Monaco would underline them.
  ts.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });

  Object.keys(rnProject.files).forEach(ensureRnModel);

  editor = monaco.editor.create(container, {
    model: ensureRnModel(rnProject.active),
    theme: (window.suiteMonacoTheme ? suiteMonacoTheme() : 'vs'),
    automaticLayout: true,
    fontSize: 13,
    fontFamily: 'Fira Code, monospace',
    minimap: { enabled: false },
    padding: { top: 12 },
    scrollBeyondLastLine: false,
    tabSize: 2
  });

  setEngineLabel('Monaco');
  applyEditorTheme();
  renderRnFiles();
  runCode();
}

function ensureRnModel(path) {
  const uri = monaco.Uri.parse('file:///' + path);
  let model = monaco.editor.getModel(uri);
  if (model) return model;
  model = monaco.editor.createModel(rnProject.files[path] ?? '', rnLanguage(path), uri);
  model.onDidChangeContent(() => {
    if (model.__silent) return;
    rnProject.files[path] = model.getValue();
    saveRnProject();
    scheduleRun();
  });
  return model;
}

function setRnFileValue(path, value) {
  rnProject.files[path] = value;
  if (typeof monaco === 'undefined' || !monaco.editor) return;
  const model = monaco.editor.getModel(monaco.Uri.parse('file:///' + path));
  if (model && model.getValue() !== value) {
    model.__silent = true;
    model.setValue(value);
    model.__silent = false;
  }
}

function applyEditorTheme() {
  const light = document.documentElement.dataset.ui === 'light';
  if (window.monaco && monaco.editor) monaco.editor.setTheme(light ? 'vs' : 'vs-dark');
  const ta = document.querySelector('#monaco-editor textarea');
  if (ta) {
    ta.style.background = light ? '#ffffff' : '#0d1117';
    ta.style.color = light ? '#0f172a' : '#e2e8f0';
  }
}

function toggleUiTheme() {
  if (typeof suiteToggleTheme === 'function') { suiteToggleTheme(); return; }
  const root = document.documentElement;
  const next = root.dataset.ui === 'light' ? 'dark' : 'light';
  if (next === 'light') root.dataset.ui = 'light';
  else delete root.dataset.ui;
  try { localStorage.setItem('suite-theme', next); } catch (e) {}
  applyEditorTheme();
  syncUiThemeButton();
}

document.addEventListener('suite-theme', () => {
  applyEditorTheme();
  syncUiThemeButton();
});

function syncUiThemeButton() {
  const light = document.documentElement.dataset.ui === 'light';
  const icon = document.getElementById('ui-theme-icon');
  const label = document.querySelector('#ui-theme span');
  if (icon) icon.className = light ? 'fa-solid fa-moon text-slate-600' : 'fa-solid fa-sun text-amber-300';
  if (label) label.textContent = light ? 'Dark' : 'Light';
}

// ---- Plain textarea fallback (used if Monaco can't load: offline, CDN blocked, etc.) ----
function createFallbackEditor() {
  if (editor) return;
  const container = document.getElementById('monaco-editor');
  container.innerHTML = '';

  const ta = document.createElement('textarea');
  ta.className = 'absolute inset-0 w-full h-full bg-editorBg text-slate-200 font-mono text-[13px] leading-5 p-3 outline-none resize-none';
  ta.spellcheck = false;
  ta.value = rnProject.files[rnProject.active] || '';

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 2;
      rnProject.files[rnProject.active] = ta.value;
      saveRnProject();
      scheduleRun();
    }
  });
  ta.addEventListener('input', () => {
    rnProject.files[rnProject.active] = ta.value;
    saveRnProject();
    scheduleRun();
  });
  container.appendChild(ta);

  editor = {
    getValue: () => ta.value,
    setValue: (v) => { ta.value = v; },
    isFallback: true
  };
  setEngineLabel('Basic editor (Monaco unavailable)');
  console.warn('Monaco editor could not be loaded, using the basic editor instead.');
  renderRnFiles();
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

function quoteBareRnSpecifiers(source) {
  return source
    .replace(/(^|\n)(\s*import\s+)(\.{1,2}\/[A-Za-z0-9_./$-]+)/g, "$1$2'$3'")
    .replace(/\b(from\s+)(\.{1,2}\/[A-Za-z0-9_./$-]+)/g, "$1'$2'");
}

function lowercaseImportedJsx({ types: t }) {
  return {
    visitor: {
      Program(programPath) {
        const names = new Set();
        programPath.traverse({
          JSXIdentifier(idPath) {
            const parent = idPath.parent;
            if (parent.type !== 'JSXOpeningElement' && parent.type !== 'JSXClosingElement') return;
            const name = idPath.node.name;
            if (!/^[a-z_$]/.test(name)) return;
            const binding = idPath.scope.getBinding(name);
            if (binding && binding.kind === 'module') names.add(name);
          }
        });
        if (!names.size) return;
        const aliases = [];
        names.forEach((name) => {
          const alias = '_Rn' + name.charAt(0).toUpperCase() + name.slice(1);
          aliases.push(t.variableDeclaration('const', [
            t.variableDeclarator(t.identifier(alias), t.identifier(name))
          ]));
          programPath.traverse({
            JSXIdentifier(idPath) {
              const parent = idPath.parent;
              if (parent.type !== 'JSXOpeningElement' && parent.type !== 'JSXClosingElement') return;
              if (idPath.node.name !== name) return;
              const binding = idPath.scope.getBinding(name);
              if (binding && binding.kind === 'module') idPath.node.name = alias;
            }
          });
        });
        let insertAt = 0;
        programPath.node.body.forEach((node, index) => {
          if (node.type === 'ImportDeclaration') insertAt = index + 1;
        });
        programPath.node.body.splice(insertAt, 0, ...aliases);
        programPath.scope.crawl();
      }
    }
  };
}

function compileRnFile(path, source) {
  if (/\.json$/i.test(path)) {
    JSON.parse(source);
    return 'exports.__esModule = true;\nexports.default = ' + source + ';\n';
  }
  const tsx = !/\.ts$/i.test(path) || /\.tsx$/i.test(path);
  return Babel.transform(quoteBareRnSpecifiers(source), {
    filename: path,
    sourceType: 'module',
    babelrc: false,
    configFile: false,
    plugins: [lowercaseImportedJsx],
    presets: [
      ['env', { modules: 'commonjs' }],
      ['react', { runtime: 'classic' }],
      ['typescript', { isTSX: tsx, allExtensions: true }]
    ]
  }).code;
}

function executeRnProject(files) {
  const compiled = {};
  Object.keys(files).forEach((path) => {
    if (!/\.(jsx|js|tsx|ts|json)$/i.test(path)) return;
    try { compiled[path] = compileRnFile(path, files[path]); }
    catch (error) { throw new Error(path + ': ' + error.message); }
  });

  const cache = {};
  function load(path) {
    if (cache[path]) return cache[path].exports;
    if (!compiled[path]) throw new Error('Cannot load "' + path + '"');
    const record = { exports: {} };
    cache[path] = record;
    const module = { exports: record.exports };
    const runFn = new Function('require', 'module', 'exports', 'React', compiled[path]);
    runFn(makeRequire(path), module, record.exports, window.React);
    record.exports = module.exports;
    return record.exports;
  }
  function makeRequire(fromFile) {
    return (moduleName) => {
      if (moduleName === 'react') return window.React;
      if (window.RNComponents && window.RNComponents.__modules && window.RNComponents.__modules[moduleName]) {
        return window.RNComponents.__modules[moduleName];
      }
      if (moduleName === 'react-native' || moduleName === 'react-native-web') return window.RNComponents;
      if (moduleName.startsWith('.')) {
        const resolved = resolveRnImport(fromFile, moduleName, files);
        if (!resolved) throw new Error(fromFile + ': cannot find "' + moduleName + '"');
        return load(resolved);
      }
      throw new Error("Module '" + moduleName + "' is not supported in this browser sandbox.");
    };
  }

  const entry = findRnEntry(files);
  if (!entry) throw new Error('Add App.jsx with export default function App().');
  const exported = load(entry);
  return exported.default || exported.App || (window.__rnAppRegistry && window.__rnAppRegistry.getApplication());
}

function unmountRnApp() {
  if (reactRoot) {
    try { reactRoot.unmount(); } catch (e) {}
    reactRoot = null;
  }
  const mountNode = document.getElementById('app-root');
  if (mountNode) mountNode.innerHTML = '';
  if (window.setStatusBar) window.setStatusBar(null);
}
window.__rnUnmount = unmountRnApp;

function runCode(launch) {
  if (!editor) return;

  if (rnProject.active) rnProject.files[rnProject.active] = editor.getValue();
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

    const App = executeRnProject(rnProject.files);

    if (!App) {
      throw new Error("No 'default export' found in App.jsx. Ensure you have 'export default function App()'.");
    }

    reactRoot = ReactDOM.createRoot(mountNode);
    reactRoot.render(
      window.React.createElement(ErrorBoundary, null, window.React.createElement(App))
    );
    setTimeout(paintStatusBar, 100);
    if (launch === true && window.openExpo) window.openExpo();

  } catch (err) {
    console.error(err.message);

    mountNode.innerHTML = `
      <div style="padding: 16px; background-color: #fef2f2; color: #991b1b; font-family: monospace; font-size: 12px; min-height: 100%; overflow-y: auto;">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">⚠️ Compilation Error</div>
        <pre style="white-space: pre-wrap; word-break: break-all; background: #fee2e2; padding: 10px; border-radius: 6px; margin: 0;">${rnEscape(err.message)}</pre>
      </div>
        `;
    if (launch === true && window.openExpo) window.openExpo();
  }
}

// ==========================================
// 5. UI CONTROLS & UTILITIES
// ==========================================
function loadTemplate(key) {
  if (!TEMPLATES[key] || !editor) return;
  const path = rnProject.files['App.jsx'] != null ? 'App.jsx' : rnProject.active;
  setRnFileValue(path, TEMPLATES[key]);
  if (editor.isFallback && rnProject.active === path) editor.setValue(TEMPLATES[key]);
  saveRnProject();
  runCode();
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

let consoleOpenHeight = 144;

function toggleConsole() {
  const dock = document.getElementById('console-dock');
  const icon = document.getElementById('console-toggle-icon');

  if (isConsoleOpen) {
    consoleOpenHeight = Math.max(dock.offsetHeight, 80);
    dock.style.height = '39px';
    icon.className = 'fa-solid fa-chevron-up';
  } else {
    dock.style.height = consoleOpenHeight + 'px';
    icon.className = 'fa-solid fa-chevron-down';
  }
  isConsoleOpen = !isConsoleOpen;
  if (editor && editor.layout) editor.layout();
}

function layoutAfterResize() {
  if (editor && editor.layout) editor.layout();
  if (typeof fitDevice === 'function') fitDevice();
}

function setupPaneResize() {
  const playground = document.querySelector('.playground');
  const editorPane = document.querySelector('.editor-pane');
  const simPane = document.querySelector('.sim-pane');
  const split = document.getElementById('split-handle');
  const dock = document.getElementById('console-dock');
  const consoleHandle = document.getElementById('console-resize');
  if (!playground || !split || !dock || !consoleHandle) return;

  const rowLayout = () => getComputedStyle(playground).flexDirection === 'row';
  let splitAxis = null;

  split.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    split.classList.add('dragging');
    split.setPointerCapture(event.pointerId);
    const move = (ev) => {
      const rect = playground.getBoundingClientRect();
      if (rowLayout()) {
        splitAxis = 'x';
        const width = Math.max(280, Math.min(rect.width - 280, ev.clientX - rect.left));
        editorPane.style.flex = '0 0 ' + width + 'px';
        editorPane.style.height = '';
        simPane.style.flex = '1 1 auto';
        simPane.style.maxWidth = 'none';
        simPane.style.width = 'auto';
      } else {
        splitAxis = 'y';
        const height = Math.max(160, Math.min(rect.height - 160, ev.clientY - rect.top));
        editorPane.style.flex = '0 0 ' + height + 'px';
        editorPane.style.height = height + 'px';
        simPane.style.flex = '1 1 auto';
      }
      layoutAfterResize();
    };
    const up = () => {
      split.classList.remove('dragging');
      split.removeEventListener('pointermove', move);
      split.removeEventListener('pointerup', up);
    };
    split.addEventListener('pointermove', move);
    split.addEventListener('pointerup', up);
  });

  consoleHandle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    consoleHandle.classList.add('dragging');
    consoleHandle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startH = dock.offsetHeight;
    const move = (ev) => {
      const limit = editorPane.clientHeight - 80;
      const next = Math.max(39, Math.min(limit, startH + (startY - ev.clientY)));
      dock.style.height = next + 'px';
      const icon = document.getElementById('console-toggle-icon');
      if (next > 56) {
        isConsoleOpen = true;
        consoleOpenHeight = next;
        icon.className = 'fa-solid fa-chevron-down';
      } else {
        isConsoleOpen = false;
        icon.className = 'fa-solid fa-chevron-up';
      }
      layoutAfterResize();
    };
    const up = () => {
      consoleHandle.classList.remove('dragging');
      consoleHandle.removeEventListener('pointermove', move);
      consoleHandle.removeEventListener('pointerup', up);
    };
    consoleHandle.addEventListener('pointermove', move);
    consoleHandle.addEventListener('pointerup', up);
  });

  window.addEventListener('resize', () => {
    const axis = rowLayout() ? 'x' : 'y';
    if (splitAxis && splitAxis !== axis) {
      editorPane.style.flex = '';
      editorPane.style.height = '';
      simPane.style.flex = '';
      simPane.style.maxWidth = '';
      simPane.style.width = '';
      splitAxis = null;
    }
    layoutAfterResize();
  });
}

function renderRnFiles() {
  const tree = document.getElementById('rn-file-tree');
  const tabs = document.getElementById('rn-tabs');
  if (tree) tree.innerHTML = renderRnBranch(rnFileTree(Object.keys(rnProject.files)), 0);
  if (tabs) {
    tabs.innerHTML = rnProject.open.map((path) => {
      const active = path === rnProject.active ? ' active' : '';
      const name = path.split('/').pop();
      return `<button type="button" class="rn-tab${active}" data-action="open" data-path="${rnEscape(path)}" title="${rnEscape(path)}"><span>${rnEscape(name)}</span><span class="rn-tab-close" data-action="close" data-path="${rnEscape(path)}" title="Close">×</span></button>`;
    }).join('');
  }
}

function rnFileTree(paths) {
  const root = { dirs: {}, files: [] };
  paths.slice().sort().forEach((path) => {
    const parts = path.split('/');
    let node = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) node.files.push({ name: part, path });
      else {
        node.dirs[part] = node.dirs[part] || { dirs: {}, files: [] };
        node = node.dirs[part];
      }
    });
  });
  return root;
}

function renderRnBranch(node, depth) {
  const pad = depth * 10;
  let html = Object.keys(node.dirs).sort().map((name) => (
    `<div class="rn-folder" style="padding-left:${pad}px">${rnEscape(name)}</div>` +
    renderRnBranch(node.dirs[name], depth + 1)
  )).join('');
  node.files.forEach((file) => {
    const active = file.path === rnProject.active ? ' active' : '';
    html += `<button type="button" class="rn-file-row${active}" data-action="open" data-path="${rnEscape(file.path)}">
      <span style="width:${pad}px;flex:0 0 auto"></span>
      <i class="fa-brands fa-react"></i>
      <span>${rnEscape(file.name)}</span>
      <span class="rn-file-actions">
        <span data-action="rename" data-path="${rnEscape(file.path)}" title="Rename"><i class="fa-solid fa-pen"></i></span>
        <span data-action="delete" data-path="${rnEscape(file.path)}" title="Delete"><i class="fa-solid fa-trash"></i></span>
      </span>
    </button>`;
  });
  return html;
}

function openRnFile(path) {
  if (rnProject.files[path] == null) return;
  if (editor && rnProject.active && rnProject.active !== path) rnProject.files[rnProject.active] = editor.getValue();
  rnProject.active = path;
  if (!rnProject.open.includes(path)) rnProject.open.push(path);
  if (editor && editor.isFallback) editor.setValue(rnProject.files[path]);
  else if (editor && typeof monaco !== 'undefined') editor.setModel(ensureRnModel(path));
  renderRnFiles();
  saveRnProject();
}

function createRnFile(raw) {
  let path = rnNormalizePath(String(raw || '').trim());
  if (!path) throw new Error('Enter a file name, like components/Hello.jsx');
  if (!/\.[a-z0-9]+$/i.test(path)) path += '.jsx';
  if (rnProject.files[path] != null) {
    openRnFile(path);
    return;
  }
  const base = path.split('/').pop().replace(/\.[^.]+$/, '');
  const ident = base.replace(/[^A-Za-z0-9_$]/g, '') || 'Hello';
  const rawName = /^[A-Za-z_$]/.test(ident) ? ident : 'Hello';
  const name = /^[a-z]/.test(rawName) ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : rawName;
  let content = `import React from 'react';\nimport { View, Text } from 'react-native';\n\nexport default function ${name}() {\n  return (\n    <View>\n      <Text>${name}</Text>\n    </View>\n  );\n}\n`;
  if (/\.json$/i.test(path)) content = '{\n  "title": ""\n}\n';
  else if (/\.(js|ts)$/i.test(path)) content = `export function ${name}() {\n  return null;\n}\n`;
  rnProject.files[path] = content;
  if (typeof monaco !== 'undefined' && monaco.editor) ensureRnModel(path);
  openRnFile(path);
  scheduleRun();
}

function renameRnFile(oldPath, raw) {
  let nextPath = rnNormalizePath(String(raw || '').trim());
  if (!nextPath) throw new Error('Enter a file path');
  if (!/\.[a-z0-9]+$/i.test(nextPath)) {
    const ext = oldPath.includes('.') ? oldPath.slice(oldPath.lastIndexOf('.')) : '.jsx';
    nextPath += ext;
  }
  if (nextPath === oldPath) {
    renderRnFiles();
    return;
  }
  if (rnProject.files[nextPath] != null) throw new Error(nextPath + ' already exists');
  const snapshot = { ...rnProject.files };
  Object.keys(snapshot).forEach((file) => {
    if (file === oldPath || !/\.(jsx|js|tsx|ts)$/i.test(file)) return;
    const updated = snapshot[file]
      .replace(
        /(from\s+|import\s+)(['"])([^'"]+)\2/g,
        (full, lead, quote, spec) => {
          if (!spec.startsWith('.')) return full;
          if (resolveRnImport(file, spec, snapshot) !== oldPath) return full;
          return lead + quote + relativeRnImport(file, nextPath) + quote;
        }
      )
      .replace(
        /\b(from\s+)(\.{1,2}\/[A-Za-z0-9_./$-]+)/g,
        (full, lead, spec) => {
          if (resolveRnImport(file, spec, snapshot) !== oldPath) return full;
          return lead + "'" + relativeRnImport(file, nextPath) + "'";
        }
      );
    if (updated !== snapshot[file]) setRnFileValue(file, updated);
  });
  rnProject.files[nextPath] = rnProject.files[oldPath];
  delete rnProject.files[oldPath];
  rnProject.open = rnProject.open.map((file) => (file === oldPath ? nextPath : file));
  if (typeof monaco !== 'undefined' && monaco.editor) {
    const oldModel = monaco.editor.getModel(monaco.Uri.parse('file:///' + oldPath));
    if (oldModel) {
      if (editor && !editor.isFallback && editor.getModel() === oldModel) editor.setModel(null);
      oldModel.dispose();
    }
    ensureRnModel(nextPath);
  }
  rnProject.active = nextPath;
  openRnFile(nextPath);
  scheduleRun();
}

function deleteRnFile(path) {
  const codeFiles = Object.keys(rnProject.files).filter((file) => /\.(jsx|js|tsx|ts)$/i.test(file));
  if (codeFiles.length === 1 && codeFiles[0] === path) {
    console.error('Keep at least one JavaScript file.');
    return;
  }
  if (!confirm('Delete ' + path + '?')) return;
  delete rnProject.files[path];
  rnProject.open = rnProject.open.filter((file) => file !== path);
  if (typeof monaco !== 'undefined' && monaco.editor) {
    const model = monaco.editor.getModel(monaco.Uri.parse('file:///' + path));
    if (model) {
      if (editor && !editor.isFallback && editor.getModel() === model) editor.setModel(null);
      model.dispose();
    }
  }
  if (rnProject.active === path) {
    const next = rnProject.open[0] || Object.keys(rnProject.files)[0];
    if (next) openRnFile(next);
  } else renderRnFiles();
  saveRnProject();
  scheduleRun();
}

function closeRnTab(path) {
  if (rnProject.open.length === 1) return;
  const index = rnProject.open.indexOf(path);
  rnProject.open = rnProject.open.filter((file) => file !== path);
  if (rnProject.active === path) openRnFile(rnProject.open[Math.max(0, index - 1)]);
  else {
    renderRnFiles();
    saveRnProject();
  }
}

function startRnRename(path) {
  const row = [...document.querySelectorAll('.rn-file-row')].find((item) => item.dataset.path === path);
  if (!row) return;
  const input = document.createElement('input');
  input.value = path;
  input.setAttribute('aria-label', 'Rename file');
  row.replaceWith(input);
  input.focus();
  input.select();
  let settled = false;
  const finish = (save) => {
    if (settled) return;
    settled = true;
    if (!save) {
      renderRnFiles();
      return;
    }
    try { renameRnFile(path, input.value); }
    catch (error) {
      console.error(error.message);
      renderRnFiles();
    }
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

const RN_FILES_OPEN_KEY = 'suite-rn-files-open';

function applyRnFilesOpen(open) {
  document.body.classList.toggle('rn-files-collapsed', !open);
  const rail = document.getElementById('rn-show-files');
  if (rail) rail.hidden = open;
  try { localStorage.setItem(RN_FILES_OPEN_KEY, open ? '1' : '0'); } catch (e) {}
  if (editor && editor.layout) requestAnimationFrame(() => editor.layout());
}

function bindRnFiles() {
  const tree = document.getElementById('rn-file-tree');
  const tabs = document.getElementById('rn-tabs');
  const form = document.getElementById('rn-new-form');
  const input = document.getElementById('rn-new-input');
  const button = document.getElementById('rn-new-file');
  if (button && form && input) {
    button.onclick = () => {
      form.hidden = false;
      input.value = '';
      input.focus();
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      try {
        createRnFile(input.value);
        form.hidden = true;
        input.value = '';
      } catch (error) {
        console.error(error.message);
      }
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') form.hidden = true;
      else if (event.key === 'Enter') {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  }
  const hideFiles = document.getElementById('rn-hide-files');
  const showFiles = document.getElementById('rn-show-files');
  if (hideFiles) hideFiles.onclick = () => applyRnFilesOpen(false);
  if (showFiles) showFiles.onclick = () => applyRnFilesOpen(true);
  let filesOpen = true;
  try { filesOpen = localStorage.getItem(RN_FILES_OPEN_KEY) !== '0'; } catch (e) {}
  applyRnFilesOpen(filesOpen);
  if (tree) {
    tree.addEventListener('click', (event) => {
      const node = event.target.closest('[data-action]');
      if (!node) return;
      const path = node.dataset.path;
      if (node.dataset.action === 'rename') startRnRename(path);
      else if (node.dataset.action === 'delete') deleteRnFile(path);
      else openRnFile(path);
    });
  }
  if (tabs) {
    tabs.addEventListener('click', (event) => {
      const node = event.target.closest('[data-action]');
      if (!node) return;
      if (node.dataset.action === 'close') closeRnTab(node.dataset.path);
      else openRnFile(node.dataset.path);
    });
  }
}

setupPaneResize();
syncUiThemeButton();
renderRnFiles();
bindRnFiles();
