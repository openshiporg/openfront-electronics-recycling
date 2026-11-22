"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core28 = require("@keystone-6/core");
var import_config = require("dotenv/config");
var import_node_crypto7 = require("node:crypto");

// features/keystone/models/people.ts
var import_core2 = require("@keystone-6/core");
var import_access3 = require("@keystone-6/core/access");
var import_fields3 = require("@keystone-6/core/fields");
var import_fields_document = require("@keystone-6/fields-document");

// features/keystone/access.ts
var ROLE_PERMISSIONS = [
  "canAccessDashboard",
  "canManageSettings",
  "canManageUsers",
  "canManageBuyers",
  "canManageLots",
  "canAwardLots",
  "canSeeSealedBidAmountsBeforeClose",
  "canManageClients",
  "canManageJobs",
  "canDispatch",
  "canCollect",
  "canReceive",
  "canAuditAssets",
  "canSanitize",
  "canVerifySanitization",
  "canIssueCertificates",
  "canManageDownstream",
  "canManagePayments",
  "canRefund",
  "canManageSettlements",
  "canViewReports",
  "canManageOnboarding"
];
function isSignedIn({ session }) {
  return Boolean(session);
}
function hasPermission(session, permission) {
  if (!session?.data?.role) return false;
  if (session.data.isActive === false) return false;
  return session.data.role[permission] === true;
}
var can = (permission) => ({ session }) => hasPermission(session, permission);
var anyOf = (...flags) => ({ session }) => flags.some((flag) => hasPermission(session, flag));
var denyAll = () => false;
var permissions = Object.fromEntries(
  ROLE_PERMISSIONS.map((permission) => [permission, can(permission)])
);
function staffAccess(read2, write3, options2 = {}) {
  const readCheck = Array.isArray(read2) ? anyOf(...read2) : can(read2);
  const writeCheck = write3 === false ? denyAll : Array.isArray(write3) ? anyOf(...write3) : can(write3);
  return {
    operation: {
      query: readCheck,
      create: options2.create === false ? denyAll : writeCheck,
      update: options2.update === false ? denyAll : writeCheck,
      delete: options2.delete === false ? denyAll : writeCheck
    }
  };
}
var rules = {
  canReadPeople: ({ session }) => {
    if (!session) return false;
    if (hasPermission(session, "canManageUsers") || hasPermission(session, "canAccessDashboard")) return true;
    return { id: { equals: session.itemId } };
  },
  canUpdatePeople: ({ session }) => {
    if (!session) return false;
    if (hasPermission(session, "canManageUsers")) return true;
    const kinds = [hasPermission(session, "canManageBuyers") && "buyer", hasPermission(session, "canManageClients") && "client"].filter(Boolean);
    if (kinds.length) return { OR: [{ id: { equals: session.itemId } }, { kind: { in: kinds } }] };
    return { id: { equals: session.itemId } };
  }
};
var SESSION_DATA = `
  name
  email
  kind
  isActive
  buyerRole
  clientRole
  onboardingStatus
  buyerCompany { id status }
  clientOrganization { id status }
  role { id name ${ROLE_PERMISSIONS.join(" ")} }
`;

// features/keystone/models/trackingFields.ts
var import_fields = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/models/fields.ts
var import_fields2 = require("@keystone-6/core/fields");

// features/keystone/lib/core.ts
var import_node_crypto = require("node:crypto");
var DomainError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "DomainError";
  }
};
function fail(message) {
  throw new DomainError(message);
}
function sessionOf(context) {
  return context.session ?? null;
}
function requireStaff(context, ...anyOf2) {
  const session = sessionOf(context);
  if (!session) fail("Sign in to continue.");
  if (!hasPermission(session, "canAccessDashboard")) fail("Your account cannot use the dashboard.");
  if (anyOf2.length && !anyOf2.some((p) => hasPermission(session, p))) fail("Your role does not allow this.");
  return session;
}
async function requireBuyer(context, options2 = {}) {
  const session = sessionOf(context);
  if (!session) fail("Sign in to continue.");
  const user = await context.prisma.user.findUnique({
    where: { id: session.itemId },
    select: { id: true, name: true, email: true, kind: true, isActive: true, buyerRole: true, buyerCompanyId: true, acceptedTermsVersion: true }
  });
  if (!user || user.kind !== "buyer" || !user.isActive) fail("This page is for buyer accounts.");
  if (!user.buyerCompanyId) fail("Your account is not linked to a buyer company.");
  if (options2.admin && user.buyerRole !== "admin") fail("Only your company admin can do this.");
  return { session, user, companyId: user.buyerCompanyId };
}
async function requireClient(context, options2 = {}) {
  const session = sessionOf(context);
  if (!session) fail("Sign in to continue.");
  const user = await context.prisma.user.findUnique({
    where: { id: session.itemId },
    select: { id: true, name: true, email: true, kind: true, isActive: true, clientRole: true, clientOrganizationId: true }
  });
  if (!user || user.kind !== "client" || !user.isActive) fail("This page is for client accounts.");
  if (!user.clientOrganizationId) fail("Your account is not linked to an organisation.");
  if (options2.admin && user.clientRole !== "admin") fail("Only your organisation admin can do this.");
  return { session, user, organizationId: user.clientOrganizationId };
}
var BULK = { timeout: 18e4 };
async function inTransaction(context, fn, options2 = {}) {
  return context.prisma.$transaction(fn, { timeout: options2.timeout ?? 2e4, maxWait: 1e4 });
}
var LOCKABLE = /* @__PURE__ */ new Set([
  "Lot",
  "Bid",
  "Award",
  "Order",
  "Invoice",
  "Payment",
  "PaymentSession",
  "BuyerCompany",
  "Asset",
  "Job",
  "Container",
  "Facility",
  "Certificate",
  "Settlement",
  "Claim",
  "OutboundShipment",
  "ManifestImport",
  "ErasureImport",
  "SaleEvent",
  "DockAppointment",
  "Refund"
]);
async function lockRow(tx, table, id) {
  if (!LOCKABLE.has(table)) throw new Error(`Table ${table} is not lockable.`);
  const rows = await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE`, id);
  return Array.isArray(rows) && rows.length > 0;
}
async function dbNow(tx) {
  const rows = await tx.$queryRawUnsafe("SELECT now() AS now");
  return new Date(rows[0].now);
}
var SEQUENCES = {
  job: { seq: "job_number_seq", format: (n) => `JOB-${String(n).padStart(6, "0")}` },
  lot: { seq: "lot_number_seq", format: (n, y) => `L-${y}-${String(n).padStart(4, "0")}` },
  order: { seq: "order_number_seq", format: (n) => `SO-${String(n).padStart(6, "0")}` },
  invoice: { seq: "invoice_number_seq", format: (n) => `INV-${String(n).padStart(6, "0")}` },
  certificate: { seq: "certificate_number_seq", format: (n, y) => `CERT-${y}-${String(n).padStart(5, "0")}` },
  settlement: { seq: "settlement_number_seq", format: (n) => `SET-${String(n).padStart(6, "0")}` },
  claim: { seq: "claim_number_seq", format: (n) => `CLM-${String(n).padStart(5, "0")}` },
  shipment: { seq: "shipment_number_seq", format: (n) => `OUT-${String(n).padStart(5, "0")}` },
  asset: { seq: "asset_number_seq", format: (n) => `A-${String(n).padStart(7, "0")}` }
};
async function nextNumber(db, kind) {
  const spec = SEQUENCES[kind];
  const rows = await db.$queryRawUnsafe(`SELECT nextval('${spec.seq}')::int AS n, extract(year from now())::int AS y`);
  return spec.format(Number(rows[0].n), Number(rows[0].y));
}
var SEQUENCE_NAMES = Object.values(SEQUENCES).map((s) => s.seq);
async function audit(tx, input) {
  await tx.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      actorLabel: input.actorLabel ?? (input.actorId ? "" : "System"),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before ?? null,
      after: input.after ?? null,
      reason: input.reason ?? "",
      ipAddress: input.ipAddress ?? "",
      occurredAt: /* @__PURE__ */ new Date()
    }
  });
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonicalize(v)]));
  }
  return value;
}
function requestHash(value) {
  return (0, import_node_crypto.createHash)("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
async function withCommandReceipt(tx, input, run) {
  if (!input.key) return run();
  const key = String(input.key).slice(0, 200);
  if (key.length < 8) fail("The request key is too short.");
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "command-receipt", key);
  const payloadHash = requestHash({ eventType: input.eventType, aggregateId: input.aggregateId, payload: input.payload });
  const eventKey = `${input.eventType}:${input.actorId ?? "anon"}:${key}`;
  const existing = await tx.commandReceipt.findUnique({ where: { eventKey } });
  if (existing) {
    if (existing.payloadHash !== payloadHash) fail("This request was already sent with different details. Reload and try again.");
    return existing.result;
  }
  const result = await run();
  await tx.commandReceipt.create({
    data: {
      eventKey,
      eventType: input.eventType,
      schemaVersion: 1,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      actorId: input.actorId ?? "",
      payload: input.payload,
      result: JSON.parse(JSON.stringify(result ?? null)),
      payloadHash,
      occurredAt: /* @__PURE__ */ new Date()
    }
  });
  return result;
}
function verificationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = (0, import_node_crypto.randomBytes)(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
function clientIp(context) {
  const req = context.req;
  const forwarded = req?.headers?.["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(value || req?.socket?.remoteAddress || "").split(",")[0].trim().slice(0, 64);
}
function userAgent(context) {
  return String(context.req?.headers?.["user-agent"] || "").slice(0, 300);
}
async function command(fn) {
  try {
    return { success: true, error: null, data: await fn() };
  } catch (error) {
    if (error instanceof DomainError || error?.name === "RuleError") return { success: false, error: error.message, data: null };
    const code = error?.code;
    if (code === "P2002") return { success: false, error: "This was already done. Reload to see the latest state.", data: null };
    if (code === "P2034" || code === "P2028") return { success: false, error: "Another change was saved at the same moment. Try again.", data: null };
    console.error("[command]", error);
    return { success: false, error: "Something went wrong. Nothing was changed.", data: null };
  }
}
function str(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function toJson(value) {
  return JSON.parse(JSON.stringify(value, (_k, v) => typeof v === "bigint" ? Number(v) : v && typeof v === "object" && v.constructor?.name === "Decimal" ? Number(v.toString()) : v));
}

// features/keystone/models/fields.ts
function humanize(value) {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
function options(values) {
  return values.map((value) => ({ label: humanize(value), value }));
}
var money = (config2 = {}) => (0, import_fields2.integer)({
  defaultValue: config2.nullable ? void 0 : config2.defaultValue ?? 0,
  validation: config2.nullable ? { min: 0 } : { min: 0, isRequired: true },
  ui: config2.description ? { description: config2.description } : void 0
});
var choice = (values, defaultValue, type = "enum") => (0, import_fields2.select)({
  type,
  options: options(values),
  ...defaultValue ? { defaultValue, validation: { isRequired: true } } : {}
});
var status = (values, defaultValue) => (0, import_fields2.select)({
  type: "enum",
  options: options(values),
  defaultValue,
  validation: { isRequired: true },
  access: { create: denyAll, update: denyAll },
  ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
});
var documentNumber = () => (0, import_fields2.text)({
  isIndexed: "unique",
  db: { isNullable: true },
  access: { create: denyAll, update: denyAll },
  ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
});
var readOnly = { access: { create: denyAll, update: denyAll }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } };
var fileRef = (config2 = {}) => (0, import_fields2.relationship)({
  ref: "StoredFile",
  ...config2.readOnly ? { access: { create: denyAll, update: denyAll } } : {},
  ui: { displayMode: "select", labelField: "filename", ...config2.readOnly ? { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } } : {} }
});
var userRef = (config2 = {}) => (0, import_fields2.relationship)({
  ref: "User",
  ...config2.readOnly ? { access: { create: denyAll, update: denyAll }, ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } } } : {}
});
var addressFields = () => ({
  addressLine1: (0, import_fields2.text)(),
  addressLine2: (0, import_fields2.text)(),
  city: (0, import_fields2.text)(),
  region: (0, import_fields2.text)(),
  postalCode: (0, import_fields2.text)(),
  countryCode: (0, import_fields2.text)({ defaultValue: "US" })
});
function assignNumber(kind, field) {
  return async ({ operation, resolvedData, context }) => {
    if (operation === "create" && !resolvedData[field]) {
      return { ...resolvedData, [field]: await nextNumber(context.prisma, kind) };
    }
    return resolvedData;
  };
}
var uniqueKey = (config2 = {}) => (0, import_fields2.text)({
  isIndexed: "unique",
  db: { isNullable: true },
  ...config2.hidden ? { access: { read: denyAll, create: denyAll, update: denyAll }, ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" } } } : { access: { create: denyAll, update: denyAll }, ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } } }
});

// features/keystone/models/people.ts
var User = (0, import_core2.list)({
  access: {
    operation: {
      ...(0, import_access3.allOperations)(isSignedIn),
      create: anyPeopleManager,
      delete: permissions.canManageUsers
    },
    filter: { query: rules.canReadPeople, update: rules.canUpdatePeople },
    item: { create: portalUserCreate }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageUsers(args),
    hideDelete: (args) => !permissions.canManageUsers(args),
    listView: { initialColumns: ["name", "email", "kind", "role", "buyerCompany", "clientOrganization", "isActive"] },
    itemView: {
      defaultFieldMode: ({ session, item }) => hasPermission(session, "canManageUsers") || session?.itemId === item?.id ? "edit" : "read"
    }
  },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    email: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    password: (0, import_fields3.password)({
      access: {
        read: denyAll,
        update: ({ session, item }) => hasPermission(session, "canManageUsers") || session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    phone: (0, import_fields3.text)(),
    role: (0, import_fields3.relationship)({
      ref: "Role.assignedTo",
      access: { create: permissions.canManageUsers, update: permissions.canManageUsers }
    }),
    kind: (0, import_fields3.select)({
      type: "enum",
      options: [
        { label: "Staff", value: "staff" },
        { label: "Buyer", value: "buyer" },
        { label: "Client", value: "client" }
      ],
      defaultValue: "staff",
      validation: { isRequired: true },
      access: { create: anyPeopleManager, update: permissions.canManageUsers }
    }),
    buyerCompany: (0, import_fields3.relationship)({
      ref: "BuyerCompany.users",
      access: { create: anyBuyerManager, update: anyBuyerManager }
    }),
    buyerRole: (0, import_fields3.select)({
      type: "enum",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Bidder", value: "bidder" }
      ],
      access: { create: anyBuyerManager, update: anyBuyerManager }
    }),
    clientOrganization: (0, import_fields3.relationship)({
      ref: "ClientOrganization.users",
      access: { create: anyClientManager, update: anyClientManager }
    }),
    clientRole: (0, import_fields3.select)({
      type: "enum",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Viewer", value: "viewer" }
      ],
      access: { create: anyClientManager, update: anyClientManager }
    }),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true, access: { create: permissions.canManageUsers, update: anyPeopleManager } }),
    acceptedTermsVersion: (0, import_fields3.text)({ ...readOnly }),
    acceptedTermsAt: (0, import_fields3.timestamp)({ ...readOnly }),
    notificationPrefs: (0, import_fields3.json)({ defaultValue: {} }),
    onboardingStatus: (0, import_fields3.select)({
      type: "enum",
      options: [
        { label: "Not started", value: "not_started" },
        { label: "In progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Dismissed", value: "dismissed" }
      ],
      defaultValue: "not_started",
      access: { create: permissions.canManageOnboarding, update: permissions.canManageOnboarding }
    }),
    passwordResetToken: (0, import_fields3.password)({ access: { read: denyAll, update: denyAll }, ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" } } }),
    passwordResetIssuedAt: (0, import_fields3.timestamp)({ access: { read: denyAll, update: denyAll }, ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" } } }),
    passwordResetRedeemedAt: (0, import_fields3.timestamp)({ access: { read: denyAll, update: denyAll }, ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" } } }),
    ...trackingFields
  }
});
function anyBuyerManager(args) {
  return hasPermission(args.session, "canManageUsers") || hasPermission(args.session, "canManageBuyers");
}
function anyClientManager(args) {
  return hasPermission(args.session, "canManageUsers") || hasPermission(args.session, "canManageClients");
}
function anyPeopleManager(args) {
  return anyBuyerManager(args) || anyClientManager(args);
}
function portalUserCreate({ session, inputData }) {
  if (hasPermission(session, "canManageUsers")) return true;
  if (inputData.role) return false;
  if (inputData.kind === "buyer") return hasPermission(session, "canManageBuyers") && Boolean(inputData.buyerCompany) && !inputData.clientOrganization;
  if (inputData.kind === "client") return hasPermission(session, "canManageClients") && Boolean(inputData.clientOrganization) && !inputData.buyerCompany;
  return false;
}
var permissionFields = Object.fromEntries(
  ROLE_PERMISSIONS.map((permission) => [permission, (0, import_fields3.checkbox)({ defaultValue: false })])
);
var Role = (0, import_core2.list)({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageUsers,
      update: permissions.canManageUsers,
      delete: permissions.canManageUsers
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageUsers(args),
    hideDelete: (args) => !permissions.canManageUsers(args),
    listView: { initialColumns: ["name", "assignedTo"] }
  },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    ...permissionFields,
    assignedTo: (0, import_fields3.relationship)({ ref: "User.role", many: true, ui: { itemView: { fieldMode: "read" } } }),
    ...trackingFields
  }
});
var settingsAccess = {
  operation: {
    query: can("canAccessDashboard"),
    create: can("canManageSettings"),
    update: can("canManageSettings"),
    delete: denyAll
  }
};
var StoreSettings = (0, import_core2.list)({
  isSingleton: true,
  access: settingsAccess,
  graphql: { plural: "StoreSettingsItems" },
  fields: {
    businessName: (0, import_fields3.text)({ validation: { isRequired: true }, defaultValue: "Electronics Recycling" }),
    legalName: (0, import_fields3.text)(),
    logo: fileRef(),
    tagline: (0, import_fields3.text)(),
    supportEmail: (0, import_fields3.text)(),
    supportPhone: (0, import_fields3.text)(),
    timezone: (0, import_fields3.text)({ defaultValue: "America/New_York", validation: { isRequired: true } }),
    currencyCode: (0, import_fields3.text)({ defaultValue: "USD", validation: { isRequired: true } }),
    weightUnit: choice(["lb", "kg"], "lb"),
    publicLotVisibility: choice(["teaser", "full", "hidden"], "teaser"),
    defaultBidFormat: choice(["sealed_bid", "open_auction", "fixed_price"], "sealed_bid"),
    defaultBidBasis: choice(["lot_total", "per_line"], "lot_total"),
    defaultAwardMode: choice(["manual", "auto"], "manual"),
    softCloseWindowMinutes: (0, import_fields3.integer)({ defaultValue: 3, validation: { isRequired: true, min: 0 } }),
    softCloseExtensionMinutes: (0, import_fields3.integer)({ defaultValue: 3, validation: { isRequired: true, min: 0 } }),
    softCloseMaxExtensions: (0, import_fields3.integer)({ defaultValue: 20, validation: { isRequired: true, min: 0 } }),
    bidValidityBusinessDays: (0, import_fields3.integer)({ defaultValue: 3, validation: { isRequired: true, min: 0 } }),
    buyerPremiumBps: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    salesTaxBps: (0, import_fields3.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    cardFeeBps: (0, import_fields3.integer)({ defaultValue: 300, validation: { isRequired: true, min: 0 } }),
    cardMaxAmountMinor: (0, import_fields3.integer)({ validation: { min: 0 }, ui: { description: "Largest invoice payable by card. Empty means no cap." } }),
    paymentDueBusinessDays: (0, import_fields3.integer)({ defaultValue: 2, validation: { isRequired: true, min: 0 } }),
    paymentGraceBusinessDays: (0, import_fields3.integer)({ defaultValue: 2, validation: { isRequired: true, min: 0 } }),
    restockingFeeBps: (0, import_fields3.integer)({ defaultValue: 1500, validation: { isRequired: true, min: 0 } }),
    strikesBeforeSuspension: (0, import_fields3.integer)({ defaultValue: 3, validation: { isRequired: true, min: 1 } }),
    removalBusinessDays: (0, import_fields3.integer)({ defaultValue: 5, validation: { isRequired: true, min: 0 } }),
    storageFeePerPalletPerDayMinor: money({ defaultValue: 2e3 }),
    claimWindowBusinessDays: (0, import_fields3.integer)({ defaultValue: 5, validation: { isRequired: true, min: 0 } }),
    claimVarianceBps: (0, import_fields3.integer)({ defaultValue: 500, validation: { isRequired: true, min: 0 } }),
    defaultClientRevenueShareBps: (0, import_fields3.integer)({ defaultValue: 7e3, validation: { isRequired: true, min: 0, max: 1e4 } }),
    sanitizationVerificationSampleBps: (0, import_fields3.integer)({ defaultValue: 500, validation: { isRequired: true, min: 0, max: 1e4 } }),
    wireInstructions: (0, import_fields3.text)({ ui: { displayMode: "textarea", description: "Shown only to a buyer or client with an open invoice." } }),
    wholesaleTerms: (0, import_fields_document.document)({ formatting: true, links: true }),
    wholesaleTermsVersion: (0, import_fields3.text)({ defaultValue: "1" }),
    serviceTerms: (0, import_fields_document.document)({ formatting: true, links: true }),
    serviceTermsVersion: (0, import_fields3.text)({ defaultValue: "1" }),
    exportClause: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    smtpHost: (0, import_fields3.text)(),
    smtpPort: (0, import_fields3.integer)(),
    smtpUser: (0, import_fields3.text)(),
    smtpPassword: (0, import_fields3.text)({ access: { read: denyAll }, ui: { itemView: { fieldMode: "edit" }, listView: { fieldMode: "hidden" } } }),
    smtpFrom: (0, import_fields3.text)(),
    storefrontUrl: (0, import_fields3.text)({ ui: { description: "Public address of the site, used in email links." } }),
    ...trackingFields
  }
});
var Facility = (0, import_core2.list)({
  access: staffAccess("canAccessDashboard", "canManageSettings"),
  ui: { listView: { initialColumns: ["name", "code", "city", "acceptsDropOff", "isActive"] } },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    code: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    ...addressFields(),
    phone: (0, import_fields3.text)(),
    hours: (0, import_fields3.json)({ defaultValue: {}, ui: { description: 'Per weekday, e.g. {"mon":"08:00-17:00"}' } }),
    acceptsDropOff: (0, import_fields3.checkbox)({ defaultValue: true }),
    dockSlotMinutes: (0, import_fields3.integer)({ defaultValue: 30, validation: { isRequired: true, min: 5 } }),
    dockSlotsPerWindow: (0, import_fields3.integer)({ defaultValue: 2, validation: { isRequired: true, min: 1 } }),
    pickupInstructions: (0, import_fields3.text)({ ui: { displayMode: "textarea", description: "Shown to a buyer only after their order is paid." } }),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var Certification = (0, import_core2.list)({
  access: staffAccess("canAccessDashboard", ["canManageSettings", "canManageDownstream"]),
  ui: { listView: { initialColumns: ["name", "certificateNumber", "certifyingBody", "expiresOn", "isPublic"] } },
  fields: {
    name: (0, import_fields3.select)({ type: "string", options: ["R2v3", "e-Stewards", "NAID AAA", "ISO 14001", "ISO 45001", "ISO 9001", "ISO 27001", "RIOS", "Other"].map((value) => ({ label: value, value })), defaultValue: "R2v3", validation: { isRequired: true } }),
    otherName: (0, import_fields3.text)({ ui: { description: "When the name is Other." } }),
    certificateNumber: (0, import_fields3.text)(),
    certifyingBody: (0, import_fields3.text)(),
    facility: (0, import_fields3.relationship)({ ref: "Facility" }),
    issuedOn: (0, import_fields3.calendarDay)(),
    expiresOn: (0, import_fields3.calendarDay)(),
    document: fileRef(),
    isPublic: (0, import_fields3.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var MaterialCategory = (0, import_core2.list)({
  access: staffAccess("canAccessDashboard", "canManageSettings"),
  ui: { labelField: "name", listView: { initialColumns: ["name", "kind", "parent", "r2Category", "isFocusMaterial", "dataBearingDefault"] } },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    kind: choice(["equipment", "component", "commodity"], "equipment"),
    parent: (0, import_fields3.relationship)({ ref: "MaterialCategory.children" }),
    children: (0, import_fields3.relationship)({ ref: "MaterialCategory.parent", many: true }),
    r2Category: (0, import_fields3.text)(),
    isFocusMaterial: (0, import_fields3.checkbox)({ defaultValue: false }),
    dataBearingDefault: (0, import_fields3.checkbox)({ defaultValue: false }),
    sortOrder: (0, import_fields3.integer)({ defaultValue: 0 }),
    isActive: (0, import_fields3.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var GradeDefinition = (0, import_core2.list)({
  access: staffAccess("canAccessDashboard", "canManageSettings"),
  ui: { labelField: "label", listView: { initialColumns: ["kind", "code", "label", "sortOrder"] } },
  fields: {
    kind: choice(["cosmetic", "functional"], "cosmetic"),
    code: (0, import_fields3.text)({ validation: { isRequired: true } }),
    label: (0, import_fields3.text)({ validation: { isRequired: true } }),
    description: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    sortOrder: (0, import_fields3.integer)({ defaultValue: 0 }),
    ...trackingFields
  }
});
var AcceptedItem = (0, import_core2.list)({
  access: staffAccess("canAccessDashboard", "canManageSettings"),
  ui: { listView: { initialColumns: ["name", "category", "accepted", "feeType", "feeMinor"] } },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    category: (0, import_fields3.relationship)({ ref: "MaterialCategory" }),
    accepted: (0, import_fields3.checkbox)({ defaultValue: true }),
    feeType: choice(["free", "per_item", "per_weight"], "free"),
    feeMinor: money(),
    notes: (0, import_fields3.text)(),
    sortOrder: (0, import_fields3.integer)({ defaultValue: 0 }),
    ...trackingFields
  }
});
var StoredFile = (0, import_core2.list)({
  access: {
    operation: { query: can("canAccessDashboard"), create: denyAll, update: denyAll, delete: can("canManageSettings") }
  },
  ui: { labelField: "filename", hideCreate: true, listView: { initialColumns: ["filename", "mimeType", "sizeBytes", "purpose", "visibility", "createdAt"] } },
  fields: {
    filename: (0, import_fields3.text)({ validation: { isRequired: true } }),
    mimeType: (0, import_fields3.text)({ validation: { isRequired: true } }),
    sizeBytes: (0, import_fields3.integer)({ validation: { isRequired: true, min: 0 } }),
    sha256: (0, import_fields3.text)({ validation: { isRequired: true } }),
    purpose: (0, import_fields3.text)({ validation: { isRequired: true } }),
    visibility: choice(["public", "private"], "private"),
    ownerBuyerCompanyId: (0, import_fields3.text)(),
    ownerClientOrganizationId: (0, import_fields3.text)(),
    uploadedBy: (0, import_fields3.relationship)({ ref: "User" }),
    data: (0, import_fields3.text)({
      db: { nativeType: "Text" },
      access: { read: denyAll, create: denyAll, update: denyAll },
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" } }
    }),
    ...trackingFields
  }
});
var peopleLists = { User, Role, StoreSettings, Facility, Certification, MaterialCategory, GradeDefinition, AcceptedItem, StoredFile };

// features/keystone/models/buySide.ts
var import_core3 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");

// features/keystone/lib/rules/lifecycle.ts
var RuleError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RuleError";
  }
};
var JOB_TRANSITIONS = {
  quote: { from: ["requested", "quoted"], to: "quoted" },
  accept: { from: ["quoted"], to: "accepted" },
  decline: { from: ["quoted"], to: "declined" },
  schedule: { from: ["accepted", "scheduled"], to: "scheduled" },
  depart: { from: ["scheduled"], to: "en_route" },
  collect: { from: ["scheduled", "en_route"], to: "collected" },
  receive: { from: ["collected"], to: "received" },
  start: { from: ["received"], to: "processing" },
  complete: { from: ["received", "processing"], to: "completed" },
  settle: { from: ["completed"], to: "settled" },
  close: { from: ["settled", "completed"], to: "closed" },
  cancel: { from: ["requested", "quoted", "accepted", "scheduled", "en_route"], to: "cancelled" }
};
var AFTER_COLLECTION = ["collected", "received", "processing", "completed", "settled"];
function jobTransition(action, current) {
  const rule = JOB_TRANSITIONS[action];
  if (!rule) throw new RuleError(`Unknown job action ${action}.`);
  if (!rule.from.includes(current)) throw new RuleError(`A job that is ${current.replace(/_/g, " ")} cannot be moved to ${rule.to.replace(/_/g, " ")}.`);
  return rule.to;
}
function sanitizationAllowsSale(asset) {
  if (!asset.isDataBearing) return true;
  if (asset.storageRemoved) return true;
  return asset.sanitizationStatus === "passed" || asset.sanitizationStatus === "destroyed";
}
function sanitizationStatusFromRecords(isDataBearing, records) {
  if (!records.length) return isDataBearing ? "pending" : "not_required";
  const sorted = [...records].sort((a, b) => new Date(a.completedAt ?? a.createdAt ?? 0).getTime() - new Date(b.completedAt ?? b.createdAt ?? 0).getTime());
  let state = isDataBearing ? "pending" : "not_required";
  for (const r of sorted) {
    if (r.result === "failed") state = "failed";
    else if (r.method === "destroy") state = "destroyed";
    else if (state !== "destroyed") state = "passed";
  }
  return state;
}
function jobCompletionProblem(assets) {
  const open = assets.filter((a) => a.isDataBearing && !["passed", "destroyed"].includes(a.sanitizationStatus));
  if (open.length) return `${open.length} data-bearing asset${open.length === 1 ? "" : "s"} still need sanitisation (${open.slice(0, 5).map((a) => a.assetNumber).join(", ")}${open.length > 5 ? "\u2026" : ""}).`;
  return null;
}
var LOT_EDITABLE_WHEN_OPEN = ["title", "description", "conditionSummary", "closesAt", "images", "palletCount", "weight", "dimensions", "category", "facility", "slug", "shippingTerms", "exportAllowed", "warrantyDays"];

// features/keystone/lib/assetRules.ts
async function assertAssetMayChange(args) {
  const { item, resolvedData } = args;
  if (!item) return;
  const next = { ...item, ...resolvedData };
  if (["ready_for_sale", "allocated", "sold"].includes(item.status) && !sanitizationAllowsSale(next)) {
    args.addValidationError("This asset is for sale, so its data-bearing and storage details cannot be changed to fail the sanitisation rule.");
  }
  if (item.status === "on_hold" && Object.keys(resolvedData).some((k) => !["testNotes", "locationCode"].includes(k))) {
    args.addValidationError("This asset is on hold. Release the hold before changing it.");
  }
}

// features/keystone/models/buySide.ts
var JOB_STATUSES = ["requested", "quoted", "accepted", "declined", "scheduled", "en_route", "collected", "received", "processing", "completed", "settled", "closed", "cancelled", "on_hold"];
var ASSET_STATUSES = ["received", "audited", "ready_for_sale", "allocated", "sold", "released", "recycling", "downstream", "returned", "on_hold"];
var SANITIZATION_STATUSES = ["not_required", "pending", "passed", "failed", "destroyed"];
var SETTLEMENT_STATUSES = ["draft", "in_review", "published", "disputed", "paid", "closed"];
var jobRead = ["canManageJobs", "canManageClients", "canDispatch", "canCollect", "canReceive", "canAuditAssets", "canSanitize", "canIssueCertificates", "canManageSettlements", "canViewReports"];
var processRead = ["canAuditAssets", "canSanitize", "canVerifySanitization", "canIssueCertificates", "canManageLots", "canManageJobs", "canReceive", "canManageDownstream", "canViewReports"];
var ClientOrganization = (0, import_core3.list)({
  access: staffAccess([...jobRead, "canManagePayments"], "canManageClients", { delete: false }),
  ui: { listView: { initialColumns: ["name", "industry", "status", "accountManager", "billingEmail"] } },
  fields: {
    name: (0, import_fields5.text)({ validation: { isRequired: true } }),
    legalName: (0, import_fields5.text)(),
    industry: (0, import_fields5.text)(),
    billingEmail: (0, import_fields5.text)(),
    ...addressFields(),
    taxId: (0, import_fields5.text)(),
    status: choice(["prospect", "active", "inactive"], "prospect"),
    defaultPricingModel: choice(["fee_for_service", "revenue_share", "buyout"], "fee_for_service"),
    defaultRevenueShareBps: (0, import_fields5.integer)({ validation: { min: 0, max: 1e4 } }),
    accountManager: (0, import_fields5.relationship)({ ref: "User" }),
    users: (0, import_fields5.relationship)({ ref: "User.clientOrganization", many: true }),
    sites: (0, import_fields5.relationship)({ ref: "ClientSite.organization", many: true }),
    jobs: (0, import_fields5.relationship)({ ref: "Job.organization", many: true }),
    invoices: (0, import_fields5.relationship)({ ref: "Invoice.clientOrganization", many: true }),
    notes: (0, import_fields5.text)({ ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});
var ClientSite = (0, import_core3.list)({
  access: staffAccess([...jobRead], "canManageClients"),
  ui: { listView: { initialColumns: ["name", "organization", "city", "contactName", "hasDock"] } },
  fields: {
    organization: (0, import_fields5.relationship)({ ref: "ClientOrganization.sites" }),
    name: (0, import_fields5.text)({ validation: { isRequired: true } }),
    ...addressFields(),
    contactName: (0, import_fields5.text)(),
    contactPhone: (0, import_fields5.text)(),
    hasDock: (0, import_fields5.checkbox)({ defaultValue: false }),
    needsLiftgate: (0, import_fields5.checkbox)({ defaultValue: false }),
    accessNotes: (0, import_fields5.text)({ ui: { displayMode: "textarea" } }),
    hours: (0, import_fields5.text)(),
    jobs: (0, import_fields5.relationship)({ ref: "Job.site", many: true }),
    ...trackingFields
  }
});
function sumDecimal(values) {
  return values.reduce((sum, v) => sum + (v == null ? 0 : Number(v.toString())), 0);
}
var Job = (0, import_core3.list)({
  access: staffAccess([...jobRead], ["canManageJobs", "canManageClients", "canDispatch"], { delete: false }),
  hooks: { resolveInput: assignNumber("job", "jobNumber") },
  ui: { labelField: "jobNumber", listView: { initialColumns: ["jobNumber", "type", "status", "organization", "scheduledDate", "driver"] } },
  fields: {
    jobNumber: documentNumber(),
    type: choice(["pickup", "drop_off"], "pickup"),
    status: status(JOB_STATUSES, "requested"),
    holdFromStatus: (0, import_fields5.text)({ ...readOnly }),
    organization: (0, import_fields5.relationship)({ ref: "ClientOrganization.jobs" }),
    site: (0, import_fields5.relationship)({ ref: "ClientSite.jobs" }),
    facility: (0, import_fields5.relationship)({ ref: "Facility" }),
    requestedBy: userRef({ readOnly: true }),
    contactName: (0, import_fields5.text)(),
    contactEmail: (0, import_fields5.text)(),
    contactPhone: (0, import_fields5.text)(),
    siteAddress: (0, import_fields5.json)({ ui: { description: "Address given on the request (snapshot)." } }),
    accessDetails: (0, import_fields5.json)({ defaultValue: {} }),
    requestedDates: (0, import_fields5.json)({ defaultValue: [] }),
    hasDataBearing: (0, import_fields5.checkbox)({ defaultValue: false }),
    servicesRequested: (0, import_fields5.json)({ defaultValue: [] }),
    estimateLines: (0, import_fields5.relationship)({ ref: "JobEstimateLine.job", many: true }),
    photos: (0, import_fields5.relationship)({ ref: "JobPhoto.job", many: true }),
    pricingModel: choice(["fee_for_service", "revenue_share", "buyout"]),
    revenueShareBps: (0, import_fields5.integer)({ validation: { min: 0, max: 1e4 } }),
    buyoutAmountMinor: (0, import_fields5.integer)({ validation: { min: 0 } }),
    serviceLines: (0, import_fields5.relationship)({ ref: "JobServiceLine.job", many: true }),
    quoteSentAt: (0, import_fields5.timestamp)({ ...readOnly }),
    quoteAcceptedAt: (0, import_fields5.timestamp)({ ...readOnly }),
    quoteAcceptedBy: userRef({ readOnly: true }),
    quoteSignatureName: (0, import_fields5.text)({ ...readOnly }),
    quoteTermsVersion: (0, import_fields5.text)({ ...readOnly }),
    declineReason: (0, import_fields5.text)({ ...readOnly }),
    cancelReason: (0, import_fields5.text)({ ...readOnly }),
    scheduledDate: (0, import_fields5.calendarDay)(),
    windowStart: (0, import_fields5.text)({ ui: { description: "HH:MM" } }),
    windowEnd: (0, import_fields5.text)({ ui: { description: "HH:MM" } }),
    driver: (0, import_fields5.relationship)({ ref: "User" }),
    vehicle: (0, import_fields5.text)(),
    collectedAt: (0, import_fields5.timestamp)({ ...readOnly }),
    clientSignerName: (0, import_fields5.text)({ ...readOnly }),
    clientSignature: fileRef({ readOnly: true }),
    receivedAt: (0, import_fields5.timestamp)({ ...readOnly }),
    completedAt: (0, import_fields5.timestamp)({ ...readOnly }),
    containers: (0, import_fields5.relationship)({ ref: "Container.job", many: true }),
    assets: (0, import_fields5.relationship)({ ref: "Asset.job", many: true }),
    commodityLines: (0, import_fields5.relationship)({ ref: "CommodityLine.job", many: true }),
    custodyEvents: (0, import_fields5.relationship)({ ref: "CustodyEvent.job", many: true, ...readOnly }),
    certificates: (0, import_fields5.relationship)({ ref: "Certificate.job", many: true, ...readOnly }),
    settlement: (0, import_fields5.relationship)({ ref: "Settlement.job", ...readOnly }),
    invoices: (0, import_fields5.relationship)({ ref: "Invoice.job", many: true, ...readOnly }),
    dockAppointments: (0, import_fields5.relationship)({ ref: "DockAppointment.job", many: true }),
    internalNotes: (0, import_fields5.text)({ ui: { displayMode: "textarea" } }),
    totalWeight: (0, import_fields5.virtual)({
      field: import_core3.graphql.field({
        type: import_core3.graphql.Float,
        async resolve(item, _args, context) {
          const containers = await context.prisma.container.findMany({ where: { jobId: item.id }, select: { grossWeight: true, tareWeight: true } });
          return containers.reduce((sum, c) => sum + Math.max(0, Number(c.grossWeight ?? 0) - Number(c.tareWeight ?? 0)), 0);
        }
      })
    }),
    assetCount: (0, import_fields5.virtual)({
      field: import_core3.graphql.field({ type: import_core3.graphql.Int, resolve: (item, _a, context) => context.prisma.asset.count({ where: { jobId: item.id } }) })
    }),
    dataBearingCount: (0, import_fields5.virtual)({
      field: import_core3.graphql.field({ type: import_core3.graphql.Int, resolve: (item, _a, context) => context.prisma.asset.count({ where: { jobId: item.id, isDataBearing: true } }) })
    }),
    sanitizedCount: (0, import_fields5.virtual)({
      field: import_core3.graphql.field({
        type: import_core3.graphql.Int,
        resolve: (item, _a, context) => context.prisma.asset.count({ where: { jobId: item.id, isDataBearing: true, sanitizationStatus: { in: ["passed", "destroyed"] } } })
      })
    }),
    ...trackingFields
  }
});
var JobEstimateLine = (0, import_core3.list)({
  access: staffAccess([...jobRead], ["canManageJobs", "canManageClients"]),
  fields: {
    job: (0, import_fields5.relationship)({ ref: "Job.estimateLines" }),
    category: (0, import_fields5.relationship)({ ref: "MaterialCategory" }),
    quantity: (0, import_fields5.integer)({ defaultValue: 1, validation: { min: 0 } }),
    unit: choice(["units", "pallets", "lb", "kg"], "units"),
    notes: (0, import_fields5.text)(),
    ...trackingFields
  }
});
var JobServiceLine = (0, import_core3.list)({
  access: staffAccess([...jobRead], ["canManageJobs", "canManageClients"]),
  ui: { listView: { initialColumns: ["job", "kind", "description", "quantity", "unitPriceMinor", "totalMinor"] } },
  hooks: {
    resolveInput: async ({ resolvedData, item }) => {
      const quantity = Number((resolvedData.quantity ?? item?.quantity ?? 1).toString());
      const unit = Number(resolvedData.unitPriceMinor ?? item?.unitPriceMinor ?? 0);
      return { ...resolvedData, totalMinor: Math.round(quantity * unit) };
    }
  },
  fields: {
    job: (0, import_fields5.relationship)({ ref: "Job.serviceLines" }),
    description: (0, import_fields5.text)({ validation: { isRequired: true } }),
    quantity: (0, import_fields5.decimal)({ precision: 12, scale: 3, defaultValue: "1", validation: { isRequired: true } }),
    unitPriceMinor: money(),
    totalMinor: (0, import_fields5.integer)({ defaultValue: 0, ...readOnly }),
    kind: choice(["pickup", "audit", "wipe", "shred", "recycling_fee", "other"], "other"),
    ...trackingFields
  }
});
var JobPhoto = (0, import_core3.list)({
  access: staffAccess([...jobRead], ["canManageJobs", "canCollect", "canReceive"]),
  fields: {
    job: (0, import_fields5.relationship)({ ref: "Job.photos" }),
    image: fileRef(),
    caption: (0, import_fields5.text)(),
    stage: choice(["request", "collection", "receiving"], "request"),
    ...trackingFields
  }
});
var Container = (0, import_core3.list)({
  access: staffAccess([...jobRead], ["canCollect", "canReceive", "canManageJobs"], { delete: false }),
  ui: { labelField: "label", listView: { initialColumns: ["label", "job", "type", "sealNumber", "status", "grossWeight", "tareWeight"] } },
  fields: {
    job: (0, import_fields5.relationship)({ ref: "Job.containers" }),
    label: (0, import_fields5.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    type: choice(["pallet", "gaylord", "box", "cage", "tote"], "pallet"),
    sealNumber: (0, import_fields5.text)(),
    receivedSealNumber: (0, import_fields5.text)({ ...readOnly }),
    sealVerified: (0, import_fields5.checkbox)({ defaultValue: false, ...readOnly }),
    sealException: (0, import_fields5.text)({ ...readOnly }),
    sealExceptionResolution: (0, import_fields5.text)({ ...readOnly }),
    itemCountDeclared: (0, import_fields5.integer)({ validation: { min: 0 } }),
    grossWeight: (0, import_fields5.decimal)({ precision: 12, scale: 2 }),
    tareWeight: (0, import_fields5.decimal)({ precision: 12, scale: 2 }),
    netWeight: (0, import_fields5.virtual)({
      field: import_core3.graphql.field({
        type: import_core3.graphql.Float,
        resolve: (item) => item.grossWeight == null ? null : Math.max(0, Number(item.grossWeight) - Number(item.tareWeight ?? 0))
      })
    }),
    status: status(["collected", "received", "processed", "missing", "unexpected"], "collected"),
    locationCode: (0, import_fields5.text)(),
    assets: (0, import_fields5.relationship)({ ref: "Asset.container", many: true }),
    custodyEvents: (0, import_fields5.relationship)({ ref: "CustodyEvent.container", many: true, ...readOnly }),
    ...trackingFields
  }
});
var CustodyEvent = (0, import_core3.list)({
  access: { operation: { query: anyOf(...jobRead, "canManageLots", "canManageDownstream"), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["occurredAt", "type", "job", "container", "asset", "actorName", "signerName"] } },
  fields: {
    job: (0, import_fields5.relationship)({ ref: "Job.custodyEvents" }),
    container: (0, import_fields5.relationship)({ ref: "Container.custodyEvents" }),
    asset: (0, import_fields5.relationship)({ ref: "Asset.custodyEvents" }),
    type: choice(["collected", "handed_to_carrier", "received", "seal_verified", "seal_exception", "moved", "audited", "sanitized", "verified", "allocated", "released_to_buyer", "shipped_downstream", "returned_to_client", "hold_placed", "hold_released"], "moved"),
    actor: (0, import_fields5.relationship)({ ref: "User" }),
    actorName: (0, import_fields5.text)(),
    occurredAt: (0, import_fields5.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" } }),
    facility: (0, import_fields5.relationship)({ ref: "Facility" }),
    locationText: (0, import_fields5.text)(),
    signerName: (0, import_fields5.text)(),
    signature: fileRef(),
    notes: (0, import_fields5.text)(),
    ...trackingFields
  }
});
var Asset = (0, import_core3.list)({
  access: staffAccess([...processRead], ["canAuditAssets", "canManageLots"], { delete: false }),
  ui: { labelField: "assetNumber", listView: { initialColumns: ["assetNumber", "serialNumber", "manufacturer", "model", "status", "sanitizationStatus", "disposition", "job"] } },
  hooks: {
    resolveInput: assignNumber("asset", "assetNumber"),
    validate: {
      update: async (args) => assertAssetMayChange(args),
      create: async (args) => assertAssetMayChange(args)
    }
  },
  fields: {
    assetNumber: documentNumber(),
    job: (0, import_fields5.relationship)({ ref: "Job.assets" }),
    container: (0, import_fields5.relationship)({ ref: "Container.assets" }),
    organization: (0, import_fields5.relationship)({ ref: "ClientOrganization", ...readOnly }),
    parent: (0, import_fields5.relationship)({ ref: "Asset.children" }),
    children: (0, import_fields5.relationship)({ ref: "Asset.parent", many: true }),
    category: (0, import_fields5.relationship)({ ref: "MaterialCategory" }),
    manufacturer: (0, import_fields5.text)(),
    model: (0, import_fields5.text)(),
    partNumber: (0, import_fields5.text)(),
    serialNumber: (0, import_fields5.text)({ isIndexed: true }),
    clientAssetTag: (0, import_fields5.text)({ isIndexed: true }),
    specs: (0, import_fields5.json)({ defaultValue: {} }),
    isDataBearing: (0, import_fields5.checkbox)({ defaultValue: false }),
    cosmeticGrade: (0, import_fields5.relationship)({ ref: "GradeDefinition" }),
    functionalGrade: (0, import_fields5.relationship)({ ref: "GradeDefinition" }),
    testNotes: (0, import_fields5.text)({ ui: { displayMode: "textarea" } }),
    weight: (0, import_fields5.decimal)({ precision: 12, scale: 2 }),
    photos: (0, import_fields5.relationship)({ ref: "AssetPhoto.asset", many: true }),
    status: status(ASSET_STATUSES, "received"),
    holdFromStatus: (0, import_fields5.text)({ ...readOnly }),
    sanitizationStatus: status(SANITIZATION_STATUSES, "not_required"),
    disposition: select_disposition(),
    holdReason: (0, import_fields5.text)({ ...readOnly }),
    storageRemoved: (0, import_fields5.checkbox)({ defaultValue: false }),
    fairMarketValueMinor: (0, import_fields5.integer)({ validation: { min: 0 } }),
    lotLine: (0, import_fields5.relationship)({ ref: "LotLine.assets", ...readOnly }),
    soldPriceMinor: (0, import_fields5.integer)({ validation: { min: 0 }, ...readOnly }),
    outboundLine: (0, import_fields5.relationship)({ ref: "OutboundShipmentLine.assets", ...readOnly }),
    sanitizationRecords: (0, import_fields5.relationship)({ ref: "SanitizationRecord.asset", many: true, ...readOnly }),
    custodyEvents: (0, import_fields5.relationship)({ ref: "CustodyEvent.asset", many: true, ...readOnly }),
    locationCode: (0, import_fields5.text)(),
    auditedBy: userRef({ readOnly: true }),
    auditedAt: (0, import_fields5.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
function select_disposition() {
  return status(["undecided", "resale", "parts", "recycle", "return", "hold"], "undecided");
}
var AssetPhoto = (0, import_core3.list)({
  access: staffAccess([...processRead], ["canAuditAssets"]),
  fields: {
    asset: (0, import_fields5.relationship)({ ref: "Asset.photos" }),
    image: fileRef(),
    caption: (0, import_fields5.text)(),
    ...trackingFields
  }
});
var SanitizationRecord = (0, import_core3.list)({
  access: { operation: { query: anyOf(...processRead), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["asset", "method", "technique", "tool", "result", "operator", "verifiedBy", "completedAt"] } },
  fields: {
    asset: (0, import_fields5.relationship)({ ref: "Asset.sanitizationRecords" }),
    method: choice(["clear", "purge", "destroy"], "purge"),
    technique: choice(["overwrite", "block_erase", "crypto_erase", "secure_erase", "degauss", "shred", "crush", "disintegrate"], "overwrite"),
    standard: (0, import_fields5.text)({ defaultValue: "NIST SP 800-88" }),
    tool: (0, import_fields5.text)(),
    toolVersion: (0, import_fields5.text)(),
    reportReference: (0, import_fields5.text)(),
    reportFile: fileRef(),
    startedAt: (0, import_fields5.timestamp)(),
    completedAt: (0, import_fields5.timestamp)(),
    result: choice(["passed", "failed"], "passed"),
    failureReason: (0, import_fields5.text)(),
    operator: (0, import_fields5.relationship)({ ref: "User" }),
    verifiedBy: (0, import_fields5.relationship)({ ref: "User" }),
    verifiedAt: (0, import_fields5.timestamp)(),
    verificationNote: (0, import_fields5.text)(),
    witnessName: (0, import_fields5.text)(),
    importBatch: (0, import_fields5.relationship)({ ref: "ErasureImport.records" }),
    ...trackingFields
  }
});
var ErasureImport = (0, import_core3.list)({
  access: { operation: { query: anyOf(...processRead), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ["createdAt", "tool", "status", "rowCount", "matchedCount", "uploadedBy"] } },
  fields: {
    file: fileRef(),
    originalFilename: (0, import_fields5.text)(),
    tool: (0, import_fields5.text)(),
    status: status(["uploaded", "validated", "committed", "discarded"], "uploaded"),
    rowCount: (0, import_fields5.integer)({ defaultValue: 0 }),
    matchedCount: (0, import_fields5.integer)({ defaultValue: 0 }),
    unmatched: (0, import_fields5.json)({ defaultValue: [] }),
    rows: (0, import_fields5.json)({ defaultValue: [] }),
    records: (0, import_fields5.relationship)({ ref: "SanitizationRecord.importBatch", many: true }),
    uploadedBy: (0, import_fields5.relationship)({ ref: "User" }),
    ...trackingFields
  }
});
var CommodityLine = (0, import_core3.list)({
  access: staffAccess([...processRead], ["canAuditAssets", "canReceive", "canManageDownstream"]),
  ui: { listView: { initialColumns: ["job", "category", "weight", "outboundLine", "notes"] } },
  fields: {
    job: (0, import_fields5.relationship)({ ref: "Job.commodityLines" }),
    category: (0, import_fields5.relationship)({ ref: "MaterialCategory" }),
    weight: (0, import_fields5.decimal)({ precision: 12, scale: 2, validation: { isRequired: true }, defaultValue: "0" }),
    notes: (0, import_fields5.text)(),
    outboundLine: (0, import_fields5.relationship)({ ref: "OutboundShipmentLine.commodityLines", ...readOnly }),
    ...trackingFields
  }
});
var Certificate = (0, import_core3.list)({
  access: { operation: { query: anyOf(...jobRead, "canVerifySanitization"), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, labelField: "certificateNumber", listView: { initialColumns: ["certificateNumber", "type", "job", "organization", "status", "issuedAt"] } },
  fields: {
    certificateNumber: uniqueKey(),
    type: choice(["data_destruction", "recycling"], "data_destruction"),
    job: (0, import_fields5.relationship)({ ref: "Job.certificates" }),
    organization: (0, import_fields5.relationship)({ ref: "ClientOrganization" }),
    issuedAt: (0, import_fields5.timestamp)(),
    issuedBy: (0, import_fields5.relationship)({ ref: "User" }),
    verificationCode: (0, import_fields5.text)({ isIndexed: "unique", db: { isNullable: true }, access: { read: can("canIssueCertificates"), create: denyAll, update: denyAll } }),
    snapshot: (0, import_fields5.json)(),
    pdf: fileRef(),
    status: choice(["issued", "revoked"], "issued"),
    revokedReason: (0, import_fields5.text)(),
    revokedAt: (0, import_fields5.timestamp)(),
    replaces: (0, import_fields5.relationship)({ ref: "Certificate" }),
    ...trackingFields
  }
});
var Settlement = (0, import_core3.list)({
  access: staffAccess(["canManageSettlements", "canManageClients", "canManagePayments", "canViewReports"], "canManageSettlements", { create: false, delete: false }),
  ui: { labelField: "settlementNumber", listView: { initialColumns: ["settlementNumber", "job", "organization", "status", "netMinor", "publishedAt"] } },
  fields: {
    settlementNumber: documentNumber(),
    job: (0, import_fields5.relationship)({ ref: "Job.settlement", ...readOnly }),
    organization: (0, import_fields5.relationship)({ ref: "ClientOrganization", ...readOnly }),
    status: status(SETTLEMENT_STATUSES, "draft"),
    lines: (0, import_fields5.relationship)({ ref: "SettlementLine.settlement", many: true, ...readOnly }),
    feesTotalMinor: (0, import_fields5.integer)({ defaultValue: 0, ...readOnly }),
    clientShareTotalMinor: (0, import_fields5.integer)({ defaultValue: 0, ...readOnly }),
    netMinor: (0, import_fields5.integer)({ defaultValue: 0, ...readOnly, ui: { ...readOnly.ui, description: "Positive: owed to the client. Negative: owed by the client." } }),
    publishedAt: (0, import_fields5.timestamp)({ ...readOnly }),
    disputeNote: (0, import_fields5.text)({ ...readOnly }),
    disputeRecordedBy: userRef({ readOnly: true }),
    invoice: (0, import_fields5.relationship)({ ref: "Invoice.settlement", ...readOnly }),
    payoutMethod: choice(["cheque", "ach", "wire", "credit"]),
    payoutReference: (0, import_fields5.text)({ ...readOnly }),
    paidAt: (0, import_fields5.timestamp)({ ...readOnly }),
    pdf: fileRef({ readOnly: true }),
    ...trackingFields
  }
});
var SettlementLine = (0, import_core3.list)({
  access: { operation: { query: anyOf("canManageSettlements", "canManageClients", "canManagePayments", "canViewReports"), create: denyAll, update: denyAll, delete: denyAll } },
  fields: {
    settlement: (0, import_fields5.relationship)({ ref: "Settlement.lines" }),
    kind: choice(["service_fee", "asset_value", "commodity_value", "adjustment"], "service_fee"),
    description: (0, import_fields5.text)(),
    asset: (0, import_fields5.relationship)({ ref: "Asset" }),
    quantity: (0, import_fields5.decimal)({ precision: 12, scale: 3, defaultValue: "1" }),
    grossMinor: (0, import_fields5.integer)({ defaultValue: 0 }),
    clientShareBps: (0, import_fields5.integer)({ defaultValue: 0 }),
    clientAmountMinor: (0, import_fields5.integer)({ defaultValue: 0 }),
    ...trackingFields
  }
});
var DownstreamVendor = (0, import_core3.list)({
  access: staffAccess(["canManageDownstream", "canIssueCertificates", "canViewReports"], "canManageDownstream"),
  ui: { listView: { initialColumns: ["name", "countryCode", "status", "approvedOn", "reviewDueOn"] } },
  fields: {
    name: (0, import_fields5.text)({ validation: { isRequired: true } }),
    ...addressFields(),
    contactName: (0, import_fields5.text)(),
    contactEmail: (0, import_fields5.text)(),
    certifications: (0, import_fields5.json)({ defaultValue: [], ui: { description: '[{ "name": "R2v3", "number": "\u2026", "expiresOn": "2027-06-30" }]' } }),
    approvedCategories: (0, import_fields5.relationship)({ ref: "MaterialCategory", many: true }),
    status: choice(["pending", "approved", "suspended"], "pending"),
    approvedOn: (0, import_fields5.calendarDay)(),
    reviewDueOn: (0, import_fields5.calendarDay)(),
    dueDiligenceFile: fileRef(),
    notes: (0, import_fields5.text)({ ui: { displayMode: "textarea" } }),
    shipments: (0, import_fields5.relationship)({ ref: "OutboundShipment.vendor", many: true }),
    ...trackingFields
  }
});
var OutboundShipment = (0, import_core3.list)({
  access: staffAccess(["canManageDownstream", "canViewReports"], "canManageDownstream", { delete: false }),
  hooks: { resolveInput: assignNumber("shipment", "shipmentNumber") },
  ui: { labelField: "shipmentNumber", listView: { initialColumns: ["shipmentNumber", "vendor", "status", "shippedAt", "carrier", "receivedWeight"] } },
  fields: {
    shipmentNumber: documentNumber(),
    vendor: (0, import_fields5.relationship)({ ref: "DownstreamVendor.shipments" }),
    facility: (0, import_fields5.relationship)({ ref: "Facility" }),
    status: status(["draft", "shipped", "receipt_confirmed", "closed"], "draft"),
    shippedAt: (0, import_fields5.timestamp)({ ...readOnly }),
    carrier: (0, import_fields5.text)(),
    billOfLading: (0, import_fields5.text)(),
    lines: (0, import_fields5.relationship)({ ref: "OutboundShipmentLine.shipment", many: true }),
    totalWeight: (0, import_fields5.virtual)({
      field: import_core3.graphql.field({
        type: import_core3.graphql.Float,
        async resolve(item, _a, context) {
          const lines = await context.prisma.outboundShipmentLine.findMany({ where: { shipmentId: item.id }, select: { weight: true } });
          return sumDecimal(lines.map((l) => l.weight));
        }
      })
    }),
    receivedWeight: (0, import_fields5.decimal)({ precision: 12, scale: 2, ...readOnly }),
    receiptConfirmedAt: (0, import_fields5.timestamp)({ ...readOnly }),
    receiptDocument: fileRef({ readOnly: true }),
    destinationCountry: (0, import_fields5.text)(),
    ...trackingFields
  }
});
var OutboundShipmentLine = (0, import_core3.list)({
  access: staffAccess(["canManageDownstream", "canViewReports"], "canManageDownstream"),
  fields: {
    shipment: (0, import_fields5.relationship)({ ref: "OutboundShipment.lines" }),
    category: (0, import_fields5.relationship)({ ref: "MaterialCategory" }),
    weight: (0, import_fields5.decimal)({ precision: 12, scale: 2, defaultValue: "0", validation: { isRequired: true } }),
    containerCount: (0, import_fields5.integer)({ defaultValue: 0 }),
    assets: (0, import_fields5.relationship)({ ref: "Asset.outboundLine", many: true }),
    commodityLines: (0, import_fields5.relationship)({ ref: "CommodityLine.outboundLine", many: true }),
    ...trackingFields
  }
});
var buySideLists = {
  ClientOrganization,
  ClientSite,
  Job,
  JobEstimateLine,
  JobServiceLine,
  JobPhoto,
  Container,
  CustodyEvent,
  Asset,
  AssetPhoto,
  SanitizationRecord,
  ErasureImport,
  CommodityLine,
  Certificate,
  Settlement,
  SettlementLine,
  DownstreamVendor,
  OutboundShipment,
  OutboundShipmentLine
};

// features/keystone/models/sellSide.ts
var import_core4 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
var import_fields_document2 = require("@keystone-6/fields-document");

// features/keystone/lib/lotRules.ts
async function validateLotInput(args) {
  const { item, resolvedData, addValidationError } = args;
  const next = { ...item ?? {}, ...resolvedData };
  if (next.opensAt && next.closesAt && new Date(next.closesAt) <= new Date(next.opensAt)) addValidationError("The close time must be after the open time.");
  if (next.format === "fixed_price" && !(next.fixedPriceMinor > 0)) addValidationError("A fixed-price lot needs a price.");
  if (next.format === "open_auction" && !(next.bidIncrementMinor > 0)) addValidationError("An open auction needs a bid increment.");
  if (next.format === "fixed_price" && next.bidBasis === "per_line") addValidationError("A fixed-price lot is sold as a whole; use lot total.");
  if (item && item.status !== "draft") {
    const blocked = Object.keys(resolvedData).filter((key) => !LOT_EDITABLE_WHEN_OPEN.includes(key) && key !== "updatedAt");
    if (["open", "scheduled"].includes(item.status)) {
      if (blocked.length) addValidationError(`Once a lot is published only its description, photos and close time can change (not ${blocked.join(", ")}). Post an addendum for corrections.`);
      if (resolvedData.closesAt && item.closesAt && new Date(resolvedData.closesAt) < new Date(item.closesAt)) addValidationError("The close time can be extended, never shortened.");
    } else if (Object.keys(resolvedData).some((k) => !["description", "conditionSummary", "updatedAt", "images"].includes(k))) {
      addValidationError("This lot is no longer open for changes.");
    }
  }
}
async function lotLineMayChange(args) {
  const lotId = args.resolvedData?.lot?.connect?.id ?? args.item?.lotId;
  if (!lotId) return;
  const lot = await args.context.prisma.lot.findUnique({ where: { id: lotId }, select: { status: true } });
  if (lot && lot.status !== "draft") args.addValidationError("Lot lines are frozen once the lot is published. Post an addendum instead.");
}

// features/keystone/models/sellSide.ts
var BUYER_STATUSES = ["draft", "submitted", "under_review", "needs_info", "approved", "rejected", "suspended", "closed"];
var LOT_STATUSES = ["draft", "scheduled", "open", "closed", "awarded", "completed", "unsold", "cancelled"];
var BID_STATUSES = ["active", "superseded", "withdrawn", "won", "partially_won", "lost", "void", "defaulted", "expired"];
var ORDER_STATUSES = ["awaiting_payment", "paid", "ready_for_release", "released", "completed", "defaulted", "cancelled"];
var sellRead = ["canManageBuyers", "canManageLots", "canAwardLots", "canManagePayments", "canViewReports", "canDispatch"];
var BuyerCompany = (0, import_core4.list)({
  access: staffAccess([...sellRead], "canManageBuyers", { delete: false }),
  ui: { labelField: "legalName", listView: { initialColumns: ["legalName", "tradingName", "countryCode", "status", "taxStatus", "strikes", "spendLimitMinor"] } },
  fields: {
    legalName: (0, import_fields7.text)({ validation: { isRequired: true } }),
    tradingName: (0, import_fields7.text)(),
    ...addressFields(),
    phone: (0, import_fields7.text)(),
    website: (0, import_fields7.text)(),
    taxId: (0, import_fields7.text)(),
    businessType: choice(["refurbisher", "reseller", "exporter", "recycler", "broker", "other"]),
    categoriesOfInterest: (0, import_fields7.relationship)({ ref: "MaterialCategory", many: true }),
    monthlySpendBand: choice(["under_5k", "from_5k_to_25k", "from_25k_to_100k", "over_100k"]),
    destinationCountries: (0, import_fields7.json)({ defaultValue: [] }),
    status: status(BUYER_STATUSES, "draft"),
    statusReason: (0, import_fields7.text)({ ...readOnly }),
    taxStatus: choice(["taxable", "exempt_resale", "export"], "taxable"),
    spendLimitMinor: (0, import_fields7.integer)({ validation: { min: 0 }, ui: { description: "Bids plus unpaid awards may not exceed this. Empty means no limit." } }),
    strikes: (0, import_fields7.integer)({ defaultValue: 0, ...readOnly }),
    approvedAt: (0, import_fields7.timestamp)({ ...readOnly }),
    approvedBy: userRef({ readOnly: true }),
    submittedAt: (0, import_fields7.timestamp)({ ...readOnly }),
    rejectedAt: (0, import_fields7.timestamp)({ ...readOnly }),
    termsVersionAccepted: (0, import_fields7.text)({ ...readOnly }),
    termsAcceptedAt: (0, import_fields7.timestamp)({ ...readOnly }),
    users: (0, import_fields7.relationship)({ ref: "User.buyerCompany", many: true }),
    documents: (0, import_fields7.relationship)({ ref: "BuyerDocument.company", many: true }),
    messages: (0, import_fields7.relationship)({ ref: "BuyerMessage.company", many: true }),
    bids: (0, import_fields7.relationship)({ ref: "Bid.company", many: true, ...readOnly }),
    orders: (0, import_fields7.relationship)({ ref: "Order.company", many: true, ...readOnly }),
    invoices: (0, import_fields7.relationship)({ ref: "Invoice.buyerCompany", many: true, ...readOnly }),
    internalNotes: (0, import_fields7.text)({ ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});
var BuyerDocument = (0, import_core4.list)({
  access: staffAccess([...sellRead], "canManageBuyers"),
  ui: { listView: { initialColumns: ["company", "type", "state", "expiresOn", "status"] } },
  fields: {
    company: (0, import_fields7.relationship)({ ref: "BuyerCompany.documents" }),
    type: choice(["resale_certificate", "export_license", "business_registration", "w9", "r2_certificate", "other"], "resale_certificate"),
    file: fileRef(),
    state: (0, import_fields7.text)({ ui: { description: "Issuing US state, for a resale certificate." } }),
    expiresOn: (0, import_fields7.calendarDay)(),
    status: choice(["submitted", "accepted", "rejected"], "submitted"),
    reviewNote: (0, import_fields7.text)(),
    uploadedBy: (0, import_fields7.relationship)({ ref: "User" }),
    expiryHandledAt: (0, import_fields7.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var BuyerMessage = (0, import_core4.list)({
  access: staffAccess([...sellRead], "canManageBuyers", { update: false, delete: false }),
  ui: { listView: { initialColumns: ["company", "author", "fromStaff", "createdAt"] } },
  fields: {
    company: (0, import_fields7.relationship)({ ref: "BuyerCompany.messages" }),
    author: (0, import_fields7.relationship)({ ref: "User" }),
    body: (0, import_fields7.text)({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    fromStaff: (0, import_fields7.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var SaleEvent = (0, import_core4.list)({
  access: staffAccess([...sellRead], "canManageLots", { delete: false }),
  ui: { labelField: "title", listView: { initialColumns: ["title", "opensAt", "closesAt", "status", "announcementSentAt"] } },
  fields: {
    title: (0, import_fields7.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields7.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    description: (0, import_fields7.text)({ ui: { displayMode: "textarea" } }),
    opensAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    closesAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    status: status(["draft", "published", "closed"], "draft"),
    lots: (0, import_fields7.relationship)({ ref: "Lot.saleEvent", many: true }),
    announcementSentAt: (0, import_fields7.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var Lot = (0, import_core4.list)({
  access: {
    operation: { query: anyOf(...sellRead), create: can("canManageLots"), update: can("canManageLots"), delete: can("canManageLots") },
    item: { delete: ({ item }) => item.status === "draft" }
  },
  ui: { labelField: "lotNumber", listView: { initialColumns: ["lotNumber", "title", "status", "format", "bidBasis", "closesAt", "bidCount"] } },
  hooks: { resolveInput: assignNumber("lot", "lotNumber"), validate: { create: validateLotInput, update: validateLotInput } },
  fields: {
    lotNumber: documentNumber(),
    title: (0, import_fields7.text)({ validation: { isRequired: true } }),
    slug: (0, import_fields7.text)({ isIndexed: true }),
    saleEvent: (0, import_fields7.relationship)({ ref: "SaleEvent.lots" }),
    category: (0, import_fields7.relationship)({ ref: "MaterialCategory" }),
    description: (0, import_fields_document2.document)({ formatting: true, links: true }),
    conditionSummary: (0, import_fields7.text)({ ui: { displayMode: "textarea" } }),
    facility: (0, import_fields7.relationship)({ ref: "Facility" }),
    status: status(LOT_STATUSES, "draft"),
    format: choice(["sealed_bid", "open_auction", "fixed_price"], "sealed_bid"),
    bidBasis: choice(["lot_total", "per_line"], "lot_total"),
    awardMode: choice(["manual", "auto"], "manual"),
    opensAt: (0, import_fields7.timestamp)(),
    closesAt: (0, import_fields7.timestamp)(),
    originalClosesAt: (0, import_fields7.timestamp)({ ...readOnly }),
    extensionCount: (0, import_fields7.integer)({ defaultValue: 0, ...readOnly }),
    openingBidMinor: (0, import_fields7.integer)({ validation: { min: 0 } }),
    reserveMinor: (0, import_fields7.integer)({ validation: { min: 0 }, access: { read: anyOf("canManageLots", "canAwardLots") } }),
    bidIncrementMinor: (0, import_fields7.integer)({ validation: { min: 0 } }),
    fixedPriceMinor: (0, import_fields7.integer)({ validation: { min: 0 } }),
    currentAmountMinor: (0, import_fields7.integer)({ ...readOnly, access: { create: denyAll, update: denyAll, read: ({ session, item }) => item.format !== "sealed_bid" || hasPermission(session, "canSeeSealedBidAmountsBeforeClose") || !["open", "scheduled"].includes(String(item.status)) } }),
    bidCount: (0, import_fields7.integer)({ defaultValue: 0, ...readOnly }),
    unitCount: (0, import_fields7.virtual)({
      field: import_core4.graphql.field({
        type: import_core4.graphql.Int,
        async resolve(item, _a, context) {
          const result = await context.prisma.lotLine.aggregate({ where: { lotId: item.id, unit: "each" }, _sum: { quantity: true } });
          return Number(result._sum.quantity ?? 0);
        }
      })
    }),
    palletCount: (0, import_fields7.integer)({ validation: { min: 0 } }),
    weight: (0, import_fields7.decimal)({ precision: 12, scale: 2 }),
    dimensions: (0, import_fields7.text)(),
    shippingTerms: choice(["buyer_arranged", "seller_quoted", "pickup_only"], "buyer_arranged"),
    exportAllowed: (0, import_fields7.checkbox)({ defaultValue: true }),
    warrantyDays: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
    lines: (0, import_fields7.relationship)({ ref: "LotLine.lot", many: true }),
    images: (0, import_fields7.relationship)({ ref: "LotImage.lot", many: true }),
    bids: (0, import_fields7.relationship)({ ref: "Bid.lot", many: true, ...readOnly }),
    awards: (0, import_fields7.relationship)({ ref: "Award.lot", many: true, ...readOnly }),
    addenda: (0, import_fields7.relationship)({ ref: "LotAddendum.lot", many: true, ...readOnly }),
    relistedFrom: (0, import_fields7.relationship)({ ref: "Lot", ...readOnly }),
    cancelReason: (0, import_fields7.text)({ ...readOnly }),
    sourceImport: (0, import_fields7.relationship)({ ref: "ManifestImport.lot", ...readOnly }),
    publishedAt: (0, import_fields7.timestamp)({ ...readOnly }),
    closedAt: (0, import_fields7.timestamp)({ ...readOnly }),
    reminder24SentAt: (0, import_fields7.timestamp)({ ...readOnly }),
    reminder2SentAt: (0, import_fields7.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var LotLine = (0, import_core4.list)({
  access: {
    operation: { query: anyOf(...sellRead), create: can("canManageLots"), update: can("canManageLots"), delete: can("canManageLots") }
  },
  hooks: { validate: { create: lotLineMayChange, update: lotLineMayChange, delete: lotLineMayChange } },
  ui: { listView: { initialColumns: ["lot", "lineNumber", "manufacturer", "model", "description", "quantity", "functionalGrade"] } },
  fields: {
    lot: (0, import_fields7.relationship)({ ref: "Lot.lines" }),
    lineNumber: (0, import_fields7.integer)({ validation: { isRequired: true, min: 1 }, defaultValue: 1 }),
    category: (0, import_fields7.relationship)({ ref: "MaterialCategory" }),
    manufacturer: (0, import_fields7.text)(),
    model: (0, import_fields7.text)(),
    partNumber: (0, import_fields7.text)(),
    description: (0, import_fields7.text)(),
    specs: (0, import_fields7.json)({ defaultValue: {} }),
    cosmeticGrade: (0, import_fields7.text)(),
    functionalGrade: (0, import_fields7.text)(),
    quantity: (0, import_fields7.integer)({ defaultValue: 1, validation: { isRequired: true, min: 0 } }),
    unit: choice(["each", "lb", "kg"], "each"),
    serials: (0, import_fields7.json)({ defaultValue: [] }),
    notes: (0, import_fields7.text)(),
    assets: (0, import_fields7.relationship)({ ref: "Asset.lotLine", many: true, ...readOnly }),
    extra: (0, import_fields7.json)({ defaultValue: {} }),
    ...trackingFields
  }
});
var LotImage = (0, import_core4.list)({
  access: staffAccess([...sellRead], "canManageLots"),
  fields: {
    lot: (0, import_fields7.relationship)({ ref: "Lot.images" }),
    image: fileRef(),
    caption: (0, import_fields7.text)(),
    sortOrder: (0, import_fields7.integer)({ defaultValue: 0 }),
    ...trackingFields
  }
});
var LotAddendum = (0, import_core4.list)({
  access: { operation: { query: anyOf(...sellRead), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true },
  fields: {
    lot: (0, import_fields7.relationship)({ ref: "Lot.addenda" }),
    body: (0, import_fields7.text)({ ui: { displayMode: "textarea" } }),
    postedBy: (0, import_fields7.relationship)({ ref: "User" }),
    postedAt: (0, import_fields7.timestamp)({ defaultValue: { kind: "now" } }),
    ...trackingFields
  }
});
var ManifestImport = (0, import_core4.list)({
  access: { operation: { query: can("canManageLots"), create: denyAll, update: denyAll, delete: can("canManageLots") } },
  ui: { hideCreate: true, listView: { initialColumns: ["originalFilename", "status", "rowCount", "validCount", "errorCount", "lot", "createdAt"] } },
  fields: {
    file: fileRef(),
    originalFilename: (0, import_fields7.text)(),
    status: status(["uploaded", "mapped", "validated", "committed", "discarded"], "uploaded"),
    sheetName: (0, import_fields7.text)(),
    sheetNames: (0, import_fields7.json)({ defaultValue: [] }),
    headerRow: (0, import_fields7.integer)({ defaultValue: 1 }),
    headers: (0, import_fields7.json)({ defaultValue: [] }),
    mapping: (0, import_fields7.json)({ defaultValue: {} }),
    rowCount: (0, import_fields7.integer)({ defaultValue: 0 }),
    validCount: (0, import_fields7.integer)({ defaultValue: 0 }),
    errorCount: (0, import_fields7.integer)({ defaultValue: 0 }),
    rows: (0, import_fields7.json)({ defaultValue: [] }),
    lot: (0, import_fields7.relationship)({ ref: "Lot.sourceImport" }),
    purpose: choice(["lot_manifest", "asset_import"], "lot_manifest"),
    targetJob: (0, import_fields7.relationship)({ ref: "Job" }),
    uploadedBy: (0, import_fields7.relationship)({ ref: "User" }),
    ...trackingFields
  }
});
var ManifestMapping = (0, import_core4.list)({
  access: staffAccess("canManageLots", "canManageLots"),
  fields: {
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    mapping: (0, import_fields7.json)({ defaultValue: {} }),
    ...trackingFields
  }
});
var Bid = (0, import_core4.list)({
  access: { operation: { query: anyOf("canManageLots", "canAwardLots", "canViewReports"), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["lot", "company", "amountMinor", "status", "source", "submittedAt"] } },
  fields: {
    lot: (0, import_fields7.relationship)({ ref: "Lot.bids" }),
    company: (0, import_fields7.relationship)({ ref: "BuyerCompany.bids" }),
    placedBy: (0, import_fields7.relationship)({ ref: "User" }),
    amountMinor: (0, import_fields7.integer)({
      validation: { isRequired: true },
      defaultValue: 0,
      access: { read: async ({ session, item, context }) => {
        if (hasPermission(session, "canSeeSealedBidAmountsBeforeClose")) return true;
        const lot = await context.prisma.lot.findUnique({ where: { id: item.lotId }, select: { format: true, status: true } });
        return !(lot?.format === "sealed_bid" && ["open", "scheduled"].includes(lot?.status));
      } }
    }),
    status: choice(BID_STATUSES, "active"),
    activeKey: uniqueKey({ hidden: true }),
    submittedAt: (0, import_fields7.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" } }),
    source: choice(["web", "bid_sheet", "staff_entry"], "web"),
    staffNote: (0, import_fields7.text)(),
    sheetFile: fileRef(),
    lines: (0, import_fields7.relationship)({ ref: "BidLine.bid", many: true }),
    idempotencyKey: uniqueKey({ hidden: true }),
    requestHash: (0, import_fields7.text)({ access: { read: denyAll }, ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    ipAddress: (0, import_fields7.text)(),
    userAgent: (0, import_fields7.text)(),
    supersedes: (0, import_fields7.relationship)({ ref: "Bid" }),
    ...trackingFields
  }
});
var BidLine = (0, import_core4.list)({
  access: { operation: { query: anyOf("canManageLots", "canAwardLots"), create: denyAll, update: denyAll, delete: denyAll } },
  fields: {
    bid: (0, import_fields7.relationship)({ ref: "Bid.lines" }),
    lotLine: (0, import_fields7.relationship)({ ref: "LotLine" }),
    unitPriceMinor: (0, import_fields7.integer)({ defaultValue: 0 }),
    quantity: (0, import_fields7.integer)({ defaultValue: 0 }),
    status: choice(["active", "won", "lost"], "active"),
    ...trackingFields
  }
});
var Award = (0, import_core4.list)({
  access: { operation: { query: anyOf("canManageLots", "canAwardLots", "canManagePayments", "canViewReports"), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ["lot", "company", "amountMinor", "status", "isBelowReserve", "awardedAt"] } },
  fields: {
    lot: (0, import_fields7.relationship)({ ref: "Lot.awards" }),
    bid: (0, import_fields7.relationship)({ ref: "Bid" }),
    company: (0, import_fields7.relationship)({ ref: "BuyerCompany" }),
    awardedBy: (0, import_fields7.relationship)({ ref: "User" }),
    awardedAt: (0, import_fields7.timestamp)(),
    amountMinor: (0, import_fields7.integer)({ defaultValue: 0 }),
    isBelowReserve: (0, import_fields7.checkbox)({ defaultValue: false }),
    overrideReason: (0, import_fields7.text)(),
    status: choice(["active", "defaulted", "cancelled"], "active"),
    activeLotKey: uniqueKey({ hidden: true }),
    lines: (0, import_fields7.relationship)({ ref: "AwardLine.award", many: true }),
    order: (0, import_fields7.relationship)({ ref: "Order.award" }),
    ...trackingFields
  }
});
var AwardLine = (0, import_core4.list)({
  access: { operation: { query: anyOf("canManageLots", "canAwardLots"), create: denyAll, update: denyAll, delete: denyAll } },
  fields: {
    award: (0, import_fields7.relationship)({ ref: "Award.lines" }),
    lotLine: (0, import_fields7.relationship)({ ref: "LotLine" }),
    activeLotLineKey: uniqueKey({ hidden: true }),
    bidLine: (0, import_fields7.relationship)({ ref: "BidLine" }),
    quantity: (0, import_fields7.integer)({ defaultValue: 0 }),
    unitPriceMinor: (0, import_fields7.integer)({ defaultValue: 0 }),
    totalMinor: (0, import_fields7.integer)({ defaultValue: 0 }),
    ...trackingFields
  }
});
var Order = (0, import_core4.list)({
  access: staffAccess([...sellRead], ["canManageLots", "canDispatch", "canManagePayments"], { create: false, delete: false }),
  ui: { labelField: "orderNumber", listView: { initialColumns: ["orderNumber", "company", "lot", "status", "paymentDueAt", "releaseMethod", "preferredPickupDate"] } },
  fields: {
    orderNumber: documentNumber(),
    company: (0, import_fields7.relationship)({ ref: "BuyerCompany.orders", ...readOnly }),
    award: (0, import_fields7.relationship)({ ref: "Award.order", ...readOnly }),
    lot: (0, import_fields7.relationship)({ ref: "Lot", ...readOnly }),
    status: status(ORDER_STATUSES, "awaiting_payment"),
    invoice: (0, import_fields7.relationship)({ ref: "Invoice.order", ...readOnly }),
    lines: (0, import_fields7.relationship)({ ref: "OrderLine.order", many: true, ...readOnly }),
    paymentDueAt: (0, import_fields7.timestamp)(),
    readyAt: (0, import_fields7.timestamp)({ ...readOnly }),
    removalDueAt: (0, import_fields7.timestamp)(),
    releaseMethod: choice(["pickup", "freight"]),
    preferredPickupDate: (0, import_fields7.calendarDay)(),
    dockAppointment: (0, import_fields7.relationship)({ ref: "DockAppointment.order" }),
    carrierName: (0, import_fields7.text)(),
    carrierReference: (0, import_fields7.text)(),
    freightPickupDate: (0, import_fields7.calendarDay)(),
    destinationCountry: (0, import_fields7.text)(),
    exportAcknowledgedAt: (0, import_fields7.timestamp)({ ...readOnly }),
    releaseDetailsSetAt: (0, import_fields7.timestamp)({ ...readOnly }),
    palletCount: (0, import_fields7.integer)({ validation: { min: 0 } }),
    weight: (0, import_fields7.decimal)({ precision: 12, scale: 2 }),
    dimensions: (0, import_fields7.text)(),
    billOfLading: (0, import_fields7.text)({ ...readOnly }),
    releasedAt: (0, import_fields7.timestamp)({ ...readOnly }),
    releasedBy: userRef({ readOnly: true }),
    driverName: (0, import_fields7.text)(),
    driverSignature: fileRef({ readOnly: true }),
    claimWindowEndsAt: (0, import_fields7.timestamp)({ ...readOnly }),
    claims: (0, import_fields7.relationship)({ ref: "Claim.order", many: true, ...readOnly }),
    restockingInvoice: (0, import_fields7.relationship)({ ref: "Invoice", ...readOnly }),
    runnerUpOfferedAt: (0, import_fields7.timestamp)({ ...readOnly }),
    cancelReason: (0, import_fields7.text)({ ...readOnly }),
    ...trackingFields
  }
});
var OrderLine = (0, import_core4.list)({
  access: { operation: { query: anyOf(...sellRead), create: denyAll, update: denyAll, delete: denyAll } },
  fields: {
    order: (0, import_fields7.relationship)({ ref: "Order.lines" }),
    lineNumber: (0, import_fields7.integer)({ defaultValue: 1 }),
    description: (0, import_fields7.text)(),
    manufacturer: (0, import_fields7.text)(),
    model: (0, import_fields7.text)(),
    specs: (0, import_fields7.json)({ defaultValue: {} }),
    grade: (0, import_fields7.text)(),
    quantity: (0, import_fields7.integer)({ defaultValue: 0 }),
    unit: (0, import_fields7.text)({ defaultValue: "each" }),
    unitPriceMinor: (0, import_fields7.integer)({ defaultValue: 0 }),
    totalMinor: (0, import_fields7.integer)({ defaultValue: 0 }),
    serials: (0, import_fields7.json)({ defaultValue: [] }),
    sourceLotLineId: (0, import_fields7.text)(),
    ...trackingFields
  }
});
var DockAppointment = (0, import_core4.list)({
  access: staffAccess([...sellRead, "canManageJobs", "canReceive"], false),
  ui: { hideCreate: true, listView: { initialColumns: ["startsAt", "facility", "order", "job", "driverName", "status"] } },
  fields: {
    facility: (0, import_fields7.relationship)({ ref: "Facility" }),
    startsAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    endsAt: (0, import_fields7.timestamp)({ validation: { isRequired: true } }),
    order: (0, import_fields7.relationship)({ ref: "Order.dockAppointment" }),
    job: (0, import_fields7.relationship)({ ref: "Job.dockAppointments" }),
    driverName: (0, import_fields7.text)(),
    vehicle: (0, import_fields7.text)(),
    notes: (0, import_fields7.text)(),
    status: choice(["booked", "arrived", "done", "cancelled", "no_show"], "booked"),
    ...trackingFields
  }
});
var Claim = (0, import_core4.list)({
  access: staffAccess([...sellRead], false),
  ui: { hideCreate: true, labelField: "claimNumber", listView: { initialColumns: ["claimNumber", "order", "company", "reason", "status", "requestedAmountMinor", "approvedAmountMinor"] } },
  fields: {
    claimNumber: uniqueKey(),
    order: (0, import_fields7.relationship)({ ref: "Order.claims" }),
    company: (0, import_fields7.relationship)({ ref: "BuyerCompany" }),
    openedBy: (0, import_fields7.relationship)({ ref: "User" }),
    reason: choice(["shortage", "wrong_item", "misgraded", "dead_on_arrival", "damage", "other"], "shortage"),
    description: (0, import_fields7.text)({ ui: { displayMode: "textarea" } }),
    lines: (0, import_fields7.json)({ defaultValue: [] }),
    photos: (0, import_fields7.relationship)({ ref: "ClaimPhoto.claim", many: true }),
    requestedAmountMinor: (0, import_fields7.integer)({ defaultValue: 0 }),
    status: choice(["submitted", "under_review", "approved", "denied", "resolved"], "submitted"),
    resolution: choice(["refund", "partial_refund", "return_and_refund", "denied"]),
    approvedAmountMinor: (0, import_fields7.integer)(),
    resolutionNote: (0, import_fields7.text)(),
    resolvedBy: (0, import_fields7.relationship)({ ref: "User" }),
    resolvedAt: (0, import_fields7.timestamp)(),
    refund: (0, import_fields7.relationship)({ ref: "Refund.claim" }),
    ...trackingFields
  }
});
var ClaimPhoto = (0, import_core4.list)({
  access: staffAccess([...sellRead], "canManageLots"),
  fields: {
    claim: (0, import_fields7.relationship)({ ref: "Claim.photos" }),
    image: fileRef(),
    caption: (0, import_fields7.text)(),
    ...trackingFields
  }
});
var sellSideLists = {
  BuyerCompany,
  BuyerDocument,
  BuyerMessage,
  SaleEvent,
  Lot,
  LotLine,
  LotImage,
  LotAddendum,
  ManifestImport,
  ManifestMapping,
  Bid,
  BidLine,
  Award,
  AwardLine,
  Order,
  OrderLine,
  DockAppointment,
  Claim,
  ClaimPhoto
};

// features/keystone/models/money.ts
var import_core5 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var moneyRead = ["canManagePayments", "canRefund", "canManageSettlements", "canManageLots", "canAwardLots", "canManageClients", "canViewReports"];
var INVOICE_STATUSES = ["open", "partially_paid", "paid", "partially_refunded", "refunded", "void"];
var Invoice = (0, import_core5.list)({
  access: staffAccess([...moneyRead], false),
  ui: { hideCreate: true, hideDelete: true, labelField: "invoiceNumber", listView: { initialColumns: ["invoiceNumber", "kind", "buyerCompany", "clientOrganization", "status", "totalMinor", "paidMinor", "dueAt"] } },
  fields: {
    invoiceNumber: uniqueKey(),
    kind: choice(["lot_sale", "service", "settlement", "restocking", "storage"], "lot_sale"),
    buyerCompany: (0, import_fields9.relationship)({ ref: "BuyerCompany.invoices" }),
    clientOrganization: (0, import_fields9.relationship)({ ref: "ClientOrganization.invoices" }),
    order: (0, import_fields9.relationship)({ ref: "Order.invoice" }),
    job: (0, import_fields9.relationship)({ ref: "Job.invoices" }),
    settlement: (0, import_fields9.relationship)({ ref: "Settlement.invoice" }),
    status: status(INVOICE_STATUSES, "open"),
    lines: (0, import_fields9.relationship)({ ref: "InvoiceLine.invoice", many: true }),
    subtotalMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    premiumMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    taxMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    freightMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    feeMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    otherMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    totalMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    paidMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    refundedMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    balanceMinor: (0, import_fields9.virtual)({
      field: import_core5.graphql.field({ type: import_core5.graphql.Int, resolve: (item) => Math.max(0, (item.totalMinor ?? 0) - (item.paidMinor ?? 0)) })
    }),
    currencyCode: (0, import_fields9.text)({ defaultValue: "USD" }),
    issuedAt: (0, import_fields9.timestamp)(),
    dueAt: (0, import_fields9.timestamp)(),
    isOverdue: (0, import_fields9.checkbox)({ defaultValue: false }),
    remindedAt: (0, import_fields9.timestamp)(),
    paidAt: (0, import_fields9.timestamp)(),
    voidReason: (0, import_fields9.text)(),
    waived: (0, import_fields9.checkbox)({ defaultValue: false }),
    taxExemptReason: (0, import_fields9.text)(),
    billTo: (0, import_fields9.json)({ defaultValue: {} }),
    payments: (0, import_fields9.relationship)({ ref: "Payment.invoice", many: true }),
    paymentSessions: (0, import_fields9.relationship)({ ref: "PaymentSession.invoice", many: true }),
    refunds: (0, import_fields9.relationship)({ ref: "Refund.invoice", many: true }),
    pdf: fileRef({ readOnly: true }),
    ...trackingFields
  }
});
var InvoiceLine = (0, import_core5.list)({
  access: { operation: { query: anyOf(...moneyRead), create: denyAll, update: denyAll, delete: denyAll } },
  fields: {
    invoice: (0, import_fields9.relationship)({ ref: "Invoice.lines" }),
    kind: choice(["item", "premium", "tax", "freight", "card_fee", "storage", "service", "adjustment"], "item"),
    description: (0, import_fields9.text)(),
    quantity: (0, import_fields9.decimal)({ precision: 12, scale: 3, defaultValue: "1" }),
    unitPriceMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    totalMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    paymentSessionId: (0, import_fields9.text)({ ui: { description: "Card fee lines belong to one payment session." } }),
    ...trackingFields
  }
});
var PaymentProvider = (0, import_core5.list)({
  access: staffAccess(["canManagePayments", "canManageSettings"], ["canManageSettings", "canManagePayments"], { delete: false }),
  ui: { listView: { initialColumns: ["name", "code", "isInstalled"] } },
  fields: {
    name: (0, import_fields9.text)({ validation: { isRequired: true } }),
    code: (0, import_fields9.text)({
      isIndexed: "unique",
      validation: { isRequired: true, match: { regex: /^pp_[a-zA-Z0-9-_]+$/, explanation: 'Payment provider code must start with "pp_".' } }
    }),
    isInstalled: (0, import_fields9.checkbox)({ defaultValue: true }),
    credentials: (0, import_fields9.json)({ defaultValue: {}, access: { read: denyAll, create: denyAll, update: denyAll }, ui: { itemView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    metadata: (0, import_fields9.json)({ defaultValue: {} }),
    createPaymentFunction: (0, import_fields9.text)({ defaultValue: "manual", validation: { isRequired: true } }),
    capturePaymentFunction: (0, import_fields9.text)({ defaultValue: "manual", validation: { isRequired: true } }),
    refundPaymentFunction: (0, import_fields9.text)({ defaultValue: "manual", validation: { isRequired: true } }),
    getPaymentStatusFunction: (0, import_fields9.text)({ defaultValue: "manual", validation: { isRequired: true } }),
    generatePaymentLinkFunction: (0, import_fields9.text)({ defaultValue: "manual", validation: { isRequired: true } }),
    handleWebhookFunction: (0, import_fields9.text)({ defaultValue: "manual", validation: { isRequired: true } }),
    paymentSessions: (0, import_fields9.relationship)({ ref: "PaymentSession.paymentProvider", many: true, ...readOnly }),
    ...trackingFields
  }
});
var PaymentSession = (0, import_core5.list)({
  access: { operation: { query: anyOf("canManagePayments", "canRefund"), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ["invoice", "method", "status", "amountMinor", "providerPaymentId", "createdAt"] } },
  fields: {
    invoice: (0, import_fields9.relationship)({ ref: "Invoice.paymentSessions" }),
    paymentProvider: (0, import_fields9.relationship)({ ref: "PaymentProvider.paymentSessions" }),
    method: choice(["card", "bank_transfer"], "card"),
    openKey: uniqueKey({ hidden: true }),
    idempotencyKeyHash: uniqueKey({ hidden: true }),
    status: choice(["pending", "requires_action", "captured", "failed", "canceled", "unknown"], "pending"),
    amountMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    feeMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    currencyCode: (0, import_fields9.text)({ defaultValue: "USD" }),
    providerPaymentId: (0, import_fields9.text)({ isIndexed: true }),
    clientSecret: (0, import_fields9.text)({ access: { read: denyAll }, ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    capturedAt: (0, import_fields9.timestamp)(),
    canceledAt: (0, import_fields9.timestamp)(),
    lastError: (0, import_fields9.text)(),
    createdBy: (0, import_fields9.relationship)({ ref: "User" }),
    metadata: (0, import_fields9.json)({ defaultValue: {} }),
    payment: (0, import_fields9.relationship)({ ref: "Payment.session" }),
    ...trackingFields
  }
});
var PaymentWebhookEvent = (0, import_core5.list)({
  access: { operation: { query: can("canManagePayments"), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ["providerCode", "providerEventId", "eventType", "processedAt"] } },
  fields: {
    replayKey: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { read: denyAll } }),
    providerCode: (0, import_fields9.text)({ validation: { isRequired: true } }),
    providerEventId: (0, import_fields9.text)({ validation: { isRequired: true } }),
    eventType: (0, import_fields9.text)({ validation: { isRequired: true } }),
    payloadHash: (0, import_fields9.text)({ validation: { isRequired: true }, access: { read: denyAll } }),
    processedAt: (0, import_fields9.timestamp)({ validation: { isRequired: true } }),
    outcome: (0, import_fields9.text)(),
    ...trackingFields
  }
});
var Payment = (0, import_core5.list)({
  access: { operation: { query: anyOf(...moneyRead), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ["invoice", "method", "amountMinor", "status", "bankReference", "reportedAt", "confirmedAt"] } },
  fields: {
    invoice: (0, import_fields9.relationship)({ ref: "Invoice.payments" }),
    session: (0, import_fields9.relationship)({ ref: "PaymentSession.payment" }),
    method: choice(["card", "ach", "wire", "cheque", "cash"], "wire"),
    amountMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    status: choice(["reported", "confirmed", "rejected", "captured", "refunded", "partially_refunded"], "reported"),
    providerReference: uniqueKey(),
    bankReference: (0, import_fields9.text)(),
    paidOn: (0, import_fields9.text)(),
    reportedBy: (0, import_fields9.relationship)({ ref: "User" }),
    reportedAt: (0, import_fields9.timestamp)(),
    confirmedBy: (0, import_fields9.relationship)({ ref: "User" }),
    confirmedAt: (0, import_fields9.timestamp)(),
    rejectionReason: (0, import_fields9.text)(),
    refundedMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    refunds: (0, import_fields9.relationship)({ ref: "Refund.payment", many: true }),
    ...trackingFields
  }
});
var Refund = (0, import_core5.list)({
  access: { operation: { query: anyOf(...moneyRead), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ["invoice", "payment", "amountMinor", "status", "reason", "createdAt"] } },
  fields: {
    payment: (0, import_fields9.relationship)({ ref: "Payment.refunds" }),
    invoice: (0, import_fields9.relationship)({ ref: "Invoice.refunds" }),
    amountMinor: (0, import_fields9.integer)({ defaultValue: 0 }),
    reason: (0, import_fields9.text)(),
    status: choice(["pending", "succeeded", "failed", "unknown"], "pending"),
    providerReference: (0, import_fields9.text)(),
    method: choice(["card", "wire", "ach", "cheque", "cash"], "card"),
    createdBy: (0, import_fields9.relationship)({ ref: "User" }),
    claim: (0, import_fields9.relationship)({ ref: "Claim.refund" }),
    idempotencyKey: uniqueKey({ hidden: true }),
    ...trackingFields
  }
});
var Notification = (0, import_core5.list)({
  access: { operation: { query: can("canAccessDashboard"), create: denyAll, update: denyAll, delete: can("canManageSettings") } },
  ui: { hideCreate: true, listView: { initialColumns: ["createdAt", "user", "type", "title", "emailStatus"] } },
  fields: {
    user: (0, import_fields9.relationship)({ ref: "User" }),
    type: (0, import_fields9.text)({ validation: { isRequired: true } }),
    title: (0, import_fields9.text)({ validation: { isRequired: true } }),
    body: (0, import_fields9.text)({ ui: { displayMode: "textarea" } }),
    link: (0, import_fields9.text)(),
    readAt: (0, import_fields9.timestamp)(),
    emailStatus: choice(["not_sent", "queued", "sent", "failed", "skipped"], "not_sent"),
    emailError: (0, import_fields9.text)(),
    dedupeKey: uniqueKey(),
    ...trackingFields
  }
});
var AuditEvent = (0, import_core5.list)({
  access: { operation: { query: anyOf("canViewReports", "canManageSettings", "canIssueCertificates"), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["occurredAt", "actorLabel", "action", "entityType", "entityId", "reason"] } },
  fields: {
    actor: (0, import_fields9.relationship)({ ref: "User" }),
    actorLabel: (0, import_fields9.text)(),
    action: (0, import_fields9.text)({ validation: { isRequired: true } }),
    entityType: (0, import_fields9.text)({ validation: { isRequired: true } }),
    entityId: (0, import_fields9.text)({ isIndexed: true }),
    before: (0, import_fields9.json)(),
    after: (0, import_fields9.json)(),
    reason: (0, import_fields9.text)(),
    ipAddress: (0, import_fields9.text)(),
    occurredAt: (0, import_fields9.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    ...trackingFields
  }
});
var CommandReceipt = (0, import_core5.list)({
  access: { operation: { query: can("canViewReports"), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ["eventKey", "eventType", "aggregateType", "occurredAt"] } },
  fields: {
    eventKey: (0, import_fields9.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    eventType: (0, import_fields9.text)({ validation: { isRequired: true } }),
    schemaVersion: (0, import_fields9.integer)({ validation: { isRequired: true }, defaultValue: 1 }),
    aggregateType: (0, import_fields9.text)({ validation: { isRequired: true } }),
    aggregateId: (0, import_fields9.text)({ validation: { isRequired: true } }),
    payload: (0, import_fields9.json)({ access: { read: can("canManageSettings") } }),
    result: (0, import_fields9.json)({ access: { read: can("canManageSettings") } }),
    actorId: (0, import_fields9.text)(),
    payloadHash: (0, import_fields9.text)({ validation: { isRequired: true } }),
    occurredAt: (0, import_fields9.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var moneyLists = { Invoice, InvoiceLine, PaymentProvider, PaymentSession, PaymentWebhookEvent, Payment, Refund, Notification, AuditEvent, CommandReceipt };

// features/keystone/models/OAuthApp.ts
var import_core6 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");

// features/keystone/mcp-oauth/core.ts
var import_node_crypto2 = __toESM(require("node:crypto"));
var MCP_SCOPES = ["mcp:read", "mcp:write"];
var MCP_ACCESS_PREFIX = "mcp_at_";
var ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
var REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1e3;
var CONSENT_TICKET_TTL_MS = 10 * 60 * 1e3;
var DEVELOPMENT_SECRET = "this secret should only be used in testing";
function secret() {
  return process.env.SESSION_SECRET || DEVELOPMENT_SECRET;
}
function randomToken(prefix, bytes = 32) {
  return `${prefix}${import_node_crypto2.default.randomBytes(bytes).toString("base64url")}`;
}
function digestToken(token, purpose = "mcp-oauth-token") {
  return import_node_crypto2.default.createHmac("sha256", secret()).update(`${purpose}\0${token}`, "utf8").digest("hex");
}
function bearerToken(header) {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string") return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(value);
  return match ? match[1] : null;
}
function isMcpAccessToken(token) {
  return typeof token === "string" && token.startsWith(MCP_ACCESS_PREFIX) && token.length > MCP_ACCESS_PREFIX.length;
}
function storedScopes(value) {
  return Array.isArray(value) ? MCP_SCOPES.filter((scope) => value.includes(scope)) : [];
}

// features/keystone/models/OAuthApp.ts
var OAuthApp = (0, import_core6.list)({
  access: {
    operation: {
      query: permissions.canManageUsers,
      create: permissions.canManageUsers,
      update: permissions.canManageUsers,
      delete: permissions.canManageUsers
    }
  },
  fields: {
    name: (0, import_fields11.text)({
      validation: {
        isRequired: true
      }
    }),
    clientId: (0, import_fields11.text)({
      isIndexed: "unique",
      hooks: {
        resolveInput: ({ operation, resolvedData }) => {
          if (operation === "create" && !resolvedData.clientId) {
            return randomToken("mcp_cl_", 18);
          }
          return resolvedData.clientId;
        }
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Auto-generated unique identifier for your application."
      }
    }),
    clientSecret: (0, import_fields11.text)({
      access: {
        read: () => false
      },
      hooks: {
        resolveInput: ({ resolvedData }) => {
          if (resolvedData.clientSecret) {
            return digestToken(resolvedData.clientSecret, "oauth-client-secret");
          }
          return void 0;
        }
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        description: "Stored only as a digest. Public MCP clients have no secret."
      }
    }),
    tokenEndpointAuthMethod: (0, import_fields11.select)({
      options: [
        { label: "Client secret (POST)", value: "client_secret_post" },
        { label: "Client secret (Basic)", value: "client_secret_basic" },
        { label: "None (public PKCE client)", value: "none" }
      ],
      defaultValue: "client_secret_post",
      ui: {
        description: "How the app authenticates at the token endpoint. MCP clients are public (none)."
      }
    }),
    redirectUris: (0, import_fields11.json)({
      defaultValue: [],
      ui: {
        description: "Array of allowed redirect URIs for OAuth callbacks"
      }
    }),
    scopes: (0, import_fields11.json)({
      defaultValue: [...MCP_SCOPES],
      ui: {
        description: "Array of allowed OAuth scopes. MCP scopes only narrow the signed-in user's own access."
      }
    }),
    webhookUrl: (0, import_fields11.text)({
      ui: {
        description: "URL to receive webhook notifications"
      }
    }),
    status: (0, import_fields11.select)({
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Pending", value: "pending" }
      ],
      defaultValue: "active"
    }),
    installUrl: (0, import_fields11.text)({
      ui: {
        description: "URL where users can install this app"
      }
    }),
    uninstallUrl: (0, import_fields11.text)({
      ui: {
        description: "URL to handle app uninstallation"
      }
    }),
    description: (0, import_fields11.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    metadata: (0, import_fields11.json)({
      defaultValue: {},
      ui: {
        description: "Additional app-specific configuration and settings"
      }
    }),
    developerEmail: (0, import_fields11.text)(),
    privacyPolicyUrl: (0, import_fields11.text)(),
    termsOfServiceUrl: (0, import_fields11.text)(),
    supportUrl: (0, import_fields11.text)(),
    ...trackingFields
  },
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["name", "clientId", "status", "createdAt"]
    }
  }
});

// features/keystone/models/OAuthToken.ts
var import_core8 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");
var digestTokenInput = {
  resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] ? digestToken(resolvedData[fieldKey]) : resolvedData[fieldKey]
};
var OAuthToken = (0, import_core8.list)({
  access: {
    operation: {
      query: permissions.canManageUsers,
      create: permissions.canManageUsers,
      update: permissions.canManageUsers,
      delete: permissions.canManageUsers
    }
  },
  fields: {
    tokenType: (0, import_fields12.select)({
      options: [
        { label: "Authorization Code", value: "authorization_code" },
        { label: "Access Token", value: "access_token" },
        { label: "Refresh Token", value: "refresh_token" }
      ],
      validation: {
        isRequired: true
      }
    }),
    token: (0, import_fields12.text)({
      access: { read: () => false },
      validation: {
        isRequired: true
      },
      isIndexed: "unique",
      hooks: digestTokenInput
    }),
    clientId: (0, import_fields12.text)({
      validation: {
        isRequired: true
      },
      isIndexed: true
    }),
    user: (0, import_fields12.relationship)({
      ref: "User",
      ui: {
        description: "The user who authorized this token"
      }
    }),
    scopes: (0, import_fields12.json)({
      defaultValue: [],
      ui: {
        description: "Array of granted scopes"
      }
    }),
    redirectUri: (0, import_fields12.text)({
      ui: {
        description: "The redirect URI used during authorization"
      }
    }),
    resource: (0, import_fields12.text)({
      ui: {
        description: "The MCP endpoint (RFC 8707 resource) this grant is for"
      }
    }),
    expiresAt: (0, import_fields12.timestamp)({
      ui: {
        description: "When this token expires"
      }
    }),
    isRevoked: (0, import_fields12.select)({
      options: [
        { label: "Active", value: "false" },
        { label: "Revoked", value: "true" }
      ],
      defaultValue: "false"
    }),
    authorizationCode: (0, import_fields12.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "The authorization code that was exchanged for this token (for access tokens)"
      }
    }),
    refreshToken: (0, import_fields12.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "Associated refresh token (for access tokens)"
      }
    }),
    accessToken: (0, import_fields12.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "Associated access token (for refresh tokens)"
      }
    }),
    state: (0, import_fields12.text)({
      ui: {
        description: "OAuth state parameter for CSRF protection"
      }
    }),
    codeChallenge: (0, import_fields12.text)({
      ui: {
        description: "PKCE code challenge"
      }
    }),
    codeChallengeMethod: (0, import_fields12.select)({
      options: [
        { label: "Plain", value: "plain" },
        { label: "SHA256", value: "S256" }
      ],
      ui: {
        description: "PKCE code challenge method"
      }
    }),
    ...trackingFields
  },
  ui: {
    labelField: "clientId",
    listView: {
      initialColumns: ["tokenType", "clientId", "user", "scopes", "expiresAt", "isRevoked"]
    }
  }
});

// features/keystone/models/index.ts
var models = {
  ...peopleLists,
  ...buySideLists,
  ...sellSideLists,
  ...moneyLists,
  OAuthApp,
  OAuthToken
};

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/mutations/operations.ts
var import_graphql = require("graphql");

// features/keystone/lib/services.ts
var import_node_crypto3 = require("node:crypto");
var import_nodemailer = require("nodemailer");
async function getSettings(db) {
  const existing = await db.storeSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return db.storeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}
var MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
var ALLOWED_TYPES = /^(image\/(jpeg|png|webp|gif)|application\/pdf|text\/csv|text\/plain|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/octet-stream|application\/xml|text\/xml)$/;
function decodeUpload(file) {
  if (!file || !file.base64) return null;
  const filename = String(file.filename || "upload").replace(/[^\w.\- ]+/g, "_").slice(0, 160);
  const mimeType = String(file.mimeType || "application/octet-stream").toLowerCase();
  if (!ALLOWED_TYPES.test(mimeType)) fail("That file type is not accepted. Use PDF, an image, Excel or CSV.");
  const bytes = Buffer.from(String(file.base64), "base64");
  if (!bytes.length) fail("The file is empty.");
  if (bytes.length > MAX_UPLOAD_BYTES) fail("Files must be 10 MB or smaller.");
  return { filename, mimeType, bytes };
}
async function storeFile(db, input) {
  const bytes = Buffer.from(input.bytes);
  return db.storedFile.create({
    data: {
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: bytes.length,
      sha256: (0, import_node_crypto3.createHash)("sha256").update(bytes).digest("hex"),
      purpose: input.purpose,
      visibility: input.visibility ?? "private",
      ownerBuyerCompanyId: input.ownerBuyerCompanyId ?? "",
      ownerClientOrganizationId: input.ownerClientOrganizationId ?? "",
      uploadedById: input.uploadedById ?? null,
      data: bytes.toString("base64")
    },
    select: { id: true, filename: true }
  });
}
async function storeUpload(db, file, meta) {
  const decoded = decodeUpload(file);
  if (!decoded) return null;
  return storeFile(db, { ...decoded, ...meta });
}
async function readFileBytes(db, id) {
  const row = await db.storedFile.findUnique({ where: { id } });
  if (!row) return null;
  return { ...row, bytes: Buffer.from(row.data || "", "base64") };
}
function fileUrl(id) {
  return id ? `/api/files/${id}` : null;
}
function asDownload(filename, mimeType, bytes) {
  return { filename, mimeType, base64: Buffer.from(bytes).toString("base64") };
}
function smtpConfig(settings) {
  const host = process.env.SMTP_HOST || settings.smtpHost;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.SMTP_PORT || settings.smtpPort || 587),
    user: process.env.SMTP_USER || settings.smtpUser || "",
    pass: process.env.SMTP_PASSWORD || settings.smtpPassword || "",
    from: process.env.SMTP_FROM || settings.smtpFrom || settings.supportEmail || ""
  };
}
async function notify(tx, input) {
  const settings = await getSettings(tx);
  const configured = Boolean(smtpConfig(settings));
  for (const userId of [...new Set(input.userIds.filter(Boolean))]) {
    const dedupeKey = input.dedupeKey ? `${input.dedupeKey}:${userId}` : null;
    if (dedupeKey) {
      const exists = await tx.notification.findUnique({ where: { dedupeKey }, select: { id: true } });
      if (exists) continue;
    }
    await tx.notification.create({
      data: { userId, type: input.type, title: input.title, body: input.body, link: input.link ?? "", dedupeKey, emailStatus: configured ? "queued" : "skipped" }
    });
  }
}
async function staffWith(tx, permission) {
  const users = await tx.user.findMany({ where: { kind: "staff", isActive: true, role: { [permission]: true } }, select: { id: true } });
  return users.map((u) => u.id);
}
async function companyUsers(tx, companyId) {
  const users = await tx.user.findMany({ where: { buyerCompanyId: companyId, isActive: true }, select: { id: true } });
  return users.map((u) => u.id);
}
async function organizationUsers(tx, organizationId) {
  const users = await tx.user.findMany({ where: { clientOrganizationId: organizationId, isActive: true }, select: { id: true } });
  return users.map((u) => u.id);
}
var delivering = false;
async function deliverPendingEmail(context) {
  if (delivering) return;
  delivering = true;
  try {
    const settings = await getSettings(context.prisma);
    const smtp = smtpConfig(settings);
    if (!smtp) return;
    const pending = await context.prisma.notification.findMany({ where: { emailStatus: "queued" }, take: 50, orderBy: { createdAt: "asc" }, include: { user: { select: { email: true, name: true } } } });
    if (!pending.length) return;
    const transport = (0, import_nodemailer.createTransport)({ host: smtp.host, port: smtp.port, secure: smtp.port === 465, auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : void 0 });
    const base = (process.env.SMTP_STORE_LINK || settings.storefrontUrl || "").replace(/\/$/, "");
    for (const n of pending) {
      const claimed = await context.prisma.notification.updateMany({ where: { id: n.id, emailStatus: "queued" }, data: { emailStatus: "sent" } });
      if (!claimed.count) continue;
      try {
        if (!n.user?.email) throw new Error("No email address");
        const link = n.link ? `${base}${n.link}` : "";
        await transport.sendMail({
          from: smtp.from ? `${settings.businessName} <${smtp.from}>` : void 0,
          to: n.user.email,
          subject: n.title,
          text: `${n.body}${link ? `

${link}` : ""}

${settings.businessName}`
        });
      } catch (error) {
        await context.prisma.notification.update({ where: { id: n.id }, data: { emailStatus: "failed", emailError: String(error.message || error).slice(0, 300) } });
      }
    }
  } catch (error) {
    console.error("[email]", error);
  } finally {
    delivering = false;
  }
}
function afterCommit(context) {
  void deliverPendingEmail(context);
}

// features/keystone/domain/buyers.ts
var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var BUSINESS_TYPES = ["refurbisher", "reseller", "exporter", "recycler", "broker", "other"];
var SPEND_BANDS = ["under_5k", "from_5k_to_25k", "from_25k_to_100k", "over_100k"];
var DOC_TYPES = ["resale_certificate", "export_license", "business_registration", "w9", "r2_certificate", "other"];
async function registerBuyer(context, args) {
  const name = str(args.name, 120);
  const email = str(args.email, 200).toLowerCase();
  const legalName = str(args.legalName, 200);
  if (!name) fail("Enter your name.");
  if (!EMAIL.test(email)) fail("Enter a valid email address.");
  if (String(args.password || "").length < 10) fail("Use a password of at least 10 characters.");
  if (!legalName) fail("Enter your company's legal name.");
  const existing = await context.prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) fail("An account with this email already exists. Sign in instead.");
  const company = await context.prisma.buyerCompany.create({ data: { legalName, countryCode: str(args.countryCode, 2).toUpperCase() || "US", status: "draft", phone: str(args.phone, 40) } });
  const user = await context.sudo().db.User.createOne({
    data: { name, email, password: String(args.password), phone: str(args.phone, 40), kind: "buyer", buyerRole: "admin", buyerCompany: { connect: { id: company.id } } }
  });
  await audit(context.prisma, { actorId: user.id, action: "buyer.registered", entityType: "BuyerCompany", entityId: company.id });
  return { userId: user.id, companyId: company.id };
}
async function saveBuyerApplication(context, input) {
  const { companyId, user } = await requireBuyer(context, { admin: true });
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "BuyerCompany", companyId);
    const company = await tx.buyerCompany.findUnique({ where: { id: companyId } });
    if (!["draft", "needs_info", "rejected"].includes(company.status)) fail("Your application is with our team. Email us to change it.");
    const data = {};
    for (const key of ["legalName", "tradingName", "addressLine1", "addressLine2", "city", "region", "postalCode", "phone", "website", "taxId"]) {
      if (input[key] !== void 0) data[key] = str(input[key], 200);
    }
    if (input.countryCode !== void 0) data.countryCode = str(input.countryCode, 2).toUpperCase();
    if (input.businessType !== void 0) data.businessType = BUSINESS_TYPES.includes(input.businessType) ? input.businessType : null;
    if (input.monthlySpendBand !== void 0) data.monthlySpendBand = SPEND_BANDS.includes(input.monthlySpendBand) ? input.monthlySpendBand : null;
    if (Array.isArray(input.destinationCountries)) data.destinationCountries = input.destinationCountries.map((c) => str(c, 2).toUpperCase()).filter(Boolean).slice(0, 50);
    if (Array.isArray(input.categoryIds)) {
      const ids = input.categoryIds.map((c) => str(c, 60)).filter(Boolean).slice(0, 50);
      data.categoriesOfInterest = { set: ids.map((id) => ({ id })) };
    }
    if (data.legalName === "") fail("Your company's legal name cannot be empty.");
    const updated = await tx.buyerCompany.update({ where: { id: companyId }, data });
    await audit(tx, { actorId: user.id, action: "buyer.application_saved", entityType: "BuyerCompany", entityId: companyId });
    return updated;
  });
}
async function uploadBuyerDocument(context, args) {
  const { companyId, user } = await requireBuyer(context, { admin: true });
  const type = DOC_TYPES.includes(args.type) ? args.type : fail("Choose the document type.");
  const company = await context.prisma.buyerCompany.findUnique({ where: { id: companyId }, select: { status: true } });
  if (!["draft", "needs_info", "rejected", "submitted"].includes(company.status)) fail("Email a new document to our team; they will add it to your account.");
  return inTransaction(context, async (tx) => {
    const stored = await storeUpload(tx, args.file, { purpose: "buyer_document", ownerBuyerCompanyId: companyId, uploadedById: user.id });
    if (!stored) fail("Choose a file to upload.");
    const expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(str(args.expiresOn, 10)) ? /* @__PURE__ */ new Date(`${args.expiresOn}T00:00:00Z`) : null;
    return tx.buyerDocument.create({ data: { companyId, type, fileId: stored.id, state: str(args.state, 2).toUpperCase(), expiresOn, status: "submitted", uploadedById: user.id } });
  });
}
async function submitBuyerApplication(context, args) {
  const { companyId, user } = await requireBuyer(context, { admin: true });
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "BuyerCompany", companyId);
    const settings = await getSettings(tx);
    const company = await tx.buyerCompany.findUnique({ where: { id: companyId }, include: { documents: true } });
    if (company.status === "rejected" && company.rejectedAt) {
      const now2 = await dbNow(tx);
      if (now2.getTime() - new Date(company.rejectedAt).getTime() < 30 * 864e5) fail("You can apply again 30 days after the decision.");
    } else if (!["draft", "needs_info"].includes(company.status)) fail("Your application is already with our team.");
    const missing = ["legalName", "addressLine1", "city", "postalCode", "countryCode", "phone"].filter((k) => !company[k]);
    if (!company.businessType) missing.push("business type");
    if (missing.length) fail(`Fill in: ${missing.join(", ")}.`);
    if (!company.documents.some((d) => d.status !== "rejected")) fail("Upload at least one document, such as a resale certificate or business registration.");
    if (str(args.acceptTermsVersion, 40) !== settings.wholesaleTermsVersion) fail("Read and accept the current wholesale terms.");
    const now = await dbNow(tx);
    await tx.user.update({ where: { id: user.id }, data: { acceptedTermsVersion: settings.wholesaleTermsVersion, acceptedTermsAt: now } });
    const updated = await tx.buyerCompany.update({ where: { id: companyId }, data: { status: "submitted", submittedAt: now, termsVersionAccepted: settings.wholesaleTermsVersion, termsAcceptedAt: now } });
    await notify(tx, { userIds: await staffWith(tx, "canManageBuyers"), type: "buyer_submitted", title: `New buyer application: ${company.legalName}`, body: `${company.legalName} applied to buy. Review their documents.`, link: `/dashboard/platform/buyers/${companyId}` });
    await audit(tx, { actorId: user.id, action: "buyer.submitted", entityType: "BuyerCompany", entityId: companyId, before: { status: company.status }, after: { status: "submitted" } });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function replyToBuyerMessage(context, args) {
  const { companyId, user } = await requireBuyer(context);
  const body = str(args.body, 4e3);
  if (!body) fail("Write a reply.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "BuyerCompany", companyId);
    const company = await tx.buyerCompany.findUnique({ where: { id: companyId } });
    const message = await tx.buyerMessage.create({ data: { companyId, authorId: user.id, body, fromStaff: false } });
    if (company.status === "needs_info") {
      await tx.buyerCompany.update({ where: { id: companyId }, data: { status: "submitted", submittedAt: /* @__PURE__ */ new Date() } });
      await audit(tx, { actorId: user.id, action: "buyer.replied", entityType: "BuyerCompany", entityId: companyId, before: { status: "needs_info" }, after: { status: "submitted" } });
    }
    await notify(tx, { userIds: await staffWith(tx, "canManageBuyers"), type: "buyer_message", title: `Reply from ${company.legalName}`, body: body.slice(0, 500), link: `/dashboard/platform/buyers/${companyId}` });
    return message;
  });
  afterCommit(context);
  return result;
}
async function acceptWholesaleTerms(context, args) {
  const { user, companyId } = await requireBuyer(context);
  const settings = await getSettings(context.prisma);
  if (str(args.version, 40) !== settings.wholesaleTermsVersion) fail("The terms changed again. Reload and read the current version.");
  const now = /* @__PURE__ */ new Date();
  await context.prisma.user.update({ where: { id: user.id }, data: { acceptedTermsVersion: settings.wholesaleTermsVersion, acceptedTermsAt: now } });
  if (user.buyerRole === "admin") await context.prisma.buyerCompany.update({ where: { id: companyId }, data: { termsVersionAccepted: settings.wholesaleTermsVersion, termsAcceptedAt: now } });
  await audit(context.prisma, { actorId: user.id, action: "buyer.terms_accepted", entityType: "User", entityId: user.id, after: { version: settings.wholesaleTermsVersion } });
  return { version: settings.wholesaleTermsVersion };
}
async function reviewBuyerApplication(context, args) {
  const staffId = context.session.itemId;
  const action = str(args.action, 20);
  const message = str(args.message, 4e3);
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "BuyerCompany", args.companyId) || fail("Buyer not found.");
    const company = await tx.buyerCompany.findUnique({ where: { id: args.companyId } });
    const from = company.status;
    const allowed = { open: ["submitted"], approve: ["submitted", "under_review"], request_info: ["submitted", "under_review"], reject: ["submitted", "under_review", "needs_info"] };
    if (!allowed[action]) fail("Choose open, approve, request information or reject.");
    if (!allowed[action].includes(from)) fail(`An application that is ${from.replace(/_/g, " ")} cannot be moved that way.`);
    if ((action === "request_info" || action === "reject") && !message) fail("Write a message to the buyer.");
    const now = await dbNow(tx);
    const data = {};
    if (action === "open") data.status = "under_review";
    if (action === "approve") {
      data.status = "approved";
      data.approvedAt = now;
      data.approvedById = staffId;
      data.statusReason = "";
      if (args.taxStatus) data.taxStatus = ["taxable", "exempt_resale", "export"].includes(args.taxStatus) ? args.taxStatus : fail("Choose a tax status.");
      if (args.spendLimitMinor !== void 0) data.spendLimitMinor = args.spendLimitMinor == null ? null : Math.max(0, Math.round(Number(args.spendLimitMinor)));
    }
    if (action === "request_info") {
      data.status = "needs_info";
      data.statusReason = message;
    }
    if (action === "reject") {
      data.status = "rejected";
      data.statusReason = message;
      data.rejectedAt = now;
    }
    const updated = await tx.buyerCompany.update({ where: { id: company.id }, data });
    if (message) await tx.buyerMessage.create({ data: { companyId: company.id, authorId: staffId, body: message, fromStaff: true } });
    const text8 = {
      approve: ["Your buyer account is approved", `${company.legalName} is approved to bid. Browse the open lots.`],
      request_info: ["We need more information", `Before we can approve ${company.legalName}: ${message}`],
      reject: ["Your buyer application", `We cannot approve ${company.legalName} at this time: ${message}`]
    };
    if (text8[action]) await notify(tx, { userIds: await companyUsers(tx, company.id), type: `buyer_${action}`, title: text8[action][0], body: text8[action][1], link: action === "approve" ? "/lots" : "/buyer" });
    await audit(tx, { actorId: staffId, action: `buyer.${action}`, entityType: "BuyerCompany", entityId: company.id, before: { status: from }, after: { status: data.status ?? from, taxStatus: updated.taxStatus, spendLimitMinor: updated.spendLimitMinor }, reason: message });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function voidCompanyBids(tx, companyId, reason) {
  const bids = await tx.bid.findMany({ where: { companyId, status: "active", lot: { status: { in: ["open", "scheduled"] } } }, select: { id: true, lotId: true } });
  const lotIds = [...new Set(bids.map((b) => b.lotId))];
  for (const lotId of lotIds.sort()) {
    await lockRow(tx, "Lot", lotId);
    await tx.bid.updateMany({ where: { lotId, companyId, status: "active" }, data: { status: "void", activeKey: null, staffNote: reason } });
    await refreshLotHigh(tx, lotId);
  }
  return bids.length;
}
async function refreshLotHigh(tx, lotId) {
  const top = await tx.bid.findFirst({ where: { lotId, status: "active" }, orderBy: [{ amountMinor: "desc" }, { submittedAt: "asc" }] });
  const count = await tx.bid.count({ where: { lotId, status: "active" } });
  await tx.lot.update({ where: { id: lotId }, data: { currentAmountMinor: top?.amountMinor ?? null, bidCount: count } });
}
async function suspendCompany(tx, companyId, reason, actorId) {
  const company = await tx.buyerCompany.findUnique({ where: { id: companyId } });
  if (company.status !== "approved") fail("Only an approved buyer can be suspended.");
  await tx.buyerCompany.update({ where: { id: companyId }, data: { status: "suspended", statusReason: reason } });
  const voided = await voidCompanyBids(tx, companyId, `Voided: buyer suspended (${reason})`);
  await notify(tx, { userIds: await companyUsers(tx, companyId), type: "buyer_suspended", title: "Your buyer account is suspended", body: `${company.legalName} cannot bid until reinstated: ${reason}. Open orders can still be paid.`, link: "/buyer" });
  await audit(tx, { actorId, action: "buyer.suspended", entityType: "BuyerCompany", entityId: companyId, before: { status: "approved" }, after: { status: "suspended", voidedBids: voided }, reason });
  return voided;
}
async function suspendBuyer(context, args) {
  const reason = str(args.reason, 500) || fail("Write the reason for the suspension.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "BuyerCompany", args.companyId) || fail("Buyer not found.");
    await suspendCompany(tx, args.companyId, reason, context.session.itemId);
    return tx.buyerCompany.findUnique({ where: { id: args.companyId } });
  });
  afterCommit(context);
  return result;
}
async function reinstateBuyer(context, args) {
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "BuyerCompany", args.companyId) || fail("Buyer not found.");
    const company = await tx.buyerCompany.findUnique({ where: { id: args.companyId } });
    if (company.status !== "suspended") fail("Only a suspended buyer can be reinstated.");
    const updated = await tx.buyerCompany.update({ where: { id: company.id }, data: { status: "approved", statusReason: "", ...args.resetStrikes ? { strikes: 0 } : {} } });
    await notify(tx, { userIds: await companyUsers(tx, company.id), type: "buyer_reinstated", title: "Your buyer account is active again", body: `${company.legalName} can bid again.`, link: "/lots" });
    await audit(tx, { actorId: context.session.itemId, action: "buyer.reinstated", entityType: "BuyerCompany", entityId: company.id, before: { status: "suspended" }, after: { status: "approved" }, reason: str(args.note, 500) });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function reviewBuyerDocument(context, args) {
  const status2 = ["accepted", "rejected"].includes(args.status) ? args.status : fail("Choose accept or reject.");
  return inTransaction(context, async (tx) => {
    const doc2 = await tx.buyerDocument.findUnique({ where: { id: str(args.documentId, 60) } });
    if (!doc2) fail("Document not found.");
    await lockRow(tx, "BuyerCompany", doc2.companyId);
    const expiresOn = args.expiresOn && /^\d{4}-\d{2}-\d{2}$/.test(args.expiresOn) ? /* @__PURE__ */ new Date(`${args.expiresOn}T00:00:00Z`) : doc2.expiresOn;
    const updated = await tx.buyerDocument.update({ where: { id: doc2.id }, data: { status: status2, reviewNote: str(args.note, 500), expiresOn } });
    if (status2 === "accepted" && doc2.type === "resale_certificate") {
      const company = await tx.buyerCompany.findUnique({ where: { id: doc2.companyId } });
      if (company.taxStatus === "taxable" && (!expiresOn || expiresOn > /* @__PURE__ */ new Date())) await tx.buyerCompany.update({ where: { id: doc2.companyId }, data: { taxStatus: "exempt_resale" } });
    }
    await audit(tx, { actorId: context.session.itemId, action: `buyer_document.${status2}`, entityType: "BuyerDocument", entityId: doc2.id, reason: str(args.note, 500) });
    return updated;
  });
}
async function messageBuyer(context, args) {
  const body = str(args.body, 4e3) || fail("Write a message.");
  const result = await inTransaction(context, async (tx) => {
    const company = await tx.buyerCompany.findUnique({ where: { id: args.companyId } });
    if (!company) fail("Buyer not found.");
    const message = await tx.buyerMessage.create({ data: { companyId: company.id, authorId: context.session.itemId, body, fromStaff: true } });
    await notify(tx, { userIds: await companyUsers(tx, company.id), type: "buyer_message", title: `Message from ${(await getSettings(tx)).businessName}`, body, link: "/buyer" });
    return message;
  });
  afterCommit(context);
  return result;
}

// features/keystone/lib/rules/money.ts
function bps(amountMinor, basisPoints) {
  return Math.round(amountMinor * basisPoints / 1e4);
}
function invoiceTotals(lines) {
  const sum = (kinds) => lines.filter((l) => kinds.includes(l.kind)).reduce((s, l) => s + l.totalMinor, 0);
  const subtotalMinor = sum(["item", "service"]);
  const premiumMinor = sum(["premium"]);
  const taxMinor = sum(["tax"]);
  const freightMinor = sum(["freight"]);
  const feeMinor = sum(["card_fee"]);
  const otherMinor = sum(["storage", "adjustment"]);
  return { subtotalMinor, premiumMinor, taxMinor, freightMinor, feeMinor, otherMinor, totalMinor: subtotalMinor + premiumMinor + taxMinor + freightMinor + feeMinor + otherMinor };
}
function awardInvoiceLines(input) {
  const lines = input.items.map((i) => ({ kind: "item", ...i }));
  const subtotal = input.items.reduce((s, i) => s + i.totalMinor, 0);
  const premium = bps(subtotal, input.premiumBps);
  if (premium > 0) lines.push({ kind: "premium", description: `Buyer's premium (${input.premiumBps / 100}%)`, quantity: 1, unitPriceMinor: premium, totalMinor: premium });
  const exempt = input.taxStatus === "exempt_resale" || input.taxStatus === "export" || input.exported;
  const tax = exempt ? 0 : bps(subtotal + premium, input.taxBps);
  if (tax > 0) lines.push({ kind: "tax", description: `Sales tax (${input.taxBps / 100}%)`, quantity: 1, unitPriceMinor: tax, totalMinor: tax });
  if (input.freightMinor && input.freightMinor > 0) lines.push({ kind: "freight", description: "Freight", quantity: 1, unitPriceMinor: input.freightMinor, totalMinor: input.freightMinor });
  return { lines, taxExempt: exempt, taxExemptReason: exempt ? input.exported || input.taxStatus === "export" ? "export" : "resale certificate" : "" };
}
function cardFee(amountMinor, feeBps) {
  return amountMinor > 0 ? bps(amountMinor, feeBps) : 0;
}
function invoiceStatusFor(input) {
  if (input.voided) return "void";
  if (input.refundedMinor > 0 && input.refundedMinor >= input.paidMinor && input.paidMinor > 0) return "refunded";
  if (input.refundedMinor > 0) return "partially_refunded";
  if (input.paidMinor >= input.totalMinor && input.totalMinor > 0) return "paid";
  if (input.totalMinor === 0) return "paid";
  if (input.paidMinor > 0) return "partially_paid";
  return "open";
}
function refundProblem(input) {
  if (!Number.isSafeInteger(input.requestedMinor) || input.requestedMinor <= 0) return "Enter an amount greater than zero.";
  const refundable = input.capturedMinor - input.alreadyRefundedMinor;
  if (input.requestedMinor > refundable) return `At most ${refundable} can be refunded on this payment.`;
  return null;
}
function restockingFee(awardMinor, feeBps) {
  return bps(awardMinor, feeBps);
}
function strikeOutcome(currentStrikes, strikesBeforeSuspension) {
  const strikes = currentStrikes + 1;
  return { strikes, suspend: strikes >= strikesBeforeSuspension };
}
function settlementTotals(lines) {
  const fees = lines.filter((l) => l.kind === "service_fee").reduce((s, l) => s + l.grossMinor, 0);
  const share = lines.filter((l) => l.kind !== "service_fee").reduce((s, l) => s + l.clientAmountMinor, 0);
  return { feesTotalMinor: fees, clientShareTotalMinor: share, netMinor: share - fees };
}
function formatMinor(minor, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((minor ?? 0) / 100);
}

// features/keystone/lib/pdf.ts
var import_pdf_lib = require("pdf-lib");
var MARGIN = 48;
var PAGE = [612, 792];
function safe(text8) {
  return String(text8 ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/[^\x20-\x7e\xa0-\xff\n]/g, "?");
}
function wrap(text8, font, size, width) {
  const lines = [];
  for (const paragraph of safe(text8).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}
function clip(text8, font, size, width) {
  let value = safe(text8);
  if (font.widthOfTextAtSize(value, size) <= width) return value;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > width) value = value.slice(0, -1);
  return `${value}...`;
}
async function renderPdf(input) {
  const doc2 = await import_pdf_lib.PDFDocument.create();
  const font = await doc2.embedFont(import_pdf_lib.StandardFonts.Helvetica);
  const bold = await doc2.embedFont(import_pdf_lib.StandardFonts.HelveticaBold);
  const width = PAGE[0] - MARGIN * 2;
  let page = doc2.addPage(PAGE);
  let y = PAGE[1] - MARGIN;
  const grey = (0, import_pdf_lib.rgb)(0.4, 0.4, 0.4);
  const header = () => {
    page.drawText(safe(input.header), { x: MARGIN, y, size: 11, font: bold });
    if (input.headerRight) {
      const w = font.widthOfTextAtSize(safe(input.headerRight), 9);
      page.drawText(safe(input.headerRight), { x: PAGE[0] - MARGIN - w, y, size: 9, font, color: grey });
    }
    y -= 14;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE[0] - MARGIN, y }, thickness: 0.5, color: grey });
    y -= 18;
  };
  const ensure = (needed) => {
    if (y - needed < MARGIN + 20) {
      page = doc2.addPage(PAGE);
      y = PAGE[1] - MARGIN;
      header();
    }
  };
  header();
  for (const block of input.blocks) {
    if (block.kind === "title") {
      ensure(30);
      page.drawText(safe(block.text), { x: MARGIN, y, size: 18, font: bold });
      y -= 26;
    } else if (block.kind === "subtitle") {
      ensure(22);
      page.drawText(safe(block.text), { x: MARGIN, y, size: 12, font: bold });
      y -= 18;
    } else if (block.kind === "text") {
      for (const line of wrap(block.text, font, 10, width)) {
        ensure(14);
        page.drawText(line, { x: MARGIN, y, size: 10, font });
        y -= 14;
      }
      y -= 4;
    } else if (block.kind === "pairs") {
      for (const [label, value] of block.pairs) {
        const lines = wrap(value || "-", font, 10, width - 150);
        ensure(14 * lines.length);
        page.drawText(safe(label), { x: MARGIN, y, size: 9, font: bold, color: grey });
        lines.forEach((line, i) => page.drawText(line, { x: MARGIN + 150, y: y - i * 13, size: 10, font }));
        y -= 13 * lines.length + 3;
      }
      y -= 6;
    } else if (block.kind === "table") {
      const count = block.headers.length;
      const widths = block.widths ?? Array(count).fill(1);
      const total = widths.reduce((s, w) => s + w, 0);
      const cols = widths.map((w) => w / total * width);
      const drawRow = (cells, f, size) => {
        let x = MARGIN;
        cells.forEach((c, i) => {
          const text8 = clip(c ?? "", f, size, cols[i] - 6);
          const right = block.align?.[i] === "right";
          const tw = f.widthOfTextAtSize(text8, size);
          page.drawText(text8, { x: right ? x + cols[i] - 4 - tw : x, y, size, font: f });
          x += cols[i];
        });
      };
      ensure(30);
      drawRow(block.headers, bold, 8.5);
      y -= 4;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE[0] - MARGIN, y }, thickness: 0.4, color: grey });
      y -= 11;
      for (const row of block.rows) {
        if (y - 12 < MARGIN + 20) {
          ensure(40);
          drawRow(block.headers, bold, 8.5);
          y -= 15;
        }
        drawRow(row, font, 8.5);
        y -= 12;
      }
      y -= 8;
    } else if (block.kind === "totals") {
      for (const [label, value] of block.pairs) {
        ensure(16);
        const isLast = label === block.pairs[block.pairs.length - 1][0];
        const f = isLast ? bold : font;
        const vw = f.widthOfTextAtSize(safe(value), 10);
        page.drawText(safe(label), { x: PAGE[0] - MARGIN - 220, y, size: 10, font: f });
        page.drawText(safe(value), { x: PAGE[0] - MARGIN - vw, y, size: 10, font: f });
        y -= 15;
      }
      y -= 6;
    } else if (block.kind === "space") {
      y -= block.size ?? 10;
    } else if (block.kind === "signature") {
      ensure(40);
      y -= 16;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 220, y }, thickness: 0.5 });
      if (block.value) page.drawText(safe(block.value), { x: MARGIN, y: y + 4, size: 10, font });
      y -= 12;
      page.drawText(safe(block.label), { x: MARGIN, y, size: 8.5, font, color: grey });
      y -= 14;
    }
  }
  const pages = doc2.getPages();
  pages.forEach((p, i) => {
    const text8 = safe(`${input.footer ? `${input.footer}   ` : ""}Page ${i + 1} of ${pages.length}`);
    p.drawText(text8, { x: MARGIN, y: MARGIN - 20, size: 8, font, color: grey });
  });
  return Buffer.from(await doc2.save());
}

// features/keystone/domain/money.ts
var import_node_crypto5 = require("node:crypto");

// features/keystone/lib/rules/time.ts
function weekdayIn(date, timeZone) {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}
function addBusinessDays(start, days, timeZone = "UTC") {
  let date = new Date(start.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    date = new Date(date.getTime() + 864e5);
    const day = weekdayIn(date, timeZone);
    if (day !== 0 && day !== 6) remaining--;
  }
  return date;
}
function zonedInstant(date, time, timeZone) {
  const guess = /* @__PURE__ */ new Date(`${date}T${time}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess).map((p) => [p.type, p.value]));
  const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  const first = new Date(guess.getTime() - (shown - guess.getTime()));
  const p2 = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(first).map((p) => [p.type, p.value]));
  const shown2 = Date.UTC(Number(p2.year), Number(p2.month) - 1, Number(p2.day), Number(p2.hour), Number(p2.minute));
  return new Date(first.getTime() - (shown2 - guess.getTime()));
}
function dockSlots(args) {
  const weekday2 = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][(/* @__PURE__ */ new Date(`${args.date}T12:00:00Z`)).getUTCDay()];
  const window = args.hours?.[weekday2];
  const match = typeof window === "string" ? window.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/) : null;
  if (!match) return { open: false, slots: [] };
  const minutes = Math.max(15, args.slotMinutes || 60);
  const from = zonedInstant(args.date, `${match[1]}:${match[2]}`, args.timeZone);
  const to = zonedInstant(args.date, `${match[3]}:${match[4]}`, args.timeZone);
  const slots = [];
  for (let t = from.getTime(); t + minutes * 6e4 <= to.getTime(); t += minutes * 6e4) {
    const startsAt = new Date(t);
    const endsAt = new Date(t + minutes * 6e4);
    const taken = args.booked.filter((b) => new Date(b.startsAt) < endsAt && new Date(b.endsAt) > startsAt).length;
    slots.push({ startsAt, endsAt, taken, free: Math.max(0, Math.max(1, args.perWindow || 1) - taken) });
  }
  return { open: true, slots };
}

// features/integrations/payment/stripe.ts
var import_node_crypto4 = require("node:crypto");
var API = "https://api.stripe.com/v1";
function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
function stripePublishableKey() {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || "";
}
function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Card payments are not set up. Add STRIPE_SECRET_KEY, or pay by bank transfer.");
  return key;
}
function form(values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== void 0 && value !== "") body.append(key, String(value));
  return body;
}
var StripeUnknownOutcome = class extends Error {
};
async function stripe(path, init = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method: init.method || "GET",
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        ...init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
        ...init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}
      },
      body: init.body,
      redirect: "error",
      signal: AbortSignal.timeout(2e4)
    });
  } catch (error) {
    throw new StripeUnknownOutcome(`Stripe did not answer: ${error.message}`);
  }
  if (response.status >= 500) throw new StripeUnknownOutcome(`Stripe answered ${response.status}.`);
  const json7 = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json7.error?.message || `Stripe request failed (${response.status}).`);
  return json7;
}
function intentStatus(intent) {
  switch (intent.status) {
    case "succeeded":
      return "captured";
    case "requires_action":
    case "processing":
      return "requires_action";
    case "requires_payment_method":
    case "requires_confirmation":
      return "pending";
    case "canceled":
      return "canceled";
    default:
      return "unknown";
  }
}
function asString(value) {
  return typeof value === "string" ? value : "";
}
async function createPaymentFunction({ amount, currency, description, idempotencyKey, metadata, customerEmail }) {
  const cents = Math.round(Number(amount));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Payment amount must be greater than zero.");
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const intent = await stripe("/payment_intents", {
    method: "POST",
    idempotencyKey: asString(idempotencyKey) || void 0,
    body: form({
      amount: cents,
      currency: asString(currency || "usd").toLowerCase(),
      description: asString(description) || void 0,
      "payment_method_types[]": "card",
      capture_method: "automatic",
      .../^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString(customerEmail)) ? { receipt_email: asString(customerEmail) } : {},
      ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [`metadata[${key}]`, asString(value)]))
    })
  });
  return { status: intentStatus(intent), id: intent.id, clientSecret: intent.client_secret, data: { id: intent.id, status: intent.status, amount: intent.amount } };
}
async function getPaymentStatusFunction({ paymentId }) {
  const intent = await stripe(`/payment_intents/${encodeURIComponent(asString(paymentId))}`);
  return { status: intentStatus(intent), amount: intent.amount, amountReceived: intent.amount_received, error: intent.last_payment_error?.message || null, data: { id: intent.id, status: intent.status, amount: intent.amount, amountReceived: intent.amount_received } };
}
async function cancelPayment(paymentId) {
  return stripe(`/payment_intents/${encodeURIComponent(paymentId)}/cancel`, { method: "POST", body: form({}) });
}
async function refundPaymentFunction({ paymentId, amount, idempotencyKey }) {
  const refund = await stripe("/refunds", {
    method: "POST",
    idempotencyKey: asString(idempotencyKey) || void 0,
    body: form({ payment_intent: asString(paymentId), amount: amount == null ? void 0 : Math.round(Number(amount)) })
  });
  return { status: refund.status, id: refund.id, amount: refund.amount, data: refund };
}

// features/keystone/domain/money.ts
var OPEN_SESSION = ["pending", "requires_action", "unknown"];
async function recalculateInvoice(tx, invoiceId) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true } });
  if (!invoice) fail("Invoice not found.");
  const totals = invoiceTotals(invoice.lines.map((l) => ({ kind: l.kind, totalMinor: l.totalMinor ?? 0 })));
  const status2 = invoiceStatusFor({ totalMinor: totals.totalMinor, paidMinor: invoice.paidMinor ?? 0, refundedMinor: invoice.refundedMinor ?? 0, voided: invoice.status === "void" });
  return tx.invoice.update({
    where: { id: invoiceId },
    data: { ...totals, status: status2, paidAt: status2 === "paid" && !invoice.paidAt ? /* @__PURE__ */ new Date() : invoice.paidAt }
  });
}
async function createInvoice(tx, input) {
  const settings = await getSettings(tx);
  const now = await dbNow(tx);
  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber: await nextNumber(tx, "invoice"),
      kind: input.kind,
      buyerCompanyId: input.buyerCompanyId ?? null,
      clientOrganizationId: input.clientOrganizationId ?? null,
      orderId: input.orderId ?? null,
      jobId: input.jobId ?? null,
      settlementId: input.settlementId ?? null,
      status: "open",
      currencyCode: settings.currencyCode,
      issuedAt: now,
      dueAt: input.dueAt ?? addBusinessDays(now, settings.paymentDueBusinessDays, settings.timezone),
      billTo: input.billTo,
      taxExemptReason: input.taxExemptReason ?? "",
      lines: { create: input.lines.map((l) => ({ kind: l.kind, description: l.description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor })) }
    }
  });
  return recalculateInvoice(tx, invoice.id);
}
async function invoiceForCaller(context, invoiceNumber) {
  const session = context.session;
  if (!session) fail("Sign in to continue.");
  const user = await context.prisma.user.findUnique({ where: { id: session.itemId }, select: { id: true, kind: true, isActive: true, buyerCompanyId: true, clientOrganizationId: true, email: true } });
  if (!user?.isActive) fail("Your account is not active.");
  const invoice = await context.prisma.invoice.findUnique({ where: { invoiceNumber: str(invoiceNumber, 40) } });
  const owns = invoice && (user.kind === "buyer" && user.buyerCompanyId && invoice.buyerCompanyId === user.buyerCompanyId || user.kind === "client" && user.clientOrganizationId && invoice.clientOrganizationId === user.clientOrganizationId);
  if (!owns) fail("Invoice not found.");
  return { invoice, user };
}
async function cardProvider(tx) {
  const provider = await tx.paymentProvider.findFirst({ where: { code: "stripe", isInstalled: true } });
  return provider && stripeConfigured() ? provider : null;
}
async function paymentOptions(db, invoice) {
  const settings = await getSettings(db);
  const balance = Math.max(0, (invoice.totalMinor ?? 0) - (invoice.paidMinor ?? 0));
  const card = await cardProvider(db);
  const cardAllowed = Boolean(card) && (settings.cardMaxAmountMinor == null || balance <= settings.cardMaxAmountMinor);
  return {
    balanceMinor: balance,
    card: cardAllowed,
    cardFeeBps: settings.cardFeeBps,
    cardFeeMinor: cardFee(balance, settings.cardFeeBps),
    cardUnavailableReason: !card ? "Card payments are not set up. Pay by bank transfer." : !cardAllowed ? "This amount is above the card limit. Pay by bank transfer." : null,
    publishableKey: cardAllowed ? stripePublishableKey() : "",
    bankTransfer: true,
    wireInstructions: settings.wireInstructions
  };
}
function hashKey(key) {
  return (0, import_node_crypto5.createHash)("sha256").update(key).digest("hex");
}
async function removeFeeLines(tx, session) {
  await tx.invoiceLine.deleteMany({ where: { invoiceId: session.invoiceId, kind: "card_fee", paymentSessionId: session.id } });
  await recalculateInvoice(tx, session.invoiceId);
}
function serializeSession(s) {
  return s && { id: s.id, status: s.status, method: s.method, amountMinor: s.amountMinor, feeMinor: s.feeMinor, currencyCode: s.currencyCode, clientSecret: OPEN_SESSION.includes(s.status) ? s.clientSecret : "", providerPaymentId: s.providerPaymentId, lastError: s.lastError };
}
async function initiateInvoicePaymentSession(context, args) {
  const { invoice, user } = await invoiceForCaller(context, args.invoiceNumber);
  const method = args.method === "card" ? "card" : "bank_transfer";
  const key = str(args.idempotencyKey, 200);
  if (key.length < 8) fail("The request key is too short.");
  const keyHash = hashKey(`invoice:${invoice.id}:${method}:${key}`);
  if (method === "bank_transfer") {
    await cancelOpenCardSessions(context, invoice.id);
    const fresh2 = await context.prisma.invoice.findUnique({ where: { id: invoice.id } });
    return { method, session: null, options: await paymentOptions(context.prisma, fresh2) };
  }
  const prepared = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Invoice", invoice.id);
    const existing = await tx.paymentSession.findUnique({ where: { idempotencyKeyHash: keyHash } });
    if (existing) return { session: existing, call: false };
    const current = await tx.invoice.findUnique({ where: { id: invoice.id } });
    if (!["open", "partially_paid"].includes(current.status)) fail("This invoice is not open for payment.");
    const open = await tx.paymentSession.findFirst({ where: { invoiceId: invoice.id, method: "card", status: { in: OPEN_SESSION } } });
    if (open) {
      if (open.status === "unknown") fail("A card payment on this invoice is being confirmed. Wait a minute and reload.");
      return { session: open, call: !open.providerPaymentId };
    }
    const provider = await cardProvider(tx);
    if (!provider) fail("Card payments are not set up. Pay by bank transfer.");
    const settings = await getSettings(tx);
    const balance = Math.max(0, (current.totalMinor ?? 0) - (current.paidMinor ?? 0));
    if (balance <= 0) fail("Nothing is owed on this invoice.");
    if (settings.cardMaxAmountMinor != null && balance > settings.cardMaxAmountMinor) fail("This amount is above the card limit. Pay by bank transfer.");
    const fee = cardFee(balance, settings.cardFeeBps);
    const session2 = await tx.paymentSession.create({
      data: {
        invoiceId: invoice.id,
        paymentProviderId: provider.id,
        method: "card",
        openKey: `${invoice.id}:card`,
        idempotencyKeyHash: keyHash,
        status: "pending",
        amountMinor: balance + fee,
        feeMinor: fee,
        currencyCode: current.currencyCode,
        createdById: user.id
      }
    });
    if (fee > 0) {
      await tx.invoiceLine.create({ data: { invoiceId: invoice.id, kind: "card_fee", description: `Card processing fee (${settings.cardFeeBps / 100}%)`, quantity: 1, unitPriceMinor: fee, totalMinor: fee, paymentSessionId: session2.id } });
      await recalculateInvoice(tx, invoice.id);
    }
    return { session: session2, call: true };
  });
  let session = prepared.session;
  if (prepared.call) session = await createIntent(context, session.id, invoice, user.email);
  const fresh = await context.prisma.invoice.findUnique({ where: { id: invoice.id } });
  return { method, session: serializeSession(session), options: await paymentOptions(context.prisma, fresh) };
}
async function createIntent(context, sessionId, invoice, email) {
  const session = await context.prisma.paymentSession.findUnique({ where: { id: sessionId } });
  try {
    const result = await createPaymentFunction({
      amount: session.amountMinor,
      currency: session.currencyCode,
      description: `Invoice ${invoice.invoiceNumber}`,
      idempotencyKey: `payment-session-${session.id}`,
      metadata: { invoiceNumber: invoice.invoiceNumber, paymentSessionId: session.id },
      customerEmail: email
    });
    return context.prisma.paymentSession.update({ where: { id: session.id }, data: { providerPaymentId: result.id, clientSecret: result.clientSecret ?? "", status: result.status === "captured" ? "pending" : result.status } });
  } catch (error) {
    if (error instanceof StripeUnknownOutcome) {
      return context.prisma.paymentSession.update({ where: { id: session.id }, data: { status: "unknown", lastError: error.message } });
    }
    return inTransaction(context, async (tx) => {
      await lockRow(tx, "Invoice", session.invoiceId);
      const updated = await tx.paymentSession.update({ where: { id: session.id }, data: { status: "failed", openKey: null, lastError: String(error.message).slice(0, 300) } });
      await removeFeeLines(tx, session);
      return updated;
    }).then((s) => {
      fail(`The card payment could not start: ${s.lastError}`);
    });
  }
}
async function cancelOpenCardSessions(context, invoiceId) {
  const open = await context.prisma.paymentSession.findMany({ where: { invoiceId, method: "card", status: { in: ["pending", "requires_action"] } } });
  for (const s of open) {
    if (s.providerPaymentId) {
      try {
        const status2 = await getPaymentStatusFunction({ paymentId: s.providerPaymentId });
        if (status2.status === "captured" || status2.status === "requires_action") {
          await applyIntentResult(context, s.id, status2);
          if (status2.status === "requires_action") fail("A card payment on this invoice is still being processed.");
          continue;
        }
        await cancelPayment(s.providerPaymentId);
      } catch (error) {
        if (error?.name === "DomainError") throw error;
        fail("The open card payment could not be cancelled. Try again in a minute.");
      }
    }
    await inTransaction(context, async (tx) => {
      await lockRow(tx, "Invoice", invoiceId);
      await lockRow(tx, "PaymentSession", s.id);
      const current = await tx.paymentSession.findUnique({ where: { id: s.id } });
      if (!["pending", "requires_action"].includes(current.status)) return;
      await tx.paymentSession.update({ where: { id: s.id }, data: { status: "canceled", openKey: null, canceledAt: /* @__PURE__ */ new Date() } });
      await removeFeeLines(tx, s);
    });
  }
}
async function applyIntentResult(context, sessionId, result) {
  const outcome = await inTransaction(context, async (tx) => {
    const session = await tx.paymentSession.findUnique({ where: { id: sessionId } });
    if (!session) fail("Payment session not found.");
    await lockRow(tx, "Invoice", session.invoiceId);
    await lockRow(tx, "PaymentSession", session.id);
    const current = await tx.paymentSession.findUnique({ where: { id: sessionId } });
    if (["captured", "failed", "canceled"].includes(current.status)) return { session: current, changed: false };
    if (result.status === "captured") {
      const amount = result.amountReceived ?? current.amountMinor;
      await tx.payment.create({
        data: { invoiceId: current.invoiceId, sessionId: current.id, method: "card", amountMinor: amount, status: "captured", providerReference: current.providerPaymentId, paidOn: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), confirmedAt: /* @__PURE__ */ new Date() }
      });
      const updated = await tx.paymentSession.update({ where: { id: current.id }, data: { status: "captured", capturedAt: /* @__PURE__ */ new Date(), openKey: null } });
      await addPaid(tx, current.invoiceId, amount);
      await audit(tx, { action: "payment.captured", entityType: "Invoice", entityId: current.invoiceId, after: { amountMinor: amount, paymentSessionId: current.id } });
      return { session: updated, changed: true };
    }
    if (result.status === "canceled" || result.status === "pending" && result.error) {
      const updated = await tx.paymentSession.update({ where: { id: current.id }, data: { status: result.status === "canceled" ? "canceled" : "failed", openKey: null, lastError: result.error ?? "" } });
      await removeFeeLines(tx, current);
      return { session: updated, changed: true };
    }
    if (result.status === "requires_action" && current.status !== "requires_action") {
      return { session: await tx.paymentSession.update({ where: { id: current.id }, data: { status: "requires_action" } }), changed: true };
    }
    if (current.status === "unknown" && result.status === "pending") {
      return { session: await tx.paymentSession.update({ where: { id: current.id }, data: { status: "pending" } }), changed: true };
    }
    return { session: current, changed: false };
  });
  afterCommit(context);
  return outcome.session;
}
async function addPaid(tx, invoiceId, amountMinor) {
  const before = await tx.invoice.findUnique({ where: { id: invoiceId } });
  await tx.invoice.update({ where: { id: invoiceId }, data: { paidMinor: (before.paidMinor ?? 0) + amountMinor } });
  const after = await recalculateInvoice(tx, invoiceId);
  if (after.status === "paid" && before.status !== "paid") await onInvoicePaid(tx, after);
}
async function onInvoicePaid(tx, invoice) {
  await tx.invoice.update({ where: { id: invoice.id }, data: { isOverdue: false } });
  if (invoice.orderId) {
    const order = await tx.order.findUnique({ where: { id: invoice.orderId } });
    if (order?.status === "awaiting_payment") {
      await tx.order.update({ where: { id: order.id }, data: { status: "paid" } });
      await audit(tx, { action: "order.paid", entityType: "Order", entityId: order.id });
      await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: "order_paid", title: `Payment received for ${order.orderNumber}`, body: `We have your payment for order ${order.orderNumber}. Tell us how the goods will leave on the order page.`, link: `/buyer/orders/${order.orderNumber}` });
    }
  }
  if (invoice.settlementId) {
    const settlement = await tx.settlement.findUnique({ where: { id: invoice.settlementId } });
    if (settlement?.status === "published") await tx.settlement.update({ where: { id: settlement.id }, data: { status: "paid", paidAt: /* @__PURE__ */ new Date(), payoutMethod: "credit", payoutReference: `Invoice ${invoice.invoiceNumber}` } });
  }
  const userIds = invoice.buyerCompanyId ? await companyUsers(tx, invoice.buyerCompanyId) : invoice.clientOrganizationId ? await organizationUsers(tx, invoice.clientOrganizationId) : [];
  await notify(tx, { userIds, type: "invoice_paid", title: `Invoice ${invoice.invoiceNumber} is paid`, body: `Thank you. Invoice ${invoice.invoiceNumber} is paid in full.`, link: invoice.buyerCompanyId ? `/buyer/invoices/${invoice.invoiceNumber}` : `/client/invoices/${invoice.invoiceNumber}`, dedupeKey: `invoice-paid:${invoice.id}` });
}
async function completeInvoicePayment(context, args) {
  const { invoice } = await invoiceForCaller(context, args.invoiceNumber);
  const session = await context.prisma.paymentSession.findUnique({ where: { id: str(args.paymentSessionId, 60) } });
  if (!session || session.invoiceId !== invoice.id) fail("Payment not found.");
  return { session: serializeSession(await checkSession(context, session)), invoice: await context.prisma.invoice.findUnique({ where: { id: invoice.id } }) };
}
async function checkSession(context, session) {
  if (!session.providerPaymentId) {
    if (session.status === "unknown") {
      const ageMs = Date.now() - new Date(session.createdAt).getTime();
      if (ageMs > 10 * 6e4) return applyIntentResult(context, session.id, { status: "canceled", error: "Stripe never confirmed the payment was created." });
    }
    return session;
  }
  try {
    const status2 = await getPaymentStatusFunction({ paymentId: session.providerPaymentId });
    return applyIntentResult(context, session.id, status2);
  } catch (error) {
    if (error instanceof StripeUnknownOutcome) return session;
    throw error;
  }
}
async function checkPaymentSession(context, args) {
  const session = await context.prisma.paymentSession.findUnique({ where: { id: str(args.paymentSessionId, 60) } });
  if (!session) fail("Payment session not found.");
  return serializeSession(await checkSession(context, session));
}
async function reportBankTransfer(context, args) {
  const { invoice, user } = await invoiceForCaller(context, args.invoiceNumber);
  const amount = Math.round(Number(args.amountMinor));
  if (!Number.isSafeInteger(amount) || amount <= 0) fail("Enter the amount you sent.");
  const reference = str(args.reference, 120);
  if (!reference) fail("Enter the bank reference.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(args.date, 10))) fail("Enter the date you sent it.");
  await cancelOpenCardSessions(context, invoice.id);
  const payment = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Invoice", invoice.id);
    const current = await tx.invoice.findUnique({ where: { id: invoice.id } });
    if (!["open", "partially_paid"].includes(current.status)) fail("This invoice is not open for payment.");
    const created = await tx.payment.create({ data: { invoiceId: invoice.id, method: "wire", amountMinor: amount, status: "reported", bankReference: reference, paidOn: str(args.date, 10), reportedById: user.id, reportedAt: /* @__PURE__ */ new Date() } });
    await notify(tx, { userIds: await staffWith(tx, "canManagePayments"), type: "transfer_reported", title: `Transfer reported on ${current.invoiceNumber}`, body: `${user.email} reported a transfer of ${(amount / 100).toFixed(2)} with reference ${reference}. Confirm it against the bank statement.`, link: "/dashboard/platform/payments" });
    await audit(tx, { actorId: user.id, action: "payment.reported", entityType: "Invoice", entityId: invoice.id, after: { amountMinor: amount, reference } });
    return created;
  });
  afterCommit(context);
  return payment;
}
async function confirmBankTransfer(context, args) {
  const staffId = context.session.itemId;
  const result = await inTransaction(context, async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: str(args.paymentId, 60) } });
    if (!payment) fail("Payment not found.");
    await lockRow(tx, "Invoice", payment.invoiceId);
    await lockRow(tx, "Payment", payment.id);
    const current = await tx.payment.findUnique({ where: { id: payment.id } });
    if (current.status !== "reported") fail(`This payment is already ${current.status}.`);
    const amount = args.amountMinor != null ? Math.round(Number(args.amountMinor)) : current.amountMinor;
    if (!Number.isSafeInteger(amount) || amount <= 0) fail("Enter the amount received.");
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: "confirmed", amountMinor: amount, bankReference: str(args.bankReference, 120) || current.bankReference, paidOn: str(args.paidOn, 10) || current.paidOn, confirmedById: staffId, confirmedAt: /* @__PURE__ */ new Date() } });
    await addPaid(tx, payment.invoiceId, amount);
    await audit(tx, { actorId: staffId, action: "payment.confirmed", entityType: "Payment", entityId: payment.id, before: { status: "reported", amountMinor: current.amountMinor }, after: { status: "confirmed", amountMinor: amount } });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function rejectBankTransfer(context, args) {
  const reason = str(args.reason, 500);
  if (!reason) fail("Write why the transfer is rejected.");
  const staffId = context.session.itemId;
  const result = await inTransaction(context, async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: str(args.paymentId, 60) }, include: { invoice: true } });
    if (!payment) fail("Payment not found.");
    await lockRow(tx, "Payment", payment.id);
    const current = await tx.payment.findUnique({ where: { id: payment.id } });
    if (current.status !== "reported") fail(`This payment is already ${current.status}.`);
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: "rejected", rejectionReason: reason, confirmedById: staffId, confirmedAt: /* @__PURE__ */ new Date() } });
    const inv = payment.invoice;
    const userIds = inv.buyerCompanyId ? await companyUsers(tx, inv.buyerCompanyId) : await organizationUsers(tx, inv.clientOrganizationId);
    await notify(tx, { userIds, type: "transfer_rejected", title: `Transfer on ${inv.invoiceNumber} not matched`, body: `We could not match the transfer you reported (reference ${current.bankReference}): ${reason}`, link: inv.buyerCompanyId ? `/buyer/invoices/${inv.invoiceNumber}` : `/client/invoices/${inv.invoiceNumber}` });
    await audit(tx, { actorId: staffId, action: "payment.rejected", entityType: "Payment", entityId: payment.id, reason });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function recordOfflinePayment(context, args) {
  const method = ["cheque", "cash", "wire", "ach"].includes(args.method) ? args.method : fail("Choose cheque, cash, wire or ACH.");
  const amount = Math.round(Number(args.amountMinor));
  if (!Number.isSafeInteger(amount) || amount <= 0) fail("Enter the amount received.");
  const staffId = context.session.itemId;
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Invoice", args.invoiceId) || fail("Invoice not found.");
    const invoice = await tx.invoice.findUnique({ where: { id: args.invoiceId } });
    if (!["open", "partially_paid"].includes(invoice.status)) fail("This invoice is not open for payment.");
    const payment = await tx.payment.create({ data: { invoiceId: invoice.id, method, amountMinor: amount, status: "confirmed", bankReference: str(args.reference, 120), paidOn: str(args.paidOn, 10) || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), reportedById: staffId, reportedAt: /* @__PURE__ */ new Date(), confirmedById: staffId, confirmedAt: /* @__PURE__ */ new Date() } });
    await addPaid(tx, invoice.id, amount);
    await audit(tx, { actorId: staffId, action: "payment.recorded", entityType: "Invoice", entityId: invoice.id, after: { method, amountMinor: amount } });
    return payment;
  });
  afterCommit(context);
  return result;
}
async function refundPayment(context, args) {
  const staffId = context.session.itemId;
  const key = str(args.idempotencyKey, 200);
  if (key.length < 8) fail("The request key is too short.");
  const reason = str(args.reason, 500);
  if (!reason) fail("Write the reason for the refund.");
  const reserved = await inTransaction(context, async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: str(args.paymentId, 60) } });
    if (!payment) fail("Payment not found.");
    await lockRow(tx, "Invoice", payment.invoiceId);
    await lockRow(tx, "Payment", payment.id);
    const replay = await tx.refund.findUnique({ where: { idempotencyKey: `${payment.id}:${key}` } });
    if (replay) {
      if (replay.amountMinor !== Math.round(Number(args.amountMinor))) fail("This refund was already sent with a different amount.");
      return { refund: replay, payment, call: false };
    }
    const current = await tx.payment.findUnique({ where: { id: payment.id } });
    if (!["captured", "confirmed", "partially_refunded"].includes(current.status)) fail("Only a received payment can be refunded.");
    const amount = Math.round(Number(args.amountMinor));
    const problem = refundProblem({ capturedMinor: current.amountMinor ?? 0, alreadyRefundedMinor: current.refundedMinor ?? 0, requestedMinor: amount });
    if (problem) fail(problem);
    const refundedMinor = (current.refundedMinor ?? 0) + amount;
    await tx.payment.update({ where: { id: current.id }, data: { refundedMinor, status: refundedMinor >= current.amountMinor ? "refunded" : "partially_refunded" } });
    const isCard = current.method === "card";
    const refund = await tx.refund.create({ data: { paymentId: current.id, invoiceId: current.invoiceId, amountMinor: amount, reason, status: isCard ? "pending" : "succeeded", method: isCard ? "card" : ["wire", "ach", "cheque", "cash"].includes(current.method) ? current.method : "wire", createdById: staffId, idempotencyKey: `${current.id}:${key}` } });
    if (!isCard) await applyRefundToInvoice(tx, current.invoiceId, amount);
    if (args.claimId) await tx.claim.update({ where: { id: args.claimId }, data: { refundId: refund.id } });
    await audit(tx, { actorId: staffId, action: "refund.created", entityType: "Payment", entityId: current.id, after: { amountMinor: amount, method: refund.method }, reason });
    return { refund, payment: current, call: isCard };
  });
  if (!reserved.call) return reserved.refund;
  try {
    const result = await refundPaymentFunction({ paymentId: reserved.payment.providerReference, amount: reserved.refund.amountMinor, idempotencyKey: `refund-${reserved.refund.id}` });
    return inTransaction(context, async (tx) => {
      await lockRow(tx, "Invoice", reserved.payment.invoiceId);
      const ok = ["succeeded", "pending"].includes(result.status);
      const updated = await tx.refund.update({ where: { id: reserved.refund.id }, data: { status: ok ? "succeeded" : "failed", providerReference: result.id } });
      if (ok) await applyRefundToInvoice(tx, reserved.payment.invoiceId, reserved.refund.amountMinor);
      else await releaseRefundReservation(tx, reserved.payment.id, reserved.refund.amountMinor);
      return updated;
    });
  } catch (error) {
    if (error instanceof StripeUnknownOutcome) {
      return context.prisma.refund.update({ where: { id: reserved.refund.id }, data: { status: "unknown" } });
    }
    await inTransaction(context, async (tx) => {
      await lockRow(tx, "Payment", reserved.payment.id);
      await tx.refund.update({ where: { id: reserved.refund.id }, data: { status: "failed", providerReference: String(error.message).slice(0, 200) } });
      await releaseRefundReservation(tx, reserved.payment.id, reserved.refund.amountMinor);
    });
    fail(`Stripe refused the refund: ${error.message}`);
  }
}
async function releaseRefundReservation(tx, paymentId, amount) {
  const p = await tx.payment.findUnique({ where: { id: paymentId } });
  const refundedMinor = Math.max(0, (p.refundedMinor ?? 0) - amount);
  await tx.payment.update({ where: { id: paymentId }, data: { refundedMinor, status: refundedMinor === 0 ? p.method === "card" ? "captured" : "confirmed" : "partially_refunded" } });
}
async function applyRefundToInvoice(tx, invoiceId, amount) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  await tx.invoice.update({ where: { id: invoiceId }, data: { refundedMinor: (invoice.refundedMinor ?? 0) + amount } });
  await recalculateInvoice(tx, invoiceId);
}
async function addInvoiceLine(context, args) {
  const kind = ["freight", "storage", "adjustment", "service"].includes(args.kind) ? args.kind : fail("Choose freight, storage, service or adjustment.");
  const unit = Math.round(Number(args.unitPriceMinor));
  const quantity = Math.max(1, Math.round(Number(args.quantity ?? 1)));
  if (!Number.isSafeInteger(unit) || kind !== "adjustment" && unit <= 0) fail("Enter an amount.");
  const description = str(args.description, 200) || (kind === "freight" ? "Freight" : kind === "storage" ? "Storage" : "Adjustment");
  const staffId = context.session.itemId;
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "Invoice", args.invoiceId) || fail("Invoice not found.");
    const invoice = await tx.invoice.findUnique({ where: { id: args.invoiceId } });
    if (!["open", "partially_paid"].includes(invoice.status)) fail("Lines can only be added to an unpaid invoice.");
    const open = await tx.paymentSession.count({ where: { invoiceId: invoice.id, status: { in: OPEN_SESSION } } });
    if (open) fail("A card payment is in progress on this invoice. Wait for it to finish.");
    await tx.invoiceLine.create({ data: { invoiceId: invoice.id, kind, description, quantity, unitPriceMinor: unit, totalMinor: unit * quantity } });
    await audit(tx, { actorId: staffId, action: "invoice.line_added", entityType: "Invoice", entityId: invoice.id, after: { kind, description, totalMinor: unit * quantity } });
    return recalculateInvoice(tx, invoice.id);
  });
}
async function voidInvoice(context, args) {
  const reason = str(args.reason, 500) || fail("Write why the invoice is void.");
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "Invoice", args.invoiceId) || fail("Invoice not found.");
    const invoice = await tx.invoice.findUnique({ where: { id: args.invoiceId } });
    if ((invoice.paidMinor ?? 0) > 0) fail("This invoice has payments. Refund them before voiding.");
    if (invoice.status === "void") return invoice;
    await tx.paymentSession.updateMany({ where: { invoiceId: invoice.id, status: { in: ["pending", "requires_action"] } }, data: { status: "canceled", openKey: null } });
    await audit(tx, { actorId: context.session.itemId, action: "invoice.void", entityType: "Invoice", entityId: invoice.id, reason });
    return tx.invoice.update({ where: { id: invoice.id }, data: { status: "void", voidReason: reason, isOverdue: false } });
  });
}

// features/keystone/lib/rules/bidding.ts
function rankBids(bids) {
  return [...bids].sort((a, b) => {
    if (b.amountMinor !== a.amountMinor) return b.amountMinor - a.amountMinor;
    const ta = new Date(a.submittedAt).getTime();
    const tb = new Date(b.submittedAt).getTime();
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
function minimumOpenBid(lot) {
  const opening = Math.max(0, lot.openingBidMinor ?? 0);
  if (!lot.bidCount || !lot.currentAmountMinor) return Math.max(opening, 1);
  return Math.max(opening, lot.currentAmountMinor + Math.max(1, lot.bidIncrementMinor ?? 1));
}
function softCloseExtension(input) {
  const remainingMs = input.closesAt.getTime() - input.now.getTime();
  if (remainingMs <= 0) return null;
  if (input.windowMinutes <= 0 || input.extensionMinutes <= 0) return null;
  if (remainingMs > input.windowMinutes * 6e4) return null;
  if (input.extensionCount >= input.maxExtensions) return null;
  return new Date(input.closesAt.getTime() + input.extensionMinutes * 6e4);
}
function bidEligibilityProblem(input) {
  if (input.companyStatus !== "approved") return { code: "not_approved", message: "Your company must be approved before it can bid." };
  if (!input.userActive) return { code: "inactive", message: "Your account is not active." };
  if ((input.currentTermsVersion || "") && input.acceptedTermsVersion !== input.currentTermsVersion) {
    return { code: "terms", message: "Accept the current wholesale terms before bidding." };
  }
  if (input.hasOverdueInvoice) return { code: "overdue", message: "You have an overdue invoice. Pay it to bid again." };
  if (input.spendLimitMinor != null && input.spendLimitMinor >= 0) {
    const exposure = input.unpaidAwardsMinor + input.otherActiveBidsMinor + input.bidAmountMinor;
    if (exposure > input.spendLimitMinor) return { code: "limit", message: "This bid would take you over your spending limit." };
  }
  return null;
}
function perLineTotal(lines, prices) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const price of prices) {
    const line = byId.get(price.lotLineId);
    if (!line) throw new RuleError("A bid line does not belong to this lot.");
    if (seen.has(price.lotLineId)) throw new RuleError(`Line ${line.lineNumber} appears twice.`);
    seen.add(price.lotLineId);
    const unit = Math.round(Number(price.unitPriceMinor));
    if (!Number.isSafeInteger(unit) || unit < 0) throw new RuleError(`Line ${line.lineNumber} has an invalid price.`);
    if (unit === 0) continue;
    out.push({ lotLineId: line.id, unitPriceMinor: unit, quantity: line.quantity, totalMinor: unit * line.quantity });
  }
  if (!out.length) throw new RuleError("Enter a price on at least one line.");
  return { lines: out, totalMinor: out.reduce((s, l) => s + l.totalMinor, 0) };
}
function planPerLineAward(bids, selection) {
  const byBid = new Map(bids.map((b) => [b.id, b]));
  const seenLines = /* @__PURE__ */ new Set();
  const groups = /* @__PURE__ */ new Map();
  for (const pick of selection) {
    if (seenLines.has(pick.lotLineId)) throw new RuleError("A line can be awarded to one buyer only.");
    seenLines.add(pick.lotLineId);
    const bid = byBid.get(pick.bidId);
    if (!bid) throw new RuleError("A chosen bid is no longer valid.");
    const line = bid.lines.find((l) => l.lotLineId === pick.lotLineId);
    if (!line) throw new RuleError("The chosen bid has no price for that line.");
    const group = groups.get(bid.id) ?? { bid, lines: [] };
    group.lines.push({ lotLineId: line.lotLineId, bidLineId: line.id, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor, totalMinor: line.unitPriceMinor * line.quantity });
    groups.set(bid.id, group);
  }
  return [...groups.values()].map((g) => ({ bidId: g.bid.id, companyId: g.bid.companyId, lines: g.lines, totalMinor: g.lines.reduce((s, l) => s + l.totalMinor, 0) }));
}
function awardOverrideProblem(input) {
  const below = input.reserveMinor != null && input.reserveMinor > 0 && input.totalMinor < input.reserveMinor;
  if (below && !input.confirmBelowReserve) return { below, message: "This award is below the reserve. Confirm the override to continue." };
  if (below && !input.reason.trim()) return { below, message: "Write a note explaining the award below reserve." };
  if (!input.isHighest && !input.reason.trim()) return { below, message: "Write a reason for awarding to a bid other than the highest." };
  return { below, message: null };
}

// features/keystone/domain/lots.ts
async function companyExposure(tx, companyId, excludeLotId) {
  const unpaid = await tx.invoice.aggregate({ where: { buyerCompanyId: companyId, status: { in: ["open", "partially_paid"] }, kind: "lot_sale" }, _sum: { totalMinor: true, paidMinor: true } });
  const active = await tx.bid.aggregate({ where: { companyId, status: "active", ...excludeLotId ? { lotId: { not: excludeLotId } } : {} }, _sum: { amountMinor: true } });
  const overdue = await tx.invoice.count({ where: { buyerCompanyId: companyId, isOverdue: true, status: { in: ["open", "partially_paid"] } } });
  return { unpaidAwardsMinor: (unpaid._sum.totalMinor ?? 0) - (unpaid._sum.paidMinor ?? 0), otherActiveBidsMinor: active._sum.amountMinor ?? 0, hasOverdueInvoice: overdue > 0 };
}
async function assertMayBid(tx, input) {
  const settings = await getSettings(tx);
  await lockRow(tx, "BuyerCompany", input.companyId);
  const company = await tx.buyerCompany.findUnique({ where: { id: input.companyId } });
  const user = await tx.user.findUnique({ where: { id: input.userId } });
  const exposure = await companyExposure(tx, input.companyId, input.lotId);
  const problem = bidEligibilityProblem({
    companyStatus: company.status,
    userActive: Boolean(user?.isActive),
    acceptedTermsVersion: input.skipTerms ? settings.wholesaleTermsVersion : user?.acceptedTermsVersion,
    currentTermsVersion: settings.wholesaleTermsVersion,
    spendLimitMinor: company.spendLimitMinor,
    bidAmountMinor: input.amountMinor,
    ...exposure
  });
  if (problem) fail(problem.message);
  return { company, settings };
}
async function advanceLotClock(context, onlyLotId) {
  const prisma = context.prisma;
  const [{ now }] = await prisma.$queryRawUnsafe("SELECT now() AS now");
  const scope = onlyLotId ? { id: onlyLotId } : {};
  const toOpen = await prisma.lot.findMany({ where: { ...scope, status: "scheduled", opensAt: { lte: now } }, select: { id: true }, take: 100 });
  for (const { id } of toOpen) {
    await prisma.$transaction(async (tx) => {
      await lockRow(tx, "Lot", id);
      const lot = await tx.lot.findUnique({ where: { id } });
      if (lot.status !== "scheduled" || new Date(lot.opensAt) > new Date(now)) return;
      await tx.lot.update({ where: { id }, data: { status: "open" } });
      await audit(tx, { action: "lot.opened", entityType: "Lot", entityId: id });
    });
  }
  const toClose = await prisma.lot.findMany({ where: { ...scope, status: "open", closesAt: { lte: now } }, select: { id: true }, take: 100 });
  for (const { id } of toClose) {
    await prisma.$transaction(async (tx) => {
      await lockRow(tx, "Lot", id);
      const lot2 = await tx.lot.findUnique({ where: { id } });
      const [{ now: t }] = await tx.$queryRawUnsafe("SELECT now() AS now");
      if (lot2.status !== "open" || new Date(lot2.closesAt) > new Date(t)) return;
      await tx.lot.update({ where: { id }, data: { status: "closed", closedAt: t } });
      await audit(tx, { action: "lot.closed", entityType: "Lot", entityId: id });
      const count = await tx.bid.count({ where: { lotId: id, status: "active" } });
      await notify(tx, { userIds: await staffWith(tx, "canAwardLots"), type: "lot_closed", title: `${lot2.lotNumber} closed with ${count} bid${count === 1 ? "" : "s"}`, body: `${lot2.title} closed. ${count ? "Review the bids and award." : "No bids; relist or cancel it."}`, link: `/dashboard/platform/lots/${id}`, dedupeKey: `lot-closed:${id}` });
    }, { timeout: 2e4 });
    const lot = await prisma.lot.findUnique({ where: { id }, select: { awardMode: true, format: true, bidBasis: true } });
    if (lot?.awardMode === "auto" && lot.bidBasis === "lot_total") {
      try {
        await autoAward(context, id);
      } catch (error) {
        console.error("[clock] auto-award", id, error.message);
      }
    }
  }
  if (onlyLotId) return;
  await expireStaleBids(context, new Date(now));
  await markOverdueInvoices(context, new Date(now));
  await sendLotReminders(context, new Date(now));
  await completeReleasedOrders(context, new Date(now));
}
async function expireStaleBids(context, now) {
  const settings = await getSettings(context.prisma);
  const lots = await context.prisma.lot.findMany({ where: { status: "closed", bids: { some: { status: "active" } } }, select: { id: true, closedAt: true, closesAt: true }, take: 100 });
  for (const lot of lots) {
    const closed = new Date(lot.closedAt ?? lot.closesAt);
    if (addBusinessDays(closed, settings.bidValidityBusinessDays, settings.timezone) > now) continue;
    await context.prisma.$transaction(async (tx) => {
      await lockRow(tx, "Lot", lot.id);
      const current = await tx.lot.findUnique({ where: { id: lot.id } });
      if (current.status !== "closed") return;
      const n = await tx.bid.updateMany({ where: { lotId: lot.id, status: "active" }, data: { status: "expired", activeKey: null } });
      if (n.count) await audit(tx, { action: "lot.bids_expired", entityType: "Lot", entityId: lot.id, after: { expired: n.count } });
    });
  }
}
async function markOverdueInvoices(context, now) {
  const settings = await getSettings(context.prisma);
  const candidates = await context.prisma.invoice.findMany({ where: { isOverdue: false, status: { in: ["open", "partially_paid"] }, dueAt: { lt: now } }, select: { id: true, dueAt: true, invoiceNumber: true, buyerCompanyId: true, clientOrganizationId: true }, take: 200 });
  for (const inv of candidates) {
    const n = await context.prisma.invoice.updateMany({ where: { id: inv.id, isOverdue: false }, data: { isOverdue: true } });
    if (!n.count) continue;
    if (inv.buyerCompanyId) {
      await context.prisma.$transaction(async (tx) => {
        await notify(tx, { userIds: await companyUsers(tx, inv.buyerCompanyId), type: "invoice_overdue", title: `Invoice ${inv.invoiceNumber} is overdue`, body: `Invoice ${inv.invoiceNumber} is past due. Bidding is paused until it is paid. After ${settings.paymentGraceBusinessDays} more business days the order may be cancelled with a restocking fee.`, link: `/buyer/invoices/${inv.invoiceNumber}`, dedupeKey: `overdue:${inv.id}` });
        await notify(tx, { userIds: await staffWith(tx, "canManagePayments"), type: "invoice_overdue", title: `${inv.invoiceNumber} is overdue`, body: "The buyer is blocked from bidding until it is paid.", link: "/dashboard/platform/invoices", dedupeKey: `overdue-staff:${inv.id}` });
      });
    }
  }
}
async function sendLotReminders(context, now) {
  const windows = [{ hours: 24, field: "reminder24SentAt" }, { hours: 2, field: "reminder2SentAt" }];
  for (const w of windows) {
    const lots = await context.prisma.lot.findMany({ where: { status: "open", [w.field]: null, closesAt: { lte: new Date(now.getTime() + w.hours * 36e5), gt: now } }, select: { id: true, lotNumber: true, title: true, categoryId: true }, take: 50 });
    for (const lot of lots) {
      const claimed = await context.prisma.lot.updateMany({ where: { id: lot.id, [w.field]: null }, data: { [w.field]: now } });
      if (!claimed.count) continue;
      await context.prisma.$transaction(async (tx) => {
        const bidders = await tx.bid.findMany({ where: { lotId: lot.id }, select: { companyId: true }, distinct: ["companyId"] });
        const bidderIds = new Set(bidders.map((b) => b.companyId));
        const interested = await tx.buyerCompany.findMany({ where: { status: "approved", ...lot.categoryId ? { categoriesOfInterest: { some: { id: lot.categoryId } } } : {} }, select: { id: true } });
        const users = [];
        for (const c of interested) if (!bidderIds.has(c.id)) users.push(...await companyUsers(tx, c.id));
        await notify(tx, { userIds: users, type: "lot_closing", title: `${lot.lotNumber} closes in ${w.hours} hour${w.hours === 1 ? "" : "s"}`, body: `${lot.title} closes soon.`, link: `/lots/${lot.lotNumber}`, dedupeKey: `lot-reminder-${w.hours}:${lot.id}` });
      });
    }
  }
}
async function completeReleasedOrders(context, now) {
  const orders = await context.prisma.order.findMany({ where: { status: "released", claimWindowEndsAt: { lte: now }, claims: { none: { status: { in: ["submitted", "under_review", "approved"] } } } }, select: { id: true, lotId: true }, take: 100 });
  for (const o of orders) {
    await context.prisma.$transaction(async (tx) => {
      await lockRow(tx, "Order", o.id);
      const order = await tx.order.findUnique({ where: { id: o.id } });
      if (order.status !== "released") return;
      await tx.order.update({ where: { id: o.id }, data: { status: "completed" } });
      await audit(tx, { action: "order.completed", entityType: "Order", entityId: o.id });
      await maybeCompleteLot(tx, o.lotId);
    });
  }
}
async function maybeCompleteLot(tx, lotId) {
  await lockRow(tx, "Lot", lotId);
  const lot = await tx.lot.findUnique({ where: { id: lotId } });
  if (lot.status !== "awarded") return;
  const open = await tx.order.count({ where: { lotId, status: { notIn: ["completed", "cancelled", "defaulted"] } } });
  const done = await tx.order.count({ where: { lotId, status: "completed" } });
  if (!open && done) {
    await tx.lot.update({ where: { id: lotId }, data: { status: "completed" } });
    await audit(tx, { action: "lot.completed", entityType: "Lot", entityId: lotId });
  }
}
async function publishLot(context, args) {
  const staffId = context.session.itemId;
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Lot", args.lotId) || fail("Lot not found.");
    const lot = await tx.lot.findUnique({ where: { id: args.lotId }, include: { lines: { include: { assets: true } } } });
    if (lot.status !== "draft") fail("Only a draft lot can be published.");
    if (!lot.lines.length) fail("Add at least one manifest line before publishing.");
    if (!lot.closesAt) fail("Set the close time.");
    const now = await dbNow(tx);
    const opensAt = lot.opensAt ? new Date(lot.opensAt) : now;
    if (new Date(lot.closesAt) <= opensAt) fail("The close time must be after the open time.");
    if (new Date(lot.closesAt) <= now) fail("The close time has already passed.");
    if (lot.format === "fixed_price" && !(lot.fixedPriceMinor > 0)) fail("Set the fixed price.");
    if (lot.format === "open_auction" && !(lot.bidIncrementMinor > 0)) fail("Set the bid increment.");
    if (lot.format === "fixed_price" && lot.bidBasis === "per_line") fail("A fixed-price lot is sold as a whole.");
    const blocked = lot.lines.flatMap((l) => l.assets).filter((a) => !sanitizationAllowsSale(a));
    if (blocked.length) fail(`${blocked.length} allocated asset${blocked.length === 1 ? " has" : "s have"} not passed sanitisation (${blocked.slice(0, 5).map((a) => a.assetNumber).join(", ")}).`);
    const status2 = opensAt <= now ? "open" : "scheduled";
    const updated = await tx.lot.update({ where: { id: lot.id }, data: { status: status2, opensAt, publishedAt: now, originalClosesAt: lot.closesAt, extensionCount: 0, bidCount: 0, currentAmountMinor: null } });
    await audit(tx, { actorId: staffId, action: "lot.published", entityType: "Lot", entityId: lot.id, before: { status: "draft" }, after: { status: status2 } });
    return updated;
  });
  return result;
}
async function publishSaleEvent(context, args) {
  const staffId = context.session.itemId;
  const event = await context.prisma.saleEvent.findUnique({ where: { id: args.saleEventId }, include: { lots: { select: { id: true, status: true } } } });
  if (!event) fail("Sale event not found.");
  if (event.status === "closed") fail("This sale event is closed.");
  const drafts = event.lots.filter((l) => l.status === "draft");
  if (!event.lots.length) fail("Add lots to the sale event first.");
  const problems = [];
  for (const lot of drafts) {
    try {
      await publishLot(context, { lotId: lot.id });
    } catch (error) {
      problems.push(`${error.message}`);
    }
  }
  if (problems.length && problems.length === drafts.length) fail(`No lot could be published: ${problems[0]}`);
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "SaleEvent", event.id);
    const current = await tx.saleEvent.findUnique({ where: { id: event.id }, include: { lots: { where: { status: { in: ["scheduled", "open"] } }, select: { categoryId: true } } } });
    const updated = await tx.saleEvent.update({ where: { id: event.id }, data: { status: "published" } });
    if ((args.announce ?? true) && !current.announcementSentAt) {
      const categoryIds = [...new Set(current.lots.map((l) => l.categoryId).filter(Boolean))];
      const companies = await tx.buyerCompany.findMany({ where: { status: "approved", ...categoryIds.length ? { OR: [{ categoriesOfInterest: { some: { id: { in: categoryIds } } } }, { categoriesOfInterest: { none: {} } }] } : {} }, select: { id: true } });
      const users = [];
      for (const c of companies) users.push(...await companyUsers(tx, c.id));
      await notify(tx, { userIds: users, type: "sale_announced", title: `New sale: ${event.title}`, body: `${current.lots.length} lot${current.lots.length === 1 ? "" : "s"} open for bidding. ${event.description || ""}`.trim(), link: "/lots", dedupeKey: `sale:${event.id}` });
      await tx.saleEvent.update({ where: { id: event.id }, data: { announcementSentAt: /* @__PURE__ */ new Date() } });
    }
    await audit(tx, { actorId: staffId, action: "sale_event.published", entityType: "SaleEvent", entityId: event.id, after: { problems } });
    return updated;
  }, BULK);
  afterCommit(context);
  return { saleEvent: result, problems };
}
async function bidderUsers(tx, lotId) {
  const companies = await tx.bid.findMany({ where: { lotId }, select: { companyId: true }, distinct: ["companyId"] });
  const out = [];
  for (const c of companies) out.push(...await companyUsers(tx, c.companyId));
  return out;
}
async function postLotAddendum(context, args) {
  const body = str(args.body, 4e3) || fail("Write the addendum.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Lot", args.lotId) || fail("Lot not found.");
    const lot = await tx.lot.findUnique({ where: { id: args.lotId } });
    if (!["scheduled", "open", "closed"].includes(lot.status)) fail("Addenda are for published lots.");
    const addendum = await tx.lotAddendum.create({ data: { lotId: lot.id, body, postedById: context.session.itemId, postedAt: /* @__PURE__ */ new Date() } });
    await notify(tx, { userIds: await bidderUsers(tx, lot.id), type: "lot_addendum", title: `Update to ${lot.lotNumber}`, body: `${lot.title}: ${body}`, link: `/lots/${lot.lotNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "lot.addendum", entityType: "Lot", entityId: lot.id, after: { body } });
    return addendum;
  });
  afterCommit(context);
  return result;
}
async function extendLotClose(context, args) {
  const closesAt = new Date(args.closesAt);
  if (Number.isNaN(closesAt.getTime())) fail("Choose the new close time.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Lot", args.lotId) || fail("Lot not found.");
    const lot = await tx.lot.findUnique({ where: { id: args.lotId } });
    if (!["scheduled", "open"].includes(lot.status)) fail("Only a scheduled or open lot can be extended.");
    if (closesAt <= new Date(lot.closesAt)) fail("The close time can be extended, never shortened.");
    const updated = await tx.lot.update({ where: { id: lot.id }, data: { closesAt } });
    await tx.lotAddendum.create({ data: { lotId: lot.id, body: `Closing time extended to ${closesAt.toISOString().slice(0, 16).replace("T", " ")} UTC.${args.reason ? ` ${str(args.reason, 500)}` : ""}`, postedById: context.session.itemId, postedAt: /* @__PURE__ */ new Date() } });
    await notify(tx, { userIds: await bidderUsers(tx, lot.id), type: "lot_extended", title: `${lot.lotNumber} now closes later`, body: `${lot.title} now closes at ${closesAt.toUTCString()}.`, link: `/lots/${lot.lotNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "lot.extended", entityType: "Lot", entityId: lot.id, before: { closesAt: lot.closesAt }, after: { closesAt }, reason: str(args.reason, 500) });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function freeLotAssets(tx, lotId) {
  const lines = await tx.lotLine.findMany({ where: { lotId }, select: { id: true } });
  const ids = lines.map((l) => l.id);
  if (!ids.length) return 0;
  const n = await tx.asset.updateMany({ where: { lotLineId: { in: ids }, status: "allocated" }, data: { status: "ready_for_sale", lotLineId: null } });
  return n.count;
}
async function cancelLot(context, args) {
  const reason = str(args.reason, 500) || fail("Write why the lot is cancelled.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Lot", args.lotId) || fail("Lot not found.");
    const lot = await tx.lot.findUnique({ where: { id: args.lotId } });
    if (!["draft", "scheduled", "open", "closed", "unsold"].includes(lot.status)) fail("An awarded lot cannot be cancelled; default or cancel its orders instead.");
    const users = await bidderUsers(tx, lot.id);
    await tx.bid.updateMany({ where: { lotId: lot.id, status: "active" }, data: { status: "void", activeKey: null } });
    const freed = await freeLotAssets(tx, lot.id);
    const updated = await tx.lot.update({ where: { id: lot.id }, data: { status: "cancelled", cancelReason: reason } });
    await notify(tx, { userIds: users, type: "lot_cancelled", title: `${lot.lotNumber} was cancelled`, body: `${lot.title} was withdrawn from sale: ${reason}. Your bid is void.`, link: `/lots/${lot.lotNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "lot.cancelled", entityType: "Lot", entityId: lot.id, before: { status: lot.status }, after: { status: "cancelled", freedAssets: freed }, reason });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function lotByNumber(db, lotNumber) {
  const lot = await db.lot.findUnique({ where: { lotNumber: str(lotNumber, 40) } });
  if (!lot) fail("Lot not found.");
  return lot;
}
async function placeBidCore(context, input) {
  const key = str(input.idempotencyKey, 200);
  if (key.length < 8) fail("The request key is too short.");
  const found = await lotByNumber(context.prisma, input.lotNumber);
  await advanceLotClock(context, found.id);
  const payload = { lotNumber: found.lotNumber, amountMinor: input.amountMinor ?? null, lines: input.lines ?? null, companyId: input.companyId, source: input.source };
  const result = await inTransaction(context, async (tx) => {
    return withCommandReceipt(tx, { key, eventType: "bid.placed", aggregateType: "Lot", aggregateId: found.id, actorId: input.userId, payload }, async () => {
      await lockRow(tx, "Lot", found.id);
      const lot = await tx.lot.findUnique({ where: { id: found.id }, include: { lines: { select: { id: true, quantity: true, lineNumber: true } } } });
      const now = await dbNow(tx);
      if (lot.status !== "open") fail(lot.status === "scheduled" ? "Bidding has not opened yet." : "Bidding on this lot has closed.");
      if (new Date(lot.closesAt) <= now) fail("Bidding on this lot has closed.");
      if (lot.format === "fixed_price") fail("This lot is sold at a fixed price. Use Buy now.");
      let amount;
      let lineRows = [];
      if (lot.bidBasis === "per_line") {
        if (!input.lines?.length) fail("Enter a price on at least one line.");
        try {
          const priced = perLineTotal(lot.lines, input.lines);
          amount = priced.totalMinor;
          lineRows = priced.lines;
        } catch (error) {
          fail(error.message);
        }
      } else {
        amount = Math.round(Number(input.amountMinor));
        if (!Number.isSafeInteger(amount) || amount <= 0) fail("Enter your bid amount.");
      }
      if (lot.format === "open_auction") {
        const min = minimumOpenBid(lot);
        if (amount < min) fail(`Your bid must be at least ${(min / 100).toFixed(2)}.`);
      } else if (lot.openingBidMinor && amount < lot.openingBidMinor) {
        fail(`The minimum bid is ${(lot.openingBidMinor / 100).toFixed(2)}.`);
      }
      const { settings } = await assertMayBid(tx, { companyId: input.companyId, userId: input.userId, lotId: lot.id, amountMinor: amount, skipTerms: input.skipTerms });
      const previous = await tx.bid.findFirst({ where: { lotId: lot.id, companyId: input.companyId, status: "active" } });
      if (previous && lot.format === "open_auction" && previous.amountMinor >= amount) fail("Your new bid must be higher than your current bid.");
      if (previous) await tx.bid.update({ where: { id: previous.id }, data: { status: "superseded", activeKey: null } });
      const bid = await tx.bid.create({
        data: {
          lotId: lot.id,
          companyId: input.companyId,
          placedById: input.userId,
          amountMinor: amount,
          status: "active",
          activeKey: `${lot.id}:${input.companyId}`,
          submittedAt: now,
          source: input.source,
          staffNote: str(input.staffNote, 1e3),
          sheetFileId: input.sheetFileId ?? null,
          idempotencyKey: `${input.userId}:${key}`,
          requestHash: requestHash(payload),
          ipAddress: clientIp(context),
          userAgent: userAgent(context),
          supersedesId: previous?.id ?? null,
          lines: lineRows.length ? { create: lineRows.map((l) => ({ lotLineId: l.lotLineId, unitPriceMinor: l.unitPriceMinor, quantity: l.quantity, status: "active" })) } : void 0
        }
      });
      const leaderBefore = lot.format === "open_auction" ? await tx.bid.findFirst({ where: { lotId: lot.id, status: "active", id: { not: bid.id } }, orderBy: [{ amountMinor: "desc" }, { submittedAt: "asc" }] }) : null;
      await refreshLotHigh(tx, lot.id);
      let closesAt = lot.closesAt;
      if (lot.format === "open_auction") {
        const extended = softCloseExtension({ now, closesAt: new Date(lot.closesAt), windowMinutes: settings.softCloseWindowMinutes, extensionMinutes: settings.softCloseExtensionMinutes, extensionCount: lot.extensionCount ?? 0, maxExtensions: settings.softCloseMaxExtensions });
        if (extended) {
          closesAt = extended;
          await tx.lot.update({ where: { id: lot.id }, data: { closesAt: extended, extensionCount: (lot.extensionCount ?? 0) + 1 } });
        }
        if (leaderBefore && leaderBefore.companyId !== input.companyId) {
          await notify(tx, { userIds: await companyUsers(tx, leaderBefore.companyId), type: "outbid", title: `You have been outbid on ${lot.lotNumber}`, body: `${lot.title}: the high bid is now ${(amount / 100).toFixed(2)}.`, link: `/lots/${lot.lotNumber}` });
        }
      }
      await audit(tx, { actorId: input.userId, action: input.source === "staff_entry" ? "bid.entered_by_staff" : "bid.placed", entityType: "Lot", entityId: lot.id, after: { bidId: bid.id, companyId: input.companyId, source: input.source, ...lot.format === "sealed_bid" ? {} : { amountMinor: amount } }, ipAddress: clientIp(context) });
      return { bidId: bid.id, amountMinor: amount, closesAt: new Date(closesAt).toISOString(), status: "active" };
    });
  });
  afterCommit(context);
  return result;
}
async function placeBid(context, args) {
  const { companyId, user } = await requireBuyer(context);
  return placeBidCore(context, { ...args, companyId, userId: user.id, source: "web" });
}
async function placeBidForBuyer(context, args) {
  const note = str(args.note, 1e3) || fail('Write how the bid reached you (for example "Phoned by J. Ortiz, 10:42").');
  const staffId = context.session.itemId;
  const company = await context.prisma.buyerCompany.findUnique({ where: { id: str(args.companyId, 60) }, include: { users: { where: { isActive: true, kind: "buyer" }, orderBy: { createdAt: "asc" }, take: 1 } } });
  if (!company) fail("Buyer not found.");
  const result = await placeBidCore(context, { ...args, companyId: company.id, userId: staffId, source: "staff_entry", staffNote: note, skipTerms: true });
  return result;
}
async function withdrawBid(context, args) {
  const { companyId, user } = await requireBuyer(context);
  const found = await lotByNumber(context.prisma, args.lotNumber);
  await advanceLotClock(context, found.id);
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "Lot", found.id);
    const lot = await tx.lot.findUnique({ where: { id: found.id } });
    if (lot.format !== "sealed_bid") fail("Only a sealed bid can be withdrawn.");
    if (lot.status !== "open" || new Date(lot.closesAt) <= await dbNow(tx)) fail("Bidding has closed; your bid stands.");
    const bid = await tx.bid.findFirst({ where: { lotId: lot.id, companyId, status: "active" } });
    if (!bid) fail("You have no active bid on this lot.");
    await tx.bid.update({ where: { id: bid.id }, data: { status: "withdrawn", activeKey: null } });
    await refreshLotHigh(tx, lot.id);
    await audit(tx, { actorId: user.id, action: "bid.withdrawn", entityType: "Lot", entityId: lot.id, after: { bidId: bid.id } });
    return { bidId: bid.id, status: "withdrawn" };
  });
}
async function buyNow(context, args) {
  const { companyId, user } = await requireBuyer(context);
  const key = str(args.idempotencyKey, 200);
  if (key.length < 8) fail("The request key is too short.");
  const found = await lotByNumber(context.prisma, args.lotNumber);
  await advanceLotClock(context, found.id);
  const result = await inTransaction(context, async (tx) => {
    return withCommandReceipt(tx, { key, eventType: "lot.buy_now", aggregateType: "Lot", aggregateId: found.id, actorId: user.id, payload: { lotNumber: found.lotNumber } }, async () => {
      await lockRow(tx, "Lot", found.id);
      const lot = await tx.lot.findUnique({ where: { id: found.id } });
      if (lot.format !== "fixed_price") fail("This lot is not sold at a fixed price.");
      if (lot.status !== "open" || new Date(lot.closesAt) <= await dbNow(tx)) fail("This lot is no longer available.");
      await assertMayBid(tx, { companyId, userId: user.id, lotId: lot.id, amountMinor: lot.fixedPriceMinor });
      const now = await dbNow(tx);
      const bid = await tx.bid.create({ data: { lotId: lot.id, companyId, placedById: user.id, amountMinor: lot.fixedPriceMinor, status: "active", activeKey: `${lot.id}:${companyId}`, submittedAt: now, source: "web", idempotencyKey: `${user.id}:${key}`, requestHash: requestHash({ lot: lot.id }), ipAddress: clientIp(context), userAgent: userAgent(context) } });
      await tx.lot.update({ where: { id: lot.id }, data: { status: "closed", closedAt: now, bidCount: 1, currentAmountMinor: lot.fixedPriceMinor } });
      const award = await createWholeLotAward(tx, { lotId: lot.id, bidId: bid.id, actorId: null, reason: "Buy now", confirmBelowReserve: true });
      return { orderNumber: award.orderNumber, invoiceNumber: award.invoiceNumber };
    });
  });
  afterCommit(context);
  return result;
}
async function lotForAward(tx, lotId) {
  await lockRow(tx, "Lot", lotId) || fail("Lot not found.");
  const lot = await tx.lot.findUnique({ where: { id: lotId }, include: { lines: { orderBy: { lineNumber: "asc" }, include: { assets: { select: { id: true, serialNumber: true } } } } } });
  if (lot.status !== "closed") fail(lot.status === "open" ? "The lot is still open." : `This lot is ${lot.status}; it cannot be awarded.`);
  return lot;
}
async function createAwardRecords(tx, input) {
  const settings = await getSettings(tx);
  const company = await tx.buyerCompany.findUnique({ where: { id: input.bid.companyId } });
  const now = await dbNow(tx);
  const total = input.lines.reduce((s, l) => s + l.totalMinor, 0);
  const award = await tx.award.create({
    data: {
      lotId: input.lot.id,
      bidId: input.bid.id,
      companyId: company.id,
      awardedById: input.actorId,
      awardedAt: now,
      amountMinor: total,
      isBelowReserve: input.isBelowReserve,
      overrideReason: input.reason,
      status: "active",
      activeLotKey: input.wholeLot ? input.lot.id : null,
      lines: { create: input.lines.map((l) => ({ lotLineId: l.lotLineId, activeLotLineKey: l.lotLineId, bidLineId: l.bidLineId ?? null, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor })) }
    }
  });
  const byLine = new Map(input.lot.lines.map((l) => [l.id, l]));
  const orderLines = input.lines.map((l, i) => {
    const src = byLine.get(l.lotLineId);
    const serials = Array.isArray(src.serials) && src.serials.length ? src.serials : src.assets.map((a) => a.serialNumber).filter(Boolean);
    return { lineNumber: src.lineNumber ?? i + 1, description: src.description || [src.manufacturer, src.model].filter(Boolean).join(" "), manufacturer: src.manufacturer, model: src.model, specs: src.specs ?? {}, grade: [src.cosmeticGrade, src.functionalGrade].filter(Boolean).join(" / "), quantity: l.quantity, unit: src.unit, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor, serials, sourceLotLineId: src.id };
  });
  const dueAt = addBusinessDays(now, settings.paymentDueBusinessDays, settings.timezone);
  const orderNumber = await nextNumber(tx, "order");
  const order = await tx.order.create({
    data: {
      orderNumber,
      companyId: company.id,
      lotId: input.lot.id,
      status: "awaiting_payment",
      paymentDueAt: dueAt,
      palletCount: input.wholeLot ? input.lot.palletCount : null,
      weight: input.wholeLot ? input.lot.weight : null,
      dimensions: input.wholeLot ? input.lot.dimensions : "",
      lines: { create: orderLines }
    }
  });
  await tx.award.update({ where: { id: award.id }, data: { orderId: order.id } });
  const items = orderLines.map((l) => ({ description: `Line ${l.lineNumber}: ${l.description}`, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor }));
  const lotLineItems = input.wholeLot && input.lot.bidBasis === "lot_total" ? [{ description: `${input.lot.lotNumber}: ${input.lot.title}`, quantity: 1, unitPriceMinor: total, totalMinor: total }] : items;
  const plan = awardInvoiceLines({ items: lotLineItems, premiumBps: settings.buyerPremiumBps, taxBps: settings.salesTaxBps, taxStatus: company.taxStatus, exported: false });
  const invoice = await createInvoice(tx, {
    kind: "lot_sale",
    buyerCompanyId: company.id,
    orderId: order.id,
    lines: plan.lines,
    billTo: { legalName: company.legalName, addressLine1: company.addressLine1, addressLine2: company.addressLine2, city: company.city, region: company.region, postalCode: company.postalCode, countryCode: company.countryCode, taxId: company.taxId },
    taxExemptReason: plan.taxExemptReason,
    dueAt
  });
  const invoiceNumber = invoice.invoiceNumber;
  const lineIds = input.lines.map((l) => l.lotLineId);
  await tx.asset.updateMany({ where: { lotLineId: { in: lineIds }, status: "allocated" }, data: { status: "sold" } });
  const assets = await tx.asset.findMany({ where: { lotLineId: { in: lineIds } }, select: { id: true, lotLineId: true }, orderBy: { assetNumber: "asc" } });
  for (const l of input.lines) {
    const own = assets.filter((a) => a.lotLineId === l.lotLineId);
    if (!own.length) continue;
    const each = Math.floor(l.totalMinor / own.length);
    for (let i = 0; i < own.length; i++) await tx.asset.update({ where: { id: own[i].id }, data: { soldPriceMinor: i === own.length - 1 ? l.totalMinor - each * (own.length - 1) : each } });
  }
  for (const a of assets) await tx.custodyEvent.create({ data: { assetId: a.id, type: "allocated", actorId: input.actorId, actorName: input.actorId ? "" : "System", occurredAt: now, notes: `Sold on ${input.lot.lotNumber}, order ${orderNumber}` } });
  await notify(tx, { userIds: await companyUsers(tx, company.id), type: "lot_won", title: `You won ${input.lot.lotNumber}`, body: `${input.lot.title}: invoice ${invoiceNumber} for ${(invoice.totalMinor / 100).toFixed(2)} is due ${dueAt.toDateString()}.`, link: `/buyer/invoices/${invoiceNumber}` });
  await audit(tx, { actorId: input.actorId, action: "lot.awarded", entityType: "Lot", entityId: input.lot.id, after: { awardId: award.id, companyId: company.id, amountMinor: total, orderNumber, invoiceNumber, isBelowReserve: input.isBelowReserve }, reason: input.reason });
  return { awardId: award.id, orderId: order.id, orderNumber, invoiceNumber };
}
async function finishLotAfterAward(tx, lotId, winners) {
  const bids = await tx.bid.findMany({ where: { lotId, status: "active" }, select: { id: true } });
  for (const b of bids) {
    const outcome = winners.get(b.id) ?? "lost";
    await tx.bid.update({ where: { id: b.id }, data: { status: outcome, activeKey: null } });
  }
  const losers = await tx.bid.findMany({ where: { lotId, status: "lost" }, select: { companyId: true }, distinct: ["companyId"] });
  const lot = await tx.lot.findUnique({ where: { id: lotId } });
  const winnerCompanies = new Set((await tx.award.findMany({ where: { lotId, status: "active" }, select: { companyId: true } })).map((a) => a.companyId));
  for (const l of losers) {
    if (winnerCompanies.has(l.companyId)) continue;
    await notify(tx, { userIds: await companyUsers(tx, l.companyId), type: "lot_lost", title: `${lot.lotNumber} was awarded to another buyer`, body: `Thank you for bidding on ${lot.title}.`, link: "/buyer/bids", dedupeKey: `lost:${lotId}:${l.companyId}` });
  }
  const lines = await tx.lotLine.findMany({ where: { lotId }, select: { id: true } });
  const unawarded = await tx.lotLine.findMany({ where: { lotId, from_AwardLine_lotLine: { none: { activeLotLineKey: { not: null } } } }, select: { id: true } });
  if (unawarded.length) await tx.asset.updateMany({ where: { lotLineId: { in: unawarded.map((l) => l.id) }, status: "allocated" }, data: { status: "ready_for_sale", lotLineId: null } });
  await tx.lot.update({ where: { id: lotId }, data: { status: unawarded.length === lines.length ? "unsold" : "awarded" } });
}
async function createWholeLotAward(tx, input) {
  const lot = await lotForAward(tx, input.lotId);
  const bid = await tx.bid.findUnique({ where: { id: input.bidId }, include: { lines: true } });
  if (!bid || bid.lotId !== lot.id || bid.status !== "active") fail("That bid is no longer valid.");
  const ranked = rankBids(await tx.bid.findMany({ where: { lotId: lot.id, status: "active" } }));
  const isHighest = ranked[0]?.id === bid.id;
  const guard2 = awardOverrideProblem({ totalMinor: bid.amountMinor, reserveMinor: lot.reserveMinor, confirmBelowReserve: input.confirmBelowReserve, isHighest, reason: input.reason });
  if (guard2.message) fail(guard2.message);
  let lines;
  if (lot.bidBasis === "per_line" && bid.lines.length) {
    lines = bid.lines.map((l) => ({ lotLineId: l.lotLineId, bidLineId: l.id, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.unitPriceMinor * l.quantity }));
  } else {
    const qty = lot.lines.reduce((s, l) => s + l.quantity, 0) || 1;
    let left = bid.amountMinor;
    lines = lot.lines.map((l, i) => {
      const share = i === lot.lines.length - 1 ? left : Math.floor(bid.amountMinor * l.quantity / qty);
      left -= share;
      return { lotLineId: l.id, quantity: l.quantity, unitPriceMinor: l.quantity ? Math.floor(share / l.quantity) : share, totalMinor: share };
    });
  }
  const created = await createAwardRecords(tx, { lot, bid, lines, actorId: input.actorId, reason: input.reason, isBelowReserve: guard2.below, wholeLot: true });
  await finishLotAfterAward(tx, lot.id, /* @__PURE__ */ new Map([[bid.id, "won"]]));
  return created;
}
async function autoAward(context, lotId) {
  await context.prisma.$transaction(async (tx) => {
    const lot = await tx.lot.findUnique({ where: { id: lotId } });
    if (lot.status !== "closed") return;
    const ranked = rankBids(await tx.bid.findMany({ where: { lotId, status: "active" } }));
    const top = ranked[0];
    if (!top) return;
    if (lot.reserveMinor && top.amountMinor < lot.reserveMinor) return;
    await createWholeLotAward(tx, { lotId, bidId: top.id, actorId: null, reason: "", confirmBelowReserve: false });
  }, { timeout: 3e4 });
}
async function awardLot(context, args) {
  const actorId = context.session.itemId;
  const reason = str(args.reason, 1e3);
  const result = await inTransaction(context, async (tx) => {
    if (args.lines?.length) {
      const lot = await lotForAward(tx, args.lotId);
      if (lot.bidBasis !== "per_line") fail("Split awards are for per-line lots.");
      const bids = await tx.bid.findMany({ where: { lotId: lot.id, status: "active" }, include: { lines: true } });
      let plan;
      try {
        plan = planPerLineAward(bids, args.lines);
      } catch (error) {
        fail(error.message);
      }
      const total = plan.reduce((s, g) => s + g.totalMinor, 0);
      const guard2 = awardOverrideProblem({ totalMinor: total, reserveMinor: lot.reserveMinor, confirmBelowReserve: Boolean(args.confirmBelowReserve), isHighest: true, reason });
      if (guard2.message) fail(guard2.message);
      const winners = /* @__PURE__ */ new Map();
      const created = [];
      for (const group of plan) {
        const bid = bids.find((b) => b.id === group.bidId);
        created.push(await createAwardRecords(tx, { lot, bid, lines: group.lines, actorId, reason, isBelowReserve: guard2.below, wholeLot: false }));
        winners.set(group.bidId, group.lines.length === bid.lines.length ? "won" : "partially_won");
      }
      await finishLotAfterAward(tx, lot.id, winners);
      return created;
    }
    if (!args.bidId) fail("Choose the winning bid.");
    return [await createWholeLotAward(tx, { lotId: args.lotId, bidId: args.bidId, actorId, reason, confirmBelowReserve: Boolean(args.confirmBelowReserve) })];
  }, BULK);
  afterCommit(context);
  return result;
}
async function declineLotBids(context, args) {
  const result = await inTransaction(context, async (tx) => {
    const lot = await lotForAward(tx, args.lotId);
    await finishLotAfterAward(tx, lot.id, /* @__PURE__ */ new Map());
    await audit(tx, { actorId: context.session.itemId, action: "lot.declined", entityType: "Lot", entityId: lot.id, reason: str(args.reason, 500) });
    return tx.lot.findUnique({ where: { id: lot.id } });
  });
  afterCommit(context);
  return result;
}
async function relistLot(context, args) {
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "Lot", args.lotId) || fail("Lot not found.");
    const lot = await tx.lot.findUnique({ where: { id: args.lotId }, include: { lines: { include: { assets: { select: { id: true, status: true } } } }, images: true } });
    if (!["unsold", "cancelled"].includes(lot.status)) fail("Only an unsold or cancelled lot can be relisted.");
    const existing = await tx.lot.findFirst({ where: { relistedFromId: lot.id, status: { notIn: ["cancelled"] } } });
    if (existing) fail(`This lot was already relisted as ${existing.lotNumber}.`);
    const copy = await tx.lot.create({
      data: {
        lotNumber: await nextNumber(tx, "lot"),
        title: lot.title,
        slug: "",
        categoryId: lot.categoryId,
        description: lot.description,
        conditionSummary: lot.conditionSummary,
        facilityId: lot.facilityId,
        status: "draft",
        format: lot.format,
        bidBasis: lot.bidBasis,
        awardMode: lot.awardMode,
        openingBidMinor: lot.openingBidMinor,
        reserveMinor: lot.reserveMinor,
        bidIncrementMinor: lot.bidIncrementMinor,
        fixedPriceMinor: lot.fixedPriceMinor,
        palletCount: lot.palletCount,
        weight: lot.weight,
        dimensions: lot.dimensions,
        shippingTerms: lot.shippingTerms,
        exportAllowed: lot.exportAllowed,
        warrantyDays: lot.warrantyDays,
        relistedFromId: lot.id,
        images: { create: lot.images.map((i) => ({ imageId: i.imageId, caption: i.caption, sortOrder: i.sortOrder })) }
      }
    });
    for (const line of lot.lines) {
      const { id: _id, lotId: _l, createdAt: _c, updatedAt: _u, assets, ...rest } = line;
      const created = await tx.lotLine.create({ data: { ...rest, specs: rest.specs ?? {}, serials: rest.serials ?? [], extra: rest.extra ?? {}, lotId: copy.id } });
      const free = assets.filter((a) => a.status === "ready_for_sale").map((a) => a.id);
      if (free.length) await tx.asset.updateMany({ where: { id: { in: free } }, data: { status: "allocated", lotLineId: created.id } });
    }
    await audit(tx, { actorId: context.session.itemId, action: "lot.relisted", entityType: "Lot", entityId: lot.id, after: { newLotId: copy.id, lotNumber: copy.lotNumber } });
    return copy;
  });
}
async function reAwardToRunnerUp(context, args) {
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Lot", args.lotId) || fail("Lot not found.");
    const lot = await tx.lot.findUnique({ where: { id: args.lotId } });
    if (!["awarded", "unsold"].includes(lot.status)) fail("Re-award is for a lot whose order defaulted.");
    if (lot.bidBasis !== "lot_total") fail("Re-award to a runner-up is for lot-total lots; relist a per-line lot.");
    const live = await tx.award.count({ where: { lotId: lot.id, status: "active" } });
    if (live) fail("This lot still has an active award.");
    const settings = await getSettings(tx);
    const closedAt = new Date(lot.closedAt ?? lot.closesAt);
    if (addBusinessDays(closedAt, settings.bidValidityBusinessDays + settings.paymentDueBusinessDays + settings.paymentGraceBusinessDays, settings.timezone) < await dbNow(tx)) fail("The remaining bids are no longer binding. Relist the lot.");
    const candidates = rankBids(await tx.bid.findMany({ where: { lotId: lot.id, status: "lost" } }));
    const pick = args.bidId ? candidates.find((b) => b.id === args.bidId) : candidates[0];
    if (!pick) fail("There is no runner-up bid to award.");
    const company = await tx.buyerCompany.findUnique({ where: { id: pick.companyId } });
    if (company.status !== "approved") fail(`${company.legalName} is ${company.status} and cannot be awarded.`);
    await tx.bid.update({ where: { id: pick.id }, data: { status: "active" } });
    await tx.lot.update({ where: { id: lot.id }, data: { status: "closed" } });
    const lines = await tx.lotLine.findMany({ where: { lotId: lot.id }, select: { id: true } });
    await tx.asset.updateMany({ where: { lotLineId: { in: lines.map((l) => l.id) }, status: { in: ["allocated", "ready_for_sale"] } }, data: { status: "allocated" } });
    const award = await createWholeLotAward(tx, { lotId: lot.id, bidId: pick.id, actorId: context.session.itemId, reason: str(args.reason, 500) || "Re-awarded to the next-ranked bid after a default", confirmBelowReserve: Boolean(args.confirmBelowReserve) });
    return award;
  });
  afterCommit(context);
  return result;
}
async function createLotFromAssets(context, args) {
  const title = str(args.title, 200) || fail("Give the lot a title.");
  const ids = [...new Set((args.assetIds || []).map((i) => str(i, 60)).filter(Boolean))].sort();
  if (!ids.length) fail("Choose at least one asset.");
  const settings = await getSettings(context.prisma);
  return inTransaction(context, async (tx) => {
    for (const id of ids) await lockRow(tx, "Asset", id) || fail("An asset was not found.");
    const assets = await tx.asset.findMany({ where: { id: { in: ids } }, include: { category: true, cosmeticGrade: true, functionalGrade: true } });
    for (const a of assets) {
      if (a.status !== "ready_for_sale") fail(`${a.assetNumber} is ${a.status.replace(/_/g, " ")}, not ready for sale.`);
      if (a.lotLineId) fail(`${a.assetNumber} is already on a lot.`);
      if (!sanitizationAllowsSale(a)) fail(`${a.assetNumber} has not passed sanitisation.`);
    }
    const format = ["sealed_bid", "open_auction", "fixed_price"].includes(String(args.format)) ? String(args.format) : settings.defaultBidFormat;
    const bidBasis = ["lot_total", "per_line"].includes(String(args.bidBasis)) ? String(args.bidBasis) : settings.defaultBidBasis;
    const lot = await tx.lot.create({ data: { lotNumber: await nextNumber(tx, "lot"), title, slug: "", categoryId: args.categoryId || assets[0].categoryId, facilityId: args.facilityId || null, saleEventId: args.saleEventId || null, status: "draft", format, bidBasis: format === "fixed_price" ? "lot_total" : bidBasis, awardMode: settings.defaultAwardMode, description: [{ type: "paragraph", children: [{ text: "" }] }], weight: assets.reduce((s, a) => s + Number(a.weight ?? 0), 0) || null } });
    const groups = /* @__PURE__ */ new Map();
    for (const a of assets) {
      const key = [a.categoryId, a.manufacturer, a.model, a.cosmeticGrade?.code, a.functionalGrade?.code, JSON.stringify(a.specs ?? {})].join("|");
      groups.set(key, [...groups.get(key) ?? [], a]);
    }
    let n = 0;
    for (const group of groups.values()) {
      const a = group[0];
      const line = await tx.lotLine.create({ data: { lotId: lot.id, lineNumber: ++n, categoryId: a.categoryId, manufacturer: a.manufacturer, model: a.model, partNumber: a.partNumber, description: [a.manufacturer, a.model].filter(Boolean).join(" ") || a.category?.name || "Item", specs: a.specs ?? {}, cosmeticGrade: a.cosmeticGrade?.label ?? "", functionalGrade: a.functionalGrade?.label ?? "", quantity: group.length, unit: "each", serials: group.map((g) => g.serialNumber).filter(Boolean) } });
      await tx.asset.updateMany({ where: { id: { in: group.map((g) => g.id) } }, data: { status: "allocated", lotLineId: line.id } });
    }
    await audit(tx, { actorId: context.session.itemId, action: "lot.created_from_assets", entityType: "Lot", entityId: lot.id, after: { assets: ids.length, lines: n } });
    return lot;
  }, BULK);
}
async function removeAssetsFromLot(context, args) {
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "Lot", args.lotId) || fail("Lot not found.");
    const lot = await tx.lot.findUnique({ where: { id: args.lotId }, include: { lines: { include: { assets: { select: { id: true } } } } } });
    if (lot.status !== "draft") fail("Assets can only be removed from a draft lot.");
    const ids = new Set(args.assetIds);
    for (const line of lot.lines) {
      const leaving = line.assets.filter((a) => ids.has(a.id)).map((a) => a.id);
      if (!leaving.length) continue;
      await tx.asset.updateMany({ where: { id: { in: leaving } }, data: { status: "ready_for_sale", lotLineId: null } });
      const left = line.assets.length - leaving.length;
      if (left <= 0) await tx.lotLine.delete({ where: { id: line.id } });
      else {
        const serials = (await tx.asset.findMany({ where: { lotLineId: line.id }, select: { serialNumber: true } })).map((a) => a.serialNumber).filter(Boolean);
        await tx.lotLine.update({ where: { id: line.id }, data: { quantity: left, serials } });
      }
    }
    return tx.lot.findUnique({ where: { id: lot.id } });
  });
}
async function lotBidBoard(context, args) {
  await advanceLotClock(context, args.lotId);
  const lot = await context.prisma.lot.findUnique({ where: { id: str(args.lotId, 60) }, include: { lines: { orderBy: { lineNumber: "asc" } } } });
  if (!lot) fail("Lot not found.");
  const hidden = lot.format === "sealed_bid" && ["open", "scheduled"].includes(lot.status) && !hasPermission(context.session ?? null, "canSeeSealedBidAmountsBeforeClose");
  const active = await context.prisma.bid.count({ where: { lotId: lot.id, status: "active" } });
  if (hidden) return { lotId: lot.id, status: lot.status, sealed: true, activeCount: active, bids: [], lines: [], reserveMinor: null };
  const bids = await context.prisma.bid.findMany({ where: { lotId: lot.id }, include: { company: { select: { id: true, legalName: true, status: true, strikes: true } }, placedBy: { select: { name: true, kind: true } }, lines: true }, orderBy: [{ submittedAt: "asc" }] });
  const ranked = rankBids(bids.filter((b) => b.status === "active" || b.status === "lost" || b.status === "won" || b.status === "partially_won"));
  const rankOf = new Map(ranked.map((b, i) => [b.id, i + 1]));
  const perLine = lot.lines.map((line) => {
    const offers = bids.filter((b) => b.status === "active").flatMap((b) => b.lines.filter((l) => l.lotLineId === line.id).map((l) => ({ bidId: b.id, bidLineId: l.id, companyId: b.companyId, company: b.company.legalName, unitPriceMinor: l.unitPriceMinor, totalMinor: l.unitPriceMinor * l.quantity, submittedAt: b.submittedAt })));
    offers.sort((a, b) => b.unitPriceMinor - a.unitPriceMinor || new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    return { lotLineId: line.id, lineNumber: line.lineNumber, description: line.description, quantity: line.quantity, offers };
  });
  return {
    lotId: lot.id,
    status: lot.status,
    sealed: false,
    activeCount: active,
    reserveMinor: lot.reserveMinor,
    bids: bids.map((b) => ({ id: b.id, companyId: b.companyId, company: b.company.legalName, companyStatus: b.company.status, strikes: b.company.strikes, amountMinor: b.amountMinor, status: b.status, source: b.source, staffNote: b.staffNote, placedBy: b.placedBy?.name ?? "", submittedAt: b.submittedAt, rank: rankOf.get(b.id) ?? null, lineCount: b.lines.length })),
    lines: perLine
  };
}

// features/keystone/domain/orders.ts
async function orderForBuyer(context, orderNumber) {
  const { companyId, user } = await requireBuyer(context);
  const order = await context.prisma.order.findUnique({ where: { orderNumber: str(orderNumber, 40) } });
  if (!order || order.companyId !== companyId) fail("Order not found.");
  return { order, user, companyId };
}
var COUNTRY = /^[A-Z]{2}$/;
async function setOrderRelease(context, args) {
  const { order, user } = await orderForBuyer(context, args.orderNumber);
  const method = args.method === "freight" ? "freight" : args.method === "pickup" ? "pickup" : fail("Choose own pickup or freight.");
  const destination = str(args.destinationCountry, 2).toUpperCase();
  if (!COUNTRY.test(destination)) fail("Choose the destination country.");
  const date = args.preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(args.preferredDate) ? /* @__PURE__ */ new Date(`${args.preferredDate}T12:00:00Z`) : null;
  if (method === "pickup" && !str(args.driverName, 120)) fail("Enter the name of the driver who will collect.");
  if (method === "freight" && !str(args.carrierName, 120)) fail("Enter the carrier.");
  const settings = await getSettings(context.prisma);
  const lot = await context.prisma.lot.findUnique({ where: { id: order.lotId }, select: { exportAllowed: true } });
  const home = (await context.prisma.facility.findFirst({ where: { isActive: true }, select: { countryCode: true } }))?.countryCode || "US";
  const exporting = destination !== home;
  if (exporting && !lot?.exportAllowed) fail("This lot may not be exported. Choose a domestic destination.");
  if (exporting && !args.exportAcknowledged) fail("Confirm you have read the export clause.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Order", order.id);
    const current = await tx.order.findUnique({ where: { id: order.id } });
    if (!["awaiting_payment", "paid", "ready_for_release"].includes(current.status)) fail("This order can no longer be changed.");
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        releaseMethod: method,
        preferredPickupDate: method === "pickup" ? date : null,
        freightPickupDate: method === "freight" ? date : null,
        driverName: method === "pickup" ? str(args.driverName, 120) : "",
        carrierName: method === "freight" ? str(args.carrierName, 120) : "",
        carrierReference: method === "freight" ? str(args.carrierReference, 120) : "",
        destinationCountry: destination,
        exportAcknowledgedAt: exporting ? /* @__PURE__ */ new Date() : null,
        releaseDetailsSetAt: /* @__PURE__ */ new Date()
      }
    });
    await notify(tx, { userIds: await staffWith(tx, "canDispatch"), type: "release_details", title: `${current.orderNumber}: ${method === "pickup" ? "pickup" : "freight"} details set`, body: `${method === "pickup" ? `Driver ${str(args.driverName, 120)}` : `Carrier ${str(args.carrierName, 120)}`}${date ? `, preferred ${args.preferredDate}` : ""}. Destination ${destination}. ${settings.exportClause && exporting ? "Export acknowledged." : ""}`.trim(), link: `/dashboard/platform/orders/${order.id}` });
    await audit(tx, { actorId: user.id, action: "order.release_details", entityType: "Order", entityId: order.id, after: { method, destination } });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function markOrderReady(context, args) {
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Order", args.orderId) || fail("Order not found.");
    const order = await tx.order.findUnique({ where: { id: args.orderId } });
    if (order.status !== "paid") fail(order.status === "awaiting_payment" ? "The order is not paid yet." : `This order is ${order.status.replace(/_/g, " ")}.`);
    const settings = await getSettings(tx);
    const now = await dbNow(tx);
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "ready_for_release",
        readyAt: now,
        removalDueAt: addBusinessDays(now, settings.removalBusinessDays, settings.timezone),
        palletCount: args.palletCount != null ? Math.max(0, Math.round(args.palletCount)) : order.palletCount,
        weight: args.weight != null ? Math.max(0, Number(args.weight)) : order.weight,
        dimensions: args.dimensions != null ? str(args.dimensions, 200) : order.dimensions
      }
    });
    await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: "order_ready", title: `${order.orderNumber} is ready for collection`, body: `Your goods are ready. Please collect within ${settings.removalBusinessDays} business days; storage is charged after that. The pickup address is on the order page.`, link: `/buyer/orders/${order.orderNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "order.ready", entityType: "Order", entityId: order.id, before: { status: "paid" }, after: { status: "ready_for_release" } });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function releaseOrder(context, args) {
  const driverName = str(args.driverName, 120) || fail("Enter the driver name.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Order", args.orderId) || fail("Order not found.");
    const order = await tx.order.findUnique({ where: { id: args.orderId }, include: { lines: true } });
    if (order.status !== "ready_for_release") fail("Mark the order ready before releasing it.");
    const settings = await getSettings(tx);
    const now = await dbNow(tx);
    const sig = await storeUpload(tx, args.signature, { purpose: "driver_signature", ownerBuyerCompanyId: order.companyId, uploadedById: context.session.itemId });
    const updated = await tx.order.update({ where: { id: order.id }, data: { status: "released", releasedAt: now, releasedById: context.session.itemId, driverName, billOfLading: str(args.billOfLading, 120), driverSignatureId: sig?.id ?? null, claimWindowEndsAt: addBusinessDays(now, settings.claimWindowBusinessDays, settings.timezone) } });
    const lineIds = order.lines.map((l) => l.sourceLotLineId).filter(Boolean);
    const assets = await tx.asset.findMany({ where: { lotLineId: { in: lineIds }, status: "sold" }, select: { id: true } });
    await tx.asset.updateMany({ where: { id: { in: assets.map((a) => a.id) } }, data: { status: "released" } });
    for (const a of assets) await tx.custodyEvent.create({ data: { assetId: a.id, type: "released_to_buyer", actorId: context.session.itemId, occurredAt: now, signerName: driverName, signatureId: sig?.id ?? null, notes: `Order ${order.orderNumber}${args.billOfLading ? `, BOL ${args.billOfLading}` : ""}` } });
    await tx.dockAppointment.updateMany({ where: { orderId: order.id, status: { in: ["booked", "arrived"] } }, data: { status: "done" } });
    await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: "order_released", title: `${order.orderNumber} has left our dock`, body: `Released to ${driverName}. Report any shortage or damage within ${settings.claimWindowBusinessDays} business days by email.`, link: `/buyer/orders/${order.orderNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "order.released", entityType: "Order", entityId: order.id, after: { driverName, assets: assets.length } });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function defaultOrder(context, args) {
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Order", args.orderId) || fail("Order not found.");
    const order = await tx.order.findUnique({ where: { id: args.orderId }, include: { invoice: true, award: true } });
    if (order.status !== "awaiting_payment") fail("Only an unpaid order can be defaulted.");
    const settings = await getSettings(tx);
    const now = await dbNow(tx);
    const graceEnds = addBusinessDays(new Date(order.paymentDueAt), settings.paymentGraceBusinessDays, settings.timezone);
    if (graceEnds > now) fail(`The grace period runs until ${graceEnds.toDateString()}.`);
    const invoice = order.invoice;
    if (invoice) {
      await lockRow(tx, "Invoice", invoice.id);
      if ((invoice.paidMinor ?? 0) > 0) fail("This invoice has a part payment. Refund it or cancel the order instead.");
      await tx.paymentSession.updateMany({ where: { invoiceId: invoice.id, status: { in: ["pending", "requires_action"] } }, data: { status: "canceled", openKey: null } });
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: "void", voidReason: "Order defaulted", isOverdue: false } });
    }
    let restockingNumber = null;
    if (!args.waiveFee) {
      const fee = restockingFee(order.award?.amountMinor ?? invoice?.subtotalMinor ?? 0, settings.restockingFeeBps);
      if (fee > 0) {
        const company2 = await tx.buyerCompany.findUnique({ where: { id: order.companyId } });
        const restocking = await createInvoice(tx, { kind: "restocking", buyerCompanyId: order.companyId, lines: [{ kind: "service", description: `Restocking fee (${settings.restockingFeeBps / 100}%) on ${order.orderNumber}`, quantity: 1, unitPriceMinor: fee, totalMinor: fee }], billTo: { legalName: company2.legalName, countryCode: company2.countryCode } });
        await tx.order.update({ where: { id: order.id }, data: { restockingInvoiceId: restocking.id } });
        restockingNumber = restocking.invoiceNumber;
      }
    }
    await tx.order.update({ where: { id: order.id }, data: { status: "defaulted", cancelReason: str(args.reason, 500) || "Not paid" } });
    if (order.award) await tx.award.update({ where: { id: order.award.id }, data: { status: "defaulted", activeLotKey: null } });
    const awardLines = order.award ? await tx.awardLine.findMany({ where: { awardId: order.award.id } }) : [];
    await tx.awardLine.updateMany({ where: { awardId: order.award?.id ?? "" }, data: { activeLotLineKey: null } });
    if (order.award?.bidId) await tx.bid.update({ where: { id: order.award.bidId }, data: { status: "defaulted" } });
    const lineIds = awardLines.map((l) => l.lotLineId);
    await tx.asset.updateMany({ where: { lotLineId: { in: lineIds }, status: "sold" }, data: { status: "allocated" } });
    const company = await tx.buyerCompany.findUnique({ where: { id: order.companyId } });
    const strikes = strikeOutcome(company.strikes ?? 0, settings.strikesBeforeSuspension);
    await tx.buyerCompany.update({ where: { id: company.id }, data: { strikes: strikes.strikes } });
    if (strikes.suspend && company.status === "approved") await suspendCompany(tx, company.id, `${strikes.strikes} unpaid orders`, context.session.itemId);
    await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: "order_defaulted", title: `${order.orderNumber} was cancelled for non-payment`, body: `Invoice ${invoice?.invoiceNumber ?? ""} was not paid. ${restockingNumber ? `A restocking invoice ${restockingNumber} has been issued.` : ""} This is strike ${strikes.strikes} of ${settings.strikesBeforeSuspension}.`, link: "/buyer" });
    await audit(tx, { actorId: context.session.itemId, action: "order.defaulted", entityType: "Order", entityId: order.id, after: { restockingInvoice: restockingNumber, strikes: strikes.strikes, suspended: strikes.suspend }, reason: str(args.reason, 500) });
    const live = await tx.award.count({ where: { lotId: order.lotId, status: "active" } });
    if (!live) await tx.lot.update({ where: { id: order.lotId }, data: { status: "unsold" } });
    return { order: await tx.order.findUnique({ where: { id: order.id } }), restockingInvoiceNumber: restockingNumber, strikes: strikes.strikes, suspended: strikes.suspend };
  });
  afterCommit(context);
  return result;
}
async function waiveRestockingFee(context, args) {
  const reason = str(args.reason, 500) || fail("Write why the fee is waived.");
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "Order", args.orderId) || fail("Order not found.");
    const order = await tx.order.findUnique({ where: { id: args.orderId } });
    if (!order.restockingInvoiceId) fail("This order has no restocking invoice.");
    await lockRow(tx, "Invoice", order.restockingInvoiceId);
    const invoice = await tx.invoice.findUnique({ where: { id: order.restockingInvoiceId } });
    if ((invoice.paidMinor ?? 0) > 0) fail("The restocking fee has been paid; refund it instead.");
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "void", waived: true, voidReason: `Waived: ${reason}`, isOverdue: false } });
    await audit(tx, { actorId: context.session.itemId, action: "order.restocking_waived", entityType: "Order", entityId: order.id, reason });
    return tx.invoice.findUnique({ where: { id: invoice.id } });
  });
}
async function cancelOrder(context, args) {
  const reason = str(args.reason, 500) || fail("Write why the order is cancelled.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Order", args.orderId) || fail("Order not found.");
    const order = await tx.order.findUnique({ where: { id: args.orderId }, include: { invoice: true, award: true } });
    if (!["awaiting_payment", "paid", "ready_for_release"].includes(order.status)) fail(`This order is ${order.status.replace(/_/g, " ")}.`);
    if (order.invoice) {
      await lockRow(tx, "Invoice", order.invoice.id);
      const inv = await tx.invoice.findUnique({ where: { id: order.invoice.id } });
      if ((inv.paidMinor ?? 0) - (inv.refundedMinor ?? 0) > 0) fail("Refund the payments on this order first (Payments page), then cancel.");
      await tx.paymentSession.updateMany({ where: { invoiceId: inv.id, status: { in: ["pending", "requires_action"] } }, data: { status: "canceled", openKey: null } });
      if (inv.status !== "refunded") await tx.invoice.update({ where: { id: inv.id }, data: { status: "void", voidReason: `Order cancelled: ${reason}`, isOverdue: false } });
    }
    await tx.order.update({ where: { id: order.id }, data: { status: "cancelled", cancelReason: reason } });
    if (order.award) {
      await tx.award.update({ where: { id: order.award.id }, data: { status: "cancelled", activeLotKey: null } });
      const lines = await tx.awardLine.findMany({ where: { awardId: order.award.id } });
      await tx.awardLine.updateMany({ where: { awardId: order.award.id }, data: { activeLotLineKey: null } });
      await tx.asset.updateMany({ where: { lotLineId: { in: lines.map((l) => l.lotLineId) }, status: "sold" }, data: { status: "ready_for_sale", lotLineId: null } });
    }
    const live = await tx.award.count({ where: { lotId: order.lotId, status: "active" } });
    if (!live) await tx.lot.update({ where: { id: order.lotId }, data: { status: "unsold" } });
    else await maybeCompleteLot(tx, order.lotId);
    await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: "order_cancelled", title: `${order.orderNumber} was cancelled`, body: reason, link: `/buyer/orders/${order.orderNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "order.cancelled", entityType: "Order", entityId: order.id, reason });
    return tx.order.findUnique({ where: { id: order.id } });
  });
  afterCommit(context);
  return result;
}
async function bookDockAppointment(context, args) {
  const startsAt = new Date(args.startsAt);
  if (Number.isNaN(startsAt.getTime())) fail("Choose the slot.");
  if (!args.orderId && !args.jobId) fail("Link the slot to an order or a drop-off job.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Facility", args.facilityId) || fail("Facility not found.");
    const facility = await tx.facility.findUnique({ where: { id: args.facilityId } });
    if (!facility.isActive) fail("This facility is not active.");
    const minutes = Math.max(15, facility.dockSlotMinutes || 60);
    const settings = await getSettings(tx);
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(startsAt);
    const grid = dockSlots({ date: localDate, hours: facility.hours, slotMinutes: minutes, perWindow: 1, timeZone: settings.timezone, booked: [] });
    const slot = grid.slots.find((g) => g.startsAt <= startsAt && startsAt < g.endsAt);
    if (!slot) fail(grid.open ? `That time is outside ${facility.name}'s dock hours.` : `${facility.name} is closed that day.`);
    const slotStart = slot.startsAt;
    const endsAt = slot.endsAt;
    if (slotStart.getTime() < Date.now() - minutes * 6e4) fail("That slot is in the past.");
    const taken = await tx.dockAppointment.count({ where: { facilityId: facility.id, status: { in: ["booked", "arrived"] }, startsAt: { lt: endsAt }, endsAt: { gt: slotStart }, ...args.appointmentId ? { id: { not: args.appointmentId } } : {} } });
    if (taken >= Math.max(1, facility.dockSlotsPerWindow || 1)) fail("That slot is full. Choose another time.");
    if (args.orderId) {
      const order = await tx.order.findUnique({ where: { id: args.orderId } });
      if (!order) fail("Order not found.");
      if (!["paid", "ready_for_release"].includes(order.status)) fail("Book a pickup slot once the order is paid.");
    }
    const data = { facilityId: facility.id, startsAt: slotStart, endsAt, orderId: args.orderId || null, jobId: args.jobId || null, driverName: str(args.driverName, 120), vehicle: str(args.vehicle, 120), notes: str(args.notes, 500), status: "booked" };
    let appt;
    if (args.appointmentId) {
      await lockRow(tx, "DockAppointment", args.appointmentId) || fail("Appointment not found.");
      appt = await tx.dockAppointment.update({ where: { id: args.appointmentId }, data });
    } else {
      if (args.orderId) {
        const existing = await tx.dockAppointment.findUnique({ where: { orderId: args.orderId } });
        if (existing) {
          appt = await tx.dockAppointment.update({ where: { id: existing.id }, data });
        }
      }
      appt = appt ?? await tx.dockAppointment.create({ data });
    }
    if (args.orderId) {
      const order = await tx.order.findUnique({ where: { id: args.orderId } });
      await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: "dock_booked", title: `Pickup booked for ${order.orderNumber}`, body: `Your pickup is booked at ${facility.name} on ${slotStart.toUTCString()}. ${facility.pickupInstructions || ""}`.trim(), link: `/buyer/orders/${order.orderNumber}` });
    }
    await audit(tx, { actorId: context.session.itemId, action: args.appointmentId ? "dock.moved" : "dock.booked", entityType: "DockAppointment", entityId: appt.id, after: { startsAt: slotStart } });
    return appt;
  });
  afterCommit(context);
  return result;
}
async function setDockAppointmentStatus(context, args) {
  const status2 = str(args.status, 20);
  const allowed = { arrived: ["booked"], done: ["booked", "arrived"], no_show: ["booked"], cancelled: ["booked", "arrived"] };
  if (!allowed[status2]) fail("Choose arrived, done, no-show or cancelled.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "DockAppointment", args.appointmentId) || fail("Appointment not found.");
    const appt = await tx.dockAppointment.findUnique({ where: { id: args.appointmentId }, include: { order: true } });
    if (!allowed[status2].includes(appt.status)) fail(`A slot that is ${appt.status.replace(/_/g, " ")} cannot be marked ${status2.replace(/_/g, " ")}.`);
    const note = str(args.note, 500);
    const updated = await tx.dockAppointment.update({ where: { id: appt.id }, data: { status: status2, ...note ? { notes: [appt.notes, note].filter(Boolean).join("\n") } : {} } });
    if (status2 === "cancelled" && appt.order) {
      await notify(tx, { userIds: await companyUsers(tx, appt.order.companyId), type: "dock_cancelled", title: `Pickup slot for ${appt.order.orderNumber} cancelled`, body: note || "Book another slot from your order.", link: `/buyer/orders/${appt.order.orderNumber}` });
    }
    await audit(tx, { actorId: context.session.itemId, action: `dock.${status2}`, entityType: "DockAppointment", entityId: appt.id, before: { status: appt.status }, after: { status: status2 }, reason: note || void 0 });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function dockDay(context, args) {
  const facility = await context.prisma.facility.findUnique({ where: { id: args.facilityId } });
  if (!facility) fail("Facility not found.");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const tz = (await getSettings(context.prisma)).timezone;
  const start = zonedInstant(day, "00:00", tz);
  const end = new Date(zonedInstant(new Date(Date.parse(`${day}T12:00:00Z`) + 864e5).toISOString().slice(0, 10), "00:00", tz));
  const appointments = await context.prisma.dockAppointment.findMany({ where: { facilityId: facility.id, startsAt: { gte: start, lt: end } }, include: { order: { select: { id: true, orderNumber: true, company: { select: { legalName: true } } } }, job: { select: { id: true, jobNumber: true, organization: { select: { name: true } } } } }, orderBy: { startsAt: "asc" } });
  const settings = await getSettings(context.prisma);
  const live = appointments.filter((a) => ["booked", "arrived"].includes(a.status));
  const grid = dockSlots({ date: day, hours: facility.hours, slotMinutes: facility.dockSlotMinutes, perWindow: facility.dockSlotsPerWindow, timeZone: settings.timezone, booked: live });
  return { date: day, timeZone: settings.timezone, facility: { id: facility.id, name: facility.name, slotMinutes: facility.dockSlotMinutes, perWindow: facility.dockSlotsPerWindow, hours: facility.hours }, open: grid.open, slots: grid.slots, appointments };
}
async function openClaim(context, args) {
  const reason = ["shortage", "wrong_item", "misgraded", "dead_on_arrival", "damage", "other"].includes(args.reason) ? args.reason : fail("Choose the reason.");
  const description = str(args.description, 4e3) || fail("Write what the buyer reported.");
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Order", args.orderId) || fail("Order not found.");
    const order = await tx.order.findUnique({ where: { id: args.orderId } });
    if (!["released", "completed"].includes(order.status)) fail("Claims are for orders that have been released.");
    const settings = await getSettings(tx);
    const now = await dbNow(tx);
    const lateNote = order.claimWindowEndsAt && new Date(order.claimWindowEndsAt) < now ? " (reported after the claim window)" : "";
    const claim = await tx.claim.create({
      data: {
        claimNumber: await nextNumber(tx, "claim"),
        orderId: order.id,
        companyId: order.companyId,
        openedById: context.session.itemId,
        reason,
        description: description + lateNote,
        lines: (args.lines ?? []).map((l) => ({ lineNumber: Math.round(l.lineNumber), quantity: Math.max(0, Math.round(l.quantity)), note: str(l.note, 300) })),
        requestedAmountMinor: args.requestedAmountMinor != null ? Math.max(0, Math.round(args.requestedAmountMinor)) : null,
        status: "submitted"
      }
    });
    for (const photo of (args.photos ?? []).slice(0, 12)) {
      const stored = await storeUpload(tx, photo, { purpose: "claim_photo", ownerBuyerCompanyId: order.companyId, uploadedById: context.session.itemId });
      if (stored) await tx.claimPhoto.create({ data: { claimId: claim.id, imageId: stored.id, caption: "" } });
    }
    await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: "claim_opened", title: `Claim ${claim.claimNumber} recorded`, body: `We recorded your claim on ${order.orderNumber} and will reply within ${settings.claimWindowBusinessDays} business days.`, link: `/buyer/orders/${order.orderNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "claim.opened", entityType: "Claim", entityId: claim.id, after: { orderId: order.id, reason } });
    return claim;
  });
  afterCommit(context);
  return result;
}
async function resolveClaim(context, args) {
  const action = str(args.action, 20);
  const note = str(args.note, 2e3);
  const claim = await context.prisma.claim.findUnique({ where: { id: str(args.claimId, 60) }, include: { order: { include: { invoice: { include: { payments: true } } } } } });
  if (!claim) fail("Claim not found.");
  if (action === "review") {
    if (claim.status !== "submitted") fail("This claim is already being handled.");
    return context.prisma.claim.update({ where: { id: claim.id }, data: { status: "under_review" } });
  }
  if (action === "deny") {
    if (!["submitted", "under_review"].includes(claim.status)) fail("This claim is already decided.");
    if (!note) fail("Write the reason for the denial.");
    const result = await inTransaction(context, async (tx) => {
      await lockRow(tx, "Claim", claim.id);
      const updated = await tx.claim.update({ where: { id: claim.id }, data: { status: "denied", resolution: "denied", resolutionNote: note, resolvedById: context.session.itemId, resolvedAt: /* @__PURE__ */ new Date() } });
      await notify(tx, { userIds: await companyUsers(tx, claim.companyId), type: "claim_denied", title: `Claim ${claim.claimNumber} was not approved`, body: note, link: `/buyer/orders/${claim.order.orderNumber}` });
      await audit(tx, { actorId: context.session.itemId, action: "claim.denied", entityType: "Claim", entityId: claim.id, reason: note });
      return updated;
    });
    afterCommit(context);
    return result;
  }
  if (action === "approve") {
    if (!["submitted", "under_review"].includes(claim.status)) fail("This claim is already decided.");
    const resolution = ["refund", "partial_refund", "return_and_refund"].includes(String(args.resolution)) ? String(args.resolution) : fail("Choose refund, partial refund, or return and refund.");
    const amount = Math.round(Number(args.approvedAmountMinor));
    if (!Number.isSafeInteger(amount) || amount <= 0) fail("Enter the approved amount.");
    const payments = (claim.order.invoice?.payments ?? []).filter((p) => ["captured", "confirmed", "partially_refunded"].includes(p.status));
    const payment = args.paymentId ? payments.find((p) => p.id === args.paymentId) : payments.sort((a, b) => b.amountMinor - b.refundedMinor - (a.amountMinor - a.refundedMinor))[0];
    if (!payment) fail("The order has no received payment to refund.");
    await context.prisma.claim.update({ where: { id: claim.id }, data: { status: "approved", resolution, approvedAmountMinor: amount, resolutionNote: note, resolvedById: context.session.itemId } });
    const refund = await refundPayment(context, { paymentId: payment.id, amountMinor: amount, reason: `Claim ${claim.claimNumber}: ${note || resolution}`, idempotencyKey: str(args.idempotencyKey, 200) || `claim-${claim.id}`, claimId: claim.id });
    const result = await inTransaction(context, async (tx) => {
      await lockRow(tx, "Claim", claim.id);
      if (resolution === "return_and_refund" && args.returnedAssetIds?.length) {
        const ids = args.returnedAssetIds.map((i) => str(i, 60));
        await tx.asset.updateMany({ where: { id: { in: ids }, status: { in: ["released", "sold"] } }, data: { status: "ready_for_sale", lotLineId: null } });
        for (const id of ids) await tx.custodyEvent.create({ data: { assetId: id, type: "received", actorId: context.session.itemId, occurredAt: /* @__PURE__ */ new Date(), notes: `Returned on claim ${claim.claimNumber}` } });
      }
      const updated = await tx.claim.update({ where: { id: claim.id }, data: { status: "resolved", resolvedAt: /* @__PURE__ */ new Date() } });
      await notify(tx, { userIds: await companyUsers(tx, claim.companyId), type: "claim_approved", title: `Claim ${claim.claimNumber} approved`, body: `We approved ${formatMinor(amount)} on your claim${refund?.status === "succeeded" ? " and sent the refund" : ""}.`, link: `/buyer/orders/${claim.order.orderNumber}` });
      await audit(tx, { actorId: context.session.itemId, action: "claim.approved", entityType: "Claim", entityId: claim.id, after: { resolution, amountMinor: amount, refundId: refund?.id } });
      return updated;
    });
    afterCommit(context);
    return result;
  }
  fail("Choose review, approve or deny.");
}

// features/keystone/domain/settlements.ts
async function lockSettlement(tx, id) {
  await lockRow(tx, "Settlement", id) || fail("Settlement not found.");
  return tx.settlement.findUnique({ where: { id }, include: { lines: true } });
}
async function writeTotals(tx, id) {
  const lines = await tx.settlementLine.findMany({ where: { settlementId: id } });
  const totals = settlementTotals(lines);
  return tx.settlement.update({ where: { id }, data: totals });
}
async function buildSettlement(context, args) {
  const staffId = context.session.itemId;
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "Job", args.jobId) || fail("Job not found.");
    const job = await tx.job.findUnique({ where: { id: args.jobId } });
    if (!job.pricingModel) fail("The job has no accepted quote.");
    if (!["processing", "completed", "received"].includes(job.status)) fail(`${job.jobNumber} is ${job.status.replace(/_/g, " ")}; settle a job once it is processed.`);
    let settlement = job.settlementId ? await lockSettlement(tx, job.settlementId) : null;
    if (settlement && !["draft", "in_review"].includes(settlement.status)) fail(`Settlement ${settlement.settlementNumber} is ${settlement.status}; it cannot be rebuilt.`);
    if (!settlement) {
      settlement = await tx.settlement.create({ data: { settlementNumber: await nextNumber(tx, "settlement"), organizationId: job.organizationId, status: "draft" } });
      await tx.job.update({ where: { id: job.id }, data: { settlementId: settlement.id } });
    }
    await tx.settlementLine.deleteMany({ where: { settlementId: settlement.id, kind: { not: "adjustment" } } });
    const share = job.pricingModel === "revenue_share" ? job.revenueShareBps ?? 0 : 0;
    const service = await tx.jobServiceLine.findMany({ where: { jobId: job.id } });
    const invoiced = await tx.invoice.count({ where: { jobId: job.id, kind: "service", status: { not: "void" } } });
    if (!invoiced) {
      for (const l of service) if ((l.totalMinor ?? 0) > 0) await tx.settlementLine.create({ data: { settlementId: settlement.id, kind: "service_fee", description: l.description, quantity: l.quantity, grossMinor: l.totalMinor, clientShareBps: 0, clientAmountMinor: 0 } });
    }
    if (job.pricingModel === "revenue_share") {
      const sold = await tx.asset.findMany({ where: { jobId: job.id, soldPriceMinor: { gt: 0 }, status: { in: ["sold", "released"] } }, orderBy: { assetNumber: "asc" } });
      for (const a of sold) await tx.settlementLine.create({ data: { settlementId: settlement.id, kind: "asset_value", description: `${a.assetNumber} ${[a.manufacturer, a.model].filter(Boolean).join(" ")} ${a.serialNumber ? `S/N ${a.serialNumber}` : ""}`.trim(), assetId: a.id, quantity: 1, grossMinor: a.soldPriceMinor, clientShareBps: share, clientAmountMinor: Math.round(a.soldPriceMinor * share / 1e4) } });
    }
    if (job.pricingModel === "buyout" && job.buyoutAmountMinor) {
      await tx.settlementLine.create({ data: { settlementId: settlement.id, kind: "asset_value", description: "Agreed buyout for the equipment", quantity: 1, grossMinor: job.buyoutAmountMinor, clientShareBps: 1e4, clientAmountMinor: job.buyoutAmountMinor } });
    }
    const updated = await writeTotals(tx, settlement.id);
    await audit(tx, { actorId: staffId, action: "settlement.built", entityType: "Settlement", entityId: settlement.id, after: { netMinor: updated.netMinor } });
    return updated;
  });
}
async function addSettlementLine(context, args) {
  return inTransaction(context, async (tx) => {
    const s = await lockSettlement(tx, args.settlementId);
    if (!["draft", "in_review", "disputed"].includes(s.status)) fail(`Settlement is ${s.status}.`);
    const l = args.line;
    const gross = Math.round(Number(l.grossMinor));
    if (!Number.isFinite(gross)) fail("Enter the amount.");
    const kind = ["service_fee", "asset_value", "commodity_value", "adjustment"].includes(l.kind) ? l.kind : "adjustment";
    const bps2 = kind === "service_fee" ? 0 : Math.max(0, Math.min(1e4, Math.round(l.clientShareBps ?? 1e4)));
    await tx.settlementLine.create({ data: { settlementId: s.id, kind, description: str(l.description, 300) || fail("Describe the line."), quantity: Number(l.quantity ?? 1), grossMinor: gross, clientShareBps: bps2, clientAmountMinor: kind === "service_fee" ? 0 : Math.round(gross * bps2 / 1e4), assetId: l.assetId || null } });
    await audit(tx, { actorId: context.session.itemId, action: "settlement.line_added", entityType: "Settlement", entityId: s.id, after: { kind, grossMinor: gross } });
    return writeTotals(tx, s.id);
  });
}
async function removeSettlementLine(context, args) {
  return inTransaction(context, async (tx) => {
    const line = await tx.settlementLine.findUnique({ where: { id: str(args.lineId, 60) } });
    if (!line) fail("Line not found.");
    const s = await lockSettlement(tx, line.settlementId);
    if (!["draft", "in_review", "disputed"].includes(s.status)) fail(`Settlement is ${s.status}.`);
    await tx.settlementLine.delete({ where: { id: line.id } });
    await audit(tx, { actorId: context.session.itemId, action: "settlement.line_removed", entityType: "Settlement", entityId: s.id, before: { description: line.description, grossMinor: line.grossMinor } });
    return writeTotals(tx, s.id);
  });
}
async function submitSettlementForReview(context, args) {
  return inTransaction(context, async (tx) => {
    const s = await lockSettlement(tx, args.settlementId);
    if (s.status !== "draft") fail(`Settlement is ${s.status}.`);
    if (!s.lines.length) fail("The settlement has no lines.");
    await audit(tx, { actorId: context.session.itemId, action: "settlement.in_review", entityType: "Settlement", entityId: s.id });
    return tx.settlement.update({ where: { id: s.id }, data: { status: "in_review" } });
  });
}
async function settlementPdf(tx, s) {
  const settings = await getSettings(tx);
  const job = await tx.job.findFirst({ where: { settlementId: s.id } });
  const org = await tx.clientOrganization.findUnique({ where: { id: s.organizationId } });
  const lines = await tx.settlementLine.findMany({ where: { settlementId: s.id }, orderBy: { createdAt: "asc" } });
  const cur = settings.currencyCode;
  return renderPdf({
    header: settings.businessName,
    headerRight: s.settlementNumber,
    footer: `${settings.businessName} \xB7 ${settings.supportEmail}`,
    blocks: [
      { kind: "title", text: "Settlement statement" },
      { kind: "pairs", pairs: [["Statement", s.settlementNumber], ["Client", org.legalName || org.name], ["Job", job?.jobNumber ?? ""], ["Pricing", (job?.pricingModel ?? "").replace(/_/g, " ")], ["Published", s.publishedAt ? new Date(s.publishedAt).toDateString() : "Draft"]] },
      { kind: "table", headers: ["Description", "Kind", "Gross", "Share", "To client"], widths: [4, 1.3, 1.2, 0.8, 1.2], align: ["left", "left", "right", "right", "right"], rows: lines.map((l) => [l.description, l.kind.replace(/_/g, " "), formatMinor(l.grossMinor, cur), l.kind === "service_fee" ? "" : `${(l.clientShareBps / 100).toFixed(0)}%`, l.kind === "service_fee" ? `-${formatMinor(l.grossMinor, cur)}` : formatMinor(l.clientAmountMinor, cur)]) },
      { kind: "totals", pairs: [["Service fees", `-${formatMinor(s.feesTotalMinor, cur)}`], ["Client share", formatMinor(s.clientShareTotalMinor, cur)], [s.netMinor >= 0 ? "We owe you" : "You owe us", formatMinor(Math.abs(s.netMinor), cur)]] },
      ...s.disputeNote ? [{ kind: "text", text: `Dispute recorded: ${s.disputeNote}` }] : []
    ]
  });
}
async function publishSettlement(context, args) {
  const result = await inTransaction(context, async (tx) => {
    const s = await lockSettlement(tx, args.settlementId);
    if (!["draft", "in_review", "disputed"].includes(s.status)) fail(`Settlement is ${s.status}.`);
    if (!s.lines.length) fail("The settlement has no lines.");
    const now = /* @__PURE__ */ new Date();
    let updated = await tx.settlement.update({ where: { id: s.id }, data: { status: "published", publishedAt: now } });
    const pdf = await settlementPdf(tx, updated);
    const file = await storeFile(tx, { filename: `${s.settlementNumber}.pdf`, mimeType: "application/pdf", bytes: pdf, purpose: "settlement", ownerClientOrganizationId: s.organizationId, uploadedById: context.session.itemId });
    updated = await tx.settlement.update({ where: { id: s.id }, data: { pdfId: file.id } });
    const job = await tx.job.findFirst({ where: { settlementId: s.id } });
    if (updated.netMinor < 0) {
      const existing = await tx.invoice.findFirst({ where: { settlementId: s.id, status: { not: "void" } } });
      if (existing) {
        if (existing.paidMinor > 0) fail(`Invoice ${existing.invoiceNumber} has payments; refund before republishing.`);
        await tx.invoice.update({ where: { id: existing.id }, data: { status: "void", voidReason: "Settlement republished", settlementId: null } });
      }
      const org = await tx.clientOrganization.findUnique({ where: { id: s.organizationId } });
      await createInvoice(tx, { kind: "settlement", clientOrganizationId: org.id, jobId: job?.id ?? null, settlementId: s.id, lines: [{ kind: "service", description: `Settlement ${s.settlementNumber}${job ? ` for ${job.jobNumber}` : ""}`, quantity: 1, unitPriceMinor: -updated.netMinor, totalMinor: -updated.netMinor }], billTo: { legalName: org.legalName || org.name, addressLine1: org.addressLine1, city: org.city, region: org.region, postalCode: org.postalCode, countryCode: org.countryCode, email: org.billingEmail } });
    }
    if (job && job.status === "completed") await tx.job.update({ where: { id: job.id }, data: { status: "settled" } });
    await notify(tx, { userIds: await organizationUsers(tx, s.organizationId), type: "settlement_published", title: `Settlement ${s.settlementNumber} is ready`, body: updated.netMinor >= 0 ? `We owe you ${formatMinor(updated.netMinor)}. Reply to this email if anything looks wrong.` : `The balance due is ${formatMinor(-updated.netMinor)}; an invoice is on your account.`, link: job ? `/client/jobs/${job.jobNumber}` : "/client" });
    await audit(tx, { actorId: context.session.itemId, action: "settlement.published", entityType: "Settlement", entityId: s.id, after: { netMinor: updated.netMinor } });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function recordSettlementDispute(context, args) {
  const note = str(args.note, 2e3) || fail("Write what the client disputes.");
  return inTransaction(context, async (tx) => {
    const s = await lockSettlement(tx, args.settlementId);
    if (s.status !== "published") fail("Only a published settlement can be disputed.");
    await audit(tx, { actorId: context.session.itemId, action: "settlement.disputed", entityType: "Settlement", entityId: s.id, reason: note });
    return tx.settlement.update({ where: { id: s.id }, data: { status: "disputed", disputeNote: note, disputeRecordedById: context.session.itemId } });
  });
}
async function recordSettlementPayout(context, args) {
  const method = ["cheque", "ach", "wire", "credit"].includes(args.method) ? args.method : fail("Choose cheque, ACH, wire or credit.");
  const reference = str(args.reference, 120) || fail("Enter the payout reference.");
  const result = await inTransaction(context, async (tx) => {
    const s = await lockSettlement(tx, args.settlementId);
    if (s.status !== "published") fail(s.status === "disputed" ? "Resolve the dispute and republish first." : `Settlement is ${s.status}.`);
    if (s.netMinor < 0) fail("The client owes this balance; it closes when their invoice is paid.");
    const updated = await tx.settlement.update({ where: { id: s.id }, data: { status: "paid", payoutMethod: method, payoutReference: reference, paidAt: /* @__PURE__ */ new Date() } });
    await notify(tx, { userIds: await organizationUsers(tx, s.organizationId), type: "settlement_paid", title: `Settlement ${s.settlementNumber} paid`, body: `${formatMinor(s.netMinor)} sent by ${method} (${reference}).`, link: "/client" });
    await audit(tx, { actorId: context.session.itemId, action: "settlement.paid", entityType: "Settlement", entityId: s.id, after: { method, reference, netMinor: s.netMinor } });
    return updated;
  });
  afterCommit(context);
  return result;
}

// features/keystone/domain/documents.ts
async function invoicePdf(db, invoiceId) {
  const settings = await getSettings(db);
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { lines: { orderBy: { createdAt: "asc" } }, order: { select: { orderNumber: true } }, job: { select: { jobNumber: true } } } });
  if (!inv) fail("Invoice not found.");
  const cur = inv.currencyCode || settings.currencyCode;
  const b = inv.billTo ?? {};
  const balance = Math.max(0, inv.totalMinor - inv.paidMinor);
  const blocks = [
    { kind: "title", text: inv.status === "void" ? "Invoice (void)" : "Invoice" },
    { kind: "pairs", pairs: [["Invoice", inv.invoiceNumber], ["Issued", inv.issuedAt ? new Date(inv.issuedAt).toDateString() : ""], ["Due", inv.dueAt ? new Date(inv.dueAt).toDateString() : "On receipt"], ...inv.order ? [["Order", inv.order.orderNumber]] : [], ...inv.job ? [["Job", inv.job.jobNumber]] : [], ["Status", inv.status.replace(/_/g, " ")]] },
    { kind: "subtitle", text: "Bill to" },
    { kind: "text", text: [b.legalName, b.addressLine1, b.addressLine2, [b.city, b.region, b.postalCode].filter(Boolean).join(" "), b.countryCode, b.taxId ? `Tax ID ${b.taxId}` : ""].filter(Boolean).join("\n") },
    { kind: "table", headers: ["Description", "Qty", "Unit", "Amount"], widths: [5, 0.8, 1.3, 1.3], align: ["left", "right", "right", "right"], rows: inv.lines.map((l) => [l.description, String(Number(l.quantity)), formatMinor(l.unitPriceMinor, cur), formatMinor(l.totalMinor, cur)]) },
    { kind: "totals", pairs: [["Subtotal", formatMinor(inv.subtotalMinor, cur)], ...inv.premiumMinor ? [["Buyer premium", formatMinor(inv.premiumMinor, cur)]] : [], ...inv.freightMinor ? [["Freight", formatMinor(inv.freightMinor, cur)]] : [], ...inv.feeMinor ? [["Fees", formatMinor(inv.feeMinor, cur)]] : [], ...inv.otherMinor ? [["Other", formatMinor(inv.otherMinor, cur)]] : [], ["Tax", formatMinor(inv.taxMinor, cur)], ["Total", formatMinor(inv.totalMinor, cur)], ["Paid", formatMinor(inv.paidMinor, cur)], ["Balance due", formatMinor(balance, cur)]] }
  ];
  if (inv.taxExemptReason) blocks.push({ kind: "text", text: `Tax exempt: ${inv.taxExemptReason}` });
  if (balance > 0 && settings.wireInstructions && inv.status !== "void") blocks.push({ kind: "subtitle", text: "Pay by bank transfer" }, { kind: "text", text: `${settings.wireInstructions}
Reference: ${inv.invoiceNumber}` });
  return renderPdf({ header: settings.legalName || settings.businessName, headerRight: inv.invoiceNumber, footer: [settings.businessName, settings.supportEmail, settings.supportPhone].filter(Boolean).join(" \xB7 "), blocks });
}
async function downloadInvoice(context, args) {
  const { invoice } = await invoiceForCaller(context, args.invoiceNumber);
  return asDownload(`${invoice.invoiceNumber}.pdf`, "application/pdf", await invoicePdf(context.prisma, invoice.id));
}
async function staffInvoicePdf(context, args) {
  const inv = await context.prisma.invoice.findUnique({ where: { id: str(args.invoiceId, 60) }, select: { id: true, invoiceNumber: true } });
  if (!inv) fail("Invoice not found.");
  return asDownload(`${inv.invoiceNumber}.pdf`, "application/pdf", await invoicePdf(context.prisma, inv.id));
}
async function orderDocumentPdf(db, orderId, kind) {
  const settings = await getSettings(db);
  const order = await db.order.findUnique({ where: { id: orderId }, include: { lines: { orderBy: { lineNumber: "asc" } }, company: true, lot: { include: { facility: true } } } });
  const f = order.lot?.facility;
  const from = f ? [f.name, f.addressLine1, [f.city, f.region, f.postalCode].filter(Boolean).join(" "), f.countryCode].filter(Boolean).join("\n") : settings.businessName;
  const to = [order.company.legalName, order.company.addressLine1, [order.company.city, order.company.region, order.company.postalCode].filter(Boolean).join(" "), order.company.countryCode].filter(Boolean).join("\n");
  const units = order.lines.reduce((s, l) => s + (l.quantity ?? 0), 0);
  const head = [
    { kind: "title", text: kind === "packing_list" ? "Packing list" : "Bill of lading" },
    { kind: "pairs", pairs: [["Order", order.orderNumber], ["Lot", order.lot?.lotNumber ?? ""], ["Pallets", String(order.palletCount ?? "")], ["Weight", order.weight != null ? `${Number(order.weight)} ${settings.weightUnit}` : ""], ["Units", String(units)], ...order.billOfLading ? [["B/L number", order.billOfLading]] : [], ...order.carrierName ? [["Carrier", `${order.carrierName} ${order.carrierReference}`.trim()]] : [], ...order.destinationCountry ? [["Destination country", order.destinationCountry]] : []] },
    { kind: "subtitle", text: "Ship from" },
    { kind: "text", text: from },
    { kind: "subtitle", text: "Ship to / buyer" },
    { kind: "text", text: to }
  ];
  if (kind === "packing_list") {
    head.push({ kind: "table", headers: ["Line", "Description", "Grade", "Qty", "Serials"], widths: [0.5, 3, 1, 0.6, 3.5], align: ["left", "left", "left", "right", "left"], rows: order.lines.map((l) => [String(l.lineNumber ?? ""), l.description, l.grade, String(l.quantity ?? ""), (Array.isArray(l.serials) ? l.serials : []).join(", ")]) });
  } else {
    head.push({ kind: "table", headers: ["Handling units", "Description of goods", "Weight"], widths: [1.2, 4, 1.2], align: ["left", "left", "right"], rows: [[`${order.palletCount ?? ""} pallet(s)`, `Used electronic equipment (${units} units), ${order.lot?.title ?? ""}`, order.weight != null ? `${Number(order.weight)} ${settings.weightUnit}` : ""]] });
    if (settings.exportClause && order.destinationCountry && order.destinationCountry !== "US") head.push({ kind: "text", text: settings.exportClause });
    head.push({ kind: "signature", label: "Shipper" }, { kind: "signature", label: `Carrier / driver${order.driverName ? `: ${order.driverName}` : ""}` });
  }
  return { pdf: await renderPdf({ header: settings.businessName, headerRight: order.orderNumber, footer: settings.businessName, blocks: head }), order };
}
async function downloadOrderDocument(context, args) {
  const { order } = await orderForBuyer(context, args.orderNumber);
  if (!["paid", "ready_for_release", "released", "completed"].includes(order.status)) fail("Documents are available once the order is paid.");
  const kind = args.kind === "bill_of_lading" ? "bill_of_lading" : "packing_list";
  const { pdf } = await orderDocumentPdf(context.prisma, order.id, kind);
  return asDownload(`${order.orderNumber}-${kind.replace(/_/g, "-")}.pdf`, "application/pdf", pdf);
}
async function staffOrderDocument(context, args) {
  const kind = args.kind === "bill_of_lading" ? "bill_of_lading" : "packing_list";
  const { pdf, order } = await orderDocumentPdf(context.prisma, str(args.orderId, 60), kind);
  return asDownload(`${order.orderNumber}-${kind.replace(/_/g, "-")}.pdf`, "application/pdf", pdf);
}
async function storedPdf(db, fileId, name) {
  if (!fileId) fail("The document is not ready.");
  const file = await readFileBytes(db, fileId);
  if (!file) fail("The document is missing.");
  return asDownload(name, file.mimeType, file.bytes);
}
async function downloadCertificate(context, args) {
  const { organizationId } = await requireClient(context);
  const cert = await context.prisma.certificate.findUnique({ where: { certificateNumber: str(args.certificateNumber, 40) } });
  if (!cert || cert.organizationId !== organizationId) fail("Certificate not found.");
  return storedPdf(context.prisma, cert.pdfId, `${cert.certificateNumber}${cert.status === "revoked" ? "-REVOKED" : ""}.pdf`);
}
async function downloadSettlement(context, args) {
  const { organizationId } = await requireClient(context);
  const s = await context.prisma.settlement.findUnique({ where: { settlementNumber: str(args.settlementNumber, 40) } });
  if (!s || s.organizationId !== organizationId || !["published", "disputed", "paid", "closed"].includes(s.status)) fail("Settlement not found.");
  return storedPdf(context.prisma, s.pdfId, `${s.settlementNumber}.pdf`);
}
async function staffDownloadFile(context, args) {
  if (args.kind === "certificate") {
    const c = await context.prisma.certificate.findUnique({ where: { id: str(args.id, 60) } });
    if (!c) fail("Certificate not found.");
    return storedPdf(context.prisma, c.pdfId, `${c.certificateNumber}.pdf`);
  }
  if (args.kind === "settlement") {
    const s = await context.prisma.settlement.findUnique({ where: { id: str(args.id, 60) } });
    if (!s) fail("Settlement not found.");
    if (!s.pdfId) {
      return asDownload(`${s.settlementNumber}-draft.pdf`, "application/pdf", await settlementPdf(context.prisma, s));
    }
    return storedPdf(context.prisma, s.pdfId, `${s.settlementNumber}.pdf`);
  }
  fail("Unknown document.");
}

// features/keystone/domain/files.ts
var TARGETS = {
  lot_image: { perm: ["canManageLots"], visibility: "private", purpose: "lot_image" },
  logo: { perm: ["canManageSettings"], visibility: "public", purpose: "logo" },
  certification_document: { perm: ["canManageSettings", "canIssueCertificates"], visibility: "private", purpose: "certification" },
  vendor_due_diligence: { perm: ["canManageDownstream"], visibility: "private", purpose: "vendor_due_diligence" }
};
async function attachFile(context, args) {
  const target = TARGETS[str(args.target, 40)] ?? fail("Unknown upload target.");
  const session = requireStaff(context, ...target.perm);
  const id = str(args.id, 60);
  return inTransaction(context, async (tx) => {
    const stored = await storeUpload(tx, args.file, { purpose: target.purpose, visibility: target.visibility, uploadedById: session.itemId });
    if (!stored) fail("Choose a file.");
    if (args.target !== "logo" && !id) fail("Choose the record.");
    let entityType = "";
    if (args.target === "lot_image") {
      if (!/^image\//.test((await tx.storedFile.findUnique({ where: { id: stored.id }, select: { mimeType: true } })).mimeType)) fail("Lot photos must be images.");
      const lot = await tx.lot.findUnique({ where: { id }, select: { id: true, _count: { select: { images: true } } } }) ?? fail("Lot not found.");
      await tx.lotImage.create({ data: { lotId: lot.id, imageId: stored.id, caption: str(args.caption, 200), sortOrder: lot._count.images } });
      entityType = "Lot";
    } else if (args.target === "logo") {
      await tx.storeSettings.update({ where: { id: 1 }, data: { logoId: stored.id } });
      entityType = "StoreSettings";
    } else if (args.target === "certification_document") {
      ;
      await tx.certification.findUnique({ where: { id } }) ?? fail("Certification not found.");
      await tx.certification.update({ where: { id }, data: { documentId: stored.id } });
      entityType = "Certification";
    } else {
      ;
      await tx.downstreamVendor.findUnique({ where: { id } }) ?? fail("Vendor not found.");
      await tx.downstreamVendor.update({ where: { id }, data: { dueDiligenceFileId: stored.id } });
      entityType = "DownstreamVendor";
    }
    await audit(tx, { actorId: session.itemId, action: `file.attach.${args.target}`, entityType, entityId: id || "1", after: { fileId: stored.id, filename: stored.filename } });
    return { fileId: stored.id };
  });
}

// features/keystone/domain/jobs.ts
var EMAIL2 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var SERVICES = ["pickup", "drop_off", "data_destruction", "onsite_shred", "itad", "recycling", "witness_destruction"];
function cleanSite(site, required) {
  if (!site) {
    if (required) fail("Enter the pickup address.");
    return null;
  }
  const s = { addressLine1: str(site.addressLine1, 200), addressLine2: str(site.addressLine2, 200), city: str(site.city, 120), region: str(site.region, 120), postalCode: str(site.postalCode, 20), countryCode: str(site.countryCode, 2).toUpperCase() || "US", hasDock: Boolean(site.hasDock), needsLiftgate: Boolean(site.needsLiftgate), accessNotes: str(site.accessNotes, 1e3), hours: str(site.hours, 200) };
  if (required && (!s.addressLine1 || !s.city || !s.postalCode)) fail("Enter the street, city and postal code.");
  return s;
}
async function createJobRecord(tx, input) {
  const type = input.type === "drop_off" ? "drop_off" : "pickup";
  const site = cleanSite(input.site, type === "pickup" && !input.siteId);
  const job = await tx.job.create({
    data: {
      jobNumber: await nextNumber(tx, "job"),
      type,
      status: "requested",
      organizationId: input.organizationId,
      siteId: input.siteId ?? null,
      facilityId: input.facilityId || (await tx.facility.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id || null,
      requestedById: input.requestedById ?? null,
      contactName: str(input.contactName, 120),
      contactEmail: str(input.contactEmail, 200).toLowerCase(),
      contactPhone: str(input.contactPhone, 40),
      siteAddress: site ?? void 0,
      accessDetails: site ? { hasDock: site.hasDock, needsLiftgate: site.needsLiftgate, accessNotes: site.accessNotes, hours: site.hours } : {},
      requestedDates: (input.requestedDates ?? []).map((d) => str(d, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 5),
      hasDataBearing: Boolean(input.hasDataBearing),
      servicesRequested: (input.services ?? []).filter((s) => SERVICES.includes(s)),
      internalNotes: str(input.notes, 4e3),
      estimateLines: { create: (input.estimate ?? []).slice(0, 50).filter((l) => Number(l.quantity) > 0).map((l) => ({ categoryId: l.categoryId || null, quantity: Math.round(Number(l.quantity)), unit: ["units", "pallets", "lb", "kg"].includes(String(l.unit)) ? l.unit : "units", notes: str(l.notes, 300) })) }
    }
  });
  for (const photo of (input.photos ?? []).slice(0, 8)) {
    const stored = await storeUpload(tx, photo, { purpose: "job_photo", ownerClientOrganizationId: input.organizationId, uploadedById: input.uploadedById ?? null });
    if (stored) await tx.jobPhoto.create({ data: { jobId: job.id, imageId: stored.id, stage: "request", caption: "" } });
  }
  await notify(tx, { userIds: await staffWith(tx, "canManageJobs"), type: "job_requested", title: `New ${type === "pickup" ? "pickup" : "drop-off"} request ${job.jobNumber}`, body: `${str(input.organizationName, 200) || "A client"} asked for a ${type.replace("_", "-")}. Build and send the quote.`, link: `/dashboard/platform/jobs/${job.id}` });
  await audit(tx, { actorId: input.requestedById ?? null, action: "job.requested", entityType: "Job", entityId: job.id, after: { type } });
  return job;
}
async function submitPickupRequest(context, args) {
  const email = str(args.contactEmail, 200).toLowerCase();
  if (!str(args.contactName, 120)) fail("Enter your name.");
  if (!EMAIL2.test(email)) fail("Enter a valid email address.");
  if (!str(args.organizationName, 200)) fail("Enter your organisation name.");
  if (String(args.password || "").length < 10) fail("Use a password of at least 10 characters.");
  const exists = await context.prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) fail("An account with this email already exists. Sign in and request the pickup from your account.");
  const org = await context.prisma.clientOrganization.create({ data: { name: str(args.organizationName, 200), billingEmail: email, status: "prospect", addressLine1: str(args.site?.addressLine1, 200), city: str(args.site?.city, 120), region: str(args.site?.region, 120), postalCode: str(args.site?.postalCode, 20), countryCode: str(args.site?.countryCode, 2).toUpperCase() || "US" } });
  const user = await context.sudo().db.User.createOne({ data: { name: str(args.contactName, 120), email, password: String(args.password), phone: str(args.contactPhone, 40), kind: "client", clientRole: "admin", clientOrganization: { connect: { id: org.id } } } });
  const job = await inTransaction(context, (tx) => createJobRecord(tx, { ...args, organizationId: org.id, requestedById: user.id, uploadedById: user.id }));
  afterCommit(context);
  return { jobNumber: job.jobNumber, userId: user.id };
}
async function requestJob(context, args) {
  const session = context.session;
  const staff = session?.data?.role?.canManageJobs || session?.data?.role?.canManageClients;
  if (staff) {
    const org2 = await context.prisma.clientOrganization.findUnique({ where: { id: str(args.organizationId, 60) } });
    if (!org2) fail("Choose the client organisation.");
    const job2 = await inTransaction(context, (tx) => createJobRecord(tx, { ...args, organizationId: org2.id, siteId: args.siteId || null, requestedById: session.itemId, uploadedById: session.itemId, contactName: str(args.contactName, 120) || org2.name, contactEmail: str(args.contactEmail, 200) || org2.billingEmail, organizationName: org2.name }));
    afterCommit(context);
    return { jobNumber: job2.jobNumber, jobId: job2.id };
  }
  const { organizationId, user } = await requireClient(context);
  const org = await context.prisma.clientOrganization.findUnique({ where: { id: organizationId } });
  let siteId = null;
  if (args.siteId) {
    const site = await context.prisma.clientSite.findUnique({ where: { id: str(args.siteId, 60) } });
    if (!site || site.organizationId !== organizationId) fail("Site not found.");
    siteId = site.id;
  }
  const job = await inTransaction(context, (tx) => createJobRecord(tx, { ...args, contactName: str(args.contactName, 120) || user.name, contactEmail: str(args.contactEmail, 200) || user.email, organizationId, siteId, requestedById: user.id, uploadedById: user.id, organizationName: org.name }));
  afterCommit(context);
  return { jobNumber: job.jobNumber, jobId: job.id };
}
async function lockJob(tx, id) {
  await lockRow(tx, "Job", id) || fail("Job not found.");
  return tx.job.findUnique({ where: { id } });
}
async function quoteJob(context, args) {
  const model = ["fee_for_service", "revenue_share", "buyout"].includes(args.pricingModel) ? args.pricingModel : fail("Choose a pricing model.");
  const settings = await getSettings(context.prisma);
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    const next = jobTransition("quote", job.status);
    await tx.jobServiceLine.deleteMany({ where: { jobId: job.id } });
    for (const l of (args.lines ?? []).slice(0, 50)) {
      const quantity = Math.max(0, Number(l.quantity) || 0);
      const unit = Math.round(Number(l.unitPriceMinor) || 0);
      if (!str(l.description, 200)) fail("Every quote line needs a description.");
      await tx.jobServiceLine.create({ data: { jobId: job.id, description: str(l.description, 200), quantity, unitPriceMinor: unit, totalMinor: Math.round(quantity * unit), kind: ["pickup", "audit", "wipe", "shred", "recycling_fee", "other"].includes(String(l.kind)) ? l.kind : "other" } });
    }
    const share = model === "revenue_share" ? Math.max(0, Math.min(1e4, Math.round(args.revenueShareBps ?? settings.defaultClientRevenueShareBps))) : null;
    const buyout = model === "buyout" ? Math.max(0, Math.round(args.buyoutAmountMinor ?? 0)) : null;
    const send = args.send ?? true;
    const updated = await tx.job.update({ where: { id: job.id }, data: { pricingModel: model, revenueShareBps: share, buyoutAmountMinor: buyout, ...send ? { status: next, quoteSentAt: /* @__PURE__ */ new Date() } : {} } });
    if (send) {
      await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: "job_quoted", title: `Your quote for ${job.jobNumber}`, body: "Your quote is ready. Read it and accept it on your job page to book the collection.", link: `/client/jobs/${job.jobNumber}` });
      await audit(tx, { actorId: context.session.itemId, action: "job.quoted", entityType: "Job", entityId: job.id, before: { status: job.status }, after: { status: next, pricingModel: model } });
    }
    return updated;
  });
  afterCommit(context);
  return result;
}
async function clientJob(context, jobNumber, admin = false) {
  const { organizationId, user } = await requireClient(context, { admin });
  const job = await context.prisma.job.findUnique({ where: { jobNumber: str(jobNumber, 40) } });
  if (!job || job.organizationId !== organizationId) fail("Job not found.");
  return { job, user };
}
async function acceptJobQuote(context, args) {
  const { job, user } = await clientJob(context, args.jobNumber, true);
  const name = str(args.signatureName, 120);
  if (name.length < 2) fail("Type your full name to sign.");
  const settings = await getSettings(context.prisma);
  if (str(args.termsVersion, 40) !== settings.serviceTermsVersion) fail("The service terms changed. Reload and read the current version.");
  const result = await inTransaction(context, async (tx) => {
    const current = await lockJob(tx, job.id);
    const next = jobTransition("accept", current.status);
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, quoteAcceptedAt: /* @__PURE__ */ new Date(), quoteAcceptedById: user.id, quoteSignatureName: name, quoteTermsVersion: settings.serviceTermsVersion } });
    await tx.clientOrganization.updateMany({ where: { id: job.organizationId, status: "prospect" }, data: { status: "active" } });
    await notify(tx, { userIds: await staffWith(tx, "canDispatch"), type: "job_accepted", title: `${job.jobNumber} accepted`, body: `${name} accepted the quote. Schedule the collection.`, link: "/dashboard/platform/dispatch" });
    await audit(tx, { actorId: user.id, action: "job.accepted", entityType: "Job", entityId: job.id, before: { status: current.status }, after: { status: next, signatureName: name, termsVersion: settings.serviceTermsVersion } });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function declineJobQuote(context, args) {
  const { job, user } = await clientJob(context, args.jobNumber, true);
  const result = await inTransaction(context, async (tx) => {
    const current = await lockJob(tx, job.id);
    const next = jobTransition("decline", current.status);
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, declineReason: str(args.reason, 1e3) } });
    await notify(tx, { userIds: await staffWith(tx, "canManageJobs"), type: "job_declined", title: `${job.jobNumber} quote declined`, body: str(args.reason, 1e3) || "No reason given.", link: `/dashboard/platform/jobs/${job.id}` });
    await audit(tx, { actorId: user.id, action: "job.declined", entityType: "Job", entityId: job.id, reason: str(args.reason, 1e3) });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function recordJobAcceptance(context, args) {
  const name = str(args.signatureName, 120) || fail("Enter who accepted.");
  const note = str(args.note, 500) || fail("Write how the acceptance reached you.");
  const settings = await getSettings(context.prisma);
  return inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    const next = jobTransition("accept", job.status);
    await audit(tx, { actorId: context.session.itemId, action: "job.accepted_by_staff", entityType: "Job", entityId: job.id, after: { signatureName: name }, reason: note });
    return tx.job.update({ where: { id: job.id }, data: { status: next, quoteAcceptedAt: /* @__PURE__ */ new Date(), quoteSignatureName: `${name} (recorded by staff)`, quoteTermsVersion: settings.serviceTermsVersion } });
  });
}
async function scheduleJob(context, args) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(args.date, 10))) fail("Choose the date.");
  if (!/^\d{2}:\d{2}$/.test(str(args.windowStart, 5)) || !/^\d{2}:\d{2}$/.test(str(args.windowEnd, 5)) || args.windowEnd <= args.windowStart) fail("Choose a time window.");
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    const next = jobTransition("schedule", job.status);
    if (job.type === "pickup") {
      if (!args.driverId) fail("Choose the driver.");
      const driver = await tx.user.findUnique({ where: { id: args.driverId }, include: { role: true } });
      if (!driver?.isActive || !driver.role?.canCollect) fail("That person cannot drive collections.");
    }
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, scheduledDate: /* @__PURE__ */ new Date(`${args.date}T12:00:00Z`), windowStart: args.windowStart, windowEnd: args.windowEnd, driverId: args.driverId || null, vehicle: str(args.vehicle, 120) } });
    await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: "job_scheduled", title: `${job.jobNumber} is booked for ${args.date}`, body: `We will ${job.type === "pickup" ? "arrive" : "expect you"} between ${args.windowStart} and ${args.windowEnd} on ${args.date}.`, link: `/client/jobs/${job.jobNumber}` });
    if (args.driverId) await notify(tx, { userIds: [args.driverId], type: "stop_assigned", title: `New stop: ${job.jobNumber} on ${args.date}`, body: `${args.windowStart}-${args.windowEnd}`, link: "/dashboard/platform/driver" });
    await audit(tx, { actorId: context.session.itemId, action: "job.scheduled", entityType: "Job", entityId: job.id, before: { status: job.status }, after: { status: next, date: args.date, driverId: args.driverId } });
    return updated;
  });
  afterCommit(context);
  return result;
}
function assertDriver(context, job) {
  const role = context.session?.data?.role;
  if (!role?.canCollect && !role?.canDispatch && !(role?.canReceive && job.type === "drop_off")) fail("Only the driver or dispatch can record a collection.");
  if (job.driverId && job.driverId !== context.session.itemId && !role?.canDispatch) fail("This stop is assigned to another driver.");
}
async function startJobRoute(context, args) {
  return inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    assertDriver(context, job);
    const next = jobTransition("depart", job.status);
    await audit(tx, { actorId: context.session.itemId, action: "job.en_route", entityType: "Job", entityId: job.id });
    return tx.job.update({ where: { id: job.id }, data: { status: next } });
  });
}
async function collectJob(context, args) {
  const signer = str(args.signerName, 120) || fail("Enter the client signer's name.");
  if (!args.containers?.length) fail("Add at least one container.");
  if (!args.signature?.base64) fail("Ask the client to sign.");
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    assertDriver(context, job);
    const next = jobTransition("collect", job.status);
    const now = await dbNow(tx);
    const sig = await storeUpload(tx, args.signature, { purpose: "client_signature", ownerClientOrganizationId: job.organizationId, uploadedById: context.session.itemId });
    const labels = /* @__PURE__ */ new Set();
    for (const c of args.containers.slice(0, 200)) {
      const label = str(c.label, 60) || fail("Every container needs a label.");
      if (labels.has(label)) fail(`Container ${label} appears twice.`);
      labels.add(label);
      const container = await tx.container.create({ data: { jobId: job.id, label, type: ["pallet", "gaylord", "box", "cage", "tote"].includes(String(c.type)) ? c.type : "pallet", sealNumber: str(c.sealNumber, 60), itemCountDeclared: c.itemCountDeclared != null ? Math.max(0, Math.round(c.itemCountDeclared)) : null, grossWeight: c.grossWeight != null ? Math.max(0, Number(c.grossWeight)) : null, status: "collected" } });
      await tx.custodyEvent.create({ data: { jobId: job.id, containerId: container.id, type: "collected", actorId: context.session.itemId, occurredAt: now, signerName: signer, signatureId: sig?.id ?? null, locationText: job.siteAddress ? [job.siteAddress.addressLine1, job.siteAddress.city].filter(Boolean).join(", ") : "", notes: c.sealNumber ? `Seal ${c.sealNumber}` : "" } });
    }
    for (const photo of (args.photos ?? []).slice(0, 12)) {
      const stored = await storeUpload(tx, photo, { purpose: "job_photo", ownerClientOrganizationId: job.organizationId, uploadedById: context.session.itemId });
      if (stored) await tx.jobPhoto.create({ data: { jobId: job.id, imageId: stored.id, stage: "collection", caption: "" } });
    }
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, collectedAt: now, clientSignerName: signer, clientSignatureId: sig?.id ?? null } });
    await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: "job_collected", title: `${job.jobNumber} collected`, body: `${labels.size} container${labels.size === 1 ? "" : "s"} collected and signed for by ${signer}. Follow the chain of custody on your job page.`, link: `/client/jobs/${job.jobNumber}` });
    await notify(tx, { userIds: await staffWith(tx, "canReceive"), type: "containers_inbound", title: `${labels.size} container${labels.size === 1 ? "" : "s"} inbound on ${job.jobNumber}`, body: "Scan, check seals and weigh on arrival.", link: "/dashboard/platform/receiving" });
    await audit(tx, { actorId: context.session.itemId, action: "job.collected", entityType: "Job", entityId: job.id, after: { containers: labels.size, signer } });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function receiveContainer(context, args) {
  const gross = Number(args.grossWeight);
  if (!Number.isFinite(gross) || gross <= 0) fail("Enter the gross weight.");
  const result = await inTransaction(context, async (tx) => {
    let container = args.containerId ? await tx.container.findUnique({ where: { id: args.containerId } }) : null;
    if (!container && args.jobId && args.label) container = await tx.container.findFirst({ where: { jobId: args.jobId, label: str(args.label, 60) } });
    let job;
    if (!container) {
      if (!args.unexpected || !args.jobId) fail("Container not found. Record it as unexpected on its job.");
      job = await lockJob(tx, args.jobId);
      container = await tx.container.create({ data: { jobId: job.id, label: str(args.label, 60) || "Unlabelled", status: "unexpected", sealException: "Container arrived that was not on the collection record." } });
    } else {
      job = await lockJob(tx, container.jobId);
    }
    await lockRow(tx, "Container", container.id);
    if (container.status === "received" || container.status === "processed") fail(`${container.label} was already received.`);
    if (!["collected", "received"].includes(job.status)) fail(`${job.jobNumber} is ${job.status.replace(/_/g, " ")}; it cannot receive containers.`);
    const seal = str(args.receivedSealNumber, 60);
    const sealOk = !container.sealNumber || seal === container.sealNumber;
    const exception = !sealOk ? `Seal ${seal || "(none)"} does not match ${container.sealNumber}.` : container.sealException;
    const now = await dbNow(tx);
    const facility = job.facilityId;
    const tare = args.tareWeight != null ? Math.max(0, Number(args.tareWeight)) : null;
    const updated = await tx.container.update({ where: { id: container.id }, data: { status: exception ? container.status === "unexpected" ? "unexpected" : "collected" : "received", receivedSealNumber: seal, sealVerified: sealOk && Boolean(container.sealNumber), sealException: exception || "", grossWeight: gross, tareWeight: tare, locationCode: str(args.locationCode, 40) } });
    await tx.custodyEvent.create({ data: { jobId: job.id, containerId: container.id, type: exception ? "seal_exception" : container.sealNumber ? "seal_verified" : "received", actorId: context.session.itemId, occurredAt: now, facilityId: facility, notes: [exception, `Gross ${gross}${tare != null ? `, tare ${tare}` : ""}`, str(args.notes, 300)].filter(Boolean).join(". ") } });
    if (exception) await notify(tx, { userIds: await staffWith(tx, "canIssueCertificates"), type: "seal_exception", title: `Seal exception on ${job.jobNumber}`, body: `${container.label}: ${exception}`, link: "/dashboard/platform/receiving" });
    await advanceJobReceipt(tx, job.id, context.session.itemId);
    await audit(tx, { actorId: context.session.itemId, action: exception ? "container.exception" : "container.received", entityType: "Container", entityId: container.id, after: { grossWeight: gross, seal, exception } });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function advanceJobReceipt(tx, jobId, actorId) {
  const job = await tx.job.findUnique({ where: { id: jobId }, include: { containers: true } });
  if (job.status !== "collected") return;
  const open = job.containers.filter((c) => !(c.status === "received" || c.status === "processed" || c.sealException && c.sealExceptionResolution || c.status === "missing"));
  if (open.length) return;
  await tx.job.update({ where: { id: jobId }, data: { status: "received", receivedAt: /* @__PURE__ */ new Date() } });
  await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: "job_received", title: `${job.jobNumber} arrived at our facility`, body: "Every container is checked in. Processing starts next.", link: `/client/jobs/${job.jobNumber}` });
  await audit(tx, { actorId, action: "job.received", entityType: "Job", entityId: jobId });
}
async function resolveSealException(context, args) {
  const resolution = str(args.resolution, 1e3) || fail("Write how the exception was resolved.");
  const result = await inTransaction(context, async (tx) => {
    const container = await tx.container.findUnique({ where: { id: args.containerId } });
    if (!container) fail("Container not found.");
    await lockJob(tx, container.jobId);
    await lockRow(tx, "Container", container.id);
    if (!container.sealException && !args.markMissing) fail("This container has no open exception.");
    const status2 = args.markMissing ? "missing" : container.grossWeight ? "received" : container.status;
    const updated = await tx.container.update({ where: { id: container.id }, data: { sealExceptionResolution: resolution, status: status2, sealException: container.sealException || (args.markMissing ? "Container did not arrive." : "") } });
    await tx.custodyEvent.create({ data: { jobId: container.jobId, containerId: container.id, type: args.markMissing ? "seal_exception" : "received", actorId: context.session.itemId, occurredAt: /* @__PURE__ */ new Date(), notes: `Exception resolved: ${resolution}` } });
    await advanceJobReceipt(tx, container.jobId, context.session.itemId);
    await audit(tx, { actorId: context.session.itemId, action: "container.exception_resolved", entityType: "Container", entityId: container.id, reason: resolution });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function cancelJob(context, args) {
  const reason = str(args.reason, 1e3) || fail("Write why the job is cancelled.");
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    const next = jobTransition("cancel", job.status);
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, cancelReason: reason } });
    await tx.dockAppointment.updateMany({ where: { jobId: job.id, status: "booked" }, data: { status: "cancelled" } });
    await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: "job_cancelled", title: `${job.jobNumber} was cancelled`, body: reason, link: `/client/jobs/${job.jobNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "job.cancelled", entityType: "Job", entityId: job.id, before: { status: job.status }, reason });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function setJobHold(context, args) {
  return inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    if (args.hold) {
      if (!AFTER_COLLECTION.includes(job.status)) fail("Only a job that has been collected can be put on hold; cancel it instead.");
      const reason = str(args.reason, 500) || fail("Write the reason for the hold.");
      await audit(tx, { actorId: context.session.itemId, action: "job.hold", entityType: "Job", entityId: job.id, reason });
      return tx.job.update({ where: { id: job.id }, data: { status: "on_hold", holdFromStatus: job.status } });
    }
    if (job.status !== "on_hold") fail("This job is not on hold.");
    await audit(tx, { actorId: context.session.itemId, action: "job.hold_released", entityType: "Job", entityId: job.id });
    return tx.job.update({ where: { id: job.id }, data: { status: job.holdFromStatus || "received", holdFromStatus: "" } });
  });
}
async function startProcessing(context, args) {
  return inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    const next = jobTransition("start", job.status);
    await audit(tx, { actorId: context.session.itemId, action: "job.processing", entityType: "Job", entityId: job.id });
    return tx.job.update({ where: { id: job.id }, data: { status: next } });
  });
}
async function completeJob(context, args) {
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    const assets = await tx.asset.findMany({ where: { jobId: job.id }, select: { assetNumber: true, isDataBearing: true, sanitizationStatus: true, status: true } });
    const problem = jobCompletionProblem(assets);
    if (problem) fail(problem);
    const certs = await tx.certificate.findMany({ where: { jobId: job.id, status: "issued" }, select: { type: true } });
    if (assets.some((a) => a.isDataBearing) && !certs.some((c) => c.type === "data_destruction")) fail("Issue the data destruction certificate first.");
    if (!certs.some((c) => c.type === "recycling")) fail("Issue the recycling certificate first.");
    const next = jobTransition("complete", job.status);
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, completedAt: /* @__PURE__ */ new Date() } });
    await tx.container.updateMany({ where: { jobId: job.id, status: "received" }, data: { status: "processed" } });
    await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: "job_completed", title: `${job.jobNumber} is complete`, body: "Processing is finished. Your certificates are ready to download.", link: `/client/jobs/${job.jobNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "job.completed", entityType: "Job", entityId: job.id, before: { status: job.status }, after: { status: next } });
    return updated;
  });
  afterCommit(context);
  return result;
}
async function closeJob(context, args) {
  return inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    const next = jobTransition("close", job.status);
    const unpaid = await tx.invoice.count({ where: { jobId: job.id, status: { in: ["open", "partially_paid"] } } });
    if (unpaid) fail("This job has an unpaid invoice.");
    if (job.settlementId) {
      const s = await tx.settlement.findUnique({ where: { id: job.settlementId } });
      if (!["paid", "closed"].includes(s.status)) fail("Record the settlement payout first.");
      await tx.settlement.update({ where: { id: s.id }, data: { status: "closed" } });
    }
    await audit(tx, { actorId: context.session.itemId, action: "job.closed", entityType: "Job", entityId: job.id });
    return tx.job.update({ where: { id: job.id }, data: { status: next } });
  });
}
async function invoiceJob(context, args) {
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId);
    if (!["accepted", "scheduled", "en_route", "collected", "received", "processing", "completed", "settled"].includes(job.status)) fail("Invoice a job once the quote is accepted.");
    const existing = await tx.invoice.findFirst({ where: { jobId: job.id, kind: "service", status: { not: "void" } } });
    if (existing) fail(`This job already has invoice ${existing.invoiceNumber}.`);
    const lines = await tx.jobServiceLine.findMany({ where: { jobId: job.id } });
    const billable = lines.filter((l) => (l.totalMinor ?? 0) > 0);
    if (!billable.length) fail("The quote has no charges to invoice.");
    const org = await tx.clientOrganization.findUnique({ where: { id: job.organizationId } });
    const settings = await getSettings(tx);
    const taxable = billable.reduce((s, l) => s + l.totalMinor, 0);
    const tax = Math.round(taxable * settings.salesTaxBps / 1e4);
    const invoiceLines = billable.map((l) => ({ kind: "service", description: l.description, quantity: Number(l.quantity), unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor }));
    if (tax > 0) invoiceLines.push({ kind: "tax", description: `Sales tax (${settings.salesTaxBps / 100}%)`, quantity: 1, unitPriceMinor: tax, totalMinor: tax });
    const invoice = await createInvoice(tx, { kind: "service", clientOrganizationId: org.id, jobId: job.id, lines: invoiceLines, billTo: { legalName: org.legalName || org.name, addressLine1: org.addressLine1, city: org.city, region: org.region, postalCode: org.postalCode, countryCode: org.countryCode, email: org.billingEmail } });
    await notify(tx, { userIds: await organizationUsers(tx, org.id), type: "invoice_issued", title: `Invoice ${invoice.invoiceNumber} for ${job.jobNumber}`, body: `Your invoice is ready. Pay by card or bank transfer.`, link: `/client/invoices/${invoice.invoiceNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "job.invoiced", entityType: "Job", entityId: job.id, after: { invoiceNumber: invoice.invoiceNumber } });
    return invoice;
  });
  afterCommit(context);
  return result;
}

// features/keystone/lib/rules/sheets.ts
var MAX_SHEET_BYTES = 10 * 1024 * 1024;
var MAX_SHEET_ROWS = 2e4;
var STORED_ROW_CAP = 5e3;
var MANIFEST_FIELDS = {
  lineNumber: ["line", "line #", "line no", "item #", "#"],
  category: ["category", "type", "product type", "class"],
  manufacturer: ["manufacturer", "make", "brand", "mfr", "oem"],
  model: ["model", "model name", "model number", "model #"],
  partNumber: ["part number", "part #", "p/n", "pn", "sku", "mpn"],
  description: ["description", "desc", "item", "item description", "product"],
  serial: ["serial", "serial number", "serial #", "s/n", "sn", "service tag"],
  cpu: ["cpu", "processor", "proc"],
  ramGb: ["ram", "memory", "ram gb", "memory gb"],
  storageGb: ["storage", "hdd", "ssd", "drive", "storage gb", "hdd size"],
  storageType: ["storage type", "drive type"],
  screenIn: ["screen", "screen size", "display"],
  cosmeticGrade: ["cosmetic", "cosmetic grade", "grade", "condition"],
  functionalGrade: ["functional", "functional grade", "test result", "tested", "status"],
  quantity: ["qty", "quantity", "units", "count", "pcs"],
  unit: ["uom", "unit"],
  weight: ["weight", "lbs", "weight lb"],
  notes: ["notes", "comments", "remarks"],
  assetTag: ["asset tag", "client tag", "tag"]
};
var normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/[_\s]+/g, " ");
function detectHeaderRow(rows, fields = MANIFEST_FIELDS) {
  const vocabulary = new Set(Object.values(fields).flat());
  let best = { index: 0, score: -1 };
  rows.slice(0, 20).forEach((row, index) => {
    const cells = row.map(normalize).filter(Boolean);
    if (cells.length < 2) return;
    const known = cells.filter((cell2) => vocabulary.has(cell2)).length;
    const textual = cells.filter((cell2) => !/^[\d.,$-]+$/.test(cell2)).length;
    const score = known * 3 + textual / Math.max(1, cells.length);
    if (score > best.score) best = { index, score };
  });
  return best.index;
}
function proposeMapping(headers, fields = MANIFEST_FIELDS) {
  const mapping = {};
  const used = /* @__PURE__ */ new Set();
  const names = headers.map(normalize);
  for (const [field, words] of Object.entries(fields)) {
    const exact = names.findIndex((name, i) => !used.has(i) && words.includes(name));
    if (exact >= 0) {
      mapping[field] = exact;
      used.add(exact);
    }
  }
  for (const [field, words] of Object.entries(fields)) {
    if (field in mapping) continue;
    const partial = names.findIndex((name, i) => !used.has(i) && name && words.some((w) => w.length > 2 && name.includes(w)));
    if (partial >= 0) {
      mapping[field] = partial;
      used.add(partial);
    }
  }
  return mapping;
}
var cell = (row, index) => index == null || index < 0 ? "" : String(row[index] ?? "").trim();
function applyManifestMapping(headers, dataRows, mapping, firstRowNumber) {
  const mappedColumns = new Set(Object.values(mapping));
  const out = [];
  dataRows.forEach((row, i) => {
    if (!row.some((v) => String(v ?? "").trim())) return;
    const errors = [];
    const qtyText = cell(row, mapping.quantity);
    const serialText = cell(row, mapping.serial);
    const serials = serialText ? serialText.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [];
    let quantity = qtyText ? Number(qtyText.replace(/,/g, "")) : serials.length || 1;
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      errors.push(`Quantity "${qtyText}" is not a whole number.`);
      quantity = 0;
    }
    if (quantity === 0 && !errors.length) errors.push("Quantity is zero.");
    const description = cell(row, mapping.description);
    const model = cell(row, mapping.model);
    const manufacturer = cell(row, mapping.manufacturer);
    if (!description && !model && !manufacturer) errors.push("The row has no description, model or manufacturer.");
    const unitRaw = cell(row, mapping.unit).toLowerCase();
    const unit = ["lb", "lbs", "pound", "pounds"].includes(unitRaw) ? "lb" : ["kg", "kgs"].includes(unitRaw) ? "kg" : "each";
    const specs = {};
    for (const key of ["cpu", "ramGb", "storageGb", "storageType", "screenIn"]) {
      const value = cell(row, mapping[key]);
      if (value) specs[key] = /Gb$|In$/.test(key) && /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
    }
    const extra = {};
    headers.forEach((header, index) => {
      if (mappedColumns.has(index)) return;
      const value = cell(row, index);
      if (value) extra[String(header || `Column ${index + 1}`).trim()] = value;
    });
    const lineNumberText = cell(row, mapping.lineNumber);
    out.push({
      rowNumber: firstRowNumber + i,
      valid: errors.length === 0,
      errors,
      line: {
        lineNumber: lineNumberText && /^\d+$/.test(lineNumberText) ? Number(lineNumberText) : null,
        category: cell(row, mapping.category),
        manufacturer,
        model,
        partNumber: cell(row, mapping.partNumber),
        description: description || [manufacturer, model].filter(Boolean).join(" "),
        serials,
        specs,
        cosmeticGrade: cell(row, mapping.cosmeticGrade),
        functionalGrade: cell(row, mapping.functionalGrade),
        quantity,
        unit,
        notes: cell(row, mapping.notes),
        extra
      }
    });
  });
  return out;
}
function neutralizeCell(value) {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
function neutralizeRows(rows) {
  return rows.map((row) => row.map(neutralizeCell));
}
function parseMoneyCell(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  const text8 = String(value).replace(/[$,\s]/g, "");
  if (!text8) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text8)) return null;
  return Math.round(Number(text8) * 100);
}
var ERASURE_FIELDS = {
  serial: ["serial", "serial number", "drive serial", "disk serial", "s/n", "sn", "serialnumber", "hdd serial", "drive serial number"],
  result: ["result", "status", "erasure status", "outcome", "erasure result", "state"],
  method: ["method", "erasure method", "standard", "erasure standard", "algorithm", "wipe method"],
  startedAt: ["start", "started", "start time", "erasure start", "started at"],
  completedAt: ["end", "finished", "end time", "completed", "erasure end", "completed at", "date"],
  reportReference: ["report", "report id", "report uuid", "certificate", "job id", "uuid"],
  toolVersion: ["version", "software version", "tool version"]
};
function erasureResult(value) {
  const text8 = String(value ?? "").trim().toLowerCase();
  if (/^(pass|passed|success|successful|erased|completed|ok|verified)/.test(text8)) return "passed";
  if (/^(fail|failed|error|aborted|incomplete|not erased)/.test(text8)) return "failed";
  return null;
}
function erasureTechnique(value) {
  const text8 = String(value ?? "").toLowerCase();
  if (text8.includes("crypto")) return { method: "purge", technique: "crypto_erase" };
  if (text8.includes("secure erase") || text8.includes("sanitize") || text8.includes("purge")) return { method: "purge", technique: "secure_erase" };
  if (text8.includes("block")) return { method: "purge", technique: "block_erase" };
  return { method: "clear", technique: "overwrite" };
}

// features/keystone/lib/spreadsheet.ts
var XLSX = __toESM(require("xlsx"));
function readWorkbook(bytes, sheetName) {
  if (bytes.length > MAX_SHEET_BYTES) fail("Spreadsheets must be 10 MB or smaller.");
  let workbook;
  try {
    workbook = XLSX.read(bytes, { type: "buffer", cellFormula: false, cellHTML: false, cellDates: true, sheetRows: MAX_SHEET_ROWS + 25, dense: true });
  } catch {
    fail("This file could not be read as a spreadsheet. Use .xlsx, .xls or .csv.");
  }
  const sheetNames = workbook.SheetNames;
  if (!sheetNames.length) fail("The spreadsheet has no sheets.");
  const name = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const sheet = workbook.Sheets[name];
  const range2 = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
  const lead = Array.from({ length: range2?.s.r ?? 0 }, () => []);
  const rows = [...lead, ...XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "", blankrows: true, dateNF: "yyyy-mm-dd hh:mm" })];
  if (rows.length > MAX_SHEET_ROWS + 20) fail(`Spreadsheets can have at most ${MAX_SHEET_ROWS.toLocaleString()} rows.`);
  return { sheetNames, sheetName: name, rows: rows.map((r) => Array.isArray(r) ? r : []) };
}
function writeWorkbook(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(neutralizeRows(sheet.rows));
    if (sheet.widths) ws["!cols"] = sheet.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name.slice(0, 31));
  }
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
function writeCsv(rows) {
  const ws = XLSX.utils.aoa_to_sheet(neutralizeRows(rows));
  return Buffer.from(XLSX.utils.sheet_to_csv(ws), "utf8");
}
var XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// features/keystone/domain/process.ts
async function lockAsset(tx, id) {
  await lockRow(tx, "Asset", id) || fail("Asset not found.");
  return tx.asset.findUnique({ where: { id } });
}
function assertNotHeld(asset) {
  if (asset.status === "on_hold") fail(`${asset.assetNumber} is on hold: ${asset.holdReason || "release the hold first"}.`);
}
async function auditAsset(context, args) {
  const staffId = context.session.itemId;
  const result = await inTransaction(context, async (tx) => {
    let asset;
    const category = args.categoryId ? await tx.materialCategory.findUnique({ where: { id: args.categoryId } }) : null;
    const specs = Object.fromEntries(Object.entries(args.specs ?? {}).slice(0, 30).map(([k, v]) => [str(k, 40), typeof v === "number" ? v : str(v, 200)]));
    const common = {
      categoryId: args.categoryId ?? void 0,
      manufacturer: args.manufacturer !== void 0 ? str(args.manufacturer, 120) : void 0,
      model: args.model !== void 0 ? str(args.model, 120) : void 0,
      partNumber: args.partNumber !== void 0 ? str(args.partNumber, 120) : void 0,
      serialNumber: args.serialNumber !== void 0 ? str(args.serialNumber, 120) : void 0,
      clientAssetTag: args.clientAssetTag !== void 0 ? str(args.clientAssetTag, 120) : void 0,
      specs: args.specs ? specs : void 0,
      storageRemoved: args.storageRemoved ?? void 0,
      cosmeticGradeId: args.cosmeticGradeId ?? void 0,
      functionalGradeId: args.functionalGradeId ?? void 0,
      testNotes: args.testNotes !== void 0 ? str(args.testNotes, 2e3) : void 0,
      weight: args.weight != null ? Math.max(0, Number(args.weight)) : void 0,
      locationCode: args.locationCode !== void 0 ? str(args.locationCode, 40) : void 0,
      disposition: args.disposition && ["undecided", "resale", "parts", "recycle", "return"].includes(args.disposition) ? args.disposition : void 0,
      auditedById: staffId,
      auditedAt: /* @__PURE__ */ new Date()
    };
    if (args.assetId) {
      asset = await lockAsset(tx, args.assetId);
      assertNotHeld(asset);
      if (["allocated", "sold", "released", "downstream", "returned"].includes(asset.status)) fail(`${asset.assetNumber} is ${asset.status}; it cannot be re-audited.`);
      const isDataBearing = args.isDataBearing ?? asset.isDataBearing;
      const records = await tx.sanitizationRecord.findMany({ where: { assetId: asset.id } });
      asset = await tx.asset.update({ where: { id: asset.id }, data: { ...common, isDataBearing, sanitizationStatus: sanitizationStatusFromRecords(isDataBearing, records), status: asset.status === "received" ? "audited" : asset.status } });
    } else {
      if (!args.jobId) fail("Choose the job the asset came in on.");
      const job = await tx.job.findUnique({ where: { id: args.jobId } });
      if (!job) fail("Job not found.");
      if (!["received", "processing", "collected"].includes(job.status)) fail(`${job.jobNumber} is ${job.status.replace(/_/g, " ")}; audit assets on received jobs.`);
      if (job.status === "received") await tx.job.update({ where: { id: job.id }, data: { status: "processing" } });
      const serial = str(args.serialNumber, 120);
      if (serial) {
        const dupe = await tx.asset.findFirst({ where: { jobId: job.id, serialNumber: serial }, select: { assetNumber: true } });
        if (dupe) fail(`Serial ${serial} is already recorded on this job as ${dupe.assetNumber}.`);
      }
      const isDataBearing = args.isDataBearing ?? category?.dataBearingDefault ?? false;
      asset = await tx.asset.create({ data: { ...Object.fromEntries(Object.entries(common).filter(([, v]) => v !== void 0)), assetNumber: await nextNumber(tx, "asset"), jobId: job.id, organizationId: job.organizationId, containerId: args.containerId || null, parentId: args.parentId || null, isDataBearing, sanitizationStatus: isDataBearing ? "pending" : "not_required", status: "audited" } });
      await tx.custodyEvent.create({ data: { jobId: job.id, assetId: asset.id, containerId: args.containerId || null, type: "audited", actorId: staffId, occurredAt: /* @__PURE__ */ new Date(), facilityId: job.facilityId } });
    }
    for (const photo of (args.photos ?? []).slice(0, 8)) {
      const stored = await storeUpload(tx, photo, { purpose: "asset_photo", ownerClientOrganizationId: asset.organizationId, uploadedById: staffId });
      if (stored) await tx.assetPhoto.create({ data: { assetId: asset.id, imageId: stored.id, caption: "" } });
    }
    await audit(tx, { actorId: staffId, action: args.assetId ? "asset.updated" : "asset.audited", entityType: "Asset", entityId: asset.id });
    return asset;
  });
  return result;
}
async function recomputeSanitization(tx, assetId) {
  const asset = await tx.asset.findUnique({ where: { id: assetId } });
  const records = await tx.sanitizationRecord.findMany({ where: { assetId } });
  const status2 = sanitizationStatusFromRecords(asset.isDataBearing || records.length > 0, records);
  return tx.asset.update({ where: { id: assetId }, data: { sanitizationStatus: status2 } });
}
var METHODS = ["clear", "purge", "destroy"];
var TECHNIQUES = ["overwrite", "block_erase", "crypto_erase", "secure_erase", "degauss", "shred", "crush", "disintegrate"];
async function recordSanitization(context, args) {
  const method = METHODS.includes(args.method) ? args.method : fail("Choose clear, purge or destroy.");
  const technique = TECHNIQUES.includes(args.technique) ? args.technique : fail("Choose the technique.");
  const outcome = args.result === "failed" ? "failed" : args.result === "passed" ? "passed" : fail("Choose passed or failed.");
  if (outcome === "failed" && !str(args.failureReason, 500)) fail("Write why it failed.");
  const ids = [...new Set((args.assetIds ?? []).map((i) => str(i, 60)))].sort();
  if (!ids.length) fail("Choose at least one asset.");
  const staffId = context.session.itemId;
  return inTransaction(context, async (tx) => {
    const file = args.reportFile ? await storeUpload(tx, args.reportFile, { purpose: "erasure_report", uploadedById: staffId }) : null;
    const completedAt = args.completedAt ? new Date(args.completedAt) : /* @__PURE__ */ new Date();
    const out = [];
    for (const id of ids) {
      const asset = await lockAsset(tx, id);
      assertNotHeld(asset);
      if (["sold", "released", "downstream", "returned"].includes(asset.status)) fail(`${asset.assetNumber} has left our custody.`);
      await tx.sanitizationRecord.create({ data: { assetId: id, method, technique, standard: str(args.standard, 120) || "NIST SP 800-88 Rev. 1", tool: str(args.tool, 120), toolVersion: str(args.toolVersion, 60), reportReference: str(args.reportReference, 120), reportFileId: file?.id ?? null, startedAt: args.startedAt ? new Date(args.startedAt) : null, completedAt, result: outcome, failureReason: str(args.failureReason, 500), operatorId: staffId, witnessName: str(args.witnessName, 120) } });
      const updated = await recomputeSanitization(tx, id);
      await tx.custodyEvent.create({ data: { assetId: id, jobId: asset.jobId, type: "sanitized", actorId: staffId, occurredAt: completedAt, notes: `${method} / ${technique}: ${outcome}` } });
      out.push(updated);
    }
    await audit(tx, { actorId: staffId, action: "sanitization.recorded", entityType: "Asset", entityId: ids[0], after: { assets: ids.length, method, technique, result: outcome } });
    return out;
  }, BULK);
}
async function importErasureReport(context, args) {
  const staffId = context.session.itemId;
  if (args.importId && args.commit) return commitErasureImport(context, args.importId);
  const decoded = decodeUpload(args.file);
  if (!decoded) fail("Choose the erasure report.");
  const sheet = readWorkbook(decoded.bytes);
  const headerRow = detectHeaderRow(sheet.rows, ERASURE_FIELDS);
  const headers = sheet.rows[headerRow] ?? [];
  const map = proposeMapping(headers, ERASURE_FIELDS);
  if (map.serial == null) fail("The report has no serial number column.");
  if (map.result == null) fail("The report has no result or status column.");
  const parsed = sheet.rows.slice(headerRow + 1).map((r, i) => [r, i]).filter(([r]) => r.some((c) => String(c ?? "").trim())).map(([r, i]) => {
    const serial = String(r[map.serial] ?? "").trim();
    const result = erasureResult(r[map.result]);
    const technique = erasureTechnique(map.method != null ? r[map.method] : "");
    return { row: headerRow + i + 2, serial, result, resultText: String(r[map.result] ?? ""), method: technique.method, technique: technique.technique, standard: map.method != null ? String(r[map.method] ?? "") : "", startedAt: map.startedAt != null ? String(r[map.startedAt] ?? "") : "", completedAt: map.completedAt != null ? String(r[map.completedAt] ?? "") : "", reportReference: map.reportReference != null ? String(r[map.reportReference] ?? "") : "", toolVersion: map.toolVersion != null ? String(r[map.toolVersion] ?? "") : "" };
  });
  const serials = [...new Set(parsed.map((p) => p.serial).filter(Boolean))];
  const assets = await context.prisma.asset.findMany({ where: { serialNumber: { in: serials }, status: { notIn: ["sold", "released", "downstream", "returned"] } }, select: { id: true, assetNumber: true, serialNumber: true, jobId: true } });
  const bySerial = /* @__PURE__ */ new Map();
  for (const a of assets) bySerial.set(a.serialNumber, [...bySerial.get(a.serialNumber) ?? [], a]);
  const rows = parsed.map((p) => {
    const matches = bySerial.get(p.serial) ?? [];
    const problem = !p.serial ? "No serial" : p.result == null ? `Unknown result "${p.resultText}"` : !matches.length ? "No asset with this serial" : matches.length > 1 ? `Serial matches ${matches.length} assets` : null;
    return { ...p, assetId: matches.length === 1 ? matches[0].id : null, assetNumber: matches.length === 1 ? matches[0].assetNumber : "", problem };
  });
  const matched = rows.filter((r) => !r.problem).length;
  return inTransaction(context, async (tx) => {
    const file = await storeFile(tx, { ...decoded, purpose: "erasure_report", uploadedById: staffId });
    return tx.erasureImport.create({ data: { fileId: file.id, originalFilename: decoded.filename, tool: str(args.tool, 120), status: "validated", rowCount: rows.length, matchedCount: matched, unmatched: rows.filter((r) => r.problem).slice(0, 500), rows: rows.slice(0, 5e3), uploadedById: staffId } });
  });
}
async function commitErasureImport(context, importId) {
  const staffId = context.session.itemId;
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "ErasureImport", importId) || fail("Import not found.");
    const imp = await tx.erasureImport.findUnique({ where: { id: importId } });
    if (imp.status !== "validated") fail(`This import is ${imp.status}.`);
    const rows = (imp.rows ?? []).filter((r) => !r.problem && r.assetId);
    if (!rows.length) fail("No rows matched an asset.");
    const ids = [...new Set(rows.map((r) => r.assetId))].sort();
    for (const id of ids) await lockRow(tx, "Asset", id);
    for (const r of rows) {
      const parseDate = (v) => {
        const d = v ? new Date(v) : null;
        return d && !Number.isNaN(d.getTime()) ? d : null;
      };
      await tx.sanitizationRecord.create({ data: { assetId: r.assetId, method: r.method, technique: r.technique, standard: r.standard || "NIST SP 800-88 Rev. 1", tool: imp.tool, toolVersion: r.toolVersion, reportReference: r.reportReference, reportFileId: imp.fileId, startedAt: parseDate(r.startedAt), completedAt: parseDate(r.completedAt) ?? /* @__PURE__ */ new Date(), result: r.result, failureReason: r.result === "failed" ? r.resultText : "", operatorId: staffId, importBatchId: imp.id } });
    }
    for (const id of ids) await recomputeSanitization(tx, id);
    await audit(tx, { actorId: staffId, action: "erasure_import.committed", entityType: "ErasureImport", entityId: imp.id, after: { records: rows.length } });
    return tx.erasureImport.update({ where: { id: imp.id }, data: { status: "committed" } });
  });
}
async function verifySanitization(context, args) {
  const staffId = context.session.itemId;
  return inTransaction(context, async (tx) => {
    const record = await tx.sanitizationRecord.findUnique({ where: { id: str(args.recordId, 60) } });
    if (!record) fail("Record not found.");
    if (record.operatorId === staffId) fail("A record must be verified by someone other than the operator.");
    if (record.verifiedById) fail("This record is already verified.");
    await lockRow(tx, "Asset", record.assetId);
    const updated = await tx.sanitizationRecord.update({ where: { id: record.id }, data: { verifiedById: staffId, verifiedAt: /* @__PURE__ */ new Date(), verificationNote: `${args.confirmed ? "Confirmed" : "Not confirmed"}${args.note ? `: ${str(args.note, 500)}` : ""}` } });
    if (!args.confirmed) {
      await tx.sanitizationRecord.create({ data: { assetId: record.assetId, method: record.method, technique: record.technique, standard: record.standard, tool: "Verification", result: "failed", failureReason: `Verification sample failed: ${str(args.note, 500) || "data found"}`, operatorId: staffId, completedAt: /* @__PURE__ */ new Date() } });
      await recomputeSanitization(tx, record.assetId);
    }
    await audit(tx, { actorId: staffId, action: args.confirmed ? "sanitization.verified" : "sanitization.verification_failed", entityType: "SanitizationRecord", entityId: record.id, reason: str(args.note, 500) });
    return updated;
  });
}
async function sanitizationSample(context, args) {
  const settings = await getSettings(context.prisma);
  const pool = await context.prisma.sanitizationRecord.findMany({ where: { verifiedById: null, result: "passed", tool: { not: "Verification" } }, select: { id: true }, orderBy: { createdAt: "desc" }, take: 2e3 });
  const want = Math.min(args.limit ?? 50, Math.max(pool.length ? 1 : 0, Math.ceil(pool.length * settings.sanitizationVerificationSampleBps / 1e4)));
  const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, want).map((r) => r.id);
  return context.prisma.sanitizationRecord.findMany({ where: { id: { in: picked } }, include: { asset: { select: { id: true, assetNumber: true, serialNumber: true, manufacturer: true, model: true } }, operator: { select: { name: true } } } });
}
async function setAssetDisposition(context, args) {
  const disposition = ["resale", "parts", "recycle", "return", "undecided"].includes(args.disposition) ? args.disposition : fail("Choose resale, parts, recycle or return.");
  const staffId = context.session.itemId;
  const ids = [...new Set((args.assetIds ?? []).map((i) => str(i, 60)))].sort();
  if (!ids.length) fail("Choose at least one asset.");
  return inTransaction(context, async (tx) => {
    const out = [];
    for (const id of ids) {
      const asset = await lockAsset(tx, id);
      assertNotHeld(asset);
      if (!["received", "audited", "ready_for_sale", "recycling"].includes(asset.status)) fail(`${asset.assetNumber} is ${asset.status}; its disposition cannot change.`);
      let status2 = asset.status;
      if (disposition === "resale" || disposition === "parts") {
        if (!sanitizationAllowsSale(asset)) fail(`${asset.assetNumber} has not passed sanitisation; it cannot be sold.`);
        status2 = "ready_for_sale";
      } else if (disposition === "recycle") status2 = "recycling";
      else if (disposition === "return") status2 = "returned";
      else status2 = asset.status === "ready_for_sale" || asset.status === "recycling" ? "audited" : asset.status;
      const updated = await tx.asset.update({ where: { id }, data: { disposition, status: status2 } });
      if (status2 !== asset.status) await tx.custodyEvent.create({ data: { assetId: id, jobId: asset.jobId, type: status2 === "returned" ? "returned_to_client" : "moved", actorId: staffId, occurredAt: /* @__PURE__ */ new Date(), notes: `Disposition ${disposition}` } });
      out.push(updated);
    }
    await audit(tx, { actorId: staffId, action: "asset.disposition", entityType: "Asset", entityId: ids[0], after: { assets: ids.length, disposition } });
    return out;
  }, BULK);
}
async function placeAssetHold(context, args) {
  const reason = str(args.reason, 500) || fail("Write the reason for the hold.");
  const staffId = context.session.itemId;
  const ids = [...new Set((args.assetIds ?? []).map((i) => str(i, 60)))].sort();
  return inTransaction(context, async (tx) => {
    const out = [];
    for (const id of ids) {
      const asset = await lockAsset(tx, id);
      if (asset.status === "on_hold") continue;
      if (["sold", "released", "downstream", "returned"].includes(asset.status)) fail(`${asset.assetNumber} has left our custody.`);
      if (asset.status === "allocated") fail(`${asset.assetNumber} is on a lot; take it off the lot first.`);
      out.push(await tx.asset.update({ where: { id }, data: { status: "on_hold", holdFromStatus: asset.status, holdReason: reason } }));
      await tx.custodyEvent.create({ data: { assetId: id, jobId: asset.jobId, type: "hold_placed", actorId: staffId, occurredAt: /* @__PURE__ */ new Date(), notes: reason } });
    }
    await audit(tx, { actorId: staffId, action: "asset.hold", entityType: "Asset", entityId: ids[0] ?? "", after: { assets: out.length }, reason });
    return out;
  }, BULK);
}
async function releaseAssetHold(context, args) {
  const staffId = context.session.itemId;
  const ids = [...new Set((args.assetIds ?? []).map((i) => str(i, 60)))].sort();
  return inTransaction(context, async (tx) => {
    const out = [];
    for (const id of ids) {
      const asset = await lockAsset(tx, id);
      if (asset.status !== "on_hold") continue;
      out.push(await tx.asset.update({ where: { id }, data: { status: asset.holdFromStatus || "audited", holdFromStatus: "", holdReason: "" } }));
      await tx.custodyEvent.create({ data: { assetId: id, jobId: asset.jobId, type: "hold_released", actorId: staffId, occurredAt: /* @__PURE__ */ new Date(), notes: str(args.note, 500) } });
    }
    await audit(tx, { actorId: staffId, action: "asset.hold_released", entityType: "Asset", entityId: ids[0] ?? "", after: { assets: out.length }, reason: str(args.note, 500) });
    return out;
  }, BULK);
}
async function exportAssets(context, args) {
  const where = {};
  if (args.jobId) where.jobId = args.jobId;
  if (args.organizationId) where.organizationId = args.organizationId;
  if (args.status) where.status = args.status;
  if (args.search) where.OR = [{ serialNumber: { contains: str(args.search, 120), mode: "insensitive" } }, { clientAssetTag: { contains: str(args.search, 120), mode: "insensitive" } }, { assetNumber: { contains: str(args.search, 120), mode: "insensitive" } }];
  const assets = await context.prisma.asset.findMany({ where, take: 2e4, orderBy: { assetNumber: "asc" }, include: { category: { select: { name: true } }, job: { select: { jobNumber: true } }, organization: { select: { name: true } }, cosmeticGrade: { select: { label: true } }, functionalGrade: { select: { label: true } }, sanitizationRecords: { orderBy: { completedAt: "desc" }, take: 1 } } });
  const header = ["Asset", "Job", "Client", "Client tag", "Category", "Manufacturer", "Model", "Serial", "Data bearing", "Sanitisation", "Method", "Completed", "Cosmetic", "Functional", "Status", "Disposition", ...args.forClient ? [] : ["Location", "Sold price"]];
  const rows = assets.map((a) => {
    const r = a.sanitizationRecords[0];
    return [a.assetNumber, a.job?.jobNumber ?? "", a.organization?.name ?? "", a.clientAssetTag, a.category?.name ?? "", a.manufacturer, a.model, a.serialNumber, a.isDataBearing ? "Yes" : "No", a.sanitizationStatus.replace(/_/g, " "), r ? `${r.method} / ${r.technique}` : "", r?.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : "", a.cosmeticGrade?.label ?? "", a.functionalGrade?.label ?? "", a.status.replace(/_/g, " "), a.disposition, ...args.forClient ? [] : [a.locationCode, a.soldPriceMinor != null ? a.soldPriceMinor / 100 : ""]];
  });
  const name = args.jobId ? assets[0]?.job?.jobNumber ?? "job" : "assets";
  return asDownload(`${name}-assets.xlsx`, XLSX_MIME, writeWorkbook([{ name: "Assets", rows: [header, ...rows] }]));
}
async function certificatePdf(tx, cert) {
  const settings = await getSettings(tx);
  const s = cert.snapshot;
  const base = (settings.storefrontUrl || "").replace(/\/$/, "");
  const blocks = [
    { kind: "title", text: cert.type === "data_destruction" ? "Certificate of Data Destruction" : "Certificate of Recycling" },
    { kind: "pairs", pairs: [["Certificate", cert.certificateNumber], ["Verification code", cert.verificationCode], ["Verify at", `${base}/verify/${cert.verificationCode}`], ["Issued", new Date(cert.issuedAt).toUTCString()], ["Client", s.client.name], ["Job", s.job.jobNumber], ["Collected", s.job.collectedAt ? new Date(s.job.collectedAt).toDateString() : "-"], ["Facility", s.facility ?? "-"]] }
  ];
  if (cert.replacesNumber) blocks.push({ kind: "text", text: `This certificate replaces ${cert.replacesNumber}, which was revoked.` });
  if (cert.type === "data_destruction") {
    blocks.push({ kind: "text", text: `${settings.legalName || settings.businessName} certifies that the data-bearing devices listed below, received from the client named above under chain of custody, were sanitised according to NIST SP 800-88 Rev. 1 as recorded.` });
    blocks.push({ kind: "table", headers: ["Asset", "Type", "Manufacturer / model", "Serial", "Method", "Technique", "Result", "Date"], widths: [1.1, 1, 2, 1.6, 0.8, 1, 0.8, 1], rows: s.assets.map((a) => [a.assetNumber, a.category, `${a.manufacturer} ${a.model}`.trim(), a.serialNumber, a.method, a.technique, a.result, a.completedAt ? a.completedAt.slice(0, 10) : ""]) });
    blocks.push({ kind: "pairs", pairs: [["Devices", String(s.assets.length)], ["Destroyed", String(s.assets.filter((a) => a.method === "destroy").length)], ["Purged or cleared", String(s.assets.filter((a) => a.method !== "destroy").length)]] });
  } else {
    blocks.push({ kind: "text", text: `${settings.legalName || settings.businessName} certifies that the electronic equipment received from the client named above was reused, resold or recycled responsibly, and that no material was sent to landfill or to a vendor not approved for it.` });
    blocks.push({ kind: "table", headers: ["Category", "Weight", "Units"], widths: [3, 1, 1], align: ["left", "right", "right"], rows: s.categories.map((c) => [c.name, `${c.weight.toFixed(1)} ${settings.weightUnit}`, String(c.units)]) });
    blocks.push({ kind: "pairs", pairs: [["Total weight", `${s.totalWeight.toFixed(1)} ${settings.weightUnit}`], ["Units for reuse", String(s.reuseUnits)], ["Units recycled", String(s.recycleUnits)]] });
  }
  if (s.certifications?.length) blocks.push({ kind: "text", text: `Certifications held: ${s.certifications.join(", ")}` });
  blocks.push({ kind: "signature", label: `Issued by ${s.issuedBy}`, value: s.issuedBy });
  return renderPdf({ header: settings.businessName, headerRight: cert.certificateNumber, footer: `Verify this certificate with code ${cert.verificationCode}`, blocks });
}
async function certificateSnapshot(tx, job, type, issuedBy) {
  const org = await tx.clientOrganization.findUnique({ where: { id: job.organizationId } });
  const facility = job.facilityId ? await tx.facility.findUnique({ where: { id: job.facilityId } }) : null;
  const certifications = await tx.certification.findMany({ where: { isPublic: true, OR: [{ facilityId: null }, { facilityId: job.facilityId }], AND: [{ OR: [{ expiresOn: null }, { expiresOn: { gt: /* @__PURE__ */ new Date() } }] }] }, select: { name: true, otherName: true } });
  const base = { client: { name: org.legalName || org.name }, job: { jobNumber: job.jobNumber, collectedAt: job.collectedAt }, facility: facility ? `${facility.name}, ${facility.city}` : null, issuedBy, certifications: certifications.map((c) => c.name === "Other" ? c.otherName : c.name) };
  if (type === "data_destruction") {
    const assets2 = await tx.asset.findMany({ where: { jobId: job.id, isDataBearing: true }, include: { category: { select: { name: true } }, sanitizationRecords: { orderBy: { completedAt: "desc" } } }, orderBy: { assetNumber: "asc" } });
    return {
      ...base,
      assets: assets2.map((a) => {
        const ok = a.sanitizationRecords.find((r) => r.result === "passed");
        return { assetNumber: a.assetNumber, category: a.category?.name ?? "", manufacturer: a.manufacturer, model: a.model, serialNumber: a.serialNumber, method: ok?.method ?? "", technique: ok?.technique ?? "", result: a.sanitizationStatus, completedAt: ok?.completedAt ? new Date(ok.completedAt).toISOString() : null };
      })
    };
  }
  const assets = await tx.asset.findMany({ where: { jobId: job.id }, include: { category: { select: { name: true } } } });
  const commodities = await tx.commodityLine.findMany({ where: { jobId: job.id }, include: { category: { select: { name: true } } } });
  const cats = /* @__PURE__ */ new Map();
  for (const a of assets) {
    const k = a.category?.name ?? "Equipment";
    const c = cats.get(k) ?? { name: k, weight: 0, units: 0 };
    c.weight += Number(a.weight ?? 0);
    c.units += 1;
    cats.set(k, c);
  }
  for (const l of commodities) {
    const k = l.category?.name ?? "Mixed e-scrap";
    const c = cats.get(k) ?? { name: k, weight: 0, units: 0 };
    c.weight += Number(l.weight ?? 0);
    cats.set(k, c);
  }
  const categories = [...cats.values()];
  return { ...base, categories, totalWeight: categories.reduce((s, c) => s + c.weight, 0), reuseUnits: assets.filter((a) => ["resale", "parts"].includes(a.disposition)).length, recycleUnits: assets.filter((a) => a.disposition === "recycle").length };
}
async function issueCertificate(context, args) {
  const type = ["data_destruction", "recycling"].includes(args.type) ? args.type : fail("Choose data destruction or recycling.");
  const staff = await context.prisma.user.findUnique({ where: { id: context.session.itemId }, select: { name: true } });
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Job", args.jobId) || fail("Job not found.");
    const job = await tx.job.findUnique({ where: { id: args.jobId } });
    if (!["received", "processing", "completed", "settled", "closed"].includes(job.status)) fail("Certificates are issued once the job is processed.");
    if (type === "data_destruction") {
      const open = await tx.asset.count({ where: { jobId: job.id, isDataBearing: true, sanitizationStatus: { notIn: ["passed", "destroyed"] } } });
      if (open) fail(`${open} data-bearing asset${open === 1 ? " is" : "s are"} not yet sanitised.`);
      const total = await tx.asset.count({ where: { jobId: job.id, isDataBearing: true } });
      if (!total) fail("This job has no data-bearing assets.");
    }
    let replaces = null;
    if (args.replacesId) {
      await lockRow(tx, "Certificate", args.replacesId);
      replaces = await tx.certificate.findUnique({ where: { id: args.replacesId } });
      if (!replaces || replaces.jobId !== job.id || replaces.type !== type) fail("The certificate being replaced does not match.");
      if (replaces.status !== "revoked") fail("Revoke the old certificate first.");
    } else {
      const live = await tx.certificate.findFirst({ where: { jobId: job.id, type, status: "issued" } });
      if (live) fail(`${live.certificateNumber} is already issued. Revoke and reissue to correct it.`);
    }
    const snapshot = await certificateSnapshot(tx, job, type, staff?.name ?? "Staff");
    const cert = await tx.certificate.create({ data: { certificateNumber: await nextNumber(tx, "certificate"), type, jobId: job.id, organizationId: job.organizationId, issuedAt: await dbNow(tx), issuedById: context.session.itemId, verificationCode: verificationCode(), snapshot, status: "issued", replacesId: replaces?.id ?? null } });
    const pdf = await certificatePdf(tx, { ...cert, replacesNumber: replaces?.certificateNumber });
    const file = await storeFile(tx, { filename: `${cert.certificateNumber}.pdf`, mimeType: "application/pdf", bytes: pdf, purpose: "certificate", ownerClientOrganizationId: job.organizationId, uploadedById: context.session.itemId });
    const updated = await tx.certificate.update({ where: { id: cert.id }, data: { pdfId: file.id } });
    await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: "certificate_issued", title: `${cert.certificateNumber} for ${job.jobNumber}`, body: `Your ${type === "data_destruction" ? "data destruction" : "recycling"} certificate is ready to download.`, link: `/client/jobs/${job.jobNumber}` });
    await audit(tx, { actorId: context.session.itemId, action: "certificate.issued", entityType: "Certificate", entityId: cert.id, after: { type, jobId: job.id, replaces: replaces?.certificateNumber } });
    return updated;
  }, BULK);
  afterCommit(context);
  return result;
}
async function rerenderCertificate(tx, certificateId) {
  const cert = await tx.certificate.findUnique({ where: { id: certificateId }, include: { issuedBy: { select: { name: true } }, replaces: { select: { certificateNumber: true } } } });
  if (!cert) fail("Certificate not found.");
  const job = await tx.job.findUnique({ where: { id: cert.jobId } });
  const snapshot = await certificateSnapshot(tx, job, cert.type, cert.issuedBy?.name ?? "Staff");
  const pdf = await certificatePdf(tx, { ...cert, snapshot, replacesNumber: cert.replaces?.certificateNumber });
  const old = cert.pdfId;
  const file = await storeFile(tx, { filename: `${cert.certificateNumber}.pdf`, mimeType: "application/pdf", bytes: pdf, purpose: "certificate", ownerClientOrganizationId: job.organizationId, uploadedById: cert.issuedById });
  await tx.certificate.update({ where: { id: cert.id }, data: { snapshot, pdfId: file.id } });
  if (old) await tx.storedFile.delete({ where: { id: old } });
}
async function revokeCertificate(context, args) {
  const reason = str(args.reason, 500) || fail("Write why the certificate is revoked.");
  const revoked = await inTransaction(context, async (tx) => {
    await lockRow(tx, "Certificate", args.certificateId) || fail("Certificate not found.");
    const cert = await tx.certificate.findUnique({ where: { id: args.certificateId } });
    if (cert.status !== "issued") fail("This certificate is already revoked.");
    await audit(tx, { actorId: context.session.itemId, action: "certificate.revoked", entityType: "Certificate", entityId: cert.id, reason });
    return tx.certificate.update({ where: { id: cert.id }, data: { status: "revoked", revokedReason: reason, revokedAt: /* @__PURE__ */ new Date() } });
  });
  if (args.reissue) return issueCertificate(context, { jobId: revoked.jobId, type: revoked.type, replacesId: revoked.id });
  return revoked;
}
async function verifyCertificate(context, args) {
  const code = str(args.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 12) return null;
  const cert = await context.prisma.certificate.findUnique({ where: { verificationCode: code } });
  if (!cert) return null;
  const replacement = cert.status === "revoked" ? await context.prisma.certificate.findFirst({ where: { replacesId: cert.id }, select: { certificateNumber: true, verificationCode: true, status: true } }) : null;
  const s = cert.snapshot ?? {};
  return {
    certificateNumber: cert.certificateNumber,
    type: cert.type,
    status: cert.status,
    issuedAt: cert.issuedAt,
    revokedAt: cert.revokedAt,
    revokedReason: cert.status === "revoked" ? cert.revokedReason : "",
    clientName: s.client?.name ?? "",
    jobNumber: s.job?.jobNumber ?? "",
    deviceCount: Array.isArray(s.assets) ? s.assets.length : null,
    totalWeight: s.totalWeight ?? null,
    facility: s.facility ?? "",
    replacedBy: replacement ? { certificateNumber: replacement.certificateNumber, verificationCode: replacement.verificationCode } : null
  };
}
async function shipOutbound(context, args) {
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, "OutboundShipment", args.shipmentId) || fail("Shipment not found.");
    const shipment = await tx.outboundShipment.findUnique({ where: { id: args.shipmentId }, include: { vendor: { include: { approvedCategories: { select: { id: true, name: true } } } }, lines: { include: { category: true, assets: { select: { id: true, assetNumber: true, status: true, sanitizationStatus: true, isDataBearing: true, storageRemoved: true, jobId: true } }, commodityLines: { select: { id: true } } } } } });
    if (shipment.status !== "draft") fail("This shipment has already shipped.");
    if (!shipment.lines.length) fail("Add at least one line.");
    const vendor = shipment.vendor;
    if (!vendor) fail("Choose the downstream vendor.");
    if (vendor.status !== "approved") fail(`${vendor.name} is ${vendor.status}; ship only to an approved vendor.`);
    if (vendor.reviewDueOn && new Date(vendor.reviewDueOn) < /* @__PURE__ */ new Date()) fail(`${vendor.name}'s approval review is overdue.`);
    const approved = new Set(vendor.approvedCategories.map((c) => c.id));
    const notApproved = shipment.lines.filter((l) => l.categoryId && !approved.has(l.categoryId));
    if (notApproved.length) fail(`${vendor.name} is not approved for ${notApproved.map((l) => l.category?.name).join(", ")}.`);
    for (const l of shipment.lines) for (const a of l.assets) {
      if (!["recycling", "audited"].includes(a.status)) fail(`${a.assetNumber} is ${a.status}; only assets set to recycle can ship downstream.`);
      if (a.isDataBearing && !["passed", "destroyed"].includes(a.sanitizationStatus) && !a.storageRemoved) fail(`${a.assetNumber} has not been sanitised.`);
    }
    const now = args.shippedAt ? new Date(args.shippedAt) : await dbNow(tx);
    const assetIds = shipment.lines.flatMap((l) => l.assets.map((a) => a.id));
    await tx.asset.updateMany({ where: { id: { in: assetIds } }, data: { status: "downstream" } });
    for (const l of shipment.lines) for (const a of l.assets) await tx.custodyEvent.create({ data: { assetId: a.id, jobId: a.jobId, type: "shipped_downstream", actorId: context.session.itemId, occurredAt: now, facilityId: shipment.facilityId, notes: `${shipment.shipmentNumber} to ${vendor.name}` } });
    await audit(tx, { actorId: context.session.itemId, action: "outbound.shipped", entityType: "OutboundShipment", entityId: shipment.id, after: { vendor: vendor.name, assets: assetIds.length } });
    return tx.outboundShipment.update({ where: { id: shipment.id }, data: { status: "shipped", shippedAt: now, carrier: str(args.carrier, 120) || shipment.carrier, billOfLading: str(args.billOfLading, 120) || shipment.billOfLading } });
  });
  return result;
}
async function confirmOutboundReceipt(context, args) {
  const weight = Number(args.receivedWeight);
  if (!Number.isFinite(weight) || weight <= 0) fail("Enter the weight on the vendor's receipt.");
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "OutboundShipment", args.shipmentId) || fail("Shipment not found.");
    const shipment = await tx.outboundShipment.findUnique({ where: { id: args.shipmentId } });
    if (shipment.status === "receipt_confirmed" && args.close) return tx.outboundShipment.update({ where: { id: shipment.id }, data: { status: "closed" } });
    if (shipment.status !== "shipped") fail("Confirm receipt once the shipment has shipped.");
    const file = await storeUpload(tx, args.receipt, { purpose: "downstream_receipt", uploadedById: context.session.itemId });
    await audit(tx, { actorId: context.session.itemId, action: "outbound.receipt_confirmed", entityType: "OutboundShipment", entityId: shipment.id, after: { receivedWeight: weight } });
    return tx.outboundShipment.update({ where: { id: shipment.id }, data: { status: args.close ? "closed" : "receipt_confirmed", receivedWeight: weight, receiptConfirmedAt: /* @__PURE__ */ new Date(), receiptDocumentId: file?.id ?? shipment.receiptDocumentId } });
  });
}

// features/keystone/domain/reads.ts
var PUBLIC_LOT_STATUSES = ["scheduled", "open", "closed", "awarded", "completed"];
var richText = (doc2) => Array.isArray(doc2) ? doc2 : [];
async function storefrontSettings(context) {
  const s = await getSettings(context.prisma);
  return {
    businessName: s.businessName,
    legalName: s.legalName,
    tagline: s.tagline,
    logoUrl: fileUrl(s.logoId),
    supportEmail: s.supportEmail,
    supportPhone: s.supportPhone,
    timezone: s.timezone,
    currencyCode: s.currencyCode,
    weightUnit: s.weightUnit,
    publicLotVisibility: s.publicLotVisibility,
    rules: {
      defaultBidFormat: s.defaultBidFormat,
      softCloseWindowMinutes: s.softCloseWindowMinutes,
      softCloseExtensionMinutes: s.softCloseExtensionMinutes,
      bidValidityBusinessDays: s.bidValidityBusinessDays,
      buyerPremiumBps: s.buyerPremiumBps,
      salesTaxBps: s.salesTaxBps,
      cardFeeBps: s.cardFeeBps,
      cardMaxAmountMinor: s.cardMaxAmountMinor,
      paymentDueBusinessDays: s.paymentDueBusinessDays,
      restockingFeeBps: s.restockingFeeBps,
      strikesBeforeSuspension: s.strikesBeforeSuspension,
      removalBusinessDays: s.removalBusinessDays,
      storageFeePerPalletPerDayMinor: s.storageFeePerPalletPerDayMinor,
      claimWindowBusinessDays: s.claimWindowBusinessDays
    },
    wholesaleTerms: richText(s.wholesaleTerms),
    wholesaleTermsVersion: s.wholesaleTermsVersion,
    serviceTerms: richText(s.serviceTerms),
    serviceTermsVersion: s.serviceTermsVersion,
    exportClause: s.exportClause
  };
}
async function publicCertifications(context) {
  const rows = await context.prisma.certification.findMany({ where: { isPublic: true, OR: [{ expiresOn: null }, { expiresOn: { gte: /* @__PURE__ */ new Date() } }] }, include: { facility: { select: { name: true } } }, orderBy: { name: "asc" } });
  return rows.map((c) => ({ id: c.id, name: c.name === "Other" ? c.otherName : c.name, certificateNumber: c.certificateNumber, certifyingBody: c.certifyingBody, facility: c.facility?.name ?? "", expiresOn: c.expiresOn, documentUrl: c.documentId ? fileUrl(c.documentId) : null }));
}
async function publicAcceptedItems(context) {
  const rows = await context.prisma.acceptedItem.findMany({ include: { category: { select: { name: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return rows.map((i) => ({ id: i.id, name: i.name, category: i.category?.name ?? "", accepted: i.accepted, feeType: i.feeType, feeMinor: i.feeMinor, notes: i.notes }));
}
async function publicFacilities(context) {
  const rows = await context.prisma.facility.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return rows.map((f) => ({ id: f.id, name: f.name, code: f.code, addressLine1: f.addressLine1, addressLine2: f.addressLine2, city: f.city, region: f.region, postalCode: f.postalCode, countryCode: f.countryCode, phone: f.phone, hours: f.hours ?? {}, acceptsDropOff: f.acceptsDropOff }));
}
async function publicGradeGuide(context) {
  const rows = await context.prisma.gradeDefinition.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
  return rows.map((g) => ({ id: g.id, kind: g.kind, code: g.code, label: g.label, description: g.description }));
}
async function publicCategories(context) {
  const rows = await context.prisma.materialCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, kind: true } });
  return rows;
}
async function publicSaleEvents(context) {
  const rows = await context.prisma.saleEvent.findMany({ where: { status: "published", closesAt: { gte: new Date(Date.now() - 7 * 864e5) } }, orderBy: { opensAt: "asc" }, take: 50 });
  return rows.map((e) => ({ id: e.id, title: e.title, slug: e.slug, description: e.description, opensAt: e.opensAt, closesAt: e.closesAt }));
}
async function lotCards(context, where, withPrices, companyId) {
  const lots = await context.prisma.lot.findMany({
    where: { status: { in: PUBLIC_LOT_STATUSES }, ...where },
    orderBy: [{ closesAt: "asc" }],
    take: 200,
    include: { category: { select: { name: true, slug: true } }, saleEvent: { select: { id: true, title: true, slug: true } }, images: { orderBy: { sortOrder: "asc" }, take: 1 }, lines: { select: { quantity: true } } }
  });
  const myBids2 = companyId ? await context.prisma.bid.findMany({ where: { companyId, lotId: { in: lots.map((l) => l.id) }, status: { in: ["active", "won", "partially_won", "lost"] } }, select: { lotId: true, status: true, amountMinor: true } }) : [];
  return lots.map((l) => {
    const mine = myBids2.find((b) => b.lotId === l.id);
    const sealed = l.format === "sealed_bid";
    return {
      id: l.id,
      lotNumber: l.lotNumber,
      title: l.title,
      status: l.status,
      format: l.format,
      bidBasis: l.bidBasis,
      category: l.category?.name ?? "",
      categorySlug: l.category?.slug ?? "",
      saleEvent: l.saleEvent,
      imageUrl: l.images[0] ? fileUrl(l.images[0].imageId) : null,
      unitCount: l.lines.reduce((s, x) => s + (x.quantity ?? 0), 0),
      lineCount: l.lines.length,
      palletCount: l.palletCount,
      weight: l.weight != null ? Number(l.weight) : null,
      opensAt: l.opensAt,
      closesAt: l.closesAt,
      conditionSummary: l.conditionSummary,
      ...withPrices ? { currentAmountMinor: sealed ? null : l.currentAmountMinor, bidCount: sealed ? null : l.bidCount, openingBidMinor: l.openingBidMinor, fixedPriceMinor: l.format === "fixed_price" ? l.fixedPriceMinor : null, myBidStatus: mine?.status ?? null, myBidMinor: mine?.amountMinor ?? null } : {}
    };
  });
}
async function publicLots(context, args = {}) {
  const where = {};
  if (args.category) where.category = { slug: str(args.category, 120) };
  if (args.saleEventId) where.saleEventId = str(args.saleEventId, 60);
  if (args.status && PUBLIC_LOT_STATUSES.includes(args.status)) where.status = args.status;
  return lotCards(context, where, false);
}
async function publicLot(context, args) {
  const lot = await context.prisma.lot.findUnique({ where: { lotNumber: str(args.lotNumber, 40) }, include: { category: { select: { name: true } }, images: { orderBy: { sortOrder: "asc" } }, lines: { select: { quantity: true, manufacturer: true, categoryId: true } }, saleEvent: { select: { title: true, slug: true } } } });
  if (!lot || !PUBLIC_LOT_STATUSES.includes(lot.status)) return null;
  const settings = await getSettings(context.prisma);
  const manufacturers = [...new Set(lot.lines.map((l) => l.manufacturer).filter(Boolean))].slice(0, 12);
  return {
    lotNumber: lot.lotNumber,
    title: lot.title,
    status: lot.status,
    format: lot.format,
    bidBasis: lot.bidBasis,
    category: lot.category?.name ?? "",
    saleEvent: lot.saleEvent,
    description: richText(lot.description),
    conditionSummary: lot.conditionSummary,
    images: lot.images.map((i) => ({ url: fileUrl(i.imageId), caption: i.caption })),
    unitCount: lot.lines.reduce((s, x) => s + (x.quantity ?? 0), 0),
    lineCount: lot.lines.length,
    manufacturers,
    palletCount: lot.palletCount,
    weight: lot.weight != null ? Number(lot.weight) : null,
    shippingTerms: lot.shippingTerms,
    exportAllowed: lot.exportAllowed,
    opensAt: lot.opensAt,
    closesAt: lot.closesAt,
    manifestVisibility: settings.publicLotVisibility
  };
}
async function myBuyerCompany(context) {
  const { companyId, user } = await requireBuyer(context);
  const c = await context.prisma.buyerCompany.findUnique({ where: { id: companyId }, include: { documents: { orderBy: { createdAt: "desc" } }, messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } }, categoriesOfInterest: { select: { id: true, name: true } }, users: { select: { id: true, name: true, email: true, buyerRole: true, isActive: true } } } });
  const settings = await getSettings(context.prisma);
  const overdue = await context.prisma.invoice.findMany({ where: { buyerCompanyId: companyId, isOverdue: true, status: { in: ["open", "partially_paid"] } }, select: { invoiceNumber: true, totalMinor: true, paidMinor: true, dueAt: true } });
  const exposure = await companyExposure(context.prisma, companyId);
  const problem = bidEligibilityProblem({ companyStatus: c.status, userActive: user.isActive, acceptedTermsVersion: user.acceptedTermsVersion, currentTermsVersion: settings.wholesaleTermsVersion, spendLimitMinor: c.spendLimitMinor, bidAmountMinor: 0, ...exposure });
  return {
    id: c.id,
    legalName: c.legalName,
    tradingName: c.tradingName,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2,
    city: c.city,
    region: c.region,
    postalCode: c.postalCode,
    countryCode: c.countryCode,
    phone: c.phone,
    website: c.website,
    taxId: c.taxId,
    businessType: c.businessType,
    monthlySpendBand: c.monthlySpendBand,
    destinationCountries: c.destinationCountries ?? [],
    categoriesOfInterest: c.categoriesOfInterest,
    status: c.status,
    statusReason: ["needs_info", "rejected", "suspended"].includes(c.status) ? c.statusReason : "",
    rejectedAt: c.rejectedAt,
    taxStatus: c.taxStatus,
    spendLimitMinor: c.spendLimitMinor,
    exposureMinor: exposure.unpaidAwardsMinor + exposure.otherActiveBidsMinor,
    strikes: c.strikes,
    termsVersionAccepted: user.acceptedTermsVersion,
    currentTermsVersion: settings.wholesaleTermsVersion,
    mayBid: !problem,
    bidBlockedReason: problem?.message ?? null,
    overdueInvoices: overdue,
    documents: c.documents.map((d) => ({ id: d.id, type: d.type, status: d.status, state: d.state, expiresOn: d.expiresOn, reviewNote: d.reviewNote, fileUrl: fileUrl(d.fileId), createdAt: d.createdAt })),
    messages: c.messages.map((m2) => ({ id: m2.id, body: m2.body, fromStaff: m2.fromStaff, author: m2.fromStaff ? settings.businessName : m2.author?.name ?? "", createdAt: m2.createdAt })),
    users: c.users,
    me: { id: user.id, name: user.name, email: user.email, buyerRole: user.buyerRole }
  };
}
async function buyerLots(context, args = {}) {
  const { companyId } = await requireBuyer(context);
  await advanceLotClock(context);
  const where = {};
  if (args.category) where.category = { slug: str(args.category, 120) };
  if (args.format && ["sealed_bid", "open_auction", "fixed_price"].includes(args.format)) where.format = args.format;
  if (args.saleEventId) where.saleEventId = str(args.saleEventId, 60);
  if (args.closingWithinHours) where.closesAt = { lte: new Date(Date.now() + Number(args.closingWithinHours) * 36e5), gte: /* @__PURE__ */ new Date() };
  return lotCards(context, where, true, companyId);
}
async function buyerLot(context, args) {
  const { companyId, user } = await requireBuyer(context);
  const found = await context.prisma.lot.findUnique({ where: { lotNumber: str(args.lotNumber, 40) }, select: { id: true } });
  if (!found) return null;
  await advanceLotClock(context, found.id);
  const base = await publicLot(context, args);
  if (!base) return null;
  const company = await context.prisma.buyerCompany.findUnique({ where: { id: companyId } });
  const settings = await getSettings(context.prisma);
  const approved = company.status === "approved";
  const lot = await context.prisma.lot.findUnique({ where: { id: found.id }, include: { lines: { orderBy: { lineNumber: "asc" }, include: { category: { select: { name: true } } } }, addenda: { orderBy: { postedAt: "asc" } }, facility: { select: { name: true, city: true, region: true, countryCode: true } } } });
  const showManifest = approved || settings.publicLotVisibility === "full";
  const myBid = await context.prisma.bid.findFirst({ where: { lotId: lot.id, companyId, status: { in: ["active", "won", "partially_won", "lost"] } }, orderBy: { submittedAt: "desc" }, include: { lines: true } });
  let leading = null;
  if (lot.format === "open_auction" && myBid?.status === "active") {
    const active = await context.prisma.bid.findMany({ where: { lotId: lot.id, status: "active" }, select: { id: true, amountMinor: true, submittedAt: true, companyId: true } });
    leading = rankBids(active)[0]?.companyId === companyId;
  }
  const sealed = lot.format === "sealed_bid";
  const exposure = await companyExposure(context.prisma, companyId, lot.id);
  const problem = bidEligibilityProblem({ companyStatus: company.status, userActive: user.isActive, acceptedTermsVersion: user.acceptedTermsVersion, currentTermsVersion: settings.wholesaleTermsVersion, spendLimitMinor: company.spendLimitMinor, bidAmountMinor: 0, ...exposure });
  const blocked = problem?.message ?? null;
  return {
    ...base,
    facility: lot.facility ? `${lot.facility.name}, ${[lot.facility.city, lot.facility.region].filter(Boolean).join(", ")}` : "",
    dimensions: lot.dimensions,
    warrantyDays: lot.warrantyDays,
    manifestVisible: showManifest,
    lines: showManifest ? lot.lines.map((l) => ({ id: l.id, lineNumber: l.lineNumber, category: l.category?.name ?? "", manufacturer: l.manufacturer, model: l.model, partNumber: l.partNumber, description: l.description, specs: l.specs ?? {}, cosmeticGrade: l.cosmeticGrade, functionalGrade: l.functionalGrade, quantity: l.quantity, unit: l.unit, serials: Array.isArray(l.serials) ? l.serials : [], notes: l.notes })) : [],
    addenda: lot.addenda.map((a) => ({ id: a.id, body: a.body, postedAt: a.postedAt })),
    currentAmountMinor: sealed ? null : lot.currentAmountMinor,
    bidCount: sealed ? null : lot.bidCount,
    openingBidMinor: lot.openingBidMinor,
    bidIncrementMinor: lot.bidIncrementMinor,
    minimumBidMinor: lot.format === "open_auction" ? minimumOpenBid(lot) : lot.openingBidMinor ?? 0,
    fixedPriceMinor: lot.format === "fixed_price" ? lot.fixedPriceMinor : null,
    reserveMet: lot.format === "open_auction" && lot.reserveMinor != null ? (lot.currentAmountMinor ?? 0) >= lot.reserveMinor : null,
    extensionCount: lot.format === "open_auction" ? lot.extensionCount : null,
    softCloseWindowMinutes: settings.softCloseWindowMinutes,
    myBid: myBid ? { id: myBid.id, amountMinor: myBid.amountMinor, status: myBid.status, source: myBid.source, submittedAt: myBid.submittedAt, lines: myBid.lines.map((l) => ({ lotLineId: l.lotLineId, unitPriceMinor: l.unitPriceMinor, quantity: l.quantity, status: l.status })) } : null,
    leading,
    mayBid: !blocked && lot.status === "open",
    bidBlockedReason: blocked ?? (lot.status !== "open" ? lot.status === "scheduled" ? "Bidding has not opened yet." : "Bidding is closed." : null),
    termsVersionRequired: user.acceptedTermsVersion === settings.wholesaleTermsVersion ? null : settings.wholesaleTermsVersion
  };
}
async function myBids(context, args = {}) {
  const { companyId } = await requireBuyer(context);
  const groups = { active: ["active"], won: ["won", "partially_won"], lost: ["lost", "expired", "void", "withdrawn", "defaulted"] };
  const statuses = args.status && groups[args.status] ? groups[args.status] : ["active", "won", "partially_won", "lost", "expired", "void", "withdrawn", "defaulted"];
  const bids = await context.prisma.bid.findMany({ where: { companyId, status: { in: statuses } }, orderBy: { submittedAt: "desc" }, take: 200, include: { lot: { select: { lotNumber: true, title: true, status: true, format: true, closesAt: true } }, placedBy: { select: { name: true } }, lines: { select: { id: true } } } });
  return bids.map((b) => ({ id: b.id, lotNumber: b.lot.lotNumber, lotTitle: b.lot.title, lotStatus: b.lot.status, format: b.lot.format, closesAt: b.lot.closesAt, amountMinor: b.amountMinor, status: b.status, source: b.source, placedBy: b.placedBy?.name ?? "", lineCount: b.lines.length, submittedAt: b.submittedAt }));
}
function invoiceCard(i) {
  return { id: i.id, invoiceNumber: i.invoiceNumber, kind: i.kind, status: i.status, totalMinor: i.totalMinor, paidMinor: i.paidMinor, balanceMinor: Math.max(0, i.totalMinor - i.paidMinor), currencyCode: i.currencyCode, issuedAt: i.issuedAt, dueAt: i.dueAt, isOverdue: i.isOverdue };
}
async function myInvoices(context) {
  const user = context.session ? await context.prisma.user.findUnique({ where: { id: context.session.itemId }, select: { kind: true } }) : null;
  const where = user?.kind === "client" ? { clientOrganizationId: (await requireClient(context)).organizationId } : { buyerCompanyId: (await requireBuyer(context)).companyId };
  const rows = await context.prisma.invoice.findMany({ where: { ...where, status: { not: "void" } }, orderBy: { issuedAt: "desc" }, take: 200 });
  return rows.map(invoiceCard);
}
async function myInvoice(context, args) {
  const { invoice } = await invoiceForCaller(context, args.invoiceNumber);
  const full = await context.prisma.invoice.findUnique({ where: { id: invoice.id }, include: { lines: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "asc" } }, paymentSessions: { orderBy: { createdAt: "desc" }, take: 5 }, order: { select: { orderNumber: true } }, job: { select: { jobNumber: true } } } });
  const open = ["open", "partially_paid"].includes(full.status);
  const options2 = open ? await paymentOptions(context.prisma, full) : null;
  return {
    ...invoiceCard(full),
    billTo: full.billTo ?? {},
    subtotalMinor: full.subtotalMinor,
    premiumMinor: full.premiumMinor,
    taxMinor: full.taxMinor,
    freightMinor: full.freightMinor,
    feeMinor: full.feeMinor,
    otherMinor: full.otherMinor,
    refundedMinor: full.refundedMinor,
    taxExemptReason: full.taxExemptReason,
    orderNumber: full.order?.orderNumber ?? null,
    jobNumber: full.job?.jobNumber ?? null,
    lines: full.lines.map((l) => ({ id: l.id, kind: l.kind, description: l.description, quantity: Number(l.quantity), unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor })),
    payments: full.payments.map((p) => ({ id: p.id, method: p.method, amountMinor: p.amountMinor, status: p.status, bankReference: p.bankReference, paidOn: p.paidOn, rejectionReason: p.rejectionReason, createdAt: p.createdAt })),
    latestSession: serializeSession(full.paymentSessions[0]),
    // Wire instructions only while the caller has this open invoice.
    paymentOptions: options2
  };
}
function orderCard(o) {
  return { id: o.id, orderNumber: o.orderNumber, status: o.status, lotNumber: o.lot?.lotNumber ?? "", lotTitle: o.lot?.title ?? "", totalMinor: o.invoice?.totalMinor ?? null, invoiceNumber: o.invoice?.invoiceNumber ?? null, paymentDueAt: o.paymentDueAt, readyAt: o.readyAt, removalDueAt: o.removalDueAt, releasedAt: o.releasedAt, createdAt: o.createdAt };
}
async function myOrders(context) {
  const { companyId } = await requireBuyer(context);
  const rows = await context.prisma.order.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 200, include: { lot: { select: { lotNumber: true, title: true } }, invoice: { select: { invoiceNumber: true, totalMinor: true } } } });
  return rows.map(orderCard);
}
async function myOrder(context, args) {
  const { order: base } = await orderForBuyer(context, args.orderNumber);
  const o = await context.prisma.order.findUnique({ where: { id: base.id }, include: { lot: { include: { facility: true } }, invoice: { select: { invoiceNumber: true, totalMinor: true, paidMinor: true, status: true } }, lines: { orderBy: { lineNumber: "asc" } }, dockAppointment: true, claims: { select: { claimNumber: true, status: true, resolution: true, approvedAmountMinor: true } } } });
  const settings = await getSettings(context.prisma);
  const paid = ["paid", "ready_for_release", "released", "completed"].includes(o.status);
  const f = o.lot?.facility;
  return {
    ...orderCard(o),
    lines: o.lines.map((l) => ({ lineNumber: l.lineNumber, description: l.description, manufacturer: l.manufacturer, model: l.model, grade: l.grade, quantity: l.quantity, unit: l.unit, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor, serialCount: Array.isArray(l.serials) ? l.serials.length : 0 })),
    palletCount: o.palletCount,
    weight: o.weight != null ? Number(o.weight) : null,
    dimensions: o.dimensions,
    shippingTerms: o.lot?.shippingTerms ?? "",
    exportAllowed: o.lot?.exportAllowed ?? true,
    // Pickup address and instructions only once paid.
    pickup: paid && f ? { facility: f.name, addressLine1: f.addressLine1, addressLine2: f.addressLine2, city: f.city, region: f.region, postalCode: f.postalCode, countryCode: f.countryCode, phone: f.phone, hours: f.hours ?? {}, instructions: f.pickupInstructions } : null,
    release: { method: o.releaseMethod, preferredPickupDate: o.preferredPickupDate, driverName: o.driverName, carrierName: o.carrierName, carrierReference: o.carrierReference, freightPickupDate: o.freightPickupDate, destinationCountry: o.destinationCountry, exportAcknowledgedAt: o.exportAcknowledgedAt, setAt: o.releaseDetailsSetAt },
    dockAppointment: o.dockAppointment && o.dockAppointment.status !== "cancelled" ? { startsAt: o.dockAppointment.startsAt, endsAt: o.dockAppointment.endsAt, status: o.dockAppointment.status } : null,
    billOfLading: o.billOfLading,
    claimWindowEndsAt: o.claimWindowEndsAt,
    claims: o.claims,
    exportClause: settings.exportClause,
    documentsAvailable: paid,
    invoiceStatus: o.invoice?.status ?? null
  };
}
var CLIENT_STAGES = ["requested", "quoted", "accepted", "scheduled", "en_route", "collected", "received", "processing", "completed", "settled", "closed"];
function jobCard(j) {
  return { id: j.id, jobNumber: j.jobNumber, type: j.type, status: j.status, scheduledDate: j.scheduledDate, windowStart: j.windowStart, windowEnd: j.windowEnd, collectedAt: j.collectedAt, completedAt: j.completedAt, createdAt: j.createdAt, site: j.siteAddress ? [j.siteAddress.addressLine1, j.siteAddress.city].filter(Boolean).join(", ") : "" };
}
async function myJobs(context) {
  const { organizationId } = await requireClient(context);
  const org = await context.prisma.clientOrganization.findUnique({ where: { id: organizationId }, include: { sites: { orderBy: { name: "asc" } } } });
  const jobs = await context.prisma.job.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 200 });
  return { organization: { id: org.id, name: org.name, status: org.status }, sites: org.sites.map((s) => ({ id: s.id, name: s.name, addressLine1: s.addressLine1, city: s.city, postalCode: s.postalCode })), jobs: jobs.map(jobCard) };
}
async function myJob(context, args) {
  const { organizationId, user } = await requireClient(context);
  const j = await context.prisma.job.findUnique({ where: { jobNumber: str(args.jobNumber, 40) }, include: { serviceLines: true, estimateLines: { include: { category: { select: { name: true } } } }, containers: { orderBy: { label: "asc" } }, custodyEvents: { orderBy: { occurredAt: "asc" }, include: { container: { select: { label: true } }, facility: { select: { name: true } }, actor: { select: { name: true } } } }, certificates: { orderBy: { issuedAt: "desc" } }, settlement: true, driver: { select: { name: true } }, assets: { select: { isDataBearing: true, sanitizationStatus: true, disposition: true, weight: true } } } });
  if (!j || j.organizationId !== organizationId) fail("Job not found.");
  const settings = await getSettings(context.prisma);
  const showSettlement = j.settlement && ["published", "disputed", "paid", "closed"].includes(j.settlement.status);
  const assets = j.assets;
  return {
    ...jobCard(j),
    stages: CLIENT_STAGES,
    contactName: j.contactName,
    requestedDates: j.requestedDates ?? [],
    servicesRequested: j.servicesRequested ?? [],
    estimate: j.estimateLines.map((l) => ({ category: l.category?.name ?? "", quantity: l.quantity, unit: l.unit, notes: l.notes })),
    quote: j.quoteSentAt ? { sentAt: j.quoteSentAt, pricingModel: j.pricingModel, revenueShareBps: j.revenueShareBps, buyoutAmountMinor: j.buyoutAmountMinor, lines: j.serviceLines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor })), totalMinor: j.serviceLines.reduce((s, l) => s + (l.totalMinor ?? 0), 0), acceptedAt: j.quoteAcceptedAt, signatureName: j.quoteSignatureName, termsVersion: settings.serviceTermsVersion, terms: richText(settings.serviceTerms), canRespond: j.status === "quoted" && user.clientRole === "admin" } : null,
    declineReason: j.declineReason,
    cancelReason: j.cancelReason,
    driver: j.driver?.name ?? "",
    vehicle: j.vehicle,
    clientSignerName: j.clientSignerName,
    containers: j.containers.map((c) => ({ label: c.label, type: c.type, sealNumber: c.sealNumber, sealVerified: c.sealVerified, grossWeight: c.grossWeight != null ? Number(c.grossWeight) : null, tareWeight: c.tareWeight != null ? Number(c.tareWeight) : null, status: c.status })),
    custody: j.custodyEvents.map((e) => ({ type: e.type, occurredAt: e.occurredAt, container: e.container?.label ?? "", facility: e.facility?.name ?? "", actor: e.actor?.name || e.actorName, signerName: e.signerName, location: e.locationText, notes: e.notes })),
    summary: { assets: assets.length, dataBearing: assets.filter((a) => a.isDataBearing).length, sanitized: assets.filter((a) => ["passed", "destroyed"].includes(a.sanitizationStatus)).length, reused: assets.filter((a) => ["resale", "parts"].includes(a.disposition)).length, recycled: assets.filter((a) => a.disposition === "recycle").length },
    certificates: j.certificates.map((c) => ({ certificateNumber: c.certificateNumber, type: c.type, status: c.status, issuedAt: c.issuedAt, verificationCode: c.verificationCode, revokedReason: c.revokedReason })),
    settlement: showSettlement ? { settlementNumber: j.settlement.settlementNumber, status: j.settlement.status, feesTotalMinor: j.settlement.feesTotalMinor, clientShareTotalMinor: j.settlement.clientShareTotalMinor, netMinor: j.settlement.netMinor, publishedAt: j.settlement.publishedAt, paidAt: j.settlement.paidAt, payoutMethod: j.settlement.payoutMethod } : null
  };
}

// features/keystone/domain/reports.ts
function range(args) {
  const to = args.to ? /* @__PURE__ */ new Date(`${str(args.to, 10)}T23:59:59.999Z`) : /* @__PURE__ */ new Date();
  const from = args.from ? /* @__PURE__ */ new Date(`${str(args.from, 10)}T00:00:00Z`) : new Date(to.getTime() - 30 * 864e5);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) fail("Choose a valid date range.");
  return { from, to };
}
var num = (v) => v == null ? 0 : Number(v);
async function massBalanceReport(context, args) {
  const { from, to } = range(args);
  const settings = await getSettings(context.prisma);
  const jobWhere = { receivedAt: { gte: from, lte: to } };
  if (args.facilityId) jobWhere.facilityId = args.facilityId;
  const containers = await context.prisma.container.findMany({ where: { status: { in: ["received", "processed"] }, job: jobWhere }, select: { grossWeight: true, tareWeight: true } });
  const inWeight = containers.reduce((s, c) => s + Math.max(0, num(c.grossWeight) - num(c.tareWeight)), 0);
  const shipments = await context.prisma.outboundShipment.findMany({ where: { status: { in: ["shipped", "receipt_confirmed", "closed"] }, shippedAt: { gte: from, lte: to }, ...args.facilityId ? { facilityId: args.facilityId } : {} }, include: { vendor: { select: { name: true } }, lines: { include: { category: { select: { name: true } } } } } });
  const byCategory = /* @__PURE__ */ new Map();
  const bucket = (k) => byCategory.get(k) ?? byCategory.set(k, { category: k, downstream: 0, resale: 0, returned: 0 }).get(k);
  for (const s of shipments) for (const l of s.lines) bucket(l.category?.name ?? "Mixed").downstream += num(l.weight);
  const sold = await context.prisma.asset.findMany({ where: { status: { in: ["sold", "released", "returned"] }, updatedAt: { gte: from, lte: to }, ...args.facilityId ? { job: { facilityId: args.facilityId } } : {} }, select: { status: true, weight: true, category: { select: { name: true } } } });
  for (const a of sold) {
    const b = bucket(a.category?.name ?? "Mixed");
    if (a.status === "returned") b.returned += num(a.weight);
    else b.resale += num(a.weight);
  }
  const rows = [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category));
  const outWeight = rows.reduce((s, r) => s + r.downstream + r.resale + r.returned, 0);
  const onHand = await context.prisma.asset.aggregate({ where: { status: { in: ["received", "audited", "ready_for_sale", "allocated", "recycling", "on_hold"] } }, _sum: { weight: true } });
  const vendors = shipments.reduce((m2, s) => ({ ...m2, [s.vendor?.name ?? ""]: (m2[s.vendor?.name ?? ""] ?? 0) + s.lines.reduce((x, l) => x + num(l.weight), 0) }), {});
  const confirmed = shipments.filter((s) => s.receiptConfirmedAt);
  const result = {
    from,
    to,
    unit: settings.weightUnit,
    inWeight,
    outWeight,
    onHandWeight: num(onHand._sum.weight),
    varianceWeight: inWeight - outWeight - num(onHand._sum.weight),
    rows,
    vendors: Object.entries(vendors).map(([name, weight]) => ({ name, weight })),
    shipments: shipments.length,
    receiptsConfirmed: confirmed.length,
    receiptVarianceWeight: confirmed.reduce((s, x) => s + num(x.receivedWeight) - x.lines.reduce((y, l) => y + num(l.weight), 0), 0)
  };
  if (args.format === "xlsx") {
    return { ...result, download: asDownload(`mass-balance-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.xlsx`, XLSX_MIME, writeWorkbook([
      { name: "Summary", rows: [["From", from.toISOString().slice(0, 10)], ["To", to.toISOString().slice(0, 10)], ["Unit", settings.weightUnit], ["Weight in", inWeight], ["Weight out", outWeight], ["On hand", result.onHandWeight], ["Variance", result.varianceWeight]] },
      { name: "By category", rows: [["Category", "Downstream", "Resale", "Returned"], ...rows.map((r) => [r.category, r.downstream, r.resale, r.returned])] },
      { name: "By vendor", rows: [["Vendor", "Weight"], ...result.vendors.map((v) => [v.name, v.weight])] }
    ])) };
  }
  return { ...result, download: null };
}
async function salesReport(context, args) {
  const { from, to } = range(args);
  const settings = await getSettings(context.prisma);
  const awards = await context.prisma.award.findMany({ where: { status: "active", awardedAt: { gte: from, lte: to } }, include: { lot: { select: { lotNumber: true, title: true, format: true, reserveMinor: true, category: { select: { name: true } } } }, company: { select: { legalName: true } }, order: { select: { orderNumber: true, status: true, invoice: { select: { invoiceNumber: true, totalMinor: true, paidMinor: true, status: true } } } } }, orderBy: { awardedAt: "asc" } });
  const rows = awards.map((a) => ({ awardedAt: a.awardedAt, lotNumber: a.lot.lotNumber, title: a.lot.title, category: a.lot.category?.name ?? "", format: a.lot.format, buyer: a.company.legalName, amountMinor: a.amountMinor, belowReserve: a.isBelowReserve, orderNumber: a.order?.orderNumber ?? "", orderStatus: a.order?.status ?? "", invoiceNumber: a.order?.invoice?.invoiceNumber ?? "", invoiceTotalMinor: a.order?.invoice?.totalMinor ?? 0, paidMinor: a.order?.invoice?.paidMinor ?? 0 }));
  const sum = (key) => Object.values(rows.reduce((m2, r) => ({ ...m2, [r[key]]: { name: r[key], lots: (m2[r[key]]?.lots ?? 0) + 1, amountMinor: (m2[r[key]]?.amountMinor ?? 0) + r.amountMinor } }), {}));
  const defaults = await context.prisma.order.count({ where: { status: "defaulted", updatedAt: { gte: from, lte: to } } });
  const result = { from, to, currencyCode: settings.currencyCode, lots: rows.length, grossMinor: rows.reduce((s, r) => s + r.amountMinor, 0), invoicedMinor: rows.reduce((s, r) => s + r.invoiceTotalMinor, 0), collectedMinor: rows.reduce((s, r) => s + r.paidMinor, 0), defaults, byCategory: sum("category"), byBuyer: sum("buyer"), rows };
  if (args.format === "xlsx") {
    return { ...result, download: asDownload(`sales-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.xlsx`, XLSX_MIME, writeWorkbook([
      { name: "Sales", rows: [["Awarded", "Lot", "Title", "Category", "Format", "Buyer", "Award", "Below reserve", "Order", "Order status", "Invoice", "Invoice total", "Paid"], ...rows.map((r) => [new Date(r.awardedAt).toISOString().slice(0, 10), r.lotNumber, r.title, r.category, r.format, r.buyer, r.amountMinor / 100, r.belowReserve ? "Yes" : "", r.orderNumber, r.orderStatus, r.invoiceNumber, r.invoiceTotalMinor / 100, r.paidMinor / 100])] },
      { name: "By category", rows: [["Category", "Lots", "Amount"], ...result.byCategory.map((c) => [c.name, c.lots, c.amountMinor / 100])] },
      { name: "By buyer", rows: [["Buyer", "Lots", "Amount"], ...result.byBuyer.map((c) => [c.name, c.lots, c.amountMinor / 100])] }
    ])) };
  }
  return { ...result, download: null };
}
async function clientImpactReport(context, args) {
  const { from, to } = range({ from: args.from ?? "2000-01-01", to: args.to });
  const org = await context.prisma.clientOrganization.findUnique({ where: { id: str(args.organizationId, 60) } });
  if (!org) fail("Choose the client.");
  const settings = await getSettings(context.prisma);
  const jobs = await context.prisma.job.findMany({ where: { organizationId: org.id, collectedAt: { gte: from, lte: to } }, include: { containers: { select: { grossWeight: true, tareWeight: true, status: true } }, assets: { select: { disposition: true, status: true, weight: true, isDataBearing: true, sanitizationStatus: true } }, commodityLines: { select: { weight: true } } } });
  const collected = jobs.reduce((s, j) => s + j.containers.filter((c) => c.status !== "missing").reduce((x, c) => x + Math.max(0, num(c.grossWeight) - num(c.tareWeight)), 0), 0);
  const assets = jobs.flatMap((j) => j.assets);
  const reusedUnits = assets.filter((a) => ["resale", "parts"].includes(a.disposition)).length;
  const reusedWeight = assets.filter((a) => ["resale", "parts"].includes(a.disposition)).reduce((s, a) => s + num(a.weight), 0);
  const recycledWeight = assets.filter((a) => a.disposition === "recycle").reduce((s, a) => s + num(a.weight), 0) + jobs.reduce((s, j) => s + j.commodityLines.reduce((x, l) => x + num(l.weight), 0), 0);
  const result = { organization: org.name, from, to, unit: settings.weightUnit, jobs: jobs.length, collectedWeight: collected, units: assets.length, reusedUnits, reusedWeight, recycledWeight, dataBearing: assets.filter((a) => a.isDataBearing).length, sanitized: assets.filter((a) => ["passed", "destroyed"].includes(a.sanitizationStatus)).length, landfillWeight: 0 };
  const name = `${org.name.replace(/[^A-Za-z0-9]+/g, "-")}-impact`;
  if (args.format === "xlsx") return { ...result, download: asDownload(`${name}.xlsx`, XLSX_MIME, writeWorkbook([{ name: "Impact", rows: [["Client", org.name], ["Period", `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`], ["Jobs", result.jobs], [`Weight collected (${settings.weightUnit})`, collected], ["Units processed", result.units], ["Units reused", reusedUnits], [`Weight reused (${settings.weightUnit})`, reusedWeight], [`Weight recycled (${settings.weightUnit})`, recycledWeight], ["Data-bearing devices", result.dataBearing], ["Devices sanitised", result.sanitized], ["Sent to landfill", 0]] }])) };
  if (args.format === "pdf") {
    const pdf = await renderPdf({ header: settings.businessName, headerRight: "Impact report", footer: settings.businessName, blocks: [
      { kind: "title", text: `Environmental impact: ${org.name}` },
      { kind: "subtitle", text: `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}` },
      { kind: "pairs", pairs: [["Jobs", String(result.jobs)], ["Weight collected", `${collected.toFixed(1)} ${settings.weightUnit}`], ["Units processed", String(result.units)], ["Units reused", String(reusedUnits)], ["Weight reused", `${reusedWeight.toFixed(1)} ${settings.weightUnit}`], ["Weight recycled", `${recycledWeight.toFixed(1)} ${settings.weightUnit}`], ["Data-bearing devices sanitised", `${result.sanitized} of ${result.dataBearing}`], ["Sent to landfill", `0 ${settings.weightUnit}`]] },
      { kind: "text", text: "Figures come from the weights recorded at receiving and on the audit bench, and from outbound shipments to approved downstream vendors." }
    ] });
    return { ...result, download: asDownload(`${name}.pdf`, "application/pdf", pdf) };
  }
  return { ...result, download: null };
}
async function accountingExport(context, args) {
  const { from, to } = range(args);
  const what = ["invoices", "payments", "refunds"].includes(String(args.kind)) ? String(args.kind) : "invoices";
  if (what === "invoices") {
    const rows2 = await context.prisma.invoice.findMany({ where: { issuedAt: { gte: from, lte: to } }, include: { buyerCompany: { select: { legalName: true } }, clientOrganization: { select: { name: true } }, lines: true }, orderBy: { issuedAt: "asc" } });
    const out = [["InvoiceNo", "Customer", "InvoiceDate", "DueDate", "Kind", "Status", "ItemDescription", "ItemKind", "ItemQuantity", "ItemRate", "ItemAmount", "Currency"]];
    for (const i of rows2) for (const l of i.lines) out.push([i.invoiceNumber, i.buyerCompany?.legalName ?? i.clientOrganization?.name ?? "", i.issuedAt?.toISOString().slice(0, 10), i.dueAt?.toISOString().slice(0, 10) ?? "", i.kind, i.status, l.description, l.kind, Number(l.quantity), (l.unitPriceMinor / 100).toFixed(2), (l.totalMinor / 100).toFixed(2), i.currencyCode]);
    return asDownload(`invoices-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`, "text/csv", writeCsv(out));
  }
  if (what === "payments") {
    const rows2 = await context.prisma.payment.findMany({ where: { status: { in: ["confirmed", "captured", "refunded", "partially_refunded"] }, OR: [{ confirmedAt: { gte: from, lte: to } }, { AND: [{ confirmedAt: null }, { createdAt: { gte: from, lte: to } }] }] }, include: { invoice: { select: { invoiceNumber: true, currencyCode: true, buyerCompany: { select: { legalName: true } }, clientOrganization: { select: { name: true } } } } }, orderBy: { createdAt: "asc" } });
    return asDownload(`payments-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`, "text/csv", writeCsv([["Date", "InvoiceNo", "Customer", "Method", "Reference", "Amount", "Refunded", "Currency"], ...rows2.map((p) => [(p.confirmedAt ?? p.createdAt).toISOString().slice(0, 10), p.invoice?.invoiceNumber ?? "", p.invoice?.buyerCompany?.legalName ?? p.invoice?.clientOrganization?.name ?? "", p.method, p.providerReference || p.bankReference, (p.amountMinor / 100).toFixed(2), (p.refundedMinor / 100).toFixed(2), p.invoice?.currencyCode ?? "USD"])]));
  }
  const rows = await context.prisma.refund.findMany({ where: { status: "succeeded", createdAt: { gte: from, lte: to } }, include: { invoice: { select: { invoiceNumber: true } } }, orderBy: { createdAt: "asc" } });
  return asDownload(`refunds-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`, "text/csv", writeCsv([["Date", "InvoiceNo", "Method", "Reference", "Amount", "Reason"], ...rows.map((r) => [r.createdAt.toISOString().slice(0, 10), r.invoice?.invoiceNumber ?? "", r.method, r.providerReference, (r.amountMinor / 100).toFixed(2), r.reason])]));
}
async function todaySummary(context) {
  const role = context.session?.data?.role ?? {};
  const p = context.prisma;
  const now = /* @__PURE__ */ new Date();
  const in24 = new Date(now.getTime() + 864e5);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  const out = {};
  const tasks = [];
  const add = (key, label, count, href) => {
    if (count) tasks.push({ key, label, count, href });
  };
  if (role.canManageBuyers) add("buyers", "Buyer applications to review", await p.buyerCompany.count({ where: { status: { in: ["submitted", "under_review"] } } }), "/dashboard/platform/buyers");
  if (role.canManageBuyers) add("documents", "Buyer documents to check", await p.buyerDocument.count({ where: { status: "submitted" } }), "/dashboard/platform/buyers?tab=documents");
  if (role.canAwardLots) add("award", "Closed lots to award", await p.lot.count({ where: { status: "closed" } }), "/dashboard/platform/lots?status=closed");
  if (role.canManageLots) add("closing", "Lots closing in 24 hours", await p.lot.count({ where: { status: "open", closesAt: { lte: in24 } } }), "/dashboard/platform/lots?status=open");
  if (role.canManageLots) add("unsold", "Unsold lots to relist", await p.lot.count({ where: { status: "unsold" } }), "/dashboard/platform/lots?status=unsold");
  if (role.canManagePayments) add("transfers", "Reported transfers to confirm", await p.payment.count({ where: { status: "reported" } }), "/dashboard/platform/payments");
  if (role.canManagePayments) add("unknown", "Card payments with an unknown result", await p.paymentSession.count({ where: { status: "unknown" } }), "/dashboard/platform/payments?tab=unknown");
  if (role.canManagePayments) add("overdue", "Overdue invoices", await p.invoice.count({ where: { isOverdue: true, status: { in: ["open", "partially_paid"] } } }), "/dashboard/platform/invoices?tab=overdue");
  if (role.canManageLots || role.canReceive) add("ready", "Paid orders to prepare", await p.order.count({ where: { status: "paid" } }), "/dashboard/platform/orders?status=paid");
  if (role.canManageLots || role.canReceive) add("dock", "Dock appointments today", await p.dockAppointment.count({ where: { status: "booked", startsAt: { gte: dayStart, lt: dayEnd } } }), "/dashboard/platform/dock");
  if (role.canManageLots) add("claims", "Open claims", await p.claim.count({ where: { status: { in: ["submitted", "under_review"] } } }), "/dashboard/platform/claims");
  if (role.canManageJobs) add("requests", "Pickup requests to quote", await p.job.count({ where: { status: "requested" } }), "/dashboard/platform/jobs?status=requested");
  if (role.canDispatch) add("dispatch", "Accepted jobs to schedule", await p.job.count({ where: { status: "accepted" } }), "/dashboard/platform/dispatch");
  if (role.canCollect) add("stops", "My stops today", await p.job.count({ where: { driverId: context.session?.itemId, status: { in: ["scheduled", "en_route"] }, scheduledDate: { lte: dayEnd } } }), "/dashboard/platform/driver");
  if (role.canReceive) add("inbound", "Containers to receive", await p.container.count({ where: { status: "collected", job: { status: "collected" } } }), "/dashboard/platform/receiving");
  if (role.canReceive || role.canIssueCertificates) add("seals", "Seal exceptions", await p.container.count({ where: { sealException: { not: "" }, sealExceptionResolution: "" } }), "/dashboard/platform/receiving?tab=exceptions");
  if (role.canSanitize) add("sanitize", "Data-bearing assets awaiting sanitisation", await p.asset.count({ where: { isDataBearing: true, sanitizationStatus: { in: ["pending", "failed"] }, status: { not: "on_hold" } } }), "/dashboard/platform/sanitization");
  if (role.canVerifySanitization) add("verify", "Sanitisation records not yet sampled", await p.sanitizationRecord.count({ where: { verifiedById: null, result: "passed" } }), "/dashboard/platform/sanitization?tab=verify");
  if (role.canIssueCertificates) add("complete", "Jobs in processing", await p.job.count({ where: { status: "processing" } }), "/dashboard/platform/jobs?status=processing");
  if (role.canManageSettlements) add("settle", "Completed jobs to settle", await p.job.count({ where: { status: "completed", OR: [{ settlementId: null }, { settlement: { status: { in: ["draft", "in_review", "disputed"] } } }] } }), "/dashboard/platform/settlements");
  if (role.canManageDownstream) add("vendors", "Vendor reviews due", await p.downstreamVendor.count({ where: { status: "approved", reviewDueOn: { lte: in24 } } }), "/dashboard/platform/downstream");
  if (role.canManageDownstream) add("receipts", "Outbound receipts to confirm", await p.outboundShipment.count({ where: { status: "shipped" } }), "/dashboard/platform/outbound");
  out.tasks = tasks;
  if (role.canManageLots || role.canAwardLots) {
    out.closingSoon = (await p.lot.findMany({ where: { status: "open" }, orderBy: { closesAt: "asc" }, take: 6, select: { id: true, lotNumber: true, title: true, closesAt: true, format: true, bidCount: true } })).map((l) => ({ ...l, bidCount: l.bidCount }));
  }
  if (role.canManagePayments || role.canViewReports) {
    const paid = await p.payment.aggregate({ where: { status: { in: ["confirmed", "captured"] }, createdAt: { gte: dayStart } }, _sum: { amountMinor: true } });
    out.collectedTodayMinor = paid._sum.amountMinor ?? 0;
  }
  return out;
}

// features/keystone/domain/sheets.ts
var XLSX2 = __toESM(require("xlsx"));
async function importById(db, id) {
  const row = await db.manifestImport.findUnique({ where: { id: str(id, 60) } });
  if (!row) fail("Import not found.");
  return row;
}
async function uploadManifest(context, args) {
  const decoded = decodeUpload(args.file);
  if (!decoded) fail("Choose a spreadsheet.");
  const sheet = readWorkbook(decoded.bytes);
  const headerRow = detectHeaderRow(sheet.rows);
  const headers = (sheet.rows[headerRow] ?? []).map((h) => String(h ?? "").trim());
  const purpose = args.purpose === "asset_import" ? "asset_import" : "lot_manifest";
  const saved = await context.prisma.manifestMapping.findMany({ orderBy: { updatedAt: "desc" }, take: 20 });
  const signature = headers.map((h) => h.toLowerCase()).join("|");
  const remembered = saved.find((m2) => m2.mapping?.signature === signature);
  const mapping = remembered ? remembered.mapping.columns : proposeMapping(headers);
  return inTransaction(context, async (tx) => {
    const file = await storeFile(tx, { ...decoded, purpose: "manifest_import", uploadedById: context.session.itemId });
    return tx.manifestImport.create({
      data: { fileId: file.id, originalFilename: decoded.filename, status: "uploaded", sheetName: sheet.sheetName, sheetNames: sheet.sheetNames, headerRow, headers, mapping, rowCount: Math.max(0, sheet.rows.length - headerRow - 1), purpose, targetJobId: args.targetJobId || null, uploadedById: context.session.itemId }
    });
  });
}
async function mapManifest(context, args) {
  const imp = await importById(context.prisma, args.importId);
  if (["committed", "discarded"].includes(imp.status)) fail(`This import is ${imp.status}.`);
  const file = await readFileBytes(context.prisma, imp.fileId);
  if (!file) fail("The uploaded file is missing.");
  const sheet = readWorkbook(file.bytes, args.sheetName ?? imp.sheetName);
  const headerRow = args.headerRow != null ? Math.max(0, Math.min(sheet.rows.length - 1, Math.round(args.headerRow))) : sheet.sheetName !== imp.sheetName ? detectHeaderRow(sheet.rows) : imp.headerRow;
  const headers = (sheet.rows[headerRow] ?? []).map((h) => String(h ?? "").trim());
  const mapping = {};
  for (const [field, index] of Object.entries(args.mapping || {})) {
    if (!(field in MANIFEST_FIELDS)) continue;
    const i = Math.round(Number(index));
    if (Number.isInteger(i) && i >= 0 && i < headers.length) mapping[field] = i;
  }
  if (!("description" in mapping) && !("model" in mapping) && !("manufacturer" in mapping)) fail("Map at least a description, model or manufacturer column.");
  if (str(args.saveAs, 120)) {
    await context.prisma.manifestMapping.create({ data: { name: str(args.saveAs, 120), mapping: { signature: headers.map((h) => h.toLowerCase()).join("|"), columns: mapping } } });
  }
  return context.prisma.manifestImport.update({ where: { id: imp.id }, data: { status: "mapped", sheetName: sheet.sheetName, headerRow, headers, mapping, rowCount: Math.max(0, sheet.rows.length - headerRow - 1), rows: [], validCount: null, errorCount: null } });
}
async function validateManifest(context, args) {
  const imp = await importById(context.prisma, args.importId);
  if (!["uploaded", "mapped", "validated"].includes(imp.status)) fail(`This import is ${imp.status}.`);
  const file = await readFileBytes(context.prisma, imp.fileId);
  if (!file) fail("The uploaded file is missing.");
  const sheet = readWorkbook(file.bytes, imp.sheetName);
  const headerRow = imp.headerRow ?? 0;
  const headers = sheet.rows[headerRow] ?? [];
  const rows = applyManifestMapping(headers, sheet.rows.slice(headerRow + 1), imp.mapping ?? {}, headerRow + 2);
  if (!rows.length) fail("The sheet has no data rows under the header.");
  if (rows.length > STORED_ROW_CAP) fail(`A manifest can have at most ${STORED_ROW_CAP.toLocaleString()} lines. Split the file.`);
  const valid = rows.filter((r) => r.valid).length;
  return context.prisma.manifestImport.update({ where: { id: imp.id }, data: { status: "validated", rows, rowCount: rows.length, validCount: valid, errorCount: rows.length - valid } });
}
async function commitManifest(context, args) {
  const staffId = context.session.itemId;
  return inTransaction(context, async (tx) => {
    await lockRow(tx, "ManifestImport", args.importId) || fail("Import not found.");
    const imp = await tx.manifestImport.findUnique({ where: { id: args.importId } });
    if (imp.status !== "validated") fail(imp.status === "committed" ? "This import was already committed." : "Validate the import first.");
    const rows = imp.rows ?? [];
    const invalid = rows.filter((r) => !r.valid).length;
    if (invalid && !args.skipInvalid) fail(`${invalid} row${invalid === 1 ? " has" : "s have"} errors. Fix the file, or choose to skip them.`);
    const good = rows.filter((r) => r.valid);
    if (!good.length) fail("There are no valid rows to commit.");
    const categories = await tx.materialCategory.findMany({ select: { id: true, name: true, slug: true } });
    const categoryFor = (name) => {
      const n2 = name.trim().toLowerCase();
      return n2 ? categories.find((c) => c.name.toLowerCase() === n2 || c.slug === n2 || c.name.toLowerCase().replace(/s$/, "") === n2.replace(/s$/, ""))?.id ?? null : null;
    };
    if (imp.purpose === "asset_import") {
      if (!imp.targetJobId) fail("Choose the job these assets belong to.");
      const job = await tx.job.findUnique({ where: { id: imp.targetJobId } });
      if (!job) fail("Job not found.");
      let created = 0;
      for (const r of good) {
        const serials = r.line.serials.length ? r.line.serials : Array(r.line.quantity).fill("");
        for (const serial of serials) {
          const categoryId = categoryFor(r.line.category) || args.categoryId || null;
          const cat = categoryId ? categories.find((c) => c.id === categoryId) : null;
          const dataBearing = cat ? (await tx.materialCategory.findUnique({ where: { id: categoryId }, select: { dataBearingDefault: true } })).dataBearingDefault : false;
          await tx.asset.create({ data: { assetNumber: await nextNumber(tx, "asset"), jobId: job.id, organizationId: job.organizationId, categoryId, manufacturer: r.line.manufacturer, model: r.line.model, partNumber: r.line.partNumber, serialNumber: serial, clientAssetTag: r.line.extra?.["Asset Tag"] ?? "", specs: r.line.specs, isDataBearing: dataBearing, status: "received", sanitizationStatus: dataBearing ? "pending" : "not_required", testNotes: r.line.notes } });
          created++;
        }
      }
      await tx.manifestImport.update({ where: { id: imp.id }, data: { status: "committed" } });
      await audit(tx, { actorId: staffId, action: "assets.imported", entityType: "Job", entityId: job.id, after: { created, importId: imp.id } });
      return { importId: imp.id, lotId: null, lotNumber: null, created };
    }
    let lot;
    if (args.lotId) {
      await lockRow(tx, "Lot", args.lotId) || fail("Lot not found.");
      lot = await tx.lot.findUnique({ where: { id: args.lotId } });
      if (lot.status !== "draft") fail("Manifest lines can only be added to a draft lot.");
    } else {
      const settings = await getSettings(tx);
      const title = str(args.newLotTitle, 200) || imp.originalFilename.replace(/\.[^.]+$/, "");
      lot = await tx.lot.create({ data: { lotNumber: await nextNumber(tx, "lot"), title, slug: "", status: "draft", format: settings.defaultBidFormat, bidBasis: settings.defaultBidBasis, awardMode: settings.defaultAwardMode, saleEventId: args.saleEventId || null, categoryId: args.categoryId || null, sourceImportId: imp.id, description: [{ type: "paragraph", children: [{ text: "" }] }] } });
    }
    const last = await tx.lotLine.findFirst({ where: { lotId: lot.id }, orderBy: { lineNumber: "desc" }, select: { lineNumber: true } });
    let n = last?.lineNumber ?? 0;
    for (const r of good) {
      await tx.lotLine.create({ data: { lotId: lot.id, lineNumber: ++n, categoryId: categoryFor(r.line.category), manufacturer: r.line.manufacturer, model: r.line.model, partNumber: r.line.partNumber, description: r.line.description, specs: r.line.specs, cosmeticGrade: r.line.cosmeticGrade, functionalGrade: r.line.functionalGrade, quantity: r.line.quantity, unit: r.line.unit, serials: r.line.serials, notes: r.line.notes, extra: r.line.extra } });
    }
    await tx.manifestImport.update({ where: { id: imp.id }, data: { status: "committed" } });
    await audit(tx, { actorId: staffId, action: "manifest.committed", entityType: "Lot", entityId: lot.id, after: { lines: good.length, skipped: invalid, importId: imp.id } });
    return { importId: imp.id, lotId: lot.id, lotNumber: lot.lotNumber, created: good.length };
  });
}
async function discardManifest(context, args) {
  const imp = await importById(context.prisma, args.importId);
  if (imp.status === "committed") fail("A committed import cannot be discarded.");
  return context.prisma.manifestImport.update({ where: { id: imp.id }, data: { status: "discarded" } });
}
async function importAssets(context, args) {
  const job = await context.prisma.job.findUnique({ where: { id: str(args.jobId, 60) } });
  if (!job) fail("Choose the job these assets belong to.");
  return uploadManifest(context, { file: args.file, purpose: "asset_import", targetJobId: job.id });
}
function manifestRows(lines) {
  const specKeys = [...new Set(lines.flatMap((l) => Object.keys(l.specs ?? {})))];
  const extraKeys = [...new Set(lines.flatMap((l) => Object.keys(l.extra ?? {})))];
  const header = ["Line", "Category", "Manufacturer", "Model", "Part number", "Description", ...specKeys, "Cosmetic grade", "Functional grade", "Quantity", "Unit", "Serials", "Notes", ...extraKeys];
  const rows = lines.map((l) => [l.lineNumber, l.category?.name ?? "", l.manufacturer, l.model, l.partNumber, l.description, ...specKeys.map((k) => l.specs?.[k] ?? ""), l.cosmeticGrade, l.functionalGrade, l.quantity, l.unit, (Array.isArray(l.serials) ? l.serials : []).join(", "), l.notes, ...extraKeys.map((k) => l.extra?.[k] ?? "")]);
  return { header, rows };
}
async function lotForBuyerDownload(context, lotNumber) {
  const { companyId } = await requireBuyer(context);
  const company = await context.prisma.buyerCompany.findUnique({ where: { id: companyId }, select: { status: true } });
  const settings = await getSettings(context.prisma);
  if (company.status !== "approved" && settings.publicLotVisibility !== "full") fail("Your company must be approved to see manifests.");
  const lot = await context.prisma.lot.findUnique({ where: { lotNumber: str(lotNumber, 40) }, include: { lines: { orderBy: { lineNumber: "asc" }, include: { category: { select: { name: true } } } } } });
  if (!lot || !["scheduled", "open", "closed", "awarded", "completed"].includes(lot.status)) fail("Lot not found.");
  return { lot, companyId };
}
async function downloadLotManifest(context, args) {
  const { lot } = await lotForBuyerDownload(context, args.lotNumber);
  const { header, rows } = manifestRows(lot.lines);
  const bytes = writeWorkbook([{ name: "Manifest", rows: [[`${lot.lotNumber}: ${lot.title}`], [], header, ...rows] }]);
  return asDownload(`${lot.lotNumber}-manifest.xlsx`, XLSX_MIME, bytes);
}
async function staffLotManifest(context, args) {
  const lot = await context.prisma.lot.findUnique({ where: { id: str(args.lotId, 60) }, include: { lines: { orderBy: { lineNumber: "asc" }, include: { category: { select: { name: true } } } } } });
  if (!lot) fail("Lot not found.");
  const { header, rows } = manifestRows(lot.lines);
  return asDownload(`${lot.lotNumber}-manifest.xlsx`, XLSX_MIME, writeWorkbook([{ name: "Manifest", rows: [header, ...rows] }]));
}
function bidSheetRows(lot) {
  const header = ["Line ID (do not edit)", "Line", "Manufacturer", "Model", "Description", "Grade", "Quantity", "Unit price (USD)", "Line total"];
  const rows = lot.lines.map((l, i) => [l.id, l.lineNumber, l.manufacturer, l.model, l.description, [l.cosmeticGrade, l.functionalGrade].filter(Boolean).join(" / "), l.quantity, "", { f: `G${i + 4}*H${i + 4}` }]);
  return [[`${lot.lotNumber}: ${lot.title}. Enter a unit price per line you want; leave the others empty.`], [], header, ...rows];
}
async function downloadBidSheet(context, args) {
  const { lot } = await lotForBuyerDownload(context, args.lotNumber);
  if (lot.bidBasis !== "per_line") fail("This lot is bid as a whole; enter one amount.");
  const rows = bidSheetRows(lot);
  const ws = XLSX2.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 6 }, { wch: 14 }, { wch: 18 }, { wch: 40 }, { wch: 12 }, { wch: 9 }, { wch: 16 }, { wch: 12 }];
  const wb = XLSX2.utils.book_new();
  XLSX2.utils.book_append_sheet(wb, ws, "Bid sheet");
  return asDownload(`${lot.lotNumber}-bid-sheet.xlsx`, XLSX_MIME, Buffer.from(XLSX2.write(wb, { type: "buffer", bookType: "xlsx" })));
}
function parseBidSheet(rows, lot) {
  const headerIndex = rows.findIndex((r) => r.some((c) => String(c ?? "").toLowerCase().startsWith("unit price")));
  if (headerIndex < 0) fail('This is not our bid sheet: there is no "Unit price" column. Download the bid sheet for this lot.');
  const header = rows[headerIndex].map((c) => String(c ?? "").toLowerCase());
  const idCol = header.findIndex((h) => h.startsWith("line id"));
  const numCol = header.findIndex((h) => h === "line");
  const priceCol = header.findIndex((h) => h.startsWith("unit price"));
  const byId = new Map(lot.lines.map((l) => [l.id, l]));
  const byNumber = new Map(lot.lines.map((l) => [l.lineNumber, l]));
  const lines = [];
  const problems = [];
  rows.slice(headerIndex + 1).forEach((row, i) => {
    const raw = row[priceCol];
    if (raw == null || String(raw).trim() === "") return;
    const line = idCol >= 0 && byId.get(String(row[idCol] ?? "").trim()) || numCol >= 0 && byNumber.get(Number(row[numCol]));
    if (!line) {
      problems.push(`Row ${headerIndex + i + 2}: the line is not on this lot.`);
      return;
    }
    const price = parseMoneyCell(raw);
    if (price == null) {
      problems.push(`Line ${line.lineNumber}: "${String(raw)}" is not a price.`);
      return;
    }
    if (price > 0) lines.push({ lotLineId: line.id, unitPriceMinor: price });
  });
  return { lines, problems };
}
async function checkBidSheet(context, args) {
  const { lot } = await lotForBuyerDownload(context, args.lotNumber);
  if (lot.bidBasis !== "per_line") fail("This lot is bid as a whole.");
  const decoded = decodeUpload(args.file);
  if (!decoded) fail("Choose your filled bid sheet.");
  const { rows } = readWorkbook(decoded.bytes);
  const parsed = parseBidSheet(rows, lot);
  const byId = new Map(lot.lines.map((l) => [l.id, l]));
  const checkedLines = parsed.lines.map((l) => {
    const line = byId.get(l.lotLineId);
    return { lotLineId: l.lotLineId, lineNumber: line.lineNumber, description: line.description, quantity: line.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.unitPriceMinor * line.quantity };
  });
  return { lines: checkedLines, problems: parsed.problems, totalMinor: checkedLines.reduce((s, l) => s + l.totalMinor, 0) };
}
async function placeBidFromSheet(context, args) {
  const { companyId, user } = await requireBuyer(context);
  const checked = await checkBidSheet(context, args);
  if (checked.problems.length) fail(checked.problems[0]);
  if (!checked.lines.length) fail("The sheet has no prices.");
  const decoded = decodeUpload(args.file);
  const stored = await storeFile(context.prisma, { ...decoded, purpose: "bid_sheet", ownerBuyerCompanyId: companyId, uploadedById: user.id });
  return placeBidCore(context, { lotNumber: args.lotNumber, lines: checked.lines.map((l) => ({ lotLineId: l.lotLineId, unitPriceMinor: l.unitPriceMinor })), idempotencyKey: args.idempotencyKey, companyId, userId: user.id, source: "bid_sheet", sheetFileId: stored.id });
}

// features/keystone/domain/starterRecords.ts
var import_node_crypto6 = require("node:crypto");
var import_node_zlib = require("node:zlib");

// features/keystone/domain/starterTimeline.ts
var WORK_START = [8, 0];
var WORK_END = [17, 30];
function partsIn(t, timeZone) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second };
}
function localDay(t, timeZone) {
  const p = partsIn(+t, timeZone);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
function zoned(day, hh, mm, timeZone) {
  const [y, m2, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m2 - 1, d, hh, mm);
  const p = partsIn(guess, timeZone);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - guess;
  return new Date(guess - offset);
}
var weekday = (day) => (/* @__PURE__ */ new Date(`${day}T12:00:00Z`)).getUTCDay();
var isBusinessDay = (day) => weekday(day) !== 0 && weekday(day) !== 6;
var shiftDay = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
function storyClock(timeZone, now = /* @__PURE__ */ new Date()) {
  let anchor = localDay(now, timeZone);
  while (!isBusinessDay(anchor) || zoned(anchor, WORK_END[0], WORK_END[1], timeZone) > now) anchor = shiftDay(anchor, -1);
  const businessDay = (n) => {
    let day2 = anchor;
    let left = Math.abs(n);
    const step = n >= 0 ? -1 : 1;
    while (left > 0) {
      day2 = shiftDay(day2, step);
      if (isBusinessDay(day2)) left--;
    }
    return day2;
  };
  const at = (n, hh, mm = 0) => zoned(businessDay(n), hh, mm, timeZone);
  const day = (n) => {
    if (n >= 0) return businessDay(n);
    let d = localDay(now, timeZone);
    let left = -n;
    while (left > 0) {
      d = shiftDay(d, 1);
      if (isBusinessDay(d)) left--;
    }
    return d;
  };
  return { at, day, timeZone };
}
function workWindows(s, e, timeZone) {
  const out = [];
  for (let day = localDay(s, timeZone); day <= localDay(e, timeZone); day = shiftDay(day, 1)) {
    if (!isBusinessDay(day)) continue;
    const a = Math.max(s, +zoned(day, WORK_START[0], WORK_START[1], timeZone));
    const b = Math.min(e, +zoned(day, WORK_END[0], WORK_END[1], timeZone));
    if (b > a) out.push([a, b]);
  }
  return out.length ? out : [[s, e]];
}
var StarterTimeline = class {
  constructor(since, timeZone) {
    this.since = since;
    this.timeZone = timeZone;
    this.phases = [];
  }
  /** Everything written from now until the next mark happened between start and end. */
  mark(start, end) {
    this.phases.push({ at: Date.now(), start, end: end > start ? end : /* @__PURE__ */ new Date(+start + 6e4) });
  }
  pieces(until) {
    const out = [];
    const all = this.phases.map((p, i) => ({ ...p, from: i === 0 ? Math.min(+this.since, p.at) : p.at, to: this.phases[i + 1]?.at ?? until }));
    for (const p of all) {
      if (p.to <= p.from) continue;
      const windows = workWindows(+p.start, +p.end, this.timeZone);
      const total = windows.reduce((n, [a, b]) => n + (b - a), 0);
      let used = 0;
      for (const [a, b] of windows) {
        const r0 = p.from + (p.to - p.from) * used / total;
        used += b - a;
        const r1 = p.from + (p.to - p.from) * used / total;
        out.push({ r0, r1, s0: a, s1: b });
      }
    }
    return out;
  }
};
async function applyTimeline(prisma, timeline, until = Date.now()) {
  const pieces = timeline.pieces(until);
  if (!pieces.length) return 0;
  const lo = Math.min(...pieces.map((p) => p.r0));
  const hi = Math.max(...pieces.map((p) => p.r1));
  const columns = await prisma.$queryRawUnsafe(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema() AND data_type = 'timestamp without time zone' AND table_name NOT LIKE '\\_prisma%'`
  );
  let updated = 0;
  for (const { table_name, column_name } of columns) {
    const col = `"${column_name.replace(/"/g, "")}"`;
    const ms = `(extract(epoch from ${col}) * 1000)`;
    const cases = pieces.map((p) => {
      const k = (p.s1 - p.s0) / Math.max(1, p.r1 - p.r0);
      return `WHEN ${ms} >= ${p.r0.toFixed(3)} AND ${ms} < ${p.r1.toFixed(3)} THEN to_timestamp((${p.s0} + (${ms} - ${p.r0.toFixed(3)}) * ${k}) / 1000.0) AT TIME ZONE 'UTC'`;
    });
    const sql = `UPDATE "${table_name.replace(/"/g, "")}" SET ${col} = CASE ${cases.join(" ")} ELSE ${col} END WHERE ${ms} >= ${lo.toFixed(3)} AND ${ms} < ${hi.toFixed(3)}`;
    updated += Number(await prisma.$executeRawUnsafe(sql));
  }
  return updated;
}

// features/keystone/domain/starterRecords.ts
var doc = (text8) => [{ type: "paragraph", children: [{ text: text8 }] }];
var slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
var DAY = 864e5;
var CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 4294967295;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function signaturePng(name) {
  const w = 320, h = 96;
  const seed = [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const px = Buffer.alloc((w + 1) * h, 255);
  for (let r = 0; r < h; r++) px[r * (w + 1)] = 0;
  const dot = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.round(x + dx), yy = Math.round(y + dy);
      if (xx >= 0 && xx < w && yy >= 0 && yy < h) px[yy * (w + 1) + 1 + xx] = 30;
    }
  };
  for (let t = 0; t < 1; t += 4e-4) {
    const x = 20 + t * 270;
    const y = 50 + Math.sin(t * (14 + seed % 7)) * 22 * (1 - t * 0.5) + Math.sin(t * 61 + seed) * 6;
    dot(x, y);
  }
  for (let x = 30; x < 290; x += 0.5) dot(x, 82);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", ihdr), pngChunk("IDAT", (0, import_node_zlib.deflateSync)(px)), pngChunk("IEND", Buffer.alloc(0))]);
  return { filename: `signature-${slugify(name)}.png`, mimeType: "image/png", base64: png.toString("base64") };
}
async function resaleCertificatePdf(company, state, number) {
  const bytes = await renderPdf({
    header: `${state} sales and use tax resale certificate`,
    blocks: [
      { kind: "title", text: "Resale certificate" },
      { kind: "pairs", pairs: [["Purchaser", company], ["State", state], ["Permit number", number], ["Type of business", "Wholesale purchase of used IT equipment for resale"]] },
      { kind: "text", text: "The purchaser certifies that the property purchased is for resale in the regular course of business." },
      { kind: "signature", label: "Authorised signature" }
    ]
  });
  return { filename: `resale-certificate-${state}.pdf`, mimeType: "application/pdf", base64: Buffer.from(bytes).toString("base64") };
}
var BUYERS = [
  { key: "northgate", person: "Dana Ruiz", legalName: "Northgate Refurbishing LLC", tradingName: "Northgate Refurb", businessType: "refurbisher", band: "from_25k_to_100k", address: ["4410 Industrial Pkwy", "Columbus", "OH", "43228"], phone: "(614) 555-0142", website: "northgaterefurb.com", taxId: "82-4417730", state: "OH", permit: "98-213447", outcome: "approve", taxStatus: "exempt_resale" },
  { key: "bluewater", person: "Marcus Feld", legalName: "Bluewater IT Asset Trading Inc.", tradingName: "Bluewater ITAD", businessType: "reseller", band: "over_100k", address: ["220 Harbor Point Blvd, Suite 300", "Cleveland", "OH", "44114"], phone: "(216) 555-0187", website: "bluewaterita.com", taxId: "47-1022815", state: "OH", permit: "98-551203", outcome: "approve", taxStatus: "taxable" },
  { key: "copperline", person: "Aisha Okafor", legalName: "Copperline Electronics Recovery LLC", tradingName: "", businessType: "recycler", band: "from_5k_to_25k", address: ["1875 Rail Yard Rd", "Fort Wayne", "IN", "46803"], phone: "(260) 555-0119", website: "copperline-recovery.com", taxId: "35-2290614", state: "IN", permit: "0031874620", outcome: "submitted", taxStatus: "taxable" },
  { key: "atlas", person: "Tom Brannigan", legalName: "Atlas Device Brokers LLC", tradingName: "Atlas Devices", businessType: "broker", band: "from_5k_to_25k", address: ["9 Commerce Sq", "Pittsburgh", "PA", "15222"], phone: "(412) 555-0164", website: "atlasdevices.com", taxId: "23-3318842", state: "PA", permit: "7240-1188", outcome: "request_info", taxStatus: "taxable" }
];
var CLIENTS = [
  { key: "meridian", name: "Meridian Health Partners", legalName: "Meridian Health Partners, Inc.", industry: "Healthcare", person: "Laura Chen", phone: "(614) 555-0110", sites: [
    { name: "Riverside main campus", addressLine1: "1200 Riverside Dr", city: "Columbus", region: "OH", postalCode: "43215", contactName: "Laura Chen", contactPhone: "(614) 555-0110", hasDock: true, needsLiftgate: false, accessNotes: "Loading dock B behind the parking garage. Check in with security.", hours: "Mon-Fri 7:00-15:00" },
    { name: "Westside clinic", addressLine1: "3380 W Broad St", city: "Columbus", region: "OH", postalCode: "43204", contactName: "Ray Ortiz", contactPhone: "(614) 555-0133", hasDock: false, needsLiftgate: true, accessNotes: "Street-level entrance; equipment is in the basement storage room.", hours: "Mon-Fri 8:00-16:00" }
  ] },
  { key: "larkspur", name: "Larkspur Community Credit Union", legalName: "Larkspur Community Credit Union", industry: "Financial services", person: "Gary Whitfield", phone: "(937) 555-0176", sites: [
    { name: "Operations centre", addressLine1: "75 Commerce Center Dr", city: "Dayton", region: "OH", postalCode: "45402", contactName: "Gary Whitfield", contactPhone: "(937) 555-0176", hasDock: true, needsLiftgate: false, accessNotes: "Server room equipment staged at the rear dock.", hours: "Mon-Fri 8:00-17:00" }
  ] },
  { key: "halvorsen", name: "Halvorsen Engineering Group", legalName: "Halvorsen Engineering Group LLC", industry: "Engineering", person: "Ingrid Halvorsen", phone: "(513) 555-0158", sites: [
    { name: "Head office", addressLine1: "600 Vine St, Floor 12", city: "Cincinnati", region: "OH", postalCode: "45202", contactName: "Ingrid Halvorsen", contactPhone: "(513) 555-0158", hasDock: false, needsLiftgate: true, accessNotes: "Freight elevator booked through building management, 24 h notice.", hours: "Mon-Fri 9:00-17:00" }
  ] }
];
var STAFF = [
  { key: "driver", name: "Marcus Bell", role: "Driver" },
  { key: "technician", name: "Priya Natarajan", role: "Technician" }
];
var JOB_ONE = [
  { category: "Laptops", manufacturer: "Dell", model: "Latitude 5420", specs: { cpu: "Core i5-1145G7", ramGb: 16, storage: "256 GB NVMe SSD", screen: '14" FHD' }, weight: 3.4, count: 24, grades: [["A", "F1"], ["B", "F1"], ["B", "F1"], ["B", "F2"]], wipe: "purge", disposition: "resale" },
  { category: "Desktops", manufacturer: "HP", model: "EliteDesk 800 G6 SFF", specs: { cpu: "Core i5-10500", ramGb: 16, storage: "512 GB SSD" }, weight: 11.8, count: 12, grades: [["B", "F1"], ["A", "F1"]], wipe: "purge", disposition: "resale" },
  { category: "Monitors", manufacturer: "Dell", model: "P2419H", specs: { size: '24"', resolution: "1920x1080" }, weight: 11.2, count: 10, grades: [["B", "F1"], ["C", "F1"]], wipe: "none", disposition: "resale" },
  { category: "Laptops", manufacturer: "Lenovo", model: "ThinkPad T480", specs: { cpu: "Core i5-8350U", ramGb: 8, storage: "256 GB SSD" }, weight: 3.6, count: 6, grades: [["D", "F4"]], wipe: "shred", disposition: "recycle" },
  { category: "Hard drives", manufacturer: "Seagate", model: "Exos 7E8 2TB", partNumber: "ST2000NM0055", specs: { capacity: "2 TB", interface: "SATA 6Gb/s" }, weight: 1.4, count: 8, grades: [["C", "F3"]], wipe: "shred_after_fail", failed: 2, disposition: "recycle" },
  { category: "Mobile phones", manufacturer: "Apple", model: "iPhone 11", specs: { storage: "64 GB", carrier: "Unlocked" }, weight: 0.4, count: 10, grades: [["B", "F1"], ["A", "F1"], ["C", "F2"]], wipe: "purge", disposition: "resale" }
];
var JOB_TWO = [
  { category: "Desktops", manufacturer: "Dell", model: "OptiPlex 7090 Micro", specs: { cpu: "Core i5-10500T", ramGb: 16, storage: "256 GB SSD" }, weight: 2.9, count: 20, grades: [["B", "F1"], ["A", "F1"]], wipe: "purge", pending: 6, disposition: "resale" },
  { category: "Servers", manufacturer: "Dell", model: "PowerEdge R640", specs: { cpu: "2x Xeon Silver 4214", ramGb: 192, storage: "4x 1.2 TB SAS" }, weight: 37.5, count: 6, grades: [["B", "F1"]], wipe: "purge", pending: 2, disposition: "undecided" },
  { category: "Networking", manufacturer: "Cisco", model: "Catalyst 2960X-48FPD-L", partNumber: "WS-C2960X-48FPD-L", specs: { ports: "48x 1G PoE+, 2x 10G SFP+" }, weight: 11.9, count: 8, grades: [["B", "F1"]], wipe: "clear", disposition: "undecided" },
  { category: "Laptops", manufacturer: "Lenovo", model: "ThinkPad T14 Gen 2", specs: { cpu: "Core i5-1135G7", ramGb: 16, storage: "512 GB SSD" }, weight: 3.3, count: 16, grades: [["B", "F1"], ["C", "F2"]], wipe: "purge", pending: 3, failed: 1, disposition: "undecided" }
];
var SERIAL_PREFIX = { Dell: "", HP: "MXL", Lenovo: "PF", Seagate: "ZC", Apple: "F2L", Cisco: "FOC" };
function serialFor(manufacturer) {
  const alphabet = "BCDFGHJKLMNPQRSTVWXYZ0123456789";
  const bytes = (0, import_node_crypto6.randomBytes)(10);
  const body = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return manufacturer === "Dell" ? body.slice(0, 7) : `${SERIAL_PREFIX[manufacturer] ?? ""}${body.slice(0, 8)}`;
}
var BUYER_STORY = {
  northgate: { apply: [14, 10], review: [13, 9] },
  bluewater: { apply: [13, 14], review: [12, 10] },
  copperline: { apply: [2, 15], review: [2, 16] },
  atlas: { apply: [6, 11], review: [5, 10] }
};
async function seedStarterRecords(context, options2) {
  const base = context;
  if (typeof base.withSession !== "function") fail("Starter records need a signed-in session.");
  const prisma = context.prisma;
  const ownerId = context.session.itemId;
  const settings = await getSettings(prisma);
  const mailbox = String(options2.supportEmail || settings.supportEmail || "").toLowerCase();
  const [local, domain] = mailbox.includes("@") ? mailbox.split("@") : ["accounts", `${slugify(options2.businessName) || "recycler"}.local`];
  const emailFor = (tag) => `${local}+${tag}@${domain}`;
  const already = await prisma.user.findUnique({ where: { email: emailFor("northgate") }, select: { id: true } });
  if (already) {
    const logins2 = [
      ...BUYERS.map((b) => ({ portal: "buyer", name: b.person, email: emailFor(b.key), organisation: b.legalName })),
      ...CLIENTS.map((c) => ({ portal: "client", name: c.person, email: emailFor(c.key), organisation: c.name })),
      ...STAFF.map((s) => ({ portal: "staff", name: s.name, email: emailFor(s.key), organisation: options2.businessName, role: s.role }))
    ];
    return { skipped: true, logins: logins2, records: { note: "Starter records already exist. Passwords were shown when they were created; reset them from Team or the sign-in page." } };
  }
  const tz = settings.timezone || "UTC";
  const story = storyClock(tz);
  const timeline = new StarterTimeline(options2.since ?? /* @__PURE__ */ new Date(), tz);
  const phase = async (from, to) => {
    await new Promise((r) => setTimeout(r, 40));
    timeline.mark(story.at(from[0], from[1], from[2] ?? 0), story.at(to[0], to[1], to[2] ?? 0));
    await new Promise((r) => setTimeout(r, 40));
  };
  await phase([16, 9], [16, 11]);
  const password2 = options2.password && options2.password.length >= 10 ? options2.password : `${(0, import_node_crypto6.randomBytes)(9).toString("base64url")}-Rc1`;
  const logins = [];
  const records = {};
  const sessionFor = async (userId) => {
    const u = await prisma.user.findUnique({ where: { id: userId }, include: { role: true, buyerCompany: { select: { id: true, status: true } }, clientOrganization: { select: { id: true, status: true } } } });
    return base.withSession({ itemId: u.id, listKey: "User", data: { name: u.name, email: u.email, kind: u.kind, isActive: u.isActive, buyerRole: u.buyerRole, clientRole: u.clientRole, onboardingStatus: u.onboardingStatus, buyerCompany: u.buyerCompany, clientOrganization: u.clientOrganization, role: u.role } });
  };
  const owner = await sessionFor(ownerId);
  const sudo = base.sudo();
  const staff = {};
  for (const s of STAFF) {
    const role = await prisma.role.findFirst({ where: { name: s.role } });
    if (!role) fail(`The ${s.role} role is missing; run onboarding first.`);
    const user = await sudo.db.User.createOne({ data: { name: s.name, email: emailFor(s.key), password: password2, kind: "staff", role: { connect: { id: role.id } } } });
    staff[s.key] = { id: user.id, name: s.name, email: emailFor(s.key) };
    logins.push({ portal: "staff", name: s.name, email: emailFor(s.key), organisation: options2.businessName, role: s.role });
  }
  const technician = await sessionFor(staff.technician.id);
  const driver = await sessionFor(staff.driver.id);
  const grades = new Map((await prisma.gradeDefinition.findMany()).map((g) => [`${g.kind}:${g.code}`, g.id]));
  const categories = new Map((await prisma.materialCategory.findMany()).map((c) => [c.name, c.id]));
  const cat = (name) => categories.get(name) ?? null;
  const buyerUsers = {};
  for (const b of BUYERS) {
    const email = emailFor(b.key);
    const plan = BUYER_STORY[b.key];
    await phase([plan.apply[0], plan.apply[1]], [plan.apply[0], plan.apply[1] + 1]);
    const reg = await registerBuyer(base, { name: b.person, email, password: password2, phone: b.phone, legalName: b.legalName, countryCode: "US" });
    const asBuyer = await sessionFor(reg.userId);
    await saveBuyerApplication(asBuyer, {
      tradingName: b.tradingName,
      addressLine1: b.address[0],
      city: b.address[1],
      region: b.address[2],
      postalCode: b.address[3],
      countryCode: "US",
      phone: b.phone,
      website: b.website,
      taxId: b.taxId,
      businessType: b.businessType,
      monthlySpendBand: b.band,
      destinationCountries: ["US", "CA"],
      categoryIds: [cat("Laptops"), cat("Desktops"), cat("Servers"), cat("Networking")].filter(Boolean)
    });
    await uploadBuyerDocument(asBuyer, { type: "resale_certificate", file: await resaleCertificatePdf(b.legalName, b.state, b.permit), state: b.state, expiresOn: new Date(Date.now() + 700 * DAY).toISOString().slice(0, 10) });
    await submitBuyerApplication(asBuyer, { acceptTermsVersion: settings.wholesaleTermsVersion });
    await phase([plan.review[0], plan.review[1]], [plan.review[0], plan.review[1] + 1]);
    if (b.outcome === "approve") {
      await reviewBuyerApplication(owner, { companyId: reg.companyId, action: "open" });
      const docs = await prisma.buyerDocument.findMany({ where: { companyId: reg.companyId } });
      for (const d of docs) await reviewBuyerDocument(owner, { documentId: d.id, status: "accepted", note: "Permit number checked with the state register." });
      await reviewBuyerApplication(owner, { companyId: reg.companyId, action: "approve", taxStatus: b.taxStatus, spendLimitMinor: b.key === "northgate" ? 25e6 : null, message: `Welcome aboard. ${b.legalName} is approved to bid on every open lot.` });
    } else if (b.outcome === "request_info") {
      await reviewBuyerApplication(owner, { companyId: reg.companyId, action: "open" });
      await reviewBuyerApplication(owner, { companyId: reg.companyId, action: "request_info", message: "The resale certificate you uploaded has expired on the state register. Please upload your current Pennsylvania certificate (REV-1220) so we can finish the review." });
    }
    buyerUsers[b.key] = { userId: reg.userId, companyId: reg.companyId };
    const status2 = (await prisma.buyerCompany.findUnique({ where: { id: reg.companyId }, select: { status: true } })).status;
    logins.push({ portal: "buyer", name: b.person, email, organisation: b.legalName, status: status2 });
  }
  records.buyers = BUYERS.map((b) => b.legalName);
  await phase([15, 13], [15, 16]);
  const orgs = {};
  for (const c of CLIENTS) {
    const site0 = c.sites[0];
    const org = await sudo.db.ClientOrganization.createOne({ data: { name: c.name, legalName: c.legalName, industry: c.industry, billingEmail: emailFor(`${c.key}-ap`), addressLine1: site0.addressLine1, city: site0.city, region: site0.region, postalCode: site0.postalCode, countryCode: "US", status: "active", defaultPricingModel: c.key === "meridian" ? "revenue_share" : "fee_for_service", accountManager: { connect: { id: ownerId } } } });
    const siteIds = [];
    for (const s of c.sites) siteIds.push((await sudo.db.ClientSite.createOne({ data: { ...s, countryCode: "US", organization: { connect: { id: org.id } } } })).id);
    const user = await sudo.db.User.createOne({ data: { name: c.person, email: emailFor(c.key), password: password2, phone: c.phone, kind: "client", clientRole: "admin", clientOrganization: { connect: { id: org.id } } } });
    orgs[c.key] = { id: org.id, userId: user.id, siteIds };
    logins.push({ portal: "client", name: c.person, email: emailFor(c.key), organisation: c.name });
  }
  const today = /* @__PURE__ */ new Date();
  const siteOf = (key2, i = 0) => {
    const s = CLIENTS.find((c) => c.key === key2).sites[i];
    return { addressLine1: s.addressLine1, city: s.city, region: s.region, postalCode: s.postalCode, countryCode: "US", hasDock: s.hasDock, needsLiftgate: s.needsLiftgate, accessNotes: s.accessNotes, hours: s.hours };
  };
  const newJob = async (key2, siteIndex, notes, estimate, requestedDates) => {
    const c = CLIENTS.find((x) => x.key === key2);
    const out = await requestJob(owner, { organizationId: orgs[key2].id, siteId: orgs[key2].siteIds[siteIndex], contactName: c.sites[siteIndex].contactName, contactEmail: emailFor(key2), contactPhone: c.sites[siteIndex].contactPhone, site: siteOf(key2, siteIndex), requestedDates, hasDataBearing: true, services: ["pickup", "data_destruction", "itad"], estimate: estimate.map(([category, quantity, unit]) => ({ categoryId: cat(category), quantity, unit })), notes });
    return out.jobId;
  };
  const acceptAs = async (key2, jobId) => {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    const c = CLIENTS.find((x) => x.key === key2);
    await acceptJobQuote(await sessionFor(orgs[key2].userId), { jobNumber: job.jobNumber, signatureName: c.person, termsVersion: settings.serviceTermsVersion });
  };
  const collect = async (jobId, key2, containers, bookedOn, scheduledOn) => {
    await phase([bookedOn, 15], [bookedOn, 15, 30]);
    await scheduleJob(owner, { jobId, date: story.day(scheduledOn), windowStart: "08:00", windowEnd: "10:00", driverId: staff.driver.id, vehicle: "Box truck 2 (26 ft, liftgate)" });
    await phase([scheduledOn, 8, 5], [scheduledOn, 8, 20]);
    await startJobRoute(driver, { jobId });
    await phase([scheduledOn, 9, 10], [scheduledOn, 9, 50]);
    const signer = CLIENTS.find((x) => x.key === key2).sites[0].contactName;
    const { jobNumber } = await prisma.job.findUnique({ where: { id: jobId }, select: { jobNumber: true } });
    containers = containers.map((c) => ({ ...c, label: `${jobNumber}-${c.label}` }));
    await collectJob(driver, { jobId, containers, signerName: signer, signature: signaturePng(signer), notes: "Loaded and shrink-wrapped on site." });
    const rows = await prisma.container.findMany({ where: { jobId }, orderBy: { label: "asc" } });
    await phase([scheduledOn, 13, 15], [scheduledOn, 14, 30]);
    for (const r of rows) {
      const plan = containers.find((c) => c.label === r.label);
      await receiveContainer(owner, { containerId: r.id, receivedSealNumber: plan.sealNumber, grossWeight: plan.grossWeight, tareWeight: plan.type === "gaylord" ? 48 : 42, locationCode: `IN-${r.label.slice(-2)}` });
    }
    return rows.map((r) => r.id);
  };
  const auditPlans = async (jobId, containerIds, plans) => {
    const created = [];
    let n = 0;
    for (const plan of plans) {
      for (let i = 0; i < plan.count; i++) {
        const [cos, fn] = plan.grades[i % plan.grades.length];
        const asset = await auditAsset(technician, {
          jobId,
          containerId: containerIds[n++ % containerIds.length],
          categoryId: cat(plan.category),
          manufacturer: plan.manufacturer,
          model: plan.model,
          partNumber: plan.partNumber ?? "",
          serialNumber: serialFor(plan.manufacturer),
          clientAssetTag: plan.category === "Hard drives" ? "" : `MHP-${String(10400 + n).padStart(6, "0")}`,
          specs: plan.specs,
          isDataBearing: plan.wipe !== "none",
          cosmeticGradeId: grades.get(`cosmetic:${cos}`) ?? null,
          functionalGradeId: grades.get(`functional:${fn}`) ?? null,
          testNotes: fn === "F1" ? "Powers on, passes diagnostics." : fn === "F2" ? "Battery health under 70%." : fn === "F4" ? "No POST; board fault." : "Spins up; SMART not read.",
          weight: plan.weight,
          locationCode: `AUD-${n % 4 + 1}`
        });
        created.push({ id: asset.id, plan, index: i });
      }
    }
    return created;
  };
  const wipe = async (assets, reportDay) => {
    const done = (a) => a.index >= (a.plan.pending ?? 0) + (a.plan.wipe === "purge" ? a.plan.failed ?? 0 : 0);
    const byWipe = (w) => assets.filter((a) => a.plan.wipe === w);
    const purge = byWipe("purge");
    const passedPurge = purge.filter(done).map((a) => a.id);
    const failedPurge = purge.filter((a) => a.index >= (a.plan.pending ?? 0) && a.index < (a.plan.pending ?? 0) + (a.plan.failed ?? 0)).map((a) => a.id);
    const reportReference = `BDE-${reportDay.replace(/-/g, "")}-${(0, import_node_crypto6.randomBytes)(2).toString("hex").toUpperCase()}`;
    if (passedPurge.length) await recordSanitization(technician, { assetIds: passedPurge, method: "purge", technique: "crypto_erase", standard: "NIST SP 800-88 Rev. 1", tool: "Blancco Drive Eraser", toolVersion: "7.11", reportReference, result: "passed" });
    if (failedPurge.length) await recordSanitization(technician, { assetIds: failedPurge, method: "purge", technique: "crypto_erase", standard: "NIST SP 800-88 Rev. 1", tool: "Blancco Drive Eraser", toolVersion: "7.11", reportReference, result: "failed", failureReason: "Drive reported a frozen security state; erase did not complete." });
    const clear = byWipe("clear").map((a) => a.id);
    if (clear.length) await recordSanitization(technician, { assetIds: clear, method: "clear", technique: "overwrite", standard: "NIST SP 800-88 Rev. 1", tool: "Factory reset and NVRAM erase", reportReference, result: "passed" });
    const shred = byWipe("shred").map((a) => a.id);
    if (shred.length) await recordSanitization(technician, { assetIds: shred, method: "destroy", technique: "shred", standard: "NIST SP 800-88 Rev. 1", tool: "SSI Q55 shredder", reportReference, result: "passed", witnessName: "Laura Chen" });
    const retry = byWipe("shred_after_fail");
    const firstFails = retry.filter((a) => a.index < (a.plan.failed ?? 0)).map((a) => a.id);
    if (firstFails.length) await recordSanitization(technician, { assetIds: firstFails, method: "clear", technique: "overwrite", standard: "NIST SP 800-88 Rev. 1", tool: "WipeDrive", toolVersion: "9.2", reportReference, result: "failed", failureReason: "Bad sectors; overwrite stopped at 61%." });
    if (retry.length) await recordSanitization(technician, { assetIds: retry.map((a) => a.id), method: "destroy", technique: "shred", standard: "NIST SP 800-88 Rev. 1", tool: "SSI Q55 shredder", reportReference, result: "passed", witnessName: "Laura Chen" });
    const toVerify = await prisma.sanitizationRecord.findMany({ where: { assetId: { in: assets.map((a) => a.id) }, result: "passed" }, orderBy: { createdAt: "asc" }, take: 6 });
    for (const r of toVerify) await verifySanitization(owner, { recordId: r.id, confirmed: true, note: "Spot check: drive reads as blank." });
  };
  await phase([15, 9, 10], [15, 9, 25]);
  const job1 = await newJob("meridian", 0, "Annual refresh from the Riverside campus. Two pallets of laptops and desktops, one gaylord of loose drives and phones.", [["Laptops", 30, "units"], ["Desktops", 12, "units"], ["Monitors", 10, "units"], ["Hard drives", 8, "units"], ["Mobile phones", 10, "units"]], [story.day(11), story.day(10)]);
  await phase([15, 14], [15, 14, 20]);
  await quoteJob(owner, { jobId: job1, pricingModel: "revenue_share", revenueShareBps: 7e3, lines: [{ description: "Collection, Columbus metro", quantity: 1, unitPriceMinor: 0, kind: "pickup" }, { description: "Serial-level audit and grading", quantity: 70, unitPriceMinor: 0, kind: "audit" }, { description: "Drive shredding with certificate", quantity: 8, unitPriceMinor: 500, kind: "shred" }] });
  await phase([14, 10, 40], [14, 10, 50]);
  await acceptAs("meridian", job1);
  const c1 = await collect(job1, "meridian", [
    { label: "MHP-P01", type: "pallet", sealNumber: "S-448120", itemCountDeclared: 30, grossWeight: 214 },
    { label: "MHP-P02", type: "pallet", sealNumber: "S-448121", itemCountDeclared: 22, grossWeight: 362 },
    { label: "MHP-G01", type: "gaylord", sealNumber: "S-448122", itemCountDeclared: 18, grossWeight: 71 }
  ], 13, 11);
  await phase([10, 8, 30], [8, 16]);
  const assets1 = await auditPlans(job1, c1, JOB_ONE);
  await phase([8, 9], [7, 15]);
  await wipe(assets1, story.day(8));
  await phase([6, 10], [6, 11]);
  for (const disposition of ["resale", "recycle"]) {
    const ids = assets1.filter((a) => a.plan.disposition === disposition && !(a.plan.grades[a.index % a.plan.grades.length][1] === "F4" && disposition === "resale")).map((a) => a.id);
    if (ids.length) await setAssetDisposition(owner, { assetIds: ids, disposition });
  }
  await phase([5, 14], [5, 14, 30]);
  const cert1 = await issueCertificate(owner, { jobId: job1, type: "data_destruction" });
  const cert2 = await issueCertificate(owner, { jobId: job1, type: "recycling" });
  await phase([5, 15], [5, 15, 10]);
  await completeJob(owner, { jobId: job1 });
  await phase([9, 11], [9, 11, 15]);
  const job2 = await newJob("larkspur", 0, "Branch desktop refresh and the old server rack from the operations centre.", [["Desktops", 20, "units"], ["Servers", 6, "units"], ["Networking", 8, "units"], ["Laptops", 16, "units"]], [story.day(6), story.day(5)]);
  await phase([9, 15], [9, 15, 20]);
  await quoteJob(owner, { jobId: job2, pricingModel: "fee_for_service", lines: [{ description: "Collection, Dayton", quantity: 1, unitPriceMinor: 17500, kind: "pickup" }, { description: "Serial-level audit", quantity: 50, unitPriceMinor: 400, kind: "audit" }, { description: "On-site witnessed wipe, per drive", quantity: 50, unitPriceMinor: 800, kind: "wipe" }] });
  await phase([8, 9, 30], [8, 9, 40]);
  await acceptAs("larkspur", job2);
  const c2 = await collect(job2, "larkspur", [
    { label: "LCU-G01", type: "gaylord", sealNumber: "S-448210", itemCountDeclared: 28, grossWeight: 186 },
    { label: "LCU-P01", type: "pallet", sealNumber: "S-448211", itemCountDeclared: 22, grossWeight: 412 }
  ], 8, 6);
  await phase([5, 8, 30], [3, 16]);
  const assets2 = await auditPlans(job2, c2, JOB_TWO);
  await phase([2, 9], [1, 15]);
  await wipe(assets2, story.day(2));
  await phase([1, 15, 30], [1, 15, 45]);
  const readyOptiplex = assets2.filter((a) => a.plan.model.startsWith("OptiPlex") && a.index >= (a.plan.pending ?? 0)).map((a) => a.id);
  if (readyOptiplex.length) await setAssetDisposition(owner, { assetIds: readyOptiplex, disposition: "resale" });
  await phase([4, 10], [4, 10, 10]);
  const job3 = await newJob("halvorsen", 0, "Office move: workstations and monitors from floor 12.", [["Desktops", 25, "units"], ["Monitors", 30, "units"]], [story.day(-2), story.day(-3)]);
  await phase([4, 16], [4, 16, 15]);
  await quoteJob(owner, { jobId: job3, pricingModel: "fee_for_service", lines: [{ description: "Collection, Cincinnati CBD (freight elevator)", quantity: 1, unitPriceMinor: 22500, kind: "pickup" }, { description: "Hard drive shredding", quantity: 25, unitPriceMinor: 500, kind: "shred" }, { description: "Monitor recycling fee", quantity: 30, unitPriceMinor: 500, kind: "recycling_fee" }] });
  await phase([3, 11], [3, 11, 10]);
  await acceptAs("halvorsen", job3);
  await phase([2, 10], [2, 10, 10]);
  await scheduleJob(owner, { jobId: job3, date: story.day(-2), windowStart: "09:00", windowEnd: "11:00", driverId: staff.driver.id, vehicle: "Box truck 1 (20 ft, liftgate)" });
  await phase([1, 9, 30], [1, 9, 40]);
  const job4 = await newJob("meridian", 1, "Clinic workstation swap. Client wants a quote before the budget meeting.", [["Laptops", 14, "units"], ["Printers", 3, "units"]], [story.day(-5), story.day(-6)]);
  await phase([0, 11], [0, 11, 20]);
  await quoteJob(owner, { jobId: job4, pricingModel: "revenue_share", revenueShareBps: 7e3, lines: [{ description: "Collection, liftgate required", quantity: 1, unitPriceMinor: 9500, kind: "pickup" }, { description: "Printer recycling fee", quantity: 3, unitPriceMinor: 1500, kind: "recycling_fee" }] });
  const jobNumbers = await prisma.job.findMany({ where: { id: { in: [job1, job2, job3, job4] } }, select: { id: true, jobNumber: true, status: true } });
  records.jobs = [job1, job2, job3, job4].map((id) => jobNumbers.find((j) => j.id === id)).map((j) => ({ jobNumber: j.jobNumber, status: j.status }));
  records.certificates = [cert1.certificateNumber, cert2.certificateNumber];
  records.assets = await prisma.asset.count({ where: { jobId: { in: [job1, job2] } } });
  const vendors = [
    { name: "Great Lakes Metals Recovery", addressLine1: "3100 Ship Canal Rd", city: "Toledo", region: "OH", postalCode: "43611", contactName: "Jim Kowalczyk", contactEmail: "compliance@greatlakesmetals.com", certifications: [{ name: "R2v3", number: "R2-24-11873", expiresOn: "2027-09-30" }, { name: "ISO 14001", number: "EMS-558120", expiresOn: "2027-03-31" }], categories: ["Circuit boards", "Cables and wire", "Mixed e-scrap", "Hard drives"], notes: "Shredded drive fragments and boards. Smelter downstream: Aurubis Hamburg." },
    { name: "Ridgeway Battery Solutions", addressLine1: "88 Furnace Run", city: "Ellwood City", region: "PA", postalCode: "16117", contactName: "Sandra Pike", contactEmail: "receiving@ridgewaybattery.com", certifications: [{ name: "R2v3", number: "R2-23-10442", expiresOn: "2026-12-31" }, { name: "e-Stewards", number: "ES-1187", expiresOn: "2027-05-31" }], categories: ["Batteries", "CRT"], notes: "Lithium-ion and lead-acid. Ship in UN-rated drums only." }
  ];
  await phase([16, 14], [16, 15]);
  for (const v of vendors) {
    const { categories: names, ...data } = v;
    await sudo.db.DownstreamVendor.createOne({ data: { ...data, countryCode: "US", status: "approved", approvedOn: new Date(today.getTime() - 120 * DAY).toISOString().slice(0, 10), reviewDueOn: new Date(today.getTime() + 245 * DAY).toISOString().slice(0, 10), approvedCategories: { connect: names.map(cat).filter(Boolean).map((id) => ({ id })) } } });
  }
  records.downstreamVendors = vendors.map((v) => v.name);
  await phase([5, 15, 30], [5, 17]);
  const facility = await prisma.facility.findFirst({ orderBy: { createdAt: "asc" } });
  const eventCloses = new Date(today.getTime() + 5 * DAY);
  eventCloses.setUTCHours(19, 0, 0, 0);
  const event = await prisma.saleEvent.create({ data: { title: `${today.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} enterprise IT sale`, slug: `enterprise-it-sale-${today.toISOString().slice(0, 10)}-${(0, import_node_crypto6.randomBytes)(2).toString("hex")}`, description: "Off-lease laptops, desktops and data-centre equipment from healthcare and finance clients. Every data-bearing device is wiped to NIST 800-88 or destroyed, with serial-level manifests.", opensAt: story.at(4, 9), closesAt: eventCloses, status: "draft" } });
  const closeAt = (days, hour = 19) => {
    const d = new Date(today.getTime() + days * DAY);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };
  const lotData = (title, fields) => ({ title, slug: slugify(title), saleEventId: event.id, facilityId: facility?.id ?? null, status: "draft", awardMode: "manual", shippingTerms: "buyer_arranged", exportAllowed: true, ...fields });
  const manualLot = async (title, fields, lines) => {
    return prisma.lot.create({ data: { lotNumber: await nextNumber(prisma, "lot"), ...lotData(title, fields), lines: { create: lines.map((l, i) => ({ lineNumber: i + 1, categoryId: cat(l.category), manufacturer: l.manufacturer, model: l.model, partNumber: "", description: l.description, specs: l.specs ?? {}, cosmeticGrade: l.cosmeticGrade, functionalGrade: l.functionalGrade, quantity: l.quantity, unit: "each", serials: [], notes: "", extra: {} })) } }, include: { lines: { orderBy: { lineNumber: "asc" } } } });
  };
  const forLot = assets1.filter((a) => ["Latitude 5420", "EliteDesk 800 G6 SFF"].includes(a.plan.model)).map((a) => a.id);
  const lot1Draft = await createLotFromAssets(owner, { assetIds: forLot, title: "Dell Latitude 5420 and HP EliteDesk 800 G6, 36 units, wiped", saleEventId: event.id, facilityId: facility?.id ?? null, format: "sealed_bid", bidBasis: "lot_total" });
  await prisma.lot.update({ where: { id: lot1Draft.id }, data: { slug: slugify(lot1Draft.title), closesAt: closeAt(4), reserveMinor: 9e5, palletCount: 2, dimensions: "2 pallets, 48x40x52 in", conditionSummary: "Mostly grade B, fully working. Batteries 80%+ on the Latitudes. Crypto-erased (NIST 800-88 purge), no OS installed.", description: doc("Off-lease fleet from a healthcare client, audited serial by serial. Chargers included for the laptops; no power cords for the desktops. Asset tags removed."), warrantyDays: 30 } });
  const lot2 = await manualLot("Data-centre refresh: Dell R740, Cisco 9300 and HPE DL360", { format: "sealed_bid", bidBasis: "per_line", closesAt: closeAt(4, 20), reserveMinor: null, palletCount: 6, conditionSummary: "Servers have no drives (shredded on site). Switches factory reset.", description: doc("Decommissioned from a regional bank data centre. Rails and bezels included where noted on the manifest. Bid per line: each line can be awarded to a different buyer.") }, [
    { category: "Servers", manufacturer: "Dell", model: "PowerEdge R740", description: "Dell PowerEdge R740, 2x Xeon Gold 6130, 256 GB, no drives, rails", quantity: 18, cosmeticGrade: "Grade A", functionalGrade: "Fully working", specs: { cpu: "2x Xeon Gold 6130", ramGb: 256 } },
    { category: "Networking", manufacturer: "Cisco", model: "Catalyst 9300-48P", description: "Cisco Catalyst 9300-48P-A, PoE+, dual PSU, no network module", quantity: 24, cosmeticGrade: "Grade B", functionalGrade: "Fully working" },
    { category: "Servers", manufacturer: "HPE", model: "ProLiant DL360 Gen10", description: "HPE ProLiant DL360 Gen10, 2x Xeon Silver 4110, 64 GB, no drives", quantity: 40, cosmeticGrade: "Grade B", functionalGrade: "Powers on, untested", specs: { cpu: "2x Xeon Silver 4110", ramGb: 64 } }
  ]);
  const lot3 = await manualLot('Apple MacBook Pro 13" M1 (2020), 60 units, unlocked', { format: "open_auction", bidBasis: "lot_total", openingBidMinor: 15e5, bidIncrementMinor: 25e3, reserveMinor: 17e5, closesAt: closeAt(3, 21), palletCount: 1, conditionSummary: "Activation lock and MDM removed. Erased with Apple Configurator.", description: doc("Returned from a corporate lease. Every unit checked for activation lock and MDM enrolment before listing. Chargers not included.") }, [
    { category: "Laptops", manufacturer: "Apple", model: 'MacBook Pro 13" M1 2020', description: 'MacBook Pro 13" M1, 8 GB, 256 GB, Space Grey', quantity: 36, cosmeticGrade: "Grade B", functionalGrade: "Fully working", specs: { cpu: "Apple M1", ramGb: 8, storage: "256 GB" } },
    { category: "Laptops", manufacturer: "Apple", model: 'MacBook Pro 13" M1 2020', description: 'MacBook Pro 13" M1, 8 GB, 256 GB, heavy wear on lids', quantity: 24, cosmeticGrade: "Grade C", functionalGrade: "Fully working", specs: { cpu: "Apple M1", ramGb: 8, storage: "256 GB" } }
  ]);
  const lot4 = await manualLot('Dell P2422H 24" monitors, 80 units, with stands', { format: "fixed_price", bidBasis: "lot_total", fixedPriceMinor: 36e4, closesAt: closeAt(5), palletCount: 2, conditionSummary: "Grade A/B, tested at 1080p. Stands included; no cables.", description: doc("Bought together as a whole lot at the listed price. First buyer to confirm gets it.") }, [
    { category: "Monitors", manufacturer: "Dell", model: "P2422H", description: 'Dell P2422H 23.8" IPS, height-adjustable stand', quantity: 80, cosmeticGrade: "Grade B", functionalGrade: "Fully working" }
  ]);
  const lot5 = await manualLot("Lenovo ThinkCentre M720q Tiny, 120 units, wiped", { format: "sealed_bid", bidBasis: "lot_total", reserveMinor: 1e6, closesAt: closeAt(2), palletCount: 2, conditionSummary: "i5-8500T, 8 GB, 256 GB SSD. Crypto-erased. VESA mounts on about half.", description: doc("Branch office desktops from a credit union refresh.") }, [
    { category: "Desktops", manufacturer: "Lenovo", model: "ThinkCentre M720q", description: "Lenovo ThinkCentre M720q Tiny, i5-8500T, 8 GB, 256 GB SSD", quantity: 96, cosmeticGrade: "Grade B", functionalGrade: "Fully working" },
    { category: "Desktops", manufacturer: "Lenovo", model: "ThinkCentre M720q", description: "Lenovo ThinkCentre M720q Tiny, i5-8500T, 8 GB, no SSD", quantity: 24, cosmeticGrade: "Grade C", functionalGrade: "Working with faults" }
  ]);
  const lot6 = await manualLot("Enterprise SSDs 960 GB-1.92 TB, 400 units, NIST purged", { format: "sealed_bid", bidBasis: "lot_total", reserveMinor: 12e5, closesAt: closeAt(2, 18), palletCount: 1, conditionSummary: "Each drive crypto-erased and verified; erasure report by serial on the manifest.", description: doc("Samsung PM883 and Intel S4510 SATA SSDs pulled from storage arrays. Health 90%+ by SMART.") }, [
    { category: "Solid state drives", manufacturer: "Samsung", model: "PM883 1.92TB", description: "Samsung PM883 1.92 TB SATA SSD, health 90%+", quantity: 220, cosmeticGrade: "Grade A", functionalGrade: "Fully working" },
    { category: "Solid state drives", manufacturer: "Intel", model: "D3-S4510 960GB", description: "Intel D3-S4510 960 GB SATA SSD, health 90%+", quantity: 180, cosmeticGrade: "Grade A", functionalGrade: "Fully working" }
  ]);
  await phase([4, 9], [4, 9, 5]);
  const published = await publishSaleEvent(owner, { saleEventId: event.id, announce: true });
  if (published.problems?.length) fail(`Some starter lots could not be published: ${published.problems.join("; ")}`);
  const lotNumber = async (id) => (await prisma.lot.findUnique({ where: { id }, select: { lotNumber: true } })).lotNumber;
  const asNorthgate = await sessionFor(buyerUsers.northgate.userId);
  const asBluewater = await sessionFor(buyerUsers.bluewater.userId);
  const key = () => `starter-${(0, import_node_crypto6.randomBytes)(8).toString("hex")}`;
  const bid = (who, lot, args) => placeBid(who, { lotNumber: lot, idempotencyKey: key(), ...args });
  const [n1, n2, n3, n5, n6] = await Promise.all([lot1Draft.id, lot2.id, lot3.id, lot5.id, lot6.id].map(lotNumber));
  await phase([4, 13], [3, 16]);
  const win6 = await bid(asBluewater, n6, { amountMinor: 148e4 });
  await bid(asNorthgate, n6, { amountMinor: 139e4 });
  await bid(asNorthgate, n5, { amountMinor: 96e4 });
  await phase([2, 9], [1, 16]);
  await bid(asBluewater, n5, { amountMinor: 102e4 });
  await bid(asNorthgate, n1, { amountMinor: 1104e3 });
  await bid(asBluewater, n1, { amountMinor: 1065e3 });
  const [r740, c9300, dl360] = lot2.lines;
  await bid(asNorthgate, n2, { lines: [{ lotLineId: r740.id, unitPriceMinor: 115e3 }, { lotLineId: c9300.id, unitPriceMinor: 64e3 }] });
  await bid(asBluewater, n2, { lines: [{ lotLineId: r740.id, unitPriceMinor: 121e3 }, { lotLineId: c9300.id, unitPriceMinor: 61e3 }, { lotLineId: dl360.id, unitPriceMinor: 48e3 }] });
  await bid(asNorthgate, n3, { amountMinor: 15e5 });
  await bid(asBluewater, n3, { amountMinor: 155e4 });
  await bid(asNorthgate, n3, { amountMinor: 1625e3 });
  for (const [id, day] of [[lot6.id, 2], [lot5.id, 0]]) {
    const closedOn = story.at(day, 13);
    await prisma.lot.update({ where: { id }, data: { closesAt: closedOn, originalClosesAt: closedOn } });
    await phase([day, 13], [day, 13, 1]);
    await advanceLotClock({ prisma }, id);
  }
  await phase([2, 15], [2, 15, 5]);
  const [award6] = await awardLot(owner, { lotId: lot6.id, bidId: win6.bidId });
  const invoice6 = await prisma.invoice.findUnique({ where: { invoiceNumber: award6.invoiceNumber } });
  await phase([1, 11], [1, 11, 5]);
  await recordOfflinePayment(owner, { invoiceId: invoice6.id, method: "wire", amountMinor: invoice6.totalMinor, reference: `FW ${(0, import_node_crypto6.randomBytes)(4).toString("hex").toUpperCase()} BLUEWATER IT ASSET`, paidOn: story.day(1) });
  await phase([1, 11, 5], [1, 11, 10]);
  await applyTimeline(prisma, timeline);
  const order6 = await prisma.order.findUnique({ where: { orderNumber: award6.orderNumber } });
  const awarded = await prisma.award.findUnique({ where: { id: award6.awardId } });
  const inv6 = await prisma.invoice.findUnique({ where: { id: invoice6.id } });
  const dueAt = addBusinessDays(new Date(awarded.awardedAt), settings.paymentDueBusinessDays, tz);
  await prisma.invoice.update({ where: { id: inv6.id }, data: { dueAt, updatedAt: inv6.updatedAt } });
  await prisma.order.update({ where: { id: order6.id }, data: { updatedAt: order6.updatedAt, paymentDueAt: dueAt, ...order6.readyAt ? { removalDueAt: addBusinessDays(new Date(order6.readyAt), settings.removalBusinessDays, tz) } : {} } });
  for (const n of await prisma.notification.findMany({ where: { type: "lot_won", link: { endsWith: award6.invoiceNumber } } })) {
    await prisma.notification.update({ where: { id: n.id }, data: { body: n.body.replace(/is due .*\.$/, `is due ${dueAt.toDateString()}.`) } });
  }
  for (const c of [cert1, cert2]) {
    const before = await prisma.certificate.findUnique({ where: { id: c.id }, select: { issuedAt: true, updatedAt: true } });
    await prisma.$transaction((tx) => rerenderCertificate(tx, c.id), { timeout: 12e4 });
    const after = await prisma.certificate.update({ where: { id: c.id }, data: { updatedAt: before.updatedAt } });
    await prisma.storedFile.update({ where: { id: after.pdfId }, data: { createdAt: before.issuedAt, updatedAt: before.issuedAt } });
  }
  const lotRows = await prisma.lot.findMany({ where: { saleEventId: event.id }, select: { lotNumber: true, title: true, status: true, format: true, bidBasis: true, bidCount: true }, orderBy: { lotNumber: "asc" } });
  records.saleEvent = { title: event.title, lots: lotRows };
  records.paidOrder = { orderNumber: award6.orderNumber, invoiceNumber: award6.invoiceNumber, buyer: "Bluewater IT Asset Trading Inc." };
  return { password: password2, logins, records };
}

// features/keystone/domain/onboarding.ts
var ROLES = [
  { name: "Owner", permissions: [...ROLE_PERMISSIONS] },
  { name: "Sales Manager", permissions: ["canAccessDashboard", "canManageBuyers", "canManageLots", "canAwardLots", "canViewReports"] },
  { name: "Client Manager", permissions: ["canAccessDashboard", "canManageClients", "canManageJobs", "canManageSettlements", "canViewReports"] },
  { name: "Dispatcher", permissions: ["canAccessDashboard", "canDispatch", "canCollect"] },
  { name: "Driver", permissions: ["canAccessDashboard", "canCollect"] },
  { name: "Receiving", permissions: ["canAccessDashboard", "canReceive"] },
  { name: "Technician", permissions: ["canAccessDashboard", "canAuditAssets", "canSanitize"] },
  { name: "Compliance", permissions: ["canAccessDashboard", "canVerifySanitization", "canIssueCertificates", "canManageDownstream", "canViewReports"] },
  { name: "Accounting", permissions: ["canAccessDashboard", "canManagePayments", "canRefund", "canManageSettlements", "canViewReports"] }
];
var CATEGORIES = [
  { name: "Laptops", kind: "equipment", r2: "Computers", data: true, focus: true },
  { name: "Desktops", kind: "equipment", r2: "Computers", data: true, focus: true },
  { name: "Servers", kind: "equipment", r2: "Computers", data: true, focus: true },
  { name: "Networking", kind: "equipment", r2: "Networking equipment", data: true },
  { name: "Storage", kind: "equipment", r2: "Data storage devices", data: true, focus: true, children: [
    { name: "Hard drives", kind: "component", r2: "Data storage devices", data: true, focus: true },
    { name: "Solid state drives", kind: "component", r2: "Data storage devices", data: true, focus: true }
  ] },
  { name: "Mobile phones", kind: "equipment", r2: "Mobile devices", data: true, focus: true },
  { name: "Tablets", kind: "equipment", r2: "Mobile devices", data: true, focus: true },
  { name: "Monitors", kind: "equipment", r2: "Displays", focus: true },
  { name: "Printers", kind: "equipment", r2: "Imaging equipment", data: true },
  { name: "Components", kind: "component", r2: "Components", children: [
    { name: "Memory", kind: "component", r2: "Components" },
    { name: "Processors", kind: "component", r2: "Components" },
    { name: "Circuit boards", kind: "commodity", r2: "Circuit boards", focus: true },
    { name: "Power supplies", kind: "component", r2: "Components" }
  ] },
  { name: "Cables and wire", kind: "commodity", r2: "Wire and cable" },
  { name: "Batteries", kind: "commodity", r2: "Batteries", focus: true },
  { name: "CRT", kind: "commodity", r2: "CRT devices and glass", focus: true },
  { name: "Mixed e-scrap", kind: "commodity", r2: "Mixed electronics", focus: true }
];
var GRADES = [
  { kind: "cosmetic", code: "A", label: "Grade A", description: "Like new. No visible marks at arm\u2019s length." },
  { kind: "cosmetic", code: "B", label: "Grade B", description: "Light wear: small scratches or scuffs on the lid or base, screen clean." },
  { kind: "cosmetic", code: "C", label: "Grade C", description: "Heavy wear: deep scratches, dents, worn keys or small screen marks." },
  { kind: "cosmetic", code: "D", label: "Grade D", description: "Damaged: cracked housing or screen, missing parts. Sold for parts." },
  { kind: "functional", code: "F1", label: "Fully working", description: "Powers on and passes every test." },
  { kind: "functional", code: "F2", label: "Working with faults", description: "Powers on; one or more listed faults (battery, keys, ports)." },
  { kind: "functional", code: "F3", label: "Powers on, untested", description: "Powers on to BIOS or splash screen; not further tested." },
  { kind: "functional", code: "F4", label: "Not working", description: "Does not power on or fails POST. For parts or recycling." }
];
var ACCEPTED = [
  { name: "Laptops and notebooks", category: "Laptops", feeType: "free", feeMinor: 0, notes: "Batteries may stay in place." },
  { name: "Desktop computers", category: "Desktops", feeType: "free", feeMinor: 0, notes: "" },
  { name: "Servers and blade chassis", category: "Servers", feeType: "free", feeMinor: 0, notes: "Racks collected by appointment." },
  { name: "Switches, routers and firewalls", category: "Networking", feeType: "free", feeMinor: 0, notes: "" },
  { name: "Hard drives and SSDs", category: "Storage", feeType: "per_item", feeMinor: 500, notes: "Per drive, with a serial-numbered destruction record." },
  { name: "Phones and tablets", category: "Mobile phones", feeType: "free", feeMinor: 0, notes: "" },
  { name: "Flat-panel monitors", category: "Monitors", feeType: "per_item", feeMinor: 500, notes: "" },
  { name: "Printers and copiers", category: "Printers", feeType: "per_item", feeMinor: 1500, notes: "Toner removed where possible." },
  { name: "CRT monitors and TVs", category: "CRT", feeType: "per_weight", feeMinor: 45, notes: "Charged per pound of gross weight." },
  { name: "Loose batteries", category: "Batteries", feeType: "per_weight", feeMinor: 120, notes: "Tape terminals. Charged per pound." },
  { name: "Cables and cords", category: "Cables and wire", feeType: "free", feeMinor: 0, notes: "" },
  { name: "Household appliances", category: null, feeType: "free", feeMinor: 0, notes: "Not accepted: we take electronics only.", accepted: false }
];
var para = (text8) => ({ type: "paragraph", children: [{ text: text8 }] });
var heading = (text8) => ({ type: "heading", level: 3, children: [{ text: text8 }] });
var WHOLESALE_TERMS = [
  heading("Wholesale terms of sale"),
  para("All lots are sold as described in the manifest and the grade guide. Quantities and grades are counted and graded in good faith; a variance claim must be opened within the claim window shown on the invoice."),
  para("A bid is a binding offer that stays open for the bid validity period after the lot closes. The seller may award to any bid, award by line, or decline all bids. A reserve may apply and is not disclosed."),
  para("Invoices are due within the payment term shown on the invoice. An unpaid award after the grace period is a default: the award is cancelled, a restocking fee is charged and the account receives a strike."),
  para("Goods are released only after payment is confirmed. The buyer collects or arranges freight within the removal period; storage is charged per pallet per day after that."),
  para("The buyer is responsible for lawful use, resale and export of the goods and for any licence the destination country requires.")
];
var SERVICE_TERMS = [
  heading("Recycling and IT asset disposition service terms"),
  para("We collect, transport and process the equipment listed on the quote. Custody passes to us when our driver signs the pickup record and passes back only to the downstream vendor or buyer recorded on the chain-of-custody log."),
  para("Every data-bearing device is wiped to the stated standard or physically destroyed. A certificate listing every serial number is issued when processing is complete."),
  para("Where the quote includes revenue share, resale proceeds are shared at the agreed rate on a settlement statement after the goods are sold. Service fees are charged as quoted."),
  para("Items found on arrival that are not on the quote are processed at the published fee for that item.")
];
var EXPORT_CLAUSE = "The buyer will not export these goods to any country where export is prohibited and will obtain every licence needed. Non-working equipment will not be exported for disposal.";
async function onboardingStatus(context) {
  const p = context.prisma;
  const [roles, facilities, categories, grades, accepted, providers, settings] = await Promise.all([
    p.role.count(),
    p.facility.count(),
    p.materialCategory.count(),
    p.gradeDefinition.count(),
    p.acceptedItem.count(),
    p.paymentProvider.count(),
    p.storeSettings.findFirst()
  ]);
  const steps = [
    { key: "roles", label: "Staff roles", done: roles >= ROLES.length },
    { key: "settings", label: "Business details", done: Boolean(settings?.businessName) },
    { key: "facility", label: "Facility", done: facilities > 0 },
    { key: "categories", label: "Categories", done: categories > 0 },
    { key: "grades", label: "Grades", done: grades > 0 },
    { key: "accepted", label: "Accepted items", done: accepted > 0 },
    { key: "terms", label: "Terms", done: Array.isArray(settings?.wholesaleTerms) && (settings?.wholesaleTerms).length > 0 },
    { key: "payments", label: "Payment providers", done: providers >= 2 }
  ];
  return { complete: steps.every((s) => s.done), steps, cardPayments: Boolean(process.env.STRIPE_SECRET_KEY) };
}
async function serviceStatus(context) {
  const settings = await getSettings(context.prisma);
  const smtp = smtpConfig(settings);
  const fromEnv = Boolean(process.env.SMTP_HOST);
  const missing = [];
  if (!smtp) missing.push("host");
  else {
    if (!smtp.from) missing.push("from address");
    if (smtp.user && !smtp.pass) missing.push("password");
  }
  const [skipped, failed, sent] = await Promise.all([
    context.prisma.notification.count({ where: { emailStatus: "skipped" } }),
    context.prisma.notification.count({ where: { emailStatus: "failed" } }),
    context.prisma.notification.count({ where: { emailStatus: "sent" } })
  ]);
  return {
    email: {
      configured: Boolean(smtp) && missing.length === 0,
      source: smtp ? fromEnv ? "environment" : "settings" : null,
      host: smtp?.host ?? null,
      port: smtp?.port ?? null,
      from: smtp?.from || null,
      missing,
      notificationsNotEmailed: skipped,
      notificationsFailed: failed,
      notificationsEmailed: sent
    },
    cards: {
      configured: Boolean(process.env.STRIPE_SECRET_KEY),
      publishableKey: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY),
      webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      mode: (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_") ? "live" : process.env.STRIPE_SECRET_KEY ? "test keys" : null
    },
    storefrontUrl: settings.storefrontUrl || null
  };
}
async function runElectronicsRecyclingOnboarding(context, input) {
  const session = requireStaff(context, "canManageOnboarding");
  const businessName = str(input.businessName, 200);
  if (!businessName) fail("Enter the business name.");
  const f = input.facility ?? {};
  if (!str(f.addressLine1) || !str(f.city) || !str(f.postalCode)) fail("Enter the facility address.");
  const counts = {};
  const startedAt = /* @__PURE__ */ new Date();
  await context.prisma.$transaction(async (tx) => {
    for (const role of ROLES) {
      const flags = Object.fromEntries(ROLE_PERMISSIONS.map((p) => [p, role.permissions.includes(p)]));
      const existing = await tx.role.findFirst({ where: { name: role.name } });
      if (!existing) {
        await tx.role.create({ data: { name: role.name, ...flags } });
        counts.roles = (counts.roles ?? 0) + 1;
      }
    }
    const settings2 = await getSettings(tx);
    await tx.storeSettings.update({
      where: { id: settings2.id },
      data: {
        businessName,
        legalName: str(input.legalName, 200) || businessName,
        supportEmail: str(input.supportEmail, 200) || settings2.supportEmail,
        supportPhone: str(input.supportPhone, 40) || settings2.supportPhone,
        timezone: str(input.timezone, 60) || settings2.timezone || "America/Chicago",
        weightUnit: input.weightUnit === "kg" ? "kg" : "lb",
        wireInstructions: str(input.wireInstructions, 2e3) || settings2.wireInstructions,
        ...Array.isArray(settings2.wholesaleTerms) && settings2.wholesaleTerms.length ? {} : { wholesaleTerms: WHOLESALE_TERMS, wholesaleTermsVersion: "2026-1" },
        ...Array.isArray(settings2.serviceTerms) && settings2.serviceTerms.length ? {} : { serviceTerms: SERVICE_TERMS, serviceTermsVersion: "2026-1" },
        exportClause: settings2.exportClause || EXPORT_CLAUSE
      }
    });
    let facility = await tx.facility.findFirst({ orderBy: { createdAt: "asc" } });
    if (!facility) {
      facility = await tx.facility.create({
        data: {
          name: str(f.name, 200) || `${businessName} main facility`,
          code: (str(f.code, 12) || "MAIN").toUpperCase(),
          addressLine1: str(f.addressLine1, 200),
          city: str(f.city, 120),
          region: str(f.region, 120),
          postalCode: str(f.postalCode, 20),
          countryCode: (str(f.countryCode, 2) || "US").toUpperCase(),
          phone: str(f.phone, 40),
          hours: { mon: "07:30-16:30", tue: "07:30-16:30", wed: "07:30-16:30", thu: "07:30-16:30", fri: "07:30-15:00", sat: null, sun: null },
          acceptsDropOff: true,
          dockSlotMinutes: 60,
          dockSlotsPerWindow: 2,
          pickupInstructions: "Check in at the dock office with your order number. Bring a pallet jack if your truck has no liftgate."
        }
      });
      counts.facilities = 1;
    }
    const bySlug = /* @__PURE__ */ new Map();
    let order = 0;
    const addCategory = async (c, parentId) => {
      const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      let row = await tx.materialCategory.findFirst({ where: { slug } });
      if (!row) {
        row = await tx.materialCategory.create({ data: { name: c.name, slug, kind: c.kind, r2Category: c.r2, isFocusMaterial: Boolean(c.focus), dataBearingDefault: Boolean(c.data), sortOrder: order += 10, parentId } });
        counts.categories = (counts.categories ?? 0) + 1;
      }
      bySlug.set(c.name, row.id);
      for (const child of c.children ?? []) await addCategory(child, row.id);
    };
    for (const c of CATEGORIES) await addCategory(c, null);
    let g = 0;
    for (const grade of GRADES) {
      g += 10;
      if (!await tx.gradeDefinition.findFirst({ where: { kind: grade.kind, code: grade.code } })) {
        await tx.gradeDefinition.create({ data: { ...grade, sortOrder: g } });
        counts.grades = (counts.grades ?? 0) + 1;
      }
    }
    let a = 0;
    for (const item of ACCEPTED) {
      a += 10;
      if (await tx.acceptedItem.findFirst({ where: { name: item.name } })) continue;
      await tx.acceptedItem.create({ data: { name: item.name, categoryId: item.category ? bySlug.get(item.category) ?? null : null, accepted: item.accepted ?? true, feeType: item.feeType, feeMinor: item.feeMinor, notes: item.notes, sortOrder: a } });
      counts.acceptedItems = (counts.acceptedItems ?? 0) + 1;
    }
    for (const cert of input.certifications ?? []) {
      const name = str(cert.name, 40);
      if (!name) continue;
      if (!str(cert.certificateNumber, 80)) fail(`Enter the certificate number for ${name}, or untick it.`);
      if (await tx.certification.findFirst({ where: { name, facilityId: facility.id } })) continue;
      await tx.certification.create({ data: { name, certificateNumber: str(cert.certificateNumber, 80), certifyingBody: str(cert.certifyingBody, 120), facilityId: facility.id, expiresOn: cert.expiresOn ? new Date(cert.expiresOn) : null, isPublic: true } });
      counts.certifications = (counts.certifications ?? 0) + 1;
    }
    const providers = [
      { code: "manual", name: "Bank transfer", fn: "manual" },
      { code: "stripe", name: "Card (Stripe)", fn: "stripe" }
    ];
    for (const p of providers) {
      if (await tx.paymentProvider.findFirst({ where: { code: p.code } })) continue;
      await tx.paymentProvider.create({ data: { code: p.code, name: p.name, isInstalled: true, createPaymentFunction: p.fn, capturePaymentFunction: p.fn, refundPaymentFunction: p.fn, getPaymentStatusFunction: p.fn, generatePaymentLinkFunction: p.fn, handleWebhookFunction: p.fn } });
      counts.paymentProviders = (counts.paymentProviders ?? 0) + 1;
    }
    await tx.user.update({ where: { id: session.itemId }, data: { onboardingStatus: "completed" } });
  }, { timeout: 6e4 });
  if (input.template !== "full") return { counts };
  if (input.starterPassword && String(input.starterPassword).length < 10) fail("Use a starter password of at least 10 characters.");
  const settings = await getSettings(context.prisma);
  const starter = await seedStarterRecords(context, { businessName, supportEmail: settings.supportEmail, password: input.starterPassword, since: startedAt });
  return { counts, starter };
}

// features/keystone/mutations/operations.ts
var q = (access, run) => ({ kind: "query", access, run });
var m = (access, run) => ({ kind: "mutation", access, run });
var SELL = ["canManageLots"];
var AWARD = ["canAwardLots"];
var BUYERS2 = ["canManageBuyers"];
var PAY = ["canManagePayments"];
var OPERATIONS = {
  // ---------------- public storefront (§5.1)
  storefrontSettings: q("public", (c) => storefrontSettings(c)),
  publicLots: q("public", (c, i) => publicLots(c, i ?? {})),
  publicLot: q("public", (c, i) => publicLot(c, i)),
  publicSaleEvents: q("public", (c) => publicSaleEvents(c)),
  publicCertifications: q("public", (c) => publicCertifications(c)),
  publicAcceptedItems: q("public", (c) => publicAcceptedItems(c)),
  publicFacilities: q("public", (c) => publicFacilities(c)),
  publicGradeGuide: q("public", (c) => publicGradeGuide(c)),
  publicCategories: q("public", (c) => publicCategories(c)),
  verifyCertificate: q("public", (c, i) => verifyCertificate(c, i)),
  submitPickupRequest: m("public", (c, i) => submitPickupRequest(c, i)),
  registerBuyer: m("public", (c, i) => registerBuyer(c, i)),
  // ---------------- buyer account (§5.2)
  myBuyerCompany: q("account", (c) => myBuyerCompany(c)),
  buyerLots: q("account", (c, i) => buyerLots(c, i ?? {})),
  buyerLot: q("account", (c, i) => buyerLot(c, i)),
  myBids: q("account", (c, i) => myBids(c, i ?? {})),
  myInvoices: q("account", (c) => myInvoices(c)),
  myInvoice: q("account", (c, i) => myInvoice(c, i)),
  myOrders: q("account", (c) => myOrders(c)),
  myOrder: q("account", (c, i) => myOrder(c, i)),
  saveBuyerApplication: m("account", (c, i) => saveBuyerApplication(c, i)),
  uploadBuyerDocument: m("account", (c, i) => uploadBuyerDocument(c, i)),
  submitBuyerApplication: m("account", (c, i) => submitBuyerApplication(c, i)),
  replyToBuyerMessage: m("account", (c, i) => replyToBuyerMessage(c, i)),
  acceptWholesaleTerms: m("account", (c, i) => acceptWholesaleTerms(c, i)),
  downloadLotManifest: m("account", (c, i) => downloadLotManifest(c, i)),
  downloadBidSheet: m("account", (c, i) => downloadBidSheet(c, i)),
  checkBidSheet: m("account", (c, i) => checkBidSheet(c, i)),
  // Old name, kept until the storefront calls checkBidSheet.
  previewBidSheet: m("account", (c, i) => checkBidSheet(c, i)),
  placeBid: m("account", (c, i) => placeBid(c, i)),
  placeBidFromSheet: m("account", (c, i) => placeBidFromSheet(c, i)),
  withdrawBid: m("account", (c, i) => withdrawBid(c, i)),
  buyNow: m("account", (c, i) => buyNow(c, i)),
  setOrderRelease: m("account", (c, i) => setOrderRelease(c, i)),
  downloadOrderDocument: m("account", (c, i) => downloadOrderDocument(c, i)),
  downloadInvoice: m("account", (c, i) => downloadInvoice(c, i)),
  initiateInvoicePaymentSession: m("account", (c, i) => initiateInvoicePaymentSession(c, i)),
  completeInvoicePayment: m("account", (c, i) => completeInvoicePayment(c, i)),
  reportBankTransfer: m("account", (c, i) => reportBankTransfer(c, i)),
  // ---------------- client account (§5.3)
  myJobs: q("account", (c) => myJobs(c)),
  myJob: q("account", (c, i) => myJob(c, i)),
  acceptJobQuote: m("account", (c, i) => acceptJobQuote(c, i)),
  declineJobQuote: m("account", (c, i) => declineJobQuote(c, i)),
  downloadCertificate: m("account", (c, i) => downloadCertificate(c, i)),
  downloadSettlement: m("account", (c, i) => downloadSettlement(c, i)),
  // requestJob is both: a client asks (account) and staff creates one for a caller (K2); the domain decides.
  requestJob: m("account", (c, i) => requestJob(c, i)),
  // ---------------- platform: Today
  todaySummary: q(["canAccessDashboard"], (c) => todaySummary(c)),
  // ---------------- platform: Sell
  reviewBuyerApplication: m(BUYERS2, (c, i) => reviewBuyerApplication(c, i)),
  reviewBuyerDocument: m(BUYERS2, (c, i) => reviewBuyerDocument(c, i)),
  messageBuyer: m(BUYERS2, (c, i) => messageBuyer(c, i)),
  suspendBuyer: m(BUYERS2, (c, i) => suspendBuyer(c, i)),
  reinstateBuyer: m(BUYERS2, (c, i) => reinstateBuyer(c, i)),
  uploadManifest: m(SELL, (c, i) => uploadManifest(c, i)),
  mapManifest: m(SELL, (c, i) => mapManifest(c, i)),
  validateManifest: m(SELL, (c, i) => validateManifest(c, i)),
  commitManifest: m(SELL, (c, i) => commitManifest(c, i)),
  discardManifest: m(SELL, (c, i) => discardManifest(c, i)),
  staffLotManifest: m(["canManageLots", "canAwardLots", "canViewReports"], (c, i) => staffLotManifest(c, i)),
  createLotFromAssets: m(SELL, (c, i) => createLotFromAssets(c, i)),
  removeAssetsFromLot: m(SELL, (c, i) => removeAssetsFromLot(c, i)),
  publishLot: m(SELL, (c, i) => publishLot(c, i)),
  publishSaleEvent: m(SELL, (c, i) => publishSaleEvent(c, i)),
  postLotAddendum: m(SELL, (c, i) => postLotAddendum(c, i)),
  extendLotClose: m(SELL, (c, i) => extendLotClose(c, i)),
  cancelLot: m(SELL, (c, i) => cancelLot(c, i)),
  lotBidBoard: q(["canManageLots", "canAwardLots"], (c, i) => lotBidBoard(c, i)),
  placeBidForBuyer: m(SELL, (c, i) => placeBidForBuyer(c, i)),
  awardLot: m(AWARD, (c, i) => awardLot(c, i)),
  declineLotBids: m(AWARD, (c, i) => declineLotBids(c, i)),
  relistLot: m(SELL, (c, i) => relistLot(c, i)),
  reAwardToRunnerUp: m(AWARD, (c, i) => reAwardToRunnerUp(c, i)),
  markOrderReady: m(["canManageLots", "canReceive"], (c, i) => markOrderReady(c, i)),
  releaseOrder: m(["canManageLots", "canReceive"], (c, i) => releaseOrder(c, i)),
  defaultOrder: m(SELL, (c, i) => defaultOrder(c, i)),
  waiveRestockingFee: m(SELL, (c, i) => waiveRestockingFee(c, i)),
  cancelOrder: m(SELL, (c, i) => cancelOrder(c, i)),
  staffOrderDocument: m(["canManageLots", "canReceive", "canManagePayments"], (c, i) => staffOrderDocument(c, i)),
  bookDockAppointment: m(["canManageLots", "canReceive", "canDispatch"], (c, i) => bookDockAppointment(c, i)),
  setDockAppointmentStatus: m(["canManageLots", "canReceive", "canDispatch"], (c, i) => setDockAppointmentStatus(c, i)),
  dockDay: q(["canManageLots", "canReceive", "canDispatch"], (c, i) => dockDay(c, i)),
  openClaim: m(SELL, (c, i) => openClaim(c, i)),
  resolveClaim: m(SELL, (c, i) => resolveClaim(c, i)),
  // ---------------- platform: Collect
  quoteJob: m(["canManageJobs"], (c, i) => quoteJob(c, i)),
  recordJobAcceptance: m(["canManageJobs"], (c, i) => recordJobAcceptance(c, i)),
  staffRequestJob: m(["canManageJobs", "canManageClients"], (c, i) => requestJob(c, i)),
  cancelJob: m(["canManageJobs"], (c, i) => cancelJob(c, i)),
  setJobHold: m(["canManageJobs"], (c, i) => setJobHold(c, i)),
  invoiceJob: m(["canManageJobs", "canManagePayments"], (c, i) => invoiceJob(c, i)),
  scheduleJob: m(["canDispatch"], (c, i) => scheduleJob(c, i)),
  startJobRoute: m(["canCollect", "canDispatch", "canReceive"], (c, i) => startJobRoute(c, i)),
  collectJob: m(["canCollect", "canDispatch", "canReceive"], (c, i) => collectJob(c, i)),
  receiveContainer: m(["canReceive"], (c, i) => receiveContainer(c, i)),
  resolveSealException: m(["canReceive", "canIssueCertificates"], (c, i) => resolveSealException(c, i)),
  // ---------------- platform: Process
  startProcessing: m(["canAuditAssets", "canManageJobs"], (c, i) => startProcessing(c, i)),
  auditAsset: m(["canAuditAssets"], (c, i) => auditAsset(c, i)),
  importAssets: m(["canAuditAssets"], (c, i) => importAssets(c, i)),
  exportAssets: m(["canAuditAssets", "canManageClients", "canViewReports", "canIssueCertificates"], (c, i) => exportAssets(c, i ?? {})),
  recordSanitization: m(["canSanitize"], (c, i) => recordSanitization(c, i)),
  importErasureReport: m(["canSanitize"], (c, i) => importErasureReport(c, i)),
  verifySanitization: m(["canVerifySanitization"], (c, i) => verifySanitization(c, i)),
  sanitizationSample: q(["canVerifySanitization"], (c, i) => sanitizationSample(c, i ?? {})),
  setAssetDisposition: m(["canAuditAssets", "canManageLots"], (c, i) => setAssetDisposition(c, i)),
  placeAssetHold: m(["canAuditAssets", "canIssueCertificates"], (c, i) => placeAssetHold(c, i)),
  releaseAssetHold: m(["canAuditAssets", "canIssueCertificates"], (c, i) => releaseAssetHold(c, i)),
  // ---------------- platform: Comply
  completeJob: m(["canIssueCertificates"], (c, i) => completeJob(c, i)),
  closeJob: m(["canManageJobs", "canManageSettlements"], (c, i) => closeJob(c, i)),
  issueCertificate: m(["canIssueCertificates"], (c, i) => issueCertificate(c, i)),
  revokeCertificate: m(["canIssueCertificates"], (c, i) => revokeCertificate(c, i)),
  shipOutbound: m(["canManageDownstream"], (c, i) => shipOutbound(c, i)),
  confirmOutboundReceipt: m(["canManageDownstream"], (c, i) => confirmOutboundReceipt(c, i)),
  massBalanceReport: q(["canManageDownstream", "canIssueCertificates", "canViewReports"], (c, i) => massBalanceReport(c, i ?? {})),
  attachFile: m(["canManageLots", "canManageSettings", "canIssueCertificates", "canManageDownstream"], (c, i) => attachFile(c, i)),
  staffDownloadFile: m(["canIssueCertificates", "canManageSettlements", "canManageClients", "canViewReports"], (c, i) => staffDownloadFile(c, i)),
  // ---------------- platform: Money
  staffInvoicePdf: m(["canManagePayments", "canManageLots", "canManageSettlements", "canViewReports"], (c, i) => staffInvoicePdf(c, i)),
  addInvoiceLine: m(["canManagePayments", "canManageLots"], (c, i) => addInvoiceLine(c, i)),
  voidInvoice: m(PAY, (c, i) => voidInvoice(c, i)),
  confirmBankTransfer: m(PAY, (c, i) => confirmBankTransfer(c, i)),
  rejectBankTransfer: m(PAY, (c, i) => rejectBankTransfer(c, i)),
  recordOfflinePayment: m(PAY, (c, i) => recordOfflinePayment(c, i)),
  checkPaymentSession: m(PAY, (c, i) => checkPaymentSession(c, i)),
  refundPayment: m(["canRefund"], (c, i) => refundPayment(c, i)),
  buildSettlement: m(["canManageSettlements"], (c, i) => buildSettlement(c, i)),
  addSettlementLine: m(["canManageSettlements"], (c, i) => addSettlementLine(c, i)),
  removeSettlementLine: m(["canManageSettlements"], (c, i) => removeSettlementLine(c, i)),
  submitSettlementForReview: m(["canManageSettlements"], (c, i) => submitSettlementForReview(c, i)),
  publishSettlement: m(["canManageSettlements"], (c, i) => publishSettlement(c, i)),
  recordSettlementDispute: m(["canManageSettlements"], (c, i) => recordSettlementDispute(c, i)),
  recordSettlementPayout: m(["canManageSettlements", "canManagePayments"], (c, i) => recordSettlementPayout(c, i)),
  salesReport: q(["canViewReports"], (c, i) => salesReport(c, i ?? {})),
  clientImpactReport: q(["canViewReports", "canManageClients"], (c, i) => clientImpactReport(c, i)),
  accountingExport: m(["canViewReports", "canManagePayments"], (c, i) => accountingExport(c, i ?? {})),
  // ---------------- platform: Settings
  onboardingStatus: q(["canManageOnboarding", "canManageSettings"], (c) => onboardingStatus(c)),
  serviceStatus: q(["canManageSettings", "canManagePayments", "canManageOnboarding"], (c) => serviceStatus(c)),
  runElectronicsRecyclingOnboarding: m(["canManageOnboarding"], (c, i) => runElectronicsRecyclingOnboarding(c, i ?? {}))
};
function queryError(name, error) {
  if (error instanceof import_graphql.GraphQLError) return error;
  if (error instanceof DomainError || error?.name === "RuleError") return new import_graphql.GraphQLError(error.message, { extensions: { code: "REFUSED" } });
  console.error(`[query ${name}]`, error);
  return new import_graphql.GraphQLError("Something went wrong loading this. Try again.", { extensions: { code: "INTERNAL" } });
}
function guard(op, context) {
  if (Array.isArray(op.access)) requireStaff(context, ...op.access);
}
function buildResolvers() {
  const Query = {};
  const Mutation = {};
  for (const [name, op] of Object.entries(OPERATIONS)) {
    if (op.kind === "query") {
      Query[name] = async (_root, args, context) => {
        try {
          guard(op, context);
          return toJson(await op.run(context, args.input ?? {}));
        } catch (error) {
          throw queryError(name, error);
        }
      };
    } else {
      Mutation[name] = async (_root, args, context) => {
        const result = await command(async () => {
          guard(op, context);
          return toJson(await op.run(context, args.input ?? {}));
        });
        return result;
      };
    }
  }
  return { Query, Mutation };
}
function buildTypeDefs() {
  const queries = Object.entries(OPERATIONS).filter(([, o]) => o.kind === "query").map(([n]) => `    ${n}(input: JSON): JSON`);
  const mutations = Object.entries(OPERATIONS).filter(([, o]) => o.kind === "mutation").map(([n]) => `    ${n}(input: JSON): CommandResult!`);
  return `
  type CommandResult {
    success: Boolean!
    error: String
    data: JSON
  }
  type Query {
    redirectToInit: Boolean
${queries.join("\n")}
  }
  type Mutation {
${mutations.join("\n")}
  }
`;
}

// features/keystone/mutations/index.ts
function extendGraphqlSchema(baseSchema) {
  const { Query, Mutation } = buildResolvers();
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: buildTypeDefs(),
    resolvers: {
      Query: { redirectToInit: redirectToInit_default, ...Query },
      Mutation
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer2 = require("nodemailer");
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function passwordResetUrl(base, kind, token, email) {
  const root = base.replace(/\/$/, "");
  const query = `token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  return kind === "staff" ? `${root}/dashboard/reset?${query}` : `${root}/reset-password?${query}`;
}
function passwordResetHtml({ url, businessName, name }) {
  return `
    <body style="background:#f9f9f9;margin:0;padding:24px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;max-width:560px;margin:auto;border-radius:8px;font-family:Helvetica,Arial,sans-serif;color:#333333;">
        <tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:bold;">${escapeHtml(businessName)}</td></tr>
        <tr><td style="padding:8px 28px;font-size:15px;line-height:22px;">${name ? `Hello ${escapeHtml(name)},<br><br>` : ""}Someone asked to reset the password for this account. Use the button below to choose a new one.</td></tr>
        <tr><td style="padding:16px 28px;"><a href="${url}" target="_blank" style="display:inline-block;background:#1f2937;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:15px;font-weight:bold;">Choose a new password</a></td></tr>
        <tr><td style="padding:8px 28px 28px;font-size:13px;line-height:20px;color:#666666;">The link works once and expires soon. If you did not ask for this, ignore this email; your password stays the same.</td></tr>
      </table>
    </body>`;
}
async function sendPasswordResetEmail({ token, identity, context }) {
  const prisma = context.sudo().prisma;
  const settings = await getSettings(prisma);
  const smtp = smtpConfig(settings);
  if (!smtp) {
    console.warn("[email] Password reset requested but no mail server is set up in Settings or SMTP_*.");
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: identity }, select: { kind: true, name: true, email: true } });
  if (!user) return;
  const base = process.env.SMTP_STORE_LINK || settings.storefrontUrl || "";
  const url = passwordResetUrl(base, user.kind, token, user.email);
  const businessName = settings.businessName || "Account";
  const transport = (0, import_nodemailer2.createTransport)({ host: smtp.host, port: smtp.port, secure: smtp.port === 465, auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : void 0 });
  await transport.sendMail({
    from: smtp.from ? `${businessName} <${smtp.from}>` : void 0,
    to: user.email,
    subject: `Reset your ${businessName} password`,
    text: `Someone asked to reset the password for this account. Choose a new one here:

${url}

If you did not ask for this, ignore this email.

${businessName}`,
    html: passwordResetHtml({ url, businessName, name: user.name || "" })
  });
}

// features/keystone/mcp-oauth/session.ts
async function resolveMcpAccessToken(context, token, listKey = "User") {
  try {
    const sudo = context.sudo();
    const record = await sudo.db.OAuthToken.findOne({ where: { token: digestToken(token) } });
    if (!record || record.tokenType !== "access_token" || record.isRevoked !== "false" || !record.userId || !record.expiresAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      return void 0;
    }
    const app = await sudo.db.OAuthApp.findOne({ where: { clientId: record.clientId } });
    if (!app || app.status !== "active") return void 0;
    const mcp = {
      clientId: record.clientId,
      scopes: storedScopes(record.scopes),
      tokenId: String(record.id)
    };
    return { itemId: String(record.userId), listKey, mcp };
  } catch {
    return void 0;
  }
}
function withMcpBearerSessions(strategy, listKey = "User") {
  return {
    ...strategy,
    async get({ context }) {
      const token = bearerToken(context?.req?.headers?.authorization);
      if (isMcpAccessToken(token)) return resolveMcpAccessToken(context, token, listKey);
      return strategy.get({ context });
    }
  };
}

// features/keystone/lib/prismaErrors.ts
var PrismaQueryError = class extends Error {
  constructor(message, code, meta) {
    super(message);
    this.name = "PrismaQueryError";
    this.code = code;
    this.meta = meta;
  }
};
function isKeystonePrismaError(value) {
  return Boolean(value && typeof value === "object" && value.name === "GraphQLError" && value.extensions?.code === "KS_PRISMA_ERROR");
}
function rethrowPrismaErrors(client) {
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        const result = await query(args);
        if (isKeystonePrismaError(result)) {
          const prisma = result.extensions.prisma ?? {};
          const message = result.extensions.debug?.message ?? result.message;
          throw new PrismaQueryError(message, prisma.code ?? "KS_PRISMA_ERROR", prisma.meta);
        }
        return result;
      }
    }
  });
}

// features/keystone/index.ts
var databaseURL = process.env.DATABASE_URL || "file:./keystone.db";
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  secret: process.env.SESSION_SECRET || (0, import_node_crypto7.createHash)("sha256").update(`openfront-electronics-recycling:${databaseURL}`).digest("hex")
};
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      kind: "staff",
      role: {
        create: {
          name: "Owner",
          ...Object.fromEntries(ROLE_PERMISSIONS.map((permission) => [permission, true]))
        }
      }
    }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail({ token: args.token, identity: args.identity, context: args.context });
    }
  },
  sessionData: SESSION_DATA
});
var keystone_default = withAuth(
  (0, import_core28.config)({
    db: {
      provider: "postgresql",
      url: databaseURL,
      // Failed queries must throw (Keystone returns them as values otherwise).
      extendPrismaClient: rethrowPrismaErrors
    },
    lists: models,
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false
    },
    // MCP OAuth bearer tokens resolve to the approving user; everything else is unchanged.
    session: withMcpBearerSessions((0, import_session.statelessSessions)(sessionConfig)),
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
