SELECT * FROM public.checklists
ORDER BY id DESC


SELECT 
    v."regNo" AS vehicle_reg_no,
    CASE 
        WHEN c.id IS NOT NULL THEN true 
        ELSE false 
    END AS safety_check,
    u.displayname AS checked_by
FROM 
    vehicle v
LEFT JOIN checklists c ON v.id = c.vehicle_id 
    AND c."isSubmitted" = true 
    AND c."checklistDate" = CURRENT_DATE
LEFT JOIN "user" u ON c.checked_by_id = u.id
ORDER BY v."regNo";