import axios from 'axios';

const api = axios.create({
  baseURL: 'https://env-secret-leak-detector-production.up.railway.app/api'
});

// payload can be { repoPath } or { githubUrl }
export const startScan   = (payload)  => api.post('/scan', payload);
export const getResult   = (scanId)   => api.get(`/results/${scanId}`);
export const getAllScans  = ()         => api.get('/scans');
export const deleteScan  = (scanId)   => api.delete(`/scans/${scanId}`);
