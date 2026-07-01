'use client';

import { Suspense } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="h-full bg-gray-950" />}>
      <DashboardLayout />
    </Suspense>
  );
}
