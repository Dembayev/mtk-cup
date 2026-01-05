with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Добавляем loadData() в handleSelectFavoriteTeam
old_code = '''  const handleSelectFavoriteTeam = async (teamId) => {
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

new_code = '''  const handleSelectFavoriteTeam = async (teamId) => {
    try {
      setActionLoading(true);
      await supabase.from("users").update({ favorite_team_id: teamId }).eq("id", user.id);
      setUser(prev => ({ ...prev, favorite_team_id: teamId }));
      await loadData(); // Reload to show team selection screen
    } catch (error) {
      console.error("Error selecting favorite team:", error);
      alert("Ошибка выбора команды");
    } finally {
      setActionLoading(false);
    }
  };'''

content = content.replace(old_code, new_code)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Добавлен loadData() в handleSelectFavoriteTeam")
