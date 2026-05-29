const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function formatNumber(n: number, decimals = 2): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  if (n < 0) return '-' + formatNumber(-n, decimals);
  if (n < 1000) return n.toFixed(decimals);

  let i = 0;
  let v = n;
  while (v >= 1000 && i < SUFFIXES.length - 1) {
    v /= 1000;
    i++;
  }
  return v.toFixed(decimals) + SUFFIXES[i];
}

export function formatCPS(cps: number): string {
  if (Math.abs(cps) < 0.001) return '0.000';
  const sign = cps >= 0 ? '+' : '';
  return sign + formatNumber(Math.abs(cps), 3) + '/s';
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatPercent(n: number): string {
  return (n * 100).toFixed(1) + '%';
}
