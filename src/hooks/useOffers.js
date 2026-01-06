import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useOffers(user, teams, players, loadData) {
  const [actionLoading, setActionLoading] = useState(false);

  const handleSendOffer = useCallback(async (playerId) => {
    const coachTeam = teams.find(t => t.coach_id === user?.id);
    if (!coachTeam || !user) return;
    
    try {
      setActionLoading(true);
      await supabase.from("offers").insert({
        team_id: coachTeam.id,
        player_id: playerId,
        status: "pending"
      });
      await loadData();
      alert("Приглашение отправлено!");
    } catch (error) {
      console.error("Error sending offer:", error);
      alert("Ошибка отправки приглашения");
    } finally {
      setActionLoading(false);
    }
  }, [user, teams, loadData]);

  const handleAcceptOffer = useCallback(async (offerId, teamId) => {
    try {
      setActionLoading(true);
      const player = players.find(p => p.user_id === user?.id);
      if (!player) return;

      await supabase.from("players").update({ 
        team_id: teamId, 
        is_free_agent: false 
      }).eq("id", player.id);
      
      await supabase.from("offers").update({ status: "accepted" }).eq("id", offerId);
      await supabase.from("offers").delete().eq("player_id", player.id).neq("id", offerId);
      
      // Обновляем количество игроков в команде
      const { data: teamPlayers } = await supabase
        .from("players")
        .select("id")
        .eq("team_id", teamId);
      
      await supabase.from("teams").update({ 
        players_count: teamPlayers?.length || 0 
      }).eq("id", teamId);
      
      await loadData();
      alert("Вы присоединились к команде!");
    } catch (error) {
      console.error("Error accepting offer:", error);
      alert("Ошибка принятия приглашения");
    } finally {
      setActionLoading(false);
    }
  }, [user, players, loadData]);

  const handleRejectOffer = useCallback(async (offerId) => {
    try {
      setActionLoading(true);
      await supabase.from("offers").update({ status: "rejected" }).eq("id", offerId);
      await loadData();
    } catch (error) {
      console.error("Error rejecting offer:", error);
    } finally {
      setActionLoading(false);
    }
  }, [loadData]);

  const handleSendTeamRequest = useCallback(async (teamId) => {
    const player = players.find(p => p.user_id === user?.id);
    if (!player || !user) {
      alert("Только игроки могут подавать заявки в команду");
      return;
    }
    
    try {
      setActionLoading(true);
      await supabase.from("team_requests").insert({
        team_id: teamId,
        player_id: player.id,
        status: "pending"
      });
      await loadData();
      alert("Заявка отправлена тренеру команды!");
    } catch (error) {
      console.error("Error sending team request:", error);
      alert("Ошибка отправки заявки");
    } finally {
      setActionLoading(false);
    }
  }, [user, players, loadData]);

  const handleAcceptTeamRequest = useCallback(async (requestId, playerId) => {
    try {
      setActionLoading(true);
      const coachTeam = teams.find(t => t.coach_id === user?.id);
      if (!coachTeam) return;

      await supabase.from("players").update({ 
        team_id: coachTeam.id, 
        is_free_agent: false 
      }).eq("id", playerId);
      
      await supabase.from("team_requests").update({ status: "accepted" }).eq("id", requestId);
      await supabase.from("team_requests").delete().eq("player_id", playerId).neq("id", requestId);
      
      const { data: teamPlayers } = await supabase
        .from("players")
        .select("id")
        .eq("team_id", coachTeam.id);
      
      await supabase.from("teams").update({ 
        players_count: teamPlayers?.length || 0 
      }).eq("id", coachTeam.id);
      
      await loadData();
      alert("Игрок добавлен в команду!");
    } catch (error) {
      console.error("Error accepting team request:", error);
      alert("Ошибка принятия заявки");
    } finally {
      setActionLoading(false);
    }
  }, [user, teams, loadData]);

  const handleRejectTeamRequest = useCallback(async (requestId) => {
    try {
      setActionLoading(true);
      await supabase.from("team_requests").update({ status: "rejected" }).eq("id", requestId);
      await loadData();
    } catch (error) {
      console.error("Error rejecting team request:", error);
    } finally {
      setActionLoading(false);
    }
  }, [loadData]);

  return {
    actionLoading,
    setActionLoading,
    handleSendOffer,
    handleAcceptOffer,
    handleRejectOffer,
    handleSendTeamRequest,
    handleAcceptTeamRequest,
    handleRejectTeamRequest
  };
}
