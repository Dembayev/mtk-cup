import re

# Читаем файл
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Добавляем фильтрацию уведомлений и canManageTeam после pendingTeamRequests
old_code = '''  const pendingSentOffers = (sentOffers || []).filter(o => o.status === "pending");
  const pendingTeamRequests = (teamRequests || []).filter(r => r.team_id === myTeam?.id && r.status === "pending");

  // Для создания команды (тренер без команды)'''

new_code = '''  const pendingSentOffers = (sentOffers || []).filter(o => o.status === "pending");
  const pendingTeamRequests = (teamRequests || []).filter(r => r.team_id === myTeam?.id && r.status === "pending");
  const myTeamNotifications = (teamNotifications || []).filter(n => n.team_id === myTeam?.id);
  const unreadNotifications = myTeamNotifications.filter(n => !n.is_read);
  const canManageTeam = teamRelation === "coach";

  console.log('🔍 MyTeamScreen Debug:', {
    myTeam: myTeam?.id,
    myTeamName: myTeam?.name,
    teamRelation,
    canManageTeam,
    totalNotifications: teamNotifications?.length,
    myTeamNotifications: myTeamNotifications.length,
    unreadNotifications: unreadNotifications.length
  });

  // Для создания команды (тренер без команды)'''

content = content.replace(old_code, new_code)

# Записываем обратно
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Добавлена фильтрация уведомлений и отладка")
