/**
 * Download the free GeoLite2 city database used by ip-location-api.
 * First catalog visit does this too; run the script before a deploy so the
 * first request does not wait on the download.
 */
process.env.ILA_FIELDS = "country,city,area,latitude,longitude";
process.env.ILA_LANGUAGE = "ru";
process.env.ILA_SMALL_MEMORY = "true";
process.env.ILA_SILENT = "false";
process.env.ILA_LICENSE_KEY = process.env.ILA_LICENSE_KEY || "redist";
process.env.ILA_DATA_DIR ??= new URL("../data/geoip/", import.meta.url).pathname;
process.env.ILA_TMP_DATA_DIR ??= new URL("../data/geoip-tmp/", import.meta.url).pathname;
process.env.ILA_AUTO_UPDATE = "false";

await import("ip-location-api");
console.log("GeoLite2 city database is ready in data/geoip");
process.exit(0);
