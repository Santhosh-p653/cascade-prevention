// Calculate remaining seconds if OPEN
const getCooldownLeft = () => {
  if (circuit.state !== 'OPEN' || !circuit.opened_at) return 0;
  const elapsed = (Date.now() / 1000) - circuit.opened_at;
  const remaining = (circuit.cooldown_seconds || 3.0) - elapsed;
  return Math.max(0, remaining).toFixed(1);
};
