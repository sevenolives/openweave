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
  const [seatInput, setSeatInput] = useState('');
  const [seatActionLoading, setSeatActionLoading] = useState(false);

  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');

  useEffect(() => {
    if (!currentWorkspace) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.getSubscriptionStatus(currentWorkspace.slug),
      api.getWorkspaceMembers({ workspace: currentWorkspace.slug })
    ])
      .then(([sub, members]) => {
        setSubscription(sub);
        setMembers(members);
        setSeatInput(String(sub.licensed_seats || 3));
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
    const newSeatCount = parseInt(seatInput);
    if (!currentWorkspace || !newSeatCount || newSeatCount < 1) return;
    setSeatActionLoading(true);
    try {
      const result = await api.manageSeats(currentWorkspace.slug, newSeatCount);
      if (subscription) {
        setSubscription({
          ...subscription,
          licensed_seats: result.licensed_seats,
          occupied_seats: result.occupied_seats,
          available_seats: result.available_seats,
        });
      }
      setSeatInput(String(result.licensed_seats));
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update seat count');
    } finally {
      setSeatActionLoading(false);
    }
  };

  const planLabel = subscription?.plan === 'pro' ? 'Pro' : subscription?.plan === 'enterprise' ? 'Enterprise' : 'Free';
  const licensedSeats = subscription?.licensed_seats ?? 3;
  const occupiedSeats = subscription?.occupied_seats ?? (currentWorkspace ? members.length + 1 : 1);
  const availableSeats = subscription?.available_seats ?? (licensedSeats - occupiedSeats);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Billing</h1>

        {success && (
          <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            🎉 Subscription activated! Welcome to Pro.
          </div>
        )}
        {cancelled && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Checkout was cancelled. No changes were made.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Current Plan</p>
                  <p className="text-2xl font-bold text-gray-900">{planLabel}</p>
                </div>
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                  subscription?.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  subscription?.status === 'past_due' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {subscription?.status === 'active' ? '● Active' : subscription?.status || 'active'}
                </span>
              </div>
              
              <div className="space-y-3">
                {subscription?.plan === 'free' ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Users</span>
                    <span className="text-gray-900 font-medium">{occupiedSeats} of {licensedSeats}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Licensed seats</span>
                      <span className="text-gray-900 font-semibold text-lg">{licensedSeats}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Occupied</span>
                      <span className="text-gray-900 font-medium">{occupiedSeats} of {licensedSeats}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Available</span>
                      <span className={`font-medium ${availableSeats > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {availableSeats} remaining
                      </span>
                    </div>
                    {/* Seat usage bar */}
                    <div className="mt-2">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${occupiedSeats >= licensedSeats ? 'bg-amber-500' : 'bg-indigo-500'}`}
                          style={{ width: `${Math.min(100, (occupiedSeats / licensedSeats) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1">
                      <span className="text-gray-500">Per-seat price</span>
                      <span className="text-gray-900 font-medium">$12/seat/month</span>
                    </div>
                  </>
                )}
              </div>
              
              {subscription?.current_period_end && (
                <p className="text-sm text-gray-400 mt-4 pt-3 border-t border-gray-100">
                  Next billing: {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Upgrade to Pro */}
            {subscription?.plan === 'free' && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Upgrade to Pro</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Licensed seats, unlimited workspaces &amp; projects, custom state machines, and more.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleUpgrade('pro_monthly')}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Redirecting…' : '$12/seat/mo — Monthly'}
                  </button>
                  <button
                    onClick={() => handleUpgrade('pro_annual')}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-lg border border-indigo-200 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Redirecting…' : '$10/seat/mo — Annual'}
                  </button>
                </div>
              </div>
            )}

            {/* Seat Management */}
            {subscription?.plan !== 'free' && subscription?.stripe_customer_id && (
              <>
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Manage Seats</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Add or remove user licenses. Changes are reflected in your next billing cycle.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={seatInput}
                      onChange={(e) => setSeatInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-24 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-base font-medium text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Seats"
                    />
                    <span className="text-sm text-gray-500">seats</span>
                    <button
                      onClick={handleSeatUpdate}
                      disabled={seatActionLoading || !seatInput || parseInt(seatInput) === licensedSeats}
                      className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {seatActionLoading ? 'Updating…' : 'Update'}
                    </button>
                  </div>
                  {seatInput && parseInt(seatInput) > licensedSeats && (
                    <p className="text-sm text-gray-500 mt-3">
                      Adding {parseInt(seatInput) - licensedSeats} seat(s) → +${(parseInt(seatInput) - licensedSeats) * 12}/mo
                    </p>
                  )}
                </div>

                {/* Manage Subscription */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Manage Subscription</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Update payment method, change plan, or cancel via Stripe.
                  </p>
                  <button
                    onClick={handleManage}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Redirecting…' : 'Manage Subscription →'}
                  </button>
                </div>
              </>
            )}
            
            {/* Plan Comparison */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Comparison</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Free</h3>
                  <ul className="space-y-1.5 text-sm text-gray-500">
                    <li>• Up to 3 users</li>
                    <li>• 1 workspace</li>
                    <li>• 2 projects</li>
                    <li>• Default state machine</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-indigo-600 mb-2">Pro — $12/seat/mo</h3>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    <li>• Licensed seats — buy as needed</li>
                    <li>• Unlimited workspaces &amp; projects</li>
                    <li>• Custom state machines</li>
                    <li>• Gate-based permissions</li>
                    <li>• 1 year audit retention</li>
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
