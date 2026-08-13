import { AdminCertificationDetailScreen } from "@/features/admin/screens/AdminCertificationDetailScreen";

type Props = {
  params: Promise<{ certificationId: string }>;
};

export default async function AdminCertificationDetailPage({ params }: Props) {
  const { certificationId } = await params;
  return <AdminCertificationDetailScreen certificationId={certificationId} />;
}
