/** Convert a label into a backend-valid snake_case field key (^[a-z][a-z0-9_]*$). */
export function slugifyKey(label: string): string {
  let key = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (key && !/^[a-z]/.test(key)) key = "f_" + key;
  return key;
}
