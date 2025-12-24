let editor;
let outputElement;
let lineInfoElement;
let toast;
let errorMarkers = [];
let typeCheckTimeout;

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
                noUnusedLocals: false,
                noUnusedParameters: false,
                noImplicitReturns: false,
                noFallthroughCasesInSwitch: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                allowJs: false,
                checkJs: false
            });

            // Enable ALL diagnostics - CRITICAL for real-time checking
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: false,  // MUST be false to check types
                noSyntaxValidation: false,     // MUST be false to check syntax
                noSuggestionDiagnostics: false,
                diagnosticCodesToIgnore: []
            });

            // Set eager model sync
            monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

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

            // Listen to Monaco's built-in marker changes
            monaco.editor.onDidChangeMarkers(([resource]) => {
                if (editor.getModel().uri.toString() === resource.toString()) {
                    updateErrorCountFromMarkers();

                    // Trigger manual check after short delay
                    checkTypeScriptErrors();
                }
            });

            // REAL-TIME TYPE CHECKING: Let Monaco handle it + manual trigger
            editor.onDidChangeModelContent(() => {
                clearTimeout(typeCheckTimeout);

                // Trigger manual check after short delay
                typeCheckTimeout = setTimeout(() => {
                    checkTypeScriptErrors();
                }, 800);

                autoSaveCode();
            });

            // Initial checks
            setTimeout(() => checkTypeScriptErrors(), 500);
            setTimeout(() => checkTypeScriptErrors(), 1500);
            setTimeout(() => checkTypeScriptErrors(), 3000);

            resolve();
        });
    });
}

/* ===============================
   REAL-TIME TYPE SCRIPT ERROR DETECTION
================================ */
async function checkTypeScriptErrors() {
    if (!editor || !editor.getModel()) {
        return;
    }

    try {
        const model = editor.getModel();
        const uri = model.uri;

        // Get TypeScript worker
        const worker = await monaco.languages.typescript.getTypeScriptWorker();
        const client = await worker(uri);

        // Get ALL diagnostics
        const [syntactic, semantic] = await Promise.all([
            client.getSyntacticDiagnostics(uri.toString()),
            client.getSemanticDiagnostics(uri.toString())
        ]);

        // Combine diagnostics
        const allDiagnostics = [...syntactic, ...semantic];

        console.log(`Type check complete: ${allDiagnostics.length} issues found`);

        // Create markers
        const markers = allDiagnostics
            .filter(d => d.start !== undefined && d.length !== undefined)
            .map(diagnostic => {
                const startPos = model.getPositionAt(diagnostic.start);
                const endPos = model.getPositionAt(diagnostic.start + diagnostic.length);

                return {
                    severity: getSeverity(diagnostic.category),
                    startLineNumber: startPos.lineNumber,
                    startColumn: startPos.column,
                    endLineNumber: endPos.lineNumber,
                    endColumn: endPos.column,
                    message: getDiagnosticMessage(diagnostic),
                    code: diagnostic.code ? String(diagnostic.code) : undefined,
                    source: 'ts'
                };
            });

        // Apply markers - this makes the red squiggly lines appear
        monaco.editor.setModelMarkers(model, 'typescript', markers);

        // Add custom decorations
        applyCustomDecorations(allDiagnostics);

        // Update error count
        updateErrorCountFromMarkers();

    } catch (error) {
        console.error("Type checking error:", error);
    }
}

function updateErrorCountFromMarkers() {
    if (!editor || !editor.getModel()) return;

    const model = editor.getModel();
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });

    const errorCount = markers.filter(m => m.severity === monaco.MarkerSeverity.Error).length;
    const warningCount = markers.filter(m => m.severity === monaco.MarkerSeverity.Warning).length;

    const errorElement = document.getElementById('error-count');
    if (errorElement) {
        if (errorCount > 0) {
            errorElement.innerHTML = `
                <span class="error-count" style="color:#ff4444; font-weight: bold;">
                    ❌ ${errorCount} error${errorCount !== 1 ? 's' : ''}
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
            errorElement.innerHTML = '<span style="color:#4CAF50; font-weight: bold;">✅ No errors</span>';
            errorElement.style.display = 'block';
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

    if (diagnostic.messageText && diagnostic.messageText.messageText) {
        let message = diagnostic.messageText.messageText;
        let current = diagnostic.messageText.next;

        while (current) {
            if (Array.isArray(current)) {
                current.forEach(item => {
                    if (item && item.messageText) {
                        message += '\n' + item.messageText;
                    }
                });
                break;
            } else if (current && current.messageText) {
                message += '\n' + current.messageText;
                current = current.next;
            } else {
                break;
            }
        }
        return message;
    }

    return 'Type error';
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
        if (marker.startLineNumber === lineNumber &&
            marker.startColumn <= column &&
            marker.endColumn >= column) {
            const shortMessage = marker.message.substring(0, 60);
            errorInfo = ` | ${marker.severity === 8 ? 'Error' : 'Warning'}: ${shortMessage}`;
        }
    });

    lineInfoElement.textContent = `Ln ${lineNumber}, Col ${column}${errorInfo}`;
}

/* ===============================
   RUN CODE WITH TYPE CHECKING
================================ */
function runCode() {
    outputElement.innerHTML = "";

    const model = editor.getModel();
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const errors = markers.filter(m => m.severity === monaco.MarkerSeverity.Error);

    if (errors.length > 0) {
        const errorList = errors.slice(0, 3).map(e =>
            `Line ${e.startLineNumber}: ${e.message.substring(0, 50)}...`
        ).join('\n');

        const runAnyway = confirm(
            `Found ${errors.length} TypeScript error(s):\n\n${errorList}\n\nRun anyway?`
        );

        if (!runAnyway) {
            showToast("Code has errors - not executing", "warning", 3000);
            return;
        }
    }

    executeCode();
}

function executeCode() {
    try {
        const jsCode = ts.transpile(editor.getValue(), {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.ESNext,
            strict: true,
            noImplicitAny: true
        });

        overrideConsole();

        const context = createSafeContext();
        const functionArgs = Object.keys(context);
        const functionValues = Object.values(context);

        const executionCode = `
            "use strict";
            try {
                ${jsCode}
                console.log("✅ Code executed successfully");
            } catch (error) {
                console.error("❌ Runtime error:", error.message);
                throw error;
            }
        `;

        const execute = new Function(...functionArgs, executionCode);
        execute(...functionValues);

        restoreConsole();
        showToast("Execution completed", "success");

    } catch (error) {
        restoreConsole();
        renderLog([`❌ Execution Error: ${error.message}`], "error");
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
        showToast("Editor cleared", "info");
    };
    document.getElementById("btn-save").onclick = saveCode;
    document.getElementById("btn-share").onclick = shareCode;
    document.getElementById("btn-check-types").onclick = () => {
        checkTypeScriptErrors();
        showToast("Checking types...", "info");
    };

    const languageList = document.getElementById("languageList");

}
languageList.addEventListener("click", (e) => {
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
/* ===============================
   AUTO-SAVE & STORAGE
================================ */
function autoSaveCode() {
    const code = editor.getValue();
    localStorage.setItem("typescript_code", code);
}

function saveCode() {
    autoSaveCode();
    showToast("Code saved to browser", "success");
}

function loadSavedCode() {
    // Handled by initial value in loadMonacoEditor
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
        showToast("Share URL copied to clipboard!", "success");
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
        
        #error-count {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(30, 30, 30, 0.95);
            padding: 10px 16px;
            border-radius: 8px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            z-index: 1000;
            border: 1px solid #555;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            display: none;
            transition: all 0.2s;
        }
        
        .test-button {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-family: 'Segoe UI', sans-serif;
            font-size: 13px;
            z-index: 1000;
            font-weight: 500;
            transition: background 0.2s;
        }
        
        .test-button:hover {
            background: #005a9e;
        }
        
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
    const errorCount = document.createElement('div');
    errorCount.id = 'error-count';
    document.body.appendChild(errorCount);

    const testButton = document.createElement('button');
    testButton.className = 'test-button';
    testButton.textContent = '🧪 Test Type Checking';
    testButton.onclick = () => {
        const testCode = `console.log("Hello, TypeScript ");`;

        editor.setValue(testCode);
        setTimeout(() => {
            checkTypeScriptErrors();
            showToast("Test loaded - you should see 3 errors!", "info", 3000);
        }, 300);
    };
    document.body.appendChild(testButton);
}, 1000);