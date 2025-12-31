// Get display name for user
export const getDisplayName = (user) => {
  if (!user) return "Гость";
  if (user.first_name) return `${user.first_name} ${user.last_name || ""}`.trim();
  if (user.username) return `@${user.username}`;
  return "Пользователь";
};

// Get user roles based on data
export const getUserRoles = (user, players, teams) => {
  if (!user) return { isGuest: true, isFan: false, isPlayer: false, isCaptain: false, isCoach: false, isAdmin: false, roles: [] };
  
  const isAdmin = user.role === "admin";
  const playerRecord = players.find(p => p.user_id === user.id);
  const isPlayer = !!playerRecord;
  const isCaptain = playerRecord?.is_captain || false;
  const isCoach = teams.some(t => t.coach_id === user.id);
  const isFan = !isPlayer && !isCoach && !isAdmin;
  
  const roles = [];
  if (isAdmin) roles.push("admin");
  if (isCoach) roles.push("coach");
  if (isCaptain) roles.push("captain");
  if (isPlayer) roles.push("player");
  if (isFan) roles.push("fan");
  
  return { isGuest: false, isFan, isPlayer, isCaptain, isCoach, isAdmin, roles, playerRecord };
};

// Calculate player efficiency
export const calculateEfficiency = (stats) => {
  if (!stats || stats.length === 0) return 0;
  
  let totalPositive = 0;
  let totalNegative = 0;
  
  stats.forEach(stat => {
    totalPositive += (stat.aces || 0) + (stat.attack_points || 0) + (stat.block_points || 0);
    totalNegative += (stat.serve_errors || 0) + (stat.receive_errors || 0) + (stat.attack_errors || 0) + (stat.block_errors || 0);
  });
  
  return totalPositive - totalNegative;
};
