import re

# Читаем файл
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Находим функцию handleSelectFavoriteTeam и добавляем loadData()
old_function = '''  const handleSelectFavoriteTeam = async (teamId) => {
    try {
      setActionLoading(true);
      await supabase.from("users").update({ favorite_team_id: teamId }).eq("id", user.id);
      setUser(prev => ({ ...prev, favorite_team_id: teamId }));
    } catch (error) {
      console.error("Error selecting favorite team:", error);
      alert("Ошибка выбора команды");
    } finally {
      setActionLoading(false);
    }
  };'''

new_function = '''  const handleSelectFavoriteTeam = async (teamId) => {
    try {
      setActionLoading(true);
      await supabase.from("users").update({ favorite_team_id: teamId }).eq("id", user.id);
      setUser(prev => ({ ...prev, favorite_team_id: teamId }));
      await loadData(); // Перезагружаем данные чтобы обновить myTeam
    } catch (error) {
      console.error("Error selecting favorite team:", error);
      alert("Ошибка выбора команды");
    } finally {
      setActionLoading(false);
    }
  };'''

content = content.replace(old_function, new_function)

# Записываем обратно
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Добавлен loadData() в handleSelectFavoriteTeam")
