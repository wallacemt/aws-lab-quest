import { Suspense } from "react";
import { HistoryScreen } from "@/features/study/screens/HistoryScreen";

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryScreen />
    </Suspense>
  );
}
