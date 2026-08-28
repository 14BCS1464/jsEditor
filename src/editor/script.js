require.config({
    paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs"
    }
});

let editor = null;
let logCount = 0;
let changeTimer = null;
let saveTimer = null;
let language = 'javascript';

// ===== SAFETY LIMITS =====
const SAFETY_LIMITS = {
    maxCodeLength: 10000,
    maxOutputLines: 1000,
    maxExecutionTime: 5000,
    maxIntervalRuns: 50
};

const WORKER_SOURCE = `
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getFunctionParams(func) {
    try {
        const funcStr = func.toString();
        const match = funcStr.match(/\\(([^)]*)\\)/);
        return match ? escapeHtml(match[1]) : '';
    } catch (e) {
        return '';
    }
}

let inspectIdCounter = 0;

function createObjectInspector(obj, depth, maxDepth, seen) {
    depth = depth || 0;
    maxDepth = maxDepth === undefined ? 5 : maxDepth;
    seen = seen || new WeakSet();

    if (depth > maxDepth) return '<span class="object-value">[Object]</span>';
    if (obj === null) return '<span class="object-null">null</span>';
    if (obj === undefined) return '<span class="object-undefined">undefined</span>';

    const type = typeof obj;

    if (type === 'string') return '<span class="object-string">"' + escapeHtml(obj) + '"</span>';
    if (type === 'number') return '<span class="object-number">' + obj + '</span>';
    if (type === 'boolean') return '<span class="object-boolean">' + obj + '</span>';
    if (type === 'function') {
        return '<span class="object-value">\\u0192 ' + escapeHtml(obj.name || 'anonymous') +
            '(' + getFunctionParams(obj) + ')</span>';
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) return '<span class="object-value">[]</span>';
        const id = 'inspect_' + (inspectIdCounter++);
        let html = '<div class="object-inspector">';
        html += '<span class="expandable" onclick="toggleExpand(\\'' + id + '\\')">Array(' + obj.length + ')</span>';
        html += '<div id="' + id + '" class="object-tree collapsed">';
        obj.forEach(function (item, index) {
            html += '<div><span class="object-key">' + index + ':</span> ' +
                createObjectInspector(item, depth + 1, maxDepth, seen) + '</div>';
        });
        html += '</div></div>';
        return html;
    }

    if (type === 'object') {
        if (seen.has(obj)) return '<span class="object-circular">[Circular Reference]</span>';
        seen.add(obj);
        const keys = Object.keys(obj);
        if (keys.length === 0) return '<span class="object-value">{}</span>';
        const id = 'inspect_' + (inspectIdCounter++);
        let html = '<div class="object-inspector">';
        html += '<span class="expandable" onclick="toggleExpand(\\'' + id + '\\')">' +
            escapeHtml((obj.constructor && obj.constructor.name) || 'Object') + '</span>';
        html += '<div id="' + id + '" class="object-tree collapsed">';
        keys.forEach(function (key) {
            html += '<div><span class="object-key">' + escapeHtml(key) + ':</span> ' +
                createObjectInspector(obj[key], depth + 1, maxDepth, seen) + '</div>';
        });
        html += '</div></div>';
        return html;
    }

    return '<span class="object-value">' + escapeHtml(String(obj)) + '</span>';
}

let logLineCount = 0;
const MAX_OUTPUT_LINES = ${SAFETY_LIMITS.maxOutputLines};
let floodWarned = false;

function emit(type, args) {
    if (logLineCount > MAX_OUTPUT_LINES) {
        if (!floodWarned) {
            floodWarned = true;
            self.postMessage({ kind: 'log', logType: 'warn', html: '\\u{1F9F9} Output truncated -- too many log lines' });
            self.postMessage({ kind: 'flood' });
        }
        return;
    }
    logLineCount++;
    const content = args.map(function (arg) {
        return createObjectInspector(arg, 0, 5, new WeakSet());
    }).join(' ');
    self.postMessage({ kind: 'log', logType: type, html: content });
}

console.log = function () { emit('log', Array.prototype.slice.call(arguments)); };
console.warn = function () { emit('warn', Array.prototype.slice.call(arguments)); };
console.error = function () { emit('error', Array.prototype.slice.call(arguments)); };
console.info = function () { emit('info', Array.prototype.slice.call(arguments)); };
console.table = function () { emit('log', Array.prototype.slice.call(arguments)); };

const MAX_INTERVAL_RUNS = ${SAFETY_LIMITS.maxIntervalRuns};
const _origSetInterval = self.setInterval;
self.setInterval = function (fn, delay) {
    let count = 0;
    const args = Array.prototype.slice.call(arguments, 2);
    const id = _origSetInterval(function () {
        count++;
        if (count > MAX_INTERVAL_RUNS) {
            self.clearInterval(id);
            console.warn('Interval auto-stopped after max iterations');
            return;
        }
        try {
            if (typeof fn === 'function') fn.apply(null, args);
        } catch (err) {
            console.error(err.name + ': ' + err.message);
        }
    }, delay);
    return id;
};

self.onmessage = function (e) {
    const code = e.data.code;
    try {
        const result = (0, eval)(code);
        if (result && typeof result.then === 'function') {
            result
                .then(function (v) { if (v !== undefined) console.log(v); })
                .catch(function (err) { console.error(err.name + ': ' + err.message); })
                .finally(function () { self.postMessage({ kind: 'sync-done' }); });
        } else {
            if (result !== undefined) console.log(result);
            self.postMessage({ kind: 'sync-done' });
        }
    } catch (err) {
        console.error(err.name + ': ' + err.message);
        self.postMessage({ kind: 'sync-done', error: true });
    }
};
`;

const FONT_MIN = 8;
const FONT_MAX = 32;
const FONT_STEP = 1;

// --- Multi-tab state ---
let tabs = [];
let activeTabId = null;
let tabCounter = 0;
const TABS_STORAGE_KEY = 'jsEditorTabs';

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

function addLogEntry(content, type = 'log') {
    const outputElement = document.getElementById("output");
    if (!outputElement) return;

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
    persistTabs();
    const code = editor ? editor.getValue() : '';

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

// --- Worker management ---
let currentWorker = null;
let currentHardKillTimer = null;
let workerBlobUrl = null;

function spawnWorker() {
    if (!workerBlobUrl) {
        const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
        workerBlobUrl = URL.createObjectURL(blob);
    }
    return new Worker(workerBlobUrl);
}

function terminateCurrentWorker(reason) {
    if (currentHardKillTimer) {
        clearTimeout(currentHardKillTimer);
        currentHardKillTimer = null;
    }
    if (currentWorker) {
        currentWorker.terminate();
        currentWorker = null;
        if (reason) addLogEntry(reason, 'warn');
    }
}

// --- Multi-tab functions ---
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
    if (!tabList) return;
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
    editor.setModel(nextTab.model);
    if (nextTab.viewState) editor.restoreViewState(nextTab.viewState);

    editor.focus();
    renderTabs();
    persistTabs();
}

function showToast(message, type = 'warn') {
    const existing = document.getElementById('customToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'customToast';
    toast.textContent = message;

    const bgColor = type === 'error' ? 'rgba(214, 48, 49, 0.95)' :
                    type === 'success' ? 'rgba(0, 184, 148, 0.95)' :
                    'rgba(253, 203, 110, 0.95)';

    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bgColor};
        color: #2d3436;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: toastIn 0.25s ease;
    `;

    if (!document.getElementById('toastStyle')) {
        const style = document.createElement('style');
        style.id = 'toastStyle';
        style.textContent = `
            @keyframes toastIn {
                from { opacity: 0; transform: translate(-50%, 20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
            @keyframes toastOut {
                from { opacity: 1; transform: translate(-50%, 0); }
                to { opacity: 0; transform: translate(-50%, 20px); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.25s ease forwards';
        setTimeout(() => toast.remove(), 250);
    }, 2500);
}

function addNewTab() {
    if (tabs.length >= 10) {
        showToast('⚠️ Maximum 10 tabs allowed', 'warn');
        return;
    }
    const name = `untitled-${tabs.length + 1}.js`;
    const tab = createTab(name, '');
    switchToTab(tab.id);
    persistTabs();
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

function createModal({ title, content, onConfirm, onCancel, confirmText = 'OK', cancelText = 'Cancel' }) {
    const existing = document.getElementById('customModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'customModal';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 10px;
        padding: 24px;
        width: 360px;
        max-width: 90vw;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        animation: modalFadeIn 0.2s ease;
    `;

    modal.innerHTML = `
        <h3 style="margin: 0 0 16px; font-size: 18px; color: #2d3436;">${title}</h3>
        <div id="modalContent" style="margin-bottom: 20px;"></div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="modalCancel" style="
                padding: 8px 16px;
                border: 1px solid #dfe6e9;
                background: #f5f6fa;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            ">${cancelText}</button>
            <button id="modalConfirm" style="
                padding: 8px 16px;
                border: none;
                background: #6c5ce7;
                color: white;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            ">${confirmText}</button>
        </div>
    `;

    if (!document.getElementById('modalFadeInStyle')) {
        const style = document.createElement('style');
        style.id = 'modalFadeInStyle';
        style.textContent = `
            @keyframes modalFadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const contentEl = modal.querySelector('#modalContent');
    contentEl.appendChild(content);

    const input = contentEl.querySelector('input');
    if (input) {
        setTimeout(() => input.focus(), 50);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') modal.querySelector('#modalConfirm').click();
            if (e.key === 'Escape') modal.querySelector('#modalCancel').click();
        });
    }

    return new Promise((resolve) => {
        modal.querySelector('#modalConfirm').onclick = () => {
            const result = onConfirm ? onConfirm() : true;
            overlay.remove();
            resolve(result);
        };
        modal.querySelector('#modalCancel').onclick = () => {
            if (onCancel) onCancel();
            overlay.remove();
            resolve(null);
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(null);
            }
        });
    });
}

function renameTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = tab.name;
    input.style.cssText = `
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #dfe6e9;
        border-radius: 6px;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
    `;
    input.addEventListener('focus', () => input.select());

    createModal({
        title: 'Rename Tab',
        content: input,
        confirmText: 'Rename',
        cancelText: 'Cancel',
        onConfirm: () => {
            const newName = input.value.trim();
            if (newName) {
                tab.name = newName;
                renderTabs();
                persistTabs();
            }
            return true;
        }
    });
}

function closeTab(id) {
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    if (tabs.length === 1) {
        addLogEntry('⚠️ Cannot close the last tab', 'warn');
        return;
    }

    const tab = tabs[index];
    const hasContent = tab.model.getValue().trim().length > 0;

    const doClose = () => {
        const wasActive = id === activeTabId;
        tabs[index].model.dispose();
        tabs.splice(index, 1);

        if (wasActive) {
            const fallback = tabs[Math.max(0, index - 1)];
            activeTabId = null;
            switchToTab(fallback.id);
        } else {
            renderTabs();
        }
        persistTabs();
    };

    if (hasContent) {
        const message = document.createElement('div');
        message.innerHTML = `
            <p style="margin: 0 0 8px; color: #2d3436;">
                <strong>"${tab.name}"</strong> has unsaved content.
            </p>
            <p style="margin: 0; color: #636e72; font-size: 13px;">
                Are you sure you want to close this tab?
            </p>
        `;

        createModal({
            title: 'Close Tab?',
            content: message,
            confirmText: 'Close Tab',
            cancelText: 'Keep Open',
            onConfirm: () => {
                doClose();
                return true;
            }
        });
    } else {
        doClose();
    }
}

require(["vs/editor/editor.main"], function () {

    let currentFontSize = parseInt(localStorage.getItem('jsEditorFontSize'), 10) || 14;

    const fontSizeLabel = document.getElementById('fontSizeLabel');
    if (fontSizeLabel) fontSizeLabel.textContent = currentFontSize;

    editor = monaco.editor.create(document.getElementById("editor"), {
        theme: "vs-light",
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: true,
        fontFamily: "'Fira Code', 'Consolas', monospace",
        fontSize: currentFontSize,
        lineNumbers: "on",
        roundedSelection: true,
        formatOnType: true,
        formatOnPaste: true,
        scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
        }
    });

    // Load tabs or create default
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

    function isRateLimited() {
        const now = Date.now();
        if (now - lastExecutionTime < 60000) {
            executionCount++;
        } else {
            executionCount = 1;
            lastExecutionTime = now;
        }
        return executionCount > MAX_EXECUTIONS_PER_MINUTE;
    }

    function isSafeCode(code) {
        if (!code || code.length > SAFETY_LIMITS.maxCodeLength) {
            return { safe: false, reason: 'Code too long or empty' };
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

    editor.onDidChangeModelContent(() => {
        const code = editor.getValue();

        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveCodeToStorage();
        }, 1000);

        if (autoExecuteEnabled && code.trim()) {
            if (changeTimer) clearTimeout(changeTimer);
            changeTimer = setTimeout(() => {
                safeAutoExecute();
            }, 800);
        }
    });

    function createObjectInspector(obj, depth = 0, maxDepth = 5, seen = new WeakSet()) {
        if (depth > maxDepth) return '<span class="object-value">[Object]</span>';
        if (obj === null) return '<span class="object-null">null</span>';
        if (obj === undefined) return '<span class="object-undefined">undefined</span>';

        const type = typeof obj;

        if (type === 'string') return `<span class="object-string">"${obj}"</span>`;
        if (type === 'number') return `<span class="object-number">${obj}</span>`;
        if (type === 'boolean') return `<span class="object-boolean">${obj}</span>`;
        if (type === 'function') {
            return `<span class="object-value">ƒ ${obj.name || 'anonymous'}(${getFunctionParams(obj)})</span>`;
        }

        if (Array.isArray(obj)) {
            if (obj.length === 0) return '<span class="object-value">[]</span>';
            const id = `array_${Date.now()}_${Math.random()}`;
            let html = `<div class="object-inspector">`;
            html += `<span class="expandable" onclick="toggleExpand('${id}')">Array(${obj.length})</span>`;
            html += `<div id="${id}" class="object-tree collapsed">`;
            obj.forEach((item, index) => {
                html += `<div><span class="object-key">${index}:</span> ${createObjectInspector(item, depth + 1, maxDepth, seen)}</div>`;
            });
            html += `</div></div>`;
            return html;
        }

        if (type === 'object') {
            if (seen.has(obj)) return '<span class="object-circular">[Circular Reference]</span>';
            seen.add(obj);

            const keys = Object.keys(obj);
            if (keys.length === 0) return '<span class="object-value">{}</span>';

            const id = `obj_${Date.now()}_${Math.random()}`;
            let html = `<div class="object-inspector">`;
            html += `<span class="expandable" onclick="toggleExpand('${id}')">${obj.constructor?.name || 'Object'}</span>`;
            html += `<div id="${id}" class="object-tree collapsed">`;

            keys.forEach(key => {
                html += `<div><span class="object-key">${key}:</span> ${createObjectInspector(obj[key], depth + 1, maxDepth, seen)}</div>`;
            });

            const prototype = Object.getPrototypeOf(obj);
            if (prototype) {
                html += createPrototypeSection(prototype, 0, new WeakSet());
            }

            html += `</div></div>`;
            return html;
        }

        return `<span class="object-value">${String(obj)}</span>`;
    }

    function createPrototypeSection(prototype, depth = 5, visitedProtos = new WeakSet()) {
        if (!prototype || depth > 6) return '';

        const protoKey = prototype.constructor ? prototype.constructor.name : (prototype === null ? 'null' : 'Unknown');

        if (visitedProtos.has(prototype)) {
            return `<div class="prototype-section">
                <div class="prototype-header">🔗 [[Prototype]]: ${protoKey} (circular)</div>
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
            if (prototype === null) {
                html += `<div style="color:#aaa; font-style:italic;">null</div>`;
            } else {
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
            }
        } catch (error) {
            html += `<div style="color: #ff6b6b; font-style: italic;">Error inspecting prototype: ${error.message}</div>`;
        }

        const parentProto = Object.getPrototypeOf(prototype);
        if (parentProto !== undefined) {
            html += createPrototypeSection(parentProto, depth + 1, visitedProtos);
        }

        html += `</div></div>`;
        return html;
    }

    function getFunctionParams(func) {
        try {
            const funcStr = func.toString();
            const match = funcStr.match(/\(([^)]*)\)/);
            return match ? match[1] : '';
        } catch (e) {
            return '';
        }
    }

    window.toggleExpand = function (id) {
        const element = document.getElementById(id);
        if (!element) return;

        const trigger = element.previousElementSibling;

        if (element.classList.contains('collapsed')) {
            element.classList.remove('collapsed');
            if (trigger) trigger.classList.add('expanded');
        } else {
            element.classList.add('collapsed');
            if (trigger) trigger.classList.remove('expanded');
        }
    };

    function runCode(code) {
        if (typeof code !== 'string') code = editor.getValue();
        if (!code || !code.trim()) return;

        const safetyCheck = isSafeCode(code);
        if (!safetyCheck.safe) {
            addLogEntry(`⛔ Execution blocked: ${safetyCheck.reason}`, 'warn');
            return;
        }

        terminateCurrentWorker();

        if (outputElement && outputElement.children.length > SAFETY_LIMITS.maxOutputLines) {
            clearOutput();
            addLogEntry('🧹 Output cleared due to size limit', 'info');
        }
        if (outputElement) {
            outputElement.innerHTML = '';
            logCount = 0;
        }

        const startTime = Date.now();
        currentWorker = spawnWorker();

        currentWorker.onmessage = (e) => {
            const msg = e.data;
            if (msg.kind === 'log') {
                addLogEntry(msg.html, msg.logType);
            } else if (msg.kind === 'flood') {
                terminateCurrentWorker();
            } else if (msg.kind === 'sync-done') {
                const executionTime = Date.now() - startTime;
                if (executionTime > 1000) {
                    addLogEntry(`⏱️ Execution time: ${executionTime}ms`, 'info');
                }
            }
        };

        currentWorker.onerror = (err) => {
            addLogEntry(`Worker error: ${err.message}`, 'error');
            terminateCurrentWorker();
        };

        currentHardKillTimer = setTimeout(() => {
            terminateCurrentWorker('⏱️ Execution timeout — stopped');
        }, SAFETY_LIMITS.maxExecutionTime);

        currentWorker.postMessage({ code });
    }

    function runCodeSafely(code) {
        if (!code) code = editor.getValue();
        runCode(code);
    }

    window.clearOutput = function () {
        if (outputElement) {
            outputElement.innerHTML = "";
            logCount = 0;
        }
    };

    function downloadCode() {
        try {
            const code = editor.getValue();
            if (!code || !code.trim()) {
                showToast('⚠️ Nothing to download – editor is empty', 'warn');
                return;
            }

            const activeTab = tabs.find(t => t.id === activeTabId);
            let fileName = activeTab?.name || 'code.js';

            if (!fileName.toLowerCase().endsWith('.js')) {
                fileName += '.js';
            }

            const blob = new Blob([code], { type: 'text/javascript;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(() => URL.revokeObjectURL(url), 100);
            showToast(`✅ Downloaded as "${fileName}"`, 'success');
        } catch (err) {
            console.error('Download failed:', err);
            showToast('❌ Download failed', 'error');
        }
    }

    function applyFormatting(code) {
        if (typeof code !== 'string') code = editor.getValue();

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

    document.getElementById("run")?.addEventListener("click", () => runCode());
    document.getElementById("download")?.addEventListener("click", downloadCode);
    document.getElementById("format")?.addEventListener("click", () => applyFormatting());

    document.getElementById("addfile")?.addEventListener("click", function () {
        document.getElementById("fileInput")?.click();
    });

    document.getElementById("fileInput")?.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.js')) {
            alert("Please select a valid JavaScript (.js) file.");
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const newContent = e.target.result;
            const currentCode = editor.getValue() || "";

            const message = document.createElement('div');
            message.innerHTML = `
                <p style="margin: 0 0 12px; color: #2d3436; font-size: 14px;">
                    File <strong>"${file.name}"</strong> is ready.
                </p>
                <p style="margin: 0; color: #636e72; font-size: 13px;">
                    Do you want to <strong>merge</strong> it with the current code or <strong>replace</strong> everything?
                </p>
            `;

            createModal({
                title: 'Import File',
                content: message,
                confirmText: 'Merge',
                cancelText: 'Replace',
                onConfirm: () => {
                    const merged = currentCode ? `${currentCode}\n\n${newContent}` : newContent;
                    editor.setValue(merged);
                    addLogEntry(`✅ Merged "${file.name}" into current tab`, 'info');
                    return true;
                },
                onCancel: () => {
                    editor.setValue(newContent);
                    addLogEntry(`✅ Replaced content with "${file.name}"`, 'info');
                }
            });
        };

        reader.readAsText(file);
        event.target.value = '';
    });

    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
        if (e.altKey && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            applyFormatting();
        }
    });

    const languageList = document.getElementById("languageList");
    if (languageList) {
        languageList.addEventListener("click", (e) => {
            const item = e.target.closest("li");
            if (!item) return;

            const langKey = item.dataset.lang;
            if (!langKey) return;

            language = langKey;
            document.querySelectorAll("#languageList li").forEach(li => li.classList.remove("active"));
            item.classList.add("active");
            switchLanguage(langKey);
        });
    }

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
            if (label) label.textContent = "Auto-Execute: ON";
            addLogEntry("✅ Auto-execution enabled", "info");
            safeAutoExecute();
        } else {
            if (label) label.textContent = "Auto-Execute: OFF";
            if (autoExecuteTimer) clearTimeout(autoExecuteTimer);
            addLogEntry("⏸️ Auto-execution disabled", "warn");
        }
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