const Discord = require('discord.js');
const client = new Discord.Client();
const {GoogleSpreadsheet} = require('google-spreadsheet');
const credentials = require('./credentials.json');
const sheetId = process.env.CREDENTIALS.sheetId;

const isCompleted = "Completed";
const isToBeRetrieved = "To be retrieved";

const achievements = [
    { name: "Group forming"    , cell:"H"},
    { name: "Knowledge sharing", cell:"I"},
    { name: "Gamemaking"       , cell:"J"},
    { name: "Photo-Mode"       , cell:"K"},
    { name: "Self-Improvement" , cell:"L"},
    { name: "Participation"    , cell:"M"},
]

const botReady = 'Bot at the ready';
const notRetrievedYet = ", but you haven't retrieved the reward yet";
const achNotFound = "Could not find that achievement category";
const nameNotFound = "Could not find that name";
const discordNameNotFound = "Could not find that discord name, make sure to connect your account by typing:```connect YourRegisteredNameHere```";
const alreadyAchieved = "You already have this achievement";
const alreadyConnected = "You already have a connected account";
const nameAlreadyTaken = "Name is already occupied, go check with the help-desk if this is your first time trying to connect your account";
const helpReply = `**Achievement Manager DM Commands:**

To show this messages send a dm with the text 'help' to this bot. 

This bot is optional but might be convenient to you if you are too busy with jamming and want to wait with getting the rewards till the end of the jam. 
This bot can help you keep track of you achievement categories and set your achievement categories to the ones you have completed but have yet to receive the reward.

When you have signed in at the help-desk, connect your discord account to your registred name by typing:
${"```"}
connect YourRegisteredNameHere
${"```"}
These commands below require that you have connected and registered your name to your discord account: 

Get status of which Achievement categories you have completed:
${"```"}
status
${"```"}
If you have completed an achievement category, you can type the category:
${"```"}
<Achievement Categoryname>
${"```"}
Example:
${"```"}
Gamemaking
${"```"}
Get more information at our website at https://levelonejam.com/#achievements

`;

const achievementCategoryList = `The achievement categories are: ${"```"}yaml
Group forming
Knowledge sharing
Gamemaking
Photo-Mode
Self-Improvement
Participation
${"```"}`;

const completedText = (name) => `Success!
You have completed the _${name}_ achievement category! Congrats! 

You can now retrieve your reward at the help desk!`
const connectedSuccessfully = (name, discordName) => `Success! 
You have connected your name _${name}_ to your discord account: 
_${discordName}_ 

If you have completed an achievement category (3 sub-achievements), type the name of the category here. 

${achievementCategoryList}`;

const displayStatus = (statusArr) => `Status:${"```"}yaml
${statusArr}${"```"}`;

function flatten(statusArr){
    let string = '';
    statusArr.forEach(s => string += `${s.name} - ${s.status===null?"Not achieved yet":s.status}
`)
    return string;
}

async function auth(){
    const doc = new GoogleSpreadsheet(sheetId);
    
    await doc.useServiceAccountAuth(credentials);
    await doc.getInfo();
    return doc;
}

async function setAchievement(discordName,ach){
    const doc = await auth();

    const sheet = await doc.sheetsByIndex[1];
    const obj = await getUserIndex(sheet,discordName,"D");
    if(obj.index === null) return {success:false,msg:discordNameNotFound}
    let index = obj.index;

    const achSheet = await doc.sheetsByIndex[0];
    await achSheet.loadCells(`A${index}:M${index}`);
    //console.log(achSheet.cellStats); 

    const achievement = achievements.filter(a => a.name.toLowerCase() === ach.toLowerCase())[0];

    if(achievement === undefined) return {success:false,msg:`${achNotFound}
${achievementCategoryList}`}

    const c6 = achSheet.getCellByA1(`${achievement.cell}${index}`);

    if(c6.value === isCompleted) return {success:true,msg: alreadyAchieved}
    else if(c6.value === isToBeRetrieved) return {success:true,msg: alreadyAchieved+notRetrievedYet}
    else c6.value = isToBeRetrieved;

    await achSheet.saveUpdatedCells();
    
    return {success:true,msg: completedText(achievement.name)}
    
}

async function getStatus(discordName){
    const doc = await auth();

    const sheet = await doc.sheetsByIndex[1];
    const obj = await getUserIndex(sheet,discordName,"D");
    if(obj.index === null) return {success:false,msg:discordNameNotFound}
    let index = obj.index;

    const achSheet = await doc.sheetsByIndex[0];
    await achSheet.loadCells(`H${index}:M${index}`);

    const statusArr = [];
    for (let i = 0; i < achievements.length; i++) {
        statusArr.push({name:achievements[i].name,status:await achSheet.getCellByA1(achievements[i].cell+index).value});
    }

    return {success:true,msg: displayStatus(flatten(statusArr))};
}

async function getUserIndex(sheet,name,col){
    await sheet.loadCells('A1');
    const a1 = sheet.getCellByA1('A1');
    a1.value = `=MATCH("${name}", Sheet1!${col}:${col}, 0)`;
    
    await sheet.saveUpdatedCells();
    const a2 = await sheet.getCellByA1('A1');
    let val = a2.formattedValue;
    if(val === '#N/A') {
        return {index:null} 
    } else {
        return {index:val}
    }
}

client.on('ready',() => {
    console.log(botReady);
});

client.on('message', msg => {
    handleMessage(msg);
});

client.login(process.env.BOT_TOKEN);

async function connectName(discordName,name){
    const doc = await auth();

    //Check if username is already used
    const sheet = await doc.sheetsByIndex[1];
    const discordSearch = await getUserIndex(sheet,discordName,"D");
    if(discordSearch.index !== null) return {success:false,msg:alreadyConnected}
    
    const obj = await getUserIndex(sheet,name,"B");
    if(obj.index === null) return {success:false,msg:nameNotFound}
    let index = obj.index;
    
    const achSheet = await doc.sheetsByIndex[0];
    await achSheet.loadCells(`A${index}:M${index}`);

    const dx = achSheet.getCellByA1(`D${index}`);
    if(dx.value !== null) return {success:false,msg:nameAlreadyTaken};
    dx.value = discordName;
    
    await achSheet.saveUpdatedCells();
    return {success:true,msg:connectedSuccessfully(name,discordName)}
}

function handleMessage(msg){
    if(msg.author.bot) return;
    if(msg.channel.type !== 'dm') return;
    console.log(getUniqueDiscordUser(msg.author) + " : " + msg.content);
    if(msg.content === 'ping'){
        msg.reply('pong');
    } else if(msg.content.toLowerCase().startsWith("help")){
        msg.reply(helpReply);
    } else if(msg.content.toLowerCase().startsWith("connect")){
        const name = msg.content.substring(7).trim();
        connectName(getUniqueDiscordUser(msg.author),name).then(result => msg.reply(result.msg));
    } else if(msg.content.toLowerCase().startsWith("status")){
        getStatus(getUniqueDiscordUser(msg.author)).then(result => msg.reply(result.msg));
    } else {
        const achivementCategory = msg.content.trim();
        setAchievement(getUniqueDiscordUser(msg.author),achivementCategory).then(result => msg.reply(result.msg));
    }
}

function getUniqueDiscordUser(author){
    return author.username +"#"+ author.discriminator;
}