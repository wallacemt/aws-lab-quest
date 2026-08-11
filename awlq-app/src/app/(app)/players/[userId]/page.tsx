import { Suspense } from "react";
import { PublicProfileScreen } from "@/features/user/screens/PublicProfileScreen";

export default function PlayerPage() {
  return (
    <Suspense>
      <PublicProfileScreen />
    </Suspense>
  );
}
