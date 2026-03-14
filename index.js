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
const NORMAL_WAIT = "1461898864012296260";

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

const NORMAL_ROOMS = [
  "1461897962463432927",
  "1461898016515690566",
  "1461898047624581171"
];

let compQueue = [];
let normalQueue = [];
let queueMessage = null;

const buttons = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("join_comp")
    .setLabel("🎮 경쟁 참가")
    .setStyle(ButtonStyle.Success),

  new ButtonBuilder()
    .setCustomId("join_normal")
    .setLabel("🎯 일반 참가")
    .setStyle(ButtonStyle.Primary),

  new ButtonBuilder()
    .setCustomId("leave_queue")
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
    }
  } catch {}

  if (!queueMessage) {

    const embed = new EmbedBuilder()
      .setTitle("🎮 매칭 대기열")
      .setDescription("버튼을 눌러 매칭에 참가하세요.");

    queueMessage = await channel.send({
      embeds: [embed],
      components: [buttons]
    });

    fs.writeFileSync(
      MESSAGE_FILE,
      JSON.stringify({ messageId: queueMessage.id })
    );

  }

});

async function updateQueueUI(guild) {

  let compList = "";
  let normalList = "";

  for (let i = 0; i < 4; i++) {

    if (compQueue[i]) {
      const member = await guild.members.fetch(compQueue[i]);
      compList += `${i+1}. ${member.displayName}\n`;
    } else compList += `${i+1}. -\n`;

  }

  for (let i = 0; i < 4; i++) {

    if (normalQueue[i]) {
      const member = await guild.members.fetch(normalQueue[i]);
      normalList += `${i+1}. ${member.displayName}\n`;
    } else normalList += `${i+1}. -\n`;

  }

  const embed = new EmbedBuilder()
    .setTitle("🎮 매칭 대기열")
    .addFields(
      {
        name: `🎮 경쟁 (${compQueue.length}/4)`,
        value: "```"+compList+"```"
      },
      {
        name: `🎯 일반 (${normalQueue.length}/4)`,
        value: "```"+normalList+"```"
      }
    );

  await queueMessage.edit({
    embeds:[embed],
    components:[buttons]
  });

}

client.on("interactionCreate", async interaction => {

  if (!interaction.isButton()) return;

  const member = interaction.member;

  if (interaction.customId === "join_comp") {

    if (!member.voice.channel || member.voice.channel.id !== COMP_WAIT)
      return interaction.reply({content:"경쟁대기 음성채널에 있어야 합니다.",ephemeral:true});

    if (compQueue.includes(member.id))
      return interaction.reply({content:"이미 경쟁 대기열에 있습니다.",ephemeral:true});

    compQueue.push(member.id);

    await interaction.reply({content:"경쟁 대기열 참가 완료",ephemeral:true});

    await updateQueueUI(interaction.guild);

    if (compQueue.length === 4)
      startMatch(interaction.guild, compQueue, COMP_ROOMS, "🎮 경쟁 매칭");

  }

  if (interaction.customId === "join_normal") {

    if (!member.voice.channel || member.voice.channel.id !== NORMAL_WAIT)
      return interaction.reply({content:"일반대기 음성채널에 있어야 합니다.",ephemeral:true});

    if (normalQueue.includes(member.id))
      return interaction.reply({content:"이미 일반 대기열에 있습니다.",ephemeral:true});

    normalQueue.push(member.id);

    await interaction.reply({content:"일반 대기열 참가 완료",ephemeral:true});

    await updateQueueUI(interaction.guild);

    if (normalQueue.length === 4)
      startMatch(interaction.guild, normalQueue, NORMAL_ROOMS, "🎯 일반 매칭");

  }

  if (interaction.customId === "leave_queue") {

    compQueue = compQueue.filter(id=>id!==member.id);
    normalQueue = normalQueue.filter(id=>id!==member.id);

    await interaction.reply({content:"대기열에서 제거되었습니다.",ephemeral:true});

    await updateQueueUI(interaction.guild);

  }

});

async function startMatch(guild, queue, rooms, title) {

  const available = rooms.find(id=>{
    const channel = guild.channels.cache.get(id);
    return channel && channel.members.size===0;
  });

  if(!available){
    queue.length=0;
    updateQueueUI(guild);
    return;
  }

  const room = guild.channels.cache.get(available);

  let playerList="";

  for(const id of queue){
    const member = await guild.members.fetch(id);
    playerList+=`• ${member.displayName}\n`;
  }

  for(let i=5;i>0;i--){

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(
`매칭이 완료되었습니다.

${playerList}

${i}초 후 경쟁방으로 이동합니다`
      );

    await queueMessage.edit({embeds:[embed],components:[]});

    await new Promise(r=>setTimeout(r,1000));

  }

  for(const id of queue){

    const member = await guild.members.fetch(id);

    if(member.voice.channel)
      await member.voice.setChannel(room);

  }

  queue.length=0;

  await updateQueueUI(guild);

}

client.on("voiceStateUpdate",async(oldState,newState)=>{

  if(oldState.channelId===COMP_WAIT && newState.channelId!==COMP_WAIT){

    compQueue = compQueue.filter(id=>id!==oldState.id);
    updateQueueUI(oldState.guild);

  }

  if(oldState.channelId===NORMAL_WAIT && newState.channelId!==NORMAL_WAIT){

    normalQueue = normalQueue.filter(id=>id!==oldState.id);
    updateQueueUI(oldState.guild);

  }

});

client.login(TOKEN);

app.get("/", (req,res)=>{
  res.send("Bot running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server running");
});
  