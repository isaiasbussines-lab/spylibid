#!/usr/bin/env bash
# Spy Libid — instala o transcritor (Whisper small int8) uma vez por sessão.
# O modelo vem do npm (o HuggingFace é bloqueado pelo proxy). Leva ~1–2 min.
set -e
DIR=${WHISPER_DIR_BASE:-/tmp/spy-whisper}
if [ -f "$DIR/model/package/model.bin" ] && python3 -c "import faster_whisper" 2>/dev/null; then echo "whisper ok"; exit 0; fi
mkdir -p "$DIR/pk" "$DIR/model" && cd "$DIR/pk"
for i in 0 1 2 3; do [ -f skillninja-shortmovie-telop-model-p$i-1.0.0.tgz ] || npm pack @skillninja/shortmovie-telop-model-p$i@1.0.0 --silent >/dev/null; done
cd "$DIR/model" && for f in ../pk/*.tgz; do tar xzf "$f"; done
cd package && cat model.bin.part0 model.bin.part1 model.bin.part2 model.bin.part3 > model.bin && rm -f model.bin.part*
[ "$(sha256sum model.bin | cut -d' ' -f1)" = "$(cat model.sha256)" ] || { echo "sha256 do modelo não confere"; exit 1; }
timeout 300 pip install --break-system-packages -q --timeout 30 faster-whisper
echo "whisper ok"
