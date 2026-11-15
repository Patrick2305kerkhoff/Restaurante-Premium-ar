# Operação

## Primeiro acesso do restaurante
1. **Restaurantes** (administrador da plataforma): criar o estabelecimento. O endereço público passa a ser `#/r/<slug>`.
2. **Identidade visual**: logotipo, capa, cores, fontes, arredondamento, textos e contatos. Há predefinições (alta gastronomia, bistrô, hamburgueria, cafeteria, hotel) e pré-visualização ao vivo.
3. **Categorias**: criar e ordenar — a ordem é a do cardápio.
4. **Produtos e AR**: cadastrar cada prato (foto, descrição, ingredientes, preço) e, na aba *Realidade aumentada*, forma, dimensões em centímetros e o modelo 3D (ver [AR.md](AR.md)).
5. **Mesas e QR Codes**: criar as mesas e **Imprimir QR Codes**. O botão ↻ gera um novo código e invalida o anterior.

## Dia a dia
- **Pedidos**: quadro Novo → Em preparo → Pronto → Entregue, atualizado a cada 5 s. Chamados de garçom e de conta aparecem no topo; marque *Atendido*.
- **Disponibilidade**: a chave na lista de produtos tira o prato do cardápio na hora. O preço pode ser editado direto na lista.
- **Indicadores**: faturamento, pedidos, ticket médio, pratos mais pedidos, produtos com AR; exporte o período em CSV.

## Fluxo do cliente
1. Lê o QR Code da mesa → o app identifica a mesa.
2. Navega, busca, favorita, toca em **Ver na mesa** para a AR.
3. Monta o pedido, adiciona observações e envia à cozinha; acompanha o status.
4. Chama o garçom ou pede a conta pelo app.

Sem ler o QR Code o cliente consulta o cardápio e a AR normalmente, mas não consegue pedir.
