/**
 * Create an Express middleware that validates req.body against a Zod schema.
 * Strips error details in production to avoid information leakage.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request',
        ...(process.env.NODE_ENV !== 'production' && { details: result.error.flatten() }),
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validate query parameters against a Zod schema.
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    req.query = result.data;
    next();
  };
}
