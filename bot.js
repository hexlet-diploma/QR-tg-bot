import TelegramBot from "node-telegram-bot-api";
import qr from "qr-image";


const token = "7686186521:AAG2NTCyTO2sZNscYuBdu7_tQw5OA1gaSVI";
const bot = new TelegramBot(token, { polling: process.env.NODE_ENV !== 'test' });
const Rate_Limit = 10;
export const rateLimit = new Map();


bot.setMyCommands([
	{command:'/start', description: 'Начальное приветствие'},
	{command:'/help', description: 'Помощь'}
])

// Export functions for testing
export function isValidUrl(string) {
    try {
        const url = new URL(string);
        return ['http:', 'https:'].includes(url.protocol);
    } catch (err) {
        return false;
    }
}

export function normalizeUrl(input) {
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

export function checkRateLimit(userId) {
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
	await bot.sendMessage(
	  chatId, 
	  'Произошла ошибка при генерации QR-кода. Пожалуйста, попробуйте еще раз.'
	);
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
	const welcomeSticker = 'https://tlgrm.ru/_/stickers/5fb/e86/5fbe8646-6371-463c-ba7d-bbc08ab0b860/6.webp';
    const welcomeMessage = `

🛠 *Добро пожаловать в QR Generator Bot!*

Отправьте мне ссылку, и я преобразую её в QR-код!

🔹 Примеры:
example.com
https://example.com
http://example.com

📝 *Особенности:*
Поддержка HTTP/HTTPS, Автоматическое исправление ссылок, Быстрая генерация

Используйте /help для справки
    `;
    
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
📌 *Как использовать бота:*      
Просто отправьте мне любую ссылку, я автоматически исправлю её, если нужно и вы получите готовый QR-код!

📝 *Примеры допустимых ссылок:*
- example.com
- www.example.com/path
- https://example.com
- http://example.net

🛠 *Технические ограничения:*
- Максимальная длина ссылки: 2000 символов
- Поддерживаются только HTTP/HTTPS протоколы
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.on('message', async (msg) => {
	if (msg.text?.startsWith('/')) return;

    const chatId = msg.chat.id;
	const userId = msg.from.id;
    const messageText = msg.text?.trim();


    if (!messageText || messageText.startsWith('/')) {
        return;
    }

    try {
        if (messageText.length > 2000) {
            return bot.sendMessage(chatId, 'Ссылка слишком длинная. Максимум 2000 символов.');
        }

        let url;
        try {
            url = normalizeUrl(messageText);
        } catch (e) {
            return bot.sendMessage(chatId, 'Неверный формат ссылки. Пример: example.com или https://example.com');
        }

        if (!isValidUrl(url)) {
            return bot.sendMessage(chatId, 'Поддерживаются только HTTP/HTTPS ссылки. Пример: https://example.com');
        }

        bot.sendChatAction(chatId, 'upload_photo');

        const qrImage = await generateQrCode(url);

        await bot.sendPhoto(chatId, qrImage, {
            caption: `🔗 ${url}`,
            parse_mode: 'Markdown'
        });

    } catch (error) {
        handleError(chatId, error);
    }
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

if (process.env.NODE_ENV !== 'test') {
    console.log('Bot started...');
}