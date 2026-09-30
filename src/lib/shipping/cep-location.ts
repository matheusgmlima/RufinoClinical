import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UFS } from "@/lib/validation/br";

// BrasilAPI (v2) gives the city, the state and, for most CEPs, coordinates. They are often the
// center of the city or neighborhood, so the distance to the stock tells whether a courier reaches
// the address, not the exact route.
const coordinate = (min: number, max: number) =>
  z
    .string()
    .regex(/^-?\d{1,3}(\.\d+)?$/)
    .transform(Number)
    .refine((value) => value >= min && value <= max);

const brasilApiSchema = z.object({
  city: z.string().trim().min(1).max(80),
  state: z.enum(UFS),
  location: z.object({ coordinates: z.unknown() }).partial().optional(),
});
// Missing or empty for some CEPs.
const pointSchema = z.object({ latitude: coordinate(-34, 6), longitude: coordinate(-75, -28) });

type Place = { city: string; state: string; latitude: number | null; longitude: number | null };

async function fetchPlace(cep: string): Promise<Place | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const parsed = brasilApiSchema.safeParse(await res.json());
    if (!parsed.success) return null;
    const point = pointSchema.safeParse(parsed.data.location?.coordinates).data;
    return {
      city: parsed.data.city,
      state: parsed.data.state,
      latitude: point ? Number(point.latitude.toFixed(6)) : null,
      longitude: point ? Number(point.longitude.toFixed(6)) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Makes sure the CEP is in public.cep_locations, which the database uses to price shipping (region
 * by state, local delivery by distance). Only CEPs the API knows are stored, so the cache holds
 * real places. Returns whether the CEP is known; never throws (a failure means no local options).
 */
export async function ensureCepLocation(cep: string): Promise<boolean> {
  if (!/^\d{8}$/.test(cep)) return false;
  try {
    // A cached CEP comes back with its city: no service role on the common path.
    const { data } = await (await createClient()).rpc("estimate_shipping", { p_zip: cep });
    if (typeof (data as { city?: unknown } | null)?.city === "string") return true;
    return await cachePlace(cep);
  } catch (err) {
    console.error("cep lookup failed", err);
    return false;
  }
}

async function cachePlace(cep: string): Promise<boolean> {
  const db = createAdminClient();
  const place = await fetchPlace(cep);
  if (!place) return false;
  if (place.latitude === null) {
    // No point for this CEP: another one in the same city is as close as the API usually gets.
    const { data: neighbor } = await db
      .from("cep_locations")
      .select("latitude, longitude")
      .eq("city", place.city)
      .eq("state", place.state)
      .not("latitude", "is", null)
      .limit(1)
      .maybeSingle();
    place.latitude = neighbor?.latitude ?? null;
    place.longitude = neighbor?.longitude ?? null;
  }

  const { error } = await db.from("cep_locations").upsert({ cep, ...place }, { onConflict: "cep", ignoreDuplicates: true });
  if (error) console.error("cep cache write failed", error.message);
  return !error;
}

/** Whether the CEP has coordinates (the stock needs them for local delivery). */
export async function cepHasLocation(cep: string): Promise<boolean> {
  if (!(await ensureCepLocation(cep))) return false;
  try {
    const { data } = await createAdminClient().from("cep_locations").select("latitude").eq("cep", cep).maybeSingle();
    return data?.latitude != null;
  } catch (err) {
    console.error("cep lookup failed", err);
    return false;
  }
}
