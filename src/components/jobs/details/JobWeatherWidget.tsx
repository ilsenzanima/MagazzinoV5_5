"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Cloud, Sun, CloudRain, Wind } from "lucide-react"

interface WeatherData {
  time: string[]
  weather_code: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
}

interface JobWeatherWidgetProps {
  address?: string
}

export function JobWeatherWidget({ address }: JobWeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!address) { setLoading(false); return }

    setLoading(true)
    setError(false)

    fetch(`/api/weather?address=${encodeURIComponent(address)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => setWeather(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [address])

  const getWeatherIcon = (code: number) => {
    if (code <= 3) return <Sun className="h-6 w-6 text-yellow-500" />
    if (code <= 60) return <Cloud className="h-6 w-6 text-slate-400" />
    if (code <= 80) return <CloudRain className="h-6 w-6 text-blue-500" />
    return <Wind className="h-6 w-6 text-slate-600" />
  }

  if (loading) return <div className="h-32 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />

  if (error || !weather) return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          Meteo Cantiere
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-slate-400">Impossibile caricare il meteo per questo indirizzo.</p>
      </CardContent>
    </Card>
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          Meteo Cantiere
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {weather.time.slice(0, 5).map((date, i) => (
            <div key={date} className="flex flex-col items-center min-w-[80px] p-2 rounded-lg bg-slate-50 border">
              <span className="text-xs font-semibold text-slate-600 mb-1">
                {new Date(date).toLocaleDateString('it-IT', { weekday: 'short' })}
              </span>
              <div className="my-1">
                {getWeatherIcon(weather.weather_code[i])}
              </div>
              <div className="text-xs font-mono">
                <span className="text-red-500">{Math.round(weather.temperature_2m_max[i])}°</span>
                <span className="mx-1 text-slate-300">|</span>
                <span className="text-blue-500">{Math.round(weather.temperature_2m_min[i])}°</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
