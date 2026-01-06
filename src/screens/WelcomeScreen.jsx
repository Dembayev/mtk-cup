import { useEffect } from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { } from '../lib/supabase';

export const WelcomeScreen = ({ onLogin, onGuest, isTelegram }) => {
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

