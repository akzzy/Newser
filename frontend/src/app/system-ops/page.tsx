'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';

const SECRET_PASSWORD = 'admin';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [apiBase, setApiBase] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [currentTab, setCurrentTab] = useState<'overview' | 'sources' | 'history'>('overview');
  const [cronRuns, setCronRuns] = useState<any[]>([]);
  const [expandedCron, setExpandedCron] = useState<string | null>(null);
  const [sourcesData, setSourcesData] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [sourceArticles, setSourceArticles] = useState<any[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const limit = 20;
  
  // Reference for auto-scrolling terminal
  const terminalContainerRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SECRET_PASSWORD) {
      setIsAuthenticated(true);
      fetchData(1, 'all');
      fetchSources();
      fetchCronRuns();
    } else {
      setError('Incorrect password');
    }
  };

  const fetchData = async (pageNum: number | any = currentPage, currentFilter = filter) => {
    const targetPage = typeof pageNum === 'number' ? pageNum : currentPage;
    setLoading(true);
    setError('');
    try {
      let API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('127.')) {
          API_BASE = `http://${hostname}:3001`; 
        }
      }
      setApiBase(API_BASE);

      const response = await fetch(`${API_BASE}/api/admin/dashboard?page=${targetPage}&limit=${limit}&status=${currentFilter}`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Failed to fetch data (${response.status})`);
      const json = await response.json();
      setData(json);
      setCurrentPage(targetPage);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSources = async () => {
    setLoading(true);
    setError('');
    try {
      let API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('127.')) {
          API_BASE = `http://${hostname}:3001`; 
        }
      }
      setApiBase(API_BASE);

      const response = await fetch(`${API_BASE}/api/admin/sources`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch sources (${response.status})`);
      const json = await response.json();
      setSourcesData(json.sources || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCronRuns = async (base = apiBase) => {
    try {
      const response = await fetch(`${base}/api/admin/cron-runs`, { cache: 'no-store' });
      if (response.ok) {
        const json = await response.json();
        setCronRuns(json.runs || []);
      }
    } catch (err) {
      console.error('Failed to fetch cron runs', err);
    }
  };

  const fetchLogs = async (base = apiBase) => {
    if (!base) return;
    try {
      const response = await fetch(`${base}/api/admin/logs`, { cache: 'no-store' });
      if (response.ok) {
        const json = await response.json();
        setLogs(json.logs || []);
      }
    } catch (err) {
      // ignore log fetch errors silently
    }
  };

  // Poll for logs every 3 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchLogs(); // initial fetch
    const logInterval = setInterval(() => {
      fetchLogs();
    }, 3000);
    
    const cronInterval = setInterval(() => {
      fetchCronRuns();
    }, 15000);
    
    return () => {
      clearInterval(logInterval);
      clearInterval(cronInterval);
    };
  }, [isAuthenticated, apiBase]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (autoScroll && terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleTerminalScroll = () => {
    if (terminalContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = terminalContainerRef.current;
      // If user is within 50px of the bottom, enable auto-scroll, else disable it
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isNearBottom);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    try {
      const response = await fetch(`${apiBase}/api/admin/articles/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      fetchData();
    } catch (err) {
      alert(err);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle) return;
    try {
      const response = await fetch(`${apiBase}/api/admin/articles/${editingArticle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_hook: editingArticle.title_hook,
          ai_category: editingArticle.ai_category,
          deep_dive_content: editingArticle.deep_dive_content || ''
        })
      });
      if (!response.ok) throw new Error('Failed to update');
      setEditingArticle(null);
      fetchData();
    } catch (err) {
      alert(err);
    }
  };

  const handleFilterClick = (newFilter: string) => {
    if (filter === newFilter) {
      setFilter('all');
      fetchData(1, 'all');
    } else {
      setFilter(newFilter);
      fetchData(1, newFilter);
    }
  };

  const triggerScrape = async () => {
    if (!confirm('This will trigger a full RSS fetch and scraping cycle. Continue?')) return;
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/api/refresh`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to trigger refresh');
      alert('Scraping cycle triggered successfully! Check the terminal logs to watch progress.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/api/admin/alerts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (res.ok) {
        fetchData(); // Refresh the alerts
      }
    } catch (err) {
      console.error('Failed to resolve alert', err);
    }
  };

  const handleSourceClick = async (source: any) => {
    setSelectedSource(source);
    setLoadingArticles(true);
    setSourceArticles([]);
    try {
      const res = await fetch(`${apiBase}/api/admin/sources/${source.id}/articles`, {
        headers: { 'Authorization': `Bearer ${password}` }
      });
      const json = await res.json();
      if (json.articles) {
        setSourceArticles(json.articles);
      }
    } catch (err) {
      console.error('Failed to fetch source articles', err);
    } finally {
      setLoadingArticles(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <h2>System Operations</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter Access Key..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.loginBtn}>Unlock Terminal</button>
          </form>
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Newser System Operations</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={triggerScrape} disabled={loading} className={`${styles.refreshBtn} ${styles.triggerBtn}`}>
            Trigger Scraping Cycle
          </button>
          <button onClick={() => {
            if (currentTab === 'overview') fetchData();
            else fetchSources();
          }} disabled={loading} className={styles.refreshBtn}>
            {loading ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button 
          className={`${styles.tabBtn} ${currentTab === 'overview' ? styles.activeTab : ''}`}
          onClick={() => setCurrentTab('overview')}
        >
          Data Overview
        </button>
        <button 
          className={`${styles.tabBtn} ${currentTab === 'sources' ? styles.activeTab : ''}`}
          onClick={() => setCurrentTab('sources')}
        >
          Sources Monitor
        </button>
        <button 
          className={`${styles.tabBtn} ${currentTab === 'history' ? styles.activeTab : ''}`}
          onClick={() => {
            setCurrentTab('history');
            if (cronRuns.length === 0) fetchCronRuns();
          }}
        >
          Sync History
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* System Alerts Banner */}
      {data?.systemAlerts && data.systemAlerts.length > 0 && (
        <div className={styles.alertsContainer} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span> System Alerts ({data.systemAlerts.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {data.systemAlerts.map((alert: any) => (
              <div key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                <div>
                  <div style={{ color: '#fca5a5', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', textTransform: 'uppercase' }}>{alert.type.replace('_', ' ')}</div>
                  <div style={{ color: 'white', fontSize: '0.95rem' }}>{alert.message}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginTop: '4px' }}>
                    {alert.source?.name ? `Source: ${alert.source.name} • ` : ''}
                    {new Date(alert.created_at).toLocaleString()}
                  </div>
                </div>
                <button 
                  onClick={() => resolveAlert(alert.id)}
                  style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentTab === 'sources' && (
        <div className={styles.sourcesContainer}>
          <div className={styles.sourcesStatusBar}>
            <div className={styles.statusMetric}>
              <span className={styles.statusLabel}>Active Sources</span>
              <span className={styles.statusValue}>{sourcesData.filter(s => s.is_active).length}</span>
            </div>
            <div className={styles.statusMetric}>
              <span className={styles.statusLabel}>Total Articles Today</span>
              <span className={styles.statusValue}>
                {sourcesData.reduce((acc, s) => acc + (s.articles_today || 0), 0)}
              </span>
            </div>
            <div className={styles.statusMetric}>
              <span className={styles.statusLabel}>Total Database Size</span>
              <span className={styles.statusValue}>
                {sourcesData.reduce((acc, s) => acc + (s.total_articles || 0), 0)}
              </span>
            </div>
          </div>
          
          <div className={styles.tableContainer} style={{ marginTop: '2rem' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Method</th>
                  <th>Articles Today</th>
                  <th>Total Articles</th>
                  <th>Last Sync</th>
                </tr>
              </thead>
              <tbody>
                {sourcesData.map(source => (
                  <tr key={source.id} onClick={() => handleSourceClick(source)} style={{ cursor: 'pointer' }} className={styles.sourceRow}>
                    <td>
                      <div className={`${styles.statusDot} ${styles['status' + source.status]}`} title={source.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {source.logo_url && (
                          <img src={source.logo_url} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain', background: 'white' }} />
                        )}
                        <strong>{source.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className={styles.badge} style={{ opacity: 0.8 }}>{source.fetch_method.toUpperCase()}</span>
                    </td>
                    <td>
                      <span style={{ color: source.articles_today > 0 ? '#10b981' : '#c9d1d9' }}>
                        {source.articles_today}
                      </span>
                    </td>
                    <td>{source.total_articles}</td>
                    <td style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {source.last_fetch_time 
                        ? new Date(source.last_fetch_time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                        : 'Never'
                      }
                    </td>
                  </tr>
                ))}
                {sourcesData.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No sources found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === 'history' && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Sync Cycle Time</th>
                <th>Total Fetched</th>
                <th>Passed URL Check</th>
                <th>Semantic Drops</th>
                <th>Actually Inserted</th>
                <th>AI Rewrites (Success/Fail)</th>
                <th>Source Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {cronRuns.map(run => (
                <React.Fragment key={run.id}>
                  <tr onClick={() => setExpandedCron(expandedCron === run.id ? null : run.id)} style={{ cursor: 'pointer' }} className={styles.sourceRow}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(run.started_at).toLocaleString()}
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                        {run.completed_at ? `${((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s` : 'In Progress'}
                      </div>
                    </td>
                    <td><span className={styles.badge} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>{run.total_fetched}</span></td>
                    <td><span className={styles.badge} style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}>{run.total_new_urls}</span></td>
                    <td><span className={styles.badge} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}>{run.duplicates_dropped}</span></td>
                    <td><span className={styles.badge} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7' }}>{run.total_inserted}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: '#6ee7b7' }}>{run.ai_rewritten}</span> / <span style={{ color: '#fca5a5' }}>{run.ai_failed}</span>
                      </div>
                    </td>
                    <td style={{ color: '#93c5fd', textDecoration: 'underline' }}>
                      {expandedCron === run.id ? 'Hide Details' : 'View Details'}
                    </td>
                  </tr>
                  {expandedCron === run.id && run.source_breakdown && (
                    <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                      <td colSpan={7} style={{ padding: '1rem 2rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                          {Object.entries(run.source_breakdown).map(([sourceName, stats]: any) => {
                            if (sourceName === 'scraper_stats') {
                              return (
                                <div key={sourceName} style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.5rem 1rem', borderRadius: '8px', minWidth: '150px' }}>
                                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#93c5fd' }}>Extractus Scraper</div>
                                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Sent:</span> <span>{stats.attempted}</span>
                                  </div>
                                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Succeeded:</span> <span style={{ color: stats.succeeded > 0 ? '#6ee7b7' : 'inherit' }}>{stats.succeeded}</span>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div key={sourceName} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', minWidth: '150px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'white' }}>{sourceName}</div>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Fetched:</span> <span>{stats.fetched}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Inserted:</span> <span style={{ color: stats.inserted > 0 ? '#6ee7b7' : 'inherit' }}>{stats.inserted}</span>
                                </div>
                              </div>
                            );
                          })}
                          {Object.keys(run.source_breakdown).length === 0 && (
                            <div style={{ color: 'rgba(255,255,255,0.5)' }}>No source data recorded for this cycle.</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {cronRuns.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No sync history found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {currentTab === 'overview' && (
        <>
          {/* Bento Box Analytics Grid */}
      <div className={styles.bentoGrid}>
        
        {/* 1. The Queue (Full width) */}
        <div className={`${styles.bentoCard} ${styles.queueCard}`}>
          <div className={styles.cardTitle}>
            <span>⚡ AI Processing Factory</span>
          </div>
          <div className={styles.queueGrid}>
            <div className={`${styles.metricBox} ${filter === 'pending' ? styles.active : ''}`} onClick={() => handleFilterClick('pending')}>
              <div className={`${styles.metricValue} ${styles.pending}`}>
                {stats?.queue?.pending || 0}
              </div>
              <div className={styles.metricLabel}>Pending AI Rewrite</div>
            </div>
            <div className={`${styles.metricBox} ${filter === 'completed' ? styles.active : ''}`} onClick={() => handleFilterClick('completed')}>
              <div className={`${styles.metricValue} ${styles.completed}`}>
                {stats?.queue?.completed || 0}
              </div>
              <div className={styles.metricLabel}>Successfully Rewritten</div>
            </div>
            <div className={`${styles.metricBox} ${filter === 'failed' ? styles.active : ''}`} onClick={() => handleFilterClick('failed')}>
              <div className={`${styles.metricValue} ${styles.failed}`}>
                {stats?.queue?.failed || 0}
              </div>
              <div className={styles.metricLabel}>Failed / Rate Limited</div>
            </div>
          </div>
        </div>

        {/* 2. Scraper Data */}
        <div className={`${styles.bentoCard} ${styles.scrapeCard}`}>
          <div className={styles.cardTitle}>
            <span>🕷️ Data Extraction Engine</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
            <div className={`${styles.metricBox} ${filter === 'rss' ? styles.active : ''}`} style={{ flex: 1 }} onClick={() => handleFilterClick('rss')}>
              <div className={styles.metricValue}>{stats?.scraper?.rssOnly || 0}</div>
              <div className={styles.metricLabel}>Standard RSS Fetches</div>
            </div>
            <div className={`${styles.metricBox} ${filter === 'scraped' ? styles.active : ''}`} style={{ flex: 1 }} onClick={() => handleFilterClick('scraped')}>
              <div className={styles.metricValue}>{stats?.scraper?.scraped || 0}</div>
              <div className={styles.metricLabel}>Deep Web Scraped</div>
            </div>
          </div>
        </div>

        {/* 3. Deduplicator */}
        <div className={`${styles.bentoCard} ${styles.duplicateCard}`}>
          <div className={styles.cardTitle}>
            <span>🧠 Semantic Engine</span>
          </div>
          <div className={`${styles.metricBox} ${filter === 'duplicates' ? styles.active : ''}`} style={{ height: 'calc(100% - 2.5rem)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }} onClick={() => handleFilterClick('duplicates')}>
            <div className={styles.metricValue} style={{ fontSize: '3.5rem' }}>
              {stats?.duplicates || 0}
            </div>
            <div className={styles.metricLabel}>Duplicates Permanently Dropped</div>
          </div>
        </div>

      </div>

      {/* Data Terminal */}
      <div className={styles.terminalSection}>
        <div className={styles.terminalHeader}>
          <h2>{filter === 'duplicates' ? 'Permanently Dropped Duplicates' : 'Latest Articles'}</h2>
        </div>

        {/* Live Terminal Block */}
        <div className={styles.terminalContainer} style={{ marginTop: '2rem', background: '#0d1117', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#58a6ff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 8, height: 8, background: '#3fb950', borderRadius: '50%', boxShadow: '0 0 8px #3fb950' }} />
            Live Backend Terminal
          </h3>
          <div ref={terminalContainerRef} onScroll={handleTerminalScroll} style={{ 
            background: '#010409', 
            borderRadius: '6px', 
            padding: '1rem', 
            height: '300px', 
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            color: '#c9d1d9',
            lineHeight: 1.5,
            border: '1px solid #30363d'
          }}>
            {logs.length === 0 ? (
              <div style={{ color: '#8b949e', fontStyle: 'italic' }}>Waiting for server logs...</div>
            ) : (
              logs.map((line, i) => {
                let color = '#c9d1d9'; // default
                if (line.includes('INFO:')) color = '#58a6ff';
                if (line.includes('ERROR:') || line.includes('error')) color = '#f85149';
                if (line.includes('✓') || line.includes('Success')) color = '#3fb950';
                if (line.includes('Rate limited') || line.includes('WARNING')) color = '#d29922';
                
                return (
                  <div key={i} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '2px' }}>
                    {line}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              {filter === 'duplicates' ? (
                <tr>
                  <th>Date</th>
                  <th>Dropped Title</th>
                  <th>Matched Against</th>
                  <th>Score</th>
                </tr>
              ) : (
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Category</th>
                  <th>Title Hook</th>
                  <th>Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {filter === 'duplicates' ? (
                data?.duplicateLogs?.map((log: any) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}
                    </td>
                    <td style={{ maxWidth: '300px', color: '#ef4444' }}>
                      {log.dropped_source && <div className={styles.sourceBadge} style={{ marginBottom: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>{log.dropped_source}</div>}
                      {log.dropped_title}
                    </td>
                    <td style={{ maxWidth: '300px', color: '#10b981' }}>
                      {log.matched_source && <div className={styles.sourceBadge} style={{ marginBottom: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>{log.matched_source}</div>}
                      {log.matched_title}
                    </td>
                    <td>
                      <span className={styles.badge}>{log.score?.toFixed(2)}</span>
                    </td>
                  </tr>
                ))
              ) : (
                data?.recentArticles?.map((article: any) => (
                  <tr key={article.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(article.published_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}
                    </td>
                    <td>{article.source?.name}</td>
                    <td>
                      <span className={styles.badge}>{article.ai_category}</span>
                    </td>
                    <td style={{ maxWidth: '400px' }}>
                      {article.title_hook || article.title}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button 
                        onClick={() => setEditingArticle(article)}
                        className={styles.actionBtn}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(article.id)}
                        className={`${styles.actionBtn} ${styles.delete}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {filter === 'duplicates' && !data?.duplicateLogs?.length && !loading && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No duplicates recorded recently.
                  </td>
                </tr>
              )}
              {filter !== 'duplicates' && !data?.recentArticles?.length && !loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No articles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button 
            onClick={() => fetchData(currentPage - 1)} 
            disabled={currentPage === 1 || loading}
            className={styles.actionBtn}
          >
            Previous
          </button>
          <span style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
            Page {currentPage}
          </span>
          <button 
            onClick={() => fetchData(currentPage + 1)} 
            disabled={!data?.recentArticles?.length || data.recentArticles.length < limit || loading}
            className={styles.actionBtn}
          >
            Next
          </button>
        </div>
        </div>
        </>
      )}

      {/* Edit Modal */}
      {editingArticle && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>Edit Article</h2>
            <form onSubmit={handleSaveEdit}>
              <div className={styles.formGroup}>
                <label>Title Hook (Headline)</label>
                <input
                  type="text"
                  value={editingArticle.title_hook || ''}
                  onChange={(e) => setEditingArticle({...editingArticle, title_hook: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Category</label>
                <input
                  type="text"
                  value={editingArticle.ai_category || ''}
                  onChange={(e) => setEditingArticle({...editingArticle, ai_category: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Deep Dive Content (Markdown)</label>
                <textarea
                  value={editingArticle.deep_dive_content || ''}
                  onChange={(e) => setEditingArticle({...editingArticle, deep_dive_content: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" onClick={() => setEditingArticle(null)} className={styles.actionBtn}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.actionBtn} ${styles.completed}`} style={{ background: '#10b981', color: 'white', border: 'none' }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Source Drill Down Modal */}
      {selectedSource && (
        <div className={styles.modalOverlay} onClick={() => setSelectedSource(null)}>
          <div className={styles.modalContent} style={{ maxWidth: '900px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: selectedSource.color }}></div>
                {selectedSource.name} Articles
              </h2>
              <button onClick={() => setSelectedSource(null)} className={styles.actionBtn}>Close</button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
              {loadingArticles ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.5)' }}>Loading articles...</div>
              ) : sourceArticles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.5)' }}>No articles found for this source.</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Original Title</th>
                      <th>AI Rewritten Title</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceArticles.map(article => (
                      <tr key={article.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          {new Date(article.rewritten_at || article.fetched_at).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                          })}
                        </td>
                        <td>
                          {article.is_scraped ? (
                            <span className={styles.sourceBadge} style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.3)' }}>Scraped</span>
                          ) : (
                            <span className={styles.sourceBadge} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)' }}>RSS XML</span>
                          )}
                        </td>
                        <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', maxWidth: '250px' }}>
                          {article.title}
                        </td>
                        <td style={{ color: 'white', fontWeight: 500, maxWidth: '250px' }}>
                          {article.title_hook || <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.3)' }}>Pending...</span>}
                        </td>
                        <td>
                          <span className={`${styles.badge} ${styles[article.rewrite_status]}`}>{article.rewrite_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
