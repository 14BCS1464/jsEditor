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

const FONT_MIN = 8;
const FONT_MAX = 32;
const FONT_STEP = 1;

// --- Multi-tab state (top-level so it's visible to saveCodeToStorage() too) ---
let tabs = [];          // { id, name, model, viewState }
let activeTabId = null;
let tabCounter = 0;
const TABS_STORAGE_KEY = 'jsEditorTabs';

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
    return "http://jseditor-env.eba-vmtwmwci.ap-south-1.elasticbeanstalk.com"
}
const socketUrl = getSocketUrl();
const isSecure = socketUrl.startsWith('https://');
async function initializeSocket() {

    if (socket) return;

    try {

        socket = await io(socketUrl, {
            secure: true,
            transports: ['polling', 'websocket'],
            upgrade: true,
            forceNew: true,
            timeout: 10000,
            pingTimeout: 30000,
            pingInterval: 15000,
            reconnection: true,
            reconnectionAttempts: 0,
            withCredentials: false,
            rejectUnauthorized: false
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

            if (updatedBy === socket.id) {
                console.log('🔄 Ignoring self-update');
                return;
            }

            console.log(`📥 Update from ${updatedBy}, length: ${code.length}`);

            const currentCode = editor.getValue();

            if (currentCode !== code) {
                const cursorState = editor.saveViewState();

                isRemoteChange = true;
                editor.setValue(code);
                isRemoteChange = false;

                if (cursorState) {
                    setTimeout(() => {
                        editor.restoreViewState(cursorState);
                    }, 10);
                }

                lastSentCode = code;
                saveCodeToStorage();
            }
        });

        socket.on("user-joined", (data) => {
            console.log(`👤 User ${data.socketId} joined the room`);
        });

        socket.on("user-left", (data) => {
            console.log(`👤 User ${data.socketId} left the room`);
        });

        let typingTimer = null;
        editor.onDidChangeModelContent(() => {
            if (isRemoteChange) return;

            socket.emit("typing-start", { roomId });

            if (typingTimer) clearTimeout(typingTimer);

            typingTimer = setTimeout(() => {
                socket.emit("typing-end", { roomId });
            }, 1000);
        });

        socket.on("user-typing", (data) => {
            if (data.socketId !== socket.id) {
                console.log(`✍️ User ${data.socketId} is typing...`);
            }
        });

    } catch (error) {
        console.error("Socket initialization error:", error);
        addLogEntry(`Socket error: ${error.message}`, 'error');
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
    persistTabs(); // saves all open tabs' latest content
    const code = editor.getValue();

    try {
        localStorage.setItem('jsEditorCode', code); // legacy key, kept for backward compatibility
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

function generateRoomId(length = 6) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < length; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

// --- Multi-tab functions (top-level) ---

function createTab(name, content = '') {
    tabCounter++;
    const id = `tab_${Date.now()}_${tabCounter}`;
    const model = monaco.editor.createModel(content, 'javascript');

    const tab = { id, name, model, viewState: null };
    tabs.push(tab);
    return tab;
}

function renderTabs() {
    const tabList = document.getElementById('tabList');
    if (!tabList) return; // guard in case the tab bar HTML hasn't been added yet
    tabList.innerHTML = '';

    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
        el.dataset.tabId = tab.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'tab-name';
        nameSpan.textContent = tab.name;
        nameSpan.title = tab.name;
        nameSpan.addEventListener('dblclick', () => renameTab(tab.id));

        const closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(tab.id);
        });

        el.appendChild(nameSpan);
        el.appendChild(closeBtn);
        el.addEventListener('click', () => switchToTab(tab.id));

        tabList.appendChild(el);
    });
}

function switchToTab(id) {
    if (id === activeTabId) return;

    if (activeTabId) {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) currentTab.viewState = editor.saveViewState();
    }

    const nextTab = tabs.find(t => t.id === id);
    if (!nextTab) return;

    activeTabId = id;
    isRemoteChange = true; // avoid triggering socket/save logic during the swap
    editor.setModel(nextTab.model);
    if (nextTab.viewState) editor.restoreViewState(nextTab.viewState);
    isRemoteChange = false;

    editor.focus();
    renderTabs();
    persistTabs();
}

function addNewTab() {
    const name = `untitled-${tabs.length + 1}.js`;
    const tab = createTab(name, '');
    switchToTab(tab.id);
    persistTabs();
}

function closeTab(id) {
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    if (tabs.length === 1) {
        addLogEntry('⚠️ Cannot close the last tab', 'warn');
        return;
    }

    const wasActive = id === activeTabId;
    tabs[index].model.dispose();
    tabs.splice(index, 1);

    if (wasActive) {
        const fallback = tabs[Math.max(0, index - 1)];
        activeTabId = null; // force switchToTab to actually run
        switchToTab(fallback.id);
    } else {
        renderTabs();
    }

    persistTabs();
}

function renameTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    const newName = prompt('Rename file:', tab.name);
    if (newName && newName.trim()) {
        tab.name = newName.trim();
        renderTabs();
        persistTabs();
    }
}

function persistTabs() {
    try {
        const data = tabs.map(t => ({
            id: t.id,
            name: t.name,
            content: t.model.getValue()
        }));
        localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ tabs: data, activeTabId }));
    } catch (e) {
        console.error('Failed to persist tabs:', e);
    }
}

function loadTabs() {
    try {
        const raw = localStorage.getItem(TABS_STORAGE_KEY);
        if (!raw) return false;

        const { tabs: savedTabs, activeTabId: savedActiveId } = JSON.parse(raw);
        if (!savedTabs || !savedTabs.length) return false;

        savedTabs.forEach(t => {
            tabCounter++;
            const model = monaco.editor.createModel(t.content, 'javascript');
            tabs.push({ id: t.id, name: t.name, model, viewState: null });
        });

        activeTabId = savedActiveId && tabs.some(t => t.id === savedActiveId)
            ? savedActiveId
            : tabs[0].id;

        return true;
    } catch (e) {
        console.error('Failed to load tabs:', e);
        return false;
    }
}


require(["vs/editor/editor.main"], async function () {

    let currentFontSize = parseInt(localStorage.getItem('jsEditorFontSize'), 10) || 14;

    const fontSizeLabel = document.getElementById('fontSizeLabel');
    if (fontSizeLabel) fontSizeLabel.textContent = currentFontSize;

    // Create the editor WITHOUT value/language — the active tab's model supplies both
    editor = monaco.editor.create(document.getElementById("editor"), {
        theme: "vs-light",
        automaticLayout: true,
        minimap: {
            enabled: true
        },
        scrollBeyondLastLine: true,
        fontFamily: "'Fira Code', 'Consolas', monospace",
        fontSize: currentFontSize,
        lineNumbers: "on",
        roundedSelection: true,
        scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
        }
    });

    // Load saved tabs, or migrate the old single-file save into tab 1
    const hadSavedTabs = loadTabs();
    if (!hadSavedTabs) {
        const savedCode = localStorage.getItem('jsEditorCode');
        const initialCode = savedCode || `console.log("Ready for Interview ....")`;
        const tab = createTab('main.js', initialCode);
        activeTabId = tab.id;
    }

    editor.setModel(tabs.find(t => t.id === activeTabId).model);
    renderTabs();

    document.getElementById('newTabBtn')?.addEventListener('click', addNewTab);

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

    function setFontSize(size) {
        currentFontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, size));
        editor.updateOptions({ fontSize: currentFontSize });
        if (fontSizeLabel) fontSizeLabel.textContent = currentFontSize;
        try {
            localStorage.setItem('jsEditorFontSize', currentFontSize);
        } catch (e) {
            console.error('Failed to save font size:', e);
        }
    }

    document.getElementById('fontIncrease')?.addEventListener('click', () => {
        setFontSize(currentFontSize + FONT_STEP);
    });

    document.getElementById('fontDecrease')?.addEventListener('click', () => {
        setFontSize(currentFontSize - FONT_STEP);
    });

    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            setFontSize(currentFontSize + FONT_STEP);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            setFontSize(currentFontSize - FONT_STEP);
        }
    });

    function safeAutoExecute() {
        if (!autoExecuteEnabled || isRateLimited()) return;

        const code = editor.getValue();
        const safetyCheck = isSafeCode(code);

        if (!safetyCheck.safe) {
            addLogEntry(`⛔ Auto-execution blocked: ${safetyCheck.reason}`, 'warn');
            return;
        }

        if (autoExecuteTimer) clearTimeout(autoExecuteTimer);

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

    editor.onDidChangeModelContent((event) => {
        if (isRemoteChange) return;

        const code = editor.getValue();

        if (debounceSendTimer) {
            clearTimeout(debounceSendTimer);
        }

        debounceSendTimer = setTimeout(() => {
            if (code !== lastSentCode) {
                try {
                    socket.emit("code-change", {
                        roomId,
                        code,
                        timestamp: Date.now(),
                        senderId: socket.id
                    });
                    lastSentCode = code;
                    console.log('📤 Sent code update');
                } catch (e) {
                    console.error("Error emitting code-change:", e);
                }
            }
        }, 150);

        if (saveTimer) {
            clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(() => {
            saveCodeToStorage();
            console.log('💾 Auto-saved to local storage');
        }, 1000);

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


    function createObjectInspector(obj, depth = 0, maxDepth = 5, seen = new WeakSet()) {
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

    let activeWorker = null;

    function runCode() {
        const code = editor.getValue();
        if (!code) return;

        if (activeWorker) {
            activeWorker.terminate();
            activeWorker = null;
            addLogEntry('⚠️ Previous execution terminated', 'warn');
        }

        outputElement.innerHTML = '';
        logCount = 0;

        const workerScript = `
        const _logs = [];

        const console = {
            _send(type, args) {
                self.postMessage({ type, args: args.map(a => {
                    try { return JSON.parse(JSON.stringify(a)); }
                    catch(e) { return String(a); }
                })});
            },
            log(...a)   { this._send('log', a); },
            warn(...a)  { this._send('warn', a); },
            error(...a) { this._send('error', a); },
            info(...a)  { this._send('info', a); },
            table(a)    { this._send('table', [a]); },
        };

        self.addEventListener('message', (e) => {
            try {
                const result = eval(e.data);
                if (result instanceof Promise) {
                    result
                        .then(v => { if (v !== undefined) console.log(v); })
                        .catch(err => console.error(String(err)));
                }
            } catch(err) {
                self.postMessage({ type: 'error', args: [err.name + ': ' + err.message] });
            } finally {
                self.postMessage({ type: '__done__', args: [] });
            }
        });
    `;

        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        activeWorker = new Worker(workerUrl);
        URL.revokeObjectURL(workerUrl);

        const killTimer = setTimeout(() => {
            if (activeWorker) {
                activeWorker.terminate();
                activeWorker = null;
                addLogEntry('⏱️ Execution killed: took longer than 5 seconds (infinite loop?)', 'error');
            }
        }, 5000);

        activeWorker.onmessage = (e) => {
            const { type, args } = e.data;

            if (type === '__done__') {
                clearTimeout(killTimer);
                activeWorker = null;
                return;
            }

            const content = args.map(arg => {
                if (arg === null) return '<span class="object-null">null</span>';
                if (arg === undefined) return '<span class="object-undefined">undefined</span>';
                if (typeof arg === 'string') return `<span class="object-string">"${arg}"</span>`;
                if (typeof arg === 'number') return `<span class="object-number">${arg}</span>`;
                if (typeof arg === 'boolean') return `<span class="object-boolean">${arg}</span>`;
                if (typeof arg === 'object') return `<pre style="margin:0">${JSON.stringify(arg, null, 2)}</pre>`;
                return String(arg);
            }).join(' ');

            addLogEntry(content, type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log');
        };

        activeWorker.onerror = (e) => {
            clearTimeout(killTimer);
            activeWorker = null;
        };

        activeWorker.postMessage(code);
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

    document.getElementById("run").addEventListener("click", runCode);
    document.getElementById("download").addEventListener("click", downloadCode);
    document.getElementById("format").addEventListener("click", formatCode);

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

    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
        if (e.altKey && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            formatCode();
        }
    });

    languageList.addEventListener("click", (e) => {
        const item = e.target.closest("li");
        if (!item) return;

        const langKey = item.dataset.lang;
        if (!langKey) return;

        console.log("Selected language:", langKey);
        language = langKey

        document
            .querySelectorAll("#languageList li")
            .forEach(li => li.classList.remove("active"));

        item.classList.add("active");

        switchLanguage(langKey);
    });

    function switchLanguage(lang) {
        switch (lang) {
            case "javascript":
                window.location.href = "/src/editor/index.html";
                break;
            case "typescript":
                window.location.href = "/src/typescript/index.html";
                break;
            case "html":
                window.location.href = "/src/html/index.html";
                break;
            case "react":
                window.location.href = "/src/react/index.html";
                break;
            case "json":
                window.location.href = "/src/jsonformatter/index.html";
                break;
            default:
                console.warn(`No runner defined for ${lang}`);
        }
    }

    const toggle = document.getElementById("autoExecuteToggle");
    const label = document.getElementById("autoExecuteLabel");

    toggle?.addEventListener("change", function () {
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
        console.log('WebSocket supported:', 'WebSocket' in window);

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

    function addCopyRoomButton() {
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copy Room URL';
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