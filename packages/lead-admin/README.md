# Lead and Admin Core

Provider-neutral Stage 7 core для контактной формы, OTP/CAPTCHA boundaries, лидов, событий, статусов, tenant limits, resume и RBAC.

Реальные Telegram, OTP, CAPTCHA, база данных и секреты не подключаются: интерфейсы заменены fake/in-memory adapters. Создание лида идемпотентно, событие уведомления не влияет на сохранение лида, а public role не имеет доступа к лидам и tenant settings.
