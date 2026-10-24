/* ==================== PROJECT FILES ==================== */
const STORAGE_KEY = 'suite-react-project';

const STARTER_FILES = {
  'src/App.jsx': `import UserCard from "./components/UserCard";

export default function App() {
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>React project</h1>
      <UserCard name="Alex Mercer" email="alex@example.com" />
    </div>
  );
}
`,
  'src/components/UserCard.jsx': `export default function UserCard({ name, email }) {
  return (
    <article style={{ padding: 16, border: "1px solid #e4e1db", borderRadius: 12, maxWidth: 320 }}>
      <h2 style={{ margin: "0 0 8px" }}>{name}</h2>
      <p style={{ margin: 0 }}>Email: {email}</p>
    </article>
  );
}
`
};

function starterProject() {
  return {
    version: 1,
    active: 'src/App.jsx',
    open: ['src/App.jsx', 'src/components/UserCard.jsx'],
    files: { ...STARTER_FILES }
  };
}

function normalizePath(input) {
  const parts = [];
  for (const part of String(input || '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function projectFromHash() {
  if (!location.hash || location.hash.length < 2) return null;
  let decoded = '';
  try { decoded = decodeURIComponent(atob(location.hash.slice(1))); }
  catch { return null; }
  try {
    const data = JSON.parse(decoded);
    if (data && data.files && Object.keys(data.files).length) return data;
  } catch { /* a shared single file */ }
  if (decoded.trim().length > 10) {
    return { version: 1, active: 'src/App.jsx', open: ['src/App.jsx'], files: { 'src/App.jsx': decoded } };
  }
  return null;
}

function normalizeProject(data) {
  const files = {};
  Object.keys(data.files || {}).forEach((path) => {
    const clean = normalizePath(path);
    if (clean) files[clean] = String(data.files[path] ?? '');
  });
  if (!Object.keys(files).length) return starterProject();
  let active = normalizePath(data.active);
  if (!files[active]) active = Object.keys(files).sort()[0];
  let open = Array.isArray(data.open) ? data.open.map(normalizePath).filter((path) => files[path]) : [];
  if (!open.length) open = [active];
  if (!open.includes(active)) open.unshift(active);
  return { version: 1, active, open, files };
}

function loadProject() {
  const hashed = projectFromHash();
  if (hashed) {
    history.replaceState(null, '', location.pathname + location.search);
    return normalizeProject(hashed);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeProject(JSON.parse(raw));
  } catch { /* use the starter */ }
  return starterProject();
}

let project = loadProject();
let currentCode = project.files[project.active] || '';
let errorDecorations = [];
let editor;
let previewTimer = null;
let previewSettled = false;
let saveTimer = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }
    catch { /* private mode */ }
  }, 200);
}

function updateFileStatus() {
  const el = document.getElementById('active-file');
  if (!el) return;
  const count = Object.keys(project.files).length;
  el.textContent = `${project.active} · ${count} file${count === 1 ? '' : 's'}`;
}

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

  // Syntax errors stay visible. Cross-file imports are resolved by the preview compiler.
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false
  });
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    allowJs: true,
    jsx: monaco.languages.typescript.JsxEmit.React
  });
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false
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

  Object.keys(project.files).forEach(ensureModel);

  // Create editor instance
  editor = monaco.editor.create(document.getElementById("editor"), {
    model: ensureModel(project.active),
    theme: (window.suiteMonacoTheme ? suiteMonacoTheme() : "vs"),
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

  renderFiles();

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

const languageList = document.getElementById("languageList");
if (languageList) languageList.addEventListener("click", (e) => {
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
      window.location.href = "../editor/";
      break;

    case "typescript":
      window.location.href = "../typescript/";
      break;

    case "html":
      window.location.href = "../html/";
      break;
    case "react":
      window.location.href = "../react/";
      break;
    case "json":
      window.location.href = "../json/";
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

function languageFor(path) {
  if (/\.css$/i.test(path)) return 'css';
  if (/\.json$/i.test(path)) return 'json';
  if (/\.tsx?$/i.test(path)) return 'typescript';
  return 'javascript';
}

function ensureModel(path) {
  const uri = monaco.Uri.parse('file:///' + path);
  let model = monaco.editor.getModel(uri);
  if (model) return model;
  model = monaco.editor.createModel(project.files[path] ?? '', languageFor(path), uri);
  model.onDidChangeContent(() => {
    if (model.__applying) return;
    project.files[path] = model.getValue();
    if (project.active === path) currentCode = project.files[path];
    scheduleSave();
    updateStatus('typing');
    clearErrors();
  });
  return model;
}

function setModelValue(path, value) {
  project.files[path] = value;
  if (typeof monaco === 'undefined') return;
  const model = monaco.editor.getModel(monaco.Uri.parse('file:///' + path));
  if (model && model.getValue() !== value) {
    model.__applying = true;
    model.setValue(value);
    model.__applying = false;
  }
}

/* ==================== MULTI-FILE COMPILER ==================== */
const HOOK_NAMES = new Set([
  'useState', 'useEffect', 'useLayoutEffect', 'useInsertionEffect', 'useReducer',
  'useCallback', 'useMemo', 'useRef', 'useContext', 'useImperativeHandle',
  'useDebugValue', 'useId', 'useTransition', 'useDeferredValue', 'useSyncExternalStore',
  'Fragment', 'createContext', 'createElement', 'cloneElement', 'Children', 'memo',
  'forwardRef', 'lazy', 'Suspense', 'startTransition', 'StrictMode'
]);

function dirname(path) {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function resolveImportPath(fromFile, spec, files) {
  if (!spec.startsWith('.')) return null;
  const base = normalizePath((dirname(fromFile) ? dirname(fromFile) + '/' : '') + spec);
  const candidates = [
    base,
    base + '.jsx', base + '.js', base + '.tsx', base + '.ts', base + '.css', base + '.json',
    base + '/index.jsx', base + '/index.js', base + '/index.tsx', base + '/index.ts'
  ];
  return candidates.find((candidate) => Object.prototype.hasOwnProperty.call(files, candidate)) || null;
}

function relativeImport(fromFile, toFile) {
  const from = dirname(fromFile).split('/').filter(Boolean);
  const to = toFile.split('/').filter(Boolean);
  let shared = 0;
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared += 1;
  const rel = [...Array(from.length - shared).fill('..'), ...to.slice(shared)].join('/');
  return rel.startsWith('.') ? rel : './' + rel;
}

function exportMember(name) {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? '.' + name : '[' + JSON.stringify(name) + ']';
}

function importedName(node) {
  if (!node) return 'default';
  return node.type === 'Identifier' ? node.name : node.value;
}

function presetsFor(path) {
  const tsx = !/\.ts$/i.test(path) || /\.tsx$/i.test(path);
  return [
    'react',
    ['typescript', { isTSX: tsx, allExtensions: true, onlyRemoveTypeImports: true }]
  ];
}

function reactBinding(specifier) {
  const local = specifier.local.name;
  if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
    return `const ${local} = window.React;`;
  }
  const imported = importedName(specifier.imported);
  if (local === imported && HOOK_NAMES.has(imported)) return '';
  const source = HOOK_NAMES.has(imported) ? imported : 'window.React.' + imported;
  return `const ${local} = ${source};`;
}

function domBinding(specifier) {
  const local = specifier.local.name;
  if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
    return `const ${local} = window.ReactDOM;`;
  }
  return `const ${local} = window.ReactDOM.${importedName(specifier.imported)};`;
}

function localBinding(specifier, request) {
  const local = specifier.local.name;
  if (specifier.type === 'ImportDefaultSpecifier') return `const ${local} = ${request}.default;`;
  if (specifier.type === 'ImportNamespaceSpecifier') return `const ${local} = ${request};`;
  return `const ${local} = ${request}${exportMember(importedName(specifier.imported))};`;
}

function bindingsForImport(node, fromFile, files) {
  const spec = node.source.value;
  if (spec === 'react' || spec === 'react/jsx-runtime' || spec === 'react/jsx-dev-runtime') {
    return node.specifiers.map(reactBinding).filter(Boolean);
  }
  if (spec === 'react-dom' || spec === 'react-dom/client') {
    return node.specifiers.map(domBinding);
  }
  if (!spec.startsWith('.')) {
    throw new Error(`${fromFile}: cannot import "${spec}". Only React and project files are available.`);
  }
  const resolved = resolveImportPath(fromFile, spec, files);
  if (!resolved) throw new Error(`${fromFile}: cannot find "${spec}"`);
  const request = `__require(${JSON.stringify(resolved)})`;
  if (!node.specifiers.length) return [`${request};`];
  return node.specifiers.map((specifier) => localBinding(specifier, request));
}

function reexportLines(node, fromFile, files) {
  const spec = node.source.value;
  const resolved = resolveImportPath(fromFile, spec, files);
  if (!resolved) throw new Error(`${fromFile}: cannot find "${spec}"`);
  const request = `__require(${JSON.stringify(resolved)})`;
  if (node.type === 'ExportAllDeclaration') {
    return [`Object.keys(${request}).forEach(function (key) { if (key !== "default") exports[key] = ${request}[key]; });`];
  }
  return node.specifiers.map((specifier) => {
    const local = importedName(specifier.local);
    const exported = importedName(specifier.exported);
    const value = local === 'default' ? `${request}.default` : `${request}${exportMember(local)}`;
    return `exports${exportMember(exported)} = ${value};`;
  });
}

function namesOfPattern(id, out) {
  if (!id) return;
  if (id.type === 'Identifier') out.push(id.name);
  else if (id.type === 'ObjectPattern') id.properties.forEach((prop) => namesOfPattern(prop.type === 'RestElement' ? prop.argument : prop.value, out));
  else if (id.type === 'ArrayPattern') id.elements.forEach((el) => el && namesOfPattern(el.type === 'RestElement' ? el.argument : el, out));
  else if (id.type === 'RestElement') namesOfPattern(id.argument, out);
  else if (id.type === 'AssignmentPattern') namesOfPattern(id.left, out);
}

function compileModule(path, source, files, entry) {
  if (/\.css$/i.test(path)) {
    const id = JSON.stringify('__style_' + path);
    return `__define(${JSON.stringify(path)}, function (module, exports, __require) {
      var previous = document.getElementById(${id});
      if (previous) previous.remove();
      var style = document.createElement('style');
      style.id = ${id};
      style.textContent = ${JSON.stringify(source)};
      document.head.appendChild(style);
    });`;
  }
  if (/\.json$/i.test(path)) {
    try { JSON.parse(source); }
    catch (error) { throw new Error(`${path}: ${error.message}`); }
    return `__define(${JSON.stringify(path)}, function (module, exports, __require) {
      exports.default = ${source};
    });`;
  }
  if (!/\.(jsx|js|tsx|ts)$/i.test(path)) return '';

  const meta = { imports: [], exportLines: [] };
  let result;
  try {
    result = Babel.transform(source, {
      filename: path,
      sourceType: 'module',
      babelrc: false,
      configFile: false,
      retainLines: true,
      presets: presetsFor(path),
      plugins: [function moduleLinker({ types: t }) {
        return {
          visitor: {
            ImportDeclaration(importPath) {
              meta.imports.push(importPath.node);
              importPath.remove();
            },
            ExportDefaultDeclaration(exportPath) {
              const declaration = exportPath.get('declaration');
              if (declaration.isFunctionDeclaration() || declaration.isClassDeclaration()) {
                if (!declaration.node.id) declaration.node.id = t.identifier('__defaultExport');
                meta.exportLines.push(`exports.default = ${declaration.node.id.name};`);
                exportPath.replaceWith(declaration.node);
              } else {
                const id = exportPath.scope.generateUidIdentifier('defaultExport');
                meta.exportLines.push(`exports.default = ${id.name};`);
                exportPath.replaceWith(t.variableDeclaration('const', [
                  t.variableDeclarator(id, declaration.node)
                ]));
              }
            },
            ExportNamedDeclaration(exportPath) {
              if (exportPath.node.exportKind === 'type') {
                exportPath.remove();
                return;
              }
              if (exportPath.node.source) {
                meta.exportLines.push(...reexportLines(exportPath.node, path, files));
                exportPath.remove();
                return;
              }
              const declaration = exportPath.get('declaration');
              if (declaration.node) {
                const names = [];
                if (declaration.isFunctionDeclaration() || declaration.isClassDeclaration()) names.push(declaration.node.id.name);
                else if (declaration.isVariableDeclaration()) declaration.node.declarations.forEach((item) => namesOfPattern(item.id, names));
                names.forEach((name) => meta.exportLines.push(`exports${exportMember(name)} = ${name};`));
                exportPath.replaceWith(declaration.node);
              } else {
                exportPath.node.specifiers.forEach((specifier) => {
                  if (specifier.type !== 'ExportSpecifier') return;
                  const local = importedName(specifier.local);
                  const exported = importedName(specifier.exported);
                  meta.exportLines.push(`exports${exportMember(exported)} = ${local === 'default' ? 'exports.default' : local};`);
                });
                exportPath.remove();
              }
            },
            ExportAllDeclaration(exportPath) {
              meta.exportLines.push(...reexportLines(exportPath.node, path, files));
              exportPath.remove();
            }
          }
        };
      }]
    });
  } catch (error) {
    throw new Error(`${path}: ${error.message}`);
  }

  const imports = meta.imports.flatMap((node) => bindingsForImport(node, path, files));
  const declaresReact = meta.imports.some((node) => node.specifiers.some((specifier) => specifier.local && specifier.local.name === 'React'));
  const header = declaresReact ? '' : 'const React = window.React;';
  const appFallback = path === entry
    ? 'if (typeof App !== "undefined" && exports.default == null) exports.default = App;'
    : '';
  return `__define(${JSON.stringify(path)}, function (module, exports, __require) {
    ${header}
    ${imports.join('\n')}
    ${result.code || ''}
    ${meta.exportLines.join('\n')}
    ${appFallback}
  });`;
}

function findEntry(files) {
  const preferred = ['src/App.jsx', 'src/App.js', 'src/App.tsx', 'src/App.ts', 'App.jsx', 'App.js'];
  const found = preferred.find((path) => Object.prototype.hasOwnProperty.call(files, path));
  if (found) return found;
  const named = Object.keys(files).find((path) => /(^|\/)App\.(jsx|js|tsx|ts)$/.test(path));
  if (named) return named;
  return Object.keys(files).find((path) => /\.(jsx|js|tsx|ts)$/.test(path) && /\b(function|class|const|let|var)\s+App\b/.test(files[path])) || null;
}

function compile() {
  if (typeof Babel === 'undefined') {
    throw new Error('Babel is not loaded. Please wait and try again.');
  }

  const files = { ...project.files };
  if (editor && project.active) files[project.active] = editor.getValue();
  const entry = findEntry(files);
  if (!entry) {
    throw new Error('No App file found. Add src/App.jsx with a component named App.');
  }

  try {
    const modules = Object.keys(files)
      .sort()
      .map((path) => compileModule(path, files[path], files, entry))
      .filter(Boolean);
    const bundle = `
      var __modules = {};
      function __define(id, factory) {
        __modules[id] = { factory: factory, exports: {}, loaded: false };
      }
      function __require(id) {
        var record = __modules[id];
        if (!record) throw new Error('Cannot find module "' + id + '"');
        if (record.loaded) return record.exports;
        record.loaded = true;
        var module = { exports: record.exports };
        record.factory(module, module.exports, __require);
        record.exports = module.exports;
        return record.exports;
      }
      ${modules.join('\n')}
      var __entry = __require(${JSON.stringify(entry)});
      window.App = __entry.default || __entry.App;
    `;
    return createPreviewHTML(bundle.replace(/<\/script/gi, '<\\/script'));
  } catch (error) {
    const message = error.message || String(error);
    throw new Error(message.indexOf('Compilation failed') === 0 ? message : 'Compilation failed: ' + message);
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
        html, body, #root { height: 100%; }
        body { 
            margin: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f8fafc;
        }
        #root { 
            min-height: 100%;
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
            if (!window.React || !window.ReactDOM) {
                throw new Error('React or ReactDOM not loaded');
            }

            // Named imports such as useReducer are removed with the import line.
            // Put the real hooks in this script so the component can call them.
            const {
                useState, useEffect, useLayoutEffect, useInsertionEffect,
                useReducer, useCallback, useMemo, useRef, useContext,
                useImperativeHandle, useDebugValue, useId, useTransition,
                useDeferredValue, useSyncExternalStore, Fragment, createContext,
                createElement, cloneElement, Children, memo, forwardRef, lazy,
                Suspense, startTransition, StrictMode
            } = window.React;

            ${appCode}

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
            parent.postMessage({ type: 'preview-ready' }, '*');
            
        } catch (error) {
            parent.postMessage({ type: 'preview-error', args: [error.message] }, '*');
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
  previewSettled = false;
  const fileCount = Object.keys(project.files).length;
  consoleDiv.innerHTML = `<span class="console-line info">> Running ${fileCount} file${fileCount === 1 ? '' : 's'}...</span>`;

  try {
    checkRealErrors();
    const compiledHtml = compile();

    const iframe = document.getElementById("preview");
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(compiledHtml);
    iframeDoc.close();

    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      if (previewSettled) return;
      showError('The preview did not start. Define a component named App.');
    }, 8000);

  } catch (err) {
    previewSettled = true;
    clearTimeout(previewTimer);
    showError(err.message);
    updateStatus("error");
  }
}

/* ==================== CONSOLE & ERROR HANDLING ==================== */
window.addEventListener("message", (e) => {
  if (!e.data || !e.data.type) return;

  if (e.data.type === 'preview-ready') {
    previewSettled = true;
    clearTimeout(previewTimer);
    const consoleDiv = document.getElementById("console");
    consoleDiv.innerHTML += '<span class="console-line log">> ✓ Preview rendered</span>';
    updateStatus("ready");
    return;
  }
  if (e.data.type === 'preview-error') {
    previewSettled = true;
    clearTimeout(previewTimer);
    showError(e.data.args?.join(' ') || 'Preview failed');
    return;
  }

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
    if (editor && project.active) project.files[project.active] = editor.getValue();
    const encoded = btoa(encodeURIComponent(JSON.stringify({
      files: project.files,
      active: project.active,
      open: project.open
    })));
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
function downloadCode() {
  const name = (project.active || 'App.jsx').split('/').pop();
  const text = editor ? editor.getValue() : (project.files[project.active] || '');
  const blob = new Blob([text], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function resetCode() {
  if (!confirm('Reset the project to the starter files? Your files will be lost.')) return;
  if (typeof monaco !== 'undefined') {
    if (editor) editor.setModel(null);
    monaco.editor.getModels().forEach((model) => model.dispose());
  }
  project = starterProject();
  currentCode = project.files[project.active];
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  if (typeof monaco !== 'undefined' && editor) {
    Object.keys(project.files).forEach(ensureModel);
    editor.setModel(ensureModel(project.active));
  }
  renderFiles();
  clearErrors();
  updateStatus('ready');
  run();
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function fileIcon(path) {
  if (/\.css$/i.test(path)) return 'fa-regular fa-file-code';
  if (/\.json$/i.test(path)) return 'fa-regular fa-file';
  if (/\.(jsx|tsx)$/i.test(path)) return 'fa-brands fa-react';
  return 'fa-regular fa-file-code';
}

function fileTree(paths) {
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

function renderFileBranch(node, depth) {
  const pad = depth * 12;
  let html = Object.keys(node.dirs).sort().map((name) => (
    `<div class="file-folder" style="padding-left:${pad}px">${escapeText(name)}</div>` +
    renderFileBranch(node.dirs[name], depth + 1)
  )).join('');
  node.files.forEach((file) => {
    const active = file.path === project.active ? ' active' : '';
    html += `<button type="button" class="file-row${active}" data-action="open" data-path="${escapeText(file.path)}">
      <span class="file-indent" style="width:${pad}px"></span>
      <i class="${fileIcon(file.path)}"></i>
      <span class="file-label">${escapeText(file.name)}</span>
      <span class="file-actions">
        <span class="file-icon-btn" data-action="rename" data-path="${escapeText(file.path)}" title="Rename"><i class="fa-solid fa-pen"></i></span>
        <span class="file-icon-btn" data-action="delete" data-path="${escapeText(file.path)}" title="Delete"><i class="fa-solid fa-trash"></i></span>
      </span>
    </button>`;
  });
  return html;
}

function renderFiles() {
  const tree = document.getElementById('fileTree');
  const tabs = document.getElementById('editorTabs');
  if (tree) tree.innerHTML = renderFileBranch(fileTree(Object.keys(project.files)), 0);
  if (tabs) {
    tabs.innerHTML = project.open.map((path) => {
      const active = path === project.active ? ' active' : '';
      const name = path.split('/').pop();
      return `<button type="button" class="editor-tab${active}" data-action="open" data-path="${escapeText(path)}" title="${escapeText(path)}"><span>${escapeText(name)}</span><span class="tab-close" data-action="close" data-path="${escapeText(path)}" title="Close">×</span></button>`;
    }).join('');
  }
  updateFileStatus();
}

function openFile(path) {
  if (project.files[path] == null) return;
  project.active = path;
  currentCode = project.files[path];
  if (!project.open.includes(path)) project.open.push(path);
  if (editor && typeof monaco !== 'undefined') editor.setModel(ensureModel(path));
  renderFiles();
  clearErrors();
  scheduleSave();
}

function createFile(raw) {
  let path = normalizePath(String(raw || '').trim());
  if (!path) throw new Error('Enter a file name, like src/Button.jsx');
  if (!path.includes('/')) path = 'src/' + path;
  if (!/\.[a-z0-9]+$/i.test(path)) path += '.jsx';
  if (project.files[path] != null) {
    openFile(path);
    return;
  }
  const base = path.split('/').pop().replace(/\.[^.]+$/, '');
  const ident = base.replace(/[^A-Za-z0-9_$]/g, '') || 'Component';
  const name = /^[A-Za-z_$]/.test(ident) ? ident : 'Component';
  let content = `export default function ${name}() {\n  return <div>${name}</div>;\n}\n`;
  if (/\.css$/i.test(path)) content = `/* ${path} */\n`;
  else if (/\.json$/i.test(path)) content = '{\n  "title": ""\n}\n';
  else if (/\.(js|ts)$/i.test(path)) content = `export function ${name}() {\n  return null;\n}\n`;
  project.files[path] = content;
  if (typeof monaco !== 'undefined') ensureModel(path);
  openFile(path);
}

function renameFile(oldPath, raw) {
  let nextPath = normalizePath(String(raw || '').trim());
  if (!nextPath) throw new Error('Enter a file path');
  if (!/\.[a-z0-9]+$/i.test(nextPath)) {
    const ext = oldPath.includes('.') ? oldPath.slice(oldPath.lastIndexOf('.')) : '.jsx';
    nextPath += ext;
  }
  if (nextPath === oldPath) {
    renderFiles();
    return;
  }
  if (project.files[nextPath] != null) throw new Error(nextPath + ' already exists');
  const snapshot = { ...project.files };
  Object.keys(snapshot).forEach((file) => {
    if (file === oldPath || !/\.(jsx|js|tsx|ts)$/i.test(file)) return;
    const updated = snapshot[file].replace(
      /(from\s+|import\s+)(['"])([^'"]+)\2/g,
      (full, lead, quote, spec) => {
        if (!spec.startsWith('.')) return full;
        if (resolveImportPath(file, spec, snapshot) !== oldPath) return full;
        return lead + quote + relativeImport(file, nextPath) + quote;
      }
    );
    if (updated !== snapshot[file]) setModelValue(file, updated);
  });
  project.files[nextPath] = project.files[oldPath];
  delete project.files[oldPath];
  project.open = project.open.map((file) => (file === oldPath ? nextPath : file));
  if (typeof monaco !== 'undefined') {
    const oldModel = monaco.editor.getModel(monaco.Uri.parse('file:///' + oldPath));
    if (oldModel) {
      if (editor && editor.getModel() === oldModel) editor.setModel(null);
      oldModel.dispose();
    }
    ensureModel(nextPath);
  }
  project.active = nextPath;
  openFile(nextPath);
}

function deleteFile(path) {
  const codeFiles = Object.keys(project.files).filter((file) => /\.(jsx|js|tsx|ts)$/i.test(file));
  if (codeFiles.length === 1 && codeFiles[0] === path) {
    showError('Keep at least one JavaScript file.');
    return;
  }
  if (!confirm('Delete ' + path + '?')) return;
  delete project.files[path];
  project.open = project.open.filter((file) => file !== path);
  if (typeof monaco !== 'undefined') {
    const model = monaco.editor.getModel(monaco.Uri.parse('file:///' + path));
    if (model) {
      if (editor && editor.getModel() === model) editor.setModel(null);
      model.dispose();
    }
  }
  if (project.active === path) {
    const next = project.open[0] || Object.keys(project.files)[0];
    if (next) openFile(next);
    else renderFiles();
  } else {
    renderFiles();
    scheduleSave();
  }
}

function closeTab(path) {
  if (project.open.length === 1) return;
  const index = project.open.indexOf(path);
  project.open = project.open.filter((file) => file !== path);
  if (project.active === path) openFile(project.open[Math.max(0, index - 1)]);
  else {
    renderFiles();
    scheduleSave();
  }
}

function startRename(path) {
  const row = [...document.querySelectorAll('.file-row')].find((item) => item.dataset.path === path);
  if (!row) return;
  const input = document.createElement('input');
  input.className = 'rename-input';
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
      renderFiles();
      return;
    }
    try { renameFile(path, input.value); }
    catch (error) {
      showError(error.message);
      renderFiles();
    }
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
}

function bindFileUI() {
  const tree = document.getElementById('fileTree');
  const tabs = document.getElementById('editorTabs');
  const form = document.getElementById('newFileForm');
  const input = document.getElementById('newFileInput');
  const button = document.getElementById('newFileBtn');
  if (button && form && input) {
    button.onclick = () => {
      form.hidden = false;
      input.value = '';
      input.focus();
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      try {
        createFile(input.value);
        form.hidden = true;
        input.value = '';
      } catch (error) {
        showError(error.message);
      }
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        form.hidden = true;
      } else if (event.key === 'Enter') {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  }
  const onTreeClick = (event) => {
    const node = event.target.closest('[data-action]');
    if (!node) return;
    const path = node.dataset.path;
    if (node.dataset.action === 'rename') startRename(path);
    else if (node.dataset.action === 'delete') deleteFile(path);
    else openFile(path);
  };
  if (tree) {
    tree.addEventListener('click', onTreeClick);
    tree.addEventListener('dblclick', (event) => {
      const row = event.target.closest('.file-row');
      if (!row || event.target.closest('[data-action="delete"]')) return;
      startRename(row.dataset.path);
    });
  }
  if (tabs) {
    tabs.addEventListener('click', (event) => {
      const node = event.target.closest('[data-action]');
      if (!node) return;
      if (node.dataset.action === 'close') closeTab(node.dataset.path);
      else openFile(node.dataset.path);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      run();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (editor && project.active) project.files[project.active] = editor.getValue();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); } catch { /* ignore */ }
      const consoleDiv = document.getElementById('console');
      if (consoleDiv) consoleDiv.innerHTML += '<span class="console-line log">> ✓ Project saved</span>';
    }
  });
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

      setTimeout(() => {
        if (editor) run();
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

const LAYOUT_KEY = 'suite-react-layout';
let paneLayout = {
  filesOpen: true,
  consoleOpen: true,
  previewSize: 0,
  consoleHeight: 200
};

function loadPaneLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
    paneLayout = {
      filesOpen: saved.filesOpen !== false,
      consoleOpen: saved.consoleOpen !== false,
      previewSize: Number(saved.previewSize) || 0,
      consoleHeight: Math.max(80, Number(saved.consoleHeight) || 200)
    };
  } catch { /* keep defaults */ }
}

function savePaneLayout() {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(paneLayout)); }
  catch { /* private mode */ }
}

function previewIsStacked() {
  const container = document.querySelector('.container');
  return container && getComputedStyle(container).flexDirection === 'column';
}

function clampPreview(size) {
  const container = document.querySelector('.container');
  if (!container) return size;
  const total = previewIsStacked() ? container.clientHeight : container.clientWidth;
  return Math.max(220, Math.min(size, Math.max(220, total - 280)));
}

function applyPaneLayout() {
  const preview = document.getElementById('previewPanel');
  const consolePanel = document.getElementById('consolePanel');
  const showConsole = document.getElementById('showConsoleBtn');
  document.body.classList.toggle('files-collapsed', !paneLayout.filesOpen);
  document.body.classList.toggle('console-collapsed', !paneLayout.consoleOpen);
  if (preview) {
    if (paneLayout.previewSize) {
      const size = clampPreview(paneLayout.previewSize);
      preview.style.flex = '0 0 ' + size + 'px';
    } else {
      preview.style.flex = '';
    }
  }
  if (consolePanel) consolePanel.style.height = paneLayout.consoleHeight + 'px';
  if (showConsole) showConsole.hidden = paneLayout.consoleOpen;
  if (editor && editor.layout) editor.layout();
  fitPreview();
}

function fitPreview() {
  const stage = document.querySelector('.preview-stage');
  const frame = document.getElementById('preview');
  if (!stage || !frame) return;
  frame.style.width = stage.clientWidth + 'px';
  frame.style.height = stage.clientHeight + 'px';
}

function bindPaneDrag(handle, onMove) {
  if (!handle) return;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    try { handle.setPointerCapture(event.pointerId); } catch { /* drag still follows the pointer */ }
    handle.classList.add('dragging');
    document.body.classList.add('pane-dragging');
  });
  handle.addEventListener('pointermove', (event) => {
    if (!handle.classList.contains('dragging')) return;
    onMove(event);
    applyPaneLayout();
  });
  const stop = () => {
    if (!handle.classList.contains('dragging')) return;
    handle.classList.remove('dragging');
    document.body.classList.remove('pane-dragging');
    savePaneLayout();
    applyPaneLayout();
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}

function bindPaneLayout() {
  loadPaneLayout();
  applyPaneLayout();
  const filesBtn = document.getElementById('toggleFilesBtn');
  const showFiles = document.getElementById('showFilesBtn');
  const consoleBtn = document.getElementById('toggleConsoleBtn');
  const showConsole = document.getElementById('showConsoleBtn');
  const toggleFiles = () => {
    paneLayout.filesOpen = !paneLayout.filesOpen;
    savePaneLayout();
    applyPaneLayout();
  };
  const toggleConsole = () => {
    paneLayout.consoleOpen = !paneLayout.consoleOpen;
    savePaneLayout();
    applyPaneLayout();
  };
  if (filesBtn) filesBtn.onclick = toggleFiles;
  if (showFiles) showFiles.onclick = toggleFiles;
  if (consoleBtn) consoleBtn.onclick = toggleConsole;
  if (showConsole) showConsole.onclick = toggleConsole;

  bindPaneDrag(document.getElementById('previewSplit'), (event) => {
    const rect = document.querySelector('.container').getBoundingClientRect();
    const size = previewIsStacked() ? rect.bottom - event.clientY : rect.right - event.clientX;
    paneLayout.previewSize = clampPreview(size);
  });
  bindPaneDrag(document.getElementById('consoleSplit'), (event) => {
    const rect = document.querySelector('.editor-column').getBoundingClientRect();
    paneLayout.consoleHeight = Math.max(80, Math.min(rect.bottom - event.clientY, rect.height - 120));
  });
  window.addEventListener('resize', () => applyPaneLayout());
  const stage = document.querySelector('.preview-stage');
  if (stage && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => fitPreview()).observe(stage);
  }
  fitPreview();
}

renderFiles();
bindFileUI();
bindPaneLayout();