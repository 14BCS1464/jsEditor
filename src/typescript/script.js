let editor;
let outputElement;
let lineInfoElement;
let toast;
let autoSaveInterval;

document.addEventListener("DOMContentLoaded", async () => {
    outputElement = document.getElementById("output");
    lineInfoElement = document.getElementById("line-info");
    toast = document.getElementById("toast");

    await loadMonacoEditor();
    setupEventListeners();
    loadSavedCode();
    loadCodeFromURL();

    showToast("TypeScript Editor Ready");
});

/* ===============================
   MONACO SETUP WITH ERROR DECORATIONS
================================ */
function loadMonacoEditor() {
    return new Promise(resolve => {
        const code = localStorage.getItem("typescript_code");
        require.config({
            paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs" }
        });

        require(["vs/editor/editor.main"], () => {
            editor = monaco.editor.create(document.getElementById("editor"), {
                value: code || `interface User {
  name: string;
  age: number;
}

const user: User = { name: "Alice", age: 30 };
console.log("User:", user);
`,
                language: "typescript",
                theme: "vs-dark",
                fontSize: 18,
                fontFamily: "monospace",
                automaticLayout: true,
                minimap: { enabled: false },
                tabSize: 2,
                quickSuggestions: { other: true, comments: false, strings: true },
                suggestOnTriggerCharacters: true,
                parameterHints: { enabled: false },
                hover: { enabled: true },
                formatOnType: true,
                formatOnPaste: true,
                noSemanticValidation: false,
                target: monaco.languages.typescript.ScriptTarget.ES2020,
                module: monaco.languages.typescript.ModuleKind.ESNext,
                strict: true,
                lib: ["es2020", "dom"],
                noEmit: true,
                esModuleInterop: true,
                skipLibCheck: true
            });



            // Track cursor position
            editor.onDidChangeCursorPosition(e => {
                lineInfoElement.textContent =
                    `Line: ${e.position.lineNumber}, Column: ${e.position.column}`;
            });

            // AUTO-SAVE: Save to localStorage on every change
            editor.onDidChangeModelContent(() => {
                autoSaveCode();
                highlightTypeScriptErrors();
            });

            // Initial error highlighting
            highlightTypeScriptErrors();

            resolve();
        });
    });
}

//highlightTypeScriptErrors()

/* ===============================
   AUTO-SAVE TO LOCAL STORAGE
================================ */
function autoSaveCode() {
    const code = editor.getValue();

    localStorage.setItem(`typescript_code`, code);
    // localStorage.setItem("last_language", currentLang);
}

/* ===============================
   TYPESCRIPT ERROR HIGHLIGHTING
================================ */
function highlightTypeScriptErrors() {
    monaco.languages.typescript.getTypeScriptWorker()
        .then(worker => worker(editor.getModel().uri))
        .then(client => {
            return Promise.all([
                client.getSyntacticDiagnostics(editor.getModel().uri.toString()),
                client.getSemanticDiagnostics(editor.getModel().uri.toString())
            ]);
        })
        .then(([syntactic, semantic]) => {
            const allDiagnostics = [...syntactic, ...semantic];

            // Create decorations for errors
            const decorations = allDiagnostics.map(diagnostic => {
                const startPos = editor.getModel().getPositionAt(diagnostic.start);
                const endPos = editor.getModel().getPositionAt(diagnostic.start + diagnostic.length);

                return {
                    range: new monaco.Range(
                        startPos.lineNumber,
                        startPos.column,
                        endPos.lineNumber,
                        endPos.column
                    ),
                    options: {
                        inlineClassName: 'typescript-error-inline',
                        className: 'typescript-error-line',
                        hoverMessage: { value: diagnostic.messageText },
                        glyphMarginClassName: 'typescript-error-glyph'
                    }
                };
            });

            // Apply decorations with red underlines
            editor.deltaDecorations([], decorations);

            // Add custom CSS for red underlines if not already added
            if (!document.getElementById('monaco-error-styles')) {
                const style = document.createElement('style');
                style.id = 'monaco-error-styles';
                style.textContent = `
                    .typescript-error-inline {
                        text-decoration: wavy underline red;
                        text-decoration-skip-ink: none;
                    }
                    .typescript-error-line {
                        background-color: rgba(255, 0, 0, 0.1);
                    }
                    .typescript-error-glyph {
                        background-color: #ef4444;
                        width: 4px !important;
                        margin-left: 3px;
                    }
                `;
                document.head.appendChild(style);
            }
        })
        .catch(err => {
            console.error('Error highlighting TypeScript errors:', err);
        });
}

/* ===============================
   EVENTS
================================ */
function setupEventListeners() {
    document.getElementById("btn-run").onclick = runCode;
    document.getElementById("btn-clear").onclick = () => {
        editor.setValue("");
        outputElement.innerHTML = "";
        autoSaveCode();
    };
    document.getElementById("btn-save").onclick = saveCode;
    document.getElementById("btn-share").onclick = shareCode;

    document.getElementById("languageList").onclick = e => {
        const li = e.target.closest("li");
        if (!li) return;
        document.querySelectorAll("#languageList li").forEach(x => x.classList.remove("active"));
        li.classList.add("active");
        switchLanguage(li.dataset.lang);
    };
}

/* ===============================
   RUN CODE
================================ */
function runCode() {
    outputElement.innerHTML = "";
    try {
        const jsCode = ts.transpile(editor.getValue());
        overrideConsole();
        new Function(jsCode)();
        restoreConsole();
        showToast("Code executed successfully");
    } catch (e) {
        restoreConsole();
        renderLog([e.message], "error");
        showToast("Execution error");
    }
}

/* ===============================
   DECORATIVE CONSOLE
================================ */
function overrideConsole() {
    console._log = console.log;
    console._error = console.error;
    console._warn = console.warn;
    console._info = console.info;

    console.log = (...args) => renderLog(args, "log");
    console.error = (...args) => renderLog(args, "error");
    console.warn = (...args) => renderLog(args, "warn");
    console.info = (...args) => renderLog(args, "info");
}

function restoreConsole() {
    console.log = console._log;
    console.error = console._error;
    console.warn = console._warn;
    console.info = console._info;
}

function renderLog(args, type) {
    const entry = document.createElement("div");
    entry.className = `console-entry ${type}`;

    const header = document.createElement("div");
    header.className = "console-header";
    header.innerHTML = `
    <span class="badge ${type}">${type}</span>
    <span class="time">${new Date().toLocaleTimeString()}</span>
  `;

    const body = document.createElement("div");
    body.className = "console-body";

    args.forEach(arg => body.appendChild(formatValue(arg)));

    entry.appendChild(header);
    entry.appendChild(body);
    outputElement.appendChild(entry);
    outputElement.scrollTop = outputElement.scrollHeight;
}

function formatValue(value) {
    const el = document.createElement("div");
    el.className = "console-value";

    if (typeof value === "object" && value !== null) {
        const d = document.createElement("details");
        const s = document.createElement("summary");
        s.textContent = Array.isArray(value) ? `Array(${value.length})` : "Object";
        const pre = document.createElement("pre");
        pre.textContent = JSON.stringify(value, null, 2);
        d.append(s, pre);
        el.appendChild(d);
    } else {
        el.textContent = String(value);
    }
    return el;
}

/* ===============================
   STORAGE / SHARE
================================ */
function saveCode() {
    autoSaveCode();
    showToast("Code saved manually");
}

function loadSavedCode() {
    const currentLang = document.querySelector("#languageList li.active")?.dataset.lang || "typescript";
    const code = localStorage.getItem(`code_${currentLang}`);
    if (code) {
        editor.setValue(code);
        showToast("Previous code restored");
    }
}

function shareCode() {
    const encoded = btoa(editor.getValue());
    const shareUrl = `${location.origin}${location.pathname}?code=${encoded}`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast("Share URL copied to clipboard");
        }).catch(() => {
            showToast("Failed to copy URL");
        });
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast("Share URL copied to clipboard");
    }
}

function loadCodeFromURL() {
    const code = new URLSearchParams(location.search).get("code");
    if (code) {
        try {
            editor.setValue(atob(code));
            showToast("Code loaded from URL");
        } catch (e) {
            showToast("Failed to load code from URL");
        }
    }
}

/* ===============================
   LANGUAGE SWITCH
================================ */
function switchLanguage(lang) {
    // Save current code before switching
    autoSaveCode();

    const routes = {
        javascript: "/src/editor/index.html",
        typescript: "/src/typescript/index.html",
        html: "/src/html/index.html",
        react: "/src/react/index.html",
        json: "/src/json/index.html"
    };
    if (routes[lang]) window.location.href = routes[lang];
}

/* ===============================
   UI
================================ */
function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = "block";
    toast.style.opacity = "1";
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            toast.style.display = "none";
        }, 300);
    }, 2000);
}