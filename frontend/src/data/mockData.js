// ============================================================
// Mock Data — Invoice Tracking System
// ============================================================

export const AREAS = [
  'Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Barat', 'Jakarta Utara', 'Jakarta Timur',
  'Bekasi', 'Depok', 'Tangerang', 'Bogor', 'Karawang'
];

export const SCHEDULES = [
  'Setiap Hari', 'Senin-Jumat', 'Senin & Kamis', 'Selasa & Jumat', 'Senin saja'
];

export const DRIVERS = [
  { id: 1, name: 'Budi Santoso', phone: '0812-3456-7890', area: 'Jakarta Pusat - Jakarta Selatan' },
  { id: 2, name: 'Agus Prasetyo', phone: '0821-9876-5432', area: 'Bekasi - Karawang' },
  { id: 3, name: 'Rizky Darmawan', phone: '0856-1234-5678', area: 'Tangerang - Jakarta Barat' },
  { id: 4, name: 'Hendra Wijaya', phone: '0878-2345-6789', area: 'Depok - Bogor' },
];

export const CUSTOMERS = [
  { id: 1, name: 'PT Maju Bersama', area: 'Jakarta Pusat', schedule: 'Senin & Kamis', cutoff: '10:00', contact: 'Bu Siti' },
  { id: 2, name: 'CV Karya Utama', area: 'Bekasi', schedule: 'Setiap Hari', cutoff: '14:00', contact: 'Pak Joko' },
  { id: 3, name: 'PT Sumber Rejeki', area: 'Tangerang', schedule: 'Senin-Jumat', cutoff: '12:00', contact: 'Bu Dewi' },
  { id: 4, name: 'UD Makmur Jaya', area: 'Depok', schedule: 'Selasa & Jumat', cutoff: '11:00', contact: 'Pak Andi' },
  { id: 5, name: 'PT Indo Raya', area: 'Jakarta Selatan', schedule: 'Senin-Jumat', cutoff: '09:00', contact: 'Bu Rina' },
  { id: 6, name: 'CV Harmoni', area: 'Bogor', schedule: 'Senin saja', cutoff: '13:00', contact: 'Pak Sutomo' },
  { id: 7, name: 'PT Nusantara', area: 'Jakarta Timur', schedule: 'Setiap Hari', cutoff: '15:00', contact: 'Bu Lastri' },
  { id: 8, name: 'UD Sejahtera', area: 'Karawang', schedule: 'Senin & Kamis', cutoff: '10:30', contact: 'Pak Bambang' },
];

export const INVOICES = [
  {
    id: 1, invoiceNo: 'INV-2024-001', customerId: 5, customerName: 'PT Indo Raya',
    area: 'Jakarta Selatan', amount: 12500000, date: '2024-04-18',
    dueDate: '2024-04-25', status: 'Dalam Pengiriman', priority: 'Tinggi',
    driverId: 1, driverName: 'Budi Santoso',
    schedule: 'Senin-Jumat', cutoff: '09:00',
    deliveryDate: '2024-04-24', notes: 'Harus sebelum jam 09.00'
  },
  {
    id: 2, invoiceNo: 'INV-2024-002', customerId: 1, customerName: 'PT Maju Bersama',
    area: 'Jakarta Pusat', amount: 8750000, date: '2024-04-17',
    dueDate: '2024-04-24', status: 'Dalam Pengiriman', priority: 'Tinggi',
    driverId: 1, driverName: 'Budi Santoso',
    schedule: 'Senin & Kamis', cutoff: '10:00',
    deliveryDate: '2024-04-24', notes: 'Hari pengiriman: Senin/Kamis'
  },
  {
    id: 3, invoiceNo: 'INV-2024-003', customerId: 4, customerName: 'UD Makmur Jaya',
    area: 'Depok', amount: 5200000, date: '2024-04-16',
    dueDate: '2024-04-26', status: 'Menunggu', priority: 'Sedang',
    driverId: 4, driverName: 'Hendra Wijaya',
    schedule: 'Selasa & Jumat', cutoff: '11:00',
    deliveryDate: '2024-04-26', notes: 'Kirim Selasa/Jumat saja'
  },
  {
    id: 4, invoiceNo: 'INV-2024-004', customerId: 3, customerName: 'PT Sumber Rejeki',
    area: 'Tangerang', amount: 15600000, date: '2024-04-15',
    dueDate: '2024-04-28', status: 'Menunggu', priority: 'Sedang',
    driverId: 3, driverName: 'Rizky Darmawan',
    schedule: 'Senin-Jumat', cutoff: '12:00',
    deliveryDate: '2024-04-25', notes: ''
  },
  {
    id: 5, invoiceNo: 'INV-2024-005', customerId: 2, customerName: 'CV Karya Utama',
    area: 'Bekasi', amount: 3400000, date: '2024-04-14',
    dueDate: '2024-04-30', status: 'Menunggu', priority: 'Rendah',
    driverId: 2, driverName: 'Agus Prasetyo',
    schedule: 'Setiap Hari', cutoff: '14:00',
    deliveryDate: '2024-04-30', notes: ''
  },
  {
    id: 6, invoiceNo: 'INV-2024-006', customerId: 7, customerName: 'PT Nusantara',
    area: 'Jakarta Timur', amount: 22000000, date: '2024-04-13',
    dueDate: '2024-04-20', status: 'Terkirim', priority: 'Tinggi',
    driverId: 1, driverName: 'Budi Santoso',
    schedule: 'Setiap Hari', cutoff: '15:00',
    deliveryDate: '2024-04-19', notes: 'Terkirim tepat waktu',
    deliveredAt: '2024-04-19T14:32:00'
  },
  {
    id: 7, invoiceNo: 'INV-2024-007', customerId: 8, customerName: 'UD Sejahtera',
    area: 'Karawang', amount: 9100000, date: '2024-04-12',
    dueDate: '2024-04-22', status: 'Kembali', priority: 'Tinggi',
    driverId: 2, driverName: 'Agus Prasetyo',
    schedule: 'Senin & Kamis', cutoff: '10:30',
    deliveryDate: '2024-04-18', notes: 'Penerima tidak di tempat, kembali ke kantor'
  },
  {
    id: 8, invoiceNo: 'INV-2024-008', customerId: 6, customerName: 'CV Harmoni',
    area: 'Bogor', amount: 6750000, date: '2024-04-11',
    dueDate: '2024-04-29', status: 'Menunggu', priority: 'Rendah',
    driverId: 4, driverName: 'Hendra Wijaya',
    schedule: 'Senin saja', cutoff: '13:00',
    deliveryDate: '2024-04-29', notes: 'Kirim Senin saja'
  },
];

export const PRIORITY_LOGS = [
  { invoiceNo: 'INV-2024-001', area: 'Jakarta Selatan', schedule: 'Senin-Jumat', cutoff: '09:00', predicted: 'Tinggi', actual: 'Tinggi', accuracy: true },
  { invoiceNo: 'INV-2024-002', area: 'Jakarta Pusat', schedule: 'Senin & Kamis', cutoff: '10:00', predicted: 'Tinggi', actual: 'Tinggi', accuracy: true },
  { invoiceNo: 'INV-2024-006', area: 'Jakarta Timur', schedule: 'Setiap Hari', cutoff: '15:00', predicted: 'Sedang', actual: 'Tinggi', accuracy: false },
  { invoiceNo: 'INV-2024-007', area: 'Karawang', schedule: 'Senin & Kamis', cutoff: '10:30', predicted: 'Tinggi', actual: 'Tinggi', accuracy: true },
];

export const WEEKLY_STATS = [
  { day: 'Sen', terkirim: 4, kembali: 1, menunggu: 3 },
  { day: 'Sel', terkirim: 6, kembali: 0, menunggu: 2 },
  { day: 'Rab', terkirim: 5, kembali: 2, menunggu: 4 },
  { day: 'Kam', terkirim: 8, kembali: 1, menunggu: 2 },
  { day: 'Jum', terkirim: 7, kembali: 0, menunggu: 3 },
  { day: 'Sab', terkirim: 3, kembali: 1, menunggu: 5 },
  { day: 'Min', terkirim: 2, kembali: 0, menunggu: 6 },
];

export const PRIORITY_DISTRIBUTION = [
  { name: 'Tinggi', value: 45, color: '#ef4444' },
  { name: 'Sedang', value: 33, color: '#f59e0b' },
  { name: 'Rendah', value: 22, color: '#10b981' },
];

// ─── Helper Functions ──────────────────────────────────────
export function getStatusBadgeClass(status) {
  switch (status) {
    case 'Dalam Pengiriman': return 'badge-indelivery';
    case 'Terkirim': return 'badge-delivered';
    case 'Menunggu': return 'badge-pending';
    case 'Kembali': return 'badge-returned';
    default: return 'badge-pending';
  }
}

export function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'Tinggi': return 'badge-high';
    case 'Sedang': return 'badge-medium';
    case 'Rendah': return 'badge-low';
    default: return 'badge-medium';
  }
}

export function getPriorityClass(priority) {
  switch (priority) {
    case 'Tinggi': return 'high';
    case 'Sedang': return 'medium';
    case 'Rendah': return 'low';
    default: return 'medium';
  }
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── C4.5 Simulation Logic ──────────────────────────────────
export function simulateC45Prediction(input) {
  const { area, jadwal, cutoff } = input;
  const hour = parseInt(cutoff?.split(':')[0] ?? 12);

  // Simple rule-based simulation of C4.5 decision tree
  if (hour <= 10) {
    // Very tight cutoff
    if (jadwal === 'Senin & Kamis' || jadwal === 'Senin saja' || jadwal === 'Selasa & Jumat') {
      return { priority: 'Tinggi', confidence: 0.94, reason: 'Cut-off ketat (≤10:00) + jadwal terbatas' };
    }
    return { priority: 'Tinggi', confidence: 0.91, reason: 'Cut-off pagi sangat ketat (≤10:00)' };
  } else if (hour <= 12) {
    if (jadwal === 'Senin & Kamis' || jadwal === 'Senin saja') {
      return { priority: 'Tinggi', confidence: 0.87, reason: 'Jadwal penerimaan sangat terbatas' };
    }
    return { priority: 'Sedang', confidence: 0.82, reason: 'Cut-off sedang, jadwal reguler' };
  } else {
    if (jadwal === 'Senin saja') {
      return { priority: 'Sedang', confidence: 0.78, reason: 'Jadwal Senin saja meski cut-off longgar' };
    }
    return { priority: 'Rendah', confidence: 0.89, reason: 'Cut-off longgar, jadwal fleksibel' };
  }
}
