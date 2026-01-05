# Добавляем console.log для отладки уведомлений

with open('src/App.jsx', 'r') as f:
    content = f.read()

# Добавляем лог после загрузки
old_set = '''      setTeamNotifications(teamNotificationsData || []);
    } catch (error) {'''

new_set = '''      setTeamNotifications(teamNotificationsData || []);
      console.log('📬 Team Notifications loaded:', teamNotificationsData?.length || 0, teamNotificationsData);
    } catch (error) {'''

content = content.replace(old_set, new_set)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✅ Добавлен console.log для отладки")
