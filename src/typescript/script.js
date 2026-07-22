let editor;
let outputElement;
let lineInfoElement;
let toast;
let tsErrorsListEl;
let tsErrorCountEl;
let tsReady = false;
let currentWorker = null;
let liveDebounceTimer = null;

const EXEC_TIMEOUT_MS = 3000; // kill execution if it runs longer than this

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
   TYPESCRIPT COMPILER READINESS (for runtime transpile only —
   Monaco's own type CHECKING uses its internal TS worker and
   does not depend on this global `ts`)
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
        } else if (attempts > 50) { // ~10s timeout
            clearInterval(interval);
            showToast("TypeScript compiler failed to load — check your network/CDN access", "error", 5000);
        }
    }, 200);
}

/* ===============================
   MONACO EDITOR WITH INSTANT VALIDATION
================================ */
function loadMonacoEditor() {
    return new Promise(resolve => {
        const savedCode = localStorage.getItem("typescript_code");
        const initialCode = savedCode || `// REAL-TIME TYPE CHECKING - Try typing and see instant errors!

interface Person {
    name: string;
    age: number;
    email: string;
}

// ❌ This SHOULD show a TypeScript error in the panel on the right:
// Type 'number' is not assignable to type 'string'
const person1: Person = {
    name: 42,          // <- try fixing this to a string
    age: 25,
    email: "alice@example.com"
};

function greet(name: string, age: number): string {
    return \`Hello \${name}, you are \${age} years old\`;
}

const msg1 = greet("Charlie", 28);
console.log(msg1);
console.log("Fix the red error above and watch the panel clear!");`;

        require.config({
            paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" }
        });

        require(["vs/editor/editor.main"], () => {
            // Controls WHICH rules TS checks.
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
                checkJs: false
            });

            // Turns semantic (type) validation ON. Keep noSemanticValidation
            // false or interface/type mismatches will never be flagged.
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: false,
                noSyntaxValidation: false,
                noSuggestionDiagnostics: false,
                diagnosticCodesToIgnore: []
            });

            monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

            editor = monaco.editor.create(document.getElementById("editor"), {
                value: initialCode,
                language: "typescript",
                theme: "vs-dark",
                fontSize: 15,
                fontFamily: "'Cascadia Code', 'Consolas', monospace",
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
                hover: { enabled: true },
                lightbulb: { enabled: true }
            });

            editor.onDidChangeCursorPosition(e => {
                updateLineInfo(e.position);
            });

            // Fallback trigger — kept as a secondary signal, but the
            // debounced content-change handler below is the primary,
            // authoritative path now.
            monaco.editor.onDidChangeMarkers(([resource]) => {
                if (editor.getModel() && editor.getModel().uri.toString() === resource.toString()) {
                    updateErrorDisplay();
                    renderTypeScriptErrors();
                }
            });

            editor.onDidChangeModelContent(() => {
                autoSaveCode();
                clearTimeout(liveDebounceTimer);
                liveDebounceTimer = setTimeout(() => {
                    updateErrorDisplay();
                    renderTypeScriptErrors();
                    executeCode({ silent: true });
                }, 500);
            });

            setTimeout(() => {
                updateErrorDisplay();
                renderTypeScriptErrors();
                executeCode({ silent: true });
            }, 800); // give the TS worker time to spin up on first load

            resolve();
        });
    });
}

/* ===============================
   DIRECT TYPESCRIPT DIAGNOSTICS
   Pulls straight from the TS language service via
   getTypeScriptWorker() — more reliable than trusting
   getModelMarkers(), which depends on Monaco's internal
   marker-publish timing and can lag or miss updates.
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

    // messageText can be a plain string OR a nested DiagnosticMessageChain
    const message = typeof diag.messageText === "string"
        ? diag.messageText
        : flattenDiagnosticMessage(diag.messageText);

    // ts.DiagnosticCategory: 0 = Warning, 1 = Error, 2 = Suggestion, 3 = Message
    const isError = diag.category === 1;

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

// Manual fallback flattener in case the global `ts` isn't loaded yet
// when diagnostics first arrive (avoids a hard dependency on it here).
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
   STATUS PILL (top bar summary)
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
            statusEl.innerHTML = `<span style="color: #4CAF50;">✅ No errors</span>`;
        }
    }
}

/* ===============================
   TYPESCRIPT ERRORS PANEL
   Lists every diagnostic with line:col, message, and TS code.
   Clicking an item jumps the editor cursor to that location.
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
        tsErrorCountEl.textContent = errorCount + warningCount;
        tsErrorCountEl.className = "count-badge " +
            (errorCount > 0 ? "has-errors" : warningCount > 0 ? "has-warnings" : "clean");
    }

    tsErrorsListEl.innerHTML = "";

    if (display.length === 0) {
        const noErr = document.createElement("div");
        noErr.className = "ts-no-errors";
        noErr.textContent = "✅ No TypeScript errors — types are valid";
        tsErrorsListEl.appendChild(noErr);
        return;
    }

    display.forEach(d => {
        const item = document.createElement("div");
        item.className = `ts-error-item ${d.isError ? "severity-error" : "severity-warning"}`;

        const icon = d.isError ? "❌" : "⚠️";
        const codeStr = d.code ? ` <span class="ts-error-code">TS${d.code}</span>` : "";

        item.innerHTML = `
            <span class="ts-error-location">${icon} Ln ${d.startLineNumber}:${d.startColumn}</span>
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
   RUN CODE (manual button click)
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
   EXECUTE CODE — IN A WEB WORKER
   (keeps UI responsive; infinite loops get terminated
    instead of freezing the tab)
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
           // renderLog(["✅ Code executed successfully"], "log");
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
   CONSOLE OUTPUT (runtime logs only — TS errors live in
   the separate panel now, never mixed in here)
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
    // Safe binder: never throws if an element is missing from the DOM
    const on = (id, handler) => {
        const el = document.getElementById(id);
        if (el) {
            el.onclick = handler;
        } else {
            console.warn(`setupEventListeners: #${id} not found in DOM, skipping.`);
        }
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
        await updateErrorDisplay();
        await renderTypeScriptErrors();
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

    // Language switcher (only runs if #languageList exists in the DOM)
    const languageList = document.getElementById("languageList");
    if (languageList) {
        languageList.addEventListener("click", (e) => {
            const item = e.target.closest("li");
            if (!item || !item.dataset.lang) return;

            const routes = {
                javascript: "../editor/index.html",
                typescript: "index.html",
                html: "../html/index.html",
                react: "../react/index.html",
                json: "../jsonformatter/index.html"
            };

            const dest = routes[item.dataset.lang];
            if (dest) {
                window.location.href = dest;
            }
        });
    }
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
    // Already loaded during editor initialisation
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