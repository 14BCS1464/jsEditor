require.config({
    paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs"
    }
});

require(["vs/editor/editor.main"], function() {
    const savedCode = localStorage.getItem('jsEditorCode');
    const initialCode = savedCode || `// Test the prototype chain display
function Person(name, age) {
  this.name = name;
  this.age = age;
}

Person.prototype.greet = function() {
  return "Hello, my name is " + this.name;
};

function Employee(name, age, jobTitle) {
  Person.call(this, name, age);
  this.jobTitle = jobTitle;
}

Employee.prototype = Object.create(Person.prototype);
Employee.prototype.constructor = Employee;

Employee.prototype.work = function() {
  return this.name + " is working as a " + this.jobTitle;
};

const john = new Employee("John Doe", 30, "Developer");
console.log("Employee object:", john);
console.log("Prototype chain inspection:");
console.dir(john);

// Try calling methods from the prototype chain
console.log(john.greet());
console.log(john.work());

// Test array prototype chain
const arr = [1, 2, 3];
console.log("Array prototype:", arr);`;

    var editor = monaco.editor.create(document.getElementById("editor"), {
        value: initialCode,
        language: "javascript",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: {
            enabled: true
        },
        scrollBeyondLastLine: true,
        fontFamily: "'Fira Code', 'Consolas', monospace",
        fontSize: 14,
        lineNumbers: "on",
        roundedSelection: true,
        scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
        }
    });

    const outputElement = document.getElementById("output");
    let logCount = 0;
    let autoExecuteEnabled = true;
    let autoExecuteTimer = null;
    let executionCount = 0;
    let lastExecutionTime = 0;
    const MAX_EXECUTIONS_PER_MINUTE = 20;
    const EXECUTION_DELAY = 300;

    const SAFETY_LIMITS = {
        maxCodeLength: 10000,
        maxOutputLines: 1000,
        maxExecutionTime: 5000,
        dangerousPatterns: [
            /while\s*\(\s*true\s*\)/gi,
            /for\s*\(\s*;\s*;\s*\)/gi,
            /setInterval/gi,
            /alert\s*\(/gi,
            /confirm\s*\(/gi,
            /prompt\s*\(/gi,
            /document\.write/gi,
            /eval\s*\(/gi,
            /Function\s*\(/gi,
            /setTimeout.*setTimeout/gi,
            /\.innerHTML\s*=/gi
        ]
    };

    const container = document.querySelector('.container');
    const rowLayoutBtn = document.getElementById('rowLayout');
    const columnLayoutBtn = document.getElementById('columnLayout');

    const savedLayout = localStorage.getItem('editorLayout') || 'row';
    if (savedLayout === 'column') {
        container.classList.add('column-layout');
        rowLayoutBtn.classList.remove('active');
        columnLayoutBtn.classList.add('active');
    }

    rowLayoutBtn.addEventListener('click', function() {
        container.classList.remove('column-layout');
        rowLayoutBtn.classList.add('active');
        columnLayoutBtn.classList.remove('active');
        localStorage.setItem('editorLayout', 'row');
        setTimeout(() => editor.layout(), 100);
    });

    columnLayoutBtn.addEventListener('click', function() {
        container.classList.add('column-layout');
        rowLayoutBtn.classList.remove('active');
        columnLayoutBtn.classList.add('active');
        localStorage.setItem('editorLayout', 'column');
        setTimeout(() => editor.layout(), 100);
    });

    function saveCodeToStorage() {
        const code = editor.getValue();
        try {
            localStorage.setItem('jsEditorCode', code);
            const saveIndicator = document.getElementById('saveIndicator') || createSaveIndicator();
            saveIndicator.style.opacity = '1';
            setTimeout(() => {
                saveIndicator.style.opacity = '0';
            }, 1000);
        } catch (e) {
            console.error('Failed to save code to localStorage:', e);
        }
    }

    function createSaveIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'saveIndicator';
        indicator.textContent = '💾 Saved';
        indicator.style.position = 'absolute';
        indicator.style.bottom = '10px';
        indicator.style.right = '10px';
        indicator.style.background = 'rgba(0, 184, 148, 0.8)';
        indicator.style.color = 'white';
        indicator.style.padding = '5px 10px';
        indicator.style.borderRadius = '4px';
        indicator.style.fontSize = '12px';
        indicator.style.transition = 'opacity 0.3s ease';
        indicator.style.opacity = '0';
        indicator.style.zIndex = '1000';
        document.getElementById('editor').appendChild(indicator);
        return indicator;
    }

    function isRateLimited() {
        const now = Date.now();
        if (now - lastExecutionTime < 60000) {
            executionCount++;
        } else {
            executionCount = 1;
            lastExecutionTime = now;
        }

        if (executionCount > MAX_EXECUTIONS_PER_MINUTE) {
            return true;
        }
        return false;
    }

    function isSafeCode(code) {
        if (!code || code.length > SAFETY_LIMITS.maxCodeLength) {
            return { safe: false, reason: 'Code too long or empty' };
        }

        for (const pattern of SAFETY_LIMITS.dangerousPatterns) {
            if (pattern.test(code)) {
                return { 
                    safe: false, 
                    reason: `Potentially dangerous pattern detected: ${pattern.source}` 
                };
            }
        }

        const loopCount = (code.match(/for\s*\(|while\s*\(|do\s*{/gi) || []).length;
        if (loopCount > 5) {
            return { safe: false, reason: 'Too many loops detected' };
        }

        const functionCallCount = (code.match(/\w+\s*\(/gi) || []).length;
        if (functionCallCount > 50) {
            return { safe: false, reason: 'Too many function calls detected' };
        }

        return { safe: true };
    }

    function safeAutoExecute() {
        if (!autoExecuteEnabled || isRateLimited()) return;

        const code = editor.getValue();
        const safetyCheck = isSafeCode(code);

        if (!safetyCheck.safe) {
            runCodeSafely();
            return;
        }

        if (autoExecuteTimer) {
            clearTimeout(autoExecuteTimer);
        }

        autoExecuteTimer = setTimeout(() => {
            try {
                runCodeSafely(code);
            } catch (error) {
                addLogEntry(`Auto-execution error: ${error.message}`, 'error');
            }
        }, EXECUTION_DELAY);
    }

    function runCodeSafely(code) {
        const startTime = Date.now();
        let executionTimer = null;

        executionTimer = setTimeout(() => {
            addLogEntry('⏱️ Execution timeout - code took too long to run', 'error');
            throw new Error('Execution timeout');
        }, SAFETY_LIMITS.maxExecutionTime);

        try {
            if (outputElement.children.length > SAFETY_LIMITS.maxOutputLines) {
                clearOutput();
                addLogEntry('🧹 Output cleared due to size limit', 'info');
            }

            runCode();

        } finally {
            clearTimeout(executionTimer);
            const executionTime = Date.now() - startTime;

            if (executionTime > 1000) {
                addLogEntry(`⏱️ Execution time: ${executionTime}ms`, 'info');
            }
        }
    }

    function createAutoExecuteToggle() {
        const controlsDiv = document.getElementById('controls').querySelector('div');
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'autoExecute';
        toggleBtn.innerHTML = '🔄 Auto-Execute: ON';
        toggleBtn.style.background = 'linear-gradient(135deg, #00b894, #20bf6b)';
        toggleBtn.style.color = 'white';

        toggleBtn.addEventListener('click', function() {
            autoExecuteEnabled = !autoExecuteEnabled;
            if (autoExecuteEnabled) {
                this.innerHTML = '🔄 Auto-Execute: ON';
                this.style.background = 'linear-gradient(135deg, #00b894, #20bf6b)';
                addLogEntry('✅ Auto-execution enabled', 'info');
                safeAutoExecute();
            } else {
                this.innerHTML = '⏸️ Auto-Execute: OFF';
                this.style.background = 'linear-gradient(135deg, #ff7675, #d63031)';
                if (autoExecuteTimer) {
                    clearTimeout(autoExecuteTimer);
                }
                addLogEntry('⏸️ Auto-execution disabled', 'warn');
            }
        });

        controlsDiv.appendChild(toggleBtn);
    }

    createAutoExecuteToggle();

    let changeTimer = null;
    let saveTimer = null;
    editor.onDidChangeModelContent(() => {
        const code = editor.getValue();

        if (saveTimer) {
            clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(() => {
            saveCodeToStorage();
        }, 1000);

        if (autoExecuteEnabled && code.trim()) {
            if (changeTimer) {
                clearTimeout(changeTimer);
            }

            changeTimer = setTimeout(() => {
                safeAutoExecute();
            }, 800);
        }
    });

    function createObjectInspector(obj, depth = 0, maxDepth = 3, seen = new WeakSet()) {
        if (depth > maxDepth) return '<span class="object-value">[Object]</span>';

        if (obj === null) return '<span class="object-null">null</span>';
        if (obj === undefined) return '<span class="object-undefined">undefined</span>';

        const type = typeof obj;

        if (type === 'string') {
            return `<span class="object-string">"${obj}"</span>`;
        }
        if (type === 'number') {
            return `<span class="object-number">${obj}</span>`;
        }
        if (type === 'boolean') {
            return `<span class="object-boolean">${obj}</span>`;
        }
        if (type === 'function') {
            return `<span class="object-value">ƒ ${obj.name || 'anonymous'}(${getFunctionParams(obj)})</span>`;
        }

        if (Array.isArray(obj)) {
            if (obj.length === 0) return '<span class="object-value">[]</span>';

            const id = `array_${Date.now()}_${Math.random()}`;
            let html = `<div class="object-inspector">`;
            html += `<span class="expandable" onclick="toggleExpand('${id}')">Array(${obj.length})</span>`;
            html += `<div id="${id}" class="object-tree collapsed">`;

            obj.slice().reverse().forEach((item, revIndex, arr) => {
                const origIndex = obj.length - 1 - revIndex;
                html += `<div><span class="object-key">${origIndex}:</span> ${createObjectInspector(item, depth + 1, maxDepth, seen)}</div>`;
            });

            html += `</div></div>`;
            return html;
        }

        if (type === 'object') {
            if (seen.has(obj)) {
                return '<span class="object-circular">[Circular Reference]</span>';
            }
            seen.add(obj);

            const keys = Object.keys(obj);
            if (keys.length === 0) return '<span class="object-value">{}</span>';

            const id = `obj_${Date.now()}_${Math.random()}`;
            let html = `<div class="object-inspector">`;
            html += `<span class="expandable" onclick="toggleExpand('${id}')">${obj.constructor.name || 'Object'}</span>`;
            html += `<div id="${id}" class="object-tree collapsed">`;

            keys.forEach(key => {
                html += `<div><span class="object-key">${key}:</span> ${createObjectInspector(obj[key], depth + 1, maxDepth, seen)}</div>`;
            });

            const prototype = Object.getPrototypeOf(obj);
            if (prototype && prototype !== Object.prototype) {
                html += createPrototypeSection(prototype, 0, new WeakSet());
            }

            html += `</div></div>`;
            return html;
        }

        return `<span class="object-value">${String(obj)}</span>`;
    }

    function createPrototypeSection(prototype, depth = 0, visitedProtos = new WeakSet()) {
        if (!prototype || prototype === Object.prototype || depth > 5) return '';

        const protoKey = prototype.constructor ? prototype.constructor.name : 'Unknown';
        if (visitedProtos.has(prototype)) {
            return `<div class="prototype-section">
                <div class="prototype-header">🔗 [[Prototype]]: ${protoKey} (circular reference)</div>
            </div>`;
        }
        visitedProtos.add(prototype);

        const id = `proto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let html = `<div class="prototype-section">`;
        html += `<div class="prototype-header expandable" onclick="toggleExpand('${id}')">`;
        html += `🔗 [[Prototype]]: ${protoKey}`;
        html += `</div>`;
        html += `<div id="${id}" class="prototype-content collapsed">`;

        try {
            const allKeys = Object.getOwnPropertyNames(prototype);
            const descriptors = Object.getOwnPropertyDescriptors(prototype);

            const sortedKeys = allKeys
                .filter(key => key !== 'constructor')
                .sort((a, b) => {
                    const aIsFunction = typeof descriptors[a]?.value === 'function';
                    const bIsFunction = typeof descriptors[b]?.value === 'function';
                    if (aIsFunction && !bIsFunction) return -1;
                    if (!aIsFunction && bIsFunction) return 1;
                    return a.localeCompare(b);
                });

            let methodCount = 0;
            let propertyCount = 0;

            sortedKeys.forEach(key => {
                const descriptor = descriptors[key];
                if (!descriptor) return;

                const isMethod = typeof descriptor.value === 'function';
                const isGetter = typeof descriptor.get === 'function';
                const isSetter = typeof descriptor.set === 'function';

                if (isMethod) {
                    methodCount++;
                    const params = getFunctionParams(descriptor.value);
                    html += `<div style="margin: 4px 0; padding: 4px 8px; background: rgba(0, 184, 148, 0.1); border-radius: 4px;">`;
                    html += `<span class="object-key">⚡ ${key}:</span> `;
                    html += `<span class="object-value">ƒ ${key}(${params})</span>`;
                    html += `</div>`;
                } else if (isGetter || isSetter) {
                    propertyCount++;
                    html += `<div style="margin: 4px 0; padding: 4px 8px; background: rgba(108, 92, 231, 0.1); border-radius: 4px;">`;
                    html += `<span class="object-key">🔧 ${key}:</span> `;
                    if (isGetter && isSetter) {
                        html += `<span class="object-value">[Getter/Setter]</span>`;
                    } else if (isGetter) {
                        html += `<span class="object-value">[Getter]</span>`;
                    } else {
                        html += `<span class="object-value">[Setter]</span>`;
                    }
                    html += `</div>`;
                } else {
                    propertyCount++;
                    html += `<div style="margin: 4px 0; padding: 4px 8px; background: rgba(255, 118, 117, 0.1); border-radius: 4px;">`;
                    html += `<span class="object-key">📦 ${key}:</span> `;
                    try {
                        html += createObjectInspector(descriptor.value, 0, 1, new WeakSet());
                    } catch (e) {
                        html += `<span class="object-value">[Cannot access]</span>`;
                    }
                    html += `</div>`;
                }
            });

            html += `<div style="margin-top: 10px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; font-size: 11px; color: #a0a0a0;">`;
            html += `📊 Summary: ${methodCount} methods, ${propertyCount} properties`;
            html += `</div>`;
        } catch (error) {
            html += `<div style="color: #ff6b6b; font-style: italic;">Error inspecting prototype: ${error.message}</div>`;
        }

        const parentProto = Object.getPrototypeOf(prototype);
        if (parentProto && parentProto !== Object.prototype && depth < 4) {
            html += createPrototypeSection(parentProto, depth + 1, visitedProtos);
        }

        html += `</div></div>`;
        return html;
    }

    function getFunctionParams(func) {
        const funcStr = func.toString();
        const match = funcStr.match(/\(([^)]*)\)/);
        return match ? match[1] : '';
    }

    window.toggleExpand = function(id) {
        const element = document.getElementById(id);
        const trigger = element.previousElementSibling;

        if (element.classList.contains('collapsed')) {
            element.classList.remove('collapsed');
            trigger.classList.add('expanded');
        } else {
            element.classList.add('collapsed');
            trigger.classList.remove('expanded');
        }
    };

    function addLogEntry(content, type = 'log') {
        logCount++;
        const timestamp = new Date().toLocaleTimeString();

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `
            <div class="log-timestamp">[${timestamp}] #${logCount}</div>
            <div>${content}</div>
        `;

        outputElement.appendChild(logEntry);
        outputElement.scrollTop = outputElement.scrollHeight;
    }

    function runCode() {
        const code = editor.getValue();
        if (!code) return;

        outputElement.innerHTML = "";
        logCount = 0;

        const originalConsole = { ...console };

        const seenObjects = new WeakSet();
        const MAX_OUTPUT_SIZE = 100000;
        let currentOutputSize = 0;

        function createObjectInspector(obj, depth = 0, maxDepth = 3, seen = new WeakSet()) {
            if (currentOutputSize > MAX_OUTPUT_SIZE) {
                return '<span class="object-error">[Output truncated: Too large]</span>';
            }

            if (depth > maxDepth) return '<span class="object-depth">...</span>';
            if (obj === null) return '<span class="object-null">null</span>';
            if (obj === undefined) return '<span class="object-undefined">undefined</span>';
            if (typeof obj !== 'object') {
                if (typeof obj === 'string') return `<span class="object-string">"${obj}"</span>`;
                if (typeof obj === 'number') return `<span class="object-number">${obj}</span>`;
                if (typeof obj === 'boolean') return `<span class="object-boolean">${obj}</span>`;
                return `<span class="object-value">${obj}</span>`;
            }

            if (seen.has(obj)) {
                return '<span class="object-circular">[Circular Reference]</span>';
            }
            seen.add(obj);

            let output = '<div class="object-inspector">';
            output += `<span class="object-type">[${obj.constructor?.name || 'Object'}]</span> {`;
            currentOutputSize += output.length;

            const props = Object.getOwnPropertyNames(obj);
            if (props.length > 0) {
                output += '<ul style="margin: 0; padding-left: 20px;">';
                for (const prop of props) {
                    let value;
                    try {
                        value = obj[prop];
                    } catch (e) {
                        value = `<span class="object-error">[Error: ${e.message}]</span>`;
                    }
                    const valueDisplay = typeof value === 'object' && value !== null
                        ? createObjectInspector(value, depth + 1, maxDepth, seen)
                        : createObjectInspector(value, depth + 1, maxDepth, seen);
                    output += `<li><span class="object-key">${prop}</span>: ${valueDisplay}</li>`;
                    currentOutputSize += valueDisplay.length;
                    if (currentOutputSize > MAX_OUTPUT_SIZE) {
                        output += '<li><span class="object-error">[Output truncated: Too large]</span></li>';
                        break;
                    }
                }
                output += '</ul>';
            }

            let proto = Object.getPrototypeOf(obj);
            if (proto && depth < maxDepth) {
                output += '<details style="margin-top: 8px; padding-left: 20px;">';
                output += `<summary><span class="object-proto">[[Prototype]]: [${proto.constructor?.name || 'Object'}]</span></summary>`;
                output += createObjectInspector(proto, depth + 1, maxDepth, new WeakSet());
                output += '</details>';
                currentOutputSize += output.length;
            }

            output += '}</div>';
            return output;
        }

        console.log = function(...args) {
            currentOutputSize = 0;
            let content = args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    return createObjectInspector(arg, 0, 3, new WeakSet());
                } else if (arg === undefined) {
                    return '<span class="object-undefined">undefined</span>';
                } else if (arg === null) {
                    return '<span class="object-null">null</span>';
                } else if (typeof arg === 'string') {
                    return `<span class="object-string">"${arg}"</span>`;
                } else if (typeof arg === 'number') {
                    return `<span class="object-number">${arg}</span>`;
                } else if (typeof arg === 'boolean') {
                    return `<span class="object-boolean">${arg}</span>`;
                } else {
                    return `<span class="object-value">${arg}</span>`;
                }
            }).join(' ');
            addLogEntry(content, 'log');
        };

        console.dir = function(obj) {
            currentOutputSize = 0;
            const content = createObjectInspector(obj, 0, 5, new WeakSet());
            addLogEntry(content, 'dir');
        };

        console.table = function(data, columns) {
            if (!data) return;
            currentOutputSize = 0;

            let output = '<table style="border-collapse: collapse; width: 100%; font-size: 12px;">';
            const isArray = Array.isArray(data);
            const rows = isArray ? data : [data];
            const keys = columns || (rows[0] ? Object.keys(rows[0]) : []);

            output += '<thead><tr>';
            if (isArray) output += '<th style="border: 1px solid #ccc; padding: 8px;">(index)</th>';
            for (const key of keys) {
                output += `<th style="border: 1px solid #ccc; padding: 8px;">${key}</th>`;
            }
            output += '</tr></thead>';

            output += '<tbody>';
            for (let i = 0; i < rows.length && currentOutputSize < MAX_OUTPUT_SIZE; i++) {
                const row = rows[i];
                output += '<tr>';
                if (isArray) output += `<td style="border: 1px solid #ccc; padding: 8px;">${i}</td>`;
                for (const key of keys) {
                    const value = row[key];
                    const display = typeof value === 'object' && value !== null
                        ? createObjectInspector(value, 0, 1, new WeakSet())
                        : createObjectInspector(value, 0, 1, new WeakSet());
                    output += `<td style="border: 1px solid #ccc; padding: 8px;">${display}</td>`;
                    currentOutputSize += display.length;
                    if (currentOutputSize > MAX_OUTPUT_SIZE) {
                        output += '<tr><td colspan="' + (keys.length + (isArray ? 1 : 0)) + 
                            '" style="border: 1px solid #ccc; padding: 8px;">[Output truncated: Too large]</td></tr>';
                        break;
                    }
                }
                output += '</tr>';
            }
            output += '</tbody></table>';

            addLogEntry(output, 'table');
        };

        console.error = function(...args) {
            currentOutputSize = 0;
            const content = args.map(arg => {
                if (arg instanceof Error) {
                    return `<strong>${arg.name}:</strong> ${arg.message}<br><pre style="margin-top: 8px; font-size: 11px; opacity: 0.8;">${arg.stack}</pre>`;
                }
                return String(arg);
            }).join(' ');
            addLogEntry(content, 'error');
        };

        console.warn = function(...args) {
            currentOutputSize = 0;
            const content = args.join(' ');
            addLogEntry(content, 'warn');
        };

        console.info = function(...args) {
            currentOutputSize = 0;
            const content = args.join(' ');
            addLogEntry(content, 'info');
        };

        window.onunhandledrejection = function(event) {
            console.error("Unhandled Promise Rejection:", event.reason);
        };

        try {
            const result = eval(code);

            if (result instanceof Promise) {
                result.catch(error => {
                    console.error(error);
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setTimeout(() => {
                console.log = originalConsole.log;
                console.error = originalConsole.error;
                console.warn = originalConsole.warn;
                console.info = originalConsole.info;
                console.dir = originalConsole.dir;
                console.table = originalConsole.table;
            }, 1000);
        }
    }

    window.clearOutput = function() {
        outputElement.innerHTML = "";
        logCount = 0;
    };

    function downloadCode() {
        const code = editor.getValue();
        if (!code) return;

        let timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
        let fileName = prompt("Enter the file name (including extension):", `advanced_js_${timestamp}.js`);

        if (fileName === null) return;
        if (!fileName.trim()) fileName = "code.js";

        const blob = new Blob([code], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function formatCode() {
        try {
            const code = editor.getValue();
            if (!code.trim()) return;

            if (typeof window.js_beautify === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.14.9/beautify.min.js';
                script.onload = function() {
                    applyFormatting(code);
                };
                document.head.appendChild(script);
            } else {
                applyFormatting(code);
            }
        } catch (error) {
            addLogEntry(`⚠️ Formatting error: ${error.message}`, 'error');
        }
    }

    function applyFormatting(code) {
        const beautifyFn = window.js_beautify || window.beautify;

        if (typeof beautifyFn === 'function') {
            const formattedCode = beautifyFn(code, {
                indent_size: 2,
                space_in_empty_paren: true,
                preserve_newlines: true,
                max_preserve_newlines: 2,
                wrap_line_length: 80,
                indent_with_tabs: false,
                end_with_newline: true,
                brace_style: "collapse,preserve-inline"
            });

            editor.setValue(formattedCode);
            addLogEntry('✅ Code formatted successfully!', 'info');
        } else {
            monaco.editor.getEditors()[0].getAction('editor.action.formatDocument').run();
            addLogEntry('✅ Code formatted using built-in formatter', 'info');
        }
    }

    document.getElementById("run").addEventListener("click", runCode);
    document.getElementById("download").addEventListener("click", downloadCode);
    document.getElementById("format").addEventListener("click", formatCode);

    document.getElementById("addfile").addEventListener("click", function() {
        document.getElementById("fileInput").click();
    });

    document.getElementById("fileInput").addEventListener("change", function(event) {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.js')) {
            const reader = new FileReader();
            const mergeChoice = confirm("Do you want to merge with the existing code?\n\n✅ OK: Merge\n❌ Cancel: Replace");

            reader.onload = function(e) {
                const editorValue = editor.getValue() || "";
                const newValue = mergeChoice ? `${editorValue}\n\n${e.target.result}` : e.target.result;
                editor.setValue(newValue);
            };
            reader.readAsText(file);
        } else {
            alert("Please select a valid JavaScript (.js) file.");
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
        if (e.altKey && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            formatCode();
        }
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES6,
        allowNonTsExtensions: true
    });

    monaco.languages.registerCompletionItemProvider("javascript", {
        provideCompletionItems: () => {
            return {
                suggestions: [
                    {
                        label: "log",
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: 'console.log($1);',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                    }
                ]
            };
        }
    });
});