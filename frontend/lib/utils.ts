import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const LOGOKIT_TOKEN = "pk_frfbe2dd55bc04b3d4d1bc"

export function getStockLogoUrl(ticker: string): string {
  // Strip "s" prefix for synth tokens: sAAPL → AAPL
  const clean = ticker.startsWith("s") ? ticker.slice(1) : ticker
  return `https://img.logokit.com/ticker/${clean.toUpperCase()}?token=${LOGOKIT_TOKEN}`
}
