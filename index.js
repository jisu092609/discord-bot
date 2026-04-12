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

/* ================= 채널 ================= */
const LOG_CHANNEL = "1483131260346831012";

const COMP_MATCH_CHANNEL = "1482370321032937584";
const NORMAL_MATCH_CHANNEL = "1482370350661501008";
const HARD_MATCH_CHANNEL = "1492852780740771913";

const COMP_WAIT = "1461898802007900281";
const NORMAL_WAIT = "1461898864012296260";
const HARD_WAIT = "1492852858570408138";

/* ================= 메시지 저장 ================= */
const COMP_MESSAGE_FILE = "./compMessage.json";
const NORMAL_MESSAGE_FILE = "./normalMessage.json";
const HARD_MESSAGE_FILE = "./hardMessage.json";

/* ================= 방 ================= */
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
const HARD_ROOMS = [
  "1490714634943205386",
  "1490714390146584747",
  "1492852564096450649"
];

/* ================= 큐 ================= */
let compQueue = [];
let normalQueue = [];
let hardQueue = [];

let compMessage = null;
let normalMessage = null;
let hardMessage = null;

let matchLock = false;

/* ================= 중복 체크 ================= */
function isInAnyQueue(id){
  return compQueue.includes(id) || normalQueue.includes(id) || hardQueue.includes(id);
}

/* ================= 로그 ================= */
function sendLog(text){
  const ch = client.channels.cache.get(LOG_CHANNEL);
  if(!ch) return;

  const time = new Date().toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});
  ch.send(`📊 매칭 로그\n${text}\n🕒 ${time}`);
}

/* ================= 버튼 ================= */
const compButtons = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("join_comp").setLabel("🎮 경쟁 참가").setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId("leave_queue").setLabel("❌ 대기 취소").setStyle(ButtonStyle.Danger)
);

const normalButtons = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("join_normal").setLabel("🎯 일반 참가").setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId("leave_queue").setLabel("❌ 대기 취소").setStyle(ButtonStyle.Danger)
);

const hardButtons = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("join_hard").setLabel("🔥 빡겜 참가").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("leave_queue").setLabel("❌ 대기 취소").setStyle(ButtonStyle.Danger)
);

/* ================= 시작 ================= */
client.once("ready", async () => {

  console.log(`봇 로그인 완료: ${client.user.tag}`);

  const compChannel = await client.channels.fetch(COMP_MATCH_CHANNEL);
  const normalChannel = await client.channels.fetch(NORMAL_MATCH_CHANNEL);
  const hardChannel = await client.channels.fetch(HARD_MATCH_CHANNEL);

  // 경쟁
  if (fs.existsSync(COMP_MESSAGE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(COMP_MESSAGE_FILE));
      compMessage = await compChannel.messages.fetch(data.messageId);
    } catch {}
  }

  if (!compMessage) {
    compMessage = await compChannel.send({
      embeds:[new EmbedBuilder().setTitle("🎮 경쟁 매칭").setDescription("버튼 클릭")],
      components:[compButtons]
    });
    fs.writeFileSync(COMP_MESSAGE_FILE, JSON.stringify({messageId:compMessage.id}));
  }

  // 일반
  if (fs.existsSync(NORMAL_MESSAGE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(NORMAL_MESSAGE_FILE));
      normalMessage = await normalChannel.messages.fetch(data.messageId);
    } catch {}
  }

  if (!normalMessage) {
    normalMessage = await normalChannel.send({
      embeds:[new EmbedBuilder().setTitle("🎯 일반 매칭").setDescription("버튼 클릭")],
      components:[normalButtons]
    });
    fs.writeFileSync(NORMAL_MESSAGE_FILE, JSON.stringify({messageId:normalMessage.id}));
  }

  // 🔥 빡겜
  if (fs.existsSync(HARD_MESSAGE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(HARD_MESSAGE_FILE));
      hardMessage = await hardChannel.messages.fetch(data.messageId);
    } catch {}
  }

  if (!hardMessage) {
    hardMessage = await hardChannel.send({
      embeds:[new EmbedBuilder().setTitle("🔥 빡겜 매칭").setDescription("버튼 클릭")],
      components:[hardButtons]
    });
    fs.writeFileSync(HARD_MESSAGE_FILE, JSON.stringify({messageId:hardMessage.id}));
  }

});

/* ================= UI ================= */
function makeList(queue,guild){
  const icons=["🥇","🥈","🥉","🏅"];
  let txt="";
  for(let i=0;i<4;i++){
    if(queue[i]){
      const m = guild.members.cache.get(queue[i]);
      txt+=`${icons[i]} ${m?.displayName || "알수없음"}\n`;
    }else txt+="⬜ 대기중\n";
  }
  return txt;
}

async function updateQueueUI(guild){

  await compMessage.edit({
    embeds:[new EmbedBuilder().setTitle("🎮 경쟁").setDescription(`${compQueue.length}/4`).addFields({name:"대기열",value:"```"+makeList(compQueue,guild)+"```"})],
    components:[compButtons]
  });

  await normalMessage.edit({
    embeds:[new EmbedBuilder().setTitle("🎯 일반").setDescription(`${normalQueue.length}/4`).addFields({name:"대기열",value:"```"+makeList(normalQueue,guild)+"```"})],
    components:[normalButtons]
  });

  await hardMessage.edit({
    embeds:[new EmbedBuilder().setTitle("🔥 빡겜").setDescription(`${hardQueue.length}/4`).addFields({name:"대기열",value:"```"+makeList(hardQueue,guild)+"```"})],
    components:[hardButtons]
  });

}

/* ================= 버튼 ================= */
client.on("interactionCreate", async interaction => {

  if(!interaction.isButton()) return;
  const member = interaction.member;

  await interaction.deferReply({ephemeral:true});

  if(interaction.customId==="join_comp"){
    if(interaction.channel.id !== COMP_MATCH_CHANNEL) return interaction.editReply("이 채널에서는 참가가 불가합니다.");
    if(isInAnyQueue(member.id)) return interaction.editReply("이미 다른 대기열 참여중");
    if(!member.voice.channel || member.voice.channel.id!==COMP_WAIT) return interaction.editReply("경쟁 대기방 음성채널에 참가해야 합니다.");

    compQueue.push(member.id);
    sendLog(`${member.displayName} 경쟁 참가`);

    await updateQueueUI(interaction.guild);
    if(compQueue.length===4 && !matchLock)
      startMatch(interaction.guild,compQueue,COMP_ROOMS,"경쟁");
  }

  if(interaction.customId==="join_normal"){
    if(interaction.channel.id !== NORMAL_MATCH_CHANNEL) return interaction.editReply("이 채널에서는 참가가 불가합니다.");
    if(isInAnyQueue(member.id)) return interaction.editReply("이미 다른 대기열 참여중");
    if(!member.voice.channel || member.voice.channel.id!==NORMAL_WAIT) return interaction.editReply("일반 대기방 음성채널에 참가해야 합니다.");

    normalQueue.push(member.id);
    sendLog(`${member.displayName} 일반 참가`);

    await updateQueueUI(interaction.guild);
    if(normalQueue.length===4 && !matchLock)
      startMatch(interaction.guild,normalQueue,NORMAL_ROOMS,"일반");
  }

  if(interaction.customId==="join_hard"){
    if(interaction.channel.id !== HARD_MATCH_CHANNEL) return interaction.editReply("이 채널에서는 참가가 불가합니다.");
    if(isInAnyQueue(member.id)) return interaction.editReply("이미 다른 대기열 참여중");
    if(!member.voice.channel || member.voice.channel.id!==HARD_WAIT) return interaction.editReply("빡겜 대기방 음성채널에 참가해야 합니다.");

    hardQueue.push(member.id);
    sendLog(`${member.displayName} 빡겜 참가`);

    await updateQueueUI(interaction.guild);
    if(hardQueue.length===4 && !matchLock)
      startMatch(interaction.guild,hardQueue,HARD_ROOMS,"빡겜");
  }

  if(interaction.customId==="leave_queue"){
    compQueue = compQueue.filter(id=>id!==member.id);
    normalQueue = normalQueue.filter(id=>id!==member.id);
    hardQueue = hardQueue.filter(id=>id!==member.id);

    sendLog(`${member.displayName} 대기 취소`);
    await updateQueueUI(interaction.guild);
    await interaction.editReply("취소 완료");
  }

});

/* ================= 매칭 ================= */
async function startMatch(guild,queue,rooms,type){

  try{
    matchLock = true;

    const roomId = rooms.find(id=>{
      const ch = guild.channels.cache.get(id);
      return ch && ch.members.size===0;
    });

    if(!roomId){
      queue.length=0;
      return updateQueueUI(guild);
    }

    const room = guild.channels.cache.get(roomId);

    await Promise.all(queue.map(id=>{
      const m = guild.members.cache.get(id);
      return m?.voice.setChannel(room);
    }));

    sendLog(`매칭 시작 (${type})`);

    queue.length=0;
    await updateQueueUI(guild);

  } finally {
    matchLock=false;
  }

}

/* ================= 음성 이탈 ================= */
client.on("voiceStateUpdate",(oldState,newState)=>{

  if(oldState.channelId===COMP_WAIT && newState.channelId!==COMP_WAIT){
    compQueue = compQueue.filter(id=>id!==oldState.id);
    sendLog(`${oldState.member.displayName} 경쟁 이탈`);
  }

  if(oldState.channelId===NORMAL_WAIT && newState.channelId!==NORMAL_WAIT){
    normalQueue = normalQueue.filter(id=>id!==oldState.id);
    sendLog(`${oldState.member.displayName} 일반 이탈`);
  }

  if(oldState.channelId===HARD_WAIT && newState.channelId!==HARD_WAIT){
    hardQueue = hardQueue.filter(id=>id!==oldState.id);
    sendLog(`${oldState.member.displayName} 빡겜 이탈`);
  }

  updateQueueUI(oldState.guild);
});

client.login(TOKEN);

/* 서버 유지 */
setInterval(()=>console.log("Heartbeat"),300000);
app.get("/",(req,res)=>res.send("Bot running"));
app.listen(process.env.PORT || 3000);