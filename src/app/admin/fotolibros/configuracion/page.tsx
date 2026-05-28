import { requireAdmin } from "@/lib/auth";
import { getPhotobookSettings } from "@/lib/photobook";
import { PhotobookSettingsForm } from "./_components/settings-form";

export const metadata = { title: "Configuración Fotolibro — Admin" };
export const dynamic = "force-dynamic";

export default async function PhotobookSettingsPage() {
  await requireAdmin();
  const settings = await getPhotobookSettings();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight">Configuración de fotolibros</h2>
      <p className="text-sm text-muted-foreground">
        Administra tamaños, precios por página, costo de pasta dura y opciones de número de páginas.
      </p>
      <PhotobookSettingsForm settings={settings} />
    </div>
  );
}
