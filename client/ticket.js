// ticket-details.js - для страницы деталей заявки
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация класса для работы с деталями заявки
    const ticketDetails = new TicketDetails();
    ticketDetails.init();
});

class TicketDetails {
    constructor() {
        // Элементы DOM
        this.ticketContainer = document.getElementById('ticketContainer');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.replyForm = document.getElementById('replyForm');
        this.closeTicketBtn = document.getElementById('closeTicketBtn');
        this.reopenTicketBtn = document.getElementById('reopenTicketBtn');

        // Состояние
        this.token = localStorage.getItem('token');
        this.ticketNumber = this.getTicketNumberFromUrl();
    }

    init() {
        // Проверка авторизации
        if (!this.token) {
            window.location.href = './auth.html';
            return;
        }

        // Проверка наличия номера заявки в URL
        if (!this.ticketNumber) {
            this.showError('Номер заявки не указан');
            return;
        }

        // Загрузка данных заявки
        this.loadTicketDetails();

        // Обработчики событий
        this.setupEventListeners();
    }

    // Получение номера заявки из URL
    getTicketNumberFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    setupEventListeners() {
        // Отправка формы ответа
        if (this.replyForm) {
            this.replyForm.addEventListener('submit', (e) => this.handleReplySubmit(e));
        }

        // Закрытие заявки
        if (this.closeTicketBtn) {
            this.closeTicketBtn.addEventListener('click', () => this.closeTicket());
        }

        // Повторное открытие заявки
        if (this.reopenTicketBtn) {
            this.reopenTicketBtn.addEventListener('click', () => this.reopenTicket());
        }
    }

    // Загрузка деталей заявки
    async loadTicketDetails() {
        try {
            if (this.ticketContainer) {
                this.ticketContainer.innerHTML = '<div class="loading">Загрузка данных заявки...</div>';
            }

            const response = await fetch(`http://localhost:5003/api/tickets/${this.ticketNumber}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = './auth.html';
                    return;
                }
                throw new Error('Ошибка загрузки заявки');
            }

            const data = await response.json();
            this.renderTicketDetails(data.ticket);
            this.renderMessages(data.messages);
            this.updateTicketActions(data.ticket.status);
        } catch (error) {
            console.error('Error loading ticket details:', error);
            this.showError('Не удалось загрузить данные заявки');
        }
    }

    // Отображение деталей заявки
    renderTicketDetails(ticket) {
        if (!this.ticketContainer) return;

        const statusClass = ticket.status === 'closed' ? 'status-closed' : 'status-open';
        const statusText = ticket.status === 'closed' ? 'ЗАКРЫТА' : 'ОТКРЫТА';

        this.ticketContainer.innerHTML = `
            <div class="ticket-header">
                <h2>Заявка #${ticket.ticket_number}</h2>
                <span class="ticket-status ${statusClass}">${statusText}</span>
            </div>
            <div class="ticket-info">
                <p class="ticket-subject">${ticket.subject}</p>
                <p class="ticket-date">Создана: ${new Date(ticket.created_at).toLocaleString()}</p>
                ${ticket.closed_at ? `<p class="ticket-date">Закрыта: ${new Date(ticket.closed_at).toLocaleString()}</p>` : ''}
            </div>
        `;
    }

    // Отображение сообщений заявки
    renderMessages(messages) {
        if (!this.messagesContainer) return;

        this.messagesContainer.innerHTML = '';

        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.sender_type === 'user' ? 'user-message' : 'support-message'}`;

            let attachmentsHtml = '';
            if (message.attachments && message.attachments.length > 0) {
                attachmentsHtml = `
                    <div class="message-attachments">
                        <h4>Вложения:</h4>
                        <ul>
                            ${message.attachments.map(attachment => `
                                <li>
                                    <a href="${attachment.file_path}" target="_blank" download="${attachment.file_name}">
                                        ${attachment.file_name} (${this.formatFileSize(attachment.file_size)})
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }

            messageElement.innerHTML = `
                <div class="message-header">
                    <span class="message-sender">${message.sender_type === 'user' ? 'Вы' : 'Техподдержка'}</span>
                    <span class="message-date">${new Date(message.created_at).toLocaleString()}</span>
                </div>
                <div class="message-body">
                    <p>${message.message.replace(/\n/g, '<br>')}</p>
                </div>
                ${attachmentsHtml}
            `;

            this.messagesContainer.appendChild(messageElement);
        });
    }

    // Обновление кнопок действий
    updateTicketActions(status) {
        if (status === 'closed') {
            if (this.closeTicketBtn) this.closeTicketBtn.style.display = 'none';
            if (this.reopenTicketBtn) this.reopenTicketBtn.style.display = 'block';
            if (this.replyForm) this.replyForm.style.display = 'none';
        } else {
            if (this.closeTicketBtn) this.closeTicketBtn.style.display = 'block';
            if (this.reopenTicketBtn) this.reopenTicketBtn.style.display = 'none';
            if (this.replyForm) this.replyForm.style.display = 'block';
        }
    }

    // Обработка отправки ответа
    async handleReplySubmit(e) {
        e.preventDefault();

        const replyMessageInput = document.getElementById('replyMessage');
        if (!replyMessageInput) return;

        const message = replyMessageInput.value.trim();

        if (!message) {
            this.showNotification('Введите текст сообщения', 'error');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('message', message);

            // Добавляем вложения, если есть
            const attachmentInput = document.getElementById('replyAttachmentInput');
            if (attachmentInput && attachmentInput.files.length > 0) {
                for (let i = 0; i < attachmentInput.files.length; i++) {
                    formData.append('attachments', attachmentInput.files[i]);
                }
            }

            const response = await fetch(`http://localhost:5003/api/tickets/${this.ticketNumber}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Ошибка отправки сообщения');
            }

            // Обновляем просмотр заявки
            this.loadTicketDetails();
            this.showNotification('Сообщение отправлено', 'success');

            // Очищаем форму ответа
            if (this.replyForm) {
                this.replyForm.reset();
            }
        } catch (error) {
            console.error('Error sending reply:', error);
            this.showNotification('Не удалось отправить сообщение', 'error');
        }
    }

    async handleEmailSubmit(e) {
        e.preventDefault();

        // Находим поля формы по их ID
        const ticketSubjectInput = document.getElementById('ticketSubject');
        const ticketMessageInput = document.getElementById('ticketMessage');

        if (!ticketSubjectInput || !ticketMessageInput) {
            this.showNotification('Ошибка: не найдены элементы формы', 'error');
            return;
        }

        const subject = ticketSubjectInput.value.trim();
        const message = ticketMessageInput.value.trim();

        if (!subject || !message) {
            this.showNotification('Пожалуйста, заполните все поля', 'error');
            return;
        }

        try {
            // Используем FormData для отправки данных (включая файлы, если нужно)
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('message', message);

            // Добавляем вложения, если есть (опционально)
            const attachmentInput = document.getElementById('attachmentInput');
            if (attachmentInput && attachmentInput.files.length > 0) {
                for (let i = 0; i < attachmentInput.files.length; i++) {
                    formData.append('attachments', attachmentInput.files[i]);
                }
            }

            // Отправляем запрос на сервер
            const response = await fetch('http://localhost:5003/api/tickets', {
                method: 'POST',
                headers: {
                    // 'Content-Type': 'application/json', // Убираем, если отправляем FormData
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData // Отправляем FormData
            });

            const result = await response.json();

            if (response.ok) {
                this.hideEmailForm(); // Закрываем форму
                this.showNotification('Заявка успешно отправлена', 'success');
                this.loadTickets(this.currentFilter); // Обновляем список заявок
            } else {
                this.showNotification(result.message || 'Не удалось отправить заявку', 'error');
            }
        } catch (error) {
            console.error('Error creating ticket:', error);
            this.showNotification('Ошибка сети. Не удалось отправить заявку.', 'error');
        }
    }

    // Закрытие заявки
    async closeTicket() {
        try {
            const response = await fetch(`http://localhost:5003/api/tickets/${this.ticketNumber}/close`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка закрытия заявки');
            }

            this.showNotification('Заявка успешно закрыта', 'success');
            this.loadTicketDetails();
        } catch (error) {
            console.error('Error closing ticket:', error);
            this.showNotification('Не удалось закрыть заявку', 'error');
        }
    }

    // Повторное открытие заявки
    async reopenTicket() {
        try {
            const response = await fetch(`http://localhost:5003/api/tickets/${this.ticketNumber}/reopen`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка открытия заявки');
            }

            this.showNotification('Заявка успешно открыта', 'success');
            this.loadTicketDetails();
        } catch (error) {
            console.error('Error reopening ticket:', error);
            this.showNotification('Не удалось открыть заявку', 'error');
        }
    }

    // Форматирование размера файла
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Показ уведомления
    showNotification(message, type) {
        const notification = document.getElementById('notification');
        if (!notification) return;

        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.remove('hidden');

        // Скрываем уведомление через 3 секунды
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }

    // Показ сообщения об ошибке
    showError(message) {
        if (this.ticketContainer) {
            this.ticketContainer.innerHTML = `<div class="error-message"><p>${message}</p></div>`;
        }
    }
}
