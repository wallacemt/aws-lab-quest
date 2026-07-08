import { Suspense } from "react";
import { QuestChainScreen } from "@/features/trails/screens/QuestChainScreen";

export default function TrilhasPage() {
  return (
    <Suspense>
      <QuestChainScreen />
    </Suspense>
  );
}
