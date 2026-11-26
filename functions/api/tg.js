// Cloudflare Pages Function: Telegram webhook for "Принят / Выполнен / Отменён" buttons.
// Open GET /api/tg?setup=1 once to register the webhook.
const LABEL = { acc: '✅ Принят', done: '📦 Выполнен', cancel: '❌ Отменён' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

export async function onRequest({ request, env }) {
  const token = (env.TG_TOKEN || '').trim(), chat = (env.TG_CHAT_ID || '').trim();
  if (!token) return json({ ok: false, error: 'not_configured' }, 503);
  const secret = (await sha('alisa-webhook:' + token)).slice(0, 48);
  const api = (m, b) => fetch(`https://api.telegram.org/bot${token}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json()).catch(() => ({ ok: false }));
  const url = new URL(request.url);

  if (request.method === 'GET') {
    if (url.searchParams.get('setup')) {
      const r = await api('setWebhook', { url: url.origin + '/api/tg', secret_token: secret, allowed_updates: ['callback_query'], drop_pending_updates: true });
      return json({ webhook: r.ok ? 'установлен' : 'ошибка: ' + r.description, url: url.origin + '/api/tg' });
    }
    const r = await api('getWebhookInfo', {});
    return json({ webhook: r.ok && r.result.url ? r.result.url : 'не установлен', last_error: r.ok ? r.result.last_error_message || null : null });
  }
  if (request.headers.get('x-telegram-bot-api-secret-token') !== secret) return new Response('', { status: 401 });

  let u; try { u = await request.json(); } catch (e) { u = {}; }
  const cq = u && u.callback_query;
  if (!cq || !cq.message || !LABEL[cq.data]) return new Response('');
  const msg = cq.message;
  if (chat && String(msg.chat.id) !== chat) { await api('answerCallbackQuery', { callback_query_id: cq.id }); return new Response(''); }

  const text = msg.text || '';
  const finished = /\n(📦 Выполнен|❌ Отменён) —/.test(text), accepted = /\n✅ Принят —/.test(text);
  if (finished || (cq.data === 'acc' && accepted) || (cq.data === 'done' && !accepted)) {
    await api('answerCallbackQuery', { callback_query_id: cq.id, text: 'Статус уже изменён' }); return new Response('');
  }
  const who = [cq.from.first_name, cq.from.last_name].filter(Boolean).join(' ') || cq.from.username || 'кто-то';
  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Chisinau', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const add = (accepted ? '\n' : '\n\n') + `${LABEL[cq.data]} — ${who}, ${when}`;
  const markup = cq.data === 'acc' ? { inline_keyboard: [[{ text: '📦 Выполнен', callback_data: 'done' }, { text: '❌ Отменён', callback_data: 'cancel' }]] } : { inline_keyboard: [] };
  await api('editMessageText', { chat_id: msg.chat.id, message_id: msg.message_id, text: text + add, entities: msg.entities || [], disable_web_page_preview: true, reply_markup: markup });
  await api('answerCallbackQuery', { callback_query_id: cq.id, text: LABEL[cq.data] });
  return new Response('');
}
