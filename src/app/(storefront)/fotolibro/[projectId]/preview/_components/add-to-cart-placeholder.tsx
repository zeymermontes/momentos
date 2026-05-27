"use client";

import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

export function AddToCartPlaceholder() {
  return (
    <Button
      size="lg"
      className="gap-2"
      onClick={() => alert("Próximamente: agregar fotolibro al carrito.")}
    >
      <ShoppingCart className="h-4 w-4" />
      Agregar al carrito
    </Button>
  );
}
