"use client";

import React from "react";

interface MarkdownDescriptionProps {
  content: string;
  className?: string;
}

/**
 * Renderiza a descrição do produto com quebras de linha e espaçamento naturais,
 * mantendo o texto 100% limpo sem asteriscos, símbolos ou formatação markdown complexa.
 */
export function MarkdownDescription({ content, className = "" }: MarkdownDescriptionProps) {
  if (!content) return null;

  // Remove asteriscos e caracteres de markdown legados caso tenham ficado salvos
  const cleanContent = content
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^###\s+/gm, "")
    .replace(/^##\s+/gm, "")
    .replace(/^#\s+/gm, "");

  return (
    <div
      className={`text-xs sm:text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap font-normal ${className}`}
    >
      {cleanContent}
    </div>
  );
}
