import { colors } from '../../constants/colors';
import { Icons } from './Icons';

export const NavBar = ({ active, setScreen }) => {
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
