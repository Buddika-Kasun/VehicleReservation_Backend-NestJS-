SELECT * FROM public."user"
ORDER BY id ASC 

SELECT 
  u.id as "ID",
  u.username as "Username",
  u.displayname as "Display Name",
  u.email as "E-mail",
  u.phone as "Phone No",
  u.role as "Role",
  d.name as "Department Name",
  u."isActive" as "Is Active",
  u."isApproved" as "Is Approved",
  TO_CHAR(u."createdAt", 'YYYY-MM-DD HH24:MI:SS') as "Created At",
  TO_CHAR(u."updatedAt", 'YYYY-MM-DD HH24:MI:SS') as "Updated At"
FROM public."user" u
LEFT JOIN "department" d ON u."departmentId" = d.id
ORDER BY u."createdAt";