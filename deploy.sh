#!/bin/bash
set -e

SKIP_UI=false

while getopts "s" opt; do
  case $opt in
    s) SKIP_UI=true ;;
  esac
done

if [ "$SKIP_UI" = false ]; then
  echo "=== Building UI ==="
  cd client && npm run build

  echo "=== Copying to firmware ==="
  rm -rf ../firmware/data/*
  cp -r dist/* ../firmware/data/
  cd ..
fi

echo "=== Uploading firmware ==="
cd firmware
pio run -t upload -e esp32dev

if [ "$SKIP_UI" = false ]; then
  echo "=== Uploading filesystem ==="
  pio run -t uploadfs -e esp32dev
fi

echo "=== Starting serial monitor ==="
pio device monitor -b 115200
