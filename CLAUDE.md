@AGENTS.md

# Rufino Clinical

E-commerce de produtos para fisioterapia dermatofuncional. Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage) + Tailwind v4. Deploy na Vercel.

- Design e marca: `DESIGN.md`. Logos em `public/brand/` (regenerar com `npm run brand:build`).
- Banco: migrações em `supabase/migrations/` (aplicadas no projeto `wkmjvqshquzwlrtlmnqa`, região sa-east-1). Tipos em `src/lib/supabase/database.types.ts`.
- Checagens antes de commitar: `npm run lint && npm run typecheck && npm test && npm run build`.
- Verificador de segurança contra um servidor rodando: `npm run security:check -- http://localhost:3000` (roda no CI).

## Regras de segurança (não negociáveis)

- RLS em toda tabela nova, com policies explícitas e `grant` mínimo. Rodar `supabase/tests/rls_smoke.sql` e os advisors de segurança após mudar policies.
- Admin = linha em `private.admin_users` **e** sessão MFA (`aal2`) — ver `private.is_admin()`. Claims do JWT não dão acesso. Remover a linha revoga na hora.
- Tabelas/funções novas nascem sem acesso para `anon`/`authenticated` (default privileges revogados): toda migração faz `grant` explícito e mínimo, de preferência por coluna.
- Status do pedido segue a máquina de estados em `private.enforce_order_transition()`; `paid`/`refunded` só vêm do servidor (gateway). `audit_log` e `stock_movements` são append-only.
- Preço, frete, desconto e total são calculados só no servidor/banco. Nunca confiar em valores vindos do cliente.
- Dados de cartão nunca passam pelo nosso servidor (tokenização do gateway).
- `createAdminClient()` ignora RLS: só em webhooks e criação de pedido, sempre validando entrada com Zod.
- Webhooks: validar assinatura e registrar em `webhook_events` (idempotência) antes de processar.
- Segredos só em variáveis de ambiente de servidor (`src/lib/env/server.ts`). Nada de segredo com prefixo `NEXT_PUBLIC_`.
- CSP com nonce em `src/proxy.ts`; novos domínios externos entram em `src/lib/security/csp.ts`.
- Login/cadastro/recuperação rodam no navegador (cliente Supabase do browser) para o rate limit do Supabase contar o IP do cliente, não o do servidor. Mensagens de erro nunca revelam se um e-mail existe.
- Todo `next`/redirect pós-login passa por `safeNext()` (bloqueia open redirect).
- Cookies de sessão: `capCookieOptions()` em todo writer (server, proxy, browser); a lib força 400 dias e ignora `maxAge`.
- Server actions revalidam a sessão (`getSessionUser`) e validam entrada com Zod; RLS e grants por coluna são a segunda barreira.
