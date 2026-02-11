-- 1. Создаём таблицу турниров
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'men',
  season TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Добавляем tournament_id и name в tours
ALTER TABLE tours ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id);
ALTER TABLE tours ADD COLUMN IF NOT EXISTS name TEXT;

-- 3. Добавляем tournament_id в teams  
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id);

-- 4. Создаём турнир по умолчанию
INSERT INTO tournaments (name, category, season, is_active) 
VALUES ('Кубок МТК', 'men', '2025/2026', true);

-- 5. Привязываем существующие данные
UPDATE tours SET tournament_id = (SELECT id FROM tournaments WHERE name = 'Кубок МТК' LIMIT 1);
UPDATE teams SET tournament_id = (SELECT id FROM tournaments WHERE name = 'Кубок МТК' LIMIT 1);

-- 6. RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments viewable by everyone" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Tournaments editable by admins" ON tournaments FOR ALL USING (true);
