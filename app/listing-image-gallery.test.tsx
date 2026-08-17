import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

const {saveListingImageUrlsMock} = vi.hoisted(() => ({
  saveListingImageUrlsMock: vi.fn(),
}));

vi.mock("@/app/listing-image-url-actions", () => ({
  saveListingImageUrls: saveListingImageUrlsMock,
}));

import {
  ListingImageGallery,
  ListingImageOrderManager,
} from "@/app/listing-image-gallery";

describe("ListingImageGallery", () => {
  afterEach(() => {
    cleanup();
    saveListingImageUrlsMock.mockReset();
  });

  it("shows local-only images as pending upload without rendering img tags", () => {
    render(
      <ListingImageGallery
        listingId="LIST-LOCAL"
        imageUrls={["/Users/test/local-1.jpg", "/Users/test/local-2.jpg"]}
        compact
        showUrls={false}
      />,
    );

    expect(screen.getByText("2 images")).not.toBeNull();
    expect(screen.getByText("Local images pending upload")).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders remote image previews and counts mixed image arrays", () => {
    render(
      <ListingImageGallery
        listingId="LIST-REMOTE"
        imageUrls={["/Users/test/local-1.jpg", "https://example.com/photo.jpg"]}
        compact
        showUrls={false}
      />,
    );

    expect(screen.getByText("2 images")).not.toBeNull();
    expect(
      screen.getByRole("img", {name: "LIST-REMOTE image 1"}),
    ).not.toBeNull();
    expect(screen.queryByText("Local images pending upload")).toBeNull();
    expect(screen.queryByText("/Users/test/local-1.jpg")).toBeNull();
  });

  it("renders all remote images as linked thumbnails in compact gallery mode", () => {
    render(
      <ListingImageGallery
        listingId="LIST-GALLERY"
        imageUrls={[
          "https://example.com/photo-1.jpg",
          "https://example.com/photo-2.jpg",
        ]}
        compact
        showAllImages
        showUrls={false}
      />,
    );

    expect(screen.getByText("2 images")).not.toBeNull();
    expect(
      screen.getByRole("link", {name: "Open LIST-GALLERY image 1"}),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", {name: "Open LIST-GALLERY image 2"}),
    ).not.toBeNull();
    expect(
      screen.getAllByRole("img", {name: /LIST-GALLERY image/i}),
    ).toHaveLength(2);
  });

  it("persists the exact reordered image array after a native drop", async () => {
    saveListingImageUrlsMock.mockResolvedValue({
      error: null,
      success: true,
    });

    render(
      <ListingImageOrderManager
        listingId="LIST-ORDER"
        imageUrls={[
          "https://example.com/one.jpg",
          "https://example.com/two.jpg",
          "https://example.com/three.jpg",
          "https://example.com/four.jpg",
          "https://example.com/five.jpg",
        ]}
      />,
    );

    const cards = screen.getAllByRole("listitem");
    fireEvent.dragStart(cards[0]);
    fireEvent.drop(cards[4]);

    await waitFor(() => expect(saveListingImageUrlsMock).toHaveBeenCalled());
    const formData = saveListingImageUrlsMock.mock.calls[0][1] as FormData;

    expect(formData.get("listing_id")).toBe("LIST-ORDER");
    expect(formData.get("image_urls")).toBe(
      [
        "https://example.com/two.jpg",
        "https://example.com/three.jpg",
        "https://example.com/four.jpg",
        "https://example.com/five.jpg",
        "https://example.com/one.jpg",
      ].join("\n"),
    );
  });

  it("does not let a stale save completion override fresh props", async () => {
    let resolveSave:
      | ((result: {error: null; success: true}) => void)
      | undefined;
    saveListingImageUrlsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    const {rerender} = render(
      <ListingImageOrderManager
        listingId="LIST-FRESH"
        imageUrls={[
          "https://example.com/one.jpg",
          "https://example.com/two.jpg",
        ]}
      />,
    );

    const cards = screen.getAllByRole("listitem");
    fireEvent.dragStart(cards[0]);
    fireEvent.drop(cards[1]);

    rerender(
      <ListingImageOrderManager
        listingId="LIST-FRESH"
        imageUrls={[
          "https://example.com/one.jpg",
          "https://example.com/two.jpg",
        ]}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getAllByRole("img").map((image) => image.getAttribute("src")),
      ).toEqual([
        "https://example.com/one.jpg",
        "https://example.com/two.jpg",
      ]),
    );
    expect(screen.queryByText("Saving...")).toBeNull();

    resolveSave?.({error: null, success: true});
    await waitFor(() =>
      expect(screen.getByText("1 Primary")).not.toBeNull(),
    );
    expect(
      screen.getAllByRole("img").map((image) => image.getAttribute("src")),
    ).toEqual([
      "https://example.com/one.jpg",
      "https://example.com/two.jpg",
    ]);
  });

  it("rolls back an optimistic reorder and shows the action error", async () => {
    saveListingImageUrlsMock.mockResolvedValue({
      error: "Could not save image URLs.",
      success: false,
    });

    render(
      <ListingImageOrderManager
        listingId="LIST-ROLLBACK"
        imageUrls={[
          "https://example.com/one.jpg",
          "https://example.com/two.jpg",
        ]}
      />,
    );

    const cards = screen.getAllByRole("listitem");
    fireEvent.dragStart(cards[1]);
    fireEvent.drop(cards[0]);

    expect(screen.getByText("Saving...")).not.toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Could not save image URLs.",
      ),
    );
    expect(
      screen.getAllByRole("img").map((image) => image.getAttribute("src")),
    ).toEqual([
      "https://example.com/one.jpg",
      "https://example.com/two.jpg",
    ]);
  });

  it("reconciles a fresh prop order and stays hidden below two valid URLs", async () => {
    const {rerender} = render(
      <ListingImageOrderManager
        listingId="LIST-RECONCILE"
        imageUrls={[
          "https://example.com/one.jpg",
          "https://example.com/two.jpg",
        ]}
      />,
    );

    rerender(
      <ListingImageOrderManager
        listingId="LIST-RECONCILE"
        imageUrls={[
          "https://example.com/two.jpg",
          "https://example.com/one.jpg",
        ]}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getAllByRole("img").map((image) => image.getAttribute("src")),
      ).toEqual([
        "https://example.com/two.jpg",
        "https://example.com/one.jpg",
      ]),
    );

    rerender(
      <ListingImageOrderManager
        listingId="LIST-RECONCILE"
        imageUrls={["https://example.com/only.jpg"]}
      />,
    );
    expect(screen.queryByRole("list", {name: "Listing images"})).toBeNull();
  });
});
