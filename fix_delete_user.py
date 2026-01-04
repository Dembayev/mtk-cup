# Исправляем удаление пользователя-тренера

with open('src/App.jsx', 'r') as f:
    content = f.read()

old_code = '''  const handleDeleteUser = async (userId) => {
    if (!confirm("Удалить пользователя? Это действие нельзя отменить.")) return;
    try {
      setActionLoading(true);
      // Удаляем связанные записи
      await supabase.from("role_requests").delete().eq("user_id", userId);
      await supabase.from("players").delete().eq("user_id", userId);
      await supabase.from("offers").delete().eq("player_id", userId);
      // Удаляем пользователя
      await supabase.from("users").delete().eq("id", userId);
      await loadData();
      alert("Пользователь удалён");
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Ошибка удаления");
    } finally {
      setActionLoading(false);
    }
  };'''

new_code = '''  const handleDeleteUser = async (userId) => {
    if (!confirm("Удалить пользователя? Это действие нельзя отменить.")) return;
    try {
      setActionLoading(true);
      
      // Проверяем является ли пользователь тренером команды
      const { data: coachTeams } = await supabase
        .from("teams")
        .select("id, name")
        .eq("coach_id", userId);
      
      // Если является - убираем его из команд
      if (coachTeams && coachTeams.length > 0) {
        await supabase
          .from("teams")
          .update({ coach_id: null })
          .eq("coach_id", userId);
      }
      
      // Удаляем связанные записи
      await supabase.from("role_requests").delete().eq("user_id", userId);
      await supabase.from("players").delete().eq("user_id", userId);
      await supabase.from("offers").delete().eq("player_id", userId);
      
      // Удаляем пользователя
      await supabase.from("users").delete().eq("id", userId);
      await loadData();
      alert("Пользователь удалён");
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Ошибка удаления");
    } finally {
      setActionLoading(false);
    }
  };'''

content = content.replace(old_code, new_code)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✅ Исправлено удаление пользователя-тренера")
