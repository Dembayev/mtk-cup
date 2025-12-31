import { colors } from '../../constants';
import { Icons } from './Icons';

export const BottomNav = ({ screen, setScreen }) => {
  const navItems = [
    { id: "home", icon: Icons.Home, label: "Главная" },
    { id: "players", icon: Icons.Users, label: "Игроки" },
    { id: "schedule", icon: Icons.Calendar, label: "Матчи" },
    { id: "table", icon: Icons.Trophy, label: "Таблица" },
    { id: "profile", icon: Icons.User, label: "Профиль" },
  ];
  
  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "white",
      borderTop: `1px solid ${colors.grayBorder}`,
      display: "flex",
      justifyContent: "space-around",
      padding: "8px 0 20px",
      zIndex: 1000,
    }}>
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = screen === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            style={{
              background: "none",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              cursor: "pointer",
              color: isActive ? colors.gold : colors.goldDark,
              padding: "4px 12px",
            }}
          >
            <Icon />
            <span style={{ fontSize: "11px", fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
