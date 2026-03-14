'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import { api, SubscriptionStatus } from '@/lib/api';

export default function BillingPage() {
  const { currentWorkspace } = useWorkspace();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');

  useEffect(() => {
    if (!currentWorkspace) return;
    api.getSubscriptionStatus(currentWorkspace.slug)
      .then(setSubscription)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentWorkspace]);

  const handleUpgrade = async (plan: 'pro_monthly' | 'pro_annual') => {
    if (!currentWorkspace) return;
    setActionLoading(true);
    try {
      const { checkout_url } = await api.createCheckoutSession(currentWorkspace.slug, plan);
      window.location.href = checkout_url;
    } catch (err) {
      console.error(err);
      setActionLoading(false);
    }
  };

  const handleManage = async () => {
    if (!currentWorkspace) return;
    setActionLoading(true);
    try {
      const { portal_url } = await api.createPortalSession(currentWorkspace.slug);
      window.location.href = portal_url;
    } catch (err) {
      console.error(err);
      setActionLoading(false);
    }
  };

  const planLabel = subscription?.plan === 'pro' ? 'Pro' : subscription?.plan === 'enterprise' ? 'Enterprise' : 'Free';
  const statusColor = subscription?.status === 'active' ? 'text-emerald-400' :
    subscription?.status === 'past_due' ? 'text-amber-400' : 'text-gray-400';

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-white mb-6">Billing</h1>

        {success && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            🎉 Subscription activated! Welcome to Pro.
          </div>
        )}
        {cancelled && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Checkout was cancelled. No changes were made.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-white" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-400">Current Plan</p>
                  <p className="text-2xl font-bold text-white">{planLabel}</p>
                </div>
                <span className={`text-sm font-medium capitalize ${statusColor}`}>
                  {subscription?.status || 'active'}
                </span>
              </div>
              {subscription?.current_period_end && (
                <p className="text-sm text-gray-500">
                  Current period ends: {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Actions */}
            {subscription?.plan === 'free' && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Upgrade to Pro</h2>
                <p className="text-sm text-gray-400 mb-6">
                  Unlimited users, projects, bot agents, approval gates, and more.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleUpgrade('pro_monthly')}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Redirecting…' : '$12/user/mo — Monthly'}
                  </button>
                  <button
                    onClick={() => handleUpgrade('pro_annual')}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg border border-emerald-500/50 text-emerald-400 text-sm font-medium hover:bg-emerald-500/10 transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Redirecting…' : '$10/user/mo — Annual'}
                  </button>
                </div>
              </div>
            )}

            {subscription?.plan !== 'free' && subscription?.stripe_customer_id && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Manage Subscription</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Update payment method, change plan, or cancel via Stripe Customer Portal.
                </p>
                <button
                  onClick={handleManage}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Redirecting…' : 'Manage Subscription →'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
