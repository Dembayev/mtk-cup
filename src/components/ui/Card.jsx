import { colors } from '../../constants';

export const Card = ({ children, onClick, style = {} }) => (
  <div onClick={onClick} style={{
    background: "white",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    border: `1px solid ${colors.grayBorder}`,
    cursor: onClick ? "pointer" : "default",
    ...style
  }}>
    {children}
  </div>
);
