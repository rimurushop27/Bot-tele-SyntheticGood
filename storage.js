const fs = require('fs');
const path = require('path');
const {
  DEFAULT_PROMPT_PROFILE,
  DEFAULT_CAPTION_PROFILE,
} = require('./config');

const DATA_FILE = path.join(__dirname, 'bot_data.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultData() {
  return {
    apiKey: '',
    promptProfiles: [clone(DEFAULT_PROMPT_PROFILE)],
    captionProfiles: [clone(DEFAULT_CAPTION_PROFILE)],
    activePromptProfileId: DEFAULT_PROMPT_PROFILE.id,
    activeCaptionProfileId: DEFAULT_CAPTION_PROFILE.id,
  };
}

function sanitizeData(data) {
  const safe = createDefaultData();
  if (!data || typeof data !== 'object') return safe;

  safe.apiKey = typeof data.apiKey === 'string' ? data.apiKey : '';
  safe.promptProfiles = Array.isArray(data.promptProfiles) && data.promptProfiles.length
    ? data.promptProfiles.filter(isValidProfile)
    : [clone(DEFAULT_PROMPT_PROFILE)];
  safe.captionProfiles = Array.isArray(data.captionProfiles) && data.captionProfiles.length
    ? data.captionProfiles.filter(isValidProfile)
    : [clone(DEFAULT_CAPTION_PROFILE)];

  if (!safe.promptProfiles.length) safe.promptProfiles = [clone(DEFAULT_PROMPT_PROFILE)];
  if (!safe.captionProfiles.length) safe.captionProfiles = [clone(DEFAULT_CAPTION_PROFILE)];

  safe.activePromptProfileId = safe.promptProfiles.some((p) => p.id === data.activePromptProfileId)
    ? data.activePromptProfileId
    : safe.promptProfiles[0].id;
  safe.activeCaptionProfileId = safe.captionProfiles.some((p) => p.id === data.activeCaptionProfileId)
    ? data.activeCaptionProfileId
    : safe.captionProfiles[0].id;

  return safe;
}

function isValidProfile(profile) {
  return profile
    && typeof profile.id === 'string'
    && typeof profile.name === 'string'
    && typeof profile.content === 'string'
    && profile.id.trim()
    && profile.name.trim()
    && profile.content.trim();
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const defaults = createDefaultData();
      saveData(defaults);
      return defaults;
    }

    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const clean = sanitizeData(parsed);
    if (JSON.stringify(clean) !== JSON.stringify(parsed)) {
      saveData(clean);
    }
    return clean;
  } catch (error) {
    console.error('Failed to load data:', error);
    const defaults = createDefaultData();
    saveData(defaults);
    return defaults;
  }
}

function saveData(data) {
  const clean = sanitizeData(data);
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(clean, null, 2), 'utf8');
  fs.renameSync(tempFile, DATA_FILE);
  return clean;
}

function generateProfileId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  DATA_FILE,
  loadData,
  saveData,
  generateProfileId,
};
