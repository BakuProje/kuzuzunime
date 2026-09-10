-- SQL VERSI 2: MENGGUNAKAN SUPABASE AUTH & RLS POLICIES
-- Jalankan ini HANYA JIKA Anda ingin fitur Login Akun wajib (Email & Password)

-- 1. Tabel Watch History (Riwayat Nonton - User-based)
CREATE TABLE IF NOT EXISTS watch_history_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anime_id TEXT NOT NULL,
    episode_id TEXT NOT NULL,
    watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, episode_id)
);

-- 2. Tabel Watch Progress (Continue Watching - User-based)
CREATE TABLE IF NOT EXISTS watch_progress_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anime_id TEXT NOT NULL,
    episode_id TEXT NOT NULL,
    progress FLOAT NOT NULL DEFAULT 0,
    duration FLOAT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, episode_id)
);

-- 3. Tabel Episode Reactions (Like/Dislike - User-based)
CREATE TABLE IF NOT EXISTS episode_reactions_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    episode_id TEXT NOT NULL,
    reaction_type TEXT CHECK (reaction_type IN ('like', 'dislike')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, episode_id)
);

-- 4. Tabel Favorites (User-based)
CREATE TABLE IF NOT EXISTS favorites_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anime_id TEXT NOT NULL,
    anime_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, anime_id)
);

-- --- AKTIFKAN SECURITY POLICIES ---
ALTER TABLE watch_history_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_progress_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_reactions_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites_v2 ENABLE ROW LEVEL SECURITY;

-- --- POLICIES (Agar data aman & tidak tertukar antar user) ---

CREATE POLICY "Manage personal history" ON watch_history_v2 FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage personal progress" ON watch_progress_v2 FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage personal reactions" ON episode_reactions_v2 FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Manage personal favorites" ON favorites_v2 FOR ALL USING (auth.uid() = user_id);

-- Untuk viewing counts (Tetap publik)
CREATE TABLE IF NOT EXISTS view_counts (
    episode_id TEXT PRIMARY KEY,
    views INTEGER DEFAULT 0
);
