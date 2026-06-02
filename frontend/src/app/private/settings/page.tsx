'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

export default function AccountSettingsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) setName(user.name || '');
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateMyProfile({ name });
      toast('Name updated');
    } catch (e: any) {
      toast(e?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== user?.username) return;
    setDeleting(true);
    try {
      await api.deleteMyAccount();
      logout();
      router.push('/login');
    } catch (e: any) {
      toast(e?.message || 'Failed to delete account', 'error');
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>

        {/* Profile */}
        <div className="bg-[#111118] border border-[#222233] rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b border-[#222233]">
            <div className="w-14 h-14 bg-indigo-500/20 rounded-full flex items-center justify-center text-xl font-bold text-indigo-400">
              {(user?.name?.[0] || user?.username?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold text-white">{user?.username}</p>
              <p className="text-sm text-gray-400">{user?.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#222233] rounded-xl text-sm bg-[#1a1a2e] text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Your display name"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-700 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Danger zone */}
        <div className="bg-[#111118] border border-red-900/50 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-red-400">Danger Zone</h2>
          <p className="text-sm text-gray-400">
            Deleting your account is permanent. Type your username <span className="font-mono text-gray-200">{user?.username}</span> to confirm.
          </p>
          <input
            type="text"
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            className="w-full px-4 py-2.5 border border-red-900/50 rounded-xl text-sm bg-[#1a1a2e] text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder={user?.username}
          />
          <button
            onClick={handleDelete}
            disabled={deleteConfirm !== user?.username || deleting}
            className="px-5 py-2.5 bg-red-700 text-white rounded-xl text-sm font-medium hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete My Account'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
