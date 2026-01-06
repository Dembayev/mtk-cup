import { colors } from '../../constants/colors';

export const Input = ({ label, value, onChange, type = "text", placeholder, style }) => (
  <div style={{ marginBottom: "12px", ...style }}>
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
