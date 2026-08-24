-- ═══════════════════════════════════════════════════════════════════════
-- Evolution — tempo real na tabela `documentos`
--
-- Rode no SQL Editor do painel do Supabase:
--   Dashboard → SQL Editor → New query → colar → Run
--
-- Idempotente: pode rodar de novo sem estragar nada.
-- ═══════════════════════════════════════════════════════════════════════

-- Sem isto, o app ainda sincroniza — a vigia de 10 segundos cobre. Com
-- isto, gravar no celular aparece no PC na hora, sem tocar em nada.
--
-- O `add table` falha se a tabela já estiver na publicação, e não existe
-- `if not exists` para este comando; daí o bloco.
do $$
begin
  alter publication supabase_realtime add table public.documentos;
exception
  when duplicate_object then null;
end
$$;

-- O evento de Realtime respeita a RLS da tabela: cada sessão só recebe
-- aviso das próprias linhas. `full` faz o evento carregar a linha inteira,
-- necessário para o servidor conseguir avaliar a política de quem escuta.
alter table public.documentos replica identity full;

-- ═══════════════════════════════════════════════════════════════════════
-- Conferência: deve listar `documentos`.
-- ═══════════════════════════════════════════════════════════════════════
-- select tablename from pg_publication_tables
--  where pubname = 'supabase_realtime' and tablename = 'documentos';
