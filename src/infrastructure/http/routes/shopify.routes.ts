import { Router } from "express";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";
import { ShopifyWebhookSecurity } from "../../shopify/ShopifyWebhookSecurity";

const router = Router();

const secret = process.env.SHOPIFY_API_SECRET || "dummy_shopify_secret_please_change_in_production";
if (!process.env.SHOPIFY_API_SECRET) {
  console.warn("WARNING: SHOPIFY_API_SECRET environment variable is not set. Using insecure development default secret. Please configure SHOPIFY_API_SECRET in production.");
}

const security = new ShopifyWebhookSecurity(secret);
const controller = new ShopifyWebhookController(security);

router.post("/webhooks/orders/create", (req, res) => controller.handleOrderCreated(req, res));

export default router;
