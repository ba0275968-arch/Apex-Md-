const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// සෙෂන්ස් සහ ග්ලෝබල් දත්ත
global.movieSessions = {};
global.baiscopeSessions = {};

async function startApexBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    const plugins = {};
    const pluginsDir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir);

    const pluginFiles = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
        plugins[file.replace('.js', '')] = require(path.join(pluginsDir, file));
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if(qr) qrcode.generate(qr, { small: true });
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startApexBot();
        } else if (connection === 'open') {
            console.log('🟩 Apex-MD Fully Active!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        const args = text.split(' ');
        const command = args[0].startsWith('.') ? args[0].slice(1).toLowerCase() : '';
        const cmdArgs = args.slice(1).join(' ');

        // 1. ප්ලගින් එකක් නම් (උදා: .menu, .cinesubz, .baiscope)
        if (command && plugins[command]) {
            await plugins[command]({ sock, from, msg, args: cmdArgs });
        }
        // 2. අංක 2 (Download Menu) ගැහුවොත්
        else if (text.trim() === '2') {
             await sock.sendMessage(from, { text: "📥 *Download Menu*\n\n1️⃣ `.cinesubz [නම]`\n2️⃣ `.baiscope [නම]`\n\n_අවශ්‍ය එක තෝරා රිප්ලයි කරන්න._" });
        }
        // 3. බයිස්කෝප් හෝ සිනෙසබ් සෙෂන් එකක් නම්
        else if (!command && global.baiscopeSessions && global.baiscopeSessions[from]) {
            await plugins['baiscope']({ sock, from, msg, args: '' });
        }
        else if (!command && global.movieSessions && global.movieSessions[from]) {
            await plugins['cinesubz']({ sock, from, msg, args: '' });
        }
    });
}

startApexBot();
