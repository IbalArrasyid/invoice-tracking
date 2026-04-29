import api from './axios';

/**
 * driverService — endpoint /api/drivers
 */
const driverService = {
  async getAll() {
    const res = await api.get('/drivers');
    return res.data.data;
  },

  async getById(id) {
    const res = await api.get(`/drivers/${id}`);
    return res.data.data;
  },

  async create(data) {
    const res = await api.post('/drivers', data);
    return res.data.data;
  },

  async update(id, data) {
    const res = await api.put(`/drivers/${id}`, data);
    return res.data.data;
  },
};

export default driverService;
