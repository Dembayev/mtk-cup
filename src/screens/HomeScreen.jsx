import { } from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons, RoleBadges } from '../components/ui';
import { getDisplayName } from '../utils/helpers';
import { positionLabels } from '../constants/labels';
import { } from '../lib/supabase';

export const HomeScreen = ({ setScreen, user, teams, matches, players, pendingOffers, userRoles, setSelectedPlayer, playerStats, tours }) => {
  const liveMatch = matches.find(m => m.status === "live");
  
  // Находим ближайший тур по дате от сегодня (независимо от наличия матчей)
  const now = new Date();
  const nextTour = (() => {
    const futureTours = (tours || [])
      .filter(t => t.date && new Date(t.date) >= new Date(now.toDateString()))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return futureTours[0] || null;
  })();

  // Матчи ближайшего тура (если есть)
  const nextTourMatches = nextTour 
    ? (matches || [])
        .filter(m => m.status === "upcoming" && m.tour_id === nextTour.id)
        .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time))
        .slice(0, 2)
    : [];

  // Сортируем игроков по эффективности (очки = атаки + эйсы + блоки)
  const playersWithStats = (players || []).map(player => {
    const stats = (playerStats || []).filter(s => s.player_id === player.id);
    const totalPoints = stats.reduce((sum, s) => {
      const points = (s.attack_points || 0) + (s.aces || 0) + (s.block_points || 0);
      const errors = (s.attack_errors || 0) + (s.serve_errors || 0) + (s.block_errors || 0) + (s.receive_errors || 0);
      return sum + points - errors;
    }, 0);
    return { ...player, totalPoints };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
  const topPlayers = playersWithStats.slice(0, 5);
  const displayName = getDisplayName(user);

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Кубок МТК" />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card onClick={() => setScreen("profile")} style={{
            background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
            color: colors.bg,
            marginBottom: "20px",
            border: "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Avatar name={displayName} size={56} url={user?.avatar_url} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 4px", opacity: 0.9, fontSize: "14px" }}>Добро пожаловать,</p>
                <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 700 }}>{displayName}</h2>
                <RoleBadges roles={userRoles.roles} />
              </div>
              <div style={{ opacity: 0.8 }}><Icons.ChevronRight /></div>
            </div>
          </Card>

          {userRoles.isAdmin && (
            <Card onClick={() => setScreen("admin")} style={{ background: "#dbeafe", border: "2px solid #3b82f6", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: "#3b82f6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                  <Icons.Settings />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#1e40af" }}>Админ-панель</div>
                  <div style={{ fontSize: "13px", color: "#3b82f6" }}>Управление турниром</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          {pendingOffers.length > 0 && (
            <Card onClick={() => setScreen("offers")} style={{ background: "#fef3c7", border: "2px solid #d97706", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: "#d97706", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                  <Icons.Mail />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#92400e" }}>{pendingOffers.length} новых приглашений</div>
                  <div style={{ fontSize: "13px", color: "#a16207" }}>Команды хотят видеть вас в составе</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {[
              { label: "Прогнозы", icon: "🎯", screen: "predictions" },
              { label: "Моя команда", icon: "💛", screen: "myteam" },
              { label: "Команды", icon: "👥", screen: "teams", count: teams.length },
              { label: "Игроки", icon: "⚡", screen: "players" },
            ].map(item => (
              <Card key={item.screen} onClick={() => setScreen(item.screen)} style={{ textAlign: "center", padding: "20px" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>{item.icon}</div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{item.label}</div>
                {item.count && <div style={{ fontSize: "12px", color: colors.goldDark, marginTop: "4px" }}>{item.count} команд</div>}
              </Card>
            ))}
          </div>

          {liveMatch && (
            <>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", background: "#dc2626", borderRadius: "50%", animation: "pulse 2s infinite" }}/>
                Сейчас играют
              </h3>
              <Card style={{ marginBottom: "24px" }}>
                <MatchCard match={liveMatch} teams={teams} />
                {liveMatch.stream_url && (
                  <Button onClick={() => window.open(liveMatch.stream_url, '_blank')} style={{ width: "100%", marginTop: "16px" }}>
                    <Icons.Play /> Смотреть трансляцию
                  </Button>
                )}
              </Card>
            </>
          )}

          {nextTour && (
            <>
              <div style={{ 
                background: colors.gold, 
                color: colors.bg, 
                padding: "12px 16px", 
                borderRadius: "12px", 
                marginBottom: "16px" 
              }}>
                <div style={{ fontSize: "18px", fontWeight: 700 }}>
                  Тур {nextTour.number}
                </div>
                {nextTour.date && (
                  <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icons.Calendar />{new Date(nextTour.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                  </div>
                )}
                {nextTour.location && (
                  <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icons.MapPin />{nextTour.location}{nextTour.address ? `, ${nextTour.address}` : ""}
                  </div>
                )}
              </div>
              {nextTourMatches.length > 0 ? (
                <>
                  {nextTourMatches.map(match => (
                    <Card key={match.id} onClick={() => setScreen("schedule")} style={{ marginBottom: "12px", cursor: "pointer" }}><MatchCard match={match} teams={teams} /></Card>
                  ))}
                </>
              ) : (
                <Card style={{ marginBottom: "12px", textAlign: "center", padding: "20px" }}>
                  <div style={{ color: colors.goldDark, fontSize: "14px" }}>Матчи скоро будут добавлены</div>
                </Card>
              )}
              <Button variant="outline" onClick={() => setScreen("schedule")} style={{ width: "100%", marginTop: "8px" }}>Всё расписание</Button>
            </>
          )}

          {topPlayers.length > 0 && (
            <>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "24px 0 12px" }}>Игроки</h3>
              {topPlayers.map(player => (
                <Card key={player.id} onClick={() => { setSelectedPlayer(player); setScreen("playerDetail"); }} style={{ marginBottom: "8px", padding: "12px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Avatar name={player.users?.first_name || player.users?.username} size={40} url={player.users?.avatar_url} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}</div>
                      <div style={{ fontSize: "12px", color: colors.goldDark }}>{player.positions?.map(p => positionLabels[p] || p).join(", ")} • {player.teams?.name || "Без команды"}</div>
                    </div>
                    {player.totalPoints > 0 && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: colors.gold }}>{player.totalPoints}</div>
                        <div style={{ fontSize: "10px", color: colors.goldDark }}>очков</div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
              <Button variant="outline" onClick={() => setScreen("players")} style={{ width: "100%", marginTop: "8px" }}>Все игроки</Button>
            </>
          )}
        </div>
      </Container>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
};

const MatchCard = ({ match, teams, onTeamClick }) => {
  const team1 = teams.find(t => t.id === match.team1_id);
  const team2 = teams.find(t => t.id === match.team2_id);
  const timeString = match.scheduled_time ? match.scheduled_time.substring(11, 16) : "00:00";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "13px", color: colors.goldDark, display: "flex", alignItems: "center", gap: "4px" }}>
          <Icons.Clock />{timeString}
        </span>
        {match.status === "live" && <Badge variant="live">● LIVE</Badge>}
        {match.status === "finished" && <Badge>Завершён</Badge>}
        {match.status === "upcoming" && <Badge variant="gold">Скоро</Badge>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div 
          style={{ textAlign: "center", flex: 1, cursor: onTeamClick ? "pointer" : "default" }}
          onClick={() => onTeamClick && team1 && onTeamClick(team1)}
        >
      <div style={{ width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px", margin: "0 auto 4px auto" }}>
          {team1?.logo_url && team1.logo_url.startsWith('http') ? (
            <img src={team1.logo_url} alt={team1.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px" }} />
          ) : (
            <span style={{ fontSize: "28px" }}>{team1?.logo_url || "🏐"}</span>
          )}
        </div>
          <div style={{ fontWeight: 600, fontSize: "14px" }}>{team1?.name || "—"}</div>
        </div>
        <div style={{ padding: "8px 16px", background: colors.gray, borderRadius: "8px", fontWeight: 700, fontSize: "20px", minWidth: "80px", textAlign: "center" }}>
          {match.status === "upcoming" ? "—" : `${match.sets_team1 || 0} : ${match.sets_team2 || 0}`}
        </div>
        <div 
          style={{ textAlign: "center", flex: 1, cursor: onTeamClick ? "pointer" : "default" }}
          onClick={() => onTeamClick && team2 && onTeamClick(team2)}
        >
      <div style={{ width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px auto" }}>          {team2?.logo_url && team2.logo_url.startsWith('http') ? (
            <img src={team2.logo_url} alt={team2.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px" }} />
          ) : (
            <span style={{ fontSize: "28px" }}>{team2?.logo_url || "🏐"}</span>
          )}
        </div>
          <div style={{ fontWeight: 600, fontSize: "14px" }}>{team2?.name || "—"}</div>
        </div>
      </div>
    </div>
  );
};
