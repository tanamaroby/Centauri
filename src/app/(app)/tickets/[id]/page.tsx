import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketDetail } from "./ticket-detail";

export default function Page() {
  return (
    <Suspense fallback={<div className="space-y-4 p-5"><Skeleton className="h-10 w-32" /><Skeleton className="h-[480px] rounded-3xl" /></div>}>
      <TicketDetail />
    </Suspense>
  );
}
