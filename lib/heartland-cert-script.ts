/** Heartland Secure Submit CNP tests we will actually run (script says only certify what you implement). */

export interface CertSaleTest {
  id: "9" | "10" | "11" | "12";
  brand: string;
  amount: number;
  streetAddress: string;
  postalCode: string;
  cvv: string;
  notes: string;
}

export const CERT_SALE_TESTS: CertSaleTest[] = [
  {
    id: "9",
    brand: "Visa",
    amount: 17.01,
    streetAddress: "6860 Dallas Pkwy",
    postalCode: "75024",
    cvv: "123",
    notes: "Invoice + ship date. Void this sale in test 35.",
  },
  {
    id: "10",
    brand: "MasterCard",
    amount: 17.02,
    streetAddress: "6860",
    postalCode: "75024",
    cvv: "123",
    notes: "AVS street number + ZIP only.",
  },
  {
    id: "11",
    brand: "Discover",
    amount: 17.03,
    streetAddress: "6860",
    postalCode: "750241234",
    cvv: "123",
    notes: "ZIP+4 750241234.",
  },
  {
    id: "12",
    brand: "AmEx",
    amount: 17.04,
    streetAddress: "6860 Dallas Pkwy",
    postalCode: "75024",
    cvv: "1234",
    notes: "AmEx CID is 4 digits.",
  },
];

export const CERT_REFUND_TEST = {
  id: "34" as const,
  brand: "MasterCard",
  amount: 15.15,
  originalSaleTestId: "10" as const,
  notes:
    "CreditReturn of the $17.02 Mastercard sale from test 10, using that sale's Gateway Trans ID ($15.15 partial). Do not tokenize a new card.",
};

export const CERT_REVERSE_TEST = {
  id: "35" as const,
  amount: 17.01,
  voidsTestId: "9" as const,
  notes: "CreditReversal of the $17.01 Visa sale from test 9 (script amount; it labels this Void #10).",
};

export const HEARTLAND_TEST_CARDS = [
  { brand: "Visa", number: "4012002000060016", exp: "12 / 2027", cvv: "123" },
  { brand: "MasterCard", number: "5473500000000014", exp: "12 / 2027", cvv: "123" },
  { brand: "Discover", number: "6011000990139424", exp: "12 / 2027", cvv: "123" },
  { brand: "AmEx", number: "372700699251018", exp: "12 / 2027", cvv: "1234" },
] as const;

export const CERT_REVIEW_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScsF9XHuVSXO75STOmxcAAQQiUzyvhcutB9kxGmJq1Ry5tShA/viewform";

export const CERT_GATEWAY_LOGIN_URL =
  "https://cert.api2.heartlandportico.com/Hps.Exchange.PosGateway.Web/login.aspx";

export const CERT_TEST_CARDS_URL =
  "https://developer.heartlandpaymentsystems.com/Documentation/test-card-numbers";
