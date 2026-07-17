export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createPublicId() {
  return `q_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
