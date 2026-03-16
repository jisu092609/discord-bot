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

/* 로그 채널 */

const LOG_CHANNEL = "1483131260346831012";

/* 채널 ID */

const COMP_MATCH_CHANNEL = "1482370321032937584";
const NORMAL_MATCH_CHANNEL = "1482370350661501008";

const COMP_WAIT = "1461898802007900281";
const NORMAL_WAIT = "1461898864012296260";

/* 메시지 저장 */

const COMP_MESSAGE_FILE = "./compMessage.json";
const NORMAL_MESSAGE_FILE = "./normalMessage.json";

/* 경쟁방 */

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

/* 일반방 */

const NORMAL_ROOMS = [
  "1461897962463432927",
  "1461898016515690566",
  "1461898047624581171"
];

let compQueue = [];
let normalQueue = [];

let compMessage = null;
let normalMessage = null;

/* 로그 함수 */

function sendLog(text){

  const ch = client.channels.cache.get(LOG_CHANNEL);
  if(!ch) return;

  const time = new Date().toLocaleString("ko-KR");

  ch.send(`📊 **매칭 로그**\n${text}\n🕒 ${time}`);
}

/* 버튼 */

const compButtons = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("join_comp")
    .setLabel("🎮 경쟁 참가")
    .setStyle(ButtonStyle.Success),

  new ButtonBuilder()
    .setCustomId("leave_queue")
    .setLabel("❌ 대기 취소")
    .setStyle(ButtonStyle.Danger)
);

const normalButtons = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("join_normal")
    .setLabel("🎯 일반 참가")
    .setStyle(ButtonStyle.Primary),

  new ButtonBuilder()
    .setCustomId("leave_queue")
    .setLabel("❌ 대기 취소")
    .setStyle(ButtonStyle.Danger)
);

/* 봇 시작 */

client.once("ready", async () => {

  console.log(`봇 로그인 완료: ${client.user.tag}`);

  const compChannel = await client.channels.fetch(COMP_MATCH_CHANNEL);
  const normalChannel = await client.channels.fetch(NORMAL_MATCH_CHANNEL);

  if (fs.existsSync(COMP_MESSAGE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(COMP_MESSAGE_FILE));
      compMessage = await compChannel.messages.fetch(data.messageId);
    } catch {}
  }

  if (!compMessage) {
    const embed = new EmbedBuilder()
      .setTitle("🎮 경쟁 매칭")
      .setDescription("버튼을 눌러 경쟁 매칭에 참가하세요");

    compMessage = await compChannel.send({
      embeds:[embed],
      components:[compButtons]
    });

    fs.writeFileSync(
      COMP_MESSAGE_FILE,
      JSON.stringify({messageId:compMessage.id})
    );
  }

  if (fs.existsSync(NORMAL_MESSAGE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(NORMAL_MESSAGE_FILE));
      normalMessage = await normalChannel.messages.fetch(data.messageId);
    } catch {}
  }

  if (!normalMessage) {
    const embed = new EmbedBuilder()
      .setTitle("🎯 일반 매칭")
      .setDescription("버튼을 눌러 일반 매칭에 참가하세요");

    normalMessage = await normalChannel.send({
      embeds:[embed],
      components:[normalButtons]
    });

    fs.writeFileSync(
      NORMAL_MESSAGE_FILE,
      JSON.stringify({messageId:normalMessage.id})
    );
  }

});

/* 진행바 */

function progressBar(count){
  const filled = "█".repeat(count*2);
  const empty = "░".repeat(8-count*2);
  return filled+empty;
}

/* UI 업데이트 */

async function updateQueueUI(guild){

  if(!compMessage || !normalMessage) return;

  let compList="";
  let normalList="";

  const icons=["🥇","🥈","🥉","🏅"];

  for(let i=0;i<4;i++){
    if(compQueue[i]){
      const m = await guild.members.fetch(compQueue[i]);
      compList+=`${icons[i]} ${m.displayName}\n`;
    }else compList+="⬜ 대기중\n";
  }

  for(let i=0;i<4;i++){
    if(normalQueue[i]){
      const m = await guild.members.fetch(normalQueue[i]);
      normalList+=`${icons[i]} ${m.displayName}\n`;
    }else normalList+="⬜ 대기중\n";
  }

  const compEmbed = new EmbedBuilder()
    .setTitle("🎮 경쟁 매칭")
    .setDescription(`대기 인원 **${compQueue.length}/4**\n${progressBar(compQueue.length)}`)
    .addFields({name:"대기열",value:"```"+compList+"```"});

  const normalEmbed = new EmbedBuilder()
    .setTitle("🎯 일반 매칭")
    .setDescription(`대기 인원 **${normalQueue.length}/4**\n${progressBar(normalQueue.length)}`)
    .addFields({name:"대기열",value:"```"+normalList+"```"});

  await compMessage.edit({embeds:[compEmbed],components:[compButtons]});
  await normalMessage.edit({embeds:[normalEmbed],components:[normalButtons]});

}

/* 버튼 */

client.on("interactionCreate", async interaction => {

  if(!interaction.isButton()) return;

  const member = interaction.member;

  sendLog(`버튼 클릭 : ${member.user.tag}`);

  await interaction.deferReply({ephemeral:true});

  if(interaction.customId==="join_comp"){

    compQueue.push(member.id);

    sendLog(`${member.user.tag} 경쟁 대기열 참가 (${compQueue.length}/4)`);

    await interaction.editReply("경쟁 대기열 참가 완료");

    await updateQueueUI(interaction.guild);

    if(compQueue.length===4)
      startMatch(interaction.guild,compQueue,COMP_ROOMS,"경쟁");

  }

  if(interaction.customId==="join_normal"){

    normalQueue.push(member.id);

    sendLog(`${member.user.tag} 일반 대기열 참가 (${normalQueue.length}/4)`);

    await interaction.editReply("일반 대기열 참가 완료");

    await updateQueueUI(interaction.guild);

    if(normalQueue.length===4)
      startMatch(interaction.guild,normalQueue,NORMAL_ROOMS,"일반");

  }

  if(interaction.customId==="leave_queue"){

    compQueue = compQueue.filter(id=>id!==member.id);
    normalQueue = normalQueue.filter(id=>id!==member.id);

    sendLog(`${member.user.tag} 대기열 취소`);

    await interaction.editReply("대기열에서 제거되었습니다.");

    updateQueueUI(interaction.guild);

  }

});

/* 매칭 */

async function startMatch(guild,queue,rooms,type){

  const available = rooms.find(id=>{
    const ch = guild.channels.cache.get(id);
    return ch && ch.members.size===0;
  });

  if(!available){
    queue.length=0;
    updateQueueUI(guild);
    return;
  }

  const room = guild.channels.cache.get(available);

  let players="";

  for(const id of queue){
    const m = await guild.members.fetch(id);
    players+=`${m.displayName}\n`;
  }

  sendLog(`매칭 시작 (${type})\n${players}\n방 : ${room.name}`);

  for(const id of queue){
    const member = await guild.members.fetch(id);
    if(member.voice.channel)
      await member.voice.setChannel(room);
  }

  queue.length=0;

  updateQueueUI(guild);

}

/* 음성채널 나가면 제거 */

client.on("voiceStateUpdate",(oldState,newState)=>{

  if(oldState.channelId===COMP_WAIT && newState.channelId!==COMP_WAIT){
    compQueue = compQueue.filter(id=>id!==oldState.id);
    sendLog(`${oldState.member.user.tag} 경쟁 대기열 이탈`);
    updateQueueUI(oldState.guild);
  }

  if(oldState.channelId===NORMAL_WAIT && newState.channelId!==NORMAL_WAIT){
    normalQueue = normalQueue.filter(id=>id!==oldState.id);
    sendLog(`${oldState.member.user.tag} 일반 대기열 이탈`);
    updateQueueUI(oldState.guild);
  }

});

client.login(TOKEN);

/* Railway */

setInterval(()=>console.log("Heartbeat"),300000);

app.get("/",(req,res)=>res.send("Bot running"));

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>console.log("Server running"));