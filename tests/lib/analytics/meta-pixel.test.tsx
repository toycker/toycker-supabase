import { render, screen } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import MetaPixel from "@/lib/analytics/meta-pixel"

const { pathnameState } = vi.hoisted(() => ({
  pathnameState: {
    value: "/" as string | null,
  },
}))

type MetaPixelCall = {
  (..._args: ["init", string]): void
  (..._args: ["track", "PageView"]): void
}

type MetaPixelWindow = Window & {
  fbq?: MetaPixelCall
  _fbq?: MetaPixelCall
}

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}))

vi.mock("next/script", () => ({
  default: ({
    id,
    children,
  }: {
    id?: string
    children?: React.ReactNode
  }) => <script data-testid={id}>{children}</script>,
}))

describe("MetaPixel", () => {
  beforeEach(() => {
    const metaPixelWindow = window as MetaPixelWindow

    pathnameState.value = "/"
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID
    delete metaPixelWindow.fbq
    delete metaPixelWindow._fbq
  })

  it("does not render when the pixel ID is missing", () => {
    render(<MetaPixel />)

    expect(screen.queryByTestId("meta-pixel-base")).not.toBeInTheDocument()
  })

  it("does not render on admin routes", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "1045186905334220"
    pathnameState.value = "/admin/orders"

    render(<MetaPixel />)

    expect(screen.queryByTestId("meta-pixel-base")).not.toBeInTheDocument()
  })

  it("renders the base script on public routes", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "1045186905334220"

    render(<MetaPixel />)

    expect(screen.getByTestId("meta-pixel-base")).toHaveTextContent("1045186905334220")
  })

  it("tracks PageView on later public route changes only", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "1045186905334220"
    const metaPixelWindow = window as MetaPixelWindow
    const fbqMock = vi.fn<(_command: "init" | "track", _value: string) => void>()
    const fbq: MetaPixelCall = (command, value) => {
      fbqMock(command, value)
    }
    metaPixelWindow.fbq = fbq

    const { rerender } = render(<MetaPixel />)

    expect(fbqMock).not.toHaveBeenCalled()

    pathnameState.value = "/products/test-product"
    rerender(<MetaPixel />)

    expect(fbqMock).toHaveBeenCalledWith("track", "PageView")
  })
})
