import { Request, Response, NextFunction } from "express";

export async function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = req.user as any;
  
  if (!user.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}
