import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Przyciski „Monolitu”: pigułki, płaskie (bez cienia), z animowanym wyłącznie
// kolorem. Na telefonie każdy rozmiar ma co najmniej 44 px wysokości (cel
// dotyku), na komputerze wracają do zwartych 32–40 px. Fokus z klawiatury daje
// wspólny pierścień z `globals.css`.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-ui font-medium transition-[color,background-color,border-color,opacity] disabled:pointer-events-none disabled:opacity-50 aria-busy:opacity-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 has-[>svg]:px-4 lg:h-9 lg:px-4 lg:has-[>svg]:px-3",
        sm: "h-11 px-4 lg:h-8 lg:px-3",
        lg: "h-12 px-6 has-[>svg]:px-5 lg:h-10",
        icon: "size-11 lg:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
