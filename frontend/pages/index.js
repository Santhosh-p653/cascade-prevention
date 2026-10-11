import { useState, useEffect } from 'react';

const API_BASE = "http://localhost:8000";

export default function Dashboard() {
  const [metrics, setMetrics] = useState({});
  const [circuit, setCircuit] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [mRes, cRes, iRes] = await Promise.all([
        fetch(`${API_BASE}/metrics`),
        fetch(`${API_BASE}/circuit-breaker`),
        fetch(`${API_BASE}/incidents`)
      ]);
      setMetrics(await mRes.json());
      setCircuit(await cRes.json());
      setIncidents(await iRes.json());
    } catch (e) {
      console.error("Backend offline or unreachable:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const triggerSim = async (mode) => {
    setLoading(true);
    await fetch(`${API_BASE}/simulate?mode=${mode}`, { method: 'POST' });
    await fetchData();
    setLoading(false);
  };

  const inspectIncident = async (id) => {
    const res = await fetch(`${API_BASE}/diagnostics/${id}`, { method: 'POST' });
    setDiagnostics(await res.json());
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 960, margin: '40px auto', padding: '0 20px' }}>
      <h2>DevOps Anomaly & Timeout Cascade Monitor</h2>
      
      {/* Circuit State Header */}
      <div style={{
        padding: 16,
        borderRadius: 8,
        color: '#fff',
        backgroundColor: circuit.state === 'OPEN' ? '#dc2626' : circuit.state === 'HALF_OPEN' ? '#d97706' : '#16a34a',
        marginBottom: 20
      }}>
        <strong>Circuit State: {circuit.state || 'CONNECTING...'}</strong>
        <span style={{ marginLeft: 20 }}>Consecutive Failures: {circuit.failure_count}/{circuit.threshold}</span>
      </div>

      {/* Simulator Controls */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button disabled={loading} onClick={() => triggerSim('healthy')} style={{ padding: '8px 16px', cursor: 'pointer' }}>Send Normal Traffic</button>
        <button disabled={loading} onClick={() => triggerSim('slow')} style={{ padding: '8px 16px', cursor: 'pointer' }}>Inject Latency (450ms)</button>
        <button disabled={loading} onClick={() => triggerSim('timeout')} style={{ padding: '8px 16px', cursor: 'pointer' }}>Trigger Timeout (600ms)</button>
        <button disabled={loading} onClick={() => triggerSim('error')} style={{ padding: '8px 16px', cursor: 'pointer' }}>Inject 503 Error</button>
      </div>

      {/* Live Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ border: '1px solid #e2e8f0', padding: 12, borderRadius: 6 }}>
          <small>Total Requests</small>
          <h3>{metrics.total_requests || 0}</h3>
        </div>
        <div style={{ border: '1px solid #e2e8f0', padding: 12, borderRadius: 6 }}>
          <small>Avg Latency</small>
          <h3>{metrics.avg_latency_ms || 0} ms</h3>
        </div>
        <div style={{ border: '1px solid #e2e8f0', padding: 12, borderRadius: 6 }}>
          <small>Failed Requests</small>
          <h3>{metrics.error_count || 0}</h3>
        </div>
        <div style={{ border: '1px solid #e2e8f0', padding: 12, borderRadius: 6 }}>
          <small>Error Rate</small>
          <h3>{metrics.error_rate || 0}%</h3>
        </div>
      </div>

      {/* Incident List */}
      <h3>Triggered Incidents</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
            <th style={{ padding: 8 }}>ID</th>
            <th style={{ padding: 8 }}>Service</th>
            <th style={{ padding: 8 }}>Reason</th>
            <th style={{ padding: 8 }}>Value</th>
            <th style={{ padding: 8 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc) => (
            <tr key={inc.incident_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: 8 }}>{inc.incident_id}</td>
              <td style={{ padding: 8 }}>{inc.service_name}</td>
              <td style={{ padding: 8 }}>{inc.reason}</td>
              <td style={{ padding: 8 }}>{inc.metric_value}</td>
              <td style={{ padding: 8 }}>
                <button onClick={() => inspectIncident(inc.incident_id)} style={{ cursor: 'pointer' }}>Diagnose</button>
              </td>
            </tr>
          ))}
          {incidents.length === 0 && (
            <tr><td colSpan="5" style={{ padding: 12, color: '#64748b' }}>No incidents detected. System is running nominal.</td></tr>
          )}
        </tbody>
      </table>

      {/* Diagnostic Card */}
      {diagnostics && (
        <div style={{ padding: 16, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8 }}>
          <h4>AI Root-Cause Diagnosis ({diagnostics.incident_id})</h4>
          <p><strong>Hypothesis:</strong> {diagnostics.root_cause_hypothesis}</p>
          <p><strong>Suggested Mitigation:</strong> {diagnostics.suggested_mitigation}</p>
        </div>
      )}
    </div>
  );
}
