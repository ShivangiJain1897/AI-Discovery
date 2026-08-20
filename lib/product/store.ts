/**
 * Product + backlog stores — backed by the shared storage collection (Postgres
 * in prod, local file in dev).
 */
import { getCollection } from "../storage/collection";
import type { BacklogItem, Product } from "./types";

const products = getCollection<Product>("products");
const backlog = getCollection<BacklogItem>("backlog_items");

// --- Products ---
export async function listProducts(): Promise<Product[]> {
  return (await products.list()).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getProduct(id: string): Promise<Product | undefined> {
  return products.get(id);
}
export async function saveProduct(p: Product): Promise<void> {
  await products.put(p);
}
export async function deleteProduct(id: string): Promise<void> {
  await products.remove(id);
  // Cascade: remove this product's backlog items.
  const items = (await backlog.list()).filter((i) => i.productId === id);
  await Promise.all(items.map((i) => backlog.remove(i.id)));
}
export function newProductId(): string {
  return "prod_" + Math.random().toString(36).slice(2, 9);
}

// --- Backlog ---
export async function listBacklog(productId: string): Promise<BacklogItem[]> {
  return (await backlog.list()).filter((i) => i.productId === productId);
}
export async function getBacklogItem(id: string): Promise<BacklogItem | undefined> {
  return backlog.get(id);
}
export async function saveBacklogItem(i: BacklogItem): Promise<void> {
  await backlog.put(i);
}
export async function deleteBacklogItem(id: string): Promise<void> {
  await backlog.remove(id);
}
export function newBacklogId(): string {
  return "bi_" + Math.random().toString(36).slice(2, 9);
}
