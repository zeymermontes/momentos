import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PromotionForm } from "@/app/admin/promociones/_components/promotion-form";
import { requireAdmin } from "@/lib/auth";
import { getPhotobookSettings } from "@/lib/photobook";

export const metadata = { title: "Editar promoción" };

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [
    { data: rule },
    { data: products },
    { data: categories },
    { data: ruleProducts },
    { data: ruleCategories },
    photobook,
  ] = await Promise.all([
    supabase.from("promotion_rules").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("products")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
    supabase.from("categories").select("id, name").order("name"),
    supabase
      .from("promotion_rule_products")
      .select("product_id")
      .eq("promotion_rule_id", id),
    supabase
      .from("promotion_rule_categories")
      .select("category_id")
      .eq("promotion_rule_id", id),
    getPhotobookSettings(),
  ]);

  if (!rule) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AdminPageHeader title={rule.name} backHref="/admin/promociones" />
      <Card>
        <CardContent className="p-6">
          <PromotionForm
            rule={{
              ...rule,
              discount_value: Number(rule.discount_value),
              buy_x: rule.buy_x === null || rule.buy_x === undefined ? null : Number(rule.buy_x),
              min_subtotal:
                rule.min_subtotal === null ? null : Number(rule.min_subtotal),
              photobook_size_cm: (rule.photobook_size_cm ?? []).map(Number),
              photobook_page_count: (rule.photobook_page_count ?? []).map(
                Number,
              ),
            }}
            selectedProductIds={(ruleProducts ?? []).map((r) => r.product_id)}
            selectedCategoryIds={(ruleCategories ?? []).map((r) => r.category_id)}
            products={products ?? []}
            categories={categories ?? []}
            photobookSizes={photobook.sizes.map((s) => ({
              cm: s.cm,
              label: s.label,
              sublabel: s.sublabel,
            }))}
            photobookPageCounts={photobook.page_counts}
          />
        </CardContent>
      </Card>
    </div>
  );
}
