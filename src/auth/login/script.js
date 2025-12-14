// DOM Elements
const loginForm = document.querySelector('.login-container form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginButton = document.querySelector('.login-button');

// API Configuration
const API_BASE_URL = 'http://localhost:3000/api/auth'; // Replace with your actual API endpoint

// Form Validation
function validateForm() {
    let isValid = true;
    
    // Reset error states
    document.querySelectorAll('.error').forEach(el => el.remove());
    document.querySelectorAll('.input-group input').forEach(input => {
        input.classList.remove('error-border');
    });

    // Username validation
    if (!usernameInput || !usernameInput.value.trim()) {
        showError(usernameInput, 'Username or email is required');
        isValid = false;
    }

    // Password validation
    if (!passwordInput || !passwordInput.value.trim()) {
        showError(passwordInput, 'Password is required');
        isValid = false;
    } else if (passwordInput.value.length < 6) {
        showError(passwordInput, 'Password must be at least 6 characters');
        isValid = false;
    }

    return isValid;
}

function showError(input, message) {
    if (!input) return;
    
    const inputGroup = input.closest('.input-group');
    
    if (!inputGroup) {
        console.error('Parent input-group not found for input:', input);
        return;
    }
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error';
    errorElement.style.color = 'red';
    errorElement.style.marginTop = '5px';
    errorElement.style.fontSize = '14px';
    errorElement.textContent = message;
    
    inputGroup.appendChild(errorElement);
    input.classList.add('error-border');
}

// Add CSS for error state
const style = document.createElement('style');
style.textContent = `
    .error-border {
        border-color: #ff3860 !important;
    }
`;
document.head.appendChild(style);

// API Request
async function loginUser(credentials) {
  
    try {

        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';
        
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        
        alert(JSON.stringify(data))
        handleSuccessfulLogin(data);
    } catch (error) {
        // Show error on form level
        const formError = document.createElement('div');
        formError.className = 'error';
        formError.style.color = 'red';
        formError.style.marginTop = '10px';
        formError.style.fontSize = '14px';
        formError.textContent = error.message || 'An error occurred during login';
      
        if (loginForm) {
            loginForm.insertAdjacentElement('afterbegin', formError);
        }
        
        console.error('Login error:', error);
        alert('Error: ' + error.message);
    } finally {
        // Reset button state
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    }
}

function handleSuccessfulLogin(data) {
    
  
    localStorage.setItem('authToken', data.token);

    if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    setTimeout(() => {
        window.location.href = '/index.html';
    }, 200); 
   
}

// Form Submission
document.addEventListener('DOMContentLoaded', () => {
    if (!loginForm) {
        console.error('Login form not found on page');
        return;
    }
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
       
        document.querySelectorAll('.error').forEach(el => el.remove());
        
        if (validateForm()) {
            const credentials = {
                email: usernameInput.value.trim(),
                password: passwordInput.value
            };
            
            await loginUser(credentials);
        }
    });

    // Input field validation on blur
    if (usernameInput) {
        usernameInput.addEventListener('blur', () => {
            // Remove existing errors first
            const parent = usernameInput.closest('.input-group');
            if (parent) {
                parent.querySelectorAll('.error').forEach(el => el.remove());
            }
            usernameInput.classList.remove('error-border');
            
            if (!usernameInput.value.trim()) {
                showError(usernameInput, 'Username or email is required');
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('blur', () => {
            // Remove existing errors first
            const parent = passwordInput.closest('.input-group');
            if (parent) {
                parent.querySelectorAll('.error').forEach(el => el.remove());
            }
            passwordInput.classList.remove('error-border');
            
            if (!passwordInput.value.trim()) {
                showError(passwordInput, 'Password is required');
            } else if (passwordInput.value.length < 6) {
                showError(passwordInput, 'Password must be at least 6 characters');
            }
        });
    }
});