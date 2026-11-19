import type { NextFunction, Request, Response } from 'express';

export function journal(req: Request, res: Response, next: NextFunction) {
  const debut = process.hrtime.bigint();
  res.on('finish', () => {
    const duree = Number(process.hrtime.bigint() - debut) / 1e6;
    if (process.env.NODE_ENV !== 'test') console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${duree.toFixed(1)}ms`);
  });
  next();
}
