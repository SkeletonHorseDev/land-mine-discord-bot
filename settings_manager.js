
import fs from 'node:fs';
import path from 'node:path';

const settingsPath = path.resolve('./settings.json');

let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

export function getSettings() {
  return settings;
}

export function setSetting(key, value) {
  settings[key] = value;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

export function reloadSettings() {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}
