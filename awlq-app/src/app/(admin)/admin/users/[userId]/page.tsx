import { AdminUserDetailScreen } from "@/features/admin/screens/AdminUserDetailScreen";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserDetailPage({ params }: Props) {
  const { userId } = await params;
  return <AdminUserDetailScreen userId={userId} />;
}
