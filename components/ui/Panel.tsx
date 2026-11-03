import { cn } from "@/lib/cn";

export function Panel({ className, as: As = "section", ...props }: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" | "aside" }) {
  return <As className={cn("rounded-2xl bg-panel", className)} {...props} />;
}

export function PanelHeading({ children, aside, className, level = 2 }: { children: React.ReactNode; aside?: React.ReactNode; className?: string; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className={cn("flex items-baseline justify-between gap-3 px-4 pb-1 pt-3", className)}>
      <H className="m-0 text-[15px] font-bold">{children}</H>
      {aside ? <span className="text-xs text-muted">{aside}</span> : null}
    </div>
  );
}

export function PanelRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-panel-rule px-4 py-2.5", className)} {...props} />;
}

/** Big number with a label under it (records, lifetime stats). */
export function StatGrid({ stats, size = "md", className, label, colsClass }: { stats: { value: React.ReactNode; label: string }[]; size?: "sm" | "md"; className?: string; label?: string; colsClass?: string }) {
  return (
    <section aria-label={label} className={cn("grid overflow-hidden rounded-2xl bg-panel", colsClass, className)} style={colsClass ? undefined : { gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
      {stats.map((s, i) => (
        <div key={s.label} className={cn(size === "sm" ? "p-3" : "p-4", colsClass ? "-mb-px -mr-px border-b border-r border-panel-rule" : i < stats.length - 1 && "border-r border-panel-rule")}>
          <div className={cn("font-display font-black leading-tight", size === "sm" ? "text-[26px]" : "text-[34px]")}>{s.value}</div>
          <div className={cn("text-muted", size === "sm" ? "text-xs" : "text-[13px]")}>{s.label}</div>
        </div>
      ))}
    </section>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-panel px-5 py-8 text-center">
      <p className="m-0 font-display text-2xl font-black">{title}</p>
      {children ? <div className="mx-auto mt-1.5 max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
