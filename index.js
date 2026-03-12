const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { OWNER_ID, BOT_TOKEN, CORE_PROMPT_INSTRUCTION, CORE_CAPTION_INSTRUCTION, DEFAULT_CUSTOM_PROMPT_INSTRUCTION, DEFAULT_CUSTOM_CAPTION_INSTRUCTION } = require('./config');

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Config file path
const CONFIG_FILE = path.join(__dirname, 'bot_config.json');

// Load or create config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  
  return {
    groqApiKey: '',
    customPromptInstruction: DEFAULT_CUSTOM_PROMPT_INSTRUCTION,
    customCaptionInstruction: DEFAULT_CUSTOM_CAPTION_INSTRUCTION
  };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

let config = loadConfig();

// Storage
const pendingImages = new Map();
const processingUsers = new Set();
const userLanguage = new Map();

// Check if user is owner
function isOwner(userId) {
  return userId === OWNER_ID;
}

// Merge core + custom instructions with language
function buildFullInstruction(type, language) {
  const langText = language === 'English' ? 'English' : 'Indonesian';
  
  let coreInstruction, customInstruction;
  
  if (type === 'prompt') {
    coreInstruction = CORE_PROMPT_INSTRUCTION;
    customInstruction = config.customPromptInstruction;
  } else {
    coreInstruction = CORE_CAPTION_INSTRUCTION;
    customInstruction = config.customCaptionInstruction;
  }
  
  // Merge instructions
  const fullInstruction = `${coreInstruction}\n\n${customInstruction}`;
  
  // Replace {LANGUAGE} placeholder
  return fullInstruction.replace(/{LANGUAGE}/g, langText);
}

// API call
async function callGroqAPI(imageBuffer, fullInstruction) {
  if (!config.groqApiKey) {
    throw new Error('No API key configured. Owner must set key with /setkey');
  }

  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        { role: 'system', content: fullInstruction },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: 'Analyze this image following ALL the system instructions exactly. Follow the language requirement strictly.' }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API Error ${response.status}`);
  }

  const result = await response.json();
  return result.choices[0].message.content.trim();
}

// OWNER COMMANDS

bot.onText(/\/setkey (.+)/, async (msg, match) => {
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '❌ Owner-only command.');
  }
  
  const apiKey = match[1].trim();
  config.groqApiKey = apiKey;
  
  if (saveConfig(config)) {
    await bot.sendMessage(msg.chat.id, `✅ *API Key Updated!*\n\nKey: \`${apiKey.substring(0, 20)}...${apiKey.slice(-10)}\`\n\nBot is ready to use.`, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(msg.chat.id, '❌ Failed to save config.');
  }
});

bot.onText(/\/setpromptinstruction (.+)/s, async (msg, match) => {
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '❌ Owner-only command.');
  }
  
  const instruction = match[1].trim();
  config.customPromptInstruction = instruction;
  
  if (saveConfig(config)) {
    await bot.sendMessage(msg.chat.id, `✅ *Custom Prompt Instruction Updated!*\n\nLength: ${instruction.length} characters\n\nThis will be merged with core instruction.`, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(msg.chat.id, '❌ Failed to save config.');
  }
});

bot.onText(/\/setcaptioninstruction (.+)/s, async (msg, match) => {
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '❌ Owner-only command.');
  }
  
  const instruction = match[1].trim();
  config.customCaptionInstruction = instruction;
  
  if (saveConfig(config)) {
    await bot.sendMessage(msg.chat.id, `✅ *Custom Caption Instruction Updated!*\n\nLength: ${instruction.length} characters\n\nThis will be merged with core instruction.`, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(msg.chat.id, '❌ Failed to save config.');
  }
});

bot.onText(/\/viewconfig/, async (msg) => {
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '❌ Owner-only command.');
  }
  
  const apiKeyStatus = config.groqApiKey ? `✅ Set (${config.groqApiKey.substring(0, 15)}...${config.groqApiKey.slice(-8)})` : '❌ Not set';
  
  await bot.sendMessage(msg.chat.id, `⚙️ *Current Configuration*

*API Key:* ${apiKeyStatus}

*Custom Instructions:*
- Prompt: ${config.customPromptInstruction.length} chars
- Caption: ${config.customCaptionInstruction.length} chars

*How it works:*
Core (fixed) + Custom (yours) = Full instruction

*Commands:*
/setkey <key>
/setpromptinstruction <text>
/setcaptioninstruction <text>
/resetconfig`, { parse_mode: 'Markdown' });
});

bot.onText(/\/resetconfig/, async (msg) => {
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '❌ Owner-only command.');
  }
  
  config.customPromptInstruction = DEFAULT_CUSTOM_PROMPT_INSTRUCTION;
  config.customCaptionInstruction = DEFAULT_CUSTOM_CAPTION_INSTRUCTION;
  
  if (saveConfig(config)) {
    await bot.sendMessage(msg.chat.id, '✅ Custom instructions reset to defaults!\n\n⚠️ API key preserved.', { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(msg.chat.id, '❌ Failed to save config.');
  }
});

// USER COMMANDS

bot.onText(/\/start/, (msg) => {
  const isOwnerUser = isOwner(msg.from.id);
  
  let message = `🎨 *SyntheticGood Bot*

Two features:
📝 IMG to PROMPT - Detailed prompts
✨ CAPTION - 5 captions with trending hashtags

*Usage:*
1. Send photo
2. Choose language (EN/ID)
3. Choose feature
4. Get result!

Simple! 🚀`;

  if (isOwnerUser) {
    message += `\n\n👑 *Owner Commands:*
/setkey <key>
/viewconfig
/setpromptinstruction <text>
/setcaptioninstruction <text>
/resetconfig`;
  }
  
  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `❓ *Help*

*Usage:*
1. Send photo
2. Choose: English or Indonesian
3. Choose: PROMPT or CAPTION
4. Get clean output

*Features:*
📝 PROMPT: AI image generation prompt in your language
✨ CAPTION: 5 captions + trending hashtags in your language

Easy! 🎯`, { parse_mode: 'Markdown' });
});

// Handle photos
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (processingUsers.has(userId)) {
    return;
  }
  
  try {
    const photo = msg.photo[msg.photo.length - 1];
    const fileLink = await bot.getFileLink(photo.file_id);
    const response = await fetch(fileLink);
    const imageBuffer = await response.buffer();
    
    pendingImages.set(userId, {
      buffer: imageBuffer,
      timestamp: Date.now()
    });
    
    await bot.sendMessage(chatId, '🌍 *Choose language:*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🇬🇧 English', callback_data: 'lang_en' },
          { text: '🇮🇩 Indonesian', callback_data: 'lang_id' }
        ]]
      }
    });
    
  } catch (error) {
    console.error('Photo handling error:', error);
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

// Handle callbacks
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  
  await bot.answerCallbackQuery(query.id);
  
  if (data.startsWith('lang_')) {
    const lang = data === 'lang_en' ? 'English' : 'Indonesian';
    userLanguage.set(userId, lang);
    
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
    
    await bot.sendMessage(chatId, `✅ Language: *${lang}*\n\n📸 *Choose output:*`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📝 PROMPT', callback_data: 'type_prompt' },
          { text: '✨ CAPTION', callback_data: 'type_caption' }
        ]]
      }
    });
    return;
  }
  
  if (data.startsWith('type_')) {
    if (processingUsers.has(userId)) {
      return;
    }
    
    if (!pendingImages.has(userId)) {
      return bot.sendMessage(chatId, '⚠️ Image expired. Send new photo.');
    }
    
    const lang = userLanguage.get(userId) || 'English';
    const type = data === 'type_prompt' ? 'prompt' : 'caption';
    
    processingUsers.add(userId);
    
    const imageData = pendingImages.get(userId);
    const imageBuffer = imageData.buffer;
    
    try {
      await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      
      const processingMsg = await bot.sendMessage(chatId, `🔄 *Processing in ${lang}...*\n_10-15 seconds_`, { parse_mode: 'Markdown' });
      
      // Build full instruction (core + custom + language)
      const fullInstruction = buildFullInstruction(type, lang);
      
      if (type === 'prompt') {
        const result = await callGroqAPI(imageBuffer, fullInstruction);
        await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
        await bot.sendMessage(chatId, result);
        
      } else {
        const result = await callGroqAPI(imageBuffer, fullInstruction);
        await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
        
        const captions = result.split('---CAPTION_SEPARATOR---').map(c => c.trim()).filter(c => c);
        
        for (let i = 0; i < Math.min(captions.length, 5); i++) {
          await bot.sendMessage(chatId, captions[i]);
          if (i < captions.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }
      }
      
    } catch (error) {
      console.error('Processing error:', error);
      await bot.sendMessage(chatId, `❌ *Error:* ${error.message}`, { parse_mode: 'Markdown' });
      
    } finally {
      pendingImages.delete(userId);
      processingUsers.delete(userId);
      userLanguage.delete(userId);
    }
  }
});

// Cleanup
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000;
  
  for (const [userId, data] of pendingImages.entries()) {
    if (now - data.timestamp > timeout) {
      pendingImages.delete(userId);
      processingUsers.delete(userId);
      userLanguage.delete(userId);
    }
  }
}, 5 * 60 * 1000);

bot.on('polling_error', (error) => console.error('Polling error:', error));

console.log('✅ SyntheticGood Bot v3 is running...');
console.log('👑 Owner ID:', OWNER_ID);
console.log('🔑 API Key:', config.groqApiKey ? config.groqApiKey.substring(0, 20) + '...' : 'NOT SET');
console.log('📝 Instruction system: CORE (fixed) + CUSTOM (editable)');
