import { colors } from '../../constants';

export const Input = ({ label, value, onChange, placeholder, type = "text", style = {} }) => (
  <div style={{ marginBottom: "16px", ...style }}>
    {label && <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 500, color: colors.goldDark }}>{label}</label>}
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "12px 16px",
        borderRadius: "10px",
        border: `1px solid ${colors.grayBorder}`,
        fontSize: "15px",
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  </div>
);
