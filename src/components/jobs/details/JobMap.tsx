"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin } from "lucide-react"

interface JobMapProps {
  address?: string
}

export function JobMap({ address }: JobMapProps) {
  if (!address) return null;

  // Encode address for URL
  const encodedAddress = encodeURIComponent(address);
  const mapUrl = `https://maps.google.com/maps?q=${encodedAddress}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Posizione Cantiere
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden relative min-h-[300px] rounded-b-xl">
        <iframe 
            width="100%" 
            height="100%" 
            className="absolute inset-0 border-0"
            src={mapUrl} 
            title="Mappa Cantiere"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
        />
      </CardContent>
    </Card>
  )
}
