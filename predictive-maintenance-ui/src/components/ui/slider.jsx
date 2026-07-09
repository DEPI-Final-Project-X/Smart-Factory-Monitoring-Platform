import React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '../../lib/utils'

export function Slider({ className, value, onValueChange, min = 0, max = 100, step = 1 }) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      value={value}
      min={min}
      max={max}
      step={step}
      onValueChange={onValueChange}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/8">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-white/30 bg-white shadow-lg transition hover:scale-110 focus:outline-none focus:ring-4 focus:ring-violet-500/30" />
    </SliderPrimitive.Root>
  )
}
