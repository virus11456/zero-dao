import { Request, Response, NextFunction } from 'express';

/**
 * API key authentication middleware.
 *
 * Checks for a valid API key in one of:
 *   - Authorization: Bearer <key>
 *   - X-API-Key: <key>
 *
 * Configure via API_KEY environment variable.
 * If API_KEY is not set, auth is disabled (development mode).
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY;

  // If no API_KEY configured, skip auth (dev mode)
  if (!apiKey) {
    next();
    return;
  }

  // Extract key from headers
  const authHeader = req.headers.authorization;
  const xApiKey = req.headers['x-api-key'] as string | undefined;

  let providedKey: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7);
  } else if (xApiKey) {
    providedKey = xApiKey;
  }

  if (!providedKey || providedKey !== apiKey) {
    res.status(401).json({ error: 'Unauthorized — invalid or missing API key' });
    return;
  }

  next();
}
