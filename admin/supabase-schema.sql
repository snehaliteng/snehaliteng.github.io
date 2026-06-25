-- Run this in Supabase SQL Editor to enable admin access to contact table
-- This assumes snehaliteng@gmail.com is already authenticated via Supabase Auth

-- Enable RLS on contact table (if not already enabled)
ALTER TABLE contact ENABLE ROW LEVEL SECURITY;

-- Allow admin to read all contact rows
-- (Admin is identified by email via the authenticated user)
DROP POLICY IF EXISTS "Admin can read contact" ON contact;
CREATE POLICY "Admin can read contact" ON contact
  FOR SELECT USING (
    auth.jwt() ->> 'email' = 'snehaliteng@gmail.com'
  );

-- Allow admin to delete contact rows
DROP POLICY IF EXISTS "Admin can delete contact" ON contact;
CREATE POLICY "Admin can delete contact" ON contact
  FOR DELETE USING (
    auth.jwt() ->> 'email' = 'snehaliteng@gmail.com'
  );

-- Keep existing policy for public inserts
DROP POLICY IF EXISTS "Public can insert contact" ON contact;
CREATE POLICY "Public can insert contact" ON contact
  FOR INSERT WITH CHECK (true);

-- Grant anonymous INSERT access (for the contact form / newsletter)
GRANT INSERT ON contact TO anon;
GRANT USAGE ON SEQUENCE contact_id_seq TO anon;

-- Grant admin SELECT/DELETE
GRANT SELECT, DELETE ON contact TO authenticated;
