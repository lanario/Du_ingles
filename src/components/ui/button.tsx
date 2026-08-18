import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "ghost" | "destructive" | "outline";

export function buttonVariants(
  variant: ButtonVariant = "primary",
  className?: string,
): string {
  return cn(
    "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium",
    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
    variant === "ghost" && "hover:bg-muted",
    variant === "outline" && "border border-border hover:bg-muted",
    variant === "destructive" &&
      "bg-destructive text-destructive-foreground hover:opacity-90",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return <button ref={ref} className={buttonVariants(variant, className)} {...props} />;
  },
);
Button.displayName = "Button";
