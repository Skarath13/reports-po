export function getReportAppointmentPriceBadge(appointment) {
  if (!appointment) {
    return null;
  }

  return appointment.priceBadge || appointment.price_badge || null;
}

export function appendPriceToScheduleLine(line, appointment, showPrices) {
  if (!showPrices) {
    return line;
  }

  const priceBadge = getReportAppointmentPriceBadge(appointment);
  return priceBadge ? `${line} ~ ${priceBadge.label}` : line;
}
