import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

/** Pill tab bar whose white highlight glides to the active tab. */
export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<{ left: number; width: number; ready: boolean } | null>(null);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!active) return;
      // The first measurement places the highlight without animating; later ones slide.
      setBox((prev) => ({ left: active.offsetLeft, width: active.offsetWidth, ready: prev !== null }));
    };
    measure();
    const mo = new MutationObserver(measure);
    mo.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"], childList: true, characterData: true });
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => { mo.disconnect(); ro.disconnect(); };
  }, []);

  return (
    <TabsPrimitive.List
      ref={(node) => {
        listRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn("relative inline-flex h-10 max-w-full items-center justify-start rounded-full border border-border bg-muted p-1 text-muted-foreground", className)}
      {...props}
    >
      {box && (
        <span
          aria-hidden
          className={cn("absolute inset-y-1 left-0 rounded-full bg-card shadow-soft", box.ready && "transition-[transform,width] duration-300 ease-fluid")}
          style={{ width: box.width, transform: `translateX(${box.left}px)` }}
        />
      )}
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative z-10 inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 text-sm font-medium transition-colors duration-200 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground sm:px-3.5",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 duration-300 ease-fluid data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
