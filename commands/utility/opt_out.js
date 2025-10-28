const { SlashCommandBuilder } = require('discord.js');
const { getSettings, setSetting } = require('../../settings_manager.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('opt_out')
    .setDescription('Opt out of land mine triggers.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to opt out (leave empty to opt yourself out)')
        .setRequired(false)
    ),
  async execute(interaction) {
    try {
      // get target user (either specified user or command author)
      const target_user =
        interaction.options.getUser('user') || interaction.user;
      const target_id = target_user.id;

      // get current settings
      const settings = getSettings();
      const opted_out = settings.opted_out_users || [];

      // check if already opted out
      if (opted_out.includes(target_id)) {
        await interaction.reply({
          content: `**${target_user.tag}** is already opted out.`,
          ephemeral: true,
        });
        return;
      }

      // add to opted out list
      opted_out.push(target_id);
      setSetting('opted_out_users', opted_out);

      // get guild member
      const member = interaction.guild.members.cache.get(target_id);

      if (member) {
        // remove from timed out members if present
        const timed_out_index = interaction.client.timedOutMembers?.findIndex(
          (user) => user.id === target_id
        );
        if (
          timed_out_index !== undefined &&
          timed_out_index !== -1 &&
          interaction.client.timedOutMembers
        ) {
          interaction.client.timedOutMembers.splice(timed_out_index, 1);
          console.log(`Removed ${target_user.tag} from timed out members`);
        }

        // remove from muted users and unmute if in voice
        if (interaction.client.mutedUsers?.has(target_id)) {
          interaction.client.mutedUsers.delete(target_id);
          console.log(`Removed ${target_user.tag} from muted users`);

          // unmute if currently in voice channel
          if (member.voice?.channel) {
            try {
              await member.voice.setMute(false);
              console.log(`Unmuted ${target_user.tag}`);
            } catch (err) {
              console.error(`Failed to unmute ${target_user.tag}:`, err);
            }
          }
        }
      }

      await interaction.reply(
        `**${target_user.tag}** has been opted out of land mine triggers.`
      );
    } catch (err) {
      console.error('Error in opt_out command:', err);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error processing the opt-out request.',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'There was an error processing the opt-out request.',
          ephemeral: true,
        });
      }
    }
  },
};
