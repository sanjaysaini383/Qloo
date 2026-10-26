"use client";
import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Slider({ className, "aria-label": label, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex h-5 w-full touch-none items-center select-none data-[disabled]:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-white/10">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        className="block size-5 cursor-grab rounded-full border-2 border-primary bg-background shadow-[0_0_0_4px_rgb(246_182_73/0.15)] outline-none transition-shadow focus-visible:shadow-[0_0_0_6px_rgb(246_182_73/0.3)] active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
