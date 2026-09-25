import { AdminPageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { getPhotobookSettings } from "@/lib/photobook";
import { PrintTest } from "@/app/admin/prueba-impresion/_components/print-test";

export const metadata = { title: "Prueba de impresión" };

export default async function PrintTestPage() {
  await requireAdmin();
  const settings = await getPhotobookSettings();
  const sizes = settings.sizes.map((s) => ({ cm: s.cm, label: s.sublabel }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminPageHeader
        title="Prueba de impresión"
        description="Sube una foto y compárala con la página tal como sale del generador de hojas. Descarga ambas para imprimirlas y ver la diferencia en papel."
      />
      <PrintTest sizes={sizes} />
    </div>
  );
}
