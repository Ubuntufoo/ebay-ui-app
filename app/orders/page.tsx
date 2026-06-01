import {Suspense} from "react";

import {loadUnshippedOrdersResult} from "@/lib/unshipped-orders";

import {
  UnshippedOrdersPageFallback,
  UnshippedOrdersPageView,
} from "./orders-page";

export const metadata = {
  title: "Packing queue",
};

export const dynamic = "force-dynamic";

async function UnshippedOrdersSection() {
  const ordersResult = await loadUnshippedOrdersResult();

  return <UnshippedOrdersPageView ordersResult={ordersResult} />;
}

export default function OrdersPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#efe7d8] text-stone-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,_rgba(251,191,36,0.38),_transparent_28%),radial-gradient(circle_at_82%_18%,_rgba(20,184,166,0.22),_transparent_30%),linear-gradient(135deg,_rgba(68,64,60,0.08),_transparent_45%)]" />

      <section className="relative min-h-screen px-4 py-4 sm:px-6 sm:py-6">
        <section className="rounded-[2rem] border border-stone-950/10 bg-white/80 p-5 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur sm:p-7">
          <Suspense fallback={<UnshippedOrdersPageFallback />}>
            <UnshippedOrdersSection />
          </Suspense>
        </section>
      </section>
    </main>
  );
}
