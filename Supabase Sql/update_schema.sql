-- ====================================================================
-- MIGRATION SCRIPT: UPDATE SCHEMA FOR WATCH HISTORY & PROGRESS
-- Serta Kebijakan RLS & RPC Admin untuk Manajemen Profil & Password
-- Jalankan kode SQL ini di SQL Editor Supabase Anda
-- ====================================================================

-- 1. Penyesuaian Tabel `watch_progress`
-- Menambahkan kolom judul dan poster gambar anime jika belum ada untuk continue watching
ALTER TABLE watch_progress ADD COLUMN IF NOT EXISTS anime_title TEXT;
ALTER TABLE watch_progress ADD COLUMN IF NOT EXISTS anime_image TEXT;

-- 2. Restrukturisasi Tabel `watch_history`
-- Hapus tabel lama jika skemanya tidak cocok dengan model history yang baru
DROP TABLE IF EXISTS watch_history CASCADE;

CREATE TABLE watch_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anime_url TEXT NOT NULL,
    title TEXT,
    image TEXT,
    score TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, anime_url)
);

-- Aktifkan Row Level Security (RLS) agar user hanya bisa mengakses data mereka sendiri
ALTER TABLE watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

-- Buat policy baru jika belum ada (atau bersihkan dulu policy lama)
DROP POLICY IF EXISTS "Manage personal progress" ON watch_progress;
CREATE POLICY "Manage personal progress" ON watch_progress FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Manage personal history" ON watch_history;
CREATE POLICY "Manage personal history" ON watch_history FOR ALL USING (auth.uid() = user_id);


-- ====================================================================
-- 3. KEBIJAKAN RLS UNTUK TABEL `profiles`
-- Agar admin bisa membaca, mengedit, dan me-manage data user
-- ====================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Izinkan publik membaca profil dasar (untuk menampilkan avatar/username di web)
DROP POLICY IF EXISTS "Allow public read profiles" ON profiles;
CREATE POLICY "Allow public read profiles" ON profiles FOR SELECT USING (true);

-- Izinkan pengguna memperbarui data profil mereka sendiri
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;
CREATE POLICY "Allow users to update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Izinkan admin (kuzunime@admin.com) mengakses penuh data profiles
DROP POLICY IF EXISTS "Allow admin full access to profiles" ON profiles;
CREATE POLICY "Allow admin full access to profiles" ON profiles FOR ALL USING (
  auth.jwt() ->> 'email' = 'kuzunime@admin.com'
);


-- ====================================================================
-- 4. FUNGSI RPC UNTUK ADMIN MENGUBAH PASSWORD USER
-- Berjalan dengan SECURITY DEFINER agar bisa mengubah password di auth.users
-- ====================================================================
CREATE OR REPLACE FUNCTION admin_change_password(target_user_id UUID, new_password TEXT)
RETURNS VOID SECURITY DEFINER AS $$
BEGIN
  -- Validasi apakah pemanggil adalah admin (kuzunime@admin.com)
  IF auth.jwt() ->> 'email' = 'kuzunime@admin.com' THEN
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = target_user_id;
  ELSE
    RAISE EXCEPTION 'Akses Ditolak: Hanya Admin Zunime yang diizinkan untuk mengubah password user.';
  END IF;
END;
$$ LANGUAGE plpgsql;


