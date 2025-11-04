import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useWeb3 } from '../context/Web3Context';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const DashboardPage = () => {
  const { isConnected } = useWeb3();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      navigate('/');
      return;
    }

    fetchDashboard();
  }, [isConnected, navigate]);

  const fetchDashboard = async () => {
    try {
      const [dashboardRes, domainsRes] = await Promise.all([
        axios.get(`${API_URL}/users/dashboard`),
        axios.get(`${API_URL}/domains/my-domains`),
      ]);

      setDashboard(dashboardRes.data.data);
      setDomains(domainsRes.data.data.domains || []);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container" style={styles.container}>Loading...</div>;
  }

  return (
    <div className="container" style={styles.container}>
      <h1 style={styles.title}>My Dashboard</h1>

      <div style={styles.stats}>
        <div className="card" style={styles.statCard}>
          <h3>{dashboard?.total_domains || 0}</h3>
          <p>Total Domains</p>
        </div>
        <div className="card" style={styles.statCard}>
          <h3>{dashboard?.free_domains || 0}</h3>
          <p>Free Domains</p>
        </div>
        <div className="card" style={styles.statCard}>
          <h3>{dashboard?.paid_domains || 0}</h3>
          <p>Business Domains</p>
        </div>
        <div className="card" style={styles.statCard}>
          <h3>{dashboard?.verification_requests || 0}</h3>
          <p>Verifications</p>
        </div>
      </div>

      <div className="card">
        <h2>My Domains</h2>

        {domains.length === 0 ? (
          <p style={styles.emptyText}>
            No domains yet. <a href="/search">Register your first domain!</a>
          </p>
        ) : (
          <div style={styles.domainList}>
            {domains.map((domain) => (
              <div key={domain.id} className="card" style={styles.domainCard}>
                <div style={styles.domainHeader}>
                  <h3>{domain.full_domain}</h3>
                  <span
                    className={`badge ${
                      domain.is_active ? 'badge-success' : 'badge-warning'
                    }`}
                  >
                    {domain.is_active ? 'Active' : 'Pending'}
                  </span>
                </div>

                <div style={styles.domainInfo}>
                  <p>
                    <strong>Type:</strong>{' '}
                    {domain.is_paid ? 'Business (Self-hosted)' : 'Free (Centralized DNS)'}
                  </p>
                  <p>
                    <strong>Registered:</strong>{' '}
                    {new Date(domain.registered_at).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Status:</strong> {domain.verification_status}
                  </p>
                </div>

                {!domain.is_active && domain.is_paid && (
                  <button
                    className="btn btn-primary"
                    style={styles.payBtn}
                    onClick={() =>
                      (window.location.href = `/payment/${domain.id}`)
                    }
                  >
                    Complete Payment
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    paddingTop: '40px',
  },
  title: {
    color: 'white',
    marginBottom: '32px',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  },
  statCard: {
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '32px',
  },
  domainList: {
    marginTop: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  domainCard: {
    background: '#f9fafb',
  },
  domainHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  domainInfo: {
    fontSize: '14px',
    color: '#4b5563',
  },
  payBtn: {
    marginTop: '16px',
  },
};

export default DashboardPage;
