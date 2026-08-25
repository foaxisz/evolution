-- ═══════════════════════════════════════════════════════════════════════
-- Evolution — sincronização por registro (v4)
--
-- RODE ESTE ARQUIVO INTEIRO no SQL Editor do painel do Supabase:
--   Dashboard → SQL Editor → New query → colar tudo → Run
--
-- Idempotente: pode rodar de novo sem estragar nada.
--
-- ── Por que este arquivo existe ────────────────────────────────────────
--
-- A tabela `registros` nunca foi criada no banco. O cliente foi reescrito
-- três vezes para falar com ela, e o banco seguiu só com `documentos`. Toda
-- chamada de sincronização respondia:
--
--   404  PGRST205  Could not find the table 'public.registros'
--
-- Era isso, e não conflito nem race condition, o "erro de sincronização"
-- que aparecia no celular e no computador ao mesmo tempo.
-- ═══════════════════════════════════════════════════════════════════════

-- ── A tabela ──────────────────────────────────────────────────────────
--
-- A unidade é o REGISTRO, não o documento. Marcar um hábito escreve UMA
-- linha; o que o outro aparelho gravou está em outra linha e não é tocado.
-- Não há janela entre ler e escrever em que o trabalho do outro possa ser
-- apagado — que era o furo estrutural do modelo `documentos`.

create table if not exists public.registros (
  usuario_id  uuid not null references auth.users(id) on delete cascade,

  -- A coleção, com o mesmo nome da chave do localStorage: 'evo_habits'.
  colecao     text not null,

  -- O `id` do registro. Documentos que não são lista de registros — um
  -- objeto de ajustes, a lista de destaques — entram como registro único
  -- com id '__doc__', e aí o valor inteiro é o registro.
  registro_id text not null,

  -- Nulo quando excluído: não faz sentido guardar o corpo de quem morreu,
  -- e assim a lápide custa quase nada.
  dados       jsonb,

  -- Exclusão é ESTADO, não ausência. Ausência de linha é indistinguível
  -- de "o outro aparelho ainda não me contou que criou".
  excluido    boolean not null default false,

  -- Escrito só pelo gatilho abaixo. É a régua da sincronização.
  atualizado_em timestamptz not null default clock_timestamp(),

  primary key (usuario_id, colecao, registro_id)
);

-- ── Row Level Security ────────────────────────────────────────────────
--
-- É ISTO que protege os dados, não o sigilo da chave publishable — ela
-- aparece no JavaScript que qualquer um baixa.

alter table public.registros enable row level security;

drop policy if exists "dono lê" on public.registros;
create policy "dono lê" on public.registros
  for select using ((select auth.uid()) = usuario_id);

drop policy if exists "dono insere" on public.registros;
create policy "dono insere" on public.registros
  for insert with check ((select auth.uid()) = usuario_id);

-- `using` diz quais linhas podem ser alvo; `with check` impede gravar a
-- linha com outro dono. Sem o segundo, daria para reatribuir o próprio
-- registro para a conta alheia.
drop policy if exists "dono atualiza" on public.registros;
create policy "dono atualiza" on public.registros
  for update using ((select auth.uid()) = usuario_id)
          with check ((select auth.uid()) = usuario_id);

drop policy if exists "dono apaga" on public.registros;
create policy "dono apaga" on public.registros
  for delete using ((select auth.uid()) = usuario_id);

-- ── Carimbo automático, com clock_timestamp() ─────────────────────────
--
-- O horário vem do BANCO, nunca do aparelho: relógio de celular atrasado
-- faria a disputa entre dois aparelhos escolher o registro errado.
--
-- `clock_timestamp()` e NÃO `now()`, e a diferença importa muito aqui.
-- `now()` devolve o horário de início da TRANSAÇÃO, igual para todas as
-- linhas do mesmo lote. Na primeira carga de um aparelho, isso dava a
-- centenas de linhas o mesmíssimo carimbo — e a leitura paginada, que
-- ordena por carimbo, não tinha critério de desempate entre elas. Duas
-- páginas podiam repetir uma linha e PULAR outra, perdendo dado em
-- silêncio.
--
-- `clock_timestamp()` avança durante a transação, então cada linha recebe
-- um carimbo distinto e a ordenação passa a ser total.
create or replace function public.marcar_atualizacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.atualizado_em := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists registros_carimbo on public.registros;
create trigger registros_carimbo
  before insert or update on public.registros
  for each row execute function public.marcar_atualizacao();

-- ── Índice ────────────────────────────────────────────────────────────
--
-- A única leitura que o app faz é "o que mudou desde o carimbo X, em ordem
-- estável?". Este índice é exatamente essa pergunta, com as colunas de
-- desempate incluídas para a ordenação sair pronta do índice, sem sort.
drop index if exists public.registros_por_usuario_e_data;
create index if not exists registros_leitura
  on public.registros (usuario_id, atualizado_em, colecao, registro_id);

-- ── Tempo real ────────────────────────────────────────────────────────
--
-- Sem isto o app ainda sincroniza — a vigia por tempo cobre. Com isto,
-- gravar no celular aparece no PC na hora.
--
-- `add table` não tem `if not exists`; daí o bloco.
do $$
begin
  alter publication supabase_realtime add table public.registros;
exception
  when duplicate_object then null;
end
$$;

-- O evento respeita a RLS: cada sessão só é avisada das próprias linhas.
-- `full` faz o evento carregar a linha inteira, que é o que o servidor
-- precisa para avaliar a política de quem está escutando.
alter table public.registros replica identity full;

-- ── A tabela antiga ───────────────────────────────────────────────────
--
-- `documentos` fica de pé de propósito, sem ninguém escrevendo nela. É a
-- cópia do estado anterior e, enquanto existir, dá para voltar atrás.
-- Quando a sincronização estiver rodando redonda por alguns dias:
--
--   drop table public.documentos;

-- ═══════════════════════════════════════════════════════════════════════
-- CONFERÊNCIA — rode junto e confira as três respostas
-- ═══════════════════════════════════════════════════════════════════════

-- 1) A tabela existe e tem as 6 colunas?
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'registros'
 order by ordinal_position;

-- 2) As 4 políticas estão no lugar?
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'registros'
 order by policyname;

-- 3) O tempo real está ligado? (deve devolver uma linha)
select tablename from pg_publication_tables
 where pubname = 'supabase_realtime' and tablename = 'registros';
