'use client'

import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline'

interface JsonValue {
  [key: string]: any
}

function JsonViewer({ data, depth = 0 }: { data: JsonValue | string | number | boolean | null, depth?: number }) {
  const [collapsed, setCollapsed] = useState<{ [key: string]: boolean }>({})
  
  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (data === null) return <span className="text-gray-500 italic">null</span>
  if (typeof data === 'string') return <span className="text-green-600">"{data}"</span>
  if (typeof data === 'number') return <span className="text-blue-600">{data}</span>
  if (typeof data === 'boolean') return <span className="text-purple-600">{data.toString()}</span>

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-500">[]</span>
    
    const key = `array-${depth}`
    const isCollapsed = collapsed[key]
    
    return (
      <div>
        <button 
          onClick={() => toggleCollapse(key)}
          className="flex items-center text-gray-700 hover:text-gray-900"
        >
          {isCollapsed ? (
            <ChevronRightIcon className="w-4 h-4 mr-1" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 mr-1" />
          )}
          <span className="text-gray-500">[{data.length}]</span>
        </button>
        {!isCollapsed && (
          <div className="ml-4 border-l border-gray-200 pl-4 mt-1">
            {data.map((item, index) => (
              <div key={index} className="py-1">
                <span className="text-gray-500 mr-2">{index}:</span>
                <JsonViewer data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data)
    if (keys.length === 0) return <span className="text-gray-500">{'{}'}</span>
    
    const key = `object-${depth}`
    const isCollapsed = collapsed[key]
    
    return (
      <div>
        <button 
          onClick={() => toggleCollapse(key)}
          className="flex items-center text-gray-700 hover:text-gray-900"
        >
          {isCollapsed ? (
            <ChevronRightIcon className="w-4 h-4 mr-1" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 mr-1" />
          )}
          <span className="text-gray-500">{'{'}{keys.length}{'}'}</span>
        </button>
        {!isCollapsed && (
          <div className="ml-4 border-l border-gray-200 pl-4 mt-1">
            {keys.map(k => (
              <div key={k} className="py-1">
                <span className="text-blue-800 font-medium mr-2">"{k}":</span>
                <JsonViewer data={data[k]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return <span>{String(data)}</span>
}

function ResponseHeaders({ headers }: { headers: Headers }) {
  const headerEntries = Array.from(headers.entries())
  
  if (headerEntries.length === 0) {
    return <div className="text-gray-500 italic">No headers</div>
  }

  return (
    <div className="space-y-1">
      {headerEntries.map(([key, value]) => (
        <div key={key} className="flex">
          <span className="font-medium text-blue-800 mr-2 w-40 flex-shrink-0">{key}:</span>
          <span className="text-gray-700 break-all">{value}</span>
        </div>
      ))}
    </div>
  )
}

function CopyButton({ text, label = "Copy" }: { text: string, label?: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
    >
      {copied ? (
        <>
          <CheckIcon className="w-3 h-3" />
          Copied!
        </>
      ) : (
        <>
          <ClipboardIcon className="w-3 h-3" />
          {label}
        </>
      )}
    </button>
  )
}

export default function ApiResponseInspector() {
  const [url, setUrl] = useState('https://api.github.com/repos/microsoft/typescript')
  const [method, setMethod] = useState('GET')
  const [headers, setHeaders] = useState('{\n  "User-Agent": "API Response Inspector",\n  "Accept": "application/json"\n}')
  const [body, setBody] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [responseTime, setResponseTime] = useState<number | null>(null)

  const makeRequest = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setLoading(true)
    setError('')
    setResponse(null)
    setResponseTime(null)

    const startTime = performance.now()

    try {
      let requestHeaders: HeadersInit = {}
      
      if (headers.trim()) {
        try {
          requestHeaders = JSON.parse(headers)
        } catch (e) {
          throw new Error('Invalid JSON in headers')
        }
      }

      const requestOptions: RequestInit = {
        method,
        headers: requestHeaders,
      }

      if (method !== 'GET' && method !== 'HEAD' && body.trim()) {
        requestOptions.body = body
      }

      const res = await fetch(url, requestOptions)
      const endTime = performance.now()
      setResponseTime(Math.round(endTime - startTime))

      let responseData
      const contentType = res.headers.get('content-type') || ''
      
      if (contentType.includes('application/json')) {
        responseData = await res.json()
      } else {
        responseData = await res.text()
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        data: responseData,
        url: res.url
      })
    } catch (err) {
      const endTime = performance.now()
      setResponseTime(Math.round(endTime - startTime))
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-50'
    if (status >= 300 && status < 400) return 'text-yellow-600 bg-yellow-50'
    if (status >= 400 && status < 500) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">API Response Inspector</h1>
            <p className="text-blue-100">Test API endpoints and inspect responses with detailed formatting</p>
          </div>

          <div className="p-6">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Request Panel */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800">Request</h2>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL
                    </label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://api.example.com/endpoint"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Method
                    </label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                      <option value="HEAD">HEAD</option>
                      <option value="OPTIONS">OPTIONS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Headers (JSON)
                    </label>
                    <textarea
                      value={headers}
                      onChange={(e) => setHeaders(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder='{"Content-Type": "application/json"}'
                    />
                  </div>

                  {method !== 'GET' && method !== 'HEAD' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Request Body
                      </label>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        placeholder='{"key": "value"}'
                      />
                    </div>
                  )}

                  <button
                    onClick={makeRequest}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Sending Request...' : 'Send Request'}
                  </button>
                </div>
              </div>

              {/* Response Panel */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800">Response</h2>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <h3 className="text-lg font-medium text-red-800 mb-1">Error</h3>
                    <p className="text-red-600">{error}</p>
                    {responseTime && (
                      <p className="text-sm text-red-500 mt-1">Time: {responseTime}ms</p>
                    )}
                  </div>
                )}

                {response && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-md p-4">
                      <div className="flex flex-wrap items-center gap-4 mb-2">
                        <div className={`px-2 py-1 rounded text-sm font-medium ${getStatusColor(response.status)}`}>
                          {response.status} {response.statusText}
                        </div>
                        {responseTime && (
                          <span className="text-sm text-gray-600">
                            {responseTime}ms
                          </span>
                        )}
                        <CopyButton text={`${response.status} ${response.statusText}`} label="Copy Status" />
                      </div>
                      <p className="text-sm text-gray-600 break-all">{response.url}</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-800">Headers</h3>
                        <CopyButton 
                          text={JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)} 
                          label="Copy Headers" 
                        />
                      </div>
                      <div className="bg-gray-50 rounded-md p-3 text-sm max-h-64 overflow-auto">
                        <ResponseHeaders headers={response.headers} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-800">Response Body</h3>
                        <CopyButton 
                          text={typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)} 
                          label="Copy Body" 
                        />
                      </div>
                      <div className="bg-gray-50 rounded-md p-3 text-sm max-h-96 overflow-auto">
                        <JsonViewer data={response.data} />
                      </div>
                    </div>
                  </div>
                )}

                {!response && !error && !loading && (
                  <div className="text-center py-12 text-gray-500">
                    <p>Send a request to see the response here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 border-t">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <strong>Free Tool by OpenWeave</strong> • Test API endpoints without signup
              </div>
              <a 
                href="https://openweave.dev" 
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Build intelligent workflows →
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">About This Tool</h2>
          <p className="text-gray-600 mb-4">
            The API Response Inspector is a free tool for developers to test API endpoints, 
            inspect responses, and debug integrations. Features include:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 mb-4">
            <li>Support for all HTTP methods (GET, POST, PUT, DELETE, etc.)</li>
            <li>Custom headers and request body support</li>
            <li>Formatted JSON response viewer with collapsible sections</li>
            <li>Response time measurement</li>
            <li>One-click copying of status, headers, or response body</li>
            <li>Error handling and detailed status information</li>
          </ul>
          <p className="text-sm text-gray-500">
            Want to build more powerful API workflows? Check out OpenWeave's intelligent automation platform 
            for creating AI-powered integrations and workflows.
          </p>
        </div>
      </div>
    </div>
  )
}