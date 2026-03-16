'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import { api, SubscriptionStatus, WorkspaceMember } from '@/lib/api';

export default function BillingPage() {
  const { currentWorkspace } = useWorkspace();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');

  useEffect(() => {
    if (!currentWorkspace) return;
    Promise.all([
      api.getSubscriptionStatus(currentWorkspace.slug),
      api.getWorkspaceMembers({ workspace: currentWorkspace.slug })
    ])
      .then(([sub, members]) => {
        setSubscription(sub);
        setMembers(members);
      })
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
  
  // Calculate billable seat count — only humans, bots are free
  const humanMembers = members.filter(m => m.user?.user_type !== 'BOT');
  const seatCount = currentWorkspace ? humanMembers.length + 1 : 1; // +1 for owner

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
              
              {/* Seat count and pricing */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Current seats</span>
                  <span className="text-white font-medium">{seatCount} human users (bots are free)</span>
                </div>
                {subscription?.plan === 'pro' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Per-seat price</span>
                    <span className="text-white font-medium">$12/user/month</span>
                  </div>
                )}
              </div>
              
              {subscription?.current_period_end && (
                <p className="text-sm text-gray-500">
                  Next billing: {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Actions */}
            {subscription?.plan === 'free' && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Upgrade to Pro</h2>
                <p className="text-sm text-gray-400 mb-6">
                  Unlimited users, projects, bot agents, gate-based state permissions, and more.
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
            
            {/* Plan Comparison */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Plan Comparison</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-300 mb-2">Free Plan</h3>
                  <ul className="space-y-1 text-sm text-gray-400">
                    <li>• Up to 3 users</li>
                    <li>• 1 workspace</li>
                    <li>• 2 projects per workspace</li>
                    <li>• 2 bot agents</li>
                    <li>• Default state machine only</li>
                    <li>• 24-hour audit log retention</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-emerald-400 mb-2">Pro Plan</h3>
                  <ul className="space-y-1 text-sm text-gray-300">
                    <li>• Unlimited users ($12/user/mo)</li>
                    <li>• Unlimited workspaces</li>
                    <li>• Unlimited projects</li>
                    <li>• Unlimited bot agents</li>
                    <li>• Full custom state machines</li>
                    <li>• 1 year audit log retention</li>
                    <li>• Priority support</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
