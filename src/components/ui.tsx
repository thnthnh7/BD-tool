"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import {
  Button,
  NativeSelect,
  PasswordInput,
  Text,
  TextInput as MantineTextInput,
  Textarea as MantineTextarea,
} from "@mantine/core";

function toStringValue(value: string | number | readonly string[] | undefined) {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return value[0];
}

export function FieldLabel({ children, mt }: { children: React.ReactNode; mt?: string | number }) {
  return (
    <Text size="xs" fw={600} c="dimmed" mb="xs" mt={mt}>
      {children}
    </Text>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { type, value, defaultValue, onChange, ...rest } = props;
  const shared = {
    name: rest.name,
    required: rest.required,
    placeholder: rest.placeholder,
    disabled: rest.disabled,
    minLength: rest.minLength,
    value: value === undefined ? undefined : toStringValue(value),
    defaultValue: defaultValue === undefined ? undefined : toStringValue(defaultValue),
    onChange,
  };

  if (type === "password") {
    return <PasswordInput {...shared} />;
  }

  return <MantineTextInput type={type} {...shared} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { value, defaultValue, onChange, ...rest } = props;
  return (
    <MantineTextarea
      name={rest.name}
      required={rest.required}
      placeholder={rest.placeholder}
      disabled={rest.disabled}
      autosize
      minRows={4}
      value={value === undefined ? undefined : toStringValue(value)}
      defaultValue={defaultValue === undefined ? undefined : toStringValue(defaultValue)}
      onChange={onChange}
    />
  );
}

export function PrimaryButton({ children, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button type={type} disabled={props.disabled} onClick={props.onClick} name={props.name} value={typeof props.value === "string" ? props.value : undefined}>
      {children}
    </Button>
  );
}

export function SecondaryButton({ children, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="default"
      type={type}
      disabled={props.disabled}
      onClick={props.onClick}
      name={props.name}
      value={typeof props.value === "string" ? props.value : undefined}
    >
      {children}
    </Button>
  );
}

export { NativeSelect };
