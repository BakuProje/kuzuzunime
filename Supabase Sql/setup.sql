-- SQL VERSI 1: MENGGUNAKAN UUID LOKAL (TANPA LOGIN WAJIB)
-- Gunakan ini jika Anda ingin sistem tetap bisa menyimpan data tanpa akun (berdasarkan browser)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel Watch History
CREATE TABLE IF NOT EXISTS watch_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    anime_id TEXT NOT NULL,
    episode_id TEXT NOT NULL,
    watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, episode_id)
);

-- 2. Tabel Watch Progress
CREATE TABLE IF NOT EXISTS watch_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    anime_id TEXT NOT NULL,
    episode_id TEXT NOT NULL,
    progress FLOAT NOT NULL DEFAULT 0,
    duration FLOAT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, episode_id)
);

-- 3. Tabel Episode Reactions
CREATE TABLE IF NOT EXISTS episode_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    episode_id TEXT NOT NULL,
    reaction_type TEXT CHECK (reaction_type IN ('like', 'dislike')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, episode_id)
);

-- 4. Tabel Favorites
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    anime_id TEXT NOT NULL,
    anime_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, anime_id)
);

-- 5. Tabel View Counts
CREATE TABLE IF NOT EXISTS view_counts (
    episode_id TEXT PRIMARY KEY,
    views INTEGER DEFAULT 0
);
