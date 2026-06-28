import axios from 'axios';

const api = axios.create({ 
  baseURL: 'https://env-secret-leak-detector-production.up.railway.app/api' 
});

export const startScan   = (repoPath) => api.post('/scan', { repoPath });
export const getResult   = (scanId)   => api.get(`/results/${scanId}`);
export const getAllScans  = ()         => api.get('/scans');
export const deleteScan  = (scanId)   => api.delete(`/scans/${scanId}`);