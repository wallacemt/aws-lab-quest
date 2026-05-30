import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import LandingPage from "@/features/landing/LandingPage";

export default async function RootPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  return <LandingPage session={session} />;
}
