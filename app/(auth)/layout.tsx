import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isDeveloperModeEnabled } from '@/lib/developer-mode';

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  if (isDeveloperModeEnabled()) {
    return children;
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/');
  }

  return children;
}
