import { useState} from 'react';
import { colors } from '../constants/colors';
import { Header, Card, Button, Badge, Container, Avatar, Input, Select, Icons } from '../components/ui';
import { positionLabels } from '../constants/labels';
import { } from '../lib/supabase';

export const PlayersScreen = ({ setScreen, players, userRoles, coachTeam, onSendOffer, sentOffers, setSelectedPlayer, user, myPlayerId, teams, playerStats, users }) => {
  const [filter, setFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const canInvite = (userRoles.isCoach || userRoles.isAdmin) && coachTeam;
  
  // Создаем список всех людей: игроки + тренеры
  const allPeople = [];
  
  // Добавляем всех игроков с их очками
  (players || []).forEach(player => {
    const stats = (playerStats || []).filter(s => s.player_id === player.id);
    const totalPoints = stats.reduce((sum, s) => {
      const points = (s.attack_points || 0) + (s.aces || 0) + (s.block_points || 0);
      const errors = (s.attack_errors || 0) + (s.serve_errors || 0) + (s.block_errors || 0) + (s.receive_errors || 0);
      return sum + points - errors;
    }, 0);
    allPeople.push({ 
      ...player, 
      totalPoints,
      type: 'player',
      sortName: player.users?.first_name || player.users?.username || ''
    });
  });
  
  // Добавляем тренеров и помечаем игроков-тренеров
  (teams || []).forEach(team => {
    if (team.coach_id) {
      // Проверяем есть ли уже этот человек как игрок
      const existingPlayer = allPeople.find(p => p.user_id === team.coach_id);
      if (existingPlayer) {
        // Если это игрок - помечаем что он также тренер
        existingPlayer.isCoach = true;
        existingPlayer.coachTeamId = team.id;
      } else {
        // Находим данные тренера в users
        const coachUser = (users || []).find(u => u.id === team.coach_id);
        if (coachUser) {
          // Создаем запись для тренера
          allPeople.push({
            id: `coach_${team.coach_id}`,
            user_id: team.coach_id,
            users: coachUser,
            team_id: team.id,
            teams: team,
            is_free_agent: false,
            positions: [],
            totalPoints: 0,
            type: 'coach',
            isCoach: true,
            sortName: coachUser.first_name || coachUser.username || ''
          });
        }
      }
    }
  });
  
  const filteredPlayers = allPeople.filter(p => {
    if (filter === "free" && !p.is_free_agent) return false;
    if (filter === "team" && (p.is_free_agent || p.type === 'coach')) return false;
    if (filter === "coach" && !p.isCoach) return false;
    if (positionFilter !== "all" && p.type !== 'coach' && !p.positions?.includes(positionFilter)) return false;
    
    // Поиск по ФИО
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${p.users?.first_name || ""} ${p.users?.last_name || ""} ${p.users?.username || ""}`.toLowerCase();
      if (!fullName.includes(query)) return false;
    }
    
    return true;
  }).sort((a, b) => {
    // Любимые игроки вверху
    const aIsFavorite = user?.favorite_players?.includes(a.id);
    const bIsFavorite = user?.favorite_players?.includes(b.id);
    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;
    
    // Затем мой игрок / игрок из моей команды
    const aIsMy = a.id === myPlayerId || a.team_id === user?.favorite_team_id;
    const bIsMy = b.id === myPlayerId || b.team_id === user?.favorite_team_id;
    if (aIsMy && !bIsMy) return -1;
    if (!aIsMy && bIsMy) return 1;
    
    // Сортировка по очкам (больше очков - выше)
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    
    // Сортировка по имени
    return (a.sortName || '').localeCompare(b.sortName || '');
  });
  
  const hasPendingOffer = (playerId) => (sentOffers || []).some(o => o.player_id === playerId && o.status === "pending");

  return (
    <div style={{ paddingBottom: "100px" }}>
      <Header title="Игроки" />
      <Container>
        <div style={{ padding: "20px 0" }}>
          {/* Фильтры */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", overflowX: "auto" }}>
            {[{ id: "all", label: "Все" }, { id: "free", label: "Свободные" }, { id: "team", label: "В команде" }, { id: "coach", label: "Тренеры" }].map(tab => (
              <button key={tab.id} onClick={() => setFilter(tab.id)} style={{
                padding: "8px 16px", borderRadius: "20px", border: "none",
                background: filter === tab.id ? colors.gold : colors.gray,
                color: filter === tab.id ? colors.bg : colors.text,
                fontWeight: 500, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
              }}>{tab.label}</button>
            ))}
          </div>
          
          {/* Фильтр по амплуа */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", overflowX: "auto" }}>
            <button onClick={() => setPositionFilter("all")} style={{
              padding: "6px 12px", borderRadius: "16px", border: `1px solid ${colors.grayBorder}`,
              background: positionFilter === "all" ? colors.goldLight : colors.bg,
              color: colors.text, fontWeight: 500, fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
            }}>Все амплуа</button>
            {Object.entries(positionLabels).map(([key, label]) => (
              <button key={key} onClick={() => setPositionFilter(key)} style={{
                padding: "6px 12px", borderRadius: "16px", border: `1px solid ${colors.grayBorder}`,
                background: positionFilter === key ? colors.goldLight : colors.bg,
                color: colors.text, fontWeight: 500, fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
              }}>{label}</button>
            ))}
          </div>

          {/* Поиск по ФИО */}
          <Input 
            label="Поиск"
            placeholder="Введите имя или фамилию..."
            value={searchQuery} 
            onChange={setSearchQuery}
          />
          
          {filteredPlayers.map(player => (
            <Card 
              key={player.id} 
              style={{ marginBottom: "12px", cursor: "pointer" }}
              onClick={() => { 
                setSelectedPlayer(player); 
                setScreen("playerDetail");
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar name={player.users?.first_name || player.users?.username} size={48} url={player.users?.avatar_url} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "2px" }}>
                    {user?.favorite_players?.includes(player.id) && <span style={{ color: colors.gold, marginRight: "4px" }}>★</span>}
                    {player.users?.first_name || `@${player.users?.username}`} {player.users?.last_name || ""}
                  </div>
                  {(player.type !== 'coach' || player.positions?.length > 0) && (
                    <div style={{ fontSize: "13px", color: colors.goldDark }}>
                      {player.positions?.length > 0 ? player.positions.map(p => positionLabels[p] || p).join(", ") : "Амплуа не указано"}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: colors.goldDark, marginTop: "2px" }}>{player.teams?.name || "Без команды"}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                  {player.totalPoints > 0 && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: colors.gold }}>{player.totalPoints}</div>
                      <div style={{ fontSize: "10px", color: colors.goldDark }}>очков</div>
                    </div>
                  )}
                  {player.isCoach && <Badge variant="gold">Тренер</Badge>}
                  {player.type === 'player' && <Badge variant={player.is_free_agent ? "free" : "default"}>{player.is_free_agent ? "Свободен" : "В команде"}</Badge>}
                  {canInvite && player.type === 'player' && player.is_free_agent && (
                    hasPendingOffer(player.id) ? <Badge variant="pending">Приглашён</Badge> : (
                      <Button onClick={(e) => { e.stopPropagation(); onSendOffer(player.id); }} style={{ padding: "6px 12px", fontSize: "12px" }}><Icons.Send /> Пригласить</Button>
                    )
                  )}
                </div>
              </div>
            </Card>
          ))}
          {filteredPlayers.length === 0 && <Card style={{ textAlign: "center", color: colors.goldDark }}>Никого не найдено</Card>}
        </div>
      </Container>
    </div>
  );
};

