import re

# Читаем файл
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Ищем место перед "Состав" и добавляем секцию уведомлений
old_markup = '''          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Состав ({teamPlayers.length})</h3>'''

new_markup = '''          )}

          {/* Team Notifications (for coach) */}
          {canManageTeam && myTeamNotifications.length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "20px 0 12px" }}>
                📬 Уведомления 
                {unreadNotifications.length > 0 && (
                  <span style={{ marginLeft: "8px", background: "#dc2626", color: "white", borderRadius: "12px", padding: "2px 8px", fontSize: "12px" }}>
                    {unreadNotifications.length}
                  </span>
                )}
              </h3>
              {myTeamNotifications.slice(0, 10).map(notification => {
                const notifIcon = 
                  notification.type === 'team_request' ? '📝' :
                  notification.type === 'player_accepted' ? '✅' :
                  notification.type === 'player_left' ? '📤' : '🔔';
                
                const notifColor = 
                  notification.type === 'team_request' ? colors.goldDark :
                  notification.type === 'player_accepted' ? '#16a34a' :
                  notification.type === 'player_left' ? '#dc2626' : colors.text;

                return (
                  <Card 
                    key={notification.id} 
                    style={{ 
                      marginBottom: "8px", 
                      padding: "12px 16px",
                      background: notification.is_read ? colors.bg : colors.goldLight,
                      cursor: notification.is_read ? "default" : "pointer"
                    }}
                    onClick={() => !notification.is_read && onMarkNotificationRead && onMarkNotificationRead(notification.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ fontSize: "24px" }}>{notifIcon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: notifColor }}>
                          {notification.message}
                        </div>
                        <div style={{ fontSize: "11px", color: colors.goldDark, marginTop: "4px" }}>
                          {new Date(notification.created_at).toLocaleString('ru-RU', { 
                            day: 'numeric', 
                            month: 'short', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                      {!notification.is_read && (
                        <div style={{ 
                          width: "8px", 
                          height: "8px", 
                          borderRadius: "50%", 
                          background: "#dc2626" 
                        }} />
                      )}
                    </div>
                  </Card>
                );
              })}
              {myTeamNotifications.length > 10 && (
                <div style={{ textAlign: "center", fontSize: "13px", color: colors.goldDark, marginTop: "8px" }}>
                  Показаны последние 10 уведомлений
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Состав ({teamPlayers.length})</h3>'''

content = content.replace(old_markup, new_markup)

# Записываем обратно
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Добавлена секция уведомлений в MyTeamScreen")
