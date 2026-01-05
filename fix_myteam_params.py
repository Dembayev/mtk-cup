import re

# Читаем файл
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Находим строку с определением MyTeamScreen
old_params = r'const MyTeamScreen = \(\{ setScreen, user, teams, players, coachTeam, currentPlayer, sentOffers, onRemovePlayer, onSelectFavoriteTeam, onLeaveTeam, actionLoading, userRoles, setSelectedPlayer, teamRequests, onAcceptTeamRequest, onRejectTeamRequest, onUpdateJerseyNumber, onSetCaptain, onSendTeamMessage, onCreateTeam \}\) =>'

new_params = 'const MyTeamScreen = ({ setScreen, user, teams, players, coachTeam, currentPlayer, sentOffers, onRemovePlayer, onSelectFavoriteTeam, onLeaveTeam, actionLoading, userRoles, setSelectedPlayer, teamRequests, onAcceptTeamRequest, onRejectTeamRequest, onUpdateJerseyNumber, onSetCaptain, onSendTeamMessage, onCreateTeam, teamNotifications, onMarkNotificationRead }) =>'

content = re.sub(old_params, new_params, content)

# Записываем обратно
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Добавлены параметры teamNotifications и onMarkNotificationRead")
