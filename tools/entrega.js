// Spy Libid — entrega pelo navegador: gera o HTML estático, publica no site (GitHub) e manda pro Telegram.
// Rodar com javascript_tool numa aba em https://api.telegram.org/robots.txt.
// Antes deste código, cole as constantes (nunca grave tokens em arquivo, banco ou relatório):
//   const D = <JSON do relatório v2>, HOJE = "AAAA-MM-DD";
//   const TG_TOKEN = "...", TG_CHAT = "...";   // Telegram
//   const GH_TOKEN = "...";                     // token do GitHub (fine-grained, só o repo spylibid). "" = não publicar no site
//   const SO = "tudo";                          // "tudo" | "site" | "telegram"
await (async () => {
  const REPO = 'isaiasbussines-lab/spylibid', SITE = 'https://isaiasbussines-lab.github.io/spylibid/';
  const out = {};
  const tpl = await (await fetch(`https://raw.githubusercontent.com/${REPO}/main/tools/template.html?t=${Date.now()}`)).text();
  if (!/__RADAR_DATA__/.test(tpl)) throw new Error('template não carregou');
  const render = async (data) => {
    const json = JSON.stringify(data).replace(/<\//g, '<\\/');
    const page = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"></head><body>' + tpl.replace('__RADAR_DATA__', () => json) + '</body></html>';
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px;height:900px;border:0';
    (document.body || document.documentElement).appendChild(fr);
    await new Promise((r) => { fr.onload = r; fr.srcdoc = page; });
    await new Promise((r) => setTimeout(r, 400));
    const doc = fr.contentDocument; doc.querySelectorAll('script').forEach((s) => s.remove());
    doc.title = 'Spy Libid · ' + (data.data || '');
    const html = '<!doctype html>\n' + doc.documentElement.outerHTML; fr.remove();
    if (!/<section/.test(html) || /Carregando…/.test(html)) throw new Error('render falhou');
    return html;
  };
  const comBase = (base) => ({ ...D, arquivo: (D.arquivo || []).map((a) => ({ ...a, href: a.href ? base + a.href : a.href })) });
  const htmlIndex = await render(D);
  const htmlDia = await render(comBase('../'));
  out.render = htmlIndex.length;

  if (SO !== 'telegram' && GH_TOKEN) {
    const b64 = (s) => { const u = new TextEncoder().encode(s); let b = ''; for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(b); };
    const H = { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    const put = async (path, content) => {
      const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
      const cur = await fetch(url + `?ref=main&t=${Date.now()}`, { headers: H });
      const sha = cur.ok ? (await cur.json()).sha : undefined;
      const r = await fetch(url, { method: 'PUT', headers: H, body: JSON.stringify({ message: `Spy Libid ${HOJE}: ${path}`, content: b64(content), branch: 'main', sha, committer: { name: 'Spy Libid', email: 'spylibid@users.noreply.github.com' } }) });
      return r.status;
    };
    out.github = {
      [`reports/${HOJE}.json`]: await put(`reports/${HOJE}.json`, JSON.stringify(D, null, 1)),
      [`reports/${HOJE}.html`]: await put(`reports/${HOJE}.html`, htmlDia),
      'index.html': await put('index.html', htmlIndex),
    };
  }

  if (SO !== 'site') {
    const base = `https://api.telegram.org/bot${TG_TOKEN}`;
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const linhas = (D.modelar || []).map((c, i) => `${i + 1}. <b>${esc(c.titulo)}</b> · ${esc(c.marca)}\n${esc(c.formato)} · ${esc(c.numeros)}\n🎯 <i>${esc((c.nossa_versao || {}).hook)}</i>\n<a href="${esc(c.link)}">ver na Biblioteca</a>`).join('\n\n');
    const txt = `<b>🕵️ Spy Libid · ${esc(D.data)}</b>\n<b>${esc(D.manchete)}</b>\n\n${linhas}\n\n🌐 <a href="${SITE}">Abrir o relatório no site</a>`;
    const m = await (await fetch(`${base}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG_CHAT, text: txt.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }) })).json();
    const fd = new FormData(); fd.append('chat_id', TG_CHAT); fd.append('caption', `Spy Libid ${D.data}: abre no navegador`);
    fd.append('document', new Blob([htmlIndex], { type: 'text/html' }), `SpyLibid-${HOJE}.html`);
    const d = await (await fetch(`${base}/sendDocument`, { method: 'POST', body: fd })).json();
    out.telegram = { msg: m.ok, doc: d.ok, erro: ((m.description || '') + ' ' + (d.description || '')).trim() };
  }
  return out;
})();
