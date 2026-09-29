@AGENTS.md

# Rufino Clinical

E-commerce de produtos para fisioterapia dermatofuncional. Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage) + Tailwind v4. Deploy na Vercel.

- Design e marca: `DESIGN.md`. Logos em `public/brand/` (regenerar com `npm run brand:build`).
- Banco: migrações em `supabase/migrations/` (aplicadas no projeto `wkmjvqshquzwlrtlmnqa`, região sa-east-1). Tipos em `src/lib/supabase/database.types.ts`.
- Checagens antes de commitar: `npm run lint && npm run typecheck && npm test && npm run build`.

## Regras de segurança (não negociáveis)

- RLS em toda tabela nova, com policies explícitas e `grant` mínimo. Rodar `supabase/tests/rls_smoke.sql` e os advisors de segurança após mudar policies.
- Admin = `app_metadata.role = 'admin'` **e** sessão MFA (`aal2`) — ver `private.is_admin()`.
- Preço, frete, desconto e total são calculados só no servidor/banco. Nunca confiar em valores vindos do cliente.
- Dados de cartão nunca passam pelo nosso servidor (tokenização do gateway).
- `createAdminClient()` ignora RLS: só em webhooks e criação de pedido, sempre validando entrada com Zod.
- Webhooks: validar assinatura e registrar em `webhook_events` (idempotência) antes de processar.
- Segredos só em variáveis de ambiente de servidor (`src/lib/env/server.ts`). Nada de segredo com prefixo `NEXT_PUBLIC_`.
- CSP com nonce em `src/proxy.ts`; novos domínios externos entram em `src/lib/security/csp.ts`.
