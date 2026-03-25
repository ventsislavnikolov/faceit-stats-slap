interface PageSectionTab {
  key: string;
  label: string;
}

interface PageSectionTabsProps {
  activeKey: string;
  className?: string;
  onChange: (key: string) => void;
  tabs: PageSectionTab[];
}

export function shouldRenderPageSectionTabs(tabs: PageSectionTab[]): boolean {
  return tabs.length > 1;
}

export function PageSectionTabs({
  tabs,
  activeKey,
  onChange,
  className = "",
}: PageSectionTabsProps) {
  return (
    <div className={`flex flex-wrap gap-1 ${className}`.trim()}>
      {tabs.map((tab) => (
        <button
          className={`rounded px-3 py-1.5 font-bold text-xs transition-colors ${
            activeKey === tab.key
              ? "bg-accent text-bg"
              : "bg-bg-elevated text-text-muted hover:text-text"
          }`}
          key={tab.key}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
