"use client";

import { Icon } from "../Icon";

type EmptyCapturesStateProps = {
  onAddManually: () => void;
};

export function EmptyCapturesState({ onAddManually }: EmptyCapturesStateProps) {
  return (
    <div className="rounded-row border-[1.5px] border-dashed border-border bg-surface px-6 py-16 text-center">
      <Icon className="mx-auto h-8 w-8 text-border-hover" name="post-add" />
      <h3 className="mt-4 font-heading text-xl font-semibold text-text-primary">Nothing captured yet</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
        Use the Retrace extension to capture while browsing, or add context manually below.
      </p>
      <div className="mt-5 flex justify-center gap-5">
        <button className="text-sm font-medium text-primary hover:underline" onClick={onAddManually} type="button">
          Add manually →
        </button>
        <button className="text-sm font-medium text-primary hover:underline" type="button">
          Get the extension →
        </button>
      </div>
    </div>
  );
}
