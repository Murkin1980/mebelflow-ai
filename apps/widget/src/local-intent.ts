export type LocalWallWidthIntent = {
  command: {
    commandId: string;
    type: "SET_WALL_WIDTH";
    payload: { width: number };
  };
  explanation: string;
};

export function parseLocalWallWidth(utterance: string): LocalWallWidthIntent | null {
  const text = utterance.trim().toLocaleLowerCase("ru-RU");
  const meters = text.match(/(\d+(?:[.,]\d+)?)\s*(?:м(?:етр(?:а|ов)?)?)(?!м)/iu);
  const millimeters = text.match(/(\d{4})\s*мм/iu);
  const width = meters
    ? Math.round(Number(meters[1].replace(",", ".")) * 1_000)
    : millimeters
      ? Number(millimeters[1])
      : null;

  if (width === null || !Number.isInteger(width) || width < 1_200 || width > 7_000) return null;
  if (!/(?:кухн|стен|длин|ширин|размер)/iu.test(text)) return null;

  return {
    command: {
      commandId: `local-wall-${width}-${Date.now()}`,
      type: "SET_WALL_WIDTH",
      payload: { width },
    },
    explanation: `Длина стены установлена: ${width} мм. Теперь добавьте мойку и технику.`,
  };
}
