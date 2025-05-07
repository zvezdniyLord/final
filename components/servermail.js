

const newUser = await pool.query(
  'INSERT INTO users (fio, email, password, position, company, fieldActivity, city, tel) VALUES (\$1, \$2, $3, \$4, \$5, \$6, \$7, \$8) RETURNING *',
  [fio, email, hashedPassword, position, company, fieldActivity, city, tel]
);

res.json({ message: 'Регистрация успешна' });
} catch (err) {
res.status(500).json({ error: err.message });
}
});


// Авторизация
app.post('/login', async (req, res) => {
try {
const { email, password } = req.body;

const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

if (user.rows.length === 0) {
  return res.status(401).json({ error: 'Пользователь не найден' });
}

const validPassword = await bcrypt.compare(password, user.rows[0].password);

if (!validPassword) {
  return res.status(401).json({ error: 'Неверный пароль' });
}

res.json({ message: 'Вход выполнен успешно' });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Получение данных пользователя
app.get('/user/:email', async (req, res) => {
try {
const { email } = req.params;
const user = await pool.query(
  'SELECT fio, email, position, company, fieldActivity, city, tel FROM users WHERE email = $1',
  [email]
);

if (user.rows.length === 0) {
  return res.status(404).json({ error: 'Пользователь не найден' });
}

res.json(user.rows[0]);
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Обновление данных пользователя
app.put('/user/:email', async (req, res) => {
try {
const { email } = req.params;
const { fio, position, company, fieldActivity, city, tel } = req.body;

const updatedUser = await pool.query(
  'UPDATE users SET fio = $1, position = $2, company = $3, fieldActivity = $4, city = $5, tel = $6 WHERE email = $7 RETURNING *',
  [fio, position, company, fieldActivity, city, tel, email]
);

if (updatedUser.rows.length === 0) {
  return res.status(404).json({ error: 'Пользователь не найден' });
}

res.json({ message: 'Данные обновлены успешно' });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Отправка письма
/*app.post('/send-email', async (req, res) => {
try {
const { userEmail, recipientEmail, subject, message } = req.body;

// Получаем ID пользователя
const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
if (userResult.rows.length === 0) {
  return res.status(404).json({ error: 'Пользователь не найден' });
}
const userId = userResult.rows[0].id;

// Отправляем письмо
await transporter.sendMail({
  from: 'aadavidenkoweb@yandex.ru',
  to: recipientEmail,
  subject: subject,
  text: message
});

// Сохраняем письмо в базе данных
await pool.query(
  'INSERT INTO emails (user_id, recipient_email, subject, message) VALUES (\$1, \$2, \$3, $4)',
  [userId, recipientEmail, subject, message]
);

res.json({ message: 'Письмо успешно отправлено' });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Получение писем пользователя
app.get('/emails/:userEmail', async (req, res) => {
try {
const { userEmail } = req.params;
const { folder } = req.query; // 'sent' или 'trash'

const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
if (userResult.rows.length === 0) {
  return res.status(404).json({ error: 'Пользователь не найден' });
}
const userId = userResult.rows[0].id;


        const isDeleted = folder === 'trash';
        const emails = await pool.query(
            'SELECT * FROM emails WHERE user_id = $1 AND is_deleted = $2 ORDER BY sent_date DESC',
            [userId, isDeleted]
        );

        res.json(emails.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Перемещение письма в корзину
app.put('/email/:id/trash', async (req, res) => {
    try {
        const { id } = req.params;
        const { userEmail } = req.body;

        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        const userId = userResult.rows[0].id;

        await pool.query(
            'UPDATE emails SET is_deleted = true WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        res.json({ message: 'Письмо перемещено в корзину' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Окончательное удаление письма
app.delete('/email/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userEmail } = req.body;

        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        const userId = userResult.rows[0].id;

        await pool.query(
            'DELETE FROM emails WHERE id = $1 AND user_id = $2 AND is_deleted = true',
            [id, userId]
        );

        res.json({ message: 'Письмо удалено' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});*/

// Обновленный эндпоинт отправки письма
app.post('/send-email', async (req, res) => {
  try {
      const { userEmail, subject, message } = req.body;
      const ADMIN_EMAIL = '4neroq4@gmail.com'; // Email администратора, куда будут приходить все письма

      // Получаем данные отправителя
      const userResult = await pool.query(
          'SELECT id, fio, email FROM users WHERE email = $1',
          [userEmail]
      );
      if (userResult.rows.length === 0) {
          return res.status(404).json({ error: 'Пользователь не найден' });
      }
      const user = userResult.rows[0];

      // Отправляем письмо
      await transporter.sendMail({
          from: 'aadavidenkoweb@yandex.ru',
          to: ADMIN_EMAIL,
          subject: subject,
          text: `От: ${user.fio} (${user.email})\n\n${message}`
      });

      // Сохраняем письмо в базе данных
      await pool.query(
          'INSERT INTO emails (user_id, recipient_email, subject, message, sender_name, sender_email) VALUES (\$1, \$2, \$3, \$4, \$5, $6)',
          [user.id, ADMIN_EMAIL, subject, message, user.fio, user.email]
      );

      res.json({ message: 'Письмо успешно отправлено' });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// Получение писем пользователя
app.get('/emails/:userEmail', async (req, res) => {
  try {
      const { userEmail } = req.params;
      const { folder } = req.query; // 'sent', 'inbox' или 'trash'

      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
      if (userResult.rows.length === 0) {
          return res.status(404).json({ error: 'Пользователь не найден' });
      }
      const userId = userResult.rows[0].id;

      let query;
      const isDeleted = folder === 'trash';


      if (folder === 'inbox') {
        // Для входящих писем (только для админа)
        query = {
            text: 'SELECT * FROM emails WHERE recipient_email = $1 AND is_deleted = $2 ORDER BY sent_date DESC',
            values: [userEmail, isDeleted]
        };
    } else {
        // Для исходящих писем
        query = {
            text: 'SELECT * FROM emails WHERE user_id = $1 AND is_deleted = $2 ORDER BY sent_date DESC',
            values: [userId, isDeleted]
        };
    }

    const emails = await pool.query(query);
    res.json(emails.rows);
} catch (err) {
    res.status(500).json({ error: err.message });
}
});

// Перемещение письма в корзину
app.put('/email/:id/trash', async (req, res) => {
try {
    const { id } = req.params;
    const { userEmail } = req.body;

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const userId = userResult.rows[0].id;

    await pool.query(
        'UPDATE emails SET is_deleted = true WHERE id = $1 AND user_id = $2',
        [id, userId]
    );

    res.json({ message: 'Письмо перемещено в корзину' });
} catch (err) {
    res.status(500).json({ error: err.message });
}
});

// Окончательное удаление письма
app.delete('/email/:id', async (req, res) => {
try {
    const { id } = req.params;
    const { userEmail } = req.body;

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const userId = userResult.rows[0].id;

    await pool.query(
        'DELETE FROM emails WHERE id = $1 AND user_id = $2 AND is_deleted = true',
        [id, userId]
    );

    res.json({ message: 'Письмо удалено' });
} catch (err) {
    res.status(500).json({ error: err.message });
}
});


app.listen(3000, () => {
console.log('Сервер запущен на порту 3000');
});
