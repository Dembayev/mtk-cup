import { colors } from '../../constants/colors';

export const Badge = ({ children, variant = "default" }) => {
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
