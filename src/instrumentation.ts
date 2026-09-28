/**
 * Runs once when a server instance starts, before it takes a request (Next's
 * instrumentation hook).
 *
 * It pins the server's own clock to India time. NutriDrip works in Bengaluru:
 * "today's sessions", "this month's revenue" and the midnight a schedule starts
 * from are Bengaluru's, but most cloud hosts run in UTC, where midnight comes
 * five and a half hours late and a session at 00:30 would count as yesterday.
 * Setting TZ here makes every Date on the server read India time. The
 * formatters in lib/time also name the timezone themselves, so what is shown
 * is right even in a browser set to another one.
 *
 * APP_TIME_ZONE can move it, should the service ever run elsewhere.
 */
export function register() {
  process.env.TZ = process.env.APP_TIME_ZONE || "Asia/Kolkata";
}
