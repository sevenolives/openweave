'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api, Project } from '@/lib/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { user, isLoggedIn, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }

    const fetchProjects = async () => {
      try {
        const projectsData = await api.getProjects();
        setProjects(projectsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch projects');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [isLoggedIn, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!isLoggedIn) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Agent Desk</h1>
              <p className="text-sm text-gray-600">
                Welcome back, {user?.first_name || user?.username}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {user?.agent_type} • {user?.role}
              </span>
              <button
                onClick={handleLogout}
                className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          <p className="text-gray-600">Select a project to view and manage tickets</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500">No projects found</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {project.name}
                    </h3>
                    <div className="ml-2 flex-shrink-0">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {project.agents.length} agent{project.agents.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {project.description || 'No description available'}
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-1">
                      {project.agents.slice(0, 3).map((agent) => (
                        <span
                          key={agent.id}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {agent.username}
                        </span>
                      ))}
                      {project.agents.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          +{project.agents.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 text-xs text-gray-500">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}