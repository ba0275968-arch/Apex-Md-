const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

if (!global.cartoonslkSessions) global.cartoonslkSessions = {};

module.exports = async ({ sock, from, msg, args }) => {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (global.cartoonslkSessions[from] && !text.startsWith('.')) {
        const session = global.cartoonslkSessions[from];
        const choice = parseInt(text.trim());

        if (!isNaN(choice) && choice > 0 && choice <= session.links.length) {
            const selectedLink = session.links[choice - 1];
            let directDownloadUrl = selectedLink.url;

            if (directDownloadUrl.includes('pixeldrain.com/u/')) {
                directDownloadUrl = directDownloadUrl.replace('/u/', '/api/file/');
            }

            await sock.sendMessage(from, { text: `📥 *${session.title}* වීඩියෝව සර්වර් එකට බාගත වෙමින් පවතී...` });
            const filePath = `./${session.title.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;

            try {
                const response = await axios({ method: 'GET', url: directDownloadUrl, responseType: 'stream', headers: { 'User-Agent': 'Mozilla/5.0' } });
                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

                writer.on('finish', async () => {
                    await sock.sendMessage(from, { video: { url: filePath }, mimetype: 'video/mp4', caption: `🎬 *${session.title}*\n\n*Apex-MD Cartoons.lk*` });
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                });
                writer.on('error', async () => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); });
            } catch (error) { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
            delete global.cartoonslkSessions[from];
            return;
        }
    }

    if (!text.startsWith('.cartoonslk')) return;
    if (!args) return await sock.sendMessage(from, { text: '❌ කරුණාකර සෙවිය යුතු නම ඇතුළත් කරන්න! (eg: .cartoonslk Avatar)' });

    await sock.sendMessage(from, { text: `🔍 *"${args}"* සඳහා Cartoons.lk පිරික්සමින් පවතී...` });

    try {
        const searchUrl = `https://cartoons.lk/?s=${encodeURIComponent(args)}`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const results = [];

        $('article').each((index, element) => {
            if (index < 1) {
                const title = $(element).find('.entry-title a').text().trim();
                const link = $(element).find('.entry-title a').attr('href');
                if (title && link) results.push({ title, link });
            }
        });

        if (results.length === 0) return await sock.sendMessage(from, { text: '❌ කිසිවක් සොයාගත නොහැකි විය.' });

        const anime = results[0];
        const pageData = await axios.get(anime.link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $page = cheerio.load(pageData.data);
        let links = [];
        let posterUrl = $page('.entry-content img').first().attr('src');

        $page('a').each((i, el) => {
            const href = $page(el).attr('href');
            let linkText = $page(el).text().trim();
            if (href && href.includes('pixeldrain.com')) {
                if (!linkText || linkText.length > 20) linkText = `Download Link ${i + 1}`;
                if (links.length < 5 && !links.some(l => l.url === href)) links.push({ text: linkText, url: href });
            }
        });

        if (links.length === 0) return await sock.sendMessage(from, { text: '❌ බාගත හැකි සෘජු ලින්ක්ස් හමුනොවීය.' });

        global.cartoonslkSessions[from] = { title: anime.title, links: links };
        let menuText = `🎬 *${anime.title}*\n\n📥 *CARTOONS.LK LINKS :*\n`;
        links.forEach((link, idx) => { menuText += `\n${idx + 1}️⃣ ${link.text}`; });
        menuText += `\n\n*REPLY WITH A NUMBER*`;

        if (posterUrl) await sock.sendMessage(from, { image: { url: posterUrl }, caption: menuText });
        else await sock.sendMessage(from, { text: menuText });
    } catch (error) { await sock.sendMessage(from, { text: '❌ දෝෂයක් සිදු විය.' }); }
};
