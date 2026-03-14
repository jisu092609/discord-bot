const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const express = require("express");
const fs = require("fs");
const app = express();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;

const MATCH_CHANNEL = "1482370321032937584";
const COMP_WAIT = "1461898802007900281";

const MESSAGE_FILE = "./queueMessage.json";

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

let compQueue = [];
let queueMessage = null;

const buttons = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("join_comp")
    .setLabel("🎮 경쟁 참가")
    .setStyle(ButtonStyle.Success),

  new ButtonBuilder()
    .setCustomId("leave_comp")
    .setLabel("❌ 대기 취소")
    .setStyle(ButtonStyle.Danger)
);

client.once("ready", async () => {

  console.log(`봇 로그인 완료: ${client.user.tag}`);

  const channel = await client.channels.fetch(MATCH_CHANNEL);

  let messageId = null;

  if (fs.existsSync(MESSAGE_FILE)) {

    const data = JSON.parse(fs.readFileSync(MESSAGE_FILE));
    messageId = data.messageId;

  }

  try {

    if (messageId) {

      queueMessage = await channel.messages.fetch(messageId);
      console.log("기존 매칭 UI 불러옴");

    }

  } catch {

    console.log("기존 UI 없음");

  }

  if (!queueMessage) {

    const embed = await createQueueEmbed(compQueue, channel.guild);

    queueMessage = await channel.send({
      embeds: [embed],
      components: [buttons]
    });

    fs.writeFileSync(
      MESSAGE_FILE,
      JSON.stringify({ messageId: queueMessage.id })
    );

    console.log("새 매칭 UI 생성");

  }

});

async function createQueueEmbed(queue, guild) {

  let list = "";
  const icons = ["🥇", "🥈", "🥉", "🏅"];

  for (let i = 0; i < 4; i++) {

    if (queue[i]) {

      try {

        const member = await guild.members.fetch(queue[i]);
        list += `${icons[i]} ${member.displayName}\n`;

      } catch {

        list += `${icons[i]} Unknown\n`;

      }

    } else {

      list += `⬜ 대기중\n`;

    }

  }

  const filled = "█".repeat(queue.length * 2);
  const empty = "░".repeat(8 - queue.length * 2);
  const bar = filled + empty;

  return new EmbedBuilder()
    .setTitle("🎮 경쟁 매칭")
    .setColor(0x5865F2)
    .setDescription(`대기 인원 **${queue.length} / 4**\n${bar}`)
    .addFields({
      name: "대기열",
      value: "```" + list + "```"
    });

}

async function updateQueueUI(guild) {

  if (!queueMessage) return;

  const embed = await createQueueEmbed(compQueue, guild);

  await queueMessage.edit({
    embeds: [embed],
    components: [buttons]
  });

}

client.on("interactionCreate", async interaction => {

  if (!interaction.isButton()) return;

  const member = interaction.member;

  if (interaction.customId === "join_comp") {

    if (!member.voice.channel || member.voice.channel.id !== COMP_WAIT) {

      return interaction.reply({
        content: "❌ 경쟁대기 음성채널에 들어가 있어야 합니다.",
        ephemeral: true
      });

    }

    if (compQueue.includes(member.id)) {

      return interaction.reply({
        content: "이미 대기열에 있습니다.",
        ephemeral: true
      });

    }

    compQueue.push(member.id);

    await interaction.reply({
      content: "🎮 경쟁 대기열에 참가했습니다.",
      ephemeral: true
    });

    await updateQueueUI(interaction.guild);

    if (compQueue.length === 4) {
      startMatch(interaction.guild);
    }

  }

  if (interaction.customId === "leave_comp") {

    const index = compQueue.indexOf(member.id);

    if (index === -1) {

      return interaction.reply({
        content: "대기열에 없습니다.",
        ephemeral: true
      });

    }

    compQueue.splice(index, 1);

    await interaction.reply({
      content: "대기열에서 제거되었습니다.",
      ephemeral: true
    });

    await updateQueueUI(interaction.guild);

  }

});

client.on("voiceStateUpdate", async (oldState, newState) => {

  if (oldState.channelId === COMP_WAIT && newState.channelId !== COMP_WAIT) {

    const index = compQueue.indexOf(oldState.id);

    if (index !== -1) {

      compQueue.splice(index, 1);
      await updateQueueUI(oldState.guild);

    }

  }

});

async function startMatch(guild) {

  const available = COMP_ROOMS.find(id => {

    const channel = guild.channels.cache.get(id);
    return channel && channel.members.size === 0;

  });

  if (!available) {

    console.log("사용 가능한 경쟁방 없음");
    compQueue = [];
    updateQueueUI(guild);
    return;

  }

  const room = guild.channels.cache.get(available);

  for (const id of compQueue) {

    const member = await guild.members.fetch(id);

    if (member.voice.channel) {
      member.voice.setChannel(room);
    }

  }

  console.log("매칭 완료");

  compQueue = [];

  updateQueueUI(guild);

}

client.login(TOKEN);

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Ping server running on port ${PORT}`);
});