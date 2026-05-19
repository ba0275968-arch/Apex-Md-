const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// සෙෂන්ස් ගබඩාව
global.movieSessions = {};

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

        // මෙනු කමාන්ඩ් එක හෝ ප්ලගින්ස්
        if (command && plugins[command]) {
            await plugins[command]({ sock, from, msg, args: cmdArgs });
        }
        // අංක 2 ගැහුවොත් ඩවුන්ලෝඩ් මෙනුව
        else if (text.trim() === '2') {
             await sock.sendMessage(from, { text: "📥 *Download Menu*\n\n1️⃣ `.moviepro`\n2️⃣ `.sinhalasub`\n3️⃣ `.sublk`\n4️⃣ `.animeclub`\n5️⃣ `.animehaven`\n6️⃣ `.zoomlk`\n\n_අවශ්‍ය සයිට් එක තෝරා `.සයිට්_නම චිත්‍රපට_නම` ලෙස ලබාදෙන්න._" });
        }
        // සයිට් වල නම්බර් රිප්ලයි කිරීම් සඳහා (movies ප්ලගින් එකට යොමු කිරීම)
        else if (!command && global.movieSessions && global.movieSessions[from]) {
            await plugins['movies']({ sock, from, msg, args: '' });
        }
        // අලුත් සයිට්ස් ටික හැන්ඩ්ල් කිරීම
        else if (['cinesubz' , 'moviepro', 'sinhalasub', 'sublk', 'animeclub', 'animehaven', 'zoomlk'].includes(command)) {
            await plugins['movies']({ sock, from, msg, args: cmdArgs });
        }
    });
}

startApexBot();
