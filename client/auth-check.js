// auth-check.js
(function() {
    // Проверяем, был ли только что выполнен выход
    const justLoggedOut = sessionStorage.getItem('justLoggedOut');

    if (justLoggedOut === 'true') {
        // Если да, то мы находимся на странице, куда нас перенаправили после выхода (например, auth.html).
        // Сбрасываем флаг, чтобы при следующем обычном заходе на сайт проверка работала.
        sessionStorage.removeItem('justLoggedOut');
        // Ничего больше не делаем, остаемся на текущей странице (auth.html или index.html)
        return;
    }

    // Если выхода только что не было, проверяем токен
    const token = localStorage.getItem('token');
    if (!token) {
        // Токена нет, пользователь не авторизован
        const currentPage = window.location.pathname + window.location.search; // Сохраняем текущий URL с параметрами
        localStorage.setItem('redirectAfterLogin', currentPage);

        // Определяем базовый путь для корректного редиректа из подпапок
        const pathSegments = window.location.pathname.split('/');
        const depth = pathSegments.length - 2; // -1 за имя файла, -1 за первый слеш
        const basePath = depth > 0 ? '../'.repeat(depth) : './';

        //window.location.href = `${basePath}auth.html`; // Перенаправляем на страницу входа
        window.location.href = 'auth.html'
    }
    // Если токен есть, скрипт просто завершается, и страница загружается
})();
