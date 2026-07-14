import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kavachRouter from "./kavach";

const router: IRouter = Router();

router.use(healthRouter);
router.use(kavachRouter);

export default router;
