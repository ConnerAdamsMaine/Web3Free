import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useWeb3 } from '../context/Web3Context';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const SearchPage = () => {
  const { isConnected, account } = useWeb3();
  const [domainName, setDomainName] = useState('');
  const [tld, setTld] = useState('web3');
  const [searchResult, setSearchResult] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  const searchDomain = async (e) => {
    e.preventDefault();

    if (!domainName || !tld) {
      toast.error('Please enter domain name and TLD');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.get(`${API_URL}/domains/search`, {
        params: { name: domainName, tld },
      });

      setSearchResult(response.data.data);

      if (isConnected && response.data.data.available) {
        const eligibilityResponse = await axios.get(
          `${API_URL}/domains/eligibility/${account}`
        );
        setEligibility(eligibilityResponse.data.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const registerDomain = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    setRegistering(true);

    try {
      const response = await axios.post(`${API_URL}/domains/register`, {
        domainName,
        tld,
        walletAddress: account,
        contentHash: '',
      });

      const domain = response.data.data;

      if (domain.is_free) {
        toast.success('Free domain registered successfully!');
      } else {
        toast.success('Domain reserved! Redirecting to payment...');
        // Redirect to payment
        setTimeout(() => {
          window.location.href = `/dashboard?payment_required=${domain.id}`;
        }, 2000);
      }

      setSearchResult(null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="container" style={styles.container}>
      <div className="card" style={styles.searchCard}>
        <h1 style={styles.title}>Search Domains</h1>

        <form onSubmit={searchDomain} style={styles.form}>
          <div style={styles.inputGroup}>
            <input
              type="text"
              className="input"
              placeholder="Enter domain name"
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              style={styles.domainInput}
            />
            <span style={styles.dot}>.</span>
            <input
              type="text"
              className="input"
              placeholder="TLD"
              value={tld}
              onChange={(e) => setTld(e.target.value)}
              style={styles.tldInput}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={styles.searchBtn}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResult && (
          <div style={styles.result}>
            <div className="card" style={searchResult.available ? styles.availableCard : styles.unavailableCard}>
              <h2>{searchResult.fullDomain}</h2>

              {searchResult.available ? (
                <>
                  <p style={styles.availableText}>✅ Available!</p>

                  {isConnected && eligibility && (
                    <div style={styles.eligibilityInfo}>
                      {eligibility.eligible ? (
                        <>
                          <p className="badge badge-success">
                            🎉 You're eligible for a FREE domain!
                          </p>
                          <p style={styles.hostingNote}>
                            This will be hosted on our centralized DNS
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="badge badge-warning">
                            Requires Payment & Profit Verification
                          </p>
                          <p style={styles.hostingNote}>
                            Self-hosted domain - you'll need to provide your own DNS
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <button
                    onClick={registerDomain}
                    className="btn btn-primary"
                    disabled={!isConnected || registering}
                    style={styles.registerBtn}
                  >
                    {registering
                      ? 'Registering...'
                      : eligibility?.eligible
                      ? 'Register for FREE'
                      : 'Register (Payment Required)'}
                  </button>

                  {!isConnected && (
                    <p style={styles.connectNote}>Connect your wallet to register</p>
                  )}
                </>
              ) : (
                <>
                  <p style={styles.unavailableText}>❌ Not Available</p>
                  {searchResult.registeredBy && (
                    <p style={styles.ownerText}>
                      Owned by: {searchResult.registeredBy.substring(0, 10)}...
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    paddingTop: '40px',
    maxWidth: '800px',
  },
  searchCard: {
    textAlign: 'center',
  },
  title: {
    marginBottom: '32px',
    color: '#2d3748',
  },
  form: {
    marginBottom: '32px',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  domainInput: {
    flex: 2,
  },
  tldInput: {
    flex: 1,
  },
  dot: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#4a5568',
  },
  searchBtn: {
    width: '100%',
  },
  result: {
    marginTop: '32px',
  },
  availableCard: {
    background: '#f0fdf4',
    border: '2px solid #86efac',
  },
  unavailableCard: {
    background: '#fef2f2',
    border: '2px solid #fca5a5',
  },
  availableText: {
    fontSize: '20px',
    color: '#166534',
    fontWeight: 'bold',
    marginTop: '16px',
  },
  unavailableText: {
    fontSize: '20px',
    color: '#991b1b',
    fontWeight: 'bold',
    marginTop: '16px',
  },
  ownerText: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '8px',
  },
  eligibilityInfo: {
    margin: '24px 0',
  },
  hostingNote: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '8px',
  },
  registerBtn: {
    width: '100%',
    marginTop: '16px',
  },
  connectNote: {
    marginTop: '16px',
    color: '#6b7280',
  },
};

export default SearchPage;
