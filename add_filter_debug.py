# Добавляем лог прямо в фильтрацию уведомлений

with open('src/screens/MyTeamScreen.jsx', 'r') as f:
    content = f.read()

# Добавляем детальный лог
old_filter = '''  const myTeamNotifications = (teamNotifications || []).filter(n => n.team_id === myTeam?.id);'''

new_filter = '''  console.log('🔍 Filtering notifications:', {
    teamNotifications: teamNotifications?.length,
    myTeamId: myTeam?.id,
    allTeamIds: (teamNotifications || []).map(n => n.team_id)
  });
  const myTeamNotifications = (teamNotifications || []).filter(n => {
    console.log('Checking notification:', n.team_id, 'vs', myTeam?.id, '=', n.team_id === myTeam?.id);
    return n.team_id === myTeam?.id;
  });'''

content = content.replace(old_filter, new_filter)

with open('src/screens/MyTeamScreen.jsx', 'w') as f:
    f.write(content)

print("✅ Добавлен детальный лог фильтрации")
