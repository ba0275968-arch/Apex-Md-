const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

module.exports = async ({ sock, from, msg, args }) => {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    
    // බයිස්කෝප් සෙෂන් එකේදී අංකයක් එව්වොත් වීඩියෝව බාගත කිරීම
    if (global.baiscopeSessions[from] && !text.startsWith('.')) {
        const session = global.baiscopeSessions[from];
        const choice = parseInt(text.trim());
        
        if (!isNaN(choice) && choice > 0 && choice <= session.links.length) {
            const selectedLink = session.links[choice - 1];
            await sock.sendMessage(from, { text: `⏳ *${session.title}* බාගත වේ...` });
            
            const filePath = `./${session.title.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;
            
            try {
                const response = await axios({ method: 'GET', url: selectedLink.url, responseType: 'stream', headers: { 'User-Agent': 'Mozilla/5.0' } });
                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);
                
                writer.on('finish', async () => {
                    await sock.sendMessage(from, { video: { url: filePath }, mimetype: 'video/mp4', caption: `🎥 ${session.title} (Baiscope.lk)` });
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                });
            } catch (err) {
                await sock.sendMessage(from, { text: '❌ බාගත කිරීමේ දෝෂයක්.' });
            }
            delete global.baiscopeSessions[from];
            return;
        }
    }

    // .baiscope කමාන්ඩ් එකෙන් සෙවීම
    if (!text.startsWith('.baiscope')) return;
    if (!args) return await sock.sendMessage(from, { text: '❌ චිත්‍රපටයේ නම ඇතුළත් කරන්න.' });

    const searchUrl = `https://www.baiscopelk.com/?s=${encodeURIComponent(args)}`;
    const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(data);
    const movieLink = $('.post-title a').first().attr('href');
    
    if (!movieLink) return await sock.sendMessage(from, { text: '❌ හමු නොවීය.' });
    
    const moviePage = await axios.get(movieLink, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $movie = cheerio.load(moviePage.data);
    let links = [];
    
    $movie('a').each((i, el) => {
        const href = $movie(el).attr('href');
        // බයිස්කෝප් එකේ ලින්ක්ස් වල pixeldrain/google drive තියෙන ඒවා පමණක් ගන්න
        if (href && (href.includes('pixeldrain.com') || href.includes('drive.google.com'))) {
            links.push({ text: 'Direct Download', url: href });
        }
    });

    if (links.length === 0) return await sock.sendMessage(from, { text: '❌ සෘජු ලින්ක්ස් හමු නොවීය.' });
    
    global.baiscopeSessions[from] = { title: $('h1').first().text(), links };
    let menu = `🎥 *${global.baiscopeSessions[from].title}* (Baiscope)\n\n`;
    links.forEach((l, i) => menu += `${i + 1} • ${l.text}\n`);
    menu += `\n💬 *අංකයක් රිප්ලයි කරන්න.*`;
    
    await sock.sendMessage(from, { text: menu });
};
