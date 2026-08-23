-- ═══════════════════════════════════════════════════════════════════════
-- Evolution — schema de sincronização
--
-- Rode este arquivo INTEIRO no SQL Editor do painel do Supabase:
--   Dashboard → SQL Editor → New query → colar → Run
--
-- Pode rodar mais de uma vez sem estragar nada: tudo aqui é idempotente.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Por que uma tabela só, e não uma por tipo de dado ──────────────────
--
-- O app guarda cada tipo num documento inteiro ("todos os hábitos", "todos
-- os registros") e faz TODO o filtro no navegador — não existe consulta
-- por coluna, ordenação no servidor nem junção. Uma tabela por tipo daria
-- dezoito tabelas, dezoito políticas de RLS e uma migração a cada novo
-- campo, sem entregar nada que o app use.
--
-- Aqui cada linha é um documento: (dono, chave) → JSON. Um tipo novo de
-- dado não precisa de migração nenhuma.
--
-- O preço é não dar para consultar por dentro do JSON com eficiência. Se
-- um dia o app precisar disso, o caminho é promover AQUELE tipo para
-- tabela própria — não reescrever tudo.

create table if not exists public.documentos (
  usuario_id  uuid        not null references auth.users(id) on delete cascade,
  chave       text        not null,
  dados       jsonb       not null,
  -- Carimbo de quem gravou por último. É o que decide o vencedor quando
  -- dois aparelhos editam o mesmo documento.
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, chave)
);

-- ── Row Level Security ────────────────────────────────────────────────
--
-- É ISTO que protege os dados, não o sigilo da chave publishable — ela
-- aparece no JavaScript que qualquer um baixa. Sem RLS, essa chave daria
-- acesso a todas as linhas de todos os usuários.

alter table public.documentos enable row level security;

-- `auth.uid()` é o id do usuário do token JWT da requisição. Sem sessão
-- válida ele é nulo e nenhuma linha casa — anônimo não lê nem escreve.
drop policy if exists "dono lê" on public.documentos;
create policy "dono lê" on public.documentos
  for select using ((select auth.uid()) = usuario_id);

drop policy if exists "dono insere" on public.documentos;
create policy "dono insere" on public.documentos
  for insert with check ((select auth.uid()) = usuario_id);

-- `using` controla quais linhas podem ser alvo; `with check` impede que a
-- linha seja gravada com outro dono. Sem o segundo, daria para reatribuir
-- o próprio documento para a conta alheia.
drop policy if exists "dono atualiza" on public.documentos;
create policy "dono atualiza" on public.documentos
  for update using ((select auth.uid()) = usuario_id)
          with check ((select auth.uid()) = usuario_id);

drop policy if exists "dono apaga" on public.documentos;
create policy "dono apaga" on public.documentos
  for delete using ((select auth.uid()) = usuario_id);

-- ── Índice ────────────────────────────────────────────────────────────
--
-- A sincronização pergunta "o que mudou desde X?" para este usuário. A
-- chave primária já cobre a busca por usuário, mas não a ordenação por
-- data — este índice cobre as duas coisas juntas.
create index if not exists documentos_por_usuario_e_data
  on public.documentos (usuario_id, atualizado_em desc);

-- ── Carimbo automático ────────────────────────────────────────────────
--
-- O horário vem do BANCO, nunca do aparelho. Relógio de celular atrasado
-- ou adiantado faria a resolução de conflito escolher o documento errado.
create or replace function public.marcar_atualizacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists documentos_carimbo on public.documentos;
create trigger documentos_carimbo
  before insert or update on public.documentos
  for each row execute function public.marcar_atualizacao();

-- ═══════════════════════════════════════════════════════════════════════
-- Conferência: depois de rodar, isto deve devolver 4 políticas e a tabela.
-- ═══════════════════════════════════════════════════════════════════════
-- select tablename, policyname from pg_policies where tablename = 'documentos';
