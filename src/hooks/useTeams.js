import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useTeams(user, players, loadData, setActionLoading) {
  
  const handleLeaveTeam = useCallback(async () => {
    const player = players.find(p => p.user_id === user?.id);
    if (!player || !player.team_id) return;
    
    if (!confirm("Вы уверены, что хотите покинуть команду?")) return;
    
    try {
      setActionLoading(true);
      const oldTeamId = player.team_id;
      
      await supabase.from("players").update({ 
        team_id: null, 
        is_free_agent: true,
        is_captain: false 
      }).eq("id", player.id);
      
      // Обновляем количество игроков
      const { data: teamPlayers } = await supabase
        .from("players")
        .select("id")
        .eq("team_id", oldTeamId);
      
      await supabase.from("teams").update({ 
        players_count: teamPlayers?.length || 0 
      }).eq("id", oldTeamId);
      
      await loadData();
      alert("Вы покинули команду");
    } catch (error) {
      console.error("Error leaving team:", error);
      alert("Ошибка выхода из команды");
    } finally {
      setActionLoading(false);
    }
  }, [user, players, loadData, setActionLoading]);

  const handleRemovePlayer = useCallback(async (playerId) => {
    if (!confirm("Удалить игрока из команды?")) return;
    
    try {
      setActionLoading(true);
      const player = players.find(p => p.id === playerId);
      const oldTeamId = player?.team_id;
      
      await supabase.from("players").update({ 
        team_id: null, 
        is_free_agent: true,
        is_captain: false 
      }).eq("id", playerId);
      
      if (oldTeamId) {
        const { data: teamPlayers } = await supabase
          .from("players")
          .select("id")
          .eq("team_id", oldTeamId);
        
        await supabase.from("teams").update({ 
          players_count: teamPlayers?.length || 0 
        }).eq("id", oldTeamId);
      }
      
      await loadData();
      alert("Игрок удалён из команды");
    } catch (error) {
      console.error("Error removing player:", error);
      alert("Ошибка удаления игрока");
    } finally {
      setActionLoading(false);
    }
  }, [players, loadData, setActionLoading]);

  const handleSelectFavoriteTeam = useCallback(async (teamId) => {
    if (!user) return;
    
    try {
      setActionLoading(true);
      await supabase.from("users").update({ 
        favorite_team_id: teamId 
      }).eq("id", user.id);
      await loadData();
      alert(teamId ? "Команда выбрана!" : "Выбор убран");
    } catch (error) {
      console.error("Error selecting favorite team:", error);
    } finally {
      setActionLoading(false);
    }
  }, [user, loadData, setActionLoading]);

  const handleCreateTeam = useCallback(async (teamName) => {
    if (!user || !teamName.trim()) return;
    
    try {
      setActionLoading(true);
      const { data: newTeam, error } = await supabase.from("teams").insert({
        name: teamName.trim(),
        coach_id: user.id,
        players_count: 0
      }).select().single();
      
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
  }, [user, loadData, setActionLoading]);

  const handleSetCaptain = useCallback(async (teamId, playerId, isCaptain) => {
    try {
      setActionLoading(true);
      
      if (isCaptain) {
        // Убираем капитана у всех игроков команды
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
  }, [loadData, setActionLoading]);

  const handleUpdateJerseyNumber = useCallback(async (playerId, jerseyNumber) => {
    try {
      setActionLoading(true);
      await supabase.from("players").update({ 
        jersey_number: jerseyNumber || null 
      }).eq("id", playerId);
      await loadData();
    } catch (error) {
      console.error("Error updating jersey number:", error);
      alert("Ошибка сохранения номера");
    } finally {
      setActionLoading(false);
    }
  }, [loadData, setActionLoading]);

  const handleSendTeamMessage = useCallback(async (teamId, teamName, message) => {
    // TODO: Implement team message sending via Telegram Bot API
    alert(`Сообщение команде ${teamName}: ${message}`);
  }, []);

  return {
    handleLeaveTeam,
    handleRemovePlayer,
    handleSelectFavoriteTeam,
    handleCreateTeam,
    handleSetCaptain,
    handleUpdateJerseyNumber,
    handleSendTeamMessage
  };
}
