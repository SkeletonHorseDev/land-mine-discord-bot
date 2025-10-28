const { Client, Events, GatewayIntentBits } = require('discord.js');

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

// track members currently timed out
const timedOutMembers = [];

// track mute state for users who leave voice while muted
const mutedUsers = new Map();

// message create event handler
client.on('messageCreate', async (message) => {
  try {
    // ignore bot messages
    if (message.author.bot) return;

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
    if (getRandomIntInclusive(1, process.env.LANDMINE_RANGE) === 1) {
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
          `${nickname} stepped on a land mine and was timed out for ` +
            `${process.env.TIMEOUT_SECONDS} seconds.`
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
              `${process.env.TIMEOUT_SECONDS} seconds to be ` +
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
        Date.now() + process.env.TIMEOUT_SECONDS * 1000;
      mutedUsers.set(message.author.id, expiresAt);

      // start un-timeout timer
      setTimeout(() => {
        try {
          ArrayHelper.erase(timedOutMembers, message.author);

          // only unmute if member exists and is in voice
          if (member?.voice.channel) {
            member.voice.setMute(false);
          }

          console.log(`${nickname} is no longer timed out.`);
        } catch (err) {
          console.error(
            `Failed to remove ${message.author.tag} from ` +
            `timeout:`,
            err
          );
        }
      }, process.env.TIMEOUT_SECONDS * 1000);
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

      // check if user is still muted from a landmine
      if (mutedUsers.has(userId)) {
        const expiresAt = mutedUsers.get(userId);

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
          mutedUsers.delete(userId);
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
