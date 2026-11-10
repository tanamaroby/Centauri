"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Attachment, Ticket, TicketInput, Trip, TripInput } from "@/lib/types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "same-origin",
  });
  if (res.status === 401) {
    // Full reload so the proxy can send us to the login page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    throw new ApiError("Logged out", 401);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? res.statusText, res.status);
  return body as T;
}

export const keys = {
  tickets: ["tickets"] as const,
  trips: ["trips"] as const,
};

export function useTickets() {
  return useQuery({ queryKey: keys.tickets, queryFn: () => api<Ticket[]>("/api/tickets") });
}

export function useTicket(id: string | undefined) {
  const q = useTickets();
  return { ...q, data: q.data?.find((t) => t.id === id) };
}

export function useTrips() {
  return useQuery({ queryKey: keys.trips, queryFn: () => api<Trip[]>("/api/trips") });
}

export function useSaveTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<TicketInput> }) =>
      id
        ? api<Ticket>(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify(values) })
        : api<Ticket>("/api/tickets", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: (ticket) => {
      qc.setQueryData<Ticket[]>(keys.tickets, (old = []) => {
        const rest = old.filter((t) => t.id !== ticket.id);
        return [...rest, ticket];
      });
      qc.invalidateQueries({ queryKey: keys.tickets });
    },
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/tickets/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      qc.setQueryData<Ticket[]>(keys.tickets, (old = []) => old.filter((t) => t.id !== id));
      qc.invalidateQueries({ queryKey: keys.tickets });
    },
  });
}

export function useSaveTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<TripInput> }) =>
      id
        ? api<Trip>(`/api/trips/${id}`, { method: "PATCH", body: JSON.stringify(values) })
        : api<Trip>("/api/trips", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.trips }),
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/trips/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.trips });
      qc.invalidateQueries({ queryKey: keys.tickets });
    },
  });
}

export async function uploadTicketFile(file: File) {
  const { upload } = await import("@vercel/blob/client");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "ticket";
  const blob = await upload(`tickets/${safeName}`, file, {
    access: (process.env.NEXT_PUBLIC_BLOB_ACCESS as "public" | "private") ?? "private",
    handleUploadUrl: "/api/upload",
    contentType: file.type || undefined,
  });
  return { fileUrl: blob.url, fileName: file.name, fileType: file.type || null };
}

export async function uploadAttachment(file: File, kind: Attachment["kind"]): Promise<Attachment> {
  const { fileUrl, fileName, fileType } = await uploadTicketFile(file);
  return { url: fileUrl, name: fileName, type: fileType, kind };
}

export const fileHref = (fileUrl: string) => `/api/files?url=${encodeURIComponent(fileUrl)}`;
