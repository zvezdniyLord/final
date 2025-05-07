-- Таблица для пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    company VARCHAR(255),
    activity_sphere VARCHAR(255),
    city VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE,
    is_support BOOLEAN DEFAULT FALSE -- Для сотрудников техподдержки
);

-- Таблица для статусов заявок
CREATE TABLE IF NOT EXISTS ticket_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- 'open', 'in_progress', 'waiting_for_user', 'closed'
    description TEXT
);

-- Таблица для хранения email-сообщений (опционально, для аудита и связи, если парсер писем отдельный)
CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    thread_id VARCHAR(255) NOT NULL,      -- Идентификатор цепочки сообщений
    subject VARCHAR(255) NOT NULL,        -- Тема письма
    body TEXT NOT NULL,                   -- Содержимое письма
    from_email VARCHAR(255) NOT NULL,     -- Адрес отправителя
    is_outgoing BOOLEAN NOT NULL DEFAULT FALSE, -- Флаг, является ли письмо исходящим (от системы)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL -- ID пользователя, если письмо связано с пользователем системы
    -- is_closed BOOLEAN DEFAULT FALSE, -- Это поле больше подходит для tickets
);

-- Таблица для заявок (тикетов)
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(20) NOT NULL UNIQUE, -- Уникальный читаемый номер заявки
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Пользователь, создавший заявку
    subject VARCHAR(255) NOT NULL,
    status_id INTEGER NOT NULL REFERENCES ticket_statuses(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE, -- Время закрытия заявки (NULL для открытых)
    email_thread_id VARCHAR(255) UNIQUE -- Уникальный идентификатор треда для email переписки по этой заявке
);

-- Таблица для сообщений в рамках заявки
CREATE TABLE IF NOT EXISTS ticket_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    message_number INTEGER, -- Порядковый номер сообщения в заявке (будет генерироваться триггером)
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'support')), -- 'user' или 'support'
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- ID пользователя или сотрудника поддержки (если они есть в users)
    sender_email VARCHAR(255) NOT NULL, -- Email фактического отправителя сообщения
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE, -- Прочитано ли сообщение (например, техподдержкой или пользователем)
    email_id INTEGER REFERENCES emails(id) ON DELETE SET NULL, -- Связь с конкретным письмом в таблице emails (если есть)
    email_message_id VARCHAR(255) -- Message-ID из email заголовка (если пришло по email)
    -- in_reply_to VARCHAR(255) -- Message-ID письма, на которое это ответ (если пришло по email)
);

-- Таблица для вложений к сообщениям заявок
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES ticket_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL, -- Путь к файлу на сервере
    file_size INTEGER NOT NULL,      -- Размер файла в байтах
    mime_type VARCHAR(100) NOT NULL, -- MIME-тип файла
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для документов (админка)
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- Например, 'pdf', 'docx'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для видео (админка)
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    thumbnail_path VARCHAR(255), -- Путь к миниатюре видео
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- --- НАЧАЛЬНОЕ ЗАПОЛНЕНИЕ И ФУНКЦИИ/ТРИГГЕРЫ ---

-- Заполним таблицу статусов
INSERT INTO ticket_statuses (name, description) VALUES
('open', 'Открыта, ожидает ответа поддержки'),
('in_progress', 'В работе у техподдержки'),
('waiting_for_user', 'Ожидается ответ от пользователя'),
('closed', 'Закрыта')
ON CONFLICT (name) DO NOTHING;


-- Функция для автоматического обновления поля updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для таблиц, где нужно автообновление updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Функция для генерации уникального номера заявки
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    generated_number VARCHAR(20);
    timestamp_part VARCHAR(14);
    random_part VARCHAR(6);
    exists_count INTEGER;
BEGIN
    LOOP
        timestamp_part := to_char(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS');
        random_part := lpad(floor(random() * 1000000)::text, 6, '0');
        generated_number := timestamp_part || random_part;

        SELECT COUNT(*) INTO exists_count
        FROM tickets t
        WHERE t.ticket_number = generated_number;

        IF exists_count = 0 THEN
            EXIT;
        END IF;
    END LOOP;
    RETURN generated_number;
END;
$$ LANGUAGE plpgsql;


-- Функция для генерации порядкового номера сообщения в заявке
CREATE OR REPLACE FUNCTION generate_message_number()
RETURNS TRIGGER AS $$
DECLARE
    last_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(tm.message_number), 0) INTO last_number
    FROM ticket_messages tm
    WHERE tm.ticket_id = NEW.ticket_id;

    NEW.message_number = last_number + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического присвоения номера сообщению
DROP TRIGGER IF EXISTS set_message_number ON ticket_messages;
CREATE TRIGGER set_message_number
BEFORE INSERT ON ticket_messages
FOR EACH ROW
EXECUTE FUNCTION generate_message_number();


-- Функция для автоматической установки/сброса closed_at в заявках
CREATE OR REPLACE FUNCTION handle_ticket_closure_status()
RETURNS TRIGGER AS $$
DECLARE
    closed_status_id INTEGER;
BEGIN
    SELECT id INTO closed_status_id FROM ticket_statuses WHERE name = 'closed';

    IF TG_OP = 'INSERT' THEN
        IF NEW.status_id = closed_status_id THEN
            NEW.closed_at = CURRENT_TIMESTAMP;
        ELSE
            NEW.closed_at = NULL;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status_id = closed_status_id AND (OLD.status_id IS NULL OR OLD.status_id != closed_status_id) THEN
            NEW.closed_at = CURRENT_TIMESTAMP;
        ELSIF NEW.status_id != closed_status_id AND OLD.status_id = closed_status_id THEN
            NEW.closed_at = NULL;
        END IF;
        -- Если status_id не меняется, closed_at остается без изменений (NEW.closed_at = OLD.closed_at по умолчанию)
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для closed_at
DROP TRIGGER IF EXISTS set_ticket_closed_at_on_insert ON tickets;
CREATE TRIGGER set_ticket_closed_at_on_insert
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION handle_ticket_closure_status();

DROP TRIGGER IF EXISTS update_ticket_closed_at_on_status_change ON tickets;
CREATE TRIGGER update_ticket_closed_at_on_status_change
BEFORE UPDATE OF status_id ON tickets -- Срабатывает только при изменении status_id
FOR EACH ROW
WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id)
EXECUTE FUNCTION handle_ticket_closure_status();


-- Индексы (если еще не созданы ранее, CREATE INDEX IF NOT EXISTS обработает это)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_email_thread_id ON tickets(email_thread_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_type ON ticket_messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_email_id ON ticket_messages(email_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_message_id ON ticket_attachments(message_id);
