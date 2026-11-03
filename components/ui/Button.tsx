import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline-gold" | "danger" | "dark";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-gold text-sea font-extrabold hover:bg-gold-hover hover:text-sea",
  secondary: "border-[1.5px] border-outline text-text font-bold hover:border-muted hover:text-text",
  ghost: "text-gold font-bold hover:text-gold-hover",
  "outline-gold": "border-[1.5px] border-gold text-gold font-bold hover:text-gold-hover hover:border-gold-hover",
  danger: "border-[1.5px] border-danger text-danger font-bold hover:bg-danger hover:text-sea",
  dark: "bg-sea text-gold font-bold hover:text-gold-hover",
};
const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-6 text-[17px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }>(
  function Button({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
  },
);

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** Map/List style segmented switch (aria-pressed buttons). */
export function Segmented<T extends string>({ value, options, onChange, label, className }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("flex w-fit gap-1 rounded-full bg-sea-deep p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("h-9 rounded-full px-[18px] text-sm font-bold transition-colors", o.value === value ? "bg-gold text-sea" : "text-muted hover:text-text")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Filter pill (Quest log filters). */
export function Pill({ active, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "h-9 whitespace-nowrap rounded-full px-4 text-sm transition-colors",
        active ? "bg-gold font-bold text-sea" : "border-[1.5px] border-outline font-semibold text-text hover:border-muted",
        className,
      )}
      {...props}
    />
  );
}

export function PillLink({ active, className, ...props }: ComponentProps<typeof Link> & { active?: boolean }) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-sm no-underline transition-colors",
        active ? "bg-gold font-bold text-sea hover:text-sea" : "border-[1.5px] border-outline font-semibold text-text hover:border-muted hover:text-text",
        className,
      )}
      {...props}
    />
  );
}
