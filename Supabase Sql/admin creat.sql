-- 1. Pastikan tabel Profile tersedia
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username text,
  email text,
  role text DEFAULT 'Anime Lover' CHECK (role IN ('Anime Lover', 'Wibu', 'Otaku')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Bersihkan Policy lama agar tidak error "Already Exists"
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow all for admin email" ON public.profiles;
DROP POLICY IF EXISTS "Admin Full Access" ON public.profiles;

-- 3. Aktifkan Keamanan & Buat Policy Baru
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin Full Access" ON public.profiles FOR ALL USING (auth.jwt() ->> 'email' = 'kuzunime@admin.com');

-- 4. Setup Trigger untuk Otomatisasi
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (new.id, new.raw_user_meta_data->>'display_name', new.email, 'Anime Lover');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Sinkronisasi Data (Agar user yang sudah ada muncul di daftar)
INSERT INTO public.profiles (id, email, username, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'display_name', 'User Baru'), 'Anime Lover'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
