module.exports = async ({ sock, from }) => {
    await sock.sendMessage(from, { text: '🤖 *Apex-MD සක්‍රීයයි (Plugin Mode)!* \n\nඔයාගේ ප්ලගින්ස් ඔක්කොම සුපිරියටම වැඩ මචං. ⚡' });
};
