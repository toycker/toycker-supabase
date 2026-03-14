import { beforeEach, describe, expect, it, vi } from "vitest"

import { createClient } from "@/lib/supabase/server"
import { ACTIVE_PRODUCT_STATUS } from "@/lib/util/product-visibility"
import {
  getProductByHandle,
  listPaginatedProducts,
  listProducts,
} from "@/lib/data/products"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

function buildSupabaseClient(query: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(query),
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>
}

function createListProductsQuery() {
  const query = {
    eq: vi.fn(),
    in: vi.fn(),
    neq: vi.fn(),
    limit: vi.fn(),
    order: vi.fn().mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    }),
  }

  query.eq.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.neq.mockReturnValue(query)
  query.limit.mockReturnValue(query)

  return query
}

function createGetProductQuery() {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  }

  query.eq.mockReturnValue(query)

  return query
}

function createPaginatedProductsQuery() {
  const query = {
    eq: vi.fn(),
    in: vi.fn(),
    ilike: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
    range: vi.fn().mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    }),
  }

  query.eq.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.ilike.mockReturnValue(query)
  query.gt.mockReturnValue(query)
  query.order.mockReturnValue(query)

  return query
}

describe("storefront product data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("filters listProducts to active products", async () => {
    const query = createListProductsQuery()

    vi.mocked(createClient).mockResolvedValue(buildSupabaseClient(query))

    await listProducts()

    expect(query.eq).toHaveBeenCalledWith("status", ACTIVE_PRODUCT_STATUS)
  })

  it("filters direct handle lookup to active products", async () => {
    const query = createGetProductQuery()

    vi.mocked(createClient).mockResolvedValue(buildSupabaseClient(query))

    await getProductByHandle("toy-car")

    expect(query.eq).toHaveBeenNthCalledWith(
      1,
      "status",
      ACTIVE_PRODUCT_STATUS
    )
    expect(query.eq).toHaveBeenNthCalledWith(2, "handle", "toy-car")
  })

  it("filters paginated storefront listings to active products", async () => {
    const query = createPaginatedProductsQuery()

    vi.mocked(createClient).mockResolvedValue(buildSupabaseClient(query))

    await listPaginatedProducts({
      page: 1,
      limit: 12,
      sortBy: "featured",
    })

    expect(query.eq).toHaveBeenCalledWith("status", ACTIVE_PRODUCT_STATUS)
  })
})
