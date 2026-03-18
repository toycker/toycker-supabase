import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import CategoryCheckboxList from "@/modules/admin/components/category-checkbox-list"
import CollectionCheckboxList from "@/modules/admin/components/collection-checkbox-list"
import { Category, Collection } from "@/lib/supabase/types"

function buildCategories(count = 25): Category[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `cat-${index + 1}`,
    name: `Category ${index + 1}`,
    handle: `category-${index + 1}`,
    description: null,
    parent_category_id: null,
    created_at: "2026-03-17T00:00:00.000Z",
    image_url: null,
  }))
}

function buildCollections(count = 25): Collection[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `col-${index + 1}`,
    title: `Collection ${index + 1}`,
    handle: `collection-${index + 1}`,
    created_at: "2026-03-17T00:00:00.000Z",
    image_url: null,
    products: [],
  }))
}

describe("CategoryCheckboxList", () => {
  it("shows all categories by default", () => {
    render(
      <CategoryCheckboxList
        categories={buildCategories()}
        selectedIds={[]}
        name="category_ids"
      />
    )

    expect(screen.getByText("Category 25")).toBeInTheDocument()
    expect(
      screen.queryByText("Showing 1 matching result.")
    ).not.toBeInTheDocument()
  })

  it("filters categories and shows match count during search", () => {
    render(
      <CategoryCheckboxList
        categories={buildCategories()}
        selectedIds={[]}
        name="category_ids"
      />
    )

    fireEvent.change(screen.getByPlaceholderText("Search categories..."), {
      target: { value: "category-25" },
    })

    expect(screen.getByText("Category 25")).toBeInTheDocument()
    expect(screen.getByText("Showing 1 matching result.")).toBeInTheDocument()
  })
})

describe("CollectionCheckboxList", () => {
  it("shows all collections by default", () => {
    render(
      <CollectionCheckboxList
        collections={buildCollections()}
        selectedIds={[]}
        name="collection_ids"
      />
    )

    expect(screen.getByText("Collection 25")).toBeInTheDocument()
    expect(
      screen.queryByText("Showing 1 matching result.")
    ).not.toBeInTheDocument()
  })

  it("filters collections and shows match count during search", () => {
    render(
      <CollectionCheckboxList
        collections={buildCollections()}
        selectedIds={[]}
        name="collection_ids"
      />
    )

    fireEvent.change(screen.getByPlaceholderText("Search collections..."), {
      target: { value: "collection-25" },
    })

    expect(screen.getByText("Collection 25")).toBeInTheDocument()
    expect(screen.getByText("Showing 1 matching result.")).toBeInTheDocument()
  })
})
