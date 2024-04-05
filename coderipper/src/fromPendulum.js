import { Keypair } from "stellar-sdk";
import { prettyPrintVaultId, VaultService } from "./util/spacewalk.js";
import { decimalToStellarNative } from "./util/convert.js";
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

  await executeSpacewalkRedeem(
    stellarAccount.publicKey(),
    config.pendulumSecret
  );

  process.exit();
}

export default async function executeSpacewalkRedeem(
  stellarTargetAccountId,
  pendulumSecret
) {
  console.log("🚀 « stellarTargetAccountId:", stellarTargetAccountId);
  const amountString = "1";

  console.log("Executing Spacewalk redeem");

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
  let stellarTargetKeypair = Keypair.fromPublicKey(stellarTargetAccountId);
  let stellarTargetAccountIdRaw = stellarTargetKeypair.rawPublicKey();

  console.log(
    `Requesting redeem of ${amountRaw} tokens for vault ${prettyPrintVaultId(
      xlmVaultId
    )}`
  );
  let redeemRequestEvent = await vaultService.requestRedeem(
    pendulumSecret,
    amountRaw,
    stellarTargetAccountIdRaw
  );

  console.log(
    `Successfully posed redeem request ${
      redeemRequestEvent.redeemId
    } for vault ${prettyPrintVaultId(xlmVaultId)}`
  );

  const eventListener = EventListener.getEventListener(pendulumApi.api);
  // We wait for up to 5 minutes
  const maxWaitingTimeMin = 5;
  const maxWaitingTimeMs = maxWaitingTimeMin * 60 * 1000;
  console.log(
    `Waiting up to ${maxWaitingTimeMin} minutes for redeem execution event...`
  );

  const redeemEvent = await eventListener.waitForRedeemExecuteEvent(
    redeemRequestEvent.redeemId,
    maxWaitingTimeMs
  );

  console.log(
    `Successfully redeemed ${
      redeemEvent.amount
    } tokens for vault ${prettyPrintVaultId(xlmVaultId)}`
  );
  console.log("ready  ");
}

main().then(console.log, console.error);
