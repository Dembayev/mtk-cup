import { colors } from '../../constants/colors';

export const Button = ({ children, variant = "primary", onClick, style, disabled }) => (
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
