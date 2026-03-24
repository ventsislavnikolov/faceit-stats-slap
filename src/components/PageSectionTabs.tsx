interface PageSectionTab {
  key: string;
  label: string;
}

interface PageSectionTabsProps {
  tabs: PageSectionTab[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
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
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded px-3 py-1.5 text-xs font-bold transition-colors ${
            activeKey === tab.key
              ? "bg-accent text-bg"
              : "bg-bg-elevated text-text-muted hover:text-text"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
