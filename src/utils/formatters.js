export const formatCop = (value) =>
  new Intl.NumberFormat('es-CO', {
    currency: 'COP',
    maximumFractionDigits: 0,
    style: 'currency'
  }).format(Number(value) || 0);
