import { colors } from '../constants';
import { Card, Badge, Avatar, Button, Header, Container, Icons, RoleBadges } from '../components';

export const HomeScreen = ({ 
  setScreen, user, teams, matches, players, userRoles, coachTeam, currentPlayer 
}) => {
  const upcomingMatches = matches
    .filter(m => m.status === "upcoming" || m.status === "live")
    .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time))
    .slice(0, 3);

  const myTeam = userRoles.isCoach && coachTeam ? coachTeam : 
                 userRoles.isPlayer && currentPlayer?.team_id ? teams.find(t => t.id === currentPlayer.team_id) :
                 user?.favorite_team_id ? teams.find(t => t.id === user.favorite_team_id) : null;

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Кубок МТК" rightElement={
        <div onClick={() => setScreen("profile")} style={{ cursor: "pointer" }}>
          <Avatar name={user?.first_name || user?.username} size={36} url={user?.avatar_url} />
        </div>
      } />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {/* Welcome Card */}
          <Card style={{ marginBottom: "20px", background: `linear-gradient(135deg, ${colors.gold}, ${colors.goldDark})`, color: "white" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px" }}>Привет, {user?.first_name || "Гость"}!</h2>
            <RoleBadges roles={userRoles.roles} />
          </Card>

          {/* My Team Card */}
          <Card onClick={() => setScreen("myteam")} style={{ marginBottom: "20px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "48px", height: "48px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
                {myTeam?.logo_url || "🏐"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "15px" }}>{myTeam?.name || "Моя команда"}</div>
                <div style={{ fontSize: "13px", color: colors.goldDark }}>
                  {myTeam ? `${myTeam.wins}В ${myTeam.losses}П` : "Выберите команду"}
                </div>
              </div>
              <Icons.ChevronRight />
            </div>
          </Card>

          {/* Admin Panel Link */}
          {userRoles.isAdmin && (
            <Card onClick={() => setScreen("admin")} style={{ background: "#dbeafe", border: "2px solid #3b82f6", marginBottom: "20px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: "#3b82f6", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                  <Icons.Settings />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Админ-панель</div>
                  <div style={{ fontSize: "13px", color: "#1d4ed8" }}>Управление турниром</div>
                </div>
                <Icons.ChevronRight />
              </div>
            </Card>
          )}

          {/* Upcoming Matches */}
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>Ближайшие матчи</h3>
          {upcomingMatches.length > 0 ? upcomingMatches.map(match => {
            const team1 = teams.find(t => t.id === match.team1_id);
            const team2 = teams.find(t => t.id === match.team2_id);
            return (
              <Card key={match.id} onClick={() => setScreen("schedule")} style={{ marginBottom: "8px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{team1?.name} vs {team2?.name}</div>
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>
                      {new Date(match.scheduled_time).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  {match.status === "live" && <Badge variant="live">LIVE</Badge>}
                </div>
              </Card>
            );
          }) : (
            <Card style={{ textAlign: "center", color: colors.goldDark }}>Нет запланированных матчей</Card>
          )}

          {/* Top Teams */}
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "24px 0 12px" }}>Лидеры турнира</h3>
          {teams.sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 3).map((team, i) => (
            <Card key={team.id} onClick={() => setScreen("table")} style={{ marginBottom: "8px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "32px", height: "32px", background: i === 0 ? colors.gold : colors.gray, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: i === 0 ? "white" : colors.text }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{team.name}</div>
                  <div style={{ fontSize: "12px", color: colors.goldDark }}>{team.wins}В {team.losses}П</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: "18px", color: colors.gold }}>{team.points || 0}</div>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  );
};
