'use client';

import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${user?.agent_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
              {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{user?.first_name} {user?.last_name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <div className="flex gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${user?.agent_type === 'BOT' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>{user?.agent_type}</span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${user?.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{user?.role}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h2>
          <p className="text-sm text-gray-500">Settings and preferences coming soon.</p>
        </div>
      </div>
    </Layout>
  );
}
