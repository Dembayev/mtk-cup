import { } from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { } from '../lib/supabase';

export const TeamsScreen = ({ setScreen, teams, setSelectedTeam, user, myTeamId }) => {
  // Сортируем: моя команда / любимая команда вверху
  const sortedTeams = [...teams].sort((a, b) => {
    const aIsMy = a.id === myTeamId || a.id === user?.favorite_team_id;
    const bIsMy = b.id === myTeamId || b.id === user?.favorite_team_id;
    if (aIsMy && !bIsMy) return -1;
    if (!aIsMy && bIsMy) return 1;
    return (b.points || 0) - (a.points || 0);
  });
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Команды" showBack onBack={() => setScreen("home")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <p style={{ color: colors.goldDark, marginBottom: "16px" }}>{teams.length} команд в турнире</p>
          {sortedTeams.map((team) => {
            const isMy = team.id === myTeamId || team.id === user?.favorite_team_id;
            return (
              <Card key={team.id} onClick={() => { setSelectedTeam(team); setScreen("teamDetail"); }} style={{ marginBottom: "12px", border: isMy ? `2px solid ${colors.gold}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "56px", height: "56px", background: colors.goldLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", overflow: "hidden" }}>
                  {team.logo_url && team.logo_url.startsWith('http') ? (
                    <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    team.logo_url || "🏐"
                  )}
                </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600 }}>
                      {team.name} {isMy && <span style={{ fontSize: "12px", color: colors.gold }}>★</span>}
                    </h3>
                    <p style={{ margin: 0, fontSize: "13px", color: colors.goldDark }}>{team.wins}В {team.losses}П • {team.points} очков</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: colors.gold }}>#{teams.sort((a,b) => (b.points||0)-(a.points||0)).indexOf(team) + 1}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Container>
    </div>
  );
}

