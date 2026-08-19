# Brief Generator

Stage 8 core формирует неизменяемую модель предварительного ТЗ: tenant branding, контакт, SVG-схема, размеры, модули, стиль, диапазон KZT, предупреждения и обязательный disclaimer.

Политики `free`, `after_contact`, `after_order`, `paid`, `credited_to_order` проверяются до выдачи. Платёж, renderer и storage являются внешними adapters. Secure download grants ограничены tenant и временем, поддерживают revocation и append-only audit.
