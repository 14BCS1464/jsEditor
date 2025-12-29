class JSONEditor {
  constructor() {
    this.elements = {
      input: document.getElementById('input'),
      treeView: document.getElementById('treeView'),
      urlInput: document.getElementById('urlInput'),
      loadBtn: document.getElementById('loadBtn'),
      beautifyBtn: document.getElementById('beautifyBtn'),
      minifyBtn: document.getElementById('minifyBtn'),
      copyBtn: document.getElementById('copyBtn'),
      clearBtn: document.getElementById('clearBtn'),
      exampleBtn: document.getElementById('exampleBtn'),
      expandAllBtn: document.getElementById('expandAllBtn'),
      collapseAllBtn: document.getElementById('collapseAllBtn'),
      themeToggle: document.getElementById('themeToggle'),
      languageList: document.getElementById('languageList'),
      status: document.getElementById('status'),
      resizer: document.getElementById('resizer')
    };

    this.init();
  }

  init() {
    // Event listeners
    this.elements.input.addEventListener('input', () => this.updateTreeView());
    this.elements.loadBtn.addEventListener('click', () => this.loadFromURL());
    this.elements.beautifyBtn.addEventListener('click', () => this.beautify());
    this.elements.minifyBtn.addEventListener('click', () => this.minify());
    this.elements.copyBtn.addEventListener('click', () => this.copyToClipboard());
    this.elements.clearBtn.addEventListener('click', () => this.clearInput());
    this.elements.exampleBtn.addEventListener('click', () => this.loadExample());
    this.elements.expandAllBtn.addEventListener('click', () => this.expandAll());
    this.elements.collapseAllBtn.addEventListener('click', () => this.collapseAll());
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    this.elements.languageList.addEventListener('click', (e) => this.selectLanguage(e));
    this.elements.urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.loadFromURL();
    });

    // Resizer functionality
    this.initResizer();

    // Initial update
    this.updateTreeView();
  }

  updateStatus(message, type = 'success') {
    this.elements.status.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' :
        type === 'error' ? 'exclamation-circle' :
          'info-circle'}"></i>
            <span>${message}</span>
        `;
    this.elements.status.className = `status ${type}`;
  }

  updateTreeView() {
    try {
      const input = this.elements.input.value.trim();
      if (!input) {
        this.elements.treeView.innerHTML = '<div class="tree-node"><em>Enter JSON to see tree view</em></div>';
        return;
      }

      const parsed = JSON.parse(input);
      this.elements.treeView.innerHTML = this.createTreeHTML(parsed, 'root');
      this.addTreeEventListeners();
      this.updateStatus('Valid JSON - Tree view updated', 'success');
    } catch (error) {
      this.elements.treeView.innerHTML = `
                <div class="tree-node" style="color: var(--error);">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${error.message}
                </div>
            `;
      this.updateStatus(`Invalid JSON: ${error.message}`, 'error');
    }
  }

  createTreeHTML(data, key = '', depth = 0) {
    const type = typeof data;
    const isArray = Array.isArray(data);
    const isObject = type === 'object' && data !== null && !isArray;

    let html = '<div class="tree-node">';
    html += '<div class="tree-node-content">';

    if (isObject || isArray) {
      const count = isArray ? data.length : Object.keys(data).length;
      const icon = isArray ? 'fa-list' : 'fa-object-group';
      html += `
                <span class="tree-toggle">
                    <i class="fas fa-chevron-right"></i>
                </span>
                <span class="tree-key">${key}</span>
                <span class="tree-colon">:</span>
                <span class="tree-value">
                    <i class="fas ${icon}"></i>
                    ${isArray ? '[' : '{'} ${count} items ${isArray ? ']' : '}'}
                </span>
            `;

      html += '</div>';
      html += `<div class="tree-children">`;

      if (isArray) {
        data.forEach((item, index) => {
          html += this.createTreeHTML(item, index, depth + 1);
        });
      } else if (isObject) {
        Object.entries(data).forEach(([childKey, value]) => {
          html += this.createTreeHTML(value, childKey, depth + 1);
        });
      }

      html += '</div>';
    } else {
      let valueClass = 'tree-value';
      let displayValue = data;

      if (type === 'string') {
        valueClass += ' string';
        displayValue = `"${data}"`;
      } else if (type === 'number') {
        valueClass += ' number';
      } else if (type === 'boolean') {
        valueClass += ' boolean';
        displayValue = data ? 'true' : 'false';
      } else if (data === null) {
        valueClass += ' null';
        displayValue = 'null';
      }

      html += `
                <span class="tree-key">${key}</span>
                <span class="tree-colon">:</span>
                <span class="${valueClass}">${displayValue}</span>
            `;
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  addTreeEventListeners() {
    const toggleElements = this.elements.treeView.querySelectorAll('.tree-toggle');
    toggleElements.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const children = toggle.parentElement.nextElementSibling;
        const icon = toggle.querySelector('i');

        if (children.classList.contains('expanded')) {
          children.classList.remove('expanded');
          icon.className = 'fas fa-chevron-right';
        } else {
          children.classList.add('expanded');
          icon.className = 'fas fa-chevron-down';
        }
      });
    });

    // Add click to copy functionality
    const nodeContents = this.elements.treeView.querySelectorAll('.tree-node-content');
    nodeContents.forEach(node => {
      node.addEventListener('click', (e) => {
        if (!e.target.closest('.tree-toggle')) {
          const key = node.querySelector('.tree-key')?.textContent;
          const value = node.querySelector('.tree-value')?.textContent;

          let textToCopy = key ? `${key}: ${value}` : value;
          navigator.clipboard.writeText(textToCopy).then(() => {
            const originalHTML = node.innerHTML;
            node.innerHTML = `<i class="fas fa-check"></i> Copied!`;
            setTimeout(() => {
              node.innerHTML = originalHTML;
            }, 1500);
          });
        }
      });
    });
  }

  async loadFromURL() {
    const url = this.elements.urlInput.value.trim();
    if (!url) {
      this.updateStatus('Please enter a URL', 'error');
      return;
    }

    this.updateStatus('Loading JSON...', 'warning');

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.elements.input.value = JSON.stringify(data, null, 2);
      this.updateTreeView();
      this.updateStatus(`Loaded from ${new URL(url).hostname}`, 'success');

      // Add pulse animation to input
      this.elements.input.style.animation = 'pulse 1s';
      setTimeout(() => this.elements.input.style.animation = '', 1000);
    } catch (error) {
      this.updateStatus(`Failed to load: ${error.message}`, 'error');
    }
  }

  beautify() {
    try {
      const parsed = JSON.parse(this.elements.input.value);
      this.elements.input.value = JSON.stringify(parsed, null, 2);
      this.updateTreeView();
      this.updateStatus('JSON beautified', 'success');
    } catch (error) {
      this.updateStatus('Invalid JSON', 'error');
    }
  }

  minify() {
    try {
      const parsed = JSON.parse(this.elements.input.value);
      this.elements.input.value = JSON.stringify(parsed);
      this.updateTreeView();
      this.updateStatus('JSON minified', 'success');
    } catch (error) {
      this.updateStatus('Invalid JSON', 'error');
    }
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.elements.input.value);
      this.elements.copyBtn.innerHTML = '<i class="fas fa-check"></i>';
      this.elements.copyBtn.classList.add('pulse');
      this.updateStatus('Copied to clipboard!', 'success');

      setTimeout(() => {
        this.elements.copyBtn.innerHTML = '<i class="far fa-copy"></i>';
        this.elements.copyBtn.classList.remove('pulse');
      }, 2000);
    } catch (error) {
      this.updateStatus('Failed to copy', 'error');
    }
  }

  clearInput() {
    this.elements.input.value = '';
    this.updateTreeView();
    this.updateStatus('Input cleared', 'warning');
  }

  loadExample() {
    const examples = [
      `{
  "company": "Tech Corp",
  "employees": 150,
  "departments": ["Engineering", "Design", "Marketing"],
  "metrics": {
    "revenue": 2500000,
    "growth": 15.5,
    "active": true
  }
}`,
      `{
  "products": [
    {
      "id": 1,
      "name": "Laptop",
      "price": 999.99,
      "inStock": true
    },
    {
      "id": 2,
      "name": "Mouse",
      "price": 29.99,
      "inStock": false
    }
  ]
}`,
      `{
  "user": {
    "profile": {
      "name": "Alice",
      "preferences": {
        "theme": "dark",
        "notifications": {
          "email": true,
          "push": false
        }
      }
    }
  }
}`
    ];

    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    this.elements.input.value = randomExample;
    this.updateTreeView();
    this.updateStatus('Example loaded - Click nodes to copy!', 'success');
  }

  expandAll() {
    const children = this.elements.treeView.querySelectorAll('.tree-children');
    const icons = this.elements.treeView.querySelectorAll('.tree-toggle i');

    children.forEach(child => child.classList.add('expanded'));
    icons.forEach(icon => icon.className = 'fas fa-chevron-down');
    this.updateStatus('All nodes expanded', 'success');
  }

  collapseAll() {
    const children = this.elements.treeView.querySelectorAll('.tree-children');
    const icons = this.elements.treeView.querySelectorAll('.tree-toggle i');

    children.forEach(child => child.classList.remove('expanded'));
    icons.forEach(icon => icon.className = 'fas fa-chevron-right');
    this.updateStatus('All nodes collapsed', 'success');
  }

  toggleTheme() {
    const icon = this.elements.themeToggle.querySelector('i');
    document.body.classList.toggle('light-mode');

    if (document.body.classList.contains('light-mode')) {
      icon.className = 'fas fa-sun';
      this.updateStatus('Light mode activated', 'success');
    } else {
      icon.className = 'fas fa-moon';
      this.updateStatus('Dark mode activated', 'success');
    }
  }

  selectLanguage(event) {

    const li = event.target.closest('li');

    if (!li) return;

    const language = li.dataset.lang;

    switch (language) {
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
        window.location.href = "/src/jsonformatter/index.html";
        break;

      default:
        console.warn(`No runner defined for ${lang}`);
    }

  }

  initResizer() {
    const leftPanel = document.getElementById('leftPanel');
    const container = document.querySelector('.container');
    let isResizing = false;

    this.elements.resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const startX = e.clientX;
      const startWidth = leftPanel.offsetWidth;

      function onMouseMove(e) {
        if (!isResizing) return;
        const dx = e.clientX - startX;
        const newWidth = Math.max(200, Math.min(startWidth + dx, container.offsetWidth - 200));
        leftPanel.style.width = `${newWidth}px`;
      }

      function onMouseUp() {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
}

// Initialize the editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new JSONEditor();
});