import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TripDetail } from "./trip-detail";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-5"><Skeleton className="h-40 rounded-3xl" /></div>}>
      <TripDetail />
    </Suspense>
  );
}
