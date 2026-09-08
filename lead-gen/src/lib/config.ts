type RequiredVar =
  | "DATABASE_URL"
  | "DATABLIST_API_KEY"
  | "DATABLIST_COLLECTION_ID"
  | "GOOGLE_MAPS_API_KEY"
  | "PIPELINE_TIMEZONE"
  | "APP_AUTH_SECRET"
  | "ADMIN_EMAIL"
  | "ADMIN_PASSWORD";

function requireEnv(name: RequiredVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  databaseUrl: requireEnv("DATABASE_URL"),
  datablistApiKey: requireEnv("DATABLIST_API_KEY"),
  datablistCollectionId: requireEnv("DATABLIST_COLLECTION_ID"),
  googleMapsApiKey: requireEnv("GOOGLE_MAPS_API_KEY"),
  pipelineTimezone: requireEnv("PIPELINE_TIMEZONE"),
  appAuthSecret: requireEnv("APP_AUTH_SECRET"),
  placesAlertThreshold: process.env.PLACES_ALERT_THRESHOLD
    ? Number(process.env.PLACES_ALERT_THRESHOLD)
    : undefined,
  adminEmail: requireEnv("ADMIN_EMAIL"),
  adminPassword: requireEnv("ADMIN_PASSWORD"),
  adminName: process.env.ADMIN_NAME || "Admin",
  // Optional — without it, sendWelcomeEmail logs instead of sending.
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
};
