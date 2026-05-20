const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

if (!global.movieproSessions) global.movieproSessions = {};

module.exports = async ({ sock, from, msg, args }) => {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    // === පියවර 2: අංකය රිප්ලයි කළාම ෆිල්ම් එක ඩවුන්ලෝඩ් කරලා වට්සැප් එකට යැවීම ===
    if (global.movieproSessions[from] && !text.startsWith('.')) {
        const session = global.movieproSessions[from];
        const choice = parseInt(text.trim());

        if (!isNaN(choice) && choice > 0 && choice <= session.links.length) {
            const selectedLink = session.links[choice - 1];
            let directDownloadUrl = selectedLink.url;

            // Pixeldrain ලින්ක් එකක් නම් API එකට හැරවීම
            if (directDownloadUrl.includes('pixeldrain.com/u/')) {
                directDownloadUrl = directDownloadUrl.replace('/u/', '/api/file/');
            }

            await sock.sendMessage(from, { text: `📥 *${session.title}* (${selectedLink.text}) චිත්‍රපටය සර්වර් එකට බාගත වෙමින් පවතී...` });

            const filePath = `./${session.title.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;

            try {
                const response = await axios({
                    method: 'GET',
                    url: directDownloadUrl,
                    responseType: 'stream',
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

                writer.on('finish', async () => {
                    const captionText = `🎬 *${session.title}*\n⭐ *Quality:* ${selectedLink.text}\n\n*Apex-MD Movie Paradise* 🍿`;

                    await sock.sendMessage(from, {
                        video: { url: filePath },
                        mimetype: 'video/mp4',
                        caption: captionText
                    });

                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                });

                writer.on('error', async (err) => {
                    console.error(err);
                    await sock.sendMessage(from, { text: '❌ වීඩියෝව බාගත කිරීමේදී සර්වර් දෝෂයක් ඇති විය.' });
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                });

            } catch (error) {
                console.error(error);
                await sock.sendMessage(from, { text: '❌ ලින්ක් එක ක්‍රියා විරහිතයි හෝ බාගත කිරීමට නොහැක.' });
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }

            delete global.movieproSessions[from];
            return;
        }
    }

    // === පියවර 1: .moviepro කමාන්ඩ් එකෙන් සයිට් එකෙන් සර්ච් කිරීම ===
    if (!text.startsWith('.moviepro')) return;
    if (!args) return await sock.sendMessage(from, { text: '❌ කරුණාකර සෙවිය යුතු චිත්‍රපටයේ නම ඇතුළත් කරන්න!\n\n_Example: .moviepro Spiderman_' });

    await sock.sendMessage(from, { text: `🔍 *"${args}"* සඳහා MoviePro පිරික්සමින් පවතී...` });

    try {
        const searchUrl = `https://moviepro.lk/?s=${encodeURIComponent(args)}`;
        const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const results = [];

        $('article').each((index, element) => {
            if (index < 1) { // පළමු ප්‍රතිඵලය පමණක් ගනී
                const title = $(element).find('.entry-title a').text().trim();
                const link = $(element).find('.entry-title a').attr('href');
                if (title && link) results.push({ title, link });
            }
        });

        if (results.length === 0) {
            return await sock.sendMessage(from, { text: '❌ කණගාටුයි, MoviePro එකෙන් ඒ නමින් චිත්‍රපටයක් සොයාගත නොහැකි විය.' });
        }

        const movie = results[0];
        const pageData = await axios.get(movie.link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $moviePage = cheerio.load(pageData.data);

        let movieLinks = [];
        let posterUrl = $moviePage('.entry-content img').first().attr('src');

        $moviePage('a').each((i, el) => {
            const href = $moviePage(el).attr('href');
            let linkText = $moviePage(el).text().trim();

            // Pixeldrain හෝ වෙනත් ඩිරෙක්ට් ලින්ක්ස් ඇදලා ගැනීම
            if (href && (href.includes('pixeldrain.com') || href.includes('directlink'))) {
                if (href.includes('1080p')) linkText = 'WEB-DL 1080p';
                else if (href.includes('720p')) linkText = 'WEB-DL 720p';
                else if (href.includes('480p')) linkText = 'WEB-DL 480p';
                else if (!linkText || linkText.length > 20) linkText = `Download Link ${i + 1}`;
                
                if (movieLinks.length < 5 && !movieLinks.some(l => l.url === href)) {
                    movieLinks.push({ text: linkText, url: href });
                }
            }
        });

        if (movieLinks.length === 0) {
            return await sock.sendMessage(from, { text: '❌ මෙම චිත්‍රපටය සෘජුවම බාගත කරගත හැකි Pixeldrain ලින්ක් එකක් හමුනොවීය.' });
        }

        global.movieproSessions[from] = {
            title: movie.title,
            links: movieLinks
        };

        let menuText = `🎬 *${movie.title}* \n\n📥 *MOVIEPRO DOWNLOAD LINKS :*\n`;
        movieLinks.forEach((link, idx) => {
            menuText += `\n${idx + 1}️⃣ ${link.text}`;
        });
        menuText += `\n\n*REPLY WITH A NUMBER* \n_(වීඩියෝව කෙලින්ම වට්සැප් වෙත ගෙන්වා ගැනීමට අදාළ අංකය පමණක් රිප්ලයි කරන්න)_`;

        if (posterUrl) {
            await sock.sendMessage(from, { image: { url: posterUrl }, caption: menuText });
        } else {
            await sock.sendMessage(from, { text: menuText });
        }

    } catch (error) {
        console.error(error);
        await sock.sendMessage(from, { text: '❌ සෙවීමේදී යම් දෝෂයක් සිදු විය.' });
    }
};
