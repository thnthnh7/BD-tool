export async function retryMcpAuditWrite(write: () => Promise<{ error: { message: string } | null }>, wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))) {
  let lastError = "Unknown audit persistence error.";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { error } = await write();
    if (!error) return;
    lastError = error.message;
    if (attempt < 3) await wait(attempt * 50);
  }
  throw new Error(lastError);
}
