import { z } from "zod";

/**
 * Mexican mobile number normalized to 10 digits. Accepts what people
 * actually type — spaces, dashes, parentheses, and the +52 / +521
 * country prefixes — and stores the bare 10-digit form, which is what
 * we need to build wa.me links.
 */
export const MxPhoneSchema = z
  .string({ message: "Ingresa tu número de teléfono" })
  .transform((v) => v.replace(/\D/g, ""))
  .transform((d) => {
    if (d.length === 12 && d.startsWith("52")) return d.slice(2);
    if (d.length === 13 && d.startsWith("521")) return d.slice(3);
    return d;
  })
  .refine((d) => d.length === 10, {
    message: "Ingresa un teléfono de 10 dígitos (WhatsApp)",
  });
