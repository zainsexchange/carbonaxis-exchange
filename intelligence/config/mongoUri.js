import dns from "node:dns";
import dnsPromises from "node:dns/promises";

function ensureDnsServers() {
  const configured = String(
    process.env.DNS_SERVERS ??
      (process.platform === "win32" ? "8.8.8.8,1.1.1.1" : "")
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    dns.setServers(configured);
  }
}

/**
 * Convert mongodb+srv://… to mongodb://host1:27017,host2:27017,…
 * Uses SRV records only — skips TXT lookups that often ETIMEOUT on Windows/corporate DNS.
 */
export async function resolveMongoUri(uri = "") {
  const raw = String(uri || "").trim();

  if (!raw) {
    throw new Error("MONGO_URI is missing.");
  }

  if (!raw.startsWith("mongodb+srv://")) {
    return raw;
  }

  ensureDnsServers();

  const withoutProtocol = raw.slice("mongodb+srv://".length);
  const atIndex = withoutProtocol.lastIndexOf("@");

  if (atIndex < 0) {
    throw new Error("MONGO_URI mongodb+srv value is missing credentials.");
  }

  const auth = withoutProtocol.slice(0, atIndex);
  const hostAndRest = withoutProtocol.slice(atIndex + 1);
  const slashIndex = hostAndRest.indexOf("/");
  const hostOnly =
    slashIndex >= 0 ? hostAndRest.slice(0, slashIndex) : hostAndRest;
  const pathAndQuery =
    slashIndex >= 0 ? hostAndRest.slice(slashIndex) : "/";

  const hostname = hostOnly.split(":")[0].split("?")[0];
  const srvName = `_mongodb._tcp.${hostname}`;

  const records = await dnsPromises.resolveSrv(srvName);

  if (!records.length) {
    throw new Error(`No SRV records found for ${srvName}`);
  }

  const hosts = records
    .map((record) => `${record.name}:${record.port || 27017}`)
    .join(",");

  const [pathPart, queryPart = ""] = pathAndQuery.split("?");
  const params = new URLSearchParams(queryPart);

  // mongodb+srv implies TLS; standard URI must set it explicitly.
  if (!params.has("tls") && !params.has("ssl")) {
    params.set("tls", "true");
  }

  if (!params.has("authSource")) {
    params.set("authSource", "admin");
  }

  // Drop srv-only hints that confuse standard URIs.
  params.delete("srvServiceName");

  const query = params.toString();
  const dbPath = pathPart && pathPart !== "/" ? pathPart : "/";

  return `mongodb://${auth}@${hosts}${dbPath}${query ? `?${query}` : ""}`;
}
