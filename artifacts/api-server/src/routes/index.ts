import { Router, type IRouter } from "express";
import healthRouter from "./health";
import schoolErpRouter from "./school-erp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(schoolErpRouter);

export default router;
