import { positionLabels } from '../constants/labels';
import { } from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { } from '../lib/supabase';

export const TeamDetailScreen = ({ setScreen, team, players, users, setSelectedPlayer, user, onSelectFavoriteTeam, userRoles, currentPlayer, onLeaveTeam, onSendTeamRequest, teamRequests, actionLoading }) => {
  const teamPlayers = (players || []).filter(p => p.team_id === team?.id);
  const isMyTeam = currentPlayer && currentPlayer.team_id === team?.id;
  const isFreeAgent = currentPlayer && currentPlayer.is_free_agent;
  const hasPendingRequest = teamRequests?.some(r => r.team_id === team?.id && r.player_id === currentPlayer?.id && r.status === "pending");
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header 
        title={team?.name || "Команда"} 
        showBack 
        onBack={() => setScreen("teams")} 
        rightElement={
          isMyTeam && onLeaveTeam ? (
            <button onClick={onLeaveTeam} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "13px", cursor: "pointer" }}>Покинуть</button>
          ) : isFreeAgent && onSendTeamRequest && !hasPendingRequest ? (
            <button onClick={() => onSendTeamRequest(team?.id)} disabled={actionLoading} style={{ background: "none", border: "none", color: "#16a34a", fontSize: "13px", cursor: "pointer" }}>Подать заявку</button>
          ) : isFreeAgent && hasPendingRequest ? (
            <span style={{ color: "#d97706", fontSize: "13px" }}>Заявка отправлена</span>
          ) : null
        }
      />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ width: "80px", height: "80px", background: colors.goldLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "40px", overflow: "hidden" }}>
              {team?.logo_url && team.logo_url.startsWith('http') ? (
                <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                team?.logo_url || "🏐"
              )}
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 700 }}>{team?.name}</h2>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge>{team?.games_played || 0} игр</Badge>
              <Badge variant="gold">{team?.points || 0} очков</Badge>
            </div>
            {userRoles?.isFan && user?.favorite_team_id === team?.id && (
              <div style={{ marginTop: "16px" }}><Badge variant="gold">💛 Любимая команда</Badge></div>
            )}
            {userRoles?.isFan && user?.favorite_team_id !== team?.id && onSelectFavoriteTeam && (
              <Button 
                variant="outline" 
                onClick={() => onSelectFavoriteTeam(team?.id)} 
                style={{ marginTop: "12px", width: "100%" }}
              >
                💛 Сделать любимой
              </Button>
            )}
          </Card>

          <Card style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>СТАТИСТИКА</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center" }}>
              <div><div style={{ fontSize: "24px", fontWeight: 700, color: "#16a34a" }}>{team?.wins || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Побед</div></div>
              <div><div style={{ fontSize: "24px", fontWeight: 700, color: "#dc2626" }}>{team?.losses || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Поражений</div></div>
              <div><div style={{ fontSize: "24px", fontWeight: 700 }}>{team?.sets_won || 0}:{team?.sets_lost || 0}</div><div style={{ fontSize: "12px", color: colors.goldDark }}>Партии</div></div>
            </div>
          </Card>


          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Состав команды ({(() => {
            // Считаем уникальных членов команды
            const coachIsPlayer = team?.coach_id && teamPlayers.some(p => p.user_id === team.coach_id);
            const coachCount = team?.coach_id && !coachIsPlayer ? 1 : 0;
            return teamPlayers.length + coachCount;
          })()})</h3>          
          {/* Тренер как первый элемент состава */}
          {team?.coach_id && (() => {
            const coach = users?.find(u => u.id === team.coach_id);
            if (!coach) return null;
            
            // Ищем тренера среди ВСЕХ игроков (он может играть в другой команде)
            const coachPlayer = players?.find(p => p.user_id === coach.id);
            
            return (
              <Card 
                key={`coach-${coach.id}`}
                style={{ 
                  marginBottom: "8px", 
                  padding: "12px 16px", 
                  cursor: coachPlayer ? "pointer" : "default",
                  background: "#fffbeb" 
                }}
                onClick={() => {
                  if (coachPlayer && setSelectedPlayer && setScreen) {
                    setSelectedPlayer(coachPlayer);
                    setScreen("playerDetail");
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Avatar name={coach.first_name || coach.username} size={40} url={coach.avatar_url} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>
                      {coach.first_name || `@${coach.username}`} {coach.last_name || ""}
                      {coachPlayer?.is_captain && <span style={{ marginLeft: "8px", color: colors.gold }}>©</span>}
                    </div>
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>
                      <span style={{ fontWeight: 600, color: colors.gold }}>Тренер</span>
                      {coachPlayer?.positions?.length > 0 && <span> • {coachPlayer.positions.map(p => positionLabels[p] || p).join(", ")}</span>}
                    </div>
                  </div>
                  {coachPlayer?.jersey_number && <div style={{ fontSize: "18px", fontWeight: 700, color: colors.gold }}>#{coachPlayer.jersey_number}</div>}
                  {coachPlayer && <Icons.ChevronRight />}
                </div>
              </Card>
            );
          })()}
          
          {teamPlayers.length > 0 ? teamPlayers
            .filter(player => player.user_id !== team?.coach_id) // Убираем тренера - он уже показан выше
            .map(player => (
            <Card 
              key={player.id} 
              style={{ marginBottom: "8px", padding: "12px 16px", cursor: "pointer" }}
              onClick={() => { setSelectedPlayer && setSelectedPlayer(player); setScreen && setScreen("playerDetail"); }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar name={player.users?.first_name || player.users?.username} size={40} url={player.users?.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>
                    {player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}
                    {player.is_captain && <span style={{ marginLeft: "8px", color: colors.gold }}>©</span>}
                  </div>
                  <div style={{ fontSize: "12px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</div>
                </div>
                {player.jersey_number && <div style={{ fontSize: "18px", fontWeight: 700, color: colors.gold }}>#{player.jersey_number}</div>}
                <Icons.ChevronRight />
              </div>
            </Card>
          )) : (
            <Card style={{ textAlign: "center", color: colors.goldDark }}>Состав пока не заполнен</Card>
          )}
        </div>
      </Container>
    </div>
  );
};


// Экран прогнозов
