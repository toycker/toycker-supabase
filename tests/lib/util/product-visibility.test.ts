import { describe, expect, it } from "vitest"

import {
  ACTIVE_PRODUCT_STATUS,
  DEFAULT_MANUAL_PRODUCT_STATUS,
  isStorefrontVisibleProduct,
} from "@/lib/util/product-visibility"

describe("product visibility rules", () => {
  it("publishes only active products to the storefront", () => {
    expect(isStorefrontVisibleProduct(ACTIVE_PRODUCT_STATUS)).toBe(true)
    expect(isStorefrontVisibleProduct("draft")).toBe(false)
    expect(isStorefrontVisibleProduct("archived")).toBe(false)
  })

  it("defaults manual product creation to draft", () => {
    expect(DEFAULT_MANUAL_PRODUCT_STATUS).toBe("draft")
  })
})
