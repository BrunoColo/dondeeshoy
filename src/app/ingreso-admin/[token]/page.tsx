import { notFound, redirect } from "next/navigation";

import { createAccessToken, setAdminAccessCookie } from "@/lib/admin-auth";

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
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminAccessKey || !adminSecret || token !== adminAccessKey) {
    notFound();
  }

  const accessToken = await createAccessToken(adminSecret);
  await setAdminAccessCookie(accessToken);

  redirect("/admin/login");
}