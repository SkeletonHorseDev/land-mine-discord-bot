
const { SlashCommandBuilder } = require('discord.js');
const { setSetting } = require('../../settings_manager.js');

module.exports = {
  data: new SlashCommandBuilder()
  .setName('set_channel_timeout')
  .setDescription('Sets the amount of seconds a user is timed out after stepping on a land mine.')
  .addIntegerOption((option) => option.setName('seconds').setDescription('Amount of seconds.').setRequired(true)),
  async execute(interaction) {
    const timeout_seconds = interaction.options.getInteger("seconds");

    setSetting("channel_timeout_time_seconds", timeout_seconds);

    await interaction.reply(`Land mine message timeout now set to ${timeout_seconds} seconds.`);
  },
};
