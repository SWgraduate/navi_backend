import { Router } from "express";
import authRouter from "./auth.routes";
import chatRouter from "./chat.routes";
import systemRouter from "./system.routes";
import mockRouter from "./mock.routes";

export const apiRouter = Router();
export const indexRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/mock", mockRouter);
indexRouter.use("/", systemRouter);