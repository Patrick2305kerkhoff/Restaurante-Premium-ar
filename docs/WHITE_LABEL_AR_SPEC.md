# Restaurante Premium AR — arquitetura white-label

## Produto
Uma plataforma multi-restaurante: cada estabelecimento tem identidade, catálogo, preços, fotos e permissões próprias. O tema inicial de demonstração é **Maison**, restaurante cinco estrelas (preto, dourado e tipografia refinada), mas o mesmo sistema atende bares e lancherias.

## Separação obrigatória
- **Identidade do restaurante:** logo, nome, cores, fontes, capa, tom de comunicação, categorias e estilo dos cards.
- **Produto gastronômico:** nome, descrição, preço, alérgenos, disponibilidade, fotografia original, recorte com transparência, largura e altura reais aproximadas do prato, referência de escala e versão da imagem.
- **Visualização na câmera:** sempre usar a fotografia do prato daquele restaurante; nunca incluir cenário de restaurante na imagem do prato. O cenário é o ambiente real capturado pela câmera do cliente.
- **Isolamento por restaurante:** cada usuário administrativo só altera os dados de seu estabelecimento; uploads e pedidos sempre vinculados ao tenant_id.

## Experiência do cliente
1. Abrir cardápio via QR code/URL do restaurante.
2. Ver marca, categorias, pratos e preços personalizados.
3. Selecionar prato e tocar em “Ver na minha mesa”.
4. Autorizar câmera, apontar para a mesa, posicionar e ajustar o prato; permitir captura de tela.
5. Voltar ao cardápio e pedir ou chamar atendimento.

## Limite técnico explícito
Uma fotografia isolada recortada pode ser sobreposta em 2D, mas não gera geometria 3D, oclusão ou escala física garantida. Não chamar esse modo de AR espacial verdadeira. Para escala realista, exigir referência de dimensões e calibração; para rastreamento de superfície, implementar WebXR hit-test onde disponível e fallback transparente com ajuste manual. Para fidelidade volumétrica, capturar múltiplas vistas ou usar modelo 3D/fotogrametria validado pelo restaurante.

## Modelo de dados (proposta)
- restaurants(id, slug, name, status, logo_url)
- restaurant_themes(restaurant_id, preset, primary_color, accent_color, background_color, font_heading, font_body, cover_url)
- restaurant_members(restaurant_id, user_id, role)
- categories(id, restaurant_id, name, sort_order)
- dishes(id, restaurant_id, category_id, name, description, price_cents, currency, available, allergens)
- dish_assets(id, restaurant_id, dish_id, original_url, cutout_url, model_3d_url, plate_width_cm, plate_depth_cm, capture_status)
- orders(id, restaurant_id, table_id, status, total_cents)
Todos os acessos devem ser filtrados por restaurant_id e protegidos por políticas de acesso no backend.

## Critérios de aceite da primeira entrega
- Um restaurante demo Maison com cardápio completo e tema cinco estrelas.
- Um segundo tema simples de bar/lancheria usando o MESMO motor e dados isolados.
- Administrador troca logo, cores, categorias, pratos e imagens sem alterar código.
- Câmera mostra foto recortada do prato selecionado sobre a mesa real, sem fundo fotográfico embutido.
- Interface identifica claramente modo 2D e não promete escala ou rastreamento físico não implementados.
- Testes mobile Android/iOS, permissões, HTTPS, upload e segregação multi-tenant antes de comercialização.

## Sequência de implementação
1. Auditar estrutura existente e configurar dados multi-tenant.
2. Criar tokens de tema, dois presets e painel de personalização.
3. Implementar catálogo, upload e processamento de imagem com transparência.
4. Integrar câmera e calibragem, depois WebXR/alternativa compatível.
5. Testes reais em mesas de bar e restaurante sofisticado.
