// AI code credit: OpenAI ChatGPT (Codex), 22 November 2026. React views and API integration.
import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import Charts from './Charts.jsx';

const fmt = n => Number(n).toLocaleString('en', {maximumFractionDigits: 2});
const colors = {'Random Forest':'#207361','XGBoost':'#d47d3a','Stacking':'#427ac2','Last bill':'#758080'};
async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Request failed (' + response.status + ')');
  }
  return response.json();
}

function Explorer({ids}) {
  const [id,setId]=useState(ids[0]), [rows,setRows]=useState([]), [month,setMonth]=useState(''), [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    setRows([]);setError('');
    request('/api/bills?household='+encodeURIComponent(id)).then(result=>{
      if(active){setRows(result);setMonth(result[0].month);}
    }).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[id]);
  const row=rows.find(r=>r.month===month);
  return <section className="panel"><h2>Explore household forecasts</h2><div className="mb-4.5 flex flex-wrap items-center gap-4 [&_input]:mt-1.5 [&_input]:block [&_select]:mt-1.5 [&_select]:block">
    <label>Household<select value={id} onChange={e=>setId(e.target.value)}>{ids.map(i=><option key={i}>{i}</option>)}</select></label>
    <label>Test billing month<select value={month} disabled={!rows.length} onChange={e=>setMonth(e.target.value)}>{rows.map(r=><option key={r.month}>{r.month}</option>)}</select></label></div>
    {error && <p role="alert">{error}</p>}{row && <><h3>Previous bills and actual test-month usage</h3><div className="mb-4.5 flex flex-wrap items-center gap-4">
      {[...row.history,{month:row.month,kwh:row.actual}].map((r,i)=><div className={i===3 ? "history-card bg-[#d9eee2]" : "history-card"} key={r.month}><small>{r.month}{i===3?' · Test bill':''}</small><b className="block text-[1.4rem]">{fmt(r.kwh)} kWh</b></div>)}</div>
      <table><thead><tr><th>Method</th><th>Forecast (kWh)</th><th>Absolute error (kWh)</th></tr></thead><tbody>
      {Object.entries(row.predictions).map(([model,value])=><tr key={model}><td>{model}</td><td>{fmt(value)}</td><td>{fmt(Math.abs(value-row.actual))}</td></tr>)}
      </tbody></table></>}</section>;
}

function App(){
  const [editing, setEditing] = useState(false);
  const [state,setState]=useState({phase:'starting',message:'Connecting to the Python backend…'}),[report,setReport]=useState(null),
        [ids,setIds]=useState([]),[view,setView]=useState('Compare model performance'),[epoch,setEpoch]=useState(0),[actionError,setActionError]=useState('');
  useEffect(()=>{
    let active=true, timer;
    async function poll(){
      try{
        const status=await request('/api/status');
        if(!active)return;
        if(status.phase==='ready'){
          const [summary,households]=await Promise.all([request('/api/comparison'),request('/api/households')]);
          if(!active)return;
          setReport(summary);setIds(households);setState(status);return;
        }
        setState(status);
        if(status.phase==='error')return;
      }catch(e){if(active)setState({phase:'connecting',message:e.message});}
      if(active)timer=setTimeout(poll,2000);
    }
    poll();return ()=>{active=false;clearTimeout(timer);};
  },[epoch]);
  async function retryLoading(){
    setActionError('');
    try{
      await request('/api/retry',{method:'POST'});
      setReport(null);setState({phase:'loading',message:'Reading monthly bills…'});setEpoch(e=>e+1);
    }catch(e){setActionError(e.message);}
  }
  return <><header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-divider bg-page px-gutter py-[11px]">
    <div className="flex items-center gap-2.5"><div className="basis-9 shrink-0 rounded-xl bg-brand text-center text-[25px] leading-9 text-white" aria-hidden="true">ϟ</div><h1 className="text-[clamp(1.25rem,2vw,1.75rem)] leading-[1.08] font-bold tracking-[-.035em]">Ensemble Learning Dashboard</h1></div>
    {state.phase==='ready' && report && <nav className="flex flex-wrap items-center gap-1.5" aria-label="Dashboard views">
      {['Compare model performance','Explore household forecasts','How models are trained and tested'].map(v=>
        <button className="px-2.5 py-[5px] text-[.95rem]" key={v} aria-pressed={view===v} onClick={()=>{if (view !== v) setEditing(false); setView(v);}}>{v}</button>)}
    </nav>}
    <a className="button-link shrink-0 no-underline min-[36rem]:ml-auto" href="/Electricity_Ensembles.ipynb" download>Download notebook</a></header>
    <main className="px-gutter py-6">
    <div className="mb-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0">Sri Lankan household electricity forecasts using Random Forest, XGBoost and Stacking (Ridge regression).</p>
      {state.phase==='ready' && report && view==='Compare model performance' &&
        <button className="shrink-0" aria-pressed={editing} onClick={()=>setEditing(active=>!active)}>
          {editing ? 'Done arranging' : 'Arrange tiles'}
        </button>}
    </div>
    {state.phase!=='ready' || !report ? <section className="panel" aria-live="polite"><h2>{state.phase==='error'?'Billing data needed':'Preparing the dashboard'}</h2>
      <p>{state.message}</p>{state.phase==='error' && <><p>Check <code>data/monthly_consumption.csv</code> in the project folder, then retry.</p>
        <button onClick={retryLoading}>Retry loading</button></>}{actionError&&<p role="alert">{actionError}</p>}</section> :
    <>
    {view==='Compare model performance' && <Charts report={report} editing={editing}/>}
    {view==='Explore household forecasts' && <Explorer ids={ids}/>}
    {view==='How models are trained and tested' && <section className="panel"><h2>Training and testing periods</h2><p>Each forecast uses three consecutive earlier bills and the target calendar month. Models stay fixed across the test period. Previously recorded test bills can supply history for the following month.</p>
      <table><thead><tr><th>Stage</th><th>From</th><th>Through</th><th>Bills</th></tr></thead><tbody>{report.splits.map(r=><tr key={r.Stage}><td>{r.Stage}</td><td>{r['First month']}</td><td>{r['Last month']}</td><td>{fmt(r.Bills)}</td></tr>)}</tbody></table>
      <p>Random Forest averages bootstrapped trees. XGBoost adds trees sequentially. Ridge regression learns to combine their held-out calibration forecasts. Both base models then train on all pre-test months.</p>
      <h3>Billing records included and excluded</h3>{Object.entries({...report.audit,'Bills with sufficient history':report.eligible}).map(([k,v])=><div className="flex justify-between border-b border-[#dfebe4] p-2.5" key={k}><span>{k}</span><b>{fmt(v)}</b></div>)}</section>}</>}
    <footer className="my-7 flex flex-wrap justify-between gap-4 border-t border-divider pt-4.5 text-[.9rem] text-[#50665e]">
      <div><strong>Machine Learning and Pattern Recognition</strong><small>Student index: 224023C</small></div>
      <div><strong>References</strong><br/>Algama et al. (2025) · <a href="https://zenodo.org/records/15023048">RECON-SL dataset</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></div>
    </footer></main></>;
}
createRoot(document.getElementById('root')).render(<App/>);
