const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

if (!global.movieSessions) global.movieSessions = {};

module.exports = async ({ sock, from, msg, args }) => {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    
    // === පියවර 2: යූසර් නම්බර් එකක් රිප්ලයි කලාම වීඩියෝ එක ඩවුන්ලෝඩ් කරලා යැවීම ===
    if (global.movieSessions[from] && !text.startsWith('.')) {
        const session = global.movieSessions[from];
        const choice = parseInt(text.trim());

        if (!isNaN(choice) && choice > 0 && choice <= session.links.length) {
            const selectedLink = session.links[choice - 1];
            
            // Pixeldrain ලින්ක් එක සෘජු බාගත කිරීමේ API ලින්ක් එකක් බවට හැරවීම
            let directDownloadUrl = selectedLink.url;
            if (directDownloadUrl.includes('pixeldrain.com/u/')) {
                directDownloadUrl = directDownloadUrl.replace('/u/', '/api/file/');
            }

            await sock.sendMessage(from, { text: `📥 *${session.title}* (${selectedLink.text}) වීඩියෝ ගොනුව සකසමින් පවතී... \n\n_සර්වර් එක හරහා ඩවුන්ලෝඩ් වන බැවින් සුළු මොහොතක් රැඳී සිටින්න._ ⏳` });
            
            // ෆයිල් එක තාවකාලිකව සේව් කරන්න නමක් හැදීම
            const filePath = `./${session.title.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;
            
            try {
                // සර්වර් එකට වීඩියෝ එක බාගැනීම
                const response = await axios({
                    method: 'GET',
                    url: directDownloadUrl,
                    responseType: 'stream',
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

                writer.on('finish', async () => {
                    // ඔයා එවපු Screenshot එකේ වගේම ලස්සන කැප්ෂන් එකක් හදමු
                    const captionText = `🎬 *${session.title}* \n🏁 *Quality:* ${selectedLink.text}\n\n🍿 *Movie Paradise* \n⚡ *Uploaded By Apex-MD*`;

                    // කෙලින්ම වීඩියෝ එක (Video file එකක් විදිහට) චැට් එකටම යැවීම
                    await sock.sendMessage(from, { 
                        video: { url: filePath }, 
                        mimetype: 'video/mp4',
                        caption: captionText
                    });

                    // ඉඩ ඉතිරි කරගන්න සර්වර් එකෙන් මැකීම
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

            delete global.movieSessions[from];
            return;
        }
    }

    // === පියවර 1: .cinesubz [නම] ගැහුවාම මුලින්ම මෙනුව දාන කොටස ===
    if (!text.startsWith('.cinesubz')) return;
    if (!args) return await sock.sendMessage(from, { text: '❌ *කරුණාකර චිත්‍රපටයේ නම ඇතුළත් කරන්න!* \n\nඋදා: `.cinesubz Necropolis`' });

    await sock.sendMessage(from, { text: `🔍 *"${args}"* සඳහා ලින්ක්ස් සොයමින් පවතී...` });

    try {
        const searchUrl = `https://cinesubz.co/?s=${encodeURIComponent(args)}`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        const $ = cheerio.load(data);
        const results = [];

        $('article').each((index, element) => {
            if (index < 1) { 
                const title = $(element).find('.entry-title a').text().trim();
                const link = $(element).find('.entry-title a').attr('href');
                if (title && link) results.push({ title, link });
            }
        });

        if (results.length === 0) {
            return await sock.sendMessage(from, { text: '❌ කණගාටුයි, ඒ නමින් චිත්‍රපටයක් හමු නොවීය.' });
        }

        const movie = results[0];

        // ෆිල්ම් පිටුව ඇතුළට යාම
        const moviePage = await axios.get(movie.link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $movie = cheerio.load(moviePage.data);
        
        let movieLinks = [];
        let posterUrl = $movie('.entry-content img').first().attr('src'); // ෆිල්ම් පෝස්ටර් එක ගැනීම

        $movie('a').each((i, el) => {
            const href = $movie(el).attr('href');
            let linkText = $movie(el).text().trim();
            
            if (href && href.includes('pixeldrain.com')) {
                if (href.includes('1080p') || linkText.includes('1080p')) linkText = 'WEB-DL 1080p';
                else if (href.includes('720p') || linkText.includes('720p')) linkText = 'WEB-DL 720p';
                else if (href.includes('480p') || linkText.includes('480p')) linkText = 'WEB-DL 480p';
                else linkText = 'WEB-DL HD';
                
                if (movieLinks.length < 5 && !movieLinks.some(l => l.url === href)) {
                    movieLinks.push({ text: linkText, url: href });
                }
            }
        });

        if (movieLinks.length === 0) {
            return await sock.sendMessage(from, { text: `❌ මෙම චිත්‍රපටය සෘජුව බාගත හැකි මට්ටමේ නැත. සයිට් එකෙන් බලන්න:\n\n🔗 ${movie.link}` });
        }

        global.movieSessions[from] = {
            title: movie.title,
            links: movieLinks
        };

        // මෙනුව සකස් කිරීම
        let menuText = `🎥 *${movie.title}* \n\n📦 *AVAILABLE QUALITIES :*\n`;
        movieLinks.forEach((link, idx) => {
            let emoji = idx === 0 ? '🍿' : idx === 1 ? '🚀' : '👑';
            menuText += `\n${emoji} *${idx + 1}* • ${link.text}`;
        });
        menuText += `\n\n💬 *REPLY WITH A NUMBER* \n_(වීඩියෝව කෙලින්ම ගෙන්වා ගැනීමට අදාළ අංකය පමණක් රිප්ලයි කරන්න)_ \n\n🍿 *Movie Paradise* \n⚡ *Uploaded By Apex*`;

        // පෝස්ටර් එකක් තියෙනවා නම් ඒකත් එක්කම මෙනුව යැවීම
        if (posterUrl) {
            await sock.sendMessage(from, { image: { url: posterUrl }, caption: menuText });
        } else {
            await sock.sendMessage(from, { text: menuText });
        }

    } catch (error) {
        console.error(error);
        await sock.sendMessage(from, { text: '❌ තාක්ෂණික දෝෂයක් ඇති විය.' });
    }
};
