import { Router } from "express";
import { adminRouter } from "./admin.js";
import { assistantRouter } from "./assistant.js";
import { commuteRouter } from "./commute.js";
import { feedbackRouter } from "./feedback.js";
import { localitiesRouter } from "./localities.js";
import { propertiesRouter } from "./properties.js";
import { recommendationsRouter } from "./recommendations.js";
import { searchRouter } from "./search.js";
import { seoRouter } from "./seo.js";
import { transitRouter } from "./transit.js";

export const apiRouter = Router();

apiRouter.use("/search", searchRouter);
apiRouter.use("/properties", propertiesRouter);
apiRouter.use("/localities", localitiesRouter);
apiRouter.use("/commute", commuteRouter);
apiRouter.use("/transit", transitRouter);
apiRouter.use("/feedback", feedbackRouter);
apiRouter.use("/assistant", assistantRouter);
apiRouter.use("/recommendations", recommendationsRouter);
apiRouter.use("/seo", seoRouter);
apiRouter.use("/admin", adminRouter);




