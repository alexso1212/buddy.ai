// Centralized AI proxy configuration
// Change AI_BASE_URL env var to switch all AI calls at once
export const AI_BASE_URL = process.env.AI_BASE_URL || 'https://vip.aipro.love/v1';

// Base URL without /v1 suffix (for Anthropic SDK which appends its own path)
export const AI_BASE_URL_ROOT = AI_BASE_URL.replace(/\/v1\/?$/, '');

export const AI_API_KEY =
  process.env.CLAUDE_SIMPLE_API_KEY ||
  process.env.AI_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  '';

export const AI_COMPLEX_API_KEY =
  process.env.CLAUDE_COMPLEX_API_KEY ||
  process.env.AI_API_KEY ||
  '';

export const AI_DEFAULT_TIMEOUT = 90000;
export const AI_COMPLEX_TIMEOUT = 180000;
