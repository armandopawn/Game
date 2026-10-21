# Zona PvP — contexto completo do projeto (para outra IA continuar)

> Leia tudo antes de mexer em qualquer código. A dona do projeto (Joana) escreve em português do Brasil, testa no celular (Termux/navegador) e no PC. Estado atual: **versão ONLINE-ready (v2)**: escuta em 0.0.0.0, Three.js pelo CDN (com plano B local), salas separadas por modo, Arsenal no lobby. Pronta para subir (GitHub → Render); ela ainda precisa testar no aparelho e conferir os Logs do Render.

## 1. O que é
FPS 3D no navegador, todos contra todos, até **30 eliminações**. Lobby 3D com personagem LEGO (masculino/feminino), arena militar no deserto, **4 armas** (Rifle, SMG, Espingarda, AK-47), bots no servidor, ranking persistente. Funciona no PC (teclado e mouse) e no celular (joystick e botões).

- Repositório: https://github.com/armandopawn/jogo
- Online (Render, versão anterior): https://jogo-g5bu.onrender.com
- Stack: Node.js, Express 4, Socket.IO 4 (servidor); HTML/CSS/JS puro + Three.js r128 (cliente). Sem build, sem framework.

## 2. Online (atual) e teste local
A versão atual já está pronta para o **online**: `server.js` escuta em `0.0.0.0` e usa `process.env.PORT`; o `index.html` carrega o Three.js r128 do CDN (`cdnjs`) e, se o CDN falhar, tenta `/three.min.js` (arquivo local criado por `setup-termux.sh`, ignorado pelo git).

**Para publicar:** `.gitignore` na **raiz** (já criado: `node_modules`, `data`, `public/three.min.js`); subir também `public/sfx/`, `public/ak-47.glb` e `public/lego_weapons.glb`; `git add . && git commit && git push`; conferir os Logs do Render ("Servidor rodando na porta ...") e testar. O `ak-47.glb` tem ~12 MB (carrega em segundo plano no lobby; comprimir o modelo deixaria a primeira abertura mais leve).

**Teste local (Termux):** `bash setup-termux.sh` (uma vez) → `npm start` → `http://127.0.0.1:3000`. Funciona igual ao online.

## 3. Estrutura de arquivos
```
package.json        (npm start = node server.js; engines node >= 18)
server.js           servidor autoritativo (tudo que importa é decidido aqui)
setup-termux.sh     baixa three.min.js e roda npm install (só para testar local)
README.md
ZONA-PVP-CONTEXTO.md  este arquivo
public/
  index.html        cliente inteiro (lobby, arena, controles, HUD, rede, áudio)
  shared.js         mapa, armas e colisão, usado pelo servidor E pelo cliente
  three.min.js      (opcional) criado pelo setup-termux.sh; plano B se o CDN falhar
  lego_weapons.glb  modelos LEGO (personagem e armas 1–3)
  ak-47.glb         modelo da AK-47 (arma 4)
  sfx/              lobby.mp3, rifle.mp3, smg.mp3, doze.mp3, reload.mp3, ak.mp3, ak.wav
data/ranking.json   criado em execução (ranking persistente)
```
`shared.js` é UMD: no Node faz `module.exports`, no navegador cria `window.ZP`. Qualquer mudança de mapa ou arma é feita **só ali**.

## 4. Regras que não podem ser quebradas
1. **O servidor decide tudo**: dano, acerto, munição, cadência, pontos, vencedor. O cliente só envia intenção (posição, direção do tiro, trocar arma, recarregar).
2. Nunca criar evento em que o cliente diga "matei fulano" ou "ganhei X pontos".
3. Validar e limitar a frequência de todo evento recebido (`lim(chave, ms)` no servidor).
4. No modo online: `process.env.PORT`, escutar em `0.0.0.0`, Socket.IO na mesma origem (`io()` sem URL), `npm start`. Sem dependências pagas.
5. Não afirmar que algo funciona sem testar. Entregar arquivos completos, não trechos.
6. **Lição aprendida:** o cliente nunca deve depender de evento "volatile" para saber munição, vida ou arma. Esses dados vão dentro do evento `estado`.
7. Não reescrever o que já funciona; mudar só o necessário.

## 5. Servidor (`server.js`)
**Estado:** `P` (Map id → jogador): `{id,nome,bot,g (gênero),x,z,yaw,pitch,hp,w (arma),ammo[4],rel,lf,dead,k,d,...}`. `dead=0` = vivo; outro valor = instante do respawn.

**Loop:** `setInterval` a cada **50 ms (20 Hz)**: termina recargas, respawna mortos (3 s), cura (+3 de vida a cada 5 s sem matar; matar restaura a vida), roda a IA dos bots, envia `estado`. Sem humanos, não envia nada.

**Combate (`fire`)**: valida vivo, partida em andamento, não recarregando, cadência, munição (zerou → o servidor inicia a recarga). Raio do olho (y=1.6) com espalhamento por arma; bloqueia em paredes (`S.wall`); acerta jogadores com duas esferas (y=0.5 e 1.3). Dano cai até 50% com a distância. Espingarda = 8 projéteis somados por alvo.

| # | Arma | Dano | Intervalo | Pente | Recarga | Alcance | Proj. | Espalh. | Disparo |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Rifle | 34 | 300 ms | 20 | 1800 ms | 80 | 1 | .008 | semi (1 por clique) |
| 1 | SMG | 12 | 65 ms | 35 | 1500 ms | 45 | 1 | .03 | automática |
| 2 | Espingarda | 9 x 8 | 800 ms | 8 | 2200 ms | 25 | 8 | .07 | semi |
| 3 | AK-47 | 24 | 105 ms | 30 | 1900 ms | 65 | 1 | .018 | automática |

**Movimento:** o cliente envia a posição; o servidor rejeita se passar da velocidade (6 m/s base; corrida do cliente = 1,55x, que cabe na tolerância `6*dt*1.5+.3`), entrar em parede ou sair do mapa, e responde `fix`. Limite: 1 `mover` a cada 40 ms.

**Bots (`ai`)**: 5 por padrão (`BOTS` no ambiente, máx. 10), nomes `[BOT] Alfa`, `[BOT] Bravo`... Patrulha (waypoints aleatórios), perseguição (alvo visível a até 35 m), ataque (< 26 m; recua se perto, faz strafe, atira em rajadas com erro de mira). Usam a mesma função `fire`. Velocidade 3,5. Sem "procurar cobertura".

**Partida:** vence quem chegar a 30 eliminações. `fim` traz tabela e duração; após 20 s reinicia sozinho, ou qualquer jogador envia `novaPartida`.

**Salas por modo:** `makeRoom(key, withBots)` cria duas partidas independentes: `bots` (5 bots) e `pl` (só jogadores). Cada uma tem o seu `P`, placar, fim de partida, tick de 50 ms e canal Socket.IO (`io.to(key)`). O `entrar` traz `bots: true/false` e coloca o jogador na sala do modo escolhido; um jogador pode estar numa sala e outro entrar na outra (o seletor não trava mais). O primeiro humano numa sala vazia começa a partida zerada. `info` global = `{bots: n, pl: n}` (humanos por sala). O ranking continua global.

**Ranking:** `data/ranking.json` (chave = nome em minúsculas; campos n,k,d,v,m), gravado a cada 10 s se houve mudança; pasta configurável por `DATA_DIR`. **No Render grátis o disco é apagado a cada deploy/reinício.** Nomes não são autenticados: ranking provisório.

**Nome:** regex `^[\p{L}\p{N} _.-]{4,20}$` (cliente e servidor).

## 6. Protocolo Socket.IO
**Cliente → servidor**

| Evento | Dados | Observação |
|---|---|---|
| `entrar` | `{nome, bots, sexo:'m'\|'f', arma:0..3}` | 1 por conexão; `bots:false` = sala só jogadores; `arma` = escolhida no Arsenal (inválida vira 0) |
| `mover` | `{x,z,yaw,pitch}` | ~20/s |
| `atirar` | `{yaw,pitch}` | limitado por arma |
| `recarregar` | — | |
| `arma` | `0..3` | cancela recarga |
| `novaPartida` | — | só quando a partida acabou |
| `sair` | — | volta ao lobby |

**Servidor → cliente**

| Evento | Dados |
|---|---|
| `rank` | `[[nome,elim,mortes,vitórias,partidas], ...]` top 10 |
| `lista` | `[[id,nome,ehBot,gênero], ...]` (só da sua sala; enviada ao entrar/sair) |
| `info` | `{bots, pl}` = humanos em cada sala |
| `erro` | texto |
| `entrou` | id do socket |
| `spawn` / `fix` | `[x,z]` |
| `estado` | `[[id,x,z,yaw,pitch,hp,arma,elim,mortes,munição,recarregando], ...]` (volatile, 20 Hz) |
| `tiro` | `[idAtirador, arma, [[x,y,z], ...impactos]]` |
| `acerto` | `1` se matou, senão `0` (só para quem acertou) |
| `dano` | id de quem atirou (só para quem levou o tiro e sobreviveu; toca o som de dano) |
| `morte` | `[idAssassino, idVítima, arma]` |
| `entrada` / `saiu` | `[id, nome]` |
| `fim` | `{v, tab:[[nome,ehBot,elim,mortes]], dur}` |
| `inicio` | — |

## 7. Mapa (`shared.js`)
Arena quadrada, metade do lado `R=40`. `BOX` = `[centroX, centroZ, largura, profundidade, altura]` (10 blocos grandes e 8 coberturas baixas). 8 pontos de nascimento; o servidor escolhe o mais distante dos vivos. Colisão `S.blocked(x,z,raio)`; raios `S.wall(origem,direção,max)`. Sem pulo.

## 8. Cliente (`public/index.html`)
- **Render:** Three.js r128, geometria compartilhada, materiais em cache (`mat(cor)`), pool de 24 faíscas. Qualidade: baixa (pixel ratio 0,6), média (1, padrão), alta (até 2, com sombras).
- **Modelos:** `parseGLB` próprio lê `lego_weapons.glb` (personagem e armas 1–3) e `ak-47.glb` (arma 4), aplicando a matriz dos nós. **A AK-47 tem o cano em +Z no espaço do glTF; o código gira o grupo 180° em Y quando o eixo mais longo é Z, para a frente apontar para -Z (frente da câmera).** Se trocar o modelo da AK, rever esse trecho (`MD.ak`, rotação por `axis`).
- **Controles PC:** WASD, mouse (Pointer Lock ao clicar), clique atira, R recarrega, 1–4 armas, **Shift corre**, **F11 tela cheia**, ESC volta ao lobby.
- **Controles toque:** joystick à esquerda; arrastar à direita olha; **botão de tiro é gatilho + joystick de mira** (arraste pela distância = gira na hora; manter o dedo deslocado = continua girando); **botão CORRER é alternar** (toque liga/desliga; segurar era impraticável porque os dois polegares já estão ocupados); R; botões 1–4 (dentro do cartão de munição); ⛶ tela cheia; ✕ sai. Ativam sozinhos se `navigator.maxTouchPoints>0` (ajustável no lobby).
- **Corrida:** 1,55x a velocidade, só sem andar de costas; abre o FOV de 75 para 83 e alarga a mira.
- **Tela cheia:** `toggleFS()` (Fullscreen API com prefixo webkit). Botão ⛶ no lobby e na partida e tecla F11. No iPhone o Safari não suporta; mostra aviso para "Adicionar à Tela de Início".
- **HUD (visual novo):** mira FPS padrão (4 traços + ponto central, abre ao andar/correr/atirar); cartão de vida (barra verde/amarela/vermelha, vinheta vermelha pulsando abaixo de 30); cartão de arma/munição (nome, munição grande, vermelha quando baixa, barra de recarga, 4 "pílulas" de arma com a ativa em dourado); placar top 5 com você destacado; mensagem de abate no centro estilo Free Fire (compacta: caveira + nome; a caveira fica laranja a partir de 3 abates seguidos e vermelha a partir de 5); kill feed com silhueta da arma (`WSVG`) e ícone ✖; aviso de entrada/saída; marcador de acerto; flash de dano em vinheta; linha de diagnóstico (`websocket · estado 40ms`). Respeita `safe-area` (notch). No celular o cartão de vida vai para o topo e o de munição fica acima do botão de tiro.
- **Rede:** posição do jogador é local e validada pelo servidor; outros jogadores e bots são interpolados. Ao reconectar, reenvia `entrar` (entra como jogador novo).
- **Lobby / Arsenal:** botão ARSENAL no painel do lobby abre a escolha da arma (4 cartões + barras de dano, cadência, alcance e pente calculadas de `S.W`). A arma escolhida (`lw`, guardada em `localStorage` `zp_arma`) aparece na mão do boneco do lobby (`holdGun(lch, lw)`, com um pulso ao trocar e som de prévia), é enviada no `entrar` (`arma`) e vira a arma inicial da partida. Teclas 1–4 também escolhem dentro do Arsenal. O seletor de modo (`zp_modo`) mostra quantos jogadores há em cada sala e nunca é bloqueado.
- **Cores:** bots vermelhos, outros jogadores em tons de azul/verde/roxo; você em dourado.
- **Áudio:** tiros, recarga e música do lobby são arquivos em `public/sfx/` (a AK usa `ak.wav` como buffer que reinicia a cada disparo); passos, dano e acerto são sintetizados (Web Audio). Créditos: modelos LEGO "LEGO weapons" de Konstantin Chemelev (CC BY 4.0), mantidos no rodapé do lobby.

## 9. Histórico de bugs (para não repetir)
1. Tiro/troca de arma dependiam de evento volatile → **corrigido** (dados dentro de `estado`; servidor recarrega sozinho).
2. Tiro só funcionava com Pointer Lock → **corrigido**.
3. Toque rápido no botão de tiro era perdido entre quadros → **corrigido** (fila `fq`).
4. Botão ✕ coberto pela área de olhar → **corrigido**.
5. **AK-47 invertida (frente para trás):** o parser só rotacionava quando o eixo mais longo era X ou Y; esse modelo tem o eixo longo em Z → **corrigido** (gira 180° em Y).
6. **Mira era uma bolinha** → trocada por mira FPS (traços + ponto).
7. **Botão de correr só funcionava segurando** (impraticável no toque) → **alternar**; adicionado Shift no PC.
8. Modo sem bots travava o seletor quando havia alguém online (`md.disabled`) → **corrigido** com salas separadas por modo (seção 5).

## 10. Ideias / pedidos ainda não integrados
- **Airdrop (pedido da Joana, só no modo sem bots):** avião (`cargo.glb`, som `cargo.mp3`) cruza o mapa e solta o drop; o drop cai no chão; o jogador chega perto, olha e aperta **F** para abrir uma aba e pegar os itens; por enquanto só a AK-47 (`ak-47.glb`, som `ak.mp3`), que ocupa o slot 4; ideia de mira (scope) na AK; máximo de **7 drops por partida**. Nada disso foi implementado ainda.
- (**Salas por modo já feitas** na v2.) Um protótipo separado (também com modo Bomba 3x3 Verde x Preta, 3 rodadas, plantar/desarmar, colete e fumaça) foi entregue como `jogo-main.zip`, sobre a versão antiga; **a Joana decidiu deixar em espera** e não está integrado a esta versão.
- Pulo e plataformas; bots procurando cobertura; reconexão mantendo jogador e pontuação; ranking em banco externo; nomes flutuando sobre jogadores; minimapa; autenticação real.

## 11. Como testar e publicar
- Offline: `bash setup-termux.sh` (uma vez) → `npm start` → `http://127.0.0.1:3000`.
- Online: `git add . && git commit -m "..." && git push`; o Render faz o deploy (seção 2).
- Limitação: o código é verificado com testes automatizados e simulações (servidor com módulos simulados; interface em navegador headless com Three.js simulado). O visual 3D real, o som e a sensação de jogo dependem de teste no aparelho; sempre peça à dona para testar e relatar.

## 12. Como trabalhar com a Joana
- Responder em português do Brasil, de forma direta.
- Entregar arquivos **completos**, dizer exatamente quais substituir, e (quando ela pedir) devolver o projeto em zip com este `.md` dentro da pasta do jogo.
- Ela envia os arquivos atuais; sempre ler o código existente antes de alterar.
- Ao receber um pedido novo, mudar só o necessário.
