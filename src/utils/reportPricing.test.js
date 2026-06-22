import {
  appendPriceToScheduleLine,
  getReportAppointmentPriceBadge,
} from './reportPricing';

describe('report pricing', () => {
  it('uses the server-provided price badge', () => {
    const badge = getReportAppointmentPriceBadge({
      serviceName: 'Lash Fill (Natural)',
      priceBadge: {
        label: '$80',
        source: 'variation-id',
      },
    });

    expect(badge).toMatchObject({
      label: '$80',
      source: 'variation-id',
    });
  });

  it('omits price badges when the API did not provide one', () => {
    expect(getReportAppointmentPriceBadge({
      serviceName: 'Other - Notes in Description',
    })).toBeNull();
  });

  it('adds prices to copied schedule lines only when visible', () => {
    const appointment = {
      serviceName: 'Natural Set',
      serviceVariationId: 'W6H62USEZZMLYRMYDJSM4STH',
      daysSinceLastAppointment: null,
      priceBadge: {
        label: '$95',
      },
    };

    expect(appendPriceToScheduleLine('9:15 AM - Natural Set (New)', appointment, true))
      .toBe('9:15 AM - Natural Set (New) ~ $95');
    expect(appendPriceToScheduleLine('9:15 AM - Natural Set (New)', appointment, false))
      .toBe('9:15 AM - Natural Set (New)');
  });
});
