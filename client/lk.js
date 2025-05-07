document.addEventListener('DOMContentLoaded', function() {
    // Проверяем наличие токена
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = './auth.html';
        return;
    }

    const accountForm = document.getElementById('accountForm');
    const profileDataDiv = document.getElementById('profileData');

    // Функция для загрузки данных профиля
    async function loadProfileData() {
        try {
            const response = await fetch('http://localhost:5003/api/user/profile', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('userInfo');
                window.location.href = './auth.html';
                return;
            }

            const result = await response.json();

            if (response.ok) {
                const user = result.userData;

                // Заполняем форму данными пользователя
                if (accountForm) {
                    // Находим все поля формы
                    const fioInput = accountForm.querySelector('input[name="fio"]');
                    const phoneInput = accountForm.querySelector('input[name="password"]'); // Судя по placeholder, это телефон
                    const passwordInput = accountForm.querySelector('input[name="company"]'); // Судя по placeholder, это пароль
                    const companyInput = accountForm.querySelector('input[name="activity_sphere"]'); // Судя по placeholder, это компания
                    const positionInput = accountForm.querySelector('input[name="position"]');
                    const emailInput = accountForm.querySelector('input[placeholder="email"]');
                    const cityInput = accountForm.querySelector('input[name="city"]');

                    // Заполняем поля данными
                    if (fioInput) fioInput.value = user.fio || '';
                    if (phoneInput) phoneInput.value = user.phone || '';
                    if (passwordInput) passwordInput.value = ''; // Пароль не отображаем
                    if (companyInput) companyInput.value = user.company || '';
                    if (positionInput) positionInput.value = user.position || '';
                    if (emailInput) {
                        emailInput.value = user.email || '';
                        emailInput.disabled = true; // Делаем email неизменяемым
                    }
                    if (cityInput) cityInput.value = user.city || '';
                }

                // Отображаем данные профиля (если есть div для этого)
                if (profileDataDiv) {
                    profileDataDiv.innerHTML = `
                        <div class="profile-card">
                            <h2>Профиль пользователя</h2>
                            <div class="profile-info">
                                <p><strong>ФИО:</strong> ${user.fio || 'Не указано'}</p>
                                <p><strong>Email:</strong> ${user.email || 'Не указано'}</p>
                                <p><strong>Должность:</strong> ${user.position || 'Не указано'}</p>
                                <p><strong>Компания:</strong> ${user.company || 'Не указано'}</p>
                                <p><strong>Сфера деятельности:</strong> ${user.activity_sphere || 'Не указано'}</p>
                                <p><strong>Город:</strong> ${user.city || 'Не указано'}</p>
                                <p><strong>Телефон:</strong> ${user.phone || 'Не указано'}</p>
                            </div>
                        </div>
                    `;
                }

                // Обновляем userInfo в localStorage
                localStorage.setItem('userInfo', JSON.stringify({
                    id: user.id,
                    email: user.email,
                    fio: user.fio
                }));
            } else {
                if (profileDataDiv) {
                    profileDataDiv.innerHTML = `<p class="error-message">Не удалось загрузить профиль: ${result.message || 'Неизвестная ошибка'}</p>`;
                }
            }
        } catch (error) {
            console.error('Error fetching profile data:', error);
            if (profileDataDiv) {
                profileDataDiv.innerHTML = '<p class="error-message">Ошибка сети при загрузке профиля. Попробуйте обновить страницу.</p>';
            }
        }
    }

    // Загружаем данные профиля при загрузке страницы
    loadProfileData();

    // Обработчик отправки формы
    if (accountForm) {
        accountForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            // Находим кнопку отправки
            const submitButton = accountForm.querySelector('.btn-save-data');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Сохранение...';
            }

            // Собираем данные из формы
            const formData = {
                fio: accountForm.querySelector('input[name="fio"]')?.value,
                phone: accountForm.querySelector('input[name="password"]')?.value, // Судя по placeholder, это телефон
                password: accountForm.querySelector('input[name="company"]')?.value, // Судя по placeholder, это пароль
                company: accountForm.querySelector('input[name="enviroment"]')?.value, // Судя по placeholder, это компания
                position: accountForm.querySelector('input[name="position"]')?.value,
                city: accountForm.querySelector('input[name="city"]')?.value,
                activity_sphere: accountForm.querySelector('input[name="activity_sphere"]')?.value || undefined
            };

            // Удаляем пустые поля
            Object.keys(formData).forEach(key => {
                if (formData[key] === '' || formData[key] === undefined) {
                    delete formData[key];
                }
            });

            try {
                const response = await fetch('http://localhost:5003/api/user/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();

                if (response.ok) {
                    // Показываем сообщение об успехе
                    alert('Профиль успешно обновлен');

                    // Обновляем данные профиля на странице
                    loadProfileData();

                    // Обновляем userInfo в localStorage, если изменилось ФИО
                    if (formData.fio) {
                        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                        userInfo.fio = formData.fio;
                        localStorage.setItem('userInfo', JSON.stringify(userInfo));
                    }
                } else {
                    // Показываем сообщение об ошибке
                    alert(`Ошибка: ${result.message || 'Не удалось обновить профиль'}`);
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('Ошибка сети при обновлении профиля. Попробуйте еще раз.');
            } finally {
                // Восстанавливаем кнопку
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Сохранить изменения';
                }
            }
        });
    }
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();

            try {
                const token = localStorage.getItem('token');
                if (token) {
                    const response = await fetch('/api/logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        console.log('Logout successful on server');
                    } else {
                        console.warn('Logout failed on server');
                    }
                }
            } catch (error) {
                console.error('Logout fetch error:', error);
            } finally {
                // Очищаем данные авторизации в любом случае
                localStorage.removeItem('token');
                localStorage.removeItem('userInfo');

                // Устанавливаем флаг выхода
                sessionStorage.setItem('loggedOut', 'true');

                // Определяем базовый путь
                const isInSubfolder = window.location.pathname.split('/').length > 2;
                const basePath = isInSubfolder ? '../' : './';

                // Перенаправляем на страницу входа
                window.location.href = `${basePath}auth.html`;
            }
        });
    }
});
