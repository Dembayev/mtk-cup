import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useData() {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tours, setTours] = useState([]);
  const [players, setPlayers] = useState([]);
  const [users, setUsers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [teamRequests, setTeamRequests] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [roleRequests, setRoleRequests] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [predictions, setPredictions] = useState([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [
        { data: teamsData },
        { data: toursData },
        { data: matchesData },
        { data: playersData },
        { data: usersData },
        { data: offersData },
        { data: teamRequestsData },
        { data: playerStatsData },
        { data: roleRequestsData },
        { data: sponsorsData },
        { data: prizesData },
        { data: predictionsData }
      ] = await Promise.all([
        supabase.from("teams").select("*, coaches:coach_id(id, first_name, last_name, username, avatar_url)").order("points", { ascending: false }),
        supabase.from("tours").select("*").order("number"),
        supabase.from("matches").select("*").order("scheduled_time"),
        supabase.from("players").select("*"),
        supabase.from("users").select("*"),
        supabase.from("offers").select("*").order("created_at", { ascending: false }),
        supabase.from("team_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("match_player_stats").select("*"),
        supabase.from("role_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("sponsors").select("*").order("created_at", { ascending: false }),
        supabase.from("prizes").select("*").order("created_at", { ascending: false }),
        supabase.from("predictions").select("*").order("created_at", { ascending: false })
      ]);

      // Добавляем связанные данные к игрокам
      const playersWithDetails = (playersData || []).map(player => ({
        ...player,
        users: usersData?.find(u => u.id === player.user_id) || null,
        teams: teamsData?.find(t => t.id === player.team_id) || null,
      }));

      setTeams(teamsData || []);
      setTours(toursData || []);
      setMatches(matchesData || []);
      setPlayers(playersWithDetails);
      setOffers(offersData || []);
      setTeamRequests(teamRequestsData || []);
      setUsers(usersData || []);
      setPlayerStats(playerStatsData || []);
      setRoleRequests(roleRequestsData || []);
      setSponsors(sponsorsData || []);
      setPrizes(prizesData || []);
      setPredictions(predictionsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    teams,
    matches,
    tours,
    players,
    users,
    offers,
    teamRequests,
    playerStats,
    roleRequests,
    sponsors,
    prizes,
    predictions,
    loadData,
    setTeams,
    setMatches,
    setPlayers,
    setOffers,
    setTeamRequests,
    setUsers,
    setPlayerStats,
    setRoleRequests,
    setSponsors,
    setPrizes,
    setPredictions
  };
}
