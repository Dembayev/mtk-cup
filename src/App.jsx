import { useState, useEffect } from "react";
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
const getUserRoles = (user, players, teams) => {
  if (!user) return { isGuest: true, isFan: false, isPlayer: false, isCaptain: false, isCoach: false, isAdmin: false, roles: [] };
  
  const isAdmin = user.role === "admin";
  const playerRecord = players?.find(p => p.user_id === user.id);
  const isPlayer = !!playerRecord;
  const isCaptain = playerRecord?.is_captain === true;
  const isCoach = teams?.some(t => t.coach_id === user.id) || false;
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
    padding: "16px 20px",
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
    { id: "myteam", icon: Icons.Heart, label: "Моя команда" },
    { id: "schedule", icon: Icons.Calendar, label: "Матчи" },
    { id: "table", icon: Icons.Trophy, label: "Таблица" },
    { id: "players", icon: Icons.Zap, label: "Игроки" },
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
const WelcomeScreen = ({ onLogin, onGuest, isTelegram }) => (
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
    <p style={{ color: colors.goldDark, fontSize: "16px", margin: "0 0 48px", fontWeight: 500 }}>Волейбольная лига Амура</p>
    {isTelegram ? (
      <Button onClick={onLogin} style={{ width: "100%", maxWidth: "280px", marginBottom: "12px" }}>Войти</Button>
    ) : (
      <>
        <Button onClick={onLogin} style={{ width: "100%", maxWidth: "280px", marginBottom: "12px" }}>Войти через Telegram</Button>
        <Button variant="outline" onClick={onGuest} style={{ width: "100%", maxWidth: "280px" }}>Смотреть как гость</Button>
      </>
    )}
  </div>
);

const HomeScreen = ({ setScreen, user, teams, matches, players, pendingOffers, userRoles }) => {
  const liveMatch = matches.find(m => m.status === "live");
  const upcomingMatches = matches.filter(m => m.status === "upcoming").slice(0, 2);
  const topPlayers = (players || []).filter(p => !p.is_free_agent).slice(0, 5);
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
                <Card key={match.id} style={{ marginBottom: "12px" }}><MatchCard match={match} teams={teams} /></Card>
              ))}
              <Button variant="outline" onClick={() => setScreen("schedule")} style={{ width: "100%", marginTop: "8px" }}>Всё расписание</Button>
            </>
          )}

          {topPlayers.length > 0 && (
            <>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "24px 0 12px" }}>Игроки</h3>
              {topPlayers.map(player => (
                <Card key={player.id} style={{ marginBottom: "8px", padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Avatar name={player.users?.first_name || player.users?.username} size={40} url={player.users?.avatar_url} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}</div>
                      <div style={{ fontSize: "12px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ")} • {player.teams?.name || "Без команды"}</div>
                    </div>
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

const TeamsScreen = ({ setScreen, teams, setSelectedTeam }) => (
  <div style={{ paddingBottom: "100px" }}>
    <Header title="Команды" showBack onBack={() => setScreen("home")} />
    <Container>
      <div style={{ padding: "20px 0" }}>
        <p style={{ color: colors.goldDark, marginBottom: "16px" }}>{teams.length} команд в турнире</p>
        {teams.map(team => (
          <Card key={team.id} onClick={() => { setSelectedTeam(team); setScreen("teamDetail"); }} style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "56px", height: "56px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>{team.logo_url || "🏐"}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600 }}>{team.name}</h3>
                <p style={{ margin: 0, fontSize: "13px", color: colors.goldDark }}>{team.wins}В {team.losses}П • {team.points} очков</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "20px", fontWeight: 700, color: colors.gold }}>#{teams.indexOf(team) + 1}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Container>
  </div>
);

const TeamDetailScreen = ({ setScreen, team, players, setSelectedPlayer }) => {
  const teamPlayers = players.filter(p => p.team_id === team?.id);
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title={team?.name || "Команда"} showBack onBack={() => setScreen("teams")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ width: "80px", height: "80px", background: colors.goldLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "40px" }}>{team?.logo_url || "🏐"}</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 700 }}>{team?.name}</h2>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge>{team?.games_played || 0} игр</Badge>
              <Badge variant="gold">{team?.points || 0} очков</Badge>
            </div>
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
    matches: matches.filter(m => m.tour_id === tour.id).sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time)),
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

const PlayersScreen = ({ setScreen, players, userRoles, coachTeam, onSendOffer, sentOffers, setSelectedPlayer }) => {
  const [filter, setFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  
  const canInvite = (userRoles.isCoach || userRoles.isAdmin) && coachTeam;
  
  const filteredPlayers = players.filter(p => {
    if (filter === "free" && !p.is_free_agent) return false;
    if (filter === "team" && p.is_free_agent) return false;
    if (positionFilter !== "all" && !p.positions?.includes(positionFilter)) return false;
    if (teamFilter !== "all" && p.team_id !== teamFilter) return false;
    return true;
  });
  
  const hasPendingOffer = (playerId) => sentOffers.some(o => o.player_id === playerId && o.status === "pending");

  const uniqueTeams = [...new Set(players.filter(p => p.team_id).map(p => p.teams))].filter(Boolean);

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
                  <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "2px" }}>{player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}</div>
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

const PlayerDetailScreen = ({ setScreen, player, teams, setSelectedTeam, playerStats, matches }) => {
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

          {player?.users?.username && (
            <Button variant="outline" onClick={() => window.open(`https://t.me/${player.users.username}`, '_blank')} style={{ width: "100%", marginTop: "8px" }}>
              <Icons.Send /> Написать в Telegram
            </Button>
          )}
        </div>
      </Container>
    </div>
  );
};

const OffersScreen = ({ setScreen, offers, teams, onAccept, onReject, loading }) => {
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
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button variant="success" onClick={() => onAccept(offer.id, offer.team_id)} disabled={loading} style={{ flex: 1, padding: "10px" }}><Icons.Check /> Принять</Button>
                      <Button variant="danger" onClick={() => onReject(offer.id)} disabled={loading} style={{ flex: 1, padding: "10px" }}><Icons.X /> Отклонить</Button>
                    </div>
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

const MyTeamScreen = ({ setScreen, user, teams, players, coachTeam, currentPlayer, sentOffers, onRemovePlayer, onSelectFavoriteTeam, actionLoading, userRoles }) => {
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
  
  const teamPlayers = myTeam ? players.filter(p => p.team_id === myTeam.id) : [];
  const pendingSentOffers = sentOffers.filter(o => o.status === "pending");

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
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>У вас нет команды</h3>
              <p style={{ margin: 0, fontSize: "14px", color: colors.goldDark }}>Свяжитесь с администратором для назначения</p>
            </Card>
          </div>
        </Container>
      </div>
    );
  }

  const canManageTeam = teamRelation === "coach";

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Моя команда" rightElement={teamRelation === "fan" && (
        <button onClick={() => onSelectFavoriteTeam(null)} style={{ background: "none", border: "none", color: colors.goldDark, fontSize: "13px", cursor: "pointer" }}>Сменить</button>
      )} />
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
                <Avatar name={player.users?.first_name || player.users?.username} size={44} url={player.users?.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>
                    {player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}
                    {player.is_captain && <span style={{ marginLeft: "6px", color: colors.gold }}>©</span>}
                  </div>
                  <div style={{ fontSize: "12px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</div>
                </div>
                {player.jersey_number && <div style={{ fontSize: "16px", fontWeight: 700, color: colors.gold, marginRight: "8px" }}>#{player.jersey_number}</div>}
                {canManageTeam && player.user_id !== user?.id && (
                  <button onClick={() => { if (confirm(`Удалить ${player.users?.first_name || 'игрока'} из команды?`)) onRemovePlayer(player.id); }} disabled={actionLoading}
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px", opacity: actionLoading ? 0.5 : 1 }}>
                    <Icons.X />
                  </button>
                )}
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

// Player Stat Input Component
const PlayerStatInput = ({ player, matchId, existingStat, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [stat, setStat] = useState({
    aces: existingStat?.aces || 0,
    serve_errors: existingStat?.serve_errors || 0,
    receive_errors: existingStat?.receive_errors || 0,
    attack_points: existingStat?.attack_points || 0,
    attack_errors: existingStat?.attack_errors || 0,
    block_points: existingStat?.block_points || 0,
    block_errors: existingStat?.block_errors || 0,
  });
  
  const handleSave = async () => {
    await onSave(player.id, matchId, stat, existingStat?.id);
    setIsEditing(false);
  };
  
  const StatField = ({ label, field, color }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span style={{ fontSize: "11px", color: colors.goldDark, width: "30px" }}>{label}</span>
      <input 
        type="number" 
        min="0" 
        value={stat[field]} 
        onChange={e => setStat(prev => ({ ...prev, [field]: parseInt(e.target.value) || 0 }))}
        style={{ width: "40px", padding: "4px", textAlign: "center", borderRadius: "4px", border: `1px solid ${colors.grayBorder}`, fontSize: "12px" }}
      />
    </div>
  );
  
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
            <StatField label="Эйс" field="aces" />
            <StatField label="Ош" field="serve_errors" />
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Приём</div>
          <StatField label="Ош" field="receive_errors" />
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Атака</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <StatField label="Очк" field="attack_points" />
            <StatField label="Ош" field="attack_errors" />
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Блок</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <StatField label="Очк" field="block_points" />
            <StatField label="Ош" field="block_errors" />
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
const AdminScreen = ({ setScreen, matches, teams, users, players, tours, playerStats, onUpdateMatch, onUpdateUserRole, onAssignCoach, onSetCaptain, onCreateTour, onCreateMatch, onUpdateMatchVideo, onSavePlayerStat, actionLoading, loadData }) => {
  const [tab, setTab] = useState("tours");
  const [editingMatch, setEditingMatch] = useState(null);
  const [matchScore, setMatchScore] = useState({ 
    sets_team1: 0, sets_team2: 0, status: "upcoming",
    set1_team1: 0, set1_team2: 0, set2_team1: 0, set2_team2: 0, set3_team1: 0, set3_team2: 0,
    set4_team1: 0, set4_team2: 0, set5_team1: 0, set5_team2: 0
  });
  const [editingUser, setEditingUser] = useState(null);
  const [userRole, setUserRole] = useState("fan");
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamCoach, setTeamCoach] = useState("");
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [expandedMatch, setExpandedMatch] = useState(null);
  
  // Создание тура
  const [showCreateTour, setShowCreateTour] = useState(false);
  const [newTour, setNewTour] = useState({ number: "", date: "", location: "", address: "" });
  
  // Создание матча
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [newMatch, setNewMatch] = useState({ tour_id: "", team1_id: "", team2_id: "", scheduled_time: "" });
  
  // Редактирование видео
  const [editingVideo, setEditingVideo] = useState(null);
  const [videoData, setVideoData] = useState({ stream_url: "", video_url: "" });

  const startEditMatch = (match) => {
    setEditingMatch(match);
    setMatchScore({
      sets_team1: match.sets_team1 || 0, sets_team2: match.sets_team2 || 0, status: match.status || "upcoming",
      set1_team1: match.set1_team1 || 0, set1_team2: match.set1_team2 || 0,
      set2_team1: match.set2_team1 || 0, set2_team2: match.set2_team2 || 0,
      set3_team1: match.set3_team1 || 0, set3_team2: match.set3_team2 || 0,
      set4_team1: match.set4_team1 || 0, set4_team2: match.set4_team2 || 0,
      set5_team1: match.set5_team1 || 0, set5_team2: match.set5_team2 || 0,
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
  };

  const saveUser = async () => {
    await onUpdateUserRole(editingUser.id, userRole);
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

  const handleCreateTour = async () => {
    await onCreateTour(newTour);
    setNewTour({ number: "", date: "", location: "", address: "" });
    setShowCreateTour(false);
  };

  const handleCreateMatch = async () => {
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
                    <Button onClick={handleCreateTour} disabled={actionLoading || !newTour.number || !newTour.date} style={{ flex: 1, padding: "10px" }}>
                      <Icons.Save /> Создать
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateTour(false)} style={{ flex: 1, padding: "10px" }}>
                      Отмена
                    </Button>
                  </div>
                </Card>
              )}

              {tours.sort((a, b) => a.number - b.number).map(tour => (
                <Card key={tour.id} style={{ marginBottom: "8px", padding: "12px" }}>
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
                    <Badge>{matches.filter(m => m.tour_id === tour.id).length} матчей</Badge>
                  </div>
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
                    options={[{ value: "", label: "Выберите тур" }, ...tours.map(t => ({ value: t.id, label: `Тур ${t.number} — ${new Date(t.date).toLocaleDateString("ru-RU")}` }))]}
                  />
                  <Select label="Команда 1" value={newMatch.team1_id} onChange={v => setNewMatch(p => ({ ...p, team1_id: v }))}
                    options={[{ value: "", label: "Выберите команду" }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                  />
                  <Select label="Команда 2" value={newMatch.team2_id} onChange={v => setNewMatch(p => ({ ...p, team2_id: v }))}
                    options={[{ value: "", label: "Выберите команду" }, ...teams.filter(t => t.id !== newMatch.team1_id).map(t => ({ value: t.id, label: t.name }))]}
                  />
                  <Input label="Время начала" type="datetime-local" value={newMatch.scheduled_time} onChange={v => setNewMatch(p => ({ ...p, scheduled_time: v }))} />
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <Button onClick={handleCreateMatch} disabled={actionLoading || !newMatch.tour_id || !newMatch.team1_id || !newMatch.team2_id || !newMatch.scheduled_time} style={{ flex: 1, padding: "10px" }}>
                      <Icons.Save /> Создать
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateMatch(false)} style={{ flex: 1, padding: "10px" }}>
                      Отмена
                    </Button>
                  </div>
                </Card>
              )}

              {tours.map(tour => {
                const tourMatches = matches.filter(m => m.tour_id === tour.id);
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
                                  <input type="number" min="0" max="50" value={matchScore[`set${setNum}_team1`] || 0}
                                    onChange={e => setMatchScore(prev => ({ ...prev, [`set${setNum}_team1`]: parseInt(e.target.value) || 0 }))}
                                    style={{ width: "60px", padding: "8px", textAlign: "center", borderRadius: "6px", border: `1px solid ${colors.grayBorder}` }}
                                  />
                                  <span>:</span>
                                  <input type="number" min="0" max="50" value={matchScore[`set${setNum}_team2`] || 0}
                                    onChange={e => setMatchScore(prev => ({ ...prev, [`set${setNum}_team2`]: parseInt(e.target.value) || 0 }))}
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
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ flex: 1, fontSize: "14px" }}>{team1?.name}</span>
                              <span style={{ fontWeight: 700, fontSize: "16px", padding: "4px 12px", background: colors.gray, borderRadius: "6px" }}>
                                {match.sets_team1 || 0} : {match.sets_team2 || 0}
                              </span>
                              <span style={{ flex: 1, fontSize: "14px", textAlign: "right" }}>{team2?.name}</span>
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
                              <button onClick={() => startEditMatch(match)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }}>
                                <Icons.Edit />
                              </button>
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
              
              {tours.map(tour => {
                const tourMatches = matches.filter(m => m.tour_id === tour.id && m.status === "finished");
                if (tourMatches.length === 0) return null;
                return (
                  <div key={tour.id} style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>
                      Тур {tour.number}
                    </div>
                    {tourMatches.map(match => {
                      const team1 = teams.find(t => t.id === match.team1_id);
                      const team2 = teams.find(t => t.id === match.team2_id);
                      const team1Players = players.filter(p => p.team_id === match.team1_id);
                      const team2Players = players.filter(p => p.team_id === match.team2_id);
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
              
              {tours.map(tour => {
                const tourMatches = matches.filter(m => m.tour_id === tour.id);
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
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Управление пользователями ({users.length})</h3>
              <p style={{ fontSize: "13px", color: colors.goldDark, marginBottom: "16px" }}>
                Роли вычисляются автоматически: Тренер — если назначен на команду, Капитан — если отмечен в составе, Игрок — если есть в players
              </p>
              {users.map(u => {
                const isEditing = editingUser?.id === u.id;
                const userPlayerRecord = players.find(p => p.user_id === u.id);
                const userCoachTeam = teams.find(t => t.coach_id === u.id);
                
                // Вычисляем все роли пользователя
                const displayRoles = [];
                if (u.role === "admin") displayRoles.push({ label: "Админ", variant: "admin" });
                if (userCoachTeam) displayRoles.push({ label: `Тренер (${userCoachTeam.name})`, variant: "gold" });
                if (userPlayerRecord?.is_captain) displayRoles.push({ label: "Капитан", variant: "captain" });
                if (userPlayerRecord) displayRoles.push({ label: "Игрок", variant: "free" });
                if (displayRoles.length === 0) displayRoles.push({ label: "Болельщик", variant: "default" });
                
                return (
                  <Card key={u.id} style={{ marginBottom: "8px", padding: "12px" }}>
                    {isEditing ? (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: "8px" }}>{u.first_name || u.username} {u.last_name || ""}</div>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
                          {displayRoles.map((role, i) => (
                            <Badge key={i} variant={role.variant}>{role.label}</Badge>
                          ))}
                        </div>
                        <Select label="Права администратора" value={userRole} onChange={setUserRole}
                          options={[
                            { value: "fan", label: "Обычный пользователь" },
                            { value: "admin", label: "Администратор" },
                          ]}
                        />
                        <div style={{ fontSize: "12px", color: colors.goldDark, margin: "8px 0", padding: "8px", background: colors.gray, borderRadius: "6px" }}>
                          <div style={{ marginBottom: "4px" }}>📌 Как назначить роли:</div>
                          <div>• <strong>Игрок</strong> — создать запись в players</div>
                          <div>• <strong>Капитан</strong> — отметить is_captain в players</div>
                          <div>• <strong>Тренер</strong> — назначить на команду (вкладка Команды)</div>
                        </div>
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
                const teamPlayers = players.filter(p => p.team_id === team.id);
                
                return (
                  <Card key={team.id} style={{ marginBottom: "8px", padding: "12px" }}>
                    {isEditing ? (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: "12px" }}>{team.name}</div>
                        <Select label="Тренер команды" value={teamCoach} onChange={setTeamCoach}
                          options={[
                            { value: "", label: "Не назначен" },
                            ...users.map(u => ({
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
                        </div>
                        
                        {isExpanded && (
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${colors.grayBorder}` }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: colors.goldDark, marginBottom: "8px" }}>Состав команды:</div>
                            {teamPlayers.length > 0 ? teamPlayers.map(player => (
                              <div key={player.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" }}>
                                <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
                                <span style={{ fontSize: "13px", flex: 1 }}>
                                  {player.users?.first_name || `@${player.users?.username}`}
                                  {player.is_captain && <span style={{ marginLeft: "4px", color: colors.gold }}>©</span>}
                                </span>
                                <span style={{ fontSize: "11px", color: colors.goldDark }}>
                                  {player.positions?.map(p => positionLabels[p] || p).join(", ") || "—"}
                                </span>
                                {player.jersey_number && <span style={{ fontSize: "12px", fontWeight: 600, color: colors.gold }}>#{player.jersey_number}</span>}
                                <button onClick={() => onSetCaptain(team.id, player.id, !player.is_captain)} style={{ background: player.is_captain ? "#f3e8ff" : colors.gray, border: "none", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", cursor: "pointer", color: player.is_captain ? "#7c3aed" : colors.goldDark }}>{player.is_captain ? "Снять ©" : "Капитан"}</button>
                              </div>
                            )) : (
                              <div style={{ fontSize: "13px", color: colors.goldDark, fontStyle: "italic" }}>Нет игроков</div>
                            )}
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

const ProfileScreen = ({ user, onLogout, isGuest, isTelegram, setScreen, pendingOffers, userRoles, onUpdateNotifications }) => {
  const displayName = getDisplayName(user);
  const [showNotifySettings, setShowNotifySettings] = useState(false);
  const [notifySettings, setNotifySettings] = useState({
    notify_day_before: user?.notify_day_before !== false,
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
              <RoleBadges roles={userRoles.roles} />
            </div>
          </Card>

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

          {!isGuest && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Уведомления</h3>
              <Card style={{ marginBottom: "20px" }}>
                <Checkbox checked={notifySettings.notify_day_before} onChange={() => handleToggle("notify_day_before")} label="За 1 день до матча" />
                <Checkbox checked={notifySettings.notify_hour_before} onChange={() => handleToggle("notify_hour_before")} label="За 1 час до матча" />
                <Checkbox checked={notifySettings.notify_live} onChange={() => handleToggle("notify_live")} label="Начало матча (LIVE)" />
                <Checkbox checked={notifySettings.notify_result} onChange={() => handleToggle("notify_result")} label="Результаты матчей" />
              </Card>
            </>
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
  const [users, setUsers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [playerStats, setPlayerStats] = useState([]);

  const userRoles = getUserRoles(user, players, teams);
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
      const { data: playerStatsData } = await supabase.from("player_stats").select("*");

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
      setUsers(usersData || []);
      setPlayerStats(playerStatsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOffer = async (playerId) => {
    if (!coachTeam) return;
    try {
      setActionLoading(true);
      const { data, error } = await supabase.from("offers").insert({ team_id: coachTeam.id, player_id: playerId, status: "pending" }).select().single();
      if (error) throw error;
      setOffers(prev => [data, ...prev]);
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
    try {
      setActionLoading(true);
      await supabase.from("offers").update({ status: "accepted" }).eq("id", offerId);
      await supabase.from("players").update({ team_id: teamId, is_free_agent: false }).eq("id", currentPlayer.id);
      await supabase.from("offers").update({ status: "rejected" }).eq("player_id", currentPlayer.id).eq("status", "pending").neq("id", offerId);
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

  const handleUpdateNotifications = async (field, value) => {
    try {
      await supabase.from("users").update({ [field]: value }).eq("id", user.id);
      setUser(prev => ({ ...prev, [field]: value }));
    } catch (error) {
      console.error("Error updating notifications:", error);
    }
  };

  // Admin functions
  const handleUpdateMatch = async (matchId, data) => {
    try {
      setActionLoading(true);
      const match = matches.find(m => m.id === matchId);
      const team1 = teams.find(t => t.id === match.team1_id);
      const team2 = teams.find(t => t.id === match.team2_id);
      
      // Считаем мячи из сетов
      const balls1 = (data.set1_team1 || 0) + (data.set2_team1 || 0) + (data.set3_team1 || 0) + (data.set4_team1 || 0) + (data.set5_team1 || 0);
      const balls2 = (data.set1_team2 || 0) + (data.set2_team2 || 0) + (data.set3_team2 || 0) + (data.set4_team2 || 0) + (data.set5_team2 || 0);
      
      // Считаем выигранные сеты
      let setsWon1 = 0, setsWon2 = 0;
      if (data.set1_team1 > data.set1_team2) setsWon1++; else if (data.set1_team2 > data.set1_team1) setsWon2++;
      if (data.set2_team1 > data.set2_team2) setsWon1++; else if (data.set2_team2 > data.set2_team1) setsWon2++;
      if (data.set3_team1 > data.set3_team2) setsWon1++; else if (data.set3_team2 > data.set3_team1) setsWon2++;
      if (data.set4_team1 > data.set4_team2) setsWon1++; else if (data.set4_team2 > data.set4_team1) setsWon2++;
      if (data.set5_team1 > data.set5_team2) setsWon1++; else if (data.set5_team2 > data.set5_team1) setsWon2++;
      
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

      if (data.status === "finished" && match.status !== "finished") {
        const team1Wins = setsWon1 > setsWon2;
        const points1 = team1Wins ? (setsWon2 === 0 ? 3 : setsWon2 === 1 ? 3 : 2) : (setsWon1 === 2 ? 1 : 0);
        const points2 = !team1Wins ? (setsWon1 === 0 ? 3 : setsWon1 === 1 ? 3 : 2) : (setsWon2 === 2 ? 1 : 0);

        await supabase.from("teams").update({
          games_played: (team1?.games_played || 0) + 1,
          wins: (team1?.wins || 0) + (team1Wins ? 1 : 0),
          losses: (team1?.losses || 0) + (team1Wins ? 0 : 1),
          sets_won: (team1?.sets_won || 0) + setsWon1,
          sets_lost: (team1?.sets_lost || 0) + setsWon2,
          points: (team1?.points || 0) + points1,
          balls_won: (team1?.balls_won || 0) + balls1,
          balls_lost: (team1?.balls_lost || 0) + balls2,
        }).eq("id", match.team1_id);

        await supabase.from("teams").update({
          games_played: (team2?.games_played || 0) + 1,
          wins: (team2?.wins || 0) + (!team1Wins ? 1 : 0),
          losses: (team2?.losses || 0) + (!team1Wins ? 0 : 1),
          sets_won: (team2?.sets_won || 0) + setsWon2,
          sets_lost: (team2?.sets_lost || 0) + setsWon1,
          points: (team2?.points || 0) + points2,
          balls_won: (team2?.balls_won || 0) + balls2,
          balls_lost: (team2?.balls_lost || 0) + balls1,
        }).eq("id", match.team2_id);
        
        // Отправляем уведомление о результате
        sendNotification("result", team1?.name, team2?.name, `${setsWon1}:${setsWon2}`);
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
      if (existingId) {
        await supabase.from("player_stats").update(stat).eq("id", existingId);
      } else {
        await supabase.from("player_stats").insert({
          player_id: playerId,
          match_id: matchId,
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
      if (existingUser) {
        const { data: updatedUser } = await supabase.from("users").update({
          first_name: tgUser.first_name || existingUser.first_name,
          last_name: tgUser.last_name || "",
          username: tgUser.username || existingUser.username,
        }).eq("id", existingUser.id).select().single();
        currentUser = updatedUser || existingUser;
      } else {
        const { data: newUser, error } = await supabase.from("users").insert({
          telegram_id: tgUser.id,
          username: tgUser.username,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name || "",
          role: "fan",
        }).select().single();
        if (!error) currentUser = newUser;
      }
      setUser(currentUser);
      setIsGuest(false);
      setScreen("home");
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
      case "home": return <HomeScreen setScreen={setScreen} user={user} teams={teams} matches={matches} players={players} pendingOffers={pendingOffers} userRoles={userRoles} />;
      case "teams": return <TeamsScreen setScreen={setScreen} teams={teams} setSelectedTeam={setSelectedTeam} />;
      case "teamDetail": return <TeamDetailScreen setScreen={setScreen} team={selectedTeam} players={players} setSelectedPlayer={setSelectedPlayer} />;
      case "playerDetail": return <PlayerDetailScreen setScreen={setScreen} player={selectedPlayer} teams={teams} setSelectedTeam={setSelectedTeam} playerStats={playerStats} matches={matches} />;
      case "players": return <PlayersScreen setScreen={setScreen} players={players} userRoles={userRoles} coachTeam={coachTeam} onSendOffer={handleSendOffer} sentOffers={sentOffers} setSelectedPlayer={setSelectedPlayer} />;
      case "offers": return <OffersScreen setScreen={setScreen} offers={offers.filter(o => o.player_id === currentPlayer?.id)} teams={teams} onAccept={handleAcceptOffer} onReject={handleRejectOffer} loading={actionLoading} />;
      case "myteam": return <MyTeamScreen setScreen={setScreen} user={user} teams={teams} players={players} coachTeam={coachTeam} currentPlayer={currentPlayer} sentOffers={sentOffers} onRemovePlayer={handleRemovePlayer} onSelectFavoriteTeam={handleSelectFavoriteTeam} actionLoading={actionLoading} userRoles={userRoles} />;
      case "schedule": return <ScheduleScreen matches={matches} teams={teams} tours={tours} isGuest={isGuest} setSelectedTeam={setSelectedTeam} setScreen={setScreen} />;
      case "table": return <TableScreen teams={teams} setSelectedTeam={setSelectedTeam} setScreen={setScreen} />;
      case "profile": return <ProfileScreen user={user} onLogout={handleLogout} isGuest={isGuest} isTelegram={isTelegram} setScreen={setScreen} pendingOffers={pendingOffers} userRoles={userRoles} onUpdateNotifications={handleUpdateNotifications} />;
      case "admin": return <AdminScreen setScreen={setScreen} matches={matches} teams={teams} users={users} players={players} tours={tours} playerStats={playerStats} onUpdateMatch={handleUpdateMatch} onUpdateUserRole={handleUpdateUserRole} onAssignCoach={handleAssignCoach} onSetCaptain={handleSetCaptain} onCreateTour={handleCreateTour} onCreateMatch={handleCreateMatch} onUpdateMatchVideo={handleUpdateMatchVideo} onSavePlayerStat={handleSavePlayerStat} actionLoading={actionLoading} loadData={loadData} />;
      default: return <HomeScreen setScreen={setScreen} user={user} teams={teams} matches={matches} players={players} pendingOffers={pendingOffers} userRoles={userRoles} />;
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
