const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, jidDecode, fetchLatestBaileysVersion, generateForwardMessageContent, prepareWAMessageMedia, generateWAMessageFromContent, generateMessageID, downloadContentFromMessage, makeInMemoryStore, jidNormalizedUser } = require('@whiskeysockets/baileys')
const { state, saveCreds } = useMultiFileAuthState(__dirname + '/auth_info_baileys/')
const { smsg, isUrl, generateWAMessage } = require('./lib/tiny')
const axios = require('axios')
const fs = require('fs')
const pino = require('pino')
const path = require('path')
const express = require('express')
const app = express()
const port = process.env.PORT || 8000

// === ප්ලගින් සිස්ටම් එක හඳුන්වා දීම ===
const { cmd, commands } = require('./command')

// 📂 පැරණි ප්ලගින්ස් ටික රික්වයර් කිරීම
require('./plugins/alive')
require('./plugins/song')
require('./plugins/menu')
require('./plugins/baiscope')
require('./plugins/cinesubz')

// 🔥 අලුතින්ම එකතු කරපු සයිට් 8හි ප්ලගින්ස් ටික
require('./plugins/moviepro')
require('./plugins/cartoonslk')
require('./plugins/animost')
require('./plugins/sinhalacartoons')
require('./plugins/sublk')
require('./plugins/zoomlk')
require('./plugins/animeclub')
require('./plugins/sinhalasub')

app.get('/', (req, res) => {
  res.send('Apex-MD WhatsApp Bot is Running Successfully!')
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})

async function startBot() {
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(`Using Baileys v${version.join('.')}, isLatest: ${isLatest}`)

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect)
      if (shouldReconnect) {
        startBot()
      }
    } else if (connection === 'open') {
      console.log('Apex-MD Connected Successfully! ✅')
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
      
      let isCmd = body.startsWith('.')
      let command = isCmd ? body.slice(1).trim().split(/ +/).shift().toLowerCase() : ''
      let args = body.trim().split(/ +/).slice(1).join(' ')

      // ප්ලගින් එකක් ඇතුළේ තියෙන හැම කමාන්ඩ් එකක්ම ක්‍රියාත්මක කිරීම
      const events = commands.find((cmd) => cmd.pattern === command) || commands.find((cmd) => cmd.alias && cmd.alias.includes(command))
      
      // හැම ප්ලගින් එකකටම අවශ්‍ය variables ටික පාස් කිරීම
      if (events) {
         await events.function(sock, from, m, mek, { args, text: args, body, isCmd, command, reply: async (text) => await sock.sendMessage(from, { text: text }, { quoted: m }) })
      }

      // අංක රිප්ලයි කරන සිස්ටම් එක වැඩ කිරීමට (Session Listener)
      const allPlugins = ['moviepro', 'cartoonslk', 'animost', 'sinhalacartoons', 'sublk', 'zoomlk', 'animeclub', 'sinhalasub']
      for (const pl of allPlugins) {
         try {
             const pluginFunc = require(`./plugins/${pl}`)
             await pluginFunc({ sock, from, msg: mek, args })
         } catch (e) {
             // ඉග්නෝර් කරන්න
         }
      }

    } catch (err) {
      console.log(err)
    }
  })
}

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })
startBot()
