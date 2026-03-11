# SyntheticGood Bot v3 - Ultimate Edition

Advanced Telegram bot with owner control panel, multi-language support, and trending hashtags.

## ✨ Features

### For Users (Public):
- 📝 **IMG to PROMPT**: Ultra-detailed AI image generation prompts
- ✨ **CAPTION**: 5 social media captions with TRENDING viral hashtags
- 🌍 **Multi-language**: English or Indonesian output
- 🚀 **Simple**: Send photo → Choose language → Choose feature → Done

### For Owner (You):
- 🔑 **Set API key via Telegram** (no GitHub/Railway needed)
- ⚙️ **Update instructions on the fly** via bot commands
- 👁️ **View current config** anytime
- 🔄 **Reset to defaults** if needed
- 🔒 **Secure**: Only your Telegram user ID can access admin commands

## 🚀 Quick Start

### 1. Deploy to Railway
1. Create new GitHub repo
2. Upload these files: `config.js`, `index.js`, `package.json`, `.gitignore`
3. Connect repo to Railway
4. Deploy (wait 2-3 minutes)

### 2. First-Time Setup (Owner Only)
Open bot in Telegram and run:

```
/setkey gsk_your_groq_api_key_here
```

✅ Bot is now ready! Users can start using it.

### 3. Users Can Now Use Bot
Users just:
1. Send photo
2. Choose language (EN/ID)
3. Choose PROMPT or CAPTION
4. Get result instantly

## 👑 Owner Commands

### Set API Key
```
/setkey gsk_abc123xyz...
```
✅ Updates API key instantly (no redeploy needed)

### View Config
```
/viewconfig
```
Shows current API key status and instruction lengths

### Update Prompt Instruction
```
/setpromptinstruction Your new instruction here...
```
Changes how prompts are generated

### Update Caption Instruction
```
/setcaptioninstruction Your new instruction here...
```
Changes how captions are generated (including hashtag rules)

### Reset to Defaults
```
/resetconfig
```
Resets instructions to default (preserves API key)

## 🔒 Security

- **Owner-only commands**: Only User ID `1636051561` can access admin commands
- **No API key in code**: API key stored in `bot_config.json` on server (not in GitHub)
- **Safe to share**: Repo can be public, API key stays private

## 🌍 Multi-Language Support

Bot asks user to choose language before processing:
- 🇬🇧 **English**: Prompts and captions in English
- 🇮🇩 **Indonesian**: Prompts and captions in Indonesian

## 📊 Trending Hashtags

Caption feature uses **POPULAR TRENDING** hashtags based on:
- Ultra-popular tags (1M+ posts): #love #instagood #photooftheday
- Category-specific: #fashion #fitness #travel #food #beauty
- Niche but trending: Context-aware hashtags

8-12 hashtags per caption (last 3 captions only).

## 🛠️ Tech Stack

- Node.js 18+
- node-telegram-bot-api
- Groq API (Llama 4 Scout Vision)
- File-based config storage

## 📁 File Structure

```
syntheticgood-bot/
├── config.js           # Owner ID, default instructions
├── index.js            # Main bot logic
├── package.json        # Dependencies
├── .gitignore          # Ignore bot_config.json
└── bot_config.json     # Auto-generated (API key + custom instructions)
```

## 🔄 Updating

### Change Owner ID
Edit `config.js` line 6:
```javascript
const OWNER_ID = 1636051561; // Your Telegram user ID
```

### Get Your User ID
Chat with [@userinfobot](https://t.me/userinfobot) on Telegram.

## ⚠️ Important Notes

- `bot_config.json` is auto-created on first `/setkey` command
- Don't commit `bot_config.json` to GitHub (already in `.gitignore`)
- API key never exposed in code or GitHub
- Config persists across bot restarts

## 🎯 Example Usage

**Owner setup:**
```
You: /setkey gsk_abc123...
Bot: ✅ API Key Updated! Bot is ready to use.
```

**User flow:**
```
User: [sends photo]
Bot: 🌍 Choose language: [EN] [ID]
User: [clicks EN]
Bot: 📸 Choose output: [PROMPT] [CAPTION]
User: [clicks CAPTION]
Bot: 🔄 Processing...
Bot: [sends 5 captions with trending hashtags]
```

## 📞 Support

For issues, check Railway logs or contact bot owner.
