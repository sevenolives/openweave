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
  const [newSeatCount, setNewSeatCount] = useState<number | null>(null);
  const [seatActionLoading, setSeatActionLoading] = useState(false);

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

  const handleSeatUpdate = async () => {
    if (!currentWorkspace || !newSeatCount || newSeatCount < 1) return;
    setSeatActionLoading(true);
    try {
      const result = await api.manageSeats(currentWorkspace.slug, newSeatCount);
      // Update subscription state with new seat info
      if (subscription) {
        setSubscription({
          ...subscription,
          licensed_seats: result.licensed_seats,
          occupied_seats: result.occupied_seats,
          available_seats: result.available_seats,
        });
      }
      setNewSeatCount(null);
      alert(result.message);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to update seat count');
    } finally {
      setSeatActionLoading(false);
    }
  };

  const planLabel = subscription?.plan === 'pro' ? 'Pro' : subscription?.plan === 'enterprise' ? 'Enterprise' : 'Free';
  const statusColor = subscription?.status === 'active' ? 'text-emerald-400' :
    subscription?.status === 'past_due' ? 'text-amber-400' : 'text-gray-400';
  
  // Get seat information from subscription
  const licensedSeats = subscription?.licensed_seats ?? 3;
  const occupiedSeats = subscription?.occupied_seats ?? (currentWorkspace ? members.length + 1 : 1);
  const availableSeats = subscription?.available_seats ?? (licensedSeats - occupiedSeats);

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
              
              {/* Seat information */}
              <div className="mb-3 space-y-2">
                {subscription?.plan === 'free' ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Users</span>
                    <span className="text-white font-medium">{occupiedSeats} of {licensedSeats}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Licensed seats</span>
                      <span className="text-white font-medium">{licensedSeats} seats</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Occupied seats</span>
                      <span className="text-white font-medium">{occupiedSeats} of {licensedSeats}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Available seats</span>
                      <span className={`font-medium ${availableSeats > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {availableSeats} remaining
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Per-seat price</span>
                      <span className="text-white font-medium">$12/user/month</span>
                    </div>
                  </>
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
              <>
                {/* Seat Management */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <h2 className="text-lg font-semibold text-white mb-2">Manage Seats</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Adjust your seat count to add or remove user licenses. Changes will be reflected in your next billing cycle.
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label htmlFor="seatCount" className="text-sm font-medium text-gray-300">
                        Seats:
                      </label>
                      <input
                        id="seatCount"
                        type="number"
                        min={occupiedSeats}
                        value={newSeatCount ?? licensedSeats}
                        onChange={(e) => setNewSeatCount(parseInt(e.target.value) || licensedSeats)}
                        className="w-20 px-2 py-1 rounded bg-white/5 border border-white/20 text-white text-sm"
                      />
                    </div>
                    <button
                      onClick={handleSeatUpdate}
                      disabled={seatActionLoading || !newSeatCount || newSeatCount === licensedSeats}
                      className="px-3 py-1 rounded text-sm bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {seatActionLoading ? 'Updating...' : 'Update Seats'}
                    </button>
                  </div>
                  {newSeatCount && newSeatCount < occupiedSeats && (
                    <p className="text-sm text-amber-400 mt-2">
                      ⚠️ Cannot reduce below {occupiedSeats} seats (current member count).
                    </p>
                  )}
                  {newSeatCount && newSeatCount > licensedSeats && (
                    <p className="text-sm text-gray-400 mt-2">
                      💡 Adding {newSeatCount - licensedSeats} seat(s) will cost ${(newSeatCount - licensedSeats) * 12}/month.
                    </p>
                  )}
                </div>

                {/* Subscription Management */}
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
              </>
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
                    <li>• Licensed seats ($12/seat/mo)</li>
                    <li>• Buy seats, assign users flexibly</li>
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
