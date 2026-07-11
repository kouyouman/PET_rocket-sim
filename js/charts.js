const COLORS = { altitudeM: '#f59e0b', velocityMps: '#2563eb', thrustN: '#16a34a', pressureBar: '#7c3aed', massKg: '#dc2626', waterMl: '#0891b2' };

export function drawFlightChart(canvas, series, metric = 'altitudeM') {
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 700, height = canvas.clientHeight || 340;
  canvas.width = width * ratio; canvas.height = height * ratio; ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  if (!series.length) return;
  const read = point => metric === 'pressureBar' ? point.pressurePa / 100000 : metric === 'waterMl' ? point.waterVolumeM3 * 1e6 : point[metric];
  const values = series.map(read);
  const min = Math.min(0, ...values), max = Math.max(...values, min + 1);
  const maxTime = Math.max(...series.map(point => point.timeS), 1);
  const pad = { left: 52, right: 16, top: 18, bottom: 36 };
  const x = t => pad.left + t / maxTime * (width - pad.left - pad.right);
  const y = value => pad.top + (max - value) / (max - min) * (height - pad.top - pad.bottom);
  ctx.strokeStyle = '#d1d5db'; ctx.fillStyle = '#4b5563'; ctx.font = '12px system-ui'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const value = min + (max - min) * i / 4; const py = y(value); ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(width - pad.right, py); ctx.stroke(); ctx.fillText(value.toFixed(1), 4, py + 4); }
  ctx.strokeStyle = COLORS[metric] || '#2563eb'; ctx.lineWidth = 2.5; ctx.beginPath();
  series.forEach((point, index) => { const value = read(point); index ? ctx.lineTo(x(point.timeS), y(value)) : ctx.moveTo(x(point.timeS), y(value)); }); ctx.stroke();
  ctx.fillStyle = '#4b5563'; ctx.fillText('時間 (s)', width / 2 - 20, height - 8);
}

export function drawTrajectoryChart(canvas, series) {
  const ctx = canvas.getContext('2d'); const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 700, height = canvas.clientHeight || 340;
  canvas.width = width * ratio; canvas.height = height * ratio; ctx.scale(ratio, ratio); ctx.clearRect(0, 0, width, height);
  if (!series.length) return;
  const xs = series.map(p => p.xM), zs = series.map(p => p.altitudeM); const minX = Math.min(0, ...xs), maxX = Math.max(0, ...xs); const maxZ = Math.max(1, ...zs);
  const pad = 42, spanX = Math.max(1, maxX - minX); const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / maxZ);
  const x = value => pad + (value - minX) * scale, z = value => height - pad - value * scale;
  ctx.strokeStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(pad, height - pad); ctx.lineTo(width - pad, height - pad); ctx.stroke();
  ctx.strokeStyle = '#e11d48'; ctx.lineWidth = 2.5; ctx.beginPath(); series.forEach((p, i) => i ? ctx.lineTo(x(p.xM), z(p.altitudeM)) : ctx.moveTo(x(p.xM), z(p.altitudeM))); ctx.stroke();
  ctx.fillStyle = '#475569'; ctx.font = '12px system-ui'; ctx.fillText('水平距離 (m)', width / 2 - 30, height - 8); ctx.save(); ctx.translate(12, height / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('高度 (m)', 0, 0); ctx.restore();
}

export function drawUnifiedFlightChart(canvas, result, mode = 'trajectory', cursorFraction = null) {
  const ctx = canvas.getContext('2d'), ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 760, height = canvas.clientHeight || 620;
  canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  if (!result.series.length) return;
  if (mode === 'trajectory') drawUnifiedTrajectory(ctx, width, height, result);
  else drawTimelineLanes(ctx, width, height, result, cursorFraction);
}

function drawUnifiedTrajectory(ctx, width, height, result) {
  const pad = { l: 58, r: 24, t: 38, b: 52 }, xs = result.series.map(p => p.xM), zs = result.series.map(p => p.altitudeM);
  const minX = Math.min(0, ...xs), maxX = Math.max(0, ...xs), maxZ = Math.max(1, ...zs), spanX = Math.max(1, maxX - minX);
  const scale = Math.min((width - pad.l - pad.r) / spanX, (height - pad.t - pad.b) / maxZ);
  const x = value => pad.l + (value - minX) * scale, y = value => height - pad.b - value * scale;
  grid(ctx, pad.l, pad.t, width - pad.r, height - pad.b); ctx.strokeStyle = '#d81b60'; ctx.lineWidth = 3; ctx.beginPath(); result.series.forEach((p, i) => i ? ctx.lineTo(x(p.xM), y(p.altitudeM)) : ctx.moveTo(x(p.xM), y(p.altitudeM))); ctx.stroke();
  const labels = { 'launcher-exit':'離脱','water-out':'水終了','air-out':'推進終了','apogee':'最高点','parachute-deploy':'開傘','landing':'着地' };
  result.events.forEach(event => { if (!labels[event.type]) return; const px=x(event.xM), py=y(event.altitudeM); ctx.fillStyle='#172033'; ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();ctx.font='12px system-ui';ctx.fillText(labels[event.type],px+7,Math.max(15,py-7)); });
  const wind = result.series[0]?.windMps; ctx.fillStyle='#475569';ctx.font='13px system-ui';ctx.fillText('水平距離 (m)',width/2-35,height-12);ctx.save();ctx.translate(15,height/2);ctx.rotate(-Math.PI/2);ctx.fillText('高度 (m)',0,0);ctx.restore();
  ctx.font='bold 15px system-ui';ctx.fillText('ロケットが飛んだ道',pad.l,22);
}

function drawTimelineLanes(ctx, width, height, result, cursorFraction) {
  const lanes = [
    { label:'高度 m', read:p=>p.altitudeM, color:'#b7791f' }, { label:'速度 m/s', read:p=>p.velocityMps, color:'#285f9e' },
    { label:'推力 N', read:p=>p.thrustN, color:'#35705a' }, { label:'圧力 気圧', read:p=>p.pressurePa/101325, color:'#675b8f' },
    { label:'水量 mL', read:p=>p.waterVolumeM3*1e6, color:'#397b8a' }
  ];
  const pad={l:100,r:22,t:34,b:34}, plotW=width-pad.l-pad.r, laneH=(height-pad.t-pad.b)/lanes.length, maxTime=Math.max(.001,result.series.at(-1).timeS);
  const x=t=>pad.l+t/maxTime*plotW; const phaseColors={water:'#dff3ff',air:'#e8f5e9',coast:'#fff8e1'};
  for(let i=0;i<result.series.length-1;i++){ctx.fillStyle=phaseColors[result.series[i].phase]||'#f5f5f5';ctx.fillRect(x(result.series[i].timeS),pad.t,x(result.series[i+1].timeS)-x(result.series[i].timeS)+1,height-pad.t-pad.b);}
  lanes.forEach((lane,index)=>{const top=pad.t+index*laneH, values=result.series.map(lane.read), max=Math.max(1e-9,...values), min=Math.min(0,...values);ctx.strokeStyle='#cbd5e1';ctx.strokeRect(pad.l,top,plotW,laneH);ctx.fillStyle='#334155';ctx.font='12px system-ui';ctx.fillText(lane.label,4,top+18);ctx.fillText(max.toFixed(1),pad.l-38,top+12);ctx.strokeStyle=lane.color;ctx.lineWidth=2;ctx.beginPath();result.series.forEach((p,i)=>{const py=top+8+(max-lane.read(p))/(max-min||1)*(laneH-16);i?ctx.lineTo(x(p.timeS),py):ctx.moveTo(x(p.timeS),py)});ctx.stroke();});
  const eventLabels={'water-out':'水終了','air-out':'推進終了','apogee':'最高点','landing':'着地'};result.events.forEach(event=>{if(!eventLabels[event.type])return;const px=x(event.timeS);ctx.strokeStyle='#64748b';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(px,pad.t);ctx.lineTo(px,height-pad.b);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#334155';ctx.font='11px system-ui';ctx.fillText(eventLabels[event.type],Math.min(px+3,width-60),pad.t-8);});
  if(cursorFraction!==null){const px=pad.l+cursorFraction*plotW,time=cursorFraction*maxTime,index=Math.min(result.series.length-1,Math.max(0,Math.round(cursorFraction*(result.series.length-1)))),sample=result.series[index];ctx.strokeStyle='#111827';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px,pad.t);ctx.lineTo(px,height-pad.b);ctx.stroke();const boxX=Math.min(width-190,Math.max(pad.l,px+10));ctx.fillStyle='rgba(17,24,39,.92)';ctx.fillRect(boxX,pad.t+8,180,112);ctx.fillStyle='#fff';ctx.font='12px system-ui';ctx.fillText(`${time.toFixed(2)} 秒 / ${phaseLabel(sample.phase)}`,boxX+9,pad.t+26);lanes.forEach((lane,i)=>ctx.fillText(`${lane.label}: ${lane.read(sample).toFixed(2)}`,boxX+9,pad.t+44+i*15));}
  ctx.fillStyle='#475569';ctx.font='12px system-ui';ctx.fillText('時間 (s)',width/2,height-8);
}

function grid(ctx,left,top,right,bottom){ctx.strokeStyle='#e2e8f0';ctx.lineWidth=1;for(let i=0;i<=5;i++){const y=top+(bottom-top)*i/5;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke()}for(let i=0;i<=6;i++){const x=left+(right-left)*i/6;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke()}}
function phaseLabel(phase){return ({water:'水を噴射中',air:'空気を噴射中',coast:'勢いで飛行中'})[phase]||phase}
