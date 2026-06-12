"use client";

import {useActionState} from "react";
import {useFormStatus} from "react-dom";

import {togglePricingServiceAction} from "@/app/pricing-service-toggle-actions";
import {
  createPricingServiceToggleActionState,
  type PricingServiceToggleActionState,
} from "@/app/pricing-service-toggle-state";

function PricingServiceToggleButton({
  enabled,
  disabled,
}: {
  enabled: boolean | null;
  disabled?: boolean;
}) {
  const {pending} = useFormStatus();
  const label =
    enabled === null
      ? "Pricing unavailable"
      : enabled
        ? "Disable automatic pricing"
        : "Enable automatic pricing";

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`inline-flex min-w-44 items-center justify-center rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:border-stone-700 disabled:bg-stone-800 disabled:text-stone-500 ${
        enabled === null
          ? "border-stone-700 bg-stone-900/70 text-stone-500"
          : enabled
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300 hover:text-white"
          : "border-stone-700 bg-stone-900/70 text-stone-100 hover:border-stone-500 hover:text-white"
      }`}
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export function PricingServiceToggle({enabled}: {enabled: boolean | null}) {
  const [state, formAction] = useActionState<
    PricingServiceToggleActionState,
    FormData
  >(
    togglePricingServiceAction,
    createPricingServiceToggleActionState(enabled),
  );
  const currentEnabled = state.enabled;
  const isUnavailable = currentEnabled === null;

  return (
    <section className="rounded-2xl border border-stone-700 bg-stone-950/80 px-4 py-4 text-stone-50">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
            Pricing service
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-300">
            Controls automatic pricing enqueue after Gemini draft generation.
            Gemini draft generation and publishing stay unchanged.
          </p>
        </div>

        <form action={isUnavailable ? undefined : formAction}>
          {!isUnavailable ? (
            <input
              type="hidden"
              name="pricingServiceEnabled"
              value={String(!currentEnabled)}
            />
          ) : null}
          <PricingServiceToggleButton
            disabled={isUnavailable}
            enabled={currentEnabled}
          />
        </form>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${
            isUnavailable
              ? "border-stone-700 bg-stone-900/70 text-stone-400"
              : currentEnabled
              ? "border-emerald-400/40 bg-emerald-950/30 text-emerald-100"
              : "border-stone-700 bg-stone-900/70 text-stone-200"
          }`}
        >
          {isUnavailable
            ? "Automatic pricing unavailable"
            : `Automatic pricing ${currentEnabled ? "on" : "off"}`}
        </span>

        {state.success ? (
          <span className="rounded-full border border-emerald-400/40 bg-emerald-950/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100">
            {state.success}
          </span>
        ) : null}

        {state.error ? (
          <span className="rounded-full border border-rose-400/40 bg-rose-950/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-rose-100">
            {state.error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
