import { } from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { } from '../lib/supabase';

export const TableScreen = ({ teams, setSelectedTeam, setScreen }) => {
  const sortedTeams = [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return ((b.sets_won || 0) - (b.sets_lost || 0)) - ((a.sets_won || 0) - (a.sets_lost || 0));
  });

  const handleTeamClick = (team) => {
    setSelectedTeam(team);
    setScreen("teamDetail");
  };

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Турнирная таблица" />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
                <thead>
                  <tr style={{ background: colors.gray }}>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "12px", fontWeight: 600 }}>#</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "12px", fontWeight: 600 }}>Команда</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>И</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>В</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>П</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>Партии</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>Мячи</th>
                    <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600 }}>О</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.map((team, i) => (
                    <tr 
                      key={team.id} 
                      style={{ borderTop: `1px solid ${colors.grayBorder}`, cursor: "pointer" }}
                      onClick={() => handleTeamClick(team)}
                    >
                      <td style={{ padding: "12px 8px", fontWeight: 700, color: i < 3 ? colors.gold : colors.text }}>{i + 1}</td>
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "18px" }}>
                          {team.logo_url && team.logo_url.startsWith('http') ? (
                            <img src={team.logo_url} alt={team.name} style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "6px", verticalAlign: "middle" }} />
                          ) : (
                            team.logo_url || "🏐"
                          )}
                        </span>
                          <span style={{ fontWeight: 600, fontSize: "14px" }}>{team.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontSize: "14px" }}>{team.games_played || 0}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontSize: "14px", color: "#16a34a" }}>{team.wins || 0}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontSize: "14px", color: "#dc2626" }}>{team.losses || 0}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontSize: "14px" }}>{team.sets_won || 0}:{team.sets_lost || 0}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontSize: "14px" }}>{team.balls_lost ? ((team.balls_won || 0) / team.balls_lost).toFixed(3) : "—"}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, fontSize: "14px", color: colors.gold }}>{team.points || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div style={{ marginTop: "16px", fontSize: "12px", color: colors.goldDark }}>И — игры, В — победы, П — поражения, Мячи — коэффициент, О — очки</div>
        </div>
      </Container>
    </div>
  );
};

