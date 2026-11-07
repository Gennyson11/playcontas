import { fetchProductBySlugServer } from "@/lib/productStore";
import { AnuncioClientView } from "@/components/AnuncioClientView";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await fetchProductBySlugServer(params?.slug || "");
  if (!product) return { title: "Anúncio | PlayContas" };
  return {
    title: `${product.title} | PlayContas`,
    description: product.description?.slice(0, 160) || "Compre com entrega garantida no PlayContas.",
  };
}

export default async function AnuncioPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params?.slug ? decodeURIComponent(params.slug) : "";
  const initialProduct = await fetchProductBySlugServer(slug);

  return <AnuncioClientView initialProduct={initialProduct} slug={slug} />;
}
