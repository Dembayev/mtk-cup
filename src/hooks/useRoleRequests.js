import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useRoleRequests(user, loadData, setActionLoading) {

  const handleSubmitRoleRequest = useCallback(async (roleData) => {
    if (!user) return;
    
    try {
      setActionLoading(true);
      
      const { error } = await supabase.from("role_requests").insert({
        user_id: user.id,
        requested_role: roleData.role,
        first_name: roleData.first_name,
        last_name: roleData.last_name,
        positions: roleData.positions || [],
        team_id: roleData.team_id || null,
        status: "pending"
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
  }, [user, loadData, setActionLoading]);

  const handleApproveRequest = useCallback(async (requestId) => {
    try {
      setActionLoading(true);
      
      const { data: request } = await supabase
        .from("role_requests")
        .select("*")
        .eq("id", requestId)
        .single();
      
      if (!request) throw new Error("Request not found");
      
      // Обновляем пользователя
      await supabase.from("users").update({
        role: request.requested_role,
        first_name: request.first_name,
        last_name: request.last_name,
        name_edited_by_admin: true
      }).eq("id", request.user_id);
      
      // Если игрок - создаём запись
      if (request.requested_role === "player") {
        const { data: existingPlayer } = await supabase
          .from("players")
          .select("id")
          .eq("user_id", request.user_id)
          .single();
        
        if (!existingPlayer) {
          await supabase.from("players").insert({
            user_id: request.user_id,
            team_id: null,
            is_free_agent: true,
            position: request.positions?.[0] || null
          });
        }
      }
      
      // Если тренер и указана команда - назначаем
      if (request.requested_role === "coach" && request.team_id) {
        await supabase.from("teams").update({
          coach_id: request.user_id
        }).eq("id", request.team_id);
      }
      
      // Обновляем статус заявки
      await supabase.from("role_requests").update({
        status: "approved"
      }).eq("id", requestId);
      
      await loadData();
      alert("Заявка одобрена!");
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Ошибка одобрения заявки");
    } finally {
      setActionLoading(false);
    }
  }, [loadData, setActionLoading]);

  const handleRejectRequest = useCallback(async (requestId) => {
    try {
      setActionLoading(true);
      await supabase.from("role_requests").update({
        status: "rejected"
      }).eq("id", requestId);
      await loadData();
      alert("Заявка отклонена");
    } catch (error) {
      console.error("Error rejecting request:", error);
    } finally {
      setActionLoading(false);
    }
  }, [loadData, setActionLoading]);

  return {
    handleSubmitRoleRequest,
    handleApproveRequest,
    handleRejectRequest
  };
}
