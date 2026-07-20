import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { Logger } from "./infrastructure/logging/logger";
import { PrismaInventoryRepository } from "./infrastructure/database/PrismaInventoryRepository";
import { PrismaBarcodeRepository } from "./infrastructure/database/PrismaBarcodeRepository";
import { PrismaSerializedItemRepository } from "./infrastructure/database/PrismaSerializedItemRepository";
import { PrismaCostLayerRepository } from "./infrastructure/database/PrismaCostLayerRepository";
import { PrismaJournalRepository } from "./infrastructure/database/PrismaJournalRepository";
import { prisma } from "./infrastructure/database/prisma";
import { enableRowLevelSecurity } from "./infrastructure/database/rls";
import { PostgresInventoryRepository } from "./infrastructure/database/PostgresInventoryRepository";
import { IInventoryRepository } from "./domain/repositories/IInventoryRepository";
import inventoryRoutes from "./infrastructure/http/routes/inventory.routes";
import shopifyRoutes from "./infrastructure/http/routes/shopify.routes";
import onboardingRoutes from "./infrastructure/http/routes/onboarding.routes";
import { DomainEventDispatcher } from "./domain/events/DomainEventDispatcher";
import { alertPurchasingOnStockDepleted } from "./application/eventHandlers/AlertPurchasingOnStockDepleted";
import { syncJournalToQuickBooks } from "./application/eventHandlers/SyncJournalToQuickBooks";
import { syncJournalToNetSuite } from "./application/eventHandlers/SyncJournalToNetSuite";
import { syncJournalToXero } from "./application/eventHandlers/SyncJournalToXero";

import { IBarcodeRepository } from "./domain/repositories/IBarcodeRepository";
import { ISerializedItemRepository } from "./domain/repositories/ISerializedItemRepository";
import { ICostLayerRepository } from "./domain/repositories/ICostLayerRepository";
import { IJournalRepository } from "./domain/repositories/IJournalRepository";
import { ITenantConfigRepository } from "./domain/repositories/ITenantConfigRepository";
import { IProcessedWebhookRepository } from "./domain/repositories/IProcessedWebhookRepository";
import { IOutboxRepository } from "./domain/repositories/IOutboxRepository";

import { InMemoryBarcodeRepository } from "./infrastructure/database/InMemoryBarcodeRepository";
import { InMemoryInventoryRepository } from "./infrastructure/database/InMemoryInventoryRepository";
import { InMemorySerializedItemRepository } from "./infrastructure/database/InMemorySerializedItemRepository";
import { InMemoryCostLayerRepository } from "./infrastructure/database/InMemoryCostLayerRepository";
import { InMemoryJournalRepository } from "./infrastructure/database/InMemoryJournalRepository";
import { InMemoryTenantConfigRepository } from "./infrastructure/database/InMemoryTenantConfigRepository";
import { PrismaTenantConfigRepository } from "./infrastructure/database/PrismaTenantConfigRepository";
import { InMemoryProcessedWebhookRepository } from "./infrastructure/database/InMemoryProcessedWebhookRepository";
import { PrismaProcessedWebhookRepository } from "./infrastructure/database/PrismaProcessedWebhookRepository";
import { InMemoryOutboxRepository } from "./infrastructure/database/InMemoryOutboxRepository";
import { PrismaOutboxRepository } from "./infrastructure/database/PrismaOutboxRepository";
import { OutboxProcessor } from "./infrastructure/outbox/OutboxProcessor";
import { WebhookDeliveryWorker } from "./infrastructure/workers/WebhookDeliveryWorker";
import { IMessageBroker } from "./application/ports/IMessageBroker";
import { InMemoryMessageBroker } from "./infrastructure/messaging/InMemoryMessageBroker";
import { RabbitMQMessageBroker } from "./infrastructure/messaging/RabbitMQMessageBroker";
import { KafkaMessageBroker } from "./infrastructure/messaging/KafkaMessageBroker";

import barcodeRoutes from "./infrastructure/http/routes/barcode.routes";
import serialRoutes from "./infrastructure/http/routes/serial.routes";
import kitRoutes from "./infrastructure/http/routes/kit.routes";
import accountingRoutes from "./infrastructure/http/routes/accounting.routes";
import purchaseOrderRoutes from "./infrastructure/http/routes/purchaseOrder.routes";
import { IPurchaseOrderRepository } from "./domain/repositories/IPurchaseOrderRepository";
import { PrismaPurchaseOrderRepository } from "./infrastructure/database/PrismaPurchaseOrderRepository";
import { InMemoryPurchaseOrderRepository } from "./infrastructure/database/InMemoryPurchaseOrderRepository";
import reorderPolicyRoutes from "./infrastructure/http/routes/reorderPolicy.routes";
import { IReorderPolicyRepository } from "./domain/repositories/IReorderPolicyRepository";
import { PrismaReorderPolicyRepository } from "./infrastructure/database/PrismaReorderPolicyRepository";
import { InMemoryReorderPolicyRepository } from "./infrastructure/database/InMemoryReorderPolicyRepository";
import { ReorderPolicyService } from "./domain/procurement/services/ReorderPolicyService";
import inventoryAuditRoutes from "./infrastructure/http/routes/inventoryAudit.routes";
import { IInventoryAuditRepository } from "./domain/repositories/IInventoryAuditRepository";
import { PrismaInventoryAuditRepository } from "./infrastructure/database/PrismaInventoryAuditRepository";
import { InMemoryInventoryAuditRepository } from "./infrastructure/database/InMemoryInventoryAuditRepository";
import rmaRoutes from "./infrastructure/http/routes/rma.routes";
import quarantineRoutes from "./infrastructure/http/routes/quarantine.routes";
import outboxRoutes from "./infrastructure/http/routes/outbox.routes";
import { IRMARepository } from "./domain/repositories/IRMARepository";
import { IQuarantineRepository } from "./domain/repositories/IQuarantineRepository";
import { PrismaRMARepository } from "./infrastructure/database/PrismaRMARepository";
import { InMemoryRMARepository } from "./infrastructure/database/InMemoryRMARepository";
import { PrismaQuarantineRepository } from "./infrastructure/database/PrismaQuarantineRepository";
import { InMemoryQuarantineRepository } from "./infrastructure/database/InMemoryQuarantineRepository";
import { IDispatchRecordRepository } from "./domain/repositories/IDispatchRecordRepository";
import { IDemandForecastRepository } from "./domain/repositories/IDemandForecastRepository";
import { PrismaDispatchRecordRepository } from "./infrastructure/database/PrismaDispatchRecordRepository";
import { InMemoryDispatchRecordRepository } from "./infrastructure/database/InMemoryDispatchRecordRepository";
import { PrismaDemandForecastRepository } from "./infrastructure/database/PrismaDemandForecastRepository";
import { InMemoryDemandForecastRepository } from "./infrastructure/database/InMemoryDemandForecastRepository";
import forecastingRoutes from "./infrastructure/http/routes/forecasting.routes";
import { IShipmentRepository } from "./domain/repositories/IShipmentRepository";
import { ICarrierService } from "./application/ports/ICarrierService";
import { PrismaShipmentRepository } from "./infrastructure/database/PrismaShipmentRepository";
import { InMemoryShipmentRepository } from "./infrastructure/database/InMemoryShipmentRepository";
import { MockCarrierService } from "./infrastructure/shipping/MockCarrierService";
import shippingRoutes from "./infrastructure/http/routes/shipping.routes";
import authRoutes from "./infrastructure/http/routes/auth.routes";
import userRoutes from "./infrastructure/http/routes/user.routes";
import warehouseLocationRoutes from "./infrastructure/http/routes/warehouseLocation.routes";
import notificationRoutes from "./infrastructure/http/routes/notification.routes";
import auditRoutes from "./infrastructure/http/routes/audit.routes";
import webhookSubscriptionRoutes from "./infrastructure/http/routes/webhookSubscription.routes";
import complianceRoutes from "./infrastructure/http/routes/compliance.routes";
import { WebSocketManager } from "./infrastructure/websocket/WebSocketManager";
import { authMiddleware } from "./infrastructure/http/middleware/auth";
import { IWarehouseLocationRepository } from "./domain/repositories/IWarehouseLocationRepository";
import { IProductRepository } from "./domain/repositories/IProductRepository";
import { InMemoryWarehouseLocationRepository } from "./infrastructure/database/InMemoryWarehouseLocationRepository";
import { InMemoryProductRepository } from "./infrastructure/database/InMemoryProductRepository";
import { PrismaWarehouseLocationRepository } from "./infrastructure/database/PrismaWarehouseLocationRepository";
import { PrismaProductRepository } from "./infrastructure/database/PrismaProductRepository";
import { WMSCapacityService } from "./domain/services/WMSCapacityService";

import { traceMiddleware } from "./infrastructure/http/middleware/traceMiddleware";

const app = express();
app.disable("x-powered-by");
const port = 3000;

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map(url => url.trim().replace(/\/$/, ""))
  : ["http://localhost:3080"];

const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : 15 * 60 * 1000, // 15 minutes default
  limit: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100, // Limit each IP to 100 requests per `window` default
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(traceMiddleware);
app.set("trust proxy", 1);
app.use(limiter);
app.use("/api/shopify", express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.json());

// Register Domain Event Handlers
DomainEventDispatcher.register("StockDepletedEvent", alertPurchasingOnStockDepleted);
DomainEventDispatcher.register("JournalEntryCreatedEvent", syncJournalToQuickBooks);
DomainEventDispatcher.register("JournalEntryCreatedEvent", syncJournalToNetSuite);
DomainEventDispatcher.register("JournalEntryCreatedEvent", syncJournalToXero);

// Define setup function so E2E tests can configure app with custom repository
export const setupApp = (
  inventoryRepository: IInventoryRepository,
  barcodeRepository?: IBarcodeRepository,
  serializedItemRepository?: ISerializedItemRepository,
  costLayerRepository?: ICostLayerRepository,
  journalRepository?: IJournalRepository,
  tenantConfigRepository?: ITenantConfigRepository,
  processedWebhookRepository?: IProcessedWebhookRepository,
  outboxRepository?: IOutboxRepository,
  purchaseOrderRepository?: IPurchaseOrderRepository,
  reorderPolicyRepository?: IReorderPolicyRepository,
  reorderPolicyService?: ReorderPolicyService,
  inventoryAuditRepository?: IInventoryAuditRepository,
  rmaRepository?: IRMARepository,
  quarantineRepository?: IQuarantineRepository,
  messageBroker?: IMessageBroker,
  dispatchRecordRepository?: IDispatchRecordRepository,
  demandForecastRepository?: IDemandForecastRepository,
  shipmentRepository?: IShipmentRepository,
  carrierService?: ICarrierService,
  warehouseLocationRepository?: IWarehouseLocationRepository,
  productRepository?: IProductRepository
) => {
  app.set("inventoryRepository", inventoryRepository);
  app.set("barcodeRepository", barcodeRepository || new InMemoryBarcodeRepository());
  app.set("serializedItemRepository", serializedItemRepository || new InMemorySerializedItemRepository());
  app.set("costLayerRepository", costLayerRepository || new InMemoryCostLayerRepository());
  app.set("journalRepository", journalRepository || new InMemoryJournalRepository());
  app.set("tenantConfigRepository", tenantConfigRepository || new InMemoryTenantConfigRepository());
  app.set("processedWebhookRepository", processedWebhookRepository || new InMemoryProcessedWebhookRepository());
  app.set("outboxRepository", outboxRepository || new InMemoryOutboxRepository());
  app.set("purchaseOrderRepository", purchaseOrderRepository || new InMemoryPurchaseOrderRepository());
  app.set("reorderPolicyRepository", reorderPolicyRepository || new InMemoryReorderPolicyRepository());
  app.set("reorderPolicyService", reorderPolicyService || new ReorderPolicyService(app.get("reorderPolicyRepository"), app.get("purchaseOrderRepository")));
  app.set("inventoryAuditRepository", inventoryAuditRepository || new InMemoryInventoryAuditRepository());
  app.set("rmaRepository", rmaRepository || new InMemoryRMARepository());
  app.set("quarantineRepository", quarantineRepository || new InMemoryQuarantineRepository());
  app.set("messageBroker", messageBroker || new InMemoryMessageBroker());
  app.set("dispatchRecordRepository", dispatchRecordRepository || new InMemoryDispatchRecordRepository());
  app.set("demandForecastRepository", demandForecastRepository || new InMemoryDemandForecastRepository());
  app.set("shipmentRepository", shipmentRepository || new InMemoryShipmentRepository());
  app.set("carrierService", carrierService || new MockCarrierService());
  app.set("warehouseLocationRepository", warehouseLocationRepository || new InMemoryWarehouseLocationRepository());
  app.set("productRepository", productRepository || new InMemoryProductRepository());
  app.set("wmsCapacityService", new WMSCapacityService(
    app.get("inventoryRepository"),
    app.get("productRepository"),
    app.get("warehouseLocationRepository")
  ));
  
  // Legacy key for backwards compatibility
  app.set("repository", inventoryRepository);

  app.use("/api/auth", authRoutes);
  app.use("/api/shopify", shopifyRoutes);

  // Secure all other endpoints under auth middleware
  app.use(authMiddleware);

  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/barcodes", barcodeRoutes);
  app.use("/api/serials", serialRoutes);
  app.use("/api/kits", kitRoutes);
  app.use("/api/accounting", accountingRoutes);
  app.use("/api/onboarding", onboardingRoutes);
  app.use("/api/purchase-orders", purchaseOrderRoutes);
  app.use("/api/reorder-policies", reorderPolicyRoutes);
  app.use("/api/audits", inventoryAuditRoutes);
  app.use("/api/returns/rma", rmaRoutes);
  app.use("/api/returns/quarantine", quarantineRoutes);
  app.use("/api/outbox", outboxRoutes);
  app.use("/api/forecasting", forecastingRoutes);
  app.use("/api/shipping", shippingRoutes);
  app.use("/api/warehouse-locations", warehouseLocationRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/webhook-subscriptions", webhookSubscriptionRoutes);
  app.use("/api/compliance", complianceRoutes);
};

const start = async () => {
  // Run TimescaleDB migration query when connecting to Postgres
  try {
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`;
    Logger.info({ message: "TimescaleDB extension enabled." });
    const isHypertable = await prisma.$queryRaw`
      SELECT 1 FROM timescaledb_information.hypertables 
      WHERE hypertable_name = 'dispatch_records'
    `;
    if ((isHypertable as any[]).length === 0) {
      await prisma.$executeRaw`SELECT create_hypertable('dispatch_records', 'dispatched_at', if_not_exists => TRUE);`;
      console.log("dispatch_records table converted to TimescaleDB hypertable.");
    }

    const isView = await prisma.$queryRaw`
      SELECT 1 FROM pg_matviews 
      WHERE matviewname = 'daily_dispatch_summary'
    `;
    if ((isView as any[]).length === 0) {
      await prisma.$executeRaw`
        CREATE MATERIALIZED VIEW daily_dispatch_summary
        WITH (timescaledb.continuous) AS
        SELECT 
          time_bucket('1 day', dispatched_at) AS bucket,
          sku,
          "locationId",
          sum(quantity) as total_dispatched,
          count(*) as dispatch_count
        FROM dispatch_records
        GROUP BY bucket, sku, "locationId";
      `;
      try {
        await prisma.$executeRaw`
          SELECT add_continuous_aggregate_policy('daily_dispatch_summary',
            start_offset => INTERVAL '1 month',
            end_offset => INTERVAL '1 hour',
            schedule_interval => INTERVAL '1 hour',
            if_not_exists => TRUE);
        `;
      } catch (policyErr: any) {
        console.log("TimescaleDB aggregate policy setup warning:", policyErr.message);
      }
      console.log("daily_dispatch_summary continuous aggregate created.");
    }

    // Set up PostgreSQL Row-Level Security (RLS) policies
    await enableRowLevelSecurity(prisma);
  } catch (e) {
    console.log("Database/TimescaleDB setup skipped/warning:", (e as Error).message);
  }

  let repository: IInventoryRepository = null as any;
  let barcodeRepo: IBarcodeRepository = null as any;
  let serialRepo: ISerializedItemRepository = null as any;
  let costLayerRepo: ICostLayerRepository = null as any;
  let outboxRepo: IOutboxRepository = null as any;
  let journalRepo: IJournalRepository = null as any;
  let tenantConfigRepo: ITenantConfigRepository = null as any;
  let processedWebhookRepo: IProcessedWebhookRepository = null as any;
  let purchaseOrderRepo: IPurchaseOrderRepository = null as any;
  let reorderPolicyRepo: IReorderPolicyRepository = null as any;
  let inventoryAuditRepo: IInventoryAuditRepository = null as any;
  let rmaRepo: IRMARepository = null as any;
  let quarantineRepo: IQuarantineRepository = null as any;
  let dispatchRecordRepo: IDispatchRecordRepository = null as any;
  let demandForecastRepo: IDemandForecastRepository = null as any;
  let shipmentRepo: IShipmentRepository = null as any;
  let warehouseLocationRepo: IWarehouseLocationRepository = null as any;
  let productRepo: IProductRepository = null as any;

  let initializedWithDB = false;

  if (process.env.DB_HOST) {
    try {
      console.log("Initializing PostgreSQL Repository...");
      const pgRepo = new PostgresInventoryRepository({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "5432"),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      });
      await pgRepo.initialize();
      repository = pgRepo;

      barcodeRepo = new PrismaBarcodeRepository();
      serialRepo = new PrismaSerializedItemRepository();
      costLayerRepo = new PrismaCostLayerRepository();
      outboxRepo = new PrismaOutboxRepository();
      journalRepo = new PrismaJournalRepository(outboxRepo);
      tenantConfigRepo = new PrismaTenantConfigRepository();
      processedWebhookRepo = new PrismaProcessedWebhookRepository();
      purchaseOrderRepo = new PrismaPurchaseOrderRepository();
      reorderPolicyRepo = new PrismaReorderPolicyRepository();
      inventoryAuditRepo = new PrismaInventoryAuditRepository();
      rmaRepo = new PrismaRMARepository();
      quarantineRepo = new PrismaQuarantineRepository();
      dispatchRecordRepo = new PrismaDispatchRecordRepository();
      demandForecastRepo = new PrismaDemandForecastRepository();
      shipmentRepo = new PrismaShipmentRepository();
      warehouseLocationRepo = new PrismaWarehouseLocationRepository();
      productRepo = new PrismaProductRepository();
      initializedWithDB = true;
      console.log("PostgreSQL & Prisma repositories initialized successfully.");
    } catch (err: any) {
      console.warn("WARNING: Failed to initialize PostgreSQL/Prisma repositories. Falling back to InMemory repositories. Error:", err.message);
    }
  } else if (process.env.DATABASE_URL) {
    try {
      console.log("Initializing Prisma Repository...");
      outboxRepo = new PrismaOutboxRepository();
      repository = new PrismaInventoryRepository(outboxRepo);
      barcodeRepo = new PrismaBarcodeRepository();
      serialRepo = new PrismaSerializedItemRepository();
      costLayerRepo = new PrismaCostLayerRepository();
      journalRepo = new PrismaJournalRepository(outboxRepo);
      tenantConfigRepo = new PrismaTenantConfigRepository();
      processedWebhookRepo = new PrismaProcessedWebhookRepository();
      purchaseOrderRepo = new PrismaPurchaseOrderRepository();
      reorderPolicyRepo = new PrismaReorderPolicyRepository();
      inventoryAuditRepo = new PrismaInventoryAuditRepository();
      rmaRepo = new PrismaRMARepository();
      quarantineRepo = new PrismaQuarantineRepository();
      dispatchRecordRepo = new PrismaDispatchRecordRepository();
      demandForecastRepo = new PrismaDemandForecastRepository();
      shipmentRepo = new PrismaShipmentRepository();
      warehouseLocationRepo = new PrismaWarehouseLocationRepository();
      productRepo = new PrismaProductRepository();
      initializedWithDB = true;
      console.log("Prisma repositories initialized successfully.");
    } catch (err: any) {
      console.warn("WARNING: Failed to initialize Prisma repositories. Falling back to InMemory repositories. Error:", err.message);
    }
  }

  if (!initializedWithDB) {
    console.log("Initializing InMemory Repositories (Development Fallback)...");
    outboxRepo = new InMemoryOutboxRepository();
    repository = new InMemoryInventoryRepository(outboxRepo);
    barcodeRepo = new InMemoryBarcodeRepository();
    serialRepo = new InMemorySerializedItemRepository();
    costLayerRepo = new InMemoryCostLayerRepository();
    journalRepo = new InMemoryJournalRepository(outboxRepo);
    tenantConfigRepo = new InMemoryTenantConfigRepository();
    processedWebhookRepo = new InMemoryProcessedWebhookRepository();
    purchaseOrderRepo = new InMemoryPurchaseOrderRepository();
    reorderPolicyRepo = new InMemoryReorderPolicyRepository();
    inventoryAuditRepo = new InMemoryInventoryAuditRepository();
    rmaRepo = new InMemoryRMARepository();
    quarantineRepo = new InMemoryQuarantineRepository();
    dispatchRecordRepo = new InMemoryDispatchRecordRepository();
    demandForecastRepo = new InMemoryDemandForecastRepository();
    shipmentRepo = new InMemoryShipmentRepository();
    warehouseLocationRepo = new InMemoryWarehouseLocationRepository();
    productRepo = new InMemoryProductRepository();
  }

  const reorderPolicyService = new ReorderPolicyService(reorderPolicyRepo, purchaseOrderRepo);
  const carrierService = new MockCarrierService();

  const kafkaUrl = process.env.KAFKA_URL;
  const rabbitMqUrl = process.env.RABBITMQ_URL;
  const messageBroker = kafkaUrl
    ? new KafkaMessageBroker(kafkaUrl)
    : rabbitMqUrl
      ? new RabbitMQMessageBroker(rabbitMqUrl)
      : new InMemoryMessageBroker();

  setupApp(
    repository,
    barcodeRepo,
    serialRepo,
    costLayerRepo,
    journalRepo,
    tenantConfigRepo,
    processedWebhookRepo,
    outboxRepo,
    purchaseOrderRepo,
    reorderPolicyRepo,
    reorderPolicyService,
    inventoryAuditRepo,
    rmaRepo,
    quarantineRepo,
    messageBroker,
    dispatchRecordRepo,
    demandForecastRepo,
    shipmentRepo,
    carrierService,
    warehouseLocationRepo,
    productRepo
  );

  if (process.env.DISABLE_WORKERS !== "true") {
    const outboxProcessor = new OutboxProcessor(outboxRepo, messageBroker);
    outboxProcessor.start(3000);
    WebhookDeliveryWorker.start(2000);
  }

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on port ${port}`);
  });
  WebSocketManager.init(server);
};

if (process.env.NODE_ENV !== "test") {
  start().catch((err) => {
    Logger.error({ message: "Failed to start server", error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}

export { app };

