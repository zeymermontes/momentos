import { redirect } from "next/navigation";
import { Book } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPhotobookSettings } from "@/lib/photobook";
import { ConfigForm } from "./_components/config-form";

export const metadata = { title: "Crear fotolibro" };

export default async function PhotobookConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/fotolibro");

  const { data: existing } = await supabase
    .from("photobook_projects")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["draft", "completed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/fotolibro/${existing.id}/portada`);

  const settings = await getPhotobookSettings();
  if (!settings.enabled) redirect("/");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-10 text-center space-y-3">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10">
          <Book className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Crea tu fotolibro</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Elige el tamaño y número de páginas para tu fotolibro personalizado.
          Después diseñarás la portada y agregarás tus fotos.
        </p>
      </div>

      <ConfigForm settings={settings} />
    </div>
  );
}
