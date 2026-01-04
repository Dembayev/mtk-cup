# Добавляем отправку уведомлений команды при событиях

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Добавляем уведомление при подаче заявки (handleSendTeamRequest)
old_send_request = '''      setTeamRequests(prev => [data, ...prev]);
      
      // Уведомляем тренера команды
      const team = teams.find(t => t.id === teamId);'''

new_send_request = '''      setTeamRequests(prev => [data, ...prev]);
      
      // Создаем уведомление для команды
      const team = teams.find(t => t.id === teamId);
      const playerName = user?.first_name || user?.username || "Игрок";
      await createTeamNotification(
        teamId,
        'team_request',
        `${playerName} подал заявку в команду`,
        currentPlayer.id,
        playerName
      );
      
      // Уведомляем тренера команды'''

content = content.replace(old_send_request, new_send_request)

# 2. Добавляем уведомление при принятии игрока (handleAcceptTeamRequest)
old_accept = '''      await loadData();
      alert("Игрок принят в команду!");'''

new_accept = '''      // Создаем уведомление для команды
      const acceptedPlayerName = player?.users?.first_name || player?.users?.username || "Игрок";
      await createTeamNotification(
        coachTeam.id,
        'player_accepted',
        `${acceptedPlayerName} принят в команду`,
        playerId,
        acceptedPlayerName
      );
      
      await loadData();
      alert("Игрок принят в команду!");'''

content = content.replace(old_accept, new_accept)

# 3. Добавляем уведомление при выходе игрока из команды (handleLeaveTeam)
# Найдем место где игрок покидает команду
old_leave_player = '''        alert("Вы покинули команду");
      }
      
      await loadData();'''

new_leave_player = '''        // Создаем уведомление для команды
        const leavingPlayerName = user?.first_name || user?.username || "Игрок";
        if (currentPlayer?.team_id) {
          await createTeamNotification(
            currentPlayer.team_id,
            'player_left',
            `${leavingPlayerName} покинул команду`,
            currentPlayer.id,
            leavingPlayerName
          );
        }
        
        alert("Вы покинули команду");
      }
      
      await loadData();'''

content = content.replace(old_leave_player, new_leave_player)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✅ Добавлена отправка уведомлений при событиях команды")
