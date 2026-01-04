# Исправляем чтобы игроки-тренеры показывались в фильтре "Тренеры"

with open('src/App.jsx', 'r') as f:
    content = f.read()

# Заменяем логику добавления тренеров
old_code = '''  // Добавляем тренеров которых нет в списке игроков
  (teams || []).forEach(team => {
    if (team.coach_id) {
      // Проверяем есть ли уже этот человек как игрок
      const existingPlayer = allPeople.find(p => p.user_id === team.coach_id);
      if (!existingPlayer) {
        // Находим данные тренера в users
        const coachUser = (users || []).find(u => u.id === team.coach_id);
        if (coachUser) {
          // Создаем запись для тренера
          allPeople.push({
            id: `coach_${team.coach_id}`,
            user_id: team.coach_id,
            users: coachUser,
            team_id: team.id,
            teams: team,
            is_free_agent: false,
            positions: [],
            totalPoints: 0,
            type: 'coach',
            sortName: coachUser.first_name || coachUser.username || ''
          });
        }
      }
    }
  });'''

new_code = '''  // Добавляем тренеров и помечаем игроков-тренеров
  (teams || []).forEach(team => {
    if (team.coach_id) {
      // Проверяем есть ли уже этот человек как игрок
      const existingPlayer = allPeople.find(p => p.user_id === team.coach_id);
      if (existingPlayer) {
        // Если это игрок - помечаем что он также тренер
        existingPlayer.isCoach = true;
        existingPlayer.coachTeamId = team.id;
      } else {
        // Находим данные тренера в users
        const coachUser = (users || []).find(u => u.id === team.coach_id);
        if (coachUser) {
          // Создаем запись для тренера
          allPeople.push({
            id: `coach_${team.coach_id}`,
            user_id: team.coach_id,
            users: coachUser,
            team_id: team.id,
            teams: team,
            is_free_agent: false,
            positions: [],
            totalPoints: 0,
            type: 'coach',
            isCoach: true,
            sortName: coachUser.first_name || coachUser.username || ''
          });
        }
      }
    }
  });'''

content = content.replace(old_code, new_code)

# Заменяем фильтр тренеров
old_filter = '    if (filter === "coach" && p.type !== \'coach\') return false;'
new_filter = '    if (filter === "coach" && !p.isCoach) return false;'

content = content.replace(old_filter, new_filter)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✅ Исправлено - игроки-тренеры теперь показываются в фильтре Тренеры")
