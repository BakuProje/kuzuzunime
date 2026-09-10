-- ====================================================================
-- MIGRATION SCRIPT: UPDATE TRIGGER TO SYNC PLAIN PASSWORD FROM METADATA
-- Jalankan kode SQL ini di SQL Editor Supabase Anda
-- ====================================================================

-- 1. Tambahkan kolom password_plain ke public.profiles jika belum ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_plain TEXT;

-- 2. Perbarui fungsi trigger untuk menyalin password_plain dari metadata user
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
    unlimited_exp, 
    password_plain
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
    false,
    new.raw_user_meta_data->>'password_plain'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    password_plain = EXCLUDED.password_plain,
    username = COALESCE(EXCLUDED.username, public.profiles.username);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Hubungkan ulang trigger ke auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
