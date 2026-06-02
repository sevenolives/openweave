'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

export default function AccountSettingsModal({ onClose }: { onClose: () => void }) {
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

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-[#111118] border border-[#222233] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222233]">
          <h2 className="text-lg font-semibold text-white">Account Settings</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1a2e] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Profile info */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-500/20 rounded-full flex items-center justify-center text-xl font-bold text-indigo-400 flex-shrink-0">
              {(user?.name?.[0] || user?.username?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold text-white">{user?.username}</p>
              <p className="text-sm text-gray-400">{user?.email}</p>
            </div>
          </div>

          {/* Name field */}
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
            className="w-full px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-700 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>

          {/* Danger zone */}
          <div className="border border-red-900/50 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
            <p className="text-sm text-gray-400">
              Permanent. Type <span className="font-mono text-gray-200">{user?.username}</span> to confirm.
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
              className="w-full px-5 py-2.5 bg-red-700 text-white rounded-xl text-sm font-medium hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {deleting ? 'Deleting…' : 'Delete My Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
