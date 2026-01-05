# Удаляем код уведомлений построчно

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Удаляем useState teamNotifications (строка 3806)
del lines[3805]  # индекс = номер строки - 1

# Записываем обратно
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✅ Удалена строка 3806: teamNotifications useState")
