CREATE TABLE IF NOT EXISTS location_history (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy REAL,
  battery_level REAL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_history_phone ON location_history(phone);
CREATE INDEX IF NOT EXISTS idx_location_history_recorded_at ON location_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_location_history_phone_time ON location_history(phone, recorded_at DESC);

ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon insert location" ON location_history;
DROP POLICY IF EXISTS "anon read location" ON location_history;

CREATE POLICY "enable insert for anon" ON location_history FOR INSERT WITH CHECK (true);
CREATE POLICY "enable select for anon" ON location_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "enable delete for anon" ON location_history;
CREATE POLICY "enable delete for anon" ON location_history FOR DELETE USING (true);

-- Stored procedure to delete by IDs (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION delete_location_history(ids bigint[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cnt int;
BEGIN
  DELETE FROM location_history WHERE id = ANY(ids);
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;
