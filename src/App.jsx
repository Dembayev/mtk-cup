import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL } from './lib/supabase';
import { colors } from './constants/colors';
import { getUserRoles } from './utils/helpers';
import { tg, syncAvatar } from './utils/telegram';
import { 
  Header, Card, Button, Badge, Container, Avatar, 
  Input, Select, Icons, NavBar, RoleBadges 
} from './components/ui';

// Import screens
import { 
  OnboardingScreen, WelcomeScreen, HomeScreen, 
  TeamsScreen, TeamDetailScreen, PredictionsScreen,
  ScheduleScreen, TableScreen, PlayersScreen,
  PlayerDetailScreen, OffersScreen, MyTeamScreen,
  AdminScreen, ProfileScreen 
} from './screens';

// Import modals
import { RoleRequestModal } from './modals';

export default function MTKCupApp() {
  // ============ STATE ============
  const [screen, setScreen] = useState("welcome");
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tours, setTours] = useState([]);
  const [players, setPlayers] = useState([]);
  const [users, setUsers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [teamRequests, setTeamRequests] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [roleRequests, setRoleRequests] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRoleRequestForm, setShowRoleRequestForm] = useState(false);
  const [roleRequestData, setRoleRequestData] = useState({ 
    role: "", first_name: "", last_name: "", positions: [] 
  });

  // ============ DERIVED STATE ============
  const userRoles = getUserRoles(user, players, teams, roleRequests);
  const currentPlayer = userRoles.playerRecord;
  const pendingOffers = offers.filter(o => o.player_id === currentPlayer?.id && o.status === "pending");
  const coachTeam = teams.find(t => t.coach_id === user?.id);
  const sentOffers = offers.filter(o => o.team_id === coachTeam?.id);
  const myTeamId = currentPlayer?.team_id || user?.favorite_team_id;

  // ============ INIT ============
  useEffect(() => {
    if (tg) {
      setIsTelegram(true);
      tg.ready();
      tg.expand();
      if (tg.requestFullscreen) tg.requestFullscreen();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      document.body.style.backgroundColor = colors.bg;
      if (tg.initDataUnsafe?.user) handleTelegramLogin(tg.initDataUnsafe.user);
    }
    loadData();
  }, []);

  // ============ DATA LOADING ============
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        { data: teamsData },
        { data: toursData },
        { data: matchesData },
        { data: playersData },
        { data: usersData },
        { data: offersData },
        { data: teamRequestsData },
        { data: playerStatsData },
        { data: roleRequestsData },
        { data: sponsorsData },
        { data: prizesData },
        { data: predictionsData }
      ] = await Promise.all([
        supabase.from("teams").select("*, coaches:coach_id(id, first_name, last_name, username, avatar_url)").order("points", { ascending: false }),
        supabase.from("tours").select("*").order("number"),
        supabase.from("matches").select("*").order("scheduled_time"),
        supabase.from("players").select("*"),
        supabase.from("users").select("*"),
        supabase.from("offers").select("*").order("created_at", { ascending: false }),
        supabase.from("team_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("match_player_stats").select("*"),
        supabase.from("role_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("sponsors").select("*").order("created_at", { ascending: false }),
        supabase.from("prizes").select("*").order("created_at", { ascending: false }),
        supabase.from("predictions").select("*").order("created_at", { ascending: false })
      ]);

      const playersWithDetails = (playersData || []).map(player => ({
        ...player,
        users: usersData?.find(u => u.id === player.user_id) || null,
        teams: teamsData?.find(t => t.id === player.team_id) || null,
      }));

      setTeams(teamsData || []);
      setTours(toursData || []);
      setMatches(matchesData || []);
      setPlayers(playersWithDetails);
      setOffers(offersData || []);
      setTeamRequests(teamRequestsData || []);
      setUsers(usersData || []);
      setPlayerStats(playerStatsData || []);
      setRoleRequests(roleRequestsData || []);
      setSponsors(sponsorsData || []);
      setPrizes(prizesData || []);
      setPredictions(predictionsData || []);
      
      // Обновляем user если он есть
      if (user?.id) {
        const updatedUser = usersData?.find(u => u.id === user.id);
        if (updatedUser) setUser(updatedUser);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // ============ AUTH HANDLERS ============
  const handleTelegramLogin = async (telegramUser) => {
    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", String(telegramUser.id))
        .single();

      if (existingUser) {
        const newAvatarUrl = await syncAvatar(telegramUser.id);
        if (newAvatarUrl && newAvatarUrl !== existingUser.avatar_url) {
          await supabase.from("users").update({ avatar_url: newAvatarUrl }).eq("id", existingUser.id);
          existingUser.avatar_url = newAvatarUrl;
        }
        setUser(existingUser);
        setIsGuest(false);
        setScreen(existingUser.onboarding_completed ? "home" : "onboarding");
      } else {
        const newAvatarUrl = await syncAvatar(telegramUser.id);
        const { data: newUser, error } = await supabase.from("users").insert({
          telegram_id: String(telegramUser.id),
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          avatar_url: newAvatarUrl,
          role: "fan",
          onboarding_completed: false
        }).select().single();

        if (error) throw error;
        setUser(newUser);
        setIsGuest(false);
        setScreen("onboarding");
      }
      await loadData();
    } catch (error) {
      console.error("Telegram login error:", error);
    }
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
    setScreen("home");
  };

  const handleLogout = () => {
    setUser(null);
    setIsGuest(false);
    setScreen("welcome");
  };

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    try {
      await supabase.from("users").update({ onboarding_completed: true }).eq("id", user.id);
      setUser({ ...user, onboarding_completed: true });
      setScreen("home");
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  // ============ OFFER HANDLERS ============
  const handleSendOffer = async (playerId) => {
    if (!coachTeam || !user) return;
    try {
      setActionLoading(true);
      await supabase.from("offers").insert({ team_id: coachTeam.id, player_id: playerId, status: "pending" });
      await loadData();
      alert("Приглашение отправлено!");
    } catch (error) {
      console.error("Error sending offer:", error);
      alert("Ошибка отправки приглашения");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId, teamId) => {
    try {
      setActionLoading(true);
      if (!currentPlayer) return;
      await supabase.from("players").update({ team_id: teamId, is_free_agent: false }).eq("id", currentPlayer.id);
      await supabase.from("offers").update({ status: "accepted" }).eq("id", offerId);
      await supabase.from("offers").delete().eq("player_id", currentPlayer.id).neq("id", offerId);
      const { data: teamPlayers } = await supabase.from("players").select("id").eq("team_id", teamId);
      await supabase.from("teams").update({ players_count: teamPlayers?.length || 0 }).eq("id", teamId);
      await loadData();
      alert("Вы присоединились к команде!");
    } catch (error) {
      console.error("Error accepting offer:", error);
      alert("Ошибка принятия приглашения");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOffer = async (offerId) => {
    try {
      setActionLoading(true);
      await supabase.from("offers").update({ status: "rejected" }).eq("id", offerId);
      await loadData();
    } catch (error) {
      console.error("Error rejecting offer:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTeamRequest = async (teamId) => {
    if (!currentPlayer || !user) {
      alert("Только игроки могут подавать заявки в команду");
      return;
    }
    try {
      setActionLoading(true);
      await supabase.from("team_requests").insert({ team_id: teamId, player_id: currentPlayer.id, status: "pending" });
      await loadData();
      alert("Заявка отправлена тренеру команды!");
    } catch (error) {
      console.error("Error sending team request:", error);
      alert("Ошибка отправки заявки");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptTeamRequest = async (requestId, playerId) => {
    try {
      setActionLoading(true);
      if (!coachTeam) return;
      await supabase.from("players").update({ team_id: coachTeam.id, is_free_agent: false }).eq("id", playerId);
      await supabase.from("team_requests").update({ status: "accepted" }).eq("id", requestId);
      await supabase.from("team_requests").delete().eq("player_id", playerId).neq("id", requestId);
      const { data: teamPlayers } = await supabase.from("players").select("id").eq("team_id", coachTeam.id);
      await supabase.from("teams").update({ players_count: teamPlayers?.length || 0 }).eq("id", coachTeam.id);
      await loadData();
      alert("Игрок добавлен в команду!");
    } catch (error) {
      console.error("Error accepting team request:", error);
      alert("Ошибка принятия заявки");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectTeamRequest = async (requestId) => {
    try {
      setActionLoading(true);
      await supabase.from("team_requests").update({ status: "rejected" }).eq("id", requestId);
      await loadData();
    } catch (error) {
      console.error("Error rejecting team request:", error);
    } finally {
      setActionLoading(false);
    }
  };

  // ============ TEAM HANDLERS ============
  const handleLeaveTeam = async () => {
    if (!currentPlayer || !currentPlayer.team_id) return;
    if (!confirm("Вы уверены, что хотите покинуть команду?")) return;
    try {
      setActionLoading(true);
      const oldTeamId = currentPlayer.team_id;
      await supabase.from("players").update({ team_id: null, is_free_agent: true, is_captain: false }).eq("id", currentPlayer.id);
      const { data: teamPlayers } = await supabase.from("players").select("id").eq("team_id", oldTeamId);
      await supabase.from("teams").update({ players_count: teamPlayers?.length || 0 }).eq("id", oldTeamId);
      await loadData();
      alert("Вы покинули команду");
    } catch (error) {
      console.error("Error leaving team:", error);
      alert("Ошибка выхода из команды");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePlayer = async (playerId) => {
    if (!confirm("Удалить игрока из команды?")) return;
    try {
      setActionLoading(true);
      const player = players.find(p => p.id === playerId);
      const oldTeamId = player?.team_id;
      await supabase.from("players").update({ team_id: null, is_free_agent: true, is_captain: false }).eq("id", playerId);
      if (oldTeamId) {
        const { data: teamPlayers } = await supabase.from("players").select("id").eq("team_id", oldTeamId);
        await supabase.from("teams").update({ players_count: teamPlayers?.length || 0 }).eq("id", oldTeamId);
      }
      await loadData();
      alert("Игрок удалён из команды");
    } catch (error) {
      console.error("Error removing player:", error);
      alert("Ошибка удаления игрока");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectFavoriteTeam = async (teamId) => {
    if (!user) return;
    try {
      setActionLoading(true);
      await supabase.from("users").update({ favorite_team_id: teamId }).eq("id", user.id);
      await loadData();
      alert(teamId ? "Команда выбрана!" : "Выбор убран");
    } catch (error) {
      console.error("Error selecting favorite team:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTeam = async (teamName) => {
    if (!user || !teamName.trim()) return;
    try {
      setActionLoading(true);
      const { data: newTeam, error } = await supabase.from("teams").insert({ name: teamName.trim(), coach_id: user.id, players_count: 0 }).select().single();
      if (error) throw error;
      await loadData();
      alert("Команда создана!");
      return newTeam;
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Ошибка создания команды");
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetCaptain = async (teamId, playerId, isCaptain) => {
    try {
      setActionLoading(true);
      if (isCaptain) {
        await supabase.from("players").update({ is_captain: false }).eq("team_id", teamId);
      }
      await supabase.from("players").update({ is_captain: isCaptain }).eq("id", playerId);
      await loadData();
    } catch (error) {
      console.error("Error setting captain:", error);
      alert("Ошибка назначения капитана");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateJerseyNumber = async (playerId, jerseyNumber) => {
    try {
      setActionLoading(true);
      await supabase.from("players").update({ jersey_number: jerseyNumber || null }).eq("id", playerId);
      await loadData();
    } catch (error) {
      console.error("Error updating jersey number:", error);
      alert("Ошибка сохранения номера");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTeamMessage = async (teamId, teamName, message) => {
    alert(`Сообщение команде ${teamName}: ${message}`);
  };

  // ============ PLAYER HANDLERS ============
  const handleUpdatePosition = async (position) => {
    if (!user || !currentPlayer) return;
    try {
      setActionLoading(true);
      await supabase.from("players").update({ position }).eq("id", currentPlayer.id);
      await loadData();
    } catch (error) {
      console.error("Error updating position:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFavoritePlayer = async (playerId) => {
    if (!user) return;
    try {
      setActionLoading(true);
      const favorites = user.favorite_players || [];
      const newFavorites = favorites.includes(playerId)
        ? favorites.filter(id => id !== playerId)
        : [...favorites, playerId];
      await supabase.from("users").update({ favorite_players: newFavorites }).eq("id", user.id);
      await loadData();
    } catch (error) {
      console.error("Error toggling favorite player:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const _handleUpdatePlayer = async (playerId, jerseyNumber, positions) => {
    try {
      setActionLoading(true);
      await supabase.from("players").update({ jersey_number: jerseyNumber || null, position: positions?.[0] || null }).eq("id", playerId);
      await loadData();
    } catch (error) {
      console.error("Error updating player:", error);
      alert("Ошибка обновления игрока");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateNotifications = async (field, value) => {
    if (!user) return;
    try {
      await supabase.from("users").update({ [field]: value }).eq("id", user.id);
      await loadData();
    } catch (error) {
      console.error("Error updating notifications:", error);
    }
  };

  const handleRequestPhone = async () => {
    if (tg?.requestContact) {
      tg.requestContact(async (sent, event) => {
        if (sent && event?.responseUnsafe?.contact?.phone_number) {
          const phone = event.responseUnsafe.contact.phone_number;
          await supabase.from("users").update({ phone }).eq("id", user.id);
          await loadData();
          alert("Телефон сохранён!");
        }
      });
    } else {
      alert("Функция доступна только в Telegram");
    }
  };

  // ============ PREDICTION HANDLERS ============
  const handleMakePrediction = async (matchId, team1Score, team2Score) => {
    if (!user?.id) {
      alert("Войдите чтобы делать прогнозы");
      return;
    }
    try {
      setActionLoading(true);
      const match = matches.find(m => m.id === matchId);
      if (match?.status !== "upcoming") {
        alert("Матч уже начался, прогноз недоступен");
        return;
      }
      const existing = predictions.find(p => p.user_id === user.id && p.match_id === matchId);
      if (existing) {
        alert("Вы уже сделали прогноз на этот матч");
        return;
      }
      const { error } = await supabase.from("predictions").insert({
        user_id: user.id, match_id: matchId, predicted_score_team1: team1Score, predicted_score_team2: team2Score, points_earned: 0
      });
      if (error) throw error;
      await loadData();
      alert("✅ Прогноз принят!");
    } catch (error) {
      console.error("Error making prediction:", error);
      alert("Ошибка сохранения прогноза");
    } finally {
      setActionLoading(false);
    }
  };

  // ============ ROLE REQUEST HANDLERS ============
  const handleSubmitRoleRequest = async (roleData) => {
    if (!user) return;
    try {
      setActionLoading(true);
      const { error } = await supabase.from("role_requests").insert({
        user_id: user.id, requested_role: roleData.role, first_name: roleData.first_name, last_name: roleData.last_name,
        positions: roleData.positions || [], team_id: roleData.team_id || null, status: "pending"
      });
      if (error) throw error;
      await loadData();
      alert("Заявка отправлена на рассмотрение!");
      return true;
    } catch (error) {
      console.error("Error submitting role request:", error);
      alert("Ошибка отправки заявки");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // ============ LOADING SCREEN ============
  if (loading && screen === "welcome") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏐</div>
          <p style={{ color: colors.goldDark }}>Загрузка...</p>
        </div>
      </div>
    );
  }

  // ============ RENDER SCREEN ============
  const renderScreen = () => {
    switch (screen) {
      case "welcome":
        return <WelcomeScreen onLogin={handleTelegramLogin} onGuest={handleGuestLogin} isTelegram={isTelegram} />;
      case "onboarding":
        return <OnboardingScreen user={user} onComplete={handleCompleteOnboarding} setRoleRequestData={setRoleRequestData} setShowRoleRequestForm={setShowRoleRequestForm} />;
      case "home":
        return <HomeScreen setScreen={setScreen} user={user} teams={teams} matches={matches} players={players} pendingOffers={pendingOffers} userRoles={userRoles} setSelectedPlayer={setSelectedPlayer} playerStats={playerStats} tours={tours} />;
      case "teams":
        return <TeamsScreen setScreen={setScreen} teams={teams} setSelectedTeam={setSelectedTeam} user={user} myTeamId={myTeamId} />;
      case "team":
        return <TeamDetailScreen setScreen={setScreen} team={selectedTeam} players={players} users={users} setSelectedPlayer={setSelectedPlayer} user={user} onSelectFavoriteTeam={handleSelectFavoriteTeam} userRoles={userRoles} currentPlayer={currentPlayer} onLeaveTeam={handleLeaveTeam} onSendTeamRequest={handleSendTeamRequest} teamRequests={teamRequests} actionLoading={actionLoading} />;
      case "predictions":
        return <PredictionsScreen matches={matches} teams={teams} tours={tours} sponsors={sponsors} prizes={prizes} predictions={predictions} user={user} onMakePrediction={handleMakePrediction} users={users} />;
      case "schedule":
        return <ScheduleScreen matches={matches} teams={teams} tours={tours} isGuest={isGuest} setSelectedTeam={setSelectedTeam} setScreen={setScreen} />;
      case "table":
        return <TableScreen teams={teams} setSelectedTeam={setSelectedTeam} setScreen={setScreen} />;
      case "players":
        return <PlayersScreen setScreen={setScreen} players={players} userRoles={userRoles} coachTeam={coachTeam} onSendOffer={handleSendOffer} sentOffers={sentOffers} setSelectedPlayer={setSelectedPlayer} user={user} myPlayerId={currentPlayer?.id} teams={teams} playerStats={playerStats} users={users} />;
      case "player":
        return <PlayerDetailScreen setScreen={setScreen} player={selectedPlayer} teams={teams} setSelectedTeam={setSelectedTeam} playerStats={playerStats} matches={matches} user={user} onToggleFavorite={handleToggleFavoritePlayer} userRoles={userRoles} />;
      case "offers":
        return <OffersScreen setScreen={setScreen} offers={pendingOffers} teams={teams} onAccept={handleAcceptOffer} onReject={handleRejectOffer} loading={actionLoading} isInTeam={!!currentPlayer?.team_id} />;
      case "myteam":
        return <MyTeamScreen setScreen={setScreen} user={user} teams={teams} players={players} coachTeam={coachTeam} currentPlayer={currentPlayer} sentOffers={sentOffers} onRemovePlayer={handleRemovePlayer} onSelectFavoriteTeam={handleSelectFavoriteTeam} onLeaveTeam={handleLeaveTeam} actionLoading={actionLoading} userRoles={userRoles} setSelectedPlayer={setSelectedPlayer} teamRequests={teamRequests} onAcceptTeamRequest={handleAcceptTeamRequest} onRejectTeamRequest={handleRejectTeamRequest} onUpdateJerseyNumber={handleUpdateJerseyNumber} onSetCaptain={handleSetCaptain} onSendTeamMessage={handleSendTeamMessage} onCreateTeam={handleCreateTeam} />;
      case "admin":
        return <AdminScreen setScreen={setScreen} matches={matches} teams={teams} users={users} players={players} tours={tours} playerStats={playerStats} roleRequests={roleRequests} sponsors={sponsors} prizes={prizes} predictions={predictions} actionLoading={actionLoading} loadData={loadData} />;
      case "profile":
        return <ProfileScreen user={user} onLogout={handleLogout} isGuest={isGuest} isTelegram={isTelegram} setScreen={setScreen} pendingOffers={pendingOffers} userRoles={userRoles} onUpdateNotifications={handleUpdateNotifications} roleRequests={roleRequests} onSubmitRoleRequest={handleSubmitRoleRequest} onRequestPhone={handleRequestPhone} currentPlayer={currentPlayer} onUpdatePosition={handleUpdatePosition} setRoleRequestData={setRoleRequestData} setShowRoleRequestForm={setShowRoleRequestForm} />;
      default:
        return <HomeScreen setScreen={setScreen} user={user} teams={teams} matches={matches} players={players} pendingOffers={pendingOffers} userRoles={userRoles} setSelectedPlayer={setSelectedPlayer} playerStats={playerStats} tours={tours} />;
    }
  };

  // ============ MAIN RENDER ============
  return (
    <div style={{ minHeight: "100vh", background: colors.bg }}>
      {renderScreen()}
      
      {/* Bottom Navigation */}
      {!["welcome", "onboarding"].includes(screen) && (
        <NavBar screen={screen} setScreen={setScreen} isGuest={isGuest} userRoles={userRoles} pendingOffers={pendingOffers} />
      )}
      
      {/* Role Request Modal */}
      <RoleRequestModal
        show={showRoleRequestForm}
        roleRequestData={roleRequestData}
        setRoleRequestData={setRoleRequestData}
        onSubmit={async (data) => {
          const success = await handleSubmitRoleRequest(data);
          if (success) {
            setShowRoleRequestForm(false);
            setRoleRequestData({ role: "", first_name: "", last_name: "", positions: [] });
            if (screen === "onboarding") {
              await handleCompleteOnboarding();
            }
          }
        }}
        onClose={() => setShowRoleRequestForm(false)}
        teams={teams}
        user={user}
        roleRequests={roleRequests}
      />
    </div>
  );
}
