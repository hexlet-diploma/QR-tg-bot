import TelegramBot from "node-telegram-bot-api";
import qr from "qr-image";
import { config } from './config.js';
import { db } from './db/database.js';

const bot = new TelegramBot(config.botToken, { polling: true });
const Rate_Limit = 10;
const rateLimit = new Map();

// Initialize database
await db.init();

// Update daily stats every hour
setInterval(async () => {
    try {
        await db.updateDailyStats();
    } catch (error) {
        console.error('Error updating daily stats:', error);
    }
}, 3600000); // 1 hour

bot.setMyCommands([
	{command:'/start', description: 'Начальное приветствие'},
	{command:'/help', description: 'Помощь'}
])

function isValidUrl(string) {
    try {
        const url = new URL(string);
        // Check if it's a valid URL with http/https protocol
        if (!['http:', 'https:'].includes(url.protocol)) {
            return false;
        }
        // Check if it has a valid hostname (at least one dot for domain)
        if (!url.hostname.includes('.')) {
            return false;
        }
        // Check if the hostname is not just a TLD
        const parts = url.hostname.split('.');
        if (parts.length < 2 || parts[0].length === 0) {
            return false;
        }
        return true;
    } catch (err) {
        return false;
    }
}
function normalizeUrl(input) {
    if (/^https?:\/\//i.test(input)) {
        return input;
    }
    return `https://${input}`;
}

async function generateQrCode(url) {
    return new Promise((resolve, reject) => {
        const qrStream = qr.image(url, { 
            type: 'png',
            size: 10, 
            margin: 2
        });
        
        const chunks = [];
        qrStream.on('data', chunk => chunks.push(chunk));
        qrStream.on('error', reject);
        qrStream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

// Функция для экранирования специальных символов в Markdown
function escapeMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Функция для безопасного отображения URL
function formatUrl(url) {
    try {
        const urlObj = new URL(url);
        return `[${escapeMarkdown(url)}](${escapeMarkdown(url)})`;
    } catch (e) {
        return escapeMarkdown(url);
    }
}

function checkRateLimit(userId) {
	const now = Date.now();
	const timestamps = rateLimit.get(userId) || [];
	const recent = timestamps.filter(t => now - t < 60000);
	
	if (recent.length >= Rate_Limit) return false;
	
	recent.push(now);
	rateLimit.set(userId, recent);
	return true;
  }


async function handleError(chatId, error) {
    console.error(`Error in chat ${chatId}:`, error);
    
    let errorMessage = 'Произошла ошибка при генерации QR-кода. ';
    
    if (error.message.includes('parse entities')) {
        errorMessage += 'Проблема с форматированием ссылки. Попробуйте отправить ссылку без специальных символов.';
    } else if (error.message.includes('rate limit')) {
        errorMessage += 'Слишком много запросов. Пожалуйста, подождите минуту.';
    } else if (error.message.includes('invalid url')) {
        errorMessage += 'Некорректный формат ссылки. Пример: example.com или https://example.com';
    } else {
        errorMessage += 'Пожалуйста, попробуйте еще раз.';
    }
    
    await bot.sendMessage(chatId, errorMessage);
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
🛠 *Добро пожаловать в QR Generator Bot!*

Я помогу вам создать QR-код из любой ссылки.

📝 *Как использовать:*
1. Просто отправьте мне ссылку
2. Я автоматически исправлю её, если нужно
3. Вы получите готовый QR-код

🔹 *Поддерживаемые форматы:*
• example.com
• www.example.com
• https://example.com
• http://example.com

💡 *Особенности:*
• Автоматическое исправление ссылок
• Быстрая генерация
• Поддержка HTTP/HTTPS
• Максимальная длина: 2000 символов

Используйте /help для подробной справки
    `;
    
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
📌 *Как использовать бота:*

1. Отправьте любую ссылку
2. Бот автоматически:
   • Проверит корректность ссылки
   • Добавит протокол, если нужно
   • Сгенерирует QR-код

📝 *Примеры ссылок:*
• example.com
• www.example.com/path
• https://example.com
• http://example.net

⚠️ *Ограничения:*
• Максимальная длина: 2000 символов
• Только HTTP/HTTPS протоколы
• Не более 10 запросов в минуту

❓ *Если что-то не работает:*
• Проверьте формат ссылки
• Убедитесь, что ссылка не слишком длинная
• Подождите минуту, если превысили лимит запросов
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.on('message', async (msg) => {
    if (msg.text?.startsWith('/')) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text?.trim();

    // Track user with proper data
    if (msg.from) {
        const userData = {
            user_id: msg.from.id,
            username: msg.from.username || null,
            first_name: msg.from.first_name || null,
            last_name: msg.from.last_name || null
        };
        await db.upsertUser(userData);
    }

    if (!messageText || messageText.startsWith('/')) {
        return;
    }

    const startTime = Date.now();
    let success = false;
    let errorMessage = null;

    try {
        if (messageText.length > 2000) {
            errorMessage = 'Ссылка слишком длинная';
            return bot.sendMessage(chatId, '❌ Ссылка слишком длинная. Максимальная длина - 2000 символов.');
        }

        let url;
        try {
            url = normalizeUrl(messageText);
        } catch (e) {
            errorMessage = 'Неверный формат ссылки';
            return bot.sendMessage(chatId, '❌ Неверный формат ссылки.\n\nПримеры:\n• example.com\n• https://example.com');
        }

        if (!isValidUrl(url)) {
            errorMessage = 'Некорректная ссылка';
            return bot.sendMessage(chatId, '❌ Пожалуйста, отправьте корректную ссылку.\n\nПримеры:\n• example.com\n• https://example.com');
        }

        if (!checkRateLimit(userId)) {
            errorMessage = 'Превышен лимит запросов';
            return bot.sendMessage(chatId, '⏳ Слишком много запросов. Пожалуйста, подождите минуту.');
        }

        bot.sendChatAction(chatId, 'upload_photo');

        const qrImage = await generateQrCode(url);
        success = true;

        await bot.sendPhoto(chatId, qrImage, {
            caption: `🔗 ${formatUrl(url)}`,
            parse_mode: 'MarkdownV2'
        });

    } catch (error) {
        errorMessage = error.message;
        handleError(chatId, error);
    } finally {
        const responseTime = Date.now() - startTime;
        await db.logRequest(userId, messageText, success, responseTime, errorMessage);
    }
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

console.log('Bot started...');