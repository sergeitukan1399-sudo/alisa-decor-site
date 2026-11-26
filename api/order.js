// Vercel serverless function: receives an order from the site and posts it to Telegram.
// Needs env vars TG_TOKEN (bot token from @BotFather) and TG_CHAT_ID (group id).
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
const lei = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ') + ' лей';

module.exports = async (req, res) => {
  const token = (process.env.TG_TOKEN || '').trim(), chat = (process.env.TG_CHAT_ID || '').trim();
  if (req.method === 'GET') {
    // Diagnostics: never returns the token, never sends a message.
    const out = { function: 'ok', TG_TOKEN: token ? 'set' : 'MISSING', TG_CHAT_ID: chat ? chat : 'MISSING' };
    if (token) {
      try { const r = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json(); out.bot = r.ok ? '@' + r.result.username : 'ERROR: ' + r.description; } catch (e) { out.bot = 'network error'; }
      if (chat) { try { const r = await (await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chat)}`)).json(); out.group = r.ok ? r.result.title || r.result.type : 'ERROR: ' + r.description; } catch (e) { out.group = 'network error'; } }
    }
    res.setHeader('Cache-Control', 'no-store'); res.status(200).json(out); return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  if (!token || !chat) { res.status(503).json({ ok: false, error: 'not_configured' }); return; }

  let o = req.body;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  if (!o || typeof o !== 'object' || o.website) { res.status(400).json({ ok: false }); return; }

  const name = cut(o.name, 80).trim(), phone = cut(o.phone, 40).trim();
  const items = Array.isArray(o.items) ? o.items.slice(0, 30) : [];
  if (!name || phone.replace(/\D/g, '').length < 6 || !items.length) { res.status(400).json({ ok: false, error: 'invalid' }); return; }

  const hd = req.headers || {};
  const host = String(hd['x-forwarded-host'] || hd.host || 'alisa-shop.vercel.app').split(',')[0].trim().replace(/[^a-z0-9.:-]/gi, '');
  const site = 'https://' + host + '/';
  const sid = v => /^[a-z0-9-]{1,40}$/i.test(String(v || '')) ? String(v) : '';
  const num = cut(o.num, 12).replace(/\D/g, '') || String(Date.now()).slice(-5);
  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Chisinau', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const tel = phone.replace(/[^\d+]/g, '');
  const msgr = { Instagram: 'Instagram', Telegram: 'Telegram', WhatsApp: 'WhatsApp', Viber: 'Viber', 'Звонок': 'позвонить' }[o.msgr] || cut(o.msgr, 20);
  const pickup = o.how === 'pickup';

  const lines = [
    `🎈 <b>Новый заказ №${esc(num)}</b>`,
    esc(when),
    '',
    `👤 ${esc(name)}`,
    `📞 ${esc(tel)}`,
    `💬 Связаться: ${esc(msgr)}`,
    '',
    '🛍 <b>Состав заказа:</b>',
    ...items.map((it, i) => {
      const q = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
      const color = cut(it.color, 60);
      const id = sid(it.id), nm = esc(cut(it.name, 120));
      return `${i + 1}. ${id ? `<a href="${site}#product/${id}">${nm}</a>` : nm} — ${q} шт., ${lei(it.sum)}` + (color ? `\n   Цвет: ${esc(color)}` : '');
    }),
    '',
    `💰 <b>Итого: ${lei(o.sum)}</b>` + (pickup ? '' : '\n   + доставка (стоимость уточнить)'),
    '',
    pickup ? '🏠 Самовывоз — ул. Ленина, 143' : `🚚 Доставка: ${esc(cut(o.town, 60))}, ${esc(cut(o.addr, 200))}`,
    `💳 Оплата: ${o.pay === 'card' ? 'картой курьеру' : 'наличными курьеру'}`,
  ];
  const payload = ['n=' + num].concat(items.map(it => {
    const id = sid(it.id); if (!id) return '';
    const q = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    return [id, q, cut(it.color, 40).replace(/[~|]/g, ' ')].join('~');
  }).filter(Boolean)).join('|');
  if (payload.includes('~')) lines.push('', `🛒 <a href="${site}#order/${encodeURIComponent(payload)}">Открыть заказ с фото</a>`);
  const comm = cut(o.comm, 600).trim();
  if (comm) lines.push('', `📝 Комментарий: «${esc(comm)}»`);

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: '✅ Принят', callback_data: 'acc' }, { text: '❌ Отменён', callback_data: 'cancel' }]] } }),
    });
    const j = await r.json();
    if (!j.ok) { res.status(502).json({ ok: false, error: 'telegram: ' + j.description }); return; }
    res.status(200).json({ ok: true, num });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'network' });
  }
};
