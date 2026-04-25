import { useState, useEffect } from 'react'
import { generateMockCandlestickData, CandlestickData } from '@/lib/chart-utils'

export function useChartData(ticker: string, timeframe: string, basePrice: number) {
  const [data, setData] = useState<CandlestickData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    
    // Simulate API delay
    const timeout = setTimeout(() => {
      const mockData = generateMockCandlestickData(basePrice, 100, timeframe)
      setData(mockData)
      setIsLoading(false)
    }, 300)

    return () => clearTimeout(timeout)
  }, [ticker, timeframe, basePrice])

  return { data, isLoading }
}
