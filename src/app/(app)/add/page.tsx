import type { Metadata } from "next";
import { AddTicket } from "./add-ticket";

export const metadata: Metadata = { title: "Add ticket" };

export default function AddPage() {
  return <AddTicket />;
}
