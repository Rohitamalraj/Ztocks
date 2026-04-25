export async function waitForHash(hash: `0x${string}`) {
  const { waitForTransactionReceipt } = await import("@wagmi/core");
  const { wagmiConfig } = await import("@/lib/wagmi");
  await waitForTransactionReceipt(wagmiConfig, { hash });
}
