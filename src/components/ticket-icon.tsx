import { BedDouble, Bus, Plane, Ship, Ticket as TicketIcon, TrainFront, PartyPopper } from "lucide-react";
import type { TicketType } from "@/lib/types";

const ICONS = { flight: Plane, boat: Ship, train: TrainFront, bus: Bus, stay: BedDouble, event: PartyPopper, other: TicketIcon };

export function TypeIcon({ type, className }: { type: TicketType; className?: string }) {
  const Icon = ICONS[type] ?? TicketIcon;
  return <Icon className={className} />;
}
