import type { Metadata } from "next";

import { deleteCategory } from "@/app/actions/admin/catalog";
import { CategoryForm } from "@/components/admin/category-form";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { ActiveBadge, AdminHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Categorias" };

export default async function AdminCategoriesPage() {
  const { supabase } = await requireAdmin();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, description, position, is_active, products(count)")
    .order("position")
    .order("name");

  return (
    <>
      <AdminHeader title="Categorias" lead="Organizam a vitrine e o menu da loja." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          {categories?.length ? (
            <ul className="grid gap-4">
              {categories.map(({ products, ...category }) => {
                const count = products[0]?.count ?? 0;
                return (
                  <li key={category.id} className="rounded-3xl border border-line bg-white/70 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold">{category.name}</h2>
                        <p className="text-xs text-ink-muted">
                          /{category.slug} · {count} {count === 1 ? "produto" : "produtos"}
                        </p>
                      </div>
                      <ActiveBadge active={category.is_active} />
                    </div>
                    <details className="mt-3 border-t border-line pt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-wine">Editar categoria</summary>
                      <div className="grid gap-5 pt-4">
                        <CategoryForm category={category} />
                        <ConfirmDelete
                          label="Excluir categoria"
                          question={`Excluir “${category.name}”? ${count ? `${count} ${count === 1 ? "produto fica" : "produtos ficam"} sem categoria.` : ""}`}
                          action={deleteCategory.bind(null, category.id)}
                        />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-3xl border border-line bg-white/70 p-8 text-center text-ink-muted">
              Nenhuma categoria ainda.
            </p>
          )}
        </div>
        <div className="xl:col-span-2">
          <Panel title="Nova categoria">
            <CategoryForm />
          </Panel>
        </div>
      </div>
    </>
  );
}
