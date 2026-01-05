# Добавляем отладку в MyTeamScreen

with open('src/screens/MyTeamScreen.jsx', 'r') as f:
    content = f.read()

# Добавляем console.log после фильтрации уведомлений
old_code = '''  const myTeamNotifications = (teamNotifications || []).filter(n => n.team_id === myTeam?.id);
  const unreadNotifications = myTeamNotifications.filter(n => !n.is_read);
  const canManageTeam = teamRelation === "coach";'''

new_code = '''  const myTeamNotifications = (teamNotifications || []).filter(n => n.team_id === myTeam?.id);
  const unreadNotifications = myTeamNotifications.filter(n => !n.is_read);
  const canManageTeam = teamRelation === "coach";
  
  console.log('🔍 MyTeam Debug:', {
    myTeam: myTeam?.id,
    myTeamName: myTeam?.name,
    teamRelation,
    canManageTeam,
    totalNotifications: teamNotifications?.length,
    myTeamNotifications: myTeamNotifications.length,
    unreadNotifications: unreadNotifications.length,
    coachTeamId: coachTeam?.id
  });'''

content = content.replace(old_code, new_code)

with open('src/screens/MyTeamScreen.jsx', 'w') as f:
    f.write(content)

print("✅ Добавлена отладка в MyTeamScreen")
