/* Публичная конфигурация фронта grafik.one (деплой-репозиторий).
   SUPABASE_ANON_KEY — publishable/anon-ключ: публичный по дизайну (его и так отдаёт
   браузер каждому посетителю сайта; доступ к данным держат RLS-политики в базе).
   Service-ключ (secret) здесь НЕ хранится и не должен появляться НИКОГДА. */
window.APP_CONFIG = {
  SUPABASE_URL: 'https://jytkpulopcqtmktygejs.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_9u-M2UXBrlDHriT93w7cSw_KGPgRWqq',
};
