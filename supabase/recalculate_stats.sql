-- Скрипт для пересчета статистики команд по итальянской системе
-- Выполнить в Supabase SQL Editor

-- Шаг 1: Сбросить статистику всех команд
UPDATE teams
SET 
  games_played = 0,
  wins = 0,
  losses = 0,
  sets_won = 0,
  sets_lost = 0,
  points = 0,
  balls_won = 0,
  balls_lost = 0;

-- Шаг 2: Пересчитать статистику для каждой команды на основе завершенных матчей
-- Для команды 1 (team1_id)
WITH match_stats AS (
  SELECT 
    team1_id as team_id,
    COUNT(*) as games,
    SUM(CASE WHEN sets_team1 > sets_team2 THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN sets_team1 < sets_team2 THEN 1 ELSE 0 END) as losses,
    SUM(sets_team1) as sets_won,
    SUM(sets_team2) as sets_lost,
    -- Итальянская система очков
    SUM(
      CASE 
        -- Победа 3:0 или 3:1
        WHEN sets_team1 = 3 AND (sets_team2 = 0 OR sets_team2 = 1) THEN 3
        -- Победа 3:2
        WHEN sets_team1 = 3 AND sets_team2 = 2 THEN 2
        -- Поражение 2:3
        WHEN sets_team2 = 3 AND sets_team1 = 2 THEN 1
        -- Поражение 0:3 или 1:3
        ELSE 0
      END
    ) as points,
    SUM(COALESCE(set1_team1, 0) + COALESCE(set2_team1, 0) + COALESCE(set3_team1, 0) + COALESCE(set4_team1, 0) + COALESCE(set5_team1, 0)) as balls_won,
    SUM(COALESCE(set1_team2, 0) + COALESCE(set2_team2, 0) + COALESCE(set3_team2, 0) + COALESCE(set4_team2, 0) + COALESCE(set5_team2, 0)) as balls_lost
  FROM matches
  WHERE status = 'finished'
  GROUP BY team1_id
  
  UNION ALL
  
  -- Для команды 2 (team2_id)
  SELECT 
    team2_id as team_id,
    COUNT(*) as games,
    SUM(CASE WHEN sets_team2 > sets_team1 THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN sets_team2 < sets_team1 THEN 1 ELSE 0 END) as losses,
    SUM(sets_team2) as sets_won,
    SUM(sets_team1) as sets_lost,
    -- Итальянская система очков
    SUM(
      CASE 
        -- Победа 3:0 или 3:1
        WHEN sets_team2 = 3 AND (sets_team1 = 0 OR sets_team1 = 1) THEN 3
        -- Победа 3:2
        WHEN sets_team2 = 3 AND sets_team1 = 2 THEN 2
        -- Поражение 2:3
        WHEN sets_team1 = 3 AND sets_team2 = 2 THEN 1
        -- Поражение 0:3 или 1:3
        ELSE 0
      END
    ) as points,
    SUM(COALESCE(set1_team2, 0) + COALESCE(set2_team2, 0) + COALESCE(set3_team2, 0) + COALESCE(set4_team2, 0) + COALESCE(set5_team2, 0)) as balls_won,
    SUM(COALESCE(set1_team1, 0) + COALESCE(set2_team1, 0) + COALESCE(set3_team1, 0) + COALESCE(set4_team1, 0) + COALESCE(set5_team1, 0)) as balls_lost
  FROM matches
  WHERE status = 'finished'
  GROUP BY team2_id
)
UPDATE teams
SET 
  games_played = agg.total_games,
  wins = agg.total_wins,
  losses = agg.total_losses,
  sets_won = agg.total_sets_won,
  sets_lost = agg.total_sets_lost,
  points = agg.total_points,
  balls_won = agg.total_balls_won,
  balls_lost = agg.total_balls_lost
FROM (
  SELECT 
    team_id,
    SUM(games) as total_games,
    SUM(wins) as total_wins,
    SUM(losses) as total_losses,
    SUM(sets_won) as total_sets_won,
    SUM(sets_lost) as total_sets_lost,
    SUM(points) as total_points,
    SUM(balls_won) as total_balls_won,
    SUM(balls_lost) as total_balls_lost
  FROM match_stats
  GROUP BY team_id
) agg
WHERE teams.id = agg.team_id;

-- Готово! Статистика пересчитана по итальянской системе
