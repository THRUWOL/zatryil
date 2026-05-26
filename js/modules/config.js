/**
 * Конфигурация приложения
 */
export const CONFIG = {
  // Хранилище localStorage
  STORAGE_KEYS: {
    LEARNED: "jm_learned",
    FAVORITE: "jm_favorite",
    RECENT: "jm_recent",
    THEME: "pet_theme",
  },
  
  // Лимиты
  RECENT_MAX: 10,
  TOAST_DURATION: 2200,
  
  // Поиск Fuse.js
  SEARCH: {
    THRESHOLD: 0.38,
    DEBOUNCE_MS: 200,
    MIN_TERM_LENGTH: 2,
    SNIPPET_LENGTH: 140,
    PRACTICE_SNIPPET_LENGTH: 160,
  },
  
  // Исключённые блоки (ID)
  EXCLUDED_BLOCKS: [12],
  
  // URL для данных
  DATA_URLS: {
    QUESTIONS: "data/questions.json",
    PRACTICE: "data/practice.json",
  },
  
  // Retry параметры
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1000,
  },
};

export default CONFIG;
