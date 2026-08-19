export type LengthUnit = "mm" | "cm" | "m";

/**
 * Нормализует размер в целые миллиметры.
 *
 * Принимает число или строку (LLM/STT часто возвращают «2.7» или «два семьдесят»→"2.7").
 * Артефакты плавающей точки (например, 1.005 м → 1004.9999…) округляются с
 * допуском 1e-6; по-настоящему дробные миллиметры отклоняются.
 */
export function toMillimetres(value: number | string, unit: LengthUnit): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Размер должен быть положительным конечным числом.");
  }
  const factor = unit === "mm" ? 1 : unit === "cm" ? 10 : 1000;
  const result = parsed * factor;
  if (Number.isInteger(result)) return result;
  const rounded = Math.round(result);
  if (Math.abs(result - rounded) > 1e-6) {
    throw new Error("Размер должен выражаться целым числом миллиметров.");
  }
  return rounded;
}
