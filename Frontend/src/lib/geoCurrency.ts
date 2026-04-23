export type GeoCurrencyState = {
  countryCode: string | null;
  defaultCurrency: 'INR' | 'USD';
  isIndianUser: boolean;
};

export const detectGeoCurrency = async (): Promise<GeoCurrencyState> => {
  try {
    const response = await fetch('https://api.country.is/');
    const data = await response.json();
    const countryCode = String(data?.country || '').trim().toUpperCase() || null;
    const isIndianUser = countryCode === 'IN';
    return {
      countryCode,
      defaultCurrency: isIndianUser ? 'INR' : 'USD',
      isIndianUser
    };
  } catch {
    return {
      countryCode: null,
      defaultCurrency: 'USD',
      isIndianUser: false
    };
  }
};

export const buildCountryHeaders = (countryCode: string | null): HeadersInit => {
  if (!countryCode) return {};
  return {
    'X-Country-Code': countryCode
  };
};
