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
  const [logs, setLogs] = useState<string[]>([]);
  const limit = 20;
  
  // Reference for auto-scrolling terminal
  const terminalContainerRef = React.useRef<HTMLDivElement>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SECRET_PASSWORD) {
      setIsAuthenticated(true);
      fetchData(1, 'all');
    } else {
      setError('Incorrect password');
    }
  };

  const fetchData = async (pageNum: number | any = currentPage, currentFilter = filter) => {
    const targetPage = typeof pageNum === 'number' ? pageNum : currentPage;
    setLoading(true);
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
    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, apiBase]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [logs]);

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
        <button onClick={() => fetchData()} disabled={loading} className={styles.refreshBtn}>
          {loading ? 'Syncing...' : 'Sync Data'}
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

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
          <div ref={terminalContainerRef} style={{ 
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
                    <td style={{ maxWidth: '300px', color: '#ef4444' }}>{log.dropped_title}</td>
                    <td style={{ maxWidth: '300px', color: '#10b981' }}>{log.matched_title}</td>
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
    </div>
  );
}
