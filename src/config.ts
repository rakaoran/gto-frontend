// src/config.ts
export const API_BASE_URL = 'https://api.gto.rakaoran.dev';

export const endpoints = {
  // Matched to api/internal/authentication/route.go
  login: `${API_BASE_URL}/authentication/login`,
  signup: `${API_BASE_URL}/authentication/signup`,
  logout: `${API_BASE_URL}/authentication/logout`,
};