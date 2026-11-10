import type { Metadata } from "next";
import { TripsView } from "./trips-view";

export const metadata: Metadata = { title: "Trips" };

export default function TripsPage() {
  return <TripsView />;
}
