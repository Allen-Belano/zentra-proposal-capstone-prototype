import {
  Boxes, Briefcase, ClipboardList, Package, ShoppingCart, Truck, Users, Wrench, type LucideIcon,
} from "lucide-react";

export const MODULE_ICONS: Record<string, LucideIcon> = {
  package: Package, truck: Truck, wrench: Wrench, cart: ShoppingCart, clipboard: ClipboardList,
  briefcase: Briefcase, users: Users, boxes: Boxes,
};

export function ModuleIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MODULE_ICONS[name] ?? Boxes;
  return <Icon className={className} />;
}
