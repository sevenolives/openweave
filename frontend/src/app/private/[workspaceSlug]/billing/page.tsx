'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import { api, SubscriptionStatus, WorkspaceMember } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function BillingPage() {
  const { currentWorkspace } = useWorkspace();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  // Use currentWorkspace slug if available, fall back to URL param
  const wsSlug = currentWorkspace?.slug || workspaceSlug;
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [seatInput, setSeatInput] = useState('');
  const [seatActionLoading, setSeatActionLoading] = useState(false);
  const [upgradeSeats, setUpgradeSeats] = useState(5);
  const { toast } = useToast();

  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');

  useEffect(() => {
    if (!wsSlug) return;
    setLoading(true);
    Promise.all([
      api.getSubscriptionStatus(wsSlug),
      api.getWorkspaceMembers({ workspace: wsSlug })
    ])
      .then(([sub, members]) => {
        setSubscription(sub);
        setMembers(members);
        setSeatInput(String(sub.licensed_seats || 3));
        setUpgradeSeats(Math.max(sub.occupied_seats || 1, 5));
      })
      .catch((err: any) => {
        const message = err?.detail || err?.message || 'Failed to load billing data';
        toast(message, 'error');
      })
      .finally(() => setLoading(false));
  }, [wsSlug]);

  const [couponCode, setCouponCode] = useState('');

  const handleUpgrade = async (plan: 'pro_monthly' | 'pro_annual') => {
    if (!wsSlug) return;
    setActionLoading(true);
    try {
      // Base price is flat ($29/mo or $24/mo annual) — quantity=1, not per-seat
      const { checkout_url } = await api.createCheckoutSession(wsSlug, plan, 1, couponCode.trim() || undefined);
      window.location.href = checkout_url;
    } catch (err: any) {
      const message = err?.detail || err?.message || 'Checkout failed';
      toast(message, 'error');
      setActionLoading(false);
    }
  };

  const handleManage = async () => {
    if (!wsSlug) return;
    setActionLoading(true);
    try {
      const { portal_url } = await api.createPortalSession(wsSlug);
      window.location.href = portal_url;
    } catch (err: any) {
      const message = err?.detail || err?.message || 'Failed to open billing portal';
      toast(message, 'error');
      setActionLoading(false);
    }
  };

  const handleSeatUpdate = async () => {
    const newSeatCount = parseInt(seatInput);
    if (!currentWorkspace || !newSeatCount || newSeatCount < 1) return;
    setSeatActionLoading(true);
    try {
      const result = await api.manageSeats(wsSlug, newSeatCount);
      if (subscription) {
        setSubscription({
          ...subscription,
          licensed_seats: result.licensed_seats,
          occupied_seats: result.occupied_seats,
          available_seats: result.available_seats,
        });
      }
      setSeatInput(String(result.licensed_seats));
      toast(result.message, 'success');
    } catch (err: any) {
      const message = err?.detail || err?.message || 'Failed to update seat count';
      toast(message, 'error');
    } finally {
      setSeatActionLoading(false);
    }
  };

  const planLabels: Record<string, string> = { free: 'Free', pro: 'Pro' };
  const planLabel = planLabels[subscription?.plan ?? 'free'] ?? subscription?.plan ?? 'Free';
  const licensedSeats = subscription?.licensed_seats ?? 3;
  const occupiedSeats = subscription?.occupied_seats ?? (currentWorkspace ? members.length + 1 : 1);
  const availableSeats = subscription?.available_seats ?? (licensedSeats - occupiedSeats);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-white mb-6">Billing</h1>

        {success && (
          <div className="mb-6 rounded-lg border border-emerald-800 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
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
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#222233] border-t-indigo-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="rounded-xl border border-[#222233] bg-[#111118] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-400">Current Plan</p>
                  <p className="text-2xl font-bold text-white">{planLabel}</p>
                </div>
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                  subscription?.status === 'active' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' :
                  subscription?.status === 'past_due' ? 'bg-amber-900/50 text-amber-300 border border-amber-800' :
                  'bg-gray-800 text-gray-400 border border-gray-700'
                }`}>
                  {subscription?.status === 'active' ? '● Active' : subscription?.status || 'active'}
                </span>
              </div>
              
              <div className="space-y-3">
                {subscription?.plan === 'free' ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Users</span>
                    <span className="text-white font-medium">{occupiedSeats} of {licensedSeats}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Licensed seats</span>
                      <span className="text-white font-semibold text-lg">{licensedSeats}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Occupied</span>
                      <span className="text-white font-medium">{occupiedSeats} of {licensedSeats}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Available</span>
                      <span className={`font-medium ${availableSeats > 0 ? 'text-emerald-400' : 'text-amber-600'}`}>
                        {availableSeats} remaining
                      </span>
                    </div>
                    {/* Seat usage bar */}
                    <div className="mt-2">
                      <div className="h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${occupiedSeats >= licensedSeats ? 'bg-amber-500' : 'bg-indigo-500'}`}
                          style={{ width: `${Math.min(100, (occupiedSeats / licensedSeats) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1">
                      <span className="text-gray-500">Per-seat price</span>
                      <span className="text-white font-medium">$29/mo (10 agents included, +$4/additional)</span>
                    </div>
                  </>
                )}
              </div>
              
              {subscription?.current_period_end && (
                <p className="text-sm text-gray-500 mt-4 pt-3 border-t border-[#222233]">
                  Next billing: {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Upgrade to Pro */}
            {subscription?.plan === 'free' && (
              <div className="rounded-xl border border-[#222233] bg-[#111118] p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Upgrade to Pro</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Licensed seats, unlimited workspaces &amp; projects, custom state machines, and more.
                </p>

                {/* Pricing */}
                <div className="mb-6 space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">$29</span>
                    <span className="text-sm text-gray-400">/month</span>
                  </div>
                  <p className="text-sm text-gray-400">10 agents included. Additional agents $4/mo each.</p>
                  <p className="text-sm text-gray-400">You currently have <strong className="text-white">{occupiedSeats} agent{occupiedSeats !== 1 ? 's' : ''}</strong>{occupiedSeats > 10 ? ` — ${occupiedSeats - 10} additional agent${occupiedSeats - 10 !== 1 ? 's' : ''} at $4/mo ($${(occupiedSeats - 10) * 4}/mo extra)` : ''}.</p>
                </div>

                {/* Coupon code */}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value)}
                    placeholder="Coupon code (optional)"
                    className="flex-1 px-3 py-2 bg-[#1a1a2e] border border-[#222233] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                  {couponCode && (
                    <button onClick={() => setCouponCode('')} className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleUpgrade('pro_monthly')}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Redirecting…' : '$29/mo — Monthly'}
                  </button>
                  <button
                    onClick={() => handleUpgrade('pro_annual')}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-lg border border-indigo-500/30 text-indigo-400 text-sm font-medium hover:bg-indigo-900/200/10 transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Redirecting…' : '$24/mo — Annual'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">You can also enter promo codes on the Stripe checkout page.</p>
              </div>
            )}

            {/* Seat Management */}
            {subscription?.plan !== 'free' && subscription?.stripe_customer_id && (
              <>
                <div className="rounded-xl border border-[#222233] bg-[#111118] p-6">
                  <h2 className="text-lg font-semibold text-white mb-2">Manage Seats</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Add or remove user licenses. Changes are reflected in your next billing cycle.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={seatInput}
                      onChange={(e) => setSeatInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-24 px-4 py-2.5 rounded-lg border border-[#222233] text-white bg-[#1a1a2e] text-base font-medium text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Seats"
                    />
                    <span className="text-sm text-gray-400">seats</span>
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
                <div className="rounded-xl border border-[#222233] bg-[#111118] p-6">
                  <h2 className="text-lg font-semibold text-white mb-2">Manage Subscription</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Update payment method, change plan, or cancel via Stripe.
                  </p>
                  <button
                    onClick={handleManage}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-lg border border-[#222233] text-gray-300 text-sm font-medium hover:bg-[#1a1a2e] transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Redirecting…' : 'Manage Subscription →'}
                  </button>
                </div>
              </>
            )}
            
            {/* Plan Comparison */}
            <div className="rounded-xl border border-[#222233] bg-[#111118] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Plan Comparison</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-300 mb-2">Free</h3>
                  <ul className="space-y-1.5 text-sm text-gray-400">
                    <li>• Up to 3 users</li>
                    <li>• 1 workspace</li>
                    <li>• 2 projects</li>
                    <li>• Default state machine</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-indigo-400 mb-2">Pro — $29/mo + $4/additional agent</h3>
                  <ul className="space-y-1.5 text-sm text-gray-300">
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
