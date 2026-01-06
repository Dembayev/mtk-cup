export const tg = window.Telegram?.WebApp;

export const syncAvatar = async (telegramId, supabaseUrl) => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_id: telegramId }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.avatar_url;
    }
  } catch (error) {
    console.error("Error syncing avatar:", error);
  }
  return null;
};
