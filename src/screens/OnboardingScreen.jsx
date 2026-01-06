import { useState} from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { } from '../lib/supabase';

export const OnboardingScreen = ({ user, onComplete, setRoleRequestData, setShowRoleRequestForm }) => {
  const [selectedRole, setSelectedRole] = useState("fan");
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => {
    if (selectedRole === "fan") {
      setLoading(true);
      await onComplete();
      setLoading(false);
    } else {
      // Для игрока/тренера открываем форму с именем/фамилией
      setRoleRequestData({ role: selectedRole, first_name: "", last_name: "", positions: [] });
      setShowRoleRequestForm(true);
    }
  };
  
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "20px" }}>
      <Container>
        <div style={{ paddingTop: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏐</div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>Добро пожаловать!</h1>
          <p style={{ color: colors.goldDark, marginBottom: "32px" }}>
            {user?.first_name || user?.username}, выберите вашу роль в турнире
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
            {[
              { id: "fan", icon: "👀", title: "Болельщик", desc: "Следить за матчами и командами" },
              { id: "player", icon: "🏃", title: "Игрок", desc: "Участвовать в турнире (требует одобрения)" },
              { id: "coach", icon: "📋", title: "Тренер", desc: "Управлять командой (требует одобрения)" },
            ].map(role => (
              <Card 
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                style={{ 
                  cursor: "pointer",
                  border: selectedRole === role.id ? `2px solid ${colors.gold}` : `1px solid ${colors.grayBorder}`,
                  background: selectedRole === role.id ? colors.goldLight : colors.bg,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ fontSize: "32px" }}>{role.icon}</div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: "16px" }}>{role.title}</div>
                    <div style={{ fontSize: "13px", color: colors.goldDark }}>{role.desc}</div>
                  </div>
                  {selectedRole === role.id && (
                    <div style={{ marginLeft: "auto", color: colors.gold, fontSize: "20px" }}>✓</div>
                  )}
                </div>
              </Card>
            ))}
          </div>
          
          {selectedRole !== "fan" && (
            <div style={{ background: colors.gray, padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", color: colors.goldDark }}>
              ℹ️ Заявка на роль "{selectedRole === "player" ? "Игрок" : "Тренер"}" будет отправлена администратору на одобрение
            </div>
          )}
          
          <Button onClick={handleSubmit} disabled={loading} style={{ width: "100%" }}>
            {loading ? "Отправка..." : selectedRole === "fan" ? "Продолжить" : "Отправить заявку"}
          </Button>
        </div>
      </Container>
    </div>
  );
};

