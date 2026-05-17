"use client";

type FilterTab = {
  label: string;
  value: string;
};

type FilterTabsProps<T extends string> = {
  tabs: readonly FilterTab[];
  selectedTab: T;
  onChange: (value: T) => void;
};

export function FilterTabs<T extends string>({ onChange, selectedTab, tabs }: FilterTabsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          className={`rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
            selectedTab === tab.value ? "bg-primary text-white" : "bg-neutral-soft text-text-muted hover:text-primary"
          }`}
          key={tab.value}
          onClick={() => onChange(tab.value as T)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
