var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// functions/api/order.js
var esc = /* @__PURE__ */ __name((s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]), "esc");
var cut = /* @__PURE__ */ __name((s, n) => String(s == null ? "" : s).slice(0, n), "cut");
var lei = /* @__PURE__ */ __name((n) => Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/ /g, " ") + " \u043B\u0435\u0439", "lei");
var json = /* @__PURE__ */ __name((o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }), "json");
var sid = /* @__PURE__ */ __name((v) => /^[a-z0-9-]{1,40}$/i.test(String(v || "")) ? String(v) : "", "sid");
async function onRequest({ request, env }) {
  const token = (env.TG_TOKEN || "").trim(), chat = (env.TG_CHAT_ID || "").trim();
  const url = new URL(request.url);
  const tg = /* @__PURE__ */ __name((m, b) => fetch(`https://api.telegram.org/bot${token}/${m}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json()).catch(() => ({ ok: false, description: "network error" })), "tg");
  if (request.method === "GET") {
    const out = { function: "ok", host: "cloudflare", TG_TOKEN: token ? "set" : "MISSING", TG_CHAT_ID: chat || "MISSING" };
    if (token) {
      const me = await tg("getMe", {});
      out.bot = me.ok ? "@" + me.result.username : "ERROR: " + me.description;
      if (chat) {
        const c = await tg("getChat", { chat_id: chat });
        out.group = c.ok ? c.result.title || c.result.type : "ERROR: " + c.description;
      }
    }
    return json(out);
  }
  if (request.method !== "POST") return json({ ok: false }, 405);
  if (!token || !chat) return json({ ok: false, error: "not_configured" }, 503);
  let o;
  try {
    o = await request.json();
  } catch (e) {
    o = null;
  }
  if (!o || typeof o !== "object" || o.website) return json({ ok: false }, 400);
  const name = cut(o.name, 80).trim(), phone = cut(o.phone, 40).trim();
  const items = Array.isArray(o.items) ? o.items.slice(0, 30) : [];
  if (!name || phone.replace(/\D/g, "").length < 6 || !items.length) return json({ ok: false, error: "invalid" }, 400);
  const site = url.origin + "/";
  const num = cut(o.num, 12).replace(/\D/g, "") || String(Date.now()).slice(-5);
  const when = (/* @__PURE__ */ new Date()).toLocaleString("ru-RU", { timeZone: "Europe/Chisinau", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const tel = phone.replace(/[^\d+]/g, "");
  const msgr = { Instagram: "Instagram", Telegram: "Telegram", WhatsApp: "WhatsApp", Viber: "Viber", "\u0417\u0432\u043E\u043D\u043E\u043A": "\u043F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u044C" }[o.msgr] || cut(o.msgr, 20);
  const pickup = o.how === "pickup";
  const lines = [
    `\u{1F388} <b>\u041D\u043E\u0432\u044B\u0439 \u0437\u0430\u043A\u0430\u0437 \u2116${esc(num)}</b>`,
    esc(when),
    "",
    `\u{1F464} ${esc(name)}`,
    `\u{1F4DE} ${esc(tel)}`,
    `\u{1F4AC} \u0421\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F: ${esc(msgr)}`,
    "",
    "\u{1F6CD} <b>\u0421\u043E\u0441\u0442\u0430\u0432 \u0437\u0430\u043A\u0430\u0437\u0430:</b>",
    ...items.map((it, i) => {
      const q = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1)), color = cut(it.color, 60), id = sid(it.id), nm = esc(cut(it.name, 120));
      return `${i + 1}. ${id ? `<a href="${site}#product/${id}">${nm}</a>` : nm} \u2014 ${q} \u0448\u0442., ${lei(it.sum)}` + (color ? `
   \u0426\u0432\u0435\u0442: ${esc(color)}` : "");
    }),
    "",
    `\u{1F4B0} <b>\u0418\u0442\u043E\u0433\u043E: ${lei(o.sum)}</b>` + (pickup ? "" : "\n   + \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0430 (\u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u044C)"),
    "",
    pickup ? "\u{1F3E0} \u0421\u0430\u043C\u043E\u0432\u044B\u0432\u043E\u0437 \u2014 \u0443\u043B. \u041B\u0435\u043D\u0438\u043D\u0430, 143" : `\u{1F69A} \u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430: ${esc(cut(o.town, 60))}, ${esc(cut(o.addr, 200))}`,
    `\u{1F4B3} \u041E\u043F\u043B\u0430\u0442\u0430: ${o.pay === "card" ? "\u043A\u0430\u0440\u0442\u043E\u0439 \u043A\u0443\u0440\u044C\u0435\u0440\u0443" : "\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u043C\u0438 \u043A\u0443\u0440\u044C\u0435\u0440\u0443"}`
  ];
  const payload = ["n=" + num].concat(items.map((it) => {
    const id = sid(it.id);
    if (!id) return "";
    const q = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    return [id, q, cut(it.color, 40).replace(/[~|]/g, " ")].join("~");
  }).filter(Boolean)).join("|");
  if (payload.includes("~")) lines.push("", `\u{1F6D2} <a href="${site}#order/${encodeURIComponent(payload)}">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0437\u0430\u043A\u0430\u0437 \u0441 \u0444\u043E\u0442\u043E</a>`);
  const comm = cut(o.comm, 600).trim();
  if (comm) lines.push("", `\u{1F4DD} \u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439: \xAB${esc(comm)}\xBB`);
  const j = await tg("sendMessage", {
    chat_id: chat,
    text: lines.join("\n"),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: "\u2705 \u041F\u0440\u0438\u043D\u044F\u0442", callback_data: "acc" }, { text: "\u274C \u041E\u0442\u043C\u0435\u043D\u0451\u043D", callback_data: "cancel" }]] }
  });
  if (!j.ok) return json({ ok: false, error: "telegram: " + j.description }, 502);
  return json({ ok: true, num });
}
__name(onRequest, "onRequest");

// functions/api/tg.js
var LABEL = { acc: "\u2705 \u041F\u0440\u0438\u043D\u044F\u0442", done: "\u{1F4E6} \u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D", cancel: "\u274C \u041E\u0442\u043C\u0435\u043D\u0451\u043D" };
var json2 = /* @__PURE__ */ __name((o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }), "json");
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(sha, "sha");
async function onRequest2({ request, env }) {
  const token = (env.TG_TOKEN || "").trim(), chat = (env.TG_CHAT_ID || "").trim();
  if (!token) return json2({ ok: false, error: "not_configured" }, 503);
  const secret = (await sha("alisa-webhook:" + token)).slice(0, 48);
  const api = /* @__PURE__ */ __name((m, b) => fetch(`https://api.telegram.org/bot${token}/${m}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json()).catch(() => ({ ok: false })), "api");
  const url = new URL(request.url);
  if (request.method === "GET") {
    if (url.searchParams.get("setup")) {
      const r2 = await api("setWebhook", { url: url.origin + "/api/tg", secret_token: secret, allowed_updates: ["callback_query"], drop_pending_updates: true });
      return json2({ webhook: r2.ok ? "\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D" : "\u043E\u0448\u0438\u0431\u043A\u0430: " + r2.description, url: url.origin + "/api/tg" });
    }
    const r = await api("getWebhookInfo", {});
    return json2({ webhook: r.ok && r.result.url ? r.result.url : "\u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D", last_error: r.ok ? r.result.last_error_message || null : null });
  }
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("", { status: 401 });
  let u;
  try {
    u = await request.json();
  } catch (e) {
    u = {};
  }
  const cq = u && u.callback_query;
  if (!cq || !cq.message || !LABEL[cq.data]) return new Response("");
  const msg = cq.message;
  if (chat && String(msg.chat.id) !== chat) {
    await api("answerCallbackQuery", { callback_query_id: cq.id });
    return new Response("");
  }
  const text = msg.text || "";
  const finished = /\n(📦 Выполнен|❌ Отменён) —/.test(text), accepted = /\n✅ Принят —/.test(text);
  if (finished || cq.data === "acc" && accepted || cq.data === "done" && !accepted) {
    await api("answerCallbackQuery", { callback_query_id: cq.id, text: "\u0421\u0442\u0430\u0442\u0443\u0441 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D" });
    return new Response("");
  }
  const who = [cq.from.first_name, cq.from.last_name].filter(Boolean).join(" ") || cq.from.username || "\u043A\u0442\u043E-\u0442\u043E";
  const when = (/* @__PURE__ */ new Date()).toLocaleString("ru-RU", { timeZone: "Europe/Chisinau", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const add = (accepted ? "\n" : "\n\n") + `${LABEL[cq.data]} \u2014 ${who}, ${when}`;
  const markup = cq.data === "acc" ? { inline_keyboard: [[{ text: "\u{1F4E6} \u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D", callback_data: "done" }, { text: "\u274C \u041E\u0442\u043C\u0435\u043D\u0451\u043D", callback_data: "cancel" }]] } : { inline_keyboard: [] };
  await api("editMessageText", { chat_id: msg.chat.id, message_id: msg.message_id, text: text + add, entities: msg.entities || [], disable_web_page_preview: true, reply_markup: markup });
  await api("answerCallbackQuery", { callback_query_id: cq.id, text: LABEL[cq.data] });
  return new Response("");
}
__name(onRequest2, "onRequest");

// worker/index.js
var worker_default = {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/order") return onRequest({ request, env, ctx });
    if (pathname === "/api/tg") return onRequest2({ request, env, ctx });
    return env.ASSETS.fetch(request);
  }
};

// ../../../tmp/wtest/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../tmp/wtest/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-mkgBT7/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../tmp/wtest/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-mkgBT7/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
