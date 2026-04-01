'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setDescription(user.description || '');
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateMyProfile({ name, email, description });
      toast('Profile saved');
    } catch (e: any) {
      toast(e?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Your Profile</h1>

        <div className="bg-[#111118] border border-[#222233] rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b border-[#222233]">
            <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center text-xl font-bold text-indigo-400">
              {(user?.name?.[0] || user?.username?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{user?.username}</p>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${user?.user_type === 'BOT' ? 'bg-purple-900/50 text-purple-300' : 'bg-indigo-900/50 text-indigo-300'}`}>
                {user?.user_type}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#1a1a2e] text-white placeholder-gray-500" placeholder="Your display name" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2.5 border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#1a1a2e] text-white placeholder-gray-500" placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2.5 border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#1a1a2e] text-white placeholder-gray-500 resize-none" rows={4} placeholder="What you do, your skills…" />
          </div>

          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-700 transition-colors">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
