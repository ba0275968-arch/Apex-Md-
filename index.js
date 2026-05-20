const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, jidDecode, fetchLatestBaileysVersion, generateForwardMessageContent, prepareWAMessageMedia, generateWAMessageFromContent, generateMessageID, downloadContentFromMessage, makeInMemoryStore, jidNormalizedUser, delay } = require('@whiskeysockets/baileys')
const { state, saveCreds } = useMultiFileAuthState(__dirname + '/auth_info_baileys/')
const { smsg, isUrl, generateWAMessage } = require('./lib/tiny')
const axios = require('axios')
const fs = require('fs')
const pino = require('pino')
const path = require('path')
const express = require('express')
const app = express()
const port = process.env.PORT || 8000

// ================= [ වැදගත්ම කොටස ] =================
// ⚠️ මෙතන තියෙන නම්බර් එක මකලා, ඔයා බොට් කරන්න හදන වට්සැප් නම්බර් එක රටේ කෝඩ් එකත් එක්කම (94...) ඇතුළත් කරන්න.
// ❌ (මුලට + ලකුණ හෝ බිංදුව දාන්න එපා. eg: '94771234567')
const phoneNumber = "94753245703"; 
// ====================================================

const { cmd, commands } = require('./command')

// 📂 ප්ලගින්ස් රික්වයර් කිරීම
require('./plugins/alive')
require('./plugins/song')
require('./plugins/menu')
require('./plugins/baiscope')
require('./plugins/cinesubz')
require('./plugins/moviepro')
require('./plugins/cartoonslk')
require('./plugins/animost')
require('./plugins/sinhalacartoons')
require('./plugins/sublk')
require('./plugins/zoomlk')
require('./plugins/animeclub')
require('./plugins/sinhalasub')

app.get('/', (req, res) => { res.send('Apex-MD Pairing Mode is Running Successfully!') })
app.listen(port, () => { console.log(`Server is running on port ${port}`) })

async function startBot() {
  const { version, isLatest } = await fetchLatestBaileysVersion()
  
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false, // ❌ QR Code එක පෙන්වීම ඕෆ් කර ඇත
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"]
  })

  // 🚀 Pairing Code එකක් රෙන්ඩර් ලොග්ස් වල ජෙනරේට් කිරීම
  if (!sock.authState.creds.registered) {
    await delay(3000);
    let code = await sock.requestPairingCode(phoneNumber.trim());
    code = code?.match(/.{1,4}/g)?.join("-") || code;
    console.log(`\n🔑 =============== [ APEX-MD PAIRING CODE ] ===============`);
    console.log(`\nYOUR CODE : ${code}`);
    console.log(`\n===========================================================\n`);
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) { startBot() }
    } else if (connection === 'open') {
      console.log('Apex-MD Connected Successfully! ✅')
      let userJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'
      let welcomeText = `*Apex-MD WhatsApp Bot Connected Successfully! ✅*\n\n🤖 *Bot Status:* Active\n📅 *Date:* ${new Date().toLocaleDateString()}\n💡 *Tip:* Type \`.menu\` to see all available commands.`
      await sock.sendMessage(userJid, { text: welcomeText })
    }
  })

  sock.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0]
      if (!mek.message) return
      mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
      if (mek.key && mek.key.remoteJid === 'status@broadcast') return
      let m = smsg(sock, mek, store)
      let from = m.key.remoteJid
      let type = Object.keys(mek.message)[0]
      let body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type === 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : (type === 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : ''
      
      let isCmd = body.startsWith('.') || body.startsWith('#')
      let command = isCmd ? body.slice(1).trim().split(/ +/).shift().toLowerCase() : ''
      let args = body.trim().split(/ +/).slice(1).join(' ')

      const events = commands.find((cmd) => cmd.pattern === command) || commands.find((cmd) => cmd.alias && cmd.alias.includes(command))
      if (events) {
         await events.function(sock, from, m, mek, { args, text: args, body, isCmd, command, reply: async (text) => await sock.sendMessage(from, { text: text }, { quoted: m }) })
      }

      const allPlugins = ['cinesubz', 'baiscope', 'moviepro', 'cartoonslk', 'animost', 'sinhalacartoons', 'sublk', 'zoomlk', 'animeclub', 'sinhalasub']
      for (const pl of allPlugins) {
         try {
             const pluginFunc = require(`./plugins/${pl}`)
             await pluginFunc({ sock, from, msg: mek, args })
         } catch (e) {}
      }
    } catch (err) { console.log(err) }
  })
}

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })
startBot()
