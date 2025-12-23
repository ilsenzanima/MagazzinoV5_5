-- Enable delete for authenticated users on purchases
create policy "Authenticated users can delete purchases."
  on purchases for delete
  to authenticated
  using ( true );

-- Enable delete for authenticated users on purchase_items
create policy "Authenticated users can delete purchase items."
  on purchase_items for delete
  to authenticated
  using ( true );
