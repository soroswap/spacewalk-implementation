import { Keypair, Asset } from "stellar-sdk";
import { prettyPrintVaultId, VaultService } from "./util/spacewalk.js";
import {
  decimalToStellarNative,
  deriveShortenedRequestId,
} from "./util/convert.js";
import { ApiManager } from "./util/polkadot-api.js";
import { EventListener } from "./util/event-listeners.js";

async function getConfig() {
  return {
    pendulumSecret: "PENDULUM_SECRET",
    stellarFundingSecret: "STELLAR_PRIVATE_KEY",
  };
}

async function main() {
  const config = await getConfig();

  const stellarAccount = Keypair.fromSecret(config.stellarFundingSecret);

  await executeSpacewalkIssuance(
    stellarAccount.publicKey(),
    config.pendulumSecret
  );

  process.exit();
}

export default async function executeSpacewalkIssuance(
  stellarTargetAccountId,
  pendulumSecret
) {
  console.log("🚀 « stellarTargetAccountId:", stellarTargetAccountId);
  const amountString = "1";

  console.log("Executing Spacewalk Issuance");

  const pendulumApi = await new ApiManager().getApi();

  const XLM_VAULT_ACCOUNT_ID =
    "6cKoXRGxqpXQZavYAXPuXYFKNAev8QuHJ2zhh9rnWc3XMmTr";

  let xlmVaultId = {
    accountId: XLM_VAULT_ACCOUNT_ID,
    currencies: {
      collateral: { XCM: 0 },
      wrapped: { Stellar: "StellarNative" },
    },
  };

  let vaultService = new VaultService(xlmVaultId, pendulumApi);

  console.log("🚀 « amountString:", amountString);
  const amountRaw = decimalToStellarNative(amountString).toString();
  console.log("🚀 « amountRaw:", amountRaw);

  console.log(
    `Requesting issuance of ${amountRaw} tokens for vault ${prettyPrintVaultId(
      xlmVaultId
    )}`
  );
  let issuanceRequestEvent = await vaultService.requestIssuance(
    pendulumSecret,
    amountRaw
  );

  console.log(
    `Successfully posed issuance request ${
      issuanceRequestEvent.issueId
    } for vault ${prettyPrintVaultId(xlmVaultId)}`
  );

  console.log("🚀 « issuanceRequestEvent:", issuanceRequestEvent);

  console.log("-------------------------------------");
  console.log("Send 1 XLM to this address and memo");
  console.log("-------------------------------------");
  let asset = Asset.native();
  console.log("🚀 « asset:", asset);

  const memo = deriveShortenedRequestId(issuanceRequestEvent.issueId);
  console.log("🚀 « memo:", memo);

  let stellarVaultAccountFromEvent = issuanceRequestEvent.vaultStellarPublicKey;
  console.log(
    "🚀 « stellarVaultAccountFromEvent:",
    stellarVaultAccountFromEvent
  );

  const eventListener = EventListener.getEventListener(pendulumApi.api);
  // We wait for up to 5 minutes
  const maxWaitingTimeMin = 5;
  const maxWaitingTimeMs = maxWaitingTimeMin * 60 * 1000;
  console.log(
    `Waiting up to ${maxWaitingTimeMin} minutes for redeem execution event...`
  );

  const issueEvent = await eventListener.waitForIssueExecuteEvent(
    issuanceRequestEvent.issueId,
    maxWaitingTimeMs
  );
  console.log(
    `Successfully issued ${
      issueEvent.amount
    } tokens for vault ${prettyPrintVaultId(xlmVaultId)}`
  );
  console.log("ready  ");
}

main().then(console.log, console.error);
