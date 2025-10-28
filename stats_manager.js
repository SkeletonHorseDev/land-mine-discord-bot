const fs = require('node:fs');
const path = require('node:path');

const statsPath = path.resolve('./stats.json');

function getStats() {
  try {
    if (fs.existsSync(statsPath)) {
      const data = fs.readFileSync(statsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read stats.json:', err);
  }
  return {};
}

function saveStats(stats) {
  try {
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error('Failed to write stats.json:', err);
  }
}

function getFormattedDate(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

function incrementStat(userId, username, statKey) {
  const stats = getStats();
  const now = Date.now();
  const formattedDate = getFormattedDate(now);

  if (!stats[userId]) {
    stats[userId] = {
      username: username,
      total_stats: {
        rolls: 0,
        landed_on_mine: 0,
        saved: 0,
        muted_in_voice: 0,
      },
      daily_stats: {},
      events: [],
    };
  }

  // increment total
  stats[userId].total_stats[statKey]++;

  // increment daily
  if (!stats[userId].daily_stats[formattedDate]) {
    stats[userId].daily_stats[formattedDate] = {
      rolls: 0,
      landed_on_mine: 0,
      saved: 0,
      muted_in_voice: 0,
    };
  }
  stats[userId].daily_stats[formattedDate][statKey]++;

  // add event to history
  stats[userId].events.push({
    event: statKey,
    timestamp: now,
    date: formattedDate,
  });

  stats[userId].username = username;
  saveStats(stats);
}

function getStatsByDateRange(userId, startDate, endDate) {
  const stats = getStats();
  const userStats = stats[userId];

  if (!userStats) return null;

  const result = {};
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = getFormattedDate(current.getTime());
    result[dateStr] = userStats.daily_stats[dateStr] || {
      rolls: 0,
      landed_on_mine: 0,
      saved: 0,
      muted_in_voice: 0,
    };
    current.setDate(current.getDate() + 1);
  }

  return result;
}

module.exports = {
  getStats,
  saveStats,
  incrementStat,
  getStatsByDateRange,
};
