import { beforeEach, describe, expect, it, vi } from "vitest"

import { createClient } from "@/lib/supabase/server"
import {
  CheckoutData,
  completeCheckout,
} from "@/lib/actions/complete-checkout"
import * as cartData from "@lib/data/cart"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}))

vi.mock("@lib/data/cart", () => ({
  initiatePaymentSession: vi.fn(),
  retrieveCart: vi.fn(),
  handlePostOrderLogic: vi.fn(),
  saveCheckoutAddresses: vi.fn(),
}))

const mockCheckoutData: CheckoutData = {
  cartId: "test-cart-id",
  email: "test@example.com",
  shippingAddress: {
    first_name: "John",
    last_name: "Doe",
    address_1: "123 Test St",
    address_2: null,
    city: "Test City",
    province: "Gujarat",
    postal_code: "12345",
    country_code: "IN",
    phone: "9999999999",
  },
  billingAddress: {
    first_name: "John",
    last_name: "Doe",
    address_1: "123 Test St",
    address_2: null,
    city: "Test City",
    province: "Gujarat",
    postal_code: "12345",
    country_code: "IN",
    phone: "9999999999",
  },
  paymentMethod: "payu",
  rewardsToApply: 0,
  saveAddress: true,
}

type MockUser = {
  id: string
  phone?: string | null
  user_metadata?: Record<string, unknown>
}

function buildSupabaseMock({
  user = null,
  profileRow = null,
}: {
  user?: MockUser | null
  profileRow?: { first_name: string | null; last_name: string | null; phone: string | null } | null
}) {
  const mockRpc = vi
    .fn()
    .mockResolvedValue({ data: { order_id: "new-order-id" }, error: null })
  const mockGetUser = vi.fn().mockResolvedValue({ data: { user } })

  const mockOrderSingle = vi.fn().mockResolvedValue({
    data: {
      id: "new-order-id",
      payment_collection: {
        payment_sessions: [
          {
            id: "session-1",
            provider_id: "payu",
            amount: 1000,
            status: "pending",
            data: { hash: "abc" },
          },
        ],
      },
    },
    error: null,
  })
  const mockOrderEq = vi.fn().mockReturnValue({ single: mockOrderSingle })
  const mockOrderSelect = vi.fn().mockReturnValue({ eq: mockOrderEq })

  const mockProfileMaybeSingle = vi.fn().mockResolvedValue({
    data: profileRow,
    error: null,
  })
  const mockProfileSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: mockProfileMaybeSingle,
    }),
  })
  const mockProfileUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const mockProfileUpdate = vi.fn().mockReturnValue({ eq: mockProfileUpdateEq })

  const mockFrom = vi.fn((table: string) => {
    if (table === "orders") {
      return { select: mockOrderSelect }
    }

    if (table === "profiles") {
      return {
        select: mockProfileSelect,
        update: mockProfileUpdate,
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  vi.mocked(createClient).mockResolvedValue({
    rpc: mockRpc,
    from: mockFrom,
    auth: { getUser: mockGetUser },
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  return {
    mockRpc,
    mockProfileUpdate,
    mockProfileUpdateEq,
  }
}

describe("completeCheckout Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should successfully complete checkout", async () => {
    const { mockRpc } = buildSupabaseMock({})

    vi.mocked(cartData.initiatePaymentSession).mockResolvedValue(undefined)
    vi.mocked(cartData.retrieveCart).mockResolvedValue({ id: "test-cart-id" } as never)
    vi.mocked(cartData.handlePostOrderLogic).mockResolvedValue(undefined)

    const result = await completeCheckout(mockCheckoutData)

    expect(result.success).toBe(true)
    expect(result.orderId).toBe("new-order-id")
    expect(result.paymentData).toEqual({ hash: "abc" })
    expect(cartData.initiatePaymentSession).toHaveBeenCalledWith(
      { id: "test-cart-id" },
      expect.objectContaining({
        customerAddress: mockCheckoutData.billingAddress,
      })
    )
    expect(mockRpc).toHaveBeenCalledWith(
      "create_order_with_payment",
      expect.anything()
    )
  })

  it("should seed blank profile fields from billing and save both checkout addresses", async () => {
    const { mockProfileUpdate } = buildSupabaseMock({
      user: { id: "user-1" },
      profileRow: {
        first_name: "",
        last_name: "",
        phone: "",
      },
    })

    vi.mocked(cartData.initiatePaymentSession).mockResolvedValue(undefined)
    vi.mocked(cartData.retrieveCart).mockResolvedValue({ id: "test-cart-id" } as never)
    vi.mocked(cartData.handlePostOrderLogic).mockResolvedValue(undefined)
    vi.mocked(cartData.saveCheckoutAddresses).mockResolvedValue(undefined)

    const result = await completeCheckout(mockCheckoutData)

    expect(result.success).toBe(true)
    expect(mockProfileUpdate).toHaveBeenCalledWith({
      contact_email: "test@example.com",
      first_name: "John",
      last_name: "Doe",
      phone: "9999999999",
    })
    expect(cartData.saveCheckoutAddresses).toHaveBeenCalledWith({
      billingAddress: expect.objectContaining({
        first_name: "John",
        country_code: "in",
      }),
      shippingAddress: expect.objectContaining({
        first_name: "John",
        country_code: "in",
      }),
      userId: "user-1",
    })
  })

  it("should override authenticated billing phone with the immutable account phone", async () => {
    const { mockRpc } = buildSupabaseMock({
      user: {
        id: "user-1",
        phone: "919876543210",
        user_metadata: {
          phone_number: "919876543210",
        },
      },
      profileRow: {
        first_name: "John",
        last_name: "Doe",
        phone: "919876543210",
      },
    })

    vi.mocked(cartData.initiatePaymentSession).mockResolvedValue(undefined)
    vi.mocked(cartData.retrieveCart).mockResolvedValue({ id: "test-cart-id" } as never)
    vi.mocked(cartData.handlePostOrderLogic).mockResolvedValue(undefined)
    vi.mocked(cartData.saveCheckoutAddresses).mockResolvedValue(undefined)

    await completeCheckout({
      ...mockCheckoutData,
      billingAddress: {
        ...mockCheckoutData.billingAddress,
        phone: "1111111111",
      },
    })

    expect(cartData.initiatePaymentSession).toHaveBeenCalledWith(
      { id: "test-cart-id" },
      expect.objectContaining({
        customerAddress: expect.objectContaining({
          phone: "9876543210",
        }),
      })
    )
    expect(mockRpc).toHaveBeenCalledWith(
      "create_order_with_payment",
      expect.objectContaining({
        p_billing_address: expect.objectContaining({
          phone: "9876543210",
        }),
      })
    )
    expect(cartData.saveCheckoutAddresses).toHaveBeenCalledWith(
      expect.objectContaining({
        billingAddress: expect.objectContaining({
          phone: "9876543210",
        }),
      })
    )
  })

  it("should handle order creation failure", async () => {
    const mockRpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "DB Error" } })
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } })

    vi.mocked(createClient).mockResolvedValue({
      rpc: mockRpc,
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const result = await completeCheckout(mockCheckoutData)

    expect(result.success).toBe(false)
    expect(result.error).toBe("DB Error")
  })

  it("should validate input data using Zod", async () => {
    const invalidCheckoutData = {
      cartId: "",
      email: "invalid",
    } as unknown as CheckoutData

    const result = await completeCheckout(invalidCheckoutData)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
