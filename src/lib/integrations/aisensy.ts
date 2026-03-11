"use server"

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

type SendAiSensyAuthenticationOtpParams = {
  destination: string
  otpCode: string
  userName: string
}

type SendAiSensyAuthenticationOtpResult = {
  providerMessageId?: string
}

const DEFAULT_AISENSY_BASE_URL = "https://backend.aisensy.com/campaign/t1/api/v2"

function getTrimmedEnv(key: string): string | null {
  const value = process.env[key]?.trim()
  return value ? value : null
}

function getRequiredEnv(key: string): string {
  const value = getTrimmedEnv(key)

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function replacePlaceholders(
  value: JsonValue,
  replacements: Record<string, string>
): JsonValue {
  if (typeof value === "string") {
    return Object.entries(replacements).reduce((result, [key, replacement]) => {
      const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, "g")
      return result.replace(pattern, replacement)
    }, value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholders(item, replacements))
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        replacePlaceholders(nestedValue, replacements),
      ])
    )
  }

  return value
}

function getExtraPayload(
  replacements: Record<string, string>
): Record<string, JsonValue> {
  const raw = getTrimmedEnv("AISENSY_AUTH_TEMPLATE_EXTRA_PAYLOAD_JSON")

  if (!raw) {
    return {}
  }

  let parsed: JsonValue

  try {
    parsed = JSON.parse(raw) as JsonValue
  } catch {
    throw new Error("AISENSY_AUTH_TEMPLATE_EXTRA_PAYLOAD_JSON must be valid JSON")
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(
      "AISENSY_AUTH_TEMPLATE_EXTRA_PAYLOAD_JSON must be a JSON object"
    )
  }

  return replacePlaceholders(parsed, replacements) as Record<string, JsonValue>
}

function extractProviderMessageId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const queue: unknown[] = [value]

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current || typeof current !== "object") {
      continue
    }

    for (const [key, nestedValue] of Object.entries(current)) {
      if (
        typeof nestedValue === "string" &&
        [
          "id",
          "messageId",
          "message_id",
          "campaignId",
          "campaign_id",
          "submitted_message_id",
          "submittedMessageId",
        ].includes(key)
      ) {
        return nestedValue
      }

      if (nestedValue && typeof nestedValue === "object") {
        queue.push(nestedValue)
      }
    }
  }

  return undefined
}

async function parseAiSensyResponse(response: Response): Promise<unknown> {
  const responseText = await response.text()

  if (!responseText) {
    return null
  }

  try {
    return JSON.parse(responseText)
  } catch {
    return responseText
  }
}

export async function sendAiSensyAuthenticationOtp({
  destination,
  otpCode,
  userName,
}: SendAiSensyAuthenticationOtpParams): Promise<SendAiSensyAuthenticationOtpResult> {
  const apiKey = getRequiredEnv("AISENSY_API_KEY")
  const campaignName = getRequiredEnv("AISENSY_CAMPAIGN_NAME")
  const baseUrl = getTrimmedEnv("AISENSY_BASE_URL") || DEFAULT_AISENSY_BASE_URL
  const source = getTrimmedEnv("AISENSY_SOURCE")

  const replacements = {
    DESTINATION: destination,
    OTP_CODE: otpCode,
    USER_NAME: userName,
  }

  const payload: Record<string, JsonValue> = {
    apiKey,
    campaignName,
    destination,
    userName,
    templateParams: [otpCode],
    ...(source ? { source } : {}),
    ...getExtraPayload(replacements),
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const responseBody = await parseAiSensyResponse(response)

  if (!response.ok) {
    throw new Error(
      `AiSensy request failed with status ${response.status}${
        typeof responseBody === "string" && responseBody
          ? `: ${responseBody}`
          : ""
      }`
    )
  }

  return {
    providerMessageId: extractProviderMessageId(responseBody),
  }
}

