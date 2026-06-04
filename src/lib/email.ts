import "server-only";
import { Resend } from "resend";
import { serverOnlyEnv } from "@/lib/env";
import { env } from "@/lib/env";
import type { GiftCard } from "@/lib/gift-cards";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  if (cachedClient) return cachedClient;
  const { RESEND_API_KEY } = serverOnlyEnv();
  if (!RESEND_API_KEY || RESEND_API_KEY.startsWith("re_xxxx")) {
    // Treat unset / placeholder as "email disabled" so local dev doesn't
    // throw — emails are best-effort and we log a warning instead.
    return null;
  }
  cachedClient = new Resend(RESEND_API_KEY);
  return cachedClient;
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const client = getClient();
  if (!client) {
    console.warn(
      `[email] skipping send to ${args.to} — RESEND_API_KEY not configured`,
    );
    return { ok: false, reason: "no_api_key" };
  }
  const { EMAIL_FROM } = serverOnlyEnv();
  console.info(
    `[email] sending → to="${args.to}" from="${EMAIL_FROM}" subject="${args.subject}"`,
  );
  try {
    const result = await client.emails.send({
      from: EMAIL_FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (result.error) {
      console.error(
        `[email] resend rejected → to="${args.to}":`,
        result.error,
      );
      return { ok: false, reason: result.error.message };
    }
    console.info(
      `[email] sent → to="${args.to}" id=${result.data?.id ?? "(no id)"}`,
    );
    return { ok: true, id: result.data?.id };
  } catch (e) {
    console.error(`[email] resend threw → to="${args.to}":`, e);
    return { ok: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}

// ============================================================
// Brand shell
// ============================================================

/**
 * Wraps any email body in the Momentos brand chrome: pink-accent logo
 * header on white, content area, soft footer with contact info. All CSS
 * inlined for email-client compatibility (Gmail, Outlook, Apple Mail).
 *
 * The logo lives at /momentos-logo.png served from the storefront. Email
 * clients block by default — we provide alt text and a tagline directly
 * underneath so the brand reads either way.
 */
function shell(opts: {
  preheader: string;
  title: string;
  bodyHtml: string;
}): string {
  const logoUrl = `${env.SITE_URL.replace(/\/$/, "")}/momentos-logo.png`;
  const productsUrl = `${env.SITE_URL.replace(/\/$/, "")}/productos`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#fdf2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a0a0a;-webkit-font-smoothing:antialiased;">
  <!-- Preheader (hidden but shown as preview in inbox lists) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.preheader)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fdf2f8;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="560" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(242,114,179,0.08);">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 24px 12px 24px;background:#ffffff;border-bottom:3px solid #F272b3;">
              <img src="${logoUrl}" width="180" alt="Momentos Photobooks" style="display:block;max-width:180px;height:auto;margin:0 auto 8px auto;border:0;" />
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#F272b3;">Momentos · Photobooks</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;">
              ${opts.bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;background:#fdf2f8;border-top:1px solid #fce7f3;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;">
                Hecho con cariño en México 🇲🇽
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                <a href="${productsUrl}" style="color:#F272b3;text-decoration:none;font-weight:600;">momentosbooks.com</a>
                · <a href="mailto:hola@momentos.mx" style="color:#F272b3;text-decoration:none;font-weight:600;">hola@momentos.mx</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
    <tr>
      <td align="center" style="border-radius:12px;background:#F272b3;">
        <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:0.02em;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

// ============================================================
// Gift card delivery email (to recipient)
// ============================================================

export async function sendGiftCardEmail(card: GiftCard): Promise<void> {
  if (!card.recipient_email) return;
  const subject = `${
    card.sender_name ? `${card.sender_name} te envió` : "Tienes"
  } una gift card de Momentos`;
  const html = renderGiftCardEmail(card);
  await sendEmail({ to: card.recipient_email, subject, html });
}

function renderGiftCardEmail(card: GiftCard): string {
  const amountFmt = formatPeso(card.initial_amount);
  const expires = card.expires_at
    ? new Date(card.expires_at).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;
  const greeting = card.recipient_name
    ? `¡Hola ${escapeHtml(card.recipient_name)}!`
    : "¡Hola!";
  const sender = card.sender_name
    ? `<p style="margin:0 0 16px 0;font-size:14px;color:#525252;">De parte de <strong style="color:#0a0a0a;">${escapeHtml(card.sender_name)}</strong>.</p>`
    : "";
  const message = card.message
    ? `<blockquote style="margin:20px 0;padding:14px 18px;border-left:4px solid #F272b3;background:#fdf2f8;color:#3f3f46;font-style:italic;font-size:14px;border-radius:0 8px 8px 0;">${escapeHtml(card.message)}</blockquote>`
    : "";
  const expiresLine = expires
    ? `<p style="margin:8px 0 0 0;font-size:12px;color:#71717a;text-align:center;">Vigencia hasta el ${expires}</p>`
    : "";

  const productsUrl = `${env.SITE_URL.replace(/\/$/, "")}/productos`;

  const body = `
    <p style="margin:0 0 6px 0;font-size:15px;color:#525252;">${greeting}</p>
    <h1 style="margin:0 0 16px 0;font-size:26px;font-weight:800;line-height:1.2;color:#0a0a0a;">Tienes una gift card 🎁</h1>
    ${sender}
    ${message}

    <div style="margin:28px 0;padding:24px 20px;border-radius:16px;background:linear-gradient(135deg,#F272b3 0%,#E55BA0 100%);color:#ffffff;text-align:center;box-shadow:0 8px 24px rgba(242,114,179,0.3);">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">Saldo disponible</p>
      <p style="margin:8px 0 18px 0;font-size:42px;font-weight:800;line-height:1;">${amountFmt}</p>
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">Tu código</p>
      <p style="margin:6px 0 0 0;font-family:'Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:0.08em;">${escapeHtml(card.code)}</p>
    </div>

    ${button("Usar mi gift card", productsUrl)}

    <p style="margin:16px 0 0 0;font-size:14px;color:#3f3f46;line-height:1.5;">
      Aplica el código en el checkout. Puedes usarlo en varios pedidos hasta agotar el saldo — perfecto para regalarte un fotolibro a tu medida.
    </p>
    ${expiresLine}
  `;

  return shell({
    preheader: `Saldo de ${amountFmt} — código ${card.code}`,
    title: "Tu gift card de Momentos",
    bodyHtml: body,
  });
}

// ============================================================
// Buyer confirmation — to whoever bought the gift cards
// ============================================================

export type BuyerGiftCardIssued = {
  amount: number;
  recipient_email: string | null;
  recipient_name: string | null;
  delivery_method: "email" | "physical";
};

export async function sendBuyerGiftCardConfirmation(args: {
  buyerEmail: string;
  buyerName: string | null;
  orderId: string;
  cards: BuyerGiftCardIssued[];
}): Promise<void> {
  if (!args.cards.length) return;
  const count = args.cards.length;
  const subject =
    count === 1
      ? "¡Tu gift card está en camino!"
      : `¡Tus ${count} gift cards están en camino!`;
  const html = renderBuyerConfirmationEmail(args);
  await sendEmail({ to: args.buyerEmail, subject, html });
}

function renderBuyerConfirmationEmail(args: {
  buyerName: string | null;
  orderId: string;
  cards: BuyerGiftCardIssued[];
}): string {
  const greeting = args.buyerName
    ? `¡Gracias ${escapeHtml(args.buyerName)}!`
    : "¡Gracias!";
  const total = args.cards.reduce((s, c) => s + Number(c.amount), 0);
  const totalFmt = formatPeso(total);
  const orderShort = args.orderId.slice(0, 8);
  const single = args.cards.length === 1;

  const rows = args.cards
    .map((c) => {
      const who = c.recipient_name
        ? escapeHtml(c.recipient_name)
        : c.recipient_email
          ? escapeHtml(c.recipient_email)
          : "destinatario";
      const where = c.recipient_email
        ? `<br><span style="color:#9ca3af;font-size:12px;">${escapeHtml(c.recipient_email)}</span>`
        : "";
      const channel =
        c.delivery_method === "physical"
          ? '🚚 Tarjeta física'
          : '✉️ Por correo electrónico';
      return `<tr>
        <td style="padding:14px 0;border-bottom:1px solid #fce7f3;">
          <p style="margin:0;font-size:14px;color:#0a0a0a;font-weight:600;">${who}</p>
          ${where}
          <p style="margin:4px 0 0 0;font-size:11px;color:#F272b3;font-weight:600;letter-spacing:0.04em;">${channel}</p>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid #fce7f3;text-align:right;font-weight:700;color:#0a0a0a;font-size:15px;">
          ${formatPeso(Number(c.amount))}
        </td>
      </tr>`;
    })
    .join("");

  const hasPhysical = args.cards.some((c) => c.delivery_method === "physical");
  const closing = hasPhysical
    ? "Las tarjetas digitales ya salieron al correo del destinatario. Las físicas se preparan y envían en los próximos días."
    : single
      ? "Ya salió al correo del destinatario."
      : "Ya salieron al correo de cada destinatario.";

  const body = `
    <p style="margin:0 0 6px 0;font-size:15px;color:#525252;">${greeting}</p>
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;line-height:1.2;color:#0a0a0a;">
      ${single ? "Tu gift card ya está en camino" : "Tus gift cards ya están en camino"}
    </h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:#3f3f46;line-height:1.5;">
      Gracias por tu compra. Aquí están los detalles de lo que enviamos:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:8px;">
      ${rows}
      <tr>
        <td style="padding:16px 0 0 0;font-size:13px;color:#525252;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Total</td>
        <td style="padding:16px 0 0 0;font-size:18px;font-weight:800;text-align:right;color:#F272b3;">${totalFmt}</td>
      </tr>
    </table>

    <p style="margin:20px 0 0 0;font-size:14px;color:#3f3f46;line-height:1.5;">${closing}</p>
    <p style="margin:16px 0 0 0;font-size:12px;color:#71717a;">
      Pedido <span style="font-family:monospace;background:#fdf2f8;padding:2px 6px;border-radius:4px;color:#F272b3;">#${orderShort}</span>
    </p>
    <p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;">
      ¿Algo no salió como esperabas? Respóndenos a este correo y con gusto te ayudamos.
    </p>
  `;

  return shell({
    preheader: `${single ? "Tu gift card" : `${args.cards.length} gift cards`} por ${totalFmt}`,
    title: "Confirmación de tu pedido",
    bodyHtml: body,
  });
}

// ============================================================
// Welcome email (after signup confirmation)
// ============================================================

export async function sendWelcomeEmail(args: {
  to: string;
  name: string | null;
}): Promise<void> {
  const html = renderWelcomeEmail(args);
  await sendEmail({
    to: args.to,
    subject: "¡Bienvenido a Momentos! ✨",
    html,
  });
}

function renderWelcomeEmail(args: { name: string | null }): string {
  const greeting = args.name
    ? `¡Hola ${escapeHtml(args.name)}!`
    : "¡Hola!";
  const fotolibroUrl = `${env.SITE_URL.replace(/\/$/, "")}/fotolibro`;

  const body = `
    <p style="margin:0 0 6px 0;font-size:15px;color:#525252;">${greeting}</p>
    <h1 style="margin:0 0 16px 0;font-size:26px;font-weight:800;line-height:1.2;color:#0a0a0a;">
      Bienvenido a Momentos 📸
    </h1>
    <p style="margin:0 0 20px 0;font-size:15px;color:#3f3f46;line-height:1.6;">
      Estamos felices de tenerte aquí. En Momentos convertimos tus fotos favoritas en fotolibros impresos de calidad — perfectos para regalar, atesorar o decorar.
    </p>

    <div style="margin:24px 0;padding:20px;background:#fdf2f8;border-radius:12px;border-left:4px solid #F272b3;">
      <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:#0a0a0a;">¿Listo para empezar?</p>
      <p style="margin:0;font-size:13px;color:#525252;line-height:1.5;">
        Sube tus fotos, elige el tamaño y diseño, y te lo enviamos impreso a tu casa.
      </p>
    </div>

    ${button("Crear mi fotolibro", fotolibroUrl)}

    <p style="margin:24px 0 0 0;font-size:13px;color:#71717a;line-height:1.5;">
      Si tienes alguna duda, respóndenos a este correo. Estamos aquí para ayudarte a guardar tus momentos para siempre.
    </p>
  `;

  return shell({
    preheader: "Crea tu primer fotolibro en minutos",
    title: "Bienvenido a Momentos",
    bodyHtml: body,
  });
}

// ============================================================
// Order paid confirmation
// ============================================================

export type OrderEmailItem = {
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
};

export async function sendOrderPaidEmail(args: {
  to: string;
  name: string | null;
  orderId: string;
  items: OrderEmailItem[];
  total: number;
  fulfillment: "ship" | "pickup" | "digital";
}): Promise<void> {
  const html = renderOrderPaidEmail(args);
  await sendEmail({
    to: args.to,
    subject: `¡Recibimos tu pago! Pedido #${args.orderId.slice(0, 8)}`,
    html,
  });
}

function renderOrderPaidEmail(args: {
  name: string | null;
  orderId: string;
  items: OrderEmailItem[];
  total: number;
  fulfillment: "ship" | "pickup" | "digital";
}): string {
  const greeting = args.name ? `¡Gracias ${escapeHtml(args.name)}!` : "¡Gracias!";
  const orderShort = args.orderId.slice(0, 8);
  const orderUrl = `${env.SITE_URL.replace(/\/$/, "")}/mi-cuenta/pedidos/${args.orderId}`;

  const rows = args.items
    .map(
      (it) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #fce7f3;">
          <p style="margin:0;font-size:14px;color:#0a0a0a;font-weight:600;">${escapeHtml(it.product_name)}</p>
          ${it.variant_name ? `<p style="margin:2px 0 0 0;font-size:12px;color:#71717a;">${escapeHtml(it.variant_name)}</p>` : ""}
          <p style="margin:4px 0 0 0;font-size:12px;color:#9ca3af;">${it.quantity} × ${formatPeso(Number(it.unit_price))}</p>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #fce7f3;text-align:right;font-weight:700;color:#0a0a0a;font-size:14px;">
          ${formatPeso(Number(it.unit_price) * Number(it.quantity))}
        </td>
      </tr>`,
    )
    .join("");

  const nextStep =
    args.fulfillment === "digital"
      ? "Como es entrega digital, recibirás cada ítem directamente por correo en los próximos minutos."
      : args.fulfillment === "pickup"
        ? "Tu pedido entró en producción. Te avisamos cuando esté listo para recoger en sucursal."
        : "Tu pedido entró en producción. Te enviaremos otro correo con el número de guía cuando salga a tu domicilio.";

  const body = `
    <p style="margin:0 0 6px 0;font-size:15px;color:#525252;">${greeting}</p>
    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:800;line-height:1.2;color:#0a0a0a;">
      Recibimos tu pago ✅
    </h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:#3f3f46;line-height:1.5;">
      Pedido <span style="font-family:monospace;background:#fdf2f8;padding:2px 6px;border-radius:4px;color:#F272b3;font-weight:600;">#${orderShort}</span>
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:8px;">
      ${rows}
      <tr>
        <td style="padding:16px 0 0 0;font-size:13px;color:#525252;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Total</td>
        <td style="padding:16px 0 0 0;font-size:18px;font-weight:800;text-align:right;color:#F272b3;">${formatPeso(args.total)}</td>
      </tr>
    </table>

    <p style="margin:24px 0 0 0;font-size:14px;color:#3f3f46;line-height:1.5;">${nextStep}</p>

    ${button("Ver mi pedido", orderUrl)}
  `;

  return shell({
    preheader: `Pago confirmado — pedido #${orderShort}`,
    title: "Pago recibido",
    bodyHtml: body,
  });
}

// ============================================================
// Order shipped
// ============================================================

export async function sendOrderShippedEmail(args: {
  to: string;
  name: string | null;
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}): Promise<void> {
  const html = renderOrderShippedEmail(args);
  await sendEmail({
    to: args.to,
    subject: `📦 ¡Tu pedido va en camino! #${args.orderId.slice(0, 8)}`,
    html,
  });
}

function renderOrderShippedEmail(args: {
  name: string | null;
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}): string {
  const greeting = args.name ? `¡Hola ${escapeHtml(args.name)}!` : "¡Hola!";
  const orderShort = args.orderId.slice(0, 8);
  const orderUrl = `${env.SITE_URL.replace(/\/$/, "")}/mi-cuenta/pedidos/${args.orderId}`;

  const trackingBlock = args.trackingNumber
    ? `<div style="margin:24px 0;padding:20px;background:#fdf2f8;border-radius:12px;border-left:4px solid #F272b3;">
        ${args.carrier ? `<p style="margin:0 0 6px 0;font-size:12px;font-weight:700;color:#F272b3;letter-spacing:0.06em;text-transform:uppercase;">Paquetería</p>
        <p style="margin:0 0 12px 0;font-size:16px;font-weight:700;color:#0a0a0a;">${escapeHtml(args.carrier)}</p>` : ""}
        <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;color:#F272b3;letter-spacing:0.06em;text-transform:uppercase;">Número de guía</p>
        <p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:#0a0a0a;letter-spacing:0.04em;">${escapeHtml(args.trackingNumber)}</p>
      </div>`
    : "";

  const body = `
    <p style="margin:0 0 6px 0;font-size:15px;color:#525252;">${greeting}</p>
    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:800;line-height:1.2;color:#0a0a0a;">
      Tu pedido salió 📦
    </h1>
    <p style="margin:0 0 16px 0;font-size:14px;color:#3f3f46;line-height:1.5;">
      Pedido <span style="font-family:monospace;background:#fdf2f8;padding:2px 6px;border-radius:4px;color:#F272b3;font-weight:600;">#${orderShort}</span> ya está en camino a tu domicilio.
    </p>

    ${trackingBlock}

    ${args.trackingUrl ? button("Rastrear envío", args.trackingUrl) : button("Ver mi pedido", orderUrl)}

    <p style="margin:24px 0 0 0;font-size:13px;color:#71717a;line-height:1.5;">
      Si tienes alguna duda con tu envío, respóndenos a este correo y con gusto te ayudamos.
    </p>
  `;

  return shell({
    preheader: `Tu pedido va en camino${args.trackingNumber ? ` — guía ${args.trackingNumber}` : ""}`,
    title: "Tu pedido va en camino",
    bodyHtml: body,
  });
}

// ============================================================
// Order ready for pickup
// ============================================================

export async function sendOrderReadyEmail(args: {
  to: string;
  name: string | null;
  orderId: string;
  branchName: string | null;
  branchAddress: string | null;
  branchHours: string | null;
}): Promise<void> {
  const html = renderOrderReadyEmail(args);
  await sendEmail({
    to: args.to,
    subject: `🎁 Tu pedido está listo para recoger #${args.orderId.slice(0, 8)}`,
    html,
  });
}

function renderOrderReadyEmail(args: {
  name: string | null;
  orderId: string;
  branchName: string | null;
  branchAddress: string | null;
  branchHours: string | null;
}): string {
  const greeting = args.name ? `¡Hola ${escapeHtml(args.name)}!` : "¡Hola!";
  const orderShort = args.orderId.slice(0, 8);
  const orderUrl = `${env.SITE_URL.replace(/\/$/, "")}/mi-cuenta/pedidos/${args.orderId}`;

  const branchBlock =
    args.branchName || args.branchAddress
      ? `<div style="margin:24px 0;padding:20px;background:#fdf2f8;border-radius:12px;border-left:4px solid #F272b3;">
          ${args.branchName ? `<p style="margin:0 0 6px 0;font-size:12px;font-weight:700;color:#F272b3;letter-spacing:0.06em;text-transform:uppercase;">Sucursal</p>
          <p style="margin:0 0 12px 0;font-size:16px;font-weight:700;color:#0a0a0a;">${escapeHtml(args.branchName)}</p>` : ""}
          ${args.branchAddress ? `<p style="margin:0 0 12px 0;font-size:14px;color:#3f3f46;line-height:1.5;">${escapeHtml(args.branchAddress)}</p>` : ""}
          ${args.branchHours ? `<p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#F272b3;letter-spacing:0.06em;text-transform:uppercase;">Horario</p>
          <p style="margin:0;font-size:13px;color:#525252;">${escapeHtml(args.branchHours)}</p>` : ""}
        </div>`
      : "";

  const body = `
    <p style="margin:0 0 6px 0;font-size:15px;color:#525252;">${greeting}</p>
    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:800;line-height:1.2;color:#0a0a0a;">
      ¡Tu pedido está listo! 🎁
    </h1>
    <p style="margin:0 0 16px 0;font-size:14px;color:#3f3f46;line-height:1.5;">
      Pedido <span style="font-family:monospace;background:#fdf2f8;padding:2px 6px;border-radius:4px;color:#F272b3;font-weight:600;">#${orderShort}</span> ya está listo para que lo recojas.
    </p>

    ${branchBlock}

    ${button("Ver mi pedido", orderUrl)}

    <p style="margin:24px 0 0 0;font-size:13px;color:#71717a;line-height:1.5;">
      Lleva una identificación al recoger. Si necesitas que vaya alguien más en tu nombre, respóndenos a este correo para arreglarlo.
    </p>
  `;

  return shell({
    preheader: `Tu pedido #${orderShort} está listo para recoger`,
    title: "Tu pedido está listo",
    bodyHtml: body,
  });
}

// ============================================================
// Utilities
// ============================================================

function formatPeso(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
