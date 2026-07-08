/* Конфиг подключения. Пустые значения = ДЕМО-режим (данные в браузере).
   После встречи: создаём проект Supabase (EU) → сюда URL и anon-ключ →
   приложение автоматически работает с настоящей базой.
   ВАЖНО: anon-ключ публичный по дизайну (безопасность держат RLS-политики
   в базе — см. docs/sprint1-schema.sql); service-ключ сюда не класть НИКОГДА. */
window.APP_CONFIG = {
  SUPABASE_URL: '',        // напр. 'https://xxxx.supabase.co' (или наш домен-прокси)
  SUPABASE_ANON_KEY: '',   // Settings → API → anon public
};
