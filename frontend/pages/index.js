import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function Dashboard() {
  const [metrics, setMetrics] = useState({});
  const [circuit, setCircuit] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentResponses, setRecentResponses] = useState([]);
  const [cooldownCountdown, setCooldownCountdown] = useState(0);

  const fetchData = async () => {
    try {
      const [mRes, cRes, iRes] = await Promise.all([
        fetch(`${API_BASE}/metrics`),
        fetch(`${API_BASE}/circuit-breaker`),
        fetch(`${API_BASE}/incidents`)
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (cRes.ok) {
        const cData = await cRes.json();
        setCircuit(cData);
        if (cData.state === 'OPEN' && cData.opened_at) {
          const remaining = (cData.cooldown_seconds || 3.0) - ((Date.now() / 1000) - cData.opened_at);
          setCooldownCountdown(Math.max(0, remaining));
        } else {
          setCooldownCountdown(0);
        }
      }
      if (iRes.ok) setIncidents(await iRes.json());
    } catch (e) {
      console.error("Backend offline:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1500);
    return () => clearInterval(interval);
  }, []);

  // Cooldown local tick
  useEffect(() => {
    if (cooldownCountdown <= 0) return;
    const timer = setInterval(() => {
      setCooldownCountdown((prev) => Math.max(0, prev - 0.1));
    }, 100);
    return () => clearInterval(timer);
  }, [cooldownCountdown]);

  const triggerSim = async (mode) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/simulate?mode=${mode}`, { method: 'POST' });
      const data = await res.json();
      setRecentResponses((prev) => [
        {
          id: Date.now(),
          mode,
          status_code: data.status_code,
          duration_ms: data.duration_ms,
          fallback: data.data?.circuit_open || false
        },
        ...prev.slice(0, 7)
      ]);
      await fetchData();
    } catch (err) {
      console.error("Sim error:", err);
    } finally {
      setLoading(false);
    }
  };

  const inspectIncident = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/diagnostics/${id}`, { method: 'POST' });
      if (res.ok) setDiagnostics(await res.json());
    } catch (err) {
      console.error("Diagnostic error:", err);
    }
  };

  const stateColors = {
    CLOSED: { bg: '#10b981', border: '#059669', label: 'CLOSED (Passing Traffic)' },
    HALF_OPEN: { bg: '#f59e0b', border: '#d97706', label: 'HALF-OPEN (Canary Probe Mode)' },
    OPEN: { bg: '#ef4444', border: '#dc2626', label: 'OPEN (Fast Failing / Fallback Active)' }
  };

  const currentState = circuit.state || 'CLOSED';
  const theme = stateColors[currentState] || stateColors.CLOSED;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1000, margin: '40px auto', padding: '0 20px', color: '#0f172a' }}>
      <header style={{ marginBottom: 24, borderBottom: '1px solid #e2e8f0', paddingBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Timeout Cascade & Circuit Breaker Console</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Real-time telemetry, failure shedding, and AI-assisted diagnostics.</p>
      </header>

      {/* Circuit State Banner */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 10,
        backgroundColor: theme.bg,
        color: '#ffffff',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }}>
        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>Breaker Status</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{theme.label}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>Failure Count: <strong>{circuit.failure_count || 0} / {circuit.threshold || 3}</strong></div>
          {currentState === 'OPEN' && (
            <div style={{ fontSize: 13, marginTop: 4 }}>Cooldown: <strong>{cooldownCountdown.toFixed(1)}s remaining</strong></div>
          )}
        </div>
      </div>

      {/* Traffic Generator Controls */}
      <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Traffic Simulation Controls</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button disabled={loading} onClick={() => triggerSim('healthy')} style={btnStyle('#0284c7')}>Send Normal Traffic (20ms)</button>
          <button disabled={loading} onClick={() => triggerSim('slow')} style={btnStyle('#d97706')}>Inject Slow Request (450ms)</button>
          <button disabled={loading} onClick={() => triggerSim('timeout')} style={btnStyle('#dc2626')}>Trigger Timeout (600ms)</button>
          <button disabled={loading} onClick={() => triggerSim('error')} style={btnStyle('#7c3aed')}>Inject 503 HTTP Failure</button>
        </div>
      </div>

      {/* Live Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <MetricCard label="Total Requests" value={metrics.total_requests || 0} />
        <MetricCard label="Average Latency" value={`${metrics.avg_latency_ms || 0} ms`} warn={metrics.avg_latency_ms > 300} />
        <MetricCard label="Failed Responses" value={metrics.error_count || 0} />
        <MetricCard label="Error Rate" value={`${metrics.error_rate || 0}%`} warn={metrics.error_rate > 20} />
      </div>

      {/* Real-Time Live Feed */}
      {recentResponses.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Recent Request Dispatch Log</h3>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {recentResponses.map((r) => (
              <div key={r.id} style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: r.status_code >= 500 ? '#fee2e2' : '#f0fdf4',
                border: `1px solid ${r.status_code >= 500 ? '#fca5a5' : '#bbf7d0'}`,
                fontSize: 12,
                minWidth: 120
              }}>
                <div><strong>{r.mode.toUpperCase()}</strong></div>
                <div>Status: {r.status_code}</div>
                <div>Latency: {Math.round(r.duration_ms)}ms</div>
                {r.fallback && <div style={{ color: '#b91c1c', fontWeight: 600 }}>Fallback Used</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incidents Table */}
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>Incident Ledger</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: 24, fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
            <th style={{ padding: 10 }}>Incident ID</th>
            <th style={{ padding: 10 }}>Service</th>
            <th style={{ padding: 10 }}>Reason</th>
            <th style={{ padding: 10 }}>Observed Value</th>
            <th style={{ padding: 10 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc) => (
            <tr key={inc.incident_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: 10, fontFamily: 'monospace' }}>{inc.incident_id}</td>
              <td style={{ padding: 10 }}>{inc.service_name}</td>
              <td style={{ padding: 10 }}>{inc.reason}</td>
              <td style={{ padding: 10 }}>{inc.metric_value}</td>
              <td style={{ padding: 10 }}>
                <button onClick={() => inspectIncident(inc.incident_id)} style={actionBtnStyle}>Diagnose</button>
              </td>
            </tr>
          ))}
          {incidents.length === 0 && (
            <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>No incidents detected. System healthy.</td></tr>
          )}
        </tbody>
      </table>

      {/* Diagnostic Card */}
      {diagnostics && (
        <div style={{ padding: 20, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 10px', color: '#1e40af' }}>Diagnostic Report: {diagnostics.incident_id}</h4>
          <p style={{ margin: '0 0 8px' }}><strong>Hypothesis:</strong> {diagnostics.root_cause_hypothesis}</p>
          <p style={{ margin: 0 }}><strong>Mitigation:</strong> {diagnostics.suggested_mitigation}</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, warn }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', padding: 14, borderRadius: 8, background: warn ? '#fef2f2' : '#ffffff' }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: warn ? '#dc2626' : '#0f172a' }}>{value}</div>
    </div>
  );
}

const btnStyle = (bg) => ({
  backgroundColor: bg,
  color: '#fff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500
});

const actionBtnStyle = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  border: 'none',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12
};
