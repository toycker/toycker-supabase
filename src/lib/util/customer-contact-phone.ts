function normalizePhoneValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : null
}

function getMetadataPhoneField(
  userMetadata: unknown,
  field: "phone_number" | "phone"
): string | null {
  if (
    typeof userMetadata !== "object" ||
    userMetadata === null ||
    Array.isArray(userMetadata)
  ) {
    return null
  }

  return normalizePhoneValue(
    (userMetadata as Record<string, unknown>)[field]
  )
}

type ResolveCustomerPhoneInput = {
  profilePhone?: string | null
  userMetadata?: unknown
  authPhone?: string | null
}

export function resolveCustomerPhone({
  profilePhone,
  userMetadata,
  authPhone,
}: ResolveCustomerPhoneInput): string | null {
  const resolvedProfilePhone = normalizePhoneValue(profilePhone)
  if (resolvedProfilePhone) {
    return resolvedProfilePhone
  }

  const resolvedMetadataPhoneNumber = getMetadataPhoneField(
    userMetadata,
    "phone_number"
  )
  if (resolvedMetadataPhoneNumber) {
    return resolvedMetadataPhoneNumber
  }

  const resolvedMetadataPhone = getMetadataPhoneField(userMetadata, "phone")
  if (resolvedMetadataPhone) {
    return resolvedMetadataPhone
  }

  return normalizePhoneValue(authPhone)
}
