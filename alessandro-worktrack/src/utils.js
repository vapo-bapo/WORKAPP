export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
export const isoDate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
export const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
export const money = (v, currency='EUR') => new Intl.NumberFormat('it-IT',{style:'currency',currency,maximumFractionDigits:2}).format(num(v));
export const hoursFmt = (v) => `${num(v).toFixed(num(v)%1===0?0:1)} h`;
export const dateFmt = (s, opts={day:'2-digit',month:'short'}) => new Intl.DateTimeFormat('it-IT', opts).format(new Date(`${s}T12:00:00`));
export const monthLabel = (date) => new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(date);
export const clamp = (n,min,max) => Math.min(max,Math.max(min,n));

export function jobFor(state, jobId) { return state.jobs.find(j => j.id === jobId); }

export function effectiveRate(shift, job) {
  if (shift.hourlyRate !== '' && shift.hourlyRate != null) return num(shift.hourlyRate);
  return num(job?.hourlyRate);
}
export function effectiveFixed(shift, job) {
  if (shift.fixedPay !== '' && shift.fixedPay != null) return num(shift.fixedPay);
  return num(job?.fixedPay);
}
export function timeHours(start, end) {
  if (!start || !end) return 0;
  const [sh,sm]=start.split(':').map(Number), [eh,em]=end.split(':').map(Number);
  if (![sh,sm,eh,em].every(Number.isFinite)) return 0;
  let mins=(eh*60+em)-(sh*60+sm);
  if (mins <= 0) mins += 24*60;
  return mins/60;
}
export function plannedHours(shift, job) {
  if (shift.estimatedHours !== '' && shift.estimatedHours != null) return num(shift.estimatedHours);
  const fromTimes=timeHours(shift.startTime,shift.endTime);
  return fromTimes || num(job?.estimatedHours);
}
export function actualHours(shift) {
  if (shift.actualHours !== '' && shift.actualHours != null) return num(shift.actualHours);
  return timeHours(shift.startTime,shift.endTime);
}

export function calcEstimate(shift, job) {
  if (shift.status === 'cancelled') return 0;
  if (shift.manualPay !== '' && shift.manualPay != null) return num(shift.manualPay) + num(shift.bonus) - num(shift.deductions);
  const type = shift.payType || job?.payType || 'hourly';
  let base = 0;
  if (type === 'fixed') base = effectiveFixed(shift, job);
  else if (type === 'hourly') base = plannedHours(shift, job) * effectiveRate(shift, job);
  else base = num(shift.estimatedPay);
  return Math.max(0, base + num(shift.bonus) - num(shift.deductions));
}

export function calcActual(shift, job) {
  if (shift.status !== 'completed' || shift.status === 'cancelled') return 0;
  if (shift.manualPay !== '' && shift.manualPay != null) return Math.max(0, num(shift.manualPay) + num(shift.bonus) - num(shift.deductions));
  const type = shift.payType || job?.payType || 'hourly';
  let base = 0;
  if (type === 'fixed') base = effectiveFixed(shift, job);
  else if (type === 'hourly') base = actualHours(shift) * effectiveRate(shift, job);
  else base = num(shift.actualPay);
  return Math.max(0, base + num(shift.bonus) - num(shift.deductions));
}

export function shiftValue(shift, job) {
  return shift.status === 'completed' ? calcActual(shift, job) : calcEstimate(shift, job);
}

export function monthBounds(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth()+1, 0);
  return [isoDate(start), isoDate(end)];
}
export function inRange(date, start, end) { return date >= start && date <= end; }
export function previousMonth(date) { return new Date(date.getFullYear(), date.getMonth()-1, 1); }
export function addMonths(date, delta) { return new Date(date.getFullYear(), date.getMonth()+delta, 1); }

export function monthMetrics(state, monthDate) {
  const [start,end] = monthBounds(monthDate);
  const shifts = state.shifts.filter(s => inRange(s.date,start,end) && s.status !== 'cancelled');
  let earned=0, forecast=0, completedHours=0, plannedHoursTotal=0, paid=0, unpaid=0;
  for (const s of shifts) {
    const j = jobFor(state,s.jobId);
    if (s.status === 'completed') {
      const val=calcActual(s,j); earned += val; completedHours += actualHours(s);
      if (s.paid) paid += val; else unpaid += val;
    } else {
      forecast += calcEstimate(s,j); plannedHoursTotal += plannedHours(s,j);
    }
  }
  return {
    shifts, earned, forecast, projected: earned+forecast, completedHours, plannedHours: plannedHoursTotal,
    paid, unpaid, completedCount: shifts.filter(s=>s.status==='completed').length,
    plannedCount: shifts.filter(s=>s.status==='planned').length,
    effectiveHourly: completedHours ? earned/completedHours : 0
  };
}

export function colorForJob(job, fallback='#6f7cff') { return job?.color || fallback; }
