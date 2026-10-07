import React from "react";
import { cn } from "@/src/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      iconLeft,
      iconRight,
      fullWidth = false,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const variants: Record<string, string> = {
      primary:
        "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 shadow-none",
      secondary:
        "bg-slate-700 border-slate-800 text-white hover:bg-slate-800 hover:border-slate-900",
      success:
        "bg-[#4f8d67] border-[#3d6c50] text-white hover:bg-[#3d6c50] hover:border-[#325641]",
      danger:
        "bg-[#aa403d] border-[#7f3431] text-white hover:bg-[#7f3431] hover:border-[#642d2a]",
      outline:
        "bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700",
      ghost:
        "bg-transparent border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-700",
    };

    const sizes: Record<string, string> = {
      xs: "h-7 min-w-[52px] px-2 text-[11px] rounded-md",
      sm: "h-8 min-w-[60px] px-2.5 text-[12px] rounded-md",
      md: "h-8 min-w-[60px] px-3 text-[12px] rounded-md",
      lg: "h-9 min-w-[72px] px-3.5 text-[13px] rounded-md",
    };

    const spinnerSize = size === "lg" ? 16 : size === "md" ? 15 : 13;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "ui-button relative inline-flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap border",
          "font-semibold leading-none select-none transition-all duration-150 active:scale-[.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50",
          "[&_svg]:shrink-0 [&_svg]:pointer-events-none",
          fullWidth && "w-full",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 size={spinnerSize} className="animate-spin shrink-0" />
        ) : (
          <>
            {iconLeft && (
              <span className="flex shrink-0 items-center justify-center">
                {iconLeft}
              </span>
            )}

            {children !== undefined && children !== null && (
              <span className="inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap leading-none [&>svg]:shrink-0">
                {children}
              </span>
            )}

            {iconRight && (
              <span className="flex shrink-0 items-center justify-center">
                {iconRight}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

// ── IconButton ────────────────────────────────────────────────

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = "ghost",
      size = "md",
      loading = false,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const variants: Record<string, string> = {
      primary:
        "bg-blue-600 border-blue-700 text-white hover:bg-blue-700 hover:border-blue-800",
      secondary:
        "bg-slate-700 border-slate-800 text-white hover:bg-slate-800 hover:border-slate-900",
      success:
        "bg-[#4f8d67] border-[#3d6c50] text-white hover:bg-[#3d6c50] hover:border-[#325641]",
      danger:
        "bg-[#aa403d] border-[#7f3431] text-white hover:bg-[#7f3431] hover:border-[#642d2a]",
      outline:
        "bg-white border-blue-600 text-blue-600 hover:bg-blue-50 hover:border-blue-700 hover:text-blue-700",
      ghost:
        "bg-transparent border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-700",
    };

    const sizes: Record<string, string> = {
      xs: "h-7 w-7 rounded-md",
      sm: "h-8 w-8 rounded-md",
      md: "h-9 w-9 rounded-md",
      lg: "h-10 w-10 rounded-md",
    };

    const spinnerSize = size === "lg" ? 16 : size === "md" ? 15 : 13;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "ui-icon-button inline-flex items-center justify-center shrink-0 border transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50",
          "[&_svg]:shrink-0 [&_svg]:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 size={spinnerSize} className="animate-spin" />
        ) : (
          children
        )}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
