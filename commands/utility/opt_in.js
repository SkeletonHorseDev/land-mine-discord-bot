const { SlashCommandBuilder } = require('discord.js');
const { getSettings, setSetting } = require('../../settings_manager.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('opt_in')
    .setDescription('Opt back in to land mine triggers.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to opt in (leave empty to opt yourself in)')
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

      // check if user is opted out
      const index = opted_out.indexOf(target_id);
      if (index === -1) {
        await interaction.reply({
          content: `${target_user.tag} is not opted out.`,
          ephemeral: true,
        });
        return;
      }

      // remove from opted out list
      opted_out.splice(index, 1);
      setSetting('opted_out_users', opted_out);

      await interaction.reply(
        `${target_user.tag} has been opted back in to land mine triggers.`
      );
    } catch (err) {
      console.error('Error in opt_in command:', err);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error processing the opt-in request.',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'There was an error processing the opt-in request.',
          ephemeral: true,
        });
      }
    }
  },
};
