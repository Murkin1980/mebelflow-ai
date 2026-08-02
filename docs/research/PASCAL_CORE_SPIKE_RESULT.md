# Pascal Core Spike Result

**Дата:** 2026-08-02  
**Проверенная версия:** `@pascal-app/core@0.9.2`  
**Решение:** **ADAPT**

## Результаты

| Проверка | Результат |
|---|---|
| Публичный пакет | Да |
| Лицензия | MIT |
| Unpacked size | 2 224 399 байт |
| Browser bundle (`useScene`, minified) | 472 465 байт |
| Renderer/WebGPU обязателен | Нет для сборки core; peer-зависимости React/Three объявлены |
| Прямой Node ESM import | Не прошёл: extensionless internal import `dist/events/bus` |
| Изоляция через adapter | Возможна |
| Android smoke | Не выполнен: UI отсутствует |

## Вывод

Не включать Pascal Core в runtime первого MVP. Для доменного ядра его вес и peer-зависимости не оправданы, а прямой ESM-import версии 0.9.2 воспроизводимо ломается в Node 22. Использовать идеи node CRUD, metadata и history через собственный `SceneStoreAdapter` и pure reducer.

Повторно рассмотреть пакет только после появления реального viewer-сценария и отдельного browser/Android benchmark.

## Воспроизведение

```powershell
npm.cmd install --prefix spikes/pascal-core --legacy-peer-deps
npm.cmd run spike --prefix spikes/pascal-core
```
