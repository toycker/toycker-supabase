import type { Product } from "@/lib/supabase/types"

export const ACTIVE_PRODUCT_STATUS: Product["status"] = "active"
export const DEFAULT_MANUAL_PRODUCT_STATUS: Product["status"] = "draft"

export function isStorefrontVisibleProduct(
  status: Product["status"] | null | undefined
): status is typeof ACTIVE_PRODUCT_STATUS {
  return status === ACTIVE_PRODUCT_STATUS
}
