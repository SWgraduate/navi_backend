import { Router } from "express";
import mockRouter from "./mock.routes";

const router = Router();

router.use("/mock", mockRouter);

export default router;
