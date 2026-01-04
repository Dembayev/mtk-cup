# Исправляем отображение бейджа Тренер

with open('src/App.jsx', 'r') as f:
    content = f.read()

# Заменяем условие показа бейджа Тренер
old_badge = "                  {player.type === 'coach' && <Badge variant=\"gold\">Тренер</Badge>}"
new_badge = "                  {player.isCoach && <Badge variant=\"gold\">Тренер</Badge>}"

content = content.replace(old_badge, new_badge)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✅ Исправлен бейдж Тренер - теперь показывается для всех тренеров")
