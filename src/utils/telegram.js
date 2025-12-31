import { supabase } from '../lib/supabase';

const BOT_TOKEN = "8513614914:AAFygkqgY7IBf5ktbzcdSXZF7QCOwjrCRAI";

export const sendNotification = async (type, team1Name, team2Name, score = "") => {
  try {
    let notifyField = "";
    if (type === "live") notifyField = "notify_live";
    else if (type === "result") notifyField = "notify_result";
    else if (type === "hour_before") notifyField = "notify_hour_before";
    else return;
    
    const { data: users } = await supabase
      .from("users")
      .select("telegram_id")
      .not(notifyField, "eq", false)
      .not("telegram_id", "is", null);
    
    if (!users || users.length === 0) return;
    
    let message = "";
    if (type === "live") {
      message = `🔴 МАТЧ НАЧАЛСЯ!\n\n🏐 ${team1Name} vs ${team2Name}\n\nСмотрите трансляцию в приложении!`;
    } else if (type === "result") {
      message = `🏆 МАТЧ ЗАВЕРШЁН!\n\n🏐 ${team1Name} ${score} ${team2Name}`;
    } else if (type === "hour_before") {
      message = `⏰ МАТЧ ЧЕРЕЗ 1 ЧАС!\n\n🏐 ${team1Name} vs ${team2Name}\n\nНе пропустите!`;
    }
    
    for (const user of users) {
      if (!user.telegram_id) continue;
      try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chat_id: user.telegram_id, 
            text: message,
            reply_markup: {
              inline_keyboard: [[
                { text: "📱 Открыть приложение", web_app: { url: "https://mtk-cup.vercel.app" } }
              ]]
            }
          })
        });
      } catch (e) {
        console.error("Failed to send notification:", e);
      }
    }
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
};

export const sendTeamMessage = async (teamId, teamName, message) => {
  try {
    const { data: teamPlayers, error: playersError } = await supabase
      .from("players")
      .select("user_id")
      .eq("team_id", teamId);
    
    console.log("Team players:", teamPlayers, "Error:", playersError);
    
    if (!teamPlayers || teamPlayers.length === 0) return { sent: 0, failed: 0, playersFound: 0, usersFound: 0, debug: "no players" };
    
    const userIds = teamPlayers.map(p => p.user_id).filter(Boolean);
    console.log("User IDs:", userIds);
    
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("telegram_id")
      .in("id", userIds)
      .not("telegram_id", "is", null);
    
    console.log("Users with telegram:", users, "Error:", usersError);
    
    if (!users || users.length === 0) return { sent: 0, failed: 0, playersFound: teamPlayers.length, usersFound: 0, debug: "no telegram_id" };
    
    const fullMessage = `📢 СООБЩЕНИЕ КОМАНДЕ "${teamName}"\n\n${message}`;
    
    let sent = 0, failed = 0, lastError = "";
    for (const user of users) {
      if (!user.telegram_id) continue;
      try {
        console.log("Sending to:", user.telegram_id);
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chat_id: user.telegram_id, 
            text: fullMessage,
            reply_markup: {
              inline_keyboard: [[
                { text: "📱 Открыть приложение", web_app: { url: "https://mtk-cup.vercel.app" } }
              ]]
            }
          })
        });
        const result = await response.json();
        console.log("Telegram response:", result);
        if (response.ok) sent++; else { failed++; lastError = result.description || "unknown"; }
      } catch (e) {
        console.error("Send error:", e);
        failed++;
      }
    }
    return { sent, failed, playersFound: teamPlayers.length, usersFound: users.length, debug: lastError || "ok" };
  } catch (error) {
    console.error("Error sending team message:", error);
    return { sent: 0, failed: 0 };
  }
};

export const notifyAdmins = async (message) => {
  try {
    const { data: admins } = await supabase.from("users").select("telegram_id").eq("role", "admin");
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        if (admin.telegram_id) {
          try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: admin.telegram_id, text: message }),
            });
          } catch (e) { console.error("Failed to notify admin:", e); }
        }
      }
    }
  } catch (error) {
    console.error("Error notifying admins:", error);
  }
};
