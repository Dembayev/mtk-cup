# Деплой Edge Function для синхронизации аватарок

## Шаг 1: Установка Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# или через npm
npm install -g supabase
```

## Шаг 2: Логин в Supabase

```bash
supabase login
```

## Шаг 3: Привязка проекта

```bash
cd mtk-cup
supabase link --project-ref ecayfpszkleyxuhsekhu
```

## Шаг 4: Добавление секрета (токен бота)

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=<твой_токен_бота>
```

Токен бота можно получить у @BotFather в Telegram.

## Шаг 5: Деплой функции

```bash
supabase functions deploy sync-avatar
```

## Шаг 6: Проверка

После деплоя функция будет доступна по адресу:
```
https://ecayfpszkleyxuhsekhu.supabase.co/functions/v1/sync-avatar
```

Можно протестировать через curl:
```bash
curl -X POST https://ecayfpszkleyxuhsekhu.supabase.co/functions/v1/sync-avatar \
  -H "Content-Type: application/json" \
  -d '{"telegram_id": 123456789}'
```

## Важно

- Функция вызывается автоматически при каждом входе пользователя в Mini App
- Аватарка синхронизируется в фоне, не блокируя вход
- URL аватарки через Bot API может истечь через некоторое время, поэтому синхронизация происходит при каждом входе
