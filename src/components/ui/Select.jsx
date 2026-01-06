import { colors } from '../../constants/colors';

export const Select = ({ label, value, onChange, options, style }) => (
  <div style={{ marginBottom: "12px", ...style }}>
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
