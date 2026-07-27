require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User, Customer, Driver, Invoice, PriorityLog } = require('../models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database terhubung');
    await sequelize.sync({ alter: true });
    console.log('✅ Model tersinkronisasi');

    // ─── Users ────────────────────────────────────────────────────
    const adminPass = await bcrypt.hash('admin123', 10);
    const staffPass = await bcrypt.hash('staff123', 10);
    const driverPass = await bcrypt.hash('driver123', 10);
    await User.bulkCreate([
      { name: 'Admin Utama',  email: 'admin@invoicetrack.id',  password: adminPass, role: 'admin' },
      { name: 'Staff Farah',  email: 'farah@invoicetrack.id',  password: staffPass, role: 'staff' },
      { name: 'Driver Budi Santoso', email: 'driver@invoicetrack.id', password: driverPass, role: 'driver' },
    ], { ignoreDuplicates: true });
    console.log('✅ Users seeded');

    // ─── Customers ────────────────────────────────────────────────
    await Customer.bulkCreate([
      { id: 1, name: 'PT Maju Bersama',   area: 'Jakarta Pusat',   schedule: 'Senin & Kamis',   cutoff: '10:00', contact: 'Bu Siti'   },
      { id: 2, name: 'CV Karya Utama',    area: 'Bekasi',          schedule: 'Setiap Hari',      cutoff: '14:00', contact: 'Pak Joko'  },
      { id: 3, name: 'PT Sumber Rejeki',  area: 'Tangerang',       schedule: 'Senin-Jumat',      cutoff: '12:00', contact: 'Bu Dewi'   },
      { id: 4, name: 'UD Makmur Jaya',    area: 'Depok',           schedule: 'Selasa & Jumat',   cutoff: '11:00', contact: 'Pak Andi'  },
      { id: 5, name: 'PT Indo Raya',      area: 'Jakarta Selatan', schedule: 'Senin-Jumat',      cutoff: '09:00', contact: 'Bu Rina'   },
      { id: 6, name: 'CV Harmoni',        area: 'Bogor',           schedule: 'Senin saja',       cutoff: '13:00', contact: 'Pak Sutomo'},
      { id: 7, name: 'PT Nusantara',      area: 'Jakarta Timur',   schedule: 'Setiap Hari',      cutoff: '15:00', contact: 'Bu Lastri' },
      { id: 8, name: 'UD Sejahtera',      area: 'Karawang',        schedule: 'Senin & Kamis',    cutoff: '10:30', contact: 'Pak Bambang'},
    ], { ignoreDuplicates: true });
    console.log('✅ Customers seeded');

    // ─── Drivers ──────────────────────────────────────────────────
    await Driver.bulkCreate([
      { id: 1, name: 'Budi Santoso',   phone: '0812-3456-7890', area: 'Jakarta Pusat - Jakarta Selatan' },
      { id: 2, name: 'Agus Prasetyo',  phone: '0821-9876-5432', area: 'Bekasi - Karawang'               },
      { id: 3, name: 'Rizky Darmawan', phone: '0856-1234-5678', area: 'Tangerang - Jakarta Barat'       },
      { id: 4, name: 'Hendra Wijaya',  phone: '0878-2345-6789', area: 'Depok - Bogor'                   },
    ], { ignoreDuplicates: true });
    console.log('✅ Drivers seeded');

    // ─── Invoices ─────────────────────────────────────────────────
    await Invoice.bulkCreate([
      { id: 1, invoiceNo: 'INV-2024-001', customerId: 5, driverId: 1, amount: 12500000, date: '2024-04-18', dueDate: '2024-04-25', status: 'Dalam Pengiriman', priority: 'Tinggi',  schedule: 'Senin-Jumat',    cutoff: '09:00', deliveryDate: '2024-04-24', notes: 'Harus sebelum jam 09.00' },
      { id: 2, invoiceNo: 'INV-2024-002', customerId: 1, driverId: 1, amount:  8750000, date: '2024-04-17', dueDate: '2024-04-24', status: 'Dalam Pengiriman', priority: 'Tinggi',  schedule: 'Senin & Kamis',  cutoff: '10:00', deliveryDate: '2024-04-24', notes: 'Hari pengiriman: Senin/Kamis' },
      { id: 3, invoiceNo: 'INV-2024-003', customerId: 4, driverId: 4, amount:  5200000, date: '2024-04-16', dueDate: '2024-04-26', status: 'Menunggu',         priority: 'Sedang',  schedule: 'Selasa & Jumat', cutoff: '11:00', deliveryDate: '2024-04-26', notes: 'Kirim Selasa/Jumat saja' },
      { id: 4, invoiceNo: 'INV-2024-004', customerId: 3, driverId: 3, amount: 15600000, date: '2024-04-15', dueDate: '2024-04-28', status: 'Menunggu',         priority: 'Sedang',  schedule: 'Senin-Jumat',    cutoff: '12:00', deliveryDate: '2024-04-25', notes: '' },
      { id: 5, invoiceNo: 'INV-2024-005', customerId: 2, driverId: 2, amount:  3400000, date: '2024-04-14', dueDate: '2024-04-30', status: 'Menunggu',         priority: 'Rendah',  schedule: 'Setiap Hari',    cutoff: '14:00', deliveryDate: '2024-04-30', notes: '' },
      { id: 6, invoiceNo: 'INV-2024-006', customerId: 7, driverId: 1, amount: 22000000, date: '2024-04-13', dueDate: '2024-04-20', status: 'Terkirim',         priority: 'Tinggi',  schedule: 'Setiap Hari',    cutoff: '15:00', deliveryDate: '2024-04-19', deliveredAt: '2024-04-19T14:32:00', notes: 'Terkirim tepat waktu' },
      { id: 7, invoiceNo: 'INV-2024-007', customerId: 8, driverId: 2, amount:  9100000, date: '2024-04-12', dueDate: '2024-04-22', status: 'Kembali',          priority: 'Tinggi',  schedule: 'Senin & Kamis',  cutoff: '10:30', deliveryDate: '2024-04-18', notes: 'Penerima tidak di tempat, kembali ke kantor' },
      { id: 8, invoiceNo: 'INV-2024-008', customerId: 6, driverId: 4, amount:  6750000, date: '2024-04-11', dueDate: '2024-04-29', status: 'Menunggu',         priority: 'Rendah',  schedule: 'Senin saja',     cutoff: '13:00', deliveryDate: '2024-04-29', notes: 'Kirim Senin saja' },
    ], { ignoreDuplicates: true });
    console.log('✅ Invoices seeded');

    // ─── Priority Logs ────────────────────────────────────────────
    await PriorityLog.bulkCreate([
      { invoiceNo: 'INV-2024-001', area: 'Jakarta Selatan', schedule: 'Senin-Jumat',    cutoff: '09:00', predicted: 'Tinggi', actual: 'Tinggi', accuracy: true,  confidence: 0.91 },
      { invoiceNo: 'INV-2024-002', area: 'Jakarta Pusat',   schedule: 'Senin & Kamis',  cutoff: '10:00', predicted: 'Tinggi', actual: 'Tinggi', accuracy: true,  confidence: 0.94 },
      { invoiceNo: 'INV-2024-006', area: 'Jakarta Timur',   schedule: 'Setiap Hari',    cutoff: '15:00', predicted: 'Sedang', actual: 'Tinggi', accuracy: false, confidence: 0.82 },
      { invoiceNo: 'INV-2024-007', area: 'Karawang',        schedule: 'Senin & Kamis',  cutoff: '10:30', predicted: 'Tinggi', actual: 'Tinggi', accuracy: true,  confidence: 0.94 },
    ], { ignoreDuplicates: true });
    console.log('✅ PriorityLogs seeded');

    console.log('\n🎉 Seeding selesai!');
    console.log('   Login: admin@invoicetrack.id / admin123');
    console.log('   Login: farah@invoicetrack.id / staff123');
    console.log('   Login: driver@invoicetrack.id / driver123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error saat seeding:', err.message);
    process.exit(1);
  }
}

seed();
