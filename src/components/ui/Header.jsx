import { colors } from '../../constants';
import { Icons } from './Icons';

export const Header = ({ title, showBack, onBack, rightElement }) => (
  <div style={{
    background: "white",
    padding: "16px 20px",
    borderBottom: `1px solid ${colors.grayBorder}`,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    position: "sticky",
    top: 0,
    zIndex: 100,
  }}>
    {showBack && (
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
        <Icons.ChevronLeft />
      </button>
    )}
    <h1 style={{ flex: 1, margin: 0, fontSize: "20px", fontWeight: 700 }}>{title}</h1>
    {rightElement}
  </div>
);
