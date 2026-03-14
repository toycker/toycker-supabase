import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Order } from "@/lib/supabase/types"
import OrderDetails from "@modules/order/components/order-details"

const buildOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "order-1",
  user_id: "user-1",
  display_id: 101,
  customer_email: "buyer@example.com",
  email: "buyer@example.com",
  promo_code: null,
  total_amount: 1000,
  currency_code: "inr",
  status: "order_placed",
  fulfillment_status: "not_shipped",
  payment_status: "captured",
  payu_txn_id: null,
  shipping_address: {
    first_name: "Receiver",
    last_name: "Name",
    address_1: "123 Delivery Street",
    address_2: null,
    city: "Surat",
    country_code: "in",
    province: "Gujarat",
    postal_code: "395003",
    phone: "9999999999",
    company: null,
  },
  billing_address: null,
  shipping_method: null,
  shipping_methods: [],
  shipping_partner_id: null,
  shipping_partner: null,
  tracking_number: null,
  payment_method: "cod",
  payment_collection: null,
  metadata: null,
  created_at: "2026-03-14T10:00:00.000Z",
  updated_at: "2026-03-14T10:00:00.000Z",
  items: [],
  total: 1000,
  subtotal: 1000,
  tax_total: 0,
  shipping_total: 0,
  discount_total: 0,
  gift_card_total: 0,
  payment_collections: [],
  ...overrides,
})

describe("OrderDetails", () => {
  it("shows the account customer phone instead of the shipping phone", () => {
    render(
      <OrderDetails
        order={buildOrder()}
        customerPhone="919876543210"
      />
    )

    expect(screen.getByText("buyer@example.com")).toBeInTheDocument()
    expect(screen.getByText("919876543210")).toBeInTheDocument()
    expect(screen.queryByText("9999999999")).not.toBeInTheDocument()
  })

  it("omits the phone line when no customer phone is provided", () => {
    render(<OrderDetails order={buildOrder()} customerPhone={null} />)

    expect(screen.getByText("buyer@example.com")).toBeInTheDocument()
    expect(screen.queryByText("9999999999")).not.toBeInTheDocument()
  })
})
