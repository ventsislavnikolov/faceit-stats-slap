-- 008_extended_demo_analytics.sql
-- Adds utility mastery, kill quality, economy, and side-split columns

-- Utility mastery
ALTER TABLE demo_player_analytics ADD COLUMN smokes_thrown int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN flashes_thrown int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN hes_thrown int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN molotovs_thrown int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN utility_per_round numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN avg_flash_blind_duration numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN team_flashes int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN effective_flash_rate numeric NOT NULL DEFAULT 0;

-- Kill quality
ALTER TABLE demo_player_analytics ADD COLUMN wallbang_kills int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN thrusmoke_kills int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN noscope_kills int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN avg_kill_distance numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN weapon_kills jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Economy
ALTER TABLE demo_player_analytics ADD COLUMN total_spend int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN economy_efficiency numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN weapon_rounds jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Side-split
ALTER TABLE demo_player_analytics ADD COLUMN ct_kills int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN ct_deaths int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN ct_adr numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN ct_rating numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN t_kills int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN t_deaths int NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN t_adr numeric NOT NULL DEFAULT 0;
ALTER TABLE demo_player_analytics ADD COLUMN t_rating numeric NOT NULL DEFAULT 0;

-- Round equip values
ALTER TABLE demo_round_analytics ADD COLUMN t_equip_value int NOT NULL DEFAULT 0;
ALTER TABLE demo_round_analytics ADD COLUMN ct_equip_value int NOT NULL DEFAULT 0;
