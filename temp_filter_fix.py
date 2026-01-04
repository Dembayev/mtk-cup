#!/usr/bin/env python3
import re

# Читаем файл
with open('mtk-cup/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Находим и заменяем логику фильтрации
old_filter_logic = '''  const filteredPlayers = allPeople.filter(p => {
    if (filter === "free" && !p.is_free_agent) return false;
    if (filter === "team" && p.is_free_agent) return false;
    if (positionFilter !== "all" && !p.positions?.includes(positionFilter)) return false;'''

new_filter_logic = '''  const filteredPlayers = allPeople.filter(p => {
    if (filter === "free" && !p.is_free_agent) return false;
    if (filter === "team" && (p.is_free_agent || p.type === 'coach')) return false;
    if (filter === "coach" && p.type !== 'coach') return false;
    if (positionFilter !== "all" && !p.positions?.includes(positionFilter)) return false;'''

content = content.replace(old_filter_logic, new_filter_logic)

# Находим и заменяем кнопки фильтров
old_filter_buttons = '''          {[{ id: "all", label: "Все" }, { id: "free", label: "Свободные" }, { id: "team", label: "В команде" }].map(tab => ('''

new_filter_buttons = '''          {[{ id: "all", label: "Все" }, { id: "free", label: "Свободные" }, { id: "team", label: "В команде" }, { id: "coach", label: "Тренеры" }].map(tab => ('''

content = content.replace(old_filter_buttons, new_filter_buttons)

# Записываем обратно
with open('mtk-cup/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Добавлен фильтр 'Тренеры' в список игроков!")
