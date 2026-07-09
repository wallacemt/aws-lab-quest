import { GapReviewScreen } from "@/features/study/screens/GapReviewScreen";

interface Props {
  params: Promise<{ serviceCode: string }>;
  searchParams: Promise<{ topic?: string; sid?: string }>;
}

export default async function RevisaoGapPage({ params, searchParams }: Props) {
  const { serviceCode } = await params;
  const { topic, sid } = await searchParams;

  return <GapReviewScreen serviceCode={decodeURIComponent(serviceCode)} topic={topic ?? ""} awsServiceId={sid ?? null} />;
}
