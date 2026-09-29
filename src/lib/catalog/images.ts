import { publicEnv } from "@/lib/env/public";

export function productImageUrl(storagePath: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${encodeURI(storagePath)}`;
}
