import { useEffect } from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { } from '../lib/supabase';

export const RoleRequestModal = ({ show, roleRequestData, setRoleRequestData, onSubmit, onClose, teams, user, roleRequests }) => {
  const isPlayer = roleRequestData.role === "player";
  const isCoach = roleRequestData.role === "coach";
  
  // Проверяем есть ли одобренная заявка с именем/фамилией
  const approvedRequest = (roleRequests || []).find(r => 
    r.user_id === user?.id && 
    r.status === "approved" && 
    r.first_name && r.last_name
  );
  
  // Или имя уже установлено в профиле (после одобрения заявки)
    const lockedFirstName = approvedRequest?.first_name || (user?.name_edited_by_admin ? user?.first_name : null);
  const lockedLastName = approvedRequest?.last_name || (user?.name_edited_by_admin ? user?.last_name : null);
  
  // Команды без тренера (доступны для выбора)
  const availableTeams = (teams || []).filter(t => !t.coach_id);
  
  const positionOptions = [
    { value: "setter", label: "Связующий" },
    { value: "outside", label: "Доигровщик" },
    { value: "opposite", label: "Диагональный" },
    { value: "middle", label: "Центральный блокирующий" },
    { value: "libero", label: "Либеро" }
  ];
  
  const togglePosition = (pos) => {
    const current = roleRequestData.positions || [];
    if (current.includes(pos)) {
      setRoleRequestData(prev => ({ 
        ...prev, 
        positions: current.filter(p => p !== pos) 
      }));
    } else {
      setRoleRequestData(prev => ({ 
        ...prev, 
        positions: [...current, pos] 
      }));
    }
  };
  
  // При первом открытии подставляем заблокированные значения
  useEffect(() => {
    if (lockedFirstName && !roleRequestData.first_name) {
      setRoleRequestData(prev => ({ ...prev, first_name: lockedFirstName }));
    }
    if (lockedLastName && !roleRequestData.last_name) {
      setRoleRequestData(prev => ({ ...prev, last_name: lockedLastName }));
    }
  }, [lockedFirstName, lockedLastName, roleRequestData.first_name, roleRequestData.last_name, setRoleRequestData]);
  
  // Ранний return ПОСЛЕ хуков
  if (!show) return null;
  
  const handleSubmit = () => {
    const firstName = lockedFirstName || roleRequestData.first_name;
    const lastName = lockedLastName || roleRequestData.last_name;
    if (!firstName?.trim() || !lastName?.trim()) {
      alert("Пожалуйста, заполните имя и фамилию");
      return;
    }
    if (isCoach && !roleRequestData.team_id) {
      alert("Пожалуйста, выберите команду");
      return;
    }
    // Подставляем заблокированные значения если есть
    // Values are handled by parent component
    onSubmit();
  };
  
  return (
    <div style={{ 
      position: "fixed", 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: "rgba(0,0,0,0.5)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      zIndex: 9999,
      padding: "20px"
    }}>
      <div style={{ 
        background: colors.bg, 
        borderRadius: "16px", 
        padding: "24px", 
        maxWidth: "400px", 
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto"
      }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700 }}>
          {isPlayer ? "🏃 Заявка на роль Игрока" : "📋 Заявка на роль Тренера"}
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: "13px", color: colors.goldDark }}>
          ⚠️ После одобрения заявки вы не сможете изменить имя и фамилию самостоятельно
        </p>
        
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600 }}>
            Имя <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="text"
            value={lockedFirstName || roleRequestData.first_name}
            onChange={(e) => !lockedFirstName && setRoleRequestData(prev => ({ ...prev, first_name: e.target.value }))}
            placeholder="Введите ваше имя"
            disabled={!!lockedFirstName}
            style={{ 
              width: "100%", 
              padding: "10px", 
              borderRadius: "8px", 
              border: `1px solid ${colors.grayBorder}`, 
              fontSize: "14px",
              boxSizing: "border-box",
              background: lockedFirstName ? "#f3f4f6" : "white",
              color: lockedFirstName ? "#6b7280" : "inherit"
            }}
          />
          {lockedFirstName && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#16a34a" }}>✓ Имя подтверждено</p>}
        </div>
        
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600 }}>
            Фамилия <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="text"
            value={lockedLastName || roleRequestData.last_name}
            onChange={(e) => !lockedLastName && setRoleRequestData(prev => ({ ...prev, last_name: e.target.value }))}
            placeholder="Введите вашу фамилию"
            disabled={!!lockedLastName}
            style={{ 
              width: "100%", 
              padding: "10px", 
              borderRadius: "8px", 
              border: `1px solid ${colors.grayBorder}`, 
              fontSize: "14px",
              boxSizing: "border-box",
              background: lockedLastName ? "#f3f4f6" : "white",
              color: lockedLastName ? "#6b7280" : "inherit"
            }}
          />
          {lockedLastName && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#16a34a" }}>✓ Фамилия подтверждена</p>}
        </div>
        
        {isCoach && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600 }}>
              Команда <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <select
              value={roleRequestData.team_id || ""}
              onChange={(e) => {
                const selectedTeam = availableTeams.find(t => t.id === e.target.value);
                setRoleRequestData(prev => ({ 
                  ...prev, 
                  team_id: e.target.value,
                  team_name: selectedTeam?.name || ""
                }));
              }}
              style={{ 
                width: "100%", 
                padding: "10px", 
                borderRadius: "8px", 
                border: `1px solid ${colors.grayBorder}`, 
                fontSize: "14px",
                boxSizing: "border-box",
                background: "white",
                cursor: "pointer"
              }}
            >
              <option value="">Выберите команду...</option>
              {availableTeams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            {availableTeams.length === 0 && (
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#dc2626" }}>
                Нет доступных команд без тренера
              </p>
            )}
            {availableTeams.length > 0 && (
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: colors.goldDark }}>
                Выберите команду которую хотите тренировать
              </p>
            )}
          </div>
        )}

        {isPlayer && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 600 }}>
              Амплуа (можно выбрать несколько)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {positionOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => togglePosition(opt.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "20px",
                    border: `2px solid ${(roleRequestData.positions || []).includes(opt.value) ? colors.gold : colors.grayBorder}`,
                    background: (roleRequestData.positions || []).includes(opt.value) ? colors.goldLight : colors.bg,
                    color: (roleRequestData.positions || []).includes(opt.value) ? colors.goldDark : colors.text,
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer"
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div style={{ display: "flex", gap: "8px", marginTop: "24px" }}>
          <Button variant="outline" onClick={onClose} style={{ flex: 1 }}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} style={{ flex: 1 }} disabled={roleRequestData.submitting}>
            {roleRequestData.submitting ? "Отправка..." : "Отправить заявку"}
          </Button>
        </div>
      </div>
    </div>
  );
};

