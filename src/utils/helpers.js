export const getUserRoles = (user, players, teams, roleRequests = []) => {
  if (!user) return { isGuest: true, isFan: false, isPlayer: false, isCaptain: false, isCoach: false, isAdmin: false, roles: [] };
  
  const isAdmin = user.role === "admin";
  const playerRecord = players?.find(p => p.user_id === user.id);
  const isPlayer = !!playerRecord;
  const isCaptain = playerRecord?.is_captain === true;
  
  const isCoachByTeam = teams?.some(t => t.coach_id === user.id) || false;
  const isCoachByRequest = roleRequests?.some(r => r.user_id === user.id && r.requested_role === "coach" && r.status === "approved") || false;
  const isCoach = isCoachByTeam || isCoachByRequest;
  
  const isFan = !isPlayer && !isCoach && !isAdmin;
  
  const roles = [];
  if (isAdmin) roles.push("admin");
  if (isCoach) roles.push("coach");
  if (isCaptain) roles.push("captain");
  if (isPlayer) roles.push("player");
  if (isFan) roles.push("fan");
  
  return { isGuest: false, isFan, isPlayer, isCaptain, isCoach, isAdmin, roles, playerRecord };
};

export const getDisplayName = (user) => {
  if (user?.first_name) return user.first_name;
  if (user?.username) return `@${user.username}`;
  return "Гость";
};
