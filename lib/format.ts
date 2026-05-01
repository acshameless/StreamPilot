export function linesToArray(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function arrayToLines(arr: string[]): string {
  return arr.join("\n");
}
