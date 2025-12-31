import { colors } from '../../constants';

export const Button = ({ children, onClick, variant = "primary", disabled, style = {} }) => {
  const baseStyle = {
    padding: "14px 24px",
    borderRadius: "12px",
    fontWeight: 600,
    fontSize: "15px",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    border: "none",
    transition: "all 0.2s",
    opacity: disabled ? 0.6 : 1,
  };
  
  const variants = {
    primary: { background: colors.gold, color: "white" },
    outline: { background: "transparent", border: `2px solid ${colors.gold}`, color: colors.gold },
    danger: { background: "#dc2626", color: "white" },
    success: { background: "#16a34a", color: "white" },
  };
  
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...baseStyle, ...variants[variant], ...style }}>
      {children}
    </button>
  );
};
