document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signupForm');
  
    signupForm.addEventListener('submit', function(e) {
      e.preventDefault();
  
      // Get text inputs
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const terms = document.getElementById('terms').checked;
  
      // Get radio button values helper
      function getRadioValue(name) {
        const radios = document.getElementsByName(name);
        for (const radio of radios) {
          if (radio.checked) return radio.value;
        }
        return '';
      }
  
      // Get checkbox values helper
      function getCheckboxValues(name) {
        const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
        return Array.from(checkboxes).map(cb => cb.value);
      }
  
      // Get all radio group values
      const gender = getRadioValue('gender');
      const experience = getRadioValue('experience');
      const workType = getRadioValue('workType');
      const technicalSkill = getRadioValue('technicalSkill');
      const experienceYears = getRadioValue('experienceYears');
      const interviewRole = getRadioValue('interviewRole');
      const languages = getCheckboxValues('languages');
  
      // Optional fields
      const jobTitle = document.getElementById('jobTitle').value.trim();
      const linkedin = document.getElementById('linkedin').value.trim();
      const github = document.getElementById('github').value.trim();
  
      clearErrors();
  
      let isValid = true;
  
      if (name === '') {
        showError('name', 'Name is required');
        isValid = false;
      }
  
      if (email === '') {
        showError('email', 'Email is required');
        isValid = false;
      } else if (!isValidEmail(email)) {
        showError('email', 'Please enter a valid email');
        isValid = false;
      }
  
      if (password === '') {
        showError('password', 'Password is required');
        isValid = false;
      } else if (password.length < 8) {
        showError('password', 'Password must be at least 8 characters');
        isValid = false;
      }
  
      if (confirmPassword === '') {
        showError('confirmPassword', 'Please confirm your password');
        isValid = false;
      } else if (password !== confirmPassword) {
        showError('confirmPassword', 'Passwords do not match');
        isValid = false;
      }
  
      // Validate all required radio groups
      if (gender === '') {
        showErrorRadio('gender', 'Please select your gender');
        isValid = false;
      }
  
      if (experience === '') {
        showErrorRadio('experience', 'Please select your work experience level');
        isValid = false;
      }
  
      if (workType === '') {
        showErrorRadio('workType', 'Please select your work type');
        isValid = false;
      }
  
      if (technicalSkill === '') {
        showErrorRadio('technicalSkill', 'Please select your primary technical skill');
        isValid = false;
      }
  
      if (experienceYears === '') {
        showErrorRadio('experienceYears', 'Please select your years of experience');
        isValid = false;
      }
  
      if (interviewRole === '') {
        showErrorRadio('interviewRole', 'Please select your preferred interview role');
        isValid = false;
      }
  
      if (!terms) {
        showErrorCheckbox('terms', 'You must accept the terms and conditions');
        isValid = false;
      }
  
      if (isValid) {
        const payload = {
          name,
          email,
          password,
          gender,
          workExperience: experience,
          workType,
          technicalSkill,
          experienceYears,
          interviewRole,
          languages,
          jobTitle,
          linkedin,
          github,
        };
  
        fetch('http://localhost:3000/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
        .then(response => {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return response.json().then(data => {
              if (!response.ok) {
                throw new Error(data.message || 'Signup failed');
              }
              return data;
            });
          } else {
            return response.text().then(text => {
              throw new Error(response.ok ? text : `Server error (${response.status})`);
            });
          }
        })
        .then(data => {
          console.log('Signup success:', data);
          handleSuccessfulLogin(data);
          const successMessage = document.createElement('div');
          successMessage.className = 'success-message';
          successMessage.textContent = 'Account created successfully! Redirecting...';
          signupForm.parentNode.insertBefore(successMessage, signupForm.nextSibling);
          signupForm.reset();
  
          setTimeout(() => {
            window.location.href = '/index.html';
          }, 200);
        })
        .catch(error => {
          console.error('Error:', error);
          alert('Error: ' + error.message);
        });
      }
    });
  
    function handleSuccessfulLogin(data) {
      localStorage.setItem('authToken', data.token);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    }
  
    function isValidEmail(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
    }
  
    // Show error for inputs
    function showError(fieldId, message) {
      const field = document.getElementById(fieldId);
      const formGroup = field.closest('.form-group');
  
      let errorElement = formGroup.querySelector('.error-message');
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        formGroup.appendChild(errorElement);
      }
  
      field.style.borderColor = 'var(--error-color)';
      field.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';
  
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  
    // Show error for radio groups
    function showErrorRadio(name, message) {
      const radios = document.getElementsByName(name);
      if (radios.length === 0) return;
  
      // Append error message to the parent of the first radio input
      const formGroup = radios[0].closest('.form-group');
      if (!formGroup) return;
  
      let errorElement = formGroup.querySelector('.error-message');
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        formGroup.appendChild(errorElement);
      }
  
      // Style radios - add red outline to all radios' labels
      radios.forEach(radio => {
        const label = radio.parentElement;
        if (label) {
          label.style.color = 'var(--error-color)';
        }
      });
  
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  
    // Show error for checkbox (terms)
    function showErrorCheckbox(id, message) {
      const checkbox = document.getElementById(id);
      const formGroup = checkbox.closest('.form-group');
  
      let errorElement = formGroup.querySelector('.error-message');
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        formGroup.appendChild(errorElement);
      }
  
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  
    // Clear all errors and reset styles
    function clearErrors() {
      const errorMessages = document.querySelectorAll('.error-message');
      errorMessages.forEach(msg => {
        msg.style.display = 'none';
      });
  
      // Reset input styling
      const inputs = document.querySelectorAll('input, select, label');
      inputs.forEach(input => {
        input.style.borderColor = '';
        input.style.boxShadow = '';
        input.style.color = '';
      });
    }
  });
  