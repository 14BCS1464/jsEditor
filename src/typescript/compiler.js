// Monaco Editor Configuration
let editor;
let outputElement;
let statusElement;
let lineInfoElement;
let loader;
let toast;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    outputElement = document.getElementById('output');
    statusElement = document.getElementById('status');
    lineInfoElement = document.getElementById('line-info');
    loader = document.getElementById('loader');
    toast = document.getElementById('toast');
    
    // Initialize Monaco Editor
    await initializeEditor();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load saved code if exists
    loadSavedCode();
    
    // Show welcome message
    showToast('TypeScript Online Compiler Ready!', 'success');
});

// Initialize Monaco Editor
async function initializeEditor() {
    // Configure require
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs' }});
    
    // Load Monaco
    return new Promise((resolve) => {
        require(['vs/editor/editor.main'], function() {
            // Create editor
            editor = monaco.editor.create(document.getElementById('editor'), {
                value: `// Welcome to TypeScript Online Compiler!
// Write your TypeScript code here...

interface User {
    id: number;
    name: string;
    email?: string;
}

enum Status {
    Active = 1,
    Inactive = 0
}

function greet(user: User): string {
    return \`Hello, \${user.name}!\`;
}

const user: User = { id: 1, name: "John Doe" };
console.log(greet(user));
console.log("Status:", Status.Active);

// Try running the code with the Run button above!`,
                language: 'typescript',
                theme: 'vs-dark',
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
                minimap: { enabled: true },
                formatOnPaste: true,
                formatOnType: true,
                wordWrap: 'on',
                wrappingIndent: 'same',
                scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    useShadows: false
                },
                suggest: {
                    snippetsPreventQuickSuggestions: false
                },
                parameterHints: {
                    enabled: true
                },
                hover: {
                    enabled: true,
                    delay: 300
                },
                inlayHints: {
                    enabled: true
                }
            });
            
            // Configure TypeScript compiler options
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2020,
                lib: ['es2020', 'dom', 'dom.iterable'],
                module: monaco.languages.typescript.ModuleKind.ESNext,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true,
                allowSyntheticDefaultImports: true,
                allowJs: true,
                checkJs: false,
                jsx: monaco.languages.typescript.JsxEmit.React,
                allowNonTsExtensions: true,
                noEmit: true,
                experimentalDecorators: true,
                emitDecoratorMetadata: true
            });
            
            // Set diagnostics options
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: false,
                noSyntaxValidation: false,
                diagnosticCodesToIgnore: []
            });
            
            // Update line info on cursor move
            editor.onDidChangeCursorPosition((e) => {
                const position = e.position;
                lineInfoElement.textContent = `Line: ${position.lineNumber}, Column: ${position.column}`;
            });
            
            resolve();
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    // Run button
    document.getElementById('btn-run').addEventListener('click', runCode);
    
    // Clear button
    document.getElementById('btn-clear').addEventListener('click', clearEditor);
    
    // Clear output button
    document.getElementById('btn-clear-output').addEventListener('click', clearOutput);
    
    // Copy output button
    document.getElementById('btn-copy-output').addEventListener('click', copyOutput);
    
    // Save button
    document.getElementById('btn-save').addEventListener('click', saveCode);
    
    // Share button
    document.getElementById('btn-share').addEventListener('click', shareCode);
    
    // Format button
    document.getElementById('btn-format').addEventListener('click', formatCode);
    
    // Snippets button
    document.getElementById('btn-snippets').addEventListener('click', toggleSnippets);
    
    // Close snippets when clicking outside
    document.addEventListener('click', (e) => {
        const snippetsPanel = document.getElementById('snippets-panel');
        const snippetsBtn = document.getElementById('btn-snippets');
        
        if (snippetsPanel.style.display === 'block' && 
            !snippetsPanel.contains(e.target) && 
            !snippetsBtn.contains(e.target)) {
            snippetsPanel.style.display = 'none';
        }
    });
    
    // Snippet items
    document.querySelectorAll('.snippet-item').forEach(item => {
        item.addEventListener('click', () => {
            loadSnippet(item.dataset.snippet);
            document.getElementById('snippets-panel').style.display = 'none';
        });
    });
    
    // Keyboard shortcut: Ctrl+Enter to run
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
        
        // Ctrl+S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCode();
        }
        
        // Ctrl+F to format
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            formatCode();
        }
    });
}

// Show toast message
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = 'toast';
    toast.classList.add(type);
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Update status
function updateStatus(message, type = 'info') {
    statusElement.textContent = message;
    statusElement.style.color = type === 'error' ? '#f44336' : 
                               type === 'warning' ? '#ff9800' : 
                               type === 'success' ? '#4CAF50' : '#ffffff';
}

// Show/hide loader
function setLoading(loading) {
    loader.style.display = loading ? 'block' : 'none';
}

// Run TypeScript code
async function runCode() {
    const code = editor.getValue();
    
    if (!code.trim()) {
        showToast('Please write some code first!', 'warning');
        return;
    }
    
    setLoading(true);
    updateStatus('Compiling TypeScript...');
    clearOutput();
    
    try {
        // Get diagnostics first
        const model = editor.getModel();
        const worker = await monaco.languages.typescript.getTypeScriptWorker();
        const client = await worker(model.uri);
        const diagnostics = await client.getSemanticDiagnostics(model.uri.toString());
        
        if (diagnostics.length > 0) {
            const errors = diagnostics.filter(d => d.category === 1); // Error category
            const warnings = diagnostics.filter(d => d.category === 2); // Warning category
            
            if (errors.length > 0) {
                updateStatus('TypeScript errors found', 'error');
                outputElement.innerHTML = '<div style="color: #f44336; margin-bottom: 10px;"><strong>TypeScript Errors:</strong></div>';
                
                errors.forEach((error, index) => {
                    const line = error.start ? model.getPositionAt(error.start).lineNumber : '?';
                    const message = error.messageText;
                    outputElement.innerHTML += `<div style="margin-bottom: 5px; padding: 5px; background: #2d2d2d; border-radius: 4px;">
                        <span style="color: #ff9800;">Line ${line}:</span> ${message}
                    </div>`;
                });
                
                showToast(`Found ${errors.length} TypeScript error(s)`, 'error');
                setLoading(false);
                return;
            }
            
            if (warnings.length > 0) {
                outputElement.innerHTML += '<div style="color: #ff9800; margin-bottom: 10px;"><strong>TypeScript Warnings:</strong></div>';
                warnings.forEach((warning, index) => {
                    const line = warning.start ? model.getPositionAt(warning.start).lineNumber : '?';
                    const message = warning.messageText;
                    outputElement.innerHTML += `<div style="margin-bottom: 5px; padding: 5px; background: #2d2d2d; border-radius: 4px;">
                        <span style="color: #ff9800;">Line ${line}:</span> ${message}
                    </div>`;
                });
            }
        }
        
        // Transpile TypeScript to JavaScript
        updateStatus('Transpiling to JavaScript...');
        
        let jsCode;
        try {
            jsCode = await transpileTypeScript(code);
        } catch (transpileError) {
            updateStatus('Transpilation failed', 'error');
            outputElement.innerHTML = `<div style="color: #f44336;">
                <strong>Transpilation Error:</strong><br>
                ${transpileError.message}
            </div>`;
            showToast('Transpilation failed', 'error');
            setLoading(false);
            return;
        }
        
        // Execute JavaScript
        updateStatus('Executing code...');
        
        try {
            const result = await executeJavaScript(jsCode);
            
            if (result.success) {
                updateStatus('Execution completed', 'success');
                showToast('Code executed successfully!', 'success');
                
                // Show output
                if (result.output) {
                    outputElement.innerHTML += result.output;
                }
                
                // Show result if any
                if (result.result !== undefined && result.result !== null) {
                    outputElement.innerHTML += `<div style="margin-top: 15px; color: #4CAF50;">
                        <strong>Return value:</strong> ${formatValue(result.result)}
                    </div>`;
                }
            } else {
                updateStatus('Execution failed', 'error');
                outputElement.innerHTML += `<div style="color: #f44336; margin-top: 15px;">
                    <strong>Runtime Error:</strong><br>
                    ${result.error}
                </div>`;
                showToast('Runtime error occurred', 'error');
            }
            
        } catch (executionError) {
            updateStatus('Execution failed', 'error');
            outputElement.innerHTML += `<div style="color: #f44336; margin-top: 15px;">
                <strong>Execution Error:</strong><br>
                ${executionError.message}
            </div>`;
            showToast('Execution failed', 'error');
        }
        
    } catch (error) {
        updateStatus('Error occurred', 'error');
        outputElement.innerHTML = `<div style="color: #f44336;">
            <strong>Error:</strong> ${error.message}
        </div>`;
        showToast('An error occurred', 'error');
    } finally {
        setLoading(false);
    }
}

// Transpile TypeScript to JavaScript
async function transpileTypeScript(code) {
    return new Promise((resolve, reject) => {
        try {
            // Use Monaco's TypeScript compiler if available
            if (window.ts) {
                const result = ts.transpileModule(code, {
                    compilerOptions: {
                        target: ts.ScriptTarget.ES2020,
                        module: ts.ModuleKind.ESNext,
                        strict: true,
                        esModuleInterop: true,
                        skipLibCheck: true,
                        forceConsistentCasingInFileNames: true,
                        resolveJsonModule: true,
                        allowSyntheticDefaultImports: true,
                        jsx: ts.JsxEmit.React,
                        allowNonTsExtensions: true
                    }
                });
                
                resolve(result.outputText);
            } else {
                // Fallback to our custom transpiler
                const jsCode = stripTypeScript(code);
                resolve(jsCode);
            }
        } catch (error) {
            reject(error);
        }
    });
}

// Custom TypeScript transpiler (fallback)
function stripTypeScript(code) {
    let js = code;
    
    // Remove type-only constructs
    const patterns = [
        // Remove interface declarations
        [/interface\s+\w+(?:\s*<[^>]*>)?(?:\s+extends\s+[^{]*)?\s*\{[^}]*\}/g, ''],
        
        // Remove type aliases
        [/type\s+\w+(?:\s*<[^>]*>)?\s*=\s*[^;]+;/g, ''],
        
        // Remove enum declarations (we'll handle them specially)
        [/enum\s+(\w+)\s*\{([^}]*)\}/g, (match, name, body) => {
            const lines = body.split(',').filter(line => line.trim());
            const enumValues = {};
            let currentValue = 0;
            
            for (const line of lines) {
                const [key, value] = line.split('=').map(s => s.trim());
                if (value === undefined) {
                    enumValues[key] = currentValue++;
                } else if (/^\d+$/.test(value)) {
                    enumValues[key] = parseInt(value, 10);
                    currentValue = parseInt(value, 10) + 1;
                } else {
                    enumValues[key] = value.replace(/['"]/g, '');
                }
            }
            
            return `const ${name} = ${JSON.stringify(enumValues)};\n` +
                   `Object.keys(${name}).forEach(key => {\n` +
                   `  if (typeof ${name}[key] === 'number') {\n` +
                   `    ${name}[${name}[key]] = key;\n` +
                   `  }\n` +
                   `});\n` +
                   `Object.freeze(${name});`;
        }],
        
        // Remove namespace declarations
        [/namespace\s+\w+\s*\{[^}]*\}/g, ''],
        
        // Remove type-only imports
        [/import\s+type\s+[^;]+;/g, ''],
        [/export\s+type\s+[^;]+;/g, ''],
        
        // Remove access modifiers
        [/\b(public|private|protected|readonly|abstract)\s+/g, ''],
        
        // Remove 'implements' clauses
        [/\s+implements\s+[^{]+/g, ''],
        
        // Remove 'as' type assertions
        [/\s+as\s+\w+(?:\s*<[^>]*>)?/g, ''],
        
        // Remove parameter type annotations
        [/([\(\,]\s*)(\w+)\s*\??\s*:\s*[^,\)]+/g, '$1$2'],
        
        // Remove return type annotations
        [/\)\s*:\s*[^{]+(?=\{)/g, ')'],
        [/\)\s*:\s*[^{]+(?=\s*=>)/g, ')'],
        
        // Remove variable type annotations
        [/(const|let|var)\s+(\w+)\s*\??\s*:\s*[^=]+(?=\s*=)/g, '$1 $2'],
        [/(const|let|var)\s+(\w+)\s*\??\s*:\s*[^;]+;/g, '$1 $2;'],
        
        // Remove property type annotations in classes
        [/(\w+)\s*\??\s*:\s*[^;=]+(?=\s*[;=])/g, '$1'],
        
        // Remove generic type parameters
        [/(function|class)\s+\w+\s*<[^>]*>/g, '$1 $2'],
        [/<\w+\s+extends\s+[^>]+>/g, ''],
        
        // Remove non-null assertions
        [/(\w+)\s*!\s*(?![=])/g, '$1'],
    ];
    
    patterns.forEach(([pattern, replacement]) => {
        if (typeof replacement === 'function') {
            js = js.replace(pattern, replacement);
        } else {
            js = js.replace(pattern, replacement);
        }
    });
    
    // Clean up
    js = js.replace(/\n\s*\n\s*\n/g, '\n\n');
    js = js.replace(/;\s*;/g, ';');
    
    return js;
}

// Execute JavaScript code
async function executeJavaScript(code) {
    return new Promise((resolve) => {
        const sandbox = {
            console: {
                log: (...args) => {
                    const content = args.map(arg => formatValue(arg)).join(' ');
                    outputElement.innerHTML += `<div class="log-entry">${content}</div>`;
                },
                error: (...args) => {
                    const content = args.map(arg => formatValue(arg)).join(' ');
                    outputElement.innerHTML += `<div class="log-entry" style="color: #f44336;">${content}</div>`;
                },
                warn: (...args) => {
                    const content = args.map(arg => formatValue(arg)).join(' ');
                    outputElement.innerHTML += `<div class="log-entry" style="color: #ff9800;">${content}</div>`;
                },
                info: (...args) => {
                    const content = args.map(arg => formatValue(arg)).join(' ');
                    outputElement.innerHTML += `<div class="log-entry" style="color: #2196F3;">${content}</div>`;
                },
                clear: () => {
                    outputElement.innerHTML = '';
                },
                table: (data) => {
                    if (!data) return;
                    
                    let html = '<table style="border-collapse: collapse; margin: 10px 0;">';
                    const headers = Object.keys(data[0] || {});
                    
                    html += '<tr>';
                    headers.forEach(header => {
                        html += `<th style="border: 1px solid #444; padding: 5px; text-align: left;">${header}</th>`;
                    });
                    html += '</tr>';
                    
                    if (Array.isArray(data)) {
                        data.forEach(row => {
                            html += '<tr>';
                            headers.forEach(header => {
                                const value = row[header];
                                html += `<td style="border: 1px solid #444; padding: 5px;">${formatValue(value)}</td>`;
                            });
                            html += '</tr>';
                        });
                    }
                    
                    html += '</table>';
                    outputElement.innerHTML += html;
                }
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
            SyntaxError,
            Promise
        };
        
        // Add global objects
        sandbox.global = sandbox;
        sandbox.window = sandbox;
        sandbox.self = sandbox;
        
        try {
            const executeCode = `
                (function() {
                    'use strict';
                    ${code}
                })();
            `;
            
            const result = new Function(...Object.keys(sandbox), executeCode)(...Object.values(sandbox));
            
            // Handle promises
            if (result && typeof result.then === 'function') {
                result.then(promiseResult => {
                    resolve({
                        success: true,
                        result: promiseResult,
                        output: outputElement.innerHTML
                    });
                }).catch(error => {
                    outputElement.innerHTML += `<div class="log-entry" style="color: #f44336;">Unhandled Promise Rejection: ${error.message}</div>`;
                    resolve({
                        success: false,
                        error: error.message,
                        output: outputElement.innerHTML
                    });
                });
            } else {
                resolve({
                    success: true,
                    result: result,
                    output: outputElement.innerHTML
                });
            }
            
        } catch (error) {
            outputElement.innerHTML += `<div class="log-entry" style="color: #f44336;">Runtime Error: ${error.message}</div>`;
            resolve({
                success: false,
                error: error.message,
                output: outputElement.innerHTML
            });
        }
    });
}

// Format value for display
function formatValue(value) {
    if (value === undefined) return '<span style="color: #888;">undefined</span>';
    if (value === null) return '<span style="color: #888;">null</span>';
    
    if (typeof value === 'string') {
        return `<span style="color: #CE9178;">"${value}"</span>`;
    }
    
    if (typeof value === 'number') {
        return `<span style="color: #B5CEA8;">${value}</span>`;
    }
    
    if (typeof value === 'boolean') {
        return `<span style="color: #569CD6;">${value}</span>`;
    }
    
    if (typeof value === 'function') {
        return `<span style="color: #DCDCAA;">ƒ ${value.name || 'anonymous'}()</span>`;
    }
    
    if (Array.isArray(value)) {
        return `<span style="color: #9CDCFE;">[${value.map(v => formatValue(v)).join(', ')}]</span>`;
    }
    
    if (typeof value === 'object') {
        try {
            const json = JSON.stringify(value, null, 2);
            return `<pre style="color: #9CDCFE; margin: 5px 0; padding: 5px; background: #2d2d2d; border-radius: 4px; overflow-x: auto;">${json}</pre>`;
        } catch {
            return `<span style="color: #9CDCFE;">[Object ${value.constructor.name}]</span>`;
        }
    }
    
    return String(value);
}

// Clear editor
function clearEditor() {
    if (confirm('Are you sure you want to clear the editor?')) {
        editor.setValue('');
        clearOutput();
        showToast('Editor cleared', 'success');
    }
}

// Clear output
function clearOutput() {
    outputElement.innerHTML = '';
}

// Copy output to clipboard
function copyOutput() {
    const text = outputElement.innerText || outputElement.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('Output copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy output', 'error');
    });
}

// Save code to localStorage
function saveCode() {
    const code = editor.getValue();
    localStorage.setItem('ts_compiler_code', code);
    showToast('Code saved locally!', 'success');
}

// Load saved code
function loadSavedCode() {
    const savedCode = localStorage.getItem('ts_compiler_code');
    if (savedCode) {
        editor.setValue(savedCode);
        showToast('Previous code loaded', 'info');
    }
}

// Share code via URL
function shareCode() {
    const code = editor.getValue();
    const compressed = btoa(encodeURIComponent(code));
    
    const url = new URL(window.location.href);
    url.searchParams.set('code', compressed);
    
    navigator.clipboard.writeText(url.toString()).then(() => {
        showToast('Shareable URL copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy URL', 'error');
    });
}

// Load code from URL
function loadCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    
    if (codeParam) {
        try {
            const code = decodeURIComponent(atob(codeParam));
            editor.setValue(code);
            showToast('Code loaded from URL', 'info');
        } catch (error) {
            showToast('Failed to load code from URL', 'error');
        }
    }
}

// Format code
async function formatCode() {
    try {
        const model = editor.getModel();
        const range = model.getFullModelRange();
        const text = model.getValueInRange(range);
        
        const worker = await monaco.languages.typescript.getTypeScriptWorker();
        const client = await worker(model.uri);
        const edits = await client.getFormattingEditsForDocument(model.uri.toString(), {
            tabSize: 2,
            insertSpaces: true,
            indentSize: 2
        });
        
        editor.executeEdits('format', edits);
        showToast('Code formatted!', 'success');
    } catch (error) {
        showToast('Formatting failed', 'error');
    }
}

// Toggle snippets panel
function toggleSnippets() {
    const panel = document.getElementById('snippets-panel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

// Load code snippet
function loadSnippet(type) {
    const snippets = {
        basic: `interface User {
    id: number;
    name: string;
    email?: string;
}

function greet(user: User): string {
    return \`Hello, \${user.name}!\`;
}

const user: User = { id: 1, name: "Alice" };
console.log(greet(user));`,
        
        class: `class Person {
    private age: number;
    
    constructor(public name: string, age: number) {
        this.age = age;
    }
    
    greet(): string {
        return \`Hello, my name is \${this.name} and I'm \${this.age} years old.\`;
    }
    
    haveBirthday(): void {
        this.age++;
        console.log(\`Happy Birthday! Now I'm \${this.age}\`);
    }
}

const person = new Person("Bob", 30);
console.log(person.greet());
person.haveBirthday();`,
        
        generic: `function identity<T>(arg: T): T {
    return arg;
}

function reverseArray<T>(array: T[]): T[] {
    return [...array].reverse();
}

console.log(identity<string>("Hello"));
console.log(identity<number>(42));

const numbers = [1, 2, 3, 4, 5];
const strings = ["a", "b", "c"];
console.log(reverseArray(numbers));
console.log(reverseArray(strings));`,
        
        async: `interface Post {
    userId: number;
    id: number;
    title: string;
    body: string;
}

async function fetchPosts(): Promise<Post[]> {
    try {
        const response = await fetch('https://jsonplaceholder.typicode.com/posts');
        if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        const posts: Post[] = await response.json();
        return posts.slice(0, 3); // Return first 3 posts
    } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
}

async function main() {
    console.log('Fetching posts...');
    const posts = await fetchPosts();
    console.log(\`Found \${posts.length} posts:\`);
    posts.forEach(post => {
        console.log(\`- \${post.title}\`);
    });
}

main();`,
        
        dom: `// Create DOM elements
const container = document.createElement('div');
container.style.padding = '20px';
container.style.backgroundColor = '#2d2d2d';
container.style.borderRadius = '8px';

const title = document.createElement('h2');
title.textContent = 'DOM Manipulation with TypeScript';
title.style.color = '#4CAF50';

const button = document.createElement('button');
button.textContent = 'Click me!';
button.style.padding = '10px 20px';
button.style.margin = '10px 0';
button.style.backgroundColor = '#007acc';
button.style.color = 'white';
button.style.border = 'none';
button.style.borderRadius = '4px';
button.style.cursor = 'pointer';

let clickCount = 0;
button.addEventListener('click', () => {
    clickCount++;
    const message = document.createElement('p');
    message.textContent = \`Button clicked \${clickCount} time\${clickCount === 1 ? '' : 's'}!\`;
    message.style.color = '#CE9178';
    container.appendChild(message);
});

container.appendChild(title);
container.appendChild(button);

// Log to console
console.log('DOM elements created');
console.log(container);`,
        
        react: `// React-like component in TypeScript
interface ButtonProps {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({ label, onClick, variant = 'primary' }) => {
    const style = {
        padding: '10px 20px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '16px',
        backgroundColor: variant === 'primary' ? '#007acc' : '#6c757d',
        color: 'white'
    };
    
    return (
        <button style={style} onClick={onClick}>
            {label}
        </button>
    );
};

// Usage
const handleClick = () => {
    console.log('Button clicked!');
};

console.log('React Component Example:');
console.log(Button({ label: 'Click Me', onClick: handleClick, variant: 'primary' }));`
    };
    
    if (snippets[type]) {
        editor.setValue(snippets[type]);
        showToast(`Loaded ${type} snippet`, 'success');
    }
}

// Initialize on load
loadCodeFromURL();