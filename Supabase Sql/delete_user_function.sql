-- ====================================================================
-- MIGRATION SCRIPT: CREATE ADMIN DELETE USER RPC FUNCTION
-- Berjalan dengan SECURITY DEFINER agar bisa menghapus record di auth.users & public.profiles
-- Jalankan kode SQL ini di SQL Editor Supabase Anda
-- ====================================================================

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS VOID SECURITY DEFINER AS $$
BEGIN
  -- Validasi apakah pemanggil adalah admin (kuzunime@admin.com)
  IF auth.jwt() ->> 'email' = 'kuzunime@admin.com' THEN
    -- Profiles table has ON DELETE CASCADE from auth.users, but we can also manually delete it first to be clean
    DELETE FROM public.profiles WHERE id = target_user_id;
    
    -- Delete user from auth.users table (this cascades to watch_history, watch_progress, etc.)
    DELETE FROM auth.users WHERE id = target_user_id;
  ELSE
    RAISE EXCEPTION 'Akses Ditolak: Hanya Admin Zunime yang diizinkan untuk menghapus user.';
  END IF;
END;
$$ LANGUAGE plpgsql;
