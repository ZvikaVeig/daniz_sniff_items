import { config } from "../config";

const api = (method: string) => `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;

function ready(): boolean {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set - skipping");
    return false;
  }
  return true;
}

export async function sendMessage(text: string, preview = false): Promise<void> {
  if (!ready()) return;
  const res = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegramChatId, text: text.slice(0, 4000), disable_web_page_preview: !preview }),
  });
  if (!res.ok) console.error("[telegram] sendMessage", res.status, (await res.text()).slice(0, 300));
}

// Photo with a caption; falls back to a text message (Telegram sometimes can't fetch the supplier image)
export async function sendPhoto(photoUrl: string | null, caption: string): Promise<void> {
  if (!ready()) return;
  if (photoUrl) {
    const res = await fetch(api("sendPhoto"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.telegramChatId, photo: photoUrl, caption: caption.slice(0, 1000) }),
    });
    if (res.ok) return;
    console.warn("[telegram] sendPhoto failed, sending text", res.status);
  }
  await sendMessage(caption, true);
}
