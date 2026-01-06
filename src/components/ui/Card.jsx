import { colors } from '../../constants/colors';

export const Card = ({ children, onClick, style }) => (
  <div onClick={onClick} style={{
    background: colors.bg,
    border: `1px solid ${colors.grayBorder}`,
    borderRadius: "12px",
    padding: "16px",
    cursor: onClick ? "pointer" : "default",
    transition: "all 0.2s",
    ...style,
  }}>
    {children}
  </div>
);
