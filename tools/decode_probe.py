#!/usr/bin/env python3
"""Spy Libid — junta o que o video_probe.js devolveu e transcreve.

Uso:
  python3 -I decode_probe.py NOME arquivo1 [arquivo2 ...]
Cada arquivo é a saída salva de um javascript_tool (JSON [{type,text}]) ou um .txt com o texto puro.
Gera NOME.wav (de todos os trechos ULAW), NOME.jpg (folha de quadros, se houver) e NOME.txt (transcrição),
na pasta atual. A transcrição usa o modelo baixado pelo setup_whisper.sh (pasta WHISPER_DIR).
"""
import base64, json, os, re, subprocess, sys, wave

WHISPER_DIR = os.environ.get('WHISPER_DIR', '/tmp/spy-whisper/model/package')


def texto(path):
    raw = open(path, encoding='utf-8', errors='replace').read()
    try:
        d = json.loads(raw)
        if isinstance(d, list):
            return ''.join(x.get('text', '') for x in d if isinstance(x, dict))
        if isinstance(d, str):
            return d
    except Exception:
        pass
    return raw


def main():
    nome, arquivos = sys.argv[1], sys.argv[2:]
    partes, img = {}, None
    for f in arquivos:
        t = texto(f)
        for k, b in re.findall(r'ULAW\|(\d+)\|([A-Za-z0-9+/=]+)\|END', t):
            partes[int(k)] = base64.b64decode(b)
        m = re.search(r'IMG\|data:image/jpeg;base64,([A-Za-z0-9+/=]+)\|END', t)
        if m:
            img = base64.b64decode(m.group(1))
    if img:
        open(nome + '.jpg', 'wb').write(img)
        print('quadros:', nome + '.jpg')
    if not partes:
        return
    ks = sorted(partes)
    raw = b''.join(partes[k] for k in range(ks[-1] + 1) if k in partes)
    open(nome + '.ulaw', 'wb').write(raw)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'mulaw', '-ar', '8000', '-ac', '1',
                    '-i', nome + '.ulaw', '-ar', '16000', nome + '.wav'], check=True)
    print('áudio:', nome + '.wav', round(len(raw) / 8000, 1), 's (trechos', ks, ')')
    try:
        import numpy as np
        from faster_whisper import WhisperModel
    except ImportError:
        print('sem faster-whisper: rode setup_whisper.sh'); return
    if not os.path.exists(os.path.join(WHISPER_DIR, 'model.bin')):
        print('modelo não encontrado em', WHISPER_DIR, '- rode setup_whisper.sh'); return
    w = wave.open(nome + '.wav')
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    m = WhisperModel(WHISPER_DIR, device='cpu', compute_type='int8', cpu_threads=os.cpu_count() or 2)
    segs, _ = m.transcribe(a, language='pt', beam_size=5,
                           initial_prompt='Anúncio sobre menopausa, libido, calorão, secura, WhatsApp.')
    with open(nome + '.txt', 'w') as out:
        for s in segs:
            out.write(f'[{s.start:5.1f}-{s.end:5.1f}] {s.text.strip()}\n')
    print('transcrição:', nome + '.txt')
    print(open(nome + '.txt').read())


if __name__ == '__main__':
    main()
