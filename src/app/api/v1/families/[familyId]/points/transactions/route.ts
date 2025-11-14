import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase"
import {
  assertFamilyAccess,
  assertParentOrAdmin,
  requireAuthContext
} from "../../../../../_lib/authContext"
import { handleRouteError } from "../../../../../_lib/errors"
import { ensureUuid } from "../../../../../_lib/validation"
import { readJsonBody } from "../../../../../_lib/request"
import {
  parseManualTransactionPayload,
  parseTransactionsQuery
} from "../../../../../_validators/points"
import {
  createManualPointTransaction,
  listPointTransactions
} from "../../../../../_services/pointsService"
import { ensureProfileInFamily } from "../../../../../_services/profilesService"

type RouteParams = {
  params: Promise<{
    familyId: string
  }>
}

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const supabase = await createSupabaseServerClient()

    const authContext = await requireAuthContext(supabase)
    assertParentOrAdmin(authContext)

    const { familyId } = await context.params
    const familyIdValidated = ensureUuid(familyId, "familyId")
    assertFamilyAccess(authContext, familyIdValidated)

    const query = parseTransactionsQuery(request.nextUrl.searchParams)
    const offset = (query.page - 1) * query.pageSize
    if (query.childProfileId) {
      await ensureProfileInFamily(supabase, query.childProfileId, familyIdValidated)
    }

    const transactions = await listPointTransactions(supabase, {
      familyId: familyIdValidated,
      childProfileId: query.childProfileId,
      transactionType: query.transactionType,
      from: query.from ? `${query.from}T00:00:00Z` : undefined,
      to: query.to ? `${query.to}T23:59:59Z` : undefined,
      limit: query.pageSize,
      offset,
      sort: query.sort,
      order: query.order
    })

    return NextResponse.json(transactions, { status: 200 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<Response> {
  try {
    const supabase = await createSupabaseServerClient()

    const authContext = await requireAuthContext(supabase)
    assertParentOrAdmin(authContext)

    const { familyId } = await context.params
    const familyIdValidated = ensureUuid(familyId, "familyId")
    assertFamilyAccess(authContext, familyIdValidated)

    const payload = await readJsonBody(request)
    const command = parseManualTransactionPayload(payload)
    await ensureProfileInFamily(supabase, command.profileId, familyIdValidated)

    const result = await createManualPointTransaction(
      supabase,
      familyIdValidated,
      command
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
