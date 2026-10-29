"use client";

import {useEffect, useId, useRef, useState} from "react";

type Workspace = "standard" | "variation";

const guides = {
  standard: {
    title: "Standard listings guide",
    summary: "One card or a fixed lot per listing. Each listing has its own images, draft, price, and publishing lifecycle.",
    sections: [
      ["1. Capture and intake", "Select the Single or Lot capture mode, then photograph the front and back of each card. The watcher groups incoming images and sends them to the backend. Check the capture queue and errors before proceeding."],
      ["2. Generation and review", "Open the listing in review. AI proposes a title, description, category, and card specifics; inspect the actual images and verify year, set, player, condition, and identifying details before accepting the draft."],
      ["3. Pricing", "Pricing research and sold comparisons are advisory. Review the suggested price, shipping, and any pricing warnings. Correct the price manually when needed."],
      ["4. Publish and reconcile", "Publish only after the listing is ready. Use the status counters to find errors, drafts awaiting review, and active listings. Seller Hub is authoritative after publication; resolve any reported error or uncertain result before retrying."],
      ["Controls and status", "Queue and error controls show pending or failed processing. Retry acts on a failed step; dismiss clears an eligible warning, not an unresolved publication. Review opens a draft; publishing sends an approved listing to eBay. The Seller Hub link opens active listings in a separate tab."],
      ["Recommended workflow", "Capture → check images → generate → verify card specifics → review price → publish → verify in Seller Hub. Avoid repeating a publish action when the previous result is unknown."],
    ],
  },
  variation: {
    title: "Variation listings guide",
    summary: "A bucket represents one grouped eBay listing. Each selectable card is a variation with its own SKU, price, and quantity; its physical copies share that variation.",
    sections: [
      ["1. Bucket and capture target", "Select the bucket you want to work on. Selection controls which bucket you view; Arm capture independently controls where the watcher sends images. Disarmed Variation capture is paused—it does not become Standard capture. Finish or discard a pending pair before switching capture ownership."],
      ["2. New cards and duplicate copies", "Arm new-variation capture to create a card selector from a front/back image pair. Use Capture duplicate for another comparable copy of an existing card. Review representative images and copy condition before treating copies as interchangeable."],
      ["3. Identity, group review, and prices", "Generation prepares variation identity and shared group content. Check each Card selector, images, common specifics, title, and description. Use the nine-tier price dropdown and Save for an individual card; Save stages a change but does not change eBay until Publish Changes."],
      ["4. Quantity and removal", "For confirmed active variations, review fresh eBay quantity, pending +1/−1 adjustment, and after-publish quantity. Remove sold-out SKU is a separate guarded action for verified zero stock and permanent discontinuation, not for cards you plan to restock."],
      ["5. Publish and recovery", "Publish Changes sends the staged revision to eBay; pending indicators mean the local draft and remote listing can differ. Confirm eBay quantity and listing status using refresh or reconciliation controls. Unknown or failed remote operations require reconciliation—not blind retries."],
      ["Panels and statuses", "Bucket cards select the visible group; capture controls arm/disarm the watcher; inventory rows show selectors, SKUs, copies, prices and quantities; Group Review manages shared content; the publication panel shows pending changes, remote status and actions. Amber indicates work in progress; red indicates attention or reconciliation is required. Info icons describe individual safeguards."],
      ["Recommended workflow", "Select bucket → Arm capture → add cards/copies → review selectors and shared content → set prices → inspect pending changes → Publish Changes → verify on eBay → disarm before leaving Variation capture."],
    ],
  },
} as const;

export function ListingHelpModal({workspace}: {workspace: Workspace}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const summaryId = useId();

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      // The dialog has one focusable action: keep keyboard focus inside it.
      event.preventDefault();
      closeRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const guide = guides[workspace];
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        aria-label={`Help for ${workspace} listings`}
        title={`Help for ${workspace} listings`}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-600 text-stone-100 hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      >
        <span aria-hidden="true" className="text-lg font-bold">?</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/75 p-3 sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            id={titleId}
            aria-labelledby={`${titleId}-heading`}
            aria-describedby={summaryId}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-stone-50 text-stone-950 shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-7">
              <div>
                <h2 id={`${titleId}-heading`} className="text-xl font-bold sm:text-2xl">{guide.title}</h2>
                <p id={summaryId} className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{guide.summary}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close listing help"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold hover:bg-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
              >
                Close
              </button>
            </header>
            <div className="overflow-y-auto px-5 py-5 sm:px-7">
              <div className="grid gap-5 md:grid-cols-2">
                {guide.sections.map(([heading, description]) => (
                  <section key={heading} className="rounded-xl border border-stone-200 bg-white p-4">
                    <h3 className="text-sm font-bold">{heading}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-700">{description}</p>
                  </section>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
