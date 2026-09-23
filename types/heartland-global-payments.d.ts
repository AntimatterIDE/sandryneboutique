interface HeartlandTokenSuccess {
  paymentReference?: string;
  token?: string;
  details?: {
    cardLast4?: string;
    cardNumber?: string;
    cardType?: string;
    cardholderName?: string;
  };
  card?: {
    last4?: string;
    cardLast4?: string;
    brand?: string;
    cardType?: string;
  };
}

interface HeartlandTokenError {
  error?: { message?: string };
  reasons?: { message?: string }[];
}

interface HeartlandHostedCardForm {
  on(event: "token-success", handler: (resp: HeartlandTokenSuccess) => void): void;
  on(event: "token-error", handler: (resp: HeartlandTokenError) => void): void;
}

interface Window {
  GlobalPayments?: {
    configure(options: { publicApiKey: string }): void;
    creditCard: {
      form(target: string, options?: { style?: string }): HeartlandHostedCardForm;
    };
  };
}
