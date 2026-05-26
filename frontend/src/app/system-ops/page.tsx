'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

// Using a simple hardcoded password as requested by the user
const SECRET_PASSWORD = 'admin';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'ai' | 'duplicates'>('ai');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [apiBase, setApiBase] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SECRET_PASSWORD) {
      setIsAuthenticated(true);
      fetchData(1);
    } else {
      setError('Incorrect password');
    }
  };

  const fetchData = async (pageNum: number | any = currentPage) => {
    const targetPage = typeof pageNum === 'number' ? pageNum : currentPage;
    setLoading(true);
    try {
      let API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('127.')) {
          API_BASE = `http://${hostname}:3001`;
        }
      }
      setApiBase(API_BASE);

      const response = await fetch(`${API_BASE}/api/admin/dashboard?page=${targetPage}&limit=${limit}`, {
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

  if (!isAuthenticated) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <h2>System Operations</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.button}>Access</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>System Operations</h1>
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Recent AI Articles</span>
            <span className={styles.statValue}>{data?.stats?.total_recent_rewrites || 0}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Recent Duplicates Ignored</span>
            <span className={styles.statValue}>{data?.stats?.total_recent_duplicates || 0}</span>
          </div>
          <button onClick={fetchData} className={styles.refreshBtn}>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'ai' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          AI Written Articles
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'duplicates' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('duplicates')}
        >
          Ignored Duplicates
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'ai' && (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Original Title</th>
                  <th>AI Title Hook</th>
                  <th>Category</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentArticles?.map((art: any) => (
                  <tr key={art.id}>
                    <td className={styles.timeCell}>{new Date(art.published_at).toLocaleString()}</td>
                    <td>{art.source?.name}</td>
                    <td className={styles.textMuted}>{art.title}</td>
                    <td className={styles.textStrong}>{art.title_hook}</td>
                    <td><span className={styles.badge}>{art.ai_category}</span></td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button onClick={() => setEditingArticle(art)} className={styles.actionBtn}>Edit</button>
                        <button onClick={() => handleDelete(art.id)} className={`${styles.actionBtn} ${styles.dangerBtn}`}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data?.recentArticles?.length && (
                  <tr><td colSpan={6} className={styles.empty}>No articles found</td></tr>
                )}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {data?.stats?.total_articles > limit && (
              <div className={styles.pagination}>
                <button 
                  onClick={() => fetchData(currentPage - 1)} 
                  disabled={currentPage === 1 || loading}
                  className={styles.pageBtn}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {currentPage} of {Math.ceil(data.stats.total_articles / limit)}
                </span>
                <button 
                  onClick={() => fetchData(currentPage + 1)} 
                  disabled={currentPage >= Math.ceil(data.stats.total_articles / limit) || loading}
                  className={styles.pageBtn}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'duplicates' && (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time Ignored</th>
                  <th>Method</th>
                  <th>Score</th>
                  <th>Ignored Article (Dropped)</th>
                  <th>Matched Against (Kept)</th>
                </tr>
              </thead>
              <tbody>
                {data?.duplicateLogs?.map((log: any) => (
                  <tr key={log.id}>
                    <td className={styles.timeCell}>{new Date(log.created_at).toLocaleString()}</td>
                    <td>
                      <span className={`${styles.badge} ${log.method === 'ai' ? styles.badgeAi : styles.badgeToken}`}>
                        {log.method.toUpperCase()}
                      </span>
                    </td>
                    <td className={styles.scoreCell}>{log.score.toFixed(2)}</td>
                    <td className={styles.textStrong}>{log.dropped_title}</td>
                    <td className={styles.textMuted}>{log.matched_title}</td>
                  </tr>
                ))}
                {!data?.duplicateLogs?.length && (
                  <tr><td colSpan={5} className={styles.empty}>No duplicates logged recently</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingArticle && (
        <div className={styles.modalOverlay} onClick={() => setEditingArticle(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2>Edit Article</h2>
            <form onSubmit={handleSaveEdit}>
              <div className={styles.formGroup}>
                <label>Title Hook</label>
                <input 
                  type="text" 
                  value={editingArticle.title_hook} 
                  onChange={e => setEditingArticle({...editingArticle, title_hook: e.target.value})}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Category</label>
                <input 
                  type="text" 
                  value={editingArticle.ai_category} 
                  onChange={e => setEditingArticle({...editingArticle, ai_category: e.target.value})}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Deep Dive Content (Markdown)</label>
                <textarea 
                  value={editingArticle.deep_dive_content || ''} 
                  onChange={e => setEditingArticle({...editingArticle, deep_dive_content: e.target.value})}
                  className={`${styles.input} ${styles.textarea}`}
                  rows={8}
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setEditingArticle(null)} className={styles.cancelBtn}>Cancel</button>
                <button type="submit" className={styles.button}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
