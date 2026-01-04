import { useState } from 'react';
import { colors, positionLabels } from '../constants';
import { Card, Badge, Avatar, Button, Header, Container, Icons } from '../components';
import { sendTeamMessage } from '../utils';

export const MyTeamScreen = ({ 
  setScreen, user, teams, players, coachTeam, currentPlayer, sentOffers, 
  onRemovePlayer, onSelectFavoriteTeam, onLeaveTeam, actionLoading, userRoles, 
  setSelectedPlayer, teamRequests, onAcceptTeamRequest, onRejectTeamRequest, 
  onUpdateJerseyNumber, onSetCaptain, teamNotifications, onMarkNotificationRead 
}) => {
  // Debug logging
  console.log('🔍 MyTeamScreen render:', {
    user: user?.id,
    userRoles,
    coachTeam: coachTeam?.id,
    currentPlayer: currentPlayer?.id,
    teams: teams?.length,
    players: players?.length,
    sentOffers: sentOffers?.length,
    teamRequests: teamRequests?.length
  });

  const [editingJersey, setEditingJersey] = useState(null);
  const [jerseyValue, setJerseyValue] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Safety checks
  if (!userRoles) {
    console.error('❌ userRoles is missing!');
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Ошибка: роли пользователя не загружены</p>
      </div>
    );
  }

  if (!teams || !players) {
    console.error('❌ teams or players is missing!', { teams, players });
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Загрузка данных...</p>
      </div>
    );
  }

  let myTeam = null;
  let teamRelation = null;
  
  if (userRoles.isCoach && coachTeam) {
    myTeam = coachTeam;
    teamRelation = "coach";
    console.log('✅ Coach with team:', myTeam.name);
  } else if (userRoles.isPlayer && currentPlayer?.team_id) {
    myTeam = teams.find(t => t.id === currentPlayer.team_id);
    teamRelation = userRoles.isCaptain ? "captain" : "player";
    console.log('✅ Player with team:', myTeam?.name);
  } else if (userRoles.isFan && user?.favorite_team_id) {
    myTeam = teams.find(t => t.id === user.favorite_team_id);
    teamRelation = "fan";
    console.log('✅ Fan with team:', myTeam?.name);
  }
  
  const teamPlayers = myTeam ? players.filter(p => p.team_id === myTeam.id) : [];
  const pendingSentOffers = (sentOffers || []).filter(o => o.status === "pending");
  const pendingTeamRequests = (teamRequests || []).filter(r => r.team_id === myTeam?.id && r.status === "pending");
  const myTeamNotifications = (teamNotifications || []).filter(n => n.team_id === myTeam?.id);
  const unreadNotifications = myTeamNotifications.filter(n => !n.is_read);
  const canManageTeam = teamRelation === "coach";

  console.log('📊 Team data:', {
    myTeam: myTeam?.name,
    teamRelation,
    teamPlayers: teamPlayers.length,
    pendingSentOffers: pendingSentOffers.length,
    pendingTeamRequests: pendingTeamRequests.length,
    canManageTeam
  });

  const handleSendMessage = async () => {
    if (!teamMessage.trim() || !myTeam) return;
    setSendingMessage(true);
    const result = await sendTeamMessage(myTeam.id, myTeam.name, teamMessage);
    setSendingMessage(false);
    if (result?.sent > 0) {
      alert(`✅ Сообщение отправлено ${result.sent} игрокам`);
      setTeamMessage("");
    } else {
      alert(`❌ Не удалось отправить (${result?.debug || 'ошибка'})`);
    }
  };

  // Fan without team
  if (userRoles.isFan && !myTeam) {
    console.log('🎯 Rendering: Fan without team');
    return (
      <div style={{ paddingBottom: "100px" }}>
        <Header title="Моя команда" />
        <Container>
          <div style={{ padding: "20px 0" }}>
            <Card style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>💛</div>
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>Выберите любимую команду</h3>
              <p style={{ margin: 0, fontSize: "14px", color: colors.goldDark }}>Следите за результатами и получайте уведомления</p>
            </Card>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Команды турнира</h3>
            {teams.map(team => (
              <Card key={team.id} onClick={() => onSelectFavoriteTeam(team.id)} style={{ marginBottom: "12px", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "48px", height: "48px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>{team.logo_url || "🏐"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "15px" }}>{team.name}</div>
                    <div style={{ fontSize: "13px", color: colors.goldDark }}>{team.wins}В {team.losses}П • {team.points} очков</div>
                  </div>
                  <Icons.ChevronRight />
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </div>
    );
  }

  // Free agent player
  if (userRoles.isPlayer && !myTeam && !userRoles.isCoach) {
    console.log('🎯 Rendering: Free agent player');
    return (
      <div style={{ paddingBottom: "100px" }}>
        <Header title="Моя команда" />
        <Container>
          <div style={{ padding: "20px 0" }}>
            <Card style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🏐</div>
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>Вы свободный игрок</h3>
              <p style={{ margin: "0 0 16px", fontSize: "14px", color: colors.goldDark }}>Ожидайте приглашения от команд</p>
              <Button variant="outline" onClick={() => setScreen("offers")}>Мои приглашения</Button>
            </Card>
          </div>
        </Container>
      </div>
    );
  }

  // Coach without team
  if (userRoles.isCoach && !myTeam) {
    console.log('🎯 Rendering: Coach without team');
    return (
      <div style={{ paddingBottom: "100px" }}>
        <Header title="Моя команда" />
        <Container>
          <div style={{ padding: "20px 0" }}>
            <Card style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📋</div>
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>У вас нет команды</h3>
              <p style={{ margin: 0, fontSize: "14px", color: colors.goldDark }}>Свяжитесь с администратором для назначения</p>
            </Card>
          </div>
        </Container>
      </div>
    );
  }

  console.log('🎯 Rendering: Main team view');

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Моя команда" rightElement={
        teamRelation === "fan" ? (
          <button onClick={() => onSelectFavoriteTeam(null)} style={{ background: "none", border: "none", color: colors.goldDark, fontSize: "13px", cursor: "pointer" }}>Сменить</button>
        ) : (teamRelation === "player" || teamRelation === "captain") && onLeaveTeam ? (
          <button onClick={onLeaveTeam} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "13px", cursor: "pointer" }}>Покинуть</button>
        ) : null
      } />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {/* Team Info Card */}
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ width: "80px", height: "80px", background: colors.goldLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "40px" }}>{myTeam?.logo_url || "🏐"}</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 700 }}>{myTeam?.name}</h2>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              {teamRelation === "coach" && <Badge variant="gold">Вы тренер</Badge>}
              {teamRelation === "captain" && <Badge variant="captain">Вы капитан</Badge>}
              {teamRelation === "player" && <Badge variant="free">Ваша команда</Badge>}
              {teamRelation === "fan" && <Badge variant="gold">Любимая команда</Badge>}
            </div>
          </Card>

          {/* Stats Card */}
          <Card style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>СТАТИСТИКА</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center" }}>
              <div><div style={{ fontSize: "24px", fontWeight: 700, color: "#16a34a" }}>{myTeam?.wins || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Побед</div></div>
              <div><div style={{ fontSize: "24px", fontWeight: 700, color: "#dc2626" }}>{myTeam?.losses || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Поражений</div></div>
              <div><div style={{ fontSize: "24px", fontWeight: 700 }}>{myTeam?.sets_won || 0}:{myTeam?.sets_lost || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Партии</div></div>
            </div>
          </Card>

          {/* Pending Team Requests (for coach) */}
          {canManageTeam && pendingTeamRequests.length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Заявки в команду ({pendingTeamRequests.length})</h3>
              {pendingTeamRequests.map(request => {
                const player = players.find(p => p.id === request.player_id);
                return (
                  <Card key={request.id} style={{ marginBottom: "8px", padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                      <Avatar name={player?.users?.first_name || player?.users?.username} size={40} url={player?.users?.avatar_url} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{player?.users?.first_name || `@${player?.users?.username}`}</div>
                        <div style={{ fontSize: "12px", color: colors.goldDark }}>{player?.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button variant="success" onClick={() => onAcceptTeamRequest(request.id, request.player_id)} disabled={actionLoading} style={{ flex: 1, padding: "8px" }}>Принять</Button>
                      <Button variant="danger" onClick={() => onRejectTeamRequest(request.id)} disabled={actionLoading} style={{ flex: 1, padding: "8px" }}>Отклонить</Button>
                    </div>
                  </Card>
                );
              })}
            </>
          )}

          {/* Pending Sent Offers (for coach) */}
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
          )}

          {/* Team Roster */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Состав ({teamPlayers.length})</h3>
            {canManageTeam && <Button variant="outline" onClick={() => setScreen("players")} style={{ padding: "6px 12px", fontSize: "12px" }}>+ Пригласить</Button>}
          </div>

          {teamPlayers.length > 0 ? teamPlayers.map(player => (
            <Card key={player.id} style={{ marginBottom: "8px", padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div onClick={() => { setSelectedPlayer(player); setScreen("playerDetail"); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <Avatar name={player.users?.first_name || player.users?.username} size={44} url={player.users?.avatar_url} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>
                      {player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}
                      {player.is_captain && <span style={{ marginLeft: "6px", color: colors.gold }}>©</span>}
                    </div>
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>{player?.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</div>
                  </div>
                </div>
                
                {/* Jersey Number */}
                {canManageTeam ? (
                  editingJersey === player.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }} onClick={e => e.stopPropagation()}>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={jerseyValue}
                        onChange={e => setJerseyValue(e.target.value)}
                        style={{ width: "50px", padding: "6px", textAlign: "center", borderRadius: "6px", border: `1px solid ${colors.gold}`, fontSize: "14px" }}
                        autoFocus
                      />
                      <button onClick={() => { onUpdateJerseyNumber(player.id, jerseyValue); setEditingJersey(null); }} style={{ background: colors.gold, color: "white", border: "none", borderRadius: "4px", padding: "6px 8px", cursor: "pointer" }}>✓</button>
                      <button onClick={() => setEditingJersey(null)} style={{ background: colors.gray, border: "none", borderRadius: "4px", padding: "6px 8px", cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setEditingJersey(player.id); setJerseyValue(player.jersey_number || ""); }} style={{ background: player.jersey_number ? colors.goldLight : colors.gray, border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: colors.goldDark }}>
                      {player.jersey_number ? `#${player.jersey_number}` : "№"}
                    </button>
                  )
                ) : (
                  player.jersey_number && <div style={{ fontSize: "16px", fontWeight: 700, color: colors.gold, marginRight: "8px" }}>#{player.jersey_number}</div>
                )}
                
                {/* Captain Toggle */}
                {canManageTeam && (
                  <button onClick={(e) => { e.stopPropagation(); onSetCaptain(myTeam.id, player.id, !player.is_captain); }} style={{ background: player.is_captain ? "#fef3c7" : colors.gray, border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", cursor: "pointer", color: player.is_captain ? "#92400e" : colors.goldDark }}>{player.is_captain ? "©" : "Капитан"}</button>
                )}
                
                {/* Remove Player */}
                {canManageTeam && player.user_id !== user?.id && (
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Удалить ${player.users?.first_name || 'игрока'} из команды?`)) onRemovePlayer(player.id); }} disabled={actionLoading}
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px", opacity: actionLoading ? 0.5 : 1 }}>
                    <Icons.X />
                  </button>
                )}
              </div>
            </Card>
          )) : (
            <Card style={{ textAlign: "center", color: colors.goldDark }}>Состав пока не заполнен</Card>
          )}

          {/* Team Message (for coach) */}
          {canManageTeam && (
            <Card style={{ marginTop: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>📢 СООБЩЕНИЕ КОМАНДЕ</h3>
              <textarea
                value={teamMessage}
                onChange={e => setTeamMessage(e.target.value)}
                placeholder="Напишите сообщение для игроков..."
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${colors.grayBorder}`, fontSize: "14px", minHeight: "80px", resize: "vertical", boxSizing: "border-box" }}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={sendingMessage || !teamMessage.trim()}
                style={{ width: "100%", marginTop: "12px" }}
              >
                {sendingMessage ? "Отправка..." : "📨 Отправить в Telegram"}
              </Button>
            </Card>
          )}
        </div>
      </Container>
    </div>
  );
};
