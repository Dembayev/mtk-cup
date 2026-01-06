import { } from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { positionLabels } from '../constants/labels';
import { } from '../lib/supabase';

export const PlayerDetailScreen = ({ setScreen, player, teams, setSelectedTeam, playerStats, matches, user, onToggleFavorite, userRoles }) => {
  const team = teams.find(t => t.id === player?.team_id);
  const coachOfTeam = teams?.find(t => t.coach_id === player?.user_id); // Проверяем является ли игрок тренером
  
  const getAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };
  
  const age = getAge(player?.birth_date);
  
  // Агрегируем статистику игрока
  const stats = (playerStats || []).filter(s => s.player_id === player?.id);
  const totalStats = stats.reduce((acc, s) => ({
    games: acc.games + 1,
    aces: acc.aces + (s.aces || 0),
    serve_errors: acc.serve_errors + (s.serve_errors || 0),
    receive_errors: acc.receive_errors + (s.receive_errors || 0),
    attack_points: acc.attack_points + (s.attack_points || 0),
    attack_errors: acc.attack_errors + (s.attack_errors || 0),
    block_points: acc.block_points + (s.block_points || 0),
    block_errors: acc.block_errors + (s.block_errors || 0),
  }), { games: 0, aces: 0, serve_errors: 0, receive_errors: 0, attack_points: 0, attack_errors: 0, block_points: 0, block_errors: 0 });
  
  // Считаем победы/поражения
  const playerMatches = stats.map(s => matches?.find(m => m.id === s.match_id)).filter(Boolean);
  const wins = playerMatches.filter(m => {
    if (m.status !== "finished") return false;
    const isTeam1 = m.team1_id === player?.team_id;
    return isTeam1 ? m.sets_team1 > m.sets_team2 : m.sets_team2 > m.sets_team1;
  }).length;
  const losses = totalStats.games - wins;
  
  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Профиль игрока" showBack onBack={() => setScreen("players")} />
      <Container>
        <div style={{ padding: "20px 0" }}>
          <Card style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <Avatar name={player?.users?.first_name || player?.users?.username} size={80} url={player?.users?.avatar_url} />
            </div>
            <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700 }}>
              {player?.users?.first_name || `@${player?.users?.username}`} {player?.users?.last_name || ""}
            </h2>
            {player?.users?.username && userRoles?.isAdmin && (
              <p style={{ margin: "0 0 12px", color: colors.goldDark, fontSize: "14px" }}>@{player.users.username}</p>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              {player?.is_captain && <Badge variant="captain">Капитан</Badge>}
              {coachOfTeam && <Badge variant="gold">Тренер ({coachOfTeam.name})</Badge>}
              {player?.type !== 'coach' && (
                <Badge variant={player?.is_free_agent ? "free" : "gold"}>
                  {player?.is_free_agent ? "Свободный игрок" : "В команде"}
                </Badge>
              )}
            </div>
            {onToggleFavorite && user && (
              <Button 
                variant={user?.favorite_players?.includes(player?.id) ? "primary" : "outline"}
                onClick={() => onToggleFavorite(player?.id)} 
                style={{ marginTop: "16px", width: "100%" }}
              >
                {user?.favorite_players?.includes(player?.id) ? "★ В избранном" : "☆ В избранное"}
              </Button>
            )}
          </Card>

          {(player?.height || age) && (
            <Card style={{ marginBottom: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: player?.height && age ? "1fr 1fr" : "1fr", gap: "16px", textAlign: "center" }}>
                {player?.height && (
                  <div>
                    <div style={{ fontSize: "28px", fontWeight: 700, color: colors.gold }}>{player.height}</div>
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>Рост (см)</div>
                  </div>
                )}
                {age && (
                  <div>
                    <div style={{ fontSize: "28px", fontWeight: 700, color: colors.gold }}>{age}</div>
                    <div style={{ fontSize: "12px", color: colors.goldDark }}>Возраст</div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>ИНФОРМАЦИЯ</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: colors.goldDark }}>Команда</span>
                {team ? (
                  <span style={{ fontWeight: 600, cursor: "pointer", color: colors.gold, display: "flex", alignItems: "center", gap: "4px" }}
                    onClick={() => { setSelectedTeam && setSelectedTeam(team); setScreen("teamDetail"); }}>
                    {team.name} <Icons.ChevronRight />
                  </span>
                ) : (
                  <span style={{ fontWeight: 600 }}>Без команды</span>
                )}
              </div>
              {(player?.type !== 'coach' || player?.positions?.length > 0) && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.goldDark }}>Амплуа</span>
                  <span style={{ fontWeight: 600 }}>{player?.positions?.map(p => positionLabels[p] || p).join(", ") || "Не указано"}</span>
                </div>
              )}
              {player?.jersey_number && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.goldDark }}>Номер</span>
                  <span style={{ fontWeight: 700, color: colors.gold }}>#{player.jersey_number}</span>
                </div>
              )}
              {player?.birth_date && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.goldDark }}>Дата рождения</span>
                  <span style={{ fontWeight: 600 }}>{new Date(player.birth_date).toLocaleDateString("ru-RU")}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Статистика */}
          <Card style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>СТАТИСТИКА</h3>
            {totalStats.games > 0 ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: 700 }}>{totalStats.games}</div>
                    <div style={{ fontSize: "11px", color: colors.goldDark }}>Игр</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: "#16a34a" }}>{wins}</div>
                    <div style={{ fontSize: "11px", color: colors.goldDark }}>Побед</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: "#dc2626" }}>{losses}</div>
                    <div style={{ fontSize: "11px", color: colors.goldDark }}>Поражений</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
                    <span style={{ color: colors.goldDark }}>Подача</span>
                    <span><span style={{ color: "#16a34a", fontWeight: 600 }}>{totalStats.aces} эйсов</span> / <span style={{ color: "#dc2626" }}>{totalStats.serve_errors} ош.</span></span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
                    <span style={{ color: colors.goldDark }}>Приём</span>
                    <span style={{ color: "#dc2626" }}>{totalStats.receive_errors} ошибок</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.grayBorder}` }}>
                    <span style={{ color: colors.goldDark }}>Атака</span>
                    <span><span style={{ color: "#16a34a", fontWeight: 600 }}>{totalStats.attack_points} очков</span> / <span style={{ color: "#dc2626" }}>{totalStats.attack_errors} ош.</span></span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                    <span style={{ color: colors.goldDark }}>Блок</span>
                    <span><span style={{ color: "#16a34a", fontWeight: 600 }}>{totalStats.block_points} очков</span> / <span style={{ color: "#dc2626" }}>{totalStats.block_errors} ош.</span></span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", color: colors.goldDark, padding: "12px 0" }}>
                Статистика пока не заполнена
              </div>
            )}
          </Card>

          {player?.bio && (
            <Card style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>О СЕБЕ</h3>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5, color: colors.text }}>{player.bio}</p>
            </Card>
          )}

          {player?.users?.username && userRoles?.isAdmin && (
            <Button variant="outline" onClick={() => window.open(`https://t.me/${player.users.username}`, '_blank')} style={{ width: "100%", marginTop: "8px" }}>
              <Icons.Send /> Написать в Telegram
            </Button>
          )}
        </div>
      </Container>
    </div>
  );
};

