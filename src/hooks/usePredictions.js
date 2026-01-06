import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function usePredictions(user, matches, predictions, loadData, setActionLoading) {

  const handleMakePrediction = useCallback(async (matchId, team1Score, team2Score) => {
    if (!user?.id) {
      alert("Войдите чтобы делать прогнозы");
      return;
    }
    
    try {
      setActionLoading(true);
      
      // Проверяем не начался ли матч
      const match = matches.find(m => m.id === matchId);
      if (match?.status !== "upcoming") {
        alert("Матч уже начался, прогноз недоступен");
        return;
      }
      
      // Проверяем нет ли уже прогноза
      const existing = predictions.find(p => p.user_id === user.id && p.match_id === matchId);
      if (existing) {
        alert("Вы уже сделали прогноз на этот матч");
        return;
      }
      
      const { error } = await supabase.from("predictions").insert({
        user_id: user.id,
        match_id: matchId,
        predicted_score_team1: team1Score,
        predicted_score_team2: team2Score,
        points_earned: 0
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
  }, [user, matches, predictions, loadData, setActionLoading]);

  return {
    handleMakePrediction
  };
}
