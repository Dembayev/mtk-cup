# Добавляем систему уведомлений для команды

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Добавляем состояние для teamNotifications
old_states = '''  const [roleRequests, setRoleRequests] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);'''

new_states = '''  const [roleRequests, setRoleRequests] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [teamNotifications, setTeamNotifications] = useState([]);'''

content = content.replace(old_states, new_states)

# 2. Добавляем загрузку уведомлений в loadData
old_load = '''      const { data: roleRequestsData } = await supabase.from("role_requests").select("*").order("created_at", { ascending: false });

      const playersWithDetails'''

new_load = '''      const { data: roleRequestsData } = await supabase.from("role_requests").select("*").order("created_at", { ascending: false });
      const { data: teamNotificationsData } = await supabase.from("team_notifications").select("*").order("created_at", { ascending: false });

      const playersWithDetails'''

content = content.replace(old_load, new_load)

# 3. Добавляем установку teamNotifications
old_set = '''      setPlayerStats(playerStatsData || []);
      setRoleRequests(roleRequestsData || []);
    } catch (error) {'''

new_set = '''      setPlayerStats(playerStatsData || []);
      setRoleRequests(roleRequestsData || []);
      setTeamNotifications(teamNotificationsData || []);
    } catch (error) {'''

content = content.replace(old_set, new_set)

# 4. Добавляем функцию создания уведомления
helper_functions = '''  const createTeamNotification = async (teamId, type, message, playerId = null, playerName = null) => {
    try {
      await supabase.from("team_notifications").insert({
        team_id: teamId,
        type,
        message,
        player_id: playerId,
        player_name: playerName,
        is_read: false
      });
    } catch (error) {
      console.error("Error creating team notification:", error);
    }
  };

  const loadData = async () => {'''

content = content.replace('  const loadData = async () => {', helper_functions)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("✅ Добавлено состояние и загрузка teamNotifications")
