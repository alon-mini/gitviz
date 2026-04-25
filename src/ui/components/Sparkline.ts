export function renderSparkline(values: number[], label: string): string {
  if (!values.length) return '';
  const width = Math.max(120, values.length * 4);
  const height = 42;
  const max = Math.max(...values, 1);
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return `
    <svg class="grv-sparkline" role="img" aria-label="${escapeHtml(label)}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <polyline fill="none" stroke="currentColor" stroke-width="2" points="${points}" vector-effect="non-scaling-stroke"></polyline>
    </svg>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] as string));
}
