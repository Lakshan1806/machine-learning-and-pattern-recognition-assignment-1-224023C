// AI code credit: OpenAI ChatGPT (Codex), 22 November 2026. Evaluation charts.
import React from 'react';
import TileGrid from './TileGrid.jsx';

const fmt = value => value == null ? 'Undefined' : value.toLocaleString('en', {maximumFractionDigits: 2});
const names = {last:'Previous bill', two_back:'Two months earlier', three_back:'Three months earlier',
  average:'Three-month average', month_sin:'Calendar month (sine)', month_cos:'Calendar month (cosine)'};

function Bars({groups, series, end=0}) {
  const values=groups.flatMap(g=>series.map(s=>g[s.key])).filter(Number.isFinite);
  const low=Math.min(0,...values), high=Math.max(end,0,...values);
  const pos=v=>100*(v-low)/(high-low || 1);
  return <>{groups.map(g=><div className="my-3" key={g.name}><strong>{g.name}</strong>
    {series.map(s=>{
      const v=g[s.key];
      return <div className="grid grid-cols-[1fr_72px] items-center gap-2 text-right tabular-nums" key={s.key} aria-label={g.name+' '+s.key+' '+fmt(v)}>
        <div className="relative h-2.5 bg-[#f1f5f2]"><span className="absolute top-0 h-full border-l border-muted" style={{left:pos(0)+'%'}}/>
          {Number.isFinite(v)&&<i className={"absolute top-0 h-full " + s.fill} style={{left:Math.min(pos(0),pos(v))+'%',width:Math.abs(pos(v)-pos(0))+'%'}}/>}</div>
        <span>{fmt(v)}</span></div>;
    })}</div>)}</>;
}

function Scatter({points,total}) {
  const max=Math.max(1,...points.flat());
  const x=v=>55+320*v/max, y=v=>218-180*v/max;
  return <section><h2>Stacking forecasts compared with actual usage</h2><p>Each dot is one stacked forecast. Dots below the line are underestimates.</p>
    <svg className="w-full fill-[#354e43] font-sans text-xs" viewBox="0 0 400 265" role="img" aria-label="Actual monthly usage versus the stacking forecast, in kilowatt-hours">
      {[0,0.5,1].map(k=><g key={k}><path d={'M55 '+y(k*max)+' H375'} stroke="#dce4df"/>
        <text x="49" y={y(k*max)+4} textAnchor="end">{Math.round(k*max)}</text>
        <text x={x(k*max)} y="237" textAnchor="middle">{Math.round(k*max)}</text></g>)}
      <path d="M55 38 V218 H375" fill="none" stroke="#82988e"/>
      <path d="M55 218 L375 38" stroke="#465a52" strokeDasharray="5 4"/>
      {points.map(([a,p],i)=><circle key={i} cx={x(a)} cy={y(p)} r="2.5" fill="#6b55ad" opacity=".43"><title>{'Actual '+fmt(a)+' · Forecast '+fmt(p)+' kWh'}</title></circle>)}
      <text x="210" y="258" textAnchor="middle">Actual usage (kWh)</text>
      <text transform="translate(13 130) rotate(-90)" textAnchor="middle">Forecast (kWh)</text>
    </svg><small>{fmt(points.length)} plotted bills out of {fmt(total)}. Scores use all test bills.</small></section>;
}

export default function Charts({report, editing}) {
  const groups=report.scores.map(s=>({...s,name:s.Model}));
  const weights=Object.entries(report.importance).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({name:names[k],percent:v*100}));
  const metrics = [
    ['bills', 'Test bills', fmt(report.bills)],
    ['households', 'Test households', fmt(report.households)],
    ['period', 'Test period', report.splits[2]['First month'] + ' – ' + report.splits[2]['Last month']]
  ];
  return <TileGrid editing={editing} tiles={[
    ...metrics.map(([id, label, value]) => ({
      id, label, size: 'metric', content: <div><small>{label}</small><b className="block text-[1.4rem]">{value}</b></div>
    })),
    {id: 'dates', label: 'Billing months', size: 'wide', content: <section><h2>Billing months used for training and testing</h2>
    <div className="flex flex-wrap items-center gap-4">{report.splits.map((s,i)=><div className="history-card" key={s.Stage}><strong>{['Learn from earlier bills','Learn how to combine forecasts','Check the predictions'][i]}</strong>
    <small>{s['First month']} to {s['Last month']} · {fmt(s.Bills)} bills</small></div>)}</div></section>},
    {id: 'errors', label: 'Prediction error', size: 'chart', content: <section><h2>Prediction error by model</h2><p>Both errors are measured in kWh. Smaller values mean closer predictions. Root mean squared error gives large misses extra weight.</p>
    <small className="flex flex-wrap gap-x-4 gap-y-1"><b className="text-[#146957]">■ Mean Absolute Error (MAE)</b><b className="text-[#875619]">■ Root Mean Squared Error (RMSE)</b></small>
    <Bars groups={groups} series={[{key:'MAE (kWh)',fill:'bg-[#207361]'},{key:'RMSE (kWh)',fill:'bg-[#be823b]'}]}/></section>},
    {id: 'fit', label: 'Model fit', size: 'chart', content: <section><h2>How well each model fits (R²)</h2><p>1 means a perfect match. 0 matches the squared error of always using the test-set average. Scores can be negative.</p>
    <Bars groups={groups} end={1} series={[{key:'R2',fill:'bg-[#3875a7]'}]}/></section>},
    {id: 'scatter', label: 'Stacking forecasts', size: 'chart', content: <Scatter points={report.points} total={report.bills}/>},
    {id: 'importance', label: 'Input importance', size: 'chart', content: <section><h2>Which inputs mattered most to XGBoost?</h2><p>Each percentage shows an input’s share of the model’s importance score, based on how much its splits improved the fit during training.</p>
    <Bars groups={weights} series={[{key:'percent',fill:'bg-[#ae7235]'}]}/></section>}
  ]}/>;
}
