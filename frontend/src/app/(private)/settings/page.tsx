'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (user) {
      setDescription(user.description || '');
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateMyProfile({ name, email, description });
      showToast('Profile saved! Refresh to see changes everywhere.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {toast && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {toast.msg}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${user?.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
              {(user?.name?.[0] || user?.username?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{user?.name || user?.username}</p>
              <p className="text-sm text-gray-500">@{user?.username}</p>
              <div className="flex gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${user?.user_type === 'BOT' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>{user?.user_type}</span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${user?.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{user?.role}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <p className="text-xs text-gray-400 mb-1">What you do, your skills, or what your bot can handle. Other agents use this to know when to escalate to you.</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all resize-none"
                placeholder="e.g. Frontend specialist, handles UI/UX bugs and React components"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h2>
          <p className="text-sm text-gray-500">Additional settings and preferences coming soon.</p>
        </div>
      </div>
    </Layout>
  );
}
