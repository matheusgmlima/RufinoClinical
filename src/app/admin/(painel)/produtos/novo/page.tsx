import type { Metadata } from "next";
import Link from "next/link";

import { ProductForm } from "@/components/admin/product-form";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const { supabase } = await requireAdmin();
  const { data: categories } = await supabase.from("categories").select("id, name").order("position").order("name");

  return (
    <>
      <Link href="/admin/produtos" className="text-sm font-semibold text-wine hover:underline">
        ← Produtos
      </Link>
      <AdminHeader
        title="Novo produto"
        lead="Ele começa como rascunho. Depois você adiciona variantes, preço, estoque e fotos."
      />
      <div className="max-w-2xl">
        <Panel title="Dados do produto">
          <ProductForm categories={categories ?? []} />
        </Panel>
      </div>
    </>
  );
}
