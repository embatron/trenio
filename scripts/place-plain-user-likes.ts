import { grantPlainUserLikes } from "../src/lib/catalog/plain-user-like.server";
import { writeLog } from "../src/lib/log/logger";

async function main() {
  const placed = await grantPlainUserLikes();
  if (placed > 0) {
    void writeLog({
      level: "info",
      domain: "catalog",
      action: "catalog.like",
      outcome: "success",
      message: "Лайкосы простого пользователя поставлены.",
      context: { placed },
    });
  }
  console.log(`placed ${placed}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.split("postgres://")[0]);
  process.exit(1);
});
