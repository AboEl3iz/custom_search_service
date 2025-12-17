import { Request, Response } from 'express';
import {createSearchEngine} from '../search/search.factory'
import { normalizeQuery } from "../utils/normalize";

const engine = createSearchEngine();

export const search = async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query as { q?: string };

  if (!q) {
    res.status(400).json({ error: "Query param q is required" });
    return;
  }

  const normalized = normalizeQuery(q);
  const result = await engine.search(normalized);

  res.json(result);
};
