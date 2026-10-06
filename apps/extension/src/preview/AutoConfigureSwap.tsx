import { useEffect } from "react";

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function AutoConfigureSwap({ bridge }: { bridge: boolean }) {
  useEffect(() => {
    let cancelled = false;
    const waitFor = async <T extends Element,>(
      find: () => T | undefined,
    ): Promise<T | undefined> => {
      for (let attempt = 0; attempt < 50 && !cancelled; attempt += 1) {
        const match = find();
        if (match) return match;
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      return undefined;
    };

    void (async () => {
      // The form chooses the largest non-native holding by default. Pin ETH
      // before selecting USDC so quote scenarios have a consistent USD input.
      const sell = await waitFor(() =>
        Array.from(document.querySelectorAll("button")).find((button) =>
          button.textContent?.toUpperCase().includes("USDC") ||
          button.textContent?.trim() === "ETH",
        ),
      );
      if (!sell || cancelled) return;
      if (sell.textContent?.toUpperCase().includes("USDC")) {
        sell.click();
        const eth = await waitFor(() =>
          Array.from(document.querySelectorAll("button")).find(
            (button) => button.textContent?.trim() === "ETH",
          ),
        );
        if (!eth || cancelled) return;
        eth.click();
      }

      const select = await waitFor(() =>
        Array.from(document.querySelectorAll("button")).find(
          (button) =>
            button.textContent?.trim().toUpperCase().startsWith("SELECT"),
        ),
      );
      if (!select || cancelled) return;
      select.click();

      const picker = await waitFor(() =>
        Array.from(document.querySelectorAll("h1, h2, h3")).find(
          (heading) => heading.textContent === "Select asset to receive",
        ),
      );
      if (!picker || cancelled) return;

      if (bridge) {
        const arbitrum = await waitFor(() =>
          Array.from(document.querySelectorAll("button")).find((button) =>
            button.textContent?.toLowerCase().includes("arbitrum"),
          ),
        );
        if (!arbitrum || cancelled) return;
        arbitrum.click();
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      const usdc = await waitFor(() =>
        Array.from(document.querySelectorAll("button")).find((button) =>
          button.textContent?.toUpperCase().includes("USDC"),
        ),
      );
      if (!usdc || cancelled) return;
      usdc.click();

      const amountInput = await waitFor(() =>
        Array.from(document.querySelectorAll("input")).find(
          (input) => !input.readOnly && input.placeholder === "0.0",
        ),
      );
      if (!amountInput || cancelled) return;
      setReactInputValue(amountInput, "0.5");
    })();

    return () => {
      cancelled = true;
    };
  }, [bridge]);

  return null;
}

