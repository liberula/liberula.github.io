"use client";

import { FormEvent, useState } from "react";
import { FiArrowRight, FiMapPin, FiShield } from "react-icons/fi";
import { safePosthogCapture } from "../../analytics/posthog";
import { validateBuyerInput } from "./buyer-validation.mjs";
import CheckoutContinuation from "./CheckoutContinuation";
import styles from "./EcoCase.module.css";

export type BuyerPayload = {
  name: string;
  email: string;
  whatsapp: string;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
  };
};

type BuyerField =
  | "name"
  | "email"
  | "whatsapp"
  | "street"
  | "number"
  | "complement"
  | "neighborhood"
  | "city"
  | "state"
  | "postalCode";

type BuyerErrors = Partial<Record<BuyerField, string>>;

const fields: Array<{
  name: BuyerField;
  label: string;
  type?: string;
  inputMode?: "email" | "tel" | "numeric" | "text";
  autoComplete: string;
  maxLength: number;
  className?: string;
}> = [
  {
    name: "name",
    label: "Nome completo",
    autoComplete: "name",
    maxLength: 120,
    className: styles.fullField,
  },
  {
    name: "email",
    label: "E-mail",
    type: "email",
    inputMode: "email",
    autoComplete: "email",
    maxLength: 320,
    className: styles.fullField,
  },
  {
    name: "whatsapp",
    label: "WhatsApp",
    type: "tel",
    inputMode: "tel",
    autoComplete: "tel",
    maxLength: 30,
    className: styles.fullField,
  },
  {
    name: "street",
    label: "Logradouro",
    autoComplete: "address-line1",
    maxLength: 160,
    className: styles.addressStreet,
  },
  {
    name: "number",
    label: "Número",
    autoComplete: "address-line2",
    maxLength: 20,
    className: styles.addressNumber,
  },
  {
    name: "complement",
    label: "Complemento (opcional)",
    autoComplete: "address-line3",
    maxLength: 80,
    className: styles.fullField,
  },
  {
    name: "neighborhood",
    label: "Bairro",
    autoComplete: "address-level3",
    maxLength: 100,
  },
  {
    name: "city",
    label: "Cidade",
    autoComplete: "address-level2",
    maxLength: 100,
  },
  {
    name: "state",
    label: "UF",
    autoComplete: "address-level1",
    maxLength: 2,
  },
  {
    name: "postalCode",
    label: "CEP",
    inputMode: "numeric",
    autoComplete: "postal-code",
    maxLength: 10,
  },
];

function inputFromForm(formData: FormData) {
  return fields.reduce<Record<BuyerField, string>>(
    (result, field) => {
      result[field.name] = String(formData.get(field.name) ?? "");
      return result;
    },
    {} as Record<BuyerField, string>,
  );
}

export default function BuyerForm() {
  const [errors, setErrors] = useState<BuyerErrors>({});
  const [preparedPayload, setPreparedPayload] = useState<BuyerPayload | null>(
    null,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = validateBuyerInput(inputFromForm(new FormData(form)));
    const nextErrors = result.errors as BuyerErrors;
    setErrors(nextErrors);

    if (!result.payload) {
      safePosthogCapture("eco_founder_form_error", {
        case_id: "eco-sp-001",
        invalid_fields: Object.keys(nextErrors),
      });
      const firstInvalidField = fields.find((field) => nextErrors[field.name]);
      if (firstInvalidField) {
        (
          form.elements.namedItem(firstInvalidField.name) as
            | HTMLInputElement
            | null
        )?.focus();
      }
      return;
    }

    setPreparedPayload(result.payload as BuyerPayload);
    safePosthogCapture("eco_founder_form_prepared", {
      case_id: "eco-sp-001",
    });
  }

  if (preparedPayload) {
    return <CheckoutContinuation buyer={preparedPayload} />;
  }

  return (
    <form className={styles.buyerForm} onSubmit={handleSubmit} noValidate>
      <div className={styles.formSectionHeading}>
        <h3>Dados do comprador</h3>
        <p>Preencha os dados necessários para preparar a futura continuação.</p>
      </div>

      <div className={styles.buyerGrid}>
        {fields.slice(0, 3).map((field) => (
          <BuyerFieldInput
            key={field.name}
            field={field}
            error={errors[field.name]}
            clearError={() =>
              setErrors((current) => ({ ...current, [field.name]: undefined }))
            }
          />
        ))}
      </div>

      <fieldset className={styles.addressFields}>
        <legend>
          <FiMapPin aria-hidden="true" /> Endereço de entrega
        </legend>
        <div className={styles.addressGrid}>
          {fields.slice(3).map((field) => (
            <BuyerFieldInput
              key={field.name}
              field={field}
              error={errors[field.name]}
              clearError={() =>
                setErrors((current) => ({
                  ...current,
                  [field.name]: undefined,
                }))
              }
            />
          ))}
        </div>
      </fieldset>

      <p className={styles.dataNote}>
        <FiShield aria-hidden="true" /> Os dados permanecem apenas neste
        formulário nesta etapa e não são enviados ou armazenados.
      </p>

      <button className={styles.submitButton} type="submit">
        PREPARAR CONTINUAÇÃO <FiArrowRight aria-hidden="true" />
      </button>
    </form>
  );
}

function BuyerFieldInput({
  field,
  error,
  clearError,
}: {
  field: (typeof fields)[number];
  error?: string;
  clearError: () => void;
}) {
  const errorId = `eco-buyer-${field.name}-error`;
  return (
    <div className={`${styles.field} ${field.className ?? ""}`}>
      <label htmlFor={`eco-buyer-${field.name}`}>{field.label}</label>
      <input
        id={`eco-buyer-${field.name}`}
        name={field.name}
        type={field.type ?? "text"}
        inputMode={field.inputMode}
        autoComplete={field.autoComplete}
        maxLength={field.maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={error ? clearError : undefined}
      />
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
