await (async () => {
  // RADAR — extrator diário da Biblioteca de Anúncios da Meta (rodar na página de resultados já aberta).
  // O agente cola ANTES deste código uma linha de parâmetros, por exemplo:
  //   const SLUG = "menocare", QI = 0, TODAY = "2026-10-30";
  // SLUG = concorrente (ou "_varredura-N"), QI = índice da busca, TODAY = data de hoje (America/Sao_Paulo).
  // Guarda os IDs já vistos no localStorage deste navegador (chave radar:SLUG:QI) e devolve só o que mudou.
  const MAX_PAGES = 6, COPY = 220, TOP = 6, MAX_NEW = 15;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 30; i++) { if (/resultado/.test(document.body.innerText)) break; await sleep(500); }
  await sleep(1500);
  let last = 0, exhausted = false;
  for (let p = 0; p < MAX_PAGES; p++) {
    window.scrollTo(0, document.body.scrollHeight); await sleep(2200);
    const btn = [...document.querySelectorAll('div[role="button"],a[role="button"],button')].find((b) => /^\s*Ver mais\s*$/i.test(b.innerText || ''));
    if (btn) { btn.click(); await sleep(2500); }
    const n = (document.body.innerText.match(/Identificação da biblioteca:/g) || []).length;
    if (n === last && !btn) { exhausted = true; break; } last = n;
  }
  const M = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const iso = (s) => { const m = s.match(/(\d{1,2}) de (\w{3}) de (\d{4})/); return m ? `${m[3]}-${String(M[m[2]] || 0).padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
  const text = document.body.innerText;
  const totalTxt = (text.match(/~?[\d\.]+ resultados?/) || [''])[0];
  const totalNum = parseInt(totalTxt.replace(/\D/g, '') || '0', 10);
  const ads = text.split(/Identificação da biblioteca:\s*/).slice(1).map((chunk) => {
    const lines = chunk.split('\n').map((l) => l.trim()).filter((l) => l && l !== '​');
    const id = (lines[0] || '').replace(/\D/g, '');
    const startRaw = (chunk.match(/Veiculação iniciada em ([^\n]+)/) || [])[1] || '';
    const variants = +((chunk.match(/(\d+) anúncios usam esse criativo/) || [])[1] || 1);
    const pIdx = lines.indexOf('Patrocinado');
    const page = pIdx > 0 ? lines[pIdx - 1] : '';
    let body = pIdx >= 0 ? lines.slice(pIdx + 1) : [];
    const endIdx = body.findIndex((l) => /^(Ativo|Inativo|Ver mais|Status do sistema)$/.test(l));
    if (endIdx >= 0) body = body.slice(0, endIdx);
    const durM = body.join('\n').match(/0:00 \/ (\d+):(\d+)/);
    const video = durM ? +durM[1] * 60 + +durM[2] : 0;
    const domIdx = body.findIndex((l) => /^[A-Z0-9.\-]+\.(COM|BR|NET|ORG|APP|SHOP|STORE|CO|IO)(\.[A-Z]{2})?$/.test(l) || /^(WHATSAPP|API\.WHATSAPP\.COM|INSTAGRAM\.COM)$/.test(l));
    const dom = domIdx >= 0 ? body[domIdx].toLowerCase() : '';
    const copy = (domIdx >= 0 ? body.slice(0, domIdx) : body).filter((l) => !/^0:00 \/ /.test(l) && !/^(INSTAGRAM\.COM|Visit Instagram Profile|Send WhatsApp Message)$/.test(l)).join(' / ');
    const tail = domIdx >= 0 ? body.slice(domIdx + 1) : [];
    const cta = tail.find((l) => /Saiba mais|Comprar agora|Enviar mensagem|Shop Now|Learn More|Ver detalhes|Fale conosco|Agendar|Acessar o perfil|Send WhatsApp|See Details|Cadastre-se|Baixar/i.test(l)) || '';
    const head = tail.filter((l) => l !== cta).slice(0, 2).join(' | ').slice(0, 140);
    const wa = /whatsapp/i.test(dom + cta) || /api\.whatsapp|WHATSAPP/.test(chunk);
    return { id, page, start: iso(startRaw), variants, video, dom, head,
      funil: wa ? 'whatsapp' : (dom && !/instagram/.test(dom) ? 'site' : 'outro'),
      entrega: /pague (somente )?na entrega|pagamento na entrega/i.test(chunk), copy };
  }).filter((a) => a.id);

  // ---- memória local por concorrente/busca ----
  const key = `radar:${SLUG}:${QI}`;
  let mem = {};
  try { mem = JSON.parse(localStorage.getItem(key) || '{}'); } catch (err) { mem = {}; }
  const ids = mem.ids || {};
  const runs = (mem.runs || []).filter((d) => d !== TODAY);
  const prevRun = runs.length ? runs[runs.length - 1] : null;
  const knownPages = new Set(mem.pages || []);
  const fresh = !prevRun;
  const d48 = new Date(TODAY + 'T12:00:00'); d48.setDate(d48.getDate() - 2);
  const lim48 = d48.toISOString().slice(0, 10);
  for (const a of ads) {
    if (!ids[a.id]) ids[a.id] = { s: a.start, f: TODAY, l: TODAY, p: a.page };
    else ids[a.id].l = TODAY;
  }
  const isNew = (a) => (fresh ? a.start >= lim48 : ids[a.id].f === TODAY);
  const novos = ads.filter(isNew);
  const completo = exhausted || (totalNum > 0 && ads.length >= totalNum);
  const sumidos = prevRun ? Object.entries(ids).filter(([, v]) => v.l === prevRun).map(([k, v]) => ({ id: k, page: v.p, start: v.s })) : [];
  const pagesNow = [...new Set(ads.map((a) => a.page))];
  const paginasNovas = fresh ? [] : pagesNow.filter((p) => !knownPages.has(p));
  const d30 = new Date(TODAY + 'T12:00:00'); d30.setDate(d30.getDate() - 30); const lim30 = d30.toISOString().slice(0, 10);
  for (const [k, v] of Object.entries(ids)) if (v.l < lim30) delete ids[k];
  try { localStorage.setItem(key, JSON.stringify({ ids, runs: [...runs, TODAY].slice(-60), pages: [...new Set([...knownPages, ...pagesNow])] })); } catch (err) {}

  // ---- resumo ----
  const count = (arr, f) => arr.reduce((o, a) => { const k = f(a); o[k] = (o[k] || 0) + 1; return o; }, {});
  const groups = {};
  for (const a of ads) {
    const k = a.copy.slice(0, 120).toLowerCase();
    const g = groups[k] = groups[k] || { n: 0, pages: new Set(), durs: new Set(), first: a.start, last: a.start, funil: a.funil, dom: a.dom, head: a.head, entrega: a.entrega, copy: a.copy.slice(0, COPY), maxVar: 1 };
    g.n++; g.pages.add(a.page); if (a.video) g.durs.add(a.video); g.maxVar = Math.max(g.maxVar, a.variants);
    if (a.start < g.first) g.first = a.start; if (a.start > g.last) g.last = a.start;
  }
  const top = Object.values(groups).sort((x, y) => y.n - x.n).slice(0, TOP)
    .map((g) => ({ ...g, pages: [...g.pages].slice(0, 4), durs: [...g.durs].sort((x, y) => x - y).slice(0, 6) }));
  const names = new Set(pagesNow);
  const pageIds = {};
  document.querySelectorAll('a[href*="facebook.com/"]').forEach((a) => { const t = (a.innerText || '').trim(); const m = a.href.match(/facebook\.com\/([^/?#]+)/); if (t && names.has(t) && m && !pageIds[t]) pageIds[t] = m[1]; });
  const inicio = count(ads, (a) => a.start);
  const ultimos10 = Object.fromEntries(Object.entries(inicio).sort().slice(-10));
  return {
    slug: SLUG, qi: QI, hoje: TODAY, total: totalTxt, totalNum, extraidos: ads.length, completo,
    memoria: fresh ? 'primeira leitura (novos = iniciados nas últimas 48h)' : `comparado com ${prevRun}`,
    novosCount: novos.length, iniciados48h: ads.filter((a) => a.start >= lim48).length,
    sumidosCount: sumidos.length, sumidosConfiavel: completo,
    paginas: count(ads, (a) => a.page), paginasNovas, pageIds,
    funil: count(ads, (a) => a.funil), formato: count(ads, (a) => (a.video ? (a.video > 180 ? 'video_longo' : 'video') : 'imagem')),
    entrega: ads.filter((a) => a.entrega).length, inicioPorDia: ultimos10, criativosUnicos: Object.keys(groups).length,
    novos: novos.slice(0, MAX_NEW).map((a) => ({ id: a.id, page: a.page, start: a.start, video: a.video, funil: a.funil, entrega: a.entrega, head: a.head, copy: a.copy.slice(0, COPY) })),
    sumidos: sumidos.slice(0, 10),
    top,
  };
})();
