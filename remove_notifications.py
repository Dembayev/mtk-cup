import re

# Читаем файл
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Удаляем useState для teamNotifications
content = re.sub(r'\s*const \[teamNotifications, setTeamNotifications\] = useState\(\[\]\);', '', content)

# 2. Удаляем функцию markNotificationAsRead
content = re.sub(
    r'\s*const markNotificationAsRead = async \(notificationId\) => \{[^}]*setTeamNotifications\([^)]*\);[^}]*\};',
    '',
    content,
    flags=re.DOTALL
)

# 3. Удаляем функцию createTeamNotification  
content = re.sub(
    r'\s*const createTeamNotification = async \([^)]*\) => \{[^}]*await supabase\.from\("team_notifications"\)[^}]*\};',
    '',
    content,
    flags=re.DOTALL
)

# 4. Удаляем загрузку teamNotifications из loadData
content = re.sub(
    r'\s*const \{ data: teamNotificationsData \} = await supabase\.from\("team_notifications"\)\.select\("\*"\)\.order\("created_at", \{ ascending: false \}\);',
    '',
    content
)

content = re.sub(
    r'\s*setTeamNotifications\(teamNotificationsData \|\| \[\]\);',
    '',
    content
)

# 5. Удаляем все вызовы createTeamNotification
content = re.sub(
    r'\s*await createTeamNotification\([^;]*\);',
    '',
    content
)

# 6. Удаляем teamNotifications и onMarkNotificationRead из пропсов MyTeamScreen
content = re.sub(
    r'teamNotifications=\{teamNotifications\} onMarkNotificationRead=\{markNotificationAsRead\} ',
    '',
    content
)

# Записываем обратно
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Удален весь код уведомлений из App.jsx")
