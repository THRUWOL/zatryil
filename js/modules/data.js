import { CONFIG } from './config.js';

/**
 * Модуль для загрузки данных с retry-логикой
 */

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}) {
  const { maxAttempts = CONFIG.RETRY.MAX_ATTEMPTS, delayMs = CONFIG.RETRY.DELAY_MS } = options;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(`Попытка ${attempt} не удалась: ${url}. Повтор через ${delayMs}мс...`);
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

export async function loadJsonData(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  return response.json();
}

export async function loadData() {
  try {
    const [questionsResponse, practiceResponse] = await Promise.all([
      fetchWithRetry(CONFIG.DATA_URLS.QUESTIONS),
      fetchWithRetry(CONFIG.DATA_URLS.PRACTICE),
    ]);

    if (!questionsResponse.ok || !practiceResponse.ok) {
      throw new Error(
        'Не удалось загрузить data/*.json — откройте сайт через локальный сервер или GitHub Pages, не как file://'
      );
    }

    const [theory, practice] = await Promise.all([
      questionsResponse.json(),
      practiceResponse.json(),
    ]);

    return { theory, practice };
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    throw error;
  }
}

export default {
  fetchWithRetry,
  loadJsonData,
  loadData,
};
