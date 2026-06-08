-- Describe workspaceMember table columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'workspace_1wgvd1injqtife6y4rvfbu3h5' AND table_name = 'workspaceMember';

-- Query workspaceMember rows
SELECT * FROM "workspace_1wgvd1injqtife6y4rvfbu3h5"."workspaceMember";
