require('dotenv').config({ path: __dirname + '/.env' });
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType, createAudioResource, createAudioPlayer } = require('@discordjs/voice');
const prism = require('prism-media');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const PREFIX = '!';
let recording = false;
let audioStream = null;
let outputFile = null;
let receiver = null;

const SOX_PATH = process.env.SOX_PATH || 'C:/Program Files (x86)/sox-14-4-2/sox.exe';
const RECORDINGS_DIR = path.join(__dirname, '../recordings');

// Função para limpar gravações antigas (mais de 7 dias)
function limparGravacoesAntigas(dias = 7) {
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    let removidos = 0;
    fs.readdirSync(RECORDINGS_DIR).forEach(file => {
        if (file.endsWith('.pcm') || file.endsWith('.wav')) {
            const filePath = path.join(RECORDINGS_DIR, file);
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs < limite) {
                fs.unlinkSync(filePath);
                removidos++;
            }
        }
    });
    return removidos;
}

client.once('ready', () => {
    console.log(`🤖 Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;
    const [cmd, ...args] = message.content.slice(PREFIX.length).trim().split(/ +/g);

    if (cmd === 'status') {
        message.reply('🤖 Bot online! Configuração: ' + (process.env.DISCORD_TOKEN ? '✅' : '❌') + ', SOX: ' + (SOX_PATH ? SOX_PATH : 'não definido'));
        return;
    }
    if (cmd === 'limpar') {
        try {
            const removidos = limparGravacoesAntigas();
            message.reply(`🧹 ${removidos} gravações antigas removidas!`);
        } catch (e) {
            message.reply('Erro ao limpar gravações: ' + e.message);
        }
        return;
    }
    if (cmd === 'gravar') {
        if (!message.member.voice.channel) {
            message.reply('❌ Você precisa estar em um canal de voz.');
            return;
        }
        if (recording) {
            message.reply('Já estou gravando!');
            return;
        }
        const channel = message.member.voice.channel;
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false
        });
        receiver = connection.receiver;
        // Grava todos os usuários (exceto bots) em arquivos separados
        channel.members.filter(m => !m.user.bot).forEach(member => {
            const userId = member.id;
            const userFile = fs.createWriteStream(`recordings/meeting_${userId}_${Date.now()}.pcm`);
            const opusStream = receiver.subscribe(userId, { end: { behavior: EndBehaviorType.Manual } });
            const pcmStream = new prism.opus.Decoder({ channels: 1, rate: 16000, frameSize: 960 });
            opusStream.pipe(pcmStream).pipe(userFile);
        });
        recording = true;
        message.reply('🎙️ Gravando todos os usuários do canal...');
    }
    if (cmd === 'parar') {
        if (!recording) {
            message.reply('Não estou gravando no momento.');
            return;
        }
        recording = false;
        if (receiver) receiver.speaking.removeAllListeners();
        const connection = getVoiceConnection(message.guild.id);
        if (connection) connection.destroy();
        message.reply('⏹️ Parando e processando...');
        // Processa todos os arquivos PCM gerados na pasta recordings
        fs.readdir(RECORDINGS_DIR, (err, files) => {
            if (err) {
                message.reply('Erro ao ler a pasta de gravações.');
                return;
            }
            const pcmFiles = files.filter(f => f.endsWith('.pcm'));
            if (pcmFiles.length === 0) {
                message.reply('Nenhum áudio encontrado para processar.');
                return;
            }
            // Para cada arquivo PCM, converte para WAV e processa individualmente
            let processed = 0;
            const userReports = [];
            // Recupera o canal de voz do usuário para buscar os nomes
            const channel = message.member.voice.channel;
            pcmFiles.forEach((pcmFile, idx) => {
                const userId = pcmFile.split('_')[1];
                // Buscar nome do usuário pelo ID no canal de voz
                let username = userId;
                const member = channel.members.get(userId);
                if (member) {
                    username = member.user.username;
                }
                const wavPath = path.join(RECORDINGS_DIR, pcmFile.replace('.pcm', '.wav'));
                const pcmPath = path.join(RECORDINGS_DIR, pcmFile);
                // Usa o caminho do sox da variável de ambiente
                const sox = spawn(SOX_PATH, [
                    '-t', 'raw', '-r', '16000', '-e', 'signed-integer', '-b', '16', '-c', '1', pcmPath,
                    '-t', 'wav', wavPath
                ]);
                sox.on('close', (code) => {
                    if (fs.existsSync(wavPath)) {
                        // Passa o username junto para o Python
                        const py = spawn('python', ['process_audio.py', wavPath, userId, username], { cwd: __dirname });
                        py.stdout.on('data', (data) => console.log(`PYTHON: ${data}`));
                        py.stderr.on('data', (data) => console.error(`PYTHON ERROR: ${data}`));
                        py.on('close', (code) => {
                            processed++;
                            if (processed === pcmFiles.length) {
                                message.reply('✅ Relatório individual de cada usuário enviado para o Notion!');
                            }
                        });
                    } else {
                        message.reply(`Erro ao converter áudio para WAV do usuário ${username}.`);
                    }
                });
            });
        });
    }
});

console.log('DEBUG TOKEN:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : 'undefined');
client.login(process.env.DISCORD_TOKEN);
