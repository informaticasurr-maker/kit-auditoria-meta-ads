#!/usr/bin/env bash
# Lanzador de un solo clic para Linux y macOS

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "====================================================="
echo "⚡ Iniciando Kit de Auditoría Meta Ads (Modo Local)..."
echo "====================================================="

PORT=3005
node server.js &
SERVER_PID=$!

sleep 1

URL="http://localhost:$PORT"
if command -v xdg-open > /dev/null; then
  xdg-open "$URL"
elif command -v open > /dev/null; then
  open "$URL"
else
  echo "Abre tu navegador en: $URL"
fi

echo "Presiona Ctrl+C para detener el servidor."

trap "kill $SERVER_PID 2>/dev/null; exit 0" INT TERM EXIT
wait $SERVER_PID
