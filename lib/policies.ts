export interface PolicySection {
  heading: string;
  body: string[];
}

export interface Policy {
  slug: string;
  title: string;
  intro: string;
  sections: PolicySection[];
}

/** Copied from the live sandryneboutique.com footer Resources pages. */
export const POLICIES: Policy[] = [
  {
    slug: "shipping",
    title: "Shipping Policy",
    intro:
      "All orders are shipped via UPS and include a tracking number for your convenience.",
    sections: [
      {
        heading: "Domestic shipping (within the USA)",
        body: [
          "We take great care in preparing and shipping your order; however, Sandryne Boutique is not responsible for returned, damaged, lost, or stolen packages, nor for packages shipped to incorrect addresses provided by the customer.",
        ],
      },
      {
        heading: "Shipping address accuracy",
        body: [
          "We ship only to the address provided at checkout. Please review your shipping details carefully before submitting your order.",
          "If a package is returned due to an incorrect or incomplete address, we will gladly resend the order once it is received back in our facility. Additional shipping charges may apply for reshipment.",
        ],
      },
      {
        heading: "Processing & delivery times",
        body: [
          "Orders are processed and shipped Monday through Friday. We do not ship on weekends or holidays.",
          "Once shipped, you will receive a confirmation email with your tracking number.",
          "Please note that shipping times may vary depending on your location and carrier delays.",
        ],
      },
      {
        heading: "Damaged or lost packages",
        body: [
          "Once an order leaves our facility, it is in the care of UPS. If your package is lost, stolen, or damaged during transit, please contact UPS directly with your tracking number for assistance. Unfortunately, Sandryne Boutique cannot be held liable for such incidents.",
        ],
      },
      {
        heading: "Contact information",
        body: [
          "For questions about your order or shipping, please contact us at info@sandryneboutique.com.",
        ],
      },
    ],
  },
  {
    slug: "returns",
    title: "Refund, Exchange & Return Policy",
    intro:
      "Thank you for shopping at Sandryne Boutique. We hope you love your purchase! If, for any reason, you are not completely satisfied, you are welcome to return or exchange your item in accordance with the policy below.",
    sections: [
      {
        heading: "General conditions",
        body: [
          "All returns or exchanges must be unworn, unwashed, and have original tags attached.",
          "Accessories and sale items are FINAL SALE and cannot be returned or exchanged.",
          "Items showing signs of wear, alteration, or damage will not be accepted.",
        ],
      },
      {
        heading: "Online purchases — return authorization required",
        body: [
          "Please request a Return Authorization Number (RA#) via email within 2 days of receiving your order.",
          "Include your RA# clearly on the UPS or FedEx shipping label.",
          "USPS shipments will not be accepted.",
          "Items returned without authorization will be refused.",
        ],
      },
      {
        heading: "Return shipping",
        body: [
          "All authorized returns must be shipped to Sandryne Boutique at the address provided in your approval email within 10 days of receiving your order.",
          "Customers are responsible for return shipping costs and must provide a valid tracking number.",
          "If tracking is not provided and the item is not received, we cannot issue a refund or exchange.",
        ],
      },
      {
        heading: "Refunds",
        body: [
          "Refunds are issued to the original form of payment, minus the original shipping cost.",
          "Returns received after the 10-day period will not be accepted.",
        ],
      },
      {
        heading: "In-store purchases",
        body: [
          "No refunds. Exchanges or store credit only within 10 days of purchase.",
          "Sale items and accessories are FINAL SALE and cannot be exchanged or returned.",
        ],
      },
      {
        heading: "Contact information",
        body: [
          "If you have any questions regarding your return or exchange, please contact us at info@sandryneboutique.com.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    intro:
      "This Privacy Policy explains how Sandryne Boutique collects, uses, and shares personal information when you shop with us online or in store.",
    sections: [
      {
        heading: "What do we do with your information",
        body: [
          "When you purchase something from our store, as part of the buying and selling process, we collect the personal information you give us such as your name, address and email address. When you browse our store, we also automatically receive your computer’s internet protocol (IP) address in order to provide us with information that helps us learn about your browser and operating system.",
          "Email marketing (if applicable): With your permission, we may send you emails about our store, new products and other updates.",
        ],
      },
      {
        heading: "Consent",
        body: [
          "How do you get my consent? When you provide us with personal information to complete a transaction, verify your credit card, place an order, arrange for a delivery or return a purchase, we imply that you consent to our collecting it and using it for that specific reason only. If we ask for your personal information for a secondary reason, like marketing, we will either ask you directly for your expressed consent, or provide you with an opportunity to say no.",
          "How do I withdraw my consent? If after you opt-in, you change your mind, you may withdraw your consent for us to contact you, for the continued collection, use or disclosure of your information, at any time, by contacting us at info@sandryneboutique.com or mailing us at: Sandryne Boutique, 415 Peachtree Pkwy, Ste 235, Cumming, GA 30041-7234.",
        ],
      },
      {
        heading: "Disclosure",
        body: [
          "We may disclose your personal information if we are required by law to do so or if you violate our Terms of Service.",
        ],
      },
      {
        heading: "Payments & service providers",
        body: [
          "Payments are processed by our payment provider (Heartland / Global Payments). Payment card details are handled by that provider and are not stored on our servers.",
          "Third-party providers used by us only collect, use and disclose your information to the extent necessary to allow them to perform the services they provide to us. Once you leave our store’s website or are redirected to a third-party website or application, you are no longer governed by this Privacy Policy or our website’s Terms of Service.",
        ],
      },
      {
        heading: "Security",
        body: [
          "To protect your personal information, we take reasonable precautions and follow industry best practices to make sure it is not inappropriately lost, misused, accessed, disclosed, altered or destroyed.",
        ],
      },
      {
        heading: "Age of consent",
        body: [
          "By using this site, you represent that you are at least the age of majority in your state or province of residence, or that you are the age of majority in your state or province of residence and you have given us your consent to allow any of your minor dependents to use this site.",
        ],
      },
      {
        heading: "Changes to this Privacy Policy",
        body: [
          "We reserve the right to modify this privacy policy at any time, so please review it frequently. Changes and clarifications will take effect immediately upon their posting on the website. If we make material changes to this policy, we will notify you here that it has been updated.",
        ],
      },
      {
        heading: "Questions and contact information",
        body: [
          "If you would like to access, correct, amend or delete any personal information we have about you, register a complaint, or simply want more information, contact us at info@sandryneboutique.com or by mail at Sandryne Boutique, 415 Peachtree Pkwy, Ste 235, Cumming, GA 30041-7234.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    intro: "By using sandryneboutique.com, you agree to the following terms.",
    sections: [
      {
        heading: "Orders & pricing",
        body: [
          "All prices are listed in USD. We reserve the right to correct pricing errors and to cancel orders affected by them, with a full refund.",
          "Placing an order constitutes an offer to purchase; orders are confirmed once payment is authorized.",
        ],
      },
      {
        heading: "Product availability",
        body: [
          "Inventory is limited and curated. If an item becomes unavailable after you order, we will notify you promptly and refund the affected items.",
        ],
      },
      {
        heading: "Intellectual property",
        body: [
          "All content on this site — photography, copy, and branding — is the property of Sandryne Boutique and may not be reproduced without permission.",
        ],
      },
      {
        heading: "Contact",
        body: [
          "Questions about these terms can be sent to info@sandryneboutique.com.",
        ],
      },
    ],
  },
];

export function getPolicy(slug: string): Policy | undefined {
  return POLICIES.find((p) => p.slug === slug);
}
