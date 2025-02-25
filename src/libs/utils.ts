import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function ny(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}