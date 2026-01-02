import { useState, useEffect, useCallback, memo } from "react";
import { supabase } from "./lib/supabase";

// Supabase URL for edge functions
const SUPABASE_URL = "https://ecayfpszkleyxuhsekhu.supabase.co";

// Telegram Bot for notifications
const BOT_TOKEN = "8513614914:AAFygkqgY7IBf5ktbzcdSXZF7QCOwjrCRAI";

const sendNotification = async (type, team1Name, team2Name, score = "") => {
  try {
    // Определяем поле для фильтра
    let notifyField = "";
    if (type === "live") notifyField = "notify_live";
    else if (type === "result") notifyField = "notify_result";
    else if (type === "hour_before") notifyField = "notify_hour_before";
    else return;
    
    // Получаем пользователей с включёнными уведомлениями
    const { data: users } = await supabase
      .from("users")
      .select("telegram_id")
      .not(notifyField, "eq", false)
      .not("telegram_id", "is", null);
    
    if (!users || users.length === 0) return;
    
    // Формируем сообщение
    let message = "";
    if (type === "live") {
      message = `🔴 МАТЧ НАЧАЛСЯ!\n\n🏐 ${team1Name} vs ${team2Name}\n\nСмотрите трансляцию в приложении!`;
    } else if (type === "result") {
      message = `🏆 МАТЧ ЗАВЕРШЁН!\n\n🏐 ${team1Name} ${score} ${team2Name}`;
    } else if (type === "hour_before") {
      message = `⏰ МАТЧ ЧЕРЕЗ 1 ЧАС!\n\n🏐 ${team1Name} vs ${team2Name}\n\nНе пропустите!`;
    }
    
    // Отправляем уведомления
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

const sendToOrganizers = async (userName, userId, message) => {
  try {
    // Получаем всех админов
    const { data: admins } = await supabase
      .from("users")
      .select("telegram_id, first_name, username")
      .eq("role", "admin")
      .not("telegram_id", "is", null);
    
    if (!admins || admins.length === 0) return { sent: 0, failed: 0 };
    
    const fullMessage = `📨 СООБЩЕНИЕ ОТ ПОЛЬЗОВАТЕЛЯ\n\nОт: ${userName}\nTelegram ID: ${userId}\n\n${message}`;
    
    let sent = 0, failed = 0;
    for (const admin of admins) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chat_id: admin.telegram_id, 
            text: fullMessage,
            reply_markup: {
              inline_keyboard: [[
                { text: "💬 Написать пользователю", url: `tg://user?id=${userId}` }
              ]]
            }
          })
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


const sendTeamMessage = async (teamId, teamName, message) => {
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
};

// Функция для вычисления всех ролей пользователя
const getUserRoles = (user, players, teams, roleRequests = []) => {
  if (!user) return { isGuest: true, isFan: false, isPlayer: false, isCaptain: false, isCoach: false, isAdmin: false, roles: [] };
  
  const isAdmin = user.role === "admin";
  const playerRecord = players?.find(p => p.user_id === user.id);
  const isPlayer = !!playerRecord;
  const isCaptain = playerRecord?.is_captain === true;
  
  // Тренер = назначен на команду ИЛИ имеет одобренную заявку на тренера
  const isCoachByTeam = teams?.some(t => t.coach_id === user.id) || false;
  const isCoachByRequest = roleRequests?.some(r => r.user_id === user.id && r.requested_role === "coach" && r.status === "approved") || false;
  const isCoach = isCoachByTeam || isCoachByRequest;
  
  const isFan = !isPlayer && !isCoach && !isAdmin;
  
  const roles = [];
  if (isAdmin) roles.push("admin");
  if (isCoach) roles.push("coach");
  if (isCaptain) roles.push("captain");
  if (isPlayer) roles.push("player");
  if (isFan) roles.push("fan");
  
  return { isGuest: false, isFan, isPlayer, isCaptain, isCoach, isAdmin, roles, playerRecord };
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
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "40px", color: colors.goldDark }}>
    Загрузка...
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
const OnboardingScreen = ({ user, onComplete, onSubmitRequest }) => {
  const [selectedRole, setSelectedRole] = useState("fan");
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => {
    setLoading(true);
    if (selectedRole === "fan") {
      await onComplete();
    } else {
      await onSubmitRequest(selectedRole);
    }
    setLoading(false);
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
        background: colors.gold,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "32px",
        boxShadow: `0 8px 32px ${colors.gold}44`,
      }}>
        <span style={{ fontSize: "56px" }}>🏐</span>
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

const HomeScreen = ({ setScreen, user, teams, matches, players, pendingOffers, userRoles, setSelectedPlayer, playerStats }) => {
  const liveMatch = matches.find(m => m.status === "live");
  const upcomingMatches = (matches || []).filter(m => m.status === "upcoming").slice(0, 2);
  // Сортируем игроков по эффективности (очки = атаки + эйсы + блоки)
  const playersWithStats = (players || []).map(player => {
    const stats = (playerStats || []).filter(s => s.player_id === player.id);
    const totalPoints = stats.reduce((sum, s) => sum + (s.attack_points || 0) + (s.aces || 0) + (s.block_points || 0), 0);
    return { ...player, totalPoints };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
  const topPlayers = playersWithStats.slice(0, 5);
  const displayName = getDisplayName(user);

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Кубок МТК" />
      <Container>
        <div style={{ padding: "20px 0" }}>
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
              { label: "Моя команда", icon: "💛", screen: "myteam" },
              { label: "Команды", icon: "👥", screen: "teams", count: teams.length },
              { label: "Расписание", icon: "📅", screen: "schedule" },
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

          {upcomingMatches.length > 0 && (
            <>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px" }}>Ближайшие матчи</h3>
              {upcomingMatches.map(match => (
                <Card key={match.id} onClick={() => setScreen("schedule")} style={{ marginBottom: "12px", cursor: "pointer" }}><MatchCard match={match} teams={teams} /></Card>
              ))}
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
                    {player.totalPoints > 0 && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: colors.gold }}>{player.totalPoints}</div>
                        <div style={{ fontSize: "10px", color: colors.goldDark }}>очков</div>
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
  const matchTime = new Date(match.scheduled_time);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "13px", color: colors.goldDark, display: "flex", alignItems: "center", gap: "4px" }}>
          <Icons.Clock />{matchTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
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
          <div style={{ fontSize: "28px", marginBottom: "4px" }}>{team1?.logo_url || "🏐"}</div>
          <div style={{ fontWeight: 600, fontSize: "14px" }}>{team1?.name || "—"}</div>
        </div>
        <div style={{ padding: "8px 16px", background: colors.gray, borderRadius: "8px", fontWeight: 700, fontSize: "20px", minWidth: "80px", textAlign: "center" }}>
          {match.status === "upcoming" ? "—" : `${match.sets_team1 || 0} : ${match.sets_team2 || 0}`}
        </div>
        <div 
          style={{ textAlign: "center", flex: 1, cursor: onTeamClick ? "pointer" : "default" }}
          onClick={() => onTeamClick && team2 && onTeamClick(team2)}
        >
          <div style={{ fontSize: "28px", marginBottom: "4px" }}>{team2?.logo_url || "🏐"}</div>
          <div style={{ fontWeight: 600, fontSize: "14px" }}>{team2?.name || "—"}</div>
        </div>
      </div>
    </div>
  );
};

const TeamsScreen = ({ setScreen, teams, setSelectedTeam, user, myTeamId }) => {
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
                  <div style={{ width: "56px", height: "56px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>{team.logo_url || "🏐"}</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600 }}>
                      {team.name} {isMy && <span style={{ fontSize: "12px", color: colors.gold }}>★</span>}
                    </h3>
                    <p style={{ margin: 0, fontSize: "13px", color: colors.goldDark }}>{team.wins}В {team.losses}П • {team.points} очков</p>
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

const TeamDetailScreen = ({ setScreen, team, players, setSelectedPlayer, user, onSelectFavoriteTeam, userRoles, currentPlayer, onLeaveTeam, onSendTeamRequest, teamRequests, actionLoading }) => {
  const teamPlayers = (players || []).filter(p => p.team_id === team?.id);
  const isMyTeam = currentPlayer && currentPlayer.team_id === team?.id;
  const isFreeAgent = currentPlayer && currentPlayer.is_free_agent;
  const hasPendingRequest = teamRequests?.some(r => r.team_id === team?.id && r.player_id === currentPlayer?.id && r.status === "pending");
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header 
        title={team?.name || "Команда"} 
        showBack 
        onBack={() => setScreen("teams")} 
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
            <div style={{ width: "80px", height: "80px", background: colors.goldLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "40px" }}>{team?.logo_url || "🏐"}</div>
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

          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Состав команды ({teamPlayers.length})</h3>
          {teamPlayers.length > 0 ? teamPlayers.map(player => (
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

const ScheduleScreen = ({ matches, teams, tours, isGuest, setSelectedTeam, setScreen }) => {
  const today = new Date();
  const sortedTours = [...tours].sort((a, b) => {
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
    matches: (matches || []).filter(m => m.tour_id === tour.id).sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time)),
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
                    Тур {tour.number}
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

const TableScreen = ({ teams, setSelectedTeam, setScreen }) => {
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
                          <span style={{ fontSize: "18px" }}>{team.logo_url || "🏐"}</span>
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

const PlayersScreen = ({ setScreen, players, userRoles, coachTeam, onSendOffer, sentOffers, setSelectedPlayer, user, myPlayerId }) => {
  const [filter, setFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  
  const canInvite = (userRoles.isCoach || userRoles.isAdmin) && coachTeam;
  
  const filteredPlayers = (players || []).filter(p => {
    if (filter === "free" && !p.is_free_agent) return false;
    if (filter === "team" && p.is_free_agent) return false;
    if (positionFilter !== "all" && !p.positions?.includes(positionFilter)) return false;
    if (teamFilter !== "all" && p.team_id !== teamFilter) return false;
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
    return 0;
  });
  
  const hasPendingOffer = (playerId) => (sentOffers || []).some(o => o.player_id === playerId && o.status === "pending");

  const uniqueTeams = [...new Set((players || []).filter(p => p.team_id).map(p => p.teams))].filter(Boolean);

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Игроки" />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {/* Фильтры */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", overflowX: "auto" }}>
            {[{ id: "all", label: "Все" }, { id: "free", label: "Свободные" }, { id: "team", label: "В команде" }].map(tab => (
              <button key={tab.id} onClick={() => setFilter(tab.id)} style={{
                padding: "8px 16px", borderRadius: "20px", border: "none",
                background: filter === tab.id ? colors.gold : colors.gray,
                color: filter === tab.id ? colors.bg : colors.text,
                fontWeight: 500, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
              }}>{tab.label}</button>
            ))}
          </div>
          
          {/* Фильтр по амплуа */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", overflowX: "auto" }}>
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

          {/* Фильтр по команде */}
          <Select 
            value={teamFilter} 
            onChange={setTeamFilter}
            options={[
              { value: "all", label: "Все команды" },
              ...uniqueTeams.map(t => ({ value: t.id, label: t.name }))
            ]}
          />
          
          {filteredPlayers.map(player => (
            <Card 
              key={player.id} 
              style={{ marginBottom: "12px", cursor: "pointer" }}
              onClick={() => { setSelectedPlayer(player); setScreen("playerDetail"); }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar name={player.users?.first_name || player.users?.username} size={48} url={player.users?.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "2px" }}>
                    {user?.favorite_players?.includes(player.id) && <span style={{ color: colors.gold, marginRight: "4px" }}>★</span>}
                    {player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}
                  </div>
                  <div style={{ fontSize: "13px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ") || "Амплуа не указано"}</div>
                  <div style={{ fontSize: "12px", color: colors.goldDark, marginTop: "2px" }}>{player.teams?.name || "Без команды"}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                  <Badge variant={player.is_free_agent ? "free" : "default"}>{player.is_free_agent ? "Свободен" : "В команде"}</Badge>
                  {canInvite && player.is_free_agent && (
                    hasPendingOffer(player.id) ? <Badge variant="pending">Приглашён</Badge> : (
                      <Button onClick={(e) => { e.stopPropagation(); onSendOffer(player.id); }} style={{ padding: "6px 12px", fontSize: "12px" }}><Icons.Send /> Пригласить</Button>
                    )
                  )}
                </div>
              </div>
            </Card>
          ))}
          {filteredPlayers.length === 0 && <Card style={{ textAlign: "center", color: colors.goldDark }}>Игроки не найдены</Card>}
        </div>
      </Container>
    </div>
  );
};

const PlayerDetailScreen = ({ setScreen, player, teams, setSelectedTeam, playerStats, matches, user, onToggleFavorite, userRoles }) => {
  const team = teams.find(t => t.id === player?.team_id);
  
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
    aces: acc.aces + (s.aces || 0),
    serve_errors: acc.serve_errors + (s.serve_errors || 0),
    receive_errors: acc.receive_errors + (s.receive_errors || 0),
    attack_points: acc.attack_points + (s.attack_points || 0),
    attack_errors: acc.attack_errors + (s.attack_errors || 0),
    block_points: acc.block_points + (s.block_points || 0),
    block_errors: acc.block_errors + (s.block_errors || 0),
  }), { games: 0, aces: 0, serve_errors: 0, receive_errors: 0, attack_points: 0, attack_errors: 0, block_points: 0, block_errors: 0 });
  
  // Считаем победы/поражения
  const playerMatches = stats.map(s => matches?.find(m => m.id === s.match_id)).filter(Boolean);
  const wins = playerMatches.filter(m => {
    if (m.status !== "finished") return false;
    const isTeam1 = m.team1_id === player?.team_id;
    return isTeam1 ? m.sets_team1 > m.sets_team2 : m.sets_team2 > m.sets_team1;
  }).length;
  const losses = totalStats.games - wins;
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Профиль игрока" showBack onBack={() => setScreen("players")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
            <Avatar name={player?.users?.first_name || player?.users?.username} size={80} url={player?.users?.avatar_url} />
            <h2 style={{ margin: "16px 0 4px", fontSize: "22px", fontWeight: 700 }}>
              {player?.users?.first_name || `@${player?.users?.username}`} {player?.users?.last_name || ""}
            </h2>
            {player?.users?.username && (
              <p style={{ margin: "0 0 12px", color: colors.goldDark, fontSize: "14px" }}>@{player.users.username}</p>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              {player?.is_captain && <Badge variant="captain">Капитан</Badge>}
              <Badge variant={player?.is_free_agent ? "free" : "gold"}>
                {player?.is_free_agent ? "Свободный игрок" : "В команде"}
              </Badge>
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

          {(player?.height || age) && (
            <Card style={{ marginBottom: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: player?.height && age ? "1fr 1fr" : "1fr", gap: "16px", textAlign: "center" }}>
                {player?.height && (
                  <div>
                    <div style={{ fontSize: "28px", fontWeight: 700, color: colors.gold }}>{player.height}</div>
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>Рост (см)</div>
                  </div>
                )}
                {age && (
                  <div>
                    <div style={{ fontSize: "28px", fontWeight: 700, color: colors.gold }}>{age}</div>
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>Возраст</div>
                  </div>
                )}
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
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: colors.goldDark }}>Амплуа</span>
                <span style={{ fontWeight: 600 }}>{player?.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</span>
              </div>
              {player?.jersey_number && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.goldDark }}>Номер</span>
                  <span style={{ fontWeight: 700, color: colors.gold }}>#{player.jersey_number}</span>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
                    <span style={{ color: colors.goldDark }}>Подача</span>
                    <span><span style={{ color: "#16a34a", fontWeight: 600 }}>{totalStats.aces} эйсов</span> / <span style={{ color: "#dc2626" }}>{totalStats.serve_errors} ош.</span></span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
                    <span style={{ color: colors.goldDark }}>Приём</span>
                    <span style={{ color: "#dc2626" }}>{totalStats.receive_errors} ошибок</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
                    <span style={{ color: colors.goldDark }}>Атака</span>
                    <span><span style={{ color: "#16a34a", fontWeight: 600 }}>{totalStats.attack_points} очков</span> / <span style={{ color: "#dc2626" }}>{totalStats.attack_errors} ош.</span></span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                    <span style={{ color: colors.goldDark }}>Блок</span>
                    <span><span style={{ color: "#16a34a", fontWeight: 600 }}>{totalStats.block_points} очков</span> / <span style={{ color: "#dc2626" }}>{totalStats.block_errors} ош.</span></span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", color: colors.goldDark, padding: "12px 0" }}>
                Статистика пока не заполнена
              </div>
            )}
          </Card>

          {player?.bio && (
            <Card style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>О СЕБЕ</h3>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5, color: colors.text }}>{player.bio}</p>
            </Card>
          )}

          {(() => {
            console.log("🔍 Telegram Button Debug:", {
              playerUsername: player?.users?.username,
              isAdmin: userRoles?.isAdmin,
              userRoles: userRoles,
              shouldShow: !!(player?.users?.username && userRoles?.isAdmin)
            });
            return null;
          })()}
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
                      <div style={{ width: "48px", height: "48px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>{team?.logo_url || "🏐"}</div>
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
                      <div style={{ display: "flex", gap: "8px" }}>
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
                      <div style={{ width: "40px", height: "40px", background: colors.gray, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>{team?.logo_url || "🏐"}</div>
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
  const pendingSentOffers = (sentOffers || []).filter(o => o.status === "pending");
  const pendingTeamRequests = (teamRequests || []).filter(r => r.team_id === myTeam?.id && r.status === "pending");

  // Для создания команды (тренер без команды)
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [editingJersey, setEditingJersey] = useState(null);
  const [jerseyValue, setJerseyValue] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);


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
                  <div style={{ width: "48px", height: "48px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>{team.logo_url || "🏐"}</div>
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
            <div style={{ width: "80px", height: "80px", background: colors.goldLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "40px" }}>{myTeam?.logo_url || "🏐"}</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 700 }}>{myTeam?.name}</h2>
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

          {canManageTeam && pendingTeamRequests.length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Заявки в команду ({pendingTeamRequests.length})</h3>
              {pendingTeamRequests.map(request => {
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
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button variant="success" onClick={() => onAcceptTeamRequest(request.id, request.player_id)} disabled={actionLoading} style={{ flex: 1, padding: "8px" }}>Принять</Button>
                      <Button variant="danger" onClick={() => onRejectTeamRequest(request.id)} disabled={actionLoading} style={{ flex: 1, padding: "8px" }}>Отклонить</Button>
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
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Состав ({teamPlayers.length})</h3>
            {canManageTeam && <Button variant="outline" onClick={() => setScreen("players")} style={{ padding: "6px 12px", fontSize: "12px" }}>+ Пригласить</Button>}
          </div>

          {teamPlayers.length > 0 ? teamPlayers.map(player => (
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

          {/* Team Message (for coach) */}
          {canManageTeam && (
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
  
  // Отдельные state для каждого поля (как в Input компоненте)
  const [aces, setAces] = useState(existingStat?.aces || "");
  const [serveErrors, setServeErrors] = useState(existingStat?.serve_errors || "");
  const [receiveErrors, setReceiveErrors] = useState(existingStat?.receive_errors || "");
  const [attackPoints, setAttackPoints] = useState(existingStat?.attack_points || "");
  const [attackErrors, setAttackErrors] = useState(existingStat?.attack_errors || "");
  const [blockPoints, setBlockPoints] = useState(existingStat?.block_points || "");
  const [blockErrors, setBlockErrors] = useState(existingStat?.block_errors || "");
  
  const handleSave = async () => {
    const stat = {
      aces, serve_errors: serveErrors, receive_errors: receiveErrors,
      attack_points: attackPoints, attack_errors: attackErrors,
      block_points: blockPoints, block_errors: blockErrors
    };
    await onSave(player.id, matchId, stat, existingStat?.id);
    setIsEditing(false);
  };
  
  
  if (!isEditing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
        <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
        <span style={{ fontSize: "13px", flex: 1 }}>{player.users?.first_name || player.users?.username}</span>
        {existingStat ? (
          <span style={{ fontSize: "11px", color: colors.goldDark }}>
            А:{existingStat.aces}/{existingStat.serve_errors} | Ат:{existingStat.attack_points}/{existingStat.attack_errors} | Б:{existingStat.block_points}
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
        <span style={{ fontSize: "13px", fontWeight: 600 }}>{player.users?.first_name || player.users?.username}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Подача</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <StatField label="Эйс" value={aces} onChange={setAces} />
            <StatField label="Ош" value={serveErrors} onChange={setServeErrors} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Приём</div>
          <StatField label="Ош" value={receiveErrors} onChange={setReceiveErrors} />
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Атака</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <StatField label="Очк" value={attackPoints} onChange={setAttackPoints} />
            <StatField label="Ош" value={attackErrors} onChange={setAttackErrors} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Блок</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <StatField label="Очк" value={blockPoints} onChange={setBlockPoints} />
            <StatField label="Ош" value={blockErrors} onChange={setBlockErrors} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
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
const AdminScreen = ({ setScreen, matches, teams, users, players, tours, playerStats, roleRequests, onUpdateMatch, onUpdateUserRole, onUpdateUser, onAssignCoach, onDeleteTeam, onSetCaptain, onCreateTour, onUpdateTour, onDeleteTour, onCreateMatch, onUpdateMatchInfo, onDeleteMatch, onUpdateMatchVideo, onSavePlayerStat, onMakePlayer, onDeleteUser, onApproveRequest, onRejectRequest, actionLoading, loadData, onUpdatePlayer, onChangeGameRole }) => {
  console.log("🔧 AdminScreen: Rendering");
  console.log("🔧 Props:", {
    matches: matches?.length ?? "undefined",
    teams: teams?.length ?? "undefined",
    users: users?.length ?? "undefined",
    players: players?.length ?? "undefined",
    tours: tours?.length ?? "undefined",
    playerStats: playerStats?.length ?? "undefined",
    roleRequests: roleRequests?.length ?? "undefined"
  });
  
  // Error boundary
  if (!setScreen) {
    console.error("❌ AdminScreen: setScreen is missing!");
    return <div style={{padding: "20px", color: "red"}}>Error: setScreen function is missing</div>;
  }
  
  const [tab, setTab] = useState("tours");
  const [editingTour, setEditingTour] = useState(null);
  const [tourData, setTourData] = useState({ number: "", date: "", location: "", address: "" });
  const [editingMatch, setEditingMatch] = useState(null);
  const [matchScore, setMatchScore] = useState({ 
    sets_team1: 0, sets_team2: 0, status: "upcoming",
    set1_team1: "", set1_team2: "", set2_team1: "", set2_team2: "", set3_team1: "", set3_team2: "",
    set4_team1: "", set4_team2: "", set5_team1: "", set5_team2: ""
  });
  const [editingUser, setEditingUser] = useState(null);
  const [userRole, setUserRole] = useState("fan");
  const [gameRole, setGameRole] = useState("fan");
  const [userFirstName, setUserFirstName] = useState("");
  const [userLastName, setUserLastName] = useState("");
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamCoach, setTeamCoach] = useState("");
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [teamMessage, setTeamMessage] = useState("");
  const [expandedMatch, setExpandedMatch] = useState(null);
  
  // Создание тура
  const [showCreateTour, setShowCreateTour] = useState(false);
  const [newTour, setNewTour] = useState({ number: "", date: "", location: "", address: "" });
  
  // Создание матча
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [editingMatchInfo, setEditingMatchInfo] = useState(null);
  const [matchInfo, setMatchInfo] = useState({ tour_id: "", team1_id: "", team2_id: "", scheduled_time: "" });
  const [newMatch, setNewMatch] = useState({ tour_id: "", team1_id: "", team2_id: "", scheduled_time: "" });
  
  // Редактирование видео
  const [editingVideo, setEditingVideo] = useState(null);
  const [videoData, setVideoData] = useState({ stream_url: "", video_url: "" });

  // Редактирование игрока
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerJersey, setPlayerJersey] = useState("");
  const [playerPositions, setPlayerPositions] = useState([]);

  const startEditPlayer = (player) => {
    setEditingPlayer(player);
    setPlayerJersey(player.jersey_number || "");
    setPlayerPositions(player.positions || []);
  };

  const savePlayer = async () => {
    if (!editingPlayer || !onUpdatePlayer) return;
    await onUpdatePlayer(editingPlayer.id, playerJersey, playerPositions);
    setEditingPlayer(null);
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
    await onUpdateUser(editingUser.id, userRole, userFirstName, userLastName);
    
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
  };

  const startEditTeam = (team) => {
    setEditingTeam(team);
    setTeamCoach(team.coach_id || "");
  };

  const saveTeam = async () => {
    await onAssignCoach(editingTeam.id, teamCoach || null);
    setEditingTeam(null);
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
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", overflowX: "auto" }}>
            {[
              { id: "tours", label: "Туры" },
              { id: "matches", label: "Матчи" },
              { id: "stats", label: "Статистика" },
              { id: "videos", label: "Видео" },
              { id: "users", label: "Пользователи" },
              { id: "teams", label: "Команды" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "10px 16px", borderRadius: "20px", border: "none",
                background: tab === t.id ? "#3b82f6" : colors.gray,
                color: tab === t.id ? "white" : colors.text,
                fontWeight: 600, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
              }}>{t.label}</button>
            ))}
          </div>

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
                  <Input label="Номер тура" type="number" value={newTour.number} onChange={v => setNewTour(p => ({ ...p, number: v }))} placeholder="1" />
                  <Input label="Дата" type="date" value={newTour.date} onChange={v => setNewTour(p => ({ ...p, date: v }))} />
                  <Input label="Место проведения" value={newTour.location} onChange={v => setNewTour(p => ({ ...p, location: v }))} placeholder="СК Олимп" />
                  <Input label="Адрес" value={newTour.address} onChange={v => setNewTour(p => ({ ...p, address: v }))} placeholder="ул. Спортивная, 1" />
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <Button onClick={localCreateTour} disabled={actionLoading || !newTour.number || !newTour.date} style={{ flex: 1, padding: "10px" }}>
                      <Icons.Save /> Создать
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateTour(false)} style={{ flex: 1, padding: "10px" }}>
                      Отмена
                    </Button>
                  </div>
                </Card>
              )}

              {(tours || []).sort((a, b) => a.number - b.number).map(tour => (
                <Card key={tour.id} style={{ marginBottom: "8px", padding: "12px" }}>
                  {editingTour?.id === tour.id ? (
                    <div>
                      <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Редактирование тура</h4>
                      <Input label="Номер тура" type="number" value={tourData.number} onChange={v => setTourData(p => ({ ...p, number: v }))} />
                      <Input label="Дата" type="date" value={tourData.date} onChange={v => setTourData(p => ({ ...p, date: v }))} />
                      <Input label="Место" value={tourData.location} onChange={v => setTourData(p => ({ ...p, location: v }))} />
                      <Input label="Адрес" value={tourData.address} onChange={v => setTourData(p => ({ ...p, address: v }))} />
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
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
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>Тур {tour.number}</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark }}>
                          {new Date(tour.date).toLocaleDateString("ru-RU")} • {tour.location}
                        </div>
                        <div style={{ fontSize: "11px", color: colors.goldDark }}>{tour.address}</div>
                      </div>
                      <Badge>{(matches || []).filter(m => m.tour_id === tour.id).length} матчей</Badge>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button onClick={() => {
                          setEditingTour(tour);
                          setTourData({ number: tour.number, date: tour.date, location: tour.location, address: tour.address });
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
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <Button onClick={localCreateMatch} disabled={actionLoading || !newMatch.tour_id || !newMatch.team1_id || !newMatch.team2_id || !newMatch.scheduled_time} style={{ flex: 1, padding: "10px" }}>
                      <Icons.Save /> Создать
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateMatch(false)} style={{ flex: 1, padding: "10px" }}>
                      Отмена
                    </Button>
                  </div>
                </Card>
              )}

              {(tours || []).map(tour => {
                const tourMatches = (matches || []).filter(m => m.tour_id === tour.id);
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
                              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
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
                              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
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
                                setMatchInfo({ 
                                  tour_id: match.tour_id, 
                                  team1_id: match.team1_id, 
                                  team2_id: match.team2_id, 
                                  scheduled_time: match.scheduled_time 
                                });
                              }} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", padding: "4px" }} title="Редактировать информацию">
                                ⚙️
                              </button>
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
              
              {(tours || []).map(tour => {
                const tourMatches = (matches || []).filter(m => m.tour_id === tour.id && m.status === "finished");
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
              
              {(tours || []).map(tour => {
                const tourMatches = (matches || []).filter(m => m.tour_id === tour.id);
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
                              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
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
                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
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
                    return (
                      <div key={request.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "white", borderRadius: "8px", marginBottom: "8px" }}>
                        <Avatar name={requestUser?.first_name || requestUser?.username} size={40} url={requestUser?.avatar_url} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{requestUser?.first_name || requestUser?.username} {requestUser?.last_name || ""}</div>
                          <div style={{ fontSize: "12px", color: colors.goldDark }}>
                            Хочет стать: <strong>{request.requested_role === "player" ? "Игроком" : request.requested_role === "coach" ? "Тренером" : "Болельщиком"}</strong>
                          </div>
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
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "16px" }}>
                Роли вычисляются автоматически: Тренер — если назначен на команду, Капитан — если отмечен в составе, Игрок — если есть в players
              </p>
              {users.map(u => {
                const isEditing = editingUser?.id === u.id;
                const userPlayerRecord = players.find(p => p.user_id === u.id);
                const userCoachTeam = teams.find(t => t.coach_id === u.id);
                const hasCoachRequest = (roleRequests || []).some(r => r.user_id === u.id && r.requested_role === "coach" && r.status === "approved");
                
                // Вычисляем все роли пользователя (как это делает getUserRoles)
                const displayRoles = [];
                if (u.role === "admin") displayRoles.push({ label: "Админ", variant: "admin" });
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
                        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
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
                        <Select label="Права администратора" value={userRole} onChange={setUserRole}
                          options={[
                            { value: "fan", label: "Обычный пользователь" },
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
                        {false && (
                          <Button 
                            onClick={() => onMakePlayer(u.id)} 
                            disabled={actionLoading}
                            style={{ width: "100%", marginBottom: "8px", background: "#16a34a" }}
                          >
                            🏐 Сделать игроком (свободный агент)
                          </Button>
                        )}

                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
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
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Управление командами ({teams.length})</h3>
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "16px" }}>
                Назначьте тренера для команды. Любой пользователь может быть тренером.
              </p>
              {teams.map(team => {
                const coach = users.find(u => u.id === team.coach_id);
                const isEditing = editingTeam?.id === team.id;
                const isExpanded = expandedTeam === team.id;
                const teamPlayers = (players || []).filter(p => p.team_id === team.id);
                
                return (
                  <Card key={team.id} style={{ marginBottom: "8px", padding: "12px" }}>
                    {isEditing ? (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: "12px" }}>{team.name}</div>
                        <Select label="Тренер команды" value={teamCoach} onChange={setTeamCoach}
                          options={[
                            { value: "", label: "Не назначен" },
                            ...(users || []).map(u => ({
                              value: u.id,
                              label: `${u.first_name || u.username || "—"} ${u.last_name || ""}`.trim()
                            }))
                          ]}
                        />
                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                          <Button onClick={saveTeam} disabled={actionLoading} style={{ flex: 1, padding: "10px" }}>
                            <Icons.Save /> Сохранить
                          </Button>
                          <Button variant="outline" onClick={() => setEditingTeam(null)} style={{ flex: 1, padding: "10px" }}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "40px", height: "40px", background: colors.goldLight, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                            {team.logo_url || "🏐"}
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
                          <button onClick={() => startEditTeam(team)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }}>
                            <Icons.Edit />
                          </button>
                          <button onClick={() => onDeleteTeam(team.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }} title="Удалить команду">
                            <Icons.X />
                          </button>
                        </div>
                        
                        {isExpanded && (
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colors.grayBorder}` }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>Состав команды:</div>
                            {teamPlayers.length > 0 ? teamPlayers.map(player => (
                              <div key={player.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
                                {editingPlayer?.id === player.id ? (
                                  <div style={{ background: colors.gray, padding: "12px", borderRadius: "8px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                      <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
                                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{player.users?.first_name || player.users?.username}</span>
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
                                    <div style={{ display: "flex", gap: "8px" }}>
                                      <button onClick={savePlayer} style={{ flex: 1, padding: "6px", background: colors.gold, color: "white", border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>Сохранить</button>
                                      <button onClick={() => setEditingPlayer(null)} style={{ flex: 1, padding: "6px", background: colors.grayBorder, border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>Отмена</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
                                    <span style={{ fontSize: "13px", flex: 1 }}>{player.users?.first_name || player.users?.username}{player.is_captain && <span style={{ marginLeft: "4px", color: colors.gold }}>©</span>}</span>
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
                                  const result = await sendTeamMessage(team.id, team.name, teamMessage);
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
        </div>
      </Container>
    </div>
  );
};

const ProfileScreen = ({ user, onLogout, isGuest, isTelegram, setScreen, pendingOffers, userRoles, onUpdateNotifications, roleRequests, onSubmitRoleRequest, onRequestPhone, currentPlayer, onUpdatePosition }) => {
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button 
                    onClick={() => onSubmitRoleRequest("player")} 
                    style={{ flex: 1, background: "#16a34a" }}
                  >
                    🏃 Стать игроком
                  </Button>
                  <Button 
                    onClick={() => onSubmitRoleRequest("coach")} 
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button onClick={() => onSubmitRoleRequest("coach")} style={{ flex: 1, background: "#0284c7" }}>📋 Стать тренером</Button>
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button onClick={() => onSubmitRoleRequest("player")} style={{ flex: 1, background: "#16a34a" }}>🏃 Стать игроком</Button>
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
                <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                  <Button
                    onClick={async () => {
                      if (!organizerMessage.trim()) {
                        alert("Введите сообщение");
                        return;
                      }
                      setSendingToOrganizers(true);
                      const userName = `${user?.first_name || user?.username || "Пользователь"} ${user?.last_name || ""}`.trim();
                      const result = await sendToOrganizers(userName, user?.telegram_id, organizerMessage);
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
  const [screen, setScreen] = useState("welcome");
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tours, setTours] = useState([]);
  const [players, setPlayers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [teamRequests, setTeamRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [playerStats, setPlayerStats] = useState([]);
  const [roleRequests, setRoleRequests] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

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
      const { data: teamsData } = await supabase.from("teams").select("*").order("points", { ascending: false });
      const { data: toursData } = await supabase.from("tours").select("*").order("number");
      const { data: matchesData } = await supabase.from("matches").select("*").order("scheduled_time");
      const { data: playersData } = await supabase.from("players").select("*");
      const { data: usersData } = await supabase.from("users").select("*");
      const { data: offersData } = await supabase.from("offers").select("*").order("created_at", { ascending: false });
      const { data: teamRequestsData } = await supabase.from("team_requests").select("*").order("created_at", { ascending: false });
      const { data: playerStatsData } = await supabase.from("match_player_stats").select("*");
      const { data: roleRequestsData } = await supabase.from("role_requests").select("*").order("created_at", { ascending: false });

      const playersWithDetails = (playersData || []).map(player => ({
        ...player,
        users: usersData?.find(u => u.id === player.user_id) || null,
        teams: teamsData?.find(t => t.id === player.team_id) || null,
      }));

      setTeams(teamsData || []);
      setTours(toursData || []);
      setMatches(matchesData || []);
      setPlayers(playersWithDetails);
      setOffers(offersData || []);
      setTeamRequests(teamRequestsData || []);
      setUsers(usersData || []);
      setPlayerStats(playerStatsData || []);
      setRoleRequests(roleRequestsData || []);
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
          await fetch(`https://api.telegram.org/bot8513614914:AAFygkqgY7IBf5ktbzcdSXZF7QCOwjrCRAI/sendMessage`, {
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
      // Сначала отклоняем все другие pending офферы
      console.log("🏐 AcceptOffer: Rejecting other pending offers");
      await supabase.from("offers").update({ status: "rejected" }).eq("player_id", currentPlayer.id).eq("status", "pending").neq("id", offerId);
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
      setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: "rejected" } : o));
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
      const { data, error } = await supabase.from("team_requests").insert({ 
        team_id: teamId, 
        player_id: currentPlayer.id, 
        status: "pending" 
      }).select().single();
      if (error) throw error;
      setTeamRequests(prev => [data, ...prev]);
      
      // Уведомляем тренера команды
      const team = teams.find(t => t.id === teamId);
      const coach = players.find(p => p.team_id === teamId && p.id === team?.coach_id);
      if (coach?.users?.telegram_id) {
        const playerName = user?.first_name || user?.username || "Игрок";
        const message = `📝 Новая заявка в команду!\n\n${playerName} хочет вступить в команду "${team?.name}".\n\nПроверьте в разделе "Моя команда".`;
        try {
          await fetch(`https://api.telegram.org/bot8513614914:AAFygkqgY7IBf5ktbzcdSXZF7QCOwjrCRAI/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: coach.users.telegram_id, text: message }),
          });
        } catch (e) { console.error("Failed to notify coach:", e); }
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
      // Принимаем заявку
      await supabase.from("team_requests").update({ status: "accepted" }).eq("id", requestId);
      // Добавляем игрока в команду
      await supabase.from("players").update({ team_id: coachTeam.id, is_free_agent: false }).eq("id", playerId);
      // Отклоняем другие заявки этого игрока
      await supabase.from("team_requests").update({ status: "rejected" }).eq("player_id", playerId).eq("status", "pending").neq("id", requestId);
      // Очищаем favorite_team_id
      const player = players.find(p => p.id === playerId);
      if (player?.user_id) {
        await supabase.from("users").update({ favorite_team_id: null }).eq("id", player.user_id);
      }
      await loadData();
      alert("Игрок принят в команду!");
    } catch (error) {
      console.error("Error accepting team request:", error);
      alert("Ошибка при принятии заявки");
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
                await fetch(`https://api.telegram.org/bot8513614914:AAFygkqgY7IBf5ktbzcdSXZF7QCOwjrCRAI/sendMessage`, {
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
        // Удаляем из игроков команды
        await supabase.from("players").update({ team_id: null, is_free_agent: true, is_captain: false }).eq("id", currentPlayer.id);
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
      
      // Обновляем матч
      await supabase.from("matches").update({
        sets_team1: setsWon1,
        sets_team2: setsWon2,
        set1_team1: data.set1_team1 || 0, set1_team2: data.set1_team2 || 0,
        set2_team1: data.set2_team1 || 0, set2_team2: data.set2_team2 || 0,
        set3_team1: data.set3_team1 || 0, set3_team2: data.set3_team2 || 0,
        set4_team1: data.set4_team1 || 0, set4_team2: data.set4_team2 || 0,
        set5_team1: data.set5_team1 || 0, set5_team2: data.set5_team2 || 0,
        status: data.status,
      }).eq("id", matchId);

      // Если матч завершен или БЫЛ завершен - пересчитываем статистику
      if (data.status === "finished" || match.status === "finished") {
        console.log("📊 Recalculating stats for both teams after match update");
        // Пересчитываем статистику для обеих команд
        await recalculateTeamStats(match.team1_id);
        await recalculateTeamStats(match.team2_id);
        
        // Отправляем уведомление о результате (только если статус ИЗМЕНИЛСЯ на finished)
        if (data.status === "finished" && match.status !== "finished") {
          sendNotification("result", team1?.name, team2?.name, `${setsWon1}:${setsWon2}`);
        }
      }
      
      // Уведомление о начале матча (LIVE)
      if (data.status === "live" && match.status !== "live") {
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

  const handleUpdateUser = async (userId, role, firstName, lastName) => {
    try {
      setActionLoading(true);
      await supabase.from("users").update({ 
        role, 
        first_name: firstName,
        last_name: lastName,
        name_edited_by_admin: true
      }).eq("id", userId);
      await loadData();
      alert("Пользователь обновлён!");
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Ошибка обновления");
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
          await fetch(`https://api.telegram.org/bot8513614914:AAFygkqgY7IBf5ktbzcdSXZF7QCOwjrCRAI/sendMessage`, {
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
      // Удаляем связанные записи
      await supabase.from("role_requests").delete().eq("user_id", userId);
      await supabase.from("players").delete().eq("user_id", userId);
      await supabase.from("offers").delete().eq("player_id", userId);
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
  const handleUpdatePlayer = async (playerId, jerseyNumber, positions) => {
    try {
      setActionLoading(true);
      await supabase.from('players').update({ 
        jersey_number: jerseyNumber || null,
        positions: positions || []
      }).eq('id', playerId);
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
    return await sendTeamMessage(teamId, teamName, message);
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



  // Create tour
  const handleCreateTour = async (tourData) => {
    try {
      setActionLoading(true);
      const { error } = await supabase.from("tours").insert({
        number: parseInt(tourData.number),
        date: tourData.date,
        location: tourData.location,
        address: tourData.address,
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
        date: tourData.date,
        location: tourData.location,
        address: tourData.address,
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
      await supabase.from("matches").update({
        tour_id: matchData.tour_id,
        team1_id: matchData.team1_id,
        team2_id: matchData.team2_id,
        scheduled_time: matchData.scheduled_time,
      }).eq("id", matchId);
      await loadData();
      alert("Информация о матче обновлена!");
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
    try {
      setActionLoading(true);
      
      // Находим игрока чтобы узнать его team_id в момент матча
      const player = players.find(p => p.id === playerId);
      const teamId = player?.team_id;
      
      if (existingId) {
        await supabase.from("match_player_stats").update(stat).eq("id", existingId);
      } else {
        await supabase.from("match_player_stats").insert({
          player_id: playerId,
          match_id: matchId,
          team_id: teamId, // Сохраняем команду в момент матча
          ...stat
        });
      }
      await loadData();
      alert("Статистика сохранена!");
    } catch (error) {
      console.error("Error saving player stat:", error);
      alert("Ошибка сохранения статистики");
    } finally {
      setActionLoading(false);
    }
  };

const handleTelegramLogin = async (tgUser) => {
    try {
      const { data: existingUser } = await supabase.from("users").select("*").eq("telegram_id", tgUser.id).single();
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
        if (!error) currentUser = newUser;
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
  const handleSubmitRoleRequest = async (requestedRole) => {
    try {
      if (!user?.id) {
        alert("Ошибка: пользователь не найден. Попробуйте перезайти.");
        return;
      }
      await supabase.from("role_requests").insert({
        user_id: user.id,
        requested_role: requestedRole,
        status: "pending",
      });
      await supabase.from("users").update({ onboarding_completed: true }).eq("id", user.id);
      setUser(prev => ({ ...prev, onboarding_completed: true }));
      setShowOnboarding(false);
      setScreen("home");
      await loadData();
    
    // Отправляем уведомление админам
    const roleName = requestedRole === "player" ? "игроком" : requestedRole === "coach" ? "тренером" : "болельщиком";
    const userName = user.first_name || user.username || "Пользователь";
    const message = `🆕 Новая заявка!\n\n${userName} хочет стать ${roleName}.\n\nПроверьте в админ-панели.`;
    
    // Получаем всех админов
    const { data: admins } = await supabase.from("users").select("telegram_id").eq("role", "admin");
    if (admins && admins.length > 0) {
      for (const admin of admins) {
        if (admin.telegram_id) {
          try {
            await fetch(`https://api.telegram.org/bot8513614914:AAFygkqgY7IBf5ktbzcdSXZF7QCOwjrCRAI/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: admin.telegram_id, text: message }),
            });
          } catch (e) { console.error("Failed to notify admin:", e); }
        }
      }
    }
    
    alert("Заявка отправлена! Ожидайте одобрения администратора.");
    } catch (error) {
      console.error("Error submitting role request:", error);
      alert("Ошибка отправки заявки. Попробуйте ещё раз.");
    }
  };

  // Одобрение заявки (для админа)
  const handleApproveRoleRequest = async (requestId, userId, role) => {
    console.log("👤 ApproveRole: Starting -", {requestId, userId, role});
    try {
      setActionLoading(true);
      
      // Обновляем статус заявки
      await supabase.from("role_requests").update({ 
        status: "approved", 
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id 
      }).eq("id", requestId);
      
      if (role === "player") {
        // Проверяем является ли человек тренером какой-то команды
        const coachingTeam = teams.find(t => t.coach_id === userId);
        console.log("👤 ApproveRole (player): Coaching team?", coachingTeam ? coachingTeam.name : "NO");
        
        // Проверяем есть ли уже player record
        const existing = players.find(p => p.user_id === userId);
        console.log("👤 ApproveRole: Existing player record?", existing ? "YES" : "NO");
        
        if (existing) {
          console.log("👤 ApproveRole: Updating existing player record");
          // Если тренер своей команды - добавляем как игрока в ту же команду
          if (coachingTeam) {
            await supabase.from("players").update({
              team_id: coachingTeam.id,
              is_free_agent: false,
              is_captain: false,
            }).eq("user_id", userId);
            console.log("👤 ApproveRole: Added as player to coached team:", coachingTeam.name);
          } else {
            // Если не тренер - делаем свободным агентом
            await supabase.from("players").update({
              is_free_agent: true,
              team_id: null,
              is_captain: false,
            }).eq("user_id", userId);
          }
        } else {
          // Создаем новый player record
          if (coachingTeam) {
            // Если тренер - добавляем в свою команду
            await supabase.from("players").insert({
              user_id: userId,
              team_id: coachingTeam.id,
              is_free_agent: false,
              is_captain: false,
              positions: [],
            });
            console.log("👤 ApproveRole: Created player in coached team:", coachingTeam.name);
          } else {
            // Если не тренер - свободный агент
            await supabase.from("players").insert({
              user_id: userId,
              is_free_agent: true,
              is_captain: false,
              positions: [],
            });
          }
        }
        // НЕ снимаем с тренерства! Тренер может быть игроком своей команды
      } 
      else if (role === "coach") {
        // Для тренера нужно будет назначить команду отдельно
        const playerRecord = players.find(p => p.user_id === userId);
        console.log("👤 ApproveRole (coach): Player record:", playerRecord?.id, "team:", playerRecord?.team_id);
        if (playerRecord && playerRecord.team_id) {
          const hisTeam = teams.find(t => t.coach_id === userId);
          console.log("👤 ApproveRole (coach): His coaching team:", hisTeam?.id, hisTeam?.name);
          // Если игрок в другой команде (не та где он тренер) - выводим
          if (!hisTeam || hisTeam.id !== playerRecord.team_id) {
            console.log("👤 ApproveRole (coach): Removing from player team (incompatible)");
            await supabase.from("players").update({ team_id: null, is_captain: false, is_free_agent: true }).eq("id", playerRecord.id);
          } else {
            console.log("👤 ApproveRole (coach): Keeping as player of same team (allowed)");
          }
        }
      }
      else if (role === "fan") {
        // Удаляем из игроков
        await supabase.from("players").delete().eq("user_id", userId);
        // Снимаем с тренерства
        await supabase.from("teams").update({ coach_id: null }).eq("coach_id", userId);
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
      case "onboarding": return <OnboardingScreen user={user} onComplete={handleCompleteOnboarding} onSubmitRequest={handleSubmitRoleRequest} />;
      case "home": return <HomeScreen setScreen={setScreen} user={user} teams={teams} matches={matches} players={players} pendingOffers={pendingOffers} userRoles={userRoles} setSelectedPlayer={setSelectedPlayer} playerStats={playerStats} />;
      case "teams": return <TeamsScreen setScreen={setScreen} teams={teams} setSelectedTeam={setSelectedTeam} user={user} myTeamId={userRoles.playerRecord?.team_id} />;
      case "teamDetail": return <TeamDetailScreen setScreen={setScreen} team={selectedTeam} players={players} setSelectedPlayer={setSelectedPlayer} user={user} onSelectFavoriteTeam={handleSelectFavoriteTeam} userRoles={userRoles} currentPlayer={currentPlayer} onLeaveTeam={handleLeaveTeam} onSendTeamRequest={handleSendTeamRequest} teamRequests={teamRequests} actionLoading={actionLoading} />;
      case "playerDetail": return <PlayerDetailScreen setScreen={setScreen} player={selectedPlayer} teams={teams} setSelectedTeam={setSelectedTeam} playerStats={playerStats} matches={matches} user={user} onToggleFavorite={handleToggleFavoritePlayer} userRoles={userRoles} />;
      case "players": return <PlayersScreen setScreen={setScreen} players={players} userRoles={userRoles} coachTeam={coachTeam} onSendOffer={handleSendOffer} sentOffers={sentOffers} setSelectedPlayer={setSelectedPlayer} user={user} myPlayerId={userRoles.playerRecord?.id} />;
      case "offers": return <OffersScreen setScreen={setScreen} offers={offers.filter(o => o.player_id === currentPlayer?.id)} teams={teams} onAccept={handleAcceptOffer} onReject={handleRejectOffer} loading={actionLoading} isInTeam={!currentPlayer?.is_free_agent} />;
      case "myteam": return <MyTeamScreen setScreen={setScreen} user={user} teams={teams} players={players} coachTeam={coachTeam} currentPlayer={currentPlayer} sentOffers={sentOffers} onRemovePlayer={handleRemovePlayer} onSelectFavoriteTeam={handleSelectFavoriteTeam} onLeaveTeam={handleLeaveTeam} actionLoading={actionLoading} userRoles={userRoles} setSelectedPlayer={setSelectedPlayer} teamRequests={teamRequests} onAcceptTeamRequest={handleAcceptTeamRequest} onRejectTeamRequest={handleRejectTeamRequest} onUpdateJerseyNumber={handleUpdateJerseyNumber} onSetCaptain={handleSetCaptain} onSendTeamMessage={handleSendTeamMessage} onCreateTeam={handleCreateTeam} />;
      case "schedule": return <ScheduleScreen matches={matches} teams={teams} tours={tours} isGuest={isGuest} setSelectedTeam={setSelectedTeam} setScreen={setScreen} />;
      case "table": return <TableScreen teams={teams} setSelectedTeam={setSelectedTeam} setScreen={setScreen} />;
      case "profile": return <ProfileScreen user={user} onLogout={handleLogout} isGuest={isGuest} isTelegram={isTelegram} setScreen={setScreen} pendingOffers={pendingOffers} userRoles={userRoles} onUpdateNotifications={handleUpdateNotifications} roleRequests={roleRequests} onSubmitRoleRequest={handleSubmitRoleRequest} onRequestPhone={handleRequestPhone} currentPlayer={currentPlayer} onUpdatePosition={handleUpdatePosition} />;
      case "admin": return <AdminScreen setScreen={setScreen} matches={matches} teams={teams} users={users} players={players} tours={tours} playerStats={playerStats} roleRequests={roleRequests} onUpdateMatch={handleUpdateMatch} onUpdateUserRole={handleUpdateUserRole} onUpdateUser={handleUpdateUser} onAssignCoach={handleAssignCoach} onDeleteTeam={handleDeleteTeam} onSetCaptain={handleSetCaptain} onCreateTour={handleCreateTour} onUpdateTour={handleUpdateTour} onDeleteTour={handleDeleteTour} onCreateMatch={handleCreateMatch} onDeleteMatch={handleDeleteMatch} onUpdateMatchInfo={handleUpdateMatchInfo} onUpdateMatchVideo={handleUpdateMatchVideo} onSavePlayerStat={handleSavePlayerStat} onMakePlayer={handleMakePlayer} onDeleteUser={handleDeleteUser} onApproveRequest={handleApproveRoleRequest} onRejectRequest={handleRejectRoleRequest} actionLoading={actionLoading} loadData={loadData} onUpdatePlayer={handleUpdatePlayer} onChangeGameRole={handleChangeGameRole} />;
      default: return <HomeScreen setScreen={setScreen} user={user} teams={teams} matches={matches} players={players} pendingOffers={pendingOffers} userRoles={userRoles} playerStats={playerStats} />;
    }
  };

  const showNav = !["welcome", "admin"].includes(screen);
  const safeAreaTop = tg?.safeAreaInset?.top || tg?.contentSafeAreaInset?.top || 0;

  return (
    <div style={{ 
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", 
      background: colors.bg, 
      minHeight: "100vh",
      paddingTop: isTelegram ? (safeAreaTop > 0 ? `${safeAreaTop}px` : "60px") : "0",
    }}>
      {renderScreen()}
      {showNav && <NavBar active={screen} setScreen={setScreen} />}
    </div>
  );
}
