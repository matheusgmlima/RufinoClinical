import { z } from "zod";

import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "./core";

export * from "./core";

// Server-side validation of what the browser sends. Unknown keys (e.g. prices) are stripped.
export const cartItemSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
});

export const cartSchema = z.array(cartItemSchema).max(MAX_CART_LINES);
