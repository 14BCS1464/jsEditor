// State Management
const state = {
    autoRun: true,
    activeFile: 'index.html',
    previewVisible: true,
    bottomPanelVisible: false,
    sidebarExpanded: false,
    files: {
      'index.html': document.getElementById('htmlCode').value,
      'style.css': document.getElementById('cssCode').value,
      'script.js': document.getElementById('jsCode').value
    },
    fileDirty: {
      'index.html': false,
      'style.css': true,
      'script.js': false
    }
  };
  
  // DOM Elements
  const previewFrame = document.getElementById('previewFrame');
  const previewLoading = document.getElementById('previewLoading');
  const tabsBar = document.getElementById('tabsBar');
  const sidebar = document.getElementById('sidebar');
  const previewPanel = document.getElementById('previewPanel');
  const resizeHandle = document.getElementById('resizeHandle');
  const bottomPanel = document.getElementById('bottomPanel');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const lineNumberElements = {
    'html': document.getElementById('htmlLineNumbers'),
    'css': document.getElementById('cssLineNumbers'),
    'js': document.getElementById('jsLineNumbers')
  };
  
  let resizeTimeout;
  let isResizing = false;
  
  // Initialize the editor
  function init() {
    // Set up event listeners
    setupEventListeners();
    
    // Generate line numbers
    generateLineNumbers();
    
    // Run initial preview
    runCode();
    
    // Hide welcome screen after a delay
    setTimeout(() => {
      welcomeScreen.classList.add('hidden');
    }, 1500);
    
    // Update status
    updateStatus();
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
    
    // Code editor input
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
      });
      
      // Track cursor position
      textarea.addEventListener('click', (e) => updateCursorPosition(e.target));
      textarea.addEventListener('keyup', (e) => updateCursorPosition(e.target));
    });
    
    // Control buttons
    document.getElementById('runBtn').addEventListener('click', runCode);
    document.getElementById('saveBtn').addEventListener('click', saveAllFiles);
    document.getElementById('refreshPreview').addEventListener('click', runCode);
    document.getElementById('togglePreview').addEventListener('click', togglePreview);
    document.getElementById('togglePreviewPanel').addEventListener('click', togglePreview);
    document.getElementById('autoRunStatus').addEventListener('click', toggleAutoRun);
    document.getElementById('toggleBottomPanel').addEventListener('click', toggleBottomPanel);
    
    // Resize handle
    resizeHandle.addEventListener('mousedown', startResizing);
    
    // Responsive toggle
    document.getElementById('responsiveToggle').addEventListener('click', toggleResponsiveMode);
    
    // Panel tabs
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });
    
    // Welcome screen buttons
    document.getElementById('newProjectBtn').addEventListener('click', () => {
      welcomeScreen.classList.add('hidden');
    });
    
    document.getElementById('openProjectBtn').addEventListener('click', () => {
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
    
    // Update status bar language
    const ext = file.split('.').pop();
    document.getElementById('languageStatus').querySelector('span').textContent = ext.toUpperCase();
    
    // Update line numbers
    updateLineNumbers(file);
    
    // Update cursor position for active editor
    const activeEditor = document.querySelector(`#${file} .code-area`);
    if (activeEditor) {
      updateCursorPosition(activeEditor);
    }
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
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const runLine = document.createElement('div');
    runLine.className = 'terminal-line output';
    runLine.textContent = `[${time}] Preview updated`;
    terminal.appendChild(runLine);
    terminal.scrollTop = terminal.scrollHeight;
    
    // Mark files as clean
    Object.keys(state.fileDirty).forEach(file => {
      state.fileDirty[file] = false;
      const tab = document.querySelector(`.tab[data-file="${file}"]`);
      if (tab) tab.classList.remove('dirty');
    });
    
    showToast('Preview updated successfully', 'success');
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
  }
  
  function toggleBottomPanel() {
    state.bottomPanelVisible = !state.bottomPanelVisible;
    bottomPanel.classList.toggle('expanded', state.bottomPanelVisible);
    const toggleBtn = document.getElementById('toggleBottomPanel');
    toggleBtn.querySelector('i').className = state.bottomPanelVisible ? 
      'fas fa-chevron-down' : 'fas fa-chevron-up';
    
    showToast(`${state.bottomPanelVisible ? 'Showing' : 'Hiding'} bottom panel`, 'info');
  }
  
  function toggleSidebar() {
    state.sidebarExpanded = !state.sidebarExpanded;
    sidebar.classList.toggle('expanded', state.sidebarExpanded);
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
    // In a real app, this would save to a backend or localStorage
    localStorage.setItem('codeEditor_files', JSON.stringify(state.files));
    
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
  
  // Format code (simplified)
  function formatCode(type) {
    const editorMap = {
      'html': 'htmlCode',
      'css': 'cssCode',
      'js': 'jsCode'
    };
    
    const textarea = document.getElementById(editorMap[type]);
    if (textarea) {
      // Simple formatting - in a real app, use a proper formatter
      let value = textarea.value;
      
      // Basic indentation fix
      if (type === 'html') {
        value = value.replace(/></g, '>\n<');
      }
      
      textarea.value = value;
      textarea.dispatchEvent(new Event('input'));
      showToast(`${type.toUpperCase()} formatted`, 'success');
    }
  }
  
  function foldAll(type) {
    showToast(`Folding all ${type.toUpperCase()} code sections`, 'info');
  }
  
  // Resize functionality
  function startResizing(e) {
    isResizing = true;
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
    resizeHandle.classList.add('active');
  }
  
  function resize(e) {
    if (!isResizing) return;
    
    const totalWidth = window.innerWidth;
    const sidebarWidth = 60;
    const newPreviewWidth = totalWidth - e.clientX - sidebarWidth;
    
    if (newPreviewWidth > 300 && newPreviewWidth < totalWidth - 500) {
      previewPanel.style.width = `${newPreviewWidth}px`;
    }
  }
  
  function stopResizing() {
    isResizing = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResizing);
    resizeHandle.classList.remove('active');
  }
  
  // Status updates
  function updateStatus() {
    // Update error count (simulated)
    const errorCount = Math.random() > 0.7 ? 1 : 0;
    const errorStatus = document.getElementById('errorStatus');
    errorStatus.querySelector('span').textContent = `${errorCount} Error${errorCount !== 1 ? 's' : ''}`;
    errorStatus.querySelector('i').className = errorCount > 0 ? 
      'fas fa-exclamation-circle' : 'fas fa-check-circle';
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
    showToast
  };