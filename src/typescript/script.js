let editor;
let outputElement;
let lineInfoElement;
let toast;
let tsErrorsListEl;
let tsErrorCountEl;
let tsReady = false;
let currentWorker = null;
let liveDebounceTimer = null;
let isEditorReady = false;

const EXEC_TIMEOUT_MS = 3000;

document.addEventListener("DOMContentLoaded", async () => {
    outputElement = document.getElementById("output");
    lineInfoElement = document.getElementById("line-info");
    toast = document.getElementById("toast");
    tsErrorsListEl = document.getElementById("ts-errors-list");
    tsErrorCountEl = document.getElementById("ts-error-count");

    checkTsAvailability();
    await loadMonacoEditor();
    setupEventListeners();
    loadSavedCode();
    loadCodeFromURL();

    showToast("TypeScript Editor Ready with Real-time Validation!", "success");
});

/* ===============================
   TYPESCRIPT COMPILER READINESS
================================ */
function checkTsAvailability() {
    if (typeof ts !== "undefined") {
        tsReady = true;
        return;
    }
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (typeof ts !== "undefined") {
            tsReady = true;
            clearInterval(interval);
        } else if (attempts > 50) {
            clearInterval(interval);
            showToast("TypeScript compiler failed to load", "error", 5000);
        }
    }, 200);
}

/* ===============================
   MONACO EDITOR WITH INSTANT VALIDATION
================================ */
function loadMonacoEditor() {
    return new Promise((resolve, reject) => {
        const savedCode = localStorage.getItem("typescript_code");
        const initialCode = savedCode || `// ✅ REAL-TIME TYPE CHECKING IS NOW ACTIVE!
// Try typing below — you'll see red squiggles and suggestions instantly.

interface Person {
    name: string;
    age: number;
    email: string;
}

// ❌ INTENTIONAL ERROR: Type 'number' is not assignable to type 'string'
const person1: Person = {
    name: 42,          // <- hover here or look at the right panel
    age: 25,
    email: "alice@example.com"
};

function greet(name: string, age: number): string {
    return \`Hello \${name}, you are \${age} years old\`;
}

// Try typing 'greet(' to see parameter suggestions!
const msg1 = greet("Charlie", 28);
console.log(msg1);

// Try typing below to see autocomplete:
// const arr: number[] = [1, 2, 3];
// arr.  <-- press Ctrl+Space after the dot`;

        require.config({
            paths: {
                vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs"
            }
        });

        require(["vs/editor/editor.main"], () => {
            // ── 1. Compiler Options (STRICT mode for maximum type safety) ──
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2020,
                module: monaco.languages.typescript.ModuleKind.ESNext,
                lib: ["es2020", "dom"],
                strict: true,
                noImplicitAny: true,
                strictNullChecks: true,
                strictFunctionTypes: true,
                strictBindCallApply: true,
                strictPropertyInitialization: true,
                noImplicitThis: true,
                alwaysStrict: true,
                esModuleInterop: true,
                allowJs: false,
                checkJs: false,
                noEmit: true,
                skipLibCheck: true
            });

            // ── 2. Diagnostics Options (ENABLE semantic validation!) ──
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: false,
                noSyntaxValidation: false,
                noSuggestionDiagnostics: false,
                diagnosticCodesToIgnore: []
            });

            // ── 3. Eager sync so types update faster ──
            monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

            // ── 4. Create Editor ──
            editor = monaco.editor.create(document.getElementById("editor"), {
                value: initialCode,
                language: "typescript",
                theme: "vs-dark",
                fontSize: 15,
                fontFamily: "'Cascadia Code', 'Consolas', 'Fira Code', monospace",
                automaticLayout: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                insertSpaces: true,
                formatOnType: true,
                formatOnPaste: true,
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                parameterHints: { enabled: true },
                hover: { enabled: true },
                lightbulb: { enabled: true },
                inlayHints: { enabled: true }
            });

            isEditorReady = true;

            // ── 5. Event Listeners ──
            editor.onDidChangeCursorPosition(e => updateLineInfo(e.position));

            // PRIMARY: content change → debounced validation
            editor.onDidChangeModelContent(() => {
                autoSaveCode();
                clearTimeout(liveDebounceTimer);
                liveDebounceTimer = setTimeout(() => {
                    refreshAllDiagnostics();
                }, 400);
            });

            // SECONDARY: marker change (catches edge cases)
            monaco.editor.onDidChangeMarkers(([resource]) => {
                if (editor.getModel()?.uri.toString() === resource.toString()) {
                    refreshAllDiagnostics();
                }
            });

            // ── 6. Initial validation after worker warms up ──
            setTimeout(() => {
                refreshAllDiagnostics();
                executeCode({ silent: true });
            }, 1200);

            resolve();
        });
    });
}

/* ===============================
   DIAGNOSTICS (THE CORE FIX)
   Pulls directly from Monaco's TS Language Service Worker
================================ */
async function getTypeScriptDiagnostics() {
    if (!editor || !editor.getModel()) return [];
    const model = editor.getModel();

    try {
        const workerGetter = await monaco.languages.typescript.getTypeScriptWorker();
        const client = await workerGetter(model.uri);

        const [syntactic, semantic] = await Promise.all([
            client.getSyntacticDiagnostics(model.uri.toString()),
            client.getSemanticDiagnostics(model.uri.toString())
        ]);

        return [...syntactic, ...semantic];
    } catch (e) {
        console.error("Failed to fetch TS diagnostics:", e);
        return [];
    }
}

function diagnosticToDisplay(diag, model) {
    const startPos = model.getPositionAt(diag.start);
    const endPos = model.getPositionAt(diag.start + diag.length);

    const message = typeof diag.messageText === "string"
        ? diag.messageText
        : flattenDiagnosticMessage(diag.messageText);

    const isError = diag.category === 1; // 1 = Error

    return {
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
        message,
        code: diag.code,
        category: diag.category,
        isError
    };
}

function flattenDiagnosticMessage(messageText, indent = "") {
    if (typeof messageText === "string") return indent + messageText;
    let result = indent + messageText.messageText;
    if (messageText.next) {
        for (const next of messageText.next) {
            result += "\n" + flattenDiagnosticMessage(next, indent + "  ");
        }
    }
    return result;
}

/* ===============================
   UNIFIED REFRESH
================================ */
async function refreshAllDiagnostics() {
    await updateErrorDisplay();
    await renderTypeScriptErrors();
}

/* ===============================
   STATUS PILL
================================ */
async function updateErrorDisplay() {
    if (!editor || !editor.getModel()) return;

    const diagnostics = await getTypeScriptDiagnostics();
    const errors = diagnostics.filter(d => d.category === 1);
    const warnings = diagnostics.filter(d => d.category === 0);

    const statusEl = document.getElementById('status');
    if (statusEl) {
        if (errors.length > 0) {
            statusEl.innerHTML = `<span style="color: #ff4444;">❌ ${errors.length} error${errors.length !== 1 ? 's' : ''}</span>`;
        } else if (warnings.length > 0) {
            statusEl.innerHTML = `<span style="color: #ffaa44;">⚠️ ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}</span>`;
        } else {
            statusEl.innerHTML = `<span style="color: #3fb950;">✅ No errors — types are valid</span>`;
        }
    }
}

/* ===============================
   TYPESCRIPT ERRORS PANEL
================================ */
async function renderTypeScriptErrors() {
    if (!editor || !editor.getModel() || !tsErrorsListEl) return;

    const model = editor.getModel();
    const diagnostics = await getTypeScriptDiagnostics();
    const display = diagnostics
        .map(d => diagnosticToDisplay(d, model))
        .sort((a, b) => a.startLineNumber - b.startLineNumber);

    const errorCount = display.filter(d => d.isError).length;
    const warningCount = display.length - errorCount;

    if (tsErrorCountEl) {
        tsErrorCountEl.textContent = display.length;
        tsErrorCountEl.className = "count-badge " +
            (errorCount > 0 ? "has-errors" : warningCount > 0 ? "has-warnings" : "clean");
    }

    tsErrorsListEl.innerHTML = "";

    if (display.length === 0) {
        const noErr = document.createElement("div");
        noErr.className = "ts-no-errors";
        noErr.innerHTML = "✅ No TypeScript errors — types are valid!<br><span style='color:#8b949e;font-size:0.8rem'>Start typing to see real-time checks</span>";
        tsErrorsListEl.appendChild(noErr);
        return;
    }

    display.forEach(d => {
        const item = document.createElement("div");
        item.className = `ts-error-item ${d.isError ? "severity-error" : "severity-warning"}`;

        const icon = d.isError ? "❌" : "⚠️";
        const codeStr = d.code ? ` <span class="ts-error-code">TS${d.code}</span>` : "";

        item.innerHTML = `
            <span class="ts-error-location">${icon} Line ${d.startLineNumber}, Col ${d.startColumn}</span>
            <span class="ts-error-message">${escapeHtml(d.message)}${codeStr}</span>
        `;

        item.addEventListener("click", () => {
            editor.revealLineInCenter(d.startLineNumber);
            editor.setPosition({ lineNumber: d.startLineNumber, column: d.startColumn });
            editor.focus();
        });

        tsErrorsListEl.appendChild(item);
    });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function updateLineInfo(position) {
    if (!position || !lineInfoElement || !editor) return;

    const model = editor.getModel();
    if (!model) return;

    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    let errorInfo = '';
    markers.forEach(marker => {
        if (marker.startLineNumber === position.lineNumber) {
            const type = marker.severity === monaco.MarkerSeverity.Error ? 'Error' : 'Warning';
            const msg = marker.message.substring(0, 80);
            errorInfo = ` | ${type}: ${msg}`;
        }
    });

    lineInfoElement.textContent = `Ln ${position.lineNumber}, Col ${position.column}${errorInfo}`;
}

/* ===============================
   RUN CODE
================================ */
async function runCode() {
    const diagnostics = await getTypeScriptDiagnostics();
    const errors = diagnostics.filter(d => d.category === 1);

    if (errors.length > 0) {
        const model = editor.getModel();
        const errorList = errors.slice(0, 3).map(d => {
            const pos = model.getPositionAt(d.start);
            const msg = typeof d.messageText === "string" ? d.messageText : flattenDiagnosticMessage(d.messageText);
            return `Line ${pos.lineNumber}: ${msg.substring(0, 60)}`;
        }).join('\n');

        const runAnyway = confirm(
            `⚠️ Found ${errors.length} TypeScript error(s):\n\n${errorList}\n\nRun anyway?`
        );

        if (!runAnyway) {
            showToast("Execution cancelled due to errors", "warning", 3000);
            return;
        }
    }

    executeCode({ silent: false });
}

/* ===============================
   EXECUTE CODE IN WEB WORKER
================================ */
function executeCode({ silent = false } = {}) {
    if (typeof ts === "undefined") {
        if (!silent) {
            renderLog(["❌ TypeScript compiler is not loaded yet. Please wait a moment and try again."], "error");
            showToast("TypeScript compiler not ready", "error");
        }
        return;
    }

    let jsCode;
    try {
        jsCode = ts.transpile(editor.getValue(), {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.ESNext
        });
    } catch (err) {
        outputElement.innerHTML = "";
        renderLog([`❌ Compile Error: ${err.message}`], "error");
        if (!silent) showToast("Compile failed", "error");
        return;
    }

    runInWorker(jsCode, silent);
}

function runInWorker(jsCode, silent) {
    if (currentWorker) {
        currentWorker.terminate();
        currentWorker = null;
    }

    outputElement.innerHTML = "";

    const workerSource = `
        function safeSerialize(value) {
            try { JSON.stringify(value); return value; }
            catch (e) { return String(value); }
        }
        function makeLogger(type) {
            return function(...args) {
                self.postMessage({ kind: 'log', logType: type, args: args.map(safeSerialize) });
            };
        }
        const console = {
            log: makeLogger('log'),
            error: makeLogger('error'),
            warn: makeLogger('warn'),
            info: makeLogger('info')
        };
        self.onmessage = function(e) {
            try {
                const fn = new Function('console','Date','Math','JSON','Array','Object','String','Number','Boolean', e.data);
                fn(console, Date, Math, JSON, Array, Object, String, Number, Boolean);
                self.postMessage({ kind: 'done' });
            } catch (err) {
                self.postMessage({ kind: 'error', message: err.message });
            }
        };
    `;

    const blob = new Blob([workerSource], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    currentWorker = worker;

    const timeoutId = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        if (currentWorker === worker) currentWorker = null;
        renderLog([`⏱️ Stopped: execution exceeded ${EXEC_TIMEOUT_MS / 1000}s — likely an infinite loop.`], "error");
        if (!silent) showToast("Execution timed out (infinite loop?)", "error", 4000);
    }, EXEC_TIMEOUT_MS);

    worker.onmessage = (e) => {
        const { kind, logType, args, message } = e.data;

        if (kind === "log") {
            renderLog(args, logType);
        } else if (kind === "done") {
            clearTimeout(timeoutId);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            if (currentWorker === worker) currentWorker = null;
            if (!silent) showToast("Execution completed", "success");
        } else if (kind === "error") {
            clearTimeout(timeoutId);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            if (currentWorker === worker) currentWorker = null;
            renderLog([`❌ Runtime Error: ${message}`], "error");
            if (!silent) showToast("Execution failed", "error");
        }
    };

    worker.onerror = (err) => {
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        if (currentWorker === worker) currentWorker = null;
        renderLog([`❌ Worker Error: ${err.message}`], "error");
        if (!silent) showToast("Execution failed", "error");
    };

    worker.postMessage(jsCode);
}

/* ===============================
   CONSOLE OUTPUT
================================ */
function renderLog(args, type) {
    const entry = document.createElement("div");
    entry.className = `console-entry ${type}`;

    const header = document.createElement("div");
    header.className = "console-header";
    header.innerHTML = `
        <span class="badge ${type}">${type.toUpperCase()}</span>
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
    `;

    const body = document.createElement("div");
    body.className = "console-body";

    args.forEach(arg => {
        const valueEl = document.createElement("div");

        if (typeof arg === "object" && arg !== null) {
            const details = document.createElement("details");
            const summary = document.createElement("summary");
            summary.textContent = Array.isArray(arg) ? `Array(${arg.length})` : "Object";
            const pre = document.createElement("pre");
            pre.textContent = JSON.stringify(arg, null, 2);
            details.appendChild(summary);
            details.appendChild(pre);
            valueEl.appendChild(details);
        } else {
            valueEl.textContent = String(arg);
        }

        body.appendChild(valueEl);
    });

    entry.appendChild(header);
    entry.appendChild(body);
    outputElement.appendChild(entry);
    outputElement.scrollTop = outputElement.scrollHeight;
}

/* ===============================
   EVENT LISTENERS
================================ */
function setupEventListeners() {
    const on = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.onclick = handler;
    };

    on("btn-run", runCode);

    on("btn-clear", () => {
        editor.setValue("");
        outputElement.innerHTML = "";
        showToast("Editor cleared", "info");
    });

    on("btn-save", saveCode);
    on("btn-share", shareCode);

    on("btn-check-types", async () => {
        await refreshAllDiagnostics();
        showToast("Type checking complete!", "info");
    });

    on("btn-clear-output", () => {
        outputElement.innerHTML = "";
        showToast("Output cleared", "info");
    });

    on("btn-copy-output", () => {
        const text = outputElement.innerText;
        if (!text) {
            showToast("Nothing to copy", "warning");
            return;
        }
        navigator.clipboard.writeText(text)
            .then(() => showToast("Output copied to clipboard!", "success"))
            .catch(() => showToast("Failed to copy output", "error"));
    });

    on("btn-format", () => {
        if (editor) {
            editor.getAction("editor.action.formatDocument")?.run();
        }
    });
}

/* ===============================
   AUTO-SAVE & STORAGE
================================ */
function autoSaveCode() {
    localStorage.setItem("typescript_code", editor.getValue());
}

function saveCode() {
    autoSaveCode();
    showToast("Code saved to browser storage", "success");
}

function loadSavedCode() {
    // Handled in loadMonacoEditor
}

function loadCodeFromURL() {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");

    if (code) {
        try {
            const decoded = decodeURIComponent(atob(code));
            editor.setValue(decoded);
            showToast("Code loaded from URL", "success");
        } catch (e) {
            showToast("Failed to load code from URL", "error");
            console.error(e);
        }
    }
}

function shareCode() {
    const encoded = btoa(encodeURIComponent(editor.getValue()));
    const shareUrl = `${location.origin}${location.pathname}?code=${encoded}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Share URL copied to clipboard!", "success", 3000);
    }).catch(() => {
        showToast("Failed to copy URL", "error");
    });
}

/* ===============================
   TOAST NOTIFICATIONS
================================ */
function showToast(message, type = "info", duration = 2000) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), duration);
}