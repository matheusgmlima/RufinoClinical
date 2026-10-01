@AGENTS.md

# Rufino Clinical

E-commerce de produtos para fisioterapia dermatofuncional. Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage) + Tailwind v4. Deploy na Vercel.

- Design e marca: `DESIGN.md`. Logos em `public/brand/` (regenerar com `npm run brand:build`).
- Banco: migrações em `supabase/migrations/` (aplicadas no projeto `wkmjvqshquzwlrtlmnqa`, região sa-east-1; o nome do arquivo usa a versão registrada no banco). Tipos em `src/lib/supabase/database.types.ts`.
- Pagamentos: Mercado Pago Checkout Transparente pela API de Orders (`/v1/orders`; a de Payments está sendo descontinuada). Pix, boleto e cartão via Card Payment Brick. Fluxo: `quote_order`/`create_order` (SQL) → `src/lib/payments/mercadopago.ts` → `record_payment` (SQL). Webhook (evento Order) em `src/app/api/webhooks/mercadopago`; a página do pedido relê cobranças pendentes no gateway (`recheckPendingPayment`) caso o webhook falhe. Com credenciais de teste as notificações vêm assinadas por um app interno do MP e são recusadas (401): no sandbox a confirmação chega por essa releitura. "Sem juros" só até `store_settings.interest_free_installments`, que deve espelhar o parcelamento sem juros configurado na conta do MP (Seu negócio → Custos); acima disso os juros são do comprador.
- Frete: `private.shipping_options` monta as opções (transportadoras da cotação do Melhor Envio guardada em `shipping_quotes`, ou o preço fixo por região do estado quando não há cotação; entrega no mesmo dia por motoboy dentro do raio do CEP do estoque; retirada grátis para o mesmo estado do estoque) e `price_order` cobra a escolhida (`p_shipping`). A distância usa `cep_locations` (cache de CEP → coordenadas, escrito só pelo servidor com dados da BrasilAPI; muitas vezes é o centro do bairro ou da cidade). Toda action que cota frete chama `ensureCepLocation` antes e, quando a resposta vem com `carrier_quoted: false`, `ensureCarrierQuote` (`src/lib/shipping/melhor-envio.ts`, pacotes montados do catálogo no servidor) e cota de novo. Sem `MELHOR_ENVIO_TOKEN` ou com a API fora, vale o preço por região. `MELHOR_ENVIO_ENV=production` usa a API real; sem ele, o sandbox. Configuração em `/admin/configuracoes`. Pedidos de motoboy e retirada não têm rastreio.
- E-mails do Auth: modelos em `supabase/templates/`, aplicados quando houver SMTP próprio (o Supabase só libera a edição com SMTP; Fase 5). Eles levam `token_hash` direto para `/auth/confirm` e funcionam em outro aparelho. Até lá vale o link padrão (PKCE), que só conclui no mesmo navegador; `/auth/confirm` orienta quem abre em outro.
- E-mails de pedido (Resend): modelos em `src/lib/email/order-emails.ts`, disparados por `notifyOrder()` com `after()` quando `record_payment` devolve `paid`/`refunded` (ou registra Pix/boleto pendente) e quando o admin marca como enviado. Chave de idempotência por pedido e tipo. Desligados sem `RESEND_API_KEY` e `EMAIL_FROM`; o envio real precisa do domínio verificado no Resend.
- LGPD na conta (`/conta/dados`): cópia dos dados em JSON (`/conta/exportar`) e exclusão da conta (`delete_my_account`: apaga usuário, perfil e endereços; bloqueada com pedido em andamento e para admins; pedidos ficam guardados sem vínculo com a conta). Observações internas de pedido ficam em `order_notes` (só admin): admin e cliente usam o mesmo papel `authenticated`, então coluna em `orders` seria legível pelo cliente.
- Páginas legais (`/privacidade`, `/termos`, `/trocas-e-devolucoes`), a identificação da loja no rodapé (Decreto 7.962/2013) e o aceite no cadastro ficam ocultos até todos os campos de `src/lib/legal/company.ts` serem preenchidos. Mudou uma política: atualizar `POLICIES_UPDATED_AT`.
- Painel admin em `/admin` (rotas no grupo `(painel)`): pedidos, catálogo, cupons, configurações e auditoria. Layout não protege página: toda página chama `requireAdmin()` e toda action `adminClient()` (`src/lib/auth/admin.ts`). Estoque só muda por `adjust_stock` (grava `stock_movements`). Fotos sobem do navegador direto para o bucket `product-images`; a action só registra o caminho. Formulários usam `useAdminForm` (envio por `onSubmit`, sem reset dos campos quando dá erro).
- Dar acesso de admin (sem tela, de propósito): `insert into private.admin_users (user_id, note) values ('<uuid do auth.users>', '<nome>')`. No primeiro acesso a pessoa cadastra o autenticador em `/admin/verificar`. Autenticador perdido: `delete from auth.mfa_factors where user_id = '<uuid>'` e ela cadastra de novo no próximo login.
- Checagens antes de commitar: `npm run lint && npm run typecheck && npm test && npm run build`.
- Verificador de segurança contra um servidor rodando: `npm run security:check -- http://localhost:3000` (roda no CI).

## Regras de segurança (não negociáveis)

- RLS em toda tabela nova, com policies explícitas e `grant` mínimo. Rodar `supabase/tests/rls_smoke.sql` e os advisors de segurança após mudar policies.
- Admin = linha em `private.admin_users` **e** sessão MFA (`aal2`) — ver `private.is_admin()`. Claims do JWT não dão acesso. Remover a linha revoga na hora.
- Tabelas/funções novas nascem sem acesso para `anon`/`authenticated` (default privileges revogados): toda migração faz `grant` explícito e mínimo, de preferência por coluna.
- Status do pedido segue a máquina de estados em `private.enforce_order_transition()`; `paid`/`refunded` só vêm do servidor (gateway). `audit_log` e `stock_movements` são append-only.
- Preço, frete, desconto e total são calculados só no servidor/banco. Nunca confiar em valores vindos do cliente.
- Dados de cartão nunca passam pelo nosso servidor (tokenização do gateway).
- `createAdminClient()` ignora RLS: só para registrar pagamentos (`record_payment`), no webhook, para ler o pedido dos e-mails transacionais (`notifyOrder`) e para gravar os caches de CEP (`ensureCepLocation`, BrasilAPI) e de cotação (`ensureCarrierQuote`, Melhor Envio), sempre com dados validados por Zod. Pedidos são criados com a sessão do cliente (`create_order`).
- Webhooks: validar assinatura e registrar em `webhook_events` (idempotência) antes de processar. O conteúdo da notificação nunca é confiável: o pagamento é sempre buscado na API do gateway.
- Segredos só em variáveis de ambiente de servidor (`src/lib/env/server.ts`). Nada de segredo com prefixo `NEXT_PUBLIC_`.
- CSP com nonce em `src/proxy.ts`; novos domínios externos entram em `src/lib/security/csp.ts`. Nunca adicionar hosts em `script-src` (o `'strict-dynamic'` já cobre scripts carregados pelo nosso código).
- Datas mostradas ao cliente usam `timeZone: "America/Sao_Paulo"` (o servidor roda em UTC).
- Login/cadastro/recuperação rodam no navegador (cliente Supabase do browser) para o rate limit do Supabase contar o IP do cliente, não o do servidor. Mensagens de erro nunca revelam se um e-mail existe.
- Todo `next`/redirect pós-login passa por `safeNext()` (bloqueia open redirect).
- Cookies de sessão: `capCookieOptions()` em todo writer (server, proxy, browser); a lib força 400 dias e ignora `maxAge`.
- Server actions revalidam a sessão (`getSessionUser`) e validam entrada com Zod; RLS e grants por coluna são a segunda barreira.
