import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kavachRouter from "./kavach";
import tradeRouter from "./trade";

const router: IRouter = Router();

router.use(healthRouter);
router.use(kavachRouter);
router.use(tradeRouter);

export default router;
