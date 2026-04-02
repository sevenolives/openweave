'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PublicNav from '@/components/PublicNav';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface StateTemplate {
  id: number;
  name: string;
  description: string;
  icon: string;
  workspace_name: string;
  workspace_slug: string;
  sync_count: number;
  item_count: number;
  state_flow_preview: string;
  created_at: string;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: StateTemplate[];
}

export default function CommunityStatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<StateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);
  const [detailedTemplate, setDetailedTemplate] = useState<any>(null);

  const pageSize = 12;

  useEffect(() => {
    loadTemplates();
  }, [currentPage, searchQuery]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
      });
      
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`/api/state-templates/?${params}`);
      if (!response.ok) throw new Error('Failed to load templates');
      
      const data: PaginatedResponse = await response.json();
      setTemplates(data.results);
      setTotalPages(Math.ceil(data.count / pageSize));
    } catch (err: any) {
      setError(err?.message || 'Failed to load community templates');
      console.error('Error loading community templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const expandTemplate = async (templateId: number) => {
    if (expandedTemplate === templateId) {
      setExpandedTemplate(null);
      setDetailedTemplate(null);
      return;
    }

    try {
      const response = await fetch(`/api/state-templates/${templateId}/`);
      if (!response.ok) throw new Error('Failed to load template details');
      
      const data = await response.json();
      setDetailedTemplate(data);
      setExpandedTemplate(templateId);
    } catch (err: any) {
      toast(err?.message || 'Failed to load template details', 'error');
    }
  };

  const importTemplate = async (templateId: number) => {
    const workspaceSlug = prompt('Enter your workspace slug to import this template:');
    if (!workspaceSlug) return;

    try {
      const response = await api.importStateTemplate(templateId, workspaceSlug);
      toast(`Successfully imported! Added ${response.added} new states, ${response.skipped} already existed.`, 'success');
    } catch (err: any) {
      if (err.message.includes('login')) {
        if (confirm('You need to log in to import templates. Go to login page?')) {
          router.push('/login');
        }
      } else {
        toast(err?.message || 'Failed to import template', 'error');
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadTemplates();
  };

  const renderPageNumbers = () => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    for (let i = start; i <= end; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            i === currentPage
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <PublicNav />
      
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Community State Templates</h1>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto">
            Discover and import state machine templates shared by the OpenWeave community. 
            Find workflow patterns that match your team's needs.
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="mb-8">
          <div className="max-w-md mx-auto">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-4 pr-12 py-3 bg-[#111118] border border-[#222233] rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 p-2 text-gray-400 hover:text-white"
              >
                🔍
              </button>
            </div>
          </div>
        </form>

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
                <p className="text-gray-400 text-lg">
                  {searchQuery ? 'No templates found matching your search.' : 'No public templates available yet.'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  {!searchQuery && "Be the first to share your workflow by publishing it from your workspace settings!"}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {templates.map((template) => (
                    <div key={template.id} className="bg-[#111118] border border-[#222233] rounded-xl overflow-hidden hover:border-indigo-500/30 transition-colors">
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-2xl">{template.icon}</span>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-white truncate">{template.name}</h3>
                            <p className="text-xs text-gray-400">by {template.workspace_name}</p>
                          </div>
                        </div>

                        {/* State flow preview */}
                        <div className="mb-4">
                          <p className="text-sm text-gray-300 font-mono text-center py-3 bg-gray-900/50 rounded-lg">
                            {template.state_flow_preview}
                          </p>
                        </div>

                        {/* Description */}
                        {template.description && (
                          <p className="text-gray-300 text-sm mb-4 line-clamp-2">{template.description}</p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                          <span>🔄 {template.sync_count} imports</span>
                          <span>{template.item_count} states</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => expandTemplate(template.id)}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                          >
                            {expandedTemplate === template.id ? 'Collapse' : 'Preview'}
                          </button>
                          <button
                            onClick={() => importTemplate(template.id)}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                          >
                            Import
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {expandedTemplate === template.id && detailedTemplate && (
                        <div className="border-t border-[#222233] bg-gray-900/30 p-6">
                          <h4 className="text-sm font-semibold text-white mb-3">States in this template:</h4>
                          <div className="space-y-2">
                            {detailedTemplate.items.map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full border"
                                    style={{ backgroundColor: item.color, borderColor: item.color }}
                                  />
                                  <span className="text-sm text-gray-300">{item.name}</span>
                                  {item.is_default && <span className="text-xs text-yellow-400">⭐ default</span>}
                                </div>
                                <code className="text-xs text-gray-500">{item.key}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    {renderPageNumbers()}
                    
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}