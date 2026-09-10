-- ====================================================================
-- NEW DATABASE MIGRATION SCRIPT: SINKRONISASI USER KE TABEL PROFILES
-- Jalankan kode SQL ini di SQL Editor Supabase Anda untuk sinkronisasi data user.
-- ====================================================================

-- 1. FUNGSI RPC UNTUK SINKRONISASI USER DARI AUTH.USERS KE PUBLIC.PROFILES
-- Berjalan dengan SECURITY DEFINER agar bisa mengakses auth.users dari client
CREATE OR REPLACE FUNCTION sync_profiles()
RETURNS VOID SECURITY DEFINER AS $$
BEGIN
  -- Validasi apakah pemanggil adalah admin (kuzunime@admin.com)
  IF auth.jwt() ->> 'email' = 'kuzunime@admin.com' THEN
    INSERT INTO public.profiles (id, email, username, role, created_at)
    SELECT 
      id, 
      email, 
      COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)), 
      'Anime Lover',
      created_at
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;
  ELSE
    RAISE EXCEPTION 'Akses Ditolak: Hanya Admin Zunime yang diizinkan untuk sinkronisasi.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER UNTUK OTOMATISASI SIGNUP BARU KE TABEL PROFILES
-- Menghindari data kosong di masa mendatang
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role, created_at)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 
    new.email, 
    'Anime Lover',
    new.created_at
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. JALANKAN SINKRONISASI PERTAMA KALI
-- (Opsional, tapi direkomendasikan jika sudah ada user terdaftar sebelumnya)
INSERT INTO public.profiles (id, email, username, role, created_at)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)), 
  'Anime Lover',
  created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;
