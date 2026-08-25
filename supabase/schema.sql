-- ═══════════════════════════════════════════════════════════════════════
-- Evolution — sincronização por registro (v3)
--
-- Rode este arquivo INTEIRO no SQL Editor do painel do Supabase:
--   Dashboard → SQL Editor → New query → colar → Run
--
-- Idempotente: pode rodar de novo sem estragar nada.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.registros (
  usuario_id    uuid        not null references auth.users(id) on delete cascade,
  colecao       text        not null,
  registro_id   text        not null,
  dados         jsonb,
  excluido      boolean     not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, colecao, registro_id)
);

-- ── Row Level Security ────────────────────────────────────────────────

alter table public.registros enable row level security;

drop policy if exists "dono lê" on public.registros;
create policy "dono lê" on public.registros
  for select using ((select auth.uid()) = usuario_id);

drop policy if exists "dono insere" on public.registros;
create policy "dono insere" on public.registros
  for insert with check ((select auth.uid()) = usuario_id);

drop policy if exists "dono atualiza" on public.registros;
create policy "dono atualiza" on public.registros
  for update using ((select auth.uid()) = usuario_id)
          with check ((select auth.uid()) = usuario_id);

drop policy if exists "dono apaga" on public.registros;
create policy "dono apaga" on public.registros
  for delete using ((select auth.uid()) = usuario_id);

-- ── Índice ────────────────────────────────────────────────────────────

create index if not exists registros_por_usuario_e_data
  on public.registros (usuario_id, atualizado_em);

-- ── Carimbo automático ────────────────────────────────────────────────

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

drop trigger if exists registros_carimbo on public.registros;
create trigger registros_carimbo
  before insert or update on public.registros
  for each row execute function public.marcar_atualizacao();

-- ── Tempo Real ────────────────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.registros;
exception
  when duplicate_object then null;
end
$$;

alter table public.registros replica identity full;
her o documento errado.
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
