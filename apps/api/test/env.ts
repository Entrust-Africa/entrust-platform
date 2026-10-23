// Runs before each test file, so the app (which builds Better Auth when imported) finds its
// settings. DATABASE_URL must point at a database with the migrations applied.
try {
  process.loadEnvFile("../../.env");
} catch {
  // Fall back to variables already in the environment.
}
process.env.BETTER_AUTH_SECRET ||= "api-tests-only-secret-0123456789abcdef";
process.env.BETTER_AUTH_URL ||= "http://localhost:4000";
