-- Il reso al fornitore non e' una bolla/movimento (non tocca delivery_notes),
-- quindi finora non compariva affatto nello storico movimenti dell'articolo:
-- si vedeva l'acquisto (9 arrivati) e le uscite, ma nessuna riga spiegava
-- perche' il disponibile fosse sceso ulteriormente per un reso. Aggiunta una
-- quarta sorgente alla UNION con una dicitura dedicata.
CREATE OR REPLACE VIEW public.stock_movements_view WITH (security_invoker = true) AS
SELECT pi.id,
    pi.created_at AS date,
    'purchase'::text AS type,
    pi.quantity,
    p.delivery_note_number AS reference,
    pi.item_id,
    p.created_by AS user_id,
    pr.full_name AS user_name,
    i.code AS item_code,
    i.name AS item_name,
    i.model AS item_model,
    i.unit AS item_unit,
    pi.price AS item_price,
    pi.pieces,
    pi.coefficient,
    p.notes,
    COALESCE(pi.job_id, p.job_id) AS job_id,
    j.code AS job_code,
    j.description AS job_description,
    false AS is_fictitious,
    s.name AS supplier_name,
    p.delivery_note_date AS purchase_date,
    p.delivery_note_number AS purchase_number,
    p.id AS purchase_id,
    NULL::uuid AS delivery_note_id
   FROM purchase_items pi
     JOIN purchases p ON pi.purchase_id = p.id
     LEFT JOIN profiles pr ON p.created_by = pr.id
     LEFT JOIN inventory i ON pi.item_id = i.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     LEFT JOIN jobs j ON COALESCE(pi.job_id, p.job_id) = j.id
  WHERE p.order_type = 'purchase'::text AND p.deleted_at IS NULL
UNION ALL
 SELECT dni.id,
    dni.created_at AS date,
    dn.type,
        CASE
            WHEN dn.type = 'entry'::text THEN dni.quantity
            ELSE - dni.quantity
        END AS quantity,
    dn.number AS reference,
    dni.inventory_id AS item_id,
    dn.created_by AS user_id,
    pr.full_name AS user_name,
    i.code AS item_code,
    i.name AS item_name,
    i.model AS item_model,
    i.unit AS item_unit,
    COALESCE(pi.price, i.price) AS item_price,
    dni.pieces,
    dni.coefficient,
    dn.notes,
    dn.job_id,
    j.code AS job_code,
    j.description AS job_description,
    dni.is_fictitious,
    s.name AS supplier_name,
    p.delivery_note_date AS purchase_date,
    p.delivery_note_number AS purchase_number,
    p.id AS purchase_id,
    dn.id AS delivery_note_id
   FROM delivery_note_items dni
     JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
     LEFT JOIN profiles pr ON dn.created_by = pr.id
     LEFT JOIN inventory i ON dni.inventory_id = i.id
     LEFT JOIN purchase_items pi ON dni.purchase_item_id = pi.id
     LEFT JOIN purchases p ON pi.purchase_id = p.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     LEFT JOIN jobs j ON dn.job_id = j.id
  WHERE dn.type <> ALL (ARRAY['waste'::text, 'transfer'::text])
UNION ALL
 SELECT m.id,
    m.created_at AS date,
        CASE
            WHEN m.type = 'load'::text THEN 'entry'::text
            WHEN m.type = 'unload'::text THEN 'exit'::text
            ELSE m.type
        END AS type,
        CASE
            WHEN m.type = 'load'::text THEN m.quantity
            ELSE - m.quantity
        END AS quantity,
    m.reference,
    m.item_id,
    m.user_id,
    pr.full_name AS user_name,
    i.code AS item_code,
    i.name AS item_name,
    i.model AS item_model,
    i.unit AS item_unit,
    i.price AS item_price,
    NULL::numeric AS pieces,
    NULL::numeric AS coefficient,
    m.notes,
    m.job_id,
    j.code AS job_code,
    j.description AS job_description,
    false AS is_fictitious,
    NULL::text AS supplier_name,
    NULL::date AS purchase_date,
    NULL::text AS purchase_number,
    NULL::uuid AS purchase_id,
    NULL::uuid AS delivery_note_id
   FROM movements m
     LEFT JOIN profiles pr ON m.user_id = pr.id
     LEFT JOIN inventory i ON m.item_id = i.id
     LEFT JOIN jobs j ON m.job_id = j.id
UNION ALL
 SELECT pi.id,
    pi.returned_at AS date,
    'return_to_supplier'::text AS type,
    - pi.returned_quantity AS quantity,
    p.delivery_note_number AS reference,
    pi.item_id,
    pi.returned_by AS user_id,
    pr.full_name AS user_name,
    i.code AS item_code,
    i.name AS item_name,
    i.model AS item_model,
    i.unit AS item_unit,
    pi.returned_price AS item_price,
    pi.returned_pieces AS pieces,
    pi.coefficient,
    NULL::text AS notes,
    NULL::uuid AS job_id,
    NULL::text AS job_code,
    NULL::text AS job_description,
    false AS is_fictitious,
    s.name AS supplier_name,
    p.delivery_note_date AS purchase_date,
    p.delivery_note_number AS purchase_number,
    p.id AS purchase_id,
    NULL::uuid AS delivery_note_id
   FROM purchase_items pi
     JOIN purchases p ON pi.purchase_id = p.id
     LEFT JOIN profiles pr ON pi.returned_by = pr.id
     LEFT JOIN inventory i ON pi.item_id = i.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
  WHERE pi.returned_at IS NOT NULL AND p.deleted_at IS NULL;

GRANT SELECT ON public.stock_movements_view TO authenticated;
