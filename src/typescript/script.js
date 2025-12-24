let editor;
let outputElement;
let lineInfoElement;
let toast;
let errorMarkers = [];
let typeCheckTimeout;
let isTypeScriptReady = false;

document.addEventListener("DOMContentLoaded", async () => {
    outputElement = document.getElementById("output");
    lineInfoElement = document.getElementById("line-info");
    toast = document.getElementById("toast");

    await loadMonacoEditor();
    setupEventListeners();
    loadSavedCode();
    loadCodeFromURL();

    showToast("TypeScript Editor Ready - Real-time Type Checking Active", "success");
});

/* ===============================
   MONACO EDITOR WITH REAL-TIME TYPE CHECKING
================================ */
function loadMonacoEditor() {
    return new Promise(resolve => {
        const savedCode = localStorage.getItem("typescript_code");
        const initialCode = savedCode || `// REAL-TIME TYPE CHECKING EXAMPLE
// Try changing age from number to string and see the error

interface Person {
    name: string;
    age: number;  // This must be a number
    email: string;
}

// CORRECT: This works because age is a number
const correctPerson: Person = {
    name: "John",
    age: 30,  // ✅ Number - no error
    email: "john@example.com"
};

// ERROR: This will show an error because age is a string
const wrongPerson: Person = {
    name: "Jane",
    age: "25",  // ❌ String - ERROR: Type 'string' is not assignable to type 'number'
    email: "jane@example.com"
};

// Function with strict type checking
function calculateSum(a: number, b: number): number {
    return a + b;
}

// ✅ Correct usage
const sum1 = calculateSum(5, 10);

// ❌ Error - passing string to number parameter
const sum2 = calculateSum("5", 10);

console.log("Correct person:", correctPerson);
console.log("Sum:", sum1);`;

        require.config({
            paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs" }
        });

        require(["vs/editor/editor.main"], () => {
            // CRITICAL: Configure TypeScript with STRICT settings
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.Latest,
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
                noUnusedLocals: true,
                noUnusedParameters: true,
                noImplicitReturns: true,
                noFallthroughCasesInSwitch: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                noEmit: true,
                allowJs: true,
                checkJs: false,
                experimentalDecorators: true,
                emitDecoratorMetadata: true
            });

            // Enable ALL diagnostics
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: false,
                noSyntaxValidation: false,
                noSuggestionDiagnostics: false,
                diagnosticCodesToIgnore: []
            });

            editor = monaco.editor.create(document.getElementById("editor"), {
                value: initialCode,
                language: "typescript",
                theme: "vs-dark",
                fontSize: 16,
                fontFamily: "'Cascadia Code', Consolas, monospace",
                automaticLayout: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                insertSpaces: true,
                autoIndent: "full",
                formatOnType: true,
                formatOnPaste: true,
                suggestOnTriggerCharacters: true,
                parameterHints: { enabled: true },
                hover: { enabled: true, delay: 100 },
                lightbulb: { enabled: true },
                glyphMargin: true,
                lineDecorationsWidth: 10,
                renderValidationDecorations: "on",
                scrollbar: {
                    verticalHasArrows: true
                },
                overviewRulerLanes: 3,
                fixedOverflowWidgets: true
            });

            // Add error styles
            addErrorStyles();

            // Track cursor position
            editor.onDidChangeCursorPosition(e => {
                updateLineInfo(e.position);
            });

            // REAL-TIME TYPE CHECKING: Trigger on every change with immediate + debounced check
            editor.onDidChangeModelContent(() => {
                // Immediate check for fast feedback
                checkTypeScriptErrors();

                // Debounced check for final validation
                clearTimeout(typeCheckTimeout);
                typeCheckTimeout = setTimeout(() => {
                    checkTypeScriptErrors();
                }, 500);

                autoSaveCode();
            });

            // Wait for TypeScript to be ready, then do initial check
            waitForTypeScriptReady().then(() => {
                isTypeScriptReady = true;
                checkTypeScriptErrors();
                // Schedule additional checks to catch late-loading issues
                setTimeout(() => checkTypeScriptErrors(), 1000);
                setTimeout(() => checkTypeScriptErrors(), 2000);
            });

            resolve();
        });
    });
}

// Wait for TypeScript worker to be ready
async function waitForTypeScriptReady() {
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const model = editor.getModel();
            const uri = model.uri;
            const worker = await monaco.languages.typescript.getTypeScriptWorker();
            const client = await worker(uri);

            // Try to get diagnostics - if this works, TypeScript is ready
            await client.getSyntacticDiagnostics(uri.toString());
            console.log("TypeScript is ready!");
            return;
        } catch (e) {
            console.log(`Waiting for TypeScript... attempt ${i + 1}`);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    console.warn("TypeScript may not be fully ready");
}

/* ===============================
   REAL-TIME TYPE SCRIPT ERROR DETECTION
================================ */
async function checkTypeScriptErrors() {
    if (!editor || !editor.getModel()) {
        console.log("Editor not ready");
        return;
    }

    try {
        const model = editor.getModel();
        const uri = model.uri;

        // Get TypeScript worker
        const worker = await monaco.languages.typescript.getTypeScriptWorker();
        const client = await worker(uri);

        // Get ALL diagnostics with timeout protection
        const diagnosticsPromise = Promise.all([
            client.getSyntacticDiagnostics(uri.toString()),
            client.getSemanticDiagnostics(uri.toString()),
            client.getSuggestionDiagnostics(uri.toString())
        ]);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 5000)
        );

        const [syntactic, semantic, suggestion] = await Promise.race([
            diagnosticsPromise,
            timeoutPromise
        ]);

        // Combine all diagnostics
        const allDiagnostics = [...syntactic, ...semantic, ...suggestion];

        console.log(`Found ${allDiagnostics.length} diagnostics:`, allDiagnostics);

        // Clear previous markers and decorations
        clearAllErrors();

        if (allDiagnostics.length === 0) {
            updateErrorCount([]);
            return;
        }

        // Create Monaco markers (this is what shows the squiggly lines!)
        const markers = allDiagnostics.map(diagnostic => {
            const startPos = model.getPositionAt(diagnostic.start);
            const endPos = model.getPositionAt(diagnostic.start + diagnostic.length);

            const marker = {
                severity: getSeverity(diagnostic.category),
                startLineNumber: startPos.lineNumber,
                startColumn: startPos.column,
                endLineNumber: endPos.lineNumber,
                endColumn: endPos.column,
                message: getDiagnosticMessage(diagnostic),
                code: diagnostic.code ? `TS${diagnostic.code}` : undefined,
                source: 'TypeScript'
            };

            console.log("Creating marker:", marker);
            return marker;
        });

        // Set markers - THIS is what makes the errors appear!
        monaco.editor.setModelMarkers(model, 'typescript', markers);

        // Also add custom decorations for additional styling
        applyCustomDecorations(allDiagnostics);

        // Update UI with error count
        updateErrorCount(allDiagnostics);

        console.log(`Applied ${markers.length} markers to editor`);

    } catch (error) {
        if (error.message !== "Timeout") {
            console.error("Type checking failed:", error);
        }
    }
}

function getSeverity(category) {
    switch (category) {
        case 1: // Error
            return monaco.MarkerSeverity.Error;
        case 2: // Warning
            return monaco.MarkerSeverity.Warning;
        case 3: // Suggestion
            return monaco.MarkerSeverity.Info;
        default:
            return monaco.MarkerSeverity.Hint;
    }
}

function applyCustomDecorations(diagnostics) {
    if (!editor || !editor.getModel()) return;

    const model = editor.getModel();
    const newDecorations = [];

    diagnostics.forEach(diagnostic => {
        if (!diagnostic.start || !diagnostic.length) return;

        const startPos = model.getPositionAt(diagnostic.start);
        const endPos = model.getPositionAt(diagnostic.start + diagnostic.length);

        const range = new monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
        );

        // Add glyph margin decoration for errors
        if (diagnostic.category === 1) {
            newDecorations.push({
                range: range,
                options: {
                    glyphMarginClassName: 'type-error-glyph',
                    glyphMarginHoverMessage: { value: getDiagnosticMessage(diagnostic) }
                }
            });
        }
    });

    // Apply decorations
    errorMarkers = editor.deltaDecorations(errorMarkers, newDecorations);
}

function getDiagnosticMessage(diagnostic) {
    if (typeof diagnostic.messageText === 'string') {
        return diagnostic.messageText;
    }

    if (Array.isArray(diagnostic.messageText)) {
        return diagnostic.messageText.map(m =>
            typeof m === 'string' ? m : m.messageText
        ).join('\n');
    }

    if (diagnostic.messageText && diagnostic.messageText.messageText) {
        let message = diagnostic.messageText.messageText;
        let current = diagnostic.messageText.next;
        while (current) {
            if (Array.isArray(current)) {
                current.forEach(item => {
                    if (item.messageText) {
                        message += '\n' + item.messageText;
                    }
                });
                break;
            } else if (current.messageText) {
                message += '\n' + current.messageText;
                current = current.next;
            } else {
                break;
            }
        }
        return message;
    }

    return 'Unknown error';
}

function clearAllErrors() {
    // Clear markers
    const model = editor?.getModel();
    if (model) {
        monaco.editor.setModelMarkers(model, 'typescript', []);
    }

    // Clear decorations
    if (editor && errorMarkers.length > 0) {
        errorMarkers = editor.deltaDecorations(errorMarkers, []);
    }
}

function updateErrorCount(diagnostics) {
    const errorCount = diagnostics.filter(d => d.category === 1).length;
    const warningCount = diagnostics.filter(d => d.category === 2).length;

    const errorElement = document.getElementById('error-count');
    if (errorElement) {
        if (errorCount > 0) {
            errorElement.innerHTML = `
                <span class="error-count" style="color:#ff4444">
                    ⚠️ ${errorCount} error${errorCount !== 1 ? 's' : ''}
                </span>
                ${warningCount > 0 ? `<span style="color:#ffaa44; margin-left:10px">
                    ⚠️ ${warningCount} warning${warningCount !== 1 ? 's' : ''}
                </span>` : ''}
            `;
            errorElement.style.display = 'block';
        } else if (warningCount > 0) {
            errorElement.innerHTML = `
                <span style="color:#ffaa44">
                    ⚠️ ${warningCount} warning${warningCount !== 1 ? 's' : ''}
                </span>
            `;
            errorElement.style.display = 'block';
        } else {
            errorElement.innerHTML = '<span style="color:#4CAF50">✓ No errors</span>';
            errorElement.style.display = 'block';
        }
    }
}

function updateLineInfo(position) {
    if (!position) return;

    const model = editor.getModel();
    const lineNumber = position.lineNumber;
    const column = position.column;

    // Check for markers at this position
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    let errorInfo = '';

    markers.forEach(marker => {
        if (marker.startLineNumber <= lineNumber &&
            marker.endLineNumber >= lineNumber &&
            marker.startColumn <= column &&
            marker.endColumn >= column) {
            const shortMessage = marker.message.substring(0, 50);
            errorInfo = ` | ${marker.severity === 8 ? 'Error' : 'Warning'}: ${shortMessage}...`;
        }
    });

    lineInfoElement.textContent = `Line: ${lineNumber}, Column: ${column}${errorInfo}`;
}

/* ===============================
   RUN CODE WITH TYPE CHECKING
================================ */
function runCode() {
    outputElement.innerHTML = "";

    // Force a type check before running
    checkTypeScriptErrors();

    // Wait a moment for check to complete, then verify
    setTimeout(() => {
        const model = editor.getModel();
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        const errors = markers.filter(m => m.severity === monaco.MarkerSeverity.Error);

        if (errors.length > 0) {
            const runAnyway = confirm(`There are ${errors.length} TypeScript error(s). Run code anyway?`);
            if (!runAnyway) {
                showToast("Code has errors - not executing", "warning");
                return;
            }
        }

        executeCode();
    }, 100);
}

function executeCode() {
    try {
        // Transpile TypeScript to JavaScript
        const jsCode = ts.transpile(editor.getValue(), {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.ESNext,
            strict: true,
            noImplicitAny: true
        });

        overrideConsole();

        // Create safe execution context
        const context = createSafeContext();
        const functionArgs = Object.keys(context);
        const functionValues = Object.values(context);

        const executionCode = `
            "use strict";
            try {
                ${jsCode}
                console.log("✅ Execution completed successfully");
            } catch (error) {
                console.error("❌ Runtime error:", error);
                throw error;
            }
        `;

        const execute = new Function(...functionArgs, executionCode);
        execute(...functionValues);

        restoreConsole();
        showToast("Code executed successfully", "success");

    } catch (error) {
        restoreConsole();
        renderLog([`Execution Error: ${error.message}`], "error");
        showToast("Execution failed", "error");
    }
}

function createSafeContext() {
    return {
        console: {
            log: (...args) => renderLog(args, "log"),
            error: (...args) => renderLog(args, "error"),
            warn: (...args) => renderLog(args, "warn"),
            info: (...args) => renderLog(args, "info"),
            debug: (...args) => renderLog(args, "debug")
        },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Date,
        Math,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        TypeError,
        RangeError,
        Map,
        Set,
        Promise,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURI,
        decodeURI
    };
}

/* ===============================
   CONSOLE OUTPUT
================================ */
function overrideConsole() {
    console._log = console.log;
    console._error = console.error;
    console._warn = console.warn;
    console._info = console.info;
    console._debug = console.debug;

    console.log = (...args) => renderLog(args, "log");
    console.error = (...args) => renderLog(args, "error");
    console.warn = (...args) => renderLog(args, "warn");
    console.info = (...args) => renderLog(args, "info");
    console.debug = (...args) => renderLog(args, "debug");
}

function restoreConsole() {
    if (console._log) console.log = console._log;
    if (console._error) console.error = console._error;
    if (console._warn) console.warn = console._warn;
    if (console._info) console.info = console._info;
    if (console._debug) console.debug = console._debug;
}

function renderLog(args, type) {
    const entry = document.createElement("div");
    entry.className = `console-entry ${type}`;

    const header = document.createElement("div");
    header.className = "console-header";
    header.innerHTML = `
        <span class="badge ${type}">${type.toUpperCase()}</span>
        <span class="time">${new Date().toLocaleTimeString()}</span>
    `;

    const body = document.createElement("div");
    body.className = "console-body";

    args.forEach(arg => {
        body.appendChild(formatValue(arg));
    });

    entry.appendChild(header);
    entry.appendChild(body);
    outputElement.appendChild(entry);
    outputElement.scrollTop = outputElement.scrollHeight;
}

function formatValue(value) {
    const el = document.createElement("div");
    el.className = "console-value";

    if (typeof value === "object" && value !== null) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = Array.isArray(value) ? `Array(${value.length})` : "Object";
        const pre = document.createElement("pre");
        pre.textContent = JSON.stringify(value, null, 2);
        details.append(summary, pre);
        el.appendChild(details);
    } else {
        el.textContent = String(value);
    }
    return el;
}

/* ===============================
   EVENT LISTENERS
================================ */
function setupEventListeners() {
    document.getElementById("btn-run").onclick = runCode;
    document.getElementById("btn-clear").onclick = () => {
        editor.setValue("");
        outputElement.innerHTML = "";
        autoSaveCode();
        clearAllErrors();
        showToast("Editor cleared", "info");
    };
    document.getElementById("btn-save").onclick = saveCode;
    document.getElementById("btn-share").onclick = shareCode;
    document.getElementById("btn-check-types").onclick = () => {
        checkTypeScriptErrors();
        showToast("Type checking...", "info");
    };

    document.getElementById("languageList").onclick = e => {
        const li = e.target.closest("li");
        if (!li) return;
        document.querySelectorAll("#languageList li").forEach(x => x.classList.remove("active"));
        li.classList.add("active");
        switchLanguage(li.dataset.lang);
    };
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
    showToast("Code saved", "success");
}

function loadSavedCode() {
    const code = localStorage.getItem("typescript_code");
    if (code && !new URLSearchParams(location.search).get("code")) {
        // Don't show this message on initial load
    }
}

function loadCodeFromURL() {
    const code = new URLSearchParams(location.search).get("code");
    if (code) {
        try {
            const decoded = decodeURIComponent(atob(code));
            editor.setValue(decoded);
            showToast("Code loaded from URL", "success");
        } catch (e) {
            showToast("Failed to load code from URL", "error");
        }
    }
}

function shareCode() {
    const code = editor.getValue();
    const encoded = btoa(encodeURIComponent(code));
    const shareUrl = `${location.origin}${location.pathname}?code=${encoded}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Share URL copied to clipboard", "success");
    }).catch(() => {
        showToast("Failed to copy URL", "error");
    });
}

function switchLanguage(lang) {
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
   TOAST & UI
================================ */
function showToast(message, type = "info", duration = 2000) {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = "block";
    toast.style.opacity = "1";

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            toast.style.display = "none";
        }, 300);
    }, duration);
}

/* ===============================
   ERROR STYLES
================================ */
function addErrorStyles() {
    if (document.getElementById('typescript-error-styles')) return;

    const styles = `
        /* Glyph Margin Icons */
        .type-error-glyph {
            background-color: #ff4444 !important;
            width: 3px !important;
            margin-left: 5px !important;
            border-radius: 1px !important;
            cursor: pointer !important;
        }
        
        .type-warning-glyph {
            background-color: #ffaa44 !important;
            width: 3px !important;
            margin-left: 5px !important;
            border-radius: 1px !important;
            cursor: pointer !important;
        }
        
        /* Error Count Display */
        #error-count {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(30, 30, 30, 0.9);
            padding: 8px 16px;
            border-radius: 6px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 13px;
            z-index: 1000;
            border: 1px solid #444;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: none;
        }
        
        /* Test Button */
        .test-button {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #007acc;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-family: 'Segoe UI', sans-serif;
            font-size: 13px;
            z-index: 1000;
        }
        
        .test-button:hover {
            background: #0066b3;
        }
        
        /* Console Error Colors */
        .console-entry.error {
            border-left-color: #ff4444;
        }
        
        .console-entry.warning {
            border-left-color: #ffaa44;
        }
        
        .badge.error {
            background-color: #ff4444;
        }
        
        .badge.warning {
            background-color: #ffaa44;
            color: #333;
        }
    `;

    const style = document.createElement('style');
    style.id = 'typescript-error-styles';
    style.textContent = styles;
    document.head.appendChild(style);
}

/* ===============================
   ADD TEST BUTTON
================================ */
setTimeout(() => {
    // Add error count display
    const errorCount = document.createElement('div');
    errorCount.id = 'error-count';
    document.body.appendChild(errorCount);

    // Add test button
    const testButton = document.createElement('button');
    testButton.className = 'test-button';
    testButton.textContent = 'Test Type Checking';
    testButton.onclick = () => {
        const testCode = `// Testing TypeScript Errors
interface Test {
    id: number;
    name: string;
}

// This should show an error
const test1: Test = {
    id: "123",  // ERROR: string instead of number
    name: "Test"
};

// This should be correct
const test2: Test = {
    id: 123,    // CORRECT
    name: "Test"
};

console.log("Test 1 (should show error):", test1);
console.log("Test 2 (correct):", test2);`;

        editor.setValue(testCode);
        setTimeout(() => {
            checkTypeScriptErrors();
            showToast("Test code loaded - errors should appear now", "info");
        }, 500);
    };
    document.body.appendChild(testButton);
}, 1000);