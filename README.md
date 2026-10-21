# Zona PvP

FPS 3D multiplayer para navegador (todos contra todos, vence quem chegar a 30 abates). 4 armas (Rifle, SMG, Espingarda, AK-47), bots no servidor, ranking, lobby com **Arsenal** para escolher a arma do seu personagem. Leia o `ZONA-PVP-CONTEXTO.md` para o contexto completo do projeto.

## Modos (salas separadas)
- **Com bots**: 5 bots controlados pelo servidor.
- **Só jogadores**: sem bots.

Cada modo é uma partida independente. Um jogador pode estar num modo e outro entrar no outro modo a qualquer momento (o seletor nunca trava). O seletor mostra quantos jogadores há em cada modo.

## Online (Render)
1. Suba tudo no GitHub (`git add . && git commit -m "..." && git push`), incluindo `public/sfx/`, `public/ak-47.glb` e `public/lego_weapons.glb`.
2. O Render faz o deploy sozinho (Build: `npm install`, Start: `npm start`). Nos Logs deve aparecer `Servidor rodando na porta ...`.
3. O servidor usa `process.env.PORT` e escuta em `0.0.0.0`. O Three.js vem do CDN (cdnjs); se o CDN falhar, o jogo tenta `public/three.min.js`.

## Testar local (Termux)
1. `pkg install nodejs-lts curl` (uma vez)
2. `bash setup-termux.sh` (baixa o Three.js para `public/three.min.js` e instala as dependências)
3. `npm start` e abra `http://127.0.0.1:3000`

## Controles
- **PC:** WASD mover · mouse mirar · clique atira · R recarrega · 1–4 trocam de arma · **Shift corre** · **F11 tela cheia** · ESC volta ao lobby.
- **Celular:** joystick à esquerda · arraste à direita para olhar · botão de tiro também é joystick de mira · botão CORRER (toque liga/desliga) · R recarrega · botões 1–4 trocam de arma · ⛶ tela cheia · ✕ sai.
- **Lobby:** botão ARSENAL (ou teclas 1–4 dentro dele) escolhe a arma que o boneco segura e com a qual você começa a partida. Arraste o boneco para girar.

## Arquitetura
- `public/shared.js`: mapa, colisões e estatísticas das armas (usado pelo servidor e pelo cliente).
- `server.js`: simulação autoritativa por sala (bots, vida, munição, dano).
- `public/index.html`: renderização, controles, HUD, modelos e sons.
