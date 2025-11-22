// src/config.ts
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.rakaoran.dev';

export const endpoints = {
  // Matched to api/internal/authentication/route.go
  login: `${API_BASE_URL}/authentication/login`,
  signup: `${API_BASE_URL}/authentication/signup`,
};