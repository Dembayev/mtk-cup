import { useState} from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { positionLabels } from '../constants/labels';
import { } from '../lib/supabase';

export const MyTeamScreen = ({ setScreen, user, teams, players, coachTeam, currentPlayer, sentOffers, onRemovePlayer, onSelectFavoriteTeam, onLeaveTeam, actionLoading, userRoles, setSelectedPlayer, teamRequests, onAcceptTeamRequest, onRejectTeamRequest, onUpdateJerseyNumber, onSetCaptain, onSendTeamMessage }) => {
  let myTeam = null;
  let teamRelation = null;
  
  if (userRoles.isCoach && coachTeam) {
    myTeam = coachTeam;
    teamRelation = "coach";
  } else if (userRoles.isPlayer && currentPlayer?.team_id) {
    myTeam = teams.find(t => t.id === currentPlayer.team_id);
    teamRelation = userRoles.isCaptain ? "captain" : "player";
  } else if (userRoles.isFan && user?.favorite_team_id) {
    myTeam = teams.find(t => t.id === user.favorite_team_id);
    teamRelation = "fan";
  }
  
  const teamPlayers = myTeam ? (players || []).filter(p => p.team_id === myTeam.id) : [];
  const teamCoach = myTeam?.coaches;
  const pendingSentOffers = (sentOffers || []).filter(o => o.status === "pending");
  const pendingTeamRequests = (teamRequests || []).filter(r => r.team_id === myTeam?.id && r.status === "pending");

  // Для создания команды (тренер без команды)
      const [editingJersey, setEditingJersey] = useState(null);
  const [jerseyValue, setJerseyValue] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [processedRequests, setProcessedRequests] = useState(new Set());


  if (userRoles.isFan && !myTeam) {
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
                  <div style={{ width: "48px", height: "48px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", overflow: "hidden" }}>
                  {team.logo_url && team.logo_url.startsWith('http') ? (
                    <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    team.logo_url || "🏐"
                  )}
                </div>
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

  if (userRoles.isPlayer && !myTeam && !userRoles.isCoach) {
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


  if (userRoles.isCoach && !myTeam) {
    return (
      <div style={{ paddingBottom: "100px" }}>
        <Header title="Моя команда" />
        <Container>
          <div style={{ padding: "20px 0" }}>
            <Card style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📋</div>
              <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 600 }}>Вы тренер без команды</h3>
              <p style={{ margin: "0 0 16px", fontSize: "14px", color: colors.goldDark }}>
                Обратитесь к администратору для назначения на команду или создания новой команды.
              </p>
            </Card>
          </div>
        </Container>
      </div>
    );
  }

  
  const handleAcceptRequest = async (requestId, playerId) => {
    setProcessedRequests(prev => new Set(prev).add(requestId));
    await onAcceptTeamRequest(requestId, playerId);
  };
  
  const handleRejectRequest = async (requestId) => {
    setProcessedRequests(prev => new Set(prev).add(requestId));
    await onRejectTeamRequest(requestId);
  };

  const handleSendMessage = async () => {
    if (!teamMessage.trim() || !myTeam) return;
    setSendingMessage(true);
    const result = await onSendTeamMessage(myTeam.id, myTeam.name, teamMessage);
    setSendingMessage(false);
    if (result?.sent > 0) {
      alert(`Сообщение отправлено ${result.sent} игрокам`);
      setTeamMessage("");
    } else {
      alert(`Не удалось отправить: ${result?.debug || 'ошибка'}`);
    }
  };

  const canManageTeam = teamRelation === "coach";

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Моя команда" rightElement={

        teamRelation === "fan" ? (
          <button onClick={() => onSelectFavoriteTeam(null)} style={{ background: "none", border: "none", color: colors.goldDark, fontSize: "13px", cursor: "pointer" }}>Сменить</button>
        ) : (teamRelation === "player" || teamRelation === "captain" || teamRelation === "coach") && onLeaveTeam ? (
          <button onClick={onLeaveTeam} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "13px", cursor: "pointer" }}>Покинуть</button>
        ) : null
      } />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ width: "80px", height: "80px", background: colors.goldLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "40px", overflow: "hidden" }}>
            {myTeam?.logo_url && myTeam.logo_url.startsWith('http') ? (
              <img src={myTeam.logo_url} alt={myTeam.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              myTeam?.logo_url || "🏐"
            )}
          </div>            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 700 }}>{myTeam?.name}</h2>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              {teamRelation === "coach" && <Badge variant="gold">Вы тренер</Badge>}
              {teamRelation === "captain" && <Badge variant="captain">Вы капитан</Badge>}
              {teamRelation === "player" && <Badge variant="free">Ваша команда</Badge>}
              {teamRelation === "fan" && <Badge variant="gold">Любимая команда</Badge>}
              {userRoles.isCoach && teamRelation !== "coach" && <Badge variant="gold">+ Тренер</Badge>}
              {userRoles.isPlayer && teamRelation === "coach" && <Badge variant="free">+ Игрок</Badge>}
            </div>
            </Card>

          <Card style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>СТАТИСТИКА</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center" }}>
              <div><div style={{ fontSize: "24px", fontWeight: 700, color: "#16a34a" }}>{myTeam?.wins || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Побед</div></div>
              <div><div style={{ fontSize: "24px", fontWeight: 700, color: "#dc2626" }}>{myTeam?.losses || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Поражений</div></div>
              <div><div style={{ fontSize: "24px", fontWeight: 700 }}>{myTeam?.sets_won || 0}:{myTeam?.sets_lost || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Партии</div></div>
            </div>
          </Card>

          {canManageTeam && pendingTeamRequests.filter(r => !processedRequests.has(r.id)).length > 0 && (
            <>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Заявки в команду ({pendingTeamRequests.filter(r => !processedRequests.has(r.id)).length})</h3>
              {pendingTeamRequests.filter(r => !processedRequests.has(r.id)).map(request => {
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
                      <Button variant="success" onClick={() => handleAcceptRequest(request.id, request.player_id)} disabled={actionLoading} style={{ flex: 1, padding: "8px" }}>Принять</Button>
                      <Button variant="danger" onClick={() => handleRejectRequest(request.id)} disabled={actionLoading} style={{ flex: 1, padding: "8px" }}>Отклонить</Button>
                    </div>
                  </Card>
                );
              })}
            </>
          )}

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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Состав ({teamPlayers.length + (teamCoach ? 1 : 0)})</h3>
          </div>
          {teamCoach && (
            <Card style={{ marginBottom: "8px", padding: "12px 16px", background: colors.goldLight }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar name={teamCoach.first_name || teamCoach.username} size={44} url={teamCoach.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>
                    {teamCoach.first_name || `@${teamCoach.username}`} {teamCoach.last_name || ""}
                  </div>
                  <div style={{ fontSize: "12px", color: colors.goldDark }}>Тренер</div>
                </div>
                <Badge variant="gold">Тренер</Badge>
              </div>
            </Card>
          )}
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
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</div>
                  </div>
                </div>
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
                    <button onClick={(e) => { e.stopPropagation(); setEditingJersey(player.id); setJerseyValue(player.jersey_number || ""); }} style={{ background: player.jersey_number ? colors.goldLight : colors.gray, border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: player.jersey_number ? colors.goldDark : colors.goldDark }}>
                      {player.jersey_number ? `#${player.jersey_number}` : "№"}
                    </button>
                  )
                ) : (
                  player.jersey_number && <div style={{ fontSize: "16px", fontWeight: 700, color: colors.gold, marginRight: "8px" }}>#{player.jersey_number}</div>
                )}
                {canManageTeam && (
                  <button onClick={(e) => { e.stopPropagation(); onSetCaptain(myTeam.id, player.id, !player.is_captain); }} style={{ background: player.is_captain ? "#fef3c7" : colors.gray, border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", cursor: "pointer", color: player.is_captain ? "#92400e" : colors.goldDark }}>{player.is_captain ? "©" : "Капитан"}</button>
                )}
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

          {/* Team Message (for coach, players, captains) */}
          {(canManageTeam || teamRelation === "player" || teamRelation === "captain") && (
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

// Stat Field Component (работает точно как Input)
const StatField = ({ label, value, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
    <span style={{ fontSize: "11px", color: colors.goldDark, width: "30px" }}>{label}</span>
    <input 
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value ?? ""}
      onChange={e => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        onChange(val === "" ? "" : parseInt(val) || 0);
      }}
      style={{ width: "40px", padding: "4px", textAlign: "center", borderRadius: "4px", border: `1px solid ${colors.grayBorder}`, fontSize: "12px" }}
    />
  </div>
);

// Player Stat Input Component
const PlayerStatInput = ({ player, matchId, existingStat, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Отдельные state для каждого поля (как в Input компоненте)
  const [aces, setAces] = useState(existingStat?.aces || "");
  const [serveErrors, setServeErrors] = useState(existingStat?.serve_errors || "");
  const [receiveErrors, setReceiveErrors] = useState(existingStat?.receive_errors || "");
  const [attackPoints, setAttackPoints] = useState(existingStat?.attack_points || "");
  const [attackErrors, setAttackErrors] = useState(existingStat?.attack_errors || "");
  const [blockPoints, setBlockPoints] = useState(existingStat?.block_points || "");
  const [blockErrors, setBlockErrors] = useState(existingStat?.block_errors || "");
  
  const handleSave = async () => {
    const stat = {
      aces: parseInt(aces) || 0, 
      serve_errors: parseInt(serveErrors) || 0, 
      receive_errors: parseInt(receiveErrors) || 0,
      attack_points: parseInt(attackPoints) || 0, 
      attack_errors: parseInt(attackErrors) || 0,
      block_points: parseInt(blockPoints) || 0, 
      block_errors: parseInt(blockErrors) || 0
    };
    console.log("Saving stat:", { playerId: player.id, matchId, stat, existingId: existingStat?.id });
    await onSave(player.id, matchId, stat, existingStat?.id);
    setIsEditing(false);
  };
  
  
  if (!isEditing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
        <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
        <span style={{ fontSize: "13px", flex: 1 }}>
          {player.jersey_number && <span style={{ color: colors.gold, marginRight: "4px" }}>#{player.jersey_number}</span>}
          {player.users?.first_name || player.users?.username} {player.users?.last_name || ""}
        </span>
        {existingStat ? (
          <span style={{ fontSize: "11px", color: colors.goldDark }}>
            А:{existingStat.aces}/{existingStat.serve_errors} | Ат:{existingStat.attack_points}/{existingStat.attack_errors} | Б:{existingStat.block_points}
          </span>
        ) : (
          <span style={{ fontSize: "11px", color: colors.goldDark }}>—</span>
        )}
        <button onClick={() => setIsEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.gold, padding: "4px" }}>
          <Icons.Edit />
        </button>
      </div>
    );
  }
  
  return (
    <div style={{ padding: "12px", background: colors.gray, borderRadius: "8px", marginBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <Avatar name={player.users?.first_name || player.users?.username} size={28} url={player.users?.avatar_url} />
        <span style={{ fontSize: "13px", fontWeight: 600 }}>
          {player.jersey_number && <span style={{ color: colors.gold, marginRight: "4px" }}>#{player.jersey_number}</span>}
          {player.users?.first_name || player.users?.username} {player.users?.last_name || ""}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Подача</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <StatField label="Эйс" value={aces} onChange={setAces} />
            <StatField label="Ош" value={serveErrors} onChange={setServeErrors} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Приём</div>
          <StatField label="Ош" value={receiveErrors} onChange={setReceiveErrors} />
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Атака</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <StatField label="Очк" value={attackPoints} onChange={setAttackPoints} />
            <StatField label="Ош" value={attackErrors} onChange={setAttackErrors} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.goldDark, marginBottom: "4px" }}>Блок</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <StatField label="Очк" value={blockPoints} onChange={setBlockPoints} />
            <StatField label="Ош" value={blockErrors} onChange={setBlockErrors} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <Button onClick={handleSave} style={{ flex: 1, padding: "8px", fontSize: "12px" }}>
          <Icons.Save /> Сохранить
        </Button>
        <Button variant="outline" onClick={() => setIsEditing(false)} style={{ padding: "8px", fontSize: "12px" }}>
          Отмена
        </Button>
      </div>
    </div>
  );
};

// Admin Panel Screen - РАСШИРЕННАЯ ВЕРСИЯ
