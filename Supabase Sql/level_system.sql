-- ====================================================================
-- MIGRATION SCRIPT: NEW LEVEL & ROLE SYSTEM FOR ZUNIME
-- Menambahkan sistem level, membersihkan role lama, dan merombak role baru
-- Jalankan seluruh kode SQL ini di SQL Editor Supabase Anda
-- ====================================================================

-- 1. Tambahkan kolom pendukung sistem level & EXP jika belum ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS exp INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_exp BIGINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unlimited_exp BOOLEAN DEFAULT false;

-- 2. Ubah/Update data role lama ('Anime Lover', 'Wibu', 'Otaku') menjadi 'User'
UPDATE public.profiles
SET role = 'User'
WHERE role IS NULL OR role IN ('Anime Lover', 'Wibu', 'Otaku');

-- 3. Ubah default value kolom role menjadi 'User'
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'User';

-- 4. Hapus check constraint lama pada kolom role jika ada
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check1;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check2;

-- 5. Tambahkan check constraint baru yang HANYA mengizinkan 'User', 'Admin', 'Teman', 'Dewa'
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('User', 'Admin', 'Teman', 'Dewa'));

-- 6. Perbarui fungsi trigger handle_new_user agar menyisipkan role 'User' secara default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role, level, exp, total_exp, unlimited_exp)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
    new.email, 
    'User',
    1,
    0,
    0,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pastikan trigger on_auth_user_created terpasang dengan fungsi yang baru diperbarui
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Buat fungsi RPC untuk menghitung Peringkat Global (Rank Global) pengguna
CREATE OR REPLACE FUNCTION get_user_rank(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    user_unlimited BOOLEAN;
    user_created TIMESTAMP WITH TIME ZONE;
    user_total_exp BIGINT;
    user_rank INTEGER;
    user_role TEXT;
BEGIN
    -- Ambil info user target
    SELECT unlimited_exp, created_at, total_exp, role INTO user_unlimited, user_created, user_total_exp, user_role
    FROM public.profiles
    WHERE id = target_user_id;

    -- Role Teman dan Dewa selalu dianggap memiliki unlimited EXP
    IF user_unlimited OR user_role IN ('Teman', 'Dewa') THEN
        -- Jika unlimited, dihitung peringkatnya di antara sesama unlimited berdasarkan created_at
        SELECT COUNT(*) + 1 INTO user_rank
        FROM public.profiles
        WHERE (unlimited_exp = true OR role IN ('Teman', 'Dewa'))
          AND created_at < user_created;
    ELSE
        -- Jika biasa, dihitung setelah semua unlimited, ditambah yang memiliki total_exp lebih besar
        SELECT COUNT(*) + 1 INTO user_rank
        FROM public.profiles
        WHERE 
          -- Semua user unlimited berada di atas user biasa
          (unlimited_exp = true OR role IN ('Teman', 'Dewa'))
          -- Atau user biasa dengan total_exp lebih tinggi
          OR (
            (unlimited_exp = false AND role NOT IN ('Teman', 'Dewa'))
            AND (
              total_exp > user_total_exp
              OR (total_exp = user_total_exp AND created_at < user_created)
            )
          );
    END IF;

    RETURN user_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
