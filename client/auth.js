document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const messageBox = document.getElementById('authMessage');
    const submitButton = loginForm.querySelector('.btn__auth-enter');

    // Проверяем, авторизован ли пользователь
    const token = localStorage.getItem('token');
    if (token) {
        // Если токен есть, перенаправляем на страницу личного кабинета
        window.location.href = 'lk.html';
        return;
    }

    if (!loginForm || !emailInput || !passwordInput || !messageBox || !submitButton) {
        console.error('Essential login form elements not found!');
        if(messageBox) messageBox.textContent = "Ошибка инициализации формы.";
        return;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        messageBox.textContent = '';
        messageBox.className = '';
        submitButton.disabled = true;
        submitButton.textContent = 'Вход...';

        if (!email || !password) {
            messageBox.textContent = 'Введите email и пароль.';
            messageBox.className = 'error-message';
            submitButton.disabled = false;
            submitButton.textContent = 'Войти';
            return;
        }

        try {
            const response = await fetch('http://localhost:5003/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();

            if (response.ok) { // Статус 200 - Успех
                messageBox.textContent = result.message || 'Вход выполнен успешно!';
                messageBox.className = 'success-message';

                // Сохраняем токен и информацию о пользователе в localStorage
                localStorage.setItem('token', result.token);
                localStorage.setItem('userInfo', JSON.stringify(result.user));

                // Перенаправляем в ЛК
                setTimeout(() => {
                    window.location.href = 'lk.html';
                }, 500);

            } else { // Ошибка (4xx, 5xx)
                messageBox.textContent = result.message || 'Произошла ошибка входа.';
                messageBox.className = 'error-message';
                submitButton.disabled = false;
                submitButton.textContent = 'Войти';
                localStorage.removeItem('token');
                localStorage.removeItem('userInfo');
            }

        } catch (error) {
            console.error('Login fetch error:', error);
            messageBox.textContent = 'Не удалось связаться с сервером. Проверьте подключение.';
            messageBox.className = 'error-message';
            submitButton.disabled = false;
            submitButton.textContent = 'Войти';
            localStorage.removeItem('token');
            localStorage.removeItem('userInfo');
        }
    });
});
