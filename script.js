// Auth Module - script.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements with null checks
    const getElement = (id) => document.getElementById(id) || console.warn(`Element ${id} not found`);
    
    const authElements = {
        authButtons: getElement('authButtons'),
        userInfo: getElement('userInfo'),
        userInitial: getElement('userInitial'),
        userName: getElement('userName'),
        userEmail: getElement('userEmail'), // Added email field
        logoutBtn: getElement('logoutBtn'),
        userAvatar: getElement('userAvatar'),
        userProfile: getElement('userProfile'), // Optional wrapper element
        userInfo:getElement('userInfo')
        
    };

    // Check if required elements exist
    if (!authElements.authButtons || !authElements.userInfo) {
        console.warn('Essential auth elements not found in DOM');
        return;
    }

    // Auth Functions
    const auth = {
        // Check authentication status
        checkAuthStatus: function() {
            const token = localStorage.getItem('authToken');
            const user = localStorage.getItem('user');
            
            if (token) {
                this.showAuthenticatedUI(user);
                this.updateProtectedUI(true);
            } else {
                this.showUnauthenticatedUI();
                this.updateProtectedUI(false);
            }
        },

        // Show UI for authenticated users
        showAuthenticatedUI: function(user) {
            authElements.authButtons?.classList.add('hidden');
            authElements.userInfo?.classList.remove('hidden');
            
            try {
                const userData = user ? JSON.parse(user) : null;
                this.displayUserInfo(userData || {});
            } catch (e) {
                console.error('Error parsing user data:', e);
                this.displayDefaultUser();
            }
        },

        // Show UI for unauthenticated users
        showUnauthenticatedUI: function() {
            authElements.authButtons?.classList.remove('hidden');
            authElements.userInfo?.classList.add('hidden');
        },

        // Display user information
        displayUserInfo: function(userData) {
            // Name handling
            if (authElements.userName) {
                authElements.userName.textContent = userData.name || 'User';
            }
            
            // Initial/avatar handling
            if (authElements.userInitial) {
                const initial = userData.name ? userData.name.charAt(0).toUpperCase() : 'U';
                authElements.userInitial.textContent = initial;
            }
            
            // Avatar image handling
            if (authElements.userAvatar) {
                if (userData.avatar) {
                    authElements.userAvatar.style.backgroundImage = `url(${userData.avatar})`;
                    authElements.userAvatar.classList.add('has-image');
                    if (authElements.userInitial) {
                        authElements.userInitial.style.display = 'none';
                    }
                } else {
                    authElements.userAvatar.style.backgroundImage = '';
                    authElements.userAvatar.classList.remove('has-image');
                    if (authElements.userInitial) {
                        authElements.userInitial.style.display = 'flex';
                    }
                }
            }
            
            // Email handling (new)
            if (authElements.userEmail) {
                authElements.userEmail.textContent = userData.email || '';
                authElements.userEmail.style.display = userData.email ? 'block' : 'none';
            }
        },

        // Update protected UI elements
        updateProtectedUI: function(isAuthenticated) {
            // Example: Toggle protected content visibility
            document.querySelectorAll('[data-protected]').forEach(el => {
                el.style.display = isAuthenticated ? 'block' : 'none';
            });
            
            // Example: Toggle unprotected content
            document.querySelectorAll('[data-unprotected]').forEach(el => {
                el.style.display = isAuthenticated ? 'none' : 'block';
            });
        },

        // Logout function
        logout: function() {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            
            // Dispatch auth change event
            document.dispatchEvent(new CustomEvent('authChange', {
                detail: { isAuthenticated: false }
            }));
            
            // Update UI immediately
            this.checkAuthStatus();
            
            // Optional: Redirect to home page or login
            // window.location.href = '/login.html';
        },

        // Initialize event listeners
        initEventListeners: function() {
            // Logout button
            authElements.logoutBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
            
               // UserInfo click handler
    authElements.userInfo?.addEventListener('click', (e) => {
        e.preventDefault();
       
        window.location.href = 'src/auth/userProfile/index.html';

        // Add your action here
    });
            // Storage changes (multi-tab sync)
            window.addEventListener('storage', (event) => {
                if (['authToken', 'user'].includes(event.key)) {
                    this.checkAuthStatus();
                }
            });
            
            // Custom auth events
            document.addEventListener('authChange', () => this.checkAuthStatus());
            
            // Optional: Click handler for user profile
            authElements.userProfile?.addEventListener('click', () => {
                // Open user profile modal or dropdown
            });
        }
    };

    // Initialize authentication system
    auth.initEventListeners();
    auth.checkAuthStatus();

    // Make auth functions available globally if needed
    window.auth = auth;

    // Optional: Expose for debugging
    if (typeof console !== 'undefined') {
        console.debug('Auth module initialized', auth);
    }
});