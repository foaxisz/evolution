# Sincronizar entre celular e computador

Passo a passo do que **você** precisa fazer. Eu não posso criar contas nem
preencher senhas por você — mas depois que estes passos estiverem prontos,
eu escrevo toda a camada de sincronização.

Custo: **R$ 0**. Tudo cabe nos planos gratuitos.

---

## Como vai funcionar

O `localStorage` continua sendo o que a tela lê, então o app abre
instantâneo e funciona sem internet. A sincronização acontece por trás:

```
   Celular  ──┐                     ┌── abre offline, lê do localStorage
              ├── Supabase (Postgres) ──┤
      PC    ──┘                     └── sincroniza em segundo plano
```

Cada registro leva um `updatedAt`. Quando os dois lados mudam a mesma
coisa, vence o mais recente — **por registro**, não pelo banco inteiro.
É o que evita que editar no celular apague o que você fez no PC no mesmo
dia.

---

## Passo 1 — Criar o projeto no Supabase

1. Entre em https://supabase.com e crie a conta (dá para usar o Google).
2. **New project**.
   - **Name**: `evolution`
   - **Database Password**: gere uma forte e **guarde no seu gerenciador
     de senhas**. Você não vai digitar ela no app, mas é a senha do banco.
   - **Region**: `South America (São Paulo)` — é a mais perto, deixa o app
     mais rápido.
3. Espere uns 2 minutos até o projeto subir.

## Passo 2 — Pegar as duas chaves

No projeto: **Settings → API Keys**. Copie:

- **Project URL** — `https://udrgotkcrephgyunidif.supabase.co` ✔ já tenho
- **Publishable key** — começa com `sb_publishable_...` (em projetos mais
  antigos ela aparece como **anon public**, começando com `eyJ...`; é a
  mesma chave, o Supabase só trocou o nome)

> **Publishable / anon**: pública de propósito. Ela vai dentro do
> JavaScript que o navegador baixa, então não tem como escondê-la — e não
> precisa. Quem protege os dados é a Row Level Security nas tabelas.
>
> **Secret key / service_role**: essa ignora todas as regras de segurança.
> Nunca colar no projeto, no chat, nem em variável de ambiente do
> frontend.

## Passo 3 — Me passar a chave ✔ feito

`.env.local` criado. O `.gitignore` já pegava pela regra `*.local`.

## Passo 4 — Criar sua conta ← **você, agora**

A tela de login já está no ar. Abra o app, clique em **Criar uma**,
preencha e-mail e senha. Eu não crio conta nem preencho senha por você.

> O seu projeto está com **confirmação de e-mail exigida** — verifiquei
> pela API. Você vai receber um link e precisa clicar nele antes de
> conseguir entrar. Se preferir entrar direto, sem esse passo:
> **Authentication → Sign In / Providers → Email → desligar "Confirm
> email"**. Para uso pessoal é aceitável; o custo é que ninguém valida se
> o e-mail digitado existe de verdade.

---

## Passo 5 — Criar a tabela ← **você, e é o que falta**

> **A tabela `registros` NUNCA foi criada no banco.** Este documento afirmou
> por engano que estava ("✔ feito — tabela criada"), e essa frase custou
> três reescritas da lógica do cliente. Enquanto ela existia aqui, ninguém
> desconfiou do banco.
>
> Verificado em 2026-08-25, com a chave publishable:
>
> ```
> GET /rest/v1/registros  →  404
> {"code":"PGRST205","message":"Could not find the table 'public.registros'"}
> ```
>
> O banco tem só `documentos`, do modelo antigo. Toda chamada de
> sincronização respondia 404 — era esse o "erro de sincronização" que
> aparecia no celular e no computador ao mesmo tempo. Não era conflito, nem
> RLS, nem race condition.

**Como criar** (não dá para eu fazer: alterar schema exige credencial que
muda o banco, e a secret key não deve ser colada no projeto nem no chat):

1. Abra o painel: https://supabase.com/dashboard → seu projeto
2. **SQL Editor → New query**
3. Cole o conteúdo INTEIRO de
   [`supabase/migrations/20260826000000_registros_v4.sql`](supabase/migrations/20260826000000_registros_v4.sql)
4. **Run**

O arquivo é idempotente (pode rodar de novo) e termina com três consultas
de conferência: as colunas da tabela, as 4 políticas de RLS, e o tempo real
ligado. Se as três responderem, está pronto.

Depois disso, abra o app nos dois aparelhos. Se o selo de erro insistir, ele
agora **diz o motivo** em vez de só "Sem sincronizar".

## Estado atual (v4)

Pronto no cliente:

- Cliente do Supabase com verificação de sessão e renovação automática de token
- **Unidade é o registro** — `public.registros (usuario_id, colecao, registro_id, dados, excluido, atualizado_em)`
- **Ciclo unificado** — `src/lib/sincronizacao.ts`: conferir dono → enviar → puxar → reconciliar
- **Fila local persistente** em `localStorage` — sobrevive a fechar o app e a falta de rede
- **Erro que se identifica** — `diagnosticar()` traduz a falha para uma frase que diz o que fazer, na tela e não só no console
- **45 testes** — `npm run testar`, com simulador de dois aparelhos

### As sete invariantes

1. **Unidade atômica.** Cada hábito/log é uma linha. Editar um não encosta nos outros, então não há janela entre ler e escrever em que o trabalho do outro aparelho seja apagado.
2. **Exclusão é estado**, não ausência: grava `excluido: true`. Ausência de linha é indistinguível de "o outro ainda não me contou que criou" — foi isso que ressuscitava registro apagado.
3. **Enviar antes de puxar.** Quando a resposta chega, o que a pessoa acabou de fazer já está no servidor e volta idêntico. É o que dispensa qualquer escudo — e o escudo, quando existia, era o que bloqueava a exclusão vinda do outro aparelho.
4. **Ordenação total na leitura** (`atualizado_em, colecao, registro_id`). `range()` pagina por posição, então a ordem precisa ser total; ordenando só por carimbo, a página 2 repetia uma linha da página 1 e pulava outra. Acima de 500 registros era perda garantida.
5. **Margem no cursor** (5s para trás). Carimbo e ordem de commit não são a mesma coisa: uma transação que começou antes pode confirmar depois. Sem a margem, essa linha nunca mais era lida.
6. **Carimbo do banco, com `clock_timestamp()`** e não `now()`. `now()` é o horário da transação, igual para todas as linhas do lote — o que quebrava a ordenação da paginação.
7. **Dado tem dono.** `evo_sync_usuario` guarda de quem é o que está no aparelho. Sem isso, entrar com outra conta no mesmo aparelho subia o histórico da conta anterior para a conta nova.

### Aplicar antes de avançar o carimbo

`aplicarLinhas` grava, e só então o carimbo anda. Se a gravação local falhar
— disco cheio dá `QuotaExceededError` — a exceção sobe com o carimbo
intacto e o mesmo intervalo é pedido de novo. Na ordem inversa, o intervalo
seria considerado lido e o dado sumiria sem erro nenhum.

## Deploy na Vercel

Depois da sincronização pronta:

1. Suba o projeto para o GitHub.
2. Em https://vercel.com, **Add New → Project**, escolha o repositório.
3. A Vercel detecta Vite sozinha — não precisa mexer em nada.
4. Em **Environment Variables**, cole as mesmas duas chaves do Passo 2.
5. **Deploy**.

O app fica numa URL tipo `evolution-seu-usuario.vercel.app`, e cada push
para o GitHub republica sozinho.

---

## Uma decisão que ainda é sua

Hoje o app não tem login. Quando a sincronização entrar, ele vai passar a
pedir. Duas formas de lidar com os dados que já estão no seu navegador:

- **Migrar na primeira entrada** — ao logar pela primeira vez, o que está
  no `localStorage` sobe para a sua conta. Recomendado.
- **Começar limpo** — a conta nasce vazia.

Me diga qual quando chegarmos lá.
