const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags, SlashCommandBuilder } = require('discord.js');
const { getSettings } = require('./settings_manager.js');

const token = process.env.DISCORD_TOKEN;

// create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// client ready event - runs once on startup
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// gather commands
client.commands = new Collection();

// track members currently timed out
const timedOutMembers = [];
client.timedOutMembers = timedOutMembers;

// track mute state for users who leave voice while muted
const mutedUsers = new Map();
client.mutedUsers = mutedUsers;

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);
for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// when a command is run
client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		} else {
			await interaction.reply({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		}
	}
});

// helper randi function
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// array helper function I like
const ArrayHelper = {
  erase(arr, value) {
    const index = arr.indexOf(value);
    if (index !== -1) {
      arr.splice(index, 1);
    }
  },
};

// settings
let settings = getSettings();
console.log(settings);

const settingsPath = path.resolve('./settings.json');

fs.watchFile(settingsPath, () => {
  settings = getSettings();
  console.log(`Settings reloaded due to file change: ${JSON.stringify(settings)}`);
});

// clean up expired entries every day
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [userId, expiresAt] of mutedUsers.entries()) {
    if (now >= expiresAt) {
      mutedUsers.delete(userId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired mute entries`);
  }
}, 24 * 60 * 60 * 1000);

// message create event handler
client.on('messageCreate', async (message) => {
  try {
    // ignore bot messages
    if (message.author.bot) return;

    // ignore users who have opted out
    if (settings.opted_out_users?.includes(message.author.id)) {
      console.log("Ignored opted out user.");
      return;
    }
    
    console.log('Received message.');

    // check if user is timed out
    if (timedOutMembers.includes(message.author)) {
      // if so, delete message, not allowed to speak
      await message.delete().catch((err) => {
        console.error(
          `Failed to delete message from ${message.author.tag}:`,
          err
        );
      });
      return;
    }

    // random chance to trigger landmine
    if (getRandomIntInclusive(1, settings.land_mine_chance_range) === 1) {
      const nickname =
        message.member?.nickname || message.author.username;

      console.log(`${nickname} stepped on a land mine.`);

      // add user to timeout list
      if (!timedOutMembers.includes(message.author)) {
        timedOutMembers.push(message.author);
      }

      // send initial notification
      try {
        await message.reply(
          `**${nickname}** stepped on a land mine and was timed out for ` +
            `${settings.channel_timeout_time_seconds} seconds.`
        );
      } catch (err) {
        console.error(
          `Failed to send reply to ${message.author.tag}:`,
          err
        );
      }

      // get guild member
      const member = message.guild.members.cache.get(
        message.author.id
      );

      // mute if in voice channel, otherwise just timeout messages
      if (member?.voice.channel) {
        try {
          await member.voice.setMute(true);

          await message.reply({
            content:
              `Your mouth was blown off in the land mine ` +
              `explosion. You have been muted. Wait ` +
              `${settings.voice_channel_timeout_time_seconds} seconds to be ` +
              `unmuted.`,
          });

          console.log(`Muted ${message.author.tag}`);
        } catch (err) {
          console.error(
            `Failed to mute ${message.author.tag}:`,
            err
          );
        }
      } else {
        console.log(`${message.author.tag} is not in a voice ` +
          `channel - message timeout only`);
      }

      // record mute expiration time
      const expiresAt =
        Date.now() + settings.voice_channel_timeout_time_seconds * 1000;
      mutedUsers.set(message.author.id, expiresAt);

      // start message un-timeout timer
      setTimeout(() => {
        try {
          ArrayHelper.erase(timedOutMembers, message.author);
          console.log(`${nickname} is no longer timed out for messages.`);
        } catch (err) {
          console.error(
            `Failed to remove ${message.author.tag} from ` +
            `timeout:`,
            err
          );
        }
      }, settings.channel_timeout_time_seconds * 1000);
      
      // start voice un-timeout timer
      setTimeout(() => {
        try {
          // only unmute if member exists and is in voice
          if (member?.voice.channel) {
            member.voice.setMute(false);
            //mutedUsers.delete(message.author.id);
          }

          console.log(`${nickname} is no longer timed out in voice channels.`);
        } catch (err) {
          console.error(
            `Failed to remove ${message.author.tag} from ` +
            `timeout:`,
            err
          );
        }
      }, settings.voice_channel_timeout_time_seconds * 1000);
    }
  } catch (err) {
    console.error('Unexpected error in messageCreate handler:', err);
  }
});

// voice state update event handler
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    // check if user joined a voice channel
    if (newState.channel && !oldState.channel) {
      const userId = newState.member.id;
      const settings = getSettings();

      // check if user is opted out - unmute them regardless
      if (settings.opted_out_users?.includes(userId)) {
        if (newState.member.voice.channel) {
          try {
            await newState.member.voice.setMute(false);
            console.log(
              `Unmuted opted-out user ${newState.member.user.tag} on ` +
              `voice channel join`
            );
          } catch (err) {
            console.error(
              `Failed to unmute ${newState.member.user.tag}:`,
              err
            );
          }
        }
        return;
      }

      // check if user is still muted from a landmine
      if (newState.client.mutedUsers?.has(userId)) {
        const expiresAt = newState.client.mutedUsers.get(userId);

        // if timeout expired, unmute them
        if (Date.now() >= expiresAt) {
          try {
            await newState.member.voice.setMute(false);
            console.log(
              `Unmuted ${newState.member.user.tag} on voice ` +
              `rejoin (timeout expired)`
            );
          } catch (err) {
            console.error(
              `Failed to unmute ${newState.member.user.tag}:`,
              err
            );
          }
          newState.client.mutedUsers.delete(userId);
        } else {
          // timeout still active, reapply mute
          try {
            await newState.member.voice.setMute(true);
            console.log(
              `Reapplied mute to ${newState.member.user.tag} ` +
              `on voice channel rejoin`
            );
          } catch (err) {
            console.error(
              `Failed to mute ${newState.member.user.tag}:`,
              err
            );
          }
        }
      }
    }
  } catch (err) {
    console.error('Unexpected error in voiceStateUpdate handler:', err);
  }
});

// login to Discord
client.login(token);
