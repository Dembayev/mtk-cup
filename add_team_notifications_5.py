# Добавляем уведомление при выходе игрока из команды

with open('src/App.jsx', 'r') as f:
    content = f.read()

# Добавляем уведомление в handleLeaveTeam для игрока
old_player_leave = '''      if (isPlayer && currentPlayer) {
        // Удаляем из игроков команды
        await supabase.from("players").update({ team_id: null, is_free_agent: true, is_captain: false }).eq("id", currentPlayer.id);
        alert("Вы покинули команду и стали свободным игроком");
      }'''

new_player_leave = '''      if (isPlayer && currentPlayer) {
        // Создаем уведомление для команды
        if (currentPlayer.team_id) {
          const leavingPlayerName = user?.first_name || user?.username || "Игрок";
          await createTeamNotification(
            currentPlayer.team_id,
            'player_left',
            `${leavingPlayerName} покинул команду`,
            currentPlayer.id,
            leavingPlayerName
          );
        }
        
        // Удаляем из игроков команды
        await supabase.from("players").update({ team_id: null, is_free_agent: true, is_captain: false }).eq("id", currentPlayer.id);
        alert("Вы покинули команду и стали свободным игроком");
      }'''

content = content.replace(old_player_leave, new_player_leave)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✅ Добавлено уведомление при выходе игрока из команды")
