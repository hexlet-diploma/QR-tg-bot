import qr from 'qr-image';
import fs from 'fs';

// Generate QR code for the bot's username
const qrCode = qr.image('@your_bot_username', {
    type: 'png',
    size: 20,
    margin: 1
});

// Save it as bot-avatar.png
const writeStream = fs.createWriteStream('bot-avatar.png');
qrCode.pipe(writeStream);

writeStream.on('finish', () => {
    console.log('Avatar generated successfully!');
}); 