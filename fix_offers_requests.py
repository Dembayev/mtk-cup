# Исправляем логику принятия/отклонения offers и requests

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. В handleRejectOffer добавляем loadData() для обновления UI
old_reject = '''  const handleRejectOffer = async (offerId) => {
    try {
      setActionLoading(true);
      await supabase.from("offers").update({ status: "rejected" }).eq("id", offerId);
      setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: "rejected" } : o));
    } catch (error) {
      console.error("Error rejecting offer:", error);
      alert("Ошибка при отклонении приглашения");
    } finally {
      setActionLoading(false);
    }
  };'''

new_reject = '''  const handleRejectOffer = async (offerId) => {
    try {
      setActionLoading(true);
      await supabase.from("offers").update({ status: "rejected" }).eq("id", offerId);
      await loadData();
    } catch (error) {
      console.error("Error rejecting offer:", error);
      alert("Ошибка при отклонении приглашения");
    } finally {
      setActionLoading(false);
    }
  };'''

content = content.replace(old_reject, new_reject)

# 2. В handleAcceptTeamRequest добавляем отклонение pending offers
old_accept_request = '''      // Отклоняем другие заявки этого игрока
      await supabase.from("team_requests").update({ status: "rejected" }).eq("player_id", playerId).eq("status", "pending").neq("id", requestId);
      // Очищаем favorite_team_id'''

new_accept_request = '''      // Отклоняем другие заявки этого игрока
      await supabase.from("team_requests").update({ status: "rejected" }).eq("player_id", playerId).eq("status", "pending").neq("id", requestId);
      // Отклоняем все pending offers для этого игрока
      await supabase.from("offers").update({ status: "rejected" }).eq("player_id", playerId).eq("status", "pending");
      // Очищаем favorite_team_id'''

content = content.replace(old_accept_request, new_accept_request)

# 3. В handleAcceptOffer добавляем отклонение pending team_requests
old_accept_offer = '''      // Сначала отклоняем все другие pending офферы
      console.log("🏐 AcceptOffer: Rejecting other pending offers");
      await supabase.from("offers").update({ status: "rejected" }).eq("player_id", currentPlayer.id).eq("status", "pending").neq("id", offerId);
      // Принимаем выбранный оффер'''

new_accept_offer = '''      // Сначала отклоняем все другие pending офферы
      console.log("🏐 AcceptOffer: Rejecting other pending offers");
      await supabase.from("offers").update({ status: "rejected" }).eq("player_id", currentPlayer.id).eq("status", "pending").neq("id", offerId);
      // Отклоняем все pending team_requests для этого игрока
      await supabase.from("team_requests").update({ status: "rejected" }).eq("player_id", currentPlayer.id).eq("status", "pending");
      // Принимаем выбранный оффер'''

content = content.replace(old_accept_offer, new_accept_offer)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✅ Исправлена логика offers и team_requests")
