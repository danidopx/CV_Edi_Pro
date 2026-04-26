-- Criação da tabela de transferência de vagas da extensão
CREATE TABLE IF NOT EXISTS public.transferencias_vagas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    texto TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policy: Permitir inserção anônima (para a extensão poder enviar sem login)
-- E leitura apenas pelo sistema (via service_role) ou usuários autenticados
ALTER TABLE public.transferencias_vagas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for everyone" 
ON public.transferencias_vagas FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Enable select for authenticated users" 
ON public.transferencias_vagas FOR SELECT 
USING (auth.role() = 'authenticated' OR public.is_admin_user());

-- Índice para performance e limpeza automática futura
CREATE INDEX IF NOT EXISTS idx_transferencias_vagas_created_at ON public.transferencias_vagas(created_at);
