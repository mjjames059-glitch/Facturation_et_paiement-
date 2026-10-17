export type FiscalSubmissionResult = {
  status: "not_configured";
};

export type FiscalInvoiceReference = {
  invoiceId: string;
  companyId: string;
};

export interface FiscalProvider {
  readonly name: string;
  submit(invoice: FiscalInvoiceReference): Promise<FiscalSubmissionResult>;
}

export const noneFiscalProvider: FiscalProvider = {
  name: "none",
  async submit() {
    return { status: "not_configured" };
  },
};
