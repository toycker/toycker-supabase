import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Cart } from "@/lib/supabase/types"
import Payment from "@modules/checkout/components/payment"

type CheckoutStateValue = {
  paymentMethod: string | null
}

const { checkoutContextStore } = vi.hoisted(() => ({
  checkoutContextStore: {
    current: undefined as
      | {
          state: CheckoutStateValue
          setPaymentMethod: ReturnType<typeof vi.fn>
        }
      | undefined,
  },
}))

vi.mock("@modules/checkout/context/checkout-context", () => ({
  useCheckout: () => {
    if (!checkoutContextStore.current) {
      throw new Error("Mock checkout context has not been initialized")
    }

    return checkoutContextStore.current
  },
}))

const cart: Cart = {
  id: "cart-1",
  user_id: "user-1",
  currency_code: "inr",
  created_at: "2026-03-13T10:00:00.000Z",
  updated_at: "2026-03-13T10:00:00.000Z",
  items: [],
  total: 1000,
}

describe("Payment", () => {
  beforeEach(() => {
    checkoutContextStore.current = {
      state: {
        paymentMethod: "pp_system_default",
      },
      setPaymentMethod: vi.fn(),
    }
  })

  it("shows the online payment option as coming soon and ignores clicks", () => {
    render(
      <Payment
        cart={cart}
        availablePaymentMethods={[
          { id: "pp_system_default", name: "Cash on Delivery" },
          { id: "pp_payu_payu", name: "PayU" },
        ]}
      />
    )

    const onlinePaymentOption = screen.getByTestId("payment-option-pp_payu_payu")

    expect(screen.getByText("Coming Soon")).toBeInTheDocument()
    expect(onlinePaymentOption).toHaveAttribute("aria-disabled", "true")

    fireEvent.click(onlinePaymentOption)

    expect(checkoutContextStore.current?.setPaymentMethod).not.toHaveBeenCalled()
  })

  it("auto-selects the first enabled payment method when a disabled method appears first", async () => {
    checkoutContextStore.current = {
      state: {
        paymentMethod: null,
      },
      setPaymentMethod: vi.fn(),
    }

    render(
      <Payment
        cart={cart}
        availablePaymentMethods={[
          { id: "pp_payu_payu", name: "PayU" },
          { id: "pp_system_default", name: "Cash on Delivery" },
        ]}
      />
    )

    await waitFor(() => {
      expect(checkoutContextStore.current?.setPaymentMethod).toHaveBeenCalledWith(
        "pp_system_default"
      )
    })
  })
})
