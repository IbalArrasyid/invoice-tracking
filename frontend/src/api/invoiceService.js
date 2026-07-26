import api from './axios';

/**
 * invoiceService — endpoint /api/invoices
 */
const invoiceService = {
  /**
   * Ambil semua invoice dengan filter opsional
   * @param {{ status?, priority?, search?, page?, limit? }} params
   */
  async getAll(params = {}) {
    const res = await api.get('/invoices', { params });
    return res.data; // { success, data, meta }
  },

  /**
   * Ambil satu invoice by ID
   * @param {number|string} id
   */
  async getById(id) {
    const res = await api.get(`/invoices/${id}`);
    return res.data.data;
  },

  /**
   * Tambah invoice baru
   * @param {{ customerId, driverId, amount, date, dueDate, status, priority,
   *            schedule, cutoff, deliveryDate, notes, invoiceNo? }} data
   */
  async create(data) {
    const res = await api.post('/invoices', data);
    return res.data.data;
  },

  /**
   * Bulk input invoice dari daftar Excel/CSV yang sudah diparse di frontend.
   * @param {Array<object>} rows
   */
  async bulkCreate(rows) {
    const res = await api.post('/invoices/bulk', { rows }, { timeout: 60000 });
    return res.data.data;
  },

  /**
   * Update invoice
   * @param {number|string} id
   * @param {object} data
   */
  async update(id, data) {
    const res = await api.put(`/invoices/${id}`, data);
    return res.data.data;
  },

  /**
   * Hapus invoice
   * @param {number|string} id
   */
  async remove(id) {
    const res = await api.delete(`/invoices/${id}`);
    return res.data;
  },
};

export default invoiceService;
