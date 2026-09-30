import { describe, expect, it } from "vitest";

import { formatCep, formatDocument, formatPhone, isValidCep, isValidCnpj, isValidCpf, isValidDocument, isValidPhone } from "./br";

describe("CPF", () => {
  it("accepts valid numbers with or without punctuation", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });
  it("rejects wrong check digits, repeated digits and wrong length", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("1234567890")).toBe(false);
  });
});

describe("CNPJ", () => {
  it("accepts valid numbers", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
  });
  it("rejects invalid ones", () => {
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });
});

describe("document", () => {
  it("routes by length", () => {
    expect(isValidDocument("52998224725")).toBe(true);
    expect(isValidDocument("11222333000181")).toBe(true);
    expect(isValidDocument("123")).toBe(false);
  });
});

describe("phone", () => {
  it("accepts landlines and mobiles with area code", () => {
    expect(isValidPhone("(81) 3333-4444")).toBe(true);
    expect(isValidPhone("(81) 99999-4444")).toBe(true);
  });
  it("rejects missing area code or non-9 mobiles", () => {
    expect(isValidPhone("99999-4444")).toBe(false);
    expect(isValidPhone("(81) 89999-4444")).toBe(false);
    expect(isValidPhone("(01) 3333-4444")).toBe(false);
  });
});

describe("CEP", () => {
  it("needs 8 digits", () => {
    expect(isValidCep("50030-230")).toBe(true);
    expect(isValidCep("5003023")).toBe(false);
  });
});

describe("formatters", () => {
  it("mask as the user types", () => {
    expect(formatCep("50030230")).toBe("50030-230");
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatPhone("81999994444")).toBe("(81) 99999-4444");
    expect(formatPhone("8133334444")).toBe("(81) 3333-4444");
  });
});
