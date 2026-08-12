# Supabase Auth email templates

Templates HTML brandeados con Momentos para pegar en
**Supabase Dashboard → Authentication → Email Templates**.

## Cómo usar

1. Entra a tu proyecto en Supabase Dashboard
2. Ve a **Authentication → Email Templates**
3. Para cada plantilla, encuentra la correspondiente abajo:
   - **Confirm signup** → `confirm-signup.html`
   - **Reset Password** → `recovery.html`
   - **Magic Link** → `magic-link.html`
   - **Invite user** → `invite.html`
   - **Change Email Address** → `change-email.html`
4. Abre el archivo, copia el contenido completo
5. Pega en el textarea de la plantilla correspondiente en Supabase
6. Edita el "Subject" (asunto) según sugerencias abajo
7. Guarda

## Por qué NO usamos `{{ .ConfirmationURL }}`

Esa variable apunta a `/auth/v1/verify` de Supabase, que **gasta el token de
un solo uso con un GET**. Cualquier cosa que abra la URL antes que la persona
—la previsualización de enlaces de iOS, un escáner de correo corporativo— lo
quema, y quien hace click recibe `otp_expired` y termina en `/login`. Es lo
que estaba rompiendo la recuperación de contraseña en iPhone.

Además esos enlaces son PKCE: exigen una cookie `code_verifier` en el **mismo
navegador** que pidió el correo, así que pedir el cambio en la laptop y abrirlo
en el celular no podía funcionar nunca.

Por eso todas las plantillas apuntan a `/confirmar` con `{{ .TokenHash }}`:

```
{{ .SiteURL }}/confirmar?token_hash={{ .TokenHash }}&amp;type=<tipo>&amp;next=<ruta>
```

`/confirmar` no verifica nada al cargar: muestra un botón y el token se
consume hasta el POST, que ningún robot hace. Y `verifyOtp` con token hash no
usa `code_verifier`, así que abrir el correo en otro dispositivo funciona.

El `type` debe coincidir con la plantilla, porque la app lo lee de la URL:

| Plantilla | `type` | `next` |
|---|---|---|
| Reset Password | `recovery` | `/restablecer-contrasena` |
| Confirm signup | `signup` | `/mi-cuenta` |
| Magic Link | `magiclink` | `/mi-cuenta` |
| Invite user | `invite` | `/mi-cuenta` |
| Change Email | `email_change` | `/mi-cuenta/perfil` |

**Requisito:** el *Site URL* en Supabase → Authentication → URL Configuration
tiene que ser `https://momentosbooks.com`, porque `{{ .SiteURL }}` sale de ahí.

## Variables de Supabase

Los templates usan estas variables (Supabase las reemplaza al enviar):

- `{{ .TokenHash }}` — hash del token, lo que verificamos en `/confirmar`
- `{{ .Email }}` — correo del destinatario
- `{{ .SiteURL }}` — el Site URL configurado en Supabase
- `{{ .Token }}` — código OTP de 6 dígitos (si lo usas)
- `{{ .ConfirmationURL }}` — **no usar**, ver arriba

## Subjects sugeridos

- **Confirm signup**: `Confirma tu cuenta en Momentos`
- **Reset Password**: `Recupera tu contraseña de Momentos`
- **Magic Link**: `Tu link mágico de acceso a Momentos`
- **Invite user**: `Te invitaron a Momentos`
- **Change Email**: `Confirma tu nuevo correo en Momentos`

## Logo

Los templates apuntan a `https://momentosbooks.com/momentos-logo.png`.
Si cambias el dominio, edita esa URL en cada archivo (o usa el viejo
mientras propaga DNS).

## WhatsApp en el footer

El footer de cada plantilla tiene hardcoded el número
`+52 667 142 2115`. Si lo cambias, actualiza los 5 archivos y
**vuelve a pegar cada uno en el dashboard de Supabase** — los HTMLs
viven en el dashboard, no en este repo, así que un cambio aquí no se
propaga solo. Resend usa `loadContact()` y lo lee de `site_settings`
en DB, pero estos templates son estáticos y Supabase no permite
inyectar variables custom.
