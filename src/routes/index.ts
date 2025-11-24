import { Router } from "express";
import systemRouter from "./system.routes";
import mockRouter from "./mock.routes";

export const apiRouter = Router();
export const indexRouter = Router();

apiRouter.use("/mock", mockRouter);
indexRouter.use("/", systemRouter);