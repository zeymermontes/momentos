import { AdminPageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ContactForm } from "@/app/admin/configuracion/_components/contact-form";
import { PhotobookSettingsForm } from "@/app/admin/fotolibros/configuracion/_components/settings-form";
import { requireAdmin } from "@/lib/auth";
import { getContactSettings } from "@/lib/settings";
import { getPhotobookSettings } from "@/lib/photobook";

export const metadata = { title: "Configuración" };

export default async function ConfigurationPage() {
  await requireAdmin();
  const [contact, photobookSettings] = await Promise.all([
    getContactSettings(),
    getPhotobookSettings(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AdminPageHeader
        title="Configuración"
        description="Información general del sitio y configuración de productos."
      />

      <Card>
        <CardHeader>
          <CardTitle>Datos de contacto</CardTitle>
          <CardDescription>
            Estos valores aparecen en la página de contacto. El teléfono y el
            WhatsApp también se usan para los botones &quot;click to call&quot;
            y &quot;chatear por WhatsApp&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContactForm contact={contact} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fotolibros</CardTitle>
          <CardDescription>
            Configura tamaños, precios, opciones de páginas y promociones por
            volumen para los fotolibros personalizados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhotobookSettingsForm settings={photobookSettings} />
        </CardContent>
      </Card>
    </div>
  );
}
