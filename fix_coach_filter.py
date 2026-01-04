# Исправляем фильтр амплуа чтобы он не применялся к тренерам

with open('src/App.jsx', 'r') as f:
    content = f.read()

# Старая строка
old_line = '    if (positionFilter !== "all" && !p.positions?.includes(positionFilter)) return false;'

# Новая строка - не применяем фильтр амплуа к тренерам
new_line = '    if (positionFilter !== "all" && p.type !== \'coach\' && !p.positions?.includes(positionFilter)) return false;'

content = content.replace(old_line, new_line)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✅ Исправлен фильтр амплуа - теперь тренеры не скрываются")
