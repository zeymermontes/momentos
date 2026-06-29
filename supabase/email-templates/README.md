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

## Variables de Supabase

Los templates usan estas variables (Supabase las reemplaza al enviar):

- `{{ .ConfirmationURL }}` — URL completa del link (Supabase la genera)
- `{{ .Email }}` — correo del destinatario
- `{{ .SiteURL }}` — el Site URL configurado en Supabase
- `{{ .Token }}` — código OTP de 6 dígitos (si lo usas)
- `{{ .TokenHash }}` — hash del token

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
