// toast.js - Common Toast Notification Component
class Toast {
  static show(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => {
        toast.remove();
        // Remove container if no more toasts
        if (toastContainer.children.length === 0) {
          toastContainer.remove();
        }
      });
    }, duration);
  }

  // Shortcut methods
  static success(message, duration = 3000) {
    this.show(message, 'success', duration);
  }

  static error(message, duration = 3000) {
    this.show(message, 'error', duration);
  }

  static info(message, duration = 3000) {
    this.show(message, 'info', duration);
  }

  static warning(message, duration = 3000) {
    this.show(message, 'warning', duration);
  }
}

// Add CSS styles (can be moved to external CSS if preferred)
const addToastStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
  .toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .toast {
    min-width: 250px;
    padding: 15px;
    border-radius: 4px;
    color: white;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    animation: slideIn 0.5s forwards;
  }

  .toast-success {
    background-color: #4CAF50;
  }

  .toast-error {
    background-color: #F44336;
  }

  .toast-info {
    background-color: #2196F3;
  }

  .toast-warning {
    background-color: #FF9800;
  }

  .fade-out {
    animation: fadeOut 0.5s forwards !important;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  `;
  document.head.appendChild(style);
};

// Initialize styles when loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addToastStyles);
} else {
  addToastStyles();
}

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Toast;
}