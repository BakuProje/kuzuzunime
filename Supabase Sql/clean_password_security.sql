-- ====================================================================
-- DATABASE CLEANUP & SECURITY MIGRATION: HAPUS PLAIN PASSWORD
-- Jalankan kode SQL ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Hapus kolom password_plain dari tabel profiles secara permanen
-- Ini akan langsung melenyapkan semua data plain-text password yang pernah disimpan.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_plain;

-- 2. Perbarui fungsi trigger handle_new_user agar tidak lagi menyalin password_plain
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    username, 
    email, 
    role, 
    level, 
    exp, 
    total_exp, 
    unlimited_exp
  )
  VALUES (
    new.id, 
    COALESCE(
      new.raw_user_meta_data->>'display_name', 
      new.raw_user_meta_data->>'username', 
      split_part(new.email, '@', 1)
    ), 
    new.email, 
    'User',
    1,
    0,
    0,
    false
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    username = COALESCE(EXCLUDED.username, public.profiles.username);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Pastikan trigger terhubung dengan benar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
