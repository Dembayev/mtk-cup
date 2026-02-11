import { useState, useEffect, useCallback, memo } from "react";
import { supabase } from "./lib/supabase";

// Supabase URL for edge functions
// Используем прокси через наш сервер для обхода блокировок
const SUPABASE_URL = window.location.hostname === "localhost" 
  ? "https://ecayfpszkleyxuhsekhu.supabase.co" 
  : "https://app.mtkcup.ru/api/supabase";

// Telegram notifications via Edge Function

// ТЕСТОВЫЙ РЕЖИМ: уведомления только админам
const TEST_MODE_NOTIFICATIONS = false;

const sendNotification = async (type, team1Name, team2Name, score = "") => {
  console.log("🔔 sendNotification called:", { type, team1Name, team2Name, score, testMode: TEST_MODE_NOTIFICATIONS });
  try {
    // Определяем поле для фильтра
    let notifyField = "";
    if (type === "live") notifyField = "notify_live";
    else if (type === "result") notifyField = "notify_result";
    else if (type === "hour_before") notifyField = "notify_hour_before";
    else return;
    
    // Получаем пользователей с включёнными уведомлениями
    let query = supabase.from("users").select("telegram_id").not("telegram_id", "is", null);
    
    // В тестовом режиме - только админы
    if (TEST_MODE_NOTIFICATIONS) {
      query = query.eq("role", "admin");
      console.log("🔔 TEST MODE: sending only to admins");
    } else {
      query = query.not(notifyField, "eq", false);
    }
    
    const { data: users } = await query;
    
    if (!users || users.length === 0) return;
    
    // Формируем сообщение
    let message = "";
    if (type === "live") {
      message = `🔴 МАТЧ НАЧАЛСЯ!\n\n🏐 ${team1Name} vs ${team2Name}\n\nСмотрите трансляцию в приложении!`;
    } else if (type === "result") {
      message = `🏆 МАТЧ ЗАВЕРШЁН!\n\n🏐 ${team1Name} ${score} ${team2Name}`;
    } else if (type === "hour_before") {
      message = `⏰ МАТЧ НАЧНЁТСЯ СКОРО!\n\n🏐 ${team1Name} vs ${team2Name}\n\nНе пропустите!`;
    }
    
    // Отправляем уведомления
    for (const user of users) {
      if (!user.telegram_id) continue;
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chat_id: user.telegram_id, 
            text: message,
            reply_markup: {
              inline_keyboard: [[
                { text: "📱 Открыть приложение", web_app: { url: "https://app.mtkcup.ru" } }
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

const sendToOrganizers = async (userName, userTelegramId, message, userUsername = null) => {
  try {
    // Получаем всех админов
    const { data: admins } = await supabase
      .from("users")
      .select("telegram_id, first_name, username")
      .eq("role", "admin")
      .not("telegram_id", "is", null);
    
    if (!admins || admins.length === 0) return { sent: 0, failed: 0 };
    
    // Формируем сообщение
    let fullMessage = `📨 СООБЩЕНИЕ ОТ ПОЛЬЗОВАТЕЛЯ\n\nОт: ${userName}`;
    if (userUsername) {
      fullMessage += `\nUsername: @${userUsername}`;
    }
    fullMessage += `\nTelegram ID: ${userTelegramId}\n\n${message}`;
    
    let sent = 0, failed = 0;
    for (const admin of admins) {
      try {
        const messageData = { 
          chat_id: admin.telegram_id, 
          text: fullMessage
        };
        
        // Добавляем кнопку только если есть username
        if (userUsername) {
          messageData.reply_markup = {
            inline_keyboard: [[
              { text: "💬 Написать в Telegram", url: `https://t.me/${userUsername}` }
            ]]
          };
        }
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messageData)
        });
        if (response.ok) sent++; else failed++;
      } catch (e) {
        failed++;
      }
    }
    return { sent, failed };
  } catch (error) {
    console.error("Error sending to organizers:", error);
    return { sent: 0, failed: 0 };
  }
};


const sendTeamMessage = async (teamId, teamName, message, senderName) => {
  console.log("📢 SendTeamMessage: Starting for team:", teamName);
  try {
    // Получаем игроков команды с их user данными
    const { data: teamPlayers, error: playersError } = await supabase
      .from("players")
      .select("user_id")
      .eq("team_id", teamId);
    
    console.log("Team players:", teamPlayers, "Error:", playersError);
    
    if (!teamPlayers || teamPlayers.length === 0) return { sent: 0, failed: 0, playersFound: 0, usersFound: 0, debug: "no players" };
    
    // Получаем telegram_id для каждого игрока
    const userIds = teamPlayers.map(p => p.user_id).filter(Boolean);
    console.log("User IDs:", userIds);
    
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("telegram_id")
      .in("id", userIds)
      .not("telegram_id", "is", null);
    
    console.log("Users with telegram:", users, "Error:", usersError);
    
    if (!users || users.length === 0) return { sent: 0, failed: 0, playersFound: teamPlayers.length, usersFound: 0, debug: "no telegram_id" };
    
    const fullMessage = `📢 СООБЩЕНИЕ КОМАНДЕ "${teamName}"\nОт: ${senderName}\n\n${message}`;
    
    let sent = 0, failed = 0, lastError = "";
    for (const user of users) {
      if (!user.telegram_id) continue;
      try {
        console.log("Sending to:", user.telegram_id);
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chat_id: user.telegram_id, 
            text: fullMessage,
            reply_markup: {
              inline_keyboard: [[
                { text: "📱 Открыть приложение", web_app: { url: "https://app.mtkcup.ru" } }
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


// Color scheme
const colors = {
  bg: "#FFFFFF",
  text: "#1A1A1A",
  gold: "#C9A227",
  goldLight: "#E8D5A3",
  goldDark: "#8B7355",
  gray: "#F5F5F5",
  grayBorder: "#E0E0E0",
};

// Position labels
const positionLabels = {
  setter: "Связующий",
  opposite: "Диагональный",
  outside: "Доигровщик",
  middle: "Центральный",
  libero: "Либеро",
};

// Role labels
const roleLabels = {
  fan: "Болельщик",
  player: "Игрок",
  captain: "Капитан",
  coach: "Тренер",
  admin: "Администратор",
  serviceman: "Сервисмен",
};

// Функция для вычисления всех ролей пользователя
const getUserRoles = (user, players, teams, roleRequests = []) => {
  if (!user) return { isGuest: true, isFan: false, isPlayer: false, isCaptain: false, isCoach: false, isAdmin: false, isServiceman: false, roles: [] };
  
  const isAdmin = user.role === "admin";
  const isServiceman = user.is_serviceman === true;
  const playerRecord = players?.find(p => p.user_id === user.id);
  const isPlayer = !!playerRecord;
  const isCaptain = playerRecord?.is_captain === true;
  
  // Тренер = назначен на команду ИЛИ имеет одобренную заявку на тренера
  const isCoachByTeam = teams?.some(t => t.coach_id === user.id) || false;
  const isCoachByRequest = roleRequests?.some(r => r.user_id === user.id && r.requested_role === "coach" && r.status === "approved") || false;
  const isCoach = isCoachByTeam || isCoachByRequest;
  
  const isFan = !isPlayer && !isCoach && !isAdmin && !isServiceman;
  
  const roles = [];
  if (isAdmin) roles.push("admin");
  if (isServiceman) roles.push("serviceman");
  if (isCoach) roles.push("coach");
  if (isCaptain) roles.push("captain");
  if (isPlayer) roles.push("player");
  if (isFan) roles.push("fan");
  
  return { isGuest: false, isFan, isPlayer, isCaptain, isCoach, isAdmin, isServiceman, roles, playerRecord };
};

const getDisplayName = (user) => {
  if (user?.first_name) return user.first_name;
  if (user?.username) return `@${user.username}`;
  return "Гость";
};

const syncAvatar = async (telegramId) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-avatar`, {
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

const tg = window.Telegram?.WebApp;

// Icons
const Icons = {
  Home: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ),
  Team: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Trophy: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 1012 0V2z"/>
    </svg>
  ),
  User: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Play: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  ),
  Back: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
  MapPin: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9,18 15,12 9,6"/>
    </svg>
  ),
  Mail: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  Check: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  X: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Send: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22,2 15,22 11,13 2,9"/>
    </svg>
  ),
  Heart: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  Settings: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Edit: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Save: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  ),
  Zap: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Video: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  Link: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
};

// Components
const Header = ({ title, showBack, onBack, rightElement }) => (
  <div style={{
    padding: "16px 20px", paddingTop: "50px",
    borderBottom: `1px solid ${colors.grayBorder}`,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: colors.bg,
    position: "sticky",
    top: 0,
    zIndex: 100,
  }}>
    {showBack && (
      <button onClick={onBack} style={{ background: "none", border: "none", padding: "4px", cursor: "pointer", color: colors.text }}>
        <Icons.Back />
      </button>
    )}
    <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 600, color: colors.text, flex: 1 }}>{title}</h1>
    {rightElement}
  </div>
);

const NavBar = ({ active, setScreen }) => {
  const items = [
    { id: "home", icon: Icons.Home, label: "Главная" },
    { id: "players", icon: Icons.Zap, label: "Игроки" },
    { id: "teams", icon: Icons.Team, label: "Команды" },
    { id: "schedule", icon: Icons.Calendar, label: "Матчи" },
    { id: "table", icon: Icons.Trophy, label: "Таблица" },
  ];

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: colors.bg,
      borderTop: `1px solid ${colors.grayBorder}`,
      display: "flex",
      justifyContent: "space-around",
      padding: "8px 0 20px",
      zIndex: 100,
    }}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => setScreen(item.id)}
          style={{
            background: "none",
            border: "none",
            padding: "8px 12px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            color: active === item.id ? colors.gold : colors.text,
            transition: "color 0.2s",
          }}
        >
          <item.icon />
          <span style={{ fontSize: "11px", fontWeight: 500 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

const Card = ({ children, onClick, style }) => (
  <div onClick={onClick} style={{
    background: colors.bg,
    border: `1px solid ${colors.grayBorder}`,
    borderRadius: "12px",
    padding: "16px",
    cursor: onClick ? "pointer" : "default",
    transition: "all 0.2s",
    ...style,
  }}>
    {children}
  </div>
);

const Button = ({ children, variant = "primary", onClick, style, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: "12px 24px",
    borderRadius: "8px",
    border: variant === "outline" ? `2px solid ${colors.gold}` : variant === "danger" ? `2px solid #dc2626` : "none",
    background: variant === "primary" ? colors.gold : variant === "success" ? "#16a34a" : variant === "danger" ? "transparent" : "transparent",
    color: variant === "primary" ? colors.bg : variant === "success" ? colors.bg : variant === "danger" ? "#dc2626" : colors.gold,
    fontWeight: 600,
    fontSize: "14px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    ...style,
  }}>
    {children}
  </button>
);

const Badge = ({ children, variant = "default" }) => {
  const styles = {
    default: { background: colors.gray, color: colors.text },
    gold: { background: colors.goldLight, color: colors.goldDark },
    live: { background: "#fee2e2", color: "#dc2626" },
    free: { background: "#dcfce7", color: "#16a34a" },
    pending: { background: "#fef3c7", color: "#d97706" },
    admin: { background: "#dbeafe", color: "#1d4ed8" },
    serviceman: { background: "#fef3c7", color: "#d97706" },
    captain: { background: "#f3e8ff", color: "#7c3aed" },
  };
  return (
    <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, ...styles[variant] }}>
      {children}
    </span>
  );
};

const RoleBadges = ({ roles }) => {
  const roleVariants = {
    admin: "admin",
    coach: "gold",
    captain: "captain",
    player: "free",
    fan: "default",
  };
  
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {roles.map(role => (
        <Badge key={role} variant={roleVariants[role]}>
          {roleLabels[role]}
        </Badge>
      ))}
    </div>
  );
};

const Container = ({ children }) => (
  <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 20px" }}>{children}</div>
);

const Avatar = ({ name, size = 48, url }) => {
  const [imgError, setImgError] = useState(false);
  const showImage = url && !imgError;
  return (
    <div style={{
      width: size,
      height: size,
      background: showImage ? "transparent" : colors.goldLight,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 600,
      fontSize: size * 0.4,
      color: colors.goldDark,
      overflow: "hidden",
    }}>
      {showImage ? (
        <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgError(true)} />
      ) : (
        name?.[0] === "@" ? name?.[1]?.toUpperCase() : name?.[0]?.toUpperCase()
      )}
    </div>
  );
};

const Loading = () => (
  <div style={{ 
    display: "flex", 
    flexDirection: "column",
    justifyContent: "center", 
    alignItems: "center", 
    minHeight: "100vh",
    padding: "40px", 
    color: colors.goldDark 
  }}>
    <img 
      src="/logo.jpg" 
      alt="Кубок МТК" 
      style={{ 
        width: "120px", 
        height: "120px", 
        borderRadius: "50%",
        marginBottom: "24px",
        objectFit: "cover"
      }} 
    />
    <div style={{ fontSize: "18px", fontWeight: 600 }}>Загрузка...</div>
  </div>
);

const Input = ({ label, value, onChange, type = "text", placeholder }) => (
  <div style={{ marginBottom: "12px" }}>
    {label && <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "6px" }}>{label}</label>}
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        border: `1px solid ${colors.grayBorder}`,
        fontSize: "14px",
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: "12px" }}>
    {label && <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "6px" }}>{label}</label>}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        border: `1px solid ${colors.grayBorder}`,
        fontSize: "14px",
        outline: "none",
        background: colors.bg,
        boxSizing: "border-box",
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// Screens
// Onboarding Screen - выбор роли при первом входе
const OnboardingScreen = ({ user, onComplete, onSubmitRequest, setRoleRequestData, setShowRoleRequestForm }) => {
  const [selectedRole, setSelectedRole] = useState("fan");
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => {
    if (selectedRole === "fan") {
      setLoading(true);
      await onComplete();
      setLoading(false);
    } else {
      // Для игрока/тренера открываем форму с именем/фамилией
      setRoleRequestData({ role: selectedRole, first_name: "", last_name: "", positions: [] });
      setShowRoleRequestForm(true);
    }
  };
  
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "20px" }}>
      <Container>
        <div style={{ paddingTop: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏐</div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>Добро пожаловать!</h1>
          <p style={{ color: colors.goldDark, marginBottom: "32px" }}>
            {user?.first_name || user?.username}, выберите вашу роль в турнире
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
            {[
              { id: "fan", icon: "👀", title: "Болельщик", desc: "Следить за матчами и командами" },
              { id: "player", icon: "🏃", title: "Игрок", desc: "Участвовать в турнире (требует одобрения)" },
              { id: "coach", icon: "📋", title: "Тренер", desc: "Управлять командой (требует одобрения)" },
            ].map(role => (
              <Card 
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                style={{ 
                  cursor: "pointer",
                  border: selectedRole === role.id ? `2px solid ${colors.gold}` : `1px solid ${colors.grayBorder}`,
                  background: selectedRole === role.id ? colors.goldLight : colors.bg,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ fontSize: "32px" }}>{role.icon}</div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: "16px" }}>{role.title}</div>
                    <div style={{ fontSize: "13px", color: colors.goldDark }}>{role.desc}</div>
                  </div>
                  {selectedRole === role.id && (
                    <div style={{ marginLeft: "auto", color: colors.gold, fontSize: "20px" }}>✓</div>
                  )}
                </div>
              </Card>
            ))}
          </div>
          
          {selectedRole !== "fan" && (
            <div style={{ background: colors.gray, padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", color: colors.goldDark }}>
              ℹ️ Заявка на роль "{selectedRole === "player" ? "Игрок" : "Тренер"}" будет отправлена администратору на одобрение
            </div>
          )}
          
          <Button onClick={handleSubmit} disabled={loading} style={{ width: "100%" }}>
            {loading ? "Отправка..." : selectedRole === "fan" ? "Продолжить" : "Отправить заявку"}
          </Button>
        </div>
      </Container>
    </div>
  );
};

const WelcomeScreen = ({ onLogin, onGuest, isTelegram }) => {
  // Автоматический вход при загрузке в Telegram
  useEffect(() => {
    if (isTelegram) {
      const timer = setTimeout(() => onLogin(), 500);
      return () => clearTimeout(timer);
    }
  }, [isTelegram, onLogin]);

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(180deg, ${colors.bg} 0%, ${colors.goldLight}22 100%)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      textAlign: "center",
    }}>
      <div style={{
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        marginBottom: "32px",
        boxShadow: `0 8px 32px ${colors.gold}44`,
        overflow: "hidden",
      }}>
        <img 
          src="/logo.jpg" 
          alt="Кубок МТК" 
          style={{ 
            width: "100%", 
            height: "100%", 
            objectFit: "cover" 
          }} 
        />
      </div>
      <h1 style={{ fontSize: "32px", fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>Кубок МТК</h1>
      
      {isTelegram ? (
        <>
          <p style={{ color: colors.goldDark, fontSize: "14px", margin: "0 0 24px", maxWidth: "280px", lineHeight: 1.5 }}>
            Команды, матчи, таблица, статистика, трансляции и уведомления
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: colors.goldDark }}>
            <div style={{ 
              width: "20px", 
              height: "20px", 
              border: `2px solid ${colors.gold}`,
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />
            <span style={{ fontSize: "14px" }}>Загрузка...</span>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      ) : (
        <>
          <p style={{ color: colors.goldDark, fontSize: "16px", margin: "0 0 48px", fontWeight: 500 }}>Волейбольная лига Амура</p>
          <Button onClick={onLogin} style={{ width: "100%", maxWidth: "280px", marginBottom: "12px" }}>Войти через Telegram</Button>
          <Button variant="outline" onClick={onGuest} style={{ width: "100%", maxWidth: "280px" }}>Смотреть как гость</Button>
        </>
      )}
    </div>
  );
};

const HomeScreen = ({ setScreen, user, teams, matches, players, pendingOffers, userRoles, setSelectedPlayer, setSelectedTeam, playerStats, tours, tournaments, activeTournamentId, setActiveTournamentId }) => {
  const liveMatch = matches.find(m => m.status === "live");
  const upcomingMatches = (matches || []).filter(m => m.status === "upcoming").slice(0, 2);
  
  // Находим ближайший тур по дате от сегодня (даже без матчей)
  const nextTour = (() => {
    const now = new Date();
    const today = new Date(now.toDateString());
    const futureTours = (tours || [])
      .filter(t => t.date && new Date(t.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return futureTours[0] || null;
  })();
  
  // Матчи для nextTour (если есть)
  const nextTourMatches = nextTour 
    ? (matches || []).filter(m => m.tour_id === nextTour.id && m.status === "upcoming").slice(0, 2)
    : [];
  // Сортируем игроков по эффективности (очки - ошибки по всем элементам)
  const playersWithStats = (players || []).map(player => {
    const stats = (playerStats || []).filter(s => s.player_id === player.id);
    const totalPoints = stats.reduce((sum, s) => {
      const serve = (s.aces || 0) - (s.serve_errors || 0);
      const receive = (s.receive_excellent || 0) - (s.receive_errors || 0);
      const attack = (s.attack_points || 0) - (s.attack_errors || 0);
      const block = (s.block_points || 0) - (s.block_errors || 0);
      return sum + serve + receive + attack + block;
    }, 0);
    return { ...player, totalPoints };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
  const topPlayers = playersWithStats.slice(0, 5);
  const displayName = getDisplayName(user);

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title={tournaments?.find(t => t.id === activeTournamentId)?.name || "Кубок МТК"} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {tournaments?.length > 1 && (
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "16px", paddingBottom: "4px" }}>
              {tournaments.filter(t => t.is_active).map(t => (
                <div key={t.id} onClick={() => setActiveTournamentId(t.id)} style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  background: t.id === activeTournamentId ? colors.gold : colors.gray,
                  color: t.id === activeTournamentId ? "#fff" : colors.text,
                  border: t.id === activeTournamentId ? "none" : `1px solid ${colors.grayBorder}`,
                }}>
                  {t.name}
                </div>
              ))}
            </div>
          )}
          <Card onClick={() => setScreen("profile")} style={{
            background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
            color: colors.bg,
            marginBottom: "20px",
            border: "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Avatar name={displayName} size={56} url={user?.avatar_url} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 4px", opacity: 0.9, fontSize: "14px" }}>Добро пожаловать,</p>
                <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 700 }}>{displayName}</h2>
                <RoleBadges roles={userRoles.roles} />
              </div>
              <div style={{ opacity: 0.8 }}><Icons.ChevronRight /></div>
            </div>
          </Card>

          {userRoles.isAdmin && (
            <Card onClick={() => setScreen("admin")} style={{ background: "#dbeafe", border: "2px solid #3b82f6", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: "#3b82f6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                  <Icons.Settings />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#1e40af" }}>Админ-панель</div>
                  <div style={{ fontSize: "13px", color: "#3b82f6" }}>Управление турниром</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          {pendingOffers.length > 0 && (
            <Card onClick={() => setScreen("offers")} style={{ background: "#fef3c7", border: "2px solid #d97706", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: "#d97706", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                  <Icons.Mail />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#92400e" }}>{pendingOffers.length} новых приглашений</div>
                  <div style={{ fontSize: "13px", color: "#a16207" }}>Команды хотят видеть вас в составе</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {[
              { label: "Прогнозы", icon: "🎯", screen: "predictions" },
              { label: "Моя команда", icon: "💛", screen: "myteam" },
              { label: "Команды", icon: "👥", screen: "teams", count: filteredTeams.length },
              { label: "Игроки", icon: "⚡", screen: "players" },
            ].map(item => (
              <Card key={item.screen} onClick={() => setScreen(item.screen)} style={{ textAlign: "center", padding: "20px" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>{item.icon}</div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{item.label}</div>
                {item.count && <div style={{ fontSize: "12px", color: colors.goldDark, marginTop: "4px" }}>{item.count} команд</div>}
              </Card>
            ))}
          </div>

          {liveMatch && (
            <>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", background: "#dc2626", borderRadius: "50%", animation: "pulse 2s infinite" }}/>
                Сейчас играют
              </h3>
              <Card style={{ marginBottom: "24px" }}>
                <MatchCard match={liveMatch} teams={teams} />
                {liveMatch.stream_url && (
                  <Button onClick={() => window.open(liveMatch.stream_url, '_blank')} style={{ width: "100%", marginTop: "16px" }}>
                    <Icons.Play /> Смотреть трансляцию
                  </Button>
                )}
              </Card>
            </>
          )}

          {nextTour && (
            <>
              {nextTour && (
                <div style={{ 
                  background: colors.gold, 
                  color: colors.bg, 
                  padding: "12px 16px", 
                  borderRadius: "12px", 
                  marginBottom: "16px" 
                }}>
                  <div style={{ fontSize: "18px", fontWeight: 700 }}>
                    {nextTour.name || `Тур ${nextTour.number}`}
                  </div>
                  {nextTour.date && (
                    <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icons.Calendar />{new Date(nextTour.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                    </div>
                  )}
                  {nextTour.location && (
                    <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icons.MapPin />{nextTour.location}{nextTour.address ? `, ${nextTour.address}` : ""}
                    </div>
                  )}
                </div>
              )}
              {nextTourMatches.length > 0 ? nextTourMatches.map(match => (
                <Card key={match.id} style={{ marginBottom: "12px" }}>
                  <MatchCard match={match} teams={teams} onTeamClick={(team) => { setSelectedTeam(team); setScreen("teamDetail"); }} />
                </Card>
              )) : (
                <Card style={{ marginBottom: "12px", textAlign: "center", color: colors.goldDark, padding: "20px" }}>
                  Матчи скоро будут добавлены
                </Card>
              )}
              <Button variant="outline" onClick={() => setScreen("schedule")} style={{ width: "100%", marginTop: "8px" }}>Всё расписание</Button>
            </>
          )}

          {topPlayers.length > 0 && (
            <>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "24px 0 12px" }}>Игроки</h3>
              {topPlayers.map(player => (
                <Card key={player.id} onClick={() => { setSelectedPlayer(player); setScreen("playerDetail"); }} style={{ marginBottom: "8px", padding: "12px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Avatar name={player.users?.first_name || player.users?.username} size={40} url={player.users?.avatar_url} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}</div>
                      <div style={{ fontSize: "12px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ")} • {player.teams?.name || "Без команды"}</div>
                    </div>
                    {player.totalPoints !== 0 && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: colors.gold }}>{player.totalPoints}</div>
                        <div style={{ fontSize: "10px", color: colors.goldDark }}>эфф.</div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
              <Button variant="outline" onClick={() => setScreen("players")} style={{ width: "100%", marginTop: "8px" }}>Все игроки</Button>
            </>
          )}
        </div>
      </Container>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
};

const MatchCard = ({ match, teams, onTeamClick }) => {
  const team1 = teams.find(t => t.id === match.team1_id);
  const team2 = teams.find(t => t.id === match.team2_id);
  // Извлекаем время напрямую из строки без конвертации часовых поясов
  const timeString = match.scheduled_time ? match.scheduled_time.substring(11, 16) : "00:00";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "13px", color: colors.goldDark, display: "flex", alignItems: "center", gap: "4px" }}>
          <Icons.Clock />{timeString}
        </span>
        {match.status === "live" && <Badge variant="live">● LIVE</Badge>}
        {match.status === "finished" && <Badge>Завершён</Badge>}
        {match.status === "upcoming" && <Badge variant="gold">Скоро</Badge>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div 
          style={{ textAlign: "center", flex: 1, cursor: onTeamClick ? "pointer" : "default" }}
          onClick={() => onTeamClick && team1 && onTeamClick(team1)}
        >
      <div style={{ width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px", margin: "0 auto 4px auto" }}>
          {team1?.logo_url && team1.logo_url.startsWith('http') ? (
            <img src={team1.logo_url} alt={team1.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px" }} />
          ) : (
            <span style={{ fontSize: "28px" }}>{team1?.logo_url || "🏐"}</span>
          )}
        </div>
          <div style={{ fontWeight: 600, fontSize: "14px" }}>{team1?.name || "—"}</div>
        </div>
        <div style={{ padding: "8px 16px", background: colors.gray, borderRadius: "8px", fontWeight: 700, fontSize: "20px", minWidth: "80px", textAlign: "center" }}>
          {match.status === "upcoming" ? "—" : `${match.sets_team1 || 0} : ${match.sets_team2 || 0}`}
        </div>
        <div 
          style={{ textAlign: "center", flex: 1, cursor: onTeamClick ? "pointer" : "default" }}
          onClick={() => onTeamClick && team2 && onTeamClick(team2)}
        >
      <div style={{ width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px auto" }}>          {team2?.logo_url && team2.logo_url.startsWith('http') ? (
            <img src={team2.logo_url} alt={team2.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px" }} />
          ) : (
            <span style={{ fontSize: "28px" }}>{team2?.logo_url || "🏐"}</span>
          )}
        </div>
          <div style={{ fontWeight: 600, fontSize: "14px" }}>{team2?.name || "—"}</div>
        </div>
      </div>
      {match.set_scores && match.status !== "upcoming" && (() => {
        try {
          const scores = typeof match.set_scores === 'string' ? JSON.parse(match.set_scores) : match.set_scores;
          if (scores && scores.length > 0) {
            return (
              <div style={{ fontSize: "11px", color: colors.goldDark, textAlign: "center", marginTop: "8px" }}>
                {scores.map((s, i) => `${s.team1}:${s.team2}`).join(" | ")}
              </div>
            );
          }
        } catch (e) {}
        return null;
      })()}
    </div>
  );
};

const TeamsScreen = ({ setScreen, teams, players, setSelectedTeam, user, myTeamId }) => {
  // Сортируем: моя команда / любимая команда вверху
  const sortedTeams = [...teams].sort((a, b) => {
    const aIsMy = a.id === myTeamId || a.id === user?.favorite_team_id;
    const bIsMy = b.id === myTeamId || b.id === user?.favorite_team_id;
    if (aIsMy && !bIsMy) return -1;
    if (!aIsMy && bIsMy) return 1;
    return (b.points || 0) - (a.points || 0);
  });
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Команды" showBack onBack={() => setScreen("home")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <p style={{ color: colors.goldDark, marginBottom: "16px" }}>{teams.length} команд в турнире</p>
          {sortedTeams.map((team, idx) => {
            const isMy = team.id === myTeamId || team.id === user?.favorite_team_id;
            return (
              <Card key={team.id} onClick={() => { setSelectedTeam(team); setScreen("teamDetail"); }} style={{ marginBottom: "12px", border: isMy ? `2px solid ${colors.gold}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "56px", height: "56px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", overflow: "hidden" }}>
                  {team.logo_url && team.logo_url.startsWith('http') ? (
                    <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    team.logo_url || "🏐"
                  )}
                </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600 }}>
                      {team.name} {isMy && <span style={{ fontSize: "12px", color: colors.gold }}>★</span>}
                    </h3>
                    <p style={{ margin: 0, fontSize: "13px", color: colors.goldDark }}>{team.wins}В {team.losses}П • {team.points} очков • {(() => { const teamPlayers = (players || []).filter(p => p.team_id === team.id); const hasCoachInPlayers = teamPlayers.some(p => p.user_id === team.coach_id); const coachExtra = team.coach_id && !hasCoachInPlayers ? 1 : 0; return teamPlayers.length + coachExtra; })()} игр.</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: colors.gold }}>#{teams.sort((a,b) => (b.points||0)-(a.points||0)).indexOf(team) + 1}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Container>
    </div>
  );
}

const TeamDetailScreen = ({ setScreen, goBack, team, players, users, setSelectedPlayer, user, onSelectFavoriteTeam, userRoles, currentPlayer, onLeaveTeam, onSendTeamRequest, teamRequests, actionLoading }) => {
  const teamPlayers = (players || []).filter(p => p.team_id === team?.id);
  const isMyTeam = currentPlayer && currentPlayer.team_id === team?.id;
  const isFreeAgent = currentPlayer && currentPlayer.is_free_agent;
  const hasPendingRequest = teamRequests?.some(r => r.team_id === team?.id && r.player_id === currentPlayer?.id && r.status === "pending");
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header 
        title={team?.name || "Команда"} 
        showBack 
        onBack={() => goBack("teams")} 
        rightElement={
          isMyTeam && onLeaveTeam ? (
            <button onClick={onLeaveTeam} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "13px", cursor: "pointer" }}>Покинуть</button>
          ) : isFreeAgent && onSendTeamRequest && !hasPendingRequest ? (
            <button onClick={() => onSendTeamRequest(team?.id)} disabled={actionLoading} style={{ background: "none", border: "none", color: "#16a34a", fontSize: "13px", cursor: "pointer" }}>Подать заявку</button>
          ) : isFreeAgent && hasPendingRequest ? (
            <span style={{ color: "#d97706", fontSize: "13px" }}>Заявка отправлена</span>
          ) : null
        }
      />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ width: "80px", height: "80px", background: colors.goldLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "40px", overflow: "hidden" }}>
              {team?.logo_url && team.logo_url.startsWith('http') ? (
                <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                team?.logo_url || "🏐"
              )}
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 700 }}>{team?.name}</h2>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge>{team?.games_played || 0} игр</Badge>
              <Badge variant="gold">{team?.points || 0} очков</Badge>
            </div>
            {userRoles?.isFan && user?.favorite_team_id === team?.id && (
              <div style={{ marginTop: "16px" }}><Badge variant="gold">💛 Любимая команда</Badge></div>
            )}
            {userRoles?.isFan && user?.favorite_team_id !== team?.id && onSelectFavoriteTeam && (
              <Button 
                variant="outline" 
                onClick={() => onSelectFavoriteTeam(team?.id)} 
                style={{ marginTop: "12px", width: "100%" }}
              >
                💛 Сделать любимой
              </Button>
            )}
          </Card>

          <Card style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>СТАТИСТИКА</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center" }}>
              <div><div style={{ fontSize: "24px", fontWeight: 700, color: "#16a34a" }}>{team?.wins || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Побед</div></div>
              <div><div style={{ fontSize: "24px", fontWeight: 700, color: "#dc2626" }}>{team?.losses || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Поражений</div></div>
              <div><div style={{ fontSize: "24px", fontWeight: 700 }}>{team?.sets_won || 0}:{team?.sets_lost || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Партии</div></div>
            </div>
          </Card>


          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Состав команды ({(() => {
            // Считаем уникальных членов команды
            const coachIsPlayer = team?.coach_id && teamPlayers.some(p => p.user_id === team.coach_id);
            const coachCount = team?.coach_id && !coachIsPlayer ? 1 : 0;
            return teamPlayers.length + coachCount;
          })()})</h3>          
          {/* Тренер как первый элемент состава */}
          {team?.coach_id && (() => {
            const coach = users?.find(u => u.id === team.coach_id);
            if (!coach) return null;
            
            // Ищем тренера среди ВСЕХ игроков (он может играть в другой команде)
            const coachPlayer = players?.find(p => p.user_id === coach.id);
            
            return (
              <Card 
                key={`coach-${coach.id}`}
                style={{ 
                  marginBottom: "8px", 
                  padding: "12px 16px", 
                  cursor: coachPlayer ? "pointer" : "default",
                  background: "#fffbeb" 
                }}
                onClick={() => {
                  if (coachPlayer && setSelectedPlayer && setScreen) {
                    setSelectedPlayer(coachPlayer);
                    setScreen("playerDetail");
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Avatar name={coach.first_name || coach.username} size={40} url={coach.avatar_url} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>
                      {coach.first_name || `@${coach.username}`} {coach.last_name || ""}
                      {coachPlayer?.is_captain && <span style={{ marginLeft: "8px", color: colors.gold }}>©</span>}
                    </div>
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>
                      <span style={{ fontWeight: 600, color: colors.gold }}>Тренер</span>
                      {coachPlayer?.positions?.length > 0 && <span> • {coachPlayer.positions.map(p => positionLabels[p] || p).join(", ")}</span>}
                    </div>
                  </div>
                  {coachPlayer?.jersey_number && <div style={{ fontSize: "18px", fontWeight: 700, color: colors.gold }}>#{coachPlayer.jersey_number}</div>}
                  {coachPlayer && <Icons.ChevronRight />}
                </div>
              </Card>
            );
          })()}
          
          {teamPlayers.length > 0 ? [...teamPlayers]
            .sort((a, b) => { const numA = parseInt(a.jersey_number) || 9999; const numB = parseInt(b.jersey_number) || 9999; return numA - numB; })
            .filter(player => player.user_id !== team?.coach_id) // Убираем тренера - он уже показан выше
            .map(player => (
            <Card 
              key={player.id} 
              style={{ marginBottom: "8px", padding: "12px 16px", cursor: "pointer" }}
              onClick={() => { setSelectedPlayer && setSelectedPlayer(player); setScreen && setScreen("playerDetail"); }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar name={player.users?.first_name || player.users?.username} size={40} url={player.users?.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>
                    {player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}
                    {player.is_captain && <span style={{ marginLeft: "8px", color: colors.gold }}>©</span>}
                  </div>
                  <div style={{ fontSize: "12px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</div>
                </div>
                {player.jersey_number && <div style={{ fontSize: "18px", fontWeight: 700, color: colors.gold }}>#{player.jersey_number}</div>}
                <Icons.ChevronRight />
              </div>
            </Card>
          )) : (
            <Card style={{ textAlign: "center", color: colors.goldDark }}>Состав пока не заполнен</Card>
          )}
        </div>
      </Container>
    </div>
  );
};


// Экран прогнозов
const PredictionsScreen = ({ matches, teams, tours, sponsors, prizes, predictions, user, onMakePrediction, users }) => {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [prediction, setPrediction] = useState({ team1: 3, team2: 0 });
  const [expandedTours, setExpandedTours] = useState({});
  const [expandedSponsor, setExpandedSponsor] = useState(null);
  
  // Сортируем туры: ближайший первый
  const now = new Date();
  const sortedTours = [...(tours || [])].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const isPastA = dateA < today;
    const isPastB = dateB < today;
    
    // Будущие/сегодняшние туры сначала (по возрастанию даты)
    // Потом прошедшие туры (по убыванию даты - недавние выше)
    if (!isPastA && !isPastB) return dateA - dateB; // оба будущие - ближайший первый
    if (isPastA && isPastB) return dateB - dateA; // оба прошедшие - недавний первый
    if (!isPastA) return -1; // A будущий, B прошедший - A первый
    return 1; // A прошедший, B будущий - B первый
  });
  
  // Текущий тур = сегодняшний или ближайший будущий
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentTour = sortedTours.find(t => new Date(t.date) >= today) || sortedTours[0];
  
  // Мои прогнозы
  const myPredictions = (predictions || []).filter(p => p.user_id === user?.id);
  
  // Активные спонсоры
  const activeSponsors = (sponsors || []).filter(s => s.is_active !== false);
  
  // Функция получения лидеров по туру
  const getTourLeaderboard = (tourId) => {
    const tourMatches = (matches || []).filter(m => m.tour_id === tourId).map(m => m.id);
    if (tourMatches.length === 0) return [];
    const scores = {};
    (predictions || []).filter(p => tourMatches.includes(p.match_id)).forEach(p => {
      if (!scores[p.user_id]) scores[p.user_id] = { points: 0, count: 0 };
      scores[p.user_id].points += p.points_earned || 0;
      scores[p.user_id].count += 1;
    });
    return Object.entries(scores)
      .map(([id, data]) => ({ user: (users || []).find(u => u.id === id), points: data.points, count: data.count }))
      .filter(x => x.user)
      .sort((a, b) => b.points - a.points || b.count - a.count)
      .slice(0, 10);
  };
  
  // Функция получения призов по туру
  const getTourPrizes = (tourId) => (prizes || []).filter(p => p.is_active !== false && p.tour_id === tourId);
  
  // Призы за сезон
  const seasonPrizes = (prizes || []).filter(p => p.is_active !== false && !p.tour_id);
  
  // Таблица лидеров за СЕЗОН
  const seasonLeaderboard = (() => {
    const scores = {};
    (predictions || []).forEach(p => {
      if (!scores[p.user_id]) scores[p.user_id] = { points: 0, count: 0 };
      scores[p.user_id].points += p.points_earned || 0;
      scores[p.user_id].count += 1;
    });
    return Object.entries(scores)
      .map(([id, data]) => ({ user: (users || []).find(u => u.id === id), points: data.points, count: data.count }))
      .filter(x => x.user)
      .sort((a, b) => b.points - a.points || b.count - a.count)
      .slice(0, 10);
  })();
  
  // Ближайшие матчи для прогнозов
  const upcomingMatches = (matches || [])
    .filter(m => m.status === "upcoming")
    .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
  
  const handleSubmitPrediction = async () => {
    if (!selectedMatch || !user) return;
    await onMakePrediction(selectedMatch.id, prediction.team1, prediction.team2);
    setSelectedMatch(null);
    setPrediction({ team1: 3, team2: 0 });
  };
  
  const getPrediction = (matchId) => myPredictions.find(p => p.match_id === matchId);
  
  const toggleTour = (tourId) => setExpandedTours(prev => ({ ...prev, [tourId]: !prev[tourId] }));
  
  // Инициализируем текущий тур как развёрнутый
  const isExpanded = (tourId) => expandedTours[tourId] !== undefined ? expandedTours[tourId] : (tourId === currentTour?.id);
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Прогнозы" />
      <Container>
        {/* Условия */}
        <Card style={{ marginBottom: "16px", background: "linear-gradient(135deg, " + colors.gold + " 0%, " + colors.goldDark + " 100%)", color: "white" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 10px" }}>🎯 Как набрать очки</h3>
          <div style={{ fontSize: "13px", lineHeight: 1.6 }}>
            <div>• <b>+3 очка</b> за точный счёт</div>
            <div>• <b>+1 очко</b> за угаданного победителя</div>
            <div style={{ marginTop: "8px", opacity: 0.9, fontSize: "12px" }}>Приз получают только зрители в зале</div>
          </div>
        </Card>
        
        {/* Форма прогноза */}
        {selectedMatch && (
          <Card style={{ marginBottom: "16px", border: "2px solid " + colors.gold }}>
            <h4 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 16px", textAlign: "center" }}>Ваш прогноз</h4>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>{teams.find(t => t.id === selectedMatch.team1_id)?.name}</div>
                <select value={prediction.team1} onChange={e => setPrediction(p => ({ ...p, team1: parseInt(e.target.value) }))}
                  style={{ width: "60px", padding: "12px", fontSize: "20px", fontWeight: 700, textAlign: "center", border: "2px solid " + colors.gold, borderRadius: "8px" }}>
                  {[0,1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>:</div>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>{teams.find(t => t.id === selectedMatch.team2_id)?.name}</div>
                <select value={prediction.team2} onChange={e => setPrediction(p => ({ ...p, team2: parseInt(e.target.value) }))}
                  style={{ width: "60px", padding: "12px", fontSize: "20px", fontWeight: 700, textAlign: "center", border: "2px solid " + colors.gold, borderRadius: "8px" }}>
                  {[0,1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            {(prediction.team1 !== 3 && prediction.team2 !== 3) && (
              <p style={{ color: "#dc2626", fontSize: "12px", textAlign: "center", marginTop: "8px" }}>Одна из команд должна набрать 3 сета</p>
            )}
            <div style={{ display: "flex", gap: "6px", marginTop: "16px" }}>
              <Button onClick={handleSubmitPrediction} disabled={prediction.team1 !== 3 && prediction.team2 !== 3} style={{ flex: 1 }}>Отправить</Button>
              <Button variant="outline" onClick={() => setSelectedMatch(null)}>Отмена</Button>
            </div>
          </Card>
        )}
        
        {/* Ближайшие матчи */}
        {upcomingMatches.length > 0 && (
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 12px" }}>⏰ Сделать прогноз</h3>
            {upcomingMatches.slice(0, 4).map(match => {
              const team1 = teams.find(t => t.id === match.team1_id);
              const team2 = teams.find(t => t.id === match.team2_id);
              const myPred = getPrediction(match.id);
              const matchTime = match.scheduled_time?.substring(11, 16) || "";
              return (
                <Card key={match.id} style={{ marginBottom: "8px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{team1?.name} vs {team2?.name}</div>
                      <div style={{ fontSize: "11px", color: colors.goldDark }}>{matchTime && ("⏰ " + matchTime)}</div>
                    </div>
                    {myPred ? (
                      <div style={{ textAlign: "center", padding: "6px 10px", background: colors.goldLight, borderRadius: "6px" }}>
                        <div style={{ fontSize: "10px", color: colors.goldDark }}>Прогноз</div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: colors.gold }}>{myPred.predicted_score_team1}:{myPred.predicted_score_team2}</div>
                      </div>
                    ) : user ? (
                      <Button onClick={() => setSelectedMatch(match)} style={{ padding: "6px 12px", fontSize: "12px" }}>Прогноз</Button>
                    ) : (
                      <Badge variant="default">Войдите</Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        
        {/* Туры - спойлеры */}
        <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "20px 0 12px" }}>📊 Результаты по турам</h3>
        {sortedTours.map((tour, index) => {
          const expanded = isExpanded(tour.id);
          const isCurrent = tour.id === currentTour?.id;
          const tourPrizes = getTourPrizes(tour.id);
          const tourLeaderboard = getTourLeaderboard(tour.id);
          const tourSponsors = [...new Map(tourPrizes.map(p => activeSponsors.find(s => s.id === p.sponsor_id)).filter(Boolean).map(s => [s.id, s])).values()];
          
          return (
            <Card key={tour.id} style={{ marginBottom: "12px", overflow: "hidden" }}>
              <div onClick={() => toggleTour(tour.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "4px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>{isCurrent ? "🏆" : "📋"}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "15px" }}>Тур {tour.number} {isCurrent && <Badge>текущий</Badge>}</div>
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>{tour.date ? new Date(tour.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : ""}</div>
                  </div>
                </div>
                <span style={{ fontSize: "20px", color: colors.goldDark, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
              </div>
              
              {expanded && (
                <div style={{ marginTop: "16px", borderTop: "1px solid " + colors.grayBorder, paddingTop: "16px" }}>
                  {/* Спонсоры тура */}
                  {tourSponsors.length > 0 && (
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "12px", color: colors.goldDark, marginBottom: "8px", fontWeight: 600 }}>Спонсоры:</div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {tourSponsors.map(s => (
                          <div key={s.id} onClick={(e) => { e.stopPropagation(); setExpandedSponsor(expandedSponsor === s.id ? null : s.id); }}
                            style={{ display: "flex", alignItems: "center", gap: "6px", background: colors.goldLight, padding: "6px 10px", borderRadius: "8px", cursor: "pointer", border: expandedSponsor === s.id ? "2px solid " + colors.gold : "2px solid transparent" }}>
                            {s.logo_url && <img src={s.logo_url} alt="" style={{ width: 24, height: 24, borderRadius: "4px", objectFit: "cover" }} />}
                            <span style={{ fontSize: "12px", fontWeight: 600 }}>{s.name}</span>
                          </div>
                        ))}
                      </div>
                      {expandedSponsor && tourSponsors.find(s => s.id === expandedSponsor) && (() => {
                        const s = tourSponsors.find(sp => sp.id === expandedSponsor);
                        return (
                          <div style={{ marginTop: "12px", padding: "12px", background: colors.gray, borderRadius: "8px" }}>
                            <div style={{ fontWeight: 600, marginBottom: "4px" }}>{s.name}</div>
                            {s.description && <div style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "8px" }}>{s.description}</div>}
                            {s.website_url && <a href={s.website_url} target="_blank" rel="noreferrer" style={{ fontSize: "13px", color: colors.gold }}>🔗 {s.website_url}</a>}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  
                  {/* Призы тура */}
                  {tourPrizes.length > 0 && (
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "12px", color: colors.goldDark, marginBottom: "8px", fontWeight: 600 }}>Призы:</div>
                      {tourPrizes.map(p => {
                        const sponsor = activeSponsors.find(s => s.id === p.sponsor_id);
                        return (
                          <div key={p.id} style={{ background: colors.goldLight, padding: "10px 12px", borderRadius: "8px", marginBottom: "8px" }}>
                            <div style={{ fontWeight: 600, fontSize: "14px" }}>🏆 {p.title} <span style={{ fontWeight: 400, color: colors.goldDark }}>({p.place === 10 ? "топ-10" : p.place + " место"})</span></div>
                            {p.description && <div style={{ fontSize: "12px", color: colors.goldDark, marginTop: "4px" }}>{p.description}</div>}
                            {sponsor && <div style={{ fontSize: "11px", color: colors.gold, marginTop: "4px" }}>от {sponsor.name}</div>}
                            {p.link_url && <a href={p.link_url} target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: colors.gold, display: "block", marginTop: "4px" }}>🔗 Подробнее</a>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Мои прогнозы по туру */}
                  {user && (() => {
                    const tourMatchesList = (matches || []).filter(m => m.tour_id === tour.id);
                    const myTourPreds = tourMatchesList.map(m => {
                      const pred = getPrediction(m.id);
                      if (!pred) return null;
                      const team1 = teams.find(t => t.id === m.team1_id);
                      const team2 = teams.find(t => t.id === m.team2_id);
                      const isFinished = m.status === "finished";
                      let points = 0;
                      if (isFinished && m.sets_team1 !== null && m.sets_team2 !== null) {
                        const exactMatch = pred.predicted_score_team1 === m.sets_team1 && pred.predicted_score_team2 === m.sets_team2;
                        const winnerMatch = (pred.predicted_score_team1 > pred.predicted_score_team2) === (m.sets_team1 > m.sets_team2);
                        if (exactMatch) points = 3;
                        else if (winnerMatch) points = 1;
                      }
                      return { match: m, pred, team1, team2, points, isFinished };
                    }).filter(Boolean);
                    
                    if (myTourPreds.length === 0) return null;
                    
                    const totalPoints = myTourPreds.reduce((sum, p) => sum + p.points, 0);
                    
                    return (
                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ fontSize: "12px", color: colors.goldDark, marginBottom: "8px", fontWeight: 600 }}>
                          Мои прогнозы: <span style={{ color: colors.gold }}>{totalPoints} очков</span>
                        </div>
                        {myTourPreds.map(({ match: m, pred, team1, team2, points, isFinished }) => (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px", background: points === 3 ? "#dcfce7" : points === 1 ? "#fef3c7" : isFinished ? "#fee2e2" : colors.gray, borderRadius: "6px", marginBottom: "4px", fontSize: "12px" }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 500 }}>{team1?.name}</span> vs <span style={{ fontWeight: 500 }}>{team2?.name}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ fontWeight: 600 }}>{pred.predicted_score_team1}:{pred.predicted_score_team2}</div>
                              {isFinished && (
                                <>
                                  <div style={{ color: colors.goldDark }}>→ {m.sets_team1}:{m.sets_team2}</div>
                                  <div style={{ fontWeight: 700, color: points === 3 ? "#16a34a" : points === 1 ? "#ca8a04" : "#dc2626" }}>
                                    {points === 3 ? "+3" : points === 1 ? "+1" : "0"}
                                  </div>
                                </>
                              )}
                              {!isFinished && <div style={{ color: colors.goldDark }}>⏳</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  
                  {/* Лидеры тура */}
                  <div>
                    <div style={{ fontSize: "12px", color: colors.goldDark, marginBottom: "8px", fontWeight: 600 }}>Лидеры:</div>
                    {tourLeaderboard.length === 0 ? (
                      <div style={{ fontSize: "13px", color: colors.goldDark }}>Пока нет прогнозов</div>
                    ) : (
                      tourLeaderboard.slice(0, 5).map((item, i) => (
                        <div key={item.user.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px", background: i < 3 ? "rgba(201, 162, 39, 0.1)" : "transparent", borderRadius: "8px", marginBottom: "4px" }}>
                          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : colors.gray, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "11px", color: i < 3 ? "white" : colors.text }}>{i + 1}</div>
                          <Avatar name={item.user.first_name || item.user.username} size={28} url={item.user.avatar_url} />
                          <div style={{ flex: 1, fontSize: "13px", fontWeight: 500 }}>{item.user.first_name || item.user.username}</div>
                          <div style={{ fontWeight: 600, fontSize: "13px", color: colors.gold }}>{item.points}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        
        {/* Призы за сезон */}
        {seasonPrizes.length > 0 && (
          <Card style={{ marginBottom: "16px", background: colors.goldLight }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px" }}>🎁 Призы за сезон</h4>
            {seasonPrizes.map(p => {
              const sponsor = activeSponsors.find(s => s.id === p.sponsor_id);
              return (
                <div key={p.id} style={{ background: "white", padding: "10px 12px", borderRadius: "8px", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>🏆 {p.title} <span style={{ fontWeight: 400, color: colors.goldDark }}>({p.place === 10 ? "топ-10" : p.place + " место"})</span></div>
                  {p.description && <div style={{ fontSize: "12px", color: colors.goldDark, marginTop: "4px" }}>{p.description}</div>}
                  {sponsor && <div style={{ fontSize: "11px", color: colors.gold, marginTop: "4px" }}>от {sponsor.name}</div>}
                </div>
              );
            })}
          </Card>
        )}
        
        {/* Рейтинг сезона */}
        <Card>
          <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px" }}>📈 Рейтинг сезона</h4>
          {seasonLeaderboard.length === 0 ? (
            <div style={{ fontSize: "13px", color: colors.goldDark }}>Пока нет результатов</div>
          ) : (
            seasonLeaderboard.map((item, i) => (
              <div key={item.user.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: i < seasonLeaderboard.length - 1 ? "1px solid " + colors.grayBorder : "none" }}>
                <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : colors.gray, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "11px", color: i < 3 ? "white" : colors.text }}>{i + 1}</div>
                <Avatar name={item.user.first_name || item.user.username} size={32} url={item.user.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{item.user.first_name || item.user.username} {item.user.last_name || ""}</div>
                  <div style={{ fontSize: "11px", color: colors.goldDark }}>{item.count} прогноз(ов)</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: "16px", color: colors.gold }}>{item.points}</div>
              </div>
            ))
          )}
        </Card>
      </Container>
    </div>
  );
};
const ScheduleScreen = ({ matches, teams, tours, isGuest, setSelectedTeam, setScreen, goBack, tournaments, activeTournamentId, setActiveTournamentId }) => {
  const today = new Date();
  const filteredTours = activeTournamentId ? tours.filter(t => t.tournament_id === activeTournamentId) : tours;
  const sortedTours = [...filteredTours].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const aIsUpcoming = dateA >= today;
    const bIsUpcoming = dateB >= today;
    
    if (aIsUpcoming && !bIsUpcoming) return -1;
    if (!aIsUpcoming && bIsUpcoming) return 1;
    if (aIsUpcoming && bIsUpcoming) return dateA - dateB;
    return dateB - dateA;
  });

  const matchesByTour = sortedTours.map(tour => ({
    tour,
    matches: (matches || [])
      .filter(m => m.tour_id === tour.id)
      .sort((a, b) => {
        // Сравниваем строки времени напрямую (формат ISO: "2025-12-28T13:00")
        if (!a.scheduled_time) return 1;
        if (!b.scheduled_time) return -1;
        return a.scheduled_time.localeCompare(b.scheduled_time);
      }),
  }));

  const handleTeamClick = (team) => {
    setSelectedTeam(team);
    setScreen("teamDetail");
  };

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Расписание" />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {tournaments?.length > 1 && (
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "16px", paddingBottom: "4px" }}>
              {tournaments.filter(t => t.is_active).map(t => (
                <div key={t.id} onClick={() => setActiveTournamentId(t.id)} style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  background: t.id === activeTournamentId ? colors.gold : colors.gray,
                  color: t.id === activeTournamentId ? "#fff" : colors.text,
                  border: t.id === activeTournamentId ? "none" : `1px solid ${colors.grayBorder}`,
                }}>
                  {t.name}
                </div>
              ))}
            </div>
          )}
          {matchesByTour.map(({ tour, matches: tourMatches }) => {
            const tourDate = new Date(tour.date);
            const isPast = tourDate < today;
            
            return (
              <div key={tour.id} style={{ marginBottom: "32px", opacity: isPast ? 0.7 : 1 }}>
                <div style={{ 
                  background: isPast ? colors.gray : colors.gold, 
                  color: isPast ? colors.text : colors.bg, 
                  padding: "12px 16px", 
                  borderRadius: "12px", 
                  marginBottom: "16px" 
                }}>
                  <div style={{ fontSize: "18px", fontWeight: 700 }}>
                    {tour.name || `Тур ${tour.number}`}
                    {isPast && <span style={{ fontSize: "12px", fontWeight: 400, marginLeft: "8px" }}>(завершён)</span>}
                  </div>
                  <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icons.Calendar />{new Date(tour.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                  </div>
                  <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icons.MapPin />{tour.location}, {tour.address}
                  </div>
                </div>
                {tourMatches.map(match => (
                  <Card key={match.id} style={{ marginBottom: "12px" }}>
                    <MatchCard match={match} teams={teams} onTeamClick={handleTeamClick} />
                    {match.status === "live" && match.stream_url && (
                      <Button onClick={() => window.open(match.stream_url, '_blank')} style={{ width: "100%", marginTop: "12px" }}>
                        <Icons.Play /> Трансляция
                      </Button>
                    )}
                    {match.status === "finished" && !isGuest && match.video_url && (
                      <Button variant="outline" onClick={() => window.open(match.video_url, '_blank')} style={{ width: "100%", marginTop: "12px" }}>
                        <Icons.Play /> Смотреть запись
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      </Container>
    </div>
  );
};

const TableScreen = ({ teams, setSelectedTeam, setScreen, goBack }) => {
  const sortedTeams = [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return ((b.sets_won || 0) - (b.sets_lost || 0)) - ((a.sets_won || 0) - (a.sets_lost || 0));
  });

  const handleTeamClick = (team) => {
    setSelectedTeam(team);
    setScreen("teamDetail");
  };

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Турнирная таблица" />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
                <thead>
                  <tr style={{ background: colors.gray }}>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "12px", fontWeight: 600 }}>#</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "12px", fontWeight: 600 }}>Команда</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>И</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>В</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>П</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>Партии</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>Мячи</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>О</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.map((team, i) => (
                    <tr 
                      key={team.id} 
                      style={{ borderTop: `1px solid ${colors.grayBorder}`, cursor: "pointer" }}
                      onClick={() => handleTeamClick(team)}
                    >
                      <td style={{ padding: "12px 8px", fontWeight: 700, color: i < 3 ? colors.gold : colors.text }}>{i + 1}</td>
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "18px" }}>
                          {team.logo_url && team.logo_url.startsWith('http') ? (
                            <img src={team.logo_url} alt={team.name} style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "6px", verticalAlign: "middle" }} />
                          ) : (
                            team.logo_url || "🏐"
                          )}
                        </span>
                          <span style={{ fontWeight: 600, fontSize: "14px" }}>{team.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontSize: "14px" }}>{team.games_played || 0}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontSize: "14px", color: "#16a34a" }}>{team.wins || 0}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontSize: "14px", color: "#dc2626" }}>{team.losses || 0}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontSize: "14px" }}>{team.sets_won || 0}:{team.sets_lost || 0}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontSize: "14px" }}>{team.balls_lost ? ((team.balls_won || 0) / team.balls_lost).toFixed(3) : "—"}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, fontSize: "14px", color: colors.gold }}>{team.points || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div style={{ marginTop: "16px", fontSize: "12px", color: colors.goldDark }}>И — игры, В — победы, П — поражения, Мячи — коэффициент, О — очки</div>
        </div>
      </Container>
    </div>
  );
};

const PlayersScreen = ({ setScreen, players, userRoles, coachTeam, onSendOffer, sentOffers, setSelectedPlayer, user, myPlayerId, teams, playerStats, users }) => {
  const [filter, setFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const canInvite = (userRoles.isCoach || userRoles.isAdmin) && coachTeam;
  
  // Создаем список всех людей: игроки + тренеры
  const allPeople = [];
  
  // Добавляем всех игроков с их очками
  (players || []).forEach(player => {
    const stats = (playerStats || []).filter(s => s.player_id === player.id);
    const totalPoints = stats.reduce((sum, s) => {
      const serve = (s.aces || 0) - (s.serve_errors || 0);
      const receive = (s.receive_excellent || 0) - (s.receive_errors || 0);
      const attack = (s.attack_points || 0) - (s.attack_errors || 0);
      const block = (s.block_points || 0) - (s.block_errors || 0);
      return sum + serve + receive + attack + block;
    }, 0);
    allPeople.push({ 
      ...player, 
      totalPoints,
      type: 'player',
      sortName: player.users?.first_name || player.users?.username || ''
    });
  });
  
  // Добавляем тренеров и помечаем игроков-тренеров
  (teams || []).forEach(team => {
    if (team.coach_id) {
      // Проверяем есть ли уже этот человек как игрок
      const existingPlayer = allPeople.find(p => p.user_id === team.coach_id);
      if (existingPlayer) {
        // Если это игрок - помечаем что он также тренер
        existingPlayer.isCoach = true;
        existingPlayer.coachTeamId = team.id;
      } else {
        // Находим данные тренера в users
        const coachUser = (users || []).find(u => u.id === team.coach_id);
        if (coachUser) {
          // Создаем запись для тренера
          allPeople.push({
            id: `coach_${team.coach_id}`,
            user_id: team.coach_id,
            users: coachUser,
            team_id: team.id,
            teams: team,
            is_free_agent: false,
            positions: [],
            totalPoints: 0,
            type: 'coach',
            isCoach: true,
            sortName: coachUser.first_name || coachUser.username || ''
          });
        }
      }
    }
  });
  
  const filteredPlayers = allPeople.filter(p => {
    if (filter === "free" && !p.is_free_agent) return false;
    if (filter === "team" && (p.is_free_agent || p.type === 'coach')) return false;
    if (filter === "coach" && !p.isCoach) return false;
    if (positionFilter !== "all" && p.type !== 'coach' && !p.positions?.includes(positionFilter)) return false;
    
    // Поиск по ФИО
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${p.users?.first_name || ""} ${p.users?.last_name || ""} ${p.users?.username || ""}`.toLowerCase();
      if (!fullName.includes(query)) return false;
    }
    
    return true;
  }).sort((a, b) => {
    // Любимые игроки вверху
    const aIsFavorite = user?.favorite_players?.includes(a.id);
    const bIsFavorite = user?.favorite_players?.includes(b.id);
    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;
    
    // Затем мой игрок / игрок из моей команды
    const aIsMy = a.id === myPlayerId || a.team_id === user?.favorite_team_id;
    const bIsMy = b.id === myPlayerId || b.team_id === user?.favorite_team_id;
    if (aIsMy && !bIsMy) return -1;
    if (!aIsMy && bIsMy) return 1;
    
    // Сортировка: сначала те у кого есть статистика, потом по значению
    const aHasStats = a.totalPoints !== 0;
    const bHasStats = b.totalPoints !== 0;
    if (aHasStats && !bHasStats) return -1;
    if (!aHasStats && bHasStats) return 1;
    if (aHasStats && bHasStats) return b.totalPoints - a.totalPoints;
    
    // Сортировка по имени
    return (a.sortName || '').localeCompare(b.sortName || '');
  });
  
  const hasPendingOffer = (playerId) => (sentOffers || []).some(o => o.player_id === playerId && o.status === "pending");

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Игроки" />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {/* Фильтры */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto" }}>
            {[{ id: "all", label: "Все" }, { id: "free", label: "Свободные" }, { id: "team", label: "В команде" }, { id: "coach", label: "Тренеры" }].map(tab => (
              <button key={tab.id} onClick={() => setFilter(tab.id)} style={{
                padding: "8px 16px", borderRadius: "20px", border: "none",
                background: filter === tab.id ? colors.gold : colors.gray,
                color: filter === tab.id ? colors.bg : colors.text,
                fontWeight: 500, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
              }}>{tab.label}</button>
            ))}
          </div>
          
          {/* Фильтр по амплуа */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto" }}>
            <button onClick={() => setPositionFilter("all")} style={{
              padding: "6px 12px", borderRadius: "16px", border: `1px solid ${colors.grayBorder}`,
              background: positionFilter === "all" ? colors.goldLight : colors.bg,
              color: colors.text, fontWeight: 500, fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
            }}>Все амплуа</button>
            {Object.entries(positionLabels).map(([key, label]) => (
              <button key={key} onClick={() => setPositionFilter(key)} style={{
                padding: "6px 12px", borderRadius: "16px", border: `1px solid ${colors.grayBorder}`,
                background: positionFilter === key ? colors.goldLight : colors.bg,
                color: colors.text, fontWeight: 500, fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
              }}>{label}</button>
            ))}
          </div>

          {/* Поиск по ФИО */}
          <Input 
            label="Поиск"
            placeholder="Введите имя или фамилию..."
            value={searchQuery} 
            onChange={setSearchQuery}
          />
          
          {filteredPlayers.map(player => (
            <Card 
              key={player.id} 
              style={{ marginBottom: "12px", cursor: "pointer" }}
              onClick={() => { 
                setSelectedPlayer(player); 
                setScreen("playerDetail");
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar name={player.users?.first_name || player.users?.username} size={48} url={player.users?.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "2px" }}>
                    {user?.favorite_players?.includes(player.id) && <span style={{ color: colors.gold, marginRight: "4px" }}>★</span>}
                    {player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}
                  </div>
                  {(player.type !== 'coach' || player.positions?.length > 0) && (
                    <div style={{ fontSize: "13px", color: colors.goldDark }}>
                      {player.positions?.length > 0 ? player.positions.map(p => positionLabels[p] || p).join(", ") : "Амплуа не указано"}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: colors.goldDark, marginTop: "2px" }}>{player.teams?.name || "Без команды"}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                  {player.totalPoints !== 0 && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: colors.gold }}>{player.totalPoints}</div>
                      <div style={{ fontSize: "10px", color: colors.goldDark }}>эфф.</div>
                    </div>
                  )}
                  {player.isCoach && <Badge variant="gold">Тренер</Badge>}
                  {player.type === 'player' && <Badge variant={player.is_free_agent ? "free" : "default"}>{player.is_free_agent ? "Свободен" : "В команде"}</Badge>}
                  {canInvite && player.type === 'player' && player.is_free_agent && (
                    hasPendingOffer(player.id) ? <Badge variant="pending">Приглашён</Badge> : (
                      <Button onClick={(e) => { e.stopPropagation(); onSendOffer(player.id); }} style={{ padding: "6px 12px", fontSize: "12px" }}><Icons.Send /> Пригласить</Button>
                    )
                  )}
                </div>
              </div>
            </Card>
          ))}
          {filteredPlayers.length === 0 && <Card style={{ textAlign: "center", color: colors.goldDark }}>Никого не найдено</Card>}
        </div>
      </Container>
    </div>
  );
};

const PlayerDetailScreen = ({ setScreen, goBack, player, teams, setSelectedTeam, playerStats, matches, tours, user, onToggleFavorite, userRoles }) => {
  const team = teams.find(t => t.id === player?.team_id);
  const coachOfTeam = teams?.find(t => t.coach_id === player?.user_id); // Проверяем является ли игрок тренером
  
  const getAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };
  
  const age = getAge(player?.birth_date);
  
  // Агрегируем статистику игрока
  const stats = (playerStats || []).filter(s => s.player_id === player?.id);
  const totalStats = stats.reduce((acc, s) => ({
    games: acc.games + 1,
    // Подача
    serves_total: acc.serves_total + (s.serves_total || 0),
    aces: acc.aces + (s.aces || 0),
    serve_errors: acc.serve_errors + (s.serve_errors || 0),
    // Приём (4 уровня)
    receive_excellent: acc.receive_excellent + (s.receive_excellent || 0),
    receive_good: acc.receive_good + (s.receive_good || 0),
    receive_poor: acc.receive_poor + (s.receive_poor || 0),
    receive_errors: acc.receive_errors + (s.receive_errors || 0),
    // Атака
    attacks_total: acc.attacks_total + (s.attacks_total || 0),
    attack_points: acc.attack_points + (s.attack_points || 0),
    attack_errors: acc.attack_errors + (s.attack_errors || 0),
    // Блок
    block_points: acc.block_points + (s.block_points || 0),
    block_touches: acc.block_touches + (s.block_touches || 0),
    block_errors: acc.block_errors + (s.block_errors || 0),
  }), { games: 0, serves_total: 0, aces: 0, serve_errors: 0, receive_excellent: 0, receive_good: 0, receive_poor: 0, receive_errors: 0, attacks_total: 0, attack_points: 0, attack_errors: 0, block_points: 0, block_touches: 0, block_errors: 0 });
  
  // Считаем победы/поражения - используем team_id из статистики матча
  const wins = stats.filter(s => {
    const m = matches?.find(match => match.id === s.match_id);
    if (!m || (m.status !== "finished" && m.status !== "live")) return false;
    const playerTeamInMatch = s.team_id || player?.team_id;
    const isTeam1 = m.team1_id === playerTeamInMatch;
    return isTeam1 ? m.sets_team1 > m.sets_team2 : m.sets_team2 > m.sets_team1;
  }).length;
  const losses = totalStats.games - wins;
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Профиль игрока" showBack onBack={() => goBack("players")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {/* Большое фото игрока */}
          {player?.users?.avatar_url && (
            <div style={{ marginBottom: "20px", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
              <img src={player.users.avatar_url} alt="" style={{ width: "100%", height: "auto", objectFit: "contain", display: "block", background: "#f5f5f5" }} />
            </div>
          )}
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
            {!player?.users?.avatar_url && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                <Avatar name={player?.users?.first_name || player?.users?.username} size={80} />
              </div>
            )}
            <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700 }}>
              {player?.users?.first_name || `@${player?.users?.username}`} {player?.users?.last_name || ""}
            </h2>
            {player?.users?.username && userRoles?.isAdmin && (
              <p style={{ margin: "0 0 12px", color: colors.goldDark, fontSize: "14px" }}>@{player.users.username}</p>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              {player?.is_captain && <Badge variant="captain">Капитан</Badge>}
              {coachOfTeam && <Badge variant="gold">Тренер ({coachOfTeam.name})</Badge>}
              {player?.type !== 'coach' && !coachOfTeam && (
                <Badge variant={player?.is_free_agent ? "free" : "gold"}>
                  {player?.is_free_agent ? "Свободный игрок" : "В команде"}
                </Badge>
              )}
            </div>
            {onToggleFavorite && user && (
              <Button 
                variant={user?.favorite_players?.includes(player?.id) ? "primary" : "outline"}
                onClick={() => onToggleFavorite(player?.id)} 
                style={{ marginTop: "16px", width: "100%" }}
              >
                {user?.favorite_players?.includes(player?.id) ? "★ В избранном" : "☆ В избранное"}
              </Button>
            )}
          </Card>

          {age && (
            <Card style={{ marginBottom: "20px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "28px", fontWeight: 700, color: colors.gold }}>{age}</div>
                <div style={{ fontSize: "12px", color: colors.goldDark }}>Возраст</div>
              </div>
            </Card>
          )}

          <Card style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>ИНФОРМАЦИЯ</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: colors.goldDark }}>Команда</span>
                {team ? (
                  <span style={{ fontWeight: 600, cursor: "pointer", color: colors.gold, display: "flex", alignItems: "center", gap: "4px" }}
                    onClick={() => { setSelectedTeam && setSelectedTeam(team); setScreen("teamDetail"); }}>
                    {team.name} <Icons.ChevronRight />
                  </span>
                ) : (
                  <span style={{ fontWeight: 600 }}>Без команды</span>
                )}
              </div>
              {(player?.type !== 'coach' || player?.positions?.length > 0) && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ color: colors.goldDark, flexShrink: 0 }}>Амплуа</span>
                  <span style={{ fontWeight: 600, textAlign: "right" }}>{player?.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</span>
                </div>
              )}
              {player?.jersey_number && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.goldDark }}>Номер</span>
                  <span style={{ fontWeight: 700, color: colors.gold }}>#{player.jersey_number}</span>
                </div>
              )}
              {player?.users?.height && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.goldDark }}>Рост</span>
                  <span style={{ fontWeight: 600 }}>{player.users.height} см</span>
                </div>
              )}
              {player?.users?.jump_height && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.goldDark }}>Высота прыжка</span>
                  <span style={{ fontWeight: 600 }}>{player.users.jump_height} см{player.users.measurement_date ? ` (${new Date(player.users.measurement_date).toLocaleDateString("ru-RU")})` : ""}</span>
                </div>
              )}
              {player?.birth_date && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.goldDark }}>Дата рождения</span>
                  <span style={{ fontWeight: 600 }}>{new Date(player.birth_date).toLocaleDateString("ru-RU")}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Статистика */}
          <Card style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>СТАТИСТИКА</h3>
            {totalStats.games > 0 ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: 700 }}>{totalStats.games}</div>
                    <div style={{ fontSize: "11px", color: colors.goldDark }}>Игр</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: "#16a34a" }}>{wins}</div>
                    <div style={{ fontSize: "11px", color: colors.goldDark }}>Побед</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: "#dc2626" }}>{losses}</div>
                    <div style={{ fontSize: "11px", color: colors.goldDark }}>Поражений</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px" }}>
                  {(() => {
                    // ПОДАЧА: 3 формулы
                    const serveTotal = totalStats.serves_total || (totalStats.aces + totalStats.serve_errors);
                    const serveEff = serveTotal > 0 ? Math.round(((totalStats.aces - totalStats.serve_errors) / serveTotal) * 100) : 0;
                    const serveStab = serveTotal > 0 ? Math.round(((totalStats.aces + (serveTotal - totalStats.aces - totalStats.serve_errors)) / serveTotal) * 100) : 0;
                    const serveReal = serveTotal > 0 ? Math.round((totalStats.aces / serveTotal) * 100) : 0;
                    
                    // ПРИЁМ: 3 формулы
                    const receiveTotal = totalStats.receive_excellent + totalStats.receive_good + totalStats.receive_poor + totalStats.receive_errors;
                    const receiveEff = receiveTotal > 0 ? Math.round(((totalStats.receive_excellent + totalStats.receive_good * 0.5 - totalStats.receive_errors) / receiveTotal) * 100) : 0;
                    const receiveStab = receiveTotal > 0 ? Math.round(((totalStats.receive_excellent + totalStats.receive_good) / receiveTotal) * 100) : 0;
                    const receiveClean = receiveTotal > 0 ? Math.round((totalStats.receive_excellent / receiveTotal) * 100) : 0;
                    
                    // АТАКА: 3 формулы
                    const attackTotal = totalStats.attacks_total || (totalStats.attack_points + totalStats.attack_errors);
                    const attackEff = attackTotal > 0 ? Math.round(((totalStats.attack_points - totalStats.attack_errors) / attackTotal) * 100) : 0;
                    const attackStab = attackTotal > 0 ? Math.round(((totalStats.attack_points + (attackTotal - totalStats.attack_points - totalStats.attack_errors)) / attackTotal) * 100) : 0;
                    const attackReal = attackTotal > 0 ? Math.round((totalStats.attack_points / attackTotal) * 100) : 0;
                    
                    // БЛОК: 3 формулы
                    const blockTotal = totalStats.block_points + totalStats.block_touches + totalStats.block_errors;
                    const blockEff = blockTotal > 0 ? Math.round(((totalStats.block_points - totalStats.block_errors) / blockTotal) * 100) : 0;
                    const blockStab = blockTotal > 0 ? Math.round(((totalStats.block_points + totalStats.block_touches) / blockTotal) * 100) : 0;
                    const blockReal = blockTotal > 0 ? Math.round((totalStats.block_points / blockTotal) * 100) : 0;
                    
                    return (
                      <>
                        {/* Подача */}
                        <div style={{ padding: "10px 0", borderBottom: "1px solid " + colors.grayBorder }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontWeight: 600 }}>Подача</span>
                            {serveTotal > 0 && <span style={{ fontSize: "13px", color: serveEff >= 0 ? colors.gold : "#dc2626", fontWeight: 600 }}>{serveEff > 0 ? "+" : ""}{serveEff}% эфф.</span>}
                          </div>
                          <div style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
                            <span style={{ color: "#16a34a" }}>Эйсы: {totalStats.aces}</span>
                            <span style={{ color: "#ca8a04" }}>Подача: {serveTotal}</span>
                            <span style={{ color: "#dc2626" }}>Ош: {totalStats.serve_errors}</span>
                          </div>
                          {serveTotal > 0 && <div style={{ fontSize: "11px", color: colors.goldDark, marginTop: "4px" }}>Стаб: {serveStab}% • Реализ: {serveReal}%</div>}
                        </div>
                        
                        {/* Приём */}
                        <div style={{ padding: "10px 0", borderBottom: "1px solid " + colors.grayBorder }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontWeight: 600 }}>Приём</span>
                            {receiveTotal > 0 && <span style={{ fontSize: "13px", color: receiveEff >= 0 ? colors.gold : "#dc2626", fontWeight: 600 }}>{receiveEff > 0 ? "+" : ""}{receiveEff}% эфф.</span>}
                          </div>
                          <div style={{ display: "flex", gap: "6px", fontSize: "13px", flexWrap: "wrap" }}>
                            <span style={{ color: "#16a34a" }}>Отл: {totalStats.receive_excellent}</span>
                            <span style={{ color: "#ca8a04" }}>Норм: {totalStats.receive_good}</span>
                            <span style={{ color: "#f97316" }}>Плохо: {totalStats.receive_poor}</span>
                            <span style={{ color: "#dc2626" }}>Ош: {totalStats.receive_errors}</span>
                          </div>
                          {receiveTotal > 0 && <div style={{ fontSize: "11px", color: colors.goldDark, marginTop: "4px" }}>Стаб: {receiveStab}% • Чистота: {receiveClean}%</div>}
                        </div>
                        
                        {/* Атака */}
                        <div style={{ padding: "10px 0", borderBottom: "1px solid " + colors.grayBorder }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontWeight: 600 }}>Атака</span>
                            {attackTotal > 0 && <span style={{ fontSize: "13px", color: attackEff >= 0 ? colors.gold : "#dc2626", fontWeight: 600 }}>{attackEff > 0 ? "+" : ""}{attackEff}% эфф.</span>}
                          </div>
                          <div style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
                            <span style={{ color: "#16a34a" }}>Очки: {totalStats.attack_points}</span>
                            <span style={{ color: "#ca8a04" }}>Атака: {attackTotal}</span>
                            <span style={{ color: "#dc2626" }}>Ош: {totalStats.attack_errors}</span>
                          </div>
                          {attackTotal > 0 && <div style={{ fontSize: "11px", color: colors.goldDark, marginTop: "4px" }}>Стаб: {attackStab}% • Реализ: {attackReal}%</div>}
                        </div>
                        
                        {/* Блок */}
                        <div style={{ padding: "10px 0" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontWeight: 600 }}>Блок</span>
                            {blockTotal > 0 && <span style={{ fontSize: "13px", color: blockEff >= 0 ? colors.gold : "#dc2626", fontWeight: 600 }}>{blockEff > 0 ? "+" : ""}{blockEff}% эфф.</span>}
                          </div>
                          <div style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
                            <span style={{ color: "#16a34a" }}>Очки: {totalStats.block_points}</span>
                            <span style={{ color: "#ca8a04" }}>Касания: {totalStats.block_touches}</span>
                            <span style={{ color: "#dc2626" }}>Ош: {totalStats.block_errors}</span>
                          </div>
                          {blockTotal > 0 && <div style={{ fontSize: "11px", color: colors.goldDark, marginTop: "4px" }}>Стаб: {blockStab}% • Реализ: {blockReal}%</div>}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", color: colors.goldDark, padding: "12px 0" }}>
                Статистика пока не заполнена
              </div>
            )}
          </Card>

          {/* Статистика по матчам */}
          {stats.length > 0 && (
            <Card style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>ПО МАТЧАМ</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {stats.map(stat => {
                  const match = matches?.find(m => m.id === stat.match_id);
                  if (!match) return null;
                  const team1 = teams.find(t => t.id === match.team1_id);
                  const team2 = teams.find(t => t.id === match.team2_id);
                  // Используем stat.team_id - команду за которую играл в этом матче
                  const playerTeamInMatch = stat.team_id || player?.team_id;
                  const isWin = (match.status === "finished" || match.status === "live") && (
                    (match.team1_id === playerTeamInMatch && match.sets_team1 > match.sets_team2) ||
                    (match.team2_id === playerTeamInMatch && match.sets_team2 > match.sets_team1)
                  );
                  
                  // Расчёт эффективности для матча
                  const serveTotal = stat.serves_total || (stat.aces + stat.serve_errors) || 0;
                  const serveEff = serveTotal > 0 ? Math.round(((stat.aces - stat.serve_errors) / serveTotal) * 100) : 0;
                  const receiveTotal = (stat.receive_excellent || 0) + (stat.receive_good || 0) + (stat.receive_poor || 0) + (stat.receive_errors || 0);
                  const receiveEff = receiveTotal > 0 ? Math.round((((stat.receive_excellent || 0) + (stat.receive_good || 0) * 0.5 - (stat.receive_errors || 0)) / receiveTotal) * 100) : 0;
                  const attackTotal = stat.attacks_total || ((stat.attack_points || 0) + (stat.attack_errors || 0)) || 0;
                  const attackEff = attackTotal > 0 ? Math.round((((stat.attack_points || 0) - (stat.attack_errors || 0)) / attackTotal) * 100) : 0;
                  const blockTotal = (stat.block_points || 0) + (stat.block_touches || 0) + (stat.block_errors || 0);
                  const blockEff = blockTotal > 0 ? Math.round((((stat.block_points || 0) - (stat.block_errors || 0)) / blockTotal) * 100) : 0;
                  
                  const tour = tours?.find(t => t.id === match.tour_id);
                  const matchDate = match.scheduled_time ? new Date(match.scheduled_time).toLocaleDateString("ru-RU") : "";
                  
                  return (
                    <div key={stat.id} style={{ padding: "12px", background: "#fafafa", borderRadius: "8px", border: "1px solid " + colors.grayBorder }}>
                      <div style={{ marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid " + colors.grayBorder }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600 }}>
                            {team1?.name || "?"} vs {team2?.name || "?"}
                          </span>
                          {(match.sets_team1 > 0 || match.sets_team2 > 0) && (
                            <span style={{ fontSize: "13px", fontWeight: 700, color: isWin ? "#16a34a" : "#dc2626" }}>
                              {match.sets_team1}:{match.sets_team2} {isWin ? "Победа" : "Поражение"}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: colors.goldDark }}>
                          {tour ? `Тур ${tour.number}` : ""}{tour && matchDate ? " • " : ""}{matchDate}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
                        {serveTotal > 0 && (() => {
                          const stab = Math.round(((stat.aces || 0) + (serveTotal - (stat.aces || 0) - (stat.serve_errors || 0))) / serveTotal * 100);
                          const real = Math.round((stat.aces || 0) / serveTotal * 100);
                          return (
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                                <span><b>Подача:</b> <span style={{ color: "#16a34a" }}>Эйсы: {stat.aces || 0}</span> <span style={{ color: "#ca8a04" }}>Подача: {serveTotal}</span> <span style={{ color: "#dc2626" }}>Ош: {stat.serve_errors || 0}</span></span>
                              </div>
                              <div style={{ color: colors.goldDark, fontSize: "10px" }}>Эфф: {serveEff > 0 ? "+" : ""}{serveEff}% • Стаб: {stab}% • Реал: {real}%</div>
                            </div>
                          );
                        })()}
                        {receiveTotal > 0 && (() => {
                          const stab = Math.round(((stat.receive_excellent || 0) + (stat.receive_good || 0)) / receiveTotal * 100);
                          const clean = Math.round((stat.receive_excellent || 0) / receiveTotal * 100);
                          return (
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                                <span><b>Приём:</b> <span style={{ color: "#16a34a" }}>Отл: {stat.receive_excellent || 0}</span> <span style={{ color: "#ca8a04" }}>Норм: {stat.receive_good || 0}</span> <span style={{ color: "#f97316" }}>Плохо: {stat.receive_poor || 0}</span> <span style={{ color: "#dc2626" }}>Ош: {stat.receive_errors || 0}</span></span>
                              </div>
                              <div style={{ color: colors.goldDark, fontSize: "10px" }}>Эфф: {receiveEff > 0 ? "+" : ""}{receiveEff}% • Стаб: {stab}% • Чист: {clean}%</div>
                            </div>
                          );
                        })()}
                        {attackTotal > 0 && (() => {
                          const stab = Math.round(((stat.attack_points || 0) + (attackTotal - (stat.attack_points || 0) - (stat.attack_errors || 0))) / attackTotal * 100);
                          const real = Math.round((stat.attack_points || 0) / attackTotal * 100);
                          return (
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                                <span><b>Атака:</b> <span style={{ color: "#16a34a" }}>Очки: {stat.attack_points || 0}</span> <span style={{ color: "#ca8a04" }}>Атака: {attackTotal}</span> <span style={{ color: "#dc2626" }}>Ош: {stat.attack_errors || 0}</span></span>
                              </div>
                              <div style={{ color: colors.goldDark, fontSize: "10px" }}>Эфф: {attackEff > 0 ? "+" : ""}{attackEff}% • Стаб: {stab}% • Реал: {real}%</div>
                            </div>
                          );
                        })()}
                        {blockTotal > 0 && (() => {
                          const stab = Math.round(((stat.block_points || 0) + (stat.block_touches || 0)) / blockTotal * 100);
                          const real = Math.round((stat.block_points || 0) / blockTotal * 100);
                          return (
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                                <span><b>Блок:</b> <span style={{ color: "#16a34a" }}>Очки: {stat.block_points || 0}</span> <span style={{ color: "#ca8a04" }}>Касания: {stat.block_touches || 0}</span> <span style={{ color: "#dc2626" }}>Ош: {stat.block_errors || 0}</span></span>
                              </div>
                              <div style={{ color: colors.goldDark, fontSize: "10px" }}>Эфф: {blockEff > 0 ? "+" : ""}{blockEff}% • Стаб: {stab}% • Реал: {real}%</div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {player?.bio && (
            <Card style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>О СЕБЕ</h3>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5, color: colors.text }}>{player.bio}</p>
            </Card>
          )}

          {player?.users?.username && userRoles?.isAdmin && (
            <Button variant="outline" onClick={() => window.open(`https://t.me/${player.users.username}`, '_blank')} style={{ width: "100%", marginTop: "8px" }}>
              <Icons.Send /> Написать в Telegram
            </Button>
          )}
        </div>
      </Container>
    </div>
  );
};

const OffersScreen = ({ setScreen, offers, teams, onAccept, onReject, loading, isInTeam }) => {
  const pendingOffers = offers.filter(o => o.status === "pending");
  const historyOffers = offers.filter(o => o.status !== "pending");

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Приглашения" showBack onBack={() => setScreen("home")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {pendingOffers.length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Новые приглашения ({pendingOffers.length})</h3>
              {pendingOffers.map(offer => {
                const team = teams.find(t => t.id === offer.team_id);
                return (
                  <Card key={offer.id} style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                      <div style={{ width: "48px", height: "48px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", overflow: "hidden" }}>
                        {team?.logo_url && team.logo_url.startsWith('http') ? (
                          <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          team?.logo_url || "🏐"
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "15px" }}>{team?.name || "Команда"}</div>
                        <div style={{ fontSize: "13px", color: colors.goldDark }}>Приглашает вас в состав</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark, marginTop: "2px" }}>{new Date(offer.created_at).toLocaleDateString("ru-RU")}</div>
                      </div>
                    </div>
                    {isInTeam ? (
                      <div style={{ background: colors.gray, padding: "12px", borderRadius: "8px", textAlign: "center", fontSize: "13px", color: colors.goldDark }}>
                        Вы уже в команде. Чтобы принять приглашение, сначала покиньте текущую команду.
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <Button variant="success" onClick={() => onAccept(offer.id, offer.team_id)} disabled={loading} style={{ flex: 1, padding: "10px" }}><Icons.Check /> Принять</Button>
                        <Button variant="danger" onClick={() => onReject(offer.id)} disabled={loading} style={{ flex: 1, padding: "10px" }}><Icons.X /> Отклонить</Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}
          {pendingOffers.length === 0 && (
            <Card style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>Нет новых приглашений</div>
              <div style={{ fontSize: "13px", color: colors.goldDark }}>Когда команда пригласит вас, вы увидите это здесь</div>
            </Card>
          )}
          {historyOffers.length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "24px 0 12px" }}>История</h3>
              {historyOffers.map(offer => {
                const team = teams.find(t => t.id === offer.team_id);
                return (
                  <Card key={offer.id} style={{ marginBottom: "8px", padding: "12px 16px", opacity: 0.7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "40px", height: "40px", background: colors.gray, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", overflow: "hidden" }}>
                          {team?.logo_url && team.logo_url.startsWith('http') ? (
                            <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            team?.logo_url || "🏐"
                          )}
                        </div>                    
                          <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: "14px" }}>{team?.name || "Команда"}</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark }}>{new Date(offer.created_at).toLocaleDateString("ru-RU")}</div>
                      </div>
                      <Badge variant={offer.status === "accepted" ? "free" : "default"}>{offer.status === "accepted" ? "Принято" : "Отклонено"}</Badge>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </Container>
    </div>
  );
};

const MyTeamScreen = ({ setScreen, user, teams, players, coachTeam, currentPlayer, sentOffers, onRemovePlayer, onSelectFavoriteTeam, onLeaveTeam, actionLoading, userRoles, setSelectedPlayer, teamRequests, onAcceptTeamRequest, onRejectTeamRequest, onUpdateJerseyNumber, onSetCaptain, onSendTeamMessage, onCreateTeam }) => {
  let myTeam = null;
  let teamRelation = null;
  
  if (userRoles.isCoach && coachTeam) {
    myTeam = coachTeam;
    teamRelation = "coach";
  } else if (userRoles.isPlayer && currentPlayer?.team_id) {
    myTeam = teams.find(t => t.id === currentPlayer.team_id);
    teamRelation = userRoles.isCaptain ? "captain" : "player";
  } else if (userRoles.isFan && user?.favorite_team_id) {
    myTeam = teams.find(t => t.id === user.favorite_team_id);
    teamRelation = "fan";
  }
  
  const teamPlayers = myTeam ? (players || []).filter(p => p.team_id === myTeam.id) : [];
  const teamCoach = myTeam?.coaches;
  const pendingSentOffers = (sentOffers || []).filter(o => o.status === "pending");
  const pendingTeamRequests = (teamRequests || []).filter(r => r.team_id === myTeam?.id && r.status === "pending");

  // Для создания команды (тренер без команды)
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [editingJersey, setEditingJersey] = useState(null);
  const [jerseyValue, setJerseyValue] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [processedRequests, setProcessedRequests] = useState(new Set());


  if (userRoles.isFan && !myTeam) {
    return (
      <div style={{ paddingBottom: "100px" }}>
        <Header title="Моя команда" />
        <Container>
          <div style={{ padding: "20px 0" }}>
            <Card style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>💛</div>
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>Выберите любимую команду</h3>
              <p style={{ margin: 0, fontSize: "14px", color: colors.goldDark }}>Следите за результатами и получайте уведомления</p>
            </Card>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Команды турнира</h3>
            {teams.map(team => (
              <Card key={team.id} onClick={() => onSelectFavoriteTeam(team.id)} style={{ marginBottom: "12px", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "48px", height: "48px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", overflow: "hidden" }}>
                  {team.logo_url && team.logo_url.startsWith('http') ? (
                    <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    team.logo_url || "🏐"
                  )}
                </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "15px" }}>{team.name}</div>
                    <div style={{ fontSize: "13px", color: colors.goldDark }}>{team.wins}В {team.losses}П • {team.points} очков</div>
                  </div>
                  <Icons.ChevronRight />
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </div>
    );
  }

  if (userRoles.isPlayer && !myTeam && !userRoles.isCoach) {
    return (
      <div style={{ paddingBottom: "100px" }}>
        <Header title="Моя команда" />
        <Container>
          <div style={{ padding: "20px 0" }}>
            <Card style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🏐</div>
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>Вы свободный игрок</h3>
              <p style={{ margin: "0 0 16px", fontSize: "14px", color: colors.goldDark }}>Ожидайте приглашения от команд</p>
              <Button variant="outline" onClick={() => setScreen("offers")}>Мои приглашения</Button>
            </Card>
          </div>
        </Container>
      </div>
    );
  }


  if (userRoles.isCoach && !myTeam) {
    return (
      <div style={{ paddingBottom: "100px" }}>
        <Header title="Моя команда" />
        <Container>
          <div style={{ padding: "20px 0" }}>
            <Card style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📋</div>
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>Вы тренер без команды</h3>
              <p style={{ margin: "0 0 16px", fontSize: "14px", color: colors.goldDark }}>
                Обратитесь к администратору для назначения на команду или создания новой команды.
              </p>
            </Card>
          </div>
        </Container>
      </div>
    );
  }

  
  const handleAcceptRequest = async (requestId, playerId) => {
    setProcessedRequests(prev => new Set(prev).add(requestId));
    await onAcceptTeamRequest(requestId, playerId);
  };
  
  const handleRejectRequest = async (requestId) => {
    setProcessedRequests(prev => new Set(prev).add(requestId));
    await onRejectTeamRequest(requestId);
  };

  const handleSendMessage = async () => {
    if (!teamMessage.trim() || !myTeam) return;
    setSendingMessage(true);
    const result = await onSendTeamMessage(myTeam.id, myTeam.name, teamMessage);
    setSendingMessage(false);
    if (result?.sent > 0) {
      alert(`Сообщение отправлено ${result.sent} игрокам`);
      setTeamMessage("");
    } else {
      alert(`Не удалось отправить: ${result?.debug || 'ошибка'}`);
    }
  };

  const canManageTeam = teamRelation === "coach";

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Моя команда" rightElement={

        teamRelation === "fan" ? (
          <button onClick={() => onSelectFavoriteTeam(null)} style={{ background: "none", border: "none", color: colors.goldDark, fontSize: "13px", cursor: "pointer" }}>Сменить</button>
        ) : (teamRelation === "player" || teamRelation === "captain" || teamRelation === "coach") && onLeaveTeam ? (
          <button onClick={onLeaveTeam} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "13px", cursor: "pointer" }}>Покинуть</button>
        ) : null
      } />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ width: "80px", height: "80px", background: colors.goldLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "40px", overflow: "hidden" }}>
            {myTeam?.logo_url && myTeam.logo_url.startsWith('http') ? (
              <img src={myTeam.logo_url} alt={myTeam.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              myTeam?.logo_url || "🏐"
            )}
          </div>            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 700 }}>{myTeam?.name}</h2>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              {teamRelation === "coach" && <Badge variant="gold">Вы тренер</Badge>}
              {teamRelation === "captain" && <Badge variant="captain">Вы капитан</Badge>}
              {teamRelation === "player" && <Badge variant="free">Ваша команда</Badge>}
              {teamRelation === "fan" && <Badge variant="gold">Любимая команда</Badge>}
              {userRoles.isCoach && teamRelation !== "coach" && <Badge variant="gold">+ Тренер</Badge>}
              {userRoles.isPlayer && teamRelation === "coach" && <Badge variant="free">+ Игрок</Badge>}
            </div>
            </Card>

          <Card style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>СТАТИСТИКА</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center" }}>
              <div><div style={{ fontSize: "24px", fontWeight: 700, color: "#16a34a" }}>{myTeam?.wins || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Побед</div></div>
              <div><div style={{ fontSize: "24px", fontWeight: 700, color: "#dc2626" }}>{myTeam?.losses || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Поражений</div></div>
              <div><div style={{ fontSize: "24px", fontWeight: 700 }}>{myTeam?.sets_won || 0}:{myTeam?.sets_lost || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Партии</div></div>
            </div>
          </Card>

          {canManageTeam && pendingTeamRequests.filter(r => !processedRequests.has(r.id)).length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Заявки в команду ({pendingTeamRequests.filter(r => !processedRequests.has(r.id)).length})</h3>
              {pendingTeamRequests.filter(r => !processedRequests.has(r.id)).map(request => {
                const player = players.find(p => p.id === request.player_id);
                return (
                  <Card key={request.id} style={{ marginBottom: "8px", padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                      <Avatar name={player?.users?.first_name || player?.users?.username} size={40} url={player?.users?.avatar_url} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{player?.users?.first_name || `@${player?.users?.username}`}</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark }}>{player?.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <Button variant="success" onClick={() => handleAcceptRequest(request.id, request.player_id)} disabled={actionLoading} style={{ flex: 1, padding: "8px" }}>Принять</Button>
                      <Button variant="danger" onClick={() => handleRejectRequest(request.id)} disabled={actionLoading} style={{ flex: 1, padding: "8px" }}>Отклонить</Button>
                    </div>
                  </Card>
                );
              })}
            </>
          )}

          {canManageTeam && pendingSentOffers.length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Ожидают ответа ({pendingSentOffers.length})</h3>
              {pendingSentOffers.map(offer => {
                const player = players.find(p => p.id === offer.player_id);
                return (
                  <Card key={offer.id} style={{ marginBottom: "8px", padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Avatar name={player?.users?.first_name || player?.users?.username} size={40} url={player?.users?.avatar_url} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{player?.users?.first_name || `@${player?.users?.username}`}</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark }}>{player?.positions?.map(p => positionLabels[p] || p).join(", ")}</div>
                      </div>
                      <Badge variant="pending">Ожидает</Badge>
                    </div>
                  </Card>
                );
              })}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Состав ({teamPlayers.length + (teamCoach ? 1 : 0)})</h3>
          </div>
          {teamCoach && (
            <Card style={{ marginBottom: "8px", padding: "12px 16px", background: colors.goldLight }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar name={teamCoach.first_name || teamCoach.username} size={44} url={teamCoach.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>
                    {teamCoach.first_name || `@${teamCoach.username}`} {teamCoach.last_name || ""}
                  </div>
                  <div style={{ fontSize: "12px", color: colors.goldDark }}>Тренер</div>
                </div>
                <Badge variant="gold">Тренер</Badge>
              </div>
            </Card>
          )}
          {teamPlayers.length > 0 ? [...teamPlayers].sort((a, b) => { const numA = parseInt(a.jersey_number) || 9999; const numB = parseInt(b.jersey_number) || 9999; return numA - numB; }).map(player => (
            <Card key={player.id} style={{ marginBottom: "8px", padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div onClick={() => { setSelectedPlayer(player); setScreen("playerDetail"); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <Avatar name={player.users?.first_name || player.users?.username} size={44} url={player.users?.avatar_url} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>
                      {player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}
                      {player.is_captain && <span style={{ marginLeft: "6px", color: colors.gold }}>©</span>}
                    </div>
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</div>
                  </div>
                </div>
                {canManageTeam ? (
                  editingJersey === player.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }} onClick={e => e.stopPropagation()}>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={jerseyValue}
                        onChange={e => setJerseyValue(e.target.value)}
                        style={{ width: "50px", padding: "6px", textAlign: "center", borderRadius: "6px", border: `1px solid ${colors.gold}`, fontSize: "14px" }}
                        autoFocus
                      />
                      <button onClick={() => { onUpdateJerseyNumber(player.id, jerseyValue); setEditingJersey(null); }} style={{ background: colors.gold, color: "white", border: "none", borderRadius: "4px", padding: "6px 8px", cursor: "pointer" }}>✓</button>
                      <button onClick={() => setEditingJersey(null)} style={{ background: colors.gray, border: "none", borderRadius: "4px", padding: "6px 8px", cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setEditingJersey(player.id); setJerseyValue(player.jersey_number || ""); }} style={{ background: player.jersey_number ? colors.goldLight : colors.gray, border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: player.jersey_number ? colors.goldDark : colors.goldDark }}>
                      {player.jersey_number ? `#${player.jersey_number}` : "№"}
                    </button>
                  )
                ) : (
                  player.jersey_number && <div style={{ fontSize: "16px", fontWeight: 700, color: colors.gold, marginRight: "8px" }}>#{player.jersey_number}</div>
                )}
                {canManageTeam && (
                  <button onClick={(e) => { e.stopPropagation(); onSetCaptain(myTeam.id, player.id, !player.is_captain); }} style={{ background: player.is_captain ? "#fef3c7" : colors.gray, border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", cursor: "pointer", color: player.is_captain ? "#92400e" : colors.goldDark }}>{player.is_captain ? "©" : "Капитан"}</button>
                )}
                {canManageTeam && player.user_id !== user?.id && (
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Удалить ${player.users?.first_name || 'игрока'} из команды?`)) onRemovePlayer(player.id); }} disabled={actionLoading}
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px", opacity: actionLoading ? 0.5 : 1 }}>
                    <Icons.X />
                  </button>
                )}
              </div>
            </Card>
          )) : (
            <Card style={{ textAlign: "center", color: colors.goldDark }}>Состав пока не заполнен</Card>
          )}

          {/* Team Message (for coach, players, captains) */}
          {(canManageTeam || teamRelation === "player" || teamRelation === "captain") && (
            <Card style={{ marginTop: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>📢 СООБЩЕНИЕ КОМАНДЕ</h3>
              <textarea
                value={teamMessage}
                onChange={e => setTeamMessage(e.target.value)}
                placeholder="Напишите сообщение для игроков..."
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${colors.grayBorder}`, fontSize: "14px", minHeight: "80px", resize: "vertical", boxSizing: "border-box" }}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={sendingMessage || !teamMessage.trim()}
                style={{ width: "100%", marginTop: "12px" }}
              >
                {sendingMessage ? "Отправка..." : "📨 Отправить в Telegram"}
              </Button>
            </Card>
          )}
        </div>
      </Container>
    </div>
  );
};

// Stat Field Component (работает точно как Input)
const StatField = ({ label, value, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
    <span style={{ fontSize: "11px", color: colors.goldDark, width: "30px" }}>{label}</span>
    <input 
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value ?? ""}
      onChange={e => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        onChange(val === "" ? "" : parseInt(val) || 0);
      }}
      style={{ width: "40px", padding: "4px", textAlign: "center", borderRadius: "4px", border: `1px solid ${colors.grayBorder}`, fontSize: "12px" }}
    />
  </div>
);

// Player Stat Input Component
const PlayerStatInput = ({ player, matchId, existingStat, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Подача
  const [servesTotal, setServesTotal] = useState(existingStat?.serves_total || "");
  const [aces, setAces] = useState(existingStat?.aces || "");
  const [serveErrors, setServeErrors] = useState(existingStat?.serve_errors || "");
  // Приём (4 уровня)
  const [receiveExcellent, setReceiveExcellent] = useState(existingStat?.receive_excellent || "");
  const [receiveGood, setReceiveGood] = useState(existingStat?.receive_good || "");
  const [receivePoor, setReceivePoor] = useState(existingStat?.receive_poor || "");
  const [receiveErrors, setReceiveErrors] = useState(existingStat?.receive_errors || "");
  // Атака
  const [attacksTotal, setAttacksTotal] = useState(existingStat?.attacks_total || "");
  const [attackPoints, setAttackPoints] = useState(existingStat?.attack_points || "");
  const [attackErrors, setAttackErrors] = useState(existingStat?.attack_errors || "");
  // Блок
  const [blockPoints, setBlockPoints] = useState(existingStat?.block_points || "");
  const [blockTouches, setBlockTouches] = useState(existingStat?.block_touches || "");
  const [blockErrors, setBlockErrors] = useState(existingStat?.block_errors || "");
  
  const handleSave = async () => {
    const stat = {
      serves_total: parseInt(servesTotal) || 0,
      aces: parseInt(aces) || 0, 
      serve_errors: parseInt(serveErrors) || 0,
      receive_excellent: parseInt(receiveExcellent) || 0,
      receive_good: parseInt(receiveGood) || 0,
      receive_poor: parseInt(receivePoor) || 0,
      receive_errors: parseInt(receiveErrors) || 0,
      attacks_total: parseInt(attacksTotal) || 0,
      attack_points: parseInt(attackPoints) || 0, 
      attack_errors: parseInt(attackErrors) || 0,
      block_points: parseInt(blockPoints) || 0,
      block_touches: parseInt(blockTouches) || 0,
      block_errors: parseInt(blockErrors) || 0
    };
    await onSave(player.id, matchId, stat, existingStat?.id);
    setIsEditing(false);
  };
  
  if (!isEditing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid " + colors.grayBorder }}>
        <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
        <span style={{ fontSize: "13px", flex: 1 }}>
          {player.jersey_number && <span style={{ color: colors.gold, marginRight: "4px" }}>#{player.jersey_number}</span>}
          {player.users?.first_name || player.users?.username} {player.users?.last_name || ""}
        </span>
        {existingStat ? (
          <span style={{ fontSize: "11px", color: colors.goldDark }}>
            П:{(existingStat.aces || 0) + (existingStat.serves_total || 0) + (existingStat.serve_errors || 0)} Пр:{(existingStat.receive_excellent || 0) + (existingStat.receive_good || 0) + (existingStat.receive_poor || 0) + (existingStat.receive_errors || 0)} Б:{(existingStat.block_points || 0) + (existingStat.block_touches || 0) + (existingStat.block_errors || 0)} А:{(existingStat.attack_points || 0) + (existingStat.attacks_total || 0) + (existingStat.attack_errors || 0)}
          </span>
        ) : (
          <span style={{ fontSize: "11px", color: colors.goldDark }}>—</span>
        )}
        <button onClick={() => setIsEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }}>
          <Icons.Edit />
        </button>
      </div>
    );
  }
  
  return (
    <div style={{ padding: "12px", background: colors.gray, borderRadius: "8px", marginBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
        <span style={{ fontSize: "13px", fontWeight: 600 }}>
          {player.jersey_number && <span style={{ color: colors.gold, marginRight: "4px" }}>#{player.jersey_number}</span>}
          {player.users?.first_name || player.users?.username} {player.users?.last_name || ""}
        </span>
      </div>
      {/* Подача */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Подача</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <StatField label="Всего" value={servesTotal} onChange={setServesTotal} />
          <StatField label="Эйс" value={aces} onChange={setAces} />
          <StatField label="Ош" value={serveErrors} onChange={setServeErrors} />
        </div>
      </div>
      {/* Приём */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Приём</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <StatField label="Отл" value={receiveExcellent} onChange={setReceiveExcellent} />
          <StatField label="Норм" value={receiveGood} onChange={setReceiveGood} />
          <StatField label="Плохо" value={receivePoor} onChange={setReceivePoor} />
          <StatField label="Ош" value={receiveErrors} onChange={setReceiveErrors} />
        </div>
      </div>
      {/* Атака */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Атака</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <StatField label="Всего" value={attacksTotal} onChange={setAttacksTotal} />
          <StatField label="Очки" value={attackPoints} onChange={setAttackPoints} />
          <StatField label="Ош" value={attackErrors} onChange={setAttackErrors} />
        </div>
      </div>
      {/* Блок */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Блок</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <StatField label="Очки" value={blockPoints} onChange={setBlockPoints} />
          <StatField label="Кас" value={blockTouches} onChange={setBlockTouches} />
          <StatField label="Ош" value={blockErrors} onChange={setBlockErrors} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <Button onClick={handleSave} style={{ flex: 1, padding: "8px", fontSize: "12px" }}>
          <Icons.Save /> Сохранить
        </Button>
        <Button variant="outline" onClick={() => setIsEditing(false)} style={{ padding: "8px", fontSize: "12px" }}>
          Отмена
        </Button>
      </div>
    </div>
  );
};

// Admin Panel Screen - РАСШИРЕННАЯ ВЕРСИЯ
const AdminScreen = ({ setScreen, matches, teams, users, players, tours, playerStats, roleRequests, sponsors, prizes, predictions, onUpdateMatch, onUpdateUserRole, onUpdateUser, onAssignCoach, onDeleteTeam, onSetCaptain, onCreateTour, onUpdateTour, onDeleteTour, onCreateMatch, onUpdateMatchInfo, onDeleteMatch, onUpdateMatchVideo, onSavePlayerStat, onMakePlayer, onDeleteUser, onApproveRequest, onRejectRequest, actionLoading, loadData, onUpdatePlayer, onChangeGameRole, onCreateTeam, onUpdateTeamInfo, onStartServiceman, tournaments, activeTournamentId, onCreateTournament, onUpdateTournament, onDeleteTournament }) => {
  const [tab, setTab] = useState("tours");
  const [editingTour, setEditingTour] = useState(null);
  const [tourData, setTourData] = useState({ number: "", name: "", date: "", location: "", address: "", tournament_id: "" });
  const [tournamentData, setTournamentData] = useState({ name: "", category: "men", season: "" });
  const [editingTournament, setEditingTournament] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);
  const [matchScore, setMatchScore] = useState({ 
    sets_team1: 0, sets_team2: 0, status: "upcoming",
    set1_team1: "", set1_team2: "", set2_team1: "", set2_team2: "", set3_team1: "", set3_team2: "",
    set4_team1: "", set4_team2: "", set5_team1: "", set5_team2: ""
  });
  const [editingUser, setEditingUser] = useState(null);
  const [userHeight, setUserHeight] = useState("");
  const [userJumpHeight, setUserJumpHeight] = useState("");
  const [userMeasurementDate, setUserMeasurementDate] = useState("");
  const [userRole, setUserRole] = useState("fan");
  const [gameRole, setGameRole] = useState("fan");
  const [userFirstName, setUserFirstName] = useState("");
  const [userLastName, setUserLastName] = useState("");
  const [isServiceman, setIsServiceman] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamCoach, setTeamCoach] = useState("");
  const [coachSearchQuery, setCoachSearchQuery] = useState("");
  const [isCoachListOpen, setIsCoachListOpen] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [teamMessage, setTeamMessage] = useState("");
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  
  // Прогнозы и спонсоры
  const [showAddSponsor, setShowAddSponsor] = useState(false);
  const [showAddPrize, setShowAddPrize] = useState(false);
  const [newSponsor, setNewSponsor] = useState({ name: "", logo_url: "", description: "", website_url: "", is_active: true });
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [uploadingSponsorLogo, setUploadingSponsorLogo] = useState(false);
  const [newPrize, setNewPrize] = useState({ sponsor_id: "", title: "", description: "", place: "1", tour_id: "", link_url: "", is_active: true });
  const [editingPrize, setEditingPrize] = useState(null);
  
  const handleCreateSponsor = async () => {
    try {
      await supabase.from("sponsors").insert({ 
        name: newSponsor.name, 
        logo_url: newSponsor.logo_url || null, 
        description: newSponsor.description || null,
        website_url: newSponsor.website_url || null,
        is_active: newSponsor.is_active 
      });
      setNewSponsor({ name: "", logo_url: "", description: "", website_url: "", is_active: true });
      setShowAddSponsor(false);
      await loadData();
      alert("Спонсор добавлен!");
    } catch (error) {
      console.error("Error creating sponsor:", error);
      alert("Ошибка добавления спонсора");
    }
  };

  const handleDeleteSponsor = async (id) => {
    if (!confirm("Удалить спонсора? Все связанные призы тоже будут удалены.")) return;
    try {
      await supabase.from("sponsors").delete().eq("id", id);
      await loadData();
    } catch (error) {
      console.error("Error deleting sponsor:", error);
      alert("Ошибка удаления");
    }
  };

  const handleUpdateSponsor = async () => {
    if (!editingSponsor) return;
    try {
      await supabase.from("sponsors").update({
        name: editingSponsor.name,
        description: editingSponsor.description || null,
        website_url: editingSponsor.website_url || null,
        logo_url: editingSponsor.logo_url || null
      }).eq("id", editingSponsor.id);
      setEditingSponsor(null);
      await loadData();
      alert("Спонсор обновлён!");
    } catch (error) {
      console.error("Error updating sponsor:", error);
      alert("Ошибка обновления");
    }
  };
  
  const handleCreatePrize = async () => {
    try {
      await supabase.from("prizes").insert({
        sponsor_id: newPrize.sponsor_id,
        title: newPrize.title,
        description: newPrize.description || null,
        place: parseInt(newPrize.place),
        tour_id: newPrize.tour_id || null,
        link_url: newPrize.link_url || null,
        is_active: newPrize.is_active
      });
      setNewPrize({ sponsor_id: "", title: "", description: "", place: "1", tour_id: "" });
      setShowAddPrize(false);
      await loadData();
      alert("Приз добавлен!");
    } catch (error) {
      console.error("Error creating prize:", error);
      alert("Ошибка добавления приза");
    }
  };
  
  const handleDeletePrize = async (id) => {
    if (!confirm("Удалить приз?")) return;
    try {
      await supabase.from("prizes").delete().eq("id", id);
      await loadData();
    } catch (error) {
      console.error("Error deleting prize:", error);
      alert("Ошибка удаления");
    }
  };

  const handleUpdatePrize = async () => {
    if (!editingPrize) return;
    try {
      await supabase.from("prizes").update({
        sponsor_id: editingPrize.sponsor_id,
        title: editingPrize.title,
        description: editingPrize.description || null,
        place: parseInt(editingPrize.place),
        tour_id: editingPrize.tour_id || null,
        link_url: editingPrize.link_url || null
      }).eq("id", editingPrize.id);
      setEditingPrize(null);
      await loadData();
      alert("Приз обновлён!");
    } catch (error) {
      console.error("Error updating prize:", error);
      alert("Ошибка обновления");
    }
  };
  
  // Создание тура
  const [showCreateTour, setShowCreateTour] = useState(false);
  const [newTour, setNewTour] = useState({ number: "", name: "", date: "", location: "", address: "", tournament_id: "" });
  
  // Создание матча
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [editingMatchInfo, setEditingMatchInfo] = useState(null);
  const [matchInfo, setMatchInfo] = useState({ tour_id: "", team1_id: "", team2_id: "", scheduled_time: "" });
  const [newMatch, setNewMatch] = useState({ tour_id: "", team1_id: "", team2_id: "", scheduled_time: "" });
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", logo_url: "" });
  const [editingTeamInfo, setEditingTeamInfo] = useState(null);
  const [teamInfo, setTeamInfo] = useState({ name: "", logo_url: "" });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Функция загрузки логотипа команды
  const handleUploadTeamLogo = async (file) => {
    try {
      setUploadingLogo(true);
      
      // Валидация файла
      if (!file) return null;
      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение');
        return null;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert('Размер файла не должен превышать 2MB');
        return null;
      }
      
      // Создаём уникальное имя файла
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `team-logos/${fileName}`;
      
      // Загружаем в Supabase Storage
      const { data, error } = await supabase.storage
        .from('team-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) {
        console.error('Storage upload error:', error);
        alert('Ошибка загрузки изображения. Попробуйте ещё раз.');
        return null;
      }
      
      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from('team-logos')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Ошибка загрузки логотипа');
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };
  
  // Загрузка логотипа спонсора
  const handleUploadSponsorLogo = async (file) => {
    try {
      setUploadingSponsorLogo(true);
      if (!file) return null;
      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение');
        return null;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert('Размер файла не должен превышать 2MB');
        return null;
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `sponsor-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `sponsor-logos/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('team-logos')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage.from('team-logos').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading sponsor logo:', error);
      alert('Ошибка загрузки логотипа');
      return null;
    } finally {
      setUploadingSponsorLogo(false);
    }
  };
  
  // Редактирование видео
  const [editingVideo, setEditingVideo] = useState(null);
  const [videoData, setVideoData] = useState({ stream_url: "", video_url: "" });

  // Редактирование игрока
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerJersey, setPlayerJersey] = useState("");
  const [playerPositions, setPlayerPositions] = useState([]);
  const [playerHeight, setPlayerHeight] = useState("");
  const [playerJumpHeight, setPlayerJumpHeight] = useState("");
  const [playerMeasurementDate, setPlayerMeasurementDate] = useState("");

  const startEditPlayer = (player) => {
    setEditingPlayer(player);
    setPlayerJersey(player.jersey_number || "");
    setPlayerPositions(player.positions || []);
    setPlayerHeight(player.users?.height || "");
    setPlayerJumpHeight(player.users?.jump_height || "");
    setPlayerMeasurementDate(player.users?.measurement_date || "");
  };

  const savePlayer = async () => {
    if (!editingPlayer || !onUpdatePlayer) return;
    // Сохраняем данные игрока в players
    await onUpdatePlayer(editingPlayer.id, {
      jersey_number: playerJersey || null,
      positions: playerPositions || []
    });
    // Сохраняем рост/прыжок в users
    if (editingPlayer.user_id) {
      await supabase.from('users').update({
        height: playerHeight ? parseInt(playerHeight) : null,
        jump_height: playerJumpHeight ? parseInt(playerJumpHeight) : null,
        measurement_date: playerMeasurementDate || null
      }).eq('id', editingPlayer.user_id);
    }
    setEditingPlayer(null);
    loadData();
  };

  const togglePosition = (pos) => {
    setPlayerPositions(prev => 
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const startEditMatch = (match) => {
    setEditingMatch(match);
    setMatchScore({
      sets_team1: match.sets_team1 || 0, sets_team2: match.sets_team2 || 0, status: match.status || "upcoming",
      set1_team1: match.set1_team1 || "", set1_team2: match.set1_team2 || "",
      set2_team1: match.set2_team1 || "", set2_team2: match.set2_team2 || "",
      set3_team1: match.set3_team1 || "", set3_team2: match.set3_team2 || "",
      set4_team1: match.set4_team1 || "", set4_team2: match.set4_team2 || "",
      set5_team1: match.set5_team1 || "", set5_team2: match.set5_team2 || "",
    });
  };

  const saveMatch = async () => {
    await onUpdateMatch(editingMatch.id, matchScore);
    setEditingMatch(null);
  };

  const startEditVideo = (match) => {
    setEditingVideo(match);
    setVideoData({ stream_url: match.stream_url || "", video_url: match.video_url || "" });
  };

  const saveVideo = async () => {
    await onUpdateMatchVideo(editingVideo.id, videoData);
    setEditingVideo(null);
  };

  const startEditUser = (u) => {
    setEditingUser(u);
    setUserRole(u.role === "admin" ? "admin" : "fan");
    setUserFirstName(u.first_name || "");
    setUserLastName(u.last_name || "");
    setIsServiceman(u.is_serviceman === true);
    setUserHeight(u.height || "");
    setUserJumpHeight(u.jump_height || "");
    setUserMeasurementDate(u.measurement_date || "");
    // Определяем текущую игровую роль (с учетом role_requests)
    const isCoach = teams.some(t => t.coach_id === u.id);
    const hasCoachRequest = roleRequests.some(r => r.user_id === u.id && r.requested_role === "coach" && r.status === "approved");
    const isPlayer = players.some(p => p.user_id === u.id);
    
    if (isCoach || hasCoachRequest) setGameRole("coach");
    else if (isPlayer) setGameRole("player");
    else setGameRole("fan");
  };

  const saveUser = async () => {
    console.log("💾 SaveUser: Starting", {
      userId: editingUser.id,
      selectedGameRole: gameRole,
      userRole,
      firstName: userFirstName,
      lastName: userLastName
    });
    
    // Обновляем имя, фамилию и права администратора
    await onUpdateUser(editingUser.id, userRole, userFirstName, userLastName, isServiceman);
    
    // Обновляем рост/прыжок
    await supabase.from('users').update({
      height: userHeight ? parseInt(userHeight) : null,
      jump_height: userJumpHeight ? parseInt(userJumpHeight) : null,
      measurement_date: userMeasurementDate || null
    }).eq('id', editingUser.id);
    
    // Смена игровой роли (отдельно)
    const currentIsCoach = teams.some(t => t.coach_id === editingUser.id);
    const hasCoachRequest = roleRequests.some(r => r.user_id === editingUser.id && r.requested_role === "coach" && r.status === "approved");
    const currentIsPlayer = players.some(p => p.user_id === editingUser.id);
    let currentGameRole = "fan";
    if (currentIsCoach || hasCoachRequest) currentGameRole = "coach";
    else if (currentIsPlayer) currentGameRole = "player";
    
    console.log("💾 SaveUser: Current role analysis", {
      currentIsCoach,
      hasCoachRequest,
      currentIsPlayer,
      currentGameRole,
      selectedGameRole: gameRole,
      needsChange: gameRole !== currentGameRole
    });
    
    if (gameRole !== currentGameRole && onChangeGameRole) {
      console.log("💾 SaveUser: Calling onChangeGameRole");
      await onChangeGameRole(editingUser.id, gameRole);
    } else {
      console.log("💾 SaveUser: No role change needed or handler missing");
    }
    setEditingUser(null);
    loadData();
  };

  const startEditTeam = (team) => {
    setEditingTeam(team);
    setTeamCoach(team.coach_id || "");
    setCoachSearchQuery("");
    setIsCoachListOpen(false);
  };

  const saveTeam = async () => {
    await onAssignCoach(editingTeam.id, teamCoach || null);
    setEditingTeam(null);
    setCoachSearchQuery("");
    setIsCoachListOpen(false);
  };

  const toggleTeamExpand = (teamId) => {
    setExpandedTeam(expandedTeam === teamId ? null : teamId);
  };

  const localCreateTour = async () => {
    await onCreateTour(newTour);
    setNewTour({ number: "", date: "", location: "", address: "" });
    setShowCreateTour(false);
  };

  const localCreateMatch = async () => {
    await onCreateMatch(newMatch);
    setNewMatch({ tour_id: "", team1_id: "", team2_id: "", scheduled_time: "" });
    setShowCreateMatch(false);
  };

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Админ-панель" showBack onBack={() => setScreen("home")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "20px", overflowX: "auto" }}>
            {[
              { id: "tournaments", label: "Турниры" },
              { id: "tours", label: "Туры" },
              { id: "matches", label: "Матчи" },
              { id: "stats", label: "Статистика" },
              { id: "videos", label: "Видео" },
              { id: "users", label: "Пользователи" },
              { id: "teams", label: "Команды" },
              { id: "predictions", label: "Прогнозы" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "10px 16px", borderRadius: "20px", border: "none",
                background: tab === t.id ? "#3b82f6" : colors.gray,
                color: tab === t.id ? "white" : colors.text,
                fontWeight: 600, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
              }}>{t.label}</button>
            ))}
          </div>

          {/* Tournaments tab */}
          {tab === "tournaments" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Турниры ({tournaments.length})</h3>
                <Button onClick={() => { setEditingTournament("new"); setTournamentData({ name: "", category: "men", season: "" }); }} style={{ padding: "8px 16px", fontSize: "13px" }}>
                  + Новый турнир
                </Button>
              </div>
              {editingTournament && (
                <Card style={{ marginBottom: "16px", background: "#f9f9f9" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "14px" }}>{editingTournament === "new" ? "Новый турнир" : "Редактировать турнир"}</h4>
                  <Input label="Название" value={tournamentData.name} onChange={v => setTournamentData(p => ({ ...p, name: v }))} placeholder="Кубок МТК" />
                  <Select label="Категория" value={tournamentData.category} onChange={v => setTournamentData(p => ({ ...p, category: v }))} options={[{ value: "men", label: "Мужчины" }, { value: "women", label: "Женщины" }, { value: "youth", label: "Юноши" }]} />
                  <Input label="Сезон" value={tournamentData.season} onChange={v => setTournamentData(p => ({ ...p, season: v }))} placeholder="2025/2026" />
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <Button onClick={async () => {
                      if (!tournamentData.name) { alert("Укажите название"); return; }
                      if (editingTournament === "new") {
                        await onCreateTournament(tournamentData);
                      } else {
                        await onUpdateTournament(editingTournament, tournamentData);
                      }
                      setEditingTournament(null);
                    }} style={{ flex: 1, padding: "10px" }}>
                      <Icons.Save /> {editingTournament === "new" ? "Создать" : "Сохранить"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingTournament(null)} style={{ padding: "10px" }}>Отмена</Button>
                  </div>
                </Card>
              )}
              {(tournaments || []).map(t => (
                <Card key={t.id} style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "15px" }}>{t.name}</div>
                      <div style={{ fontSize: "12px", color: colors.goldDark }}>
                        {t.category === "men" ? "Мужчины" : t.category === "women" ? "Женщины" : "Юноши"} • {t.season || "—"} • {t.is_active ? "Активен" : "Архив"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button variant="outline" onClick={() => { setEditingTournament(t.id); setTournamentData({ name: t.name, category: t.category, season: t.season || "" }); }} style={{ padding: "6px 12px", fontSize: "12px" }}>
                        <Icons.Edit />
                      </Button>
                      <Button variant="outline" onClick={() => onDeleteTournament(t.id)} style={{ padding: "6px 12px", fontSize: "12px", color: "#dc2626" }}>
                        <Icons.Trash />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}

          {/* Tours tab */}
          {tab === "tours" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Туры ({tours.length})</h3>
                <Button onClick={() => setShowCreateTour(true)} style={{ padding: "8px 16px", fontSize: "13px" }}>
                  <Icons.Plus /> Создать тур
                </Button>
              </div>

              {showCreateTour && (
                <Card style={{ marginBottom: "16px", background: "#f0fdf4", border: "2px solid #16a34a" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#16a34a" }}>Новый тур</h4>
                  <Select label="Турнир" value={newTour.tournament_id} onChange={v => setNewTour(p => ({ ...p, tournament_id: v }))} options={[{ value: "", label: "Выберите турнир" }, ...(tournaments || []).map(t => ({ value: t.id, label: t.name }))]} />
                  <Input label="Номер тура" type="number" value={newTour.number} onChange={v => setNewTour(p => ({ ...p, number: v }))} placeholder="1" />
                  <Input label="Название (необязательно)" value={newTour.name} onChange={v => setNewTour(p => ({ ...p, name: v }))} placeholder="Тур 1 / Финал / Полуфинал" />
                  <Input label="Дата" type="date" value={newTour.date} onChange={v => setNewTour(p => ({ ...p, date: v }))} />
                  <Input label="Место проведения" value={newTour.location} onChange={v => setNewTour(p => ({ ...p, location: v }))} placeholder="СК Олимп" />
                  <Input label="Адрес" value={newTour.address} onChange={v => setNewTour(p => ({ ...p, address: v }))} placeholder="ул. Спортивная, 1" />
                  <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                    <Button onClick={localCreateTour} disabled={actionLoading || !newTour.number || !newTour.date} style={{ flex: 1, padding: "10px" }}>
                      <Icons.Save /> Создать
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateTour(false)} style={{ flex: 1, padding: "10px" }}>
                      Отмена
                    </Button>
                  </div>
                </Card>
              )}

              {(tours || []).sort((a, b) => {
                const now = new Date();
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                const isPastA = dateA < now;
                const isPastB = dateB < now;
                // Будущие туры сверху, отсортированные по дате (ближайший первый)
                if (!isPastA && !isPastB) return dateA - dateB;
                // Прошедшие туры внизу, отсортированные по дате (недавний первый)
                if (isPastA && isPastB) return dateB - dateA;
                // Будущие выше прошедших
                return isPastA ? 1 : -1;
              }).map(tour => (
                <Card key={tour.id} style={{ marginBottom: "8px", padding: "12px" }}>
                  {editingTour?.id === tour.id ? (
                    <div>
                      <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Редактирование тура</h4>
                      <Select label="Турнир" value={tourData.tournament_id} onChange={v => setTourData(p => ({ ...p, tournament_id: v }))} options={[{ value: "", label: "Без турнира" }, ...(tournaments || []).map(t => ({ value: t.id, label: t.name }))]} />
                      <Input label="Номер тура" type="number" value={tourData.number} onChange={v => setTourData(p => ({ ...p, number: v }))} />
                      <Input label="Название" value={tourData.name || ""} onChange={v => setTourData(p => ({ ...p, name: v }))} placeholder="Тур 1 / Финал" />
                      <Input label="Дата" type="date" value={tourData.date} onChange={v => setTourData(p => ({ ...p, date: v }))} />
                      <Input label="Место" value={tourData.location} onChange={v => setTourData(p => ({ ...p, location: v }))} />
                      <Input label="Адрес" value={tourData.address} onChange={v => setTourData(p => ({ ...p, address: v }))} />
                      <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                        <Button onClick={async () => {
                          await onUpdateTour(tour.id, tourData);
                          setEditingTour(null);
                        }} style={{ flex: 1 }}>
                          <Icons.Save /> Сохранить
                        </Button>
                        <Button variant="outline" onClick={() => setEditingTour(null)} style={{ flex: 1 }}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "40px", height: "40px", background: colors.goldLight, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: colors.goldDark }}>
                        {tour.number}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{tour.name || `Тур ${tour.number}`}</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark }}>
                          {new Date(tour.date).toLocaleDateString("ru-RU")} • {tour.location}
                        </div>
                        <div style={{ fontSize: "11px", color: colors.goldDark }}>{tour.address}</div>
                        {tournaments?.find(t => t.id === tour.tournament_id) && (
                          <div style={{ fontSize: "11px", color: colors.gold, marginTop: "2px" }}>{tournaments.find(t => t.id === tour.tournament_id).name}</div>
                        )}
                      </div>
                      <Badge>{(matches || []).filter(m => m.tour_id === tour.id).length} матчей</Badge>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button onClick={() => {
                          setEditingTour(tour);
                          setTourData({ number: tour.number, name: tour.name || "", date: tour.date, location: tour.location, address: tour.address, tournament_id: tour.tournament_id || "" });
                        }} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }}>
                          <Icons.Edit />
                        </button>
                        <button onClick={() => onDeleteTour(tour.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }}>
                          <Icons.X />
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </>
          )}

          {/* Matches tab */}
          {tab === "matches" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Матчи</h3>
                <Button onClick={() => setShowCreateMatch(true)} style={{ padding: "8px 16px", fontSize: "13px" }}>
                  <Icons.Plus /> Создать матч
                </Button>
              </div>

              {showCreateMatch && (
                <Card style={{ marginBottom: "16px", background: "#f0fdf4", border: "2px solid #16a34a" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#16a34a" }}>Новый матч</h4>
                  <Select label="Тур" value={newMatch.tour_id} onChange={v => setNewMatch(p => ({ ...p, tour_id: v }))}
                    options={[{ value: "", label: "Выберите тур" }, ...(tours || []).map(t => ({ value: t.id, label: `Тур ${t.number} — ${new Date(t.date).toLocaleDateString("ru-RU")}` }))]}
                  />
                  <Select label="Команда 1" value={newMatch.team1_id} onChange={v => setNewMatch(p => ({ ...p, team1_id: v }))}
                    options={[{ value: "", label: "Выберите команду" }, ...(teams || []).map(t => ({ value: t.id, label: t.name }))]}
                  />
                  <Select label="Команда 2" value={newMatch.team2_id} onChange={v => setNewMatch(p => ({ ...p, team2_id: v }))}
                    options={[{ value: "", label: "Выберите команду" }, ...(teams || []).filter(t => t.id !== newMatch.team1_id).map(t => ({ value: t.id, label: t.name }))]}
                  />
                  <Input label="Время начала" type="datetime-local" value={newMatch.scheduled_time} onChange={v => setNewMatch(p => ({ ...p, scheduled_time: v }))} />
                  <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                    <Button onClick={localCreateMatch} disabled={actionLoading || !newMatch.tour_id || !newMatch.team1_id || !newMatch.team2_id || !newMatch.scheduled_time} style={{ flex: 1, padding: "10px" }}>
                      <Icons.Save /> Создать
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateMatch(false)} style={{ flex: 1, padding: "10px" }}>
                      Отмена
                    </Button>
                  </div>
                </Card>
              )}

              {(tours || []).sort((a, b) => {
                const now = new Date();
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                const isPastA = dateA < now;
                const isPastB = dateB < now;
                if (!isPastA && !isPastB) return dateA - dateB;
                if (isPastA && isPastB) return dateB - dateA;
                return isPastA ? 1 : -1;
              }).map(tour => {
                const tourMatches = (matches || [])
                  .filter(m => m.tour_id === tour.id)
                  .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
                if (tourMatches.length === 0) return null;
                return (
                  <div key={tour.id} style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>
                      Тур {tour.number} — {new Date(tour.date).toLocaleDateString("ru-RU")}
                    </div>
                    {tourMatches.map(match => {
                      const team1 = teams.find(t => t.id === match.team1_id);
                      const team2 = teams.find(t => t.id === match.team2_id);
                      const isEditing = editingMatch?.id === match.id;
                      
                      return (
                        <Card key={match.id} style={{ marginBottom: "8px", padding: "12px" }}>
                          {isEditing ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px", textAlign: "center" }}>
                                {team1?.name} vs {team2?.name}
                              </div>
                              <div style={{ fontSize: "12px", color: colors.goldDark, marginBottom: "8px" }}>Введите счёт по сетам:</div>
                              {[1,2,3,4,5].map(setNum => (
                                <div key={setNum} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                  <span style={{ width: "50px", fontSize: "13px", color: colors.goldDark }}>Сет {setNum}</span>
                                  <input 
                                    type="text" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={matchScore[`set${setNum}_team1`] ?? ""}
                                    onChange={e => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      setMatchScore(prev => ({ ...prev, [`set${setNum}_team1`]: val === "" ? "" : parseInt(val) }));
                                    }}
                                    style={{ width: "60px", padding: "8px", textAlign: "center", borderRadius: "6px", border: `1px solid ${colors.grayBorder}` }}
                                  />
                                  <span>:</span>
                                  <input 
                                    type="text" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={matchScore[`set${setNum}_team2`] ?? ""}
                                    onChange={e => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      setMatchScore(prev => ({ ...prev, [`set${setNum}_team2`]: val === "" ? "" : parseInt(val) }));
                                    }}
                                    style={{ width: "60px", padding: "8px", textAlign: "center", borderRadius: "6px", border: `1px solid ${colors.grayBorder}` }}
                                  />
                                </div>
                              ))}
                              <div style={{ background: colors.gray, padding: "8px 12px", borderRadius: "6px", marginTop: "12px", fontSize: "13px" }}>
                                <strong>Итог:</strong> {
                                  [1,2,3,4,5].reduce((acc, n) => acc + (matchScore[`set${n}_team1`] > matchScore[`set${n}_team2`] ? 1 : 0), 0)
                                } : {
                                  [1,2,3,4,5].reduce((acc, n) => acc + (matchScore[`set${n}_team2`] > matchScore[`set${n}_team1`] ? 1 : 0), 0)
                                } (сеты) | Мячи: {
                                  [1,2,3,4,5].reduce((acc, n) => acc + (matchScore[`set${n}_team1`] || 0), 0)
                                }:{
                                  [1,2,3,4,5].reduce((acc, n) => acc + (matchScore[`set${n}_team2`] || 0), 0)
                                }
                              </div>
                              <Select label="Статус" value={matchScore.status} onChange={v => setMatchScore(prev => ({ ...prev, status: v }))}
                                options={[
                                  { value: "upcoming", label: "Предстоит" },
                                  { value: "live", label: "Live" },
                                  { value: "finished", label: "Завершён" },
                                ]}
                              />
                              <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                                <Button onClick={saveMatch} disabled={actionLoading} style={{ flex: 1, padding: "10px" }}>
                                  <Icons.Save /> Сохранить
                                </Button>
                                <Button variant="outline" onClick={() => setEditingMatch(null)} style={{ flex: 1, padding: "10px" }}>
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : editingMatchInfo?.id === match.id ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px", textAlign: "center" }}>
                                Редактирование матча
                              </div>
                              <Select 
                                label="Тур" 
                                value={matchInfo.tour_id} 
                                onChange={v => setMatchInfo(p => ({ ...p, tour_id: v }))}
                                options={[
                                  { value: "", label: "Выберите тур" },
                                  ...(tours || []).map(t => ({ value: t.id, label: `Тур ${t.number} — ${t.date}` }))
                                ]}
                              />
                              <Select 
                                label="Команда 1" 
                                value={matchInfo.team1_id} 
                                onChange={v => setMatchInfo(p => ({ ...p, team1_id: v }))}
                                options={[
                                  { value: "", label: "Выберите команду" },
                                  ...(teams || []).map(t => ({ value: t.id, label: t.name }))
                                ]}
                              />
                              <Select 
                                label="Команда 2" 
                                value={matchInfo.team2_id} 
                                onChange={v => setMatchInfo(p => ({ ...p, team2_id: v }))}
                                options={[
                                  { value: "", label: "Выберите команду" },
                                  ...(teams || []).filter(t => t.id !== matchInfo.team1_id).map(t => ({ value: t.id, label: t.name }))
                                ]}
                              />
                              <Input 
                                label="Дата и время" 
                                type="datetime-local" 
                                value={matchInfo.scheduled_time} 
                                onChange={v => setMatchInfo(p => ({ ...p, scheduled_time: v }))} 
                              />
                              <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                                <Button 
                                  onClick={async () => {
                                    await onUpdateMatchInfo(editingMatchInfo.id, matchInfo);
                                    setEditingMatchInfo(null);
                                  }} 
                                  disabled={actionLoading || !matchInfo.tour_id || !matchInfo.team1_id || !matchInfo.team2_id} 
                                  style={{ flex: 1, padding: "10px" }}
                                >
                                  <Icons.Save /> Сохранить
                                </Button>
                                <Button 
                                  variant="outline" 
                                  onClick={() => setEditingMatchInfo(null)} 
                                  style={{ flex: 1, padding: "10px" }}
                                >
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {/* Первая строка: команды и счёт */}
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                <span style={{ flex: 1, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team1?.name}</span>
                                <span style={{ fontWeight: 700, fontSize: "16px", padding: "4px 12px", background: colors.gray, borderRadius: "6px", flexShrink: 0 }}>
                                  {match.sets_team1 || 0} : {match.sets_team2 || 0}
                                </span>
                                <span style={{ flex: 1, fontSize: "14px", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team2?.name}</span>
                              </div>
                              {/* Вторая строка: статус и кнопки */}
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <Badge variant={match.status === "finished" ? "default" : match.status === "live" ? "live" : "gold"}>
                                  {match.status === "finished" ? "✓" : match.status === "live" ? "LIVE" : "○"}
                                </Badge>
                                {match.status === "upcoming" && (
                                  <button 
                                  onClick={() => { 
                                    sendNotification("hour_before", team1?.name, team2?.name);
                                    alert("Уведомление отправлено!");
                                  }} 
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#d97706", padding: "4px", fontSize: "16px" }}
                                  title="Отправить напоминание"
                                >
                                  🔔
                                </button>
                              )}
                              <button onClick={() => startEditMatch(match)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }} title="Редактировать результат">
                                <Icons.Edit />
                              </button>
                              <button onClick={() => {
                                setEditingMatchInfo(match);
                                // Конвертируем ISO формат в datetime-local формат
                                const localTime = match.scheduled_time ? match.scheduled_time.slice(0, 16) : "";
                                setMatchInfo({ 
                                  tour_id: match.tour_id, 
                                  team1_id: match.team1_id, 
                                  team2_id: match.team2_id, 
                                  scheduled_time: localTime
                                });
                              }} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", padding: "4px" }} title="Редактировать информацию">
                                ⚙️
                              </button>
                              <button onClick={() => onStartServiceman(match)} style={{ background: "#16a34a", border: "none", cursor: "pointer", color: "white", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }} title="Вести статистику">📊</button>
                              <button onClick={() => onDeleteMatch(match.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }} title="Удалить матч">
                                <Icons.X />
                              </button>
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          
          {/* Stats tab */}
          {tab === "stats" && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Статистика игроков по матчам</h3>
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "16px" }}>
                Выберите матч и введите статистику для каждого игрока
              </p>
              
              {(tours || []).sort((a, b) => {
                const now = new Date();
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                const isPastA = dateA < now;
                const isPastB = dateB < now;
                if (!isPastA && !isPastB) return dateA - dateB;
                if (isPastA && isPastB) return dateB - dateA;
                return isPastA ? 1 : -1;
              }).map(tour => {
                const tourMatches = (matches || [])
                  .filter(m => m.tour_id === tour.id && m.status === "finished")
                  .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
                if (tourMatches.length === 0) return null;
                return (
                  <div key={tour.id} style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>
                      Тур {tour.number}
                    </div>
                    {tourMatches.map(match => {
                      const team1 = teams.find(t => t.id === match.team1_id);
                      const team2 = teams.find(t => t.id === match.team2_id);
                      const team1Players = (players || []).filter(p => p.team_id === match.team1_id);
                      const team2Players = (players || []).filter(p => p.team_id === match.team2_id);
                      const isExpanded = expandedMatch === match.id;
                      
                      return (
                        <Card key={match.id} style={{ marginBottom: "8px", padding: "12px" }}>
                          <div 
                            style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                            onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                          >
                            <span style={{ flex: 1, fontSize: "14px", fontWeight: 600 }}>
                              {team1?.name} {match.sets_team1}:{match.sets_team2} {team2?.name}
                            </span>
                            <span style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                              <Icons.ChevronRight />
                            </span>
                          </div>
                          
                          {isExpanded && (
                            <div style={{ marginTop: "16px", borderTop: `1px solid ${colors.grayBorder}`, paddingTop: "16px" }}>
                              {/* Team 1 */}
                              <div style={{ marginBottom: "16px" }}>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: colors.gold, marginBottom: "8px" }}>{team1?.name}</div>
                                {team1Players.map(player => {
                                  const existingStat = playerStats.find(s => s.player_id === player.id && s.match_id === match.id);
                                  return (
                                    <PlayerStatInput 
                                      key={player.id}
                                      player={player}
                                      matchId={match.id}
                                      existingStat={existingStat}
                                      onSave={onSavePlayerStat}
                                    />
                                  );
                                })}
                              </div>
                              {/* Team 2 */}
                              <div>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: colors.gold, marginBottom: "8px" }}>{team2?.name}</div>
                                {team2Players.map(player => {
                                  const existingStat = playerStats.find(s => s.player_id === player.id && s.match_id === match.id);
                                  return (
                                    <PlayerStatInput 
                                      key={player.id}
                                      player={player}
                                      matchId={match.id}
                                      existingStat={existingStat}
                                      onSave={onSavePlayerStat}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

{/* Videos tab */}
          {tab === "videos" && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Управление трансляциями и записями</h3>
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "16px" }}>
                Добавьте ссылки на трансляции (YouTube, VK, Rutube) и записи матчей
              </p>
              
              {(tours || []).sort((a, b) => {
                const now = new Date();
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                const isPastA = dateA < now;
                const isPastB = dateB < now;
                if (!isPastA && !isPastB) return dateA - dateB;
                if (isPastA && isPastB) return dateB - dateA;
                return isPastA ? 1 : -1;
              }).map(tour => {
                const tourMatches = (matches || [])
                  .filter(m => m.tour_id === tour.id)
                  .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
                if (tourMatches.length === 0) return null;
                return (
                  <div key={tour.id} style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>
                      Тур {tour.number}
                    </div>
                    {tourMatches.map(match => {
                      const team1 = teams.find(t => t.id === match.team1_id);
                      const team2 = teams.find(t => t.id === match.team2_id);
                      const isEditing = editingVideo?.id === match.id;
                      
                      return (
                        <Card key={match.id} style={{ marginBottom: "8px", padding: "12px" }}>
                          {isEditing ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px" }}>
                                {team1?.name} vs {team2?.name}
                              </div>
                              <Input 
                                label="Ссылка на трансляцию (Live)" 
                                value={videoData.stream_url} 
                                onChange={v => setVideoData(p => ({ ...p, stream_url: v }))} 
                                placeholder="https://youtube.com/watch?v=..."
                              />
                              <Input 
                                label="Ссылка на запись" 
                                value={videoData.video_url} 
                                onChange={v => setVideoData(p => ({ ...p, video_url: v }))} 
                                placeholder="https://youtube.com/watch?v=..."
                              />
                              <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                                <Button onClick={saveVideo} disabled={actionLoading} style={{ flex: 1, padding: "10px" }}>
                                  <Icons.Save /> Сохранить
                                </Button>
                                <Button variant="outline" onClick={() => setEditingVideo(null)} style={{ flex: 1, padding: "10px" }}>
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                <span style={{ fontWeight: 600, fontSize: "14px", flex: 1 }}>
                                  {team1?.name} vs {team2?.name}
                                </span>
                                <Badge variant={match.status === "finished" ? "default" : match.status === "live" ? "live" : "gold"}>
                                  {match.status === "finished" ? "Завершён" : match.status === "live" ? "LIVE" : "Предстоит"}
                                </Badge>
                              </div>
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                                {match.stream_url ? (
                                  <Badge variant="live">📺 Трансляция</Badge>
                                ) : (
                                  <Badge variant="default">Нет трансляции</Badge>
                                )}
                                {match.video_url ? (
                                  <Badge variant="free">📹 Запись</Badge>
                                ) : (
                                  <Badge variant="default">Нет записи</Badge>
                                )}
                              </div>
                              <Button variant="outline" onClick={() => startEditVideo(match)} style={{ width: "100%", padding: "8px", fontSize: "13px" }}>
                                <Icons.Video /> Редактировать видео
                              </Button>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* Users tab - ИСПРАВЛЕННЫЙ */}
          {tab === "users" && (
            <>
              {/* Заявки на роль */}
              {(roleRequests || []).filter(r => r.status === "pending").length > 0 && (
                <Card style={{ marginBottom: "20px", background: "#fef3c7", border: "1px solid #f59e0b" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px", color: "#92400e" }}>
                    📋 Заявки на роль ({(roleRequests || []).filter(r => r.status === "pending").length})
                  </h3>
                  {(roleRequests || []).filter(r => r.status === "pending").map(request => {
                    const requestUser = users.find(u => u.id === request.user_id);
                    const positionLabels = {
                      setter: "Связующий",
                      outside: "Доигровщик", 
                      opposite: "Диагональный",
                      middle: "Центральный блокирующий",
                      libero: "Либеро"
                    };
                    return (
                      <div key={request.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "white", borderRadius: "8px", marginBottom: "8px" }}>
                        <Avatar name={requestUser?.first_name || requestUser?.username} size={40} url={requestUser?.avatar_url} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>
                            {request.first_name && request.last_name 
                              ? `${request.first_name} ${request.last_name}` 
                              : (requestUser?.first_name || requestUser?.username) + (requestUser?.last_name ? ` ${requestUser.last_name}` : "")}
                            {request.first_name && <span style={{ fontSize: "11px", color: "#16a34a", marginLeft: "6px" }}>✓ Указал имя</span>}
                          </div>
                          <div style={{ fontSize: "12px", color: colors.goldDark }}>
                            Хочет стать: <strong>{request.requested_role === "player" ? "Игроком" : request.requested_role === "coach" ? "Тренером" : "Болельщиком"}</strong>
                          </div>
                          {request.positions && request.positions.length > 0 && (
                            <div style={{ fontSize: "11px", color: colors.goldDark, marginTop: "4px" }}>
                              Амплуа: <strong>{request.positions.map(p => positionLabels[p] || p).join(", ")}</strong>
                            </div>
                          )}
                          {request.team_name && (
                            <div style={{ fontSize: "11px", color: "#2563eb", marginTop: "4px" }}>
                              🏐 Команда: <strong>{request.team_name}</strong>
                            </div>
                          )}
                          <div style={{ fontSize: "11px", color: colors.goldDark }}>
                            {new Date(request.created_at).toLocaleDateString("ru-RU")}
                          </div>
                        </div>
                        {requestUser?.username && (
                          <button 
                            onClick={() => window.open(`https://t.me/${requestUser.username}`, '_blank')}
                            style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", cursor: "pointer" }}
                          >
                            💬 Написать
                          </button>
                        )}
                        <button 
                          onClick={() => onApproveRequest(request.id, request.user_id, request.requested_role)}
                          disabled={actionLoading}
                          style={{ background: "#16a34a", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
                        >
                          ✓ Одобрить
                        </button>
                        <button 
                          onClick={() => onRejectRequest(request.id)}
                          disabled={actionLoading}
                          style={{ background: "#dc2626", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </Card>
              )}
              
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Управление пользователями ({users.length})</h3>
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "12px" }}>
                Роли вычисляются автоматически: Тренер — если назначен на команду, Капитан — если отмечен в составе, Игрок — если есть в players
              </p>
              
              {/* Поиск пользователей */}
              <div style={{ marginBottom: "16px" }}>
                <Input 
                  label="Поиск"
                  value={userSearchQuery}
                  onChange={setUserSearchQuery}
                  placeholder="Введите имя или фамилию..."
                />
              </div>
              
              {users.filter(u => {
                if (!userSearchQuery) return true;
                const query = userSearchQuery.toLowerCase();
                const fullName = `${u.first_name || ""} ${u.last_name || ""} ${u.username || ""}`.toLowerCase();
                return fullName.includes(query);
              }).map(u => {
                const isEditing = editingUser?.id === u.id;
                const userPlayerRecord = players.find(p => p.user_id === u.id);
                const userCoachTeam = teams.find(t => t.coach_id === u.id);
                const hasCoachRequest = (roleRequests || []).some(r => r.user_id === u.id && r.requested_role === "coach" && r.status === "approved");
                
                // Вычисляем все роли пользователя (как это делает getUserRoles)
                const displayRoles = [];
                if (u.role === "admin") displayRoles.push({ label: "Админ", variant: "admin" });
                if (u.is_serviceman) displayRoles.push({ label: "Сервисмен", variant: "serviceman" });
                // Тренер если: назначен на команду ИЛИ есть одобренная заявка
                if (userCoachTeam) {
                  displayRoles.push({ label: `Тренер (${userCoachTeam.name})`, variant: "gold" });
                } else if (hasCoachRequest) {
                  displayRoles.push({ label: "Тренер (не назначен)", variant: "gold" });
                }
                if (userPlayerRecord?.is_captain) displayRoles.push({ label: "Капитан", variant: "captain" });
                if (userPlayerRecord) displayRoles.push({ label: "Игрок", variant: "free" });
                if (displayRoles.length === 0) displayRoles.push({ label: "Болельщик", variant: "default" });
                
                return (
                  <Card key={u.id} style={{ marginBottom: "8px", padding: "12px" }}>
                    {isEditing ? (
                      <div>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
                          {displayRoles.map((role, i) => (
                            <Badge key={i} variant={role.variant}>{role.label}</Badge>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
                          <Input 
                            label="Имя" 
                            value={userFirstName} 
                            onChange={setUserFirstName}
                            placeholder="Имя"
                            style={{ flex: 1 }}
                          />
                          <Input 
                            label="Фамилия" 
                            value={userLastName} 
                            onChange={setUserLastName}
                            placeholder="Фамилия"
                            style={{ flex: 1 }}
                          />
                        </div>
                        <Select label="Права" value={userRole === "admin" ? "admin" : (isServiceman ? "serviceman" : "fan")} onChange={(val) => {
                            if (val === "admin") { setUserRole("admin"); setIsServiceman(false); }
                            else if (val === "serviceman") { setUserRole("fan"); setIsServiceman(true); }
                            else { setUserRole("fan"); setIsServiceman(false); }
                          }}
                          options={[
                            { value: "fan", label: "Обычный пользователь" },
                            { value: "serviceman", label: "Сервисмен" },
                            { value: "admin", label: "Администратор" },
                          ]}
                        />
                        <Select label="Роль" value={gameRole} onChange={setGameRole}
                          options={[
                            { value: "fan", label: "Болельщик" },
                            { value: "player", label: "Игрок" },
                            { value: "coach", label: "Тренер" },
                          ]}
                        />
                        
                        {/* Рост, прыжок, дата замера */}
                        <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "12px", color: colors.goldDark, display: "block", marginBottom: "4px" }}>Рост (см)</label>
                            <input type="number" min="100" max="250" value={userHeight} onChange={e => setUserHeight(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: `1px solid ${colors.grayBorder}` }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "12px", color: colors.goldDark, display: "block", marginBottom: "4px" }}>Прыжок (см)</label>
                            <input type="number" min="0" max="150" value={userJumpHeight} onChange={e => setUserJumpHeight(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: `1px solid ${colors.grayBorder}` }} />
                          </div>
                        </div>
                        <div style={{ marginTop: "8px" }}>
                          <label style={{ fontSize: "12px", color: colors.goldDark, display: "block", marginBottom: "4px" }}>Дата замера</label>
                          <input type="date" value={userMeasurementDate} onChange={e => setUserMeasurementDate(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: `1px solid ${colors.grayBorder}` }} />
                        </div>
                        
                        {/* Фото пользователя */}
                        <div style={{ marginTop: "12px" }}>
                          <label style={{ fontSize: "12px", color: colors.goldDark, display: "block", marginBottom: "4px" }}>Фото</label>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                            {editingUser?.avatar_url && (
                              <div style={{ position: "relative" }}>
                                <img src={editingUser.avatar_url} alt="" style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover" }} />
                                <button onClick={async () => {
                                  if (!confirm("Удалить фото?")) return;
                                  await supabase.from('users').update({ avatar_url: null }).eq('id', editingUser.id);
                                  alert('Фото удалено');
                                  loadData();
                                }} style={{ position: "absolute", top: "-5px", right: "-5px", width: "20px", height: "20px", borderRadius: "50%", background: "#dc2626", color: "white", border: "none", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                              </div>
                            )}
                            <input type="file" accept="image/*" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file || !editingUser) return;
                              try {
                                const fileName = `user_${editingUser.id}_${Date.now()}.${file.name.split('.').pop()}`;
                                const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
                                if (uploadError) throw uploadError;
                                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
                                const publicUrl = urlData?.publicUrl;
                                if (!publicUrl) throw new Error('Не удалось получить URL');
                                await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', editingUser.id);
                                alert('Фото загружено!');
                                loadData();
                              } catch (err) {
                                console.error('Upload error:', err);
                                alert('Ошибка загрузки: ' + (err.message || JSON.stringify(err)));
                              }
                            }} style={{ fontSize: "12px" }} />
                          </div>
                        </div>
                        
                        {false && (
                          <Button 
                            onClick={() => onMakePlayer(u.id)} 
                            disabled={actionLoading}
                            style={{ width: "100%", marginBottom: "8px", background: "#16a34a" }}
                          >
                            🏐 Сделать игроком (свободный агент)
                          </Button>
                        )}

                        <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                          <Button onClick={saveUser} disabled={actionLoading} style={{ flex: 1, padding: "10px" }}>
                            <Icons.Save /> Сохранить
                          </Button>
                          <Button variant="outline" onClick={() => setEditingUser(null)} style={{ flex: 1, padding: "10px" }}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <Avatar name={u.first_name || u.username} size={40} url={u.avatar_url} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "14px" }}>{u.first_name || "—"} {u.last_name || ""}</div>
                          <div style={{ fontSize: "12px", color: colors.goldDark }}>@{u.username || "—"}</div>
                          {u.created_at && (
                            <div style={{ fontSize: "11px", color: colors.goldDark, marginTop: "2px" }}>
                              Регистрация: {new Date(u.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxWidth: "200px", justifyContent: "flex-end" }}>
                          {displayRoles.map((role, i) => (
                            <Badge key={i} variant={role.variant}>{role.label}</Badge>
                          ))}
                        </div>
                        <button onClick={() => startEditUser(u)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }}>
                          <Icons.Edit />
                        </button>
                        <button onClick={() => onDeleteUser(u.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }}>
                          <Icons.X />
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}

          {/* Teams tab - ИСПРАВЛЕННЫЙ */}
          {tab === "teams" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Управление командами ({teams.length})</h3>
                <Button onClick={() => setShowCreateTeam(true)} style={{ padding: "8px 16px", fontSize: "13px" }}>
                  <Icons.Plus /> Создать команду
                </Button>
              </div>
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "16px" }}>
                Создавайте команды, назначайте тренеров и редактируйте информацию.
              </p>

              {showCreateTeam && (
                <Card style={{ marginBottom: "16px", background: "#f0fdf4", border: "2px solid #16a34a" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#16a34a" }}>Новая команда</h4>
                  <Input 
                    label="Название команды" 
                    value={newTeam.name} 
                    onChange={v => setNewTeam(p => ({ ...p, name: v }))} 
                    placeholder="Например: Амур Rockets"
                  />
                  
                  <div style={{ marginTop: "12px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 500, color: colors.text, display: "block", marginBottom: "6px" }}>
                      Логотип команды
                    </label>
                    
                    {newTeam.logo_url && (
                      <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                        {newTeam.logo_url.startsWith('http') ? (
                          <img src={newTeam.logo_url} alt="Логотип" style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px" }} />
                        ) : (
                          <div style={{ width: "60px", height: "60px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", background: colors.goldLight, borderRadius: "8px" }}>
                            {newTeam.logo_url}
                          </div>
                        )}
                        <button 
                          onClick={() => setNewTeam(p => ({ ...p, logo_url: "" }))}
                          style={{ padding: "4px 8px", fontSize: "12px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "4px", cursor: "pointer" }}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                    
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <input 
                        type="file" 
                        accept="image/*"
                        id="new-team-logo-upload"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleUploadTeamLogo(file);
                            if (url) {
                              setNewTeam(p => ({ ...p, logo_url: url }));
                            }
                          }
                        }}
                      />
                      <label 
                        htmlFor="new-team-logo-upload"
                        style={{ 
                          padding: "8px 12px", 
                          fontSize: "13px", 
                          background: colors.gold, 
                          color: "white", 
                          borderRadius: "6px", 
                          cursor: uploadingLogo ? "not-allowed" : "pointer",
                          opacity: uploadingLogo ? 0.5 : 1,
                          display: "inline-block"
                        }}
                      >
                        {uploadingLogo ? "Загрузка..." : "📁 Загрузить изображение"}
                      </label>
                      
                      <span style={{ fontSize: "12px", color: colors.goldDark }}>или</span>
                      
                      <Input 
                        value={newTeam.logo_url.startsWith('http') ? '' : newTeam.logo_url} 
                        onChange={v => setNewTeam(p => ({ ...p, logo_url: v }))} 
                        placeholder="🏐 введите эмодзи"
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "6px", marginTop: "16px" }}>
                    <Button 
                      onClick={async () => {
                        if (!newTeam.name.trim()) {
                          alert("Введите название команды");
                          return;
                        }
                        await onCreateTeam(newTeam);
                        setNewTeam({ name: "", logo_url: "" });
                        setShowCreateTeam(false);
                      }} 
                      disabled={actionLoading || uploadingLogo || !newTeam.name.trim()} 
                      style={{ flex: 1, padding: "10px" }}
                    >
                      <Icons.Save /> Создать
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setNewTeam({ name: "", logo_url: "" });
                        setShowCreateTeam(false);
                      }} 
                      style={{ flex: 1, padding: "10px" }}
                    >
                      Отмена
                    </Button>
                  </div>
                </Card>
              )}
              {teams.map(team => {
                const coach = users.find(u => u.id === team.coach_id);
                const isEditing = editingTeam?.id === team.id;
                const isExpanded = expandedTeam === team.id;
                const teamPlayers = (players || []).filter(p => p.team_id === team.id);
                
                return (
                  <Card key={team.id} style={{ marginBottom: "8px", padding: "12px" }}>
                    {editingTeamInfo?.id === team.id ? (
                      <div>
                        <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600 }}>Редактирование информации</h4>
                        <Input 
                          label="Название команды" 
                          value={teamInfo.name} 
                          onChange={v => setTeamInfo(p => ({ ...p, name: v }))} 
                        />
                        
                        <div style={{ marginTop: "12px" }}>
                          <label style={{ fontSize: "13px", fontWeight: 500, color: colors.text, display: "block", marginBottom: "6px" }}>
                            Логотип команды
                          </label>
                          
                          {teamInfo.logo_url && (
                            <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                              {teamInfo.logo_url.startsWith('http') ? (
                                <img src={teamInfo.logo_url} alt="Логотип" style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px" }} />
                              ) : (
                                <div style={{ width: "60px", height: "60px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", background: colors.goldLight, borderRadius: "8px" }}>
                                  {teamInfo.logo_url}
                                </div>
                              )}
                              <button 
                                onClick={() => setTeamInfo(p => ({ ...p, logo_url: "" }))}
                                style={{ padding: "4px 8px", fontSize: "12px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "4px", cursor: "pointer" }}
                              >
                                Удалить
                              </button>
                            </div>
                          )}
                          
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <input 
                              type="file" 
                              accept="image/*"
                              id={`edit-team-logo-${team.id}`}
                              style={{ display: "none" }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const url = await handleUploadTeamLogo(file);
                                  if (url) {
                                    setTeamInfo(p => ({ ...p, logo_url: url }));
                                  }
                                }
                              }}
                            />
                            <label 
                              htmlFor={`edit-team-logo-${team.id}`}
                              style={{ 
                                padding: "8px 12px", 
                                fontSize: "13px", 
                                background: colors.gold, 
                                color: "white", 
                                borderRadius: "6px", 
                                cursor: uploadingLogo ? "not-allowed" : "pointer",
                                opacity: uploadingLogo ? 0.5 : 1,
                                display: "inline-block"
                              }}
                            >
                              {uploadingLogo ? "Загрузка..." : "📁 Загрузить"}
                            </label>
                            
                            <span style={{ fontSize: "12px", color: colors.goldDark }}>или</span>
                            
                            <Input 
                              value={teamInfo.logo_url.startsWith('http') ? '' : teamInfo.logo_url} 
                              onChange={v => setTeamInfo(p => ({ ...p, logo_url: v }))} 
                              placeholder="🏐 эмодзи"
                              style={{ flex: 1 }}
                            />
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                          <Button 
                            onClick={async () => {
                              if (!teamInfo.name.trim()) {
                                alert("Введите название команды");
                                return;
                              }
                              await onUpdateTeamInfo(editingTeamInfo.id, teamInfo);
                              setEditingTeamInfo(null);
                            }} 
                            disabled={actionLoading || uploadingLogo || !teamInfo.name.trim()} 
                            style={{ flex: 1, padding: "10px" }}
                          >
                            <Icons.Save /> Сохранить
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setEditingTeamInfo(null)} 
                            style={{ flex: 1, padding: "10px" }}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : isEditing ? (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: "12px" }}>{team.name}</div>
                        <div style={{ marginBottom: "12px" }}>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "6px" }}>Поиск и выбор тренера</label>
                          <input
                            type="text"
                            value={coachSearchQuery}
                            onChange={e => setCoachSearchQuery(e.target.value)}
                            onFocus={() => setIsCoachListOpen(true)}
                            placeholder="Введите имя тренера..."
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: "8px",
                              border: `1px solid ${colors.grayBorder}`,
                              fontSize: "14px",
                              outline: "none",
                              boxSizing: "border-box",
                              marginBottom: "8px"
                            }}
                          />
                          
                          {/* Выбранный тренер */}
                          {teamCoach && (() => {
                            const selected = users?.find(u => u.id === teamCoach);
                            return selected ? (
                              <div style={{ 
                                padding: "8px 12px", 
                                background: colors.goldLight, 
                                borderRadius: "6px", 
                                fontSize: "13px",
                                marginBottom: "8px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                              }}>
                                <span>✓ {`${selected.first_name || selected.username || "—"} ${selected.last_name || ""}`.trim()}</span>
                                <button 
                                  onClick={() => setTeamCoach("")}
                                  style={{ 
                                    background: "none", 
                                    border: "none", 
                                    color: colors.gold, 
                                    cursor: "pointer",
                                    fontSize: "16px",
                                    padding: "0 4px"
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : null;
                          })()}
                          
                          {/* Список тренеров */}
                          {isCoachListOpen && (
                            <div style={{ position: "relative" }}>
                              <div 
                                style={{ 
                                  position: "fixed", 
                                  top: 0, 
                                  left: 0, 
                                  right: 0, 
                                  bottom: 0, 
                                  zIndex: 999 
                                }}
                                onClick={() => setIsCoachListOpen(false)}
                              />
                              <div style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                background: "#fff",
                                border: `1px solid ${colors.grayBorder}`,
                                borderRadius: "8px",
                                maxHeight: "300px",
                                overflowY: "auto",
                                zIndex: 1000,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                              }}>
                                {(() => {
                                  const filteredUsers = [
                                    { id: "", name: "Не назначен" },
                                    ...(users || [])
                                      .filter(u => {
                                        if (!coachSearchQuery) return true;
                                        const query = coachSearchQuery.toLowerCase();
                                        const name = `${u.first_name || ""} ${u.last_name || ""} ${u.username || ""}`.toLowerCase();
                                        return name.includes(query);
                                      })
                                      .map(u => ({
                                        id: u.id,
                                        name: `${u.first_name || u.username || "—"} ${u.last_name || ""}`.trim()
                                      }))
                                  ];
                                  
                                  if (filteredUsers.length === 1) {
                                    return (
                                      <div style={{ padding: "12px", color: colors.goldDark, textAlign: "center" }}>
                                        Нет результатов
                                      </div>
                                    );
                                  }
                                  
                                  return filteredUsers.map(user => (
                                    <div
                                      key={user.id}
                                      onClick={() => {
                                        setTeamCoach(user.id);
                                        setIsCoachListOpen(false);
                                        setCoachSearchQuery("");
                                      }}
                                      style={{
                                        padding: "10px 12px",
                                        cursor: "pointer",
                                        background: user.id === teamCoach ? colors.goldLight : "#fff",
                                        borderBottom: `1px solid ${colors.grayBorder}`,
                                        fontSize: "14px"
                                      }}
                                    >
                                      {user.name}
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                          <Button onClick={saveTeam} disabled={actionLoading} style={{ flex: 1, padding: "10px" }}>
                            <Icons.Save /> Сохранить
                          </Button>
                          <Button variant="outline" onClick={() => { setEditingTeam(null); setCoachSearchQuery(""); setIsCoachListOpen(false); }} style={{ flex: 1, padding: "10px" }}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "40px", height: "40px", background: colors.goldLight, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", overflow: "hidden" }}>
                            {team.logo_url && team.logo_url.startsWith('http') ? (
                              <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              team.logo_url || "🏐"
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: "14px" }}>{team.name}</div>
                            <div style={{ fontSize: "12px", color: colors.goldDark }}>
                              Тренер: {coach ? `${coach.first_name || coach.username} ${coach.last_name || ""}`.trim() : "Не назначен"} • {teamPlayers.length} игроков
                            </div>
                          </div>
                          <button 
                            onClick={() => toggleTeamExpand(team.id)} 
                            style={{ background: "none", border: "none", cursor: "pointer", color: colors.goldDark, padding: "4px", transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}
                          >
                            <Icons.ChevronRight />
                          </button>
                          <button 
                            onClick={() => {
                              setEditingTeamInfo(team);
                              setTeamInfo({ name: team.name, logo_url: team.logo_url || "" });
                            }} 
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", padding: "4px" }} 
                            title="Редактировать название и логотип"
                          >
                            ℹ️
                          </button>
                          <button onClick={() => startEditTeam(team)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }} title="Назначить тренера">
                            <Icons.Edit />
                          </button>
                          <button onClick={() => onDeleteTeam(team.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }} title="Удалить команду">
                            <Icons.X />
                          </button>
                        </div>
                        
                        {isExpanded && (
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colors.grayBorder}` }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>Состав команды:</div>
                            {teamPlayers.length > 0 ? [...teamPlayers].sort((a, b) => { const numA = parseInt(a.jersey_number) || 9999; const numB = parseInt(b.jersey_number) || 9999; return numA - numB; }).map(player => (
                              <div key={player.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
                                {editingPlayer?.id === player.id ? (
                                  <div style={{ background: colors.gray, padding: "12px", borderRadius: "8px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                      <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
                                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{((player.users?.first_name || "") + " " + (player.users?.last_name || "")).trim() || player.users?.username}</span>
                                    </div>
                                    <div style={{ marginBottom: "8px" }}>
                                      <label style={{ fontSize: "12px", color: colors.goldDark }}>Номер:</label>
                                      <input type="number" min="1" max="99" value={playerJersey} onChange={e => setPlayerJersey(e.target.value)} style={{ width: "60px", marginLeft: "8px", padding: "4px 8px", borderRadius: "4px", border: `1px solid ${colors.grayBorder}` }} />
                                    </div>
                                    <div style={{ marginBottom: "8px" }}>
                                      <label style={{ fontSize: "12px", color: colors.goldDark, display: "block", marginBottom: "4px" }}>Амплуа:</label>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                        {["setter", "opposite", "outside", "middle", "libero"].map(pos => (
                                          <button key={pos} onClick={() => togglePosition(pos)} style={{ padding: "4px 8px", borderRadius: "12px", border: "none", fontSize: "11px", cursor: "pointer", background: playerPositions.includes(pos) ? colors.gold : colors.grayBorder, color: playerPositions.includes(pos) ? "white" : colors.text }}>{positionLabels[pos]}</button>
                                        ))}
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                      <button onClick={savePlayer} style={{ flex: 1, padding: "6px", background: colors.gold, color: "white", border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>Сохранить</button>
                                      <button onClick={() => setEditingPlayer(null)} style={{ flex: 1, padding: "6px", background: colors.grayBorder, border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>Отмена</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
                                    <span style={{ fontSize: "13px", flex: 1 }}>{((player.users?.first_name || "") + " " + (player.users?.last_name || "")).trim() || player.users?.username}{player.is_captain && <span style={{ marginLeft: "4px", color: colors.gold }}>©</span>}</span>
                                    <span style={{ fontSize: "11px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ") || "—"}</span>
                                    {player.jersey_number && <span style={{ fontSize: "12px", fontWeight: 600, color: colors.gold }}>#{player.jersey_number}</span>}
                                    <button onClick={() => startEditPlayer(player)} style={{ background: "#e0f2fe", border: "none", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", cursor: "pointer", color: "#0284c7" }}>✏️</button>
                                    <button onClick={() => onSetCaptain(team.id, player.id, !player.is_captain)} style={{ background: player.is_captain ? "#f3e8ff" : colors.gray, border: "none", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", cursor: "pointer", color: player.is_captain ? "#7c3aed" : colors.goldDark }}>{player.is_captain ? "©" : "Кап"}</button>
                                  </div>
                                )}
                              </div>
                            )) : (
                              <div style={{ fontSize: "13px", color: colors.goldDark, fontStyle: "italic" }}>Нет игроков</div>
                            )}
                            {/* Массовая рассылка команде */}
                            <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: `1px solid ${colors.grayBorder}` }}>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>📢 Отправить сообщение команде:</div>
                              <textarea
                                value={teamMessage}
                                onChange={e => setTeamMessage(e.target.value)}
                                placeholder="Введите сообщение для всех игроков команды..."
                                style={{ 
                                  width: "100%", 
                                  minHeight: "60px", 
                                  padding: "10px", 
                                  borderRadius: "8px", 
                                  border: `1px solid ${colors.grayBorder}`,
                                  fontSize: "13px",
                                  resize: "vertical",
                                  boxSizing: "border-box"
                                }}
                              />
                              <Button 
                                onClick={async () => {
                                  if (!teamMessage.trim()) {
                                    alert("Введите сообщение");
                                    return;
                                  }
                                  const result = await sendTeamMessage(team.id, team.name, teamMessage, "Администратор");
                                  setTeamMessage("");
                                  alert(`Сообщение отправлено: ${result.sent} из ${result.usersFound || 0}`);
                                }}
                                style={{ marginTop: "8px", width: "100%", padding: "10px" }}
                                disabled={!teamMessage.trim()}
                              >
                                <Icons.Send /> Отправить всем ({teamPlayers.length})
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}

          {/* Predictions tab */}
          {tab === "predictions" && (
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 16px" }}>Система прогнозов</h3>
              
              {/* Спонсоры */}
              <Card style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>Спонсоры ({(sponsors || []).length})</h4>
                  <Button onClick={() => setShowAddSponsor(true)} style={{ padding: "6px 12px", fontSize: "12px" }}>+ Добавить</Button>
                </div>
                
                {showAddSponsor && (
                  <div style={{ background: colors.goldLight, padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                    <Input label="Название" value={newSponsor.name} onChange={v => setNewSponsor(p => ({ ...p, name: v }))} placeholder="Название спонсора" />
                    <div style={{ marginTop: "8px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: colors.goldDark }}>Логотип</label>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) {
                            const url = await handleUploadSponsorLogo(file);
                            if (url) setNewSponsor(p => ({ ...p, logo_url: url }));
                          }
                        }}
                        style={{ fontSize: "13px" }}
                      />
                      {uploadingSponsorLogo && <span style={{ fontSize: "12px", color: colors.goldDark, marginLeft: "8px" }}>Загрузка...</span>}
                      {newSponsor.logo_url && <span style={{ fontSize: "12px", color: "green", marginLeft: "8px" }}>✓</span>}
                    </div>
                    <Input label="Описание" value={newSponsor.description} onChange={v => setNewSponsor(p => ({ ...p, description: v }))} placeholder="Описание" style={{ marginTop: "8px" }} />
                    <Input label="Сайт (ссылка)" value={newSponsor.website_url} onChange={v => setNewSponsor(p => ({ ...p, website_url: v }))} placeholder="https://..." style={{ marginTop: "8px" }} />
                    <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <input type="checkbox" checked={newSponsor.is_active} onChange={e => setNewSponsor(p => ({ ...p, is_active: e.target.checked }))} id="sponsor-active" />
                      <label htmlFor="sponsor-active" style={{ fontSize: "13px" }}>Активный</label>
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                      <Button onClick={handleCreateSponsor} disabled={!newSponsor.name || uploadingSponsorLogo}>Сохранить</Button>
                      <Button variant="outline" onClick={() => { setShowAddSponsor(false); setNewSponsor({ name: "", logo_url: "", description: "", website_url: "", is_active: true }); }}>Отмена</Button>
                    </div>
                  </div>
                )}

                {/* Форма редактирования спонсора */}
                {editingSponsor && (
                  <div style={{ background: "#e0f2fe", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                    <h5 style={{ margin: "0 0 12px", fontSize: "14px" }}>✎ Редактирование: {editingSponsor.name}</h5>
                    <Input label="Название" value={editingSponsor.name} onChange={v => setEditingSponsor(p => ({ ...p, name: v }))} />
                    <Input label="Описание" value={editingSponsor.description || ""} onChange={v => setEditingSponsor(p => ({ ...p, description: v }))} style={{ marginTop: "8px" }} />
                    <Input label="Сайт" value={editingSponsor.website_url || ""} onChange={v => setEditingSponsor(p => ({ ...p, website_url: v }))} style={{ marginTop: "8px" }} />
                    <div style={{ marginTop: "8px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Новый логотип</label>
                      <input type="file" accept="image/*" onChange={async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (file) {
                          const url = await handleUploadSponsorLogo(file);
                          if (url) setEditingSponsor(p => ({ ...p, logo_url: url }));
                        }
                      }} style={{ fontSize: "13px" }} />
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                      <Button onClick={handleUpdateSponsor}>Сохранить</Button>
                      <Button variant="outline" onClick={() => setEditingSponsor(null)}>Отмена</Button>
                    </div>
                  </div>
                )}
                
                {(sponsors || []).length === 0 ? (
                  <p style={{ color: colors.goldDark, fontSize: "13px" }}>Спонсоры не добавлены</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(sponsors || []).map(s => (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", background: s.is_active === false ? "#f5f5f5" : colors.gray, borderRadius: "8px", opacity: s.is_active === false ? 0.6 : 1 }}>
                        {s.logo_url ? <img src={s.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: "8px", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} /> : null}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "14px" }}>{s.name || "Без названия"} {s.is_active === false && <span style={{ color: "#999", fontWeight: 400 }}>(неактивен)</span>}</div>
                          <div style={{ fontSize: "12px", color: colors.goldDark }}>{s.description || ""}</div>
                          {s.website_url && <a href={s.website_url} target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: colors.gold }}>🔗 {s.website_url}</a>}
                        </div>
                        <button onClick={() => setEditingSponsor({...s})} style={{ background: "#e0f2fe", border: "none", color: "#0369a1", cursor: "pointer", padding: "4px 8px", fontSize: "11px", borderRadius: "4px", fontWeight: 600 }}>✎</button>
                        <button onClick={async () => { 
                          try {
                            const newValue = s.is_active === false ? true : false;
                            const { error } = await supabase.from("sponsors").update({ is_active: newValue }).eq("id", s.id).select(); 
                            if (error) { alert("Ошибка: " + error.message); return; }
                            await loadData();
                          } catch(e) { alert("Ошибка: " + e.message); }
                        }} style={{ background: s.is_active !== false ? "#dcfce7" : "#f3f4f6", border: "none", color: s.is_active !== false ? "#16a34a" : "#666", cursor: "pointer", padding: "4px 8px", fontSize: "11px", borderRadius: "4px", fontWeight: 600 }}>{s.is_active !== false ? "ВКЛ" : "ВЫКЛ"}</button>
                        <button onClick={() => handleDeleteSponsor(s.id)} style={{ background: "#fee2e2", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px 8px", fontSize: "11px", borderRadius: "4px", fontWeight: 600 }}>УДЛ</button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              
              {/* Призы */}
              <Card style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>Призы ({(prizes || []).length})</h4>
                  <Button onClick={() => setShowAddPrize(true)} style={{ padding: "6px 12px", fontSize: "12px" }} disabled={(sponsors || []).length === 0}>+ Добавить</Button>
                </div>
                
                {(sponsors || []).length === 0 && <p style={{ color: colors.goldDark, fontSize: "13px" }}>Сначала добавьте спонсора</p>}
                
                {showAddPrize && (
                  <div style={{ background: colors.goldLight, padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                    <Select label="Спонсор" value={newPrize.sponsor_id} onChange={v => setNewPrize(p => ({ ...p, sponsor_id: v }))}
                      options={[{ value: "", label: "Выберите спонсора" }].concat((sponsors || []).map(s => ({ value: s.id, label: s.name })))} />
                    <Input label="Название приза" value={newPrize.title} onChange={v => setNewPrize(p => ({ ...p, title: v }))} placeholder="1000₽ на топливо" style={{ marginTop: "8px" }} />
                    <Input label="Описание" value={newPrize.description} onChange={v => setNewPrize(p => ({ ...p, description: v }))} placeholder="3 победителя по 1000₽ каждому" style={{ marginTop: "8px" }} />
                    <Input label="Ссылка (инструкция)" value={newPrize.link_url} onChange={v => setNewPrize(p => ({ ...p, link_url: v }))} placeholder="https://..." style={{ marginTop: "8px" }} />
                    <Select label="За какое место" value={newPrize.place} onChange={v => setNewPrize(p => ({ ...p, place: v }))} style={{ marginTop: "8px" }}
                      options={[{ value: "1", label: "1 место" }, { value: "2", label: "2 место" }, { value: "3", label: "3 место" }, { value: "10", label: "Топ-10" }]} />
                    <Select label="За какой период" value={newPrize.tour_id} onChange={v => setNewPrize(p => ({ ...p, tour_id: v }))} style={{ marginTop: "8px" }}
                      options={[{ value: "", label: "За весь сезон" }].concat((tours || []).map(t => ({ value: t.id, label: "Тур " + t.number })))} />
                    <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <input type="checkbox" checked={newPrize.is_active} onChange={e => setNewPrize(p => ({ ...p, is_active: e.target.checked }))} id="prize-active" />
                      <label htmlFor="prize-active" style={{ fontSize: "13px" }}>Активный</label>
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                      <Button onClick={handleCreatePrize} disabled={!newPrize.sponsor_id || !newPrize.title}>Сохранить</Button>
                      <Button variant="outline" onClick={() => { setShowAddPrize(false); setNewPrize({ sponsor_id: "", title: "", description: "", place: "1", tour_id: "", link_url: "", is_active: true }); }}>Отмена</Button>
                    </div>
                  </div>
                )}
                
                {(prizes || []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(prizes || []).map(p => {
                      const sponsor = (sponsors || []).find(s => s.id === p.sponsor_id);
                      const tour = (tours || []).find(t => t.id === p.tour_id);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", background: p.is_active === false ? "#f5f5f5" : colors.gray, borderRadius: "8px", opacity: p.is_active === false ? 0.6 : 1 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: "14px" }}>{p.title} {p.is_active === false && <span style={{ color: "#999", fontWeight: 400 }}>(неактивен)</span>}</div>
                            <div style={{ fontSize: "12px", color: colors.goldDark }}>
                              {sponsor ? sponsor.name : "?"} • {p.place === 10 ? "Топ-10" : p.place + " место"} • {tour ? "Тур " + tour.number : "Сезон"}
                            </div>
                            {p.link_url && <a href={p.link_url} target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: colors.gold }}>🔗 Подробнее</a>}
                          </div>
                          <button onClick={() => setEditingPrize({...p})} style={{ background: "#e0f2fe", border: "none", color: "#0369a1", cursor: "pointer", padding: "4px 8px", fontSize: "11px", borderRadius: "4px", fontWeight: 600 }}>✎</button>
                          <button onClick={async () => { 
                            try {
                              const newValue = p.is_active === false ? true : false;
                              const { error } = await supabase.from("prizes").update({ is_active: newValue }).eq("id", p.id).select(); 
                              if (error) { alert("Ошибка: " + error.message); return; }
                              await loadData();
                            } catch(e) { alert("Ошибка: " + e.message); }
                          }} style={{ background: p.is_active !== false ? "#dcfce7" : "#f3f4f6", border: "none", color: p.is_active !== false ? "#16a34a" : "#666", cursor: "pointer", padding: "4px 8px", fontSize: "11px", borderRadius: "4px", fontWeight: 600 }}>{p.is_active !== false ? "ВКЛ" : "ВЫКЛ"}</button>
                          <button onClick={() => handleDeletePrize(p.id)} style={{ background: "#fee2e2", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px 8px", fontSize: "11px", borderRadius: "4px", fontWeight: 600 }}>УДЛ</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Форма редактирования приза */}
                {editingPrize && (
                  <div style={{ background: "#e0f2fe", padding: "12px", borderRadius: "8px", marginTop: "12px" }}>
                    <h5 style={{ margin: "0 0 12px", fontSize: "14px" }}>✎ Редактирование: {editingPrize.title}</h5>
                    <Select label="Спонсор" value={editingPrize.sponsor_id} onChange={v => setEditingPrize(p => ({ ...p, sponsor_id: v }))}
                      options={(sponsors || []).map(s => ({ value: s.id, label: s.name }))} />
                    <Input label="Название" value={editingPrize.title} onChange={v => setEditingPrize(p => ({ ...p, title: v }))} style={{ marginTop: "8px" }} />
                    <Input label="Описание" value={editingPrize.description || ""} onChange={v => setEditingPrize(p => ({ ...p, description: v }))} style={{ marginTop: "8px" }} />
                    <Input label="Ссылка" value={editingPrize.link_url || ""} onChange={v => setEditingPrize(p => ({ ...p, link_url: v }))} style={{ marginTop: "8px" }} />
                    <Select label="За какое место" value={String(editingPrize.place)} onChange={v => setEditingPrize(p => ({ ...p, place: v }))} style={{ marginTop: "8px" }}
                      options={[{ value: "1", label: "1 место" }, { value: "2", label: "2 место" }, { value: "3", label: "3 место" }, { value: "10", label: "Топ-10" }]} />
                    <Select label="За какой период" value={editingPrize.tour_id || ""} onChange={v => setEditingPrize(p => ({ ...p, tour_id: v }))} style={{ marginTop: "8px" }}
                      options={[{ value: "", label: "За весь сезон" }].concat((tours || []).map(t => ({ value: t.id, label: "Тур " + t.number })))} />
                    <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                      <Button onClick={handleUpdatePrize}>Сохранить</Button>
                      <Button variant="outline" onClick={() => setEditingPrize(null)}>Отмена</Button>
                    </div>
                  </div>
                )}
              </Card>
              
              {/* Таблица лидеров */}
              <Card>
                <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Таблица лидеров ({(predictions || []).length} прогнозов)</h4>
                {(predictions || []).length === 0 ? (
                  <p style={{ color: colors.goldDark, fontSize: "13px" }}>Пока нет прогнозов</p>
                ) : (
                  <div>
                    {Object.entries((predictions || []).reduce((acc, p) => {
                      if (!acc[p.user_id]) acc[p.user_id] = { points: 0, count: 0 };
                      acc[p.user_id].points += p.points_earned || 0;
                      acc[p.user_id].count += 1;
                      return acc;
                    }, {}))
                      .map(([id, data]) => {
                        const u = (users || []).find(x => x.id === id);
                        return u ? { user: u, points: data.points, count: data.count } : null;
                      })
                      .filter(Boolean)
                      .sort((a, b) => b.points - a.points || b.count - a.count)
                      .slice(0, 10)
                      .map((item, i) => (
                        <div key={item.user.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: i < 9 ? "1px solid #eee" : "none" }}>
                          <div style={{ width: 24, textAlign: "center", fontWeight: 700 }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>{item.user.first_name} {item.user.last_name || ""}</div>
                          <div style={{ fontWeight: 700, color: colors.gold }}>{item.points}</div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
};
// Модальное окно формы заявки на роль
const RoleRequestModal = ({ show, roleRequestData, setRoleRequestData, onSubmit, onClose, teams, user, roleRequests }) => {
  const isPlayer = roleRequestData.role === "player";
  const isCoach = roleRequestData.role === "coach";
  
  // Проверяем есть ли одобренная заявка с именем/фамилией
  const approvedRequest = (roleRequests || []).find(r => 
    r.user_id === user?.id && 
    r.status === "approved" && 
    r.first_name && r.last_name
  );
  
  // Или имя уже установлено в профиле (после одобрения заявки)
  const hasApprovedName = approvedRequest || (user?.first_name && user?.name_edited_by_admin);
  const lockedFirstName = approvedRequest?.first_name || (user?.name_edited_by_admin ? user?.first_name : null);
  const lockedLastName = approvedRequest?.last_name || (user?.name_edited_by_admin ? user?.last_name : null);
  
  // Команды без тренера (доступны для выбора)
  const availableTeams = (teams || []).filter(t => !t.coach_id);
  
  const positionOptions = [
    { value: "setter", label: "Связующий" },
    { value: "outside", label: "Доигровщик" },
    { value: "opposite", label: "Диагональный" },
    { value: "middle", label: "Центральный блокирующий" },
    { value: "libero", label: "Либеро" }
  ];
  
  const togglePosition = (pos) => {
    const current = roleRequestData.positions || [];
    if (current.includes(pos)) {
      setRoleRequestData(prev => ({ 
        ...prev, 
        positions: current.filter(p => p !== pos) 
      }));
    } else {
      setRoleRequestData(prev => ({ 
        ...prev, 
        positions: [...current, pos] 
      }));
    }
  };
  
  // При первом открытии подставляем заблокированные значения
  useEffect(() => {
    if (lockedFirstName && !roleRequestData.first_name) {
      setRoleRequestData(prev => ({ ...prev, first_name: lockedFirstName }));
    }
    if (lockedLastName && !roleRequestData.last_name) {
      setRoleRequestData(prev => ({ ...prev, last_name: lockedLastName }));
    }
  }, [lockedFirstName, lockedLastName, roleRequestData.first_name, roleRequestData.last_name, setRoleRequestData]);
  
  // Ранний return ПОСЛЕ хуков
  if (!show) return null;
  
  const handleSubmit = () => {
    const firstName = lockedFirstName || roleRequestData.first_name;
    const lastName = lockedLastName || roleRequestData.last_name;
    if (!firstName?.trim() || !lastName?.trim()) {
      alert("Пожалуйста, заполните имя и фамилию");
      return;
    }
    if (isCoach && !roleRequestData.team_id) {
      alert("Пожалуйста, выберите команду");
      return;
    }
    // Подставляем заблокированные значения если есть
    if (lockedFirstName) roleRequestData.first_name = lockedFirstName;
    if (lockedLastName) roleRequestData.last_name = lockedLastName;
    onSubmit();
  };
  
  return (
    <div style={{ 
      position: "fixed", 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: "rgba(0,0,0,0.5)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      zIndex: 9999,
      padding: "20px"
    }}>
      <div style={{ 
        background: colors.bg, 
        borderRadius: "16px", 
        padding: "24px", 
        maxWidth: "400px", 
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto"
      }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700 }}>
          {isPlayer ? "🏃 Заявка на роль Игрока" : "📋 Заявка на роль Тренера"}
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: "13px", color: colors.goldDark }}>
          ⚠️ После одобрения заявки вы не сможете изменить имя и фамилию самостоятельно
        </p>
        
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600 }}>
            Имя <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="text"
            value={lockedFirstName || roleRequestData.first_name}
            onChange={(e) => !lockedFirstName && setRoleRequestData(prev => ({ ...prev, first_name: e.target.value }))}
            placeholder="Введите ваше имя"
            disabled={!!lockedFirstName}
            style={{ 
              width: "100%", 
              padding: "10px", 
              borderRadius: "8px", 
              border: `1px solid ${colors.grayBorder}`, 
              fontSize: "14px",
              boxSizing: "border-box",
              background: lockedFirstName ? "#f3f4f6" : "white",
              color: lockedFirstName ? "#6b7280" : "inherit"
            }}
          />
          {lockedFirstName && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#16a34a" }}>✓ Имя подтверждено</p>}
        </div>
        
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600 }}>
            Фамилия <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="text"
            value={lockedLastName || roleRequestData.last_name}
            onChange={(e) => !lockedLastName && setRoleRequestData(prev => ({ ...prev, last_name: e.target.value }))}
            placeholder="Введите вашу фамилию"
            disabled={!!lockedLastName}
            style={{ 
              width: "100%", 
              padding: "10px", 
              borderRadius: "8px", 
              border: `1px solid ${colors.grayBorder}`, 
              fontSize: "14px",
              boxSizing: "border-box",
              background: lockedLastName ? "#f3f4f6" : "white",
              color: lockedLastName ? "#6b7280" : "inherit"
            }}
          />
          {lockedLastName && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#16a34a" }}>✓ Фамилия подтверждена</p>}
        </div>
        
        {isCoach && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600 }}>
              Команда <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <select
              value={roleRequestData.team_id || ""}
              onChange={(e) => {
                const selectedTeam = availableTeams.find(t => t.id === e.target.value);
                setRoleRequestData(prev => ({ 
                  ...prev, 
                  team_id: e.target.value,
                  team_name: selectedTeam?.name || ""
                }));
              }}
              style={{ 
                width: "100%", 
                padding: "10px", 
                borderRadius: "8px", 
                border: `1px solid ${colors.grayBorder}`, 
                fontSize: "14px",
                boxSizing: "border-box",
                background: "white",
                cursor: "pointer"
              }}
            >
              <option value="">Выберите команду...</option>
              {availableTeams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            {availableTeams.length === 0 && (
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#dc2626" }}>
                Нет доступных команд без тренера
              </p>
            )}
            {availableTeams.length > 0 && (
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: colors.goldDark }}>
                Выберите команду которую хотите тренировать
              </p>
            )}
          </div>
        )}

        {isPlayer && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 600 }}>
              Амплуа (можно выбрать несколько)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {positionOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => togglePosition(opt.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "20px",
                    border: `2px solid ${(roleRequestData.positions || []).includes(opt.value) ? colors.gold : colors.grayBorder}`,
                    background: (roleRequestData.positions || []).includes(opt.value) ? colors.goldLight : colors.bg,
                    color: (roleRequestData.positions || []).includes(opt.value) ? colors.goldDark : colors.text,
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer"
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div style={{ display: "flex", gap: "6px", marginTop: "24px" }}>
          <Button variant="outline" onClick={onClose} style={{ flex: 1 }}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} style={{ flex: 1 }} disabled={roleRequestData.submitting}>
            {roleRequestData.submitting ? "Отправка..." : "Отправить заявку"}
          </Button>
        </div>
      </div>
    </div>
  );
};


// Экран помощи

// Экран сервисмена для ввода статистики в реальном времени

// Экран выбора матча для сервисмена
const ServicemanMatchSelectScreen = ({ matches, teams, tours, onSelectMatch, setScreen }) => {
  // Только предстоящие и текущие матчи
  const availableMatches = (matches || []).filter(m => m.status !== "finished");
  
  // Группируем по турам
  const matchesByTour = {};
  availableMatches.forEach(m => {
    const tourId = m.tour_id || "other";
    if (!matchesByTour[tourId]) matchesByTour[tourId] = [];
    matchesByTour[tourId].push(m);
  });
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Выбор матча" showBack onBack={() => setScreen("home")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ marginBottom: "16px", background: colors.goldLight }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ fontSize: "32px" }}>📊</div>
              <div>
                <div style={{ fontWeight: 600 }}>Режим сервисмена</div>
                <div style={{ fontSize: "13px", color: colors.goldDark }}>Выберите матч для ведения статистики</div>
              </div>
            </div>
          </Card>
          
          {availableMatches.length === 0 ? (
            <Card>
              <p style={{ textAlign: "center", color: colors.goldDark }}>Нет доступных матчей</p>
            </Card>
          ) : (
            Object.entries(matchesByTour).map(([tourId, tourMatches]) => {
              const tour = tours?.find(t => t.id === tourId);
              return (
                <div key={tourId} style={{ marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>
                    {tour ? `Тур ${tour.number}` : "Другие матчи"}
                  </h3>
                  {tourMatches.map(match => {
                    const team1 = teams?.find(t => t.id === match.team1_id);
                    const team2 = teams?.find(t => t.id === match.team2_id);
                    // Извлекаем время напрямую из строки без конвертации часовых поясов
                    const timeString = match.scheduled_time ? match.scheduled_time.substring(11, 16) : null;
                    const dateString = match.scheduled_time ? match.scheduled_time.substring(0, 10) : null;
                    const formattedDate = dateString ? new Date(dateString + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : null;
                    
                    return (
                      <Card key={match.id} onClick={() => onSelectMatch(match)} style={{ marginBottom: "8px", cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                              {team1?.name || "?"} vs {team2?.name || "?"}
                            </div>
                            {timeString && (
                              <div style={{ fontSize: "12px", color: colors.goldDark }}>
                                {formattedDate} в {timeString}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {match.status === "live" && (
                              <span style={{ background: "#dc2626", color: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }}>LIVE</span>
                            )}
                            <Icons.ChevronRight />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </Container>
    </div>
  );
};

const ServicemanScreen = ({ match, teams, players, playerStats, onSaveStat, onUpdateMatch, setScreen }) => {
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const [teamScores, setTeamScores] = useState({ team1: 0, team2: 0 });
  const [currentSet, setCurrentSet] = useState(1);
  const [setScores, setSetScores] = useState([]);
  // Раздельное хранение счёта для каждой команды
  const [teamProgress, setTeamProgress] = useState({});
  
  // Загружаем из localStorage при смене матча
  useEffect(() => {
    if (!match?.id) return;
    try {
      const saved = localStorage.getItem(`matchProgress_${match.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTeamProgress(parsed);
        console.log("📂 Загружен прогресс из localStorage:", parsed);
      } else {
        setTeamProgress({});
      }
    } catch (e) {
      setTeamProgress({});
    }
    // НЕ сбрасываем liveScore/currentSet здесь - они загрузятся при выборе команды
    setSelectedTeamId(null);
    setTeamLocked(false);
  }, [match?.id]);
  
  // Сохраняем teamProgress в localStorage при изменении
  useEffect(() => {
    if (match?.id && Object.keys(teamProgress).length > 0) {
      localStorage.setItem(`matchProgress_${match.id}`, JSON.stringify(teamProgress));
      console.log("💾 Сохранён прогресс в localStorage:", teamProgress);
    }
  }, [teamProgress, match?.id]);
  const [localStats, setLocalStats] = useState({});
  const [statusText, setStatusText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showEndSetModal, setShowEndSetModal] = useState(false);
  const [showEndMatchModal, setShowEndMatchModal] = useState(false);
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [onCourtPlayers, setOnCourtPlayers] = useState({ team1: [], team2: [] }); // Игроки на площадке
  const [teamLocked, setTeamLocked] = useState(false); // Команда зафиксирована
  const [showLineupSelect, setShowLineupSelect] = useState(false); // Экран выбора стартового состава
  const [selectedLineup, setSelectedLineup] = useState([]); // Выбранные игроки для состава
  const [liveScore, setLiveScore] = useState({ team1: 0, team2: 0 }); // Синхронизированный счёт
  const [showAutoEndSetModal, setShowAutoEndSetModal] = useState(false); // Модалка автозавершения партии
  const [autoEndShownForSet, setAutoEndShownForSet] = useState(0); // Для какой партии уже показывали модалку
  
  const team1 = teams?.find(t => t.id === match?.team1_id);
  const team2 = teams?.find(t => t.id === match?.team2_id);
  const team1Players = (players || []).filter(p => p.team_id === match?.team1_id);
  const team2Players = (players || []).filter(p => p.team_id === match?.team2_id);
  const allCurrentPlayers = selectedTeamId === match?.team1_id ? team1Players : selectedTeamId === match?.team2_id ? team2Players : [];
  const onCourtIds = selectedTeamId === match?.team1_id ? onCourtPlayers.team1 : onCourtPlayers.team2;
  // Сохраняем порядок игроков как в onCourtIds
  const currentPlayers = onCourtIds.map(id => allCurrentPlayers.find(p => p.id === id)).filter(Boolean);
  const benchPlayers = allCurrentPlayers.filter(p => !onCourtIds.includes(p.id));
  
  // Синхронизация счёта между сервисменами (polling каждые 2 сек)
  // Синхронизация отключена - используем раздельный счёт для каждой команды (teamProgress)
  // Счёт загружается/сохраняется при переключении команд

  // Инициализация локальной статистики
  useEffect(() => {
    if (!match?.id) return;
    const stats = {};
    [...team1Players, ...team2Players].forEach(p => {
      const existing = playerStats?.find(s => s.player_id === p.id && s.match_id === match?.id);
      stats[p.id] = existing ? { ...existing } : {
        serves_total: 0, aces: 0, serve_errors: 0,
        receive_excellent: 0, receive_good: 0, receive_poor: 0, receive_errors: 0,
        attacks_total: 0, attack_points: 0, attack_errors: 0,
        block_points: 0, block_touches: 0, block_errors: 0
      };
    });
    setLocalStats(stats);
    
    // Инициализация игроков на площадке (первые 6 или все если меньше)
    setOnCourtPlayers({
      team1: team1Players.slice(0, 8).map(p => p.id),
      team2: team2Players.slice(0, 8).map(p => p.id)
    });
  }, [match?.id, playerStats]);
  
  const actionButtons = {
    serve: [
      { label: "Эйс", color: "#16a34a", field: "aces", isPoint: true },
      { label: "Подача", color: "#9ca3af", field: "serves_total", isPoint: false },
      { label: "Ошибка", color: "#dc2626", field: "serve_errors", isPoint: false }
    ],
    attack: [
      { label: "Очко", color: "#16a34a", field: "attack_points", isPoint: true },
      { label: "Атака", color: "#9ca3af", field: "attacks_total", isPoint: false },
      { label: "Ошибка", color: "#dc2626", field: "attack_errors", isPoint: false }
    ],
    block: [
      { label: "Очко", color: "#16a34a", field: "block_points", isPoint: true },
      { label: "Блок", color: "#9ca3af", field: "block_touches", isPoint: false },
      { label: "Ошибка", color: "#dc2626", field: "block_errors", isPoint: false }
    ],
    receive: [
      { label: "Отл.", color: "#16a34a", field: "receive_excellent", isPoint: false },
      { label: "Норм", color: "#ca8a04", field: "receive_good", isPoint: false },
      { label: "Плохо", color: "#f97316", field: "receive_poor", isPoint: false },
      { label: "Ошибка", color: "#dc2626", field: "receive_errors", isPoint: false }
    ],
    opponent: [
      { label: "Ошибка соперника", color: "#f59e0b", field: "opponent_error", isOpponentError: true }
    ]
  };
  
  const handleSelectAction = (type, btn) => {
    // Ошибка соперника не требует выбора игрока
    if (type === "opponent") {
      setSelectedAction({ type, ...btn });
      setStatusText("⚠️ " + btn.label + " — нажмите Ввод");
      return;
    }
    if (!selectedPlayerId) { setStatusText("⚠️ Сначала выберите игрока"); return; }
    setSelectedAction({ type, ...btn });
    const player = currentPlayers.find(p => p.id === selectedPlayerId);
    const typeLabels = { serve: "Подача", attack: "Атака", block: "Блок", receive: "Приём" };
    setStatusText((player?.jersey_number || "?") + " " + (player?.users?.first_name || player?.users?.username || "") + " — " + btn.label + " " + typeLabels[type]);
  };
  
  const handleSubmitAction = () => {
    if (!selectedAction) return;
    
    // Ошибка соперника - просто добавляем очко
    if (selectedAction.isOpponentError) {
      const key = selectedTeamId === match?.team1_id ? "team1" : "team2";
      const prevScores = { ...liveScore };
      const newScore = { ...liveScore, [key]: liveScore[key] + 1 };
      setLiveScore(newScore);
      
      // Синхронизируем с БД
      supabase.from("matches").update({
        live_score_team1: newScore.team1,
        live_score_team2: newScore.team2,
        status: "live"
      }).eq("id", match.id).then(() => {});
      
      // История для отмены
      setActionHistory(prev => [...prev, { 
        type: "opponent_error",
        prevScores
      }]);
      
      setStatusText("✓ Ошибка соперника — +1 очко");
      setSelectedAction(null);
      
      
      // Проверка автозавершения
      const winScore = currentSet >= 5 ? 15 : 25;
      const diff = Math.abs(newScore.team1 - newScore.team2);
      // Автозавершение отключено
      // if ((newScore.team1 >= winScore || newScore.team2 >= winScore) && diff >= 2 && autoEndShownForSet !== currentSet) {
      //   setAutoEndShownForSet(currentSet);
      //   setShowAutoEndSetModal(true);
      // }
      return;
    }
    
    if (!selectedPlayerId) return;
    
    const stat = { ...localStats[selectedPlayerId] };
    const prevStat = { ...stat };
    
    // Увеличиваем поле
    stat[selectedAction.field] = (stat[selectedAction.field] || 0) + 1;
    
    // Для подачи/атаки - также всего
    if (selectedAction.type === "serve" && selectedAction.field !== "serves_total") {
      stat.serves_total = (stat.serves_total || 0) + 1;
    }
    if (selectedAction.type === "attack" && selectedAction.field !== "attacks_total") {
      stat.attacks_total = (stat.attacks_total || 0) + 1;
    }
    
    setLocalStats(prev => ({ ...prev, [selectedPlayerId]: stat }));
    
    // Очко команде или сопернику (при ошибке)
    const prevScores = { ...liveScore };
    let newScore = { ...liveScore };
    
    if (selectedAction.isPoint) {
      // Очко своей команде
      const key = selectedTeamId === match?.team1_id ? "team1" : "team2";
      newScore[key] = newScore[key] + 1;
    } else if (selectedAction.field.includes("error")) {
      // Ошибка = очко сопернику
      const key = selectedTeamId === match?.team1_id ? "team2" : "team1";
      newScore[key] = newScore[key] + 1;
    }
    
    // Обновляем локально
    setLiveScore(newScore);
    
    // Синхронизируем с БД (другой сервисмен увидит)
    supabase.from("matches").update({
      live_score_team1: newScore.team1,
      live_score_team2: newScore.team2,
      status: "live"
    }).eq("id", match.id).then(() => {});
    
    // Проверка автозавершения партии по правилам волейбола
    const winScore = currentSet >= 5 ? 15 : 25; // 5-я партия до 15
    const score1 = newScore.team1;
    const score2 = newScore.team2;
    const diff = Math.abs(score1 - score2);
    
    // Автозавершение отключено - пользователь сам завершает партию кнопкой "Конец Партии"
    // if ((score1 >= winScore || score2 >= winScore) && diff >= 2 && autoEndShownForSet !== currentSet) {
    //   setAutoEndShownForSet(currentSet);
    //   setShowAutoEndSetModal(true);
    // }
    
    // История для отмены
    const player = currentPlayers.find(p => p.id === selectedPlayerId);
    setActionHistory(prev => [...prev, {
      playerId: selectedPlayerId,
      playerName: (player?.jersey_number || "") + " " + (player?.users?.first_name || ""),
      teamId: selectedTeamId,
      action: selectedAction,
      prevStat,
      prevScores
    }]);
    
    setSelectedPlayerId(null);
    setSelectedAction(null);
    // statusText сохраняется
    
    // Автосохранение статистики в БД - используем upsert чтобы избежать дублей
    (async () => {
      // Используем selectedTeamId - команду за которую ведём статистику
      await supabase
        .from("match_player_stats")
        .upsert({
          player_id: selectedPlayerId,
          match_id: match?.id,
          team_id: selectedTeamId,
          ...stat
        }, { 
          onConflict: 'player_id,match_id',
          ignoreDuplicates: false 
        });
    })();
  };
  
  const handleUndo = () => {
    if (actionHistory.length === 0) return;
    const last = actionHistory[actionHistory.length - 1];
    
    // Если это была ошибка соперника - просто откатываем счёт
    if (last.type === "opponent_error") {
      setLiveScore(last.prevScores);
      setActionHistory(prev => prev.slice(0, -1));
      setStatusText("↩️ Отменено: Ошибка соперника");
      
    } else {
      // Обычное действие игрока
      setLocalStats(prev => ({ ...prev, [last.playerId]: last.prevStat }));
      setLiveScore(last.prevScores);
      setActionHistory(prev => prev.slice(0, -1));
      setStatusText("↩️ Отменено: " + last.playerName + " — " + (last.action?.label || ""));
      
    }
    
    // Синхронизируем отмену с БД
    supabase.from("matches").update({
      live_score_team1: last.prevScores.team1,
      live_score_team2: last.prevScores.team2
    }).eq("id", match.id).then(() => {});
  };
  
  const saveAllStats = async () => {
    setSaving(true);
    for (const playerId of Object.keys(localStats)) {
      const stat = localStats[playerId];
      const existingId = playerStats?.find(s => s.player_id === playerId && s.match_id === match.id)?.id;
      await onSaveStat(playerId, match.id, stat, existingId);
    }
    setSaving(false);
  };
  
  const handleEndSet = async () => {
    setShowEndSetModal(false);
    setSaving(true);
    await saveAllStats();
    
    const newSetScores = [...setScores, { ...liveScore }];
    const newSet = currentSet + 1;
    const newLiveScore = { team1: 0, team2: 0 };
    
    setSetScores(newSetScores);
    setLiveScore(newLiveScore);
    setCurrentSet(newSet);
    setActionHistory([]);
    
    // Сохраняем прогресс текущей команды
    if (selectedTeamId) {
      setTeamProgress(prev => ({ ...prev, [selectedTeamId]: { 
        liveScore: newLiveScore, 
        currentSet: newSet, 
        setScores: newSetScores, 
        actionHistory: [] 
      }}));
    }
    
    setSaving(false);
    setStatusText("✅ Партия " + (currentSet) + " завершена!");
    
  };
  
  const handleEndMatch = async () => {
    setShowEndMatchModal(false);
    setSaving(true);
    
    const finalSets = [...setScores];
    if (liveScore.team1 > 0 || liveScore.team2 > 0) {
      finalSets.push({ ...liveScore });
    }
    
    const setsTeam1 = finalSets.filter(s => s.team1 > s.team2).length;
    const setsTeam2 = finalSets.filter(s => s.team2 > s.team1).length;
    
    await saveAllStats();
    
    const matchData = {
      status: "finished",
      sets_team1: setsTeam1,
      sets_team2: setsTeam2
    };
    finalSets.forEach((s, i) => {
      matchData["set" + (i + 1) + "_team1"] = s.team1;
      matchData["set" + (i + 1) + "_team2"] = s.team2;
    });
    
    await onUpdateMatch(match.id, matchData);
    setSaving(false);
    setScreen("servicemanSelect");
  };
  
  // Расчёт для модалки завершения матча
  const getFinalScore = () => {
    const finalSets = [...setScores];
    if (liveScore.team1 > 0 || liveScore.team2 > 0) {
      finalSets.push({ ...liveScore });
    }
    return {
      team1: finalSets.filter(s => s.team1 > s.team2).length,
      team2: finalSets.filter(s => s.team2 > s.team1).length
    };
  };
  
  if (!match) {
    return (
      <div style={{ paddingBottom: "100px" }}>
        <Header title="Статистика" showBack onBack={() => setScreen("servicemanSelect")} />
        <Container><Card><p style={{ textAlign: "center", color: colors.goldDark }}>Матч не выбран</p></Card></Container>
      </div>
    );
  }
  
  return (
    <div style={{ paddingBottom: "20px" }}>
      <Header title="Статистика матча" showBack onBack={() => setScreen("servicemanSelect")} />
      {/* Панель управления */}
      <Container>
        <div style={{ display: "flex", gap: "6px", marginBottom: "8px", paddingTop: "8px" }}>
          {selectedTeamId ? (
            <>
              <button onClick={() => setShowEndMatchModal(true)} style={{ flex: 1, padding: "8px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", fontWeight: 600, fontSize: "12px", cursor: "pointer", color: "#991b1b" }}>
                Конец Матча
              </button>
              <button onClick={() => setShowEndSetModal(true)} style={{ flex: 1, padding: "8px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "8px", fontWeight: 600, fontSize: "12px", cursor: "pointer", color: "#92400e" }}>
                Конец Партии
              </button>
            </>
          ) : (
            <div style={{ flex: 1, textAlign: "center", color: colors.goldDark, fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              Статистика
            </div>
          )}
        </div>
        
        {/* Счёт + Партия + Команда в одну строку */}
        {!teamLocked ? (
          <div>
            <div style={{ fontSize: "12px", color: colors.goldDark, marginBottom: "8px", textAlign: "center" }}>Выберите команду:</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => { setSelectedTeamId(match.team1_id); setShowLineupSelect(true); setSelectedLineup([]); }}
                style={{ flex: 1, padding: "10px", background: "white", border: "2px solid " + colors.gold, borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer", color: colors.goldDark }}>
                {team1?.name || "Команда 1"}
              </button>
              <button onClick={() => { setSelectedTeamId(match.team2_id); setShowLineupSelect(true); setSelectedLineup([]); }}
                style={{ flex: 1, padding: "10px", background: "white", border: "2px solid " + colors.gold, borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer", color: colors.goldDark }}>
                {team2?.name || "Команда 2"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div style={{ background: colors.goldLight, padding: "6px 12px", borderRadius: "6px", fontWeight: 700, fontSize: "22px", color: colors.goldDark }}>
              {liveScore.team1}:{liveScore.team2}
            </div>
            <div style={{ fontSize: "12px", color: colors.goldDark }}>П{currentSet}</div>
            <div style={{ flex: 1, display: "flex", gap: "4px" }}>
              <div 
                onClick={() => { 
                  // Сохраняем текущий прогресс
                  if (selectedTeamId) {
                    setTeamProgress(prev => ({ ...prev, [selectedTeamId]: { liveScore, currentSet, setScores, actionHistory } }));
                  }
                  // Загружаем прогресс team1 или начинаем с нуля
                  const saved = teamProgress[match.team1_id];
                  if (saved) {
                    setLiveScore(saved.liveScore);
                    setCurrentSet(saved.currentSet);
                    setSetScores(saved.setScores);
                    setActionHistory(saved.actionHistory);
                  } else {
                    setLiveScore({ team1: 0, team2: 0 });
                    setCurrentSet(1);
                    setSetScores([]);
                    setActionHistory([]);
                  }
                  setSelectedTeamId(match.team1_id); 
                  setSelectedPlayerId(null); 
                  setTeamLocked(true); 
                }}
                style={{ flex: 1, padding: "6px 8px", background: selectedTeamId === match.team1_id ? colors.gold : "#e5e7eb", borderRadius: "6px", fontWeight: 600, fontSize: "11px", color: selectedTeamId === match.team1_id ? "white" : colors.goldDark, textAlign: "center", cursor: "pointer" }}>
                {team1?.name}
              </div>
              <div 
                onClick={() => { 
                  // Сохраняем текущий прогресс
                  if (selectedTeamId) {
                    setTeamProgress(prev => ({ ...prev, [selectedTeamId]: { liveScore, currentSet, setScores, actionHistory } }));
                  }
                  // Загружаем прогресс team2 или начинаем с нуля
                  const saved = teamProgress[match.team2_id];
                  if (saved) {
                    setLiveScore(saved.liveScore);
                    setCurrentSet(saved.currentSet);
                    setSetScores(saved.setScores);
                    setActionHistory(saved.actionHistory);
                  } else {
                    setLiveScore({ team1: 0, team2: 0 });
                    setCurrentSet(1);
                    setSetScores([]);
                    setActionHistory([]);
                  }
                  setSelectedTeamId(match.team2_id); 
                  setSelectedPlayerId(null); 
                  setTeamLocked(true); 
                }}
                style={{ flex: 1, padding: "6px 8px", background: selectedTeamId === match.team2_id ? colors.gold : "#e5e7eb", borderRadius: "6px", fontWeight: 600, fontSize: "11px", color: selectedTeamId === match.team2_id ? "white" : colors.goldDark, textAlign: "center", cursor: "pointer" }}>
                {team2?.name}
              </div>
            </div>
            {saving && <span style={{ fontSize: "10px", color: colors.gold }}>💾</span>}
          </div>
        )}
      </Container>
      
      {/* Статус - всегда отображается */}
      <div style={{ background: statusText ? colors.goldLight : "#f3f4f6", padding: "6px 12px", textAlign: "center", fontWeight: 600, fontSize: "12px", color: statusText ? colors.goldDark : "#9ca3af", minHeight: "28px" }}>
        {statusText || "Выберите игрока и действие"}
      </div>
      
      {/* Основная область */}
      {selectedTeamId ? (
        <div style={{ display: "flex", padding: "8px", gap: "8px", alignItems: "stretch", minHeight: "calc(100vh - 360px)" }}>
          {/* Игроки */}
          <div style={{ width: "80px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
            <button onClick={() => setShowSubstitutionModal(true)} style={{ width: "100%", padding: "4px 2px", marginBottom: "4px", background: "#dbeafe", border: "1px solid #3b82f6", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "11px", color: "#1d4ed8" }}>
              🔄 Замена
            </button>
            {currentPlayers.map((p, idx) => (
              <button key={p.id} onClick={() => { setSelectedPlayerId(p.id); setSelectedAction(null); }}
                style={{ 
                  width: "100%", padding: "4px 2px", marginBottom: "2px", flex: 1,
                  background: selectedPlayerId === p.id ? colors.goldLight : (idx >= 6 ? "#e0f2fe" : "white"), 
                  border: selectedPlayerId === p.id ? "2px solid " + colors.gold : "1px solid " + (idx >= 6 ? "#7dd3fc" : colors.grayBorder), 
                  borderRadius: "6px", cursor: "pointer", textAlign: "center",
                  display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "48px"
                }}>
                <div style={{ fontWeight: 700, fontSize: "16px", color: idx >= 6 ? "#0284c7" : colors.gold }}>{p.jersey_number || "?"}</div>
                <div style={{ fontSize: "9px", color: colors.goldDark, overflow: "hidden", textOverflow: "ellipsis", lineHeight: "1.2", wordWrap: "break-word" }}>
                  <>{p.users?.first_name || ""}<br/>{(p.users?.last_name || p.users?.username || "").slice(0, 8)}</>
                </div>
              </button>
            ))}
          </div>
          
          {/* Действия */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Кнопки управления */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
              <button onClick={handleUndo} disabled={actionHistory.length === 0}
                style={{ flex: 1, padding: "14px 6px", background: actionHistory.length > 0 ? "#fca5a5" : "#e5e7eb", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "12px", cursor: actionHistory.length > 0 ? "pointer" : "not-allowed", color: actionHistory.length > 0 ? "#7f1d1d" : "#9ca3af", fontSize: "14px" }}>
                ← Возврат
              </button>
              <button onClick={handleSubmitAction} disabled={!selectedAction}
                style={{ flex: 1, padding: "14px 6px", background: selectedAction ? "#16a34a" : "#e5e7eb", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "12px", cursor: selectedAction ? "pointer" : "not-allowed", color: selectedAction ? "white" : "#9ca3af", fontSize: "14px" }}>
                Ввод ✓
              </button>
            </div>
            
            {/* Блоки действий - равномерно распределены */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              {Object.entries(actionButtons).map(([type, buttons]) => (
                <div key={type} style={{ flex: type === "opponent" ? "none" : 1, display: "flex", flexDirection: "column", marginBottom: "4px" }}>
                  {type !== "opponent" && (
                    <div style={{ fontSize: "9px", color: colors.goldDark, marginBottom: "2px", fontWeight: 600 }}>
                      {type === "serve" ? "Подача" : type === "attack" ? "Атака" : type === "block" ? "Блок" : "Приём"}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                    {buttons.map(btn => {
                      const isOpponent = type === "opponent";
                      const isDisabled = !isOpponent && !selectedPlayerId;
                      return (
                        <button key={btn.field} onClick={() => handleSelectAction(type, btn)} disabled={isDisabled}
                          style={{ 
                            flex: 1, padding: isOpponent ? "12px 4px" : "8px 4px",
                            background: selectedAction?.field === btn.field ? btn.color : "white",
                            border: "2px solid " + btn.color, borderRadius: "6px", 
                            fontWeight: 600, fontSize: "14px", 
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            color: selectedAction?.field === btn.field ? "white" : btn.color,
                            opacity: isDisabled ? 0.5 : 1,
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                          {isOpponent ? "⚠️ " + btn.label : btn.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: "40px 20px", textAlign: "center", color: colors.goldDark }}>
          👆 Выберите команду для ведения статистики
        </div>
      )}
      
      {/* Модалка выбора стартового состава */}
      {showLineupSelect && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "20px", maxWidth: "360px", width: "100%", maxHeight: "85vh", overflow: "auto" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", textAlign: "center" }}>Стартовый состав</h3>
            <p style={{ fontSize: "13px", color: colors.goldDark, textAlign: "center", marginBottom: "16px" }}>Выберите 7 игроков (6 + 2 либеро)</p>
            
            <div style={{ marginBottom: "16px" }}>
              {allCurrentPlayers.map(p => {
                const isSelected = selectedLineup.includes(p.id);
                return (
                  <div key={p.id} onClick={() => {
                    if (isSelected) {
                      setSelectedLineup(prev => prev.filter(id => id !== p.id));
                    } else if (selectedLineup.length < 8) {
                      setSelectedLineup(prev => [...prev, p.id]);
                    }
                  }} style={{ 
                    display: "flex", alignItems: "center", gap: "12px", padding: "12px", 
                    background: isSelected ? colors.goldLight : "white",
                    border: isSelected ? "2px solid " + colors.gold : "1px solid " + colors.grayBorder,
                    borderRadius: "10px", marginBottom: "8px", cursor: "pointer"
                  }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: isSelected ? colors.gold : colors.grayBorder, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "14px" }}>
                      {isSelected ? selectedLineup.indexOf(p.id) + 1 : ""}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "18px", color: colors.gold, minWidth: "36px" }}>
                      #{p.jersey_number || "?"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{((p.users?.first_name || "") + " " + (p.users?.last_name || "")).trim() || p.users?.username}</div>
                      <div style={{ fontSize: "11px", color: colors.goldDark }}>{(p.positions || []).map(pos => positionLabels[pos] || pos).join(", ") || "Амплуа не указано"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => { setShowLineupSelect(false); setSelectedTeamId(null); setSelectedLineup([]); }} 
                style={{ flex: 1, padding: "14px", background: colors.gray, border: "none", borderRadius: "10px", fontWeight: 600, cursor: "pointer" }}>
                Отмена
              </button>
              <button onClick={() => {
                const teamKey = selectedTeamId === match?.team1_id ? "team1" : "team2";
                setOnCourtPlayers(prev => ({ ...prev, [teamKey]: selectedLineup }));
                setShowLineupSelect(false);
                setTeamLocked(true);
              }} disabled={selectedLineup.length < 6 || selectedLineup.length > 8}
                style={{ flex: 1, padding: "14px", background: (selectedLineup.length >= 6 && selectedLineup.length <= 8) ? colors.gold : colors.grayBorder, border: "none", borderRadius: "10px", fontWeight: 600, color: "white", cursor: (selectedLineup.length >= 6 && selectedLineup.length <= 8) ? "pointer" : "not-allowed" }}>
                Готово ({selectedLineup.length}/6-8)
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка автозавершения партии */}
      {showAutoEndSetModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", maxWidth: "320px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🏐</div>
            <h3 style={{ margin: "0 0 8px", fontSize: "20px" }}>Партия завершена!</h3>
            <div style={{ fontSize: "14px", color: colors.goldDark, marginBottom: "16px" }}>Партия {currentSet}</div>
            <div style={{ fontSize: "40px", fontWeight: 700, color: colors.gold, margin: "16px 0" }}>{liveScore.team1} : {liveScore.team2}</div>
            <div style={{ fontSize: "14px", color: liveScore.team1 > liveScore.team2 ? "#16a34a" : "#dc2626", marginBottom: "20px", fontWeight: 600 }}>
              Победа: {liveScore.team1 > liveScore.team2 ? (team1?.name || "Команда 1") : (team2?.name || "Команда 2")}
            </div>
            <button onClick={async () => {
              setShowAutoEndSetModal(false);
              setSaving(true);
              await saveAllStats();
              
              const newSetScores = [...setScores, { ...liveScore }];
              const newSet = currentSet + 1;
              
              setSetScores(newSetScores);
              setLiveScore({ team1: 0, team2: 0 });
              setCurrentSet(newSet);
              setActionHistory([]);
              setAutoEndShownForSet(0); // Сброс флага для новой партии
              
              await supabase.from("matches").update({
                live_score_team1: 0,
                live_score_team2: 0,
                current_set: newSet,
                set_scores: JSON.stringify(newSetScores)
              }).eq("id", match.id);
              
              setSaving(false);
              
              // Проверка на завершение матча (3 выигранных партии)
              const wins1 = newSetScores.filter(s => s.team1 > s.team2).length;
              const wins2 = newSetScores.filter(s => s.team2 > s.team1).length;
              if (wins1 >= 3 || wins2 >= 3) {
                setShowEndMatchModal(true);
              }
            }} style={{ width: "100%", padding: "14px", background: colors.gold, border: "none", borderRadius: "8px", fontWeight: 600, color: "white", cursor: "pointer", fontSize: "16px" }}>
              Следующая партия →
            </button>
          </div>
        </div>
      )}
      
      {/* Модалка замены игрока */}
      {showSubstitutionModal && selectedTeamId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", maxWidth: "360px", width: "100%", maxHeight: "80vh", overflow: "auto" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "18px", textAlign: "center" }}>Замена игрока</h3>
            
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>На площадке:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {currentPlayers.map(p => (
                  <button key={p.id} onClick={() => {
                    // Выбираем игрока для замены
                    setSelectedPlayerId(p.id);
                  }} style={{ 
                    padding: "10px 14px", 
                    background: selectedPlayerId === p.id ? colors.goldLight : "white",
                    border: selectedPlayerId === p.id ? "2px solid " + colors.gold : "1px solid " + colors.grayBorder,
                    borderRadius: "8px", cursor: "pointer", fontSize: "12px", minWidth: "120px"
                  }}>
                    <span style={{ fontWeight: 700, color: colors.gold }}>#{p.jersey_number || "?"}</span> {((p.users?.first_name || "") + " " + (p.users?.last_name || "")).trim()}
                  </button>
                ))}
              </div>
            </div>
            
            {selectedPlayerId && benchPlayers.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>Заменить на:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {benchPlayers.map(p => (
                    <button key={p.id} onClick={() => {
                      // Выполняем замену
                      const teamKey = selectedTeamId === match?.team1_id ? "team1" : "team2";
                      setOnCourtPlayers(prev => ({
                        ...prev,
                        [teamKey]: prev[teamKey].map(id => id === selectedPlayerId ? p.id : id)
                      }));
                      setStatusText("Замена: " + ((currentPlayers.find(cp => cp.id === selectedPlayerId)?.users?.first_name || "") + " " + (currentPlayers.find(cp => cp.id === selectedPlayerId)?.users?.last_name || "")).trim() + " → " + ((p.users?.first_name || "") + " " + (p.users?.last_name || "")).trim());
                      
                      setSelectedPlayerId(null);
                      setShowSubstitutionModal(false);
                    }} style={{ 
                      padding: "8px 12px", 
                      background: "#dcfce7",
                      border: "1px solid #16a34a",
                      borderRadius: "8px", cursor: "pointer", fontSize: "13px"
                    }}>
                      <span style={{ fontWeight: 700, color: "#16a34a" }}>#{p.jersey_number || "?"}</span> {((p.users?.first_name || "") + " " + (p.users?.last_name || "")).trim()}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {benchPlayers.length === 0 && (
              <div style={{ padding: "12px", background: colors.gray, borderRadius: "8px", textAlign: "center", color: colors.goldDark, marginBottom: "16px" }}>
                Нет запасных игроков
              </div>
            )}
            
            <button onClick={() => { setShowSubstitutionModal(false); setSelectedPlayerId(null); }} style={{ width: "100%", padding: "12px", background: colors.gray, border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
              Отмена
            </button>
          </div>
        </div>
      )}
      
      {/* Модалка завершения партии */}
      {showEndSetModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", maxWidth: "320px", width: "100%", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "18px" }}>Завершить партию {currentSet}?</h3>
            <div style={{ fontSize: "32px", fontWeight: 700, color: colors.gold, margin: "16px 0" }}>{liveScore.team1} : {liveScore.team2}</div>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button onClick={() => setShowEndSetModal(false)} style={{ flex: 1, padding: "12px", background: colors.gray, border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Отмена</button>
              <button onClick={handleEndSet} style={{ flex: 1, padding: "12px", background: colors.gold, border: "none", borderRadius: "8px", fontWeight: 600, color: "white", cursor: "pointer" }}>Завершить</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модалка завершения матча */}
      {showEndMatchModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", maxWidth: "320px", width: "100%", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "18px" }}>Завершить матч?</h3>
            <div style={{ fontSize: "14px", color: colors.goldDark, marginBottom: "8px" }}>Счёт по партиям:</div>
            <div style={{ fontSize: "32px", fontWeight: 700, color: colors.gold, margin: "8px 0" }}>{getFinalScore().team1} : {getFinalScore().team2}</div>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button onClick={() => setShowEndMatchModal(false)} style={{ flex: 1, padding: "12px", background: colors.gray, border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Отмена</button>
              <button onClick={handleEndMatch} style={{ flex: 1, padding: "12px", background: "#dc2626", border: "none", borderRadius: "8px", fontWeight: 600, color: "white", cursor: "pointer" }}>Завершить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const HelpScreen = ({ setScreen }) => {
  const [expandedSection, setExpandedSection] = useState(null);
  
  const sections = [
    {
      id: "predictions",
      title: "🎯 Прогнозы",
      content: [
        "Делайте прогнозы на матчи до их начала",
        "+3 очка за точный счёт (например, 3:1)",
        "+1 очко за угаданного победителя",
        "Призы получают топ-3 зрителя в зале"
      ]
    },
    {
      id: "roles",
      title: "👥 Роли в приложении",
      content: [
        "Болельщик — смотрите матчи, делайте прогнозы",
        "Игрок — участвуйте в турнире, получайте приглашения",
        "Тренер — управляйте командой, приглашайте игроков",
        "Чтобы стать игроком/тренером — подайте заявку в профиле"
      ]
    },
    {
      id: "teams",
      title: "🏐 Команды",
      content: [
        "Смотрите составы всех команд турнира",
        "Тренеры могут приглашать свободных игроков",
        "Игроки могут принимать или отклонять приглашения"
      ]
    },
    {
      id: "schedule",
      title: "📅 Расписание",
      content: [
        "Все матчи по турам с временем начала",
        "Смотрите онлайн-трансляции (LIVE)",
        "Записи матчей доступны после окончания"
      ]
    },
    {
      id: "stats",
      title: "📊 Статистика",
      content: [
        "Турнирная таблица команд",
        "Личная статистика игроков",
        "Подача, приём, атака, блок — с процентами эффективности"
      ]
    },
    {
      id: "notifications",
      title: "🔔 Уведомления",
      content: [
        "Напоминание за час до матча",
        "Уведомление о начале матча",
        "Результаты после окончания",
        "Настройте в профиле"
      ]
    }
  ];
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Помощь" showBack onBack={() => setScreen("profile")} />
      <Container>
        <Card style={{ marginBottom: "16px", background: "linear-gradient(135deg, " + colors.gold + " 0%, " + colors.goldDark + " 100%)", color: "white" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 8px" }}>Кубок МТК</h3>
          <p style={{ fontSize: "14px", margin: 0, opacity: 0.9 }}>
            Волейбольный турнир среди мужских команд г. Благовещенска
          </p>
        </Card>
        
        {sections.map(section => (
          <Card 
            key={section.id} 
            style={{ marginBottom: "12px", cursor: "pointer" }}
            onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>{section.title}</h4>
              <span style={{ fontSize: "18px", color: colors.goldDark, transition: "transform 0.2s", transform: expandedSection === section.id ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
            </div>
            {expandedSection === section.id && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid " + colors.grayBorder }}>
                {section.content.map((item, i) => (
                  <div key={i} style={{ fontSize: "14px", color: colors.goldDark, padding: "6px 0", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <span style={{ color: colors.gold }}>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
        
        <Card style={{ marginTop: "20px", background: colors.goldLight }}>
          <h4 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600 }}>Есть вопросы?</h4>
          <p style={{ fontSize: "14px", color: colors.goldDark, margin: 0 }}>
            Напишите организаторам через кнопку в профиле или в Telegram: @volleyamur
          </p>
        </Card>
      </Container>
    </div>
  );
};

const ProfileScreen = ({ user, onLogout, isGuest, isTelegram, setScreen, pendingOffers, userRoles, onUpdateNotifications, roleRequests, onSubmitRoleRequest, onRequestPhone, currentPlayer, onUpdatePosition, setRoleRequestData, setShowRoleRequestForm }) => {
  const displayName = getDisplayName(user);
  const [showNotifySettings, setShowNotifySettings] = useState(false);
  const [showContactOrganizers, setShowContactOrganizers] = useState(false);
  const [organizerMessage, setOrganizerMessage] = useState("");
  const [sendingToOrganizers, setSendingToOrganizers] = useState(false);
  const [notifySettings, setNotifySettings] = useState({
    notify_hour_before: user?.notify_hour_before !== false,
    notify_live: user?.notify_live !== false,
    notify_result: user?.notify_result !== false,
  });
  
  const handleToggle = async (field) => {
    const newValue = !notifySettings[field];
    setNotifySettings(prev => ({ ...prev, [field]: newValue }));
    onUpdateNotifications && onUpdateNotifications(field, newValue);
  };
  
  const Checkbox = ({ checked, onChange, label }) => (
    <div onClick={onChange} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", cursor: "pointer", borderBottom: `1px solid ${colors.grayBorder}` }}>
      <div style={{ width: "24px", height: "24px", borderRadius: "6px", border: `2px solid ${checked ? colors.gold : colors.grayBorder}`, background: checked ? colors.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {checked && <Icons.Check />}
      </div>
      <span style={{ fontSize: "15px", flex: 1 }}>{label}</span>
    </div>
  );
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Профиль" showBack onBack={() => setScreen("home")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "center" }}><Avatar name={displayName} size={80} url={user?.avatar_url} /></div>
            <div style={{ marginTop: "16px" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700 }}>{isGuest ? "Гость" : (user?.first_name ? `${user.first_name} ${user.last_name || ""}` : `@${user?.username || "user"}`)}</h2>
              {user?.username && user?.first_name && <p style={{ margin: "0 0 12px", color: colors.goldDark, fontSize: "14px" }}>@{user.username}</p>}
              {user?.phone && <p style={{ margin: "0 0 12px", color: colors.goldDark, fontSize: "14px" }}>📞 {user.phone}</p>}
              <RoleBadges roles={userRoles.roles} />
            </div>
          </Card>

          {/* Кнопка добавления номера телефона */}
          {!isGuest && isTelegram && !user?.phone && (
            <Card onClick={onRequestPhone} style={{ marginBottom: "20px", cursor: "pointer", background: colors.goldLight }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: colors.gold, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "18px" }}>📱</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Добавить номер телефона</div>
                  <div style={{ fontSize: "13px", color: colors.goldDark }}>Для связи с организаторами</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          {userRoles.isServiceman && (
            <Card onClick={() => setScreen("servicemanSelect")} style={{ marginBottom: "20px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: "#dcfce7", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>📊</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Режим сервисмена</div>
                  <div style={{ fontSize: "13px", color: colors.goldDark }}>Ведение статистики матчей</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          {userRoles.isAdmin && (
            <Card onClick={() => setScreen("admin")} style={{ marginBottom: "20px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: "#dbeafe", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}><Icons.Settings /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Админ-панель</div>
                  <div style={{ fontSize: "13px", color: colors.goldDark }}>Управление турниром</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          {userRoles.isPlayer && (
            <Card onClick={() => setScreen("offers")} style={{ marginBottom: "20px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: pendingOffers.length > 0 ? "#fef3c7" : colors.gray, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.Mail /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Приглашения в команды</div>
                  {pendingOffers.length > 0 ? <div style={{ fontSize: "13px", color: "#d97706" }}>{pendingOffers.length} новых</div> : <div style={{ fontSize: "13px", color: colors.goldDark }}>Нет новых приглашений</div>}
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}
          
          {userRoles.isPlayer && currentPlayer && (
            <Card style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Моё амплуа</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {["setter", "opposite", "outside", "middle", "libero"].map(pos => {
                  const labels = { setter: "Связующий", opposite: "Диагональный", outside: "Доигровщик", middle: "Центральный", libero: "Либеро" };
                  const isSelected = currentPlayer.positions?.includes(pos);
                  return (
                    <button
                      key={pos}
                      onClick={() => onUpdatePosition && onUpdatePosition(pos)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "20px",
                        border: isSelected ? "2px solid " + colors.gold : "1px solid " + colors.grayBorder,
                        background: isSelected ? colors.goldLight : "white",
                        color: isSelected ? colors.goldDark : colors.text,
                        fontWeight: isSelected ? 600 : 400,
                        fontSize: "14px",
                        cursor: "pointer"
                      }}
                    >
                      {labels[pos]}
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: "12px 0 0", fontSize: "12px", color: colors.goldDark }}>Нажмите чтобы выбрать или убрать позицию</p>
            </Card>
          )}

          {/* Кнопки подачи заявки на роль для болельщиков */}
          {!isGuest && !userRoles.isPlayer && !userRoles.isCoach && (
            <Card style={{ marginBottom: "20px", background: colors.goldLight }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Хотите участвовать в турнире?</h4>
              {(roleRequests || []).some(r => r.user_id === user?.id && r.status === "pending") ? (
                <div style={{ padding: "12px", background: "#fef3c7", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#92400e" }}>⏳ Ваша заявка на рассмотрении</div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "6px" }}>
                  <Button 
                    onClick={() => {
                    setRoleRequestData({ role: "player", first_name: "", last_name: "", positions: [] });
                    setShowRoleRequestForm(true);
                  }}
                    style={{ flex: 1, background: "#16a34a" }}
                  >
                    🏃 Стать игроком
                  </Button>
                  <Button 
                    onClick={() => {
                    setRoleRequestData({ role: "coach", first_name: "", last_name: "", positions: [] });
                    setShowRoleRequestForm(true);
                  }} 
                    variant="outline"
                    style={{ flex: 1 }}
                  >
                    📋 Стать тренером
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Кнопки смены роли для ИГРОКОВ */}
          {!isGuest && userRoles.isPlayer && !userRoles.isCoach && (
            <Card style={{ marginBottom: "20px", background: "#f0f9ff" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Сменить роль</h4>
              {(roleRequests || []).some(r => r.user_id === user?.id && r.status === "pending") ? (
                <div style={{ padding: "12px", background: "#fef3c7", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#92400e" }}>⏳ Ваша заявка на рассмотрении</div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "6px" }}>
                  <Button onClick={() => {
                    setRoleRequestData({ role: "coach", first_name: "", last_name: "", positions: [] });
                    setShowRoleRequestForm(true);
                  }} style={{ flex: 1, background: "#0284c7" }}>📋 Стать тренером</Button>
                  <Button onClick={() => onSubmitRoleRequest("fan")} variant="outline" style={{ flex: 1 }}>👤 Стать болельщиком</Button>
                </div>
              )}
            </Card>
          )}

          {/* Кнопки смены роли для ТРЕНЕРОВ */}
          {!isGuest && userRoles.isCoach && !userRoles.isPlayer && (
            <Card style={{ marginBottom: "20px", background: "#fefce8" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Сменить роль</h4>
              {(roleRequests || []).some(r => r.user_id === user?.id && r.status === "pending") ? (
                <div style={{ padding: "12px", background: "#fef3c7", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#92400e" }}>⏳ Ваша заявка на рассмотрении</div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "6px" }}>
                  <Button onClick={() => {
                  setRoleRequestData({ role: "player", first_name: "", last_name: "", positions: [] });
                  setShowRoleRequestForm(true);
                }} style={{ flex: 1, background: "#16a34a" }}>🏃 Стать игроком</Button>
                  <Button onClick={() => onSubmitRoleRequest("fan")} variant="outline" style={{ flex: 1 }}>👤 Стать болельщиком</Button>
                </div>
              )}
            </Card>
          )}

          {/* Кнопки смены роли для ИГРОК+ТРЕНЕР */}
          {!isGuest && userRoles.isCoach && userRoles.isPlayer && (
            <Card style={{ marginBottom: "20px", background: "#f0fdf4" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Сменить роль</h4>
              {(roleRequests || []).some(r => r.user_id === user?.id && r.status === "pending") ? (
                <div style={{ padding: "12px", background: "#fef3c7", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#92400e" }}>⏳ Ваша заявка на рассмотрении</div>
                </div>
              ) : (
                <Button onClick={() => onSubmitRoleRequest("fan")} variant="outline" style={{ width: "100%" }}>👤 Стать болельщиком</Button>
              )}
            </Card>
          )}

          {/* Кнопка Помощь */}
          <Card onClick={() => setScreen("help")} style={{ marginBottom: "20px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", background: colors.goldLight, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>❓</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Помощь</div>
                <div style={{ fontSize: "13px", color: colors.goldDark }}>Как пользоваться приложением</div>
              </div>
              <Icons.ChevronRight />
            </div>
          </Card>

          {!isGuest && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Уведомления</h3>
              <Card style={{ marginBottom: "20px" }}>
                <Checkbox checked={notifySettings.notify_hour_before} onChange={() => handleToggle("notify_hour_before")} label="Матч скоро начнётся" />
                <Checkbox checked={notifySettings.notify_live} onChange={() => handleToggle("notify_live")} label="Начало матча (LIVE)" />
                <Checkbox checked={notifySettings.notify_result} onChange={() => handleToggle("notify_result")} label="Результаты матчей" />
              </Card>
            </>
          )}

          {/* Кнопка написать организаторам */}
          {!isGuest && (
            <Button onClick={() => setShowContactOrganizers(true)} style={{ width: "100%", marginTop: "24px", background: colors.gold }}>
              <Icons.Mail /> Написать организаторам
            </Button>
          )}

          {/* Модальное окно для сообщения организаторам */}
          {showContactOrganizers && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.5)", zIndex: 9999,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
            }} onClick={() => setShowContactOrganizers(false)}>
              <Card style={{ maxWidth: "400px", width: "100%", maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 700 }}>Написать организаторам</h3>
                <p style={{ fontSize: "14px", color: colors.goldDark, marginBottom: "12px" }}>
                  Ваше сообщение получат все администраторы турнира
                </p>
                <textarea
                  value={organizerMessage}
                  onChange={(e) => setOrganizerMessage(e.target.value)}
                  placeholder="Введите ваше сообщение..."
                  style={{
                    width: "100%", minHeight: "120px", padding: "12px",
                    border: `1px solid ${colors.grayBorder}`, borderRadius: "8px",
                    fontSize: "15px", fontFamily: "inherit", resize: "vertical"
                  }}
                />
                <div style={{ display: "flex", gap: "6px", marginTop: "16px" }}>
                  <Button
                    onClick={async () => {
                      if (!organizerMessage.trim()) {
                        alert("Введите сообщение");
                        return;
                      }
                      setSendingToOrganizers(true);
                      const userName = `${user?.first_name || user?.username || "Пользователь"} ${user?.last_name || ""}`.trim();
                      const result = await sendToOrganizers(userName, user?.telegram_id, organizerMessage, user?.username);
                      setSendingToOrganizers(false);
                      if (result.sent > 0) {
                        alert(`Сообщение отправлено ${result.sent} организаторам`);
                        setOrganizerMessage("");
                        setShowContactOrganizers(false);
                      } else {
                        alert("Не удалось отправить сообщение");
                      }
                    }}
                    disabled={sendingToOrganizers || !organizerMessage.trim()}
                    style={{ flex: 1 }}
                  >
                    {sendingToOrganizers ? "Отправка..." : "Отправить"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowContactOrganizers(false)} style={{ flex: 1 }}>
                    Отмена
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {!isTelegram && (
            <Button variant="outline" onClick={onLogout} style={{ width: "100%", marginTop: "24px", color: "#dc2626", borderColor: "#dc2626" }}>
              {isGuest ? "Войти в аккаунт" : "Выйти"}
            </Button>
          )}
        </div>
      </Container>
    </div>
  );
};

// Main App
export default function MTKCupApp() {
  const [screen, setScreenRaw] = useState("welcome");
  const [navStack, setNavStack] = useState([]);
  
  // Обёртка для навигации с историей
  const setScreen = (newScreen, options = {}) => {
    const { replace = false, addToStack = true } = options;
    if (addToStack && !replace && screen !== newScreen) {
      // Добавляем текущий экран в стек (кроме основных вкладок)
      const mainTabs = ["home", "players", "teams", "schedule", "table"];
      if (!mainTabs.includes(screen)) {
        setNavStack(prev => [...prev, screen]);
      } else {
        // Для главных вкладок очищаем стек и запоминаем откуда пришли
        setNavStack([screen]);
      }
    }
    if (replace) {
      // Замена без добавления в историю
    }
    setScreenRaw(newScreen);
  };
  
  // Функция возврата назад
  const goBack = (defaultScreen = "home") => {
    if (navStack.length > 0) {
      const prevScreen = navStack[navStack.length - 1];
      setNavStack(prev => prev.slice(0, -1));
      setScreenRaw(prevScreen);
    } else {
      setScreenRaw(defaultScreen);
    }
  };
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tours, setTours] = useState([]);
  const [players, setPlayers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [activeTournamentId, setActiveTournamentId] = useState(null);
  const [offers, setOffers] = useState([]);
  const [teamRequests, setTeamRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [servicemanMatch, setServicemanMatch] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [playerStats, setPlayerStats] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [roleRequests, setRoleRequests] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showRoleRequestForm, setShowRoleRequestForm] = useState(false);
  const [roleRequestData, setRoleRequestData] = useState({ 
    role: "", 
    first_name: "", 
    last_name: "", 
    positions: [] 
  });
  const userRoles = getUserRoles(user, players, teams, roleRequests);
  const currentPlayer = userRoles.playerRecord;
  const pendingOffers = offers.filter(o => o.player_id === currentPlayer?.id && o.status === "pending");
  const coachTeam = teams.find(t => t.coach_id === user?.id);
  const sentOffers = offers.filter(o => o.team_id === coachTeam?.id);

  useEffect(() => {
    if (tg) {
      setIsTelegram(true);
      tg.ready();
      tg.expand();
      if (tg.requestFullscreen) tg.requestFullscreen();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      document.body.style.backgroundColor = colors.bg;
      if (tg.initDataUnsafe?.user) handleTelegramLogin(tg.initDataUnsafe.user);
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
let tournamentsData = [];
      try { const res = await supabase.from("tournaments").select("*").order("created_at"); tournamentsData = res.data || []; } catch(e) { console.error("Error loading tournaments:", e); }
      const { data: teamsData } = await supabase.from("teams").select("*, coaches:coach_id(id, first_name, last_name, username, avatar_url)").order("points", { ascending: false });
      const { data: toursData } = await supabase.from("tours").select("*").order("number");
      const { data: matchesData } = await supabase.from("matches").select("*").order("scheduled_time");
      const { data: playersData } = await supabase.from("players").select("*");
      const { data: usersData } = await supabase.from("users").select("*");
      const { data: offersData } = await supabase.from("offers").select("*").order("created_at", { ascending: false });
      const { data: teamRequestsData } = await supabase.from("team_requests").select("*").order("created_at", { ascending: false });
      const { data: playerStatsData } = await supabase.from("match_player_stats").select("*");
      const { data: roleRequestsData } = await supabase.from("role_requests").select("*").order("created_at", { ascending: false });
      const { data: sponsorsData } = await supabase.from("sponsors").select("*").order("created_at", { ascending: false });
      const { data: prizesData } = await supabase.from("prizes").select("*").order("created_at", { ascending: false });
      const { data: predictionsData } = await supabase.from("predictions").select("*").order("created_at", { ascending: false });

      const playersWithDetails = (playersData || []).map(player => ({
        ...player,
        users: usersData?.find(u => u.id === player.user_id) || null,
        teams: teamsData?.find(t => t.id === player.team_id) || null,
      }));

      setTournaments(tournamentsData || []);
      if (!activeTournamentId && tournamentsData?.length > 0) {
        setActiveTournamentId(tournamentsData.find(t => t.is_active)?.id || tournamentsData[0].id);
      }
      setTeams(teamsData || []);
      setTours(toursData || []);
      setMatches(matchesData || []);
      setPlayers(playersWithDetails);
      setOffers(offersData || []);
      setTeamRequests(teamRequestsData || []);
      setUsers(usersData || []);
      setPlayerStats(playerStatsData || []);
      setRoleRequests(roleRequestsData || []);
      setSponsors(sponsorsData || []);
      setPrizes(prizesData || []);
      setPredictions(predictionsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOffer = async (playerId) => {
    if (!coachTeam) return;
    console.log("📨 SendOffer: Checking for existing offer");
    
    // Проверяем нет ли уже pending оффера
    const existingOffer = offers.find(o => 
      o.team_id === coachTeam.id && 
      o.player_id === playerId && 
      o.status === "pending"
    );
    
    if (existingOffer) {
      console.log("📨 SendOffer: Offer already exists");
      alert("Вы уже отправили приглашение этому игроку");
      return;
    }
    
    try {
      setActionLoading(true);
      console.log("📨 SendOffer: Creating new offer for player:", playerId);
      const { data, error } = await supabase.from("offers").insert({ team_id: coachTeam.id, player_id: playerId, status: "pending" }).select().single();
      if (error) {
        console.error("📨 SendOffer: Database error:", error);
        throw error;
      }
      console.log("📨 SendOffer: Offer created successfully");
      setOffers(prev => [data, ...prev]);
      
      // Отправляем уведомление игроку
      const player = players.find(p => p.id === playerId);
      if (player?.users?.telegram_id) {
        const message = `🏐 Приглашение в команду!\n\nКоманда "${coachTeam.name}" приглашает вас в свой состав.\n\nОткройте приложение чтобы принять или отклонить.`;
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: player.users.telegram_id, text: message }),
          });
        } catch (e) { console.error("Failed to notify player:", e); }
      }
      
      alert("Приглашение отправлено!");
    } catch (error) {
      console.error("Error sending offer:", error);
      alert("Ошибка отправки приглашения");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId, teamId) => {
    if (!currentPlayer) return;
    console.log("🏐 AcceptOffer: Starting for player:", currentPlayer.id, "team:", teamId);
    try {
      setActionLoading(true);
      
      // Проверка: не тренирую ли я другую команду
      const coachOfOtherTeam = teams?.find(t => 
        t.coach_id === currentPlayer.user_id && 
        t.id !== teamId
      );
      
      if (coachOfOtherTeam) {
        alert(`Ошибка: Вы являетесь тренером команды "${coachOfOtherTeam.name}". Тренер может играть только в команде, которую тренирует.`);
        setActionLoading(false);
        return;
      }
      
      // Сначала отклоняем все другие pending офферы
      console.log("🏐 AcceptOffer: Rejecting other pending offers");
      await supabase.from("offers").update({ status: "rejected" }).eq("player_id", currentPlayer.id).eq("status", "pending").neq("id", offerId);
      // Отклоняем все pending team_requests для этого игрока
      await supabase.from("team_requests").update({ status: "rejected" }).eq("player_id", currentPlayer.id).eq("status", "pending");
      // Принимаем выбранный оффер
      await supabase.from("offers").update({ status: "accepted" }).eq("id", offerId);
      // Обновляем игрока
      await supabase.from("players").update({ team_id: teamId, is_free_agent: false }).eq("id", currentPlayer.id);
      // Очищаем любимую команду болельщика — теперь у игрока своя команда
      console.log("🏐 AcceptOffer: Clearing favorite_team_id for user:", user.id);
      await supabase.from("users").update({ favorite_team_id: null }).eq("id", user.id);
      setUser(prev => ({ ...prev, favorite_team_id: null }));
      console.log("🏐 AcceptOffer: Success! Player joined team:", teamId);
      await loadData();
      alert("Вы приняты в команду!");
      setScreen("home");
    } catch (error) {
      console.error("Error accepting offer:", error);
      alert("Ошибка при принятии приглашения");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOffer = async (offerId) => {
    try {
      setActionLoading(true);
      await supabase.from("offers").update({ status: "rejected" }).eq("id", offerId);
      await loadData();
    } catch (error) {
      console.error("Error rejecting offer:", error);
      alert("Ошибка при отклонении приглашения");
    } finally {
      setActionLoading(false);
    }
  };

  // Заявки игроков в команды
  const handleSendTeamRequest = async (teamId) => {
    if (!currentPlayer) return;
    try {
      setActionLoading(true);
      
      // Проверка: не тренирую ли я другую команду
      const coachOfOtherTeam = teams?.find(t => 
        t.coach_id === currentPlayer.user_id && 
        t.id !== teamId
      );
      
      if (coachOfOtherTeam) {
        alert(`Ошибка: Вы являетесь тренером команды "${coachOfOtherTeam.name}". Тренер может играть только в команде, которую тренирует.`);
        setActionLoading(false);
        return;
      }
      
      const { data, error } = await supabase.from("team_requests").insert({ 
        team_id: teamId, 
        player_id: currentPlayer.id, 
        status: "pending" 
      }).select().single();
      if (error) throw error;
      setTeamRequests(prev => [data, ...prev]);
      
      // Уведомляем тренера команды
      const team = teams.find(t => t.id === teamId);
      const coachUser = users.find(u => u.id === team?.coach_id);
      if (coachUser?.telegram_id) {
        const playerName = user?.first_name || user?.username || "Игрок";
        const message = `📝 Новая заявка в команду!\n\n${playerName} хочет вступить в команду "${team?.name}".\n\nПроверьте в разделе "Моя команда".`;
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: coachUser.telegram_id, text: message }),
          });
        } catch (e) { console.error("Failed to notify coach:", e); }
      }
      
      
      // Уведомляем всю команду о новой заявке
      const teamPlayers = players.filter(p => p.team_id === teamId);
      const fullPlayerName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "Игрок";
      for (const teamPlayer of teamPlayers) {
        const playerUser = users.find(u => u.id === teamPlayer.user_id);
        if (playerUser?.telegram_id && playerUser.id !== user.id) {
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                chat_id: playerUser.telegram_id, 
                text: `📝 Новая заявка!\n\n${fullPlayerName} хочет вступить в команду "${team?.name}".` 
              }),
            });
          } catch (e) { console.error("Failed to notify team:", e); }
        }
      }
      alert("Заявка отправлена!");
    } catch (error) {
      console.error("Error sending team request:", error);
      alert("Ошибка отправки заявки");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptTeamRequest = async (requestId, playerId) => {
    try {
      setActionLoading(true);
      
      // Мгновенно удаляем принятую заявку из UI
      setTeamRequests(prev => prev.filter(r => r.id !== requestId));
      
      // Проверка: не тренирует ли этот игрок другую команду
      const player = players?.find(p => p.id === playerId);
      const coachOfOtherTeam = teams?.find(t => 
        t.coach_id === player?.user_id && 
        t.id !== coachTeam.id
      );
      
      if (coachOfOtherTeam) {
        // Восстанавливаем заявку в UI если ошибка
        setTeamRequests(prev => [...prev, teamRequests.find(r => r.id === requestId)].filter(Boolean));
        alert(`Ошибка: Этот игрок является тренером команды "${coachOfOtherTeam.name}". Тренер может играть только в команде, которую тренирует.`);
        setActionLoading(false);
        return;
      }
      
      // Принимаем заявку
      await supabase.from("team_requests").update({ status: "accepted" }).eq("id", requestId);
      // Добавляем игрока в команду
      await supabase.from("players").update({ team_id: coachTeam.id, is_free_agent: false }).eq("id", playerId);
      // Отклоняем другие заявки этого игрока
      await supabase.from("team_requests").update({ status: "rejected" }).eq("player_id", playerId).eq("status", "pending").neq("id", requestId);
      // Отклоняем все pending offers для этого игрока
      await supabase.from("offers").update({ status: "rejected" }).eq("player_id", playerId).eq("status", "pending");
      // Очищаем favorite_team_id
      if (player?.user_id) {
        await supabase.from("users").update({ favorite_team_id: null }).eq("id", player.user_id);
      }
      
      // Получаем свежие данные для уведомлений ПЕРЕД loadData
      const { data: freshPlayers } = await supabase.from("players").select("*, users(*)");
      const { data: freshUsers } = await supabase.from("users").select("*");
      
      // Уведомляем принятого игрока
      const acceptedPlayer = freshPlayers?.find(p => p.id === playerId);
      const acceptedUser = acceptedPlayer?.users || freshUsers?.find(u => u.id === acceptedPlayer?.user_id);
      if (acceptedUser?.telegram_id) {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              chat_id: acceptedUser.telegram_id, 
              text: `✅ Вас приняли в команду!\n\nВы теперь в команде "${coachTeam.name}". Добро пожаловать!`,
              reply_markup: {
                inline_keyboard: [[
                  { text: "📱 Открыть приложение", web_app: { url: "https://app.mtkcup.ru" } }
                ]]
              }
            }),
          });
        } catch (e) { console.error("Failed to notify accepted player:", e); }
      }
      
      // Уведомляем всю команду о новом игроке
      const teamPlayers = freshPlayers?.filter(p => p.team_id === coachTeam.id);
      const newPlayerName = `${acceptedUser?.first_name || ""} ${acceptedUser?.last_name || ""}`.trim() || acceptedUser?.username || "Новый игрок";
      for (const teamPlayer of teamPlayers) {
        const playerUser = teamPlayer?.users || freshUsers?.find(u => u.id === teamPlayer.user_id);
        if (playerUser?.telegram_id && playerUser.id !== acceptedUser?.id) {
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                chat_id: playerUser.telegram_id, 
                text: `🎉 Новый игрок в команде!\n\n${newPlayerName} присоединился к команде "${coachTeam.name}".` 
              }),
            });
          } catch (e) { console.error("Failed to notify team about new player:", e); }
        }
      }
      
      await loadData();
      alert("Игрок принят в команду!");
    } catch (error) {
      console.error("Error accepting team request:", error);
      alert("Ошибка при принятии заявки");
      // Перезагружаем данные в случае ошибки
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectTeamRequest = async (requestId) => {
    try {
      setActionLoading(true);
      await supabase.from("team_requests").update({ status: "rejected" }).eq("id", requestId);
      setTeamRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: "rejected" } : r));
    } catch (error) {
      console.error("Error rejecting team request:", error);
      alert("Ошибка при отклонении заявки");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePosition = async (position) => {
    if (!currentPlayer) return;
    try {
      const currentPositions = currentPlayer.positions || [];
      let newPositions;
      if (currentPositions.includes(position)) {
        newPositions = currentPositions.filter(p => p !== position);
      } else {
        newPositions = [...currentPositions, position];
      }
      await supabase.from("players").update({ positions: newPositions }).eq("id", currentPlayer.id);
      setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, positions: newPositions } : p));
    } catch (error) {
      console.error("Error updating position:", error);
      alert("Ошибка при обновлении амплуа");
    }
  };

  const handleLeaveTeam = async () => {
    const isCoach = coachTeam && coachTeam.coach_id === user?.id;
    const isPlayer = !!currentPlayer?.team_id;
    
    if (!isCoach && !isPlayer) return;
    
    const confirmMsg = isCoach 
      ? "Вы уверены что хотите покинуть команду как тренер?" 
      : "Вы уверены что хотите покинуть команду?";
    
    if (!confirm(confirmMsg)) return;
    
    try {
      setActionLoading(true);
      
      if (isCoach) {
        // Снимаем с тренерства
        await supabase.from("teams").update({ coach_id: null }).eq("id", coachTeam.id);
        
        // Уведомляем админов
        const { data: admins } = await supabase.from("users").select("telegram_id").eq("role", "admin");
        const userName = user?.first_name || user?.username || "Тренер";
        const message = `📤 ${userName} покинул команду "${coachTeam.name}" как тренер.`;
        if (admins) {
          for (const admin of admins) {
            if (admin.telegram_id) {
              try {
                await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: admin.telegram_id, text: message }),
                });
              } catch (e) { console.error(e); }
            }
          }
        }
        
        alert("Вы покинули команду как тренер");
      }
      
      
      if (isPlayer && currentPlayer) {
        console.log("🔍 Leave team debug:", {
          currentPlayer,
          team_id: currentPlayer.team_id,
          user
        });
        
        // Сохраняем данные о команде и игроке ДО удаления
        const leavingTeam = teams.find(t => t.id === currentPlayer.team_id);
        const leavingPlayerName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "Игрок";
        
        console.log("🔍 Leaving team:", leavingTeam?.name, "Player:", leavingPlayerName);
        
        // Получаем всех игроков команды ДО удаления
        const { data: teamPlayersData } = await supabase
          .from("players")
          .select("*, users(*)")
          .eq("team_id", currentPlayer.team_id);
        
        console.log("🔍 Team players to notify:", teamPlayersData?.length, teamPlayersData);
        
        // Удаляем из игроков команды
        await supabase.from("players").update({ team_id: null, is_free_agent: true, is_captain: false }).eq("id", currentPlayer.id);
        
        // Уведомляем всех оставшихся игроков команды
        let notified = 0;
        for (const teamPlayer of teamPlayersData || []) {
          console.log("🔍 Checking player:", teamPlayer.users?.first_name, "user_id:", teamPlayer.user_id, "vs", user?.id);
          if (teamPlayer.user_id !== user?.id) {
            const playerUser = teamPlayer.users;
            console.log("🔍 Player telegram_id:", playerUser?.telegram_id);
            if (playerUser?.telegram_id) {
              try {
                const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ 
                    chat_id: playerUser.telegram_id, 
                    text: `📤 Игрок покинул команду\n\n${leavingPlayerName} вышел из команды "${leavingTeam?.name}".` 
                  }),
                });
                const result = await response.json();
                console.log("✅ Notification sent:", result);
                notified++;
              } catch (e) { console.error("❌ Failed to notify:", e); }
            }
          }
        }
        console.log("🔍 Total notified:", notified);
        
        alert("Вы покинули команду и стали свободным игроком");
      }
      
      await loadData();
      setScreen("home");
    } catch (error) {
      console.error("Error leaving team:", error);
      alert("Ошибка при выходе из команды");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    try {
      setActionLoading(true);
      await supabase.from("players").update({ team_id: null, is_free_agent: true }).eq("id", playerId);
      await loadData();
      alert("Игрок удалён из команды");
    } catch (error) {
      console.error("Error removing player:", error);
      alert("Ошибка при удалении игрока");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectFavoriteTeam = async (teamId) => {
    try {
      setActionLoading(true);
      await supabase.from("users").update({ favorite_team_id: teamId }).eq("id", user.id);
      setUser(prev => ({ ...prev, favorite_team_id: teamId }));
      await loadData(); // Reload to show team selection screen
    } catch (error) {
      console.error("Error selecting favorite team:", error);
      alert("Ошибка выбора команды");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFavoritePlayer = async (playerId) => {
    try {
      const currentFavorites = user?.favorite_players || [];
      const isFavorite = currentFavorites.includes(playerId);
      const newFavorites = isFavorite 
        ? currentFavorites.filter(id => id !== playerId)
        : [...currentFavorites, playerId];
      
      await supabase.from("users").update({ favorite_players: newFavorites }).eq("id", user.id);
      setUser(prev => ({ ...prev, favorite_players: newFavorites }));
    } catch (error) {
      console.error("Error toggling favorite player:", error);
    }
  };

  const handleUpdateNotifications = async (field, value) => {
    try {
      await supabase.from("users").update({ [field]: value }).eq("id", user.id);
      setUser(prev => ({ ...prev, [field]: value }));
    } catch (error) {
      console.error("Error updating notifications:", error);
    }
  };

  const handleRequestPhone = async () => {
    if (!tg) {
      alert("Эта функция доступна только в Telegram");
      return;
    }
    try {
      // Запрашиваем контакт через Telegram WebApp API
      tg.requestContact && tg.requestContact((success, event) => {
        if (success && event?.responseUnsafe?.contact) {
          const phone = event.responseUnsafe.contact.phone_number;
          // Сохраняем в базу
          supabase.from("users").update({ phone }).eq("id", user.id).then(() => {
            setUser(prev => ({ ...prev, phone }));
            alert("Номер телефона сохранён!");
          });
        }
      });
    } catch (error) {
      console.error("Error requesting phone:", error);
      alert("Не удалось запросить номер телефона");
    }
  };

  // Admin functions
  const handleUpdateMatch = async (matchId, data) => {
    try {
      setActionLoading(true);
      const match = matches.find(m => m.id === matchId);
      const team1 = teams.find(t => t.id === match.team1_id);
      const team2 = teams.find(t => t.id === match.team2_id);
      
      // Считаем выигранные сеты
      let setsWon1 = 0, setsWon2 = 0;
      if (data.set1_team1 > data.set1_team2) setsWon1++; else if (data.set1_team2 > data.set1_team1) setsWon2++;
      if (data.set2_team1 > data.set2_team2) setsWon1++; else if (data.set2_team2 > data.set2_team1) setsWon2++;
      if (data.set3_team1 > data.set3_team2) setsWon1++; else if (data.set3_team2 > data.set3_team1) setsWon2++;
      if (data.set4_team1 > data.set4_team2) setsWon1++; else if (data.set4_team2 > data.set4_team1) setsWon2++;
      if (data.set5_team1 > data.set5_team2) setsWon1++; else if (data.set5_team2 > data.set5_team1) setsWon2++;
      
      // Формируем set_scores JSON из введённых данных
      const setScoresArray = [];
      if (data.set1_team1 || data.set1_team2) setScoresArray.push({ team1: Number(data.set1_team1) || 0, team2: Number(data.set1_team2) || 0 });
      if (data.set2_team1 || data.set2_team2) setScoresArray.push({ team1: Number(data.set2_team1) || 0, team2: Number(data.set2_team2) || 0 });
      if (data.set3_team1 || data.set3_team2) setScoresArray.push({ team1: Number(data.set3_team1) || 0, team2: Number(data.set3_team2) || 0 });
      if (data.set4_team1 || data.set4_team2) setScoresArray.push({ team1: Number(data.set4_team1) || 0, team2: Number(data.set4_team2) || 0 });
      if (data.set5_team1 || data.set5_team2) setScoresArray.push({ team1: Number(data.set5_team1) || 0, team2: Number(data.set5_team2) || 0 });

      // Обновляем матч
      await supabase.from("matches").update({
        sets_team1: setsWon1,
        sets_team2: setsWon2,
        set1_team1: data.set1_team1 || 0, set1_team2: data.set1_team2 || 0,
        set2_team1: data.set2_team1 || 0, set2_team2: data.set2_team2 || 0,
        set3_team1: data.set3_team1 || 0, set3_team2: data.set3_team2 || 0,
        set4_team1: data.set4_team1 || 0, set4_team2: data.set4_team2 || 0,
        set5_team1: data.set5_team1 || 0, set5_team2: data.set5_team2 || 0,
        set_scores: JSON.stringify(setScoresArray),
        status: data.status,
      }).eq("id", matchId);

      // Если матч завершен или БЫЛ завершен - пересчитываем статистику
      if (data.status === "finished" || match.status === "finished") {
        console.log("📊 Recalculating stats for both teams after match update");
        // Пересчитываем статистику для обеих команд
        await recalculateTeamStats(match.team1_id);
        await recalculateTeamStats(match.team2_id);
        
        // Подсчёт очков прогнозов (только если статус ИЗМЕНИЛСЯ на finished)
        if (data.status === "finished" && match.status !== "finished") {
          console.log("🎯 Calculating prediction points for match:", matchId);
          const { data: matchPredictions } = await supabase
            .from("predictions")
            .select("*")
            .eq("match_id", matchId);
          
          if (matchPredictions && matchPredictions.length > 0) {
            for (const pred of matchPredictions) {
              let points = 0;
              const predictedWinner = pred.predicted_score_team1 > pred.predicted_score_team2 ? 1 : 2;
              const actualWinner = setsWon1 > setsWon2 ? 1 : 2;
              
              // Точный счёт = +3 очка
              if (pred.predicted_score_team1 === setsWon1 && pred.predicted_score_team2 === setsWon2) {
                points = 3;
                console.log("🎯 Exact score! +3 points for user:", pred.user_id);
              }
              // Угадал победителя = +1 очко
              else if (predictedWinner === actualWinner) {
                points = 1;
                console.log("🎯 Correct winner! +1 point for user:", pred.user_id);
              }
              
              // Обновляем очки в прогнозе
              await supabase
                .from("predictions")
                .update({ points_earned: points })
                .eq("id", pred.id);
            }
            console.log("🎯 Updated points for", matchPredictions.length, "predictions");
          }
          
          // Отправляем уведомление о результате
          sendNotification("result", team1?.name, team2?.name, `${setsWon1}:${setsWon2}`);
        }
      }
      
      // Уведомление о начале матча (LIVE)
      console.log("🔔 Checking LIVE notification:", { newStatus: data.status, oldStatus: match.status });
      if (data.status === "live" && match.status !== "live") {
        console.log("🔔 Sending LIVE notification!");
        sendNotification("live", team1?.name, team2?.name);
      }

      await loadData();
      alert("Матч обновлён!");
    } catch (error) {
      console.error("Error updating match:", error);
      alert("Ошибка обновления матча");
    } finally {
      setActionLoading(false);
    }
  };

  // Функция пересчета статистики команды из всех завершенных матчей
  const recalculateTeamStats = async (teamId) => {
    console.log("📊 RecalculateStats: Starting for team:", teamId);
    const { data: finishedMatches } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "finished")
      .or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`);
    console.log("📊 RecalculateStats: Found", finishedMatches?.length || 0, "finished matches");

    let games_played = 0, wins = 0, losses = 0;
    let sets_won = 0, sets_lost = 0, points = 0;
    let balls_won = 0, balls_lost = 0;

    for (const match of finishedMatches || []) {
      const isTeam1 = match.team1_id === teamId;
      const setsWon1 = match.sets_team1;
      const setsWon2 = match.sets_team2;
      const team1Wins = setsWon1 > setsWon2;

      games_played++;

      if (isTeam1) {
        // Эта команда - team1
        wins += team1Wins ? 1 : 0;
        losses += team1Wins ? 0 : 1;
        sets_won += setsWon1;
        sets_lost += setsWon2;
        
        // Считаем очки по итальянской системе
        if (team1Wins) {
          if (setsWon1 === 3 && (setsWon2 === 0 || setsWon2 === 1)) {
            points += 3;
          } else if (setsWon1 === 3 && setsWon2 === 2) {
            points += 2;
          }
        } else {
          if (setsWon2 === 3 && setsWon1 === 2) {
            points += 1;
          }
        }
        
        // Мячи
        balls_won += (match.set1_team1 || 0) + (match.set2_team1 || 0) + (match.set3_team1 || 0) + (match.set4_team1 || 0) + (match.set5_team1 || 0);
        balls_lost += (match.set1_team2 || 0) + (match.set2_team2 || 0) + (match.set3_team2 || 0) + (match.set4_team2 || 0) + (match.set5_team2 || 0);
      } else {
        // Эта команда - team2
        wins += !team1Wins ? 1 : 0;
        losses += !team1Wins ? 0 : 1;
        sets_won += setsWon2;
        sets_lost += setsWon1;
        
        // Считаем очки по итальянской системе
        if (!team1Wins) {
          if (setsWon2 === 3 && (setsWon1 === 0 || setsWon1 === 1)) {
            points += 3;
          } else if (setsWon2 === 3 && setsWon1 === 2) {
            points += 2;
          }
        } else {
          if (setsWon1 === 3 && setsWon2 === 2) {
            points += 1;
          }
        }
        
        // Мячи
        balls_won += (match.set1_team2 || 0) + (match.set2_team2 || 0) + (match.set3_team2 || 0) + (match.set4_team2 || 0) + (match.set5_team2 || 0);
        balls_lost += (match.set1_team1 || 0) + (match.set2_team1 || 0) + (match.set3_team1 || 0) + (match.set4_team1 || 0) + (match.set5_team1 || 0);
      }
    }

    // Обновляем команду
    console.log("📊 RecalculateStats: Final stats -", {games_played, wins, losses, sets_won, sets_lost, points, balls_won, balls_lost});
    await supabase.from("teams").update({
      games_played,
      wins,
      losses,
      sets_won,
      sets_lost,
      points,
      balls_won,
      balls_lost,
    }).eq("id", teamId);
    console.log("📊 RecalculateStats: Complete for team:", teamId);
  };

  const handleUpdateUserRole = async (userId, role) => {
    try {
      setActionLoading(true);
      await supabase.from("users").update({ role }).eq("id", userId);
      await loadData();
      alert("Роль обновлена!");
    } catch (error) {
      console.error("Error updating user role:", error);
      alert("Ошибка обновления роли");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async (userId, role, firstName, lastName, isServiceman = false) => {
    try {
      setActionLoading(true);
      await supabase.from("users").update({ 
        role, 
        first_name: firstName,
        last_name: lastName,
        is_serviceman: isServiceman,
        name_edited_by_admin: true
      }).eq("id", userId);
      await loadData();
    } catch (error) {
      console.error("Error updating user:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeGameRole = async (userId, newRole) => {
    console.log("🔄 handleChangeGameRole: START", { userId, newRole });
    try {
      setActionLoading(true);
      const targetUser = users.find(u => u.id === userId);
      const currentPlayer = players.find(p => p.user_id === userId);
      const currentCoachTeam = teams.find(t => t.coach_id === userId);
      const hasCoachRequest = roleRequests.some(r => r.user_id === userId && r.requested_role === "coach" && r.status === "approved");
      
      console.log("🔄 handleChangeGameRole: Current state", {
        userName: targetUser?.first_name,
        hasPlayerRecord: !!currentPlayer,
        playerTeamId: currentPlayer?.team_id,
        isCoachOfTeam: currentCoachTeam?.name || "NO",
        hasCoachRequest
      });
      
      // Определяем текущую роль (с учетом одобренных заявок!)
      let oldRole = "fan";
      if (currentCoachTeam || hasCoachRequest) oldRole = "coach";
      else if (currentPlayer) oldRole = "player";
      
      if (oldRole === newRole) {
        setActionLoading(false);
        return;
      }
      
      // Применяем изменения
      if (newRole === "fan") {
        console.log("👤 ChangeRole (fan): Removing all roles");
        
        // Удаляем из игроков
        if (currentPlayer) {
          await supabase.from("players").delete().eq("user_id", userId);
          console.log("👤 ChangeRole (fan): Removed from players");
        }
        
        // Снимаем с тренерства команды
        if (currentCoachTeam) {
          await supabase.from("teams").update({ coach_id: null }).eq("id", currentCoachTeam.id);
          console.log("👤 ChangeRole (fan): Removed as coach of team");
        }
        
        // Удаляем ВСЕ одобренные заявки (тренер, игрок)
        await supabase.from("role_requests").delete().eq("user_id", userId).eq("status", "approved");
        console.log("👤 ChangeRole (fan): Removed all approved role requests");
      } 
      else if (newRole === "player") {
        console.log("🏃 ChangeRole (player): Is coach of team?", currentCoachTeam?.name || "NO");
        
        if (!currentPlayer) {
          // Если тренер команды - добавляем игроком в свою команду
          if (currentCoachTeam) {
            console.log("🏃 ChangeRole (player): Adding as player to coached team");
            await supabase.from("players").insert({ 
              user_id: userId, 
              team_id: currentCoachTeam.id,
              is_free_agent: false,
              is_captain: false, 
              positions: [] 
            });
            // НЕ снимаем с тренерства! Тренер может быть игроком своей команды
          } else {
            // Если не тренер - делаем свободным агентом
            console.log("🏃 ChangeRole (player): Creating as free agent");
            await supabase.from("players").insert({ 
              user_id: userId, 
              is_free_agent: true, 
              is_captain: false, 
              positions: [] 
            });
          }
        } else {
          console.log("🏃 ChangeRole (player): Already a player, keeping record");
        }
        
        // Удаляем одобренную заявку на тренера (если есть)
        await supabase.from("role_requests").delete().eq("user_id", userId).eq("requested_role", "coach").eq("status", "approved");
      }
      else if (newRole === "coach") {
        console.log("💼 ChangeRole (coach): Current player team:", currentPlayer?.team_id);
        
        // Если игрок в команде - делаем его тренером этой команды
        if (currentPlayer && currentPlayer.team_id) {
          const playerTeam = teams.find(t => t.id === currentPlayer.team_id);
          console.log("💼 ChangeRole (coach): Setting as coach of team:", playerTeam?.name);
          
          // Проверяем есть ли уже тренер у этой команды
          if (playerTeam && playerTeam.coach_id && playerTeam.coach_id !== userId) {
            alert(`В команде ${playerTeam.name} уже есть тренер. Сначала удалите текущего тренера.`);
            setActionLoading(false);
            return;
          }
          
          // Назначаем тренером
          await supabase.from("teams").update({ coach_id: userId }).eq("id", currentPlayer.team_id);
          
          // Игрок МОЖЕТ оставаться игроком своей команды (это разрешено)
          // Поэтому НЕ удаляем запись из players
        } else {
          // Если не в команде - просто создаём одобренную заявку
          console.log("💼 ChangeRole (coach): No team, creating approved request");
          
          // Сначала удаляем старую заявку если есть
          await supabase.from("role_requests")
            .delete()
            .eq("user_id", userId)
            .eq("requested_role", "coach");
          
          // Создаём новую одобренную заявку
          const { error } = await supabase.from("role_requests").insert({
            user_id: userId, 
            requested_role: "coach", 
            status: "approved",
            reviewed_at: new Date().toISOString(), 
            reviewed_by: user?.id,
          });
          
          if (error) {
            console.error("💼 ChangeRole (coach): Error creating request:", error);
            throw error;
          }
          console.log("💼 ChangeRole (coach): Approved request created successfully");
        }
      }
      
      // Уведомление пользователю
      const roleNames = { fan: "Болельщик", player: "Игрок", coach: "Тренер" };
      const message = `📋 Ваша роль изменена!\n\nНовая роль: ${roleNames[newRole]}\n\nИзменено администратором.`;
      if (targetUser?.telegram_id) {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: targetUser.telegram_id, text: message }),
          });
        } catch (e) { console.error("Failed to notify user:", e); }
      }
      
      await loadData();
    } catch (error) {
      console.error("Error changing game role:", error);
      alert("Ошибка смены роли");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMakePlayer = async (userId) => {
    try {
      setActionLoading(true);
      // Проверяем, нет ли уже записи
      const existing = players.find(p => p.user_id === userId);
      if (existing) {
        alert("Пользователь уже является игроком");
        return;
      }
      // Создаём запись в players как свободный агент
      await supabase.from("players").insert({
        user_id: userId,
        is_free_agent: true,
        is_captain: false,
        positions: [],
      });
      await loadData();
      alert("Пользователь добавлен как свободный игрок!");
    } catch (error) {
      console.error("Error making player:", error);
      alert("Ошибка создания игрока");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Удалить пользователя? Это действие нельзя отменить.")) return;
    try {
      setActionLoading(true);
      
      // Проверяем является ли пользователь тренером команды
      const { data: coachTeams } = await supabase
        .from("teams")
        .select("id, name")
        .eq("coach_id", userId);
      
      // Если является - убираем его из команд
      if (coachTeams && coachTeams.length > 0) {
        await supabase
          .from("teams")
          .update({ coach_id: null })
          .eq("coach_id", userId);
      }
      
      // Удаляем связанные записи
      await supabase.from("role_requests").delete().eq("user_id", userId);
      await supabase.from("players").delete().eq("user_id", userId);
      await supabase.from("offers").delete().eq("player_id", userId);
      // Удаляем статистику игрока
      const { data: playerData } = await supabase.from("players").select("id").eq("user_id", userId);
      if (playerData && playerData.length > 0) {
        for (const player of playerData) {
          await supabase.from("player_stats").delete().eq("player_id", player.id);
          await supabase.from("match_player_stats").delete().eq("player_id", player.id);
        }
      }

      // Удаляем заявки в команды
      await supabase.from("team_requests").delete().eq("user_id", userId);
      // Удаляем пользователя
      await supabase.from("users").delete().eq("id", userId);
      await loadData();
      alert("Пользователь удалён");
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Ошибка удаления");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignCoach = async (teamId, coachId) => {
    try {
      setActionLoading(true);
      
      // Проверка: не играет ли этот человек в другой команде
      const playerInOtherTeam = players?.find(p => 
        p.user_id === coachId && 
        p.team_id !== teamId && 
        p.team_id !== null
      );
      
      if (playerInOtherTeam) {
        const otherTeam = teams?.find(t => t.id === playerInOtherTeam.team_id);
        alert(`Ошибка: Этот человек играет в команде "${otherTeam?.name}". Тренер может играть только в команде, которую тренирует.`);
        setActionLoading(false);
        return;
      }
      
      await supabase.from("teams").update({ coach_id: coachId }).eq("id", teamId);
      await loadData();
      alert("Тренер назначен!");
    } catch (error) {
      console.error("Error assigning coach:", error);
      alert("Ошибка назначения тренера");
    } finally {
      setActionLoading(false);
    }
  };



  const handleCreateTeamAdmin = async (teamData) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.from("teams").insert({
        name: teamData.name,
        logo_url: teamData.logo_url || null,
      });
      if (error) throw error;
      await loadData();
      alert("Команда создана!");
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Ошибка создания команды");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTeamInfo = async (teamId, teamData) => {
    try {
      setActionLoading(true);
      await supabase.from("teams").update({
        name: teamData.name,
        logo_url: teamData.logo_url || null,
      }).eq("id", teamId);
      await loadData();
      alert("Информация о команде обновлена!");
    } catch (error) {
      console.error("Error updating team:", error);
      alert("Ошибка обновления");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!confirm(`Удалить команду "${team?.name}"? Игроки станут свободными агентами, статистика сохранится.`)) {
      return;
    }
    try {
      setActionLoading(true);
      // Делаем всех игроков команды свободными агентами
      await supabase.from("players").update({ 
        team_id: null, 
        is_free_agent: true,
        is_captain: false 
      }).eq("team_id", teamId);
      // Удаляем команду
      await supabase.from("teams").delete().eq("id", teamId);
      await loadData();
      alert("Команда удалена. Игроки стали свободными агентами.");
    } catch (error) {
      console.error("Error:", error);
      alert("Ошибка удаления");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMatch = async (matchId) => {
    const match = matches.find(m => m.id === matchId);
    const team1 = teams.find(t => t.id === match?.team1_id);
    const team2 = teams.find(t => t.id === match?.team2_id);
    
    if (!confirm(`Удалить матч "${team1?.name} vs ${team2?.name}"?`)) {
      return;
    }
    
    try {
      setActionLoading(true);
      const needsRecalc = match?.status === "finished";
      
      await supabase.from("match_player_stats").delete().eq("match_id", matchId);
      await supabase.from("matches").delete().eq("id", matchId);
      
      if (needsRecalc) {
        await recalculateTeamStats(match.team1_id);
        await recalculateTeamStats(match.team2_id);
      }
      
      await loadData();
      alert("Матч удалён!");
    } catch (error) {
      console.error("Error deleting match:", error);
      alert("Ошибка удаления матча");
    } finally {
      setActionLoading(false);
    }
  };


  // Set captain
  const handleSetCaptain = async (teamId, playerId, isCaptain) => {
    try {
      setActionLoading(true);
      if (isCaptain) {
        await supabase.from("players").update({ is_captain: false }).eq("team_id", teamId);
      }
      await supabase.from("players").update({ is_captain: isCaptain }).eq("id", playerId);
      await loadData();
      alert(isCaptain ? "Капитан назначен!" : "Капитан снят!");
    } catch (error) {
      console.error("Error setting captain:", error);
      alert("Ошибка назначения капитана");
    } finally {
      setActionLoading(false);
    }
  };

  // Update jersey number
  const handleUpdateJerseyNumber = async (playerId, jerseyNumber) => {
    try {
      setActionLoading(true);
      await supabase.from('players').update({ jersey_number: jerseyNumber || null }).eq('id', playerId);
      await loadData();
    } catch (error) {
      console.error('Error updating jersey number:', error);
      alert('Ошибка обновления номера');
    } finally {
      setActionLoading(false);
    }
  };

  // Update player (jersey + positions) for admin
  const handleUpdatePlayer = async (playerId, jerseyNumberOrData, positions) => {
    try {
      setActionLoading(true);
      // Если передан объект - используем его напрямую
      const updateData = typeof jerseyNumberOrData === 'object' ? jerseyNumberOrData : { 
        jersey_number: jerseyNumberOrData || null,
        positions: positions || []
      };
      await supabase.from('players').update(updateData).eq('id', playerId);
      await loadData();
    } catch (error) {
      console.error('Error updating player:', error);
      alert('Ошибка обновления');
    } finally {
      setActionLoading(false);
    }
  };

  // Send team message
  const handleSendTeamMessage = async (teamId, teamName, message) => {
    const senderName = `${user?.first_name || user?.username || "Администратор"} ${user?.last_name || ""}`.trim();
    return await sendTeamMessage(teamId, teamName, message, senderName);
  };

  // Create team (for coach)
  const handleCreateTeam = async (teamName) => {
    try {
      setActionLoading(true);
      const { data, error } = await supabase.from("teams").insert({
        name: teamName,
        coach_id: user.id,
        logo_url: "🏐"
      }).select().single();
      
      if (error) throw error;
      await loadData();
      alert("Команда создана!");
      return data;
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Ошибка создания команды');
      return null;
    } finally {
      setActionLoading(false);
    }
  };



  // Tournament CRUD
  const handleCreateTournament = async (data) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.from("tournaments").insert({
        name: data.name,
        category: data.category || 'men',
        season: data.season || '',
        is_active: true,
      });
      if (error) throw error;
      await loadData();
      alert("Турнир создан!");
    } catch (error) {
      console.error("Error creating tournament:", error);
      alert("Ошибка создания турнира");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTournament = async (id, data) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.from("tournaments").update(data).eq("id", id);
      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error("Error updating tournament:", error);
      alert("Ошибка обновления турнира");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTournament = async (id) => {
    if (!confirm("Удалить турнир? Все привязанные туры и команды потеряют привязку.")) return;
    try {
      setActionLoading(true);
      await supabase.from("tours").update({ tournament_id: null }).eq("tournament_id", id);
      await supabase.from("teams").update({ tournament_id: null }).eq("tournament_id", id);
      const { error } = await supabase.from("tournaments").delete().eq("id", id);
      if (error) throw error;
      await loadData();
      alert("Турнир удалён!");
    } catch (error) {
      console.error("Error deleting tournament:", error);
      alert("Ошибка удаления турнира");
    } finally {
      setActionLoading(false);
    }
  };

  // Create tour
  const handleCreateTour = async (tourData) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.from("tours").insert({
        number: parseInt(tourData.number),
        name: tourData.name || null,
        date: tourData.date,
        location: tourData.location,
        address: tourData.address,
        tournament_id: tourData.tournament_id || activeTournamentId || null,
      });
      if (error) throw error;
      await loadData();
      alert("Тур создан!");
    } catch (error) {
      console.error("Error creating tour:", error);
      alert("Ошибка создания тура");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTour = async (tourId, tourData) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.from("tours").update({
        number: parseInt(tourData.number),
        name: tourData.name || null,
        date: tourData.date,
        location: tourData.location,
        address: tourData.address,
        tournament_id: tourData.tournament_id || activeTournamentId || null,
      }).eq("id", tourId);
      if (error) throw error;
      await loadData();
      alert("Тур обновлён!");
    } catch (error) {
      console.error("Error updating tour:", error);
      alert("Ошибка обновления тура");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTour = async (tourId) => {
    if (!confirm("Вы уверены что хотите удалить этот тур? Все матчи тура тоже будут удалены!")) {
      return;
    }
    try {
      setActionLoading(true);
      // Сначала удаляем все матчи тура
      await supabase.from("matches").delete().eq("tour_id", tourId);
      // Потом удаляем тур
      const { error } = await supabase.from("tours").delete().eq("id", tourId);
      if (error) throw error;
      await loadData();
      alert("Тур удалён!");
    } catch (error) {
      console.error("Error deleting tour:", error);
      alert("Ошибка удаления тура");
    } finally {
      setActionLoading(false);
    }
  };


  // Create match
  const handleCreateMatch = async (matchData) => {
    try {
      setActionLoading(true);
      // Сохраняем время БЕЗ конвертации, чтобы оно отображалось одинаково везде
      const { error } = await supabase.from("matches").insert({
        tour_id: matchData.tour_id,
        team1_id: matchData.team1_id,
        team2_id: matchData.team2_id,
        scheduled_time: matchData.scheduled_time,
        status: "upcoming",
        sets_team1: 0,
        sets_team2: 0,
      });
      if (error) throw error;
      await loadData();
      alert("Матч создан!");
    } catch (error) {
      console.error("Error creating match:", error);
      alert("Ошибка создания матча");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateMatchInfo = async (matchId, matchData) => {
    try {
      setActionLoading(true);
      
      // Проверяем изменились ли команды
      const currentMatch = matches.find(m => m.id === matchId);
      const teamsChanged = currentMatch && 
        (currentMatch.team1_id !== matchData.team1_id || currentMatch.team2_id !== matchData.team2_id);
      
      // Если команды изменились — удаляем все прогнозы на этот матч
      if (teamsChanged) {
        const { data: deletedPredictions } = await supabase
          .from("predictions")
          .delete()
          .eq("match_id", matchId)
          .select();
        
        if (deletedPredictions && deletedPredictions.length > 0) {
          console.log("🗑️ Deleted", deletedPredictions.length, "predictions due to team change");
        }
      }
      
      // Сохраняем время БЕЗ конвертации, чтобы оно отображалось одинаково везде
      await supabase.from("matches").update({
        tour_id: matchData.tour_id,
        team1_id: matchData.team1_id,
        team2_id: matchData.team2_id,
        scheduled_time: matchData.scheduled_time,
      }).eq("id", matchId);
      await loadData();
      
      if (teamsChanged) {
        alert("Матч обновлён! Прогнозы на этот матч удалены (команды изменились).");
      } else {
        alert("Информация о матче обновлена!");
      }
    } catch (error) {
      console.error("Error updating match info:", error);
      alert("Ошибка обновления матча");
    } finally {
      setActionLoading(false);
    }
  };

  // Update match video URLs
  const handleUpdateMatchVideo = async (matchId, videoData) => {
    try {
      setActionLoading(true);
      await supabase.from("matches").update({
        stream_url: videoData.stream_url || null,
        video_url: videoData.video_url || null,
      }).eq("id", matchId);
      await loadData();
      alert("Видео обновлено!");
    } catch (error) {
      console.error("Error updating video:", error);
      alert("Ошибка обновления видео");
    } finally {
      setActionLoading(false);
    }
  };

  
  const handleSavePlayerStat = async (playerId, matchId, stat, existingId) => {
    console.log("📊 handleSavePlayerStat called:", { playerId, matchId, stat, existingId });
    try {
      setActionLoading(true);
      
      // Находим игрока чтобы узнать его team_id в момент матча
      const player = players.find(p => p.id === playerId);
      const teamId = player?.team_id;
      console.log("📊 Player found:", player?.id, "teamId:", teamId);
      
      let result;
      if (existingId) {
        console.log("📊 Updating existing stat:", existingId);
        result = await supabase.from("match_player_stats").update(stat).eq("id", existingId).select();
      } else {
        console.log("📊 Inserting new stat");
        result = await supabase.from("match_player_stats").insert({
          player_id: playerId,
          match_id: matchId,
          team_id: teamId,
          ...stat
        }).select();
      }
      console.log("📊 Supabase result:", result);
      if (result.error) {
        console.error("📊 Supabase error:", result.error);
        throw result.error;
      }
      // Не вызываем loadData() при сохранении статистики из сервисмена
      
    } catch (error) {
      console.error("Error saving player stat:", error);
      console.error("Ошибка сохранения статистики");
    } finally {
      setActionLoading(false);
    }
  };

  // Создание прогноза пользователем
  const handleMakePrediction = async (matchId, team1Score, team2Score) => {
    if (!user?.id) {
      alert("Войдите чтобы делать прогнозы");
      return;
    }
    try {
      setActionLoading(true);
      
      // Проверяем не начался ли уже матч
      const match = matches.find(m => m.id === matchId);
      if (match?.status !== "upcoming") {
        alert("Матч уже начался, прогноз недоступен");
        return;
      }
      
      // Проверяем нет ли уже прогноза
      const existing = predictions.find(p => p.user_id === user.id && p.match_id === matchId);
      if (existing) {
        alert("Вы уже сделали прогноз на этот матч");
        return;
      }
      
      const { error } = await supabase.from("predictions").insert({
        user_id: user.id,
        match_id: matchId,
        predicted_score_team1: team1Score,
        predicted_score_team2: team2Score,
        points_earned: 0
      });
      
      if (error) throw error;
      
      await loadData();
      alert("✅ Прогноз принят!");
    } catch (error) {
      console.error("Error making prediction:", error);
      alert("Ошибка сохранения прогноза");
    } finally {
      setActionLoading(false);
    }
  };

const handleTelegramLogin = async (tgUser, retryCount = 0) => {
    const maxRetries = 3;
    try {
      const { data: existingUser, error: fetchError } = await supabase.from("users").select("*").eq("telegram_id", tgUser.id).single();
      
      // Если ошибка сети и есть попытки - повторяем
      if (fetchError && fetchError.code !== "PGRST116" && retryCount < maxRetries) {
        console.log("🔄 Retry login attempt", retryCount + 1);
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return handleTelegramLogin(tgUser, retryCount + 1);
      }
      console.log("👤 Loaded user from DB:", existingUser?.id, "favorite_players:", existingUser?.favorite_players);
      let currentUser;
      let isNewUser = false;
      if (existingUser) {
        // Не перезаписываем имя если его редактировал админ
        const updateData = {
          username: tgUser.username || existingUser.username,
        };
        if (!existingUser.name_edited_by_admin) {
          updateData.first_name = tgUser.first_name || existingUser.first_name;
          updateData.last_name = tgUser.last_name || "";
        }
        const { data: updatedUser } = await supabase.from("users").update(updateData).eq("id", existingUser.id).select().single();
        currentUser = updatedUser || existingUser;
        console.log("👤 Current user after update:", currentUser?.id, "favorite_players:", currentUser?.favorite_players);
      } else {
        isNewUser = true;
        const { data: newUser, error } = await supabase.from("users").insert({
          telegram_id: tgUser.id,
          username: tgUser.username,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name || "",
          role: "fan",
          onboarding_completed: false,
        }).select().single();
        if (error) {
          console.error("Error creating user:", error);
          if (retryCount < maxRetries) {
            console.log("🔄 Retry create user attempt", retryCount + 1);
            await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
            return handleTelegramLogin(tgUser, retryCount + 1);
          }
          alert("Ошибка создания пользователя. Проверьте интернет и попробуйте снова.");
          return;
        }
        currentUser = newUser;
      }
      
      if (!currentUser?.id) {
        console.error("User ID is missing after login");
        alert("Ошибка авторизации. Проверьте интернет и попробуйте снова.");
        return;
      }
      
      setUser(currentUser);
      setIsGuest(false);
      
      // Показываем онбординг новым пользователям
      if (isNewUser || currentUser?.onboarding_completed === false) {
        setShowOnboarding(true);
        setScreen("onboarding");
      } else {
        setScreen("home");
      }
      
      if (currentUser?.telegram_id) {
        syncAvatar(currentUser.telegram_id).then(avatarUrl => {
          if (avatarUrl) setUser(prev => ({ ...prev, avatar_url: avatarUrl }));
        });
      }
    } catch (error) {
      console.error("Error during Telegram login:", error);
      setUser({ first_name: tgUser.first_name, username: tgUser.username, role: "fan" });
      setIsGuest(false);
      setScreen("home");
    }
  };

  const handleLogin = () => {
    if (isTelegram && tg?.initDataUnsafe?.user) handleTelegramLogin(tg.initDataUnsafe.user);
    else {
      setUser({ first_name: "Тестовый", last_name: "Пользователь", username: "test_user", role: "fan" });
      setIsGuest(false);
      setScreen("home");
    }
  };

  
  // Завершение онбординга (для болельщика)
  const handleCompleteOnboarding = async () => {
    if (!user?.id) return;
    await supabase.from("users").update({ onboarding_completed: true }).eq("id", user.id);
    setUser(prev => ({ ...prev, onboarding_completed: true }));
    setShowOnboarding(false);
    setScreen("home");
  };

  // Отправка заявки на роль
  const handleSubmitRoleRequest = async (requestedRole, formData = null) => {
  try {
    if (!user?.id) {
      alert("Ошибка: пользователь не найден. Попробуйте перезайти.");
      return;
    }
    
    // Если это игрок или тренер - проверяем данные формы
    if ((requestedRole === "player" || requestedRole === "coach") && !formData) {
      alert("Пожалуйста, заполните все обязательные поля");
      return;
    }
    
    // Проверяем нет ли уже pending заявки от этого пользователя
    const existingPending = (roleRequests || []).find(r => 
      r.user_id === user.id && r.status === "pending"
    );
    if (existingPending) {
      alert("У вас уже есть заявка на рассмотрении. Дождитесь решения администратора.");
      return;
    }
    
    const insertData = {
      user_id: user.id,
      requested_role: requestedRole,
      status: "pending",
    };
    
    // Добавляем данные из формы
    if (formData) {
      insertData.first_name = formData.first_name;
      insertData.last_name = formData.last_name;
      if (formData.positions && formData.positions.length > 0) {
        insertData.positions = formData.positions;
      }
      if (formData.team_id) {
        insertData.team_id = formData.team_id;
      }
      if (formData.team_name) {
        insertData.team_name = formData.team_name;
      }
    }
    
    const { error: insertError } = await supabase.from("role_requests").insert(insertData);
    if (insertError) {
      console.error("Insert error:", insertError);
      alert("Ошибка: " + insertError.message);
      return;
    }
    
    // Заявка успешно создана - закрываем форму и показываем успех
    setShowOnboarding(false);
    setShowRoleRequestForm(false);
    setRoleRequestData({ role: "", first_name: "", last_name: "", positions: [], team_name: "" });
    setScreen("home");
    alert("✅ Заявка отправлена! Ожидайте одобрения администратора.");
    
    // Остальные операции выполняем без блокировки UI
    try {
      if (user?.id) {
        await supabase.from("users").update({ onboarding_completed: true }).eq("id", user.id);
        setUser(prev => ({ ...prev, onboarding_completed: true }));
      }
      await loadData();
    } catch (e) {
      console.error("Post-submit operations error:", e);
    }
  
    // Отправляем уведомление админам
    const roleName = requestedRole === "player" ? "игроком" : requestedRole === "coach" ? "тренером" : "болельщиком";
    const userName = formData?.first_name ? `${formData.first_name} ${formData.last_name}` : user.first_name || user.username || "Пользователь";
    // Получаем название команды из formData или из списка teams по team_id
    let teamName = formData?.team_name;
    if (!teamName && formData?.team_id) {
      const selectedTeam = teams.find(t => t.id === formData.team_id);
      teamName = selectedTeam?.name;
    }
    const teamInfo = teamName ? `\nКоманда: ${teamName}` : '';
    const currentRole = requestedRole === "coach" ? " (сейчас игрок)" : "";
    const message = `🆕 Новая заявка!\n\n${userName} хочет стать ${roleName}.${currentRole}${teamInfo}\n\nПроверьте в админ-панели.`;
    
    // Получаем всех админов
    const { data: admins } = await supabase.from("users").select("telegram_id").eq("role", "admin");
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        if (admin.telegram_id) {
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                chat_id: admin.telegram_id, 
                text: message,
                reply_markup: {
                  inline_keyboard: [[
                    { text: "📱 Открыть админ-панель", web_app: { url: "https://app.mtkcup.ru" } }
                  ]]
                }
              }),
            });
          } catch (e) { console.error("Failed to notify admin:", e); }
        }
      }
    }
  } catch (error) {
    console.error("Error submitting role request:", error);
    alert("Ошибка при отправке заявки");
  }
};

  // Одобрение заявки (для админа)
  const handleApproveRoleRequest = async (requestId, userId, role) => {
  console.log("👤 ApproveRole: Starting -", {requestId, userId, role});
  try {
    setActionLoading(true);
    
    // Получаем данные из заявки
    const request = roleRequests.find(r => r.id === requestId);
    
    // Обновляем статус заявки
    await supabase.from("role_requests").update({ 
      status: "approved", 
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id 
    }).eq("id", requestId);
    
    // Копируем имя и фамилию из заявки в профиль пользователя
    if (request?.first_name || request?.last_name) {
      const updateData = {};
      if (request.first_name) updateData.first_name = request.first_name;
      if (request.last_name) updateData.last_name = request.last_name;
      updateData.name_edited_by_admin = true;
      
      await supabase.from("users").update(updateData).eq("id", userId);
      console.log("👤 ApproveRole: Updated user profile with name from request");
    }
    
    if (role === "player") {
      // Проверяем является ли человек тренером какой-то команды
      const coachingTeam = teams.find(t => t.coach_id === userId);
      console.log("👤 ApproveRole (player): Coaching team?", coachingTeam ? coachingTeam.name : "NO");
      
      // Проверяем есть ли уже player record
      const existing = players.find(p => p.user_id === userId);
      console.log("👤 ApproveRole: Existing player record?", existing ? "YES" : "NO");
      
      if (existing) {
        console.log("👤 ApproveRole: Updating existing player record");
        const updateData = {
          is_free_agent: coachingTeam ? false : true,
          is_captain: false,
        };
        if (coachingTeam) updateData.team_id = coachingTeam.id;
        
        // Добавляем позиции из заявки
        if (request?.positions && request.positions.length > 0) {
          updateData.positions = request.positions;
        }
        
        await supabase.from("players").update(updateData).eq("user_id", userId);
        
        if (coachingTeam) {
          console.log("👤 ApproveRole: Added as player to coached team:", coachingTeam.name);
        }
      } else {
        // Создаем новый player record
        const insertData = {
          user_id: userId,
          is_free_agent: coachingTeam ? false : true,
          is_captain: false,
          positions: request?.positions || [],
        };
        if (coachingTeam) insertData.team_id = coachingTeam.id;
        
        await supabase.from("players").insert(insertData);
        console.log("👤 ApproveRole: Created player", coachingTeam ? `in coached team: ${coachingTeam.name}` : "as free agent");
      }
    } 
    else if (role === "coach") {
      // Если в заявке указана команда - назначаем тренера на неё
      if (request?.team_id) {
        console.log("👤 ApproveRole (coach): Assigning to team:", request.team_id);
        await supabase.from("teams").update({ coach_id: userId }).eq("id", request.team_id);
        console.log("👤 ApproveRole (coach): Successfully assigned as coach");
        
        // Если пользователь уже игрок - переводим его в эту команду
        const playerRecord = players.find(p => p.user_id === userId);
        if (playerRecord) {
          console.log("👤 ApproveRole (coach): Moving player to coached team");
          await supabase.from("players").update({ 
            team_id: request.team_id, 
            is_free_agent: false,
            is_captain: false 
          }).eq("id", playerRecord.id);
        }
      } else {
        console.log("👤 ApproveRole (coach): No team_id in request, coach approved but not assigned to team");
      }
    }
    else if (role === "fan") {
      // Удаляем из игроков
      await supabase.from("players").delete().eq("user_id", userId);
      // Снимаем с тренерства
      await supabase.from("teams").update({ coach_id: null }).eq("coach_id", userId);
    }
    
    // Отправляем Telegram уведомление пользователю
    const approvedUser = users.find(u => u.id === userId);
    if (approvedUser?.telegram_id) {
      const roleNames = {
        player: "игрок",
        coach: "тренер", 
        fan: "болельщик"
      };
      const roleName = roleNames[role] || role;
      const message = `✅ Ваша заявка принята!\n\nВы теперь ${roleName} в турнире "Кубок МТК".\n\nОткройте приложение чтобы продолжить.`;
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chat_id: approvedUser.telegram_id, 
            text: message,
            reply_markup: {
              inline_keyboard: [[
                { text: "📱 Открыть приложение", web_app: { url: "https://app.mtkcup.ru" } }
              ]]
            }
          }),
        });
      } catch (e) { console.error("Failed to notify user:", e); }
    }
    
    await loadData();
    alert("Заявка одобрена и роль изменена!");
  } catch (error) {
    console.error("Error approving request:", error);
    alert("Ошибка");
  } finally {
    setActionLoading(false);
  }
};

  // Отклонение заявки
  const handleRejectRoleRequest = async (requestId) => {
    try {
      setActionLoading(true);
      await supabase.from("role_requests").update({ 
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id
      }).eq("id", requestId);
      await loadData();
      alert("Заявка отклонена");
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

const handleGuest = () => {
    setUser({ first_name: "Гость", role: "fan" });
    setIsGuest(true);
    setScreen("home");
  };

  const handleLogout = () => {
    setUser(null);
    setIsGuest(false);
    setScreen("welcome");
  };

  const renderScreen = () => {
    if (loading && screen !== "welcome") return <Loading />;
    switch (screen) {
      case "welcome": return <WelcomeScreen onLogin={handleLogin} onGuest={handleGuest} isTelegram={isTelegram} />;
      case "onboarding": return <OnboardingScreen user={user} onComplete={handleCompleteOnboarding} onSubmitRequest={handleSubmitRoleRequest} setRoleRequestData={setRoleRequestData} setShowRoleRequestForm={setShowRoleRequestForm} />;
      case "home": return <HomeScreen setScreen={setScreen} user={user} teams={teams} matches={matches} players={players} pendingOffers={pendingOffers} userRoles={userRoles} setSelectedPlayer={setSelectedPlayer} setSelectedTeam={setSelectedTeam} playerStats={playerStats} tours={tours} tournaments={tournaments} activeTournamentId={activeTournamentId} setActiveTournamentId={setActiveTournamentId} />;
      case "teams": return <TeamsScreen setScreen={setScreen} teams={teams} players={players} setSelectedTeam={setSelectedTeam} user={user} myTeamId={userRoles.playerRecord?.team_id} />;
      case "teamDetail": return <TeamDetailScreen setScreen={setScreen} goBack={goBack} team={selectedTeam} players={players} users={users} setSelectedPlayer={setSelectedPlayer} user={user} onSelectFavoriteTeam={handleSelectFavoriteTeam} userRoles={userRoles} currentPlayer={currentPlayer} onLeaveTeam={handleLeaveTeam} onSendTeamRequest={handleSendTeamRequest} teamRequests={teamRequests} actionLoading={actionLoading} />;
      case "playerDetail": return <PlayerDetailScreen setScreen={setScreen} goBack={goBack} player={selectedPlayer} teams={teams} setSelectedTeam={setSelectedTeam} playerStats={playerStats} matches={matches} tours={tours} user={user} onToggleFavorite={handleToggleFavoritePlayer} userRoles={userRoles} />;
      case "players": return <PlayersScreen setScreen={setScreen} players={players} userRoles={userRoles} coachTeam={coachTeam} onSendOffer={handleSendOffer} sentOffers={sentOffers} setSelectedPlayer={setSelectedPlayer} user={user} myPlayerId={userRoles.playerRecord?.id} teams={teams} playerStats={playerStats} users={users} />;
      case "offers": return <OffersScreen setScreen={setScreen} offers={offers.filter(o => o.player_id === currentPlayer?.id)} teams={teams} onAccept={handleAcceptOffer} onReject={handleRejectOffer} loading={actionLoading} isInTeam={!currentPlayer?.is_free_agent} />;
      case "myteam": return <MyTeamScreen setScreen={setScreen} user={user} teams={teams} players={players} coachTeam={coachTeam} currentPlayer={currentPlayer} sentOffers={sentOffers} onRemovePlayer={handleRemovePlayer} onSelectFavoriteTeam={handleSelectFavoriteTeam} onLeaveTeam={handleLeaveTeam} actionLoading={actionLoading} userRoles={userRoles} setSelectedPlayer={setSelectedPlayer} teamRequests={teamRequests} onAcceptTeamRequest={handleAcceptTeamRequest} onRejectTeamRequest={handleRejectTeamRequest} onUpdateJerseyNumber={handleUpdateJerseyNumber} onSetCaptain={handleSetCaptain} onSendTeamMessage={handleSendTeamMessage} onCreateTeam={handleCreateTeamAdmin} />;
      case "predictions": return <PredictionsScreen matches={matches} teams={teams} tours={tours} sponsors={sponsors} prizes={prizes} predictions={predictions} user={user} onMakePrediction={handleMakePrediction} users={users} />;
      case "schedule": return <ScheduleScreen matches={matches} teams={teams} tours={tours} isGuest={isGuest} setSelectedTeam={setSelectedTeam} setScreen={setScreen} goBack={goBack}  tournaments={tournaments} activeTournamentId={activeTournamentId} setActiveTournamentId={setActiveTournamentId} />;
      case "table": return <TableScreen teams={teams} setSelectedTeam={setSelectedTeam} setScreen={setScreen} goBack={goBack} />;
      case "servicemanSelect": return <ServicemanMatchSelectScreen matches={matches} teams={teams} tours={tours} onSelectMatch={(match) => { setServicemanMatch(match); setScreen("serviceman"); }} setScreen={setScreen} />;
      case "serviceman": return <ServicemanScreen match={servicemanMatch} teams={teams} players={players} playerStats={playerStats} onSaveStat={handleSavePlayerStat} onUpdateMatch={handleUpdateMatch} setScreen={setScreen} />;
      case "help": return <HelpScreen setScreen={setScreen} />;
      case "profile": return <ProfileScreen user={user} onLogout={handleLogout} isGuest={isGuest} isTelegram={isTelegram} setScreen={setScreen} pendingOffers={pendingOffers} userRoles={userRoles} onUpdateNotifications={handleUpdateNotifications} roleRequests={roleRequests} onSubmitRoleRequest={handleSubmitRoleRequest} onRequestPhone={handleRequestPhone} currentPlayer={currentPlayer} onUpdatePosition={handleUpdatePosition} setRoleRequestData={setRoleRequestData} setShowRoleRequestForm={setShowRoleRequestForm} />;
      case "admin": if (!userRoles.isAdmin) { setScreen("home"); return null; } return <AdminScreen setScreen={setScreen} matches={matches} teams={teams} users={users} players={players} tours={tours} playerStats={playerStats} roleRequests={roleRequests} sponsors={sponsors} prizes={prizes} predictions={predictions} onUpdateMatch={handleUpdateMatch} onUpdateUserRole={handleUpdateUserRole} onUpdateUser={handleUpdateUser} onAssignCoach={handleAssignCoach} onDeleteTeam={handleDeleteTeam} onSetCaptain={handleSetCaptain} onCreateTour={handleCreateTour} onUpdateTour={handleUpdateTour} onDeleteTour={handleDeleteTour} onCreateMatch={handleCreateMatch} onDeleteMatch={handleDeleteMatch} onUpdateMatchInfo={handleUpdateMatchInfo} onUpdateMatchVideo={handleUpdateMatchVideo} onSavePlayerStat={handleSavePlayerStat} onMakePlayer={handleMakePlayer} onDeleteUser={handleDeleteUser} onApproveRequest={handleApproveRoleRequest} onRejectRequest={handleRejectRoleRequest} actionLoading={actionLoading} loadData={loadData} onUpdatePlayer={handleUpdatePlayer} onChangeGameRole={handleChangeGameRole} onCreateTeam={handleCreateTeamAdmin} onUpdateTeamInfo={handleUpdateTeamInfo} onStartServiceman={(match) => { setServicemanMatch(match); setScreen("serviceman"); }} tournaments={tournaments} activeTournamentId={activeTournamentId} onCreateTournament={handleCreateTournament} onUpdateTournament={handleUpdateTournament} onDeleteTournament={handleDeleteTournament} />;
      default: return <HomeScreen setScreen={setScreen} user={user} teams={teams} matches={matches} players={players} pendingOffers={pendingOffers} userRoles={userRoles} setSelectedPlayer={setSelectedPlayer} setSelectedTeam={setSelectedTeam} playerStats={playerStats} tours={tours} tournaments={tournaments} activeTournamentId={activeTournamentId} setActiveTournamentId={setActiveTournamentId} />;
    }
  };

  const showNav = !["welcome", "admin"].includes(screen);
  const safeAreaTop = tg?.safeAreaInset?.top || tg?.contentSafeAreaInset?.top || 0;

return (
  <div style={{
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    background: colors.bg,
    minHeight: "100vh",
    paddingTop: isTelegram ? (safeAreaTop > 0 ? `${safeAreaTop}px` : "60px") : "0",
  }}>
    {renderScreen()}
    {showNav && <NavBar active={screen} setScreen={setScreen} />}
    {showRoleRequestForm && (
      <RoleRequestModal
        show={showRoleRequestForm}
        roleRequestData={roleRequestData}
        setRoleRequestData={setRoleRequestData}
        onSubmit={() => handleSubmitRoleRequest(roleRequestData.role, roleRequestData)}
        onClose={() => {
          setShowRoleRequestForm(false);
          setRoleRequestData({ role: "", first_name: "", last_name: "", positions: [], team_id: "", team_name: "" });
        }}
        teams={teams}
        user={user}
        roleRequests={roleRequests}
      />
    )}
  </div>
);
}
