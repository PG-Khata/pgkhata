-- Read-only report. Run before and after migration 0024. Any returned row is
-- an unknown legacy URL that cannot safely be converted into an R2 object key
-- automatically and must be reviewed/migrated manually.
SELECT 'admin_document' AS source, id, file_name, file_url
FROM admin_document
WHERE storage_key IS NULL AND file_url <> 'private'
UNION ALL
SELECT 'tenant_document' AS source, id, file_name, file_url
FROM tenant_document
WHERE storage_key IS NULL AND file_url <> 'private'
ORDER BY source, id;
