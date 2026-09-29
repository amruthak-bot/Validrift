/* Deployment override for the Validrift frontend API base URL.
 * Local dev: this file is intentionally empty — config.js falls back to http://127.0.0.1:8000/api.
 * Hosted deploys (e.g. Render static site): the build step overwrites this file with
 *   window.VALIDRIFT_API_BASE_URL="<backend-public-url>/api";
 * which config.js picks up because this script loads before js/config.js.
 * No secrets live here. Never put API keys in frontend files.
 */
