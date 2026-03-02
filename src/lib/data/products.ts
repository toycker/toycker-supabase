"use server"

import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { Product } from "@/lib/supabase/types"
import { SortOptions } from "@modules/store/components/refinement-list/types"

import { normalizeProductImage } from "@lib/util/images"

type QueryError = {
  message?: string
  code?: string
  status?: number
}

const RETRY_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 400

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

function toQueryError(error: unknown): QueryError | null {
  if (!error || typeof error !== "object") return null

  const record = error as Record<string, unknown>

  return {
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
  }
}

function isTransientUpstreamError(error: unknown): boolean {
  const parsedError = toQueryError(error)
  if (!parsedError) return false

  const rawMessage = parsedError.message ?? ""
  const message = rawMessage.toLowerCase()
  const status = parsedError.status ?? null

  if (status === 502 || status === 503 || status === 504) {
    return true
  }

  return (
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("bad gateway") ||
    message.includes("cloudflare") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("timeout")
  )
}

async function runProductQueryWithRetry<T extends { error: unknown }>(
  execute: () => PromiseLike<T>,
  operationName: string
): Promise<T> {
  let lastResult: T | null = null

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const result = await execute()
    lastResult = result

    if (!result.error) {
      return result
    }

    const shouldRetry = isTransientUpstreamError(result.error) && attempt < RETRY_ATTEMPTS
    if (!shouldRetry) {
      break
    }

    const delay = RETRY_BASE_DELAY_MS * attempt
    console.warn(
      `${operationName} transient upstream error on attempt ${attempt}/${RETRY_ATTEMPTS}; retrying in ${delay}ms`
    )
    await sleep(delay)
  }

  if (lastResult) {
    return lastResult
  }

  throw new Error(`${operationName} failed without result`)
}

const PRODUCT_SELECT = `
  *, 
  variants:product_variants(*), 
  options:product_options(*, values:product_option_values(*)),
  related_combinations:product_combinations!product_id(
    *,
    related_product:products!related_product_id(
      *,
      variants:product_variants(*), 
      options:product_options(*, values:product_option_values(*))
    )
  )
`

export const listProducts = cache(async function listProducts(options: {
  regionId?: string
  queryParams?: {
    limit?: number
    collection_id?: string[]
    category_id?: string[]
    exclude_id?: string
  }
} = {}): Promise<{ response: { products: Product[]; count: number } }> {
  const supabase = await createClient()

  let selectString = PRODUCT_SELECT
  const joins: string[] = []

  if (options.queryParams?.collection_id?.length) {
    joins.push(`product_collections!inner(collection_id)`)
  }
  if (options.queryParams?.category_id?.length) {
    joins.push(`product_categories!inner(category_id)`)
  }

  if (joins.length > 0) {
    selectString = `${PRODUCT_SELECT}, ${joins.join(', ')}`
  }

  let query = supabase
    .from("products")
    .select(selectString, { count: "exact" })

  if (options.queryParams?.collection_id?.length) {
    query = query.in("product_collections.collection_id", options.queryParams.collection_id)
  }

  if (options.queryParams?.category_id?.length) {
    query = query.in("product_categories.category_id", options.queryParams.category_id)
  }

  if (options.queryParams?.exclude_id) {
    query = query.neq("id", options.queryParams.exclude_id)
  }

  // Apply limit AFTER exclusions and filters
  if (options.queryParams?.limit) {
    query = query.limit(options.queryParams.limit)
  }

  const { data, count, error } = await runProductQueryWithRetry(
    () => query.order("created_at", { ascending: false }),
    "listProducts"
  )

  if (error) {
    console.error("Error listing products:", error.message)
    return { response: { products: [], count: 0 } }
  }

  const products = (data || []).map((p) => normalizeProductImage(p as unknown as Product))
  return { response: { products, count: count || 0 } }
})

export const retrieveProduct = cache(async function retrieveProduct(id: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return null
  return normalizeProductImage(data as Product)
})

export const getProductByHandle = cache(async function getProductByHandle(handle: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("handle", handle)
    .maybeSingle()

  if (error || !data) return null
  return normalizeProductImage(data as Product)
})

export const listPaginatedProducts = cache(async function listPaginatedProducts({
  page = 1,
  limit = 12,
  sortBy = "featured",
  queryParams,
  priceFilter,
  availability,
  ageFilter,
}: {
  page?: number
  limit?: number
  sortBy?: SortOptions
  countryCode?: string
  queryParams?: Record<string, string[] | string | undefined>
  availability?: string
  priceFilter?: { min?: number; max?: number }
  ageFilter?: string
}) {
  const supabase = await createClient()
  const offset = (page - 1) * limit

  // Determine if we need joins for category or collection filtering
  const categoryIds = queryParams?.category_id
    ? (Array.isArray(queryParams.category_id) ? queryParams.category_id : [queryParams.category_id])
    : []
  const collectionIds = queryParams?.collection_id
    ? (Array.isArray(queryParams.collection_id) ? queryParams.collection_id : [queryParams.collection_id])
    : []

  const needsCategoryJoin = categoryIds.length > 0
  const needsCollectionJoin = collectionIds.length > 0
  const needsPriceFilter = priceFilter?.min !== undefined || priceFilter?.max !== undefined

  // Build query with appropriate SELECT based on join requirements
  // When price filter is applied, we need to join variants to get accurate min price
  let query = needsCategoryJoin
    ? supabase.from("products").select(`
        ${PRODUCT_SELECT},
        product_categories!inner(category_id)
      `, { count: "exact" })
    : needsCollectionJoin
      ? supabase.from("products").select(`
        ${PRODUCT_SELECT},
        product_collections!inner(collection_id)
      `, { count: "exact" })
      : supabase.from("products").select(PRODUCT_SELECT, { count: "exact" })

  // Chain filters WITHOUT recreating the query object
  if (needsCategoryJoin) {
    query = query.in("product_categories.category_id", categoryIds)
  }

  if (needsCollectionJoin) {
    query = query.in("product_collections.collection_id", collectionIds)
  }

  if (queryParams?.id) {
    const ids = Array.isArray(queryParams.id) ? queryParams.id : [queryParams.id]
    query = query.in("id", ids)
  }

  if (queryParams?.q) {
    query = query.ilike("name", `%${queryParams.q}%`)
  }

  // NOTE: Price filtering is done CLIENT-SIDE after fetching
  // because we need to filter by variant prices, not just product.price
  // See the client-side filter logic below

  // Apply availability filter
  if (availability) {
    if (availability === 'in_stock') {
      query = query.gt("stock_count", 0)
    } else if (availability === 'out_of_stock') {
      query = query.eq("stock_count", 0)
    }
  }

  // Apply sorting
  const sortConfigs: Record<string, { col: string; asc: boolean }> = {
    price_asc: { col: "price", asc: true },
    price_desc: { col: "price", asc: false },
    alpha_asc: { col: "name", asc: true },
    alpha_desc: { col: "name", asc: false },
    featured: { col: "created_at", asc: false },
  }

  const sort = sortConfigs[sortBy] || sortConfigs.featured
  query = query.order(sort.col, { ascending: sort.asc })

  // Apply pagination only if NOT doing client-side filtering
  // If we have a price filter, we must fetch everything to find matches and then paginate manually
  const needsClientSideFiltering = priceFilter?.min !== undefined || priceFilter?.max !== undefined

  const { data, count, error } = await runProductQueryWithRetry(
    () =>
      needsClientSideFiltering
        ? query
        : query.range(offset, offset + limit - 1),
    "listPaginatedProducts"
  )

  if (error) {
    return { response: { products: [], count: 0 }, pagination: { page, limit } }
  }

  let products = (data || []).map((p) => normalizeProductImage(p as Product))

  // Apply price filtering (only when price filter is active)
  if (needsClientSideFiltering) {
    products = products.filter((product) => {
      // Calculate the actual displayed price (same logic as getProductPrice)
      let displayPrice = product.price

      if (product.variants && product.variants.length > 0) {
        // Find cheapest variant price
        const cheapestVariant = [...product.variants].sort((a, b) => a.price - b.price)[0]
        displayPrice = cheapestVariant.price
      }

      // Exclude products with price 0 when price filter is active
      if (displayPrice === 0) {
        return false
      }

      // Apply min filter
      if (priceFilter!.min !== undefined && displayPrice < priceFilter!.min) {
        return false
      }

      // Apply max filter
      if (priceFilter!.max !== undefined && displayPrice > priceFilter!.max) {
        return false
      }

      return true
    })

    // Update total count after filtering
    const totalFilteredCount = products.length

    // Manual offset/limit for paginated response
    const paginatedProducts = products.slice(offset, offset + limit)

    return {
      response: {
        products: paginatedProducts,
        count: totalFilteredCount,
      },
      pagination: { page, limit },
    }
  }

  return {
    response: {
      products,
      count: count || 0,
    },
    pagination: { page, limit },
  }
})