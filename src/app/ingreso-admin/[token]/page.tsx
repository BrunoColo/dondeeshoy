import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

interface AdminAccessPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function AdminAccessPage({ params }: AdminAccessPageProps) {
  const { token } = await params;
  const adminAccessKey = process.env.ADMIN_ACCESS_KEY;

  if (!adminAccessKey || token !== adminAccessKey) {
    notFound();
  }

  redirect(`/internal-admin-access/${encodeURIComponent(token)}`);
}