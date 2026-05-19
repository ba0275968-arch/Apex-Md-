module.exports = async ({ sock, from }) => {
    let menuText = `🚀 *SYSTEM ONLINE • FULLY ACTIVE*

┌─ [ ⚡ S Y S T E M ⚡ ] ──
│ 🚀 *VERSION :* 3.0
│ 🛰️ *NODE :* APP-13
│ 🧑‍💻 *OWNER :* Apex
│ ⌨️ *PREFIX :* [ . ]
└────────────────────

┌─ [ 📁 M E N U 📁 ] ──
│ 🧠 *1* | AI
│ 📥 *2* | DOWNLOAD
│ 👥 *3* | GROUP
│ ⚙️ *4* | MAIN
│ 🧑‍💻 *5* | OWNER
│ 🛠️ *6* | TOOLS
└────────────────────

✅ *REPLY WITH A NUMBER*

📖 *Movie Paradise* 📖`;

    await sock.sendMessage(from, { text: menuText });
};
