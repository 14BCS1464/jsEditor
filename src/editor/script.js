// ===================== script.js (Complete, single file) =====================

// Globals
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

// ---------------- Monaco Loader ----------------
require.config({
  paths: {
    vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs"
  }
});

require(["vs/editor/editor.main"], function () {
  // ---------------- Themes ----------------
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

  // ---------------- Compiler Profiles + Helpers ----------------

  const JS_PROFILE = {
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowJs: true,
    checkJs: true,
    noEmit: true,
    strict: false,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    esModuleInterop: true,
   // lib: ["es2020", "dom"],
  };

  const TS_PROFILE = {
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowJs: true,
    checkJs: true,
    strict: true,
    noImplicitAny: true,
    alwaysStrict: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    isolatedModules: true,
    //lib: ["es2020", "dom"],
  };

  function applyCompilerFor(lang) {
    if (lang === 'typescript') {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({ ...TS_PROFILE });
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    } else {
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ ...JS_PROFILE });
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    }
  }

  // ---------------- Create Models + Editor ----------------
  const initialJS =
    localStorage.getItem(KEYS.codeJS) ||
`// Welcome to our Code Editor! Master JavaScript with simple, fun examples.
function increment(num) { return num + 1; }
console.log(increment(5)); // Output: 6
`;

  const initialTS =
    localStorage.getItem(KEYS.codeTS) ||
`// Welcome to our Code Editor! Learn TypeScript and improve your skills.
function decrement(num: number): number { return num - 1; }
console.log(decrement(10)); // Output: 9
`;

  const jsModel = monaco.editor.createModel(
    initialJS, "javascript", monaco.Uri.parse("inmemory://model/main.js")
  );
  const tsModel = monaco.editor.createModel(
    initialTS, "typescript", monaco.Uri.parse("inmemory://model/main.ts")
  );
  const models = { javascript: jsModel, typescript: tsModel };

  editor = monaco.editor.create(document.getElementById("editor"), {
    model: models[currentLanguage],
    theme: "sunilDarkPro",
    automaticLayout: true,
    minimap: { enabled: true, renderCharacters: false, showSlider: "always", maxColumn: 80 },
    scrollBeyondLastLine: true,
    fontFamily: "'Fira Code', 'Consolas', monospace",
    fontLigatures: true,
    fontSize: 20,
    lineHeight: 30,
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

  // Apply initial compiler rules for the starting language
  applyCompilerFor(currentLanguage);

  // ---------------- Initial Content / Session restore ----------------
  restoreFromLocalSession(); // updates filename/status; model already has content

  // Persist code per language
  editor.onDidChangeModelContent(() => {
    fileContentModified = true;
    const lang = editor.getModel().getLanguageId();
    const key = lang === 'typescript' ? KEYS.codeTS : KEYS.codeJS;
    localStorage.setItem(key, editor.getValue());
    setStatus('Modified', 'orange');
  });

  // ---------------- Wire UI ----------------
  const langSelect = document.getElementById("language");
  if (langSelect) {
    langSelect.value = currentLanguage;
    langSelect.addEventListener("change", () => switchLanguage(langSelect.value));
  }

  document.getElementById("clear")?.addEventListener("click", () => setOutput(""));
  document.getElementById("run")?.addEventListener("click", runCode);
  document.getElementById("format")?.addEventListener("click", formatCode);
  document.getElementById("openFileBtn")?.addEventListener("click", openFile);
  document.getElementById("saveFileBtn")?.addEventListener("click", saveFile);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Try restore last file / session
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

  // Recovery prompt
  setTimeout(recoverUnsavedContent, 800);

  // ---------------- Optional: Small JS/TS completions ----------------
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

  // ------------- language switching (swap models + swap compiler rules) -------------
  function switchLanguage(lang) {
    if (lang !== 'javascript' && lang !== 'typescript') return;

    // Persist current model content
    const currentModel = editor.getModel();
    const currentLang = currentModel.getLanguageId();
    const currentKey = currentLang === 'typescript' ? KEYS.codeTS : KEYS.codeJS;
    localStorage.setItem(currentKey, currentModel.getValue());

    currentLanguage = lang;
    localStorage.setItem(KEYS.lang, currentLanguage);

    // Apply compiler rules for selected language
    applyCompilerFor(currentLanguage);

    // Switch model
    editor.setModel(models[currentLanguage]);

    // Hydrate from localStorage if present
    const saved = localStorage.getItem(currentLanguage === 'typescript' ? KEYS.codeTS : KEYS.codeJS);
    if (saved != null) editor.setValue(saved);

    // Update UI
    setStatus(currentLanguage.toUpperCase());
    const fileName = localStorage.getItem(KEYS.lastOpenedFileName) ||
      `Untitled.${currentLanguage === 'typescript' ? 'ts' : 'js'}`;
    document.getElementById('fileName') && (document.getElementById('fileName').textContent = fileName);
    document.getElementById('language') && (document.getElementById('language').value = currentLanguage);
  }

  // Expose for other functions
  window.__switchLanguage = switchLanguage;
});

// ---------------- Helpers ----------------
function setStatus(text, color) {
  const el = document.getElementById('fileStatus');
  if (!el) return;
  el.textContent = text;
  el.style.color = color || 'var(--muted)';
}

function showToast(message, type) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return alert(message);
  const toast = document.createElement('div');
  toast.className = `toast ${type || ''}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2500);
}

// -------- Output helpers (auto-scroll) --------
function getOutputEl() { return document.getElementById("output"); }
function getOutputSection() { return document.querySelector(".output-section"); }
function appendToOutput(text) {
  const out = getOutputEl();
  if (!out) return;
  out.innerText += text;

  const section = getOutputSection();
  if (section) section.scrollTop = section.scrollHeight;
  out.scrollTop = out.scrollHeight;

  requestAnimationFrame(() => {
    if (section) section.scrollTop = section.scrollHeight;
    out.scrollTop = out.scrollHeight;
  });
}
function setOutput(text) {
  const out = getOutputEl();
  if (!out) return;
  out.innerText = text;
  appendToOutput("");
}

// ---------------- Run (JS or TS->JS) ----------------
// Show full prototype chain recursively
const formatPrototypeChain = (proto, depth = 0, maxDepth = 10, seen = new WeakSet()) => {
  if (!proto) return `${'  '.repeat(depth)}[[Prototype]]: null`;

  const indent = '  '.repeat(depth);
  const protoName =
    proto.constructor?.name ||
    Object.prototype.toString.call(proto).slice(8, -1);

  if (seen.has(proto)) {
    return `${indent}[[Prototype]]: ${protoName} { [Circular] }`;
  }
  seen.add(proto); 

  let result = `${indent}[[Prototype]]: ${protoName} {\n`;

  if (depth > maxDepth) {
    result += `${indent}  [Max Depth Reached]\n`;
  } else {
    // Show own properties
    const props = Object.getOwnPropertyNames(proto);
    const symbols = Object.getOwnPropertySymbols(proto);

    for (const prop of props) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
      const value = descriptor?.value;
      const isAccessor = descriptor?.get || descriptor?.set;

      result += `${indent}  ${prop}: `;

      if (isAccessor) {
        result += `[Getter${descriptor.set ? '/Setter' : ''}]`;
      } else {
        result += typeof value === 'function'
          ? `ƒ ${value.name || 'anonymous'}() { [Function] }`
          : String(value);
      }
      result += `\n`;
    }

    for (const sym of symbols) {
      result += `${indent}  ${sym.toString()}: ${String(proto[sym])}\n`;
    }

    // Recurse to parent prototype
    const parent = Object.getPrototypeOf(proto);
    if (parent) {
      result += formatPrototypeChain(parent, depth + 1, maxDepth, seen);
    } else {
      result += `${indent}  [[Prototype]]: null\n`;
    }
  }

  result += `${indent}}\n`;
  return result;
};
function runCode() {
  const model = editor.getModel();
  const lang = model.getLanguageId();
  const code = editor.getValue();
  setOutput(`🚀 Running (${lang.toUpperCase()})...\n\n`);

  const execute = (js) => {
    // Store original console methods
    const original = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      dir: console.dir,
      table: console.table
    };

    // Override console methods to capture output
    console.log = (...a) => appendToOutput(a.map(String).join(" ") + "\n");
    console.error = (...a) => appendToOutput("Error: " + a.map(String).join(" ") + "\n");
    console.warn = (...a) => appendToOutput("Warning: " + a.map(String).join(" ") + "\n");
    console.info = (...a) => appendToOutput("Info: " + a.map(String).join(" ") + "\n");

    // Enhanced console.dir with Chrome-like hierarchy
    console.dir = (obj, options = {}) => {
      try {
        const maxDepth = options.depth || 10;
        const seen = new WeakSet();

        const inspectObject = (target, depth = 0, path = '') => {
          if (depth > maxDepth) return '[Max Depth Reached]';
          if (target === null) return 'null';
          if (target === undefined) return 'undefined';

          const indent = '  '.repeat(depth);
          const type = typeof target;

          // Handle primitives
          if (type === 'string') return `"${target}"`;
          if (type === 'number' || type === 'boolean') return String(target);
          if (type === 'bigint') return `${target}n`;
          if (type === 'symbol') return `Symbol(${target.description || target.toString().slice(7, -1)})`;

          // Handle functions
          if (type === 'function') {
            const funcName = target.name || 'anonymous';
            const isNative = target.toString().includes('[native code]');
            return `ƒ ${funcName}() { ${isNative ? '[native code]' : '[Function]'} }`;
          }

          // Handle arrays
          if (Array.isArray(target)) {
            if (seen.has(target)) return '[Circular]';
            seen.add(target);

            const preview = target.length > 3
              ? `Array(${target.length}) [${target.slice(0, 3).map(item => inspectObject(item, depth + 1)).join(', ')}, …]`
              : `Array(${target.length}) [${target.map(item => inspectObject(item, depth + 1)).join(', ')}]`;
            if (depth >= maxDepth) return preview;

            let result = `${preview}\n${indent}{`;
            for (let i = 0; i < target.length; i++) {
              result += `\n${indent}  ${i}: ${inspectObject(target[i], depth + 1, `${path}[${i}]`)}`;
            }

            // Non-index properties
            const ownProps = Object.getOwnPropertyNames(target).filter(prop => !(/^\d+$/.test(prop)) && prop !== 'length');
            for (const prop of ownProps) {
              const descriptor = Object.getOwnPropertyDescriptor(target, prop);
              const value = descriptor.value;
              const isAccessor = descriptor.get || descriptor.set;
              result += `\n${indent}  ${prop}: `;
              if (isAccessor) {
                result += `[Getter${descriptor.set ? '/Setter' : ''}]`;
                if (descriptor.get) {
                  try {
                    const getterValue = descriptor.get.call(target);
                    result += ` => ${inspectObject(getterValue, depth + 1, `${path}.${prop}`)}`;
                  } catch (e) {
                    result += ` [Getter Error: ${e.message}]`;
                  }
                }
              } else {
                result += inspectObject(value, depth + 1, `${path}.${prop}`);
              }
            }

            result += `\n${indent}}`;
            seen.delete(target);
            return result;
          }

          // Handle objects
          if (type === 'object') {
            if (seen.has(target)) return '[Circular]';
            seen.add(target);

            const objType = Object.prototype.toString.call(target).slice(8, -1);
            const constructorName = target.constructor?.name || objType;
            const preview = constructorName === 'Object' ? 'Object' : `${constructorName} {}`;
            if (depth >= maxDepth) return preview;

            let result = `${preview}\n${indent}{`;
            const ownProps = Object.getOwnPropertyNames(target);
            const ownSymbols = Object.getOwnPropertySymbols(target);

            for (const prop of ownProps) {
              const descriptor = Object.getOwnPropertyDescriptor(target, prop);
              const value = descriptor.value;
              const isAccessor = descriptor.get || descriptor.set;
              result += `\n${indent}  ${prop}: `;
              if (isAccessor) {
                result += `[Getter${descriptor.set ? '/Setter' : ''}]`;
                if (descriptor.get) {
                  try {
                    const getterValue = descriptor.get.call(target);
                    result += ` => ${inspectObject(getterValue, depth + 1, `${path}.${prop}`)}`;
                  } catch (e) {
                    result += ` [Getter Error: ${e.message}]`;
                  }
                }
              } else {
                result += inspectObject(value, depth + 1, `${path}.${prop}`);
              }
            }

            for (const sym of ownSymbols) {
              const value = target[sym];
              result += `\n${indent}  ${sym.toString()}: ${inspectObject(value, depth + 1, `${path}[${sym.toString()}]`)}`;
            }

let proto = Object.getPrototypeOf(target);
if (proto) {
  result += `\n${indent}${formatPrototypeChain(proto, depth + 1)}`;
}

          else if (proto && proto !== Object.prototype) {
              const protoName = proto.constructor?.name || Object.prototype.toString.call(proto).slice(8, -1);
              result += `\n${indent}  [[Prototype]]: ${protoName} { [Collapsed - Max Depth] }`;
            }

            result += `\n${indent}}`;
            seen.delete(target);
            return result;
          }

          return String(target);
        };

        const output = inspectObject(obj);
        appendToOutput("Dir:\n" + output + "\n\n");
      } catch (e) {
        appendToOutput("Dir: [Error: " + e.message + "]\n");
      }
    };

    // Enhanced console.table support
    console.table = (data, columns) => {
      try {
        let output = "Table:\n";

        if (Array.isArray(data)) {
          if (data.length === 0) {
            output += "(empty array)\n";
            appendToOutput(output);
            return;
          }

          // Create headers
          const headers = ["(index)"];
          const isObjectArray = data.some(item => typeof item === 'object' && item !== null);

          if (isObjectArray) {
            const allKeys = new Set();
            data.forEach(item => {
              if (typeof item === 'object' && item !== null) {
                Object.keys(item).forEach(key => allKeys.add(key));
              }
            });
            headers.push(...Array.from(allKeys));
          } else {
            headers.push("Value");
          }

          // Filter columns if specified
          const displayHeaders = columns ? ["(index)", ...columns.filter(col => headers.includes(col))] : headers;

          // Calculate column widths
          const colWidths = displayHeaders.map(header => {
            let maxWidth = header.length;
            data.forEach((item, index) => {
              let cellValue = "";
              if (header === "(index)") {
                cellValue = String(index);
              } else if (isObjectArray && typeof item === 'object' && item !== null) {
                cellValue = item[header] !== undefined ? String(item[header]) : "";
              } else if (header === "Value") {
                cellValue = String(item);
              }
              maxWidth = Math.max(maxWidth, cellValue.length);
            });
            return Math.min(maxWidth, 50);
          });

          // Create separator
          const separator = "+" + colWidths.map(w => "-".repeat(w + 2)).join("+") + "+\n";

          // Create header row
          output += separator;
          output += "|" + displayHeaders.map((header, i) => ` ${header.padEnd(colWidths[i])} `).join("|") + "|\n";
          output += separator;

          // Create data rows
          data.forEach((item, index) => {
            const row = displayHeaders.map((header, i) => {
              let cellValue = "";
              if (header === "(index)") {
                cellValue = String(index);
              } else if (isObjectArray && typeof item === 'object' && item !== null) {
                const val = item[header];
                cellValue = val !== undefined ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : "";
              } else if (header === "Value") {
                cellValue = typeof item === 'object' ? JSON.stringify(item) : String(item);
              }

              if (cellValue.length > colWidths[i]) {
                cellValue = cellValue.substring(0, colWidths[i] - 3) + "...";
              }

              return ` ${cellValue.padEnd(colWidths[i])} `;
            });
            output += "|" + row.join("|") + "|\n";
          });
          output += separator;

        } else if (typeof data === 'object' && data !== null) {
          const entries = Object.entries(data);
          if (entries.length === 0) {
            output += "(empty object)\n";
            appendToOutput(output);
            return;
          }

          const keyWidth = Math.min(Math.max(...entries.map(([key]) => key.length), 10), 30);
          const valueWidth = Math.min(Math.max(...entries.map(([, value]) => String(value).length), 10), 50);

          const separator = "+" + "-".repeat(keyWidth + 2) + "+" + "-".repeat(valueWidth + 2) + "+\n";

          output += separator;
          output += `| ${"Key".padEnd(keyWidth)} | ${"Value".padEnd(valueWidth)} |\n`;
          output += separator;

          entries.forEach(([key, value]) => {
            let keyStr = String(key);
            let valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

            if (keyStr.length > keyWidth) keyStr = keyStr.substring(0, keyWidth - 3) + "...";
            if (valueStr.length > valueWidth) valueStr = valueStr.substring(0, valueWidth - 3) + "...";

            output += `| ${keyStr.padEnd(keyWidth)} | ${valueStr.padEnd(valueWidth)} |\n`;
          });
          output += separator;

        } else {
          output += `Cannot display table for type: ${typeof data}\n`;
          output += `Value: ${String(data)}\n`;
        }

        appendToOutput(output + "\n");
      } catch (e) {
        appendToOutput("Table: [Error: " + e.message + "]\n");
      }
    };

    try {
      new Function(js)();
    } catch (e) {
      appendToOutput(String(e) + "\n");
    } finally {
      // Restore original console methods
      console.log = original.log;
      console.error = original.error;
      console.warn = original.warn;
      console.info = original.info;
      console.dir = original.dir;
      console.table = original.table;
    }
  };

  if (lang === 'typescript') {
    if (!window.ts || !ts.transpileModule) {
      showToast('TypeScript compiler not loaded', 'error');
      return;
    }
    try {
      const mco = monaco.languages.typescript.typescriptDefaults.getCompilerOptions?.() || {};
      const compilerOptions = {
        target: mapEnum(monaco.languages.typescript.ScriptTarget, ts.ScriptTarget, mco.target, ts.ScriptTarget.ES2020),
        module: mapEnum(monaco.languages.typescript.ModuleKind, ts.ModuleKind, mco.module, ts.ModuleKind.ESNext),
        jsx: mapEnum(monaco.languages.typescript.JsxEmit, ts.JsxEmit, (mco.jsx ?? monaco.languages.typescript.JsxEmit.ReactJSX), ts.JsxEmit.ReactJSX),
        moduleResolution: mapEnum(monaco.languages.typescript.ModuleResolutionKind, ts.ModuleResolutionKind, mco.moduleResolution, ts.ModuleResolutionKind.NodeJs),
        esModuleInterop: !!mco.esModuleInterop,
        strict: !!mco.strict,
        noImplicitAny: !!mco.noImplicitAny,
        alwaysStrict: !!mco.alwaysStrict,
        resolveJsonModule: !!mco.resolveJsonModule,
        isolatedModules: !!mco.isolatedModules,
        skipLibCheck: !!mco.skipLibCheck,
        allowJs: !!mco.allowJs,
        lib: Array.isArray(mco.lib) ? mco.lib.slice() : undefined,
      };
      const result = ts.transpileModule(code, { compilerOptions });
      execute(result.outputText);
    } catch (e) {
      appendToOutput(`Transpile error: ${e && e.message ? e.message : e}\n`);
    }
  } else {
    execute(code);
  }
}


function mapEnum(srcEnum, dstEnum, value, fallback) {
    const name = Object.keys(srcEnum).find(k => srcEnum[k] === value && isNaN(+k));
    return (name && Object.prototype.hasOwnProperty.call(dstEnum, name)) ? dstEnum[name] : fallback;
  }

// ---------------- Format ----------------
function formatCode() {
  const code = editor.getValue();
  if (!code.trim()) return;

  const lang = editor.getModel().getLanguageId();

  if (lang === 'typescript') {
    editor.getAction('editor.action.formatDocument').run().then(() => {
      setStatus('Formatted');
      setOutput("✅ Formatted by Monaco (TS)\n");
      setTimeout(() => setOutput(""), 1000);
    }).catch(() => showToast('TS formatter not available', 'error'));
    return;
  }

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
    setOutput("✅ Code formatted successfully!\n");
    setStatus('Formatted');
    setTimeout(() => setOutput(""), 800);
  } else {
    editor.getAction('editor.action.formatDocument').run().then(() => {
      setOutput("✅ Formatted by Monaco (JS)\n");
      setTimeout(() => setOutput(""), 800);
    });
  }
}

// ---------------- File actions ----------------
async function openFile() {
  try {
    if ('showOpenFilePicker' in window) {
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

      // Guess language by extension and switch model
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const lang = ext === 'ts' ? 'typescript' : 'javascript';
      if (window.__switchLanguage) window.__switchLanguage(lang);

      // Put content into the target model
      const model = monaco.editor.getModels().find(m => m.getLanguageId() === lang);
      if (model) model.setValue(content);

      lastSavedContent = content;
      localStorage.setItem(KEYS.lastFileContent, content);
      localStorage.setItem(KEYS.lastOpenedFileName, file.name);

      const langSelect = document.getElementById('language');
      if (langSelect) langSelect.value = lang;

      const nameEl = document.getElementById('fileName');
      if (nameEl) nameEl.textContent = file.name;
      setStatus('Opened', 'green');
      fileContentModified = false;
    } else {
      // Fallback input[type=file]
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.js,.ts';

      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) { showToast('No file selected', 'warning'); return; }

        const content = await file.text();
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const lang = ext === 'ts' ? 'typescript' : 'javascript';
        if (window.__switchLanguage) window.__switchLanguage(lang);

        const model = monaco.editor.getModels().find(m => m.getLanguageId() === lang);
        if (model) model.setValue(content);

        lastSavedContent = content;
        localStorage.setItem(KEYS.lastFileContent, content);
        localStorage.setItem(KEYS.lastOpenedFileName, file.name);

        const langSelect = document.getElementById('language');
        if (langSelect) langSelect.value = lang;

        const nameEl = document.getElementById('fileName');
        if (nameEl) nameEl.textContent = file.name;
        setStatus('Opened', 'green');
        fileContentModified = false;

        input.remove();
      };

      input.click();
    }
  } catch (error) {
    console.error('Error opening file:', error);
    showToast(`Error opening file: ${error.message}`, 'error');
  }
}

async function saveFile() {
  // Format before save to keep file tidy
  await Promise.resolve(formatCode());

  if (!currentFileHandle && 'showSaveFilePicker' in window) {
    return await saveFileAs();
  }

  try {
    const content = editor.getValue();

    if (currentFileHandle && 'createWritable' in currentFileHandle) {
      if (currentFileHandle.requestPermission) {
        const state = await currentFileHandle.requestPermission({ mode: 'readwrite' });
        if (state !== 'granted') throw new Error('Write permission denied');
      }

      const writable = await currentFileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      lastSavedContent = content;
      localStorage.setItem(KEYS.lastFileContent, content);
      setStatus('Saved', 'green');
      fileContentModified = false;
      return true;
    } else {
      // Fallback: download
      const blob = new Blob([content], { type: 'text/plain' });
      const lang = editor.getModel().getLanguageId();
      const fileName = localStorage.getItem(KEYS.lastOpenedFileName) || (lang === 'typescript' ? 'file.ts' : 'file.js');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      a.remove();

      lastSavedContent = content;
      localStorage.setItem(KEYS.lastFileContent, content);
      setStatus('Saved (Downloaded)', 'green');
      fileContentModified = false;
      return true;
    }
  } catch (error) {
    console.error('Error saving file:', error);
    showToast(`Error saving file: ${error.message}`, 'error');
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

    const lang = editor.getModel().getLanguageId();
    const suggestedName =
      currentFileHandle ? currentFileHandle.name :
      (localStorage.getItem(KEYS.lastOpenedFileName) || (lang === 'typescript' ? 'file.ts' : 'file.js'));

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
    const nameEl = document.getElementById('fileName');
    if (nameEl) nameEl.textContent = file.name;

    return await saveFile();
  } catch (error) {
    console.error('Error in Save As:', error);
    showToast(`Error saving file: ${error.message}`, "error");
    return false;
  }
}

// Try to restore last file (placeholder)
async function tryRestoreLastFile() {
  try {
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
    const nameEl = document.getElementById('fileName');
    if (nameEl) nameEl.textContent = fileName || 'Recovered';
    setStatus('Restored (Session)', 'orange');
  } else {
    const lang = currentLanguage;
    const defaultFileName = `Untitled.${lang === 'typescript' ? 'ts' : 'js'}`;
    const nameEl = document.getElementById('fileName');
    if (nameEl) nameEl.textContent = defaultFileName;
    localStorage.setItem(KEYS.lastOpenedFileName, defaultFileName);
    setStatus(lang.toUpperCase(), 'blue');
  }
}

function newFile() {
  if (fileContentModified && !confirm('You have unsaved changes. Create a new file anyway?')) return;

  editor && editor.setValue('');
  lastSavedContent = '';
  currentFileHandle = null;

  localStorage.removeItem(KEYS.lastOpenedFileId);
  const lang = editor.getModel().getLanguageId();
  const newFileName = `Untitled.${lang === 'typescript' ? 'ts' : 'js'}`;
  localStorage.setItem(KEYS.lastOpenedFileName, newFileName);
  localStorage.setItem(KEYS.lastFileContent, '');

  const nameEl = document.getElementById('fileName');
  if (nameEl) nameEl.textContent = newFileName;
  setStatus('New', 'blue');
  fileContentModified = false;
}

function recoverUnsavedContent() {
  const savedContent = localStorage.getItem(KEYS.lastFileContent);
  if (savedContent && (!currentFileHandle || (editor && editor.getValue() !== savedContent))) {
    if (confirm('Unsaved content from your previous session was found. Recover it?')) {
      editor && editor.setValue(savedContent);
      const fileName = localStorage.getItem(KEYS.lastOpenedFileName) || 'Recovered';
      const nameEl = document.getElementById('fileName');
      if (nameEl) nameEl.textContent = fileName;
      setStatus('Recovered', 'blue');
    }
  }
}

// ---------------- Shortcuts: Save, Open, New, Run, Format ----------------
function handleKeyboardShortcuts(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (currentFileHandle) saveFile(); else saveFileAs();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    openFile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    newFile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runCode();
  }
  if (e.altKey && e.shiftKey && (e.key.toLowerCase() === 'f')) {
    e.preventDefault();
    formatCode();
  }
}

// ===================== End of script.js =====================
