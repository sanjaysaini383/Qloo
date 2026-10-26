import * as React from "react";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full min-w-0 rounded-xl border border-input bg-black/25 px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] [color-scheme:dark] placeholder:text-muted-foreground/70 focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClass, "h-10", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClass, "min-h-20 resize-none py-2.5", className)} {...props} />;
}

export { Input, Textarea, fieldClass };
