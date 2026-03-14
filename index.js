const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");

const app = express();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("DISCORD_TOKEN 환경변수가 없습니다.");
  process.exit(1);
}

// 명령어 채널
const COMP_COMMAND_CHANNEL = "1482370321032937584";
const NORMAL_COMMAND_CHANNEL = "1482370350661501008";

// 대기방
const COMP_WAIT = "1461898802007900281";
const NORMAL_WAIT = "1461898864012296260";

// 경쟁방
const COMP_ROOMS = [
  "1462174271932465355",
  "1462174312134869193",
  "1462174381210861568",
  "1475237146188321011",
  "1475237175523278909",
  "886997213266464852",
  "1454036689013047427",
  "1454036722194317392",
  "1454036746437398608",
  "1454036801437044858",
  "1475237217499877631"
];

// 일반방
const NORMAL_ROOMS = [
  "1461897962463432927",
  "1461898016515690566",
  "1461898047624581171"
];

let compQueue = [];
let normalQueue = [];

client.once("ready", () => {
  console.log(`봇 로그인 완료: ${client.user.tag}`);
});

client.on("messageCreate", async message => {

  if (message.author.bot) return;

  const member = message.member;

  // 경쟁대기
  if (message.channel.id === COMP_COMMAND_CHANNEL && message.content === "!경쟁대기") {

    if (!member.voice.channel || member.voice.channel.id !== COMP_WAIT)
      return message.reply("경쟁대기 음성채널에 있어야 합니다.");

    if (compQueue.includes(member.id))
      return message.reply("이미 경쟁 대기열에 있습니다.");

    compQueue.push(member.id);

    message.reply(`경쟁 대기열 (${compQueue.length}/4)`);

    if (compQueue.length === 4)
      startMatch(message.guild, compQueue, COMP_ROOMS);
  }

  // 일반대기
  if (message.channel.id === NORMAL_COMMAND_CHANNEL && message.content === "!일반대기") {

    if (!member.voice.channel || member.voice.channel.id !== NORMAL_WAIT)
      return message.reply("일반대기 음성채널에 있어야 합니다.");

    if (normalQueue.includes(member.id))
      return message.reply("이미 일반 대기열에 있습니다.");

    normalQueue.push(member.id);

    message.reply(`일반 대기열 (${normalQueue.length}/4)`);

    if (normalQueue.length === 4)
      startMatch(message.guild, normalQueue, NORMAL_ROOMS);
  }

});

client.on("voiceStateUpdate", (oldState, newState) => {

  if (oldState.channelId === COMP_WAIT && newState.channelId !== COMP_WAIT) {

    const index = compQueue.indexOf(oldState.id);
    if (index !== -1) compQueue.splice(index, 1);
  }

  if (oldState.channelId === NORMAL_WAIT && newState.channelId !== NORMAL_WAIT) {

    const index = normalQueue.indexOf(oldState.id);
    if (index !== -1) normalQueue.splice(index, 1);
  }

});

async function startMatch(guild, queue, rooms) {

  const available = rooms.find(id => {

    const channel = guild.channels.cache.get(id);
    return channel && channel.members.size === 0;

  });

  if (!available) {

    console.log("사용 가능한 방 없음");
    queue.length = 0;
    return;

  }

  const room = guild.channels.cache.get(available);

  for (const id of queue) {

    const member = await guild.members.fetch(id);

    if (member.voice.channel)
      member.voice.setChannel(room);

  }

  queue.length = 0;

  console.log("매칭 완료");

}

client.login(TOKEN).catch(err => {
  console.error("봇 로그인 실패:", err);
});

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Ping server running on port ${PORT}`);
});

process.on("unhandledRejection", error => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("Uncaught exception:", error);
});