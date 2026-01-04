# Добавляем отображение уведомлений команды в MyTeamScreen

with open('src/screens/MyTeamScreen.jsx', 'r') as f:
    content = f.read()

# 1. Добавляем teamNotifications и onMarkNotificationRead в пропсы
old_props = '''export const MyTeamScreen = ({ 
  setScreen, user, teams, players, coachTeam, currentPlayer, sentOffers, 
  onRemovePlayer, onSelectFavoriteTeam, onLeaveTeam, actionLoading, userRoles, 
  setSelectedPlayer, teamRequests, onAcceptTeamRequest, onRejectTeamRequest, 
  onUpdateJerseyNumber, onSetCaptain 
}) => {'''

new_props = '''export const MyTeamScreen = ({ 
  setScreen, user, teams, players, coachTeam, currentPlayer, sentOffers, 
  onRemovePlayer, onSelectFavoriteTeam, onLeaveTeam, actionLoading, userRoles, 
  setSelectedPlayer, teamRequests, onAcceptTeamRequest, onRejectTeamRequest, 
  onUpdateJerseyNumber, onSetCaptain, teamNotifications, onMarkNotificationRead 
}) => {'''

content = content.replace(old_props, new_props)

# 2. Добавляем фильтрацию уведомлений для команды тренера
old_pending = '''  const teamPlayers = myTeam ? players.filter(p => p.team_id === myTeam.id) : [];
  const pendingSentOffers = (sentOffers || []).filter(o => o.status === "pending");
  const pendingTeamRequests = (teamRequests || []).filter(r => r.team_id === myTeam?.id && r.status === "pending");
  const canManageTeam = teamRelation === "coach";'''

new_pending = '''  const teamPlayers = myTeam ? players.filter(p => p.team_id === myTeam.id) : [];
  const pendingSentOffers = (sentOffers || []).filter(o => o.status === "pending");
  const pendingTeamRequests = (teamRequests || []).filter(r => r.team_id === myTeam?.id && r.status === "pending");
  const myTeamNotifications = (teamNotifications || []).filter(n => n.team_id === myTeam?.id);
  const unreadNotifications = myTeamNotifications.filter(n => !n.is_read);
  const canManageTeam = teamRelation === "coach";'''

content = content.replace(old_pending, new_pending)

# 3. Добавляем секцию уведомлений после "Ожидают ответа"
old_offers_section = '''          {/* Pending Sent Offers (for coach) */}
          {canManageTeam && pendingSentOffers.length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Ожидают ответа ({pendingSentOffers.length})</h3>
              {pendingSentOffers.map(offer => {
                const player = players.find(p => p.id === offer.player_id);
                return (
                  <Card key={offer.id} style={{ marginBottom: "8px", padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Avatar name={player?.users?.first_name || player?.users?.username} size={40} url={player?.users?.avatar_url} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{player?.users?.first_name || `@${player?.users?.username}`}</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark }}>{player?.positions?.map(p => positionLabels[p] || p).join(", ")}</div>
                      </div>
                      <Badge variant="pending">Ожидает</Badge>
                    </div>
                  </Card>
                );
              })}
            </>
          )}'''

new_offers_section = '''          {/* Pending Sent Offers (for coach) */}
          {canManageTeam && pendingSentOffers.length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Ожидают ответа ({pendingSentOffers.length})</h3>
              {pendingSentOffers.map(offer => {
                const player = players.find(p => p.id === offer.player_id);
                return (
                  <Card key={offer.id} style={{ marginBottom: "8px", padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Avatar name={player?.users?.first_name || player?.users?.username} size={40} url={player?.users?.avatar_url} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{player?.users?.first_name || `@${player?.users?.username}`}</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark }}>{player?.positions?.map(p => positionLabels[p] || p).join(", ")}</div>
                      </div>
                      <Badge variant="pending">Ожидает</Badge>
                    </div>
                  </Card>
                );
              })}
            </>
          )}

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
          )}'''

content = content.replace(old_offers_section, new_offers_section)

with open('src/screens/MyTeamScreen.jsx', 'w') as f:
    f.write(content)

print("✅ Добавлено отображение уведомлений команды в MyTeamScreen")
