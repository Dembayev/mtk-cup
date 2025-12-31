import { colors } from '../../constants';

export const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: "16px" }}>
    {label && <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 500, color: colors.goldDark }}>{label}</label>}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "12px 16px",
        borderRadius: "10px",
        border: `1px solid ${colors.grayBorder}`,
        fontSize: "15px",
        outline: "none",
        background: "white",
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);
