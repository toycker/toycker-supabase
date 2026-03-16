import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Cart } from "@/lib/supabase/types"
import PaymentButton from "@modules/checkout/components/payment-button"

const { completeCheckoutMock, pushMock } = vi.hoisted(() => ({
  completeCheckoutMock: vi.fn(),
  pushMock: vi.fn(),
}))

vi.mock("@/lib/actions/complete-checkout", () => ({
  completeCheckout: completeCheckoutMock,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock("@stripe/react-stripe-js", () => ({
  useElements: () => null,
  useStripe: () => null,
}))

vi.mock("@modules/checkout/context/checkout-context", () => ({
  useCheckout: () => ({
    state: {
      isValid: true,
      paymentMethod: "pp_payu_payu",
      shippingAddress: {
        first_name: "John",
        last_name: "Doe",
        address_1: "123 Test Street",
        address_2: null,
        city: "Surat",
        province: "Gujarat",
        postal_code: "395009",
        country_code: "IN",
        phone: "9999999999",
        company: null,
      },
      billingAddress: {
        first_name: "John",
        last_name: "Doe",
        address_1: "123 Test Street",
        address_2: null,
        city: "Surat",
        province: "Gujarat",
        postal_code: "395009",
        country_code: "IN",
        phone: "9999999999",
        company: null,
      },
      email: "buyer@example.com",
      rewardsToApply: 0,
      saveAddress: false,
    },
    isPaymentUpdating: false,
  }),
}))

vi.mock("@modules/common/components/button", () => ({
  Button: ({
    children,
    isLoading,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode
    isLoading?: boolean
    size?: string
  }) => (
    <button type="button" {...props}>
      {isLoading ? "Loading" : children}
    </button>
  ),
}))

vi.mock("@modules/checkout/components/error-message", () => ({
  default: ({
    error,
    "data-testid": dataTestId,
  }: {
    error?: string | null
    "data-testid"?: string
  }) => (error ? <div data-testid={dataTestId}>{error}</div> : null),
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

describe("PaymentButton", () => {
  beforeEach(() => {
    completeCheckoutMock.mockReset()
    pushMock.mockReset()
  })

  it("keeps the submit action disabled when the selected payment method is temporarily unavailable", async () => {
    render(<PaymentButton cart={cart} data-testid="payment-button" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select a payment method" })).toBeDisabled()
    })

    expect(completeCheckoutMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
