# Realidade aumentada

## O que foi implementado
AR **espacial**: um modelo 3D é ancorado na superfície real pelo sistema de AR do aparelho. Não é uma foto sobreposta à câmera.

| Requisito | Como é atendido |
|---|---|
| Detecção de superfícies horizontais | ARCore / ARKit, via `ar-placement="floor"` |
| Rastreamento espacial e ancoragem | hit-test + âncora do WebXR; Scene Viewer e Quick Look fazem o mesmo nativamente |
| Escala física real | GLB em metros + `ar-scale="fixed"` (o usuário não consegue redimensionar) |
| Estabilidade e outros ângulos | o modelo é um objeto 3D no mundo; caminhe ao redor |
| Android | Chrome: WebXR; fallback automático para o **Scene Viewer** |
| iOS | Safari: **AR Quick Look** com USDZ (enviado, ou convertido do GLB no aparelho) |

Componente: `<model-viewer>` do Google (`src/customer/AR.tsx`), com `ar-modes="webxr scene-viewer quick-look"`.

### Tecnologias avaliadas
- **WebXR** — melhor experiência no Android (sem sair do navegador). Não existe no Safari.
- **Scene Viewer (ARCore)** — fallback Android; precisa do GLB em URL HTTPS pública.
- **AR Quick Look (ARKit)** — único caminho no iPhone/iPad; formato USDZ.
- **GLB/glTF 2.0** — formato-fonte único; **USDZ** — só para iOS.
- App nativo ARCore/ARKit — descartado: exigiria instalar um app por restaurante.

## De onde vem o modelo 3D

### Limitação de uma única fotografia
Uma foto não contém profundidade. **Não é possível reconstruir com fidelidade o volume da comida** a partir de uma imagem; qualquer ferramenta que prometa isso está inventando a geometria oculta.

### Alternativa implementada (cadastro em 1 minuto)
`src/lib/glb.ts` gera o GLB no próprio navegador:
- a **louça** (prato, bowl, garrafa, taça) é geometria real, por revolução, nas medidas cadastradas;
- a **foto de topo** do prato é aplicada como textura, com um relevo central suave (até 2 cm).

Resultado: objeto 3D real, na escala certa, convincente visto de cima e em ângulo — que é como se olha um prato na mesa. Limite honesto: em ângulo rasante a comida parece baixa.

Passos no painel (Produtos e AR → editar → Realidade aumentada):
1. Escolher a forma e informar largura, profundidade e altura em cm.
2. Enviar a foto tirada exatamente de cima e ajustar zoom/posição até a borda do prato encostar no círculo.
3. **Gerar modelo 3D** — o painel mostra as dimensões resultantes e a pré-visualização.

### Caminho profissional (volume fiel)
Fotogrametria: 20–40 fotos ao redor do prato (Object Capture do iPhone, Polycam, RealityScan). Exporte **GLB** em metros (e **USDZ**, opcional) e envie no mesmo cadastro, em *Limitações e alternativa profissional*. Recomenda-se até ~5 MB por modelo.

### Modelo híbrido com volume (usado nos 7 pratos em destaque da demonstração)
`scripts/optimize-glb.mjs` combina os dois caminhos:
1. a comida é isolada em uma imagem sem a louça e convertida em malha 3D (imagem→3D; na demonstração, Tripo via Higgsfield, ~9 créditos por prato);
2. `hybridDish()` gera a louça procedural nas medidas reais, apoia a comida no fundo do prato, ajusta o diâmetro e **limita a altura à medida cadastrada** (esses geradores exageram a profundidade), reduz a malha e as texturas (≈1,3 MB por prato).

Tentar converter prato + comida de uma vez não funcionou: a louça branca sai quebrada. Por isso a louça é sempre procedural.
O mesmo utilitário normaliza um GLB de fotogrametria: `node scripts/optimize-glb.mjs entrada.glb saida.glb 27`.

Limite honesto: a geometria da comida é uma estimativa plausível feita por IA a partir de uma imagem, não uma medição do prato real.

## Estado dos testes
- Automatizado: GLB válido, bounding box igual às dimensões cadastradas (teste unitário para os 40 modelos), carregamento no visualizador e escala lida do `model-viewer` (e2e).
- **Pendente: teste em aparelhos físicos.** A sessão de AR com câmera não pode ser exercitada em navegador automatizado. Roteiro:
  1. Android com Google Play Services para RA, Chrome → abrir um prato → *Ver na minha mesa* → conferir ancoragem e medir o prato com uma régua.
  2. iPhone/iPad, Safari → mesmo roteiro (abre o Quick Look).
  3. Repetir com um modelo gerado no painel em modo produção (URL pública do Storage).

No modo demonstração, modelos gerados no painel ficam como `data:` URL: funcionam em WebXR e no visualizador, mas não no Scene Viewer. Em produção (Supabase Storage) essa restrição não existe.
