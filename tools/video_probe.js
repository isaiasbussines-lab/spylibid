// Spy Libid — sonda de vídeo. Rodar via javascript_tool numa aba aberta DIRETO no arquivo do vídeo
// (a URL video.*.fbcdn.net/....mp4 tirada de video.src na Biblioteca de Anúncios).
// Antes deste código, cole UMA linha com o pedido:
//   const ACAO = "info";            -> carrega o áudio; devolve {dur, chunks}
//   const ACAO = "audio", K = 0;    -> devolve 'ULAW|K|<base64>|END' (23 s de áudio 8 kHz µ-law, trecho K)
//   const ACAO = "frames";          -> devolve 'IMG|data:image/jpeg;base64,...|END' (folha com 12 quadros)
// Saídas grandes são salvas em arquivo pelo app; o decode_probe.py lê esses arquivos.
await (async () => {
  const SEG = 23;
  const v = document.querySelector('video');
  if (ACAO === 'info' || !window.__u) {
    const buf = await (await fetch(location.href)).arrayBuffer();
    const ab = await new OfflineAudioContext(1, 16000, 16000).decodeAudioData(buf);
    const oc = new OfflineAudioContext(1, Math.ceil(ab.duration * 8000), 8000);
    const s = oc.createBufferSource(); s.buffer = ab; s.connect(oc.destination); s.start();
    const f = (await oc.startRendering()).getChannelData(0);
    const u = new Uint8Array(f.length);
    for (let i = 0; i < f.length; i++) {
      let x = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767); const sign = x < 0 ? 0x80 : 0; if (x < 0) x = -x;
      x = Math.min(x, 32635) + 132; let e = 7; for (let m = 0x4000; (x & m) === 0 && e > 0; m >>= 1) e--;
      u[i] = ~(sign | (e << 4) | ((x >> (e + 3)) & 0x0F)) & 0xFF;
    }
    window.__u = u; window.__dur = ab.duration;
    if (ACAO === 'info') return { dur: Math.round(ab.duration), chunks: Math.ceil(u.length / (SEG * 8000)) };
  }
  if (ACAO === 'audio') {
    const per = SEG * 8000, u8 = window.__u.subarray(K * per, (K + 1) * per); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return 'ULAW|' + K + '|' + btoa(s) + '|END';
  }
  if (ACAO === 'frames') {
    v.pause(); v.muted = true;
    if (!v.duration) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
    const d = v.duration, ts = [0.3, 1.5, 3, 5, 8].concat([0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 0.98].map((p) => +(d * p).toFixed(1)));
    const cols = 6, w = 160, h = Math.round(w * v.videoHeight / v.videoWidth);
    const C = document.createElement('canvas'); C.width = cols * w; C.height = Math.ceil(ts.length / cols) * h;
    const g = C.getContext('2d'); g.font = 'bold 14px sans-serif';
    for (let i = 0; i < ts.length; i++) {
      v.currentTime = Math.min(ts[i], d - 0.05); await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
      const x = (i % cols) * w, y = Math.floor(i / cols) * h; g.drawImage(v, x, y, w, h);
      g.fillStyle = '#000a'; g.fillRect(x, y, 46, 18); g.fillStyle = '#ff0'; g.fillText(Math.round(ts[i]) + 's', x + 3, y + 14);
    }
    return 'IMG|' + C.toDataURL('image/jpeg', 0.8) + '|END';
  }
  return 'ACAO desconhecida';
})();
