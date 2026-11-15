# Instalação e publicação

## Requisitos
Node.js 22+. Para produção: um projeto Supabase e um host estático com HTTPS (Vercel recomendado). **AR exige HTTPS.**

## 1. Banco de dados (Supabase)
1. Crie um projeto no Supabase (região `sa-east-1` para o Brasil).
2. No SQL Editor, execute `supabase/migrations/0001_maison_premium_ar.sql`. Ele cria as tabelas, as políticas de RLS, as funções usadas pelo cliente (QR/pedidos) e o bucket `assets`.
3. Opcional: execute `supabase/seed.sql` para carregar os restaurantes demonstrativos (gerado por `node scripts/seed-sql.mjs`).
4. Em Authentication → Users, crie o usuário administrador da plataforma e registre-o:
   ```sql
   insert into public.platform_admins (user_id) select id from auth.users where email = 'voce@empresa.com';
   ```
5. Para dar acesso a um gerente de um restaurante específico:
   ```sql
   insert into public.restaurant_members (restaurant_id, user_id)
   select 'ID_DO_RESTAURANTE', id from auth.users where email = 'gerente@cliente.com';
   ```

### Isolamento dos dados
- Cardápio (restaurantes, categorias, pratos): leitura pública, escrita apenas por quem administra aquele restaurante (`can_manage`).
- Mesas, pedidos e chamados: **nunca** legíveis pelo público. O cliente só interage por funções `security definer` (`table_by_token`, `place_order`, `call_service`, `order_statuses`), que validam o token do QR e recalculam os preços no servidor.
- Storage: cada restaurante só grava em `assets/<restaurant_id>/…`.

## 2. Aplicação
```bash
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install && npm run build   # gera dist/
```
Na Vercel: importe o repositório (framework Vite), defina as duas variáveis de ambiente e publique. O app usa rotas com `#`, então funciona em qualquer host estático sem regras de reescrita.

## 3. Verificação
```bash
npm test                              # unidade: GLB em escala, pedidos, isolamento
npm run e2e                           # funcional local + capturas em docs/screenshots
E2E_URL=https://seu-dominio/ npm run e2e   # contra a publicação (modo demonstração)
```
O workflow `CI` roda os três a cada push e publica as capturas como artefato.

## Assets da demonstração
`scripts/demo-sources.json` lista as imagens demonstrativas. O workflow **Demo assets** baixa, otimiza, recorta a vista de topo e gera os GLB em `public/demo/`. `npm run assets -- --models` regenera só os modelos.
