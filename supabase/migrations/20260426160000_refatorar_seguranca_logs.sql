-- Refatoração da política de segurança de logs de login
-- Remove a política baseada em UUID hardcoded e usa a função is_admin_user()

DROP POLICY IF EXISTS "Admin can view all login logs" ON public.login_logs;

CREATE POLICY "Admin can view all login logs" 
ON public.login_logs FOR SELECT 
USING (public.is_admin_user() OR auth.jwt() ->> 'role' = 'admin');

-- Garante que is_admin_user() esteja sempre atualizada
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT 
        COALESCE(auth.jwt() ->> 'email', '') = 'dop.jr82@gmail.com' OR 
        COALESCE(auth.jwt() ->> 'role', '') = 'admin';
$$;
