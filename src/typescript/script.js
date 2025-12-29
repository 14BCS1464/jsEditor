let editor;
let outputElement;
let lineInfoElement;
let toast;

document.addEventListener("DOMContentLoaded", async () => {
    outputElement = document.getElementById("output");
    lineInfoElement = document.getElementById("line-info");
    toast = document.getElementById("toast");

    await loadMonacoEditor();
    setupEventListeners();
    loadSavedCode();
    loadCodeFromURL();

    showToast("TypeScript Editor Ready with Real-time Validation!", "success");
});

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

// ❌ ERROR: Type 'string' is not assignable to type 'number'
const person1: Person = {
    name: "Alice",
    age: "25",  // Change this to a number to fix!
    email: "alice@example.com"
};

// ❌ ERROR: Property 'email' is missing
const person2: Person = {
    name: "Bob",
    age: 30
    // Add email to fix this error!
};

// Function with type checking
function greet(name: string, age: number): string {
    return \`Hello \${name}, you are \${age} years old\`;
}

// ✅ Correct usage
const msg1 = greet("Charlie", 28);

// ❌ ERROR: Argument of type 'number' is not assignable to parameter of type 'string'
const msg2 = greet(123, 28);

// ❌ ERROR: Expected 2 arguments, but got 1
const msg3 = greet("David");

console.log(msg1);
console.log("Try fixing the errors above!");`;

        require.config({
            paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" }
        });

        require(["vs/editor/editor.main"], () => {
            // CRITICAL: Configure TypeScript compiler options FIRST
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2020,
                module: monaco.languages.typescript.ModuleKind.ESNext,
                lib: ["es2020", "dom"],
                strict: true,
                noImplicitAny: true,
                strictNullChecks: true,
                strictFunctionTypes: true,
                strictBindCallApply: true,
                noImplicitThis: true,
                alwaysStrict: true,
                esModuleInterop: true,
                allowJs: false,
                checkJs: false
            });

            // CRITICAL: Enable diagnostics - this makes errors appear!
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: false,  // MUST be false!
                noSyntaxValidation: false,     // MUST be false!
                noSuggestionDiagnostics: false,
                diagnosticCodesToIgnore: []
            });

            // Enable eager model sync for instant validation
            monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

            // Create the editor
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

            // Update line info on cursor move
            editor.onDidChangeCursorPosition(e => {
                updateLineInfo(e.position);
            });

            // Listen to Monaco's marker changes (this is when errors appear)
            monaco.editor.onDidChangeMarkers(([resource]) => {
                if (editor.getModel() && editor.getModel().uri.toString() === resource.toString()) {
                    updateErrorDisplay();
                }
            });

            // Save on change
            editor.onDidChangeModelContent(() => {
                autoSaveCode();
            });

            // Initial error check after a moment
            setTimeout(() => {
                updateErrorDisplay();
            }, 500);

            resolve();
        });
    });
}

/* ===============================
   UPDATE ERROR DISPLAY
================================ */
function updateErrorDisplay() {
    if (!editor || !editor.getModel()) return;

    const model = editor.getModel();
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });

    const errors = markers.filter(m => m.severity === monaco.MarkerSeverity.Error);
    const warnings = markers.filter(m => m.severity === monaco.MarkerSeverity.Warning);

    // Update status text
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

    console.log(`Validation: ${errors.length} errors, ${warnings.length} warnings`);
}

function updateLineInfo(position) {
    if (!position || !lineInfoElement) return;

    const model = editor.getModel();
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
function runCode() {
    outputElement.innerHTML = "";

    // Check for errors
    const model = editor.getModel();
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const errors = markers.filter(m => m.severity === monaco.MarkerSeverity.Error);

    if (errors.length > 0) {
        const errorList = errors.slice(0, 3).map(e =>
            `Line ${e.startLineNumber}: ${e.message.substring(0, 60)}`
        ).join('\n');

        const runAnyway = confirm(
            `⚠️ Found ${errors.length} TypeScript error(s):\n\n${errorList}\n\nRun anyway?`
        );

        if (!runAnyway) {
            showToast("Execution cancelled due to errors", "warning", 3000);
            return;
        }
    }

    executeCode();
}

function executeCode() {
    try {
        // Transpile TypeScript to JavaScript using browser TypeScript compiler
        const jsCode = ts.transpile(editor.getValue(), {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.ESNext
        });

        // Create console override
        const logs = [];
        const customConsole = {
            log: (...args) => {
                logs.push({ type: 'log', args });
                renderLog(args, "log");
            },
            error: (...args) => {
                logs.push({ type: 'error', args });
                renderLog(args, "error");
            },
            warn: (...args) => {
                logs.push({ type: 'warn', args });
                renderLog(args, "warn");
            },
            info: (...args) => {
                logs.push({ type: 'info', args });
                renderLog(args, "info");
            }
        };

        // Execute in isolated context
        const executeFunction = new Function(
            'console',
            'Date',
            'Math',
            'JSON',
            'Array',
            'Object',
            'String',
            'Number',
            'Boolean',
            `
            try {
                ${jsCode}
                console.log("✅ Code executed successfully");
            } catch (error) {
                console.error("Runtime Error:", error.message);
                throw error;
            }
            `
        );

        executeFunction(customConsole, Date, Math, JSON, Array, Object, String, Number, Boolean);
        showToast("Execution completed", "success");

    } catch (error) {
        renderLog([`❌ Execution Error: ${error.message}`], "error");
        showToast("Execution failed", "error");
        console.error(error);
    }
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
    document.getElementById("btn-run").onclick = runCode;

    document.getElementById("btn-clear").onclick = () => {
        editor.setValue("");
        outputElement.innerHTML = "";
        showToast("Editor cleared", "info");
    };

    document.getElementById("btn-save").onclick = saveCode;
    document.getElementById("btn-share").onclick = shareCode;

    document.getElementById("btn-check-types").onclick = () => {
        updateErrorDisplay();
        showToast("Type checking complete!", "info");
    };

    // Language switcher
    const languageList = document.getElementById("languageList");
    if (languageList) {
        languageList.addEventListener("click", (e) => {
            const item = e.target.closest("li");
            if (!item || !item.dataset.lang) return;

            const routes = {
                javascript: "/src/editor/index.html",
                typescript: "/src/typescript/index.html",
                html: "/src/html/index.html",
                react: "/src/react/index.html",
                json: "/src/jsonformatter/index.html"
            };

            if (routes[item.dataset.lang]) {
                window.location.href = routes[item.dataset.lang];
            }
        });
    }
}

/* ===============================
   AUTO-SAVE & STORAGE
================================ */
function autoSaveCode() {
    const code = editor.getValue();
    localStorage.setItem("typescript_code", code);
}

function saveCode() {
    autoSaveCode();
    showToast("Code saved to browser storage", "success");
}

function loadSavedCode() {
    // Already loaded in initial editor setup
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
    const code = editor.getValue();
    const encoded = btoa(encodeURIComponent(code));
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

    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/* ===============================
   TEST BUTTON FOR DEMONSTRATIONS
================================ */
setTimeout(() => {
    // Add test button
    const testButton = document.createElement('button');
    testButton.className = 'test-button';
    testButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: linear-gradient(135deg, #6c5ce7, #00cec9);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(108, 92, 231, 0.4);
        transition: all 0.3s ease;
    `;
    testButton.textContent = '🧪 Load Test Examples';

    testButton.onmouseover = () => {
        testButton.style.transform = 'translateY(-2px)';
        testButton.style.boxShadow = '0 6px 20px rgba(108, 92, 231, 0.6)';
    };

    testButton.onmouseout = () => {
        testButton.style.transform = 'translateY(0)';
        testButton.style.boxShadow = '0 4px 15px rgba(108, 92, 231, 0.4)';
    };

    testButton.onclick = () => {
        const testCode = `// REAL-TIME TYPE CHECKING TEST
// Watch errors appear and disappear as you type!

interface Product {
    id: number;
    name: string;
    price: number;
    inStock: boolean;
}

// ❌ ERROR: Type 'string' is not assignable to type 'number'
const product1: Product = {
    id: "123",  // Should be a number - fix this!
    name: "Laptop",
    price: 999,
    inStock: true
};

// ❌ ERROR: Property 'inStock' is missing
const product2: Product = {
    id: 456,
    name: "Mouse",
    price: 29.99
    // Add inStock property to fix!
};

// Function with strict typing
function calculateTotal(price: number, quantity: number): number {
    return price * quantity;
}

// ✅ Correct usage
const total1 = calculateTotal(99, 2);

// ❌ ERROR: Argument of type 'string' is not assignable
const total2 = calculateTotal("50", 3);

// ❌ ERROR: Expected 2 arguments, but got 1
const total3 = calculateTotal(100);

console.log("Total:", total1);
console.log("Fix the errors above and watch them disappear!");`;

        editor.setValue(testCode);
        showToast("Test examples loaded - Try fixing the errors!", "info", 4000);
    };

    document.body.appendChild(testButton);
}, 1000);