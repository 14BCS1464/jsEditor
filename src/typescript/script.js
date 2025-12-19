let editor;
let outputElement;
let statusElement;
let lineInfoElement;
let loader;
let toast;
let logCount = 0;

document.addEventListener("DOMContentLoaded", async () => {
    outputElement = document.getElementById("output");
    statusElement = document.getElementById("status");
    lineInfoElement = document.getElementById("line-info");
    loader = document.getElementById("loader");
    toast = document.getElementById("toast");

    await loadMonacoEditor();
    setupEventListeners();
    loadSavedCode();
    loadCodeFromURL();

    showToast("TypeScript Online Compiler Ready", "success");
});

async function loadMonacoEditor() {
    return new Promise((resolve) => {
        require.config({
            paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs" }
        });

        require(["vs/editor/editor.main"], () => {
            editor = monaco.editor.create(document.getElementById("editor"), {
                value: `interface User {
    name: string;
    age: number;
}

const user: User = { name: "Alice", age: 30 };
console.log(user);`,
                language: "typescript",
                theme: "vs-dark",
                fontSize: 17,
                fontFamily: "monospace",
                fontWeight: "normal",
                lineHeight: 1.5,
                addLineNumbers: true,
                lineNumbersMinChars: 3,
                roundedSelection: false,
                readOnly: false,
                suggestOnTriggerCharacters: true,

                scrollBeyondLastLine: false,
                minimap: {
                    enabled: false
                },
                glyphMargin: true,
                folding: true,

                automaticLayout: true,
                target: "es2020",
                lib: ["es2020", "dom", "dom.iterable"],
                module: "esnext",
                moduleResolution: "node",
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true,
                allowSyntheticDefaultImports: true,
                allowJs: true,
                checkJs: false,
                jsx: "ts.JsxEmit.Preserve",
                declaration: false,

                // Editor specific settings
                tabSize: 2,
                formatOnType: true,
                autoIndent: "full",
                semanticHighlighting: {
                    enabled: true
                },
                quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: true
                },
                parameterHints: {
                    enabled: true
                },
                suggest: {
                    includeCompletionsForModuleExports: true,
                    includeAutomaticOptionalChainCompletions: true,
                    includeCompletionsWithInsertText: true,
                    snippetsPreventQuickSuggestions: false,
                    localityBonus: true,
                    shareSuggestSelections: true,
                    showIcons: true,
                    preview: true,
                    previewMode: "subword"
                },
                inlayHints: {
                    enabled: true,
                    includeInlayEnumMemberValueHints: true,
                    includeInlayFunctionLikeReturnTypeHints: true,
                    includeInlayFunctionParameterTypeHints: true,
                    includeInlayParameterNameHints: "all",
                    includeInlayParameterNameHintsWhenArgumentMatchesName: true,
                    includeInlayPropertyDeclarationTypeHints: true,
                    includeInlayVariableTypeHints: true
                },
                diagnostics: {
                    enable: true,
                    strict: true
                },
                hover: {
                    enabled: true,
                    delay: 300,
                    sticky: true
                }

            });

            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2020,
                strict: true
            });

            editor.onDidChangeCursorPosition(e => {
                lineInfoElement.textContent =
                    `Line: ${e.position.lineNumber}, Column: ${e.position.column}`;
            });

            resolve();
        });
    });
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

function switchLanguage(lang) {


    switch (lang) {
        case "javascript":
            window.location.href = "/src/editor/index.html";
            break;

        case "typescript":
            window.location.href = "/src/typescript/index.html"; // Leading slash!
            break;

        case "html":
            window.location.href = "/src/html/index.html";
            break;
        case "react":
            window.location.href = "/src/react/index.html";
            break;
        case "json":
            window.location.href = "/src/json/index.html";
            break;


        default:
            console.warn(`No runner defined for ${lang}`);
    }
}
const toggle = document.getElementById("autoExecuteToggle");
const label = document.getElementById("autoExecuteLabel");

function setupEventListeners() {
    document.getElementById("btn-run").onclick = runCode;
    document.getElementById("btn-clear").onclick = () => editor.setValue("");
    document.getElementById("btn-clear-output").onclick = () => outputElement.innerHTML = "";
    document.getElementById("btn-save").onclick = saveCode;
    document.getElementById("btn-share").onclick = shareCode;
}

function runCode() {
    const tsCode = editor.getValue();
    outputElement.innerHTML = "";

    try {
        const jsCode = ts.transpile(tsCode);
        overrideConsole();
        eval(jsCode);
        restoreConsole();
    } catch (e) {
        addLog(e.message, "error");
    }
}

function overrideConsole() {
    console._log = console.log;
    console.log = (...args) => addLog(args.join(" "), "log");
}

function restoreConsole() {
    console.log = console._log;
}

function addLog(message, type) {
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.textContent = message;
    outputElement.appendChild(div);
}

function showToast(msg, type) {
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.style.display = "block";
    setTimeout(() => toast.style.display = "none", 2500);
}

function saveCode() {
    localStorage.setItem("ts_code", editor.getValue());
    showToast("Code saved", "success");
}

function loadSavedCode() {
    const saved = localStorage.getItem("ts_code");
    if (saved) editor.setValue(saved);
}

function shareCode() {
    const encoded = btoa(editor.getValue());
    const url = `${location.origin}${location.pathname}?code=${encoded}`;
    navigator.clipboard.writeText(url);
    showToast("URL copied", "success");
}

function loadCodeFromURL() {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (code) editor.setValue(atob(code));
}
