import { useState} from 'react';
import { colors } from '../constants/colors';
import { } from '../constants/labels';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons, RoleBadges } from '../components/ui';
import { getDisplayName } from '../utils/helpers';
import { } from '../lib/supabase';
import { sendToOrganizers } from '../utils/notifications';

// Checkbox component
const Checkbox = ({ checked, onChange, label }) => (
    <div onClick={onChange} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", cursor: "pointer", borderBottom: `1px solid ${colors.grayBorder}` }}>
      <div style={{ width: "24px", height: "24px", borderRadius: "6px", border: `2px solid ${checked ? colors.gold : colors.grayBorder}`, background: checked ? colors.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {checked && <Icons.Check />}
      </div>
      <span style={{ fontSize: "15px", flex: 1 }}>{label}</span>
    </div>
  );

export const ProfileScreen = ({ user, onLogout, isGuest, isTelegram, setScreen, pendingOffers, userRoles, onUpdateNotifications, roleRequests, onSubmitRoleRequest, onRequestPhone, currentPlayer, onUpdatePosition, setRoleRequestData, setShowRoleRequestForm }) => {
  const displayName = getDisplayName(user);
    const [showContactOrganizers, setShowContactOrganizers] = useState(false);
  const [organizerMessage, setOrganizerMessage] = useState("");
  const [sendingToOrganizers, setSendingToOrganizers] = useState(false);
  const [notifySettings, setNotifySettings] = useState({
    notify_hour_before: user?.notify_hour_before !== false,
    notify_live: user?.notify_live !== false,
    notify_result: user?.notify_result !== false,
  });
  
  const handleToggle = async (field) => {
    const newValue = !notifySettings[field];
    setNotifySettings(prev => ({ ...prev, [field]: newValue }));
    onUpdateNotifications && onUpdateNotifications(field, newValue);
  };
  
  
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Профиль" showBack onBack={() => setScreen("home")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "center" }}><Avatar name={displayName} size={80} url={user?.avatar_url} /></div>
            <div style={{ marginTop: "16px" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700 }}>{isGuest ? "Гость" : (user?.first_name ? `${user.first_name} ${user.last_name || ""}` : `@${user?.username || "user"}`)}</h2>
              {user?.username && user?.first_name && <p style={{ margin: "0 0 12px", color: colors.goldDark, fontSize: "14px" }}>@{user.username}</p>}
              {user?.phone && <p style={{ margin: "0 0 12px", color: colors.goldDark, fontSize: "14px" }}>📞 {user.phone}</p>}
              <RoleBadges roles={userRoles.roles} />
            </div>
          </Card>

          {/* Кнопка добавления номера телефона */}
          {!isGuest && isTelegram && !user?.phone && (
            <Card onClick={onRequestPhone} style={{ marginBottom: "20px", cursor: "pointer", background: colors.goldLight }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: colors.gold, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "18px" }}>📱</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Добавить номер телефона</div>
                  <div style={{ fontSize: "13px", color: colors.goldDark }}>Для связи с организаторами</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          {userRoles.isAdmin && (
            <Card onClick={() => setScreen("admin")} style={{ marginBottom: "20px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: "#dbeafe", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}><Icons.Settings /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Админ-панель</div>
                  <div style={{ fontSize: "13px", color: colors.goldDark }}>Управление турниром</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          {userRoles.isPlayer && (
            <Card onClick={() => setScreen("offers")} style={{ marginBottom: "20px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: pendingOffers.length > 0 ? "#fef3c7" : colors.gray, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.Mail /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Приглашения в команды</div>
                  {pendingOffers.length > 0 ? <div style={{ fontSize: "13px", color: "#d97706" }}>{pendingOffers.length} новых</div> : <div style={{ fontSize: "13px", color: colors.goldDark }}>Нет новых приглашений</div>}
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}
          
          {userRoles.isPlayer && currentPlayer && (
            <Card style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Моё амплуа</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {["setter", "opposite", "outside", "middle", "libero"].map(pos => {
                  const labels = { setter: "Связующий", opposite: "Диагональный", outside: "Доигровщик", middle: "Центральный", libero: "Либеро" };
                  const isSelected = currentPlayer.positions?.includes(pos);
                  return (
                    <button
                      key={pos}
                      onClick={() => onUpdatePosition && onUpdatePosition(pos)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "20px",
                        border: isSelected ? "2px solid " + colors.gold : "1px solid " + colors.grayBorder,
                        background: isSelected ? colors.goldLight : "white",
                        color: isSelected ? colors.goldDark : colors.text,
                        fontWeight: isSelected ? 600 : 400,
                        fontSize: "14px",
                        cursor: "pointer"
                      }}
                    >
                      {labels[pos]}
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: "12px 0 0", fontSize: "12px", color: colors.goldDark }}>Нажмите чтобы выбрать или убрать позицию</p>
            </Card>
          )}

          {/* Кнопки подачи заявки на роль для болельщиков */}
          {!isGuest && !userRoles.isPlayer && !userRoles.isCoach && (
            <Card style={{ marginBottom: "20px", background: colors.goldLight }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Хотите участвовать в турнире?</h4>
              {(roleRequests || []).some(r => r.user_id === user?.id && r.status === "pending") ? (
                <div style={{ padding: "12px", background: "#fef3c7", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#92400e" }}>⏳ Ваша заявка на рассмотрении</div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button 
                    onClick={() => {
                    setRoleRequestData({ role: "player", first_name: "", last_name: "", positions: [] });
                    setShowRoleRequestForm(true);
                  }}
                    style={{ flex: 1, background: "#16a34a" }}
                  >
                    🏃 Стать игроком
                  </Button>
                  <Button 
                    onClick={() => {
                    setRoleRequestData({ role: "coach", first_name: "", last_name: "", positions: [] });
                    setShowRoleRequestForm(true);
                  }} 
                    variant="outline"
                    style={{ flex: 1 }}
                  >
                    📋 Стать тренером
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Кнопки смены роли для ИГРОКОВ */}
          {!isGuest && userRoles.isPlayer && !userRoles.isCoach && (
            <Card style={{ marginBottom: "20px", background: "#f0f9ff" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Сменить роль</h4>
              {(roleRequests || []).some(r => r.user_id === user?.id && r.status === "pending") ? (
                <div style={{ padding: "12px", background: "#fef3c7", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#92400e" }}>⏳ Ваша заявка на рассмотрении</div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button onClick={() => {
                    setRoleRequestData({ role: "coach", first_name: "", last_name: "", positions: [] });
                    setShowRoleRequestForm(true);
                  }} style={{ flex: 1, background: "#0284c7" }}>📋 Стать тренером</Button>
                  <Button onClick={() => onSubmitRoleRequest("fan")} variant="outline" style={{ flex: 1 }}>👤 Стать болельщиком</Button>
                </div>
              )}
            </Card>
          )}

          {/* Кнопки смены роли для ТРЕНЕРОВ */}
          {!isGuest && userRoles.isCoach && !userRoles.isPlayer && (
            <Card style={{ marginBottom: "20px", background: "#fefce8" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Сменить роль</h4>
              {(roleRequests || []).some(r => r.user_id === user?.id && r.status === "pending") ? (
                <div style={{ padding: "12px", background: "#fef3c7", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#92400e" }}>⏳ Ваша заявка на рассмотрении</div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button onClick={() => {
                  setRoleRequestData({ role: "player", first_name: "", last_name: "", positions: [] });
                  setShowRoleRequestForm(true);
                }} style={{ flex: 1, background: "#16a34a" }}>🏃 Стать игроком</Button>
                  <Button onClick={() => onSubmitRoleRequest("fan")} variant="outline" style={{ flex: 1 }}>👤 Стать болельщиком</Button>
                </div>
              )}
            </Card>
          )}

          {/* Кнопки смены роли для ИГРОК+ТРЕНЕР */}
          {!isGuest && userRoles.isCoach && userRoles.isPlayer && (
            <Card style={{ marginBottom: "20px", background: "#f0fdf4" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>Сменить роль</h4>
              {(roleRequests || []).some(r => r.user_id === user?.id && r.status === "pending") ? (
                <div style={{ padding: "12px", background: "#fef3c7", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#92400e" }}>⏳ Ваша заявка на рассмотрении</div>
                </div>
              ) : (
                <Button onClick={() => onSubmitRoleRequest("fan")} variant="outline" style={{ width: "100%" }}>👤 Стать болельщиком</Button>
              )}
            </Card>
          )}

          {!isGuest && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Уведомления</h3>
              <Card style={{ marginBottom: "20px" }}>
                <Checkbox checked={notifySettings.notify_hour_before} onChange={() => handleToggle("notify_hour_before")} label="Матч скоро начнётся" />
                <Checkbox checked={notifySettings.notify_live} onChange={() => handleToggle("notify_live")} label="Начало матча (LIVE)" />
                <Checkbox checked={notifySettings.notify_result} onChange={() => handleToggle("notify_result")} label="Результаты матчей" />
              </Card>
            </>
          )}

          {/* Кнопка написать организаторам */}
          {!isGuest && (
            <Button onClick={() => setShowContactOrganizers(true)} style={{ width: "100%", marginTop: "24px", background: colors.gold }}>
              <Icons.Mail /> Написать организаторам
            </Button>
          )}

          {/* Модальное окно для сообщения организаторам */}
          {showContactOrganizers && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.5)", zIndex: 9999,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
            }} onClick={() => setShowContactOrganizers(false)}>
              <Card style={{ maxWidth: "400px", width: "100%", maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 700 }}>Написать организаторам</h3>
                <p style={{ fontSize: "14px", color: colors.goldDark, marginBottom: "12px" }}>
                  Ваше сообщение получат все администраторы турнира
                </p>
                <textarea
                  value={organizerMessage}
                  onChange={(e) => setOrganizerMessage(e.target.value)}
                  placeholder="Введите ваше сообщение..."
                  style={{
                    width: "100%", minHeight: "120px", padding: "12px",
                    border: `1px solid ${colors.grayBorder}`, borderRadius: "8px",
                    fontSize: "15px", fontFamily: "inherit", resize: "vertical"
                  }}
                />
                <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                  <Button
                    onClick={async () => {
                      if (!organizerMessage.trim()) {
                        alert("Введите сообщение");
                        return;
                      }
                      setSendingToOrganizers(true);
                      const userName = `${user?.first_name || user?.username || "Пользователь"} ${user?.last_name || ""}`.trim();
                      const result = await sendToOrganizers(userName, user?.telegram_id, organizerMessage, user?.username);
                      setSendingToOrganizers(false);
                      if (result.sent > 0) {
                        alert(`Сообщение отправлено ${result.sent} организаторам`);
                        setOrganizerMessage("");
                        setShowContactOrganizers(false);
                      } else {
                        alert("Не удалось отправить сообщение");
                      }
                    }}
                    disabled={sendingToOrganizers || !organizerMessage.trim()}
                    style={{ flex: 1 }}
                  >
                    {sendingToOrganizers ? "Отправка..." : "Отправить"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowContactOrganizers(false)} style={{ flex: 1 }}>
                    Отмена
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {!isTelegram && (
            <Button variant="outline" onClick={onLogout} style={{ width: "100%", marginTop: "24px", color: "#dc2626", borderColor: "#dc2626" }}>
              {isGuest ? "Войти в аккаунт" : "Выйти"}
            </Button>
          )}
        </div>
      </Container>
    </div>
  );
};

