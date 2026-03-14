import { beforeEach, describe, expect, it, vi } from "vitest"

import { createClient } from "@/lib/supabase/server"
import {
  updateCustomer,
  updateCustomerAddress,
} from "@/lib/data/customer"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

vi.mock("@/lib/data/cookies", () => ({
  removeCartId: vi.fn(),
}))

describe("customer data actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ignores phone changes when updating customer metadata", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          user_metadata: {
            phone_number: "919876543210",
            loyalty_tier: "gold",
          },
        },
      },
      error: null,
    })
    const mockUpdateUser = vi.fn().mockResolvedValue({ error: null })

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: mockGetUser,
        updateUser: mockUpdateUser,
      },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    await updateCustomer({
      first_name: "Kartavya",
      phone: "0000000000",
    })

    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: {
        phone_number: "919876543210",
        loyalty_tier: "gold",
        first_name: "Kartavya",
      },
    })
  })

  it("uses the immutable account phone when updating a default billing address", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          phone: "919876543210",
          user_metadata: {
            phone_number: "919876543210",
          },
        },
      },
    })

    const existingAddressLookup = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          is_default_billing: true,
          is_default_shipping: false,
        },
        error: null,
      }),
    }
    existingAddressLookup.eq.mockReturnValue(existingAddressLookup)

    const profileLookup = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          phone: "919876543210",
        },
        error: null,
      }),
    }
    profileLookup.eq.mockReturnValue(profileLookup)

    const addressUpdate = {
      eq: vi.fn(),
    }
    addressUpdate.eq
      .mockReturnValueOnce(addressUpdate)
      .mockResolvedValueOnce({ error: null })

    const mockAddressUpdate = vi.fn().mockReturnValue(addressUpdate)
    const mockFrom = vi.fn((table: string) => {
      if (table === "addresses") {
        return {
          select: vi.fn().mockReturnValue(existingAddressLookup),
          update: mockAddressUpdate,
        }
      }

      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue(profileLookup),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: mockGetUser,
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const formData = new FormData()
    formData.set("addressId", "addr-1")
    formData.set("first_name", "Kartavya")
    formData.set("last_name", "Patel")
    formData.set("company", "")
    formData.set("address_1", "Mota Varachha")
    formData.set("address_2", "")
    formData.set("city", "Surat")
    formData.set("country_code", "IN")
    formData.set("province", "Gujarat")
    formData.set("postal_code", "394101")
    formData.set("phone", "0000000000")

    const result = await updateCustomerAddress({}, formData)

    expect(result).toEqual({ success: true, error: null })
    expect(mockAddressUpdate).toHaveBeenCalledWith({
      first_name: "Kartavya",
      last_name: "Patel",
      company: "",
      address_1: "Mota Varachha",
      address_2: "",
      city: "Surat",
      country_code: "in",
      province: "Gujarat",
      postal_code: "394101",
      phone: "9876543210",
      is_default_billing: true,
      is_default_shipping: false,
    })
  })
})
