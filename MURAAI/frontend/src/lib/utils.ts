import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency: string = "INR"): string {
  return `${currency} ${Number(value || 0).toFixed(2)}`
}

export function formatDate(date: string | Date): string {
  if (!date) return "-"
  return new Date(date).toLocaleDateString()
}

export function formatDateTime(date: string | Date): string {
  if (!date) return "-"
  return new Date(date).toLocaleString()
}

export function calculateDaysLeft(endDate: string | Date): { days: number; label: string; class: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  const days = Math.ceil((end.getTime() - today.getTime()) / 86400000)
  
  if (days < 0) return { days, label: "Expired", class: "expired" }
  if (days <= 7) return { days, label: `${days} days`, class: "critical" }
  if (days <= 30) return { days, label: `${days} days`, class: "upcoming" }
  return { days, label: `${days} days`, class: "active" }
}

export function generateSKU(): string {
  const year = new Date().getFullYear()
  const prefix = "SKU-OT-MUR"
  const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0')
  return `${prefix}-${year}-${random}`
}

export function groupBy<T>(array: T[], getter: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = getter(item) || "Unassigned"
    groups[key] = groups[key] || []
    groups[key].push(item)
    return groups
  }, {} as Record<string, T[]>)
}
