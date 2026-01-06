import { colors } from '../../constants/colors';
import { Icons } from './Icons';

export const Header = ({ title, showBack, onBack, rightElement }) => (
  <div style={{
    padding: "16px 20px", paddingTop: "50px",
    borderBottom: `1px solid ${colors.grayBorder}`,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: colors.bg,
    position: "sticky",
    top: 0,
    zIndex: 100,
  }}>
    {showBack && (
      <button onClick={onBack} style={{ background: "none", border: "none", padding: "4px", cursor: "pointer", color: colors.text }}>
        <Icons.Back />
      </button>
    )}
    <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 600, color: colors.text, flex: 1 }}>{title}</h1>
    {rightElement}
  </div>
);
