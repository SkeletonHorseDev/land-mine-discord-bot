
const { Client, Events, GatewayIntentBits } = require('discord.js');

const token = process.env.DISCORD_TOKEN

// create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });


// chen the client is ready, this code is run once
client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});


// helper randi
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min); // Ensure min is an integer;
  max = Math.floor(max); // Ensure max is an integer;
  return Math.floor(Math.random() * (max - min + 1)) + min;;
}

// array function I like
const ArrayHelper = {
  erase(arr, value) {
    const index = arr.indexOf(value);
    if (index !== -1) {
      arr.splice(index, 1);
    }
  },
};


// holds all members that are currently timed out
var timed_out_members = [];


// ran on every new message
client.on('messageCreate', async (message) => {
  try {
    // ignore bot messages
    if (message.author.bot) return;

    console.log("Received message.");

    if (timed_out_members.includes(message.author)) {
      await message.delete().catch((err) => {
        console.error(
          `Failed to delete message from ${message.author.tag}:`,
          err
        );
      });
      return;
    }

    // check for random change to step on land mine and be timed out
    if (getRandomIntInclusive(1, process.env.LANDMINE_RANGE) === 1) {
      const nickname =
        message.member?.nickname || message.author.username;

      console.log(`${nickname} stepped on a land mine.`);

      try {
        await message.reply(
          `${nickname} stepped on a land mine and was timed out for ` +
            `${process.env.TIMEOUT_SECONDS} seconds.`
        );
      } catch (err) {
        console.error(`Failed to send reply to ${message.author.tag}:`, err);
      }

      if (!timed_out_members.includes(message.author)) {
        timed_out_members.push(message.author);
      }
      
      // get the guild member
      const member = message.guild.members.cache.get(message.author.id);

      // check if member exists and is in a voice channel
      if (member && member.voice.channel) {
        member.voice.setMute(true);
        
        // notify user they were muted
        message.reply({
          content: `Your mouth was blown off in the land mine explosion. You have been muted. Wait ${process.env.TIMEOUT_SECONDS} seconds to be unmuted.`,
        });
        
        console.log(`Muted ${message.author.tag}`);
      } else {
        console.log(`${message.author.tag} is not in a voice channel`);
      }

      // start a timer to un-timeout
      setTimeout(() => {
        try {
          // undo timeout actions
          ArrayHelper.erase(timed_out_members, message.author);
          member.voice.setMute(false);
          
          console.log(`${nickname} is no longer timed out.`);
        } catch (err) {
          console.error(
            `Failed to remove ${message.author.tag} from timeout:`,
            err
          );
        }
      }, process.env.TIMEOUT_SECONDS * 1000);
    }
  } catch (err) {
    console.error('Unexpected error in messageCreate handler:', err);
  }
});


// log in to Discord with your client token
client.login(token);


