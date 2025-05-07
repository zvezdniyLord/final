require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser'); // <-- Добавлено
const cors = require('cors');
const helmet = require('helmet'); // <-- Добавлено
const rateLimit = require('express-rate-limit'); // <-- Добавлено
const {createProxyMiddleware} = require('http-proxy-middleware');
const multer = require('multer');
const fs = require('node:fs');
const path = require("node:path");
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';


const transporter = nodemailer.createTransport({
    host: 'smtp.elesy.ru',
    port: 465,
    secure: true,
    auth: {
        user: 'noreplyscadaint',
        pass: 'jfPIvUteG7$L~*BE'
    },
    tls: {
        rejectUnauthorized: false
    }
});

const supportEmail = 'davaa@elesy.ru'
const siteSenderEmail = 'scadaint.ru';

async function sendEmail(to, subject, text, html, options = {}) {
    try {
        let finalSubject = subject;
        // Добавляем номер заявки и/или ID треда в тему, если они есть и еще не добавлены
        if (options.ticketNumber && !finalSubject.includes(`[Ticket#${options.ticketNumber}]`)) {
            finalSubject = `${finalSubject} [Ticket#${options.ticketNumber}]`;
        }
        if (options.threadId && !finalSubject.includes(`[Thread#${options.threadId}]`)) {
            finalSubject = `${finalSubject} [Thread#${options.threadId}]`;
        }

        const mailOptions = {
            from: `"${options.fromName || 'Ваш Сайт ИНТ'}" <${siteSenderEmail}>`,
            to: to,
            subject: finalSubject,
            text: text,
            html: html,
            replyTo: options.replyTo || undefined,
            attachments: options.attachments || [],
            headers: {}
        };

        // Добавляем заголовки для правильной группировки писем в почтовых клиентах
        if (options.threadId) {
            // Можно использовать threadId как часть Message-ID для первого письма в треде,
            // но nodemailer обычно генерирует свой Message-ID.
            // Мы можем использовать threadId для заголовка X-Thread-ID или другого кастомного.
            mailOptions.headers['X-Thread-ID'] = options.threadId;

            if (options.inReplyToMessageId) {
                mailOptions.inReplyTo = options.inReplyToMessageId;
                // References: сначала старые ID, потом ID, на которое отвечаем
                mailOptions.references = options.references ? `${options.references} ${options.inReplyToMessageId}` : options.inReplyToMessageId;
            }
        }

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);

        // Опционально: сохраняем исходящее письмо в вашу таблицу 'emails'
        if (options.saveToDb !== false && pool) { // pool - это ваш экземпляр pg.Pool
            let client;
            try {
                client = await pool.connect();
                await client.query(
                    `INSERT INTO emails (thread_id, subject, body, from_email, is_outgoing, created_at, user_id)
                     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)`,
                    [
                        options.threadId || null, // Если нет threadId, можно оставить null или генерировать
                        finalSubject,
                        textBody, // Сохраняем текстовую версию
                        siteSenderEmail, // Отправитель - системный email
                        true, // is_outgoing = true
                        options.userIdForLog || null // ID пользователя, инициировавшего отправку, или null
                    ]
                );
                console.log(`Outgoing email (to: ${to}, subject: ${finalSubject}) logged to DB.`);
            } catch (dbError) {
                console.error('Error logging outgoing email to database:', dbError);
                // Не прерываем основной процесс из-за ошибки логирования
            } finally {
                if (client) client.release();
            }
        }

        return {
            messageId: info.messageId, // Это Message-ID, сгенерированный почтовым сервером
            threadId: options.threadId // Возвращаем переданный или сгенерированный threadId
        };

    } catch (error) {
        console.error(`Error sending email to ${to} with subject "${subject}":`, error);
        // Пробрасываем ошибку дальше, чтобы вызывающий код мог ее обработать
        // (например, показать пользователю сообщение об ошибке или записать в лог более подробно)
        throw error;
    }
}

app.use(helmet()); // Устанавливает безопасные HTTP заголовки

app.use(cors({
    origin: 'http://127.0.0.1:5500', // Разрешаем запросы ТОЛЬКО с вашего фронтенда
    credentials: true // Разрешаем отправку cookies и заголовков авторизации
}));


const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 10, // Максимум 10 запросов на вход/регистрацию с одного IP за 15 минут
    message: { message: 'Слишком много попыток входа/регистрации. Попробуйте позже.' },
    standardHeaders: true, // Возвращать информацию о лимитах в заголовках `RateLimit-*`
    legacyHeaders: false, // Отключить заголовки `X-RateLimit-*`
});
// Применяем лимитер к эндпоинтам входа и регистрации
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);


// --- Middleware ---
app.use(cookieParser()); // Парсер для cookies <-- Добавлено
app.use(express.json()); // Парсер для JSON тел запросов
app.use(express.urlencoded({ extended: true })); // Парсер для URL-encoded тел запросов

// --- Database Connection Pool ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Опции для production (если нужно)
    // ssl: isProduction ? { rejectUnauthorized: false } : false, // Пример для Heroku/Render
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('!!! DATABASE CONNECTION ERROR:', err.stack);
    }
    console.log('Connected to PostgreSQL database!');
    client.release();
});

// --- Вспомогательная функция для установки cookie ---
const sendTokenCookie = (res, token) => {
    const cookieOptions = {
        httpOnly: true, // <-- Главное: Cookie недоступна через JS
        secure: false, // <-- В production - только через HTTPS
        sameSite: 'Lax', // <-- Защита от CSRF ('Strict' еще безопаснее, но может ломать переходы)
        maxAge: parseInt(process.env.COOKIE_MAX_AGE || '3600000', 10),
        path: '/'
    };
    res.cookie('accessToken', token, cookieOptions); // Имя cookie - accessToken
};

// --- Middleware для проверки JWT из заголовка Authorization ---
const verifyToken = (req, res, next) => {
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('Authorization header:', authHeader);

    if (!token) {
        // Если токена нет - пользователь не авторизован
        return res.status(401).json({ message: 'Доступ запрещен. Требуется авторизация.' });
    }

    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
        console.error('!!! JWT_SECRET is not defined for verification !!!');
        return res.status(500).json({ message: 'Ошибка конфигурации сервера' });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        req.user = decoded; // Добавляем payload токена (userId, email) в объект запроса
        next(); // Переходим к защищенному маршруту
    } catch (err) {
        console.warn('JWT Verification failed:', err.message);
        return res.status(401).json({ message: 'Сессия недействительна или истекла. Пожалуйста, войдите снова.' });
    }
};

app.post('/api/register', async (req, res) => {
    const { email, fio, password_hash, position, company, activity, city, phone } = req.body;

    if (!email || !fio || !password_hash || !position || !company || !activity || !city || !phone) {
        return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
    }
    if (password_hash.length < 6) {
        return res.status(400).json({ message: 'Пароль должен содержать не менее 6 символов' });
    }

    let hashedPassword;
    try {
        const saltRounds = 12;
        hashedPassword = await bcrypt.hash(password_hash, saltRounds);
    } catch (hashError) {
        console.error('Error hashing password:', hashError);
        return res.status(500).json({ message: 'Ошибка сервера при обработке регистрации' });
    }

    const insertQuery = `
        INSERT INTO users (email, fio, password_hash, position, company, activity_sphere, city, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, fio;
    `;
    const values = [email, fio, hashedPassword, position, company, activity, city, phone];

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(insertQuery, values);
        const newUser = result.rows[0];
        console.log('User registered:', { id: newUser.id, email: newUser.email });

        // Важно: НЕ логиним пользователя автоматически после регистрации в этой схеме
        // Пусть он введет логин/пароль на странице входа
        res.status(201).json({
            message: 'Регистрация прошла успешно! Теперь вы можете войти.',
            user: { // Возвращаем минимум информации
                id: newUser.id,
                email: newUser.email,
                fio: newUser.fio
            }
        });

    } catch (dbError) {
        console.error('Database registration error:', dbError);
        if (dbError.code === '23505') { // Unique constraint violation
            return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
        }
        res.status(500).json({ message: 'Ошибка сервера при регистрации' });
    } finally {
        if (client) client.release();
    }
});


// Обновление профиля пользователя
app.put('/api/user/profile', verifyToken, async (req, res) => {
    const userId = req.user.userId; // ID пользователя из JWT-токена
    const { fio, phone, password, company, position, city, activity_sphere } = req.body;
    console.log(req.body);
    // Проверяем, что пользователь не пытается изменить email (если это запрещено в вашей системе)
    if (req.body.email) {
        return res.status(400).json({ message: 'Изменение email не разрешено' });
    }

    let client;
    try {
        client = await pool.connect();

        // Начинаем транзакцию
        await client.query('BEGIN');

        // Проверяем, существует ли пользователь с таким ID
        const userCheckResult = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userId]
        );

        if (userCheckResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Формируем запрос на обновление данных
        let updateQuery = 'UPDATE users SET ';
        const updateValues = [];
        const updateFields = [];
        let paramIndex = 1;

        // Добавляем только те поля, которые были переданы в запросе
        if (fio !== undefined) {
            updateFields.push(`fio = $${paramIndex++}`);
            updateValues.push(fio);
        }

        if (phone !== undefined) {
            updateFields.push(`phone = $${paramIndex++}`);
            updateValues.push(phone);
        }

        if (company !== undefined) {
            updateFields.push(`company = $${paramIndex++}`);
            updateValues.push(company);
        }

        if (position !== undefined) {
            updateFields.push(`position = $${paramIndex++}`);
            updateValues.push(position);
        }

        if (city !== undefined) {
            updateFields.push(`city = $${paramIndex++}`);
            updateValues.push(city);
        }

        if (activity_sphere !== undefined) {
            updateFields.push(`activity_sphere = $${paramIndex++}`);
            updateValues.push(activity_sphere);
        }

        // Если передан пароль, хэшируем его
        if (password !== undefined && password.trim() !== '') {
            try {
                const saltRounds = 12;
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                updateFields.push(`password_hash = $${paramIndex++}`);
                updateValues.push(hashedPassword);
            } catch (hashError) {
                await client.query('ROLLBACK');
                console.error('Error hashing password:', hashError);
                return res.status(500).json({ message: 'Ошибка при обработке пароля' });
            }
        }

        // Добавляем updated_at
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        // Если нет полей для обновления, возвращаем успех
        if (updateFields.length === 0) {
            await client.query('ROLLBACK');
            return res.status(200).json({ message: 'Нет данных для обновления' });
        }

        // Формируем полный запрос
        updateQuery += updateFields.join(', ') + ` WHERE id = $${paramIndex}`;
        updateValues.push(userId);

        // Выполняем запрос
        await client.query(updateQuery, updateValues);

        // Получаем обновленные данные пользователя
        const updatedUserResult = await client.query(
            `SELECT id, email, fio, position, company, activity_sphere, city, phone, created_at, updated_at
             FROM users WHERE id = $1`,
            [userId]
        );

        // Завершаем транзакцию
        await client.query('COMMIT');

        // Отправляем обновленные данные клиенту
        res.status(200).json({
            message: 'Профиль успешно обновлен',
            userData: updatedUserResult.rows[0]
        });

    } catch (error) {
        // В случае ошибки откатываем транзакцию
        if (client) await client.query('ROLLBACK');
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Не удалось обновить профиль' });
    } finally {
        if (client) client.release();
    }
});

// Добавьте в .env файл
// ADMIN_PASSWORD=ваш_сложный_пароль_администратора
// ADMIN_JWT_SECRET=другой_секретный_ключ_для_админских_токенов

// Эндпоинт для входа администратора
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;

    // Проверяем пароль (хранится в .env)
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        console.error('ADMIN_PASSWORD not set in .env file');
        return res.status(500).json({ message: 'Ошибка конфигурации сервера' });
    }

    if (password !== adminPassword) {
        // Для безопасности используем одинаковое сообщение об ошибке
        return res.status(401).json({ message: 'Неверный пароль' });
    }

    // Генерируем JWT токен для администратора
    const adminJwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

    if (!adminJwtSecret) {
        console.error('ADMIN_JWT_SECRET not set in .env file');
        return res.status(500).json({ message: 'Ошибка конфигурации сервера' });
    }

    const token = jwt.sign(
        { role: 'admin' }, // Payload с ролью администратора
        adminJwtSecret,
        { expiresIn: '4h' } // Токен действителен 4 часа
    );

    // Отправляем токен клиенту
    res.status(200).json({
        message: 'Вход выполнен успешно',
        token: token
    });
});


app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Необходимо указать email и пароль' });
    }

    const findUserQuery = 'SELECT id, email, fio, password_hash FROM users WHERE email = $1';
    let client;

    try {
        client = await pool.connect();
        const result = await client.query(findUserQuery, [email]);

        if (result.rows.length === 0) {
            console.warn(`Login attempt failed (user not found): ${email}`);
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            console.warn(`Login attempt failed (invalid password): ${email}`);
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        // --- Успешный вход: Генерируем JWT ---
        const payload = { userId: user.id, email: user.email };
        const secretKey = process.env.JWT_SECRET;
        const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

        if (!secretKey) {
            console.error('!!! JWT_SECRET is not defined in .env file !!!');
            return res.status(500).json({ message: 'Ошибка конфигурации сервера' });
        }

        const token = jwt.sign(payload, secretKey, { expiresIn });

        // Вместо установки cookie, отправляем токен в теле ответа
        console.log(`Login successful: ${email}`);
        res.status(200).json({
            message: 'Вход выполнен успешно!',
            token: token, // Отправляем токен в теле ответа
            user: {
                id: user.id,
                email: user.email,
                fio: user.fio
            }
        });

    } catch (error) {
        console.error('Login process error:', error);
        res.status(500).json({ message: 'Ошибка сервера при попытке входа' });
    } finally {
        if (client) client.release();
    }
});

// --- Logout Route ---
app.post('/api/logout', (req, res) => {
    // Очищаем cookie, указывая те же опции (кроме maxAge/expires)
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'Lax',
        // path: '/' // Если устанавливали path при создании
    });
    console.log('User logged out');
    res.status(200).json({ message: 'Вы успешно вышли из системы' });
});


app.get('/api/user/profile', verifyToken, async (req, res) => {
    // req.user доступен благодаря middleware verifyToken
    const userId = req.user.userId;
    console.log(`Fetching profile for user ID: ${userId}`);

    const query = `
        SELECT id, email, fio, position, company, activity_sphere, city, phone, created_at
        FROM users
        WHERE id = $1;
    `;
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(query, [userId]);

        if (result.rows.length === 0) {
            // Это странная ситуация, если токен валиден, а пользователя нет
            console.error(`User with ID ${userId} not found in DB despite valid token.`);
            return res.status(404).json({ message: 'Профиль пользователя не найден' });
        }

        // Не отправляем password_hash клиенту!
        const userProfile = result.rows[0];
        res.status(200).json({ userData: userProfile });

    } catch (dbError) {
        console.error('Error fetching user profile:', dbError);
        res.status(500).json({ message: 'Не удалось загрузить данные профиля' });
    } finally {
        if (client) client.release();
    }
});

// Настройка хранилища для загруженных файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Определяем папку назначения в зависимости от типа файла
        let uploadPath = 'uploads/';

        if (file.fieldname === 'document') {
            uploadPath += 'documents/';
        } else if (file.fieldname === 'video') {
            uploadPath += 'videos/';
        } else if (file.fieldname === 'thumbnail') {
            uploadPath += 'thumbnails/';
        }

        // Создаем папку, если она не существует
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Генерируем уникальное имя файла
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// Фильтр для проверки типов файлов
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'attachments') {
        // Разрешенные типы документов
        if (
            file.mimetype === 'application/pdf' ||
            file.mimetype === 'application/msword' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый тип файла! Разрешены только PDF, DOC, DOCX, XLS, XLSX.'), false);
        }
    } else if (file.fieldname === 'video') {
        // Разрешенные типы видео
        if (
            file.mimetype === 'video/mp4' ||
            file.mimetype === 'video/webm'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый тип файла! Разрешены только MP4, WEBM.'), false);
        }
    } else if (file.fieldname === 'thumbnail') {
        // Разрешенные типы изображений для миниатюр
        if (
            file.mimetype === 'image/jpeg' ||
            file.mimetype === 'image/png'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый тип файла! Разрешены только JPG, PNG.'), false);
        }
    } else {
        cb(new Error('Неизвестное поле для файла!'), false);
    }
};

// Инициализация multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100 MB (максимальный размер файла)
    }
});

// Middleware для проверки прав администратора
const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Доступ запрещен. Требуется авторизация администратора.' });
    }

    const adminSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

    if (!adminSecret) {
        console.error('ADMIN_JWT_SECRET not set in .env file');
        return res.status(500).json({ message: 'Ошибка конфигурации сервера' });
    }

    jwt.verify(token, adminSecret, (err, decoded) => {
        if (err) {
            console.warn('Admin JWT Verification failed:', err.message);
            return res.status(403).json({ message: 'Доступ запрещен. Недействительный токен администратора.' });
        }

        // Проверяем, что в токене есть роль admin
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Доступ запрещен. Недостаточно прав.' });
        }

        req.admin = decoded; // Сохраняем данные из токена
        next(); // Переходим к следующему обработчику
    });
};

// Эндпоинт для входа администратора
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;

    // Проверяем пароль (хранится в .env)
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        console.error('ADMIN_PASSWORD not set in .env file');
        return res.status(500).json({ message: 'Ошибка конфигурации сервера' });
    }

    if (password !== adminPassword) {
        // Для безопасности используем одинаковое сообщение об ошибке
        return res.status(401).json({ message: 'Неверный пароль' });
    }

    // Генерируем JWT токен для администратора
    const adminJwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

    if (!adminJwtSecret) {
        console.error('ADMIN_JWT_SECRET not set in .env file');
        return res.status(500).json({ message: 'Ошибка конфигурации сервера' });
    }

    const token = jwt.sign(
        { role: 'admin' }, // Payload с ролью администратора
        adminJwtSecret,
        { expiresIn: '4h' } // Токен действителен 4 часа
    );

    // Отправляем токен клиенту
    res.status(200).json({
        message: 'Вход выполнен успешно',
        token: token
    });
});

// --- CRUD для документов ---

// 1. Получение списка всех документов
app.get('/api/admin/documents', verifyAdminToken, async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            'SELECT * FROM documents ORDER BY created_at DESC'
        );

        res.status(200).json({ documents: result.rows });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ message: 'Не удалось загрузить список документов' });
    } finally {
        if (client) client.release();
    }
});

// 2. Получение одного документа по ID
app.get('/api/admin/documents/:id', verifyAdminToken, async (req, res) => {
    const documentId = req.params.id;

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            'SELECT * FROM documents WHERE id = $1',
            [documentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Документ не найден' });
        }

        res.status(200).json({ document: result.rows[0] });
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ message: 'Не удалось загрузить документ' });
    } finally {
        if (client) client.release();
    }
});

// 3. Создание нового документа
app.post('/api/admin/documents', verifyAdminToken, upload.single('document'), async (req, res) => {
    const { title } = req.body;

    if (!title || !req.file) {
        return res.status(400).json({ message: 'Необходимо указать название и загрузить файл' });
    }

    const filePath = req.file.path;
    const fileSize = req.file.size;
    const fileType = path.extname(req.file.originalname).substring(1); // Убираем точку из расширения

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            `INSERT INTO documents (title, file_path, file_size, file_type)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [title, filePath, fileSize, fileType]
        );

        res.status(201).json({
            message: 'Документ успешно загружен',
            document: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating document:', error);
        // Удаляем загруженный файл в случае ошибки
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.status(500).json({ message: 'Не удалось загрузить документ' });
    } finally {
        if (client) client.release();
    }
});

// 4. Обновление документа
app.put('/api/admin/documents/:id', verifyAdminToken, upload.single('document'), async (req, res) => {
    const documentId = req.params.id;
    const { title } = req.body;

    if (!title) {
        return res.status(400).json({ message: 'Необходимо указать название документа' });
    }

    let client;
    try {
        client = await pool.connect();

        // Начинаем транзакцию
        await client.query('BEGIN');

        // Получаем текущую информацию о документе
        const documentResult = await client.query(
            'SELECT * FROM documents WHERE id = $1',
            [documentId]
        );

        if (documentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Документ не найден' });
        }

        const oldDocument = documentResult.rows[0];
        let filePath = oldDocument.file_path;
        let fileSize = oldDocument.file_size;
        let fileType = oldDocument.file_type;

        // Если загружен новый файл, обновляем информацию
        if (req.file) {
            // Удаляем старый файл
            if (fs.existsSync(oldDocument.file_path)) {
                fs.unlinkSync(oldDocument.file_path);
            }

            // Обновляем информацию о файле
            filePath = req.file.path;
            fileSize = req.file.size;
            fileType = path.extname(req.file.originalname).substring(1);
        }

        // Обновляем запись в базе данных
        const updateResult = await client.query(
            `UPDATE documents
             SET title = $1, file_path = $2, file_size = $3, file_type = $4, updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING *`,
            [title, filePath, fileSize, fileType, documentId]
        );

        // Завершаем транзакцию
        await client.query('COMMIT');

        res.status(200).json({
            message: 'Документ успешно обновлен',
            document: updateResult.rows[0]
        });
    } catch (error) {
        // В случае ошибки откатываем транзакцию
        if (client) await client.query('ROLLBACK');
        console.error('Error updating document:', error);

        // Удаляем новый загруженный файл в случае ошибки
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ message: 'Не удалось обновить документ' });
    } finally {
        if (client) client.release();
    }
});

// 5. Удаление документа
app.delete('/api/admin/documents/:id', verifyAdminToken, async (req, res) => {
    const documentId = req.params.id;

    let client;
    try {
        client = await pool.connect();

        // Начинаем транзакцию
        await client.query('BEGIN');

        // Получаем информацию о документе
        const documentResult = await client.query(
            'SELECT * FROM documents WHERE id = $1',
            [documentId]
        );

        if (documentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Документ не найден' });
        }

        const document = documentResult.rows[0];

        // Удаляем запись из базы данных
        await client.query(
            'DELETE FROM documents WHERE id = $1',
            [documentId]
        );

        // Завершаем транзакцию
        await client.query('COMMIT');

        // Удаляем файл с диска
        if (fs.existsSync(document.file_path)) {
            fs.unlinkSync(document.file_path);
        }

        res.status(200).json({
            message: 'Документ успешно удален',
            id: documentId
        });
    } catch (error) {
        // В случае ошибки откатываем транзакцию
        if (client) await client.query('ROLLBACK');
        console.error('Error deleting document:', error);
        res.status(500).json({ message: 'Не удалось удалить документ' });
    } finally {
        if (client) client.release();
    }
});

//EMAIL_BLOCK
// Эндпоинт для отправки email
// Эндпоинт для создания новой заявки (письма в техподдержку)
app.post('/api/tickets', verifyToken, upload.array('attachments', 5), async (req, res) => {
    const userId = req.user.userId;
    const userEmailFromToken = req.user.email;

    // 'subject' и 'message' извлекаются из req.body, которое приходит от FormData
    const { subject, message } = req.body;

    if (!subject || !message) {
        return res.status(400).json({ message: 'Необходимо указать тему и текст заявки' });
    }

    let client;
    try {
        client = await pool.connect(); // pool должен быть определен глобально
        await client.query('BEGIN');

        const statusResult = await client.query('SELECT id FROM ticket_statuses WHERE name = $1', ['open']);
        if (statusResult.rows.length === 0) {
            await client.query('ROLLBACK');
            console.error('Ticket status "open" not found in database.');
            return res.status(500).json({ message: 'Ошибка конфигурации сервера: статус заявки не найден.' });
        }
        const statusId = statusResult.rows[0].id;

        // Генерируем номер заявки
        const ticketNumberResult = await client.query('SELECT generate_ticket_number() as generated_ticket_number');
        const newTicketNumber = ticketNumberResult.rows[0].generated_ticket_number;

        // Генерируем thread_id для email
        const threadId = `ticket-${newTicketNumber}-${Date.now()}`;

        // Получаем полное имя пользователя из БД
        const userDetailsResult = await client.query('SELECT fio FROM users WHERE id = $1', [userId]);
        const senderName = userDetailsResult.rows.length > 0 ? userDetailsResult.rows[0].full_name : userEmailFromToken;

        // 1. Создаем запись о заявке в таблице 'tickets'
        const ticketInsertResult = await client.query(
            `INSERT INTO tickets (ticket_number, user_id, subject, status_id, email_thread_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, created_at`, // ticket_number уже есть в newTicketNumber
            [newTicketNumber, userId, subject, statusId, threadId]
        );
        // Собираем данные о новой заявке
        const newTicketData = {
            id: ticketInsertResult.rows[0].id,
            created_at: ticketInsertResult.rows[0].created_at,
            ticket_number: newTicketNumber // Используем сгенерированный номер
        };

        // 2. Сохраняем исходное сообщение
        const messageInsertResult = await client.query(
            `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_email, message)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [newTicketData.id, 'user', userId, userEmailFromToken, message]
        );
        const firstMessageId = messageInsertResult.rows[0].id;

        // 3. Обрабатываем вложения
        const emailAttachments = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await client.query(
                    `INSERT INTO ticket_attachments (message_id, file_name, file_path, file_size, mime_type)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [firstMessageId, file.originalname, file.path, file.size, file.mimetype]
                );
                emailAttachments.push({ filename: file.originalname, path: file.path });
            }
        }

        // --- Определение переменных для тела письма ---
        const emailSubjectForSupport = `Новая заявка #${newTicketData.ticket_number}: ${subject}`;

        const emailTextForSupport = // `textBody` для функции sendEmail
`Пользователь: ${senderName} (${userEmailFromToken})
Тема: ${subject}
Сообщение:
${message}
---
Идентификатор заявки: ${newTicketData.ticket_number}
Идентификатор треда (для ответов): ${threadId}`;

        const emailHtmlForSupport = // `htmlBody` для функции sendEmail
`<p><strong>Пользователь:</strong> ${senderName} (${userEmailFromToken})</p>
<p><strong>Тема:</strong> ${subject}</p>
<p><strong>Сообщение:</strong></p>
<p>${message.replace(/\n/g, '<br>')}</p>
<hr>
<p>Идентификатор заявки: <code>${newTicketData.ticket_number}</code></p>
<p>Идентификатор треда (для ответов): <code>${threadId}</code></p>`;
        // --- Конец определения переменных для тела письма ---

        // Коммитим транзакцию ДО отправки email, чтобы данные точно были в БД
        await client.query('COMMIT');

        // 4. Отправляем email в техподдержку
        try {
            await sendEmail(
                supportEmail,             // `to`
                emailSubjectForSupport,   // `subject`
                emailTextForSupport,      // `textBody`
                emailHtmlForSupport,      // `htmlBody`
                {                         // `options`
                    replyTo: userEmailFromToken,
                    ticketNumber: newTicketData.ticket_number,
                    threadId: threadId,
                    attachments: emailAttachments,
                    userIdForLog: userId,
                    fromName: `${senderName} (через сайт)`
                    // saveToDb: true, // По умолчанию true, если pool определен и вы хотите логировать это
                }
            );
            console.log(`Email for new ticket #${newTicketData.ticket_number} sent to support.`);
        } catch (emailError) {
            // Логируем ошибку отправки email, но не откатываем транзакцию, так как заявка уже создана
            console.error(`Failed to send email notification for new ticket #${newTicketData.ticket_number}:`, emailError);
            // Здесь можно добавить логику для пометки заявки как "email не отправлен"
        }

        res.status(201).json({
            message: 'Заявка успешно создана.',
            ticket: {
                id: newTicketData.id,
                ticket_number: newTicketData.ticket_number,
                subject: subject,
                status: 'open',
                created_at: newTicketData.created_at,
                thread_id: threadId
            }
        });

    } catch (error) {
        // Если ошибка произошла ДО client.query('COMMIT'), откатываем транзакцию
        if (client && client.active) { // Проверяем, активна ли транзакция
             try { await client.query('ROLLBACK'); } catch (rbError) { console.error('Error rolling back transaction', rbError); }
        }
        console.error('Error creating ticket:', error);
        if (error.code === '23505' && error.constraint && error.constraint.includes('ticket_number')) {
            return res.status(409).json({ message: 'Ошибка: Конфликт номера заявки. Пожалуйста, попробуйте еще раз.' });
        }
        res.status(500).json({ message: 'Ошибка при создании заявки.' });
    } finally {
        if (client) client.release();
    }
});


// 1. Получение списка заявок пользователя
app.get('/api/tickets', verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const statusFilter = req.query.status; // 'open', 'closed', 'all'

    let query = `
        SELECT t.id, t.ticket_number, t.subject, ts.name as status,
               t.created_at, t.updated_at, t.closed_at,
               (SELECT tm.message FROM ticket_messages tm
                WHERE tm.ticket_id = t.id
                ORDER BY tm.created_at ASC LIMIT 1) as first_message
        FROM tickets t
        JOIN ticket_statuses ts ON t.status_id = ts.id
        WHERE t.user_id = $1
    `;

    const queryParams = [userId];

    if (statusFilter === 'open') {
        query += ` AND ts.name != 'closed'`;
    } else if (statusFilter === 'closed') {
        query += ` AND ts.name = 'closed'`;
    }

    query += ` ORDER BY t.updated_at DESC`;

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(query, queryParams);
        res.status(200).json({ tickets: result.rows });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ message: 'Не удалось загрузить список заявок' });
    } finally {
        if (client) client.release();
    }
});

// 2. Создание новой заявки
app.post('/api/tickets', verifyToken, upload.array('attachments', 5), async (req, res) => {
    const userId = req.user.userId;
    const { subject, message } = req.body;

    if (!subject || !message) {
        return res.status(400).json({ message: 'Необходимо указать тему и текст заявки' });
    }

    let client;
    try {
        client = await pool.connect();

        // Начинаем транзакцию
        await client.query('BEGIN');

        // Получаем ID статуса "open"
        const statusResult = await client.query(
            'SELECT id FROM ticket_statuses WHERE name = $1',
            ['open']
        );
        const statusId = statusResult.rows[0].id;

        // Генерируем номер заявки
        const ticketNumberResult = await client.query('SELECT generate_ticket_number() as number');
        const ticketNumber = ticketNumberResult.rows[0].number;

        // Генерируем thread_id для email
        const threadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        // Получаем информацию о пользователе
        const userResult = await client.query(
            'SELECT email, fio as fio FROM users WHERE id = $1',
            [userId]
        );
        const user = userResult.rows[0];

        // Создаем заявку
        const ticketResult = await client.query(
            `INSERT INTO tickets (ticket_number, user_id, subject, status_id, email_thread_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, ticket_number, created_at`,
            [ticketNumber, userId, subject, statusId, threadId]
        );
        const newTicket = ticketResult.rows[0];

        // Сохраняем исходящее письмо в базу данных
        const emailResult = await client.query(
            `INSERT INTO emails (thread_id, subject, body, from_email, is_outgoing, created_at, user_id)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
             RETURNING id`,
            [threadId, `${subject} [${threadId}]`, message, user.email, false, userId]
        );
        const emailId = emailResult.rows[0].id;

        // Добавляем первое сообщение от пользователя
        const messageResult = await client.query(
            `INSERT INTO ticket_messages (ticket_id, message_number, sender_type, sender_id, sender_email, message, email_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [newTicket.id, 1, 'user', userId, user.email, message, emailId]
        );
        const messageId = messageResult.rows[0].id;

        // Обрабатываем вложения, если они есть
        const attachments = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                // Сохраняем информацию о вложении в базу данных
                await client.query(
                    `INSERT INTO ticket_attachments (message_id, file_name, file_path, file_size, mime_type)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [messageId, file.originalname, file.path, file.size, file.mimetype]
                );

                // Добавляем вложение для отправки по email
                attachments.push({
                    filename: file.originalname,
                    path: file.path
                });
            }
        }

        // Завершаем транзакцию
        await client.query('COMMIT');

        // Отправляем уведомление на email техподдержки
        try {
            const emailInfo = await sendEmail(
                supportEmail,
                `Новая заявка #${ticketNumber}: ${subject}`,
                `Пользователь ${user.fio} (${user.email}) создал новую заявку:\n\n${message}\n\nДля ответа на эту заявку, пожалуйста, сохраните тему письма и ID цепочки: ${threadId}`,
                `<p>Пользователь <strong>${user.fio}</strong> (${user.email}) создал новую заявку:</p>
                 <p><strong>Номер заявки:</strong> ${ticketNumber}</p>
                 <p><strong>Тема:</strong> ${subject}</p>
                 <p><strong>Сообщение:</strong></p>
                 <p>${message.replace(/\n/g, '<br>')}</p>
                 <p>Для ответа на эту заявку, пожалуйста, сохраните тему письма и ID цепочки: ${threadId}</p>`,
                {
                    threadId: threadId,
                    userId: userId,
                    saveToDb: true,
                    attachments: attachments
                }
            );
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Продолжаем выполнение, даже если email не отправился
        }

        res.status(201).json({
            message: 'Заявка успешно создана',
            ticket: {
                id: newTicket.id,
                ticket_number: newTicket.ticket_number,
                subject,
                status: 'open',
                created_at: newTicket.created_at,
                thread_id: threadId
            }
        });

    } catch (error) {
        // В случае ошибки откатываем транзакцию
        if (client) await client.query('ROLLBACK');
        console.error('Error creating ticket:', error);
        res.status(500).json({ message: 'Не удалось создать заявку' });
    } finally {
        if (client) client.release();
    }
});

// 3. Добавление сообщения в заявку
app.post('/api/tickets/:ticketNumber/messages', verifyToken, upload.array('attachments', 5), async (req, res) => {
    const userId = req.user.userId;
    const { ticketNumber } = req.params;
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ message: 'Текст сообщения не может быть пустым' });
    }

    let client;
    try {
        client = await pool.connect();

        // Начинаем транзакцию
        await client.query('BEGIN');

        // Получаем информацию о заявке
        const ticketResult = await client.query(
            `SELECT t.id, t.subject, ts.name as status, t.user_id, t.email_thread_id
             FROM tickets t
             JOIN ticket_statuses ts ON t.status_id = ts.id
             WHERE t.ticket_number = $1`,
            [ticketNumber]
        );

        if (ticketResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Заявка не найдена' });
        }

        const ticket = ticketResult.rows[0];

        // Проверяем, принадлежит ли заявка текущему пользователю
        if (ticket.user_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'У вас нет доступа к этой заявке' });
        }

        // Проверяем, не закрыта ли заявка
        if (ticket.status === 'closed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Невозможно добавить сообщение в закрытую заявку' });
        }

        // Получаем информацию о пользователе
        const userResult = await client.query(
            'SELECT email, fio as fio FROM users WHERE id = $1',
            [userId]
        );
        const user = userResult.rows[0];

        // Получаем последний номер сообщения в заявке
        const lastMessageResult = await client.query(
            `SELECT MAX(message_number) as last_number FROM ticket_messages WHERE ticket_id = $1`,
            [ticket.id]
        );

        const messageNumber = (lastMessageResult.rows[0].last_number || 0) + 1;

        // Сохраняем исходящее письмо в базу данных
        const emailResult = await client.query(
            `INSERT INTO emails (thread_id, subject, body, from_email, is_outgoing, created_at, user_id)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
             RETURNING id`,
            [ticket.email_thread_id, `Re: ${ticket.subject} [${ticket.email_thread_id}]`, message, user.email, false, userId]
        );
        const emailId = emailResult.rows[0].id;

        // Добавляем сообщение
        const messageResult = await client.query(
            `INSERT INTO ticket_messages (ticket_id, message_number, sender_type, sender_id, sender_email, message, email_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, created_at`,
            [ticket.id, messageNumber, 'user', userId, user.email, message, emailId]
        );
        const messageId = messageResult.rows[0].id;

        // Обрабатываем вложения, если они есть
        const attachments = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                // Сохраняем информацию о вложении в базу данных
                await client.query(
                    `INSERT INTO ticket_attachments (message_id, file_name, file_path, file_size, mime_type)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [messageId, file.originalname, file.path, file.size, file.mimetype]
                );

                // Добавляем вложение для отправки по email
                attachments.push({
                    filename: file.originalname,
                    path: file.path
                });
            }
        }

        // Обновляем статус заявки на "ожидает ответа от техподдержки", если она была в статусе "ожидает ответа от пользователя"
        if (ticket.status === 'waiting_for_user') {
            const openStatusResult = await client.query(
                'SELECT id FROM ticket_statuses WHERE name = $1',
                ['open']
            );
            const openStatusId = openStatusResult.rows[0].id;

            await client.query(
                `UPDATE tickets
                 SET status_id = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [openStatusId, ticket.id]
            );
        } else {
            // Просто обновляем время последнего обновления
            await client.query(
                `UPDATE tickets
                 SET updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [ticket.id]
            );
        }

        // Завершаем транзакцию
        await client.query('COMMIT');

        // Отправляем уведомление на email техподдержки
        try {
            await sendEmail(
                supportEmail,
                `Re: ${ticket.subject}`,
                `Пользователь ${user.fio} (${user.email}) добавил новое сообщение в заявку #${ticketNumber}:\n\n${message}`,
                `<p>Пользователь <strong>${user.fio}</strong> (${user.email}) добавил новое сообщение в заявку:</p>
                 <p><strong>Номер заявки:</strong> ${ticketNumber}</p>
                 <p><strong>Тема:</strong> ${ticket.subject}</p>
                 <p><strong>Сообщение:</strong></p>
                 <p>${message.replace(/\n/g, '<br>')}</p>`,
                {
                    threadId: ticket.email_thread_id,
                    userId: userId,
                    saveToDb: true,
                    attachments: attachments
                }
            );
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Продолжаем выполнение, даже если email не отправился
        }

        res.status(201).json({
            message: 'Сообщение успешно добавлено',
            ticketMessage: {
                sender_type: 'user',
                sender_name: user.fio,
                sender_email: user.email,
                message: message,
                created_at: messageResult.rows[0].created_at,
                is_read: false
            }
        });

    } catch (error) {
        // В случае ошибки откатываем транзакцию
        if (client) await client.query('ROLLBACK');
        console.error('Error adding message to ticket:', error);
        res.status(500).json({ message: 'Не удалось добавить сообщение в заявку' });
    } finally {
        if (client) client.release();
    }
});

// 4. Закрытие заявки
app.post('/api/tickets/:ticketNumber/close', verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const { ticketNumber } = req.params;

    let client;
    try {
        client = await pool.connect();

        // Получаем информацию о заявке
        const ticketResult = await client.query(
            `SELECT t.id, t.subject, ts.name as status, t.user_id, t.email_thread_id
             FROM tickets t
             JOIN ticket_statuses ts ON t.status_id = ts.id
             WHERE t.ticket_number = $1`,
            [ticketNumber]
        );

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({ message: 'Заявка не найдена' });
        }

        const ticket = ticketResult.rows[0];

        // Проверяем, принадлежит ли заявка текущему пользователю
        if (ticket.user_id !== userId) {
            return res.status(403).json({ message: 'У вас нет доступа к этой заявке' });
        }

        // Проверяем, не закрыта ли уже заявка
        if (ticket.status === 'closed') {
            return res.status(400).json({ message: 'Заявка уже закрыта' });
        }

        // Получаем ID статуса "closed"
        const closedStatusResult = await client.query(
            'SELECT id FROM ticket_statuses WHERE name = $1',
            ['closed']
        );
        const closedStatusId = closedStatusResult.rows[0].id;

        // Закрываем заявку
        await client.query(
            `UPDATE tickets
             SET status_id = $1, updated_at = CURRENT_TIMESTAMP, closed_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [closedStatusId, ticket.id]
        );

        // Получаем информацию о пользователе
        const userResult = await client.query(
            'SELECT email, fio as fio FROM users WHERE id = $1',
            [userId]
        );
        const user = userResult.rows[0];

        // Отправляем уведомление на email техподдержки
        try {
            await sendEmail(
                supportEmail,
                `Заявка #${ticketNumber} закрыта пользователем: ${ticket.subject}`,
                `Пользователь ${user.fio} (${user.email}) закрыл заявку #${ticketNumber}.`,
                `<p>Пользователь <strong>${user.fio}</strong> (${user.email}) закрыл заявку:</p>
                 <p><strong>Номер заявки:</strong> ${ticketNumber}</p>
                 <p><strong>Тема:</strong> ${ticket.subject}</p>`,
                {
                    threadId: ticket.email_thread_id,
                    userId: userId,
                    saveToDb: true
                }
            );
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Продолжаем выполнение, даже если email не отправился
        }

        res.status(200).json({
            message: 'Заявка успешно закрыта',
            ticket_number: ticketNumber,
            status: 'closed',
            closed_at: new Date()
        });

    } catch (error) {
        console.error('Error closing ticket:', error);
        res.status(500).json({ message: 'Не удалось закрыть заявку' });
    } finally {
        if (client) client.release();
    }
});

// 5. Повторное открытие заявки
app.post('/api/tickets/:ticketNumber/reopen', verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const { ticketNumber } = req.params;

    let client;
    try {
        client = await pool.connect();

        // Получаем информацию о заявке
        const ticketResult = await client.query(
            `SELECT t.id, t.subject, ts.name as status, t.user_id, t.email_thread_id
             FROM tickets t
             JOIN ticket_statuses ts ON t.status_id = ts.id
             WHERE t.ticket_number = $1`,
            [ticketNumber]
        );

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({ message: 'Заявка не найдена' });
        }

        const ticket = ticketResult.rows[0];

        // Проверяем, принадлежит ли заявка текущему пользователю
        if (ticket.user_id !== userId) {
            return res.status(403).json({ message: 'У вас нет доступа к этой заявке' });
        }

        // Проверяем, закрыта ли заявка
        if (ticket.status !== 'closed') {
            return res.status(400).json({ message: 'Заявка уже открыта' });
        }

        // Получаем ID статуса "open"
        const openStatusResult = await client.query(
            'SELECT id FROM ticket_statuses WHERE name = $1',
            ['open']
        );
        const openStatusId = openStatusResult.rows[0].id;

        // Открываем заявку заново
        await client.query(
            `UPDATE tickets
             SET status_id = $1, updated_at = CURRENT_TIMESTAMP, closed_at = NULL
             WHERE id = $2`,
            [openStatusId, ticket.id]
        );

        // Получаем информацию о пользователе
        const userResult = await client.query(
            'SELECT email, fio as fio FROM users WHERE id = $1',
            [userId]
        );
        const user = userResult.rows[0];

        // Отправляем уведомление на email техподдержки
        try {
            await sendEmail(
                supportEmail,
                `Заявка #${ticketNumber} открыта повторно: ${ticket.subject}`,
                `Пользователь ${user.fio} (${user.email}) повторно открыл заявку #${ticketNumber}.`,
                `<p>Пользователь <strong>${user.fio}</strong> (${user.email}) повторно открыл заявку:</p>
                 <p><strong>Номер заявки:</strong> ${ticketNumber}</p>
                 <p><strong>Тема:</strong> ${ticket.subject}</p>`,
                {
                    threadId: ticket.email_thread_id,
                    userId: userId,
                    saveToDb: true
                }
            );
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Продолжаем выполнение, даже если email не отправился
        }

        res.status(200).json({
            message: 'Заявка успешно открыта повторно',
            ticket_number: ticketNumber,
            status: 'open',
            updated_at: new Date()
        });

    } catch (error) {
        console.error('Error reopening ticket:', error);
        res.status(500).json({ message: 'Не удалось повторно открыть заявку' });
    } finally {
        if (client) client.release();
    }
})

// 6. Эндпоинт для обработки входящих писем от почтового сервера
app.post('/api/receive-email', async (req, res) => {
    // 1. Защита Webhook'а
    const apiKey = req.headers['x-api-key'];
    if (!process.env.EMAIL_WEBHOOK_API_KEY || apiKey !== process.env.EMAIL_WEBHOOK_API_KEY) {
        console.warn('Unauthorized webhook access attempt to /api/receive-email.');
        return res.status(401).json({ message: 'Unauthorized webhook access.' });
    }

    // 2. Получаем данные из тела запроса
    const { subject, body, from_email } = req.body;

    if (!subject || !body || !from_email) {
        console.warn('Webhook /api/receive-email: Missing required fields.', req.body);
        return res.status(400).json({ message: 'Missing required fields: subject, body, from_email are required.' });
    }

    // 3. Извлекаем ticket_number из темы письма
    let ticketNumber = null;
    const ticketNumberMatch = subject.match(/\[Ticket#([a-zA-Z0-9\-]+)\]/i); // Ищет [Ticket#<номер_заявки>]
    // ([a-zA-Z0-9\-]+) - означает, что номер заявки может состоять из букв, цифр и дефисов.
    // Если ваш ticket_number только из цифр, можно использовать (\d+)

    if (ticketNumberMatch && ticketNumberMatch[1]) {
        ticketNumber = ticketNumberMatch[1];
        console.log(`Webhook /api/receive-email: Extracted ticket_number '${ticketNumber}' from subject.`);
    } else {
        console.warn(`Webhook /api/receive-email: Could not extract ticket_number from subject: "${subject}". Email will be ignored.`);
        // Если номер заявки не найден в теме, мы не можем связать письмо с заявкой.
        // Возвращаем 200 OK, чтобы почтовый парсер не пытался отправить снова.
        return res.status(200).json({ message: 'Ticket number not found in subject. Email ignored.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 4. Находим заявку в БД по извлеченному ticket_number
        const ticketQueryResult = await client.query(
            `SELECT t.id, t.ticket_number, t.user_id, t.subject as ticket_subject, ts.name as status,
                    u.email as user_email, u.fio as user_name, t.email_thread_id
             FROM tickets t
             JOIN ticket_statuses ts ON t.status_id = ts.id
             JOIN users u ON t.user_id = u.id
             WHERE t.ticket_number = $1`,
            [ticketNumber]
        );

        if (ticketQueryResult.rows.length === 0) {
            await client.query('ROLLBACK');
            console.warn(`Webhook /api/receive-email: Ticket not found for ticket_number: ${ticketNumber} (extracted from subject).`);
            return res.status(200).json({ message: `Ticket not found for ticket_number: ${ticketNumber}. Email ignored.` });
        }
        const ticket = ticketQueryResult.rows[0];

        // ... (остальная логика остается такой же, как в предыдущем ответе, начиная с пункта 5)
        // (Проверка статуса заявки, определение отправителя, сохранение в emails,
        //  добавление в ticket_messages, обновление статуса заявки, отправка уведомлений)

        // 5. Определяем, кто отправитель: пользователь или техподдержка
        let senderType = 'support';
        let senderIdForDb = ticket.user_id;

        const supportEmails = (process.env.SUPPORT_EMAILS || supportEmail).split(',').map(email => email.trim().toLowerCase());
        if (supportEmails.includes(from_email.toLowerCase())) {
            senderType = 'support';
            const supportStaffResult = await client.query('SELECT id FROM users WHERE email = $1 AND is_support = TRUE', [from_email]);
            senderIdForDb = supportStaffResult.rows.length > 0 ? supportStaffResult.rows[0].id : null;
        } else if (from_email.toLowerCase() !== ticket.user_email.toLowerCase()) {
            console.warn(`Webhook /api/receive-email: Email from '${from_email}' for ticket #${ticket.ticket_number}, but original user is '${ticket.user_email}'. Processing as user reply.`);
        }

        // 6. Сохраняем входящее письмо в таблицу emails (опционально)
        const emailInsertResult = await client.query(
            `INSERT INTO emails (thread_id, subject, body, from_email, is_outgoing, created_at, user_id)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
             RETURNING id`,
            [ticket.email_thread_id, subject, body, from_email, false, (senderType === 'user' ? ticket.user_id : senderIdForDb)]
        );
        const emailId = emailInsertResult.rows[0].id;

        // 7. Добавляем сообщение в таблицу ticket_messages
        const messageInsertResult = await client.query(
            `INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_email, message, email_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, created_at, message_number`,
            [ticket.id, senderType, senderIdForDb, from_email, body, emailId]
        );
        const newMessage = messageInsertResult.rows[0];

        // 8. Обновляем статус заявки
        let newStatusName = ticket.status;
        if (senderType === 'support' && (ticket.status === 'open' || ticket.status === 'in_progress')) {
            newStatusName = 'waiting_for_user';
        } else if (senderType === 'user' && ticket.status === 'waiting_for_user') {
            newStatusName = 'open';
        } else if (ticket.status === 'closed' && senderType === 'user') {
            newStatusName = 'open';
            console.log(`Ticket #${ticket.ticket_number} re-opened due to user reply via email.`);
        }

        if (newStatusName !== ticket.status) {
            const newStatusResult = await client.query('SELECT id FROM ticket_statuses WHERE name = $1', [newStatusName]);
            if (newStatusResult.rows.length > 0) {
                await client.query(
                    `UPDATE tickets SET status_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                    [newStatusResult.rows[0].id, ticket.id]
                );
            }
        } else {
             await client.query(`UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [ticket.id]);
        }

        await client.query('COMMIT');

        // 9. Отправляем email-уведомление (если нужно)
        if (senderType === 'support') { // Уведомляем пользователя
            try {
                await sendEmail(
                    ticket.user_email,
                    `Ответ по вашей заявке #${ticket.ticket_number}: ${ticket.ticket_subject}`,
                    `Здравствуйте, ${ticket.user_name || 'Пользователь'}!\n\nСотрудник техподдержки (${from_email}) ответил на вашу заявку:\n\n${body}\n\nС уважением,\nТехподдержка ИНТ`,
                    `<p>Здравствуйте, ${ticket.user_name || 'Пользователь'}!</p><p>Сотрудник техподдержки (${from_email}) ответил на вашу заявку #${ticket.ticket_number} (${ticket.ticket_subject}):</p><blockquote>${body.replace(/\n/g, '<br>')}</blockquote><p>С уважением,<br>Техподдержка ИНТ</p>`,
                    { replyTo: supportEmail, threadId: ticket.email_thread_id, ticketNumber: ticket.ticket_number }
                );
            } catch (emailError) { console.error(`Webhook: Failed to send notification to user for ticket #${ticket.ticket_number}:`, emailError); }
        } else if (senderType === 'user' && !supportEmails.includes(from_email.toLowerCase())) { // Уведомляем поддержку
             try {
                await sendEmail(
                    supportEmail,
                    `Новый ответ от пользователя по заявке #${ticket.ticket_number}: ${ticket.ticket_subject}`,
                    `Пользователь ${ticket.user_name} (${from_email}) ответил на заявку #${ticket.ticket_number}:\n\n${body}`,
                    `<p>Пользователь <strong>${ticket.user_name}</strong> (${from_email}) ответил на заявку #${ticket.ticket_number} (${ticket.ticket_subject}):</p><blockquote>${body.replace(/\n/g, '<br>')}</blockquote>`,
                    { replyTo: from_email, threadId: ticket.email_thread_id, ticketNumber: ticket.ticket_number }
                );
            } catch (emailError) { console.error(`Webhook: Failed to send notification to support for ticket #${ticket.ticket_number}:`, emailError); }
        }

        console.log(`Webhook /api/receive-email: Message from ${from_email} added to ticket #${ticket.ticket_number}`);
        res.status(200).json({
            message: 'Email successfully processed and added to ticket.',
            ticket_number: ticket.ticket_number,
            message_id: newMessage.id
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error processing incoming email via webhook /api/receive-email:', error);
        res.status(500).json({ message: 'Internal server error while processing email.' });
    } finally {
        if (client) client.release();
    }
});

// 7. Получение детальной информации о заявке
app.get('/api/tickets/:ticketNumber', verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const { ticketNumber } = req.params;

    let client;
    try {
        client = await pool.connect();

        // Получаем информацию о заявке
        const ticketResult = await client.query(
            `SELECT t.id, t.ticket_number, t.subject, ts.name as status,
                    t.created_at, t.updated_at, t.closed_at, t.user_id, t.email_thread_id
             FROM tickets t
             JOIN ticket_statuses ts ON t.status_id = ts.id
             WHERE t.ticket_number = $1`,
            [ticketNumber]
        );

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({ message: 'Заявка не найдена' });
        }

        const ticket = ticketResult.rows[0];

        // Проверяем, принадлежит ли заявка текущему пользователю
        if (ticket.user_id !== userId) {
            return res.status(403).json({ message: 'У вас нет доступа к этой заявке' });
        }

        // Получаем все сообщения в заявке
        const messagesResult = await client.query(
            `SELECT tm.id, tm.sender_type, tm.sender_id, tm.sender_email, tm.message,
                    tm.created_at, tm.is_read, tm.email_id,
                    CASE WHEN tm.sender_type = 'user' THEN u.fio ELSE 'Техподдержка' END as sender_name
             FROM ticket_messages tm
             LEFT JOIN users u ON tm.sender_id = u.id AND tm.sender_type = 'user'
             WHERE tm.ticket_id = $1
             ORDER BY tm.created_at ASC`,
            [ticket.id]
        );

        // Получаем вложения для каждого сообщения
        const messageIds = messagesResult.rows.map(m => m.id);
        let attachmentsResult = { rows: [] };

        if (messageIds.length > 0) {
            attachmentsResult = await client.query(
                `SELECT * FROM ticket_attachments WHERE message_id = ANY($1)`,
                [messageIds]
            );
        }

        // Группируем вложения по ID сообщения
        const attachmentsByMessageId = {};
        attachmentsResult.rows.forEach(attachment => {
            if (!attachmentsByMessageId[attachment.message_id]) {
                attachmentsByMessageId[attachment.message_id] = [];
            }
            attachmentsByMessageId[attachment.message_id].push(attachment);
        });

        // Добавляем вложения к сообщениям
        const messagesWithAttachments = messagesResult.rows.map(message => {
            return {
                ...message,
                attachments: attachmentsByMessageId[message.id] || []
            };
        });

        // Отмечаем сообщения от техподдержки как прочитанные
        if (messagesResult.rows.some(m => m.sender_type === 'support' && !m.is_read)) {
            await client.query(
                `UPDATE ticket_messages
                 SET is_read = TRUE
                 WHERE ticket_id = $1 AND sender_type = 'support' AND is_read = FALSE`,
                [ticket.id]
            );
        }

        res.status(200).json({
            ticket: {
                id: ticket.id,
                ticket_number: ticket.ticket_number,
                subject: ticket.subject,
                status: ticket.status,
                created_at: ticket.created_at,
                updated_at: ticket.updated_at,
                closed_at: ticket.closed_at,
                thread_id: ticket.email_thread_id
            },
            messages: messagesWithAttachments
        });

    } catch (error) {
        console.error('Error fetching ticket details:', error);
        res.status(500).json({ message: 'Не удалось загрузить информацию о заявке' });
    } finally {
        if (client) client.release();
    }
});


// --- Basic Root Route ---
app.get('/', (req, res) => {
    res.send('API is running!');
});

// --- Error Handling Middleware (Ловит ошибки, не пойманные в роутах) ---
// Должен быть ПОСЛЕДНИМ app.use
app.use((err, req, res, next) => {
    console.error('!!! UNHANDLED ERROR:', err.stack);
    res.status(500).json({ message: 'Непредвиденная ошибка сервера' });
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    if (isProduction) {
        console.log('Running in production mode');
    } else {
        console.log('Running in development mode');
    }
    console.log(`Client URL configured for CORS: ${process.env.CLIENT_URL}`);
});
