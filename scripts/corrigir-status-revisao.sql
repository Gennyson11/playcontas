-- ====================================================================
-- CORREÇÃO: ANÚNCIOS DE VENDEDORES OBRIGATORIAMENTE EM ANÁLISE / MODERAÇÃO
-- Execute este script no SQL Editor do Supabase e clique em RUN.
-- ====================================================================

-- 1. Corrige a função recalc_product_stock no banco para JAMAIS ativar anúncios
--    que estejam aguardando análise (pending_review, pending_approval) ou rejeitados (rejected).
CREATE OR REPLACE FUNCTION public.recalc_product_stock(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_total integer;
  v_current_status text;
BEGIN
  SELECT lower(coalesce(delivery_type, 'automatic')), coalesce(status, 'pending_review')
  INTO v_type, v_current_status
  FROM public.products WHERE id = p_product_id;

  IF NOT FOUND OR v_type <> 'automatic' THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.product_stock_items WHERE product_id = p_product_id) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_total
  FROM public.product_stock_items
  WHERE product_id = p_product_id AND status = 'available';

  UPDATE public.products p
  SET stock = v_total,
      status = CASE
        -- Se o anúncio está pendente de moderação ou foi reprovado, NUNCA ativa sozinho
        WHEN p.status IN ('pending_review', 'pending_approval', 'rejected') THEN p.status
        -- Se for anúncio aprovado e o estoque zerou, pausa. Se reabasteceu, volta a ficar ativo
        WHEN v_total <= 0 THEN 'paused'
        ELSE 'active'
      END,
      variants = CASE
        WHEN p.variants IS NULL OR jsonb_typeof(p.variants) <> 'array' THEN p.variants
        ELSE (
          SELECT coalesce(jsonb_agg(
            jsonb_set(
              v, '{stock}',
              to_jsonb((
                SELECT count(*)::integer
                FROM public.product_stock_items i
                WHERE i.product_id = p.id
                  AND i.variant_id = v->>'id'
                  AND i.status = 'available'
              ))
            )
          ), '[]'::jsonb)
          FROM jsonb_array_elements(p.variants) v
        )
      END,
      updated_at = timezone('utc'::text, now())
  WHERE p.id = p_product_id;
END;
$$;

-- 2. Move os anúncios recentes do Kevem para "pending_review" para que apareçam
--    na aba "Revisão de Anúncios" no seu Painel Admin para você aprovar ou reprovar
UPDATE public.products
SET status = 'pending_review', rejection_reason = null, reviewed_at = null
WHERE seller_id = '266c5e47-f15b-42fc-b075-b3a9f3b6c7fd';
