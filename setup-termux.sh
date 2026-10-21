#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
echo "== Zona PvP: preparação para testar local =="
command -v node >/dev/null 2>&1 || { echo "Instale Node.js no Termux: pkg install nodejs-lts"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "Instale curl: pkg install curl"; exit 1; }
if [ ! -f public/three.min.js ]; then
  echo "Baixando Three.js uma única vez para permitir jogar sem internet depois..."
  curl -fL --retry 3 "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" -o public/three.min.js
fi
npm install --omit=dev
echo
echo "Preparado! Para jogar, execute: npm start"
echo "Depois da preparação, o jogo roda localmente em http://127.0.0.1:3000 e não precisa de internet."
