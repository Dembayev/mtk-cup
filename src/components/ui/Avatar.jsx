import { colors } from '../../constants';

export const Avatar = ({ name, size = 48, url }) => {
  if (url) {
    return (
      <img 
        src={url} 
        alt={name || "avatar"} 
        style={{ 
          width: size, 
          height: size, 
          borderRadius: "50%", 
          objectFit: "cover",
          border: `2px solid ${colors.goldLight}`
        }} 
      />
    );
  }
  
  const initials = (name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${colors.gold}, ${colors.goldDark})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontWeight: 700,
      fontSize: size * 0.35,
    }}>
      {initials}
    </div>
  );
};
