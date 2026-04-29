import api from './axios';

/**
 * customerService — endpoint /api/customers
 */
const customerService = {
  async getAll() {
    const res = await api.get('/customers');
    return res.data.data;
  },

  async getById(id) {
    const res = await api.get(`/customers/${id}`);
    return res.data.data;
  },

  /**
   * @param {{ name, area, schedule, cutoff, contact?, phone?, address? }} data
   */
  async create(data) {
    const res = await api.post('/customers', data);
    return res.data.data;
  },

  async update(id, data) {
    const res = await api.put(`/customers/${id}`, data);
    return res.data.data;
  },

  async remove(id) {
    const res = await api.delete(`/customers/${id}`);
    return res.data;
  },
};

export default customerService;
