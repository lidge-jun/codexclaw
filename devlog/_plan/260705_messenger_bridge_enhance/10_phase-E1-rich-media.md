 # messenger_bridge — Phase E1: Rich Media Support
 
 Status: IN PROGRESS · class C3 · zero new runtime deps
 
 ## Scope
 
 1. Telegram link rendering (markdown → HTML anchor)
 2. Telegram media send: sendPhoto, sendDocument
 3. Telegram media receive: photo/document → download → prompt context
 4. Discord embed support for long outputs
 5. Discord file attachment send
 6. Inline keyboard support (Telegram reply_markup)
 
 ## Implementation Notes
 
 - telegram-format.ts: add link conversion `[text](url)` → `<a href="url">text</a>`
 - telegram-api.ts: add sendPhoto, sendDocument, getFile methods
 - discord-api.ts: add sendEmbed, sendFileAttachment methods
 - telegram-adapter.ts: detect file paths in Codex output, route to sendDocument/sendPhoto
 - telegram-adapter.ts: handle photo/document message types → download + prompt wrap
 - discord-adapter.ts: use embeds for oversized code blocks
