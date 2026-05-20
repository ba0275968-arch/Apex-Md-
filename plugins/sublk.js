const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

if (!global.sublkSessions) global.sublkSessions = {};

module.exports = async ({ sock, from, msg, args }) => {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (global.sublkSessions[from] && !text.startsWith('.')) {
        const session = global.sublkSessions[from];
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
                    await sock.sendMessage(from, { video: { url: filePath }, mimetype: 'video/mp4', caption: `🎬 *${session.title}*\n\n*Apex-MD SubLK*` });
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                });
                writer.on('error', async () => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); });
            } catch (error) { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
            delete global.sublkSessions[from];
            return;
        }
    }

    if (!text.startsWith('.sublk')) return;
    if (!args) return await sock.sendMessage(from, { text: '❌ කරුණාකර සෙවිය යුතු නම ඇතුළත් කරන්න! (eg: .sublk Avatar)' });

    await sock.sendMessage(from, { text: `🔍 *"${args}"* සඳහා SubLK පිරික්සමින් පවතී...` });

    try {
        const searchUrl = `https://sublk.lk/?s=${encodeURIComponent(args)}`;
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

        const movie = results[0];
        const pageData = await axios.get(movie.link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $page = cheerio.load(pageData.data);
        let links = [];
        let posterUrl = $page('.entry-content img').first().attr('src');

        $page('a').each((i, el) => {
            const href = $page(el).attr('href');
            let linkText = $page(el).text().trim();
            if (href && href.includes('pixeldrain.com')) {
                if (href.includes('1080p')) linkText = 'WEB-DL 1080p';
                else if (href.includes('720p')) linkText = 'WEB-DL 720p';
                else if (href.includes('480p')) linkText = 'WEB-DL 480p';
                else if (!linkText || linkText.length > 20) linkText = `Download Link ${i + 1}`;
                if (links.length < 5 && !links.some(l => l.url === href)) links.push({ text: linkText, url: href });
            }
        });

        if (links.length === 0) return await sock.sendMessage(from, { text: '❌ බාගත හැකි සෘජු ලින්ක්ස් හමුනොවීය.' });

        global.sublkSessions[from] = { title: movie.title, links: links };
        let menuText = `🎬 *${movie.title}*\n\n📥 *SUBLK DOWNLOAD LINKS :*\n`;
        links.forEach((link, idx) => { menuText += `\n${idx + 1}️⃣ ${link.text}`; });
        menuText += `\n\n*REPLY WITH A NUMBER*`;

        if (posterUrl) await sock.sendMessage(from, { image: { url: posterUrl }, caption: menuText });
        else await sock.sendMessage(from, { text: menuText });
    } catch (error) { await sock.sendMessage(from, { text: '❌ දෝෂයක් සිදු විය.' }); }
};
