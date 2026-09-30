# Pendências para o lançamento

Lista do que falta antes de abrir a loja. Marque ao concluir.

## Acessos
- [x] Admin do Matheus (`matheusgmlima28@gmail.com`) liberado. Falta cadastrar o autenticador no primeiro acesso a `/admin`.
- [ ] Admin da cliente (deixado para o final): ela cria a conta em `/cadastro`, confirma o e-mail no mesmo navegador e passa o e-mail. Liberar com `insert into private.admin_users (user_id, note) select id, '<nome>' from auth.users where email = '<e-mail>'`. No primeiro acesso ela cadastra o autenticador.
- [ ] Remover o admin de teste (`teste.admin@rufinoclinical.dev`) e as contas de teste, depois que os dois admins reais estiverem entrando no painel.

## Dados e textos
- [ ] Preencher `src/lib/legal/company.ts` (razão social, CNPJ/CPF, endereço, contato, encarregado). Isso publica as páginas legais, o rodapé e o aceite no cadastro.
- [ ] Revisão dos textos legais por um advogado.

## Domínio e e-mail
- [ ] Registrar o domínio e ligar na Vercel. Atualizar `NEXT_PUBLIC_SITE_URL` e as URLs de redirecionamento do Supabase Auth.
- [ ] Resend: verificar o domínio, criar a chave e configurar `RESEND_API_KEY`, `EMAIL_FROM` e `EMAIL_REPLY_TO` na Vercel.
- [ ] Supabase: SMTP próprio com o Resend e aplicar os modelos de `supabase/templates/`.

## Pagamentos
- [ ] Credenciais de produção do Mercado Pago na Vercel e `MP_TEST_MODE` desligado.
- [ ] Webhook do Mercado Pago apontando para o domínio final, com a assinatura nova em `MP_WEBHOOK_SECRET`.
- [ ] Parcelamento sem juros na conta do Mercado Pago igual a Configurações → Parcelas sem juros no painel.

## Fase 6
- [ ] Limpar os dados de teste (pedidos de teste, produtos `DEV-`, numeração dos pedidos) sem apagar as contas reais.
- [ ] Cadastrar os produtos reais com fotos.
- [ ] Testes completos de ponta a ponta com credenciais de produção (uma compra real de valor baixo, reembolsada).
