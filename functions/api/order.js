// Cloudflare Pages Function: POST /api/order -> Telegram. GET /api/order -> diagnostics.
// Env vars (Settings → Variables and Secrets): TG_TOKEN, TG_CHAT_ID.
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
const lei = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ') + ' лей';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const sid = v => /^[a-z0-9-]{1,40}$/i.test(String(v || '')) ? String(v) : '';

export async function onRequest({ request, env }) {
  const token = (env.TG_TOKEN || '').trim(), chat = (env.TG_CHAT_ID || '').trim();
  const url = new URL(request.url);
  const tg = (m, b) => fetch(`https://api.telegram.org/bot${token}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json()).catch(() => ({ ok: false, description: 'network error' }));

  if (request.method === 'GET') {
    const out = { function: 'ok', host: 'cloudflare', TG_TOKEN: token ? 'set' : 'MISSING', TG_CHAT_ID: chat || 'MISSING' };
    if (token) {
      const me = await tg('getMe', {}); out.bot = me.ok ? '@' + me.result.username : 'ERROR: ' + me.description;
      if (chat) { const c = await tg('getChat', { chat_id: chat }); out.group = c.ok ? (c.result.title || c.result.type) : 'ERROR: ' + c.description; }
    }
    return json(out);
  }
  if (request.method !== 'POST') return json({ ok: false }, 405);
  if (!token || !chat) return json({ ok: false, error: 'not_configured' }, 503);

  let o; try { o = await request.json(); } catch (e) { o = null; }
  if (!o || typeof o !== 'object' || o.website) return json({ ok: false }, 400);
  const name = cut(o.name, 80).trim(), phone = cut(o.phone, 40).trim();
  const items = Array.isArray(o.items) ? o.items.slice(0, 30) : [];
  if (!name || phone.replace(/\D/g, '').length < 6 || !items.length) return json({ ok: false, error: 'invalid' }, 400);

  const site = url.origin + '/';
  const num = cut(o.num, 12).replace(/\D/g, '') || String(Date.now()).slice(-5);
  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Chisinau', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const tel = phone.replace(/[^\d+]/g, '');
  const msgr = { Instagram: 'Instagram', Telegram: 'Telegram', WhatsApp: 'WhatsApp', Viber: 'Viber', 'Звонок': 'позвонить' }[o.msgr] || cut(o.msgr, 20);
  const pickup = o.how === 'pickup';
  const lines = [
    `🎈 <b>Новый заказ №${esc(num)}</b>`, esc(when), '',
    `👤 ${esc(name)}`, `📞 ${esc(tel)}`, `💬 Связаться: ${esc(msgr)}`, '',
    '🛍 <b>Состав заказа:</b>',
    ...items.map((it, i) => {
      const q = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1)), color = cut(it.color, 60), id = sid(it.id), nm = esc(cut(it.name, 120));
      return `${i + 1}. ${id ? `<a href="${site}#product/${id}">${nm}</a>` : nm} — ${q} шт., ${lei(it.sum)}` + (color ? `\n   Цвет: ${esc(color)}` : '');
    }),
    '', `💰 <b>Итого: ${lei(o.sum)}</b>` + (pickup ? '' : '\n   + доставка (стоимость уточнить)'), '',
    pickup ? '🏠 Самовывоз — ул. Ленина, 143' : `🚚 Доставка: ${esc(cut(o.town, 60))}, ${esc(cut(o.addr, 200))}`,
    `💳 Оплата: ${o.pay === 'card' ? 'картой курьеру' : 'наличными курьеру'}`,
  ];
  const payload = ['n=' + num].concat(items.map(it => { const id = sid(it.id); if (!id) return ''; const q = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1)); return [id, q, cut(it.color, 40).replace(/[~|]/g, ' ')].join('~'); }).filter(Boolean)).join('|');
  if (payload.includes('~')) lines.push('', `🛒 <a href="${site}#order/${encodeURIComponent(payload)}">Открыть заказ с фото</a>`);
  const comm = cut(o.comm, 600).trim();
  if (comm) lines.push('', `📝 Комментарий: «${esc(comm)}»`);

  const j = await tg('sendMessage', { chat_id: chat, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: '✅ Принят', callback_data: 'acc' }, { text: '❌ Отменён', callback_data: 'cancel' }]] } });
  if (!j.ok) return json({ ok: false, error: 'telegram: ' + j.description }, 502);
  return json({ ok: true, num });
}
