'use client';
import React from 'react';
import { RestockAlertsProvider } from '@/shared/client/providers/RestockAlertsProvider';
import StoreHeader from '@/components/StoreHeader';
import StoreFooter from '@/components/StoreFooter';
import AttributionCapture from '@/components/Tracking/AttributionCapture';
import ConsentBanner from '@/components/Tracking/ConsentBanner';
import TrackingTags from '@/components/Tracking/TrackingTags';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <RestockAlertsProvider>
      <div className="mu-shell flex min-h-screen flex-col">
        <StoreHeader />
        <main className="flex-1">{children}</main>
        <StoreFooter />
        <AttributionCapture />
        <TrackingTags />
        <ConsentBanner />
      </div>
    </RestockAlertsProvider>
  );
}
