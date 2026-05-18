"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { submitCreateListing } from "@/app/create-listing-actions";
import { initialCreateListingActionState } from "@/app/create-listing-state";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-w-40 items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
    >
      {pending ? "Creating..." : "Create listing"}
    </button>
  );
}

export function CreateListingForm() {
  const [state, formAction] = useActionState(
    submitCreateListing,
    initialCreateListingActionState
  );

  return (
    <section className="rounded-[2rem] border border-stone-950/10 bg-white/75 p-6 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">Create test listing</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Manual sidecar create</h2>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        Sends the minimum valid payload to the sidecar `POST /api/listings` contract and refreshes
        the dashboard table on success.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Mode</span>
          <select
            name="mode"
            defaultValue="test"
            className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
          >
            <option value="test">test</option>
            <option value="manual">manual</option>
          </select>
        </label>

        <SubmitButton />
      </form>

      {state.success ? (
        <p className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {state.success}
        </p>
      ) : null}

      {state.error ? (
        <p className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
