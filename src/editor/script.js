import { EDITOR_CONFIGS } from "./languageConfig.js";

require.config({
    paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs"
    }
});
const roomId = getOrCreateRoomId();
let socket = null;
let isRemoteChange = false; // Flag to prevent infinite loops
let editor = null; // Global editor reference
let logCount = 0;
let changeTimer = null;
let saveTimer = null;
let language = 'Javascript'
let lastSentCode = '';
let debounceSendTimer = null;
function getOrCreateRoomId() {
    const params = new URLSearchParams(window.location.search);
    let roomId = params.get("room");

    if (!roomId) {
        roomId = generateRoomId();
        params.set("room", roomId);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, "", newUrl);
    }

    return roomId;
}

// Initialize Socket.IO connection
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
function getSocketUrl() {
    // const hostname = window.location.hostname;
    // const protocol = window.location.protocol;

    // // Development environments
    // if (hostname === "localhost" || 
    //     hostname === "127.0.0.1" || 
    //     hostname.includes("local")) {
    //     return "http://localhost:4000";
    // }

    // // Your Elastic Beanstalk environment (production)
    // if (hostname.includes("jseditor-env") || 
    //     hostname.includes("elasticbeanstalk")) {
    //     return "https://jseditor-env.eba-vmtwmwci.ap-south-1.elasticbeanstalk.com";
    // }

    // // Your production domain (adjust as needed)
    // if (hostname === "thejseditors.com" || 
    //     hostname === "www.thejseditors.com") {
    //     return "https://api.thejseditors.com"; // Or your production API endpoint
    // }

    // // Fallback: Use same protocol and port as current page
    // // If your frontend is on port 3000 and backend on 4000, this won't work in production
    // // Better to have an environment variable or config
    // const port = window.location.port;
    // const baseUrl = `${protocol}//${hostname}${port ? ':' + port : ''}`;

    // // Try to guess the API URL based on common patterns
    // if (port === "3000") {
    //     // React dev server typically on 3000, backend on 4000
    //     return "http://localhost:4000";
    // } else if (port === "5173") {
    //     // Vite dev server typically on 5173, backend on 4000
    //     return "http://localhost:4000";
    // } else if (!port || port === "80" || port === "443") {
    //     // Production - use same domain with API prefix
    //     return `${protocol}//${hostname}/api`;
    // }

    // Default fallback
    //return "http://localhost:4000";
    return "http://jseditor-env.eba-vmtwmwci.ap-south-1.elasticbeanstalk.com"
}
const socketUrl = getSocketUrl();
const isSecure = socketUrl.startsWith('https://');
async function initializeSocket() {

    if (socket) return;

    try {

        socket = await io(socketUrl, {
            // Conservative settings for maximum compatibility
            secure: true,
            transports: ['polling', 'websocket'],
            upgrade: true, // Don't attempt to upgrade to WebSocket
            forceNew: true, // Always create new connection
            timeout: 10000, // 10 second timeout
            pingTimeout: 30000,
            pingInterval: 15000,
            reconnection: true, // We'll handle reconnection manually
            reconnectionAttempts: 0,

            // Query parameters
            // query: {
            //     roomId: roomId,
            //     client: 'editor',

            //     timestamp: Date.now()
            // },

            // // Path (important!)
            // path: '/socket.io/',

            // Security
            withCredentials: false,
            rejectUnauthorized: false // Only for testi
        });


        socket.on("connect", () => {
            console.log("✅ Connected to server. Socket ID:", socket.id);
            socket.emit("join-room", { roomId });
            updateConnectionStatus(true);
            console.log("✅ Connected to the server. Collaborative editing is enabled!");
        });

        socket.on("connect_error", (error) => {

            updateConnectionStatus(false);
            addLogEntry(`Connection error: ${error}`, 'error');

            console.error("❌ Connection error:", error);
        });

        socket.on("disconnect", (reason) => {
            console.log("⚠️ Disconnected:", reason);
            updateConnectionStatus(false);
            addLogEntry(`Disconnected: ${reason}`, 'warn');
            console.log(`Disconnected from server: ${reason}`);
        });

        socket.on("reconnect", (attemptNumber) => {
            console.log("🔄 Reconnected after", attemptNumber, "attempts");
            socket.emit("join-room", { roomId });
            updateConnectionStatus(true);
            console.log(`🔄 Reconnected to the server after ${attemptNumber} attempt(s).`);
        });

        // Initialize with existing code
        socket.on("init-code", (code) => {
            console.log("📥 Received init-code:", code ? "Code received" : "Empty");
            if (editor && typeof editor.setValue === "function") {
                const current = editor.getValue();

                isRemoteChange = true;
                const pos = editor.getPosition();
                editor.setValue(code.code || '');
                if (pos) editor.setPosition(pos);
                setTimeout(() => { isRemoteChange = false; }, 100);
                console.log("Received the initial code from server.");

            }
        });

        // Handle code updates from other users
        socket.on("code-update", (data) => {
            const { code, updatedBy } = data;

            // Critical: Skip updates from ourselves
            if (updatedBy === socket.id) {
                console.log('🔄 Ignoring self-update');
                return;
            }

            console.log(`📥 Update from ${updatedBy}, length: ${code.length}`);

            const currentCode = editor.getValue();

            // Only update if different
            if (currentCode !== code) {
                // Save current state
                const cursorState = editor.saveViewState();

                // Apply update
                isRemoteChange = true;
                editor.setValue(code);
                isRemoteChange = false;

                // Restore cursor if possible
                if (cursorState) {
                    setTimeout(() => {
                        editor.restoreViewState(cursorState);
                    }, 10);
                }

                // Update tracking
                lastSentCode = code;

                // Auto-save this remote update
                saveCodeToStorage();
            }
        });

        // Handle connection/disconnection
        socket.on("user-joined", (data) => {
            addLogEntry(`👤 User ${data.socketId} joined the room`);
        });

        socket.on("user-left", (data) => {
            addLogEntry(`👤 User ${data.socketId} left the room`);
        });

        // Optional: Add typing indicator
        let typingTimer = null;
        editor.onDidChangeModelContent(() => {
            if (isRemoteChange) return;

            // Send typing start
            socket.emit("typing-start", { roomId });

            // Clear previous timer
            if (typingTimer) clearTimeout(typingTimer);

            // Send typing end after 1 second of inactivity
            typingTimer = setTimeout(() => {
                socket.emit("typing-end", { roomId });
            }, 1000);
        });

        socket.on("user-typing", (data) => {
            // Show typing indicator for other users
            if (data.socketId !== socket.id) {
                addLogEntry(`✍️ User ${data.socketId} is typing...`);
                // Update UI to show typing indicator
            }
        });

        return socket

    } catch (error) {
        console.error("Socket initialization error:", error);
        addLogEntry(`Socket error: ${error.message}`, 'error');
        //alert(`Socket error: ${error.message}`);
    }
}

function addLogEntry(content, type = 'log') {
    const outputElement = document.getElementById("output");
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
function saveCodeToStorage() {
    const code = editor.getValue();

    try {
        console.log(code)
        localStorage.setItem(String(language), code);

        const saveIndicator = document.getElementById('saveIndicator') || createSaveIndicator();
        saveIndicator.style.opacity = '1';
        setTimeout(() => {
            saveIndicator.style.opacity = '0';
        }, 1000);
    } catch (e) {
        console.error('Failed to save code to localStorage:', e);
    }
}

function updateConnectionStatus(isConnected) {
    let statusElement = document.getElementById('connectionStatus');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'connectionStatus';
        statusElement.style.position = 'fixed';
        statusElement.style.bottom = '10px';
        statusElement.style.left = '10px';
        statusElement.style.padding = '5px 10px';
        statusElement.style.borderRadius = '4px';
        statusElement.style.fontSize = '12px';
        statusElement.style.zIndex = '1000';
        statusElement.style.fontFamily = 'monospace';
        document.body.appendChild(statusElement);
    }

    if (isConnected) {
        statusElement.textContent = `🟢 Connected (Room: ${roomId})`;
        statusElement.style.background = 'rgba(0, 184, 148, 0.9)';
        statusElement.style.color = 'white';
        statusElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    } else {
        statusElement.textContent = '🔴 Disconnected';
        statusElement.style.background = 'rgba(214, 48, 49, 0.9)';
        statusElement.style.color = 'white';
        statusElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    }
}
// Simple random ID generator
function generateRoomId(length = 6) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < length; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}



require(["vs/editor/editor.main"], async function () {
    const savedCode = await localStorage.getItem(String(language));

    const initialCode = savedCode || `console.log("Developed By sunil...")`;

    editor = monaco.editor.create(document.getElementById("editor"), getEditorConfig(language, initialCode));

    const outputElement = document.getElementById("output");

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

    rowLayoutBtn.addEventListener('click', function () {
        container.classList.remove('column-layout');
        rowLayoutBtn.classList.add('active');
        columnLayoutBtn.classList.remove('active');
        localStorage.setItem('editorLayout', 'row');
        setTimeout(() => editor.layout(), 100);
    });

    columnLayoutBtn.addEventListener('click', function () {
        container.classList.add('column-layout');
        rowLayoutBtn.classList.remove('active');
        columnLayoutBtn.classList.add('active');
        localStorage.setItem('editorLayout', 'column');
        setTimeout(() => editor.layout(), 100);
    });



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

            const code = editor.getValue()
            switch (language) {
                case "javascript":

                    runCode(code)
                    break;

                case "typescript":
                    runTypeScript(code);
                    break;

                case "html":
                    runHTML(code);
                    break;

                case "css":
                    runCSS(code);
                    break;

                case "json":
                    runJSON(code);
                    break;

                default:
                    console.warn(`No runner defined for ${language}`);
            }

        } finally {
            clearTimeout(executionTimer);
            const executionTime = Date.now() - startTime;

            if (executionTime > 1000) {
                addLogEntry(`⏱️ Execution time: ${executionTime}ms`, 'info');
            }
        }
    }
    function getEditorConfig(langKey, value = "") {
        const lang = langKey.toLowerCase();
    
        const config = {
            value: value,
            ...(EDITOR_CONFIGS[lang])
        };
        console.log("--------    ", value)
    
        console.log("Editor config:", config); // ✅ correct debug
        return config;
    }
    
    function switchLanguage(langKey) {
        const lang = langKey.toLowerCase();
        const config = EDITOR_CONFIGS[lang];
    
        if (!config) return;
        clearOutput()
    
        // editor.setModelLanguage(
        //     editor.getModel(),
        //     config.language
        // );
    
        const savedCode = localStorage.getItem(String(lang));
         editor.setValue(savedCode)
        getEditorConfig(lang, savedCode)
    }
    
    function stripTypeScript(code) {
        let js = code;
        
        // 1. Save strings first to avoid removing content inside strings
        const stringStore = [];
        let stringIndex = 0;
        js = js.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, (match) => {
            const placeholder = `__STRING_${stringIndex++}__`;
            stringStore.push(match);
            return placeholder;
        });
        
        // 2. Save template literal expressions
        const templateStore = [];
        let templateIndex = 0;
        js = js.replace(/\${([^}]+)}/g, (match, expr) => {
            const placeholder = `__TEMPLATE_${templateIndex++}__`;
            templateStore.push(expr);
            return placeholder;
        });
        
        // 3. Save ternary operators to avoid breaking them
        const ternaryStore = [];
        let ternaryIndex = 0;
        js = js.replace(/\?[^:]*:[^;]+/g, (match) => {
            const placeholder = `__TERNARY_${ternaryIndex++}__`;
            ternaryStore.push(match);
            return placeholder;
        });
        
        // 4. Remove type-only imports
        js = js.replace(/import\s+type\s*{[^}]*}\s*from\s*['"][^'"]+['"]\s*;?\s*/g, '');
        js = js.replace(/import\s+type\s+[^;]+;/g, '');
        js = js.replace(/export\s+type\s+[^;]+;/g, '');
        
        // 5. Remove interface declarations
        js = js.replace(/interface\s+\w+(?:\s*<[^>]*>)?(?:\s+extends\s+[^{]*)?\s*\{[^}]*\}/g, '');
        
        // 6. Remove type aliases
        js = js.replace(/type\s+\w+(?:\s*<[^>]*>)?\s*=\s*[^;]+;/g, '');
        
        // 7. Remove enum declarations (convert to objects later if needed)
        js = js.replace(/enum\s+\w+\s*\{[^}]*\}/g, '');
        
        // 8. Remove namespace declarations
        js = js.replace(/namespace\s+\w+\s*\{[^}]*\}/g, '');
        
        // 9. Remove declare statements
        js = js.replace(/\bdeclare\s+.*?(?:;|\{)/g, '');
        
        // 10. Remove access modifiers
        js = js.replace(/\b(public|private|protected|readonly|abstract)\s+/g, '');
        
        // 11. Remove 'implements' clauses
        js = js.replace(/\s+implements\s+[^{]+(?=\{)/g, '');
        
        // 12. Remove type assertions - more careful approach
        js = js.replace(/\s+as\s+(?:const\b|[\w$]+(?:\s*<[^>]*>)?)(?=\s*[;,\)\]\}\s]|\n|$)/g, '');
        
        // 13. Remove parameter types
        js = js.replace(/([\(\,]\s*)([\w$]+)\s*\??\s*:\s*[^,\)]+/g, '$1$2');
        
        // 14. Remove variable type annotations (with assignment)
        js = js.replace(/(const|let|var)\s+([\w$]+)\s*\??\s*:\s*[^=;]+(?=\s*=)/g, '$1 $2');
        
        // 15. Remove variable type annotations (without assignment)
        js = js.replace(/(const|let|var)\s+([\w$]+)\s*\??\s*:\s*[^=;]+;/g, '$1 $2;');
        
        // 16. Remove return types from functions
        js = js.replace(/\)\s*:\s*[^{=>]+(?=\s*\{)/g, ')');
        js = js.replace(/\)\s*:\s*[^{=>]+(?=\s*=>)/g, ')');
        
        // 17. Remove property type annotations in classes
        js = js.replace(/([\w$]+)\s*\??\s*:\s*[^;=]+(?=\s*[;=])/g, (match, p1) => {
            return p1;
        });
        
        // 18. Remove generics from function and class declarations
        js = js.replace(/(function|class)\s+(\w+)\s*<[^>]*>/g, '$1 $2');
        
        // 19. Remove generic constraints
        js = js.replace(/<\w+\s+extends\s+[^>]+>/g, '');
        
        // 20. Remove generic arguments from calls (carefully)
        js = js.replace(/\.\s*<[^>]*>/g, '.');
        js = js.replace(/(\w+)\s*<[^>]*>(\s*\()/g, '$1$2');
        
        // 21. Remove non-null assertions (!)
        js = js.replace(/([\w$\)\]])(?<![!=])!\s*(?![=])/g, '$1');
        
        // 22. Remove optional parameter markers (?) while keeping the parameter
        js = js.replace(/([\w$]+)\s*\?\s*:/g, '$1:');
        
        // 23. Remove index signatures
        js = js.replace(/\[[\w$]+\s*:\s*(string|number)\]\s*:\s*[^;]+;/g, '');
        
        // 24. Clean up empty lines and extra spaces
        js = js.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('//'))
            .join('\n');
        
        // 25. Restore ternary operators FIRST
        ternaryStore.forEach((ternary, index) => {
            js = js.replace(`__TERNARY_${index}__`, ternary);
        });
        
        // 26. Restore strings
        stringStore.forEach((str, index) => {
            js = js.replace(`__STRING_${index}__`, str);
        });
        
        // 27. Restore template expressions
        templateStore.forEach((expr, index) => {
            js = js.replace(`__TEMPLATE_${index}__`, `\${${expr}}`);
        });
        
        // 28. Clean up syntax
        js = js.replace(/\s+/g, ' ');
        js = js.replace(/\s*([{},;()])\s*/g, '$1');
        js = js.replace(/;{2,}/g, ';');
        js = js.replace(/\{\s*\}/g, '{}');
        
        // 29. Fix broken ternary operators
        js = js.replace(/(\?[^:]*):\s*([^;]+)(?=;)/g, (match, condition, truePart) => {
            // Check if it has a false part
            if (!match.includes(':')) {
                return `${condition} : ""`;
            }
            return match;
        });
        
        return js.trim();
    }
    
    // Alternative: Simpler but safer approach
    function stripTypeScriptSimple(code) {
        let js = code;
        
        // Preserve strings and template literals
        const stringMap = new Map();
        let stringId = 0;
        
        // Store all strings and template literals
        js = js.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, (match) => {
            const id = `__STR_${stringId++}__`;
            stringMap.set(id, match);
            return id;
        });
        
        js = js.replace(/\${[^}]+}/g, (match) => {
            const id = `__TMPL_${stringId++}__`;
            stringMap.set(id, match);
            return id;
        });
        
        // Store ternary operators
        const ternaryMap = new Map();
        js = js.replace(/\?[^:]*:[^;\)\}]+/g, (match) => {
            const id = `__TERN_${stringId++}__`;
            ternaryMap.set(id, match);
            return id;
        });
        
        // Multi-step removal with precise patterns
        const patterns = [
            // Remove interface declarations FIRST
            [/interface\s+\w+\s*\{[^}]*\}/g, ''],
            
            // Remove type aliases
            [/type\s+\w+\s*=\s*[^;]+;/g, ''],
            
            // Remove enums - but we need to handle them differently
            [/enum\s+\w+\s*\{[^}]*\}/g, ''],
            
            // Remove namespaces
            [/namespace\s+\w+\s*\{[^}]*\}/g, ''],
            
            // Remove type-only imports
            [/import\s+type\s+[^;]+;/g, ''],
            [/export\s+type\s+[^;]+;/g, ''],
            
            // Remove 'as' type assertions
            [/\s+as\s+\w+(?:\s*<[^>]*>)?/g, ''],
            
            // Remove generic type parameters from declarations
            [/(function|class)\s+\w+\s*<[^>]*>/g, (match, p1) => p1],
            
            // Remove return type annotations
            [/\)\s*:\s*[^{]+(?=\{)/g, ')'],
            [/\)\s*:\s*[^{]+(?=\s*=>)/g, ')'],
            
            // Remove parameter type annotations
            [/([\(\,]\s*)(\w+)\s*\??\s*:\s*[^,\)]+/g, '$1$2'],
            
            // Remove variable type annotations (with assignment)
            [/(const|let|var)\s+(\w+)\s*\??\s*:\s*[^=]+(?=\s*=)/g, '$1 $2'],
            
            // Remove variable type annotations (without assignment)
            [/(const|let|var)\s+(\w+)\s*\??\s*:\s*[^;]+;/g, '$1 $2;'],
            
            // Remove property type annotations in classes and objects
            [/(\w+)\s*\??\s*:\s*(?!(?:function|\{|\())[\w$<>\s\[\]\|&]+(?=\s*[;=,])/g, '$1'],
            
            // Remove access modifiers
            [/\b(public|private|protected|readonly|abstract)\s+/g, ''],
            
            // Remove optional parameter '?'
            [/(\w+)\s*\?\s*:/g, '$1:'],
            
            // Remove non-null assertions
            [/(\w+)\s*!\s*(?![=])/g, '$1'],
            
            // Remove 'implements' clauses
            [/\s+implements\s+[^{]+/g, ''],
            
            // Remove declare statements
            [/\bdeclare\s+.*?(?:;|\{)/g, ''],
        ];
        
        // Apply patterns in order
        patterns.forEach(([pattern, replacement]) => {
            js = js.replace(pattern, replacement);
        });
        
        // Restore ternary operators FIRST
        ternaryMap.forEach((value, key) => {
            js = js.replace(key, value);
        });
        
        // Restore strings
        stringMap.forEach((value, key) => {
            js = js.replace(key, value);
        });
        
        // Clean up
        js = js.replace(/\s+/g, ' ').trim();
        js = js.replace(/;\s*;/g, ';');
        js = js.replace(/\{\s*\}/g, '{}');
        
        // Fix common syntax issues
        js = js.replace(/(\?[^:]*):\s*([^;]+);/g, (match, condition, truePart) => {
            // If there's no second colon, add empty false part
            const parts = match.split(':');
            if (parts.length === 2) {
                return match + ' : ""';
            }
            return match;
        });
        
        return js;
    }
    
    function runTypeScript(code) {
        const outputElement = document.getElementById('output');
        const tsCode = code;
        const logs = [];
        const originalLog = console.log;
        
        console.log = (...args) => {
            logs.push(args.map(arg => String(arg)).join(' '));
        };
        
        try {
            // First try the simple transpiler
            let jsCode = stripTypeScriptSimple(tsCode);
            
            // Post-process to fix common issues
            jsCode = postProcessJavaScript(jsCode);
            
            // Validate the generated JavaScript
            try {
                new Function(jsCode);
            } catch (error) {
                console.warn('Simple transpiler failed, trying advanced...');
                jsCode = stripTypeScript(tsCode);
                jsCode = postProcessJavaScript(jsCode);
            }
            
            // Final validation
            try {
                new Function(jsCode);
            } catch (error) {
                // Try to fix the specific error
                if (error.message.includes("Unexpected token ';'")) {
                    jsCode = fixTernaryOperators(jsCode);
                    jsCode = fixMissingParentheses(jsCode);
                }
                
                // Try one more time
                try {
                    new Function(jsCode);
                } catch (finalError) {
                    throw new Error(`Generated invalid JavaScript: ${finalError.message}\n\nGenerated code:\n${jsCode}`);
                }
            }
            
            console.log('Transpiled JavaScript:', jsCode);
            
            // Execute the code
            runCode(jsCode);
            
        } catch (error) {
            console.log = originalLog;
            outputElement.style.color = "red";
            outputElement.textContent = `❌ TypeScript Error:\n${error.message || error}`;
            console.error('TypeScript transpilation error:', error);
        } finally {
            console.log = originalLog;
        }
    }
    
    // Helper function to post-process JavaScript
    function postProcessJavaScript(jsCode) {
        let result = jsCode;
        
        // Fix broken ternary operators
        result = result.replace(/(console\.log\("[^"]*")\s*,\s*([^?]+\?[^:]+);/g, (match, logPart, ternaryPart) => {
            // Check if ternary has both parts
            if (!ternaryPart.includes(':')) {
                return `${logPart}, ${ternaryPart} : "");`;
            }
            return match;
        });
        
        // Fix missing closing parentheses
        result = result.replace(/console\.log\([^)]+$/g, (match) => {
            if (!match.endsWith(')')) {
                return match + ')';
            }
            return match;
        });
        
        // Fix semicolon issues
        result = result.replace(/;\s*console/g, ';\nconsole');
        result = result.replace(/\)\s*;/g, ');');
        
        return result;
    }
    
    // Fix specific ternary operator issues
    function fixTernaryOperators(jsCode) {
        let result = jsCode;
        
        // Look for broken ternary patterns
        const brokenTernaryPattern = /(\?[^:]*):\s*([^;]+);/g;
        let match;
        while ((match = brokenTernaryPattern.exec(result)) !== null) {
            const fullMatch = match[0];
            const beforeColon = match[1];
            const afterColon = match[2];
            
            // Check if it's actually a complete ternary
            const questionMarks = (beforeColon.match(/\?/g) || []).length;
            const colons = (fullMatch.match(/:/g) || []).length;
            
            // If we have more question marks than colons, it's broken
            if (questionMarks > colons) {
                // Find where to add the missing colon
                const parts = afterColon.split(' ');
                let fixedAfter = '';
                for (let i = 0; i < parts.length; i++) {
                    if (parts[i].includes('?')) {
                        // Found another ternary inside, need to close this one
                        fixedAfter = parts.slice(0, i).join(' ') + ' : "" ' + parts.slice(i).join(' ');
                        break;
                    }
                }
                if (!fixedAfter) {
                    fixedAfter = afterColon + ' : ""';
                }
                
                result = result.replace(fullMatch, `?${beforeColon}: ${fixedAfter};`);
            }
        }
        
        return result;
    }
    
    // Fix missing parentheses
    function fixMissingParentheses(jsCode) {
        let result = jsCode;
        
        // Count parentheses
        let openParens = 0;
        let closeParens = 0;
        
        for (let i = 0; i < result.length; i++) {
            if (result[i] === '(') openParens++;
            if (result[i] === ')') closeParens++;
        }
        
        // Add missing closing parentheses
        if (openParens > closeParens) {
            const missing = openParens - closeParens;
            result += ')'.repeat(missing);
        }
        
        return result;
    }
    
    // Test with your example
    // const testCode = `// Interface
    // interface User {
    //   id: number;
    //   name: string;
    //   email?: string; // optional
    // }
    
    // // Enum
    // enum Status {
    //   Active = 1,
    //   Inactive = 2
    // }
    
    // // Usage
    // const user: User = { id: 1, name: "John" };
    // console.log(user);
    // console.log(Status.Active);`;
    
    // console.log('Testing TypeScript transpilation...');
    // console.log('Input TypeScript:', testCode);
    // console.log('Output JavaScript:', stripTypeScriptSimple(testCode));
    
    // function createAutoExecuteToggle() {
    //     const controlsDiv = document.getElementById('controls').querySelector('div');
    //     const toggleBtn = document.createElement('button');
    //     toggleBtn.id = 'autoExecute';
    //     toggleBtn.innerHTML = '🔄 Auto-Execute: ON';
    //     toggleBtn.style.background = 'linear-gradient(135deg, #00b894, #20bf6b)';
    //     toggleBtn.style.color = 'white';

    //     toggleBtn.addEventListener('click', function () {
    //         autoExecuteEnabled = !autoExecuteEnabled;
    //         if (autoExecuteEnabled) {
    //             this.innerHTML = '🔄 Auto-Execute: ON';
    //             this.style.background = 'linear-gradient(135deg, #00b894, #20bf6b)';
    //             addLogEntry('✅ Auto-execution enabled', 'info');
    //             safeAutoExecute();
    //         } else {
    //             this.innerHTML = '⏸️ Auto-Execute: OFF';
    //             this.style.background = 'linear-gradient(135deg, #ff7675, #d63031)';
    //             if (autoExecuteTimer) {
    //                 clearTimeout(autoExecuteTimer);
    //             }
    //             addLogEntry('⏸️ Auto-execution disabled', 'warn');
    //         }
    //     });

    //     controlsDiv.appendChild(toggleBtn);
    // }

    // createAutoExecuteToggle();



    editor.onDidChangeModelContent((event) => {
        // Skip if this is a remote change
        if (isRemoteChange) return;

        const code = editor.getValue();

        // Debounce the socket emission to prevent flooding
        if (debounceSendTimer) {
            clearTimeout(debounceSendTimer);
        }

        debounceSendTimer = setTimeout(() => {
            // Only send if code actually changed
            if (code !== lastSentCode) {
                try {
                    socket.emit("code-change", {
                        roomId,
                        code,
                        timestamp: Date.now(),
                        senderId: socket.id // Include sender ID for filtering
                    });
                    lastSentCode = code;
                    console.log('📤 Sent code update');
                } catch (e) {
                    console.error("Error emitting code-change:", e);
                }
            }
        }, 150); // 150ms debounce for socket sends

        // Auto-save with separate debounce
        if (saveTimer) {
            clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(() => {
            saveCodeToStorage();
            console.log('💾 Auto-saved to local storage');
        }, 1000);

        // Auto-execute with separate debounce
        if (autoExecuteEnabled && code.trim()) {
            if (changeTimer) {
                clearTimeout(changeTimer);
            }
            changeTimer = setTimeout(() => {
                safeAutoExecute();
                console.log('⚡ Auto-executed');
            }, 800);
        }
    });


    function createObjectInspector(obj, depth = 0, maxDepth = 4, seen = new WeakSet()) {
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

    window.toggleExpand = function (id) {
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



    function runCode(code) {



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

        console.log = function (...args) {
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

        console.dir = function (obj) {
            currentOutputSize = 0;
            const content = createObjectInspector(obj, 0, 5, new WeakSet());
            addLogEntry(content, 'dir');
        };

        console.table = function (data, columns) {
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

        console.error = function (...args) {
            currentOutputSize = 0;
            const content = args.map(arg => {
                if (arg instanceof Error) {
                    return `<strong>${arg.name}:</strong> ${arg.message}<br><pre style="margin-top: 8px; font-size: 11px; opacity: 0.8;">${arg.stack}</pre>`;
                }
                return String(arg);
            }).join(' ');
            addLogEntry(content, 'error');
        };

        console.warn = function (...args) {
            currentOutputSize = 0;
            const content = args.join(' ');
            addLogEntry(content, 'warn');
        };

        console.info = function (...args) {
            currentOutputSize = 0;
            const content = args.join(' ');
            addLogEntry(content, 'info');
        };

        window.onunhandledrejection = function (event) {
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

    window.clearOutput = function () {
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
                script.onload = function () {
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

    document.getElementById("run").addEventListener("click", () => {
        const code = editor.getValue()
        switch (language) {
            case "javascript":
                // 
                // alert(code)
                runCode(code)
                break;

            case "typescript":

                runTypeScript(code);
                break;

            case "html":
                runHTML(code);
                break;

            case "css":
                runCSS(code);
                break;

            case "json":
                runJSON(code);
                break;

            default:
                console.warn(`No runner defined for ${language}`);
        }
    });
    document.getElementById("download").addEventListener("click", downloadCode);
    document.getElementById("format").addEventListener("click", formatCode);

    const languagePanel = document.querySelector(".language-panel");
    const languageList = document.getElementById("languageList");


    document.getElementById("addfile").addEventListener("click", function () {
        document.getElementById("fileInput").click();
    });

    document.getElementById("fileInput").addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.js')) {
            const reader = new FileReader();
            const mergeChoice = confirm("Do you want to merge with the existing code?\n\n✅ OK: Merge\n❌ Cancel: Replace");

            reader.onload = function (e) {
                const editorValue = editor.getValue() || "";
                const newValue = mergeChoice ? `${editorValue}\n\n${e.target.result}` : e.target.result;
                editor.setValue(newValue);
            };
            reader.readAsText(file);
        } else {
            alert("Please select a valid JavaScript (.js) file.");
        }
    });

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

        // Switch Monaco language
        switchLanguage(langKey);
    });


    const toggle = document.getElementById("autoExecuteToggle");
    const label = document.getElementById("autoExecuteLabel");

    toggle.addEventListener("change", function () {
        autoExecuteEnabled = this.checked;

        if (autoExecuteEnabled) {
            label.textContent = "Auto-Execute: ON";
            addLogEntry("✅ Auto-execution enabled", "info");
            safeAutoExecute();
        } else {
            label.textContent = "Auto-Execute: OFF";

            if (autoExecuteTimer) {
                clearTimeout(autoExecuteTimer);
            }

            addLogEntry("⏸️ Auto-execution disabled", "warn");
        }
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES6,
        allowNonTsExtensions: true
    });
    function addDebugButton() {
        const debugBtn = document.createElement('button');
        debugBtn.textContent = '🔧 Debug Socket';
        debugBtn.style.marginLeft = '10px';
        debugBtn.style.padding = '8px 12px';
        debugBtn.style.background = 'linear-gradient(135deg, #6c5ce7, #a29bfe)';
        debugBtn.style.color = 'white';
        debugBtn.style.border = 'none';
        debugBtn.style.borderRadius = '4px';
        debugBtn.style.cursor = 'pointer';

        debugBtn.addEventListener('click', () => {
            debugSocketConnection();
            if (socket) {
                const status = {
                    connected: socket.connected,
                    id: socket.id,
                    roomId: roomId,
                    listeners: socket._callbacks
                };
                console.log('Socket debug info:', status);

                addLogEntry(`Socket: ${socket.connected ? 'Connected' : 'Disconnected'}`,
                    socket.connected ? 'info' : 'error');
                addLogEntry(`Room: ${roomId}`, 'info');

                if (socket.connected) {
                    // Test emit
                    socket.emit("test", {
                        message: "Debug test",
                        timestamp: Date.now(),
                        roomId: roomId
                    });
                }
            } else {
                addLogEntry('Socket not initialized', 'error');
            }
        });

        const controlsDiv = document.getElementById('controls').querySelector('div');
        controlsDiv.appendChild(debugBtn);
    }

    function debugSocketConnection() {
        console.log('=== Socket.IO Debug Info ===');
        console.log('Page URL:', window.location.href);
        console.log('Protocol:', window.location.protocol);
        console.log('Socket.IO loaded:', typeof io !== 'undefined');

        // Test WebSocket support
        console.log('WebSocket supported:', 'WebSocket' in window);

        // Test connection to your server
        const testWs = new WebSocket('wss://jseditor-env.eba-vmtwmwci.ap-south-1.elasticbeanstalk.com');

        testWs.onopen = () => {
            console.log('✅ Raw WebSocket connection successful');
            testWs.close();
        };

        testWs.onerror = (error) => {
            console.log('❌ Raw WebSocket connection failed');
            console.log('Error:', error);
        };
    }


    addDebugButton()
    // Add copy room URL button
    function addCopyRoomButton() {
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Share Editor';
        copyBtn.style.marginLeft = '10px';
        copyBtn.style.padding = '8px 12px';
        copyBtn.style.background = 'linear-gradient(135deg, #fd79a8, #e84393)';
        copyBtn.style.color = 'white';
        copyBtn.style.border = 'none';
        copyBtn.style.borderRadius = '4px';
        copyBtn.style.cursor = 'pointer';

        copyBtn.addEventListener('click', () => {
            initializeSocket().then((response) => {

                if (response) {
                    const url = window.location.href;
                    navigator.clipboard.writeText(url).then(() => {
                        addLogEntry(`Room URL copied to clipboard: ${url}`, 'info');
                    }).catch(err => {
                        addLogEntry(`Failed to copy URL: ${err}`, 'error');
                    });
                }
            }).catch(err => {
                addLogEntry(`Failed to copy URL: ${err}`, 'error');
                alert(`Failed to copy URL: ${err}`);
            });
        });

        const controlsDiv = document.getElementById('controls').querySelector('div');
        controlsDiv.appendChild(copyBtn);
    }

    addCopyRoomButton();

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