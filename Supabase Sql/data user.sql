-- 1. Buat Tabel Profile untuk menyimpan data Role
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username text,
  email text,
  role text DEFAULT 'Anime Lover' CHECK (role IN ('Anime Lover', 'Wibu', 'Otaku')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Aktifkan Keamanan (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. IZIN KHUSUS: Admin (kuzunime@admin.com) bisa melihat & edit SEMUA data
CREATE POLICY "Admin Full Access" 
ON public.profiles 
FOR ALL 
USING (auth.jwt() ->> 'email' = 'kuzunime@admin.com');

-- 4. IZIN UMUM: User biasa hanya bisa lihat profil mereka sendiri
CREATE POLICY "User View Own" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- 5. TRIGGER OTOMATIS: Setiap ada yang daftar (Signup), data masuk ke tabel Profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (new.id, new.raw_user_meta_data->>'display_name', new.email, 'Anime Lover');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang Trigger nya
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. SYNC DATA (Opsional): Jika sudah ada user yang daftar sebelumnya, jalankan ini:
INSERT INTO public.profiles (id, email, username, role)
SELECT id, email, raw_user_meta_data->>'display_name', 'Anime Lover'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
