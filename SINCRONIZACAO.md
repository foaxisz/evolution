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

## Estado atual

Pronto:

- Cliente do Supabase, que se desliga sozinho se faltar configuração
- Sessão que sobrevive a fechar o app, com renovação automática de token
- Tela de entrar e criar conta, com os erros traduzidos
- Botão de sair na barra lateral e na gaveta do celular
- **Schema com Row Level Security** — `supabase/schema.sql`
- **Camada de sincronização** — `src/lib/sincronizacao.ts`, com fila,
  espera de 1,2s e nova tentativa quando a aba volta ao foco
- **Mesclagem por registro** — `src/lib/mesclar.ts`, com testes em
  `npm run testar`
- **Indicador de estado** — aparece só quando está enviando ou falhou
- **PWA** — instalável, com ícone próprio e cache offline

Falta **um comando seu** para criar a tabela. Veja "Passo 5".

### Uma decisão de projeto que mudou

O plano original era "uma tabela por tipo, espelhando `src/types/index.ts`".
Ficou **uma tabela só**, `documentos`, com `(usuario_id, chave) → jsonb`.

O motivo: o app guarda cada tipo como documento inteiro e faz todo o
filtro no navegador — não existe consulta por coluna, ordenação no
servidor nem junção. Dezoito tabelas dariam dezoito políticas de RLS e uma
migração a cada campo novo, sem entregar nada que o app use.

O preço é não dar para consultar por dentro do JSON com eficiência. Se um
dia precisar, o caminho é promover **aquele** tipo para tabela própria —
não reescrever tudo.

A resolução de conflito continua **por registro**, como estava planejado:
união dos dois lados pelo `id`, e só no mesmo `id` há disputa.

## Passo 5 — Autorizar a CLI ← **você, agora**

Criar tabela exige credencial que altera schema, e a chave publishable
não serve (a API responde `Secret API key required`). A secret key não
deve ser colada no projeto nem no chat.

O caminho sem expor segredo é a CLI, que autentica pelo navegador:

```bash
npx supabase login
```

Você clica em autorizar e o token fica **na sua máquina**. Depois disso a
migração em `supabase/migrations/` pode ser aplicada sem mais nada seu.

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
