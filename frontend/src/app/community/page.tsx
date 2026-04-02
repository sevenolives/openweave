'use client';

import { useState, useEffect } from 'react';
import PublicNav from '@/components/PublicNav';
import { api } from '@/lib/api';

interface CommunityTemplate {
  id: number;
  name: string;
  slug: string;
  description: string;
  workspace: {
    name: string;
    slug: string;
  };
  rating_sum: number;
  rating_count: number;
  sync_count: number;
  avg_rating: number;
  created_at: string;
  updated_at: string;
}

export default function CommunityPage() {
  const [templates, setTemplates] = useState<CommunityTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await api.getCommunityTemplates();
        setTemplates(data.results || data || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load community templates');
        console.error('Error loading community templates:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={i} className="text-yellow-400">★</span>
      );
    }

    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400">☆</span>
      );
    }

    const remaining = 5 - Math.ceil(rating);
    for (let i = 0; i < remaining; i++) {
      stars.push(
        <span key={`empty-${i}`} className="text-gray-600">☆</span>
      );
    }

    return stars;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <PublicNav />
      
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Community Workflows</h1>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto">
            Discover and explore public workspace templates shared by the OpenWeave community. 
            Find workflow patterns that match your team's needs.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {templates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No public templates available yet.</p>
                <p className="text-gray-500 text-sm mt-2">
                  Be the first to share your workflow by publishing it from your workspace settings!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-[#111118] border border-[#222233] rounded-xl p-6 hover:border-indigo-500/30 transition-colors cursor-pointer"
                    onClick={() => window.open(`/community/${template.workspace.slug}`, '_blank')}
                  >
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold text-white mb-2">{template.name}</h3>
                      <p className="text-sm text-gray-400 mb-1">by {template.workspace.name}</p>
                      {template.description && (
                        <p className="text-gray-300 text-sm line-clamp-3">{template.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1">
                        {renderStars(template.avg_rating)}
                        <span className="text-gray-400 ml-1">
                          ({template.rating_count})
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {template.sync_count}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#222233]">
                      <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
                        View Workspace →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}