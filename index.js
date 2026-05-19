const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

async function startApexBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if(qr) {
            console.log('⚡ Apex-MD QR Code එක ස්කෑන් කරන්න:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔄 සම්බන්ධතාවය බිඳ වැටුණා. නැවත සම්බන්ධ වෙනවා...', shouldReconnect);
            if (shouldReconnect) {
                startApexBot();
            }
        } else if (connection === 'open') {
            console.log('🟩 Apex-MD සාර්ථකව සක්‍රීය වුණා!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (text === '.alive') {
            await sock.sendMessage(from, { text: '🤖 *Apex-MD සක්‍රීයයි!* \n\nපැය 24ම වැඩ කරන්න මම ලෑස්තියි මචං. ⚡' });
        }
        if (text === '.menu') {
            await sock.sendMessage(from, { text: '⚡ *APEX-MD COMMAND MENU* ⚡\n\n🟢 .alive\n🟢 .ping' });
        }
        if (text === '.ping') {
            await sock.sendMessage(from, { text: '🚀 *Pong!* Apex-MD සුපිරියටම වැඩ.' });
        }
    });
}

startApexBot();
