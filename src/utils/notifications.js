import { supabase } from '../lib/supabase';

const BOT_TOKEN = "8511377670:AAHjbsU1yy--EhuH2fiHJlDca2Ok7eE9v5w";
const APP_URL = "https://app.mtkcup.ru";

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
      message = `⏰ МАТЧ НАЧНЁТСЯ СКОРО!\n\n🏐 ${team1Name} vs ${team2Name}\n\nНе пропустите!`;
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
                { text: "📱 Открыть приложение", web_app: { url: APP_URL } }
              ]]
            }
          })
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    }
  } catch (error) {
    console.error("sendNotification error:", error);
  }
};

export const sendTeamMessage = async (teamId, teamName, message, senderName) => {
  try {
    const { data: players } = await supabase
      .from("players")
      .select("user_id")
      .eq("team_id", teamId);
    
    if (!players || players.length === 0) return;
    
    const userIds = players.map(p => p.user_id);
    const { data: users } = await supabase
      .from("users")
      .select("telegram_id")
      .in("id", userIds)
      .not("telegram_id", "is", null);
    
    if (!users || users.length === 0) return;
    
    const text = `📢 Сообщение для команды "${teamName}"\n\nОт: ${senderName}\n\n${message}`;
    
    for (const user of users) {
      if (!user.telegram_id) continue;
      try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: user.telegram_id, text })
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    }
    return true;
  } catch (error) {
    console.error("sendTeamMessage error:", error);
    return false;
  }
};

export const sendToOrganizers = async (userName, userTelegramId, message, userUsername = null) => {
  try {
    const { data: admins } = await supabase
      .from("users")
      .select("telegram_id, first_name, username")
      .eq("role", "admin")
      .not("telegram_id", "is", null);
    
    if (!admins || admins.length === 0) return { sent: 0, failed: 0 };
    
    let fullMessage = `📨 СООБЩЕНИЕ ОТ ПОЛЬЗОВАТЕЛЯ\n\nОт: ${userName}`;
    if (userUsername) fullMessage += `\nUsername: @${userUsername}`;
    fullMessage += `\nTelegram ID: ${userTelegramId}\n\n${message}`;
    
    let sent = 0, failed = 0;
    for (const admin of admins) {
      try {
        const messageData = { chat_id: admin.telegram_id, text: fullMessage };
        if (userUsername) {
          messageData.reply_markup = {
            inline_keyboard: [[{ text: "💬 Написать в Telegram", url: `https://t.me/${userUsername}` }]]
          };
        }
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messageData)
        });
        sent++;
      } catch {
        failed++;
      }
    }
    return { sent, failed };
  } catch (error) {
    console.error("sendToOrganizers error:", error);
    return { sent: 0, failed: 0 };
  }
};
