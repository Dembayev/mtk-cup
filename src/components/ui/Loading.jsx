import { colors } from '../../constants/colors';

export const Loading = () => (
  <div style={{ 
    display: "flex", 
    flexDirection: "column",
    justifyContent: "center", 
    alignItems: "center", 
    minHeight: "100vh",
    padding: "40px", 
    color: colors.goldDark 
  }}>
    <img 
      src="/logo.jpg" 
      alt="Кубок МТК" 
      style={{ 
        width: "120px", 
        height: "120px", 
        borderRadius: "50%",
        marginBottom: "24px",
        objectFit: "cover"
      }} 
    />
    <div style={{ fontSize: "18px", fontWeight: 600 }}>Загрузка...</div>
  </div>
);
