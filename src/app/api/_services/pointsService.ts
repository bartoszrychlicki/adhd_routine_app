import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/db/database.types"
import type {
  ManualPointTransactionCommand,
  ManualPointTransactionResultDto,
  PointTransactionDto,
  PointTransactionsListResponseDto
} from "@/types"
import { mapSupabaseError, NotFoundError } from "../_lib/errors"

type Client = SupabaseClient<Database>
type PointTransactionRow = Database["public"]["Tables"]["point_transactions"]["Row"]

function mapTransaction(row: PointTransactionRow): PointTransactionDto {
  return {
    id: row.id,
    profileId: row.profile_id,
    transactionType: row.transaction_type,
    pointsDelta: row.points_delta,
    balanceAfter: row.balance_after,
    reference: row.reference_id
      ? {
          referenceId: row.reference_id,
          referenceTable: row.reference_table
        }
      : null,
    createdAt: row.created_at,
    metadata: row.metadata,
    reason: row.reason
  }
}

type ListTransactionsOptions = {
  familyId: string
  childProfileId?: string
  transactionType?: string
  from?: string
  to?: string
  limit: number
  offset: number
  sort: "created_at" | "points_delta"
  order: "asc" | "desc"
}

export async function listPointTransactions(
  client: Client,
  options: ListTransactionsOptions
): Promise<PointTransactionsListResponseDto> {
  const query = client
    .from("point_transactions")
    .select("*", { count: "exact" })
    .eq("family_id", options.familyId)
    .order(options.sort, { ascending: options.order === "asc" })
    .range(options.offset, options.offset + options.limit - 1)

  if (options.childProfileId) {
    query.eq("profile_id", options.childProfileId)
  }

  if (options.transactionType) {
    query.eq("transaction_type", options.transactionType)
  }

  if (options.from) {
    query.gte("created_at", options.from)
  }

  if (options.to) {
    query.lte("created_at", options.to)
  }

  const { data, error, count } = await query

  if (error) {
    throw mapSupabaseError(error)
  }

  return {
    data: (data as PointTransactionRow[]).map(mapTransaction),
    meta: {
      page: Math.floor(options.offset / options.limit) + 1,
      pageSize: options.limit,
      total: count ?? undefined
    }
  }
}

export async function createManualPointTransaction(
  client: Client,
  familyId: string,
  command: ManualPointTransactionCommand
): Promise<ManualPointTransactionResultDto> {
  const { data, error } = await client
    .from("point_transactions")
    .insert({
      family_id: familyId,
      profile_id: command.profileId,
      transaction_type: "manual_adjustment",
      points_delta: command.pointsDelta,
      reason: command.reason,
      metadata: {}
    })
    .select("id, balance_after, created_at")
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  if (!data) {
    throw new NotFoundError("Failed to create point transaction")
  }

  return {
    id: data.id,
    balanceAfter: data.balance_after,
    createdAt: data.created_at
  }
}
