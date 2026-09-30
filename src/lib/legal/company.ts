// Who runs the store. Decreto 7.962/2013 (e-commerce) requires the name, CNPJ or CPF, physical
// address and contact on the site, and the privacy policy names the data controller and the DPO
// ("encarregado", LGPD art. 41). The legal pages and their links stay hidden until every field is
// filled: publishing them with blanks would be worse than not having them.

export const COMPANY = {
  /** Razão social (or the owner's full name, for a CPF). */
  legalName: "",
  /** Name the customer sees, when different from the legal name. */
  tradeName: "Rufino Clinical",
  /** "CNPJ 00.000.000/0001-00" or "CPF 000.000.000-00". */
  document: "",
  /** Street, number, district, city - UF, CEP. */
  address: "",
  email: "",
  phone: "",
  /** Encarregado pelo tratamento de dados pessoais. */
  dpoName: "",
  dpoEmail: "",
};

/** Date of the current version of the policies, shown on the pages ("1º de outubro de 2026"). */
export const POLICIES_UPDATED_AT = "1º de outubro de 2026";

export function legalReady(): boolean {
  const { legalName, document, address, email, phone, dpoName, dpoEmail } = COMPANY;
  return [legalName, document, address, email, phone, dpoName, dpoEmail].every((value) => value.trim() !== "");
}
