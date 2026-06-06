import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import boardsRouter from "./boards";
import cardsRouter from "./cards";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(boardsRouter);
router.use(cardsRouter);

export default router;
