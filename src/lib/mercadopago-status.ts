/**
 * Customer-facing copy for MercadoPago's `status_detail`.
 *
 * Every non-approved payment used to render the same "No pudimos confirmar tu
 * pago", so a mistyped CVV, an empty balance and a fraud block were
 * indistinguishable — to the customer, who couldn't tell what to fix, and to
 * us, who received them all as one bug report.
 *
 * Codes from https://www.mercadopago.com.mx/developers → payment status_detail.
 */

export type PaymentOutcome = {
  title: string;
  body: string;
  /** Whether trying again with the same or another card can plausibly work. */
  retryable: boolean;
};

const REJECTED: Record<string, PaymentOutcome> = {
  cc_rejected_bad_filled_security_code: {
    title: "El código de seguridad es incorrecto",
    body: "Revisa el CVV de tu tarjeta — son los 3 dígitos al reverso (4 al frente en American Express) — e inténtalo de nuevo.",
    retryable: true,
  },
  cc_rejected_bad_filled_date: {
    title: "La fecha de vencimiento es incorrecta",
    body: "Verifica el mes y año de vencimiento de tu tarjeta e inténtalo de nuevo.",
    retryable: true,
  },
  cc_rejected_bad_filled_card_number: {
    title: "El número de tarjeta es incorrecto",
    body: "Revisa que el número esté completo y sin espacios de más.",
    retryable: true,
  },
  cc_rejected_bad_filled_other: {
    title: "Hay un dato incorrecto en la tarjeta",
    body: "Revisa número, fecha de vencimiento y código de seguridad e inténtalo de nuevo.",
    retryable: true,
  },
  cc_rejected_insufficient_amount: {
    title: "Tu tarjeta no tiene fondos suficientes",
    body: "Intenta con otra tarjeta o con otro medio de pago.",
    retryable: true,
  },
  cc_rejected_high_risk: {
    title: "Tu banco no autorizó el cargo",
    body: "Por seguridad, el pago fue rechazado. Intenta con otra tarjeta, o comunícate con tu banco para autorizarlo.",
    retryable: true,
  },
  cc_rejected_max_attempts: {
    title: "Alcanzaste el límite de intentos",
    body: "Tu tarjeta llegó al máximo de intentos permitidos. Prueba con otra tarjeta o espera unas horas.",
    retryable: false,
  },
  cc_rejected_call_for_authorize: {
    title: "Tu banco necesita autorizar este cargo",
    body: "Llama al número al reverso de tu tarjeta y autoriza el pago por el monto de tu pedido. Después vuelve a intentarlo.",
    retryable: true,
  },
  cc_rejected_card_disabled: {
    title: "Tu tarjeta está inactiva",
    body: "Llama a tu banco para activarla, o paga con otra tarjeta.",
    retryable: true,
  },
  cc_rejected_duplicated_payment: {
    title: "Ya hiciste un pago igual",
    body: "Detectamos un pago idéntico reciente. Revisa tus pedidos antes de volver a intentar, para no pagar dos veces.",
    retryable: false,
  },
  cc_rejected_card_error: {
    title: "No pudimos procesar tu tarjeta",
    body: "Hubo un problema al contactar a tu banco. Inténtalo de nuevo en unos minutos.",
    retryable: true,
  },
  cc_rejected_invalid_installments: {
    title: "Esa cantidad de cuotas no está disponible",
    body: "Elige otro número de cuotas o paga en una sola exhibición.",
    retryable: true,
  },
  cc_rejected_blacklist: {
    title: "No pudimos procesar este pago",
    body: "Intenta con otro medio de pago, o comunícate con tu banco.",
    retryable: true,
  },
  cc_rejected_other_reason: {
    title: "Tu banco rechazó el cargo",
    body: "Intenta con otra tarjeta o comunícate con tu banco para saber el motivo.",
    retryable: true,
  },
};

const GENERIC_REJECTED: PaymentOutcome = {
  title: "No pudimos confirmar tu pago",
  body: "El cargo no se completó. Intenta con otro medio de pago o revisa el estado en tus pedidos.",
  retryable: true,
};

/**
 * @param statusDetail MercadoPago's code. Unknown or missing codes fall back
 * to the generic copy, so a code we haven't mapped yet degrades to today's
 * behaviour instead of showing nothing.
 */
export function rejectionOutcome(
  statusDetail: string | null | undefined,
): PaymentOutcome {
  if (!statusDetail) return GENERIC_REJECTED;
  return REJECTED[statusDetail] ?? GENERIC_REJECTED;
}
