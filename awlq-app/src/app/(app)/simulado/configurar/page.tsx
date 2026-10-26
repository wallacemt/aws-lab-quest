import { Suspense } from "react";
import { SimuladoConfigScreen } from "@/features/study/screens/SimuladoConfigScreen";

export default function SimuladoConfigurarPage() {
  return (
    <Suspense>
      <SimuladoConfigScreen />
    </Suspense>
  );
}
