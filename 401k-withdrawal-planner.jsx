import { useState, useMemo } from "react";

const GROWTH_MODES = {
  low:    { rate: 0.035, label: "Low",    desc: "3.5% / yr", color: "#e87070" },
  normal: { rate: 0.07,  label: "Normal", desc: "7.0% / yr", color: "#8fcf6a" },
};
const RMD_AGE = 73;

// IRS Uniform Lifetime Table (age → distribution period)
const RMD_TABLE = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
  78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
  84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
  90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5,  95: 8.9,
  96: 8.4,  97: 7.8,  98: 7.3,  99: 6.8,  100: 6.4,
};

function getRMDFactor(age) {
  if (age < RMD_AGE) return null;
  const clampedAge = Math.min(age, 100);
  return RMD_TABLE[clampedAge] ?? 6.4;
}

function formatCurrency(val) {
  if (val < 0) return "-$" + Math.abs(Math.round(val)).toLocaleString();
  return "$" + Math.round(val).toLocaleString();
}

function formatK(val) {
  if (val >= 1_000_000) return "$" + (val / 1_000_000).toFixed(2) + "M";
  if (val >= 1_000) return "$" + (val / 1_000).toFixed(1) + "K";
  return formatCurrency(val);
}

export default function RetirementCalculator() {
  const [inputs, setInputs] = useState({
    retirementAge: 59,
    balance401k: 800000,
    ssMonthly: 4500,
    ssStartAge: 65,
    withdraw1: 6000,
    withdraw2: 5500,
    withdraw3: 5000,
    withdraw4: 4500,
    ssColaRate: 2.6,
    pretaxPct: 100,
  });

  const [growthMode, setGrowthMode] = useState("normal");
  const marketGrowthRate = GROWTH_MODES[growthMode].rate;

  const [showReport, setShowReport] = useState(false);
  const buildReportHTML = () => {
    const gm = GROWTH_MODES[growthMode];
    const inp = inputs;
    const rows = projection;
    const depAt = rows.find(r => r.depleted);
    const last = rows[rows.length - 1];

    const rowsHTML = rows.map((row, i) => {
      const prev = rows[i - 1];
      const isSSStart = row.ssAnnual > 0 && (!prev || prev.ssAnnual === 0);
      const isRMDStart = row.age === RMD_AGE && row.startBalance > 0;
      const isPhase = [1,11,21,31].includes(row.year);
      const phase = Math.floor((row.year-1)/10);
      const phaseW = [inp.withdraw1, inp.withdraw2, inp.withdraw3, inp.withdraw4][phase];
      let banners = '';
      if (isRMDStart) banners += `<tr class="banner rmd"><td colspan="12">⚠ IRS Required Minimum Distribution begins — Age ${RMD_AGE}</td></tr>`;
      if (isSSStart)  banners += `<tr class="banner ss"><td colspan="12">▶ Social Security begins — Age ${row.age}, Year ${row.year} · Starts $${inp.ssMonthly.toLocaleString()}/mo, grows ${inp.ssColaRate}% annually (COLA)</td></tr>`;
      if (isPhase)    banners += `<tr class="banner phase"><td colspan="12">Phase ${phase+1} — Planned Withdrawal: $${phaseW.toLocaleString()}/mo</td></tr>`;

      const cls = row.depleted ? 'depleted' : row.rmdApplied ? 'rmd-row' : i%2===0 ? 'even' : 'odd';
      const endCell = row.depleted && row.endBalance <= 0 ? '<span class="depleted-txt">DEPLETED</span>'
        : `<span class="${row.endBalance < 100000 ? 'warn' : 'good'}">${formatK(row.endBalance)}</span>`;
      const rmdCell = row.rmdRequired > 0
        ? `<span class="${row.rmdApplied ? 'rmd-hi' : ''}">${formatK(row.rmdRequired)}${row.rmdApplied?' ▲':''}</span>`
        : '—';

      return banners + `<tr class="${cls}">
        <td>${row.year}</td><td><b>${row.age}${row.age>=RMD_AGE&&row.startBalance>0?'<sup class="rmd-sup">R</sup>':''}</b></td>
        <td class="gold">${formatK(row.startBalance)}</td>
        <td class="green">${formatK(row.growth)}</td>
        <td>${row.depleted?'—':formatK(row.desiredAnnual401k)}</td>
        <td>${rmdCell}</td>
        <td class="${row.rmdApplied?'rmd-hi':''}">${row.annual401k===0?'—':formatK(row.annual401k)}</td>
        <td class="blue">${row.ssAnnual===0?'—':formatK(row.ssAnnual)}</td>
        <td><b>${formatK(row.totalIncome)}</b></td>
        <td class="tax">${row.fedTax > 0 ? formatK(row.fedTax) : '—'}</td>
        <td class="good">${formatK(row.netIncome)}</td>
        <td>${endCell}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Retirement Projection</title>
<style>
  body{margin:0;font-family:Georgia,serif;background:#fff;color:#111;font-size:11px;}
  .header{background:#1a1f2e;color:#f0e6d0;padding:18px 24px;}
  .header h1{margin:0;font-size:20px;color:#c9a96e;}
  .header p{margin:4px 0 0;color:#9a9fa8;font-family:sans-serif;font-size:12px;}
  .summary{background:#f7f3ec;border-bottom:2px solid #c9a96e;padding:10px 24px;display:flex;flex-wrap:wrap;gap:14px;font-family:sans-serif;font-size:11px;}
  .summary span{color:#555;}
  .summary b{color:#222;}
  table{width:100%;border-collapse:collapse;margin-top:0;}
  th{background:#1a1f2e;color:#c9a96e;padding:7px 6px;font-family:sans-serif;font-size:9px;text-transform:uppercase;letter-spacing:.04em;text-align:right;white-space:nowrap;}
  th:first-child,th:nth-child(2){text-align:center;}
  td{padding:5px 6px;text-align:right;border-bottom:1px solid #e8e4dc;}
  td:first-child,td:nth-child(2){text-align:center;}
  .even{background:#fff;} .odd{background:#faf9f6;}
  .depleted{background:#fff0f0;}
  .rmd-row{background:#fff8ee;}
  .gold{color:#a07030;font-weight:600;}
  .green{color:#2a7a2a;}
  .blue{color:#2255aa;}
  .good{color:#2a7a2a;font-weight:700;}
  .warn{color:#c07000;font-weight:700;}
  .depleted-txt{color:#cc2200;font-weight:700;}
  .rmd-hi{color:#c06000;font-weight:700;}
  .tax{color:#cc2200;font-weight:600;}
  .rmd-sup{color:#c06000;font-size:8px;}
  .banner td{text-align:center!important;font-family:sans-serif;font-size:9px;padding:4px;letter-spacing:.06em;text-transform:uppercase;}
  .banner.rmd td{background:#fff3dc;color:#c06000;}
  .banner.ss  td{background:#e8eeff;color:#2255aa;}
  .banner.phase td{background:#f7f3ec;color:#a07030;}
  .footer{margin-top:12px;padding:10px 24px;font-family:sans-serif;font-size:10px;color:#888;text-align:center;border-top:1px solid #ddd;}
  @media print{body{font-size:9px;} .header{padding:10px 16px;} th{font-size:8px;} td{padding:3px 5px;}}
</style></head><body>
<div class="header">
  <h1>401(k) Pre-Retirement Withdrawal Projection</h1>
  <p>Generated ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})} &nbsp;·&nbsp; ${gm.label} growth scenario (${gm.desc})</p>
</div>
<div class="summary">
  <span>Retirement Age: <b>${inp.retirementAge}</b></span>
  <span>401(k) Balance: <b>$${inp.balance401k.toLocaleString()}</b></span>
  <span>SS Benefit: <b>$${inp.ssMonthly.toLocaleString()}/mo</b></span>
  <span>SS Start Age: <b>${inp.ssStartAge}</b></span>
  <span>SS COLA: <b>${inp.ssColaRate}%/yr</b></span>
  <span>Market Growth: <b>${gm.label} — ${gm.desc}</b></span>
  <span>Yr 1–10: <b>$${inp.withdraw1.toLocaleString()}/mo</b></span>
  <span>Yr 11–20: <b>$${inp.withdraw2.toLocaleString()}/mo</b></span>
  <span>Yr 21–30: <b>$${inp.withdraw3.toLocaleString()}/mo</b></span>
  <span>Yr 31–40: <b>$${inp.withdraw4.toLocaleString()}/mo</b></span>
  <span>Final Balance: <b>${last ? formatK(Math.max(0,last.endBalance)) : '—'}</b></span>
  ${depAt ? `<span style="color:#cc2200">⚠ 401(k) depleted at Year ${depAt.year} (Age ${depAt.age})</span>` : '<span style="color:#2a7a2a">✓ 401(k) sustained full 40 years</span>'}
</div>
<table>
<thead><tr>
  <th>Yr</th><th>Age</th><th>Start Balance</th><th>Growth (${(marketGrowthRate*100).toFixed(1)}%)</th>
  <th>Planned Draw/yr</th><th>RMD Required</th><th>Actual 401k/yr</th>
  <th>SS Income/yr</th><th>Total Income/yr</th><th>Fed Tax/yr</th><th>Net Income/yr</th><th>End Balance</th>
</tr></thead>
<tbody>${rowsHTML}</tbody>
</table>
<div class="footer">For illustrative purposes only · Not financial advice · Consult a qualified financial advisor · R = RMD year · ▲ = RMD exceeded planned withdrawal</div>
</body></html>`;
  };

  const handleShowReport = () => setShowReport(true);

  const set = (k) => (e) =>
    setInputs((prev) => ({ ...prev, [k]: Number(e.target.value) }));

  const projection = useMemo(() => {
    const {
      retirementAge,
      balance401k,
      ssMonthly,
      ssStartAge,
      withdraw1,
      withdraw2,
      withdraw3,
      withdraw4,
      ssColaRate,
      pretaxPct,
    } = inputs;

    const rows = [];
    let balance = balance401k;

    for (let yr = 0; yr < 40; yr++) {
      const age = retirementAge + yr;
      const decade = yr < 10 ? 0 : yr < 20 ? 1 : yr < 30 ? 2 : 3;
      const baseWithdraw = [withdraw1, withdraw2, withdraw3, withdraw4][decade];
      const ssActive = age >= ssStartAge;
      const yearsOfSS = ssActive ? age - ssStartAge : 0;
      const ssAnnual = ssActive ? ssMonthly * 12 * Math.pow(1 + ssColaRate / 100, yearsOfSS) : 0;
      const ssMonthlyAdjusted = ssAnnual / 12;

      // Desired 401k withdrawal (reduced by SS)
      const desiredMonthly401k = Math.max(0, baseWithdraw - (ssActive ? ssMonthlyAdjusted : 0));
      const desiredAnnual401k = desiredMonthly401k * 12;

      const startBalance = balance;
      const growth = startBalance * marketGrowthRate;
      const balanceAfterGrowth = startBalance + growth;

      // RMD calculation — based on start-of-year balance per IRS convention
      const rmdFactor = getRMDFactor(age);
      const rmdRequired = rmdFactor ? startBalance / rmdFactor : 0;

      // Actual 401k withdrawal: max of desired or RMD (can't take less than RMD)
      const annual401k = Math.min(balanceAfterGrowth, Math.max(desiredAnnual401k, rmdRequired));
      const rmdApplied = rmdRequired > desiredAnnual401k; // flag: RMD forced a higher draw
      const rmdExcess = rmdApplied ? Math.max(0, rmdRequired - desiredAnnual401k) : 0;

      // Federal tax on 401k withdrawal (pretax portion only) using 2024 brackets
      const taxable401k = annual401k * (pretaxPct / 100);
      // SS is 85% taxable above certain thresholds — simplified: use 85% of SS as taxable
      const taxableSS = ssAnnual * 0.85;
      const totalTaxableIncome = taxable401k + taxableSS;
      // 2024 MFJ-ish brackets (simplified single/joint blend for retirees)
      let fedTax = 0;
      if (totalTaxableIncome > 0) {
        const brackets = [
          [23200,  0.10],
          [94300,  0.12],
          [201050, 0.22],
          [383900, 0.24],
          [487450, 0.32],
          [731200, 0.35],
          [Infinity, 0.37],
        ];
        let prev = 0;
        for (const [top, rate] of brackets) {
          if (totalTaxableIncome <= prev) break;
          fedTax += (Math.min(totalTaxableIncome, top) - prev) * rate;
          prev = top;
        }
      }
      // Standard deduction 2024: $29,200 MFJ — reduce tax by deduction benefit
      const stdDeductBenefit = Math.min(fedTax, 29200 * 0.12); // rough marginal benefit
      fedTax = Math.max(0, fedTax - stdDeductBenefit);

      balance = balanceAfterGrowth - annual401k;
      if (balance < 0) balance = 0;

      rows.push({
        year: yr + 1,
        age,
        startBalance,
        growth,
        annual401k,
        desiredAnnual401k,
        rmdRequired,
        rmdApplied,
        rmdExcess,
        ssAnnual,
        totalIncome: annual401k + ssAnnual,
        fedTax,
        netIncome: annual401k + ssAnnual - fedTax,
        endBalance: balance,
        depleted: balance <= 0,
      });

      if (balance <= 0) {
        if (yr < 29) {
          for (let rest = yr + 1; rest < 40; rest++) {
            const ra = retirementAge + rest;
            const ssYrs = ra >= ssStartAge ? ra - ssStartAge : 0;
            const ssA = ra >= ssStartAge ? ssMonthly * 12 * Math.pow(1 + ssColaRate / 100, ssYrs) : 0;
            rows.push({
              year: rest + 1,
              age: ra,
              startBalance: 0,
              growth: 0,
              annual401k: 0,
              desiredAnnual401k: 0,
              rmdRequired: 0,
              rmdApplied: false,
              rmdExcess: 0,
              ssAnnual: ssA,
              totalIncome: ssA,
              fedTax: (() => {
                const taxable = ssA * 0.85;
                const brackets = [[23200,0.10],[94300,0.12],[201050,0.22],[383900,0.24],[487450,0.32],[731200,0.35],[Infinity,0.37]];
                let t = 0, prev = 0;
                for (const [top, rate] of brackets) {
                  if (taxable <= prev) break;
                  t += (Math.min(taxable, top) - prev) * rate;
                  prev = top;
                }
                return Math.max(0, t - 29200 * 0.12);
              })(),
              netIncome: ssA - (() => { const taxable = ssA * 0.85; const brackets = [[23200,0.10],[94300,0.12],[201050,0.22],[383900,0.24],[487450,0.32],[731200,0.35],[Infinity,0.37]]; let t=0,prev=0; for(const [top,rate] of brackets){if(taxable<=prev)break;t+=(Math.min(taxable,top)-prev)*rate;prev=top;} return Math.max(0,t-29200*0.12); })(),
              endBalance: 0,
              depleted: true,
            });
          }
        }
        break;
      }
    }

    return rows;
  }, [inputs, marketGrowthRate]);

  const maxBalance = Math.max(...projection.map((r) => r.startBalance));
  const depletedAt = projection.find((r) => r.depleted);

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: "#0f1117", minHeight: "100vh", color: "#e8dcc8", padding: "0 0 60px" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #0f1117 60%)", borderBottom: "1px solid #2a2f3e", padding: "40px 40px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
            <span style={{ fontSize: 11, letterSpacing: "0.3em", color: "#7c6f5a", textTransform: "uppercase" }}>Retirement</span>
            <span style={{ width: 40, height: 1, background: "#7c6f5a", display: "inline-block", verticalAlign: "middle" }} />
            <span style={{ fontSize: 11, letterSpacing: "0.3em", color: "#c9a96e", textTransform: "uppercase" }}>401(k) Planner</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 400, color: "#f0e6d0", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Pre-Retirement<br /><span style={{ color: "#c9a96e" }}>Withdrawal Projector</span>
          </h1>
          <p style={{ marginTop: 12, color: "#7c8a9a", fontSize: 14, fontFamily: "sans-serif", maxWidth: 560 }}>
            Projects your 401(k) balance over 40 years — with market growth, Social Security offsets, and tiered withdrawal phases.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        {/* Inputs */}
        <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { label: "Retirement Age", key: "retirementAge", prefix: "", suffix: " yrs", min: 50, max: 80 },
            { label: "401(k) Balance", key: "balance401k", prefix: "$", suffix: "", min: 0, max: 5000000, step: 1000 },
            { label: "SS Monthly Benefit", key: "ssMonthly", prefix: "$", suffix: "/mo", min: 0, max: 10000, step: 50 },
            { label: "SS Start Age", key: "ssStartAge", prefix: "", suffix: " yrs", min: 62, max: 70 },
            { label: "SS COLA Rate", key: "ssColaRate", prefix: "", suffix: "% / yr", min: 0, max: 6, step: 0.1 },
            { label: "401(k) Pre-Tax %", key: "pretaxPct", prefix: "", suffix: "%", min: 0, max: 100, step: 1 },
            { label: "Withdrawal — Years 1–10", key: "withdraw1", prefix: "$", suffix: "/mo", min: 0, max: 20000, step: 100 },
            { label: "Withdrawal — Years 11–20", key: "withdraw2", prefix: "$", suffix: "/mo", min: 0, max: 20000, step: 100 },
            { label: "Withdrawal — Years 21–30", key: "withdraw3", prefix: "$", suffix: "/mo", min: 0, max: 20000, step: 100 },
            { label: "Withdrawal — Years 31–40", key: "withdraw4", prefix: "$", suffix: "/mo", min: 0, max: 20000, step: 100 },
          ].map(({ label, key, prefix, suffix, min, max, step = 1 }) => (
            <div key={key} style={{ background: "#161b27", border: "1px solid #252b3a", borderRadius: 10, padding: "16px 20px" }}>
              <label style={{ display: "block", fontSize: 11, letterSpacing: "0.08em", color: "#7c8a9a", textTransform: "uppercase", marginBottom: 10, fontFamily: "sans-serif" }}>
                {label}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {prefix && <span style={{ color: "#c9a96e", fontSize: 16, fontWeight: 600 }}>{prefix}</span>}
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={inputs[key]}
                  onChange={set(key)}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid #2e3650",
                    color: "#f0e6d0",
                    fontSize: 22,
                    fontFamily: "'Georgia', serif",
                    width: "100%",
                    padding: "4px 0",
                    outline: "none",
                  }}
                />
                {suffix && <span style={{ color: "#7c8a9a", fontSize: 13, whiteSpace: "nowrap", fontFamily: "sans-serif" }}>{suffix}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Market Growth Toggle */}
        <div style={{ marginTop: 20, background: "#12161f", border: "1px solid #1e2535", borderRadius: 10, padding: "16px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "#7c8a9a", textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 10 }}>Market Growth Scenario</div>
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(GROWTH_MODES).map(([key, mode]) => {
                const active = growthMode === key;
                return (
                  <button
                    key={key}
                    onClick={() => setGrowthMode(key)}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 6,
                      border: `1px solid ${active ? mode.color : "#2e3650"}`,
                      background: active ? `${mode.color}18` : "transparent",
                      color: active ? mode.color : "#7c8a9a",
                      fontFamily: "sans-serif",
                      fontSize: 13,
                      fontWeight: active ? 700 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {mode.label}
                    <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.75 }}>{mode.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1, fontSize: 13, color: "#9a9fa8", fontFamily: "sans-serif", lineHeight: 1.6 }}>
            <strong style={{ color: GROWTH_MODES[growthMode].color }}>{GROWTH_MODES[growthMode].label} growth ({GROWTH_MODES[growthMode].desc})</strong> applied to 401(k) balance each year.
            {growthMode === "low" && <span style={{ color: "#e87070" }}> Conservative scenario — assumes ~half of historical average returns.</span>}
            {growthMode === "normal" && <span style={{ color: "#8fcf6a" }}> Historical average scenario — long-run S&P 500 average.</span>}
          </div>
        </div>

        {/* Assumptions Banner */}
        <div style={{ marginTop: 12, background: "#12161f", border: "1px solid #1e2535", borderLeft: "3px solid #c9a96e", borderRadius: 8, padding: "12px 20px", display: "flex", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
          <span style={{ fontSize: 12, color: "#9a9fa8", fontFamily: "sans-serif", lineHeight: 1.7 }}>
            Once Social Security begins at age {inputs.ssStartAge}, the benefit grows by <strong style={{ color: '#5b8ecf' }}>{inputs.ssColaRate}% COLA annually</strong> — reducing 401(k) draws more over time.
            {" "}After age <strong style={{ color: "#e8a84a" }}>73</strong>, IRS <strong style={{ color: "#e8a84a" }}>RMD</strong> rules apply. Federal tax uses 2024 MFJ brackets on the pre-tax portion of 401(k) withdrawals + 85% of SS income, minus standard deduction.
          </span>
        </div>

        {/* Summary Cards */}
        {(() => {
          const last = projection[projection.length - 1];
          const ssYear = projection.find((r) => r.ssAnnual > 0);
          return (
            <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
                { label: "Final Balance (Yr 40)", value: formatK(Math.max(0, last?.endBalance || 0)), highlight: (last?.endBalance || 0) > 100000, warn: (last?.endBalance || 0) <= 0 },
                { label: "Growth Scenario", value: `${GROWTH_MODES[growthMode].label} — ${GROWTH_MODES[growthMode].desc}`, highlight: growthMode === "normal", warn: growthMode === "low" },
                { label: "SS Starts at Age", value: `${inputs.ssStartAge} (Yr ${inputs.ssStartAge - inputs.retirementAge + 1})`, highlight: true },
                { label: "Peak Balance", value: formatK(maxBalance), highlight: true },
                { label: "401(k) Status", value: depletedAt ? `Depleted Yr ${depletedAt.year}` : "Sustained 40 yrs", warn: !!depletedAt, highlight: !depletedAt },
              ].map(({ label, value, highlight, warn }) => (
                <div key={label} style={{ background: "#161b27", border: `1px solid ${warn ? "#6b2c2c" : highlight ? "#2e3a28" : "#252b3a"}`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, color: "#7c8a9a", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "sans-serif", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: warn ? "#e87070" : highlight ? "#8fcf6a" : "#f0e6d0" }}>{value}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Bar Chart */}
        <div style={{ marginTop: 36, background: "#161b27", border: "1px solid #252b3a", borderRadius: 12, padding: "28px 24px" }}>
          <div style={{ fontSize: 13, color: "#9a9fa8", fontFamily: "sans-serif", marginBottom: 20, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 600, color: "#f0e6d0", fontSize: 15 }}>401(k) Balance Over 40 Years</span>
            <span style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, background: "#c9a96e", borderRadius: 2, display: "inline-block" }} />Before SS</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, background: "#5b8ecf", borderRadius: 2, display: "inline-block" }} />After SS</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, background: "#b06820", borderRadius: 2, display: "inline-block" }} />RMD Active</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, background: "#6b2c2c", borderRadius: 2, display: "inline-block" }} />Depleted</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 180, overflowX: "auto" }}>
            {projection.map((row) => {
              const pct = maxBalance > 0 ? Math.max(0, row.endBalance) / maxBalance : 0;
              const color = row.depleted ? "#6b2c2c" : row.rmdApplied ? "#b06820" : row.ssAnnual > 0 ? "#5b8ecf" : "#c9a96e";
              const tip = `Age ${row.age}: ${formatCurrency(row.endBalance)}${row.rmdApplied ? " (RMD)" : ""}`;
              return (
                <div key={row.year} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "1 0 24px", minWidth: 24 }} title={tip}>
                  <div style={{ width: "100%", background: color, height: Math.max(2, pct * 160), borderRadius: "3px 3px 0 0", transition: "height 0.3s ease", opacity: 0.85 }} />
                  <div style={{ fontSize: 9, color: "#4a5568", marginTop: 4, fontFamily: "sans-serif" }}>{row.age}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "#4a5568", fontFamily: "sans-serif", textAlign: "center" }}>Age →</div>
        </div>

        {/* Table */}
        <div style={{ marginTop: 32, background: "#161b27", border: "1px solid #252b3a", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "sans-serif", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#0f1117", borderBottom: "1px solid #252b3a" }}>
                  {["Yr", "Age", "Start Balance", `Growth (${(marketGrowthRate*100).toFixed(1)}%)`, "Planned Draw/yr", "RMD Required", "Actual 401k/yr", "SS Income/yr (w/ COLA)", "Total Income/yr", "Fed Tax/yr", "Net Income/yr", "End Balance"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "right", color: "#7c8a9a", fontWeight: 500, letterSpacing: "0.04em", fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      {h === "Yr" || h === "Age" ? <span style={{ textAlign: "center", display: "block" }}>{h}</span> : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projection.map((row, i) => {
                  const isSSStart = row.ssAnnual > 0 && (i === 0 || projection[i - 1].ssAnnual === 0);
                  const isRMDStart = row.age === RMD_AGE && row.startBalance > 0;
                  const decade = Math.floor((row.year - 1) / 10);
                  const rowBg = row.depleted ? "rgba(107,44,44,0.15)" : row.rmdApplied ? "rgba(176,104,32,0.08)" : i % 2 === 0 ? "#161b27" : "#131720";
                  return (
                    <>
                      {isRMDStart && (
                        <tr key={`rmd-${row.year}`} style={{ background: "rgba(176,104,32,0.15)" }}>
                          <td colSpan={12} style={{ padding: "7px 14px", color: "#e8a84a", fontSize: 11, textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            ⚠ IRS Required Minimum Distribution begins — Age {RMD_AGE} · Withdrawals will be at least the RMD amount each year
                          </td>
                        </tr>
                      )}
                      {isSSStart && (
                        <tr key={`ss-${row.year}`} style={{ background: "rgba(91,142,207,0.12)" }}>
                          <td colSpan={12} style={{ padding: "7px 14px", color: "#5b8ecf", fontSize: 11, textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            ▶ Social Security begins — Age {row.age}, Year {row.year} · Starts at ${inputs.ssMonthly.toLocaleString()}/mo, grows {inputs.ssColaRate}% annually (COLA)
                          </td>
                        </tr>
                      )}
                      {(row.year === 1 || row.year === 11 || row.year === 21 || row.year === 31) && (
                        <tr key={`phase-${row.year}`} style={{ background: "rgba(201,169,110,0.08)" }}>
                          <td colSpan={12} style={{ padding: "6px 14px", color: "#c9a96e", fontSize: 11, textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            Phase {decade + 1} — Planned Withdrawal: ${[inputs.withdraw1, inputs.withdraw2, inputs.withdraw3, inputs.withdraw4][decade].toLocaleString()}/mo
                          </td>
                        </tr>
                      )}
                      <tr key={row.year} style={{ background: rowBg, borderBottom: "1px solid #1e2535" }}>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#7c8a9a" }}>{row.year}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#f0e6d0", fontWeight: 600 }}>
                          {row.age}{row.age >= RMD_AGE && row.startBalance > 0 ? <span style={{ color: "#e8a84a", fontSize: 10, marginLeft: 3 }}>R</span> : null}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#c9a96e" }}>{formatK(row.startBalance)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#8fcf6a" }}>{formatK(row.growth)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#9a9fa8" }}>
                          {row.depleted ? "—" : formatK(row.desiredAnnual401k)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: row.rmdRequired > 0 ? (row.rmdApplied ? "#e8a84a" : "#6a7080") : "#4a5568" }}>
                          {row.rmdRequired > 0 ? <span>{formatK(row.rmdRequired)}{row.rmdApplied ? " ▲" : ""}</span> : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: row.annual401k === 0 ? "#4a5568" : row.rmdApplied ? "#e8a84a" : "#f0e6d0", fontWeight: row.rmdApplied ? 600 : 400 }}>
                          {row.annual401k === 0 ? "—" : formatK(row.annual401k)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: row.ssAnnual === 0 ? "#4a5568" : "#5b8ecf" }}>{row.ssAnnual === 0 ? "—" : formatK(row.ssAnnual)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#f0e6d0", fontWeight: 500 }}>{formatK(row.totalIncome)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: row.fedTax > 0 ? "#e87070" : "#4a5568", fontWeight: row.fedTax > 0 ? 600 : 400 }}>
                          {row.fedTax > 0 ? formatK(row.fedTax) : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#8fcf6a", fontWeight: 600 }}>
                          {formatK(row.netIncome)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: row.depleted ? "#e87070" : row.endBalance < 100000 ? "#e8a84a" : "#8fcf6a" }}>
                          {row.depleted && row.endBalance <= 0 ? <span style={{ color: "#e87070" }}>DEPLETED</span> : formatK(row.endBalance)}
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer: legend + PDF share button */}
        <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: "#4a5568", fontFamily: "sans-serif", display: "flex", flexWrap: "wrap", gap: 12 }}>
            <span><span style={{ color: "#e8a84a" }}>R</span> = RMD year · <span style={{ color: "#e8a84a" }}>▲</span> = RMD exceeded planned withdrawal</span>
            <span>·</span>
            <span>For illustrative purposes only · 7% growth is a historical average · Consult a financial advisor</span>
          </div>
          <button
            onClick={handleShowReport}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px",
              background: "linear-gradient(135deg, #c9a96e, #a87d42)",
              border: "none", borderRadius: 8, color: "#0f1117",
              fontFamily: "sans-serif", fontSize: 14, fontWeight: 700,
              cursor: "pointer", letterSpacing: "0.03em",
              boxShadow: "0 2px 12px rgba(201,169,110,0.3)", flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            View / Save Report
          </button>

        </div>

      </div>

      {/* Full-screen HTML report viewer */}
      {showReport && (
        <div style={{
          position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"#000",zIndex:9999,display:"flex",flexDirection:"column",
        }}>
          <div style={{
            display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"10px 16px",background:"#161b27",
            borderBottom:"2px solid #c9a96e",flexShrink:0,
          }}>
            <span style={{color:"#c9a96e",fontFamily:"sans-serif",fontWeight:700,fontSize:15}}>
              📄 Retirement Projection Report
            </span>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{color:"#7c8a9a",fontFamily:"sans-serif",fontSize:11,maxWidth:200,lineHeight:1.4}}>
                Use Safari's share button (⬆) to Save as PDF or print
              </span>
              <button
                onClick={() => setShowReport(false)}
                style={{
                  padding:"8px 16px",background:"#2a2f3e",border:"1px solid #4a5568",
                  borderRadius:6,color:"#e8dcc8",fontFamily:"sans-serif",
                  fontSize:13,cursor:"pointer",
                }}
              >✕ Close</button>
            </div>
          </div>
          <iframe
            srcDoc={buildReportHTML()}
            style={{flex:1,width:"100%",border:"none",background:"#fff"}}
            title="Retirement Report"
          />
        </div>
      )}
    </div>
  );
}