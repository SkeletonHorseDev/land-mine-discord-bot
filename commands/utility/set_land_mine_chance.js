
const { SlashCommandBuilder } = require('discord.js');
const { setSetting } = require('../../settings_manager.js');

module.exports = {
  data: new SlashCommandBuilder()
  .setName('set_land_mine_chance')
  .setDescription('Sets chance to step on a mine to 1 out of VALUE every message.')
  .addIntegerOption((option) => option.setName('value').setDescription('Chance: 1 / VALUE').setRequired(true)),
  async execute(interaction) {
    const mine_chance_range = interaction.options.getInteger("value");

    setSetting("land_mine_chance_range", mine_chance_range);

    await interaction.reply(`Chance to step on a land mine is now 1 out of ${mine_chance_range}.`);
  },
};
