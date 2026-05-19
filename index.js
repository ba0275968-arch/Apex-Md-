const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

async function startApexBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    // ප්ලගින්ස් ලෝඩ් කරන කොටස
    const plugins = {};
    const pluginsDir = path.join(__dirname, 'plugins');
    
    if (!fs.existsSync(pluginsDir)){
        fs.mkdirSync(pluginsDir);
    }

    // ෆෝල්ඩර් එකේ තියෙන හැම js ෆයිල් එකක්ම කියවීම
    const pluginFiles = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
        const commandName = file.replace('.js', '');
        plugins[commandName] = require(path.join(pluginsDir, file));
        console.log(`📁 Loaded Plugin: .${commandName}`);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if(qr) {
            console.log('⚡ Apex-MD QR Code එක ස්කෑන් කරන්න:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startApexBot();
        } else if (connection === 'open') {
            console.log('🟩 Apex-MD Plugins සමඟ සාර්ථකව සක්‍රීය වුණා!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        if (!text || !text.startsWith('.')) return;
        
        const args = text.split(' ');
        const command = args[0].slice(1).toLowerCase(); // . අයින් කරලා කමාන්ඩ් එක විතරක් ගැනීම
        const cmdArgs = args.slice(1).join(' ');

        // ප්ලගින් එකක් තියෙනවා නම් ඒක රන් කිරීම
        if (plugins[command]) {
            try {
                await plugins[command]({ sock, from, msg, args: cmdArgs });
            } catch (err) {
                console.error(err);
                await sock.sendMessage(from, { text: '❌ මෙම කමාන්ඩ් එක ක්‍රියාත්මක කිරීමේදී දෝෂයක් ඇති විය.' });
            }
        }
    });
}

startApexBot(); 
