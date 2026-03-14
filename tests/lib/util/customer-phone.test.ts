import { describe, expect, it } from "vitest"

import { resolveCustomerPhone } from "@/lib/util/customer-contact-phone"

describe("resolveCustomerPhone", () => {
  it("prefers the profile phone when available", () => {
    expect(
      resolveCustomerPhone({
        profilePhone: "919812345678",
        userMetadata: {
          phone_number: "919800000000",
          phone: "919811111111",
        },
        authPhone: "919822222222",
      })
    ).toBe("919812345678")
  })

  it("falls back to auth metadata and auth phone when the profile phone is blank", () => {
    expect(
      resolveCustomerPhone({
        profilePhone: "   ",
        userMetadata: {
          phone_number: "919800000000",
        },
        authPhone: "919822222222",
      })
    ).toBe("919800000000")

    expect(
      resolveCustomerPhone({
        profilePhone: null,
        userMetadata: {
          phone: "919811111111",
        },
        authPhone: "919822222222",
      })
    ).toBe("919811111111")

    expect(
      resolveCustomerPhone({
        profilePhone: null,
        userMetadata: null,
        authPhone: "919822222222",
      })
    ).toBe("919822222222")
  })
})
