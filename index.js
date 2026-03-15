const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const {
  OWNER_ID,
  BOT_TOKEN,
  BOT_TITLE,
  MODEL_NAME,
  CORE_PROMPT_INSTRUCTION,
  CORE_CAPTION_INSTRUCTION,
} = require('./config');
const { loadData, saveData, generateProfileId } = require('./storage');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let db = loadData();

const userSessions = new Map();
const adminStates = new Map();
const activeJobs = new Set();

function isOwner(userId) {
  return Number(userId) === Number(OWNER_ID);
}

function getSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {});
  }
  return userSessions.get(userId);
}

function clearSession(userId) {
  userSessions.delete(userId);
}

function setAdminState(userId, state) {
  adminStates.set(userId, state);
}

function getAdminState(userId) {
  return adminStates.get(userId) || null;
}

function clearAdminState(userId) {
  adminStates.delete(userId);
}

function refreshDb() {
  db = loadData();
  return db;
}

function persistDb(nextDb) {
  db = saveData(nextDb);
  return db;
}

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function maskApiKey(apiKey) {
  if (!apiKey) return 'Belum diatur';
  if (apiKey.length <= 10) return `${apiKey.slice(0, 3)}***`;
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}

function languageName(code) {
  return code === 'en' ? 'English' : 'Indonesia';
}

function modeName(mode) {
  return mode === 'caption' ? 'CAPTION' : 'PROMPT';
}

function getProfiles(type) {
  return type === 'caption' ? db.captionProfiles : db.promptProfiles;
}

function getActiveProfile(type) {
  const profiles = getProfiles(type);
  const activeId = type === 'caption' ? db.activeCaptionProfileId : db.activePromptProfileId;
  return profiles.find((item) => item.id === activeId) || profiles[0];
}

function buildSystemInstruction(type, langCode) {
  const core = type === 'caption' ? CORE_CAPTION_INSTRUCTION : CORE_PROMPT_INSTRUCTION;
  const activeProfile = getActiveProfile(type);
  const lang = languageName(langCode);

  const combined = [
    core,
    '',
    'ACTIVE CUSTOM SYSTEM INSTRUCTION:',
    activeProfile.content,
  ].join('\n');

  return combined.replace(/{LANGUAGE_NAME}/g, lang);
}

function userMainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🇮🇩 Indonesia', callback_data: 'lang:id' },
        { text: '🇬🇧 English', callback_data: 'lang:en' },
      ],
    ],
  };
}

function modeKeyboard(langCode) {
  return {
    inline_keyboard: [
      [
        { text: '📝 PROMPT', callback_data: `mode:prompt:${langCode}` },
        { text: '✨ CAPTION', callback_data: `mode:caption:${langCode}` },
      ],
      [{ text: '↩️ Ganti Bahasa', callback_data: 'go:language' }],
    ],
  };
}

function adminMainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔑 API Key', callback_data: 'admin:apikey:menu' }],
      [{ text: '📝 SI PROMPT', callback_data: 'admin:prompt:menu' }],
      [{ text: '✨ SI CAPTION', callback_data: 'admin:caption:menu' }],
      [{ text: '📊 Status', callback_data: 'admin:status' }],
    ],
  };
}

function adminBackKeyboard(section) {
  return { inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: `admin:${section}:menu` }]] };
}

function renderProfileMenu(type) {
  const profiles = getProfiles(type);
  const activeId = type === 'caption' ? db.activeCaptionProfileId : db.activePromptProfileId;
  const rows = profiles.map((profile) => ([{
    text: `${profile.id === activeId ? '✅' : '📄'} ${profile.name}`,
    callback_data: `admin:${type}:view:${profile.id}`,
  }]));

  rows.push([
    { text: '➕ Tambah Baru', callback_data: `admin:${type}:add` },
    { text: '👁️ Lihat Aktif', callback_data: `admin:${type}:showactive` },
  ]);
  rows.push([{ text: '⬅️ Kembali', callback_data: 'admin:home' }]);

  return { inline_keyboard: rows };
}

function profileDetailKeyboard(type, profileId, canDelete) {
  const rows = [
    [{ text: '✅ Jadikan Aktif', callback_data: `admin:${type}:activate:${profileId}` }],
  ];
  if (canDelete) {
    rows.push([{ text: '🗑️ Hapus', callback_data: `admin:${type}:delete:${profileId}` }]);
  }
  rows.push([{ text: '⬅️ Kembali', callback_data: `admin:${type}:menu` }]);
  return { inline_keyboard: rows };
}

function getStatusText() {
  const activePrompt = getActiveProfile('prompt');
  const activeCaption = getActiveProfile('caption');

  return [
    `<b>${escapeHtml(BOT_TITLE)} - Status Sistem</b>`,
    '',
    `<b>Admin Telegram ID:</b> <code>${OWNER_ID}</code>`,
    `<b>API Key:</b> ${escapeHtml(maskApiKey(db.apiKey))}`,
    `<b>Jumlah SI PROMPT:</b> ${db.promptProfiles.length}`,
    `<b>Jumlah SI CAPTION:</b> ${db.captionProfiles.length}`,
    `<b>SI PROMPT aktif:</b> ${escapeHtml(activePrompt.name)}`,
    `<b>SI CAPTION aktif:</b> ${escapeHtml(activeCaption.name)}`,
    '',
    'Core system instruction akan selalu digabungkan dengan sistem instruction aktif sebelum gambar diproses.',
  ].join('\n');
}

async function sendOrEdit(chatId, text, options = {}, query = null) {
  const payload = { chat_id: chatId, text, parse_mode: 'HTML', ...options };
  if (query?.message?.message_id) {
    try {
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: options.reply_markup,
      });
    } catch (error) {
      if (!String(error.message).includes('message is not modified')) {
        return bot.sendMessage(chatId, text, options);
      }
    }
  }
  return bot.sendMessage(chatId, text, options);
}

async function showAdminHome(chatId, query = null) {
  clearAdminState(query?.from?.id || chatId);
  return sendOrEdit(
    chatId,
    [
      `<b>Admin Panel</b>`,
      '',
      'Pilih menu pengaturan:',
      '• API Key',
      '• SI PROMPT',
      '• SI CAPTION',
      '',
      'Semua hasil AI selalu memakai: <b>Core System Instruction + Sistem Instruction Aktif</b>.',
    ].join('\n'),
    { reply_markup: adminMainKeyboard() },
    query,
  );
}

async function showApiKeyMenu(chatId, query = null) {
  return sendOrEdit(
    chatId,
    [
      '<b>Pengaturan API Key</b>',
      '',
      `<b>Status:</b> ${escapeHtml(maskApiKey(db.apiKey))}`,
      '',
      'Gunakan tombol di bawah untuk mengatur atau menghapus API key.',
    ].join('\n'),
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Set API Key', callback_data: 'admin:apikey:set' }],
          [{ text: '🗑️ Hapus API Key', callback_data: 'admin:apikey:clear' }],
          [{ text: '⬅️ Kembali', callback_data: 'admin:home' }],
        ],
      },
    },
    query,
  );
}

async function processImage(chatId, userId) {
  const session = getSession(userId);
  if (!session.photoBuffer || !session.lang || !session.mode) {
    return bot.sendMessage(chatId, 'Data proses belum lengkap. Kirim foto lagi ya.');
  }
  if (activeJobs.has(userId)) {
    return bot.sendMessage(chatId, 'Masih ada proses yang berjalan. Tunggu sebentar lalu coba lagi.');
  }

  activeJobs.add(userId);
  try {
    if (!db.apiKey) {
      throw new Error('API key belum diatur admin. Buka /admin lalu set API key terlebih dahulu.');
    }

    const systemInstruction = buildSystemInstruction(session.mode, session.lang);
    await bot.sendMessage(chatId, `⏳ Sedang memproses ${modeName(session.mode)} dalam ${languageName(session.lang)}...`);

    const result = await callGroqVision(session.photoBuffer, session.mode, systemInstruction, session.lang);
    clearSession(userId);

    if (session.mode === 'caption') {
      const captions = result.split('---CAPTION_SEPARATOR---').map((item) => item.trim()).filter(Boolean);
      const rendered = captions.length
        ? captions.map((item, index) => `<b>Caption ${index + 1}</b>\n${escapeHtml(item)}`).join('\n\n')
        : escapeHtml(result);
      await bot.sendMessage(chatId, rendered, { parse_mode: 'HTML' });
    } else {
      await bot.sendMessage(chatId, escapeHtml(result), { parse_mode: 'HTML' });
    }
  } catch (error) {
    console.error('Process error:', error);
    await bot.sendMessage(chatId, `❌ Gagal memproses gambar.\n${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
  } finally {
    activeJobs.delete(userId);
  }
}

async function callGroqVision(imageBuffer, mode, systemInstruction, langCode) {
  const base64Image = imageBuffer.toString('base64');
  const userPrompt = mode === 'caption'
    ? `Analyze this image carefully and produce caption output in ${languageName(langCode)}.`
    : `Analyze this image carefully and produce prompt output in ${languageName(langCode)}.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${db.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      temperature: 0.5,
      max_tokens: 1800,
      messages: [
        { role: 'system', content: systemInstruction },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  }

  const content = payload?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Respons AI kosong.');
  }
  return content;
}

bot.onText(/^\/start$/, async (msg) => {
  clearAdminState(msg.from.id);
  clearSession(msg.from.id);
  const lines = [
    `<b>${escapeHtml(BOT_TITLE)}</b>`,
    '',
    'Kirim foto lalu pilih bahasa dan mode:',
    '• 📝 PROMPT',
    '• ✨ CAPTION',
    '',
    'Bot akan menganalisa gambar dengan sistem utama lalu menggabungkannya dengan sistem instruction aktif.',
  ];

  if (isOwner(msg.from.id)) {
    lines.push('', 'Sebagai admin, buka <b>/admin</b> untuk mengatur API key, SI PROMPT, dan SI CAPTION.');
  }

  await bot.sendMessage(msg.chat.id, lines.join('\n'), { parse_mode: 'HTML' });
});

bot.onText(/^\/myid$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `Telegram User ID kamu: <code>${msg.from.id}</code>`, { parse_mode: 'HTML' });
});

bot.onText(/^\/cancel$/, async (msg) => {
  clearAdminState(msg.from.id);
  clearSession(msg.from.id);
  await bot.sendMessage(msg.chat.id, 'Proses dibatalkan.');
});

bot.onText(/^\/admin$/, async (msg) => {
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '❌ Menu ini hanya untuk admin utama.');
  }
  refreshDb();
  return showAdminHome(msg.chat.id);
});

bot.on('photo', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  clearAdminState(userId);

  try {
    const photo = msg.photo[msg.photo.length - 1];
    const file = await bot.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('Gagal mengunduh foto dari Telegram.');
    }

    const buffer = await response.buffer();
    const session = getSession(userId);
    session.photoBuffer = buffer;
    session.fileId = photo.file_id;
    delete session.lang;
    delete session.mode;

    await bot.sendMessage(chatId, 'Foto diterima. Pilih bahasa output:', {
      reply_markup: userMainKeyboard(),
    });
  } catch (error) {
    console.error('Photo error:', error);
    await bot.sendMessage(chatId, `❌ Gagal membaca foto. ${error.message}`);
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data || '';

  try {
    if (data === 'admin:home') {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      refreshDb();
      await showAdminHome(chatId, query);
    } else if (data === 'admin:status') {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      refreshDb();
      await sendOrEdit(chatId, getStatusText(), { reply_markup: adminMainKeyboard() }, query);
    } else if (data === 'admin:apikey:menu') {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      refreshDb();
      await showApiKeyMenu(chatId, query);
    } else if (data === 'admin:apikey:set') {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      setAdminState(userId, { action: 'set_api_key' });
      await bot.sendMessage(chatId, 'Kirim API key baru sekarang. Gunakan /cancel untuk batal.');
    } else if (data === 'admin:apikey:clear') {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      db.apiKey = '';
      persistDb(db);
      await showApiKeyMenu(chatId, query);
    } else if (data === 'admin:prompt:menu' || data === 'admin:caption:menu') {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      refreshDb();
      const type = data.includes(':prompt:') ? 'prompt' : 'caption';
      await sendOrEdit(
        chatId,
        `<b>Manajemen SI ${type === 'prompt' ? 'PROMPT' : 'CAPTION'}</b>\n\nPilih profile yang ingin dilihat atau dikelola.`,
        { reply_markup: renderProfileMenu(type) },
        query,
      );
    } else if (data === 'admin:prompt:add' || data === 'admin:caption:add') {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      const type = data.includes(':prompt:') ? 'prompt' : 'caption';
      setAdminState(userId, { action: 'add_profile_name', type });
      await bot.sendMessage(chatId, `Kirim nama untuk SI ${type === 'prompt' ? 'PROMPT' : 'CAPTION'} baru.`);
    } else if (data === 'admin:prompt:showactive' || data === 'admin:caption:showactive') {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      const type = data.includes(':prompt:') ? 'prompt' : 'caption';
      const active = getActiveProfile(type);
      await sendOrEdit(
        chatId,
        [
          `<b>SI ${type === 'prompt' ? 'PROMPT' : 'CAPTION'} Aktif</b>`,
          '',
          `<b>Nama:</b> ${escapeHtml(active.name)}`,
          '',
          `<pre>${escapeHtml(active.content)}</pre>`,
        ].join('\n'),
        { reply_markup: adminBackKeyboard(type) },
        query,
      );
    } else if (/^admin:(prompt|caption):view:/.test(data)) {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      const [, type, profileId] = data.match(/^admin:(prompt|caption):view:(.+)$/);
      const profiles = getProfiles(type);
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) throw new Error('Profile tidak ditemukan.');
      const activeId = type === 'caption' ? db.activeCaptionProfileId : db.activePromptProfileId;
      const canDelete = profiles.length > 1 && profile.id !== (type === 'caption' ? 'caption_default' : 'prompt_default');
      await sendOrEdit(
        chatId,
        [
          `<b>Detail SI ${type === 'prompt' ? 'PROMPT' : 'CAPTION'}</b>`,
          '',
          `<b>Nama:</b> ${escapeHtml(profile.name)}`,
          `<b>Status:</b> ${profile.id === activeId ? 'Aktif' : 'Tidak aktif'}`,
          '',
          `<pre>${escapeHtml(profile.content)}</pre>`,
        ].join('\n'),
        { reply_markup: profileDetailKeyboard(type, profileId, canDelete) },
        query,
      );
    } else if (/^admin:(prompt|caption):activate:/.test(data)) {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      const [, type, profileId] = data.match(/^admin:(prompt|caption):activate:(.+)$/);
      const profiles = getProfiles(type);
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) throw new Error('Profile tidak ditemukan.');
      if (type === 'caption') db.activeCaptionProfileId = profileId;
      else db.activePromptProfileId = profileId;
      persistDb(db);
      await bot.answerCallbackQuery(query.id, { text: `Profile aktif: ${profile.name}` });
      await sendOrEdit(
        chatId,
        `✅ SI ${type === 'prompt' ? 'PROMPT' : 'CAPTION'} aktif sekarang: <b>${escapeHtml(profile.name)}</b>`,
        { reply_markup: renderProfileMenu(type) },
        query,
      );
    } else if (/^admin:(prompt|caption):delete:/.test(data)) {
      if (!isOwner(userId)) throw new Error('Bukan admin.');
      const [, type, profileId] = data.match(/^admin:(prompt|caption):delete:(.+)$/);
      const listKey = type === 'caption' ? 'captionProfiles' : 'promptProfiles';
      if (db[listKey].length <= 1) throw new Error('Minimal harus ada 1 profile.');
      const target = db[listKey].find((item) => item.id === profileId);
      if (!target) throw new Error('Profile tidak ditemukan.');
      if (profileId === (type === 'caption' ? 'caption_default' : 'prompt_default')) {
        throw new Error('Profile default tidak bisa dihapus.');
      }
      db[listKey] = db[listKey].filter((item) => item.id !== profileId);
      if (type === 'caption' && db.activeCaptionProfileId === profileId) db.activeCaptionProfileId = db[listKey][0].id;
      if (type === 'prompt' && db.activePromptProfileId === profileId) db.activePromptProfileId = db[listKey][0].id;
      persistDb(db);
      await bot.answerCallbackQuery(query.id, { text: `Profile dihapus: ${target.name}` });
      await sendOrEdit(chatId, `🗑️ Profile <b>${escapeHtml(target.name)}</b> berhasil dihapus.`, { reply_markup: renderProfileMenu(type) }, query);
    } else if (data === 'go:language') {
      const session = getSession(userId);
      if (!session.photoBuffer) throw new Error('Kirim foto terlebih dahulu.');
      delete session.lang;
      delete session.mode;
      await sendOrEdit(chatId, 'Pilih bahasa output:', { reply_markup: userMainKeyboard() }, query);
    } else if (data.startsWith('lang:')) {
      const session = getSession(userId);
      if (!session.photoBuffer) throw new Error('Kirim foto terlebih dahulu.');
      const lang = data.split(':')[1];
      session.lang = lang;
      await sendOrEdit(chatId, `Bahasa dipilih: <b>${languageName(lang)}</b>\nSekarang pilih mode output.`, { reply_markup: modeKeyboard(lang) }, query);
    } else if (data.startsWith('mode:')) {
      const session = getSession(userId);
      if (!session.photoBuffer) throw new Error('Kirim foto terlebih dahulu.');
      const [, mode, lang] = data.split(':');
      session.mode = mode;
      session.lang = lang;
      await sendOrEdit(chatId, `Mode dipilih: <b>${modeName(mode)}</b>\nBahasa: <b>${languageName(lang)}</b>`, {}, query);
      await processImage(chatId, userId);
    }
  } catch (error) {
    await bot.answerCallbackQuery(query.id, { text: error.message, show_alert: true }).catch(() => {});
  }
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const userId = msg.from.id;
  if (!isOwner(userId)) return;

  const state = getAdminState(userId);
  if (!state) return;

  try {
    if (state.action === 'set_api_key') {
      db.apiKey = msg.text.trim();
      persistDb(db);
      clearAdminState(userId);
      await bot.sendMessage(msg.chat.id, `✅ API key berhasil disimpan.\nStatus: <code>${escapeHtml(maskApiKey(db.apiKey))}</code>`, { parse_mode: 'HTML' });
      return showApiKeyMenu(msg.chat.id);
    }

    if (state.action === 'add_profile_name') {
      const name = msg.text.trim();
      if (name.length < 3) {
        return bot.sendMessage(msg.chat.id, 'Nama profile minimal 3 karakter. Coba lagi.');
      }
      setAdminState(userId, { action: 'add_profile_content', type: state.type, name });
      return bot.sendMessage(
        msg.chat.id,
        `Nama disimpan: <b>${escapeHtml(name)}</b>\nSekarang kirim isi sistem instruction untuk profile ini.`,
        { parse_mode: 'HTML' },
      );
    }

    if (state.action === 'add_profile_content') {
      const content = msg.text.trim();
      if (content.length < 20) {
        return bot.sendMessage(msg.chat.id, 'Isi instruction terlalu pendek. Minimal 20 karakter.');
      }

      const profile = {
        id: generateProfileId(state.type),
        name: state.name,
        content,
      };
      const listKey = state.type === 'caption' ? 'captionProfiles' : 'promptProfiles';
      db[listKey].push(profile);
      persistDb(db);
      clearAdminState(userId);
      await bot.sendMessage(msg.chat.id, `✅ Profile baru berhasil disimpan: <b>${escapeHtml(profile.name)}</b>`, { parse_mode: 'HTML' });
      return bot.sendMessage(
        msg.chat.id,
        `Sekarang kamu bisa memilih profile itu dari menu SI ${state.type === 'prompt' ? 'PROMPT' : 'CAPTION'}.`,
        { reply_markup: renderProfileMenu(state.type) },
      );
    }
  } catch (error) {
    console.error('Admin state error:', error);
    await bot.sendMessage(msg.chat.id, `❌ ${error.message}`);
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

console.log(`${BOT_TITLE} berjalan...`);
console.log(`Admin ID: ${OWNER_ID}`);
