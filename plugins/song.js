const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');

module.exports = async ({ sock, from, args }) => {
    if (!args) return await sock.sendMessage(from, { text: '❌ *කරුණාකර සින්දුවේ නම ඇතුළත් කරන්න!* \n\nඋදා: `.song learned to fly`' });
    
    await sock.sendMessage(from, { text: `🔍 *"${args}"* සින්දුව සොයමින් පවතී...` });
    
    try {
        const searchResults = await yts(args);
        const video = searchResults.videos[0];
        if (!video) return await sock.sendMessage(from, { text: '❌ සින්දුව සොයා ගැනීමට නොහැකි විය.' });
        
        await sock.sendMessage(from, { text: `🎵 *${video.title}* බාගත වෙමින් පවතී...` });
        
        const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
        const filePath = `./${video.videoId}.mp3`;
        
        stream.pipe(fs.createWriteStream(filePath)).on('finish', async () => {
            await sock.sendMessage(from, { 
                audio: { url: filePath }, 
                mimetype: 'audio/mp4', 
                fileName: `${video.title}.mp3` 
            });
            fs.unlinkSync(filePath);
        });
    } catch (error) {
        await sock.sendMessage(from, { text: '❌ සින්දුව බාගත කිරීමේදී දෝෂයක් ඇති විය.' });
    }
};
