/**
 * Bankr API client for submitting transactions and polling job status
 */

const API_BASE_URL = "https://api.bankr.bot";

export interface TransactionParams {
  from: string;
  to: string | null;
  data?: string;
  value?: string;
  chainId: number;
}

export interface SubmitTransactionResponse {
  jobId: string;
}

export interface JobStatus {
  success?: boolean;
  jobId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  prompt?: string;
  response?: string;
  statusUpdates?: Array<{
    message: string;
    timestamp: string;
  }>;
  result?: {
    txHash?: string;
    error?: string;
  };
}

export class BankrApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "BankrApiError";
  }
}

/**
 * Submits a transaction to the Bankr API
 */
export async function submitTransaction(
  apiKey: string,
  tx: TransactionParams,
  signal?: AbortSignal
): Promise<SubmitTransactionResponse> {
  const prompt = formatTransactionPrompt(tx);

  const response = await fetch(`${API_BASE_URL}/agent/prompt`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new BankrApiError(
      `Failed to submit transaction: ${text}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Cancels a job via the Bankr API
 */
export async function cancelJob(
  apiKey: string,
  jobId: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/agent/job/${jobId}/cancel`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new BankrApiError(`Failed to cancel job: ${text}`, response.status);
  }
}

/**
 * Polls the job status from the Bankr API
 */
export async function getJobStatus(
  apiKey: string,
  jobId: string,
  signal?: AbortSignal
): Promise<JobStatus> {
  const response = await fetch(`${API_BASE_URL}/agent/job/${jobId}`, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new BankrApiError(`Failed to get job status: ${text}`, response.status);
  }

  return response.json();
}

/**
 * Polls job status until completion or timeout
 */
export async function pollJobUntilComplete(
  apiKey: string,
  jobId: string,
  options: {
    pollInterval?: number; // ms
    maxDuration?: number; // ms
    onStatusUpdate?: (status: JobStatus) => void;
    signal?: AbortSignal;
  } = {}
): Promise<JobStatus> {
  const { pollInterval = 2000, maxDuration = 300000, onStatusUpdate, signal } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < maxDuration) {
    // Check if cancelled
    if (signal?.aborted) {
      throw new DOMException("Transaction cancelled", "AbortError");
    }

    const status = await getJobStatus(apiKey, jobId, signal);

    if (onStatusUpdate) {
      onStatusUpdate(status);
    }

    if (status.status === "completed" || status.status === "failed") {
      return status;
    }

    await sleep(pollInterval);
  }

  throw new BankrApiError("Transaction timeout: exceeded maximum wait time");
}

/**
 * Converts hex value to decimal string (wei)
 */
function hexToDecimalString(hex: string | undefined): string {
  if (!hex || hex === "0x0" || hex === "0x") {
    return "0";
  }
  try {
    return BigInt(hex).toString();
  } catch {
    return "0";
  }
}

/**
 * Formats transaction parameters into a prompt for the Bankr API
 */
function formatTransactionPrompt(tx: TransactionParams): string {
  const txJson = {
    to: tx.to || undefined,
    data: tx.data && tx.data !== "0x" ? tx.data : undefined,
    value: hexToDecimalString(tx.value),
    chainId: tx.chainId,
  };

  // Remove undefined fields
  const cleanedTx = Object.fromEntries(
    Object.entries(txJson).filter(([_, v]) => v !== undefined)
  );

  return `Submit this transaction:\n${JSON.stringify(cleanedTx, null, 2)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
