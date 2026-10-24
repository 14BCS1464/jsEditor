// State Management
const state = {
    autoRun: true,
    activeFile: 'index.html',
    previewVisible: true,
    bottomPanelVisible: false,
    sidebarExpanded: false,
    files: {
        'index.html': '',
        'style.css': '',
        'script.js': ''
    },
    fileDirty: {
        'index.html': false,
        'style.css': true,
        'script.js': false
    }
};

// DOM Elements
let previewFrame, previewLoading, tabsBar, sidebar, previewPanel;
let resizeHandle, bottomPanel, welcomeScreen, lineNumberElements;
let resizeTimeout;
let isResizing = false;
const codeEditors = {};
const editorFiles = { htmlCode: 'index.html', cssCode: 'style.css', jsCode: 'script.js' };

// Storage keys
const STORAGE_KEYS = {
    FILES: 'codeEditor_files',
    STATE: 'codeEditor_state',
    LAYOUT: 'codeEditor_layout',
    LAST_ACTIVE_FILE: 'codeEditor_lastActiveFile'
};

// Initialize the editor
function init() {
    // Get DOM elements
    previewFrame = document.getElementById('previewFrame');
    previewLoading = document.getElementById('previewLoading');
    tabsBar = document.getElementById('tabsBar');
    sidebar = document.getElementById('sidebar');
    previewPanel = document.getElementById('previewPanel');
    resizeHandle = document.getElementById('resizeHandle');
    bottomPanel = document.getElementById('bottomPanel');
    welcomeScreen = document.getElementById('welcomeScreen');

    lineNumberElements = {
        'html': document.getElementById('htmlLineNumbers'),
        'css': document.getElementById('cssLineNumbers'),
        'js': document.getElementById('jsLineNumbers')
    };

    // Load saved state from localStorage
    loadSavedState();

    mountEditors();

    // Set up event listeners
    setupEventListeners();

    // Generate line numbers
    generateLineNumbers();

    // Run initial preview
    runCode();


    // Update status
    updateStatus();

    // Auto-save state on page unload
    window.addEventListener('beforeunload', saveState);
}

// Load saved state from localStorage
function loadSavedState() {
    try {
        // Load files
        const savedFiles = localStorage.getItem(STORAGE_KEYS.FILES);
        if (savedFiles) {
            const parsedFiles = JSON.parse(savedFiles);
            Object.keys(parsedFiles).forEach(key => {
                if (state.files.hasOwnProperty(key)) {
                    state.files[key] = parsedFiles[key] || '';
                }
            });
        }

        // Load editor state
        const savedState = localStorage.getItem(STORAGE_KEYS.STATE);
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            Object.keys(parsedState).forEach(key => {
                if (state.hasOwnProperty(key) && key !== 'files' && key !== 'fileDirty') {
                    state[key] = parsedState[key];
                }
            });
        }

        // Load layout preferences
        const savedLayout = localStorage.getItem(STORAGE_KEYS.LAYOUT);
        if (savedLayout) {
            const layout = JSON.parse(savedLayout);

            // Apply layout preferences
            if (layout.previewWidth) {
                requestAnimationFrame(() => setPaneSizes(layout.previewWidth));
            }

            if (typeof layout.previewVisible === 'boolean') {
                state.previewVisible = layout.previewVisible;
                previewPanel.classList.toggle('collapsed', !state.previewVisible);
            }

            if (typeof layout.bottomPanelVisible === 'boolean') {
                state.bottomPanelVisible = layout.bottomPanelVisible;
                bottomPanel.classList.toggle('expanded', layout.bottomPanelVisible);
            }

            if (typeof layout.sidebarExpanded === 'boolean') {
                state.sidebarExpanded = layout.sidebarExpanded;
                sidebar.classList.toggle('expanded', layout.sidebarExpanded);
            }
        }

        // Load last active file
        const lastActiveFile = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_FILE);
        if (lastActiveFile && state.files.hasOwnProperty(lastActiveFile)) {
            state.activeFile = lastActiveFile;
        }

        syncEditorsFromState();

        // Update tab states
        updateTabStates();

        // Update UI controls based on loaded state
        updateUIFromState();

        console.log('State loaded from localStorage');
    } catch (error) {
        console.error('Error loading saved state:', error);
        // Keep default state if loading fails
    }
}

// Update tab states based on loaded state
function updateTabStates() {
    document.querySelectorAll('.tab').forEach(tab => {
        const file = tab.dataset.file;
        tab.classList.toggle('active', file === state.activeFile);
        tab.classList.toggle('dirty', state.fileDirty[file]);
    });

    document.querySelectorAll('.code-editor').forEach(editor => {
        editor.classList.toggle('active', editor.id === state.activeFile);
    });
}

// Update UI controls from loaded state
function updateUIFromState() {
    // Update auto-run status
    const autoRunStatus = document.getElementById('autoRunStatus');
    if (autoRunStatus) {
        autoRunStatus.querySelector('span').textContent = `Auto-Run: ${state.autoRun ? 'ON' : 'OFF'}`;
    }

    const autoRunBtn = document.getElementById('autoRunBtn');
    if (autoRunBtn) {
        autoRunBtn.textContent = state.autoRun ? 'Auto-Run: ON' : 'Auto-Run: OFF';
        autoRunBtn.classList.toggle('active', state.autoRun);
    }

    // Update preview toggle button
    const togglePreviewBtn = document.getElementById('togglePreviewPanel');
    if (togglePreviewBtn) {
        togglePreviewBtn.innerHTML = state.previewVisible ?
            '<i class="fas fa-times"></i>' :
            '<i class="fas fa-columns"></i>';
        togglePreviewBtn.title = state.previewVisible ? 'Hide Preview' : 'Show Preview';
    }

    // Update bottom panel toggle button
    const bottomPanelToggle = document.getElementById('toggleBottomPanel');
    if (bottomPanelToggle) {
        const icon = bottomPanelToggle.querySelector('i');
        if (icon) {
            icon.className = state.bottomPanelVisible ?
                'fas fa-chevron-down' : 'fas fa-chevron-up';
        }
    }

    // Update language status
    const ext = state.activeFile.split('.').pop();
    const languageStatus = document.getElementById('languageStatus');
    if (languageStatus) {
        languageStatus.querySelector('span').textContent = ext.toUpperCase();
    }
}

// Save all state to localStorage
function saveState() {
    try {
        // Save files
        localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(state.files));

        // Save editor state (excluding files and fileDirty)
        const stateToSave = {
            autoRun: state.autoRun,
            activeFile: state.activeFile,
            previewVisible: state.previewVisible,
            bottomPanelVisible: state.bottomPanelVisible,
            sidebarExpanded: state.sidebarExpanded
        };
        localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(stateToSave));

        // Save layout preferences
        const layoutToSave = {
            previewWidth: parseInt(previewPanel.style.width) || 500,
            previewVisible: state.previewVisible,
            bottomPanelVisible: state.bottomPanelVisible,
            sidebarExpanded: state.sidebarExpanded
        };
        localStorage.setItem(STORAGE_KEYS.LAYOUT, JSON.stringify(layoutToSave));

        // Save last active file separately for quick access
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_FILE, state.activeFile);

        console.log('State saved to localStorage');
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

// Debounced save function for frequent updates
function debouncedSave() {
    clearTimeout(debouncedSave.timeout);
    debouncedSave.timeout = setTimeout(saveState, 1000);
}

// Set up all event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                switchTab(tab.dataset.file);
            }
        });

        // Close tab button
        const closeBtn = tab.querySelector('.tab-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(tab.dataset.file);
            });
        }
    });

    // Sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view === 'explorer') {
                toggleSidebar();
            }
            if (view) {
                setActiveSidebarItem(item);
            }
        });
    });

    // Code editor input - with auto-save
    document.querySelectorAll('.code-area').forEach(textarea => {
        textarea.addEventListener('input', (e) => {
            const file = e.target.parentElement.id;
            state.files[file] = e.target.value;
            state.fileDirty[file] = true;

            // Update tab dirty indicator
            const tab = document.querySelector(`.tab[data-file="${file}"]`);
            if (tab) {
                tab.classList.toggle('dirty', state.fileDirty[file]);
            }

            // Auto-run if enabled
            if (state.autoRun) {
                scheduleRun();
            }

            // Update line numbers
            updateLineNumbers(file);

            // Update cursor position
            updateCursorPosition(e.target);

            // Save to localStorage (debounced)
            debouncedSave();
        });

        // Track cursor position
        textarea.addEventListener('click', (e) => updateCursorPosition(e.target));
        textarea.addEventListener('keyup', (e) => updateCursorPosition(e.target));
    });

    const bind = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };
    bind('runBtn', 'click', runCode);
    bind('saveBtn', 'click', saveAllFiles);
    bind('refreshPreview', 'click', runCode);
    bind('togglePreview', 'click', togglePreview);
    bind('togglePreviewPanel', 'click', togglePreview);
    bind('autoRunStatus', 'click', toggleAutoRun);
    bind('toggleBottomPanel', 'click', toggleBottomPanel);
    bind('languageList', 'click', chooseLanguage);
    bind('responsiveToggle', 'click', toggleResponsiveMode);
    if (resizeHandle) resizeHandle.addEventListener('mousedown', startResizing);

    // Panel tabs
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    // Welcome screen buttons
    const newProjectBtn = document.getElementById('newProjectBtn');
    if (newProjectBtn && welcomeScreen) newProjectBtn.addEventListener('click', () => welcomeScreen.classList.add('hidden'));
    const openProjectBtn = document.getElementById('openProjectBtn');
    if (openProjectBtn && welcomeScreen) openProjectBtn.addEventListener('click', () => {
        welcomeScreen.classList.add('hidden');
        showToast('Open project dialog would appear here', 'info');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveAllFiles();
        }

        // Ctrl/Cmd + R to run
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            runCode();
        }

        // Ctrl/Cmd + B to toggle bottom panel
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleBottomPanel();
        }

        // Ctrl/Cmd + \ to toggle preview
        if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
            e.preventDefault();
            togglePreview();
        }
    });

    // Save state on resize end
    if (resizeHandle) resizeHandle.addEventListener('mouseup', () => debouncedSave());
}

function chooseLanguage(e) {
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

}

function switchLanguage(lang) {
    switch (lang) {
        case "javascript":
            window.location.href = "../editor/";
            break;

        case "typescript":
            window.location.href = "../typescript/";
            break;

        case "html":
            window.location.href = "../html/";
            break;
        case "react":
            window.location.href = "../react/";
            break;
        case "json":
            window.location.href = "../json/";
            break;

        default:
            console.warn(`No runner defined for ${lang}`);
    }
}

// Tab management
function switchTab(file) {
    // Update active tab
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.file === file);
    });

    // Update active editor
    document.querySelectorAll('.code-editor').forEach(editor => {
        editor.classList.toggle('active', editor.id === file);
    });

    // Update state
    state.activeFile = file;

    // Save active file to localStorage
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_FILE, file);

    // Update status bar language
    const ext = file.split('.').pop();
    const languageStatus = document.getElementById('languageStatus');
    if (languageStatus) languageStatus.querySelector('span').textContent = ext.toUpperCase();

    // Update line numbers
    updateLineNumbers(file);

    // Update cursor position for active editor
    const activeId = file === 'style.css' ? 'cssCode' : file === 'script.js' ? 'jsCode' : 'htmlCode';
    const activeEditor = codeEditors[activeId];
    if (activeEditor) requestAnimationFrame(() => activeEditor.layout());

    // Save state
    debouncedSave();
}

function closeTab(file) {
    // Don't close if it's the only tab
    if (document.querySelectorAll('.tab').length <= 1) return;

    const tab = document.querySelector(`.tab[data-file="${file}"]`);
    if (tab) {
        tab.remove();

        // Switch to another tab if this was active
        if (state.activeFile === file) {
            const nextTab = document.querySelector('.tab');
            if (nextTab) {
                switchTab(nextTab.dataset.file);
            }
        }
    }

    // Save state after tab close
    debouncedSave();
}

// Code execution
function runCode() {
    // Show loading indicator
    previewLoading.style.display = 'flex';

    // Get all code
    const html = state.files['index.html'] || '';
    const css = `<style>${state.files['style.css'] || ''}</style>`;
    const js = `<script>try { ${state.files['script.js'] || ''} } catch(e) { 
        console.error('Runtime error:', e); 
        document.body.innerHTML += '<pre style="color:red;background:#300;padding:10px;margin:10px;border-radius:4px;font-family:monospace;">JS Error: ' + e.message + '</pre>'; 
    }<\/script>`;

    // Combine into single HTML
    const source = html.replace('</body>', css + js + '</body>');

    // Update iframe
    previewFrame.srcdoc = source;

    // Hide loading after a delay
    setTimeout(() => {
        previewLoading.style.display = 'none';
    }, 500);

    // Update terminal with run info
    const terminal = document.getElementById('terminalContent');
    if (terminal) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const runLine = document.createElement('div');
        runLine.className = 'terminal-line output';
        runLine.textContent = `[${time}] Preview updated`;
        terminal.appendChild(runLine);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Mark files as clean
    Object.keys(state.fileDirty).forEach(file => {
        state.fileDirty[file] = false;
        const tab = document.querySelector(`.tab[data-file="${file}"]`);
        if (tab) tab.classList.remove('dirty');
    });

    // Save state after run
    saveState();
}

function scheduleRun() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(runCode, 800);
}

// UI Controls
function toggleAutoRun() {
    state.autoRun = !state.autoRun;
    const status = document.getElementById('autoRunStatus');
    status.querySelector('span').textContent = `Auto-Run: ${state.autoRun ? 'ON' : 'OFF'}`;

    // Update button in header if it exists
    const autoRunBtn = document.getElementById('autoRunBtn');
    if (autoRunBtn) {
        autoRunBtn.textContent = state.autoRun ? 'Auto-Run: ON' : 'Auto-Run: OFF';
        autoRunBtn.classList.toggle('active', state.autoRun);
    }

    // Save state
    debouncedSave();

    showToast(`Auto-run ${state.autoRun ? 'enabled' : 'disabled'}`, 'info');
}

function togglePreview() {
    state.previewVisible = !state.previewVisible;
    previewPanel.classList.toggle('collapsed', !state.previewVisible);
    const toggleBtn = document.getElementById('togglePreviewPanel');
    toggleBtn.innerHTML = state.previewVisible ?
        '<i class="fas fa-times"></i>' :
        '<i class="fas fa-columns"></i>';
    toggleBtn.title = state.previewVisible ? 'Hide Preview' : 'Show Preview';

    // Save state
    debouncedSave();
}

function toggleBottomPanel() {
    state.bottomPanelVisible = !state.bottomPanelVisible;
    bottomPanel.classList.toggle('expanded', state.bottomPanelVisible);
    const toggleBtn = document.getElementById('toggleBottomPanel');
    toggleBtn.querySelector('i').className = state.bottomPanelVisible ?
        'fas fa-chevron-down' : 'fas fa-chevron-up';

    // Save state
    debouncedSave();

    showToast(`${state.bottomPanelVisible ? 'Showing' : 'Hiding'} bottom panel`, 'info');
}

function toggleSidebar() {
    state.sidebarExpanded = !state.sidebarExpanded;
    sidebar.classList.toggle('expanded', state.sidebarExpanded);

    // Save state
    debouncedSave();
}

function toggleResponsiveMode() {
    const btn = document.getElementById('responsiveToggle');
    btn.classList.toggle('active');

    if (btn.classList.contains('active')) {
        // Set responsive viewport
        previewFrame.contentWindow.document.querySelector('head').innerHTML +=
            '<meta name="viewport" content="width=device-width, initial-scale=1">';
        showToast('Responsive mode enabled', 'info');
    } else {
        showToast('Responsive mode disabled', 'info');
    }
}

function setActiveSidebarItem(activeItem) {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    activeItem.classList.add('active');
}

// File operations
function saveAllFiles() {
    // Save to localStorage
    saveState();

    // Mark all files as clean
    Object.keys(state.fileDirty).forEach(file => {
        state.fileDirty[file] = false;
        const tab = document.querySelector(`.tab[data-file="${file}"]`);
        if (tab) tab.classList.remove('dirty');
    });

    showToast('All files saved successfully', 'success');
}

// Line number management
function generateLineNumbers() {
    Object.keys(lineNumberElements).forEach(type => {
        const textarea = document.getElementById(`${type}.js` === 'js.js' ? 'jsCode' : `${type}Code`);
        const lineNumbers = lineNumberElements[type];
        if (textarea && lineNumbers) {
            updateLineNumbers(`${type}.js` === 'js.js' ? 'script.js' : `${type === 'html' ? 'index.html' : 'style.css'}`);
        }
    });
}

function updateLineNumbers(file) {
    let type;
    if (file === 'index.html') type = 'html';
    else if (file === 'style.css') type = 'css';
    else type = 'js';

    const textarea = document.getElementById(`${type}Code`);
    const lineNumbers = lineNumberElements[type];

    if (!textarea || !lineNumbers) return;

    const lines = textarea.value.split('\n').length;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
        numbers += i + '\n';
    }
    lineNumbers.textContent = numbers;
}

function updateCursorPosition(textarea) {
    const cursorPos = textarea.selectionStart;
    const textUpToCursor = textarea.value.substring(0, cursorPos);
    const lines = textUpToCursor.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    document.getElementById('lineColStatus').querySelector('span').textContent =
        `Ln ${line}, Col ${col}`;
}

// Resize functionality
function setPaneSizes(previewPx) {
    const container = previewPanel.parentElement;
    if (!container) return;
    const handleWidth = resizeHandle ? resizeHandle.offsetWidth : 0;
    const total = container.clientWidth - handleWidth;
    const minPreview = 220;
    const minEditor = 280;
    const preview = Math.max(minPreview, Math.min(previewPx, total - minEditor));
    const editor = Math.max(minEditor, total - preview);
    const editorArea = container.querySelector('.editor-area');
    if (editorArea) editorArea.style.flex = `0 0 ${editor}px`;
    previewPanel.style.flex = `0 0 ${preview}px`;
    previewPanel.style.width = `${preview}px`;
}

function startResizing(e) {
    e.preventDefault();
    isResizing = true;
    document.body.classList.add('html-pane-dragging');
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
    resizeHandle.classList.add('active');
}

function resize(e) {
    if (!isResizing) return;
    const rect = previewPanel.parentElement.getBoundingClientRect();
    const handleWidth = resizeHandle ? resizeHandle.offsetWidth : 0;
    setPaneSizes(rect.right - e.clientX - handleWidth / 2);
}

function stopResizing() {
    if (!isResizing) return;
    isResizing = false;
    document.body.classList.remove('html-pane-dragging');
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResizing);
    resizeHandle.classList.remove('active');
    debouncedSave();
}

// Status updates
function updateStatus() {
    const errorStatus = document.getElementById('errorStatus');
    if (!errorStatus) return;
    const errorCount = 0;
    errorStatus.querySelector('span').textContent = `${errorCount} Errors`;
    errorStatus.querySelector('i').className = 'fas fa-check-circle';
}

function syncEditorsFromState() {
    Object.entries(editorFiles).forEach(([id, file]) => {
        const editor = codeEditors[id];
        if (editor && editor.getValue() !== (state.files[file] || '')) editor.setValue(state.files[file] || '');
    });
}

function mountEditors() {
    const start = () => {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
        require(['vs/editor/editor.main'], () => {
            const specs = [
                ['htmlCode', 'html'],
                ['cssCode', 'css'],
                ['jsCode', 'javascript']
            ];
            specs.forEach(([id, language]) => {
                const host = document.getElementById(id);
                if (!host || codeEditors[id]) return;
                const file = editorFiles[id];
                const editor = monaco.editor.create(host, {
                    value: state.files[file] || '',
                    language,
                    theme: (window.suiteMonacoTheme ? suiteMonacoTheme() : 'vs'),
                    automaticLayout: true,
                    fontSize: 14,
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    padding: { top: 12 }
                });
                editor.onDidChangeModelContent(() => {
                    state.files[file] = editor.getValue();
                    state.fileDirty[file] = true;
                    const tab = document.querySelector(`.tab[data-file="${file}"]`);
                    if (tab) tab.classList.add('dirty');
                    if (state.autoRun) scheduleRun();
                    debouncedSave();
                });
                codeEditors[id] = editor;
            });
            const activeId = state.activeFile === 'style.css' ? 'cssCode' : state.activeFile === 'script.js' ? 'jsCode' : 'htmlCode';
            if (codeEditors[activeId]) codeEditors[activeId].layout();
        });
    };
    if (window.require) start();
    else window.addEventListener('load', start);
}

function formatCode(type) {
    const id = type === 'css' ? 'cssCode' : type === 'js' ? 'jsCode' : 'htmlCode';
    const editor = codeEditors[id];
    if (!editor) return;
    const action = editor.getAction('editor.action.formatDocument');
    if (action) action.run();
    else if (type === 'html') editor.setValue(editor.getValue().replace(/></g, '>\n<'));
}

// Toast notification
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle',
        warning: 'fas fa-exclamation-triangle'
    };

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-content">
            ${message}
        </div>
    `;

    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);

// Export functions for global access
window.editor = {
    runCode,
    togglePreview,
    toggleAutoRun,
    saveAllFiles,
    showToast,
    // Export saveState for manual saving if needed
    saveState: function () {
        saveState();
        showToast('Editor state saved', 'success');
    },
    // Export loadState for manual reloading if needed
    loadState: function () {
        loadSavedState();
        showToast('Editor state loaded', 'info');
    },
    // Export clearStorage to reset everything
    clearStorage: function () {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        showToast('All saved data cleared', 'warning');
        location.reload();
    }
};