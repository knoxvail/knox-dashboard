export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });

  return { headers, rows };
}

export function mapCostarToComp(row) {
  const normalizeHeader = (h) => h.toLowerCase().replace(/\s+/g, '');

  const find = (variations) => {
    return Object.entries(row).find(([key]) =>
      variations.some(v => normalizeHeader(key).includes(normalizeHeader(v)))
    )?.[1] || '';
  };

  const isSold = find(['sale date', 'saledate', 'date']) ? true : false;

  const comp = {
    address: find(['address', 'property address']),
    date: find(isSold ? ['sale date', 'saledate'] : ['lease date', 'leasedate']),
    comp_type: isSold ? 'sold' : 'lease',
    source: 'CoStar',
    notes: '',
  };

  if (isSold) {
    comp.sale_price = parseFloat(find(['sale price', 'saleprice', 'price'])) || 0;
    comp.price_per_sf = parseFloat(find(['price per sf', 'pricepersf', 'price/sf'])) || 0;
    comp.cap_rate = parseFloat(find(['cap rate', 'caprate', 'cap_rate'])) || 0;
    comp.noi = parseFloat(find(['noi', 'net operating income'])) || 0;
    comp.sf = parseFloat(find(['building sf', 'buildingsf', 'sf', 'square feet'])) || 0;
    comp.units = parseFloat(find(['units', 'number of units'])) || 0;
  } else {
    comp.rent_per_sf = parseFloat(find(['rent per sf', 'rentpersf', 'rent/sf'])) || 0;
    comp.vacancy_rate = parseFloat(find(['vacancy', 'vacancy rate', 'vacancyrate'])) || 0;
    comp.lease_term = find(['lease term', 'leaseterm']) || '';
    comp.concessions = find(['concessions']) || '';
  }

  return comp;
}

export function validateComp(comp, isSold = true) {
  const errors = [];

  if (!comp.address) errors.push('Address is required');
  if (!comp.date) errors.push('Date is required');

  if (isSold) {
    if (!comp.sale_price) errors.push('Sale price is required for sold comps');
    if (!comp.sf) errors.push('Building SF is required for sold comps');
  } else {
    if (!comp.rent_per_sf) errors.push('Rent/SF is required for lease comps');
  }

  return { isValid: errors.length === 0, errors };
}
