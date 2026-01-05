with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Исправляем поиск тренера для уведомления о заявке
old_code = '''      // Уведомляем тренера команды
      const team = teams.find(t => t.id === teamId);
      const coach = players.find(p => p.team_id === teamId && p.id === team?.coach_id);
      if (coach?.users?.telegram_id) {'''

new_code = '''      // Уведомляем тренера команды
      const team = teams.find(t => t.id === teamId);
      const coachUser = users.find(u => u.id === team?.coach_id);
      if (coachUser?.telegram_id) {'''

content = content.replace(old_code, new_code)

# Также исправляем использование в тексте уведомления
old_body = '''            body: JSON.stringify({ chat_id: coach.users.telegram_id, text: message }),'''
new_body = '''            body: JSON.stringify({ chat_id: coachUser.telegram_id, text: message }),'''

content = content.replace(old_body, new_body)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Исправлен поиск тренера для Telegram уведомлений")
