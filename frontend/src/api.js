export const API = (p) => `http://localhost:3001/api${p}`;
export const ASSET = (p) => {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return `http://localhost:3001${p.startsWith('/') ? p : '/' + p}`;
};
