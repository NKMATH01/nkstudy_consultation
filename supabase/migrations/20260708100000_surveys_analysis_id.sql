ALTER TABLE surveys ADD COLUMN IF NOT EXISTS analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_surveys_analysis_id ON surveys(analysis_id);
