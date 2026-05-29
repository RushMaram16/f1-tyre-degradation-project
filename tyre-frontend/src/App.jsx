import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const TRACKS = ["Monaco", "Silverstone", "Monza"];
const COMPOUNDS = ["Soft", "Medium", "Hard", "Inter", "Wet"];

function safeNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
const formatLapTime = (seconds) => {
  if (!seconds && seconds !== 0) return "--:--.---";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds - Math.floor(seconds)) * 1000);

  const paddedSecs = secs.toString().padStart(2, "0");
  const paddedMillis = millis.toString().padStart(3, "0");

  return `${mins}:${paddedSecs}.${paddedMillis}`;
};
function formatPitWindow(res) {
  if (!res) return "-";
  if (typeof res.pit_window === "string" && res.pit_window.trim()) return res.pit_window;
  if (Array.isArray(res.pit_window) && res.pit_window.length >= 2) return `${res.pit_window[0]} - ${res.pit_window[1]}`;
  if (Number.isFinite(res.pit_start) && Number.isFinite(res.pit_end)) return `${res.pit_start} - ${res.pit_end}`;
  return "-";
}

export default function App() {
  // Inputs
  const [track, setTrack] = useState("Monaco");
  const [compound, setCompound] = useState("Soft");
  const [lapTime, setLapTime] = useState("78.4");
  const [fuelLevel, setFuelLevel] = useState("50");

  const [trackTemp, setTrackTemp] = useState("42");
  const [airTemp, setAirTemp] = useState("28");
  const [humidity, setHumidity] = useState("55");
  const [lapNumber, setLapNumber] = useState("10");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);
  const formatLapTime = (seconds) => {
  if (!seconds && seconds !== 0) return "00:00:000";

  const totalMs = Math.round(Number(seconds) * 1000);
  const minutes = Math.floor(totalMs / 60000);
  const remainingMs = totalMs % 60000;
  const secs = Math.floor(remainingMs / 1000);
  const ms = remainingMs % 1000;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  const mmm = String(ms).padStart(3, "0");

  return `${mm}:${ss}:${mmm}`;
};

  const healthData = useMemo(() => {
    const curve = res?.health_curve;
    if (!Array.isArray(curve)) return [];
    return curve
      .map((p) => ({
        lap: safeNum(p?.lap, NaN),
        health: safeNum(p?.health, NaN),
      }))
      .filter((d) => Number.isFinite(d.lap) && Number.isFinite(d.health));
  }, [res]);

  const lapTimeData = useMemo(() => {
    const curve = res?.lap_time_curve;
    if (!Array.isArray(curve)) return [];
    return curve
      .map((p) => ({
        lap: safeNum(p?.lap, NaN),
        lap_time: safeNum(p?.lap_time, NaN),
      }))
      .filter((d) => Number.isFinite(d.lap) && Number.isFinite(d.lap_time));
  }, [res]);

  const lifeLaps = Number.isFinite(res?.life_laps) ? Number(res.life_laps) : null;
  const currentLap = Math.max(1, Math.floor(safeNum(lapNumber, 1)));
  const remainingLaps =
    lifeLaps == null ? null : Math.max(0, Math.round(lifeLaps - currentLap));
  const usedPct =
    lifeLaps == null ? 0 : Math.min(100, Math.max(0, (currentLap / lifeLaps) * 100));

  const pitWindowText = useMemo(() => formatPitWindow(res), [res]);

  async function onPredict() {
    setLoading(true);
    setErr("");

    try {
      const payload = {
        track,
        compound,
        lap_time: safeNum(lapTime, 78.4),
        fuel_level: safeNum(fuelLevel, 50),

        track_temp: safeNum(trackTemp, 35),
        air_temp: safeNum(airTemp, 25),
        humidity: safeNum(humidity, 50),
        lap_number: Math.max(1, Math.floor(safeNum(lapNumber, 1))),
      };

      const r = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(`API error ${r.status}: ${t}`);
      }

      const data = await r.json();
      setRes(data);
    } catch (e) {
      setRes(null);
      setErr(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* embedded CSS so you don't rely on Tailwind */}
      <style>{css}</style>

      <div style={styles.wrap}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.h1}>Tyre Life Predictor</div>
            {/* removed "React → FastAPI → Tyre model" */}
          </div>

          <div style={styles.apiPill}>
            API: <span style={{ opacity: 0.9 }}>{API_BASE}</span>
          </div>
        </div>

        <div style={styles.grid}>
          {/* LEFT: Inputs */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Inputs</div>

            <div style={styles.formGrid}>
              <Field label="Track">
                <select
                  className="ctl"
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                >
                  {TRACKS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>

              <Field label="Compound">
                <select
                  className="ctl"
                  value={compound}
                  onChange={(e) => setCompound(e.target.value)}
                >
                  {COMPOUNDS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Lap Time (sec)">
                <input
                  className="ctl"
                  type="number"
                  step="0.1"
                  value={lapTime}
                  onChange={(e) => setLapTime(e.target.value)}
                />
              </Field>

              <Field label="Fuel Level (0–100)">
                <input
                  className="ctl"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={fuelLevel}
                  onChange={(e) => setFuelLevel(e.target.value)}
                />
              </Field>

              <Field label="Track Temp (°C)">
                <input
                  className="ctl"
                  type="number"
                  step="1"
                  value={trackTemp}
                  onChange={(e) => setTrackTemp(e.target.value)}
                />
              </Field>

              <Field label="Air Temp (°C)">
                <input
                  className="ctl"
                  type="number"
                  step="1"
                  value={airTemp}
                  onChange={(e) => setAirTemp(e.target.value)}
                />
              </Field>

              <Field label="Humidity (%)">
                <input
                  className="ctl"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                />
              </Field>

              <Field label="Lap Number">
                <input
                  className="ctl"
                  type="number"
                  step="1"
                  min="1"
                  value={lapNumber}
                  onChange={(e) => setLapNumber(e.target.value)}
                />
              </Field>
            </div>

            <button
              className="btn"
              onClick={onPredict}
              disabled={loading}
            >
              {loading ? "Predicting..." : "Predict"}
            </button>

            {err ? (
              <div style={styles.errBox}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
                <div style={{ opacity: 0.9, lineHeight: 1.35 }}>{err}</div>
              </div>
            ) : null}

            {/* removed "Next step..." sentence */}
          </div>

          {/* RIGHT: Results + Graph */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Results</div>

            <div style={styles.statsRow}>
              <StatBox
                label="Estimated Life"
                value={res?.life_laps ? `${res.life_laps} laps` : "-"}
              />
              <StatBox label="Pit Window" value={pitWindowText} />
              <StatBox
                label="Wear Multiplier"
                value={Number.isFinite(res?.wear_multiplier) ? String(res.wear_multiplier) : "-"}
              />
            </div>
            {/* Stint Progress */}
<div style={styles.barCard}>
  <div style={styles.barRow}>
    <div style={{ fontWeight: 750 }}>Stint Progress</div>
    <div style={{ opacity: 0.7, fontSize: 12 }}>
      Lap {currentLap}{lifeLaps ? ` / ${lifeLaps}` : ""}
    </div>
  </div>

  <div style={styles.progressOuter}>
    <div
      style={{
        ...styles.progressInner,
        width: `${Math.round(usedPct)}%`,
      }}
    />
  </div>

  <div style={styles.barRow}>
    <div style={{ opacity: 0.75, fontSize: 12 }}>
      Used: <b>{lifeLaps ? `${Math.round(usedPct)}%` : "-"}</b>
    </div>
    <div style={{ opacity: 0.75, fontSize: 12 }}>
      Remaining: <b>{remainingLaps == null ? "-" : `${remainingLaps} laps`}</b>
    </div>
  </div>
</div>
<div style={styles.chartCard}>
  <div style={styles.chartHeader}>
    <div style={styles.chartTitle}>Health Curve</div>
    <div style={styles.chartHint}>Higher is better</div>
  </div>

  {healthData.length === 0 ? (
    <div style={styles.emptyChart}>No chart data yet. Click <b>Predict</b>.</div>
  ) : (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={healthData} margin={{ top: 12, right: 18, left: 0, bottom: 12 }}>
          <defs>
            <linearGradient id="healthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgba(96,165,250,0.55)" />
              <stop offset="95%" stopColor="rgba(96,165,250,0.05)" />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 4" opacity={0.22} />
          <XAxis
            dataKey="lap"
            tickLine={false}
            axisLine={{ opacity: 0.25 }}
            tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
          />
          <YAxis
            domain={[0, 1]}
            tickLine={false}
            axisLine={{ opacity: 0.25 }}
            tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
            tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15,23,42,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "white",
            }}
            formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Health"]}
            labelFormatter={(label) => `Lap ${label}`}
          />

          <Area
            type="monotone"
            dataKey="health"
            stroke="rgba(96,165,250,0.95)"
            strokeWidth={3}
            fill="url(#healthFill)"
            fillOpacity={1}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )}
</div>


            {/* Lap Time Degradation */}
<div style={styles.chartCard}>
  <div style={styles.chartHeader}>
    <div style={styles.chartTitle}>Lap Time Degradation</div>
    <div style={styles.chartHint}>Lower is faster</div>
  </div>

  {lapTimeData.length === 0 ? (
    <div style={styles.emptyChart}>
      No lap time data yet. Click <b>Predict</b>.
    </div>
  ) : (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={lapTimeData}
          margin={{ top: 12, right: 18, left: 0, bottom: 12 }}
        >
          <defs>
            <linearGradient id="lapFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgba(167,139,250,0.45)" />
              <stop offset="95%" stopColor="rgba(167,139,250,0.05)" />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 4" opacity={0.2} />
          <XAxis
            dataKey="lap"
            tickLine={false}
            axisLine={{ opacity: 0.25 }}
            tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={{ opacity: 0.25 }}
            tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
            tickFormatter={(v) => formatLapTime(v)}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(6,10,18,0.92)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 12,
              color: "white",
              boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.85)" }}
            formatter={(value) => [formatLapTime(value), "Lap Time"]}
            labelFormatter={(lap) => `Lap ${lap}`}
          />
          <Area
            type="monotone"
            dataKey="lap_time"
            stroke="rgba(167,139,250,0.95)"
            strokeWidth={3}
            fill="url(#lapFill)"
            dot={false}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )}
</div>

              {healthData.length === 0 ? (
                <div style={styles.emptyChart}>
                  No chart data yet. Click <b>Predict</b>.
                </div>
              ) : (
                <div style={{ width: "100%", height: 360 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={healthData}
                      margin={{ top: 12, right: 18, left: 0, bottom: 12 }}
                    >
                      <defs>
                        <linearGradient id="healthFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="rgba(96,165,250,0.55)" />
                          <stop offset="95%" stopColor="rgba(96,165,250,0.05)" />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="4 4" opacity={0.2} />
                      <XAxis
                        dataKey="lap"
                        tickLine={false}
                        axisLine={{ opacity: 0.25 }}
                        tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                      />
                      <YAxis
                        domain={[0, 1]}
                        tickLine={false}
                        axisLine={{ opacity: 0.25 }}
                        tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
                        tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(6,10,18,0.92)",
                          border: "1px solid rgba(255,255,255,0.14)",
                          borderRadius: 12,
                          color: "white",
                          boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                        }}
                        labelStyle={{ color: "rgba(255,255,255,0.85)" }}
                        formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Health"]}
                        labelFormatter={(lap) => `Lap ${lap}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="health"
                        stroke="rgba(96,165,250,0.95)"
                        strokeWidth={3}
                        fill="url(#healthFill)"
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div style={styles.tip}>
            </div>
          </div>
        </div>
      </div>
  );
}

/* ---------- Small components ---------- */

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <div style={styles.label}>{label}</div>
      {children}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={styles.statBox}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

/* ---------- Styles ---------- */

const styles = {
 barCard: {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  borderRadius: 18,
  padding: 14,
  marginBottom: 14,
},
barRow: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
},
progressOuter: {
  width: "100%",
  height: 12,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
  overflow: "hidden",
  marginBottom: 10,
},
progressInner: {
  height: "100%",
  borderRadius: 999,
  background:
    "linear-gradient(90deg, rgba(96,165,250,0.9), rgba(167,139,250,0.85))",
  boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
  transition: "width 0.6s ease",
},

  page: {
    minHeight: "100vh",
    width: "100%",
    color: "white",
    background:
      "radial-gradient(1200px 600px at 20% 10%, rgba(30,64,175,0.25), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(56,189,248,0.18), transparent 55%), linear-gradient(180deg, #050b18 0%, #040814 60%, #030611 100%)",
  },
  wrap: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "42px 22px 60px",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 22,
  },
  h1: {
    fontSize: 56,
    lineHeight: 1.05,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  apiPill: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    whiteSpace: "nowrap",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },
  card: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 750,
    marginBottom: 12,
    opacity: 0.95,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "rgba(255,255,255,0.70)" },

  statsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    marginBottom: 14,
  },
  statBox: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 18,
    padding: 14,
  },
  statLabel: { fontSize: 12, color: "rgba(255,255,255,0.60)" },
  statValue: { marginTop: 6, fontSize: 24, fontWeight: 800,  textShadow: "0 0 14px rgba(96,165,250,0.6)" },

  chartCard: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 18,
    padding: 14,
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  chartTitle: { fontSize: 18, fontWeight: 750 },
  chartHint: { fontSize: 12, color: "rgba(255,255,255,0.60)" },
  emptyChart: {
    height: 360,
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.70)",
  },
  errBox: {
    marginTop: 12,
    borderRadius: 16,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.12)",
    padding: 12,
    color: "rgba(254,226,226,0.95)",
  },
  tip: {
    marginTop: 12,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },
};

/* CSS for inputs + button (so they look modern everywhere) */
const css = `
  .ctl {
    width: 100%;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(0,0,0,0.22);
    color: rgba(255,255,255,0.92);
    padding: 10px 12px;
    outline: none;
    transition: border-color 120ms ease, transform 120ms ease;
  }
  .ctl:focus {
    border-color: rgba(96,165,250,0.55);
  }
  .btn {
    margin-top: 14px;
    width: 100%;
    border: none;
    border-radius: 14px;
    padding: 12px 14px;
    font-weight: 800;
    color: white;
    background: linear-gradient(180deg, rgba(37,99,235,1), rgba(29,78,216,1));
    box-shadow: 0 14px 30px rgba(37,99,235,0.18);
    cursor: pointer;
    transition: transform 120ms ease, filter 120ms ease, opacity 120ms ease;
  }
  .btn:hover {
    filter: brightness(1.05);
    transform: translateY(-1px);
  }
  .btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 980px) {
    /* stack columns on smaller screens */
    div[style*="grid-template-columns: 1fr 1fr"] {
      grid-template-columns: 1fr !important;
    }
  }
`;

