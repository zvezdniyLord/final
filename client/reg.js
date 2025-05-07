document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const messageBox = document.getElementById('message'); // Div to show success/error
  const submitButton = registerForm.querySelector('.btn__product-submit');
  const btnText = submitButton.querySelector('.btn-text');
  const btnLoader = submitButton.querySelector('.btn-loader');

  // Optional: Password Strength Indicator Logic (Example)
  const passwordInput = document.getElementById('password');
  const strengthBar = document.querySelector('.strength-bar');
  const strengthText = document.querySelector('.strength-text');

  if (passwordInput && strengthBar && strengthText) {
      passwordInput.addEventListener('input', () => {
          const password = passwordInput.value;
          let strength = 0;
          let text = 'Слабый';
          let barClass = 'weak';

          if (password.length >= 6) strength++;
          if (password.length >= 8) strength++;
          if (/[A-Z]/.test(password)) strength++;
          if (/[0-9]/.test(password)) strength++;
          if (/[^A-Za-z0-9]/.test(password)) strength++; // Special char

          const percentage = (strength / 5) * 100;
          strengthBar.style.width = `${percentage}%`;

          if (strength <= 1) { text = 'Слабый'; barClass = 'weak'; }
          else if (strength <= 3) { text = 'Средний'; barClass = 'medium'; }
          else { text = 'Сильный'; barClass = 'strong'; }

          strengthBar.className = `strength-bar ${barClass}`; // Reset and apply class
          strengthText.textContent = text;
      });
  }


  if (registerForm) {
      registerForm.addEventListener('submit', async (event) => {
          event.preventDefault(); // Prevent default form submission

          // Show loader, hide text
          btnText.style.display = 'none';
          btnLoader.classList.remove('hidden');
          submitButton.disabled = true;
          messageBox.textContent = ''; // Clear previous messages
          messageBox.className = 'message-box'; // Reset class

          // --- Collect Form Data ---
          const formData = {
              email: document.getElementById('email').value,
              fio: document.getElementById('fio').value,
              password_hash: document.getElementById('password').value,
              position: document.getElementById('position').value,
              company: document.getElementById('company').value,
              activity: document.getElementById('activitySphere').value,
              city: document.getElementById('city').value,
              phone: document.getElementById('phone').value,
          };

          // --- Send Data to Backend ---
          try {
              const response = await fetch('http://localhost:5003/api/register', { // URL of your backend endpoint
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json', // Tell the server we're sending JSON
                  },
                  body: JSON.stringify(formData), // Convert JS object to JSON string
              });

              const result = await response.json(); // Parse the JSON response from the server

              if (response.ok) { // Status code 200-299
                  messageBox.textContent = result.message || 'Регистрация прошла успешно!';
                  messageBox.classList.add('success');
                  registerForm.reset(); // Clear the form on success
                  // Optionally redirect or perform other actions
              } else {
                  // Handle errors (4xx, 5xx)
                  messageBox.textContent = result.message || 'Произошла ошибка при регистрации.';
                  messageBox.classList.add('error');
              }

          } catch (error) {
              // Handle network errors or issues reaching the server
              console.error('Registration fetch error:', error);
              messageBox.textContent = 'Не удалось связаться с сервером. Попробуйте позже.';
              messageBox.classList.add('error');
          } finally {
              // Hide loader, show text
              btnText.style.display = 'inline';
              btnLoader.classList.add('hidden');
              submitButton.disabled = false;
          }
      });
  } else {
      console.error("Register form not found");
  }
});

// Add some basic CSS for message boxes (add to your stylesheet)
/*
.message-box {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
  font-weight: bold;
}
.message-box.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}
.message-box.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

// CSS for password strength indicator
.password-strength {
  margin-top: 5px;
  height: 10px;
  background-color: #eee;
  border-radius: 5px;
  overflow: hidden;
  position: relative; /* For text positioning */
/* }

.strength-bar {
  height: 100%;
  width: 0;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: 5px;
}

.strength-bar.weak { background-color: #dc3545; }
.strength-bar.medium { background-color: #ffc107; }
.strength-bar.strong { background-color: #28a745; }

.strength-text {
  font-size: 0.75em;
  color: #555;
  position: absolute;
  right: 5px;
  top: -2px; /* Adjust as needed */
/* }

// Loader styles
.btn-loader.hidden {
  display: none;
}
.btn-loader {
  display: inline-block; // Or flex/grid as needed
  vertical-align: middle;
}
.loader-circle {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  width: 16px;
  height: 16px;
  animation: spin 1s ease-in-out infinite;
  margin: 0 auto; // Center if needed within its container
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
*/
