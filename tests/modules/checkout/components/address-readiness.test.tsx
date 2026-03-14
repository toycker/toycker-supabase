import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Cart, CustomerProfile } from "@/lib/supabase/types"
import BillingAddress from "@modules/checkout/components/billing_address"
import PaymentButton from "@modules/checkout/components/payment-button"
import ShippingAddress from "@modules/checkout/components/shipping-address"
import { useCheckout } from "@modules/checkout/context/checkout-context"
import {
  Address as CheckoutAddress,
  useCheckoutState,
} from "@modules/checkout/hooks/useCheckoutState"

const { completeCheckoutMock, pushMock } = vi.hoisted(() => ({
  completeCheckoutMock: vi.fn(),
  pushMock: vi.fn(),
}))

type TestCheckoutContextValue = {
  state: {
    email: string | null
    shippingAddress: unknown
    billingAddress: unknown
    paymentMethod: string | null
    shippingSameAsBilling: boolean
    saveAddress: boolean
    rewardsToApply: number
    isValid: boolean
  }
  setEmail: (_email: string) => void
  setShippingAddress: (_address: CheckoutAddress) => void
  setBillingAddress: (_address: CheckoutAddress) => void
  setPaymentMethod: (_method: string) => void
  toggleShippingSameAsBilling: () => void
  setSaveAddress: (_save: boolean) => void
  setRewardsToApply: (_points: number) => void
  reset: () => void
  isPaymentUpdating: boolean
}

const { checkoutContextStore } = vi.hoisted(() => ({
  checkoutContextStore: {
    current: undefined as TestCheckoutContextValue | undefined,
  },
}))

vi.mock("@/lib/actions/complete-checkout", () => ({
  completeCheckout: completeCheckoutMock,
}))

vi.mock("@modules/checkout/context/checkout-context", () => ({
  useCheckout: () => {
    if (!checkoutContextStore.current) {
      throw new Error("Mock checkout context has not been initialized")
    }

    return checkoutContextStore.current
  },
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

const cart: Cart = {
  id: "cart-1",
  user_id: "user-1",
  email: "buyer@example.com",
  currency_code: "inr",
  created_at: "2026-03-13T10:00:00.000Z",
  updated_at: "2026-03-13T10:00:00.000Z",
  items: [],
  total: 1000,
  region: {
    id: "region-1",
    name: "India",
    currency_code: "inr",
    countries: [
      {
        id: "country-in",
        iso_2: "in",
        display_name: "India",
      },
    ],
  },
}

const authenticatedCustomer: CustomerProfile = {
  id: "user-1",
  email: "buyer@example.com",
  first_name: "Kartavya",
  last_name: "Patel",
  phone: "919876543210",
  created_at: "2026-03-13T10:00:00.000Z",
  addresses: [
    {
      id: "addr-1",
      first_name: "Kartavya",
      last_name: "Patel",
      address_1: "Saved Address",
      address_2: null,
      city: "Surat",
      country_code: "in",
      province: "Gujarat",
      postal_code: "395009",
      phone: "9999999999",
      company: null,
      is_default_billing: true,
      is_default_shipping: false,
    },
  ],
}

function createCheckoutContextValue(
  overrides: Partial<TestCheckoutContextValue> = {}
): TestCheckoutContextValue {
  return {
    state: {
      email: null,
      shippingAddress: null,
      billingAddress: null,
      paymentMethod: "pp_system_default",
      shippingSameAsBilling: true,
      saveAddress: true,
      rewardsToApply: 0,
      isValid: false,
    },
    setEmail: vi.fn(),
    setShippingAddress: vi.fn(),
    setBillingAddress: vi.fn(),
    setPaymentMethod: vi.fn(),
    toggleShippingSameAsBilling: vi.fn(),
    setSaveAddress: vi.fn(),
    setRewardsToApply: vi.fn(),
    reset: vi.fn(),
    isPaymentUpdating: false,
    ...overrides,
  }
}

function AddressForms({ testCart }: { testCart: Cart }) {
  const { state, toggleShippingSameAsBilling } = useCheckout()

  return (
    <>
      <BillingAddress
        customer={null}
        cart={testCart}
        checked={state.shippingSameAsBilling}
        onChange={toggleShippingSameAsBilling}
      />
      {!state.shippingSameAsBilling && (
        <ShippingAddress customer={null} cart={testCart} />
      )}
    </>
  )
}

function CheckoutHarness({ testCart }: { testCart: Cart }) {
  const checkout = useCheckoutState({
    paymentMethod: "pp_system_default",
  })

  checkoutContextStore.current = {
    ...checkout,
    isPaymentUpdating: false,
  }

  return (
    <>
      <AddressForms testCart={testCart} />
      <PaymentButton cart={testCart} data-testid="submit-order-button" />
    </>
  )
}

function fillBillingAddress() {
  fireEvent.change(screen.getByTestId("billing-first-name-input"), {
    target: { value: "Kartavya" },
  })
  fireEvent.change(screen.getByTestId("billing-last-name-input"), {
    target: { value: "Patel" },
  })
  fireEvent.change(screen.getByTestId("billing-address-input"), {
    target: { value: "Mota Varachha" },
  })
  fireEvent.change(screen.getByTestId("billing-postal-input"), {
    target: { value: "39410" },
  })
  fireEvent.change(screen.getByTestId("billing-city-input"), {
    target: { value: "Surat" },
  })
  fireEvent.change(screen.getByTestId("billing-email-input"), {
    target: { value: "kartavya@example.com" },
  })
  fireEvent.change(screen.getByTestId("billing-phone-input"), {
    target: { value: "9265348797" },
  })
}

describe("checkout address readiness", () => {
  beforeEach(() => {
    completeCheckoutMock.mockReset()
    pushMock.mockReset()
  })

  it("keeps shipping phone blank and blocks checkout until a separate delivery phone is entered", async () => {
    render(<CheckoutHarness testCart={cart} />)

    fillBillingAddress()

    await waitFor(() => {
      expect(screen.getByTestId("submit-order-button")).not.toBeDisabled()
    })

    fireEvent.click(screen.getByTestId("shipping-address-checkbox"))

    const shippingPhoneInput = await screen.findByTestId("shipping-phone-input")

    expect(shippingPhoneInput).toHaveValue("")
    expect(screen.getByTestId("submit-order-button")).toBeDisabled()

    fireEvent.change(shippingPhoneInput, {
      target: { value: "9876543210" },
    })

    await waitFor(() => {
      expect(screen.getByTestId("submit-order-button")).not.toBeDisabled()
    })
  })

  it("enables place order when billing is completed and shipping matches billing", async () => {
    render(<CheckoutHarness testCart={cart} />)

    const submitButton = screen.getByTestId("submit-order-button")

    expect(screen.queryByTestId("shipping-first-name-input")).not.toBeInTheDocument()

    fillBillingAddress()

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled()
    })
  })

  it("submits the manually entered shipping phone when delivery address is different", async () => {
    completeCheckoutMock.mockResolvedValue({
      success: true,
      orderId: "order-1",
      paymentData: null,
    })
    pushMock.mockReset()

    render(<CheckoutHarness testCart={cart} />)

    fillBillingAddress()

    await waitFor(() => {
      expect(screen.getByTestId("submit-order-button")).not.toBeDisabled()
    })

    fireEvent.click(screen.getByTestId("shipping-address-checkbox"))

    const shippingFirstNameInput = await screen.findByTestId(
      "shipping-first-name-input"
    )

    expect(shippingFirstNameInput).toHaveValue("Kartavya")
    expect(screen.getByTestId("shipping-address-input")).toHaveValue(
      "Mota Varachha"
    )
    expect(screen.getByTestId("shipping-phone-input")).toHaveValue("")
    expect(screen.getByTestId("submit-order-button")).toBeDisabled()

    fireEvent.change(screen.getByTestId("shipping-address-input"), {
      target: { value: "Adajan" },
    })
    fireEvent.change(screen.getByTestId("shipping-phone-input"), {
      target: { value: "9876543210" },
    })

    await waitFor(() => {
      expect(screen.getByTestId("submit-order-button")).not.toBeDisabled()
    })

    fireEvent.click(screen.getByTestId("submit-order-button"))

    await waitFor(() => {
      expect(completeCheckoutMock).toHaveBeenCalledTimes(1)
    })

    expect(completeCheckoutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingAddress: expect.objectContaining({
          phone: "9876543210",
        }),
      })
    )
  })

  it("initializes billing checkout state with a real default country code", async () => {
    const setBillingAddress = vi.fn()
    checkoutContextStore.current = createCheckoutContextValue({
      setBillingAddress,
    })

    render(
      <BillingAddress
        customer={null}
        cart={cart}
        checked
        onChange={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(setBillingAddress).toHaveBeenCalled()
    })

    expect(setBillingAddress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        country_code: "in",
      })
    )
  })

  it("locks the billing phone to the authenticated account phone", () => {
    checkoutContextStore.current = createCheckoutContextValue()

    render(
      <BillingAddress
        customer={authenticatedCustomer}
        cart={{
          ...cart,
          billing_address: {
            ...authenticatedCustomer.addresses[0],
            postal_code: "",
          },
        }}
        checked
        onChange={vi.fn()}
      />
    )

    const billingPhoneInput = screen.getByTestId("billing-phone-input")

    expect(billingPhoneInput).toHaveValue("9876543210")
    expect(billingPhoneInput).toHaveAttribute("readonly")
  })
})
