-- ═══════════════════════════════════════════════════════════════════════
-- Evolution — sincronização por registro
--
-- Rode este arquivo INTEIRO no SQL Editor do painel do Supabase:
--   Dashboard → SQL Editor → New query → colar → Run
--
-- Idempotente: pode rodar de novo sem estragar nada.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Por que a tabela `documentos` não deu certo ────────────────────────
--
-- Lá cada linha era um documento inteiro: (usuario_id, chave) → todo o
-- JSON de "todos os hábitos". Gravar significava SUBSTITUIR esse JSON.
--
-- Isso torna a perda de dado estrutural, não um bug a corrigir. Entre ler
-- e escrever existe uma janela; se o outro aparelho gravar dentro dela,
-- tudo o que ele escreveu é apagado por quem chegar depois. O cliente
-- tentava remendar com uma união dos dois lados — mas união não sabe
-- apagar, então exclusão precisou de lápide, e lápide precisou de poda. A
-- cada correção o remendo crescia, porque o furo era o modelo.
--
-- Aqui a unidade é o REGISTRO. Marcar um hábito escreve UMA linha; o que
-- o outro aparelho gravou está em outra linha e não é tocado. Não há
-- janela e não há mescla: dois aparelhos só disputam quando editam o
-- mesmo registro, e aí vence o carimbo mais novo, que é o certo.

create table if not exists public.registros (
  usuario_id  uuid not null references auth.users(id) on delete cascade,

  -- A coleção, com o mesmo nome da chave do localStorage: 'evo_habits'.
  colecao     text not null,

  -- O `id` do registro (uuid v4). Documentos que não são lista de
  -- registros — um objeto de ajustes, a lista de destaques — entram como
  -- registro único com id '__doc__', e aí o valor inteiro é o registro.
  registro_id text not null,

  -- Nulo quando excluído: não faz sentido guardar o corpo de quem morreu,
  -- e assim a lápide custa quase nada.
  dados       jsonb,

  -- Exclusão é ESTADO, não ausência. Ausência de linha é indistinguível
  -- de "o outro aparelho ainda não me contou que criou" — foi exatamente
  -- isso que fazia o registro excluído ressuscitar.
  excluido    boolean not null default false,

  -- Escrito só pelo gatilho abaixo. É a régua da sincronização.
  atualizado_em timestamptz not null default now(),

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

-- ── Índice ────────────────────────────────────────────────────────────
--
-- A única leitura que o app faz é "o que mudou desde o carimbo X?". Este
-- índice é exatamente essa pergunta, e é o que mantém a sincronização
-- barata mesmo com o histórico crescendo: o custo passa a ser
-- proporcional ao que mudou, não ao tamanho do banco.
create index if not exists registros_por_usuario_e_data
  on public.registros (usuario_id, atualizado_em);

-- ── Carimbo automático ────────────────────────────────────────────────
--
-- O horário vem do BANCO, nunca do aparelho. Relógio de celular atrasado
-- faria a disputa entre dois aparelhos escolher o registro errado, e o
-- app não teria como perceber.
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
-- cópia do estado anterior à migração, e enquanto ela existir dá para
-- voltar atrás. Quando a sincronização estiver rodando redonda por
-- alguns dias, pode apagar:
--
--   drop table public.documentos;

-- ═══════════════════════════════════════════════════════════════════════
-- Conferência: deve devolver a tabela, 4 políticas e o tempo real ligado.
-- ═══════════════════════════════════════════════════════════════════════
-- select policyname from pg_policies where tablename = 'registros';
-- select tablename from pg_publication_tables
--  where pubname = 'supabase_realtime' and tablename = 'registros';
