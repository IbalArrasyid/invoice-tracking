const mysql = require('mysql2/promise');
require('dotenv').config();

async function createDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
    });

    console.log('Koneksi ke MySQL berhasil. Mengecek database...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'invoice_tracking'}\`;`);
    console.log(`Database '${process.env.DB_NAME || 'invoice_tracking'}' berhasil disiapkan.`);
    
    await connection.end();
  } catch (error) {
    console.error('Gagal membuat database:', error.message);
    process.exit(1);
  }
}

createDatabase();
