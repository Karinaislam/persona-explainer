export const isKey = (k: unknown): k is string => typeof k === 'string' && /^[0-9a-f]{12}$/.test(k)

export const bad = (error: string, status = 400) => Response.json({ error }, { status })
