-- ====================================================================
-- SUPABASE SQL DATABASE SETUP: WATCH PROGRESS, REALTIME & USER SCHEMAS
-- ZUNIME PREMIUM VIDEO SYNC & REALTIME SYSTEM
-- 
-- Petunjuk:
-- 1. Salin seluruh isi file SQL ini.
-- 2. Buka Dashboard Supabase Anda (https://supabase.com).
-- 3. Masuk ke menu "SQL Editor" di bilah kiri.
-- 4. Klik "+ New query" untuk membuat query baru.
-- 5. Tempel (paste) kode SQL ini, lalu klik tombol "Run" di kanan bawah.
-- ====================================================================

-- Pastikan extension UUID-OSSP aktif untuk menghasilkan ID unik otomatis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABEL UTAMA: watch_progress (Continue Watching)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.watch_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anime_id TEXT NOT NULL,
    episode_id TEXT NOT NULL,
    anime_title TEXT DEFAULT 'Anime',
    anime_image TEXT DEFAULT '/Zunime.png',
    progress FLOAT NOT NULL DEFAULT 0,
    duration FLOAT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pastikan semua kolom yang diperlukan ada (antisipasi jika tabel sudah pernah dibuat sebelumnya)
ALTER TABLE public.watch_progress ADD COLUMN IF NOT EXISTS anime_title TEXT DEFAULT 'Anime';
ALTER TABLE public.watch_progress ADD COLUMN IF NOT EXISTS anime_image TEXT DEFAULT '/Zunime.png';
ALTER TABLE public.watch_progress ADD COLUMN IF NOT EXISTS progress FLOAT DEFAULT 0;
ALTER TABLE public.watch_progress ADD COLUMN IF NOT EXISTS duration FLOAT DEFAULT 0;

-- Hapus constraint lama jika ada dan buat UNIQUE constraint yang bersih pada (user_id, episode_id)
-- Ini SANGAT PENTING agar query UPSERT (onConflict) berjalan lancar dan tidak menduplikasi baris!
ALTER TABLE public.watch_progress DROP CONSTRAINT IF EXISTS watch_progress_user_id_episode_id_key;
ALTER TABLE public.watch_progress DROP CONSTRAINT IF EXISTS watch_progress_user_episode_unique;
ALTER TABLE public.watch_progress ADD CONSTRAINT watch_progress_user_episode_unique UNIQUE (user_id, episode_id);


-- ==========================================
-- 2. TABEL PENDUKUNG: watch_history (Riwayat Nonton Lengkap)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anime_url TEXT NOT NULL,
    title TEXT,
    image TEXT,
    score TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tambahkan UNIQUE constraint untuk watch_history agar history ter-update saat ditonton ulang
ALTER TABLE public.watch_history DROP CONSTRAINT IF EXISTS watch_history_user_anime_unique;
ALTER TABLE public.watch_history ADD CONSTRAINT watch_history_user_anime_unique UNIQUE (user_id, anime_url);


-- ==========================================
-- 3. TABEL PENDUKUNG: favorites (Daftar Favorit/Bookmark)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anime_id TEXT NOT NULL,
    anime_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_user_anime_unique;
ALTER TABLE public.favorites ADD CONSTRAINT favorites_user_anime_unique UNIQUE (user_id, anime_id);


-- ==========================================
-- 4. TABEL PENDUKUNG: view_counts (Total Penonton Episode)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.view_counts (
    episode_id TEXT PRIMARY KEY,
    views INTEGER DEFAULT 0
);


-- ==========================================
-- 5. TABEL PROFIL PENGGUNA: profiles (Metadata Tambahan User)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  email TEXT,
  role TEXT DEFAULT 'User' CHECK (role IN ('User', 'Admin', 'Teman', 'Dewa')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Trigger otomatis untuk membuat data profil saat pengguna baru mendaftar (Signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
    new.email, 
    'User'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sinkronisasi user yang sudah ada sebelumnya ke tabel profiles
INSERT INTO public.profiles (id, email, username, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'username', split_part(email, '@', 1)), 'User'
FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- ====================================================================
-- 6. KEAMANAN DATA: ROW LEVEL SECURITY (RLS) POLICIES
--    Memastikan data pengguna aman dan tidak saling tertukar!
-- ====================================================================

-- Aktifkan RLS di semua tabel
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Kebijakan untuk `watch_progress` (User hanya bisa CRUD data miliknya sendiri)
DROP POLICY IF EXISTS "Manage personal progress" ON public.watch_progress;
DROP POLICY IF EXISTS "Users can manage their own watch progress" ON public.watch_progress;
CREATE POLICY "Users can manage their own watch progress" 
ON public.watch_progress 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Kebijakan untuk `watch_history` (User hanya bisa CRUD data miliknya sendiri)
DROP POLICY IF EXISTS "Manage personal history" ON public.watch_history;
DROP POLICY IF EXISTS "Users can manage their own watch history" ON public.watch_history;
CREATE POLICY "Users can manage their own watch history" 
ON public.watch_history 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Kebijakan untuk `favorites` (User hanya bisa CRUD data miliknya sendiri)
DROP POLICY IF EXISTS "Manage personal favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.favorites;
CREATE POLICY "Users can manage their own favorites" 
ON public.favorites 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Kebijakan untuk `profiles` (Publik bisa melihat info username, tapi hanya pemilik yang bisa update)
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Kebijakan untuk Admin (kuzunime@admin.com) memiliki hak akses penuh ke profil
DROP POLICY IF EXISTS "Allow admin full access to profiles" ON public.profiles;
CREATE POLICY "Allow admin full access to profiles" ON public.profiles FOR ALL USING (
  auth.jwt() ->> 'email' = 'kuzunime@admin.com'
);


-- ====================================================================
-- 7. AKTIFKAN SUPABASE REALTIME (Sinkronisasi Antar Browser Secara Instan)
-- ====================================================================

-- Pastikan replika identitas penuh diaktifkan agar data lama dan baru dikirim saat update
ALTER TABLE public.watch_progress REPLICA IDENTITY FULL;

-- Daftarkan tabel watch_progress ke dalam publikasi realtime Supabase secara aman
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND n.nspname = 'public' 
      AND c.relname = 'watch_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_progress;
  END IF;
END;
$$;
