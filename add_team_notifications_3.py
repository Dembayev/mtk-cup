# Добавляем передачу teamNotifications в MyTeamScreen и функцию пометки как прочитанных

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Добавляем функцию пометки уведомления как прочитанного
mark_read_function = '''  const markNotificationAsRead = async (notificationId) => {
    try {
      await supabase.from("team_notifications").update({ is_read: true }).eq("id", notificationId);
      setTeamNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const createTeamNotification = async (teamId, type, message, playerId = null, playerName = null) => {'''

content = content.replace(
    '  const createTeamNotification = async (teamId, type, message, playerId = null, playerName = null) => {',
    mark_read_function
)

# 2. Добавляем передачу teamNotifications в MyTeamScreen
old_myteam = '''case "myteam": return <MyTeamScreen setScreen={setScreen} user={user} teams={teams} players={players} coachTeam={coachTeam} currentPlayer={currentPlayer} sentOffers={sentOffers} onRemovePlayer={handleRemovePlayer} onSelectFavoriteTeam={handleSelectFavoriteTeam} onLeaveTeam={handleLeaveTeam} actionLoading={actionLoading} userRoles={userRoles} setSelectedPlayer={setSelectedPlayer} teamRequests={teamRequests} onAcceptTeamRequest={handleAcceptTeamRequest} onRejectTeamRequest={handleRejectTeamRequest} onUpdateJerseyNumber={handleUpdateJerseyNumber} onSetCaptain={handleSetCaptain} onSendTeamMessage={handleSendTeamMessage} onCreateTeam={handleCreateTeamAdmin} />;'''

new_myteam = '''case "myteam": return <MyTeamScreen setScreen={setScreen} user={user} teams={teams} players={players} coachTeam={coachTeam} currentPlayer={currentPlayer} sentOffers={sentOffers} onRemovePlayer={handleRemovePlayer} onSelectFavoriteTeam={handleSelectFavoriteTeam} onLeaveTeam={handleLeaveTeam} actionLoading={actionLoading} userRoles={userRoles} setSelectedPlayer={setSelectedPlayer} teamRequests={teamRequests} onAcceptTeamRequest={handleAcceptTeamRequest} onRejectTeamRequest={handleRejectTeamRequest} onUpdateJerseyNumber={handleUpdateJerseyNumber} onSetCaptain={handleSetCaptain} onSendTeamMessage={handleSendTeamMessage} onCreateTeam={handleCreateTeamAdmin} teamNotifications={teamNotifications} onMarkNotificationRead={markNotificationAsRead} />;'''

content = content.replace(old_myteam, new_myteam)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✅ Добавлена передача teamNotifications в MyTeamScreen")
