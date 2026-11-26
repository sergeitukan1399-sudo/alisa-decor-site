// Telegram webhook: handles "Принят / Выполнен / Отменён" buttons under order messages.
// GET /api/tg?setup=1 registers this URL as the bot webhook (uses TG_TOKEN on the server).
const crypto = require('crypto');
const KB = {
  start: [[{ text: '✅ Принят', callback_data: 'acc' }, { text: '❌ Отменён', callback_data: 'cancel' }]],
  accepted: [[{ text: '📦 Выполнен', callback_data: 'done' }, { text: '❌ Отменён', callback_data: 'cancel' }]],
};
const LABEL = { acc: '✅ Принят', done: '📦 Выполнен', cancel: '❌ Отменён' };

module.exports = async (req, res) => {
  const token = (process.env.TG_TOKEN || '').trim(), chat = (process.env.TG_CHAT_ID || '').trim();
  if (!token) { res.status(503).json({ ok: false, error: 'not_configured' }); return; }
  const secret = crypto.createHash('sha256').update('alisa-webhook:' + token).digest('hex').slice(0, 48);
  const api = (m, b) => fetch(`https://api.telegram.org/bot${token}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json()).catch(() => ({ ok: false }));

  if (req.method === 'GET') {
    const hd = req.headers || {};
    const host = String(hd['x-forwarded-host'] || hd.host || '').split(',')[0].trim();
    if (req.query && req.query.setup) {
      const r = await api('setWebhook', { url: `https://${host}/api/tg`, secret_token: secret, allowed_updates: ['callback_query'], drop_pending_updates: true });
      res.status(200).json({ webhook: r.ok ? 'установлен' : 'ошибка: ' + r.description, url: `https://${host}/api/tg` }); return;
    }
    const r = await api('getWebhookInfo', {});
    res.status(200).json({ webhook: r.ok && r.result.url ? r.result.url : 'не установлен', last_error: r.ok ? r.result.last_error_message || null : null }); return;
  }

  if ((req.headers || {})['x-telegram-bot-api-secret-token'] !== secret) { res.status(401).end(); return; }
  let u = req.body; if (typeof u === 'string') { try { u = JSON.parse(u); } catch (e) { u = {}; } }
  const cq = u && u.callback_query;
  if (!cq || !cq.message || !LABEL[cq.data]) { res.status(200).end(); return; }
  const msg = cq.message;
  if (chat && String(msg.chat.id) !== chat) { await api('answerCallbackQuery', { callback_query_id: cq.id }); res.status(200).end(); return; }

  const text = msg.text || '';
  const finished = /\n(📦 Выполнен|❌ Отменён) —/.test(text);
  if (finished || (cq.data === 'acc' && /\n✅ Принят —/.test(text)) || (cq.data === 'done' && !/\n✅ Принят —/.test(text))) {
    await api('answerCallbackQuery', { callback_query_id: cq.id, text: 'Статус уже изменён' });
    res.status(200).end(); return;
  }
  const who = [cq.from.first_name, cq.from.last_name].filter(Boolean).join(' ') || cq.from.username || 'кто-то';
  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Chisinau', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const add = (/\n(✅ Принят) —/.test(text) ? '\n' : '\n\n') + `${LABEL[cq.data]} — ${who}, ${when}`;
  const markup = cq.data === 'acc' ? { inline_keyboard: KB.accepted } : { inline_keyboard: [] };
  await api('editMessageText', { chat_id: msg.chat.id, message_id: msg.message_id, text: text + add, entities: msg.entities || [], disable_web_page_preview: true, reply_markup: markup });
  await api('answerCallbackQuery', { callback_query_id: cq.id, text: LABEL[cq.data] });
  res.status(200).end();
};
