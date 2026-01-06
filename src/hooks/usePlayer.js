import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function usePlayer(user, loadData, setActionLoading) {

  const handleUpdatePosition = useCallback(async (position) => {
    if (!user) return;
    
    try {
      setActionLoading(true);
      
      // Находим запись игрока
      const { data: player } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (player) {
        await supabase.from("players").update({ 
          position: position 
        }).eq("id", player.id);
      }
      
      await loadData();
    } catch (error) {
      console.error("Error updating position:", error);
    } finally {
      setActionLoading(false);
    }
  }, [user, loadData, setActionLoading]);

  const handleToggleFavoritePlayer = useCallback(async (playerId) => {
    if (!user) return;
    
    try {
      setActionLoading(true);
      const favorites = user.favorite_players || [];
      const newFavorites = favorites.includes(playerId)
        ? favorites.filter(id => id !== playerId)
        : [...favorites, playerId];
      
      await supabase.from("users").update({ 
        favorite_players: newFavorites 
      }).eq("id", user.id);
      
      await loadData();
    } catch (error) {
      console.error("Error toggling favorite player:", error);
    } finally {
      setActionLoading(false);
    }
  }, [user, loadData, setActionLoading]);

  const handleUpdatePlayer = useCallback(async (playerId, jerseyNumber, positions) => {
    try {
      setActionLoading(true);
      await supabase.from("players").update({ 
        jersey_number: jerseyNumber || null,
        position: positions?.[0] || null
      }).eq("id", playerId);
      await loadData();
    } catch (error) {
      console.error("Error updating player:", error);
      alert("Ошибка обновления игрока");
    } finally {
      setActionLoading(false);
    }
  }, [loadData, setActionLoading]);

  const handleUpdateNotifications = useCallback(async (field, value) => {
    if (!user) return;
    
    try {
      await supabase.from("users").update({ 
        [field]: value 
      }).eq("id", user.id);
      await loadData();
    } catch (error) {
      console.error("Error updating notifications:", error);
    }
  }, [user, loadData]);

  const handleRequestPhone = useCallback(async () => {
    // Telegram WebApp contact request
    const tg = window.Telegram?.WebApp;
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
  }, [user, loadData]);

  return {
    handleUpdatePosition,
    handleToggleFavoritePlayer,
    handleUpdatePlayer,
    handleUpdateNotifications,
    handleRequestPhone
  };
}
