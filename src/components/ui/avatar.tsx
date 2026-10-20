import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export const Avatar = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>) => (
  <AvatarPrimitive.Root className={cn("relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full", className)} {...p} />
);
export const AvatarFallback = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>) => (
  <AvatarPrimitive.Fallback
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary", className)}
    {...p}
  />
);
