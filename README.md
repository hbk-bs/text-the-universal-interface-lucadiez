# chatty-chat-chat-ttui

Reduced web chat UI demo from the 2025 HBK BS "Text: The Universal Interface" seminar (Digital Basics).

## What it does
- Lets you chat with an AI (via Val Town OpenAI proxy)
- System prompt: AI acts as an ASCII art generator, responds in JSON
- Chat history is shown, user/assistant roles styled
- Max 10 message history (truncates old)

## Files
- `index.html`: UI markup
- `index.js`: Chat logic, fetches from val.town (remix this to use your own endpoint https://www.val.town/x/ff6347/openai_api)
- `style.css`: Basic responsive styles

## Usage
1. Open `index.html` in a browser (no server needed)
2. Type a message, hit send
3. See AI's ASCII art reply

## Notes
- No backend required, all client-side
- Uses a public Val Town endpoint for OpenAI API
- For demo/learning only, not production
