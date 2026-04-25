import { NextResponse } from "next/server"
import { fetchCandles } from "@/lib/finnhub"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get("symbol")
  const resolution = (searchParams.get("resolution") || "D") as
    | "1"
    | "5"
    | "15"
    | "30"
    | "60"
    | "D"
    | "W"
    | "M"
  const count = parseInt(searchParams.get("count") || "30", 10)

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400 }
    )
  }

  try {
    const candles = await fetchCandles(symbol, resolution, count)
    return NextResponse.json(candles)
  } catch (error) {
    console.error("Failed to fetch candles:", error)
    return NextResponse.json(
      { error: "Failed to fetch candle data" },
      { status: 500 }
    )
  }
}
