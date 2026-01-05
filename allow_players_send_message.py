with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Изменяем условие показа формы сообщения - показываем не только тренерам, но и игрокам/капитанам
old_condition = '''          {/* Team Message (for coach) */}
          {canManageTeam && (
            <Card style={{ marginTop: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>📢 СООБЩЕНИЕ КОМАНДЕ</h3>'''

new_condition = '''          {/* Team Message (for coach, players, captains) */}
          {(canManageTeam || teamRelation === "player" || teamRelation === "captain") && (
            <Card style={{ marginTop: "20px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: colors.goldDark, marginBottom: "12px" }}>📢 СООБЩЕНИЕ КОМАНДЕ</h3>'''

content = content.replace(old_condition, new_condition)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Форма сообщения теперь доступна игрокам и капитанам")
