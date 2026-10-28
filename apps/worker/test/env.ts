try {
  process.loadEnvFile("../../.env");
} catch {
  // Fall back to environment variables already set in process.
}
process.env.DATABASE_URL ||= "postgres://entrust:entrust@localhost:5432/entrust_platform";
process.env.EMAIL_MODE = "log";
