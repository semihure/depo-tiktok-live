#!/bin/bash
# macOS başlatıcı: çift tıkla
cd "$(dirname "$0")"
# nvm varsa en yeni Node 20+ sürümünü kullan (TikTok bağlantısı Node 20 ister)
for d in $(ls -d "$HOME"/.nvm/versions/node/v2[0-9]* 2>/dev/null | sort -V -r); do PATH="$d/bin:$PATH"; break; done
if ! command -v node >/dev/null; then echo "Node.js bulunamadı: https://nodejs.org"; read -r; exit 1; fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then echo "Uyarı: Node $(node -v) eski, TikTok bağlantısı için Node 20+ kur. Demo yine çalışır."; fi
[ -d node_modules ] || npm install --no-audit --no-fund
node server.js &
SERVER=$!
sleep 2
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then
  "$CHROME" --app="http://localhost:3200/?clean" --window-size=540,960 --autoplay-policy=no-user-gesture-required >/dev/null 2>&1 &
else
  open "http://localhost:3200/?clean"
fi
open "http://localhost:3200"
wait $SERVER
