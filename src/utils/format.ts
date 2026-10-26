export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
  } catch {
    return dateStr;
  }
}

export function formatDateTimeIndo(isoStr: string): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export function formatStock(qty: number, unit?: string): string {
  if (qty === null || qty === undefined || isNaN(qty)) return '0';
  // If decimal, show up to 2 decimal places, otherwise integer
  const formatted = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, '');
  return unit ? `${formatted} ${unit}` : formatted;
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const processRow = (row: (string | number)[]) => {
    return row
      .map((val) => {
        let str = String(val === null || val === undefined ? '' : val);
        str = str.replace(/"/g, '""');
        if (str.search(/("|,|\n)/g) >= 0) {
          str = `"${str}"`;
        }
        return str;
      })
      .join(',');
  };

  const csvContent = '\uFEFF' + [processRow(headers), ...rows.map(processRow)].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
