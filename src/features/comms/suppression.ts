const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseSuppressionEmails(input: string, limit = 500) {
  const candidates = [...new Set(input.slice(0, 50_000).split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
  return {
    emails: candidates.filter((email) => EMAIL.test(email)),
    invalid: candidates.filter((email) => !EMAIL.test(email)),
    tooMany: candidates.length > limit,
  };
}
