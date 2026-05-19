const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async ({ sock, from, args }) => {
    if (!args) return await sock.sendMessage(from, { text: '❌ *කරුණාකර චිත්‍රපටයේ නම ඇතුළත් කරන්න!* \n\nඋදා: `.cinesubz Spiderman`' });

    await sock.sendMessage(from, { text: `🎬 *"${args}"* චිත්‍රපටය Cinesubz වෙතින් සොයමින් පවතී...` });

    try {
        // Cinesubz සර්ච් කිරීම
        const searchUrl = `https://cinesubz.co/?s=${encodeURIComponent(args)}`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        
        const $ = cheerio.load(data);
        const results = [];

        $('article').each((index, element) => {
            if (index < 3) { 
                const title = $(element).find('.entry-title a').text().trim();
                const link = $(element).find('.entry-title a').attr('href');
                if (title && link) results.push({ title, link });
            }
        });

        if (results.length === 0) {
            return await sock.sendMessage(from, { text: '❌ කණගාටුයි, ඒ නමින් චිත්‍රපටයක් සොයා ගැනීමට නොහැකි විය.' });
        }

        const movie = results[0];
        await sock.sendMessage(from, { text: `🍿 *චිත්‍රපටය හමුභ වුණා:* ${movie.title}\n\n📥 බාගත කිරීමේ ලින්ක් (Movie Download Links) සොයමින් පවතී...` });

        // ෆිල්ම් එකේ පිටුව ඇතුළට යාම
        const moviePage = await axios.get(movie.link, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $movie = cheerio.load(moviePage.data);
        
        let movieLinks = [];

        // සයිට් එකේ තියෙන Direct Movie Download Links (Pixeldrain, Mega, Google Drive හෝ වෙනත් බාගත කරන ලින්ක්) සෙවීම
        $movie('a').each((i, el) => {
            const href = $movie(el).attr('href');
            const linkText = $movie(el).text().trim();
            
            // Pixeldrain, Mega, 720p, 1080p වගේ වචන තියෙන ලින්ක්ස් විතරක් වෙන් කර ගැනීම
            if (href && (href.includes('pixeldrain') || href.includes('mega.nz') || href.includes('drive.google') || linkText.includes('Download') || linkText.includes('p '))) {
                if (movieLinks.length < 5 && !movieLinks.some(l => l.url === href)) {
                    movieLinks.push({ text: linkText || 'Direct Download', url: href });
                }
            }
        });

        if (movieLinks.length === 0) {
            return await sock.sendMessage(from, { text: `❌ මෙම චිත්‍රපටය සඳහා සෘජු Download ලින්ක් එකක් සොයා ගැනීමට අපහසුයි. ඔබට සයිට් එකට ගොස් බාගත හැක:\n\n🔗 ${movie.link}` });
        }

        // ලින්ක්ස් ටික ලස්සන මැසේජ් එකක් විදිහට සකස් කිරීම
        let msgText = `🎯 *CINESUBZ MOVIE DOWNLOADER* 🎯\n\n🎥 *Movie:* ${movie.title}\n\n📥 *මෙන්න ඔයාට Download  කරගන්න ලින්ක්ස්:* \n`;
        
        movieLinks.forEach((link, idx) => {
            msgText += `\n${idx + 1}. 🔗 *${link.text}:* ${link.url}\n`;
        });

        msgText += `\n_සටහන: ලින්ක් එක උඩ ක්ලික් කර කෙලින්ම ෆිල්ම් එක බාගන්න._`;
        
        await sock.sendMessage(from, { text: msgText });

    } catch (error) {
        console.error(error);
        await sock.sendMessage(from, { text: '❌ චිත්‍රපටය සෙවීමේදී තාක්ෂණික දෝෂයක් ඇති විය.' });
    }
};
