-- Создаем таблицу для уведомлений команды
CREATE TABLE IF NOT EXISTS team_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'team_request', 'player_accepted', 'player_left'
  message TEXT NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  player_name TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Включаем RLS
ALTER TABLE team_notifications ENABLE ROW LEVEL SECURITY;

-- Политика: тренеры команды могут видеть уведомления своей команды
CREATE POLICY "Coaches can view team notifications"
  ON team_notifications
  FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM teams WHERE coach_id = auth.uid()
    )
  );

-- Политика: все могут создавать уведомления
CREATE POLICY "Anyone can create team notifications"
  ON team_notifications
  FOR INSERT
  WITH CHECK (true);

-- Политика: тренеры могут обновлять уведомления своей команды
CREATE POLICY "Coaches can update team notifications"
  ON team_notifications
  FOR UPDATE
  USING (
    team_id IN (
      SELECT id FROM teams WHERE coach_id = auth.uid()
    )
  );

-- Индекс для быстрого поиска
CREATE INDEX idx_team_notifications_team_id ON team_notifications(team_id);
CREATE INDEX idx_team_notifications_created_at ON team_notifications(created_at DESC);
