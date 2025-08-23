let editor = null;
let currentFileHandle = null;
let fileContentModified = false;
let lastSavedContent = '';
let currentLanguage = localStorage.getItem('editor:lang') || 'javascript';

const KEYS = {
  codeJS: 'userCode:javascript',
  codeTS: 'userCode:typescript',
  lang: 'editor:lang',
  lastFileContent: 'lastFileContent',
  lastOpenedFileName: 'lastOpenedFileName',
  lastOpenedFileId: 'lastOpenedFileId',
};

// ----- Monaco loader -----
require.config({
  paths: {
    vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs"
  }
});

require(["vs/editor/editor.main"], function () {
  // Themes
  monaco.editor.defineTheme('sunilTheme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'operator', foreground: 'D4D4D4' }
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editorCursor.foreground': '#AEAFAD',
      'editor.lineHighlightBackground': '#2D2D30',
      'editorLineNumber.foreground': '#858585',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41'
    }
  });

  monaco.editor.defineTheme('sunilDarkPro', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'variable.parameter', foreground: '9CDCFE' },
      { token: 'variable.predefined', foreground: '4FC1FF' },
      { token: 'constant', foreground: '569CD6' },
      { token: 'class', foreground: '4EC9B0', fontStyle: 'bold' },
      { token: 'interface', foreground: '4EC9B0' },
      { token: 'namespace', foreground: '569CD6' },
      { token: 'regexp', foreground: 'D16969' },
      { token: 'meta', foreground: 'D4D4D4' },
      { token: 'tag', foreground: '569CD6' },
      { token: 'tag.attribute.name', foreground: '9CDCFE' },
      { token: 'attribute.name', foreground: '9CDCFE' },
      { token: 'attribute.value', foreground: 'CE9178' },
      { token: 'string.key', foreground: '9CDCFE' },
      { token: 'string.value', foreground: 'CE9178' },
      { token: 'delimiter.html', foreground: '808080' },
      { token: 'tag.html', foreground: '569CD6' },
      { token: 'attribute.name.css', foreground: 'D7BA7D' },
      { token: 'attribute.value.css', foreground: 'CE9178' }
    ],
    colors: {
      'editor.background': '#1E1E2E',
      'editor.foreground': '#F8F8F2',
      'editor.selectionBackground': '#264F78',
      'editor.selectionHighlightBackground': '#2D2D4A',
      'editor.inactiveSelectionBackground': '#3A3D41',
      'editorWidget.background': '#252537',
      'editorWidget.border': '#454545',
      'editorSuggestWidget.background': '#252537',
      'editorSuggestWidget.border': '#454545',
      'editorSuggestWidget.foreground': '#D4D4D4',
      'editorSuggestWidget.highlightForeground': '#18A3FF',
      'editorSuggestWidget.selectedBackground': '#062F4A',
      'editorCursor.foreground': '#F8F8F2',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#C6C6C6',
      'editor.lineHighlightBackground': '#2D2D45',
      'editor.lineHighlightBorder': '#282840',
      'editorGutter.background': '#1E1E2E',
      'editorBracketMatch.background': '#0D3A58',
      'editorBracketMatch.border': '#216694',
      'editorOverviewRuler.border': '#7F7F7F4D',
      'editorOverviewRuler.findMatchForeground': '#F8C55499',
      'editorOverviewRuler.rangeHighlightForeground': '#007ACC99',
      'editorOverviewRuler.selectionHighlightForeground': '#A0A0A0CC',
      'editorOverviewRuler.wordHighlightForeground': '#A0A0A0CC',
      'editorOverviewRuler.wordHighlightStrongForeground': '#C0A0C0CC',
      'scrollbarSlider.activeBackground': '#6F6F9380',
      'scrollbarSlider.background': '#48485E40',
      'scrollbarSlider.hoverBackground': '#5A5A7A60'
    }
  });

  // TS/JS compiler/intellisense defaults
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowJs: true,
    checkJs: true,
    strict: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    esModuleInterop: true,
    lib: ["es2020", "dom"]
  });
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
  });

  // Create editor
  editor = monaco.editor.create(document.getElementById("editor"), {
    language: currentLanguage,
    theme: "sunilDarkPro",
    automaticLayout: true,
    minimap: { enabled: true, renderCharacters: false, showSlider: "always", maxColumn: 80 },
    scrollBeyondLastLine: true,
    fontFamily: "'Fira Code', 'Consolas', monospace",
    fontLigatures: true,
    fontSize: 14,
    lineHeight: 22,
    lineNumbers: "on",
    renderLineHighlight: "all",
    roundedSelection: true,
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: true,
    smoothScrolling: true,
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
      vertical: "visible",
      horizontal: "visible",
      useShadows: true
    },
    snippetSuggestions: "top",
    wordWrap: "on",
    wordWrapColumn: 80,
    wrappingIndent: "same",
    autoIndent: "full",
    formatOnPaste: true,
    formatOnType: true,
    renderWhitespace: "selection",
    renderControlCharacters: true,
    bracketPairColorization: { enabled: true },
    folding: true,
    glyphMargin: true,
    contextmenu: true,
    codeLens: true,
    colorDecorators: true,
    suggest: { filterGraceful: true, showIcons: true, maxVisibleSuggestions: 12, preview: true, snippetsPreventQuickSuggestions: false },
    parameterHints: { enabled: true, cycle: true }
  });

  // Restore per-language code
  const initialCode = localStorage.getItem(currentLanguage === 'typescript' ? KEYS.codeTS : KEYS.codeJS)
    || (currentLanguage === 'typescript'
        ? `// TypeScript sample\nfunction greet(name: string): string { return "Hi " + name }\nconsole.log(greet("Sunil"));`
        : `console.log("Best of luck with your learning journey! 🚀 Keep coding and keep growing! 😊")`);
  editor.setValue(initialCode);

  // Wire UI
  const outputElement = document.getElementById("output");
  const langSelect = document.getElementById("language");
  if (langSelect) {
    langSelect.value = currentLanguage;
    langSelect.addEventListener("change", () => {
      currentLanguage = langSelect.value;
      localStorage.setItem(KEYS.lang, currentLanguage);
      monaco.editor.setModelLanguage(editor.getModel(), currentLanguage);
      // Load saved code for that language (don’t nuke current code if same)
      const saved = localStorage.getItem(currentLanguage === 'typescript' ? KEYS.codeTS : KEYS.codeJS);
      if (saved != null) editor.setValue(saved);
      setStatus(currentLanguage.toUpperCase());
    });
  }

  // Persist code per language
  editor.onDidChangeModelContent(() => {
    fileContentModified = true;
    const key = currentLanguage === 'typescript' ? KEYS.codeTS : KEYS.codeJS;
    localStorage.setItem(key, editor.getValue());
    setStatus('Modified', 'orange');
  });

  // Buttons
  document.getElementById("clear").addEventListener("click", () => outputElement.innerText = "");
  document.getElementById("run").addEventListener("click", runCode);
  document.getElementById("format").addEventListener("click", formatCode);
  document.getElementById("openFileBtn").addEventListener("click", openFile);
  document.getElementById("saveFileBtn").addEventListener("click", saveFile);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Try restore last file (FS Access, if available)
  (async () => {
    const restored = await tryRestoreLastFile();
    if (!restored) restoreFromLocalSession();
  })();

  // Warn about unsaved changes + autosave session
  window.addEventListener('beforeunload', function (e) {
    if (editor) localStorage.setItem(KEYS.lastFileContent, editor.getValue());
    if (fileContentModified) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  });

  // After a short delay, offer recovery if needed
  setTimeout(recoverUnsavedContent, 800);
});

// ---------- Helpers ----------
function setStatus(text, color) {
  const el = document.getElementById('fileStatus');
  if (!el) return;
  el.textContent = text;
  el.style.color = color || 'var(--muted)';
}

function showToast(message, type) {
  const toastContainer = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type || ''}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2500);
}

// ---------- Run (JS or TS->JS) ----------
function runCode() {
  const code = editor.getValue();
  const outputElement = document.getElementById("output");
  outputElement.innerText = "— Running —\n";

  const execute = (js) => {
    // capture console to output pane
    const original = { log: console.log, error: console.error, warn: console.warn, info: console.info };
    console.log = (...a) => (outputElement.innerText += a.map(String).join(" ") + "\n");
    console.error = (...a) => (outputElement.innerText += "Error: " + a.map(String).join(" ") + "\n");
    console.warn = (...a) => (outputElement.innerText += "Warning: " + a.map(String).join(" ") + "\n");
    console.info = (...a) => (outputElement.innerText += "Info: " + a.map(String).join(" ") + "\n");
    try { new Function(js)(); } catch (e) { outputElement.innerText += String(e) + "\n"; }
    finally {
      console.log = original.log; console.error = original.error; console.warn = original.warn; console.info = original.info;
    }
  };

  if (currentLanguage === 'typescript') {
    if (!window.ts || !ts.transpileModule) {
      showToast('TypeScript compiler not loaded', 'error');
      return;
    }
    try {
      const result = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2017,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
          strict: true
        }
      });
      execute(result.outputText);
    } catch (e) {
      outputElement.innerText += `Transpile error: ${e && e.message ? e.message : e}\n`;
    }
  } else {
    execute(code);
  }
}

// ---------- Format ----------
function formatCode() {
  const code = editor.getValue();
  if (!code.trim()) return;

  if (currentLanguage === 'typescript') {
    // Prefer Monaco’s formatter for TS
    editor.getAction('editor.action.formatDocument').run().then(() => {
      setStatus('Formatted');
      const out = document.getElementById("output");
      out.innerText = "✅ Formatted by Monaco (TS)\n";
      setTimeout(() => (out.innerText = ""), 1000);
    }).catch(() => showToast('TS formatter not available', 'error'));
    return;
  }

  // JS path: use beautify if available, else Monaco
  const beautifyFn = window.js_beautify || window.beautify || window.jsbeautify;
  if (typeof beautifyFn === 'function') {
    const formatted = beautifyFn(code, {
      indent_size: 2,
      space_in_empty_paren: true,
      preserve_newlines: true,
      max_preserve_newlines: 2,
      wrap_line_length: 100,
      indent_with_tabs: false,
      end_with_newline: true,
      brace_style: "collapse,preserve-inline"
    });
    editor.setValue(formatted);
    const out = document.getElementById("output");
    out.innerText = "✅ Code formatted successfully!\n";
    setStatus('Formatted');
    setTimeout(() => (out.innerText = ""), 800);
  } else {
    editor.getAction('editor.action.formatDocument').run().then(() => {
      const out = document.getElementById("output");
      out.innerText = "✅ Formatted by Monaco (JS)\n";
      setTimeout(() => (out.innerText = ""), 800);
    });
  }
}

// ---------- File actions ----------
async function openFile() {
  try {
    if (!('showOpenFilePicker' in window)) {
      showToast('Use Chrome/Edge for file access features.', 'warning');
      return;
    }
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'JS/TS Files',
          accept: {
            'text/javascript': ['.js'],
            'text/typescript': ['.ts'],
            'application/typescript': ['.ts']
          }
        }
      ],
      multiple: false
    });

    currentFileHandle = fileHandle;

    if (fileHandle.requestPermission) {
      await fileHandle.requestPermission({ mode: 'readwrite' });
    }

    const file = await fileHandle.getFile();
    const content = await file.text();

    // Guess language by extension
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    currentLanguage = ext === 'ts' ? 'typescript' : 'javascript';
    localStorage.setItem(KEYS.lang, currentLanguage);

    // Update UI/editor
    if (editor) {
      monaco.editor.setModelLanguage(editor.getModel(), currentLanguage);
      editor.setValue(content);
    }
    lastSavedContent = content;
    localStorage.setItem(KEYS.lastFileContent, content);
    localStorage.setItem(KEYS.lastOpenedFileName, file.name);

    const langSelect = document.getElementById('language');
    if (langSelect) langSelect.value = currentLanguage;

    document.getElementById('fileName').textContent = file.name;
    setStatus('Opened', 'green');
    fileContentModified = false;
  } catch (error) {
    console.error('Error opening file:', error);
    showToast(`Error opening file: ${error.message}`, "error");
  }
}

async function saveFile() {
  if (!currentFileHandle) return await saveFileAs();
  try {
    if (currentFileHandle.requestPermission) {
      const state = await currentFileHandle.requestPermission({ mode: 'readwrite' });
      if (state !== 'granted') throw new Error('Write permission denied');
    }

    // Format before save to keep file tidy
    await Promise.resolve(formatCode());

    const writable = await currentFileHandle.createWritable();
    const content = editor.getValue();
    await writable.write(content);
    await writable.close();

    lastSavedContent = content;
    localStorage.setItem(KEYS.lastFileContent, content);
    setStatus('Saved', 'green');
    fileContentModified = false;
    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    showToast(`Error saving file: ${error.message}`, "error");
    setStatus('Error saving', 'red');
    return false;
  }
}

async function saveFileAs() {
  try {
    if (!('showSaveFilePicker' in window)) {
      showToast('Use Chrome/Edge for file access features.', 'warning');
      return false;
    }

    const suggestedName =
      currentFileHandle ? currentFileHandle.name :
      (localStorage.getItem(KEYS.lastOpenedFileName) || (currentLanguage === 'typescript' ? 'file.ts' : 'file.js'));

    const fileHandle = await window.showSaveFilePicker({
      types: [
        {
          description: 'JS/TS Files',
          accept: {
            'text/javascript': ['.js'],
            'text/typescript': ['.ts'],
            'application/typescript': ['.ts']
          }
        }
      ],
      suggestedName
    });

    currentFileHandle = fileHandle;
    if (fileHandle.requestPermission) {
      await fileHandle.requestPermission({ mode: 'readwrite' });
    }

    const file = await fileHandle.getFile();
    document.getElementById('fileName').textContent = file.name;

    return await saveFile();
  } catch (error) {
    console.error('Error in Save As:', error);
    showToast(`Error saving file: ${error.message}`, "error");
    return false;
  }
}

// Restore previously opened file (if your environment provides an ID-based API)
// Kept simple; falls back to localStorage session restore.
async function tryRestoreLastFile() {
  try {
    // No cross-origin stable FileHandle IDs on most browsers; skip.
    return false;
  } catch {
    return false;
  }
}

function restoreFromLocalSession() {
  const savedContent = localStorage.getItem(KEYS.lastFileContent);
  const fileName = localStorage.getItem(KEYS.lastOpenedFileName);
  if (savedContent) {
    editor && editor.setValue(savedContent);
    lastSavedContent = savedContent;
    if (fileName) document.getElementById('fileName').textContent = fileName;
    setStatus('Restored (Session)', 'orange');
  } else {
    document.getElementById('fileName').textContent = 'Untitled';
    setStatus(currentLanguage.toUpperCase());
  }
}

function newFile() {
  if (fileContentModified && !confirm('You have unsaved changes. Create a new file anyway?')) return;

  editor && editor.setValue('');
  lastSavedContent = '';
  currentFileHandle = null;

  localStorage.removeItem(KEYS.lastOpenedFileId);
  localStorage.setItem(KEYS.lastOpenedFileName, 'Untitled');
  localStorage.setItem(KEYS.lastFileContent, '');

  document.getElementById('fileName').textContent = 'Untitled';
  setStatus('New');
  fileContentModified = false;
}

function recoverUnsavedContent() {
  const savedContent = localStorage.getItem(KEYS.lastFileContent);
  if (savedContent && (!currentFileHandle || (editor && editor.getValue() !== savedContent))) {
    if (confirm('Unsaved content from your previous session was found. Recover it?')) {
      editor && editor.setValue(savedContent);
      const fileName = localStorage.getItem(KEYS.lastOpenedFileName) || 'Recovered';
      document.getElementById('fileName').textContent = fileName;
      setStatus('Recovered', 'blue');
    }
  }
}

// Shortcuts: Save, Open, New, Run, Format
function handleKeyboardShortcuts(e) {
  // Save
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (currentFileHandle) saveFile(); else saveFileAs();
  }
  // Open
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    openFile();
  }
  // New
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    newFile();
  }
  // Run (Ctrl/Cmd + Enter)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runCode();
  }
  // Format (Alt + Shift + F)
  if (e.altKey && e.shiftKey && (e.key.toLowerCase() === 'f')) {
    e.preventDefault();
    formatCode();
  }
}

// --------- Optional: small JS completions example ----------
document.addEventListener('DOMContentLoaded', function () {
  if (typeof monaco !== 'undefined') {
    monaco.languages.registerCompletionItemProvider("javascript", {
      provideCompletionItems: () => ({
        suggestions: [{
          label: "log",
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'console.log($1);',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        }]
      })
    });
    monaco.languages.registerCompletionItemProvider("typescript", {
      provideCompletionItems: () => ({
        suggestions: [{
          label: "type-log",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'function log<T>(v: T): T { console.log(v); return v; }\nlog($1);',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        }]
      })
    });
  }
});
