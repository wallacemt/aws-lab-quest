import { SimuladoHistoryReviewScreen } from "@/features/study/screens/SimuladoHistoryReviewScreen";

type PageProps = {
  params: Promise<{
    historyId: string;
  }>;
};

export default async function SimuladoHistoryReviewPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <SimuladoHistoryReviewScreen historyId={resolvedParams.historyId} />;
}
