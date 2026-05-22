import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";

import {ListingImageGallery} from "@/app/listing-image-gallery";

describe("ListingImageGallery", () => {
  afterEach(() => {
    cleanup();
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
    expect(screen.getByRole("img", {name: "LIST-REMOTE image 1"})).not.toBeNull();
    expect(screen.queryByText("Local images pending upload")).toBeNull();
    expect(screen.queryByText("/Users/test/local-1.jpg")).toBeNull();
  });
});
