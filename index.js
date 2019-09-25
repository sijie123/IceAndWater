const Telegraf = require('telegraf')
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
const db = require('./db.js');
const https = require('https');
const config = require('./config.js');
const Team = require("./TeamModel.js").teamModel;
const Game = require('./GameModel.js').gameModel;
const Player = require('./PlayerModel.js').playerModel;
const Kill = require("./KillModel.js").killModel;
const request = require('request-promise');
const text2png = require('text2png');

const Msg = require('./msg.js');
const GameLogic = require('./gamelogic.js');
const auth = require('./auth.js');
const admin = require('./admin.js');

const bot = new Telegraf(config.BOT_TOKEN);
let msg = new Msg(bot);
let gameLogic = new GameLogic();

console.log("started");
bot.start((ctx) => {
  if (isPM(ctx)) {
    msg.sendMessage(ctx.chat.id, "Hello there! Welcome to Guardians of the Animals!");
    msg.sendMessage(ctx.chat.id, "If you have a team code, tell me with /join <TEAM_CODE>. Otherwise, just hang on tight! :)");
  } else if (isGroup(ctx)) {
    msg.sendMessage(ctx.chat.id, "Hello there! Welcome to Guardians of the Animals!");
    msg.sendMessage(ctx.chat.id, "If you have a game code, tell me with /join [GAME_CODE] [TEAM_NAME]. Otherwise, just hang on tight! :)");
  } else if (isChannel(ctx)) {
    msg.sendMessage(ctx.from.id, "Hello there! While Telegram channels are cool, we don't support it yet. Switch over to a group and I'll be happy to help!");
  } else {
    console.warn("An error has occurred: message type not PM | Group | Channel.");
    console.log(ctx);
  }
})
bot.command('update', async (ctx) => {
  admin.updateAdmin(ctx, msg);
})
bot.command('updateBroadcast', async (ctx) => {
  admin.updateAll(ctx, msg);
})
bot.command('join', (ctx) => {
  let cmd = ctx.message.text;
  let arr = cmd.split(" ");
  let code = arr[1];
  if (code === undefined) {
    msg.sendMessage(ctx.chat.id, "Sorry, please use the format /join TEAM_CODE.");
    return;
  }
  if (code.length == 5) {
    //Game Code
    let teamName = arr.splice(2).join(" ");
    joinGame(ctx, code, teamName);
  } else if (code.length == 4) {
    //Team Code
    joinTeam(ctx, code);
  } else {
    msg.sendMessage(ctx.chat.id, "Sorry, I don't recognise the code you provided...");
  }
})
bot.command('newgame', async (ctx) => {
  gameLogic.newGame(ctx);
})
bot.command('startgame', async (ctx) => {
  let authenticated = await auth.verifySuperAdmin(ctx.from.id);
  if (!authenticated) {
    console.warn(ctx.from.first_name + " tried to use the startgame command...");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  let result = await startGame();
  if (!result) {
    msg.sendMessage(ctx.from.id, "I seem to be having trouble starting a new game.");
  } else {
    await broadcast(true, "Let the games begin!");
    updateAllStatus();
  }
})
/*bot.command('demote', async (ctx) => {
  let sijie = await getPlayerFromID(44943747);
  console.log(sijie);
  sijie['state']['role'] = "player";
  await sijie.save();
  ctx.reply("Done");
})
bot.command('promote', async (ctx) => {
  let sijie = await getPlayerFromID(44943747);
  sijie['state']['role'] = "moderator";
  sijie['state']['status'] = "alive";
  await sijie.save();
  ctx.reply("Done");
})*/
bot.command('kill', async (ctx) => {
  //let authenticated = await auth.verifyModerator(ctx.from.id);
  /*if (!authenticated) {
    console.warn(ctx.from.first_name + " tried to use the kill command.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }*/
  let game = await Game.findOne({}).exec();
  if (game['started'] == false) {
    msg.sendMessage(ctx.chat.id, "The game has ended!");
    return;
  }
  if (!isPM(ctx)) {
    msg.sendMessage(ctx.chat.id, "Sure! Let me know who you killed via PM.");
  }
  let player = await Player.findOne({"telegramUser.id": ctx.from.id}).exec();
  if (player == null) {
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  let isAlive = await auth.verifyAlive(ctx.from.id);
  if (!isAlive) {
    msg.sendMessage(ctx.from.id, "Dead men don't talk. :P");
    return;
  }
  let teams = await getAllTeams();
  let markupArray = [];
  for (let i = 0; i < teams.length; i++) {
    let team = teams[i];
    if (player['state']['team']["_id"].toHexString() === team["_id"].toHexString() || team["isPlayable"] === false)
      continue;
    markupArray.push([Markup.callbackButton(team['name'], `{"action": "listAlivePlayers", "team": ${team['telegramID']} }`)]);
  }
  markupArray.push([Markup.callbackButton('Cancel', `{"action": "cancel"}`)]);
  msg.sendInteractive(ctx.from.id, "Which team is the player from?", Markup.inlineKeyboard(markupArray).oneTime().extra())
})

bot.command('revive', async (ctx) => {
  let authenticated = await auth.verifyModerator(ctx.from.id);
  if (!authenticated) {
    console.warn(ctx.from.first_name + " tried to use the revive command.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  if (!isPM(ctx)) {
    msg.sendMessage(ctx.chat.id, "Okay! Let me know who you're reviving via PM.");
  }
  let teams = await getAllTeams();
  let markupArray = [];
  for (let i = 0; i < teams.length; i++) {
    let team = teams[i];
    if (team['isPlayable'] == false)
      continue;
    markupArray.push([Markup.callbackButton(team['name'], `{"action": "listDeadPlayers", "team": ${team['telegramID']} }`)]);
  }
  markupArray.push([Markup.callbackButton('Cancel', `{"action": "cancel"}`)]);
  msg.sendInteractive(ctx.from.id, "Which team is the player from?", Markup.inlineKeyboard(markupArray).oneTime().extra())
  //ctx.reply("Which team is the player in?", Markup.inlineKeyboard(markupArray).oneTime().resize().extra());
})

bot.on('callback_query', (ctx) => {
  let sender = ctx['update']['callback_query']['from']['id'];
  let message = JSON.parse(ctx['update']['callback_query']['data']);
  processCallback(sender, ctx, message);
  ctx.answerCbQuery()
})
function processCallback(sender, ctx, message) {
  if (message['action'] === "listAlivePlayers") {
    updateKillListPlayers(ctx, message);
  } else if (message['action'] === "killPlayer") {
    killPlayer(ctx, message);
  } else if (message['action'] === "confirmKill") {
    confirmKillPlayer(ctx, message);
  } else if (message['action'] === "denyKill") {
    denyKillPlayer(ctx, message);
  } else if (message['action'] === "listDeadPlayers") {
    updateReviveListPlayers(ctx, message);
  } else if (message['action'] === "revivePlayer") {
    revivePlayer(ctx, message);
  } else if (message['action'] === "cancel") {
    cancel(ctx);
  }
}

async function updateKillListPlayers(ctx, message) {
  let teamID = message['team'];
  let team = await getTeamFromID(teamID);
  if (team == null) {
    console.warn(ctx.from.first_name + " provided invalid teamID: " + teamID + "to list players to kill.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  let isAlive = await auth.verifyAlive(ctx.from.id);
  if (!isAlive) {
    ctx.editMessageText("Dead men don't talk. :P");
    return;
  }
  let players = await getAllPlayersInTeam(team);
  let markupArray = []
  for (let j = 0; j < players.length; j++) {
    let player = players[j];
    if (player['state']['status'] === "alive") {
      markupArray.push([Markup.callbackButton(player['telegramUser']['firstName'], `{"action": "killPlayer", "player": ${player['telegramUser']['id']} }`)]);
    }
  }
  markupArray.push([Markup.callbackButton('Cancel', `{"action": "cancel"}`)]);
  ctx.editMessageText('Who to kill?', Markup.inlineKeyboard(markupArray).oneTime().extra() );
}

async function updateReviveListPlayers(ctx, message) {
  let teamID = message['team'];
  let team = await getTeamFromID(teamID);
  if (team == null) {
    console.warn(ctx.from.first_name + " provided invalid teamID: " + teamID + "to list players to revive.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  let players = await getAllPlayersInTeam(team);
  let markupArray = []
  for (let j = 0; j < players.length; j++) {
    let player = players[j];
    if (player['state']['status'] === "dead") {
      markupArray.push([Markup.callbackButton(player['telegramUser']['firstName'], `{"action": "revivePlayer", "player": ${player['telegramUser']['id']} }`)]);
    }
  }
  markupArray.push([Markup.callbackButton('Cancel', `{"action": "cancel"}`)]);
  ctx.editMessageText('Who to revive?', Markup.inlineKeyboard(markupArray).oneTime().extra() );
}

async function killPlayer(ctx, message) {
  let playerID = message['player'];
  let player = await getPlayerFromID(playerID);
  if (player == null) {
    console.warn(ctx.from.first_name + " provided invalid playerID: " + playerID + "to kill.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  let killerID = ctx.from.id;
  let killer = await getPlayerFromID(playerID);
  if (killer == null) {
    console.warn(ctx.from.first_name + " provided invalid killerID: " + killerID + "to kill.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  let isAlive = await auth.verifyAlive(ctx.from.id);
  if (!isAlive) {
    ctx.editMessageText("Dead men don't talk. :P");
    return;
  }
  let isModerator = await auth.verifyModerator(killerID);
  if (isModerator) {
    if (kill(playerID, ctx.from.id)) {
      ctx.editMessageText(`Your wish is my command. ${player['telegramUser']['firstName']} has been killed.`);
    } else {
      ctx.editMessageText(`Hmm... It looks like ${player['telegramUser']['firstName']} is already dead.`);
    }
  } else {
    if (requestKill(playerID, ctx.from.id)) {
      ctx.editMessageText(`Thanks! Please hold while we confirm with your target: ${player['telegramUser']['firstName']}.`);
    } else {
      ctx.editMessageText(`Hmm... It looks like ${player['telegramUser']['firstName']} is already dead.`);
    }
  }
}

async function revivePlayer(ctx, message) {
  let isModerator = await auth.verifyModerator(ctx.from.id);
  if (!isModerator) {
    console.warn(ctx.from.first_name + " tried to use the revive command.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  let playerID = message['player'];
  let player = await getPlayerFromID(playerID);
  if (player == null) {
    console.warn(ctx.from.first_name + " provided invalid playerID: " + playerID + "to revive.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  if (revive(playerID)) {
    ctx.editMessageText(`Your wish is my command. ${player['telegramUser']['firstName']} has been revived.`)
  }
  
}

async function cancel(ctx) {
  ctx.editMessageText('Cancelled');
}

async function confirmKillPlayer(ctx, message) {
  let playerID = message['p'];
  let player = await getPlayerFromID(playerID);
  if (player == null) {
    console.warn(ctx.from.first_name + " provided invalid playerID: " + playerID + "to confirm kill.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  let killerID = message['k'];
  let killer = await getPlayerFromID(killerID);
  if (killer == null) {
    console.warn(ctx.from.first_name + " provided invalid killerID: " + killerID + "to kill.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  if (kill(playerID, killerID)) {
    msg.sendMessage(killerID, `Nice! You've taken ${player['telegramUser']['firstName']} out!`);
  }
  ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]).extra());
}

async function denyKillPlayer(ctx, message) {
  let playerID = message['p'];
  let player = await getPlayerFromID(playerID);
  if (player == null) {
    console.warn(ctx.from.first_name + " provided invalid playerID: " + playerID + "to confirm kill.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  let killerID = message['k'];
  let killer = await getPlayerFromID(killerID);
  if (killer == null) {
    console.warn(ctx.from.first_name + " provided invalid killerID: " + killerID + "to kill.");
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  let game = await Game.findOne().exec();
  let teamMod = game['moderator'];
  msg.sendMessage(teamMod['telegramID'], `Heads up! ${killer['telegramUser']['firstName']} claimed to have killed ${player['telegramUser']['firstName']}. However, ${player['telegramUser']['firstName']} does not agree. Please manually confirm the kill, and use the /kill command if necessary.`)
  ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]).extra());
}

/*bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))*/
bot.launch()

function isPM(ctx) {
  return ctx.chat.type === "private";
}
function isGroup(ctx) {
  return ctx.chat.type === "group" || ctx.chat.type === "supergroup";
}
function isChannel(ctx) {
  return ctx.chat.type === "channel";
}

async function joinGame(ctx, code, teamName) {
  console.log(ctx.chat.type);
  let authenticated = await auth.verifyModerator(ctx.from.id);
  if (!authenticated) {
    notifyInvalidCommand(ctx.chat.id);
    return;
  }
  if (! ((ctx.chat.type === "group") || (ctx.chat.type === "supergroup"))) {
    msg.sendMessage(ctx.chat.id, "This command can only be used in a group.");
    return;
  }
  
  let teamCode = await initTeam(ctx.chat.id, code, teamName);
  if (teamCode == null) {
    return;
  }
  msg.sendMessage(ctx.chat.id, "Welcome to the battlefield, team " + teamName + ". For new recruits: PM me with /join " + teamCode + " to join this group.");
}

async function joinTeam(ctx, code) {
  let isIngame = await auth.verifyPlayer(ctx.from.id);
  if (isIngame) {
    msg.sendMessage(ctx.chat.id, "It seems that you've already joined another group...");
    return;
  }
  if (ctx.chat.type !== "private") {
    msg.sendMessage(ctx.chat.id, ctx.from.first_name + ": Sorry, please PM me instead.");
    return;
  } 
  let teamName = await initPlayer(ctx, code);
  if (teamName == null) {
    return;
  }
  console.log(ctx.from.first_name + " has joined team " + teamName);
  msg.sendMessage(ctx.chat.id, "Welcome to the battlefield, " + ctx.from.first_name + ". You have joined team " + teamName + ".");
}








async function startGame() {
  let gameCreated = await isGameCreated();
  let gameStarted = await hasGameStarted();
  if (!gameCreated || gameStarted) {
    return false;
  }
  let game = await Game.findOneAndUpdate({}, {'started': true}).exec();
  return true;
}



function pmOrElse(pmID, message, chatID) {
  msg.sendMessage(pmID, message).catch(err => {
    msg.sendMessage(chatID, "You need to start a chat with me first!");
  })
}

async function requestKill(playerID, killerID) {
  let player = await getPlayerFromID(playerID);
  let killer = await getPlayerFromID(killerID);
  if (player == null || killer == null) {
    return false;
  }
  let isModerator = await auth.verifyModerator(playerID);
  if (isModerator) {
    msg.sendMessage(killerID, "That's not right... You can't kill a moderator!");
    console.warn(killerID + " tried to kill a moderator, " + playerID + "...");
    return false;
  }
  let isSuperMod = await auth.verifySuperAdmin(playerID);
  if (isSuperMod) {
    msg.sendMessage(killerID, "How dare you... You're trying to kill my creator :(");
    //Can kill, don't return false!
  }
  if (player['state']['status'] !== "alive") {
    return false;
  }
  let markupArray = [];
  //markupArray.push(Markup.callbackButton("Yes", "No"));
  //markupArray.push(Markup.callbackButton("No", "No"));
  markupArray.push([Markup.callbackButton("Yes", `{"action": "confirmKill", "p": ${playerID}, "k": ${killerID} }`)]);
  markupArray.push([Markup.callbackButton("No", `{"action": "denyKill", "p": ${playerID}, "k": ${killerID} }`)]);
  
  msg.sendInteractive(player['telegramUser']['id'], `Were you killed by ${killer['telegramUser']['firstName']}?`, Markup.inlineKeyboard(markupArray).oneTime().extra());
  return true;
}

async function kill(playerID, killerID) {
  let player = await Player.findOne({"telegramUser.id": playerID}).exec();
  let killer = await Player.findOne({"telegramUser.id": killerID}).exec();
  if (player == null || killer == null) {
    return false;
  }
  if (player['state']['status'] !== "alive") {
    return false;
  }
  player['state']['status'] = "dead";
  player['state']['killedBy'] = killer['telegramUser']['firstName'];
  killer['state']['kills'] += 1;
  await player.save();
  await killer.save();
  let record = new Kill({
    killer: killer['telegramUser']['firstName'],
    player: player['telegramUser']['firstName'],
    sent: false
  })
  await record.save();
  let allTeams = await getAllTeams();
  for (let i = 0; i < allTeams.length; i++) {
    let team = allTeams[i];
    if (team["isPlayable"] == false) {
      //Mods team
      msg.sendMessage(team["telegramID"], player["telegramUser"]['firstName'] + " (" + player['state']['team']['name'] + ") was killed by " + killer['telegramUser']['firstName'] + " (" + killer['state']['team']['name'] + ")");
      break;
    }
  }
  msg.sendMessage(player['telegramUser']['id'], "Oh no! You were killed by " + killer['telegramUser']['firstName'] + ".");
  return true;
}

async function revive(playerID) {
  let player = await Player.findOne({"telegramUser.id": playerID}).exec();
  if (player == null) {
    return false;
  }
  if (player['state']['status'] !== "dead" || player['state']['role'] === "moderator") {
    return false;
  }
  player['state']['status'] = "alive";
  await player.save();
  msg.sendMessage(player['telegramUser']['id'], "Wow! You're alive again. I guess miracles do happen :O");
  return true;
}

function minsToMidnight() {
  var now = new Date();
  var then = new Date(now);
  then.setHours(24, 0, 0, 0);
  return (then - now);
}
broadcast(true, "Thank you for playing Guardians of the Animals! Here are the final stats:")
updateAllStatus()
//broadcast(true, "Animal Uprising: All players have been revived! If you had died early, now's your chance for revenge! :D")
//updateAllStatus()
//setTimeout(() => updateAllStatus(), minsToMidnight());
//console.log(minsToMidnight());